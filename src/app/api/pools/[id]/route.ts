import { schedulesResponse } from "@/lib/api";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return schedulesResponse(request, (await params).id);
}
