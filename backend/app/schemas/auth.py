"""Pydantic schemas for auth endpoints"""
import re
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator


# ===== 注册 =====
class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    is_host: bool = Field(default=False, description="是否注册为房东 (可后端自建房源)")

    # 中文面向的演示项目: 用户名放开支持中文, 但仍排除空格/特殊符号.
    # \w 在 Python re 里 unicode 感知, 覆盖中英文/数字/下划线; 另允许短横线.
    @field_validator("username")
    @classmethod
    def username_rules(cls, v: str) -> str:
        if not re.fullmatch(r"[\w-]+", v):
            raise ValueError("用户名仅支持中英文、数字、下划线和短横线，不含空格及其他符号")
        return v


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
    # 必须带上: /me 是 F5 后 fetchMe 的数据源, 漏了会把登录时拿到的 is_host 覆盖丢掉
    is_host: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===== 登出 =====
class LogoutResponse(BaseModel):
    message: str = "已登出"
