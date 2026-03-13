# DebateForge — Feature Roadmap

> Last updated: March 2026
> Status: v3 council deliberation platform deployed and working

> **For the 4 priority analysis quality upgrades (Evidence Mode, Adversarial Verification,
> Position Evolution, Decision Frameworks), see QUALITY_UPGRADES_PLAN.md**

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
- React frontend: gate, launcher, live viewer (conversation thread), analysis dashboard (5 tabs), history, persona library
- Deployed on VPS at http://<IP>:8080, behind invite code auth

---

## Priority 1: Evidence Mode (Web Search + Citations)

**The big idea:** Agents don't just reason — they research. Each agent can search the web for real
data, studies, and sources to back their arguments. The synthesizer then evaluates whether citations
are real, relevant, and correctly interpreted.

### How It Works

1. **Agent gets web search tool access**
   - Use Claude's tool_use feature to give council agents a web search tool
   - Agent decides when to search based on what claim it's making
   - Agent cites sources inline: each argument's `backing` field includes URLs and source summaries

2. **Citation format in arguments**
   ```json
   {
     "id": "A1",
     "claim": "Remote workers are 13% more productive",
     "grounds": "Stanford study of 16,000 workers over 9 months",
     "backing": "Bloom et al., 2015, Stanford GSB",
     "citations": [
       {
         "url": "https://...",
         "title": "Does Working from Home Work?",
         "snippet": "We find that working from home led to a 13% performance increase...",
         "source_type": "academic_paper"
       }
     ]
   }
   ```

3. **Synthesizer evaluates citations**
   - Are citations real and accessible?
   - Do they actually support the claim made?
   - Are they recent enough to be relevant?
   - Are they authoritative sources (peer-reviewed > blog post > reddit comment)?
   - Is the agent cherry-picking or fairly representing the source?
   - New synthesizer output field: `citation_analysis` per argument

4. **Frontend changes**
   - Citations appear as clickable links in ArgumentCard
   - Expandable "Sources" section per argument
   - Synthesis shows citation quality scores
   - New icon/badge for arguments that are evidence-backed vs purely logical

### Implementation Plan

**Backend changes:**
- Update `agent.py` to use Claude's tool_use with a web search tool
- Define a search tool schema: `{"name": "web_search", "description": "Search the web for evidence", "input_schema": {"query": "string"}}`
- Implement the actual search backend (options: Brave Search API, Tavily API, or SerpAPI)
- Update argument schema to include `citations` JSONB field
- Update synthesizer prompt to evaluate citation quality
- New DB column: `arguments.citations JSONB`

**Frontend changes:**
- Update ArgumentCard to show citations
- Add citation quality indicators in AnalysisDashboard
- Source preview on hover (title, snippet, source type)

**API cost impact:**
- Each agent call may trigger 1-3 web searches
- Search API costs (~$0.003-0.01 per search via Brave/Tavily)
- Total additional cost per deliberation: ~$0.05-0.20

**Estimated effort:** 6-8 hours

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

1. Quality upgrades (18-23 hrs) — see QUALITY_UPGRADES_PLAN.md for detailed specs
   a. Decision Framework Templates (4-5 hrs) — zero API cost, immediate UX improvement
   b. Position Evolution Tracking (4-5 hrs) — confidence timeline + reflections
   c. Evidence Mode (6-8 hrs) — web search + citations, the big differentiator
   d. Adversarial Verification (4-5 hrs) — fact-checker agent, builds on evidence mode
2. Markdown rendering (30 min) — immediate visual improvement
3. Export as PDF (2-3 hrs) — most requested by stakeholders
4. Mobile responsive (1-2 hrs) — accessibility
5. Argument graph D3 (4-6 hrs) — wow factor
6. Human-in-the-council mode (8-10 hrs) — engagement
7. Deliberation comparison (4-5 hrs) — decision robustness
8. Slack integration (1-2 days) — adoption driver
