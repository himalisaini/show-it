import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { GENRE_LIST, posterUrl, type ProviderOption } from "../lib/tmdb";
import { INDUSTRY_OPTIONS } from "../lib/industries";
import type { RoomFilters } from "../lib/rooms";
import { colors, fonts, radii, spacing } from "../lib/theme";

const RUNTIME_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Any length", value: null },
  { label: "Under 90 min", value: 90 },
  { label: "Under 2 hrs", value: 120 },
  { label: "Under 2.5 hrs", value: 150 },
];

type Props = {
  filters: RoomFilters;
  providers: ProviderOption[];
  editable: boolean;
  onToggleGenre: (id: number) => void;
  onToggleProvider: (id: number) => void;
  onSelectRuntime: (minutes: number | null) => void;
  onSelectIndustry: (key: string | null) => void;
};

function providerLogoUrl(logoPath: string) {
  return posterUrl(logoPath, "w92") ?? undefined;
}

export default function FiltersEditor({
  filters,
  providers,
  editable,
  onToggleGenre,
  onToggleProvider,
  onSelectRuntime,
  onSelectIndustry,
}: Props) {
  if (!editable) {
    const genreNames = GENRE_LIST.filter((g) => filters.genreIds.includes(g.id)).map((g) => g.name);
    const providerNames = providers.filter((p) => filters.platforms.includes(p.provider_id)).map((p) => p.provider_name);
    const runtimeLabel = RUNTIME_OPTIONS.find((r) => r.value === filters.maxRuntimeMinutes)?.label;
    const industryLabel = INDUSTRY_OPTIONS.find((i) => i.key === filters.industry)?.label;

    const parts = [genreNames.join(", "), providerNames.join(", "), industryLabel, runtimeLabel]
      .filter(Boolean)
      .filter((p) => p !== "Any length");

    if (parts.length === 0) return null;

    return (
      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>Host's Filters</Text>
        <Text style={styles.summaryText}>{parts.join(" · ")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Genres</Text>
      <View style={styles.chipRow}>
        {GENRE_LIST.map((genre) => {
          const active = filters.genreIds.includes(genre.id);
          return (
            <Pressable
              key={genre.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onToggleGenre(genre.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{genre.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Industry</Text>
      <View style={styles.chipRow}>
        {INDUSTRY_OPTIONS.map((industry) => {
          const active = filters.industry === industry.key;
          return (
            <Pressable
              key={industry.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelectIndustry(industry.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{industry.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {providers.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Streaming Platforms</Text>
          <View style={styles.chipRow}>
            {providers.map((provider) => {
              const active = filters.platforms.includes(provider.provider_id);
              return (
                <Pressable
                  key={provider.provider_id}
                  style={[styles.providerChip, active && styles.chipActive]}
                  onPress={() => onToggleProvider(provider.provider_id)}
                >
                  {providerLogoUrl(provider.logo_path) && (
                    <Image source={{ uri: providerLogoUrl(provider.logo_path) }} style={styles.providerLogo} />
                  )}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{provider.provider_name}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.sectionLabel}>Time Commitment</Text>
      <View style={styles.chipRow}>
        {RUNTIME_OPTIONS.map((option) => {
          const active = filters.maxRuntimeMinutes === option.value;
          return (
            <Pressable
              key={option.label}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelectRuntime(option.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  sectionLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  providerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  providerLogo: { width: 16, height: 16, borderRadius: 4 },
  chipActive: { backgroundColor: `${colors.accent}22`, borderColor: colors.accent },
  chipText: { color: colors.mutedForeground, fontFamily: fonts.sansSemibold, fontSize: 12 },
  chipTextActive: { color: colors.accent },
  summaryBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  summaryText: { color: colors.foreground, fontFamily: fonts.sansMedium, fontSize: 13 },
});
