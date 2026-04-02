import re
from datetime import datetime, timedelta
from typing import Any

from time_utils import today_utc8


def _err(rule: dict, default: str) -> str:
    """Return error_message override from rule if set, otherwise the default."""
    return rule.get("error_message") or default


def _parse_relative_date_local(text: str) -> str | None:
    t = (text or "").strip().lower()
    today = today_utc8()

    quick = {
        "today": 0,
        "ngayon": 0,
        "tomorrow": 1,
        "bukas": 1,
        "day after tomorrow": 2,
        "makalawa": 2,
        "next week": 7,
        "susunod na linggo": 7,
    }
    if t in quick:
        return (today + timedelta(days=quick[t])).strftime("%Y-%m-%d")

    match = re.match(r"^(?:in\s+)?(\d+)\s+days?$", t)
    if match:
        return (today + timedelta(days=int(match.group(1)))).strftime("%Y-%m-%d")
    return None


def validate_input(value: str, rule: dict) -> tuple[bool, str]:
    """
    Validate a user's text input against a validation rule.

    Returns (is_valid, error_message).
    """
    if not rule:
        return True, ""

    rule_type = rule.get("type", "")

    if rule_type == "required":
        if not value or not value.strip():
            return False, _err(rule, "Boss, wag mo 'to laktawan. Required ito.")
        return True, ""

    if rule_type == "email":
        if not value or not value.strip():
            return False, _err(rule, "Email ay required boss.")
        pattern = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
        if not re.match(pattern, value.strip()):
            return False, _err(rule, f"Boss, invalid email '{value.strip()}' 'yan. Check mo uli.")
        return True, ""

    if rule_type == "date":
        if not value or not value.strip():
            return False, _err(rule, "Petsa ay required boss.")

        parsed = _parse_relative_date_local(value)
        candidate = parsed if parsed else value.strip()
        try:
            datetime.strptime(candidate, "%Y-%m-%d")
            return True, ""
        except ValueError:
            return False, _err(rule, "Boss, format ng petsa ay YYYY-MM-DD (e.g., 2026-04-15). Try mo ulit.")

    if rule_type == "min_length":
        min_len = rule.get("value", 1)
        if len(value.strip()) < min_len:
            return False, _err(rule, f"Dapat at least {min_len} characters ang sagot.")
        return True, ""

    if rule_type == "max_length":
        max_len = rule.get("value", 255)
        if len(value.strip()) > max_len:
            return False, _err(rule, f"Hindi dapat himagit sa {max_len} characters.")
        return True, ""

    if rule_type == "regex":
        pattern = rule.get("pattern", "")
        if not re.match(pattern, value.strip()):
            return False, _err(rule, "Invalid ang format. Check mo uli boss.")
        return True, ""

    if rule_type == "number":
        try:
            float(value.strip())
            return True, ""
        except ValueError:
            return False, _err(rule, "Number lang ang valid dito boss (e.g., 1, 2, 3).")

    if rule_type == "year_range":
        min_year = int(rule.get("min", 1980))
        max_year = int(rule.get("max", 2027))
        try:
            year = int(value.strip())
            if min_year <= year <= max_year:
                return True, ""
            return False, _err(rule, f"Boss, {min_year}–{max_year} lang ang tinatanggap na taon ng sasakyan.")
        except ValueError:
            return False, _err(rule, "Boss, number lang ang taon ng sasakyan (e.g., 2024).")

    if rule_type == "in_list_variable":
        items: Any = rule.get("items", rule.get("list", []))
        field = rule.get("field")
        case_sensitive = bool(rule.get("case_sensitive", False))

        # Soft-pass when the availability API returned nothing usable.
        if not isinstance(items, list) or not items:
            return True, ""

        raw_value = (value or "").strip()
        candidate = raw_value if case_sensitive else raw_value.lower()

        allowed = []
        for item in items:
            if isinstance(item, dict):
                if field:
                    check_val = item.get(field)
                else:
                    # Auto-discover common slot fields when no explicit field is configured.
                    check_val = (
                        item.get("value")
                        or item.get("label")
                        or item.get("title")
                        or item.get("time")
                        or item.get("slot")
                        or item.get("start")
                        or item.get("startTime")
                        or item.get("appointment_time")
                        or item.get("appointmentTime")
                    )
            else:
                check_val = item
            if check_val is None:
                continue
            check_str = str(check_val).strip()
            allowed.append(check_str if case_sensitive else check_str.lower())

        if candidate not in allowed:
            return False, _err(rule, "Boss, piliin mo lang ang isa sa mga available na slot sa itaas.")
        return True, ""

    # Unknown rule type — pass through
    return True, ""
