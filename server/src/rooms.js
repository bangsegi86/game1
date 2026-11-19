// 대기방 규칙 (소켓과 분리된 순수 로직이라 테스트하기 쉽다)
import { TANK_IDS, MAP_IDS, TURN_SECONDS, MAX_PLAYERS, DEFAULT_BAG, validBag, pickRandomTank, ITEM_SIZES } from '../../shared/gamedata.js';

export class RoomError extends Error {}
const fail = msg => { throw new RoomError(msg); };
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export class RoomManager {
  constructor() { this.rooms = new Map(); this.nextId = 1; this.where = new Map(); this.botId = -1; }

  teamOf(room, slot) { return room.mode === 'team' ? (slot < 4 ? 'red' : 'blue') : 'solo'; }
  players(room) { return room.slots.map((p, i) => p && { ...p, slot: i, team: this.teamOf(room, i) }).filter(Boolean); }

  create(user, o = {}) {
    if (this.where.has(user.id)) fail('이미 다른 방에 있어요.');
    const title = clean(o.title, 24) || `${user.nickname}의 방`;
    const room = {
      id: this.nextId++, title, password: clean(o.password, 16) || null, hostId: user.id,
      mode: o.mode === 'solo' ? 'solo' : 'team', mapId: MAP_IDS.includes(o.mapId) || o.mapId === 'random' ? o.mapId : 'valley',
      turnSeconds: TURN_SECONDS.includes(+o.turnSeconds) ? +o.turnSeconds : 20, status: 'waiting',
      slots: Array(MAX_PLAYERS).fill(null), createdAt: Date.now(),
    };
    if (this.nextId > 999) this.nextId = 1;
    this.rooms.set(room.id, room);
    this._seat(room, user, 0);
    return room;
  }
  join(user, roomId, password) {
    const room = this.rooms.get(+roomId); if (!room) fail('방이 없어졌어요.');
    if (this.where.get(user.id) === room.id) return room;
    if (this.where.has(user.id)) fail('이미 다른 방에 있어요.');
    if (room.status !== 'waiting') fail('게임이 진행 중인 방이에요.');
    if (room.password && room.password !== String(password ?? '')) fail('비밀번호가 맞지 않아요.');
    const slot = this._freeSlot(room); if (slot < 0) fail('방이 꽉 찼어요.');
    this._seat(room, user, slot);
    return room;
  }
  quickJoin(user) {
    const cand = [...this.rooms.values()].filter(r => r.status === 'waiting' && !r.password && this._freeSlot(r) >= 0)
      .sort((a, b) => this.players(b).length - this.players(a).length)[0];
    if (!cand) fail('들어갈 수 있는 방이 없어요. 방을 만들어 보세요.');
    return this.join(user, cand.id);
  }
  _freeSlot(room) {
    if (room.mode === 'team') { const red = room.slots.slice(0, 4).filter(Boolean).length, blue = room.slots.slice(4).filter(Boolean).length; const order = red <= blue ? [0, 1, 2, 3, 4, 5, 6, 7] : [4, 5, 6, 7, 0, 1, 2, 3]; return order.find(i => !room.slots[i]) ?? -1; }
    return room.slots.findIndex(s => !s);
  }
  _seat(room, user, slot) {
    room.slots[slot] = { userId: user.id, nickname: user.nickname, tankId: 'random', items: [...DEFAULT_BAG], ready: false };
    this.where.set(user.id, room.id);
  }
  addBot(hostId) {
    const room = this.roomOf(hostId); if (!room) fail('방에 있지 않아요.');
    if (room.hostId !== hostId) fail('방장만 컴퓨터를 넣을 수 있어요.');
    if (room.status !== 'waiting') fail('게임 중에는 넣을 수 없어요.');
    const slot = this._freeSlot(room); if (slot < 0) fail('빈 자리가 없어요.');
    const n = room.slots.filter(s => s?.bot).length + 1;
    room.slots[slot] = { userId: this.botId--, nickname: `컴퓨터${n}`, tankId: 'random', items: ['repair', 'power', 'double', 'shield'], ready: true, bot: true };
    return room;
  }
  roomOf(userId) { const id = this.where.get(userId); return id ? this.rooms.get(id) : null; }
  slotOf(room, userId) { return room.slots.findIndex(s => s && s.userId === userId); }

  leave(userId) {
    const room = this.roomOf(userId); if (!room) return null;
    const i = this.slotOf(room, userId); if (i >= 0) room.slots[i] = null;
    this.where.delete(userId);
    const left = this.players(room).filter(p => !p.bot);
    if (!left.length) { this.rooms.delete(room.id); return { room, deleted: true }; }
    if (room.hostId === userId) { room.hostId = left[0].userId; room.slots[left[0].slot].ready = false; }
    return { room, deleted: false };
  }
  update(userId, o = {}) {
    const room = this.roomOf(userId); if (!room) fail('방에 있지 않아요.');
    if (room.status !== 'waiting') fail('게임 중에는 바꿀 수 없어요.');
    let i = this.slotOf(room, userId); const p = room.slots[i];
    if (o.tankId !== undefined) { if (!TANK_IDS.includes(o.tankId) && o.tankId !== 'random') fail('없는 탱크예요.'); p.tankId = o.tankId; }
    if (o.items !== undefined) { if (Array.isArray(o.items) && o.items.some(id => !ITEM_SIZES[id])) fail('없는 아이템이에요.'); if (!validBag(o.items)) fail('가방은 4칸을 넘을 수 없어요.'); p.items = [...o.items]; }
    if (o.slot !== undefined) {
      const to = +o.slot; if (!(to >= 0 && to < MAX_PLAYERS)) fail('없는 자리예요.');
      if (room.slots[to]) fail('이미 누가 앉은 자리예요.');
      room.slots[to] = p; room.slots[i] = null; i = to;
    }
    if (o.tankId !== undefined || o.items !== undefined || o.slot !== undefined) p.ready = false;
    return room;
  }
  setReady(userId, ready) {
    const room = this.roomOf(userId); if (!room) fail('방에 있지 않아요.');
    if (room.status !== 'waiting') fail('게임 중이에요.');
    room.slots[this.slotOf(room, userId)].ready = !!ready; return room;
  }
  settings(userId, o = {}) {
    const room = this.roomOf(userId); if (!room) fail('방에 있지 않아요.');
    if (room.hostId !== userId) fail('방장만 바꿀 수 있어요.');
    if (room.status !== 'waiting') fail('게임 중에는 바꿀 수 없어요.');
    if (o.title !== undefined) room.title = clean(o.title, 24) || room.title;
    if (o.password !== undefined) room.password = clean(o.password, 16) || null;
    if (o.mapId !== undefined) { if (!MAP_IDS.includes(o.mapId) && o.mapId !== 'random') fail('없는 맵이에요.'); room.mapId = o.mapId; }
    if (o.turnSeconds !== undefined) { if (!TURN_SECONDS.includes(+o.turnSeconds)) fail('턴 시간은 10, 20, 30초 중에서 골라 주세요.'); room.turnSeconds = +o.turnSeconds; }
    if (o.mode !== undefined && o.mode !== room.mode) { if (!['team', 'solo'].includes(o.mode)) fail('없는 모드예요.'); room.mode = o.mode; }
    room.slots.forEach(s => s && s.userId !== room.hostId && !s.bot && (s.ready = false));
    return room;
  }
  kick(hostId, targetId) {
    const room = this.roomOf(hostId); if (!room) fail('방에 있지 않아요.');
    if (room.hostId !== hostId) fail('방장만 내보낼 수 있어요.');
    if (hostId === targetId) fail('자기 자신은 내보낼 수 없어요.');
    if (room.status !== 'waiting') fail('게임 중에는 내보낼 수 없어요.');
    const bi = room.slots.findIndex(s => s && s.bot && s.userId === targetId); if (bi >= 0) { room.slots[bi] = null; return room; }
    if (this.roomOf(targetId) !== room) fail('이 방에 없는 사람이에요.');
    this.leave(targetId); return room;
  }
  start(userId) {
    const room = this.roomOf(userId); if (!room) fail('방에 있지 않아요.');
    if (room.hostId !== userId) fail('방장만 시작할 수 있어요.');
    if (room.status !== 'waiting') fail('이미 게임 중이에요.');
    const ps = this.players(room);
    if (ps.length < 2) fail('2명 이상 있어야 시작할 수 있어요.');
    const notReady = ps.filter(p => p.userId !== room.hostId && !p.ready && !p.bot);
    if (notReady.length) fail(`아직 준비 안 한 사람이 있어요: ${notReady.map(p => p.nickname).join(', ')}`);
    if (room.mode === 'team' && (!ps.some(p => p.team === 'red') || !ps.some(p => p.team === 'blue'))) fail('양쪽 팀에 한 명 이상 있어야 해요.');
    room.status = 'playing';
    const mapId = room.mapId === 'random' ? MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)] : room.mapId;
    // 랜덤은 직접 고른 탱크와 앞서 뽑힌 탱크를 피해서 뽑는다 (다 같은 탱크가 걸리지 않게)
    const taken = ps.filter(p => p.tankId !== 'random').map(p => p.tankId);
    const players = ps.map(p => { let tankId = p.tankId; if (tankId === 'random') { tankId = pickRandomTank(Math.random, taken); taken.push(tankId); } return { userId: p.userId, nickname: p.nickname, slot: p.slot, team: p.team, items: p.items, bot: !!p.bot, tankId }; });
    return { room, setup: { roomId: room.id, mapId, mode: room.mode, turnSeconds: room.turnSeconds, players } };
  }
  finish(roomId) {
    const room = this.rooms.get(roomId); if (!room) return null;
    room.status = 'waiting'; room.slots.forEach(s => s && !s.bot && (s.ready = false)); return room;
  }
  summary(room) {
    const ps = this.players(room), host = ps.find(p => p.userId === room.hostId);
    return { id: room.id, title: room.title, locked: !!room.password, mode: room.mode, mapId: room.mapId, count: ps.length, max: MAX_PLAYERS, status: room.status, host: host?.nickname };
  }
  view(room) {
    return { id: room.id, title: room.title, hasPassword: !!room.password, hostId: room.hostId, mode: room.mode, mapId: room.mapId, turnSeconds: room.turnSeconds, status: room.status,
      slots: room.slots.map((s, i) => s && { ...s, team: this.teamOf(room, i) }) };
  }
  list() { return [...this.rooms.values()].sort((a, b) => a.id - b.id).map(r => this.summary(r)); }
}
