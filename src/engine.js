export const MEDIA = {
  watercolor: {label:'Watercolor', opacity:.2, water:.85, relief:0, grain:.16, spread:.65, drag:.02, drying:.025},
  oil: {label:'Oil', opacity:.65, water:0, relief:.85, grain:.06, spread:0, drag:.52, drying:.0008},
  acrylic: {label:'Acrylic', opacity:.72, water:.08, relief:.32, grain:.03, spread:.02, drag:.12, drying:.018},
  pastel: {label:'Pastel', opacity:.36, water:0, relief:.08, grain:.8, spread:0, drag:.18, drying:1},
  chalk: {label:'Chalk', opacity:.22, water:0, relief:.03, grain:.95, spread:0, drag:.06, drying:1},
  pencil: {label:'Pencil', opacity:.65, water:0, relief:.01, grain:.7, spread:0, drag:0, drying:1},
};
export function rgb(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Color must be a six-digit hex value');
  return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
}
export function validateStroke(stroke) {
  if (!stroke || !MEDIA[stroke.medium]) throw new Error('Unknown medium');
  rgb(stroke.color);
  if (!Number.isFinite(stroke.size) || stroke.size < 1 || stroke.size > 160) throw new Error('Brush size must be 1–160');
  if (!Array.isArray(stroke.points) || stroke.points.length < 1 || stroke.points.length > 10000) throw new Error('Provide 1–10000 points');
  for (const p of stroke.points) if (!Array.isArray(p) || p.length < 2 || !p.every(Number.isFinite) || p[0]<0 || p[0]>1 || p[1]<0 || p[1]>1 || (p[2]!==undefined && (p[2]<0 || p[2]>1))) throw new Error('Points are [x, y, pressure?] in the range 0–1');
  if (stroke.duration !== undefined && (!Number.isFinite(stroke.duration) || stroke.duration<0 || stroke.duration>60000)) throw new Error('Duration must be 0–60000 ms');
  return stroke;
}
const clamp = (x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export class BrushReservoir {
  constructor(brush){this.color=rgb(brush.color);this.load=1;this.medium=brush.medium;}
  contact(surface,nx,ny,brush,angle){
    const m=MEDIA[this.medium],w=surface.width,h=surface.height;
    // Sample the contact patch across the brush, carrying picked-up wet color forward.
    if(m.drag>0)for(const offset of [-.3,0,.3]){
      const x=clamp(Math.floor(nx*w-Math.sin(angle)*brush.size*offset),0,w-1);
      const y=clamp(Math.floor(ny*h+Math.cos(angle)*brush.size*offset),0,h-1),i=y*w+x;
      const mass=surface.mass[i];
      if(mass>.0001){const pickup=m.drag*surface.wet[i]*(1-Math.exp(-mass*3))*.1;
        for(let c=0;c<3;c++)this.color[c]=this.color[c]*(1-pickup)+surface.pigment[i*3+c]/mass*pickup;
      }
    }
    this.load=Math.max(.25,this.load-(this.medium==='oil'?.0015:this.medium==='acrylic'?.001:.0004));
    return this.color;
  }
}
// Fixed paper tooth: identical strokes produce identical pigment deposition.
function tooth(x,y) { const v = Math.sin(x*127.1+y*311.7)*43758.5453; return v-Math.floor(v); }
export class PaintSurface {
  constructor(width=720,height=500) {
    this.width=width; this.height=height; this.length=width*height;
    this.pigment=new Float32Array(this.length*3); this.mass=new Float32Array(this.length);
    this.water=new Float32Array(this.length); this.heightMap=new Float32Array(this.length);
    this.mobile=new Float32Array(this.length);
    this.wet=new Float32Array(this.length); this.drying=new Float32Array(this.length);
    this.tooth=Float32Array.from({length:this.length},(_,i)=>tooth(i%width,Math.floor(i/width)));
    this.clear();
  }
  clear() { this.pigment.fill(0); for (const key of ['mass','water','heightMap','wet','drying','mobile']) this[key].fill(0); }
  snapshot() { return Object.fromEntries(['pigment','mass','water','heightMap','wet','drying','mobile'].map(k=>[k,this[k].slice()])); }
  restore(state) { for (const k of Object.keys(state)) this[k].set(state[k]); }
  dab(nx,ny,pressure,brush,angle=0,reservoir=null) {
    const m=MEDIA[brush.medium], color=reservoir?reservoir.contact(this,nx,ny,brush,angle):rgb(brush.color), w=this.width, h=this.height;
    const cx=nx*w, cy=ny*h, radius=brush.size/2*clamp(pressure,.08,1), aspect=brush.tip==='flat'?.42:1;
    const co=Math.cos(angle), si=Math.sin(angle);
    const x0=Math.max(0,Math.floor(cx-radius)), x1=Math.min(w-1,Math.ceil(cx+radius));
    const y0=Math.max(0,Math.floor(cy-radius)), y1=Math.min(h-1,Math.ceil(cy+radius));
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) {
      const dx=x-cx,dy=y-cy,u=(dx*co+dy*si)/radius,v=(-dx*si+dy*co)/(radius*aspect),r=u*u+v*v;
      if(r>1) continue;
      const i=y*w+x, grain=this.tooth[i];
      if (grain < m.grain*(1-pressure*.65)) continue;
      const edge=Math.pow(1-r,brush.medium==='watercolor'?.4:.8);
      const bristle=brush.medium==='oil'||brush.medium==='acrylic' ? .55+.45*Math.pow(Math.sin(v*37+grain*.8),2) : 1;
      let amount=m.opacity*edge*pressure*bristle*(brush.flow ?? 1)*(reservoir?.load??1)*.22;
      if(brush.medium==='pencil') amount*=.35+.65*Math.abs(Math.sin(angle+1));
      // Lift mobile pigment into loaded paint; dry marks remain anchored in the tooth.
      const drag=m.drag*this.wet[i]*.08;
      for(let c=0;c<3;c++) {
        const old=this.mass[i] ? this.pigment[i*3+c]/this.mass[i] : color[c];
        this.pigment[i*3+c]+=amount*(color[c]*(1-drag)+old*drag);
      }
      this.mass[i]+=amount;
      this.mobile[i]+=amount*m.spread;
      this.water[i]=clamp(this.water[i]+m.water*edge*pressure*.2);
      this.wet[i]=clamp(this.wet[i]+(m.drying<1 ? amount*2:0));
      this.drying[i]=m.drying;
      this.heightMap[i]=clamp(this.heightMap[i]+amount*m.relief,0,3);
    }
  }
  segment(a,b,brush,reservoir=null) {
    const dx=(b[0]-a[0])*this.width,dy=(b[1]-a[1])*this.height;
    const distance=Math.hypot(dx,dy), steps=Math.max(1,Math.ceil(distance/Math.max(.6,brush.size*.07)));
    for(let j=1;j<=steps;j++) { const t=j/steps; this.dab(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,(a[2]??.7)+((b[2]??.7)-(a[2]??.7))*t,brush,Math.atan2(dy,dx),reservoir); }
  }
  step(dt=1/30) {
    const w=this.width,h=this.height;
    // Pairwise conservative pigment transport along wet paper. Water spreads farther than pigment.
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
      const i=y*w+x;
      for(let axis=0;axis<2;axis++) {
        if((axis===0&&x===w-1)||(axis===1&&y===h-1))continue;
        const j=axis===0?i+1:i+w;
        const wet=Math.min(this.water[i],this.water[j]);
        if(wet>.025) {
          const rate=Math.min(.12,wet*dt*1.8);
          const transfer=(this.mobile[i]-this.mobile[j])*rate;
          const source=transfer>0?i:j, target=transfer>0?j:i, amount=Math.abs(transfer);
          if(this.mass[source]>.00001) {
            for(let c=0;c<3;c++) { const pigment=this.pigment[source*3+c]/this.mass[source]*amount; this.pigment[source*3+c]-=pigment; this.pigment[target*3+c]+=pigment; }
            this.mass[source]-=amount; this.mass[target]+=amount;
            this.mobile[source]-=amount;this.mobile[target]+=amount;
          }
        }
        const flow=(this.water[i]-this.water[j])*Math.min(.2,dt*2);
        this.water[i]-=flow;this.water[j]+=flow;
      }
      this.water[i]=Math.max(0,this.water[i]-dt*.025);
      // Mobile watercolor settles faster at the receding, dry edge of a wash.
      this.mobile[i]*=Math.exp(-dt*.018/(this.water[i]+.025));
      this.wet[i]=Math.max(0,this.wet[i]-this.drying[i]*dt*4);
    }
  }
  render(data) {
    const w=this.width;
    for(let i=0;i<this.length;i++) {
      const paper=.963+(this.tooth[i]-.5)*.022;
      if(this.mass[i]<.00001){data[i*4]=data[i*4+1]=data[i*4+2]=paper*255;data[i*4+3]=255;continue;}
      const coverage=1-Math.exp(-this.mass[i]*3.4);
      const slope=(this.heightMap[Math.max(0,i-1)]-this.heightMap[Math.min(this.length-1,i+1)])*.18+(this.heightMap[Math.max(0,i-w)]-this.heightMap[Math.min(this.length-1,i+w)])*.12;
      for(let c=0;c<3;c++) {
        const pigment=this.mass[i]>.00001 ? this.pigment[i*3+c]/this.mass[i] : paper;
        // Optical-density mixing keeps overlapping transparent washes from looking like light emission.
        const base=paper*Math.exp(Math.log(Math.max(.025,pigment/paper))*coverage);
        data[i*4+c]=clamp(base+slope+this.wet[i]*this.heightMap[i]*.015)*255;
      }
      data[i*4+3]=255;
    }
    return data;
  }
}
