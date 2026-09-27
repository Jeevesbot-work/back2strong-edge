"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Signing you in...");
  // Links with a token_hash wait for a real tap. Link previews (WhatsApp,
  // iMessage) open the page to build a thumbnail and would otherwise burn the
  // one-time token before the client ever sees it.
  const [tapToken, setTapToken] = useState<{ token_hash: string; type: "email" | "signup" | "magiclink" } | null>(null);
  const [busy, setBusy] = useState(false);

  async function afterAuth() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("approved, full_name").eq("id", user.id).single();
    if (!profile?.full_name) router.replace("/onboarding");
    else if (!profile?.approved) router.replace("/pending");
    else router.replace("/home");
  }

  async function signInWithToken() {
    if (!tapToken || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp(tapToken);
    if (error) {
      setTapToken(null);
      setStatus("This sign-in link has already been used or has expired. Message Nick for a fresh one.");
      return;
    }
    setTapToken(null);
    setStatus("Signing you in...");
    await afterAuth();
  }

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient();

      // --- Implicit flow: access_token in hash ---
      const hash = window.location.hash.slice(1);
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) {
          setStatus("setSession error: " + error.message);
          return;
        }
      } else {
        // --- PKCE flow: code in query params ---
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus("Link expired. Sending you back...");
            setTimeout(() => router.replace("/login?error=expired"), 1500);
            return;
          }
        } else {
          // --- token_hash in query params (email OTP) ---
          const token_hash = new URLSearchParams(window.location.search).get("token_hash");
          const type = new URLSearchParams(window.location.search).get("type") as "email" | "signup" | "magiclink" | null;
          if (token_hash && type) {
            // Already signed in on this device? Skip the tap.
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              setTapToken({ token_hash, type });
              return;
            }
          } else {
            // No token found at all — check if session already exists
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              setStatus("Link expired. Sending you back...");
              setTimeout(() => router.replace("/login?error=expired"), 1500);
              return;
            }
          }
        }
      }

      await afterAuth();
    }

    handleCallback();
  }, [router]);

  if (tapToken) {
    return (
      <div style={{ minHeight: "100svh", background: "#0E1014", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 24, textAlign: "center" }}>
        <p style={{ fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif", fontWeight: 600, fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "#C8965A" }}>Back2Strong · Edge</p>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 400, fontSize: 32, lineHeight: 1.1, color: "#F2F1ED", margin: 0 }}>Welcome in.</h1>
        <p style={{ fontSize: 15, color: "#9BA3AF", maxWidth: 300, margin: 0 }}>Tap below to sign in to your app.</p>
        <button onClick={signInWithToken} disabled={busy}
          style={{ marginTop: 8, width: "100%", maxWidth: 320, padding: "16px 0", borderRadius: 99, border: "none", background: "#C8965A", color: "#0E1014",
            fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "0.12em", textTransform: "uppercase", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Signing in..." : "Sign in to Edge"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100svh", background: "#0E1014", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ width: 36, height: 36, border: "2px solid #C8965A", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 18, color: "#F2F1ED" }}>{status}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
