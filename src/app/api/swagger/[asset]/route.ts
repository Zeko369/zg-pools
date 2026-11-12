import { readFile } from "node:fs/promises";
import { join } from "node:path";

const assets = {
  "swagger-ui-bundle.js": "application/javascript; charset=utf-8",
  "swagger-ui.css": "text/css; charset=utf-8",
} as const;
const cache = new Map<string, Promise<Buffer>>();
export async function GET(
  request: Request,
  { params }: { params: Promise<{ asset: string }> },
) {
  const { asset } = await params;
  if (!Object.hasOwn(assets, asset))
    return new Response("Not found", { status: 404 });
  let bytes = cache.get(asset);
  if (!bytes) {
    bytes = readFile(
      join(process.cwd(), "node_modules/swagger-ui-dist", asset),
    );
    cache.set(asset, bytes);
  }
  return new Response(new Uint8Array(await bytes), {
    headers: {
      "Content-Type": assets[asset as keyof typeof assets],
      "Cache-Control": new URL(request.url).searchParams.has("v")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600",
    },
  });
}
