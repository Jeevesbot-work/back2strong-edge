"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TestAccountToggle({ userId, isTest }: { userId: string; isTest: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(isTest);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setBusy(true);
    setError("");
    const next = !on;
    const res = await fetch("/api/admin/test-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, is_test: next }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not update");
      return;
    }
    setOn(json.is_test === true);
    router.refresh();
  }

  return (
    <div className="bg-edge-surface rounded-xl p-4 border border-white/[0.08] mb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-muted">Test account</p>
          <p className="text-white/80 text-sm font-body mt-1">
            {on
              ? "Hidden from client lists, rundowns, and coach views. Nothing is deleted."
              : "Shows up with real clients."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="flex-shrink-0 bg-edge-bronze/10 border border-edge-bronze/30 text-edge-bronze font-condensed text-xs uppercase px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          {busy ? "Saving…" : on ? "Show with clients" : "Mark as test"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
