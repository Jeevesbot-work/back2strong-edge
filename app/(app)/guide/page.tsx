import { createClient } from "@/lib/supabase/server";
import { getClientProgramme } from "@/lib/data/programme-loader";
import Link from "next/link";

const SECTIONS = [
  {
    nav: "Today",
    href: "/home",
    title: "Your daily dashboard.",
    description:
      "Every morning, open Today first. It shows your readiness score from last night's check-in, what session is up next, and your lesson for the day. It's your 30-second brief before you do anything.",
    steps: [
      "Log your daily check-in (takes 60 seconds) — sleep, energy, stress, soreness, motivation",
      "Check your readiness score — it tells you how hard to push today",
      "See what session is next — tap it to start",
    ],
    accent: "#C8965A",
  },
  {
    nav: "Train",
    href: "/train",
    title: "Your programme.",
    description:
      "This is where your programme lives. Every session is written out — exercises, sets, reps, rest, and coaching cues for each movement. Tap a session to open it, log your sets as you go, and mark it done when you finish.",
    steps: [
      "Your week's sessions are laid out as cards — built for you",
      "Tap any session card to open it — all exercises are written out with cues",
      "Log sets as you complete them — tap each set to mark it done",
      "When you finish, hit 'Session complete' — it logs the time and tracks your progress",
    ],
    accent: "#C8965A",
  },
  {
    nav: "Mind",
    href: "/mind",
    title: "One lesson a day.",
    description:
      "Every day there's a short lesson — 5 to 8 minutes. These aren't motivational quotes. They're direct, practical ideas on identity, stress, performance, and what actually changes men at 40+. Read one a day. Don't skip it.",
    steps: [
      "One new lesson each day — opens automatically on your dashboard",
      "Takes 5–8 minutes to read",
      "Covers the 7 pillars: Identity, Stress, Strength, Nutrition, Hormones, Purpose, Brotherhood",
      "You can revisit any lesson at any time from the Mind tab",
    ],
    accent: "rgba(200,150,90,0.7)",
  },
  {
    nav: "Coach",
    href: "/edge",
    title: "Ask Edge anything.",
    description:
      "The Coach tab connects you directly to Edge — an AI trained on your programme, your data, and the Back2Strong method. Ask about exercise form, nutrition, how you're progressing, or anything else. It knows your programme.",
    steps: [
      "Ask about your programme — 'what does RPE 7 mean for me this week?'",
      "Ask about form — 'my lower back feels it on RDLs, what am I doing wrong?'",
      "Ask about nutrition — 'I missed lunch because of my meds, what should I do?'",
      "Nick reviews your progress — notes from him also appear on your dashboard",
    ],
    accent: "#C8965A",
  },
  {
    nav: "Fuel",
    href: "/nutrition",
    title: "Track your nutrition.",
    description:
      "The Fuel tab is where you log meals and track protein. Nutrition is the lever that either makes or breaks this programme. Hit your protein target every day — everything else follows.",
    steps: [
      "Your protein and calorie targets are set for you — hit protein first",
      "Log meals to track how close you're getting — snap a photo and Edge estimates it",
      "If your appetite is low, top up with a protein shake",
      "Eat on a schedule — don't wait for hunger signals",
    ],
    accent: "#C8965A",
  },
  {
    nav: "Today",
    href: "/home",
    title: "Close the day. Wake up to a plan.",
    description:
      "Before bed, tap Close the day on your Today screen and talk it all out — jobs for tomorrow, how today went, anything on your mind. Then switch off. In the morning there's a report waiting with your to-do list, your first move, and a practical fix for whatever was bugging you.",
    steps: [
      "Tap Close the day on Today, hit the mic and just talk — no need to tidy it up",
      "Tap Done — switch off. Edge sorts it while you sleep",
      "Next morning, your Morning report is on Today — tick off the list as you go",
      "Bad nights? Open Broken Sleep Survival at the bottom of Today",
    ],
    accent: "#C8965A",
  },
];

export default async function GuidePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user!.id).single();
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const clientProgramme = await getClientProgramme(user!.id);
  const prog = clientProgramme?.programme ?? null;

  return (
    <div className="max-w-lg mx-auto pb-28" style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 16px)" }}>

      {/* Header */}
      <div className="px-5" style={{ paddingTop: 8, paddingBottom: 28 }}>
        <Link href="/home" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", marginBottom: 24 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 16, height: 16, color: "#9BA3AF" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span style={{ fontSize: 12, color: "#9BA3AF", fontFamily: "Inter, sans-serif" }}>Back</span>
        </Link>

        <p style={{ fontSize: 9, color: "#C8965A", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 8 }}>
          Your guide
        </p>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 38, fontWeight: 400, color: "#F2F1ED", lineHeight: 1.05, marginBottom: 14 }}>
          How Edge works, {firstName}.
        </h1>
        <p style={{ fontSize: 14, color: "rgba(242,241,237,0.55)", fontFamily: "Inter, sans-serif", lineHeight: 1.65 }}>
          Five minutes to read this. You won&apos;t need to read it again.
        </p>
      </div>

      {/* Programme banner */}
      {prog && (
      <div className="px-5 mb-6">
        <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid rgba(200,150,90,0.25)", padding: "20px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2.5, background: "#C8965A" }} />
          <div style={{ paddingLeft: 14 }}>
            <p style={{ fontSize: 9, color: "#C8965A", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 6 }}>
              Your programme
            </p>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 22, fontWeight: 400, color: "#F2F1ED", lineHeight: 1.2, marginBottom: 6 }}>
              {prog.title}
            </h2>
            <p style={{ fontSize: 12, color: "rgba(242,241,237,0.55)", fontFamily: "Inter, sans-serif", marginBottom: 14, lineHeight: 1.5 }}>
              {prog.summary}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {prog.progression.map((w) => (
                <div key={w.week} style={{ flex: 1, background: "#252A32", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                  <p style={{ fontSize: 8, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "Inter, sans-serif", marginBottom: 3 }}>Wk {w.week}</p>
                  <p style={{ fontSize: 10, color: "#C8965A", fontFamily: "Inter, sans-serif", fontWeight: 600 }}>{w.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* What to do each day */}
      <div className="px-5 mb-6">
        <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 14 }}>
          Your daily routine
        </p>
        <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", overflow: "hidden" }}>
          {[
            { time: "Morning", action: "Open the app. Log your check-in. 60 seconds." },
            { time: "Training days", action: "Go to Train. Open your session. Log every set." },
            { time: "Cardio days", action: "Your cardio for the day — check the Train tab for today's distance or duration." },
            { time: "Any time", action: "Read your daily Mind lesson. 5–8 minutes." },
            { time: "End of day", action: "Log your food in Fuel. Hit your protein target." },
            { time: "Sunday", action: "Weekly check-in. 5 minutes. Honest review." },
          ].map(({ time, action }, i, arr) => (
            <div
              key={time}
              style={{
                display: "flex", gap: 14, padding: "14px 20px",
                borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}
            >
              <div style={{ minWidth: 80, paddingTop: 1 }}>
                <p style={{ fontSize: 9, color: "#C8965A", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "Inter, sans-serif", fontWeight: 600 }}>{time}</p>
              </div>
              <p style={{ fontSize: 13, color: "rgba(242,241,237,0.7)", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>{action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Each section explained */}
      <div className="px-5 space-y-4 mb-6">
        <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 2 }}>
          The five tabs
        </p>
        {SECTIONS.map((section) => (
          <Link key={section.nav} href={section.href} style={{ textDecoration: "none", display: "block" }}>
            <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: "20px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2.5, background: section.accent, borderRadius: "20px 0 0 20px" }} />
              <div style={{ paddingLeft: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.18em", fontFamily: "Inter, sans-serif" }}>
                    {section.nav}
                  </p>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 14, height: 14, color: "#3D434D" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <h3 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 20, fontWeight: 400, color: "#F2F1ED", lineHeight: 1.2, marginBottom: 8 }}>
                  {section.title}
                </h3>
                <p style={{ fontSize: 13, color: "rgba(242,241,237,0.55)", fontFamily: "Inter, sans-serif", lineHeight: 1.6, marginBottom: 14 }}>
                  {section.description}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {section.steps.map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 10, color: "#C8965A", fontFamily: "Inter, sans-serif", fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{i + 1}.</span>
                      <p style={{ fontSize: 12, color: "rgba(242,241,237,0.5)", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Considerations specific to this client */}
      {prog && prog.considerations.length > 0 && (
      <div className="px-5 mb-6">
        <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 14 }}>
          Built around you
        </p>
        <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: "20px" }}>
          <p style={{ fontSize: 13, color: "rgba(242,241,237,0.55)", fontFamily: "Inter, sans-serif", lineHeight: 1.6, marginBottom: 14 }}>
            Your programme takes things into account that most generic plans ignore:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {prog.considerations.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#252A32", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#C8965A", flexShrink: 0, marginTop: 6 }} />
                <p style={{ fontSize: 13, color: "rgba(242,241,237,0.7)", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>{c}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "rgba(242,241,237,0.35)", fontFamily: "Inter, sans-serif", lineHeight: 1.6, marginTop: 14 }}>
            Everything in the programme — the nutrition tactics, the cardio timing, the check-in fields — is written with these in mind.
          </p>
        </div>
      </div>
      )}

      {/* Save to home screen */}
      <div className="px-5 mb-6">
        <p style={{ fontSize: 9, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 14 }}>
          Save it to your phone
        </p>
        <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: "20px" }}>
          <p style={{ fontSize: 13, color: "rgba(242,241,237,0.6)", fontFamily: "Inter, sans-serif", lineHeight: 1.6, marginBottom: 14 }}>
            Add Edge to your home screen so it opens like a normal app — one tap, no browser, no login each time.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              "Open this page in Safari (iPhone) or Chrome (Android)",
              "Tap the Share button — the square with an arrow pointing up",
              "Scroll down and tap “Add to Home Screen”",
              "Tap “Add” — the Edge icon now sits on your home screen",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 10, color: "#C8965A", fontFamily: "Inter, sans-serif", fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{i + 1}.</span>
                <p style={{ fontSize: 13, color: "rgba(242,241,237,0.75)", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="px-5">
        <div style={{ background: "#171B21", borderRadius: 20, border: "1px solid rgba(200,150,90,0.2)", padding: "24px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 22, fontWeight: 400, color: "#F2F1ED", lineHeight: 1.3, marginBottom: 10 }}>
            That&apos;s everything you need to know.
          </p>
          <p style={{ fontSize: 13, color: "rgba(242,241,237,0.45)", fontFamily: "Inter, sans-serif", marginBottom: 20, lineHeight: 1.5 }}>
            Don&apos;t overthink it. Log your check-in, train your sessions, eat your protein. Ask Coach if you&apos;re unsure about anything.
          </p>
          <Link href="/train" style={{ display: "block", textDecoration: "none" }}>
            <div style={{ background: "#C8965A", borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#0E1014", fontFamily: "Inter, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>
                Go to my programme
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: 14, height: 14, color: "#0E1014" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </Link>
        </div>
      </div>

    </div>
  );
}
