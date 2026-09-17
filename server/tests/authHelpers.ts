// Shared by every API test file (lab-02 regression and lab-03) that needs
// an authenticated session cookie. Creates a real Session row via the same
// src/auth.js helper the app itself uses, bypassing /auth/login so tests
// don't need a real bcrypt-hashed fixture password.

import { createSession } from "../src/auth.js";

export async function sessionCookieFor(userId: number): Promise<string> {
  const { token } = await createSession(userId);
  return `sid=${token}`;
}
