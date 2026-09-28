"""认证相关 API：注册 / 登录 / 当前用户"""
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select

from app.deps import DBSession, CurrentUser
from app.models import User
from app.schemas.auth import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    LoginResponse,
    CurrentUserResponse,
)
from app.core.security import hash_password, verify_password, create_access_token

router = APIRouter()


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: DBSession):
    """注册新用户"""
    # 检查邮箱/用户名是否已存在
    existing = db.execute(
        select(User).where(
            or_(User.email == payload.email, User.username == payload.username)
        )
    ).scalar_one_or_none()

    if existing:
        if existing.email == payload.email:
            raise HTTPException(status_code=400, detail="邮箱已被注册")
        if existing.username == payload.username:
            raise HTTPException(status_code=400, detail="用户名已被占用")

    # 创建用户（密码先存明文，commit 前再哈希）
    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: DBSession):
    """登录：返回 access_token + 用户信息"""
    # 邮箱或用户名都行
    user = db.execute(
        select(User).where(
            or_(User.email == payload.account, User.username == payload.account)
        )
    ).scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        # 故意不区分"用户不存在"和"密码错误"，防止撞库
        raise HTTPException(status_code=401, detail="账号或密码错误")

    token = create_access_token(subject=user.id)
    return LoginResponse(
        access_token=token,
        user=RegisterResponse.model_validate(user),
    )


@router.get("/me", response_model=CurrentUserResponse)
async def get_me(current_user: CurrentUser):
    """返回当前登录用户的信息（受保护）"""
    return current_user
