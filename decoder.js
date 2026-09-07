// decoder.js · taina · zebra-based decoder
// Пайплайн пошуку зебри: ZEBRA FINDER v5.1 (не змінювати)
// Декодування: ZEBRA v5.1 decodeCircles (не змінювати)
// Обгортка runDecodeAttempts: адаптація виводу під формат taina
'use strict';

// ═══════════════════════════════════════════════════════
//  ZEBRA FINDER v5.1 — пайплайн (не змінювати)
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
  let tlS = Infinity, trS = -Infinity, brS = -Infinity, blS = Infinity;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    const s = x + y, d = x - y;
    if (s < tlS) tlS = s;
    if (d > trS) trS = d;
    if (s > brS) brS = s;
    if (d < blS) blS = d;
  }
  let tlX=0,tlY=0,tlN=0, trX=0,trY=0,trN=0, brX=0,brY=0,brN=0, blX=0,blY=0,blN=0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    const s = x + y, d = x - y;
    if (s <= tlS + slack) { tlX+=x; tlY+=y; tlN++; }
    if (d >= trS - slack) { trX+=x; trY+=y; trN++; }
    if (s >= brS - slack) { brX+=x; brY+=y; brN++; }
    if (d <= blS + slack) { blX+=x; blY+=y; blN++; }
  }
  const avg = (sx, sy, n, dx, dy) => n ? { x: Math.round(sx/n), y: Math.round(sy/n) } : { x: dx, y: dy };
  return {
    tl: avg(tlX,tlY,tlN,0,0),
    tr: avg(trX,trY,trN,w-1,0),
    br: avg(brX,brY,brN,w-1,h-1),
    bl: avg(blX,blY,blN,0,h-1)
  };
}

function zb_spread(c) {
  const d = (a, b) => Math.hypot(a.x-b.x, a.y-b.y);
  return Math.max(d(c.tl,c.tr), d(c.tr,c.br), d(c.br,c.bl), d(c.bl,c.tl));
}

function zb_computeH(src4, dst4) {
  const rows = [], rhs = [];
  for (let i = 0; i < 4; i++) {
    const sx=src4[i].x, sy=src4[i].y, dx=dst4[i].x, dy=dst4[i].y;
    rows.push([sx,sy,1,0,0,0,-sx*dx,-sy*dx]); rhs.push(dx);
    rows.push([0,0,0,sx,sy,1,-sx*dy,-sy*dy]); rhs.push(dy);
  }
  const h = zb_gaussElim(rows, rhs); if (!h) return null;
  return [[h[0],h[1],h[2]],[h[3],h[4],h[5]],[h[6],h[7],1]];
}

function zb_gaussElim(A, b) {
  const n = b.length, M = A.map((r,i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let mr = c, mv = Math.abs(M[c][c]);
    for (let r = c+1; r < n; r++) if (Math.abs(M[r][c]) > mv) { mv = Math.abs(M[r][c]); mr = r; }
    [M[c],M[mr]] = [M[mr],M[c]];
    const pv = M[c][c]; if (Math.abs(pv) < 1e-12) return null;
    for (let r = c+1; r < n; r++) { const f = M[r][c]/pv; for (let j=c; j<=n; j++) M[r][j]-=f*M[c][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i=n-1; i>=0; i--) { x[i]=M[i][n]; for (let j=i+1; j<n; j++) x[i]-=M[i][j]*x[j]; x[i]/=M[i][i]; }
  return x;
}

function zb_inv3(M) {
  const [[a,b,c],[d,e,f],[g,h,k]] = M;
  const dt = a*(e*k-f*h)-b*(d*k-f*g)+c*(d*h-e*g);
  if (Math.abs(dt) < 1e-12) return null;
  return [[(e*k-f*h)/dt,(c*h-b*k)/dt,(b*f-c*e)/dt],
          [(f*g-d*k)/dt,(a*k-c*g)/dt,(c*d-a*f)/dt],
          [(d*h-e*g)/dt,(b*g-a*h)/dt,(a*e-b*d)/dt]];
}

function zb_applyH(H, x, y) {
  const w = H[2][0]*x+H[2][1]*y+H[2][2];
  return { x:(H[0][0]*x+H[0][1]*y+H[0][2])/w, y:(H[1][0]*x+H[1][1]*y+H[1][2])/w };
}

function zb_warpPerspective(idata, sw, sh, corners, S) {
  const src4 = [corners.tl, corners.tr, corners.br, corners.bl];
  const dst4 = [{x:0,y:0},{x:S-1,y:0},{x:S-1,y:S-1},{x:0,y:S-1}];
  const H = zb_computeH(src4, dst4); if (!H) return null;
  const Hi = zb_inv3(H); if (!Hi) return null;
  const out = new ImageData(S, S), sd = idata.data, od = out.data;
  for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
    const p = zb_applyH(Hi, dx, dy);
    const x0=p.x|0, y0=p.y|0, x1=x0+1, y1=y0+1, fx=p.x-x0, fy=p.y-y0;
    const di = (dy*S+dx)*4;
    const get = (sx,sy,c) => (sx<0||sx>=sw||sy<0||sy>=sh)?128:sd[(sy*sw+sx)*4+c];
    for (let c=0;c<3;c++) od[di+c]=Math.round(
      get(x0,y0,c)*(1-fx)*(1-fy)+get(x1,y0,c)*fx*(1-fy)+
      get(x0,y1,c)*(1-fx)*fy  +get(x1,y1,c)*fx*fy);
    od[di+3]=255;
  }
  return out;
}

function zb_verifyZebra(wGray, S, minContrast) {
  function scanLine(arr) {
    const n = arr.length;
    let mn = 255, mx = 0;
    for (const v of arr) { if (v < mn) mn = v; if (v > mx) mx = v; }
    if (mx - mn < minContrast) return null;
    const thr = (mn + mx) >> 1;
    const runs = [];
    let cur = arr[0] > thr ? 1 : 0, len = 1;
    for (let i = 1; i < n; i++) {
      const b = arr[i] > thr ? 1 : 0;
      if (b === cur) len++; else { runs.push({ v: cur, len }); cur = b; len = 1; }
    }
    runs.push({ v: cur, len });
    if (runs.length < 3) return null;
    const allLens = runs.map(r => r.len).sort((a, b) => a - b);
    const med = allLens[allLens.length >> 1];
    if (med < 2) return null;
    const valid = runs.filter(r => r.len >= med * 0.4 && r.len <= med * 2.4);
    if (valid.length < 5) return null;
    let T = valid.length;
    if (T % 2 === 0) {
      if (valid[0].v === 1 || valid[T - 1].v === 1) T += 1;
      else return null;
    }
    if (T < 5) return null;
    return { T, modSize: S / T };
  }
  const probeOffsets = [2, 5, 10, 15, 20, 30];
  const votes = new Map();
  let totalProbes = 0;
  for (const off of probeOffsets) {
    if (off >= S / 2) continue;
    for (const pos of [off, S - 1 - off]) {
      const row = new Uint8Array(S);
      for (let x = 0; x < S; x++) row[x] = wGray[pos * S + x];
      const rh = scanLine(row);
      if (rh) votes.set(rh.T, (votes.get(rh.T) || 0) + 1);
      totalProbes++;
      const col = new Uint8Array(S);
      for (let y = 0; y < S; y++) col[y] = wGray[y * S + pos];
      const rv = scanLine(col);
      if (rv) votes.set(rv.T, (votes.get(rv.T) || 0) + 1);
      totalProbes++;
    }
  }
  if (!votes.size) return null;
  let bestT = 0, bestV = 0;
  for (const [t, v] of votes) if (v > bestV) { bestV = v; bestT = t; }
  return { T: bestT, modSize: S / bestT, confidence: bestV / totalProbes };
}

function zb_countT(wGray, S) {
  function scanLine2(arr) {
    const n=arr.length;
    let mn=255,mx=0;
    for(const v of arr){if(v<mn)mn=v;if(v>mx)mx=v;}
    const contrast=mx-mn;
    const thr=(mn+mx)>>1;
    const runs=[];
    let cur=arr[0]>thr?1:0,len=1;
    for(let i=1;i<n;i++){const b=arr[i]>thr?1:0;if(b===cur)len++;else{runs.push({v:cur,len});cur=b;len=1;}}
    runs.push({v:cur,len});
    const allLens=runs.map(r=>r.len).sort((a,b)=>a-b);
    const med=allLens[allLens.length>>1];
    const valid=runs.filter(r=>r.len>=med*0.4&&r.len<=med*2.4);
    return {runs:valid, med, contrast, T:valid.length};
  }
  const offsets=[2,5,8,12,18];
  const results=[];
  for(const off of offsets){
    if(off>=S/2) continue;
    for(const pos of [off, S-1-off]){
      const row=new Uint8Array(S);
      for(let x=0;x<S;x++) row[x]=wGray[pos*S+x];
      results.push(scanLine2(row));
    }
    for(const pos of [off, S-1-off]){
      const col=new Uint8Array(S);
      for(let y=0;y<S;y++) col[y]=wGray[y*S+pos];
      results.push(scanLine2(col));
    }
  }
  const votes=new Map();
  for(const r of results){
    if(r.contrast<40||r.T<3) continue;
    let T=r.T;
    if(T%2===0) T+=1;
    votes.set(T,(votes.get(T)||0)+1);
  }
  let bestT=0,bestV=0;
  for(const[t,v] of votes) if(v>bestV){bestV=v;bestT=t;}
  return bestT;
}

function zb_detectZebra(wGray, S, minContrast) {
  const resA = zb_verifyZebra(wGray, S, minContrast);
  const tA = resA ? resA.T : 0;
  const tB = zb_countT(wGray, S);
  let T = 0;
  if (tA > 0 && tB > 0) {
    T = (resA.confidence >= 0.5) ? tA : tB;
  } else if (tA > 0) { T = tA; }
  else if (tB > 0) { T = tB; }
  if (T < 1) return null;
  return { T, modSize: S / T, confidence: resA ? resA.confidence : 0 };
}

// ═══════════════════════════════════════════════════════
//  sampleCircles — ZEBRA v5.1 (не змінювати)
// ═══════════════════════════════════════════════════════

function sampleCircles(warped, S, T, modSize) {
  const d = warped.data;
  const circleR = modSize * 0.28;
  const r2 = circleR * circleR;
  const cells = [];
  for (let row = 1; row < T - 1; row++) {
    for (let col = 1; col < T - 1; col++) {
      const cx = col * modSize + modSize / 2;
      const cy = row * modSize + modSize / 2;
      let sumR = 0, sumG = 0, sumB = 0, cnt = 0;
      const x0 = Math.max(0, Math.floor(cx - circleR));
      const x1 = Math.min(S - 1, Math.ceil(cx + circleR));
      const y0 = Math.max(0, Math.floor(cy - circleR));
      const y1 = Math.min(S - 1, Math.ceil(cy + circleR));
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const dx = px - cx, dy = py - cy;
          if (dx * dx + dy * dy > r2) continue;
          const idx = (py * S + px) * 4;
          sumR += d[idx]; sumG += d[idx + 1]; sumB += d[idx + 2]; cnt++;
        }
      }
      if (cnt === 0) { cells.push({ r: 0, g: 0, b: 0, row, col }); continue; }
      cells.push({ r: sumR/cnt, g: sumG/cnt, b: sumB/cnt, row, col });
    }
  }
  return { cells, circleR };
}

// ═══════════════════════════════════════════════════════
//  TAINA-декодер — алгоритми ZEBRA v5.1 (не змінювати)
// ═══════════════════════════════════════════════════════

const ZB_RGB_MAIN = {r:[255,0,0], g:[0,255,0], b:[0,0,255]};
const ZB_RGB_GAL  = {r:[220,50,60], g:[65,195,65], b:[60,70,215]};
const ZB_REFBITS  = [[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,1,1]];

const _zb_enc = new TextEncoder();
const _zb_dec = new TextDecoder('utf-8', {fatal:true});

function zb_isClean(t) {
  for (const ch of t) { const o=ch.codePointAt(0); if(o===0)return false; if(o<32&&ch!=='\n'&&ch!=='\t')return false; } return true;
}
function zb_bytesToText(by) {
  by = by.slice(); while(by.length && by[by.length-1]===0) by.pop();
  if(!by.length) return null;
  try { const t=_zb_dec.decode(new Uint8Array(by)); return zb_isClean(t)?t:null; } catch(e) { return null; }
}
function zb_textBits(t) {
  const d=_zb_enc.encode(t), b=new Uint8Array(d.length*8);
  for(let i=0;i<d.length;i++) for(let k=0;k<8;k++) b[i*8+k]=(d[i]>>(7-k))&1;
  return b;
}

function zb_Rof(n) { return (n-1)/2; }

function zb_baseCells(m, n) {
  const c=zb_Rof(n), o=[];
  if(m==='oct')      { for(let i=0;i<=c;i++) for(let j=0;j<=i;j++) o.push([c+i,c+j]); }
  else if(m==='quad'){ for(let i=0;i<=c;i++) for(let j=0;j<=c;j++) o.push([c+i,c+j]); }
  else               { for(let y=0;y<n;y++) for(let i=0;i<=c;i++) o.push([c+i,y]); }
  return o;
}

function zb_mirrors(m, n, x, y) {
  const c=zb_Rof(n), i=x-c, j=y-c; let p;
  if(m==='oct')       p=[[i,j],[j,i],[-i,j],[-j,i],[i,-j],[j,-i],[-i,-j],[-j,-i]];
  else if(m==='quad') p=[[i,j],[-i,j],[i,-j],[-i,-j]];
  else                p=[[i,j],[-i,j]];
  const o=[];
  for(const[a,b] of p){ const X=c+a, Y=c+b; if(X>=0&&Y>=0&&X<n&&Y<n) o.push([X,Y]); }
  return o;
}

function zb_fillChannel(t, n, m, markBit) {
  const g=new Uint8Array(n*n), bc=zb_baseCells(m,n); let seq=zb_textBits(t);
  if(markBit!==undefined&&markBit!==null){ const s2=new Uint8Array(seq.length+1); s2[0]=markBit; s2.set(seq,1); seq=s2; }
  const lim=Math.min(seq.length,bc.length);
  for(let i=0;i<lim;i++){ const[x,y]=bc[i]; for(const[X,Y] of zb_mirrors(m,n,x,y)) if(seq[i]) g[Y*n+X]=1; }
  return g;
}

function zb_markCell(g, n, m) { const[x,y]=zb_baseCells(m,n)[0]; return g[y*n+x]?1:0; }

function zb_agree(g, chk, n) {
  let ok=0; for(let z=0;z<n*n;z++) ok+=((chk[z]?1:0)===g[z])?1:0; return ok/(n*n);
}

function zb_decodeVoted(g, n, m, off, conf) {
  const bc=zb_baseCells(m,n), by=[];
  for(let i=off||0; i+7<bc.length; i+=8){
    let v=0;
    for(let b=0;b<8;b++){
      const[x,y]=bc[i+b], cells=zb_mirrors(m,n,x,y);
      let bit;
      if(conf){
        let w1=0,w0=0;
        for(const[X,Y] of cells){ const c=conf[Y*n+X]; if(c<0.15)continue; if(g[Y*n+X])w1+=c; else w0+=c; }
        if(w1===0&&w0===0) bit=g[y*n+x]?1:0; else bit=w1>w0?1:0;
      } else {
        let ones=0; for(const[X,Y] of cells) ones+=g[Y*n+X]?1:0;
        const cnt=cells.length;
        if(ones*2>cnt) bit=1; else if(ones*2<cnt) bit=0; else bit=g[y*n+x]?1:0;
      }
      v=(v<<1)|bit;
    }
    by.push(v);
  }
  return { text: zb_bytesToText(by), bytes: by };
}

function zb_refsFor(S) {
  const mix=(r,g,b)=>[Math.min(255,(r?S.r[0]:0)+(g?S.g[0]:0)+(b?S.b[0]:0)),
                      Math.min(255,(r?S.r[1]:0)+(g?S.g[1]:0)+(b?S.b[1]:0)),
                      Math.min(255,(r?S.r[2]:0)+(g?S.g[2]:0)+(b?S.b[2]:0))];
  return ZB_REFBITS.map(c=>({bits:c, col:mix(c[0],c[1],c[2])}));
}

function zb_classifyCells(cells, n) {
  const pals = [['main',ZB_RGB_MAIN],['gallery',ZB_RGB_GAL]];
  let best = null;
  for(const[name,S] of pals){
    const refs=zb_refsFor(S); let err=0;
    const cr=new Uint8Array(n*n), cg=new Uint8Array(n*n), cb=new Uint8Array(n*n);
    for(let i=0;i<n*n;i++){
      const[R,G,B]=[cells[i].r, cells[i].g, cells[i].b];
      let bi=0, bd=1e9;
      for(let k=0;k<refs.length;k++){
        const q=refs[k].col, dr=R-q[0], dg=G-q[1], db=B-q[2], d=dr*dr+dg*dg+db*db;
        if(d<bd){bd=d;bi=k;}
      }
      err+=bd; const t=refs[bi].bits; cr[i]=t[0]; cg[i]=t[1]; cb[i]=t[2];
    }
    if(!best||err<best.err) best={name,err,cr,cg,cb};
  }
  return best;
}

function zb_symScore(gl, n) {
  const seen=new Set(), groups=[], c=(n-1)/2;
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const i=x-c, j=y-c;
    const p=[[i,j],[j,i],[-i,j],[-j,i],[i,-j],[j,-i],[-i,-j],[-j,-i]], g=[];
    for(const[a,b] of p){ const X=c+a,Y=c+b; if(X>=0&&Y>=0&&X<n&&Y<n) g.push([X,Y]); }
    const key=g.map(q=>q[0]+','+q[1]).sort().join(';');
    if(seen.has(key))continue; seen.add(key); groups.push(g);
  }
  let tot=0, ok=0;
  for(const g of groups){
    let s=0; for(const[X,Y] of g) s+=gl[Y*n+X];
    const maj=s*2>g.length?1:0; tot+=g.length;
    for(const[X,Y] of g) ok+=(gl[Y*n+X]===maj)?1:0;
  }
  return {frac:ok/tot, ok, tot};
}

// ── Головна функція декодування з кружечків — ZEBRA v5.1 (не змінювати) ──
function decodeCircles(circles, T) {
  const cells = circles.cells;
  const n = T - 2;
  if(n < 7 || n % 2 === 0) return null;

  const lumas = cells.map(c => (c.r + c.g + c.b) / 3);
  const lumaMin = Math.min(...lumas);
  const lumaMax = Math.max(...lumas);
  const autoThr = (lumaMin + lumaMax) / 2;

  const gl = new Uint8Array(n * n);
  const confMono = new Float32Array(n * n);
  cells.forEach((c, i) => {
    const L = (c.r + c.g + c.b) / 3;
    gl[i] = L > autoThr ? 1 : 0;
    confMono[i] = Math.min(1, Math.abs(L - autoThr) / (autoThr / 2 + 1));
  });

  const sats = cells.map(c => Math.max(c.r,c.g,c.b) - Math.min(c.r,c.g,c.b));
  const medSat = [...sats].sort((a,b)=>a-b)[sats.length>>1];
  const coloredCount = sats.filter(s=>s>60).length;
  const isColored = medSat > 25 || coloredCount >= Math.max(3, n * 0.15);

  const modes = ['oct','quad','half'];

  if(!isColored) {
    let best = null;
    for(const m of modes){
      const v = zb_decodeVoted(gl, n, m, 0, confMono);
      if(v.text !== null){
        const chk = zb_fillChannel(v.text, n, m, null);
        const a = zb_agree(gl, chk, n);
        if(!best || a > best.a) best = {v, a, m};
      }
    }
    if(!best) return null;
    return { kind:'one', mode:best.m, n, res:[best.v.text, null, null] };
  } else {
    const cls = zb_classifyCells(cells, n);
    const confR=new Float32Array(n*n), confG=new Float32Array(n*n), confB=new Float32Array(n*n);
    cells.forEach((c,i)=>{
      confR[i]=Math.min(1,Math.abs(c.r-128)/90);
      confG[i]=Math.min(1,Math.abs(c.g-128)/90);
      confB[i]=Math.min(1,Math.abs(c.b-128)/90);
    });

    let best = null;
    for(const m of modes){
      const rMark = zb_markCell(cls.cr, n, m);
      let vr = zb_decodeVoted(cls.cr, n, m, rMark?1:0, confR);
      if(rMark && vr.text===null) vr = zb_decodeVoted(cls.cr, n, m, 0, confR);
      const vg = zb_decodeVoted(cls.cg, n, m, 0, confG);
      const vb = zb_decodeVoted(cls.cb, n, m, 0, confB);
      const nn = [vr.text, vg.text, vb.text].filter(t=>t!==null);
      if(!nn.length) continue;
      const sc = nn.length*1000 + nn.reduce((a,t)=>a+t.length,0);
      if(!best||sc>best.sc) best={vr,vg,vb,nn,sc,m,rMark};
    }
    if(!best) return null;

    const allSame = best.nn.every(t=>t===best.nn[0]);
    const kind = best.rMark && allSame ? 'mono' : 'three';
    return { kind, mode:best.m, n, res:[best.vr.text, best.vg.text, best.vb.text] };
  }
}

// ═══════════════════════════════════════════════════════
//  Допоміжні функції для index.html (глобали)
//  Потрібні для сумісності з build() та verify у index.html
// ═══════════════════════════════════════════════════════

function baseCells(m, n) { return zb_baseCells(m, n); }
function mirrors(m, n, x, y) { return zb_mirrors(m, n, x, y); }
function fillChannel(t, n, m, markBit) {
  // index.html очікує {g, dm} — повертаємо обидва
  const g = zb_fillChannel(t, n, m, markBit);
  const dm = new Uint8Array(n*n);
  const bc = zb_baseCells(m, n);
  const seq = markBit !== null && markBit !== undefined
    ? (() => { const s=zb_textBits(t); const s2=new Uint8Array(s.length+1); s2[0]=markBit; s2.set(s,1); return s2; })()
    : zb_textBits(t);
  const lim = Math.min(seq.length, bc.length);
  for(let i=0;i<lim;i++){
    const[x,y]=bc[i];
    for(const[X,Y] of zb_mirrors(m,n,x,y)) dm[Y*n+X]=1;
  }
  return {g, dm};
}
function markCell(g, n, m) { return zb_markCell(g, n, m); }
function bytesToText(by) { return zb_bytesToText(by); }
function decodeSector(g, n, m, offset) {
  const v = zb_decodeVoted(g, n, m, offset, null);
  return v.text;
}

// ═══════════════════════════════════════════════════════
//  ZEBRA PIPELINE — знаходить зебру та повертає warped
// ═══════════════════════════════════════════════════════

function zb_findZebra(idata, w, h) {
  const gray = zb_toGray(idata, w, h);
  const bg = zb_sampleBG(gray, w, h, 5);

  const tols = [20, 30, 42, 55, 70, 90];
  let bestCorners = null, bestSpread = 0;

  for (const tol of tols) {
    const rm = zb_makeMask(gray, w, h, bg, tol);
    const em = zb_erodeMask(rm, w, h);
    const fgN = em.reduce((s,v)=>s+v, 0);
    if (fgN < 50) continue;
    const c = zb_findCorners(em, w, h, 15);
    const sp = zb_spread(c);
    if (sp > bestSpread) { bestSpread = sp; bestCorners = c; }
  }

  // fallback: variance scan
  if (!bestCorners || bestSpread < 30) {
    const topRows=[], leftCols=[];
    for (let y=0;y<h;y++){
      let sum=0,sum2=0;
      for(let x=0;x<w;x++){const v=gray[y*w+x];sum+=v;sum2+=v*v;}
      const avg=sum/w,std=Math.sqrt(sum2/w-avg*avg);
      if(std>50){topRows.push(y);}
    }
    for (let x=0;x<w;x++){
      let sum=0,sum2=0;
      for(let y=0;y<h;y++){const v=gray[y*w+x];sum+=v;sum2+=v*v;}
      const avg=sum/h,std=Math.sqrt(sum2/h-avg*avg);
      if(std>50){leftCols.push(x);}
    }
    topRows.sort((a,b)=>a-b); leftCols.sort((a,b)=>a-b);
    if(topRows.length>0&&leftCols.length>0){
      const vc={
        tl:{x:leftCols[0],y:topRows[0]},
        tr:{x:leftCols[leftCols.length-1],y:topRows[0]},
        br:{x:leftCols[leftCols.length-1],y:topRows[topRows.length-1]},
        bl:{x:leftCols[0],y:topRows[topRows.length-1]}
      };
      const vsp=zb_spread(vc);
      if(vsp>bestSpread){bestCorners=vc;bestSpread=vsp;}
    }
  }

  if (!bestCorners || bestSpread < 20) return null;

  const expand = 6;
  const corners = {
    tl:{x:bestCorners.tl.x-expand, y:bestCorners.tl.y-expand},
    tr:{x:bestCorners.tr.x+expand, y:bestCorners.tr.y-expand},
    br:{x:bestCorners.br.x+expand, y:bestCorners.br.y+expand},
    bl:{x:bestCorners.bl.x-expand, y:bestCorners.bl.y+expand}
  };

  const S = 600;
  const warped = zb_warpPerspective(idata, w, h, corners, S);
  if (!warped) return null;

  const wGray = zb_toGray(warped, S, S);
  const zebra = zb_detectZebra(wGray, S, 50);
  if (!zebra) return null;

  const circles = sampleCircles(warped, S, zebra.T, zebra.modSize);
  return { zebra, circles };
}

// ═══════════════════════════════════════════════════════
//  runDecodeAttempts — публічний API (формат taina)
// ═══════════════════════════════════════════════════════

function runDecodeAttempts(imgOrCanvas) {
  try {
    const isCanvas = (typeof HTMLCanvasElement !== 'undefined') && (imgOrCanvas instanceof HTMLCanvasElement);

    // Будуємо пікселі
    let srcCanvas;
    if (isCanvas) {
      // camera: масштабуємо до 800px
      const iw = imgOrCanvas.width, ih = imgOrCanvas.height;
      if (iw < 1 || ih < 1) return [];
      const scale = Math.min(1, 800 / Math.max(iw, ih));
      const W = Math.round(iw * scale), H = Math.round(ih * scale);
      srcCanvas = document.createElement('canvas');
      srcCanvas.width = W; srcCanvas.height = H;
      srcCanvas.getContext('2d', {willReadFrequently:true}).drawImage(imgOrCanvas, 0, 0, iw, ih, 0, 0, W, H);
    } else {
      // file: масштабуємо до квадрату max 1200px
      const iw = imgOrCanvas.naturalWidth || imgOrCanvas.width || 0;
      const ih = imgOrCanvas.naturalHeight || imgOrCanvas.height || 0;
      if (iw < 1 || ih < 1) return [];
      const S = Math.max(512, Math.min(1200, Math.max(iw, ih)));
      srcCanvas = document.createElement('canvas');
      srcCanvas.width = S; srcCanvas.height = S;
      const g = srcCanvas.getContext('2d', {willReadFrequently:true});
      // letterbox — зберігаємо пропорції
      const scale = Math.min(S/iw, S/ih);
      const w = iw*scale, h = ih*scale;
      g.fillStyle = '#888';
      g.fillRect(0, 0, S, S);
      g.drawImage(imgOrCanvas, (S-w)/2, (S-h)/2, w, h);
    }

    const ctx = srcCanvas.getContext('2d', {willReadFrequently:true});
    const idata = ctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
    const w = srcCanvas.width, h = srcCanvas.height;

    const found = zb_findZebra(idata, w, h);
    if (!found) return [];

    const decoded = decodeCircles(found.circles, found.zebra.T);
    if (!decoded) return [];

    // Нормалізуємо res: завжди масив з трьох елементів
    const res = [
      decoded.res[0] || null,
      decoded.res[1] || null,
      decoded.res[2] || null
    ];

    return [{ kind: decoded.kind, mode: decoded.mode, n: decoded.n, res }];

  } catch(e) {
    return [];
  }
}
