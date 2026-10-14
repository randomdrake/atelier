// Arc-length sampling separates paint deposition from browser frame rate.
export class StrokePlayback {
  constructor(stroke,width,height){
    this.stroke=stroke;this.width=width;this.height=height;this.elapsed=0;this.next=0;this.done=false;
    this.distances=[0];
    for(let i=1;i<stroke.points.length;i++){const a=stroke.points[i-1],b=stroke.points[i];this.distances.push(this.distances.at(-1)+Math.hypot((b[0]-a[0])*width,(b[1]-a[1])*height));}
    this.length=this.distances.at(-1);this.spacing=Math.max(.6,stroke.size*.07);this.drawn=[];
  }
  at(distance){
    let i=1;while(i<this.distances.length-1&&this.distances[i]<distance)i++;
    const a=this.stroke.points[Math.max(0,i-1)],b=this.stroke.points[Math.min(i,this.stroke.points.length-1)];
    const start=this.distances[Math.max(0,i-1)],end=this.distances[Math.min(i,this.distances.length-1)];
    const t=end>start?Math.min(1,Math.max(0,(distance-start)/(end-start))):0;
    return {point:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,(a[2]??.7)+((b[2]??.7)-(a[2]??.7))*t],angle:Math.atan2((b[1]-a[1])*this.height,(b[0]-a[0])*this.width)};
  }
  advance(milliseconds,dab){
    if(this.done)return;
    this.elapsed+=milliseconds;const duration=this.stroke.duration??600;
    const progress=duration===0?1:Math.min(1,this.elapsed/duration),limit=this.length*progress;
    while(this.next<=limit){const mark=this.at(this.next);dab(mark.point,mark.angle);this.drawn.push(mark.point);this.next+=this.spacing;}
    if(progress===1){if(this.length>0&&this.next-this.spacing<this.length){const mark=this.at(this.length);dab(mark.point,mark.angle);this.drawn.push(mark.point);}this.done=true;}
  }
}
