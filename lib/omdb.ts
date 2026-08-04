const OMDB_BASE_URL = "https://www.omdbapi.com/";
const REQUEST_TIMEOUT_MS = 8000;

const apiKey = process.env.EXPO_PUBLIC_OMDB_API_KEY;

export type OmdbRatings = {
  imdbRating: number | null;
  rottenTomatoesScore: number | null;
};

type OmdbResponse = {
  Response: "True" | "False";
  imdbRating?: string;
  Ratings?: { Source: string; Value: string }[];
};

export async function fetchOmdbRatings(imdbId: string): Promise<OmdbRatings> {
  if (!apiKey) {
    return { imdbRating: null, rottenTomatoesScore: null };
  }

  const url = new URL(OMDB_BASE_URL);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("apikey", apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let data: OmdbResponse;
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      return { imdbRating: null, rottenTomatoesScore: null };
    }
    data = (await response.json()) as OmdbResponse;
  } catch {
    // Timeouts or transient OMDb failures shouldn't break the swipe deck —
    // just show no rating rather than an error.
    return { imdbRating: null, rottenTomatoesScore: null };
  } finally {
    clearTimeout(timeout);
  }

  if (data.Response !== "True") {
    return { imdbRating: null, rottenTomatoesScore: null };
  }

  const imdbRating = data.imdbRating && data.imdbRating !== "N/A" ? Number(data.imdbRating) : null;

  const rtValue = data.Ratings?.find((r) => r.Source === "Rotten Tomatoes")?.Value;
  const rottenTomatoesScore = rtValue ? Number(rtValue.replace("%", "")) : null;

  return { imdbRating, rottenTomatoesScore };
}
