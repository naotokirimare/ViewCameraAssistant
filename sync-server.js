// ViewCamera Assistant Remote Sync Relay
// MacBookなどで実行: node sync-server.js
// 同じWi-Fiの各端末で ws://MacのIPアドレス:8787 を入力して接続します。
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const clients = new Set();

function acceptKey(key){
  return crypto.createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
}

function encodeFrame(str){
  const data = Buffer.from(str);
  const len = data.length;
  if(len < 126) return Buffer.concat([Buffer.from([0x81, len]), data]);
  if(len < 65536){
    const h = Buffer.alloc(4); h[0]=0x81; h[1]=126; h.writeUInt16BE(len,2);
    return Buffer.concat([h, data]);
  }
  const h = Buffer.alloc(10); h[0]=0x81; h[1]=127; h.writeBigUInt64BE(BigInt(len),2);
  return Buffer.concat([h, data]);
}

function decodeFrames(buffer){
  const messages = [];
  let offset = 0;
  while(offset + 2 <= buffer.length){
    const b1 = buffer[offset];
    const b2 = buffer[offset+1];
    const opcode = b1 & 0x0f;
    let len = b2 & 0x7f;
    const masked = !!(b2 & 0x80);
    let pos = offset + 2;
    if(len === 126){ if(pos + 2 > buffer.length) break; len = buffer.readUInt16BE(pos); pos += 2; }
    else if(len === 127){ if(pos + 8 > buffer.length) break; len = Number(buffer.readBigUInt64BE(pos)); pos += 8; }
    let mask;
    if(masked){ if(pos + 4 > buffer.length) break; mask = buffer.slice(pos,pos+4); pos += 4; }
    if(pos + len > buffer.length) break;
    const payload = Buffer.from(buffer.slice(pos,pos+len));
    if(masked){ for(let i=0;i<payload.length;i++) payload[i] ^= mask[i%4]; }
    if(opcode === 1) messages.push(payload.toString('utf8'));
    offset = pos + len;
  }
  return {messages, rest: buffer.slice(offset)};
}

const server = http.createServer((req,res)=>{
  res.writeHead(200, {'Content-Type':'text/plain; charset=utf-8'});
  res.end('ViewCamera Assistant sync relay is running. WebSocket: ws://<this-mac-ip>:' + PORT + '\n');
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if(!key){ socket.destroy(); return; }
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    'Sec-WebSocket-Accept: ' + acceptKey(key),
    '', ''
  ].join('\r\n'));
  socket._buffer = Buffer.alloc(0);
  clients.add(socket);
  console.log('client connected:', clients.size);

  socket.on('data', chunk => {
    socket._buffer = Buffer.concat([socket._buffer, chunk]);
    const decoded = decodeFrames(socket._buffer);
    socket._buffer = decoded.rest;
    decoded.messages.forEach(msg => {
      const frame = encodeFrame(msg);
      for(const c of clients){
        if(c !== socket && !c.destroyed) c.write(frame);
      }
    });
  });
  socket.on('close', () => { clients.delete(socket); console.log('client disconnected:', clients.size); });
  socket.on('error', () => { clients.delete(socket); });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('ViewCamera sync relay running on port ' + PORT);
  console.log('Open ws://<MacのIPアドレス>:' + PORT + ' from iPhone/iPad/Mac.');
});
