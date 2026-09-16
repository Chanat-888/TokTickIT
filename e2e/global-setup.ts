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
//
// docs/lab-03 addition: "User" is now truncated too (cascading Session,
// PublicComment, InternalNote along with Ticket/Attachment) — Lab 2 never
// needed this since its Requesters had no mutable auth state, but Lab 3's
// login/password-change/admin-edit flows do, and seed.ts's upsert leaves an
// already-existing row's fields untouched (`update: {}`). Without this, a
// User left mid-test-run in a previous session (password already changed,
// deactivated, role edited, etc.) would silently desync the E2E suite from
// the fresh mustChangePassword:true/"ChangeMe123!" state its specs assume.
const RESET_SQL = 'TRUNCATE "Attachment", "Ticket", "User" RESTART IDENTITY CASCADE;';

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
