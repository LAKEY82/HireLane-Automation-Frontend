// Server-only n8n client: the public REST API (workflow, executions, credentials)
// and the secured "qa-admin/*" webhooks in the QA Intern Applications workflow.
import "server-only";
import { connection } from "next/server";

export type N8nNode = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
  disabled?: boolean;
  [key: string]: unknown;
};

export type Workflow = {
  id: string;
  name: string;
  active: boolean;
  nodes: N8nNode[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
  updatedAt: string;
};

export type Execution = {
  id: string;
  status: string;
  mode: string;
  startedAt: string;
  stoppedAt: string | null;
};

export type Credential = { id: string; name: string; type: string };

export type Applicant = Record<string, string | number | undefined> & {
  "Gmail Message ID": string;
  "Full Name"?: string;
  Status?: string;
};

export type ApplicantGroup = "experienced" | "freshers";

// One campaign's applicants, as returned by the "qa-admin/applicants" webhook
export type CampaignApplicants = {
  campaignId: number;
  experienced: Applicant[];
  freshers: Applicant[];
  errors: string[];
};

// A row of the n8n Data Table "Hirelane Campaigns"
export type Campaign = {
  id: number;
  name: string;
  position: string;
  keywords: string;
  relevant: string;
  status: "open" | "paused";
  experiencedSheetId: string;
  freshersSheetId: string;
  experiencedFolderId: string;
  freshersFolderId: string;
  createdAt: string;
};
export type CampaignInput = Omit<Campaign, "id" | "createdAt">;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const baseUrl = () => env("N8N_BASE_URL").replace(/\/+$/, "");
export const workflowId = () => env("N8N_WORKFLOW_ID");

export class N8nError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit & { headers: Record<string, string> }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(90_000) });
  } catch (e) {
    const reason = (e as Error).message;
    if (/timeout|aborted/i.test(reason))
      throw new N8nError(`n8n at ${baseUrl()} didn't answer in time (${reason}). It may be waking up: try again in a minute.`);
    throw new N8nError(`Cannot reach n8n at ${baseUrl()} (${reason}). Is it running?`);
  }
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      detail = JSON.parse(text).message ?? detail;
    } catch {}
    throw new N8nError(`n8n responded ${res.status}: ${detail}`, res.status);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

// connection() comes first in api() and webhook(): n8n data is always live, so a page
// that reads it must never be prerendered (even when config is missing at build time).
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  await connection();
  return request<T>(`${baseUrl()}/api/v1${path}`, {
    ...init,
    headers: { "X-N8N-API-KEY": env("N8N_API_KEY"), "Content-Type": "application/json", Accept: "application/json" },
  });
}

async function webhook<T>(path: string, init: RequestInit = {}): Promise<T> {
  await connection();
  return request<T>(`${baseUrl()}/webhook/qa-admin/${path}`, {
    ...init,
    headers: { "X-Admin-Secret": env("N8N_WEBHOOK_SECRET"), "Content-Type": "application/json" },
  });
}

// ---------- REST API ----------

export const getWorkflow = async () => {
  await connection();
  return api<Workflow>(`/workflows/${workflowId()}`);
};

// Workflow settings keys the public API accepts on update
const SETTINGS_KEYS = [
  "executionOrder", "timezone", "saveDataErrorExecution", "saveDataSuccessExecution",
  "saveManualExecutions", "saveExecutionProgress", "executionTimeout", "errorWorkflow", "callerPolicy", "binaryMode",
];

export async function saveWorkflow(wf: Workflow): Promise<Workflow> {
  const settings = Object.fromEntries(
    Object.entries(wf.settings ?? {}).filter(([k]) => SETTINGS_KEYS.includes(k)),
  );
  return api<Workflow>(`/workflows/${wf.id}`, {
    method: "PUT",
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }),
  });
}

export const setWorkflowActive = (active: boolean) =>
  api<Workflow>(`/workflows/${workflowId()}/${active ? "activate" : "deactivate"}`, { method: "POST" });

export async function listExecutions(limit = 15): Promise<Execution[]> {
  await connection();
  const res = await api<{ data: Execution[] }>(`/executions?workflowId=${workflowId()}&limit=${limit}`);
  return res.data;
}

export async function listCredentials(): Promise<Credential[]> {
  const out: Credential[] = [];
  let cursor = "";
  do {
    const res = await api<{ data: Credential[]; nextCursor?: string | null }>(
      `/credentials?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    out.push(...res.data.map(({ id, name, type }) => ({ id, name, type })));
    cursor = res.nextCursor ?? "";
  } while (cursor);
  return out;
}

// Creates the credential, or replaces the data of the one with the same name and type
export async function upsertCredential(name: string, type: string, data: Record<string, unknown>): Promise<Credential> {
  const existing = (await listCredentials()).find((c) => c.name === name && c.type === type);
  const saved = existing
    ? await api<Credential>(`/credentials/${existing.id}`, { method: "PATCH", body: JSON.stringify({ name, data }) })
    : await api<Credential>("/credentials", { method: "POST", body: JSON.stringify({ name, type, data }) });
  return { id: saved.id, name: saved.name, type: saved.type ?? type };
}

export const testCredential = (id: string) =>
  api<{ status: string; message?: string }>(`/credentials/${id}/test`, { method: "POST" });

// Where the user connects a new Gmail account (n8n's own OAuth screen)
export const n8nCredentialsUrl = () => `${baseUrl()}/home/credentials`;

// ---------- Admin webhooks ----------

export const runIntakeNow = () => webhook("run-intake", { method: "POST", body: "{}" });
export const runRejectionsNow = () => webhook("run-rejections", { method: "POST", body: "{}" });

export async function listApplicants(): Promise<CampaignApplicants[]> {
  return (await webhook<{ campaigns: CampaignApplicants[] }>("applicants", { method: "GET" })).campaigns ?? [];
}

// sendTo: when rejecting, the address the rejection email goes to (CV email or the address it was sent from)
export const setApplicantStatus = (campaignId: number, group: ApplicantGroup, messageId: string, status: string, sendTo?: string) =>
  webhook<{ ok: boolean }>("set-status", { method: "POST", body: JSON.stringify({ campaignId, group, messageId, status, sendTo }) });

// ---------- Campaigns (n8n Data Table "Hirelane Campaigns") ----------

const CAMPAIGNS_TABLE = "Hirelane Campaigns";
let campaignsTableId: string | null = null;

async function campaignsTable(): Promise<string> {
  if (campaignsTableId) return campaignsTableId;
  const res = await api<{ data: { id: string; name: string }[] }>("/data-tables?limit=100");
  const table = res.data.find((t) => t.name === CAMPAIGNS_TABLE);
  if (!table) throw new N8nError(`The n8n Data Table "${CAMPAIGNS_TABLE}" doesn't exist`);
  return (campaignsTableId = table.id);
}

const byId = (id: number) => ({ type: "and", filters: [{ columnName: "id", condition: "eq", value: id }] });

export async function listCampaigns(): Promise<Campaign[]> {
  const table = await campaignsTable();
  const rows: Campaign[] = [];
  let cursor = "";
  do {
    const res = await api<{ data: Campaign[]; nextCursor?: string | null }>(
      `/data-tables/${table}/rows?limit=100&sortBy=${encodeURIComponent("createdAt:asc")}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    rows.push(...res.data);
    cursor = res.nextCursor ?? "";
  } while (cursor);
  return rows;
}

export async function createCampaign(input: CampaignInput) {
  await api(`/data-tables/${await campaignsTable()}/rows`, { method: "POST", body: JSON.stringify({ data: [input], returnType: "id" }) });
}

export async function updateCampaign(id: number, data: Partial<CampaignInput>) {
  await api(`/data-tables/${await campaignsTable()}/rows/update`, { method: "PATCH", body: JSON.stringify({ filter: byId(id), data }) });
}

export async function deleteCampaign(id: number) {
  const filter = encodeURIComponent(JSON.stringify(byId(id)));
  await api(`/data-tables/${await campaignsTable()}/rows/delete?filter=${filter}`, { method: "DELETE" });
}
