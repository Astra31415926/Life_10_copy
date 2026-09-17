<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>TAINA SCANNER</title>
<style>
:root{
  --bg:#060608;--bg2:#0a0a12;--border:#141420;--border2:#1e1e2e;
  --text:#9a9aaa;--dim:#444;--accent:#3a7aaa;
  --ok:#2a7a3a;--warn:#8a6010;--err:#8a2020;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--bg);color:var(--text);font:11px/1.6 'Courier New',monospace;overflow:hidden;}
#app{display:grid;grid-template-columns:460px 1fr;grid-template-rows:100vh;height:100vh;overflow:hidden;}
#left{display:flex;flex-direction:column;border-right:1px solid var(--border);overflow:hidden;min-height:0;}
#topbar{padding:8px 10px;border-bottom:1px solid var(--border);display:flex;gap:5px;align-items:center;flex-shrink:0;flex-wrap:wrap;}
h1{font-size:10px;letter-spacing:3px;color:var(--accent);margin-right:4px}
.btn{background:var(--bg2);border:1px solid var(--border2);color:#6a6a8a;padding:4px 10px;cursor:pointer;font:inherit;letter-spacing:1px;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
.btn:hover,.btn:active{border-color:var(--accent);color:#ccc}
input[type=file]{display:none}
#canvas-wrap{flex:1;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center;position:relative;min-height:0;}
#cnv{display:block;max-width:100%;max-height:100%;image-rendering:pixelated;}
#vidWrap{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:#000;overflow:hidden;}
#vid{width:100%;height:100%;object-fit:cover;display:block;}
#finder{position:absolute;inset:0;pointer-events:none;}
#finder-frame{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(70vw,260px);height:min(70vw,260px);box-shadow:0 0 0 9999px rgba(0,0,0,0.55);}
#finder-frame::before,#finder-frame::after,.finder-corner-br,.finder-corner-bl{content:'';position:absolute;width:22px;height:22px;border-color:#fff;border-style:solid;}
#finder-frame::before{top:0;left:0;border-width:3px 0 0 3px}
#finder-frame::after{top:0;right:0;border-width:3px 3px 0 0}
.finder-corner-br{bottom:0;right:0;border-width:0 3px 3px 0}
.finder-corner-bl{bottom:0;left:0;border-width:0 0 3px 3px}
#scan-line{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent);animation:scan 1.5s ease-in-out infinite;}
@keyframes scan{0%{top:0}50%{top:100%}100%{top:0}}
#timer-bar-wrap{position:absolute;bottom:0;left:0;right:0;height:3px;background:var(--border);display:none;}
#timer-bar{height:100%;background:var(--accent);width:100%;transition:width linear;}
#status-bar{flex-shrink:0;padding:5px 10px;border-top:1px solid var(--border);font-size:10px;letter-spacing:2px;min-height:24px;}
#status-bar span{font-weight:700;font-size:12px}
#right{display:flex;flex-direction:column;overflow:hidden;min-height:0;}
#tabs{display:flex;border-bottom:1px solid var(--border);flex-shrink:0}
.tab{padding:6px 14px;cursor:pointer;font:inherit;font-size:10px;letter-spacing:2px;color:var(--dim);background:none;border:none;border-right:1px solid var(--border);}
.tab.sel{color:var(--accent);background:var(--bg2)}
#pane-log{flex:1;overflow-y:auto;padding:8px 10px;line-height:1.75;display:none}
#pane-log.vis{display:block}
.lh{color:var(--accent);margin-top:5px}.lok{color:var(--ok)}.lw{color:var(--warn)}.le{color:var(--err)}.li{color:#6a6a8a}
#result-box{flex-shrink:0;padding:10px;border-top:1px solid var(--border);font-size:13px;letter-spacing:1px;min-height:36px;word-break:break-all;display:none;}
#result-box.vis{display:block}
#pane-rgb{flex:1;overflow-y:auto;padding:8px 10px;line-height:1.75;display:none}
#pane-rgb.vis{display:block}
#rgb-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:4px 0}
.rgb-tile{display:flex;flex-direction:column;gap:3px}
.rgb-tile canvas{width:100%;image-rendering:pixelated;border:1px solid var(--border2)}
.rgb-lbl{font-size:9px;letter-spacing:2px;text-align:center;color:#3a5a7a}
@media(max-width:700px){
  html,body{overflow:auto}
  #app{display:flex;flex-direction:column;height:auto;min-height:100vh;}
  #left{border-right:none;border-bottom:1px solid var(--border);min-height:0;flex-shrink:0;}
  #canvas-wrap{height:min(100vw,420px);flex:none;}
  #right{flex:1;min-height:200px;overflow:visible;}
  #pane-log,#pane-rgb{flex:none;max-height:none;overflow-y:visible;}
  #result-box{font-size:15px}
}
</style>
</head>
<body>
<div id="app">
  <div id="left">
    <div id="topbar">
      <h1>TAINA·SCAN</h1>
      <button class="btn" id="camBtn">◎ Камера</button>
      <label class="btn">▶ Файл<input type="file" id="fin" accept="image/*"></label>
      <button class="btn" id="stopBtn" style="display:none">■ Стоп</button>
    </div>
    <div id="canvas-wrap">
      <canvas id="cnv"></canvas>
      <div id="vidWrap">
        <video id="vid" autoplay playsinline muted></video>
        <div id="finder">
          <div id="finder-frame">
            <div class="finder-corner-br"></div>
            <div class="finder-corner-bl"></div>
            <div id="scan-line"></div>
          </div>
        </div>
      </div>
      <div id="timer-bar-wrap"><div id="timer-bar"></div></div>
    </div>
    <div id="status-bar"><span id="st" style="color:#2a2a3a">— очікування —</span></div>
  </div>
  <div id="right">
    <div id="tabs">
      <button class="tab sel" data-pane="log">ДІАГНОСТИКА</button>
      <button class="tab" data-pane="rgb">RGB</button>
    </div>
    <div id="pane-log" class="vis"></div>
    <div id="pane-rgb"><div id="rgb-grid"></div></div>
    <div id="result-box"></div>
  </div>
</div>

<script>
'use strict';

// ═══════════════════════════════════════════════
// LOG SYSTEM
// ═══════════════════════════════════════════════
const logEl=document.getElementById('pane-log');
const aL=(m,c)=>{const d=document.createElement('div');d.textContent=m;if(c)d.className=c;logEl.appendChild(d);logEl.scrollTop=logEl.scrollHeight;};
const Lh=m=>aL('── '+m,'lh');
const Lok=m=>aL('✓ '+m,'lok');
const Lw=m=>aL('⚠ '+m,'lw');
const Le=m=>aL('✗ '+m,'le');
const Li=m=>aL(m,'li');
const clrLog=()=>{logEl.innerHTML='';};
const setSt=(t,ok)=>{const el=document.getElementById('st');el.textContent=t;el.style.color=ok===true?'#55eb5a':ok===false?'#eb5555':'#888';};

document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('sel'));
    btn.classList.add('sel');
    const p=btn.dataset.pane;
    ['log','rgb'].forEach(n=>document.getElementById('pane-'+n).classList.toggle('vis',n===p));
  });
});

// ═══════════════════════════════════════════════
// PRE-PROCESSING (FILE pipeline — не змінено)
// ═══════════════════════════════════════════════

function getExifOrientation(buf){
  const v=new DataView(buf);
  if(v.getUint16(0)!==0xFFD8)return 1;
  let off=2;
  while(off<v.byteLength-4){
    const m=v.getUint16(off);
    if(m===0xFFE1){
      if(v.getUint32(off+4)!==0x45786966)return 1;
      const le=v.getUint16(off+10)===0x4949;
      const ifd=off+10+v.getUint32(off+14,le);
      const n=v.getUint16(ifd,le);
      for(let i=0;i<n;i++)if(v.getUint16(ifd+2+i*12,le)===0x0112)return v.getUint16(ifd+2+i*12+8,le);
      return 1;
    }
    if((m&0xFF00)!==0xFF00)break;
    off+=2+v.getUint16(off+2);
  }
  return 1;
}

function applyExifRotation(img,orient){
  const w=img.naturalWidth,h=img.naturalHeight;
  const swap=orient>=5&&orient<=8;
  const c=document.createElement('canvas');
  c.width=swap?h:w;c.height=swap?w:h;
  const ctx=c.getContext('2d');
  const M=[[],[1,0,0,1,0,0],[-1,0,0,1,w,0],[-1,0,0,-1,w,h],
            [1,0,0,-1,0,h],[0,1,1,0,0,0],[0,1,-1,0,h,0],
            [0,-1,-1,0,h,w],[0,-1,1,0,0,w]];
  const t=M[orient]||M[1];
  ctx.transform(t[0],t[1],t[2],t[3],t[4],t[5]);
  ctx.drawImage(img,0,0);
  return c;
}

function gaussianBlur(idata,w,h,passes=1){
  const k=[1,2,1],ksum=4;
  let d=new Float32Array(idata.data);
  for(let p=0;p<passes;p++){
    const tmp=new Float32Array(d.length);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      for(let c=0;c<3;c++){let s=0;for(let dx=-1;dx<=1;dx++)s+=d[(y*w+Math.max(0,Math.min(w-1,x+dx)))*4+c]*k[dx+1];tmp[(y*w+x)*4+c]=s/ksum;}
      tmp[(y*w+x)*4+3]=255;
    }
    const tmp2=new Float32Array(tmp.length);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      for(let c=0;c<3;c++){let s=0;for(let dy=-1;dy<=1;dy++)s+=tmp[(Math.max(0,Math.min(h-1,y+dy))*w+x)*4+c]*k[dy+1];tmp2[(y*w+x)*4+c]=s/ksum;}
      tmp2[(y*w+x)*4+3]=255;
    }
    d=tmp2;
  }
  const out=new ImageData(w,h);
  for(let i=0;i<d.length;i++)out.data[i]=Math.round(Math.max(0,Math.min(255,d[i])));
  return out;
}

function otsuCh(ch){
  const hist=new Int32Array(256);for(const v of ch)hist[v]++;
  const N=ch.length;let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];
  let wb=0,sb=0,best=0,bestT=128;
  for(let t=0;t<256;t++){wb+=hist[t];if(!wb)continue;const wf=N-wb;if(!wf)break;sb+=t*hist[t];const mb=sb/wb,mf=(sum-sb)/wf,v=wb*wf*(mb-mf)*(mb-mf);if(v>best){best=v;bestT=t;}}
  return bestT;
}

function preprocess(img,orient,maxSide=900){
  Lh('PRE-PROCESSING');
  let src;
  if(orient&&orient!==1){src=applyExifRotation(img,orient);Li('  EXIF rotation: '+orient);}
  else{src=document.createElement('canvas');src.width=img.naturalWidth;src.height=img.naturalHeight;src.getContext('2d').drawImage(img,0,0);}
  let w=src.width,h=src.height;
  if(Math.max(w,h)>maxSide){const s=maxSide/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s);}
  const c=document.createElement('canvas');c.width=w;c.height=h;
  c.getContext('2d').drawImage(src,0,0,w,h);
  const idata=c.getContext('2d').getImageData(0,0,w,h);
  Li('  Розмір: '+w+'×'+h);
  const blurred=gaussianBlur(idata,w,h,1);
  Li('  → Gaussian blur 1px');
  const d=blurred.data;
  const chR=new Uint8Array(w*h),chG=new Uint8Array(w*h),chB=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++){chR[i]=d[i*4];chG[i]=d[i*4+1];chB[i]=d[i*4+2];}
  const tR=otsuCh(chR),tG=otsuCh(chG),tB=otsuCh(chB);
  Li('  Otsu: R='+tR+' G='+tG+' B='+tB);
  const out=new ImageData(w,h);
  for(let i=0;i<w*h;i++){
    out.data[i*4]  =chR[i]>tR?255:0;
    out.data[i*4+1]=chG[i]>tG?255:0;
    out.data[i*4+2]=chB[i]>tB?255:0;
    out.data[i*4+3]=255;
  }
  Li('  → Бінаризація R/G/B по Otsu');
  return{idata:out,w,h};
}

// ═══════════════════════════════════════════════
// GEOMETRY (не змінено)
// ═══════════════════════════════════════════════

function toGray(idata,w,h){
  const d=idata.data,g=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++)g[i]=(77*d[i*4]+150*d[i*4+1]+29*d[i*4+2])>>8;
  return g;
}

function makeMask(gray,w,h,bg,tol){
  const m=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++)m[i]=Math.abs(gray[i]-bg)>tol?1:0;
  return m;
}

function erodeMask(mask,w,h){
  const out=new Uint8Array(w*h);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)
    if(mask[y*w+x]&&mask[(y-1)*w+x]&&mask[(y+1)*w+x]&&mask[y*w+x-1]&&mask[y*w+x+1])out[y*w+x]=1;
  return out;
}

function findCorners(mask,w,h,slack=12){
  let tlS=Infinity,trS=-Infinity,brS=-Infinity,blS=Infinity;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(!mask[y*w+x])continue;const s=x+y,d=x-y;
    if(s<tlS)tlS=s;if(d>trS)trS=d;if(s>brS)brS=s;if(d<blS)blS=d;
  }
  let tlX=0,tlY=0,tlN=0,trX=0,trY=0,trN=0,brX=0,brY=0,brN=0,blX=0,blY=0,blN=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(!mask[y*w+x])continue;const s=x+y,d=x-y;
    if(s<=tlS+slack){tlX+=x;tlY+=y;tlN++;}
    if(d>=trS-slack){trX+=x;trY+=y;trN++;}
    if(s>=brS-slack){brX+=x;brY+=y;brN++;}
    if(d<=blS+slack){blX+=x;blY+=y;blN++;}
  }
  const avg=(sx,sy,n,dx,dy)=>n?{x:Math.round(sx/n),y:Math.round(sy/n)}:{x:dx,y:dy};
  return{tl:avg(tlX,tlY,tlN,0,0),tr:avg(trX,trY,trN,w-1,0),br:avg(brX,brY,brN,w-1,h-1),bl:avg(blX,blY,blN,0,h-1)};
}

function spread(c){
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  return Math.max(d(c.tl,c.tr),d(c.tr,c.br),d(c.br,c.bl),d(c.bl,c.tl));
}

function gaussElim(A,b){
  const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<n;c++){
    let mr=c,mv=Math.abs(M[c][c]);
    for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>mv){mv=Math.abs(M[r][c]);mr=r;}
    [M[c],M[mr]]=[M[mr],M[c]];
    const pv=M[c][c];if(Math.abs(pv)<1e-12)return null;
    for(let r=c+1;r<n;r++){const f=M[r][c]/pv;for(let j=c;j<=n;j++)M[r][j]-=f*M[c][j];}
  }
  const x=new Array(n).fill(0);
  for(let i=n-1;i>=0;i--){x[i]=M[i][n];for(let j=i+1;j<n;j++)x[i]-=M[i][j]*x[j];x[i]/=M[i][i];}
  return x;
}

function computeH(s4,d4){
  const rows=[],rhs=[];
  for(let i=0;i<4;i++){
    const sx=s4[i].x,sy=s4[i].y,dx=d4[i].x,dy=d4[i].y;
    rows.push([sx,sy,1,0,0,0,-sx*dx,-sy*dx]);rhs.push(dx);
    rows.push([0,0,0,sx,sy,1,-sx*dy,-sy*dy]);rhs.push(dy);
  }
  const h=gaussElim(rows,rhs);if(!h)return null;
  return[[h[0],h[1],h[2]],[h[3],h[4],h[5]],[h[6],h[7],1]];
}

function inv3(M){
  const[[a,b,c],[d,e,f],[g,h,k]]=M;
  const dt=a*(e*k-f*h)-b*(d*k-f*g)+c*(d*h-e*g);
  if(Math.abs(dt)<1e-12)return null;
  return[[(e*k-f*h)/dt,(c*h-b*k)/dt,(b*f-c*e)/dt],
         [(f*g-d*k)/dt,(a*k-c*g)/dt,(c*d-a*f)/dt],
         [(d*h-e*g)/dt,(b*g-a*h)/dt,(a*e-b*d)/dt]];
}

function applyH(H,x,y){
  const w=H[2][0]*x+H[2][1]*y+H[2][2];
  return{x:(H[0][0]*x+H[0][1]*y+H[0][2])/w,y:(H[1][0]*x+H[1][1]*y+H[1][2])/w};
}

function warpPerspective(idata,sw,sh,corners,S){
  const s4=[corners.tl,corners.tr,corners.br,corners.bl];
  const d4=[{x:0,y:0},{x:S-1,y:0},{x:S-1,y:S-1},{x:0,y:S-1}];
  const H=computeH(s4,d4);if(!H)return null;
  const Hi=inv3(H);if(!Hi)return null;
  const out=new ImageData(S,S),sd=idata.data,od=out.data;
  for(let dy=0;dy<S;dy++)for(let dx=0;dx<S;dx++){
    const p=applyH(Hi,dx,dy),x0=p.x|0,y0=p.y|0,fx=p.x-x0,fy=p.y-y0;
    const di=(dy*S+dx)*4;
    const get=(sx,sy,ch)=>(sx<0||sx>=sw||sy<0||sy>=sh)?128:sd[(sy*sw+sx)*4+ch];
    for(let ch=0;ch<3;ch++)
      od[di+ch]=Math.round(get(x0,y0,ch)*(1-fx)*(1-fy)+get(x0+1,y0,ch)*fx*(1-fy)+get(x0,y0+1,ch)*(1-fx)*fy+get(x0+1,y0+1,ch)*fx*fy);
    od[di+3]=255;
  }
  return out;
}

// ═══════════════════════════════════════════════
// ZEBRA + DECODE (не змінено — точно як v6.2)
// ═══════════════════════════════════════════════

function verifyZebra(wGray,S,minContrast){
  function scanLine(arr){
    const n=arr.length;let mn=255,mx=0;
    for(const v of arr){if(v<mn)mn=v;if(v>mx)mx=v;}
    if(mx-mn<minContrast)return null;
    const thr=(mn+mx)>>1,runs=[];let cur=arr[0]>thr?1:0,len=1;
    for(let i=1;i<n;i++){const b=arr[i]>thr?1:0;if(b===cur)len++;else{runs.push({v:cur,len});cur=b;len=1;}}
    runs.push({v:cur,len});
    if(runs.length<3)return null;
    const allLens=runs.map(r=>r.len).sort((a,b)=>a-b);
    const med=allLens[allLens.length>>1];
    if(med<2)return null;
    const valid=runs.filter(r=>r.len>=med*0.4&&r.len<=med*2.4);
    if(valid.length<5)return null;
    let T=valid.length;
    if(T%2===0){if(valid[0].v===1||valid[T-1].v===1)T+=1;else return null;}
    if(T<5)return null;
    return{T,modSize:S/T};
  }
  const probeOffsets=[2,5,10,15,20,30];
  const votes=new Map();let total=0;
  for(const off of probeOffsets){
    if(off>=S/2)continue;
    for(const pos of[off,S-1-off]){
      const row=new Uint8Array(S);for(let x=0;x<S;x++)row[x]=wGray[pos*S+x];
      const rh=scanLine(row);if(rh)votes.set(rh.T,(votes.get(rh.T)||0)+1);total++;
      const col=new Uint8Array(S);for(let y=0;y<S;y++)col[y]=wGray[y*S+pos];
      const rv=scanLine(col);if(rv)votes.set(rv.T,(votes.get(rv.T)||0)+1);total++;
    }
  }
  if(!votes.size)return null;
  const sorted=[...votes.entries()].sort((a,b)=>b[1]-a[1]);
  const vStr=sorted.slice(0,5).map(([t,v])=>`T${t}:${v}`).join(' ');
  const[bestT,bestV]=sorted[0];
  return{T:bestT,modSize:S/bestT,confidence:bestV/total,voteStr:vStr};
}

function sampleCircles(warped,S,T,modSize){
  const d=warped.data,circleR=modSize*0.28,r2=circleR*circleR,cells=[];
  for(let row=1;row<T-1;row++)for(let col=1;col<T-1;col++){
    const cx=col*modSize+modSize/2,cy=row*modSize+modSize/2;
    let sR=0,sG=0,sB=0,cnt=0;
    const x0=Math.max(0,Math.floor(cx-circleR)),x1=Math.min(S-1,Math.ceil(cx+circleR));
    const y0=Math.max(0,Math.floor(cy-circleR)),y1=Math.min(S-1,Math.ceil(cy+circleR));
    for(let py=y0;py<=y1;py++)for(let px=x0;px<=x1;px++){
      const dx=px-cx,dy=py-cy;if(dx*dx+dy*dy>r2)continue;
      const idx=(py*S+px)*4;sR+=d[idx];sG+=d[idx+1];sB+=d[idx+2];cnt++;
    }
    cells.push(cnt?{r:sR/cnt,g:sG/cnt,b:sB/cnt,row,col}:{r:0,g:0,b:0,row,col});
  }
  return{cells,circleR};
}

const RGB_MAIN={r:[255,0,0],g:[0,255,0],b:[0,0,255]};
const RGB_GAL={r:[220,50,60],g:[65,195,65],b:[60,70,215]};
const REFBITS=[[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,1,1]];
const _enc=new TextEncoder(),_dec=new TextDecoder('utf-8',{fatal:true});
function isClean(t){for(const ch of t){const o=ch.codePointAt(0);if(o===0||o<32&&ch!=='\n'&&ch!=='\t')return false;}return true;}
function bytesToText(by){by=by.slice();while(by.length&&by[by.length-1]===0)by.pop();if(!by.length)return null;try{const t=_dec.decode(new Uint8Array(by));return isClean(t)?t:null;}catch{return null;}}
function textBits(t){const d=_enc.encode(t),b=new Uint8Array(d.length*8);for(let i=0;i<d.length;i++)for(let k=0;k<8;k++)b[i*8+k]=(d[i]>>(7-k))&1;return b;}
function Rof(n){return(n-1)/2;}
function baseCells(m,n){const c=Rof(n),o=[];if(m==='oct'){for(let i=0;i<=c;i++)for(let j=0;j<=i;j++)o.push([c+i,c+j]);}else if(m==='quad'){for(let i=0;i<=c;i++)for(let j=0;j<=c;j++)o.push([c+i,c+j]);}else{for(let y=0;y<n;y++)for(let i=0;i<=c;i++)o.push([c+i,y]);}return o;}
function mirrors(m,n,x,y){const c=Rof(n),i=x-c,j=y-c;let p;if(m==='oct')p=[[i,j],[j,i],[-i,j],[-j,i],[i,-j],[j,-i],[-i,-j],[-j,-i]];else if(m==='quad')p=[[i,j],[-i,j],[i,-j],[-i,-j]];else p=[[i,j],[-i,j]];const o=[];for(const[a,b]of p){const X=c+a,Y=c+b;if(X>=0&&Y>=0&&X<n&&Y<n)o.push([X,Y]);}return o;}
function fillChannel(t,n,m,markBit){const g=new Uint8Array(n*n),bc=baseCells(m,n);let seq=textBits(t);if(markBit!=null){const s2=new Uint8Array(seq.length+1);s2[0]=markBit;s2.set(seq,1);seq=s2;}const lim=Math.min(seq.length,bc.length);for(let i=0;i<lim;i++){const[x,y]=bc[i];for(const[X,Y]of mirrors(m,n,x,y))if(seq[i])g[Y*n+X]=1;}return g;}
function markCell(g,n,m){const[x,y]=baseCells(m,n)[0];return g[y*n+x]?1:0;}
function agree(g,chk,n){let ok=0;for(let z=0;z<n*n;z++)ok+=((chk[z]?1:0)===g[z])?1:0;return ok/(n*n);}
function decodeVoted(g,n,m,off,conf){
  const bc=baseCells(m,n),by=[];
  for(let i=off||0;i+7<bc.length;i+=8){
    let v=0;
    for(let b=0;b<8;b++){
      const[x,y]=bc[i+b],cells=mirrors(m,n,x,y);let bit;
      if(conf){let w1=0,w0=0;for(const[X,Y]of cells){const cv=conf[Y*n+X];if(cv<0.15)continue;if(g[Y*n+X])w1+=cv;else w0+=cv;}bit=(w1===0&&w0===0)?g[y*n+x]?1:0:w1>w0?1:0;}
      else{let ones=0;for(const[X,Y]of cells)ones+=g[Y*n+X]?1:0;const cnt=cells.length;bit=ones*2>cnt?1:ones*2<cnt?0:g[y*n+x]?1:0;}
      v=(v<<1)|bit;
    }
    by.push(v);
  }
  return{text:bytesToText(by),bytes:by};
}
function refsFor(S){const mix=(r,g,b)=>[Math.min(255,(r?S.r[0]:0)+(g?S.g[0]:0)+(b?S.b[0]:0)),Math.min(255,(r?S.r[1]:0)+(g?S.g[1]:0)+(b?S.b[1]:0)),Math.min(255,(r?S.r[2]:0)+(g?S.g[2]:0)+(b?S.b[2]:0))];return REFBITS.map(c=>({bits:c,col:mix(c[0],c[1],c[2])}));}
function classifyCells(cells,n){
  const pals=[['насичена',RGB_MAIN],['галерейна',RGB_GAL]];let best=null;
  for(const[name,S]of pals){
    const refs=refsFor(S);let err=0;
    const cr=new Uint8Array(n*n),cg=new Uint8Array(n*n),cb=new Uint8Array(n*n);
    for(let i=0;i<n*n;i++){
      const[R,G,B]=[cells[i].r,cells[i].g,cells[i].b];let bi=0,bd=1e9;
      for(let k=0;k<refs.length;k++){const q=refs[k].col,dr=R-q[0],dg=G-q[1],db=B-q[2],dd=dr*dr+dg*dg+db*db;if(dd<bd){bd=dd;bi=k;}}
      err+=bd;const t=refs[bi].bits;cr[i]=t[0];cg[i]=t[1];cb[i]=t[2];
    }
    if(!best||err<best.err)best={name,err,cr,cg,cb};
  }
  return best;
}

function decodeCircles(circles,T){
  const cells=circles.cells,n=T-2;
  if(n<7||n%2===0){Lw('n='+n+' — замалий або парний');return null;}
  const lumas=cells.map(c=>(c.r+c.g+c.b)/3);
  const lumaMin=Math.min(...lumas),lumaMax=Math.max(...lumas),autoThr=(lumaMin+lumaMax)/2;
  const gl=new Uint8Array(n*n),confM=new Float32Array(n*n);
  cells.forEach((c,i)=>{const L=(c.r+c.g+c.b)/3;gl[i]=L>autoThr?1:0;confM[i]=Math.min(1,Math.abs(L-autoThr)/(autoThr/2+1));});
  const sats=cells.map(c=>Math.max(c.r,c.g,c.b)-Math.min(c.r,c.g,c.b));
  const medSat=[...sats].sort((a,b)=>a-b)[sats.length>>1];
  const coloredCnt=sats.filter(s=>s>60).length;
  const isColored=medSat>25||coloredCnt>=Math.max(3,n*0.15);
  Li('  n='+n+'  поріг='+autoThr.toFixed(0)+'  '+(isColored?'КОЛІР':'МОНО'));
  const modes=['oct','quad','half'];
  if(!isColored){
    Lh('ДЕКОД МОНО');let best=null;
    for(const m of modes){const v=decodeVoted(gl,n,m,0,confM);if(v.text!==null){const a=agree(gl,fillChannel(v.text,n,m),n);Lok('['+m+'] "'+v.text+'"  agree='+a.toFixed(3));if(!best||a>best.a)best={v,a,m};}else Li('  ['+m+'] null');}
    return best?{type:'МОНО·'+best.m,text:best.v.text}:{type:'МОНО',text:null};
  }else{
    Lh('ДЕКОД КОЛІР');const cls=classifyCells(cells,n);Li('  палітра: '+cls.name);
    const cR=new Float32Array(n*n),cG=new Float32Array(n*n),cB=new Float32Array(n*n);
    cells.forEach((c,i)=>{cR[i]=Math.min(1,Math.abs(c.r-128)/90);cG[i]=Math.min(1,Math.abs(c.g-128)/90);cB[i]=Math.min(1,Math.abs(c.b-128)/90);});
    let best=null;
    for(const m of modes){
      const rMark=markCell(cls.cr,n,m);
      let vr=decodeVoted(cls.cr,n,m,rMark?1:0,cR);if(rMark&&vr.text===null)vr=decodeVoted(cls.cr,n,m,0,cR);
      const vg=decodeVoted(cls.cg,n,m,0,cG),vb=decodeVoted(cls.cb,n,m,0,cB);
      const nn=[vr.text,vg.text,vb.text].filter(t=>t!==null);
      Li('  ['+m+'] R:'+(vr.text!=null?'"'+vr.text+'"':'null')+'  G:'+(vg.text!=null?'"'+vg.text+'"':'null')+'  B:'+(vb.text!=null?'"'+vb.text+'"':'null'));
      if(!nn.length)continue;
      const sc=nn.length*1000+nn.reduce((a,t)=>a+t.length,0);
      if(!best||sc>best.sc)best={vr,vg,vb,nn,sc,m,rMark};
    }
    if(!best)return{type:'КОЛІР·'+cls.name,text:null};
    const parts=[best.vr.text,best.vg.text,best.vb.text].filter(t=>t!==null);
    const text=best.rMark?(parts.every(t=>t===parts[0])?parts[0]:parts.join('')):parts.join(' · ');
    Lok('['+best.m+'] "'+text+'"');
    return{type:'КОЛІР·'+best.m,text};
  }
}

// ═══════════════════════════════════════════════
// FIX: CAMERA FRAME DETECTION
// RAW grayscale з canvas — без JPEG, без Otsu
// ═══════════════════════════════════════════════

function getGrayFromCanvas(srcCanvas,maxSide=600){
  let sw=srcCanvas.width,sh=srcCanvas.height;
  let w=sw,h=sh;
  if(Math.max(w,h)>maxSide){const s=maxSide/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s);}
  let ctx;
  if(w!==sw||h!==sh){
    const c=document.createElement('canvas');c.width=w;c.height=h;
    ctx=c.getContext('2d');ctx.drawImage(srcCanvas,0,0,w,h);
  }else{ctx=srcCanvas.getContext('2d');}
  const idata=ctx.getImageData(0,0,w,h),d=idata.data;
  const gray=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++)gray[i]=(77*d[i*4]+150*d[i*4+1]+29*d[i*4+2])>>8;
  return{gray,w,h};
}

// FIX: CAMERA FRAME DETECTION
// Геометрична оцінка кандидата
function scoreCandidate(corners,w,h,silent){
  const c=corners;
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const top=d(c.tl,c.tr),right=d(c.tr,c.br),bot=d(c.br,c.bl),left=d(c.bl,c.tl);
  const sp=Math.max(top,right,bot,left);
  const minSide=Math.min(w,h);
  if(sp<minSide*0.15){if(!silent)Li('    reject: малий spread='+Math.round(sp));return 0;}
  if(sp>minSide*0.95){if(!silent)Li('    reject: spread='+Math.round(sp)+' > 95% кадру');return 0;}
  const sides=[top,right,bot,left];
  const sMin=Math.min(...sides),sMax=Math.max(...sides);
  if(sMax>sMin*2.5){if(!silent)Li('    reject: aspect '+sides.map(s=>Math.round(s)).join(','));return 0;}
  const margin=2;
  for(const pt of[c.tl,c.tr,c.br,c.bl]){
    if(pt.x<=margin||pt.y<=margin||pt.x>=w-margin||pt.y>=h-margin){
      if(!silent)Li('    reject: кут на краю ('+pt.x+','+pt.y+')');return 0;
    }
  }
  const cx=(c.tl.x+c.tr.x+c.br.x+c.bl.x)/4;
  const cy=(c.tl.y+c.tr.y+c.br.y+c.bl.y)/4;
  const dx=Math.abs(cx-w/2)/(w/2),dy=Math.abs(cy-h/2)/(h/2);
  if(dx>0.45||dy>0.45){if(!silent)Li('    reject: центр далеко dx='+dx.toFixed(2)+' dy='+dy.toFixed(2));return 0;}
  const area=0.5*Math.abs((c.tr.x-c.tl.x)*(c.bl.y-c.tl.y)-(c.bl.x-c.tl.x)*(c.tr.y-c.tl.y));
  const areaFrac=area/(w*h);
  if(areaFrac<0.02){if(!silent)Li('    reject: мала площа '+areaFrac.toFixed(3));return 0;}
  if(areaFrac>0.90){if(!silent)Li('    reject: площа >90% '+areaFrac.toFixed(3));return 0;}
  const pts=[c.tl,c.tr,c.br,c.bl];
  let signs=0;
  for(let i=0;i<4;i++){
    const a=pts[i],b=pts[(i+1)%4],c2=pts[(i+2)%4];
    const cross=(b.x-a.x)*(c2.y-a.y)-(b.y-a.y)*(c2.x-a.x);
    if(cross>0)signs|=1;else if(cross<0)signs|=2;
  }
  if(signs===3){if(!silent)Li('    reject: невипуклий');return 0;}
  return(sp/minSide)*(1-(dx+dy)/2)*(sMin/sMax)*1000;
}

// FIX: CAMERA FRAME DETECTION
// Пошук рамки на RAW grayscale — 5 гіпотез масок
function findFrameGray(gray,w,h,silent=false){
  if(!silent)Li('  gray: '+w+'×'+h);
  const bx=Math.max(1,Math.round(w*0.08)),by_=Math.max(1,Math.round(h*0.08));
  const perim=[];
  for(let y=0;y<by_;y++)     for(let x=0;x<w;x+=2)perim.push(gray[y*w+x]);
  for(let y=h-by_;y<h;y++)   for(let x=0;x<w;x+=2)perim.push(gray[y*w+x]);
  for(let y=by_;y<h-by_;y+=2)for(let x=0;x<bx;x++)  perim.push(gray[y*w+x]);
  for(let y=by_;y<h-by_;y+=2)for(let x=w-bx;x<w;x++)perim.push(gray[y*w+x]);
  perim.sort((a,b)=>a-b);
  const bgPerim=perim[perim.length>>1];
  const hist=new Int32Array(256);
  for(let i=0;i<w*h;i++)hist[gray[i]]++;
  const N=w*h;let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];
  let wb_=0,sb_=0,bestV=0,otsuT=128;
  for(let t=0;t<256;t++){wb_+=hist[t];if(!wb_)continue;const wf=N-wb_;if(!wf)break;sb_+=t*hist[t];const mb=sb_/wb_,mf=(sum-sb_)/wf,v=wb_*wf*(mb-mf)*(mb-mf);if(v>bestV){bestV=v;otsuT=t;}}
  if(!silent)Li('  bgPerim='+bgPerim+' otsuT='+otsuT);
  const tols=[15,25,35,50,70];
  let bestScore=0,bestCorners=null,bestInfo=null;
  const tryMask=(mask,label)=>{
    const em=erodeMask(mask,w,h);
    const fgN=em.reduce((s,v)=>s+v,0);
    if(fgN<100)return;
    const c=findCorners(em,w,h,15);
    const sc=scoreCandidate(c,w,h,silent);
    if(!silent){const sp=spread(c);Li('    '+label+': FG='+fgN+' spread='+Math.round(sp)+' score='+sc.toFixed(0));}
    if(sc>bestScore){bestScore=sc;bestCorners=c;bestInfo=label;}
  };
  for(const tol of tols){tryMask(makeMask(gray,w,h,bgPerim,tol),'H1-bg'+bgPerim+'-tol'+tol);}
  const bgInv=255-bgPerim;
  for(const tol of tols){tryMask(makeMask(gray,w,h,bgInv,tol),'H2-bgInv'+bgInv+'-tol'+tol);}
  {const mask=new Uint8Array(w*h);for(let i=0;i<w*h;i++)mask[i]=gray[i]<otsuT?1:0;tryMask(mask,'H3-otsuDark<'+otsuT);}
  {const mask=new Uint8Array(w*h);for(let i=0;i<w*h;i++)mask[i]=gray[i]>otsuT?1:0;tryMask(mask,'H4-otsuLight>'+otsuT);}
  {
    const mask=new Uint8Array(w*h);
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      let mn=255,mx=0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const v=gray[(y+dy)*w+(x+dx)];if(v<mn)mn=v;if(v>mx)mx=v;}
      mask[y*w+x]=mx-mn>40?1:0;
    }
    tryMask(mask,'H5-edge>40');
  }
  if(!silent){
    if(bestCorners){
      const c=bestCorners;
      Li('  selected: '+bestInfo+' score='+bestScore.toFixed(0));
      Li('  TL('+c.tl.x+','+c.tl.y+') TR('+c.tr.x+','+c.tr.y+') BR('+c.br.x+','+c.br.y+') BL('+c.bl.x+','+c.bl.y+')');
    }else{Li('  no valid candidate');}
  }
  return{corners:bestCorners,score:bestScore};
}

function findFrame(idata,w,h){
  const gray=toGray(idata,w,h);
  const result=findFrameGray(gray,w,h,false);
  return{corners:result.corners,spread:result.corners?spread(result.corners):0};
}

// ═══════════════════════════════════════════════
// DRAW / OVERLAY (не змінено)
// ═══════════════════════════════════════════════

const mainCnv=document.getElementById('cnv');

function drawCornersOverlay(ctx,corners,clr='#eb5555'){
  const c=corners;
  ctx.strokeStyle=clr;ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(c.tl.x,c.tl.y);ctx.lineTo(c.tr.x,c.tr.y);ctx.lineTo(c.br.x,c.br.y);ctx.lineTo(c.bl.x,c.bl.y);ctx.closePath();ctx.stroke();
  const labels={tl:'TL',tr:'TR',br:'BR',bl:'BL'};
  ctx.fillStyle=clr;ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const[key,pt]of Object.entries(c)){
    ctx.beginPath();ctx.arc(pt.x,pt.y,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.fillText(labels[key],pt.x,pt.y);ctx.fillStyle=clr;
  }
}

function drawResult(warped,S,zebra,idata,w,h,corners){
  if(warped&&zebra){
    mainCnv.width=S;mainCnv.height=S;
    const ctx=mainCnv.getContext('2d');
    ctx.putImageData(warped,0,0);
    const{T,modSize}=zebra;
    ctx.strokeStyle='rgba(40,120,200,0.18)';ctx.lineWidth=0.5;
    for(let i=0;i<=T;i++){const p=i*modSize;ctx.beginPath();ctx.moveTo(p,0);ctx.lineTo(p,S);ctx.stroke();ctx.beginPath();ctx.moveTo(0,p);ctx.lineTo(S,p);ctx.stroke();}
    for(let i=0;i<T;i++){
      ctx.fillStyle=(i%2===0)?'rgba(255,80,80,0.18)':'rgba(80,180,255,0.10)';
      ctx.fillRect(i*modSize,0,modSize,modSize);ctx.fillRect(i*modSize,S-modSize,modSize,modSize);
      if(i>0&&i<T-1){ctx.fillRect(0,i*modSize,modSize,modSize);ctx.fillRect(S-modSize,i*modSize,modSize,modSize);}
    }
    ctx.fillStyle='rgba(255,220,50,0.45)';
    [[0,0],[S-modSize,0],[S-modSize,S-modSize],[0,S-modSize]].forEach(([x,y])=>ctx.fillRect(x,y,modSize,modSize));
    ctx.strokeStyle='rgba(80,235,120,0.55)';ctx.lineWidth=1.5;
    ctx.strokeRect(modSize,modSize,(T-2)*modSize,(T-2)*modSize);
    const cr=modSize*0.28;ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.lineWidth=Math.max(0.8,modSize*0.06);
    for(let row=1;row<T-1;row++)for(let col=1;col<T-1;col++){ctx.beginPath();ctx.arc(col*modSize+modSize/2,row*modSize+modSize/2,cr,0,Math.PI*2);ctx.stroke();}
  }else if(idata){
    mainCnv.width=w;mainCnv.height=h;
    const ctx=mainCnv.getContext('2d');ctx.putImageData(idata,0,0);
    if(corners)drawCornersOverlay(ctx,corners);
  }
}

function buildRGBPanel(warped,S,T,modSize,circles){
  const grid=document.getElementById('rgb-grid');grid.innerHTML='';
  const labels=['Warped','R','G','B'],colors=[[255,50,50],[50,220,50],[50,100,255]];
  const canvases=labels.map(lbl=>{
    const tile=document.createElement('div');tile.className='rgb-tile';
    const c=document.createElement('canvas');c.width=S;c.height=S;
    const l=document.createElement('div');l.className='rgb-lbl';l.textContent=lbl;
    tile.appendChild(c);tile.appendChild(l);grid.appendChild(tile);return c;
  });
  canvases[0].getContext('2d').putImageData(warped,0,0);
  for(let ci=0;ci<3;ci++){
    const c=canvases[ci+1],ctx=c.getContext('2d');
    ctx.fillStyle='#080808';ctx.fillRect(0,0,S,S);
    ctx.strokeStyle='rgba(40,40,60,0.5)';ctx.lineWidth=0.5;
    for(let i=0;i<=T;i++){const p=i*modSize;ctx.beginPath();ctx.moveTo(p,0);ctx.lineTo(p,S);ctx.stroke();ctx.beginPath();ctx.moveTo(0,p);ctx.lineTo(S,p);ctx.stroke();}
    const cr=modSize*0.28;const[cr_,cg_,cb_]=colors[ci];
    circles.cells.forEach(cell=>{
      const cx=cell.col*modSize+modSize/2,cy=cell.row*modSize+modSize/2;
      const val=ci===0?cell.r:ci===1?cell.g:cell.b;
      ctx.fillStyle='rgba('+cr_+','+cg_+','+cb_+','+(val/255).toFixed(2)+')';
      ctx.beginPath();ctx.arc(cx,cy,cr,0,Math.PI*2);ctx.fill();
      if(modSize>20){ctx.fillStyle='rgba(255,255,255,0.55)';ctx.font=Math.max(6,modSize*0.22)+'px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(Math.round(val),cx,cy);}
    });
  }
}

// ═══════════════════════════════════════════════
// CAMERA
// ═══════════════════════════════════════════════

let stream=null,scanLoopId=null;
const vid=document.getElementById('vid');
const vidWrap=document.getElementById('vidWrap');
const timerBarWrap=document.getElementById('timer-bar-wrap');
const timerBar=document.getElementById('timer-bar');
let roiCanvas=null;  // FIX: CAMERA FRAME DETECTION — переиспользуємий canvas
let lastGoodCorners=null,stableCount=0;
const STABLE_NEEDED=2,STABLE_TOL=0.12;

function cornersClose(a,b,minSide){
  const tol=minSide*STABLE_TOL;
  for(const k of['tl','tr','br','bl'])
    if(Math.abs(a[k].x-b[k].x)>tol||Math.abs(a[k].y-b[k].y)>tol)return false;
  return true;
}

function startCamera(){
  navigator.mediaDevices.getUserMedia({
    video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}
  }).then(s=>{stream=s;vid.srcObject=s;return vid.play();})
  .then(()=>{
    vidWrap.style.display='flex';mainCnv.style.display='none';
    document.getElementById('camBtn').style.display='none';
    document.getElementById('stopBtn').style.display='inline';
    setSt('◎ сканування…',null);
    scanLoopStart();
  }).catch(err=>{Le('Камера: '+err.message);setSt('✗ '+err.message,false);});
}

function stopCamera(){
  scanLoopStop();
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
  vidWrap.style.display='none';mainCnv.style.display='block';
  timerBarWrap.style.display='none';
  document.getElementById('camBtn').style.display='inline';
  document.getElementById('stopBtn').style.display='none';
  setSt('— очікування —',null);
  lastGoodCorners=null;stableCount=0;
}

const SCAN_INTERVAL=250,SCAN_TIMEOUT=10000;
let scanStartTime=0;

function scanLoopStart(){
  scanLoopStop();
  scanStartTime=Date.now();
  lastGoodCorners=null;stableCount=0;
  timerBarWrap.style.display='block';
  timerBar.style.transition='none';timerBar.style.width='100%';
  timerBar.offsetWidth;
  timerBar.style.transition=`width ${SCAN_TIMEOUT}ms linear`;
  timerBar.style.width='0%';
  scanLoopId=setInterval(scanTick,SCAN_INTERVAL);
}

function scanLoopStop(){if(scanLoopId){clearInterval(scanLoopId);scanLoopId=null;}}

// FIX: CAMERA FRAME DETECTION + FIX: ZEBRA PRE-CHECK
function scanTick(){
  if(!stream||!vid.videoWidth)return;
  if(Date.now()-scanStartTime>=SCAN_TIMEOUT){
    scanLoopStop();timerBarWrap.style.display='none';
    setSt('⚠ час вийшов — наведи знову',null);return;
  }

  // FIX: CAMERA FRAME DETECTION
  // drawImage напряму в canvas — без JPEG, без Image()
  const vw=vid.videoWidth,vh=vid.videoHeight;
  const roiSize=Math.min(vw,vh)*0.7;
  const sx=(vw-roiSize)/2,sy=(vh-roiSize)/2;
  if(!roiCanvas)roiCanvas=document.createElement('canvas');
  const side=Math.min(600,Math.round(roiSize));
  if(roiCanvas.width!==side||roiCanvas.height!==side){roiCanvas.width=side;roiCanvas.height=side;}
  roiCanvas.getContext('2d').drawImage(vid,sx,sy,roiSize,roiSize,0,0,side,side);

  // FIX: CAMERA FRAME DETECTION
  // RAW grayscale — не RGB-Otsu — для пошуку рамки
  const{gray,w,h}=getGrayFromCanvas(roiCanvas,600);

  // FIX: CAMERA FRAME DETECTION
  // Геометричний кандидат
  const{corners,score}=findFrameGray(gray,w,h,true);
  if(!corners||score<=0){stableCount=0;lastGoodCorners=null;return;}

  // FIX: ZEBRA PRE-CHECK
  // Перевіряємо кандидата через verifyZebra() на warp 300×300
  // Відхиляємо: темний фон (null), зовнішню рамку (T<9), шум (conf<8%)
  // verifyZebra() НЕ ЗМІНЮЄТЬСЯ — це тільки фільтр кандидатів
  {
    const QS=300; // швидкий warp — дешево (~2ms)
    const exp=10; // невеликий відступ для захоплення зовнішньої зебри
    const cQ={
      tl:{x:Math.max(0,corners.tl.x-exp),y:Math.max(0,corners.tl.y-exp)},
      tr:{x:Math.min(w-1,corners.tr.x+exp),y:Math.max(0,corners.tr.y-exp)},
      br:{x:Math.min(w-1,corners.br.x+exp),y:Math.min(h-1,corners.br.y+exp)},
      bl:{x:Math.max(0,corners.bl.x-exp),y:Math.min(h-1,corners.bl.y+exp)}
    };
    // Будуємо grayscale ImageData для warp
    const tmpIdata=new ImageData(w,h);
    for(let i=0;i<w*h;i++){
      tmpIdata.data[i*4]=tmpIdata.data[i*4+1]=tmpIdata.data[i*4+2]=gray[i];
      tmpIdata.data[i*4+3]=255;
    }
    const wQ=warpPerspective(tmpIdata,w,h,cQ,QS);
    if(!wQ){stableCount=0;lastGoodCorners=null;return;}
    const wGQ=toGray(wQ,QS,QS);
    const zQ=verifyZebra(wGQ,QS,40); // minContrast=40 (трохи м'якше ніж 50 для 300px)

    // Перевірки:
    if(!zQ){stableCount=0;lastGoodCorners=null;return;}       // не зебра взагалі
    if(zQ.T<9){stableCount=0;lastGoodCorners=null;return;}    // T занадто малий (рамка екрану)
    if(zQ.confidence<0.08){stableCount=0;lastGoodCorners=null;return;} // ненадійне голосування
  }
  // Кандидат пройшов zebra pre-check

  // Temporal stability
  const minSide=Math.min(w,h);
  if(lastGoodCorners&&cornersClose(corners,lastGoodCorners,minSide)){stableCount++;}
  else{stableCount=1;}
  lastGoodCorners=corners;
  if(stableCount<STABLE_NEEDED)return;

  // Стабільна рамка + zebra підтверджена — запускаємо повний decode
  scanLoopStop();timerBarWrap.style.display='none';
  vidWrap.style.display='none';mainCnv.style.display='block';
  clrLog();setSt('обробка…',null);

  // Повний decode: беремо ROI з камери у вищій роздільній здатності
  const decCnv=document.createElement('canvas');
  const decSize=Math.min(900,Math.round(roiSize));
  decCnv.width=decSize;decCnv.height=decSize;
  decCnv.getContext('2d').drawImage(vid,sx,sy,roiSize,roiSize,0,0,decSize,decSize);
  const{idata,w:dw,h:dh}=prepareCanvasForDecode(decCnv);
  run(idata,dw,dh);
}

// FIX: CAMERA FRAME DETECTION
// prepareCanvasForDecode: аналог preprocess() для canvas-входу
function prepareCanvasForDecode(srcCanvas){
  const w=srcCanvas.width,h=srcCanvas.height;
  Lh('PRE-PROCESSING (camera)');
  Li('  Розмір: '+w+'×'+h);
  const idata=srcCanvas.getContext('2d').getImageData(0,0,w,h);
  const blurred=gaussianBlur(idata,w,h,1);
  Li('  → Gaussian blur 1px');
  const d=blurred.data;
  const chR=new Uint8Array(w*h),chG=new Uint8Array(w*h),chB=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++){chR[i]=d[i*4];chG[i]=d[i*4+1];chB[i]=d[i*4+2];}
  const tR=otsuCh(chR),tG=otsuCh(chG),tB=otsuCh(chB);
  Li('  Otsu: R='+tR+' G='+tG+' B='+tB);
  const out=new ImageData(w,h);
  for(let i=0;i<w*h;i++){
    out.data[i*4]  =chR[i]>tR?255:0;
    out.data[i*4+1]=chG[i]>tG?255:0;
    out.data[i*4+2]=chB[i]>tB?255:0;
    out.data[i*4+3]=255;
  }
  Li('  → Бінаризація R/G/B по Otsu');
  return{idata:out,w,h};
}

// ═══════════════════════════════════════════════
// MAIN RUN (не змінено)
// ═══════════════════════════════════════════════

const resultBox=document.getElementById('result-box');

function run(idata,w,h){
  Lh('1. ПОШУК РАМКИ');
  const{corners,spread:sp}=findFrame(idata,w,h);
  if(!corners||sp<20){
    Le('Рамку не знайдено');
    drawResult(null,null,null,idata,w,h,corners);
    setSt('✗ рамку не знайдено',false);showResult(null,null);return;
  }
  // FIX: exp=10 — компроміс: захоплює зовнішню зебру, не додає зайвий модуль
  const exp=10;
  const c={
    tl:{x:Math.max(0,corners.tl.x-exp),y:Math.max(0,corners.tl.y-exp)},
    tr:{x:Math.min(w-1,corners.tr.x+exp),y:Math.max(0,corners.tr.y-exp)},
    br:{x:Math.min(w-1,corners.br.x+exp),y:Math.min(h-1,corners.br.y+exp)},
    bl:{x:Math.max(0,corners.bl.x-exp),y:Math.min(h-1,corners.bl.y+exp)}
  };
  Li('TL('+c.tl.x+','+c.tl.y+') TR('+c.tr.x+','+c.tr.y+') BR('+c.br.x+','+c.br.y+') BL('+c.bl.x+','+c.bl.y+')');
  Lh('2. WARP');
  const S=600;
  const warped=warpPerspective(idata,w,h,c,S);
  if(!warped){Le('Гомографія не вдалася');setSt('✗ warp failed',false);return;}
  Lok('Warp → '+S+'×'+S);
  Lh('3. ЗЕБРА');
  const wGray=toGray(warped,S,S);
  const zebra=verifyZebra(wGray,S,50);
  if(zebra)Li('  голоси: '+zebra.voteStr);
  if(!zebra){
    Le('Зебру не знайдено');
    drawResult(warped,S,null,idata,w,h,c);
    setSt('✗ зебру не знайдено',false);showResult(null,null);return;
  }
  Lok('T='+zebra.T+'  mod='+zebra.modSize.toFixed(1)+'px  conf='+(zebra.confidence*100).toFixed(0)+'%');
  Lh('4. КРУЖЕЧКИ');
  const circles=sampleCircles(warped,S,zebra.T,zebra.modSize);
  const lumas=circles.cells.map(c=>(c.r+c.g+c.b)/3).sort((a,b)=>a-b);
  Li('  '+circles.cells.length+' шт  r='+circles.circleR.toFixed(1)+'px');
  Li('  яскравість: min='+lumas[0].toFixed(0)+' med='+lumas[lumas.length>>1].toFixed(0)+' max='+lumas[lumas.length-1].toFixed(0));
  Lh('5. ДЕКОДУВАННЯ');
  const decoded=decodeCircles(circles,zebra.T);
  drawResult(warped,S,zebra,idata,w,h,c);
  buildRGBPanel(warped,S,zebra.T,zebra.modSize,circles);
  if(decoded&&decoded.text!==null){
    Lok('РЕЗУЛЬТАТ: "'+decoded.text+'" ['+decoded.type+']');
    setSt('✓ "'+decoded.text+'"',true);showResult(decoded.text,decoded.type);
  }else{
    Lw('Декод не вдався ['+(decoded?decoded.type:'—')+']');
    setSt('⚠ зебра OK, декод null',null);showResult(null,decoded?decoded.type:null);
  }
}

function showResult(text,type){
  resultBox.classList.add('vis');
  if(text!==null){resultBox.style.color='#55eb5a';resultBox.textContent='✓ '+text+(type?' ['+type+']':'');}
  else if(type){resultBox.style.color='#8a6010';resultBox.textContent='⚠ null ['+type+']';}
  else{resultBox.style.color='#8a2020';resultBox.textContent='✗ не вдалося';}
}

// ═══════════════════════════════════════════════
// ENTRY POINTS (не змінено)
// ═══════════════════════════════════════════════

function processImage(img,orient){
  clrLog();resultBox.classList.remove('vis');
  vidWrap.style.display='none';mainCnv.style.display='block';
  setSt('обробка…',null);
  const{idata,w,h}=preprocess(img,orient,900);
  run(idata,w,h);
}

document.getElementById('fin').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  Li('Файл: '+f.name);
  const reader=new FileReader();
  reader.onload=ev=>{
    const orient=getExifOrientation(ev.target.result);
    const img=new Image();
    img.onload=()=>setTimeout(()=>processImage(img,orient),30);
    img.src=URL.createObjectURL(f);
  };
  reader.readAsArrayBuffer(f);
  e.target.value='';
});

document.getElementById('camBtn').addEventListener('click',startCamera);
document.getElementById('stopBtn').addEventListener('click',stopCamera);

/*
═══════════════════════════════════════════════
ЗМІНИ ВІДНОСНО БАЗОВОЇ ВЕРСІЇ (документ 4)
═══════════════════════════════════════════════

1. ПРИЧИНА ПРОБЛЕМ:
   A) Геометричний детектор не знав що таке зебра TAINA.
      Він приймав будь-який темний прямокутник: рамку екрану,
      темний фон, контрастний перехід.
   B) exp=6 — занадто мало, не захоплював зовнішній ряд зебри.
   C) exp=20 — занадто багато, додавав зайвий модуль → T+2.

2. ЩО ЗМІНЕНО (3 точкових зміни):

   A) FIX: ZEBRA PRE-CHECK в scanTick() — НОВЕ
      Після findFrameGray() → warp 300×300 → verifyZebra().
      Відхиляє: null, T<9, confidence<8%.
      verifyZebra() НЕ ЗМІНЮВАЛАСЬ.

   B) FIX: exp=10 в run() — замість 6
      Достатньо для захоплення зовнішньої зебри (~10px).
      Не додає зайвий модуль (як exp=20).

   C) Math.max/min захист для exp в run() — безпека виходу за межі.

3. ФУНКЦІЇ ЯКІ ЗМІНИЛИСЬ:
   - scanTick() — додано zebra pre-check блок
   - run() — exp: 6→10, + clamp

4. ФУНКЦІЇ ЯКІ НЕ ЗМІНЮВАЛИСЬ:
   verifyZebra(), sampleCircles(), decodeCircles(), classifyCells(),
   warpPerspective(), preprocess(), gaussianBlur(), otsuCh(),
   findFrameGray(), scoreCandidate(), getGrayFromCanvas(),
   drawResult(), buildRGBPanel(), processImage(), весь UI,
   FILE pipeline.
*/
</script>
</body>
</html>
