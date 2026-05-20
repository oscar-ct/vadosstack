import { ImageResponse } from "next/og";

import { APP_CONFIG } from "@/config/app-config";

export const alt = "VadosStack management software for service businesses";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#f6f1e8",
        color: "#171412",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: 72,
        width: "100%",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 36, width: "100%" }}>
        <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
          <div
            style={{
              alignItems: "center",
              background: "#171412",
              borderRadius: 18,
              color: "#f6f1e8",
              display: "flex",
              fontSize: 38,
              height: 72,
              justifyContent: "center",
              width: 72,
            }}
          >
            V
          </div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>{APP_CONFIG.name}</div>
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: 0, lineHeight: 0.96, maxWidth: 900 }}>
          Management software for service businesses.
        </div>
        <div style={{ color: "#594431", fontSize: 30, lineHeight: 1.35, maxWidth: 940 }}>
          Customers, jobs, estimates, invoices, services, and employee time tracking in one polished workspace.
        </div>
      </div>
    </div>,
    size,
  );
}
