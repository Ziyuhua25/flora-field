export const MAX_POINTS = 32000;
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const rgb = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16) / 255);

const SIM = [
  '#version 300 es',
  'precision highp float;',
  'layout(location=0) in vec3 position;',
  'layout(location=1) in vec3 velocity;',
  'layout(location=2) in vec4 goal;',
  'out vec3 nextPosition; out vec3 nextVelocity;',
  'uniform float dt, clock, damping, spread, movement, localForce, radius, pulse, morph, recovery;',
  'uniform int mode, animation, anchored;',
  'uniform vec3 hand, impulseOrigin;',
  'vec2 rot(vec2 p, float a) { float s=sin(a), c=cos(a); return mat2(c,s,-s,c)*p; }',
  'void main() {',
  '  float seed=fract(sin(float(gl_VertexID)*12.9898)*43758.5453);',
  '  float t=clock*movement;',
  '  vec3 g=goal.xyz;',
  '  if (morph<0.5) {',
  '    if(animation==1) { g *= 1.0+.055*sin(t*1.25); g.z+=.045*sin(t*1.8+g.x*5.0+g.y*3.0); }',
   '    if(animation==2) {',
  '      if(gl_VertexID%31==0) { g.y=1.42-mod(1.42-g.y+t*.16,2.84); g.x+=.08*sin(t+seed*22.0); }',
  '      else g.xz=rot(g.xz,.08*sin(t));',
  '    }',
  '    if(animation==3) { g.xy=rot(g.xy,.11*sin(t*.32+length(g.xy)*2.0)); }',
  '    if(animation==4) { g.z+=abs(g.x)*.42*sin(t*2.8); g.x*=.87+.13*cos(t*2.8); }',
  '    if(animation==5) { g.x+=.12*sin(t*1.7+g.y*4.7)*(1.0-smoothstep(-1.1,.3,g.y)); g.y+=.09*sin(t*1.3); }',
  '    if(animation==6) { g.y+=.13*sin(g.x*3.0+t*1.5+g.z*2.0); g.z+=.085*cos(g.x*4.0+t*1.1); }',
  '    if(animation==7) { float cycle=fract(t*.24+floor(seed*3.0)*.11); g.xy*=.76+.26*smoothstep(.0,.40,cycle); g.y-=.16*cycle*cycle; }',
  '    if(animation==8) { g.y+=.13*sin(g.x*3.0-t*1.6); g.z+=.14*cos(g.x*3.0-t*1.2); }',
  '  }',
  '  vec3 noise=vec3(sin(seed*71.0+t*.68),cos(seed*99.0+t*.66),sin(seed*47.0+t*.36));',
  '  float anchor=(anchored!=0&&gl_VertexID%7==0) ? .28 : 1.0;',
  '  float scatter=spread*anchor;',
  '  g=g*(1.0+scatter*.34)+noise*(scatter*.76+.009*movement);',
  '  float spring=((mode==1||mode==2) ? .028 : .053)+recovery*.052;',
  '  vec3 acceleration=(g-position)*spring;',
  '  vec3 delta=hand-position;',
  '  float d2=dot(delta,delta);',
  '  float falloff=pow(max(0.0,1.0-d2/(radius*radius)),2.0)*anchor;',
  '  if(mode==1) {',
  '    vec3 curl=vec3(sin(position.y*3.6-t),cos(position.x*3.7+t),sin(position.x*2.2+position.y*2.1+t*.5));',
  '    acceleration+=(curl*.05+delta*.20)*falloff*localForce+curl*spread*.023;',
  '  } else if(mode==2) {',
  '    vec3 swirl=vec3(delta.y,-delta.x,delta.y*.25);',
  '    acceleration+=(swirl*.48+delta*.12)*falloff*localForce;',
  '  } else { acceleration+=delta*.36*falloff*localForce; }',
  '  vec3 away=position-impulseOrigin;',
  '  float waveDistance=length(away);',
  '  float wave=max(0.0,1.0-abs(waveDistance-(1.0-pulse)*2.8)*2.0);',
  '  acceleration+=away/(.16+waveDistance)*pulse*wave*.16*anchor;',
  '  nextVelocity=clamp((velocity+acceleration*dt)*pow(damping,dt),vec3(-.48),vec3(.48));',
  '  nextPosition=position+nextVelocity*dt;',
  '  gl_Position=vec4(0.0);',
  '}'
].join('\n');

const VERTEX = [
  '#version 300 es',
  'precision highp float;',
  'layout(location=0) in vec3 position;',
  'layout(location=1) in vec3 velocity;',
  'layout(location=2) in vec4 goal;',
  'uniform vec2 viewport, origin;',
  'uniform vec3 angles, lowColor, midColor, highColor;',
  'uniform float scale, dotSize, pixelRatio, clock, glow, tail;',
  'uniform int animation;',
  'out vec4 color;',
  'vec2 rot(vec2 p, float a) { float s=sin(a),c=cos(a); return mat2(c,s,-s,c)*p; }',
  'void main() {',
  '  vec3 p=position-velocity*tail;',
  '  p.xz=rot(p.xz,angles.y); p.yz=rot(p.yz,angles.x); p.xy=rot(p.xy,angles.z);',
  '  float depth=5.0/max(2.6,5.0-p.z);',
  '  vec2 screen=origin+vec2(p.x,-p.y)*scale*depth;',
  '  gl_Position=vec4(screen.x/viewport.x*2.0-1.0,1.0-screen.y/viewport.y*2.0,0.0,1.0);',
  '  float seed=fract(sin(float(gl_VertexID)*12.9898)*43758.5453);',
  '  float sparkle=pow(.5+.5*sin(clock*1.55+seed*46.0),8.0);',
  '  float heat=goal.w;',
  '  vec3 tint=mix(mix(lowColor,midColor,smoothstep(.05,.58,heat)),highColor,smoothstep(.55,1.0,heat));',
  '  float star=.72+.28*depth;',
   '  if(animation==2&&heat>.85) star *= .66+.65*sparkle;',
  '  if(animation==2&&gl_VertexID%31==0) star *= .46*(1.0-smoothstep(1.12,1.43,abs(position.y)));',
  '  if(animation==7) star *= 1.05-.48*fract(clock*.24+floor(seed*3.0)*.11);',
  '  float alpha=clamp((.34+heat*.45+sparkle*.17)*star,.07,.96);',
  '  color=vec4(tint,alpha*(tail>.1 ? .20 : 1.0));',
  '  gl_PointSize=clamp(dotSize*pixelRatio*depth*(.73+seed*.58)*(1.55+glow*.55),1.1,18.0);',
  '}'
].join('\n');

const FRAGMENT = [
  '#version 300 es',
  'precision highp float;',
  'in vec4 color; out vec4 pixel;',
  'uniform float glow;',
  'void main() {',
  '  float d=length(gl_PointCoord-.5)*2.0;',
  '  float core=1.0-smoothstep(.12,.78,d);',
  '  float halo=exp(-d*d*6.4)*(1.0-smoothstep(.55,1.0,d));',
  '  pixel=vec4(color.rgb,color.a*(core*.84+halo*glow*.30));',
  '}'
].join('\n');
const DISCARD = '#version 300 es\nprecision mediump float; out vec4 pixel; void main(){pixel=vec4(0.0);}';

function program(gl, v, f, feedback) {
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw Error(message);
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER,v), fragment = compile(gl.FRAGMENT_SHADER,f);
  const p = gl.createProgram();
  gl.attachShader(p,vertex); gl.attachShader(p,fragment);
  if (feedback) gl.transformFeedbackVaryings(p,["nextPosition","nextVelocity"],gl.INTERLEAVED_ATTRIBS);
  gl.linkProgram(p);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(p,gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw Error(message);
  }
  return p;
}

function uniforms(gl,p,names) {
  return Object.fromEntries(names.split(" ").map(key => [key,gl.getUniformLocation(p,key)]));
}

function gpu(canvas) {
  const gl = canvas.getContext("webgl2", { alpha:true, antialias:false, depth:false, stencil:false, premultipliedAlpha:true, powerPreference:"high-performance" });
  if (!gl) throw Error("WebGL 2 is unavailable");
  const sim = program(gl,SIM,DISCARD,true), paint = program(gl,VERTEX,FRAGMENT,false);
  const su = uniforms(gl,sim,"dt clock damping spread movement localForce radius pulse morph recovery mode animation anchored hand impulseOrigin");
  const pu = uniforms(gl,paint,"viewport origin angles lowColor midColor highColor scale dotSize pixelRatio clock glow tail animation");
  const goals = gl.createBuffer(), feedback = gl.createTransformFeedback();
  const buffers = [gl.createBuffer(),gl.createBuffer()];
  gl.bindBuffer(gl.ARRAY_BUFFER,goals);
  gl.bufferData(gl.ARRAY_BUFFER,MAX_POINTS*16,gl.STATIC_DRAW);
  const vaos = buffers.map(state => {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,state);
    gl.bufferData(gl.ARRAY_BUFFER,MAX_POINTS*24,gl.DYNAMIC_COPY);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
    gl.bindBuffer(gl.ARRAY_BUFFER,goals);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,4,gl.FLOAT,false,16,0);
    gl.bindVertexArray(null);
    return vao;
  });
  let read = 0;
  const scalar = (location,value) => gl.uniform1f(location,value);
  const api = {
    name:"WebGL 2",
    canvas,
    targets(data, reset) {
      gl.bindBuffer(gl.ARRAY_BUFFER,goals);
      gl.bufferSubData(gl.ARRAY_BUFFER,0,data);
      if (!reset) { gl.bindBuffer(gl.ARRAY_BUFFER,null); return; }
      const state = new Float32Array(MAX_POINTS*6);
      for (let i=0;i<MAX_POINTS;i++) {
        state[i*6]=data[i*4]*.88; state[i*6+1]=data[i*4+1]*.88; state[i*6+2]=data[i*4+2]*.88;
      }
      for (const buffer of buffers) {
        gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER,0,state);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER,null);
    },
    render(s) {
      const count = Math.min(MAX_POINTS,s.count);
      gl.disable(gl.BLEND);
      gl.useProgram(sim);
      scalar(su.dt,s.dt); scalar(su.clock,s.time); scalar(su.damping,s.damping);
      scalar(su.spread,s.spread); scalar(su.movement,s.movement); scalar(su.localForce,s.force);
      scalar(su.radius,s.radius); scalar(su.pulse,s.pulse); scalar(su.morph,s.morph); scalar(su.recovery,s.recovery);
      gl.uniform1i(su.mode,s.mode); gl.uniform1i(su.animation,s.animation); gl.uniform1i(su.anchored,Number(s.anchored));
      gl.uniform3fv(su.hand,s.hand); gl.uniform3fv(su.impulseOrigin,s.impulse);
      gl.bindVertexArray(vaos[read]);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,buffers[1-read]);
      gl.enable(gl.RASTERIZER_DISCARD);
      gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS,0,count);
      gl.endTransformFeedback();
      gl.disable(gl.RASTERIZER_DISCARD);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);
      read=1-read;
      gl.viewport(0,0,canvas.width,canvas.height);
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(paint);
      gl.uniform2f(pu.viewport,s.w,s.h); gl.uniform2f(pu.origin,s.cx,s.cy);
      gl.uniform3fv(pu.angles,s.angles); gl.uniform3fv(pu.lowColor,s.colors[0]);
      gl.uniform3fv(pu.midColor,s.colors[1]); gl.uniform3fv(pu.highColor,s.colors[2]);
      gl.uniform1i(pu.animation,s.animation);
      scalar(pu.scale,s.scale); scalar(pu.dotSize,s.dot); scalar(pu.pixelRatio,s.dpr);
      scalar(pu.clock,s.time); scalar(pu.glow,s.glow);
      gl.bindVertexArray(vaos[read]);
      if (s.trail>.1) {
        scalar(pu.tail,s.trail*3.2);
        gl.drawArrays(gl.POINTS,0,count);
      }
      scalar(pu.tail,0);
      gl.drawArrays(gl.POINTS,0,count);
      gl.bindVertexArray(null);
    },
    dispose() {
      for (const buffer of [...buffers,goals]) gl.deleteBuffer(buffer);
      for (const vao of vaos) gl.deleteVertexArray(vao);
      gl.deleteTransformFeedback(feedback);
      gl.deleteProgram(sim); gl.deleteProgram(paint);
    }
  };
  return api;
}

export function cameraMatrix(angles,out) {
  const [x,y,z]=angles, a=Math.cos(x), b=Math.sin(x), c=Math.cos(y), d=Math.sin(y), e=Math.cos(z), f=Math.sin(z);
  out[0]=e*c+f*b*d; out[1]=-f*a; out[2]=-e*d+f*b*c;
  out[3]=f*c-e*b*d; out[4]=e*a; out[5]=-f*d-e*b*c;
  out[6]=a*d; out[7]=b; out[8]=a*c;
}

export function project(x,y,z,s,out) {
  const m=s.matrix, depth=5/Math.max(2.6,5-(m[6]*x+m[7]*y+m[8]*z)), scale=s.scale*depth;
  out[0]=s.cx+(m[0]*x+m[1]*y+m[2]*z)*scale;
  out[1]=s.cy-(m[3]*x+m[4]*y+m[5]*z)*scale;
  out[2]=depth;
}

export function worldPoint(x,y,s,out) {
  const m=s.matrix, dx=(x-s.cx)/s.scale, dy=(s.cy-y)/s.scale;
  out[0]=m[0]*dx+m[3]*dy; out[1]=m[1]*dx+m[4]*dy; out[2]=m[2]*dx+m[5]*dy;
}

function cpu(canvas) {
  const ctx=canvas.getContext("2d");
  const xyz=new Float32Array(MAX_POINTS*3), velocity=new Float32Array(xyz.length);
  const screen=new Float32Array(3), n=new Float32Array(MAX_POINTS);
  for (let i=0;i<n.length;i++) n[i]=(i*.6180339887)%1;
  let goals;
  let activeColors, tones;
  return {
    name:"Canvas 2D", canvas,
    targets(data,reset) {
      goals=data;
      if (!reset) return;
      velocity.fill(0);
      for (let i=0;i<MAX_POINTS;i++) xyz.set(goals.subarray(i*4,i*4+3),i*3);
    },
    render(s) {
      ctx.setTransform(s.dpr,0,0,s.dpr,0,0);
      ctx.clearRect(0,0,s.w,s.h);
      const count=Math.min(2600,s.count), damp=Math.pow(s.damping,s.dt), r2=s.radius*s.radius;
      if (activeColors!==s.colors) {
        activeColors=s.colors;
        tones=Array.from({length:8},(_,i)=>{
          const a=Math.min(1,i/3.5), b=Math.max(0,(i-3.5)/3.5), start=i<4?0:1, f=i<4?a:b;
          return 'rgb('+activeColors[start].map((v,j)=>Math.round(255*(v+(activeColors[start+1][j]-v)*f))).join(',')+')';
        });
      }
      const t=s.time*s.movement;
      for (let k=0;k<8;k++) {
        ctx.fillStyle=tones[k]; ctx.globalAlpha=.49+k*.045;
        for(let i=0;i<count;i++) {
          const g=i*4, p=i*3;
          if(Math.min(7,Math.floor(goals[g+3]*8))!==k) continue;
          const x=xyz[p],y=xyz[p+1],z=xyz[p+2];
          const a=s.hand[0]-x,b=s.hand[1]-y,c=s.hand[2]-z;
          const anchor=s.anchored&&i%7===0?.28:1;
          const strength=Math.max(0,1-(a*a+b*b+c*c)/r2)**2*s.force*anchor;
          const seed=n[i], phase=seed*47+t*.63, spread=s.spread*.65*anchor, expand=1+s.spread*.32*anchor;
          const dx=x-s.impulse[0],dy=y-s.impulse[1],dz=z-s.impulse[2];
          const dist=Math.hypot(dx,dy,dz), kick=Math.max(0,1-Math.abs(dist-(1-s.pulse)*2.8)*2)*s.pulse*.16*anchor/(.16+dist);
          const wave=s.animation===4?.27*Math.abs(x)*Math.sin(t*2.8):0;
          const curve=s.animation===5||s.animation===6||s.animation===8?.09*Math.sin(x*3+y*2-t):0;
          const spin=s.mode===2,flow=s.mode===1,spring=(flow||spin?.029:.055)+s.recovery*.052;
          const ax=(goals[g]*expand+Math.sin(phase)*spread-x)*spring+strength*(spin?b*.40:flow?a*.22+Math.sin(y*3-t)*.13:a*.36)+dx*kick;
          const ay=(goals[g+1]*expand+Math.cos(phase*1.3)*spread+curve-y)*spring+strength*(spin?-a*.40:flow?b*.22+Math.cos(x*3+t)*.13:b*.36)+dy*kick;
          const az=(goals[g+2]*expand+Math.sin(phase*.83)*spread+wave-z)*spring+strength*c*.27+dz*kick;
          velocity[p]=(velocity[p]+ax*s.dt)*damp;
          velocity[p+1]=(velocity[p+1]+ay*s.dt)*damp;
          velocity[p+2]=(velocity[p+2]+az*s.dt)*damp;
          xyz[p]+=velocity[p]*s.dt; xyz[p+1]+=velocity[p+1]*s.dt; xyz[p+2]+=velocity[p+2]*s.dt;
          project(xyz[p],xyz[p+1],xyz[p+2],s,screen);
          const size=s.dot*screen[2]*(.48+seed*.53);
          ctx.fillRect(screen[0]-size/2,screen[1]-size/2,size,size);
        }
      }
      ctx.globalAlpha=1;
    },
    dispose() {},
  };
}

export function canvasFallback(canvas) {
  const replacement=canvas.cloneNode();
  canvas.replaceWith(replacement);
  return cpu(replacement);
}

export function createRenderer(canvas,forceCanvas=false) {
  if(forceCanvas) return cpu(canvas);
  try { return gpu(canvas); }
  catch(error) {
    console.info("FLORA / FIELD is using Canvas 2D.",error.message);
    return canvasFallback(canvas);
  }
}
