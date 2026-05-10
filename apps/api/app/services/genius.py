from __future__ import annotations

import asyncio
import re
import lyricsgenius
from app.core.config import settings

_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"


def _get_genius() -> lyricsgenius.Genius:
    g = lyricsgenius.Genius(
        settings.genius_access_token,
        verbose=False,
        remove_section_headers=True,
        skip_non_songs=True,
        timeout=15,
        retries=2,
    )
    g._session.headers["User-Agent"] = _UA
    return g


def _clean_title(title: str) -> str:
    return re.sub(r"\s*[\(\[]feat\..*?[\)\]]", "", title, flags=re.IGNORECASE).strip()


def _search_sync(title: str, artist: str) -> dict | None:
    genius = _get_genius()
    song = genius.search_song(_clean_title(title), artist)
    if not song:
        return None
    return {
        "song_id": song.id,
        "song_url": song.url,
        "title": song.title,
        "artist": song.artist,
        "year": getattr(song, "year", None),
        "album": song.album if hasattr(song, "album") and song.album else None,
        "thumbnail_url": getattr(song, "song_art_image_thumbnail_url", None),
    }


async def search_song(title: str, artist: str) -> dict | None:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _search_sync, title, artist)


def _fetch_lyrics_sync(song_url: str) -> str | None:
    genius = _get_genius()
    lyrics = genius.lyrics(song_url=song_url, remove_section_headers=True)
    return lyrics


async def get_lyrics(song_url: str) -> str | None:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_lyrics_sync, song_url)


def _is_junk(line: str) -> bool:
    low = line.lower().strip()
    if not low:
        return True
    # Genius 광고 위젯 한 줄
    if low == "you might also like":
        return True
    # 상단 메타데이터 (숫자로 시작하는 길이 긴 줄)
    if line.strip() and line.strip()[0].isdigit() and len(low) > 10:
        return True
    # "N Contributors", "N Translations"
    if low.endswith("contributors") or low.endswith("translations"):
        return True
    # "Song Title Lyrics" 헤더
    if low.endswith("lyrics"):
        return True
    # "...NNNEmbed" 푸터
    if "embed" in low and len(low) < 30:
        return True
    if len(low) > 200:
        return True
    return False


async def get_lyrics_lines(song_url: str) -> list[str]:
    raw = await get_lyrics(song_url)
    if not raw:
        raise RuntimeError("가사를 가져올 수 없음")

    lines = []
    for line in raw.split("\n"):
        stripped = line.strip()
        if _is_junk(stripped):
            continue
        lines.append(stripped)
    return lines
