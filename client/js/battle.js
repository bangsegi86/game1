// 전투 화면: 서버가 보낸 입력을 같은 시뮬레이션으로 재생하고, 내 차례에는 조작을 보낸다
import { Sim, DT, opsHash } from '../../shared/sim/world.js';
import { SHELL_STATS, TANK_NAMES, ITEM_INFO } from '../../shared/gamedata.js';
import { Renderer } from './render.js';
import { play, setMuted, isMuted } from './sound.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VW = 960, VH = 480; // 화면(카메라) 크기. 맵은 이보다 넓다
const MM = { w: 216, h: 90, x: VW - 226, y: 10 }; // 미니맵

export function createBattle({ socket, me, toast, onExit, onQuit }) {
  const cv = $('field'); cv.width = VW * DPR; cv.height = VH * DPR; const ctx = cv.getContext('2d');
  let cam = { x: 0, y: 0 }, camHold = 0, chatLines = [];
  let sim = null, ren = null, start = null, bag = [], ssUsed = false, turn = null, deadline = 0, phase = 'idle', order = [];
  let lastTick = 0, flags = {}, weapon = 0, power = 0, charging = false, turnItemUsed = false, keys = {}, sentDir = 0, lastAimSent = 0, aimDirty = false, acc = 0, last = 0, running = false;
  const BAG_SLOTS = 4; // 가방 칸 수(빈칸도 보여 준다)
  const myTank = () => sim?.tankOf(me());
  const mine = () => phase === 'aim' && turn?.uid === me();

  function begin(s) {
    start = s; sim = new Sim({ map: s.mapId }); MM.h = Math.round(MM.w * sim.h / sim.w);
    s.players.forEach(p => { const t = sim.addTank({ uid: p.uid, tankId: p.tankId, x: p.x, facing: p.facing, team: p.team, name: p.nickname }); });
    const mp = s.players.find(p => p.uid === me());
    bag = (mp?.items || []).map(id => ({ id, used: false })); ssUsed = false; ssWas = false; weapon = 0; power = 0; charging = false;
    ren = new Renderer(sim, { me: me() });
    if (mp?.tankId === 'super') { ren.banner = { text: '★ 슈퍼탱크 당첨! ★', t0: 0 }; setTimeout(() => play('ssready'), 300); }
    ren.onFx = f => {
      if (f.type === 'fire') play('fire');
      else if (f.type === 'boom') play(f.kind === 'electric' || f.kind === 'beam' ? 'zap' : 'boom', (f.R || 24) > 34);
      else if (f.type === 'float' && /^[^+]*-\d/.test(f.text)) play('hit');
      else if (f.type === 'splash') play('splash');
      else if (f.type === 'banner') play('banner');
      else if (f.type === 'item') play('item');
    };
    phase = 'wait'; turn = null; order = [];
    const mt = sim.tankOf(me()); if (mt) { cam.x = mt.x - VW / 2; cam.y = mt.y - VH * .55; clampCam(); }
    $('resultBox').hidden = true;
    renderWeapons(); renderItems();
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  }
  function loadState(st) {
    begin(st.start);
    for (const op of st.ops) { sim.applyOp(op); sim.ops.push(op); }
    ren.rebuild(); sim.restore(st.snapshot);
    bag = st.bag.map(b => ({ ...b })); ssUsed = !!st.ssUsed; ssWas = null; flags = { ...(st.flags || {}) };
    if (st.turn) { turn = { uid: st.turn.uid, turnNo: st.turn.turnNo }; order = st.turn.order || []; deadline = performance.now() + st.turn.left * 1000; phase = st.phase === 'aim' ? 'aim' : 'resolve'; }
    renderWeapons(); renderItems();
  }
  async function resync() { const r = await new Promise(res => socket().timeout(8000).emit('game:state', {}, (e, v) => res(e ? null : v))); if (r?.ok) loadState(r.state); }

  /* ---------- 서버 메시지 ---------- */
  const on = {
    'game:start': s => begin(s),
    'game:state': st => loadState(st),
    'game:turn': d => {
      if (!sim) return resync();
      const t = sim.tankOf(d.uid);
      if (t) sim.turnStart(t);
      sim.wind = d.wind; if (d.event) sim.addEvent(d.event); if (d.sd) sim.suddenDeath();
      sim.restore(d.snapshot);
      turn = { uid: d.uid, turnNo: d.turnNo }; deadline = performance.now() + d.seconds * 1000; order = d.order;
      phase = 'aim'; power = 0; charging = false; turnItemUsed = false; sentDir = 0;
      if (d.uid === me()) { play('turn'); flags = { ...(d.flags || {}) }; const f = Object.keys(flags).map(k => ITEM_INFO[k].n); toast(f.length ? `내 차례예요! 걸려 있는 효과: ${f.join(', ')}` : '내 차례예요!'); if (weapon === 2 && !ssReady()) weapon = 0; }
      renderWeapons(); renderItems();
    },
    'game:pos': d => { const t = sim?.tankOf(d.uid); if (!t) return; t.x = d.x; t.y = d.y; t.facing = d.facing; t.fuel = d.fuel; t.movingVis = d.moving; if (d.tilt != null) t.tilt = d.tilt; if (d.uid !== me() || !mine()) t.angle = d.angle; else sim.clampAngle(t); },
    'game:item': d => {
      if (!sim) return; const t = sim.tankOf(d.uid);
      if (['double', 'power', 'teleport'].includes(d.id)) sim.float(t.x, t.y - 84, itemById(d.id).n, '#3a2600'); else sim.useItem(t, d.id);
      if (d.id === 'power') t.powerUp = true;
      sim.restore(d.snapshot);
      if (d.uid === me()) { bag[d.index].used = true; flags = { ...(d.flags || {}) }; } turnItemUsed = true; renderItems(); play('item');
    },
    'game:pickup': d => {
      if (!sim) return;
      if (d.uid === me()) { bag[d.index] = { id: d.item, used: false }; renderItems(); play('item'); toast(`보급품을 주웠어요: ${itemById(d.item).n}`); }
      else { const t = sim.tankOf(d.uid); if (t) toast(`${t.name}님이 보급품(${itemById(d.item).n})을 주웠어요.`); }
    },
    'game:shot': d => {
      if (!sim) return; sim.restore(d.snapshot); const t = sim.tankOf(d.uid); t.angle = d.angle; t.movingVis = false;
      sim.fire(t, d.slot, d.power, d.opts); phase = 'resolve'; charging = false;
      if (d.uid === me() && d.slot === 2) ssUsed = true;
      if (d.uid === me()) { flags = { ...(d.flags || {}) }; if (d.flags?.teleport && d.slot === 2) toast('순간이동은 필살기에 붙지 않아요. 다음 발사에 남아 있어요.'); }
      t.lastPower = d.power; renderItems(); renderWeapons();
    },
    'game:sync': d => {
      if (!sim) return;
      if (sim.ops.length !== d.ops || opsHash(sim.ops) !== d.hash) return resync();
      sim.restore(d.snapshot); phase = 'wait';
    },
    'game:pass': d => { const t = sim?.tankOf(d.uid); if (t) sim.float(t.x, t.y - 70, '턴 넘김', '#3a2600'); phase = 'wait'; },
    'game:timeout': d => { if (d.uid === me()) toast('시간이 다 돼서 차례가 넘어갔어요.', true); phase = 'wait'; },
    'game:left': d => { const t = sim?.tankOf(d.uid); if (t) { t.left = true; t.dead = true; sim.float(t.x, t.y - 60, '나감', '#3a2600'); } },
    'game:over': d => { phase = 'over'; turn = null; setTimeout(() => { showResult(d); play(d.results.find(r => r.uid === me())?.win ? 'win' : 'lose'); }, 1400); },
    'room:chat': m => { chatLines.push({ from: m.system ? '' : m.from, text: m.text, at: performance.now() }); if (chatLines.length > 30) chatLines.shift(); },
  };
  function showResult(d) {
    const meRes = d.results.find(r => r.uid === me());
    $('resultTitle').textContent = d.winnerTeam == null ? '무승부' : meRes?.win ? '승리!' : '패배';
    $('resultSub').textContent = `${d.turns}턴 · ${d.winnerTeam === 'red' ? '레드팀 승리' : d.winnerTeam === 'blue' ? '블루팀 승리' : d.winnerTeam ? (d.results.find(r => 'uid:' + r.uid === d.winnerTeam)?.nickname + ' 승리') : '모두 쓰러졌어요'} · 전적이 저장됐어요`;
    $('resultRows').innerHTML = d.results.sort((a, b) => b.win - a.win || b.kills - a.kills || b.dealt - a.dealt).map(r => `<tr><td class="${r.team}">${r.team === 'red' ? '레드' : r.team === 'blue' ? '블루' : '-'}</td><td>${esc(r.nickname)}${r.uid === me() ? ' (나)' : ''}</td><td>${TANK_NAMES[r.tankId]}</td><td>${r.kills}</td><td>${r.dealt.toLocaleString()}</td><td class="${r.win ? 'win' : 'lose'}">${r.win ? '승리' : r.left ? '나감' : r.sunk ? '낙사' : r.alive ? '생존' : '탈락'}</td></tr>`).join('');
    $('resultBox').hidden = false;
  }
  $('toRoomBtn').onclick = () => { $('resultBox').hidden = true; phase = 'idle'; onExit(); };

  /* ---------- 화면 ---------- */
  const ssReady = () => { const t = myTank(); return !!t && !t.dead && !ssUsed && t.hp <= t.max / 2; };
  let ssWas = false, ssPop = false, ssHpShown = -1;
  function renderWeapons() {
    const t = myTank(); if (!t) return;
    const ready = ssReady();
    $('weapons').innerHTML = SHELL_STATS[t.tankId].map((s, k) => {
      const info = `${s.n} <small>${s.dmg}${s.spread ? '×' + s.spread.length : ''}</small>`;
      if (k !== 2) return `<button data-w="${k}" aria-pressed="${weapon === k}"><kbd>${k + 1}</kbd>${info}</button>`;
      // 필살기 버튼: 잠김(체력 50% 넘음) · 준비됨(빛나며 흔들림) · 사용함 세 가지로 분명히 보이게
      const st = ssUsed ? 'used' : ready ? 'ready' : 'locked';
      const tag = st === 'ready' ? '<span class="ss-tag">사용 가능!</span>' : st === 'used' ? '<span class="ss-tag">사용함</span>' : `<span class="ss-tag">체력 ${Math.round(t.hp / t.max * 100)}% · 50% 이하에서</span>`;
      return `<button class="ss ss-${st}${st === 'ready' && ssPop ? ' ss-pop' : ''}" data-w="2" aria-pressed="${weapon === 2}" ${st === 'ready' ? '' : 'disabled'}><kbd>3</kbd><b class="ss-badge">SS</b>${info}${tag}</button>`;
    }).join('');
    ssPop = false;
  }
  // 파워 게이지를 누르면 그 자리(0~100)에 표시를 남긴다. 새로 누르면 옮겨지고, 다음 판에도 남는다(이 브라우저에 저장)
  const markStore = { get() { try { const v = localStorage.getItem('powMark'); return v == null ? null : +v; } catch { return null; } }, set(v) { try { localStorage.setItem('powMark', v); } catch {} } };
  function showMark(v) { const m = $('powMark'); if (v == null || !isFinite(v)) { m.hidden = true; return; } m.hidden = false; m.style.left = v + '%'; $('powMarkNum').textContent = Math.round(v); }
  showMark(markStore.get());
  $('powGauge').addEventListener('pointerdown', e => { const r = $('powGauge').getBoundingClientRect(); const v = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)); const rv = Math.round(v * 10) / 10; markStore.set(rv); showMark(rv); });
  $('weapons').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) { weapon = +b.dataset.w; renderWeapons(); } });
  function renderItems() {
    // 가방 칸은 그대로 두고, 쓴 아이템 칸만 비운다. 단축키 Q·W·E·R은 칸 자리마다 고정. 보급품은 빈칸에 들어온다
    const el = $('gameItems'); el.innerHTML = ''; const n = Math.max(BAG_SLOTS, bag.length), can = !turnItemUsed && mine();
    for (let i = 0; i < n; i++) {
      const b = bag[i], k = 'QWER'[i] || '';
      const btn = document.createElement('button'); btn.type = 'button';
      if (!b || b.used) { btn.className = 'tile empty'; btn.disabled = true; btn.setAttribute('aria-label', `${k} 빈칸`); btn.innerHTML = k ? `<span class="k">${k}</span>` : ''; el.append(btn); continue; }
      const it = itemById(b.id);
      btn.className = 'tile' + (can ? '' : ' off'); btn.disabled = !can; btn.setAttribute('aria-label', `${k} ${it.n}`);
      const c = document.createElement('canvas'); c.width = c.height = 34 * DPR; const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0); g.translate(17, 17); g.scale(34 / 64, 34 / 64); drawItemIcon(g, b.id, 0, true);
      btn.append(c); btn.insertAdjacentHTML('beforeend', `${k ? `<span class="k">${k}</span>` : ''}<span class="tip">${it.n}<small>${it.tip}</small></span>`);
      btn.onclick = () => useItem(i); el.append(btn);
    }
  }

  function useItem(i) { if (!mine() || turnItemUsed || bag[i]?.used) return; socket().emit('game:item', { index: i }, r => { if (r && !r.ok) toast(r.error, true); }); }
  (function ticks() { const g = $('dialTicks'); if (!g || g.childNodes.length) return; let h = ''; for (let d = 0; d < 360; d += 15) { const r0 = d % 45 ? 46 : 42, a = d * Math.PI / 180; h += `<line x1="${60 + r0 * Math.cos(a)}" y1="${60 - r0 * Math.sin(a)}" x2="${60 + 50 * Math.cos(a)}" y2="${60 - 50 * Math.sin(a)}" stroke="#4a62a0" stroke-width="${d % 45 ? 1 : 1.6}"/>`; } g.innerHTML = h; })();
  function hud() {
    const t = myTank(); if (!t) return;
    const [lo, hi] = sim.angleRange(t);
    $('deg').textContent = t.angle + '°'; $('degRange').textContent = `지금 ${lo}~${hi}°` + (t.tilt ? ` (기울기 ${t.tilt > 0 ? '앞으로' : '뒤로'} ${Math.abs(t.tilt)}°)` : '');
    // 각도계: 빨간 선 두 개가 최저·최고 각도, 흰 바늘이 지금 각도 (탱크가 보는 방향으로 뒤집힌다)
    const P = (d, r) => [60 + r * Math.cos(d * Math.PI / 180), 60 - r * Math.sin(d * Math.PI / 180)];
    const set = (id, d, r) => { const [x, y] = P(d, r); $(id).setAttribute('x2', x); $(id).setAttribute('y2', y); };
    set('needle', t.angle, 46); set('lineLo', lo, 52); set('lineHi', hi, 52);
    const [x1, y1] = P(lo, 50), [x2, y2] = P(hi, 50);
    $('dialRange').setAttribute('d', `M60 60 L${x1} ${y1} A50 50 0 ${hi - lo > 180 ? 1 : 0} 0 ${x2} ${y2} Z`);
    $('dialG').setAttribute('transform', t.facing < 0 ? 'translate(120 0) scale(-1 1)' : '');
    $('dialLo').textContent = lo; $('dialHi').textContent = hi;
    $('powFill').style.width = power + '%'; $('powNum').textContent = Math.round(power);
    $('powLast').hidden = t.lastPower == null; $('powLast').style.left = (t.lastPower || 0) + '%';
    $('fuelFill').style.width = Math.min(100, t.fuel) + '%'; $('fuelNum').textContent = Math.round(t.fuel);
    $('hpFill').style.width = (t.hp / t.max * 100) + '%'; $('hpNum').textContent = t.hp;
    $('delayNum').textContent = t.delay;
    const cur = turn && sim.tankOf(turn.uid), chip = $('turnChip');
    chip.textContent = phase === 'over' ? '게임 끝' : !cur ? '준비 중' : cur.uid === me() ? '내 차례' : `${cur.name} 차례`;
    chip.classList.toggle('mine', mine());
    const left = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
    $('timer').textContent = phase === 'aim' ? left : '–';
    if (mine() && left <= 5 && left > 0 && left !== lastTick) { lastTick = left; play('tick'); }
    const names = order.map(uid => sim.tankOf(uid)).filter(Boolean);
    $('order').innerHTML = `${sim.map.n} · 턴 ${turn?.turnNo || 0} · 순서 ` + names.map(x => `<span class="${x.uid === turn?.uid ? 'cur' : ''}">${esc(x.name)}</span>`).join('');
    const fl = Object.keys(flags).map(k => ITEM_INFO[k].n); $('flags').textContent = fl.length ? '대기 중 효과: ' + fl.join(' + ') : ''; $('flags').hidden = !fl.length;
    $('passBtn').disabled = !mine();
    // 필살기가 막 쓸 수 있게 되면: 소리 + 전장 가운데 알림 + 버튼이 튀어 오르며 빛난다
    const r = ssReady(), mt = myTank(), hpPct = mt ? Math.round(mt.hp / mt.max * 100) : -1;
    if (r && ssWas === false) { ssPop = true; play('ssready'); if (ren) ren.banner = { text: '필살기 준비 완료! (3번 키)', t0: ren.t }; }
    if (r !== ssWas || hpPct !== ssHpShown) { ssWas = r; ssHpShown = hpPct; renderWeapons(); }
  }
  function loop(now) {
    if (!running) return;
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (sim && !$('s-game').hidden) {
      acc = Math.min(acc + dt, .5);
      while (acc >= DT) { acc -= DT; sim.step(DT); }
      sim.picked.length = 0; // 가방에 넣는 건 서버가 알려 준다 (game:pickup)
      ren.update(dt);
      if (mine()) {
        const t = myTank(), dir = keys.left ? -1 : keys.right ? 1 : 0;
        if (dir !== sentDir) { sentDir = dir; socket().emit('game:move', { dir }); }
        if (keys.up || keys.down) { t.aimAcc = (t.aimAcc || 0) + 30 * dt; while (t.aimAcc >= 1) { t.aimAcc--; t.angle += keys.up ? 1 : -1; sim.clampAngle(t); aimDirty = true; } }
        if (aimDirty && now - lastAimSent > 80) { aimDirty = false; lastAimSent = now; socket().emit('game:aim', { angle: t.angle }); }
        if (charging) power = Math.min(100, power + 55 * dt);
      }
      updateCam(dt);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.save(); ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
      ren.draw(ctx, { active: phase !== 'over' ? turn?.uid : null, cam, vw: VW, vh: VH });
      if (mine() && !myTank().dead) ren.drawAimFan(ctx, myTank());
      ctx.restore();
      ren.drawBanner(ctx, VW, VH);
      ren.drawWind(ctx, VW / 2, 40);
      drawMinimap(); drawRoster(); drawChat(now); drawOffscreen();
      hud();
    }
    requestAnimationFrame(loop);
  }

  /* ---------- 카메라: 지금 차례 탱크 → 날아가는 포탄 → 필살기 순서로 따라간다. 끌거나 미니맵을 누르면 잠시 직접 보기 ---------- */
  function clampCam() { cam.x = Math.max(0, Math.min(sim.w - VW, cam.x)); cam.y = Math.max(0, Math.min(sim.h - VH, cam.y)); }
  function camGoal() {
    if (sim.specials.length) { const s = sim.specials[0]; return [s.wx ?? s.x, (s.gy ?? s.y) - 140]; }
    if (sim.shells.length) { const s = sim.shells[0]; return [s.x + s.vx * .25, s.y]; }
    const t = turn && sim.tankOf(turn.uid); if (t && !t.sunk) return [t.x, t.y - 60];
    return null;
  }
  function updateCam(dt) {
    if (camHold > 0 && !sim.shells.length && !sim.specials.length) { camHold -= dt; return; }
    const g = camGoal(); if (!g) return;
    const k = Math.min(1, dt * (sim.shells.length ? 5 : 3));
    cam.x += (g[0] - VW / 2 - cam.x) * k; cam.y += (g[1] - VH * .55 - cam.y) * k; clampCam();
  }
  function toCanvas(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * VW / r.width, (e.clientY - r.top) * VH / r.height]; }
  let drag = null;
  cv.addEventListener('pointerdown', e => {
    if (!sim) return; const [x, y] = toCanvas(e);
    if (x >= MM.x && x <= MM.x + MM.w && y >= MM.y && y <= MM.y + MM.h) { cam.x = (x - MM.x) / MM.w * sim.w - VW / 2; cam.y = (y - MM.y) / MM.h * sim.h - VH / 2; clampCam(); camHold = 3; return; }
    drag = { x, y, cx: cam.x, cy: cam.y }; cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => { if (!drag) return; const [x, y] = toCanvas(e); cam.x = drag.cx - (x - drag.x); cam.y = drag.cy - (y - drag.y); clampCam(); camHold = 3; });
  ['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, () => drag = null));
  const teamCol = t => t.team === 'red' ? '#ff6a55' : t.team === 'blue' ? '#55aef0' : t.uid === me() ? '#ffb703' : '#f4efe1';
  function drawMinimap() {
    const c = ctx, { x, y, w, h } = MM, k = w / sim.w;
    c.save(); c.globalAlpha = .92; c.fillStyle = 'rgba(20,28,52,.85)'; c.fillRect(x - 3, y - 3, w + 6, h + 6);
    c.drawImage(ren.sky, x, y, w, h); c.drawImage(ren.fg, x, y, w, h);
    if (sim.map.liquid && sim.map.liquid.type !== 'void' || sim.sdLiquid) { c.fillStyle = sim.map.liquid?.type === 'lava' ? 'rgba(255,120,40,.8)' : 'rgba(80,160,230,.8)'; c.fillRect(x, y + sim.liquidY * k, w, h - sim.liquidY * k); }
    c.globalAlpha = 1;
    // 회오리(흰 소용돌이 기둥)·불기둥(주황 기둥)은 땅에서 위 끝까지, 보급 비행기·상자도 표시
    sim.events.forEach(e => {
      const ex = x + e.x * k, gy = y + (e.gy ?? sim.ground(e.x, 0)) * k;
      if (e.type === 'tornado') { const g = c.createLinearGradient(0, y, 0, gy); g.addColorStop(0, 'rgba(230,238,245,.25)'); g.addColorStop(1, 'rgba(230,238,245,.95)'); c.fillStyle = g; c.fillRect(ex - 3, y, 6, gy - y); c.strokeStyle = 'rgba(80,90,110,.9)'; c.lineWidth = 1; for (let j = 1; j < 6; j++) { const yy = gy - (gy - y) * j / 6; c.beginPath(); c.ellipse(ex, yy, 3.5, 1.2, 0, 0, Math.PI * 2); c.stroke(); } }
      else if (e.type === 'pillar' && e.t > 1) { const g = c.createLinearGradient(0, y, 0, gy); g.addColorStop(0, 'rgba(255,200,90,.35)'); g.addColorStop(1, 'rgba(255,110,30,1)'); c.fillStyle = g; c.fillRect(ex - 3, y, 6, gy - y); }
      else if (e.type === 'pillar') { c.fillStyle = (performance.now() / 150) % 2 < 1 ? '#ff7a3c' : '#7a2a10'; c.fillRect(ex - 3, gy - 3, 6, 3); }
      else if (e.type === 'supply') { const px = x + Sim.planeX(sim, e) * k; if (px > x && px < x + w) { c.fillStyle = '#f1f3f5'; c.fillRect(px - 5, y + 3, 10, 3); c.fillStyle = '#e8590c'; c.fillRect(px - 2, y + 2, 4, 5); } }
    });
    (sim.crates || []).forEach(cr => { c.fillStyle = '#ffd43b'; c.strokeStyle = '#5a3a10'; c.lineWidth = 1; c.fillRect(x + cr.x * k - 2.5, y + cr.y * k - 5, 5, 5); c.strokeRect(x + cr.x * k - 2.5, y + cr.y * k - 5, 5, 5); });
    sim.tanks.forEach(t => { if (t.left || t.sunk) return; c.fillStyle = t.dead ? '#555' : teamCol(t); c.beginPath(); c.arc(x + t.x * k, y + t.y * k - 3, t.uid === turn?.uid ? 4 : 3, 0, 7); c.fill(); });
    sim.shells.forEach(s => { c.fillStyle = '#fff'; c.fillRect(x + s.x * k - 1.5, y + s.y * k - 1.5, 3, 3); });
    c.strokeStyle = '#ffd34d'; c.lineWidth = 1.5; c.strokeRect(x + cam.x * k, y + cam.y * k, VW * k, VH * k);
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.strokeRect(x - .5, y - .5, w + 1, h + 1);
    c.restore();
  }
  function drawRoster() {
    const c = ctx, x0 = MM.x, y0 = MM.y + MM.h + 14;
    c.save(); c.font = '600 12.5px "Noto Sans KR", sans-serif'; c.textAlign = 'left'; c.lineJoin = 'round';
    sim.tanks.forEach((t, i) => {
      const y = y0 + i * 18, txt = (t.uid === turn?.uid ? '▶ ' : '') + t.name + (t.left ? ' (나감)' : t.dead ? ' (탈락)' : '');
      c.lineWidth = 3; c.strokeStyle = 'rgba(20,20,35,.75)'; c.strokeText(txt, x0, y); c.fillStyle = t.dead ? '#9aa0ad' : teamCol(t); c.fillText(txt, x0, y);
      if (!t.dead) { c.fillStyle = 'rgba(20,28,52,.7)'; c.fillRect(x0 + 140, y - 8, 70, 6); c.fillStyle = t.hp / t.max > .5 ? '#3fae4a' : t.hp / t.max > .25 ? '#f0a020' : '#d63c3c'; c.fillRect(x0 + 140, y - 8, 70 * t.hp / t.max, 6); }
    });
    c.restore();
  }
  function drawChat(now) {
    const c = ctx, lines = chatLines.filter(l => now - l.at < 15000).slice(-6);
    c.save(); c.font = '13px "Noto Sans KR", sans-serif'; c.textAlign = 'left'; c.lineJoin = 'round';
    lines.forEach((l, i) => { const a = Math.min(1, (15000 - (now - l.at)) / 2000), y = 26 + i * 19; c.globalAlpha = a; const s = l.from ? `[${l.from}] ${l.text}` : l.text; c.lineWidth = 3.5; c.strokeStyle = 'rgba(15,20,40,.8)'; c.strokeText(s, 14, y); c.fillStyle = l.from ? '#f4efe1' : '#ffd34d'; c.fillText(s, 14, y); });
    c.restore();
  }
  // 화면 밖 아군·적 위치를 가장자리 화살표로 알려 준다
  function drawOffscreen() {
    const c = ctx;
    sim.tanks.forEach(t => { if (t.dead) return; const sx = t.x - cam.x, sy = t.y - 20 - cam.y; if (sx >= 0 && sx <= VW && sy >= 0 && sy <= VH) return;
      const x = Math.max(14, Math.min(VW - 14, sx)), y = Math.max(14, Math.min(VH - 14, sy)), a = Math.atan2(sy - y, sx - x);
      c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = teamCol(t); c.strokeStyle = 'rgba(20,20,35,.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, -7); c.lineTo(-6, 7); c.closePath(); c.fill(); c.stroke(); c.restore(); });
  }

  /* ---------- 입력 ---------- */
  const active = () => !$('s-game').hidden && sim;
  function pass() { if (!mine()) return; charging = false; socket().emit('game:pass', {}, r => { if (r && !r.ok) toast(r.error, true); }); }
  $('passBtn').onclick = pass;
  const muteBtn = $('muteBtn'); const muteLabel = () => muteBtn.textContent = isMuted() ? '소리 켜기' : '소리 끄기'; muteLabel();
  muteBtn.onclick = () => { setMuted(!isMuted()); muteLabel(); };
  // 게임 나가기: 실수로 누르지 않게 두 번 눌러야 나간다. 나가면 내 탱크는 탈락한다
  let quitArm = 0; const quitBtn = $('quitBtn');
  quitBtn.onclick = () => {
    if (phase === 'over' || phase === 'idle') return;
    if (performance.now() - quitArm > 3000) { quitArm = performance.now(); quitBtn.textContent = '한 번 더 누르면 나가요'; setTimeout(() => quitBtn.textContent = '게임 나가기', 3000); return; }
    phase = 'idle'; quitBtn.textContent = '게임 나가기';
    socket().emit('room:leave', {}, () => (onQuit || onExit)());
  };
  $('gameChat').addEventListener('submit', e => { e.preventDefault(); const i = $('gameMsg'); if (!i.value.trim()) { i.blur(); return; } socket().emit('room:chat', { text: i.value }, r => { if (r && !r.ok) toast(r.error, true); }); i.value = ''; i.blur(); });
  function startCharge() { if (mine() && !charging) { charging = true; power = 0; } }
  function release() {
    if (!charging) return; charging = false; if (!mine()) return;
    const t = myTank(); socket().emit('game:aim', { angle: t.angle });
    socket().emit('game:fire', { slot: weapon, power: Math.max(1, power) }, r => { if (r && !r.ok) toast(r.error, true); });
  }
  const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  addEventListener('keydown', e => {
    if (!active() || e.target.matches('input, select, textarea')) return;
    if (e.key === 'Enter') { e.preventDefault(); keys = {}; $('gameMsg').focus(); return; }
    const k = KEYMAP[e.key]; if (k) { keys[k] = true; e.preventDefault(); }
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) startCharge(); }
    // 한글 입력 상태에서도 되도록 글자(e.key) 대신 키 위치(e.code)로 본다. 숫자 키패드도 된다
    const code = e.code || '', num = /^(Digit|Numpad)[1-3]$/.test(code) ? +code.slice(-1) : ['1', '2', '3'].includes(e.key) ? +e.key : 0;
    const letter = /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : (e.key || '').toLowerCase();
    if (letter === 'p' && !e.repeat) pass();
    if (num === 1 || num === 2) { weapon = num - 1; renderWeapons(); }
    if (num === 3 && !e.repeat) { if (ssReady()) { weapon = 2; renderWeapons(); } else { const t = myTank(); toast(ssUsed ? '필살기는 이미 썼어요.' : `필살기는 체력 50% 이하에서 쓸 수 있어요. (지금 ${t ? Math.round(t.hp / t.max * 100) : 0}%)`, true); } }
    const qi = 'qwer'.indexOf(letter); if (qi >= 0 && !e.repeat && bag[qi] && !bag[qi].used) useItem(qi);
  });
  addEventListener('keyup', e => { const k = KEYMAP[e.key]; if (k) keys[k] = false; if (e.code === 'Space' && active()) { e.preventDefault(); release(); } });
  addEventListener('blur', () => { keys = {}; });
  document.querySelectorAll('[data-hold]').forEach(b => {
    const k = b.dataset.hold;
    b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; b.setPointerCapture(e.pointerId); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, () => keys[k] = false));
  });
  const fb = $('fireBtn');
  fb.addEventListener('pointerdown', e => { e.preventDefault(); fb.setPointerCapture(e.pointerId); startCharge(); });
  fb.addEventListener('pointerup', release); fb.addEventListener('pointercancel', release);

  return { on, inGame: () => phase !== 'idle' && phase !== 'over' };
}
