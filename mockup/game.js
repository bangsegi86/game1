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

/* ---------- 연습 전투 (engine.js의 World 사용) ---------- */
const W = 960, H = 480;
const cv = document.getElementById('field');
cv.width = W * DPR; cv.height = H * DPR;
const ctx = cv.getContext('2d');
let world, me, foe, turn, phase, power, charging, timeLeft, weapon, thinkT, boost, itemUsed, bagState, turnNo, teleportArmed, mapId = 'valley', keys = {};
function resetGame() {
  if (!world) world = new World({ w: W, h: H, map: mapId }); else world.reset(mapId);
  const m = world.map;
  me = world.addTank(myTank, m.spawn[0] * W, 1, 'red', '포탄왕');
  foe = world.addTank(myTank === 'laser' ? 'hammer' : 'laser', m.spawn[1] * W, -1, 'blue', '연습 상대');
  power = 0; charging = false; weapon = 0; turnNo = 1; bagState = BAG.map(() => false);
  world.nextWind();
  document.getElementById('overlay').hidden = true;
  startTurn(me);
}
function startTurn(t) {
  turn = t; world.turnStart(t);
  if (turnNo > 1) world.nextWind();
  if (turnNo > 2) world.rollEvent();
  timeLeft = 20; boost = 1; itemUsed = false; t.doubleShot = false; teleportArmed = false;
  phase = t.dead ? 'settle' : t === me ? 'aim' : 'think'; thinkT = 1.3;
  power = 0; charging = false;
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
     repair: () => { me.hp = Math.min(me.max, me.hp + 250); world.float(me.x, me.y - 60, '+250', '#2f9e44'); },
     teamrepair: () => { me.hp = Math.min(me.max, me.hp + 150); world.float(me.x, me.y - 60, '+150', '#2f9e44'); },
     calm: () => world.wind.str = 0, shield: () => me.shield = true, fuel: () => me.fuel = 200 })[it.id]();
  world.float(me.x, me.y - 84, it.n, '#3a2600');
  renderItems();
}
document.getElementById('gameItems').addEventListener('click', e => { const b = e.target.closest('.item'); if (b && !b.disabled) useItem(+b.dataset.i); });

function shoot(t, slot, p) {
  world.fire(t, slot, p, t === me ? { boost, double: t.doubleShot, teleport: teleportArmed } : {});
  phase = 'flying'; renderItems();
}
function aiShoot() {
  const dx = me.x - foe.x; foe.facing = Math.sign(dx) || -1;
  const slot = foe.hp <= foe.max / 2 && Math.random() < .5 ? 2 : Math.random() < .7 ? 0 : 1, sh = SHELLS[foe.T.id][slot];
  if (sh.shape === 'line') {
    const a = Math.atan2(foe.y - 20 - (me.y - 18), Math.abs(dx)) * 180 / Math.PI;
    foe.angle = Math.round(Math.max(foe.T.amin, Math.min(foe.T.amax, a)));
    return shoot(foe, slot, 60);
  }
  foe.angle = Math.round(Math.min(foe.T.amax, Math.max(foe.T.amin, 40 + Math.random() * 10)));
  const p = Math.max(15, Math.min(100, world.solvePower(foe, slot, me.x, true) + (Math.random() * 10 - 5)));
  shoot(foe, slot, p);
}
let aimAcc = 0;
function aimStep(dir, dt) { aimAcc += 30 * dt; while (aimAcc >= 1) { aimAcc--; me.angle = Math.max(me.T.amin, Math.min(me.T.amax, me.angle + dir)); } }

function update(dt) {
  world.step(dt);
  if (phase === 'aim') {
    if (me.dead) { phase = 'settle'; charging = false; }
    timeLeft -= dt;
    if (keys.left) world.move(me, -1, dt);
    if (keys.right) world.move(me, 1, dt);
    if (keys.up) aimStep(1, dt);
    if (keys.down) aimStep(-1, dt);
    if (charging) power = Math.min(100, power + 55 * dt);
    if (timeLeft <= 0 && phase === 'aim') { charging = false; phase = 'settle'; world.float(me.x, me.y - 70, '시간 초과', '#3a2600'); }
  } else if (phase === 'think') { if (foe.dead) phase = 'settle'; else { thinkT -= dt; if (thinkT <= 0) aiShoot(); } }
  if ((phase === 'flying' || phase === 'settle') && !world.busy()) {
    if (me.dead || foe.dead) return gameOver();
    turnNo++; startTurn(turn === me ? foe : me);
  }
  hud();
}
function gameOver() {
  phase = 'over';
  const win = foe.dead && !me.dead;
  document.getElementById('overTitle').textContent = win ? '승리!' : (me.dead && foe.dead ? '무승부' : '패배');
  document.getElementById('overText').textContent = `${turnNo}턴 만에 끝났습니다.` + (me.sunk ? ' 내 탱크가 낙사했습니다.' : foe.sunk ? ' 상대가 낙사했습니다.' : '');
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
  document.getElementById('order').innerHTML = `${world.map.n} · 턴 ${turnNo} · 다음 순서 <span>${mine ? '연습 상대' : '포탄왕'}</span><span>${mine ? '포탄왕' : '연습 상대'}</span>`;
  const ssOn = me.hp <= me.max / 2, ssBtn = document.querySelector('[data-w="2"]');
  if (ssBtn && ssBtn.disabled === ssOn) renderWeapons();
}
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  world.draw(ctx, { active: phase !== 'over' ? turn : null });
  world.drawWind(ctx, W / 2, 40);
  if (turn === me && phase === 'aim' && !me.dead) {
    const a = me.angle * Math.PI / 180, [mx, my] = world.muzzle(me);
    ctx.setLineDash([3, 6]); ctx.strokeStyle = 'rgba(42,47,61,.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a) * 44 * me.facing, my - Math.sin(a) * 44); ctx.stroke(); ctx.setLineDash([]);
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
function release() { if (charging && canAct()) { charging = false; shoot(me, weapon, Math.max(1, power)); } }
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

/* 방 설정: 맵 */
const mapSel = document.getElementById('setMap');
mapSel.innerHTML = MAP_ORDER.map(id => `<option value="${id}" ${id === mapId ? 'selected' : ''}>${MAPS[id].n}</option>`).join('');
mapSel.addEventListener('change', () => { mapId = mapSel.value; document.getElementById('roomMapName').textContent = MAPS[mapId].n; resetGame(); });
document.getElementById('roomMapName').textContent = MAPS[mapId].n;

/* 시작 */
renderSlots(); renderPicker(); renderRoomBag(); paintMe(); route(); resetGame(); hud(); draw();
requestAnimationFrame(loop);
document.fonts && document.fonts.ready.then(() => { renderSlots(); renderPicker(); renderRoomBag(); paintMe(); });
