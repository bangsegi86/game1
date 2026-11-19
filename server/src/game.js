// 한 방의 전투 진행: 턴 순서(딜레이), 타이머, 발사·아이템 검증, 서버 판정, 승패와 전적
import { Sim, spawnPositions, opsHash } from '../../shared/sim/world.js';
export { opsHash };
import { botTurn } from './bot.js';
import { SHELL_STATS, SLOT_DELAY, ITEM_INFO, TURN_BASE_DELAY, SUDDEN_DEATH_TURN } from '../../shared/gamedata.js';

const SUPPLY_CHANCE = .15, EVENT_GAP = 3;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export class GameSession {
  constructor(setup, { send, onOver, now = () => Date.now() }) {
    this.setup = setup; this.send = send; this.onOver = onOver; this.now = now;
    this.sim = new Sim({ map: setup.mapId });
    const players = shuffle([...setup.players]);
    const pos = spawnPositions(this.sim, players);
    this.players = players.map((p, i) => {
      const facing = p.team === 'blue' ? -1 : p.team === 'red' ? 1 : (pos[p.userId] < this.sim.w / 2 ? 1 : -1);
      const t = this.sim.addTank({ uid: p.userId, tankId: p.tankId, x: pos[p.userId], facing, team: p.team, name: p.nickname });
      t.delay = i; // 첫 턴 순서는 무작위
      return { uid: p.userId, nickname: p.nickname, team: p.team, tankId: p.tankId, x: t.x, facing, items: p.items.map(id => ({ id, used: false })), ssUsed: false, flags: {}, bot: !!p.bot };
    });
    this.turnNo = 0; this.cur = null; this.phase = 'starting'; this.moveDir = 0; this.lastPos = 0; this.dirty = false; this.wait = 1.5;
    this.sim.wind = Sim.nextWind({ ang: 180, str: 3 }, this.sim.map.windMax);
  }
  player(uid) { return this.players.find(p => p.uid === uid); }
  startInfo() {
    return { roomId: this.setup.roomId, mapId: this.setup.mapId, mode: this.setup.mode, turnSeconds: this.setup.turnSeconds,
      players: this.players.map(p => ({ uid: p.uid, nickname: p.nickname, team: p.team, tankId: p.tankId, x: p.x, facing: p.facing, items: p.items.map(i => i.id), bot: p.bot })) };
  }
  fullState(uid) {
    const me = this.player(uid);
    return { start: this.startInfo(), ops: this.sim.ops, snapshot: this.sim.snapshot(), turn: this.turnInfo(), bag: me ? me.items : [], ssUsed: me?.ssUsed, flags: me ? me.flags : {}, phase: this.phase };
  }
  turnInfo() { return this.cur ? { turnNo: this.turnNo, uid: this.cur.uid, left: Math.max(0, (this.deadline - this.now()) / 1000), seconds: this.setup.turnSeconds, order: this.order() } : null; }

  /* ---------- 진행 ---------- */
  tick(dt) {
    if (this.phase === 'over') return;
    const sim = this.sim;
    if (this.phase === 'aim' && this.cur?.bot) { this.botWait -= dt; if (this.botWait <= 0) { this.botWait = Infinity; try { botTurn(this, this.cur.uid); } catch (e) { try { this.onPass(this.cur.uid); } catch {} } } }
    if (this.phase === 'aim' && this.moveDir) { const t = sim.tankOf(this.cur.uid); const used = sim.move(t, this.moveDir, dt); if (used) { this.moveUsed += used; this.dirty = true; } }
    sim.step(dt); sim.fxq.length = 0;
    // 탱크가 보급 상자를 주우면 그 사람 가방에 아이템을 더한다 (이번 턴에 바로 써도 된다)
    for (const g of sim.picked) { const p = this.player(g.uid); if (!p) continue; let i = p.items.findIndex(x => x.used); if (i < 0) i = p.items.length; p.items[i] = { id: g.item, used: false }; this.send('game:pickup', { uid: g.uid, item: g.item, index: i }); } // 빈칸(쓴 칸)에 먼저 넣는다
    sim.picked.length = 0;
    if (this.phase === 'aim') {
      const t = sim.tankOf(this.cur.uid);
      if (t.dead) return this.endTurn();
      if (Math.abs(t.x - (this.sentX ?? t.x)) > .5 || Math.abs(t.y - (this.sentY ?? t.y)) > .5) this.dirty = true;
      if (this.dirty && this.now() - this.lastPos > 50) { this.sentX = t.x; this.sentY = t.y; this.lastPos = this.now(); this.dirty = false; this.send('game:pos', { uid: t.uid, x: t.x, y: t.y, facing: t.facing, fuel: t.fuel, angle: t.angle, tilt: t.tilt, moving: !!this.moveDir }); }
      if (this.now() > this.deadline) { this.send('game:timeout', { uid: t.uid }); t.delay += TURN_BASE_DELAY + this.turnState.itemDelay + Math.round(this.moveUsed); this.endTurn(); }
    } else if (this.phase === 'resolve') {
      if (!sim.busy()) { this.phase = 'between'; this.wait = .5; }
    } else if (this.phase === 'between' || this.phase === 'starting') {
      if (!sim.busy()) { this.wait -= dt; if (this.wait <= 0) { this.phase === 'starting' ? this.nextTurn() : this.endTurn(true); } }
    }
  }
  alive() { return this.sim.tanks.filter(t => !t.dead && !t.left); }
  overCheck() {
    const live = this.alive();
    if (this.setup.mode === 'team') { const teams = new Set(live.map(t => t.team)); if (teams.size <= 1) return { winnerTeam: [...teams][0] || null }; }
    else if (live.length <= 1) return { winnerTeam: live[0] ? 'uid:' + live[0].uid : null };
    return null;
  }
  endTurn(afterResolve) {
    this.moveDir = 0;
    const res = this.overCheck(); if (res) return this.finish(res);
    this.send('game:sync', { snapshot: this.sim.snapshot(), ops: this.sim.ops.length, hash: opsHash(this.sim.ops) });
    this.nextTurn();
  }
  nextTurn() {
    const sim = this.sim, live = this.alive().sort((a, b) => a.delay - b.delay || this.players.findIndex(p => p.uid === a.uid) - this.players.findIndex(p => p.uid === b.uid));
    if (!live.length) return this.finish({ winnerTeam: null });
    const t = live[0]; this.turnNo++; this.cur = this.player(t.uid);
    sim.turnStart(t);
    if (this.turnNo > 1) sim.wind = Sim.nextWind(sim.wind, sim.map.windMax);
    // 돌발 이벤트는 3턴째부터, 그리고 이벤트(보급 비행기 포함) 뒤 3턴은 쉬어 간다
    const rest = this.turnNo - (this.lastEventTurn ?? -9) >= EVENT_GAP;
    let event = null; if (this.turnNo > 2 && rest) { event = Sim.pickEvent(sim); if (event) sim.addEvent(event); }
    // 보급 비행기: 다른 돌발 이벤트가 없는 턴에 가끔 지나가며 아이템 상자를 떨어뜨린다 (맵에 상자는 최대 2개)
    if (!event && rest && this.turnNo > 1 && sim.crates.length < 2 && Math.random() < SUPPLY_CHANCE) { event = Sim.pickSupply(sim); sim.addEvent(event); }
    if (event) this.lastEventTurn = this.turnNo;
    const sd = this.turnNo > SUDDEN_DEATH_TURN; if (sd) sim.suddenDeath();
    sim.fxq.length = 0;
    this.turnState = { itemUsed: false, flags: {}, itemDelay: 0 }; this.moveUsed = 0; this.moveDir = 0;
    this.deadline = this.now() + this.setup.turnSeconds * 1000 + 500;
    this.phase = 'aim'; this.botWait = 1.4;
    this.send('game:turn', { turnNo: this.turnNo, uid: t.uid, seconds: this.setup.turnSeconds, wind: sim.wind, event, sd, snapshot: sim.snapshot(), order: this.order(), flags: this.cur.flags });
    if (t.dead) this.endTurn(); // 독·화상으로 턴 시작에 쓰러진 경우
  }
  order() { return this.alive().sort((a, b) => a.delay - b.delay).map(t => t.uid); }

  /* ---------- 입력 ---------- */
  isTurn(uid) { return this.phase === 'aim' && this.cur && this.cur.uid === uid; }
  onMove(uid, dir) { if (!this.isTurn(uid)) return; this.moveDir = [-1, 0, 1].includes(dir) ? dir : 0; if (!this.moveDir) this.dirty = true; }
  onAim(uid, angle) {
    if (!this.isTurn(uid)) return; const t = this.sim.tankOf(uid); if (typeof angle !== 'number' || !isFinite(angle)) return;
    t.angle = Math.round(angle); this.sim.clampAngle(t); this.dirty = true;
  }
  onItem(uid, index) {
    if (!this.isTurn(uid)) throw new Error('지금은 내 차례가 아니에요.');
    if (this.turnState.itemUsed) throw new Error('아이템은 턴마다 하나만 쓸 수 있어요.');
    const p = this.player(uid), it = p.items[index]; if (!it || it.used) throw new Error('쓸 수 없는 아이템이에요.');
    const fireItem = ['double', 'power', 'teleport'].includes(it.id);
    if (fireItem && p.flags[it.id]) throw new Error('이미 걸려 있는 효과예요. 다음 발사에 함께 나가요.');
    it.used = true; this.turnState.itemUsed = true; this.turnState.itemDelay = ITEM_INFO[it.id].delay;
    const t = this.sim.tankOf(uid);
    // 발사에 붙는 아이템(파워업·더블·순간이동)은 실제로 쏠 때까지 남는다. 턴을 넘겨도 다음 내 턴에 함께 나간다
    if (fireItem) p.flags[it.id] = true; else this.sim.useItem(t, it.id);
    this.sim.fxq.length = 0;
    this.send('game:item', { uid, index, id: it.id, flags: p.flags, snapshot: this.sim.snapshot() });
  }
  onFire(uid, slot, power) {
    if (!this.isTurn(uid)) throw new Error('지금은 내 차례가 아니에요.');
    const t = this.sim.tankOf(uid), p = this.player(uid);
    if (![0, 1, 2].includes(slot)) throw new Error('없는 포탄이에요.');
    if (slot === 2 && (p.ssUsed || t.hp > t.max / 2)) throw new Error('필살기는 체력 50% 이하에서 한 번만 쓸 수 있어요.');
    if (slot === 2) p.ssUsed = true;
    power = Math.max(1, Math.min(100, Number(power) || 0));
    // 필살기에는 순간이동을 붙이지 않는다 (필살기가 헛되이 사라지지 않게). 순간이동은 다음 발사까지 남는다
    const f = p.flags, keepTele = slot === 2 && !!f.teleport, opts = { boost: f.power ? 1.3 : 1, double: !!f.double, teleport: !!f.teleport && !keepTele }; p.flags = keepTele ? { teleport: true } : {};
    this.moveDir = 0;
    const snapshot = this.sim.snapshot();
    this.sim.fire(t, slot, power, opts);
    t.delay += TURN_BASE_DELAY + SLOT_DELAY[slot] + this.turnState.itemDelay + Math.round(this.moveUsed);
    this.phase = 'resolve';
    this.send('game:shot', { uid, slot, power, angle: t.angle, opts, snapshot, flags: p.flags });
  }
  onPass(uid) {
    if (!this.isTurn(uid)) throw new Error('지금은 내 차례가 아니에요.');
    const t = this.sim.tankOf(uid); t.delay += TURN_BASE_DELAY + this.turnState.itemDelay + Math.round(this.moveUsed);
    this.send('game:pass', { uid }); this.endTurn();
  }
  playerLeft(uid) {
    const t = this.sim.tankOf(uid); if (!t || t.left) return;
    t.left = true; this.sim.kill(t, null); this.sim.fxq.length = 0;
    this.send('game:left', { uid });
    if (this.phase === 'aim' && this.cur?.uid === uid) this.endTurn();
    else { const res = this.overCheck(); if (res && this.phase !== 'over') this.finish(res); }
  }
  finish({ winnerTeam }) {
    if (this.phase === 'over') return; this.phase = 'over';
    const results = this.players.map(p => {
      const t = this.sim.tankOf(p.uid);
      const win = winnerTeam != null && (winnerTeam === p.team || winnerTeam === 'uid:' + p.uid);
      return { uid: p.uid, nickname: p.nickname, team: p.team, tankId: p.tankId, kills: t.kills, dealt: t.dealt, alive: !t.dead, sunk: t.sunk, left: t.left, win };
    });
    this.send('game:over', { winnerTeam, turns: this.turnNo, results, snapshot: this.sim.snapshot() });
    this.onOver?.({ winnerTeam, results, mapId: this.setup.mapId, mode: this.setup.mode });
  }
}
