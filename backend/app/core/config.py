from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./podcast_studio.db"
    API_V1_PREFIX: str = "/api/v1"
    
    # MiniMax：LLM（剧本/标题/话题聚类）与 TTS 共用同一把 Key
    MINIMAX_API_KEY: str = ""
    MINIMAX_CN_API_KEY: str = ""
    MINIMAX_MODEL: str = "abab6.5s-chat"

    # 其他可选 key（设置页可写入；不强制消费）
    ELEVENLABS_API_KEY: str = ""
    SCRIPT_PROMPT: str = ""

    # CORS allowed origins, comma separated. Default is the project's two
    # dev frontends; production should set CORS_ALLOWED_ORIGINS to the
    # real domain(s).
    CORS_ALLOWED_ORIGINS: str = "http://localhost:3001,http://localhost:3000,http://127.0.0.1:3001,http://127.0.0.1:3000"

    class Config:
        env_file = ".env"
        # .env 里允许存在模型之外的键（如 TTS_SPEED 等由 os.environ 实时读取的参数），
        # 忽略而不是启动即崩
        extra = "ignore"


settings = Settings()
