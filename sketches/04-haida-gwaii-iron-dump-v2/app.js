(async function(){
'use strict';
// Haida Gwaii Iron Dump — a small 3D model you can move around in, with a story told along its clock.
// One frame (49–58° N, 145–127° W) built as a block that sits on a map of the wider region. The land is real relief
// with a sharp satellite picture draped over it. The sea is cleaned of cloud and haze, and carries the chlorophyll the
// satellites measured, in colour and as a low relief, fading through time between nineteen composites.
// Streaks show the currents measured by satellite altimeters. On the sea sits a toy simulation of the 2012 release:
// the ship, the iron, and plankton carried by those measured currents, drawn as stems whose height shows how dense they are. The simulation is deterministic and stored as keyframes, so the clock scrubs both ways.
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t, fract=x=>x-Math.floor(x);
const LON0=-145,LON1=-127,LAT0=49,LAT1=58, FW=1800,FH=900;
const A0=-170,A1=-105,B0=30,B1=72;                            // the wider region under the block
const GW=64,GH=32, CS=FW/GW;                                  // coarse field grid for the sea
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

// ---------- pictures ----------
const load=src=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('missing '+src));im.src=src});
const index=await (await fetch('cal/index.json')).json();
const CAL=index.map(e=>({...e,n:dayNum(e.date)}));            // the dates of the cloud-cleared composites
const [coast,terr,landPic,ctxPic,...pics]=await Promise.all([load('cal/coast.png'),load('cal/terrain16.png'),load('cal/land.jpg'),load('cal/context.png'),
  ...CAL.map(e=>load(`cal/clear/${e.date}.jpg`)),...CAL.map(e=>load(`cal/chlc/${e.date}.png`)),...CAL.map(e=>load(`cal/cur/${e.date}.png`))]);
const clears=pics.slice(0,CAL.length),chls=pics.slice(CAL.length,2*CAL.length),curs=pics.slice(2*CAL.length);
const oc=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const pixels=im=>{const c=oc(im.naturalWidth,im.naturalHeight),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);return x.getImageData(0,0,c.width,c.height).data};
// land heights, for the readout and the scale: metres × 8 = red × 256 + green (the sea is 0)
const TW=terr.naturalWidth,TH=terr.naturalHeight,TER=new Float32Array(TW*TH);let TERMAX=0;
{const d=pixels(terr);for(let i=0;i<TW*TH;i++){TER[i]=(d[i*4]*256+d[i*4+1])/8;TERMAX=Math.max(TERMAX,TER[i])}}
// observed chlorophyll, one grid per date: grey 1–255 is log10(mg/m³) from −2 to log10(20); 0 = never seen
const CW=chls[0].naturalWidth,CH=chls[0].naturalHeight,CHL=chls.map(im=>{const d=pixels(im),o=new Uint8Array(CW*CH);for(let i=0;i<o.length;i++)o[i]=d[i*4];return o});
// measured surface currents, one grid per date, in km a day (east, north); 0 where the sea surface was not measured.
// They come from the slope of the sea surface seen by satellite altimeters: water circles a rise or a dip in the surface.
const UW=curs[0].naturalWidth,UH=curs[0].naturalHeight,CUR={w:UW,h:UH,n:CAL.map(e=>e.n),u:[],v:[]};
for(const im of curs){const d=pixels(im),u=new Float32Array(UW*UH),v=new Float32Array(UW*UH);for(let i=0;i<UW*UH;i++)if(d[i*4+3]){u[i]=(d[i*4]-128)*.005*86.4;v[i]=(d[i*4+1]-128)*.005*86.4}CUR.u.push(u);CUR.v.push(v)}
const chlMg=g=>Math.pow(10,-2+(g-1)/254*(Math.log10(20)+2));
const COL={cur:'#cfe6ff',chl:'#57e06a',map:'#6bb6ff',plankton:'#22e3c7',iron:'#ff5ca8',ship:'#ffffff',sea:'#0b2238',land:'#6f7a52'};
// time takes one hue per month
const monthRGB=m=>{const h=((m+7)%12)/12,s=.8,v=.92,i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);const [r,g,b]=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];return `rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`};
const monthOf=n=>new Date(EPOCH+Math.round(n)*86400000).getUTCMonth()+1;

// ---------- the sea (seeded; keyframes every half day) ----------
const OLD_MASSETT=[-132.18,54.04],VICTORIA=[-123.37,48.42];
const ENVELOPE=[[-142.2,51.6],[-137.2,51.6],[-137.2,54.4],[-142.2,54.4]];
const EDDIES=[{c:[-139,52.9],r:90,sign:1},{c:[-134.6,53.9],r:70,sign:1},{c:[-140.2,54.6],r:80,sign:-1}];
// out through the Strait of Juan de Fuca, a zigzag inside the eddy (legs 2 to 6, where the iron goes in), and home
const LEGS=[[-124.9,48.45],[-138.76,53.05],[-139.6,52.6],[-138.1,52.5],[-138.3,53.5],[-139.7,53.3],[-138.76,53.05],[-124.9,48.45],[-123.37,48.42]];
const P={iron:120,eddy:.6,graze:.5,wind:.5};
const SET={speed:2,drift:false,posts:true,terrain:true,vex:5,bloom:1,follow:true,chl:true,chlA:.9,chlH:1,cur:true,curSpeed:6,media:true};
const NP=8000,NI=700,NC=2200;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const cellOf=(x,y)=>[clamp((x/CS)|0,0,GW-1),clamp((y/CS)|0,0,GH-1)];
function blur(a){const b=new Float32Array(a.length);for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){let s=0,n=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const xx=x+i,yy=y+j;if(xx>=0&&yy>=0&&xx<GW&&yy<GH){s+=a[yy*GW+xx];n++}}b[y*GW+x]=s/n}return b}
let frames=[],track=[],simRun=0,worker=null;
// the sea runs in a worker so the picture never stalls; it posts keyframes as it goes
function simWorker(){let C,P;const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  onmessage=e=>{C=e.data.C;P=e.data.P;run()};
  function run(){const {FW,FH,GW,GH,CS,NP,NI,NC,KM_LAT,KM_LON,LON0,LON1,LAT0,LAT1,DAY0,DAY1,KF,DT,HOME,LEGS,CUR}=C;
    const fx=lon=>(lon-LON0)/(LON1-LON0)*FW,fy=lat=>(LAT1-lat)/(LAT1-LAT0)*FH,cellOf=(x,y)=>[clamp((x/CS)|0,0,GW-1),clamp((y/CS)|0,0,GH-1)];
    const blur=a=>{const b=new Float32Array(a.length);for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){let s=0,n=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const xx=x+i,yy=y+j;if(xx>=0&&yy>=0&&xx<GW&&yy<GH){s+=a[yy*GW+xx];n++}}b[y*GW+x]=s/n}return b};
    const R=mulberry32(7);let day=DAY0,steps=0;const ship={lon:HOME[0],lat:HOME[1],leg:0,acc:0};const track=[];
    const iron=new Float32Array(NI*3).fill(NaN),plank=new Float32Array(NP*2).fill(NaN);
    const freeI=[],freeP=[];for(let i=NI-1;i>=0;i--)freeI.push(i);for(let i=NP-1;i>=0;i--)freeP.push(i);
    const cloud=new Float32Array(NC*4);for(let i=0;i<NC;i++){cloud[i*4]=R()*FW;cloud[i*4+1]=R()*FH;cloud[i*4+2]=5+R()*9;cloud[i*4+3]=R()*6.283}
    const wake=new Float32Array(GW*GH).fill(-1e9);let exported=0,respired=0,area=0,peak=0;
    // the water moves as the altimeters measured it: the current at a place and a day, in km a day, scaled by the strength setting
    const flow=(lon,lat)=>{const gx=(lon-LON0)/(LON1-LON0)*CUR.w-.5,gy=(LAT1-lat)/(LAT1-LAT0)*CUR.h-.5;if(gx<0||gy<0||gx>CUR.w-1||gy>CUR.h-1)return [0,0];
      let k=0;while(k<CUR.n.length-2&&CUR.n[k+1]<=day)k++;const t=clamp((day-CUR.n[k])/(CUR.n[k+1]-CUR.n[k]),0,1),ix=Math.min(gx|0,CUR.w-2),iy=Math.min(gy|0,CUR.h-2),a=gx-ix,b=gy-iy,i=iy*CUR.w+ix,s=P.eddy/.6,
        f=A=>(A[i]*(1-a)+A[i+1]*a)*(1-b)+(A[i+CUR.w]*(1-a)+A[i+CUR.w+1]*a)*b;
      return [(f(CUR.u[k])*(1-t)+f(CUR.u[k+1])*t)*s,(f(CUR.v[k])*(1-t)+f(CUR.v[k+1])*t)*s]};
    const advect=(arr,i,st,dt)=>{const lon=arr[i*st],lat=arr[i*st+1];const [u,v]=flow(lon,lat);arr[i*st]=lon+u*dt/KM_LON+(R()-.5)*.22*dt;arr[i*st+1]=lat+v*dt/KM_LAT+(R()-.5)*.14*dt};
    function stepShip(dt){const tgt=ship.leg<LEGS.length?LEGS[ship.leg]:null;if(!tgt)return;
      const dx=(tgt[0]-ship.lon)*KM_LON,dy=(tgt[1]-ship.lat)*KM_LAT,d=Math.hypot(dx,dy);const sp=(ship.leg>=2&&ship.leg<=6)?16:300;
      if(d<2){ship.leg++;return}const mv=Math.min(d,sp*dt);ship.lon+=dx/d*mv/KM_LON;ship.lat+=dy/d*mv/KM_LAT;
      if(ship.leg>=2&&ship.leg<=6){ship.acc+=(P.iron/.25/28)*dt;const n=Math.floor(ship.acc);ship.acc-=n;for(let i=0;i<n&&freeI.length;i++){const s=freeI.pop();iron[s*3]=ship.lon+(R()-.5)*.06;iron[s*3+1]=ship.lat+(R()-.5)*.03;iron[s*3+2]=0}}
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
  worker.postMessage({P:{...P},C:{FW,FH,GW,GH,CS,NP,NI,NC,KM_LAT,KM_LON,LON0,LON1,LAT0,LAT1,DAY0,DAY1,KF,DT,HOME:VICTORIA,LEGS,CUR}})}
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

// ---------- heights ----------
const KMPX=FW/(LON1-LON0)/KM_LON,FT=3.28084;                    // frame units per km; feet per metre
const m2z=()=>SET.terrain?KMPX*SET.vex/1000:0;                  // frame units per metre of height, exaggerated
const STEM=46,SLAB=26,CHLZ=6;                                  // a full-density plankton stem; the block's thickness; the chlorophyll relief at its highest
// one weight, −2 % tracking, everywhere (DESIGN LANGUAGE §1)
function font(ctx,px){ctx.font=`400 ${px}px "ABC Diatype","Helvetica Neue",Helvetica,Arial,sans-serif`;ctx.letterSpacing=(-.02*px).toFixed(2)+'px'}
const pxf=(lon,lat)=>[fx(lon),fy(lat)];
function halo(c,t,x,y,col){c.lineJoin='round';c.lineWidth=3;c.strokeStyle='#000';c.strokeText(t,x,y);c.fillStyle=col;c.fillText(t,x,y)}
// simulated plankton density at a point of the frame, from the sea's coarse grid
function dens(x,y){const gx=clamp(x/CS-.5,0,GW-1.001),gy=clamp(y/CS-.5,0,GH-1.001),ix=gx|0,iy=gy|0,u=gx-ix,v=gy-iy,i=iy*GW+ix;return lerp(lerp(S.fP[i],S.fP[i+1],u),lerp(S.fP[i+GW],S.fP[i+GW+1],u),v)}
// the sea picture and the chlorophyll at a day: a fade between the two composites either side of it
const mix={a:0,b:0,t:0};let chlOn=0;
function mixAt(d){let i=0;while(i<CAL.length-1&&CAL[i+1].n<=d)i++;if(d<=CAL[0].n||i===CAL.length-1){mix.a=mix.b=d<=CAL[0].n?0:i;mix.t=0;return}const u=(d-CAL[i].n)/(CAL[i+1].n-CAL[i].n);mix.a=i;mix.b=i+1;mix.t=u*u*(3-2*u)}
// observed chlorophyll at a point of the frame: the stored grey (0 = never seen), and the same 0–1 scale the model draws
function chlAt(x,y){if(x<0||y<0||x>=FW||y>=FH)return 0;const i=((y/FH*CH)|0)*CW+((x/FW*CW)|0),a=CHL[mix.a][i],b=CHL[mix.b][i];return !a?b:!b?a:lerp(a,b,mix.t)}
const chlQ=(x,y)=>clamp((chlAt(x,y)-110)/90,0,1);

// measured current at a point of the frame, km a day (east, north), faded between the two dates either side of the clock
function curAt(x,y){const gx=x/FW*UW-.5,gy=y/FH*UH-.5;if(gx<0||gy<0||gx>UW-1||gy>UH-1)return [0,0];
  const ix=Math.min(gx|0,UW-2),iy=Math.min(gy|0,UH-2),u=gx-ix,v=gy-iy,i=iy*UW+ix,
    f=A=>lerp(lerp(A[i],A[i+1],u),lerp(A[i+UW],A[i+UW+1],u),v);
  return [lerp(f(CUR.u[mix.a]),f(CUR.u[mix.b]),mix.t),lerp(f(CUR.v[mix.a]),f(CUR.v[mix.b]),mix.t)]}
// streaks: specks dropped on the sea and carried by the measured current, each leaving a short fading tail
const NT=2400,TK=9,trX=new Float32Array(NT*TK),trY=new Float32Array(NT*TK),trAge=new Float32Array(NT),trLife=new Float32Array(NT),trSp=new Float32Array(NT),streak=new Float32Array(NT*(TK-1)*8);
const KMY=FH/((LAT1-LAT0)*KM_LAT);                              // frame units per km, north-south
function seed(i){const x=Math.random()*FW,y=Math.random()*FH;for(let k=0;k<TK;k++){trX[i*TK+k]=x;trY[i*TK+k]=y}trAge[i]=0;trLife[i]=2.5+Math.random()*4}
for(let i=0;i<NT;i++){seed(i);trAge[i]=Math.random()*trLife[i]}
function stepStreaks(dt){const d=dt*SET.curSpeed;for(let i=0;i<NT;i++){const o=i*TK;trAge[i]+=dt;const x=trX[o],y=trY[o],[u,v]=curAt(x,y),sp=Math.hypot(u,v);
    if(trAge[i]>trLife[i]||sp<.3||x<0||y<0||x>=FW||y>=FH){seed(i);trSp[i]=0;continue}
    for(let k=TK-1;k>0;k--){trX[o+k]=trX[o+k-1];trY[o+k]=trY[o+k-1]}trX[o]=x+u*KMPX*d;trY[o]=y-v*KMY*d;trSp[i]=sp}}

// ---------- drawn on the surface: coast and marks once; then the ship's track and the iron each frame ----------
const TICKS=[],PLACES=[];                                       // text is never drawn into the model: it is listed here and set flat to the screen
const mapc=oc(FW,FH),ovc=oc(FW,FH),ovx=ovc.getContext('2d');
{const ctx=mapc.getContext('2d');ctx.drawImage(coast,0,0);ctx.globalCompositeOperation='source-in';ctx.fillStyle=COL.map;ctx.fillRect(0,0,FW,FH);ctx.globalCompositeOperation='source-over';
 ctx.strokeStyle='#fff';ctx.fillStyle='#fff';ctx.globalAlpha=.85;ctx.setLineDash([6,6]);ctx.lineWidth=1.6;ctx.beginPath();ENVELOPE.forEach((c,i)=>{const [x,y]=pxf(...c);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.stroke();
 PLACES.push({x:fx((ENVELOPE[0][0]+ENVELOPE[1][0])/2),y:fy(ENVELOPE[2][1]),t:'Reported bloom, 2012'});
 PLACES.push({x:fx(EDDIES[0].c[0]),y:fy(EDDIES[0].c[1]),t:'Haida eddy'});
 ctx.setLineDash([]);ctx.globalAlpha=1;{const [x,y]=pxf(...OLD_MASSETT);ctx.beginPath();ctx.arc(x,y,5,0,6.2832);ctx.fill();PLACES.push({x,y,t:'Old Massett'})}
 PLACES.push({x:fx(VICTORIA[0]),y:fy(VICTORIA[1]),z:-SLAB,t:'Victoria'});
 // scale bar in miles (imperial readouts)
 {const L=100*KMPX*1.609344,x0=FW-40-L,y0=30;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x0+L,y0);ctx.moveTo(x0,y0-6);ctx.lineTo(x0,y0+6);ctx.moveTo(x0+L,y0-6);ctx.lineTo(x0+L,y0+6);ctx.stroke();TICKS.push({x:x0+L/2,y:y0,t:'100 mi',align:'center',dy:-8})}}
function drawOverlay(){ovx.clearRect(0,0,FW,FH);ovx.drawImage(mapc,0,0);
  ovx.strokeStyle=COL.iron;if(S.trackN>1){ovx.lineWidth=2;ovx.beginPath();for(let i=0;i<S.trackN;i++){const [x,y]=pxf(...track[i]);i?ovx.lineTo(x,y):ovx.moveTo(x,y)}ovx.stroke()}
  ovx.lineWidth=1.4;for(let i=0;i<NI;i++){const x=S.iron[i*2];if(isNaN(x))continue;ovx.beginPath();ovx.arc(fx(x),fy(S.iron[i*2+1]),3,0,6.2832);ovx.stroke()}}
// the wider region, named only when you pull back far enough to see it
const REGION=[['Alaska',-152,64],['Yukon',-136,63.3],['British Columbia',-124.5,55.6],['Gulf of Alaska',-148,56.8],['Pacific Ocean',-150,41.5],['Haida Gwaii',-132.3,53.3],['Vancouver Island',-126.4,49.6],['Washington',-120.5,47.3],['Oregon',-120.5,44]];

// ---------- the model (WebGL 2): a block of land and sea on a map of the region; plankton as stems ----------
const g=$('#g'),gl=g.getContext('webgl2',{antialias:true,alpha:false});
if(!gl)throw new Error('This page needs WebGL 2, which this browser does not offer.');
function program(vs,fs){const p=gl.createProgram();for(const [t,s] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));gl.attachShader(p,sh)}
  gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));const u={};for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){const n=gl.getActiveUniform(p,i).name;u[n]=gl.getUniformLocation(p,n)}return {p,u}}
// the camera, the same in every shader and in proj() below: a point becomes right / up / forward distances from the eye
const CAMGLSL=`uniform vec3 uEye,uR,uU,uF;uniform vec4 uProj;uniform float uOx;
vec4 project(vec3 p){vec3 d=p-uEye;float zv=dot(d,uF);return vec4(dot(d,uR)*uProj.x+uOx*zv,dot(d,uU)*uProj.y,zv*uProj.z+uProj.w,zv);}`;
// land height in metres; observed chlorophyll on the model's 0–1 scale (about 0.3 to 4 mg/m³), faded between two dates
const DATAGLSL=`uniform sampler2D uH;uniform sampler2DArray uChl;uniform vec3 uMix;
float hm(vec2 uv){vec4 t=texture(uH,uv);return (t.r*65280.+t.g*255.)/8.;}
float cg(vec2 uv){float a=texture(uChl,vec3(uv,uMix.x)).r,b=texture(uChl,vec3(uv,uMix.y)).r;return a<.002?b:b<.002?a:mix(a,b,uMix.z);}
float cq(vec2 uv){return clamp((cg(uv)*255.-110.)/90.,0.,1.);}`;
// lines of latitude and longitude, drawn where they fall, one pixel wide at any zoom
const GRIDGLSL=`uniform float uStep;float grid(vec2 ll){vec2 gr=ll/uStep,d=abs(fract(gr-.5)-.5)/fwidth(gr);return 1.-min(min(d.x,d.y),1.);}`;
const surf=program(`#version 300 es
precision highp float;precision highp sampler2DArray;
layout(location=0) in vec2 aUV;layout(location=1) in float aK;uniform float uM2Z,uChlZ;${DATAGLSL}${CAMGLSL}
out vec2 vUV;out float vK;
void main(){vUV=aUV;vK=aK;float h=hm(aUV),z=h*uM2Z;
 // the sea rises a little where chlorophyll is high, and settles to zero against the shore (the blue channel says how open the water is)
 if(h<.5&&uChlZ>0.){vec2 e=vec2(.0014,.0028);float open=texture(uH,aUV).b;
  z=uChlZ*open*(cq(aUV)*2.+cq(aUV+vec2(e.x,0.))+cq(aUV-vec2(e.x,0.))+cq(aUV+vec2(0.,e.y))+cq(aUV-vec2(0.,e.y)))/6.;}
 gl_Position=project(vec3(aUV.x*${FW}.,aUV.y*${FH}.,aK>.75?-${SLAB}.:z));}`,
`#version 300 es
precision highp float;precision highp sampler2DArray;
uniform sampler2DArray uClear;uniform sampler2D uOv,uLand;uniform vec2 uTexel;uniform float uShade,uChlA,uChlZ;${DATAGLSL}${GRIDGLSL}
in vec2 vUV;in float vK;out vec4 o;
void main(){if(vK>.25){o=vec4(vec3(.085-.03*vK),1.);return;}
 float h=hm(vUV);vec3 c;vec3 L=normalize(vec3(-.55,-.55,.63));
 if(h>2.){
  // the land: a sharp late-summer picture, shaded from the shape of the ground, lit from the north-west
  vec3 lc=texture(uLand,vUV).rgb;vec2 w=vec2(${FW}.,${FH}.)*uTexel;
  vec3 n=normalize(vec3((hm(vUV-vec2(uTexel.x,0.))-hm(vUV+vec2(uTexel.x,0.)))*.016/(2.*w.x),(hm(vUV-vec2(0.,uTexel.y))-hm(vUV+vec2(0.,uTexel.y)))*.016/(2.*w.y),1.));
  c=mix(lc*1.3,lc*(.38+1.55*max(dot(n,L),0.)),uShade);
 }else{
  // the sea: the cloud-cleared picture with what cloud and haze remain pressed down to dark water
  vec3 pic=mix(texture(uClear,vec3(vUV,uMix.x)).rgb,texture(uClear,vec3(vUV,uMix.y)).rgb,uMix.z);
  c=mix(pic*1.25,vec3(.02,.055,.095),smoothstep(.09,.26,(pic.r+pic.g+pic.b)/3.));
  // measured chlorophyll: nothing below about 0.3 mg/m³, deep green rising to yellow-green at about 4; shaded as the low relief it is drawn in
  if(uChlA>0.){float q=cq(vUV);vec2 e=vec2(1.5/900.,1.5/450.);
   vec3 n2=normalize(vec3((cq(vUV-vec2(e.x,0.))-cq(vUV+vec2(e.x,0.)))*uChlZ/(2.*e.x*${FW}.),(cq(vUV-vec2(0.,e.y))-cq(vUV+vec2(0.,e.y)))*uChlZ/(2.*e.y*${FH}.),.35));
   vec3 ramp=mix(vec3(.02,.2,.16),mix(vec3(.2,.85,.35),vec3(.95,1.,.45),smoothstep(.7,1.,q)),smoothstep(0.,.75,q));
   c=mix(c,ramp*(.55+.6*max(dot(n2,L),0.)),uChlA*step(.002,cg(vUV))*(.4+.6*q));}
 }
 c=mix(c,vec3(1.),grid(vec2(${LON0}.+vUV.x*${LON1-LON0}.,${LAT1}.-vUV.y*${LAT1-LAT0}.))*.26);
 vec4 ov=texture(uOv,vUV);o=vec4(c*(1.-ov.a)+ov.rgb,1.);}`);
const ctxp=program(`#version 300 es
precision highp float;
layout(location=0) in vec2 aP;${CAMGLSL}
out vec2 vLL;
void main(){vLL=vec2(${LON0}.+aP.x/${FW}.*${LON1-LON0}.,${LAT1}.-aP.y/${FH}.*${LAT1-LAT0}.);gl_Position=project(vec3(aP,-${SLAB}.));}`,
`#version 300 es
precision highp float;
uniform sampler2D uCtx;${GRIDGLSL}
in vec2 vLL;out vec4 o;
void main(){vec2 uv=vec2((vLL.x-(${A0}.))/${A1-A0}.,(${B1}.-vLL.y)/${B1-B0}.);vec3 c=texture(uCtx,uv).rgb;
 c=mix(c,vec3(1.),grid(vLL)*.16);vec2 f=smoothstep(0.,.08,uv)*smoothstep(0.,.08,1.-uv);o=vec4(c*f.x*f.y,1.);}`);
const part=program(`#version 300 es
precision highp float;
layout(location=0) in vec4 aP;uniform float uPt;${CAMGLSL}
out float vA;
void main(){vA=aP.w;gl_Position=project(aP.xyz);gl_PointSize=clamp(uPt/gl_Position.w,2.,60.);}`,
`#version 300 es
precision highp float;
uniform vec3 uCol;uniform float uRound;in float vA;out vec4 o;
void main(){if(uRound>.5){vec2 q=gl_PointCoord-.5;if(dot(q,q)>.25)discard;}o=vec4(uCol*vA,vA);}`);
// textures: 0 = cloud-cleared sea pictures, 1 = land height, 2 = what is drawn on the surface, 3 = observed chlorophyll, 4 = the land picture, 5 = the region
gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
const P2=[[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]];
function stack(unit,fmt,src,list){const w=list[0].naturalWidth,h=list[0].naturalHeight;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D_ARRAY,gl.createTexture());gl.texStorage3D(gl.TEXTURE_2D_ARRAY,1,fmt,w,h,list.length);
  list.forEach((im,i)=>gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,i,w,h,1,src,gl.UNSIGNED_BYTE,im));for(const [k,v] of P2)gl.texParameteri(gl.TEXTURE_2D_ARRAY,k,v)}
function flat(unit,fill,mips){const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);fill();for(const [k,v] of P2)gl.texParameteri(gl.TEXTURE_2D,k,v);
  if(mips){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR)}return t}
stack(0,gl.RGBA8,gl.RGBA,clears);stack(3,gl.R8,gl.RED,chls);
flat(1,()=>gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,terr));
const ovTex=flat(2,()=>gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,FW,FH,0,gl.RGBA,gl.UNSIGNED_BYTE,null));
flat(4,()=>gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,landPic),true);
flat(5,()=>gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,ctxPic),true);
// the block: a fine grid for the top (aK 0), and a wall down each edge (aK .5 at the surface, 1 at the base)
{const NX=1000,NY=500,v=new Float32Array(((NX+1)*(NY+1)+4*(NX+NY+2))*3),ix=new Uint32Array(6*NX*NY+12*(NX+NY));let nv=0,ni=0;
 for(let j=0;j<=NY;j++)for(let i=0;i<=NX;i++){v[nv*3]=i/NX;v[nv*3+1]=j/NY;nv++}
 for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){const a=j*(NX+1)+i,b=a+1,c=a+NX+1,d=c+1;ix.set([a,b,c,b,d,c],ni);ni+=6}
 const wall=(n,uv)=>{const s=nv;for(let i=0;i<=n;i++){const [x,y]=uv(i/n);v.set([x,y,.5,x,y,1],nv*3);nv+=2}for(let i=0;i<n;i++){const a=s+i*2;ix.set([a,a+1,a+2,a+1,a+3,a+2],ni);ni+=6}};
 wall(NX,t=>[t,0]);wall(NX,t=>[t,1]);wall(NY,t=>[0,t]);wall(NY,t=>[1,t]);
 surf.vao=gl.createVertexArray();gl.bindVertexArray(surf.vao);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);
 gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,12,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.FLOAT,false,12,8);
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,ix,gl.STATIC_DRAW);surf.n=ni}
ctxp.vao=gl.createVertexArray();gl.bindVertexArray(ctxp.vao);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
{const x0=fx(A0),x1=fx(A1),y0=fy(B1),y1=fy(B0);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([x0,y0,x1,y0,x0,y1,x1,y1]),gl.STATIC_DRAW)}gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
part.vao=gl.createVertexArray();gl.bindVertexArray(part.vao);part.buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,part.buf);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,4,gl.FLOAT,false,16,0);gl.bindVertexArray(null);
gl.useProgram(surf.p);gl.uniform1i(surf.u.uClear,0);gl.uniform1i(surf.u.uH,1);gl.uniform1i(surf.u.uOv,2);gl.uniform1i(surf.u.uChl,3);gl.uniform1i(surf.u.uLand,4);gl.uniform2f(surf.u.uTexel,1/TW,1/TH);
gl.useProgram(ctxp.p);gl.uniform1i(ctxp.u.uCtx,5);
gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
const stems=new Float32Array(NP*4),tops=new Float32Array((NP/2+2)*4),pole=new Float32Array(8);

// ---------- camera: a perspective view that orbits a point on the ground ----------
const canvas=$('#c'),ctx=canvas.getContext('2d');let W=1,H=1,DPR=1,OX=0;   // OX: how far the view's centre sits left of the stage's, in pixels, to clear the column on the right
const FL=1/Math.tan(32*Math.PI/360);                            // a 32° lens
const cam={tx:FW/2,ty:FH/2,az:.5,el:1.0,dist:2600};             // az: where the eye stands (0 = south of the target); el: 0 looks straight down, a quarter turn looks level
function basis(c){const sa=Math.sin(c.az),ca=Math.cos(c.az),se=Math.sin(c.el),ce=Math.cos(c.el);
  return {eye:[c.tx+c.dist*se*sa,c.ty+c.dist*se*ca,c.dist*ce],r:[ca,-sa,0],u:[-ce*sa,-ce*ca,se],f:[-se*sa,-se*ca,-ce],near:c.dist*.04,far:c.dist*4+9000}}
let B=basis(cam),dirty=true,ovKey='';
function proj(x,y,z){const dx=x-B.eye[0],dy=y-B.eye[1],dz=z-B.eye[2],zv=dx*B.f[0]+dy*B.f[1]+dz*B.f[2];if(zv<B.near)return null;
  return [W/2*(1+(dx*B.r[0]+dy*B.r[1])*FL*H/W/zv)-OX,H/2*(1-(dx*B.u[0]+dy*B.u[1]+dz*B.u[2])*FL/zv)]}
// where a point of the screen meets sea level
function unproj(sx,sy){const nx=((sx+OX)/W*2-1)*W/H/FL,ny=(1-sy/H*2)/FL,d=[B.r[0]*nx+B.u[0]*ny+B.f[0],B.r[1]*nx+B.u[1]*ny+B.f[1],B.u[2]*ny+B.f[2]];if(d[2]>-1e-4)return null;const t=-B.eye[2]/d[2];return [B.eye[0]+d[0]*t,B.eye[1]+d[1]*t]}
const fitDist=()=>{const t=1/FL,small=W<700;return Math.max(FW/(2*t*((W-2*OX)/H)*(small?.92:.74)),FH/(2*t*.62))};
function fit(){cam.tx=FW/2;cam.ty=FH/2;cam.dist=fitDist()}
// labels are drawn at the screen's full sharpness; the model is drawn with at most about three million pixels, which is where it stops looking sharper
function resize(){const r=$('#stage').getBoundingClientRect();DPR=Math.min(2,devicePixelRatio||1);W=Math.max(1,r.width);H=Math.max(1,r.height);OX=W>900?$('#side').offsetWidth/2+10:0;
  canvas.width=W*DPR;canvas.height=H*DPR;const q=Math.min(DPR,Math.sqrt(3.2e6/(W*H)));g.width=Math.round(W*q);g.height=Math.round(H*q);dirty=true}
// the spacing of the grid, in degrees, so its lines stay a readable distance apart at any zoom
const gridStep=()=>{const deg=110*2*cam.dist/FL/H/(FW/(LON1-LON0));return [1,2,5,10,20].find(s=>s>=deg)||20};
function renderGL(ts){B=basis(cam);gl.viewport(0,0,g.width,g.height);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const A=(B.far+B.near)/(B.far-B.near),Bz=-2*B.far*B.near/(B.far-B.near),step=gridStep();
  const setCam=p=>{gl.uniform3fv(p.u.uEye,B.eye);gl.uniform3fv(p.u.uR,B.r);gl.uniform3fv(p.u.uU,B.u);gl.uniform3fv(p.u.uF,B.f);gl.uniform4f(p.u.uProj,FL*H/W,FL,A,Bz);gl.uniform1f(p.u.uOx,-2*OX/W)};
  gl.disable(gl.BLEND);gl.depthMask(true);
  // the region the block sits on
  gl.useProgram(ctxp.p);setCam(ctxp);gl.uniform1f(ctxp.u.uStep,step);gl.bindVertexArray(ctxp.vao);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  // the block
  chlOn+=((SET.chl?1:0)-chlOn)*.1;const chlZ=CHLZ*SET.chlH*chlOn;
  gl.useProgram(surf.p);setCam(surf);gl.uniform1f(surf.u.uM2Z,m2z());gl.uniform3f(surf.u.uMix,mix.a,mix.b,mix.t);gl.uniform1f(surf.u.uShade,SET.terrain?1:0);
  gl.uniform1f(surf.u.uChlA,SET.chlA*chlOn);gl.uniform1f(surf.u.uChlZ,chlZ);gl.uniform1f(surf.u.uStep,step);
  {const k=day.toFixed(2)+'|'+frames.length+'|'+S.trackN;if(k!==ovKey){ovKey=k;drawOverlay();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,ovTex);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,ovc);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false)}}
  gl.bindVertexArray(surf.vao);gl.drawElements(gl.TRIANGLES,surf.n,gl.UNSIGNED_INT,0);
  // plankton: a stem per particle, standing as tall as the bloom is dense there, swaying a little; a dot on top
  let nl=0,np=0;const t=reduced||!running?0:ts/1000,hmax=STEM*SET.bloom;
  for(let i=0;i<NP;i+=2){const lon=S.plank[i*2];if(isNaN(lon))continue;const a=S.pa[i];if(a<=0)continue;const x=fx(lon),y=fy(S.plank[i*2+1]),z0=chlQ(x,y)*chlZ,z=z0+(.12+.88*dens(x,y))*hmax*a*(.88+.12*Math.sin(t*1.7+i));
    let o=nl*4;stems[o]=x;stems[o+1]=y;stems[o+2]=z0;stems[o+3]=.28*a;stems[o+4]=x;stems[o+5]=y;stems[o+6]=z;stems[o+7]=.5*a;nl+=2;o=np*4;tops[o]=x;tops[o+1]=y;tops[o+2]=z;tops[o+3]=.95*a;np++}
  gl.useProgram(part.p);setCam(part);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.bindVertexArray(part.vao);gl.bindBuffer(gl.ARRAY_BUFFER,part.buf);
  // the measured currents: each speck's tail, brighter where the water moves faster
  if(SET.cur){let n=0;for(let i=0;i<NT;i++){const sp=trSp[i];if(sp<=0)continue;const o=i*TK,fade=Math.min(1,trAge[i]*2,(trLife[i]-trAge[i])*2)*clamp(sp/14,.15,1)*.75,z=chlQ(trX[o],trY[o])*chlZ+1;
      for(let k=0;k<TK-1;k++){const a0=fade*(1-k/(TK-1)),a1=fade*(1-(k+1)/(TK-1)),q=n*4;streak[q]=trX[o+k];streak[q+1]=trY[o+k];streak[q+2]=z;streak[q+3]=a0;streak[q+4]=trX[o+k+1];streak[q+5]=trY[o+k+1];streak[q+6]=z;streak[q+7]=a1;n+=2}}
    gl.uniform3f(part.u.uCol,.81,.9,1);gl.uniform1f(part.u.uRound,0);gl.bufferData(gl.ARRAY_BUFFER,streak.subarray(0,n*4),gl.DYNAMIC_DRAW);gl.drawArrays(gl.LINES,0,n)}
  gl.uniform1f(part.u.uPt,5*FL*g.height/2);gl.uniform3f(part.u.uCol,.13,.89,.78);
  gl.bufferData(gl.ARRAY_BUFFER,stems.subarray(0,nl*4),gl.DYNAMIC_DRAW);gl.uniform1f(part.u.uRound,0);gl.drawArrays(gl.LINES,0,nl);
  gl.bufferData(gl.ARRAY_BUFFER,tops.subarray(0,np*4),gl.DYNAMIC_DRAW);gl.uniform1f(part.u.uRound,1);gl.drawArrays(gl.POINTS,0,np);
  // the ship: a white mast with a dot, so it can be found from anywhere
  {const x=fx(S.ship[0]),y=fy(S.ship[1]),z0=x>=0&&y>=0&&x<FW&&y<FH?chlQ(x,y)*chlZ:-SLAB;pole.set([x,y,z0,1,x,y,z0+34,1]);gl.uniform3f(part.u.uCol,1,1,1);gl.bufferData(gl.ARRAY_BUFFER,pole,gl.DYNAMIC_DRAW);gl.uniform1f(part.u.uRound,0);gl.drawArrays(gl.LINES,0,2);
   gl.uniform1f(part.u.uPt,9*FL*g.height/2);gl.uniform1f(part.u.uRound,1);gl.drawArrays(gl.POINTS,1,1)}
  gl.depthMask(true);gl.bindVertexArray(null)}
// the coordinates ride the bottom and right edges of the screen: each grid line is named where it runs off the view
function edgeCoords(c){const step=gridStep(),yb=H-12,xr=W-10,bottom=[],right=[];
  const run=(pts,t)=>{let prev=null;for(const q of pts){const p=proj(q[0],q[1],-SLAB*0);if(p&&prev){
      if((prev[1]-yb)*(p[1]-yb)<0){const x=prev[0]+(p[0]-prev[0])*(yb-prev[1])/(p[1]-prev[1]);if(x>30&&x<W-40){bottom.push([x,t]);return}}
      if((prev[0]-xr)*(p[0]-xr)<0){const y=prev[1]+(p[1]-prev[1])*(xr-prev[0])/(p[0]-prev[0]);if(y>50&&y<H-24){right.push([y,t]);return}}}prev=p}};
  for(let lon=Math.ceil(A0/step)*step;lon<=A1;lon+=step){const pts=[];for(let k=0;k<=28;k++)pts.push([fx(lon),fy(B0+(B1-B0)*k/28)]);run(pts,Math.abs(lon)+'° W')}
  for(let lat=Math.ceil(B0/step)*step;lat<=B1;lat+=step){const pts=[];for(let k=0;k<=28;k++)pts.push([fx(A0+(A1-A0)*k/28),fy(lat)]);run(pts,lat+'° N')}
  font(c,8);c.fillStyle='#fff';c.globalAlpha=.9;c.textAlign='center';let lastX=-99;for(const [x,t] of bottom.sort((a,b)=>a[0]-b[0])){if(x-lastX<36)continue;lastX=x;c.fillText(t,x,H-5)}
  c.textAlign='right';let lastY=-99;for(const [y,t] of right.sort((a,b)=>a[0]-b[0])){if(y-lastY<13)continue;lastY=y;c.fillText(t,W-6,y+3)}c.globalAlpha=1}
// flat to the screen, over the model: the coordinates, a height scale, the region's names when far out, and (only while the story runs) the place names
let labelA=0,lastRun=-1e9;
function render2D(c,dpr,ts){c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);c.textBaseline='alphabetic';
  edgeCoords(c);
  font(c,8);for(const k of TICKS){const p=proj(k.x,k.y,0);if(!p)continue;c.textAlign=k.align;halo(c,k.t,p[0]+(k.dx||0),p[1]+(k.dy||0),'#fff')}
  const far=clamp((cam.dist/fitDist()-1.5)/.6,0,1);
  if(far>.01){font(c,10);c.textAlign='center';c.globalAlpha=far;for(const [t,lon,lat] of REGION){const p=proj(fx(lon),fy(lat),-SLAB);if(p)halo(c,t,p[0],p[1],'#fff')}c.globalAlpha=1}
  if(SET.posts&&SET.terrain&&cam.el>.25&&far<.5){const cs=[[0,0],[FW,0],[FW,FH],[0,FH]].map(([x,y])=>({x,y,p:proj(x,y,0)})).filter(k=>k.p);
    if(cs.length){const L=cs.reduce((a,b)=>b.p[0]<a.p[0]?b:a),top=proj(L.x,L.y,TERMAX*m2z());
      if(top){c.strokeStyle='rgba(255,255,255,.6)';c.lineWidth=.8;c.beginPath();c.moveTo(...L.p);c.lineTo(...top);c.stroke();c.textAlign='right';font(c,8);
        for(let ft=0;ft<=TERMAX*FT;ft+=2500){const p=proj(L.x,L.y,ft/FT*m2z());if(!p)continue;c.beginPath();c.moveTo(p[0]-5,p[1]);c.lineTo(p[0],p[1]);c.stroke();halo(c,ft?ft.toLocaleString('en-US')+' ft':'sea level',p[0]-8,p[1]+3,'#fff')}}}}
  labelA=running?1:clamp(1-(ts-lastRun-2500)/700,0,1);if(labelA<=.01)return;
  const items=[...PLACES,{x:fx(S.ship[0]),y:fy(S.ship[1]),z:34,t:day<0?'Ocean Pearl, in port':S.ship[2]>=LEGS.length?'Ocean Pearl, home':'Ocean Pearl'}].map(k=>({...k,p:proj(k.x,k.y,k.z||0)})).filter(k=>k.p).sort((a,b)=>a.p[0]-b.p[0]);
  font(c,11);c.textAlign='center';c.globalAlpha=labelA;const placed=[];
  for(const k of items){const w=c.measureText(k.t).width+8;let y=k.p[1]-34;for(let n=0;n<5;n++){const hit=placed.find(r=>Math.abs(r[0]-k.p[0])<(r[2]+w)/2&&Math.abs(r[1]-y)<15);if(!hit)break;y=hit[1]-16}placed.push([k.p[0],y,w]);
    c.strokeStyle='#fff';c.lineWidth=.8;c.beginPath();c.moveTo(k.p[0],k.p[1]);c.lineTo(k.p[0],y+4);c.stroke();halo(c,k.t,k.p[0],y,'#fff')}
  c.globalAlpha=1}

// ---------- the story: numbered steps along the clock; each has a day, a view, and says what kind of claim it is ----------
const STEPS=[
  {day:-30,chl:true,title:'The water before',kind:'observed',view:{az:.3,el:.8,k:.45,at:[-135,52.5]},
   text:'Haida eddies are slow whirlpools 95 to 190 mi across. They form off the south end of Haida Gwaii and turn out into the Gulf of Alaska. The open gulf has plenty of nutrients but little iron, so plankton stay sparse away from the coast. The green is chlorophyll, the pigment of plankton, as satellites measured it. The moving streaks are the currents, measured from the height of the sea surface.'},
  {day:0,chl:false,title:'A boat leaves Victoria',kind:'reported; day approximate',view:{az:-.5,el:.95,k:.8,at:[-129.5,50.8]},
   text:'In July 2012 a chartered fishing boat, the Ocean Pearl, leaves Victoria with a crew of eleven and a hold of iron compounds. The voyage is paid for by the Haida village of Old Massett, about $2.5 million, through the Haida Salmon Restoration Corporation. Its chief scientist is the American businessman Russ George.'},
  {day:6,chl:false,title:'The iron goes in',kind:'reported; simulated track',view:{az:.25,el:.95,k:2.8,at:[-139,52.9]},
   text:'About 230 mi (370 km) west of Haida Gwaii the crew scatters some 100 t of iron sulphate and 20 t of iron oxide along a zigzag track inside a Haida eddy, over about thirty days. The hope is twofold: more plankton to feed salmon, and carbon credits to sell. The track drawn here is approximate, placed on the weak, old eddy the altimeters show there.'},
  {day:24,chl:false,title:'Plankton answer',kind:'simulated',view:{az:-.3,el:1.2,k:2.8,at:[-139,53]},
   text:'Fed with iron, plankton multiply and are carried round by the eddy. Each stem is a patch of plankton; the taller it stands, the denser the bloom there. This part is a toy model, carried by the measured currents. It shows one way a bloom like this can spread.'},
  {day:46,chl:true,title:'The satellites see green',kind:'observed; reported; documented',view:{az:.15,el:.7,k:1.5,at:[-138,53]},
   text:'By late August the measured chlorophyll west of the islands is the most intense in that area in ten years, a later study finds. The bloom covers about 10,000 km² (3,900 sq mi) by one account, 35,000 km² by the corporation’s. On 29 August Environment Canada is told of a possible incident, and opens an investigation the next day.'},
  {day:65,chl:true,title:'Grazed down',kind:'documented; simulated; not known',view:{az:-.6,el:1.25,k:2.3,at:[-139,53]},
   text:'Plankton recorders towed behind commercial ships happened to cross the area that year. In autumn 2012 they caught the fewest plant plankton and more animal plankton than in any earlier autumn: the likely reading is that grazers ate the bloom down. How much carbon sank is not known.'},
  {day:93,chl:false,title:'The story breaks',kind:'documented',view:{az:1.1,el:1.1,k:1.3,at:[-133.5,53.6]},
   text:'In mid-October the release becomes public. ETC Group calls it the largest geoengineering deployment in the world; critics say it breaks two international moratoria; the corporation calls it ocean pasture restoration. On 18 October the Council of the Haida Nation and the Hereditary Chiefs Council say they were in no way involved.'},
  {day:108,chl:true,title:'What it leaves',kind:'documented; not known',view:{az:.3,el:.8,k:.45,at:[-135,52.5]},
   text:'In March 2013 Environment Canada searches the corporation’s offices and the ship; no charges are on the public record. In October 2013 the London Protocol adopts rules on ocean fertilization, which have still not entered into force. Salmon returned in large numbers in 2013 and 2014. The experiment had no untreated water to compare with, so the cause stays open.'}];
const stepAt=d=>{let i=0;for(let j=0;j<STEPS.length;j++)if(d>=STEPS[j].day-.01)i=j;return i};
let shownStep=-1;
$('#steps').innerHTML=`<button id="st-prev" aria-label="Previous step">←</button>`+STEPS.map((s,i)=>`<button class="st" data-i="${i}" aria-label="Step ${i+1}: ${s.title}">${i+1}</button>`).join('')+`<button id="st-next" aria-label="Next step">→</button>`;
const setChl=v=>{SET.chl=v;$('#chl').checked=v;$('#t-chl').setAttribute('aria-pressed',String(v))};
function goStep(i){i=clamp(i,0,STEPS.length-1);const s=STEPS[i];setRunning(false);setDay(s.day);setChl(s.chl);lastRun=performance.now();flyTo(s.view)}
$('#steps').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='st-prev')goStep(stepAt(day)-1);else if(b.id==='st-next')goStep(stepAt(day)+1);else goStep(+b.dataset.i)});
function showStep(){const i=stepAt(day);if(i===shownStep)return;const was=shownStep;shownStep=i;const s=STEPS[i];
  $('#step-n').textContent=`${i+1} of ${STEPS.length}`;$('#step-title').textContent=s.title;$('#step-kind').textContent=s.kind;$('#step-text').textContent=s.text;
  for(const b of document.querySelectorAll('#steps .st'))b.setAttribute('aria-current',String(+b.dataset.i===i));
  showMedia(i,0);if(running&&SET.follow&&was>=0){setChl(s.chl);flyTo(s.view)}}

// ---------- the photo box: archive pictures and news clippings for the step being told ----------
let MEDIA=[],mediaStep=0,mediaAt=0;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function showMedia(i,k){mediaStep=i;const list=MEDIA.filter(m=>m.step===i+1),box=$('#media');if(!list.length||!SET.media){box.hidden=true;return}
  mediaAt=(k+list.length)%list.length;const m=list[mediaAt],src=/^https?:\/\//.test(m.source||'')?m.source:null;box.hidden=false;
  $('#media-n').textContent=list.length>1?`${mediaAt+1} of ${list.length}`:'';$('#media-prev').hidden=$('#media-next').hidden=list.length<2;
  $('#media-body').innerHTML=m.type==='photo'
    ?`<img src="${esc(m.src)}" alt="${esc(m.caption)}"><p>${esc(m.caption)}</p><p class="cr">${esc([m.credit,m.date,m.licence].filter(Boolean).join(' · '))}${src?` · <a href="${esc(src)}" target="_blank" rel="noopener">source</a>`:''}</p>`
    :`<p class="cr">${esc([m.outlet,m.date].filter(Boolean).join(' · '))}</p><p class="hl">${esc(m.headline)}</p>${m.caption?`<p>${esc(m.caption)}</p>`:''}${src?`<p class="cr"><a href="${esc(src)}" target="_blank" rel="noopener">Read at the source →</a></p>`:''}`}
$('#media-prev').addEventListener('click',()=>showMedia(mediaStep,mediaAt-1));$('#media-next').addEventListener('click',()=>showMedia(mediaStep,mediaAt+1));
$('#media-x').addEventListener('click',()=>{SET.media=false;$('#media').hidden=true;$('#mediaOn').checked=false});
fetch('media/media.json').then(r=>r.ok?r.json():[]).then(j=>{MEDIA=Array.isArray(j)?j.filter(m=>m&&m.step&&(m.type==='photo'?m.src:m.headline)):[];showMedia(stepAt(day),0)}).catch(()=>{});

// ---------- the clock ----------
let day=DAY0,running=false,last=0,nframe=0;
const ck=$('#ck'),kx=ck.getContext('2d');
const maxDay=()=>frames.length?Math.min(DAY1,frames[frames.length-1].day):DAY0;
function clockGeom(){const r=ck.getBoundingClientRect();return {w:r.width,h:r.height,x0:8,x1:r.width-8}};
const dayX=(d,g)=>g.x0+(d-DAY0)/(DAY1-DAY0)*(g.x1-g.x0);
function drawClock(){const g=clockGeom();const dpr=Math.min(2,devicePixelRatio||1);if(ck.width!==g.w*dpr||ck.height!==g.h*dpr){ck.width=g.w*dpr;ck.height=g.h*dpr}kx.setTransform(dpr,0,0,dpr,0,0);kx.clearRect(0,0,g.w,g.h);
  const yl=44;kx.strokeStyle='#000';kx.lineWidth=1;kx.beginPath();kx.moveTo(g.x0,yl);kx.lineTo(dayX(maxDay(),g),yl);kx.stroke();
  if(maxDay()<DAY1){kx.strokeStyle='#d9d9d9';kx.beginPath();kx.moveTo(dayX(maxDay(),g),yl);kx.lineTo(g.x1,yl);kx.stroke()}
  font(kx,10);kx.fillStyle='#7a7a7a';kx.textAlign='left';
  for(const m of [[2012,6],[2012,7],[2012,8],[2012,9]]){const d=(Date.UTC(m[0],m[1],1)-EPOCH)/86400000;const x=dayX(d,g);kx.strokeStyle='#000';kx.beginPath();kx.moveTo(x,yl);kx.lineTo(x,yl+6);kx.stroke();if(g.w>420)kx.fillText(fmtMonth(d),x+3,yl+17)}
  // a tick for each composite date, in its month's hue; the two now on screen stand taller
  for(let i=0;i<CAL.length;i++){const x=dayX(CAL[i].n,g),w=i===mix.a?1-mix.t:i===mix.b?mix.t:0,h=5+w*14;kx.strokeStyle=monthRGB(monthOf(CAL[i].n));kx.lineWidth=w>.001?2:1;kx.beginPath();kx.moveTo(x,yl);kx.lineTo(x,yl-h);kx.stroke()}
  {const cur=stepAt(day);font(kx,10);kx.textAlign='center';STEPS.forEach((st,i)=>{const x=dayX(st.day,g);kx.strokeStyle='#000';kx.lineWidth=1;kx.beginPath();kx.moveTo(x,yl-27);kx.lineTo(x,yl-23);kx.stroke();kx.fillStyle=i===cur?'#000':'#9a9a9a';kx.fillText(i+1,x,yl-31)})}
  const x=dayX(day,g);kx.fillStyle='#000';kx.beginPath();kx.arc(x,yl,5,0,6.2832);kx.fill();
  $('#d-long').textContent=W>700?fmtLong(day):fmtShort(day)+' 2012';$('#d-sub').textContent=`day ${Math.floor(day)}${day<0?' before sailing':''}`}
function setDay(t){day=clamp(t,DAY0,maxDay())}
let scrub=false;
ck.addEventListener('pointerdown',e=>{scrub=true;ck.setPointerCapture(e.pointerId);const g=clockGeom(),r=ck.getBoundingClientRect();setDay(DAY0+(e.clientX-r.left-g.x0)/(g.x1-g.x0)*(DAY1-DAY0))});
ck.addEventListener('pointermove',e=>{if(!scrub)return;const g=clockGeom(),r=ck.getBoundingClientRect();setDay(DAY0+(e.clientX-r.left-g.x0)/(g.x1-g.x0)*(DAY1-DAY0))});
ck.addEventListener('pointerup',()=>{scrub=false});ck.addEventListener('pointercancel',()=>{scrub=false});
function setRunning(v){running=v;const b=$('#play');b.textContent=v?'Pause':'Run';b.setAttribute('aria-pressed',String(v))}
$('#play').addEventListener('click',()=>{if(!running&&day>=DAY1-.01)setDay(DAY0);setRunning(!running)});

// ---------- moving around, as in any 3D model: drag orbits, Shift-drag (or right-drag) pans, the wheel zooms ----------
const stage=$('#stage');let drag=null,mouse=null,fly=null;
const ease=u=>u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;
const VIEWS={plan:{az:0,el:.02},model:{az:.5,el:1.0},elev:{az:0,el:1.5,k:1.5},region:{az:.2,el:.6,k:.2,at:[-134,51]}};
// where the camera sits for a view: its angles, how close (a multiple of the fitted distance) and the place it looks at
function camFor(v){const at=v.at?[fx(v.at[0]),fy(v.at[1])]:[FW/2,FH/2];return {tx:at[0],ty:at[1],az:v.az,el:v.el,dist:fitDist()/(v.k||1)}}
function flyTo(v){const to=camFor(v);to.az=cam.az+Math.atan2(Math.sin(to.az-cam.az),Math.cos(to.az-cam.az));if(reduced){Object.assign(cam,to);return}fly={from:{...cam},to,t0:performance.now(),dur:1300}}
function stepFly(ts){if(!fly)return;const u=clamp((ts-fly.t0)/fly.dur,0,1),e=ease(u);for(const k in fly.to)cam[k]=k==='dist'?Math.exp(lerp(Math.log(fly.from[k]),Math.log(fly.to[k]),e)):lerp(fly.from[k],fly.to[k],e);if(u>=1)fly=null}
const ground=()=>2*cam.dist/FL/H;                               // frame units per screen pixel at the target
function pan(dx,dy){const sa=Math.sin(cam.az),ca=Math.cos(cam.az),s=ground(),k=s/Math.max(Math.cos(cam.el),.3);cam.tx+=-ca*dx*s-sa*dy*k;cam.ty+=sa*dx*s-ca*dy*k;cam.tx=clamp(cam.tx,fx(A0+15),fx(A1-10));cam.ty=clamp(cam.ty,fy(B1-8),fy(B0+6))}
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);fly=null;drag={x:e.clientX,y:e.clientY,pan:e.shiftKey||e.altKey||e.button!==0};stage.classList.add('drag');$('#read').hidden=true});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();mouse=[e.clientX-r.left,e.clientY-r.top];if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
  if(drag.pan)pan(dx,dy);else{cam.az-=dx*.006;cam.el=clamp(cam.el-dy*.005,.02,1.52)}});
const endDrag=()=>{drag=null;stage.classList.remove('drag')};canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
canvas.addEventListener('pointerleave',()=>{mouse=null;$('#read').hidden=true});
for(const ev of ['pointerdown','pointermove','wheel'])canvas.addEventListener(ev,()=>{dirty=true},{passive:true});
// the wheel zooms towards the point under the cursor
canvas.addEventListener('wheel',e=>{e.preventDefault();fly=null;const r=canvas.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top;B=basis(cam);const a=unproj(sx,sy);
  cam.dist=clamp(cam.dist*Math.exp(e.deltaY*.0015),120,16000);B=basis(cam);const b=unproj(sx,sy);if(a&&b&&Math.hypot(a[0]-b[0],a[1]-b[1])<6000){cam.tx+=a[0]-b[0];cam.ty+=a[1]-b[1]}},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
for(const k in VIEWS)$('#v-'+k).addEventListener('click',()=>flyTo(VIEWS[k]));
$('#t-chl').addEventListener('click',()=>setChl(!SET.chl));
const setCur=v=>{SET.cur=v;$('#cur').checked=v;$('#t-cur').setAttribute('aria-pressed',String(v))};$('#t-cur').addEventListener('click',()=>setCur(!SET.cur));
function markView(){const far=cam.dist>fitDist()*1.9,on={region:far,plan:!far&&cam.el<.08,elev:!far&&cam.el>1.45};on.model=!on.region&&!on.plan&&!on.elev;for(const k in on)$('#v-'+k).setAttribute('aria-pressed',String(on[k]))}
function readout(){const el=$('#read');if(!mouse||drag||fly||!frames.length){el.hidden=true;return}const f=unproj(...mouse);if(!f||f[0]<0||f[1]<0||f[0]>=FW||f[1]>=FH){el.hidden=true;return}
  const lon=LON0+f[0]/FW*(LON1-LON0),lat=LAT1-f[1]/FH*(LAT1-LAT0),h=TER[((f[1]/FH*TH)|0)*TW+((f[0]/FW*TW)|0)],p=dens(...f),gg=chlAt(...f);
  const what=h>0?`land, about ${(Math.round(h*FT/100)*100).toLocaleString('en-US')} ft`:`chlorophyll measured: ${gg?chlMg(gg).toFixed(2)+' mg/m³':'not seen'}<br>simulated plankton: ${p>.5?'dense':p>.08?'present':'none'}`;
  el.innerHTML=`${lat.toFixed(1)}° N, ${Math.abs(lon).toFixed(1)}° W<br><span class="m">${what}<br>from the days around ${fmtShort(CAL[mix.a].n)}${mix.b!==mix.a?' and '+fmtShort(CAL[mix.b].n):''}</span>`;
  el.hidden=false;const x=mouse[0]+16,y=mouse[1]+16;el.style.left=Math.min(x,W-el.offsetWidth-8)+'px';el.style.top=Math.min(y,H-el.offsetHeight-8)+'px'}

// ---------- frame ----------
// Nothing is redrawn while nothing changes: the picture is drawn again only when the clock, the camera, a setting or the streaks move.
const PROF={};let lastKey='';
function frame(ts){const T0=performance.now(),dt=Math.min(.05,(ts-last)/1000||.016);last=ts;
  if(running&&!scrub){day+=dt*SET.speed;lastRun=ts;if(day>=maxDay()){day=maxDay();if(day>=DAY1)setRunning(false)}}
  stepFly(ts);if(SET.drift&&!drag&&!fly&&!reduced)cam.az+=dt*.04;
  const key=[cam.tx,cam.ty,cam.az,cam.el,cam.dist,day,frames.length,JSON.stringify(SET),JSON.stringify(P)].join(),
    moving=running||SET.cur||Math.abs((SET.chl?1:0)-chlOn)>.003||labelA>.01||ts-lastRun<3400;
  if(dirty||moving||key!==lastKey){lastKey=key;dirty=false;stateAt(day);mixAt(day);if(SET.cur)stepStreaks(dt);renderGL(ts);render2D(ctx,DPR,ts);PROF.drawn=(PROF.drawn||0)+1}
  showStep();if(nframe%4===0)readout();if(nframe%10===0)markView();drawClock();PROF.ms=performance.now()-T0;nframe++;requestAnimationFrame(frame)}

// ---------- settings ----------
const panel=$('#panel'),word=$('#word');
word.addEventListener('click',()=>{const open=panel.hidden;panel.hidden=!open;word.setAttribute('aria-expanded',String(open))});
let resimT=0;const resim=()=>{clearTimeout(resimT);resimT=setTimeout(simulate,350)};
for(const k of ['iron','eddy','graze','wind']){$('#'+k).addEventListener('input',e=>{P[k]=+e.target.value;$('#v-'+k).textContent=k==='iron'?P.iron+' t':P[k].toFixed(2);resim()})}
const pct=v=>Math.round(v*100)+'%',sliders={speed:v=>v+' days / s',vex:v=>'×'+v,bloom:v=>'×'+(+v).toFixed(1),chlA:pct,chlH:v=>'×'+(+v).toFixed(1)},checks={drift:'drift',posts:'posts',terrain:'terrain',follow:'follow',chl:'chl',cur:'cur',mediaOn:'media'};
const showSet=()=>{for(const k in sliders){$('#'+k).value=SET[k];$('#v-'+k).textContent=sliders[k](SET[k])}for(const id in checks)$('#'+id).checked=SET[checks[id]];$('#t-chl').setAttribute('aria-pressed',String(SET.chl));$('#t-cur').setAttribute('aria-pressed',String(SET.cur))};
for(const k in sliders)$('#'+k).addEventListener('input',e=>{SET[k]=+e.target.value;$('#v-'+k).textContent=sliders[k](SET[k])});
for(const id in checks)$('#'+id).addEventListener('change',e=>{SET[checks[id]]=e.target.checked;if(id==='chl')setChl(SET.chl);if(id==='cur')setCur(SET.cur);if(id==='mediaOn')showMedia(stepAt(day),0)});
showSet();
// the key: one swatch per layer, with its source number
$('#key').innerHTML=[['Chlorophyll, measured, 0.3 to 4 mg/m³',COL.chl,1],['Currents, measured',COL.cur,2],['Sea and land picture',COL.sea,3],['Land relief',COL.land,4],['Coast and borders',COL.map,5],['Plankton, simulated; taller is denser',COL.plankton,6],['Iron and ship, simulated',COL.iron,6]]
  .map(([t,c,n])=>`<span><i style="background:${c}"></i>${t}<sup>${n}</sup></span>`).join('');
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;const k=e.key,q=k.toLowerCase();
  if(k===' '){e.preventDefault();$('#play').click()}else if(q==='f'){fly=null;fit()}else if(k==='1')flyTo(VIEWS.plan);else if(k==='2')flyTo(VIEWS.model);else if(k==='3')flyTo(VIEWS.elev);else if(k==='4')flyTo(VIEWS.region);
  else if(q==='c')setChl(!SET.chl);else if(q==='v')setCur(!SET.cur);else if(q.length===1&&'wasd'.includes(q)){fly=null;pan(q==='a'?70:q==='d'?-70:0,q==='w'?70:q==='s'?-70:0)}
  else if(k==='.')goStep(stepAt(day)+1);else if(k===',')goStep(stepAt(day)-1);else if(k==='ArrowRight')setDay(Math.floor(day)+1);else if(k==='ArrowLeft')setDay(Math.ceil(day)-1);
  else if(k==='Escape'){panel.hidden=true;word.setAttribute('aria-expanded','false');$('#shot').hidden=true}});

// ---------- out ----------
$('#png').addEventListener('click',()=>{const c=oc(canvas.width,canvas.height),x=c.getContext('2d');renderGL(performance.now());x.drawImage(g,0,0,c.width,c.height);x.drawImage(canvas,0,0);$('#shotimg').src=c.toDataURL('image/png');$('#shot').hidden=false});
$('#shotclose').addEventListener('click',()=>{$('#shot').hidden=true});
$('#save').addEventListener('click',()=>{$('#txt').value=JSON.stringify({app:'haida-model',version:3,day,sim:{...P},settings:{...SET},camera:{...cam}},null,1)});
$('#apply').addEventListener('click',()=>{let s;try{s=JSON.parse($('#txt').value)}catch(e){status('that is not a setup');setTimeout(()=>status(''),2500);return}
  let changed=false;if(s.sim)for(const k in P)if(k in s.sim&&P[k]!==s.sim[k]){P[k]=s.sim[k];$('#'+k).value=P[k];$('#v-'+k).textContent=k==='iron'?P.iron+' t':P[k].toFixed(2);changed=true}
  if(s.settings){for(const k in SET)if(k in s.settings)SET[k]=s.settings[k];showSet()}
  if(s.camera)for(const k in cam)if(typeof s.camera[k]==='number')cam[k]=s.camera[k];if(changed)simulate();day=clamp(+s.day||0,DAY0,DAY1)});
$('#copy').addEventListener('click',async()=>{const t=$('#txt');try{await navigator.clipboard.writeText(t.value)}catch(e){t.focus();t.select()}});

addEventListener('resize',()=>{resize();drawClock()});new ResizeObserver(()=>resize()).observe($('#stage'));resize();Object.assign(cam,camFor(STEPS[0].view));
requestAnimationFrame(frame);
window.__hw={PROF,CAL,cam,S,P,SET,mix,get day(){return day},setDay,frames:()=>frames,goStep,flyTo,VIEWS};
})().catch(e=>{const el=document.getElementById('err');el.hidden=false;el.textContent='Could not start: '+e.message;document.getElementById('status').hidden=true;console.error(e)});
