function updateReferenceHelp(){
  const ref = $("measureReference") ? $("measureReference").value : state.sensor.reference || "vertical";
  const help = $("referenceHelp");
  if(!help) return;
  if(ref === "vertical"){
    help.innerHTML = "背面垂直: Tiltは立てた状態、Swingは左右の向き（方位/yaw）を使います。カメラアングル決定後にゼロ補正すると、Front/Rearの相対角を測れます。";
  }else{
    help.innerHTML = "背面水平: 従来通り、スマホ背面を水平面に置いた状態をTilt/Swing 0°にします。机上測定向けです。";
  }
}

function updateMeasureStatus(){
  const targetSelect = $("measureTarget");
  const targetLabel = targetSelect ? targetSelect.selectedOptions[0].textContent.replace("に反映","") : "Front";
  const active = state.sensor.active ? "測定中" : "停止中";
  const live = state.sensor.liveApply ? "リアルタイムON" : "リアルタイムOFF";
  const ref = state.sensor.reference === "horizontal" ? "水平基準" : "垂直基準";

  if($("shootMeasureStatus")) $("shootMeasureStatus").textContent = `測定: ${active} / ${live} / ${ref} / ${targetLabel}`;
  if($("shootLiveToggle")) $("shootLiveToggle").textContent = state.sensor.liveApply ? "リアルタイムON" : "リアルタイムOFF";
  if($("liveApply")) $("liveApply").checked = state.sensor.liveApply;
  if($("sensorToggleBtn")){
    $("sensorToggleBtn").textContent = state.sensor.active ? "測定停止" : "測定開始";
    $("sensorToggleBtn").className = state.sensor.active ? "dangerBtn" : "primary";
  }
  updateReferenceHelp();
}

function angle180(v){
  if(typeof normDeg === "function") return normDeg(v);
  while(v > 180) v -= 360;
  while(v <= -180) v += 360;
  return v;
}

function rawToTiltSwing(e){
  const beta = (typeof e.beta === "number") ? e.beta : 0;
  const gamma = (typeof e.gamma === "number") ? e.gamma : 0;
  const alpha = (typeof e.alpha === "number") ? e.alpha : null;

  if(state.sensor.reference === "horizontal"){
    // 背面水平: 従来通り、前後傾き=beta / 左右傾き=gamma
    return { tilt: beta, swing: gamma };
  }

  // 背面垂直基準:
  // Tilt: スマホを立てた時の beta ±90° を0°へ補正
  // Swing: 垂直固定では左右の回転は「方位/yaw」なので alpha を使う
  // alphaが取れない環境では一応gammaへフォールバック
  const verticalBase = beta >= 0 ? 90 : -90;
  const tilt = beta - verticalBase;
  const swing = alpha === null ? gamma : angle180(alpha);

  return { tilt, swing };
}

function onDeviceOrientation(e){
  const mapped = rawToTiltSwing(e);
  state.sensor.tilt = clamp(mapped.tilt - state.sensor.zeroTilt, -90, 90);
  state.sensor.swing = clamp(angle180(mapped.swing - state.sensor.zeroSwing), -90, 90);

  if($("measTilt")) $("measTilt").textContent = state.sensor.tilt.toFixed(1) + "°";
  if($("measSwing")) $("measSwing").textContent = state.sensor.swing.toFixed(1) + "°";

  if(state.sensor.liveApply) applyMeasurementToModel(false);
  updateMeasureStatus();
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
  updateMeasureStatus();
}

function toggleSensor(){
  if(state.sensor.active) stopSensor();
  else startSensor();
}

function zeroSensor(){
  state.sensor.zeroTilt += state.sensor.tilt;
  state.sensor.zeroSwing += state.sensor.swing;
  state.sensor.tilt = 0;
  state.sensor.swing = 0;
  if($("measTilt")) $("measTilt").textContent = "0.0°";
  if($("measSwing")) $("measSwing").textContent = "0.0°";
  if($("sensorStatus")) $("sensorStatus").innerHTML = "ゼロ補正しました。現在のカメラアングルを基準0として、Front/Rearの相対角を測れます。";
  updateMeasureStatus();
}

function resetZeroSensor(){
  state.sensor.zeroTilt = 0;
  state.sensor.zeroSwing = 0;
  if($("sensorStatus")) $("sensorStatus").innerHTML = "ゼロ補正をリセットしました。";
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
  if(showMessage && $("sensorStatus")) $("sensorStatus").innerHTML = "現在値を図に反映しました。";
  updateMeasureStatus();
}

function setupMeasurement(){
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
  if(target) target.addEventListener("change", () => {
    state.sensor.target = target.value;
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

  updateMeasureStatus();
}
