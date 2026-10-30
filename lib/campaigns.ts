// Campaign helpers shared by the server actions and pages (no server-only imports).
import type { Applicant, ApplicantGroup, Campaign, CampaignApplicants } from "./n8n";

// "intern, qa" / "Intern -QA" / "intern-qa" → ["intern", "qa"]: any punctuation separates words,
// duplicates are dropped. Must match the splitting in the workflow's "Match Campaign" node.
export const keywordList = (keywords: string) =>
  [...new Set(keywords.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))];

export type ApplicantRow = { a: Applicant; group: ApplicantGroup; campaign: Campaign | undefined; campaignId: number };

// Flattens the per-campaign webhook response into one list, newest first
export function flattenApplicants(groups: CampaignApplicants[], campaigns: Campaign[]): ApplicantRow[] {
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  return groups
    .flatMap((g) => (["experienced", "freshers"] as const).flatMap((group) =>
      g[group].map((a) => ({ a, group, campaign: byId.get(g.campaignId), campaignId: g.campaignId }))))
    .sort((x, y) => String(y.a["Date Received"] ?? "").localeCompare(String(x.a["Date Received"] ?? "")));
}

export const statusOf = (a: Applicant) => String(a.Status ?? "").trim() || "Pending";

export function countByStatus(rows: ApplicantRow[]) {
  const n = (s: string) => rows.filter((r) => statusOf(r.a) === s).length;
  return { total: rows.length, pending: n("Pending"), shortlisted: n("Shortlisted"), rejected: n("Rejected") };
}
