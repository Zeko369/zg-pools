import { afterEach, describe, expect, mock, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
mock.module("server-only", () => ({}));
const { handleMcp } = await import("../src/lib/mcp");
const original = process.env.POOLS_API_SECRET;
afterEach(() => {
  if (original === undefined) delete process.env.POOLS_API_SECRET;
  else process.env.POOLS_API_SECRET = original;
});
async function connect(owner = false) {
  const client = new Client({ name: "pools-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL("https://zg-pools.zeko.run/mcp"),
    {
      fetch: (async (url, init) => {
        const target = new URL(String(url));
        const headers = new Headers(init?.headers);
        headers.set("host", target.host);
        return handleMcp(
          new Request(`http://0.0.0.0:3000${target.pathname}`, {
            ...init,
            headers,
          }),
        );
      }) as typeof fetch,
      requestInit: owner
        ? { headers: { Authorization: "Bearer unit-test-owner" } }
        : undefined,
    },
  );
  await client.connect(transport);
  return client;
}
describe("real MCP client against the stateless endpoint", () => {
  test("negotiates, lists public tools/resources and reads the catalog and OpenAPI", async () => {
    const client = await connect();
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((t) => t.name)).toEqual([
        "list_pools",
        "get_schedules",
        "get_openapi",
      ]);
      const catalog = await client.callTool({
        name: "list_pools",
        arguments: {},
      });
      expect(
        (catalog.structuredContent as { pools: unknown[] }).pools,
      ).toHaveLength(8);
      expect((await client.listResources()).resources[0].uri).toBe(
        "pools://catalog",
      );
      expect(
        (await client.readResource({ uri: "pools://catalog" })).contents,
      ).toHaveLength(1);
      const spec = await client.callTool({
        name: "get_openapi",
        arguments: {},
      });
      expect(
        (spec.structuredContent as { paths: object }).paths,
      ).toHaveProperty("/jobs");
      expect(
        (await client.callTool({ name: "check_sources", arguments: {} }))
          .isError,
      ).toBe(true);
      expect(
        (
          await client.callTool({
            name: "get_schedules",
            arguments: { poolId: "not-a-pool" },
          })
        ).isError,
      ).toBe(true);
    } finally {
      await client.close();
    }
  });
  test("owner tools require a valid bearer token on each request", async () => {
    process.env.POOLS_API_SECRET = "unit-test-owner";
    const client = await connect(true);
    try {
      expect((await client.listTools()).tools.map((t) => t.name)).toContain(
        "get_job_runs",
      );
    } finally {
      await client.close();
    }
    const response = await handleMcp(
      new Request("https://zg-pools.zeko.run/mcp", {
        method: "POST",
        headers: { Authorization: "Bearer invalid" },
      }),
    );
    expect(response.status).toBe(401);
  });
  test("rejects foreign origins, malformed JSON and oversized requests", async () => {
    const response = await handleMcp(
      new Request("https://zg-pools.zeko.run/mcp", {
        method: "POST",
        headers: { Origin: "https://evil.example" },
      }),
    );
    expect(response.status).toBe(403);
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    expect(
      (
        await handleMcp(
          new Request("https://zg-pools.zeko.run/mcp", {
            method: "POST",
            headers,
            body: "invalid json",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handleMcp(
          new Request("https://zg-pools.zeko.run/mcp", {
            method: "POST",
            headers,
            body: " ".repeat(65537),
          }),
        )
      ).status,
    ).toBe(413);
  });
});
