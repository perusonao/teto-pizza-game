"""Offline analysis of probe screenshots: per-row right/left extent of the *pizza* (orange/red body, not the plate),
and the longest run of rows whose right edge sits at the same x (a vertical cut shows as a long constant-x run).
Usage: python3 analyze.py <PROBE_OUT>"""
import glob, os, sys, json
import numpy as np
from PIL import Image

def mask(path):
    im = np.asarray(Image.open(path).convert("RGB")).astype(int)
    return (im[:, :, 0] - im[:, :, 2]) >= 70  # orange/red/crust; the plate ring and page are beige (< 70)

def edges(m):
    h, w = m.shape
    right = np.array([np.where(m[y])[0].max() if m[y].any() else -1 for y in range(h)])
    return right

def longest_flat(right, tol=0):
    best = cur = 1; start = 0; best_at = (0, 1)
    for i in range(1, len(right)):
        if right[i] >= 0 and right[i - 1] >= 0 and abs(right[i] - right[i - 1]) <= tol:
            cur += 1
            if cur > best: best, best_at = cur, (i - cur + 1, cur)
        else:
            cur = 1
    return best_at

out = sys.argv[1]
rows = []
for proj_dir in sorted(glob.glob(os.path.join(out, "*"))):
    for case_dir in sorted(glob.glob(os.path.join(proj_dir, "*"))):
        res = {}
        for p in sorted(glob.glob(os.path.join(case_dir, "10-result-*.png"))):
            m = mask(p); right = edges(m)
            h, w = m.shape
            mid = slice(int(h * 0.25), int(h * 0.75))
            run_at, run_len = longest_flat(right[mid], tol=0)
            res[os.path.basename(p)[10:-4]] = dict(maxRight=int(right.max()), w=w, flatRun=int(run_len), area=int(m.sum()))
        if res:
            rows.append((os.path.basename(proj_dir), os.path.basename(case_dir), res))
print("project | case | experiment: maxRightX / width, longest constant-right-edge run (rows, middle half), pizza pixels")
for proj, case, res in rows:
    base = res.get("asis")
    for name, r in res.items():
        flag = ""
        if base and name != "asis" and abs(r["area"] - base["area"]) > 0.02 * max(base["area"], 1): flag = "  <-- pizza pixels differ >2% from asis"
        print(f"{proj} | {case} | {name}: maxRight={r['maxRight']}/{r['w']} flatRun={r['flatRun']} area={r['area']}{flag}")
