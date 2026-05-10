from __future__ import annotations

import hashlib
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import anthropic
from app.models.schemas import LyricLineRequest, LyricLineResponse, TranslateBatchRequest, TranslateBatchResponse
from app.services import llm, cache

_translation_cache: dict[str, list[str]] = {}

router = APIRouter(prefix="/api/lyrics", tags=["lyrics"])


@router.post("/analyze", response_model=LyricLineResponse)
async def analyze(req: LyricLineRequest) -> LyricLineResponse:
    cache_key = cache.make_cache_key(req.song_title, req.artist, req.lyric_line)
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        result = await llm.analyze_line(req)
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except anthropic.BadRequestError as e:
        raise HTTPException(status_code=400, detail=f"요청 오류: {e}")
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="API 키 오류")
    except anthropic.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"LLM API 오류: {e.status_code}")

    cache.set(cache_key, result, song_id=None, lyric_line=req.lyric_line, model="claude-haiku-4-5")
    return result


@router.post("/analyze/stream")
async def analyze_stream(req: LyricLineRequest) -> StreamingResponse:
    cache_key = cache.make_cache_key(req.song_title, req.artist, req.lyric_line)
    cached = cache.get(cache_key)
    if cached:
        data = json.dumps({"type": "cached", "data": cached.model_dump()}, ensure_ascii=False)
        async def cached_gen():
            yield f"data: {data}\n\n"
        return StreamingResponse(cached_gen(), media_type="text/event-stream")

    async def event_gen():
        full_json = ""
        try:
            async for chunk in llm.stream_text(req):
                if chunk.startswith("\x00"):
                    full_json = chunk[1:]
                else:
                    payload = json.dumps({"type": "delta", "text": chunk}, ensure_ascii=False)
                    yield f"data: {payload}\n\n"
        except Exception as e:
            err = json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False)
            yield f"data: {err}\n\n"
            return

        try:
            data = json.loads(full_json)
            result = LyricLineResponse(**data)
            done_payload = json.dumps({"type": "done", "data": result.model_dump()}, ensure_ascii=False)
            yield f"data: {done_payload}\n\n"
            cache.set(cache_key, result, song_id=None, lyric_line=req.lyric_line, model="claude-haiku-4-5")
        except Exception as e:
            err = json.dumps({"type": "error", "message": f"JSON 파싱 실패: {e}"}, ensure_ascii=False)
            yield f"data: {err}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.post("/translate-batch", response_model=TranslateBatchResponse)
async def translate_batch(req: TranslateBatchRequest) -> TranslateBatchResponse:
    key_raw = f"{req.song_title.lower()}|{req.artist.lower()}|{'|'.join(req.lines)}"
    cache_key = hashlib.md5(key_raw.encode()).hexdigest()

    if cache_key in _translation_cache:
        return TranslateBatchResponse(translations=_translation_cache[cache_key])

    try:
        translations = await llm.translate_batch(req.song_title, req.artist, req.lines)
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except (ValueError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=502, detail=f"번역 파싱 실패: {e}")

    _translation_cache[cache_key] = translations
    return TranslateBatchResponse(translations=translations)
