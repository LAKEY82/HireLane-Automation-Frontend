import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// Sign-in rules shared by the Auth.js providers (auth.ts). Sessions themselves are Auth.js JWTs.

const digest = (s: string) => createHash("sha256").update(s).digest();

export function isCorrectPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // Compare digests so the comparison is constant-time regardless of length
  return timingSafeEqual(digest(`pw:${input}`), digest(`pw:${expected}`));
}

// Codes from auth.ts (credentials errors and signIn-callback redirects) plus Auth.js's own
export const SIGN_IN_ERRORS: Record<string, string> = {
  not_allowed: "This account is not allowed to sign in.",
  wrong_password: "Wrong email or password.",
  locked_out: "Too many failed attempts. Try again in 15 minutes.",
  connect_failed: "Signed in, but connecting the mailbox to n8n failed.",
  no_email: "The provider didn't confirm your email address.",
  no_offline_access: "Google didn't grant lasting access. Remove the app under myaccount.google.com → Security → Third-party apps, then try again.",
  AccessDenied: "Sign-in was cancelled or not allowed.",
  Configuration: "Sign-in isn't configured correctly on the server.",
};

// ---------- who may sign in ----------

const list = (name: string) =>
  (process.env[name] ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

// ALLOWED_EMAIL_DOMAINS (e.g. "theiavora.com") and/or ALLOWED_EMAILS (e.g. a Gmail address)
export function isAllowedEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  const domain = e.split("@")[1] ?? "";
  return list("ALLOWED_EMAILS").includes(e) || (!!domain && list("ALLOWED_EMAIL_DOMAINS").includes(domain));
}

// ---------- failed sign-in limit (per server instance) ----------

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; since: number }>();

export function isLockedOut(key: string): boolean {
  const f = failures.get(key);
  if (!f || Date.now() - f.since > WINDOW_MS) return false;
  return f.count >= MAX_FAILURES;
}

export function recordFailure(key: string) {
  const f = failures.get(key);
  if (!f || Date.now() - f.since > WINDOW_MS) failures.set(key, { count: 1, since: Date.now() });
  else f.count++;
}

export const clearFailures = (key: string) => failures.delete(key);
