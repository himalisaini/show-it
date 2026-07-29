import {
  fetchFilteredMovies,
  fetchProviderList,
  fetchTrendingMovies,
  fetchWatchProviders,
  fetchYoutubeTrailerKey,
  type ProviderOption,
  type TmdbMovie,
  type WatchProvider,
} from "./tmdb";
import { getCached, setCached } from "./movieCache";
import type { RoomFilters } from "./rooms";

const MOVIE_LIST_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const PROVIDER_LIST_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MOVIE_PROVIDERS_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const TRAILER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — trailers essentially never change

function filterCacheKey(filters: RoomFilters): string {
  const genres = [...filters.genreIds].sort((a, b) => a - b).join(",");
  const providers = [...filters.platforms].sort((a, b) => a - b).join(",");
  const runtime = filters.maxRuntimeMinutes ?? "any";
  return `movies:g${genres}:p${providers}:r${runtime}`;
}

function hasActiveFilters(filters: RoomFilters): boolean {
  return filters.genreIds.length > 0 || filters.platforms.length > 0 || filters.maxRuntimeMinutes !== null;
}

export async function getMoviesForRoom(filters: RoomFilters): Promise<TmdbMovie[]> {
  const key = hasActiveFilters(filters) ? filterCacheKey(filters) : "movies:trending";

  const cached = await getCached<TmdbMovie[]>(key, MOVIE_LIST_TTL_MS);
  if (cached) return cached;

  const { results } = hasActiveFilters(filters)
    ? await fetchFilteredMovies({
        genreIds: filters.genreIds,
        providerIds: filters.platforms,
        maxRuntimeMinutes: filters.maxRuntimeMinutes,
      })
    : await fetchTrendingMovies();

  await setCached(key, results);
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
