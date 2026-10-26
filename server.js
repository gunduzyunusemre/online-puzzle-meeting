'use strict';
/*
 * Yapboz Düellosu — oyun sunucusu
 *   node server.js            → aynı Wi-Fi'daki cihazlar katılabilir
 *   node server.js --internet → Cloudflare tüneli açılır, her yerden katılınabilir
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');
let qr = null;
try { qr = require('qrcode-terminal'); } catch (e) { /* QR isteğe bağlı */ }

const PORT = parseInt(process.env.PORT, 10) || 3000;
const INTERNET = process.argv.includes('--internet') || process.env.TUNNEL === '1';
const PUBLIC = path.join(__dirname, 'public');
const COLORS = ['#ff4d6d', '#5b4dff', '#19b394', '#ff8a3d', '#2fa4ff', '#c04bd6', '#d4a000', '#00a3a3'];
const CODE_CH = 'ABCDEFGHJKMNPRSTUVYZ23456789';
const MAX_IMG = 3 * 1024 * 1024;
const PENALTY_MS = 1500;
const MAX_PLAYERS = 12;
const MAX_ROOMS = 200;
const MAX_VOICE = 8; // sesli sohbet herkes herkese bağlanır; 8 kişiye kadar rahat çalışır
const EMPTY_ROOM_TTL = 2 * 60 * 60 * 1000;
const HOST_AWAY_MS = 30 * 1000;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json',
};

const rooms = new Map();
const log = (...a) => console.log(new Date().toLocaleTimeString('tr-TR'), '·', ...a);

/* ---------------- HTTP: sayfa + oda resimleri ---------------- */
const server = http.createServer((req, res) => {
  let u;
  try { u = new URL(req.url, 'http://localhost'); } catch (e) { res.writeHead(400); return res.end(); }

  const m = u.pathname.match(/^\/room\/([A-Z0-9]{4})\/image$/);
  if (m) {
    const r = rooms.get(m[1]);
    if (!r) { res.writeHead(404); return res.end('Oda yok'); }
    res.writeHead(200, { 'Content-Type': r.imgType, 'Cache-Control': 'no-store', 'Content-Length': r.img.length });
    return res.end(r.img);
  }
  if (u.pathname === '/ice') {
    // Sesli sohbet için bağlantı sunucuları. TURN_URLS ortam değişkeni verilirse zor ağlarda da (mobil veri) çalışır.
    const ice = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
    if (process.env.TURN_URLS) {
      ice.push({
        urls: process.env.TURN_URLS.split(',').map((x) => x.trim()).filter(Boolean),
        username: process.env.TURN_USERNAME || '', credential: process.env.TURN_CREDENTIAL || '',
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ iceServers: ice }));
  }
  if (u.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }

  let rel;
  try { rel = u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname).replace(/^\/+/, ''); }
  catch (e) { res.writeHead(400); return res.end(); }
  const file = path.resolve(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Bulunamadı'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

/* ---------------- Yardımcılar ---------------- */
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);
const clampInt = (v, lo, hi, d) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d);
const coord = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(Math.max(-0.5, Math.min(1.5, v)) * 1000) / 1000 : null);
const newSeed = () => Math.floor(Math.random() * 2147483647);

function genCode() {
  for (let i = 0; i < 100; i++) {
    let s = '';
    for (let j = 0; j < 4; j++) s += CODE_CH[Math.floor(Math.random() * CODE_CH.length)];
    if (!rooms.has(s)) return s;
  }
  return null;
}
function sendTo(ws, o) { if (ws.readyState === 1) ws.send(JSON.stringify(o)); }
function broadcast(room, o) {
  const s = JSON.stringify(o);
  for (const p of room.players.values()) for (const ws of p.conns) if (ws.readyState === 1) ws.send(s);
}
function snapshot(room) {
  return {
    t: 'state', code: room.code, host: room.host, status: room.status,
    cols: room.cols, rows: room.rows, seed: room.seed, ver: room.ver,
    startedAt: room.startedAt, finishedAt: room.finishedAt, now: Date.now(),
    players: [...room.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score, miss: p.miss, online: p.conns.size > 0 })),
    placed: [...room.placed.entries()],
  };
}
const pushState = (room) => broadcast(room, snapshot(room));
const voiceList = (room) => [...room.voice.values()];
const pushVoice = (room) => broadcast(room, { t: 'voice', list: voiceList(room) });

function passHost(room) {
  const cand = [...room.players.values()]
    .filter((p) => p.conns.size && p.id !== room.host)
    .sort((a, b) => a.joinedAt - b.joinedAt)[0];
  if (cand) { room.host = cand.id; room.hostAway = 0; log(`Oda ${room.code}: yeni kurucu ${cand.name}`); return true; }
  return false;
}

function attach(ws, room) {
  detach(ws, false);
  let p = room.players.get(ws.pid);
  if (!p) {
    if (room.players.size >= MAX_PLAYERS) return sendTo(ws, { t: 'error', code: 'full', msg: 'Oda dolu' });
    const used = new Set([...room.players.values()].map((x) => x.color));
    const color = COLORS.find((c) => !used.has(c)) || COLORS[room.players.size % COLORS.length];
    p = { id: ws.pid, name: ws.name, color, score: 0, miss: 0, frozenUntil: 0, joinedAt: Date.now(), conns: new Set() };
    room.players.set(p.id, p);
    log(`Oda ${room.code}: ${p.name} katıldı`);
  }
  p.name = ws.name || p.name;
  p.conns.add(ws);
  ws.room = room.code;
  room.emptySince = null;
  pushState(room);
  sendTo(ws, { t: 'voice', list: voiceList(room) });
}

function detach(ws, explicit) {
  const room = ws.room && rooms.get(ws.room);
  ws.room = null;
  if (!room) return;
  if (room.voice.delete(ws.cid)) pushVoice(room);
  const p = room.players.get(ws.pid);
  if (p) {
    p.conns.delete(ws);
    if (p.conns.size === 0) {
      if (room.holds.delete(p.id)) room.holdsDirty = true;
      if (explicit) {
        if (room.host === p.id) passHost(room);
        // Lobideyken çıkan oyuncu listeden silinir; oyun sürerken puanı kalsın
        if (room.status === 'lobby' && room.host !== p.id) room.players.delete(p.id);
        log(`Oda ${room.code}: ${p.name} ayrıldı`);
      }
    }
  }
  if (![...room.players.values()].some((x) => x.conns.size)) room.emptySince = Date.now();
  pushState(room);
}

/* ---------------- Oyun mesajları ---------------- */
function handle(ws, m) {
  if (!m || typeof m.t !== 'string') return;
  if (m.t === 'ping') return; // canlı tutma sinyali
  if (m.t === 'hello') {
    if (typeof m.id === 'string' && /^[a-z0-9]{20}$/.test(m.id)) ws.pid = m.id;
    ws.name = clean(m.name, 14) || 'Oyuncu';
    return sendTo(ws, { t: 'welcome', cid: ws.cid });
  }
  if (!ws.pid) return sendTo(ws, { t: 'error', msg: 'Bağlantı henüz hazır değil' });
  if (typeof m.name === 'string') ws.name = clean(m.name, 14) || ws.name;

  switch (m.t) {
    case 'create': {
      if (rooms.size >= MAX_ROOMS) return sendTo(ws, { t: 'error', msg: 'Sunucuda çok fazla oda var' });
      const mm = typeof m.img === 'string' && m.img.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!mm) return sendTo(ws, { t: 'error', msg: 'Resim okunamadı' });
      const buf = Buffer.from(mm[2], 'base64');
      if (!buf.length || buf.length > MAX_IMG) return sendTo(ws, { t: 'error', msg: 'Resim çok büyük' });
      const code = genCode();
      if (!code) return sendTo(ws, { t: 'error', msg: 'Oda kodu üretilemedi' });
      const cols = clampInt(m.cols, 2, 24, 4), rows = clampInt(m.rows, 2, 24, 3);
      const r = {
        code, host: ws.pid, hostAway: 0, status: 'lobby', cols, rows, seed: newSeed(), ver: 1,
        startedAt: 0, finishedAt: 0, img: buf, imgType: mm[1],
        players: new Map(), placed: new Map(), holds: new Map(), holdsDirty: false, voice: new Map(),
        emptySince: null, created: Date.now(),
      };
      rooms.set(code, r);
      log(`Oda ${code} kuruldu (${cols}×${rows} = ${cols * rows} parça)`);
      return attach(ws, r);
    }
    case 'join': {
      const r = rooms.get(String(m.code || '').toUpperCase());
      if (!r) return sendTo(ws, { t: 'error', code: 'noroom', msg: 'Bu kodla bir oda bulunamadı' });
      return attach(ws, r);
    }
    case 'leave':
      return detach(ws, true);
  }

  const room = ws.room && rooms.get(ws.room);
  const me = room && room.players.get(ws.pid);
  if (!room || !me) return;

  switch (m.t) {
    case 'start':
      if (room.host !== me.id || room.status !== 'lobby') return;
      room.status = 'playing';
      room.startedAt = Date.now();
      log(`Oda ${room.code}: oyun başladı (${room.players.size} oyuncu)`);
      return pushState(room);

    case 'rematch':
      if (room.host !== me.id || room.status !== 'done') return;
      room.seed = newSeed(); room.ver++;
      room.placed.clear(); room.holds.clear();
      room.status = 'playing'; room.startedAt = Date.now(); room.finishedAt = 0;
      for (const p of room.players.values()) { p.score = 0; p.miss = 0; p.frozenUntil = 0; }
      log(`Oda ${room.code}: rövanş`);
      return pushState(room);

    case 'voice': {
      if (m.on) {
        if (room.voice.size >= MAX_VOICE && !room.voice.has(ws.cid)) return sendTo(ws, { t: 'error', msg: 'Sesli sohbet dolu (en fazla ' + MAX_VOICE + ' kişi)' });
        room.voice.set(ws.cid, { cid: ws.cid, pid: me.id, muted: !!m.muted });
      } else room.voice.delete(ws.cid);
      return pushVoice(room);
    }

    case 'rtc': {
      // Ses bağlantısı kurulum mesajlarını yalnızca aynı odadaki sesli sohbet katılımcıları arasında iletir
      if (typeof m.to !== 'string' || !room.voice.has(ws.cid) || !room.voice.has(m.to)) return;
      if (JSON.stringify(m.data || null).length > 20000) return;
      for (const p of room.players.values()) for (const c of p.conns) {
        if (c.cid === m.to) return sendTo(c, { t: 'rtc', from: ws.cid, data: m.data });
      }
      return;
    }

    case 'hold': {
      if (room.status !== 'playing') return;
      const total = room.cols * room.rows;
      const pid = Number.isInteger(m.pid) && m.pid >= 0 && m.pid < total && !room.placed.has(m.pid) ? m.pid : null;
      if (pid === null) room.holds.delete(me.id);
      else room.holds.set(me.id, [me.id, pid, coord(m.hx), coord(m.hy)]);
      room.holdsDirty = true;
      return;
    }

    case 'place': {
      if (room.status !== 'playing') return;
      const total = room.cols * room.rows, pid = m.pid;
      if (!Number.isInteger(pid) || pid < 0 || pid >= total) return;
      const now = Date.now();
      if (now < me.frozenUntil) return sendTo(ws, { t: 'frozen', ms: me.frozenUntil - now });
      if (room.holds.delete(me.id)) room.holdsDirty = true;
      // Başkası daha önce koyduysa: kaybedene sonucu bildir
      if (room.placed.has(pid)) return sendTo(ws, { t: 'placed', pid, by: room.placed.get(pid) });
      const ok = Number.isInteger(m.r) && Number.isInteger(m.c) && m.c >= 0 && m.c < room.cols && m.r * room.cols + m.c === pid;
      if (!ok) {
        me.miss++;
        me.frozenUntil = now + PENALTY_MS;
        return sendTo(ws, { t: 'wrong', ms: PENALTY_MS });
      }
      room.placed.set(pid, me.id);
      me.score++;
      for (const [k, h] of room.holds) if (h[1] === pid) { room.holds.delete(k); room.holdsDirty = true; }
      broadcast(room, { t: 'placed', pid, by: me.id });
      if (room.placed.size >= total) {
        room.status = 'done';
        room.finishedAt = now;
        const win = [...room.players.values()].sort((a, b) => b.score - a.score)[0];
        log(`Oda ${room.code}: bitti, kazanan ${win ? win.name : '-'}`);
        pushState(room);
      }
      return;
    }
  }
}

/* ---------------- WebSocket ---------------- */
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 5 * 1024 * 1024 });
wss.on('connection', (ws) => {
  ws.cid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (buf) => {
    let msg;
    try { msg = JSON.parse(buf); } catch (e) { return; }
    try { handle(ws, msg); } catch (e) { console.error('Mesaj işlenemedi:', e); }
  });
  ws.on('close', () => detach(ws, false));
  ws.on('error', () => {});
});

// Kopan bağlantıları yakala
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch (e) { /* yoksay */ }
  });
}, 20000);

// "Kim hangi parçayı tutuyor" bilgisini toplu gönder (saniyede ~16 kez)
setInterval(() => {
  for (const r of rooms.values()) {
    if (!r.holdsDirty) continue;
    r.holdsDirty = false;
    broadcast(r, { t: 'holds', list: [...r.holds.values()] });
  }
}, 60);

// Bakım: boş odaları kapat, ortadan kaybolan kurucunun yerine birini geçir
setInterval(() => {
  const now = Date.now();
  for (const [code, r] of rooms) {
    if (r.emptySince && now - r.emptySince > EMPTY_ROOM_TTL) { rooms.delete(code); log(`Oda ${code} kapatıldı (boş)`); continue; }
    const h = r.players.get(r.host);
    if (h && h.conns.size) { r.hostAway = 0; continue; }
    if (!r.hostAway) r.hostAway = now;
    else if (now - r.hostAway > HOST_AWAY_MS && passHost(r)) pushState(r);
  }
}, 10000);

/* ---------------- Başlangıç ---------------- */
function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}
function showUrl(title, url) {
  console.log(`\n  ${title}\n  👉 ${url}\n`);
  if (qr) qr.generate(url, { small: true }, (s) => console.log(s.split('\n').map((l) => '  ' + l).join('\n')));
}

function startTunnel() {
  const bin = process.env.CLOUDFLARED || 'cloudflared';
  console.log('  İnternet tüneli açılıyor (Cloudflare)…');
  let found = false;
  const cp = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  const onData = (d) => {
    if (found) return;
    const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m) {
      found = true;
      showUrl('🌍 HERKES İÇİN BAĞLANTI (farklı Wi-Fi / mobil veri):', m[0]);
      console.log('  Bu bağlantıyı arkadaşlarına gönder. Pencereyi kapatma; kapatınca oyun da kapanır.\n');
    }
  };
  cp.stdout.on('data', onData);
  cp.stderr.on('data', onData);
  cp.on('error', () => {
    console.log(
      '\n  ⚠️  cloudflared bulunamadı. İnternet bağlantısı için bir kez kurman gerekiyor:\n' +
      '     Windows : winget install --id Cloudflare.cloudflared\n' +
      '     macOS   : brew install cloudflared\n' +
      '     Linux   : https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/\n' +
      '  Kurduktan sonra terminali kapatıp yeniden aç ve tekrar başlat.\n' +
      '  (Sunucu yine de aynı Wi-Fi\'daki cihazlar için çalışmaya devam ediyor.)\n'
    );
  });
  cp.on('exit', (code) => { if (found) log(`Tünel kapandı (kod ${code})`); });
  const stop = () => { try { cp.kill(); } catch (e) { /* yoksay */ } process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`\n  ❌ ${PORT} numaralı port kullanımda. Başka bir port dene:  PORT=3001 node server.js\n`);
  else console.error(e);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  🧩 Yapboz Düellosu sunucusu çalışıyor\n');
  console.log(`  Bu bilgisayarda:  http://localhost:${PORT}`);
  const ips = lanAddresses();
  if (ips.length) showUrl('📶 AYNI WI-FI\'DAKİ CİHAZLAR İÇİN:', `http://${ips[0]}:${PORT}`);
  if (ips.length > 1) console.log('  Diğer yerel adresler: ' + ips.slice(1).map((ip) => `http://${ip}:${PORT}`).join('  ') + '\n');
  if (INTERNET) startTunnel();
  else console.log('  Farklı ağlardaki arkadaşlar için sunucuyu "internet" modunda başlat (internet.bat ya da npm run internet).\n');
  console.log('  Durdurmak için: Ctrl + C\n');
});
