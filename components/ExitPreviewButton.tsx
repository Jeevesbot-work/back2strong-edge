"use client";

export default function ExitPreviewButton() {
  async function exit() {
    await fetch("/api/admin/set-preview", { method: "DELETE" });
    window.location.href = "/admin";
  }
  return (
    <button onClick={exit} style={{
      fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700,
      color: "#0A0A0A", textTransform: "uppercase", letterSpacing: "0.1em",
      background: "rgba(0,0,0,0.15)", border: "none", borderRadius: 6,
      padding: "4px 10px", cursor: "pointer",
    }}>
      Exit
    </button>
  );
}
