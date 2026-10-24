import { PoolDashboard } from "@/components/pool-dashboard";
import { POOLS } from "./pools";
import { getWeekDates, zagrebDate } from "./dates";
import { hasOwnerSession } from "./owner";
// Static shell only. Extraction starts in the visible browser, never during builds/prefetch.
export async function DashboardPage({ mode }: { mode: "calendar" | "agenda" }) {
  return (
    <PoolDashboard
      catalog={POOLS}
      mode={mode}
      weeks={getWeekDates()}
      today={zagrebDate()}
      canRefresh={await hasOwnerSession()}
    />
  );
}
