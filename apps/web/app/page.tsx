"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { searchSong } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const song = await searchSong(title.trim(), artist.trim());
      const params = new URLSearchParams({
        song_id: String(song.song_id),
        title: song.title,
        artist: song.artist,
        ...(song.year ? { year: String(song.year) } : {}),
        ...(song.album ? { album: song.album } : {}),
        ...(song.thumbnail_url ? { thumbnail: song.thumbnail_url } : {}),
        ...(song.song_url ? { song_url: song.song_url } : {}),
      });
      router.push(`/analyze?${params}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "검색 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1
            className="text-3xl font-semibold tracking-tight mb-2"
            style={{ color: "var(--fg)" }}
          >
            Songtext
          </h1>
          <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
            외국 가사를 한 줄씩 깊이 있게
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="곡 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              color: "var(--fg)",
            }}
            disabled={loading}
          />
          <input
            type="text"
            placeholder="아티스트"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              color: "var(--fg)",
            }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !title.trim() || !artist.trim()}
            className="w-full rounded-xl py-3 text-sm font-medium transition-opacity disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {loading ? "검색 중…" : "가사 분석하기"}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-center text-sm" style={{ color: "#e05252" }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
