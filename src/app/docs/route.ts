import swagger from "swagger-ui-dist/package.json";

export function GET() {
  const version = encodeURIComponent(swagger.version);
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>API &amp; MCP · Bazeni Zagreb</title><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/api/swagger/swagger-ui.css?v=${version}"><style>
  *{box-sizing:border-box}body{margin:0;background:#fafaf9;color:#18201e;font-family:system-ui,sans-serif}main{max-width:1280px;margin:auto;padding:32px 24px 60px}nav{display:flex;gap:24px;flex-wrap:wrap;font-size:14px;margin-bottom:32px}a{color:inherit}header h1{font-size:40px;letter-spacing:-.04em;margin:8px 0}header p,.connection p{color:#59615e;line-height:1.6}.eyebrow{font-size:11px;letter-spacing:.12em}header{margin-bottom:24px}.connection{background:white;border:1px solid #deded8;border-radius:12px;padding:24px;margin-bottom:24px}.connection h2{font-size:19px;margin:0 0 12px}.connection>code{font-size:16px;overflow-wrap:anywhere}.connection p{font-size:14px}.swagger-panel{background:white;border:1px solid #deded8;border-radius:12px;padding:12px;overflow:hidden}.swagger-ui .info{margin:24px 0}.swagger-ui .wrapper{padding:0 12px}.swagger-ui .opblock-summary-path{overflow-wrap:anywhere;min-width:0}@media(max-width:720px){main{padding:24px 14px 40px}nav{gap:12px}.swagger-panel{padding:0}.swagger-ui .opblock .opblock-summary{flex-wrap:wrap;align-items:flex-start}.swagger-ui .opblock-summary-description{flex-basis:100%;padding-top:6px}}
  </style></head><body><main><nav aria-label="Developer navigation"><a href="/agenda">← Schedules</a><a href="/api/openapi">OpenAPI JSON</a><a href="/owner/jobs">Job runs</a></nav><header><p class="eyebrow">BAZENI ZAGREB / DEVELOPERS</p><h1>API &amp; MCP</h1><p>Read saved schedules instantly. Public reads never scrape sources or invoke AI.</p></header><section class="connection" aria-labelledby="mcp-heading"><h2 id="mcp-heading">Connect an assistant</h2><p>Remote MCP endpoint · Streamable HTTP</p><code>https://zg-pools.zeko.run/mcp</code><p>Public tools: <code>list_pools</code>, <code>get_schedules</code>, <code>get_openapi</code>. For owner job metrics and source checks, send your owner key as a Bearer token in the Authorization header.</p></section><section class="swagger-panel" aria-label="Swagger API explorer"><div id="swagger-ui"></div></section></main><script src="/api/swagger/swagger-ui-bundle.js?v=${version}"></script><script>window.ui=SwaggerUIBundle({url:"/api/openapi",dom_id:"#swagger-ui",deepLinking:true,displayRequestDuration:true,defaultModelsExpandDepth:-1,validatorUrl:null,persistAuthorization:false,queryConfigEnabled:false});</script></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
