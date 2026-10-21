"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface ReplyDraftView {
  id: string;
  userId: string;
  clientName: string;
  clientMessage: string | null;
  content: string;
  createdAt: string;
}

export interface OpenClientView {
  messageId: string;
  userId: string;
  name: string;
  content: string;
  ageLabel: string;
  overdue: boolean;
  href: string;
}

function DraftCard({ draft }: { draft: ReplyDraftView }) {
  const router = useRouter();
  const [content, setContent] = useState(draft.content);
  const [loading, setLoading] = useState<"approve" | "discard" | null>(null);
  const [error, setError] = useState("");
  const [gone, setGone] = useState(false);

  async function act(action: "approve" | "discard") {
    setLoading(action);
    setError("");
    const res = await fetch("/api/admin/reply-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: draft.id, action, content }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't update that draft");
      return;
    }
    setGone(true);
    router.refresh();
  }

  if (gone) return null;

  return (
    <div className="bg-edge-surface rounded-xl p-4 border border-edge-gold/30">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="font-condensed text-xs uppercase tracking-widest text-edge-gold">
          Draft for {draft.clientName}
        </p>
        <Link href={`/admin/users/${draft.userId}`} className="text-edge-bronze text-xs font-body">
          Open
        </Link>
      </div>
      {draft.clientMessage && (
        <p className="text-white/70 text-sm font-body leading-relaxed mb-3">
          <span className="text-edge-muted text-xs uppercase tracking-widest font-condensed mr-2">Client</span>
          {draft.clientMessage}
        </p>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm font-body placeholder:text-white/30 focus:outline-none focus:border-edge-gold/50 resize-none"
      />
      <div className="flex items-center justify-between gap-3 mt-2">
        <p className="text-xs font-body text-red-400 min-h-[1em]">{error}</p>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => act("discard")}
            disabled={loading !== null}
            className="border border-white/15 text-white/70 font-condensed text-xs uppercase px-3 py-2 rounded-lg disabled:opacity-40"
          >
            {loading === "discard" ? "Discarding..." : "Discard"}
          </button>
          <button
            type="button"
            onClick={() => act("approve")}
            disabled={loading !== null || !content.trim()}
            className="bg-edge-gold/10 border border-edge-gold/30 text-edge-gold font-condensed text-xs uppercase px-3 py-2 rounded-lg disabled:opacity-40"
          >
            {loading === "approve" ? "Sending..." : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReplyDraftList({ drafts }: { drafts: ReplyDraftView[] }) {
  if (drafts.length === 0) return null;
  return (
    <div className="space-y-3">
      {drafts.map((draft) => (
        <DraftCard key={draft.id} draft={draft} />
      ))}
    </div>
  );
}

export function UnansweredList({ items }: { items: OpenClientView[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Link key={item.messageId} href={item.href} className="block">
          <div className={`rounded-xl p-3 border ${item.overdue ? "border-red-400/40 bg-red-400/10" : "border-edge-gold/30 bg-edge-gold/10"}`}>
            <p className={`font-condensed text-xs uppercase tracking-widest mb-1 ${item.overdue ? "text-red-300" : "text-edge-gold"}`}>
              {item.overdue ? `Unanswered ${item.ageLabel}` : `No reply yet · ${item.ageLabel}`} · {item.name}
            </p>
            <p className="text-white/80 text-sm font-body leading-relaxed">{item.content}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
