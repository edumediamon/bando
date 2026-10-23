import { stages, clamp, advancePlayback } from './process.js';
import { buildScene } from './model.js';
import { createRenderer } from './renderer.js';

const $=id=>document.getElementById(id);
const state={stage:0,progress:0,section:false,playing:false,speed:1};
let renderer,needsMesh=true,lastFrame=0,lastMesh=0,frameId;
const stageButtons=[];

for(const [index,stage] of stages.entries()) {
  const button=document.createElement('button');
  button.className='stage-button';
  const number=document.createElement('span');number.className='stage-index';number.textContent=String(index+1).padStart(2,'0');
  const copy=document.createElement('span');copy.className='stage-copy';
  const title=document.createElement('b');title.textContent=stage.name;
  const subtitle=document.createElement('small');subtitle.textContent=stage.short;
  copy.append(title,subtitle);button.append(number,copy);
  button.addEventListener('click',()=>selectStage(index));
  $('stage-list').append(button);stageButtons.push(button);
  const link=document.createElement('a');link.href=stage.source;link.target='_blank';link.rel='noopener noreferrer';link.textContent=`${String(index+1).padStart(2,'0')} ${stage.name} ↗`;
  $('sources-list').append(link);
}

function selectStage(index,progress=0,keepPlaying=false) {
  state.stage=Math.floor(clamp(index,0,stages.length-1));state.progress=progress;
  if(!keepPlaying) state.playing=false;
  updateStage();updateProgress();needsMesh=true;requestFrame();
}

function updateStage() {
  const stage=stages[state.stage],number=String(state.stage+1).padStart(2,'0');
  for(const [i,button] of stageButtons.entries()) {
    if(i===state.stage) button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
  }
  $('stage-category').textContent=stage.category;
  $('stage-number').replaceChildren(document.createTextNode(number+' '),Object.assign(document.createElement('span'),{textContent:'/ 08'}));
  $('stage-name').textContent=stage.name;$('stage-english').textContent=stage.english;
  $('stage-description').textContent=stage.description;$('key-point').textContent=stage.point;
  $('scene-kicker').textContent=`${number} / ${stage.english.toUpperCase()}`;
  $('scene-title').textContent=stage.headline;
  $('model-label').textContent=state.section && state.stage!==7 ? `${stage.label} · 단면` : stage.label;
  $('model-sublabel').textContent=stage.sublabel;
  $('playback-name').textContent=stage.name;
  $('stage-source').href=stage.source;
  $('legend').replaceChildren(...stage.materials.map(([label,color])=>{
    const item=document.createElement('span'),swatch=document.createElement('i');swatch.style.setProperty('--swatch',color);item.append(swatch,document.createTextNode(label));return item;
  }));
  $('substeps').replaceChildren(...stage.steps.map((text,index)=>{
    const item=document.createElement('li'),number=document.createElement('span');number.textContent=index+1;item.append(number,document.createTextNode(text));return item;
  }));
  $('previous').disabled=state.stage===0;
  $('next').disabled=state.stage===stages.length-1;
  $('announcement').textContent=`${number}번째 공정, ${stage.name}. ${stage.description}`;
  document.title=`${stage.name} — FAB LAB`;
}

function updateProgress() {
  const percent=Math.round(state.progress*100);
  $('progress').value=percent;$('progress-value').value=percent+'%';
  $('progress').style.setProperty('--progress',percent+'%');
  $('substeps').querySelectorAll('li').forEach((item,i)=>item.classList.toggle('active',i<=Math.min(2,Math.floor(state.progress*3))));
  $('play').ariaLabel=state.playing ? '공정 일시정지' : state.progress>=1 ? '현재 공정 다시 재생' : '공정 재생';
  $('play').innerHTML=state.playing ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 4h3v12H5zm7 0h3v12h-3z"/></svg>' : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6Z"/></svg>';
  $('playback-status').textContent=state.playing ? '공정의 변화를 따라가고 있습니다' : state.stage===7 && state.progress>=1 ? '모든 공정을 살펴봤습니다 · 다시 재생할 수 있어요' : '원하는 지점에서 자세히 살펴보세요';
}

function requestFrame() {
  if(!frameId && !document.hidden) frameId=requestAnimationFrame(frame);
}

function frame(now) {
  frameId=null;
  const seconds=lastFrame ? Math.min((now-lastFrame)/1000,.1) : 0;lastFrame=now;
  if(state.playing) {
    const next=advancePlayback(state.stage,state.progress,seconds,state.speed),changed=next.stage!==state.stage;
    Object.assign(state,next);
    if(changed) updateStage();
    needsMesh=true;
  }
  if(needsMesh && (now-lastMesh>45 || !state.playing)) {
    renderer?.setMesh(buildScene(state.stage,state.progress,state.section));
    updateProgress();needsMesh=false;lastMesh=now;
  }
  renderer?.render();
  if(state.playing || needsMesh) requestFrame();
}

$('play').addEventListener('click',()=>{
  if(!state.playing && state.progress>=1) selectStage(state.stage,0);
  state.playing=!state.playing;lastFrame=0;updateProgress();requestFrame();
});
$('progress').addEventListener('input',event=>{state.progress=clamp(Number(event.target.value)/100,0,1);state.playing=false;needsMesh=true;updateProgress();requestFrame();});
$('speed').addEventListener('change',event=>{state.speed=clamp(Number(event.target.value),.5,2);});
$('previous').addEventListener('click',()=>selectStage(state.stage-1));
$('next').addEventListener('click',()=>selectStage(state.stage+1));
for(const [id,section] of [['wafer-view',false],['section-view',true]]) $(id).addEventListener('click',()=>{
  state.section=section;$('wafer-view').setAttribute('aria-pressed',String(!section));$('section-view').setAttribute('aria-pressed',String(section));updateStage();needsMesh=true;requestFrame();
});
for(const [id,action] of [['zoom-in',()=>renderer?.zoom(.88)],['zoom-out',()=>renderer?.zoom(1.12)],['camera-reset',()=>renderer?.reset()],['top-view',()=>renderer?.top()]]) $(id).addEventListener('click',()=>{action();requestFrame();});

for(const name of ['guide','sources']) {
  const dialog=$(name+'-dialog'),opener=$(name+'-open');
  opener.addEventListener('click',()=>{state.playing=false;updateProgress();dialog.showModal();});
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
}

function initRenderer() {
  try {renderer=createRenderer($('scene'));$('webgl-error').hidden=true;needsMesh=true;requestFrame();}
  catch(error) {console.warn('3D renderer unavailable:',error.message);$('webgl-error').hidden=false;}
}

initRenderer();updateStage();updateProgress();requestFrame();
// Render on interaction and resize, with a bounded animation loop only while playing.
for(const name of ['pointermove','wheel','keydown']) $('scene').addEventListener(name,requestFrame);
window.addEventListener('resize',requestFrame);
const resizeObserver=new ResizeObserver(requestFrame);resizeObserver.observe($('canvas-wrap'));
document.addEventListener('visibilitychange',()=>{lastFrame=0;if(document.hidden){if(frameId)cancelAnimationFrame(frameId);frameId=null;}else requestFrame();});
$('scene').addEventListener('webglcontextlost',event=>{event.preventDefault();state.playing=false;renderer?.dispose();renderer=null;$('webgl-error').hidden=false;updateProgress();});
$('scene').addEventListener('webglcontextrestored',initRenderer);
