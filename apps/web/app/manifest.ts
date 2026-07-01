import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ChessSchool — Become a stronger player",
    short_name: "ChessSchool",
    description:
      "A school-first chess academy: graduate through classes, master openings and endgames, play adaptive bots, and review every game. Offline-first PWA with accounts.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fbfaff",
    theme_color: "#5b5bd6",
    categories: ["education", "games"],
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icons/apple-icon-180.png", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      { name: "Go to campus", url: "/" },
      { name: "Play a match", url: "/play" },
      { name: "Review games", url: "/review" },
    ],
  };
}
