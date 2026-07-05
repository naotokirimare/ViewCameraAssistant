function updateMeasureStatus(){
  const targetLabel = $("measureTarget") ? $("measureTarget").selectedOptions[0].textContent.replace("に反映","") : "Front";
  const active = state.sensor.active ? "測定中" : "停止中";
  const live = state.sensor.liveApply ? "リアルタイムON" : "リアルタイムOFF";
  if($("shootMeasureStatus")) $("shootMeasureStatus").textContent = `測定: ${active} / ${live} / ${targetLabel}`;
  if($("shootLiveToggle")) $("shootLiveToggle").textContent = state.sensor.liveApply ? "リアルタイムON" : "リアルタイムOFF";
  if($("liveApply")) $("liveApply").checked = state.sensor.liveApply;
}

function onDeviceOrientation(e){
  const rawTilt = (typeof e.beta === "number") ? e.beta : 0;
  const rawSwing = (typeof e.gamma === "number") ? e.gamma : 0;
  state.sensor.tilt = clamp(rawTilt - state.sensor.zeroTilt, -90, 90);
  state.sensor.swing = clamp(rawSwing - state.sensor.zeroSwing, -90, 90);

  $("measTilt").textContent = state.sensor.tilt.toFixed(1) + "°";
  $("measSwing").textContent = state.sensor.swing.toFixed(1) + "°";

  if(state.sensor.liveApply) applyMeasurementToModel(false);
  updateMeasureStatus();
}

async function startSensor(){
  try{
    if(typeof DeviceOrientationEvent !== "undefined" &&
       typeof DeviceOrientationEvent.requestPermission === "function"){
      const res = await DeviceOrientationEvent.requestPermission();
      if(res !== "granted"){
        $("sensorStatus").innerHTML = "センサー許可が拒否されました。Safariの設定を確認してください。";
        state.sensor.active=false;
        updateMeasureStatus();
        return;
      }
    }
    window.removeEventListener("deviceorientation", onDeviceOrientation);
    window.addEventListener("deviceorientation", onDeviceOrientation, true);
    state.sensor.active=true;
    $("sensorStatus").innerHTML="測定中。Tilt / Swingを読み取っています。";
    updateMeasureStatus();
  }catch(err){
    $("sensorStatus").innerHTML="センサー開始に失敗しました: " + err.message;
    state.sensor.active=false;
    updateMeasureStatus();
  }
}

function stopSensor(){
  window.removeEventListener("deviceorientation", onDeviceOrientation);
  state.sensor.active=false;
  state.sensor.liveApply=false;
  if($("liveApply")) $("liveApply").checked=false;
  $("sensorStatus").innerHTML="測定を停止しました。";
  updateMeasureStatus();
}

function zeroSensor(){
  state.sensor.zeroTilt += state.sensor.tilt;
  state.sensor.zeroSwing += state.sensor.swing;
  state.sensor.tilt=0; state.sensor.swing=0;
  $("measTilt").textContent="0.0°"; $("measSwing").textContent="0.0°";
  $("sensorStatus").innerHTML="ゼロ補正しました。";
  updateMeasureStatus();
}

function resetZeroSensor(){
  state.sensor.zeroTilt=0;
  state.sensor.zeroSwing=0;
  $("sensorStatus").innerHTML="ゼロ補正を解除しました。";
  updateMeasureStatus();
}

function setLiveApply(on){
  state.sensor.liveApply = !!on;
  updateMeasureStatus();
  if(state.sensor.liveApply && state.sensor.active){
    applyMeasurementToModel(false);
  }
}

function toggleLiveApply(){
  setLiveApply(!state.sensor.liveApply);
}

function applyMeasurementToModel(showMessage=true){
  const target=$("measureTarget").value;
  state.sensor.target=target;
  if(target==="readOnly"){
    if(showMessage) $("sensorStatus").innerHTML="読むだけモードです。図には反映していません。";
    updateMeasureStatus();
    return;
  }

  const tilt=state.sensor.tilt;
  const swing=state.sensor.swing;

  if(target==="front"){
    state.data.side.front=clamp(tilt,-35,35);
    state.data.top.front=clamp(swing,-35,35);
  }
  if(target==="rear"){
    state.data.side.rear=clamp(tilt,-35,35);
    state.data.top.rear=clamp(swing,-35,35);
  }
  if(target==="product"){
    state.data.side.product=clamp(tilt,-180,180);
    state.data.top.product=clamp(swing,-180,180);
  }
  if(target==="camera"){
    state.data.side.camera=clamp(tilt,-45,45);
    state.data.top.camera=clamp(swing,-45,45);
  }

  update();
  if(showMessage) $("sensorStatus").innerHTML="現在値を図に反映しました。";
  updateMeasureStatus();
}

function setupMeasurement(){
  $("sensorBtn").onclick=startSensor;
  $("stopSensor").onclick=stopSensor;
  $("zeroSensor").onclick=zeroSensor;
  $("resetZeroSensor").onclick=resetZeroSensor;
  $("applyMeasure").onclick=()=>applyMeasurementToModel(true);

  $("measureTarget").onchange=()=>{
    state.sensor.target=$("measureTarget").value;
    updateMeasureStatus();
  };
  $("liveApply").onchange=()=>setLiveApply($("liveApply").checked);

  if($("shootApplyMeasure")) $("shootApplyMeasure").onclick=()=>applyMeasurementToModel(true);
  if($("shootLiveToggle")) $("shootLiveToggle").onclick=toggleLiveApply;

  updateMeasureStatus();
}
