import { schedulesResponse } from "@/lib/api";
import { zagrebDate } from "@/lib/dates";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function GET(request: Request) {
  const url = new URL(request.url);
  url.searchParams.set("date", zagrebDate());
  return schedulesResponse(new Request(url, request));
}
