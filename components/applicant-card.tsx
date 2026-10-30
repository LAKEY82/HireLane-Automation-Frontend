import type { ApplicantRow } from "@/lib/campaigns";
import { initials, splitList, timeAgo } from "@/lib/format";
import { CheckIcon, FileIcon } from "./icons";
import { StatusSelect } from "./ui";

const text = (row: ApplicantRow, k: string) => String(row.a[k] ?? "").trim();

// Avatar colour derived from the name, so the same person always gets the same colour
const AVATARS = ["bg-brand-100 text-brand-700", "bg-sky-100 text-sky-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-700", "bg-teal-100 text-teal-700"];
const avatar = (name: string) => AVATARS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATARS.length];

// One applicant. `emailedAt` is the application's rejection-email date (any of its rows).
export function ApplicantCard({ row, emailedAt, showCampaign = false }: { row: ApplicantRow; emailedAt: string; showCampaign?: boolean }) {
  const t = (k: string) => text(row, k);
  const id = t("Gmail Message ID");
  const name = t("Full Name") || "Unknown applicant";
  const skills = splitList(t("Skills"));
  const years = Number(t("Total Experience (Years)")) || 0;
  const relevant = t("Relevant Experience");
  const contact = [t("Phone"), t("Location")].filter(Boolean).join(" · ");
  const cvEmail = t("Email");
  const sender = t("Applied From");
  const mismatch = !!cvEmail && !!sender && cvEmail.toLowerCase() !== sender.toLowerCase();

  return (
    <li className="grid gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200/80 transition hover:ring-slate-300 sm:p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_auto] lg:items-start">
      <div className="flex min-w-0 gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${avatar(name)}`}>{initials(name)}</span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
            {name}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${row.group === "experienced" ? "bg-brand-50 text-brand-700" : "bg-sky-50 text-sky-700"}`}>
              {row.group === "experienced" ? "Experienced" : "Fresher"}
            </span>
          </p>
          <p className="truncate text-sm text-slate-600" title="Email written in the CV">{cvEmail || "No email in CV"}</p>
          {sender && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span className="truncate">Applied from <span className="font-medium text-slate-600">{sender}</span></span>
              {mismatch && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">Different from CV email</span>}
            </p>
          )}
          <p className="text-xs text-slate-500">
            {contact && `${contact} · `}Applied {timeAgo(t("Date Received"))}
            {showCampaign && row.campaign && <> · <span className="font-medium text-slate-600">{row.campaign.name}</span></>}
          </p>
        </div>
      </div>

      <div className="min-w-0 text-sm">
        {t("Summary") && <p className="line-clamp-2 text-slate-700">{t("Summary")}</p>}
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-medium text-slate-600">{years} yr{years === 1 ? "" : "s"} experience</span>
          {relevant ? ` · ${relevant}` : " · none relevant"}
        </p>
        {skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {skills.slice(0, 5).map((sk) => <span key={sk} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{sk}</span>)}
            {skills.length > 5 && <span className="px-1 text-[11px] text-slate-400">+{skills.length - 5} more</span>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 lg:flex-col lg:items-end lg:border-0 lg:pt-0">
        <StatusSelect campaignId={row.campaignId} group={row.group} messageId={id} status={t("Status")} emailed={!!emailedAt} name={name} cvEmail={cvEmail} senderEmail={sender}
          key={`${id}-${t("row_number")}-${t("Status")}`} />
        <div className="flex items-center gap-3 text-xs">
          {emailedAt && <span className="inline-flex items-center gap-1 text-slate-500" title={t("Send Rejection To") ? `Sent to ${t("Send Rejection To")}` : undefined}><CheckIcon className="h-3.5 w-3.5 text-emerald-600" />Email sent {timeAgo(emailedAt)}{t("Send Rejection To") && <> to {t("Send Rejection To")}</>}</span>}
          {t("CV Link") && (
            <a href={t("CV Link")} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
              <FileIcon className="h-3.5 w-3.5" /> CV
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

// A rejection email is per application: duplicate rows of an emailed application count as emailed
export function emailedDates(rows: ApplicantRow[]): Map<string, string> {
  const sent = new Map<string, string>();
  for (const r of rows) {
    const at = text(r, "Rejection Email Sent");
    if (at) sent.set(`${r.campaignId}:${text(r, "Gmail Message ID")}`, at);
  }
  return sent;
}

export const emailedKey = (r: ApplicantRow) => `${r.campaignId}:${text(r, "Gmail Message ID")}`;
export const rowKey = (r: ApplicantRow) => `${r.campaignId}-${r.group}-${text(r, "row_number")}`;
