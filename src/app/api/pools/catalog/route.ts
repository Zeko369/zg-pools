import { NextResponse } from "next/server";
import { POOLS } from "@/lib/pools";
export function GET() {
  return NextResponse.json({ timezone: "Europe/Zagreb", pools: POOLS });
}
