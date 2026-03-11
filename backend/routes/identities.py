from fastapi import APIRouter, Depends

from auth import require_auth
from identity_generator import generate_identities
from schemas import IdentityGenerateRequest, IdentityGenerateResponse

router = APIRouter(prefix="/api/identities", tags=["identities"], dependencies=[Depends(require_auth)])


@router.post("/generate", response_model=IdentityGenerateResponse)
async def generate(body: IdentityGenerateRequest):
    result = await generate_identities(
        topic=body.topic,
        context=body.context,
        pro_count=body.pro_count,
        con_count=body.con_count,
    )
    return result
