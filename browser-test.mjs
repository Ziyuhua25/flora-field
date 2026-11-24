import assert from "node:assert/strict";
import http from "node:http";
import {execFileSync} from "node:child_process";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve,extname} from "node:path";
import {chromium,webkit} from "playwright";

const baseline=execFileSync("git",["show","18d4f3fd822d379f31d67c1c23ed235b637b06f8:index.html"]);
const types={".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".svg":"image/svg+xml"};
const mount="/flora-field/";
const server=http.createServer(async(request,response)=>{
  const url=new URL(request.url,"http://localhost"),name=url.pathname.slice(mount.length)||"index.html";
  try {
    if(!url.pathname.startsWith(mount)||name.includes("/")||name.startsWith(".")) throw Error();
    const data=name==="baseline.html"?baseline:await readFile(resolve(name));
    response.writeHead(200,{"Content-Type":types[extname(name)]||"text/plain","Cache-Control":"no-store"});
    response.end(data);
  } catch {response.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const base="http://127.0.0.1:"+server.address().port+mount;
const chromiumBrowser=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
await mkdir("qa-results",{recursive:true});
const errors=[];
function watch(page) {page.on("pageerror",error=>errors.push(error.message));}
async function rendered(page,backend) {
  await page.locator("html[data-renderer]").waitFor({state:"attached"});
  if(backend) assert.equal(await page.locator("html").getAttribute("data-renderer"),backend);
}
async function checkLayout(page) {
  const geometry=await page.evaluate(()=>{
    const box=s=>document.querySelector(s).getBoundingClientRect(),w=innerWidth,h=innerHeight;
    const fits=b=>b.width>0&&b.height>0&&b.left>=-1&&b.top>=-1&&b.right<=w+1&&b.bottom<=h+1;
    const branding=box(".brand"), tools=box(".toolbar");
    const separate=branding.right<=tools.left+.5||branding.bottom<=tools.top+.5;
    const checks={art:fits(box("#art")),tools:fits(tools),branding:fits(branding),dock:fits(box(".dock-shell")),modes:fits(box(".modebar")),separate};
    return {w,h,good:Object.values(checks).every(Boolean),checks};
  });
  assert(geometry.good,JSON.stringify(geometry));
}
function initBench() {
  const original=requestAnimationFrame.bind(window);
  window.benchmarkRAF=original;
  window.frameWork=[];
  window.requestAnimationFrame=callback=>original(t=>{
    const then=performance.now();
    try { callback(t); } finally {
      if(window.collectFrames) window.frameWork.push(performance.now()-then);
    }
  });
}
async function sample(url) {
  const page=await chromiumBrowser.newPage({viewport:{width:1100,height:760},deviceScaleFactor:1});
  await page.addInitScript(initBench);
  watch(page);
  await page.goto(url);
  if(url.includes("benchmark")) await rendered(page,"WebGL 2");
  await page.waitForTimeout(700);
  const measurement=await page.evaluate(async()=>{
    const native=window.benchmarkRAF;
    const intervals=[];
    const start=performance.now();
    window.collectFrames=true;
    let prior=0;
    await new Promise(resolve=>{
      function tick(t) {
        if(prior) intervals.push(t-prior);
        prior=t;
        if(performance.now()-start<3200) native(t); else resolve();
      }
      native(tick);
    });
    window.collectFrames=false;
    const percentile=(list,n)=>{const sorted=[...list].sort((a,b)=>a-b);return +(sorted[Math.floor((sorted.length-1)*n)]||0).toFixed(2);};
    return {frames:intervals.length,fps:+(1000*intervals.length/intervals.reduce((a,b)=>a+b,0)).toFixed(1),p95IntervalMs:percentile(intervals,.95),p95FrameCallbackMs:percentile(window.frameWork,.95)};
  });
  await page.close();
  assert(measurement.frames>15);
  return measurement;
}
try {
  const page=await chromiumBrowser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
  watch(page);
  await page.goto(base); await rendered(page,"WebGL 2");
  assert.equal(await page.locator("#dock button").count(),19);
  assert.equal(await page.locator("#artTitle").innerText(),"Anatomy of a Bloom");
  const pixels=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
    const canvas=document.querySelector("#art"),gl=canvas.getContext("webgl2");
    const pix=new Uint8Array(canvas.width*canvas.height*4);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pix);
    let colors=0;
    for(let i=3;i<pix.length;i+=4) if(pix[i]>3) colors++;
    resolve({pixels:colors,error:gl.getError()});
  })));
  assert(pixels.pixels>1000&&pixels.error===0,JSON.stringify(pixels));
  await page.locator("#dismissIntro").click();
  for(const [width,height] of [[320,568],[390,844],[844,390],[507,1024],[768,1024],[1024,768],[1194,834],[1366,1024]]) {
    await page.setViewportSize({width,height});await checkLayout(page);
  }
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:"qa-results/desktop.png"});
  await page.getByRole("button",{name:"Christmas Tree",exact:true}).click();
  assert.match(await page.locator("#artTitle").innerText(),/Evergreen/);
  await page.getByRole("button",{name:"Morph",exact:true}).click();
  await page.locator("#morphSelect").selectOption("3");
  assert.equal(await page.locator("#morphSelect").inputValue(),"3");
  await page.getByRole("button",{name:"Draw",exact:true}).click();
  await page.mouse.move(500,450);await page.mouse.down();await page.mouse.move(800,500,{steps:20});await page.mouse.up();
  await page.locator("#keepInk").click();
  assert.equal(await page.locator("#keepInk").getAttribute("aria-pressed"),"true");
  await page.locator("#clearInk").click();
  await page.getByRole("button",{name:"Flow",exact:true}).click();
  await page.getByRole("button",{name:"Vortex",exact:true}).click();
  await page.locator("#cinemaButton").click();
  assert.equal(await page.locator("#cinemaButton").getAttribute("aria-pressed"),"true");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#cinemaButton").getAttribute("aria-pressed"),"false");
  await page.locator("#settingsButton").click();
  await page.locator('[data-pref="theme"]').selectOption("Porcelain");
  assert.equal(await page.locator("html").evaluate(html=>html.style.colorScheme),"light");
  const download=page.waitForEvent("download");
  await page.locator("#captureButton").click();
  assert.match((await download).suggestedFilename(),/\.png$/);
  if(await page.locator("#recordButton").isEnabled()) {
    await page.locator("#recordButton").click();
    await page.waitForTimeout(450);
    const clip=page.waitForEvent("download");
    await page.locator("#recordButton").click();
    assert.match((await clip).suggestedFilename(),/\.(mp4|webm)$/);
  }
  await page.locator("#closeSettings").click();
  await page.reload(); await rendered(page);
  assert.equal(await page.locator("html").evaluate(html=>html.style.colorScheme),"light");
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:"qa-results/phone.png"});
  await page.close();

  const denied=await chromiumBrowser.newPage();
  watch(denied);
  await denied.addInitScript(()=>{
    Object.defineProperty(navigator,"mediaDevices",{value:{getUserMedia:()=>Promise.reject(new DOMException("Test","NotAllowedError"))}});
  });
  await denied.goto(base);await rendered(denied);
  await denied.locator("#cameraButton").click();
  await denied.waitForFunction(()=>document.querySelector("#toast").textContent.includes("permission was denied"));
  assert.equal(await denied.locator("#cameraButton").getAttribute("aria-pressed"),"false");
  await denied.close();

  const fake=await chromiumBrowser.newPage();
  watch(fake);
  await fake.addInitScript(()=>{
    const make=()=>{
      const c=document.createElement("canvas");c.width=640;c.height=480;
      const g=c.getContext("2d");const stream=c.captureStream(24);
      let paint=0;
      const timer=setInterval(()=>{
        if(stream.getTracks()[0].readyState==="ended") return clearInterval(timer);
        g.fillStyle=paint++%2?"#506070":"#406050";g.fillRect(0,0,640,480);
      },42);
      window.qaStream=stream;
      return stream;
    };
    Object.defineProperty(navigator,"mediaDevices",{value:{getUserMedia:async()=>make()}});
    window.Hands=class {
      setOptions(){}
      onResults(callback){this.callback=callback;}
      async send(){
        const p=Array.from({length:21},()=>({x:.5,y:.54,z:0}));
        p[0]={x:.5,y:.8,z:0};
        [8,12,16,20].forEach(i=>{p[i]={x:.5,y:.22,z:0};});
        this.callback({multiHandLandmarks:[p]});
      }
      async close(){window.qaClosed=true;}
    };
  });
  await fake.goto(base);await rendered(fake);
  assert.equal(await fake.locator("#cameraButton").getAttribute("aria-pressed"),"false");
  await fake.locator("#cameraButton").click();
  await fake.waitForFunction(()=>document.querySelector("#handState").textContent.includes("Open"));
  await fake.locator("#cameraButton").click();
  await fake.waitForFunction(()=>window.qaClosed&&window.qaStream.getTracks().every(t=>t.readyState==="ended"));
  await fake.close();

  const fallback=await chromiumBrowser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  watch(fallback);
  await fallback.goto(base+"?renderer=canvas");await rendered(fallback,"Canvas 2D");await checkLayout(fallback);
  await fallback.getByRole("button",{name:"Jellyfish",exact:true}).tap();
  assert.equal(await fallback.locator("#artTitle").innerText(),"The Drifting Bell");
  await fallback.close();

  const measurements={environment:"GitHub Actions Linux · Playwright Chromium with SwiftShader · 1100 × 760 · DPR 1 · 4,800 particles · no camera · 3.2 s sample",previous:await sample(base+"baseline.html"),upgrade:await sample(base+"?benchmark=4800")};
  console.log(JSON.stringify(measurements,null,2));
  await writeFile("qa-results/benchmark.json",JSON.stringify(measurements,null,2));
  if(process.env.GITHUB_STEP_SUMMARY) {
    const row=(name,m)=>"| "+name+" | "+m.fps+" | "+m.p95IntervalMs+" ms | "+m.p95FrameCallbackMs+" ms |";
    await writeFile(process.env.GITHUB_STEP_SUMMARY,measurements.environment+"\n\n| Version | FPS | p95 frame interval | p95 callback CPU |\n|---|---:|---:|---:|\n"+row("1.x Canvas 2D",measurements.previous)+"\n"+row("2.0 WebGL 2",measurements.upgrade)+"\n",{flag:"a"});
  }

  const webkitBrowser=await webkit.launch();
  try {
    const phone=await webkitBrowser.newPage({viewport:{width:390,height:844},hasTouch:true});
    watch(phone);
    await phone.goto(base);await rendered(phone);await checkLayout(phone);
    await phone.getByRole("button",{name:"Saturn",exact:true}).tap();
    assert.equal(await phone.locator("#artName").innerText(),"Saturn");
    await phone.setViewportSize({width:1024,height:768});await checkLayout(phone);
    await phone.locator("#settingsButton").tap();
    assert(await phone.locator("#settings").isVisible());
    console.log("WebKit renderer:",await phone.locator("html").getAttribute("data-renderer"));
  } finally {await webkitBrowser.close();}
  assert.deepEqual(errors,[]);
  console.log("Chromium, mobile touch fallback, viewport checks, export, camera rejection, camera mock, and WebKit passed.");
} finally {
  await chromiumBrowser.close();
  server.close();
}
