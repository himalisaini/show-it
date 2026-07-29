import { supabase } from "./supabase";

export async function getCached<T>(key: string, ttlMs: number): Promise<T | null> {
  const { data } = await supabase.from("movie_cache").select("results, fetched_at").eq("cache_key", key).maybeSingle();

  if (!data) return null;

  const age = Date.now() - new Date(data.fetched_at).getTime();
  if (age > ttlMs) return null;

  return data.results as T;
}

export async function setCached(key: string, results: unknown): Promise<void> {
  await supabase
    .from("movie_cache")
    .upsert({ cache_key: key, results, fetched_at: new Date().toISOString() }, { onConflict: "cache_key" });
}
