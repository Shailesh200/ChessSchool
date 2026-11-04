// Copies store/system icons from the design package (app.json needs local paths).
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const raster = join(app, "..", "..", "packages/chessschool-design/assets/raster");
mkdirSync(join(app, "assets"), { recursive: true });
for (const f of ["icon.png", "adaptive-icon.png", "splash-icon.png", "favicon.png"]) copyFileSync(join(raster, f), join(app, "assets", f));
// Switchable app icons (expo-alternate-app-icons reads them from local paths).
mkdirSync(join(app, "assets/app-icons"), { recursive: true });
for (const id of ["classroom", "night", "garden", "sunset", "ocean", "midnight", "library", "pixel"]) {
  for (const suffix of ["", "-fg", "-preview"]) copyFileSync(join(raster, "app-icons", `${id}${suffix}.png`), join(app, "assets/app-icons", `${id}${suffix}.png`));
}
console.log("synced store and app icons");
