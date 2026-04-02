import json
import re
import asyncio
from datetime import date as _date, timedelta
from typing import Any, Dict, List, Optional, Tuple

import httpx

from engine.conditions import validate_input
from engine.http_client import get_http_client


CLOSE_CONFIRM_NODE_ID = "__close_confirm__"

_AFFIRMATIVE_CLOSE_VALUES = {
    "yes",
    "y",
    "oo",
    "opo",
    "sige",
    "close",
    "close it",
    "please close",
}

_NEGATIVE_CLOSE_VALUES = {
    "no",
    "n",
    "hindi",
    "wag",
    "not yet",
    "keep open",
}


def _append_close_confirmation_prompt(response_messages: List[Dict[str, Any]]) -> None:
    response_messages.append(
        {
            "content": "Thank you! Should we close this conversation now?",
            "message_type": "quick_reply",
            "metadata": {
                "options": [
                    {"label": "Yes, close it", "value": "yes"},
                    {"label": "No, keep it open", "value": "no"},
                ]
            },
        }
    )


def _is_affirmative_close(value: str) -> bool:
    return value.strip().lower() in _AFFIRMATIVE_CLOSE_VALUES


def _is_negative_close(value: str) -> bool:
    return value.strip().lower() in _NEGATIVE_CLOSE_VALUES


def _interpolate(text: str, variables: Dict[str, Any]) -> str:
    """Replace {variable} placeholders with values from variables dict."""
    def replacer(match: re.Match) -> str:
        key = match.group(1)
        return str(variables.get(key, match.group(0)))

    return re.sub(r"\{(\w+)\}", replacer, text)


def _try_parse_json(value: str) -> Any:
    try:
        return json.loads(value)
    except Exception:
        return value


def _resolve_template(value: Any, variables: Dict[str, Any]) -> Any:
    """
    Recursively resolve interpolation placeholders and helper coercions.

    Supported helpers:
      {"$int": "{var}"}
      {"$csv": "{var}"}
      {"$variations": {"serviceId": "{service_id}", "variationId": "{variant_id}", "variationName": "{variation_name}"}}
    """
    if isinstance(value, str):
        return _interpolate(value, variables)

    if isinstance(value, list):
        return [_resolve_template(v, variables) for v in value]

    if isinstance(value, dict):
        if len(value) == 1 and "$int" in value:
            raw = _resolve_template(value["$int"], variables)
            try:
                return int(str(raw).strip())
            except Exception:
                return None

        if len(value) == 1 and "$csv" in value:
            raw = _resolve_template(value["$csv"], variables)
            if isinstance(raw, list):
                return raw
            if raw is None:
                return []
            raw_text = str(raw).strip()
            if raw_text == "" or raw_text.lower() in {"skip", "none", "n/a", "na"}:
                return []
            parts = [p.strip() for p in str(raw).split(",")]
            return [p for p in parts if p]

        if len(value) == 1 and "$variations" in value:
            spec = value["$variations"]
            if not isinstance(spec, dict):
                return []
            item = _resolve_template(spec, variables)
            return [item]

        return {k: _resolve_template(v, variables) for k, v in value.items()}

    return value


# ---------------------------------------------------------------------------
# Relative-date and vehicle-info helpers
# ---------------------------------------------------------------------------

_RELATIVE_DATE_MAP = {
    "ngayon": 0, "today": 0,
    "bukas": 1, "tomorrow": 1,
    "makalawa": 2, "day after tomorrow": 2,
    "next week": 7, "susunod na linggo": 7,
}

_DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

_VEHICLE_YEAR_RE = re.compile(r"\b(19[89]\d|20[0-2]\d)\b")

# Sort longest first so "land rover" matches before "rover".
_COMMON_MAKES = sorted([
    "land rover", "alfa romeo", "aston martin", "rolls royce",
    "toyota", "honda", "ford", "chevrolet", "chevy", "nissan",
    "hyundai", "kia", "bmw", "mercedes", "benz", "audi",
    "volkswagen", "vw", "mazda", "mitsubishi", "subaru", "lexus",
    "acura", "infiniti", "jeep", "dodge", "chrysler", "ram",
    "gmc", "cadillac", "buick", "lincoln", "volvo", "porsche",
    "suzuki", "isuzu", "daihatsu", "perodua", "proton", "geely",
    "byd", "mg", "peugeot", "renault", "citroen", "fiat", "jaguar",
], key=len, reverse=True)


def _parse_relative_date(text: str) -> Optional[str]:
    """
    Convert Filipino/English relative date phrases to YYYY-MM-DD.
    Returns None if the text is not a recognized relative expression.
    """
    t = text.strip().lower()
    today = _date.today()

    if t in _RELATIVE_DATE_MAP:
        return (today + timedelta(days=_RELATIVE_DATE_MAP[t])).strftime("%Y-%m-%d")

    # "next monday" / "susunod na monday"
    for i, day in enumerate(_DAY_NAMES):
        if t in (f"next {day}", f"susunod na {day}"):
            days_ahead = i - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    # "in N days" / "N days"
    m = re.match(r"^(?:in\s+)?(\d+)\s+days?$", t)
    if m:
        return (today + timedelta(days=int(m.group(1)))).strftime("%Y-%m-%d")

    return None


def _extract_vehicle_info(text: str) -> Optional[Dict[str, str]]:
    """
    Try to extract year, make, and model from a free-text vehicle description
    such as '2020 Honda Civic' or 'Honda Civic 2019'.
    Returns a dict with vehicle_year, vehicle_make, vehicle_model or None.
    """
    year_match = _VEHICLE_YEAR_RE.search(text)
    if not year_match:
        return None
    year = year_match.group(1)

    # Remove the year from the string; the rest should be make + model.
    rest = (text[: year_match.start()] + text[year_match.end() :]).strip()

    detected_make: Optional[str] = None
    for make in _COMMON_MAKES:
        pat = re.compile(re.escape(make), re.IGNORECASE)
        if pat.search(rest):
            detected_make = make.title()
            rest = pat.sub("", rest).strip()
            break

    if not detected_make:
        return None

    model = re.sub(r"\s+", " ", rest).strip(" ,.-")
    if not model:
        return None

    return {"vehicle_year": year, "vehicle_make": detected_make, "vehicle_model": model}


def _try_parse_payload_input(text: str) -> Optional[Dict[str, Any]]:
    """Parse button payload JSON sent by the widget, if present."""
    parsed = _try_parse_json((text or "").strip())
    if isinstance(parsed, dict):
        return parsed
    return None


def _deep_get(source: Any, path: str) -> Any:
    """Resolve dotted-path values from dictionaries/lists, e.g. a.b.c."""
    if not path:
        return None

    parts = [p.strip() for p in str(path).split(".") if p.strip()]
    current = source
    for part in parts:
        if isinstance(current, dict):
            if part not in current:
                return None
            current = current[part]
            continue
        if isinstance(current, list):
            if not part.isdigit():
                return None
            idx = int(part)
            if idx < 0 or idx >= len(current):
                return None
            current = current[idx]
            continue
        return None
    return current


def _resolve_payload_value(
    variables: Dict[str, Any],
    payload_data: Optional[Dict[str, Any]],
    key: Any,
) -> Any:
    raw_key = str(key).strip()
    if not raw_key:
        return None

    # Prefer explicit payload object values when present.
    if isinstance(payload_data, dict):
        if raw_key in payload_data and payload_data[raw_key] not in (None, ""):
            return payload_data[raw_key]
        nested_payload_value = _deep_get(payload_data, raw_key)
        if nested_payload_value not in (None, ""):
            return nested_payload_value

    # Fallback to values already stored in flow variables.
    if raw_key in variables and variables[raw_key] not in (None, ""):
        return variables[raw_key]
    nested_var_value = _deep_get(variables, raw_key)
    if nested_var_value not in (None, ""):
        return nested_var_value

    return None


def _apply_payload_assign(
    variables: Dict[str, Any],
    payload_assign: Any,
    payload_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if not isinstance(payload_assign, dict):
        return variables

    merged = {**variables}
    for target_var, payload_keys in payload_assign.items():
        keys = payload_keys if isinstance(payload_keys, list) else [payload_keys]
        chosen = None
        for key in keys:
            chosen = _resolve_payload_value(merged, payload_data, key)
            if chosen is not None:
                break
        if chosen is not None:
            merged[target_var] = str(chosen)

    return merged


def _matches_routing_condition(condition: str, variables: Dict[str, Any]) -> bool:
    """Evaluate very small condition language: '<left> == <right>' or '!='."""
    if not isinstance(condition, str) or not condition.strip():
        return False

    rendered = _interpolate(condition, variables).strip()
    operator = None
    if "==" in rendered:
        operator = "=="
    elif "!=" in rendered:
        operator = "!="
    else:
        return False

    left, right = rendered.split(operator, 1)
    left = left.strip().strip("\"'")
    right = right.strip().strip("\"'")
    if operator == "==":
        return left == right
    return left != right


def _resolve_routing_next(node: Dict[str, Any], variables: Dict[str, Any]) -> Optional[str]:
    rules = node.get("routing_rules")
    if isinstance(rules, list):
        for rule in rules:
            if not isinstance(rule, dict):
                continue
            condition = rule.get("condition")
            target = rule.get("next")
            if not isinstance(target, str) or not target.strip():
                continue
            if _matches_routing_condition(str(condition or ""), variables):
                return target.strip()

    fallback = node.get("next")
    if isinstance(fallback, str) and fallback.strip():
        return fallback.strip()
    return None


def _normalize_optional_input(text: str) -> str:
    """Treat common skip markers as empty string for optional free-text nodes."""
    raw = (text or "").strip()
    if raw.lower() in {"skip", "none", "n/a", "na"}:
        return ""
    return raw


def _sync_vehicle_info(variables: Dict[str, Any]) -> Dict[str, Any]:
    """Build vehicle_info from make/model/year when all fields are present."""
    make = str(variables.get("vehicle_make", "")).strip()
    model = str(variables.get("vehicle_model", "")).strip()
    year = str(variables.get("vehicle_year", "")).strip()

    if make and model and year:
        return {**variables, "vehicle_info": f"{make} {model} {year}"}
    return variables


def _sync_selection_labels(variables: Dict[str, Any]) -> Dict[str, Any]:
    """Populate service_name/variation_name from stored gallery responses when missing."""

    def _pick_title(
        source_data: Any,
        id_value: Any,
        id_keys: Tuple[str, ...],
    ) -> Optional[str]:
        cards = _extract_cards(source_data)
        if not cards:
            return None

        raw_id = str(id_value).strip()
        target = raw_id.lower()

        # First try exact id match against common id keys.
        for card in cards:
            for key in id_keys:
                card_id = card.get(key)
                if card_id is None:
                    continue
                if str(card_id).strip().lower() == target:
                    title = str(card.get("title", "")).strip()
                    return title or None

        # Fallback: support index input like "1", "2".
        if raw_id.isdigit():
            idx = int(raw_id) - 1
            if 0 <= idx < len(cards):
                title = str(cards[idx].get("title", "")).strip()
                return title or None

        return None

    updated = {**variables}

    service_id = updated.get("service_id")
    service_name = str(updated.get("service_name", "")).strip()
    if service_id not in (None, "") and not service_name:
        inferred = _pick_title(updated.get("services"), service_id, ("service_id",))
        if inferred:
            updated["service_name"] = inferred

    variant_id = updated.get("variant_id")
    variation_name = str(updated.get("variation_name", "")).strip()
    if variant_id not in (None, "") and not variation_name:
        inferred = _pick_title(updated.get("variants"), variant_id, ("variant_id",))
        if inferred:
            updated["variation_name"] = inferred

    if variant_id not in (None, ""):
        updated.setdefault("variation_details", "")
        updated.setdefault("variation_specs", "")
        cards = _extract_cards(updated.get("variants"))
        target = str(variant_id).strip().lower()
        for card in cards:
            card_variant = card.get("variant_id")
            if card_variant is None:
                continue
            if str(card_variant).strip().lower() != target:
                continue

            subtitle = str(card.get("subtitle", "")).strip()
            if subtitle:
                updated["variation_details"] = subtitle

            specs_summary = str(card.get("specs_summary", "")).strip()
            if specs_summary:
                updated["variation_specs"] = specs_summary
            break

    return updated


# ---------------------------------------------------------------------------


def _find_node(nodes: List[dict], node_id: str) -> Optional[dict]:
    for node in nodes:
        if node["id"] == node_id:
            return node
    return None


def _match_quick_reply(user_input: str, options: List[dict]) -> Optional[dict]:
    """Match user input to a quick-reply option by value or label (case-insensitive)."""
    normalised = user_input.strip().lower()
    for option in options:
        if (
            normalised == str(option.get("value", "")).lower()
            or normalised == str(option.get("label", "")).lower()
        ):
            return option
    return None


def _normalize_card_payload(item: Dict[str, Any]) -> Dict[str, Any]:
    payload = {
        "title": item.get("title") or item.get("name") or "",
        "subtitle": item.get("subtitle") or item.get("description") or "",
        "image_url": item.get("image_url") or item.get("image") or "",
        "buttons": item.get("buttons", []),
    }

    # Extract IDs from common shapes (direct fields or JSON button payload).
    if item.get("service_id") is not None:
        payload["service_id"] = item.get("service_id")
    if item.get("serviceId") is not None:
        payload["service_id"] = item.get("serviceId")
    if item.get("variant_id") is not None:
        payload["variant_id"] = item.get("variant_id")
    if item.get("variationId") is not None:
        payload["variant_id"] = item.get("variationId")

    for btn in payload.get("buttons", []):
        raw_payload = btn.get("payload")
        if not raw_payload:
            continue
        parsed = _try_parse_json(raw_payload) if isinstance(raw_payload, str) else raw_payload
        if not isinstance(parsed, dict):
            continue
        if "service_id" in parsed:
            payload["service_id"] = parsed["service_id"]
        if "serviceId" in parsed:
            payload["service_id"] = parsed["serviceId"]
        if "variant_id" in parsed:
            payload["variant_id"] = parsed["variant_id"]
        if "variationId" in parsed:
            payload["variant_id"] = parsed["variationId"]

    return payload


def _extract_cards(response_data: Any) -> List[Dict[str, Any]]:
    # ManyChat gallery shape.
    if isinstance(response_data, dict):
        content = response_data.get("content")
        if isinstance(content, dict) and content.get("type") == "gallery":
            elements = content.get("elements", [])
            if isinstance(elements, list):
                return [_normalize_card_payload(e) for e in elements if isinstance(e, dict)]

    # Generic list shape.
    if isinstance(response_data, list):
        return [_normalize_card_payload(e) for e in response_data if isinstance(e, dict)]

    return []


def _extract_quick_reply_options(response_data: Any) -> List[Dict[str, str]]:
    """Build quick-reply options from common API response shapes."""
    items: List[Any] = []

    if isinstance(response_data, dict):
        content = response_data.get("content")
        if isinstance(content, dict) and content.get("type") == "gallery":
            elements = content.get("elements", [])
            if isinstance(elements, list):
                items = elements
        elif isinstance(response_data.get("data"), list):
            items = response_data.get("data", [])
    elif isinstance(response_data, list):
        items = response_data

    options: List[Dict[str, str]] = []
    for item in items:
        if isinstance(item, dict):
            raw = (
                item.get("title")
                or item.get("label")
                or item.get("name")
                or item.get("time")
                or item.get("slot")
                or item.get("value")
            )
        else:
            raw = item

        if raw in (None, ""):
            continue

        text = str(raw).strip()
        if not text:
            continue

        options.append({"label": text, "value": text})

    # Keep the UI readable on mobile; show up to 10 slot buttons.
    return options[:10]


def _is_empty_response(data: Any) -> bool:
    if data is None:
        return True
    if isinstance(data, list):
        return len(data) == 0
    if isinstance(data, str):
        return data.strip() == ""
    if isinstance(data, dict):
        content = data.get("content")
        if isinstance(content, dict) and content.get("type") == "gallery":
            elements = content.get("elements", [])
            return not isinstance(elements, list) or len(elements) == 0
        return len(data) == 0
    return False


async def _do_http_request(http_cfg: dict, variables: Dict[str, Any]) -> Tuple[Any, Optional[str]]:
    """
    Execute the HTTP request defined in a node's http_request config.

    Returns (response_data, error_message).
    """
    url = _interpolate(http_cfg.get("url", ""), variables)
    method = http_cfg.get("method", "GET").upper()
    headers = _resolve_template(http_cfg.get("headers", {}), variables)
    body = _resolve_template(http_cfg.get("body", None), variables)
    timeout_seconds = float(http_cfg.get("timeout_seconds", 10.0))
    retry_count = int(http_cfg.get("retry_count", 0))
    retry_backoff_ms = int(http_cfg.get("retry_backoff_ms", 250))
    total_attempts = max(1, retry_count + 1)

    for attempt in range(total_attempts):
        try:
            client = get_http_client()
            if method == "GET":
                resp = await client.get(url, headers=headers, timeout=timeout_seconds)
            elif method == "POST":
                resp = await client.post(url, json=body, headers=headers, timeout=timeout_seconds)
            elif method == "PUT":
                resp = await client.put(url, json=body, headers=headers, timeout=timeout_seconds)
            elif method == "DELETE":
                resp = await client.delete(url, headers=headers, timeout=timeout_seconds)
            else:
                return None, f"Unsupported HTTP method: {method}"

            resp.raise_for_status()
            try:
                return resp.json(), None
            except Exception:
                return resp.text, None
        except httpx.HTTPStatusError as exc:
            should_retry = exc.response.status_code >= 500 and attempt < total_attempts - 1
            if should_retry:
                await asyncio.sleep((retry_backoff_ms / 1000.0) * (attempt + 1))
                continue
            return None, f"HTTP request failed with status {exc.response.status_code}."
        except Exception as exc:
            if attempt < total_attempts - 1:
                await asyncio.sleep((retry_backoff_ms / 1000.0) * (attempt + 1))
                continue
            return None, f"HTTP request error: {str(exc)}"

    return None, "HTTP request failed after retries."


async def process_message(
    flow_json: dict,
    user_input: str,
    current_node_id: Optional[str],
    variables: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], Optional[str], Dict[str, Any], bool]:
    """
    Process a single user message through the flow engine.

    Args:
        flow_json:        Parsed flow definition dict.
        user_input:       The raw text sent by the user.
        current_node_id:  The node the session is currently waiting on (or None).
        variables:        Current session variables dict.

    Returns a 4-tuple:
        response_messages  – list of {content, message_type, metadata} dicts
        next_node_id       – node id the session should wait on next (None = flow ended)
        updated_variables  – variables dict after processing
        is_handoff         – True if the flow requested a human handoff
    """
    nodes: List[dict] = flow_json.get("nodes", [])
    trigger_keywords: List[str] = [k.lower() for k in flow_json.get("trigger_keywords", [])]
    response_messages: List[Dict[str, Any]] = []
    is_handoff = False

    normalised_input = user_input.strip().lower()

    # -----------------------------------------------------------------------
    # Determine whether to start/restart the flow or continue from current node
    # -----------------------------------------------------------------------
    if not nodes:
        return [
            {"content": "No flow nodes configured.", "message_type": "text", "metadata": None}
        ], None, variables, False

    is_trigger = normalised_input in trigger_keywords

    if current_node_id == CLOSE_CONFIRM_NODE_ID:
        if _is_affirmative_close(user_input):
            next_variables = {**variables, "__close_conversation": True}
            response_messages.append(
                {
                    "content": "Thank you! This conversation is now closed.",
                    "message_type": "text",
                    "metadata": None,
                }
            )
            return response_messages, None, next_variables, False

        if _is_negative_close(user_input):
            response_messages.append(
                {
                    "content": "No problem, we will keep this conversation open.",
                    "message_type": "text",
                    "metadata": None,
                }
            )
            return await _deliver_node(nodes[0]["id"], nodes, variables, response_messages)

        response_messages.append(
            {
                "content": "Please choose Yes to close the conversation or No to keep it open.",
                "message_type": "text",
                "metadata": None,
            }
        )
        _append_close_confirmation_prompt(response_messages)
        return response_messages, CLOSE_CONFIRM_NODE_ID, variables, False

    # No active node (fresh session) or trigger keyword received → restart flow
    if current_node_id is None or is_trigger:
        return await _deliver_node(nodes[0]["id"], nodes, variables, response_messages)

    active_node = _find_node(nodes, current_node_id)
    if active_node is None:
        # Unknown node — restart from the beginning
        return await _deliver_node(nodes[0]["id"], nodes, variables, response_messages)

    # -----------------------------------------------------------------------
    # Process the CURRENT node: handle user input that was expected by it
    # -----------------------------------------------------------------------
    input_type = active_node.get("input_type", "text")

    if input_type == "quick_reply":
        options = active_node.get("options", [])
        matched = _match_quick_reply(user_input, options)

        if matched is None:
            # Re-send the same node message asking again
            labels = [opt["label"] for opt in options]
            error_msg = f"Please choose one of: {', '.join(labels)}."
            response_messages.append(
                {"content": error_msg, "message_type": "text", "metadata": None}
            )
            # Re-render the node so the user sees the options again
            node_msg = _interpolate(active_node.get("message", ""), variables)
            response_messages.append(
                {
                    "content": node_msg,
                    "message_type": "quick_reply",
                    "metadata": {"options": options},
                }
            )
            return response_messages, active_node["id"], variables, False

        next_node_id: Optional[str] = matched.get("next")
        matched_value = str(matched.get("value", "")).strip().lower()

        if matched_value == "done":
            response_messages.append(
                {
                    "content": "Thank you!",
                    "message_type": "text",
                    "metadata": None,
                }
            )
            _append_close_confirmation_prompt(response_messages)
            return response_messages, CLOSE_CONFIRM_NODE_ID, variables, False

        if next_node_id == "handoff":
            return response_messages, None, variables, True

        if next_node_id:
            return await _deliver_node(
                next_node_id, nodes, variables, response_messages
            )
        return response_messages, None, variables, False

    elif input_type == "text":
        if active_node.get("normalize_skip"):
            user_input = _normalize_optional_input(user_input)

        payload_data = _try_parse_payload_input(user_input)
        if payload_data:
            variables = _apply_payload_assign(
                variables,
                active_node.get("payload_assign", {}),
                payload_data,
            )

            # Use the mapped value for validation when this node expects a variable.
            var_name = active_node.get("variable")
            if var_name and var_name in variables:
                user_input = str(variables[var_name])

        validation = active_node.get("validation")

        # Pre-process any date expression (relative or absolute format) before validation.
        if validation and validation.get("type") == "date":
            parsed_date = _parse_relative_date(user_input)
            if not parsed_date:
                from time_utils import parse_date_input as _parse_date_input
                parsed_date = _parse_date_input(user_input)
            if parsed_date:
                user_input = parsed_date

        if validation:
            if validation.get("type") == "in_list_variable":
                # Accept both "list_variable" and legacy "variable" key names.
                list_var = validation.get("list_variable") or validation.get("variable")
                if list_var:
                    validation = {
                        **validation,
                        "items": variables.get(list_var, []),
                    }
            valid, error_msg = validate_input(user_input, validation)
            if not valid:
                response_messages.append(
                    {"content": error_msg, "message_type": "text", "metadata": None}
                )
                node_msg = _interpolate(active_node.get("message", ""), variables)
                response_messages.append(
                    {"content": node_msg, "message_type": "text", "metadata": None}
                )
                return response_messages, active_node["id"], variables, False

        # Store the (possibly pre-processed) input in the session variable.
        variable_name = active_node.get("variable")
        if variable_name:
            variables = {**variables, variable_name: user_input.strip()}
            variables = _sync_vehicle_info(variables)
            variables = _sync_selection_labels(variables)

        # Vehicle info auto-extraction: parse 'YEAR MAKE MODEL' from free text
        # and store vehicle_year / vehicle_make / vehicle_model automatically.
        # If extraction succeeds, jump to next_if_extracted; otherwise fall through
        # to the normal next node (which should ask for each field individually).
        if active_node.get("extract_vehicle_vars"):
            extracted = _extract_vehicle_info(user_input)
            if extracted:
                variables = {**variables, **extracted}
                variables = _sync_vehicle_info(variables)
                variables = _sync_selection_labels(variables)
                next_if_extracted = active_node.get("next_if_extracted")
                if next_if_extracted and next_if_extracted != "handoff":
                    return await _deliver_node(next_if_extracted, nodes, variables, response_messages)

        next_node_id = active_node.get("next")
        if next_node_id == "handoff":
            return response_messages, None, variables, True

        if next_node_id:
            return await _deliver_node(next_node_id, nodes, variables, response_messages)

        return response_messages, None, variables, False

    elif input_type == "none":
        # The active node requires no user input — shouldn't normally be
        # "current", but handle gracefully by moving to its next node.
        next_node_id = active_node.get("next")
        if next_node_id == "handoff":
            return response_messages, None, variables, True
        if next_node_id:
            return await _deliver_node(next_node_id, nodes, variables, response_messages)
        return response_messages, None, variables, False

    else:
        # Unknown input type — move to next node if available
        next_node_id = active_node.get("next")
        if next_node_id:
            return await _deliver_node(next_node_id, nodes, variables, response_messages)
        return response_messages, None, variables, False


async def _deliver_node(
    node_id: str,
    nodes: List[dict],
    variables: Dict[str, Any],
    response_messages: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], Optional[str], Dict[str, Any], bool]:
    """
    Render and deliver a node to the user, following any automatic transitions
    (http_request nodes, none-input nodes) until we reach a node that waits
    for user input.
    """
    visited: set = set()

    while node_id is not None:
        if node_id == "handoff":
            return response_messages, None, variables, True

        if node_id in visited:
            # Cycle guard
            break
        visited.add(node_id)

        node = _find_node(nodes, node_id)
        if node is None:
            response_messages.append(
                {
                    "content": f"Flow error: node '{node_id}' not found.",
                    "message_type": "text",
                    "metadata": None,
                }
            )
            return response_messages, None, variables, False

        # --- Handle HTTP request if present ---
        http_cfg = node.get("http_request")
        http_rendered_message = False
        latest_http_render_data: Any = None
        if http_cfg:
            resp_data, err = await _do_http_request(http_cfg, variables)
            resp_var = http_cfg.get("response_variable")
            if err:
                response_messages.append(
                    {"content": f"Service error: {err}", "message_type": "text", "metadata": None}
                )
                # On HTTP error, stay at this node and let user retry
                return response_messages, node["id"], variables, False
            else:
                # If response_field is set, extract that specific key from the response
                # dict for rendering and variable storage (e.g. "availableSlots" from
                # the availability API which returns a wrapper object).
                response_field = http_cfg.get("response_field")
                render_data = (
                    resp_data.get(response_field, [])
                    if response_field and isinstance(resp_data, dict)
                    else resp_data
                )
                latest_http_render_data = render_data

                if resp_var:
                    variables = {**variables, resp_var: render_data}

                is_empty = _is_empty_response(render_data)
                next_if_empty = http_cfg.get("next_if_empty")
                next_if_not_empty = http_cfg.get("next_if_not_empty")
                if is_empty and next_if_empty:
                    node_id = next_if_empty
                    continue
                if (not is_empty) and next_if_not_empty:
                    node_id = next_if_not_empty
                    continue

                if http_cfg.get("render_cards"):
                    cards = _extract_cards(render_data)
                    if cards:
                        # Render the node message text FIRST as a plain text bubble,
                        # since card messages do not display their content field.
                        intro_text = _interpolate(node.get("message", ""), variables)
                        if intro_text:
                            response_messages.append(
                                {"content": intro_text, "message_type": "text", "metadata": None}
                            )
                            http_rendered_message = True
                        response_messages.append(
                            {
                                "content": None,
                                "message_type": "card",
                                "metadata": {"cards": cards},
                            }
                        )

                if http_cfg.get("render_quick_replies"):
                    options = _extract_quick_reply_options(render_data)
                    if options:
                        # For quick replies the text is shown inside the message bubble,
                        # so pass it as content rather than creating a separate message.
                        qr_text = (
                            ""
                            if http_rendered_message
                            else _interpolate(node.get("message", ""), variables)
                        )
                        response_messages.append(
                            {
                                "content": qr_text,
                                "message_type": "quick_reply",
                                "metadata": {"options": options},
                            }
                        )
                        if qr_text:
                            http_rendered_message = True

        if node.get("payload_assign"):
            payload_source = latest_http_render_data if isinstance(latest_http_render_data, dict) else None
            variables = _apply_payload_assign(variables, node.get("payload_assign"), payload_source)

        # --- Render the node message ---
        message_text = _interpolate(node.get("message", ""), variables)
        input_type = node.get("input_type", "text")
        options = node.get("options", [])

        if input_type == "quick_reply" and options:
            response_messages.append(
                {
                    "content": message_text,
                    "message_type": "quick_reply",
                    "metadata": {"options": options},
                }
            )
            # Wait for user input
            return response_messages, node["id"], variables, False

        elif input_type == "text":
            response_messages.append(
                {"content": message_text, "message_type": "text", "metadata": None}
            )
            # Wait for user input
            return response_messages, node["id"], variables, False

        elif input_type == "none":
            # Deliver message and auto-continue; skip if already rendered above
            if message_text and not http_rendered_message:
                response_messages.append(
                    {"content": message_text, "message_type": "text", "metadata": None}
                )
            node_id = _resolve_routing_next(node, variables)
            if node_id == "handoff":
                return response_messages, None, variables, True
            continue

        else:
            # Fallback: deliver as text and move on
            if message_text:
                response_messages.append(
                    {"content": message_text, "message_type": "text", "metadata": None}
                )
            node_id = node.get("next")
            if node_id == "handoff":
                return response_messages, None, variables, True
            continue

    # Reached end of flow with no waiting node
    return response_messages, None, variables, False
