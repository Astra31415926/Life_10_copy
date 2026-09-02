// decoder.js · taina · робастний декодер байткоду (v3)
// ─────────────────────────────────────────────────────────────
// Ідея: зовнішня суцільна тёмна рамка коду — це замкнений квадратний
// контур (finder). Він завжди чорно-білий (FRAME_A/FRAME_B), тож контраст
// гарантований незалежно від палітри чи RGB.
//
// Конвеєр (як у бібліотеках QR, але адаптовано під твій формат):
//   1. адаптивна бінаризація (Bradley / інтегральне зображення)
//   2. пошук рамки = найбільша майже-квадратна тёмна компонента → 4 кути
//   3. гомографія → вирівнювання навіть під нахилом
//   4. вимір модуля з товщини рамки, підбір T, вибірка n×n у центрах модулів
//   5. класифікація (ч/б або 8-кольорова RGB) + декод за baseCells/mirrors
//      + перевірка re-encode ≥ MIN_AGREE («краще не прочитати, ніж збрехати»)
//
// Публічний API незмінний:  runDecodeAttempts(imgOrCanvas)
//   повертає масив { kind:'one'|'three'|'mono', mode, n, res:[r,g,b] }
//
// Залежить від глобалів із index.html (викликаються під час декоду, тож доступні):
//   baseCells, mirrors, fillChannel, markCell, bytesToText, MINN, RGB_SOFT
// ─────────────────────────────────────────────────────────────
'use strict';

const DEC = {
  MAXPX_FILE: 1600,   // до якого розміру масштабувати файл
  MAXPX_CAM : 1000,   // ... і кадр камери
  CC_GRID   : 220,    // роздільність коарс-сітки для пошуку рамки (швидкість)
  DESKEW_N  : 800,    // розмір вирівняного квадрата
  MIN_AGREE : 0.90,   // мін. згода re-encode для прийняття результату
  MIN_MARGIN: 0.5,    // мін. запас голосування по дзеркальних копіях
  PAD       : 3,      // товщина рамки (модулів) — фіксовано форматом
  SAT       : 55      // поріг «кольоровості» модуля (RGB vs ч/б)
};

const ND_PAL2   = { r:[220,50,60], g:[65,195,65], b:[60,70,215] };
const ND_REFBITS = [[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,1,1]];

// ═══════════════ 1. БІНАРИЗАЦІЯ ═══════════════
function _lum(px,i){ return (px[i*4]+px[i*4+1]+px[i*4+2])/3; }

function integralImage(px,W,H){
  const I=new Float64Array((W+1)*(H+1)), st=W+1;
  for(let y=0;y<H;y++){ let row=0;
    for(let x=0;x<W;x++){ row+=_lum(px,y*W+x);
      I[(y+1)*st+(x+1)] = I[y*st+(x+1)] + row; } }
  return I;
}
// адаптивний поріг (Bradley): 1 = світлий, 0 = тёмний
function binarize(px,W,H,winFrac,tPct){
  const I=integralImage(px,W,H), st=W+1;
  const S=Math.max(2,Math.floor(W*(winFrac||0.10))), t=(tPct==null?12:tPct);
  const out=new Uint8Array(W*H);
  for(let y=0;y<H;y++){
    const y1=Math.max(0,y-S), y2=Math.min(H-1,y+S);
    for(let x=0;x<W;x++){
      const x1=Math.max(0,x-S), x2=Math.min(W-1,x+S);
      const cnt=(x2-x1+1)*(y2-y1+1);
      const sum=I[(y2+1)*st+(x2+1)]-I[y1*st+(x2+1)]-I[(y2+1)*st+x1]+I[y1*st+x1];
      out[y*W+x]=(_lum(px,y*W+x)*cnt <= sum*(100-t)/100)?0:1;
    }
  }
  return out;
}

function otsu(gray){
  const h=new Uint32Array(256);
  for(let i=0;i<gray.length;i++){ let v=gray[i]|0; if(v<0)v=0; else if(v>255)v=255; h[v]++; }
  const total=gray.length; let sum=0; for(let t=0;t<256;t++)sum+=t*h[t];
  let sumB=0,wB=0,mx=0,thr=127;
  for(let t=0;t<256;t++){ wB+=h[t]; if(!wB)continue; const wF=total-wB; if(!wF)break;
    sumB+=t*h[t]; const mB=sumB/wB, mF=(sum-sumB)/wF, bt=wB*wF*(mB-mF)*(mB-mF);
    if(bt>mx){ mx=bt; thr=t; } }
  return thr;
}

// ═══════════════ 2. ПОШУК РАМКИ → 4 КУТИ ═══════════════
function coarseFrameComponent(bin,W,H){
  const gw=Math.min(DEC.CC_GRID,W), gh=Math.max(1,Math.round(gw*H/W));
  const bw=W/gw, bh=H/gh, dark=new Uint8Array(gw*gh);
  for(let gy=0;gy<gh;gy++)for(let gx=0;gx<gw;gx++){
    const x0=Math.floor(gx*bw), x1=Math.max(x0+1,Math.floor((gx+1)*bw));
    const y0=Math.floor(gy*bh), y1=Math.max(y0+1,Math.floor((gy+1)*bh));
    let d=0,c=0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){ c++; if(!bin[y*W+x])d++; }
    dark[gy*gw+gx]=(c && d*2>=c)?1:0;
  }
  const scan=filterSquare=>{
    const lab=new Int32Array(gw*gh), st=[]; let cur=0,best=null;
    for(let s=0;s<gw*gh;s++){
      if(!dark[s]||lab[s])continue;
      cur++; let minx=gw,miny=gh,maxx=0,maxy=0,area=0; st.push(s); lab[s]=cur;
      while(st.length){
        const p=st.pop(), x=p%gw, y=(p/gw)|0; area++;
        if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y;
        const nx=[x-1,x+1,x,x], ny=[y,y,y-1,y+1];
        for(let k=0;k<4;k++){ const ax=nx[k],ay=ny[k];
          if(ax<0||ay<0||ax>=gw||ay>=gh)continue;
          const q=ay*gw+ax; if(dark[q]&&!lab[q]){ lab[q]=cur; st.push(q); } }
      }
      const w=maxx-minx+1, h=maxy-miny+1, bbox=w*h, asp=w/h;
      const ok = bbox>gw*gh*0.03 && (!filterSquare || (asp>0.5 && asp<2.0));
      if(ok && (!best||bbox>best.bbox)) best={minx,miny,maxx,maxy,area,bbox};
    }
    return best;
  };
  const best = scan(true) || scan(false);   // спершу «квадратна» рамка, потім будь-яка велика тёмна
  return best ? {best,bw,bh} : null;
}

function findFrameQuad(bin,W,H){
  const r=coarseFrameComponent(bin,W,H); if(!r)return null;
  const {best,bw,bh}=r;
  const bx0=Math.max(0,Math.floor(best.minx*bw)-2), by0=Math.max(0,Math.floor(best.miny*bh)-2);
  const bx1=Math.min(W-1,Math.ceil((best.maxx+1)*bw)+2), by1=Math.min(H-1,Math.ceil((best.maxy+1)*bh)+2);
  // точні кути = екстремуми тёмних пікселів у ROI (працює під поворотом до ~40°)
  let TL=null,TR=null,BR=null,BL=null;
  for(let y=by0;y<=by1;y++)for(let x=bx0;x<=bx1;x++){
    if(bin[y*W+x])continue;
    const s=x+y, d=x-y;
    if(!TL||s<TL.s)TL={x,y,s};
    if(!BR||s>BR.s)BR={x,y,s};
    if(!TR||d>TR.d)TR={x,y,d};
    if(!BL||d<BL.d)BL={x,y,d};
  }
  if(!TL||!TR||!BR||!BL)return null;
  const area=Math.abs((TR.x-TL.x)*(BL.y-TL.y)-(BL.x-TL.x)*(TR.y-TL.y));
  if(area < W*H*0.01) return null;         // вироджений чотирикутник — відкинути
  return { TL:[TL.x,TL.y], TR:[TR.x,TR.y], BR:[BR.x,BR.y], BL:[BL.x,BL.y] };
}

// ═══════════════ 3. ГОМОГРАФІЯ + ВИРІВНЮВАННЯ ═══════════════
function _solveLS8(A,b){ const n=8, M=A.map((row,i)=>[...row,b[i]]);
  for(let col=0;col<n;col++){ let mr=col;
    for(let r=col+1;r<n;r++)if(Math.abs(M[r][col])>Math.abs(M[mr][col]))mr=r;
    [M[col],M[mr]]=[M[mr],M[col]];
    for(let r=0;r<n;r++)if(r!==col){ const f=M[r][col]/M[col][col];
      for(let c=col;c<=n;c++)M[r][c]-=f*M[col][c]; } }
  return M.map((row,i)=>row[n]/row[i]); }
function computeH(cor,N){
  const pts=[cor.TL,cor.TR,cor.BR,cor.BL], dst=[[0,0],[N,0],[N,N],[0,N]], A=[],b=[];
  for(let i=0;i<4;i++){ const [x,y]=pts[i], [u,v]=dst[i];
    A.push([x,y,1,0,0,0,-u*x,-u*y]); b.push(u);
    A.push([0,0,0,x,y,1,-v*x,-v*y]); b.push(v); }
  const h=_solveLS8(A,b);
  return [[h[0],h[1],h[2]],[h[3],h[4],h[5]],[h[6],h[7],1]]; }
function invertH(H){
  const [a,b,c]=H[0],[d,e,f]=H[1],[g,h,k]=H[2];
  const det=a*(e*k-f*h)-b*(d*k-f*g)+c*(d*h-e*g); if(Math.abs(det)<1e-12)return null;
  return [[(e*k-f*h)/det,(c*h-b*k)/det,(b*f-c*e)/det],
          [(f*g-d*k)/det,(a*k-c*g)/det,(c*d-a*f)/det],
          [(d*h-e*g)/det,(b*g-a*h)/det,(a*e-b*d)/det]]; }
function deskew(px,IW,IH,cor,N){
  const Hi=invertH(computeH(cor,N)); if(!Hi)return new Uint8ClampedArray(N*N*4);
  const out=new Uint8ClampedArray(N*N*4);
  for(let dy=0;dy<N;dy++)for(let dx=0;dx<N;dx++){
    let sx=Hi[0][0]*(dx+.5)+Hi[0][1]*(dy+.5)+Hi[0][2];
    let sy=Hi[1][0]*(dx+.5)+Hi[1][1]*(dy+.5)+Hi[1][2];
    let sw=Hi[2][0]*(dx+.5)+Hi[2][1]*(dy+.5)+Hi[2][2];
    sx/=sw; sy/=sw;
    const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(IW-1,x0+1),y1=Math.min(IH-1,y0+1);
    const fx=sx-x0,fy=sy-y0,o=(dy*N+dx)*4;
    if(x0<0||y0<0||x0>=IW||y0>=IH){ out[o+3]=255; continue; }
    const p00=(y0*IW+x0)*4,p10=(y0*IW+x1)*4,p01=(y1*IW+x0)*4,p11=(y1*IW+x1)*4;
    for(let c=0;c<3;c++)out[o+c]=
      px[p00+c]*(1-fx)*(1-fy)+px[p10+c]*fx*(1-fy)+px[p01+c]*(1-fx)*fy+px[p11+c]*fx*fy;
    out[o+3]=255;
  }
  return out;
}

// ═══════════════ 4. ВИМІР МОДУЛЯ + ВИБІРКА СІТКИ ═══════════════
function firstDarkRun(get,len,thr){
  let i=0; while(i<len && get(i)>=thr) i++;   // пропустити світле поле/тиху зону
  if(i>=len)return 0;
  let r=0; while(i<len && get(i)<thr){ i++; r++; }
  return r;                                    // товщина першого тёмного шару ≈ 1 модуль
}
function measureModule(gray,N,thr){
  const at=(x,y)=>gray[y*N+x], runs=[], lim=N*0.18;
  for(const f of [0.3,0.4,0.5,0.6,0.7]){
    const c=Math.round(N*f); let r;
    r=firstDarkRun(k=>at(c,k),N,thr);       if(r>1&&r<lim)runs.push(r); // згори
    r=firstDarkRun(k=>at(c,N-1-k),N,thr);   if(r>1&&r<lim)runs.push(r); // знизу
    r=firstDarkRun(k=>at(k,c),N,thr);       if(r>1&&r<lim)runs.push(r); // зліва
    r=firstDarkRun(k=>at(N-1-k,c),N,thr);   if(r>1&&r<lim)runs.push(r); // справа
  }
  if(!runs.length)return null;
  runs.sort((a,b)=>a-b);
  return runs[runs.length>>1];
}
function rotate90(a,n){ const o=new a.constructor(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)o[x*n+(n-1-y)]=a[y*n+x];
  return o; }

// ═══════════════ 5. КЛАСИФІКАЦІЯ + ДЕКОД + ПЕРЕВІРКА ═══════════════
function decodeVoted(g,n,m,offset){
  const bc=baseCells(m,n), by=[], margins=[], start=offset||0;
  for(let i=start;i+7<bc.length;i+=8){ let v=0;
    for(let b=0;b<8;b++){ const [x,y]=bc[i+b], cells=mirrors(m,n,x,y);
      let ones=0; for(const [X,Y] of cells)ones+=g[Y*n+X]?1:0; const cnt=cells.length;
      let bit; if(ones*2>cnt)bit=1; else if(ones*2<cnt)bit=0; else bit=g[y*n+x]?1:0;
      margins.push(Math.abs(2*ones-cnt)/cnt); v=(v<<1)|bit; }
    by.push(v); }
  return { text:bytesToText(by), minMargin:margins.length?Math.min(...margins):0 };
}
function agree(g,chk,n){ let ok=0; for(let z=0;z<n*n;z++)ok+=((chk[z]?1:0)===g[z])?1:0; return ok/(n*n); }

function refsFor(S){
  const mix=(r,g,b)=>[Math.min(255,(r?S.r[0]:0)+(g?S.g[0]:0)+(b?S.b[0]:0)),
                      Math.min(255,(r?S.r[1]:0)+(g?S.g[1]:0)+(b?S.b[1]:0)),
                      Math.min(255,(r?S.r[2]:0)+(g?S.g[2]:0)+(b?S.b[2]:0))];
  return ND_REFBITS.map(c=>({bits:c,col:mix(c[0],c[1],c[2])}));
}
// розкладаємо кольорові модулі на 3 канали (пробуємо обидві RGB-палітри)
function classifyRGB(R,G,B,n){
  const pals=(typeof RGB_SOFT!=='undefined')?[RGB_SOFT,ND_PAL2]:[ND_PAL2];
  let best=null;
  for(const S of pals){ const refs=refsFor(S); let err=0;
    const cr=new Uint8Array(n*n),cg=new Uint8Array(n*n),cb=new Uint8Array(n*n);
    for(let i=0;i<n*n;i++){ const r=R[i],g=G[i],b=B[i]; let bi=0,bd=1e9;
      for(let k=0;k<refs.length;k++){ const q=refs[k].col,dr=r-q[0],dg=g-q[1],db=b-q[2],d=dr*dr+dg*dg+db*db;
        if(d<bd){ bd=d; bi=k; } }
      err+=bd; const t=refs[bi].bits; cr[i]=t[0]; cg[i]=t[1]; cb[i]=t[2]; }
    if(!best||err<best.err)best={err,cr,cg,cb};
  }
  return best;
}

// з готової вибірки n×n дає всі валідні варіанти прочитання
function decodeSampled(R,G,B,L,n){
  const out=[], modes=['oct','quad','half'];

  // моно-шар (за яскравістю L) — покриває і ч/б, і одношаровий кольоровий код
  for(const m of modes){
    const v=decodeVoted(L,n,m,0);
    if(v.text!==null && v.minMargin>=DEC.MIN_MARGIN){
      const a=agree(L,fillChannel(v.text,n,m,null).g,n);
      if(a>=DEC.MIN_AGREE) out.push({kind:'one',score:a,mode:m,n,res:[v.text,null,null]});
    }
  }
  // RGB: три незалежні канали або моноліт (мітка в R, offset=1)
  const cls=classifyRGB(R,G,B,n);
  for(const m of modes){
    const vr=decodeVoted(cls.cr,n,m,0), vg=decodeVoted(cls.cg,n,m,0), vb=decodeVoted(cls.cb,n,m,0);
    const ne=[vr.text,vg.text,vb.text].filter(t=>t!==null);
    if(ne.length>=2 && !ne.every(t=>t===ne[0])){
      const aR=agree(cls.cr,fillChannel(vr.text||'',n,m,null).g,n);
      const aG=agree(cls.cg,fillChannel(vg.text||'',n,m,null).g,n);
      const aB=agree(cls.cb,fillChannel(vb.text||'',n,m,null).g,n);
      const sc=Math.min(aR,aG,aB);
      if(sc>=DEC.MIN_AGREE) out.push({kind:'three',score:sc,mode:m,n,res:[vr.text,vg.text,vb.text]});
    }
    if(markCell(cls.cr,n,m)===1){
      const rR=decodeVoted(cls.cr,n,m,1);
      if(rR.text!==null){
        const rG=decodeVoted(cls.cg,n,m,0), rB=decodeVoted(cls.cb,n,m,0);
        const aR=agree(cls.cr,fillChannel(rR.text,n,m,1).g,n);
        const aG=agree(cls.cg,fillChannel(rG.text||'',n,m,null).g,n);
        const aB=agree(cls.cb,fillChannel(rB.text||'',n,m,null).g,n);
        if(Math.min(aR,aG,aB)>=DEC.MIN_AGREE)
          out.push({kind:'mono',score:Math.min(aR,aG,aB),mode:m,n,
                    res:[(rR.text||'')+(rG.text||'')+(rB.text||''),null,null]});
      }
    }
  }
  return out;
}

// читає вже вирівняний квадрат: вимір T, вибірка, 4 повороти
function readDeskewed(px,N){
  const gray=new Float32Array(N*N);
  for(let i=0;i<N*N;i++)gray[i]=(px[i*4]+px[i*4+1]+px[i*4+2])/3;
  const thr=otsu(gray), mod=measureModule(gray,N,thr);
  if(!mod)return [];
  const Test=Math.round(N/mod), out=[], seen=new Set();
  const push=r=>{ const k=r.kind+'|'+r.res.join('\u0001'); if(!seen.has(k)){ seen.add(k); out.push(r); } };

  for(let dT=-2;dT<=2;dT++){
    const T=Test+dT;
    if(T<13 || T%2===0) continue;         // T=n+6, n непарне ≥7 → T непарне ≥13
    const n=T-2*DEC.PAD;
    if(n<MINN || n%2===0 || n>145) continue;
    const module=N/T;
    let R=new Uint8Array(n*n),G=new Uint8Array(n*n),B=new Uint8Array(n*n),L=new Uint8Array(n*n);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const cx=(x+DEC.PAD+0.5)*module, cy=(y+DEC.PAD+0.5)*module;
      let sr=0,sg=0,sb=0,c=0;                // усереднення 3×3 для стабільності
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const sx=Math.min(N-1,Math.max(0,Math.round(cx+dx))), sy=Math.min(N-1,Math.max(0,Math.round(cy+dy)));
        const p=(sy*N+sx)*4; sr+=px[p]; sg+=px[p+1]; sb+=px[p+2]; c++;
      }
      const i=y*n+x; R[i]=sr/c; G[i]=sg/c; B[i]=sb/c; L[i]=((sr+sg+sb)/3/c)>thr?1:0;
    }
    for(let rot=0;rot<4;rot++){             // орієнтація невідома → 4 повороти
      for(const r of decodeSampled(R,G,B,L,n)) push(r);
      if(rot<3){ R=rotate90(R,n); G=rotate90(G,n); B=rotate90(B,n); L=rotate90(L,n); }
    }
  }
  out.sort((a,b)=>{
    const la=a.res.filter(x=>x).join('').length, lb=b.res.filter(x=>x).join('').length;
    return (lb!==la)?lb-la:(b.score||0)-(a.score||0);
  });
  return out;
}

// ═══════════════ ГОЛОВНА ТОЧКА ВХОДУ ═══════════════
function runDecodeAttempts(source){
  const isCanvas=(typeof HTMLCanvasElement!=='undefined')&&(source instanceof HTMLCanvasElement);
  const iw=source.naturalWidth||source.videoWidth||source.width||0;
  const ih=source.naturalHeight||source.videoHeight||source.height||0;
  if(iw<1||ih<1)return [];

  const MAX=isCanvas?DEC.MAXPX_CAM:DEC.MAXPX_FILE;
  const scale=Math.min(1,MAX/Math.max(iw,ih));
  const W=Math.round(iw*scale), H=Math.round(ih*scale);
  const cc=document.createElement('canvas'); cc.width=W; cc.height=H;
  const g=cc.getContext('2d',{willReadFrequently:true});
  g.imageSmoothingEnabled=true; g.drawImage(source,0,0,iw,ih,0,0,W,H);
  const px=g.getImageData(0,0,W,H).data;

  const all=[];
  const solid=r=>r&&(r.kind==='one'||r.kind==='three'||r.kind==='mono');
  const keyOf=r=>r.kind+'|'+r.res.join('\u0001');
  const merge=list=>{ for(const r of list){ const k=keyOf(r); if(!all.some(a=>keyOf(a)===k))all.push(r); } };

  const binConfigs=isCanvas?[[0.11,12],[0.16,8]]:[[0.11,12],[0.08,10],[0.16,14]];

  // 1) головний шлях: рамка → гомографія → читання
  for(const [wf,tp] of binConfigs){
    try{
      const bin=binarize(px,W,H,wf,tp);
      const quad=findFrameQuad(bin,W,H);
      if(!quad)continue;
      const d=deskew(px,W,H,quad,DEC.DESKEW_N);
      const rs=readDeskewed(d,DEC.DESKEW_N);
      if(rs.length){ merge(rs); const s=all.find(solid); if(s)return [s]; }
    }catch(e){}
  }

  // 2) запас: вважати центральний квадрат уже вирівняним кодом
  //    (ідеальні PNG/скріни без нахилу, коли рамку не вдалось локалізувати)
  try{
    const side=Math.min(W,H), x0=Math.floor((W-side)/2), y0=Math.floor((H-side)/2);
    const cv=document.createElement('canvas'); cv.width=cv.height=DEC.DESKEW_N;
    const ctx=cv.getContext('2d',{willReadFrequently:true}); ctx.imageSmoothingEnabled=true;
    ctx.drawImage(cc,x0,y0,side,side,0,0,DEC.DESKEW_N,DEC.DESKEW_N);
    const dpx=ctx.getImageData(0,0,DEC.DESKEW_N,DEC.DESKEW_N).data;
    const rs=readDeskewed(dpx,DEC.DESKEW_N);
    if(rs.length){ merge(rs); const s=all.find(solid); if(s)return [s]; }
  }catch(e){}

  all.sort((a,b)=>b.res.filter(x=>x).join('').length-a.res.filter(x=>x).join('').length);
  return all;
}
