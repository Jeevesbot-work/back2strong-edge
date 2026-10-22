"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { emailTypoHint } from "@/lib/auth/email-typo";

const B = "#C8965A";
const BG = "#0E1014";
const SURFACE = "#171B21";
const BORDER = "#252A32";

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const linkExpired = searchParams.get("error") === "expired";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const hint = emailTypoHint(email);

  async function signInWithGoogle() {
    setGoogleLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Try again.");
    } else {
      setSent(true);
    }
  }

  return (
    <div style={{ minHeight: "100svh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(200,150,90,0.1)", border: "1px solid rgba(200,150,90,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 22, color: B, fontWeight: 400 }}>B</span>
          </div>
          <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 28, color: "#F2F1ED", fontWeight: 400, marginBottom: 6 }}>Back2Strong</h1>
          <p style={{ fontSize: 12, color: "#9BA3AF", fontFamily: "Inter, sans-serif" }}>Enter your email to get in</p>
        </div>

        {linkExpired && (
          <div style={{ background: "rgba(200,150,90,0.08)", border: "1px solid rgba(200,150,90,0.25)", borderRadius: 14, padding: "14px 16px", marginBottom: 24, textAlign: "center" }}>
            <p style={{ color: B, fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: 600, marginBottom: 4 }}>Your link expired</p>
            <p style={{ color: "#9BA3AF", fontSize: 12, fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>Enter your email below and we'll send a fresh one now.</p>
          </div>
        )}

        {!sent ? (
          <form onSubmit={sendLink}>
            <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase" as const, letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 8 }}>Email address</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="your@email.com"
              style={{ width: "100%", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 16px", color: "#F2F1ED", fontFamily: "Inter, sans-serif", fontSize: 16, outline: "none", marginBottom: hint ? 8 : 16, boxSizing: "border-box" as const }}
            />
            {hint && (
              <button
                type="button"
                onClick={() => setEmail(hint)}
                style={{ display: "block", width: "100%", textAlign: "left", background: "rgba(200,150,90,0.08)", border: "1px solid rgba(200,150,90,0.35)", borderRadius: 12, padding: "10px 12px", color: B, fontFamily: "Inter, sans-serif", fontSize: 13, cursor: "pointer", marginBottom: 16 }}
              >
                Did you mean {hint}?
              </button>
            )}
            {error && <p style={{ color: "#F5A623", fontSize: 13, fontFamily: "Inter, sans-serif", marginBottom: 12 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading || !email}
              style={{ width: "100%", background: !email || loading ? BORDER : B, color: !email || loading ? "#9BA3AF" : BG, fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 13, textTransform: "uppercase" as const, letterSpacing: "0.15em", padding: "15px", borderRadius: 14, border: "none", cursor: !email ? "default" : "pointer", marginBottom: 16, transition: "background 0.15s" }}
            >
              {loading ? "Sending..." : "Send magic link →"}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0 16px" }}>
              <div style={{ flex: 1, height: 1, background: BORDER }} />
              <span style={{ color: "#9BA3AF", fontSize: 11, fontFamily: "Inter, sans-serif" }}>or</span>
              <div style={{ flex: 1, height: 1, background: BORDER }} />
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={googleLoading}
              style={{ width: "100%", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "13px 16px", color: "#F2F1ED", fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16, opacity: googleLoading ? 0.6 : 1 }}
            >
              <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }} xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {googleLoading ? "Redirecting..." : "Continue with Google"}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(200,150,90,0.1)", border: "1px solid rgba(200,150,90,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#C8965A" strokeWidth={1.5} style={{ width: 28, height: 28 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 24, color: "#F2F1ED", fontWeight: 400, marginBottom: 12 }}>Check your email</p>
            <p style={{ fontSize: 14, color: "#9BA3AF", fontFamily: "Inter, sans-serif", lineHeight: 1.6, marginBottom: 8 }}>
              We sent a sign-in link to<br />
              <span style={{ color: "#F2F1ED" }}>{email}</span>
            </p>
            <p style={{ fontSize: 13, color: "#9BA3AF", fontFamily: "Inter, sans-serif", lineHeight: 1.6, marginBottom: 32 }}>
              Tap it to get in. The link is valid for <span style={{ color: "#F2F1ED" }}>2 hours</span> — if it expires, just come back here and enter your email again for a new one.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              style={{ width: "100%", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "13px", color: "#9BA3AF", fontFamily: "Inter, sans-serif", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: "0.15em", cursor: "pointer", marginBottom: 12 }}
            >
              Resend link
            </button>
            <button
              type="button"
              onClick={() => { setSent(false); setEmail(""); }}
              style={{ background: "none", border: "none", color: "#9BA3AF", fontSize: 12, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              ← Use a different email
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
