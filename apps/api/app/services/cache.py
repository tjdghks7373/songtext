from __future__ import annotations

import hashlib
import json
from app.models.schemas import LyricLineResponse
from app.core.database import get_db


def make_cache_key(song_title: str, artist: str, lyric_line: str) -> str:
    raw = f"{song_title.lower()}|{artist.lower()}|{lyric_line.strip().lower()}"
    return hashlib.md5(raw.encode()).hexdigest()


def get(cache_key: str) -> LyricLineResponse | None:
    db = get_db()
    resp = db.table("line_analyses").select("*").eq("cache_key", cache_key).limit(1).execute()
    if not resp.data:
        return None

    row = resp.data[0]
    hit_count = row.get("hit_count", 0) + 1
    db.table("line_analyses").update({"hit_count": hit_count}).eq("cache_key", cache_key).execute()

    result = LyricLineResponse(**row["analysis"])
    result.cache_hit = True
    result.hit_count = hit_count
    return result


def set(cache_key: str, analysis: LyricLineResponse, song_id: int | None, lyric_line: str, model: str) -> None:
    db = get_db()
    row: dict = {
        "cache_key": cache_key,
        "lyric_line": lyric_line,
        "analysis": analysis.model_dump(exclude={"cache_hit", "hit_count"}),
        "model": model,
        "hit_count": 0,
    }
    if song_id:
        row["song_id"] = song_id
    db.table("line_analyses").insert(row).execute()
