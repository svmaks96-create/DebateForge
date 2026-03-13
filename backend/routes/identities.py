from fastapi import APIRouter, Depends

from auth import require_auth
from identity_generator import generate_identities
from schemas import CouncilGenerateResponse, IdentityGenerateRequest

router = APIRouter(prefix="/api/identities", tags=["identities"], dependencies=[Depends(require_auth)])


@router.post("/generate", response_model=CouncilGenerateResponse)
async def generate(body: IdentityGenerateRequest):
    result = await generate_identities(
        topic=body.topic,
        context=body.context,
        council_size=body.council_size,
    )
    return result
