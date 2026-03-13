# DebateForge — AI Council Deliberation Platform

## What Is This
DebateForge is a web tool where 2-6 AI agents (a "council") deliberate on a topic as independent experts. Agents are NOT assigned sides — their positions emerge naturally from their role, expertise, and priorities. Each agent can be supportive, critical, or mixed on any point. After structured rounds of discussion, each agent states their final position, then a synthesizer produces theme-based analysis: where the council agreed, where they disagreed, and what insights emerged.

Example: Topic "Is NVIDIA a good investment?" → Council of 4 (Equity Analyst, Risk Strategist, AI CTO, Portfolio Manager) → 3 rounds of discussion → Each states final position → Synthesizer organizes findings by theme (Valuation Risk, Technology Moat, Competitive Dynamics) showing how each expert weighed in.

## Important: No Backward Compatibility
This is a clean break from v1/v2. Old debate data has been deleted. All tables are rebuilt from scratch for the council model. No code should handle legacy pro/con format, verdict format, or side-based data. If you see old patterns in existing code, replace them — don't add compatibility layers.

## Tech Stack
- **Backend**: FastAPI (Python 3.13) in Docker
- **Frontend**: React 18 + Tailwind CSS (Vite), served by Nginx as static files
- **Database**: PostgreSQL 16 (Docker)
- **Cache/PubSub**: Redis 7 (Docker)
- **AI**: Claude API (claude-sonnet-4-20250514) via `anthropic` Python SDK
- **Auth**: Invite code → JWT HttpOnly cookie (7-day expiry, no user accounts)
- **Reverse Proxy**: Nginx on host (port 8080), proxies /api/* → FastAPI :8000

## Project Structure
```
~/Projects/debateforge/
├── .env                          # ANTHROPIC_API_KEY, INVITE_CODE, JWT_SECRET
├── docker-compose.yml            # postgres + redis + api services
├── CLAUDE.md                     # THIS FILE
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                   # FastAPI app, lifespan (create tables + seed personas)
│   ├── config.py                 # Pydantic BaseSettings from env vars
│   ├── auth.py                   # verify_invite_code, create_jwt, verify_jwt, require_auth
│   ├── database.py               # async SQLAlchemy engine, sessionmaker, Base, get_db
│   ├── models.py                 # ORM models (6 tables, see schema below)
│   ├── schemas.py                # Pydantic request/response models
│   ├── debate_engine.py          # Orchestrator: council turns across rounds + position phase
│   ├── agent.py                  # Claude council member agent wrapper
│   ├── judge.py                  # Claude synthesizer — theme-based analysis
│   ├── identity_generator.py     # Claude-powered diverse council generation
│   ├── events.py                 # Redis pub/sub EventBus for SSE
│   ├── seed_personas.py          # 8 template personas on first boot
│   └── routes/
│       ├── auth.py               # POST /api/auth/verify
│       ├── debates.py            # Deliberation CRUD + start + stream + analysis + positions
│       ├── formats.py            # GET /api/formats (deliberation presets)
│       ├── identities.py         # POST /api/identities/generate (council generation)
│       └── personas.py           # CRUD /api/personas + POST from-debate
└── frontend/
    ├── package.json
    ├── vite.config.js            # Tailwind plugin + /api proxy to localhost:8000
    └── src/
        ├── App.jsx               # Router + auth check + nav bar
        ├── api.js                # Axios instance (baseURL: /api, withCredentials: true)
        ├── main.jsx, index.css   # Entry + dark theme (#0F1117 background)
        ├── pages/
        │   ├── GatePage.jsx      # Invite code entry
        │   ├── HomePage.jsx      # Topic + context + format + council setup → Start
        │   ├── DebatePage.jsx    # Live viewer + synthesis dashboard
        │   ├── HistoryPage.jsx   # Past deliberations list
        │   └── PersonaLibraryPage.jsx
        ├── components/
        │   ├── FormatSelector.jsx      # Deliberation format picker
        │   ├── CouncilSetup.jsx        # Council size selector + agent slot list
        │   ├── IdentityCard.jsx        # Editable identity with save-to-library
        │   ├── PersonaPickerModal.jsx  # Browse/search persona library
        │   ├── LiveViewer.jsx          # Single-column conversation thread
        │   ├── ArgumentCard.jsx        # Argument with stance badge + Toulmin expandable
        │   ├── AnalysisDashboard.jsx   # Tabs: Synthesis, Themes, Positions, Consensus, Insights
        │   ├── ThemeCard.jsx           # Theme with perspectives from each agent
        │   ├── PositionCard.jsx        # Agent's final position statement
        │   ├── ToulminBreakdown.jsx    # Expandable Toulmin fields
        │   ├── FallacyBadge.jsx        # Severity badge
        │   └── RateWarning.jsx         # Soft rate limit toast
        └── hooks/
            └── useDebateStream.js      # SSE hook for /api/debates/{id}/stream
```

## Database Schema (PostgreSQL)

### debates
- id: UUID PK
- topic: TEXT NOT NULL
- context: TEXT (nullable)
- format_config: JSONB — {format_name, rounds: [{type, word_limit}]}
- council_size: INTEGER DEFAULT 3 (2-6 agents)
- status: VARCHAR(20) — configuring | running | reflecting | synthesizing | completed | error
- created_by_ip: VARCHAR(45)
- created_at: TIMESTAMP
- completed_at: TIMESTAMP (nullable)
- synthesis: JSONB (nullable) — full synthesizer output

### rounds
- id: UUID PK
- debate_id: UUID FK → debates
- round_number: INTEGER
- round_type: VARCHAR(50) — opening | discussion | exploration | closing
- status: VARCHAR(20) — pending | active | completed
- started_at, completed_at: TIMESTAMP

### debate_agents (council members)
- id: UUID PK
- debate_id: UUID FK → debates
- seat_number: INTEGER (0-indexed, determines speaking order)
- persona_id: UUID FK → personas (nullable)
- title: VARCHAR(200)
- expertise, priorities, style, background: TEXT
- argument_prefix: VARCHAR(10) — "A", "B", "C", "D", "E", "F" (sequential by seat)

### arguments
- id: UUID PK
- round_id: UUID FK → rounds
- debate_id: UUID FK → debates
- agent_id: UUID FK → debate_agents
- argument_index: VARCHAR(20) — "A1", "B2"
- arg_type: VARCHAR(30) — claim | rebuttal | concession | concession_with_nuance | question | build_on
- stance: VARCHAR(20) — supportive | critical | mixed | neutral
- confidence: DECIMAL(3,1) — 0-10 self-assessed
- targets: JSONB — other argument IDs this responds to
- claim, grounds, warrant, backing, qualifier, summary: TEXT
- raw_response: JSONB
- created_at: TIMESTAMP

### agent_positions (final position statements)
- id: UUID PK
- debate_id: UUID FK → debates
- agent_id: UUID FK → debate_agents
- overall_stance: VARCHAR(20) — supportive | critical | mixed | uncertain
- confidence: DECIMAL(3,1) — 0-10
- position_summary: TEXT
- key_concerns: JSONB — [{concern, severity}]
- key_supports: JSONB — [{point, confidence}]
- would_change_mind: TEXT
- created_at: TIMESTAMP

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
POST   /api/auth/verify                        {code} → JWT cookie
GET    /api/health                             Health check

POST   /api/debates                            Create deliberation with council
GET    /api/debates                            List deliberations (?page, ?status)
GET    /api/debates/{id}                       Full deliberation + arguments
POST   /api/debates/{id}/start                 Kick off (async) → 202
GET    /api/debates/{id}/stream                SSE live events
GET    /api/debates/{id}/analysis              Synthesis (theme-based)
GET    /api/debates/{id}/positions             Council final position statements
DELETE /api/debates/{id}                       Soft delete

GET    /api/formats                            Deliberation format presets

POST   /api/identities/generate                Auto-generate diverse council
GET    /api/personas                           List personas (?search, ?tags)
POST   /api/personas                           Save persona
GET    /api/personas/{id}                      Get persona
PUT    /api/personas/{id}                      Update persona
DELETE /api/personas/{id}                      Delete persona
POST   /api/personas/from-debate/{debate_id}   Save council members as personas
```

## Deliberation Engine Logic
1. Load deliberation config + council members from DB
2. Order agents by seat_number
3. For each round:
   - Each agent speaks in seat order (Agent A → B → C → D → ...)
   - Each agent sees the full conversation history before their turn
   - Agents respond to each other freely — agree, disagree, question, build on
4. After final round: "reflecting" phase
   - Each agent produces a final position statement (stance, confidence, concerns, supports, what would change their mind)
5. "synthesizing" phase:
   - Synthesizer receives full transcript + all final positions
   - Produces theme-based analysis
6. Save synthesis + positions, set status to completed

## Deliberation Format Presets
- **quick_take**: 1 round (opening only) — fast initial perspectives
- **rapid_assessment**: 2 rounds (opening + discussion) — quick exploration
- **standard**: 3 rounds (opening + discussion + closing) — default
- **deep_dive**: 5 rounds (opening + discussion + exploration + discussion + closing) — thorough

All formats end with a mandatory final positions phase (not counted as a round).

## Agent Prompt Strategy
- Agents are independent council members, NOT assigned pro/con sides
- Each agent's position emerges from their identity (title, expertise, priorities)
- Per-argument stance label: supportive | critical | mixed | neutral
- Per-argument confidence: 0-10 self-assessed
- arg_types: claim, rebuttal, concession, concession_with_nuance, question, build_on
- Agents reference each other by argument ID (A1, B2, etc.)
- Agents see full conversation history before their turn each round
- Output format: JSON with Toulmin fields + stance + confidence

## Synthesizer Output Format
Theme-based analysis, NOT picking a winner:
```json
{
  "synthesis": {
    "bottom_line": "Executive summary of what the deliberation revealed",
    "confidence_level": "high|moderate|low|uncertain",
    "themes": [
      {
        "theme": "Theme name (e.g., Valuation Risk)",
        "summary": "What the council thinks about this",
        "perspectives": [
          {"agent_title": "...", "agent_prefix": "A", "stance": "critical", "view": "...", "confidence": 8}
        ],
        "consensus_level": "high|medium|low",
        "key_tension": "What's debated on this theme (null if consensus)"
      }
    ],
    "council_consensus": ["Points where all/most agreed"],
    "major_disagreements": [
      {"topic": "...", "camps": [{"agents": ["A","C"], "position": "..."}, {"agents": ["B"], "position": "..."}], "why_unresolvable": "..."}
    ],
    "individual_positions": [
      {"agent_prefix": "A", "agent_title": "...", "overall_stance": "critical", "confidence": 7, "position_summary": "...", "key_concerns": [...], "key_supports": [...], "would_change_mind": "..."}
    ],
    "blind_spots": ["Important dimensions not adequately addressed"],
    "key_insights": ["Non-obvious insights from cross-pollination of perspectives"],
    "open_questions": ["Unanswered questions from the deliberation"],
    "nuanced_conclusion": "3-4 paragraph balanced conclusion by themes"
  }
}
```

## SSE Events
```
event: connected         — immediate on connect, {debate_id}
event: debate_start      — deliberation begins, {topic, council_size, total_rounds}
event: round_start       — {round_number, round_type}
event: argument          — {seat_number, agent_prefix, agent_title, argument_index, stance, confidence, claim, summary}
event: round_end         — {round_number}
event: reflecting_start  — agents producing final positions
event: position          — {agent_prefix, agent_title, overall_stance, confidence, position_summary}
event: synthesis_start   — synthesizer working
event: debate_complete   — {bottom_line, confidence_level}
event: error             — {message}
```

## Council Color Scheme
Each seat gets a distinct color (used in UI for badges, borders, charts):
- Seat 1 (A): Blue #3B82F6
- Seat 2 (B): Amber #F59E0B
- Seat 3 (C): Emerald #10B981
- Seat 4 (D): Purple #8B5CF6
- Seat 5 (E): Rose #F43F5E
- Seat 6 (F): Cyan #06B6D4

## Key Conventions
- All IDs: UUID v4
- Timestamps: UTC
- JSONB for flexible/nested data
- Async everywhere (asyncpg, anthropic async client)
- SSE via Redis pub/sub (channel: debate:{id}:events)
- Rate limiting: soft warnings at 20 deliberations/hour per IP via Redis
- Claude retries: 2x with exponential backoff
- JSON parse strategy: try direct → try code block extraction → fallback to plain text

## Auth Flow
- INVITE_CODE env var holds passphrase
- POST /api/auth/verify checks code → sets JWT HttpOnly cookie (7-day expiry)
- All other endpoints require valid JWT
- No user accounts

## Deployment
- Docker Compose: postgres + redis + api containers
- Nginx on host: /var/www/debateforge (React build), proxies /api/* → localhost:8000
- SSE needs: proxy_buffering off, proxy_cache off, proxy_read_timeout 3600s
- Access at http://<VPS_IP>:8080/

## Council Pivot Build Steps
- [x] Step 1: Update models.py — new schema (drop old tables, create fresh)
- [x] Step 2: Update schemas.py — new request/response models
- [x] Step 3: Update identity_generator.py — council generation (not pro/con)
- [x] Step 4: Update agent.py — council member prompt (no sides, stance labels)
- [x] Step 5: Update debate_engine.py — council orchestration + position phase
- [x] Step 6: Update judge.py — theme-based synthesizer
- [x] Step 7: Update routes (debates, formats, identities) — new API shape
- [x] Step 8: Update frontend HomePage — CouncilSetup component
- [x] Step 9: Update frontend LiveViewer — conversation thread layout
- [x] Step 10: Update frontend AnalysisDashboard — themes + positions tabs
- [x] Step 11: Update frontend DebatePage — wire new SSE events + review mode
- [x] Step 12: Update HistoryPage — remove verdict/winner display
- [x] Step 13: Update CLAUDE.md, README, ROADMAP
- [x] Step 14: Build frontend + deploy to Nginx
- [x] Step 15: Test end-to-end + commit + merge to main

## Evidence Mode (Current Build)
Agents can search the web for real evidence using Tavily API during deliberation.

### How It Works
- Agents use Claude's tool_use feature with a web_search tool
- Agent decides when to search based on claims they want to make
- Max 3 searches per agent per round (cost control)
- Search results cached in Redis (same query within 1 hour returns cached)
- Each argument gains a `citations` field: list of {url, title, snippet, date, source_type}
- Synthesizer evaluates citation quality alongside arguments

### Backend Changes
- New file: backend/search.py — Tavily search wrapper with Redis caching
- Updated: backend/agent.py — tool_use integration, search tool schema, handle tool responses
- Updated: backend/models.py — citations JSONB column on arguments table
- Updated: backend/judge.py — synthesizer evaluates evidence quality
- Updated: backend/config.py — TAVILY_API_KEY setting
- Updated: docker-compose.yml — pass TAVILY_API_KEY to api container

### Frontend Changes
- Updated: ArgumentCard.jsx — show citation links, source count badge
- Updated: AnalysisDashboard.jsx — evidence quality section in Synthesis tab

### New Synthesis Fields
```json
"evidence_assessment": {
  "total_citations": 12,
  "agents_citing": ["A", "B", "C"],
  "strongest_citation": {"argument_id": "A2", "why": "..."},
  "unsupported_claims": ["C3 claimed X without evidence"],
  "evidence_gaps": ["No data cited on Y"]
}
```

### Evidence Mode Build Steps
- [ ] E1: Add TAVILY_API_KEY to config.py + docker-compose.yml
- [ ] E2: Create backend/search.py (Tavily wrapper + Redis cache)
- [ ] E3: Update models.py (citations JSONB on arguments)
- [ ] E4: Update agent.py (tool_use with web_search)
- [ ] E5: Update judge.py (synthesizer evaluates citations)
- [ ] E6: Update frontend ArgumentCard (citation display)
- [ ] E7: Update frontend AnalysisDashboard (evidence quality)
- [ ] E8: Test end-to-end + deploy

## Future: Quality Upgrades (build in order)
1. Evidence Mode — agents search web, cite real sources (6-8 hrs)
2. Adversarial Verification — fact-checker agent (4-5 hrs)
3. Position Evolution Tracking — confidence timeline across rounds (4-5 hrs)
4. Decision Framework Templates — domain-specific analysis (4-5 hrs)
See QUALITY_UPGRADES_PLAN.md for details.
