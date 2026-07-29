type Brand = { letter: string; color: string };

const KNOWN_BRANDS: Record<string, Brand> = {
  Netflix: { letter: "N", color: "#E50914" },
  "Amazon Prime Video": { letter: "P", color: "#00A8E1" },
  "Max": { letter: "M", color: "#a855f7" },
  "Disney Plus": { letter: "D", color: "#113CCF" },
  "Apple TV Plus": { letter: "A", color: "#ffffff" },
  Hulu: { letter: "H", color: "#1CE783" },
  Peacock: { letter: "P", color: "#000000" },
  "Paramount Plus": { letter: "P", color: "#0064FF" },
};

export function brandFor(providerName: string): Brand {
  return KNOWN_BRANDS[providerName] ?? { letter: providerName[0]?.toUpperCase() ?? "?", color: "#94a3b8" };
}
