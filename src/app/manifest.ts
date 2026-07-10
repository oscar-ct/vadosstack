import type { MetadataRoute } from "next";

import { APP_CONFIG } from "@/config/app-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_CONFIG.name,
    short_name: APP_CONFIG.name,
    description: APP_CONFIG.meta.description,
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5ff",
    theme_color: "#6f78f7",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
