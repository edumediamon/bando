import { clamp } from './process.js';

const vertexSource = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec4 aColor;
uniform mat4 uViewProjection;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec4 vColor;
void main(){vPosition=aPosition;vNormal=aNormal;vColor=aColor;gl_Position=uViewProjection*vec4(aPosition,1.0);}`;
const fragmentSource = `
precision mediump float;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec4 vColor;
uniform vec3 uEye;
void main(){
 vec3 n=normalize(vNormal),l=normalize(vec3(-3.0,7.0,4.0)),v=normalize(uEye-vPosition);
 float diffuse=max(dot(n,l),0.0), rim=pow(1.0-max(dot(n,v),0.0),3.0);
 float spec=pow(max(dot(n,normalize(l+v)),0.0),58.0);
 vec3 color=vColor.rgb*(0.48+diffuse*0.68)+vec3(0.35,0.48,0.55)*spec*0.65+vec3(0.13,0.25,0.29)*rim;
 gl_FragColor=vec4(color,vColor.a);
}`;

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl',{ antialias:true, alpha:true, powerPreference:'low-power' });
  if(!gl) throw new Error('WebGL unavailable');
  function shader(type,source) {
    const result=gl.createShader(type);
    gl.shaderSource(result,source);gl.compileShader(result);
    if(!gl.getShaderParameter(result,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
    return result;
  }
  const vertex=shader(gl.VERTEX_SHADER,vertexSource),fragment=shader(gl.FRAGMENT_SHADER,fragmentSource);
  const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.deleteShader(vertex);gl.deleteShader(fragment);gl.useProgram(program);
  const locations={position:gl.getAttribLocation(program,'aPosition'),normal:gl.getAttribLocation(program,'aNormal'),color:gl.getAttribLocation(program,'aColor'),matrix:gl.getUniformLocation(program,'uViewProjection'),eye:gl.getUniformLocation(program,'uEye')};
  const buffers=[gl.createBuffer(),gl.createBuffer()];
  let counts=[0,0], dirty=true, yaw=.48, pitch=.62, distance=9.4;
  let width=1,height=1;
  const pointers=new Map();
  let pinch=0;
  function pointerDown(event) {
    pointers.set(event.pointerId,[event.clientX,event.clientY]);
    canvas.setPointerCapture(event.pointerId);
    if(pointers.size===2) {const p=[...pointers.values()];pinch=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);}
  }
  function pointerMove(event) {
    if(!pointers.has(event.pointerId)) return;
    const old=pointers.get(event.pointerId),dx=event.clientX-old[0],dy=event.clientY-old[1];
    pointers.set(event.pointerId,[event.clientX,event.clientY]);
    if(pointers.size===2) {
      const p=[...pointers.values()],next=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);
      if(pinch>0) distance=clamp(distance*pinch/Math.max(next,1),5.3,17);
      pinch=next;
    } else { yaw-=dx*.008;pitch=clamp(pitch+dy*.006,.13,1.53); }
    dirty=true;
  }
  function pointerEnd(event) {pointers.delete(event.pointerId);pinch=0;}
  function wheel(event) {event.preventDefault();zoom(event.deltaY>0 ? 1.08 : .92);}
  function zoom(factor) {distance=clamp(distance*factor,5.3,17);dirty=true;}
  function reset() {yaw=.48;pitch=.62;distance=9.4;dirty=true;}
  function top() {pitch=1.53;yaw=0;dirty=true;}
  function keydown(event) {
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key)) event.preventDefault();
    else return;
    if(event.key==='ArrowLeft') yaw-=.12;
    if(event.key==='ArrowRight') yaw+=.12;
    if(event.key==='ArrowUp') pitch=clamp(pitch+.10,.13,1.53);
    if(event.key==='ArrowDown') pitch=clamp(pitch-.10,.13,1.53);
    if(event.key==='+' || event.key==='=') zoom(.9);
    if(event.key==='-') zoom(1.1);
    if(event.key==='Home') reset();
    dirty=true;
  }
  const events=[['pointerdown',pointerDown],['pointermove',pointerMove],['pointerup',pointerEnd],['pointercancel',pointerEnd],['lostpointercapture',pointerEnd],['wheel',wheel],['keydown',keydown]];
  for(const [name,handler] of events) canvas.addEventListener(name,handler,{passive:name.startsWith('pointer')});
  const observer=new ResizeObserver(entries=>{
    const rect=entries[0].contentRect,ratio=Math.min(window.devicePixelRatio||1,2);
    width=Math.max(1,Math.round(rect.width*ratio));height=Math.max(1,Math.round(rect.height*ratio));
    canvas.width=width;canvas.height=height;dirty=true;
  });
  observer.observe(canvas);
  return {
    setMesh(mesh) {
      [mesh.opaque,mesh.transparent].forEach((data,i)=>{gl.bindBuffer(gl.ARRAY_BUFFER,buffers[i]);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);counts[i]=data.length/10;});
      dirty=true;
    },
    render() {
      if(!dirty) return;
      dirty=false;
      const target=[0,.35,0],eye=[Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance+.35,Math.cos(yaw)*Math.cos(pitch)*distance];
      const matrix=multiply(perspective(.67,width/height,.1,60),lookAt(eye,target));
      gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.useProgram(program);
      gl.uniformMatrix4fv(locations.matrix,false,matrix);gl.uniform3fv(locations.eye,eye);
      for(let i=0;i<2;i++) {
        if(i===1) {gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}
        else {gl.disable(gl.BLEND);gl.depthMask(true);}
        gl.bindBuffer(gl.ARRAY_BUFFER,buffers[i]);
        for(const [location,size,offset] of [[locations.position,3,0],[locations.normal,3,12],[locations.color,4,24]]) {
          gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,40,offset);
        }
        gl.drawArrays(gl.TRIANGLES,0,counts[i]);
      }
      gl.depthMask(true);
    },zoom,reset,top,
    dispose() {observer.disconnect();for(const [name,handler] of events) canvas.removeEventListener(name,handler);for(const b of buffers)gl.deleteBuffer(b);gl.deleteProgram(program);}
  };
}

export function perspective(fov,aspect,near,far) {
  const f=1/Math.tan(fov/2),nf=1/(near-far);
  return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
}

export function lookAt(eye,target) {
  const normalize=v=>{const length=Math.hypot(...v);return v.map(n=>n/length);};
  const z=normalize(eye.map((n,i)=>n-target[i]));
  const x=normalize([z[2],0,-z[0]]),y=[z[1]*x[2],z[2]*x[0]-z[0]*x[2],-z[1]*x[0]];
  const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
}

export function multiply(a,b) {
  const out=new Float32Array(16);
  for(let c=0;c<4;c++) for(let r=0;r<4;r++) for(let k=0;k<4;k++) out[c*4+r]+=a[k*4+r]*b[c*4+k];
  return out;
}
