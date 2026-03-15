"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { revalidatePools } from "@/lib/actions";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      await revalidatePools();
      router.refresh();
    });
  };

  return (
    <Button onClick={handleRefresh} disabled={isPending} variant="outline">
      <RefreshCw
        className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`}
      />
      {isPending ? "Osvježavanje..." : "Osvježi podatke"}
    </Button>
  );
}
