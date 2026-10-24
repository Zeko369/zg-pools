"use server";
import { getPoolResults } from "./data";
// Explicit same-origin UI action; RequestCache imposes the same cooldown as the agent API.
export async function revalidatePools() {
  return getPoolResults({ force: true });
}
