#!/usr/bin/env python3
"""Fail-closed guard for the qa-sim Maestro flows (no secrets are read or printed; it only reads the flow files and the manifest).

  qa-sim-flow-guard.py [--flows DIR]        (default parity/maestro/flows/qa, relative to the repo root = the current directory)

Source of truth for "this unit types a password" is column 4 of manifest.tsv (`secret`: yes|no). Checks, each a `GUARD FAIL` line:
  1. the manifest is well formed (5 tab separated columns, secret is yes or no, units unique, every flow file exists);
  2. DRIFT: a unit whose flows (or any _common flow they run, followed through `runFlow`) reference a password (a *PASSWORD variable or a
     password field id, comment lines ignored) must have secret=yes;
  3. a secret=yes unit's flows, and every _common flow they run, must not contain takeScreenshot, startRecording, stopRecording, assertScreenshot, assertWithAI or extractTextWithAI;
  4. any flow file anywhere under DIR (incl. _common) whose own text and the flows it runs reference a password must not contain
     takeScreenshot or startRecording (so a screenshot step can never sit next to a password input, flagged or not).
  5. runFlow/file references are followed recursively (a subflow of a subflow ...); a reference that cannot be resolved (missing file, `${VAR}` in the
     path, a non-yaml runFlow target) is a GUARD FAIL, never skipped.
  6. two layers: (a) the raw text, case-insensitive (so TakeScreenshot or ASSERTWITHAI are caught), and (b) every flow parsed with yaml.safe_load: every mapping key
     and every bare command string is compared in lower case after YAML decoding (so "\\u0061ssertWithAI", quoted keys, anchors and aliases are caught), and
     runFlow/file references found in the parsed tree are followed too. A flow that yaml.safe_load cannot parse, or a missing PyYAML, is a GUARD FAIL.
  7. DUPLICATE KEYS: a mapping with the same key twice (`takeScreenshot:` twice, or `file:` twice, in one mapping) is a GUARD FAIL. PyYAML keeps the LAST value, while Maestro's own parser may
     reject the flow or keep another one, so the guard cannot say which one runs. Flows are loaded with a custom SafeLoader that raises on a duplicate key (after the YAML decoding of
     the key, so "a" and "\\x61" are the same key; `<<` merge keys are not counted, an explicit key overriding a merged one is legal YAML).
Exit 0 = PASS, 1 = any GUARD FAIL.
"""
import os, re, sys
try: import yaml
except ImportError: yaml = None

class _DuplicateKey(Exception): pass
if yaml is not None:
    class _StrictLoader(yaml.SafeLoader):   # yaml.safe_load semantics (no python objects), plus: a duplicate mapping key is an error
        pass
    def _construct_mapping_no_dups(loader, node, deep=False):
        if isinstance(node, yaml.MappingNode):
            seen = {}
            for k_node, _ in node.value:
                if k_node.tag == "tag:yaml.org,2002:merge": continue    # `<<: *base`: an explicit key overriding a merged one is legal
                try: key = loader.construct_object(k_node, deep=True)
                except Exception: continue                               # the normal construction below reports it
                try: hash(key)
                except TypeError: continue
                if key in seen:
                    raise _DuplicateKey(f"duplicate key {str(key)[:40]!r} in one mapping (line {seen[key]} and line {k_node.start_mark.line + 1}); PyYAML keeps the last, Maestro may not")
                seen[key] = k_node.start_mark.line + 1
        return yaml.SafeLoader.construct_mapping(loader, node, deep)
    _StrictLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _construct_mapping_no_dups)

args = sys.argv[1:]
flows = "parity/maestro/flows/qa"
if args[:1] == ["--flows"] and len(args) == 2: flows = args[1]
elif args: sys.exit("usage: qa-sim-flow-guard.py [--flows DIR]")

PW = re.compile(r"password", re.I)                                           # *PASSWORD vars (MAESTRO_*_PASSWORD, SI_PASSWORD) and ids like login-password
SHOT_NAMES = {n.lower(): n for n in ("takeScreenshot", "startRecording", "stopRecording", "assertScreenshot", "assertWithAI", "extractTextWithAI")}   # the two AI commands send a screenshot to a remote model
ANY_NAMES = ("takescreenshot", "startrecording")
SHOT = re.compile(r"\b(" + "|".join(SHOT_NAMES.values()) + r")\b", re.I)         # layer (a): raw text, case-insensitive
SHOT_ANY = re.compile(r"\b(takeScreenshot|startRecording)\b", re.I)
RUNFLOW = re.compile(r"\brunFlow\s*:\s*(.*)$")      # `runFlow: x.yaml`, `runFlow: {file: x.yaml, ...}`, or `runFlow:` + a nested `file:`
FILEKEY = re.compile(r"\bfile\s*:\s*(.*)$")
errors = []
def fail(msg): errors.append("GUARD FAIL: " + msg)

def lines(path):  # (lineno, text) of non-comment lines
    out = []
    for n, l in enumerate(open(path, encoding="utf-8", errors="replace").read().splitlines(), 1):
        if l.lstrip().startswith("#"): continue
        out.append((n, l))
    return out

def target(v):  # first scalar of the text after `key:`; "" if there is none (block form, comment, or an inline map without a scalar)
    v = v.strip()
    if v == "" or v[0] in "#|>": return ""
    m = re.match(r"""^['"]?([^'",}#]+?)['"]?\s*(?:[,}#].*)?$""", v)
    return m.group(1).strip() if m else v

def refs_of(path, L):
    """(resolved yaml paths, unresolvable references as (line, text)). Follows runFlow: and file: (also inside inline maps)."""
    refs, bad = [], []
    for n, l in L:
        found = []
        m = RUNFLOW.search(l)
        if m:
            v = m.group(1).strip()
            inline = re.search(r"\bfile\s*:\s*(.*)$", v) if v.startswith("{") else None
            if inline: found.append(("file", target(inline.group(1))))
            elif v.startswith("{"): bad.append((n, l.strip()))          # inline map without a file: key (commands only is fine, but be loud)
            else: found.append(("runFlow", target(v)))
        else:
            m = FILEKEY.search(l)
            if m: found.append(("file", target(m.group(1))))
        for kind, t in found:
            if not t: continue
            if t.endswith((".yaml", ".yml")):
                if "$" in t: bad.append((n, l.strip()))                   # a variable in the path cannot be followed
                else: refs.append(os.path.normpath(os.path.join(os.path.dirname(path), t)))
            elif kind == "runFlow": bad.append((n, l.strip()))            # runFlow target that is not a .yaml/.yml path
    return refs, bad

def parsed(path):
    """Layer (b): yaml.safe_load every document. Returns (names, pw, refs, err): lower-cased command names found as mapping keys or bare strings, whether any key/string
    mentions a password, (kind, target) runFlow/file references, and an error text if the file cannot be parsed."""
    if yaml is None: return set(), False, [], "PyYAML (python3 module `yaml`) is not installed, so the flows cannot be parsed"
    names, refs, seen, pw = set(), [], set(), [False]
    def walk(x):
        if id(x) in seen: return
        if isinstance(x, (dict, list)): seen.add(id(x))
        if isinstance(x, dict):
            for k, v in x.items():
                if isinstance(k, str):
                    kl = k.strip().lower()
                    if kl in SHOT_NAMES: names.add(kl)
                    if "password" in kl: pw[0] = True
                    if kl == "runflow":
                        if isinstance(v, str): refs.append(("runFlow", v.strip()))
                        elif isinstance(v, dict):
                            for k2, v2 in v.items():
                                if isinstance(k2, str) and k2.strip().lower() == "file" and isinstance(v2, str): refs.append(("file", v2.strip()))
                    elif kl == "file" and isinstance(v, str): refs.append(("file", v.strip()))
                walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
        elif isinstance(x, str):
            if x.strip().lower() in SHOT_NAMES: names.add(x.strip().lower())
            if "password" in x.lower(): pw[0] = True
    try:
        for doc in yaml.load_all(open(path, encoding="utf-8").read(), Loader=_StrictLoader): walk(doc)   # = safe_load_all + the duplicate-key check
    except _DuplicateKey as e:
        return set(), False, [], str(e)
    except Exception as e:
        return set(), False, [], f"yaml.safe_load cannot parse it ({type(e).__name__}: {str(e).splitlines()[0][:100] if str(e) else ''})"
    return names, pw[0], refs, None

cache = {}
def info(path):
    path = os.path.normpath(path)
    if path not in cache:
        L = lines(path)
        refs, bad = refs_of(path, L)
        pnames, ppw, prefs, perr = parsed(path)
        if perr: fail(f"{path}: {perr}")                                   # fail closed: a flow that cannot be parsed cannot be vouched for
        for kind, t in prefs:
            if t.endswith((".yaml", ".yml")):
                if "$" in t: bad.append((0, f"{kind}: {t}"))
                else:
                    r = os.path.normpath(os.path.join(os.path.dirname(path), t))
                    if r not in refs: refs.append(r)
            elif kind == "runFlow" and t: bad.append((0, f"runFlow: {t}"))
        shot = [(n, SHOT_NAMES[SHOT.search(l).group(1).lower()]) for n, l in L if SHOT.search(l)]
        shot += [("parsed-yaml", SHOT_NAMES[k]) for k in sorted(pnames) if SHOT_NAMES[k] not in [w for _, w in shot]]
        shot_any = [n for n, l in L if SHOT_ANY.search(l)] + [("parsed-yaml") for k in pnames if k in ANY_NAMES and not any(SHOT_ANY.search(l) for _, l in L)]
        pw = [n for n, l in L if PW.search(l)] or (["parsed-yaml"] if ppw else [])
        cache[path] = {"pw": pw, "shot": shot, "shot_any": shot_any, "refs": refs, "bad": bad}
    return cache[path]

def closure(path):
    seen, todo = [], [os.path.normpath(path)]
    while todo:
        p = todo.pop()
        if p in seen: continue
        if not os.path.isfile(p):
            fail(f"{p}: referenced flow file does not exist"); continue
        seen.append(p); todo.extend(info(p)["refs"])
        for n, t in info(p)["bad"]: fail(f"{p}:{n}: runFlow target cannot be resolved to a flow file ({t[:120]})")
    return seen

man = os.path.join(flows, "manifest.tsv")
units = []
if not os.path.isfile(man): fail(f"{man} not found")
else:
    for n, l in enumerate(open(man, encoding="utf-8").read().splitlines(), 1):
        if not l.strip() or l.startswith("#"): continue
        c = l.split("\t")
        if len(c) < 5: fail(f"manifest line {n}: needs unit, needs_server, files, secret, description (5 tab separated columns), got {len(c)}"); continue
        if c[3] not in ("yes", "no"): fail(f"manifest line {n} ({c[0]}): secret must be yes or no, got '{c[3]}'"); continue
        if c[0] in [u[0] for u in units]: fail(f"manifest line {n}: unit {c[0]} listed twice"); continue
        units.append((c[0], c[3], [os.path.join(flows, p) for p in c[2].split(">") if p.endswith((".yaml", ".yml"))]))

for unit, secret, files in units:
    cl = []
    for f in files:
        for x in closure(f):
            if x not in cl: cl.append(x)
    pwf = [x for x in cl if info(x)["pw"]]
    if pwf and secret != "yes":
        fail(f"unit {unit}: flow(s) reference a password ({', '.join(os.path.relpath(x, flows) for x in pwf)}) but its manifest secret column is '{secret}', not yes")
    if secret == "yes":
        for x in cl:
            for n, w in info(x)["shot"]:
                fail(f"secret unit {unit}: {os.path.relpath(x, flows)}:{n} has {w} (not allowed in a unit that types a password)")

allf = []
for d, _, fs in os.walk(flows):
    allf += [os.path.join(d, f) for f in fs if f.endswith((".yaml", ".yml"))]
for f in sorted(allf):
    cl = closure(f)
    if any(info(x)["pw"] for x in cl):
        for x in cl:
            for n in info(x)["shot_any"]:
                fail(f"flow {os.path.relpath(f, flows)}: {os.path.relpath(x, flows)}:{n} has a screenshot/recording step in a flow that also references a password")

for e in sorted(set(errors)): print(e)
if errors: print(f"flow guard: FAIL ({len(set(errors))} problem(s))"); sys.exit(1)
sec = [u[0] for u in units if u[1] == "yes"]
print(f"flow guard: PASS ({len(units)} units, {len(sec)} secret: {', '.join(sec)}; {len(allf)} flow files checked)")
