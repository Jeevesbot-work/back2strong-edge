"use client";

import { useState } from "react";
import Link from "next/link";

export default function InviteForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [readyName, setReadyName] = useState("");
  const [copied, setCopied] = useState(false);

  async function submit() {
    setLoading(true);
    setError("");
    setCopied(false);
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, email }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok || !json.link || json.emailed !== false) {
      setError(json.error ?? "Could not create the invite");
      return;
    }
    setLink(json.link);
    setReadyName(json.fullName ?? fullName);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-h-screen bg-edge-bg max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin" className="w-9 h-9 rounded-xl bg-edge-surface border border-white/10 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="font-condensed font-black text-2xl uppercase tracking-wide">Invite a client</h1>
          <p className="text-edge-muted text-xs">Creates a link. Nothing is emailed.</p>
        </div>
      </div>

      <div className="bg-edge-surface rounded-xl border border-white/[0.08] p-5 space-y-3">
        <div>
          <label className="text-edge-muted text-xs uppercase tracking-widest font-condensed block mb-1.5" htmlFor="invite-name">Name</label>
          <input
            id="invite-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Adrian Borg"
            className="w-full bg-edge-bg border border-white/10 rounded-xl px-4 py-3 text-white font-body text-sm placeholder:text-edge-muted focus:outline-none focus:border-edge-bronze"
          />
        </div>
        <div>
          <label className="text-edge-muted text-xs uppercase tracking-widest font-condensed block mb-1.5" htmlFor="invite-email">Email</label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@email.com"
            className="w-full bg-edge-bg border border-white/10 rounded-xl px-4 py-3 text-white font-body text-sm placeholder:text-edge-muted focus:outline-none focus:border-edge-bronze"
          />
        </div>
        {error && <p className="text-red-400 text-sm font-body">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={loading || !fullName.trim() || !email.trim()}
          className="w-full bg-edge-bronze text-edge-bg font-condensed font-bold text-lg uppercase tracking-widest py-4 rounded-xl disabled:opacity-40 active:scale-95 transition-transform"
        >
          {loading ? "Creating…" : "Create invite link"}
        </button>
        <p className="text-edge-muted text-xs text-center">
          The client is not emailed. Copy the link and send it when you are ready. It lasts 7 days.
        </p>
      </div>

      {link && (
        <div className="bg-edge-surface rounded-xl border border-edge-bronze/30 p-5 mt-4">
          <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-bronze mb-2">
            Link for {readyName}
          </p>
          <p className="text-white/80 text-sm font-body mb-3">
            Nothing was emailed. Send this when you want them to open Edge.
          </p>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Invite link"
            className="w-full bg-edge-bg border border-white/10 rounded-xl px-4 py-3 text-white font-body text-xs mb-3"
          />
          <button
            type="button"
            onClick={copy}
            className="bg-edge-bronze text-edge-bg font-condensed font-bold text-xs uppercase tracking-wide px-4 py-2 rounded-lg"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}
