
const LENS_DB = {
  "Schneider": {
    "Macro-Symmar HM": [80, 120, 180],
    "Apo-Symmar": [100, 120, 135, 150, 180, 210, 240, 300, 360, 480],
    "Apo-Symmar L": [120, 150, 180, 210, 300],
    "Symmar-S": [100, 135, 150, 180, 210, 240, 300, 360],
    "Symmar HM": [120, 150, 180, 210],
    "Super-Angulon": [47, 58, 65, 75, 90, 120, 165],
    "Super-Angulon XL": [38, 47, 58, 72, 90, 110],
    "Super-Symmar XL": [80, 110, 150, 210],
    "G-Claron": [150, 210, 240, 270, 305, 355],
    "Componon-S": [80, 100, 135, 150, 180, 210]
  },
  "Rodenstock": {
    "Apo-Macro-Sironar": [120, 180],
    "Apo-Sironar-S": [100, 135, 150, 180, 210, 240, 300, 360],
    "Apo-Sironar-N": [100, 135, 150, 180, 210, 240, 300, 360],
    "Sironar-N": [135, 150, 180, 210, 240, 300, 360],
    "Sironar": [135, 150, 180, 210, 240, 300],
    "Grandagon": [65, 75, 90, 115, 155, 200],
    "Grandagon-N": [65, 75, 90, 115, 155, 200],
    "Apo-Grandagon": [35, 45, 55]
  },
  "Fujinon": {
    "Fujinon A": [180, 240, 300, 360],
    "Fujinon C": [300, 450, 600],
    "Fujinon W": [105, 125, 135, 150, 180, 210, 250, 300, 360],
    "Fujinon CM-W": [105, 125, 135, 150, 180, 210, 250, 300, 360],
    "Fujinon NW": [90, 105, 120, 135, 150, 180, 210, 250, 300],
    "Fujinon SW": [65, 75, 90, 105, 120, 125]
  },
  "Nikon": {
    "Nikkor AM": [120, 210],
    "Nikkor W": [100, 105, 135, 150, 180, 210, 240, 300, 360],
    "Nikkor M": [200, 300, 450],
    "Nikkor SW": [65, 75, 90, 120],
    "Nikkor ED": [180, 210, 300, 360, 480, 600, 800]
  },
  "Canon": {
    "Canon Large Format": [150, 180, 210, 240, 300],
    "Canon Process Lens": [135, 150, 180, 210]
  },
  "Kodak": {
    "Commercial Ektar": [152, 203, 254, 305],
    "Wide Field Ektar": [80, 100, 135, 190, 250],
    "Ektar Process": [135, 150, 180, 210]
  },
  "Goerz": {
    "Apo-Artar": [150, 210, 240, 305, 355, 480],
    "Dagor": [120, 150, 180, 210, 240, 300]
  },
  "Caltar": {
    "Caltar II-N": [90, 135, 150, 180, 210, 240, 300],
    "Caltar II-E": [90, 135, 150, 210],
    "Caltar S-II": [150, 180, 210, 240, 300]
  },
  "Wollensak": {
    "Velostigmat": [90, 135, 162, 210, 250],
    "Raptar": [90, 135, 162, 210, 250],
    "Optar": [90, 135, 162, 210]
  },
  "Konica": {
    "Hexanon GRII": [150, 210, 300],
    "Hexanon Process": [135, 150, 180, 210]
  },
  "Cooke": {
    "PS945": [229],
    "Series XVa": [311, 476, 646]
  },
  "その他": {
    "Process Lens": [135, 150, 180, 210, 240, 300],
    "Enlarging Lens": [80, 105, 135, 150, 180, 210],
    "Geronar": [150, 210, 300],
    "Xenar": [135, 150, 180, 210],
    "Artar": [150, 210, 240, 305, 355]
  }
};

function fillSelect(el, items){
  if(!el) return;
  el.innerHTML = "";
  items.forEach(v=>{
    const opt = document.createElement("option");
    opt.value = String(v);
    opt.textContent = String(v);
    el.appendChild(opt);
  });
}

function setupLensSelectors(){
  const maker = $("lensMaker");
  const series = $("lensSeries");
  const focalSel = $("lensFocal");
  const focal = $("focal");
  if(!maker || !series || !focalSel || !focal) return;

  fillSelect(maker, Object.keys(LENS_DB));
  maker.value = "Schneider";

  function updateSeries(){
    const list = Object.keys(LENS_DB[maker.value] || {});
    fillSelect(series, list);
    if(list.includes("Macro-Symmar HM")) series.value = "Macro-Symmar HM";
    updateFocal();
  }

  function updateFocal(){
    const focalList = (LENS_DB[maker.value] && LENS_DB[maker.value][series.value]) || [180];
    fillSelect(focalSel, focalList.map(v => v + "mm"));
    const preferred = focalList.includes(180) ? "180mm" : String(focalList[0]) + "mm";
    focalSel.value = preferred;
    applyFocal();
  }

  function applyFocal(){
    const mm = parseFloat(String(focalSel.value).replace("mm",""));
    if(!Number.isNaN(mm)) focal.value = mm;
    update();
  }

  maker.addEventListener("change", updateSeries);
  series.addEventListener("change", updateFocal);
  focalSel.addEventListener("change", applyFocal);
  updateSeries();
}

function update(){draw2D();updateInfo();draw3D()}function screen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));const tab=document.querySelector('.tab[data-go="'+id+'"]');if(tab)tab.classList.add('on');setTimeout(()=>{draw2D();draw3D();drawAxis3D()},80)}function setView(v){state.view=v;$('sideBtn').classList.toggle('on',v==='side');$('topBtn').classList.toggle('on',v==='top');update()}function setupApp(){document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>screen(b.dataset.go));$('sideBtn').onclick=()=>setView('side');$('topBtn').onclick=()=>setView('top');$('switchView').onclick=()=>{screen('shoot');setView(state.view==='side'?'top':'side')};$('fnum').onchange=()=>{$('fnumCustom').value=$('fnum').value;update()};['focal','bellows','bellowsCorrection','fnumCustom','coc'].forEach(id=>$(id).addEventListener('input',update));$('sensor').onchange=()=>{if($('sensor').value.includes('gfx'))$('coc').value='0.015';if($('sensor').value==='fullframe')$('coc').value='0.020';update()};setup2DDrag(); if(typeof setupHitLineDrag==='function') setupHitLineDrag();setup3D();setupLensSelectors();
  setupMeasurement();update();setIsoView()}window.addEventListener('load',setupApp)
