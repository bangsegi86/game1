// 전투 화면 그리기: 시뮬레이션(shared/sim/world.js) 상태를 받아 그린다.
// 탱크·포탄·폭발 그림은 /art/art.js 전역 함수를 쓴다.
import { MAPS, MAT } from '../../shared/sim/maps.js';
import { baseGrid, backGrid, Sim, PLANE_Y } from '../../shared/sim/world.js';
import { raggedPoly } from '../../shared/sim/raster.js';

const hex3 = s => { const n = parseInt(s.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const ease = u => u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u);
const lerp = (a, b, k) => a + (b - a) * k;
function hash2(x, y) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* ---------- 재질 채색 ---------- */
function palette(m) {
  const p = m.pal, two = (v, d) => Array.isArray(v) ? [hex3(v[0]), hex3(v[1])] : v ? [hex3(v), hex3(v).map(x => x * .6)] : d;
  const s = two(p.soil, [[176, 122, 72], [94, 58, 34]]), r = two(p.rock, [[138, 132, 120], [85, 80, 74]]), i = two(p.ice, [[216, 242, 255], [120, 184, 220]]);
  return { soil0: s[0], soil1: s[1], rock0: r[0], rock1: r[1], ice0: i[0], ice1: i[1], crust: p.crust ? hex3(p.crust) : null, steel0: hex3(p.steel || '#9aa4b2'), leaf0: hex3(p.leaf || '#4f9e3c'), wood0: hex3(p.wood || '#7a4f2c'), cap0: hex3(p.cap || '#e5487a'), plank0: hex3(p.plank || '#a0703f') };
}
function shadeMat(m, d, x, y, P, out) {
  let c, k = 1;
  const n = hash2(x >> 1, y >> 1) - .5, n2 = hash2(x >> 3, y >> 3) - .5;
  if (m === 'soil') { c = mix3(P.soil0, P.soil1, Math.min(1, d / 150)); k = 1 + .07 * Math.sin(y * .2 + n2 * 4) + n * .12; if (hash2(x >> 2, y >> 2) > .975) k *= .72; if (P.crust && d < 7) { c = P.crust; k = (d < 2 ? 1.08 : d > 5 ? .76 : 1) + n * .1; } }
  else if (m === 'rock') { c = mix3(P.rock0, P.rock1, Math.min(1, d / 120)); k = 1 + .12 * Math.sin(y * .35 + n2 * 6) + n * .14; if (hash2(x >> 2, y >> 1) > .97) k *= .7; }
  else if (m === 'steel') { c = P.steel0; const sx = x % 48, sy = y % 24; k = (sx < 2 || sy < 2) ? .62 : 1 + n * .05; if ((sx - 6) ** 2 + (sy - 7) ** 2 < 4 || (sx - 42) ** 2 + (sy - 7) ** 2 < 4) k = 1.3; if (d < 2) k *= 1.2; }
  else if (m === 'leaf') { c = P.leaf0; k = .8 + hash2(x >> 3, y >> 3) * .35 + n * .12; if (d < 3) k *= 1.15; }
  else if (m === 'wood') { c = P.wood0; k = 1 + .1 * Math.sin(x * .9 + n2 * 3) + n * .08; }
  else if (m === 'cap') { c = P.cap0; const cx = Math.floor(x / 26), cy = Math.floor(y / 20), ox = cx * 26 + 6 + hash2(cx, cy) * 14, oy = cy * 20 + 4 + hash2(cy, cx) * 12; if ((x - ox) ** 2 + (y - oy) ** 2 < 22) c = [255, 244, 247]; k = 1 + n * .06 - Math.min(.3, d / 60); }
  else if (m === 'plank') { c = P.plank0; k = ((y % 9) < 1 ? .62 : 1) + .07 * Math.sin(x * .35 + n2 * 4) + n * .06; if (d < 2) k *= 1.15; }
  else { c = mix3(P.ice0, P.ice1, Math.min(1, d / 70)); k = 1 + .08 * Math.sin((x + y) * .12) + n * .05; if (P.crust && d < 6) { c = P.crust; k = d > 4 ? .86 : 1; } }
  out[0] = Math.min(255, c[0] * k); out[1] = Math.min(255, c[1] * k); out[2] = Math.min(255, c[2] * k);
}

function skyPaint(c, w, h, o) {
  const g = c.createLinearGradient(0, 0, 0, h); o.stops.forEach((col, i) => g.addColorStop(i / (o.stops.length - 1), col)); c.fillStyle = g; c.fillRect(0, 0, w, h);
  if (o.stars) for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(255,255,255,${.25 + hash(i) * .75})`; const s = hash(i + 5) > .9 ? 2 : 1.2; c.fillRect(hash(i + 1) * w, hash(i + 2) * h * .85, s, s); }
  if (o.sun) { const [u, v, r, col] = o.sun, R = r * w; const sg = c.createRadialGradient(u * w, v * h, 0, u * w, v * h, R * 3); sg.addColorStop(0, rgba(col, .6)); sg.addColorStop(1, rgba(col, 0)); c.fillStyle = sg; c.fillRect(0, 0, w, h); c.fillStyle = col; circ(c, u * w, v * h, R); c.fill(); }
  if (o.planet) { const [u, v, r, col] = o.planet, R = r * w, x = u * w, y = v * h; const pg = c.createRadialGradient(x - R * .4, y - R * .4, R * .1, x, y, R); pg.addColorStop(0, '#bfe6ff'); pg.addColorStop(.6, col); pg.addColorStop(1, '#1d3f7a'); c.fillStyle = pg; circ(c, x, y, R); c.fill(); c.fillStyle = 'rgba(120,200,120,.5)'; ell(c, x - R * .2, y, R * .35, R * .2, .4); c.fill(); }
  if (o.extra) o.extra(c, w, h);
  (o.far || []).forEach(([col, base, amp, f, ph]) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 6) { const u = x / w; c.lineTo(x, (base + amp * Math.sin(u * f + ph) + amp * .4 * Math.sin(u * f * 2.7 + ph * 2)) * h); } c.lineTo(w, h); c.fill(); });
  for (let i = 0; i < (o.clouds || 0); i++) { const x = hash(i + 9) * w, y = (.06 + hash(i + 3) * .3) * h, k = (.6 + hash(i) * .8) * w / 960; c.fillStyle = o.cloudCol || 'rgba(255,255,255,.72)'; [[0, 0, 40, 12], [26, -8, 26, 12], [-22, -4, 22, 10]].forEach(([dx, dy, rx, ry]) => { ell(c, x + dx * k, y + dy * k, rx * k, ry * k); c.fill(); }); }
}


/* ---------- 연출용 그림 ---------- */
// 보급 비행기: 통통한 화물기, 돌아가는 프로펠러, 배에 보급 표시
function drawPlane(c, x, y, dir, t) {
  c.save(); c.translate(x, y + Math.sin(t * 3) * 3); c.scale(dir, 1);
  const OUT = '#2a2140'; c.lineJoin = 'round'; c.strokeStyle = OUT; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(-50, -6); c.lineTo(-62, -26); c.lineTo(-48, -26); c.lineTo(-36, -8); c.closePath(); c.fillStyle = '#d9480f'; c.fill(); c.stroke();
  c.beginPath(); c.ellipse(0, 0, 54, 15, 0, 0, Math.PI * 2); const g = c.createLinearGradient(0, -15, 0, 15); g.addColorStop(0, '#f1f3f5'); g.addColorStop(1, '#adb5bd'); c.fillStyle = g; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-10, 2); c.lineTo(18, 2); c.lineTo(4, 26); c.lineTo(-22, 26); c.closePath(); c.fillStyle = '#e8590c'; c.fill(); c.stroke();
  c.beginPath(); c.ellipse(32, -5, 11, 6, 0, 0, Math.PI * 2); c.fillStyle = '#74c0fc'; c.fill(); c.stroke();
  c.fillStyle = '#2b8a3e'; c.fillRect(-26, -6, 14, 12); c.fillStyle = '#fff'; c.fillRect(-21, -4, 4, 8); c.fillRect(-23, -2, 8, 4);
  c.fillStyle = '#495057'; c.fillRect(52, -3, 6, 6); const p = Math.sin(t * 40) * 16; c.fillStyle = 'rgba(60,60,70,.6)'; c.fillRect(57, -Math.abs(p) - 2, 3, Math.abs(p) * 2 + 4);
  c.restore();
}
// 보급 상자: 나무 상자 + 아이템 그림, 내려오는 동안 낙하산
function drawCrate(c, cr, t) {
  const x = cr.x, y = cr.y, sway = cr.para && !cr.landed ? Math.sin(t * 2.4 + cr.id) * .12 : 0;
  c.save(); c.translate(x, y); c.rotate(sway);
  if (cr.para && !cr.landed) {
    c.strokeStyle = 'rgba(60,50,40,.8)'; c.lineWidth = 1.2; c.beginPath(); [-24, -8, 8, 24].forEach(dx => { c.moveTo(dx, -54); c.lineTo(dx * .4, -24); }); c.stroke();
    c.beginPath(); c.moveTo(-28, -54); c.quadraticCurveTo(0, -88, 28, -54); c.quadraticCurveTo(14, -60, 0, -54); c.quadraticCurveTo(-14, -60, -28, -54); c.closePath();
    const g = c.createLinearGradient(-28, 0, 28, 0); g.addColorStop(0, '#fa5252'); g.addColorStop(.5, '#fff5f5'); g.addColorStop(1, '#fa5252'); c.fillStyle = g; c.fill(); c.strokeStyle = '#2a2140'; c.lineWidth = 2; c.stroke();
  }
  const bob = cr.landed ? Math.sin(t * 3 + cr.id) * 1.5 : 0;
  c.translate(0, bob);
  c.fillStyle = '#b07a3c'; c.strokeStyle = '#2a2140'; c.lineWidth = 2.2; c.beginPath(); c.rect(-13, -26, 26, 26); c.fill(); c.stroke();
  c.strokeStyle = '#7a4f22'; c.lineWidth = 2; c.beginPath(); c.moveTo(-13, -26); c.lineTo(13, 0); c.moveTo(13, -26); c.lineTo(-13, 0); c.stroke();
  if (typeof drawItemIcon === 'function') { c.save(); c.translate(0, -13); c.scale(.3, .3); drawItemIcon(c, cr.item, t, true); c.restore(); }
  if (cr.landed) { c.globalAlpha = .55 + .45 * Math.sin(t * 5); c.fillStyle = '#ffe066'; c.font = '700 12px Jua, sans-serif'; c.textAlign = 'center'; c.fillText('보급품', 0, -32); }
  c.restore();
}

function drawUFO(c, x, y, t, glow) {
  c.save(); c.translate(x, y);
  if (glow) { const g = c.createRadialGradient(0, 14, 2, 0, 14, 60 * glow); g.addColorStop(0, 'rgba(160,250,255,.9)'); g.addColorStop(1, 'rgba(47,224,255,0)'); c.fillStyle = g; circ(c, 0, 14, 60 * glow); c.fill(); }
  ell(c, 0, -8, 22, 18); fs(c, vg(c, -26, 4, 'rgba(220,255,255,.95)', 'rgba(60,200,230,.85)'), 2.5);
  c.fillStyle = 'rgba(255,255,255,.7)'; ell(c, -7, -16, 6, 3, -.4); c.fill();
  ell(c, 0, 4, 52, 13); fs(c, vg(c, -9, 17, '#f2f5fa', '#a6b0c0', '#5d6878'), 2.8);
  ell(c, 0, 12, 22, 5); fs(c, '#4c5563', 2);
  for (let i = 0; i < 7; i++) { const a = -Math.PI * .9 + i * Math.PI * .3 / 1, px = Math.cos(i / 7 * TAU + t * 3) * 44, on = Math.sin(i / 7 * TAU + t * 3) > 0; if (!on) continue; circ(c, px, 6, 3); c.fillStyle = ['#ff5d5d', '#ffd34d', '#7fe36b', '#2fe0ff'][i % 4]; c.fill(); }
  c.restore();
}
// 회오리·불기둥 기둥은 맵 위아래로 이어지되, 땅이 있는 곳에는 그리지 않는다 (빈 곳만 잘라서 그림)
function clipAirColumn(c, solid, x, bottom, half) {
  c.beginPath();
  for (let xx = x - half; xx < x + half; xx += 8) { let st = null; for (let y = 0; y <= bottom + 2; y += 2) { const air = y <= bottom && !solid(xx + 4, y); if (air && st == null) st = y; if (!air && st != null) { c.rect(xx, st, 8, y - st); st = null; } } if (st != null) c.rect(xx, st, 8, bottom + 2 - st); }
  c.clip();
}
function drawTornado(c, x, gy, H, t, a = 1, col = '230,236,240') {
  c.save(); c.globalAlpha = a;
  const n = Math.max(14, Math.round(H / 14));
  // 기둥 몸통: 불기둥처럼 위아래 폭이 같은 반투명 띠
  const band = c.createLinearGradient(x - 28, 0, x + 28, 0); band.addColorStop(0, `rgba(${col},0)`); band.addColorStop(.3, `rgba(${col},.35)`); band.addColorStop(.5, `rgba(${col},.5)`); band.addColorStop(.7, `rgba(${col},.35)`); band.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = band; c.fillRect(x - 28, gy - H, 56, H);
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), y = gy - k * H, r = (k < .04 ? 16 : 24) + Math.sin(t * 9 + i) * 2, sx = x + Math.sin(t * 4 + k * 5) * 4;
    c.beginPath(); c.ellipse(sx, y, r, 6, 0, t * 10 + i, t * 10 + i + 4.4); c.strokeStyle = `rgba(${col},${.55 + .3 * Math.sin(i * 1.7)})`; c.lineWidth = 3.5; c.stroke();
  }
  for (let i = 0; i < 8; i++) { const p = (t * 1.3 + i / 8) % 1, ang = t * 12 + i * 2, r = 20; c.fillStyle = `rgba(140,110,80,${(1 - p) * .9})`; c.fillRect(x + Math.cos(ang) * r, gy - p * H * .8, 3, 3); }
  c.restore();
}
function drawPillar(c, x, gy, H, t, a = 1) {
  c.save(); c.globalAlpha = a;
  const g = c.createLinearGradient(x - 18, 0, x + 18, 0); g.addColorStop(0, 'rgba(255,90,30,0)'); g.addColorStop(.3, 'rgba(255,120,40,.85)'); g.addColorStop(.5, 'rgba(255,240,170,.95)'); g.addColorStop(.7, 'rgba(255,120,40,.85)'); g.addColorStop(1, 'rgba(255,90,30,0)');
  c.fillStyle = g; c.beginPath(); c.moveTo(x - 18, gy);
  for (let y = gy; y >= gy - H; y -= 8) c.lineTo(x - 14 - Math.sin(y * .08 + t * 14) * 5, y);
  c.lineTo(x, gy - H - 16); for (let y = gy - H; y <= gy; y += 8) c.lineTo(x + 14 + Math.sin(y * .08 + t * 14 + 1) * 5, y); c.closePath(); c.fill();
  c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 8; i++) { const p = (t * 1.5 + i / 8) % 1; puff(c, x + Math.sin(i * 3 + t * 5) * 10, gy - p * H, 6 + p * 8, '255,160,60', (1 - p) * .5); }
  c.restore();
}
function drawBolt(c, x0, y0, x1, y1, seed, a) {
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  const pts = [[x0, y0]]; for (let i = 1; i < 8; i++) { const k = i / 8; pts.push([lerp(x0, x1, k) + (hash(seed + i) - .5) * 30, lerp(y0, y1, k)]); } pts.push([x1, y1]);
  [[10, `rgba(160,200,255,${.35 * a})`], [5, `rgba(220,240,255,${.8 * a})`], [2, `rgba(255,255,255,${a})`]].forEach(([lw, col]) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); });
  c.restore();
}
function drawStormCloud(c, x, y, s, t, a) {
  c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(s, s);
  c.beginPath(); [[-40, 4, 20], [-18, -8, 26], [10, -10, 24], [36, 2, 20], [0, 8, 24]].forEach(([px, py, r]) => { c.moveTo(px + r, py); c.arc(px, py, r, 0, TAU); });
  c.strokeStyle = OUT; c.lineWidth = 6; c.stroke(); c.fillStyle = '#5c5f7a'; c.fill(); c.save(); c.clip(); c.fillStyle = '#3c3e56'; c.fillRect(-70, 8, 140, 30); c.restore();
  c.restore();
}
function drawGiantShroom(c, x, gy, k, t, burst) {
  if (k <= 0) return;
  c.save(); c.translate(x, gy); c.scale(k, k);
  rr(c, -12, -96, 24, 98, 10); fs(c, vg(c, -96, 0, '#fff6e6', '#d6c4a8'), 3);
  if (!burst) {
    c.beginPath(); c.moveTo(-64, -88); c.bezierCurveTo(-64, -150, 64, -150, 64, -88); c.quadraticCurveTo(0, -100, -64, -88); c.closePath();
    fs(c, vg(c, -140, -88, '#d79bff', '#9b4dca', '#5e1f8f'), 3.2);
    [[-30, -118, 9], [6, -130, 10], [34, -108, 7], [-46, -98, 6]].forEach(([px, py, r]) => { circ(c, px, py, r); c.fillStyle = '#b6f36a'; c.fill(); });
    eyes(c, { er: 7, eyes: [[-12, -70], [10, -70]], c: { main: '#efe0c8' }, seed: 0 }, { mood: 'focus', t });
  }
  c.restore();
}
function drawWhale(c, x, y, rot, s) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  c.beginPath(); c.moveTo(-50, 0); c.bezierCurveTo(-46, -30, 20, -36, 46, -12); c.bezierCurveTo(56, 0, 40, 18, 0, 16); c.bezierCurveTo(-30, 16, -44, 10, -50, 0); c.closePath(); fs(c, vg(c, -30, 16, '#a6e6f0', '#48aec4', '#256f86'), 3);
  c.beginPath(); c.moveTo(-48, 0); c.quadraticCurveTo(-66, -4, -78, -20); c.quadraticCurveTo(-70, -2, -82, 10); c.quadraticCurveTo(-64, 6, -48, 4); fs(c, '#48aec4', 2.5);
  c.fillStyle = '#e4f7f9'; ell(c, 10, 8, 30, 7); c.fill();
  circ(c, 30, -8, 4); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke(); circ(c, 31, -8, 2.2); c.fillStyle = OUT; c.fill();
  c.restore();
}


const SPECIALS = {
  ufo: { // 레이저로봇: 우주선이 내려와 수직 레이저
    step(W, s, dt) {
      if (s.t >= 1.45 && !s.fired) {
        s.fired = true; const r = s.sh.cr * s.k / 2;
        W.carveRect(s.x - r, 0, r * 2, s.gy + 70);
        W.hurtArea(s.x, s.gy - 20, s.sh.r * s.k, s.sh.dmg * s.k, s.owner, { columnW: r + 14 });
        W.boomAt(s.sh, s.x, s.gy, s.k); W.shake += .7;
      }
      return s.t < 2.7;
    },
    draw(c, W, s) {
      const t = s.t, y = t < .9 ? lerp(-80, 46, ease(t / .9)) : t < 2 ? 46 + Math.sin(t * 5) * 2 : 46 - (t - 2) * 300;
      const x = s.x + (t > 2 ? (t - 2) * 120 : 0);
      if (t > .9 && t < 1.45) { const k = (t - .9) / .55; c.strokeStyle = `rgba(47,224,255,${.4 + .4 * Math.sin(t * 30)})`; c.lineWidth = 2; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(s.x, y + 16); c.lineTo(s.x, s.gy); c.stroke(); c.setLineDash([]); c.strokeStyle = '#ff4d4d'; c.lineWidth = 2.5; ell(c, s.x, s.gy, 30 * (1.4 - k * .5), 8); c.stroke(); }
      if (t >= 1.45 && t < 2.05) { const p = (t - 1.45) / .6, bw = (s.sh.cr * s.k / 2 + 6) * Math.sin(Math.min(1, p * 1.3) * Math.PI) + 4;
        const g = c.createLinearGradient(s.x - bw, 0, s.x + bw, 0); g.addColorStop(0, 'rgba(47,224,255,0)'); g.addColorStop(.25, 'rgba(47,224,255,.9)'); g.addColorStop(.5, '#ffffff'); g.addColorStop(.75, 'rgba(47,224,255,.9)'); g.addColorStop(1, 'rgba(47,224,255,0)');
        c.fillStyle = g; c.fillRect(s.x - bw, y + 14, bw * 2, s.gy + 70 - y); }
      drawUFO(c, x, y, t, t > .9 && t < 2.05 ? Math.min(1, (t - .9) * 2) : 0);
    },
  },
  meteor: { // 망치: 신호탄 자리에 운석 낙하
    step(W, s, dt) {
      if (s.t >= 1.15 && !s.fired) { s.fired = true; W.carveRound(s.x, s.gy, s.sh.cr * s.k); W.hurtArea(s.x, s.gy - 10, s.sh.r * s.k, s.sh.dmg * s.k, s.owner); W.boomAt(s.sh, s.x, s.gy, s.k * 1.2); W.debris(s.x, s.gy, 26, 1.6); W.shake += 1.1; }
      return s.t < 2;
    },
    draw(c, W, s) {
      const t = s.t; W.dim = Math.max(W.dim, t < 1.5 ? Math.min(.35, t * .8) : Math.max(0, .35 - (t - 1.5)));
      if (t < 1.15) { const u = Math.max(0, (t - .2) / .95) ** 1.6, x = lerp(s.x - 320 * s.side, s.x, u), y = lerp(-120, s.gy, u);
        for (let i = 1; i < 14; i++) { const uu = Math.max(0, u - i * .03); c.save(); c.globalCompositeOperation = 'lighter'; puff(c, lerp(s.x - 320 * s.side, s.x, uu), lerp(-120, s.gy, uu), 18 - i, i < 5 ? '255,220,120' : '255,110,40', .5 * (1 - i / 14)); c.restore(); }
        c.save(); c.translate(x, y); c.scale(2.2, 2.2); drawShell(c, { key: 'meteor' }, t, Math.atan2(s.gy + 120, 320 * s.side)); c.restore();
        if (t < .6) { c.strokeStyle = '#ff4d4d'; c.lineWidth = 2.5; ell(c, s.x, s.gy, 34, 9); c.stroke(); } }
    },
  },
  erupt: { // 두더지: 땅속 폭발 후 분출
    step(W, s, dt) {
      W.shake = Math.max(W.shake, s.t < .7 ? .25 : 0);
      if (s.t >= .7 && !s.fired) { s.fired = true; W.carveRound(s.x, s.y, s.sh.cr * s.k); const top = W.ground(s.x, 0); if (top < s.y) W.carveRect(s.x - 12, top - 4, 24, s.y - top + 4);
        W.hurtArea(s.x, Math.min(s.y, top + 10), s.sh.r * s.k, s.sh.dmg * s.k, s.owner, { tall: s.y - top }); W.boomAt(s.sh, s.x, top + 6, s.k); W.debris(s.x, top, 30, 2); W.shake += .8; }
      return s.t < 1.6;
    },
    draw(c, W, s) { if (s.t < .7) { const top = W.ground(s.x, 0), k = s.t / .7; c.strokeStyle = `rgba(40,20,10,${.4 + k * .5})`; c.lineWidth = 2; [-1, 1].forEach(d => { c.beginPath(); c.moveTo(s.x, top + 2); for (let j = 1; j <= 4; j++) c.lineTo(s.x + d * j * 10 * k, top + 2 + (j % 2 ? 5 : 0)); c.stroke(); }); } },
  },
  tornado: { // 구름열차: 회오리가 땅을 따라 이동
    step(W, s, dt) {
      if (s.t < 2.6) { s.x += s.dir * 130 * dt; s.gy = W.ground(s.x, 0); }
      W.tanks.forEach(t => { if (t.dead || s.hit.has(t)) return; if (Math.abs(t.x - s.x) < 34 && t.y > s.gy - 150) { s.hit.add(t); W.damage(t, s.sh.dmg * s.k, s.owner); t.vy = -420; t.vx = s.dir * 190; t.air = true; } });
      return s.t < 3;
    },
    draw(c, W, s) { const a = Math.min(1, s.t * 3, (3 - s.t) * 2); drawTornado(c, s.x, s.gy, 150, s.t, a); },
  },
  storm: { // 자석포: 먹구름에서 번개 5발
    step(W, s, dt) {
      [.45, .65, .85, 1.05, 1.25].forEach((tt, i) => { if (s.t >= tt && !s.done[i]) { s.done[i] = true; const x = s.x + [-50, 30, -15, 55, 0][i], gy = W.ground(x, 0); s.flash[i] = { x, gy, t: s.t }; W.carveRound(x, gy, 16 * s.k); W.hurtArea(x, gy - 10, 30, s.sh.dmg * s.k / 4.2, s.owner); W.boomAt({ boom: 'electric', R: 18, color: '#b98cff' }, x, gy, 1); W.shake += .25; } });
      return s.t < 1.8;
    },
    draw(c, W, s) { const a = Math.min(1, s.t * 3, (1.8 - s.t) * 3); drawStormCloud(c, s.x, 40, 1.3, s.t, a); s.flash.forEach((f, i) => { if (f && s.t - f.t < .18) drawBolt(c, s.x + (i - 2) * 14, 60, f.x, f.gy, i * 13 + Math.floor(s.t * 30), 1 - (s.t - f.t) / .18); }); },
  },
  shroom: { // 버섯포: 거대 독버섯이 자라 터지며 독 안개
    step(W, s, dt) {
      if (s.t >= .85 && !s.fired) { s.fired = true; W.carveRound(s.x, s.gy, s.sh.cr * s.k); W.hurtArea(s.x, s.gy - 30, s.sh.r * s.k, s.sh.dmg * s.k, s.owner); W.boomAt({ boom: 'toxic', R: 50 }, s.x, s.gy - 60, s.k); W.zones.push({ type: 'poison', x: s.x, r: 80, turns: 3, dmg: 80, born: W.clock }); W.shake += .4; }
      return s.t < 1.5;
    },
    draw(c, W, s) { const k = ease(s.t / .7) * (s.t > .85 ? Math.max(0, 1 - (s.t - .85) * 2) : 1); drawGiantShroom(c, s.x, s.gy + 4, k, s.t, s.t > .85); },
  },
  wave: { // 얼음고래: 해일이 밀려가고 고래가 뛰어오른다
    step(W, s, dt) {
      if (!s.fired) { s.fired = true; W.carveRound(s.x, s.gy, s.sh.cr * s.k); W.hurtArea(s.x, s.gy - 10, s.sh.r * s.k, s.sh.dmg * s.k * .75, s.owner); W.boomAt(s.sh, s.x, s.gy, s.k); }
      s.wx += s.dir * 230 * dt;
      W.tanks.forEach(t => { if (t.dead || s.hit.has(t) || t === s.owner) return; if (Math.abs(t.x - s.wx) < 30) { s.hit.add(t); W.damage(t, s.sh.dmg * s.k * .25, s.owner); t.vx = s.dir * 240; t.vy = -260; t.air = true; } });
      return s.t < 1.9;
    },
    draw(c, W, s) {
      const a = Math.min(1, (1.9 - s.t) * 2), H = 80 * (1 - s.t / 2.2);
      c.save(); c.globalAlpha = a;
      const x0 = s.x, x1 = s.wx, gy = W.ground(s.wx, 0);
      c.beginPath(); c.moveTo(x0, W.ground(x0, 0)); for (let x = x0; s.dir > 0 ? x <= x1 : x >= x1; x += s.dir * 6) { const k = Math.abs(x - x0) / Math.max(1, Math.abs(x1 - x0)); c.lineTo(x, W.ground(x, 0) - H * k * k - Math.sin(x * .08 + s.t * 10) * 4); }
      c.lineTo(x1 + s.dir * 18, gy - H * .6); c.quadraticCurveTo(x1 + s.dir * 30, gy - H, x1 + s.dir * 6, gy - H - 6); c.lineTo(x1, gy); c.closePath();
      fs(c, vg(c, gy - H, gy, 'rgba(220,250,255,.95)', 'rgba(80,180,230,.85)', 'rgba(30,110,170,.85)'), 2.5); c.restore();
      if (s.t > .2 && s.t < 1.2) { const p = (s.t - .2) / 1; drawWhale(c, s.x + s.dir * (20 + p * 120), s.gy - Math.sin(p * Math.PI) * 120, s.dir * (-.9 + p * 1.8), s.dir); }
    },
  },
  phoenix: { // 불꽃벌: 착탄 후 불기둥
    step(W, s) { return s.t < 1; },
    draw(c, W, s) { drawPillar(c, s.x, s.gy, 140 * ease(s.t / .3), s.t, Math.min(1, (1 - s.t) * 3)); },
  },
};


/* ---------- 지형 그림 굽기: 재질 격자 → 질감 있는 그림 ---------- */
function bakeTerrain(mapId, grid, w, h, bgrid) {
  const P = palette(MAPS[mapId]), fg = new ImageData(w, h), bk = new ImageData(w, h), st = new ImageData(w, h), out = [0, 0, 0];
  for (let x = 0; x < w; x++) {
    let d = 0, prev = false;
    for (let y = 0; y < h; y++) {
      const m = grid[y * w + x], i = (y * w + x) * 4;
      if (!m) { prev = false; continue; }
      d = prev ? d + 1 : 0; prev = true;
      const mat = MAT[m]; shadeMat(mat, d, x, y, P, out);
      if (mat === 'leaf' || mat === 'wood') prev = false; // 나무 아래 흙은 나무와 상관없이 지면부터 깊이를 센다
      fg.data[i] = out[0]; fg.data[i + 1] = out[1]; fg.data[i + 2] = out[2]; fg.data[i + 3] = 255;
      if (mat !== 'leaf' && mat !== 'wood') { bk.data[i] = out[0] * .38 + 8; bk.data[i + 1] = out[1] * .36 + 6; bk.data[i + 2] = out[2] * .4 + 14; bk.data[i + 3] = 255; } // 나무는 부서지면 깨끗이 사라지게 뒷배경에서 뺀다
      if (mat === 'steel') { st.data[i] = out[0]; st.data[i + 1] = out[1]; st.data[i + 2] = out[2]; st.data[i + 3] = 255; }
    }
  }
  // 뒷배경(땅을 파면 보이는 어두운 벽)을 따로 정한 맵: 동굴·크레바스·창문 안쪽이 하늘이 아니라 어두운 벽으로 보인다
  if (bgrid) { bk.data.fill(0); for (let x = 0; x < w; x++) { let d = 0, prev = false; for (let y = 0; y < h; y++) { const m = bgrid[y * w + x], i = (y * w + x) * 4; if (!m) { prev = false; continue; } d = prev ? d + 1 : 0; prev = true; const mat = MAT[m]; if (mat === 'leaf' || mat === 'wood') continue; shadeMat(mat, d, x, y, P, out); bk.data[i] = out[0] * .38 + 8; bk.data[i + 1] = out[1] * .36 + 6; bk.data[i + 2] = out[2] * .4 + 14; bk.data[i + 3] = 255; } } }
  const cv = img => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(img, 0, 0); return c; };
  return { fg: cv(fg), back: cv(bk), steel: cv(st) };
}

// 바람 게이지: 가운데에서 바람 부는 쪽으로 칸이 찬다 (한 칸 = 세기 1, 최대 20칸). 노랑 → 빨강
function windBar(c, x, y, str, ang, k = 1) {
  const n = 20, seg = 5 * k, gap = 1.6 * k, half = n * (seg + gap) + 6 * k, H = 14 * k, dir = Math.cos((ang || 0) * Math.PI / 180) < 0 ? -1 : 1;
  c.save(); c.translate(x, y);
  c.beginPath(); if (c.roundRect) c.roundRect(-half - 10 * k, -H / 2 - 8 * k, (half + 10 * k) * 2, H + 16 * k, 10 * k); else c.rect(-half - 10 * k, -H / 2 - 8 * k, (half + 10 * k) * 2, H + 16 * k);
  c.fillStyle = 'rgba(20,30,60,.82)'; c.fill(); c.strokeStyle = 'rgba(244,239,225,.35)'; c.lineWidth = 1.5; c.stroke();
  for (let side = -1; side <= 1; side += 2) for (let i = 0; i < n; i++) {
    const on = str > 0 && side === dir && i < str, px = side > 0 ? 4 * k + i * (seg + gap) : -4 * k - (i + 1) * (seg + gap) + gap;
    c.fillStyle = on ? `hsl(${50 - i / (n - 1) * 50}, 95%, ${58 - i / (n - 1) * 8}%)` : (i % 5 === 4 ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.1)');
    c.fillRect(px, -H / 2, seg, H);
  }
  c.fillStyle = 'rgba(244,239,225,.8)'; c.fillRect(-1, -H / 2 - 3 * k, 2, H + 6 * k);
  if (str > 0) { const tip = dir * (4 * k + str * (seg + gap) + 3 * k); c.fillStyle = `hsl(${50 - (str - 1) / (n - 1) * 50}, 95%, 55%)`; c.beginPath(); c.moveTo(tip + dir * 8 * k, 0); c.lineTo(tip, -H / 2 - 4 * k); c.lineTo(tip, H / 2 + 4 * k); c.closePath(); c.fill(); c.strokeStyle = '#2a2140'; c.lineWidth = 1.2; c.stroke(); }
  c.font = `${Math.round(15 * k)}px Jua, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = '#f4efe1';
  c.fillText(str > 0 ? (dir < 0 ? '◀ 바람 ' + str : '바람 ' + str + ' ▶') : '바람 없음', 0, H / 2 + 12 * k);
  c.restore();
}
export class Renderer {
  constructor(sim, o = {}) {
    this.sim = sim; this.w = sim.w; this.h = sim.h; this.labels = o.labels !== false; this.me = o.me;
    this.sky = document.createElement('canvas'); this.sky.width = this.w; this.sky.height = this.h; skyPaint(this.sky.getContext('2d'), this.w, this.h, sim.map.sky);
    this.rebuild();
    this.booms = []; this.floats = []; this.parts = []; this.splashes = []; this.shake = 0; this.dim = 0; this.banner = null; this.t = 0;
  }
  ground(x, from) { return this.sim.ground(x, from); }
  // 처음부터 다시 그리기: 기본 지형을 굽고 지금까지의 땅 파기를 다시 적용한다
  rebuild() {
    const b = bakeTerrain(this.sim.mapId, baseGrid(this.sim.mapId, this.w, this.h), this.w, this.h, backGrid(this.sim.mapId, this.w, this.h));
    this.fg = b.fg; this.back = b.back; this.steel = b.steel; this.fctx = this.fg.getContext('2d', { willReadFrequently: true });
    for (const op of this.sim.ops) this.carveVisual(op);
  }
  carveVisual(op) {
    const c = this.fctx; c.save();
    c.globalCompositeOperation = 'destination-out'; c.beginPath();
    let bx, by, bw, bh;
    if (op.k === 'rect') { c.rect(op.x, op.y, op.w, op.h); bx = op.x; by = op.y; bw = op.w; bh = op.h; }
    else { raggedPoly(op.x, op.y, op.r, op.ry).forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); bx = op.x - op.r; by = op.y - op.ry; bw = op.r * 2; bh = op.ry * 2; }
    c.fill();
    if (op.s) {
      c.globalCompositeOperation = 'source-atop';
      if (op.k === 'rect') { [[op.x - 12, op.x], [op.x + op.w + 12, op.x + op.w]].forEach(([a, b2]) => { const g = c.createLinearGradient(a, 0, b2, 0); g.addColorStop(0, 'rgba(38,20,10,0)'); g.addColorStop(1, 'rgba(38,20,10,.55)'); c.fillStyle = g; c.fillRect(Math.min(a, b2), op.y, 12, op.h); }); }
      else { c.translate(op.x, op.y); c.scale(1, op.ry / op.r); const g = c.createRadialGradient(0, 0, op.r * .85, 0, 0, op.r + 15); g.addColorStop(0, 'rgba(38,20,10,.62)'); g.addColorStop(.45, 'rgba(38,20,10,.28)'); g.addColorStop(1, 'rgba(38,20,10,0)'); c.fillStyle = g; c.fillRect(-op.r - 20, -op.r - 20, op.r * 2 + 40, op.r * 2 + 40); }
    }
    c.restore();
    c.drawImage(this.steel, bx - 20, by - 20, bw + 40, bh + 40, bx - 20, by - 20, bw + 40, bh + 40);
  }
  colorAt(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '#8a6040'; const d = this.fctx.getImageData(x | 0, y | 0, 1, 1).data; return d[3] > 40 ? `rgb(${d[0]},${d[1]},${d[2]})` : '#8a6040'; }
  debris(x, y, n, power = 1) { const col = this.colorAt(x, y + 4); for (let i = 0; i < n; i++) { const a = -Math.PI * (.12 + .76 * Math.random()), s = (90 + Math.random() * 220) * power; this.parts.push({ x, y: y - 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .9 + Math.random() * .7, col, size: 2 + Math.random() * 3.5 }); } }
  // 시뮬레이션이 쌓아 둔 화면 일 처리
  drain() {
    for (const f of this.sim.fxq) {
      this.onFx?.(f);
      if (f.type === 'carve') this.carveVisual(f.op);
      else if (f.type === 'boom') {
        const base = f.tankId ? SHELLS[f.tankId][f.slot] : { boom: f.kind || 'dirt', color: f.color };
        this.booms.push({ sh: { ...base, R: f.R || base.R || 24 }, x: f.x, y: f.y, t0: this.t });
        if (f.debris) this.debris(f.x, f.y, f.debris, f.power || (.7 + f.debris / 60));
        if (f.shake) this.shake += f.shake;
      }
      else if (f.type === 'float') this.floats.push({ x: f.x, y: f.y, s: f.text, c: f.color, life: 1.3 });
      else if (f.type === 'splash') this.splashes.push({ x: f.x, t0: this.t });
      else if (f.type === 'banner') this.banner = { text: f.text, t0: this.t };
      else if (f.type === 'shake') this.shake += f.v;
    }
    this.sim.fxq.length = 0;
  }
  update(dt) {
    this.t += dt; this.shake = Math.max(0, this.shake - dt * 1.6); this.dim = Math.max(0, this.dim - dt);
    this.drain();
    this.booms = this.booms.filter(b => this.t - b.t0 < .8);
    this.splashes = this.splashes.filter(s => this.t - s.t0 < 1);
    this.parts.forEach(p => { p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (this.sim.solid(p.x, p.y) && p.vy > 0) { p.vy *= -.25; p.vx *= .5; } });
    this.parts = this.parts.filter(p => p.life > 0);
    this.floats.forEach(f => { f.y -= 30 * dt; f.life -= dt; }); this.floats = this.floats.filter(f => f.life > 0);
  }
  draw(c, o = {}) {
    const S = this.sim, clock = S.clock;
    const sx = this.shake ? (hash(Math.floor(this.t * 60)) - .5) * this.shake * 12 : 0, sy = this.shake ? (hash(Math.floor(this.t * 60) + 7) - .5) * this.shake * 12 : 0;
    const cam = o.cam || { x: 0, y: 0 };
    c.save(); c.drawImage(this.sky, cam.x * .5, cam.y * .5, this.w, this.h); c.translate(sx, sy); // 하늘은 절반 속도로 움직여 깊이감을 준다
    c.drawImage(this.fg, 0, 0, this.w, this.h); // 파인 곳은 땅이 아예 없어지고 뒤의 배경(하늘)이 보인다 this.drawLiquid(c); // 물(서든데스에 차오르는 물 포함)은 땅 위에 그려야 잠긴 곳이 보인다
    S.zones.forEach(z => { const gy = S.ground(z.x, 0), a = Math.min(1, (clock - (z.born || 0)) * 2); if (z.type === 'poison') poisonFog(c, z.x, gy, z.r, this.t, a); else fireField(c, z.x, gy, z.r, this.t, a); if (this.labels) zoneLabel(c, z.x, gy - z.r - 20, (z.type === 'poison' ? '독 ' : '불 ') + z.turns + '턴', z.type === 'poison' ? '#d4a6ff' : '#ffb36b'); });
    S.events.forEach(e => this.drawEvent(c, e));
    (S.crates || []).forEach(cr => drawCrate(c, cr, this.t));
    S.tanks.forEach(t => this.drawTank(c, t, o));
    S.shells.forEach(s => {
      // 순간이동탄은 탱크와 상관없이 같은 보라색 차원문 구슬로 그린다
      if (s.teleport) { drawWarpShell(c, s.x, s.y, this.t, Math.atan2(s.vy, s.vx), s.trail.slice(1)); if (s.y < 0) { c.fillStyle = '#7b2fbf'; c.beginPath(); c.moveTo(s.x, 4); c.lineTo(s.x - 6, 14); c.lineTo(s.x + 6, 14); c.fill(); } return; }
      if (s.sh.shape === 'line') { c.save(); c.lineCap = 'round'; c.strokeStyle = 'rgba(47,224,255,.55)'; c.lineWidth = 10; c.beginPath(); c.moveTo(s.sx, s.sy); c.lineTo(s.x, s.y); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke(); c.restore(); return; }
      const art = SHELLS[s.tankId][s.slot];
      trail(c, art, s.trail.slice(1), this.t);
      // 강화된 탄(강화탄 아이템·불기둥 통과): 붉은 꼬리 하나만
      if (s.k > 1) drawPowerTrail(c, s.x, s.y, this.t, s.trail.slice(1));
      c.save(); c.translate(s.x, s.y); c.scale(.95, .95); drawShell(c, art, this.t, Math.atan2(s.vy, s.vx)); c.restore();
      if (s.y < 0) { c.fillStyle = '#c92a2a'; c.beginPath(); c.moveTo(s.x, 4); c.lineTo(s.x - 6, 14); c.lineTo(s.x + 6, 14); c.fill(); }
    });
    S.specials.forEach(s => SPECIALS[s.type]?.draw(c, this, s));
    this.booms.forEach(b => boom(c, b.sh, b.x, b.y, (this.t - b.t0) / .8));
    this.parts.forEach(p => { c.globalAlpha = Math.min(1, p.life * 2); c.fillStyle = p.col; c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }); c.globalAlpha = 1;
    this.floats.forEach(f => { c.save(); c.globalAlpha = Math.min(1, f.life); c.font = '20px Jua, sans-serif'; c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = '#fff8e8'; c.strokeText(f.s, f.x, f.y); c.fillStyle = f.c; c.fillText(f.s, f.x, f.y); c.restore(); });
    c.restore();
    if (this.dim > 0) { c.fillStyle = `rgba(20,8,20,${this.dim})`; c.fillRect(0, 0, this.w, this.h); }
    if (!o.cam) this.drawBanner(c, this.w, this.h);
  }
  drawBanner(c, vw, vh) {
    if (this.banner && this.t - this.banner.t0 < 1.8) { const p = (this.t - this.banner.t0) / 1.8, a = Math.min(1, p * 6, (1 - p) * 4); c.save(); c.globalAlpha = a; c.font = '30px Jua, sans-serif'; c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 7; c.strokeStyle = OUT; const y = vh * .3 - (1 - Math.min(1, p * 5)) * 20; c.strokeText(this.banner.text, vw / 2, y); c.fillStyle = '#ffd34d'; c.fillText(this.banner.text, vw / 2, y); c.restore(); }
  }
  drawLiquid(c) {
    const S = this.sim, L = S.map.liquid || (S.sdLiquid ? { type: 'water' } : null); if (!L || L.type === 'void' && !S.sdLiquid) return;
    const type = L.type === 'void' ? 'water' : L.type, y0 = S.liquidY, t = this.t;
    const cols = { water: ['rgba(120,200,240,.75)', 'rgba(30,90,160,.92)'], lava: ['rgba(255,190,70,.95)', 'rgba(170,40,20,.98)'], acid: ['rgba(170,240,90,.8)', 'rgba(60,120,40,.92)'] }[type];
    const g = c.createLinearGradient(0, y0, 0, this.h); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
    const wave = x => y0 + Math.sin(x * .04 + t * 2) * 3 + Math.sin(x * .11 - t * 3) * 1.5;
    c.fillStyle = g; c.beginPath(); c.moveTo(0, this.h); for (let x = 0; x <= this.w; x += 8) c.lineTo(x, wave(x)); c.lineTo(this.w, this.h); c.fill();
    c.strokeStyle = type === 'lava' ? 'rgba(255,240,170,.9)' : 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.beginPath(); for (let x = 0; x <= this.w; x += 8) x ? c.lineTo(x, wave(x)) : c.moveTo(x, wave(x)); c.stroke();
    if (type === 'lava') for (let i = 0; i < 8; i++) { const p = (t * .5 + i / 8) % 1; circ(c, hash(i) * this.w, y0 + 8 - p * 8, 3 + p * 4); c.fillStyle = `rgba(255,220,120,${1 - p})`; c.fill(); }
    this.splashes.forEach(s => { const p = t - s.t0; for (let i = 0; i < 8; i++) { const a = -Math.PI * (.2 + .6 * hash(i)), v = 120 + hash(i + 3) * 80; c.fillStyle = type === 'lava' ? 'rgba(255,170,60,.9)' : 'rgba(200,240,255,.9)'; circ(c, s.x + Math.cos(a) * v * p, y0 + Math.sin(a) * v * p + 300 * p * p, 3); c.fill(); } });
  }
  drawEvent(c, e) {
    const S = this.sim, t = this.t;
    if (e.type === 'supply') { drawPlane(c, Sim.planeX(S, e), PLANE_Y, e.dir, t); return; }
    if (e.type === 'tornado') { const gy = e.gy ?? S.colBottom(e.x); c.save(); clipAirColumn(c, (x, y) => S.solid(x, y), e.x, gy, 44); drawTornado(c, e.x, gy, gy + 20, t, Math.min(1, e.t * 2), '200,210,220'); c.restore(); } // 맨 아래부터 하늘 끝까지
    if (e.type === 'pillar') { const gy = e.gy ?? S.colBottom(e.x); c.save(); if (e.t >= 1) clipAirColumn(c, (x, y) => S.solid(x, y), e.x, gy, 40); if (e.t < 1) { const k = (e.t * 6) % 1 < .5; c.fillStyle = `rgba(255,120,40,${k ? .8 : .4})`; ell(c, e.x, gy, 22, 6); c.fill(); } else drawPillar(c, e.x, gy, (gy + 20) * ease((e.t - 1) / .3), t, 1);  c.restore(); }
    if (e.type === 'meteors') e.xs.forEach((x, i) => { const tt = .4 + i * .45, u = (e.t - tt) / .7; if (u < 0 || u > 1) return; const gy = S.ground(x, 0), px = lerp(x - 160, x, u), py = lerp(-40, gy, u); c.save(); c.translate(px, py); c.scale(1.2, 1.2); drawShell(c, { key: 'meteor' }, t, .8); c.restore(); });
    if (e.type === 'lightning') { const a = Math.min(1, e.t * 3, (1.3 - e.t) * 3); drawStormCloud(c, e.x, 46, 1, t, a); if (e.t > .7 && e.t < .9) drawBolt(c, e.x, 60, e.x, S.ground(e.x, 0), Math.floor(t * 30), 1 - (e.t - .7) / .2); }
  }
  drawTank(c, t, o) {
    if ((t.sunk && t.y > this.h + 10) || t.left) return;
    const S = this.sim, T = tankById(t.tankId); let st = 'idle', ph = null;
    if (t.dead) st = 'dead'; else if (S.clock - t.hitAt < .6) { st = 'hit'; ph = S.clock - t.hitAt; } else if (S.clock - t.firedAt < .5) { st = 'fire'; ph = S.clock - t.firedAt; } else if (t.moving || t.movingVis) st = 'move'; else if (t.hp <= t.max * .25) st = 'danger';
    // 몸체는 경사만큼 기울고, 포신은 '보이는 각도 = 몸체 각도 - 기울기'가 되도록 그린다
    if (t.powerUp && !t.dead) drawPowerBuff(c, t.x, t.y, this.t, false); // 강화탄을 쓰고 아직 안 쏜 탱크
    renderTank(c, this.w, this.h, T, st, this.t, t.x, t.y, S.ts, { flip: t.facing, angle: t.angle + (t.tilt || 0), tilt: (t.tilt || 0) * Math.PI / 180, phaseT: ph, noText: true });
    if (t.powerUp && !t.dead) drawPowerBuff(c, t.x, t.y, this.t, true);
    if (t.shield) { c.strokeStyle = 'rgba(160,220,255,.85)'; c.fillStyle = 'rgba(85,174,240,.15)'; c.lineWidth = 2.5; circ(c, t.x, t.y - 20, 32); c.fill(); c.stroke(); }
    if (t.frozen > 0) { c.save(); c.translate(t.x + 22, t.y - 40); c.scale(.7, .7); drawShell(c, { key: 'snowflake' }, this.t, 0); c.restore(); }
    if (t.dead || !this.labels) return;
    // 이름·체력은 탱크 아래, 지금 차례 탱크 위에는 크게 튀는 빨간 화살표
    const active = o.active === t.uid, top = t.y - (t.S.hover ? 74 : 60), col = t.team === 'red' ? '#d63c2a' : t.team === 'blue' ? '#1f6fae' : t.uid === this.me ? '#d63c2a' : '#3a2600';
    c.fillStyle = 'rgba(20,28,52,.65)'; c.fillRect(t.x - 23, t.y + 5, 46, 6);
    c.fillStyle = t.hp / t.max > .5 ? '#3fae4a' : t.hp / t.max > .25 ? '#f0a020' : '#d63c3c'; c.fillRect(t.x - 23, t.y + 5, 46 * t.hp / t.max, 6);
    c.textAlign = 'center'; c.font = `600 12px "Noto Sans KR", sans-serif`; c.lineJoin = 'round';
    c.lineWidth = 3.5; c.strokeStyle = 'rgba(255,248,232,.9)'; c.strokeText(t.name, t.x, t.y + 25); c.fillStyle = col; c.fillText(t.name, t.x, t.y + 25);
    if (t.powerUp) { const tw = c.measureText(t.name).width / 2 + 4; c.font = '700 11px "Noto Sans KR", sans-serif'; const bw = 34; c.fillStyle = '#e8352a'; c.beginPath(); if (c.roundRect) c.roundRect(t.x + tw, t.y + 15, bw, 14, 4); else c.rect(t.x + tw, t.y + 15, bw, 14); c.fill(); c.fillStyle = '#fff'; c.fillText('강화', t.x + tw + bw / 2, t.y + 26); }
    if (active) { const b = Math.abs(Math.sin(this.t * 5)) * 8, y = top - 6 - b; c.fillStyle = '#e8352a'; c.strokeStyle = 'rgba(40,10,10,.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(t.x, y); c.lineTo(t.x - 11, y - 12); c.lineTo(t.x - 4, y - 12); c.lineTo(t.x - 4, y - 26); c.lineTo(t.x + 4, y - 26); c.lineTo(t.x + 4, y - 12); c.lineTo(t.x + 11, y - 12); c.closePath(); c.fill(); c.stroke(); }
    if (t.uid === this.me && !active) { c.strokeStyle = 'rgba(255,183,3,.7)'; c.lineWidth = 2; ell(c, t.x, t.y + 2, 26, 6); c.stroke(); }
  }
  // 내 차례에 탱크 둘레에 발사 가능 각도(위·아래 한계)와 지금 각도를 보여 준다
  drawAimFan(c, t) {
    const [lo, hi] = this.sim.angleRange(t), [px, py] = this.sim.pivotPos(t), R = 46, f = t.facing, rad = d => d * Math.PI / 180;
    const pt = (d, r) => [px + Math.cos(rad(d)) * r * f, py - Math.sin(rad(d)) * r];
    c.save();
    c.beginPath(); c.moveTo(px, py); for (let d = lo; d <= hi + .01; d += 2) c.lineTo(...pt(Math.min(d, hi), R)); c.closePath();
    c.fillStyle = 'rgba(127,208,108,.16)'; c.fill();
    c.beginPath(); for (let d = lo; d <= hi + .01; d += 2) { const [x, y] = pt(Math.min(d, hi), R); d === lo ? c.moveTo(x, y) : c.lineTo(x, y); } c.strokeStyle = 'rgba(127,208,108,.85)'; c.lineWidth = 3; c.stroke();
    c.strokeStyle = '#ff4a3a'; c.lineWidth = 2.5; [lo, hi].forEach(d => { c.beginPath(); c.moveTo(...pt(d, 12)); c.lineTo(...pt(d, R + 8)); c.stroke(); }); // 최저·최고 한계선
    c.setLineDash([3, 5]); c.beginPath(); c.moveTo(...pt(0, 14)); c.lineTo(...pt(0, R + 10)); c.strokeStyle = 'rgba(36,29,46,.35)'; c.stroke(); c.setLineDash([]);
    const [ax, ay] = pt(t.angle, R + 12); c.strokeStyle = '#ffb703'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(...pt(t.angle, 18)); c.lineTo(ax, ay); c.stroke();
    c.font = '15px Jua, sans-serif'; c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = 'rgba(255,248,232,.9)'; const [tx, ty] = pt(t.angle, R + 26); c.strokeText(t.angle + '°', tx, ty + 5); c.fillStyle = '#3a2600'; c.fillText(t.angle + '°', tx, ty + 5);
    c.restore();
  }
  drawWind(c, x, y, r = 24) { const w = this.sim.wind; windBar(c, x, y, w.str, w.ang, r / 24); }
}
