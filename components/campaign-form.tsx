"use client";

import { useActionState } from "react";
import { saveCampaign } from "@/app/actions";
import type { Campaign } from "@/lib/n8n";
import { Feedback, SubmitButton } from "./ui";

const input = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function Field({ label, hint, children, wide = false }: { label: string; hint?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-sm font-medium text-slate-800 ${wide ? "md:col-span-2" : ""}`}>
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}
    </label>
  );
}

// Create (no campaign) or edit a campaign. New campaigns start with the last campaign's rule as a starting point.
export function CampaignForm({ campaign, template }: { campaign?: Campaign; template?: Campaign }) {
  const [state, action] = useActionState(saveCampaign, {});
  const c = campaign;
  return (
    <form action={action} className="grid gap-4">
      {c && <input type="hidden" name="id" value={c.id} />}
      <input type="hidden" name="status" value={c?.status ?? "open"} />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Campaign name" hint="Only you see this, e.g. “QA Intern – Nov 2026”.">
          <input name="name" defaultValue={c?.name} required className={input} />
        </Field>
        <Field label="Position title" hint="Used by the AI and in rejection emails.">
          <input name="position" defaultValue={c?.position} required placeholder="QA Intern" className={input} />
        </Field>
        <Field label="Subject keywords" hint="Every word must be in the email subject, in any order and any case. Punctuation is ignored, so “Intern - QA” means intern + qa." wide>
          <input name="keywords" defaultValue={c?.keywords} required placeholder="intern, qa" className={input} />
        </Field>
        <Field label="What counts as relevant experience" hint="Candidates with a real job or internship like this are Experienced; everyone else is a Fresher." wide>
          <textarea name="relevant" defaultValue={c?.relevant ?? template?.relevant} rows={2} required className={input} />
        </Field>
      </div>

      <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <p className="text-sm font-medium text-slate-800">Where this campaign&apos;s candidates go</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Paste Google links or IDs. Each campaign needs its own two sheets: make a copy of an existing one (File → Make a copy) and clear its rows,
          keeping the header row on the first tab. Folders can be shared.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <Field label="Experienced sheet"><input name="experiencedSheetId" defaultValue={c?.experiencedSheetId} required className={input} /></Field>
          <Field label="Freshers sheet"><input name="freshersSheetId" defaultValue={c?.freshersSheetId} required className={input} /></Field>
          <Field label="Experienced CVs folder"><input name="experiencedFolderId" defaultValue={c?.experiencedFolderId ?? template?.experiencedFolderId} required className={input} /></Field>
          <Field label="Freshers CVs folder"><input name="freshersFolderId" defaultValue={c?.freshersFolderId ?? template?.freshersFolderId} required className={input} /></Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton>{c ? "Save campaign" : "Create campaign"}</SubmitButton>
        <Feedback state={state} />
      </div>
    </form>
  );
}
