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
  const { g, sent, over } = run('hills', ['hammer', 'mole']);
  assert.equal(g.phase, 'over');
  assert.ok(over, 'onOver 호출');
  assert.ok(over.results.some(r => r.win), '이긴 사람이 있다');
  const turns = sent.filter(([e]) => e === 'game:turn');
  assert.ok(turns.length >= 2);
  assert.ok(sent.some(([e]) => e === 'game:shot'));
  assert.ok(sent.some(([e]) => e === 'game:sync'));
});

test('모든 맵·필살기에서 오류 없이 끝난다', () => {
  const maps = ['valley', 'mesa', 'ice', 'sky', 'factory', 'shroom', 'volcano', 'moon'];
  const tanks = [['laser', 'whale'], ['cloud', 'magnet'], ['bee', 'shroom'], ['mole', 'hammer']];
  maps.forEach((m, i) => { const { g } = run(m, tanks[i % tanks.length]); assert.equal(g.phase, 'over', m); });
});

test('4인 개인전', () => {
  const { g, over } = run('hills', ['hammer', 'mole', 'laser', 'bee'], 'solo');
  assert.equal(g.phase, 'over'); assert.ok(over.results.filter(r => r.win).length <= 1);
});

test('차례가 아닐 때 발사·아이템은 거절', () => {
  const sent = []; let clock = 0;
  const g = new GameSession({ roomId: 1, mapId: 'hills', mode: 'team', turnSeconds: 20, players: [1, 2].map(i => ({ userId: i, nickname: 'p' + i, team: i === 1 ? 'red' : 'blue', tankId: 'hammer', items: ['repair'] })) }, { send: (e, d) => sent.push([e, d]), now: () => clock * 1000 });
  while (g.phase !== 'aim') { clock += DT; g.tick(DT); }
  const other = g.players.find(p => p.uid !== g.cur.uid).uid;
  assert.throws(() => g.onFire(other, 0, 50), /차례/);
  assert.throws(() => g.onFire(g.cur.uid, 2, 50), /필살기/);
  g.onItem(g.cur.uid, 0); assert.throws(() => g.onItem(g.cur.uid, 0), /하나만|쓸 수 없는/);
});

test('시간이 다 되면 턴이 넘어간다', () => {
  const sent = []; let clock = 0;
  const g = new GameSession({ roomId: 1, mapId: 'hills', mode: 'team', turnSeconds: 10, players: [1, 2].map(i => ({ userId: i, nickname: 'p' + i, team: i === 1 ? 'red' : 'blue', tankId: 'hammer', items: [] })) }, { send: (e, d) => sent.push([e, d]), now: () => clock * 1000 });
  while (g.phase !== 'aim') { clock += DT; g.tick(DT); }
  const first = g.cur.uid; for (let i = 0; i < 60 * 11; i++) { clock += DT; g.tick(DT); }
  assert.notEqual(g.cur.uid, first); assert.ok(sent.some(([e]) => e === 'game:timeout'));
});
