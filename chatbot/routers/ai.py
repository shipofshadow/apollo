import json
import os
import re
import traceback
from typing import List, Optional

from fastapi import APIRouter, Depends
from google import genai
from google.genai import types as genai_types
from openai import AsyncOpenAI
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(prefix="/ai", tags=["ai"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# All action values that may be produced by either the LLM or rule-based path.
# The flow engine's router only acts on a subset of these, but they must all
# pass _normalize_action unchanged so routing rules can match them correctly.
_ALLOWED_ACTIONS = {
    "trigger_booking",
    "handoff",
    "none",
    "small_talk",       # rule-based + LLM (via prompt hint)
    "kwento",           # rule-based alias — router treats same as small_talk
    "services",         # convenience intents that map directly to flow nodes
    "book",
    "location",
    "info",
}

_UNKNOWN_REPLY = "Hindi ko sure boss, pero pwede ko i-forward sa tao namin para ma-check."


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _clean_kb_text(raw_kb: str) -> str:
    text = (raw_kb or "").strip()
    if text.startswith("{") and text.endswith("}"):
        return ""
    return text


def _normalize_action(action: str) -> str:
    """
    Return the action string unchanged if it is in _ALLOWED_ACTIONS,
    otherwise fall back to "none".  Never returns an empty string or None.
    """
    value = str(action or "").strip().lower()
    if value in _ALLOWED_ACTIONS:
        return value
    return "none"


def _trim_message(message: str) -> str:
    text = " ".join(str(message or "").split())
    if not text:
        return _UNKNOWN_REPLY
    if len(text) > 350:
        return text[:350].rstrip() + "..."
    return text


def _kb_lines(kb_text: str) -> List[str]:
    return [line.strip(" -\t") for line in kb_text.splitlines() if line.strip()]


def _best_kb_line(user_message: str, kb_text: str) -> str:
    query_words = set(re.findall(r"[a-zA-Z0-9]+", user_message.lower()))
    best_line = ""
    best_score = 0
    for line in _kb_lines(kb_text):
        line_words = set(re.findall(r"[a-zA-Z0-9]+", line.lower()))
        if not line_words:
            continue
        score = len(query_words & line_words)
        if score > best_score:
            best_score = score
            best_line = line
    return best_line if best_score > 0 else ""


def _rule_based_response(user_message: str, kb_text: str) -> schemas.AIEvaluateResponse:
    """
    Deterministic fallback that never raises.  All action strings it produces
    are members of _ALLOWED_ACTIONS so they survive _normalize_action intact.
    """
    text = user_message.lower()

    booking_words = {
        "book", "booking", "schedule", "appointment", "pa-schedule",
        "paschedule", "reserve", "set natin",
    }
    angry_words = {
        "galit", "bwisit", "pangit serbisyo", "refund", "reklamo",
        "complaint", "angry", "frustrated",
    }
    diagnosis_words = {"diagnose", "diagnosis", "sira", "ano sira", "check engine"}
    small_talk_words = {
        "kwento", "kwento tayo", "kamusta", "kamusta ka", "musta",
        "hello", "hi", "hey", "kumusta", "usapan", "kwentuhan", "chika",
        "chikahan", "kamustahan", "balita", "anong balita", "kamusta buhay",
    }

    if any(word in text for word in booking_words):
        return schemas.AIEvaluateResponse(
            message="Sige boss, set natin appointment mo ngayon.",
            suggested_action="trigger_booking",
        )

    if any(word in text for word in small_talk_words):
        return schemas.AIEvaluateResponse(
            message="Game boss, kwentuhan muna tayo! Anong gusto mong pag-usapan?",
            # Use "small_talk" (canonical) rather than the alias "kwento"
            # so it matches the routing rule in node_ai_router.
            suggested_action="small_talk",
        )

    if any(word in text for word in angry_words) or any(word in text for word in diagnosis_words):
        return schemas.AIEvaluateResponse(
            message=_UNKNOWN_REPLY,
            suggested_action="handoff",
        )

    matched_line = _best_kb_line(user_message, kb_text)
    if matched_line:
        return schemas.AIEvaluateResponse(
            message=_trim_message(matched_line),
            suggested_action="none",
        )

    return schemas.AIEvaluateResponse(
        message=_UNKNOWN_REPLY,
        suggested_action="handoff",
    )


async def _llm_json_response(
    user_message: str, kb_text: str
) -> Optional[schemas.AIEvaluateResponse]:
    provider = os.environ.get("AI_PROVIDER", "openai").strip().lower() or "openai"

    if provider == "gemini":
        return await _gemini_json_response(user_message, kb_text)
    return await _openai_json_response(user_message, kb_text)


def _build_system_prompt(kb_text: str) -> str:
    return f"""You are AutoBot, the frontline sales AI for 1625 Auto Lab.
            Your job is to read the user's message, determine their intent, and output a STRICT JSON object.

            # BUSINESS DATA
            Entity: 1625 Auto Lab
            Specialty: Premium Automotive Retrofitting
            Location: NKKS Arcade, Krystal Homes, Brgy. Alasas, San Fernando, Pampanga, Philippines 2000
            Contact: 0939 330 8263 | 1625autolab@gmail.com
            Tone: Street-smart, conversational Taglish (e.g., "Yo boss", "Solid", "G!"). Zero corporate cringe.

            # LIVE MENU DATA / ADMIN KB
            {kb_text}

            # OUTPUT FORMAT (STRICT JSON ONLY)
            You must reply with a valid JSON object containing exactly two keys: "message" and "suggested_action".

            # ROUTING RULES FOR "suggested_action"
            1. "services" -> Use this if the user asks for a list of services, pricing, "anong meron", or "ano mga services niyo". 
            - message MUST BE: "Ito yung service menu natin boss:"
            2. "book" -> Use this if the user explicitly asks to book or schedule an appointment.
            - message MUST BE: "Sige boss, pa-book natin."
            3. "info" -> Use this if the user asks for shop location, operating hours, or contact number.
            - message MUST BE: "Eto ang shop details natin boss:"
            4. "handoff" -> Use this if the user wants to speak to a real person, is angry, or asks for mechanic diagnosis.
            - message MUST BE: "Sige boss, iko-connect kita."
            5. "small_talk" -> Use this for general small talk, greetings, or specific car questions.
            - message MUST BE: A natural Taglish response using the Business Data.
            6. "none" -> General question; user is not ready to book yet."""

def _parse_structured_output(content: str) -> Optional[schemas.AIEvaluateResponse]:
    """
    Parse the LLM's JSON output into an AIEvaluateResponse.

    Returns None (instead of raising) on any parse or validation failure so
    that the caller can fall through to the rule-based guardrail.
    """
    if not content:
        return None

    # Strip accidental markdown code fences that some models emit.
    cleaned = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()

    try:
        parsed = json.loads(cleaned)
    except (json.JSONDecodeError, ValueError) as exc:
        print(f"[ai_router] JSON parse error: {exc} | raw content: {content!r}")
        return None

    if not isinstance(parsed, dict):
        print(f"[ai_router] Unexpected LLM output type: {type(parsed).__name__}")
        return None

    raw_message = str(parsed.get("message", "")).strip()
    raw_action = str(parsed.get("suggested_action", "")).strip()

    # Both fields must be present and non-empty for the response to be usable.
    if not raw_message or not raw_action:
        print(
            f"[ai_router] LLM response missing required fields: "
            f"message={raw_message!r}, suggested_action={raw_action!r}"
        )
        return None

    message = _trim_message(raw_message)
    action = _normalize_action(raw_action)

    # If the LLM returned the unknown-reply sentinel with action="none",
    # upgrade to "handoff" so an agent can assist.
    if message == _UNKNOWN_REPLY and action == "none":
        action = "handoff"

    return schemas.AIEvaluateResponse(message=message, suggested_action=action)


async def _openai_json_response(
    user_message: str, kb_text: str
) -> Optional[schemas.AIEvaluateResponse]:
    """
    Call the OpenAI-compatible endpoint.  Returns None on any failure so the
    caller can fall through to _rule_based_response — never raises.
    """
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("[ai_router] OPENAI_API_KEY not set — skipping OpenAI call.")
        return None

    model = (
        os.environ.get("OPENAI_MODEL", "qwen/qwen3.6-plus:free").strip()
        or "qwen/qwen3.6-plus:free"
    )
    base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    system_prompt = _build_system_prompt(kb_text)

    try:
        client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.1,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "evaluate_response_schema",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["message", "suggested_action"],
                        "properties": {
                            "message": {"type": "string"},
                            "suggested_action": {
                                "type": "string",
                                "enum": [
                                    "trigger_booking",
                                    "small_talk",
                                    "handoff",
                                    "none",
                                ],
                            },
                        },
                    },
                },
            },
            extra_body={
                "reasoning": {"enabled": False},
            },
        )

        print("LLM raw response:", response)

        # Primary path: standard chat completion shape.
        content: Optional[str] = None
        if response.choices and response.choices[0].message:
            content = response.choices[0].message.content

        # Fallback: some providers nest output differently.
        if not content:
            try:
                data = response.model_dump() if hasattr(response, "model_dump") else {}
                output = data.get("output", [])
                if isinstance(output, list):
                    for item in output:
                        if not isinstance(item, dict):
                            continue
                        for chunk in item.get("content", []):
                            if not isinstance(chunk, dict):
                                continue
                            if chunk.get("type") in {"output_text", "text"}:
                                candidate = str(chunk.get("text", "")).strip()
                                if candidate:
                                    content = candidate
                                    break
                        if content:
                            break
            except Exception as inner:
                print(f"[ai_router] Error extracting content from model_dump: {inner}")

        if not content:
            print("[ai_router] OpenAI response contained no usable content.")
            return None

        return _parse_structured_output(content)

    except Exception as exc:
        print(f"[ai_router] OpenAI call failed: {exc}\n{traceback.format_exc()}")
        return None


async def _gemini_json_response(
    user_message: str, kb_text: str
) -> Optional[schemas.AIEvaluateResponse]:
    """
    Call the Gemini API.  Returns None on any failure so the caller can fall
    through to _rule_based_response — never raises.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("[ai_router] GEMINI_API_KEY not set — skipping Gemini call.")
        return None

    model = (
        os.environ.get("GEMINI_MODEL", "gemini-2.5-flash").strip()
        or "gemini-2.5-flash"
    )
    system_prompt = _build_system_prompt(kb_text)

    try:
        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model=model,
            contents=user_message,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )

        content: Optional[str] = str(getattr(response, "text", "") or "").strip()

        if not content:
            try:
                data = response.model_dump() if hasattr(response, "model_dump") else {}
                candidates = data.get("candidates", []) if isinstance(data, dict) else []
                if isinstance(candidates, list) and candidates:
                    content = (
                        candidates[0]
                        .get("content", {})
                        .get("parts", [{}])[0]
                        .get("text", "")
                    )
            except Exception as inner:
                print(f"[ai_router] Error extracting content from Gemini model_dump: {inner}")

        if not content:
            print("[ai_router] Gemini response contained no usable content.")
            return None

        return _parse_structured_output(content)

    except Exception as exc:
        print(f"[ai_router] Gemini call failed: {exc}\n{traceback.format_exc()}")
        return None


# ---------------------------------------------------------------------------
# FastAPI endpoint
# ---------------------------------------------------------------------------

@router.post("/evaluate", response_model=schemas.AIEvaluateResponse)
async def evaluate_intent(
    payload: schemas.AIEvaluateRequest,
    db: Session = Depends(get_db),
) -> schemas.AIEvaluateResponse:
    """
    Evaluate user intent via LLM with a deterministic rule-based fallback.

    Failure hierarchy:
      1. Try the configured LLM provider (OpenAI-compatible or Gemini).
      2. If the LLM call raises, returns None, or produces an unparseable /
         incomplete response, fall through to _rule_based_response.
      3. _rule_based_response is guaranteed to always return a valid response.
    """
    kb_text = _clean_kb_text(payload.kb_context or "")
    if not kb_text:
        try:
            latest = (
                db.query(models.ChatbotAISettings)
                .order_by(models.ChatbotAISettings.updated_at.desc())
                .first()
            )
            if latest and latest.admin_kb_text:
                kb_text = latest.admin_kb_text.strip()
        except Exception as db_exc:
            # DB failure is non-fatal; continue with empty KB.
            print(f"[ai_router] DB error fetching KB: {db_exc}")

    if not kb_text:
        kb_text = os.environ.get("AUTOBOT_ADMIN_KB", "").strip()

    llm_result: Optional[schemas.AIEvaluateResponse] = None
    try:
        llm_result = await _llm_json_response(payload.user_message, kb_text)
    except Exception as exc:
        # Broad catch so no unhandled exception escapes the endpoint.
        print(f"[ai_router] Unhandled error in _llm_json_response: {exc}\n{traceback.format_exc()}")

    if llm_result is not None:
        return llm_result

    # LLM unavailable or returned unusable data — use deterministic guardrail.
    print("[ai_router] Falling back to rule-based response.")
    return _rule_based_response(payload.user_message, kb_text)