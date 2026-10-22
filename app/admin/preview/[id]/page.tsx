"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function StartPreview() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/set-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    }).then(async (res) => {
      if (!res.ok) {
        router.push("/admin");
        return;
      }
      router.push("/home");
    });
  }, [id, router]);

  return (
    <div style={{ minHeight: "100vh", background: "#0E1014", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ fontFamily: "Inter, sans-serif", color: "#9BA3AF", fontSize: 13 }}>Loading preview...</p>
    </div>
  );
}
