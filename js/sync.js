/* α60 Remote Sync
   同じWi-Fi上のMac/iPad/iPhoneで同じUIを同期するためのWebSocketクライアント。
   使い方: Macで `node sync-server.js` を起動し、各端末で同じURLを入力して接続。
*/
(function(){
  const SYNC_VERSION = '60';
  let socket = null;
  let clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  let applyingRemote = false;
  let lastSend = 0;
  let reconnectTimer = null;

  function deepClone(v){ return JSON.parse(JSON.stringify(v)); }
  function now(){ return Date.now(); }
  function el(id){ return document.getElementById(id); }

  function ensureSyncState(){
    if(!window.state) return;
    if(!state.sync){
      state.sync = {
        enabled:false,
        role:'host',
        url: localStorage.getItem('vcaSyncUrl') || defaultWsUrl(),
        connected:false,
        clientId:clientId,
        lastRemoteAt:0
      };
    }
  }

  function defaultWsUrl(){
    const host = location.hostname || 'localhost';
    return `ws://${host}:8787`;
  }

  function payload(){
    return {
      type:'state',
      source:clientId,
      version:SYNC_VERSION,
      time:now(),
      state:{
        view: state.view,
        data: deepClone(state.data),
        view3: deepClone(state.view3),
        sensor: deepClone(state.sensor),
        savedReference: deepClone(state.savedReference)
      },
      ui: collectUiValues()
    };
  }

  function collectUiValues(){
    const ids = ['focal','bellows','fnumCustom','coc','fnum','sensor','lensMaker','lensSeries','lensFocal','measureReference','measureTarget','liveApply'];
    const out = {};
    ids.forEach(id=>{
      const n = el(id);
      if(!n) return;
      out[id] = n.type === 'checkbox' ? !!n.checked : n.value;
    });
    return out;
  }

  function applyUiValues(ui){
    if(!ui) return;
    Object.keys(ui).forEach(id=>{
      const n = el(id);
      if(!n) return;
      if(n.type === 'checkbox') n.checked = !!ui[id];
      else if(n.value !== undefined) n.value = ui[id];
    });
  }

  function setStatus(text){
    const s = el('syncStatus');
    if(s) s.textContent = text;
    const pill = el('syncPill');
    if(pill) pill.textContent = text;
  }

  function connect(){
    ensureSyncState();
    if(!state.sync) return;
    const input = el('syncUrl');
    if(input && input.value.trim()) state.sync.url = input.value.trim();
    localStorage.setItem('vcaSyncUrl', state.sync.url);
    disconnect(false);
    try{
      socket = new WebSocket(state.sync.url);
      state.sync.enabled = true;
      state.sync.connected = false;
      setStatus('同期: 接続中…');
      socket.onopen = () => {
        state.sync.connected = true;
        setStatus('同期: 接続中');
        send(true);
      };
      socket.onmessage = (ev) => {
        let msg;
        try{ msg = JSON.parse(ev.data); }catch(_){ return; }
        if(!msg || msg.source === clientId || msg.type !== 'state' || !msg.state) return;
        applyRemote(msg);
      };
      socket.onclose = () => {
        state.sync.connected = false;
        setStatus(state.sync.enabled ? '同期: 切断（再接続待ち）' : '同期: オフ');
        if(state.sync.enabled){
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, 1800);
        }
      };
      socket.onerror = () => setStatus('同期: エラー');
    }catch(err){
      setStatus('同期: 接続失敗');
    }
  }

  function disconnect(updateUi=true){
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if(socket){
      try{ socket.close(); }catch(_){ }
      socket = null;
    }
    if(state.sync){
      state.sync.connected = false;
      if(updateUi) state.sync.enabled = false;
    }
    if(updateUi) setStatus('同期: オフ');
  }

  function send(force=false){
    ensureSyncState();
    if(!state.sync || !state.sync.enabled || applyingRemote) return;
    if(!socket || socket.readyState !== WebSocket.OPEN) return;
    const t = now();
    if(!force && t - lastSend < 80) return;
    lastSend = t;
    socket.send(JSON.stringify(payload()));
  }

  function applyRemote(msg){
    applyingRemote = true;
    try{
      if(msg.ui) applyUiValues(msg.ui);
      const rs = msg.state;
      if(rs.view) state.view = rs.view;
      if(rs.data) state.data = deepClone(rs.data);
      if(rs.view3) Object.assign(state.view3, deepClone(rs.view3));
      if(rs.sensor) Object.assign(state.sensor, deepClone(rs.sensor));
      if(rs.savedReference) state.savedReference = deepClone(rs.savedReference);
      state.sync.lastRemoteAt = now();
      if(typeof updateMeasureStatus === 'function') updateMeasureStatus();
      if(typeof updateSavedReferenceUI === 'function') updateSavedReferenceUI();
      if(el('measTilt')) el('measTilt').textContent = (state.sensor.tilt || 0).toFixed(1) + '°';
      if(el('measSwing')) el('measSwing').textContent = (state.sensor.swing || 0).toFixed(1) + '°';
      if(typeof setView === 'function'){
        const sb = el('sideBtn'), tb = el('topBtn');
        if(sb) sb.classList.toggle('on', state.view === 'side');
        if(tb) tb.classList.toggle('on', state.view === 'top');
      }
      if(typeof update === 'function') update();
      setStatus('同期: 接続中 / 受信');
    }finally{
      applyingRemote = false;
    }
  }

  function setupSync(){
    ensureSyncState();
    const url = el('syncUrl');
    if(url) url.value = state.sync.url || defaultWsUrl();
    const role = el('syncRole');
    if(role) role.value = state.sync.role || 'host';
    const connectBtn = el('syncConnect');
    const disconnectBtn = el('syncDisconnect');
    const sendBtn = el('syncSendNow');
    if(connectBtn) connectBtn.addEventListener('click', connect);
    if(disconnectBtn) disconnectBtn.addEventListener('click', () => disconnect(true));
    if(sendBtn) sendBtn.addEventListener('click', () => send(true));
    if(role) role.addEventListener('change', () => { state.sync.role = role.value; send(true); });
    setStatus('同期: オフ');
  }

  window.setupSync = setupSync;
  window.syncBroadcast = send;
  window.syncConnect = connect;
  window.syncDisconnect = disconnect;
  window.syncIsApplyingRemote = function(){ return applyingRemote; };
})();
