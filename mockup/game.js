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
  // 숨은 탱크(슈퍼탱크)는 목록에 없고, '랜덤'을 누르면 10% 확률로 나온다
  el.innerHTML = TANKS.filter(T => !T.hidden).map(T => `<button class="pick" data-id="${T.id}" aria-pressed="${T.id === myTank}"><canvas data-tank="${T.id}" data-w="84" data-h="72" data-s=".46" style="width:84px;height:72px"></canvas><span>${T.name}</span></button>`).join('')
    + `<button class="pick random" data-id="random" aria-pressed="${tankById(myTank).hidden}" title="10% 확률로 슈퍼탱크"><b style="display:grid;place-items:center;width:84px;height:72px;font:40px Jua,sans-serif;color:#ffb703">?</b><span>랜덤</span></button>`;
  paintTanks(el);
  const T = tankById(myTank), S = SHELLS[T.id];
  document.getElementById('tankInfo').innerHTML = `<p style="margin:0">${T.concept}</p><dl class="num">
    <dt>체력</dt><dd>${T.hp}</dd><dt>각도</dt><dd>${T.ang}</dd>
    <dt>주무기 1</dt><dd>${S[0].n} · 피해 ${S[0].d}</dd><dt>주무기 2</dt><dd>${S[1].n} · 피해 ${S[1].d}</dd>
    <dt>필살기 SS</dt><dd>${S[2].n} · 피해 ${S[2].d} (체력 50% 이하)</dd></dl>`;
}
document.getElementById('picker').addEventListener('click', e => {
  const b = e.target.closest('.pick'); if (!b) return;
  if (b.dataset.id === 'random') {
    const normal = TANKS.filter(T => !T.hidden);
    myTank = Math.random() < .1 ? 'super' : normal[Math.floor(Math.random() * normal.length)].id;
    const T = tankById(myTank), msg = T.hidden ? '★ 슈퍼탱크 당첨! (10% 확률)' : `랜덤 결과: ${T.name}`;
    let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.append(t); } t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, 2400);
  } else myTank = b.dataset.id;
  renderPicker(); renderSlots(); paintMe(); resetGame();
});
function renderRoomBag() {
  const el = document.getElementById('roomBag');
  el.innerHTML = BAG.map(id => { const it = itemById(id); return `<div class="item ${it.size === 2 ? 'w2' : ''}"><canvas data-item="${id}" style="width:40px;height:40px"></canvas><div><b>${it.n}</b><small>${it.size}칸</small></div></div>`; }).join('');
  paintIcons(el);
  document.getElementById('ownedItems').textContent = '보유 아이템: ' + ITEMS.map(i => i.n).join(', ') + ' · 클릭해서 칸에 넣기';
}
function paintMe() { const el = document.getElementById('meTank'); el.innerHTML = `<canvas data-tank="${myTank}" data-w="84" data-h="72" data-s=".46" style="width:84px;height:72px"></canvas>`; paintTanks(el); }

/* ---------- 연습 전투: 실제 게임과 같은 코드(practice.js → 서버 GameSession + 화면 battle.js)로 돌린다 ---------- */
let mapId = 'valley';
function resetGame() { window.practice?.start({ tank: myTank, map: mapId, bag: BAG }); }

/* 방 설정: 맵 */
const mapSel = document.getElementById('setMap');
mapSel.innerHTML = MAP_ORDER.map(id => `<option value="${id}" ${id === mapId ? 'selected' : ''}>${MAPS[id].n}</option>`).join('');
mapSel.addEventListener('change', () => { mapId = mapSel.value; document.getElementById('roomMapName').textContent = MAPS[mapId].n; resetGame(); });
document.getElementById('roomMapName').textContent = MAPS[mapId].n;

/* 시작 */
renderSlots(); renderPicker(); renderRoomBag(); paintMe(); route();
document.fonts && document.fonts.ready.then(() => { renderSlots(); renderPicker(); renderRoomBag(); paintMe(); });
