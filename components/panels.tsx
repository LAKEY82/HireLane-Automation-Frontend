import { unstable_rethrow } from "next/navigation";
import { AlertIcon } from "./icons";

export function PageHeader({ title, description, actions }: {
  title: string; description?: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, description, icon, action, children, className = "" }: {
  title?: string; description?: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/80 sm:p-6 ${className}`}>
      {title && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {icon && <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>}
            <div>
              <h2 className="font-semibold text-slate-900">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, tone = "slate", href }: {
  label: string; value: React.ReactNode; hint?: string; tone?: "slate" | "brand" | "amber" | "emerald" | "rose"; href?: string;
}) {
  const dot = { slate: "bg-slate-400", brand: "bg-brand-500", amber: "bg-amber-400", emerald: "bg-emerald-500", rose: "bg-rose-500" }[tone];
  const body = (
    <>
      <p className="flex items-center gap-2 text-sm text-slate-500"><span className={`h-2 w-2 rounded-full ${dot}`} />{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );
  const cls = "block rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
  return href
    ? <a href={href} className={`${cls} transition hover:ring-brand-300 hover:shadow-md`}>{body}</a>
    : <div className={cls}>{body}</div>;
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-brand-600">{icon}</span>
      <p className="mt-3 font-medium text-slate-900">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function ErrorPanel({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  // A hosted n8n on a free plan sleeps when idle: while it starts, requests time out, get 502/503,
  // or hit a 404 "Cannot GET /api/…" page before its API routes are registered
  if (/timeout|aborted|responded 50[234]|Cannot (GET|POST|PUT|PATCH|DELETE) \/api\//i.test(message)) {
    return (
      <div role="alert" className="flex gap-3 rounded-2xl bg-amber-50 p-5 text-sm text-amber-900 ring-1 ring-amber-200">
        <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="font-semibold">n8n is waking up</p>
          <p className="mt-1 break-words text-amber-800">
            The server sleeps when it hasn&apos;t been used for a while and takes about a minute to start. Try again in a minute.
          </p>
          <a href="" className="mt-3 inline-flex rounded-lg bg-white px-3 py-1.5 font-medium text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100">Try again</a>
          <p className="mt-2 break-words font-mono text-xs text-amber-700/80">{message}</p>
        </div>
      </div>
    );
  }
  const hint = /N8N_API_KEY is not set|401/.test(message)
    ? "Add a valid n8n API key (n8n → Settings → n8n API) as N8N_API_KEY."
    : /403/.test(message)
      ? "The webhook secret is missing or wrong. Check the \"Frontend Webhook Secret\" credential in n8n matches N8N_WEBHOOK_SECRET."
      : /404/.test(message)
        ? "The workflow may be inactive (webhooks only work when it is active) or the workflow ID is wrong."
        : "Check that n8n is running and N8N_BASE_URL is correct.";
  return (
    <div role="alert" className="flex gap-3 rounded-2xl bg-rose-50 p-5 text-sm text-rose-900 ring-1 ring-rose-200">
      <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
      <div className="min-w-0">
        <p className="font-semibold">Couldn&apos;t reach the automation engine</p>
        <p className="mt-1 break-words text-rose-800">{hint}</p>
        <p className="mt-2 break-words font-mono text-xs text-rose-700/80">{message}</p>
      </div>
    </div>
  );
}

export async function attempt<T>(fn: () => Promise<T>): Promise<{ data: T; error: null } | { data: null; error: unknown }> {
  try {
    return { data: await fn(), error: null };
  } catch (error) {
    unstable_rethrow(error); // let Next.js signals (dynamic rendering, redirects) through
    return { data: null, error };
  }
}
