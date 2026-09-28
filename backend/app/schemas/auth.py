"""Pydantic schemas for auth endpoints"""
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ===== 注册 =====
class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(min_length=8, max_length=128)


class RegisterResponse(BaseModel):
    id: int
    email: str
    username: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===== 登录 =====
class LoginRequest(BaseModel):
    # 邮箱或用户名都行
    account: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: RegisterResponse


# ===== 当前用户 =====
class CurrentUserResponse(BaseModel):
    id: int
    email: str
    username: str
    avatar_url: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
