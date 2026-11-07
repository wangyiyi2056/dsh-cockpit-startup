const homeVideo=q('.dc-home-video');
homeVideo.muted=true;homeVideo.defaultMuted=true;
const bundledHomeVideo=homeVideo.getAttribute('src'),bundledHomePoster=homeVideo.getAttribute('poster');
const homeMedia=createAmbientVideo(homeVideo,{source:config.backgroundVideo||(config.backgroundImage?'':bundledHomeVideo),fallback:bundledHomeVideo,poster:config.backgroundImage||bundledHomePoster,reduced,onState:value=>root.dataset.videoState=value});
const waitForBeat=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
function setMode(mode){state.mode=mode;root.dataset.phase=mode;}
function updateHomeCopy(){
  const text=copy();
  for(const [selector,value] of [['.dc-home-title',text.homeTitle],['.dc-home-headline',text.homeHeadline]]){
    const heading=q(selector),wordmark=selector==='.dc-home-title';if(heading.getAttribute('data-copy-value')===value&&(!wordmark||heading.childElementCount))continue;
    heading.replaceChildren();heading.setAttribute('data-copy-value',value);heading.setAttribute('aria-label',wordmark?'DeepSeek Harness':value.replaceAll('\n',' '));
    if(!wordmark){heading.textContent=value;continue;}
    let index=0,delay=.12;
    for(const character of Array.from(value)){
      if(character==='\n'){heading.append(document.createElement('br'));continue;}
      const interval=Math.max(.055,(wordmark ? .42 : .14)*Math.pow(wordmark ? .76 : .9,index));
      const duration=wordmark ? Math.max(.13,interval*.94) : .24;
      const letter=document.createElement('span');letter.className='dc-letter';letter.textContent=character;letter.dataset.glyph=character;letter.setAttribute('aria-hidden','true');
      letter.style.setProperty('--dc-char-delay',delay.toFixed(3)+'s');letter.style.setProperty('--dc-char-duration',duration.toFixed(3)+'s');heading.append(letter);delay+=interval;index++;
    }
  }
}
function playHomeBackground(){
  if(state.motionPaused||document.hidden)return;
  homeMedia.play();
}
function render(p,quiet=false){
  state.p=clamp(p);p=state.p;
  const power=ease(ramp(p,.035,.32)),solid=ease(ramp(p,.36,.61));
  const cut=100-ease(ramp(p,.36,.65))*100;
  const form=ease(ramp(p,.83,1)),move=ease(ramp(p,.77,.96));
  const diagram=ease(ramp(p,.56,.72))*(1-ease(ramp(p,.80,.92)));
  set('--dc-scene-light',(.17+power*.83)*config.illumination);
  set('--dc-power',power);set('--dc-unpowered',(100-ramp(p,.06,.28)*100)+'%');
  set('--dc-core-alpha',solid);set('--dc-core-cut',cut+'%');set('--dc-core-scan',cut+'%');
  set('--dc-scan-alpha',ramp(p,.31,.38)*(1-ramp(p,.63,.69))*.8);
  set('--dc-intro',1-ease(ramp(p,.07,.21)));set('--dc-diagram',diagram);
  q('.dc-diagnostics').setAttribute('aria-hidden',String(diagram<.05));
  set('--dc-path',520*(1-ramp(p,.58,.76)));set('--dc-form',form);set('--dc-move',move);
  set('--dc-progress',Math.floor(p*100)+'%');
  q('.dc-percent').textContent=String(Math.floor(p*100)).padStart(2,'0');q('.dc-loader-track').setAttribute('aria-valuenow',String(Math.floor(p*100)));
  let index=0;stages.forEach((stage,i)=>{if(p>=stage.at)index=i;});
  if(index!==state.lastPhase){state.lastPhase=index;refreshPhaseCopy();if(!quiet&&state.mode==='booting')announceStage(index);}
  const loadPulse=loadingPulseMarks.filter(at=>p>=at).length;
  if(loadPulse!==state.lastLoadPulse){
    if(state.lastLoadPulse>=0&&!quiet&&state.mode==='booting')tone(8,.7);
    state.lastLoadPulse=loadPulse;
  }
  const ready=p>=1;root.classList.toggle('dc-login-ready',ready);
  q('.dc-granted').inert=!ready;q('.dc-granted').setAttribute('aria-hidden',String(!ready));q('.dc-boot-copy').setAttribute('aria-hidden',String(ready));
  q('.dc-skip').hidden=ready||!['booting','review'].includes(state.mode);
  drawCore(p);drawDust(p);
}
function resetUI(){
  cancelAnimationFrame(state.frame);authorizationVFX.stop();homeWhaleStars.stop();state.lastPhase=-1;state.lastLoadPulse=-1;state.linkStep=-1;state.flowToken++;stopAudio();homeVideo.pause();
  root.classList.remove('dc-key-focused','dc-key-filled','dc-entry-hover','dc-connecting','dc-home-active','dc-preflight');
  root.style.removeProperty('--dc-boot-opacity');set('--dc-home',0);set('--dc-transition',0);set('--dc-transition-y','-100%');
  q('.dc-permission').hidden=true;q('.dc-login').hidden=true;q('.dc-granted').hidden=true;q('.dc-home').hidden=true;q('.dc-home').inert=true;
  for(const gate of [q('.dc-permission'),q('.dc-login')]){gate.classList.remove('dc-gate-processing','dc-gate-confirmed','dc-gate-exit');gate.removeAttribute('aria-busy');gate.querySelector('.dc-gate-status').textContent='';}
  q('.dc-permit').disabled=false;q('.dc-form').inert=false;q('.dc-confirm').disabled=false;q('.dc-enter').disabled=false;
  q('.dc-bottom-brand').hidden=false;q('.dc-boot-copy').hidden=false;q('.dc-skip').hidden=true;
  refreshAccessCopy();
}
function beginAccess(){
  resetUI();state.identityConfirmed=false;state.permissionAnnounced=false;setMode('permission');root.classList.add('dc-preflight');render(0,true);set('--dc-scene-light',.53*config.illumination);
  q('.dc-permission').hidden=false;q('.dc-boot-copy').hidden=true;refreshAccessCopy();
  authorizationVFX.show(q('.dc-permission'),'permission');
  if(state.audioUnlocked)narration.unlock();
  announcePermission();
  notify('ready');q('.dc-permit').focus({preventScroll:true});
}
function announcePermission(){
  if(state.permissionAnnounced)return state.permissionSpeech||Promise.resolve();
  if(!['permission','permitting'].includes(state.mode)||!config.sound||!state.audioUnlocked||document.hidden)return Promise.resolve();
  state.permissionAnnounced=true;state.permissionSpeech=narrate('Access permission required.').then(result=>{if(result==='not-allowed'){state.permissionAnnounced=false;state.audioUnlocked=false;}return result;});
  return state.permissionSpeech;
}
async function lockGate(gate,flow,mode,confirmationSpeech=''){
  if(flow!==state.flowToken||state.mode!==mode)return false;
  gate.classList.remove('dc-gate-processing');gate.classList.add('dc-gate-confirmed');authorizationVFX.seal();refreshAccessCopy();tone(3);
  await Promise.all([confirmationSpeech?narrate(confirmationSpeech):Promise.resolve(),waitForBeat(reduced?100:950)]);
  if(flow!==state.flowToken||state.mode!==mode)return false;
  gate.classList.add('dc-gate-exit');authorizationVFX.leave();await waitForBeat(reduced?0:680);
  return flow===state.flowToken&&state.mode===mode;
}
async function confirmPermission(){
  if(state.mode!=='permission')return;
  const flow=++state.flowToken,gate=q('.dc-permission');setMode('permitting');q('.dc-permit').disabled=true;gate.setAttribute('aria-busy','true');gate.classList.add('dc-gate-processing');authorizationVFX.charge();refreshAccessCopy();tone(1);
  await Promise.all([waitForBeat(Math.max(reduced?100:1550,authorizationVFX.remainingReveal())),announcePermission()]);
  if(!await lockGate(gate,flow,'permitting'))return;
  setMode('identity');q('.dc-permission').hidden=true;q('.dc-login').hidden=false;q('.dc-login').inert=false;q('.dc-login').setAttribute('aria-hidden','false');
  set('--dc-form',1);authorizationVFX.show(q('.dc-login'),'identity');refreshAccessCopy();q('.dc-confirm').focus({preventScroll:true});narrate('Confirm ID.');save();
}
async function confirmIdentity(){
  if(state.mode!=='identity')return;
  const flow=++state.flowToken,gate=q('.dc-login');setMode('verifying');root.classList.add('dc-connecting');q('.dc-confirm').disabled=true;q('.dc-form').inert=true;gate.setAttribute('aria-busy','true');gate.classList.add('dc-gate-processing');
  state.linkStep=0;authorizationVFX.charge();refreshAccessCopy();tone(1);
  await waitForBeat(reduced?100:1550);
  if(flow!==state.flowToken||state.mode!=='verifying')return;
  state.linkStep=1;if(!await lockGate(gate,flow,'verifying','ID confirmed.'))return;
  state.identityConfirmed=true;startLoading();
}
function finishStartup(){
  cancelAnimationFrame(state.frame);stopAudio();setMode('granted');q('.dc-granted').hidden=false;render(1,true);refreshAccessCopy();q('.dc-enter').focus({preventScroll:true});tone(4);narrate('Access granted.');save();
}
function startLoading(){
  resetUI();setMode('booting');inspector.reveal=0;state.manualReveal=0;q('.dc-granted').hidden=false;
  dimensions();
  if(reduced){finishStartup();return;}
  let previous=performance.now();
  function tick(time){
    if(state.mode!=='booting')return;
    const dt=Math.min(100,Math.max(0,time-previous));previous=time;
    let p=clamp(state.p+dt/(config.duration*1000));
    render(p);if(p>=1){finishStartup();return;}state.frame=requestAnimationFrame(tick);
  }
  render(0,true);announceStage(0);state.frame=requestAnimationFrame(tick);save();
}
function enterHome(){
  if(state.mode!=='granted')return;
  stopAudio();const flow=++state.flowToken;setMode('entering');q('.dc-enter').disabled=true;q('.dc-granted').inert=true;set('--dc-boot-opacity',0);
  q('.dc-home').hidden=false;q('.dc-home').inert=true;updateHomeCopy();playHomeBackground();homeWhaleStars.start();tone(5);
  state.welcomePending=true;state.welcomeSpeech=narrate('Welcome back, DeepSeek Harness.').then(()=>{state.welcomePending=false;notify('welcomeComplete');});
  const started=performance.now();
  function tick(time){
    if(flow!==state.flowToken||state.mode!=='entering')return;
    const t=reduced?1:clamp((time-started)/1450);
    set('--dc-home',ease(ramp(t,.12,1)));set('--dc-form',1-ease(ramp(t,0,.55)));
    set('--dc-transition',Math.sin(t*Math.PI)*.55);set('--dc-transition-y',(-90+t*180)+'%');
    if(t>=.35)root.classList.add('dc-home-active');
    if(t>=1){setMode('entered');q('.dc-home').inert=false;q('.dc-home').tabIndex=-1;q('.dc-home').focus({preventScroll:true});q('.dc-granted').hidden=true;q('.dc-bottom-brand').hidden=true;q('.dc-boot-copy').hidden=true;set('--dc-transition',0);save();notify('home',{reduced,voicePending:state.welcomePending});return;}
    state.frame=requestAnimationFrame(tick);
  }
  state.frame=requestAnimationFrame(tick);
}
function reviewProgress(value){
  resetUI();setMode(value>=100?'granted':'review');q('.dc-granted').hidden=false;dimensions();render(value/100,true);refreshAccessCopy();
}
root.addEventListener('animationstart',event=>{
  if(!['entering','entered'].includes(state.mode))return;
  const letter=event.target;
  if(event.animationName==='dc-wordmark-launch'&&letter.parentElement?.classList.contains('dc-home-title'))tone(8,.85);
  else if(event.animationName==='dc-tagline-in'&&letter.classList.contains('dc-home-headline'))tone(2,.45);
});
root.addEventListener('animationend',event=>{
  if(!['entering','entered'].includes(state.mode)||event.animationName!=='dc-wordmark-launch')return;
  const letter=event.target,heading=letter.parentElement;
  if(heading?.classList.contains('dc-home-title')&&heading.lastElementChild===letter)tone(9,.65);
});
q('.dc-permit').addEventListener('click',confirmPermission);q('.dc-confirm').addEventListener('click',confirmIdentity);q('.dc-enter').addEventListener('click',enterHome);
for(const command of qa('.dc-submit')){
  command.addEventListener('pointerenter',()=>root.classList.add('dc-entry-hover'));command.addEventListener('pointerleave',()=>root.classList.remove('dc-entry-hover'));
  command.addEventListener('focus',()=>root.classList.add('dc-entry-hover'));command.addEventListener('blur',()=>root.classList.remove('dc-entry-hover'));
}
q('.dc-skip').addEventListener('click',()=>{if(state.mode==='booting'||state.mode==='review')finishStartup();});
function unlockOnInteraction(event){
  if(!config.sound||event.target.closest('.dc-sound'))return;
  state.audioUnlocked=true;updateSound();narration.load();narration.unlock();announcePermission();
}
root.addEventListener('pointerdown',unlockOnInteraction,{capture:true});root.addEventListener('keydown',unlockOnInteraction,{capture:true});
q('.dc-language').addEventListener('click',()=>{config.language=config.language==='en'?'zh':'en';applyLocale();save();});
q('.dc-sound').addEventListener('click',()=>{state.audioUnlocked=true;config.sound=!config.sound;stopAudio();updateSound();if(config.sound){narration.load();narration.unlock();tone(1);announcePermission();}save();});
document.addEventListener('keydown',async event=>{
  if(event.key==='Escape'){event.preventDefault();stopAudio();notify('exit');}
  else if(event.key==='Enter'&&state.mode==='entered'){event.preventDefault();await state.welcomeSpeech;if(state.mode==='entered')notify('exit');}
});
