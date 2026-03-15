import { Suspense } from "react";
import { PoolCard } from "@/components/pool-card";
import { PoolCardSkeleton } from "@/components/pool-card-skeleton";
import { RefreshButton } from "@/components/refresh-button";
import { POOLS } from "@/lib/pools";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto py-8 px-4">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Bazeni Zagreb</h1>
            <RefreshButton />
          </div>
          <div className="grid gap-6">
            {POOLS.map((pool) => (
              <Suspense
                key={pool.id}
                fallback={<PoolCardSkeleton poolName={pool.name} />}
              >
                <PoolCard poolId={pool.id} />
              </Suspense>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
