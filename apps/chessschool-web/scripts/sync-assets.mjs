// Copies shared design assets into public/assets (served at /assets/...).
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(app, "..", "..", "packages/chessschool-design/assets");
const out = join(app, "public/assets");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const dir of ["lottie", "sound", "svg", "raster"]) cpSync(join(src, dir), join(out, dir), { recursive: true });
// Optional piece artwork from @chessschool/chess. The shipped sets are vectors, so this dir may be absent.
const pieces = join(app, "..", "..", "packages/chessschool-chess/assets/pieces");
if (existsSync(pieces)) cpSync(pieces, join(out, "pieces"), { recursive: true });
