"use client";

import { useEffect, useState } from "react";
import { zagrebTime, type ZagrebTime } from "@/lib/dates";

export function useZagrebTime() {
  // Match the server render before reading the browser clock.
  const [now, setNow] = useState<ZagrebTime | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function update() {
      clearTimeout(timer);
      const date = new Date();
      setNow(zagrebTime(date));
      timer = setTimeout(update, 60_000 - (date.getTime() % 60_000));
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") update();
    }
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
  return now;
}
