"""Pydantic schemas for auth endpoints"""
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ===== 注册 =====
class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(min_length=8, max_length=128)
    is_host: bool = Field(default=False, description="是否注册为房东 (可后端自建房源)")


class RegisterResponse(BaseModel):
    id: int
    email: str
    username: str
    is_host: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===== 登录 =====
class LoginRequest(BaseModel):
    account: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # access token 剩余秒数
    user: RegisterResponse


# ===== 当前用户 =====
class CurrentUserResponse(BaseModel):
    id: int
    email: str
    username: str
    avatar_url: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===== 登出 =====
class LogoutResponse(BaseModel):
    message: str = "已登出"
