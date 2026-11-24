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
async function visibleField(page) {
  return page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
    const art=document.querySelector("#art"), gl=art.getContext("webgl2");
    const program=gl.getParameter(gl.CURRENT_PROGRAM);
    const width=art.width,height=art.height;
    const size=Math.floor(Math.min(width,height)*.3);
    const origin=gl.getUniform(program,gl.getUniformLocation(program,"origin"));
    const viewport=gl.getUniform(program,gl.getUniformLocation(program,"viewport"));
    const left=Math.max(0,Math.min(width-size,Math.round(origin[0]*width/viewport[0]-size/2)));
    const bottom=Math.max(0,Math.min(height-size,Math.round(height-origin[1]*height/viewport[1]-size/2)));
    const data=new Uint8Array(size*size*4);
    gl.readPixels(left,bottom,size,size,gl.RGBA,gl.UNSIGNED_BYTE,data);
    let points=0;
    for(let i=3;i<data.length;i+=4) if(data[i]>8) points++;
    resolve({points,angles:Array.from(gl.getUniform(program,gl.getUniformLocation(program,"angles"))),error:gl.getError()});
  })));
}
function initBench() {
  const original=requestAnimationFrame.bind(window);
  const work=[],intervals=[];
  let start, previous;
  window.requestAnimationFrame=callback=>original(t=>{
    const then=performance.now();
    try { callback(t); } finally {
      start??=t;
      if(!window.floraMetrics&&t-start>=900) {
        if(previous!==undefined) intervals.push(t-previous);
        previous=t;
        work.push(performance.now()-then);
        if(t-start>=4100) {
          const percentile=list=>{
            const sorted=[...list].sort((a,b)=>a-b);
            return +(sorted[Math.floor((sorted.length-1)*.95)]||0).toFixed(2);
          };
          window.floraMetrics={
            frames:intervals.length,
            fps:+(1000*intervals.length/intervals.reduce((a,b)=>a+b,0)).toFixed(1),
            p95IntervalMs:percentile(intervals),p95FrameCallbackMs:percentile(work),
          };
        }
      }
    }
  });
}
async function sample(url) {
  const bench=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
  try {
    const page=await bench.newPage({viewport:{width:1100,height:760},deviceScaleFactor:1});
    page.on("crash",()=>console.error("Benchmark browser page crashed.",url));
    await page.addInitScript(initBench);
    watch(page);
    await page.goto(url,{waitUntil:"load"});
    if(url.includes("benchmark")) await rendered(page,"WebGL 2");
    await page.waitForFunction(()=>Boolean(window.floraMetrics),null,{timeout:20000});
    const measurement=await page.evaluate(()=>window.floraMetrics);
    assert(measurement.frames>15);
    return measurement;
  } finally {await bench.close();}
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
  assert.equal(await page.locator("#introTitle").innerText(),"Try the particle field");
  await page.locator("#art").click({position:{x:700,y:395}});
  assert.equal(await page.locator("#introTitle").innerText(),"Choose a new shape");
  await page.getByRole("button",{name:"Christmas Tree",exact:true}).click();
  assert.equal(await page.locator("#introTitle").innerText(),"Make the scene yours");
  await page.locator("#nextIntro").click();
  assert.equal(await page.locator("#intro").isVisible(),false);
  await page.locator("#helpButton").click();
  await page.locator("#replayIntro").click();
  assert.equal(await page.locator("#introTitle").innerText(),"Try the particle field");
  await page.locator("#dismissIntro").click();
  await page.getByRole("button",{name:"Flower",exact:true}).click();
  const front=await visibleField(page);
  await page.waitForTimeout(280);
  const resting=await visibleField(page);
  assert(Math.abs(resting.angles[1]-front.angles[1])<.03,"The bloom rotates while idle");
  await page.mouse.move(650,365);
  await page.mouse.down();
  await page.mouse.move(825,365,{steps:10});
  await page.mouse.up();
  await page.waitForTimeout(280);
  const side=await visibleField(page);
  assert(side.angles[1]-resting.angles[1]>1.1&&side.points>300&&side.error===0,JSON.stringify(side));
  await page.keyboard.press("r");
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

  const bilingual=await chromiumBrowser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
  watch(bilingual);
  await bilingual.goto(base+"?lang=zh"); await rendered(bilingual);
  assert.equal(await bilingual.locator("html").getAttribute("lang"),"zh-CN");
  assert.equal(await bilingual.locator("#introTitle").innerText(),"试试粒子画布");
  await checkLayout(bilingual);
  await bilingual.locator("#dismissIntro").click();
  await bilingual.getByRole("button",{name:"圣诞树",exact:true}).click();
  assert.equal(await bilingual.locator("#artTitle").innerText(),"常青的愿望");
  await bilingual.getByRole("button",{name:"设置",exact:true}).click();
  await bilingual.getByLabel("场景背景").selectOption("photo");
  await bilingual.locator("#photoFile").setInputFiles("share.png");
  await bilingual.waitForFunction(()=>document.documentElement.classList.contains("photo-view")&&document.querySelector("#photo").naturalWidth>0);
  assert.match(await bilingual.locator("#photo").getAttribute("src"),/^blob:/);
  const brightness=bilingual.getByLabel("照片亮度");
  await brightness.press("Home");
  for(let i=0;i<5;i++) await brightness.press("ArrowRight");
  assert.match(await bilingual.locator("html").getAttribute("style"),/--photo-light: 0.4/);
  await bilingual.locator("#removePhoto").click();
  assert.equal(await bilingual.locator("#photo").getAttribute("src"),null);
  assert.equal(await bilingual.locator("html").evaluate(el=>el.classList.contains("photo-view")),false);
  await bilingual.locator("#closeSettings").click();
  await bilingual.locator("#languageButton").click();
  assert.equal(await bilingual.locator("html").getAttribute("lang"),"en");
  assert.equal(await bilingual.locator("#artName").innerText(),"Christmas Tree");
  assert.equal(new URL(bilingual.url()).searchParams.get("lang"),"en");
  await bilingual.reload(); await rendered(bilingual);
  assert.equal(await bilingual.locator("html").getAttribute("lang"),"en");
  await bilingual.close();

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
    window.qaHandVisible=true;
    window.Hands=class {
      setOptions(){}
      onResults(callback){this.callback=callback;}
      async send(){
        const p=Array.from({length:21},()=>({x:.5,y:.54,z:0}));
        p[0]={x:.5,y:.8,z:0};p[4]={x:.21,y:.38,z:0};
        [8,12,16,20].forEach(i=>{p[i]={x:.5,y:.22,z:0};});
        this.callback({multiHandLandmarks:window.qaHandVisible?[p]:[]});
      }
      async close(){window.qaClosed=true;}
    };
  });
  await fake.goto(base);await rendered(fake);
  assert.equal(await fake.locator("#cameraButton").getAttribute("aria-pressed"),"false");
  await fake.locator("#settingsButton").click();
  await fake.getByLabel("Scene background").selectOption("camera");
  await fake.waitForFunction(()=>document.querySelector("#handState").textContent.includes("Open"));
  assert.equal(await fake.locator("html").evaluate(el=>el.classList.contains("camera-view")),true);
  await fake.locator("#closeSettings").click();
  await fake.getByRole("button",{name:"Morph",exact:true}).click();
  await fake.waitForFunction(()=>document.querySelector("#morphSelect").value==="5");
  await fake.evaluate(()=>window.qaHandVisible=false);
  for(let i=0;i<7;i++) {
    const field=await visibleField(fake);
    assert(field.points>170&&field.error===0,"Particles disappeared during hand-loss recovery: "+JSON.stringify(field));
    await fake.waitForTimeout(65);
  }
  await fake.waitForFunction(()=>document.querySelector("#morphSelect").value==="0"&&document.querySelector("#handState").textContent==="Show a hand");
  assert.equal(await fake.locator("#artName").innerText(),"Flower");
  await fake.evaluate(()=>window.qaHandVisible=true);
  await fake.waitForFunction(()=>document.querySelector("#morphSelect").value==="5");
  assert((await visibleField(fake)).points>170);
  await fake.locator("#cameraButton").click();
  await fake.waitForFunction(()=>window.qaClosed&&window.qaStream.getTracks().every(t=>t.readyState==="ended"));
  await fake.close();

  const fallback=await chromiumBrowser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  watch(fallback);
  await fallback.goto(base+"?renderer=canvas");await rendered(fallback,"Canvas 2D");await checkLayout(fallback);
  await fallback.getByRole("button",{name:"Jellyfish",exact:true}).tap();
  assert.equal(await fallback.locator("#artTitle").innerText(),"The Drifting Bell");
  await fallback.close();

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
  await chromiumBrowser.close();
  const measurements={environment:"GitHub Actions Linux · Playwright Chromium with SwiftShader · 1100 × 760 · DPR 1 · 4,800 particles · no camera · 3.2 s sample",previous:await sample(base+"baseline.html"),upgrade:await sample(base+"?benchmark=4800")};
  console.log(JSON.stringify(measurements,null,2));
  await writeFile("qa-results/benchmark.json",JSON.stringify(measurements,null,2));
  if(process.env.GITHUB_STEP_SUMMARY) {
    const row=(name,m)=>"| "+name+" | "+m.fps+" | "+m.p95IntervalMs+" ms | "+m.p95FrameCallbackMs+" ms |";
    await writeFile(process.env.GITHUB_STEP_SUMMARY,measurements.environment+"\n\n| Version | FPS | p95 frame interval | p95 callback CPU |\n|---|---:|---:|---:|\n"+row("1.x Canvas 2D",measurements.previous)+"\n"+row("2.0 WebGL 2",measurements.upgrade)+"\n",{flag:"a"});
  }

  assert.deepEqual(errors,[]);
  console.log("Chromium, mobile touch fallback, viewport checks, export, camera rejection, camera mock, and WebKit passed.");
} finally {
  await chromiumBrowser.close();
  server.close();
}
