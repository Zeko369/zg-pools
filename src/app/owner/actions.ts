"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createOwnerSession,
  matchesSecret,
  OWNER_COOKIE,
  OWNER_SESSION_SECONDS,
} from "@/lib/owner-session";

export async function signInOwner(formData: FormData) {
  const secret = process.env.POOLS_API_SECRET;
  if (!secret) redirect("/owner?error=unavailable");
  const key = formData.get("key");
  if (typeof key !== "string" || !matchesSecret(key, secret))
    redirect("/owner?error=invalid");

  (await cookies()).set(OWNER_COOKIE, createOwnerSession(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: OWNER_SESSION_SECONDS,
  });
  redirect("/agenda");
}

export async function signOutOwner() {
  (await cookies()).delete(OWNER_COOKIE);
  redirect("/agenda");
}
