"""密码哈希 + JWT 工具"""
from datetime import datetime, timedelta, timezone
import bcrypt
from jose import jwt, JWTError

from app.config import settings


# ============ 密码哈希 ============

def hash_password(plain_password: str) -> str:
    """bcrypt 哈希密码（自动加盐）"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证明文 vs 哈希"""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


# ============ JWT 签发/验证 ============

def create_access_token(subject: str | int, extra: dict | None = None) -> str:
    """
    签发 JWT token
    subject: 一般是 user.id
    extra: 可选附加 payload
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    """解码 JWT，失败返回 None（不抛异常）"""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
