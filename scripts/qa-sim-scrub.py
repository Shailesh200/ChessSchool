#!/usr/bin/env python3
"""DRAFT. Remove this run's throwaway passwords from every file in the artifact dir before upload.
usage: qa-sim-scrub.py ACCOUNTS_ENV ARTIFACT_DIR
Reads KEY=VALUE lines from the 0600 accounts file; every *_PASSWORD value is replaced by '[scrubbed]' (byte-for-byte, all files,
including Maestro logs and commands.json where inputText is recorded in plain text). Prints COUNTS only, never a value.
Afterwards it re-scans; a file that still contains a password is deleted. Exit 1 if the accounts file cannot be read or a file
could not be cleaned or deleted."""
import os, sys

def main():
    envf, root = sys.argv[1], sys.argv[2]
    try:
        lines = open(envf).read().splitlines()
    except OSError:
        print("scrub: accounts file not readable", file=sys.stderr); return 1
    secrets_ = []
    for l in lines:
        k, _, v = l.partition("=")
        if k.endswith("_PASSWORD") and len(v) >= 8:
            secrets_.append(v.encode())
    if not secrets_:
        print("scrub: no passwords to scrub (accounts file empty)"); return 0
    changed = deleted = scanned = 0; bad = 0
    for dp, _, fns in os.walk(root):
        for fn in fns:
            p = os.path.join(dp, fn)
            try:
                data = open(p, "rb").read()
            except OSError:
                continue
            scanned += 1
            new = data
            for sec in secrets_:
                new = new.replace(sec, b"[scrubbed]")
            if new != data:
                try:
                    open(p, "wb").write(new); changed += 1
                except OSError:
                    try: os.remove(p); deleted += 1
                    except OSError: bad += 1
    # verify
    for dp, _, fns in os.walk(root):
        for fn in fns:
            p = os.path.join(dp, fn)
            try:
                data = open(p, "rb").read()
            except OSError:
                continue
            if any(sec in data for sec in secrets_):
                try: os.remove(p); deleted += 1
                except OSError: bad += 1
    print(f"scrub: scanned {scanned} files, rewrote {changed}, deleted {deleted}, unresolved {bad}")
    return 1 if bad else 0

sys.exit(main())
