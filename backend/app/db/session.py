from urllib.parse import quote_plus
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import settings


# 关键：用 quote_plus 处理密码里的 @ ! 等特殊字符
# 密码 P@ssw0rd!Mac 不做 URL 编码会被 SQLAlchemy 解析错
_encoded_password = quote_plus(settings.mysql_password)
DATABASE_URL = (
    f"mysql+pymysql://{settings.mysql_user}:{_encoded_password}"
    f"@{settings.mysql_host}:{settings.mysql_port}/{settings.mysql_db}"
    f"?charset=utf8mb4"
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI 依赖注入用（Block 2 起开始用）"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    """Block 1 验证数据库是否可达"""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
