// Cost micro-benchmark ONLY (not a prototype, not repo code): per-pixel arithmetic of a field-based pool (radial boundary with 5 harmonics,
// 3-octave value noise, finite-difference lighting, colour ramp) to estimate JS cost per redraw. No rendering, no visual output.
function hash(i){let x=(i^61)^(i>>>16);x=(x+(x<<3))|0;x=x^(x>>>4);x=Math.imul(x,0x27d4eb2d);x=x^(x>>>15);return (x>>>0)/4294967296}
function bench(N,iters,pieces){
  const out=new Uint8ClampedArray(N*N*4), h=new Float32Array(N*N);
  const noise=new Float32Array(64*64); for(let i=0;i<noise.length;i++) noise[i]=hash(i+7);
  const vn=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi;const a=noise[((yi&63)<<6)|(xi&63)],b=noise[((yi&63)<<6)|((xi+1)&63)],c=noise[(((yi+1)&63)<<6)|(xi&63)],d=noise[(((yi+1)&63)<<6)|((xi+1)&63)];const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v};
  const ph=[0.3,1.1,2.2,0.7,1.9], am=[0.10,0.09,0.07,0.05,0.04];
  const t0=performance.now();
  for(let it=0;it<iters;it++){
    const melt=(it%24)/23;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      let best=0;
      for(let p=0;p<pieces;p++){
        const cx=N*(0.3+0.2*p%0.5),cy=N*0.5,dx=x-cx,dy=y-cy,th=Math.atan2(dy,dx),r=Math.hypot(dx,dy);
        let R=N*0.22*(1+0.4*melt);for(let k=0;k<5;k++)R*=1+am[k]*Math.cos((k+2)*th+ph[k]+p);
        const rho=r/R;const hh=rho<1?(1-rho*rho*rho*rho):0;best=Math.max(best,hh);
      }
      h[y*N+x]=best*(0.8+0.2*vn(x*0.2,y*0.2)+0.1*vn(x*0.5,y*0.5));
    }
    for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){
      const i=y*N+x,gx=h[i+1]-h[i-1],gy=h[i+N]-h[i-N],l=Math.max(0.85,Math.min(1.06,1+(-gx-gy)*1.5)),a=Math.min(1,h[i]*6);
      const o=i*4;out[o]=238*l;out[o+1]=234*l;out[o+2]=218*l;out[o+3]=a*255;
    }
  }
  return (performance.now()-t0)/iters;
}
for(const [N,pieces] of [[96,3],[128,3],[128,8],[192,3]]){bench(N,20,pieces);console.log(`grid ${N}x${N}, ${pieces} pools: ${bench(N,150,pieces).toFixed(2)} ms per full redraw (node, JIT-warm)`)}
