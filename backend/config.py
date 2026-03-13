from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    ANTHROPIC_API_KEY: str
    INVITE_CODE: str = "debateforge-2026"
    JWT_SECRET: str
    TAVILY_API_KEY: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
