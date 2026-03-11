from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from auth import verify_invite_code, create_jwt, require_auth

router = APIRouter(prefix="/api/auth")


class VerifyRequest(BaseModel):
    code: str


@router.get("/check", dependencies=[Depends(require_auth)])
async def check():
    return {"status": "authenticated"}


@router.post("/verify")
async def verify(body: VerifyRequest):
    if not verify_invite_code(body.code):
        return JSONResponse(status_code=401, content={"detail": "Invalid invite code"})

    token = create_jwt()
    response = JSONResponse(content={"status": "authenticated"})
    response.set_cookie(
        key="auth_token",
        value=token,
        httponly=True,
        path="/",
        max_age=7 * 24 * 60 * 60,
        samesite="lax",
    )
    return response
