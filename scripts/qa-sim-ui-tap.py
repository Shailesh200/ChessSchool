#!/usr/bin/env python3
"""Tap elements Maestro cannot address by label (unlabeled promotion buttons).
Reads `maestro hierarchy` JSON (no UiAutomation clash), computes a tap point, sends `adb input tap`.
  ui_tap.py --device SERIAL promo q|r|b|n     taps one of the 4 promotion buttons under the 'Promote to' title
  ui_tap.py --device SERIAL below "<anchor text>" [--nth 0]   taps the nth clickable node under the anchor text
Exit 0 tapped, 1 not found. Writes what it did to stderr.
"""
import argparse, json, re, subprocess, sys

def hierarchy(dev):
    out = subprocess.run(["maestro", "--device", dev, "hierarchy"], capture_output=True, text=True, timeout=180).stdout
    i = out.find("{")
    return json.loads(out[i:])

def walk(n, acc):
    a = n.get("attributes", {}) if isinstance(n, dict) else {}
    b = re.findall(r"-?\d+", a.get("bounds", "") or "")
    if len(b) == 4:
        l, t, r, bt = map(int, b)
        acc.append(dict(text=(a.get("text") or a.get("accessibilityText") or "").strip(), rid=a.get("resource-id", ""),
                        clickable=str(a.get("clickable", "")).lower() == "true", l=l, t=t, r=r, b=bt))
    for c in (n.get("children") or []) if isinstance(n, dict) else []: walk(c, acc)

def tap(dev, x, y):
    subprocess.run(["adb", "-s", dev, "shell", "input", "tap", str(int(x)), str(int(y))], check=True)
    print(f"ui_tap: tapped ({int(x)},{int(y)})", file=sys.stderr)

def main():
    p = argparse.ArgumentParser(); p.add_argument("--device", required=True)
    p.add_argument("mode", choices=["promo", "below"]); p.add_argument("arg"); p.add_argument("--nth", type=int, default=0)
    a = p.parse_args()
    nodes = []; walk(hierarchy(a.device), nodes)
    anchor_text = "Promote to" if a.mode == "promo" else a.arg
    anchors = [n for n in nodes if anchor_text.lower() in n["text"].lower()]
    if not anchors: print(f"ui_tap: anchor '{anchor_text}' not found", file=sys.stderr); return 1
    an = anchors[0]
    cand = [n for n in nodes if n["clickable"] and n["t"] >= an["b"] - 2 and (n["r"] - n["l"]) < 400 and n["text"] == ""
            and abs(((n["l"] + n["r"]) / 2) - ((an["l"] + an["r"]) / 2)) < 700]
    if a.mode == "promo":
        # the 4 piece buttons: same row (same top), square-ish. Order on screen is q r b n.
        rows = {}
        for n in cand: rows.setdefault(n["t"], []).append(n)
        row = next((sorted(v, key=lambda n: n["l"]) for k, v in sorted(rows.items()) if len(v) == 4), None)
        if not row: print(f"ui_tap: no 4-button row below '{anchor_text}' ({len(cand)} candidates)", file=sys.stderr); return 1
        n = row["qrbn".index(a.arg.lower())]
    else:
        cand.sort(key=lambda n: (n["t"], n["l"]))
        if len(cand) <= a.nth: print("ui_tap: not enough clickable nodes below anchor", file=sys.stderr); return 1
        n = cand[a.nth]
    tap(a.device, (n["l"] + n["r"]) / 2, (n["t"] + n["b"]) / 2); return 0

if __name__ == "__main__":
    sys.exit(main())
