import { migrate } from "../src/lib/migrate";
import { startJobs } from "../src/lib/jobs";
import { closeDatabase } from "../src/lib/db";

if (!process.env.OPENAI_API_KEY)
  throw new Error("Set OPENAI_API_KEY before starting the pool worker");
await migrate();
const boss = await startJobs();
console.log("Pool worker ready: every 15 minutes, 05:00–21:00 Europe/Zagreb");
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await boss.stop({ graceful: true, timeout: 300_000 });
  await closeDatabase();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
