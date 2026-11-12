import { handleMcp } from "@/lib/mcp";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export const POST = handleMcp;
export function GET() {
  return Response.json(
    {
      endpoint: "/mcp",
      transport: "Streamable HTTP",
      method: "POST",
      docs: "/docs",
    },
    { status: 405, headers: { Allow: "POST" } },
  );
}
export const DELETE = GET;
