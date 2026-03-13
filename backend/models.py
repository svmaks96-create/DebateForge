import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    VARCHAR,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Debate(Base):
    __tablename__ = "debates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic: Mapped[str] = mapped_column(Text, nullable=False)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)
    format_config: Mapped[dict] = mapped_column(JSONB, nullable=True)
    council_size: Mapped[int] = mapped_column(Integer, default=3)
    status: Mapped[str] = mapped_column(VARCHAR(20), default="configuring")
    created_by_ip: Mapped[str | None] = mapped_column(VARCHAR(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    synthesis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    rounds = relationship("Round", back_populates="debate", cascade="all, delete-orphan")
    agents = relationship("DebateAgent", back_populates="debate", cascade="all, delete-orphan")
    arguments = relationship("Argument", back_populates="debate", cascade="all, delete-orphan")
    positions = relationship("AgentPosition", back_populates="debate", cascade="all, delete-orphan")


class Round(Base):
    __tablename__ = "rounds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    debate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("debates.id"), nullable=False)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    round_type: Mapped[str] = mapped_column(VARCHAR(50), nullable=False)
    status: Mapped[str] = mapped_column(VARCHAR(20), default="pending")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    debate = relationship("Debate", back_populates="rounds")
    arguments = relationship("Argument", back_populates="round", cascade="all, delete-orphan")


class DebateAgent(Base):
    __tablename__ = "debate_agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    debate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("debates.id"), nullable=False)
    seat_number: Mapped[int] = mapped_column(Integer, nullable=False)
    persona_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("personas.id"), nullable=True)
    title: Mapped[str] = mapped_column(VARCHAR(200), nullable=False)
    expertise: Mapped[str] = mapped_column(Text, nullable=False)
    priorities: Mapped[str] = mapped_column(Text, nullable=False)
    style: Mapped[str] = mapped_column(Text, nullable=False)
    background: Mapped[str | None] = mapped_column(Text, nullable=True)
    argument_prefix: Mapped[str] = mapped_column(VARCHAR(10), nullable=False)

    debate = relationship("Debate", back_populates="agents")
    persona = relationship("Persona", back_populates="debate_agents")
    arguments = relationship("Argument", back_populates="agent", cascade="all, delete-orphan")
    positions = relationship("AgentPosition", back_populates="agent", cascade="all, delete-orphan")


class Argument(Base):
    __tablename__ = "arguments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    round_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rounds.id"), nullable=False)
    debate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("debates.id"), nullable=False)
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("debate_agents.id"), nullable=False)
    argument_index: Mapped[str] = mapped_column(VARCHAR(20), nullable=False)
    arg_type: Mapped[str] = mapped_column(VARCHAR(30), nullable=False)
    stance: Mapped[str] = mapped_column(VARCHAR(20), nullable=False)
    confidence: Mapped[float] = mapped_column(Numeric(3, 1), nullable=True)
    targets: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    claim: Mapped[str | None] = mapped_column(Text, nullable=True)
    grounds: Mapped[str | None] = mapped_column(Text, nullable=True)
    warrant: Mapped[str | None] = mapped_column(Text, nullable=True)
    backing: Mapped[str | None] = mapped_column(Text, nullable=True)
    qualifier: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    citations: Mapped[list | None] = mapped_column(JSONB, server_default="[]")
    raw_response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    round = relationship("Round", back_populates="arguments")
    debate = relationship("Debate", back_populates="arguments")
    agent = relationship("DebateAgent", back_populates="arguments")


class AgentPosition(Base):
    __tablename__ = "agent_positions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    debate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("debates.id"), nullable=False)
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("debate_agents.id"), nullable=False)
    overall_stance: Mapped[str] = mapped_column(VARCHAR(20), nullable=False)
    confidence: Mapped[float] = mapped_column(Numeric(3, 1), nullable=True)
    position_summary: Mapped[str] = mapped_column(Text, nullable=False)
    key_concerns: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    key_supports: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    would_change_mind: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    debate = relationship("Debate", back_populates="positions")
    agent = relationship("DebateAgent", back_populates="positions")


class Persona(Base):
    __tablename__ = "personas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(VARCHAR(200), nullable=False)
    expertise: Mapped[str] = mapped_column(Text, nullable=False)
    priorities: Mapped[str] = mapped_column(Text, nullable=False)
    style: Mapped[str] = mapped_column(Text, nullable=False)
    background: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[dict] = mapped_column(JSONB, server_default="[]")
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    debate_agents = relationship("DebateAgent", back_populates="persona")
