import Link from "next/link";
import { getWorkflow, listApplicants, listCampaigns, listExecutions, type Execution } from "@/lib/n8n";
import { countByStatus, flattenApplicants } from "@/lib/campaigns";
import { readSettings } from "@/lib/settings";
import { fullDate, timeAgo } from "@/lib/format";
import { Card, ErrorPanel, PageHeader, StatCard, attempt } from "@/components/panels";
import { ActivateWorkflowButton, AutomationToggle, RunButtons } from "@/components/ui";
import { AlertIcon, ArrowRightIcon, BoltIcon, ClockIcon, MailIcon } from "@/components/icons";

export const metadata = { title: "Overview" };

// Successful webhook runs are the dashboard's own requests; show automatic runs and failures
function activity(runs: Execution[]) {
  return runs
    .filter((r) => r.mode !== "webhook" || r.status !== "success")
    .slice(0, 6)
    .map((r) => ({
      ...r,
      label: r.mode === "trigger" ? "Automatic check" : r.mode === "webhook" ? "Dashboard action" : r.mode === "manual" ? "Run from n8n" : "Run",
      ok: r.status === "success",
    }));
}

export default async function Overview() {
  const [wf, runs, people, campaigns] = await Promise.all([attempt(getWorkflow), attempt(() => listExecutions(40)), attempt(listApplicants), attempt(listCampaigns)]);
  if (!wf.data) return <ErrorPanel error={wf.error} />;

  const workflow = wf.data;
  const s = readSettings(workflow);
  const all = people.data ? flattenApplicants(people.data, campaigns.data ?? []) : [];
  const counts = countByStatus(all);
  const openCampaigns = (campaigns.data ?? []).filter((c) => c.status === "open");
  const inbox = s.mailProvider === "hostinger" ? s.hostingerEmail : "Gmail";
  const running = s.automationOn && workflow.active;
  const recent = runs.data ? activity(runs.data) : [];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Overview"
        description={openCampaigns.length
          ? <>Hiring for {openCampaigns.map((c, i) => <span key={c.id}>{i > 0 && ", "}<span className="font-medium text-slate-700">{c.position}</span></span>)} · <Link href="/campaigns" className="font-medium text-brand-700 hover:text-brand-800">{openCampaigns.length} open campaign{openCampaigns.length === 1 ? "" : "s"}</Link></>
          : <>No open campaigns. <Link href="/campaigns" className="font-medium text-brand-700 hover:text-brand-800">Create one</Link> to start collecting applications.</>}
        actions={
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ring-1 ${running ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
            <span className={`h-2 w-2 rounded-full ${running ? "animate-pulse bg-emerald-500" : "bg-slate-400"}`} />
            {running ? "Live" : "Paused"}
          </span>
        }
      />

      {!workflow.active && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
          <div className="flex gap-3">
            <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-900">The automation engine is switched off</p>
              <p className="text-sm text-amber-800">Activate it so applicants, status changes and the buttons below work. This doesn&apos;t start automatic checks.</p>
            </div>
          </div>
          <ActivateWorkflowButton />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Applicants" value={people.data ? all.length : "—"} tone="brand" href="/applicants"
          hint={people.data ? `${all.filter((r) => r.group === "experienced").length} experienced · ${all.filter((r) => r.group === "freshers").length} freshers` : "Couldn't load"} />
        <StatCard label="To review" value={people.data ? counts.pending : "—"} tone="amber" href="/applicants?status=Pending" hint="Waiting for a decision" />
        <StatCard label="Shortlisted" value={people.data ? counts.shortlisted : "—"} tone="emerald" href="/applicants?status=Shortlisted" />
        <StatCard label="Rejected" value={people.data ? counts.rejected : "—"} tone="rose" href="/applicants?status=Rejected"
          hint={people.data ? `${all.filter((r) => r.a["Rejection Email Sent"]).length} emailed` : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Automation" icon={<BoltIcon className="h-[18px] w-[18px]" />}
          description={s.automationOn
            ? `Checks the inbox every ${s.intakeEveryMinutes === 1 ? "minute" : `${s.intakeEveryMinutes} minutes`} and sends rejections every ${s.rejectionEveryMinutes} minutes.`
            : "Turn on to check the inbox and send rejection emails automatically."}>
          <AutomationToggle on={s.automationOn} disabled={!workflow.active} />
        </Card>

        <Card className="lg:col-span-2" title="Inbox" icon={<MailIcon className="h-[18px] w-[18px]" />}
          description="Applications are read from here, and rejections are sent from it."
          action={<Link href="/settings" className="text-sm font-medium text-brand-700 hover:text-brand-800">Change</Link>}>
          <p className="truncate rounded-lg bg-slate-50 px-3 py-2 font-medium text-slate-800 ring-1 ring-slate-200">
            {inbox || "Not connected"}
            <span className="ml-2 text-xs font-normal text-slate-500">{s.mailProvider === "hostinger" ? "Hostinger" : "Google"}</span>
          </p>
        </Card>
      </div>

      <Card title="Quick actions" description="Run a step right now instead of waiting for the schedule.">
        <RunButtons disabled={!workflow.active} lookbackDays={s.lookbackDays} />
      </Card>

      <Card title="Recent activity" icon={<ClockIcon className="h-[18px] w-[18px]" />} description="Automatic checks and anything that failed.">
        {!runs.data ? <ErrorPanel error={runs.error} /> : recent.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing yet. Activity appears here once automation runs.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${r.ok ? "bg-emerald-500" : r.status === "running" ? "bg-sky-500" : "bg-rose-500"}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{r.label}</p>
                    <p className="text-xs text-slate-500">{r.ok ? "Completed" : r.status === "running" ? "Running" : "Failed. Open n8n for details"} · run #{r.id}</p>
                  </div>
                </div>
                <time className="shrink-0 text-xs text-slate-500" dateTime={r.startedAt} title={fullDate(r.startedAt)}>{timeAgo(r.startedAt)}</time>
              </li>
            ))}
          </ul>
        )}
        <Link href="/applicants" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
          Review applicants <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </Card>
    </div>
  );
}
