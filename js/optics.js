
function getBellowsLength(){
  return $("bellows") ? (+$("bellows").value || 0) : 0;
}
function getBellowsCorrection(){
  return $("bellowsCorrection") ? (+$("bellowsCorrection").value || 0) : 0;
}
function getEffectiveBellows(){
  return getBellowsLength() + getBellowsCorrection();
}
function calcMagnification(){
  const f = $("focal") ? (+$("focal").value || 1) : 1;
  const e = getEffectiveBellows();
  return e / f - 1;
}
function updateMagnificationField(){
  const d = opticsDistances();
  const mag = d.mag;
  if($("magnification")) $("magnification").value = mag.toFixed(2);
  if($("magHelp")){
    const f = $("focal") ? (+$("focal").value || 0) : 0;
    const b = getBellowsLength();
    const c = getBellowsCorrection();
    const e = getEffectiveBellows();
    $("magHelp").textContent = `撮影倍率 = 実効蛇腹長 ${e}mm（蛇腹長 ${b}mm + 補正 ${c}mm） ÷ 焦点距離 ${f}mm − 1 = ${mag.toFixed(2)}×`;
  }
}








function getFNumber(){const c=+$('fnumCustom').value;return c>0?c:(+$('fnum').value||16)}
function effectiveFNumber(){return getFNumber()*(1+calcMagnification())}

function lineIntersection(p1,d1,p2,d2){
  const cr=d1.x*d2.y-d1.y*d2.x;
  if(Math.abs(cr)<1e-9)return null;
  const qx=p2.x-p1.x,qy=p2.y-p1.y;
  const t=(qx*d2.y-qy*d2.x)/cr;
  return{x:p1.x+t*d1.x,y:p1.y+t*d1.y};
}
function dirFromPlaneAngle(aDeg){
  // アプリ上のPlane角は「垂直面からの角度」。線の方向角は 90°+Plane角。
  const a=rad(90+aDeg);
  return{x:Math.cos(a),y:Math.sin(a)};
}
function angleFromVertical(p1,p2){
  return normDeg(deg(Math.atan2(p2.y-p1.y,p2.x-p1.x))-90);
}



function planeDiff(a,b){
  // α113: 面/線の角度差。180°反転しても同じ面として扱う。
  let d = normDeg(a - b);
  while(d > 90) d -= 180;
  while(d <= -90) d += 180;
  return d;
}
function planeAngleNear(a,ref){
  return normDeg(ref + planeDiff(a, ref));
}

function lineAngleDiff180(a,b){ return planeDiff(a,b); }
function equivalentPlaneAngleNear(a,ref){ return planeAngleNear(a,ref); }


function getDistanceMode(){
  return $("distanceMode") ? $("distanceMode").value : "auto";
}
function getManualSubjectDistanceMM(){
  const m = $("subjectDistanceM") ? (+$("subjectDistanceM").value || 0) : 0;
  return m > 0 ? m * 1000 : 0;
}

function opticsDistances(){
  const f = Math.max(1, +$('focal').value || 180);
  const rawBellows = +$('bellows').value || 345;
  const correction = getBellowsCorrection();
  const vRaw = rawBellows + correction;
  const mode = getDistanceMode();
  const manualSensorToSubject = getManualSubjectDistanceMM();

  let v = Math.max(f + 0.001, vRaw);
  let u = (f * v) / (v - f);
  let note = "auto-bellows";

  // α113:
  // 手入力距離モードでは、センサー面→被写体面の距離を優先する。
  // 薄レンズ基準の object distance u は、おおまかに
  // センサー→被写体距離 - 像距離v として扱う。
  // これにより蛇腹長からの逆算誤差を切り分ける。
  if(mode === "manual" && manualSensorToSubject > v + 1){
    u = Math.max(1, manualSensorToSubject - v);
    note = "manual-subject-distance";
  }

  const magRaw = vRaw / f - 1;
  return {
    f,
    v,
    u,
    mag: magRaw,
    rawBellows,
    correction,
    effectiveBellows: vRaw,
    distanceMode: mode,
    manualSensorToSubject,
    distanceNote: note
  };
}

function focusAngleFor(s){
  // α122: 逆算モード。
  // 「ピント面を計算して描く」のではなく、被写体面に合焦している前提で
  // ピント面は被写体面そのものとして扱う。
  // 必要なレンズFrontは requiredFrontForProduct() で別途逆算する。
  return planeAngleNear(s.product, s.product);
}

function requiredFrontForProduct(s){
  // α122: 被写体面とセンサー面の交点をScheimpflug共通点とし、
  // レンズ中心からその共通点を通るレンズ面を逆算する。
  const d = opticsDistances();
  const sensorAngle = s.camera + s.rear;
  const lensP = {x:0,y:0};
  const sensorP = {x:d.v,y:0};
  const objectP = {x:-d.u,y:0};
  const productD = dirFromPlaneAngle(s.product);
  const sensorD = dirFromPlaneAngle(sensorAngle);
  const sch = lineIntersection(objectP, productD, sensorP, sensorD);
  if(!sch) return s.front || 0;
  const lensAbsRaw = angleFromVertical(lensP, sch);
  const lensAbs = planeAngleNear(lensAbsRaw, s.camera + s.front);
  return planeDiff(lensAbs, s.camera);
}


function planeCalculationDebugFor(s){
  const d = opticsDistances();
  const lensAngle = s.camera + s.front;
  const sensorAngle = s.camera + s.rear;
  const lensP = {x:0,y:0};
  const sensorP = {x:d.v,y:0};
  const objectP = {x:-d.u,y:0};
  const lensD = dirFromPlaneAngle(lensAngle);
  const sensorD = dirFromPlaneAngle(sensorAngle);
  const sch = lineIntersection(lensP,lensD,sensorP,sensorD);

  let rawFocus = null;
  let focusNear = null;
  let pd = null;
  let ad = null;
  let sx = null;
  let sy = null;
  let stateText = "parallel";

  if(sch){
    rawFocus = angleFromVertical(objectP, sch);
    focusNear = (typeof planeAngleNear === "function") ? planeAngleNear(rawFocus, s.product) :
                ((typeof equivalentPlaneAngleNear === "function") ? equivalentPlaneAngleNear(rawFocus, s.product) : rawFocus);
    pd = (typeof planeDiff === "function") ? planeDiff(s.product, focusNear) :
         ((typeof lineAngleDiff180 === "function") ? lineAngleDiff180(s.product, focusNear) : angleDiff(s.product, focusNear));
    ad = angleDiff(s.product, focusNear);
    sx = sch.x;
    sy = sch.y;
    stateText = "ok";
  }else{
    focusNear = normDeg(s.camera);
    pd = (typeof planeDiff === "function") ? planeDiff(s.product, focusNear) : angleDiff(s.product, focusNear);
    ad = angleDiff(s.product, focusNear);
  }

  const productNorm = normDeg(s.product);
  const productAbs = Math.abs(productNorm);
  const nearMinus90 = Math.abs(productNorm + 90);

  return {
    productRaw: s.product,
    productNorm,
    focusRaw: rawFocus,
    focusNear,
    planeDiffValue: pd,
    angleDiffValue: ad,
    lensAngle,
    sensorAngle,
    relLensSensor: (typeof planeDiff === "function") ? planeDiff(lensAngle, sensorAngle) : angleDiff(lensAngle, sensorAngle),
    scheimX: sx,
    scheimY: sy,
    scheimState: stateText,
    nearMinus90
  };
}

function focusDebugFor(s){
  const d = opticsDistances();
  const lensAngle = s.camera + s.front;
  const sensorAngle = s.camera + s.rear;
  const lensP = {x:0,y:0};
  const sensorP = {x:d.v,y:0};
  const objectP = {x:-d.u,y:0};
  const lensD = dirFromPlaneAngle(lensAngle);
  const sensorD = dirFromPlaneAngle(sensorAngle);
  const sch = lineIntersection(lensP,lensD,sensorP,sensorD);
  if(!sch){
    const a = normDeg(s.camera);
    return {focusAngle:a, diff:planeDiff(s.product,a), scheimX:null, scheimY:null, scheimState:"parallel"};
  }
  const rawFocus = angleFromVertical(objectP,sch);
  const focusAngle = (typeof equivalentPlaneAngleNear==="function") ? equivalentPlaneAngleNear(rawFocus,s.product) : rawFocus;
  const diff = planeDiff(s.product,focusAngle);
  return {focusAngle, rawFocus, diff, scheimX:sch.x, scheimY:sch.y, scheimState:"ok"};
}


function guideTextFor(d){const a=Math.abs(d);if(a<2)return'OK';return(d>0?'+':'-')+a.toFixed(1)+'°'}
function updateInfo(){
  updateMagnificationField();
  updateMagnificationField();
  $('infoMag').textContent=calcMagnification().toFixed(2)+'×';
  $('infoF').textContent='F'+getFNumber();
  $('infoEffF').textContent='F'+effectiveFNumber().toFixed(1);
  $('infoCoC').textContent=(+$('coc').value).toFixed(3)+'mm'
}
