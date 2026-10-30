"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/actions";
import { activateWorkflow, runNow, toggleAutomation, updateStatus } from "@/app/actions";
import type { ApplicantGroup } from "@/lib/n8n";
import { AlertIcon, CheckIcon, InboxIcon, SendIcon } from "./icons";

const BUTTON = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:outline-brand-600",
  secondary: "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:outline-rose-600",
};

export function Spinner() {
  return <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />;
}

export function SubmitButton({ children, variant = "primary", name, value, className = "" }: {
  children: React.ReactNode; variant?: keyof typeof BUTTON; name?: string; value?: string; className?: string;
}) {
  const { pending, data } = useFormStatus();
  // With several submit buttons in one form, only the clicked one shows the spinner
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <button type="submit" name={name} value={value} disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON[variant]} ${className}`}>
      {mine && <Spinner />}
      {children}
    </button>
  );
}

export function Feedback({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p role="status" className={`flex items-start gap-1.5 text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
      {state.ok ? <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{state.message}</span>
    </p>
  );
}

// A real switch: one click turns the automatic inbox checks and rejection emails on or off
export function AutomationToggle({ on, disabled = false }: { on: boolean; disabled?: boolean }) {
  const [state, action] = useActionState(toggleAutomation, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="on" value={String(!on)} />
      <SwitchButton on={on} disabled={disabled} />
      <Feedback state={state} />
    </form>
  );
}

function SwitchButton({ on, disabled }: { on: boolean; disabled: boolean }) {
  const { pending } = useFormStatus();
  const shown = pending ? !on : on;
  return (
    <button type="submit" role="switch" aria-checked={on} disabled={disabled || pending}
      className="group inline-flex w-fit items-center gap-3 rounded-full text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
      <span className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${shown ? "bg-emerald-500" : "bg-slate-300"} group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-brand-600`}>
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${shown ? "translate-x-6" : "translate-x-1"}`} />
      </span>
      {pending ? "Saving…" : on ? "On: running automatically" : "Off: nothing runs on its own"}
    </button>
  );
}

export function ActivateWorkflowButton() {
  const [state, action] = useActionState(activateWorkflow, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <SubmitButton>Activate</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

export function RunButtons({ disabled, lookbackDays }: { disabled: boolean; lookbackDays: number }) {
  const [state, action] = useActionState(runNow, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2">
        <ActionTile name="intake" icon={<InboxIcon className="h-5 w-5" />} title="Check inbox now"
          description={`Pull in new applications from the last ${lookbackDays} days.`} />
        <ActionTile name="rejections" icon={<SendIcon className="h-5 w-5" />} title="Send pending rejections"
          description="Email everyone marked Rejected who hasn't heard back yet." />
      </fieldset>
      <Feedback state={state} />
    </form>
  );
}

function ActionTile({ name, icon, title, description }: { name: string; icon: React.ReactNode; title: string; description: string }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("what") === name;
  return (
    <button type="submit" name="what" value={name}
      className="group flex items-start gap-3 rounded-xl p-4 text-left ring-1 ring-slate-200 transition hover:bg-brand-50/50 hover:ring-brand-300 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100">
        {mine ? <Spinner /> : icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-900">{mine ? "Working…" : title}</span>
        <span className="mt-0.5 block text-sm text-slate-500">{description}</span>
      </span>
    </button>
  );
}

const STATUSES = ["Pending", "Shortlisted", "Rejected"] as const;
export const STATUS_STYLE: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-800 ring-amber-200",
  Shortlisted: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  Rejected: "bg-rose-50 text-rose-800 ring-rose-200",
};

export function StatusSelect({ campaignId, group, messageId, status, emailed, name, cvEmail, senderEmail }: {
  campaignId: number; group: ApplicantGroup; messageId: string; status: string; emailed: boolean; name: string;
  cvEmail: string; senderEmail: string;
}) {
  const [value, setValue] = useState(status || "Pending");
  const [error, setError] = useState("");
  const [choosing, setChoosing] = useState(false);
  const [pending, startTransition] = useTransition();

  // Rejection recipients: the CV email and the address the application came from (when they differ)
  const options = [
    cvEmail && { email: cvEmail, label: "Email in the CV" },
    senderEmail && senderEmail.toLowerCase() !== cvEmail.toLowerCase() && { email: senderEmail, label: "Address it was sent from" },
  ].filter(Boolean) as { email: string; label: string }[];
  const [sendTo, setSendTo] = useState(options[0]?.email ?? "");

  function save(next: string, recipient?: string) {
    const previous = value;
    setValue(next);
    setError("");
    setChoosing(false);
    startTransition(async () => {
      const res = await updateStatus(campaignId, group, messageId, next, recipient);
      if (!res.ok) {
        setValue(previous);
        setError(res.message ?? "Update failed");
      }
    });
  }

  function change(next: string) {
    if (next === value) return;
    if (next !== "Rejected" || emailed) return save(next);
    if (options.length > 1) return setChoosing(true); // two different addresses: let the user pick
    const only = options[0]?.email;
    if (!confirm(`Reject ${name || "this applicant"}?\n\nA personal rejection email will be written and sent${only ? ` to ${only}` : ""} right away.`)) return;
    save(next, only);
  }

  return (
    <div className="flex flex-col gap-1">
      <div role="radiogroup" aria-label={`Status for ${name}`} className="inline-flex w-fit rounded-lg bg-slate-100 p-0.5">
        {STATUSES.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={value === s} disabled={pending}
            onClick={() => change(s)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:cursor-wait ${value === s ? `${STATUS_STYLE[s]} shadow-sm ring-1` : "text-slate-500 hover:text-slate-800"}`}>
            {s === "Shortlisted" ? "Shortlist" : s === "Rejected" ? "Reject" : s}
          </button>
        ))}
      </div>

      {choosing && (
        <div role="dialog" aria-label={`Choose where to send ${name}'s rejection email`}
          className="mt-1 w-72 max-w-full rounded-xl bg-white p-3 text-left shadow-lg ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-900">Send the rejection email to</p>
          <p className="mt-0.5 text-xs text-slate-500">These two addresses are different. Pick one.</p>
          <div className="mt-2 grid gap-1.5">
            {options.map((o) => (
              <label key={o.email}
                className={`flex cursor-pointer items-start gap-2 rounded-lg p-2 ring-1 ${sendTo === o.email ? "bg-brand-50 ring-brand-300" : "ring-slate-200 hover:bg-slate-50"}`}>
                <input type="radio" name={`send-to-${messageId}`} checked={sendTo === o.email} onChange={() => setSendTo(o.email)} className="mt-0.5" />
                <span className="min-w-0 text-xs">
                  <span className="block truncate font-medium text-slate-800">{o.email}</span>
                  <span className="text-slate-500">{o.label}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setChoosing(false)} className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="button" onClick={() => save("Rejected", sendTo)} disabled={!sendTo}
              className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50">Reject &amp; send</button>
          </div>
        </div>
      )}

      {pending && <span className="text-xs text-slate-500">{value === "Rejected" && !emailed ? "Saving and sending email…" : "Saving…"}</span>}
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </div>
  );
}
