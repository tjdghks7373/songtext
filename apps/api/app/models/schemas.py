from __future__ import annotations

from typing import Literal
from pydantic import BaseModel


class LyricLineRequest(BaseModel):
    song_title: str
    artist: str
    year: int
    album: str | None = None
    genre: str | None = None
    lyric_line: str
    line_context: str | None = None
    prev_lines: str | None = None
    next_lines: str | None = None


class Translation(BaseModel):
    literal: str
    natural: str
    merge_translations: bool = False


class Expression(BaseModel):
    focus_phrase: str
    explanation: str
    techniques: list[str]


class Emotion(BaseModel):
    model_config = {"populate_by_name": True}
    weight: str
    register: str


class Context(BaseModel):
    era_relevance: str | None
    current_relevance: str | None


class SimilarKoreanSong(BaseModel):
    title: str
    artist: str
    reason: str
    confidence: Literal["high", "medium", "low"]


class LyricLineResponse(BaseModel):
    translation: Translation
    expression: Expression
    emotion: Emotion
    context: Context
    similar_korean_songs: list[SimilarKoreanSong]
    cache_hit: bool = False
    hit_count: int = 0


class OverviewEra(BaseModel):
    musical_context: str
    social_context: str | None


class OverviewIntent(BaseModel):
    stated: str | None
    interpretive: str
    ambiguity: str | None


class OverviewStructure(BaseModel):
    form: str
    narrative_link: str | None


class OverviewReception(BaseModel):
    initial: str
    lasting: str


class OverviewKeyLine(BaseModel):
    line: str
    why: str


class SongOverview(BaseModel):
    era: OverviewEra
    intent: OverviewIntent
    structure: OverviewStructure
    reception: OverviewReception
    key_lines: list[OverviewKeyLine]
    cache_hit: bool = False


class TranslateBatchRequest(BaseModel):
    song_title: str
    artist: str
    lines: list[str]


class TranslateBatchResponse(BaseModel):
    translations: list[str]
