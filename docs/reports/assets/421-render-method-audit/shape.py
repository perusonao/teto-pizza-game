import sys, math, json
sys.path.insert(0,".")
import numpy as np
from analyze import load, hsv_feats, dilate, erode, label
from PIL import Image
def shape_stats(path, width):
    a=load(path,width); lum,sat=hsv_feats(a)
    green=(a[...,1]>a[...,0]+8)&(a[...,1]>a[...,2]+8)
    m=(lum>172)&(sat<0.3)&~green
    m=erode(dilate(m,2),2)
    lab,_=label(m)
    ids,cnt=np.unique(lab[lab>0],return_counts=True)
    h,w=m.shape; out=[]
    for i,c in zip(ids,cnt):
        if c<400: continue
        mm=lab==i; ys,xs=np.nonzero(mm)
        if ys.min()<=1 or xs.min()<=1 or ys.max()>=h-2 or xs.max()>=w-2: continue
        edge=mm&~erode(mm); per=int(edge.sum()); A=int(c)
        iso=per*per/(4*math.pi*A)
        cx,cy=xs.mean(),ys.mean()
        ey,ex=np.nonzero(edge)
        ang=np.arctan2(ey-cy,ex-cx); r=np.hypot(ex-cx,ey-cy)
        bins=72; rad=np.zeros(bins)
        idx=((ang+math.pi)/(2*math.pi)*bins).astype(int)%bins
        for b in range(bins):
            sel=r[idx==b]; rad[b]=sel.max() if len(sel) else 0
        for b in range(bins):
            if rad[b]==0: rad[b]=rad[b-1]
        k=np.ones(5)/5; rs=np.convolve(np.r_[rad[-2:],rad,rad[:2]],k,"valid")
        mean=rs.mean(); peaks=0
        for b in range(bins):
            l,rr=rs[b-1],rs[(b+1)%bins]
            if rs[b]>l and rs[b]>=rr and rs[b]>mean*1.08:
                win=[rs[(b+d)%bins] for d in range(-18,19)]
                if rs[b]-min(win)>0.10*mean: peaks+=1
        out.append(dict(eqd=2*math.sqrt(A/math.pi),iso=iso,peaks=peaks,rr=float(rs.max()/rs.min())))
    return out
if __name__=="__main__":
    S=sys.argv[1]
    rows={}
    rows["photo"]=shape_stats("/root/.claude/uploads/0c9039c0-7d6b-5820-a125-8a0d96d926ca/86167333-image.jpg",360)
    for name,p in [("M1",f"{S}/s4-m1/390x844-3-baked-closeup.png"),("Proto3",f"{S}/s4-p3/390x844-3-baked-closeup.png"),("Proto4",f"{S}/s4-p4/390x844-3-baked-closeup.png"),("Proto4b",f"{S}/s6-p4/390x844-3-baked-closeup.png")]:
        w=Image.open(p).width
        st=shape_stats(p,w)
        e=max(c["eqd"] for c in st); w2=int(w*79/e); rows[name]=shape_stats(p,w2)
    for k,v in rows.items():
        print(k,[(round(c["eqd"]),round(c["iso"],2),c["peaks"],round(c["rr"],2)) for c in v if c["eqd"]>35])
