const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface SongDetail {
  song_id: number;
  song_url: string;
  title: string;
  artist: string;
  year: number | null;
  album: string | null;
  thumbnail_url: string | null;
}

export interface Translation {
  literal: string;
  natural: string;
  merge_translations: boolean;
}

export interface Expression {
  focus_phrase: string;
  explanation: string;
  techniques: string[];
}

export interface Emotion {
  weight: string;
  register: string;
}

export interface Context {
  era_relevance: string | null;
  current_relevance: string | null;
}

export interface SimilarKoreanSong {
  title: string;
  artist: string;
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface LyricLineResponse {
  translation: Translation;
  expression: Expression;
  emotion: Emotion;
  context: Context;
  similar_korean_songs: SimilarKoreanSong[];
  cache_hit: boolean;
  hit_count: number;
}

export interface LyricsResponse {
  song_id: number;
  lines: string[];
  total: number;
}

export interface SongOverview {
  era: { musical_context: string; social_context: string | null };
  intent: { stated: string | null; interpretive: string; ambiguity: string | null };
  structure: { form: string; narrative_link: string | null };
  reception: { initial: string; lasting: string };
  key_lines: { line: string; why: string }[];
  cache_hit: boolean;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `API 오류 ${res.status}`);
  }
  return res.json();
}

export async function searchSong(title: string, artist: string): Promise<SongDetail> {
  return apiFetch<SongDetail>(
    `/api/songs/search?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`
  );
}

export async function getLyrics(songId: number, songUrl: string): Promise<LyricsResponse> {
  return apiFetch<LyricsResponse>(
    `/api/songs/${songId}/lyrics?song_url=${encodeURIComponent(songUrl)}`
  );
}

export async function getSongOverview(
  songId: number,
  params: { title: string; artist: string; year?: number | null; album?: string | null; genre?: string | null }
): Promise<SongOverview> {
  const qs = new URLSearchParams({ title: params.title, artist: params.artist });
  if (params.year) qs.set("year", String(params.year));
  if (params.album) qs.set("album", params.album);
  if (params.genre) qs.set("genre", params.genre);
  return apiFetch<SongOverview>(`/api/songs/${songId}/overview?${qs}`);
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; data: LyricLineResponse }
  | { type: "cached"; data: LyricLineResponse }
  | { type: "error"; message: string };

export async function* analyzeLineStream(
  params: {
    song_title: string;
    artist: string;
    year: number;
    album?: string | null;
    lyric_line: string;
    prev_lines?: string | null;
    next_lines?: string | null;
  },
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${BASE}/api/lyrics/analyze/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `API 오류 ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith("data: ")) {
        yield JSON.parse(line.slice(6)) as StreamEvent;
      }
    }
  }
}
