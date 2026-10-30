"use client";

import { useState, useTransition } from "react";
import { removeCampaign, setCampaignStatus, type ActionState } from "@/app/actions";
import { Feedback, Spinner } from "./ui";

const button = "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition disabled:cursor-wait disabled:opacity-60";

export function CampaignActions({ id, name, status, pending }: { id: number; name: string; status: "open" | "paused"; pending: number }) {
  const [state, setState] = useState<ActionState>({});
  const [busy, setBusy] = useState<"status" | "delete" | null>(null);
  const [, startTransition] = useTransition();

  const run = (kind: "status" | "delete", fn: () => Promise<ActionState>) => {
    setBusy(kind);
    startTransition(async () => {
      setState(await fn());
      setBusy(null);
    });
  };

  function remove() {
    const warning = pending > 0 ? `\n\n${pending} applicant${pending === 1 ? " is" : "s are"} still waiting for a decision.` : "";
    if (!confirm(`Delete the campaign “${name}”?${warning}\n\nIt disappears from Hirelane and stops matching new emails. Its Google Sheets and CV folders stay in your Google account.`)) return;
    run("delete", () => removeCampaign(id));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={!!busy} onClick={() => run("status", () => setCampaignStatus(id, status === "open" ? "paused" : "open"))}
        className={`${button} bg-white text-slate-700 ring-slate-300 hover:bg-slate-50`}>
        {busy === "status" && <Spinner />}{status === "open" ? "Pause" : "Reopen"}
      </button>
      <button type="button" disabled={!!busy} onClick={remove}
        className={`${button} bg-white text-rose-700 ring-rose-200 hover:bg-rose-50`}>
        {busy === "delete" && <Spinner />}Delete campaign
      </button>
      <Feedback state={state} />
    </div>
  );
}
