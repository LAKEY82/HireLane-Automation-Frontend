// Maps the app's global settings (mailbox, logins, schedule) to the workflow nodes and back.
// Job details (keywords, position, sheets, folders) belong to campaigns: see lib/campaigns.ts.
import type { Campaign, Credential, N8nNode, Workflow } from "./n8n";
import { keywordList } from "./campaigns";

export type MailProvider = "gmail" | "hostinger";

export type Settings = {
  mailProvider: MailProvider;
  gmailCredentialId: string;
  imapCredentialId: string;
  smtpCredentialId: string;
  hostingerEmail: string;
  sheetsCredentialId: string;
  driveCredentialId: string;
  intakeEveryMinutes: number;
  rejectionEveryMinutes: number;
  lookbackDays: number;
  automationOn: boolean;
};

const SETTINGS_NOTE = "Frontend Settings";
const INTAKE_TRIGGER = "New Application Email";
const HOSTINGER_TRIGGER = "Check Hostinger Inbox";
const REJECTION_TRIGGER = "Every 15 Minutes";
const HOSTINGER_SEARCH = "Search Hostinger Inbox";
const HOSTINGER_SEND = "Send Rejection via Hostinger";

// IF nodes that route to the Gmail (true) or Hostinger (false) branch; their leftValue is the provider
const PROVIDER_SWITCHES = ["Which Inbox? (Run Now)", "Which Mailbox? (Rejections)"];
// Nodes of the provider that isn't selected are disabled, so n8n doesn't require their logins
const GMAIL_NODES = ["Search Inbox Now", "Send Rejection Email", "Send Rejection Email (New Message)"];
const HOSTINGER_NODES = [HOSTINGER_SEARCH, "Download Hostinger CV", HOSTINGER_SEND];
const SMTP_PLACEHOLDER = "not-connected@example.com";
const NOTE_CONTENT =
  "## Frontend Settings\nManaged by the Hirelane app. Campaigns (keywords, position, sheets, folders) live in the n8n Data Table **Hirelane Campaigns**.";

export const HOSTINGER_DEFAULTS = { imapHost: "imap.hostinger.com", imapPort: 993, smtpHost: "smtp.hostinger.com", smtpPort: 465 };

// ---------- search queries built from the open campaigns ----------

// Gmail: any open campaign's keywords, all words in the subject. "{a b}" is Gmail's OR.
export function gmailQuery(campaigns: Campaign[]): string {
  const groups = campaigns.filter((c) => c.status === "open").map((c) => `subject:(${keywordList(c.keywords).join(" ")})`);
  if (!groups.length) return "subject:(hirelane-no-open-campaigns) has:attachment filename:pdf";
  return `${groups.length === 1 ? groups[0] : `{${groups.join(" ")}}`} has:attachment filename:pdf`;
}

// IMAP SEARCH takes one subject string: with a single open campaign its longest keyword narrows the
// search; with several, the search uses the date range only and "Match Campaign" does the matching.
function imapSubject(campaigns: Campaign[]): string | null {
  const open = campaigns.filter((c) => c.status === "open");
  if (open.length !== 1) return null;
  return [...keywordList(open[0].keywords)].sort((a, b) => b.length - a.length)[0] ?? null;
}

const imapSince = (days: number) => `={{ $now.minus({ days: ${days} }).toISO() }}`;

// ---------- reading ----------

function findNode(wf: Workflow, name: string): N8nNode {
  const n = wf.nodes.find((x) => x.name === name);
  if (!n) throw new Error(`Workflow is missing the node "${name}"`);
  return n;
}

// Accepts a raw ID or a Google Sheets/Drive URL and returns the ID
export function extractGoogleId(input: string): string {
  const s = input.trim();
  const m = s.match(/\/(?:d|folders)\/([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : s;
}

function minutesFromPoll(node: N8nNode): number {
  const item = (node.parameters.pollTimes as { item?: { mode: string; value?: number; unit?: string }[] })?.item?.[0];
  if (!item || item.mode === "everyMinute") return 1;
  if (item.mode === "everyHour") return 60;
  if (item.mode === "everyX") return (item.value ?? 1) * (item.unit === "hours" ? 60 : 1);
  return 1;
}

type IfConditions = { conditions: { leftValue: unknown }[] };

function readProvider(wf: Workflow): MailProvider {
  const cond = findNode(wf, PROVIDER_SWITCHES[0]).parameters.conditions as IfConditions;
  return cond?.conditions?.[0]?.leftValue === "hostinger" ? "hostinger" : "gmail";
}

function readHostingerEmail(wf: Workflow): string {
  const from = String(findNode(wf, HOSTINGER_SEND).parameters.fromEmail ?? "");
  const email = (from.match(/<([^>]+)>/)?.[1] ?? from).trim();
  return email === SMTP_PLACEHOLDER ? "" : email;
}

function readLookbackDays(wf: Workflow): number {
  const since = String((findNode(wf, HOSTINGER_SEARCH).parameters.emailDateRange as { since?: string })?.since ?? "");
  return Number(since.match(/days:\s*(\d+)/)?.[1] ?? 7);
}

export function readSettings(wf: Workflow): Settings {
  const intake = findNode(wf, INTAKE_TRIGGER);
  const schedule = findNode(wf, REJECTION_TRIGGER);
  const interval = (schedule.parameters.rule as { interval?: { minutesInterval?: number }[] })?.interval?.[0];
  const cred = (name: string, type: string) => findNode(wf, name).credentials?.[type]?.id ?? "";
  const mailProvider = readProvider(wf);
  const activeIntake = mailProvider === "gmail" ? intake : findNode(wf, HOSTINGER_TRIGGER);

  return {
    mailProvider,
    gmailCredentialId: cred(INTAKE_TRIGGER, "gmailOAuth2"),
    imapCredentialId: cred(HOSTINGER_SEARCH, "imap"),
    smtpCredentialId: cred(HOSTINGER_SEND, "smtp"),
    hostingerEmail: readHostingerEmail(wf),
    sheetsCredentialId: cred("Add to Experienced Sheet", "googleSheetsOAuth2Api"),
    driveCredentialId: cred("Upload CV to Experienced Folder", "googleDriveOAuth2Api"),
    intakeEveryMinutes: minutesFromPoll(intake),
    rejectionEveryMinutes: interval?.minutesInterval ?? 15,
    lookbackDays: readLookbackDays(wf),
    automationOn: !activeIntake.disabled && !schedule.disabled,
  };
}

// ---------- writing ----------

const CRED_TYPES = {
  gmail: "gmailOAuth2",
  imap: "imap",
  smtp: "smtp",
  sheets: "googleSheetsOAuth2Api",
  drive: "googleDriveOAuth2Api",
} as const;

// n8n leaves "disabled" out for enabled nodes; keep it that way so unchanged nodes stay identical
function setDisabled(n: N8nNode, disabled: boolean) {
  if (disabled) n.disabled = true;
  else delete n.disabled;
}

function credRef(creds: Credential[], id: string, type: string) {
  const c = creds.find((x) => x.id === id && x.type === type);
  if (!c) throw new Error(`Credential ${id} (${type}) was not found in n8n`);
  return { id: c.id, name: c.name };
}

const usesSheetsLogin = (n: N8nNode) =>
  n.type === "n8n-nodes-base.googleSheets" ||
  (n.type === "n8n-nodes-base.httpRequest" && n.parameters.nodeCredentialType === CRED_TYPES.sheets);

export function applySettings(wf: Workflow, s: Settings, creds: Credential[], campaigns: Campaign[]): Workflow {
  const gmailOn = s.mailProvider === "gmail";
  if (gmailOn && !s.gmailCredentialId) throw new Error("Choose a Gmail account");
  if (!gmailOn && !(s.imapCredentialId && s.smtpCredentialId && s.hostingerEmail)) throw new Error("Connect a Hostinger mailbox first");
  const optionalRef = (id: string, type: string) => (id ? credRef(creds, id, type) : null);
  const gmail = optionalRef(s.gmailCredentialId, CRED_TYPES.gmail);
  const imap = optionalRef(s.imapCredentialId, CRED_TYPES.imap);
  const smtp = optionalRef(s.smtpCredentialId, CRED_TYPES.smtp);
  const sheets = credRef(creds, s.sheetsCredentialId, CRED_TYPES.sheets);
  const drive = credRef(creds, s.driveCredentialId, CRED_TYPES.drive);
  const query = gmailQuery(campaigns);
  const subject = imapSubject(campaigns);

  const nodes = wf.nodes.map((original) => {
    const n: N8nNode = structuredClone(original);
    const p = n.parameters;

    if (gmail && (n.type === "n8n-nodes-base.gmail" || n.type === "n8n-nodes-base.gmailTrigger")) {
      n.credentials = { [CRED_TYPES.gmail]: gmail };
    }
    if (imap && n.type === "n8n-nodes-imap.imap") n.credentials = { [CRED_TYPES.imap]: imap };
    if (smtp && n.type === "n8n-nodes-base.emailSend") n.credentials = { [CRED_TYPES.smtp]: smtp };
    if (usesSheetsLogin(n)) n.credentials = { [CRED_TYPES.sheets]: sheets };
    if (n.type === "n8n-nodes-base.googleDrive") n.credentials = { [CRED_TYPES.drive]: drive };
    if (GMAIL_NODES.includes(n.name)) setDisabled(n, !gmailOn);
    if (HOSTINGER_NODES.includes(n.name)) setDisabled(n, gmailOn);
    if (PROVIDER_SWITCHES.includes(n.name)) {
      const cond = p.conditions as IfConditions;
      cond.conditions = cond.conditions.map((c, i) => (i === 0 ? { ...c, leftValue: s.mailProvider } : c));
    }
    if (n.type === "n8n-nodes-base.emailSend" && s.hostingerEmail) p.fromEmail = `Hiring Team <${s.hostingerEmail}>`;

    switch (n.name) {
      case INTAKE_TRIGGER:
        p.filters = { ...(p.filters as object), q: query };
        p.pollTimes = {
          item: [s.intakeEveryMinutes === 1 ? { mode: "everyMinute" } : { mode: "everyX", value: s.intakeEveryMinutes, unit: "minutes" }],
        };
        setDisabled(n, !(s.automationOn && gmailOn));
        break;
      case "Search Inbox Now":
        p.filters = { ...(p.filters as object), q: `${query} newer_than:${s.lookbackDays}d` };
        break;
      case HOSTINGER_TRIGGER:
        p.rule = { interval: [{ field: "minutes", minutesInterval: s.intakeEveryMinutes }] };
        setDisabled(n, !(s.automationOn && !gmailOn));
        break;
      case HOSTINGER_SEARCH: {
        const filters = { ...(p.emailSearchFilters as Record<string, unknown>) };
        if (subject) filters.subject = subject;
        else delete filters.subject;
        p.emailSearchFilters = filters;
        p.emailDateRange = { ...(p.emailDateRange as object), since: imapSince(s.lookbackDays) };
        break;
      }
      case REJECTION_TRIGGER:
        p.rule = { interval: [{ field: "minutes", minutesInterval: s.rejectionEveryMinutes }] };
        setDisabled(n, !s.automationOn);
        break;
      case SETTINGS_NOTE:
        p.content = NOTE_CONTENT;
        break;
    }
    return n;
  });

  return { ...wf, nodes };
}

export function setAutomation(wf: Workflow, on: boolean): Workflow {
  const gmailOn = readProvider(wf) === "gmail";
  const enabled: Record<string, boolean> = {
    [INTAKE_TRIGGER]: on && gmailOn,
    [HOSTINGER_TRIGGER]: on && !gmailOn,
    [REJECTION_TRIGGER]: on,
  };
  return {
    ...wf,
    nodes: wf.nodes.map((original) => {
      if (!(original.name in enabled)) return original;
      const n = { ...original };
      setDisabled(n, !enabled[n.name]);
      return n;
    }),
  };
}
