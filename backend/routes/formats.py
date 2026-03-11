from fastapi import APIRouter, Depends

from auth import require_auth

router = APIRouter(prefix="/api/formats", tags=["formats"], dependencies=[Depends(require_auth)])

PRESET_FORMATS = [
    {
        "name": "quick_fire",
        "description": "Fast single-round debate — opening statements only.",
        "rounds": [
            {"type": "opening", "word_limit": 300},
        ],
    },
    {
        "name": "oxford",
        "description": "Classic three-round format: opening, rebuttal, closing.",
        "rounds": [
            {"type": "opening", "word_limit": 400},
            {"type": "rebuttal", "word_limit": 300},
            {"type": "closing", "word_limit": 200},
        ],
    },
    {
        "name": "lincoln_douglas",
        "description": "Four-round format with cross-examination.",
        "rounds": [
            {"type": "opening", "word_limit": 400},
            {"type": "cross_exam", "word_limit": 300},
            {"type": "rebuttal", "word_limit": 300},
            {"type": "closing", "word_limit": 200},
        ],
    },
    {
        "name": "deep_dive",
        "description": "Extended five-round deep analysis.",
        "rounds": [
            {"type": "opening", "word_limit": 500},
            {"type": "rebuttal", "word_limit": 400},
            {"type": "cross_exam", "word_limit": 400},
            {"type": "rebuttal", "word_limit": 300},
            {"type": "closing", "word_limit": 300},
        ],
    },
]

FORMAT_LOOKUP = {f["name"]: f for f in PRESET_FORMATS}


@router.get("")
async def list_formats():
    return PRESET_FORMATS
