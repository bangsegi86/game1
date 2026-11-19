import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../src/game.js';
import { DT } from '../../shared/sim/world.js';

function run(mapId, tanks, mode = 'team') {
  const sent = []; let clock = 0;
  const players = tanks.map((tankId, i) => ({ userId: i + 1, nickname: 'p' + (i + 1), team: mode === 'team' ? (i % 2 ? 'blue' : 'red') : 'solo', tankId, items: ['double', 'power', 'repair', 'shield'] }));
  let over = null;
  const g = new GameSession({ roomId: 1, mapId, mode, turnSeconds: 20, players }, { send: (ev, d) => sent.push([ev, d]), onOver: r => over = r, now: () => clock * 1000 });
  const tick = n => { for (let i = 0; i < n; i++) { clock += DT; g.tick(DT); } };
  let guard = 0;
  while (g.phase !== 'over' && guard++ < 200000) {
    tick(1);
    if (g.phase === 'aim') {
      const me = g.sim.tankOf(g.cur.uid), foe = g.sim.tanks.filter(t => !t.dead && t.team !== me.team || (mode === 'solo' && t !== me && !t.dead))[0];
      if (!foe) { tick(1); continue; }
      me.facing = Math.sign(foe.x - me.x) || 1; me.angle = Math.max(me.S.amin, Math.min(me.S.amax, 45));
      { const k = g.player(me.uid).items.findIndex(i => !i.used); if (k >= 0 && g.turnNo % 3 === 1) g.onItem(me.uid, k); }
      const slot = me.hp <= me.max / 2 && !g.player(me.uid).ssUsed ? 2 : 0;
      g.onFire(me.uid, slot, me.angle && slot !== 1 ? g.sim.solvePower(me, slot, foe.x, true) : 60);
    }
  }
  return { g, sent, over };
}

test('2인 팀전이 끝까지 진행되고 승패가 난다', () => {
  const { g, sent, over } = run('valley', ['hammer', 'mole']);
  assert.equal(g.phase, 'over');
  assert.ok(over, 'onOver 호출');
  assert.ok(over.results.some(r => r.win), '이긴 사람이 있다');
  const turns = sent.filter(([e]) => e === 'game:turn');
  assert.ok(turns.length >= 2);
  assert.ok(sent.some(([e]) => e === 'game:shot'));
  assert.ok(sent.some(([e]) => e === 'game:sync'));
});

test('모든 맵·필살기에서 오류 없이 끝난다', () => {
  const maps = ['demo', 'valley', 'temple', 'sky', 'bridge', 'cave'];
  const tanks = [['laser', 'whale'], ['cloud', 'magnet'], ['bee', 'shroom'], ['mole', 'hammer']];
  maps.forEach((m, i) => { const { g } = run(m, tanks[i % tanks.length]); assert.equal(g.phase, 'over', m); });
});

test('4인 개인전', () => {
  const { g, over } = run('valley', ['hammer', 'mole', 'laser', 'bee'], 'solo');
  assert.equal(g.phase, 'over'); assert.ok(over.results.filter(r => r.win).length <= 1);
});

test('차례가 아닐 때 발사·아이템은 거절', () => {
  const sent = []; let clock = 0;
  const g = new GameSession({ roomId: 1, mapId: 'temple', mode: 'team', turnSeconds: 20, players: [1, 2].map(i => ({ userId: i, nickname: 'p' + i, team: i === 1 ? 'red' : 'blue', tankId: 'hammer', items: ['repair'] })) }, { send: (e, d) => sent.push([e, d]), now: () => clock * 1000 });
  while (g.phase !== 'aim') { clock += DT; g.tick(DT); }
  const other = g.players.find(p => p.uid !== g.cur.uid).uid;
  assert.throws(() => g.onFire(other, 0, 50), /차례/);
  assert.throws(() => g.onFire(g.cur.uid, 2, 50), /필살기/);
  g.onItem(g.cur.uid, 0); assert.throws(() => g.onItem(g.cur.uid, 0), /하나만|쓸 수 없는/);
});

test('시간이 다 되면 턴이 넘어간다', () => {
  const sent = []; let clock = 0;
  const g = new GameSession({ roomId: 1, mapId: 'temple', mode: 'team', turnSeconds: 10, players: [1, 2].map(i => ({ userId: i, nickname: 'p' + i, team: i === 1 ? 'red' : 'blue', tankId: 'hammer', items: [] })) }, { send: (e, d) => sent.push([e, d]), now: () => clock * 1000 });
  while (g.phase !== 'aim') { clock += DT; g.tick(DT); }
  const first = g.cur.uid; for (let i = 0; i < 60 * 11; i++) { clock += DT; g.tick(DT); }
  assert.notEqual(g.cur.uid, first); assert.ok(sent.some(([e]) => e === 'game:timeout'));
});

test('파워업은 쏘기 전까지 남고, 다음 턴 더블과 함께 나간다', () => {
  const sent = []; let clock = 0;
  const g = new GameSession({ roomId: 1, mapId: 'demo', mode: 'team', turnSeconds: 20, players: [1, 2].map(i => ({ userId: i, nickname: 'p' + i, team: i === 1 ? 'red' : 'blue', tankId: 'hammer', items: ['power', 'double'] })) }, { send: (e, d) => sent.push([e, d]), now: () => clock * 1000 });
  const until = f => { let n = 0; while (!f() && n++ < 60 * 60) { clock += 1 / 60; g.tick(1 / 60); } };
  until(() => g.phase === 'aim');
  const a = g.cur.uid; g.onItem(a, 0); g.onPass(a);
  until(() => g.phase === 'aim'); const b = g.cur.uid; assert.notEqual(a, b); g.onPass(b);
  until(() => g.phase === 'aim' && g.cur.uid === a);
  assert.ok(g.player(a).flags.power, '파워업이 다음 턴까지 남아 있다');
  g.onItem(a, 1);
  const me = g.sim.tankOf(a); me.angle = 45; g.onFire(a, 0, 60);
  const shot = sent.filter(([e]) => e === 'game:shot').at(-1)[1];
  assert.equal(shot.opts.boost, 1.3); assert.equal(shot.opts.double, true);
  assert.deepEqual(g.player(a).flags, {}, '쏘면 효과가 사라진다');
});

test('컴퓨터끼리 끝까지 싸운다', () => {
  let clock = 0, over = null;
  const g = new GameSession({ roomId: 1, mapId: 'valley', mode: 'team', turnSeconds: 20, players: [-1, -2, -3].map((id, i) => ({ userId: id, nickname: 'bot' + i, team: i % 2 ? 'blue' : 'red', tankId: ['hammer', 'laser', 'bee'][i], items: ['repair', 'power', 'double', 'shield'], bot: true })) }, { send: () => {}, onOver: r => over = r, now: () => clock * 1000 });
  for (let i = 0; i < 60 * 60 * 30 && g.phase !== 'over'; i++) { clock += 1 / 60; g.tick(1 / 60); }
  assert.equal(g.phase, 'over'); assert.ok(over.results.some(r => r.win));
});

// 모든 탄 × 발사 아이템(강화·더블·순간이동) 점검
import { Sim } from '../../shared/sim/world.js';
import { SHELL_STATS, TANK_STATS } from '../../shared/gamedata.js';
function shot(tankId, slot, opts, map = 'demo') {
  const sim = new Sim({ map }); const a = sim.addTank({ uid: 1, tankId, x: 300, team: 'red' }), b = sim.addTank({ uid: 2, tankId: 'hammer', x: 720, team: 'blue', facing: -1 });
  for (let i = 0; i < 30; i++) sim.step(DT); sim.wind = { ang: 0, str: 0 };
  const sh = SHELL_STATS[tankId][slot], S = TANK_STATS[tankId];
  a.angle = sh.shape === 'line' ? Math.max(S.amin, 2) : Math.min(Math.max(45, S.amin), S.amax); sim.clampAngle(a);
  const x0 = a.x, ops0 = sim.ops.length; sim.fire(a, slot, sh.shape === 'line' ? 60 : sim.solvePower(a, slot, b.x, true), opts);
  for (let i = 0; i < 1500 && (sim.busy() || i < 30); i++) sim.step(DT);
  return { dmg: b.max - b.hp, moved: a.x - x0, ops: sim.ops.length - ops0 };
}
test('모든 탄에 강화·더블·순간이동이 적용된다', () => {
  for (const t of Object.keys(SHELL_STATS)) for (const slot of [0, 1, 2]) {
    const name = `${t}/${slot}`, base = shot(t, slot, {});
    assert.ok(shot(t, slot, { boost: 1.3 }).dmg > base.dmg, name + ' 강화');
    assert.ok(shot(t, slot, { double: true }).dmg > base.dmg, name + ' 더블');
    const tp = shot(t, slot, { teleport: true });
    assert.ok(Math.abs(tp.moved) > 60 && tp.dmg === 0 && tp.ops === 0, name + ' 순간이동(이동만)');
  }
});
test('관통 레이저 순간이동은 탱크를 못 맞혀도 처음 닿은 땅으로 옮긴다', () => {
  const sim = new Sim({ map: 'valley' }); const a = sim.addTank({ uid: 1, tankId: 'laser', x: 700, team: 'red', facing: 1 });
  sim.addTank({ uid: 2, tankId: 'hammer', x: 120, team: 'blue' }); for (let i = 0; i < 30; i++) sim.step(DT);
  a.angle = 0; a.facing = 1; sim.clampAngle(a); const x0 = a.x; sim.fire(a, 1, 60, { teleport: true });
  for (let i = 0; i < 600 && (sim.busy() || i < 30); i++) sim.step(DT);
  assert.ok(a.x - x0 > 40, '오르막 땅에 닿은 곳으로 이동해야 한다: ' + (a.x - x0));
});
test('필살기는 순간이동을 쓰지 않고 다음 발사까지 남긴다', () => {
  let clock = 0; const g = new GameSession({ roomId: 1, mapId: 'demo', mode: 'team', turnSeconds: 20, players: [1, 2].map(i => ({ userId: i, nickname: 'p' + i, team: i === 1 ? 'red' : 'blue', tankId: 'hammer', items: ['teleport'] })) }, { send: () => {}, now: () => clock * 1000 });
  for (let i = 0; i < 400 && g.phase !== 'aim'; i++) { clock += DT; g.tick(DT); }
  const uid = g.cur.uid, t = g.sim.tankOf(uid); t.hp = 100;
  g.onItem(uid, 0); g.onFire(uid, 2, 70);
  assert.equal(g.player(uid).flags.teleport, true);
});
test('강화탄은 쓴 턴 포함 내 턴 2번까지만 유지된다', () => {
  let clock = 0; const g = new GameSession({ roomId: 1, mapId: 'demo', mode: 'team', turnSeconds: 10, players: [1, 2].map(i => ({ userId: i, nickname: 'p' + i, team: i === 1 ? 'red' : 'blue', tankId: 'hammer', items: ['power'] })) }, { send: () => {}, now: () => clock * 1000 });
  const until = (f, n = 5000) => { for (let i = 0; i < n && !f(); i++) { clock += DT; g.tick(DT); } };
  until(() => g.phase === 'aim'); const uid = g.cur.uid; g.onItem(uid, 0);
  assert.equal(g.player(uid).flags.power, 2);
  g.onPass(uid); until(() => g.phase === 'aim' && g.cur.uid !== uid); g.onPass(g.cur.uid);
  until(() => g.phase === 'aim' && g.cur.uid === uid); assert.equal(g.player(uid).flags.power, 1, '두 번째 내 턴: 아직 유지');
  g.onPass(uid); until(() => g.phase === 'aim' && g.cur.uid !== uid); g.onPass(g.cur.uid);
  until(() => g.phase === 'aim' && g.cur.uid === uid); assert.equal(g.player(uid).flags.power, undefined, '세 번째 내 턴: 사라짐');
  assert.equal(g.sim.tankOf(uid).powerUp, false);
});
test('얼음 줄다리: 줄 아래를 지나는 포탄도 회오리에 잡혀 올라가다 줄 밑면을 부순다', () => {
  const sim = new Sim({ map: 'bungee' }); const a = sim.addTank({ uid: 1, tankId: 'hammer', x: 200, team: 'red' }); sim.addTank({ uid: 2, tankId: 'mole', x: 1300, team: 'blue' });
  for (let i = 0; i < 30; i++) sim.step(DT);
  const ex = 700, e = sim.addEvent({ type: 'tornado', x: ex }); for (let i = 0; i < 60; i++) sim.step(DT);
  assert.ok(e.gy > sim.ground(ex, 0) + 40, '회오리 바닥이 얼음 줄보다 아래(물가)까지 내려와야 한다');
  const ropeTop = sim.ground(ex, 0); let below = ropeTop; while (sim.solid(ex, below)) below++;
  // 줄 아래 빈 곳에서 회오리 쪽으로 옆으로 날아가는 포탄
  sim.shells.push({ x: ex - 60, y: below + 40, sx: ex - 60, sy: below + 40, vx: 300, vy: 0, sh: { ...sim.tanks[0].S && { dmg: 100, r: 30, cr: 30, wind: 0, wt: 0, R: 20 } }, tankId: 'hammer', slot: 0, owner: a, age: 1, trail: [], mode: 'fly', dug: 0, dist: 0, lastCarve: null, k: 1 });
  const ops0 = sim.ops.length; for (let i = 0; i < 300 && sim.shells.length; i++) sim.step(DT);
  assert.ok(sim.ops.length > ops0, '줄 밑면이 파여야 한다');
});
