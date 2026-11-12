import { migrate } from "../src/lib/migrate";
import { closeDatabase } from "../src/lib/db";

try {
  await migrate();
  console.log("Schedule database migrations applied");
} finally {
  await closeDatabase();
}
