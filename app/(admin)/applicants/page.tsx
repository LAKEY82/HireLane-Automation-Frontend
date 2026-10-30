import Link from "next/link";
import { listApplicants, listCampaigns } from "@/lib/n8n";
import { flattenApplicants, statusOf, type ApplicantRow } from "@/lib/campaigns";
import { EmptyState, ErrorPanel, PageHeader, attempt } from "@/components/panels";
import { ApplicantCard, emailedDates, emailedKey, rowKey } from "@/components/applicant-card";
import { SearchIcon, UsersIcon } from "@/components/icons";

export const metadata = { title: "Applicants" };

const GROUPS = [
  { key: "all", label: "Everyone" },
  { key: "experienced", label: "Experienced" },
  { key: "freshers", label: "Freshers" },
] as const;
// "Active" (the default) hides rejected applicants; they stay one click away under "Rejected"
const STATUSES = ["Active", "Pending", "Shortlisted", "Rejected", "All"];
const STATUS_LABEL: Record<string, string> = { Active: "Active", Pending: "To review", Shortlisted: "Shortlisted", Rejected: "Rejected", All: "Everyone incl. rejected" };

const matchesStatus = (r: ApplicantRow, filter: string) =>
  filter === "All" || (filter === "Active" ? statusOf(r.a) !== "Rejected" : statusOf(r.a) === filter);
const SEARCHABLE = ["Full Name", "Email", "Skills", "Education", "Relevant Experience", "Location"];

export default async function ApplicantsPage({ searchParams }: PageProps<"/applicants">) {
  const sp = await searchParams;
  const group = sp.group === "experienced" || sp.group === "freshers" ? sp.group : "all";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status) ? sp.status : "Active";
  const campaignFilter = typeof sp.campaign === "string" ? Number(sp.campaign) : 0;

  const [groups, campaigns] = await Promise.all([attempt(listApplicants), attempt(listCampaigns)]);
  if (!groups.data) return <ErrorPanel error={groups.error} />;
  if (!campaigns.data) return <ErrorPanel error={campaigns.error} />;

  const all = flattenApplicants(groups.data, campaigns.data);
  const sentAt = emailedDates(all);
  const scoped = all.filter((r) => (!campaignFilter || r.campaignId === campaignFilter) && (group === "all" || r.group === group));
  const needle = q.toLowerCase();
  const rows = scoped
    .filter((r) => matchesStatus(r, status))
    .filter((r) => !needle || SEARCHABLE.some((k) => String(r.a[k] ?? "").toLowerCase().includes(needle)));
  const statusCount = (s: string) => scoped.filter((r) => matchesStatus(r, s)).length;
  const groupCount = (g: string) => all.filter((r) => (!campaignFilter || r.campaignId === campaignFilter) && (g === "all" || r.group === g)).length;

  const href = (patch: Record<string, string>) => {
    const params = new URLSearchParams({ group, status, campaign: String(campaignFilter || ""), ...(q && { q }), ...patch });
    for (const [k, v] of [...params]) if ((k === "group" && v === "all") || (k === "status" && v === "Active") || v === "" || v === "0") params.delete(k);
    const s = params.toString();
    return s ? `/applicants?${s}` : "/applicants";
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Applicants"
        description="Everyone who applied, across all campaigns. Rejecting someone sends them one personal email, straight away, and moves them out of this list."
      />

      <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200/80 sm:p-4">
        {campaigns.data.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-slate-500">Campaign</span>
            {[{ id: 0, name: "All campaigns" }, ...campaigns.data].map((c) => (
              <Link key={c.id} href={href({ campaign: String(c.id) })}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${campaignFilter === c.id ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300"}`}>
                {c.name}
              </Link>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="tablist" aria-label="Experience">
              {GROUPS.map((g) => (
                <Link key={g.key} href={href({ group: g.key })} role="tab" aria-selected={group === g.key}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${group === g.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                  {g.label}<span className="ml-1.5 text-xs text-slate-400 tabular-nums">{groupCount(g.key)}</span>
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <Link key={s} href={href({ status: s })}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${status === s ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300"}`}>
                  {STATUS_LABEL[s]} <span className="tabular-nums opacity-60">{statusCount(s)}</span>
                </Link>
              ))}
            </div>
          </div>
          <form action="/applicants" className="relative lg:w-72">
            {group !== "all" && <input type="hidden" name="group" value={group} />}
            {status !== "Active" && <input type="hidden" name="status" value={status} />}
            {campaignFilter > 0 && <input type="hidden" name="campaign" value={campaignFilter} />}
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={q} placeholder="Search name, skill, school…" aria-label="Search applicants"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </form>
        </div>
      </div>

      {groups.data.some((g) => g.errors.length) && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Some campaign sheets couldn&apos;t be read. Check their links on the Campaigns page.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={<UsersIcon className="h-5 w-5" />} title={all.length ? "No applicants match these filters" : "No applicants yet"}>
          {all.length
            ? <Link href="/applicants" className="font-medium text-brand-700 hover:text-brand-800">Clear filters</Link>
            : <>New applications appear here once the inbox is checked. Use <b>Check inbox now</b> on the Overview.</>}
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => <ApplicantCard key={rowKey(r)} row={r} emailedAt={String(r.a["Rejection Email Sent"] ?? "") || sentAt.get(emailedKey(r)) || ""} showCampaign={campaigns.data.length > 1} />)}
        </ul>
      )}
    </div>
  );
}
