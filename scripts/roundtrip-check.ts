// Dev check: reading the live workflow's settings and applying them unchanged must not alter
// any node. Run: npx tsx scripts/roundtrip-check.ts   (add --write to save the result to n8n)
import { applySettings, gmailQuery, readSettings } from "../lib/settings";
import type { Campaign, Credential, Workflow } from "../lib/n8n";

const base = process.env.N8N_BASE_URL ?? "http://localhost:5678";
const headers = { "X-N8N-API-KEY": process.env.N8N_API_KEY ?? "" };
const get = async <T>(path: string) => (await (await fetch(`${base}/api/v1${path}`, { headers })).json()) as T;

async function main() {
  const id = process.env.N8N_WORKFLOW_ID ?? "KUiT8Dz3gTq48xAO";
  const wf = await get<Workflow>(`/workflows/${id}`);
  const creds = (await get<{ data: Credential[] }>("/credentials?limit=100")).data;
  const table = (await get<{ data: { id: string; name: string }[] }>("/data-tables")).data.find((t) => t.name === "Hirelane Campaigns");
  if (!table) throw new Error('Data Table "Hirelane Campaigns" not found');
  const campaigns = (await get<{ data: Campaign[] }>(`/data-tables/${table.id}/rows?limit=100&sortBy=${encodeURIComponent("createdAt:asc")}`)).data;

  const settings = readSettings(wf);
  console.log("read settings:", JSON.stringify(settings));
  console.log("open campaigns:", campaigns.filter((c) => c.status === "open").map((c) => c.name).join(", ") || "none");
  console.log("gmail query:", gmailQuery(campaigns));

  const applied = applySettings(wf, settings, creds, campaigns);
  const changed = applied.nodes.filter((n) => JSON.stringify(n) !== JSON.stringify(wf.nodes.find((o) => o.name === n.name)));
  console.log("nodes changed by a no-op save:", changed.map((n) => n.name).join(", ") || "none");
  for (const n of changed) {
    const o = wf.nodes.find((x) => x.name === n.name)!;
    for (const k of new Set([...Object.keys(o.parameters), ...Object.keys(n.parameters)])) {
      if (JSON.stringify(o.parameters[k]) !== JSON.stringify(n.parameters[k]))
        console.log(`  ${n.name}.${k}\n    was: ${JSON.stringify(o.parameters[k]).slice(0, 220)}\n    now: ${JSON.stringify(n.parameters[k]).slice(0, 220)}`);
    }
    for (const k of ["credentials", "disabled"] as const)
      if (JSON.stringify(o[k]) !== JSON.stringify(n[k])) console.log(`  ${n.name}.${k}: ${JSON.stringify(o[k])} -> ${JSON.stringify(n[k])}`);
  }

  if (process.argv.includes("--write")) {
    const r = await fetch(`${base}/api/v1/workflows/${id}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name: applied.name, nodes: applied.nodes, connections: applied.connections, settings: applied.settings }),
    });
    console.log("PUT ->", r.status);
  }
}
main();
