import { specimens, sceneById, makeTargets, morphs } from "./specimens.js";
import { createRenderer, canvasFallback, cameraMatrix, project, worldPoint, clamp, rgb, MAX_POINTS } from "./renderer.js";
import { createCamera, gestureTracker, mirroredPoint } from "./hands.js";

const $=id=>document.getElementById(id);
const root=document.documentElement, stage=$("stage"), overlay=$("overlay"), video=$("camera");
const ctx=overlay.getContext("2d");
const mobile=matchMedia("(pointer:coarse)").matches;
const reduced=matchMedia("(prefers-reduced-motion:reduce)").matches;
const params=new URLSearchParams(location.search);
const icons={
  hand:"<path d='M8 13V5a1.5 1.5 0 0 1 3 0v6m0-6V3a1.5 1.5 0 0 1 3 0v8m0-6a1.5 1.5 0 0 1 3 0v6m0-4a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-1a5 5 0 0 1-4-2l-4-5a2 2 0 0 1 3-2l1 1'/>",
  focus:"<path d='M8 4H4v4m12-4h4v4m-4 12h4v-4M8 20H4v-4'/><circle cx='12' cy='12' r='2'/>",
  expand:"<path d='M9 3H3v6m12-6h6v6m-6 12h6v-6M9 21H3v-6'/>",
  sliders:"<path d='M4 7h6m4 0h6M4 17h10m4 0h2'/><circle cx='12' cy='7' r='2'/><circle cx='16' cy='17' r='2'/>",
  help:"<circle cx='12' cy='12' r='9'/><path d='M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8m0 3h.01'/>",
  close:"<path d='m6 6 12 12M6 18 18 6'/>",
  left:"<path d='m14 6-6 6 6 6'/>",
  right:"<path d='m10 6 6 6-6 6'/>",
  pin:"<path d='m13 4 7 7m-5-6-2 6 2 3-1 1-3-2-6 2 2-6-2-3 1-1 3 2 6-2M9 15l-5 5'/>",
  trash:"<path d='M4 6h16M9 6V3h6v3M6 6l1 14h10l1-14m-8 4v6m4-6v6'/>",
  download:"<path d='M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4'/>",
  record:"<circle cx='12' cy='12' r='8'/><circle cx='12' cy='12' r='3'/>",
  reset:"<path d='M6 7a8 8 0 1 1-1 10m1-10v5h5'/>",
};
for(const element of document.querySelectorAll("[data-icon]")) element.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[element.dataset.icon]+'</svg>';

const themes={
  Obsidian:{bg:"#0c1012",ambient:"#1e1c25",fg:"#f4efea",muted:"#aaa7a6",glass:"#14171be8",line:"#ffffff2b",tile:"#ffffff0e",shadow:"#0009"},
  Porcelain:{bg:"#e8e2d7",ambient:"#f8f2e9",fg:"#272524",muted:"#544e50",glass:"#fbf7edeb",line:"#30212135",tile:"#30212114",shadow:"#50423e40",accent:"#75495c",colors:["#503b66","#9d526b","#b48550"]},
  Aurora:{bg:"#0d1121",ambient:"#182843",fg:"#eef5fd",muted:"#b5bad1",glass:"#131e34ea",line:"#bfd6ff39",tile:"#d4e7ff17",shadow:"#0509189a",accent:"#91dcec",colors:["#51458a","#7ae0d0","#c2d7ff"]},
  Christmas:{bg:"#111814",ambient:"#292325",fg:"#faf3df",muted:"#c3b7a2",glass:"#1b211ae9",line:"#f8d69735",tile:"#e4c38617",shadow:"#0c100aa0",accent:"#e8c486",colors:["#39765b","#d78476","#fff1ae"]},
  Sakura:{bg:"#1c151e",ambient:"#35212e",fg:"#fbf0f5",muted:"#c8adb9",glass:"#251a26e9",line:"#ffd2e336",tile:"#ffdbe416",shadow:"#160912a0",accent:"#f5aecb",colors:["#8e4674","#ef98bf","#fff0e6"]},
  Custom:{bg:"#0e1217",ambient:"#222531",fg:"#f4f1ed",muted:"#b4b3b3",glass:"#191d22e9",line:"#ffffff33",tile:"#ffffff13",shadow:"#000a"},
};
const defaults={
  theme:"Obsidian",color:"#eea7bd",size:1.85,glow:.43,background:"atmosphere",frame:false,
  speed:reduced?.4:1,damping:.87,spread:1,trail:.24,sound:false,sensitivity:.54,mode:"sculpt",
  stage:"studio",cameraLight:.64,quality:"Auto",limit:32000,adaptive:true,metrics:false,scene:"flower",intro:true,
};
const quality={
  Low:{points:4200,dpr:1,trail:0,fps:12},
  Medium:{points:8500,dpr:1.30,trail:.48,fps:16},
  High:{points:16000,dpr:1.55,trail:.85,fps:20},
  Ultra:{points:28000,dpr:1.85,trail:1,fps:24},
};
const tiers=Object.keys(quality);
const modes=["sculpt","flow","vortex","morph","draw"];
const keys=Object.keys(defaults);
const prefs={...defaults};
try {
  const saved=JSON.parse(localStorage.getItem("flora-field-2")||"{}");
  for(const key of keys) if(typeof saved[key]===typeof defaults[key]) prefs[key]=saved[key];
} catch {}
if(!themes[prefs.theme]) prefs.theme=defaults.theme;
if(!quality[prefs.quality]&&prefs.quality!=="Auto") prefs.quality="Auto";
if(!modes.includes(prefs.mode)) prefs.mode="sculpt";
if(!/^#[a-f0-9]{6}$/i.test(prefs.color)) prefs.color=defaults.color;
for(const key of ["size","glow","speed","damping","spread","trail","sensitivity","cameraLight","limit"]) {
  const input=document.querySelector('[data-pref="'+key+'"]');
  if(!Number.isFinite(prefs[key])) prefs[key]=defaults[key];
  if(input.min) prefs[key]=clamp(prefs[key],+input.min,+input.max);
}
const compare=params.has("benchmark");
const benchmarkCount=compare?clamp(Number(params.get("benchmark"))||4800,400,MAX_POINTS):0;
if(compare) Object.assign(prefs,{scene:"flower",theme:"Obsidian",quality:"High",limit:benchmarkCount,metrics:true,trail:0,frame:false,intro:false});
let renderer;
try { renderer=createRenderer($("art"),params.get("renderer")==="canvas"); }
catch { $("still").hidden=false; }
const state={
  w:1,h:1,dpr:1,cx:0,cy:0,scale:1,dt:1,time:0,
  angles:new Float32Array([-.12,.08,0]),matrix:new Float32Array(9),
  hand:new Float32Array(3),impulse:new Float32Array(3),
  spread:0,force:0,radius:.62,pulse:0,morph:0,mode:0,animation:1,
  count:0,colors:[rgb("#7d3556"),rgb("#ec9db9"),rgb("#ffe6d2")],
};
let activeScene=sceneById.get(prefs.scene)||specimens[0], morph=0, targetCache;
let autoTier=mobile?1:2, lowWindows=0, highWindows=0, fps=60, frameSum=0, frameCount=0, cpuSum=0, lastSample=0;
let spreadGoal=0, forceGoal=0, pulse=0, zoom=1, zoomGoal=1, xAngle=-.12,yAngle=.08,roll=0;
let offsetX=0,offsetY=0,offsetGoalX=0,offsetGoalY=0,sourceX=0,sourceY=0;
let stageReady=false, raf=0, lastFrame=0, cinema=false, idling, toastTimer, saveTimer;
let latestHand, handAt=0, lastGesture="idle", handAnchor, handTransform, pointerAnchor;
let modelState="off", modelEpoch=0;
let sound, recorder, recording, recordingTimer;
let inkHead=0,inkCount=0,keepInk=false,inkBeforeX=NaN,inkBeforeY=NaN,inkClock=0,overlayDirty=false;
const ink=new Float32Array(1100*5);
const point=new Float32Array(3), space=new Float32Array(3);
const cagePoints=Array.from({length:8},()=>new Float32Array(3));
const pointers=new Map();
const tracker=gestureTracker();
const activeQuality=()=>quality[prefs.quality==="Auto"?tiers[autoTier]:prefs.quality];
const setText=(element,text)=>{if(element.textContent!==text) element.textContent=text;};
const persist=()=>{if(!compare) try {localStorage.setItem("flora-field-2",JSON.stringify({...prefs,sound:false,stage:"studio"}));} catch {}};
function toast(text) {
  $("toast").textContent=text; $("toast").hidden=false;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>$("toast").hidden=true,3800);
}
function theme() {
  const t=themes[prefs.theme], custom=prefs.theme==="Custom";
  const accent=t.accent||(custom?prefs.color:activeScene.colors[1]);
  const ambient=custom?"color-mix(in srgb, "+prefs.color+" 18%, "+t.bg+")":prefs.theme==="Obsidian"?"color-mix(in srgb, "+accent+" 11%, "+t.bg+")":t.ambient;
  for(const key of ["bg","fg","muted","glass","line","tile","shadow"]) root.style.setProperty("--"+key,t[key]);
  root.style.setProperty("--accent",accent);
  root.style.setProperty("--ambient",ambient);
  document.querySelector('meta[name="theme-color"]').content=t.bg;
  root.style.colorScheme=prefs.theme==="Porcelain"?"light":"dark";
  root.dataset.background=prefs.background;
  state.colors=custom?[rgb(prefs.color).map(n=>n*.42),rgb(prefs.color),rgb(prefs.color).map(n=>n+(1-n)*.66)]:(t.colors||activeScene.colors).map(rgb);
  $("customColor").hidden=!custom;
}
function cameraView() {
  root.classList.toggle("camera-view",prefs.stage==="camera"&&Boolean(video.srcObject));
  root.style.setProperty("--camera-light",prefs.cameraLight);
}
function syncPreferences() {
  for(const input of document.querySelectorAll("[data-pref]")) {
    const value=prefs[input.dataset.pref];
    if(input.type==="checkbox") input.checked=value;
    else input.value=value;
  }
  $("metrics").hidden=!prefs.metrics;
  $("intro").hidden=!prefs.intro;
}
const autoMotion=() => reduced?.35:1;
function resetView() {
  spreadGoal=0; forceGoal=0; pulse=0; zoomGoal=1; offsetGoalX=0; offsetGoalY=0;
  xAngle=-.12; yAngle=.08; roll=0; pointerAnchor=null; handAnchor=null; handTransform=null;
}
function setMode(mode,store=true) {
  prefs.mode=mode; state.mode=modes.indexOf(mode);
  $("modeActions").hidden=mode!=="morph"&&mode!=="draw";
  $("morphControl").hidden=mode!=="morph"; $("drawControl").hidden=mode!=="draw";
  for(const button of document.querySelectorAll("[data-mode]")) button.setAttribute("aria-pressed",button.dataset.mode===mode);
  document.querySelector('[data-pref="mode"]').value=mode;
  tracker.reset(); latestHand=null; handAnchor=null; handTransform=null; forceGoal=0; spreadGoal=0; lastGesture="idle";
  if(mode!=="morph") setMorph(0);
  inkBeforeX=NaN;
  if(store) persist();
}
function targetScene(reset=false) {
  targetCache=makeTargets(activeScene.id,MAX_POINTS,morph);
  renderer?.targets(targetCache,reset);
  state.animation=activeScene.animation;
  state.morph=morph;
}
function setMorph(next) {
  next=clamp(next,0,5);
  if(morph===next) return;
  morph=next;
  $("morphSelect").value=next;
  if(next!==5) targetScene();
  state.morph=morph;
  spreadGoal=next===5?1:0;
}
function thumbnail(scene) {
  const samples=makeTargets(scene.id,132);
  const nodes=[];
  for(let j=0;j<samples.length;j+=4) {
    const x=(32+samples[j]*19+samples[j+2]*2).toFixed(1), y=(30-samples[j+1]*18+samples[j+2]*1.4).toFixed(1);
    const v=samples[j+3], index=v>.72?2:v>.40?1:0;
    nodes.push('<circle cx="'+x+'" cy="'+y+'" r="'+(v>.76?1.00:.69)+'" fill="'+scene.colors[index]+'" opacity="'+(.48+v*.45).toFixed(2)+'"/>');
  }
  return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 60"><rect x="7" y="6" width="50" height="48" rx="10" fill="#121821"/>'+nodes.join("")+'</svg>');
}
for(const scene of specimens) {
  const button=document.createElement("button"), img=new Image();
  button.className="specimen"; button.dataset.scene=scene.id;
  button.title=scene.name; button.setAttribute("aria-label",scene.name);
  img.alt=""; img.src=thumbnail(scene); img.decoding="async";
  button.append(img); $("dock").append(button);
  button.onclick=()=>selectScene(scene);
}
function selectScene(scene, initial=false) {
  prefs.scene=scene.id; activeScene=scene;
  morph=0; $("morphSelect").value=0; spreadGoal=0;
  targetScene(initial); theme();
  setText($("artTitle"),scene.title); setText($("artName"),scene.name);
  setText($("collectionIndex"),String(specimens.indexOf(scene)+1).padStart(2,"0")+" / "+specimens.length);
  for(const button of $("dock").children) button.setAttribute("aria-pressed",button.dataset.scene===scene.id);
  const button=$("dock").querySelector('[data-scene="'+scene.id+'"]');
  if(!initial||scene!==specimens[0]) button.scrollIntoView({behavior:reduced||initial?"auto":"smooth",block:"nearest",inline:"nearest"});
  if(!initial) persist();
}
function changeScene(dir) { selectScene(specimens[(specimens.indexOf(activeScene)+dir+specimens.length)%specimens.length]); }
for(const [i,name] of morphs.entries()) $("morphSelect").add(new Option(name,String(i)));
$("morphSelect").onchange=e=>setMorph(+e.target.value);
$("prevScene").onclick=()=>changeScene(-1);
$("nextScene").onclick=()=>changeScene(1);
for(const button of document.querySelectorAll("[data-mode]")) button.onclick=()=>setMode(button.dataset.mode);
$("dock").addEventListener("wheel",e=>{
  if(Math.abs(e.deltaY)>Math.abs(e.deltaX)) { e.preventDefault(); $("dock").scrollLeft+=e.deltaY; }
},{passive:false});

function fitBuffers(dpr,force=false) {
  const canvas=renderer.canvas, width=Math.round(state.w*dpr),height=Math.round(state.h*dpr);
  if(!force&&canvas.width===width&&canvas.height===height&&overlay.width===width&&overlay.height===height) return;
  state.dpr=dpr;
  canvas.width=width; canvas.height=height;
  overlay.width=width; overlay.height=height;
}
function resize() {
  if(!renderer) return;
  const {width,height}=stage.getBoundingClientRect();
  state.w=Math.max(1,width); state.h=Math.max(1,height);
  fitBuffers(Math.min(devicePixelRatio||1,activeQuality().dpr,compare?1:2));
}
addEventListener("resize",resize,{passive:true});
function bindContextLoss() {
  renderer?.canvas.addEventListener("webglcontextlost",event=>{
    event.preventDefault();
    renderer=canvasFallback(renderer.canvas);
    renderer.targets(targetCache,true); resize();
    root.dataset.renderer=renderer.name;
    toast("Graphics context interrupted. Using Canvas 2D.");
  },{once:true});
}
bindContextLoss();
function qualitySample(now) {
  if(!lastSample) { lastSample=now; return; }
  if(now-lastSample<2400||!frameCount) return;
  fps=1000/(frameSum/frameCount);
  const cost=cpuSum/frameCount;
  if(prefs.quality==="Auto"&&prefs.adaptive&&!compare&&renderer.name==="WebGL 2") {
    const down=fps<(mobile?39:47)||cost>11, up=fps>56&&cost<7;
    lowWindows=down?lowWindows+1:0;
    highWindows=up?highWindows+1:0;
    if(lowWindows>=2&&autoTier>0) { autoTier--; lowWindows=0; resize(); }
    if(highWindows>=4&&autoTier<(mobile?2:3)) { autoTier++; highWindows=0; resize(); }
  }
  if(prefs.metrics) setText($("metrics"),Math.round(fps)+" FPS · "+Math.round(state.count).toLocaleString("en")+" particles · "+renderer.name);
  frameCount=0; frameSum=0; cpuSum=0; lastSample=now;
}
function paintOverlay() {
  const s=state;
  const slots=ink.length/5;
  if(inkCount&&inkClock-ink[((inkHead+slots-1)%slots)*5+3]>=4.5) inkCount=0;
  const visible=prefs.frame||s.pulse>.035||inkCount>0;
  if(!visible&&!overlayDirty) return;
  overlayDirty=visible;
  ctx.setTransform(s.dpr,0,0,s.dpr,0,0);
  ctx.clearRect(0,0,s.w,s.h);
  if(!visible) return;
  const tint=s.colors[2].map(n=>Math.round(255*n)).join(",");
  if(prefs.frame) {
    let i=0;
    for(const x of [-1.35,1.35]) for(const y of [-1.35,1.35]) for(const z of [-1.35,1.35]) project(x,y,z,s,cagePoints[i++]);
    ctx.strokeStyle="rgba("+tint+",.24)";ctx.lineWidth=.65;ctx.beginPath();
    for(let a=0;a<8;a++) for(let b=a+1;b<8;b++) if([1,2,4].includes(a^b)) {
      ctx.moveTo(cagePoints[a][0],cagePoints[a][1]); ctx.lineTo(cagePoints[b][0],cagePoints[b][1]);
    }
    ctx.stroke(); ctx.fillStyle="rgba("+tint+",.7)";
    for(const pt of cagePoints) ctx.fillRect(pt[0]-1.4,pt[1]-1.4,2.8,2.8);
  }
  if(s.pulse>.035) {
    project(...s.impulse,s,point);
    ctx.strokeStyle="rgba("+tint+","+(s.pulse*.35)+")"; ctx.lineWidth=1.2; ctx.beginPath();
    ctx.arc(point[0],point[1],(1-s.pulse)*s.scale*2.8,0,Math.PI*2); ctx.stroke();
  }
  if(inkCount) {
    ctx.fillStyle="rgb("+tint+")";
    const n=ink.length/5;
    for(let i=0;i<inkCount;i++) {
      const j=(inkHead+n-inkCount+i)%n*5;
      const age=Math.max(0,inkClock-ink[j+3]), ageProgress=1-age/4.5;
      if(ageProgress<=0) continue;
      project(ink[j]+Math.sin(age*.65+ink[j+4])*age*.016,ink[j+1]+age*.026,ink[j+2],s,point);
      ctx.globalAlpha=ageProgress*.86;
      const r=(1.2+ink[j+4]*2)*point[2];
      ctx.fillRect(point[0]-r/2,point[1]-r/2,r,r);
    }
    ctx.globalAlpha=1;
  }
}
function addInk(x,y) {
  const distance=Number.isFinite(inkBeforeX)?Math.hypot(x-inkBeforeX,y-inkBeforeY):0;
  if(distance>0&&distance<2.3) return;
  const steps=clamp(Math.ceil(distance/4),1,23);
  for(let j=1;j<=steps;j++) {
    const t=j/steps, rx=distance?inkBeforeX+(x-inkBeforeX)*t:x, ry=distance?inkBeforeY+(y-inkBeforeY)*t:y;
    worldPoint(rx,ry,state,space);
    for(let i=0;i<3;i++) {
      const k=inkHead*5,jitter=Math.random();
      ink[k]=space[0]+(Math.random()-.5)*.05; ink[k+1]=space[1]+(Math.random()-.5)*.05;
      ink[k+2]=space[2]+(jitter-.5)*.13; ink[k+3]=inkClock; ink[k+4]=jitter;
      inkHead=(inkHead+1)%(ink.length/5); inkCount=Math.min(inkCount+1,ink.length/5);
    }
  }
  inkBeforeX=x;inkBeforeY=y;
}
$("keepInk").onclick=()=>{
  keepInk=!keepInk;$("keepInk").setAttribute("aria-pressed",keepInk);
  setText($("keepInk").lastChild,keepInk?"Kept":"Keep");
};
$("clearInk").onclick=()=>{inkCount=0;inkBeforeX=NaN;};

function onCameraState(status,message) {
  modelState=status;
  if(status==="off") { tracker.reset(); latestHand=null; handAnchor=null; handTransform=null; lastGesture="idle"; }
  root.classList.toggle("tracking",status==="tracking"); cameraView();
  const btn=$("cameraButton");
  btn.setAttribute("aria-pressed",status!=="off");
  const label=status==="starting"?"Connecting":status==="tracking"?"Tracking on":status==="preview"?"Camera on":"Hand tracking";
  setText(btn.querySelector(".camera-label"),label);
  btn.setAttribute("aria-label",status==="off"?"Enable hand tracking":"Turn off camera");
  setText($("handState"),status==="tracking"?"Show a hand":status==="preview"?"Camera · mouse / touch":status==="starting"?"Connecting camera":"Mouse / touch");
  if(message) toast(message);
}
const camera=createCamera(video,onCameraState,(hands,labels)=>{
  const now=performance.now();
  if(!hands.length) return;
  if(now-handAt>450) tracker.reset();
  latestHand=tracker.update(hands,now,prefs.sensitivity,prefs.mode==="morph",labels);
  handAt=now; modelEpoch++;
},()=>activeQuality().fps);
$("cameraButton").onclick=()=>camera.start();

const gestureNames={idle:"Hand detected",point:"Point · local flow",open:"Open · disperse",fist:"Fist · gather",pinch:"Pinch · drag",pair:"Two hands",zoom:"Two hands · scale",rotate:"Two hands · rotate",wave:"Swipe · shockwave",morph:"Morph"};
let appliedEpoch=0, missing=false;
function applyHand(now) {
  if(!latestHand||now-handAt>310||pointers.size) {
    if(!missing&&latestHand&&now-handAt>310) {
      if(lastGesture==="open") spreadGoal=0;
      forceGoal=0; inkBeforeX=NaN; handAnchor=null; handTransform=null;
      if(modelState==="tracking") setText($("handState"),"Show a hand");
      missing=true;lastGesture="idle";
    }
    return;
  }
  if(appliedEpoch===modelEpoch) return;
  appliedEpoch=modelEpoch;missing=false;
  const hand=latestHand, {kind}=hand, s=state;
  const p=mirroredPoint(hand.x,hand.y,video.videoWidth||640,video.videoHeight||480,s.w,s.h);
  const x=clamp(p.x,0,s.w),y=clamp(p.y,0,s.h);
  forceGoal=0;sourceX=x;sourceY=y;
  if(kind!=="pinch") handAnchor=null;
  if(!["pair","zoom","rotate"].includes(kind)) handTransform=null;
  if(kind!=="point") inkBeforeX=NaN;
  if(kind==="point") {
    if(prefs.mode==="draw") addInk(x,y);
    else forceGoal=.58+Math.min(1.4,hand.speed||0)*.20;
  }
  if(kind==="wave") {
    worldPoint(x,y,s,s.impulse); pulse=1;
  }
  if(kind==="open") spreadGoal=Math.max(.32,hand.extent);
  if(kind==="fist") spreadGoal=0;
  if(kind==="pinch") {
    if(!handAnchor) handAnchor={x:x-offsetGoalX,y:y-offsetGoalY};
    offsetGoalX=x-handAnchor.x;offsetGoalY=y-handAnchor.y;
  }
  if(["pair","zoom","rotate"].includes(kind)) {
    if(!handTransform) handTransform={zoom:zoomGoal,roll,x:x-offsetGoalX,y:y-offsetGoalY};
    if(kind==="zoom") zoomGoal=clamp(handTransform.zoom*hand.ratio,.53,2.45);
    if(kind==="rotate") roll=handTransform.roll-hand.turn;
    if(prefs.stage==="camera") {
      offsetGoalX=(x-handTransform.x)*.84;offsetGoalY=(y-handTransform.y)*.84;
    }
  }
  if(kind==="morph") setMorph(hand.morph);
  const label=kind==="morph"?morphs[hand.morph]:gestureNames[kind];
  setText($("handState"),label);
  lastGesture=kind;
}
function animate(now) {
  raf=0;
  if(document.hidden||!renderer) return;
  if(!lastFrame) lastFrame=now-16.667;
  const delta=clamp(now-lastFrame,1,70); lastFrame=now;
  const started=performance.now();
  const s=state,q=activeQuality();
  s.dt=clamp(delta/16.667,.05,2);
  s.time+=Math.min(delta,50)*.001;
  const motion=compare?1:prefs.speed*autoMotion();
  s.movement=motion;
  if(!pointers.size&&now-handAt>235) yAngle+=.0024*s.dt*motion;
  applyHand(now);
  if(!pointers.size&&now-handAt>310&&prefs.mode==="sculpt") forceGoal*=.89;
  s.spread+=(spreadGoal*prefs.spread-s.spread)*Math.min(.38,.086*s.dt);
  s.force+=(forceGoal-s.force)*Math.min(.48,.20*s.dt);
  pulse*=Math.pow(.912,s.dt);
  s.pulse=pulse;s.damping=prefs.damping;s.radius=(prefs.mode==="vortex"?.92:.69)+(prefs.sensitivity-.5)*.3;
  zoom+=(zoomGoal-zoom)*.15*s.dt;
  offsetX+=(clamp(offsetGoalX,-s.w*.43,s.w*.43)-offsetX)*.16*s.dt;
  offsetY+=(clamp(offsetGoalY,-s.h*.41,s.h*.41)-offsetY)*.16*s.dt;
  const compact=s.w<700, short=s.h<530;
  s.cx=s.w*(cinema||compact||short?.50:.56)+offsetX;
  s.cy=s.h*(short?.44:compact?.515:.48)+offsetY;
  s.scale=Math.max(1,Math.min(s.w*(compact?.345:.245),s.h*(short?.255:.302))*zoom);
  s.angles[0]+=(xAngle-s.angles[0])*.14*s.dt;s.angles[1]+=(yAngle-s.angles[1])*.14*s.dt;
  s.angles[2]+=(roll-s.angles[2])*.14*s.dt;
  cameraMatrix(s.angles,s.matrix);
  worldPoint(sourceX,sourceY,s,s.hand);
  const limit=renderer.name==="Canvas 2D"?Math.min(mobile?1850:2600,prefs.limit):Math.min(q.points,prefs.limit);
  const wanted=benchmarkCount&&renderer.name==="WebGL 2"?benchmarkCount:limit;
  if(!s.count||benchmarkCount) s.count=wanted;
  else s.count+=clamp(wanted-s.count,-100,100);
  s.dot=prefs.size;s.glow=prefs.glow;s.trail=Math.min(prefs.trail,q.trail);
  if(!keepInk) inkClock+=delta*.001;
  renderer.render(s);paintOverlay();
  if(recording&&now-recording.last>=32) { compose(recording.target,false); recording.last=now; }
  if(!stageReady) { root.dataset.renderer=renderer.name; stageReady=true; }
  cpuSum+=performance.now()-started;frameCount++;frameSum+=delta;
  qualitySample(now);
  raf=requestAnimationFrame(animate);
}
function wake() {
  if(!raf&&renderer&&!document.hidden) {lastFrame=0;raf=requestAnimationFrame(animate);}
}
document.addEventListener("visibilitychange",()=>{
  if(document.hidden) {
    cancelAnimationFrame(raf);raf=0;
    if(sound) sound.context.suspend().catch(()=>{});
  } else {
    lastSample=0; frameCount=0; frameSum=0; cpuSum=0;
    if(sound&&prefs.sound) sound.context.resume().catch(()=>{});
    wake();
  }
});
addEventListener("pagehide",()=>{
  camera.stop();cancelAnimationFrame(raf);raf=0;
  if(recorder?.state==="recording") recorder.stop();
  if(sound) toggleSound(false);
});
addEventListener("pageshow",wake);

function pointerDown(e) {
  if(e.target.id!=="art"||e.button>1) return;
  e.target.setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,shift:e.shiftKey});
  if(pointers.size===2) {
    const [a,b]=pointers.values();
    pointerAnchor={span:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),angle:Math.atan2(b.y-a.y,b.x-a.x),zoom:zoomGoal,roll};
  } else pointerAnchor=null;
  if(prefs.mode==="draw") {inkBeforeX=NaN;addInk(e.clientX,e.clientY);}
}
function pointerMove(e) {
  const p=pointers.get(e.pointerId),x=e.clientX,y=e.clientY;
  if(!p&&e.target.id!=="art") return;
  sourceX=x;sourceY=y;
  if(pointers.size===2&&p&&pointerAnchor) {
    p.x=x;p.y=y;
    const [a,b]=pointers.values();
    zoomGoal=clamp(pointerAnchor.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pointerAnchor.span,.53,2.45);
    roll=pointerAnchor.roll-(Math.atan2(b.y-a.y,b.x-a.x)-pointerAnchor.angle);
    return;
  }
  if(prefs.mode==="draw") {if(p) addInk(x,y);}
  else if(prefs.mode==="flow"||prefs.mode==="vortex") forceGoal=p ? .85 : .58;
  else if(p) {
    const dx=x-p.x,dy=y-p.y;
    if(p.shift) {offsetGoalX+=dx;offsetGoalY+=dy;}
    else {yAngle+=dx*.009;xAngle=clamp(xAngle+dy*.009,-1.7,1.7);forceGoal=.24;}
  }
  if(p) {p.x=x;p.y=y;}
}
function pointerEnd(e) {
  const p=pointers.get(e.pointerId);
  if(!p) return;
  if(e.type==="pointerup"&&!pointerAnchor&&prefs.mode!=="draw"&&Math.hypot(e.clientX-p.sx,e.clientY-p.sy)<5) spreadGoal=spreadGoal>.5?0:1;
  pointers.delete(e.pointerId);pointerAnchor=null;inkBeforeX=NaN;forceGoal=0;
}
stage.addEventListener("pointerdown",pointerDown);
stage.addEventListener("pointermove",pointerMove);
stage.addEventListener("pointerup",pointerEnd);
stage.addEventListener("pointercancel",pointerEnd);
stage.addEventListener("lostpointercapture",pointerEnd);
stage.addEventListener("pointerleave",()=>{if(!pointers.size) forceGoal=0;});
stage.addEventListener("wheel",e=>{e.preventDefault();zoomGoal=clamp(zoomGoal*Math.exp(-e.deltaY*.0011),.53,2.45);},{passive:false});
function settings(open) {
  $("settings").hidden=!open;
  $("settingsButton").setAttribute("aria-expanded",open);
  if(open) $("closeSettings").focus();
}
function cinemaMode(next) {
  cinema=next;root.classList.toggle("cinema",next);
  $("cinemaButton").setAttribute("aria-pressed",next);
  $("cinemaButton").setAttribute("aria-label",next?"Exit cinematic mode":"Cinematic mode");
  settings(false);
  cinemaActivity();
}
function cinemaActivity() {
  root.classList.remove("cinema-idle");clearTimeout(idling);
  if(cinema) idling=setTimeout(()=>root.classList.add("cinema-idle"),2400);
}
addEventListener("pointermove",cinemaActivity,{passive:true});
addEventListener("pointerdown",cinemaActivity,{passive:true});
$("cinemaButton").onclick=()=>{cinemaMode(!cinema);$("cinemaButton").blur();};
$("settingsButton").onclick=()=>settings($("settings").hidden);
$("closeSettings").onclick=()=>{settings(false);$("settingsButton").focus();};
$("dismissIntro").onclick=()=>{prefs.intro=false;$("intro").hidden=true; persist();};
$("helpButton").onclick=()=>$("help").showModal();
$("doneHelp").onclick=$("closeHelp").onclick=()=>$("help").close();
async function fullscreen() {
  try {
    if(document.fullscreenElement) await document.exitFullscreen();
    else if(root.requestFullscreen&&document.fullscreenEnabled) await root.requestFullscreen();
    else if(root.webkitRequestFullscreen) root.webkitRequestFullscreen();
    else {cinemaMode(true);toast("Use your browser’s fullscreen or Home Screen mode for more space.");}
  } catch {toast("Fullscreen is unavailable. Cinematic mode is still available.");}
}
$("fullscreenButton").onclick=fullscreen;
addEventListener("keydown",e=>{
  if(e.key==="Escape"&&!$("help").open) {
    if(cinema) cinemaMode(false);
    else if(!$("settings").hidden) {settings(false);$("settingsButton").focus();}
    return;
  }
  if($("help").open||e.metaKey||e.ctrlKey||e.altKey||e.target instanceof HTMLElement&&e.target.matches("input,select,summary")) return;
  if(e.key==="ArrowLeft"||e.key==="ArrowRight") {e.preventDefault();changeScene(e.key==="ArrowLeft"?-1:1);}
  if(e.code==="Space"&&!e.repeat&&!(e.target instanceof HTMLButtonElement)) {e.preventDefault();spreadGoal=1;}
  if(e.key.toLowerCase()==="c") cinemaMode(!cinema);
  if(e.key.toLowerCase()==="f") fullscreen();
  if(e.key.toLowerCase()==="r") resetView();
  if(e.key==="?") $("help").showModal();
});
addEventListener("keyup",e=>{if(e.code==="Space"&&!(e.target instanceof HTMLButtonElement)) spreadGoal=0;});
function toggleSound(on) {
  if(!on) {
    if(sound) {
      const {context,nodes,gain}=sound;
      gain.gain.setTargetAtTime(0,context.currentTime,.04);
      setTimeout(()=>{nodes.forEach(node=>node.stop());context.close().catch(()=>{});},240);
      sound=undefined;
    }
    return;
  }
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio) {prefs.sound=false;syncPreferences();toast("Audio is unavailable in this browser.");return;}
  if(sound) return;
  const context=new Audio(),gain=context.createGain();
  gain.gain.value=0;gain.connect(context.destination);
  const nodes=[55,82.41,130.81].map((f,i)=>{
    const osc=context.createOscillator(); osc.frequency.value=f; osc.detune.value=i*1.7;
    osc.type="sine";osc.connect(gain);osc.start();return osc;
  });
  gain.gain.setTargetAtTime(.038,context.currentTime,.3);
  sound={context,nodes,gain};context.resume().catch(()=>{});
}
for(const input of document.querySelectorAll("[data-pref]")) {
  input.addEventListener("input",()=>{
    const key=input.dataset.pref,value=input.type==="checkbox"?input.checked:typeof defaults[key]==="number"?+input.value:input.value;
    if(key==="mode") {setMode(value);return;}
    prefs[key]=value;
    if(["theme","color","background"].includes(key)) theme();
    if(key==="quality") {autoTier=mobile?1:2; lowWindows=0;highWindows=0;resize();}
    if(key==="stage"&&value==="camera"&&!camera.active&&modelState!=="starting") camera.start();
    if(key==="stage"||key==="cameraLight") cameraView();
    if(key==="metrics") $("metrics").hidden=!value;
    if(key==="sound") toggleSound(value);
    clearTimeout(saveTimer); saveTimer=setTimeout(persist,130);
  });
}
$("resetButton").onclick=()=>{
  toggleSound(false);Object.assign(prefs,defaults,{intro:false});morph=0;
  autoTier=mobile?1:2;syncPreferences();setMode("sculpt",false);selectScene(specimens[0],false);resetView();
  cameraView();resize();toast("Studio settings reset.");
};

function compose(target,cameraBackground) {
  const g=target.getContext("2d"),w=target.width,h=target.height;
  const bg=themes[prefs.theme];
  g.fillStyle=bg.bg;g.fillRect(0,0,w,h);
  if(cameraBackground&&root.classList.contains("camera-view")&&video.readyState>=2) {
    const scale=Math.max(w/video.videoWidth,h/video.videoHeight);
    const vw=video.videoWidth*scale,vh=video.videoHeight*scale;
    g.save();g.globalAlpha=prefs.cameraLight;g.translate(w,0);g.scale(-1,1);g.drawImage(video,(w-vw)/2,(h-vh)/2,vw,vh);g.restore();
  }
  g.drawImage(renderer.canvas,0,0,w,h);g.drawImage(overlay,0,0,w,h);
}
function download(blob,ext) {
  if(!blob) {toast("The export did not complete.");return;}
  const a=document.createElement("a"),url=URL.createObjectURL(blob);
  a.href=url;a.download="flora-field-"+activeScene.id+"."+ext;
  a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
$("captureButton").onclick=()=>{
  if(!renderer) return;
  const target=document.createElement("canvas"),prev=state.dpr,dt=state.dt;
  const dpr=Math.min(2.5,4096/Math.max(state.w,state.h));
  try {
    fitBuffers(dpr,true);state.dt=.001;renderer.render(state);paintOverlay();
    target.width=renderer.canvas.width;target.height=renderer.canvas.height;
    compose(target,true);target.toBlob(blob=>download(blob,"png"),"image/png");
  } catch {toast("This browser could not export the artwork.");}
  finally {state.dt=dt;fitBuffers(prev,true);wake();}
};
const captureSupported=typeof MediaRecorder==="function"&&typeof HTMLCanvasElement.prototype.captureStream==="function";
if(!captureSupported) {
  $("recordButton").disabled=true;
  $("recordButton").title="Video recording is unavailable in this browser.";
}
$("recordButton").onclick=()=>{
  if(!captureSupported||!renderer) return;
  if(recorder?.state==="recording") {recorder.stop();return;}
  let stream;
  try {
    const target=document.createElement("canvas"),ratio=Math.min(1,1280/Math.max(state.w,state.h));
    target.width=Math.round(state.w*ratio);target.height=Math.round(state.h*ratio);
    stream=target.captureStream(30);
    const mime=["video/webm;codecs=vp9","video/webm","video/mp4"].find(format=>MediaRecorder.isTypeSupported(format));
    recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
    const chunks=[];
    recording={target,last:0};
    recorder.ondataavailable=e=>{if(e.data.size) chunks.push(e.data);};
    recorder.onerror=()=>toast("The browser could not finish recording.");
    recorder.onstop=()=>{
      clearTimeout(recordingTimer);recording=null;stream.getTracks().forEach(track=>track.stop());
      $("recordButton").setAttribute("aria-pressed","false");
      setText($("recordButton").lastChild,"Record");
      if(chunks.length) download(new Blob(chunks,{type:recorder.mimeType}),recorder.mimeType.includes("mp4")?"mp4":"webm");
    };
    recorder.start();
    $("recordButton").setAttribute("aria-pressed","true");
    setText($("recordButton").lastChild,"Stop");
    toast("Recording artwork for up to 15 seconds.");
    recordingTimer=setTimeout(()=>{if(recorder.state==="recording")recorder.stop();},15000);
  } catch { recording=null;stream?.getTracks().forEach(track=>track.stop());toast("Video recording is unavailable on this device."); }
};
selectScene(activeScene,true);syncPreferences();setMode(prefs.mode,false);cameraView();resize();wake();
if(!renderer) toast("Interactive graphics are unavailable. The gallery image is shown instead.");
