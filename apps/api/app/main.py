from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import songs, lyrics

app = FastAPI(title="Songtext API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(songs.router)
app.include_router(lyrics.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
