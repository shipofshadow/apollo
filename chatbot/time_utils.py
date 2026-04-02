import re
from datetime import date, datetime, timedelta, timezone


UTC_PLUS_8 = timezone(timedelta(hours=8))


def now_utc8() -> datetime:
    # Keep DB values naive while using UTC+8 wall time consistently.
    return datetime.now(UTC_PLUS_8).replace(tzinfo=None)


def today_utc8() -> date:
    return now_utc8().date()


# ---------------------------------------------------------------------------
# Comprehensive date parser
# ---------------------------------------------------------------------------

_TAGALOG_MONTHS: dict[str, str] = {
    "enero": "january", "pebrero": "february", "marso": "march",
    "abril": "april", "mayo": "may", "hunyo": "june",
    "hulyo": "july", "agosto": "august", "setyembre": "september",
    "oktubre": "october", "nobyembre": "november", "disyembre": "december",
}

_TAGALOG_DAYS: dict[str, str] = {
    "lunes": "monday", "martes": "tuesday", "miyerkules": "wednesday",
    "miyerkoles": "wednesday", "huwebes": "thursday", "biyernes": "friday",
    "sabado": "saturday", "linggo": "sunday",
}

_EN_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

_RELATIVE_OFFSETS: dict[str, int] = {
    "today": 0, "ngayon": 0,
    "tomorrow": 1, "bukas": 1,
    "day after tomorrow": 2, "makalawa": 2,
    "next week": 7, "susunod na linggo": 7,
}

# Ordered list of strptime formats to attempt.  Most specific first.
_DATE_FORMATS = [
    "%Y-%m-%d",    # 2026-03-16
    "%m/%d/%Y",    # 03/16/2026  (try MM/DD first; if month > 12 it fails → DD/MM tried)
    "%d/%m/%Y",    # 16/03/2026
    "%m-%d-%Y",    # 03-16-2026
    "%d-%m-%Y",    # 16-03-2026
    "%d.%m.%Y",    # 16.03.2026
    "%B %d, %Y",   # March 20, 2026
    "%B %d %Y",    # March 20 2026
    "%b %d, %Y",   # Mar 20, 2026
    "%b %d %Y",    # Mar 20 2026
    "%d %B %Y",    # 20 March 2026
    "%d %b %Y",    # 20 Mar 2026
    "%d %B, %Y",   # 20 March, 2026
    "%d %b, %Y",   # 20 Mar, 2026
    "%B-%d-%Y",    # March-20-2026
    "%Y/%m/%d",    # 2026/03/16
]


def _normalize_tagalog_text(text: str) -> str:
    """Replace Tagalog month and day names with English equivalents (lowercase)."""
    result = text.lower()
    for tl, en in _TAGALOG_MONTHS.items():
        result = re.sub(rf"\b{re.escape(tl)}\b", en, result)
    for tl, en in _TAGALOG_DAYS.items():
        result = re.sub(rf"\b{re.escape(tl)}\b", en, result)
    return result


def parse_date_input(text: str) -> str | None:
    """
    Parse any user-supplied date expression and return YYYY-MM-DD, or None.

    Handles:
      English & Tagalog relative expressions:
        today / ngayon, tomorrow / bukas, makalawa,
        next week / susunod na linggo,
        next friday / susunod na biyernes, on friday / sa biyernes
      Absolute formats (any combo of separators / month names):
        2026-03-16, 03/16/2026, 16/03/2026, 03-16-2026,
        March 20 2026, March 20, 2026, Marso 20 2026 …
    """
    if not text or not text.strip():
        return None

    today = today_utc8()
    normalized = _normalize_tagalog_text(text.strip())

    # Strip leading "on " / "sa " / "this " filler words
    core = re.sub(r"^(on|sa|this)\s+", "", normalized).strip()

    # 1. Exact relative expression
    if core in _RELATIVE_OFFSETS:
        return (today + timedelta(days=_RELATIVE_OFFSETS[core])).strftime("%Y-%m-%d")
    if normalized in _RELATIVE_OFFSETS:
        return (today + timedelta(days=_RELATIVE_OFFSETS[normalized])).strftime("%Y-%m-%d")

    # 2. Named day-of-week: "friday" / "next friday" / "susunod na friday"
    for i, day in enumerate(_EN_DAYS):
        if core in (day, f"next {day}", f"susunod na {day}"):
            days_ahead = i - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    # 3. "in N days" / "N days from now"
    m = re.match(r"^(?:in\s+)?(\d+)\s+days?(?:\s+from\s+now)?$", normalized)
    if m:
        return (today + timedelta(days=int(m.group(1)))).strftime("%Y-%m-%d")

    # 4. Absolute date — try every known strptime format.
    #    Title-case so "march" → "March" for %B/%b directives.
    titled = normalized.title()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(titled, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    # Also try original casing (handles already-title-cased input)
    if titled != text.strip():
        for fmt in _DATE_FORMATS:
            try:
                return datetime.strptime(text.strip(), fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None