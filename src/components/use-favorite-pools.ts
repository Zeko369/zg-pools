"use client";
import { useEffect, useState } from "react";
import type { Pool } from "@/lib/pools";

export const FAVORITES_KEY = "zg-pools:favorites:v1";
export function useFavoritePools(catalog: Pool[]) {
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    function read() {
      try {
        const saved: unknown = JSON.parse(
          localStorage.getItem(FAVORITES_KEY) ?? "[]",
        );
        setFavorites(
          Array.isArray(saved)
            ? catalog
                .filter((pool) => saved.includes(pool.id))
                .map((pool) => pool.id)
            : [],
        );
      } catch {
        // Storage can be unavailable or contain malformed data. Favorites still work in memory.
      }
    }
    read();
    function onStorage(event: StorageEvent) {
      if (event.key === FAVORITES_KEY || event.key === null) read();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [catalog]);
  function toggleFavorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((item) => item !== id)
      : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      /* Keep the in-memory selection. */
    }
  }
  return { favorites, toggleFavorite };
}
