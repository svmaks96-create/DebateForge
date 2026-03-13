# DebateForge — Council Architecture Pivot Plan

> This document plans the pivot from a two-sided debate model to a council/roundtable
> deliberation model. Sessions are now called "deliberations" — a group of 2-6 AI agents
> with diverse perspectives discuss a topic together, then a synthesizer produces
> theme-based analysis with individual position statements.

---

## Why This Change

The current model forces agents into fixed pro/con camps. Even after the dialectical pivot,
agents are still assigned a side. Real decision-making doesn't work this way. An investment
committee doesn't split into "team buy" and "team sell" — each member brings their expertise,
forms their own nuanced view, and the discussion reveals insights no single person would reach.

The council model is:
- **More realistic** — mirrors how expert teams actually deliberate
- **More nuanced** — agents can be 70% in favor but concerned about one specific risk
- **More insightful** — themes emerge organically instead of being forced into binary
- **More useful** — the output maps directly to how decisions get made

---

## Architecture Overview

### Current (v2 — Two-Sided Debate)
```
Topic → [Pro Panel] vs [Con Panel] → Rounds → Synthesizer → For/Against Summary
```

### New (v3 — Council Deliberation)
```
Topic → [Council: 2-6 Agents] → Rounds → Final Positions → Synthesizer → Theme-Based Analysis
```

### Session Flow

```
1. User enters topic + context
2. User configures council (2-6 agents):
   - Auto-generate diverse council for the topic
   - Pick from persona library
   - Define manually
   - Mix of all three
3. User selects deliberation format (number of rounds)
4. Deliberation runs:
   Round 1 (Opening Perspectives):
     Agent A speaks → Agent B speaks → Agent C speaks → ...
     Each shares their initial take from their expertise
   Round 2 (Discussion & Response):
     Agent A responds to what they've heard → Agent B → Agent C → ...
     Agents agree, disagree, build on each other, raise new concerns
   Round 3+ (Deeper Exploration):
     Same structure, but agents go deeper on contested points
     Agents update their positions based on what they've learned
   Final Round (Position Statements):
     Each agent gives a clear "where I stand" summary with confidence
5. Synthesizer produces theme-based analysis + individual summaries
```

---

## Data Model Changes

### What Changes

**`debates` table → rename conceptually to "deliberations"**
Keep the actual table name `debates` for backward compatibility, but all new code
and UI refers to "deliberations."

Remove:
- `panel_config` JSONB (no more pro/con counts)

Add:
- `council_size` INTEGER DEFAULT 3 (number of agents, 2-6)

Status values update:
- `configuring | running | reflecting | synthesizing | completed | error`
- "reflecting" is the new phase where agents give final position statements

**`debate_agents` table → "council members"**

Remove:
- `side` VARCHAR(10) — no more pro/con
- `argument_prefix` based on side (A,C,E for pro / B,D,F for con)

Change:
- `position` → `seat_number` (0-indexed, determines speaking order)
- `argument_prefix` → assigned sequentially: A, B, C, D, E, F (one per agent, regardless of stance)

Add:
- `final_position` JSONB (nullable) — agent's "where I stand" summary at the end

**`arguments` table**

Remove:
- `agent_side` VARCHAR(10) — no longer relevant

Add:
- `stance` VARCHAR(20) — "supportive | critical | mixed | neutral" (per-argument, not per-agent)
  This replaces the binary side. An agent might make one supportive argument and one critical one.

Keep:
- `confidence` DECIMAL(3,1) — already added in v2
- All Toulmin fields
- `targets` JSONB — agents can still reference each other's arguments
- `arg_type` — claim | rebuttal | concession | concession_with_nuance | question | build_on

Add to arg_type:
- "question" — agent raises a question for the council to consider
- "build_on" — agent extends another agent's argument with additional reasoning

**`rounds` table**

No changes needed — rounds still have number, type, and status.
Round types update:
- "opening" → initial perspectives
- "discussion" → responses and debate
- "exploration" → deeper dives
- "closing" → final position statements

**New: `agent_positions` table** (replaces agent_reflections concept)
```sql
CREATE TABLE agent_positions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debate_id           UUID REFERENCES debates(id),
    agent_id            UUID REFERENCES debate_agents(id),
    overall_stance      VARCHAR(20),        -- supportive | critical | mixed | uncertain
    confidence          DECIMAL(3,1),       -- 0-10
    position_summary    TEXT,               -- 2-3 sentence "where I stand"
    key_concerns        JSONB,              -- [{concern, severity}]
    key_supports        JSONB,              -- [{point, confidence}]
    would_change_mind   TEXT,               -- what evidence would flip their position
    created_at          TIMESTAMP DEFAULT NOW()
);
```

### What Stays the Same
- `personas` table — unchanged
- `argument_analysis` table — legacy, kept for backward compat
- `debates` table — mostly same structure, minor field changes

---

## Agent Prompt Changes

### Current Prompt (v2 — Dialectical)
```
You are a thoughtful analyst exploring the proposition from the {SIDE} perspective.
YOUR SIDE: PRO/CON
```

### New Prompt (v3 — Council Member)
```
You are {identity.title}, participating in a council deliberation on the following topic.

TOPIC: {topic}
CONTEXT: {context}

YOUR ROLE: {identity.title}
YOUR EXPERTISE: {identity.expertise}
YOUR PRIORITIES: {identity.priorities}
YOUR ARGUMENTATION STYLE: {identity.style}
YOUR BACKGROUND: {identity.background}

== YOUR TASK ==
Share your honest perspective on this topic based on your expertise and priorities.
You are NOT assigned a side. Your position should emerge naturally from your knowledge
and what you care about.

== PRINCIPLES ==
- Be honest about what you think, including mixed feelings
- You can be partially supportive and partially critical — nuance is valued
- Rate your confidence (0-10) on each point you make
- When another council member makes a good point, acknowledge it
- When you disagree with someone, explain why from YOUR perspective
- Raise questions when you see gaps in the discussion
- Build on others' arguments when you can add value from your expertise
- Your priorities should shape WHAT you focus on:
  * A CFO naturally focuses on costs and ROI
  * A CTO focuses on technical feasibility and debt
  * A Risk Manager focuses on what could go wrong
  * A Customer Lead focuses on user impact

== STANCE LABELS ==
For each argument, label your stance:
- "supportive" — you're arguing in favor of this aspect
- "critical" — you're raising a concern or arguing against this aspect
- "mixed" — you see both sides on this specific point
- "neutral" — you're providing information without taking a strong position

== COUNCIL MEMBERS ==
You are seated with these other experts:
{for each other agent: "- Seat {N}: {title} — {expertise}"}

== WHAT'S BEEN SAID SO FAR ==
{conversation_history}

== OUTPUT FORMAT ==
Respond ONLY with valid JSON:
{
  "arguments": [
    {
      "id": "{prefix}1",
      "type": "claim|rebuttal|concession|question|build_on",
      "stance": "supportive|critical|mixed|neutral",
      "targets": [],
      "claim": "Your main point in one sentence",
      "grounds": "Evidence or reasoning",
      "warrant": "Why this evidence matters",
      "backing": "What supports your reasoning",
      "qualifier": "Conditions or limitations",
      "confidence": 8
    }
  ],
  "summary": "2-3 paragraph natural prose version of your contribution this round"
}
```

### Final Position Prompt (end of deliberation)
```
The council deliberation is complete. You've heard all perspectives.

Now give your final position statement as {identity.title}.

Be honest and specific:
1. Your overall stance: supportive, critical, mixed, or uncertain
2. Your confidence level (0-10)
3. A 2-3 sentence summary of where you stand and why
4. Your top concerns (even if overall supportive)
5. Your top reasons for support (even if overall critical)
6. What specific evidence or data would change your mind

Respond as JSON:
{
  "overall_stance": "supportive|critical|mixed|uncertain",
  "confidence": 7,
  "position_summary": "...",
  "key_concerns": [
    {"concern": "...", "severity": "high|medium|low"}
  ],
  "key_supports": [
    {"point": "...", "confidence": 8}
  ],
  "would_change_mind": "..."
}
```

---

## Synthesizer Changes

### Current Synthesis (v2)
Organized as: arguments_for, arguments_against, areas_of_agreement

### New Synthesis (v3) — Theme-Based
The synthesizer identifies themes that emerged from the discussion, then shows
how different council members weighed in on each theme.

```json
{
  "synthesis": {
    "bottom_line": "One-paragraph executive summary of what the council's deliberation revealed",
    "confidence_level": "high|moderate|low|uncertain",

    "themes": [
      {
        "theme": "Valuation Risk",
        "summary": "What the council collectively thinks about this dimension",
        "perspectives": [
          {
            "agent_title": "Hedge Fund Analyst",
            "agent_prefix": "A",
            "stance": "critical",
            "view": "P/E of 65x is historically stretched and unsustainable",
            "confidence": 8
          },
          {
            "agent_title": "VC Partner",
            "agent_prefix": "B",
            "stance": "mixed",
            "view": "High P/E is justified by growth rate, but only if growth sustains",
            "confidence": 6
          }
        ],
        "consensus_level": "low",
        "key_tension": "Whether current growth rates justify premium multiples"
      },
      {
        "theme": "Technology Moat",
        "summary": "...",
        "perspectives": [...],
        "consensus_level": "high",
        "key_tension": null
      }
    ],

    "council_consensus": [
      "Points where all or most council members agreed"
    ],

    "major_disagreements": [
      {
        "topic": "What they disagree about",
        "camps": [
          {"agents": ["A", "C"], "position": "..."},
          {"agents": ["B", "D"], "position": "..."}
        ],
        "why_unresolvable": "What makes this a genuine disagreement, not just missing info"
      }
    ],

    "individual_positions": [
      {
        "agent_prefix": "A",
        "agent_title": "Hedge Fund Analyst",
        "overall_stance": "critical",
        "confidence": 7,
        "position_summary": "...",
        "key_concerns": [...],
        "key_supports": [...],
        "would_change_mind": "..."
      }
    ],

    "blind_spots": [
      "Important dimensions the council didn't adequately address"
    ],

    "key_insights": [
      "Non-obvious insights that emerged from the cross-pollination of perspectives"
    ],

    "open_questions": [
      "Questions raised during deliberation that remain unanswered"
    ],

    "nuanced_conclusion": "3-4 paragraph balanced conclusion organized by themes, acknowledging where the council agreed, where they disagreed, and what a decision-maker should focus on"
  }
}
```

### Synthesizer Prompt (New)
```
You are an expert analyst synthesizing a council deliberation. Multiple experts
with different perspectives discussed a topic. Your job is to produce a
theme-based synthesis — NOT pick a winner, but organize the council's collective
intelligence into actionable insight.

TOPIC: {topic}
CONTEXT: {context}

COUNCIL MEMBERS:
{for each agent: "- {prefix}: {title} | Expertise: {expertise} | Priorities: {priorities}"}

INDIVIDUAL FINAL POSITIONS:
{for each agent: their final position statement}

== YOUR TASK ==
1. Identify the 3-6 key THEMES that emerged from the deliberation
   (e.g., "Valuation Risk", "Technology Moat", "Competitive Dynamics")
2. For each theme, summarize how each council member weighed in
3. Rate consensus level per theme (high/medium/low)
4. Identify where the council agreed and where they genuinely disagreed
5. Note blind spots — important angles nobody raised
6. Produce a nuanced conclusion organized by themes

== CRITICAL RULES ==
- Organize by THEME, not by agent
- Don't just list what each person said — synthesize across perspectives
- Highlight when experts from different domains agree (high signal)
- Highlight when experts from the same domain disagree (interesting tension)
- Be specific about confidence levels and conditions
- The output should help a decision-maker think through the decision, not make it for them
```

---

## Identity Generation Changes

### Current
Generates pro/con pairs: "Give me 2 agents FOR and 2 agents AGAINST"

### New
Generates a diverse council: "Give me 4 experts who would bring different,
complementary perspectives to this topic"

```
POST /api/identities/generate
Body: {
    "topic": "Is NVIDIA a good investment?",
    "context": "Portfolio allocation decision for a tech-focused fund",
    "council_size": 4
}
Response: {
    "council": [
        {
            "title": "Semiconductor Equity Analyst",
            "expertise": "Chip industry dynamics, supply chain analysis, competitive benchmarking",
            "priorities": "Revenue sustainability, market share trends, technology roadmap viability",
            "style": "Quantitative, focuses on unit economics and TAM modeling",
            "background": "Covers the semiconductor sector for a top-10 sell-side firm, published research on GPU market dynamics"
        },
        {
            "title": "Macro Risk Strategist",
            "expertise": "Market cycles, systemic risk assessment, liquidity analysis",
            "priorities": "Identifying crowded trades, correlation risk, tail event scenarios",
            "style": "Contrarian, stress-tests consensus views, references historical parallels",
            "background": "Managed risk for a $50B pension fund through the 2022 tech correction"
        },
        {
            "title": "AI Infrastructure CTO",
            "expertise": "GPU compute architecture, ML training infrastructure, cloud deployment",
            "priorities": "Performance per dollar, vendor lock-in risk, technology obsolescence",
            "style": "Technical depth, evaluates claims against engineering reality",
            "background": "Built and scaled AI training clusters, deep knowledge of CUDA vs alternatives"
        },
        {
            "title": "Growth Equity Portfolio Manager",
            "expertise": "Growth investing, position sizing, portfolio construction",
            "priorities": "Risk-adjusted returns, entry price discipline, catalyst identification",
            "style": "Pragmatic, balances conviction with portfolio discipline",
            "background": "Manages a $2B growth equity portfolio, owns AI names across the stack"
        }
    ]
}
```

The generation prompt instructs Claude:
- Agents should bring DIFFERENT angles (not all financial, not all technical)
- At least one agent should be naturally skeptical/risk-focused
- At least one should have deep domain expertise in the topic area
- Perspectives should create productive tension when combined
- Avoid redundancy — each seat should unlock a unique dimension of analysis

---

## Frontend Changes

### HomePage Redesign

**Remove:**
- Panel size selector (1v1, 2v2, etc.)
- Pro/Con column layout for agent setup

**Replace with:**
- Council size slider or buttons: 2, 3, 4, 5, 6 members (default: 4)
- Single list of agent slots (not two columns)
- Each slot has the same three modes: Auto-generate, From Library, Manual
- "Auto-Generate Council" button generates all agents at once with diverse perspectives
- Agent cards don't show a side — just seat number and identity

```
┌─────────────────────────────────────────────────────────────┐
│  Council Setup                                               │
│                                                              │
│  Council size:  [2]  [3]  [4]  [5]  [6]                    │
│                                                              │
│  ┌─ Seat 1 ─────────────────────────────────────────────┐   │
│  │ Semiconductor Equity Analyst                          │   │
│  │ Chip industry dynamics, competitive benchmarking      │   │
│  │ [Auto] [Library] [Manual]    [🗑️ Remove]              │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Seat 2 ─────────────────────────────────────────────┐   │
│  │ Macro Risk Strategist                                 │   │
│  │ Market cycles, systemic risk assessment               │   │
│  │ [Auto] [Library] [Manual]    [🗑️ Remove]              │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Seat 3 ─────────────────────────────────────────────┐   │
│  │ (empty — click to configure)                          │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  [✨ Auto-Generate Council]                                  │
│  [🚀 Start Deliberation]                                     │
└─────────────────────────────────────────────────────────────┘
```

### LiveViewer Redesign

**Remove:**
- Split-panel Pro (left) vs Con (right) layout

**Replace with:**
- Single-column conversation thread (like a meeting transcript)
- Each argument is an "utterance" from a council member
- Agent avatar/badge on the left (color-coded by seat, not by side)
- Stance indicator on each argument: 👍 supportive, 👎 critical, ↔️ mixed, ➖ neutral
- Round dividers between rounds
- Reference links when an agent responds to another ("responding to Agent B's point about...")

```
┌─────────────────────────────────────────────────────────────┐
│  Round 1: Opening Perspectives                               │
│                                                              │
│  ┌─ A · Semiconductor Analyst ──────────────────────────┐   │
│  │ 👎 critical · confidence: 8/10                        │   │
│  │ "NVIDIA's P/E of 65x is stretched by historical..."  │   │
│  │ [Expand Toulmin details]                              │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ B · Macro Risk Strategist ──────────────────────────┐   │
│  │ 👎 critical · confidence: 7/10                        │   │
│  │ "The crowded trade dynamics remind me of..."          │   │
│  │ [Expand Toulmin details]                              │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ C · AI Infrastructure CTO ─────────────────────────┐   │
│  │ ↔️ mixed · confidence: 6/10                           │   │
│  │ "The CUDA moat is real BUT commoditization risk..."   │   │
│  │ [Expand Toulmin details]                              │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ D · Growth Equity PM ──────────────────────────────┐   │
│  │ 👍 supportive · confidence: 7/10                      │   │
│  │ "At current levels, risk/reward favors a smaller..."  │   │
│  │ [Expand Toulmin details]                              │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ─── Round 2: Discussion & Response ─────────────────────   │
│  ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

### AnalysisDashboard Redesign

**Tab 1: "Synthesis" (default)**
- Bottom line text
- Confidence level badge
- Nuanced conclusion

**Tab 2: "Themes"** (NEW — replaces "Arguments For & Against")
- Each theme as an expandable card
- Inside each theme card:
  - Summary of the theme
  - How each agent weighed in (with stance badges and confidence)
  - Consensus level indicator (high=green, medium=yellow, low=red)
  - Key tension if consensus is low

**Tab 3: "Council Positions"** (NEW — replaces nothing, this is new)
- Grid of agent cards
- Each card shows:
  - Agent title and expertise
  - Overall stance badge (supportive/critical/mixed/uncertain)
  - Confidence score (large number)
  - Position summary text
  - Key concerns (even if supportive)
  - Key supports (even if critical)
  - "Would change mind if..." section

**Tab 4: "Consensus & Gaps"** (updated from "Consensus & Tensions")
- Council consensus points (green cards with checkmarks)
- Major disagreements (amber cards showing which agents disagree and why)
- Blind spots (red/gray cards — things nobody addressed)
- Open questions (gray cards)

**Tab 5: "Insights"** (same as current)
- Key insights
- Open questions

---

## Deliberation Format Presets

Replacing the debate formats with deliberation formats:

```json
[
  {
    "name": "quick_take",
    "description": "Single round — each member shares their initial perspective",
    "rounds": [
      {"type": "opening", "word_limit": 500}
    ]
  },
  {
    "name": "standard",
    "description": "Three rounds — perspectives, discussion, final positions",
    "rounds": [
      {"type": "opening", "word_limit": 600},
      {"type": "discussion", "word_limit": 500},
      {"type": "closing", "word_limit": 400}
    ]
  },
  {
    "name": "deep_dive",
    "description": "Five rounds — thorough exploration with extended discussion",
    "rounds": [
      {"type": "opening", "word_limit": 600},
      {"type": "discussion", "word_limit": 500},
      {"type": "exploration", "word_limit": 500},
      {"type": "discussion", "word_limit": 500},
      {"type": "closing", "word_limit": 400}
    ]
  },
  {
    "name": "rapid_assessment",
    "description": "Two rounds — perspectives and quick responses",
    "rounds": [
      {"type": "opening", "word_limit": 400},
      {"type": "discussion", "word_limit": 400}
    ]
  }
]
```

Note: All formats end with a mandatory "final positions" phase (not counted as a round)
where each agent gives their position statement. This happens automatically after the
last round regardless of format.

---

## API Changes

### Modified Endpoints

```
POST /api/debates
  Body changes:
  - Remove: panel_config, agents.pro, agents.con
  - Add: council_size (int, 2-6)
  - Add: agents.council (list of agent identities, no side assignment)

POST /api/identities/generate
  Body changes:
  - Remove: pro_count, con_count
  - Add: council_size (int, 2-6)
  Response changes:
  - Remove: {pro: [...], con: [...]}
  - Add: {council: [...]}

GET /api/debates/{id}
  Response changes:
  - agents no longer have "side" field
  - agents have "seat_number" instead
  - arguments have "stance" instead of "agent_side"

GET /api/debates/{id}/analysis
  Response changes:
  - New synthesis format (themes, individual_positions, council_consensus, etc.)
```

### New Endpoints

```
GET /api/debates/{id}/positions
  Returns all agents' final position statements for a completed deliberation
```

---

## Backend Implementation Steps

```
Step  Task                                                    Time    Effort
──────────────────────────────────────────────────────────────────────────────
 1    Update models.py — schema changes                        30 min  medium
      - Add council_size to debates
      - Remove side from debate_agents, add seat_number
      - Remove agent_side from arguments, add stance
      - Create agent_positions table
      - Handle DB migration (recreate tables for prototype)

 2    Update schemas.py — new request/response models          20 min  medium
      - CreateDeliberationRequest (replaces CreateDebateRequest)
      - CouncilMemberResponse (replaces agent with side)
      - StanceType enum
      - AgentPositionResponse
      - ThemeAnalysis, SynthesisResponse (new format)

 3    Update identity_generator.py — council generation        30 min  medium
      - New prompt: generate diverse council, not pro/con pairs
      - Returns {council: [...]} not {pro: [...], con: [...]}

 4    Update agent.py — council member prompts                 45 min  high
      - Remove all pro/con language
      - New system prompt: independent perspective, stance labels
      - Add final position method
      - Sequential turns: each agent sees all prior conversation

 5    Update debate_engine.py — council orchestration          45 min  high
      - Remove pro/con panel logic
      - All agents in one list, speak in seat order each round
      - Add reflection/position phase after final round
      - Update SSE events

 6    Update judge.py — theme-based synthesis                  45 min  high
      - New prompt: identify themes, map perspectives to themes
      - New output format: themes, council_consensus, disagreements
      - Include individual position statements

 7    Update routes/debates.py — API changes                   30 min  medium
      - Adapt create endpoint for council format
      - Add GET positions endpoint
      - Update analysis endpoint for new synthesis format

 8    Update routes/identities.py                              15 min  medium
      - Accept council_size instead of pro_count/con_count

 9    Update routes/formats.py — new format presets            10 min  medium
      - Replace debate formats with deliberation formats

10    Update frontend HomePage — council setup                 45 min  high
      - Remove pro/con columns
      - Single list of agent slots
      - Council size selector
      - Update auto-generate to use new API

11    Update frontend LiveViewer — conversation thread         45 min  high
      - Remove split panel
      - Single column thread layout
      - Stance badges on each argument
      - Agent color coding by seat

12    Update frontend AnalysisDashboard — theme-based          60 min  high
      - Themes tab with perspective cards
      - Council Positions tab with stance cards
      - Update Consensus & Gaps tab

13    Update frontend DebatePage — wire it all together        30 min  medium
      - Handle new SSE events
      - Display final positions
      - Update verdict/synthesis banner

14    Update CLAUDE.md, README, ROADMAP                        20 min  medium
      - Reflect v3 council architecture

15    Build, deploy, test end-to-end                           30 min  medium
      - Full council deliberation test
      - Verify themes, positions, synthesis

──────────────────────────────────────────────────────────────────────────────
                                                      TOTAL:  ~8 hours
```

---

## What Gets Deleted vs Modified vs Kept

### Deleted
- Pro/Con panel logic in debate_engine.py
- Pro/Con column layout in AgentSetup.jsx
- Split-panel LiveViewer layout
- "Arguments For / Arguments Against" tab in AnalysisDashboard
- Side-based argument prefix assignment (A,C,E for pro / B,D,F for con)
- PanelAnalysis.jsx component (no more panels)
- ScoreComparison.jsx (no more side-vs-side scores)

### Heavily Modified
- agent.py — completely new prompt structure
- judge.py — completely new synthesis prompt and output format
- debate_engine.py — single council loop instead of pro/con panels
- identity_generator.py — council generation instead of pro/con pairs
- schemas.py — new request/response models
- HomePage.jsx — council setup instead of pro/con setup
- LiveViewer.jsx — conversation thread instead of split panel
- AnalysisDashboard.jsx — themes instead of for/against
- AgentSetup.jsx — single list instead of two columns
- IdentityCard.jsx — remove side coloring
- ArgumentCard.jsx — stance badges instead of side borders

### Kept As-Is
- All infrastructure (Docker, Postgres, Redis, Nginx)
- config.py, database.py, auth.py, events.py
- routes/auth.py, routes/personas.py
- GatePage.jsx, PersonaLibraryPage.jsx
- useDebateStream.js (just update event names)
- api.js
- HistoryPage.jsx (minor updates to remove verdict/winner display)
- seed_personas.py (personas work the same)
- FallacyBadge.jsx, ToulminBreakdown.jsx (Toulmin still used)

---

## Backward Compatibility

Old v1/v2 debates stored in the DB will have `side` data and verdict-format analysis.
To handle this:
- Keep `side` column in debate_agents but make it nullable (null = council member)
- Keep `agent_side` in arguments but make it nullable
- Frontend checks: if debate has `panel_config`, render old split-panel view
- If debate has `council_size`, render new thread view
- Synthesizer output detected by presence of `themes` key (v3) vs `arguments_for` (v2) vs `verdict` (v1)

---

## Color Scheme for Council

Instead of blue (pro) vs red (con), each seat gets a distinct color:

```
Seat 1 (A): Blue      #3B82F6
Seat 2 (B): Amber     #F59E0B
Seat 3 (C): Emerald   #10B981
Seat 4 (D): Purple    #8B5CF6
Seat 5 (E): Rose      #F43F5E
Seat 6 (F): Cyan      #06B6D4
```

Used for: agent badges, argument card accents, chart colors, position cards.

---

## Estimated Cost Per Deliberation

```
                     4-agent    4-agent    6-agent    6-agent
                     Quick      Standard   Quick      Deep Dive
                     (1 rnd)    (3 rnds)   (1 rnd)    (5 rnds)
Agent calls           4          12         6          30
Position calls        4           4         6           6
Synthesizer           1           1         1           1
────────────────────────────────────────────────────────────
Total API calls       9          17        13          37
Est. cost           ~$0.25      ~$0.50    ~$0.35      ~$1.00
```

Still very affordable. The position phase adds one call per agent but they're
small (100-200 tokens output each).
