import { getPoolData } from "@/lib/data";
import { PoolCardContent } from "./pool-card-content";

interface PoolCardProps {
  poolId: string;
}

export async function PoolCard({ poolId }: PoolCardProps) {
  const data = await getPoolData(poolId);
  return <PoolCardContent data={data} />;
}
