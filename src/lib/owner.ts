import "server-only";
import { cookies } from "next/headers";
import { OWNER_COOKIE, validOwnerSession } from "./owner-session";

export async function hasOwnerSession() {
  const cookie = (await cookies()).get(OWNER_COOKIE)?.value;
  return validOwnerSession(cookie, process.env.POOLS_API_SECRET);
}
