import { schedulesResponse } from "@/lib/api";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function GET(request: Request) {
  return schedulesResponse(request);
}
