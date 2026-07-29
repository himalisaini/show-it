import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../lib/theme";

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

type Props = { name: string; variant?: "surface" | "accent" };

export default function Avatar({ name, variant = "surface" }: Props) {
  return (
    <View style={[styles.circle, variant === "accent" ? styles.accent : styles.surface]}>
      <Text style={styles.initials}>{initialsFor(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  surface: { backgroundColor: colors.surface2 },
  accent: { backgroundColor: colors.accent },
  initials: { color: "#fff", fontFamily: fonts.sansBold, fontSize: 12 },
});
