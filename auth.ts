// Auth.js (NextAuth v5): Google, Microsoft, Hostinger email and the backup admin password.
// Signing in with Google also makes that mailbox the workflow's inbox; Hostinger sign-in only checks the password.
import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { connectGmail, MailboxError, verifyImapLogin } from "@/lib/mailbox";
import { HOSTINGER_DEFAULTS } from "@/lib/settings";
import { clearFailures, isAllowedEmail, isCorrectPassword, isLockedOut, recordFailure } from "@/lib/session";

// The same Gmail scopes n8n's own Gmail login asks for, so n8n can read and send mail
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.addons.current.action.compose",
  "https://www.googleapis.com/auth/gmail.addons.current.message.action",
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
];

class SignInFailed extends CredentialsSignin {
  constructor(code: "not_allowed" | "wrong_password" | "locked_out" | "connect_failed") {
    super();
    this.code = code;
  }
}

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const clientIp = (request: Request) => (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();

export const googleEnabled = () => !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
export const microsoftEnabled = () => !!(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET);

const providers: NextAuthConfig["providers"] = [
  Credentials({
    id: "hostinger",
    name: "Hostinger email",
    credentials: { email: {}, password: {} },
    async authorize(credentials, request) {
      const email = String(credentials.email ?? "").trim().toLowerCase();
      const password = String(credentials.password ?? "");
      if (!EMAIL_RE.test(email) || !password || /[\r\n]/.test(password)) throw new SignInFailed("wrong_password");
      if (!isAllowedEmail(email)) throw new SignInFailed("not_allowed");

      const keys = [`hostinger:${email}`, `ip:${clientIp(request)}`];
      if (keys.some(isLockedOut)) throw new SignInFailed("locked_out");
      try {
        await verifyImapLogin(HOSTINGER_DEFAULTS.imapHost, email, password);
      } catch (e) {
        if (e instanceof MailboxError && e.message === "Wrong email or password") keys.forEach(recordFailure);
        console.error("Hostinger sign-in:", e);
        throw new SignInFailed("wrong_password");
      }
      clearFailures(keys[0]);
      // Sign-in only checks the password: connecting the mailbox to n8n (Settings → Email account)
      // can take longer than a hosted function may run (Netlify: 10 s), especially while n8n wakes up
      return { id: email, email, name: email };
    },
  }),
  Credentials({
    id: "admin",
    name: "Admin password",
    credentials: { password: {} },
    async authorize(credentials, request) {
      const key = `pw:${clientIp(request)}`;
      if (isLockedOut(key)) throw new SignInFailed("locked_out");
      if (!isCorrectPassword(String(credentials.password ?? ""))) {
        recordFailure(key);
        throw new SignInFailed("wrong_password");
      }
      clearFailures(key);
      return { id: "admin", name: "Admin" };
    },
  }),
];

if (googleEnabled()) {
  providers.push(Google({
    authorization: {
      params: {
        scope: ["openid", "email", "profile", ...GMAIL_SCOPES].join(" "),
        access_type: "offline", // refresh token, so n8n keeps access
        prompt: "consent",
        include_granted_scopes: "true",
      },
    },
  }));
}
if (microsoftEnabled()) providers.push(MicrosoftEntraID({}));

const loginError = (code: string, detail?: string) =>
  `/login?error=${code}${detail ? `&detail=${encodeURIComponent(detail.slice(0, 200))}` : ""}`;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  callbacks: {
    async signIn({ account, profile }) {
      if (!account || account.type === "credentials") return true;

      const email = String(profile?.email ?? profile?.preferred_username ?? "").toLowerCase();
      if (!email) return loginError("no_email");
      if (account.provider === "google" && profile?.email_verified !== true) return loginError("no_email");
      if (!isAllowedEmail(email)) return loginError("not_allowed", email);

      if (account.provider === "google") {
        if (!account.refresh_token) return loginError("no_offline_access");
        try {
          await connectGmail(email, {
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            scope: account.scope,
            token_type: account.token_type,
            expires_in: account.expires_at ? account.expires_at - Math.floor(Date.now() / 1000) : undefined,
          });
        } catch (e) {
          console.error("Connecting Gmail:", e);
          return loginError("connect_failed", e instanceof Error ? e.message : String(e));
        }
      }
      return true;
    },
  },
});
