"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLanguage } from "./language-provider";

const options = [
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
  { value: "system", Icon: Monitor },
] as const;

export function ThemeSwitcher() {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      className="theme-switcher"
      aria-label={t.theme}
      value={mounted ? (theme ?? "") : ""}
      disabled={!mounted}
      onValueChange={(value) => {
        if (value) setTheme(value);
      }}
    >
      {options.map(({ value, Icon }) => (
        <ToggleGroupItem
          key={value}
          value={value}
          aria-label={t.themes[value]}
          title={t.themes[value]}
          className="min-h-10 min-w-9"
        >
          <Icon aria-hidden="true" />
          <span className="sr-only min-[851px]:not-sr-only">
            {t.themes[value]}
          </span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
