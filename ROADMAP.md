# DebateForge — Feature Roadmap

> Last updated: March 14, 2026
> Status: v3 council deliberation platform deployed with Evidence Mode + Adversarial Verification

> **For remaining quality upgrades (Position Evolution, Decision Frameworks), see QUALITY_UPGRADES_PLAN.md**

---

## Current State (v3 — Council Deliberation)

- AI council deliberation: 2-6 independent expert agents discuss a topic
- Agents form positions from their identity, expertise, and priorities — no assigned sides
- Per-argument stance labels: supportive, critical, mixed, neutral
- Self-assessed confidence scoring (0-10) per argument
- Structured Toulmin-model arguments
- Final position statements from each agent after discussion rounds
- Theme-based synthesis: themes with perspectives, consensus levels, key tensions, blind spots, insights
- Deliberation formats: quick_take, rapid_assessment, standard, deep_dive
- Auto-generated or manual council members, with persona library
- Real-time SSE streaming of deliberations
- **Evidence Mode**: agents search the web (Tavily API) and cite real sources in arguments (optional, per-debate toggle)
- **Adversarial Verification**: independent fact-checker agent (Haiku) verifies claims and finds blind spots after deliberation (optional, per-debate toggle)
- **Cost optimization**: conditional prompts (no evidence/verification instructions when disabled), Haiku for cheap tasks, truncated JSON repair
- React frontend: gate, launcher, live viewer (conversation thread), analysis dashboard (5 tabs), history, persona library
- Deployed on VPS at http://<IP>:8080, behind invite code auth

---

## ~~Priority 1: Evidence Mode (Web Search + Citations)~~ ✅ COMPLETED

Implemented. Agents use Claude tool_use with Tavily web search API. Max 3 searches per agent per round, cached in Redis (1hr TTL). Citations stored as JSONB on arguments table. Synthesizer evaluates citation quality (conditionally, only when enable_search=True). Toggle: `enable_search` per debate.

---

## ~~Priority 1.5: Adversarial Verification~~ ✅ COMPLETED

Implemented. After reflecting phase, a Haiku-based verification agent independently fact-checks claims using web search. Produces structured report: verified_claims, shared_blind_spots, missing_perspectives, logical_gaps. Synthesizer incorporates findings (conditionally, only when enable_verification=True). Toggle: `enable_verification` per debate.

---

## Priority 2: Quick Wins & Polish

### Export Deliberations as PDF
- Add `GET /api/debates/{id}/export?format=pdf` endpoint
- Generate a clean report: topic, council members, all arguments, synthesis analysis
- Use WeasyPrint or reportlab in Python
- Add "Export PDF" button on DebatePage
- **Effort:** 2-3 hours

### Markdown Rendering in Arguments
- Install react-markdown in frontend
- Render argument summaries and claims as markdown
- Agents sometimes use bold, lists, headers that currently show as raw text
- **Effort:** 30 minutes

### Mobile Responsive Layout
- Conversation thread layout already works better on mobile than split-panel
- Collapsible argument cards on mobile
- **Effort:** 1-2 hours

### Deliberation Templates
- Save a topic + format + council combo as a reusable template
- New DB table: `deliberation_templates`
- "Save as Template" button on completed deliberations
- Template picker on HomePage alongside format selector
- **Effort:** 2-3 hours

### Dark/Light Theme Toggle
- CSS variables for all colors, toggle switches between two sets
- Persist preference in localStorage
- **Effort:** 1-2 hours

---

## Priority 3: Meaningful Upgrades

### Human-in-the-Council Mode
- User joins as a council member alongside AI agents
- DebatePage gets a text input for the human's turn
- Deliberation engine waits for human input between AI turns
- Synthesizer evaluates all council members equally
- WebSocket may be needed (SSE is server→client only)
- **Effort:** 8-10 hours

### Argument Graph Visualization (D3)
- Force-directed graph of all arguments
- Nodes = arguments, sized by confidence, colored by agent
- Edges = rebuttals (red), supports (green), builds-on (blue)
- Click node → shows Toulmin breakdown
- Zoom, pan, hover for details
- **Effort:** 4-6 hours

### Deliberation Comparison Mode
- Run same topic with different formats, council compositions, or sizes
- Side-by-side results view: did the synthesis change? Which themes appeared in one but not the other?
- Useful for testing decision robustness
- **Effort:** 4-5 hours

### Real-Time Cost Counter
- Track token usage per Claude API call
- Display running cost estimate in the UI during deliberation
- Show total cost on completed deliberation page
- Store token counts in DB for analytics
- **Effort:** 2-3 hours

---

## Priority 4: Ambitious Expansions

### Slack/Teams Integration
- Slash command: `/debateforge "Should we adopt K8s?" --format standard --council 4`
- Bot posts live updates to a thread
- Link to full analysis on web UI
- Uses Slack Bot API or Teams webhook
- **Effort:** 1-2 days

### Human Intervention Mid-Deliberation
- "Inject Argument" button during live deliberation
- Human writes an argument, agents must respond to it in next round
- Combines human insight with AI thoroughness
- **Effort:** 6-8 hours

### Multi-Topic Council Sessions
- Define N related topics, council discusses each in sequence
- Cross-topic synthesis: patterns, contradictions, overarching themes
- Useful for strategic planning sessions
- **Effort:** 1-2 days

### Fine-Tuned Scoring Model
- Collect synthesizer outputs over time as training data
- Train a lightweight classifier for faster/cheaper argument scoring
- Use Claude only for complex analysis, lightweight model for scoring
- **Effort:** Multi-week research project

---

## Suggested Build Order

If continuing development:

1. ~~Evidence Mode~~ ✅
2. ~~Adversarial Verification~~ ✅
3. Remaining quality upgrades (8-10 hrs) — see QUALITY_UPGRADES_PLAN.md
   a. Position Evolution Tracking (4-5 hrs) — confidence timeline + reflections
   b. Decision Framework Templates (4-5 hrs) — zero API cost, immediate UX improvement
4. Markdown rendering (30 min) — immediate visual improvement
5. Export as PDF (2-3 hrs) — most requested by stakeholders
6. Mobile responsive (1-2 hrs) — accessibility
7. Argument graph D3 (4-6 hrs) — wow factor
8. Human-in-the-council mode (8-10 hrs) — engagement
9. Deliberation comparison (4-5 hrs) — decision robustness
10. Slack integration (1-2 days) — adoption driver
