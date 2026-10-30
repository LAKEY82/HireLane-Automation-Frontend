"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshCampaign } from "@/app/actions";
import { Spinner } from "./ui";

const POLL_MS = 5_000;
const POLL_FOR_MS = 60_000; // reading CVs with AI takes a little while

// Runs the automation now, then re-renders the page every few seconds so new applicants show up.
export function RefreshButton({ disabled = false, applicantCount }: { disabled?: boolean; applicantCount: number }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "starting" | "checking" | "error">("idle");
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startCount = useRef(applicantCount);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  // New applicants arrived while polling: say so and stop
  useEffect(() => {
    if (phase === "checking" && applicantCount > startCount.current) {
      stop();
      const added = applicantCount - startCount.current;
      setPhase("idle");
      setMessage(`${added} new applicant${added === 1 ? "" : "s"}`);
    }
  }, [applicantCount, phase]);

  async function run(e: React.MouseEvent) {
    e.preventDefault(); // the button sits in the card header; don't expand/collapse the card
    e.stopPropagation();
    if (phase === "starting" || phase === "checking") return;
    setPhase("starting");
    setMessage("");
    startCount.current = applicantCount;
    const res = await refreshCampaign();
    if (!res.ok) {
      setPhase("error");
      setMessage(res.message ?? "Couldn't start");
      return;
    }
    setPhase("checking");
    const started = Date.now();
    stop();
    timer.current = setInterval(() => {
      if (Date.now() - started > POLL_FOR_MS) {
        stop();
        setPhase("idle");
        setMessage("Up to date");
        return;
      }
      router.refresh();
    }, POLL_MS);
  }

  const busy = phase === "starting" || phase === "checking";
  return (
    <span className="flex items-center gap-2">
      {message && !busy && (
        <span role="status" className={`hidden text-xs sm:inline ${phase === "error" ? "text-rose-700" : "text-emerald-700"}`} title={message}>
          {message.length > 40 ? `${message.slice(0, 40)}…` : message}
        </span>
      )}
      <button type="button" onClick={run} disabled={disabled || busy}
        title={disabled ? "Reopen the campaign to run it" : "Check the inbox for new applications and send pending rejection emails now"}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? <Spinner /> : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
          </svg>
        )}
        {phase === "starting" ? "Starting…" : phase === "checking" ? "Checking…" : "Refresh"}
      </button>
    </span>
  );
}
