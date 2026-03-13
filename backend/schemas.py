import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# --- Persona schemas ---

class PersonaCreate(BaseModel):
    title: str
    expertise: str
    priorities: str
    style: str
    background: str | None = None
    tags: list[str] = Field(default_factory=list)


class PersonaUpdate(BaseModel):
    title: str | None = None
    expertise: str | None = None
    priorities: str | None = None
    style: str | None = None
    background: str | None = None
    tags: list[str] | None = None


class PersonaResponse(BaseModel):
    id: uuid.UUID
    title: str
    expertise: str
    priorities: str
    style: str
    background: str | None
    tags: list[str]
    is_template: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PersonaListResponse(BaseModel):
    personas: list[PersonaResponse]
    total: int


# --- Identity generation schemas ---

class IdentityGenerateRequest(BaseModel):
    topic: str
    context: str | None = None
    council_size: int = Field(default=3, ge=2, le=6)


class IdentityResponse(BaseModel):
    title: str
    expertise: str
    priorities: str
    style: str
    background: str


class CouncilGenerateResponse(BaseModel):
    council: list[IdentityResponse]


# --- Agent argument schemas ---

class CitationData(BaseModel):
    url: str = ""
    title: str = ""
    snippet: str = ""
    date: str | None = None
    source_type: str = "web"


class ArgumentData(BaseModel):
    id: str
    type: str
    stance: str = Field(description="supportive | critical | mixed | neutral")
    confidence: float = Field(default=5.0, ge=0, le=10)
    targets: list[str] = Field(default_factory=list)
    claim: str
    grounds: str
    warrant: str
    backing: str
    qualifier: str
    citations: list[CitationData] = Field(default_factory=list)


class AgentResponse(BaseModel):
    arguments: list[ArgumentData]
    summary: str


# --- Council member schemas ---

class CouncilMemberInput(BaseModel):
    persona_id: uuid.UUID | None = None
    title: str | None = None
    expertise: str | None = None
    priorities: str | None = None
    style: str | None = None
    background: str | None = None


class CouncilMemberResponse(BaseModel):
    id: uuid.UUID
    seat_number: int
    argument_prefix: str
    title: str
    expertise: str
    priorities: str
    style: str
    background: str | None

    model_config = {"from_attributes": True}


# --- Position schemas ---

class AgentPositionResponse(BaseModel):
    agent_prefix: str
    agent_title: str
    overall_stance: str
    confidence: float
    position_summary: str
    key_concerns: list[dict] | None = None
    key_supports: list[dict] | None = None
    would_change_mind: str | None = None


# --- Synthesis schemas ---

class ThemePerspective(BaseModel):
    agent_title: str
    agent_prefix: str
    stance: str
    view: str
    confidence: float


class Theme(BaseModel):
    theme: str
    summary: str
    perspectives: list[ThemePerspective]
    consensus_level: str
    key_tension: str | None = None


class DisagreementCamp(BaseModel):
    agents: list[str]
    position: str


class MajorDisagreement(BaseModel):
    topic: str
    camps: list[DisagreementCamp]
    why_unresolvable: str


class SynthesisResponse(BaseModel):
    bottom_line: str
    confidence_level: str
    themes: list[Theme] = Field(default_factory=list)
    council_consensus: list[str] = Field(default_factory=list)
    major_disagreements: list[MajorDisagreement] = Field(default_factory=list)
    individual_positions: list[AgentPositionResponse] = Field(default_factory=list)
    blind_spots: list[str] = Field(default_factory=list)
    key_insights: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    nuanced_conclusion: str = ""


# --- Deliberation schemas ---

class CreateDeliberationRequest(BaseModel):
    topic: str
    context: str | None = None
    format_name: str | None = "standard"
    format_config: dict | None = None
    council_size: int = Field(default=3, ge=2, le=6)
    agents: list[CouncilMemberInput] = Field(default_factory=list)
    enable_search: bool = True
    enable_verification: bool = True


class ArgumentResponse(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    argument_index: str
    arg_type: str
    stance: str
    confidence: float | None
    targets: list | dict | None
    claim: str | None
    grounds: str | None
    warrant: str | None
    backing: str | None
    qualifier: str | None
    summary: str | None
    citations: list[dict] = Field(default_factory=list)
    created_at: datetime

    model_config = {"from_attributes": True}


class RoundResponse(BaseModel):
    id: uuid.UUID
    round_number: int
    round_type: str
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    arguments: list[ArgumentResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class DeliberationResponse(BaseModel):
    id: uuid.UUID
    topic: str
    context: str | None
    status: str
    format_config: dict | None
    council_size: int
    created_at: datetime
    completed_at: datetime | None
    synthesis: dict | None
    verification_report: dict | None = None
    enable_search: bool = True
    enable_verification: bool = True

    model_config = {"from_attributes": True}


class DeliberationDetailResponse(DeliberationResponse):
    council_members: list[CouncilMemberResponse] = Field(default_factory=list)
    rounds: list[RoundResponse] = Field(default_factory=list)
