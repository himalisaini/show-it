import { useEffect, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { posterUrl } from "../lib/tmdb";
import { getTrailerKey, getRatingsForMovie } from "../lib/movies";
import type { OmdbRatings } from "../lib/omdb";
import { colors, fonts, radii, shadows, spacing } from "../lib/theme";

export type SwipeDirection = "right" | "left" | "up";

type MovieCardData = {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
  genres: string[];
  overview: string | null;
};

type Props = {
  movie: MovieCardData;
  onSwiped: (direction: SwipeDirection) => void;
  isTop: boolean;
};

const SWIPE_THRESHOLD = 120;

export default function SwipeCard({ movie, onSwiped, isTop }: Props) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const gesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const { translationX, translationY } = event;

      if (translationY < -SWIPE_THRESHOLD && Math.abs(translationY) > Math.abs(translationX)) {
        translateY.value = withTiming(-800, { duration: 250 });
        runOnJS(onSwiped)("up");
        return;
      }

      if (translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(800, { duration: 250 });
        runOnJS(onSwiped)("right");
        return;
      }

      if (translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-800, { duration: 250 });
        runOnJS(onSwiped)("left");
        return;
      }

      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = `${(translateX.value / 20).toFixed(2)}deg`;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate },
      ],
    };
  });

  const likeStampStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 30 ? Math.min(translateX.value / SWIPE_THRESHOLD, 1) : 0,
  }));

  const nopeStampStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -30 ? Math.min(-translateX.value / SWIPE_THRESHOLD, 1) : 0,
  }));

  const poster = posterUrl(movie.poster_path);
  const scorePercent = Math.round(movie.vote_average * 10);
  const [loadingTrailer, setLoadingTrailer] = useState(false);
  const [ratings, setRatings] = useState<OmdbRatings | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRatingsForMovie(movie.tmdb_id).then((result) => {
      if (!cancelled) setRatings(result);
    });
    return () => {
      cancelled = true;
    };
  }, [movie.tmdb_id]);

  async function handleTrailerPress() {
    if (loadingTrailer) return;
    setLoadingTrailer(true);
    try {
      const trailerKey = await getTrailerKey(movie.tmdb_id);
      const url = trailerKey
        ? `https://www.youtube.com/watch?v=${trailerKey}`
        : `https://www.themoviedb.org/movie/${movie.tmdb_id}`;
      Linking.openURL(url);
    } finally {
      setLoadingTrailer(false);
    }
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        {poster ? (
          <Image source={{ uri: poster }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterFallback]} />
        )}

        <View style={styles.scrim} />

        <Animated.View style={[styles.stamp, styles.likeStamp, likeStampStyle]}>
          <Text style={styles.likeStampText}>LIKE</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.nopeStamp, nopeStampStyle]}>
          <Text style={styles.nopeStampText}>NOPE</Text>
        </Animated.View>

        <Pressable style={styles.trailerButton} onPress={handleTrailerPress}>
          <Text style={styles.trailerIcon}>{loadingTrailer ? "…" : "▶"}</Text>
        </Pressable>

        <View style={styles.infoBar}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {movie.title.toUpperCase()}
            </Text>
            <View style={styles.scoreRow}>
              {ratings?.imdbRating != null && (
                <View style={styles.scoreBlock}>
                  <Text style={styles.scoreValue}>{ratings.imdbRating.toFixed(1)}</Text>
                  <Text style={styles.scoreLabel}>IMDb</Text>
                </View>
              )}
              {ratings?.rottenTomatoesScore != null && (
                <View style={styles.scoreBlock}>
                  <Text style={styles.scoreValue}>{ratings.rottenTomatoesScore}%</Text>
                  <Text style={styles.scoreLabel}>RT</Text>
                </View>
              )}
              <View style={styles.scoreBlock}>
                <Text style={styles.scoreValue}>{scorePercent}%</Text>
                <Text style={styles.scoreLabel}>TMDB</Text>
              </View>
            </View>
          </View>
          {movie.genres.length > 0 && (
            <View style={styles.genreRow}>
              {movie.genres.map((genre) => (
                <View key={genre} style={styles.genreChip}>
                  <Text style={styles.genreText}>{genre}</Text>
                </View>
              ))}
            </View>
          )}
          {movie.overview && (
            <Text style={styles.overview} numberOfLines={3}>
              {movie.overview}
            </Text>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.card,
  },
  poster: { width: "100%", height: "100%" },
  posterFallback: { backgroundColor: colors.surface2 },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "68%",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  trailerButton: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  trailerIcon: { color: "#fff", fontSize: 12, marginLeft: 2 },
  infoBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
  },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  title: { color: colors.foreground, fontFamily: fonts.display, fontSize: 20, flexShrink: 1, marginRight: spacing.sm },
  scoreRow: { flexDirection: "row", gap: spacing.sm },
  scoreBlock: { alignItems: "flex-end" },
  scoreValue: { color: colors.success, fontFamily: fonts.display, fontSize: 18 },
  scoreLabel: {
    color: colors.mutedForeground,
    fontFamily: fonts.sansBold,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  genreRow: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.sm, gap: spacing.xs },
  genreChip: {
    backgroundColor: `${colors.accent}1a`,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  genreText: {
    color: colors.accent,
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  overview: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  stamp: {
    position: "absolute",
    top: 32,
    borderWidth: 3,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  likeStamp: { left: spacing.xl, borderColor: colors.success, transform: [{ rotate: "-12deg" }] },
  nopeStamp: { right: spacing.xl, borderColor: colors.danger, transform: [{ rotate: "12deg" }] },
  likeStampText: { fontFamily: fonts.display, fontSize: 28, color: colors.success },
  nopeStampText: { fontFamily: fonts.display, fontSize: 28, color: colors.danger },
});
