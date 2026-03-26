// Hachiko Kids Brand Identity
// Source: brand/hachiko_kids_brandbook.html

export const colors = {
  purple: {
    50: "#F0EDFF",
    100: "#D4CCFF",
    200: "#B8AAFF",
    300: "#9C88FF",
    500: "#7B61FF",
    700: "#5A3FD6",
    900: "#2D1F6B",
  },
  mint: {
    50: "#ECFDF5",
    100: "#D1FAE5",
    200: "#A7F3D0",
    300: "#6EE7B7",
    500: "#34D399",
    700: "#059669",
    900: "#064E3B",
  },
  orange: {
    50: "#FFF7ED",
    100: "#FFEDD5",
    200: "#FED7AA",
    300: "#FDBA74",
    500: "#F97316",
    700: "#C2410C",
    900: "#7C2D12",
  },
  gray: {
    50: "#F9FAFB",
    100: "#F3F4F6",
    200: "#E5E7EB",
    300: "#D1D5DB",
    500: "#6B7280",
    700: "#374151",
    900: "#111827",
  },
  red: {
    50: "#FEE2E2",
    100: "#FECACA",
    500: "#EF4444",
    700: "#B91C1C",
    900: "#991B1B",
  },
  dark: "#1E1145",
  white: "#FFFFFF",
};

// Semantic aliases
export const theme = {
  bg: colors.gray[50],
  bgCard: colors.white,
  primary: colors.purple[500],
  primaryLight: colors.purple[50],
  primaryDark: colors.purple[700],
  secondary: colors.mint[500],
  secondaryLight: colors.mint[50],
  accent: colors.orange[500],
  accentLight: colors.orange[50],
  text: colors.gray[900],
  textSecondary: colors.gray[500],
  textLight: colors.gray[300],
  dark: colors.dark,
  border: colors.gray[200],
};

export const fonts = {
  display: "Fredoka",
  displaySemiBold: "Fredoka-SemiBold",
  displayBold: "Fredoka-Bold",
  body: "Inter",
  bodyMedium: "Inter-Medium",
  bodySemiBold: "Inter-SemiBold",
};
