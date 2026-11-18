/* 포탄대결 화면 목업: 화면 전환, 로비, 대기방, 연습 전투. 그림은 art.js를 쓴다. */

/* ---------- 작은 그림 (정지 화면) ---------- */
function paint(canvas, w, h, draw) {
  canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
  const c = canvas.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, w, h); draw(c);
}
function paintTanks(root) {
  root.querySelectorAll('canvas[data-tank]').forEach(cv => {
    const w = +cv.dataset.w || 96, h = +cv.dataset.h || 72, T = tankById(cv.dataset.tank);
    paint(cv, w, h, c => renderTank(c, w, h, T, 'idle', 1.3, w / 2, h - 6, (+cv.dataset.s || .6)));
  });
}
function paintIcons(root) {
  root.querySelectorAll('canvas[data-item]').forEach(cv => {
    const s = +cv.dataset.px || 40;
    paint(cv, s, s, c => { c.translate(s / 2, s / 2); c.scale(s / 64, s / 64); drawItemIcon(c, cv.dataset.item, 0, true); });
  });
}

/* ---------- 화면 전환 ---------- */
const views = ['login', 'lobby', 'room', 'game', 'result'];
let current = 'login';
function route() {
  const v = views.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'login';
  document.querySelectorAll('[data-view]').forEach(s => s.hidden = s.dataset.view !== v);
  document.querySelectorAll('.tabs a').forEach(a => { if (a.getAttribute('href') === '#' + v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  current = v;
}
addEventListener('hashchange', route);

/* ---------- 로그인 ---------- */
(function login() {
  const segL = document.getElementById('segLogin'), segJ = document.getElementById('segJoin'), btn = document.getElementById('loginBtn');
  const set = join => {
    segL.setAttribute('aria-pressed', !join); segJ.setAttribute('aria-pressed', join);
    document.querySelectorAll('[data-join]').forEach(e => e.hidden = !join);
    btn.textContent = join ? '가입하고 시작하기' : '로그인';
  };
  segL.onclick = () => set(false); segJ.onclick = () => set(true);
  document.getElementById('loginForm').addEventListener('submit', e => { e.preventDefault(); location.hash = 'lobby'; });
  const c = document.getElementById('loginBg'), g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 520);
  sky.addColorStop(0, '#1f2d52'); sky.addColorStop(.6, '#6a4f7a'); sky.addColorStop(1, '#e09a6a');
  g.fillStyle = sky; g.fillRect(0, 0, 1100, 520);
  g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(820, 330, 60, 0, 7); g.fill();
  const hills = (base, amp, f, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, 520);
    for (let x = 0; x <= 1100; x += 10) g.lineTo(x, base + amp * Math.sin(x / f) + amp * .5 * Math.sin(x / (f * .37) + 1));
    g.lineTo(1100, 520); g.fill(); };
  hills(380, 26, 130, '#4b3f6b'); hills(430, 22, 90, '#33335a'); hills(470, 16, 70, '#26365e');
  // 언덕 위 탱크 실루엣
  g.save(); g.globalAlpha = .9;
  [['hammer', 160, 412, .9, 1], ['mole', 300, 400, .8, 1], ['cloud', 930, 420, .8, -1], ['bee', 1010, 432, .75, -1]].forEach(([id, x, y, s, f]) => renderTank(g, 1100, 520, tankById(id), 'idle', 1, x, y, s, { flip: f }));
  g.restore();
})();

/* ---------- 로비 ---------- */
document.getElementById('lobbyChat').addEventListener('submit', e => {
  e.preventDefault(); const i = document.getElementById('lobbyMsg'); if (!i.value.trim()) return;
  const d = document.createElement('div'); d.innerHTML = '<b>포탄왕</b> '; d.append(i.value); document.getElementById('lobbyLog').append(d); i.value = '';
});

/* ---------- 대기방 ---------- */
let myTank = 'hammer';
const BAG = ['double', 'teleport', 'power', 'repair'];
const slotData = [
  { team: 'red', nick: '포탄왕', tank: 'hammer', me: true, host: true },
  { team: 'red', nick: '각도장인', tank: 'mole', ready: true },
  { team: 'red', nick: '민수', tank: 'whale', ready: true },
  { team: 'red', nick: '두더지러버', tank: 'bee' },
  { team: 'blue', nick: '바람읽는자', tank: 'laser', ready: true },
  { team: 'blue', nick: '지형파괴범', tank: 'shroom', ready: true },
  { team: 'blue', nick: '구름위산책', tank: 'cloud' }, { team: 'blue' },
];
function renderSlots() {
  const el = document.getElementById('slots');
  el.innerHTML = '<div class="team-label red">레드팀</div>' + slotData.slice(0, 4).map(slotHTML).join('') +
                 '<div class="team-label blue">블루팀</div>' + slotData.slice(4).map(slotHTML).join('');
  paintTanks(el);
}
function slotHTML(s) {
  if (!s.nick) return `<div class="slot empty ${s.team}">빈 자리</div>`;
  const T = tankById(s.me ? myTank : s.tank);
  const tag = s.host ? '<div class="host">방장</div>' : s.ready ? '<div class="ready">준비 완료</div>' : '<div class="tname">준비 중</div>';
  return `<div class="slot ${s.team} ${s.me ? 'me' : ''}"><canvas data-tank="${T.id}" data-w="96" data-h="80" data-s=".52" style="width:96px;height:80px"></canvas><div class="nick">${s.nick}</div><div class="tname">${T.name}</div>${tag}</div>`;
}
function renderPicker() {
  const el = document.getElementById('picker');
  el.innerHTML = TANKS.map(T => `<button class="pick" data-id="${T.id}" aria-pressed="${T.id === myTank}"><canvas data-tank="${T.id}" data-w="84" data-h="72" data-s=".46" style="width:84px;height:72px"></canvas><span>${T.name}</span></button>`).join('');
  paintTanks(el);
  const T = tankById(myTank), S = SHELLS[T.id];
  document.getElementById('tankInfo').innerHTML = `<p style="margin:0">${T.concept}</p><dl class="num">
    <dt>체력</dt><dd>${T.hp}</dd><dt>각도</dt><dd>${T.ang}</dd>
    <dt>주무기 1</dt><dd>${S[0].n} · 피해 ${S[0].d}</dd><dt>주무기 2</dt><dd>${S[1].n} · 피해 ${S[1].d}</dd>
    <dt>필살기 SS</dt><dd>${S[2].n} · 피해 ${S[2].d} (체력 50% 이하)</dd></dl>`;
}
document.getElementById('picker').addEventListener('click', e => {
  const b = e.target.closest('.pick'); if (!b) return;
  myTank = b.dataset.id; renderPicker(); renderSlots(); paintMe(); resetGame();
});
function renderRoomBag() {
  const el = document.getElementById('roomBag');
  el.innerHTML = BAG.map(id => { const it = itemById(id); return `<div class="item ${it.size === 2 ? 'w2' : ''}"><canvas data-item="${id}" style="width:40px;height:40px"></canvas><div><b>${it.n}</b><small>${it.size}칸</small></div></div>`; }).join('');
  paintIcons(el);
  document.getElementById('ownedItems').textContent = '보유 아이템: ' + ITEMS.map(i => i.n).join(', ') + ' · 클릭해서 칸에 넣기';
}
function paintMe() { const el = document.getElementById('meTank'); el.innerHTML = `<canvas data-tank="${myTank}" data-w="84" data-h="72" data-s=".46" style="width:84px;height:72px"></canvas>`; paintTanks(el); }

/* ---------- 연습 전투 ---------- */
const W = 960, H = 480, G = 380, SPEED = 5.6, WINDK = 14;
const cv = document.getElementById('field');
cv.width = W * DPR; cv.height = H * DPR;
const ctx = cv.getContext('2d');
const tc = document.createElement('canvas'); tc.width = W; tc.height = H;
const tctx = tc.getContext('2d', { willReadFrequently: true });
const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
const mask = new Uint8Array(W * H);

(function drawBg() {
  const g = bg.getContext('2d');
  const s = g.createLinearGradient(0, 0, 0, H);
  s.addColorStop(0, '#f2b880'); s.addColorStop(.55, '#f7d9a8'); s.addColorStop(1, '#f9e7c4');
  g.fillStyle = s; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff3d6'; g.beginPath(); g.arc(760, 120, 46, 0, 7); g.fill();
  g.fillStyle = 'rgba(190,120,90,.35)'; g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, 250 + 40 * Math.sin(x / 90) + 20 * Math.sin(x / 33));
  g.lineTo(W, H); g.fill();
  g.fillStyle = 'rgba(255,255,255,.7)';
  [[140, 70, 1], [420, 50, .8], [620, 90, 1.1]].forEach(([x, y, k]) => {
    g.beginPath(); g.ellipse(x, y, 40 * k, 12 * k, 0, 0, 7); g.ellipse(x + 26 * k, y - 8 * k, 26 * k, 12 * k, 0, 0, 7); g.fill();
  });
})();

function groundY(x) {
  const canyon = (x > 400 && x < 560) ? -90 * Math.sin((x - 400) / 160 * Math.PI) : 0;
  return 310 + 40 * Math.sin(x / 150 + .4) + 18 * Math.sin(x / 47 + 2) - canyon;
}
function buildTerrain() {
  tctx.globalCompositeOperation = 'source-over';
  tctx.clearRect(0, 0, W, H);
  const g = tctx.createLinearGradient(0, 220, 0, H);
  g.addColorStop(0, '#c98b4f'); g.addColorStop(1, '#7a4b2c');
  tctx.beginPath(); tctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 4) tctx.lineTo(x, groundY(x));
  tctx.lineTo(W, H); tctx.closePath(); tctx.fillStyle = g; tctx.fill();
  tctx.fillStyle = 'rgba(90,55,30,.35)';
  for (let i = 0; i < 40; i++) { const x = (i * 97) % W, y = groundY(x) + 30 + (i * 53) % 120; tctx.beginPath(); tctx.ellipse(x, y, 14, 6, 0, 0, 7); tctx.fill(); }
  tctx.beginPath(); for (let x = 0; x <= W; x += 4) { const y = groundY(x) + 2; x ? tctx.lineTo(x, y) : tctx.moveTo(x, y); }
  tctx.lineWidth = 8; tctx.strokeStyle = '#e8c27a'; tctx.stroke();
  refreshMask(0, 0, W, H);
}
function refreshMask(x0, y0, w, h) {
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  const x1 = Math.min(W, Math.ceil(x0 + w)), y1 = Math.min(H, Math.ceil(y0 + h));
  if (x1 <= x0 || y1 <= y0) return;
  const d = tctx.getImageData(x0, y0, x1 - x0, y1 - y0).data, rw = x1 - x0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * W + x] = d[((y - y0) * rw + (x - x0)) * 4 + 3] > 60 ? 1 : 0;
}
const solid = (x, y) => { x |= 0; y |= 0; return x >= 0 && x < W && y >= 0 && y < H && mask[y * W + x] === 1; };
function surfaceY(x, from) {
  for (let y = Math.max(0, from | 0); y < H; y++) if (solid(x, y) || solid(x - 7, y) || solid(x + 7, y)) return y;
  return H + 200;
}
function carve(path, bx, by, bw, bh, burn = true) {
  tctx.save();
  tctx.globalCompositeOperation = 'destination-out'; path(tctx); tctx.fill();
  if (burn) { tctx.globalCompositeOperation = 'source-atop'; tctx.strokeStyle = 'rgba(60,35,20,.55)'; tctx.lineWidth = 7; path(tctx, 3); tctx.stroke(); }
  tctx.restore();
  refreshMask(bx - 6, by - 6, bw + 12, bh + 12);
}
const carveCircle = (x, y, r, burn) => carve((c, e = 0) => { c.beginPath(); c.arc(x, y, r + e, 0, 7); }, x - r, y - r, r * 2, r * 2, burn);
const carveEllipse = (x, y, rx, ry) => carve((c, e = 0) => { c.beginPath(); c.ellipse(x, y, rx + e, ry + e, 0, 0, 7); }, x - rx, y - ry, rx * 2, ry * 2);
const carveRect = (x, y, w, h) => carve((c, e = 0) => { c.beginPath(); c.rect(x - e, y - e, w + e * 2, h + e * 2); }, x, y, w, h);

let tanks, me, foe, turn, phase, wind, power, charging, timeLeft, weapon, shells, booms, floats, pending, beams, zones, thinkT, boost, itemUsed, bagState, turnNo, clock = 0, teleportArmed, keys = {};
function makeTank(id, x, facing, team, name) {
  const T = tankById(id);
  return { T, name, team, x, y: 0, hp: T.hp, max: T.hp, angle: Math.min(Math.max(45, T.amin), T.amax), facing, fuel: 100, vy: 0, fallFrom: 0, firedAt: -9, hitAt: -9, moving: false, shield: false, frozen: 0, canMove: true, dead: false, lastPower: null };
}
function resetGame() {
  buildTerrain();
  me = makeTank(myTank, 170, 1, 'red', '포탄왕');
  foe = makeTank(myTank === 'laser' ? 'hammer' : 'laser', 800, -1, 'blue', '연습 상대');
  tanks = [me, foe];
  tanks.forEach(t => { t.y = surfaceY(t.x, 0); t.fallFrom = t.y; });
  shells = []; booms = []; floats = []; pending = []; beams = []; zones = [];
  power = 0; charging = false; weapon = 0; turnNo = 1; teleportArmed = false;
  bagState = BAG.map(() => false);
  document.getElementById('overlay').hidden = true;
  startTurn(me);
}
function startTurn(t) {
  turn = t; wind = Math.round((Math.random() * 2 - 1) * 10); t.fuel = 100; timeLeft = 20; boost = 1; itemUsed = false; t.doubleShot = false; t.shield = false;
  t.canMove = true;
  if (t.frozen > 0) { t.frozen--; t.canMove = false; floatText(t.x, t.y - 74, '얼어서 못 움직임', '#1f6fae'); }
  zones.forEach(z => { if (!t.dead && Math.abs(t.x - z.x) < z.r) { t.hp = Math.max(0, t.hp - z.dmg); t.hitAt = clock; floatText(t.x, t.y - 60, (z.type === 'burn' ? '화상 -' : '독 -') + z.dmg, '#c92a2a'); } z.turns--; });
  zones = zones.filter(z => z.turns > 0);
  phase = t === me ? 'aim' : 'think'; thinkT = 1.1;
  power = 0; charging = false; teleportArmed = false;
  renderItems(); renderWeapons();
}
function renderWeapons() {
  const S = SHELLS[me.T.id], ssOn = me.hp <= me.max / 2;
  document.getElementById('weapons').innerHTML = S.map((s, k) =>
    `<button data-w="${k}" aria-pressed="${weapon === k}" ${k === 2 && !ssOn ? 'disabled' : ''}><kbd>${k === 2 ? 'SS' : k + 1}</kbd>${s.n} <small>${s.d}</small></button>`).join('');
}
document.getElementById('weapons').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) { weapon = +b.dataset.w; renderWeapons(); } });
function renderItems() {
  let key = 0;
  const el = document.getElementById('gameItems');
  el.innerHTML = BAG.map((id, i) => {
    const it = itemById(id), k = 'QWERTY'[key]; key += it.size;
    return `<button class="item ${it.size === 2 ? 'w2' : ''}" data-i="${i}" ${bagState[i] || itemUsed || phase !== 'aim' ? 'disabled' : ''} title="${it.d}"><canvas data-item="${id}" style="width:36px;height:36px"></canvas><div><b><kbd>${k}</kbd> ${it.n}</b><small>${it.tip}</small></div></button>`;
  }).join('');
  paintIcons(el);
}
function useItem(i) {
  if (bagState[i] || itemUsed || phase !== 'aim') return;
  const it = itemById(BAG[i]); bagState[i] = true; itemUsed = true;
  ({ double: () => me.doubleShot = true, teleport: () => teleportArmed = true, power: () => boost = 1.3,
     repair: () => { me.hp = Math.min(me.max, me.hp + 250); floatText(me.x, me.y - 60, '+250', '#2f9e44'); },
     teamrepair: () => { me.hp = Math.min(me.max, me.hp + 150); floatText(me.x, me.y - 60, '+150', '#2f9e44'); },
     calm: () => wind = 0, shield: () => me.shield = true, fuel: () => me.fuel = 200 })[it.id]();
  floatText(me.x, me.y - 84, it.n, '#3a2600');
  renderItems();
}
document.getElementById('gameItems').addEventListener('click', e => { const b = e.target.closest('.item'); if (b && !b.disabled) useItem(+b.dataset.i); });

function muzzlePos(t) {
  const a = t.angle * Math.PI / 180, sc = .5, lift = t.T.hover ? -6 : 0;
  const px = t.x + t.T.pivot[0] * sc * t.facing, py = t.y + t.T.pivot[1] * sc + lift, L = t.T.len * sc + 4;
  return [px + Math.cos(a) * L * t.facing, py - Math.sin(a) * L];
}
function fire(t, slot, p) {
  const sh = SHELLS[t.T.id][slot]; t.firedAt = clock; t.lastPower = p;
  const mine = t === me, b = mine ? boost : 1, tele = mine && teleportArmed;
  const spawn = () => (sh.spread || [0]).forEach(da => {
    const a = (t.angle + da) * Math.PI / 180, v = sh.shape === 'line' ? 900 : p * SPEED;
    const [ox, oy] = muzzlePos(t);
    shells.push({ x: ox, y: oy, sx: ox, sy: oy, vx: Math.cos(a) * t.facing * v, vy: -Math.sin(a) * v, sh, owner: t, age: 0, trail: [], mode: 'fly', dug: 0, dist: 0, lastCarve: null, boost: b, teleport: tele });
  });
  spawn();
  if (t.doubleShot) pending.push({ at: .45, fn: spawn });
  phase = 'flying';
  renderItems();
}
function hitTankAt(s) { return tanks.find(t => !t.dead && (t !== s.owner || s.age > .25) && Math.hypot(t.x - s.x, t.y - 18 - s.y) < 20); }
function explode(s, x, y, skipCrater) {
  s.done = true;
  const sh = s.sh, k = s.boost || 1;
  if (!skipCrater) { if (sh.shape === 'ellipse') carveEllipse(x, y, sh.cr[0] * k, sh.cr[1] * k); else carveCircle(x, y, sh.cr * k); }
  booms.push({ sh: Object.assign({}, sh, { R: sh.R * k }), x, y, t0: clock });
  const R = sh.r * k + 12;
  tanks.forEach(t => {
    if (t.dead) return;
    const d = Math.hypot(t.x - x, t.y - 18 - y);
    if (d < R) {
      let dmg = Math.round(sh.dmg * k * (1 - .6 * Math.min(1, d / R)));
      if (t.shield) dmg = Math.round(dmg / 2);
      t.hp = Math.max(0, t.hp - dmg); t.hitAt = clock;
      floatText(t.x, t.y - 60, '-' + dmg, '#c92a2a');
      if (sh.fx === 'freeze') { t.frozen = 1; floatText(t.x, t.y - 84, '빙결!', '#1f6fae'); }
      if (sh.fx === 'push') { t.x = Math.max(14, Math.min(W - 14, t.x + (Math.sign(t.x - x) || 1) * 60)); t.y = Math.min(t.y, surfaceY(t.x, t.y - 40)); }
    }
  });
  if (sh.fx === 'burn') zones.push({ type: 'burn', x, r: 40, turns: 2, dmg: 60 });
  if (sh.fx === 'poison') zones.push({ type: 'poison', x, r: 60, turns: 3, dmg: 80 });
  if (s.teleport && s.owner === me && !me.dead && teleportArmed) {
    teleportArmed = false; me.x = Math.max(14, Math.min(W - 14, x)); me.y = surfaceY(me.x, Math.max(0, y - 80)); me.fallFrom = me.y; me.vy = 0;
    floatText(me.x, me.y - 70, '순간이동!', '#7b2fbf');
  }
}
function floatText(x, y, s, c) { floats.push({ x, y, s, c, life: 1.3 }); }

function aiShoot() {
  const dx = me.x - foe.x; foe.facing = Math.sign(dx) || -1;
  const S = SHELLS[foe.T.id]; let slot = Math.random() < .7 ? 0 : 1;
  const sh = S[slot];
  if (sh.shape === 'line') {
    const a = Math.atan2(foe.y - 20 - (me.y - 18), Math.abs(dx)) * 180 / Math.PI;
    foe.angle = Math.round(Math.max(foe.T.amin, Math.min(foe.T.amax, a)));
    return fire(foe, slot, 60);
  }
  const a = Math.min(foe.T.amax, Math.max(foe.T.amin, 42 + Math.random() * 3)); foe.angle = Math.round(a);
  const v = Math.sqrt(Math.abs(dx) * G * sh.wt / Math.sin(2 * a * Math.PI / 180));
  const p = Math.max(20, Math.min(100, v / SPEED - wind * sh.wind * foe.facing * 1.4 + (Math.random() * 10 - 5)));
  fire(foe, slot, p);
}
function settle(t, dt) {
  if (t.dead) return true;
  const ground = surfaceY(t.x, t.y - 3);
  if (ground > t.y + 1) {
    t.vy += 900 * dt; t.y = Math.min(ground, t.y + t.vy * dt);
    if (t.y > H + 40) { t.dead = true; t.hp = 0; floatText(t.x, H - 30, '낙하!', '#c92a2a'); return true; }
    return false;
  }
  if (t.vy > 0) { const fall = t.y - t.fallFrom; if (fall > 40) { const d = Math.round(fall * 1.2); t.hp = Math.max(0, t.hp - d); t.hitAt = clock; floatText(t.x, t.y - 60, '낙하 -' + d, '#c92a2a'); } }
  t.y = ground; t.vy = 0; t.fallFrom = t.y; return true;
}
function moveTank(t, dir, dt) {
  t.facing = dir;
  if (t.fuel <= 0 || !t.canMove) return;
  const nx = t.x + dir * 50 * dt;
  if (nx < 12 || nx > W - 12) return;
  const ny = surfaceY(nx, t.y - 14);
  if (ny < t.y - 12) return;
  t.moving = true;
  t.x = nx; if (ny <= t.y + 2) { t.y = ny; t.fallFrom = ny; }
  t.fuel = Math.max(0, t.fuel - 22 * dt * (ny < t.y ? 1.5 : 1));
}
let aimAcc = 0;
function aimStep(dir, dt) {
  aimAcc += 30 * dt;
  while (aimAcc >= 1) { aimAcc--; me.angle = Math.max(me.T.amin, Math.min(me.T.amax, me.angle + dir)); }
}

function update(dt) {
  clock += dt;
  tanks.forEach(t => t.moving = false);
  if (phase === 'aim') {
    timeLeft -= dt;
    if (keys.left) moveTank(me, -1, dt);
    if (keys.right) moveTank(me, 1, dt);
    if (keys.up) aimStep(1, dt);
    if (keys.down) aimStep(-1, dt);
    if (charging) power = Math.min(100, power + 55 * dt);
    if (timeLeft <= 0) { charging = false; phase = 'settle'; floatText(me.x, me.y - 70, '시간 초과', '#3a2600'); }
  } else if (phase === 'think') { thinkT -= dt; if (thinkT <= 0) aiShoot(); }
  pending.forEach(p => p.at -= dt);
  pending = pending.filter(p => { if (p.at <= 0) { p.fn(); return false; } return true; });

  for (const s of shells) {
    const sh = s.sh;
    for (let k = 0; k < 4 && !s.done; k++) {
      const h = dt / 4; s.age += h;
      if (s.mode === 'dig') {
        s.x += s.vx * h; s.y += s.vy * h; s.dug += Math.hypot(s.vx, s.vy) * h;
        const ht = hitTankAt(s);
        if (ht || s.dug >= 80 || s.y > H) { explode(s, s.x, s.y); break; }
        continue;
      }
      if (sh.shape !== 'line') { s.vx += wind * WINDK * sh.wind * h; s.vy += G * sh.wt * h; }
      if (sh.fx === 'home') {
        const tgt = tanks.filter(t => !t.dead && t !== s.owner).map(t => [t, Math.hypot(t.x - s.x, t.y - 18 - s.y)]).filter(([, d]) => d < 150).sort((a, b) => a[1] - b[1])[0];
        if (tgt) { const [t, d] = tgt; s.vx += (t.x - s.x) / d * 600 * h; s.vy += (t.y - 18 - s.y) / d * 600 * h; }
      }
      s.x += s.vx * h; s.y += s.vy * h;
      if (s.x < -300 || s.x > W + 300 || s.y > H + 40) { s.done = true; break; }
      const ht = hitTankAt(s);
      if (sh.shape === 'line') {
        s.dist += 900 * h;
        if (ht) { explode(s, s.x, s.y); break; }
        if (solid(s.x, s.y) && (!s.lastCarve || Math.hypot(s.x - s.lastCarve[0], s.y - s.lastCarve[1]) > 5)) { carveCircle(s.x, s.y, sh.cr / 2, false); s.lastCarve = [s.x, s.y]; }
        if (s.dist > 1100) s.done = true;
        continue;
      }
      if (ht || solid(s.x, s.y)) {
        if (sh.shape === 'tunnel' && !ht) { s.mode = 'dig'; const sp = Math.hypot(s.vx, s.vy) || 1; s.vx = s.vx / sp * 170; s.vy = Math.abs(s.vy / sp * 170) + 40; }
        else if (sh.shape === 'down') { beams.push({ x: s.x, y: s.y, t0: clock, s }); s.done = true; }
        else explode(s, s.x, s.y);
      }
    }
    if (s.mode === 'dig' && !s.done) carveCircle(s.x, s.y, 10, false);
    s.trail.unshift([s.x, s.y]); if (s.trail.length > 12) s.trail.pop();
  }
  shells = shells.filter(s => !s.done);
  beams.forEach(b => {
    const age = clock - b.t0;
    if (age > .55 && !b.fired) { b.fired = true; carveRect(b.x - b.s.sh.cr / 2, 0, b.s.sh.cr, b.y + 50); explode(b.s, b.x, b.y + 20, true); }
  });
  beams = beams.filter(b => clock - b.t0 < 1);
  booms = booms.filter(b => clock - b.t0 < .8);
  floats.forEach(f => { f.y -= 30 * dt; f.life -= dt; });
  floats = floats.filter(f => f.life > 0);
  const still = tanks.map(t => settle(t, dt)).every(Boolean);
  tanks.forEach(t => { if (t.hp <= 0) t.dead = true; });

  if ((phase === 'flying' || phase === 'settle') && !shells.length && !pending.length && !beams.length && !booms.length && still) {
    if (me.dead || foe.dead) return gameOver();
    turnNo++;
    startTurn(turn === me ? foe : me);
  }
  hud();
}
function gameOver() {
  phase = 'over';
  const win = foe.dead && !me.dead;
  document.getElementById('overTitle').textContent = win ? '승리!' : (me.dead && foe.dead ? '무승부' : '패배');
  document.getElementById('overText').textContent = `${turnNo}턴 만에 끝났습니다.`;
  document.getElementById('overlay').hidden = false;
}
document.getElementById('againBtn').onclick = resetGame;

function hud() {
  const t = me;
  document.getElementById('deg').textContent = t.angle + '°';
  document.getElementById('degRange').textContent = `허용 ${t.T.amin}~${t.T.amax}°`;
  const a = t.angle * Math.PI / 180;
  const n = document.getElementById('needle'); n.setAttribute('x2', 56 + 44 * Math.cos(a)); n.setAttribute('y2', 58 - 44 * Math.sin(a));
  const arc = deg => [56 + 48 * Math.cos(deg * Math.PI / 180), 58 - 48 * Math.sin(deg * Math.PI / 180)];
  const [x1, y1] = arc(t.T.amin), [x2, y2] = arc(t.T.amax);
  document.getElementById('dialRange').setAttribute('d', `M${x2} ${y2} A48 48 0 0 1 ${x1} ${y1}`);
  document.getElementById('powFill').style.width = power + '%';
  document.getElementById('powNum').textContent = Math.round(power);
  const lp = document.getElementById('powLast'); lp.hidden = me.lastPower == null; lp.style.left = (me.lastPower || 0) + '%';
  document.getElementById('fuelFill').style.width = Math.min(100, t.fuel) + '%';
  document.getElementById('fuelNum').textContent = Math.round(t.fuel);
  document.getElementById('hpFill').style.width = (t.hp / t.max * 100) + '%';
  document.getElementById('hpNum').textContent = t.hp;
  const mine = turn === me;
  const chip = document.getElementById('turnChip');
  chip.textContent = phase === 'over' ? '게임 끝' : mine ? '내 차례' : '연습 상대 차례';
  chip.classList.toggle('mine', mine && phase !== 'over');
  document.getElementById('timer').textContent = mine && phase === 'aim' ? Math.ceil(Math.max(0, timeLeft)) : '–';
  document.getElementById('order').innerHTML = `턴 ${turnNo} · 다음 순서 <span>${mine ? '연습 상대' : '포탄왕'}</span><span>${mine ? '포탄왕' : '연습 상대'}</span>`;
  const ssOn = me.hp <= me.max / 2, ssBtn = document.querySelector('[data-w="2"]');
  if (ssBtn && ssBtn.disabled === ssOn) renderWeapons();
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.drawImage(bg, 0, 0, W, H);
  ctx.drawImage(tc, 0, 0, W, H);
  zones.forEach(z => {
    for (let i = -2; i <= 2; i++) { const x = z.x + i * z.r / 2.5, y = surfaceY(x, 0); if (y > H) continue;
      if (z.type === 'burn') flame(ctx, x, y + 2, .9, clock + i);
      else { ctx.save(); ctx.translate(x, y + 2); ctx.scale(.7, .7); drawShell(ctx, { key: 'toadstool' }, clock + i, 0); ctx.restore(); } }
  });
  // 바람
  ctx.save();
  ctx.fillStyle = 'rgba(31,45,82,.85)'; rr(ctx, W / 2 - 90, 12, 180, 34, 17); ctx.fill();
  ctx.fillStyle = '#f4efe1'; ctx.font = '600 15px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const arrows = wind === 0 ? '·' : (wind < 0 ? '◀'.repeat(Math.ceil(-wind / 3)) : '▶'.repeat(Math.ceil(wind / 3)));
  ctx.fillText(`바람 ${arrows} ${Math.abs(wind)}`, W / 2, 30);
  ctx.restore();
  tanks.forEach(drawTank);
  beams.forEach(b => {
    const age = clock - b.t0;
    if (age < .55) { const k = (age * 8) % 1 < .5; ctx.strokeStyle = k ? '#ff4d4d' : 'rgba(255,77,77,.4)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(b.x, b.y, 14, 0, 7); ctx.moveTo(b.x - 20, b.y); ctx.lineTo(b.x + 20, b.y); ctx.stroke(); }
    else { const p = (age - .55) / .45, bw = 6 + 18 * Math.sin(Math.min(1, p) * Math.PI);
      const g = ctx.createLinearGradient(b.x - bw, 0, b.x + bw, 0); g.addColorStop(0, 'rgba(47,224,255,0)'); g.addColorStop(.3, 'rgba(47,224,255,.9)'); g.addColorStop(.5, '#ffffff'); g.addColorStop(.7, 'rgba(47,224,255,.9)'); g.addColorStop(1, 'rgba(47,224,255,0)');
      ctx.fillStyle = g; ctx.fillRect(b.x - bw, 0, bw * 2, b.y + 40); }
  });
  shells.forEach(s => {
    if (s.sh.shape === 'line') { ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(47,224,255,.55)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(s.sx, s.sy); ctx.lineTo(s.x, s.y); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); return; }
    trail(ctx, s.sh, s.trail.slice(1), clock);
    ctx.save(); ctx.translate(s.x, s.y); ctx.scale(.9, .9); drawShell(ctx, s.sh, clock, Math.atan2(s.vy, s.vx)); ctx.restore();
    if (s.y < 0) { ctx.fillStyle = '#c92a2a'; ctx.beginPath(); ctx.moveTo(s.x, 4); ctx.lineTo(s.x - 6, 14); ctx.lineTo(s.x + 6, 14); ctx.fill(); }
  });
  booms.forEach(b => boom(ctx, b.sh, b.x, b.y, (clock - b.t0) / .8));
  floats.forEach(f => {
    ctx.save(); ctx.globalAlpha = Math.min(1, f.life); ctx.font = '20px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff8e8'; ctx.strokeText(f.s, f.x, f.y); ctx.fillStyle = f.c; ctx.fillText(f.s, f.x, f.y); ctx.restore();
  });
}
function drawTank(t) {
  let st = 'idle', ph = null;
  if (t.dead) st = 'dead';
  else if (clock - t.hitAt < .6) { st = 'hit'; ph = clock - t.hitAt; }
  else if (clock - t.firedAt < .5) { st = 'fire'; ph = clock - t.firedAt; }
  else if (t.moving) st = 'move';
  else if (t.hp <= t.max * .25) st = 'danger';
  renderTank(ctx, W, H, t.T, st, clock, t.x, t.y, .5, { flip: t.facing, angle: t.angle, phaseT: ph, noText: true });
  if (t.shield) { ctx.strokeStyle = 'rgba(160,220,255,.85)'; ctx.fillStyle = 'rgba(85,174,240,.15)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(t.x, t.y - 20, 32, 0, 7); ctx.fill(); ctx.stroke(); }
  if (t.frozen > 0) { ctx.save(); ctx.translate(t.x + 22, t.y - 40); ctx.scale(.7, .7); drawShell(ctx, { key: 'snowflake' }, clock, 0); ctx.restore(); }
  if (t.dead) return;
  const active = turn === t && phase !== 'over', top = t.y - (t.T.hover ? 74 : 62);
  ctx.textAlign = 'center'; ctx.font = '600 12px "Noto Sans KR", sans-serif';
  ctx.fillStyle = t.team === 'red' ? '#b8321f' : '#1f6fae'; ctx.fillText(t.name, t.x, top - 8);
  ctx.fillStyle = 'rgba(31,45,82,.6)'; ctx.fillRect(t.x - 22, top - 2, 44, 6);
  ctx.fillStyle = t.hp / t.max > .5 ? '#3fae4a' : t.hp / t.max > .25 ? '#f0a020' : '#d63c3c';
  ctx.fillRect(t.x - 22, top - 2, 44 * t.hp / t.max, 6);
  if (active) { ctx.fillStyle = '#ffb703'; ctx.beginPath(); ctx.moveTo(t.x, top - 22); ctx.lineTo(t.x - 7, top - 32); ctx.lineTo(t.x + 7, top - 32); ctx.fill(); }
  if (active && t === me && phase === 'aim') {
    const a = t.angle * Math.PI / 180, [mx, my] = muzzlePos(t);
    ctx.setLineDash([3, 6]); ctx.strokeStyle = 'rgba(42,47,61,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a) * 44 * t.facing, my - Math.sin(a) * 44); ctx.stroke(); ctx.setLineDash([]);
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (current === 'game' && phase) { update(dt); draw(); }
  requestAnimationFrame(loop);
}

/* 입력 */
const canAct = () => current === 'game' && phase === 'aim';
function startCharge() { if (canAct() && !charging) { charging = true; power = 0; } }
function release() { if (charging && canAct()) { charging = false; fire(me, weapon, Math.max(1, power)); } }
const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
addEventListener('keydown', e => {
  if (current !== 'game' || e.target.matches('input, select')) return;
  const k = KEYMAP[e.key];
  if (k) { keys[k] = true; e.preventDefault(); }
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) startCharge(); }
  if (e.key === '1') { weapon = 0; renderWeapons(); }
  if (e.key === '2') { weapon = 1; renderWeapons(); }
  if (e.key === '3' && me.hp <= me.max / 2) { weapon = 2; renderWeapons(); }
  const qi = 'qwerty'.indexOf(e.key.toLowerCase());
  if (qi >= 0 && !e.repeat) { let c = 0; BAG.forEach((id, i) => { if (c === qi) useItem(i); c += itemById(id).size; }); }
});
addEventListener('keyup', e => {
  const k = KEYMAP[e.key]; if (k) keys[k] = false;
  if (e.code === 'Space') { e.preventDefault(); release(); }
});
document.querySelectorAll('[data-hold]').forEach(b => {
  const k = b.dataset.hold;
  b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; b.setPointerCapture(e.pointerId); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, () => keys[k] = false));
});
const fb = document.getElementById('fireBtn');
fb.addEventListener('pointerdown', e => { e.preventDefault(); fb.setPointerCapture(e.pointerId); startCharge(); });
fb.addEventListener('pointerup', release);
fb.addEventListener('pointercancel', release);

/* 시작 */
renderSlots(); renderPicker(); renderRoomBag(); paintMe(); route(); resetGame(); hud(); draw();
requestAnimationFrame(loop);
// 글꼴이 늦게 오면 정지 그림을 다시 그린다
document.fonts && document.fonts.ready.then(() => { renderSlots(); renderPicker(); renderRoomBag(); paintMe(); });
