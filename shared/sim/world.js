// 전투 시뮬레이션 본체 (그림 없음). 서버가 판정하고, 화면도 같은 코드로 같은 결과를 재생한다.
// 화면에 보여줄 일(폭발, 숫자, 땅 파기 등)은 this.fxq에 쌓고 화면이 꺼내 쓴다.
import { MAPS, MK } from './maps.js';
import { MaskCtx, fillPolys, raggedPoly, hash } from './raster.js';
import { TANK_STATS, SHELL_STATS, ITEM_INFO } from '../gamedata.js';

// 맵은 화면(960×480)보다 넓은 1440×600. 화면은 카메라로 일부만 보여 준다
export const G0 = 380, SPEED = 6.6, WINDK = 5, DT = 1 / 60, WORLD_W = 1440, WORLD_H = 600;
const STEEL = MK.steel, LEAF = MK.leaf, WOOD = MK.wood, PLANK = MK.plank;
const CLIMB = 24; // 구덩이 가장자리까지 이만큼(px) 이하로 깊으면 가파른 벽도 기어 나온다
// 보급 비행기: 속도(px/초), 나는 높이, 떨어뜨리는 아이템
export const PLANE_SPEED = 420, PLANE_Y = 70;
const EVENT_RATE = .2; // 맵별 이벤트 확률에 곱하는 값 (작을수록 드물다)
const SUPPLY_ITEMS = ['repair', 'power', 'double', 'teleport', 'shield', 'fuel', 'calm', 'repair', 'power'];
const BASE = new Map();
export function baseGrid(mapId, w, h) {
  const key = `${mapId}:${w}x${h}`;
  if (!BASE.has(key)) { const g = new Uint8Array(w * h); MAPS[mapId].terrain(new MaskCtx(g, w, h), w, h); BASE.set(key, g); }
  return BASE.get(key).slice();
}
export const opsHash = ops => { let h = 0; const s = JSON.stringify(ops); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
export function backGrid(mapId, w, h) { const m = MAPS[mapId]; if (!m.backTerrain) return null; const g = new Uint8Array(w * h); m.backTerrain(new MaskCtx(g, w, h), w, h); return g; }
const ease = u => u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u);
const r1 = v => Math.round(v * 10) / 10;

export const EVENT_INFO = {
  supply: { n: '보급 비행기', turns: 0 }, tornado: { n: '회오리', turns: 2 }, pillar: { n: '불기둥', turns: 2 }, meteors: { n: '운석 소나기', turns: 0 }, lightning: { n: '벼락', turns: 0 },
};

export class Sim {
  constructor({ w = WORLD_W, h = WORLD_H, map = 'hills', tankScale = .5 } = {}) { this.w = w; this.h = h; this.ts = tankScale; this.reset(map); }
  get map() { return MAPS[this.mapId]; }
  reset(mapId) {
    if (mapId) this.mapId = mapId;
    this.grid = baseGrid(this.mapId, this.w, this.h); this.ops = [];
    this.g = G0 * this.map.grav; this.liquidY = this.map.liquid ? this.map.liquid.y * this.h : this.h + 30;
    this.tanks = []; this.shells = []; this.specials = []; this.events = []; this.zones = []; this.pending = [];
    this.crates = []; this.crateId = 0; this.picked = []; // 보급 상자와, 이번에 주운 것(서버가 가방에 넣는다)
    this.clock = 0; this.wind = { ang: 0, str: 0 }; this.fxq = []; this.teleported = false;
  }
  fx(type, d = {}) { this.fxq.push({ type, ...d }); }

  /* ---------- 지형 ---------- */
  solid(x, y) { x |= 0; y |= 0; return x >= 0 && x < this.w && y >= 0 && y < this.h && this.grid[y * this.w + x] !== 0; }
  // 탱크가 설 수 있는 땅: 나무(잎·줄기)는 포탄은 막지만 탱크는 그 앞을 지나간다
  stand(x, y) { x |= 0; y |= 0; if (x < 0 || x >= this.w || y < 0 || y >= this.h) return false; const m = this.grid[y * this.w + x]; return m !== 0 && m !== LEAF && m !== WOOD; }
  // 다리(널판)는 위에서만 밟힌다: feet(탱크 발 높이)를 주면, 발보다 위에 있는 널판 윗면과 널판 속은 무시한다.
  // 그래서 다리가 끊어져 협곡에 떨어진 탱크가 다리 밑 비탈을 올라 빠져나올 때 널판에 막히지 않는다
  // 탱크 발 높이(feet)에서 위아래로 가장 가까운 밟을 곳. 발밑부터 이어진 벽이 up보다 높으면 null(못 오름).
  // 머리 위 천장(터널·다리 밑)은 무시한다
  standF(x, y, feet) { if (!this.stand(x, y)) return false; if (this.grid[(y | 0) * this.w + (x | 0)] !== PLANK) return true; return !(y < feet - 4 || (y > 0 && this.grid[((y | 0) - 1) * this.w + (x | 0)] === PLANK)); }
  // skip=true면 너무 높은 벽 쪽 바퀴는 빼고 나머지로 선다 (가만히 있을 때 벽을 타고 오르지 않게)
  reach(x, feet, up, skip = false) {
    let best = Infinity; feet = Math.round(feet);
    for (const xx of [x, x - 7, x + 7]) {
      let y = feet - 1;
      if (this.standF(xx, y, feet)) { while (y > feet - 1 - up && this.standF(xx, y - 1, feet)) y--; if (y <= feet - 1 - up) { if (skip) continue; return null; } }
      else { while (y < this.h && !this.standF(xx, y, feet)) y++; }
      best = Math.min(best, y);
    }
    if (best === Infinity) return feet;
    return best >= this.h ? this.h + 200 : best;
  }
  ground(x, from = 0, feet = null) {
    const mat = (xx, yy) => { xx |= 0; return xx < 0 || xx >= this.w || yy < 0 || yy >= this.h ? 0 : this.grid[yy * this.w + xx]; };
    for (let y = Math.max(0, from | 0); y < this.h; y++) {
      const hits = [x, x - 7, x + 7].filter(xx => this.stand(xx, y)); if (!hits.length) continue;
      if (feet != null && hits.every(xx => mat(xx, y) === PLANK && (y < feet - 4 || mat(xx, y - 1) === PLANK))) continue;
      return y;
    }
    return this.h + 200;
  }
  applyOp(op) {
    const poly = op.k === 'rect' ? [[op.x, op.y], [op.x + op.w, op.y], [op.x + op.w, op.y + op.h], [op.x, op.y + op.h], [op.x, op.y]] : raggedPoly(op.x, op.y, op.r, op.ry);
    fillPolys(this.grid, this.w, this.h, [poly], 0, STEEL);
  }
  carve(op) { this.applyOp(op); this.ops.push(op); this.fx('carve', { op }); }
  carveRound(x, y, r, ry, scorch = true) { this.carve({ k: 'round', x: r1(x), y: r1(y), r: r1(r), ry: r1(ry || r), s: scorch ? 1 : 0 }); }
  carveRect(x, y, w, h) { this.carve({ k: 'rect', x: r1(x), y: r1(y), w: r1(w), h: r1(h), s: 1 }); }

  /* ---------- 바람 (ang 0 = 오른쪽, 90 = 위) ---------- */
  windVec() { const a = this.wind.ang * Math.PI / 180, s = this.wind.str * WINDK; return [Math.cos(a) * s, -Math.sin(a) * s]; }
  static nextWind(prev, max, rnd = Math.random) {
    if (!max) return { ang: 0, str: 0 };
    let w = { ...prev };
    // 세기는 1~max(보통 20) 정수. 한 칸의 힘(WINDK)은 예전 10단계 때보다 작다
    if (rnd() < .18) w = { ang: rnd() * 360, str: 1 + rnd() * (max - 1) };
    else { w.ang = (w.ang + (rnd() - .5) * 80 + 360) % 360; w.str = Math.max(1, Math.min(max, w.str + (rnd() - .5) * 8)); }
    return { ang: Math.round(w.ang), str: Math.round(w.str) };
  }

  /* ---------- 탱크 ---------- */
  addTank({ uid, tankId, x, facing = 1, team = 'solo', name = '' }) {
    const S = TANK_STATS[tankId];
    const t = { uid, tankId, S, name, team, x, y: 0, hp: S.hp, max: S.hp, angle: Math.min(Math.max(45, S.amin), S.amax), facing, fuel: 100, vx: 0, vy: 0, air: false, fallFrom: 0,
      firedAt: -9, hitAt: -9, moving: false, shield: false, frozen: 0, canMove: true, dead: false, sunk: false, left: false, kills: 0, dealt: 0, lastHitBy: null, delay: 0, tilt: 0 };
    t.y = this.ground(x, 0); t.fallFrom = t.y; t.tilt = this.slope(t); this.clampAngle(t); this.tanks.push(t); return t;
  }
  tankOf(uid) { return this.tanks.find(t => t.uid === uid); }
  // 기울기(도): 탱크 앞쪽이 내려가면 +. 각도 범위는 몸체를 따라 돌아가므로 내리막에선 아래로도 쏠 수 있다
  slope(t) {
    const f = t.facing || 1, gF = this.ground(t.x + f * 12, t.y - 24, t.y), gB = this.ground(t.x - f * 12, t.y - 24, t.y);
    if (gF > this.h || gB > this.h) return t.tilt || 0;
    return Math.round(Math.max(-35, Math.min(35, Math.atan2(gF - gB, 24) * 180 / Math.PI)));
  }
  angleRange(t) { return [t.S.amin - t.tilt, t.S.amax - t.tilt]; }
  clampAngle(t) { const [lo, hi] = this.angleRange(t); t.angle = Math.round(Math.max(lo, Math.min(hi, t.angle))); }
  enemies(a, b) { return a && b && a !== b && (a.team === 'solo' || a.team !== b.team); }
  kill(t, by) {
    if (t.dead) return; t.dead = true; t.hp = 0;
    const killer = by ?? this.tankOf(t.lastHitBy);
    if (killer && this.enemies(killer, t)) killer.kills++;
    this.fx('death', { uid: t.uid });
  }
  damage(t, dmg, from, label) {
    if (t.dead) return 0; dmg = Math.round(t.shield ? dmg / 2 : dmg); if (dmg <= 0) return 0;
    t.hp = Math.max(0, t.hp - dmg); t.hitAt = this.clock;
    if (from && from !== t) { t.lastHitBy = from.uid; if (this.enemies(from, t)) from.dealt += dmg; }
    this.fx('float', { x: t.x, y: t.y - 60, text: (label || '') + '-' + dmg, color: '#c92a2a' });
    if (t.hp <= 0) this.kill(t, from && from !== t ? from : null);
    return dmg;
  }
  hurtArea(x, y, R, dmg, from, o = {}) {
    for (const t of this.tanks) {
      if (t.dead) continue;
      let d = Math.hypot(t.x - x, t.y - 18 - y);
      if (o.columnW) d = Math.abs(t.x - x) < o.columnW ? Math.abs(t.x - x) : 1e9;
      if (o.tall && Math.abs(t.x - x) < R && t.y > y - 20 && t.y < y + o.tall + 30) d = Math.abs(t.x - x);
      const RR = R + 12; if (d < RR) this.damage(t, dmg * (1 - .6 * Math.min(1, d / RR)), from);
    }
  }
  float(x, y, text, color) { this.fx('float', { x, y, text, color }); }
  boom(x, y, o) { this.fx('boom', { x, y, ...o }); }
  muzzle(t) {
    const a = t.angle * Math.PI / 180, sc = this.ts, lift = t.S.hover ? -12 * sc : 0, r = (t.tilt || 0) * Math.PI / 180;
    const [qx, qy] = t.S.pivot, lx = qx * Math.cos(r) - qy * Math.sin(r), ly = qx * Math.sin(r) + qy * Math.cos(r);
    const px = t.x + lx * sc * t.facing, py = t.y + ly * sc + lift, L = t.S.len * sc + 4;
    return [px + Math.cos(a) * L * t.facing, py - Math.sin(a) * L];
  }
  pivotPos(t) { const sc = this.ts, r = (t.tilt || 0) * Math.PI / 180, [qx, qy] = t.S.pivot; return [t.x + (qx * Math.cos(r) - qy * Math.sin(r)) * sc * t.facing, t.y + (qx * Math.sin(r) + qy * Math.cos(r)) * sc + (t.S.hover ? -12 * sc : 0)]; }
  move(t, dir, dt) {
    t.facing = dir; if (t.fuel <= 0 || !t.canMove || t.air || t.dead) return 0;
    const nx = t.x + dir * 50 * dt; if (nx < 12 || nx > this.w - 12) return 0;
    // 오를 수 있는지는 경사가 아니라 벽 높이로 정한다: 얕은 구덩이(보통 포탄 한 발)는 기어 나오고,
    // 탱크 키보다 깊은 구덩이(큰 포탄, 같은 자리 여러 발)는 빠져나오지 못하는 함정이 된다
    const ny = this.reach(nx, t.y, 60); if (ny == null) return 0;
    // 앞 40px 안의 가장 높은 땅(구덩이 가장자리)까지 높이. 그게 CLIMB 이하면 가파른 벽도 기어오르고,
    // 그보다 깊으면 55°보다 가파른 벽(앞 6px에서 8.5px 넘게 높아짐)에 막힌다
    let rim = t.y; for (let k = 2; k <= 40; k += 2) { const g = this.reach(t.x + dir * k, t.y, 200, true); if (g < rim) rim = g; }
    if (t.y - rim > CLIMB) { if (ny < t.y - 12) return 0; const ahead = this.reach(t.x + dir * 6, t.y, 60); if (ahead == null || t.y - ahead > 8.5) return 0; }
    t.moving = true; t.x = nx;
    if (ny <= t.y + 2) { t.y = ny; t.fallFrom = ny; }
    if (this.map.slip) { t.slideV = dir * 55; t.lastMove = this.clock; }
    const used = 22 * dt * (ny < t.y ? 1.5 : 1); t.fuel = Math.max(0, t.fuel - used); return used;
  }

  /* ---------- 발사 ---------- */
  fire(t, slot, p, o = {}) {
    const sh = SHELL_STATS[t.tankId][slot]; t.firedAt = this.clock;
    this.teleported = false;
    // 다발 포탄: 각도와 파워를 조금씩 달리해 멀리 쏠수록 넓게 퍼지고, 가까이 쏘면 거의 한 곳에 맞는다
    const spawn = () => (sh.spread || [0]).forEach((da, i) => {
      const pk = sh.pspread ? sh.pspread[i] : 1;
      const a = (t.angle + da) * Math.PI / 180, v = sh.shape === 'line' ? 900 : p * pk * SPEED, [ox, oy] = this.muzzle(t);
      this.shells.push({ x: ox, y: oy, sx: ox, sy: oy, vx: Math.cos(a) * t.facing * v, vy: -Math.sin(a) * v, sh, tankId: t.tankId, slot, owner: t, age: 0, trail: [], mode: 'fly', dug: 0, dist: 0, lastCarve: null, k: o.boost || 1, teleport: !!o.teleport });
    });
    spawn();
    // 더블: 첫 발이 맞고 폭발·필살기·탱크 낙하까지 다 끝난 뒤에 두 번째가 나간다 (지금 탱크 자리에서)
    if (o.double) this.queued = { wait: .4, fn: () => { if (t.dead) return; t.firedAt = this.clock; spawn(); this.fx('fire', { uid: t.uid, second: true }); } };
    this.fx('fire', { uid: t.uid });
  }
  // 유도 미사일: 가장 가까운 적 쪽으로 초당 최대 2.6라디안까지 방향을 틀고, 너무 느려지지 않게 한다
  steerMissile(s, h) {
    let best = null, bd = 1e9; for (const t of this.tanks) { if (t.dead || !this.enemies(s.owner, t)) continue; const d = Math.hypot(t.x - s.x, t.y - 20 - s.y); if (d < bd) { bd = d; best = t; } }
    if (!best) return;
    const v = Math.max(280, Math.hypot(s.vx, s.vy)), cur = Math.atan2(s.vy, s.vx), want = Math.atan2(best.y - 20 - s.y, best.x - s.x);
    let dA = want - cur; while (dA > Math.PI) dA -= 2 * Math.PI; while (dA < -Math.PI) dA += 2 * Math.PI;
    const a = cur + Math.max(-2.6 * h, Math.min(2.6 * h, dA)); s.vx = Math.cos(a) * v; s.vy = Math.sin(a) * v;
  }
  hitTank(s) { return this.tanks.find(t => !t.dead && (t !== s.owner || s.age > .25) && Math.hypot(t.x - s.x, t.y - 36 * this.ts - s.y) < 40 * this.ts); }
  impact(s, x, y, hitTank) {
    s.done = true; const sh = s.sh, k = s.k, owner = s.owner;
    const base = { tankId: s.tankId, slot: s.slot, R: sh.R * k };
    if (sh.sp && sh.sp !== 'phoenix' && sh.sp !== 'erupt') {
      let gy = hitTank ? hitTank.y : this.ground(x, Math.max(0, y - 40)); if (gy > this.h) gy = y;
      const sp = { type: sh.sp, x, y, gy, t: 0, sh, k, base, owner, side: s.vx >= 0 ? 1 : -1, dir: (owner && owner.facing) || 1, hit: new Set(), done: [], flash: [], wx: x, fired: false };
      if (sh.sp === 'tornado') sp.dir = Math.sign(this.windVec()[0]) || sp.dir;
      this.specials.push(sp); this.afterHit(s, x, y); return;
    }
    if (sh.sp === 'erupt') { this.specials.push({ type: 'erupt', x, y, t: 0, sh, k, base, owner }); this.afterHit(s, x, y); return; }
    if (sh.shape === 'ellipse') this.carveRound(x, y, sh.cr[0] * k, sh.cr[1] * k); else this.carveRound(x, y, sh.cr * k);
    this.boom(x, y, { ...base, debris: Math.round(8 + (Array.isArray(sh.cr) ? sh.cr[0] : sh.cr) * .3), shake: Math.min(.6, sh.r / 90) });
    for (const t of this.tanks) {
      if (t.dead) continue; const R = sh.r * k + 12, d = Math.hypot(t.x - x, t.y - 18 - y); if (d >= R) continue;
      this.damage(t, sh.dmg * k * (1 - .6 * Math.min(1, d / R)), owner);
      if (sh.fx === 'freeze' && !t.dead) { t.frozen = 1; this.float(t.x, t.y - 90, '빙결!', '#1f6fae'); }
      if (sh.fx === 'push') { t.vx = (Math.sign(t.x - x) || 1) * 200; t.vy = -220; t.air = true; }
    }
    if (sh.fx === 'burn') this.zones.push({ type: 'burn', x: r1(x), r: 40, turns: 2, dmg: 60, born: this.clock, from: owner?.uid });
    if (sh.sp === 'phoenix') { this.zones.push({ type: 'burn', x: r1(x), r: 50, turns: 2, dmg: 60, born: this.clock, from: owner?.uid }); this.specials.push({ type: 'phoenix', x, gy: this.ground(x, Math.max(0, y - 40)), t: 0 }); }
    this.afterHit(s, x, y);
  }
  afterHit(s, x, y) {
    if (s.teleport && s.owner && !s.owner.dead && !this.teleported) { this.teleported = true; const t = s.owner; t.x = Math.max(14, Math.min(this.w - 14, x)); t.y = this.ground(t.x, Math.max(0, y - 80)); t.fallFrom = t.y; t.vy = 0; this.float(t.x, t.y - 80, '순간이동!', '#7b2fbf'); }
  }

  /* ---------- 필살기 진행 (그림은 화면 쪽) ---------- */
  stepSpecial(s, dt) {
    const W = this;
    switch (s.type) {
      case 'ufo':
        if (s.t >= 1.45 && !s.fired) { s.fired = true; const r = s.sh.cr * s.k / 2; W.carveRect(s.x - r, 0, r * 2, s.gy + 70); W.hurtArea(s.x, s.gy - 20, s.sh.r * s.k, s.sh.dmg * s.k, s.owner, { columnW: r + 14 }); W.boom(s.x, s.gy, { ...s.base, shake: .7 }); }
        return s.t < 2.7;
      case 'meteor':
        if (s.t >= 1.15 && !s.fired) { s.fired = true; W.carveRound(s.x, s.gy, s.sh.cr * s.k); W.hurtArea(s.x, s.gy - 10, s.sh.r * s.k, s.sh.dmg * s.k, s.owner); W.boom(s.x, s.gy, { ...s.base, R: s.base.R * 1.2, debris: 26, power: 1.6, shake: 1.1 }); }
        return s.t < 2;
      case 'erupt':
        if (s.t >= .7 && !s.fired) { s.fired = true; W.carveRound(s.x, s.y, s.sh.cr * s.k); const top = W.ground(s.x, 0); if (top < s.y) W.carveRect(s.x - 12, top - 4, 24, s.y - top + 4); W.hurtArea(s.x, Math.min(s.y, top + 10), s.sh.r * s.k, s.sh.dmg * s.k, s.owner, { tall: s.y - top }); W.boom(s.x, top + 6, { ...s.base, debris: 30, power: 2, shake: .8 }); }
        return s.t < 1.6;
      case 'tornado':
        if (s.t < 2.6) { s.x += s.dir * 130 * dt; s.gy = W.ground(s.x, 0); }
        for (const t of W.tanks) { if (t.dead || s.hit.has(t)) continue; if (Math.abs(t.x - s.x) < 34 && t.y > s.gy - 150) { s.hit.add(t); W.damage(t, s.sh.dmg * s.k, s.owner); t.vy = -420; t.vx = s.dir * 190; t.air = true; } }
        return s.t < 3;
      case 'storm':
        [.45, .65, .85, 1.05, 1.25].forEach((tt, i) => { if (s.t >= tt && !s.done[i]) { s.done[i] = true; const x = s.x + [-50, 30, -15, 55, 0][i] * s.k, gy = W.ground(x, 0); s.flash[i] = { x, gy, t: s.t }; W.carveRound(x, gy, 16 * s.k); W.hurtArea(x, gy - 10, 30, s.sh.dmg * s.k / 4.2, s.owner); W.boom(x, gy, { kind: 'electric', R: 18, color: '#b98cff', shake: .25 }); } });
        return s.t < 1.8;
      case 'shroom':
        if (s.t >= .85 && !s.fired) { s.fired = true; W.carveRound(s.x, s.gy, s.sh.cr * s.k); W.hurtArea(s.x, s.gy - 30, s.sh.r * s.k, s.sh.dmg * s.k, s.owner); W.boom(s.x, s.gy - 60, { kind: 'toxic', R: 50 * s.k, shake: .4 }); W.zones.push({ type: 'poison', x: r1(s.x), r: 80, turns: 3, dmg: 80, born: W.clock, from: s.owner?.uid }); }
        return s.t < 1.5;
      case 'wave':
        if (!s.fired) { s.fired = true; W.carveRound(s.x, s.gy, s.sh.cr * s.k); W.hurtArea(s.x, s.gy - 10, s.sh.r * s.k, s.sh.dmg * s.k * .75, s.owner); W.boom(s.x, s.gy, s.base); }
        s.wx += s.dir * 230 * dt;
        for (const t of W.tanks) { if (t.dead || s.hit.has(t) || t === s.owner) continue; if (Math.abs(t.x - s.wx) < 30) { s.hit.add(t); W.damage(t, s.sh.dmg * s.k * .25, s.owner); t.vx = s.dir * 240; t.vy = -260; t.air = true; } }
        return s.t < 1.9;
      case 'phoenix': return s.t < 1;
    }
    return false;
  }

  /* ---------- 돌발 이벤트 (어떤 이벤트를 어디에 낼지는 서버가 정해서 넘긴다) ---------- */
  static pickEvent(sim, rnd = Math.random) {
    const ev = sim.map.ev || {}; let r = rnd(), type = null;
    for (const k in ev) { r -= ev[k] * EVENT_RATE; if (r < 0) { type = k; break; } }
    if (!type) return null;
    // 회오리·불기둥은 맵에 하나씩만
    if ((type === 'tornado' || type === 'pillar') && sim.events.some(e => e.type === type)) return null;
    const live = sim.tanks.filter(t => !t.dead), e = { type, x: Math.round(120 + rnd() * (sim.w - 240)) };
    if (type === 'lightning' && live.length) { const t = live[Math.floor(rnd() * live.length)]; e.x = Math.round(t.x + (rnd() - .5) * 60); }
    if (type === 'pillar') for (let i = 0; i < 20; i++) { const x = Math.round(60 + rnd() * (sim.w - 120)); if (sim.ground(x, 0) < sim.liquidY && live.every(t => Math.abs(t.x - x) > 50)) { e.x = x; break; } }
    if (type === 'meteors') e.xs = [0, 1, 2].map(() => Math.round(80 + rnd() * (sim.w - 160)));
    return e;
  }
  // 보급 비행기: 화면 한쪽에서 날아와 정한 자리에 낙하산 상자를 떨어뜨린다
  static pickSupply(sim, rnd = Math.random) {
    return { type: 'supply', x: Math.round(140 + rnd() * (sim.w - 280)), dir: rnd() < .5 ? 1 : -1, item: SUPPLY_ITEMS[Math.floor(rnd() * SUPPLY_ITEMS.length)] };
  }
  static planeX(sim, e) { return e.dir > 0 ? -90 + PLANE_SPEED * e.t : sim.w + 90 - PLANE_SPEED * e.t; }
  addEvent(spec) { const e = { ...spec, t: 0, turns: EVENT_INFO[spec.type].turns, hit: new Set(), done: [] }; this.events.push(e); this.fx('banner', { text: spec.type === 'supply' ? '보급 비행기가 지나가요!' : '돌발! ' + EVENT_INFO[spec.type].n }); return e; }
  stepEvents(dt) {
    for (const e of this.events) {
      e.t += dt;
      // 회오리·불기둥은 생긴 자리에 그대로 있고 탱크는 그냥 지나간다. 포탄에만 영향을 준다
      if (e.type === 'tornado') e.gy = Math.min(this.ground(e.x, 0), this.liquidY);
      if (e.type === 'pillar') { e.gy = this.ground(e.x, 0); if (e.t > 1 && !e.done[0]) { e.done[0] = true; this.fx('shake', { v: .3 }); } }
      if (e.type === 'meteors') e.xs.forEach((x, i) => { const tt = .4 + i * .45; if (e.t > tt + .7 && !e.done[i]) { e.done[i] = true; const y = this.ground(x, 0); this.carveRound(x, y, 26); this.hurtArea(x, y - 10, 26, 90, null); this.boom(x, y, { kind: 'fire', R: 28, debris: 12, shake: .3 }); } });
      if (e.type === 'supply' && !e.done[0] && (e.dir > 0 ? Sim.planeX(this, e) >= e.x : Sim.planeX(this, e) <= e.x)) { e.done[0] = true; this.crates.push({ id: ++this.crateId, x: e.x, y: PLANE_Y + 14, vy: 0, item: e.item, para: true, landed: false }); }
      if (e.type === 'lightning' && e.t > .7 && !e.done[0]) { e.done[0] = true; const y = this.ground(e.x, 0); this.carveRound(e.x, y, 18); this.hurtArea(e.x, y - 10, 24, 110, null); this.boom(e.x, y, { kind: 'electric', R: 22, color: '#bfe0ff', shake: .35 }); }
    }
    this.events = this.events.filter(e => e.type === 'meteors' ? e.t < 2.4 : e.type === 'lightning' ? e.t < 1.3 : e.type === 'supply' ? e.t < (this.w + 180) / PLANE_SPEED : true);
    this.stepCrates(dt);
  }
  // 보급 상자: 낙하산으로 천천히 내려앉고, 밑의 땅이 파이면 다시 떨어진다. 탱크가 닿으면 줍는다
  stepCrates(dt) {
    for (const c of this.crates) {
      const g = this.ground(c.x, Math.max(0, c.y - 2));
      if (c.y < g - .5) { c.landed = false; c.vy = Math.min(c.vy + 300 * dt, c.para ? 70 : 420); c.y = Math.min(g, c.y + c.vy * dt); if (c.y >= g) { c.landed = true; c.para = false; c.vy = 0; } }
      else { c.y = g; c.landed = true; c.para = false; c.vy = 0; }
      if (c.y > this.liquidY || c.y > this.h) { c.gone = true; this.fx('splash', { x: c.x }); continue; }
      const t = this.tanks.find(t => !t.dead && !t.sunk && Math.abs(t.x - c.x) < 30 && t.y > c.y - 46 && t.y < c.y + 40);
      if (t) { c.gone = true; this.picked.push({ uid: t.uid, item: c.item }); this.float(c.x, c.y - 50, '보급품: ' + ITEM_INFO[c.item].n, '#2b8a3e'); this.fx('pickup', { uid: t.uid, item: c.item, x: c.x, y: c.y }); }
    }
    if (this.crates.some(c => c.gone)) this.crates = this.crates.filter(c => !c.gone);
  }
  shellVsEvents(s, dt) {
    for (const e of this.events) {
      const gy = e.gy ?? this.h;
      // 회오리: 포탄을 붙잡아 빙글빙글 타고 올라가게 한 뒤 튕겨 낸다 (회오리마다 한 번)
      if (e.type === 'tornado' && e.t > .5 && s.mode === 'fly' && Math.abs(s.x - e.x) < 30 && s.y < gy + 4 && !(s.caught && s.caught.includes(e.x))) {
        (s.caught ||= []).push(e.x);
        s.mode = 'spin'; s.spin = { x: e.x, t: 0, ph: s.x < e.x ? Math.PI : 0, r: Math.max(8, Math.abs(s.x - e.x)), top: s.y - 130 };
        this.float(e.x, s.y - 16, '휘말림!', '#3a2600'); return false;
      }
      // 불기둥: 지나가는 포탄을 파워업시킨다 (불기둥마다 한 번, 피해·파임 +30%)
      if (e.type === 'pillar' && e.t > 1 && Math.abs(s.x - e.x) < 18 && s.y < gy && !(s.fired && s.fired.includes(e.x))) {
        (s.fired ||= []).push(e.x); s.k = Math.round(s.k * 1.3 * 100) / 100; s.powered = true;
        this.float(s.x, s.y - 18, '파워업!', '#ff6a2a');
      }
    }
    return false;
  }
  spinStep(s, h) {
    const sp = s.spin; sp.t += h; sp.ph += h * 13; sp.r = Math.min(26, sp.r + h * 20);
    const y = s.y - h * 130, x = sp.x + Math.cos(sp.ph) * sp.r;
    s.vx = (x - s.x) / h; s.vy = (y - s.y) / h; s.x = x; s.y = y;
    if (sp.t > 1.1 || s.y < sp.top || s.y < 10) { // 튕겨 나감: 돌던 방향으로 세게
      const dir = -Math.sin(sp.ph) >= 0 ? 1 : -1;
      s.vx = dir * 420; s.vy = -240; s.mode = 'fly'; s.spin = null;
    }
  }

  /* ---------- 턴 ---------- */
  turnStart(t) {
    this.teleported = false;
    this.events.forEach(e => { e.turns--; e.hit = new Set(); });
    this.events = this.events.filter(e => !(e.type === 'tornado' || e.type === 'pillar') || e.turns > 0);
    for (const z of this.zones) { if (!t.dead && Math.abs(t.x - z.x) < z.r) this.damage(t, z.dmg, this.tankOf(z.from), z.type === 'burn' ? '화상 ' : '독 '); z.turns--; }
    this.zones = this.zones.filter(z => z.turns > 0);
    t.canMove = true; t.shield = false; t.fuel = 100;
    if (t.frozen > 0) { t.frozen--; t.canMove = false; this.float(t.x, t.y - 90, '얼어서 못 움직임', '#1f6fae'); }
  }
  // 서든데스: 30턴 이후 매 턴 물이 12px씩 차오른다 (물이 없는 맵은 맵 아래에서 생긴다)
  suddenDeath() { if (!this.map.liquid || this.map.liquid.type === 'void') this.sdLiquid = true; this.liquidY = Math.min(this.liquidY, this.h) - 12; this.fx('banner', { text: '서든데스! 물이 차오른다' }); }

  /* ---------- 한 프레임 ---------- */
  step(dt = DT) {
    this.clock += dt;
    this.pending.forEach(p => p.at -= dt); this.pending = this.pending.filter(p => { if (p.at <= 0) { p.fn(); return false; } return true; });
    const [wx, wy] = this.windVec(), liquid = this.map.liquid || this.sdLiquid;
    for (const s of this.shells) {
      const sh = s.sh;
      for (let k = 0; k < 4 && !s.done; k++) {
        const h = dt / 4; s.age += h;
        if (s.mode === 'spin') { this.spinStep(s, h); continue; }
        if (s.mode === 'dig') { s.x += s.vx * h; s.y += s.vy * h; s.dug += Math.hypot(s.vx, s.vy) * h; if (this.hitTank(s) || s.dug >= 80 || s.y > this.h - 4) { this.impact(s, s.x, s.y); break; } continue; }
        if (sh.shape !== 'line') { s.vx += wx * sh.wind * h; s.vy += (wy * sh.wind + this.g * sh.wt) * h; }
        if (sh.fx === 'home') { let best = null, bd = 150; for (const t of this.tanks) { if (t.dead || t === s.owner) continue; const d = Math.hypot(t.x - s.x, t.y - 18 - s.y); if (d < bd) { bd = d; best = t; } } if (best) { s.vx += (best.x - s.x) / bd * 600 * h; s.vy += (best.y - 18 - s.y) / bd * 600 * h; } }
        if (sh.fx === 'missile' && s.age > .45) this.steerMissile(s, h);
        s.x += s.vx * h; s.y += s.vy * h;
        if (this.shellVsEvents(s, h)) break;
        if (s.x < -300 || s.x > this.w + 300 || s.y > this.h + 40) { s.done = true; if (liquid && s.y > this.liquidY - 4) this.fx('splash', { x: s.x }); break; }
        if (liquid && this.map.liquid?.type !== 'void' && s.y > this.liquidY) { s.done = true; this.fx('splash', { x: s.x }); break; }
        const ht = this.hitTank(s);
        if (sh.shape === 'line') {
          s.dist += 900 * h; if (ht) { this.impact(s, s.x, s.y, ht); break; }
          if (this.solid(s.x, s.y) && (!s.lastCarve || Math.hypot(s.x - s.lastCarve[0], s.y - s.lastCarve[1]) > 5)) { this.carveRound(s.x, s.y, sh.cr / 2, 0, false); s.lastCarve = [s.x, s.y]; }
          if (s.dist > 1100) s.done = true; continue;
        }
        if (ht || this.solid(s.x, s.y)) {
          if (sh.shape === 'tunnel' && !ht) { s.mode = 'dig'; const sp = Math.hypot(s.vx, s.vy) || 1; s.vx = s.vx / sp * 170; s.vy = Math.abs(s.vy / sp * 170) + 40; }
          else this.impact(s, s.x, s.y, ht);
        }
      }
      if (s.mode === 'dig' && !s.done) this.carveRound(s.x, s.y, 10, 0, false);
      s.trail.unshift([s.x, s.y]); if (s.trail.length > 12) s.trail.pop();
    }
    this.shells = this.shells.filter(s => !s.done);
    this.specials = this.specials.filter(s => { s.t += dt; return this.stepSpecial(s, dt); });
    if (this.queued && !this.shells.length && !this.specials.length && !this.tanks.some(t => !t.sunk && !t.left && (t.air || this.ground(t.x, t.y - 3, t.y) > t.y + 1))) {
      this.queued.wait -= dt; if (this.queued.wait <= 0) { const q = this.queued; this.queued = null; q.fn(); }
    }
    this.stepEvents(dt);
    for (const t of this.tanks) { t.moving = false; this.settle(t, dt); }
  }
  settle(t, dt) {
    if (t.sunk || t.left) return true;
    const g = this.reach(t.x, t.y, 3, true);
    if (t.air || g > t.y + 1) {
      t.vy += 900 * dt; t.x += t.vx * dt;
      if (t.x < 10 || t.x > this.w - 10) { t.x = Math.max(10, Math.min(this.w - 10, t.x)); t.vx = 0; }
      const ny = t.y + t.vy * dt;
      if (t.vy > 0) { const land = this.ground(t.x, t.y - 3, t.y); if (ny >= land && land < this.h && land < this.liquidY + 6) { t.y = land; t.air = false; t.vx = 0; const fall = t.y - t.fallFrom; if (fall > 40) this.damage(t, fall * .8, null, '낙하 '); t.vy = 0; t.fallFrom = t.y; t.tilt = this.slope(t); this.clampAngle(t); return true; } }
      t.y = ny;
      if (t.y > this.liquidY + 6 || t.y > this.h + 20) {
        t.sunk = true; this.float(t.x, Math.min(this.liquidY, this.h) - 30, '낙사!', '#c92a2a');
        if ((this.map.liquid && this.map.liquid.type !== 'void') || this.sdLiquid) this.fx('splash', { x: t.x });
        this.kill(t, null); return true;
      }
      return false;
    }
    t.y = g; t.vy = 0; t.fallFrom = t.y;
    if (this.map.slip && !t.dead && this.clock - (t.lastMove ?? -9) > dt * 1.5) this.slide(t, dt);
    if (!t.dead) { const tl = this.slope(t); if (tl !== t.tilt) { t.tilt = tl; this.clampAngle(t); } }
    if (t.y > this.liquidY + 6 && !t.dead) { t.sunk = true; this.float(t.x, this.liquidY - 30, '낙사!', '#c92a2a'); this.kill(t, null); }
    return true;
  }
  // 얼음: 멈춘 뒤에도 미끄러지고, 비탈에서는 아래로 밀린다
  slide(t, dt) {
    const down = Math.sin((t.tilt || 0) * Math.PI / 180) * (t.facing || 1); // +면 오른쪽이 내리막
    t.slideV = ((t.slideV || 0) + down * 160 * dt) * (1 - 1.6 * dt);
    if (Math.abs(t.slideV) < 2 && Math.abs(down) < .12) { t.slideV = 0; return; }
    const nx = t.x + t.slideV * dt; if (nx < 12 || nx > this.w - 12) { t.slideV = 0; return; }
    const ny = this.ground(nx, t.y - 14, t.y); if (ny < t.y - 6) { t.slideV = 0; return; }
    t.x = nx; if (ny <= t.y + 2) { t.y = ny; t.fallFrom = ny; }
  }
  busy() {
    return this.shells.length > 0 || this.pending.length > 0 || !!this.queued || this.specials.length > 0 || this.tanks.some(t => !t.sunk && !t.left && (t.air || this.ground(t.x, t.y - 3, t.y) > t.y + 1))
      || this.crates.some(c => !c.landed) || this.events.some(e => (e.type === 'meteors' && e.t < 2.4) || (e.type === 'lightning' && e.t < 1.3) || (e.type === 'pillar' && e.t < 1.6));
  }

  /* ---------- 아이템 (즉시 효과는 여기서, 발사에 붙는 효과는 표시만) ---------- */
  useItem(t, id) {
    const heal = (x, n) => { if (x.dead) return; x.hp = Math.min(x.max, x.hp + n); this.float(x.x, x.y - 60, '+' + n, '#2f9e44'); };
    if (id === 'repair') heal(t, 150);
    if (id === 'teamrepair') this.tanks.filter(x => x === t || (t.team !== 'solo' && x.team === t.team)).forEach(x => heal(x, 90));
    if (id === 'calm') this.wind = { ...this.wind, str: 0 };
    if (id === 'shield') t.shield = true;
    if (id === 'fuel') t.fuel = 200;
    this.fx('item', { uid: t.uid, id });
  }

  /* ---------- 동기화 ---------- */
  snapshot() {
    return {
      clock: this.clock, wind: { ...this.wind }, liquidY: this.liquidY, sdLiquid: !!this.sdLiquid, ops: this.ops.length,
      tanks: this.tanks.map(t => ({ uid: t.uid, x: t.x, y: t.y, vx: t.vx, vy: t.vy, air: t.air, fallFrom: t.fallFrom, hp: t.hp, angle: t.angle, facing: t.facing, fuel: t.fuel, tilt: t.tilt, shield: t.shield, frozen: t.frozen, canMove: t.canMove, dead: t.dead, sunk: t.sunk, left: t.left, kills: t.kills, dealt: t.dealt, lastHitBy: t.lastHitBy, delay: t.delay })),
      events: this.events.map(e => ({ type: e.type, x: e.x, xs: e.xs, gy: e.gy, t: e.t, turns: e.turns, done: e.done, dir: e.dir, item: e.item })),
      crates: this.crates.map(c => ({ ...c })), crateId: this.crateId,
      zones: this.zones.map(z => ({ ...z })),
    };
  }
  restore(s) {
    this.clock = s.clock; this.wind = { ...s.wind }; this.liquidY = s.liquidY; this.sdLiquid = s.sdLiquid;
    for (const d of s.tanks) { const t = this.tankOf(d.uid); if (t) Object.assign(t, d); }
    this.events = s.events.map(e => ({ ...e, hit: new Set(), done: [...(e.done || [])] }));
    this.zones = s.zones.map(z => ({ ...z }));
    this.crates = (s.crates || []).map(c => ({ ...c })); this.crateId = s.crateId || 0;
    this.shells = []; this.specials = []; this.pending = []; this.queued = null;
  }
  // 바람·지형을 반영해 목표 x에 닿는 파워 (도움말·테스트용)
  solvePower(t, slot, targetX, withWind = true) {
    const sh = SHELL_STATS[t.tankId][slot], [wx, wy] = withWind ? this.windVec() : [0, 0];
    const land = p => { const a = t.angle * Math.PI / 180, [ox, oy] = this.muzzle(t); let x = ox, y = oy, vx = Math.cos(a) * t.facing * p * SPEED, vy = -Math.sin(a) * p * SPEED; for (let i = 0; i < 900; i++) { const h = 1 / 120; vx += wx * sh.wind * h; vy += (wy * sh.wind + this.g * sh.wt) * h; x += vx * h; y += vy * h; if (vy > 0 && (this.solid(x, y) || y > this.h)) return x; } return x; };
    let lo = 5, hi = 100; const want = (targetX - t.x) * t.facing;
    for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2, got = (land(mid) - t.x) * t.facing; if (got < want) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
}

// 시작 위치: 팀전은 레드 왼쪽·블루 오른쪽, 개인전은 고르게. 물·허공 위는 피한다
export function spawnPositions(sim, players, rnd = Math.random) {
  const top = x => { for (let y = 0; y < sim.h; y++) { const m = sim.grid[y * sim.w + x]; if (m) return m; } return 0; };
  const tree = x => [x - 7, x, x + 7].some(xx => xx >= 0 && xx < sim.w && (top(xx) === MK.leaf || top(xx) === MK.wood));
  const cands = []; for (let x = 30; x < sim.w - 30; x += 6) { const g = sim.ground(x, 0); if (g < sim.h - 10 && g < sim.liquidY - 20 && !tree(x)) cands.push(x); }
  const used = [], pick = target => { let best = null, bd = 1e9; for (const x of cands) { if (used.some(u => Math.abs(u - x) < 70)) continue; const d = Math.abs(x - target); if (d < bd) { bd = d; best = x; } } if (best == null) best = cands[Math.floor(rnd() * cands.length)] ?? sim.w / 2; used.push(best); return best; };
  const out = {}, [L, R] = sim.map.spawn;
  const place = (list, a, b) => list.forEach((p, i) => { const u = list.length === 1 ? (a + b) / 2 : a + (b - a) * i / (list.length - 1); out[p.userId] = pick(u * sim.w + (rnd() - .5) * 30); });
  if (players.some(p => p.team === 'red')) { place(players.filter(p => p.team === 'red'), Math.max(.04, L - .1), Math.min(.45, L + .22)); place(players.filter(p => p.team === 'blue'), Math.max(.55, R - .22), Math.min(.96, R + .1)); }
  else place(players, Math.max(.04, L - .08), Math.min(.96, R + .08));
  return out;
}
