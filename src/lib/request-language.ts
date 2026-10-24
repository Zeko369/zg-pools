import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { detectLanguage, LANGUAGE_COOKIE } from "./i18n";

export const requestLanguage = cache(async () => {
  const [cookieStore, requestHeaders] = await Promise.all([
    cookies(),
    headers(),
  ]);
  return detectLanguage(
    requestHeaders.get("accept-language"),
    cookieStore.get(LANGUAGE_COOKIE)?.value,
  );
});
