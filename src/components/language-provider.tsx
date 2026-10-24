"use client";
import { createContext, useContext, type ReactNode } from "react";
import { messages, type Language } from "@/lib/i18n";

const LanguageContext = createContext<Language>("en");
export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  return (
    <LanguageContext.Provider value={language}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  const language = useContext(LanguageContext);
  return { language, t: messages[language] };
}
