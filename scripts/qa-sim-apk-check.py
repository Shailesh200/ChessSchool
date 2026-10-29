#!/usr/bin/env python3
"""DRAFT. qa-sim APK pre-flight: decode the APK's compiled manifest and network security config (no SDK tool needed).
usage: qa-sim-apk-check.py APK REPORT_PREFIX     -> writes REPORT_PREFIX.txt and REPORT_PREFIX.json, prints RESULT= and REASON= lines
RESULT:  PASS        manifest has android:networkSecurityConfig, no usesCleartextTraffic=true, and every network-security-config XML in the
                     APK allows cleartext ONLY for the domains 10.0.2.2 and localhost (both present, includeSubdomains off), has no
                     base-config cleartextTrafficPermitted=true, no <debug-overrides>, and no <certificates> other than src="system".
         MISSING     no android:networkSecurityConfig on <application>   -> reason 'APK lacks qa-sim network security config (cleartext blocked)'
         BAD         the config exists but breaks the policy above (reason says which rule)
         UNREADABLE  the APK / manifest / config could not be decoded (unproven = not trusted)
Exit 0 only on PASS. Optional cross-check: if apkanalyzer/aapt2 exist, their manifest output is logged (not used to decide)."""
import json, os, struct, subprocess, sys, zipfile

ALLOWED = {"10.0.2.2", "localhost"}
MISSING_REASON = "APK lacks qa-sim network security config (cleartext blocked)"


class Axml:
    """Minimal Android binary-XML decoder: elements with attributes (local names) and text."""
    def __init__(self, data):
        t, hs, size = struct.unpack_from("<HHI", data, 0)
        if t != 0x0003: raise ValueError("not binary XML")
        self.d = data; self.strings = []; self.root = None
        pos = hs; stack = []
        while pos < min(size, len(data)):
            ct, chs, csz = struct.unpack_from("<HHI", data, pos)
            if csz < 8: raise ValueError("bad chunk")
            if ct == 0x0001: self._pool(pos)
            elif ct == 0x0102:
                ns, name, _as, _asz, cnt = struct.unpack_from("<iiHHH", data, pos + 16)
                attrs = {}
                base = pos + 16 + 20
                for i in range(cnt):
                    ans, an, raw, _sz, _r, dt, dv = struct.unpack_from("<iiiHBBI", data, base + i * 20)
                    attrs[self.s(an)] = self._val(raw, dt, dv)
                el = {"tag": self.s(name), "attrs": attrs, "kids": [], "text": ""}
                if stack: stack[-1]["kids"].append(el)
                else: self.root = el
                stack.append(el)
            elif ct == 0x0103:
                if stack: stack.pop()
            elif ct == 0x0104 and stack:
                (idx,) = struct.unpack_from("<i", data, pos + 16)
                if idx >= 0: stack[-1]["text"] += self.s(idx)
            pos += csz

    def s(self, i):
        return self.strings[i] if 0 <= i < len(self.strings) else ""

    def _val(self, raw, dt, dv):
        if dt == 0x03: return self.s(raw if raw >= 0 else dv)        # string
        if dt == 0x12: return "true" if dv != 0 else "false"          # boolean
        if dt == 0x01: return "@0x%08x" % dv                          # reference
        if dt == 0x10: return str(struct.unpack("<i", struct.pack("<I", dv))[0])
        return "0x%x" % dv

    def _pool(self, pos):
        d = self.d
        cnt, _sty, flags, sstart, _ss = struct.unpack_from("<IIIII", d, pos + 8)
        offs = struct.unpack_from("<%dI" % cnt, d, pos + 28)
        utf8 = bool(flags & 0x100)
        for o in offs:
            p = pos + sstart + o
            if utf8:
                l = d[p]; p += 1 + (1 if l & 0x80 else 0)
                bl = d[p]; p += 1
                if bl & 0x80: bl = ((bl & 0x7F) << 8) | d[p]; p += 1
                self.strings.append(d[p:p + bl].decode("utf-8", "replace"))
            else:
                (l,) = struct.unpack_from("<H", d, p); p += 2
                if l & 0x8000: (l2,) = struct.unpack_from("<H", d, p); l = ((l & 0x7FFF) << 16) | l2; p += 2
                self.strings.append(d[p:p + l * 2].decode("utf-16-le", "replace"))


def walk(el):
    yield el
    for k in el["kids"]: yield from walk(k)


def truthy(v): return str(v).lower() in ("true", "0xffffffff")


def check_nsc(root):
    """returns a list of rule violations for one network-security-config document"""
    bad = []; cleartext_domains = set()
    if any(e["tag"] == "debug-overrides" for e in walk(root)): bad.append("has <debug-overrides>")
    # X2: only the system trust store is acceptable; <certificates src="user"/> (or @raw/..., any non-system src) anywhere is BAD
    for e in walk(root):
        if e["tag"] == "certificates":
            src = e["attrs"].get("src", "")
            if src != "system": bad.append(f"<certificates src={src!r}> trusts a non-system certificate source (only src=\"system\" is allowed)")
    for e in root["kids"]:
        if e["tag"] == "base-config" and truthy(e["attrs"].get("cleartextTrafficPermitted", "false")):
            bad.append("base-config cleartextTrafficPermitted=true")
    def dom(e, inherited):
        allowed = truthy(e["attrs"].get("cleartextTrafficPermitted", "true" if inherited else "false"))
        for k in e["kids"]:
            if k["tag"] == "domain":
                host = k["text"].strip()
                if truthy(k["attrs"].get("includeSubdomains", "false")): bad.append(f"domain {host!r} has includeSubdomains=true")
                if allowed:
                    cleartext_domains.add(host)
                    if host not in ALLOWED: bad.append(f"cleartext allowed for {host!r}")
            elif k["tag"] == "domain-config": dom(k, allowed)
    for e in root["kids"]:
        if e["tag"] == "domain-config": dom(e, False)
    for need in sorted(ALLOWED - cleartext_domains): bad.append(f"cleartext not allowed for {need}")
    return bad, sorted(cleartext_domains)


def run(apk):
    rep = {"apk": os.path.basename(apk), "networkSecurityConfig": None, "usesCleartextTraffic": None, "configs": [], "violations": []}
    try:
        z = zipfile.ZipFile(apk)
        man = Axml(z.read("AndroidManifest.xml"))
    except Exception as ex:
        return "UNREADABLE", f"APK manifest could not be decoded ({type(ex).__name__}): the qa-sim network security config is unproven", rep
    app = next((e for e in walk(man.root) if e["tag"] == "application"), None) if man.root else None
    if app is None: return "UNREADABLE", "no <application> in the decoded manifest: the qa-sim network security config is unproven", rep
    rep["networkSecurityConfig"] = app["attrs"].get("networkSecurityConfig")
    rep["usesCleartextTraffic"] = app["attrs"].get("usesCleartextTraffic")
    if rep["networkSecurityConfig"] is None: return "MISSING", MISSING_REASON, rep
    if truthy(rep["usesCleartextTraffic"] or "false"):
        return "BAD", "APK manifest sets usesCleartextTraffic=true (cleartext open to every host)", rep
    found = 0
    for n in z.namelist():
        if n.startswith("res/") and n.endswith(".xml"):
            try: doc = Axml(z.read(n))
            except Exception: continue
            if doc.root and doc.root["tag"] == "network-security-config":
                found += 1
                bad, doms = check_nsc(doc.root)
                rep["configs"].append({"file": n, "cleartext_domains": doms, "violations": bad})
                rep["violations"] += [f"{n}: {b}" for b in bad]
    if not found: return "UNREADABLE", "manifest references a network security config but none could be decoded from res/: unproven", rep
    if rep["violations"]: return "BAD", "APK network security config is not the qa-sim allowlist (10.0.2.2 and localhost only): " + "; ".join(rep["violations"])[:300], rep
    return "PASS", "network security config present, cleartext only for 10.0.2.2 and localhost, no base-config cleartext, no debug-overrides, no usesCleartextTraffic", rep


def main():
    apk, prefix = sys.argv[1], sys.argv[2]
    result, reason, rep = run(apk)
    cross = ""
    for tool in ("apkanalyzer",):
        try:
            out = subprocess.run([tool, "manifest", "print", apk], capture_output=True, text=True, timeout=60).stdout
            cross = f"apkanalyzer cross-check: networkSecurityConfig {'present' if 'networkSecurityConfig' in out else 'absent'}"
        except Exception: cross = "apkanalyzer not available (decoder above is the deciding check)"
    rep.update({"result": result, "reason": reason, "cross_check": cross})
    json.dump(rep, open(prefix + ".json", "w"), indent=1)
    with open(prefix + ".txt", "w") as f:
        f.write(f"apk: {rep['apk']}\nresult: {result}\nreason: {reason}\nandroid:networkSecurityConfig: {rep['networkSecurityConfig']}\n"
                f"android:usesCleartextTraffic: {rep['usesCleartextTraffic']}\n")
        for c in rep["configs"]: f.write(f"config {c['file']}: cleartext domains {c['cleartext_domains']}, violations {c['violations']}\n")
        f.write(cross + "\n")
    print("RESULT=" + result); print("REASON=" + reason)
    return 0 if result == "PASS" else 1

if __name__ == "__main__":
    sys.exit(main())
