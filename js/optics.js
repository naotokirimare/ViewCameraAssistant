
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
  // α117: 面/線の角度差。180°反転しても同じ面として扱う。
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

  // α117:
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
  const d = opticsDistances();
  const lensAngle = s.camera + s.front;
  const sensorAngle = s.camera + s.rear;
  const rel = Math.abs(planeDiff(lensAngle, sensorAngle));

  const cameraBranch = planeAngleNear(s.camera, s.product);

  if(rel < 0.05){
    return cameraBranch;
  }

  const lensP = {x:0,y:0};
  const sensorP = {x:d.v,y:0};
  const objectP = {x:-d.u,y:0};
  const lensD = dirFromPlaneAngle(lensAngle);
  const sensorD = dirFromPlaneAngle(sensorAngle);
  const sch = lineIntersection(lensP,lensD,sensorP,sensorD);

  if(!sch){
    return cameraBranch;
  }

  const rawFocus = angleFromVertical(objectP, sch);
  const focusBranch = focusAngleWithScheimpflugX(s, sch, objectP);

  // α117: レンズ面とセンサー面がほぼ平行な0°付近では、
  // Scheimpflug交点が無限遠側へ移動し、atan2の枝が切り替わる。
  // その近傍だけカメラ面側から従来解へ連続的に接続する。
  const blendStart = 0.35;
  const blendEnd = 3.0;
  if(rel < blendEnd){
    const t = clamp((rel - blendStart) / (blendEnd - blendStart), 0, 1);
    const blended = cameraBranch + planeDiff(focusBranch, cameraBranch) * t;
    return planeAngleNear(blended, s.product);
  }

  return focusBranch;
}




function scheimpflugXDistance(s, sch){
  const d = opticsDistances();
  if(!sch) return null;
  const sensorP = {x:d.v, y:0};
  const dx = sch.x - sensorP.x;
  const dy = sch.y - sensorP.y;
  return Math.sqrt(dx*dx + dy*dy);
}

function focusAngleWithScheimpflugX(s, sch, objectP){
  return focusXDebugFor(s, sch, objectP).usedFocus;
}



function getThetaFormulaMode(){
  return $("thetaFormulaMode") ? $("thetaFormulaMode").value : "old";
}

function thetaFormulaCompareFor(s, sch, objectP){
  const d = opticsDistances();
  const lensAngle = s.camera + s.front;
  const sensorAngle = s.camera + s.rear;
  const X = sch ? scheimpflugXDistance(s, sch) : null;
  const theta2 = (typeof planeDiff === "function") ? planeDiff(s.product, sensorAngle) : angleDiff(s.product, sensorAngle);
  const lensSensorTheta = (typeof planeDiff === "function") ? planeDiff(lensAngle, sensorAngle) : angleDiff(lensAngle, sensorAngle);
  const zPrime = (X && isFinite(X)) ? Math.abs(X * Math.tan(rad(lensSensorTheta))) : null;
  const z = Math.max(0.001, d.u);
  const ratio = (zPrime && z) ? zPrime / z : null;
  const tanTheta2 = Math.tan(rad(theta2));

  function makeFocus(theta1){
    if(typeof theta1 !== "number" || !isFinite(theta1)) return null;
    let f = sensorAngle + theta1;
    return (typeof planeAngleNear === "function") ? planeAngleNear(f, s.product) : f;
  }
  function diffOf(f){
    return (typeof f === "number") ? ((typeof planeDiff === "function") ? planeDiff(s.product, f) : angleDiff(s.product, f)) : null;
  }

  const thetaA = (ratio !== null) ? deg(Math.atan(tanTheta2 * ratio)) : null;
  const thetaB = (ratio && ratio !== 0) ? deg(Math.atan(tanTheta2 / ratio)) : null;
  const thetaC = (X && zPrime !== null) ? deg(Math.atan(zPrime / X)) * (theta2 < 0 ? -1 : 1) : null;
  const thetaD = (X) ? deg(Math.atan(z / X)) * (theta2 < 0 ? -1 : 1) : null;

  const focusA = makeFocus(thetaA);
  const focusB = makeFocus(thetaB);
  const focusC = makeFocus(thetaC);
  const focusD = makeFocus(thetaD);

  return {
    mode: getThetaFormulaMode(),
    X, z, zPrime, ratio, theta2, tanTheta2,
    thetaA, focusA, diffA: diffOf(focusA),
    thetaB, focusB, diffB: diffOf(focusB),
    thetaC, focusC, diffC: diffOf(focusC),
    thetaD, focusD, diffD: diffOf(focusD)
  };
}

function focusXDebugFor(s, sch, objectP){
  const d = opticsDistances();
  if(!sch){
    const fallback = normDeg(s.camera);
    return {
      oldFocus: fallback,
      xFocus: null,
      usedFocus: fallback,
      xUsed: false,
      reason: "parallel",
      xDistance: null,
      theta1X: null,
      oldDiff: planeDiff(s.product, fallback),
      xDiff: null
    };
  }

  const raw = angleFromVertical(objectP, sch);
  const oldFocus = (typeof planeAngleNear === "function") ? planeAngleNear(raw, s.product) : raw;

  const X = scheimpflugXDistance(s, sch);
  const lensAngle = s.camera + s.front;
  const sensorAngle = s.camera + s.rear;
  const theta2 = (typeof planeDiff === "function") ? planeDiff(s.product, sensorAngle) : angleDiff(s.product, sensorAngle);
  const lensSensorTheta = (typeof planeDiff === "function") ? planeDiff(lensAngle, sensorAngle) : angleDiff(lensAngle, sensorAngle);

  let xFocus = null;
  let theta1 = null;
  let reason = "no-x";
  if(X && isFinite(X) && X >= 0.001){
    const zPrime = Math.abs(X * Math.tan(rad(lensSensorTheta)));
    const z = Math.max(0.001, d.u);
    theta1 = deg(Math.atan(Math.tan(rad(theta2)) * (zPrime / z)));
    xFocus = sensorAngle + theta1;
    xFocus = (typeof planeAngleNear === "function") ? planeAngleNear(xFocus, s.product) : xFocus;
    reason = "computed";
  }

  const oldDiff = (typeof planeDiff === "function") ? planeDiff(s.product, oldFocus) : angleDiff(s.product, oldFocus);
  const xDiff = (typeof xFocus === "number") ? ((typeof planeDiff === "function") ? planeDiff(s.product, xFocus) : angleDiff(s.product, xFocus)) : null;

  const cmp = thetaFormulaCompareFor(s, sch, objectP);
  const mode = cmp.mode;
  const nearWeight = Math.max(0, Math.min(1, (Math.abs(s.product) - 70) / 20));
  let usedFocus = oldFocus;
  let xUsed = false;

  if(mode === "A" && typeof cmp.focusA === "number"){ usedFocus = cmp.focusA; xUsed = true; reason = "mode-A"; }
  else if(mode === "B" && typeof cmp.focusB === "number"){ usedFocus = cmp.focusB; xUsed = true; reason = "mode-B"; }
  else if(mode === "C" && typeof cmp.focusC === "number"){ usedFocus = cmp.focusC; xUsed = true; reason = "mode-C"; }
  else if(mode === "D" && typeof cmp.focusD === "number"){ usedFocus = cmp.focusD; xUsed = true; reason = "mode-D"; }
  else if(mode === "old"){ usedFocus = oldFocus; xUsed = false; reason = "old-mode"; }
  else if(typeof xFocus === "number" && nearWeight > 0 && Math.abs(xDiff) <= Math.abs(oldDiff)){
    usedFocus = xFocus;
    xUsed = true;
    reason = "x-used";
  }else if(typeof xFocus === "number"){
    reason = nearWeight <= 0 ? "standard-angle" : "old-closer";
  }

  return {
    oldFocus,
    xFocus,
    usedFocus,
    xUsed,
    reason,
    xDistance: X,
    theta1X: theta1,
    oldDiff,
    xDiff
  };
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
    focusNear = focusAngleWithScheimpflugX(s, sch, objectP);
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
    nearMinus90,
    scheimXDistance: sch ? scheimpflugXDistance(s, sch) : null,
    theta1X: sch ? planeDiff(focusAngleWithScheimpflugX(s, sch, objectP), sensorAngle) : null,
    focusOld: sch ? focusXDebugFor(s, sch, objectP).oldFocus : null,
    focusX: sch ? focusXDebugFor(s, sch, objectP).xFocus : null,
    focusUsed: sch ? focusXDebugFor(s, sch, objectP).usedFocus : null,
    focusXUsed: sch ? focusXDebugFor(s, sch, objectP).xUsed : false,
    focusXReason: sch ? focusXDebugFor(s, sch, objectP).reason : "parallel",
    focusOldDiff: sch ? focusXDebugFor(s, sch, objectP).oldDiff : null,
    focusXDiff: sch ? focusXDebugFor(s, sch, objectP).xDiff : null,
    thetaCompare: sch ? thetaFormulaCompareFor(s, sch, objectP) : null
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
  const focusAngle = focusAngleWithScheimpflugX(s, sch, objectP);
  const diff = planeDiff(s.product,focusAngle);
  return {focusAngle, rawFocus, diff, scheimX:sch.x, scheimY:sch.y, scheimState:"ok"};
}

function requiredFrontForProduct(s){
  // 実機テスト用: 被写体面とセンサー面の交点を通るレンズ面角を逆算。
  const d=opticsDistances();
  const objectP={x:-d.u,y:0}, sensorP={x:d.v,y:0}, lensP={x:0,y:0};
  const productD=dirFromPlaneAngle(s.product), sensorD=dirFromPlaneAngle(s.camera+s.rear);
  const sch=lineIntersection(objectP,productD,sensorP,sensorD);
  if(!sch)return 0;
  const lensAbs=angleFromVertical(lensP,sch);
  return normDeg(lensAbs-s.camera);
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
