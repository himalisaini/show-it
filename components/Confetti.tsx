import { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

const COLORS = ["#ff3b5c", "#34d399", "#facc15", "#60a5fa", "#ffffff"];
const PIECE_COUNT = 22;

function ConfettiPiece({ index, height }: { index: number; height: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const delay = (index * 130) % 2400;
    const duration = 1800 + ((index * 91) % 900);
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false)
    );
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: progress.value * (height + 80) - 40 },
      { rotate: `${progress.value * 720 + index * 45}deg` },
    ],
    opacity: progress.value < 0.05 ? progress.value * 20 : progress.value > 0.9 ? (1 - progress.value) * 10 : 1,
  }));

  const left = `${(index * 37) % 100}%` as const;
  const color = COLORS[index % COLORS.length];

  return <Animated.View style={[styles.piece, { left, backgroundColor: color }, style]} />;
}

export default function Confetti() {
  const { height } = useWindowDimensions();
  return (
    <View style={styles.container} pointerEvents="none">
      {Array.from({ length: PIECE_COUNT }).map((_, i) => (
        <ConfettiPiece key={i} index={i} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  piece: { position: "absolute", top: 0, width: 6, height: 12, borderRadius: 2 },
});
