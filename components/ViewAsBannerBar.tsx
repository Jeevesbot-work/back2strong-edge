import ExitPreviewButton from "@/components/ExitPreviewButton";

/** Sticky strip shown on the client app while an admin is viewing someone. */
export default function ViewAsBannerBar({ name }: { name: string }) {
  const label = name.trim() || "Client";
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 80,
        background: "#C8965A",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700, color: "#0A0A0A", letterSpacing: "0.02em", lineHeight: 1.3 }}>
        Viewing as {label}, read-only
      </p>
      <ExitPreviewButton />
    </div>
  );
}
