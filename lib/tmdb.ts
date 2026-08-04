const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY;

export type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  vote_average: number;
  runtime?: number;
  genre_ids: number[];
  popularity?: number;
};

export type WatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string;
};

// TMDB's movie genre list is a small, effectively static set — hardcoding it
// avoids an extra API call (and its own rate-limit budget) on every pool load.
// Source: GET /genre/movie/list, refreshed here only if TMDB adds new genres.
const GENRE_NAMES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

export function genreNamesForMovie(genreIds: number[], max = 3): string[] {
  return genreIds
    .map((id) => GENRE_NAMES[id])
    .filter((name): name is string => Boolean(name))
    .slice(0, max);
}

export const GENRE_LIST: { id: number; name: string }[] = Object.entries(GENRE_NAMES).map(([id, name]) => ({
  id: Number(id),
  name,
}));

function assertApiKey() {
  if (!apiKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_TMDB_API_KEY. Copy .env.example to .env and fill in your TMDB read access token."
    );
  }
}

const REQUEST_TIMEOUT_MS = 10000;

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  assertApiKey();
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  // v3 API keys (32-char hex) authenticate via query param, not the Bearer header
  // used by v4 read access tokens.
  url.searchParams.set("api_key", apiKey!);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("TMDB request timed out. Check your connection and try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function posterUrl(posterPath: string | null, size: "w92" | "w342" | "w500" | "original" = "w500") {
  if (!posterPath) return null;
  return `${TMDB_IMAGE_BASE_URL}/${size}${posterPath}`;
}

export async function fetchTrendingMovies(page = 1) {
  return tmdbFetch<{ results: TmdbMovie[] }>("/trending/movie/week", { page: String(page) });
}

export type MovieFilters = {
  genreIds: number[];
  providerIds: number[];
  maxRuntimeMinutes: number | null;
  region?: string;
  originalLanguage?: string;
  originCountry?: string;
};

export async function fetchFilteredMovies(filters: MovieFilters, page = 1) {
  const params: Record<string, string> = {
    sort_by: "popularity.desc",
    page: String(page),
    watch_region: filters.region ?? "US",
  };

  if (filters.genreIds.length > 0) {
    // Pipe-separated = OR (match any selected genre). Comma would mean AND,
    // which is too restrictive for a "genre preference" filter.
    params.with_genres = filters.genreIds.join("|");
  }
  if (filters.providerIds.length > 0) {
    params.with_watch_providers = filters.providerIds.join("|");
    params.with_watch_monetization_types = "flatrate";
  }
  if (filters.maxRuntimeMinutes) {
    params["with_runtime.lte"] = String(filters.maxRuntimeMinutes);
  }
  if (filters.originalLanguage) {
    params.with_original_language = filters.originalLanguage;
  }
  if (filters.originCountry) {
    params.with_origin_country = filters.originCountry;
  }

  return tmdbFetch<{ results: TmdbMovie[] }>("/discover/movie", params);
}

export type ProviderOption = {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
};

export async function fetchProviderList(region = "US", limit = 12) {
  const data = await tmdbFetch<{ results: ProviderOption[] }>("/watch/providers/movie", {
    watch_region: region,
  });
  return data.results
    .slice()
    .sort((a, b) => a.display_priority - b.display_priority)
    .slice(0, limit);
}

export async function fetchWatchProviders(movieId: number, region = "US") {
  const data = await tmdbFetch<{ results: Record<string, { flatrate?: WatchProvider[] }> }>(
    `/movie/${movieId}/watch/providers`
  );
  return data.results[region]?.flatrate ?? [];
}

export async function fetchGenres() {
  return tmdbFetch<{ genres: { id: number; name: string }[] }>("/genre/movie/list");
}

export async function fetchImdbId(movieId: number): Promise<string | null> {
  const data = await tmdbFetch<{ imdb_id: string | null }>(`/movie/${movieId}/external_ids`);
  return data.imdb_id;
}

type TmdbVideo = {
  key: string;
  site: string;
  type: string;
  official: boolean;
};

export async function fetchYoutubeTrailerKey(movieId: number): Promise<string | null> {
  const data = await tmdbFetch<{ results: TmdbVideo[] }>(`/movie/${movieId}/videos`);
  const youtubeVideos = data.results.filter((v) => v.site === "YouTube");

  const trailer =
    youtubeVideos.find((v) => v.type === "Trailer" && v.official) ??
    youtubeVideos.find((v) => v.type === "Trailer") ??
    youtubeVideos.find((v) => v.type === "Teaser") ??
    youtubeVideos[0];

  return trailer?.key ?? null;
}
