/** One-off: rasterize kit horizontal logos for React Native Image. */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "assets/kit/logo");
mkdirSync(out, { recursive: true });

const pairs = [
  ["logo-h.svg", "logo-h-light.png"],
  ["logo-h-dark.svg", "logo-h-dark.png"],
  ["logo-sym.svg", "logo-sym-light.png"],
  ["logo-sym-dark.svg", "logo-sym-dark.png"],
];

for (const [src, dest] of pairs) {
  await sharp(path.join(out, src))
    .resize({ width: 420, height: 120, fit: "inside" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, dest));
  console.log("wrote", dest);
}
