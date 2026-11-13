#!/usr/bin/env python3
"""Drive the app on an Android emulator by accessibility label (uiautomator).

Usage:
  adb-drive.py tap "Continue"          # tap the first element whose text/content-desc matches
  adb-drive.py type "Email" "a@b.co"   # tap a field by label, then type
  adb-drive.py has "Welcome back."     # exit 1 if not on screen
  adb-drive.py shot out.png            # screenshot
  adb-drive.py labels                  # list every labelled element on screen
"""
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET


def adb(*args, capture=True):
    return subprocess.run(["adb", *args], capture_output=capture, check=False).stdout


def nodes():
    for _ in range(3):
        adb("shell", "rm", "-f", "/sdcard/ui.xml")
        adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
        raw = adb("exec-out", "cat", "/sdcard/ui.xml")
        try:
            return list(ET.fromstring(raw).iter("node"))
        except ET.ParseError:
            time.sleep(0.5)
    return []


def label(n):
    return (n.get("content-desc") or "") or (n.get("text") or "")


def visible(n):
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", n.get("bounds")))
    return x2 > x1 and y2 > y1


def find(query, timeout=8.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        all_nodes = [n for n in nodes() if visible(n)]
        for exact in (True, False):
            for n in all_nodes:
                for v in (n.get("content-desc") or "", n.get("text") or ""):
                    if v and ((v == query) if exact else (query.lower() in v.lower())):
                        return n
        time.sleep(0.6)
    return None


def center(n):
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", n.get("bounds")))
    return (x1 + x2) // 2, (y1 + y2) // 2


def tap(query):
    # A running game clock keeps the UI busy, so accessibility dumps can be slow.
    n = find(query, timeout=20.0)
    if n is None:
        sys.exit(f"not found: {query}")
    x, y = center(n)
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(0.8)


def main():
    cmd, *args = sys.argv[1:]
    if cmd == "tap":
        tap(args[0])
    elif cmd == "type":
        deadline = time.time() + 8
        field = None
        while field is None and time.time() < deadline:
            field = next((n for n in nodes() if n.get("class") == "android.widget.EditText" and label(n) == args[0]), None)
        if field is None:
            sys.exit(f"field not found: {args[0]}")
        x, y = center(field)
        adb("shell", "input", "tap", str(x), str(y))
        time.sleep(0.6)
        text = args[1].replace(" ", "%s").replace("@", "\\@").replace("+", "\\+")
        adb("shell", "input", "text", text)
        time.sleep(0.4)
    elif cmd == "has":
        if find(args[0], timeout=float(args[1]) if len(args) > 1 else 8.0) is None:
            sys.exit(f"missing on screen: {args[0]}")
    elif cmd == "shot":
        with open(args[0], "wb") as f:
            f.write(adb("exec-out", "screencap", "-p"))
    elif cmd == "labels":
        for n in nodes():
            if label(n):
                print(f"{label(n)!r:60} {n.get('class')} {n.get('bounds')}")
    elif cmd == "tapuntil":
        # Tap A (last match, so overlays win) until B is on screen.
        for _ in range(5):
            if find(args[1], timeout=1.5) is not None:
                return
            matches = [n for n in nodes() if label(n) == args[0]]
            if matches:
                x, y = center(matches[-1])
                adb("shell", "input", "tap", str(x), str(y))
            time.sleep(1.2)
        if find(args[1], timeout=2) is None:
            sys.exit(f"never reached: {args[1]}")
    elif cmd == "devmenu":
        # Expo Go shows a one-time developer menu with its own "Continue" button (last in the tree).
        if find("This is the developer menu", timeout=4) is not None:
            matches = [n for n in nodes() if label(n) == "Continue"]
            if matches:
                x, y = center(matches[-1])
                adb("shell", "input", "tap", str(x), str(y))
                time.sleep(1)
    elif cmd == "keys":
        text = args[0].replace(" ", "%s").replace("@", "\\@").replace("+", "\\+")
        adb("shell", "input", "text", text)
        time.sleep(0.4)
    elif cmd == "enter":
        adb("shell", "input", "keyevent", "66")
        time.sleep(1)
    elif cmd == "back":
        adb("shell", "input", "keyevent", "4")
        time.sleep(0.6)
    elif cmd == "scroll":
        adb("shell", "input", "swipe", "540", "1800", "540", args[0] if args else "700", "300")
        time.sleep(0.6)
    else:
        sys.exit(f"unknown command {cmd}")


if __name__ == "__main__":
    main()
