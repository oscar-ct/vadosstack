import { ImageResponse } from "next/og";

import { APP_CONFIG } from "@/config/app-config";

export const alt = "VadosStack field service management software with built-in e-commerce tools";
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
        background: "linear-gradient(135deg, #f7f5ff 0%, #eef0ff 100%)",
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
              background: "linear-gradient(135deg, #9564f4 0%, #6877ef 100%)",
              borderRadius: 18,
              color: "#ffffff",
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
          Field Service. Commerce Ready.
        </div>
        <div style={{ color: "#514c68", fontSize: 30, lineHeight: 1.35, maxWidth: 940 }}>
          Customers, estimates, jobs, invoices, employee time, orders, inventory, and reporting in one workspace.
        </div>
      </div>
    </div>,
    size,
  );
}
