import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, "..", "server");

// Same truncate-then-seed pattern used manually during Issue #15: wipe the
// tables that grow from running the E2E suite (Attachment references
// Ticket, so it must be truncated first/together) and restart their id
// sequences, then reseed to the fixed 25/5/0 ticket split (Alex/Sam/Priya)
// that the specs assert against. Runs against server/.env's DATABASE_URL
// (the dev DB) — never toktickit_test.
const RESET_SQL = 'TRUNCATE "Attachment", "Ticket" RESTART IDENTITY CASCADE;';

export default function globalSetup(): void {
  console.log("[global-setup] Resetting dev DB: truncating Attachment/Ticket, then reseeding...");

  execSync("npx prisma db execute --stdin --schema prisma/schema.prisma", {
    cwd: SERVER_DIR,
    input: RESET_SQL,
    stdio: ["pipe", "inherit", "inherit"],
  });

  execSync("npm run prisma:seed", {
    cwd: SERVER_DIR,
    stdio: "inherit",
  });

  console.log("[global-setup] Dev DB reset complete — seeded to 25/5/0 tickets (Alex/Sam/Priya).");
}
