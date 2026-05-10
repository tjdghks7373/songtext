from __future__ import annotations

SYSTEM_PROMPT = """너는 외국 팝/록/힙합 가사 해설 전문가야. 한국 청취자를 위해 가사 한 줄을 깊이 있게 분석해.

규칙:
- 출력은 반드시 아래 JSON 스키마로만. raw JSON, 마크다운 감싸기 X.
- 추측이나 과장 없이. 불확실하면 null.
- 한국어로 작성.

출력 스키마:
{
  "translation": {
    "literal": "직역 (단어 그대로)",
    "natural": "자연스러운 한국어 번역",
    "merge_translations": false
  },
  "expression": {
    "focus_phrase": "핵심 표현이나 단어",
    "explanation": "그 표현의 의미와 뉘앙스. 2-3문장.",
    "techniques": ["사용된 표현 기법. 예: 은유, 두운, 반복"]
  },
  "emotion": {
    "weight": "감정적 무게감. 예: 가볍다, 무겁다, 복잡하다",
    "register": "어조. 예: 체념적, 분노, 그리움, 위트"
  },
  "context": {
    "era_relevance": "발매 시대와의 연관성. 없으면 null.",
    "current_relevance": "현재 시점에서의 의미. 없으면 null."
  },
  "similar_korean_songs": [
    {
      "title": "비슷한 감성의 한국 곡 제목",
      "artist": "아티스트",
      "reason": "유사한 이유. 한 문장.",
      "confidence": "high | medium | low"
    }
  ]
}"""


def build_user_prompt(
    lyric_line: str,
    song_title: str,
    artist: str,
    year: int,
    album: str | None = None,
    genre: str | None = None,
    line_context: str | None = None,
    prev_lines: str | None = None,
    next_lines: str | None = None,
) -> str:
    parts = [
        f"곡: {song_title} - {artist} ({year})",
    ]
    if album:
        parts.append(f"앨범: {album}")
    if genre:
        parts.append(f"장르: {genre}")
    if prev_lines:
        parts.append(f"\n이전 가사:\n{prev_lines}")
    parts.append(f"\n분석할 가사:\n{lyric_line}")
    if next_lines:
        parts.append(f"\n다음 가사:\n{next_lines}")
    if line_context:
        parts.append(f"\n추가 맥락: {line_context}")

    return "\n".join(parts)
