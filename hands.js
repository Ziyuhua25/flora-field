import { clamp } from "./renderer.js";

const MODEL = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/";
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const wrapped = angle => Math.atan2(Math.sin(angle),Math.cos(angle));

export function mirroredPoint(x,y,sourceWidth,sourceHeight,width,height) {
  const scale=Math.max(width/sourceWidth,height/sourceHeight);
  return {
    x: (1-x)*sourceWidth*scale-(sourceWidth*scale-width)/2,
    y: y*sourceHeight*scale-(sourceHeight*scale-height)/2,
  };
}

export function describePose(points) {
  const palm=Math.max(.018,distance(points[0],points[9]));
  const openness=[8,12,16,20].map(tip=>clamp((distance(points[tip],points[0])-distance(points[tip-2],points[0]))/palm*3.5,0,1));
  const thumb=distance(points[4],points[5])/palm>.58&&distance(points[4],points[0])>distance(points[3],points[0])*1.04;
  const fingers=openness.filter(n=>n>.42).length;
  const pinch=distance(points[4],points[8])/palm;
  return {
    count:fingers+Number(thumb),
    fingers,
    extent:openness.reduce((a,b)=>a+b,0)/4,
    pinch,
    indexOnly:openness[0]>.45&&openness.slice(1).every(n=>n<.37),
  };
}

export function gestureTracker() {
  let hands=[], nowBefore=0, palmBefore, speed=0, pulseBefore=-5000, stable="idle", pending="idle", since=0;
  let doubleReference=null, doubleMode="pair";
  let morph=0, pendingMorph=0, morphSince=0;
  const settle=(gesture,now,delay=100)=>{
    if(gesture!==pending) { pending=gesture; since=now; }
    if(now-since>=delay) stable=pending;
    return stable;
  };
  return {
    reset() {
      hands=[]; nowBefore=0; palmBefore=undefined; speed=0; stable="idle"; pending="idle";
      doubleReference=null; doubleMode="pair"; morph=0; pendingMorph=0; morphSince=0;
    },
    update(input,now,sensitivity,morphMode,labels=[]) {
      if(!input.length) return null;
      const step=nowBefore?clamp(now-nowBefore,10,100):45;
      nowBefore=now;
      let order=input.map((p,i)=>({p,label:labels[i]||"",x:p[0].x}));
      order.sort((a,b)=>a.label&&b.label?a.label.localeCompare(b.label):a.x-b.x);
      if(hands.length!==order.length) {
        hands=order.map(entry=>entry.p.map(p=>({...p})));
        palmBefore=undefined; speed=0; doubleReference=null; doubleMode="pair";
      } else {
        const a=1-Math.exp(-step/(43-(sensitivity-.5)*17));
        order.forEach((entry,i)=>entry.p.forEach((p,j)=>{
          hands[i][j].x+=(p.x-hands[i][j].x)*a;
          hands[i][j].y+=(p.y-hands[i][j].y)*a;
          hands[i][j].z+=(p.z-hands[i][j].z)*a;
        }));
      }
      const first=hands[0], pose=describePose(first), palm=first[9];
      const measured=palmBefore?distance(palm,palmBefore)*1000/step:0;
      palmBefore={x:palm.x,y:palm.y};
      speed+=(measured-speed)*.56;
      if(morphMode) {
        if(pendingMorph!==pose.count) { pendingMorph=pose.count; morphSince=now; }
        if(now-morphSince>=195) morph=pendingMorph;
        return {kind:"morph",x:palm.x,y:palm.y,morph,extent:pose.extent};
      }
      if(hands.length===2&&!(pose.fingers===0&&describePose(hands[1]).fingers===0)) {
        const other=hands[1][9], span=Math.max(.04,distance(palm,other)), angle=Math.atan2(other.y-palm.y,other.x-palm.x);
        if(!doubleReference) doubleReference={span,angle};
        const ratio=span/doubleReference.span;
        const turn=wrapped(angle-doubleReference.angle);
        const zoom=Math.abs(Math.log(ratio)), rotate=Math.abs(turn)*.82;
        if(doubleMode==="pair"&&Math.max(zoom,rotate)>.09) doubleMode=zoom>rotate?"zoom":"rotate";
        const kind=settle(doubleMode,now,90);
        return {kind:kind==="zoom"||kind==="rotate"?kind:"pair",x:(palm.x+other.x)/2,y:(palm.y+other.y)/2,ratio,turn,extent:pose.extent,speed};
      }
      doubleReference=null; doubleMode="pair";
      const threshold=(stable==="pinch"?.38:.28)+(sensitivity-.5)*.12;
      const pinching=pose.pinch<threshold&&pose.fingers>=1;
      let next=pinching?"pinch":pose.indexOnly?"point":pose.fingers>=3?"open":pose.fingers===0?"fist":"idle";
      next=settle(next,now,next==="pinch"?75:108);
      if(next==="open"&&speed>2.2-sensitivity*.76&&now-pulseBefore>700) {
        pulseBefore=now;
        return {kind:"wave",x:palm.x,y:palm.y,extent:pose.extent,speed};
      }
      const tip=next==="point"?first[8]:next==="pinch"?{x:(first[8].x+first[4].x)/2,y:(first[8].y+first[4].y)/2}:palm;
      return {kind:next,x:tip.x,y:tip.y,extent:pose.extent,speed};
    },
  };
}

let loadingScript;
function loadModel() {
  if(window.Hands) return Promise.resolve(window.Hands);
  if(!loadingScript) loadingScript=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src=MODEL+"hands.js"; script.crossOrigin="anonymous";
    const timer=setTimeout(()=>finish(Error("The hand model timed out.")),15000);
    function finish(error) {
      clearTimeout(timer); script.onload=null; script.onerror=null;
      if(error) { script.remove(); reject(error); }
      else resolve(window.Hands);
    }
    script.onload=()=>finish(window.Hands?null:Error("The hand model did not initialize."));
    script.onerror=()=>finish(Error("The hand model could not be downloaded."));
    document.head.append(script);
  }).catch(error=>{ loadingScript=undefined; throw error; });
  return loadingScript;
}

export function createCamera(video,onState,onHands,frequency) {
  let model,stream,pump,epoch=0,starting=false,active=false,busy=false,modelEnabled=false,lastTime=-1;
  const inferenceCanvas=document.createElement("canvas");
  const context=inferenceCanvas.getContext("2d",{alpha:false});
  function stop(report=true) {
    epoch++;
    clearTimeout(pump);
    active=false; starting=false; modelEnabled=false; lastTime=-1;
    if(stream) stream.getTracks().forEach(track=>track.stop());
    stream=undefined; video.srcObject=null;
    const old=model; model=undefined;
    if(old&&!busy) Promise.resolve().then(()=>old.close()).catch(()=>{});
    if(report) onState("off");
  }
  async function infer(run) {
    if(run!==epoch||!active||!model) return;
    if(!document.hidden&&!busy&&video.readyState>=2&&video.currentTime!==lastTime) {
      const engine=model;
      busy=true;
      try {
        lastTime=video.currentTime;
        const width=Math.min(416,video.videoWidth);
        const height=Math.max(1,Math.round(video.videoHeight*width/video.videoWidth));
        if(inferenceCanvas.width!==width||inferenceCanvas.height!==height) {
          inferenceCanvas.width=width; inferenceCanvas.height=height;
        }
        context.drawImage(video,0,0,width,height);
        await engine.send({image:inferenceCanvas});
      } catch(error) {
        if(run===epoch) {
          modelEnabled=false; model=undefined; onState("preview","Hand tracking stopped. Touch and mouse are available.");
        }
      } finally {
        busy=false;
        if(engine!==model) Promise.resolve().then(()=>engine.close()).catch(()=>{});
      }
    }
    if(run===epoch&&active&&model) pump=setTimeout(()=>infer(run),Math.max(3,Math.round(1000/frequency())));
  }
  async function start() {
    if(active||starting) { stop(); return; }
    if(!navigator.mediaDevices?.getUserMedia) { onState("off","Camera access requires an HTTPS page and a compatible browser."); return; }
    const run=++epoch;
    starting=true; onState("starting");
    try {
      const media=await navigator.mediaDevices.getUserMedia({
        audio:false,video:{facingMode:"user",width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}},
      });
      if(run!==epoch) { media.getTracks().forEach(track=>track.stop()); return; }
      stream=media; video.srcObject=media;
      media.getVideoTracks()[0]?.addEventListener("ended",()=>{if(run===epoch) stop();},{once:true});
      await video.play();
      if(run!==epoch) return;
      active=true; onState("preview");
      try {
        const Hands=await loadModel();
        if(run!==epoch) return;
        model=new Hands({locateFile:file=>MODEL+file});
        model.setOptions({maxNumHands:2,modelComplexity:0,minDetectionConfidence:.62,minTrackingConfidence:.59});
        model.onResults(result=>{
          if(run===epoch&&modelEnabled) onHands(result.multiHandLandmarks||[],(result.multiHandedness||[]).map(hand=>hand.label));
        });
        modelEnabled=true; onState("tracking");
        infer(run);
      } catch(error) {
        if(run===epoch) onState("preview",error.message+" Touch and mouse are available.");
      }
    } catch(error) {
      if(run===epoch) {
        stop(false);
        onState("off",error.name==="NotAllowedError"?"Camera permission was denied. You can still use touch and mouse.":"Camera is unavailable. You can still use touch and mouse.");
      }
    } finally {
      if(run===epoch) starting=false;
    }
  }
  return {start,stop,get active(){return active;}};
}
