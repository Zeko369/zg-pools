"use client";
import { useTransition } from "react";
import { changeLanguage } from "@/lib/language-action";
import { Button } from "@/components/ui/button";
import { useLanguage } from "./language-provider";

export function LanguageSwitcher() {
  const { language } = useLanguage();
  const [pending, startTransition] = useTransition();
  const next = language === "en" ? "hr" : "en";
  return (
    <Button
      variant="ghost"
      size="sm"
      lang={next}
      disabled={pending}
      aria-label={next === "en" ? "Switch to English" : "Prebaci na hrvatski"}
      onClick={() =>
        startTransition(async () => {
          await changeLanguage(next);
        })
      }
    >
      {next === "en" ? "English" : "Hrvatski"}
    </Button>
  );
}
