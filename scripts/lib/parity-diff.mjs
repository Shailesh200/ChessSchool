import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export async function loadPng(filePath) {
  const buf = fs.readFileSync(filePath);
  return PNG.sync.read(buf);
}

export async function normalizeScreenshot(filePath, width, height, outPath, { native = false } = {}) {
  let pipeline = sharp(filePath);
  if (native) {
    const meta = await pipeline.metadata();
    if (meta.width && meta.height) {
      const cropTop = Math.round(meta.height * 0.045);
      const cropHeight = Math.min(meta.height - cropTop, Math.round(meta.width * (height / width)));
      pipeline = sharp(filePath).extract({
        left: 0,
        top: cropTop,
        width: meta.width,
        height: cropHeight,
      });
    }
  }
  await pipeline.resize(width, height, { fit: "cover", position: "top" }).png().toFile(outPath);
  return outPath;
}

export async function diffScreenshots(webPath, nativePath, diffPath, { width, height, threshold = 0.08 }) {
  const webNorm = webPath.replace(/\.png$/, ".norm.png");
  const nativeNorm = nativePath.replace(/\.png$/, ".norm.png");
  await normalizeScreenshot(webPath, width, height, webNorm);
  await normalizeScreenshot(nativePath, width, height, nativeNorm, { native: true });

  const img1 = await loadPng(webNorm);
  const img2 = await loadPng(nativeNorm);
  const { width: w, height: h } = img1;
  const diff = new PNG({ width: w, height: h });

  const mismatched = pixelmatch(img1.data, img2.data, diff.data, w, h, {
    threshold: 0.15,
    includeAA: false,
  });
  const ratio = mismatched / (w * h);

  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const sideBySide = path.join(path.dirname(diffPath), `parity-${path.basename(diffPath, "-diff.png")}.png`);
  const webBuf = await sharp(webNorm).resize({ height: h }).toBuffer();
  const nativeBuf = await sharp(nativeNorm).resize({ height: h }).toBuffer();
  const webW = (await sharp(webBuf).metadata()).width ?? w;
  const nativeW = (await sharp(nativeBuf).metadata()).width ?? w;
  const gap = 24;
  await sharp({
    create: { width: webW + nativeW + gap, height: h, channels: 4, background: "#cbd5e1" },
  })
    .composite([
      { input: webBuf, left: 0, top: 0 },
      { input: nativeBuf, left: webW + gap, top: 0 },
    ])
    .png()
    .toFile(sideBySide);

  return {
    mismatchedPixels: mismatched,
    totalPixels: w * h,
    ratio,
    pass: ratio <= threshold,
    diffPath,
    sideBySidePath: sideBySide,
    webNorm,
    nativeNorm,
  };
}

export function sampleTokens(pngPath, points) {
  const img = PNG.sync.read(fs.readFileSync(pngPath));
  return points.map(({ x, y, label }) => {
    const px = Math.min(img.width - 1, Math.max(0, x));
    const py = Math.min(img.height - 1, Math.max(0, y));
    const i = (img.width * py + px) << 2;
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];
    return { label, hex: `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}` };
  });
}
