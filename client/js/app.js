// 포탄대결 클라이언트: 로그인 → 로비 → 대기방. 그림은 /art/art.js(전역)를 쓴다.
import { TANK_IDS, TANK_NAMES, MAP_IDS, MAP_NAMES, ITEM_SIZES, BAG_CELLS, bagSize, RULES, checkNickname } from '/shared/gamedata.js';

const $ = id => document.getElementById(id);
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { token: store.get('sc_token'), user: null, stats: null, socket: null, lobby: { users: [], rooms: [] }, room: null, pendingJoin: null };

/* ---------- 공용 ---------- */
let toastTimer;
function toast(msg, err) { let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); } t.textContent = msg; t.classList.toggle('err', !!err); t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 2600); }
function show(name) { ['login', 'lobby', 'room', 'game'].forEach(s => $('s-' + s).hidden = s !== name); $('topRight').hidden = name === 'login'; }
function paint(canvas, w, h, draw) { const d = DPR; canvas.width = Math.round(w * d); canvas.height = Math.round(h * d); const c = canvas.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); draw(c); }
function tankCanvas(id, w, h, s) { const cv = document.createElement('canvas'); cv.style.width = w + 'px'; cv.style.height = h + 'px'; drawTankThumb(cv, id, w, h, s); return cv; }
function drawTankThumb(cv, id, w, h, s) {
  paint(cv, w, h, c => {
    if (id === 'random') { c.font = `${Math.round(h * .55)}px Jua, sans-serif`; c.textAlign = 'center'; c.fillStyle = '#ffb703'; c.fillText('?', w / 2, h * .72); return; }
    renderTank(c, w, h, tankById(id), 'idle', 1.3, w / 2, h - 6, s);
  });
}
function iconCanvas(id, px = 36) { const cv = document.createElement('canvas'); cv.style.width = cv.style.height = px + 'px'; paint(cv, px, px, c => { c.translate(px / 2, px / 2); c.scale(px / 64, px / 64); drawItemIcon(c, id, 0, true); }); return cv; }
function emit(ev, data) { return new Promise(res => { if (!state.socket) return res({ ok: false, error: '연결이 끊겼어요.' }); state.socket.timeout(8000).emit(ev, data, (err, r) => res(err ? { ok: false, error: '서버가 답하지 않아요.' } : r)); }); }
async function act(ev, data, okMsg) { const r = await emit(ev, data); if (!r.ok) toast(r.error, true); else if (okMsg) toast(okMsg); return r; }
function logLine(box, m) {
  const d = document.createElement('div');
  if (m.system) { d.className = 'sys'; d.textContent = m.text; } else { const b = document.createElement('b'); b.textContent = m.from; d.append(b, ' ' + m.text); }
  box.append(d); while (box.children.length > 120) box.firstChild.remove(); box.scrollTop = box.scrollHeight;
}

/* ---------- 로그인 ---------- */
let joinMode = false;
function setJoin(j) { joinMode = j; $('segLogin').setAttribute('aria-pressed', !j); $('segJoin').setAttribute('aria-pressed', j); document.querySelectorAll('[data-join]').forEach(e => e.hidden = !j); $('loginBtn').textContent = j ? '가입하고 시작하기' : '로그인'; $('upw').autocomplete = j ? 'new-password' : 'current-password'; $('loginErr').textContent = ''; }
$('segLogin').onclick = () => setJoin(false); $('segJoin').onclick = () => setJoin(true);
$('serverAddr').textContent = '서버 ' + location.host;
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = $('uid').value.trim(), password = $('upw').value, nickname = $('unick').value.trim(), err = $('loginErr');
  if (joinMode) {
    if (!RULES.username.test(username)) return err.textContent = '아이디는 영문·숫자 4~16자로 정해 주세요.';
    if (!password) return err.textContent = '비밀번호를 입력해 주세요.';
    const n = checkNickname(nickname); if (n) return err.textContent = n;
  } else if (!username || !password) return err.textContent = '아이디와 비밀번호를 입력해 주세요.';
  $('loginBtn').disabled = true; err.textContent = '';
  try {
    const r = await fetch(joinMode ? '/api/register' : '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password, nickname }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || '로그인하지 못했어요.');
    state.token = j.token; store.set('sc_token', j.token); $('upw').value = '';
    connect();
  } catch (x) { err.textContent = x.message === 'Failed to fetch' ? '서버에 연결할 수 없어요. 서버가 켜져 있는지 확인해 주세요.' : x.message; }
  finally { $('loginBtn').disabled = false; }
});
$('logoutBtn').onclick = () => { store.set('sc_token', null); state.token = null; state.socket?.disconnect(); state.socket = null; state.room = null; show('login'); };
(function loginBg() {
  const c = $('loginBg').getContext('2d'), sky = c.createLinearGradient(0, 0, 0, 520);
  sky.addColorStop(0, '#1f2d52'); sky.addColorStop(.6, '#6a4f7a'); sky.addColorStop(1, '#e09a6a'); c.fillStyle = sky; c.fillRect(0, 0, 1100, 520);
  c.fillStyle = '#ffd98a'; c.beginPath(); c.arc(820, 330, 60, 0, 7); c.fill();
  const hills = (b, a, f, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, 520); for (let x = 0; x <= 1100; x += 10) c.lineTo(x, b + a * Math.sin(x / f) + a * .5 * Math.sin(x / (f * .37) + 1)); c.lineTo(1100, 520); c.fill(); };
  hills(380, 26, 130, '#4b3f6b'); hills(430, 22, 90, '#33335a'); hills(470, 16, 70, '#26365e');
  [['hammer', 160, 412, .9, 1], ['mole', 300, 400, .8, 1], ['cloud', 930, 420, .8, -1], ['bee', 1010, 432, .75, -1]].forEach(([id, x, y, s, f]) => renderTank(c, 1100, 520, tankById(id), 'idle', 1, x, y, s, { flip: f }));
})();

/* ---------- 연결 ---------- */
function connect() {
  state.socket?.disconnect();
  const s = io({ auth: { token: state.token }, transports: ['websocket', 'polling'] });
  state.socket = s;
  s.on('connect', () => { $('connDot').classList.remove('off'); $('connText').textContent = '연결됨'; });
  s.on('disconnect', () => { $('connDot').classList.add('off'); $('connText').textContent = '다시 연결하는 중…'; });
  s.on('connect_error', e => { if (e.message === 'unauthorized') { store.set('sc_token', null); s.disconnect(); show('login'); $('loginErr').textContent = '다시 로그인해 주세요.'; } });
  s.on('hello', ({ user, stats }) => { state.user = user; state.stats = stats; renderMe(); if (state.room) { renderRoom(); show('room'); } else show('lobby'); });
  s.on('auth:token', ({ token }) => { state.token = token; store.set('sc_token', token); s.auth.token = token; });
  s.on('session:expired', ({ reason }) => { store.set('sc_token', null); state.token = null; s.disconnect(); state.socket = null; state.room = null; show('login'); $('loginErr').textContent = reason; });
  s.on('session:kicked', ({ reason }) => { s.disconnect(); state.socket = null; show('login'); $('loginErr').textContent = reason; });
  s.on('lobby:state', st => { state.lobby = st; renderLobby(); });
  s.on('lobby:chat', m => logLine($('lobbyLog'), m));
  s.on('room:state', room => { const first = !state.room || state.room.id !== room.id; state.room = room; if (first) $('roomLog').innerHTML = ''; if (!state.user) return; renderRoom(); if (!$('s-lobby').hidden || !$('s-login').hidden) show(room.status === 'playing' ? 'game' : 'room'); });
  s.on('room:chat', m => logLine($('roomLog'), m));
  s.on('room:kicked', ({ reason }) => { state.room = null; show('lobby'); toast(reason, true); });
  s.on('game:start', setup => { const me = setup.players.find(p => p.userId === state.user.id); $('gameTitle').textContent = `${MAP_NAMES[setup.mapId]}에서 게임 시작!`; $('gameInfo').textContent = `${setup.players.length}명 · ${setup.mode === 'team' ? '팀전' : '개인전'} · 내 탱크: ${TANK_NAMES[me?.tankId] || '-'}`; $('finishBtn').hidden = state.room?.hostId !== state.user.id; show('game'); });
  s.on('game:end', () => show('room'));
}

/* ---------- 로비 ---------- */
function renderMe() {
  const u = state.user, st = state.stats || {}; if (!u) return;
  $('meMini').textContent = u.nickname; $('meName').innerHTML = `${esc(u.nickname)} <span style="font-family:var(--font-body);font-size:13px;color:var(--muted)">${esc(u.username)}</span>`;
  const rate = st.games ? Math.round(st.wins / st.games * 100) + '%' : '-';
  $('meStats').innerHTML = [['판수', st.games], ['승', st.wins, 'var(--good)'], ['패', st.losses, 'var(--bad)'], ['승률', rate], ['킬', st.kills]].map(([l, v, c]) => `<div class="stat"><span class="label">${l}</span><b ${c ? `style="color:${c}"` : ''}>${v ?? 0}</b></div>`).join('');
  drawTankThumb($('meTank'), 'hammer', 84, 60, .46);
}
function renderLobby() {
  const { users, rooms } = state.lobby;
  $('userCount').textContent = users.length + '명';
  $('userList').innerHTML = users.map(u => `<li><span>${esc(u.nickname)}${u.id === state.user?.id ? ' (나)' : ''}</span><span class="where">${u.where ? String(u.where).padStart(3, '0') + '번 방' : '로비'}</span></li>`).join('');
  $('noRooms').hidden = rooms.length > 0;
  $('roomRows').innerHTML = rooms.map(r => `<tr class="clickable" data-id="${r.id}" data-locked="${r.locked}" tabindex="0"><td>${String(r.id).padStart(3, '0')}</td><td>${esc(r.title)}</td><td>${r.mode === 'team' ? '팀전' : '개인전'}</td><td>${MAP_NAMES[r.mapId]}</td><td>${r.count}/${r.max}</td><td>${r.status === 'playing' ? '<span class="pill play">게임중</span>' : r.locked ? '<span class="pill lock">비밀방</span>' : '<span class="pill wait">대기중</span>'}</td></tr>`).join('');
}
async function tryJoin(id, locked) {
  if (locked) { state.pendingJoin = id; $('joinPw').value = ''; $('pwErr').textContent = ''; $('pwModal').hidden = false; $('joinPw').focus(); return; }
  const r = await act('room:join', { roomId: id }); if (r.ok) enterRoom(r.room);
}
function enterRoom(room) { state.room = room; $('roomLog').innerHTML = ''; renderRoom(); show('room'); }
$('roomRows').addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) tryJoin(+tr.dataset.id, tr.dataset.locked === 'true'); });
$('roomRows').addEventListener('keydown', e => { if (e.key === 'Enter') { const tr = e.target.closest('tr[data-id]'); if (tr) tryJoin(+tr.dataset.id, tr.dataset.locked === 'true'); } });
$('pwForm').addEventListener('submit', async e => { e.preventDefault(); const r = await emit('room:join', { roomId: state.pendingJoin, password: $('joinPw').value }); if (!r.ok) return $('pwErr').textContent = r.error; $('pwModal').hidden = true; enterRoom(r.room); });
$('quickBtn').onclick = async () => { const r = await act('room:quickjoin'); if (r.ok) enterRoom(r.room); };
const mapOpts = (sel, withRandom) => { sel.innerHTML = MAP_IDS.map(id => `<option value="${id}">${MAP_NAMES[id]}</option>`).join('') + (withRandom ? '<option value="random">무작위</option>' : ''); };
mapOpts($('cMap'), true); mapOpts($('setMap'), true);
$('createBtn').onclick = () => { $('cTitle').value = `${state.user.nickname}의 방`; $('createErr').textContent = ''; $('createModal').hidden = false; $('cTitle').select(); };
$('createForm').addEventListener('submit', async e => { e.preventDefault(); const r = await emit('room:create', { title: $('cTitle').value, mode: $('cMode').value, mapId: $('cMap').value, turnSeconds: +$('cTurn').value, password: $('cPw').value }); if (!r.ok) return $('createErr').textContent = r.error; $('createModal').hidden = true; enterRoom(r.room); });
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('.modal-bg').hidden = true);
addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-bg').forEach(m => m.hidden = true); });
$('lobbyChat').addEventListener('submit', async e => { e.preventDefault(); const i = $('lobbyMsg'); if (!i.value.trim()) return; const r = await act('lobby:chat', { text: i.value }); if (r.ok) i.value = ''; });

/* ---------- 대기방 ---------- */
const meSlot = () => state.room?.slots.find(s => s && s.userId === state.user.id);
const isHost = () => state.room?.hostId === state.user?.id;
function renderRoom() {
  const r = state.room; if (!r) return; const me = meSlot(), host = isHost();
  $('roomNo').textContent = String(r.id).padStart(3, '0'); $('roomTitle').textContent = r.title + (r.hasPassword ? ' (비밀방)' : '');
  $('roomInfo').textContent = `${r.mode === 'team' ? '팀전' : '개인전'} · ${MAP_NAMES[r.mapId]} · 턴 ${r.turnSeconds}초`;
  const rb = $('readyBtn');
  if (host) { rb.textContent = '게임 시작'; rb.className = 'btn primary'; } else { rb.textContent = me?.ready ? '준비 취소' : '준비'; rb.className = me?.ready ? 'btn' : 'btn primary'; }
  // 자리
  const el = $('slots'); el.innerHTML = '';
  const slotEl = (s, i) => {
    const d = document.createElement('div');
    if (!s) { d.className = 'slot empty ' + (r.mode === 'team' ? (i < 4 ? 'red' : 'blue') : ''); d.textContent = '빈 자리'; d.tabIndex = 0; d.onclick = () => act('room:update', { slot: i }); return d; }
    d.className = `slot ${s.team === 'solo' ? '' : s.team} ${s.userId === state.user.id ? 'me' : ''}`;
    d.append(tankCanvas(s.tankId, 96, 72, .52));
    d.insertAdjacentHTML('beforeend', `<div class="nick">${esc(s.nickname)}</div><div class="tname">${TANK_NAMES[s.tankId]}</div>` + (s.userId === r.hostId ? '<div class="host">방장</div>' : s.ready ? '<div class="ready">준비 완료</div>' : '<div class="tname">준비 중</div>'));
    if (host && s.userId !== state.user.id && r.status === 'waiting') { const k = document.createElement('button'); k.className = 'kick'; k.textContent = '내보내기'; k.onclick = () => act('room:kick', { userId: s.userId }); d.append(k); }
    return d;
  };
  if (r.mode === 'team') {
    el.insertAdjacentHTML('beforeend', '<div class="team-label red">레드팀</div>'); r.slots.slice(0, 4).forEach((s, i) => el.append(slotEl(s, i)));
    el.insertAdjacentHTML('beforeend', '<div class="team-label blue">블루팀</div>'); r.slots.slice(4).forEach((s, i) => el.append(slotEl(s, i + 4)));
  } else r.slots.forEach((s, i) => el.append(slotEl(s, i)));
  // 탱크 선택
  const pk = $('picker'); pk.innerHTML = '';
  [...TANK_IDS, 'random'].forEach(id => { const b = document.createElement('button'); b.className = 'pick' + (id === 'random' ? ' random' : ''); b.setAttribute('aria-pressed', me?.tankId === id); b.append(tankCanvas(id, 84, 66, .46)); b.insertAdjacentHTML('beforeend', `<span>${TANK_NAMES[id]}</span>`); b.onclick = () => act('room:update', { tankId: id }); pk.append(b); });
  const T = me && me.tankId !== 'random' ? tankById(me.tankId) : null, S = T && SHELLS[T.id];
  $('tankInfo').innerHTML = T ? `<p style="margin:0">${T.concept}</p><dl class="num"><dt>체력</dt><dd>${T.hp}</dd><dt>각도</dt><dd>${T.ang}</dd><dt>주무기 1</dt><dd>${S[0].n} · ${S[0].d}</dd><dt>주무기 2</dt><dd>${S[1].n} · ${S[1].d}</dd><dt>필살기</dt><dd>${S[2].n} · ${S[2].d}</dd></dl>` : '<p style="margin:0">게임이 시작될 때 8종 중 하나가 무작위로 정해져요.</p>';
  // 가방
  const items = me?.items || [], used = bagSize(items), bag = $('bag'); bag.innerHTML = '';
  items.forEach((id, i) => { const it = itemById(id), b = document.createElement('button'); b.className = 'item slotfill' + (it.size === 2 ? ' w2' : ''); b.title = '눌러서 빼기'; b.append(iconCanvas(id)); b.insertAdjacentHTML('beforeend', `<div><b>${it.n}</b><small>${it.size}칸</small></div>`); b.onclick = () => act('room:update', { items: items.filter((_, k) => k !== i) }); bag.append(b); });
  for (let i = used; i < BAG_CELLS; i++) { const d = document.createElement('div'); d.className = 'item free'; d.textContent = '빈 칸'; bag.append(d); }
  $('bagLeft').textContent = `${used}/${BAG_CELLS}칸`;
  const ow = $('owned'); ow.innerHTML = '';
  ITEMS.forEach(it => { const b = document.createElement('button'); b.disabled = used + it.size > BAG_CELLS; b.title = it.d; b.append(iconCanvas(it.id, 24)); b.append(`${it.n} (${it.size}칸)`); b.onclick = () => act('room:update', { items: [...items, it.id] }); ow.append(b); });
  // 설정
  [['setTitle', r.title], ['setMap', r.mapId], ['setMode', r.mode], ['setTurn', String(r.turnSeconds)]].forEach(([id, v]) => { const e = $(id); if (document.activeElement !== e) e.value = v; e.disabled = !host; });
  $('setPw').disabled = !host; if (document.activeElement !== $('setPw')) $('setPw').placeholder = r.hasPassword ? '비밀번호 있음 (바꾸려면 입력)' : '없음';
  $('hostOnly').textContent = host ? '내가 방장' : '방장만 변경';
}
$('readyBtn').onclick = () => isHost() ? act('room:start') : act('room:ready', { ready: !meSlot()?.ready });
$('leaveBtn').onclick = async () => { await act('room:leave'); state.room = null; show('lobby'); };
$('finishBtn').onclick = () => act('game:finish');
[['setMap', 'mapId'], ['setMode', 'mode'], ['setTurn', 'turnSeconds']].forEach(([id, key]) => $(id).addEventListener('change', e => act('room:settings', { [key]: key === 'turnSeconds' ? +e.target.value : e.target.value })));
$('setTitle').addEventListener('change', e => act('room:settings', { title: e.target.value }));
$('setPw').addEventListener('change', e => { act('room:settings', { password: e.target.value }, e.target.value ? '비밀번호를 걸었어요.' : '비밀번호를 풀었어요.'); e.target.value = ''; });
$('roomChat').addEventListener('submit', async e => { e.preventDefault(); const i = $('roomMsg'); if (!i.value.trim()) return; const r = await act('room:chat', { text: i.value }); if (r.ok) i.value = ''; });

/* 활동 알림: 화면을 만지면 1분에 한 번만 서버에 알려 로그인 시간을 늘린다 */
let lastAct = 0;
['pointerdown', 'keydown', 'wheel'].forEach(ev => addEventListener(ev, () => { const now = Date.now(); if (state.socket?.connected && now - lastAct > 60000) { lastAct = now; state.socket.emit('activity'); } }, { passive: true }));

/* ---------- 시작 ---------- */
if (state.token) connect(); else show('login');
document.fonts?.ready.then(() => { if (state.room) renderRoom(); renderMe(); });
