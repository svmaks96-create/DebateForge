# DebateForge — AI Dialectical Exploration Platform

> **Note:** v1 was a competitive debate platform. v2 pivoted to dialectical exploration for synthesized insight.

## What Is This
DebateForge is an internal web tool where AI agents explore both sides of a decision topic
through structured dialectical analysis. Teams enter a question (e.g., "Should we migrate
to microservices?"), configure the exploration format and agent identities, then watch
Claude-powered agents argue Pro vs Con through structured rounds — not to win, but to
uncover truth. A separate Claude synthesizer produces a balanced synthesis of the exploration
including areas of agreement, unresolved tensions, and actionable insight.

## Tech Stack
- **Backend**: FastAPI (Python 3.13) running in Docker
- **Frontend**: React 18 + Tailwind CSS, built with Node 20, served as static files by Nginx
- **Database**: PostgreSQL 16 (Docker container)
- **Cache/PubSub**: Redis 7 (Docker container)
- **AI**: Claude API (Sonnet 4) — via `anthropic` Python SDK
- **Auth**: Invite code → JWT cookie (no user accounts)
- **Reverse Proxy**: Nginx on host, proxies /api/* to FastAPI, serves React build

## Project Structure
```
~/Projects/debateforge/
├── .env                          # ANTHROPIC_API_KEY, INVITE_CODE, JWT_SECRET
├── docker-compose.yml            # postgres + redis + api services
├── CLAUDE.md                     # THIS FILE — project reference
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                   # FastAPI app, lifespan, CORS, middleware
│   ├── config.py                 # Settings from env vars
│   ├── auth.py                   # Invite code verify, JWT create/check
│   ├── database.py               # SQLAlchemy async engine + session
│   ├── models.py                 # ORM models (all 6 tables)
│   ├── schemas.py                # Pydantic request/response models
│   ├── debate_engine.py          # Orchestrator: runs rounds, manages turns
│   ├── agent.py                  # Claude dialectical agent wrapper
│   ├── judge.py                  # Claude synthesizer (was judge in v1)
│   ├── identity_generator.py     # Claude-powered identity auto-generation
│   ├── events.py                 # Redis pub/sub for SSE streaming
│   └── routes/
│       ├── auth.py               # POST /api/auth/verify
│       ├── debates.py            # CRUD + start + stream endpoints
│       ├── formats.py            # GET /api/formats
│       ├── identities.py         # POST /api/identities/generate
│       └── personas.py           # CRUD /api/personas
└── frontend/
    ├── package.json
    └── src/
        ├── App.jsx               # Router: Gate → Home → Debate → History
        ├── api.js                # Axios instance with cookie auth
        ├── pages/
        │   ├── GatePage.jsx      # Invite code entry
        │   ├── HomePage.jsx      # Topic + format + agent setup → Start
        │   ├── DebatePage.jsx    # Live viewer + analysis dashboard
        │   ├── HistoryPage.jsx   # Past debates list
        │   └── PersonaLibraryPage.jsx
        ├── components/
        │   ├── FormatSelector.jsx
        │   ├── AgentSetup.jsx
        │   ├── IdentityCard.jsx
        │   ├── PersonaPickerModal.jsx
        │   ├── LiveViewer.jsx
        │   ├── ArgumentCard.jsx
        │   ├── AnalysisDashboard.jsx
        │   ├── ArgumentGraph.jsx
        │   ├── ToulminBreakdown.jsx
        │   ├── FallacyBadge.jsx
        │   ├── ScoreComparison.jsx
        │   ├── PanelAnalysis.jsx
        │   └── RateWarning.jsx
        └── hooks/
            └── useDebateStream.js
```

## Database Schema (PostgreSQL)

### debates
- id: UUID PK
- topic: TEXT NOT NULL
- context: TEXT (nullable)
- format_config: JSONB — {format_name, rounds: [{type, word_limit}]}
- panel_config: JSONB DEFAULT '{"pro_count": 1, "con_count": 1}'
- status: VARCHAR(20) — configuring | running | synthesizing | completed | error
- created_by_ip: VARCHAR(45)
- created_at: TIMESTAMP
- completed_at: TIMESTAMP (nullable)
- verdict: JSONB (nullable) — stores synthesis JSON (field name kept from v1 for backward compatibility)

### rounds
- id: UUID PK
- debate_id: UUID FK → debates
- round_number: INTEGER
- round_type: VARCHAR(50) — opening | rebuttal | cross_exam | closing
- status: VARCHAR(20) — pending | active | completed
- started_at, completed_at: TIMESTAMP

### debate_agents
- id: UUID PK
- debate_id: UUID FK → debates
- side: VARCHAR(10) — "pro" or "con"
- position: INTEGER DEFAULT 0
- persona_id: UUID FK → personas (nullable)
- title: VARCHAR(200)
- expertise, priorities, style, background: TEXT
- argument_prefix: VARCHAR(10) — "A", "B", "C", "D"

### arguments
- id: UUID PK
- round_id: UUID FK → rounds
- debate_id: UUID FK → debates
- agent_id: UUID FK → debate_agents
- agent_side: VARCHAR(10)
- argument_index: VARCHAR(20) — "A1", "B2"
- arg_type: VARCHAR(30) — claim | rebuttal | concession | concession_with_nuance
- targets: JSONB
- claim, grounds, warrant, backing, qualifier, summary: TEXT
- confidence: DECIMAL(3,1) — agent self-assessed confidence (0.0-10.0), added in v2 pivot
- raw_response: JSONB
- created_at: TIMESTAMP

### argument_analysis (legacy)
> **Note:** Legacy table from v1 competitive scoring model. Kept for backward compatibility
> with older debates. New debates use the synthesis JSON stored in `debates.verdict` instead.

- id: UUID PK
- debate_id: UUID FK → debates
- argument_index: VARCHAR(20)
- claim_score, grounds_score, warrant_score, backing_score, qualifier_score: DECIMAL(3,1)
- overall_strength: DECIMAL(3,1)
- fallacies: JSONB
- notes: TEXT

### personas
- id: UUID PK
- title: VARCHAR(200) NOT NULL
- expertise, priorities, style: TEXT NOT NULL
- background: TEXT
- tags: JSONB DEFAULT '[]'
- is_template: BOOLEAN DEFAULT false
- created_at, updated_at: TIMESTAMP

## API Endpoints
```
POST   /api/auth/verify                    {code} → JWT cookie
GET    /api/health                         Health check

POST   /api/debates                        Create debate with agents
GET    /api/debates                        List debates (?page, ?status)
GET    /api/debates/{id}                   Full debate + arguments
POST   /api/debates/{id}/start             Kick off (async) → 202
GET    /api/debates/{id}/stream            SSE live events
GET    /api/debates/{id}/analysis          Synthesis analysis (legacy: judge verdict)
DELETE /api/debates/{id}                   Soft delete

GET    /api/formats                        List preset formats

POST   /api/identities/generate            Auto-generate identities for topic
GET    /api/personas                       List personas (?search, ?tags)
POST   /api/personas                       Save persona
GET    /api/personas/{id}                  Get persona
PUT    /api/personas/{id}                  Update persona
DELETE /api/personas/{id}                  Delete persona
POST   /api/personas/from-debate/{debate_id} Save debate agents as personas
```

## Debate Engine Logic
1. Load debate config + agents from DB
2. Group agents by side: pro_panel, con_panel
3. For each round:
   - First-speaking side's agents speak sequentially (each sees teammates' prior args)
   - Second-speaking side's agents speak sequentially
   - Opening rounds: pro first. Rebuttal rounds: con first.
4. After final round: synthesizer produces balanced synthesis of the full exploration
5. Save synthesis to verdict column, set status to completed

## Agent Identity System
- Each agent has: title, expertise, priorities, style, background
- Three modes: auto-generate (Claude), pick from persona library, or manual entry
- Panel format: 1-4 agents per side
- Argument prefixes: Pro = A,C,E,G | Con = B,D,F,H
- Intra-panel: agents called sequentially, each sees teammates' args to avoid repetition

## AI Prompt Strategy
- Agents are truth-seeking analysts, not competitive debaters — they concede freely and rate their own confidence (0-10) per argument
- Agents output structured JSON with Toulmin fields + confidence score
- Each argument gets an ID (A1, B2, C1, etc.) for cross-referencing
- arg_type includes "concession_with_nuance" for conceding with caveats
- Synthesizer (was "judge" in v1) produces: bottom_line, confidence_level, arguments_for/against, areas_of_agreement, unresolved_tensions, key_insights, evidence_gaps, nuanced_conclusion
- Synthesizer does NOT pick a winner — it produces balanced, actionable insight
- Model: claude-sonnet-4-20250514
- Parse: try JSON → try code block extraction → fallback to plain text

## Synthesis Output Fields
The synthesizer (judge.py) produces a JSON object stored in `debates.verdict` with these fields:
- **bottom_line** — One-paragraph executive summary of the exploration's findings
- **confidence_level** — Synthesizer's confidence in the bottom line (0-10)
- **arguments_for** — Strongest pro arguments with brief assessment
- **arguments_against** — Strongest con arguments with brief assessment
- **areas_of_agreement** — Points where both sides converged or conceded
- **unresolved_tensions** — Genuine disagreements that the exploration could not resolve
- **key_insights** — Non-obvious findings that emerged from the dialectical process
- **evidence_gaps** — Important questions neither side adequately addressed
- **nuanced_conclusion** — Extended analysis with caveats, conditions, and context-dependent recommendations

## SSE Events
Events streamed via Redis pub/sub on channel `debate:{id}:events`:
- **connected** — Client successfully subscribed to event stream
- **debate_start** — Debate engine has begun processing
- **round_start** — New round beginning, includes round_number and round_type
- **argument** — Agent produced an argument, includes full argument data
- **round_end** — Round completed, includes round_number
- **synthesis_start** — Synthesizer has begun producing the final synthesis
- **debate_complete** — Debate finished, includes final status and synthesis summary
- **error** — Something went wrong, includes error message and context

## Key Conventions
- All IDs: UUID v4
- Timestamps: UTC
- JSONB for flexible/nested data
- Async everywhere (asyncpg, anthropic async client)
- SSE via Redis pub/sub (channel: debate:{id}:events)
- Rate limiting: soft warnings at 20 debates/hour per IP via Redis
- Claude retries: 2x with exponential backoff

## Auth Flow
- INVITE_CODE env var holds passphrase
- POST /api/auth/verify checks code → sets JWT HttpOnly cookie (7-day expiry)
- All other endpoints require valid JWT
- No user accounts

## Deployment
- Docker Compose: postgres + redis + api containers
- Nginx on host: /var/www/debateforge (React build), proxies /api/* → localhost:8000
- SSE needs: proxy_buffering off, proxy_cache off, proxy_read_timeout 3600s
- Access at http://<VPS_IP>:8080/ (port 8080 used to allow other apps on different ports)

## Build Progress
- [x] Step 1: Server dependencies installed
- [x] Step 2: Project folder, .env, CLAUDE.md
- [x] Step 3: docker-compose.yml + backend Dockerfile + requirements.txt
- [x] Step 4: FastAPI skeleton + health endpoint
- [x] Step 5: Database models + auto-create tables
- [x] Step 6: Auth (invite code + JWT)
- [x] Step 7: Persona CRUD + seed templates
- [x] Step 8: Identity generation endpoint
- [x] Step 9: Agent module (Claude debating wrapper)
- [x] Step 10: Debate engine (orchestrator)
- [x] Step 11: Judge module
- [x] Step 12: SSE streaming via Redis
- [x] Step 13: All API routes
- [x] Step 14: React app scaffold + routing
- [x] Step 15: GatePage
- [x] Step 16: HomePage + FormatSelector + AgentSetup
- [x] Step 17: LiveViewer + ArgumentCard
- [x] Step 18: AnalysisDashboard + scoring visuals
- [x] Step 19: HistoryPage + PersonaLibraryPage
- [x] Step 20: Build frontend + deploy to Nginx

## Roadmap
See ROADMAP.md for the full feature roadmap.
Next priority: Evidence Mode (web search + citations for agent arguments).

## Quality Upgrades Plan
See QUALITY_UPGRADES_PLAN.md for detailed implementation specs for 4 features:
1. Evidence Mode (web search + citations) — 6-8 hrs
2. Adversarial Verification (fact-checker agent) — 4-5 hrs
3. Position Evolution Tracking (confidence timeline) — 4-5 hrs
4. Decision Framework Templates (domain-specific analysis) — 4-5 hrs
Build in order — each feature benefits from the previous ones.
