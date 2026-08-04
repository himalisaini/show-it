import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types/navigation";
import { getDeviceId } from "../lib/device";
import { createRoom, joinRoom } from "../lib/rooms";
import { showAlert } from "../lib/alert";
import { colors, fonts, layout, radii, shadows, spacing } from "../lib/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [joinError, setJoinError] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return showAlert("Enter your name first");
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const room = await createRoom(deviceId, name.trim(), {
        platforms: [],
        genreIds: [],
        maxRuntimeMinutes: null,
        industry: null,
      });
      navigation.navigate("Lobby", { roomCode: room.code });
    } catch (err) {
      showAlert("Couldn't create room", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!name.trim()) return showAlert("Enter your name first");
    setJoinError(false);
    if (joinCode.trim().length !== 4) {
      setJoinError(true);
      return;
    }
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const room = await joinRoom(joinCode.trim(), deviceId, name.trim());
      navigation.navigate("Lobby", { roomCode: room.code });
    } catch (err) {
      setJoinError(true);
      showAlert("Couldn't join room", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const codeDigits = [0, 1, 2, 3].map((i) => joinCode[i] ?? "");

  return (
    <View style={styles.container}>
      <View style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>SHOW-IT</Text>
        <Text style={styles.tagline}>Swipe · Match · Watch</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Your Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Alex"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <Pressable style={styles.primaryButton} onPress={handleCreate}>
              <Text style={styles.primaryButtonText}>Start a Watch Party</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Room Code</Text>
              <View style={styles.codeRowWrapper}>
                <View style={styles.codeRow}>
                  {codeDigits.map((digit, i) => (
                    <View
                      key={i}
                      style={[
                        styles.codeBox,
                        joinError && styles.codeBoxError,
                      ]}
                    >
                      <Text style={[styles.codeDigit, joinError && styles.codeDigitError]}>{digit}</Text>
                    </View>
                  ))}
                </View>
                <TextInput
                  style={styles.overlayCodeInput}
                  value={joinCode}
                  onChangeText={(text) => {
                    setJoinError(false);
                    setJoinCode(text.replace(/[^0-9]/g, "").slice(0, 4));
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
              {joinError && <Text style={styles.errorText}>Room not found. Double-check the code.</Text>}
              <Pressable style={styles.secondaryButton} onPress={handleJoin}>
                <Text style={styles.secondaryButtonText}>Join Room</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      <Text style={styles.footer}>Bring 2–8 friends. iOS · Android · Web</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.screen,
    paddingTop: 72,
    paddingBottom: 32,
    alignItems: "center",
  },
  content: { flex: 1, width: "100%", maxWidth: layout.maxContentWidth },
  header: { alignItems: "center", marginBottom: spacing.xxl },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 44,
    color: colors.accent,
    fontStyle: "italic",
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  form: { flex: 1 },
  field: { marginBottom: spacing.lg },
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.hairline,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    fontSize: 15,
    color: colors.foreground,
    fontFamily: fonts.sans,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    ...shadows.accentStrong,
  },
  primaryButtonText: { color: colors.accentForeground, fontFamily: fonts.sansBold, fontSize: 15 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.hairline },
  dividerText: {
    marginHorizontal: spacing.md,
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.mutedForeground,
  },
  codeRowWrapper: { position: "relative" },
  codeRow: { flexDirection: "row", gap: spacing.sm },
  overlayCodeInput: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  codeBox: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.hairline,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  codeBoxError: { borderColor: colors.danger },
  codeDigit: { fontFamily: fonts.display, fontSize: 24, color: colors.foreground },
  codeDigitError: { color: colors.danger },
  hiddenCodeInput: { position: "absolute", width: 1, height: 1, opacity: 0 },
  errorText: { color: colors.danger, fontFamily: fonts.sansSemibold, fontSize: 11, marginTop: spacing.sm },
  secondaryButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: { color: colors.foreground, fontFamily: fonts.sansSemibold, fontSize: 14 },
  footer: { textAlign: "center", color: colors.mutedForeground, fontSize: 10, fontFamily: fonts.sans },
});
