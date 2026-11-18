// 컴퓨터 플레이어: 가장 가까운 적을 골라 바람을 계산해 쏜다. 실수를 조금 섞어 사람처럼 만든다
import { SHELL_STATS } from '../../shared/gamedata.js';

export function botTurn(g, uid, rnd = Math.random) {
  const sim = g.sim, me = sim.tankOf(uid), p = g.player(uid);
  const foes = sim.tanks.filter(t => !t.dead && sim.enemies(me, t)).sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x));
  const foe = foes[0]; if (!foe) return g.onPass(uid);
  // 아이템: 체력이 낮으면 수리, 아니면 가끔 공격 아이템
  const pick = id => p.items.findIndex(i => !i.used && i.id === id);
  let k = -1;
  if (me.hp < me.max * .55) k = pick('repair') >= 0 ? pick('repair') : pick('teamrepair');
  if (k < 0 && rnd() < .3) k = p.items.findIndex(i => !i.used && ['power', 'double', 'shield'].includes(i.id) && !p.flags[i.id]);
  if (k >= 0) { try { g.onItem(uid, k); } catch {} }
  me.facing = Math.sign(foe.x - me.x) || me.facing;
  const slot = !p.ssUsed && me.hp <= me.max / 2 && rnd() < .6 ? 2 : rnd() < .7 ? 0 : 1, sh = SHELL_STATS[me.tankId][slot];
  if (sh.shape === 'line') { g.onAim(uid, Math.atan2(me.y - 20 - (foe.y - 18), Math.abs(foe.x - me.x)) * 180 / Math.PI); return g.onFire(uid, slot, 60); }
  const [lo, hi] = sim.angleRange(me);
  g.onAim(uid, Math.max(lo, Math.min(hi, 40 + rnd() * 12)));
  const pw = sim.solvePower(me, slot, foe.x, true) + (rnd() * 10 - 5);
  g.onFire(uid, slot, Math.max(10, Math.min(100, pw)));
}
