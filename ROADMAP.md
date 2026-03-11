# DebateForge — Feature Roadmap

> Last updated: March 2026
> Status: v1 prototype deployed and working

---

## Current State (v1 — Shipped)

- AI-vs-AI structured debates with configurable formats
- Panel format (1v1 up to 4v4) with distinct agent identities
- Auto-generated or manual identities, with persona library
- Full Toulmin-model judge analysis (fallacy detection, dependency mapping, evidence quality, scoring)
- Real-time SSE streaming of debates
- React frontend: gate, launcher, live viewer, analysis dashboard, history, persona library
- Deployed on VPS at http://<IP>:8080, behind invite code auth

---

## Priority 1: Evidence Mode (Web Search + Citations)

**The big idea:** Agents don't just reason — they research. Each agent can search the web for real
data, studies, and sources to back their arguments. The judge then evaluates whether citations
are real, relevant, and correctly interpreted.

### How It Works

1. **Agent gets web search tool access**
   - Use Claude's tool_use feature to give debating agents a web search tool
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

3. **Judge evaluates citations**
   - Are citations real and accessible?
   - Do they actually support the claim made?
   - Are they recent enough to be relevant?
   - Are they authoritative sources (peer-reviewed > blog post > reddit comment)?
   - Is the agent cherry-picking or fairly representing the source?
   - New judge output field: `citation_analysis` per argument

4. **Frontend changes**
   - Citations appear as clickable links in ArgumentCard
   - Expandable "Sources" section per argument
   - Judge analysis shows citation quality scores
   - New icon/badge for arguments that are evidence-backed vs purely logical

### Implementation Plan

**Backend changes:**
- Update `agent.py` to use Claude's tool_use with a web search tool
- Define a search tool schema: `{"name": "web_search", "description": "Search the web for evidence", "input_schema": {"query": "string"}}`
- Implement the actual search backend (options: Brave Search API, Tavily API, or SerpAPI)
- Update argument schema to include `citations` JSONB field
- Update judge prompt to evaluate citation quality
- New DB column: `arguments.citations JSONB`

**Frontend changes:**
- Update ArgumentCard to show citations
- Add citation quality indicators in AnalysisDashboard
- Source preview on hover (title, snippet, source type)

**API cost impact:**
- Each agent call may trigger 1-3 web searches
- Search API costs (~$0.003-0.01 per search via Brave/Tavily)
- Total additional cost per debate: ~$0.05-0.20

**Estimated effort:** 6-8 hours

---

## Priority 2: Quick Wins & Polish

### Export Debates as PDF
- Add `GET /api/debates/{id}/export?format=pdf` endpoint
- Generate a clean report: topic, agents, all arguments, judge analysis, verdict
- Use WeasyPrint or reportlab in Python
- Add "Export PDF" button on DebatePage
- **Effort:** 2-3 hours

### Markdown Rendering in Arguments
- Install react-markdown in frontend
- Render argument summaries and claims as markdown
- Agents sometimes use bold, lists, headers that currently show as raw text
- **Effort:** 30 minutes

### Mobile Responsive Layout
- The split-panel LiveViewer doesn't work well on small screens
- Switch to stacked layout (pro above con) on mobile
- Collapsible argument cards on mobile
- **Effort:** 2 hours

### Debate Templates
- Save a topic + format + agents combo as a reusable template
- New DB table: `debate_templates`
- "Save as Template" button on completed debates
- Template picker on HomePage alongside format selector
- **Effort:** 2-3 hours

### Dark/Light Theme Toggle
- CSS variables for all colors, toggle switches between two sets
- Persist preference in localStorage
- **Effort:** 1-2 hours

---

## Priority 3: Meaningful Upgrades

### Human-vs-AI Mode
- User argues one side, AI argues the other
- DebatePage gets a text input for the human's turn
- Debate engine waits for human input between AI turns
- Judge evaluates both human and AI arguments equally
- WebSocket may be needed (SSE is server→client only)
- **Effort:** 8-10 hours

### Argument Graph Visualization (D3)
- Force-directed graph of all arguments
- Nodes = arguments, sized by strength, colored by side
- Edges = rebuttals (red), supports (green), depends-on (gray)
- Click node → shows Toulmin breakdown
- Zoom, pan, hover for details
- **Effort:** 4-6 hours

### Debate Comparison Mode
- Run same topic with different formats, agents, or panel sizes
- Side-by-side results view: did the verdict change? Which arguments appeared in one but not the other?
- Useful for testing decision robustness
- **Effort:** 4-5 hours

### Better Judge Calibration
- Run the judge 3 times per debate with slightly varied prompts
- Average the scores for more reliable verdicts
- Show confidence intervals on scores
- Cost: 3x judge calls (~$0.10-0.20 extra per debate)
- **Effort:** 2-3 hours

### Real-Time Cost Counter
- Track token usage per Claude API call
- Display running cost estimate in the UI during debate
- Show total cost on completed debate page
- Store token counts in DB for analytics
- **Effort:** 2-3 hours

---

## Priority 4: Ambitious Expansions

### Slack/Teams Integration
- Slash command: `/debateforge "Should we adopt K8s?" --format oxford --agents auto`
- Bot posts live updates to a thread
- Link to full analysis on web UI
- Uses Slack Bot API or Teams webhook
- **Effort:** 1-2 days

### Human Intervention Mid-Debate
- "Inject Argument" button during live debate
- Human writes an argument, agents must respond to it in next round
- Combines human insight with AI thoroughness
- **Effort:** 6-8 hours

### Tournament Mode
- Define N topics, run debates bracket-style
- Semi-finals, finals — each round's winner advances
- Leaderboard of most contentious / most decisive topics
- Fun for team offsites
- **Effort:** 1-2 days

### Domain-Specific Presets
- "Technical Architecture Decision" — auto-picks engineering personas, uses Deep Dive format
- "Hiring Decision" — HR, hiring manager, team lead personas
- "Investment Decision" — CFO, analyst, risk officer personas
- Each preset configures format + agents + custom judge criteria
- **Effort:** 3-4 hours

### Fine-Tuned Scoring Model
- Collect judge outputs over time as training data
- Train a lightweight classifier for faster/cheaper argument scoring
- Use Claude only for complex analysis, lightweight model for scoring
- **Effort:** Multi-week research project

---

## Suggested Build Order

If continuing development:

1. Markdown rendering (30 min) — immediate visual improvement
2. Export as PDF (2-3 hrs) — most requested by stakeholders
3. Evidence mode (6-8 hrs) — the big differentiator
4. Mobile responsive (2 hrs) — accessibility
5. Argument graph D3 (4-6 hrs) — wow factor
6. Human-vs-AI mode (8-10 hrs) — engagement
7. Debate comparison (4-5 hrs) — decision robustness
8. Slack integration (1-2 days) — adoption driver
