const stroke=(medium,color,size,points,duration=350,flow=.7)=>({medium,color,size,points,duration,flow});
function wave(y,start,end,phase=0,amplitude=.007,n=24) {return Array.from({length:n},(_,i)=>[start+(end-start)*i/(n-1),y+Math.sin(i*.5+phase)*amplitude,.5+.25*Math.sin(i*.2+1)]);}
export function compose(prompt='coast') {
  const p=prompt.toLowerCase();
  if(/harbor|village|lighthouse|sailboat|detailed/.test(p)) return harbor();
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

// A layered harbor study: wet washes, architectural drawing, and loaded oil accents.
export function harbor() {
  const s=[];
  const add=(medium,color,size,points,duration=260,extra={})=>s.push({...stroke(medium,color,size,points,duration),...extra});
  const wash=(color,size,points,duration=350,extra={})=>add('watercolor',color,size,points,duration,{water:.82,flow:.65,...extra});
  const line=(color,size,points,duration=220)=>add('pencil',color,size,points,duration,{flow:.95});
  const paint=(color,size,points,duration=240,extra={})=>add('oil',color,size,points,duration,{body:.6,flow:.85,...extra});
  for(let i=0;i<11;i++)wash(i<7?'#8fb9cb':'#d8c6a6',95,wave(.095+i*.027,.07,.93,i,.005),430,{flow:.23});
  wash('#709498',55,[[.075,.421,.15],[.17,.377,.65],[.25,.407,.6],[.32,.34,.9],[.46,.418,.4],[.62,.378,.65],[.76,.405,.7],[.91,.38,.1]],1200,{flow:.5});
  for(let i=0;i<16;i++)wash(i<8?'#629eac':'#448494',48,wave(.545+i*.022,.06,.94,i,.005),400,{flow:.52,water:.95});
  // A stone breakwater and a warm waterfront, with walls laid into a drier wash.
  for(let i=0;i<4;i++)wash(i%2?'#b7a07b':'#988975',25,wave(.5+i*.009,.07,.91,i,.002),500,{water:.35,wait:i===0?700:0});
  const houses=[
    [.125,.071,.367,.485,'#d6b982','#a96048'],[.207,.085,.325,.484,'#d2c2a0','#9e5b47'],
    [.302,.076,.361,.482,'#d5a786','#bf7549'],[.39,.09,.312,.482,'#b6c5bc','#8e6758'],
    [.493,.075,.348,.48,'#dfc39c','#a65d42'],[.58,.07,.382,.479,'#c0c6a9','#996449'],
    [.66,.056,.403,.477,'#dab289','#a5644e']
  ];
  for(const [x,width,top,bottom,wall,roof] of houses){
    for(let j=0;j<4;j++)wash(wall,22,[[x+width*j/3,top,.7],[x+width*j/3,bottom,.8]],320,{water:.28,flow:.9});
    wash(roof,13,[[x-.006,top+.012,.7],[x+width*.5,top-.044,.95],[x+width+.009,top+.012,.7]],500,{water:.3,flow:.95});
    line('#6a6860',2.3,[[x,top+.013,.5],[x,bottom,.7],[x+width,bottom,.7],[x+width,top+.013,.3]],500);
    line('#7f6854',2.5,[[x-.007,top+.012,.8],[x+width*.5,top-.044,.6],[x+width+.008,top+.012,.8]],400);
    for(let row=0;row<2;row++)for(let col=0;col<2;col++){
      const wx=x+width*(.25+col*.47),wy=top+.039+row*.053;
      paint('#566b68',6,[[wx,wy,.75],[wx,wy+.019,.9]],180,{body:.2,flow:.7});
      line('#aeaa84',2,[[wx+.002,wy,.6],[wx+.002,wy+.018,.6]],160);
    }
    paint('#75664f',8,[[x+width*.56,bottom-.034,.8],[x+width*.56,bottom,.9]],200,{body:.2});
    line('#a7987b',2,[[x+width*.16,bottom-.015,.3],[x+width*.39,bottom-.017,.7]],180);
  }
  // Lighthouse: warm paper, a lantern, and two red bands.
  for(let j=0;j<4;j++)wash('#d9d6bc',17,[[.784+j*.012,.287,.6],[.784+j*.012,.494,.9]],400,{water:.25,flow:1});
  line('#7b8173',3,[[.782,.288,.5],[.773,.495,.8],[.83,.495,.8],[.821,.288,.6]],700);
  for(const y of [.347,.426])paint('#b6664f',17,[[.784,y,.9],[.818,y,.9]],350,{body:.25,flow:.6});
  paint('#536b69',10,[[.781,.282,.7],[.823,.282,.7]],300,{body:.35});
  line('#435d5f',4,[[.788,.28,.8],[.788,.249,.8],[.816,.249,.8],[.816,.28,.8]],550);
  paint('#617773',8,[[.778,.249,.8],[.802,.233,1],[.826,.249,.8]],450,{body:.35});
  paint('#dcb26a',5,[[.802,.255,.9],[.802,.272,.9]],220);
  for(const y of [.317,.389,.464])line('#5d726f',4,[[.803,y,.9],[.803,y+.011,.9]],200);
  line('#637873',3,[[.07,.526,.7],[.35,.527,.8],[.6,.519,.8],[.88,.516,.3]],800);
  for(let i=0;i<13;i++){const x=.095+i*.059;line('#847b69',2,[[x,.507,.4],[x+.014,.522,.7]],180);}
  // Timber pier occupies the right foreground.
  for(let i=0;i<7;i++)wash(i%2?'#aa9073':'#c1a583',27,[[.84-i*.009,.567,.3],[.941-i*.018,.859,.9]],550,{water:.3,flow:.75});
  for(let i=0;i<8;i++){const y=.592+i*.033,x=.84+(y-.567)*.22;line('#826c54',3,[[x-.054,y,.5],[x+.036,y+.01,.8]],280);}
  line('#715e4d',4,[[.794,.578,.3],[.832,.861,.9]],650);
  for(const [x,y] of [[.842,.66],[.903,.815]]){
    paint('#7d6349',12,[[x,y+.032,.8],[x,y-.07,.9]],450);
    paint('#c6ac7e',4,[[x-.003,y+.024,.7],[x-.003,y-.067,.7]],350);
    line('#5d5144',4,[[x-.009,y-.071,.7],[x+.009,y-.071,.8]],200);
  }
  // Oil sails stand over transparent water; the pale cloth is opaque and visibly brushed.
  for(let i=0;i<15;i++){
    const y=.401+i*.016,right=.417+(y-.401)*.59;
    paint(i%4===0?'#d4c5a6':'#f0e3c7',18,[[.415,y,.85],[right,y,.8]],330,{body:.25,flow:.9});
  }
  for(let i=0;i<12;i++){
    const y=.44+i*.017,left=.399-(y-.44)*.55;
    paint(i%3===0?'#c6b591':'#e7d7b5',17,[[left,y,.8],[.398,y,.8]],300,{body:.22,flow:.9});
  }
  line('#6c6c5f',2.6,[[.415,.394,.6],[.557,.637,.9],[.417,.637,.8]],900);
  line('#796c56',2.5,[[.4,.434,.6],[.29,.638,.8],[.4,.639,.6]],750);
  paint('#675c48',5,[[.408,.394,.7],[.408,.696,.9]],750,{body:.5});
  line('#867b65',2,[[.408,.409,.6],[.295,.661,.5],[.553,.661,.7],[.408,.409,.5]],900);
  paint('#3e6067',20,[[.279,.666,.3],[.321,.706,.8],[.48,.713,1],[.557,.661,.4]],950,{body:.85});
  paint('#b17a50',8,[[.294,.67,.5],[.419,.682,.95],[.543,.666,.5]],650,{body:.7});
  paint('#d9bc87',4,[[.316,.681,.4],[.419,.69,.8],[.522,.677,.3]],500);
  for(let i=0;i<10;i++)wash(i%2?'#d1bd91':'#315f72',8,wave(.727+i*.012,.3+i%3*.02,.56-i%4*.025,i,.003,12),280,{water:.65,flow:.65});
  // Mooring lines, a distant skiff, and lively broken light on the water.
  line('#685e4e',2.8,[[.536,.678,.6],[.642,.701,.5],[.84,.657,.7]],1000);
  paint('#516c72',7,[[.659,.591,.4],[.682,.601,.8],[.724,.595,.3]],350,{body:.3});
  line('#6b756c',2,[[.685,.59,.8],[.685,.541,.5]],300);
  for(let i=0;i<20;i++){
    const x=.085+(i%5)*.156,y=.56+Math.floor(i/5)*.077+(i%3)*.01;
    add('watercolor',i%3?'#c2d1c4':'#2e7188',4+(i%3)*2,wave(y,x,x+.08,i,.001,8),230,{flow:.8,water:.25});
  }
  // A foreground patch of wildflowers with thick, bright petals.
  wash('#6b8264',65,[[.055,.875,.2],[.145,.844,.9],[.245,.901,.5]],700,{water:.4,flow:.75});
  for(let i=0;i<13;i++){
    const x=.064+i*.013,top=.768+(i%5)*.026;
    paint(i%2?'#4d715b':'#6f8155',4,[[x,.916,.9],[x-.012,top+.03,.7],[x+.003,top,.2]],320,{body:.7});
    paint('#819465',8,[[x-.004,top+.078,.8],[x-.025,top+.059,.15]],200);
    if(i%2===0){
      for(let petal=0;petal<5;petal++){
        const a=petal*Math.PI*2/5;
        paint(petal%2?'#eac77c':'#f2e6c9',9,[[x+.003,top,.9],[x+.003+Math.cos(a)*.009,top+Math.sin(a)*.012,.3]],170,{body:1});
      }
      paint('#b78b3c',6,[[x+.002,top,.9]],150,{body:.9});
    }
  }
  for(let i=0;i<4;i++)line('#697d7d',3,[[.54+i*.045,.185-i%2*.022,.1],[.551+i*.045,.174-i%2*.022,.8],[.565+i*.045,.185-i%2*.022,.1]],300);
  return {title:'Light returns to the harbor',strokes:s};
}
