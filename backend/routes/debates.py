import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import require_auth
from database import async_session, get_db
from debate_engine import run_deliberation
from events import get_event_bus
from models import AgentPosition, Debate, DebateAgent, Persona, Round
from routes.formats import FORMAT_LOOKUP, PRESET_FORMATS
from schemas import (
    AgentPositionResponse,
    CreateDeliberationRequest,
    DeliberationDetailResponse,
    DeliberationResponse,
)

router = APIRouter(prefix="/api/debates", tags=["debates"], dependencies=[Depends(require_auth)])

SEAT_PREFIXES = ["A", "B", "C", "D", "E", "F"]


@router.post("", response_model=DeliberationResponse, status_code=201)
async def create_debate(body: CreateDeliberationRequest, db: AsyncSession = Depends(get_db)):
    # Resolve format config
    if body.format_config:
        format_config = body.format_config
    else:
        fmt_name = body.format_name or "standard"
        fmt = FORMAT_LOOKUP.get(fmt_name)
        if not fmt:
            raise HTTPException(status_code=400, detail=f"Unknown format: {fmt_name}")
        format_config = {"format_name": fmt["name"], "rounds": fmt["rounds"]}

    debate = Debate(
        topic=body.topic,
        context=body.context,
        format_config=format_config,
        council_size=body.council_size,
        status="configuring",
    )
    db.add(debate)
    await db.flush()

    # Create council members by seat order
    for i, agent_input in enumerate(body.agents):
        await _create_council_member(db, debate.id, i, SEAT_PREFIXES[i], agent_input)

    await db.commit()
    await db.refresh(debate)
    return debate


async def _create_council_member(db, debate_id, seat_number, prefix, agent_input):
    """Create a DebateAgent row from input, resolving persona if needed."""
    if agent_input.persona_id:
        persona = await db.get(Persona, agent_input.persona_id)
        if not persona:
            raise HTTPException(status_code=400, detail=f"Persona {agent_input.persona_id} not found")
        agent = DebateAgent(
            debate_id=debate_id,
            seat_number=seat_number,
            persona_id=persona.id,
            title=persona.title,
            expertise=persona.expertise,
            priorities=persona.priorities,
            style=persona.style,
            background=persona.background,
            argument_prefix=prefix,
        )
    else:
        if not agent_input.title or not agent_input.expertise or not agent_input.priorities or not agent_input.style:
            raise HTTPException(status_code=400, detail="Agent must have title, expertise, priorities, and style")
        agent = DebateAgent(
            debate_id=debate_id,
            seat_number=seat_number,
            title=agent_input.title,
            expertise=agent_input.expertise,
            priorities=agent_input.priorities,
            style=agent_input.style,
            background=agent_input.background,
            argument_prefix=prefix,
        )
    db.add(agent)


@router.get("", response_model=list[DeliberationResponse])
async def list_debates(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Debate).where(Debate.status != "deleted")

    if status:
        stmt = stmt.where(Debate.status == status)

    stmt = stmt.order_by(Debate.created_at.desc())
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(stmt)
    debates = result.scalars().all()
    return debates


@router.get("/{debate_id}", response_model=DeliberationDetailResponse)
async def get_debate(debate_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Debate)
        .where(Debate.id == debate_id)
        .options(
            selectinload(Debate.rounds).selectinload(Round.arguments),
            selectinload(Debate.agents),
        )
    )
    debate = result.scalars().first()
    if not debate or debate.status == "deleted":
        raise HTTPException(status_code=404, detail="Debate not found")

    # Sort rounds by round_number, arguments by created_at
    rounds = sorted(debate.rounds, key=lambda r: r.round_number)
    for r in rounds:
        r.arguments = sorted(r.arguments, key=lambda a: a.created_at)

    # Map ORM `agents` relationship to schema `council_members` field
    return DeliberationDetailResponse(
        id=debate.id,
        topic=debate.topic,
        context=debate.context,
        status=debate.status,
        format_config=debate.format_config,
        council_size=debate.council_size,
        created_at=debate.created_at,
        completed_at=debate.completed_at,
        synthesis=debate.synthesis,
        council_members=debate.agents,
        rounds=rounds,
    )


@router.post("/{debate_id}/start")
async def start_debate(debate_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    debate = await db.get(Debate, debate_id)
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    if debate.status != "configuring":
        raise HTTPException(status_code=400, detail=f"Debate is already '{debate.status}', cannot start")

    # Launch as background task
    asyncio.create_task(run_deliberation(debate_id, async_session))

    return JSONResponse(status_code=202, content={"status": "started", "debate_id": str(debate_id)})


@router.get("/{debate_id}/stream")
async def stream_debate(debate_id: uuid.UUID, request: Request, _=Depends(require_auth)):
    """SSE endpoint for live debate events."""
    bus = await get_event_bus()

    async def event_generator():
        # Send initial connected event
        yield f"event: connected\ndata: {json.dumps({'debate_id': str(debate_id)})}\n\n"

        async for sse_message in bus.subscribe(debate_id):
            # Check if client disconnected
            if await request.is_disconnected():
                break
            yield sse_message

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{debate_id}/analysis")
async def get_analysis(debate_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    debate = await db.get(Debate, debate_id)
    if not debate or debate.status == "deleted":
        raise HTTPException(status_code=404, detail="Debate not found")
    if debate.status not in ("completed",):
        raise HTTPException(status_code=400, detail=f"Debate not yet completed (status: {debate.status})")

    return {
        "debate_id": str(debate_id),
        "synthesis": debate.synthesis,
    }


@router.get("/{debate_id}/positions", response_model=list[AgentPositionResponse])
async def get_positions(debate_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    debate = await db.get(Debate, debate_id)
    if not debate or debate.status == "deleted":
        raise HTTPException(status_code=404, detail="Debate not found")
    if debate.status != "completed":
        raise HTTPException(status_code=400, detail=f"Debate not yet completed (status: {debate.status})")

    result = await db.execute(
        select(AgentPosition)
        .where(AgentPosition.debate_id == debate_id)
        .join(DebateAgent, AgentPosition.agent_id == DebateAgent.id)
        .options(selectinload(AgentPosition.agent))
        .order_by(DebateAgent.seat_number)
    )
    positions = result.scalars().all()

    return [
        AgentPositionResponse(
            agent_prefix=pos.agent.argument_prefix,
            agent_title=pos.agent.title,
            overall_stance=pos.overall_stance,
            confidence=float(pos.confidence) if pos.confidence else 0,
            position_summary=pos.position_summary,
            key_concerns=pos.key_concerns,
            key_supports=pos.key_supports,
            would_change_mind=pos.would_change_mind,
        )
        for pos in positions
    ]


@router.delete("/{debate_id}", status_code=204)
async def delete_debate(debate_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    debate = await db.get(Debate, debate_id)
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    debate.status = "deleted"
    await db.commit()
