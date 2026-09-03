// Issue 18 — Attachment file storage (api-spec.md §7).
// Files are stored on local disk under server/uploads/ (gitignored) with a
// randomly generated storedFilename; the download/removal endpoints that
// read this directory back are a later Issue.

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

export async function storeUploadedFile(buffer: Buffer, originalFilename: string): Promise<string> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const storedFilename = `${randomUUID()}${path.extname(originalFilename)}`;
  await fs.writeFile(path.join(UPLOADS_DIR, storedFilename), buffer);
  return storedFilename;
}
