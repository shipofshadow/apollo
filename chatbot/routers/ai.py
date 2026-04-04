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
    "services",
    "book",
    "info",
    "location",
    "small_talk",
    "handoff",
    "none",
    # Legacy aliases kept for backward compat
    "trigger_booking",
    "kwento",
    "human",
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

    services_words = {
        "services", "service", "menu", "presyo", "price", "pricing",
        "anong meron", "ano meron", "magkano", "ano services", "ayus", "ayos",
        "gaano", "halaga", "serbisyo", "anong services",
    }
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

    if any(word in text for word in services_words):
        return schemas.AIEvaluateResponse(
            message="Eto yung mga services namin boss, pili ka!",
            suggested_action="services",
        )

    if any(word in text for word in booking_words):
        return schemas.AIEvaluateResponse(
            message="Sige boss, simulan na natin booking mo!",
            suggested_action="book",
        )

    if any(word in text for word in small_talk_words):
        return schemas.AIEvaluateResponse(
            message="Game boss, kwentuhan muna tayo! Anong gusto mong pag-usapan?",
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


def _format_kb_text(raw_kb: Any) -> str:
    """
    Convert the live menu data (from /api/services) into a clean, readable
    text block that the LLM can reference without confusion.
    """
    if isinstance(raw_kb, str):
        # Try to parse if it's a JSON string
        try:
            data = json.loads(raw_kb)
        except (json.JSONDecodeError, ValueError):
            return raw_kb.strip()
    else:
        data = raw_kb

    if not data:
        return ""

    # Handle list of services
    if isinstance(data, list):
        lines = ["AVAILABLE SERVICES:"]
        for item in data:
            if not isinstance(item, dict):
                continue
            name = item.get("name") or item.get("title") or ""
            desc = item.get("description") or item.get("subtitle") or ""
            service_id = item.get("id") or item.get("service_id") or ""
            if name:
                line = f"- {name}"
                if service_id:
                    line += f" (ID: {service_id})"
                if desc:
                    line += f": {desc}"
                lines.append(line)
        return "\n".join(lines)

    # Handle dict response (e.g. {data: [...], ...})
    if isinstance(data, dict):
        inner = data.get("data") or data.get("services") or data.get("items") or []
        if isinstance(inner, list) and inner:
            return _format_kb_text(inner)
        # Fallback: stringify cleanly
        return json.dumps(data, ensure_ascii=False, indent=2)[:3000]

    return str(data)[:3000]


def _build_system_prompt(kb_text: Any) -> str:
    formatted_kb = _format_kb_text(kb_text)
    kb_section = formatted_kb if formatted_kb else "(No live menu data available)"
    return f"""You are AutoBot, the AI assistant and booking agent for 1625 Auto Lab — a premium automotive retrofitting shop in San Fernando, Pampanga, Philippines.

Your personality: Street-smart, friendly, conversational Taglish. Use phrases like "Yo boss", "Solid", "G!", "No worries". Never sound corporate.

## BUSINESS FACTS
- Shop: 1625 Auto Lab
- Specialty: Premium Automotive Retrofitting (lighting, audio, accessories, coatings, wraps, etc.)
- Address: NKKS Arcade, Krystal Homes, Brgy. Alasas, San Fernando, Pampanga 2000, Philippines
- Hours: Monday–Saturday, 9:00 AM – 6:00 PM
- Contact: 0939 330 8263 | 1625autolab@gmail.com
- Booking: Done through this chat — the bot will guide the customer step by step

## LIVE SERVICES MENU
{kb_section}

## YOUR TASK
Read the user's latest message. Determine their intent. Output ONLY a valid JSON object with exactly two keys:
- "message": Your reply to the user (in Taglish, 1–3 sentences max)
- "suggested_action": One of the action strings below

## INTENT → ACTION MAPPING (choose the BEST match)

"services" — User asks to see services, pricing, "anong meron", "ano mga ayos niyo", "magkano", or mentions a specific service from the menu.
  → message: Acknowledge and say you'll show the menu. E.g. "Eto yung services namin boss, pili ka!"

"book" — User says they want to book, schedule, reserve, or make an appointment.
  → message: Confirm you'll start the booking. E.g. "Sige boss, simulan na natin booking mo!"

"info" — User asks about location, address, directions, operating hours, contact info.
  → message: Give the relevant shop info directly from the BUSINESS FACTS above.

"small_talk" — User is making small talk, greeting, asking how you are, sharing a story, or asking general car questions not in the menu.
  → message: Respond naturally and warmly in Taglish. Be helpful and guide them toward a service if relevant.

"handoff" — User is angry, frustrated, insists on speaking to a real person, wants a refund, or asks for a technical diagnosis.
  → message: Empathize and say you'll connect them to the team. E.g. "Sige boss, iko-connect kita sa team namin!"

"none" — User's message is unclear, a follow-up question, or doesn't fit the above categories.
  → message: Give your best helpful answer in Taglish and invite them to ask more or pick an option.

## RULES
1. NEVER invent services, prices, promos, or dates not in the LIVE SERVICES MENU or BUSINESS FACTS.
2. If you don't know the answer, reply: "Hindi ko sure boss, pero pwede ko i-forward sa team namin para ma-check."
3. Always output valid JSON. No markdown, no commentary outside the JSON.
4. Keep "message" under 200 characters unless the user asked a detailed question.
5. For "info" intent, include the actual address/hours/contact in the message."""

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
                                    "services",
                                    "book",
                                    "info",
                                    "location",
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
    # Format live KB context first (handles JSON objects like {"services": [...]}).
    kb_text = _format_kb_text(payload.kb_context or "")

    # Only fall back to admin KB when live data yields nothing.
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
        # Keyword-based intent override: some models generate the correct reply
        # message but misclassify the intent.  For unambiguous service/booking
        # queries, trust the keyword match over the LLM's suggested_action.
        text_lower = payload.user_message.lower()
        _services_kw = {
            "services", "service", "menu", "presyo", "price", "pricing",
            "magkano", "ayos", "ayus", "serbisyo",
        }
        _booking_kw = {
            "book", "booking", "schedule", "appointment",
            "pa-schedule", "reserve",
        }
        if any(kw in text_lower for kw in _services_kw) and llm_result.suggested_action not in ("services", "book"):
            return schemas.AIEvaluateResponse(
                message=llm_result.message, suggested_action="services"
            )
        if any(kw in text_lower for kw in _booking_kw) and llm_result.suggested_action != "book":
            return schemas.AIEvaluateResponse(
                message=llm_result.message, suggested_action="book"
            )
        return llm_result

    # LLM unavailable or returned unusable data — use deterministic guardrail.
    print("[ai_router] Falling back to rule-based response.")
    return _rule_based_response(payload.user_message, kb_text)