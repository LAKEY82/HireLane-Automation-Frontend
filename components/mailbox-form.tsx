"use client";

import { useActionState, useState } from "react";
import { saveMailbox } from "@/app/actions";
import type { Credential } from "@/lib/n8n";
import type { MailProvider, Settings } from "@/lib/settings";
import { Feedback, SubmitButton } from "./ui";

const input = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const PROVIDERS: { value: MailProvider; label: string; description: string }[] = [
  { value: "gmail", label: "Gmail", description: "A Google account connected in n8n" },
  { value: "hostinger", label: "Hostinger mail", description: "Your own-domain mailbox on Hostinger" },
];

export function MailboxForm({ settings, credentials, credentialsUrl, defaults }: {
  settings: Settings;
  credentials: Credential[];
  credentialsUrl: string;
  defaults: { imapHost: string; smtpHost: string };
}) {
  const [state, action] = useActionState(saveMailbox, {});
  const [provider, setProvider] = useState<MailProvider>(settings.mailProvider);
  const gmailAccounts = credentials.filter((c) => c.type === "gmailOAuth2");
  const connected = settings.mailProvider === "hostinger" ? settings.hostingerEmail : gmailAccounts.find((c) => c.id === settings.gmailCredentialId)?.name;

  return (
    <form action={action} className="grid gap-5 pb-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="font-semibold text-slate-900">Inbox</h2>
        <p className="mt-1 text-sm text-slate-500">Applications are read from this mailbox, and rejection emails are sent from it.</p>
        {connected && (
          <p className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate">Connected: {connected}</span>
          </p>
        )}
      </div>

      <div className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {PROVIDERS.map((p) => (
          <label key={p.value}
            className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ${provider === p.value ? "bg-brand-50 ring-brand-400" : "ring-slate-200 hover:bg-slate-50"}`}>
            <input type="radio" name="mailProvider" value={p.value} checked={provider === p.value}
              onChange={() => setProvider(p.value)} className="mt-1" />
            <span className="text-sm">
              <span className="block font-medium">{p.label}</span>
              <span className="text-slate-500">{p.description}</span>
            </span>
          </label>
        ))}
      </div>

      {provider === "gmail" ? (
        <div className="grid gap-2 text-sm">
          <label className="flex flex-col gap-1 font-medium">
            Gmail account
            <select name="gmailCredentialId" defaultValue={settings.gmailCredentialId} required className={input}>
              {!gmailAccounts.some((c) => c.id === settings.gmailCredentialId) && <option value="">Choose…</option>}
              {gmailAccounts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <p className="text-xs text-slate-500">
            To use another Gmail address,{" "}
            <a href={credentialsUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">connect it in n8n</a>{" "}
            (Create credential → Gmail OAuth2 → Sign in with Google), then reload this page and pick it here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Email address
            <input name="hostingerEmail" type="email" defaultValue={settings.hostingerEmail} placeholder="careers@yourdomain.com" required className={input} autoComplete="username" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Password
            <input name="hostingerPassword" type="password" className={input} autoComplete="current-password"
              placeholder={settings.hostingerEmail ? "Leave empty to keep the current login" : "Mailbox password"} />
            <span className="text-xs font-normal text-slate-500">Stored only in n8n, never in this app.</span>
          </label>
          <details className="text-sm md:col-span-2">
            <summary className="cursor-pointer text-slate-600">Mail servers (only change if Hostinger tells you to)</summary>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 font-medium">
                Incoming (IMAP, port 993)
                <input name="imapHost" defaultValue={defaults.imapHost} className={input} />
              </label>
              <label className="flex flex-col gap-1 font-medium">
                Outgoing (SMTP, port 465)
                <input name="smtpHost" defaultValue={defaults.smtpHost} className={input} />
              </label>
            </div>
          </details>
        </div>
      )}

      <div className="flex items-center gap-4">
        <SubmitButton>{provider === "hostinger" ? "Connect & use Hostinger" : "Use Gmail"}</SubmitButton>
        <Feedback state={state} />
      </div>
      </div>
    </form>
  );
}
