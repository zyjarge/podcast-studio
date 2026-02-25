from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./podcast_studio.db"
    API_V1_PREFIX: str = "/api/v1"
    
    # DeepSeek LLM
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_MODEL: str = "deepseek-chat"
    
    # MiniMax TTS
    MINIMAX_API_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
