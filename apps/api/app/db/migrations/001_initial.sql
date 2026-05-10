-- Songs
create table if not exists songs (
  id bigint primary key,
  title text not null,
  artist text not null,
  year int,
  album text,
  song_url text,
  thumbnail_url text,
  created_at timestamptz default now()
);

-- Lyric lines (optional, for reference)
create table if not exists lyric_lines (
  id bigserial primary key,
  song_id bigint references songs(id),
  line_index int not null,
  line_text text not null
);

-- Line analysis cache
create table if not exists line_analyses (
  id bigserial primary key,
  cache_key text unique not null,
  song_id bigint,
  lyric_line text not null,
  analysis jsonb not null,
  model text not null,
  hit_count int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_line_analyses_cache_key on line_analyses(cache_key);

-- Song overview cache
create table if not exists song_overviews (
  id bigserial primary key,
  song_id bigint unique not null,
  overview jsonb not null,
  model text not null,
  created_at timestamptz default now()
);

create index if not exists idx_song_overviews_song_id on song_overviews(song_id);
