// 전투 시뮬레이션 본체 (그림 없음). 서버가 판정하고, 화면도 같은 코드로 같은 결과를 재생한다.
// 화면에 보여줄 일(폭발, 숫자, 땅 파기 등)은 this.fxq에 쌓고 화면이 꺼내 쓴다.
import { MAPS, MK } from './maps.js';
import { MaskCtx, fillPolys, raggedPoly, hash } from './raster.js';
import { TANK_STATS, SHELL_STATS } from '../gamedata.js';

export const G0 = 380, SPEED = 5.6, WINDK = 14, DT = 1 / 60;
const STEEL = MK.steel;
const BASE = new Map();
export function baseGrid(mapId, w, h) {
  const key = `${mapId}:${w}x${h}`;
  if (!BASE.has(key)) { const g = new Uint8Array(w * h); MAPS[mapId].terrain(new MaskCtx(g, w, h), w, h); BASE.set(key, g); }
  return BASE.get(key).slice();
}
export const opsHash = ops => { let h = 0; const s = JSON.stringify(ops); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
const ease = u => u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u);
const r1 = v => Math.round(v * 10) / 10;

export const EVENT_INFO = {
  tornado: { n: '회오리', turns: 2 }, pillar: { n: '불기둥', turns: 1 }, meteors: { n: '운석 소나기', turns: 0 }, lightning: { n: '벼락', turns: 0 },
};

export class Sim {
  constructor({ w = 960, h = 480, map = 'hills', tankScale = .5 } = {}) { this.w = w; this.h = h; this.ts = tankScale; this.reset(map); }
  get map() { return MAPS[this.mapId]; }
  reset(mapId) {
    if (mapId) this.mapId = mapId;
    this.grid = baseGrid(this.mapId, this.w, this.h); this.ops = [];
    this.g = G0 * this.map.grav; this.liquidY = this.map.liquid ? this.map.liquid.y * this.h : this.h + 30;
    this.tanks = []; this.shells = []; this.specials = []; this.events = []; this.zones = []; this.pending = [];
    this.clock = 0; this.wind = { ang: 0, str: 0 }; this.fxq = []; this.teleported = false;
  }
  fx(type, d = {}) { this.fxq.push({ type, ...d }); }

  /* ---------- 지형 ---------- */
  solid(x, y) { x |= 0; y |= 0; return x >= 0 && x < this.w && y >= 0 && y < this.h && this.grid[y * this.w + x] !== 0; }
  ground(x, from = 0) { for (let y = Math.max(0, from | 0); y < this.h; y++) if (this.solid(x, y) || this.solid(x - 7, y) || this.solid(x + 7, y)) return y; return this.h + 200; }
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
    if (rnd() < .18) w = { ang: rnd() * 360, str: rnd() * max };
    else { w.ang = (w.ang + (rnd() - .5) * 80 + 360) % 360; w.str = Math.max(0, Math.min(max, w.str + (rnd() - .5) * 5)); }
    return { ang: Math.round(w.ang), str: Math.round(w.str) };
  }

  /* ---------- 탱크 ---------- */
  addTank({ uid, tankId, x, facing = 1, team = 'solo', name = '' }) {
    const S = TANK_STATS[tankId];
    const t = { uid, tankId, S, name, team, x, y: 0, hp: S.hp, max: S.hp, angle: Math.min(Math.max(45, S.amin), S.amax), facing, fuel: 100, vx: 0, vy: 0, air: false, fallFrom: 0,
      firedAt: -9, hitAt: -9, moving: false, shield: false, frozen: 0, canMove: true, dead: false, sunk: false, left: false, kills: 0, dealt: 0, lastHitBy: null, delay: 0 };
    t.y = this.ground(x, 0); t.fallFrom = t.y; this.tanks.push(t); return t;
  }
  tankOf(uid) { return this.tanks.find(t => t.uid === uid); }
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
    const a = t.angle * Math.PI / 180, sc = this.ts, lift = t.S.hover ? -12 * sc : 0;
    const px = t.x + t.S.pivot[0] * sc * t.facing, py = t.y + t.S.pivot[1] * sc + lift, L = t.S.len * sc + 4;
    return [px + Math.cos(a) * L * t.facing, py - Math.sin(a) * L];
  }
  move(t, dir, dt) {
    t.facing = dir; if (t.fuel <= 0 || !t.canMove || t.air || t.dead) return 0;
    const nx = t.x + dir * 50 * dt; if (nx < 12 || nx > this.w - 12) return 0;
    const ny = this.ground(nx, t.y - 14); if (ny < t.y - 12) return 0;
    t.moving = true; t.x = nx; if (ny <= t.y + 2) { t.y = ny; t.fallFrom = ny; }
    const used = 22 * dt * (ny < t.y ? 1.5 : 1); t.fuel = Math.max(0, t.fuel - used); return used;
  }

  /* ---------- 발사 ---------- */
  fire(t, slot, p, o = {}) {
    const sh = SHELL_STATS[t.tankId][slot]; t.firedAt = this.clock;
    this.teleported = false;
    const spawn = () => (sh.spread || [0]).forEach(da => {
      const a = (t.angle + da) * Math.PI / 180, v = sh.shape === 'line' ? 900 : p * SPEED, [ox, oy] = this.muzzle(t);
      this.shells.push({ x: ox, y: oy, sx: ox, sy: oy, vx: Math.cos(a) * t.facing * v, vy: -Math.sin(a) * v, sh, tankId: t.tankId, slot, owner: t, age: 0, trail: [], mode: 'fly', dug: 0, dist: 0, lastCarve: null, k: o.boost || 1, teleport: !!o.teleport });
    });
    spawn(); if (o.double) this.pending.push({ at: .45, fn: spawn });
    this.fx('fire', { uid: t.uid });
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
        if (s.t >= .7 && !s.fired) { s.fired = true; W.carveRound(s.x, s.y, s.sh.cr * s.k); const top = W.ground(s.x, 0); if (top < s.y) W.carveRect(s.x - 12, top - 4, 24, s.y - top + 4); W.hurtArea(s.x, Math.min(s.y, top + 10), s.sh.r * s.k + 20, s.sh.dmg * s.k, s.owner, { tall: s.y - top }); W.boom(s.x, top + 6, { ...s.base, debris: 30, power: 2, shake: .8 }); }
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
    for (const k in ev) { r -= ev[k] * .45; if (r < 0) { type = k; break; } }
    if (!type) return null;
    const live = sim.tanks.filter(t => !t.dead), e = { type, x: Math.round(120 + rnd() * (sim.w - 240)) };
    if (type === 'lightning' && live.length) { const t = live[Math.floor(rnd() * live.length)]; e.x = Math.round(t.x + (rnd() - .5) * 60); }
    if (type === 'pillar') for (let i = 0; i < 20; i++) { const x = Math.round(60 + rnd() * (sim.w - 120)); if (sim.ground(x, 0) < sim.liquidY && live.every(t => Math.abs(t.x - x) > 50)) { e.x = x; break; } }
    if (type === 'meteors') e.xs = [0, 1, 2].map(() => Math.round(80 + rnd() * (sim.w - 160)));
    return e;
  }
  addEvent(spec) { const e = { ...spec, t: 0, turns: EVENT_INFO[spec.type].turns, hit: new Set(), done: [] }; this.events.push(e); this.fx('banner', { text: '돌발! ' + EVENT_INFO[spec.type].n }); return e; }
  stepEvents(dt) {
    for (const e of this.events) {
      e.t += dt;
      if (e.type === 'tornado') {
        e.x += (this.windVec()[0] * .25 + Math.sin(this.clock * .7) * 20) * dt; e.x = Math.max(40, Math.min(this.w - 40, e.x)); e.gy = Math.min(this.ground(e.x, 0), this.liquidY);
        for (const t of this.tanks) if (!t.dead && !e.hit.has(t) && Math.abs(t.x - e.x) < 26 && e.t > .5) { e.hit.add(t); this.damage(t, 60, null); t.vy = -380; t.vx = (Math.sign(t.x - e.x) || 1) * 170; t.air = true; }
      }
      if (e.type === 'pillar') { e.gy = this.ground(e.x, 0); if (e.t > 1 && !e.done[0]) { e.done[0] = true; for (const t of this.tanks) if (!t.dead && Math.abs(t.x - e.x) < 30) { this.damage(t, 150, null); t.vy = -300; t.air = true; } this.fx('shake', { v: .4 }); } }
      if (e.type === 'meteors') e.xs.forEach((x, i) => { const tt = .4 + i * .45; if (e.t > tt + .7 && !e.done[i]) { e.done[i] = true; const y = this.ground(x, 0); this.carveRound(x, y, 26); this.hurtArea(x, y - 10, 26, 90, null); this.boom(x, y, { kind: 'fire', R: 28, debris: 12, shake: .3 }); } });
      if (e.type === 'lightning' && e.t > .7 && !e.done[0]) { e.done[0] = true; const y = this.ground(e.x, 0); this.carveRound(e.x, y, 18); this.hurtArea(e.x, y - 10, 24, 110, null); this.boom(e.x, y, { kind: 'electric', R: 22, color: '#bfe0ff', shake: .35 }); }
    }
    this.events = this.events.filter(e => e.type === 'meteors' ? e.t < 2.4 : e.type === 'lightning' ? e.t < 1.3 : true);
  }
  shellVsEvents(s, dt) {
    for (const e of this.events) {
      if (e.type === 'tornado' && e.t > .5 && Math.abs(s.x - e.x) < 36 && s.y > (e.gy ?? this.h) - 160) { s.vy -= 1400 * dt; s.vx += (s.x > e.x ? 1 : -1) * 500 * dt; }
      if (e.type === 'pillar' && e.t > 1 && Math.abs(s.x - e.x) < 16 && s.y > (e.gy ?? this.h) - 150) { s.done = true; this.boom(s.x, s.y, { kind: 'fire', R: 20 }); this.float(s.x, s.y - 20, '불기둥에 막힘', '#c92a2a'); return true; }
    }
    return false;
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
        if (s.mode === 'dig') { s.x += s.vx * h; s.y += s.vy * h; s.dug += Math.hypot(s.vx, s.vy) * h; if (this.hitTank(s) || s.dug >= 80 || s.y > this.h - 4) { this.impact(s, s.x, s.y); break; } continue; }
        if (sh.shape !== 'line') { s.vx += wx * sh.wind * h; s.vy += (wy * sh.wind + this.g * sh.wt) * h; }
        if (sh.fx === 'home') { let best = null, bd = 150; for (const t of this.tanks) { if (t.dead || t === s.owner) continue; const d = Math.hypot(t.x - s.x, t.y - 18 - s.y); if (d < bd) { bd = d; best = t; } } if (best) { s.vx += (best.x - s.x) / bd * 600 * h; s.vy += (best.y - 18 - s.y) / bd * 600 * h; } }
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
    this.stepEvents(dt);
    for (const t of this.tanks) { t.moving = false; this.settle(t, dt); }
  }
  settle(t, dt) {
    if (t.sunk || t.left) return true;
    const g = this.ground(t.x, t.y - 3);
    if (t.air || g > t.y + 1) {
      t.vy += 900 * dt; t.x += t.vx * dt;
      if (t.x < 10 || t.x > this.w - 10) { t.x = Math.max(10, Math.min(this.w - 10, t.x)); t.vx = 0; }
      const ny = t.y + t.vy * dt;
      if (t.vy > 0) { const land = this.ground(t.x, t.y - 3); if (ny >= land && land < this.h && land < this.liquidY + 6) { t.y = land; t.air = false; t.vx = 0; const fall = t.y - t.fallFrom; if (fall > 40) this.damage(t, fall * 1.2, null, '낙하 '); t.vy = 0; t.fallFrom = t.y; return true; } }
      t.y = ny;
      if (t.y > this.liquidY + 6 || t.y > this.h + 20) {
        t.sunk = true; this.float(t.x, Math.min(this.liquidY, this.h) - 30, '낙사!', '#c92a2a');
        if ((this.map.liquid && this.map.liquid.type !== 'void') || this.sdLiquid) this.fx('splash', { x: t.x });
        this.kill(t, null); return true;
      }
      return false;
    }
    t.y = g; t.vy = 0; t.fallFrom = t.y;
    if (t.y > this.liquidY + 6 && !t.dead) { t.sunk = true; this.float(t.x, this.liquidY - 30, '낙사!', '#c92a2a'); this.kill(t, null); }
    return true;
  }
  busy() {
    return this.shells.length > 0 || this.pending.length > 0 || this.specials.length > 0 || this.tanks.some(t => !t.sunk && !t.left && (t.air || this.ground(t.x, t.y - 3) > t.y + 1))
      || this.events.some(e => (e.type === 'meteors' && e.t < 2.4) || (e.type === 'lightning' && e.t < 1.3) || (e.type === 'pillar' && e.t < 1.6));
  }

  /* ---------- 아이템 (즉시 효과는 여기서, 발사에 붙는 효과는 표시만) ---------- */
  useItem(t, id) {
    const heal = (x, n) => { if (x.dead) return; x.hp = Math.min(x.max, x.hp + n); this.float(x.x, x.y - 60, '+' + n, '#2f9e44'); };
    if (id === 'repair') heal(t, 250);
    if (id === 'teamrepair') this.tanks.filter(x => x === t || (t.team !== 'solo' && x.team === t.team)).forEach(x => heal(x, 150));
    if (id === 'calm') this.wind = { ...this.wind, str: 0 };
    if (id === 'shield') t.shield = true;
    if (id === 'fuel') t.fuel = 200;
    this.fx('item', { uid: t.uid, id });
  }

  /* ---------- 동기화 ---------- */
  snapshot() {
    return {
      clock: this.clock, wind: { ...this.wind }, liquidY: this.liquidY, sdLiquid: !!this.sdLiquid, ops: this.ops.length,
      tanks: this.tanks.map(t => ({ uid: t.uid, x: t.x, y: t.y, vx: t.vx, vy: t.vy, air: t.air, fallFrom: t.fallFrom, hp: t.hp, angle: t.angle, facing: t.facing, fuel: t.fuel, shield: t.shield, frozen: t.frozen, canMove: t.canMove, dead: t.dead, sunk: t.sunk, left: t.left, kills: t.kills, dealt: t.dealt, lastHitBy: t.lastHitBy, delay: t.delay })),
      events: this.events.map(e => ({ type: e.type, x: e.x, xs: e.xs, gy: e.gy, t: e.t, turns: e.turns, done: e.done })),
      zones: this.zones.map(z => ({ ...z })),
    };
  }
  restore(s) {
    this.clock = s.clock; this.wind = { ...s.wind }; this.liquidY = s.liquidY; this.sdLiquid = s.sdLiquid;
    for (const d of s.tanks) { const t = this.tankOf(d.uid); if (t) Object.assign(t, d); }
    this.events = s.events.map(e => ({ ...e, hit: new Set(), done: [...(e.done || [])] }));
    this.zones = s.zones.map(z => ({ ...z }));
    this.shells = []; this.specials = []; this.pending = [];
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
