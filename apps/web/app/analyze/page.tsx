"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  getLyrics,
  getSongOverview,
  analyzeLineStream,
  type LyricLineResponse,
  type SongOverview,
} from "@/lib/api";

function extractField(text: string, field: string): string | null {
  const fullMatch = text.match(new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  if (fullMatch) return fullMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  const partialMatch = text.match(new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`));
  if (partialMatch) return partialMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') + "…";
  return null;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-xs font-semibold uppercase tracking-widest"
      style={{ color: "var(--accent)" }}
    >
      {children}
    </span>
  );
}

function OverviewLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--accent)" }}>
      {children}
    </p>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      {[80, 60, 90, 50, 70].map((w, i) => (
        <div
          key={i}
          className="h-3 rounded"
          style={{ width: `${w}%`, background: "var(--bg-muted)" }}
        />
      ))}
    </div>
  );
}

function OverviewPanel({
  overview,
  loading,
  error,
  onLineClick,
}: {
  overview: SongOverview | null;
  loading: boolean;
  error: string | null;
  onLineClick: (line: string) => void;
}) {
  if (loading) return <OverviewSkeleton />;
  if (error) return <p className="text-sm" style={{ color: "#e05252" }}>{error}</p>;
  if (!overview) return null;

  return (
    <div className="flex flex-col gap-6 text-sm" style={{ color: "var(--fg)" }}>
      <div>
        <OverviewLabel>시대 배경</OverviewLabel>
        <p style={{ color: "var(--fg-muted)" }}>{overview.era.musical_context}</p>
        {overview.era.social_context && (
          <p className="mt-1" style={{ color: "var(--fg-muted)" }}>{overview.era.social_context}</p>
        )}
      </div>
      <div>
        <OverviewLabel>작사 의도</OverviewLabel>
        {overview.intent.stated && (
          <p className="mb-1 italic" style={{ color: "var(--fg-muted)" }}>"{overview.intent.stated}"</p>
        )}
        <p style={{ color: "var(--fg-muted)" }}>{overview.intent.interpretive}</p>
        {overview.intent.ambiguity && (
          <p className="mt-1" style={{ color: "var(--fg-subtle)" }}>{overview.intent.ambiguity}</p>
        )}
      </div>
      <div>
        <OverviewLabel>구조</OverviewLabel>
        <p style={{ color: "var(--fg-muted)" }}>
          <span className="font-medium" style={{ color: "var(--fg)" }}>{overview.structure.form}</span>
          {overview.structure.narrative_link && ` — ${overview.structure.narrative_link}`}
        </p>
      </div>
      <div>
        <OverviewLabel>평론·반응</OverviewLabel>
        <p style={{ color: "var(--fg-muted)" }}>{overview.reception.initial}</p>
        <p className="mt-1" style={{ color: "var(--fg-muted)" }}>{overview.reception.lasting}</p>
      </div>
      {overview.key_lines.length > 0 && (
        <div>
          <OverviewLabel>결정적인 가사</OverviewLabel>
          <div className="flex flex-col gap-3">
            {overview.key_lines.map((kl, i) => (
              <button
                key={i}
                onClick={() => onLineClick(kl.line)}
                className="text-left rounded-lg px-3 py-2 transition-colors"
                style={{ background: "var(--accent-bg)" }}
              >
                <p className="font-medium text-sm" style={{ color: "var(--accent)" }}>{kl.line}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>{kl.why}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StreamingView({ accumulated }: { accumulated: string }) {
  const literal = extractField(accumulated, "literal");
  const natural = extractField(accumulated, "natural");
  const explanation = extractField(accumulated, "explanation");

  return (
    <div className="flex flex-col gap-4">
      {literal && (
        <div>
          <Label>직역</Label>
          <p className="mt-1 text-sm" style={{ color: "var(--fg-muted)" }}>{literal}</p>
        </div>
      )}
      {natural && (
        <div>
          <Label>번역</Label>
          <p className="mt-1 text-sm font-medium" style={{ color: "var(--fg)" }}>{natural}</p>
        </div>
      )}
      {explanation && (
        <div>
          <Label>표현</Label>
          <p className="mt-1 text-sm" style={{ color: "var(--fg-muted)" }}>{explanation}</p>
        </div>
      )}
    </div>
  );
}

function AnalysisContent({ analysis }: { analysis: LyricLineResponse }) {
  const { translation, expression, emotion, context, similar_korean_songs } = analysis;
  const showBoth = !translation.merge_translations && translation.literal !== translation.natural;

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <Label>번역</Label>
        {showBoth ? (
          <>
            <p className="mt-1" style={{ color: "var(--fg-muted)" }}>{translation.literal}</p>
            <p className="mt-0.5 font-medium" style={{ color: "var(--fg)" }}>{translation.natural}</p>
          </>
        ) : (
          <p className="mt-1 font-medium" style={{ color: "var(--fg)" }}>{translation.natural}</p>
        )}
      </div>

      <div>
        <Label>표현</Label>
        <p className="mt-1 font-medium" style={{ color: "var(--fg)" }}>{expression.focus_phrase}</p>
        <p className="mt-1" style={{ color: "var(--fg-muted)" }}>{expression.explanation}</p>
        {expression.techniques.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {expression.techniques.map((t, i) => (
              <span
                key={i}
                className="rounded-full px-2.5 py-0.5 text-xs"
                style={{ background: "var(--accent-bg)", color: "var(--accent)" }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <Label>감정</Label>
          <p className="mt-1" style={{ color: "var(--fg-muted)" }}>{emotion.weight}</p>
        </div>
        <div className="flex-1">
          <Label>어조</Label>
          <p className="mt-1" style={{ color: "var(--fg-muted)" }}>{emotion.register}</p>
        </div>
      </div>

      {(context.era_relevance || context.current_relevance) && (
        <div>
          <Label>맥락</Label>
          {context.era_relevance && (
            <p className="mt-1" style={{ color: "var(--fg-muted)" }}>{context.era_relevance}</p>
          )}
          {context.current_relevance && (
            <p className="mt-1" style={{ color: "var(--fg-muted)" }}>{context.current_relevance}</p>
          )}
        </div>
      )}

      {similar_korean_songs.length > 0 && (
        <div>
          <Label>비슷한 한국 곡</Label>
          <div className="mt-2 flex flex-col gap-2">
            {similar_korean_songs.map((s, i) => (
              <div
                key={i}
                className="rounded-lg px-3 py-2"
                style={{ background: "var(--bg-muted)" }}
              >
                <p className="font-medium text-xs" style={{ color: "var(--fg)" }}>
                  {s.title} — {s.artist}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>{s.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyzePageInner() {
  const params = useSearchParams();
  const songId = Number(params.get("song_id") ?? 0);
  const songUrl = params.get("song_url") ?? "";
  const title = params.get("title") ?? "";
  const artist = params.get("artist") ?? "";
  const year = params.get("year") ? Number(params.get("year")) : null;
  const album = params.get("album") ?? null;
  const thumbnail = params.get("thumbnail") ?? null;

  const [lines, setLines] = useState<string[]>([]);
  const [lyricsLoading, setLyricsLoading] = useState(true);
  const [lyricsError, setLyricsError] = useState<string | null>(null);

  const [overviewOpen, setOverviewOpen] = useState(false);
  const [overview, setOverview] = useState<SongOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [accumulated, setAccumulated] = useState("");
  const [analysis, setAnalysis] = useState<LyricLineResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!songId || !songUrl) return;
    getLyrics(songId, songUrl)
      .then((r) => setLines(r.lines))
      .catch((e) => setLyricsError(e.message))
      .finally(() => setLyricsLoading(false));
  }, [songId, songUrl]);

  const handleOverviewToggle = useCallback(async () => {
    const next = !overviewOpen;
    setOverviewOpen(next);
    if (next && !overview && !overviewLoading) {
      setOverviewLoading(true);
      setOverviewError(null);
      try {
        const data = await getSongOverview(songId, { title, artist, year, album });
        setOverview(data);
      } catch (e) {
        setOverviewError(e instanceof Error ? e.message : "로딩 실패");
      } finally {
        setOverviewLoading(false);
      }
    }
  }, [overviewOpen, overview, overviewLoading, songId, title, artist, year, album]);

  const scrollToLine = useCallback((line: string) => {
    const idx = lines.findIndex((l) => l.includes(line) || line.includes(l));
    if (idx !== -1) {
      setOverviewOpen(false);
      handleLineClick(lines[idx], idx);
    }
  }, [lines]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLineClick = useCallback((line: string, index: number) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setSelectedLine(line);
    setSelectedIndex(index);
    setPanelOpen(true);
    setAccumulated("");
    setAnalysis(null);
    setAnalysisError(null);
    setIsStreaming(true);

    const prevLines = lines.slice(Math.max(0, index - 2), index).join("\n") || null;
    const nextLines = lines.slice(index + 1, index + 3).join("\n") || null;

    (async () => {
      try {
        const gen = analyzeLineStream(
          {
            song_title: title,
            artist,
            year: year ?? 2000,
            album,
            lyric_line: line,
            prev_lines: prevLines,
            next_lines: nextLines,
          },
          abortRef.current!.signal
        );

        for await (const event of gen) {
          if (event.type === "delta") {
            setAccumulated((prev) => prev + event.text);
          } else if (event.type === "done" || event.type === "cached") {
            setAnalysis(event.data);
            setIsStreaming(false);
          } else if (event.type === "error") {
            setAnalysisError(event.message);
            setIsStreaming(false);
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setAnalysisError(e instanceof Error ? e.message : "분석 실패");
        }
        setIsStreaming(false);
      }
    })();
  }, [lines, title, artist, year, album]);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        {thumbnail && (
          <img src={thumbnail} alt={title} className="w-9 h-9 rounded-md object-cover" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "var(--fg)" }}>{title}</p>
          <p className="text-xs truncate" style={{ color: "var(--fg-subtle)" }}>
            {artist}{year ? ` · ${year}` : ""}
          </p>
        </div>
        <button
          onClick={handleOverviewToggle}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
          style={
            overviewOpen
              ? { background: "var(--accent)", color: "#fff" }
              : { background: "var(--accent-bg)", color: "var(--accent)" }
          }
        >
          이 곡에 대해
        </button>
      </header>

      {/* Overview panel */}
      <div
        className="overflow-hidden transition-all duration-300 shrink-0"
        style={{
          maxHeight: overviewOpen ? "60vh" : "0px",
          borderBottom: overviewOpen ? `1px solid var(--border)` : "none",
        }}
      >
        <div className="overflow-y-auto p-5" style={{ maxHeight: "60vh", background: "var(--bg-surface)" }}>
          <OverviewPanel
            overview={overview}
            loading={overviewLoading}
            error={overviewError}
            onLineClick={scrollToLine}
          />
        </div>
      </div>

      {/* Lyrics list */}
      <div className="flex-1 overflow-y-auto">
        {lyricsLoading && (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-4 rounded animate-pulse"
                style={{ width: `${50 + (i % 5) * 10}%`, background: "var(--bg-muted)" }}
              />
            ))}
          </div>
        )}
        {lyricsError && (
          <p className="p-6 text-sm text-center" style={{ color: "#e05252" }}>{lyricsError}</p>
        )}
        {!lyricsLoading && !lyricsError && (
          <ul className="py-2">
            {lines.map((line, i) => (
              <li key={i}>
                <button
                  onClick={() => handleLineClick(line, i)}
                  className="w-full text-left px-5 py-2.5 text-sm transition-colors"
                  style={{
                    color: selectedIndex === i ? "var(--accent)" : "var(--fg-muted)",
                    background: selectedIndex === i ? "var(--accent-bg)" : "transparent",
                    fontWeight: selectedIndex === i ? 500 : 400,
                  }}
                >
                  {line}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Analysis panel (slide up) */}
      <div
        className="shrink-0 border-t transition-all duration-300 overflow-hidden"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-surface)",
          maxHeight: panelOpen ? "55vh" : "0px",
        }}
      >
        <div className="overflow-y-auto p-5" style={{ maxHeight: "55vh" }}>
          {selectedLine && (
            <p
              className="text-xs mb-4 pb-3 border-b font-medium"
              style={{ color: "var(--fg-subtle)", borderColor: "var(--border)" }}
            >
              {selectedLine}
            </p>
          )}
          {isStreaming && !analysis && <StreamingView accumulated={accumulated} />}
          {analysis && <AnalysisContent analysis={analysis} />}
          {analysisError && (
            <p className="text-sm" style={{ color: "#e05252" }}>{analysisError}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense>
      <AnalyzePageInner />
    </Suspense>
  );
}
