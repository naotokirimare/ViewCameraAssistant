function updateMeasureStatus(){
  const targetSelect = $("measureTarget");
  const targetLabel = targetSelect ? targetSelect.selectedOptions[0].textContent.replace("に反映","") : "Front";
  const active = state.sensor.active ? "測定中" : "停止中";
  const live = state.sensor.liveApply ? "リアルタイムON" : "リアルタイムOFF";

  if($("shootMeasureStatus")) $("shootMeasureStatus").textContent = `測定: ${active} / ${live} / ${targetLabel}`;
  if($("shootLiveToggle")) $("shootLiveToggle").textContent = state.sensor.liveApply ? "リアルタイムON" : "リアルタイムOFF";
  if($("liveApply")) $("liveApply").checked = state.sensor.liveApply;
  if($("sensorToggleBtn")){
    $("sensorToggleBtn").textContent = state.sensor.active ? "測定停止" : "測定開始";
    $("sensorToggleBtn").classList.toggle("dangerBtn", state.sensor.active);
    $("sensorToggleBtn").classList.toggle("primary", !state.sensor.active);
  }
}

function onDeviceOrientation(e){
  const rawTilt = (typeof e.beta === "number") ? e.beta : 0;
  const rawSwing = (typeof e.gamma === "number") ? e.gamma : 0;
  state.sensor.tilt = clamp(rawTilt - state.sensor.zeroTilt, -90, 90);
  state.sensor.swing = clamp(rawSwing - state.sensor.zeroSwing, -90, 90);

  if($("measTilt")) $("measTilt").textContent = state.sensor.tilt.toFixed(1) + "°";
  if($("measSwing")) $("measSwing").textContent = state.sensor.swing.toFixed(1) + "°";

  if(state.sensor.liveApply) applyMeasurementToModel(false);
  updateMeasureStatus();
}

async function startSensor(){
  try{
    if(typeof DeviceOrientationEvent !== "undefined" &&
       typeof DeviceOrientationEvent.requestPermission === "function"){
      const res = await DeviceOrientationEvent.requestPermission();
      if(res !== "granted"){
        if($("sensorStatus")) $("sensorStatus").innerHTML = "センサー許可が拒否されました。Safariの設定を確認してください。";
        state.sensor.active=false;
        updateMeasureStatus();
        return;
      }
    }
    window.removeEventListener("deviceorientation", onDeviceOrientation);
    window.addEventListener("deviceorientation", onDeviceOrientation, true);
    state.sensor.active=true;
    if($("sensorStatus")) $("sensorStatus").innerHTML="測定中。Tilt / Swingを読み取っています。";
    updateMeasureStatus();
  }catch(err){
    if($("sensorStatus")) $("sensorStatus").innerHTML="センサー開始に失敗しました: " + err.message;
    state.sensor.active=false;
    updateMeasureStatus();
  }
}

function stopSensor(){
  window.removeEventListener("deviceorientation", onDeviceOrientation);
  state.sensor.active=false;
  state.sensor.liveApply=false;
  if($("liveApply")) $("liveApply").checked=false;
  if($("sensorStatus")) $("sensorStatus").innerHTML="測定を停止しました。";
  updateMeasureStatus();
}

function toggleSensor(){
  if(state.sensor.active) stopSensor();
  else startSensor();
}

function zeroSensor(){
  state.sensor.zeroTilt += state.sensor.tilt;
  state.sensor.zeroSwing += state.sensor.swing;
  state.sensor.tilt=0;
  state.sensor.swing=0;
  if($("measTilt")) $("measTilt").textContent="0.0°";
  if($("measSwing")) $("measSwing").textContent="0.0°";
  if($("sensorStatus")) $("sensorStatus").innerHTML="ゼロ補正しました。";
  updateMeasureStatus();
}

function resetZeroSensor(){
  state.sensor.zeroTilt=0;
  state.sensor.zeroSwing=0;
  if($("sensorStatus")) $("sensorStatus").innerHTML="ゼロ補正をリセットしました。";
  updateMeasureStatus();
}

function setLiveApply(on){
  state.sensor.liveApply = !!on;
  updateMeasureStatus();
  if(state.sensor.liveApply){
    applyMeasurementToModel(false);
  }
}

function toggleLiveApply(){
  setLiveApply(!state.sensor.liveApply);
}

function applyMeasurementToModel(showMessage=true){
  const targetSelect=$("measureTarget");
  const target=targetSelect ? targetSelect.value : (state.sensor.target || "front");
  state.sensor.target=target;

  if(target==="readOnly"){
    if(showMessage && $("sensorStatus")) $("sensorStatus").innerHTML="読むだけモードです。図には反映していません。";
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
  if(showMessage && $("sensorStatus")) $("sensorStatus").innerHTML="現在値を図に反映しました。";
  updateMeasureStatus();
}

function setupMeasurement(){
  if($("sensorToggleBtn")) $("sensorToggleBtn").onclick=toggleSensor;
  if($("sensorBtn")) $("sensorBtn").onclick=startSensor;
  if($("stopSensor")) $("stopSensor").onclick=stopSensor;

  if($("zeroSensor")) $("zeroSensor").onclick=zeroSensor;
  if($("resetZeroSensor")) $("resetZeroSensor").onclick=resetZeroSensor;
  if($("applyMeasure")) $("applyMeasure").onclick=()=>applyMeasurementToModel(true);

  if($("measureTarget")){
    $("measureTarget").onchange=()=>{
      state.sensor.target=$("measureTarget").value;
      updateMeasureStatus();
    };
  }
  if($("liveApply")) $("liveApply").onchange=()=>setLiveApply($("liveApply").checked);

  if($("shootApplyMeasure")) $("shootApplyMeasure").onclick=(e)=>{
    e.preventDefault();
    applyMeasurementToModel(true);
  };
  if($("shootLiveToggle")) $("shootLiveToggle").onclick=(e)=>{
    e.preventDefault();
    toggleLiveApply();
  };

  updateMeasureStatus();
}
