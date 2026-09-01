// tests.md §5.1 — points this file's Prisma connection at the dedicated
// toktickit_test database instead of the dev database in server/.env.
// Imported first (for its side effect only) by every lab-02 API test file,
// so process.env.DATABASE_URL is already overridden before src/prisma.ts's
// lazy PrismaClient singleton is ever constructed. Deliberately scoped to
// lab-02 test files only (not wired into vitest.config.ts globally) so the
// pre-existing tests/lab-01 suite keeps running against the seeded dev
// database untouched.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envTestPath = path.join(__dirname, "..", "..", ".env.test");

function loadEnvTest(): Record<string, string> {
  const vars: Record<string, string> = {};
  let contents: string;
  try {
    contents = readFileSync(envTestPath, "utf-8");
  } catch {
    throw new Error(
      `Missing ${envTestPath} — create it per tests.md §5.1, pointing DATABASE_URL at toktickit_test.`,
    );
  }
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

Object.assign(process.env, loadEnvTest());
