from fastapi import APIRouter, Depends

from auth import require_auth

router = APIRouter(prefix="/api/formats", tags=["formats"], dependencies=[Depends(require_auth)])

PRESET_FORMATS = [
    {
        "name": "quick_take",
        "description": "Fast initial perspectives — 1 round (opening only).",
        "rounds": [
            {"type": "opening", "word_limit": 300},
        ],
    },
    {
        "name": "rapid_assessment",
        "description": "Quick exploration — 2 rounds (opening + discussion).",
        "rounds": [
            {"type": "opening", "word_limit": 400},
            {"type": "discussion", "word_limit": 300},
        ],
    },
    {
        "name": "standard",
        "description": "Default deliberation — 3 rounds (opening + discussion + closing).",
        "rounds": [
            {"type": "opening", "word_limit": 400},
            {"type": "discussion", "word_limit": 300},
            {"type": "closing", "word_limit": 200},
        ],
    },
    {
        "name": "deep_dive",
        "description": "Thorough analysis — 5 rounds (opening + discussion + exploration + discussion + closing).",
        "rounds": [
            {"type": "opening", "word_limit": 500},
            {"type": "discussion", "word_limit": 400},
            {"type": "exploration", "word_limit": 400},
            {"type": "discussion", "word_limit": 300},
            {"type": "closing", "word_limit": 300},
        ],
    },
]

FORMAT_LOOKUP = {f["name"]: f for f in PRESET_FORMATS}


@router.get("")
async def list_formats():
    return PRESET_FORMATS
