"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const cond = "'Barlow Condensed', 'Arial Narrow', sans-serif";

// Landing page for a client's 7-day sign-in link. Nothing happens until they
// tap, so WhatsApp / iMessage link previews can't use anything up.
export default function WelcomePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "expired" | "error">("idle");

  async function signIn() {
    setState("busy");
    const res = await fetch("/api/invite/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: params.token }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token_hash) { setState(res.status === 410 ? "expired" : "error"); return; }
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: data.type });
    if (error) { setState("error"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("approved, full_name").eq("id", user?.id ?? "").single();
    if (!profile?.full_name) router.replace("/onboarding");
    else if (!profile?.approved) router.replace("/pending");
    else router.replace("/home");
  }

  const msg = state === "expired"
    ? "This link has run out. Message Nick and he'll send you a fresh one."
    : state === "error" ? "Something went wrong. Tap to try again, or message Nick." : "Tap below to sign in to your app.";

  return (
    <div style={{ minHeight: "100svh", background: "#0E1014", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 24, textAlign: "center" }}>
      <p style={{ fontFamily: cond, fontWeight: 600, fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "#C8965A", margin: 0 }}>Back2Strong · Edge</p>
      <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 400, fontSize: 34, lineHeight: 1.1, color: "#F2F1ED", margin: 0 }}>Welcome in.</h1>
      <p style={{ fontSize: 15, color: "#9BA3AF", maxWidth: 300, margin: 0 }}>{msg}</p>
      {state !== "expired" && (
        <button onClick={signIn} disabled={state === "busy"}
          style={{ marginTop: 8, width: "100%", maxWidth: 320, padding: "16px 0", borderRadius: 99, border: "none", background: "#C8965A", color: "#0E1014",
            fontFamily: cond, fontWeight: 700, fontSize: 18, letterSpacing: "0.12em", textTransform: "uppercase", opacity: state === "busy" ? 0.6 : 1 }}>
          {state === "busy" ? "Signing in..." : "Sign in to Edge"}
        </button>
      )}
    </div>
  );
}
