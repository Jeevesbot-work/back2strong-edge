"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MessageClientBox({ userId, clientName }: { userId: string; clientName: string }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function send() {
    if (!content.trim()) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/message-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, content }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to send");
      return;
    }
    setContent("");
    setSent(true);
    setTimeout(() => setSent(false), 4000);
    router.refresh();
  }

  return (
    <div className="bg-edge-surface rounded-xl p-4 border border-white/[0.08]">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={`Message ${clientName.split(" ")[0]} — lands in their Edge chat and pings their phone`}
        rows={3}
        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm font-body placeholder:text-white/30 focus:outline-none focus:border-edge-gold/50 resize-none"
      />
      <div className="flex items-center justify-between mt-2">
        <p className="text-edge-muted text-xs">
          {sent ? <span className="text-green-400">Sent — they get a phone notification if alerts are on</span> : error ? <span className="text-red-400">{error}</span> : "Sends a phone notification if they have alerts switched on"}
        </p>
        <button
          onClick={send}
          disabled={loading || !content.trim()}
          className="bg-edge-gold/10 border border-edge-gold/30 text-edge-gold font-condensed text-xs uppercase px-4 py-2 rounded-lg hover:bg-edge-gold/20 transition-colors disabled:opacity-40"
        >
          {loading ? "Sending..." : "Send to Edge Chat"}
        </button>
      </div>
    </div>
  );
}
