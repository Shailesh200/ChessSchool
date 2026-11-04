// Shared helpers for hand-authored Lottie (bodymovin 5.7) + SVG output.
// Shapes are described once in comp coordinates; layers use anchor = position = pivot,
// so a child's coordinates stay in comp space at rest.

/* ---------------- geometry helpers ---------------- */
export function smooth(points, { closed = true, corners = [], k = 1 / 6 } = {}) {
  const n = points.length;
  const v = [];
  const ins = [];
  const outs = [];
  for (let idx = 0; idx < n; idx++) {
    const p = points[idx];
    const prev = points[closed ? (idx - 1 + n) % n : Math.max(idx - 1, 0)];
    const next = points[closed ? (idx + 1) % n : Math.min(idx + 1, n - 1)];
    const corner = corners.includes(idx) || (!closed && (idx === 0 || idx === n - 1));
    const d = corner ? [0, 0] : [(next[0] - prev[0]) * k, (next[1] - prev[1]) * k];
    v.push(p);
    outs.push(d);
    ins.push([-d[0], -d[1]]);
  }
  return { v, i: ins, o: outs, c: closed };
}
export const poly = (points, closed = true) => smooth(points, { closed, corners: points.map((_, i) => i) });
export const off = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);

export const lin = (x1, y1, x2, y2, stops) => ({ linear: [x1, y1, x2, y2], stops });
export const rad = (cx, cy, r, stops) => ({ radial: [cx, cy, r], stops });

export const ellipse = (cx, cy, w, h, fill, extra = {}) => ({ type: "ellipse", cx, cy, w, h, fill, ...extra });
export const rect = (cx, cy, w, h, r, fill, extra = {}) => ({ type: "rect", cx, cy, w, h, r, fill, ...extra });
export const path = (p, fill, extra = {}) => ({ type: "path", p, fill, ...extra });
export const strokePath = (p, color, w, extra = {}) => ({ type: "path", p, stroke: { color, w }, ...extra });

export function sparkle(cx, cy, R, r = R * 0.28) {
  const pts = [];
  for (let k = 0; k < 8; k++) {
    const ang = (Math.PI / 4) * k - Math.PI / 2;
    const rr = k % 2 === 0 ? R : r;
    pts.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]);
  }
  return poly(pts);
}
export function heartShapes(cx, cy, s, color, extra = {}) {
  return [
    ellipse(cx - 0.3 * s, cy - 0.18 * s, 0.66 * s, 0.66 * s, color, extra),
    ellipse(cx + 0.3 * s, cy - 0.18 * s, 0.66 * s, 0.66 * s, color, extra),
    path(poly([[cx - 0.62 * s, cy - 0.06 * s], [cx + 0.62 * s, cy - 0.06 * s], [cx, cy + 0.62 * s]]), color, extra),
  ];
}
export function drop(cx, cy, s) {
  return smooth(
    [
      [cx, cy - 1.4 * s],
      [cx + 0.9 * s, cy + 0.2 * s],
      [cx, cy + 1.2 * s],
      [cx - 0.9 * s, cy + 0.2 * s],
    ],
    { corners: [0] },
  );
}

export const E = {
  inOut: [0.45, 0, 0.55, 1],
  out: [0.22, 1, 0.36, 1],
  in: [0.5, 0, 0.75, 0],
  linear: [0, 0, 1, 1],
  back: [0.34, 1.56, 0.64, 1],
};
// track keyframe: [frame, value, ease?]  ease: key of E or "hold"
// One cycle of evenly spaced values (first === last), repeated across `total` frames.
export const loop = (period, total, vals, ease = "inOut") => {
  const out = [];
  const step = period / (vals.length - 1);
  for (let c = 0; c * period < total; c++) {
    for (let j = 0; j < vals.length - 1; j++) out.push([Math.round(c * period + j * step), vals[j], ease]);
  }
  out.push([total, vals[vals.length - 1]]);
  return out;
};
/* ---------------- Lottie emitter ---------------- */
export const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((x) => +x.toFixed(4));
};
export const st = (k) => ({ a: 0, k });

export function lottiePaint(paint, op = 100) {
  if (typeof paint === "string") return { ty: "fl", c: st([...hex(paint), 1]), o: st(op), r: 1, bm: 0 };
  const flat = paint.stops.flatMap(([t, c]) => [t, ...hex(c)]);
  const g = { p: paint.stops.length, k: st(flat) };
  if (paint.linear) {
    const [x1, y1, x2, y2] = paint.linear;
    return { ty: "gf", o: st(op), r: 1, bm: 0, g, s: st([x1, y1]), e: st([x2, y2]), t: 1 };
  }
  const [cx, cy, r] = paint.radial;
  return { ty: "gf", o: st(op), r: 1, bm: 0, g, s: st([cx, cy]), e: st([cx + r, cy]), t: 2, h: st(0), a: st(0) };
}

export function lottieShape(sh, idx) {
  const items = [];
  if (sh.type === "ellipse") items.push({ ty: "el", d: 1, p: st([sh.cx, sh.cy]), s: st([sh.w, sh.h]) });
  if (sh.type === "rect") items.push({ ty: "rc", d: 1, p: st([sh.cx, sh.cy]), s: st([sh.w, sh.h]), r: st(sh.r) });
  if (sh.type === "path") items.push({ ty: "sh", d: 1, ks: st(sh.p) });
  if (sh.stroke) items.push({ ty: "st", c: st([...hex(sh.stroke.color), 1]), o: st(sh.op ?? 100), w: st(sh.stroke.w), lc: 2, lj: 2, ml: 4, bm: 0 });
  if (sh.fill) items.push(lottiePaint(sh.fill, sh.op ?? 100));
  const center = sh.type === "path" ? [0, 0] : [sh.cx, sh.cy];
  items.push({ ty: "tr", p: st(center), a: st(center), s: st([100, 100]), r: st(sh.rot ?? 0), o: st(100), sk: st(0), sa: st(0) });
  return { ty: "gr", nm: `s${idx}`, it: items };
}

export function prop(track, base, toValue) {
  if (!track) return st(toValue(base));
  const kfs = track.map(([t, v, ease], i) => {
    const val = toValue(v);
    const kf = { t, s: Array.isArray(val) ? val : [val] };
    if (i < track.length - 1) {
      if (ease === "hold") kf.h = 1;
      else {
        const [x1, y1, x2, y2] = E[ease ?? "inOut"];
        kf.o = { x: [x1], y: [y1] };
        kf.i = { x: [x2], y: [y2] };
      }
    }
    return kf;
  });
  return { a: 1, k: kfs };
}


/** Builds a Lottie document from layers (listed bottom -> top) and per-layer tracks. */
export function compose({ name, w = 512, h = 512, fps = 60, frames, layers, tracks = {} }) {
  const index = new Map(layers.map((l, i) => [l.name, i + 1]));
  const out = layers
    .map((l) => {
      const tr = tracks[l.name] ?? {};
      const [px, py] = l.pivot;
      const ks = {
        o: prop(tr.o, l.restO ?? 100, (v) => v),
        r: prop(tr.r, l.restR ?? 0, (v) => v),
        p: prop(tr.p, [0, 0], ([dx, dy]) => [px + dx, py + dy, 0]),
        a: st([px, py, 0]),
        s: prop(tr.s, l.restS ?? [100, 100], ([x, y]) => [x, y, 100]),
      };
      const layer = { ddd: 0, ind: index.get(l.name), ty: l.null ? 3 : 4, nm: l.name, sr: 1, ks, ao: 0, ip: 0, op: frames, st: 0, bm: 0 };
      if (l.parent) layer.parent = index.get(l.parent);
      if (!l.null) layer.shapes = [...l.shapes].reverse().map(lottieShape);
      return layer;
    })
    .reverse();
  return { v: "5.7.4", fr: fps, ip: 0, op: frames, w, h, nm: name, ddd: 0, assets: [], layers: out };
}
