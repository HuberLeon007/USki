import { useColorScheme } from "react-native";

import { Colors } from "@/constants/theme";

/** USki brand lila, matches the web primary. */
export const PRIMARY = "#7c3aed";

/** Per-state accent colors used across study stats (new / learning / due). */
export const STATE_COLORS = {
  new: "#3b82f6",
  learning: "#f59e0b",
  due: "#ef4444",
  done: "#22c55e",
} as const;

/** Resolve the active light/dark color set for the current device scheme. */
export function useColors() {
  const scheme = useColorScheme();
  return Colors[scheme === "dark" ? "dark" : "light"];
}
