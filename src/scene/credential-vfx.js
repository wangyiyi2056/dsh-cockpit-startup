function createAuthorizationVFX(){
  const canvas=q('.dc-auth-canvas'),ctx=canvas.getContext('2d');
  let gate=null,kind='permission',phase='idle',started=0,phaseStart=0,frame=0,lastPaint=-100,width=0,height=0,dpr=1,lastScanStep=-1,lastWhaleTick=-1,whaleSoundCompleted=false;
  const tau=Math.PI*2,fract=x=>x-Math.floor(x);
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const fingerprint=document.createElement('canvas');fingerprint.width=360;fingerprint.height=460;
  const fingerCtx=fingerprint.getContext('2d'),ridges=fingerCtx.createImageData(360,460);
  // A synthetic ridge field represents the demo profile; no biometric input is read.
  for(let py=0;py<460;py++)for(let px=0;px<360;px++){
    const x=(px-180)/169,y=(py-230)/190,shape=x*x/.81+(y+.035)*(y+.035)/1.38;
    if(shape>=1)continue;
    const bentX=x+.16*Math.sin(y*2.3)+.055*y*y,bentY=(y+.18)*.86;
    const angle=Math.atan2(bentY,bentX),radius=Math.hypot(bentX,bentY);
    const field=radius*91+2*angle+.7*Math.sin(angle*2)+y*2.3;
    const ridge=Math.pow(Math.max(0,(Math.cos(field)-.03)/.97),2.3),edge=Math.min(1,(1-shape)*13);
    const index=(py*360+px)*4;ridges.data[index]=255;ridges.data[index+1]=255;ridges.data[index+2]=255;ridges.data[index+3]=Math.round(ridge*edge*235);
  }
  fingerCtx.putImageData(ridges,0,0);fingerCtx.globalCompositeOperation='source-in';
  const fingerprintTint=fingerCtx.createLinearGradient(0,0,360,460);fingerprintTint.addColorStop(0,'#b4fcff');fingerprintTint.addColorStop(.36,'#16eaff');fingerprintTint.addColorStop(.72,'#27a9ff');fingerprintTint.addColorStop(1,'#427dff');fingerCtx.fillStyle=fingerprintTint;fingerCtx.fillRect(0,0,360,460);
  const whaleSvg=q('.dc-whale-vector');
  const whaleReveal=whaleSvg.querySelector('.dc-whale-reveal-plane'),whaleRevealHeight=Number(whaleSvg.dataset.revealHeight);
  const whaleDrawTime=Number(whaleSvg.dataset.drawDuration);
  function drawWhale(time,elapsed,matched,leaving){
    const age=reduced?whaleDrawTime+2:time;
    whaleReveal.setAttribute('height',String(whaleRevealHeight*Math.min(1,Math.max(0,age/whaleDrawTime))));
    const completed=age>=whaleDrawTime;
    const traceStep=Math.floor(Math.min(whaleDrawTime,age)/.28);
    if(traceStep!==lastWhaleTick){if(phase==='idle'&&!completed&&!reduced)tone(8,.4);lastWhaleTick=traceStep;}
    if(completed&&!whaleSoundCompleted){if(phase==='idle'&&!reduced)tone(9,.5);whaleSoundCompleted=true;}
    const intro=completed&&age<whaleDrawTime+.75?Math.sin(Math.PI*smooth((age-whaleDrawTime)/.75)):0;
    const confirmation=matched&&!leaving&&age>whaleDrawTime+1?Math.sin(Math.PI*Math.min(1,elapsed/.85)):0;
    const flash=reduced?0:Math.max(intro,confirmation);
    whaleSvg.dataset.whaleState=!completed?'tracing':flash>.025?'flash':'ready';
    whaleSvg.dataset.drawProgress=String(Math.min(100,Math.round(age/whaleDrawTime*100)));
    whaleSvg.style.setProperty('--dc-whale-flash',String(flash));
    if(flash>.001){whaleSvg.style.setProperty('--dc-whale-stroke',`rgb(${Math.round(105+150*flash)},${Math.round(221+34*flash)},255)`);whaleSvg.style.setProperty('--dc-whale-glow',`rgb(${Math.round(84+171*flash)},${Math.round(220+35*flash)},255)`);}
    else{whaleSvg.style.removeProperty('--dc-whale-stroke');whaleSvg.style.removeProperty('--dc-whale-glow');}
    return flash;
  }
  function gradient(x1,y1,x2,y2,stops){const g=ctx.createLinearGradient(x1,y1,x2,y2);stops.forEach(([at,color])=>g.addColorStop(at,color));return g;}
  function line(points,color,lineWidth=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.stroke();}
  function ring(x,y,r,start,end,color,lineWidth=1){ctx.beginPath();ctx.arc(x,y,r,start,end);ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.stroke();}
  function resize(){const rect=root.getBoundingClientRect();width=rect.width;height=rect.height;dpr=Math.min(window.devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  function paint(now){
    if(!gate||gate.hidden)return;
    const rootRect=root.getBoundingClientRect(),anchor=gate.querySelector('.dc-auth-anchor').getBoundingClientRect();
    if(Math.abs(width-rootRect.width)>.5||Math.abs(height-rootRect.height)>.5)resize();
    const time=reduced?0:(now-started)/1000,elapsed=reduced?1:(now-phaseStart)/1000;
    const charging=phase==='charging',sealed=phase==='sealed',leaving=phase==='leaving',matched=sealed||leaving;
    const whaleFlash=kind==='permission'?drawWhale(time,elapsed,matched,leaving):0;
    const read=charging?smooth(elapsed/1.6):matched?1:0,exit=leaving?smooth(elapsed/.68):0;
    if(charging){const scanStep=Math.min(5,Math.floor(read*6));if(scanStep!==lastScanStep){if(scanStep>0&&!reduced)tone(7,.7);lastScanStep=scanStep;}}
    const cx=anchor.left-rootRect.left+anchor.width/2,cy=anchor.top-rootRect.top+anchor.height/2;
    const r=Math.min(anchor.height*.43,width*.285,108),strength=charging?.95:matched?1:.58;
    ctx.clearRect(0,0,width,height);ctx.save();ctx.globalAlpha=1-exit;
    const aura=ctx.createRadialGradient(cx,cy,r*.15,cx,cy,r*3.6);aura.addColorStop(0,`rgba(0,196,255,${.12+strength*.13})`);aura.addColorStop(.35,`rgba(16,98,255,${.035+strength*.035})`);aura.addColorStop(1,'rgba(10,62,180,0)');ctx.fillStyle=aura;ctx.fillRect(0,0,width,height);
    // A quiet registration field supplies a stable spatial reference for the scan.
    for(let y=-5;y<=5;y++)for(let x=-12;x<=12;x++){
      const dx=x*18,dy=y*18,fade=Math.max(0,1-Math.hypot(dx/(r*3.2),dy/(r*1.6)));ctx.fillStyle=`rgba(75,192,255,${fade*.17})`;ctx.fillRect(cx+dx,cy+dy,1,1);
    }
    // Two color-coded optical channels feed the credential rather than an abstract object.
    for(const side of [-1,1])for(let row=-1;row<=1;row++){
      const edge=cx+side*Math.min(width*.44,r*3.75),near=cx+side*r*1.43;
      const points=[[edge,cy+row*r*.94],[cx+side*r*2.13,cy+row*r*.94],[near,cy+row*r*.61],[cx+side*r*1.18,cy+row*r*.61]];
      line(points,gradient(edge,cy,near,cy,[[0,'rgba(10,189,255,0)'],[.5,`rgba(25,170,255,${.14+strength*.12})`],[1,`rgba(54,233,255,${.4+strength*.2})`]]),.7);
      const u=fract(time*(charging?.69:.13)+row*.29+side*.2),distance=u*3,index=Math.min(2,Math.floor(distance)),t=distance-index;
      const px=points[index][0]+(points[index+1][0]-points[index][0])*t,py=points[index][1]+(points[index+1][1]-points[index][1])*t;
      if(!reduced){ctx.shadowColor=charging?'#ffaf43':'#27deff';ctx.shadowBlur=10;ctx.fillStyle=charging?'#ffbf66':'#6df4ff';ctx.fillRect(px-3,py-.8,6,1.6);ctx.shadowBlur=0;}
      for(let tick=0;tick<7;tick++){
        const xx=cx+side*(r*2.28+tick*5);line([[xx,cy+row*r*.94-3],[xx,cy+row*r*.94+3]],`rgba(94,196,255,${.13+tick*.015})`,.6);
      }
    }
    const halfW=kind==='identity'?r*.9:r*1.27,halfH=kind==='identity'?r*1.15:r*.95;
    const offset=charging?6*Math.sin(read*Math.PI):0,cornerColor=matched?'rgba(126,250,255,.92)':'rgba(43,222,255,.73)';
    for(const sx of [-1,1])for(const sy of [-1,1]){
      const xx=cx+sx*(halfW+offset),yy=cy+sy*(halfH+offset);line([[xx-sx*22,yy],[xx,yy],[xx,yy-sy*15]],cornerColor,1.1);
      line([[xx-sx*9,yy+sy*5],[xx+sx*5,yy+sy*5],[xx+sx*5,yy-sy*9]],'rgba(44,139,255,.35)',.6);
    }
    const spriteW=kind==='identity'?r*1.7:r*3.12,spriteH=kind==='identity'?r*2.18:r*3.12;
    const left=cx-spriteW/2,top=cy-spriteH/2;
    if(kind==='identity'){ctx.save();ctx.shadowColor='#0bbdff';ctx.shadowBlur=matched?23:charging?18:10;ctx.globalAlpha*=charging?.24:.91;ctx.drawImage(fingerprint,left,top,spriteW,spriteH);ctx.restore();}
    // The reading pass reconstructs the colored signature from top to bottom.
    if(charging){
      const scanY=cy-halfH+read*halfH*2;
      if(kind==='identity'){ctx.save();ctx.beginPath();ctx.rect(left,top,spriteW,Math.max(0,scanY-top));ctx.clip();ctx.shadowColor='#28e9ff';ctx.shadowBlur=14;ctx.drawImage(fingerprint,left,top,spriteW,spriteH);ctx.restore();}
      const sheet=gradient(cx,scanY-32,cx,scanY+2,[[0,'rgba(255,160,48,0)'],[.85,'rgba(255,172,59,.045)'],[1,'rgba(255,184,80,.22)']]);ctx.fillStyle=sheet;ctx.fillRect(cx-halfW-12,scanY-32,halfW*2+24,34);
      line([[cx-halfW-18,scanY],[cx+halfW+18,scanY]],gradient(cx-halfW-18,scanY,cx+halfW+18,scanY,[[0,'rgba(255,163,48,0)'],[.2,'#ffad48bb'],[.5,'#fff0ce'],[.8,'#ffb24ebb'],[1,'rgba(255,174,67,0)']]),1.25);
      for(const side of [-1,1])line([[cx+side*(halfW+23),scanY-5],[cx+side*(halfW+29),scanY],[cx+side*(halfW+23),scanY+5]],'#ffc06b',1);
    }
    if(kind==='identity'){
      // Small feature correspondences make the scan legible as profile verification.
      const features=[[-.3,-.66],[.26,-.44],[-.42,-.15],[.12,.09],[.36,.4],[-.13,.63]];
      for(let i=0;i<features.length;i++){
        const [nx,ny]=features[i],visible=matched||charging&&read>(ny+1.15)/2.3;
        if(!visible)continue;const fx=cx+nx*r,fy=cy+ny*r;
        ring(fx,fy,3.2,0,tau,matched?'#a4ffff':'#ffc578',.8);
        if(i%2===0){const side=nx<0?-1:1;line([[fx+side*4,fy],[cx+side*(halfW+8),fy],[cx+side*(halfW+22),fy-10]],matched?'rgba(78,240,255,.65)':'rgba(255,187,94,.65)',.6);}
      }
    }else{
      // A broken carrier band identifies the image as a DeepSeek access signature.
      const baseY=cy+halfH+11;
      for(let i=0;i<32;i++){
        const bit=fract(Math.sin(i*43.41)*43758.545),active=matched||charging&&i/32<read;
        ctx.fillStyle=active?'rgba(78,239,255,.85)':i%7===0?'rgba(255,178,79,.64)':'rgba(37,149,255,.26)';ctx.fillRect(cx-r*1.1+i*r*.07,baseY,bit>.6?2:1,bit>.6?7:4);
      }
    }
    // Edge measurements stay fixed while only the light packet and scan plane move.
    for(let i=-3;i<=3;i++)for(const side of [-1,1]){
      const xx=cx+side*(halfW+10),yy=cy+i*halfH*.24;line([[xx,yy],[xx+side*(i===0?10:4),yy]],i===0?'rgba(255,188,99,.75)':'rgba(70,204,255,.35)',.65);
    }
    if(matched||whaleFlash>0){
      const t=leaving||!matched?1:Math.min(1,elapsed/.95),wave=smooth(t),flash=Math.max(whaleFlash,leaving||!matched?0:Math.sin(Math.min(1,elapsed/.85)*Math.PI));
      const spread=wave*r*1.5,alpha=(1-wave)*.6;
      for(const side of [-1,1]){
        line([[cx+side*(halfW+spread),cy-halfH-spread*.3],[cx+side*(halfW+spread),cy+halfH+spread*.3]],`rgba(75,239,255,${alpha})`,1);
        line([[cx-halfW-spread*.35,cy+side*(halfH+spread*.3)],[cx+halfW+spread*.35,cy+side*(halfH+spread*.3)]],`rgba(68,161,255,${alpha*.65})`,.6);
      }
      ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=gradient(0,cy,width,cy,[[0,'rgba(0,179,255,0)'],[.25,`rgba(0,191,255,${flash*.16})`],[.46,`rgba(26,229,255,${flash*.6})`],[.5,`rgba(211,255,255,${flash})`],[.54,`rgba(42,182,255,${flash*.6})`],[.75,`rgba(26,106,255,${flash*.16})`],[1,'rgba(19,95,255,0)']]);ctx.shadowColor='#5bf3ff';ctx.shadowBlur=22;ctx.fillRect(0,cy-1,width,2);ctx.shadowBlur=0;
      const bloom=ctx.createRadialGradient(cx,cy,0,cx,cy,r*1.8);bloom.addColorStop(0,`rgba(98,234,255,${flash*.19})`);bloom.addColorStop(.5,`rgba(10,141,255,${flash*.08})`);bloom.addColorStop(1,'rgba(10,111,255,0)');ctx.fillStyle=bloom;ctx.fillRect(0,0,width,height);ctx.restore();
    }
    if(leaving){ctx.globalAlpha=1;const curtain=Math.sin(exit*Math.PI);ctx.fillStyle=gradient(0,0,width,height,[[0,'rgba(15,151,255,0)'],[.4,`rgba(0,174,255,${curtain*.04})`],[.5,`rgba(105,244,255,${curtain*.18})`],[.6,`rgba(20,111,255,${curtain*.04})`],[1,'rgba(20,111,255,0)']]);ctx.fillRect(0,0,width,height);}
    ctx.restore();
  }
  function tick(now){frame=0;if(!gate||document.hidden)return;if(now-lastPaint>=32){paint(now);lastPaint=now;}if(!reduced)frame=requestAnimationFrame(tick);}
  function run(){if(!frame&&gate&&!document.hidden){lastPaint=-100;frame=requestAnimationFrame(tick);}}
  function status(next){phase=next;phaseStart=performance.now();lastScanStep=-1;root.classList.toggle('dc-auth-charging',next==='charging');root.classList.toggle('dc-auth-sealed',next==='sealed');if(reduced)paint(phaseStart+1000);else run();}
  function stop(){cancelAnimationFrame(frame);frame=0;gate=null;canvas.hidden=true;ctx.clearRect(0,0,width,height);root.classList.remove('dc-auth-charging','dc-auth-sealed');whaleReveal.setAttribute('height','0');whaleSvg.dataset.whaleState='tracing';whaleSvg.dataset.drawProgress='0';whaleSvg.style.removeProperty('--dc-whale-flash');whaleSvg.style.removeProperty('--dc-whale-stroke');whaleSvg.style.removeProperty('--dc-whale-glow');}
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else run();});window.addEventListener('pagehide',stop);
  return{show(nextGate,nextKind){stop();gate=nextGate;kind=nextKind;lastWhaleTick=-1;whaleSoundCompleted=false;canvas.hidden=false;started=performance.now();resize();status('idle');},remainingReveal(){return reduced||kind!=='permission'?0:Math.max(0,whaleDrawTime*1000-(performance.now()-started));},charge(){status('charging');},seal(){status('sealed');},leave(){status('leaving');},stop};
}
const authorizationVFX=createAuthorizationVFX();
