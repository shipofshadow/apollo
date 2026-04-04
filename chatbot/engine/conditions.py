import re
from datetime import datetime
from typing import Any

from time_utils import parse_date_input


def _err(rule: dict, default: str) -> str:
    """Return error_message override from rule if set, otherwise the default."""
    return rule.get("error_message") or default


def validate_input(value: str, rule: dict) -> tuple[bool, str]:
    """
    Validate a user's text input against a validation rule.

    Returns (is_valid, error_message).
    """
    if not rule:
        return True, ""

    rule_type = rule.get("type", "")
    val = (value or "").strip()

    # Support for optional/skip/none
    if val.lower() in {"skip", "none", "n/a", "na"}:
        if rule_type == "required":
            return False, _err(rule, "Boss, required ito. Di pwedeng i-skip!")
        return True, ""

    if rule_type == "required":
        if not val:
            return False, _err(rule, "Boss, wag mo 'to laktawan. Required ito.")
        return True, ""

    if rule_type == "email":
        if not val:
            return False, _err(rule, "Email ay required boss.")
        pattern = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
        if not re.match(pattern, val):
            return False, _err(rule, f"Boss, parang mali ang email '{val}'. Paki-check mo uli.")
        return True, ""

    if rule_type == "phone":
        # PH mobile: 09xxxxxxxxx or +639xxxxxxxxx
        pattern = r"^(?:\+63|0)?9\d{9}$"
        if not re.match(pattern, val):
            return False, _err(rule, "Boss, valid PH mobile number lang (e.g., 09171234567 or +639171234567).")
        return True, ""

    if rule_type == "date":
        if not val:
            return False, _err(rule, "Petsa ay required boss.")
        parsed = parse_date_input(val)
        if parsed:
            return True, ""
        return False, _err(rule, "Boss, di ko ma-parse ang petsa. Subukan mo: 'bukas', 'March 20 2026', '2026-04-15', o '03/20/2026'.")

    if rule_type == "min_length":
        min_len = rule.get("value", 1)
        if len(val) < min_len:
            return False, _err(rule, f"Boss, dapat at least {min_len} characters ang sagot mo.")
        return True, ""

    if rule_type == "max_length":
        max_len = rule.get("value", 255)
        if len(val) > max_len:
            return False, _err(rule, f"Boss, hanggang {max_len} characters lang dapat.")
        return True, ""

    if rule_type == "regex":
        pattern = rule.get("pattern", "")
        if not re.match(pattern, val):
            return False, _err(rule, "Boss, parang mali ang format. Paki-check mo uli.")
        return True, ""

    if rule_type == "number":
        try:
            float(val)
            return True, ""
        except ValueError:
            return False, _err(rule, "Boss, number lang ang valid dito (e.g., 1, 2, 3).")

    if rule_type == "year_range":
        min_year = int(rule.get("min", 1980))
        max_year = int(rule.get("max", 2027))
        try:
            year = int(val)
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

        candidate = val if case_sensitive else val.lower()
        allowed = []
        for item in items:
            if isinstance(item, dict):
                if field:
                    check_val = item.get(field)
                else:
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
