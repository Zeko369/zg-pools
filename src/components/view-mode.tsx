"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ViewMode = "today" | "week";

const ViewModeContext = createContext<{
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}>({
  viewMode: "today",
  setViewMode: () => {},
});

export function useViewMode() {
  return useContext(ViewModeContext);
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>("today");

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function ViewToggle() {
  const { viewMode, setViewMode } = useViewMode();

  return (
    <div className="flex gap-1">
      <Button
        variant={viewMode === "today" ? "default" : "outline"}
        size="sm"
        onClick={() => setViewMode("today")}
      >
        Danas
      </Button>
      <Button
        variant={viewMode === "week" ? "default" : "outline"}
        size="sm"
        onClick={() => setViewMode("week")}
      >
        Tjedan
      </Button>
    </div>
  );
}
