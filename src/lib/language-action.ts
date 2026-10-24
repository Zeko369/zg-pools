"use server";
import { cookies } from "next/headers";
import { isLanguage, LANGUAGE_COOKIE } from "./i18n";

export async function changeLanguage(language: unknown) {
  if (!isLanguage(language)) throw new Error("Unsupported language");
  (await cookies()).set(LANGUAGE_COOKIE, language, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
}
