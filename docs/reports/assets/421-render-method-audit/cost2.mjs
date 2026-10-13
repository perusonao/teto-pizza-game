// Cost micro-benchmark ONLY (not a prototype): the same per-pixel field work, but with the static geometry (angle bin, radius, noise) precomputed
// once per piece and only the melt-dependent scale / thickness / lighting evaluated per redraw. No rendering, no visual output.
function hash(i){let x=(i^61)^(i>>>16);x=(x+(x<<3))|0;x=x^(x>>>4);x=Math.imul(x,0x27d4eb2d);x=x^(x>>>15);return (x>>>0)/4294967296}
function make(N,seed){
  const bin=new Uint16Array(N*N), rad=new Float32Array(N*N), nz=new Float32Array(N*N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const dx=x-N/2,dy=y-N/2,i=y*N+x;bin[i]=((Math.atan2(dy,dx)+Math.PI)/(2*Math.PI)*360)|0;rad[i]=Math.hypot(dx,dy)/(N/2);nz[i]=0.8+0.2*hash(i+seed)}
  const ph=[0.3,1.1,2.2,0.7,1.9],am=[0.10,0.09,0.07,0.05,0.04];
  const lut=new Float32Array(360);for(let b=0;b<360;b++){const th=b/360*2*Math.PI;let R=0.5;for(let k=0;k<5;k++)R*=1+am[k]*Math.cos((k+2)*th+ph[k]+seed);lut[b]=R}
  return {N,bin,rad,nz,lut,h:new Float32Array(N*N),out:new Uint8ClampedArray(N*N*4)};
}
function frame(P,melt){
  const {N,bin,rad,nz,lut,h,out}=P, s=1+0.4*melt;
  for(let i=0;i<N*N;i++){const rho=rad[i]/(lut[bin[i]]*s);const r2=rho*rho;h[i]=rho<1?(1-r2*r2)*nz[i]:0}
  for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){const i=y*N+x,gx=h[i+1]-h[i-1],gy=h[i+N]-h[i-N],l=Math.max(0.85,Math.min(1.06,1+(-gx-gy)*1.5)),a=Math.min(1,h[i]*6),o=i*4;out[o]=238*l;out[o+1]=234*l;out[o+2]=218*l;out[o+3]=a*255}
}
for(const [N,pieces] of [[64,3],[96,3],[96,8],[128,3]]){
  const ps=Array.from({length:pieces},(_,k)=>make(N,k*13+1));
  for(let w=0;w<30;w++)for(const p of ps)frame(p,(w%24)/23);
  const iters=300,t0=performance.now();
  for(let it=0;it<iters;it++)for(const p of ps)frame(p,(it%24)/23);
  console.log(`per-piece grid ${N}x${N}, ${pieces} pieces: ${((performance.now()-t0)/iters).toFixed(3)} ms per redraw of all pieces (node, JIT-warm)`);
}
