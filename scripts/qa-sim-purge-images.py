#!/usr/bin/env python3
"""Delete every image and video file under the given directories (a secret unit's Maestro debug dir), then re-scan.

  qa-sim-purge-images.py DIR [DIR ...]                    delete every image/video under the dirs, re-scan, exit 1 if any could not be deleted or remains
  qa-sim-purge-images.py --sweep ROOT [--allow DIR ...]   whole-folder sweep: every image/video under ROOT that is NOT under an --allow dir (the non-secret
                                                          units' Maestro folders) and every symlink under ROOT is deleted and counts as RESIDUE. Exit 0 = nothing found, 10 = residue found and deleted,
                                                          11 = something remains; any other code = the sweep itself failed (a crash is 1)

A file counts as an image/video when its extension is png/jpg/jpeg/webp/gif/bmp/heic/heif/tif/tiff/svg/mp4/mov/m4v/webm/mkv/avi/3gp, OR its first bytes are an
image/video magic number (PNG, JPEG, GIF, BMP, TIFF, WebP, MP4/MOV `ftyp`, Matroska/WebM), so a renamed or extensionless image is removed too (detection is by content as well as by extension, everywhere).
Exit 0 = all removed and a second scan found none; 1 = a file could not be deleted or one is still there. Prints counts and file names only.
"""
import os, sys

EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".heic", ".heif", ".tif", ".tiff", ".svg", ".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".3gp"}

def is_media(path):
    if os.path.splitext(path)[1].lower() in EXT: return True
    try:
        with open(path, "rb") as f: h = f.read(16)
    except OSError:
        return False
    return (h.startswith(b"\x89PNG\r\n\x1a\n") or h.startswith(b"\xff\xd8\xff") or h[:6] in (b"GIF87a", b"GIF89a") or h[:2] == b"BM"
            or h[:4] in (b"II*\x00", b"MM\x00*") or (h[:4] == b"RIFF" and h[8:12] in (b"WEBP", b"AVI ")) or h[4:8] == b"ftyp" or h[:4] == b"\x1a\x45\xdf\xa3")

def scan(dirs):
    out = []
    for d in dirs:
        for root, _, fs in os.walk(d):
            out += [os.path.join(root, f) for f in fs if is_media(os.path.join(root, f))]
    return out

def symlinks(root):
    """Every symlink under root (file links, directory links, broken links). os.walk does not follow links, so a link to an outside directory would hide files
    from the scan while the upload glob may follow it: any link under the artifacts folder is deleted and counts as residue."""
    out = []
    for r, ds, fs in os.walk(root):
        out += [os.path.join(r, n) for n in ds + fs if os.path.islink(os.path.join(r, n))]
    return out

def under(path, dirs):
    p = os.path.realpath(path)
    return any(p == d or p.startswith(d + os.sep) for d in dirs)

def delete(found):
    bad = 0
    for p in found:
        try: os.remove(p)
        except OSError as e: bad += 1; print(f"purge: could not delete {p}: {e}")
    return bad

args = sys.argv[1:]
if args[:1] == ["--sweep"]:
    if len(args) < 2: sys.exit("usage: qa-sim-purge-images.py --sweep ROOT [--allow DIR ...]")
    root = args[1]; allow = []
    rest = args[2:]
    if rest[:1] == ["--allow"]: allow = [os.path.realpath(d) for d in rest[1:]]
    elif rest: sys.exit("usage: qa-sim-purge-images.py --sweep ROOT [--allow DIR ...]")
    if not os.path.isdir(root): print(f"purge: sweep root {root} is not a directory"); sys.exit(1)
    links = symlinks(root)
    for p in links: print(f"purge: SYMLINK under the artifacts folder: {p}")
    bad = delete(links)                      # links go first: a link to an image is removed as a link, a link to a directory is never followed
    found = [p for p in scan([root]) if not under(p, allow)]
    for p in found: print(f"purge: RESIDUE outside the non-secret units' folders: {p}")
    bad += delete(found)
    left = [p for p in scan([root]) if not under(p, allow)] + symlinks(root)
    for p in left: print(f"purge: STILL PRESENT {p}")
    print(f"purge: sweep of {root}: {len(found)} image/video file(s) outside the {len(allow)} allowed dir(s), {len(links)} symlink(s), {len(left)} remain")
    # --sweep exit codes: 0 = nothing found; 10 = residue/symlinks found and all deleted; 11 = something could not be deleted or remains. Any other code (a crash
    # traceback is 1) means the sweep itself failed and the caller must use its dependency-free fallback.
    sys.exit(11 if (bad or left) else 10 if (found or links) else 0)
if not args: sys.exit("usage: qa-sim-purge-images.py DIR [DIR ...] | --sweep ROOT [--allow DIR ...]")
dirs = [d for d in args if os.path.isdir(d)]
found = scan(dirs); bad = delete(found)
left = scan(dirs)
for p in left: print(f"purge: STILL PRESENT {p}")
print(f"purge: {len(dirs)} dir(s), deleted {len(found) - bad} image/video file(s), {len(left)} remain")
sys.exit(1 if (bad or left) else 0)
