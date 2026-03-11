import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import require_auth
from database import get_db
from models import Debate, DebateAgent, Persona
from schemas import PersonaCreate, PersonaListResponse, PersonaResponse, PersonaUpdate

router = APIRouter(prefix="/api/personas", tags=["personas"], dependencies=[Depends(require_auth)])


@router.get("", response_model=PersonaListResponse)
async def list_personas(
    search: str | None = Query(None),
    tags: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Persona)

    if search:
        stmt = stmt.where(Persona.title.ilike(f"%{search}%"))

    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        for tag in tag_list:
            stmt = stmt.where(Persona.tags.op("@>")(f'["{tag}"]'))

    stmt = stmt.order_by(Persona.is_template.desc(), Persona.created_at.desc())

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    result = await db.execute(stmt)
    personas = result.scalars().all()

    return PersonaListResponse(personas=personas, total=total)


@router.post("", response_model=PersonaResponse, status_code=201)
async def create_persona(body: PersonaCreate, db: AsyncSession = Depends(get_db)):
    persona = Persona(**body.model_dump())
    db.add(persona)
    await db.commit()
    await db.refresh(persona)
    return persona


@router.get("/{persona_id}", response_model=PersonaResponse)
async def get_persona(persona_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    persona = await db.get(Persona, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    return persona


@router.put("/{persona_id}", response_model=PersonaResponse)
async def update_persona(persona_id: uuid.UUID, body: PersonaUpdate, db: AsyncSession = Depends(get_db)):
    persona = await db.get(Persona, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(persona, field, value)

    await db.commit()
    await db.refresh(persona)
    return persona


@router.delete("/{persona_id}", status_code=204)
async def delete_persona(persona_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    persona = await db.get(Persona, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    await db.delete(persona)
    await db.commit()


@router.post("/from-debate/{debate_id}", response_model=list[PersonaResponse], status_code=201)
async def personas_from_debate(debate_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Save all debate agents from a completed debate as new personas."""
    result = await db.execute(
        select(Debate)
        .where(Debate.id == debate_id)
        .options(selectinload(Debate.agents))
    )
    debate = result.scalars().first()
    if not debate or debate.status == "deleted":
        raise HTTPException(status_code=404, detail="Debate not found")
    if debate.status != "completed":
        raise HTTPException(status_code=400, detail=f"Debate not completed (status: {debate.status})")

    created = []
    for agent in debate.agents:
        persona = Persona(
            title=agent.title,
            expertise=agent.expertise,
            priorities=agent.priorities,
            style=agent.style,
            background=agent.background,
            tags=[agent.side],
        )
        db.add(persona)
        created.append(persona)

    await db.commit()
    for p in created:
        await db.refresh(p)

    return created
