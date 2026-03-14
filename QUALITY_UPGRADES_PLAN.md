# DebateForge Quality Upgrades Plan

Four features to transform DebateForge from opinion-based dialectics into evidence-grounded, self-correcting analysis. Build in order — each feature compounds on the previous ones.

---

## ✅ Feature 1: Evidence Mode (Web Search + Citations) — COMPLETED

Implemented with Tavily API for web search, Redis caching (1hr TTL), max 3 searches per agent per round. Toggle: `enable_search` per debate. Agent system prompt conditionally includes EVIDENCE section and citations JSON field only when enabled (prevents hallucinated citations when off).

**Key implementation details vs original plan:**
- Column name: `citations` (not `evidence_sources`) on arguments table
- Flag name: `enable_search` (not `evidence_mode`) on debates table
- Synthesizer evidence_assessment section is conditional on `enable_search`

---

## ✅ Feature 2: Adversarial Verification (Fact-Checker Agent) — COMPLETED

Implemented with Claude Haiku (not Sonnet — cost optimization) for the verification agent. Max 5 web searches. Toggle: `enable_verification` per debate. Runs after reflecting phase, before synthesis. Synthesizer receives verification report and incorporates findings conditionally.

**Key implementation details vs original plan:**
- Model: `claude-haiku-4-5-20251001` (cheaper than Sonnet for fact-checking)
- Max tokens: 8192 (increased from initial 4096)
- Flag name: `enable_verification` (not `ENABLE_VERIFICATION` config) — per-debate toggle on debates table
- Synthesizer max_tokens increased to 16000 (was 4096, caused truncation)
- Added `_repair_truncated_json` in judge.py to salvage partial synthesis output
- Synthesizer verification_summary section is conditional on `enable_verification`
- SSE events: `verification_start`, `verification_complete` (not `claim_checked` per-claim streaming)

---

## Feature 3: Position Evolution Tracking (Confidence Timeline)

**Estimated Effort:** 4-5 hours

### Problem It Solves
Currently, each argument has a confidence score, but there's no view of how positions evolved across the debate. Did the pro side become less confident after a strong rebuttal? Did both sides converge on agreement? The most valuable insight often isn't in the final positions — it's in *what changed and why*. Without tracking evolution, the debate is a collection of static snapshots instead of a dynamic exploration.

### How It Works
1. Agents already output a confidence score (0-10) per argument. This feature tracks those scores across rounds and adds a post-debate reflection step.
2. After the final round, each agent receives the full transcript and their own confidence history. They produce a "reflection" — a structured assessment of what changed their position, which opposing arguments were most persuasive, and where they'd still push back.
3. Confidence data is aggregated into a timeline: per-agent and per-side averages across rounds.
4. The synthesizer receives confidence trajectories and agent reflections, using them to identify which arguments actually moved the needle vs. which were noise.
5. Frontend shows a confidence timeline chart and a "What Changed" section with agent reflections.

### Backend Changes
- **`backend/models.py`** — Add `confidence_history` JSONB column to `debate_agents` table. Structure: `[{round_number, argument_index, confidence, brief_reason}]`. Add `reflections` JSONB column to `debates` table for post-debate agent reflections.
- **`backend/agent.py`** — After each argument, append confidence data to agent's history. Add `generate_reflection(transcript, confidence_history)` method. Reflection prompt: "Review the full debate and your confidence scores. What changed your mind? Which opposing arguments were strongest? Where do you remain unconvinced? Be specific — reference argument IDs."
- **`backend/schemas.py`** — Add `ConfidencePoint`, `AgentReflection`, `EvolutionData` Pydantic models. Update `DebateAgentResponse` to include confidence history. Update `DebateResponse` to include reflections.
- **`backend/debate_engine.py`** — After final round, before verification/synthesis: call each agent's reflection method. Collect reflections. Pass confidence trajectories + reflections to synthesizer. New substatus or SSE event for reflection phase.
- **`backend/judge.py`** — Extend synthesizer prompt: "You have confidence trajectories showing how each agent's certainty changed across rounds, plus their reflections on what influenced them. Use this to identify: which arguments actually shifted positions, where genuine agreement emerged vs. where disagreement hardened, and what the confidence trends suggest about the strength of each side's case."
- **`backend/events.py`** — New SSE events: `reflection_started`, `reflection_complete`, `confidence_update` (fired after each argument with running confidence data).

### Frontend Changes
- **`src/components/ConfidenceTimeline.jsx`** — New component. Line chart (use Recharts or similar — already likely a dependency for ScoreComparison) showing:
  - X-axis: argument sequence (A1, B1, A2, B2, ...)
  - Y-axis: confidence 0-10
  - One line per agent, color-coded by side (blue for pro, red for con)
  - Hover tooltip shows the argument summary and confidence reason
  - Optional: side-average lines (dashed) to show overall trend
- **`src/components/ReflectionPanel.jsx`** — New component. Shows each agent's post-debate reflection in a card format. Highlights: "Most persuasive opposing argument", "Biggest position shift", "Remaining disagreements". Cross-links to specific argument IDs.
- **`src/components/AnalysisDashboard.jsx`** — Add ConfidenceTimeline and ReflectionPanel as sections. Show a quick "Evolution Summary" stat: e.g., "Pro confidence: 8→6 (-2), Con confidence: 7→7 (stable)".
- **`src/components/ArgumentCard.jsx`** — Show confidence score as a small badge/indicator. Color-code: green (8-10), yellow (5-7), red (1-4). Show delta from previous argument if confidence changed.
- **`src/hooks/useDebateStream.js`** — Handle `confidence_update` events to update timeline chart in real-time during the debate.

### Cost Impact
- **Claude API:** One reflection call per agent (~$0.02-0.04 each). With 2 agents = ~$0.04-0.08/debate. With 4-agent panels = ~$0.08-0.16.
- **No additional Tavily cost.** Reflections are based on the debate transcript, not web search.
- **Total per debate:** ~$0.04-0.16 additional depending on panel size. Minimal.

### Build Steps
1. Add `confidence_history` column to debate_agents, `reflections` column to debates
2. Update `agent.py` to track confidence after each argument and store in history
3. Add `generate_reflection()` method to agent with structured output schema
4. Update `debate_engine.py` to run reflection phase after final round
5. Add confidence/reflection SSE events to `events.py`
6. Update `judge.py` to incorporate confidence trajectories and reflections
7. Update schemas for confidence history and reflections
8. Frontend: Build ConfidenceTimeline chart component
9. Frontend: Build ReflectionPanel component
10. Frontend: Add confidence badges to ArgumentCard
11. Frontend: Integrate timeline and reflections into AnalysisDashboard
12. Frontend: Handle real-time confidence updates in useDebateStream
13. Test confidence tracking across a full multi-round debate

---

## Feature 4: Decision Framework Templates (Domain-Specific Analysis)

**Estimated Effort:** 4-5 hours

### Problem It Solves
Different decision types need different analysis lenses. Evaluating a technology adoption is fundamentally different from evaluating a hiring decision or a policy change. Currently, all debates use the same generic structure regardless of domain. Users have to manually configure agents and interpret synthesis output through the lens of their specific decision type. Templates would make the tool immediately useful for common decision scenarios without requiring users to be prompt-engineering experts.

### How It Works
1. Users select a Decision Framework when creating a debate (optional — "General" is the default).
2. Each framework defines:
   - **Focus areas:** What agents should prioritize (e.g., "ROI, integration risk, team readiness" for Technology Adoption).
   - **Synthesizer sections:** Custom output structure (e.g., Investment framework adds "Risk/Reward Matrix" and "Time Horizon Analysis").
   - **Suggested personas:** Pre-configured agent identities suited to the domain (e.g., Hiring framework suggests "Hiring Manager", "Team Lead", "HR Compliance").
   - **Evaluation criteria:** Weighted rubric the synthesizer uses (e.g., Policy Change weights "stakeholder impact" higher than "implementation cost").
3. Framework configuration is pure prompt engineering — no new API calls, no new models. Templates modify the system prompts for agents and synthesizer.
4. Templates are stored as static JSON configs in the backend. Easy to add new ones.

### Frameworks Included

**Investment Decision**
- Focus: ROI, risk tolerance, time horizon, opportunity cost, market conditions
- Synthesizer adds: Risk/Reward Matrix, Time Horizon Analysis, Comparable Decisions
- Personas: Financial Analyst, Risk Manager, Industry Specialist, Portfolio Strategist

**Technology Adoption**
- Focus: Integration complexity, team capability, migration risk, vendor lock-in, scalability
- Synthesizer adds: Migration Roadmap Assessment, Technical Debt Impact, Team Readiness Score
- Personas: Solutions Architect, Engineering Lead, DevOps Specialist, Product Manager

**Hiring Decision**
- Focus: Role fit, team dynamics, growth potential, culture alignment, compensation equity
- Synthesizer adds: Team Composition Impact, Growth Trajectory Projection, Risk of Inaction
- Personas: Hiring Manager, Team Lead, HR Strategist, Culture Advocate

**Strategic Direction**
- Focus: Market position, competitive advantage, resource allocation, stakeholder alignment, reversibility
- Synthesizer adds: Competitive Landscape Analysis, Resource Allocation Matrix, Stakeholder Impact Map
- Personas: Strategy Director, Market Analyst, Operations Lead, Customer Advocate

**Policy Change**
- Focus: Stakeholder impact, implementation feasibility, unintended consequences, equity, precedent
- Synthesizer adds: Stakeholder Impact Assessment, Implementation Risk Matrix, Precedent Analysis
- Personas: Policy Analyst, Implementation Lead, Affected Party Advocate, Compliance Officer

### Backend Changes
- **New file: `backend/frameworks.py`** — Framework definitions as Python dataclasses or dicts. Each framework: `{id, name, description, focus_areas: [str], agent_prompt_additions: str, synthesizer_sections: [{name, instruction}], suggested_personas: [{title, expertise, priorities, style}], evaluation_weights: {criterion: weight}}`. Include all 5 frameworks + "General" default.
- **`backend/models.py`** — Add `framework` VARCHAR(50) DEFAULT 'general' to `debates` table.
- **`backend/schemas.py`** — Add `framework` field to `DebateCreate`. Add `FrameworkConfig` and `FrameworkListResponse` Pydantic models.
- **`backend/agent.py`** — When framework is set, append framework-specific focus instructions to agent system prompt: "For this {framework} decision, pay special attention to: {focus_areas}. Structure your analysis around these criteria."
- **`backend/judge.py`** — When framework is set, append custom synthesis sections to synthesizer prompt: "In addition to the standard synthesis, include these framework-specific sections: {sections}. Weight your evaluation according to: {evaluation_weights}."
- **`backend/routes/formats.py`** — Add `GET /api/frameworks` endpoint returning available frameworks with descriptions and suggested personas.
- **`backend/debate_engine.py`** — Load framework config at debate start, pass to agent and synthesizer calls.

### Frontend Changes
- **`src/components/FrameworkSelector.jsx`** — New component. Dropdown or card grid showing available frameworks. Each card: icon, name, short description, list of focus areas. Selecting a framework auto-suggests personas and shows a preview of the custom synthesis sections.
- **`src/pages/HomePage.jsx`** — Add FrameworkSelector between topic input and format selector. When a framework is selected: auto-populate suggested personas in AgentSetup (user can still customize), show framework-specific tips below the topic input.
- **`src/components/AgentSetup.jsx`** — When framework has suggested personas, show "Use suggested personas" button that pre-fills agent identities. Clear visual distinction between framework suggestions and manual config.
- **`src/components/AnalysisDashboard.jsx`** — When debate has a framework, render custom synthesis sections with appropriate headings and formatting. Show framework badge in header (e.g., "Technology Adoption Framework").
- **`src/components/FrameworkBadge.jsx`** — New small component showing framework name + icon used in debate cards (HistoryPage) and AnalysisDashboard header.

### Cost Impact
- **Zero additional API cost.** Frameworks only modify prompts — same number of Claude calls, same model, roughly same token count (framework instructions add ~100-200 tokens to system prompts).
- **No Tavily cost.** Frameworks are prompt-only.
- **Total per debate:** $0.00 additional.

### Build Steps
1. Create `backend/frameworks.py` with all 5 framework definitions + General default
2. Add `framework` column to debates model
3. Add `GET /api/frameworks` endpoint to routes
4. Update `agent.py` to inject framework focus areas into agent system prompts
5. Update `judge.py` to inject framework-specific synthesis sections and weights
6. Update `debate_engine.py` to load and distribute framework config
7. Update schemas for framework field and framework list response
8. Frontend: Build FrameworkSelector component
9. Frontend: Integrate FrameworkSelector into HomePage
10. Frontend: Add persona auto-fill from framework suggestions to AgentSetup
11. Frontend: Render framework-specific sections in AnalysisDashboard
12. Frontend: Build FrameworkBadge for debate cards
13. Test each framework with a relevant topic to verify prompt quality

---

## Combined Architecture After All 4 Features

### Updated Debate Flow
```
1. User creates debate
   ├── Selects Decision Framework (Feature 4) → loads focus areas + personas
   ├── Enables/disables Evidence Mode (Feature 1)
   ├── Enables/disables Adversarial Verification (Feature 2)
   └── Configures agents (with framework-suggested personas)

2. Debate engine runs rounds
   ├── Each agent generates arguments
   │   ├── With web search if Evidence Mode on (Feature 1)
   │   ├── With framework-specific focus areas (Feature 4)
   │   └── Confidence tracked per argument (Feature 3)
   └── SSE streams arguments + evidence + confidence in real-time

3. Post-debate phases (sequential)
   ├── Agent Reflections (Feature 3) — each agent reflects on position changes
   ├── Adversarial Verification (Feature 2) — fact-checker verifies claims + finds gaps
   └── Synthesis (enhanced by all 4 features)
       ├── Incorporates cited evidence quality (Feature 1)
       ├── Incorporates verification report (Feature 2)
       ├── Incorporates confidence trajectories + reflections (Feature 3)
       └── Uses framework-specific sections + weights (Feature 4)

4. Frontend displays
   ├── Arguments with source links + evidence badges (Feature 1)
   ├── Verification report with claim checks + blind spots (Feature 2)
   ├── Confidence timeline chart + reflection panel (Feature 3)
   └── Framework-specific synthesis sections (Feature 4)
```

### New Files
```
backend/
├── search.py              # Tavily web search wrapper (Feature 1)
├── verifier.py            # Adversarial verification agent (Feature 2)
└── frameworks.py          # Decision framework templates (Feature 4)

frontend/src/components/
├── EvidenceBadge.jsx      # Source quality indicator (Feature 1)
├── VerificationReport.jsx # Claim checks + blind spots (Feature 2)
├── ConfidenceTimeline.jsx # Confidence chart over rounds (Feature 3)
├── ReflectionPanel.jsx    # Agent post-debate reflections (Feature 3)
├── FrameworkSelector.jsx  # Decision framework picker (Feature 4)
└── FrameworkBadge.jsx     # Framework label badge (Feature 4)
```

### Modified Files (All Features Combined)
```
backend/
├── config.py              # +TAVILY_API_KEY, +ENABLE_VERIFICATION
├── models.py              # +evidence_mode, +evidence_sources, +verification_report,
│                          #  +confidence_history, +reflections, +framework
├── schemas.py             # +EvidenceSource, +VerificationReport, +ConfidencePoint,
│                          #  +AgentReflection, +FrameworkConfig
├── agent.py               # +tool_use for search, +confidence tracking,
│                          #  +reflection generation, +framework focus injection
├── judge.py               # +citation eval, +verification integration,
│                          #  +evolution analysis, +framework sections
├── debate_engine.py       # +evidence passing, +reflection phase,
│                          #  +verification phase, +framework loading
├── events.py              # +evidence_found, +verification_*, +confidence_update,
│                          #  +reflection_* SSE events
└── routes/
    ├── debates.py         # Updated schemas for new fields
    └── formats.py         # +GET /api/frameworks endpoint

frontend/src/
├── pages/
│   ├── HomePage.jsx       # +Evidence toggle, +Verification toggle,
│   │                      #  +FrameworkSelector, +persona auto-fill
│   └── DebatePage.jsx     # Handles new phases in live view
├── components/
│   ├── ArgumentCard.jsx   # +sources section, +verification badge,
│   │                      #  +confidence badge with delta
│   ├── AnalysisDashboard.jsx  # +Evidence Quality, +VerificationReport,
│   │                          #  +ConfidenceTimeline, +ReflectionPanel,
│   │                          #  +framework-specific sections
│   ├── AgentSetup.jsx     # +framework persona suggestions
│   └── LiveViewer.jsx     # +verification phase display
└── hooks/
    └── useDebateStream.js # +evidence, +verification, +confidence SSE handlers
```

### New Database Columns
| Table | Column | Type | Feature | Status |
|-------|--------|------|---------|--------|
| debates | enable_search | BOOLEAN DEFAULT true | 1 | ✅ Done |
| debates | enable_verification | BOOLEAN DEFAULT true | 2 | ✅ Done |
| debates | verification_report | JSONB | 2 | ✅ Done |
| debates | reflections | JSONB | 3 | Planned |
| debates | framework | VARCHAR(50) DEFAULT 'general' | 4 | Planned |
| arguments | citations | JSONB DEFAULT '[]' | 1 | ✅ Done |
| debate_agents | confidence_history | JSONB | 3 | Planned |

### New API Endpoints
| Method | Path | Feature |
|--------|------|---------|
| GET | /api/frameworks | 4 |

### New SSE Event Types
| Event | Payload | Feature |
|-------|---------|---------|
| evidence_found | {argument_index, source} | 1 |
| verification_started | {} | 2 |
| claim_checked | {claim, verdict} | 2 |
| verification_complete | {report} | 2 |
| confidence_update | {agent_id, round, confidence} | 3 |
| reflection_started | {agent_id} | 3 |
| reflection_complete | {agent_id, reflection} | 3 |

## Total Cost Estimates

### Per-Debate Cost (All Features Enabled)
| Component | Min | Max |
|-----------|-----|-----|
| Base Claude (agents + synthesizer) | $0.15 | $0.30 |
| Evidence Mode (Tavily + extra tokens) | $0.20 | $0.25 |
| Adversarial Verification (Claude + Tavily) | $0.10 | $0.20 |
| Position Evolution (reflections) | $0.04 | $0.16 |
| Decision Frameworks | $0.00 | $0.00 |
| **Total** | **$0.49** | **$0.91** |

### Per-Debate Cost (Base Only, All Features Off)
| Component | Min | Max |
|-----------|-----|-----|
| Base Claude (agents + synthesizer) | $0.15 | $0.30 |
| **Total** | **$0.15** | **$0.30** |

### Monthly Estimates (50 debates/month)
| Configuration | Min | Max |
|---------------|-----|-----|
| All features on | $24.50 | $45.50 |
| Base only | $7.50 | $15.00 |

### External API Keys Required
| Service | Feature | Free Tier | Paid |
|---------|---------|-----------|------|
| Tavily | 1, 2 | 1,000 searches/month | $0.01/search |

## Recommended Build Order

1. ~~**Evidence Mode** (Feature 1)~~ ✅ Completed
2. ~~**Adversarial Verification** (Feature 2)~~ ✅ Completed
3. **Position Evolution Tracking** (Feature 3) — Low cost, uses existing confidence data. Adds reflection phase and confidence timeline.
4. **Decision Framework Templates** (Feature 4) — Zero API cost, immediate UX improvement. Framework-aware prompts for agents and synthesizer.

**Remaining estimated effort: 8-10 hours for Features 3 and 4.**
