// Generate PWA raster icons from the source SVG. Run: pnpm gen:icons
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "public/icons/icon.svg");
const out = join(root, "public/icons");

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-icon-180.png", size: 180 },
  { name: "maskable-512.png", size: 512, pad: true },
];

await mkdir(out, { recursive: true });

for (const t of targets) {
  let img = sharp(src).resize(t.size, t.size);
  if (t.pad) {
    // Maskable icons need safe-zone padding (~10%).
    const inner = Math.round(t.size * 0.8);
    img = sharp(src)
      .resize(inner, inner)
      .extend({
        top: Math.round((t.size - inner) / 2),
        bottom: Math.round((t.size - inner) / 2),
        left: Math.round((t.size - inner) / 2),
        right: Math.round((t.size - inner) / 2),
        background: "#5b5bd6",
      });
  }
  await img.png().toFile(join(out, t.name));
  console.log("✓", t.name);
}
console.log("Icons generated.");
