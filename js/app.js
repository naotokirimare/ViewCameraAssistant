
let fineHoldTimer = null;
let fineHoldInterval = null;

function fineTargetParts(){
  const value = $("fineTarget") ? $("fineTarget").value : "side.front";
  const [axis,target] = value.split(".");
  return {axis,target};
}

function fineLimit(target){
  if(target === "product") return 180;
  return 90;
}

function updateFineCurrent(){
  const el = $("fineCurrent");
  if(!el) return;
  const {axis,target} = fineTargetParts();
  const val = state.data[axis][target] || 0;
  el.textContent = `${val.toFixed(1)}°`;
}

function adjustFineTarget(step){
  const {axis,target} = fineTargetParts();
  const limit = fineLimit(target);
  state.data[axis][target] = clamp((state.data[axis][target] || 0) + step, -limit, limit);
  if(axis !== state.view){
    setView(axis);
  }else{
    update();
  }
  updateFineCurrent();
}

function resetFineTarget(){
  const {axis,target} = fineTargetParts();
  state.data[axis][target] = 0;
  if(axis !== state.view){
    setView(axis);
  }else{
    update();
  }
  updateFineCurrent();
}

function startFineHold(step){
  stopFineHold();
  adjustFineTarget(step);
  fineHoldTimer = setTimeout(()=>{
    fineHoldInterval = setInterval(()=>adjustFineTarget(step), 90);
  }, 420);
}

function stopFineHold(){
  if(fineHoldTimer) clearTimeout(fineHoldTimer);
  if(fineHoldInterval) clearInterval(fineHoldInterval);
  fineHoldTimer = null;
  fineHoldInterval = null;
}

function setupFineControls(){
  document.querySelectorAll(".fineButtons [data-step]").forEach(btn=>{
    const step = Number(btn.dataset.step);
    btn.addEventListener("click", (e)=>{ e.preventDefault(); });
    btn.addEventListener("mousedown", (e)=>{ e.preventDefault(); startFineHold(step); });
    btn.addEventListener("mouseup", stopFineHold);
    btn.addEventListener("mouseleave", stopFineHold);
    btn.addEventListener("touchstart", (e)=>{ e.preventDefault(); startFineHold(step); }, {passive:false});
    btn.addEventListener("touchend", stopFineHold);
    btn.addEventListener("touchcancel", stopFineHold);
  });
  if($("fineReset")) $("fineReset").addEventListener("click", resetFineTarget);
  if($("fineTarget")) $("fineTarget").addEventListener("change", ()=>{
    const {axis} = fineTargetParts();
    if(axis !== state.view) setView(axis);
    updateFineCurrent();
  });
  if($("fineControls")) $("fineControls").addEventListener("toggle", updateFineCurrent);
  updateFineCurrent();
}




function update(){draw2D();updateInfo();draw3D()}function screen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));const tab=document.querySelector('.tab[data-go="'+id+'"]');if(tab)tab.classList.add('on');setTimeout(()=>{draw3D();drawAxis3D()},60)}function setView(v){state.view=v;$('sideBtn').classList.toggle('on',v==='side');$('topBtn').classList.toggle('on',v==='top');update()}function setupApp(){document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>screen(b.dataset.go));$('sideBtn').onclick=()=>setView('side');$('topBtn').onclick=()=>setView('top');$('switchView').onclick=()=>{screen('shoot');setView(state.view==='side'?'top':'side')};$('lens').onchange=()=>{$('focal').value=$('lens').value;update()};$('fnum').onchange=()=>{$('fnumCustom').value=$('fnum').value;update()};['focal','bellows','fnumCustom','coc'].forEach(id=>$(id).addEventListener('input',update));$('sensor').onchange=()=>{if($('sensor').value.includes('gfx'))$('coc').value='0.015';if($('sensor').value==='fullframe')$('coc').value='0.020';update()};setup2DDrag();setup3D();setupMeasurement();update();setIsoView()}window.addEventListener('load',setupApp)
