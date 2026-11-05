(async function(){
'use strict';
// Haida Gwaii Iron Dump — a navigable time–space of media.
// One frame (49–58° N, 145–127° W), nineteen MODIS Aqua passes, a toy simulation of the 2012 release.
// The picture is cut into patches that ride on the simulation (the ship, the eddies, the bloom, the sky, the open water);
// each patch shows the pass that best witnesses what the simulation says is under it, and crossfades when that changes.
// The simulation is deterministic and stored as keyframes, so the clock scrubs both ways and everything interpolates.
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t, fract=x=>x-Math.floor(x);
const LON0=-145,LON1=-127,LAT0=49,LAT1=58, FW=1800,FH=900;
const GW=64,GH=32, CS=FW/GW;                                  // coarse field grid for the sea and the witnesses
const KM_LAT=111,KM_LON=111*Math.cos(53.3*Math.PI/180);
const EPOCH=Date.UTC(2012,6,14);                              // sim day 0 = 14 July 2012, the Ocean Pearl sails
const DAY0=-30,DAY1=110,KF=.5,DT=.1;                          // the run, keyframe spacing, step
const dayNum=iso=>Math.round((Date.parse(iso+'T00:00:00Z')-EPOCH)/86400000);
const fmtLong=d=>new Date(EPOCH+Math.floor(d)*86400000).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const fmtShort=d=>new Date(EPOCH+Math.round(d)*86400000).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const fmtMonth=d=>new Date(EPOCH+Math.round(d)*86400000).toLocaleDateString('en-GB',{month:'long',timeZone:'UTC'});
const fx=lon=>(lon-LON0)/(LON1-LON0)*FW, fy=lat=>(LAT1-lat)/(LAT1-LAT0)*FH;
const status=s=>{const el=$('#status');el.textContent=s;el.hidden=!s};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- calendar ----------
const load=src=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('missing '+src));im.src=src});
const index=await (await fetch('cal/index.json')).json();
const CAL=index.map(e=>({...e,n:dayNum(e.date)}));
const [coast,...imgs]=await Promise.all([load('cal/coast.png'),...CAL.flatMap(e=>[load(`cal/true/${e.date}.jpg`),load(`cal/chl/${e.date}.png`)])]);
const oc=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
// land elevation, 360 × 180 over the frame, metres = grey × 16 (sea and missing = 0)
const TW=360,TH=180;let TER=null,TERMAX=0;
try{const im=await load('cal/terrain.png'),c=oc(TW,TH),x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,TW,TH).data;TER=new Float32Array(TW*TH);for(let i=0;i<TW*TH;i++){TER[i]=d[i*4]*16;TERMAX=Math.max(TERMAX,TER[i])}}catch(e){console.warn(e.message)}
// one colour per layer; the patch edges take the imagery accent; time takes one hue per month
const COL={map:'#4dabf7',plankton:'#22e3c7',iron:'#ff5ca8',cloud:'#b197fc',inst:'#ffffff',terrain:'#ffa94d',edge:'#ff2d2d'};
const monthRGB=m=>{const h=((m+7)%12)/12,s=.8,v=.92,i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);const [r,g,b]=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];return `rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`};
const monthOf=n=>new Date(EPOCH+Math.round(n)*86400000).getUTCMonth()+1;
{const sc=oc(GW*2,GH*2),sx=sc.getContext('2d',{willReadFrequently:true});
 for(let i=0;i<CAL.length;i++){const e=CAL[i];e.img=imgs[i*2];
  sx.drawImage(e.img,0,0,GW*2,GH*2);const t=sx.getImageData(0,0,GW*2,GH*2).data;
  sx.drawImage(imgs[i*2+1],0,0,GW,GH);const q=sx.getImageData(0,0,GW,GH).data;
  e.cloud=new Float32Array(GW*GH);e.chl=new Float32Array(GW*GH);
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){let k=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const j=((y*2+dy)*GW*2+(x*2+dx))*4,r=t[j],g=t[j+1],b=t[j+2],l=(r+g+b)/3,s=Math.max(r,g,b)-Math.min(r,g,b);if(l>150&&s<40)k++}
   const c=y*GW+x;e.cloud[c]=k/4;const v=q[c*4];e.chl[c]=v?clamp((v/255-.4)/.45,0,1):-1}}}

// ---------- the composite (WebGL 2: the passes in a texture array, hard-edged patches, a crossfade per patch) ----------
const glc=oc(FW,FH);const gl=glc.getContext('webgl2',{premultipliedAlpha:false,preserveDrawingBuffer:true,antialias:false});
if(!gl)throw new Error('This page needs WebGL 2, which this browser does not offer.');
const MAXS=16;
{const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D_ARRAY,tex);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,1,gl.RGBA8,FW,FH,CAL.length);
 for(let i=0;i<CAL.length;i++)gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,i,FW,FH,1,gl.RGBA,gl.UNSIGNED_BYTE,CAL[i].img);
 for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D_ARRAY,k,v)}
const VS=`#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;
const FS=`#version 300 es
precision highp float;precision highp sampler2DArray;
uniform sampler2DArray uAtlas;uniform vec4 uSeed[${MAXS}];uniform vec4 uDay[${MAXS}];uniform int uN;uniform float uWarp;uniform float uLine;
out vec4 o;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
vec2 warp(vec2 p){vec2 q=p/140.;vec2 w=vec2(vnoise(q)-.5,vnoise(q+vec2(31.7,17.3))-.5)*2.;vec2 q2=p/45.;w+=vec2(vnoise(q2)-.5,vnoise(q2+vec2(5.1,9.2))-.5)*.5;return p+w*uWarp;}
void main(){vec2 p=vec2(gl_FragCoord.x,${FH}.-gl_FragCoord.y);vec2 pw=warp(p);
 float s1=1e9,s2=1e9;int b=0;
 for(int i=0;i<${MAXS};i++){if(i>=uN)break;vec4 s=uSeed[i];if(s.w<.5)continue;float d=length(pw-s.xy)/s.z;if(d<s1){s2=s1;s1=d;b=i;}else if(d<s2)s2=d;}
 vec2 uv=p/vec2(${FW}.,${FH}.);vec4 dd=uDay[b];
 vec3 c=mix(texture(uAtlas,vec3(uv,dd.x)).rgb,texture(uAtlas,vec3(uv,dd.y)).rgb,dd.z);
 float e=(s2-s1)/max(fwidth(s1)+fwidth(s2),1e-6);float line=1.-smoothstep(uLine*.5,uLine,e);
 o=vec4(mix(c,vec3(1.,.176,.176),line),1.);}`;
const prog=gl.createProgram();for(const [t,s] of [[gl.VERTEX_SHADER,VS],[gl.FRAGMENT_SHADER,FS]]){const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));gl.attachShader(prog,sh)}
gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);
const U={seed:gl.getUniformLocation(prog,'uSeed'),day:gl.getUniformLocation(prog,'uDay'),n:gl.getUniformLocation(prog,'uN'),warp:gl.getUniformLocation(prog,'uWarp'),line:gl.getUniformLocation(prog,'uLine')};
gl.uniform1i(gl.getUniformLocation(prog,'uAtlas'),0);gl.viewport(0,0,FW,FH);
const uSeed=new Float32Array(MAXS*4),uDay=new Float32Array(MAXS*4);
function drawComposite(seeds){uSeed.fill(0);uDay.fill(0);
  seeds.forEach((s,i)=>{uSeed[i*4]=s.x;uSeed[i*4+1]=s.y;uSeed[i*4+2]=Math.max(s.reach,1);uSeed[i*4+3]=s.active?1:0;uDay[i*4]=s.a;uDay[i*4+1]=s.b;uDay[i*4+2]=s.t});
  gl.uniform4fv(U.seed,uSeed);gl.uniform4fv(U.day,uDay);gl.uniform1i(U.n,seeds.length);gl.uniform1f(U.warp,SET.warp);gl.uniform1f(U.line,2.2);gl.drawArrays(gl.TRIANGLES,0,3)}
// the same warp on the CPU, for the readout, the cloud deck, the labels and the patch map
const hash=(x,y)=>{x=fract(x*123.34);y=fract(y*456.21);const d=x*(x+45.32)+y*(y+45.32);x+=d;y+=d;return fract(x*y)};
function vnoise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let fxx=x-ix,fyy=y-iy;fxx=fxx*fxx*(3-2*fxx);fyy=fyy*fyy*(3-2*fyy);
  const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);return lerp(lerp(a,b,fxx),lerp(c,d,fxx),fyy)}
function warp(x,y){const qx=x/140,qy=y/140;let wx=(vnoise(qx,qy)-.5)*2,wy=(vnoise(qx+31.7,qy+17.3)-.5)*2;const q2x=x/45,q2y=y/45;wx+=(vnoise(q2x,q2y)-.5)*.5;wy+=(vnoise(q2x+5.1,q2y+9.2)-.5)*.5;return [x+wx*SET.warp,y+wy*SET.warp]}
function patchAt(x,y){const [wx,wy]=warp(x,y);let s1=1e9,b=null;for(const s of seeds){if(!s.active)continue;const d=Math.hypot(wx-s.x,wy-s.y)/Math.max(s.reach,1);if(d<s1){s1=d;b=s}}return b}

// ---------- the sea (seeded; keyframes every half day) ----------
const OLD_MASSETT=[-132.18,54.04];
const ENVELOPE=[[-140.5,51.5],[-135.5,51.5],[-135.5,54.3],[-140.5,54.3]];
const EDDIES=[{c:[-137.3,52.7],r:90,sign:1},{c:[-134.6,53.9],r:70,sign:1},{c:[-140.2,54.6],r:80,sign:-1}];
const LEGS=[[-137.06,52.85],[-137.9,52.4],[-136.4,52.3],[-136.6,53.3],[-138.0,53.1],[-137.06,52.85],[-132.18,54.04]];
const P={iron:120,eddy:.6,graze:.5,wind:.5};
const MULT={bloom:1,sky:1,wake:1,clock:1};
const SET={warp:60,np:10,speed:2,drift:!reduced,posts:true,terrain:true,relief:25};
const NP=8000,NI=700,NC=2200;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const cellOf=(x,y)=>[clamp((x/CS)|0,0,GW-1),clamp((y/CS)|0,0,GH-1)];
function blur(a){const b=new Float32Array(a.length);for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){let s=0,n=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const xx=x+i,yy=y+j;if(xx>=0&&yy>=0&&xx<GW&&yy<GH){s+=a[yy*GW+xx];n++}}b[y*GW+x]=s/n}return b}
let frames=[],track=[],simRun=0,worker=null;
// the sea runs in a worker so the picture never stalls; it posts keyframes as it goes
function simWorker(){let C,P;const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  onmessage=e=>{C=e.data.C;P=e.data.P;run()};
  function run(){const {FW,FH,GW,GH,CS,NP,NI,NC,KM_LAT,KM_LON,LON0,LON1,LAT0,LAT1,DAY0,DAY1,KF,DT,OLD_MASSETT,EDDIES,LEGS}=C;
    const fx=lon=>(lon-LON0)/(LON1-LON0)*FW,fy=lat=>(LAT1-lat)/(LAT1-LAT0)*FH,cellOf=(x,y)=>[clamp((x/CS)|0,0,GW-1),clamp((y/CS)|0,0,GH-1)];
    const blur=a=>{const b=new Float32Array(a.length);for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){let s=0,n=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const xx=x+i,yy=y+j;if(xx>=0&&yy>=0&&xx<GW&&yy<GH){s+=a[yy*GW+xx];n++}}b[y*GW+x]=s/n}return b};
    const R=mulberry32(7);let day=DAY0,steps=0;const ship={lon:OLD_MASSETT[0],lat:OLD_MASSETT[1],leg:0,acc:0};const track=[];
    const iron=new Float32Array(NI*3).fill(NaN),plank=new Float32Array(NP*2).fill(NaN);
    const freeI=[],freeP=[];for(let i=NI-1;i>=0;i--)freeI.push(i);for(let i=NP-1;i>=0;i--)freeP.push(i);
    const cloud=new Float32Array(NC*4);for(let i=0;i<NC;i++){cloud[i*4]=R()*FW;cloud[i*4+1]=R()*FH;cloud[i*4+2]=5+R()*9;cloud[i*4+3]=R()*6.283}
    const wake=new Float32Array(GW*GH).fill(-1e9);let exported=0,respired=0,area=0,peak=0;
    const flow=(lon,lat)=>{let u=.6,v=1.2;for(const e of EDDIES){const dx=(lon-e.c[0])*KM_LON,dy=(lat-e.c[1])*KM_LAT,d=Math.hypot(dx,dy)+1e-6;const s=e.sign*P.eddy*18*Math.exp(-(d*d)/(e.r*e.r))*(d/e.r)/(.6+(d/e.r));u+=s*(dy/d);v+=-s*(dx/d)}return [u,v]};
    const advect=(arr,i,st,dt)=>{const lon=arr[i*st],lat=arr[i*st+1];const [u,v]=flow(lon,lat);arr[i*st]=lon+u*dt/KM_LON+(R()-.5)*.22*dt;arr[i*st+1]=lat+v*dt/KM_LAT+(R()-.5)*.14*dt};
    function stepShip(dt){const tgt=ship.leg<LEGS.length?LEGS[ship.leg]:null;if(!tgt)return;
      const dx=(tgt[0]-ship.lon)*KM_LON,dy=(tgt[1]-ship.lat)*KM_LAT,d=Math.hypot(dx,dy);const sp=(ship.leg>=1&&ship.leg<=5)?80:300;
      if(d<2){ship.leg++;return}const mv=Math.min(d,sp*dt);ship.lon+=dx/d*mv/KM_LON;ship.lat+=dy/d*mv/KM_LAT;
      if(ship.leg>=1&&ship.leg<=5){ship.acc+=(P.iron/.25/7)*dt;const n=Math.floor(ship.acc);ship.acc-=n;for(let i=0;i<n&&freeI.length;i++){const s=freeI.pop();iron[s*3]=ship.lon+(R()-.5)*.06;iron[s*3+1]=ship.lat+(R()-.5)*.03;iron[s*3+2]=0}}
      const [cx,cy]=cellOf(fx(ship.lon),fy(ship.lat));for(let y=Math.max(0,cy-2);y<=Math.min(GH-1,cy+2);y++)for(let x=Math.max(0,cx-2);x<=Math.min(GW-1,cx+2);x++)if((x-cx)*(x-cx)+(y-cy)*(y-cy)<=4)wake[y*GW+x]=day;
      const t=track[track.length-1];if(!t||Math.hypot(ship.lon-t[0],ship.lat-t[1])>.03)track.push([ship.lon,ship.lat])}
    function step(dt){steps++;day=DAY0+steps*dt;if(day>=0)stepShip(dt);
      for(let i=0;i<NI;i++){if(isNaN(iron[i*3]))continue;advect(iron,i,3,dt);iron[i*3+2]+=dt;if(iron[i*3+2]>45){iron[i*3]=NaN;freeI.push(i);continue}
        if(R()<dt*.12&&freeP.length){const s=freeP.pop();plank[s*2]=iron[i*3]+(R()-.5)*.15;plank[s*2+1]=iron[i*3+1]+(R()-.5)*.08}}
      const nIron=NI-freeI.length,grow=.22*(nIron?1:.1),graze=.05+P.graze*.14,births=[];
      for(let i=0;i<NP;i++){if(isNaN(plank[i*2]))continue;advect(plank,i,2,dt);if(R()<grow*dt)births.push(i);if(R()<graze*dt){plank[i*2]=NaN;freeP.push(i);if(R()<.12)exported++;else respired++}}
      for(const i of births){if(!freeP.length)break;if(isNaN(plank[i*2]))continue;const s=freeP.pop();plank[s*2]=plank[i*2]+(R()-.5)*.3;plank[s*2+1]=plank[i*2+1]+(R()-.5)*.16}
      const cells=new Map();for(let i=0;i<NP;i++){const x=plank[i*2];if(isNaN(x))continue;const k=((x*4)|0)*1000+((plank[i*2+1]*4)|0);cells.set(k,(cells.get(k)||0)+1)}
      let n=0;for(const v of cells.values())if(v>=5)n++;area=n*(.25*KM_LON)*(.25*KM_LAT);peak=Math.max(peak,area);
      const w=P.wind;for(let i=0;i<NC;i++){const o=i*4;cloud[o+3]+=dt*.6;cloud[o]+=(22+14*w+Math.sin(cloud[o+3]+cloud[o+1]*.01)*6)*w*dt*2;cloud[o+1]+=Math.cos(cloud[o+3]*.7+cloud[o]*.004)*4*dt;
        if(cloud[o]>FW+20)cloud[o]-=FW+40;if(cloud[o]<-20)cloud[o]+=FW+40;if(cloud[o+1]<-20)cloud[o+1]+=FH+40;if(cloud[o+1]>FH+20)cloud[o+1]-=FH+40}}
    function snapshot(){const fP=new Float32Array(GW*GH),fK=new Float32Array(GW*GH);
      for(let i=0;i<NP;i++){const lon=plank[i*2];if(isNaN(lon))continue;const [x,y]=cellOf(fx(lon),fy(plank[i*2+1]));fP[y*GW+x]++}
      for(let i=0;i<NC;i++){const x=(cloud[i*4]/CS)|0,y=(cloud[i*4+1]/CS)|0;if(x>=0&&y>=0&&x<GW&&y<GH)fK[y*GW+x]+=cloud[i*4+2]/9}
      const p=blur(fP),k=blur(fK);for(let i=0;i<p.length;i++){p[i]=clamp(p[i]/14,0,1);k[i]=clamp(k[i]/2.2,0,1)}
      const ir=new Float32Array(NI*2),cl=new Float32Array(NC*2);for(let i=0;i<NI;i++){ir[i*2]=iron[i*3];ir[i*2+1]=iron[i*3+1]}for(let i=0;i<NC;i++){cl[i*2]=cloud[i*4];cl[i*2+1]=cloud[i*4+1]}
      const f={day,ship:[ship.lon,ship.lat,ship.leg],trackN:track.length,iron:ir,plank:plank.slice(),cloud:cl,fP:p,fK:k,wake:wake.slice(),area,peak,exported,respired,ironT:(NI-freeI.length)*.25};
      postMessage({frame:f,track:track.slice()},[f.iron.buffer,f.plank.buffer,f.cloud.buffer,f.fP.buffer,f.fK.buffer,f.wake.buffer])}
    const total=Math.round((DAY1-DAY0)/DT),per=Math.round(KF/DT);snapshot();
    while(steps<total){step(DT);if(steps%per===0)snapshot()}postMessage({done:true})}}
function simulate(){if(worker)worker.terminate();frames=[];track=[];
  const src=URL.createObjectURL(new Blob(['('+simWorker.toString()+')()'],{type:'text/javascript'}));worker=new Worker(src);
  worker.onmessage=e=>{const d=e.data;if(d.done){status('');return}frames.push(d.frame);track=d.track;status(`computing the sea: day ${Math.floor(d.frame.day)} of ${DAY1}`)};
  worker.onerror=e=>{status('the sea could not be computed: '+e.message)};
  worker.postMessage({P:{...P},C:{FW,FH,GW,GH,CS,NP,NI,NC,KM_LAT,KM_LON,LON0,LON1,LAT0,LAT1,DAY0,DAY1,KF,DT,OLD_MASSETT,EDDIES,LEGS}})}
simulate();

// interpolated state at a day
const S={ship:[0,0,0],trackN:0,iron:new Float32Array(NI*2).fill(NaN),plank:new Float32Array(NP*2).fill(NaN),pa:new Float32Array(NP),cloud:new Float32Array(NC*2),fP:new Float32Array(GW*GH),fK:new Float32Array(GW*GH),wake:new Float32Array(GW*GH),area:0,peak:0,exported:0,respired:0,ironT:0};
function stateAt(t){if(!frames.length)return;const u=(t-DAY0)/KF;const k=clamp(Math.floor(u),0,frames.length-1),k2=Math.min(k+1,frames.length-1),f=k2>k?clamp(u-k,0,1):0;const A=frames[k],B=frames[k2];
  for(let i=0;i<3;i++)S.ship[i]=lerp(A.ship[i],B.ship[i],f);S.ship[2]=f<.5?A.ship[2]:B.ship[2];S.trackN=f<.5?A.trackN:B.trackN;
  for(let i=0;i<NI*2;i+=2){const ax=A.iron[i],bx=B.iron[i];if(isNaN(ax)&&isNaN(bx)){S.iron[i]=NaN;continue}if(isNaN(ax)){S.iron[i]=bx;S.iron[i+1]=B.iron[i+1];continue}if(isNaN(bx)){S.iron[i]=ax;S.iron[i+1]=A.iron[i+1];continue}S.iron[i]=lerp(ax,bx,f);S.iron[i+1]=lerp(A.iron[i+1],B.iron[i+1],f)}
  for(let i=0;i<NP;i++){const o=i*2,ax=A.plank[o],bx=B.plank[o];if(isNaN(ax)&&isNaN(bx)){S.plank[o]=NaN;S.pa[i]=0;continue}
    if(isNaN(ax)){S.plank[o]=bx;S.plank[o+1]=B.plank[o+1];S.pa[i]=f;continue}if(isNaN(bx)){S.plank[o]=ax;S.plank[o+1]=A.plank[o+1];S.pa[i]=1-f;continue}
    S.plank[o]=lerp(ax,bx,f);S.plank[o+1]=lerp(A.plank[o+1],B.plank[o+1],f);S.pa[i]=1}
  for(let i=0;i<NC*2;i+=2){const ax=A.cloud[i],ay=A.cloud[i+1],bx=B.cloud[i],by=B.cloud[i+1];if(Math.abs(bx-ax)>FW/2||Math.abs(by-ay)>FH/2){S.cloud[i]=ax;S.cloud[i+1]=ay}else{S.cloud[i]=lerp(ax,bx,f);S.cloud[i+1]=lerp(ay,by,f)}}
  for(let i=0;i<GW*GH;i++){S.fP[i]=lerp(A.fP[i],B.fP[i],f);S.fK[i]=lerp(A.fK[i],B.fK[i],f)}S.wake.set(A.wake);
  for(const k of ['area','peak','exported','respired','ironT'])S[k]=lerp(A[k],B[k],f)}

// ---------- the patches: seeds that ride on the sea ----------
const FEATURES=[
  {id:'ship',name:'the ship',w:{bloom:.1,sky:.1,wake:1,clock:.3},reach:170},
  {id:'eddy0',name:'the Haida eddy',fixed:[-137.3,52.7],w:{bloom:1,sky:.15,wake:.2,clock:.2},reach:250},
  {id:'eddy1',name:'the eastern eddy',fixed:[-134.6,53.9],w:{bloom:1,sky:.15,clock:.2},reach:200},
  {id:'eddy2',name:'the western eddy',fixed:[-140.2,54.6],w:{bloom:1,sky:.15,clock:.2},reach:220},
  {id:'bloom',name:'the bloom',w:{bloom:1,clock:.1},reach:0},
  {id:'cloud',name:'the sky',w:{sky:1,clock:.2},reach:240}];
const ANCHORS=[
  {id:'nw',name:'open water, north-west',fixed:[-143,56.6],w:{clock:1,sky:.3},reach:600},
  {id:'sw',name:'open water, south-west',fixed:[-143,50.4],w:{clock:1,sky:.3},reach:600},
  {id:'coast',name:'the coast',fixed:[-129.8,56.4],w:{clock:1,sky:.3},reach:560},
  {id:'se',name:'Queen Charlotte Sound',fixed:[-130.3,50.6],w:{clock:1,sky:.3},reach:560},
  {id:'n',name:'open water, north',fixed:[-137,57.2],w:{clock:1,sky:.3},reach:480},
  {id:'s',name:'open water, south',fixed:[-137.5,49.7],w:{clock:1,sky:.3},reach:480},
  {id:'w',name:'open water, west',fixed:[-144.4,53.3],w:{clock:1,sky:.3},reach:480},
  {id:'e',name:'Hecate Strait',fixed:[-130.6,53.4],w:{clock:1,sky:.3},reach:440}];
let seeds=[];
function buildSeeds(){const keep=new Map(seeds.map(s=>[s.id,s]));seeds=[...FEATURES,...ANCHORS.slice(0,SET.np-FEATURES.length)].map(d=>keep.get(d.id)||({...d,x:d.fixed?fx(d.fixed[0]):FW/2,y:d.fixed?fy(d.fixed[1]):FH/2,tx:0,ty:0,reach0:d.reach,treach:d.reach,active:true,a:-1,b:-1,t:0,fading:false,cand:-1,why:'',scores:null}))}
buildSeeds();
function moveSeeds(dt){let bx=0,by=0,bn=0;for(let i=0;i<NP;i++){const x=S.plank[i*2];if(isNaN(x))continue;bx+=fx(x);by+=fy(S.plank[i*2+1]);bn++}
  let km=0,kc=0;for(let i=0;i<GW*GH;i++)if(S.fK[i]>km){km=S.fK[i];kc=i}
  for(const s of seeds){let rate=.08;
    if(s.id==='ship'){s.tx=fx(S.ship[0]);s.ty=fy(S.ship[1]);s.treach=s.reach0;rate=.35;s.active=true}
    else if(s.id==='bloom'){const on=bn>40&&S.area>120;s.active=s.active?on||S.area>60:on;if(bn){s.tx=bx/bn;s.ty=by/bn}else{s.tx=fx(EDDIES[0].c[0]);s.ty=fy(EDDIES[0].c[1])}s.treach=on?clamp(40+1.6*Math.sqrt(S.area),60,380):40;rate=.06}
    else if(s.id==='cloud'){s.active=km>.3;s.tx=(kc%GW+.5)*CS;s.ty=((kc/GW|0)+.5)*CS;s.treach=s.reach0*(.6+.6*km);rate=.025}
    else{s.tx=fx(s.fixed[0]);s.ty=fy(s.fixed[1]);s.treach=s.reach0;s.active=true}
    const k=1-Math.pow(1-rate,dt*60);s.x+=(s.tx-s.x)*k;s.y+=(s.ty-s.y)*k;s.reach+=(s.treach-s.reach)*k}}
const TERMS=['the bloom','the sky',"the ship's wake",'the clock'];
function witness(s){const [cx,cy]=cellOf(s.x,s.y);const rc=clamp(Math.round(s.reach/CS*.6),1,6);const cells=[];let p=0,k=0,tw=-1e9;
  for(let y=Math.max(0,cy-rc);y<=Math.min(GH-1,cy+rc);y++)for(let x=Math.max(0,cx-rc);x<=Math.min(GW-1,cx+rc);x++){if((x-cx)*(x-cx)+(y-cy)*(y-cy)>rc*rc)continue;const c=y*GW+x;cells.push(c);p+=S.fP[c];k+=S.fK[c];tw=Math.max(tw,S.wake[c])}
  const n=cells.length||1;p/=n;k/=n;const ap=clamp(p*6,.12,1),ak=clamp(k*3,.15,1),w=s.w;const sc=new Float32Array(CAL.length),terms=[];
  for(let d=0;d<CAL.length;d++){const e=CAL[d];let cv=0,cn=0,cl=0;for(const c of cells){const v=e.chl[c];if(v>=0){cv+=v;cn++}cl+=e.cloud[c]}cl/=n;cv=cn?cv/cn:-1;
    const tb=(w.bloom||0)*MULT.bloom*ap*(cv<0?(1-p)*.5:1-Math.abs(cv-p)),ts=(w.sky||0)*MULT.sky*ak*(1-Math.abs(cl-k)),tk=(w.wake||0)*MULT.wake*(tw>-1e8?Math.exp(-Math.abs(e.n-tw)/8):0),tc=(w.clock||0)*MULT.clock*Math.exp(-Math.abs(e.n-day)/12);
    sc[d]=tb+ts+tk+tc;terms.push([tb,ts,tk,tc])}
  return {sc,terms,p,k,tw}}
const ease=u=>u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;
function updatePatches(now,force){for(const s of seeds){if(!s.active&&s.a>=0)continue;const r=witness(s);s.scores=r;let best=0;for(let d=1;d<CAL.length;d++)if(r.sc[d]>r.sc[best])best=d;
  const whyOf=d=>{const t=r.terms[d];let m=0;for(let i=1;i<4;i++)if(t[i]>t[m])m=i;return TERMS[m]};
  if(s.a<0||force){s.a=s.b=best;s.t=0;s.fading=false;s.why=whyOf(best);continue}
  if(s.fading){const u=(now-s.fadeStart)/(reduced?1:1400);if(u>=1){s.a=s.b;s.t=0;s.fading=false}else s.t=ease(u);continue}
  if(best!==s.a&&r.sc[best]>r.sc[s.a]+.04){if(s.cand!==best){s.cand=best;s.candSince=now}else if(now-s.candSince>350){s.b=best;s.fading=true;s.fadeStart=now;s.t=0;s.why=whyOf(best);s.cand=-1}}else s.cand=-1}}

// ---------- planes (FW × FH each, black on transparent) ----------
const Z={composite:0,labels:3,map:40,sea:90,cloud:200,inst:280};
const NAME={map:'Map',sea:'Sea surface',cloud:'Cloud deck',inst:'Instruments'};
const plane={};for(const k of ['map','sea','cloud','inst']){plane[k]=oc(FW,FH);plane[k].ctx=plane[k].getContext('2d')}
// one weight, −2 % tracking, everywhere (DESIGN LANGUAGE §1)
function font(ctx,px){ctx.font=`400 ${px}px "ABC Diatype","Helvetica Neue",Helvetica,Arial,sans-serif`;ctx.letterSpacing=(-.02*px).toFixed(2)+'px'}
const pxf=(lon,lat)=>[fx(lon),fy(lat)];
// text never goes into a plane: it is listed here with its anchor and drawn flat to the screen, lifted on a leader
const MAPTXT=[];let INSTTXT=[],CHIPS=[];
function drawMap(){const ctx=plane.map.ctx;ctx.clearRect(0,0,FW,FH);ctx.drawImage(coast,0,0);
  ctx.globalCompositeOperation='source-in';ctx.fillStyle=COL.map;ctx.fillRect(0,0,FW,FH);ctx.globalCompositeOperation='source-over';
  ctx.strokeStyle=COL.map;ctx.fillStyle=COL.map;const T=(x,y,t,o)=>MAPTXT.push({x,y,z:Z.map,t,col:COL.map,...o});
  ctx.lineWidth=.6;ctx.setLineDash([1,4]);
  for(let lon=-145;lon<=-127;lon+=3){const x=fx(lon);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,FH);ctx.stroke();T(x,FH,Math.abs(lon)+'° W',{size:10,align:'center',dy:14})}
  for(let lat=50;lat<=57;lat+=2){const y=fy(lat);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(FW,y);ctx.stroke();T(FW,y,lat+'° N',{size:10,align:'left',dx:6,dy:4})}
  ctx.setLineDash([3,4]);ctx.lineWidth=.9;ctx.beginPath();ENVELOPE.forEach((c,i)=>{const [x,y]=pxf(...c);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  {const [x,y]=pxf(-140.5,54.3);T(x,y,'Reported bloom envelope, 2012',{lift:1})}
  for(const e of EDDIES){const [x,y]=pxf(...e.c);ctx.lineWidth=.7;ctx.setLineDash([1,3]);ctx.beginPath();ctx.arc(x,y,e.r/KM_LON*(FW/(LON1-LON0)),0,6.2832);ctx.stroke();ctx.setLineDash([])}
  {const [x,y]=pxf(...EDDIES[0].c);T(x,y-EDDIES[0].r/KM_LON*(FW/(LON1-LON0)),'Haida eddy',{lift:1,align:'center'})}
  ctx.setLineDash([2,3]);ctx.lineWidth=.7;ctx.beginPath();LEGS.forEach((c,i)=>{const [x,y]=pxf(...c);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.setLineDash([]);
  {const [x,y]=pxf(...OLD_MASSETT);ctx.beginPath();ctx.arc(x,y,3,0,6.2832);ctx.fill();T(x,y,'Old Massett',{lift:1})}
  // scale bar in miles (imperial readouts)
  {const mipx=FW/(LON1-LON0)/KM_LON*1.609344,L=100*mipx,x0=FW-30-L,y0=22;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x0+L,y0);ctx.moveTo(x0,y0-4);ctx.lineTo(x0,y0+4);ctx.moveTo(x0+L,y0-4);ctx.lineTo(x0+L,y0+4);ctx.stroke();T(x0+L/2,y0,'100 mi',{size:10,align:'center',dy:16})}}
drawMap();
function drawSea(){const ctx=plane.sea.ctx;ctx.clearRect(0,0,FW,FH);
  ctx.strokeStyle=COL.iron;if(S.trackN>1){ctx.lineWidth=1.2;ctx.beginPath();for(let i=0;i<S.trackN;i++){const [x,y]=pxf(...track[i]);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke()}
  ctx.fillStyle=COL.plankton;for(let a=4;a>=1;a--){ctx.globalAlpha=a/4*.7;for(let i=0;i<NP;i+=2){const x=S.plank[i*2];if(isNaN(x))continue;const q=Math.ceil(S.pa[i]*4);if(q!==a)continue;ctx.fillRect(fx(x)-.8,fy(S.plank[i*2+1])-.8,1.6,1.6)}}
  ctx.globalAlpha=1;ctx.lineWidth=1;for(let i=0;i<NI;i++){const x=S.iron[i*2];if(isNaN(x))continue;ctx.beginPath();ctx.arc(fx(x),fy(S.iron[i*2+1]),2.2,0,6.2832);ctx.stroke()}}
function drawCloud(){const ctx=plane.cloud.ctx;ctx.clearRect(0,0,FW,FH);ctx.fillStyle=COL.cloud;
  for(let i=0;i<NC;i++){const x=S.cloud[i*2],y=S.cloud[i*2+1];const s=patchAt(x,y);if(!s)continue;const [cx,cy]=cellOf(x,y);const c=cy*GW+cx;const k=lerp(CAL[s.a].cloud[c],CAL[s.b].cloud[c],s.t);if(k<.3)continue;
    const n=2+((k*5)|0),sz=5+hash(i,3)*9,ph=hash(i,7)*6.283;for(let j=0;j<n;j++){const a=ph+j*2.1,r=sz*(.3+.7*hash(j,i));ctx.fillRect(x+Math.cos(a)*r,y+Math.sin(a)*r*.6,1.6,1.6)}}}
function drawInst(){const ctx=plane.inst.ctx;ctx.clearRect(0,0,FW,FH);ctx.strokeStyle=COL.inst;INSTTXT=[];
  {const [x,y]=pxf(S.ship[0],S.ship[1]);ctx.lineWidth=1.2;ctx.fillStyle='#000';ctx.beginPath();ctx.moveTo(x-8,y+4);ctx.lineTo(x+8,y+4);ctx.lineTo(x+5,y-4);ctx.lineTo(x-5,y-4);ctx.closePath();ctx.fill();ctx.stroke();
   INSTTXT.push({x,y,z:Z.inst,t:day<0?'Ocean Pearl, in port':S.ship[2]>=LEGS.length?'Ocean Pearl, home':'Ocean Pearl',col:COL.inst,lift:1})}
  const frac=fract(day),x=FW*(1-frac),on=CAL.find(e=>Math.abs(e.n-day)<.5);ctx.lineWidth=on?1.4:.7;ctx.setLineDash(on?[]:[6,6]);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+40,FH);ctx.stroke();ctx.setLineDash([]);
  INSTTXT.push({x,y:0,z:Z.inst,t:on?'Aqua, pass of '+fmtShort(on.n):'Aqua',col:COL.inst,size:10,dx:6,dy:-6})}
// the date chips: one per visible patch, anchored on the composite, drawn flat to the screen
function drawLabels(){CHIPS=[];for(const s of seeds){if(!s.active||s.a<0)continue;if(patchAt(s.x,s.y)!==s)continue;
  // during a crossfade only the nearer day is named, so two chips never stack on one anchor
  CHIPS.push({x:s.x,y:s.y,d:s.t<.5?s.a:s.b,alpha:.55+.45*Math.abs(1-2*s.t),name:s.name})}}
const liftPx=()=>10+52*Math.sin(cam.ax);
function halo(c,t,x,y,col){c.lineJoin='round';c.lineWidth=3;c.strokeStyle='#000';c.strokeText(t,x,y);c.fillStyle=col;c.fillText(t,x,y)}
function drawText(c){const L=liftPx();c.textBaseline='alphabetic';
  for(const it of [...MAPTXT,...INSTTXT]){const p=proj(it.x,it.y,it.z);let qx=p[0]+(it.dx||0),qy=p[1]+(it.dy||0);
    if(it.lift){qy-=L;c.strokeStyle=it.col;c.globalAlpha=.8;c.lineWidth=.8;c.beginPath();c.moveTo(p[0],p[1]);c.lineTo(qx,qy+3);c.stroke();c.globalAlpha=1;c.fillStyle=it.col;c.fillRect(p[0]-1.5,p[1]-1.5,3,3)}
    font(c,it.size||12);c.textAlign=it.align||(it.lift?'center':'left');halo(c,it.t,qx,qy,it.col)}
  const placed=[];
  for(const ch of CHIPS.map(ch=>({...ch,p:proj(ch.x,ch.y,Z.labels)})).sort((a,b)=>b.p[1]-a.p[1])){const p=ch.p,date=fmtShort(CAL[ch.d].n);font(c,13);const wd=c.measureText(date).width;font(c,10);const w=Math.max(wd+14,c.measureText(ch.name).width)+16,h=36;
    // a chip that would cover one already placed climbs above it
    const x=p[0]-w/2;let y=p[1]-L-h-6;for(let n=0;n<6;n++){const hit=placed.find(r=>x<r[0]+r[2]+4&&x+w+4>r[0]&&y<r[1]+r[3]+4&&y+h+4>r[1]);if(!hit)break;y=hit[1]-h-6}placed.push([x,y,w,h]);c.globalAlpha=ch.alpha;c.strokeStyle='#fff';c.lineWidth=1;c.beginPath();c.moveTo(p[0],p[1]);c.lineTo(p[0],y+h);c.stroke();c.fillStyle='#fff';c.fillRect(p[0]-2,p[1]-2,4,4);
    c.fillRect(x,y,w,h);c.fillStyle=monthRGB(monthOf(CAL[ch.d].n));c.fillRect(x+8,y+7,8,8);c.fillStyle='#000';c.textAlign='left';font(c,13);c.fillText(date,x+22,y+15);font(c,10);c.fillStyle='#555';c.fillText(ch.name,x+8,y+29)}
  c.globalAlpha=1}
function drawTerrain(c){if(!TER||!SET.terrain)return;const k=SET.relief*FW/(LON1-LON0)/KM_LON/1000;c.strokeStyle=COL.terrain;c.lineWidth=.7;c.globalAlpha=.75;
  for(let j=0;j<TH;j+=3){const y=(j+.5)/TH*FH;c.beginPath();let pen=false;for(let i=0;i<TW;i++){const h=TER[j*TW+i];if(h<=0){pen=false;continue}const [sx,sy]=proj((i+.5)/TW*FW,y,h*k);if(pen)c.lineTo(sx,sy);else{c.moveTo(sx,sy);pen=true}}c.stroke()}c.globalAlpha=1}

// ---------- camera (orthographic orbit: spin about the frame's normal, then tilt) ----------
const canvas=$('#c'),ctx=canvas.getContext('2d');let W=0,H=0,DPR=1;
const cam={ax:.52,az:.42,zoom:1,px:0,py:0};let lastTouch=performance.now()-9e9;
function proj(x,y,z){const X=x-FW/2,Y=y-FH/2,cz=Math.cos(cam.az),sz=Math.sin(cam.az),xr=cz*X-sz*Y,yr=sz*X+cz*Y,ca=Math.cos(cam.ax),sa=Math.sin(cam.ax);return [W/2+cam.px+cam.zoom*xr,H/2+cam.py+cam.zoom*(ca*yr-sa*z)]}
function affine(z){const p0=proj(0,0,z),p1=proj(FW,0,z),p2=proj(0,FH,z);return [(p1[0]-p0[0])/FW,(p1[1]-p0[1])/FW,(p2[0]-p0[0])/FH,(p2[1]-p0[1])/FH,p0[0],p0[1]]}
function unproj(sx,sy){const [a,b,c,d,e,f]=affine(0),det=a*d-b*c;if(Math.abs(det)<1e-9)return null;const X=sx-e,Y=sy-f;return [(d*X-c*Y)/det,(-b*X+a*Y)/det]}
function fit(){const r=Math.hypot(FW,FH)/2,ca=Math.cos(cam.ax),sa=Math.sin(cam.ax),bw=2*r,bh=2*r*ca+sa*Z.inst;const small=W<700;
  cam.zoom=Math.min((W-(small?24:60))/bw,(H-(small?140:110))/bh);cam.px=0;cam.py=cam.zoom*sa*Z.inst/2+(small?30:36)}
function resize(){const r=$('#stage').getBoundingClientRect();DPR=Math.min(2,devicePixelRatio||1);W=r.width;H=r.height;canvas.width=W*DPR;canvas.height=H*DPR;fit()}
const PCOL={map:COL.map,sea:COL.plankton,cloud:COL.cloud,inst:COL.inst};
function render(c,w,h,dpr){c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#000';c.fillRect(0,0,w,h);
  const order=[['composite',glc],['map',plane.map],['sea',plane.sea],['cloud',plane.cloud],['inst',plane.inst]];
  const tilted=Math.abs(cam.ax)>.03&&SET.posts;
  if(tilted){c.strokeStyle='rgba(255,255,255,.3)';c.lineWidth=.6;c.beginPath();for(const [x,y] of [[0,0],[FW,0],[0,FH],[FW,FH]]){const p0=proj(x,y,0),p1=proj(x,y,Z.inst);c.moveTo(...p0);c.lineTo(...p1)}c.stroke()}
  for(const [k,img] of order){const z=Z[k],[a,b,cc,d,e,f]=affine(z);c.setTransform(a*dpr,b*dpr,cc*dpr,d*dpr,e*dpr,f*dpr);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(img,0,0);
    if(k==='composite'||(tilted&&NAME[k])){c.strokeStyle=k==='composite'?'#fff':PCOL[k];c.globalAlpha=k==='composite'?1:.45;c.lineWidth=(k==='composite'?1:.6)/cam.zoom;c.strokeRect(0,0,FW,FH);c.globalAlpha=1}
    c.setTransform(dpr,0,0,dpr,0,0);if(k==='composite')drawTerrain(c);
    if(tilted&&NAME[k]&&W>700){const [x,y]=proj(FW,0,z);font(c,12);c.textAlign='left';halo(c,NAME[k],x+8,y+4,PCOL[k])}}
  if(tilted&&TER&&SET.terrain&&W>700){const [x,y]=proj(FW,FH*.12,Z.labels);font(c,12);c.textAlign='left';halo(c,'Terrain',x+8,y+4,COL.terrain)}
  drawText(c);c.setTransform(dpr,0,0,dpr,0,0)}

// ---------- the clock ----------
let day=0,lastDay=0,running=false,last=0,nframe=0,usage=new Float32Array(CAL.length);
const ck=$('#ck'),kx=ck.getContext('2d');
const maxDay=()=>frames.length?Math.min(DAY1,frames[frames.length-1].day):DAY0;
function clockGeom(){const r=ck.getBoundingClientRect();return {w:r.width,h:r.height,x0:8,x1:r.width-8}};
const dayX=(d,g)=>g.x0+(d-DAY0)/(DAY1-DAY0)*(g.x1-g.x0);
function drawClock(){const g=clockGeom();const dpr=Math.min(2,devicePixelRatio||1);if(ck.width!==g.w*dpr||ck.height!==g.h*dpr){ck.width=g.w*dpr;ck.height=g.h*dpr}kx.setTransform(dpr,0,0,dpr,0,0);kx.clearRect(0,0,g.w,g.h);
  const yl=44;kx.strokeStyle='#000';kx.lineWidth=1;kx.beginPath();kx.moveTo(g.x0,yl);kx.lineTo(dayX(maxDay(),g),yl);kx.stroke();
  if(maxDay()<DAY1){kx.strokeStyle='#d9d9d9';kx.beginPath();kx.moveTo(dayX(maxDay(),g),yl);kx.lineTo(g.x1,yl);kx.stroke()}
  font(kx,10);kx.fillStyle='#7a7a7a';kx.textAlign='left';
  for(const m of [[2012,6],[2012,7],[2012,8],[2012,9]]){const d=(Date.UTC(m[0],m[1],1)-EPOCH)/86400000;const x=dayX(d,g);kx.strokeStyle='#000';kx.beginPath();kx.moveTo(x,yl);kx.lineTo(x,yl+6);kx.stroke();if(g.w>420)kx.fillText(fmtMonth(d),x+3,yl+17)}
  for(let i=0;i<CAL.length;i++){const x=dayX(CAL[i].n,g),h=5+usage[i]*26;kx.strokeStyle=monthRGB(monthOf(CAL[i].n));kx.lineWidth=usage[i]>.001?2:1;kx.beginPath();kx.moveTo(x,yl);kx.lineTo(x,yl-h);kx.stroke()}
  {const x=dayX(0,g);kx.lineWidth=1;kx.beginPath();kx.moveTo(x,yl-32);kx.lineTo(x,yl);kx.stroke();kx.fillStyle='#000';kx.textAlign=g.w>420?'left':'center';kx.fillText(g.w>420?'the iron goes in':'iron',x+(g.w>420?4:0),yl-24)}
  const x=dayX(day,g);kx.fillStyle='#000';kx.beginPath();kx.arc(x,yl,5,0,6.2832);kx.fill();
  $('#d-long').textContent=W>700?fmtLong(day):fmtShort(day)+' 2012';$('#d-sub').textContent=`day ${Math.floor(day)}${day<0?' before the release':''}`}
function setDay(t){day=clamp(t,DAY0,maxDay())}
let scrub=false;
ck.addEventListener('pointerdown',e=>{scrub=true;ck.setPointerCapture(e.pointerId);const g=clockGeom(),r=ck.getBoundingClientRect();setDay(DAY0+(e.clientX-r.left-g.x0)/(g.x1-g.x0)*(DAY1-DAY0))});
ck.addEventListener('pointermove',e=>{if(!scrub)return;const g=clockGeom(),r=ck.getBoundingClientRect();setDay(DAY0+(e.clientX-r.left-g.x0)/(g.x1-g.x0)*(DAY1-DAY0))});
ck.addEventListener('pointerup',()=>{scrub=false});ck.addEventListener('pointercancel',()=>{scrub=false});
function setRunning(v){running=v;const b=$('#play');b.textContent=v?'Pause':'Run';b.setAttribute('aria-pressed',String(v))}
$('#play').addEventListener('click',()=>setRunning(!running));

// ---------- pointer on the picture: orbit, pan, zoom, read ----------
const stage=$('#stage');let drag=null,mouse=null;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);const r=canvas.getBoundingClientRect();drag={sx:e.clientX-r.left,sy:e.clientY-r.top,ax:cam.ax,az:cam.az,px:cam.px,py:cam.py,pan:e.altKey||e.button===1};stage.classList.add('drag');lastTouch=performance.now();$('#read').hidden=true});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top;mouse=[sx,sy];
  if(!drag)return;lastTouch=performance.now();if(drag.pan){cam.px=drag.px+(sx-drag.sx);cam.py=drag.py+(sy-drag.sy)}else{cam.az=drag.az+(sx-drag.sx)*.006;cam.ax=clamp(drag.ax-(sy-drag.sy)*.004,0,1.15)}});
const endDrag=()=>{drag=null;stage.classList.remove('drag')};canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
canvas.addEventListener('pointerleave',()=>{mouse=null;$('#read').hidden=true});
canvas.addEventListener('wheel',e=>{e.preventDefault();lastTouch=performance.now();const r=canvas.getBoundingClientRect(),sx=e.clientX-r.left-W/2,sy=e.clientY-r.top-H/2,k=Math.exp(-e.deltaY*.0015);cam.px=sx-(sx-cam.px)*k;cam.py=sy-(sy-cam.py)*k;cam.zoom*=k},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function readout(){const el=$('#read');if(!mouse||drag||!frames.length){el.hidden=true;return}const f=unproj(...mouse);if(!f||f[0]<0||f[1]<0||f[0]>FW||f[1]>FH){el.hidden=true;return}
  const s=patchAt(...f);if(!s||s.a<0){el.hidden=true;return}const d=s.fading?s.b:s.a,e=CAL[d];const [cx,cy]=cellOf(...f);const c=cy*GW+cx;const p=S.fP[c],k=S.fK[c],cv=e.chl[c],cl=e.cloud[c],tw=S.wake[c];
  const under=[];if(p>.08)under.push(`plankton ${p>.5?'dense':'present'}`);if(k>.3)under.push('cloud');if(tw>-1e8&&day-tw<20)under.push(`the ship passed ${Math.max(0,Math.round(day-tw))} days ago`);
  const seen=[];if(cv>=0)seen.push(`chlorophyll ${cv>.5?'high':cv>.2?'some':'low'}`);else seen.push('no water seen');if(cl>.5)seen.push('mostly cloud');
  el.innerHTML=`<span class="d">${fmtShort(e.n)}</span> · ${s.name}<br>chosen for ${s.why}${s.fading?' (changing)':''}<br><span class="m">simulated: ${under.length?under.join(', '):'open water'}<br>the pass shows: ${seen.join(', ')}</span>`;
  el.hidden=false;const x=mouse[0]+16,y=mouse[1]+16;el.style.left=Math.min(x,W-el.offsetWidth-8)+'px';el.style.top=Math.min(y,H-el.offsetHeight-8)+'px'}

// ---------- usage (share of the picture per pass, from a coarse patch raster) ----------
function measure(){usage.fill(0);const n=90,m=45;let tot=0;for(let y=0;y<m;y++)for(let x=0;x<n;x++){const s=patchAt((x+.5)*FW/n,(y+.5)*FH/m);if(!s||s.a<0)continue;usage[s.a]+=1-s.t;usage[s.b]+=s.t;tot++}if(tot)for(let i=0;i<usage.length;i++)usage[i]/=tot}

// ---------- frame ----------
function frame(ts){const dt=Math.min(.05,(ts-last)/1000||.016);last=ts;
  if(running&&!scrub){day+=dt*SET.speed;if(day>=maxDay()){day=maxDay();if(day>=DAY1)setRunning(false)}}
  stateAt(day);moveSeeds(dt);
  if(SET.drift&&!drag&&!reduced&&ts-lastTouch>4000)cam.az+=dt*.06;
  const jump=Math.abs(day-lastDay)>3;lastDay=day;if(jump)updatePatches(ts,true);else if(nframe%3===0)updatePatches(ts,false);else for(const s of seeds)if(s.fading){const u=(ts-s.fadeStart)/(reduced?1:1400);s.t=u>=1?1:ease(u)}
  drawComposite(seeds);drawLabels();drawSea();drawCloud();drawInst();render(ctx,W,H,DPR);
  if(nframe%4===0)readout();if(nframe%20===0)measure();drawClock();nframe++;requestAnimationFrame(frame)}

// ---------- settings ----------
const panel=$('#panel'),word=$('#word');
word.addEventListener('click',()=>{const open=panel.hidden;panel.hidden=!open;word.setAttribute('aria-expanded',String(open))});
let resimT=0;const resim=()=>{clearTimeout(resimT);resimT=setTimeout(()=>{simulate();for(const s of seeds){s.a=-1;s.fading=false}},350)};
for(const k of ['iron','eddy','graze','wind']){$('#'+k).addEventListener('input',e=>{P[k]=+e.target.value;$('#v-'+k).textContent=k==='iron'?P.iron+' t':P[k].toFixed(2);resim()})}
for(const k of ['bloom','sky','wake','clock']){$('#m-'+k).addEventListener('input',e=>{MULT[k]=+e.target.value;$('#v-m-'+k).textContent=MULT[k].toFixed(2)})}
$('#np').addEventListener('input',e=>{SET.np=+e.target.value;$('#v-np').textContent=SET.np;buildSeeds()});
$('#warp').addEventListener('input',e=>{SET.warp=+e.target.value;$('#v-warp').textContent=SET.warp});
$('#speed').addEventListener('input',e=>{SET.speed=+e.target.value;$('#v-speed').textContent=SET.speed+' days / s'});
$('#drift').checked=SET.drift;$('#drift').addEventListener('change',e=>{SET.drift=e.target.checked});
$('#posts').addEventListener('change',e=>{SET.posts=e.target.checked});
$('#terrain').addEventListener('change',e=>{SET.terrain=e.target.checked});
$('#relief').addEventListener('input',e=>{SET.relief=+e.target.value;$('#v-relief').textContent='×'+SET.relief});
// the key: one swatch per layer, with its citation number
$('#key').innerHTML=[['Composite of passes',COL.edge,1],['Coast and graticule',COL.map,2],['Plankton (simulated)',COL.plankton,4],['Iron and ship track (simulated)',COL.iron,4],['Cloud deck',COL.cloud,1],['Ship and satellite',COL.inst,4],[`Terrain, to ${Math.round(TERMAX*3.28084).toLocaleString('en-US')} ft`,COL.terrain,3]]
  .filter(r=>r[2]!==3||TER).map(([t,c,n])=>`<span><i style="background:${c}"></i>${t}<sup>${n}</sup></span>`).join('');
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;const k=e.key;
  if(k===' '){e.preventDefault();setRunning(!running)}else if(k==='f'||k==='F')fit();else if(k==='ArrowRight')setDay(Math.floor(day)+1);else if(k==='ArrowLeft')setDay(Math.ceil(day)-1);else if(k==='Escape'){panel.hidden=true;word.setAttribute('aria-expanded','false');$('#shot').hidden=true}});

// ---------- out ----------
$('#png').addEventListener('click',()=>{const k=Math.min(2,4096/Math.max(W,H));const c=oc(W*k,H*k);render(c.getContext('2d'),W,H,k);$('#shotimg').src=c.toDataURL('image/png');$('#shot').hidden=false});
$('#shotclose').addEventListener('click',()=>{$('#shot').hidden=true});
$('#svgb').addEventListener('click',()=>{const n=180,m=90,cw=FW/n,chh=FH/m;const rows=[];
  for(let y=0;y<m;y++){let x=0;while(x<n){const s=patchAt((x+.5)*cw,(y+.5)*chh);let x1=x+1;while(x1<n&&patchAt((x1+.5)*cw,(y+.5)*chh)===s)x1++;if(s&&s.a>=0)rows.push(`<rect x="${(x*cw).toFixed(1)}" y="${(y*chh).toFixed(1)}" width="${((x1-x)*cw).toFixed(1)}" height="${chh.toFixed(1)}" data-day="${CAL[s.fading?s.b:s.a].date}" data-patch="${s.id}" class="p-${s.id}"/>`);x=x1}}
  const styles=seeds.map((s,i)=>`.p-${s.id}{fill:hsl(0,0%,${20+i*6}%)}`).join('');
  const legend=seeds.filter(s=>s.active&&s.a>=0).map((s,i)=>`<text x="20" y="${FH+30+i*14}" font-size="11" font-family="ABC Diatype">${s.name} · ${CAL[s.fading?s.b:s.a].date} · chosen for ${s.why}</text>`).join('\n');
  $('#txt').value=`<svg xmlns="http://www.w3.org/2000/svg" width="34in" height="17in" viewBox="0 0 ${FW} ${FH+20+seeds.length*14}"><style>${styles}</style><g id="patches" stroke="none">\n${rows.join('\n')}\n</g><g id="legend">\n${legend}\n</g></svg>`});
$('#save').addEventListener('click',()=>{$('#txt').value=JSON.stringify({app:'haida-orbit',version:1,day,sim:{...P},witness:{...MULT},settings:{...SET},camera:{ax:cam.ax,az:cam.az,zoom:cam.zoom,px:cam.px,py:cam.py},patches:seeds.map(s=>({id:s.id,day:CAL[s.fading?s.b:s.a]?.date,why:s.why}))},null,1)});
$('#apply').addEventListener('click',()=>{let s;try{s=JSON.parse($('#txt').value)}catch(e){status('that is not a setup');setTimeout(()=>status(''),2500);return}
  let changed=false;if(s.sim)for(const k in P)if(k in s.sim&&P[k]!==s.sim[k]){P[k]=s.sim[k];$('#'+k).value=P[k];$('#v-'+k).textContent=k==='iron'?P.iron+' t':P[k].toFixed(2);changed=true}
  if(s.witness)for(const k in MULT)if(k in s.witness){MULT[k]=s.witness[k];$('#m-'+k).value=MULT[k];$('#v-m-'+k).textContent=MULT[k].toFixed(2)}
  if(s.settings){Object.assign(SET,s.settings);$('#np').value=SET.np;$('#v-np').textContent=SET.np;$('#warp').value=SET.warp;$('#v-warp').textContent=SET.warp;$('#speed').value=SET.speed;$('#v-speed').textContent=SET.speed+' days / s';$('#drift').checked=SET.drift;$('#posts').checked=SET.posts;$('#terrain').checked=SET.terrain;$('#relief').value=SET.relief;$('#v-relief').textContent='×'+SET.relief;buildSeeds()}
  if(s.camera)Object.assign(cam,s.camera);if(changed)simulate();else for(const q of seeds){q.a=-1;q.fading=false}
  day=clamp(+s.day||0,DAY0,DAY1)});
$('#copy').addEventListener('click',async()=>{const t=$('#txt');try{await navigator.clipboard.writeText(t.value)}catch(e){t.focus();t.select()}});

addEventListener('resize',()=>{resize();drawClock()});resize();
requestAnimationFrame(frame);
window.__hw={CAL,seeds,cam,S,get day(){return day},setDay,frames:()=>frames,patchAt,P,MULT,SET};
})().catch(e=>{const el=document.getElementById('err');el.hidden=false;el.textContent='Could not start: '+e.message;document.getElementById('status').hidden=true;console.error(e)});
