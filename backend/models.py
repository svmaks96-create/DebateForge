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
    panel_config: Mapped[dict] = mapped_column(JSONB, server_default='{"pro_count": 1, "con_count": 1}')
    status: Mapped[str] = mapped_column(VARCHAR(20), default="configuring")
    created_by_ip: Mapped[str | None] = mapped_column(VARCHAR(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verdict: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    rounds = relationship("Round", back_populates="debate", cascade="all, delete-orphan")
    agents = relationship("DebateAgent", back_populates="debate", cascade="all, delete-orphan")
    arguments = relationship("Argument", back_populates="debate", cascade="all, delete-orphan")
    analyses = relationship("ArgumentAnalysis", back_populates="debate", cascade="all, delete-orphan")


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
    side: Mapped[str] = mapped_column(VARCHAR(10), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
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


class Argument(Base):
    __tablename__ = "arguments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    round_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rounds.id"), nullable=False)
    debate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("debates.id"), nullable=False)
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("debate_agents.id"), nullable=False)
    agent_side: Mapped[str] = mapped_column(VARCHAR(10), nullable=False)
    argument_index: Mapped[str] = mapped_column(VARCHAR(20), nullable=False)
    arg_type: Mapped[str] = mapped_column(VARCHAR(20), nullable=False)
    targets: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    claim: Mapped[str | None] = mapped_column(Text, nullable=True)
    grounds: Mapped[str | None] = mapped_column(Text, nullable=True)
    warrant: Mapped[str | None] = mapped_column(Text, nullable=True)
    backing: Mapped[str | None] = mapped_column(Text, nullable=True)
    qualifier: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    round = relationship("Round", back_populates="arguments")
    debate = relationship("Debate", back_populates="arguments")
    agent = relationship("DebateAgent", back_populates="arguments")


class ArgumentAnalysis(Base):
    __tablename__ = "argument_analysis"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    debate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("debates.id"), nullable=False)
    argument_index: Mapped[str] = mapped_column(VARCHAR(20), nullable=False)
    claim_score: Mapped[float] = mapped_column(Numeric(3, 1), nullable=True)
    grounds_score: Mapped[float] = mapped_column(Numeric(3, 1), nullable=True)
    warrant_score: Mapped[float] = mapped_column(Numeric(3, 1), nullable=True)
    backing_score: Mapped[float] = mapped_column(Numeric(3, 1), nullable=True)
    qualifier_score: Mapped[float] = mapped_column(Numeric(3, 1), nullable=True)
    overall_strength: Mapped[float] = mapped_column(Numeric(3, 1), nullable=True)
    fallacies: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    debate = relationship("Debate", back_populates="analyses")


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
