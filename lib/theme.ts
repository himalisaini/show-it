export const colors = {
  background: "#0f0f13",
  foreground: "#ffffff",
  surface: "#1c1c22",
  surface2: "#26262e",
  accent: "#ff3b5c",
  accentForeground: "#ffffff",
  success: "#34d399",
  danger: "#ef4444",
  muted: "#2a2a32",
  mutedForeground: "#94a3b8",
  hairline: "rgba(255,255,255,0.1)",
};

export const fonts = {
  display: "ArchivoBlack_400Regular",
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemibold: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
  sansExtrabold: "Inter_800ExtraBold",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  screen: 20,
};

export const layout = {
  // Caps content width on tablets/wide screens so phone-proportioned elements
  // (room code boxes, buttons) don't stretch into oversized, broken-looking
  // shapes. No effect on actual phone widths.
  maxContentWidth: 480,
};

export const radii = {
  chip: 6,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  screen: 44,
};

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 12,
  },
  accentStrong: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 10,
  },
};
