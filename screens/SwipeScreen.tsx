import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types/navigation";
import { supabase } from "../lib/supabase";
import { subscribeToRoom, submitSwipe, type RoomFilters } from "../lib/rooms";
import { getDeviceId } from "../lib/device";
import { getProviderOptions } from "../lib/movies";
import type { ProviderOption } from "../lib/tmdb";
import SwipeCard, { type SwipeDirection } from "../components/SwipeCard";
import { colors, fonts, spacing } from "../lib/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Swipe">;
type PoolMovie = {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
  genres: string[];
  overview: string | null;
};

const DOT_COLORS = [colors.accent, colors.surface2, colors.success, "#facc15"];

export default function SwipeScreen({ route, navigation }: Props) {
  const { roomCode } = route.params;
  const [roomId, setRoomId] = useState<string | null>(null);
  const [movies, setMovies] = useState<PoolMovie[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<RoomFilters | null>(null);
  const [providers, setProviders] = useState<ProviderOption[]>([]);

  useEffect(() => {
    getProviderOptions().then(setProviders).catch(() => {});
  }, []);

  const checkRoomStatus = useCallback(
    async (id: string) => {
      const { data } = await supabase.from("rooms").select("status, matched_movie_id").eq("id", id).single();
      if (data?.status === "matched" && data.matched_movie_id) {
        navigation.replace("Match", { roomCode, tmdbId: data.matched_movie_id });
      }

      const { count } = await supabase
        .from("room_members")
        .select("id", { count: "exact", head: true })
        .eq("room_id", id);
      if (typeof count === "number") setMemberCount(count);
    },
    [roomCode, navigation]
  );

  useEffect(() => {
    (async () => {
      const { data: room } = await supabase.from("rooms").select("id, filters").eq("code", roomCode).single();
      if (!room) return;
      setRoomId(room.id);
      setActiveFilters(room.filters ?? null);

      const { data: pool } = await supabase
        .from("movie_pool")
        .select("tmdb_id, title, poster_path, vote_average, genres, overview")
        .eq("room_id", room.id)
        .order("position");

      setMovies(pool ?? []);
      setLoading(false);
      checkRoomStatus(room.id);
    })();
  }, [roomCode, checkRoomStatus]);

  useEffect(() => {
    if (!roomId) return;
    const unsubscribe = subscribeToRoom(roomId, () => checkRoomStatus(roomId));
    return unsubscribe;
  }, [roomId, checkRoomStatus]);

  async function handleSwipe(direction: SwipeDirection) {
    const movie = movies[index];
    setIndex((i) => i + 1);
    if (!roomId || !movie) return;

    const deviceId = await getDeviceId();
    const matched = await submitSwipe(roomId, deviceId, movie.tmdb_id, direction);

    if (matched) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace("Match", { roomCode, tmdbId: movie.tmdb_id });
    } else if (direction !== "up") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const remaining = movies.slice(index, index + 3);
  const leftCount = Math.max(movies.length - index, 0);
  const activeProviderNames = (activeFilters?.platforms ?? [])
    .map((id) => providers.find((p) => p.provider_id === id)?.provider_name)
    .filter((name): name is string => Boolean(name));

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.swipingBadge}>
          <View style={styles.dotStack}>
            {DOT_COLORS.slice(0, Math.max(memberCount, 1)).map((color, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: color, marginLeft: i === 0 ? 0 : -6 }]} />
            ))}
          </View>
          <Text style={styles.swipingText}>{memberCount || 1} swiping</Text>
        </View>
        <Text style={styles.leftCountMono}>{leftCount} left</Text>
      </View>

      {activeProviderNames.length > 0 && (
        <Text style={styles.filterBanner}>Filtered to: {activeProviderNames.join(", ")}</Text>
      )}

      <View style={styles.deck}>
        {remaining.length === 0 ? (
          <View style={styles.emptyDeck}>
            <Text style={styles.emptyEmoji}>🎬</Text>
            <Text style={styles.emptyTitle}>Out of movies</Text>
            <Text style={styles.emptyText}>
              Everyone's swiped through the deck. Waiting on the rest of the group to catch up...
            </Text>
          </View>
        ) : (
          remaining
            .map((movie, i) => (
              <SwipeCard
                key={movie.tmdb_id}
                movie={movie}
                isTop={i === 0}
                onSwiped={i === 0 ? handleSwipe : () => {}}
              />
            ))
            .reverse()
        )}
      </View>

      {remaining.length > 0 && (
        <View style={styles.actionRow}>
          <Pressable style={styles.actionButtonPass} onPress={() => handleSwipe("left")}>
            <Text style={styles.actionIconPass}>✕</Text>
          </Pressable>
          <Pressable style={styles.actionButtonSeen} onPress={() => handleSwipe("up")}>
            <Text style={styles.actionIconSeen}>👁</Text>
          </Pressable>
          <Pressable style={styles.actionButtonLike} onPress={() => handleSwipe("right")}>
            <Text style={styles.actionIconLike}>♥</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.screen,
    marginBottom: spacing.lg,
  },
  swipingBadge: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dotStack: { flexDirection: "row" },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.background },
  swipingText: {
    color: colors.mutedForeground,
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  leftCountMono: { color: colors.mutedForeground, fontFamily: fonts.mono, fontSize: 10 },
  filterBanner: {
    color: colors.accent,
    fontFamily: fonts.sansSemibold,
    fontSize: 11,
    textAlign: "center",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.screen,
  },
  deck: { flex: 1, marginHorizontal: spacing.screen, marginBottom: spacing.lg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  emptyDeck: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  emptyEmoji: { fontSize: 32, marginBottom: spacing.sm },
  emptyTitle: { color: colors.foreground, fontFamily: fonts.sansBold, fontSize: 15, marginBottom: spacing.xs },
  emptyText: { color: colors.mutedForeground, textAlign: "center", fontFamily: fonts.sans, fontSize: 12 },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: spacing.lg,
  },
  actionButtonPass: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonSeen: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonLike: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconPass: { color: colors.danger, fontSize: 20, fontFamily: fonts.sansBold },
  actionIconSeen: { color: colors.mutedForeground, fontSize: 15 },
  actionIconLike: { color: "#fff", fontSize: 20 },
});
