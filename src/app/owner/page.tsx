import type { Metadata } from "next";
import Link from "next/link";
import { hasOwnerSession } from "@/lib/owner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { signInOwner, signOutOwner } from "./actions";
import { requestLanguage } from "@/lib/request-language";
import { messages } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${messages[await requestLanguage()].ownerAccess} · Bazeni Zagreb`,
    robots: { index: false, follow: false },
  };
}

export default async function OwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [owner, { error }, language] = await Promise.all([
    hasOwnerSession(),
    searchParams,
    requestLanguage(),
  ]);
  const t = messages[language];
  const configured = !!process.env.POOLS_API_SECRET;
  return (
    <main className="owner-page">
      <div className="owner-navigation">
        <Link href="/calendar" prefetch={false}>
          ← {t.backToSchedule}
        </Link>
        <LanguageSwitcher />
      </div>
      <h1>{t.ownerAccess}</h1>
      {owner ? (
        <>
          <p>{t.ownerEnabled}</p>
          <form action={signOutOwner}>
            <Button type="submit">{t.signOut}</Button>
          </form>
        </>
      ) : configured ? (
        <>
          <p>{t.ownerIntro}</p>
          <form action={signInOwner}>
            <FieldGroup>
              <Field data-invalid={error === "invalid" || undefined}>
                <FieldLabel htmlFor="owner-key">{t.ownerKey}</FieldLabel>
                <Input
                  id="owner-key"
                  name="key"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={4096}
                  aria-invalid={error === "invalid" || undefined}
                  aria-describedby={
                    error === "invalid" ? "owner-error" : undefined
                  }
                />
                {error === "invalid" && (
                  <FieldError id="owner-error">{t.invalidKey}</FieldError>
                )}
              </Field>
              <Field>
                <Button type="submit">{t.enableRefresh}</Button>
              </Field>
            </FieldGroup>
          </form>
        </>
      ) : (
        <p>{t.ownerUnconfigured}</p>
      )}
    </main>
  );
}
