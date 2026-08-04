import {
  fetchFilteredMovies,
  fetchImdbId,
  fetchProviderList,
  fetchTrendingMovies,
  fetchWatchProviders,
  fetchYoutubeTrailerKey,
  type ProviderOption,
  type TmdbMovie,
  type WatchProvider,
} from "./tmdb";
import { fetchOmdbRatings, type OmdbRatings } from "./omdb";
import { getCached, setCached } from "./movieCache";
import { supabase } from "./supabase";
import { industryFor } from "./industries";
import type { RoomFilters } from "./rooms";

const MOVIE_LIST_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const PROVIDER_LIST_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MOVIE_PROVIDERS_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const TRAILER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — trailers essentially never change
const RATINGS_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days — ratings drift slowly but do move

// How many matching movies the local catalog needs to have before we trust it
// enough to skip TMDB entirely. Matches the pool size Lobby actually inserts.
const CATALOG_MATCH_THRESHOLD = 20;

type CatalogRow = {
  tmdb_id: number;
  title: string;
  overview: string | null;
  poster_path: string | null;
  vote_average: number | null;
  genre_ids: number[];
};

function catalogRowToTmdbMovie(row: CatalogRow): TmdbMovie {
  return {
    id: row.tmdb_id,
    title: row.title,
    overview: row.overview ?? "",
    poster_path: row.poster_path,
    vote_average: row.vote_average ?? 0,
    genre_ids: row.genre_ids,
  };
}

async function queryLocalCatalog(filters: RoomFilters, limit: number): Promise<TmdbMovie[]> {
  let query = supabase
    .from("movies")
    .select("tmdb_id, title, overview, poster_path, vote_average, genre_ids")
    .order("popularity", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (filters.genreIds.length > 0) {
    query = query.overlaps("genre_ids", filters.genreIds);
  }
  if (filters.maxRuntimeMinutes) {
    query = query.not("runtime_minutes", "is", null).lte("runtime_minutes", filters.maxRuntimeMinutes);
  }

  const { data } = await query;
  return (data ?? []).map(catalogRowToTmdbMovie);
}

function upsertIntoCatalog(movies: TmdbMovie[]): void {
  if (movies.length === 0) return;

  // TMDB's list endpoints (trending/discover) don't return runtime — only the
  // single-movie detail endpoint does — so runtime_minutes stays null here.
  // That just means runtime-filtered queries fall through to TMDB every time
  // rather than being served locally; everything else still benefits.
  const rows = movies.map((movie) => ({
    tmdb_id: movie.id,
    title: movie.title,
    overview: movie.overview,
    poster_path: movie.poster_path,
    vote_average: movie.vote_average,
    genre_ids: movie.genre_ids,
    popularity: movie.popularity ?? null,
    updated_at: new Date().toISOString(),
  }));

  // Best-effort: growing the catalog should never block or fail the room's
  // own movie fetch, so this isn't awaited by callers.
  supabase
    .from("movies")
    .upsert(rows, { onConflict: "tmdb_id" })
    .then(({ error }) => {
      if (error) console.error("catalog upsert failed:", error);
    });
}

function filterCacheKey(filters: RoomFilters): string {
  const genres = [...filters.genreIds].sort((a, b) => a - b).join(",");
  const providers = [...filters.platforms].sort((a, b) => a - b).join(",");
  const runtime = filters.maxRuntimeMinutes ?? "any";
  const industry = filters.industry ?? "any";
  return `movies:g${genres}:p${providers}:r${runtime}:i${industry}`;
}

export async function getMoviesForRoom(filters: RoomFilters): Promise<TmdbMovie[]> {
  // No platform and no industry filter: the local catalog can answer this
  // directly once it's grown enough, skipping TMDB (and its cache-TTL churn)
  // entirely. Industry filters bypass the catalog for the same reason
  // platform ones do — original language/country isn't tracked per-movie there.
  if (filters.platforms.length === 0 && !filters.industry) {
    const local = await queryLocalCatalog(filters, CATALOG_MATCH_THRESHOLD);
    if (local.length >= CATALOG_MATCH_THRESHOLD) return local;

    const { results } = filters.genreIds.length > 0
      ? await fetchFilteredMovies({ genreIds: filters.genreIds, providerIds: [], maxRuntimeMinutes: filters.maxRuntimeMinutes })
      : await fetchTrendingMovies();

    upsertIntoCatalog(results);
    return results;
  }

  // Platform and/or industry filter is active — neither is tracked in the
  // local catalog, so this always goes through the (shorter-lived) blob cache.
  const key = filterCacheKey(filters);
  const cached = await getCached<TmdbMovie[]>(key, MOVIE_LIST_TTL_MS);
  if (cached) return cached;

  const industry = industryFor(filters.industry);

  const { results } = await fetchFilteredMovies({
    genreIds: filters.genreIds,
    providerIds: filters.platforms,
    maxRuntimeMinutes: filters.maxRuntimeMinutes,
    originalLanguage: industry?.originalLanguage,
    originCountry: industry?.originCountry,
  });

  await setCached(key, results);
  upsertIntoCatalog(results);
  return results;
}

export async function getProviderOptions(region = "US"): Promise<ProviderOption[]> {
  const key = `providers:${region}`;

  const cached = await getCached<ProviderOption[]>(key, PROVIDER_LIST_TTL_MS);
  if (cached) return cached;

  const results = await fetchProviderList(region);
  await setCached(key, results);
  return results;
}

export async function getWatchProvidersForMovie(movieId: number, region = "US"): Promise<WatchProvider[]> {
  const key = `providers:movie:${movieId}:${region}`;

  const cached = await getCached<WatchProvider[]>(key, MOVIE_PROVIDERS_TTL_MS);
  if (cached) return cached;

  const results = await fetchWatchProviders(movieId, region);
  await setCached(key, results);
  return results;
}

export async function getTrailerKey(movieId: number): Promise<string | null> {
  const key = `trailer:${movieId}`;

  const cached = await getCached<{ key: string | null }>(key, TRAILER_TTL_MS);
  if (cached) return cached.key;

  const trailerKey = await fetchYoutubeTrailerKey(movieId);
  await setCached(key, { key: trailerKey });
  return trailerKey;
}

export async function getRatingsForMovie(tmdbId: number): Promise<OmdbRatings> {
  const { data: row } = await supabase
    .from("movies")
    .select("imdb_id, imdb_rating, rotten_tomatoes_score, ratings_fetched_at")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  const fresh = row?.ratings_fetched_at && Date.now() - new Date(row.ratings_fetched_at).getTime() < RATINGS_TTL_MS;
  if (fresh) {
    return { imdbRating: row.imdb_rating, rottenTomatoesScore: row.rotten_tomatoes_score };
  }

  const imdbId = row?.imdb_id ?? (await fetchImdbId(tmdbId));
  const ratings = imdbId ? await fetchOmdbRatings(imdbId) : { imdbRating: null, rottenTomatoesScore: null };

  // Plain update, not upsert: `movies` requires a title, which we don't have
  // here. By the time a movie is on-screen to swipe, getMoviesForRoom has
  // already upserted its full catalog row, so this row is expected to exist.
  await supabase
    .from("movies")
    .update({
      imdb_id: imdbId,
      imdb_rating: ratings.imdbRating,
      rotten_tomatoes_score: ratings.rottenTomatoesScore,
      ratings_fetched_at: new Date().toISOString(),
    })
    .eq("tmdb_id", tmdbId);

  return ratings;
}
