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
    pro_count: int = Field(default=1, ge=1, le=4)
    con_count: int = Field(default=1, ge=1, le=4)


class IdentityResponse(BaseModel):
    title: str
    expertise: str
    priorities: str
    style: str
    background: str


class IdentityGenerateResponse(BaseModel):
    pro: list[IdentityResponse]
    con: list[IdentityResponse]


# --- Agent argument schemas ---

class ArgumentData(BaseModel):
    id: str
    type: str
    targets: list[str] = Field(default_factory=list)
    claim: str
    grounds: str
    warrant: str
    backing: str
    qualifier: str


class AgentResponse(BaseModel):
    arguments: list[ArgumentData]
    summary: str


# --- Debate schemas ---

class AgentInput(BaseModel):
    persona_id: uuid.UUID | None = None
    title: str | None = None
    expertise: str | None = None
    priorities: str | None = None
    style: str | None = None
    background: str | None = None


class AgentsInput(BaseModel):
    pro: list[AgentInput]
    con: list[AgentInput]


class CreateDebateRequest(BaseModel):
    topic: str
    context: str | None = None
    format_name: str | None = "oxford"
    format_config: dict | None = None
    panel_config: dict | None = None
    agents: AgentsInput


class DebateAgentResponse(BaseModel):
    id: uuid.UUID
    side: str
    position: int
    title: str
    expertise: str
    priorities: str
    style: str
    background: str | None
    argument_prefix: str

    model_config = {"from_attributes": True}


class ArgumentResponse(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    agent_side: str
    argument_index: str
    arg_type: str
    targets: list | dict | None
    claim: str | None
    grounds: str | None
    warrant: str | None
    backing: str | None
    qualifier: str | None
    summary: str | None
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


class DebateResponse(BaseModel):
    id: uuid.UUID
    topic: str
    context: str | None
    status: str
    format_config: dict | None
    panel_config: dict | None
    created_at: datetime
    completed_at: datetime | None
    verdict: dict | None

    model_config = {"from_attributes": True}


class DebateDetailResponse(DebateResponse):
    rounds: list[RoundResponse] = Field(default_factory=list)
    agents: list[DebateAgentResponse] = Field(default_factory=list)
