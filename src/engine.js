export const MEDIA = {
  watercolor: {label:'Watercolor', opacity:.24, water:.85, relief:0, grain:.08, spread:.92, drag:.02, drying:.025},
  oil: {label:'Oil', opacity:.8, water:0, relief:1.2, grain:0, spread:0, drag:.72, drying:.0008},
  acrylic: {label:'Acrylic', opacity:.72, water:.08, relief:.32, grain:.03, spread:.02, drag:.12, drying:.018},
  pastel: {label:'Pastel', opacity:.36, water:0, relief:.08, grain:.8, spread:0, drag:.18, drying:1},
  chalk: {label:'Chalk', opacity:.22, water:0, relief:.03, grain:.95, spread:0, drag:.06, drying:1},
  pencil: {label:'Pencil', opacity:.65, water:0, relief:.01, grain:.7, spread:0, drag:0, drying:1},
};
const clamp = (value, min=0, max=1) => Math.max(min, Math.min(max, value));
export function rgb(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Color must be a six-digit hex value');
  return [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255);
}
// Three-band Kubelka–Munk approximation for opaque pigment mixing.
export const absorption = reflectance => (1-clamp(reflectance,.025)) ** 2 / (2*clamp(reflectance,.025));
export const reflectance = ks => 1 / (1+ks+Math.sqrt(ks*ks+2*ks));
export function mixPigments(a,b,fraction) {
  return a.map((channel,c) => reflectance(absorption(channel)*(1-fraction)+absorption(b[c])*fraction));
}
export function validateStroke(stroke) {
  if (!stroke || !MEDIA[stroke.medium]) throw new Error('Unknown medium');
  rgb(stroke.color);
  if (!Number.isFinite(stroke.size) || stroke.size<1 || stroke.size>160) throw new Error('Brush size must be 1–160');
  if (!Array.isArray(stroke.points) || !stroke.points.length || stroke.points.length>10000) throw new Error('Provide 1–10000 points');
  for (const p of stroke.points) {
    if (!Array.isArray(p) || p.length<2 || p.length>3 || !p.every(Number.isFinite) || p.some(v=>v<0||v>1)) throw new Error('Points are [x, y, pressure?] in the range 0–1');
  }
  for (const key of ['flow','water','body']) {
    if (stroke[key]!==undefined && (!Number.isFinite(stroke[key]) || stroke[key]<0 || stroke[key]>1)) throw new Error(`${key} must be 0–1`);
  }
  if (stroke.tip!==undefined && !['round','flat'].includes(stroke.tip)) throw new Error('Tip must be round or flat');
  for (const key of ['duration','wait']) {
    if (stroke[key]!==undefined && (!Number.isFinite(stroke[key]) || stroke[key]<0 || stroke[key]>60000)) throw new Error(`${key} must be 0–60000 ms`);
  }
  return stroke;
}
export function validateScore(strokes) {
  if (!Array.isArray(strokes) || strokes.length>2000) throw new Error('Provide an array of at most 2000 strokes');
  strokes.forEach(validateStroke);
  return structuredClone(strokes);
}
function tooth(x,y) { const v=Math.sin(x*127.1+y*311.7)*43758.5453; return v-Math.floor(v); }
const FIELDS = ['pigment','mass','water','absorbed','heightMap','mobile','mobilePigment','washMass','washPigment','wet','drying','oilMass','oilPigment','oilColor','oilWet','oilHeight','oilSurfaceKs'];
export class BrushReservoir {
  constructor(brush) { this.color=rgb(brush.color); this.fresh=this.color.slice(); this.pickup=0; this.load=1; this.medium=brush.medium; }
  contact(surface,nx,ny,brush,angle) {
    const m=MEDIA[this.medium], w=surface.width, h=surface.height;
    if (m.drag>0) for (const offset of [-.3,0,.3]) {
      const x=clamp(Math.floor(nx*w-Math.sin(angle)*brush.size*offset),0,w-1);
      const y=clamp(Math.floor(ny*h+Math.cos(angle)*brush.size*offset),0,h-1), i=y*w+x;
      if (this.medium==='oil' && surface.oilMass[i]>.0001) {
        // A loaded brush retains fresh pigment; sampling more dabs must not
        // eventually turn every stroke into the underlying ground color.
        const capacity=.12+.4*(1-(brush.body??.75))+.15*(1-(brush.flow??1));
        const amount=Math.min(Math.max(0,capacity-this.pickup),m.drag*surface.oilWet[i]*(1-Math.exp(-surface.oilMass[i]*3))*.025);
        const old=this.color.map((_,c)=>reflectance(surface.oilSurfaceKs[i*3+c]));
        this.color=mixPigments(this.color,old,amount);this.pickup+=amount;
      } else if (this.medium!=='oil' && surface.mass[i]>.0001) {
        const amount=m.drag*surface.wet[i]*(1-Math.exp(-surface.mass[i]*3))*.1;
        this.color=this.color.map((value,c)=>value*(1-amount)+surface.pigment[i*3+c]/surface.mass[i]*amount);
      }
    }
    this.load=Math.max(.25,this.load-(this.medium==='oil'?.0015:this.medium==='acrylic'?.001:.0004));
    return this.color;
  }
}
export class PaintSurface {
  constructor(width=720,height=500) {
    this.width=width; this.height=height; this.length=width*height;
    for (const key of FIELDS) this[key]=new Float32Array(this.length*(['pigment','mobilePigment','washPigment','oilPigment','oilColor','oilSurfaceKs'].includes(key)?3:1));
    this.tooth=Float32Array.from({length:this.length},(_,i)=>tooth(i%width,Math.floor(i/width)));
    this.clear();
  }
  clear() { for (const key of FIELDS) this[key].fill(0); }
  snapshot() { return Object.fromEntries(FIELDS.map(key=>[key,this[key].slice()])); }
  restore(state) { for (const key of FIELDS) this[key].set(state[key]); }

  // Move only the suspended pigment. A dry pencil or oil layer cannot leak into a wash.
  moveWatercolor(source,target,amount) {
    amount=Math.min(amount,this.mobile[source]);
    if (amount<=0 || this.mobile[source]<1e-8) return;
    const fraction=amount/this.mobile[source];
    for (let c=0;c<3;c++) {
      const moved=this.mobilePigment[source*3+c]*fraction;
      this.mobilePigment[source*3+c]-=moved; this.mobilePigment[target*3+c]+=moved;
      this.washPigment[source*3+c]-=moved; this.washPigment[target*3+c]+=moved;
      this.pigment[source*3+c]-=moved; this.pigment[target*3+c]+=moved;
    }
    this.mass[source]-=amount; this.mass[target]+=amount;
    this.mobile[source]-=amount; this.mobile[target]+=amount;
    this.washMass[source]-=amount; this.washMass[target]+=amount;
  }
  rewet(index,fraction) {
    // Only previously settled wash pigment can redissolve; graphite and oil remain anchored.
    const settled=Math.max(0,this.washMass[index]-this.mobile[index]);
    if(settled<1e-8)return;
    fraction=clamp(fraction,0,.15);
    this.mobile[index]+=settled*fraction;
    for(let c=0;c<3;c++) {
      const offset=index*3+c;
      this.mobilePigment[offset]+=Math.max(0,this.washPigment[offset]-this.mobilePigment[offset])*fraction;
    }
  }
  // Conservative, brush-driven displacement of the wet oil surface layer.
  moveOil(source,target,amount) {
    amount=Math.min(amount,this.oilMass[source]);
    if (amount<=0 || source===target || this.oilMass[source]<1e-8) return;
    const fraction=amount/this.oilMass[source];
    // Optical surface color is distinct from conserved pigment through depth.
    const skinMix=1-Math.exp(-amount*5);
    for(let c=0;c<3;c++)this.oilSurfaceKs[target*3+c]=this.oilMass[target]<1e-8?this.oilSurfaceKs[source*3+c]:this.oilSurfaceKs[target*3+c]*(1-skinMix)+this.oilSurfaceKs[source*3+c]*skinMix;
    for (let c=0;c<3;c++) {
      const ks=this.oilPigment[source*3+c]*fraction, color=this.oilColor[source*3+c]*fraction;
      this.oilPigment[source*3+c]-=ks; this.oilPigment[target*3+c]+=ks;
      this.oilColor[source*3+c]-=color; this.oilColor[target*3+c]+=color;
      this.pigment[source*3+c]-=color; this.pigment[target*3+c]+=color;
    }
    const relief=this.oilHeight[source]*fraction;
    this.oilHeight[source]-=relief; this.oilHeight[target]+=relief;
    this.heightMap[source]-=relief; this.heightMap[target]+=relief;
    this.oilWet[target]=Math.max(this.oilWet[target],this.oilWet[source]);
    this.oilMass[source]-=amount; this.oilMass[target]+=amount;
    this.mass[source]-=amount; this.mass[target]+=amount;
  }
  dab(nx,ny,pressure,brush,angle=0,reservoir=null) {
    const m=MEDIA[brush.medium],color=reservoir?reservoir.contact(this,nx,ny,brush,angle):rgb(brush.color);
    const w=this.width,h=this.height,cx=nx*w,cy=ny*h,radius=brush.size/2*clamp(pressure,.08),aspect=brush.tip==='flat'?.42:1;
    const co=Math.cos(angle),si=Math.sin(angle),oil=brush.medium==='oil',body=brush.body??.75;
    const ks=oil?color.map(absorption):null;
    const x0=Math.max(0,Math.floor(cx-radius)),x1=Math.min(w-1,Math.ceil(cx+radius));
    const y0=Math.max(0,Math.floor(cy-radius)),y1=Math.min(h-1,Math.ceil(cy+radius));
    // Iterate from the leading edge toward the tail so oil is not repeatedly pushed in a single dab.
    const reverseX=co>0,reverseY=si>0;
    for (let yy=y0;yy<=y1;yy++) for (let xx=x0;xx<=x1;xx++) {
      const x=reverseX?x1-(xx-x0):xx,y=reverseY?y1-(yy-y0):yy;
      const dx=x-cx,dy=y-cy,u=(dx*co+dy*si)/radius,across=-dx*si+dy*co,v=across/(radius*aspect),r=u*u+v*v;
      if (r>1) continue;
      const i=y*w+x,grain=this.tooth[i];
      if (grain<m.grain*(1-pressure*.65)) continue;
      const edge=Math.pow(1-r,brush.medium==='watercolor'?.3:.65);
      const ridge=.5+.5*Math.sin(across*2.25+.3*Math.sin(across*.51));
      const bristle=oil?.28+.72*ridge*ridge:brush.medium==='acrylic'?.55+.45*ridge:1;
      let amount=m.opacity*edge*pressure*bristle*(brush.flow??1)*(reservoir?.load??1)*.22;
      if (brush.medium==='pencil') amount*=.35+.65*Math.abs(Math.sin(angle+1));
      if (oil) {
        const sx=clamp(x-Math.round(co*2),0,w-1),sy=clamp(y-Math.round(si*2),0,h-1),source=sy*w+sx;
        const displacement=this.oilMass[source]*this.oilWet[source]*edge*pressure*(.018+.045*(1-body));
        this.moveOil(source,i,displacement);
        // Finite optical depth: fresh opaque paint masks buried pigment while
        // thin strokes blend more of the exposed wet layer. Bulk mass stays conserved.
        const cover=1-Math.exp(-amount*(4+body*8));
        for(let c=0;c<3;c++)this.oilSurfaceKs[i*3+c]=this.oilMass[i]<1e-8?ks[c]:this.oilSurfaceKs[i*3+c]*(1-cover)+ks[c]*cover;
        for(let c=0;c<3;c++) { this.oilPigment[i*3+c]+=amount*ks[c]; this.oilColor[i*3+c]+=amount*color[c]; }
        this.oilMass[i]+=amount; this.oilWet[i]=clamp(this.oilWet[i]+amount*3);
        const relief=amount*m.relief*(.08+body*body*2.5)*(.35+ridge*1.65);
        this.oilHeight[i]+=relief; this.heightMap[i]+=relief;
      } else this.heightMap[i]+=amount*m.relief;
      for(let c=0;c<3;c++) {
        this.pigment[i*3+c]+=amount*color[c];
        this.mobilePigment[i*3+c]+=amount*m.spread*color[c];
        this.washPigment[i*3+c]+=amount*m.spread*color[c];
      }
      this.mass[i]+=amount; this.mobile[i]+=amount*m.spread;
      this.washMass[i]+=amount*m.spread;
      const water=brush.medium==='watercolor'?(brush.water??m.water):m.water;
      const addedWater=water*edge*pressure*.24;
      this.water[i]=clamp(this.water[i]+addedWater);
      if(brush.medium==='watercolor')this.rewet(i,addedWater*.16);
      this.wet[i]=clamp(this.wet[i]+(m.drying<1?amount*2:0));
      this.drying[i]=m.drying;
    }
  }
  segment(a,b,brush,reservoir=null) {
    const dx=(b[0]-a[0])*this.width,dy=(b[1]-a[1])*this.height,distance=Math.hypot(dx,dy);
    const steps=Math.max(1,Math.ceil(distance/Math.max(.6,brush.size*.07)));
    for(let j=1;j<=steps;j++) {
      const t=j/steps;
      this.dab(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,(a[2]??.7)+((b[2]??.7)-(a[2]??.7))*t,brush,Math.atan2(dy,dx),reservoir);
    }
  }
  step(dt=1/30) {
    // Bounded substeps keep capillary transport positive even for a large elapsed interval.
    const steps=Math.max(1,Math.ceil(dt/.05));
    for(let n=0;n<steps;n++) this.integrate(dt/steps);
  }
  integrate(dt) {
    const w=this.width,h=this.height;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
      const i=y*w+x;
      for(let axis=0;axis<2;axis++) {
        if((axis===0&&x===w-1)||(axis===1&&y===h-1))continue;
        const j=axis===0?i+1:i+w,wi=this.water[i],wj=this.water[j];
        if(wi+wj<1e-7)continue;
        // Uneven paper capacity produces capillary fingers rather than a uniform blur.
        const capacityI=.7+this.tooth[i]*.6,capacityJ=.7+this.tooth[j]*.6;
        const headI=wi/capacityI,headJ=wj/capacityJ;
        let flux=(headI-headJ)*Math.min(.22,dt*4)*(axis===0?1:.85);
        flux=clamp(flux,-wj*.23,wi*.23);
        const source=flux>=0?i:j,target=flux>=0?j:i,volume=Math.abs(flux),sourceWater=flux>=0?wi:wj;
        if(sourceWater>1e-7)this.moveWatercolor(source,target,this.mobile[source]*volume/sourceWater*.8);
        this.water[i]-=flux; this.water[j]+=flux;
        const wet=Math.min(this.water[i],this.water[j]);
        if(wet>.005){
          const ci=this.mobile[i]/(this.water[i]+.03),cj=this.mobile[j]/(this.water[j]+.03);
          const diffuse=(ci-cj)*Math.min(.02,dt*.15)*wet;
          this.moveWatercolor(diffuse>0?i:j,diffuse>0?j:i,Math.abs(diffuse));
        }
      }
    }
    for(let i=0;i<this.length;i++) {
      if(this.water[i]+this.absorbed[i]+this.mobile[i]+this.wet[i]+this.oilWet[i]<1e-8)continue;
      const capacity=.22+this.tooth[i]*.16;
      const soak=Math.min(this.water[i],Math.max(0,capacity-this.absorbed[i])*dt*.7);
      this.absorbed[i]+=soak;this.water[i]-=soak;
      this.water[i]=Math.max(0,this.water[i]-dt*.016*(1.5-this.absorbed[i]));
      this.absorbed[i]=Math.max(0,this.absorbed[i]-dt*.007);
      if(this.water[i]>.18)this.rewet(i,dt*this.water[i]*.02);
      // Settlement anchors suspended pigment, with stronger granulation in paper valleys.
      const settle=1-Math.exp(-dt*(.03+this.tooth[i]*.06)/(this.water[i]+.045));
      this.mobile[i]*=1-settle;
      for(let c=0;c<3;c++)this.mobilePigment[i*3+c]*=1-settle;
      this.wet[i]=Math.max(0,this.wet[i]-this.drying[i]*dt*4);
      this.oilWet[i]=Math.max(0,this.oilWet[i]-MEDIA.oil.drying*dt*4);
    }
  }
  render(data) {
    const w=this.width,h=this.height;
    for(let i=0;i<this.length;i++) {
      const paper=.963+(this.tooth[i]-.5)*.022;
      if(this.mass[i]<.00001){data[i*4]=data[i*4+1]=data[i*4+2]=paper*255;data[i*4+3]=255;continue;}
      const x=i%w,y=Math.floor(i/w),oilMass=this.oilMass[i],baseMass=Math.max(0,this.mass[i]-oilMass);
      const coverage=1-Math.exp(-baseMass*3.4),oilCoverage=1-Math.exp(-oilMass*7);
      const hx=(this.heightMap[y*w+Math.max(0,x-1)]-this.heightMap[y*w+Math.min(w-1,x+1)])*3;
      const hy=(this.heightMap[Math.max(0,y-1)*w+x]-this.heightMap[Math.min(h-1,y+1)*w+x])*3;
      const normal=Math.hypot(hx,hy,1),light=clamp((hx*(-.45)+hy*(-.55)+.7)/normal);
      const shade=.72+.4*light;
      const specular=Math.pow(clamp((hx*(-.24)+hy*(-.29)+.925)/normal),28)*this.oilWet[i]*oilCoverage*.18;
      for(let c=0;c<3;c++) {
        const baseColor=baseMass>.00001?clamp((this.pigment[i*3+c]-this.oilColor[i*3+c])/baseMass,.025):paper;
        const base=paper*Math.exp(Math.log(Math.max(.025,baseColor/paper))*coverage);
        const oilColor=oilMass>.00001?reflectance(this.oilSurfaceKs[i*3+c]):base;
        data[i*4+c]=clamp(base*(1-oilCoverage)+oilColor*shade*oilCoverage+specular)*255;
      }
      data[i*4+3]=255;
    }
    return data;
  }
}
