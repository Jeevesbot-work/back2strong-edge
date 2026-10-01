"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewActions({ id, preview }: { id: string; preview?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    if (preview) return;
    if (action === "reject") {
      const ok = window.confirm("Reject this draft? It stays unpublished, and the same post will not be imported again.");
      if (!ok) return;
    }
    setLoading(action);
    setError(null);
    try {
      const res = await fetch("/api/admin/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not update this draft");
        setLoading(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not update this draft");
      setLoading(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => act("approve")}
          disabled={!!loading || preview}
          style={{
            flex: 1,
            background: "#34D399",
            color: "#0E1014",
            border: "none",
            borderRadius: 12,
            padding: "12px 14px",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            cursor: preview ? "default" : "pointer",
            opacity: loading || preview ? 0.6 : 1,
          }}
        >
          {loading === "approve" ? "Publishing..." : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => act("reject")}
          disabled={!!loading || preview}
          style={{
            background: "transparent",
            color: "#F2F1ED",
            border: "1px solid #252A32",
            borderRadius: 12,
            padding: "12px 14px",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: 600,
            cursor: preview ? "default" : "pointer",
            opacity: loading || preview ? 0.6 : 1,
          }}
        >
          {loading === "reject" ? "Rejecting..." : "Reject"}
        </button>
      </div>
      {preview && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#9BA3AF", margin: 0 }}>
          Preview only. Nothing is saved from this screen.
        </p>
      )}
      {error && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#F87171", margin: 0 }}>{error}</p>
      )}
    </div>
  );
}
