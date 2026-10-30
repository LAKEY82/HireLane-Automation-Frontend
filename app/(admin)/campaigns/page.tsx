import { listApplicants, listCampaigns, type Campaign } from "@/lib/n8n";
import { countByStatus, flattenApplicants, keywordList, statusOf, type ApplicantRow } from "@/lib/campaigns";
import { timeAgo } from "@/lib/format";
import { EmptyState, ErrorPanel, PageHeader, attempt } from "@/components/panels";
import { ApplicantCard, emailedDates, emailedKey, rowKey } from "@/components/applicant-card";
import { CampaignActions } from "@/components/campaign-actions";
import { CampaignForm } from "@/components/campaign-form";
import { RefreshButton } from "@/components/refresh-button";
import { ExternalIcon, SparkIcon } from "@/components/icons";

export const metadata = { title: "Campaigns" };

const Chevron = () => (
  <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden>
    <path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const sheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;
const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

function Count({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <span className="flex flex-col items-center rounded-lg px-2 py-1 sm:px-3">
      <span className={`text-base font-semibold tabular-nums ${tone}`}>{value}</span>
      <span className="text-[11px] text-slate-500">{label}</span>
    </span>
  );
}

function CampaignCard({ campaign, rows, sentAt, loaded }: { campaign: Campaign; rows: ApplicantRow[]; sentAt: Map<string, string>; loaded: boolean }) {
  const counts = countByStatus(rows);
  const active = rows.filter((r) => statusOf(r.a) !== "Rejected");
  const rejected = rows.filter((r) => statusOf(r.a) === "Rejected");
  const open = campaign.status === "open";
  const emailedAt = (r: ApplicantRow) => String(r.a["Rejection Email Sent"] ?? "") || sentAt.get(emailedKey(r)) || "";

  return (
    <details className="group rounded-2xl bg-white ring-1 ring-slate-200/80 open:shadow-sm open:ring-slate-300">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-4 rounded-2xl p-4 hover:bg-slate-50/60 sm:p-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-semibold text-slate-900">{campaign.name}</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${open ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-emerald-500" : "bg-slate-400"}`} />{open ? "Open" : "Paused"}
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span>{campaign.position}</span><span aria-hidden>·</span><span>subject has</span>
            {keywordList(campaign.keywords).map((k) => <span key={k} className="rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700">{k}</span>)}
            <span aria-hidden>·</span><span>started {timeAgo(campaign.createdAt)}</span>
          </p>
        </div>
        <div className="flex items-center divide-x divide-slate-100 rounded-xl ring-1 ring-slate-100">
          <Count label="applied" value={loaded ? counts.total : "—"} tone="text-slate-900" />
          <Count label="to review" value={loaded ? counts.pending : "—"} tone="text-amber-600" />
          <Count label="shortlisted" value={loaded ? counts.shortlisted : "—"} tone="text-emerald-600" />
          <Count label="rejected" value={loaded ? counts.rejected : "—"} tone="text-rose-600" />
        </div>
        <RefreshButton disabled={!open} applicantCount={counts.total} />
        <Chevron />
      </summary>

      <div className="grid gap-5 border-t border-slate-100 p-4 sm:p-5">
        {!loaded ? (
          <p className="text-sm text-slate-500">Applicants couldn&apos;t be loaded right now.</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No applicants yet. Emails with {keywordList(campaign.keywords).map((k) => `“${k}”`).join(" + ")} in the subject and a PDF CV will appear here.
          </p>
        ) : (
          <>
            {active.length > 0 && <ul className="grid gap-3">{active.map((r) => <ApplicantCard key={rowKey(r)} row={r} emailedAt={emailedAt(r)} />)}</ul>}
            {active.length === 0 && <p className="text-sm text-slate-500">Everyone in this campaign has been rejected.</p>}
            {rejected.length > 0 && (
              <details className="group/rej">
                <summary className="cursor-pointer list-none text-sm font-medium text-slate-600 hover:text-slate-900 [&::-webkit-details-marker]:hidden">
                  <span className="inline-block transition group-open/rej:rotate-90">›</span> Rejected ({rejected.length})
                </summary>
                <ul className="mt-3 grid gap-3">{rejected.map((r) => <ApplicantCard key={rowKey(r)} row={r} emailedAt={emailedAt(r)} />)}</ul>
              </details>
            )}
          </>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {[["Experienced sheet", sheetUrl(campaign.experiencedSheetId)], ["Freshers sheet", sheetUrl(campaign.freshersSheetId)],
            ["Experienced CVs", folderUrl(campaign.experiencedFolderId)], ["Freshers CVs", folderUrl(campaign.freshersFolderId)]].map(([label, url]) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
              {label} <ExternalIcon className="h-3 w-3" />
            </a>
          ))}
        </div>

        <details className="group/edit rounded-xl ring-1 ring-slate-200">
          <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
            Edit campaign
          </summary>
          <div className="border-t border-slate-200 p-4"><CampaignForm campaign={campaign} /></div>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">{open ? "Matching new emails now." : "Paused: new emails for this campaign are ignored."}</p>
          <CampaignActions id={campaign.id} name={campaign.name} status={campaign.status} pending={counts.pending} />
        </div>
      </div>
    </details>
  );
}

export default async function CampaignsPage() {
  const [campaigns, groups] = await Promise.all([attempt(listCampaigns), attempt(listApplicants)]);
  if (!campaigns.data) return <ErrorPanel error={campaigns.error} />;

  const rows = groups.data ? flattenApplicants(groups.data, campaigns.data) : [];
  const sentAt = emailedDates(rows);
  const newestFirst = [...campaigns.data].reverse();

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Campaigns"
        description="One campaign per role you're hiring for. Each has its own subject keywords, sheets and CV folders. Click a campaign to see its applicants."
      />

      <details className="group rounded-2xl bg-brand-50/60 ring-1 ring-brand-200">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-4 font-medium text-brand-800 hover:bg-brand-50 sm:p-5 [&::-webkit-details-marker]:hidden">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-lg leading-none text-white">+</span>
          New campaign
          <span className="ml-auto"><Chevron /></span>
        </summary>
        <div className="border-t border-brand-200 bg-white p-4 sm:p-5 rounded-b-2xl">
          <CampaignForm template={newestFirst[0]} />
        </div>
      </details>

      {newestFirst.length === 0 ? (
        <EmptyState icon={<SparkIcon className="h-5 w-5" />} title="No campaigns yet">
          Create your first campaign above. Hirelane then picks up matching applications from your inbox.
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {newestFirst.map((c) => (
            <CampaignCard key={c.id} campaign={c} rows={rows.filter((r) => r.campaignId === c.id)} sentAt={sentAt} loaded={!!groups.data} />
          ))}
        </div>
      )}
    </div>
  );
}
