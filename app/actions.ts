"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { AuthError } from "next-auth";
import { auth, signIn, signOut } from "@/auth";
import {
  createCampaign, deleteCampaign, getWorkflow, listCampaigns, listCredentials, runIntakeNow, runRejectionsNow,
  saveWorkflow, setApplicantStatus, setWorkflowActive, updateCampaign, type ApplicantGroup, type CampaignInput,
} from "@/lib/n8n";
import { HOSTINGER_DEFAULTS, applySettings, extractGoogleId, readSettings, setAutomation, type Settings } from "@/lib/settings";
import { keywordList } from "@/lib/campaigns";
import { connectHostinger } from "@/lib/mailbox";
import { SIGN_IN_ERRORS } from "@/lib/session";

export type ActionState = { ok?: boolean; message?: string };

async function requireSession() {
  if (!(await auth())) redirect("/login");
}

const fail = (e: unknown): ActionState => ({ ok: false, message: e instanceof Error ? e.message : String(e) });

// ---------- auth (providers live in auth.ts) ----------

const safeNext = (form: FormData) => {
  const next = String(form.get("next") ?? "/");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
};

// Credentials sign-in (Hostinger email or admin password). Auth.js redirects on success;
// its errors carry a code that maps to SIGN_IN_ERRORS.
async function credentialsSignIn(provider: "hostinger" | "admin", form: FormData): Promise<ActionState> {
  try {
    await signIn(provider, {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      redirectTo: safeNext(form),
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) {
      const code = (e as AuthError & { code?: string }).code ?? "";
      return { ok: false, message: SIGN_IN_ERRORS[code] ?? "Sign-in failed." };
    }
    throw e; // the success redirect
  }
}

export const loginWithHostinger = async (_: ActionState, form: FormData) => credentialsSignIn("hostinger", form);
export const login = async (_: ActionState, form: FormData) => credentialsSignIn("admin", form);

export async function loginWithProvider(form: FormData) {
  const provider = String(form.get("provider"));
  if (provider !== "google" && provider !== "microsoft-entra-id") return;
  await signIn(provider, { redirectTo: safeNext(form) });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

// ---------- dashboard ----------

export async function toggleAutomation(_: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const on = form.get("on") === "true";
  try {
    await saveWorkflow(setAutomation(await getWorkflow(), on));
    refresh();
    return { ok: true, message: on ? "Automation switched on" : "Automation switched off" };
  } catch (e) {
    return fail(e);
  }
}

export async function activateWorkflow(): Promise<ActionState> {
  await requireSession();
  try {
    await setWorkflowActive(true);
    refresh();
    return { ok: true, message: "Workflow activated: the admin webhooks are live" };
  } catch (e) {
    return fail(e);
  }
}

export async function runNow(_: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const what = form.get("what");
  try {
    if (what === "intake") await runIntakeNow();
    else if (what === "rejections") await runRejectionsNow();
    else return { ok: false, message: "Unknown action" };
    refresh();
    return {
      ok: true,
      message: what === "intake" ? "Checking the inbox now. New applications appear in a minute." : "Sending pending rejection emails now.",
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------- applicants ----------

const STATUSES = ["Pending", "Shortlisted", "Rejected"];

export async function updateStatus(campaignId: number, group: ApplicantGroup, messageId: string, status: string, sendTo?: string): Promise<ActionState> {
  await requireSession();
  if (!STATUSES.includes(status) || !["experienced", "freshers"].includes(group) || !messageId || !Number.isInteger(campaignId)) {
    return { ok: false, message: "Invalid status update" };
  }
  if (sendTo && !EMAIL_RE.test(sendTo)) return { ok: false, message: "That email address doesn't look right" };
  try {
    await setApplicantStatus(campaignId, group, messageId, status, sendTo || undefined);
    // Send the rejection email right away instead of waiting for the next scheduled run
    if (status === "Rejected") await runRejectionsNow();
    refresh();
    return { ok: true, message: status === "Rejected" ? "Rejected: the email is being written and sent now" : `Status set to ${status}` };
  } catch (e) {
    return fail(e);
  }
}

// Re-applies the global settings so the inbox searches cover every open campaign
async function syncWorkflow() {
  const [wf, creds, campaigns] = await Promise.all([getWorkflow(), listCredentials(), listCampaigns()]);
  await saveWorkflow(applySettings(wf, readSettings(wf), creds, campaigns));
}

// ---------- campaigns ----------

const ID_RE = /^[A-Za-z0-9_-]{10,}$/;

function readCampaignForm(form: FormData): { input: CampaignInput; errors: string[] } {
  const str = (k: string) => String(form.get(k) ?? "").trim();
  const keywords = keywordList(str("keywords"));
  const input: CampaignInput = {
    name: str("name"),
    position: str("position"),
    keywords: keywords.join(", "),
    relevant: str("relevant"),
    status: str("status") === "paused" ? "paused" : "open",
    experiencedSheetId: extractGoogleId(str("experiencedSheetId")),
    freshersSheetId: extractGoogleId(str("freshersSheetId")),
    experiencedFolderId: extractGoogleId(str("experiencedFolderId")),
    freshersFolderId: extractGoogleId(str("freshersFolderId")),
  };
  const errors: string[] = [];
  if (input.name.length < 3) errors.push("Give the campaign a name");
  if (input.position.length < 3) errors.push("Add the position title");
  if (!keywords.length || keywords.some((k) => k.length < 2 || k.length > 30)) errors.push("Subject keywords: words of 2 or more letters, e.g. intern, qa");
  if (input.relevant.length < 10) errors.push("Describe what counts as relevant experience");
  const ids = [
    ["experiencedSheetId", "Experienced sheet"], ["freshersSheetId", "Freshers sheet"],
    ["experiencedFolderId", "Experienced CV folder"], ["freshersFolderId", "Freshers CV folder"],
  ] as const;
  for (const [k, label] of ids) if (!ID_RE.test(input[k])) errors.push(`${label}: paste a Google link or ID`);
  if (input.experiencedSheetId && input.experiencedSheetId === input.freshersSheetId) errors.push("Use two different sheets for experienced and freshers");
  return { input, errors };
}

// Each campaign needs its own sheets, otherwise its applicants would show up in another campaign too
async function sheetConflict(input: CampaignInput, selfId?: number): Promise<string | null> {
  const mine = [input.experiencedSheetId, input.freshersSheetId];
  const other = (await listCampaigns()).find((c) => c.id !== selfId && mine.some((s) => s === c.experiencedSheetId || s === c.freshersSheetId));
  return other ? `Those sheets already belong to “${other.name}”. Each campaign needs its own sheets.` : null;
}

export async function saveCampaign(_: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const id = Number(form.get("id") ?? "");
  const { input, errors } = readCampaignForm(form);
  if (errors.length) return { ok: false, message: errors.join(" · ") };
  try {
    const conflict = await sheetConflict(input, id || undefined);
    if (conflict) return { ok: false, message: conflict };
    if (id) await updateCampaign(id, input);
    else await createCampaign(input);
    await syncWorkflow();
    refresh();
    return { ok: true, message: id ? "Campaign saved" : `Campaign “${input.name}” created` };
  } catch (e) {
    return fail(e);
  }
}

export async function setCampaignStatus(id: number, status: "open" | "paused"): Promise<ActionState> {
  await requireSession();
  try {
    await updateCampaign(id, { status });
    await syncWorkflow();
    refresh();
    return { ok: true, message: status === "open" ? "Campaign reopened" : "Campaign paused" };
  } catch (e) {
    return fail(e);
  }
}

// "Refresh" on a campaign: check the inbox now and send pending rejections. The inbox is shared, so
// this runs for every open campaign; the card then polls for new applicants.
export async function refreshCampaign(): Promise<ActionState> {
  await requireSession();
  try {
    await Promise.all([runIntakeNow(), runRejectionsNow()]);
    return { ok: true, message: "Checking the inbox…" };
  } catch (e) {
    return fail(e);
  }
}

// Removes the campaign from Hirelane. Its sheets and Drive folders stay in Google, untouched.
export async function removeCampaign(id: number): Promise<ActionState> {
  await requireSession();
  try {
    await deleteCampaign(id);
    await syncWorkflow();
    refresh();
    return { ok: true, message: "Campaign deleted. Its sheets and CVs are still in your Google account." };
  } catch (e) {
    return fail(e);
  }
}

// ---------- settings ----------

const MINUTE_CHOICES = [1, 5, 10, 15, 30, 60];
const LOOKBACK_CHOICES = [7, 30, 90, 365];

export async function saveSettings(_: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const str = (k: string) => String(form.get(k) ?? "").trim();
  const changes = {
    sheetsCredentialId: str("sheetsCredentialId"),
    driveCredentialId: str("driveCredentialId"),
    intakeEveryMinutes: Number(str("intakeEveryMinutes")),
    rejectionEveryMinutes: Number(str("rejectionEveryMinutes")),
    lookbackDays: Number(str("lookbackDays")),
  };
  const errors: string[] = [];
  if (!MINUTE_CHOICES.includes(changes.intakeEveryMinutes) || !MINUTE_CHOICES.includes(changes.rejectionEveryMinutes)) errors.push("Pick a schedule from the list");
  if (!LOOKBACK_CHOICES.includes(changes.lookbackDays)) errors.push("Pick how far back to look from the list");
  if (errors.length) return { ok: false, message: errors.join(" · ") };

  try {
    const [wf, creds, campaigns] = await Promise.all([getWorkflow(), listCredentials(), listCampaigns()]);
    await saveWorkflow(applySettings(wf, { ...readSettings(wf), ...changes }, creds, campaigns));
    refresh();
    return { ok: true, message: "Settings saved" };
  } catch (e) {
    return fail(e);
  }
}

// ---------- mailbox ----------

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const HOST_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

// Gmail: pick a login connected in n8n. Hostinger: the password is sent to n8n as IMAP + SMTP logins
// (never stored here), tested by n8n, then the workflow switches to the Hostinger nodes.
export async function saveMailbox(_: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const str = (k: string) => String(form.get(k) ?? "").trim();
  const provider = str("mailProvider");

  try {
    const [wf, campaigns] = await Promise.all([getWorkflow(), listCampaigns()]);
    const current = readSettings(wf);
    let next: Settings;

    if (provider === "gmail") {
      if (!str("gmailCredentialId")) return { ok: false, message: "Choose a Gmail account" };
      next = { ...current, mailProvider: "gmail", gmailCredentialId: str("gmailCredentialId") };
    } else if (provider === "hostinger") {
      const email = str("hostingerEmail").toLowerCase();
      const password = String(form.get("hostingerPassword") ?? "");
      const imapHost = str("imapHost") || HOSTINGER_DEFAULTS.imapHost;
      const smtpHost = str("smtpHost") || HOSTINGER_DEFAULTS.smtpHost;
      if (!EMAIL_RE.test(email)) return { ok: false, message: "Enter the full Hostinger email address" };
      if (!HOST_RE.test(imapHost) || !HOST_RE.test(smtpHost)) return { ok: false, message: "Mail server names look wrong" };
      if (/[\r\n]/.test(password)) return { ok: false, message: "Password can't contain line breaks" };

      if (password) {
        const { canSend } = await connectHostinger(email, password, imapHost, smtpHost);
        refresh();
        if (!canSend) return { ok: false, message: `Connected ${email} for reading applications, but n8n can't send email through it (the SMTP connection timed out). Your n8n host may block outgoing email, e.g. Render's free plan.` };
        return { ok: true, message: `Using ${email} for applications and rejection emails` };
      }
      if (!current.imapCredentialId || current.hostingerEmail !== email) {
        return { ok: false, message: "Enter the mailbox password to connect this address" };
      }
      next = { ...current, mailProvider: "hostinger" };
    } else {
      return { ok: false, message: "Choose Gmail or Hostinger" };
    }

    await saveWorkflow(applySettings(wf, next, await listCredentials(), campaigns));
    refresh();
    return {
      ok: true,
      message: next.mailProvider === "gmail"
        ? "Using Gmail for applications and rejection emails"
        : `Using ${next.hostingerEmail} for applications and rejection emails`,
    };
  } catch (e) {
    return fail(e);
  }
}
