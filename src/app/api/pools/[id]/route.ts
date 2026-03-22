import { NextResponse } from "next/server";
import { getPoolData } from "@/lib/data";
import { POOLS } from "@/lib/pools";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const pool = POOLS.find((p) => p.id === id);
  if (!pool) {
    return NextResponse.json(
      {
        error: `Pool not found: ${id}`,
        available: POOLS.map((p) => p.id),
      },
      { status: 404 }
    );
  }

  try {
    const data = await getPoolData(id);
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error fetching pool ${id}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch data for pool: ${id}` },
      { status: 500 }
    );
  }
}
