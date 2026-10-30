import { getWorkflow, listCredentials, n8nCredentialsUrl } from "@/lib/n8n";
import { HOSTINGER_DEFAULTS, readSettings } from "@/lib/settings";
import { ErrorPanel, PageHeader, attempt } from "@/components/panels";
import { MailboxForm } from "@/components/mailbox-form";
import { SettingsForm } from "@/components/settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [wf, creds] = await Promise.all([attempt(getWorkflow), attempt(listCredentials)]);
  if (!wf.data) return <ErrorPanel error={wf.error} />;
  if (!creds.data) return <ErrorPanel error={creds.error} />;
  const settings = readSettings(wf.data);

  return (
    <div className="grid gap-8">
      <PageHeader title="Settings" description="Changes take effect from the next run." />
      <div>
        <MailboxForm settings={settings} credentials={creds.data} credentialsUrl={n8nCredentialsUrl()}
          defaults={{ imapHost: HOSTINGER_DEFAULTS.imapHost, smtpHost: HOSTINGER_DEFAULTS.smtpHost }} />
        <div className="border-t border-slate-200 pt-8">
          <SettingsForm settings={settings} credentials={creds.data} />
        </div>
      </div>
    </div>
  );
}
