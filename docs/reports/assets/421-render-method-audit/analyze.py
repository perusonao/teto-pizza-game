import sys, json, math
import numpy as np
from PIL import Image

def load(path, width):
    im = Image.open(path).convert("RGB")
    h = round(im.height * width / im.width)
    return np.asarray(im.resize((width, h), Image.LANCZOS)).astype(np.float32)

def hsv_feats(a):
    mx = a.max(2); mn = a.min(2)
    lum = 0.2126*a[...,0] + 0.7152*a[...,1] + 0.0722*a[...,2]
    sat = np.where(mx > 0, (mx-mn)/np.maximum(mx,1), 0)
    return lum, sat

def dilate(m, k=1):
    for _ in range(k):
        p = np.pad(m, 1)
        m = p[1:-1,1:-1] | p[:-2,1:-1] | p[2:,1:-1] | p[1:-1,:-2] | p[1:-1,2:]
    return m

def erode(m, k=1):
    return ~dilate(~m, k)

def label(m):
    h, w = m.shape
    lab = np.zeros((h, w), np.int32); parent = [0]
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    nxt = 1
    for y in range(h):
        for x in range(w):
            if not m[y, x]: continue
            a = lab[y, x-1] if x > 0 else 0
            b = lab[y-1, x] if y > 0 else 0
            if a == 0 and b == 0:
                lab[y, x] = nxt; parent.append(nxt); nxt += 1
            elif a and b:
                ra, rb = find(a), find(b)
                if ra != rb: parent[rb] = ra
                lab[y, x] = ra
            else:
                lab[y, x] = a or b
    roots = np.array([find(i) for i in range(nxt)])
    return roots[lab] * (lab > 0), roots

def hull_area(pts):
    pts = sorted(set(pts))
    if len(pts) < 3: return 0.0
    def cross(o, a, b): return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lo = []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    up = []
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    h = lo[:-1] + up[:-1]
    return abs(sum(h[i][0]*h[(i+1)%len(h)][1] - h[(i+1)%len(h)][0]*h[i][1] for i in range(len(h)))) / 2

def analyze(path, width, lum_min, sat_max, close_k, min_area, roi=None, name=""):
    a = load(path, width)
    lum, sat = hsv_feats(a)
    green = (a[...,1] > a[...,0] + 8) & (a[...,1] > a[...,2] + 8)
    mask = (lum > lum_min) & (sat < sat_max) & ~green
    if roi is not None:
        r = np.zeros_like(mask); y0, y1, x0, x1 = roi; r[y0:y1, x0:x1] = True; mask &= r
    if close_k: mask = erode(dilate(mask, close_k), close_k)
    lab, _ = label(mask)
    ids, counts = np.unique(lab[lab > 0], return_counts=True)
    comps = []
    h, w = mask.shape
    for i, c in zip(ids, counts):
        if c < min_area: continue
        ys, xs = np.nonzero(lab == i)
        touches = bool(ys.min() <= 1 or xs.min() <= 1 or ys.max() >= h-2 or xs.max() >= w-2)
        m = (lab == i)
        edge = m & ~erode(m)
        ey, ex = np.nonzero(edge)
        ha = hull_area(list(zip(ex.tolist(), ey.tolist()))) + 0.0
        cov = np.cov(np.vstack([xs, ys]))
        ev = np.sort(np.linalg.eigvalsh(cov))[::-1]
        aspect = math.sqrt(ev[0]/max(ev[1], 1e-6))
        # edge profile (normalised luminance) inside (-k) and outside (+k)
        prof = {}
        cur_in = m; cur_out = m
        ring_in = {}; ring_out = {}
        for k in range(1, 13):
            ni = erode(cur_in); ring_in[k] = cur_in & ~ni; cur_in = ni
            no = dilate(cur_out); ring_out[k] = no & ~cur_out; cur_out = no
        core = lum[ring_in[11] | ring_in[12]].mean() if (ring_in[11] | ring_in[12]).any() else float("nan")
        out = lum[ring_out[10] | ring_out[11] | ring_out[12]].mean()
        def nl(r): return float((lum[r].mean() - out) / (core - out)) if r.any() and core == core and core != out else float("nan")
        profile = {f"in{k}": nl(ring_in[k]) for k in (1, 2, 3, 4, 6)}
        profile.update({f"out{k}": nl(ring_out[k]) for k in (1, 2, 3, 4, 6)})
        interior = erode(m, 5)
        sel = interior if interior.any() else m
        core_rgb = a[sel].mean(0)
        band = ring_in[1] | ring_in[2] | ring_in[3]
        band_rgb = a[band].mean(0) if band.any() else core_rgb
        # amber / browning spots inside the blob: warm (r>g>b), moderately saturated, darker than the core
        warm = sel & (a[...,0] > a[...,1] + 12) & (a[...,1] > a[...,2] + 12) & (lum < core*0.93)
        gloss = sel & (lum > 246)
        comps.append(dict(area=int(c), eqd=2*math.sqrt(c/math.pi), solidity=c/ha if ha else float("nan"), aspect=aspect, touches_border=touches,
                          profile=profile, core_rgb=[round(float(x)) for x in core_rgb], band_rgb=[round(float(x)) for x in band_rgb],
                          warm_frac=float(warm.sum()/max(sel.sum(),1)), gloss_frac=float(gloss.sum()/max(sel.sum(),1)), core_lum=float(core), out_lum=float(out),
                          centroid=[float(xs.mean()), float(ys.mean())]))
    return dict(name=name, size=[w, h], mask_frac=float(mask.mean()), comps=comps)

if __name__ == "__main__":
    spec = json.loads(sys.argv[1])
    print(json.dumps(analyze(**spec), indent=1))
