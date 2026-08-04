export type IndustryOption = {
  key: string;
  label: string;
  originalLanguage: string; // ISO 639-1
  originCountry?: string; // ISO 3166-1, narrows further when the language alone is too broad
};

export const INDUSTRY_OPTIONS: IndustryOption[] = [
  { key: "hollywood", label: "Hollywood", originalLanguage: "en", originCountry: "US" },
  { key: "bollywood", label: "Bollywood", originalLanguage: "hi", originCountry: "IN" },
  { key: "tollywood", label: "Tollywood", originalLanguage: "te", originCountry: "IN" },
  { key: "kollywood", label: "Kollywood", originalLanguage: "ta", originCountry: "IN" },
  { key: "korean", label: "Korean", originalLanguage: "ko", originCountry: "KR" },
  { key: "japanese", label: "Japanese", originalLanguage: "ja", originCountry: "JP" },
  { key: "spanish", label: "Spanish", originalLanguage: "es" },
  { key: "french", label: "French", originalLanguage: "fr" },
];

export function industryFor(key: string | null): IndustryOption | null {
  if (!key) return null;
  return INDUSTRY_OPTIONS.find((i) => i.key === key) ?? null;
}
