-- Show-It schema: rooms, members, the movie pool for a room, and swipes.
-- Run this in the Supabase SQL editor for a fresh project.

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- 4-digit join code
  host_id uuid not null,
  status text not null default 'lobby' check (status in ('lobby', 'swiping', 'matched', 'closed')),
  filters jsonb not null default '{}'::jsonb, -- { platforms: [...], genres: [...], max_runtime_minutes: 120 }
  matched_movie_id integer,
  created_at timestamptz not null default now()
);

create table if not exists room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  device_id text not null, -- anonymous per-device identifier, no auth required
  display_name text not null,
  joined_at timestamptz not null default now(),
  unique (room_id, device_id)
);

create table if not exists movie_pool (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  tmdb_id integer not null,
  title text not null,
  poster_path text,
  vote_average numeric,
  runtime_minutes integer,
  genres text[] not null default '{}',
  overview text,
  position integer not null default 0,
  unique (room_id, tmdb_id)
);

create table if not exists swipes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  device_id text not null,
  tmdb_id integer not null,
  direction text not null check (direction in ('right', 'left', 'up')), -- right=want, left=pass, up=seen
  created_at timestamptz not null default now(),
  unique (room_id, device_id, tmdb_id)
);

-- Shared TMDB response cache, keyed by a signature of the request (filter combo,
-- or "providers:<region>"). Freshness is enforced client-side by comparing
-- fetched_at against a TTL — any room with the same filters reuses this instead
-- of hitting TMDB again, which is both faster and easier on TMDB's rate limits.
create table if not exists movie_cache (
  cache_key text primary key,
  results jsonb not null,
  fetched_at timestamptz not null default now()
);

-- Persistent local movie catalog. Every movie TMDB ever returns gets stored here
-- permanently (unlike movie_cache, this never expires). Genre/runtime-filtered
-- rooms query this table directly before ever touching TMDB; TMDB is only called
-- when the catalog doesn't have enough matching movies yet, and whatever comes
-- back gets folded in here for next time. Platform/provider filters still bypass
-- this and go straight through movie_cache, since provider availability changes
-- too often to denormalize per-movie here.
create table if not exists movies (
  tmdb_id integer primary key,
  title text not null,
  overview text,
  poster_path text,
  vote_average numeric,
  runtime_minutes integer,
  genre_ids integer[] not null default '{}',
  popularity numeric,
  imdb_id text,
  imdb_rating numeric,
  rotten_tomatoes_score integer,
  ratings_fetched_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists movies_genre_ids_idx on movies using gin (genre_ids);
create index if not exists movies_popularity_idx on movies (popularity desc);

-- Row Level Security: this app has no login, so access is scoped by room membership
-- via device_id passed from the client. Keep policies permissive but scoped to room_id
-- so one room's data isn't readable cross-room by guessing UUIDs alone (code is still
-- the real gate, enforced in the app layer when joining).

alter table rooms enable row level security;
alter table room_members enable row level security;
alter table movie_pool enable row level security;
alter table swipes enable row level security;
alter table movie_cache enable row level security;
alter table movies enable row level security;

create policy "rooms are readable by anyone with the room id" on rooms
  for select using (true);

create policy "anyone can create a room" on rooms
  for insert with check (true);

create policy "host can update their room" on rooms
  for update using (true);

create policy "room members are readable by anyone with the room id" on room_members
  for select using (true);

create policy "anyone can join a room" on room_members
  for insert with check (true);

create policy "movie pool is readable by anyone with the room id" on movie_pool
  for select using (true);

create policy "anyone can add to the movie pool" on movie_pool
  for insert with check (true);

create policy "swipes are readable by anyone with the room id" on swipes
  for select using (true);

create policy "anyone can swipe" on swipes
  for insert with check (true);

create policy "movie cache is readable by anyone" on movie_cache
  for select using (true);

create policy "anyone can write to the movie cache" on movie_cache
  for insert with check (true);

create policy "anyone can refresh the movie cache" on movie_cache
  for update using (true);

create policy "movies are readable by anyone" on movies
  for select using (true);

create policy "anyone can add to the movie catalog" on movies
  for insert with check (true);

create policy "anyone can refresh a catalog entry" on movies
  for update using (true);

-- Realtime: broadcast changes on these tables so clients get instant swipe/match updates.
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table room_members;
alter publication supabase_realtime add table swipes;

-- Match detection: a movie is a match when every current room member has swiped 'right'
-- on it. Run this as a Postgres function, called after each swipe insert, so match
-- detection is atomic and server-side rather than raced on the client.
create or replace function check_for_match(p_room_id uuid, p_tmdb_id integer)
returns boolean
language plpgsql
as $$
declare
  member_count integer;
  right_swipe_count integer;
begin
  select count(*) into member_count from room_members where room_id = p_room_id;

  select count(*) into right_swipe_count
  from swipes
  where room_id = p_room_id and tmdb_id = p_tmdb_id and direction = 'right';

  if member_count > 0 and right_swipe_count >= member_count then
    update rooms
    set status = 'matched', matched_movie_id = p_tmdb_id
    where id = p_room_id and status = 'swiping';
    return true;
  end if;

  return false;
end;
$$;
