from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # MySQL
    mysql_user: str = "root"
    mysql_password: str = ""
    mysql_host: str = "127.0.0.1"
    mysql_port: int = 3306
    mysql_db: str = "stayagent"

    # DeepSeek (Block 8 才用)
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Cookie
    cookie_secure: bool = False  # 生产环境改 True
    cookie_samesite: str = "lax"

    # Block 27: 房源图片上传目录 (相对 backend 运行目录)
    upload_dir: str = "./uploads/images"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
