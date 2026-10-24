import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { schedulesResponse } from "@/lib/api";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function POST(request: Request) {
  const secret = process.env.POOLS_API_SECRET;
  const token = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  )
    return NextResponse.json(
      { error: "Send a Bearer token matching the server's POOLS_API_SECRET" },
      { status: 401 },
    );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON object; use {} to refresh all pools" },
      { status: 400 },
    );
  }
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    ("poolId" in body &&
      (typeof body.poolId !== "string" || !body.poolId.trim()))
  )
    return NextResponse.json(
      { error: "poolId must be a string" },
      { status: 400 },
    );
  return schedulesResponse(
    request,
    "poolId" in body ? (body.poolId as string) : undefined,
    true,
  );
}
