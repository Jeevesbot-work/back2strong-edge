"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApproveAll({ count, preview }: { count: number; preview?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (count <= 0) return null;

  async function approve() {
    if (preview) return;
    if (!window.confirm(`Approve ${count} clean pass${count === 1 ? "" : "es"}? Flagged drafts stay for review.`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_clean" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not approve the clean passes");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not approve the clean passes");
      setLoading(false);
    }
  }

  return (
    <div style={{ margin: "0 0 16px" }}>
      <button
        type="button"
        onClick={approve}
        disabled={loading || preview}
        style={{
          width: "100%",
          minHeight: 48,
          background: "#C8965A",
          color: "#0E1014",
          border: "none",
          borderRadius: 12,
          fontFamily: "Inter, sans-serif",
          fontSize: 16,
          fontWeight: 700,
          cursor: preview ? "default" : "pointer",
          opacity: loading || preview ? 0.6 : 1,
        }}
      >
        {loading ? "Publishing..." : `Approve all clean passes (${count})`}
      </button>
      {error && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#F87171" }}>{error}</p>}
    </div>
  );
}
