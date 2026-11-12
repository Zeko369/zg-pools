import Link from "next/link";
import { redirect } from "next/navigation";
import { hasOwnerSession } from "@/lib/owner";
import { getJobReport } from "@/lib/job-report";
import { POOLS } from "@/lib/pools";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Job runs · Bazeni Zagreb",
  robots: { index: false, follow: false },
};
const number = (n: number) => n.toLocaleString("en-GB");
const time = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: "Europe/Zagreb",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";
const pool = (id: string | null) =>
  POOLS.find((p) => p.id === id)?.shortName ?? id ?? "All pools";
const statusName: Record<string, string> = {
  unchanged: "Cache hit",
  updated: "Extracted",
  cooldown: "Cooldown",
  busy: "Already running",
  failed: "Failed",
  running: "Running",
};

export default async function JobRunsPage() {
  if (!(await hasOwnerSession())) redirect("/owner?next=/owner/jobs");
  const report = await getJobReport();
  const { summary } = report;
  const max = Math.max(
    1,
    ...report.daily.flatMap((d) => [d.cache_hits, d.ai_requests]),
  );
  const stats = [
    ["Source checks", summary.checks, "Last 24 hours"],
    ["Cache hits", summary.cache_hits, "Relevant source text unchanged"],
    ["AI requests", summary.ai.requests, "Includes retries and HTTP failures"],
    [
      "Extractions saved",
      summary.extractions,
      "Validated schedules written to Postgres",
    ],
    ["Check failures", summary.failures, "Last good schedules are retained"],
    [
      "Skipped checks",
      summary.skipped,
      "Cooldown or another check already running",
    ],
  ] as const;
  return (
    <main className="developer-page jobs-page" lang="en">
      <nav className="developer-nav" aria-label="Owner navigation">
        <Link href="/agenda">← Schedules</Link>
        <Link href="/owner">Owner access</Link>
        <Link href="/docs">API & MCP</Link>
        <form action="/owner/jobs" method="get">
          <Button variant="outline" size="sm" type="submit">
            Refresh view
          </Button>
        </form>
      </nav>
      <header>
        <p className="developer-eyebrow">BAZENI ZAGREB / OPERATIONS</p>
        <h1>Job runs</h1>
        <p>
          Source checks, cache savings and real model requests. All times are
          Europe/Zagreb.
        </p>
      </header>
      <p className="jobs-tracking">
        Metrics tracked since {time(report.trackingSince)}. Earlier model
        requests are not reconstructed. Requests with missing token usage:{" "}
        {number(summary.ai.unknown_usage)}.
      </p>
      <section className="job-stats" aria-label="Last 24 hours">
        {stats.map(([label, value, description]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <strong className="job-stat-value">{number(value)}</strong>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="job-overview-grid">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Past 7 days</h2>
            </CardTitle>
            <CardDescription>
              Unchanged-source cache hits and actual model requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="job-chart-legend">
              <span>
                <i className="cache-swatch" />
                Cache hits
              </span>
              <span>
                <i className="ai-swatch" />
                AI requests
              </span>
            </div>
            <div
              className="job-chart"
              role="img"
              aria-label={report.daily
                .map((d) =>
                  d.tracked
                    ? `${d.day}: ${d.cache_hits} cache hits, ${d.ai_requests} AI requests`
                    : `${d.day}: not tracked`,
                )
                .join(". ")}
            >
              {report.daily.map((d) => (
                <div className="job-chart-day" key={d.day}>
                  <span className="job-chart-count">
                    {d.tracked ? `${d.cache_hits} / ${d.ai_requests}` : "—"}
                  </span>
                  <div className="job-chart-bars">
                    <span
                      className="cache-bar"
                      style={{
                        height: d.tracked ? (d.cache_hits / max) * 120 : 0,
                      }}
                    />
                    <span
                      className="ai-bar"
                      style={{
                        height: d.tracked ? (d.ai_requests / max) * 120 : 0,
                      }}
                    />
                  </div>
                  <span>
                    {d.day.slice(8)}.{d.day.slice(5, 7)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Model usage</h2>
            </CardTitle>
            <CardDescription>Known usage in the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="job-usage">
              <dt>Input tokens</dt>
              <dd>{number(summary.ai.input_tokens)}</dd>
              <dt>Cached input tokens</dt>
              <dd>{number(summary.ai.cached_input_tokens)}</dd>
              <dt>Output tokens</dt>
              <dd>{number(summary.ai.output_tokens)}</dd>
              <dt>Reasoning tokens</dt>
              <dd>{number(summary.ai.reasoning_tokens)}</dd>
              <dt>HTTP / network failures</dt>
              <dd>{number(summary.ai.failures)}</dd>
            </dl>
            <p className="jobs-note">
              Reasoning is included in output tokens. Source cache hits avoid
              the model entirely; cached input tokens are a separate provider
              metric.
            </p>
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Recent source checks</h2>
          </CardTitle>
          <CardDescription>
            Latest 50 checks, including owner checks and every worker attempt.
            Page and API reads are not source checks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Pool</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>AI requests</TableHead>
                <TableHead>Tokens in / out</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="job-nowrap">
                    {time(r.started_at)}
                  </TableCell>
                  <TableCell>{pool(r.pool_id)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "failed"
                          ? "destructive"
                          : r.status === "updated"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {r.status === "running" &&
                      Date.now() - Date.parse(r.started_at) > 600_000
                        ? "Interrupted"
                        : (statusName[r.status] ?? r.status)}
                    </Badge>
                    {r.error ? <p className="jobs-note">{r.error}</p> : null}
                  </TableCell>
                  <TableCell>{r.trigger}</TableCell>
                  <TableCell>{r.ai_requests}</TableCell>
                  <TableCell>
                    {number(r.input_tokens)} / {number(r.output_tokens)}
                  </TableCell>
                  <TableCell>
                    {r.finished_at
                      ? `${Math.max(0, (Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000).toFixed(1)}s`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!report.runs.length ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    No checks recorded yet. The next scheduled check will appear
                    here.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <section className="job-overview-grid">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Pool freshness</h2>
            </CardTitle>
            <CardDescription>
              Last source check versus last AI extraction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pool</TableHead>
                  <TableHead>Checked</TableHead>
                  <TableHead>Extracted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.pools.map((p) => (
                  <TableRow key={p.pool_id}>
                    <TableCell>
                      {pool(p.pool_id)}
                      {p.last_error ? (
                        <Badge variant="destructive">Failed check</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{time(p.checked_at)}</TableCell>
                    <TableCell>{time(p.extracted_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Scheduler & queues</h2>
            </CardTitle>
            <CardDescription>
              Every 15 minutes, 05:00–21:00 Europe/Zagreb
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="job-schedules">
              {report.schedules.map((s) => (
                <li key={s.cron}>
                  <code>{s.cron}</code> · {s.timezone}
                </li>
              ))}
            </ul>
            <dl className="job-usage">
              {report.queues.map((q) => (
                <div className="job-queue-row" key={`${q.name}:${q.state}`}>
                  <dt>
                    {q.name.replace("pools-", "")} · {q.state}
                  </dt>
                  <dd>{q.count}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Queue history</h2>
          </CardTitle>
          <CardDescription>
            Latest 25 pg-boss pool jobs, including jobs from before metrics
            tracking. Queue history is retained for 7 days; source-check metrics
            remain in Postgres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Pool</TableHead>
                <TableHead>State / result</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Job ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="job-nowrap">
                    {time(j.created_on)}
                  </TableCell>
                  <TableCell>{pool(j.pool_id)}</TableCell>
                  <TableCell>
                    {j.state}
                    {j.result ? ` · ${statusName[j.result] ?? j.result}` : ""}
                  </TableCell>
                  <TableCell>{j.retry_count}</TableCell>
                  <TableCell>
                    <code>{j.id}</code>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="jobs-note">
        Read-only view · Refreshed {time(report.generatedAt)} ·{" "}
        <Link href="/api/jobs">JSON metrics</Link>
      </p>
    </main>
  );
}
