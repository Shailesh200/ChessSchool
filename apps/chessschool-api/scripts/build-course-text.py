"""Builds data/course.<lang>.json from data/i18n/en-strings.json and data/i18n/<lang>/*.json (same order).
Null entries are templated lines filled by i18n-patterns.py. Usage: python3 scripts/build-course-text.py hi"""
import glob, importlib.util, json, sys, os

lang = sys.argv[1]
here = os.path.dirname(__file__)
spec = importlib.util.spec_from_file_location("p", os.path.join(here, "i18n-patterns.py")); p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
data = os.path.join(here, "..", "data")
en = json.load(open(f"{data}/i18n/en-strings.json"))
tr = [x for f in sorted(glob.glob(f"{data}/i18n/{lang}/*.json")) for x in json.load(open(f))]
assert len(tr) == len(en), f"{len(tr)} translations for {len(en)} strings"
table = {}
for e, t in zip(en, tr):
    t = t if t is not None else getattr(p, lang)(e)
    assert t, f"no translation for: {e}"
    table[e] = t
T = lambda s: table.get(s) if s else None
course = json.load(open(f"{data}/course.json"))
out = {"lang": lang, "units": {}, "lessons": {}, "comingSoon": {}}
for u in course["units"]:
    out["units"][u["id"]] = {"title": T(u["title"]), "sub": T(u.get("sub"))}
for l in course["lessons"]:
    steps = []
    for s in l["steps"]:
        st = {k: T(s.get(k)) for k in ("title", "body", "hint") if s.get(k)}
        if s.get("options"): st["options"] = [T(o["label"]) for o in s["options"]]
        steps.append(st)
    out["lessons"][l["id"]] = {"title": T(l["title"]), "sub": T(l.get("sub")), "steps": steps}
for c in course.get("comingSoon", []):
    out["comingSoon"][c["id"]] = {"title": T(c["title"]), "sub": T(c.get("sub"))}
json.dump(out, open(f"{data}/course.{lang}.json", "w"), ensure_ascii=False, indent=1)
print(f"course.{lang}.json: {len(out['units'])} units, {len(out['lessons'])} lessons")
