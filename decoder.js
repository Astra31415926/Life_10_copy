// decoder.js · taina · zebra-first + fallback decoder
// Пошук зебри: ZEBRA FINDER v5.1 — не змінювати
// decodeCircles: ZEBRA v5.1 — не змінювати
// Fallback: шляхи 1,3,4,5 зі старого decoder.js
'use strict';

// ═══════════════════════════════════════════════════════
//  ZEBRA FINDER v5.1 — не змінювати
// ═══════════════════════════════════════════════════════

function zb_toGray(idata, w, h) {
  const d = idata.data, g = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = (77 * d[i * 4] + 150 * d[i * 4 + 1] + 29 * d[i * 4 + 2]) >> 8;
  return g;
}
function zb_sampleBG(gray, w, h, s = 5) {
  const v = [];
  for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
    v.push(gray[dy * w + dx], gray[dy * w + (w - 1 - dx)],
           gray[(h - 1 - dy) * w + dx], gray[(h - 1 - dy) * w + (w - 1 - dx)]);
  }
  v.sort((a, b) => a - b); return v[v.length >> 1];
}
function zb_makeMask(gray, w, h, bg, tol) {
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = Math.abs(gray[i] - bg) > tol ? 1 : 0;
  return m;
}
function zb_erodeMask(mask, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++)
    if (mask[y*w+x] && mask[(y-1)*w+x] && mask[(y+1)*w+x] && mask[y*w+x-1] && mask[y*w+x+1])
      out[y*w+x] = 1;
  return out;
}
function zb_findCorners(mask, w, h, slack = 12) {
  let tlS=Infinity,trS=-Infinity,brS=-Infinity,blS=Infinity;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    if (!mask[y*w+x]) continue;
    const s=x+y,d=x-y;
    if(s<tlS)tlS=s; if(d>trS)trS=d; if(s>brS)brS=s; if(d<blS)blS=d;
  }
  let tlX=0,tlY=0,tlN=0,trX=0,trY=0,trN=0,brX=0,brY=0,brN=0,blX=0,blY=0,blN=0;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    if (!mask[y*w+x]) continue;
    const s=x+y,d=x-y;
    if(s<=tlS+slack){tlX+=x;tlY+=y;tlN++;} if(d>=trS-slack){trX+=x;trY+=y;trN++;}
    if(s>=brS-slack){brX+=x;brY+=y;brN++;} if(d<=blS+slack){blX+=x;blY+=y;blN++;}
  }
  const avg=(sx,sy,n,dx,dy)=>n?{x:Math.round(sx/n),y:Math.round(sy/n)}:{x:dx,y:dy};
  return {tl:avg(tlX,tlY,tlN,0,0),tr:avg(trX,trY,trN,w-1,0),
          br:avg(brX,brY,brN,w-1,h-1),bl:avg(blX,blY,blN,0,h-1)};
}
function zb_spread(c) {
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  return Math.max(d(c.tl,c.tr),d(c.tr,c.br),d(c.br,c.bl),d(c.bl,c.tl));
}
function zb_computeH(src4,dst4) {
  const rows=[],rhs=[];
  for(let i=0;i<4;i++){const sx=src4[i].x,sy=src4[i].y,dx=dst4[i].x,dy=dst4[i].y;
    rows.push([sx,sy,1,0,0,0,-sx*dx,-sy*dx]);rhs.push(dx);
    rows.push([0,0,0,sx,sy,1,-sx*dy,-sy*dy]);rhs.push(dy);}
  const h=zb_gaussElim(rows,rhs);if(!h)return null;
  return [[h[0],h[1],h[2]],[h[3],h[4],h[5]],[h[6],h[7],1]];
}
function zb_gaussElim(A,b) {
  const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<n;c++){let mr=c,mv=Math.abs(M[c][c]);
    for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>mv){mv=Math.abs(M[r][c]);mr=r;}
    [M[c],M[mr]]=[M[mr],M[c]];
    const pv=M[c][c];if(Math.abs(pv)<1e-12)return null;
    for(let r=c+1;r<n;r++){const f=M[r][c]/pv;for(let j=c;j<=n;j++)M[r][j]-=f*M[c][j];}}
  const x=new Array(n).fill(0);
  for(let i=n-1;i>=0;i--){x[i]=M[i][n];for(let j=i+1;j<n;j++)x[i]-=M[i][j]*x[j];x[i]/=M[i][i];}
  return x;
}
function zb_inv3(M) {
  const[[a,b,c],[d,e,f],[g,h,k]]=M;
  const dt=a*(e*k-f*h)-b*(d*k-f*g)+c*(d*h-e*g);
  if(Math.abs(dt)<1e-12)return null;
  return[[(e*k-f*h)/dt,(c*h-b*k)/dt,(b*f-c*e)/dt],
         [(f*g-d*k)/dt,(a*k-c*g)/dt,(c*d-a*f)/dt],
         [(d*h-e*g)/dt,(b*g-a*h)/dt,(a*e-b*d)/dt]];
}
function zb_applyH(H,x,y) {
  const w=H[2][0]*x+H[2][1]*y+H[2][2];
  return{x:(H[0][0]*x+H[0][1]*y+H[0][2])/w,y:(H[1][0]*x+H[1][1]*y+H[1][2])/w};
}
function zb_warpPerspective(idata,sw,sh,corners,S) {
  const src4=[corners.tl,corners.tr,corners.br,corners.bl];
  const dst4=[{x:0,y:0},{x:S-1,y:0},{x:S-1,y:S-1},{x:0,y:S-1}];
  const H=zb_computeH(src4,dst4);if(!H)return null;
  const Hi=zb_inv3(H);if(!Hi)return null;
  const out=new ImageData(S,S),sd=idata.data,od=out.data;
  for(let dy=0;dy<S;dy++) for(let dx=0;dx<S;dx++){
    const p=zb_applyH(Hi,dx,dy);
    const x0=p.x|0,y0=p.y|0,x1=x0+1,y1=y0+1,fx=p.x-x0,fy=p.y-y0;
    const di=(dy*S+dx)*4;
    const get=(sx,sy,c)=>(sx<0||sx>=sw||sy<0||sy>=sh)?128:sd[(sy*sw+sx)*4+c];
    for(let c=0;c<3;c++)od[di+c]=Math.round(
      get(x0,y0,c)*(1-fx)*(1-fy)+get(x1,y0,c)*fx*(1-fy)+
      get(x0,y1,c)*(1-fx)*fy  +get(x1,y1,c)*fx*fy);
    od[di+3]=255;}
  return out;
}
function zb_verifyZebra(wGray,S,minContrast) {
  function scanLine(arr){
    const n=arr.length;let mn=255,mx=0;
    for(const v of arr){if(v<mn)mn=v;if(v>mx)mx=v;}
    if(mx-mn<minContrast)return null;
    const thr=(mn+mx)>>1,runs=[];let cur=arr[0]>thr?1:0,len=1;
    for(let i=1;i<n;i++){const b=arr[i]>thr?1:0;if(b===cur)len++;else{runs.push({v:cur,len});cur=b;len=1;}}
    runs.push({v:cur,len});if(runs.length<3)return null;
    const allLens=runs.map(r=>r.len).sort((a,b)=>a-b);
    const med=allLens[allLens.length>>1];if(med<2)return null;
    const valid=runs.filter(r=>r.len>=med*0.4&&r.len<=med*2.4);if(valid.length<5)return null;
    let T=valid.length;
    if(T%2===0){if(valid[0].v===1||valid[T-1].v===1)T+=1;else return null;}
    if(T<5)return null;
    return{T,modSize:S/T};}
  const probeOffsets=[2,5,10,15,20,30];const votes=new Map();let totalProbes=0;
  for(const off of probeOffsets){if(off>=S/2)continue;
    for(const pos of [off,S-1-off]){
      const row=new Uint8Array(S);for(let x=0;x<S;x++)row[x]=wGray[pos*S+x];
      const rh=scanLine(row);if(rh)votes.set(rh.T,(votes.get(rh.T)||0)+1);totalProbes++;
      const col=new Uint8Array(S);for(let y=0;y<S;y++)col[y]=wGray[y*S+pos];
      const rv=scanLine(col);if(rv)votes.set(rv.T,(votes.get(rv.T)||0)+1);totalProbes++;}}
  if(!votes.size)return null;
  let bestT=0,bestV=0;for(const[t,v]of votes)if(v>bestV){bestV=v;bestT=t;}
  return{T:bestT,modSize:S/bestT,confidence:bestV/totalProbes};
}
function zb_countT(wGray,S) {
  function scanLine2(arr){
    const n=arr.length;let mn=255,mx=0;
    for(const v of arr){if(v<mn)mn=v;if(v>mx)mx=v;}
    const contrast=mx-mn,thr=(mn+mx)>>1,runs=[];let cur=arr[0]>thr?1:0,len=1;
    for(let i=1;i<n;i++){const b=arr[i]>thr?1:0;if(b===cur)len++;else{runs.push({v:cur,len});cur=b;len=1;}}
    runs.push({v:cur,len});
    const allLens=runs.map(r=>r.len).sort((a,b)=>a-b),med=allLens[allLens.length>>1];
    const valid=runs.filter(r=>r.len>=med*0.4&&r.len<=med*2.4);
    return{runs:valid,med,contrast,T:valid.length};}
  const offsets=[2,5,8,12,18];const results=[];
  for(const off of offsets){if(off>=S/2)continue;
    for(const pos of [off,S-1-off]){
      const row=new Uint8Array(S);for(let x=0;x<S;x++)row[x]=wGray[pos*S+x];results.push(scanLine2(row));
      const col=new Uint8Array(S);for(let y=0;y<S;y++)col[y]=wGray[y*S+pos];results.push(scanLine2(col));}}
  const votes=new Map();
  for(const r of results){if(r.contrast<40||r.T<3)continue;let T=r.T;if(T%2===0)T+=1;votes.set(T,(votes.get(T)||0)+1);}
  let bestT=0,bestV=0;for(const[t,v]of votes)if(v>bestV){bestV=v;bestT=t;}
  return bestT;
}
function zb_detectZebra(wGray,S,minContrast) {
  const resA=zb_verifyZebra(wGray,S,minContrast),tA=resA?resA.T:0;
  const tB=zb_countT(wGray,S);
  let T=0;
  if(tA>0&&tB>0)T=(resA.confidence>=0.5)?tA:tB;
  else if(tA>0)T=tA; else if(tB>0)T=tB;
  if(T<1)return null;
  return{T,modSize:S/T,confidence:resA?resA.confidence:0};
}

// ═══════════════════════════════════════════════════════
//  zb_localBinarize — локальна бінаризація варпу (4×4 зони)
// ═══════════════════════════════════════════════════════

function zb_localBinarize(warped, S) {
  const src = warped.data;
  const out = new ImageData(S, S);
  const od = out.data;
  const zones = 4;
  const zw = Math.floor(S / zones);
  const zh = Math.floor(S / zones);
  for (let az = 0; az < zones; az++) {
    for (let ax = 0; ax < zones; ax++) {
      let mn = 255, mx = 0;
      for (let dy = 0; dy < zh; dy++) for (let dx = 0; dx < zw; dx++) {
        const p = ((az*zh+dy)*S + (ax*zw+dx))*4;
        const v = (src[p]*77 + src[p+1]*150 + src[p+2]*29) >> 8;
        if (v < mn) mn = v; if (v > mx) mx = v;
      }
      const thr = (mn + mx) >> 1;
      for (let dy = 0; dy < zh; dy++) for (let dx = 0; dx < zw; dx++) {
        const p = ((az*zh+dy)*S + (ax*zw+dx))*4;
        const v = (src[p]*77 + src[p+1]*150 + src[p+2]*29) >> 8;
        const b = v < thr ? 0 : 255;
        od[p]=od[p+1]=od[p+2]=b; od[p+3]=255;
      }
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════
//  sampleCircles — ZEBRA v5.1 — не змінювати
// ═══════════════════════════════════════════════════════

function sampleCircles(warped,S,T,modSize) {
  const d=warped.data,circleR=modSize*0.28,r2=circleR*circleR,cells=[];
  for(let row=1;row<T-1;row++) for(let col=1;col<T-1;col++){
    const cx=col*modSize+modSize/2,cy=row*modSize+modSize/2;
    let sumR=0,sumG=0,sumB=0,cnt=0;
    const x0=Math.max(0,Math.floor(cx-circleR)),x1=Math.min(S-1,Math.ceil(cx+circleR));
    const y0=Math.max(0,Math.floor(cy-circleR)),y1=Math.min(S-1,Math.ceil(cy+circleR));
    for(let py=y0;py<=y1;py++) for(let px=x0;px<=x1;px++){
      const dx=px-cx,dy=py-cy;if(dx*dx+dy*dy>r2)continue;
      const idx=(py*S+px)*4;sumR+=d[idx];sumG+=d[idx+1];sumB+=d[idx+2];cnt++;}
    if(cnt===0){cells.push({r:0,g:0,b:0,row,col});continue;}
    cells.push({r:sumR/cnt,g:sumG/cnt,b:sumB/cnt,row,col});}
  return{cells,circleR};
}

// ═══════════════════════════════════════════════════════
//  TAINA-декодер — ZEBRA v5.1 — не змінювати
// ═══════════════════════════════════════════════════════

const ZB_RGB_MAIN={r:[255,0,0],g:[0,255,0],b:[0,0,255]};
const ZB_RGB_GAL={r:[220,50,60],g:[65,195,65],b:[60,70,215]};
const ZB_REFBITS=[[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,1,1]];
const _zb_enc=new TextEncoder();
const _zb_dec=new TextDecoder('utf-8',{fatal:true});

function zb_isClean(t){for(const ch of t){const o=ch.codePointAt(0);if(o===0)return false;if(o<32&&ch!=='\n'&&ch!=='\t')return false;}return true;}
function zb_bytesToText(by){by=by.slice();while(by.length&&by[by.length-1]===0)by.pop();if(!by.length)return null;try{const t=_zb_dec.decode(new Uint8Array(by));return zb_isClean(t)?t:null;}catch(e){return null;}}
function zb_textBits(t){const d=_zb_enc.encode(t),b=new Uint8Array(d.length*8);for(let i=0;i<d.length;i++)for(let k=0;k<8;k++)b[i*8+k]=(d[i]>>(7-k))&1;return b;}
function zb_Rof(n){return(n-1)/2;}
function zb_baseCells(m,n){
  const c=zb_Rof(n),o=[];
  if(m==='oct'){for(let i=0;i<=c;i++)for(let j=0;j<=i;j++)o.push([c+i,c+j]);}
  else if(m==='quad'){for(let i=0;i<=c;i++)for(let j=0;j<=c;j++)o.push([c+i,c+j]);}
  else{for(let y=0;y<n;y++)for(let i=0;i<=c;i++)o.push([c+i,y]);}
  return o;}
function zb_mirrors(m,n,x,y){
  const c=zb_Rof(n),i=x-c,j=y-c;let p;
  if(m==='oct')p=[[i,j],[j,i],[-i,j],[-j,i],[i,-j],[j,-i],[-i,-j],[-j,-i]];
  else if(m==='quad')p=[[i,j],[-i,j],[i,-j],[-i,-j]];
  else p=[[i,j],[-i,j]];
  const o=[];for(const[a,b]of p){const X=c+a,Y=c+b;if(X>=0&&Y>=0&&X<n&&Y<n)o.push([X,Y]);}
  return o;}
function zb_fillChannel(t,n,m,markBit){
  const g=new Uint8Array(n*n),bc=zb_baseCells(m,n);let seq=zb_textBits(t);
  if(markBit!==undefined&&markBit!==null){const s2=new Uint8Array(seq.length+1);s2[0]=markBit;s2.set(seq,1);seq=s2;}
  const lim=Math.min(seq.length,bc.length);
  for(let i=0;i<lim;i++){const[x,y]=bc[i];for(const[X,Y]of zb_mirrors(m,n,x,y))if(seq[i])g[Y*n+X]=1;}
  return g;}
function zb_markCell(g,n,m){const[x,y]=zb_baseCells(m,n)[0];return g[y*n+x]?1:0;}
function zb_agree(g,chk,n){let ok=0;for(let z=0;z<n*n;z++)ok+=((chk[z]?1:0)===g[z])?1:0;return ok/(n*n);}
function zb_decodeVoted(g,n,m,off,conf){
  const bc=zb_baseCells(m,n),by=[];
  for(let i=off||0;i+7<bc.length;i+=8){let v=0;
    for(let b=0;b<8;b++){const[x,y]=bc[i+b],cells=zb_mirrors(m,n,x,y);let bit;
      if(conf){let w1=0,w0=0;for(const[X,Y]of cells){const c=conf[Y*n+X];if(c<0.15)continue;if(g[Y*n+X])w1+=c;else w0+=c;}
        if(w1===0&&w0===0)bit=g[y*n+x]?1:0;else bit=w1>w0?1:0;}
      else{let ones=0;for(const[X,Y]of cells)ones+=g[Y*n+X]?1:0;const cnt=cells.length;
        if(ones*2>cnt)bit=1;else if(ones*2<cnt)bit=0;else bit=g[y*n+x]?1:0;}
      v=(v<<1)|bit;}
    by.push(v);}
  return{text:zb_bytesToText(by),bytes:by};}
function zb_refsFor(S){
  const mix=(r,g,b)=>[Math.min(255,(r?S.r[0]:0)+(g?S.g[0]:0)+(b?S.b[0]:0)),
    Math.min(255,(r?S.r[1]:0)+(g?S.g[1]:0)+(b?S.b[1]:0)),
    Math.min(255,(r?S.r[2]:0)+(g?S.g[2]:0)+(b?S.b[2]:0))];
  return ZB_REFBITS.map(c=>({bits:c,col:mix(c[0],c[1],c[2])}));}
function zb_classifyCells(cells,n){
  const pals=[['main',ZB_RGB_MAIN],['gallery',ZB_RGB_GAL]];let best=null;
  for(const[name,S]of pals){const refs=zb_refsFor(S);let err=0;
    const cr=new Uint8Array(n*n),cg=new Uint8Array(n*n),cb=new Uint8Array(n*n);
    for(let i=0;i<n*n;i++){const[R,G,B]=[cells[i].r,cells[i].g,cells[i].b];let bi=0,bd=1e9;
      for(let k=0;k<refs.length;k++){const q=refs[k].col,dr=R-q[0],dg=G-q[1],db=B-q[2],d=dr*dr+dg*dg+db*db;if(d<bd){bd=d;bi=k;}}
      err+=bd;const t=refs[bi].bits;cr[i]=t[0];cg[i]=t[1];cb[i]=t[2];}
    if(!best||err<best.err)best={name,err,cr,cg,cb};}
  return best;}
function zb_symScore(gl,n){
  const seen=new Set(),groups=[],c=(n-1)/2;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=x-c,j=y-c;
    const p=[[i,j],[j,i],[-i,j],[-j,i],[i,-j],[j,-i],[-i,-j],[-j,-i]],g=[];
    for(const[a,b]of p){const X=c+a,Y=c+b;if(X>=0&&Y>=0&&X<n&&Y<n)g.push([X,Y]);}
    const key=g.map(q=>q[0]+','+q[1]).sort().join(';');
    if(seen.has(key))continue;seen.add(key);groups.push(g);}
  let tot=0,ok=0;
  for(const g of groups){let s=0;for(const[X,Y]of g)s+=gl[Y*n+X];
    const maj=s*2>g.length?1:0;tot+=g.length;for(const[X,Y]of g)ok+=(gl[Y*n+X]===maj)?1:0;}
  return{frac:ok/tot,ok,tot};}

// ── decodeCircles — ZEBRA v5.1 — не змінювати ──
function decodeCircles(circles,T){
  const cells=circles.cells,n=T-2;
  if(n<7||n%2===0)return null;
  const lumas=cells.map(c=>(c.r+c.g+c.b)/3);
  const lumaMin=Math.min(...lumas),lumaMax=Math.max(...lumas),autoThr=(lumaMin+lumaMax)/2;
  const gl=new Uint8Array(n*n),confMono=new Float32Array(n*n);
  cells.forEach((c,i)=>{const L=(c.r+c.g+c.b)/3;gl[i]=L>autoThr?1:0;confMono[i]=Math.min(1,Math.abs(L-autoThr)/(autoThr/2+1));});
  const sats=cells.map(c=>Math.max(c.r,c.g,c.b)-Math.min(c.r,c.g,c.b));
  const medSat=[...sats].sort((a,b)=>a-b)[sats.length>>1];
  const coloredCount=sats.filter(s=>s>60).length;
  const isColored=medSat>25||coloredCount>=Math.max(3,n*0.15);
  const modes=['oct','quad','half'];
  if(!isColored){
    let best=null;
    for(const m of modes){const v=zb_decodeVoted(gl,n,m,0,confMono);
      if(v.text!==null){const a=zb_agree(gl,zb_fillChannel(v.text,n,m,null),n);if(!best||a>best.a)best={v,a,m};}}
    if(!best)return null;
    return{kind:'one',mode:best.m,n,res:[best.v.text,null,null]};
  }else{
    const cls=zb_classifyCells(cells,n);
    const confR=new Float32Array(n*n),confG=new Float32Array(n*n),confB=new Float32Array(n*n);
    cells.forEach((c,i)=>{confR[i]=Math.min(1,Math.abs(c.r-128)/90);confG[i]=Math.min(1,Math.abs(c.g-128)/90);confB[i]=Math.min(1,Math.abs(c.b-128)/90);});
    let best=null;
    for(const m of modes){
      const rMark=zb_markCell(cls.cr,n,m);
      let vr=zb_decodeVoted(cls.cr,n,m,rMark?1:0,confR);
      if(rMark&&vr.text===null)vr=zb_decodeVoted(cls.cr,n,m,0,confR);
      const vg=zb_decodeVoted(cls.cg,n,m,0,confG),vb=zb_decodeVoted(cls.cb,n,m,0,confB);
      const nn=[vr.text,vg.text,vb.text].filter(t=>t!==null);if(!nn.length)continue;
      const sc=nn.length*1000+nn.reduce((a,t)=>a+t.length,0);
      if(!best||sc>best.sc)best={vr,vg,vb,nn,sc,m,rMark};}
    if(!best)return null;
    const allSame=best.nn.every(t=>t===best.nn[0]);
    const kind=best.rMark&&allSame?'mono':'three';
    return{kind,mode:best.m,n,res:[best.vr.text,best.vg.text,best.vb.text]};}
}

// ═══════════════════════════════════════════════════════
//  Глобали для index.html
// ═══════════════════════════════════════════════════════

function baseCells(m,n){return zb_baseCells(m,n);}
function mirrors(m,n,x,y){return zb_mirrors(m,n,x,y);}
function fillChannel(t,n,m,markBit){
  const g=zb_fillChannel(t,n,m,markBit),dm=new Uint8Array(n*n),bc=zb_baseCells(m,n);
  let seq=zb_textBits(t);
  if(markBit!==null&&markBit!==undefined){const s2=new Uint8Array(seq.length+1);s2[0]=markBit;s2.set(seq,1);seq=s2;}
  const lim=Math.min(seq.length,bc.length);
  for(let i=0;i<lim;i++){const[x,y]=bc[i];for(const[X,Y]of zb_mirrors(m,n,x,y))dm[Y*n+X]=1;}
  return{g,dm};}
function markCell(g,n,m){return zb_markCell(g,n,m);}
function bytesToText(by){return zb_bytesToText(by);}
function decodeSector(g,n,m,offset){return zb_decodeVoted(g,n,m,offset,null).text;}

// ═══════════════════════════════════════════════════════
//  ZEBRA PIPELINE — знаходить зебру
// ═══════════════════════════════════════════════════════

function zb_findZebra(idata,w,h){
  const gray=zb_toGray(idata,w,h),bg=zb_sampleBG(gray,w,h,5);
  const tols=[20,30,42,55,70,90];let bestCorners=null,bestSpread=0;
  for(const tol of tols){
    const rm=zb_makeMask(gray,w,h,bg,tol),em=zb_erodeMask(rm,w,h);
    const fgN=em.reduce((s,v)=>s+v,0);if(fgN<50)continue;
    const c=zb_findCorners(em,w,h,15),sp=zb_spread(c);
    if(sp>bestSpread){bestSpread=sp;bestCorners=c;}}
  if(!bestCorners||bestSpread<30){
    const topRows=[],leftCols=[];
    for(let y=0;y<h;y++){let sum=0,sum2=0;for(let x=0;x<w;x++){const v=gray[y*w+x];sum+=v;sum2+=v*v;}const avg=sum/w,std=Math.sqrt(sum2/w-avg*avg);if(std>50)topRows.push(y);}
    for(let x=0;x<w;x++){let sum=0,sum2=0;for(let y=0;y<h;y++){const v=gray[y*w+x];sum+=v;sum2+=v*v;}const avg=sum/h,std=Math.sqrt(sum2/h-avg*avg);if(std>50)leftCols.push(x);}
    topRows.sort((a,b)=>a-b);leftCols.sort((a,b)=>a-b);
    if(topRows.length>0&&leftCols.length>0){
      const vc={tl:{x:leftCols[0],y:topRows[0]},tr:{x:leftCols[leftCols.length-1],y:topRows[0]},
                br:{x:leftCols[leftCols.length-1],y:topRows[topRows.length-1]},bl:{x:leftCols[0],y:topRows[topRows.length-1]}};
      const vsp=zb_spread(vc);if(vsp>bestSpread){bestCorners=vc;bestSpread=vsp;}}}
  if(!bestCorners||bestSpread<20)return null;
  const expand=6;
  const corners={tl:{x:bestCorners.tl.x-expand,y:bestCorners.tl.y-expand},tr:{x:bestCorners.tr.x+expand,y:bestCorners.tr.y-expand},
                 br:{x:bestCorners.br.x+expand,y:bestCorners.br.y+expand},bl:{x:bestCorners.bl.x-expand,y:bestCorners.bl.y+expand}};
  const S=600,warped=zb_warpPerspective(idata,w,h,corners,S);if(!warped)return null;
  const wGray=zb_toGray(warped,S,S),zebra=zb_detectZebra(wGray,S,50);if(!zebra)return null;
  const circles=sampleCircles(zb_localBinarize(warped,S),S,zebra.T,zebra.modSize);
  return{zebra,circles};}

// ═══════════════════════════════════════════════════════
//  FALLBACK — старий decoder.js (шляхи 1,3,4,5)
//  Не змінювати логіку, тільки використовуємо як резерв
// ═══════════════════════════════════════════════════════

const VOTE_MARGIN=0.5,VOTE_AGREE=0.90;
const ND_PAL2={r:[220,50,60],g:[65,195,65],b:[60,70,215]};
const ND_REFBITS=[[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,1,1]];
const ND_SOFT=0.90,ND_SAT=60,ND_VMARGIN=0.5;

function nd_med(a){const b=[...a].sort((x,y)=>x-y);return b[b.length>>1];}
function nd_runsLine(get,len){let prev=-1,l=0,R=[];for(let i=0;i<len;i++){const c=get(i)>127?1:0;if(c===prev)l++;else{if(prev>=0)R.push(l);prev=c;l=1;}}R.push(l);return R;}
function nd_agree(g,chk,n){let ok=0;for(let z=0;z<n*n;z++)ok+=((chk[z]?1:0)===g[z])?1:0;return ok/(n*n);}
function nd_refsFor(S){const mix=(r,g,b)=>[Math.min(255,(r?S.r[0]:0)+(g?S.g[0]:0)+(b?S.b[0]:0)),Math.min(255,(r?S.r[1]:0)+(g?S.g[1]:0)+(b?S.b[1]:0)),Math.min(255,(r?S.r[2]:0)+(g?S.g[2]:0)+(b?S.b[2]:0))];return ND_REFBITS.map(c=>({bits:c,col:mix(c[0],c[1],c[2])}));}

function decodeVoted(g,n,m,offset){
  const bc=baseCells(m,n),by=[],margins=[];const start=offset||0;
  for(let i=start;i+7<bc.length;i+=8){let v=0;
    for(let b=0;b<8;b++){const[x,y]=bc[i+b];const cells=mirrors(m,n,x,y);
      let ones=0;for(const[X,Y]of cells)ones+=g[Y*n+X]?1:0;const cnt=cells.length;
      let bit;if(ones*2>cnt)bit=1;else if(ones*2<cnt)bit=0;else bit=g[y*n+x]?1:0;
      margins.push(Math.abs(2*ones-cnt)/cnt);v=(v<<1)|bit;}
    by.push(v);}
  return{text:bytesToText(by),minMargin:margins.length?Math.min(...margins):0};}

function recoverVoted(g,n,m,offset,markBit){
  const v=decodeVoted(g,n,m,offset);if(v.text===null||v.minMargin<VOTE_MARGIN)return null;
  const chk=fillChannel(v.text,n,m,markBit);let tot=0,match=0;
  for(let i=0;i<n*n;i++)if(chk.dm[i]){tot++;if((chk.g[i]?1:0)===g[i])match++;}
  if(!tot||match/tot<VOTE_AGREE)return null;
  const s=decodeSector(g,n,m,offset);if(s!==null&&s!==v.text)return null;
  return{text:v.text,agree:match/tot};}

function ruler_runs(get,len){let prev=-1,l=0,runs=[];for(let i=0;i<len;i++){const c=get(i)>127?1:0;if(c===prev)l++;else{if(prev>=0)runs.push(l);prev=c;l=1;}}runs.push(l);return runs;}
function ruler_median(a){const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)];}
function ruler_score(runs){if(runs.length<5)return null;const m=ruler_median(runs);if(m<3)return null;let reg=0;for(const r of runs)if(r>=m*0.55&&r<=m*1.45)reg++;return{m,frac:reg/runs.length,count:runs.length};}
function ruler_edge(lumFn,W,depth){const rows=[];for(let y=1;y<depth;y++){const s=ruler_score(ruler_runs(x=>lumFn(x,y),W));if(s&&s.frac>=0.85&&s.count>=7&&s.count<=200&&s.m>=4)rows.push(s);}if(rows.length<2)return null;const freq=new Map();for(const r of rows)freq.set(r.count,(freq.get(r.count)||0)+1);let T=null,fb=0;for(const[k,v]of freq)if(v>fb){fb=v;T=k;}return{T,cell:ruler_median(rows.filter(r=>r.count===T).map(r=>r.m)),votes:fb};}
function findRuler(px,IW,IH){if(IW!==IH)return null;const lum=(x,y)=>{const p=(y*IW+x)*4;return(px[p]+px[p+1]+px[p+2])/3;};const depth=Math.max(20,Math.floor(IW*0.09));const edges=[ruler_edge((x,y)=>lum(x,y),IW,depth),ruler_edge((x,y)=>lum(x,IH-1-y),IW,depth),ruler_edge((x,y)=>lum(y,x),IW,depth),ruler_edge((x,y)=>lum(IW-1-y,x),IW,depth)].filter(Boolean);if(!edges.length)return null;const freq=new Map();for(const e of edges)freq.set(e.T,(freq.get(e.T)||0)+e.votes);let T=null,fb=0;for(const[k,v]of freq)if(v>fb){fb=v;T=k;}return{T,cell:ruler_median(edges.filter(e=>e.T===T).map(e=>e.cell)),edges:edges.length};}

function findOrnament(px,IW,IH){
  const lum=p=>(px[p]+px[p+1]+px[p+2])/3;
  const rowAct=new Array(IH).fill(0),colAct=new Array(IW).fill(0);
  for(let y=0;y<IH;y++){let prev=-1,tr=0;for(let x=0;x<IW;x+=2){const cc=lum((y*IW+x)*4)>127?1:0;if(cc!==prev){tr++;prev=cc;}}rowAct[y]=tr;}
  for(let x=0;x<IW;x++){let prev=-1,tr=0;for(let y=0;y<IH;y+=2){const cc=lum((y*IW+x)*4)>127?1:0;if(cc!==prev){tr++;prev=cc;}}colAct[x]=tr;}
  const maxRow=Math.max(...rowAct),maxCol=Math.max(...colAct);
  const rowThr=Math.max(4,maxRow*0.25),colThr=Math.max(4,maxCol*0.25);
  function longestBlock(act,thr){let bestS=0,bestE=-1,curS=-1,gap=0;const maxGap=Math.max(8,act.length*0.03);
    for(let i=0;i<act.length;i++){if(act[i]>=thr){if(curS<0)curS=i;gap=0;if(i-curS>bestE-bestS){bestS=curS;bestE=i;}}else{if(curS>=0){gap++;if(gap>maxGap){curS=-1;gap=0;}}}}return[bestS,bestE];}
  let[y0,y1]=longestBlock(rowAct,rowThr),[x0,x1]=longestBlock(colAct,colThr);
  if(y1<=y0||x1<=x0)return null;
  const side=Math.max(x1-x0,y1-y0),cx=(x0+x1)/2,cy=(y0+y1)/2;
  let nx0=Math.max(0,Math.round(cx-side/2)),ny0=Math.max(0,Math.round(cy-side/2));
  let nx1=Math.min(IW,nx0+side),ny1=Math.min(IH,ny0+side);
  const cropW=nx1-nx0,cropH=ny1-ny0;if(cropW<20||cropH<20)return null;
  return{x0:nx0,y0:ny0,w:cropW,h:cropH};}

function cropPx(px,IW,IH,box){
  const{x0,y0,w,h}=box;const out=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const src=((y0+y)*IW+(x0+x))*4,dst=(y*w+x)*4;out[dst]=px[src];out[dst+1]=px[src+1];out[dst+2]=px[src+2];out[dst+3]=255;}
  return out;}

function findCodeBox(px,IW,IH){
  const GX=120,GY=Math.max(20,Math.round(120*IH/IW));const cw=IW/GX,ch=IH/GY;
  const avg=new Float64Array(GX*GY*3);
  for(let gy=0;gy<GY;gy++)for(let gx=0;gx<GX;gx++){let r=0,g=0,b=0,cnt=0;const x0=Math.floor(gx*cw),x1=Math.floor((gx+1)*cw),y0=Math.floor(gy*ch),y1=Math.floor((gy+1)*ch);for(let y=y0;y<y1;y+=2)for(let x=x0;x<x1;x+=2){const p=(y*IW+x)*4;r+=px[p];g+=px[p+1];b+=px[p+2];cnt++;}const i=(gy*GX+gx)*3;avg[i]=cnt?r/cnt:0;avg[i+1]=cnt?g/cnt:0;avg[i+2]=cnt?b/cnt:0;}
  const edge=[];for(let gx=0;gx<GX;gx++){edge.push([gx,0]);edge.push([gx,GY-1]);}for(let gy=0;gy<GY;gy++){edge.push([0,gy]);edge.push([GX-1,gy]);}
  const compMed=k=>{const a=edge.map(([gx,gy])=>avg[(gy*GX+gx)*3+k]).sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};
  const bg=[compMed(0),compMed(1),compMed(2)];const fg=new Uint8Array(GX*GY);
  for(let i=0;i<GX*GY;i++){const dr=avg[i*3]-bg[0],dg=avg[i*3+1]-bg[1],db=avg[i*3+2]-bg[2];if(Math.sqrt(dr*dr+dg*dg+db*db)>55)fg[i]=1;}
  const lab=new Int32Array(GX*GY);let cur=0,best=0,bestBox=null;const stack=[];
  for(let s=0;s<GX*GY;s++){if(!fg[s]||lab[s])continue;cur++;let cnt=0,minx=GX,miny=GY,maxx=0,maxy=0;stack.push(s);lab[s]=cur;
    while(stack.length){const p=stack.pop();const gx=p%GX,gy=(p/GX)|0;cnt++;if(gx<minx)minx=gx;if(gx>maxx)maxx=gx;if(gy<miny)miny=gy;if(gy>maxy)maxy=gy;const gxs=[gx-1,gx+1,gx,gx],gys=[gy,gy,gy-1,gy+1];for(let k=0;k<4;k++){const nx=gxs[k],ny=gys[k];if(nx<0||ny<0||nx>=GX||ny>=GY)continue;const q=ny*GX+nx;if(fg[q]&&!lab[q]){lab[q]=cur;stack.push(q);}}}
    if(cnt>best){best=cnt;bestBox=[minx,miny,maxx,maxy];}}
  if(!bestBox)return null;
  let x0=Math.floor(bestBox[0]*cw),y0=Math.floor(bestBox[1]*ch),x1=Math.ceil((bestBox[2]+1)*cw),y1=Math.ceil((bestBox[3]+1)*ch);
  const padX=cw*0.5,padY=ch*0.5;x0=Math.max(0,Math.floor(x0-padX));y0=Math.max(0,Math.floor(y0-padY));x1=Math.min(IW,Math.ceil(x1+padX));y1=Math.min(IH,Math.ceil(y1+padY));
  return{x0,y0,w:x1-x0,h:y1-y0};}

function gradCorners(px,IW,IH,G){
  const lum=p=>(px[p*4]+px[p*4+1]+px[p*4+2])/3;const cw=IW/G,ch=IH/G;const gr=new Float64Array(G*G);
  for(let gy=0;gy<G;gy++)for(let gx=0;gx<G;gx++){let s=0,c=0;const x0=Math.floor(gx*cw),x1=Math.floor((gx+1)*cw),y0=Math.floor(gy*ch),y1=Math.floor((gy+1)*ch);for(let y=y0+1;y<y1-1;y+=2)for(let x=x0+1;x<x1-1;x+=2){const gxv=Math.abs(lum(y*IW+x+1)-lum(y*IW+x-1)),gyv=Math.abs(lum((y+1)*IW+x)-lum((y-1)*IW+x));s+=gxv+gyv;c++;}gr[gy*G+gx]=c?s/c:0;}
  const mx=Math.max(...gr),thr=mx*0.18;const fg=gr.map(v=>v>=thr?1:0);const dil=new Uint8Array(G*G);
  for(let gy=0;gy<G;gy++)for(let gx=0;gx<G;gx++){let any=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=gx+dx,ny=gy+dy;if(nx>=0&&ny>=0&&nx<G&&ny<G&&fg[ny*G+nx])any=1;}dil[gy*G+gx]=any;}
  const lab=new Int32Array(G*G);let cur=0,best=0,bestPts=null;const st=[];
  for(let s=0;s<G*G;s++){if(!dil[s]||lab[s])continue;cur++;const pts=[];st.push(s);lab[s]=cur;
    while(st.length){const p=st.pop();pts.push(p);const gx=p%G,gy=(p/G)|0;for(const[nx,ny]of[[gx-1,gy],[gx+1,gy],[gx,gy-1],[gx,gy+1]]){if(nx<0||ny<0||nx>=G||ny>=G)continue;const q=ny*G+nx;if(dil[q]&&!lab[q]){lab[q]=cur;st.push(q);}}}
    if(pts.length>best){best=pts.length;bestPts=pts;}}
  if(!bestPts||best<8)return null;
  let TL,TR,BR,BL;
  for(const p of bestPts){const gx=p%G,gy=(p/G)|0;const X=(gx+0.5)*cw,Y=(gy+0.5)*ch;const s=X+Y,d=X-Y;if(!TL||s<TL.s)TL={X,Y,s};if(!BR||s>BR.s)BR={X,Y,s};if(!TR||d>TR.d)TR={X,Y,d};if(!BL||d<BL.d)BL={X,Y,d};}
  const dd=(a,b)=>Math.hypot(a.X-b.X,a.Y-b.Y);const side=(dd(TL,TR)+dd(TR,BR)+dd(BR,BL)+dd(BL,TL))/4;
  return{TL:[TL.X,TL.Y],TR:[TR.X,TR.Y],BR:[BR.X,BR.Y],BL:[BL.X,BL.Y],side};}

function v13_solveLS8(A,b){const n=8,M=A.map((row,i)=>[...row,b[i]]);for(let col=0;col<n;col++){let maxRow=col;for(let r=col+1;r<n;r++)if(Math.abs(M[r][col])>Math.abs(M[maxRow][col]))maxRow=r;[M[col],M[maxRow]]=[M[maxRow],M[col]];for(let r=0;r<n;r++)if(r!==col){const f=M[r][col]/M[col][col];for(let c=col;c<=n;c++)M[r][c]-=f*M[col][c];}}return M.map((row,i)=>row[n]/row[i]);}
function v13_computeH(cor,N){const pts=[cor.TL,cor.TR,cor.BR,cor.BL],dst=[[0,0],[N,0],[N,N],[0,N]],A=[],b=[];for(let i=0;i<4;i++){const[x,y]=pts[i],[u,v]=dst[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);}const h=v13_solveLS8(A,b);return[[h[0],h[1],h[2]],[h[3],h[4],h[5]],[h[6],h[7],1]];}
function v13_invertH(H){const[a,b,c]=[H[0][0],H[0][1],H[0][2]],[d,e,f]=[H[1][0],H[1][1],H[1][2]],[g,h,k]=[H[2][0],H[2][1],H[2][2]];const det=a*(e*k-f*h)-b*(d*k-f*g)+c*(d*h-e*g);if(Math.abs(det)<1e-12)return null;return[[(e*k-f*h)/det,(c*h-b*k)/det,(b*f-c*e)/det],[(f*g-d*k)/det,(a*k-c*g)/det,(c*d-a*f)/det],[(d*h-e*g)/det,(b*g-a*h)/det,(a*e-b*d)/det]];}
function deskew(px,IW,IH,corners,N){const Hm=v13_computeH(corners,N),Hi=v13_invertH(Hm);if(!Hi)return new Uint8ClampedArray(N*N*4);const out=new Uint8ClampedArray(N*N*4);for(let dy=0;dy<N;dy++)for(let dx=0;dx<N;dx++){let sx=Hi[0][0]*(dx+.5)+Hi[0][1]*(dy+.5)+Hi[0][2];let sy=Hi[1][0]*(dx+.5)+Hi[1][1]*(dy+.5)+Hi[1][2];let sw=Hi[2][0]*(dx+.5)+Hi[2][1]*(dy+.5)+Hi[2][2];sx/=sw;sy/=sw;const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(IW-1,x0+1),y1=Math.min(IH-1,y0+1);const fx=sx-x0,fy=sy-y0,o=(dy*N+dx)*4;if(x0<0||y0<0||x0>=IW||y0>=IH){out[o+3]=255;continue;}const p00=(y0*IW+x0)*4,p10=(y0*IW+x1)*4,p01=(y1*IW+x0)*4,p11=(y1*IW+x1)*4;for(let c=0;c<3;c++)out[o+c]=px[p00+c]*(1-fx)*(1-fy)+px[p10+c]*fx*(1-fy)+px[p01+c]*(1-fx)*fy+px[p11+c]*fx*fy;out[o+3]=255;}return out;}

function nd_measureTf(px,IW,IH){
  const lum=(x,y)=>{const p=(y*IW+x)*4;return(px[p]+px[p+1]+px[p+2])/3;};const dep=Math.floor(IW*0.18);
  const edge=(get,span)=>{const cand=[];for(let i=Math.floor(dep*0.02);i<dep;i++){const rs=nd_runsLine(k=>get(k,i),span).filter(v=>v>=2);if(rs.length<8)continue;const m=nd_med(rs);let reg=0;for(const r of rs)if(r>=m*0.55&&r<=m*1.45)reg++;if(reg/rs.length>=0.8)cand.push(m);}return cand.length?nd_med(cand):null;};
  const mods=[edge((k,i)=>lum(k,i),IW),edge((k,i)=>lum(k,IH-1-i),IW),edge((k,i)=>lum(i,k),IH),edge((k,i)=>lum(IW-1-i,k),IW)].filter(v=>v);
  if(mods.length>=2)return Math.round(IW/nd_med(mods));
  try{const ru=findRuler(px,IW,IH);if(ru)return Math.round(IW/ru.cell);}catch(e){}
  return null;}

function nd_classify(rawR,rawG,rawB,n){
  let best=null;
  for(const S of [RGB_SOFT,ND_PAL2]){const refs=nd_refsFor(S);let err=0;const cr=new Uint8Array(n*n),cg=new Uint8Array(n*n),cb=new Uint8Array(n*n);for(let i=0;i<n*n;i++){const R=rawR[i],G=rawG[i],B=rawB[i];let bi=0,bd=1e9;for(let k=0;k<refs.length;k++){const q=refs[k].col;const dr=R-q[0],dg=G-q[1],db=B-q[2],d=dr*dr+dg*dg+db*db;if(d<bd){bd=d;bi=k;}}err+=bd;const t=refs[bi].bits;cr[i]=t[0];cg[i]=t[1];cb[i]=t[2];}if(!best||err<best.err)best={err,cr,cg,cb};}
  return best;}

function nd_decodeAt(px,IW,IH,cell,ox,oy,pad,Tf){
  const n=Tf-2*pad;if(n<7||n%2===0)return[];
  const gl=new Uint8Array(n*n),rawR=new Uint8Array(n*n),rawG=new Uint8Array(n*n),rawB=new Uint8Array(n*n);let colored=0;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const dx=(x===0?0.7:(x===n-1?0.3:0.5)),dy=(y===0?0.7:(y===n-1?0.3:0.5));const X=Math.min(IW-1,Math.max(0,Math.round((x+pad+dx)*cell+ox)));const Y=Math.min(IH-1,Math.max(0,Math.round((y+pad+dy)*cell+oy)));const p=(Y*IW+X)*4,r=px[p],g=px[p+1],b=px[p+2],i=y*n+x;gl[i]=((r+g+b)/3)>110?1:0;rawR[i]=r;rawG[i]=g;rawB[i]=b;if(Math.max(r,g,b)-Math.min(r,g,b)>ND_SAT)colored++;}
  const out=[],modes=['oct','quad','half'];
  if(!colored){for(const m of modes){const v=decodeVoted(gl,n,m,0);if(v.text!==null&&v.minMargin>=ND_VMARGIN){const a=nd_agree(gl,fillChannel(v.text,n,m,null).g,n);if(a>=ND_SOFT)out.push({kind:'one',score:a,mode:m,n,res:[v.text,null,null]});}}return out;}
  const cls=nd_classify(rawR,rawG,rawB,n);
  for(const m of modes){
    const vr=decodeVoted(cls.cr,n,m,0),vg=decodeVoted(cls.cg,n,m,0),vb=decodeVoted(cls.cb,n,m,0);
    const ne=[vr.text,vg.text,vb.text].filter(t=>t!==null);
    if(ne.length>=2&&!ne.every(t=>t===ne[0])){const aR=nd_agree(cls.cr,fillChannel(vr.text||'',n,m,null).g,n);const aG=nd_agree(cls.cg,fillChannel(vg.text||'',n,m,null).g,n);const aB=nd_agree(cls.cb,fillChannel(vb.text||'',n,m,null).g,n);const sc=Math.min(aR,aG,aB);if(sc>=ND_SOFT)out.push({kind:'three',score:sc,mode:m,n,res:[vr.text,vg.text,vb.text]});}
    if(markCell(cls.cr,n,m)===1){const rR=decodeVoted(cls.cr,n,m,1);if(rR.text!==null){const rG=decodeVoted(cls.cg,n,m,0),rB=decodeVoted(cls.cb,n,m,0);const aR=nd_agree(cls.cr,fillChannel(rR.text,n,m,1).g,n);const aG=nd_agree(cls.cg,fillChannel(rG.text||'',n,m,null).g,n);const aB=nd_agree(cls.cb,fillChannel(rB.text||'',n,m,null).g,n);if(Math.min(aR,aG,aB)>=ND_SOFT)out.push({kind:'three',score:Math.min(aR,aG,aB),mode:m,n,res:[rR.text||'',rG.text||'',rB.text||'']});}}}
  return out;}

function decodeNewFrame(px,IW,IH){
  if(IW!==IH)return[];const Tf=nd_measureTf(px,IW,IH);if(!Tf)return[];
  const base=IW/Tf;let cand=[];
  const solid=list=>list.some(r=>(r.kind==='one'||r.kind==='three')&&r.score>=ND_SOFT);
  const finish=list=>{if(!list.length)return[];const seen=new Set(),u=[];for(const r of list){const k=r.kind+'|'+r.res.join('\u0001');if(!seen.has(k)){seen.add(k);u.push(r);}}u.sort((a,b)=>{const al=a.res.filter(x=>x).join('').length,bl=b.res.filter(x=>x).join('').length;if(a.kind!==b.kind)return(a.kind==='three'?0:1)-(b.kind==='three'?0:1);if(bl!==al)return bl-al;return b.score-a.score;});return u;};
  for(const pad of[3,2,4])cand=cand.concat(nd_decodeAt(px,IW,IH,base,0,0,pad,Tf));
  if(solid(cand))return finish(cand);
  for(const pad of[2,3,4]){for(const sf of[1.0,0.994,0.997,1.003,1.006,0.991,1.009,0.988,1.012]){const cell=base*sf;for(let ox=-cell*0.4;ox<=cell*0.4+1e-6;ox+=cell*0.13)for(let oy=-cell*0.4;oy<=cell*0.4+1e-6;oy+=cell*0.13)cand=cand.concat(nd_decodeAt(px,IW,IH,cell,ox,oy,pad,Tf));}if(solid(cand))return finish(cand);}
  return finish(cand);}

function buildBuffer(img){
  const iw=img.naturalWidth||img.width||0,ih=img.naturalHeight||img.height||0;if(iw<1||ih<1)return null;
  const AS=Math.max(512,Math.min(1500,Math.max(iw,ih)));const cc=document.createElement('canvas');cc.width=AS;cc.height=AS;
  const g=cc.getContext('2d',{willReadFrequently:true});const tmp=document.createElement('canvas');tmp.width=iw;tmp.height=ih;
  const tg=tmp.getContext('2d',{willReadFrequently:true});tg.drawImage(img,0,0,iw,ih);
  const cp=tg.getImageData(0,0,1,1).data;g.fillStyle='rgb('+cp[0]+','+cp[1]+','+cp[2]+')';g.fillRect(0,0,AS,AS);
  const scale=Math.min(AS/iw,AS/ih),w=iw*scale,h=ih*scale;g.imageSmoothingEnabled=true;g.drawImage(img,(AS-w)/2,(AS-h)/2,w,h);
  return{px:g.getImageData(0,0,AS,AS).data,IW:AS,IH:AS};}

function dedup(all){
  if(!all.length)return[];const seen=new Set(),u=[];
  for(const r of all){const k=(r.kind||'')+'|'+r.res.join('\u0001');if(!seen.has(k)){seen.add(k);u.push(r);}}
  u.sort((a,b)=>b.res.filter(x=>x).join('').length-a.res.filter(x=>x).join('').length);
  return u;}

// ═══════════════════════════════════════════════════════
//  runDecodeAttempts — публічний API
//  1. Спочатку zb_findZebra (ZEBRA v5.1)
//  2. Якщо не спрацювало — fallback шляхи 1,3,4,5
// ═══════════════════════════════════════════════════════

function runDecodeAttempts(imgOrCanvas){
  const isCanvas=(typeof HTMLCanvasElement!=='undefined')&&(imgOrCanvas instanceof HTMLCanvasElement);

  // Будуємо пікселі
  let px,IW,IH,srcCanvas;
  if(isCanvas){
    const iw=imgOrCanvas.width||0,ih=imgOrCanvas.height||0;if(iw<1||ih<1)return[];
    const scale=Math.min(1,800/Math.max(iw,ih));
    const W=Math.round(iw*scale),H=Math.round(ih*scale);
    srcCanvas=document.createElement('canvas');srcCanvas.width=W;srcCanvas.height=H;
    srcCanvas.getContext('2d',{willReadFrequently:true}).drawImage(imgOrCanvas,0,0,iw,ih,0,0,W,H);
    px=srcCanvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data;IW=W;IH=H;
  }else{
    const buf=buildBuffer(imgOrCanvas);if(!buf)return[];
    px=buf.px;IW=buf.IW;IH=buf.IH;
    srcCanvas=document.createElement('canvas');srcCanvas.width=IW;srcCanvas.height=IH;
    srcCanvas.getContext('2d',{willReadFrequently:true}).putImageData(new ImageData(new Uint8ClampedArray(px),IW,IH),0,0);}

  // ── 1. ZEBRA v5.1 — головний шлях ──
  try{
    const ctx=srcCanvas.getContext('2d',{willReadFrequently:true});
    const idata=ctx.getImageData(0,0,IW,IH);
    const found=zb_findZebra(idata,IW,IH);
    if(found){
      const decoded=decodeCircles(found.circles,found.zebra.T);
      if(decoded){
        const res=[decoded.res[0]||null,decoded.res[1]||null,decoded.res[2]||null];
        return[{kind:decoded.kind,mode:decoded.mode,n:decoded.n,res}];
      }
    }
  }catch(e){}

  // ── 2. FALLBACK: шляхи 1,3,4,5 зі старого decoder ──
  let all=[];
  const pickSolid=list=>list.find(r=>r.kind==='one'||r.kind==='three');
  const hasSolid=()=>all.some(r=>r.kind==='one'||r.kind==='three');

  // Шлях 1: decodeNewFrame на квадратному кропі
  try{
    const side=Math.min(IW,IH);
    const c=cropPx(px,IW,IH,{x0:Math.floor((IW-side)/2),y0:Math.floor((IH-side)/2),w:side,h:side});
    const r=decodeNewFrame(c,side,side);
    if(r.length){all=all.concat(r);const sd=pickSolid(all);if(sd)return[sd];}
  }catch(e){}

  // Шлях 3: findCodeBox → decodeNewFrame
  try{
    const box=findCodeBox(px,IW,IH);
    if(box){
      const side=Math.max(box.w,box.h),cx=box.x0+box.w/2,cy=box.y0+box.h/2;
      for(const exp of[1.0,1.12,1.20]){
        const s=Math.round(side*exp);const nx=Math.max(0,Math.round(cx-s/2)),ny=Math.max(0,Math.round(cy-s/2));
        const ss=Math.min(s,IW-nx,IH-ny);if(ss<40)continue;
        const c=cropPx(px,IW,IH,{x0:nx,y0:ny,w:ss,h:ss});
        const r=decodeNewFrame(c,ss,ss);
        if(r.length){all=all.concat(r);const sd=pickSolid(all);if(sd)return[sd];}}
  }}catch(e){}

  // Шлях 4: findOrnament → decodeNewFrame
  try{
    const box=findOrnament(px,IW,IH);
    if(box&&box.w>=40&&box.h>=40){
      const cpx=cropPx(px,IW,IH,box);const r=decodeNewFrame(cpx,box.w,box.h);
      if(r.length){all=all.concat(r);if(hasSolid())return dedup(all);}}
  }catch(e){}

  // Шлях 5: gradCorners → deskew → decodeNewFrame
  try{
    const cor=gradCorners(px,IW,IH,120);
    if(cor){
      const cx=(cor.TL[0]+cor.TR[0]+cor.BR[0]+cor.BL[0])/4,cy=(cor.TL[1]+cor.TR[1]+cor.BR[1]+cor.BL[1])/4;
      for(const ef of[1.0,1.03,1.06,0.98]){
        const ex=c=>[cx+(c[0]-cx)*ef,cy+(c[1]-cy)*ef];
        const cc={TL:ex(cor.TL),TR:ex(cor.TR),BR:ex(cor.BR),BL:ex(cor.BL)};
        const N=Math.max(256,Math.min(1200,Math.round(cor.side*ef)));
        const d=deskew(px,IW,IH,cc,N);const r=decodeNewFrame(d,N,N);
        if(r.length){all=all.concat(r);const sd=pickSolid(all);if(sd)return[sd];}}}
  }catch(e){}

  if(hasSolid())return dedup(all);
  return dedup(all);
}
