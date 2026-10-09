"""For each search case: how much of the *round reference pizza* (clip-paths removed) is missing from the drawn
pizza, away from the thin cut seams. Prints the worst cases. Usage: python3 search-analyze.py <PROBE_OUT> [results_dir]"""
import glob, json, os, sys, shutil
import numpy as np
from PIL import Image, ImageFilter

out = sys.argv[1]; res = sys.argv[2] if len(sys.argv) > 2 else None
rows = []
for d in sorted(glob.glob(os.path.join(out, "*", "*"))):
    a, b = os.path.join(d, "10-result-asis.png"), os.path.join(d, "10-result-no-clip-path.png")
    if not (os.path.exists(a) and os.path.exists(b)): continue
    A = np.asarray(Image.open(a).convert("RGB")).astype(int); B = np.asarray(Image.open(b).convert("RGB")).astype(int)
    h, w, _ = A.shape
    yy, xx = np.mgrid[:h, :w]; r = np.hypot(xx - w / 2, yy - h / 2) / (w / 2)
    ring = (r > 0.70) & (r < 0.93)  # the outer part of the pizza body, inside the plate
    # reference pizza colour = orange/red/crust in the unclipped image; "missing" = reference is pizza but drawn is plate/page
    ref = ((B[:, :, 0] - B[:, :, 2]) >= 70) & ring
    got = ((A[:, :, 0] - A[:, :, 2]) >= 45) | (np.abs(A - B).max(axis=2) < 40)
    miss = (ref & ~got).astype(np.uint8) * 255
    k = max(3, int(round(w / 588 * 9)) | 1)
    opened = np.asarray(Image.fromarray(miss).filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))) > 0
    ys, xs = np.where(opened)
    info = json.load(open(os.path.join(d, "info.json")))
    rows.append((int(opened.sum()), os.path.basename(os.path.dirname(d)), os.path.basename(d), info.get("pieces"), (int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())) if opened.any() else None, d))
rows.sort(key=lambda t: -t[0])
print(f"cases analysed: {len(rows)}; with a missing blob (>=1px after opening): {sum(1 for r in rows if r[0] > 0)}")
print("missingPx | project | case | pieces | bbox")
for n, proj, case, pieces, bb, d in rows[:15]:
    print(f"{n:7d} | {proj} | {case} | pieces={pieces} | {bb}")
if res:
    for n, proj, case, pieces, bb, d in rows[:8]:
        dst = os.path.join(res, proj, case); os.makedirs(dst, exist_ok=True)
        for f in ("10-result-asis.png", "10-result-no-clip-path.png"):
            Image.open(os.path.join(d, f)).convert("RGB").quantize(colors=96).save(os.path.join(dst, f), optimize=True)
