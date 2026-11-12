import { NextResponse } from "next/server";
import { POOLS } from "@/lib/pools";
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const responses = {
  "200": {
    description: "Schedules; inspect partial and per-pool errors/stale flags",
    content: { "application/json": { schema: ref("ScheduleResponse") } },
  },
  "400": {
    description:
      "Invalid week or date; date must fall within the current/next Zagreb week",
  },
  "503": {
    description:
      "All requested sources unavailable; response still contains per-pool errors",
  },
};
const parameters = [
  {
    name: "week",
    in: "query",
    schema: {
      type: "string",
      enum: ["current", "next", "both"],
      default: "both",
    },
  },
  {
    name: "date",
    in: "query",
    description:
      "ISO date in the current or next week. Takes precedence over week/compact.",
    schema: { type: "string", format: "date" },
  },
  {
    name: "compact",
    in: "query",
    description: "Return only today in Europe/Zagreb",
    schema: { type: "boolean", default: false },
  },
];
const schemas = {
  Slot: {
    type: "object",
    required: ["hours"],
    properties: {
      hours: { type: "string", pattern: "^\\d{2}:\\d{2} - \\d{2}:\\d{2}$" },
      lanes: { type: "string" },
      lanesEn: { type: "string", description: "English translation of lanes" },
    },
  },
  Day: {
    type: "object",
    required: ["date", "day", "status", "isHoliday", "pools"],
    properties: {
      date: { type: "string", description: "DD.MM.YYYY" },
      day: { type: "string" },
      status: {
        type: "string",
        enum: ["open", "closed", "unknown"],
        description:
          "open means published swimming hours exist, not that the pool is open at the current instant",
      },
      isHoliday: { type: "boolean" },
      holidayName: { type: "string" },
      reason: { type: "string" },
      reasonEn: {
        type: "string",
        description: "English translation of reason",
      },
      pools: {
        type: "array",
        items: {
          type: "object",
          required: ["poolType", "slots"],
          properties: {
            poolType: {
              type: "string",
              enum: ["olympic", "small", "children", "diving"],
            },
            slots: { type: "array", items: ref("Slot") },
          },
        },
      },
    },
  },
  Week: {
    type: "object",
    properties: {
      weekStart: { type: "string" },
      weekEnd: { type: "string" },
      days: { type: "array", items: ref("Day") },
    },
  },
  Pool: {
    type: "object",
    required: ["id", "name", "url"],
    properties: {
      id: { type: "string", enum: POOLS.map((p) => p.id) },
      name: { type: "string" },
      shortName: { type: "string" },
      area: { type: "string" },
      color: { type: "string" },
      url: { type: "string", format: "uri" },
    },
  },
  Availability: {
    type: "object",
    required: ["poolName", "alerts", "notices"],
    properties: {
      poolName: { type: "string" },
      currentWeek: ref("Week"),
      nextWeek: ref("Week"),
      day: ref("Day"),
      alerts: { type: "array", items: { type: "string" } },
      alertsEn: {
        type: "array",
        items: { type: "string" },
        description: "English alerts in the same order as alerts",
      },
      notices: { type: "array", items: { type: "string" } },
      noticesEn: {
        type: "array",
        items: { type: "string" },
        description: "English notices in the same order as notices",
      },
    },
  },
  Result: {
    type: "object",
    required: ["pool", "data", "error"],
    properties: {
      pool: ref("Pool"),
      data: {
        oneOf: [
          { type: "null" },
          {
            type: "object",
            required: ["pool", "availability", "fetchedAt", "stale", "model"],
            properties: {
              pool: ref("Pool"),
              availability: ref("Availability"),
              fetchedAt: {
                type: "string",
                format: "date-time",
                description:
                  "Last successful source check, including unchanged-content checks",
              },
              stale: {
                type: "boolean",
                description:
                  "A failed source check or overdue background worker retained earlier data from this week",
              },
              model: { type: "string", const: "gpt-6-luna" },
            },
          },
        ],
      },
      error: { type: ["string", "null"] },
    },
  },
  ScheduleResponse: {
    type: "object",
    required: ["timezone", "generatedAt", "partial", "results"],
    properties: {
      timezone: { type: "string", const: "Europe/Zagreb" },
      generatedAt: { type: "string", format: "date-time" },
      partial: { type: "boolean" },
      results: { type: "array", items: ref("Result") },
    },
  },
};
export function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Bazeni Zagreb — agent API",
      version: "2.3.0",
      description:
        "Citizen swimming schedules extracted with GPT-6 Luna and persisted in Postgres. Public GET requests only read saved schedules and never invoke AI. A pg-boss worker checks relevant facility tab/PDF content every 15 minutes from 05:00 through 21:00 Europe/Zagreb. Unchanged source text reuses the extraction; changed text, a new week or parser version triggers AI. Owner checks share a cross-instance lock and 60-second cooldown. No previous-week data is returned for a new week.",
    },
    servers: [{ url: "/api" }],
    paths: {
      "/jobs": {
        get: {
          operationId: "getJobRuns",
          summary:
            "Owner-only job runs, source-cache hits and actual model request attempts",
          description:
            "Read-only metrics. AI request counts include failed requests and SDK retries, beginning at trackingSince; earlier requests cannot be reconstructed. The browser owner session is also accepted. Interactive dashboard: /owner/jobs.",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description:
                "Job report: 24-hour summaries, 7-day daily counts, recent source checks, pool freshness and pg-boss queue history",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: [
                      "generatedAt",
                      "trackingSince",
                      "summary",
                      "runs",
                    ],
                    properties: {
                      generatedAt: { type: "string", format: "date-time" },
                      trackingSince: {
                        type: ["string", "null"],
                        format: "date-time",
                      },
                      summary: {
                        type: "object",
                        properties: {
                          checks: { type: "integer" },
                          cache_hits: { type: "integer" },
                          extractions: { type: "integer" },
                          failures: { type: "integer" },
                          skipped: { type: "integer" },
                          ai: {
                            type: "object",
                            description:
                              "Request attempts, HTTP failures, unknown usage and known token totals",
                          },
                        },
                      },
                      runs: {
                        type: "array",
                        items: {
                          type: "object",
                          description:
                            "Source-check outcome, timestamps, trigger, pg-boss job ID and associated AI requests",
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Owner cookie or valid Bearer token required",
            },
          },
        },
      },
      "/pools/catalog": {
        get: {
          operationId: "listPoolSources",
          summary: "Pool catalog; never scrapes or calls AI",
          responses: {
            "200": {
              description: "Pool sources",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      timezone: { type: "string" },
                      pools: { type: "array", items: ref("Pool") },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/pools": {
        get: {
          operationId: "getPoolSchedules",
          summary: "Read all saved schedules from Postgres",
          parameters,
          responses,
        },
      },
      "/pools/{id}": {
        get: {
          operationId: "getPoolSchedule",
          summary: "Read one pool",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", enum: POOLS.map((p) => p.id) },
            },
            ...parameters,
          ],
          responses: { ...responses, "404": { description: "Unknown pool" } },
        },
      },
      "/pools/today": {
        get: {
          operationId: "getTodaySchedules",
          summary: "Today's schedules in Europe/Zagreb",
          responses,
        },
      },
      "/pools/refresh": {
        post: {
          operationId: "refreshPoolSchedules",
          summary:
            "Check sources now; reuse unchanged extractions (60-second cooldown)",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    poolId: {
                      type: "string",
                      enum: POOLS.map((p) => p.id),
                      description: "Omit to refresh all pools",
                    },
                  },
                },
              },
            },
          },
          responses: {
            ...responses,
            "401": {
              description:
                "Missing/incorrect token or POOLS_API_SECRET not configured",
            },
            "404": { description: "Unknown poolId" },
          },
        },
      },
    },
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      schemas,
    },
  });
}
