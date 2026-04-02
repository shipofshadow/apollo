import json
import os
import re
from typing import List

from fastapi import APIRouter, Depends
from google import genai
from google.genai import types as genai_types
from openai import AsyncOpenAI
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(prefix="/ai", tags=["ai"])

_ALLOWED_ACTIONS = {"trigger_booking", "handoff", "none"}
_UNKNOWN_REPLY = "Hindi ko sure boss, pero pwede ko i-forward sa tao namin para ma-check."


def _clean_kb_text(raw_kb: str) -> str:
    text = (raw_kb or "").strip()
    if text.startswith("{") and text.endswith("}"):
        return ""
    return text


def _normalize_action(action: str) -> str:
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
    text = user_message.lower()

    booking_words = {
        "book",
        "booking",
        "schedule",
        "appointment",
        "pa-schedule",
        "paschedule",
        "reserve",
        "set natin",
    }
    angry_words = {
        "galit",
        "bwisit",
        "pangit serbisyo",
        "refund",
        "reklamo",
        "complaint",
        "angry",
        "frustrated",
    }
    diagnosis_words = {"diagnose", "diagnosis", "sira", "ano sira", "check engine"}

    if any(word in text for word in booking_words):
        return schemas.AIEvaluateResponse(
            message="Sige boss, set natin appointment mo ngayon.",
            suggested_action="trigger_booking",
        )

    if any(word in text for word in angry_words) or any(word in text for word in diagnosis_words):
        return schemas.AIEvaluateResponse(message=_UNKNOWN_REPLY, suggested_action="handoff")

    matched_line = _best_kb_line(user_message, kb_text)
    if matched_line:
        return schemas.AIEvaluateResponse(message=_trim_message(matched_line), suggested_action="none")

    return schemas.AIEvaluateResponse(message=_UNKNOWN_REPLY, suggested_action="handoff")


async def _llm_json_response(user_message: str, kb_text: str) -> schemas.AIEvaluateResponse | None:
    provider = os.environ.get("AI_PROVIDER", "openai").strip().lower() or "openai"

    if provider == "gemini":
        return await _gemini_json_response(user_message, kb_text)
    return await _openai_json_response(user_message, kb_text)


def _build_system_prompt(kb_text: str) -> str:
    return (
        "You are AutoBot, the street-smart, highly efficient customer service assistant for 1625 Auto Lab. "
        "Your goal is to answer questions strictly using the knowledge base and push users to book an appointment.\n\n"
        "=== ADMIN KNOWLEDGE BASE ===\n"
        f"{kb_text}\n"
        "============================\n\n"
        "RULES:\n"
        "1. NO HALLUCINATIONS. If the answer is not in the knowledge base, state exactly: \"Hindi ko sure boss, pero pwede ko i-forward sa tao namin para ma-check.\"\n"
        "2. Keep it brief. 1-2 short sentences. Taglish. Direct to the point. No corporate fluff.\n"
        "3. NEVER make up prices, discounts, or guarantees.\n\n"
        "OUTPUT FORMAT (JSON ONLY):\n"
        "You must output valid JSON with exactly two keys: \"message\" and \"suggested_action\".\n"
        "- \"message\": Your reply to the user.\n"
        "- \"suggested_action\": Must be ONE of the following strings:\n"
        "  - \"trigger_booking\": If the user indicates they want to schedule, book, or proceed.\n"
        "  - \"handoff\": If the user is angry, asking for a mechanic's specific diagnosis, or asking something outside the KB.\n"
        "  - \"none\": For general questions where they aren't ready to book yet."
    )


def _parse_structured_output(content: str) -> schemas.AIEvaluateResponse | None:
    if not content:
        return None

    parsed = json.loads(content)
    if not isinstance(parsed, dict):
        return None

    message = _trim_message(str(parsed.get("message", "")).strip())
    action = _normalize_action(str(parsed.get("suggested_action", "none")))

    if message == _UNKNOWN_REPLY and action == "none":
        action = "handoff"

    return schemas.AIEvaluateResponse(message=message, suggested_action=action)


async def _openai_json_response(user_message: str, kb_text: str) -> schemas.AIEvaluateResponse | None:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None

    model = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini").strip() or "gpt-4.1-mini"
    base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    system_prompt = _build_system_prompt(kb_text)

    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    response = await client.responses.create(
        model=model,
        temperature=0.1,
        input=[
            {
                "role": "system",
                "content": [{"type": "input_text", "text": system_prompt}],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": user_message}],
            },
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "autobot_response",
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["message", "suggested_action"],
                    "properties": {
                        "message": {"type": "string"},
                        "suggested_action": {
                            "type": "string",
                            "enum": ["trigger_booking", "handoff", "none"],
                        },
                    },
                },
            }
        },
    )

    content = str(getattr(response, "output_text", "") or "").strip()
    if not content:
        data = response.model_dump()
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

    return _parse_structured_output(content)


async def _gemini_json_response(user_message: str, kb_text: str) -> schemas.AIEvaluateResponse | None:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
    system_prompt = _build_system_prompt(kb_text)

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

    content = str(getattr(response, "text", "") or "").strip()
    if not content:
        data = response.model_dump() if hasattr(response, "model_dump") else {}
        candidates = data.get("candidates", []) if isinstance(data, dict) else []
        if isinstance(candidates, list) and candidates:
            content = (
                candidates[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )

    return _parse_structured_output(content)


@router.post("/evaluate", response_model=schemas.AIEvaluateResponse)
async def evaluate_intent(
    payload: schemas.AIEvaluateRequest,
    db: Session = Depends(get_db),
) -> schemas.AIEvaluateResponse:
    kb_text = _clean_kb_text(payload.kb_context or "")
    if not kb_text:
        latest = (
            db.query(models.ChatbotAISettings)
            .order_by(models.ChatbotAISettings.updated_at.desc())
            .first()
        )
        if latest and latest.admin_kb_text:
            kb_text = latest.admin_kb_text.strip()

    if not kb_text:
        kb_text = os.environ.get("AUTOBOT_ADMIN_KB", "").strip()

    try:
        llm_result = await _llm_json_response(payload.user_message, kb_text)
        if llm_result is not None:
            return llm_result
    except Exception:
        # Fall through to deterministic guardrail response.
        pass

    return _rule_based_response(payload.user_message, kb_text)
