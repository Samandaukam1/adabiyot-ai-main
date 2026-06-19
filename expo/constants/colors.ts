const theme = {
  bg: "#F8F5F0",
  bgElevated: "#F0EBE3",
  bgCard: "#FFFFFF",
  bgGlass: "rgba(255,255,255,0.82)",
  surface: "#F0EBE3",
  border: "rgba(0,0,0,0.07)",
  borderStrong: "rgba(45,106,79,0.20)",
  text: "#1A1A1A",
  textDim: "#5C5C5C",
  textMuted: "#9A9A9A",
  primary: "#2D6A4F",
  primaryDim: "#1B4D38",
  secondary: "#52B788",
  gold: "#D4A843",
  success: "#52B788",
  soft: "#E8F4EE",
};

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
