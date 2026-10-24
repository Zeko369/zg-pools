"use server";
import { getPoolResults } from "./data";
import { hasOwnerSession } from "./owner";
// Authorization is enforced here as well as in the UI. The cache shares the API cooldown.
export async function revalidatePools() {
  if (!(await hasOwnerSession())) return { error: "owner_required" };
  return { results: await getPoolResults({ force: true }) };
}
