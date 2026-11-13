import type { CSSProperties } from "react";

// Theme palettes in globals.css drive events, markers, filters and details together.
const POOL_COLORS = [
  "teal",
  "blue",
  "purple",
  "orange",
  "green",
  "pink",
  "indigo",
  "red",
];
export function poolColorStyle(color: string): CSSProperties {
  const palette = POOL_COLORS.includes(color) ? color : "teal";
  return {
    "--tone": `var(--pool-${palette}-tone)`,
    "--tint": `var(--pool-${palette}-tint)`,
    "--shade": `var(--pool-${palette}-ink)`,
  } as CSSProperties;
}
