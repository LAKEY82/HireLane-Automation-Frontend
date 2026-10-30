// Connects a mailbox to the workflow: stores the login in n8n and switches the workflow to it.
// Used both by sign-in (Google / Hostinger) and by Settings → Email account.
import tls from "node:tls";
import { getWorkflow, listCampaigns, listCredentials, saveWorkflow, testCredential, upsertCredential } from "./n8n";
import { HOSTINGER_DEFAULTS, applySettings, readSettings } from "./settings";

export class MailboxError extends Error {}

// Checks an email + password against the IMAP server directly (no n8n login is created).
// Resolves on "OK", rejects with MailboxError on a wrong password or connection problem.
export function verifyImapLogin(host: string, user: string, password: string): Promise<void> {
  const quote = (s: string) => `"${s.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
  return new Promise((resolve, reject) => {
    let buffer = "";
    let greeted = false;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };
    const socket = tls.connect({ host, port: HOSTINGER_DEFAULTS.imapPort, servername: host, timeout: 15_000 });
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      if (!greeted) {
        if (/^\* BYE/m.test(buffer)) return finish(new MailboxError(`${host} refused the connection`));
        if (!/^\* (OK|PREAUTH)/m.test(buffer)) return;
        greeted = true;
        buffer = "";
        socket.write(`a1 LOGIN ${quote(user)} ${quote(password)}\r\n`);
        return;
      }
      const reply = buffer.match(/^a1 (OK|NO|BAD)\b(.*)$/m);
      if (!reply) return;
      if (reply[1] === "OK") {
        socket.write("a2 LOGOUT\r\n");
        finish();
      } else {
        finish(new MailboxError("Wrong email or password"));
      }
    });
    socket.on("timeout", () => finish(new MailboxError(`No answer from ${host}`)));
    socket.on("error", (e) => finish(new MailboxError(`Cannot reach ${host} (${e.message})`)));
  });
}

async function switchMailbox(change: (s: ReturnType<typeof readSettings>) => ReturnType<typeof readSettings>) {
  const [wf, creds, campaigns] = await Promise.all([getWorkflow(), listCredentials(), listCampaigns()]);
  await saveWorkflow(applySettings(wf, change(readSettings(wf)), creds, campaigns));
}

export async function connectHostinger(email: string, password: string, imapHost: string, smtpHost: string) {
  const login = { user: email, password };
  const imap = await upsertCredential(`Hostinger IMAP (${email})`, "imap", {
    ...login, host: imapHost, port: HOSTINGER_DEFAULTS.imapPort, secure: true, allowUnauthorizedCerts: false,
  });
  const smtp = await upsertCredential(`Hostinger SMTP (${email})`, "smtp", {
    ...login, host: smtpHost, port: HOSTINGER_DEFAULTS.smtpPort, secure: true,
  });
  const reading = await testCredential(imap.id);
  if (reading.status !== "OK") throw new MailboxError(`Hostinger login for reading (IMAP) failed: ${reading.message ?? reading.status}`);
  // Sending can fail while reading works: some hosts (e.g. Render's free plan) block outgoing SMTP ports.
  // Connect anyway, so sign-in and intake work; rejection emails fail until the host allows SMTP.
  const sending = await testCredential(smtp.id);
  if (sending.status !== "OK") console.warn(`Hostinger SMTP test failed for ${email}: ${sending.message ?? sending.status}`);
  await switchMailbox((s) => ({ ...s, mailProvider: "hostinger", imapCredentialId: imap.id, smtpCredentialId: smtp.id, hostingerEmail: email }));
  return { canSend: sending.status === "OK" };
}

// tokens = Google's token response (access_token, refresh_token, scope, …). n8n refreshes it
// with the same OAuth client, so the client ID/secret are stored alongside.
export async function connectGmail(email: string, tokens: Record<string, unknown>) {
  const gmail = await upsertCredential(`Gmail (${email})`, "gmailOAuth2", {
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
    oauthTokenData: tokens,
  });
  await switchMailbox((s) => ({ ...s, mailProvider: "gmail", gmailCredentialId: gmail.id }));
}
