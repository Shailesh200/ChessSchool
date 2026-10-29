#!/usr/bin/env python3
"""qa-sim API helper (stdlib only). Talks only to http://127.0.0.1:3108 (the qa-sim server on this worker).
Never prints tokens or passwords. Passwords are random per run and live only in a 0600 env file outside the artifact dir.

  qa-sim-api.py provision ENVFILE          register fresh accounts, write ENVFILE (sourced by qa-sim-maestro.sh)
  qa-sim-api.py progress  EMAIL_VAR PW_VAR OUTJSON   (reads EMAIL/PASSWORD from the environment variables named)
  qa-sim-api.py assert-xp EMAIL_VAR PW_VAR BASELINE_JSON XP_DELTA   lesson pre-square-d5 saved and xp == baseline + delta
  qa-sim-api.py earn-xp   EMAIL_VAR PW_VAR DAY XP    as that user, push lesson XP (xp, today's activity, one lesson) to the server
  qa-sim-api.py snapshot  EMAIL_VAR PW_VAR OUTJSON DAY   save xp, today's xp, lesson ids, goal
  qa-sim-api.py get       JSON KEY                   print one value from a snapshot
  qa-sim-api.py expire    EMAIL_VAR PW_VAR           log in as that user, POST /api/qa/expire-session with its Bearer token, check the token is dead (401)
  qa-sim-api.py assert-isolation B_EMAIL_VAR B_PW_VAR B_BASE_JSON A_EMAIL_VAR A_PW_VAR A_XP A_GOAL
        server side: B's xp/today/lessons == B's baseline (did not grow by A's amount, no A lesson); A keeps A_XP and A_GOAL
Variables are NAMES of environment variables; values and tokens are never printed.
Exit 0 ok, 1 failed.
"""
import errno, json, time, os, secrets, stat, sys, urllib.request, urllib.error

BASE = "http://127.0.0.1:3108"
LESSON = "pre-square-d5"


def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("content-type", "application/json")
    if token:
        req.add_header("authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {}


def register(email, pw, name, onboard):
    st, j = call("POST", "/api/auth/register", {"email": email, "password": pw, "name": name})
    if st != 200 or "token" not in j:
        print(f"register failed: HTTP {st}", file=sys.stderr)
        return False
    if onboard:
        st, _ = call("POST", "/api/profile/onboarding", {"goal": "beat-friends", "avatar": "avatar-1"}, j["token"])
        if st != 200:
            print(f"onboarding failed: HTTP {st}", file=sys.stderr)
            return False
    return True


def open_envfile(envfile):
    """Open the accounts file for writing without ever following a symlink (O_NOFOLLOW).
    New file: O_CREAT|O_EXCL (fails if anything, even a dangling symlink, is already there). The e2e script pre-creates it (0600, ours, empty):
    that file is opened with O_NOFOLLOW (a symlink = ELOOP = refused), then checked on the OPEN descriptor: regular file, our uid, one link; only then truncated."""
    nofollow = getattr(os, "O_NOFOLLOW", 0)
    if not nofollow:
        raise OSError(errno.ENOTSUP, "O_NOFOLLOW is not available")
    try:
        return os.open(envfile, os.O_WRONLY | os.O_CREAT | os.O_EXCL | nofollow, 0o600)
    except FileExistsError:
        pass
    fd = os.open(envfile, os.O_WRONLY | nofollow | os.O_NONBLOCK)   # O_NONBLOCK: a planted FIFO makes this fail (ENXIO) instead of blocking forever
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or st.st_uid != os.geteuid() or st.st_nlink != 1:
            raise OSError(errno.EPERM, "not a regular file of ours with one link")
        os.ftruncate(fd, 0)
        os.fchmod(fd, 0o600)
    except BaseException:
        os.close(fd)
        raise
    return fd


def provision(envfile):
    rand = secrets.token_hex(4)
    # Plain emails only (letters, digits, - . @): Maestro treats text: as a regex.
    acc = {}
    for key, onboard in (("M10", True), ("M11", True), ("M50", True), ("A", True), ("B", True)):
        acc[key] = (f"qa-{key.lower()}-{rand}@qa-sim.example.test", secrets.token_hex(12) + "Aa1", onboard)
    for key, (em, pw, onboard) in acc.items():
        if not register(em, pw, f"QA {key}", onboard):
            return 1
    signup = (f"qa-s-{rand}@qa-sim.example.test", secrets.token_hex(12) + "Aa1")  # NOT registered: m51a registers it in the app
    lines = []
    for key, (em, pw, _) in acc.items():
        lines += [f"{key}_EMAIL={em}", f"{key}_PASSWORD={pw}"]
    lines += [f"S_EMAIL={signup[0]}", f"S_PASSWORD={signup[1]}"]
    try:
        fd = open_envfile(envfile)
    except OSError as e:
        print(f"refusing to write the accounts file: {e.strerror or 'error'} (a symlink, a file that is not ours or not a regular file, a hard link)", file=sys.stderr)
        return 1
    with os.fdopen(fd, "w") as f:
        f.write("\n".join(lines) + "\n")
    print("provisioned fresh accounts for this run (local file: DB)")
    return 0


def get_progress(email, pw):
    st, j = call("POST", "/api/auth/login", {"email": email, "password": pw})
    if st != 200 or "token" not in j:
        print(f"login failed: HTTP {st}", file=sys.stderr)
        return None
    st, p = call("GET", "/api/progress", token=j["token"])
    if st != 200:
        print(f"GET /api/progress failed: HTTP {st}", file=sys.stderr)
        return None
    lessons = p.get("lessons") or {}
    return {"xp": p.get("xp", 0), "lessons": sorted(lessons.keys()), "attempts": {k: v.get("attempts") for k, v in lessons.items()},
            "activityDays": p.get("activityDays") or {}, "goal": p.get("dailyGoalXp")}


def login(email, pw):
    st, j = call("POST", "/api/auth/login", {"email": email, "password": pw})
    return j["token"] if st == 200 and "token" in j else None


def earn_xp(email, pw, day, xp):
    tok = login(email, pw)
    if not tok:
        print("login failed", file=sys.stderr); return 1
    now = 1_700_000_000_000
    body = {"xp": xp, "streak": 1, "lastActiveDay": day, "graduatedClasses": [],
            "lessons": {LESSON: {"mastery": 1, "attempts": 1, "lastSeen": now, "dueAt": now + 86_400_000}},
            "activityDays": {day: xp}}
    st, _ = call("POST", "/api/progress", body, tok)
    if st != 200:
        print(f"progress push failed: HTTP {st}", file=sys.stderr); return 1
    # read back: the server ignores a push whose day is beyond its UTC day and still answers 200 (dayRejected)
    st, p = call("GET", "/api/progress", token=tok)
    today = int(((p or {}).get("activityDays") or {}).get(day, -1)) if st == 200 else -1
    if st != 200 or p.get("xp") != xp or today != xp or LESSON not in (p.get("lessons") or {}):
        print(f"seed read-back mismatch: server has xp={p.get('xp') if st == 200 else '?'}, today={today} for {day} (day rejected?)", file=sys.stderr); return 1
    print(f"seeded lesson XP {xp} for {day} (read back ok)")
    return 0


def expire(email, pw):
    tok = login(email, pw)
    if not tok:
        print("expire setup: login as A failed", file=sys.stderr); return 1
    st, j = call("POST", "/api/qa/expire-session", None, tok)
    if st != 200 or not j.get("ok"):
        print(f"expire-session failed: HTTP {st}" + (" (404 = not a qa-sim server)" if st == 404 else ""), file=sys.stderr); return 1
    # the host's own login is one session, the app's login is another: fewer than 2 means the app's session was never there
    if not isinstance(j.get("revoked"), int) or j["revoked"] < 2:
        print(f"expire-session revoked {j.get('revoked')} session(s), expected >= 2 (the app's session and this login)", file=sys.stderr); return 1
    st2, _ = call("GET", "/api/progress", token=tok)
    if st2 != 401:
        print(f"expire-session answered 200 but the token still works: HTTP {st2}", file=sys.stderr); return 1
    print(f"A's sessions revoked: {j.get('revoked')}; the old token now gets 401")
    return 0


def snap_out(s, day):
    s = dict(s); s["today_xp"] = int((s.get("activityDays") or {}).get(day, 0)); s["day"] = day
    s.pop("activityDays", None); return s


def isolation_errors(base, a_xp, a_goal, ae, ap, be, bp):
    errs = []
    b = get_progress(os.environ[be], os.environ[bp]); a = get_progress(os.environ[ae], os.environ[ap])
    if b is None or a is None:
        return ["could not read B or A from the server"], None, None, False
    b = snap_out(b, base["day"]); a = snap_out(a, base["day"])
    a_ok = a["xp"] == a_xp and a["goal"] == a_goal and LESSON in a["lessons"]
    if b["xp"] != base["xp"]: errs.append(f"B xp {b['xp']} != B baseline {base['xp']}")
    if b["xp"] - base["xp"] == a_xp: errs.append("B's xp grew by exactly A's amount (A's XP was pushed into B)")
    if b["today_xp"] != base["today_xp"]: errs.append(f"B today xp {b['today_xp']} != baseline {base['today_xp']}")
    if b["lessons"] != base["lessons"]: errs.append("B's lessons changed (A's lesson was pushed into B)")
    if b["goal"] != base["goal"]: errs.append(f"B daily goal {b['goal']} != baseline {base['goal']} (A's goal was pushed into B)")
    if a["xp"] != a_xp: errs.append(f"A xp {a['xp']} != {a_xp}")
    if a["goal"] != a_goal: errs.append(f"A daily goal {a['goal']} != {a_goal} (server state)")
    if LESSON not in a["lessons"]: errs.append("A's seeded lesson is missing on the server")
    return errs, a, b, a_ok


def isolation(args):
    be, bp, bbase, ae, ap, a_xp, a_goal = args
    base = json.load(open(bbase)); a_xp = int(a_xp); a_goal = int(a_goal)
    # A's last push from the app is asynchronous: poll (bounded, 20 s) until A looks right, then wait 5 s so that a late
    # leak into B can still show, then judge once. This polls the API only; it never re-runs a flow, and it fails on timeout.
    deadline = time.time() + 20
    while True:
        errs, a, b, a_ok = isolation_errors(base, a_xp, a_goal, ae, ap, be, bp)
        if a_ok or time.time() >= deadline: break
        time.sleep(2)
    time.sleep(5)
    errs, a, b, a_ok = isolation_errors(base, a_xp, a_goal, ae, ap, be, bp)
    print(json.dumps({"ok": not errs, "errors": errs, "b_xp": (b or {}).get("xp"), "b_baseline_xp": base["xp"], "a_xp": (a or {}).get("xp")}))
    return 0 if not errs else 1


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "provision":
        return provision(sys.argv[2])
    if cmd == "earn-xp":
        return earn_xp(os.environ[sys.argv[2]], os.environ[sys.argv[3]], sys.argv[4], int(sys.argv[5]))
    if cmd == "expire":
        return expire(os.environ[sys.argv[2]], os.environ[sys.argv[3]])
    if cmd == "get":
        print(json.load(open(sys.argv[2]))[sys.argv[3]]); return 0
    if cmd == "snapshot":
        s = get_progress(os.environ[sys.argv[2]], os.environ[sys.argv[3]])
        if s is None: return 1
        json.dump(snap_out(s, sys.argv[5]), open(sys.argv[4], "w")); return 0
    if cmd == "assert-isolation":
        return isolation(sys.argv[2:9])
    if cmd in ("progress", "assert-xp"):
        email, pw = os.environ[sys.argv[2]], os.environ[sys.argv[3]]
        s = get_progress(email, pw)
        if s is None:
            return 1
        if cmd == "progress":
            json.dump(s, open(sys.argv[4], "w"))
            print(json.dumps({"xp": s["xp"], "lessons": len(s["lessons"])}))
            return 0
        base = json.load(open(sys.argv[4]))
        want = base["xp"] + int(sys.argv[5])
        errs = []
        if LESSON not in s["lessons"]:
            errs.append(f"lesson {LESSON} not saved on server")
        if s["xp"] != want:
            errs.append(f"xp {s['xp']} != expected {want} (baseline {base['xp']} + {sys.argv[5]})")
        print(json.dumps({"ok": not errs, "errors": errs, "xp": s["xp"], "baseline_xp": base["xp"]}))
        return 0 if not errs else 1
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
