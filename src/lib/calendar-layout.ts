/** A deliberate fan of overlapping cards. Exposed left rails keep every
 * facility reachable; hover/focus raises a card without moving its actual time. */
export function overlapPlacement(index: number, count: number) {
  const step = count > 1 ? Math.min(14, 50 / (count - 1)) : 0;
  return { left: index * step, width: 100 - Math.max(0, count - 1) * step };
}
