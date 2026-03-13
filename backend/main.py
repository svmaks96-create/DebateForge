import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, async_session, engine
import models  # noqa: F401 — registers all tables on Base.metadata
from routes.auth import router as auth_router
from routes.debates import router as debates_router
from routes.formats import router as formats_router
from routes.identities import router as identities_router
from routes.personas import router as personas_router
from seed_personas import seed_template_personas


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger = logging.getLogger("uvicorn.error")
    logger.info("Database tables verified")

    async with async_session() as session:
        await seed_template_personas(session)

    yield


app = FastAPI(title="DebateForge API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(debates_router)
app.include_router(formats_router)
app.include_router(identities_router)
app.include_router(personas_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "debateforge"}
