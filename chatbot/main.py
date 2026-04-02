import json
import logging
import os
from uuid import uuid4
from contextlib import asynccontextmanager
from typing import List

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

import models
from database import Base, SessionLocal, engine
from routers import admin, chat, flows, handoff, users, manychat, customer_ops


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _seed_default_flow()
    _seed_services()
    yield


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
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Client-Request-Id") or str(uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    return response

app.include_router(chat.router)
app.include_router(flows.router)
app.include_router(users.router)
app.include_router(handoff.router)
app.include_router(admin.router)
app.include_router(manychat.router)
app.include_router(customer_ops.router)


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/swagger")


# ---------------------------------------------------------------------------
# Demo endpoint (used by the example flow's HTTP request node)
# ---------------------------------------------------------------------------

@app.get("/demo/services", tags=["demo"])
def demo_services() -> List[dict]:
    return [
        {
            "id": 1,
            "name": "Haircut",
            "price": 25,
            "duration": "30min",
            "image": "https://picsum.photos/200/150?random=1",
        },
        {
            "id": 2,
            "name": "Hair Coloring",
            "price": 80,
            "duration": "2h",
            "image": "https://picsum.photos/200/150?random=2",
        },
        {
            "id": 3,
            "name": "Manicure",
            "price": 35,
            "duration": "45min",
            "image": "https://picsum.photos/200/150?random=3",
        },
    ]


@app.get("/health", tags=["health"])
def health_check() -> dict:
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
