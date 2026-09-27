"use client";

import { useState } from "react";

// Creates a 7-day sign-in link and copies it, ready to paste into WhatsApp.
export default function CopyLoginLinkButton({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "show" | "error">("idle");
  const [link, setLink] = useState("");

  async function go() {
    setState("loading");
    const res = await fetch("/api/admin/login-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.link) { setState("error"); return; }
    setLink(data.link);
    try { await navigator.clipboard.writeText(data.link); setState("copied"); } catch { setState("show"); }
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <button onClick={go} disabled={state === "loading"}
        className="bg-edge-bronze text-edge-bg font-condensed font-bold text-xs uppercase tracking-wide px-3 py-1.5 rounded-lg disabled:opacity-50 active:scale-95 transition-transform">
        {state === "loading" ? "Creating…" : state === "copied" ? "Copied — paste in WhatsApp" : state === "error" ? "Failed — retry" : "Copy login link"}
      </button>
      {state === "show" && (
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Login link"
          style={{ fontSize: 11, padding: 6, borderRadius: 8, background: "#0E1014", color: "#F2F1ED", border: "1px solid #252A32", width: 260 }} />
      )}
    </span>
  );
}
