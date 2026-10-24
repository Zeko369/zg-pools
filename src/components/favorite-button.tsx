"use client";
import { Star } from "lucide-react";
import { Button } from "./ui/button";
import { useLanguage } from "./language-provider";
import type { Pool } from "@/lib/pools";
export function FavoriteButton({
  pool,
  favorite,
  onToggle,
}: {
  pool: Pool;
  favorite: boolean;
  onToggle: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="favorite-button"
      aria-pressed={favorite}
      aria-label={`${favorite ? t.removeFavorite : t.addFavorite} ${pool.shortName}`}
      onClick={onToggle}
    >
      <Star fill={favorite ? "currentColor" : "none"} />
    </Button>
  );
}
