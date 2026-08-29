"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

const GOLD = "#C8965A";
const CYAN = "#5EEAD4";
const BG = "#05070A";
const TEXT = "#F2F1ED";
const MUTED = "#6B7280";
const fraunces = "Fraunces, Georgia, serif";
const inter = "Inter, sans-serif";

type Phase = "idle" | "listening" | "thinking" | "speaking" | "error";

// Minimal ambient typings for the Web Speech API — not in default TS DOM libs.
interface SpeechRecognitionResultLike {
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  results: { [index: number]: SpeechRecognitionResultLike; length: number };
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}

export default function JarvisScreen() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [level, setLevel] = useState(0); // 0..1 mic amplitude, drives the ring bars
  const [supportsVoice, setSupportsVoice] = useState(true);
  const [typedQuestion, setTypedQuestion] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(Math.min(1, avg / 90));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Mic permission denied or unavailable — visual just idles, voice still degrades to typing.
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!text || typeof window === "undefined" || !window.speechSynthesis) {
      setPhase("idle");
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02;
    utter.pitch = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find((v) => /en-GB/i.test(v.lang)) ?? voices.find((v) => /en/i.test(v.lang));
    if (enVoice) utter.voice = enVoice;
    utter.onstart = () => setPhase("speaking");
    utter.onend = () => setPhase("idle");
    utter.onerror = () => setPhase("idle");
    window.speechSynthesis.speak(utter);
  }, []);

  const ask = useCallback(
    async (question: string) => {
      if (!question.trim()) return;
      stopMeter();
      setPhase("thinking");
      setAnswer("");
      try {
        const res = await fetch("/api/admin/jarvis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Something went wrong");
        setAnswer(data.answer);
        speak(data.answer);
      } catch (e) {
        setAnswer(e instanceof Error ? e.message : "Something went wrong.");
        setPhase("error");
      }
    },
    [speak, stopMeter]
  );

  const startListening = useCallback(() => {
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSupportsVoice(false);
      return;
    }

    window.speechSynthesis?.cancel();
    setAnswer("");
    setTranscript("");
    setPhase("listening");
    startMeter();

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-GB";
    recognition.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setTranscript(text);
    };
    recognition.onerror = () => setPhase("idle");
    recognition.onend = () => {
      stopMeter();
      setTranscript((finalText) => {
        if (finalText.trim()) ask(finalText);
        else setPhase("idle");
        return finalText;
      });
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [ask, startMeter, stopMeter]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => () => {
    stopMeter();
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, [stopMeter]);

  const ringGlow = phase === "listening" ? CYAN : GOLD;
  const ringScale = phase === "listening" ? 1 + level * 0.35 : phase === "thinking" ? 1.05 : phase === "speaking" ? 1.08 : 1;
  const bars = Array.from({ length: 24 });

  return (
    <div style={{ minHeight: "100svh", background: `radial-gradient(circle at 50% 40%, #0B1016 0%, ${BG} 70%)`, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <Link href="/admin" style={{ position: "absolute", top: 18, right: 20, zIndex: 10, textDecoration: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 20, border: `1px solid rgba(255,255,255,0.12)`, background: "rgba(255,255,255,0.03)" }}>
        <span style={{ fontFamily: inter, fontSize: 11, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>Close</span>
      </Link>

      <div style={{ position: "absolute", top: 22, left: 24, zIndex: 10 }}>
        <p style={{ fontFamily: fraunces, fontSize: 14, color: TEXT, letterSpacing: "0.04em" }}>JARVIS</p>
        <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, letterSpacing: "0.2em", textTransform: "uppercase" }}>Back2Strong Ops</p>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: 36 }}>
        {/* ── Reactive ring ── */}
        <div style={{ position: "relative", width: 260, height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, transform: `scale(${ringScale})`, transition: "transform 120ms ease-out" }}>
            <div
              style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                background: `conic-gradient(from 0deg, ${ringGlow}, transparent 40%, ${ringGlow} 100%)`,
                filter: `drop-shadow(0 0 24px ${ringGlow}66)`,
                animation: phase === "thinking" ? "jarvis-spin 1.1s linear infinite" : phase === "idle" ? "jarvis-spin 10s linear infinite" : "jarvis-spin 3s linear infinite",
              }}
            />
          </div>
          <div style={{ position: "absolute", inset: 10, borderRadius: "50%", background: BG }} />

          {/* Reactive bars ring */}
          <svg width="260" height="260" style={{ position: "absolute", inset: 0 }}>
            {bars.map((_, i) => {
              const angle = (i / bars.length) * 2 * Math.PI;
              const base = 100;
              const amp = phase === "listening" ? 10 + level * 34 * (0.4 + Math.abs(Math.sin(i * 1.7 + level * 10))) : phase === "speaking" ? 10 + 16 * Math.abs(Math.sin(Date.now() / 120 + i)) : 6;
              const x1 = 130 + Math.cos(angle) * base;
              const y1 = 130 + Math.sin(angle) * base;
              const x2 = 130 + Math.cos(angle) * (base + amp);
              const y2 = 130 + Math.sin(angle) * (base + amp);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ringGlow} strokeWidth={2} strokeLinecap="round" opacity={0.75} />;
            })}
          </svg>

          <button
            onClick={phase === "listening" ? stopListening : startListening}
            disabled={phase === "thinking"}
            aria-label={phase === "listening" ? "Stop listening" : "Start listening"}
            style={{
              width: 92, height: 92, borderRadius: "50%", border: `1px solid ${ringGlow}55`,
              background: "rgba(255,255,255,0.03)", cursor: phase === "thinking" ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke={ringGlow} strokeWidth={1.6} style={{ width: 30, height: 30 }}>
              <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19 11a7 7 0 01-14 0M12 18v3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <p style={{ fontFamily: inter, fontSize: 11, color: MUTED, letterSpacing: "0.15em", textTransform: "uppercase", minHeight: 16 }}>
          {phase === "idle" && "Tap to talk"}
          {phase === "listening" && "Listening…"}
          {phase === "thinking" && "Thinking…"}
          {phase === "speaking" && "Speaking…"}
          {phase === "error" && "Something went wrong"}
        </p>

        {/* Live transcript / answer */}
        <div style={{ maxWidth: 560, width: "100%", textAlign: "center", minHeight: 90 }}>
          {transcript && phase !== "idle" && !answer && (
            <p style={{ fontFamily: inter, fontSize: 15, color: MUTED, lineHeight: 1.5 }}>&ldquo;{transcript}&rdquo;</p>
          )}
          {answer && (
            <p style={{ fontFamily: fraunces, fontSize: 20, color: TEXT, lineHeight: 1.5, fontWeight: 400 }}>{answer}</p>
          )}
        </div>

        {!supportsVoice && (
          <div style={{ display: "flex", gap: 8, maxWidth: 480, width: "100%" }}>
            <input
              value={typedQuestion}
              onChange={(e) => setTypedQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && typedQuestion.trim()) {
                  ask(typedQuestion);
                  setTypedQuestion("");
                }
              }}
              placeholder="Voice isn't supported here — type your question…"
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 10, padding: "12px 14px", fontFamily: inter, fontSize: 13, color: TEXT, outline: "none" }}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes jarvis-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
