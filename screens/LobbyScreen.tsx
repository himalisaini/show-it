import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Share, ActivityIndicator } from "react-native";
import { showAlert } from "../lib/alert";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types/navigation";
import { supabase } from "../lib/supabase";
import { subscribeToRoom, updateRoomFilters, type RoomFilters } from "../lib/rooms";
import { genreNamesForMovie, type TmdbMovie, type ProviderOption } from "../lib/tmdb";
import { getMoviesForRoom, getProviderOptions } from "../lib/movies";
import { getDeviceId } from "../lib/device";
import Avatar from "../components/Avatar";
import FiltersEditor from "../components/FiltersEditor";
import { colors, fonts, layout, radii, shadows, spacing } from "../lib/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Lobby">;
type Member = { id: string; display_name: string; device_id: string };
type Room = { id: string; code: string; status: string; host_id: string; filters: RoomFilters };

const EMPTY_FILTERS: RoomFilters = { platforms: [], genreIds: [], maxRuntimeMinutes: null, industry: null };
const FILTERS_DEBOUNCE_MS = 700;

export default function LobbyScreen({ route, navigation }: Props) {
  const { roomCode } = route.params;
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [filters, setFilters] = useState<RoomFilters>(EMPTY_FILTERS);
  const [providers, setProviders] = useState<ProviderOption[]>([]);

  const moviesRef = useRef<Promise<TmdbMovie[]> | null>(null);
  const filtersInitialized = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  useEffect(() => {
    getProviderOptions().then(setProviders).catch(() => {});
  }, []);

  const loadRoom = useCallback(async () => {
    const { data: roomData } = await supabase
      .from("rooms")
      .select("id, code, status, host_id, filters")
      .eq("code", roomCode)
      .single();
    if (!roomData) return;
    setRoom(roomData);

    if (!filtersInitialized.current) {
      setFilters(roomData.filters ?? EMPTY_FILTERS);
      filtersInitialized.current = true;
    } else if (deviceId !== null && roomData.host_id !== deviceId) {
      // Guests mirror whatever the host has set; the host's own local state
      // is already authoritative from their own toggle handlers, so only
      // non-host clients need to pull updates from realtime echoes.
      setFilters(roomData.filters ?? EMPTY_FILTERS);
    }

    const { data: memberData } = await supabase
      .from("room_members")
      .select("id, display_name, device_id")
      .eq("room_id", roomData.id);
    setMembers(memberData ?? []);

    if (roomData.status === "swiping") {
      navigation.replace("Swipe", { roomCode });
    }
  }, [roomCode, navigation, deviceId]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (!room) return;
    const unsubscribe = subscribeToRoom(room.id, loadRoom);
    return unsubscribe;
  }, [room?.id, loadRoom]);

  // Kick off (and re-kick-off on filter change) the movie fetch while people are
  // still in the lobby, so "Start Swiping" mostly just waits on Supabase writes
  // instead of an external API round trip. Debounced so rapid filter toggling
  // doesn't fire a request per click.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const promise = getMoviesForRoom(filters);
      promise.catch(() => {});
      moviesRef.current = promise;
    }, FILTERS_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters]);

  const isHost = room !== null && deviceId !== null && room.host_id === deviceId;

  function toggleGenre(id: number) {
    if (!isHost || !room) return;
    const next = {
      ...filters,
      genreIds: filters.genreIds.includes(id) ? filters.genreIds.filter((g) => g !== id) : [...filters.genreIds, id],
    };
    setFilters(next);
    updateRoomFilters(room.id, next).catch(() => {});
  }

  function toggleProvider(id: number) {
    if (!isHost || !room) return;
    const next = {
      ...filters,
      platforms: filters.platforms.includes(id) ? filters.platforms.filter((p) => p !== id) : [...filters.platforms, id],
    };
    setFilters(next);
    updateRoomFilters(room.id, next).catch(() => {});
  }

  function selectRuntime(minutes: number | null) {
    if (!isHost || !room) return;
    const next = { ...filters, maxRuntimeMinutes: minutes };
    setFilters(next);
    updateRoomFilters(room.id, next).catch(() => {});
  }

  function selectIndustry(key: string | null) {
    if (!isHost || !room) return;
    const next = { ...filters, industry: filters.industry === key ? null : key };
    setFilters(next);
    updateRoomFilters(room.id, next).catch(() => {});
  }

  async function handleStart() {
    if (!room) return;
    setStarting(true);
    try {
      const results = await (moviesRef.current ?? getMoviesForRoom(filters));
      const poolRows = results.slice(0, 20).map((movie, index) => ({
        room_id: room.id,
        tmdb_id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        vote_average: movie.vote_average,
        genres: genreNamesForMovie(movie.genre_ids),
        overview: movie.overview,
        position: index,
      }));

      const { error: poolError } = await supabase.from("movie_pool").insert(poolRows);
      if (poolError) throw poolError;

      const { error: statusError } = await supabase
        .from("rooms")
        .update({ status: "swiping" })
        .eq("id", room.id);
      if (statusError) throw statusError;

      navigation.replace("Swipe", { roomCode });
    } catch (err) {
      console.error("handleStart failed:", err);
      showAlert("Couldn't start swiping", (err as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function handleShare() {
    await Share.share({ message: `Join my Show-It watch party! Code: ${roomCode}` });
  }

  return (
    <View style={styles.container}>
    <View style={styles.content}>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>Lobby</Text>
        <Text style={styles.countMono}>{members.length} joined</Text>
      </View>

      <View style={styles.codeSection}>
        <Text style={styles.codeLabel}>Room Code</Text>
        <Text style={styles.code}>{roomCode}</Text>
        <Pressable onPress={handleShare} style={styles.shareButton}>
          <View style={styles.shareDot} />
          <Text style={styles.shareButtonText}>Tap to share code</Text>
        </Pressable>
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.sm }}
        ListHeaderComponent={
          isHost ? (
            <Text style={styles.filtersHeading}>Filters {members.length > 1 ? "(everyone sees these)" : ""}</Text>
          ) : null
        }
        ListFooterComponent={
          <FiltersEditor
            filters={filters}
            providers={providers}
            editable={isHost}
            onToggleGenre={toggleGenre}
            onToggleProvider={toggleProvider}
            onSelectRuntime={selectRuntime}
            onSelectIndustry={selectIndustry}
          />
        }
        renderItem={({ item }) => {
          const isItemHost = room?.host_id === item.device_id;
          const isYou = deviceId === item.device_id;
          return (
            <View style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <Avatar name={item.display_name} variant={isItemHost ? "accent" : "surface"} />
                <View>
                  <Text style={styles.memberName}>
                    {item.display_name}
                    {isYou && <Text style={styles.youTag}> · you</Text>}
                  </Text>
                  <Text style={styles.memberRole}>{isItemHost ? "Host" : "Guest"}</Text>
                </View>
              </View>
            </View>
          );
        }}
        style={{ flex: 1, minHeight: 0, marginBottom: spacing.lg }}
      />

      {starting ? (
        <ActivityIndicator color={colors.accent} />
      ) : isHost ? (
        <Pressable style={styles.startButton} onPress={handleStart}>
          <Text style={styles.startButtonText}>Start Swiping</Text>
        </Pressable>
      ) : (
        <Text style={styles.waitingText}>Waiting for the host to start...</Text>
      )}
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.screen,
    backgroundColor: colors.background,
    paddingTop: 64,
    alignItems: "center",
  },
  content: { flex: 1, width: "100%", maxWidth: layout.maxContentWidth },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  eyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.mutedForeground,
  },
  countMono: { fontFamily: fonts.mono, fontSize: 10, color: colors.mutedForeground },
  codeSection: { alignItems: "center", marginBottom: spacing.xl },
  codeLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.accent,
  },
  code: { fontFamily: fonts.display, fontSize: 64, color: colors.foreground, marginTop: spacing.sm, letterSpacing: -2 },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  shareDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  shareButtonText: { color: colors.foreground, fontFamily: fonts.sansSemibold, fontSize: 11 },
  filtersHeading: {
    color: colors.foreground,
    fontFamily: fonts.sansBold,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing.sm,
  },
  memberInfo: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  memberName: { color: colors.foreground, fontFamily: fonts.sansSemibold, fontSize: 14 },
  youTag: { color: colors.mutedForeground, fontFamily: fonts.sansMedium, fontSize: 10 },
  memberRole: {
    color: colors.mutedForeground,
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  startButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    ...shadows.accentStrong,
  },
  startButtonText: { color: colors.accentForeground, fontFamily: fonts.sansBold, fontSize: 15 },
  waitingText: { color: colors.mutedForeground, textAlign: "center", fontFamily: fonts.sansMedium, fontSize: 13 },
});
