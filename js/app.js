
function adjustFineTarget(step){
  const target = $("fineTarget") ? $("fineTarget").value : "front";
  const s = state.data[state.view];
  const limits = { product:180, camera:90, front:90, rear:90 };
  s[target] = clamp((s[target] || 0) + step, -limits[target], limits[target]);
  update();
}
function resetFineTarget(){
  const target = $("fineTarget") ? $("fineTarget").value : "front";
  state.data[state.view][target] = 0;
  update();
}
function setupFineControls(){
  document.querySelectorAll(".fineButtons [data-step]").forEach(btn=>{
    btn.addEventListener("click", ()=>adjustFineTarget(Number(btn.dataset.step)));
  });
  if($("fineReset")) $("fineReset").addEventListener("click", resetFineTarget);
}

function update(){draw2D();updateInfo();draw3D()}function screen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));const tab=document.querySelector('.tab[data-go="'+id+'"]');if(tab)tab.classList.add('on');setTimeout(()=>{draw3D();drawAxis3D()},60)}function setView(v){state.view=v;$('sideBtn').classList.toggle('on',v==='side');$('topBtn').classList.toggle('on',v==='top');update()}function setupApp(){document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>screen(b.dataset.go));$('sideBtn').onclick=()=>setView('side');$('topBtn').onclick=()=>setView('top');$('switchView').onclick=()=>{screen('shoot');setView(state.view==='side'?'top':'side')};$('lens').onchange=()=>{$('focal').value=$('lens').value;update()};$('fnum').onchange=()=>{$('fnumCustom').value=$('fnum').value;update()};['focal','bellows','fnumCustom','coc'].forEach(id=>$(id).addEventListener('input',update));$('sensor').onchange=()=>{if($('sensor').value.includes('gfx'))$('coc').value='0.015';if($('sensor').value==='fullframe')$('coc').value='0.020';update()};setup2DDrag();setup3D();setupMeasurement();update();setIsoView()}window.addEventListener('load',setupApp)
