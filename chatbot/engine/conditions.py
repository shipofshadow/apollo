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

    Designed to never raise — all edge cases (None input, missing rule keys,
    unexpected types) are handled gracefully and return a clear error message.
    """
    # Guard: rule must be a non-empty dict; anything else is a pass-through.
    if not rule or not isinstance(rule, dict):
        return True, ""

    rule_type = rule.get("type", "")

    # Guard: coerce value to string safely regardless of what was passed in.
    val = str(value).strip() if value is not None else ""

    # ------------------------------------------------------------------
    # Universal skip handling
    # ------------------------------------------------------------------
    if val.lower() in {"skip", "none", "n/a", "na"}:
        if rule_type == "required":
            return False, _err(rule, "Boss, required ito. Di pwedeng i-skip!")
        # All other rule types treat skip/none as a valid empty answer.
        return True, ""

    # ------------------------------------------------------------------
    # required
    # ------------------------------------------------------------------
    if rule_type == "required":
        if not val:
            return False, _err(rule, "Boss, wag mo 'to laktawan. Required ito.")
        return True, ""

    # ------------------------------------------------------------------
    # email
    # ------------------------------------------------------------------
    if rule_type == "email":
        if not val:
            return False, _err(rule, "Email ay required boss.")
        pattern = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
        if not re.match(pattern, val):
            return False, _err(
                rule, f"Boss, parang mali ang email '{val}'. Paki-check mo uli."
            )
        return True, ""

    # ------------------------------------------------------------------
    # phone  (PH mobile)
    # ------------------------------------------------------------------
    if rule_type == "phone":
        pattern = r"^(?:\+63|0)?9\d{9}$"
        if not re.match(pattern, val):
            return False, _err(
                rule,
                "Boss, valid PH mobile number lang "
                "(e.g., 09171234567 or +639171234567).",
            )
        return True, ""

    # ------------------------------------------------------------------
    # date
    # ------------------------------------------------------------------
    if rule_type == "date":
        if not val:
            return False, _err(rule, "Petsa ay required boss.")
        # parse_date_input may return None or raise — handle both safely.
        try:
            parsed = parse_date_input(val)
        except Exception:
            parsed = None
        if parsed:
            return True, ""
        return False, _err(
            rule,
            "Boss, di ko ma-parse ang petsa. Subukan mo: "
            "'bukas', 'March 20 2026', '2026-04-15', o '03/20/2026'.",
        )

    # ------------------------------------------------------------------
    # min_length
    # ------------------------------------------------------------------
    if rule_type == "min_length":
        try:
            min_len = int(rule.get("value", 1))
        except (TypeError, ValueError):
            min_len = 1
        if len(val) < min_len:
            return False, _err(
                rule, f"Boss, dapat at least {min_len} characters ang sagot mo."
            )
        return True, ""

    # ------------------------------------------------------------------
    # max_length
    # ------------------------------------------------------------------
    if rule_type == "max_length":
        try:
            max_len = int(rule.get("value", 255))
        except (TypeError, ValueError):
            max_len = 255
        if len(val) > max_len:
            return False, _err(rule, f"Boss, hanggang {max_len} characters lang dapat.")
        return True, ""

    # ------------------------------------------------------------------
    # regex
    # ------------------------------------------------------------------
    if rule_type == "regex":
        pattern = rule.get("pattern", "")
        if not pattern:
            # No pattern defined — treat as pass-through rather than crashing.
            return True, ""
        try:
            if not re.match(pattern, val):
                return False, _err(
                    rule, "Boss, parang mali ang format. Paki-check mo uli."
                )
        except re.error as exc:
            # Bad regex in the flow definition — fail open with a log-friendly
            # message rather than crashing the entire request.
            print(f"[conditions] Invalid regex pattern {pattern!r}: {exc}")
            return True, ""
        return True, ""

    # ------------------------------------------------------------------
    # number
    # ------------------------------------------------------------------
    if rule_type == "number":
        try:
            float(val)
            return True, ""
        except (ValueError, TypeError):
            return False, _err(
                rule, "Boss, number lang ang valid dito (e.g., 1, 2, 3)."
            )

    # ------------------------------------------------------------------
    # year_range
    # ------------------------------------------------------------------
    if rule_type == "year_range":
        try:
            min_year = int(rule.get("min", 1980))
            max_year = int(rule.get("max", 2027))
        except (TypeError, ValueError):
            min_year, max_year = 1980, 2027

        try:
            year = int(val)
        except (ValueError, TypeError):
            return False, _err(
                rule,
                "Boss, number lang ang taon ng sasakyan (e.g., 2024).",
            )

        if min_year <= year <= max_year:
            return True, ""
        return False, _err(
            rule,
            f"Boss, {min_year}–{max_year} lang ang tinatanggap na taon ng sasakyan.",
        )

    # ------------------------------------------------------------------
    # in_list_variable
    # ------------------------------------------------------------------
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
            return False, _err(
                rule,
                "Boss, piliin mo lang ang isa sa mga available na slot sa itaas.",
            )
        return True, ""

    # ------------------------------------------------------------------
    # Unknown rule type — pass through rather than raising.
    # ------------------------------------------------------------------
    return True, ""