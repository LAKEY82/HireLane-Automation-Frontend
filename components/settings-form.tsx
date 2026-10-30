"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/actions";
import type { Credential } from "@/lib/n8n";
import type { Settings } from "@/lib/settings";
import { Feedback, SubmitButton } from "./ui";

const MINUTES = [1, 5, 10, 15, 30, 60];
const LOOKBACK_DAYS = [7, 30, 90, 365];
const input = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}
    </label>
  );
}

// Settings section: explanation on the left, fields on the right (stacked on small screens)
export function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-5 border-t border-slate-200 py-8 first:border-t-0 first:pt-0 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <div>
        <legend className="font-semibold text-slate-900">{title}</legend>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 sm:p-6">{children}</div>
    </fieldset>
  );
}

function CredentialSelect({ name, value, options, label }: { name: string; value: string; options: Credential[]; label: string }) {
  return (
    <Field label={label} hint={options.length ? undefined : "No logins of this type in n8n yet. Add one under Credentials in n8n first."}>
      <select name={name} defaultValue={value} required className={input}>
        {!options.some((o) => o.id === value) && <option value="">Choose…</option>}
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </Field>
  );
}

export function SettingsForm({ settings, credentials }: { settings: Settings; credentials: Credential[] }) {
  const [state, action] = useActionState(saveSettings, {});
  const of = (type: string) => credentials.filter((c) => c.type === type);

  return (
    <form action={action} className="grid">
      <Section title="Storage" description="The Google logins used to write to every campaign's sheets and CV folders. To use another Google account, connect it in n8n first; it then appears here.">
        <div className="grid gap-4 md:grid-cols-2">
          <CredentialSelect name="sheetsCredentialId" label="Google Sheets login" value={settings.sheetsCredentialId} options={of("googleSheetsOAuth2Api")} />
          <CredentialSelect name="driveCredentialId" label="Google Drive login" value={settings.driveCredentialId} options={of("googleDriveOAuth2Api")} />
        </div>
      </Section>

      <Section title="Schedule" description="How often things run while automation is on. Switch it on or off from the Overview.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Pick up applications from the last" hint="Emails older than this are ignored. Already-processed emails are never added twice.">
            <select name="lookbackDays" defaultValue={settings.lookbackDays} className={input}>
              {LOOKBACK_DAYS.map((d) => <option key={d} value={d}>{d === 365 ? "year" : `${d} days`}</option>)}
            </select>
          </Field>
          <Field label="Check inbox for new applications every">
            <select name="intakeEveryMinutes" defaultValue={settings.intakeEveryMinutes} className={input}>
              {MINUTES.map((m) => <option key={m} value={m}>{m === 1 ? "1 minute" : `${m} minutes`}</option>)}
            </select>
          </Field>
          <Field label="Send rejection emails every">
            <select name="rejectionEveryMinutes" defaultValue={settings.rejectionEveryMinutes} className={input}>
              {MINUTES.map((m) => <option key={m} value={m}>{m === 1 ? "1 minute" : `${m} minutes`}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <div className="sticky bottom-16 z-10 -mx-4 flex items-center gap-4 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:bottom-0 lg:mx-0 lg:rounded-xl lg:border lg:shadow-sm">
        <SubmitButton>Save changes</SubmitButton>
        <Feedback state={state} />
      </div>
    </form>
  );
}
