# DebateForge

An AI-powered dialectical exploration platform where Claude agents explore both sides of a topic as truth-seekers through configurable formats, then a synthesizer produces balanced insight including areas of agreement, unresolved tensions, and actionable recommendations.

## Features

- **AI-vs-AI dialectical exploration** — Agents argue honestly, concede when evidence is stronger, and rate their own confidence
- **Configurable formats** — Opening, rebuttal, cross-examination, and closing rounds with adjustable word limits
- **Panel support** — 1v1 up to 4v4 debates with distinct agent identities per side
- **Toulmin-structured arguments** — Each argument includes claim, grounds, warrant, backing, qualifier, and self-assessed confidence
- **Identity generation** — Auto-generate contextually relevant agent identities with Claude
- **Persona library** — Save, browse, and reuse agent personas across debates (8 seed templates included)
- **Real-time streaming** — Watch debates unfold live via Server-Sent Events
- **Synthesis report** — Bottom line assessment, key arguments for and against, areas of agreement, unresolved tensions, key insights, and evidence gaps

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Node.js](https://nodejs.org/) 20+
- [Nginx](https://nginx.org/)
- An [Anthropic API key](https://console.anthropic.com/)

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/svmaks96-create/DebateForge.git
cd DebateForge
```

### 2. Create `.env`

```bash
cp /dev/null .env
```

Add the following (replace placeholder values):

```env
ANTHROPIC_API_KEY=your-key-here
INVITE_CODE=debateforge-2026
JWT_SECRET=run-openssl-rand-hex-32
```

Generate a secure `JWT_SECRET`:

```bash
openssl rand -hex 32
```

### 3. Start the backend

```bash
docker compose up -d --build
```

This launches PostgreSQL 16, Redis 7, and the FastAPI backend.

### 4. Build the frontend

```bash
cd frontend
npm install
npm run build
```

### 5. Deploy frontend to Nginx

```bash
sudo mkdir -p /var/www/debateforge
sudo cp -r dist/* /var/www/debateforge/
```

### 6. Configure Nginx

Save the following to `/etc/nginx/sites-available/debateforge`:

```nginx
server {
    listen 8080;
    server_name _;

    root /var/www/debateforge;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        chunked_transfer_encoding off;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable the site and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/debateforge /etc/nginx/sites-enabled/debateforge
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Open firewall port

```bash
sudo ufw allow 8080/tcp
```

### 8. Visit the app

Open `http://your-server-ip:8080` in your browser.

## Local Development

For development without Nginx:

```bash
# Terminal 1 — start backend + databases
docker compose up -d --build

# Terminal 2 — start frontend dev server
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` — Vite proxies `/api` requests to the backend at `localhost:8000`.

## Tech Stack

| Component       | Technology                  |
| --------------- | --------------------------- |
| Backend         | FastAPI (Python 3.13)       |
| Frontend        | React 18 + Tailwind CSS     |
| Database        | PostgreSQL 16               |
| Cache / PubSub  | Redis 7                     |
| AI              | Claude API (Sonnet 4)       |
| Auth            | Invite code + JWT cookie    |
| Reverse Proxy   | Nginx                       |
| Containerization| Docker + Docker Compose     |

## Project Structure

```
debateforge/
├── .env                        # API key, invite code, JWT secret
├── docker-compose.yml          # PostgreSQL + Redis + API containers
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                 # FastAPI app entrypoint
│   ├── config.py               # Settings from env vars
│   ├── auth.py                 # Invite code + JWT auth
│   ├── database.py             # SQLAlchemy async engine
│   ├── models.py               # ORM models (6 tables)
│   ├── schemas.py              # Pydantic request/response models
│   ├── debate_engine.py        # Orchestrator: rounds + turns
│   ├── agent.py                # Claude debating agent
│   ├── judge.py                # Claude synthesizer (balanced insight, not winner-picking)
│   ├── identity_generator.py   # Claude-powered identity generation
│   ├── events.py               # Redis pub/sub for SSE
│   ├── seed_personas.py        # 8 seed persona templates
│   └── routes/
│       ├── auth.py             # POST /api/auth/verify
│       ├── debates.py          # Debate CRUD + start + stream
│       ├── formats.py          # GET /api/formats
│       ├── identities.py       # POST /api/identities/generate
│       └── personas.py         # Persona CRUD
└── frontend/
    ├── package.json
    └── src/
        ├── App.jsx             # Router + layout
        ├── api.js              # Axios instance with auth
        ├── pages/              # Gate, Home, Debate, History, Personas
        ├── components/         # LiveViewer, ArgumentCard, AnalysisDashboard, etc.
        └── hooks/
            └── useDebateStream.js
```

## Default Invite Code

The default invite code is `debateforge-2026`. Change it by updating the `INVITE_CODE` value in your `.env` file and restarting the backend:

```bash
docker compose restart api
```
