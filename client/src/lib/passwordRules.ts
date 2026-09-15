// docs/lab-03/specification.md BR-07 — client-side mirror of the server
// rule, for inline validation only; the server is the authoritative check.
export function isValidPassword(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

export const PASSWORD_RULE_MESSAGE =
  "Password must be at least 8 characters and include a letter and a digit";
