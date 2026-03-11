from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, Request

from config import settings


def verify_invite_code(code: str) -> bool:
    return code == settings.INVITE_CODE


def create_jwt() -> str:
    payload = {
        "iss": "debateforge",
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def verify_jwt(token: str) -> bool:
    try:
        jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"], issuer="debateforge")
        return True
    except jwt.PyJWTError:
        return False


async def require_auth(request: Request) -> None:
    token = request.cookies.get("auth_token")
    if not token or not verify_jwt(token):
        raise HTTPException(status_code=401, detail="Not authenticated")
