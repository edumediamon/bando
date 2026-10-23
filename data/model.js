import { clamp } from './process.js';

const C = {
  silicon: [0.36, 0.57, 0.74, 1], oxide: [0.80, 0.56, 0.32, 1], resist: [0.53, 0.37, 0.78, 1],
  film: [0.31, 0.65, 0.56, 1], metal: [0.91, 0.68, 0.35, 1], dark: [0.10, 0.15, 0.20, 1],
  green: [0.39, 0.86, 0.64, 1], red: [0.86, 0.30, 0.32, 1], light: [0.61, 0.83, 0.98, 0.15]
};

// One interleaved position/normal/RGBA buffer per pass keeps the renderer dependency-free.
class Mesh {
  opaque = [];
  transparent = [];
  triangle(a, b, c, normal, color) {
    const buffer = color[3] < 1 ? this.transparent : this.opaque;
    for (const point of [a, b, c]) buffer.push(...point, ...normal, ...color);
  }
  quad(a, b, c, d, normal, color) {
    this.triangle(a, b, c, normal, color);
    this.triangle(a, c, d, normal, color);
  }
  box(x, y, z, w, h, d, color) {
    if(w<=0 || h<=0 || d<=0) return;
    const l = x - w / 2, r = x + w / 2, f = z + d / 2, b = z - d / 2, t = y + h;
    this.quad([l,t,b],[l,t,f],[r,t,f],[r,t,b],[0,1,0],color);
    this.quad([l,y,f],[l,y,b],[r,y,b],[r,y,f],[0,-1,0],color);
    this.quad([r,y,b],[r,t,b],[r,t,f],[r,y,f],[1,0,0],color);
    this.quad([l,y,f],[l,t,f],[l,t,b],[l,y,b],[-1,0,0],color);
    this.quad([l,y,f],[r,y,f],[r,t,f],[l,t,f],[0,0,1],color);
    this.quad([r,y,b],[l,y,b],[l,t,b],[r,t,b],[0,0,-1],color);
  }
  cylinder(x, y, z, radius, height, color, segments = 96, sheen = false) {
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2, b = (i + 1) / segments * Math.PI * 2;
      const p = [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius];
      const q = [x + Math.cos(b) * radius, y, z + Math.sin(b) * radius];
      const pt = [p[0], y + height, p[2]], qt = [q[0], y + height, q[2]];
      const normal = [Math.cos((a+b)/2), 0, Math.sin((a+b)/2)];
      const surface = sheen ? [0.41 + Math.sin(a*2)*0.09, 0.58 + Math.sin(a*2+2)*0.13, 0.73 + Math.cos(a*2)*0.15, 1] : color;
      this.quad(p, pt, qt, q, normal, color);
      this.triangle([x,y+height,z], qt, pt, [0,1,0], surface);
      this.triangle([x,y,z], p, q, [0,-1,0], color);
    }
  }
  ring(radius, width, y, color, segments = 128) {
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2, b = (i+1) / segments * Math.PI * 2;
      const point = (r, angle) => [Math.cos(angle)*r, y, Math.sin(angle)*r];
      this.quad(point(radius,a),point(radius,b),point(radius+width,b),point(radius+width,a),[0,1,0],color);
    }
  }
  tube(start, end, radius, color, segments = 8) {
    const vector = end.map((v,i) => v - start[i]);
    const length = Math.hypot(...vector);
    if (length < 0.00001) return;
    const axis = vector.map(v => v / length);
    const reference = Math.abs(axis[1]) > .9 ? [1,0,0] : [0,1,0];
    const u = cross(axis,reference), ul = Math.hypot(...u);
    for (let i=0;i<3;i++) u[i] /= ul;
    const v = cross(axis,u);
    for (let i=0;i<segments;i++) {
      const a = i/segments*Math.PI*2, b = (i+1)/segments*Math.PI*2;
      const n = angle => u.map((n,j) => n*Math.cos(angle)+v[j]*Math.sin(angle));
      const na=n(a), nb=n(b), normal=n((a+b)/2);
      const p=(base,offset)=>base.map((value,j)=>value+radius*offset[j]);
      this.quad(p(start,na),p(end,na),p(end,nb),p(start,nb),normal,color);
    }
  }
  finish() { return { opaque: new Float32Array(this.opaque), transparent: new Float32Array(this.transparent) }; }
}

function cross(a,b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }

function base(mesh) {
  mesh.cylinder(0,-.69,0,2.47,.14,C.dark);
  mesh.cylinder(0,-.55,0,2.29,.1,[.17,.23,.28,1]);
  mesh.ring(2.48,.012,-.68,[.22,.42,.41,1]);
  mesh.ring(2.69,.009,-.70,[.25,.38,.43,1]);
  mesh.ring(2.78,.004,-.70,[.16,.25,.30,1]);
  for (let i=0;i<48;i++) {
    const angle=i/48*Math.PI*2;
    const p = r => [Math.cos(angle)*r,-.69,Math.sin(angle)*r];
    mesh.tube(p(2.57),p(i%4 ? 2.61 : 2.65),.003,[.35,.48,.52,1],4);
  }
}

function particleField(mesh, progress, color, endY = .15) {
  for (let i=0;i<42;i++) {
    const angle=i*2.39996, radius=Math.sqrt((i+.5)/42)*1.95;
    const x=Math.cos(angle)*radius, z=Math.sin(angle)*radius;
    const y=endY+((i*.173+1-progress*2)%1+1)%1*1.8;
    mesh.cylinder(x,y,z,.018,.047,color,6);
  }
}

export function buildScene(stage, progress, section = false) {
  stage = Math.floor(clamp(stage,0,7));
  progress = clamp(progress,0,1);
  const mesh = new Mesh();
  base(mesh);
  if (stage === 7) packageScene(mesh,progress,section);
  else if (section) crossSection(mesh,stage,progress);
  else waferScene(mesh,stage,progress);
  return mesh.finish();
}

function waferScene(mesh, stage, p) {
  const y = stage===0 ? .13+p*.42 : .05;
  mesh.cylinder(0,-.38,0,2.15,stage===0 ? .35 : .39,C.silicon,128,true);
  if (stage===0) {
    mesh.cylinder(0,y,0,2.15,.065,C.silicon,160,true);
    for(let i=0;i<18;i++) mesh.ring(.25+i*.104,.002,y+.067,[.59,.72,.81,1]);
    mesh.ring(2.13,.017,y+.068,[.69,.83,.91,1]);
    mesh.tube([-2.5,y-.04,0],[2.5,y-.04,0],.004,[.51,.83,.84,1],4);
    return;
  }
  const oxideThickness=stage===1 ? .012+p*.055 : .065;
  mesh.cylinder(0,.016,0,2.135,oxideThickness,C.oxide,128);
  if (stage===1) {
    particleField(mesh,p,[.95,.56,.24,1],.15);
    mesh.ring(2.3,.015,.6,[.81,.45,.20,.3]);
    return;
  }
  let index=0;
  for(let x=-4;x<=4;x++) for(let z=-4;z<=4;z++) {
    const px=x*.42, pz=z*.42;
    if(Math.hypot(Math.abs(px)+.2,Math.abs(pz)+.2)>2.11) continue;
    const cell=index++;
    let color=stage>=5 ? [.18,.30,.39,1] : C.resist;
    if(stage===6) color=cell/65<p ? (cell%13===0 ? C.red : C.green) : [.29,.44,.55,1];
    const height=stage===3 ? .105-p*.06 : .044;
    mesh.box(px,.086,pz,.385,height,.385,color);
    if(stage>=4) mesh.box(px-.055,.135,pz,.11,.018,.22,C.film);
    if(stage===2 && cell/65>p) continue;
    const lineColor=stage>=5 ? C.metal : stage===4 ? C.film : [.73,.64,.88,1];
    const top=.087+height;
    mesh.box(px-.10,top,pz,.025,.013,.27,lineColor);
    mesh.box(px+.10,top,pz,.025,.013,.27,lineColor);
    mesh.box(px,top,pz-.11,.22,.013,.025,lineColor);
    mesh.box(px,top,pz+.04,.19,.013,.025,lineColor);
    mesh.box(px+.015,top,pz+.095,.028,.013,.11,lineColor);
    if(stage>=5 && cell/65<p) {
      mesh.box(px,top+.025,pz,.29,.016,.022,C.metal);
      mesh.box(px-.10,top+.012,pz,.035,.02,.035,C.metal);
    }
  }
  if(stage===2) {
    const scanX=-1.7+p*3.4;
    mesh.box(scanX,1.85,0,.42,.10,3.1,[.25,.34,.44,1]);
    for(let z=-1.35;z<=1.35;z+=.3) {
      mesh.box(scanX,1.84,z,.15,.01,.13,[.68,.80,.86,1]);
      mesh.box(scanX,.16,z,.12,1.66,.015,C.light);
    }
    mesh.box(scanX,.16,0,.035,.01,3.0,[.68,.83,1,1]);
  }
  if(stage===3) particleField(mesh,p,[.64,.44,.91,1]);
  if(stage===4) particleField(mesh,p,p<.5 ? C.film : [.92,.46,.43,1]);
  if(stage===6) {
    const px=(Math.floor(p*8)-3.5)*.42;
    mesh.box(px,1.35,0,.65,.09,.65,[.35,.41,.47,1]);
    for(const offset of [-.22,.22]) mesh.tube([px+offset,1.35,offset],[px+offset,.17,offset],.018,C.metal);
  }
  mesh.ring(2.13,.015,.085,[.76,.66,.50,1]);
}

function crossSection(mesh,stage,p) {
  // Educational slab, not a scaled transistor or a fabrication recipe.
  mesh.box(0,-.35,0,3.7,.50,2.2,C.silicon);
  if(stage===0) {
    mesh.box(0,.2+p*.3,0,3.7,.07,2.2,[.57,.72,.85,1]);
    return;
  }
  const oxide=.1*(stage===1 ? p : 1);
  if(oxide>.001 && stage<3) mesh.box(0,.15,0,3.7,oxide,2.2,C.oxide);
  if(stage===1) { particleField(mesh,p,[.95,.56,.24,1],.3); return; }
  const top=.25;
  for(let i=0;i<5;i++) {
    const x=(i-2)*.69;
    const resistHeight=stage===3 ? .17*(1-p) : .17;
    if(stage<=3 && resistHeight>.001) mesh.box(x,top,0,.39,resistHeight,2.2,C.resist);
    if(stage===2 && p<.67) mesh.box(x+.26,top,0,.22,.17*(1-p/.67),2.2,C.resist);
    if(stage===3) {
      mesh.box(x,.15,0,.39,.10,2.2,C.oxide);
      if(p<1) mesh.box(x+.29,.15,0,.29,.10*(1-p),2.2,C.oxide);
    }
    if(stage>=4) {
      mesh.box(x,.15,0,.39,.1,2.2,C.oxide);
      mesh.box(x,.25,0,.39,.09*(stage===4 ? Math.min(1,p*2) : 1),2.2,C.film);
      if(stage>4 || p>.5) mesh.box(x,-.08,-.12,.46,.19,.95,[.76,.36,.36,1]);
      mesh.box(x,.34,0,.20,.09,.60,[.35,.49,.57,1]);
    }
  }
  if(stage===2) {
    mesh.box(0,1.7,0,3.7,.10,2.2,[.24,.32,.41,1]);
    for(let i=0;i<5;i++) mesh.box((i-2)*.69+.25,.44,0,.12,1.25,1.7,C.light);
  }
  if(stage===3 || stage===4) particleField(mesh,p,stage===3 ? C.resist : p<.5 ? C.film : [.92,.46,.43,1],.45);
  if(stage>=5) {
    mesh.box(0,.44,0,3.7,.16,2.2,C.film);
    for(let i=0;i<5;i++) {
      const x=(i-2)*.69;
      mesh.box(x,.34,0,.09,.33,.10,C.metal);
      mesh.box(x,.6,0,.16,.08,1.7,C.metal);
    }
    if(p>.2 || stage===6) {
      mesh.box(0,.72,0,3.7,.12,2.2,[.26,.48,.44,1]);
      mesh.box(0,.84,-.5,3.45*(stage===5 ? p : 1),.07,.13,C.metal);
      for(let i=0;i<5;i++) mesh.box((i-2)*.69,.66,-.5,.08,.2,.08,C.metal);
    }
    if(stage===6) {
      const scanX=-.7+p*1.4,probeY=1.12+Math.abs(Math.sin(p*Math.PI*5))*.35;
      mesh.tube([scanX-.45,probeY,.5],[scanX-.45,.92,.5],.028,C.metal);
      mesh.tube([scanX+.45,probeY,.5],[scanX+.45,.92,.5],.028,C.metal);
      mesh.box(scanX,probeY,.5,1.2,.14,.8,[.35,.41,.47,1]);
    }
  }
}

function packageScene(mesh,p,section) {
  mesh.box(0,-.3,0,3.4,.23,3.0,[.22,.40,.34,1]);
  for(let i=-5;i<=5;i++) {
    const x=i*.27;
    mesh.box(x,-.18,-1.48,.13,.045,.42,C.metal);
    mesh.box(x,-.18,1.48,.13,.045,.42,C.metal);
    mesh.box(-1.68,-.18,x,.42,.045,.13,C.metal);
    mesh.box(1.68,-.18,x,.42,.045,.13,C.metal);
  }
  const dieY=.06+(1-Math.min(p*3,1))*.65;
  mesh.box(0,dieY,0,1.76,.15,1.5,C.silicon);
  for(let i=-4;i<=4;i++) {
    mesh.box(i*.16,dieY+.152,0,.035,.014,1.27,C.metal);
    mesh.box(0,dieY+.152,i*.13,1.55,.014,.025,C.metal);
  }
  if(p>.32) for(let i=-4;i<=4;i++) {
    const x=i*.16;
    const reach=clamp((p-.32)*3,0,1);
    for(const sign of [-1,1]) {
      const points=[[x,.22,sign*.64],[x,.65,sign*.9],[x,.48,sign*1.2],[x,-.02,sign*1.4]];
      for(let j=0;j<3;j++) {
        const end=points[j].map((n,k)=>n+(points[j+1][k]-n)*reach);
        mesh.tube(points[j],end,.012,C.metal);
      }
    }
  }
  if(p>.72) {
    const height=(p-.72)/.28*.85;
    if(section) mesh.box(0,-.06,-.92,2.55,height,.45,[.13,.18,.23,1]);
    else mesh.box(0,-.06,0,2.55,height,2.4,[.13,.18,.23,.43]);
  }
}
