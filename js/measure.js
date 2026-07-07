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
  // まず縦画面固定時のTilt/Swingを計算する。
  const portraitTiltBase = beta >= 0 ? 90 : -90;
  const portraitTilt = beta - portraitTiltBase;
  const portraitSwing = angle180(-(alpha + gamma));

  if(isScreenLandscape()){
    // 背面垂直・横画面:
    // Tiltはα93で正常だった動きを維持。
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
  // α93:
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
  if($("dbgMappedSwing")) $("dbgMappedSwing").textContent = fmtDbg(mapped ? mapped.swing : d.mappedSwing);
  if($("dbgRawTilt")) $("dbgRawTilt").textContent = fmtDbg(state.sensor.rawTilt);
  if($("dbgRawSwing")) $("dbgRawSwing").textContent = fmtDbg(state.sensor.rawSwing);
  if($("dbgZeroTilt")) $("dbgZeroTilt").textContent = fmtDbg(state.sensor.zeroTilt);
  if($("dbgZeroSwing")) $("dbgZeroSwing").textContent = fmtDbg(state.sensor.zeroSwing);
  if($("dbgTilt")) $("dbgTilt").textContent = fmtDbg(state.sensor.tilt);
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

  updateMeasureDebug(mapped);

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
