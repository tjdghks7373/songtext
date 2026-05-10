from __future__ import annotations

from fastapi import APIRouter, HTTPException
from app.services import genius, llm
from app.models.schemas import SongOverview
from app.core.database import get_db

router = APIRouter(prefix="/api/songs", tags=["songs"])


@router.get("/search")
async def search(title: str, artist: str) -> dict:
    try:
        result = await genius.search_song(title, artist)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Genius API 오류: {e}")

    if not result:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없음")

    return result


@router.get("/{song_id}/lyrics")
async def lyrics(song_id: int, song_url: str) -> dict:
    try:
        lines = await genius.get_lyrics_lines(song_url)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"가사 스크래핑 실패: {e}")

    if not lines:
        raise HTTPException(status_code=404, detail="가사를 찾을 수 없음")

    return {"song_id": song_id, "lines": lines, "total": len(lines)}


@router.get("/{song_id}/overview", response_model=SongOverview)
async def overview(
    song_id: int,
    title: str,
    artist: str,
    year: int | None = None,
    album: str | None = None,
    genre: str | None = None,
) -> SongOverview:
    db = get_db()

    cached = db.table("song_overviews").select("overview").eq("song_id", song_id).limit(1).execute()
    if cached.data:
        result = SongOverview(**cached.data[0]["overview"])
        result.cache_hit = True
        return result

    try:
        result = await llm.song_overview(title, artist, year, album, genre)
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    db.table("song_overviews").insert({
        "song_id": song_id,
        "overview": result.model_dump(exclude={"cache_hit"}),
        "model": "claude-sonnet-4-6",
    }).execute()

    return result
