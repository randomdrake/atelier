const stroke=(medium,color,size,points,duration=350,flow=.7)=>({medium,color,size,points,duration,flow});
function wave(y,start,end,phase=0,amplitude=.007,n=24) {return Array.from({length:n},(_,i)=>[start+(end-start)*i/(n-1),y+Math.sin(i*.5+phase)*amplitude,.5+.25*Math.sin(i*.2+1)]);}
export function compose(prompt='coast') {
  const p=prompt.toLowerCase();
  if(/flower|sunflower|floral/.test(p)) return flowers();
  if(/abstract|expressive/.test(p)) return abstract();
  return coast();
}
export function coast() {
  const s=[];
  for(let i=0;i<9;i++) s.push(stroke('watercolor',i<5?'#9bb7be':'#c1bdac',100,wave(.12+i*.036,.08,.92,i,.008),480,.33));
  s.push(stroke('watercolor','#6b8990',90,[[.05,.44,.2],[.18,.4,.6],[.29,.35,.8],[.39,.43,.4],[.53,.45,.2]],1000,.6));
  s.push(stroke('watercolor','#738c85',65,[[.6,.46,.2],[.72,.38,.6],[.83,.41,.8],[.95,.45,.2]],900,.6));
  for(let i=0;i<10;i++) s.push(stroke('watercolor',i<6?'#6b9aa5':'#b4b09a',65,wave(.49+i*.03,.05,.95,i,.008),400,.48));
  for(let i=0;i<8;i++) s.push(stroke('watercolor','#e2cfab',65,wave(.75+i*.021,.05,.95,i,.008),320,.55));
  s.push(stroke('watercolor','#4d6563',60,[[.04,.78,.6],[.13,.74,.9],[.2,.8,.8],[.3,.85,.1]],800));
  s.push(stroke('watercolor','#788572',50,[[.73,.84,.2],[.84,.76,.8],[.96,.73,.8]],800));
  for(let i=0;i<13;i++) s.push(stroke('watercolor',i%2?'#d5e3df':'#487e91',5+i%3*3,wave(.51+i*.017,.18+(i%3)*.1,.8-(i%4)*.05,i,.003,10),220,.5));
  s.push(stroke('pencil','#53635a',3,[[.63,.61,.5],[.67,.6,.8],[.7,.61,.3]],500));
  s.push(stroke('pencil','#53635a',2,[[.671,.6,.6],[.671,.49,.6],[.67,.6,.4]],550));
  s.push(stroke('watercolor','#d9d3bc',20,[[.665,.505,.5],[.633,.584,.7],[.665,.579,.4]],650));
  for(let i=0;i<7;i++) {const x=.08+i*.017;s.push(stroke('pencil','#5b6850',3,[[x,.82,.8],[x-.012,.76-i%3*.016,.6],[x-.02,.72-i%2*.02,.1]],260));}
  for(let i=0;i<3;i++) s.push(stroke('pencil','#657573',2,[[.56+i*.045,.26-i*.018,.2],[.574+i*.045,.252-i*.018,.6],[.588+i*.045,.261-i*.018,.2]],300));
  return {title:'Where the quiet water goes',strokes:s};
}
function flowers() {
  const s=[];
  for(let i=0;i<14;i++) s.push(stroke('acrylic','#c1c6ae',100,wave(.08+i*.065,.04,.96,i,.006),220,.5));
  s.push(stroke('oil','#647d56',18,[[.48,.75,.8],[.46,.4,.7]],650));
  s.push(stroke('oil','#738354',18,[[.53,.75,.8],[.66,.32,.7]],650));
  s.push(stroke('oil','#a76c4d',85,[[.41,.71,.7],[.44,.84,.9],[.56,.84,.9],[.59,.71,.7]],1000));
  for(const [cx,cy,r] of [[.44,.36,.1],[.65,.29,.085],[.3,.48,.07]]) {
    for(let i=0;i<15;i++) {const a=i*Math.PI*2/15;s.push(stroke('oil',i%2?'#dcaa3e':'#edc35c',26,[[cx+Math.cos(a)*r*.35,cy+Math.sin(a)*r*.35,.6],[cx+Math.cos(a)*r,cy+Math.sin(a)*r,1],[cx+Math.cos(a)*r*1.15,cy+Math.sin(a)*r*1.15,.2]],240));}
    s.push(stroke('oil','#62452e',48,[[cx-.009,cy,.9],[cx+.009,cy,.9]],400));
  }
  return {title:'A little sun, held in clay',strokes:s};
}
function abstract() {
  const s=[];const colors=['#315b70','#c16845','#d4b464','#70886a','#80697b'];
  for(let i=0;i<28;i++) {const x=.15+(i%7)*.11,y=.2+Math.floor(i/7)*.18; s.push(stroke(['watercolor','acrylic','oil','pastel','chalk','pencil'][i%6],colors[i%5],i%6===5?5:35+i%4*15,[[x,y,.3],[x+.07,y-.08,.8],[x+.13,y+.035,1],[x+.07,y+.1,.2]],450));}
  return {title:'Conversations in pigment',strokes:s};
}
