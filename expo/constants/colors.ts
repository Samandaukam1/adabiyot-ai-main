export const lightTheme = {
  bg: "#FFFFFF",
  bgElevated: "#F8F9FA",
  bgCard: "#FFFFFF",
  bgGlass: "rgba(255,255,255,0.92)",
  surface: "#F1F3F5",
  border: "rgba(0,0,0,0.08)",
  borderStrong: "rgba(82,183,136,0.20)",
  text: "#0D1B2A",
  textDim: "#4A5568",
  textMuted: "#A0AEC0",
  primary: "#52B788",
  primaryDim: "#2D9B6F",
  secondary: "#1D3557",
  gold: "#F4A261",
  success: "#2DC653",
  soft: "#E8F5EE",
  isDark: false,
};

export const darkTheme = {
  bg: "#0D1117",
  bgElevated: "#161B22",
  bgCard: "#1C2128",
  bgGlass: "rgba(28,33,40,0.94)",
  surface: "#21262D",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(82,183,136,0.22)",
  text: "#E6EDF3",
  textDim: "#8D96A0",
  textMuted: "#484F58",
  primary: "#52B788",
  primaryDim: "#3D9B70",
  secondary: "#74C9A4",
  gold: "#F4A261",
  success: "#2DC653",
  soft: "rgba(82,183,136,0.14)",
  isDark: true,
};

export type AppTheme = typeof lightTheme;

const theme = lightTheme;

export default {
  light: {
    text: theme.text,
    background: theme.bg,
    tint: theme.primary,
    tabIconDefault: theme.textMuted,
    tabIconSelected: theme.primary,
  },
  ...theme,
};

export const palette = theme;
