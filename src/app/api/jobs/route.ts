import { hasOwnerSession } from "@/lib/owner";
import { bearerOwner } from "@/lib/api-owner";
import { getJobReport } from "@/lib/job-report";
import { NO_STORE } from "@/lib/api";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!bearerOwner(request) && !(await hasOwnerSession()))
    return Response.json(
      { error: "Owner access required" },
      { status: 401, headers: NO_STORE },
    );
  return Response.json(await getJobReport(), { headers: NO_STORE });
}
