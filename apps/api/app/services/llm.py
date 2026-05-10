from __future__ import annotations

import json
from typing import AsyncGenerator
import anthropic
from app.core.config import settings
from app.models.schemas import LyricLineRequest, LyricLineResponse, SongOverview, TranslateBatchResponse
from packages.prompts.line_analysis import SYSTEM_PROMPT, build_user_prompt

client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)


async def analyze_line(req: LyricLineRequest) -> LyricLineResponse:
    user_prompt = build_user_prompt(
        lyric_line=req.lyric_line,
        song_title=req.song_title,
        artist=req.artist,
        year=req.year,
        album=req.album,
        genre=req.genre,
        line_context=req.line_context,
        prev_lines=req.prev_lines,
        next_lines=req.next_lines,
    )

    try:
        message = await client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": user_prompt}],
            extra_headers={"anthropic-beta": "prompt-caching-2024-07-31"},
            timeout=30.0,
        )
    except anthropic.APITimeoutError as e:
        raise TimeoutError("LLM 호출 타임아웃 (30s)") from e

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM JSON 파싱 실패: {e}\nraw: {raw[:300]}") from e

    return LyricLineResponse(**data)


def _make_params(req: LyricLineRequest) -> dict:
    return dict(
        model="claude-haiku-4-5",
        max_tokens=1024,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": build_user_prompt(
            lyric_line=req.lyric_line,
            song_title=req.song_title,
            artist=req.artist,
            year=req.year,
            album=req.album,
            genre=req.genre,
            line_context=req.line_context,
            prev_lines=req.prev_lines,
            next_lines=req.next_lines,
        )}],
        extra_headers={"anthropic-beta": "prompt-caching-2024-07-31"},
    )


async def stream_text(req: LyricLineRequest) -> AsyncGenerator[str, None]:
    full_text = ""
    async with client.messages.stream(**_make_params(req)) as stream:
        async for chunk in stream.text_stream:
            full_text += chunk
            yield chunk

    raw = full_text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    yield "\x00" + raw


_TRANSLATE_SYSTEM = "너는 영어 팝·힙합 가사 번역 전문가야. 가사의 감성과 뉘앙스를 살려 자연스러운 한국어로 번역해. 출력은 JSON 배열만. 마크다운 감싸기 없이."


async def translate_batch(song_title: str, artist: str, lines: list[str]) -> list[str]:
    numbered = "\n".join(f"{i + 1}. {line}" for i, line in enumerate(lines))
    user_prompt = (
        f"곡: {song_title} - {artist}\n\n"
        f"아래 가사 {len(lines)}줄을 순서대로 한국어로 번역해. "
        f"결과는 JSON 배열로만 ({len(lines)}개 원소).\n\n{numbered}"
    )

    try:
        message = await client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=4096,
            system=_TRANSLATE_SYSTEM,
            messages=[{"role": "user", "content": user_prompt}],
            timeout=30.0,
        )
    except anthropic.APITimeoutError as e:
        raise TimeoutError("번역 타임아웃") from e

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    data = json.loads(raw)
    if len(data) != len(lines):
        data = (data + [""] * len(lines))[: len(lines)]
    return data


_OVERVIEW_SYSTEM = """너는 음악 평론가야. 곡 하나를 깊이 있게 해설하는 게 역할이야.

핵심 원칙:
1. 확인된 사실과 통용되는 해석만 쓴다. 불확실하면 null.
2. 한국 독자 기준으로, 배경 지식 없어도 이해할 수 있게.
3. 친구가 설명해주는 톤. 학술 논문 아님.

출력: 아래 JSON 스키마로만. raw JSON, 마크다운 감싸기 X.

{
  "era": {
    "musical_context": "음악적 맥락. 3-4문장.",
    "social_context": "사회·문화적 배경. 없으면 null."
  },
  "intent": {
    "stated": "아티스트가 직접 밝힌 의도. 없으면 null.",
    "interpretive": "널리 받아들여지는 해석. 3-4문장.",
    "ambiguity": "의도적으로 모호하게 둔 부분. 없으면 null."
  },
  "structure": {
    "form": "곡 구조. 예: verse-chorus",
    "narrative_link": "구조가 가사 서사와 맞물리는 방식. 없으면 null."
  },
  "reception": {
    "initial": "발매 당시 반응. 2-3문장.",
    "lasting": "현재까지 영향. 2-3문장."
  },
  "key_lines": [
    {
      "line": "결정적인 가사 한 줄 (원문)",
      "why": "왜 결정적인지. 한 줄."
    }
  ]
}"""


async def song_overview(
    song_title: str,
    artist: str,
    year: int | None,
    album: str | None,
    genre: str | None,
) -> SongOverview:
    parts = [f"곡: {song_title} - {artist}"]
    if year:
        parts.append(f"연도: {year}")
    if album:
        parts.append(f"앨범: {album}")
    if genre:
        parts.append(f"장르: {genre}")
    user_prompt = "\n".join(parts)

    try:
        message = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=[{"type": "text", "text": _OVERVIEW_SYSTEM, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user_prompt}],
            extra_headers={"anthropic-beta": "prompt-caching-2024-07-31"},
            timeout=60.0,
        )
    except anthropic.APITimeoutError as e:
        raise TimeoutError("LLM 호출 타임아웃 (60s)") from e

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Overview JSON 파싱 실패: {e}\nraw: {raw[:300]}") from e

    return SongOverview(**data)
