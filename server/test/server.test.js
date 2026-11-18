import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { io as connect } from 'socket.io-client';
import { createServer } from '../src/index.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-'));
const srv = createServer({ port: 0, dataDir: dir });
const port = await srv.listen();
const base = `http://localhost:${port}`;
const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, ...(await r.json()) }));
const emit = (s, ev, data) => new Promise(res => s.emit(ev, data, res));
const once = (s, ev) => new Promise(res => s.once(ev, res));
const sock = token => { const s = connect(base, { auth: { token }, transports: ['websocket'] }); return new Promise((res, rej) => { s.on('connect', () => res(s)); s.on('connect_error', rej); }); };

test.after(() => srv.close());

test('회원가입 규칙', async () => {
  assert.equal((await post('/api/register', { username: 'ab', password: 'password1', nickname: '포탄왕' })).status, 400);
  assert.equal((await post('/api/register', { username: 'shellking', password: '', nickname: '포탄왕' })).status, 400);
  const ok = await post('/api/register', { username: 'shellking', password: 'password1', nickname: '포탄왕' });
  assert.equal(ok.status, 200); assert.ok(ok.token);
  assert.equal((await post('/api/register', { username: 'SHELLKING', password: 'password1', nickname: '다른닉' })).status, 409, '아이디 대소문자 중복');
  assert.equal((await post('/api/register', { username: 'other1', password: 'password1', nickname: '포탄왕' })).status, 409, '닉네임 중복');
});

test('로그인과 내 정보', async () => {
  assert.equal((await post('/api/login', { username: 'shellking', password: 'wrongpass' })).status, 401);
  const r = await post('/api/login', { username: 'shellking', password: 'password1' });
  assert.equal(r.user.nickname, '포탄왕');
  const me = await fetch(base + '/api/me', { headers: { authorization: 'Bearer ' + r.token } }).then(x => x.json());
  assert.equal(me.stats.games, 0);
  const pw = srv.db.raw.prepare('SELECT password_hash FROM users WHERE username = ?').get('shellking').password_hash;
  assert.ok(pw.startsWith('$2'), '비밀번호는 bcrypt 해시로만 저장');
});

test('토큰 없는 소켓은 거절', async () => {
  await assert.rejects(sock('bad-token'));
});

test('로비 채팅, 방 만들기·입장·준비·시작, 중복 접속', async () => {
  const a = await post('/api/login', { username: 'shellking', password: 'password1' });
  const b = await post('/api/register', { username: 'angle01', password: 'password2', nickname: '각도장인' });
  const sa = await sock(a.token), sb = await sock(b.token);
  const chat = once(sb, 'lobby:chat');
  assert.ok((await emit(sa, 'lobby:chat', { text: '  안녕  ' })).ok);
  assert.equal((await chat).text, '안녕');

  const made = await emit(sa, 'room:create', { title: '한판', password: '7', mode: 'team', mapId: 'valley' });
  assert.ok(made.ok, made.error);
  assert.equal((await emit(sb, 'room:join', { roomId: made.room.id, password: 'x' })).ok, false);
  const joined = await emit(sb, 'room:join', { roomId: made.room.id, password: '7' });
  assert.ok(joined.ok); assert.equal(joined.room.slots[4].nickname, '각도장인');
  assert.ok((await emit(sb, 'room:update', { tankId: 'laser', items: ['teleport', 'repair', 'shield', 'calm'] })).ok);
  assert.equal((await emit(sa, 'room:start')).ok, false, '준비 전에는 시작 불가');
  assert.ok((await emit(sb, 'room:ready', { ready: true })).ok);
  const started = once(sb, 'game:start');
  assert.ok((await emit(sa, 'room:start')).ok);
  const setup = await started;
  assert.equal(setup.mapId, 'valley'); assert.equal(setup.players.find(p => p.nickname === '각도장인').tankId, 'laser');
  assert.ok((await emit(sa, 'game:finish')).ok);

  const kicked = once(sa, 'session:kicked');
  const sa2 = await sock(a.token);
  await kicked;
  assert.ok((await emit(sa2, 'room:chat', { text: '다시 왔어' })).ok, '새 접속도 같은 방에 남아 있다');
  sa2.close(); sb.close(); sa.close();
});
