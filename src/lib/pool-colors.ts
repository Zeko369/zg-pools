import type { CSSProperties } from "react";

// One palette drives events, sidebar markers, filters and source details.
export const POOL_COLORS = {
  teal: { main: "#009c8d", tint: "#dff4ef", ink: "#115f56" },
  blue: { main: "#387fc1", tint: "#e8f1fb", ink: "#20548d" },
  purple: { main: "#9063b5", tint: "#f1e8f8", ink: "#624084" },
  orange: { main: "#c48235", tint: "#fbeddc", ink: "#85551d" },
  green: { main: "#5a964a", tint: "#e9f2e1", ink: "#3f6c31" },
  pink: { main: "#bb6f8c", tint: "#f8e6ed", ink: "#873e5b" },
  indigo: { main: "#5968b3", tint: "#eceefa", ink: "#3f4c88" },
  red: { main: "#c16450", tint: "#fcece5", ink: "#8c4436" },
} as const;
export function poolColorStyle(color: string): CSSProperties {
  const palette =
    POOL_COLORS[color as keyof typeof POOL_COLORS] ?? POOL_COLORS.teal;
  return {
    "--tone": palette.main,
    "--tint": palette.tint,
    "--shade": palette.ink,
  } as CSSProperties;
}
