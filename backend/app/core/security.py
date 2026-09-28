"""密码哈希 + JWT 工具（access + refresh 双 token）"""
from datetime import datetime, timedelta, timezone
import uuid
import bcrypt
from jose import jwt, JWTError

from app.config import settings


# ============ 密码哈希 ============

def hash_password(plain_password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


# ============ JWT 签发/验证 ============

def _encode(payload: dict) -> str:
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str | int, jti: str | None = None) -> tuple[str, str, int]:
    """
    签发 access token
    返回: (token, jti, expires_in_seconds)
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    if jti is None:
        jti = uuid.uuid4().hex
    payload = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": jti,
        "type": "access",
    }
    return _encode(payload), jti, settings.access_token_expire_minutes * 60


def create_refresh_token(subject: str | int, jti: str | None = None) -> tuple[str, str, int]:
    """
    签发 refresh token
    返回: (token, jti, expires_in_seconds)
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.refresh_token_expire_days)
    if jti is None:
        jti = uuid.uuid4().hex
    payload = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": jti,
        "type": "refresh",
    }
    return _encode(payload), jti, settings.refresh_token_expire_days * 86400


def decode_token(token: str, expected_type: str) -> dict | None:
    """
    解码 token 并校验 type
    返回 payload dict 或 None（失败/类型不匹配）
    """
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    return payload
