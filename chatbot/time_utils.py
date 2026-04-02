from datetime import date, datetime, timedelta, timezone


UTC_PLUS_8 = timezone(timedelta(hours=8))


def now_utc8() -> datetime:
    # Keep DB values naive while using UTC+8 wall time consistently.
    return datetime.now(UTC_PLUS_8).replace(tzinfo=None)


def today_utc8() -> date:
    return now_utc8().date()