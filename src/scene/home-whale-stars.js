function createHomeWhaleStars(){
  const canvas=q('.dc-home-stars'),ctx=canvas.getContext('2d');
  if(!ctx||typeof Path2D==='undefined')return{start(){},stop(){}};
  const silhouette=new Path2D(__DS_HOME_WHALE_PATH__),dots=[];
  const fraction=value=>value-Math.floor(value);
  const random=index=>fraction(Math.sin(index*127.1+311.7)*43758.5453);
  let width=0,height=0,dpr=1,frame=0,age=0,previous=0,lastPaint=0,running=false,phase='idle';
  for(let y=65;y<420;y+=9)for(let x=16;x<485;x+=9){
    if(!ctx.isPointInPath(silhouette,x,y,'evenodd'))continue;
    const index=dots.length,variation=random(index+1);
    dots.push({x:(x-250)/512,y:(y-242)/512,variation,
      targetX:.12+.82*fraction((index+.5)*.61803398875),
      targetY:.14+.44*fraction((index+.5)*.754877666),
      release:(1-x/512)*1.08+random(index+83)*.16,
      wind:random(index+40)*2-1,stays:index%4===0,spark:index%37===0,
      color:variation>.94?'#ffe8c8':'#c2ecff',
    });
  }
  canvas.dataset.particleCount=String(dots.length);
  canvas.dataset.starCount=String(dots.filter(dot=>dot.stays).length);
  function resize(){
    const rect=canvas.parentElement.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
    width=rect.width;height=rect.height;dpr=Math.min(window.devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function setPhase(next){
    if(next===phase)return;phase=next;canvas.dataset.phase=next;
    if(reduced)return;
    if(next==='whale')tone(9,.4);
    else if(next==='dispersing')tone(5,.35);
    else if(next==='stars')tone(2,.4);
  }
  function position(dot,progress,x,y){
    const endX=dot.targetX*width,endY=dot.targetY*height,rest=1-progress;
    return[
      rest*rest*rest*x+3*rest*rest*progress*(x+dot.wind*24)+3*rest*progress*progress*(endX+dot.wind*36)+progress*progress*progress*endX,
      rest*rest*rest*y+3*rest*rest*progress*(y-55-dot.variation*35)+3*rest*progress*progress*(endY+25)+progress*progress*progress*endY,
    ];
  }
  function paint(time){
    if(!width||!height)return;
    ctx.clearRect(0,0,width,height);
    setPhase(time<1.4?'waiting':time<2.8?'forming':time<5.6?'whale':time<9.8?'dispersing':'stars');
    if(time<1.4)return;
    const formed=ease(ramp(time,1.4,2.8)),dissolving=ramp(time,5.6,9.8);
    const size=Math.min(width*.46,224),cx=width*(width<450?.56:.62),cy=height*(width<450?.36:.39);
    ctx.save();ctx.globalCompositeOperation='lighter';
    ctx.beginPath();ctx.moveTo(width*.08,height*.16);ctx.bezierCurveTo(width*.45,height*.07,width*.88,height*.12,width*.98,height*.2);
    ctx.lineTo(width*.98,height*.47);ctx.quadraticCurveTo(width*.72,height*.69,width*.26,height*.67);ctx.lineTo(width*.06,height*.42);ctx.closePath();ctx.clip();
    const halo=ctx.createRadialGradient(cx,cy,0,cx,cy,size*.84);
    halo.addColorStop(0,`rgba(78,202,255,${.12*formed*(1-dissolving)})`);halo.addColorStop(.5,`rgba(24,111,255,${.04*formed*(1-dissolving)})`);halo.addColorStop(1,'rgba(20,98,255,0)');ctx.fillStyle=halo;ctx.fillRect(0,0,width,height);
    for(const dot of dots){
      if(time>=9.8&&!dot.stays)continue;
      const float=reduced?0:Math.sin(time*1.05)*3;
      let x=cx+dot.x*size,y=cy+dot.y*size+float;
      const flight=ease(clamp((time-5.6-dot.release)/3));
      x+=(1-formed)*dot.wind*48;y+=(1-formed)*(dot.variation-.5)*65;
      const [px,py]=position(dot,flight,x,y);
      const shimmer=reduced?1:.79+.21*Math.sin(time*(.65+dot.variation)+dot.variation*28);
      const opacity=formed*(dot.stays?(.67+.25*dot.variation)*(1-flight+flight*shimmer):(1-flight)*(.5+.44*dot.variation));
      if(opacity<.008)continue;
      const radius=(1.05+dot.variation*.28)*(1-flight)+(.4+dot.variation*.6)*flight;
      if(dot.spark&&flight>.025&&flight<.95){
        const [trailX,trailY]=position(dot,Math.max(0,flight-.045),x,y);
        ctx.globalAlpha=opacity*.28;ctx.strokeStyle='#89cfff';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(trailX,trailY);ctx.lineTo(px,py);ctx.stroke();
      }
      ctx.globalAlpha=opacity;ctx.fillStyle=flight>.5?dot.color:'#9eeaff';ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);ctx.fill();
      if(dot.stays&&dot.spark&&flight>.85){
        ctx.globalAlpha=opacity*.48;ctx.strokeStyle=dot.color;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(px-3.2,py);ctx.lineTo(px+3.2,py);ctx.moveTo(px,py-3.2);ctx.lineTo(px,py+3.2);ctx.stroke();
      }
    }
    ctx.restore();
  }
  function tick(now){
    frame=0;if(!running||document.hidden)return;
    age+=Math.min(100,Math.max(0,now-previous))/1000;previous=now;
    if(now-lastPaint>=40){paint(age);lastPaint=now;}
    frame=requestAnimationFrame(tick);
  }
  function resume(){if(!running||frame||document.hidden||reduced)return;previous=performance.now();frame=requestAnimationFrame(tick);}
  function stop(){running=false;cancelAnimationFrame(frame);frame=0;age=0;phase='idle';canvas.dataset.phase='idle';ctx.clearRect(0,0,width,height);}
  new ResizeObserver(()=>{resize();if(running)paint(age);}).observe(canvas.parentElement);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else resume();});
  window.addEventListener('pagehide',stop);
  return{start(){stop();running=true;resize();age=reduced?12:0;paint(age);resume();},stop};
}
const homeWhaleStars=createHomeWhaleStars();
