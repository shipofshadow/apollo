import json
import logging
import os
from uuid import uuid4
from contextlib import asynccontextmanager
from typing import Any, List

import uvicorn
import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.responses import RedirectResponse

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)

import models
from auth import require_admin
from database import Base, SessionLocal, engine
from engine.flow_validation import validate_flow_json_text
from engine.http_client import close_http_client, init_http_client
from routers import admin, ai, chat, flows, handoff, users, manychat, customer_ops


DEFAULT_FLOW_PATH = os.path.join(os.path.dirname(__file__), "example_flow.json")

OPENAPI_TAGS = [
    {
        "name": "chat",
        "description": "Customer chat entrypoint, history, and conversation state endpoints.",
    },
    {
        "name": "admin",
        "description": "Admin conversation controls: list, reply, takeover, release, and delete.",
    },
    {
        "name": "flows",
        "description": "Flow management CRUD for chatbot decision trees.",
    },
    {
        "name": "users",
        "description": "User session read and upsert operations.",
    },
    {
        "name": "handoff",
        "description": "Conversation handoff operations between bot and human agents.",
    },
    {
        "name": "manychat",
        "description": "ManyChat-compatible service and variant gallery endpoints.",
    },
    {
        "name": "ai",
        "description": "LLM-backed intent evaluation endpoint with strict JSON contract.",
    },
    {
        "name": "customer-ops",
        "description": "Customer profile, presence, service availability, and appointment actions.",
    },
    {
        "name": "health",
        "description": "Service health and liveness endpoints.",
    },
    {
        "name": "demo",
        "description": "Demo/sample endpoints used by example flow nodes.",
    },
]


def _seed_default_flow() -> None:
    """Insert a default active flow when no flow exists."""
    db = SessionLocal()
    try:
        count = db.query(models.Flow).count()
        if count == 0:
            raw = json.dumps(
                {
                    "id": "default_placeholder",
                    "name": "Default Flow",
                    "trigger_keywords": ["hello", "hi", "start", "hey"],
                    "nodes": [
                        {
                            "id": "start",
                            "message": "Hello! How can I help you today?",
                            "input_type": "quick_reply",
                            "options": [
                                {"label": "Book Appointment", "value": "book", "next": "collect_name"},
                                {"label": "Talk to Human", "value": "human", "next": "handoff"},
                            ],
                            "next": None,
                        },
                        {
                            "id": "collect_name",
                            "message": "Please share your name.",
                            "input_type": "text",
                            "variable": "name",
                            "validation": {"type": "required"},
                            "next": None,
                        },
                    ],
                }
            )

            if os.path.exists(DEFAULT_FLOW_PATH):
                with open(DEFAULT_FLOW_PATH, "r", encoding="utf-8") as fh:
                    candidate = fh.read()
                try:
                    json.loads(candidate)
                    raw = candidate
                except Exception:
                    pass

            flow_dict = json.loads(raw)
            flow = models.Flow(
                name=flow_dict.get("name", "Default Flow"),
                description="Seeded example booking flow.",
                flow_json=raw,
                is_active=True,
            )
            db.add(flow)
            db.commit()
    finally:
        db.close()


def _seed_services() -> None:
    """Insert sample services and variants for ManyChat menu/variants testing."""
    db = SessionLocal()
    try:
        if db.query(models.Service).count() > 0:
            return

        oil_change = models.Service(
            title="Oil Change",
            description="Keep your engine running smoothly.",
            image_url="https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=640&q=60",
            is_active=True,
        )
        car_wash = models.Service(
            title="Premium Car Wash",
            description="Interior and exterior deep clean.",
            image_url="https://images.unsplash.com/photo-1520340356584-8f87dff7a9f4?auto=format&fit=crop&w=640&q=60",
            is_active=True,
        )
        db.add_all([oil_change, car_wash])
        db.flush()

        db.add_all(
            [
                models.ServiceVariant(
                    service_id=oil_change.id,
                    name="Basic Oil Change",
                    description="Mineral oil, up to 4L.",
                    images="[]",
                ),
                models.ServiceVariant(
                    service_id=oil_change.id,
                    name="Synthetic Oil Change",
                    description="Full synthetic oil.",
                    images="[]",
                ),
                models.ServiceVariant(
                    service_id=car_wash.id,
                    name="Exterior Wash",
                    description="Foam wash and dry.",
                    images="[]",
                ),
                models.ServiceVariant(
                    service_id=car_wash.id,
                    name="Full Detailing",
                    description="Complete interior and exterior detailing.",
                    images="[]",
                ),
            ]
        )
        db.commit()
    finally:
        db.close()


def _validate_flows_on_startup() -> None:
    db = SessionLocal()
    try:
        flows_in_db = db.query(models.Flow).all()
        if not flows_in_db:
            raise RuntimeError("No chatbot flows found after startup seeding.")

        startup_errors: List[str] = []
        for flow in flows_in_db:
            errors = validate_flow_json_text(flow.flow_json or "")
            if errors:
                startup_errors.append(
                    f"Flow id={flow.id} name={flow.name or 'unnamed'} -> {', '.join(errors)}"
                )

        if startup_errors:
            raise RuntimeError("Flow preflight validation failed: " + " | ".join(startup_errors))
    finally:
        db.close()


async def _extract_context_ids(request: Request) -> tuple[str | None, str | None]:
    session_id = request.path_params.get("session_id") or request.query_params.get("session_id")
    conversation_id = request.path_params.get("conversation_id") or request.query_params.get("conversation_id")

    # Use cached body from request.state to avoid "stream consumed" errors
    body = getattr(request.state, "_cached_body", None)
    if body is None:
        try:
            body = await request.body()
        except RuntimeError:
            body = None
    
    if body:
        async def _receive() -> dict[str, Any]:
            return {"type": "http.request", "body": body, "more_body": False}

        request._receive = _receive  # type: ignore[attr-defined]

        if not session_id or not conversation_id:
            try:
                parsed = json.loads(body.decode("utf-8"))
                if isinstance(parsed, dict):
                    session_id = session_id or parsed.get("session_id")
                    conversation_id = conversation_id or parsed.get("conversation_id")
            except Exception:
                pass

    if not conversation_id and session_id:
        db = SessionLocal()
        try:
            conv = db.query(models.Conversation).filter_by(session_id=session_id).first()
            if conv:
                conversation_id = str(conv.id)
        finally:
            db.close()

    return (
        str(session_id) if session_id is not None else None,
        str(conversation_id) if conversation_id is not None else None,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    init_http_client()
    _seed_default_flow()
    _seed_services()
    _validate_flows_on_startup()
    try:
        yield
    finally:
        await close_http_client()


app = FastAPI(
    title="Autobot Chatbot API",
    description="FastAPI backend for a flow-based chatbot with human handoff.",
    version="1.0.0",
    docs_url="/swagger",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=OPENAPI_TAGS,
    contact={"name": "Autobot API Support", "email": "support@example.com"},
    license_info={"name": "Proprietary"},
    lifespan=lifespan,
)

# CORS configuration
# Set ALLOWED_ORIGINS to a comma-separated list of trusted origins in production,
# e.g. "https://mysite.com,https://other.com".
# Leave unset (or set to "*") to allow all origins (development only).
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()
if not _raw_origins or _raw_origins == "*":
    _allow_origins = ["*"]
    # Credentials (cookies) cannot be used with a wildcard origin per the CORS spec.
    _allow_credentials = False
else:
    _allow_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    _allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def cache_request_body(request: Request, call_next):
    """Cache request body early to prevent stream consumed errors."""
    if request.method in ["POST", "PUT", "PATCH"]:
        try:
            # Read and cache the body. After this, Starlette will cache it internally.
            body = await request.body()
            request.state._cached_body = body
        except Exception:
            # If reading fails, continue anyway - body might still work through internal caching
            pass
    
    return await call_next(request)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Client-Request-Id") or str(uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    return response


@app.middleware("http")
async def handle_unexpected_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        request_id = getattr(request.state, "request_id", str(uuid4()))
        # Extract context IDs using cached body
        session_id, conversation_id = await _extract_context_ids(request)

        logger.exception(
            "Unhandled server error request_id=%s conversation_id=%s session_id=%s path=%s",
            request_id,
            conversation_id,
            session_id,
            request.url.path,
        )

        if request.url.path == "/chat/send":
            return JSONResponse(
                status_code=200,
                content={
                    "messages": [
                        {
                            "content": "May temporary issue on our side. Please try again in a few moments.",
                            "message_type": "text",
                            "metadata": {
                                "fallback": True,
                                "request_id": request_id,
                                "conversation_id": conversation_id,
                            },
                        }
                    ],
                    "status": "bot",
                    "session_id": session_id or "",
                },
            )

        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error.",
                "request_id": request_id,
                "conversation_id": conversation_id,
            },
        )

app.include_router(chat.router)
app.include_router(flows.router, dependencies=[Depends(require_admin)])
app.include_router(users.router, dependencies=[Depends(require_admin)])
app.include_router(handoff.router, dependencies=[Depends(require_admin)])
app.include_router(admin.router, dependencies=[Depends(require_admin)])
app.include_router(manychat.router)
app.include_router(ai.router)
app.include_router(customer_ops.router, dependencies=[Depends(require_admin)])


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/swagger")

@app.get("/health", tags=["health"])
def health_check() -> dict:
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8300)
