import os
import hashlib
from typing import Any, Dict

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text

from database import SessionLocal

_bearer = HTTPBearer(auto_error=False)


def _jwt_secret() -> str:
    return os.environ.get("JWT_SECRET", "").strip()


def _jwt_algorithm() -> str:
    return os.environ.get("JWT_ALGORITHM", "HS256").strip() or "HS256"


def _is_token_blocklisted(token: str) -> bool:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    db = SessionLocal()
    try:
        row = db.execute(
            text("SELECT 1 FROM token_blocklist WHERE token_hash = :hash LIMIT 1"),
            {"hash": token_hash},
        ).fetchone()
        return row is not None
    except Exception:
        # Keep auth available even if legacy deployments do not have this table.
        return False
    finally:
        db.close()


def _role_from_db(user_id: int) -> str | None:
    db = SessionLocal()
    try:
        row = db.execute(text("SELECT role FROM users WHERE id = :id LIMIT 1"), {"id": user_id}).fetchone()
        if not row:
            return None
        role = row[0]
        if role is None:
            return None
        return str(role).strip().lower()
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> Dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing Bearer token.")

    secret = _jwt_secret()
    if secret == "":
        raise HTTPException(status_code=500, detail="JWT_SECRET is not configured.")

    token = credentials.credentials
    if _is_token_blocklisted(token):
        raise HTTPException(status_code=401, detail="Token has been revoked.")

    try:
        payload = jwt.decode(token, secret, algorithms=[_jwt_algorithm()])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid token.") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=401, detail="Invalid token payload.")

    token_type = str(payload.get("type", "")).strip().lower()
    if token_type and token_type != "access":
        raise HTTPException(status_code=401, detail="Invalid token type.")

    return payload


def require_admin(payload: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    raw_sub = payload.get("sub")
    if raw_sub is None:
        raise HTTPException(status_code=401, detail="Invalid token payload.")

    try:
        user_id = int(str(raw_sub))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid token subject.") from exc

    db_role = _role_from_db(user_id)
    if not db_role:
        raise HTTPException(status_code=401, detail="User not found.")

    if db_role != "admin" and db_role != "owner":
        raise HTTPException(status_code=403, detail="Forbidden.")

    token_role = str(payload.get("role", "")).strip().lower()
    if token_role and token_role != db_role:
        raise HTTPException(status_code=401, detail="Token role mismatch.")

    return payload
