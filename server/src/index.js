// 포탄대결 서버: 웹페이지 제공 + 회원가입/로그인 API + 실시간 로비·대기방(Socket.IO)
import express from 'express';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { openDb } from './db.js';
import { makeAuth, loadSecret, AuthError } from './auth.js';
import { RoomManager, RoomError } from './rooms.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function createServer({ port = 3000, dataDir = path.join(ROOT, 'server', 'data'), dbFile } = {}) {
  const db = openDb(dbFile || path.join(dataDir, 'shellclash.db'));
  const auth = makeAuth(db, loadSecret(dataDir));
  const rooms = new RoomManager();
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  /* ---------- REST: 계정 ---------- */
  const tries = new Map(); // 로그인 시도 제한: IP당 1분에 10번
  const limited = ip => { const now = Date.now(), a = (tries.get(ip) || []).filter(t => now - t < 60000); a.push(now); tries.set(ip, a); return a.length > 10; };
  const wrap = fn => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (e) { res.status(e.status || 500).json({ error: e instanceof AuthError ? e.message : '서버 오류가 났어요. 잠시 뒤 다시 해 주세요.' }); if (!(e instanceof AuthError)) console.error(e); }
  };
  app.post('/api/register', wrap(req => { if (limited(req.ip)) throw new AuthError('잠시 뒤에 다시 해 주세요.', 429); return auth.register(req.body); }));
  app.post('/api/login', wrap(req => { if (limited(req.ip)) throw new AuthError('잠시 뒤에 다시 해 주세요.', 429); return auth.login(req.body); }));
  app.get('/api/me', wrap(req => {
    const u = auth.verify(String(req.headers.authorization || '').replace(/^Bearer /, ''));
    if (!u) throw new AuthError('다시 로그인해 주세요.', 401);
    return { user: u, stats: db.getStats(u.id) };
  }));

  /* ---------- 정적 파일 ---------- */
  app.use('/shared', express.static(path.join(ROOT, 'shared')));
  app.use('/art', express.static(path.join(ROOT, 'mockup'), { index: false }));
  app.use(express.static(path.join(ROOT, 'client')));

  /* ---------- 실시간 ---------- */
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: false } });
  const online = new Map(); // userId -> { socket, user }
  const away = new Map(); // userId -> 재접속 대기 타이머 (새로고침해도 1분 안에 오면 방에 남는다)
  const GRACE_MS = 60000; // 새로고침·잠깐 끊김 유예 1분
  const IDLE_MS = 60 * 60 * 1000; // 아무 활동이 없으면 1시간 뒤 로그아웃

  io.use((socket, next) => {
    const user = auth.verify(socket.handshake.auth?.token);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user; next();
  });

  let lobbyTimer = null;
  const pushLobby = () => {
    if (lobbyTimer) return;
    lobbyTimer = setTimeout(() => {
      lobbyTimer = null;
      const users = [...online.values()].map(({ user }) => { const r = rooms.roomOf(user.id); return { id: user.id, nickname: user.nickname, where: r ? r.id : null }; });
      io.emit('lobby:state', { users, rooms: rooms.list() });
    }, 50);
  };
  const pushRoom = room => { if (room && rooms.rooms.has(room.id)) io.to(`room:${room.id}`).emit('room:state', rooms.view(room)); };
  const system = (roomId, text) => io.to(`room:${roomId}`).emit('room:chat', { system: true, text, at: Date.now() });

  const chatGate = new Map();
  const canChat = id => { const now = Date.now(), a = (chatGate.get(id) || []).filter(t => now - t < 3000); if (a.length >= 5) return false; a.push(now); chatGate.set(id, a); return true; };
  const cleanText = t => String(t ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200);

  io.on('connection', socket => {
    const user = socket.data.user;
    const prev = online.get(user.id);
    online.set(user.id, { socket, user });
    if (away.has(user.id)) { clearTimeout(away.get(user.id)); away.delete(user.id); }
    if (prev) { prev.socket.emit('session:kicked', { reason: '다른 곳에서 같은 아이디로 접속했어요.' }); prev.socket.disconnect(true); }
    socket.emit('hello', { user, stats: db.getStats(user.id) });
    const r0 = rooms.roomOf(user.id); if (r0) { socket.join(`room:${r0.id}`); socket.emit('room:state', rooms.view(r0)); }
    pushLobby();

    // 활동 기록: 무엇이든 하면 1시간 타이머를 다시 시작하고, 5분마다 새 토큰을 준다
    let idleTimer = null, lastToken = Date.now();
    const touch = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { socket.emit('session:expired', { reason: '1시간 동안 활동이 없어 로그아웃됐어요. 다시 로그인해 주세요.' }); socket.disconnect(true); }, IDLE_MS); idleTimer.unref?.();
      if (Date.now() - lastToken > 5 * 60 * 1000) { lastToken = Date.now(); socket.emit('auth:token', { token: auth.refresh(user) }); }
    };
    touch();
    socket.on('activity', touch);
    socket.on('disconnect', () => clearTimeout(idleTimer));
    const handle = (name, fn) => socket.on(name, async (payload, ack) => {
      touch();
      const reply = typeof ack === 'function' ? ack : () => {};
      try { reply({ ok: true, ...(await fn(payload || {}) || {}) }); }
      catch (e) { reply({ ok: false, error: e instanceof RoomError ? e.message : '처리하지 못했어요.' }); if (!(e instanceof RoomError)) console.error(name, e); }
    });
    const enter = room => { socket.join(`room:${room.id}`); pushRoom(room); pushLobby(); return { room: rooms.view(room) }; };
    const leaveRoom = () => {
      const res = rooms.leave(user.id); if (!res) return;
      socket.leave(`room:${res.room.id}`);
      if (!res.deleted) { system(res.room.id, `${user.nickname} 님이 나갔어요.`); pushRoom(res.room); }
      pushLobby();
    };

    handle('lobby:chat', ({ text }) => {
      const t = cleanText(text); if (!t) return; if (!canChat(user.id)) throw new RoomError('채팅을 너무 빨리 보내고 있어요.');
      io.emit('lobby:chat', { from: user.nickname, text: t, at: Date.now() });
    });
    handle('room:create', o => { const room = rooms.create(user, o); return enter(room); });
    handle('room:join', ({ roomId, password }) => { const room = rooms.join(user, roomId, password); system(room.id, `${user.nickname} 님이 들어왔어요.`); return enter(room); });
    handle('room:quickjoin', () => { const room = rooms.quickJoin(user); system(room.id, `${user.nickname} 님이 들어왔어요.`); return enter(room); });
    handle('room:leave', () => { leaveRoom(); });
    handle('room:chat', ({ text }) => {
      const room = rooms.roomOf(user.id); if (!room) throw new RoomError('방에 있지 않아요.');
      const t = cleanText(text); if (!t) return; if (!canChat(user.id)) throw new RoomError('채팅을 너무 빨리 보내고 있어요.');
      io.to(`room:${room.id}`).emit('room:chat', { from: user.nickname, text: t, at: Date.now() });
    });
    handle('room:update', o => { pushRoom(rooms.update(user.id, o)); });
    handle('room:ready', ({ ready }) => { pushRoom(rooms.setReady(user.id, ready)); });
    handle('room:settings', o => { const room = rooms.settings(user.id, o); pushRoom(room); pushLobby(); });
    handle('room:kick', ({ userId }) => {
      const target = online.get(+userId);
      const room = rooms.kick(user.id, +userId);
      if (target) { target.socket.leave(`room:${room.id}`); target.socket.emit('room:kicked', { reason: '방장이 내보냈어요.' }); }
      system(room.id, `${target?.user.nickname || '누군가'} 님이 내보내졌어요.`); pushRoom(room); pushLobby();
    });
    handle('room:start', () => {
      const { room, setup } = rooms.start(user.id);
      io.to(`room:${room.id}`).emit('game:start', setup);
      system(room.id, '게임을 시작합니다!'); pushRoom(room); pushLobby();
    });
    // 전투는 3단계에서 서버 판정으로 붙는다. 지금은 방장이 끝내면 대기방으로 돌아간다.
    handle('game:finish', () => {
      const room = rooms.roomOf(user.id); if (!room || room.hostId !== user.id) throw new RoomError('방장만 끝낼 수 있어요.');
      rooms.finish(room.id); io.to(`room:${room.id}`).emit('game:end', { roomId: room.id }); pushRoom(room); pushLobby();
    });

    socket.on('disconnect', () => {
      if (online.get(user.id)?.socket === socket) {
        online.delete(user.id);
        if (rooms.roomOf(user.id)) away.set(user.id, setTimeout(() => { away.delete(user.id); if (!online.has(user.id)) leaveRoom(); }, GRACE_MS).unref());
      }
      pushLobby();
    });
  });

  return {
    app, server, io, db, rooms,
    listen: () => new Promise(res => server.listen(port, () => res(server.address().port))),
    close: () => new Promise(res => { away.forEach(t => clearTimeout(t)); server.closeAllConnections?.(); io.close(() => { db.close(); res(); }); }),
  };
}

function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = +process.env.PORT || 3000;
  const s = createServer({ port, dataDir: process.env.DATA_DIR });
  s.listen().then(p => {
    console.log('\n  포탄대결 서버가 켜졌어요!');
    console.log(`  이 PC에서:   http://localhost:${p}`);
    lanAddresses().forEach(a => console.log(`  같은 공유기: http://${a}:${p}`));
    console.log('  친구가 밖에서 들어오려면 공유기 포트포워딩(' + p + ') 또는 Tailscale 주소를 알려 주세요.');
    console.log('  끄려면 이 창에서 Ctrl + C\n');
  });
}
