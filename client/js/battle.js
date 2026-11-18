// 전투 화면: 서버가 보낸 입력을 같은 시뮬레이션으로 재생하고, 내 차례에는 조작을 보낸다
import { Sim, DT, opsHash } from '/shared/sim/world.js';
import { SHELL_STATS, TANK_NAMES } from '/shared/gamedata.js';
import { Renderer } from './render.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const W = 960, H = 480;

export function createBattle({ socket, me, toast, onExit }) {
  const cv = $('field'); cv.width = W * DPR; cv.height = H * DPR; const ctx = cv.getContext('2d');
  let sim = null, ren = null, start = null, bag = [], ssUsed = false, turn = null, deadline = 0, phase = 'idle', order = [];
  let weapon = 0, power = 0, charging = false, turnItemUsed = false, keys = {}, sentDir = 0, lastAimSent = 0, aimDirty = false, acc = 0, last = 0, running = false;
  const myTank = () => sim?.tankOf(me());
  const mine = () => phase === 'aim' && turn?.uid === me();

  function begin(s) {
    start = s; sim = new Sim({ map: s.mapId, w: W, h: H });
    s.players.forEach(p => { const t = sim.addTank({ uid: p.uid, tankId: p.tankId, x: p.x, facing: p.facing, team: p.team, name: p.nickname }); });
    const mp = s.players.find(p => p.uid === me());
    bag = (mp?.items || []).map(id => ({ id, used: false })); ssUsed = false; weapon = 0; power = 0; charging = false;
    ren = new Renderer(sim, { me: me() });
    phase = 'wait'; turn = null; order = [];
    $('resultBox').hidden = true;
    renderWeapons(); renderItems();
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  }
  function loadState(st) {
    begin(st.start);
    for (const op of st.ops) { sim.applyOp(op); sim.ops.push(op); }
    ren.rebuild(); sim.restore(st.snapshot);
    bag = st.bag.map(b => ({ ...b })); ssUsed = !!st.ssUsed;
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
      if (d.uid === me()) { toast('내 차례예요!'); if (weapon === 2 && !ssReady()) weapon = 0; }
      renderWeapons(); renderItems();
    },
    'game:pos': d => { const t = sim?.tankOf(d.uid); if (!t) return; t.x = d.x; t.y = d.y; t.facing = d.facing; t.fuel = d.fuel; t.movingVis = d.moving; if (d.uid !== me() || !mine()) t.angle = d.angle; },
    'game:item': d => {
      if (!sim) return; const t = sim.tankOf(d.uid);
      if (['double', 'power', 'teleport'].includes(d.id)) sim.float(t.x, t.y - 84, itemById(d.id).n, '#3a2600'); else sim.useItem(t, d.id);
      sim.restore(d.snapshot);
      if (d.uid === me()) { bag[d.index].used = true; } turnItemUsed = true; renderItems();
    },
    'game:shot': d => {
      if (!sim) return; sim.restore(d.snapshot); const t = sim.tankOf(d.uid); t.angle = d.angle; t.movingVis = false;
      sim.fire(t, d.slot, d.power, d.opts); phase = 'resolve'; charging = false;
      if (d.uid === me() && d.slot === 2) ssUsed = true;
      t.lastPower = d.power; renderItems(); renderWeapons();
    },
    'game:sync': d => {
      if (!sim) return;
      if (sim.ops.length !== d.ops || opsHash(sim.ops) !== d.hash) return resync();
      sim.restore(d.snapshot); phase = 'wait';
    },
    'game:timeout': d => { if (d.uid === me()) toast('시간이 다 돼서 차례가 넘어갔어요.', true); phase = 'wait'; },
    'game:left': d => { const t = sim?.tankOf(d.uid); if (t) { t.left = true; t.dead = true; sim.float(t.x, t.y - 60, '나감', '#3a2600'); } },
    'game:over': d => { phase = 'over'; turn = null; setTimeout(() => showResult(d), 1400); },
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
  const ssReady = () => { const t = myTank(); return t && !ssUsed && t.hp <= t.max / 2; };
  function renderWeapons() {
    const t = myTank(); if (!t) return;
    $('weapons').innerHTML = SHELL_STATS[t.tankId].map((s, k) => `<button data-w="${k}" aria-pressed="${weapon === k}" ${k === 2 && !ssReady() ? 'disabled' : ''}><kbd>${k === 2 ? 'SS' : k + 1}</kbd>${s.n} <small>${s.dmg}${s.spread ? '×' + s.spread.length : ''}</small></button>`).join('');
  }
  $('weapons').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) { weapon = +b.dataset.w; renderWeapons(); } });
  function renderItems() {
    const el = $('gameItems'); el.innerHTML = ''; let key = 0;
    bag.forEach((b, i) => {
      const it = itemById(b.id), k = 'QWERTY'[key]; key += it.size;
      const btn = document.createElement('button'); btn.className = `item ${it.size === 2 ? 'w2' : ''} ${b.used ? 'used' : ''}`; btn.disabled = b.used || turnItemUsed || !mine(); btn.title = it.d;
      const c = document.createElement('canvas'); c.style.width = c.style.height = '36px'; c.width = c.height = 36 * DPR; const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0); g.translate(18, 18); g.scale(36 / 64, 36 / 64); drawItemIcon(g, b.id, 0, true);
      btn.append(c); btn.insertAdjacentHTML('beforeend', `<div><b><kbd>${k}</kbd> ${it.n}</b><small>${b.used ? '사용함' : it.tip}</small></div>`);
      btn.onclick = () => useItem(i); el.append(btn);
    });
  }
  function useItem(i) { if (!mine() || turnItemUsed || bag[i]?.used) return; socket().emit('game:item', { index: i }, r => { if (r && !r.ok) toast(r.error, true); }); }
  function hud() {
    const t = myTank(); if (!t) return;
    $('deg').textContent = t.angle + '°'; $('degRange').textContent = `허용 ${t.S.amin}~${t.S.amax}°`;
    const a = t.angle * Math.PI / 180; $('needle').setAttribute('x2', 56 + 44 * Math.cos(a)); $('needle').setAttribute('y2', 58 - 44 * Math.sin(a));
    const arc = d => [56 + 48 * Math.cos(d * Math.PI / 180), 58 - 48 * Math.sin(d * Math.PI / 180)], [x1, y1] = arc(t.S.amin), [x2, y2] = arc(t.S.amax);
    $('dialRange').setAttribute('d', `M${x2} ${y2} A48 48 0 0 1 ${x1} ${y1}`);
    $('powFill').style.width = power + '%'; $('powNum').textContent = Math.round(power);
    $('powLast').hidden = t.lastPower == null; $('powLast').style.left = (t.lastPower || 0) + '%';
    $('fuelFill').style.width = Math.min(100, t.fuel) + '%'; $('fuelNum').textContent = Math.round(t.fuel);
    $('hpFill').style.width = (t.hp / t.max * 100) + '%'; $('hpNum').textContent = t.hp;
    const cur = turn && sim.tankOf(turn.uid), chip = $('turnChip');
    chip.textContent = phase === 'over' ? '게임 끝' : !cur ? '준비 중' : cur.uid === me() ? '내 차례' : `${cur.name} 차례`;
    chip.classList.toggle('mine', mine());
    $('timer').textContent = phase === 'aim' ? Math.max(0, Math.ceil((deadline - performance.now()) / 1000)) : '–';
    const names = order.map(uid => sim.tankOf(uid)).filter(Boolean);
    $('order').innerHTML = `${sim.map.n} · 턴 ${turn?.turnNo || 0} · 순서 ` + names.map(x => `<span class="${x.uid === turn?.uid ? 'cur' : ''}">${esc(x.name)}</span>`).join('');
    const ssBtn = document.querySelector('#weapons [data-w="2"]'); if (ssBtn && ssBtn.disabled === ssReady()) renderWeapons();
  }
  function loop(now) {
    if (!running) return;
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (sim && !$('s-game').hidden) {
      acc = Math.min(acc + dt, .5);
      while (acc >= DT) { acc -= DT; sim.step(DT); }
      ren.update(dt);
      if (mine()) {
        const t = myTank(), dir = keys.left ? -1 : keys.right ? 1 : 0;
        if (dir !== sentDir) { sentDir = dir; socket().emit('game:move', { dir }); }
        if (keys.up || keys.down) { t.aimAcc = (t.aimAcc || 0) + 30 * dt; while (t.aimAcc >= 1) { t.aimAcc--; t.angle = Math.max(t.S.amin, Math.min(t.S.amax, t.angle + (keys.up ? 1 : -1))); aimDirty = true; } }
        if (aimDirty && now - lastAimSent > 80) { aimDirty = false; lastAimSent = now; socket().emit('game:aim', { angle: t.angle }); }
        if (charging) power = Math.min(100, power + 55 * dt);
      }
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ren.draw(ctx, { active: phase !== 'over' ? turn?.uid : null });
      ren.drawWind(ctx, W / 2, 40);
      if (mine()) { const t = myTank(), a = t.angle * Math.PI / 180, [mx, my] = sim.muzzle(t); ctx.setLineDash([3, 6]); ctx.strokeStyle = 'rgba(42,47,61,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a) * 44 * t.facing, my - Math.sin(a) * 44); ctx.stroke(); ctx.setLineDash([]); }
      hud();
    }
    requestAnimationFrame(loop);
  }

  /* ---------- 입력 ---------- */
  const active = () => !$('s-game').hidden && sim;
  function startCharge() { if (mine() && !charging) { charging = true; power = 0; } }
  function release() {
    if (!charging) return; charging = false; if (!mine()) return;
    const t = myTank(); socket().emit('game:aim', { angle: t.angle });
    socket().emit('game:fire', { slot: weapon, power: Math.max(1, power) }, r => { if (r && !r.ok) toast(r.error, true); });
  }
  const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  addEventListener('keydown', e => {
    if (!active() || e.target.matches('input, select, textarea')) return;
    const k = KEYMAP[e.key]; if (k) { keys[k] = true; e.preventDefault(); }
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) startCharge(); }
    if (e.key === '1') { weapon = 0; renderWeapons(); } if (e.key === '2') { weapon = 1; renderWeapons(); } if (e.key === '3' && ssReady()) { weapon = 2; renderWeapons(); }
    const qi = 'qwerty'.indexOf(e.key.toLowerCase()); if (qi >= 0 && !e.repeat) { let c = 0; bag.forEach((b, i) => { if (c === qi) useItem(i); c += itemById(b.id).size; }); }
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
