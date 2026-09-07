<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZEBRA FINDER · v5.1</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;background:#080808;color:#aaa;font:11px/1.6 'Courier New',monospace}
#app{display:grid;grid-template-columns:520px 1fr;height:100vh;gap:0}

/* LEFT */
#left{display:flex;flex-direction:column;border-right:1px solid #1a1a1a;overflow:hidden}
#topbar{padding:8px 12px;border-bottom:1px solid #1a1a1a;display:flex;gap:6px;align-items:center;flex-shrink:0}
h1{font-size:10px;letter-spacing:4px;color:#4a8ab0;margin-right:8px}
.btn{background:#111;border:1px solid #222;color:#777;padding:4px 12px;cursor:pointer;font:inherit;letter-spacing:1px}
.btn:hover{border-color:#4a8ab0;color:#ccc}
input[type=file]{display:none}
#canvas-wrap{flex:1;position:relative;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center}
#cnv{display:block;max-width:100%;max-height:100%;image-rendering:pixelated}
#status-bar{flex-shrink:0;padding:6px 12px;border-top:1px solid #1a1a1a;font-size:10px;letter-spacing:2px}
#status-bar span{font-weight:700;font-size:13px}

/* RIGHT — LOG */
#right{display:flex;flex-direction:column;overflow:hidden}
#log-title{padding:6px 12px;border-bottom:1px solid #1a1a1a;font-size:10px;letter-spacing:3px;color:#2a5a7a;flex-shrink:0}
#log{flex:1;overflow-y:auto;padding:8px 12px;line-height:1.75}
.lh{color:#2a6a9a;margin-top:6px}
.lok{color:#2a7a3a}
.lw{color:#8a6a1a}
.le{color:#9a2a2a}
.li{color:#888}
.lv{color:#5a5a9a}
.sep{color:#1e1e1e;user-select:none}
</style>
</head>
<body>
<div id="app">

  <!-- LEFT: canvas -->
  <div id="left">
    <div id="topbar">
      <h1>ZEBRA · v5.1</h1>
      <label class="btn">▶ Файл<input type="file" id="fin" accept="image/*"></label>
      <button class="btn" id="camBtn">◎ Камера</button>
      <button class="btn" id="capBtn" style="display:none">● Знімок</button>
    </div>
    <div id="canvas-wrap">
      <canvas id="cnv"></canvas>
    </div>
    <div id="status-bar">
      <span id="st" style="color:#333">— очікування —</span>
    </div>
  </div>

  <!-- RIGHT: log -->
  <div id="right">
    <div id="log-title">ДІАГНОСТИКА</div>
    <div id="log"></div>
  </div>

</div>

<script>
'use strict';

const logEl = document.getElementById('log');
const aL = (m, c) => { const d = document.createElement('div'); d.textContent = m; if (c) d.className = c; logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight; };
const Lh = m => aL('── ' + m, 'lh');
const Lok = m => aL('✓ ' + m, 'lok');
const Lw = m => aL('⚠ ' + m, 'lw');
const Le = m => aL('✗ ' + m, 'le');
const Li = m => aL(m);
const clr = () => { logEl.innerHTML = ''; };

const setSt = (text, ok) => {
  const el = document.getElementById('st');
  el.textContent = text;
  el.style.color = ok === true ? '#55eb5a' : ok === false ? '#eb5555' : '#888';
};

const P = () => ({ bgTol:42, zebCon:50, sprd:40, warp:600 });

document.getElementById('fin').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  clr(); Li('Файл: ' + f.name);
  const img = new Image();
  img.onload = () => setTimeout(() => run(img), 30);
  img.src = URL.createObjectURL(f);
});

const vidEl = document.createElement('video'); vidEl.autoplay=true; vidEl.playsInline=true;

document.getElementById('camBtn').addEventListener('click', async () => {
  try {
    vidEl.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    vidEl.style.display = 'block';
    document.getElementById('capBtn').style.display = 'inline';
  } catch(e) { Le('Камера: ' + e.message); }
});

document.getElementById('capBtn').addEventListener('click', () => {
  clr();
  const tmp = document.createElement('canvas');
  tmp.width = vidEl.videoWidth; tmp.height = vidEl.videoHeight;
  tmp.getContext('2d').drawImage(vidEl, 0, 0);
  const img = new Image(); img.onload = () => setTimeout(() => run(img), 30);
  img.src = tmp.toDataURL('image/jpeg', 0.92);
});

function loadImage(img, maxSide = 900) {
  let w = img.naturalWidth, h = img.naturalHeight;
  if (Math.max(w, h) > maxSide) { const s = maxSide / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return { idata: c.getContext('2d').getImageData(0, 0, w, h), w, h };
}

function toGray(idata, w, h) {
  const d = idata.data, g = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = (77 * d[i * 4] + 150 * d[i * 4 + 1] + 29 * d[i * 4 + 2]) >> 8;
  return g;
}

function sampleBG(gray, w, h, s = 5) {
  const v = [];
  for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
    v.push(gray[dy * w + dx], gray[dy * w + (w - 1 - dx)],
           gray[(h - 1 - dy) * w + dx], gray[(h - 1 - dy) * w + (w - 1 - dx)]);
  }
  v.sort((a, b) => a - b); return v[v.length >> 1];
}

function makeMask(gray, w, h, bg, tol) {
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = Math.abs(gray[i] - bg) > tol ? 1 : 0;
  return m;
}

function erodeMask(mask, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++)
    if (mask[y*w+x] && mask[(y-1)*w+x] && mask[(y+1)*w+x] && mask[y*w+x-1] && mask[y*w+x+1])
      out[y*w+x] = 1;
  return out;
}

function findCorners(mask, w, h, slack = 12) {
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

function spread(c) {
  const d = (a, b) => Math.hypot(a.x-b.x, a.y-b.y);
  return Math.max(d(c.tl,c.tr), d(c.tr,c.br), d(c.br,c.bl), d(c.bl,c.tl));
}

function computeH(src4, dst4) {
  const rows = [], rhs = [];
  for (let i = 0; i < 4; i++) {
    const sx=src4[i].x, sy=src4[i].y, dx=dst4[i].x, dy=dst4[i].y;
    rows.push([sx,sy,1,0,0,0,-sx*dx,-sy*dx]); rhs.push(dx);
    rows.push([0,0,0,sx,sy,1,-sx*dy,-sy*dy]); rhs.push(dy);
  }
  const h = gaussElim(rows, rhs); if (!h) return null;
  return [[h[0],h[1],h[2]],[h[3],h[4],h[5]],[h[6],h[7],1]];
}

function gaussElim(A, b) {
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

function inv3(M) {
  const [[a,b,c],[d,e,f],[g,h,k]] = M;
  const dt = a*(e*k-f*h)-b*(d*k-f*g)+c*(d*h-e*g);
  if (Math.abs(dt) < 1e-12) return null;
  return [[(e*k-f*h)/dt,(c*h-b*k)/dt,(b*f-c*e)/dt],
          [(f*g-d*k)/dt,(a*k-c*g)/dt,(c*d-a*f)/dt],
          [(d*h-e*g)/dt,(b*g-a*h)/dt,(a*e-b*d)/dt]];
}

function applyH(H, x, y) {
  const w = H[2][0]*x+H[2][1]*y+H[2][2];
  return { x:(H[0][0]*x+H[0][1]*y+H[0][2])/w, y:(H[1][0]*x+H[1][1]*y+H[1][2])/w };
}

function warpPerspective(idata, sw, sh, corners, S) {
  const src4 = [corners.tl, corners.tr, corners.br, corners.bl];
  const dst4 = [{x:0,y:0},{x:S-1,y:0},{x:S-1,y:S-1},{x:0,y:S-1}];
  const H = computeH(src4, dst4); if (!H) return null;
  const Hi = inv3(H); if (!Hi) return null;
  const out = new ImageData(S, S), sd = idata.data, od = out.data;
  for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
    const p = applyH(Hi, dx, dy);
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

function verifyZebra(wGray, S, minContrast) {
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

function countT(wGray, S) {
  function scanLine2(arr, label) {
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
    const runStr=valid.map(r=>(r.v?'W':'B')+r.len).join(' ');
    Li('  '+label+': contrast='+contrast+' med='+med+' runs='+valid.length+' ['+runStr.slice(0,70)+']');
    return {runs:valid, med, contrast, T:valid.length};
  }

  const offsets=[2,5,8,12,18];
  const results=[];
  for(const off of offsets){
    if(off>=S/2) continue;
    for(const [pos,label] of [[off,'top+'+off],[S-1-off,'bot-'+off]]){
      const row=new Uint8Array(S);
      for(let x=0;x<S;x++) row[x]=wGray[pos*S+x];
      results.push(scanLine2(row,label));
    }
    for(const [pos,label] of [[off,'left+'+off],[S-1-off,'right-'+off]]){
      const col=new Uint8Array(S);
      for(let y=0;y<S;y++) col[y]=wGray[y*S+pos];
      results.push(scanLine2(col,label));
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

function detectZebra(wGray, S, minContrast) {
  Lh('4. ВЕРИФІКАЦІЯ ЗЕБРИ');
  const resA = verifyZebra(wGray, S, minContrast);
  const tA = resA ? resA.T : 0;
  Li('  Метод A (verifyZebra): T=' + tA + (resA ? '  conf='+(resA.confidence*100).toFixed(0)+'%' : ''));

  const tB = countT(wGray, S);
  Li('  Метод B (countT): T=' + tB);

  let T = 0, source = '';
  if (tA > 0 && tB > 0) {
    if (resA.confidence >= 0.5) { T = tA; source = 'A'; }
    else { T = tB; source = 'B'; }
  } else if (tA > 0) { T = tA; source = 'A'; }
  else if (tB > 0) { T = tB; source = 'B'; }

  if (T < 1) return null;
  return { T, modSize: S / T, confidence: resA ? resA.confidence : 0, source };
}

function verifyCornerBlack(wGray, S, modSize) {
  const half = modSize / 2;
  const r = Math.max(1, Math.round(modSize * 0.2));

  function sampleArea(cx, cy) {
    let sum = 0, cnt = 0;
    for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) {
      const x = Math.min(S-1, Math.max(0, Math.round(cx+dx)));
      const y = Math.min(S-1, Math.max(0, Math.round(cy+dy)));
      sum += wGray[y*S+x]; cnt++;
    }
    return sum / cnt;
  }

  const corners = [
    [half,     half    ],
    [S-1-half, half    ],
    [S-1-half, S-1-half],
    [half,     S-1-half]
  ];

  const vals = corners.map(([cx,cy]) => sampleArea(cx, cy));
  const avg = vals.reduce((a,b)=>a+b,0)/4;
  return {
    cornerLuma: Math.round(avg),
    cornerVals: vals.map(v=>Math.round(v)),
    ok: avg < 110
  };
}

function drawInput(idata, w, h, corners, cnv) {
  cnv.width = w; cnv.height = h;
  const ctx = cnv.getContext('2d');
  ctx.putImageData(idata, 0, 0);
  if (!corners) return;
  const c = corners;
  ctx.strokeStyle = '#55eb5a'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.tl.x, c.tl.y); ctx.lineTo(c.tr.x, c.tr.y);
  ctx.lineTo(c.br.x, c.br.y); ctx.lineTo(c.bl.x, c.bl.y);
  ctx.closePath(); ctx.stroke();
  for (const pt of [c.tl,c.tr,c.br,c.bl]) {
    ctx.fillStyle='#55eb5a';
    ctx.beginPath(); ctx.arc(pt.x,pt.y,5,0,Math.PI*2); ctx.fill();
  }
}

// ─────────────────────────────────────────────
//  drawOutput — v5.1: сітка + кружечки в центрі кожної клітинки
// ─────────────────────────────────────────────
function drawOutput(warped, S, zebraResult, cnv) {
  cnv.width = S; cnv.height = S;
  const ctx = cnv.getContext('2d');

  // 1. Малюємо варп-зображення
  if (warped) ctx.putImageData(warped, 0, 0);
  if (!zebraResult) return;

  const { T, modSize } = zebraResult;

  // 2. Тонка сітка (лінії між клітинками)
  ctx.strokeStyle = 'rgba(40,120,200,0.18)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= T; i++) {
    const p = i * modSize;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(S, p); ctx.stroke();
  }

  // 3. Підсвічування крайніх рядів/стовпців зебри (рамка-зебра)
  for (let i = 0; i < T; i++) {
    const isBlack = (i % 2 === 0);
    const col = isBlack ? 'rgba(255,80,80,0.18)' : 'rgba(80,180,255,0.10)';
    ctx.fillStyle = col;
    ctx.fillRect(i * modSize, 0, modSize, modSize);
    ctx.fillRect(i * modSize, S - modSize, modSize, modSize);
    if (i > 0 && i < T - 1) ctx.fillRect(0, i * modSize, modSize, modSize);
    if (i > 0 && i < T - 1) ctx.fillRect(S - modSize, i * modSize, modSize, modSize);
  }

  // 4. Кутові маркери (жовті)
  ctx.fillStyle = 'rgba(255,220,50,0.40)';
  ctx.fillRect(0, 0, modSize, modSize);
  ctx.fillRect(S - modSize, 0, modSize, modSize);
  ctx.fillRect(S - modSize, S - modSize, modSize, modSize);
  ctx.fillRect(0, S - modSize, modSize, modSize);

  // 5. Зелена рамка внутрішньої зони
  ctx.strokeStyle = 'rgba(80,235,120,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(modSize, modSize, (T - 2) * modSize, (T - 2) * modSize);

  // ── 6. КРУЖЕЧКИ В ЦЕНТРІ КОЖНОЇ КЛІТИНКИ ВНУТРІШНЬОЇ ЗОНИ ──
  //   Внутрішня зона: від рядка/стовпця 1 до T-2 включно
  //   (індекс 0 і T-1 — це зебра-рамка)
  const circleR = modSize * 0.28;   // радіус кола — 28% від розміру клітинки
  const circleLineWidth = Math.max(0.8, modSize * 0.06);

  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = circleLineWidth;

  for (let row = 1; row < T - 1; row++) {
    for (let col = 1; col < T - 1; col++) {
      const cx = col * modSize + modSize / 2;
      const cy = row * modSize + modSize / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function pipeline(img, verbose = true) {
  const p = P();
  const log = verbose ? { h:Lh, ok:Lok, w:Lw, e:Le, i:Li } : { h:()=>{}, ok:()=>{}, w:()=>{}, e:()=>{}, i:()=>{} };

  log.h('1. ЗАВАНТАЖЕННЯ');
  const { idata, w, h } = loadImage(img, 900);
  log.i(`Розмір: ${w}×${h}`);

  log.h('2. МАСКА ТА КУТИ');
  const gray = toGray(idata, w, h);
  const bg = sampleBG(gray, w, h, 5);
  log.i('BG luma: ' + bg);

  const tols = [20, 30, 42, 55, 70, 90];
  let bestCorners = null, bestSpread = 0, bestTol = 0;
  for (const tol of tols) {
    const rm = makeMask(gray, w, h, bg, tol);
    const em = erodeMask(rm, w, h);
    const fgN = em.reduce((s,v)=>s+v,0);
    if (fgN < 50) { log.i('  tol=' + tol + ' FG=' + fgN + ' — пропуск'); continue; }
    const c = findCorners(em, w, h, 15);
    const sp = spread(c);
    log.i('  tol=' + tol + '  FG=' + fgN + '  spread=' + Math.round(sp) +
          'px  TL(' + c.tl.x + ',' + c.tl.y + ') TR(' + c.tr.x + ',' + c.tr.y + ')');
    if (sp > bestSpread) { bestSpread = sp; bestCorners = c; bestTol = tol; }
  }
  log.i('Обрано tol=' + bestTol + '  spread=' + Math.round(bestSpread) + 'px');

  if (!bestCorners || bestSpread < 30) {
    log.i('Маска не спрацювала — пробую variance-scan');
    const topRows = [], botRows = [], leftCols = [], rightCols = [];
    for (let y = 0; y < h; y++) {
      let sum = 0, sum2 = 0;
      for (let x = 0; x < w; x++) { const v = gray[y*w+x]; sum+=v; sum2+=v*v; }
      const avg = sum/w;
      const std = Math.sqrt(sum2/w - avg*avg);
      if (std > 50) { topRows.push(y); botRows.push(y); }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0, sum2 = 0;
      for (let y = 0; y < h; y++) { const v = gray[y*w+x]; sum+=v; sum2+=v*v; }
      const avg = sum/h;
      const std = Math.sqrt(sum2/h - avg*avg);
      if (std > 50) { leftCols.push(x); rightCols.push(x); }
    }
    topRows.sort((a,b)=>a-b); leftCols.sort((a,b)=>a-b);
    if (topRows.length > 0 && leftCols.length > 0) {
      const vTL = { x: leftCols[0], y: topRows[0] };
      const vTR = { x: leftCols[leftCols.length-1], y: topRows[0] };
      const vBR = { x: leftCols[leftCols.length-1], y: topRows[topRows.length-1] };
      const vBL = { x: leftCols[0], y: topRows[topRows.length-1] };
      const vc = { tl: vTL, tr: vTR, br: vBR, bl: vBL };
      const vsp = spread(vc);
      log.i('Variance: spread=' + Math.round(vsp) +
            '  TL(' + vTL.x + ',' + vTL.y + ') TR(' + vTR.x + ',' + vTR.y + ')');
      if (vsp > bestSpread) { bestCorners = vc; bestSpread = vsp; }
    }
  }

  if (!bestCorners || bestSpread < 20) {
    log.e('Рамку не знайдено (spread=' + Math.round(bestSpread) + ')');
    return { ok: false, idata, w, h };
  }

  const expand = 6;
  const corners = {
    tl: { x: bestCorners.tl.x - expand, y: bestCorners.tl.y - expand },
    tr: { x: bestCorners.tr.x + expand, y: bestCorners.tr.y - expand },
    br: { x: bestCorners.br.x + expand, y: bestCorners.br.y + expand },
    bl: { x: bestCorners.bl.x - expand, y: bestCorners.bl.y + expand }
  };

  log.h('3. ПЕРСПЕКТИВНА КОРЕКЦІЯ');
  const S = p.warp;
  const warped = warpPerspective(idata, w, h, corners, S);
  if (!warped) { log.e('Гомографія не вдалася'); return { ok: false, corners, idata, w, h }; }
  log.ok(`Warp → ${S}×${S}`);
  const wGray = toGray(warped, S, S);

  const zebra = detectZebra(wGray, S, p.zebCon);
  if (!zebra) {
    log.e('Зебру не знайдено');
    return { ok: false, corners, idata, w, h, warped, S };
  }
  log.ok(`T=${zebra.T} modSize=${zebra.modSize.toFixed(1)} px`);

  log.h('5. ПЕРЕВІРКА КУТОВИХ КВАДРАТІВ');
  const cornerCheck = verifyCornerBlack(wGray, S, zebra.modSize);

  log.h('6. АНАЛІЗ КРУЖЕЧКІВ');
  const circles = sampleCircles(warped, S, zebra.T, zebra.modSize);
  log.i(`  Клітинок: ${circles.cells.length}  (${zebra.T-2}×${zebra.T-2} внутрішніх)`);
  log.i(`  Радіус вибірки: ${circles.circleR.toFixed(1)} px`);

  // Статистика: розподіл яскравості
  const lumas = circles.cells.map(c => (c.r + c.g + c.b) / 3);
  const lumaMin = Math.min(...lumas).toFixed(0);
  const lumaMax = Math.max(...lumas).toFixed(0);
  const lumaMed = [...lumas].sort((a,b)=>a-b)[lumas.length>>1].toFixed(0);
  log.i(`  Яскравість: min=${lumaMin}  med=${lumaMed}  max=${lumaMax}`);

  // Авто-поріг: середнє між мін і макс
  const autoThr = (parseFloat(lumaMin) + parseFloat(lumaMax)) / 2;
  const bits = lumas.map(l => l > autoThr ? 1 : 0);
  const ones = bits.filter(b => b).length;
  log.i(`  Поріг авто=${autoThr.toFixed(0)} → 1: ${ones}  0: ${bits.length - ones}`);

  // Насиченість — колір чи моно?
  const sats = circles.cells.map(c => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b));
  const medSat = [...sats].sort((a,b)=>a-b)[sats.length>>1];
  const coloredCount = sats.filter(s => s > 60).length;
  const isColored = medSat > 25 || coloredCount >= Math.max(3, circles.cells.length * 0.15);
  log.i(`  Насиченість: медіана=${medSat.toFixed(0)}  кольорових=${coloredCount} → ${isColored ? 'КОЛІР' : 'МОНО'}`);

  // Бітовий рядок (перший рядок для preview)
  const rowLen = zebra.T - 2;
  const row0 = bits.slice(0, rowLen).join('');
  log.i(`  Рядок 0: ${row0}`);

  return { ok: true, corners, idata, w, h, warped, S, zebra, cornerCheck, circles, bits };
}

// ─────────────────────────────────────────────
//  sampleCircles — зчитує усереднений RGB
//  кожного внутрішнього кружечка сітки
// ─────────────────────────────────────────────
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

      // Перебираємо пікселі в bounding box кола
      const x0 = Math.max(0, Math.floor(cx - circleR));
      const x1 = Math.min(S - 1, Math.ceil(cx + circleR));
      const y0 = Math.max(0, Math.floor(cy - circleR));
      const y1 = Math.min(S - 1, Math.ceil(cy + circleR));

      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const dx = px - cx, dy = py - cy;
          if (dx * dx + dy * dy > r2) continue; // тільки всередині кола
          const idx = (py * S + px) * 4;
          sumR += d[idx];
          sumG += d[idx + 1];
          sumB += d[idx + 2];
          cnt++;
        }
      }

      if (cnt === 0) { cells.push({ r: 0, g: 0, b: 0, row, col }); continue; }
      cells.push({
        r: sumR / cnt,
        g: sumG / cnt,
        b: sumB / cnt,
        row, col
      });
    }
  }

  return { cells, circleR };
}

// ═══════════════════════════════════════════════════════
//  TAINA-ДЕКОДЕР — алгоритми з Дебаг-сканер v15
//  Працюють з масивом cells [{r,g,b}] з sampleCircles
// ═══════════════════════════════════════════════════════

const RGB_MAIN = {r:[255,0,0], g:[0,255,0], b:[0,0,255]};
const RGB_GAL  = {r:[220,50,60], g:[65,195,65], b:[60,70,215]};
const REFBITS  = [[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,1,1]];

const _enc = new TextEncoder();
const _dec = new TextDecoder('utf-8', {fatal:true});

function isClean(t) {
  for (const ch of t) { const o=ch.codePointAt(0); if(o===0)return false; if(o<32&&ch!=='\n'&&ch!=='\t')return false; } return true;
}
function bytesToText(by) {
  by = by.slice(); while(by.length && by[by.length-1]===0) by.pop();
  if(!by.length) return null;
  try { const t=_dec.decode(new Uint8Array(by)); return isClean(t)?t:null; } catch(e) { return null; }
}
function textBits(t) {
  const d=_enc.encode(t), b=new Uint8Array(d.length*8);
  for(let i=0;i<d.length;i++) for(let k=0;k<8;k++) b[i*8+k]=(d[i]>>(7-k))&1;
  return b;
}

function Rof(n) { return (n-1)/2; }

function baseCells(m, n) {
  const c=Rof(n), o=[];
  if(m==='oct')      { for(let i=0;i<=c;i++) for(let j=0;j<=i;j++) o.push([c+i,c+j]); }
  else if(m==='quad'){ for(let i=0;i<=c;i++) for(let j=0;j<=c;j++) o.push([c+i,c+j]); }
  else               { for(let y=0;y<n;y++) for(let i=0;i<=c;i++) o.push([c+i,y]); }
  return o;
}

function mirrors(m, n, x, y) {
  const c=Rof(n), i=x-c, j=y-c; let p;
  if(m==='oct')      p=[[i,j],[j,i],[-i,j],[-j,i],[i,-j],[j,-i],[-i,-j],[-j,-i]];
  else if(m==='quad') p=[[i,j],[-i,j],[i,-j],[-i,-j]];
  else                p=[[i,j],[-i,j]];
  const o=[];
  for(const[a,b] of p){ const X=c+a, Y=c+b; if(X>=0&&Y>=0&&X<n&&Y<n) o.push([X,Y]); }
  return o;
}

function fillChannel(t, n, m, markBit) {
  const g=new Uint8Array(n*n), bc=baseCells(m,n); let seq=textBits(t);
  if(markBit!==undefined&&markBit!==null){ const s2=new Uint8Array(seq.length+1); s2[0]=markBit; s2.set(seq,1); seq=s2; }
  const lim=Math.min(seq.length,bc.length);
  for(let i=0;i<lim;i++){ const[x,y]=bc[i]; for(const[X,Y] of mirrors(m,n,x,y)) if(seq[i]) g[Y*n+X]=1; }
  return g;
}

function markCell(g, n, m) { const[x,y]=baseCells(m,n)[0]; return g[y*n+x]?1:0; }

function agree(g, chk, n) {
  let ok=0; for(let z=0;z<n*n;z++) ok+=((chk[z]?1:0)===g[z])?1:0; return ok/(n*n);
}

function decodeVoted(g, n, m, off, conf) {
  const bc=baseCells(m,n), by=[];
  for(let i=off||0; i+7<bc.length; i+=8){
    let v=0;
    for(let b=0;b<8;b++){
      const[x,y]=bc[i+b], cells=mirrors(m,n,x,y);
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
  return { text: bytesToText(by), bytes: by };
}

function refsFor(S) {
  const mix=(r,g,b)=>[Math.min(255,(r?S.r[0]:0)+(g?S.g[0]:0)+(b?S.b[0]:0)),
                      Math.min(255,(r?S.r[1]:0)+(g?S.g[1]:0)+(b?S.b[1]:0)),
                      Math.min(255,(r?S.r[2]:0)+(g?S.g[2]:0)+(b?S.b[2]:0))];
  return REFBITS.map(c=>({bits:c, col:mix(c[0],c[1],c[2])}));
}

function classifyCells(cells, n) {
  const pals = [['насичена',RGB_MAIN],['галерейна',RGB_GAL]];
  let best = null;
  for(const[name,S] of pals){
    const refs=refsFor(S); let err=0;
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

function symScore(gl, n) {
  // oct-групи для оцінки симетрії
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

// ── Головна функція декодування з кружечків ──
function decodeCircles(circles, T, log) {
  const cells = circles.cells;
  const n = T - 2; // розмір внутрішньої сітки даних

  if(n < 7 || n % 2 === 0) {
    log.w(`n=${n} — замалий або парний, декод пропущено`);
    return null;
  }

  // Масив яскравостей для mono-сітки
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

  // Насиченість
  const sats = cells.map(c => Math.max(c.r,c.g,c.b) - Math.min(c.r,c.g,c.b));
  const medSat = [...sats].sort((a,b)=>a-b)[sats.length>>1];
  const coloredCount = sats.filter(s=>s>60).length;
  const isColored = medSat > 25 || coloredCount >= Math.max(3, n * 0.15);

  log.i(`  n=${n}  поріг=${autoThr.toFixed(0)}  ${isColored?'КОЛІР':'МОНО'}`);

  // Симетрія
  const sym = symScore(gl, n);
  log.i(`  симетрія=${sym.frac.toFixed(3)}`);

  const modes = ['oct','quad','half'];

  if(!isColored) {
    // ── МОНО ──
    log.h('7. ДЕКОД МОНО');
    let best = null;
    for(const m of modes){
      const v = decodeVoted(gl, n, m, 0, confMono);
      if(v.text !== null){
        const a = agree(gl, fillChannel(v.text, n, m), n);
        log.ok(`[${m}] "${v.text}"  узгодж=${a.toFixed(3)}`);
        if(!best || a > best.a) best = {v, a, m};
      } else {
        log.i(`  [${m}] null`);
      }
    }
    return best ? {type:`МОНО·${best.m}`, text:best.v.text} : {type:'МОНО', text:null};
  } else {
    // ── КОЛІР ──
    log.h('7. ДЕКОД КОЛІР');
    const cls = classifyCells(cells, n);
    log.i(`  палітра: ${cls.name}`);

    const confR=new Float32Array(n*n), confG=new Float32Array(n*n), confB=new Float32Array(n*n);
    cells.forEach((c,i)=>{
      confR[i]=Math.min(1,Math.abs(c.r-128)/90);
      confG[i]=Math.min(1,Math.abs(c.g-128)/90);
      confB[i]=Math.min(1,Math.abs(c.b-128)/90);
    });

    let best = null;
    for(const m of modes){
      const rMark = markCell(cls.cr, n, m);
      let vr = decodeVoted(cls.cr, n, m, rMark?1:0, confR);
      if(rMark && vr.text===null) vr = decodeVoted(cls.cr, n, m, 0, confR);
      const vg = decodeVoted(cls.cg, n, m, 0, confG);
      const vb = decodeVoted(cls.cb, n, m, 0, confB);
      const nn = [vr.text, vg.text, vb.text].filter(t=>t!==null);
      log.i(`  [${m}] R:${vr.text!==null?'"'+vr.text+'"':'null'}  G:${vg.text!==null?'"'+vg.text+'"':'null'}  B:${vb.text!==null?'"'+vb.text+'"':'null'}`);
      if(!nn.length) continue;
      const sc = nn.length*1000 + nn.reduce((a,t)=>a+t.length,0);
      if(!best||sc>best.sc) best={vr,vg,vb,nn,sc,m,cls,rMark};
    }
    if(!best) return {type:`КОЛІР·${cls.name}`, text:null};
    const parts = [best.vr.text, best.vg.text, best.vb.text].filter(t=>t!==null);
    const allSame = parts.every(t=>t===parts[0]);
    const text = best.rMark ? (allSame ? parts[0] : parts.join('')) : parts.join(' · ');
    log.ok(`[${best.m}] "${text}"`);
    return {type:`КОЛІР·${cls.name}·${best.m}`, text};
  }
}

// ═══════════════════════════════════════════════════════

function run(img) {
  clr();
  setSt('обробка…', null);

  const result = pipeline(img, true);
  const mainCnv = document.getElementById('cnv');
  if (result.warped) {
    drawOutput(result.warped, result.S, result.ok ? result.zebra : null, mainCnv);
  } else {
    drawInput(result.idata, result.w, result.h, result.corners, mainCnv);
  }

  if (result.ok) {
    const z = result.zebra;
    setSt(`✓ T=${z.T}  mod=${z.modSize.toFixed(1)}px`, true);
    Lok(`Кружечки: ${(z.T-2)*(z.T-2)} шт.  r=${(z.modSize*0.28).toFixed(1)}px`);

    // ── TAINA-декод ──
    if(result.circles) {
      const log2 = { h:Lh, ok:Lok, w:Lw, e:Le, i:Li };
      const decoded = decodeCircles(result.circles, z.T, log2);
      if(decoded && decoded.text !== null) {
        Lok(`РЕЗУЛЬТАТ: "${decoded.text}"  [${decoded.type}]`);
        setSt(`✓ "${decoded.text}"`, true);
      } else {
        Lw(`Декод: текст не зібрався  [${decoded ? decoded.type : '—'}]`);
      }
    }
  } else {
    setSt('✗ рамку не знайдено', false);
  }
}
</script>
</body>
</html>
