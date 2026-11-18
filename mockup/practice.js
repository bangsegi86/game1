// 목업의 연습 전투: 실제 서버의 GameSession을 브라우저 안에서 돌리고, 실제 게임 화면(battle.js)을 그대로 쓴다.
// 그래서 목업에서 보이는 규칙(회오리·불기둥·더블·아이템 유지 등)이 실제 게임과 똑같다.
import { GameSession } from 'server/game.js';
import { createBattle } from 'client/battle.js';
import { DT } from 'sim/world.js';
import { SHELL_STATS } from 'shared/gamedata.js';

const ME = 1, AI = 2;
let session = null, battle = null, timer = null, aiTimer = null;
const now = () => performance.now();

// 서버 대신 GameSession을 바로 부르는 가짜 소켓
const fakeSocket = {
  connected: true,
  emit(ev, data = {}, cb) {
    const reply = r => cb && cb(r);
    try {
      if (!session) throw new Error('게임이 없어요.');
      if (ev === 'game:state') return reply({ ok: true, state: session.fullState(ME) });
      if (ev === 'game:move') session.onMove(ME, data.dir);
      if (ev === 'game:aim') session.onAim(ME, data.angle);
      if (ev === 'game:fire') session.onFire(ME, data.slot, data.power);
      if (ev === 'game:item') session.onItem(ME, data.index);
      if (ev === 'game:pass') session.onPass(ME);
      reply({ ok: true });
    } catch (e) { reply({ ok: false, error: e.message }); }
  },
  timeout() { return { emit: (ev, data, cb) => this.emit(ev, data, r => cb(null, r)) }; },
};

function toast(msg, err) {
  let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.append(t); }
  t.textContent = msg; t.classList.toggle('err', !!err); t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, 2400);
}

function aiTurn() {
  const s = session, sim = s.sim, me = sim.tankOf(AI), foe = sim.tankOf(ME);
  if (!me || !foe || foe.dead) return;
  const p = s.player(AI);
  // 가끔 아이템을 쓰고, 체력이 반 아래면 필살기
  const k = p.items.findIndex(i => !i.used);
  if (k >= 0 && Math.random() < .35) { try { s.onItem(AI, k); } catch {} }
  me.facing = Math.sign(foe.x - me.x) || -1;
  const slot = !p.ssUsed && me.hp <= me.max / 2 && Math.random() < .6 ? 2 : Math.random() < .7 ? 0 : 1;
  const sh = SHELL_STATS[me.tankId][slot];
  if (sh.shape === 'line') { me.angle = Math.round(Math.max(me.S.amin, Math.min(me.S.amax, Math.atan2(me.y - 20 - (foe.y - 18), Math.abs(foe.x - me.x)) * 180 / Math.PI))); s.onAim(AI, me.angle); s.onFire(AI, slot, 60); return; }
  me.angle = Math.round(Math.min(me.S.amax, Math.max(me.S.amin, 40 + Math.random() * 12))); s.onAim(AI, me.angle);
  const pw = Math.max(15, Math.min(100, sim.solvePower(me, slot, foe.x, true) + (Math.random() * 10 - 5)));
  s.onFire(AI, slot, pw);
}

function start(cfg) {
  clearInterval(timer); clearTimeout(aiTimer);
  const foeTank = cfg.tank === 'laser' ? 'hammer' : 'laser';
  session = new GameSession({ roomId: 1, mapId: cfg.map, mode: 'team', turnSeconds: 20, players: [
    { userId: ME, nickname: '포탄왕', team: 'red', tankId: cfg.tank, items: cfg.bag },
    { userId: AI, nickname: '연습 상대', team: 'blue', tankId: foeTank, items: ['repair', 'power', 'double', 'shield'] },
  ] }, {
    now,
    send: (ev, d) => {
      queueMicrotask(() => battle.on[ev]?.(JSON.parse(JSON.stringify(d))));
      if (ev === 'game:turn' && d.uid === AI) { clearTimeout(aiTimer); aiTimer = setTimeout(() => { try { aiTurn(); } catch (e) { console.error(e); } }, 1300); }
    },
    onOver: () => {},
  });
  battle.on['game:start'](session.startInfo());
  let last = now(), acc = 0;
  timer = setInterval(() => { const t = now(); acc = Math.min(acc + (t - last) / 1000, .25); last = t; while (acc >= DT) { acc -= DT; session.tick(DT); } }, 1000 / 60);
}

battle = createBattle({ socket: () => fakeSocket, me: () => ME, toast, onExit: () => { location.hash = 'room'; } });
let lastCfg = null;
window.practice = { start: cfg => { lastCfg = cfg; start(cfg); } };
const maybeStart = () => { if (location.hash === '#game' && (!session || session.phase === 'over')) window.practice.start(lastCfg || { tank: 'hammer', map: 'valley', bag: ['double', 'teleport', 'power', 'repair'] }); };
addEventListener('hashchange', maybeStart); maybeStart();
