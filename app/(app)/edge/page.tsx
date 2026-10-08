"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const SUGGESTED = [
  "My lower back is tight today — what do I do?",
  "I've missed three sessions. Am I screwed?",
  "What should I eat before training?",
  "I'm travelling this week — hotel workout?",
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export default function EdgePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadMessages(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function loadMessages() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(50);
    if (data) setMessages(data);
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setError("");
    setLoading(true);

    const tempUser: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: msg,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser]);

    try {
      const res = await fetch("/api/edge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) => prev.filter((m) => m.id !== tempUser.id));
        setInput(msg);
        setError(data.error || "Couldn't send that. Try again.");
        return;
      }
      if (!res.body) throw new Error("Failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      setStreaming(" ");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value);
        setStreaming(full);
      }

      setStreaming("");
      setMessages((prev) => [...prev, {
        id: `temp-a-${Date.now()}`,
        role: "assistant",
        content: full,
        created_at: new Date().toISOString(),
      }]);
    } catch {
      setStreaming("");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const isEmpty = messages.length === 0 && !streaming;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100svh", background: "#0E1014", maxWidth: 512, margin: "0 auto" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "16px 20px",
        borderBottom: "1px solid #252A32", flexShrink: 0,
        paddingTop: "max(env(safe-area-inset-top, 0px), 16px)"
      }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(200,150,90,0.12)", border: "1px solid rgba(200,150,90,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 16, color: "#C8965A", fontWeight: 400 }}>N</span>
        </div>
        <div>
          <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 18, color: "#F2F1ED", fontWeight: 400, lineHeight: 1 }}>Edge Coach</h1>
          <p style={{ fontSize: 10, color: "#9BA3AF", fontFamily: "Inter, sans-serif", marginTop: 2 }}>Your personal performance coach</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {isEmpty && (
          <div style={{ textAlign: "center", paddingTop: 32 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(200,150,90,0.08)", border: "1px solid rgba(200,150,90,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 28, color: "#C8965A", fontWeight: 400 }}>N</span>
            </div>
            <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 20, color: "#F2F1ED", fontWeight: 400, marginBottom: 8 }}>
              What&apos;s on your mind?
            </p>
            <p style={{ fontSize: 13, color: "#9BA3AF", fontFamily: "Inter, sans-serif", lineHeight: 1.5, maxWidth: 260, margin: "0 auto 28px" }}>
              Training, recovery, nutrition, mindset — or just tell me what&apos;s going on.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{ width: "100%", textAlign: "left", background: "#171B21", border: "1px solid #252A32", borderRadius: 14, padding: "12px 16px", color: "rgba(242,241,237,0.6)", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 10 }}>
            {m.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(200,150,90,0.1)", border: "1px solid rgba(200,150,90,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 12, color: "#C8965A" }}>N</span>
              </div>
            )}
            <div style={{
              maxWidth: "78%",
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              padding: "12px 16px",
              fontSize: 14,
              fontFamily: "Inter, sans-serif",
              lineHeight: 1.55,
              background: m.role === "user" ? "#252A32" : "#171B21",
              color: m.role === "user" ? "#F2F1ED" : "rgba(242,241,237,0.85)",
              border: m.role === "assistant" ? "1px solid #252A32" : "none",
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {streaming && (
          <div style={{ display: "flex", justifyContent: "flex-start", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(200,150,90,0.1)", border: "1px solid rgba(200,150,90,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
              <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 12, color: "#C8965A" }}>N</span>
            </div>
            <div style={{ maxWidth: "78%", borderRadius: "18px 18px 18px 4px", padding: "12px 16px", fontSize: 14, fontFamily: "Inter, sans-serif", lineHeight: 1.55, background: "#171B21", color: "rgba(242,241,237,0.85)", border: "1px solid #252A32" }}>
              {streaming === " " ? (
                <div style={{ display: "flex", gap: 4, alignItems: "center", height: 20 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="typing-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#C8965A" }} />
                  ))}
                </div>
              ) : streaming}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #252A32", background: "#0E1014", flexShrink: 0, paddingBottom: "max(env(safe-area-inset-bottom, 0px), 80px)" }}>
        {error && (
          <p style={{ fontSize: 13, color: "#F2F1ED", fontFamily: "Inter, sans-serif", lineHeight: 1.45, background: "#171B21", border: "1px solid rgba(200,150,90,0.35)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
            {error}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your coach..."
            rows={1}
            style={{ flex: 1, background: "#171B21", border: "1px solid #252A32", borderRadius: 16, padding: "12px 16px", color: "#F2F1ED", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", resize: "none", minHeight: 46, maxHeight: 120 }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            style={{ width: 46, height: 46, borderRadius: 14, background: input.trim() && !loading ? "#C8965A" : "#252A32", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "background 0.15s" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: 18, height: 18, color: input.trim() && !loading ? "#0E1014" : "#3D434D" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
