import type { MetadataRoute } from "next";
import { copy, palettes } from "@chessschool/design";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: copy.brand,
    short_name: copy.brand,
    description: copy.tagline,
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: palettes.light.bg,
    theme_color: palettes.light.brand,
    icons: [
      { src: "/assets/raster/pwa-192.png", sizes: "192x192", type: "image/png" },
      { src: "/assets/raster/pwa-512.png", sizes: "512x512", type: "image/png" },
      { src: "/assets/raster/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
