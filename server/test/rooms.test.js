import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../src/rooms.js';

const U = (id, nickname = 'u' + id) => ({ id, nickname });

test('방 만들기·입장·팀 배치', () => {
  const m = new RoomManager();
  const r = m.create(U(1), { title: '금요일', mode: 'team', mapId: 'valley' });
  assert.equal(r.slots[0].userId, 1);
  m.join(U(2), r.id); m.join(U(3), r.id);
  assert.equal(r.slots[4].userId, 2, '두 번째 사람은 블루팀으로');
  assert.equal(r.slots[1].userId, 3, '세 번째 사람은 다시 레드팀으로');
  assert.throws(() => m.create(U(2)), /이미 다른 방/);
});

test('비밀번호와 꽉 찬 방', () => {
  const m = new RoomManager();
  const r = m.create(U(1), { password: '1234' });
  assert.throws(() => m.join(U(2), r.id, 'x'), /비밀번호/);
  m.join(U(2), r.id, '1234');
  for (let i = 3; i <= 8; i++) m.join(U(i), r.id, '1234');
  assert.throws(() => m.join(U(9), r.id, '1234'), /꽉 찼/);
});

test('가방 6칸 제한과 탱크 선택', () => {
  const m = new RoomManager(); const r = m.create(U(1));
  m.update(1, { tankId: 'laser', items: ['double', 'teleport', 'repair', 'calm'] });
  assert.equal(r.slots[0].tankId, 'laser');
  assert.throws(() => m.update(1, { items: ['double', 'teleport', 'teamrepair', 'calm'] }), /6칸/);
  assert.throws(() => m.update(1, { tankId: 'nope' }), /없는 탱크/);
});

test('준비와 시작 조건', () => {
  const m = new RoomManager(); const r = m.create(U(1), { mode: 'team' });
  assert.throws(() => m.start(1), /2명 이상/);
  m.join(U(2), r.id);
  assert.throws(() => m.start(1), /준비 안 한/);
  assert.throws(() => m.start(2), /방장만/);
  m.setReady(2, true);
  const { setup } = m.start(1);
  assert.equal(r.status, 'playing');
  assert.equal(setup.players.length, 2);
  assert.ok(setup.players.every(p => p.tankId !== 'random'), '랜덤 탱크는 시작할 때 정해진다');
  assert.throws(() => m.join(U(3), r.id), /진행 중/);
  m.finish(r.id); assert.equal(r.status, 'waiting'); assert.equal(r.slots[4].ready, false);
});

test('팀전은 양쪽 팀이 있어야 시작', () => {
  const m = new RoomManager(); const r = m.create(U(1), { mode: 'team' });
  m.join(U(2), r.id); m.update(2, { slot: 1 }); m.setReady(2, true);
  assert.throws(() => m.start(1), /양쪽 팀/);
});

test('방장이 나가면 넘겨주고, 다 나가면 방이 없어진다', () => {
  const m = new RoomManager(); const r = m.create(U(1)); m.join(U(2), r.id);
  m.leave(1); assert.equal(r.hostId, 2);
  const res = m.leave(2); assert.ok(res.deleted); assert.equal(m.rooms.size, 0);
});

test('강퇴와 설정은 방장만', () => {
  const m = new RoomManager(); const r = m.create(U(1)); m.join(U(2), r.id);
  assert.throws(() => m.kick(2, 1), /방장만/);
  assert.throws(() => m.settings(2, { mapId: 'snow' }), /방장만/);
  m.settings(1, { mapId: 'snow', turnSeconds: 30, mode: 'solo' });
  assert.equal(r.mapId, 'snow'); assert.equal(r.mode, 'solo');
  m.kick(1, 2); assert.equal(m.roomOf(2), null);
});

test('컴퓨터 넣기·빼기와 시작', () => {
  const m = new RoomManager(); const r = m.create(U(1), { mode: 'team' });
  assert.throws(() => m.addBot(2), /방에 있지/);
  m.addBot(1);
  const bot = r.slots.find(s => s?.bot);
  assert.ok(bot && bot.ready && bot.userId < 0);
  const { setup } = m.start(1); assert.ok(setup.players.some(p => p.bot));
  m.finish(r.id); m.kick(1, bot.userId); assert.ok(!r.slots.some(s => s?.bot));
  m.addBot(1); const res = m.leave(1); assert.ok(res.deleted, '사람이 모두 나가면 방이 없어진다');
});
