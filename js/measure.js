function updateReferenceHelp(){
  const ref = $("measureReference") ? $("measureReference").value : state.sensor.reference || "vertical";
  const help = $("referenceHelp");
  if(!help) return;
  if(ref === "vertical"){
    help.innerHTML = "背面垂直: iPhoneの画面向き（縦/横）を自動判定して補正します。カメラアングル決定後にゼロ補正すると、Front/Rearの相対角を測れます。";
  }else{
    help.innerHTML = "背面水平: スマホ背面を水平面に置いた状態を基準にします。Swingはα軸で測ります。";
  }
}


function targetDisplayName(){
  const targetSelect = $("measureTarget");
  if(!targetSelect) return "Front";
  const v = targetSelect.value;
  if(v === "front") return "レンズ面（Front）";
  if(v === "rear") return "センサー面（Rear）";
  if(v === "product") return "被写体面";
  if(v === "camera") return "Camera";
  if(v === "readOnly") return "読むだけ";
  return targetSelect.selectedOptions[0] ? targetSelect.selectedOptions[0].textContent.replace("に反映","") : "Front";
}

function updateApplyDestination(){
  if($("applyDestination")) $("applyDestination").textContent = "反映先：" + targetDisplayName();
}

function updateMeasureStatus(){
  const targetSelect = $("measureTarget");
  const targetLabel = targetSelect ? targetSelect.selectedOptions[0].textContent.replace("に反映","") : "Front";
  const active = state.sensor.active ? "測定中" : "停止中";
  const live = state.sensor.liveApply ? "リアルタイムON" : "リアルタイムOFF";
  const ref = state.sensor.reference === "horizontal" ? "水平基準" : (isScreenLandscape() ? "垂直基準・横自動" : "垂直基準・縦自動");

  if($("shootMeasureStatus")) $("shootMeasureStatus").textContent = `測定: ${active} / ${live} / ${ref} / ${targetLabel}`;
  if($("shootLiveToggle")) $("shootLiveToggle").textContent = state.sensor.liveApply ? "リアルタイムON" : "リアルタイムOFF";
  if($("liveApply")) $("liveApply").checked = state.sensor.liveApply;
  if($("sensorToggleBtn")){
    $("sensorToggleBtn").textContent = state.sensor.active ? "測定停止" : "測定開始";
    $("sensorToggleBtn").className = state.sensor.active ? "dangerBtn" : "primary";
  }
  updateReferenceHelp();
  updateApplyDestination();
}

function angle180(v){
  if(typeof normDeg === "function") return normDeg(v);
  while(v > 180) v -= 360;
  while(v <= -180) v += 360;
  return v;
}

function getScreenAngle(){
  if(screen.orientation && typeof screen.orientation.angle === "number"){
    return screen.orientation.angle;
  }
  if(typeof window.orientation === "number"){
    return window.orientation;
  }
  return 0;
}

function isScreenLandscape(){
  const a = Math.abs(getScreenAngle());
  return a === 90 || a === 270;
}


function rotationMatrixFromDeviceOrientation(alphaDeg,betaDeg,gammaDeg){
  // W3C DeviceOrientation Z-X'-Y'' intrinsic rotation approximation.
  // Returns row-major 3x3 matrix.
  const a = rad(alphaDeg || 0);
  const b = rad(betaDeg || 0);
  const g = rad(gammaDeg || 0);
  const cA = Math.cos(a), sA = Math.sin(a);
  const cB = Math.cos(b), sB = Math.sin(b);
  const cG = Math.cos(g), sG = Math.sin(g);

  return [
    cA*cG - sA*sB*sG, -cB*sA, cA*sG + cG*sA*sB,
    cG*sA + cA*sB*sG,  cA*cB, sA*sG - cA*cG*sB,
    -cB*sG,             sB,    cB*cG
  ];
}

function matrixTiltForVertical(alpha,beta,gamma){
  // α105 trial:
  // Euler角を一度回転行列へ戻し、端末の画面法線/上方向の姿勢からTiltを取り出す。
  // beta±90°の境界で直接符号が切り替わるのを避ける目的。
  const m = rotationMatrixFromDeviceOrientation(alpha,beta,gamma);

  // Device local Y axis projected in world vertical/depth plane.
  // Around vertical phone placement, beta=90 gives 0° near target.
  // First candidate is continuous around beta 90:
  const yWorldZ = m[7]; // local Y axis z component, roughly sin(beta)
  const yWorldY = m[4]; // local Y axis y component, roughly cos(alpha)*cos(beta)

  // Convert to signed tilt around the vertical reference.
  // asin(cos(beta)-like component) gives near 0 at beta≈90.
  let tilt = deg(Math.asin(clamp(yWorldY, -1, 1)));

  // Keep sign aligned with old beta±90 behavior when possible.
  const oldTilt = beta - (beta >= 0 ? 90 : -90);
  if(Math.sign(tilt) !== Math.sign(oldTilt) && Math.abs(tilt) > 0.05 && Math.abs(oldTilt) > 0.05){
    tilt = -tilt;
  }

  return tilt;
}

function rawToTiltSwing(e){
  const beta = (typeof e.beta === "number") ? e.beta : 0;
  const gamma = (typeof e.gamma === "number") ? e.gamma : 0;
  const alpha = (typeof e.alpha === "number") ? e.alpha : 0;

  if(state.sensor.reference === "horizontal"){
    // 背面水平:
    // Tilt = beta
    // Swing = -alpha
    return {
      tilt: beta,
      swing: angle180(-alpha)
    };
  }

  // 背面垂直:
  // α105 trial: Tiltはalpha/beta/gammaを回転行列へ戻して算出する。
  const portraitTilt = matrixTiltForVertical(alpha,beta,gamma);
  const portraitSwing = angle180(-(alpha + gamma));
  state.sensor.tiltMethod = "rotationMatrix";

  if(isScreenLandscape()){
    // 背面垂直・横画面:
    // Tiltはα105で正常だった動きを維持。
    // Swingは、横画面時にスマホを左右に振る（方位を変える）動きで変化するよう
    // 背面水平と同じ -alpha 系を使う。
    return {
      tilt: portraitSwing,
      swing: angle180(-alpha)
    };
  }

  return {
    tilt: portraitTilt,
    swing: portraitSwing
  };
}







function stabilizeTiltByStartReference(rawTilt){
  // α105:
  // Tiltだけ、測定開始時の生Tiltを内部基準として固定する。
  // iPhone beta由来の0°付近の符号/枝ゆれを、基準からの相対Tiltとして扱う。
  // 光学計算に渡す値は「現在Tilt - 開始時Tilt」なので、ピント面の物理角度は相対値として維持される。
  if(typeof state.sensor.tiltStartRaw !== "number"){
    state.sensor.tiltStartRaw = rawTilt;
    return rawTilt;
  }

  const rel = angle180(rawTilt - state.sensor.tiltStartRaw);
  return state.sensor.tiltStartRaw + rel;
}

function resetTiltReferenceLock(){
  if(!state.sensor) return;
  delete state.sensor.tiltStartRaw;
}




function snapshotDebugValues(mapped){
  const d = state.sensor.debug || {};
  const side = state.data.side || {};
  const fd = (typeof focusDebugFor === "function") ? focusDebugFor(side) : {};
  return {
    t: Date.now(),
    alpha: d.alpha, beta: d.beta, gamma: d.gamma,
    mappedTilt: mapped ? mapped.tilt : d.mappedTilt,
    mappedSwing: mapped ? mapped.swing : d.mappedSwing,
    rawTilt: state.sensor.rawTilt, rawSwing: state.sensor.rawSwing,
    displayTilt: state.sensor.tilt, displaySwing: state.sensor.swing,
    camera: side.camera, front: side.front, rear: side.rear, product: side.product,
    focusAngle: fd.focusAngle, focusDiff: fd.diff,
    scheimX: fd.scheimX, scheimY: fd.scheimY, scheimState: fd.scheimState
  };
}

function pushFlightFrame(frame){
  if(!state.sensor.flightFrames) state.sensor.flightFrames = [];
      resetNearZeroTiltAverage();
    resetNearZeroTiltHysteresis();
  state.sensor.flightFrames.push(frame);
  if(state.sensor.flightFrames.length > 36) state.sensor.flightFrames.shift();
}

function frameLine(f, idx, reasonMark){
  const dt = state.sensor.flightBaseTime ? ((f.t - state.sensor.flightBaseTime) / 1000).toFixed(2) : "0.00";
  return `${reasonMark || " "} ${idx}  +${dt}s  beta=${fmtDbg(f.beta)}  mTilt=${fmtDbg(f.mappedTilt)}  raw=${fmtDbg(f.rawTilt)}  disp=${fmtDbg(f.displayTilt)}  F=${fmtDbg(f.front)}  R=${fmtDbg(f.rear)}  focus=${fmtDbg(f.focusAngle)}  Δ=${fmtDbg(f.focusDiff)}`;
}

function captureFlightRecorder(reason, current){
  const status = $("jumpCaptureStatus");
  const img = $("jumpCaptureImage");
  if(!img) return;

  const frames = (state.sensor.flightFrames || []).slice(-30);
  state.sensor.flightBaseTime = frames.length ? frames[0].t : current.t;

  const now = new Date();
  const lines = [
    `ViewCameraAssistant v1α105 Flight Recorder`,
    `${now.toLocaleString()}`,
    `reason: ${reason}`,
    ``,
    `Current`,
    `alpha: ${fmtDbg(current.alpha)}   beta: ${fmtDbg(current.beta)}   gamma: ${fmtDbg(current.gamma)}`,
    `mapped Tilt : ${fmtDbg(current.mappedTilt)}   mapped Swing: ${fmtDbg(current.mappedSwing)}`,
    `raw Tilt    : ${fmtDbg(current.rawTilt)}   raw Swing   : ${fmtDbg(current.rawSwing)}`,
    `display Tilt: ${fmtDbg(current.displayTilt)}   avg:${typeof state.sensor.tiltAvg === "number" ? state.sensor.tiltAvg.toFixed(2)+"°" : "-"}   ${state.sensor.tiltZeroJudge || "-"}`,
    `Camera: ${fmtDbg(current.camera)}  Front: ${fmtDbg(current.front)}  Rear: ${fmtDbg(current.rear)}  Subject: ${fmtDbg(current.product)}`,
    `focus Angle: ${fmtDbg(current.focusAngle)}  focus Δ: ${fmtDbg(current.focusDiff)}`,
    `Scheim X: ${typeof current.scheimX === "number" ? current.scheimX.toFixed(1) : "-"}  Scheim Y: ${typeof current.scheimY === "number" ? current.scheimY.toFixed(1) : "-"}  ${current.scheimState || "-"}`,
    ``,
    `Frames before / at jump`
  ];

  frames.forEach((f, i) => {
    const mark = (i === frames.length - 1) ? ">" : " ";
    lines.push(frameLine(f, i - (frames.length - 1), mark));
  });

  const scale = 2;
  const w = 1080, h = 1220;
  const c = document.createElement("canvas");
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#111114";
  ctx.fillRect(0,0,w,h);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 34px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("Jump Flight Recorder", 32, 54);
  ctx.font = "20px -apple-system, BlinkMacSystemFont, sans-serif";
  let y = 96;
  for(const line of lines){
    ctx.fillStyle = line.startsWith("reason") ? "#ffcc66" : (line.startsWith(">") ? "#7dd3fc" : "#ffffff");
    ctx.fillText(line, 32, y);
    y += 30;
    if(y > h - 28) break;
  }

  img.src = c.toDataURL("image/png");
  img.style.display = "block";
  if(status) status.textContent = "異常な飛びを記録しました。画像を長押し保存、またはこの画面をスクショしてください。";
}

function checkAndCaptureJump(mapped){
  if(!$("jumpCaptureBox")) return;
  const current = snapshotDebugValues(mapped);
  pushFlightFrame(current);

  const prev = state.sensor.jumpCapturePrev;
  state.sensor.jumpCapturePrev = current;
  if(!prev || state.sensor.jumpCaptured) return;

  // α105:
  // 実機症状に合わせて「Tilt 0°付近で1〜2°だけ飛ぶ瞬間」を狙って記録する。
  // displayTilt が -2°〜+2°付近にいる時だけ監視。
  // 1フレームで1°以上変化したら記録。
  const curNearZero = typeof current.displayTilt === "number" && Math.abs(current.displayTilt) <= 2.2;
  const prevNearZero = typeof prev.displayTilt === "number" && Math.abs(prev.displayTilt) <= 2.2;

  const hits = [];
  if(curNearZero || prevNearZero){
    const checks = [
      ["beta", 1.0],
      ["mappedTilt", 1.0],
      ["rawTilt", 1.0],
      ["displayTilt", 1.0],
      ["front", 1.0],
      ["rear", 1.0],
      ["focusAngle", 1.5],
      ["focusDiff", 1.5]
    ];

    for(const [k, th] of checks){
      if(typeof prev[k] === "number" && typeof current[k] === "number"){
        const diff = angle180(current[k] - prev[k]);
        if(Math.abs(diff) >= th) hits.push(`${k} ${diff >= 0 ? "+" : ""}${diff.toFixed(1)}°`);
      }
    }

    if(typeof current.displayTilt === "number" && typeof current.front === "number"){
      const gap = angle180(current.front - current.displayTilt);
      if(Math.abs(gap) >= 2.0) hits.push(`front-displayTilt gap ${gap >= 0 ? "+" : ""}${gap.toFixed(1)}°`);
    }
    if(typeof current.displayTilt === "number" && typeof current.rear === "number"){
      const gap = angle180(current.rear - current.displayTilt);
      if(Math.abs(gap) >= 2.0) hits.push(`rear-displayTilt gap ${gap >= 0 ? "+" : ""}${gap.toFixed(1)}°`);
    }
  }

  if(hits.length){
    state.sensor.jumpCaptured = true;
    captureFlightRecorder(hits.join(" / "), current);
  }
}

function setupJumpCaptureButtons(){
  const btn = $("clearJumpCapture");
  if(btn && !btn.dataset.bound){
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      state.sensor.jumpCaptured = false;
      state.sensor.jumpCapturePrev = null;
      state.sensor.flightFrames = [];
      state.sensor.flightBaseTime = null;
      const img = $("jumpCaptureImage");
      if(img){ img.removeAttribute("src"); img.style.display = "none"; }
      if($("jumpCaptureStatus")) $("jumpCaptureStatus").textContent = "記録をクリアしました。次の異常な飛びを待っています。";
    });
  }
}



function updateNearZeroTiltAverage(){
  // α105:
  // 0°付近の判定用にdisplay Tiltの短時間平均を作る。
  // 光学計算・反映値は丸めず、実測値をそのまま使う。
  if(!state.sensor.tiltAvgFrames) state.sensor.tiltAvgFrames = [];
  const v = state.sensor.tilt;
  if(typeof v !== "number" || !isFinite(v)) return null;

  // 0°付近だけ平均を蓄積。離れたらリセット。
  if(Math.abs(v) <= 2.2){
    state.sensor.tiltAvgFrames.push({t: Date.now(), v});
    if(state.sensor.tiltAvgFrames.length > 30) state.sensor.tiltAvgFrames.shift();
  }else{
    state.sensor.tiltAvgFrames = [];
    return null;
  }

  const frames = state.sensor.tiltAvgFrames;
  if(!frames.length) return null;
  const avg = frames.reduce((s,f)=>s+f.v,0) / frames.length;
  const span = frames.length;

  state.sensor.tiltAvg = avg;
  state.sensor.tiltAvgCount = span;
  state.sensor.tiltZeroJudge = (span >= 8 && Math.abs(avg) <= 0.35) ? "0°安定" :
                               (span >= 8 ? "平均中" : "蓄積中");

  return avg;
}

function resetNearZeroTiltAverage(){
  if(!state.sensor) return;
  state.sensor.tiltAvgFrames = [];
  state.sensor.tiltAvg = null;
  state.sensor.tiltAvgCount = 0;
  state.sensor.tiltZeroJudge = "-";
}


function updateNearZeroTiltHysteresis(){
  // α105:
  // 0°境界付近の+/-切り替えがパタパタするのを抑える表示用ヒステリシス。
  // 光学計算・測定値反映は丸めず、実測値をそのまま使う。
  const v = state.sensor.tilt;
  if(typeof v !== "number" || !isFinite(v)){
    state.sensor.tiltHyst = null;
    state.sensor.tiltHystSide = "-";
    return null;
  }

  if(Math.abs(v) > 2.2){
    state.sensor.tiltHyst = null;
    state.sensor.tiltHystSide = "範囲外";
    return null;
  }

  const prevSide = state.sensor.tiltHystSide || "zero";
  let side = prevSide;

  // 切り替えしきい値。
  // +側から-側へは -1.2°を超えたら切替
  // -側から+側へは +1.2°を超えたら切替
  if(prevSide === "plus"){
    if(v <= -1.2) side = "minus";
  }else if(prevSide === "minus"){
    if(v >= 1.2) side = "plus";
  }else{
    if(v >= 1.2) side = "plus";
    else if(v <= -1.2) side = "minus";
    else side = "zero";
  }

  let hv = v;
  if(side === "zero" || Math.abs(v) < 1.2){
    hv = 0;
  }

  state.sensor.tiltHystSide = side;
  state.sensor.tiltHyst = hv;
  return hv;
}

function resetNearZeroTiltHysteresis(){
  if(!state.sensor) return;
  state.sensor.tiltHyst = null;
  state.sensor.tiltHystSide = "-";
}

function fmtDbg(v){
  return (typeof v === "number" && isFinite(v)) ? v.toFixed(1) + "°" : "-";
}

function updateMeasureDebug(mapped){
  if(!$("measureDebugBox")) return;
  const d = state.sensor.debug || {};
  if($("dbgAlpha")) $("dbgAlpha").textContent = fmtDbg(d.alpha);
  if($("dbgBeta")) $("dbgBeta").textContent = fmtDbg(d.beta);
  if($("dbgGamma")) $("dbgGamma").textContent = fmtDbg(d.gamma);
  if($("dbgMappedTilt")) $("dbgMappedTilt").textContent = fmtDbg(mapped ? mapped.tilt : d.mappedTilt);
  if($("dbgTiltMethod")) $("dbgTiltMethod").textContent = state.sensor.tiltMethod || "-";
  if($("dbgMappedSwing")) $("dbgMappedSwing").textContent = fmtDbg(mapped ? mapped.swing : d.mappedSwing);
  if($("dbgRawTilt")) $("dbgRawTilt").textContent = fmtDbg(state.sensor.rawTilt);
  if($("dbgRawSwing")) $("dbgRawSwing").textContent = fmtDbg(state.sensor.rawSwing);
  if($("dbgZeroTilt")) $("dbgZeroTilt").textContent = fmtDbg(state.sensor.zeroTilt);
  if($("dbgZeroSwing")) $("dbgZeroSwing").textContent = fmtDbg(state.sensor.zeroSwing);
  if($("dbgTilt")) $("dbgTilt").textContent = fmtDbg(state.sensor.tilt);
  if($("dbgTiltAvg")) $("dbgTiltAvg").textContent = (typeof state.sensor.tiltAvg === "number") ? (state.sensor.tiltAvg.toFixed(2) + "° / " + (state.sensor.tiltAvgCount || 0) + "f") : "-";
  if($("dbgTiltHyst")) $("dbgTiltHyst").textContent = (typeof state.sensor.tiltHyst === "number") ? state.sensor.tiltHyst.toFixed(2) + "°" : "-";
  if($("dbgTiltHystSide")) $("dbgTiltHystSide").textContent = state.sensor.tiltHystSide || "-";
  if($("dbgTiltZeroJudge")) $("dbgTiltZeroJudge").textContent = state.sensor.tiltZeroJudge || "-";
  if($("dbgSwing")) $("dbgSwing").textContent = fmtDbg(state.sensor.swing);
  const targetSelect = $("measureTarget");
  if($("dbgTarget")) $("dbgTarget").textContent = targetSelect ? targetSelect.value : (state.sensor.target || "-");

  const side = state.data.side || {};
  if($("dbgCamera")) $("dbgCamera").textContent = fmtDbg(side.camera);
  if($("dbgFront")) $("dbgFront").textContent = fmtDbg(side.front);
  if($("dbgRear")) $("dbgRear").textContent = fmtDbg(side.rear);
  if($("dbgProduct")) $("dbgProduct").textContent = fmtDbg(side.product);

  if(typeof focusDebugFor === "function"){
    const fd = focusDebugFor(side);
    if($("dbgFocusAngle")) $("dbgFocusAngle").textContent = fmtDbg(fd.focusAngle);
    if($("dbgFocusDiff")) $("dbgFocusDiff").textContent = fmtDbg(fd.diff);
    if($("dbgScheimX")) $("dbgScheimX").textContent = (typeof fd.scheimX === "number" && isFinite(fd.scheimX)) ? fd.scheimX.toFixed(1) : "-";
    if($("dbgScheimY")) $("dbgScheimY").textContent = (typeof fd.scheimY === "number" && isFinite(fd.scheimY)) ? fd.scheimY.toFixed(1) : "-";
    if($("dbgScheimState")) $("dbgScheimState").textContent = fd.scheimState || "-";
  }


  if(typeof opticsDistances === "function"){
    const od = opticsDistances();
    if($("dbgOptF")) $("dbgOptF").textContent = (typeof od.f === "number") ? od.f.toFixed(1) + "mm" : "-";
    if($("dbgOptBellows")) $("dbgOptBellows").textContent = (typeof od.rawBellows === "number") ? od.rawBellows.toFixed(1) + "mm" : "-";
    if($("dbgOptCorrection")) $("dbgOptCorrection").textContent = (typeof od.correction === "number") ? od.correction.toFixed(1) + "mm" : "-";
    if($("dbgOptEffective")) $("dbgOptEffective").textContent = (typeof od.effectiveBellows === "number") ? od.effectiveBellows.toFixed(1) + "mm" : ((typeof od.v === "number") ? od.v.toFixed(1) + "mm" : "-");
    if($("dbgOptU")) $("dbgOptU").textContent = (typeof od.u === "number" && isFinite(od.u)) ? od.u.toFixed(1) + "mm" : "-";
    if($("dbgOptV")) $("dbgOptV").textContent = (typeof od.v === "number" && isFinite(od.v)) ? od.v.toFixed(1) + "mm" : "-";
    if($("dbgOptMag")) $("dbgOptMag").textContent = (typeof od.mag === "number" && isFinite(od.mag)) ? od.mag.toFixed(3) + "×" : "-";
  }

  if($("dbgJump")){
    const prev = state.sensor.debugPrev || {};
    const parts = [];
    const fd = (typeof focusDebugFor === "function") ? focusDebugFor(state.data.side || {}) : {};
    [["beta", d.beta], ["mappedTilt", mapped ? mapped.tilt : d.mappedTilt], ["rawTilt", state.sensor.rawTilt], ["displayTilt", state.sensor.tilt], ["focus", fd.focusAngle], ["focusDiff", fd.diff]].forEach(([k,v])=>{
      if(typeof prev[k] === "number" && typeof v === "number"){
        const diff = angle180(v - prev[k]);
        if(Math.abs(diff) >= 1.5) parts.push(`${k} ${diff >= 0 ? "+" : ""}${diff.toFixed(1)}°`);
      }
    });
    $("dbgJump").textContent = parts.length ? ("変化監視: " + parts.join(" / ")) : "変化監視: 大きな変化なし";
    state.sensor.debugPrev = {
      beta: d.beta,
      mappedTilt: mapped ? mapped.tilt : d.mappedTilt,
      rawTilt: state.sensor.rawTilt,
      displayTilt: state.sensor.tilt,
      focus: (typeof focusDebugFor === "function") ? focusDebugFor(state.data.side || {}).focusAngle : undefined,
      focusDiff: (typeof focusDebugFor === "function") ? focusDebugFor(state.data.side || {}).diff : undefined
    };
  }
}

function onDeviceOrientation(e){
  const mapped = rawToTiltSwing(e);
  state.sensor.debug = {
    alpha: (typeof e.alpha === "number") ? e.alpha : null,
    beta: (typeof e.beta === "number") ? e.beta : null,
    gamma: (typeof e.gamma === "number") ? e.gamma : null,
    mappedTilt: mapped.tilt,
    mappedSwing: mapped.swing
  };
  const stableTilt = stabilizeTiltByStartReference(mapped.tilt);
  const stableSwing = mapped.swing;
  // rawTilt/rawSwing are the absolute measurement values used for Camera基準差分.
  // tilt/swing are the zero-corrected values used for Front/Rear measurement.
  state.sensor.rawTilt = stableTilt;
  state.sensor.rawSwing = stableSwing;
  state.sensor.tilt = clamp(stableTilt - state.sensor.zeroTilt, -90, 90);
  state.sensor.swing = clamp(angle180(stableSwing - state.sensor.zeroSwing), -90, 90);

  if($("measTilt")) $("measTilt").textContent = state.sensor.tilt.toFixed(1) + "°";
  if($("measSwing")) $("measSwing").textContent = state.sensor.swing.toFixed(1) + "°";

  updateNearZeroTiltAverage();
  updateNearZeroTiltHysteresis();
  updateMeasureDebug(mapped);
  checkAndCaptureJump(mapped);

  if(state.sensor.liveApply) applyMeasurementToModel(false);
  updateSavedReferenceUI();
  const saveRef = $("saveReference");
  if(saveRef) saveRef.addEventListener("click", saveReference);

  const useRef = $("useReferenceAsZero");
  if(useRef) useRef.addEventListener("click", useReferenceAsZero);

  const clearRef = $("clearReference");
  if(clearRef) clearRef.addEventListener("click", clearReference);

  updateSavedReferenceUI();
  updateMeasureStatus();
}


function pauseSensorForResume(reason){
  if(!state.sensor || !state.sensor.active) return;
  window.removeEventListener("deviceorientation", onDeviceOrientation, true);
  state.sensor.active = false;
  state.sensor.liveApply = false;
  if($("liveApply")) $("liveApply").checked = false;
  const shootLive = $("shootLiveToggle");
  if(shootLive) shootLive.textContent = "リアルタイムOFF";
  if($("sensorStatus")) $("sensorStatus").innerHTML = reason || "Safari復帰のため測定を停止しました。測定開始を押して再開してください。";
  updateMeasureStatus();
}

function setupSensorResumeGuard(){
  if(window.__vcaResumeGuardBound) return;
  window.__vcaResumeGuardBound = true;

  document.addEventListener("visibilitychange", () => {
    if(document.hidden){
      pauseSensorForResume("Safariを離れたため測定を停止しました。戻ったら測定開始を押して再開してください。");
    }
  });

  window.addEventListener("pagehide", () => {
    pauseSensorForResume("Safariを離れたため測定を停止しました。戻ったら測定開始を押して再開してください。");
  });

  window.addEventListener("pageshow", () => {
    if($("sensorStatus") && !state.sensor.active){
      $("sensorStatus").innerHTML = "Safari復帰後は測定を再開してください。測定開始を押すとセンサー基準を取り直します。";
      updateMeasureStatus();
    }
  });

  window.addEventListener("focus", () => {
    if($("sensorStatus") && !state.sensor.active){
      $("sensorStatus").innerHTML = "測定停止中。測定開始を押してセンサー基準を取り直してください。";
      updateMeasureStatus();
    }
  });
}

async function startSensor(){
  try{
    if(typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function"){
      const res = await DeviceOrientationEvent.requestPermission();
      if(res !== "granted"){
        if($("sensorStatus")) $("sensorStatus").innerHTML = "センサー許可が拒否されました。Safariの設定を確認してください。";
        state.sensor.active = false;
        updateMeasureStatus();
        return;
      }
    }
    window.removeEventListener("deviceorientation", onDeviceOrientation, true);
  resetTiltReferenceLock();
  
    
    resetTiltReferenceLock();
    state.sensor.debugPrev = null;
    resetNearZeroTiltAverage();
    window.addEventListener("deviceorientation", onDeviceOrientation, true);
    state.sensor.active = true;
    if($("sensorStatus")) $("sensorStatus").innerHTML = "測定中。Tilt / Swingを読み取っています。";
    updateMeasureStatus();
  }catch(err){
    if($("sensorStatus")) $("sensorStatus").innerHTML = "センサー開始に失敗しました: " + err.message;
    state.sensor.active = false;
    updateMeasureStatus();
  }
}

function stopSensor(){
  window.removeEventListener("deviceorientation", onDeviceOrientation, true);
  state.sensor.active = false;
  state.sensor.liveApply = false;
  if($("liveApply")) $("liveApply").checked = false;
  if($("sensorStatus")) $("sensorStatus").innerHTML = "測定を停止しました。";
  const saveRef = $("saveReference");
  if(saveRef) saveRef.addEventListener("click", saveReference);

  const useRef = $("useReferenceAsZero");
  if(useRef) useRef.addEventListener("click", useReferenceAsZero);

  const clearRef = $("clearReference");
  if(clearRef) clearRef.addEventListener("click", clearReference);

  updateSavedReferenceUI();
  updateMeasureStatus();
}

function toggleSensor(){
  if(state.sensor.active) stopSensor();
  else startSensor();
}

function zeroSensor(){
  // ゼロ補正はFront/Rear測定用の一時基準。
  // Camera基準とその差分表示には影響させない。
  state.sensor.zeroTilt = state.sensor.rawTilt || 0;
  state.sensor.zeroSwing = state.sensor.rawSwing || 0;
  state.sensor.tilt = 0;
  state.sensor.swing = 0;
  if($("measTilt")) $("measTilt").textContent = "0.0°";
  if($("measSwing")) $("measSwing").textContent = "0.0°";
  if($("sensorStatus")) $("sensorStatus").innerHTML = "ゼロ補正しました。Front / Rear測定用の一時基準を現在値にしました。";
  updateSavedReferenceUI();
  updateMeasureStatus();
}

function resetZeroSensor(){
  state.sensor.zeroTilt = 0;
  state.sensor.zeroSwing = 0;
  state.sensor.tilt = clamp(state.sensor.rawTilt || 0, -90, 90);
  state.sensor.swing = clamp(angle180(state.sensor.rawSwing || 0), -90, 90);
  if($("measTilt")) $("measTilt").textContent = state.sensor.tilt.toFixed(1) + "°";
  if($("measSwing")) $("measSwing").textContent = state.sensor.swing.toFixed(1) + "°";
  if($("sensorStatus")) $("sensorStatus").innerHTML = "ゼロ補正をリセットしました。";
  updateSavedReferenceUI();
  updateMeasureStatus();
}

function setLiveApply(on){
  state.sensor.liveApply = !!on;
  updateMeasureStatus();
  if(state.sensor.liveApply) applyMeasurementToModel(false);
}

function toggleLiveApply(){
  setLiveApply(!state.sensor.liveApply);
}


function clampMeasuredAngleForTarget(target, value){
  // α105: 被写体面だけは±90°で折り返さず、±180°まで連続値として扱う。
  if(target === "product") return clamp(value, -180, 180);
  return clamp(value, -90, 90);
}

function applyMeasurementToModel(showMessage=true){
  const targetSelect = $("measureTarget");
  const target = targetSelect ? targetSelect.value : (state.sensor.target || "front");
  state.sensor.target = target;

  if(target === "readOnly"){
    if(showMessage && $("sensorStatus")) $("sensorStatus").innerHTML = "読むだけモードです。図には反映していません。";
    updateMeasureStatus();
    return;
  }

  // 測定値を反映するときは、現在表示されている値を使う。
  // Camera基準から相対計測中なら、Camera / 被写体面 / Front / Rear すべてが基準からの相対角として反映される。
  const tilt = state.sensor.tilt;
  const swing = state.sensor.swing;

  if(target === "front"){
    state.data.side.front = clamp(tilt, -90, 90);
    state.data.top.front = clamp(swing, -90, 90);
  }
  if(target === "rear"){
    state.data.side.rear = clamp(tilt, -90, 90);
    state.data.top.rear = clamp(swing, -90, 90);
  }
  if(target === "product"){
    state.data.side.product = clamp(tilt, -180, 180);
    state.data.top.product = clamp(swing, -180, 180);
  }
  if(target === "camera"){
    state.data.side.camera = clamp(tilt, -90, 90);
    state.data.top.camera = clamp(swing, -90, 90);
  }

  update();
  if(showMessage && $("sensorStatus")) $("sensorStatus").innerHTML = "測定値を反映しました。";
  const saveRef = $("saveReference");
  if(saveRef) saveRef.addEventListener("click", saveReference);

  const useRef = $("useReferenceAsZero");
  if(useRef) useRef.addEventListener("click", useReferenceAsZero);

  const clearRef = $("clearReference");
  if(clearRef) clearRef.addEventListener("click", clearReference);

  updateSavedReferenceUI();
  updateMeasureStatus();
}



function currentAbsoluteMeasurement(){
  return {
    tilt: (typeof state.sensor.rawTilt === "number") ? state.sensor.rawTilt : (state.sensor.tilt + state.sensor.zeroTilt),
    swing: (typeof state.sensor.rawSwing === "number") ? state.sensor.rawSwing : angle180(state.sensor.swing + state.sensor.zeroSwing)
  };
}

function updateSavedReferenceUI(){
  const ref = state.savedReference || {active:false, tilt:0, swing:0};
  if($("refTilt")) $("refTilt").textContent = ref.active ? ((typeof ref.displayTilt === "number" ? ref.displayTilt : ref.tilt).toFixed(1) + "°") : "未保存";
  if($("refSwing")) $("refSwing").textContent = ref.active ? ((typeof ref.displaySwing === "number" ? ref.displaySwing : ref.swing).toFixed(1) + "°") : "未保存";
  if($("referenceStatus")){
    if(ref.active){
      const dTilt = angle180((state.sensor.rawTilt || 0) - ref.tilt);
      const dSwing = angle180((state.sensor.rawSwing || 0) - ref.swing);
      $("referenceStatus").innerHTML = `現在値をCamera基準として保存済み。現在との差分: Tilt ${dTilt >= 0 ? "+" : ""}${dTilt.toFixed(1)}° / Swing ${dSwing >= 0 ? "+" : ""}${dSwing.toFixed(1)}°`;
    }else{
      $("referenceStatus").innerHTML = "基準未保存。被写体に正対した状態で「現在値をCamera基準として保存」を押してください。";
    }
  }
}

function saveReference(){
  const abs = currentAbsoluteMeasurement();
  state.savedReference = {
    active: true,
    // raw absolute values: used for true Camera基準差分 and Camera基準から相対計測
    tilt: abs.tilt,
    swing: abs.swing,
    // displayed values: shown in the 基準値 card so the saved value matches what the user saw
    displayTilt: state.sensor.tilt,
    displaySwing: state.sensor.swing
  };
  if($("sensorStatus")) $("sensorStatus").innerHTML = "現在値をCamera基準として保存しました。";
  updateSavedReferenceUI();
  updateMeasureStatus();
}

function useReferenceAsZero(){
  if(!state.savedReference || !state.savedReference.active){
    if($("sensorStatus")) $("sensorStatus").innerHTML = "基準値が保存されていません。先に「現在値をCamera基準として保存」を押してください。";
    updateSavedReferenceUI();
    return;
  }
  // Camera基準から相対計測:
  // zeroTilt/zeroSwingへ保存基準そのものを入れる。
  // これにより表示値は「現在のraw値 - Camera基準」になり、
  // Camera基準差分はゼロ補正の影響を受けない。
  state.sensor.zeroTilt = state.savedReference.tilt;
  state.sensor.zeroSwing = state.savedReference.swing;
  const abs = currentAbsoluteMeasurement();
  state.sensor.tilt = clamp(abs.tilt - state.sensor.zeroTilt, -90, 90);
  state.sensor.swing = clamp(angle180(abs.swing - state.sensor.zeroSwing), -90, 90);
  if($("measTilt")) $("measTilt").textContent = state.sensor.tilt.toFixed(1) + "°";
  if($("measSwing")) $("measSwing").textContent = state.sensor.swing.toFixed(1) + "°";
  if($("sensorStatus")) $("sensorStatus").innerHTML = "Camera基準から相対計測を開始しました。";
  updateSavedReferenceUI();
  updateMeasureStatus();
}

function clearReference(){
  state.savedReference = { active: false, tilt: 0, swing: 0 };
  if($("sensorStatus")) $("sensorStatus").innerHTML = "基準値をクリアしました。";
  updateSavedReferenceUI();
  const saveRef = $("saveReference");
  if(saveRef) saveRef.addEventListener("click", saveReference);

  const useRef = $("useReferenceAsZero");
  if(useRef) useRef.addEventListener("click", useReferenceAsZero);

  const clearRef = $("clearReference");
  if(clearRef) clearRef.addEventListener("click", clearReference);

  updateSavedReferenceUI();
  updateMeasureStatus();
}

function setupMeasurement(){
  setupJumpCaptureButtons();
  setupSensorResumeGuard();
  if($("measureReference")){
    $("measureReference").value = state.sensor.reference || "vertical";
    $("measureReference").addEventListener("change", () => {
      state.sensor.reference = $("measureReference").value;
      resetZeroSensor();
      updateMeasureStatus();
    });
  }

  const toggle = $("sensorToggleBtn");
  if(toggle) toggle.addEventListener("click", toggleSensor);

  const zero = $("zeroSensor");
  if(zero) zero.addEventListener("click", zeroSensor);

  const reset = $("resetZeroSensor");
  if(reset) reset.addEventListener("click", resetZeroSensor);

  const apply = $("applyMeasure");
  if(apply) apply.addEventListener("click", () => applyMeasurementToModel(true));

  const target = $("measureTarget");
  if(target) target.value = state.sensor.target || "readOnly";
  if(target) target.addEventListener("change", () => {
    state.sensor.target = target.value;
    updateApplyDestination();
    updateMeasureStatus();
  });

  const live = $("liveApply");
  if(live) live.addEventListener("change", () => setLiveApply(live.checked));

  const shootApply = $("shootApplyMeasure");
  if(shootApply) shootApply.addEventListener("click", (e) => {
    e.preventDefault();
    applyMeasurementToModel(true);
  });

  const shootLive = $("shootLiveToggle");
  if(shootLive) shootLive.addEventListener("click", (e) => {
    e.preventDefault();
    toggleLiveApply();
  });

  const saveRef = $("saveReference");
  if(saveRef) saveRef.addEventListener("click", saveReference);

  const useRef = $("useReferenceAsZero");
  if(useRef) useRef.addEventListener("click", useReferenceAsZero);

  const clearRef = $("clearReference");
  if(clearRef) clearRef.addEventListener("click", clearReference);

  updateSavedReferenceUI();
  updateMeasureStatus();
}
