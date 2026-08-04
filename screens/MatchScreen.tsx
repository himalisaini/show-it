import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, Pressable, Linking } from "react-native";
import * as Haptics from "expo-haptics";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types/navigation";
import { posterUrl, type WatchProvider } from "../lib/tmdb";
import { getWatchProvidersForMovie } from "../lib/movies";
import { supabase } from "../lib/supabase";
import { brandFor } from "../lib/providerBrand";
import Confetti from "../components/Confetti";
import { colors, fonts, layout, radii, spacing } from "../lib/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Match">;

export default function MatchScreen({ route, navigation }: Props) {
  const { tmdbId } = route.params;
  const [title, setTitle] = useState("");
  const [poster, setPoster] = useState<string | null>(null);
  const [providers, setProviders] = useState<WatchProvider[]>([]);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    (async () => {
      const { data } = await supabase
        .from("movie_pool")
        .select("title, poster_path")
        .eq("tmdb_id", tmdbId)
        .limit(1)
        .single();

      if (data) {
        setTitle(data.title);
        setPoster(posterUrl(data.poster_path));
      }

      const watchProviders = await getWatchProvidersForMovie(tmdbId);
      setProviders(watchProviders);
    })();
  }, [tmdbId]);

  return (
    <View style={styles.container}>
      <Confetti />
      <View style={[styles.glowBlob, styles.glowTopLeft]} />
      <View style={[styles.glowBlob, styles.glowBottomRight]} />

      <View style={styles.centeredContent}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>It's a Match!</Text>
        <Text style={styles.headline}>EVERYONE WANTS{"\n"}TO WATCH</Text>

        {poster && <Image source={{ uri: poster }} style={styles.poster} resizeMode="cover" />}

        <Text style={styles.movieTitle}>{title.toUpperCase()}</Text>

        {providers.length > 0 && (
          <>
            <Text style={styles.watchNowLabel}>Watch Now On</Text>
            <View style={styles.providerRow}>
              {providers.slice(0, 4).map((p) => {
                const brand = brandFor(p.provider_name);
                return (
                  <Pressable
                    key={p.provider_id}
                    style={styles.providerButton}
                    onPress={() => Linking.openURL(`https://www.themoviedb.org/movie/${tmdbId}/watch`)}
                  >
                    <Text style={[styles.providerLetter, { color: brand.color }]}>{brand.letter}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>

      <Pressable style={styles.doneButton} onPress={() => navigation.popToTop()}>
        <Text style={styles.doneButtonText}>Done</Text>
      </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.screen,
    paddingTop: 80,
    paddingBottom: 32,
    alignItems: "center",
  },
  centeredContent: { flex: 1, width: "100%", maxWidth: layout.maxContentWidth },
  glowBlob: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.accent,
    opacity: 0.2,
  },
  glowTopLeft: { top: -60, left: -60 },
  glowBottomRight: { bottom: 0, right: -40 },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  eyebrow: {
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 4,
    textTransform: "uppercase",
    color: colors.accent,
    marginBottom: spacing.xs,
    textShadowColor: "rgba(255,59,92,0.6)",
    textShadowRadius: 20,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.foreground,
    textAlign: "center",
    lineHeight: 32,
    marginBottom: spacing.xl,
  },
  poster: {
    width: 176,
    aspectRatio: 2 / 3,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: colors.accent,
    transform: [{ rotate: "2deg" }],
    marginBottom: spacing.xl,
  },
  movieTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.foreground, marginBottom: spacing.lg },
  watchNowLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  providerRow: { flexDirection: "row", gap: spacing.sm },
  providerButton: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  providerLetter: { fontFamily: fonts.display, fontSize: 18 },
  doneButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  doneButtonText: { color: colors.foreground, fontFamily: fonts.sansSemibold, fontSize: 13 },
});
