/* 포탄대결 공용 아트: 탱크·포탄·폭발·아이템 아이콘 (Canvas 2D) */
const OUT = '#241d2e', TAU = Math.PI * 2, DPR = Math.min(2, window.devicePixelRatio || 1);
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); } }
function fs(c, fill, lw = 3) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(); }
function vg(c, y0, y1, ...cols) { const g = c.createLinearGradient(0, y0, 0, y1); cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col)); return g; }
function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }

/* ---------- 공통 부품 ---------- */
function tread(c, x0, x1, h, S, col = ['#625a72', '#2b2636']) {
  const w = x1 - x0;
  rr(c, x0, -h, w, h, h / 2); fs(c, vg(c, -h, 0, col[0], col[1]));
  c.save(); rr(c, x0, -h, w, h, h / 2); c.clip();
  c.fillStyle = 'rgba(0,0,0,.35)';
  const off = ((S.wheel * 14) % 7 + 7) % 7;
  for (let x = x0 - 7 + off; x < x1 + 7; x += 7) c.fillRect(x, -h + 1, 3, 3);
  for (let x = x0 - off; x < x1 + 7; x += 7) c.fillRect(x, -4, 3, 3);
  c.restore();
  const n = Math.max(3, Math.round(w / 24)), r = h * 0.3;
  for (let i = 0; i < n; i++) {
    const cx = x0 + h / 2 + i * (w - h) / (n - 1), cy = -h / 2;
    circ(c, cx, cy, r); fs(c, '#a9a2b8', 2);
    c.save(); c.translate(cx, cy); c.rotate(S.wheel * 3);
    c.strokeStyle = '#5a536a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-r * .7, 0); c.lineTo(r * .7, 0); c.moveTo(0, -r * .7); c.lineTo(0, r * .7); c.stroke();
    c.restore();
  }
}
function pipe(c, len, th, c1, c2, ring) {
  rr(c, 0, -th / 2, len, th, th * .35); fs(c, vg(c, -th / 2, th / 2, c1, c2), 2.5);
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(3, -th / 2 + 2, len - 12, Math.max(1.5, th * .15));
  rr(c, len - 7, -th / 2 - 2.5, 9, th + 5, 2.5); fs(c, ring, 2.5);
}
function barrel(c, T, S) {
  const [px, py] = T.pivot;
  c.save(); c.translate(px, py); c.rotate(-S.angle * Math.PI / 180); c.translate(-S.recoil * 7, 0); T.barrel(c, S); c.restore();
}
function tip(T, S) {
  const [px, py] = T.pivot, a = -S.angle * Math.PI / 180, L = T.len - S.recoil * 7 + 4;
  return [px + Math.cos(a) * L, py + Math.sin(a) * L, a];
}
function eyes(c, T, S) {
  const r = T.er, m = S.mood, robot = T.robot;
  const blink = (m === 'normal') && ((S.t + T.seed * 1.7) % 3.4) < 0.12;
  const ink = robot ? '#d9fdff' : OUT;
  T.eyes.forEach(([x, y], i) => {
    c.save(); c.translate(x, y); c.lineCap = 'round'; c.lineJoin = 'round';
    if (robot) { c.shadowColor = '#2fe0ff'; c.shadowBlur = 8; }
    c.strokeStyle = ink; c.lineWidth = 2.6;
    if (m === 'dead') { const k = r * .8; c.beginPath(); c.moveTo(-k, -k); c.lineTo(k, k); c.moveTo(k, -k); c.lineTo(-k, k); c.stroke(); }
    else if (m === 'hurt') { const k = r * .85, d = i ? -1 : 1; c.beginPath(); c.moveTo(-k * d, -k); c.lineTo(k * d, 0); c.lineTo(-k * d, k); c.stroke(); }
    else if (m === 'happy') { c.beginPath(); c.arc(0, r * .35, r * .8, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    else if (blink) { c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.stroke(); }
    else if (robot) {
      c.fillStyle = ink;
      if (m === 'focus') { rr(c, -r, -1.6, r * 2, 3.2, 1.6); c.fill(); }
      else if (m === 'sad') { rr(c, -r * .8, -r * .2, r * 1.6, r * .9, r * .4); c.fill(); }
      else { rr(c, -r * .65, -r, r * 1.3, r * 2, r * .6); c.fill(); }
    } else {
      ell(c, 0, 0, r, r * 1.15); fs(c, '#fff', 2);
      const py = m === 'sad' ? r * .35 : 0;
      circ(c, r * .28, py, r * .58); c.fillStyle = OUT; c.fill();
      circ(c, r * .46, py - r * .26, r * .2); c.fillStyle = '#fff'; c.fill();
      if (m === 'focus' || m === 'sad') {
        const hi = -r * 1.5, lo = m === 'focus' ? -r * .3 : -r * .55;
        const L = m === 'focus' ? (i ? [lo, hi] : [hi, lo]) : (i ? [hi, lo] : [lo, hi]);
        c.fillStyle = T.c.face || T.c.main;
        c.beginPath(); c.moveTo(-r - 2, -r * 1.6 - 3); c.lineTo(r + 2, -r * 1.6 - 3); c.lineTo(r + 2, L[1]); c.lineTo(-r - 2, L[0]); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(-r - 2, L[0]); c.lineTo(r + 2, L[1]); c.stroke();
      }
    }
    c.restore();
  });
  if (!robot && m !== 'dead') T.eyes.forEach(([x, y]) => { ell(c, x - r * .1, y + r * 1.7, r * .75, r * .38); c.fillStyle = 'rgba(255,105,125,.42)'; c.fill(); });
  if (m === 'sad') {
    const [x, y] = T.eyes[1], k = (S.t % 1.2) * 5;
    c.save(); c.translate(x + r * 1.7, y - r * .5 + k);
    c.beginPath(); c.moveTo(0, -5); c.quadraticCurveTo(4.5, 1, 0, 3.5); c.quadraticCurveTo(-4.5, 1, 0, -5); fs(c, '#bfe8ff', 1.6); c.restore();
  }
}
function damage(c, T, S) {
  const [x0, y0, x1, y1] = T.box, w = x1 - x0, h = y1 - y0;
  c.save(); c.globalCompositeOperation = 'source-atop';
  [[.22, .35, .3], [.7, .65, .26], [.5, .15, .2]].forEach(([u, v, s]) => {
    const g = c.createRadialGradient(x0 + u * w, y0 + v * h, 0, x0 + u * w, y0 + v * h, s * w);
    g.addColorStop(0, 'rgba(30,20,25,.6)'); g.addColorStop(1, 'rgba(30,20,25,0)');
    c.fillStyle = g; c.fillRect(x0 - 30, y0 - 50, w + 60, h + 80);
  });
  c.restore();
  c.strokeStyle = OUT; c.lineWidth = 1.8; c.lineCap = 'round';
  [[.12, .45], [.56, .7]].forEach(([u, v], k) => {
    let x = x0 + u * w, y = y0 + v * h; c.beginPath(); c.moveTo(x, y);
    for (let i = 0; i < 4; i++) { x += 4 + hash(k * 9 + i) * 4; y += (i % 2 ? -1 : 1) * (3 + hash(k * 5 + i) * 3); c.lineTo(x, y); }
    c.stroke();
  });
  if (!S.dead) {
    c.save(); c.translate(x0 + w * .3, y0 + h * .3); c.rotate(-.45);
    rr(c, -10, -3.8, 20, 7.6, 3.5); fs(c, '#f3d9b1', 1.6);
    c.fillStyle = '#d9b98d'; c.fillRect(-3, -2.2, 6, 4.4); c.restore();
  }
}
function face(c, T, S) { if (S.damaged) damage(c, T, S); eyes(c, T, S); }

/* ---------- 탱크 8종 ---------- */
const TANKS = [
{
  id: 'mole', name: '두더지', role: '입문형', hp: 1000, ang: '0~70°',
  concept: '드릴 코로 땅을 파고드는 굴착 탱크. 탄도가 반듯해서 처음 하는 사람에게 좋다.',
  notes: ['머리 위 고글과 드릴 코가 실루엣 포인트', '이동할 때 드릴이 빨리 돈다', '땅굴 폭탄은 지형을 뚫고 들어가 터진다'],
  c: { main: '#c07a4c', light: '#eab285', dark: '#7d4529' }, swatch: ['#c07a4c', '#7d4529', '#ffcf5a', '#c9ced8'],
  w: 96, pivot: [-8, -50], len: 42, eyes: [[12, -41], [27, -39]], er: 6, box: [-44, -60, 44, -20], smoke: [-6, -60], flash: ['#fff6c2', '#ffb347'],
  body(c) { c.beginPath(); c.moveTo(-46, -18); c.bezierCurveTo(-50, -52, -18, -64, 6, -61); c.bezierCurveTo(32, -58, 46, -44, 46, -18); c.closePath(); },
  draw(c, S) {
    barrel(c, this, S);
    tread(c, -48, 48, 20, S);
    this.body(c); fs(c, vg(c, -62, -18, this.c.light, this.c.main, this.c.dark));
    c.save(); this.body(c); c.clip(); ell(c, 14, -20, 30, 12); c.fillStyle = 'rgba(255,225,190,.38)'; c.fill(); c.restore();
    c.fillStyle = 'rgba(255,255,255,.35)'; ell(c, -22, -48, 12, 4, -.6); c.fill();
    c.strokeStyle = '#4a2c1c'; c.lineWidth = 4; c.beginPath(); c.moveTo(-42, -44); c.quadraticCurveTo(-10, -64, 24, -55); c.stroke();
    [-6, 9].forEach(x => { circ(c, x, -58, 7); fs(c, vg(c, -65, -51, '#ffe7a0', '#f2a922'), 2.5); circ(c, x - 2, -60, 2.2); c.fillStyle = 'rgba(255,255,255,.8)'; c.fill(); });
    ell(c, 24, -19, 7, 5); fs(c, '#f3b3a0', 2); ell(c, 36, -19, 6, 4.5); fs(c, '#f3b3a0', 2);
    c.save(); c.beginPath(); c.moveTo(42, -44); c.lineTo(70, -31); c.lineTo(42, -18); c.closePath();
    fs(c, vg(c, -44, -18, '#f2f4f8', '#aab1bf', '#6e7584'), 2.5); c.clip();
    c.strokeStyle = 'rgba(60,64,80,.6)'; c.lineWidth = 2.2; const ph = (S.t * (S.moving ? 70 : 20)) % 8;
    for (let x = 30 + ph; x < 74; x += 8) { c.beginPath(); c.moveTo(x, -46); c.lineTo(x + 9, -16); c.stroke(); }
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath(); c.moveTo(40, -30); c.lineTo(30, -33); c.moveTo(40, -27); c.lineTo(31, -26); c.stroke();
    face(c, this, S);
  },
  barrel(c) { pipe(c, this.len, 10, '#8a5636', '#4e2d1b', '#ffcf5a'); },
},
{
  id: 'hammer', name: '망치', role: '방어형', hp: 1200, ang: '20~60°',
  concept: '등에 거대한 망치를 짊어진 중장갑 탱크. 느리지만 체력이 가장 높고 한 방이 무겁다.',
  notes: ['등의 망치가 실루엣 포인트', '두꺼운 사각 포신, 노란 경고 줄무늬', '발사 반동이 가장 크다'],
  c: { main: '#7f8ca6', light: '#c9d3e4', dark: '#4a536a' }, swatch: ['#7f8ca6', '#4a536a', '#f0a93b', '#a0714a'],
  w: 112, pivot: [12, -60], len: 46, eyes: [[22, -35], [36, -35]], er: 6, box: [-50, -72, 52, -20], smoke: [-4, -72], flash: ['#fff6c2', '#ff9d3a'],
  draw(c, S) {
    c.save(); c.translate(-36, -48); c.rotate(-.55 + Math.sin(S.t * 2) * .03);
    rr(c, -3.5, -46, 7, 48, 3); fs(c, vg(c, -46, 0, '#b07d50', '#6a4528'), 2.5);
    rr(c, -18, -64, 36, 22, 4); fs(c, vg(c, -64, -42, '#dce2ec', '#8792a6', '#545d72'));
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(-14, -60, 28, 3);
    c.restore();
    tread(c, -56, 56, 22, S);
    c.beginPath(); c.moveTo(-54, -20); c.lineTo(-48, -50); c.lineTo(42, -50); c.lineTo(56, -20); c.closePath();
    fs(c, vg(c, -50, -20, this.c.light, this.c.main, this.c.dark));
    c.save(); rr(c, -44, -47, 40, 8, 2); c.clip(); c.fillStyle = '#f0a93b'; c.fillRect(-44, -47, 40, 8);
    c.fillStyle = OUT; for (let x = -52; x < 0; x += 9) { c.beginPath(); c.moveTo(x, -39); c.lineTo(x + 4.5, -39); c.lineTo(x + 9, -47); c.lineTo(x + 4.5, -47); c.closePath(); c.fill(); }
    c.restore(); rr(c, -44, -47, 40, 8, 2); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = '#3d4558'; for (let x = -44; x <= 48; x += 11) { circ(c, x, -24, 2.1); c.fill(); }
    barrel(c, this, S);
    rr(c, -22, -72, 46, 24, 9); fs(c, vg(c, -72, -48, this.c.light, this.c.main));
    c.fillStyle = 'rgba(255,255,255,.5)'; rr(c, -16, -69, 30, 3, 1.5); c.fill();
    c.fillStyle = '#3d4558'; [-14, 16].forEach(x => { circ(c, x, -55, 2); c.fill(); });
    face(c, this, S);
  },
  barrel(c) {
    rr(c, 0, -7, this.len, 14, 3); fs(c, vg(c, -7, 7, '#7b849a', '#3a4154'), 2.5);
    c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(4, -5, this.len - 14, 2.5);
    rr(c, this.len - 10, -11, 14, 22, 3); fs(c, vg(c, -11, 11, '#a7b0c2', '#4a5266'), 2.5);
  },
},
{
  id: 'cloud', name: '구름열차', role: '공중형', hp: 900, ang: '30~90°',
  concept: '구름 풍선에 매달려 떠다니는 곤돌라. 높은 각도 포격에 강하고 낙하 피해를 덜 받는다.',
  notes: ['바퀴 대신 프로펠러, 늘 둥실 떠 있음', '그림자로 높이를 알 수 있다', '폭풍은 주변 탱크를 밀어낸다'],
  c: { main: '#6db3e6', light: '#bfe5ff', dark: '#3a78ad' }, swatch: ['#6db3e6', '#3a78ad', '#ffffff', '#f0c868'],
  w: 92, hover: true, pivot: [18, -46], len: 38, eyes: [[14, -33], [28, -33]], er: 5.5, box: [-44, -48, 44, -16], smoke: [0, -50], flash: ['#ffffff', '#9fd8ff'],
  lift(S) { return S.dead ? 0 : -12 + Math.sin(S.t * 2.4) * 2.5; },
  draw(c, S) {
    const cy = S.dead ? -60 : -96 + Math.sin(S.t * 1.7) * 1.5;
    c.strokeStyle = '#5b4a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-30, -46); c.lineTo(-22, cy + 14); c.moveTo(26, -46); c.lineTo(18, cy + 14); c.stroke();
    if (!S.dead) {
      const puffs = [[-28, cy + 4, 15], [-10, cy - 8, 19], [12, cy - 6, 17], [28, cy + 4, 13], [0, cy + 8, 18]];
      c.beginPath(); puffs.forEach(([x, y, r]) => { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); });
      c.strokeStyle = OUT; c.lineWidth = 6; c.stroke(); c.fillStyle = '#ffffff'; c.fill();
      c.save(); c.clip(); c.fillStyle = '#d7e9f8'; c.fillRect(-50, cy + 8, 100, 30); c.restore();
      c.fillStyle = 'rgba(255,255,255,.9)'; ell(c, -14, cy - 14, 8, 4, -.3); c.fill();
    } else {
      c.beginPath(); c.moveTo(-26, cy); c.quadraticCurveTo(0, cy + 14, 24, cy + 2); c.strokeStyle = '#d7e9f8'; c.lineWidth = 6; c.stroke();
    }
    c.save(); c.translate(-46, -32); rr(c, -6, -3, 8, 6, 2); fs(c, '#8a8fa0', 2); c.translate(-7, 0);
    c.scale(1, S.dead ? .9 : Math.cos(S.t * (S.moving ? 40 : 20)));
    ell(c, 0, -9, 3.2, 9); fs(c, '#f0c868', 2); ell(c, 0, 9, 3.2, 9); fs(c, '#f0c868', 2); c.restore();
    barrel(c, this, S);
    rr(c, -44, -48, 88, 32, 15); fs(c, vg(c, -48, -16, this.c.light, this.c.main, this.c.dark));
    c.save(); rr(c, -44, -48, 88, 32, 15); c.clip(); c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(-44, -24, 88, 4); c.restore();
    [-26, -8].forEach(x => { circ(c, x, -36, 5.5); fs(c, '#fff6d6', 2.5); circ(c, x - 1.5, -37.5, 1.6); c.fillStyle = '#fff'; c.fill(); });
    c.strokeStyle = OUT; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-28, -16); c.lineTo(-33, -7); c.moveTo(28, -16); c.lineTo(33, -7); c.moveTo(-40, -7); c.lineTo(40, -7); c.stroke();
    face(c, this, S);
  },
  barrel(c) { pipe(c, this.len, 7.5, '#f6d27a', '#a87a22', '#ffffff'); },
},
{
  id: 'bee', name: '불꽃벌', role: '지속 피해', hp: 950, ang: '0~80°',
  concept: '꽁무니에서 불꽃이 이는 벌 탱크. 바닥에 불을 남겨 다음 턴까지 피해를 준다.',
  notes: ['날개는 항상 파닥이고 이동 때 더 빠르다', '독침 모양 포신', '꼬리 불꽃은 상태가 나쁠수록 작아진다'],
  c: { main: '#f7c531', light: '#fff0a8', dark: '#c98d0b' }, swatch: ['#f7c531', '#2b2433', '#ff7a3c', '#e1f5ff'],
  w: 90, pivot: [40, -32], len: 30, eyes: [[12, -48], [26, -47]], er: 6.5, box: [-44, -66, 46, -18], smoke: [-4, -66], flash: ['#fff6a8', '#ff6a2a'],
  wing(c, x, y, rot, flap) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, flap);
    ell(c, 0, -13, 10, 18); c.fillStyle = 'rgba(225,245,255,.82)'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = 'rgba(120,160,190,.7)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -26); c.moveTo(0, -12); c.lineTo(6, -20); c.stroke();
    c.restore();
  },
  draw(c, S) {
    if (!S.dead) {
      const f = 1 + Math.sin(S.t * 25) * .14, k = S.damaged ? .6 : 1;
      c.save(); c.translate(-44, -40); c.scale(f * k, k / f);
      const g = c.createLinearGradient(-28, 0, 0, 0); g.addColorStop(0, '#ffef9a'); g.addColorStop(1, '#ff7a2a');
      c.beginPath(); c.moveTo(0, -9); c.quadraticCurveTo(-20, -9, -28, 0); c.quadraticCurveTo(-20, 9, 0, 9); c.closePath(); fs(c, g, 2); c.restore();
    }
    const flap = S.dead ? .5 : .5 + .5 * Math.abs(Math.sin(S.t * (S.moving ? 36 : 22)));
    this.wing(c, -14, -62, -.55, flap); this.wing(c, 2, -64, -.2, flap);
    tread(c, -42, 42, 18, S);
    ell(c, 0, -42, 46, 25); fs(c, vg(c, -67, -17, this.c.light, this.c.main, this.c.dark));
    c.save(); ell(c, 0, -42, 46, 25); c.clip(); c.fillStyle = '#2b2433'; c.fillRect(-30, -70, 10, 60); c.fillRect(-10, -70, 10, 60); c.restore();
    ell(c, 0, -42, 46, 25); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; ell(c, 4, -59, 12, 3.5, -.1); c.fill();
    c.strokeStyle = OUT; c.lineWidth = 2.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(18, -64); c.quadraticCurveTo(22, -82, 32, -84); c.moveTo(28, -62); c.quadraticCurveTo(36, -76, 44, -76); c.stroke();
    [[32, -84], [44, -76]].forEach(([x, y]) => { circ(c, x, y, 4); fs(c, '#ff7a3c', 2); });
    barrel(c, this, S);
    face(c, this, S);
  },
  barrel(c) {
    c.beginPath(); c.moveTo(0, -7); c.lineTo(this.len, -2.5); c.lineTo(this.len + 7, 0); c.lineTo(this.len, 2.5); c.lineTo(0, 7); c.closePath();
    fs(c, vg(c, -7, 7, '#4a4054', '#1f1a28'), 2.5); rr(c, 6, -7, 6, 14, 2); fs(c, '#f7c531', 2);
  },
},
{
  id: 'magnet', name: '자석포', role: '유도형', hp: 1000, ang: '10~70°',
  concept: 'U자 자석을 얹은 코일 탱크. 포탄이 가까운 적 쪽으로 살짝 휘어진다.',
  notes: ['자석 끝 사이로 전기가 튄다', '몸통의 구리 코일과 보라색 대비', '자기폭풍은 주변 아이템을 한 턴 봉인한다'],
  c: { main: '#8f65cc', light: '#cbabf5', dark: '#56368c' }, swatch: ['#8f65cc', '#56368c', '#e8474f', '#d98b4a'],
  w: 100, pivot: [30, -46], len: 36, eyes: [[16, -34], [30, -34]], er: 5.5, box: [-48, -50, 48, -20], smoke: [-16, -70], flash: ['#ffffff', '#b98cff'],
  draw(c, S) {
    tread(c, -50, 50, 20, S);
    const ux = -16, uy = -64;
    c.lineCap = 'butt';
    c.beginPath(); c.moveTo(ux - 16, uy - 24); c.lineTo(ux - 16, uy); c.arc(ux, uy, 16, Math.PI, 0, true); c.lineTo(ux + 16, uy - 24);
    c.strokeStyle = OUT; c.lineWidth = 19; c.stroke(); c.strokeStyle = '#e8474f'; c.lineWidth = 13; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(ux - 19, uy - 16); c.lineTo(ux - 19, uy); c.stroke();
    rr(c, ux - 22.5, uy - 28, 13, 10, 2); fs(c, '#e3e7ee', 2.5); rr(c, ux + 9.5, uy - 28, 13, 10, 2); fs(c, '#e3e7ee', 2.5);
    if (!S.dead && (S.t * 3) % 1 < .55) {
      c.strokeStyle = '#c8f0ff'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(ux - 9, uy - 24);
      for (let i = 1; i <= 4; i++) c.lineTo(ux - 9 + i * 4.5, uy - 24 + (i % 2 ? -5 : 2) * hash(Math.floor(S.t * 14) + i));
      c.stroke();
    }
    barrel(c, this, S);
    rr(c, -48, -50, 96, 30, 11); fs(c, vg(c, -50, -20, this.c.light, this.c.main, this.c.dark));
    c.save(); rr(c, -48, -50, 96, 30, 11); c.clip();
    for (let x = -40; x <= -6; x += 7) { c.fillStyle = '#d98b4a'; c.fillRect(x, -50, 4, 30); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, -50, 1.5, 30); }
    c.restore(); rr(c, -48, -50, 96, 30, 11); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
    face(c, this, S);
  },
  barrel(c) { pipe(c, this.len, 9, '#7a7090', '#3a3348', '#d98b4a'); [10, 18].forEach(x => { rr(c, x, -6.5, 4, 13, 1.5); fs(c, '#d98b4a', 1.5); }); },
},
{
  id: 'shroom', name: '버섯포', role: '확산형', hp: 1050, ang: '25~85°',
  concept: '커다란 버섯 갓을 쓴 포자 탱크. 포탄 여러 발을 넓게 뿌린다.',
  notes: ['분홍 갓과 흰 점이 실루엣 포인트', '가만히 있어도 포자가 둥실 떠오른다', '독버섯밭은 3턴 동안 독 피해'],
  c: { main: '#ead9bf', light: '#fff6e6', dark: '#b9a07c', face: '#ead9bf' }, swatch: ['#e5487a', '#ead9bf', '#86c464', '#fff4f7'],
  w: 96, pivot: [32, -32], len: 34, eyes: [[-8, -35], [7, -35]], er: 5.5, box: [-38, -52, 38, -20], smoke: [0, -86], flash: ['#f4ffb0', '#8ad24a'],
  draw(c, S) {
    tread(c, -46, 46, 20, S, ['#7b9653', '#3c4f26']);
    rr(c, -38, -54, 76, 36, 13); fs(c, vg(c, -54, -18, this.c.light, this.c.main, this.c.dark));
    const sq = S.dead ? 1 : 1 + Math.sin(S.t * 3) * .025;
    c.save(); c.translate(0, -50); if (S.dead) c.rotate(.12); c.scale(1 / sq, sq);
    c.beginPath(); c.moveTo(-60, 0); c.bezierCurveTo(-60, -46, 60, -46, 60, 0); c.quadraticCurveTo(0, -10, -60, 0); c.closePath();
    fs(c, vg(c, -36, 0, '#ff9ab8', '#e5487a', '#b02a57'));
    c.save(); c.clip(); [[-32, -18, 8, 6], [-4, -28, 9, 6], [24, -20, 7, 5], [44, -8, 5, 4], [-50, -6, 5, 4]].forEach(([x, y, rx, ry]) => { ell(c, x, y, rx, ry); c.fillStyle = '#fff4f7'; c.fill(); }); c.restore();
    c.fillStyle = 'rgba(255,255,255,.35)'; ell(c, -18, -27, 13, 3.5, -.25); c.fill();
    c.restore();
    barrel(c, this, S);
    face(c, this, S);
  },
  barrel(c) {
    pipe(c, this.len, 9, '#94d06f', '#3f7a2a', '#ead9bf');
    c.save(); c.translate(14, -5); c.rotate(-.7); ell(c, 0, -6, 4, 7); fs(c, '#86c464', 1.6); c.restore();
  },
  aura(c, S) {
    for (let i = 0; i < 5; i++) {
      const p = (S.t * .35 + i / 5) % 1, x = -40 + i * 20 + Math.sin(p * 6 + i) * 6, y = -84 - p * 40;
      circ(c, x, y, 2.4 * (1 - p * .5)); c.fillStyle = `rgba(230,255,160,${(1 - p) * .9})`; c.fill();
    }
  },
},
{
  id: 'whale', name: '얼음고래', role: '제어형', hp: 1100, ang: '5~65°',
  concept: '얼음을 뿜는 고래 탱크. 빙결탄에 맞은 적은 다음 턴에 움직이지 못한다.',
  notes: ['꼬리가 살랑거리고 머리 위로 물을 뿜는다', '배 쪽 흰 줄무늬, 얼음 포신', '해일은 맵을 가로질러 밀어붙인다'],
  c: { main: '#48aec4', light: '#a6e6f0', dark: '#256f86' }, swatch: ['#48aec4', '#256f86', '#e4f7f9', '#bfeaf5'],
  w: 104, pivot: [14, -60], len: 34, eyes: [[30, -42], [43, -40]], er: 5, box: [-48, -68, 52, -20], smoke: [-8, -70], flash: ['#ffffff', '#9fe6ff'],
  body(c) { c.beginPath(); c.moveTo(-48, -18); c.bezierCurveTo(-56, -58, 0, -76, 34, -62); c.bezierCurveTo(56, -52, 58, -26, 50, -18); c.closePath(); },
  draw(c, S) {
    c.save(); c.translate(-44, -36); c.rotate(S.dead ? .3 : Math.sin(S.t * 3) * .16);
    c.beginPath(); c.moveTo(2, -7); c.quadraticCurveTo(-16, -12, -22, -24); c.quadraticCurveTo(-30, -36, -40, -32); c.quadraticCurveTo(-30, -24, -28, -18);
    c.quadraticCurveTo(-38, -12, -40, -2); c.quadraticCurveTo(-28, -4, -20, -12); c.quadraticCurveTo(-12, 2, 2, 7); c.closePath();
    fs(c, vg(c, -36, 7, this.c.light, this.c.main, this.c.dark)); c.restore();
    if (!S.dead) for (let i = 0; i < 6; i++) {
      const p = (S.t * 1.3 + i / 6) % 1, d = (i % 2 ? 1 : -1) * (4 + i * 2);
      circ(c, -8 + d * p, -70 - p * 30 + p * p * 22, 3.4 * (1 - p * .5)); fs(c, '#c8f2fb', 1.5);
    }
    tread(c, -50, 48, 18, S, ['#4a6d8a', '#1f3346']);
    this.body(c); fs(c, vg(c, -72, -18, this.c.light, this.c.main, this.c.dark));
    c.save(); this.body(c); c.clip();
    ell(c, 12, -12, 48, 16); c.fillStyle = '#e4f7f9'; c.fill();
    c.strokeStyle = 'rgba(37,111,134,.45)'; c.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-24, -20 + i * 4); c.quadraticCurveTo(14, -27 + i * 4, 52, -20 + i * 4); c.stroke(); }
    c.restore(); this.body(c); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.4)'; ell(c, -12, -58, 14, 4, -.25); c.fill();
    c.save(); c.translate(10, -28); c.rotate(.5 + (S.dead ? .4 : Math.sin(S.t * 4) * .15)); ell(c, 9, 0, 11, 5); fs(c, this.c.dark, 2.5); c.restore();
    barrel(c, this, S);
    ell(c, 14, -61, 10, 6); fs(c, vg(c, -67, -55, '#e6fbff', '#7cc9dc'), 2.5);
    face(c, this, S);
  },
  barrel(c) {
    pipe(c, this.len, 9, '#effcff', '#7cc9dc', '#ffffff');
    c.fillStyle = '#ffffff'; c.strokeStyle = OUT; c.lineWidth = 1.5;
    [[10, -4.5], [20, -4.5]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3, y - 5); c.lineTo(x + 6, y); c.closePath(); c.fill(); c.stroke(); });
  },
},
{
  id: 'laser', name: '레이저로봇', role: '고수형', hp: 850, ang: '0~45°',
  concept: '직선 빔을 쏘는 로봇 탱크. 체력은 낮지만 낮은 각도 직사에서 가장 강하다.',
  notes: ['눈 대신 빛나는 바이저 표정', '등 쪽 빔 발사기, 깜빡이는 상태등', '궁극 빔은 하늘에서 수직으로 떨어진다'],
  c: { main: '#a3aebd', light: '#e8edf4', dark: '#5d6878' }, swatch: ['#a3aebd', '#5d6878', '#2fe0ff', '#7fe36b'],
  w: 96, robot: true, pivot: [-20, -58], len: 44, eyes: [[11, -67], [25, -67]], er: 4.5, box: [-46, -80, 48, -20], smoke: [10, -82], flash: ['#ffffff', '#2fe0ff'],
  draw(c, S) {
    tread(c, -48, 48, 20, S);
    barrel(c, this, S);
    c.beginPath(); c.moveTo(-46, -20); c.lineTo(-46, -44); c.lineTo(-32, -56); c.lineTo(34, -56); c.lineTo(48, -42); c.lineTo(48, -20); c.closePath();
    fs(c, vg(c, -56, -20, this.c.light, this.c.main, this.c.dark));
    c.strokeStyle = 'rgba(60,70,90,.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-28, -50); c.lineTo(-28, -24); c.moveTo(14, -50); c.lineTo(14, -24); c.stroke();
    [[-38, -30], [-38, -38]].forEach(([x, y], i) => { circ(c, x, y, 2.8); c.fillStyle = S.dead ? '#333' : ((S.t * 2 + i * .5) % 1 < .5 ? '#7fe36b' : '#2f6b2a'); c.fill(); });
    for (let i = 0; i < 4; i++) { rr(c, 20 + i * 6, -47, 3, 20, 1.5); c.fillStyle = '#5d6878'; c.fill(); }
    rr(c, 0, -82, 38, 28, 8); fs(c, vg(c, -82, -54, this.c.light, this.c.main));
    rr(c, 3, -75, 32, 14, 7); fs(c, '#11303d', 2);
    c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.moveTo(8, -82); c.lineTo(4, -97); c.stroke();
    circ(c, 4, -99, 4); c.fillStyle = S.dead ? '#552' : ((S.t * 1.5) % 1 < .5 ? '#ff5d5d' : '#a33'); c.fill(); c.lineWidth = 2; c.stroke();
    face(c, this, S);
  },
  barrel(c, S) {
    rr(c, 0, -5, this.len, 10, 4); fs(c, vg(c, -5, 5, '#9aa4b2', '#4c5563'), 2.5);
    [12, 22, 32].forEach(x => { rr(c, x, -6.5, 4, 13, 1.5); fs(c, S.dead ? '#3a5560' : '#2fe0ff', 1.5); });
    circ(c, this.len + 1, 0, 5.5); fs(c, S.dead ? '#3a5560' : '#c8fbff', 2);
  },
},
];
TANKS.forEach((T, i) => { T.seed = i * 0.73; [T.amin, T.amax] = T.ang.match(/\d+/g).map(Number); });
const tankById = id => TANKS.find(T => T.id === id);

/* ---------- 상태 ---------- */
const STATES = [
  { id: 'idle', n: '대기', d: '숨 쉬듯 살짝 들썩이고 눈을 깜빡인다.' },
  { id: 'move', n: '이동', d: '바퀴가 굴러가고 뒤로 흙먼지가 인다.' },
  { id: 'fire', n: '발사', d: '포신이 뒤로 밀리고 불꽃과 연기가 난다.' },
  { id: 'hit', n: '피격', d: '하얗게 번쩍이며 흔들리고 피해 숫자가 뜬다.' },
  { id: 'danger', n: '위기', d: '체력 25% 이하. 그을음, 반창고, 연기.' },
  { id: 'dead', n: '파괴', d: '새까맣게 타고 포신이 처진다. 불씨가 남는다.' },
];
function params(state, t) {
  const S = { t, bob: 0, wheel: 0, angle: 32, recoil: 0, mood: 'normal', tilt: 0, dx: 0, flash: 0, white: 0, dark: 0, damaged: false, dead: false, moving: false };
  if (state === 'idle') { S.bob = Math.sin(t * 2.2) * 1.2; S.angle = 32 + Math.sin(t * .9) * 4; }
  if (state === 'move') { S.bob = -Math.abs(Math.sin(t * 9)) * 2; S.wheel = t * 5; S.tilt = Math.sin(t * 9) * .025; S.mood = 'happy'; S.moving = true; }
  if (state === 'fire') { const f = t % 1.8; S.fireT = f; S.angle = 38; S.mood = 'focus'; S.recoil = f < .06 ? f / .06 : Math.max(0, 1 - (f - .06) / .35); S.flash = f < .16 ? 1 - f / .16 : 0; S.dx = -4 * S.recoil; }
  if (state === 'hit') { const h = t % 1.6; S.hitT = h; S.mood = h < .9 ? 'hurt' : 'normal'; S.white = h < .14 ? .85 * (1 - h / .14) : 0; S.dx = h < .5 ? Math.sin(h * 70) * 4 * (1 - h / .5) : 0; S.tilt = h < .5 ? -.08 * (1 - h / .5) : 0; S.angle = 28; }
  if (state === 'danger') { S.mood = 'sad'; S.damaged = true; S.bob = Math.sin(t * 14) * .6; S.angle = 20 + Math.sin(t * 1.3) * 2; }
  if (state === 'dead') { S.mood = 'dead'; S.damaged = true; S.dead = true; S.dark = .62; S.angle = -16; S.tilt = .1; }
  return S;
}

/* ---------- 효과 ---------- */
function puff(c, x, y, r, col, a) { circ(c, x, y, r); c.fillStyle = `rgba(${col},${a})`; c.fill(); }
function smoke(c, x, y, t, col, a0, size) {
  for (let i = 0; i < 8; i++) { const p = (t * .55 + i / 8) % 1; puff(c, x + Math.sin(p * 4 + i) * 5 + p * 16, y - p * 60 * size, (4 + p * 12) * size, col, (1 - p) * a0); }
}
function flame(c, x, y, s, t) {
  const f = 1 + Math.sin(t * 22 + x) * .18;
  c.save(); c.translate(x, y); c.scale(s, s * f);
  c.beginPath(); c.moveTo(0, -14); c.quadraticCurveTo(8, -4, 6, 2); c.quadraticCurveTo(0, 6, -6, 2); c.quadraticCurveTo(-8, -4, 0, -14);
  const g = c.createLinearGradient(0, -14, 0, 4); g.addColorStop(0, '#fff2a0'); g.addColorStop(1, '#ff6a2a'); c.fillStyle = g; c.fill(); c.restore();
}
function star(c, x, y, R, r, n, rot) {
  c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, d = i % 2 ? r : R; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } c.closePath();
}
function muzzle(c, x, y, a, k, cols) {
  c.save(); c.translate(x, y); c.rotate(a); c.scale(1.5, 1);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 22 * k + 6); g.addColorStop(0, cols[0]); g.addColorStop(.5, cols[1]); g.addColorStop(1, rgba(cols[1], 0));
  star(c, 4, 0, 20 * k + 6, 7 * k + 3, 7, k * 2); c.fillStyle = g; c.fill(); c.restore();
}
function fx(c, T, S, state) {
  const t = S.t;
  if (state === 'fire') {
    const [x, y, a] = tip(T, S);
    if (S.flash > 0) muzzle(c, x, y, a, S.flash, T.flash);
    const p = (S.fireT - .04) / 1.1;
    if (p > 0 && p < 1) for (let i = 0; i < 7; i++) {
      const q = Math.min(1, p * 1.3), d = 8 + q * 30 * (.5 + hash(i) * .8);
      puff(c, x + Math.cos(a) * d * .7 + (hash(i + 3) - .5) * 12 * q, y + Math.sin(a) * d * .7 - q * 20 * hash(i + 7), 3 + q * 8 * (.5 + hash(i + 1)), '238,232,226', (1 - p) * .75);
    }
  }
  if (state === 'hit') {
    const h = S.hitT, [x0, y0, x1] = T.box, cx = (x0 + x1) / 2 - 8, cy = y0 + 10;
    if (h < .3) { const p = h / .3; star(c, cx, cy, 10 + 22 * p, 5 + 8 * p, 8, p); c.fillStyle = `rgba(255,240,170,${1 - p})`; c.fill(); c.lineWidth = 2; c.strokeStyle = `rgba(36,29,46,${1 - p})`; c.stroke(); }
    if (h < 1.1 && !S.noText) {
      c.save(); c.globalAlpha = Math.min(1, (1.1 - h) * 2.5); c.font = '24px Jua, sans-serif'; c.textAlign = 'center'; c.lineJoin = 'round';
      const yy = y0 - 18 - h * 26; c.lineWidth = 5; c.strokeStyle = OUT; c.strokeText('-212', cx + 14, yy); c.fillStyle = '#ff6b5a'; c.fillText('-212', cx + 14, yy); c.restore();
    }
  }
  if (state === 'danger') {
    const [sx, sy] = T.smoke; smoke(c, sx, sy, t, '95,88,100', .6, 1);
    if ((t % 1.4) < .2) { const [x0, y0, x1] = T.box; c.strokeStyle = '#ffd34d'; c.lineWidth = 2; c.lineCap = 'round'; for (let i = 0; i < 5; i++) { const a = -Math.PI * (.15 + .7 * hash(i + Math.floor(t / 1.4))); const r0 = 3, r1 = 10 + 8 * hash(i); c.beginPath(); c.moveTo(x1 - 14 + Math.cos(a) * r0, y0 + 14 + Math.sin(a) * r0); c.lineTo(x1 - 14 + Math.cos(a) * r1, y0 + 14 + Math.sin(a) * r1); c.stroke(); } }
  }
  if (state === 'dead') {
    const [sx, sy] = T.smoke; smoke(c, sx, sy, t, '38,32,38', .8, 1.4);
    const [x0, y0, x1] = T.box; flame(c, x0 + 14, y0 + 16, .9, t); flame(c, x1 - 16, y0 + 22, .7, t + 1);
  }
  if (T.aura && state !== 'dead') T.aura(c, S);
}
function dust(c, T, S) {
  if (T.hover) { c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.lineCap = 'round'; for (let i = 0; i < 3; i++) { const p = (S.t * 1.8 + i / 3) % 1; c.globalAlpha = 1 - p; c.beginPath(); c.moveTo(-T.w / 2 - 6 - p * 30, -30 + i * 8); c.lineTo(-T.w / 2 - 20 - p * 30, -30 + i * 8); c.stroke(); } c.globalAlpha = 1; return; }
  for (let i = 0; i < 6; i++) { const p = (S.t * 1.6 + i / 6) % 1; puff(c, -T.w / 2 - 2 - p * 30, -3 - p * 12 - hash(i) * 4, 3 + p * 8, '214,180,138', (1 - p) * .6); }
}

/* ---------- 탱크 그리기 (틴트용 레이어 사용) ---------- */
const layer = document.createElement('canvas'); const lctx = layer.getContext('2d');
function renderTank(c, cw, ch, T, state, t, x, y, sc, o = {}) {
  // o: flip(-1 왼쪽 보기), angle(포신 각도), phaseT(발사·피격 경과 시간), noText, alpha
  // 지금 캔버스 변환(배율·흔들림)을 그대로 따라가므로 어떤 화면에서도 쓸 수 있다
  const S = params(state, o.phaseT != null ? o.phaseT : t + T.seed);
  if (o.phaseT != null) S.t = t + T.seed;
  if (o.angle != null && !S.dead) S.angle = o.angle;
  S.noText = !!o.noText;
  const f = o.flip || 1, lift = T.lift ? T.lift(S) : 0, a = o.alpha == null ? 1 : o.alpha;
  c.save(); c.globalAlpha *= a; c.translate(x, y); c.scale(sc * f, sc);
  const sh = T.hover && !S.dead ? .6 + lift / 60 : 1;
  ell(c, 0, 1, T.w * .56 * sh, 5 * sh); c.fillStyle = 'rgba(20,12,30,.3)'; c.fill();
  if (state === 'move') dust(c, T, S);
  c.restore();
  const M = c.getTransform(), CW = c.canvas.width, CH = c.canvas.height;
  if (layer.width < CW) layer.width = CW; if (layer.height < CH) layer.height = CH;
  const k = Math.hypot(M.a, M.b) * sc, cx = M.a * x + M.c * y + M.e, cy = M.b * x + M.d * y + M.f;
  const bx = Math.max(0, Math.floor(cx - 150 * k)), by = Math.max(0, Math.floor(cy - 190 * k)), bw = Math.min(CW, Math.ceil(cx + 150 * k)) - bx, bh = Math.min(CH, Math.ceil(cy + 40 * k)) - by;
  if (bw <= 0 || bh <= 0) return S;
  lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(bx, by, bw, bh);
  lctx.setTransform(M);
  lctx.save(); lctx.translate(x + S.dx * sc * f, y + (S.bob + lift) * sc); lctx.scale(sc * f, sc); lctx.rotate(S.tilt); T.draw(lctx, S); lctx.restore();
  if (S.white || S.dark) { lctx.save(); lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'source-atop'; lctx.fillStyle = S.white ? `rgba(255,255,255,${S.white})` : `rgba(26,18,22,${S.dark})`; lctx.fillRect(bx, by, bw, bh); lctx.restore(); }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha *= a; c.drawImage(layer, bx, by, bw, bh, bx, by, bw, bh); c.restore();
  c.save(); c.globalAlpha *= a; c.translate(x + S.dx * sc * f, y + (S.bob + lift) * sc); c.scale(sc * f, sc); c.rotate(S.tilt); fx(c, T, S, state); c.restore();
  return S;
}

/* ---------- 배경 ---------- */
function scene(c, w, h, gy, tint) {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f2b880'); g.addColorStop(.6, '#f8dcae'); g.addColorStop(1, '#fbe9c8');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,248,225,.85)'; circ(c, w * .82, h * .26, h * .1); c.fill();
  c.fillStyle = 'rgba(196,128,96,.28)'; c.beginPath(); c.moveTo(0, gy);
  for (let x = 0; x <= w; x += 8) c.lineTo(x, gy - h * .18 - Math.sin(x / (w * .12)) * h * .06 - Math.sin(x / 33) * 4); c.lineTo(w, gy); c.fill();
  const gg = c.createLinearGradient(0, gy, 0, h); gg.addColorStop(0, '#c98b4f'); gg.addColorStop(1, '#7a4b2c');
  c.fillStyle = gg; c.fillRect(0, gy, w, h - gy);
  c.fillStyle = tint || '#e8c27a'; c.fillRect(0, gy - 3, w, 6);
  c.fillStyle = 'rgba(90,55,30,.3)'; for (let i = 0; i < w / 40; i++) { ell(c, (i * 97) % w, gy + 14 + (i * 37) % Math.max(8, h - gy - 18), 9, 3.5); c.fill(); }
}

/* ---------- 포탄 ---------- */
const SHELLS = {
  mole: [
    { n: '돌탄', d: '200', key: 'rock', trail: 'dust', boom: 'dirt', R: 24, desc: '빙글빙글 구르며 날아가는 단단한 돌덩이.' },
    { n: '파편탄', d: '110 × 3', key: 'pebble', count: 3, trail: 'dust', boom: 'dirt', R: 15, desc: '세 갈래로 흩어지는 자갈 세 발.' },
    { n: '땅굴 폭탄', d: '380', key: 'drill', trail: 'smoke', boom: 'dirt', R: 36, sp: 'erupt', desc: '드릴이 땅속으로 파고든 뒤 땅이 갈라지며 아래에서 터져 오른다.' } ],
  hammer: [
    { n: '철구', d: '260', key: 'ironball', trail: 'smoke', boom: 'dirt', R: 24, desc: '쇠사슬 달린 쇠공. 무거워서 바람을 덜 탄다.' },
    { n: '지진탄', d: '230', key: 'quake', trail: 'smoke', boom: 'quake', R: 28, desc: '주변 땅을 흔들어 탱크를 미끄러뜨린다.' },
    { n: '메테오', d: '480', key: 'beacon', color: '#ff7a3c', trail: 'spark', boom: 'fire', R: 44, sp: 'meteor', desc: '신호탄이 떨어진 자리로 하늘이 어두워지며 거대한 운석이 떨어진다.' } ],
  cloud: [
    { n: '물방울', d: '180', key: 'drop', trail: 'drops', boom: 'water', R: 22, desc: '물방울이 튀며 첨벙 터진다.' },
    { n: '번개구름', d: '210', key: 'thunder', trail: 'spark', boom: 'electric', color: '#ffe066', R: 24, desc: '바람 영향을 받지 않는 작은 먹구름.' },
    { n: '폭풍', d: '300', key: 'storm', trail: 'wind', boom: 'wind', R: 40, sp: 'tornado', desc: '떨어진 자리에서 회오리가 생겨 바람 방향으로 휩쓸고 지나가며 탱크를 날려 버린다.' } ],
  bee: [
    { n: '불씨', d: '190', key: 'ember', trail: 'fire', boom: 'fire', R: 22, desc: '이글거리는 불덩이.' },
    { n: '화염병', d: '160', key: 'molotov', trail: 'fire', boom: 'fire', R: 26, desc: '깨진 자리에 불이 2턴 남는다.' },
    { n: '불사조', d: '420', key: 'phoenix', trail: 'fire', boom: 'fire', R: 40, sp: 'phoenix', desc: '불새가 돌진해 불기둥을 세우고 바닥을 2턴 동안 불태운다.' } ],
  magnet: [
    { n: '자기탄', d: '190', key: 'magball', trail: 'spark', boom: 'electric', color: '#b98cff', R: 22, desc: '전자가 도는 쇠구슬.' },
    { n: '끌어당김탄', d: '220', key: 'horseshoe', trail: 'spark', boom: 'electric', color: '#ff7a7a', R: 24, desc: '가까운 탱크 쪽으로 휘어 날아간다.' },
    { n: '자기폭풍', d: '340', key: 'emorb', trail: 'glow', color: '#b98cff', boom: 'electric', R: 40, sp: 'storm', desc: '먹구름이 몰려와 떨어진 자리 주변에 벼락 다섯 줄기가 내리친다.' } ],
  shroom: [
    { n: '포자', d: '170', key: 'spore', trail: 'glow', color: '#c8f06a', boom: 'toxic', R: 22, desc: '반짝이는 포자 덩어리.' },
    { n: '포자비', d: '70 × 5', key: 'spore', small: true, count: 5, trail: 'glow', color: '#c8f06a', boom: 'toxic', R: 12, desc: '작은 포자 다섯 발이 넓게 흩어진다.' },
    { n: '독버섯밭', d: '240', key: 'toadstool', trail: 'bubbles', boom: 'toxic', R: 38, sp: 'shroom', desc: '거대한 독버섯이 솟아 터지고, 독 안개가 3턴 동안 남아 매 턴 80 피해.' } ],
  whale: [
    { n: '얼음덩이', d: '200', key: 'icecube', trail: 'frost', boom: 'ice', R: 24, desc: '반짝이는 얼음 큐브.' },
    { n: '빙결탄', d: '150', key: 'snowflake', trail: 'frost', boom: 'ice', R: 26, desc: '맞은 탱크는 다음 턴에 움직일 수 없다.' },
    { n: '해일', d: '400', key: 'wave', trail: 'drops', boom: 'water', R: 42, sp: 'wave', desc: '해일이 앞으로 밀려가며 탱크를 쓸어 가고, 고래가 파도 위로 뛰어오른다.' } ],
  laser: [
    { n: '빔탄', d: '210', key: 'bolt', trail: 'glow', color: '#2fe0ff', boom: 'electric', R: 22, desc: '빛나는 에너지 탄.' },
    { n: '관통 레이저', d: '170', key: 'beam', path: 'straight', boom: 'electric', color: '#2fe0ff', R: 20, desc: '중력과 바람을 무시하고 직선으로 꿰뚫는다.' },
    { n: '궁극 빔', d: '500', key: 'beacon', color: '#2fe0ff', trail: 'glow', boom: 'beam', R: 40, sp: 'ufo', desc: '신호탄을 따라 우주선이 내려와 땅을 꿰뚫는 수직 레이저를 쏜다.' } ],
};

/* 포탄 물리 (설계서 '포탄 물리와 지형 파임' 표와 같은 값)
   dmg 피해, r 피해 반경, cr 파임 반경(타원은 [가로, 세로]), wind 바람계수, wt 무게계수, shape 파임 모양, fx 특수 효과 */
const PHYS = {
  mole:   [{ dmg: 200, r: 34, cr: 34, wind: 1, wt: 1 }, { dmg: 110, r: 24, cr: 20, wind: 1, wt: 1, spread: [-1.5, 0, 1.5], pspread: [.91, 1, 1.09] }, { dmg: 380, r: 60, cr: 50, wind: .8, wt: 1.1, shape: 'tunnel' }],
  hammer: [{ dmg: 260, r: 30, cr: 30, wind: .5, wt: 1.2 }, { dmg: 230, r: 44, cr: [70, 24], wind: .6, wt: 1.2, shape: 'ellipse' }, { dmg: 480, r: 56, cr: 64, wind: .4, wt: 1.3 }],
  cloud:  [{ dmg: 180, r: 30, cr: 18, wind: 1.2, wt: .9 }, { dmg: 210, r: 30, cr: 26, wind: 0, wt: 1 }, { dmg: 300, r: 70, cr: 20, wind: 1.5, wt: .8, fx: 'push' }],
  bee:    [{ dmg: 190, r: 30, cr: 30, wind: 1, wt: 1 }, { dmg: 160, r: 36, cr: 22, wind: 1, wt: 1, fx: 'burn' }, { dmg: 420, r: 50, cr: 48, wind: .7, wt: .9 }],
  magnet: [{ dmg: 190, r: 30, cr: 30, wind: 1, wt: 1 }, { dmg: 220, r: 30, cr: 30, wind: 1, wt: 1, fx: 'home' }, { dmg: 340, r: 64, cr: 40, wind: .8, wt: 1 }],
  shroom: [{ dmg: 170, r: 30, cr: 26, wind: 1.4, wt: .8 }, { dmg: 70, r: 20, cr: 14, wind: 1.4, wt: .8, spread: [-3, -1.5, 0, 1.5, 3], pspread: [.84, .92, 1, 1.08, 1.16] }, { dmg: 240, r: 60, cr: 30, wind: 1, wt: 1, fx: 'poison' }],
  whale:  [{ dmg: 200, r: 32, cr: 30, wind: .9, wt: 1.1 }, { dmg: 150, r: 32, cr: 16, wind: 1, wt: 1, fx: 'freeze' }, { dmg: 400, r: 62, cr: 40, wind: .6, wt: 1.2 }],
  laser:  [{ dmg: 210, r: 28, cr: 28, wind: .7, wt: .9 }, { dmg: 170, r: 22, cr: 12, wind: 0, wt: 0, shape: 'line' }, { dmg: 500, r: 44, cr: 40, wind: 0, wt: 1, shape: 'down' }],
};
Object.keys(SHELLS).forEach(id => SHELLS[id].forEach((sh, k) => Object.assign(sh, PHYS[id][k])));

/* ---------- 아이템 ---------- */
const ITEMS = [
  { id: 'double', n: '연발탄', size: 2, delay: 150, d: '이번 턴 포탄을 두 번 쏜다.', tip: '두 번 발사' },
  { id: 'power', n: '강화탄', size: 1, delay: 80, d: '이번 포탄의 피해와 땅 파임이 30% 커진다.', tip: '피해·파임 +30%' },
  { id: 'repair', n: '수리킷', size: 1, delay: 60, d: '내 탱크 체력을 250 회복한다.', tip: '체력 +250' },
  { id: 'teamrepair', n: '팀 수리킷', size: 2, delay: 120, d: '우리 팀 전원의 체력을 150씩 회복한다.', tip: '팀 전원 +150' },
  { id: 'teleport', n: '순간이동탄', size: 2, delay: 100, d: '포탄이 떨어진 자리로 내 탱크가 옮겨 간다.', tip: '떨어진 곳으로 이동' },
  { id: 'calm', n: '바람정지', size: 1, delay: 50, d: '이번 턴만 바람이 0이 된다.', tip: '바람 0' },
  { id: 'shield', n: '보호막', size: 1, delay: 70, d: '다음 내 턴까지 받는 피해가 절반이 된다.', tip: '받는 피해 -50%' },
  { id: 'fuel', n: '연료통', size: 1, delay: 30, d: '이번 턴 이동 연료가 두 배가 된다.', tip: '이동 연료 ×2' },
];
const itemById = id => ITEMS.find(i => i.id === id);
function bullet(c, x, y, s, body, tipCol) {
  c.save(); c.translate(x, y); c.scale(s, s);
  rr(c, -6, -2, 12, 18, 2); fs(c, vg(c, -2, 16, '#f6d27a', '#b07d22'), 2.2);
  c.beginPath(); c.moveTo(-6, -1); c.lineTo(-6, -8); c.quadraticCurveTo(0, -20, 6, -8); c.lineTo(6, -1); c.closePath(); fs(c, vg(c, -18, 0, tipCol[0], tipCol[1]), 2.2);
  c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(-4, 2, 2, 12); rr(c, -7, 12, 14, 4, 1.5); fs(c, body, 1.8);
  c.restore();
}
function drawItemIcon(c, id, t, used) {
  // 64×64 칸 안, 중심 (0,0) 기준. t는 살짝 움직이는 연출용 시간
  const bob = used ? 0 : Math.sin(t * 3) * 1.2;
  c.save(); c.translate(0, bob); c.lineJoin = 'round'; c.lineCap = 'round';
  switch (id) {
    case 'double':
      bullet(c, -9, 0, 1.15, '#8a5636', ['#ff9a6a', '#d6402a']); bullet(c, 9, 2, 1.15, '#8a5636', ['#ff9a6a', '#d6402a']);
      rr(c, 6, -24, 22, 14, 6); fs(c, '#ffb703', 2); c.fillStyle = OUT; c.font = '13px Jua, sans-serif'; c.textAlign = 'center'; c.fillText('×2', 17, -12.5); break;
    case 'power': {
      const g = c.createRadialGradient(0, 0, 4, 0, 0, 28); g.addColorStop(0, 'rgba(255,90,60,.55)'); g.addColorStop(1, 'rgba(255,90,60,0)');
      c.fillStyle = g; circ(c, 0, 0, 28 + Math.sin(t * 6) * 2); c.fill();
      bullet(c, -2, 2, 1.35, '#7a2020', ['#ff7a5a', '#b81f2a']);
      c.beginPath(); c.moveTo(14, -6); c.lineTo(22, -18); c.lineTo(30, -6); c.lineTo(25, -6); c.lineTo(25, 4); c.lineTo(19, 4); c.lineTo(19, -6); c.closePath(); fs(c, vg(c, -18, 4, '#fff27a', '#ffb703'), 2); break; }
    case 'repair':
      rr(c, -20, -14, 40, 30, 6); fs(c, vg(c, -14, 16, '#ffffff', '#e8e2ef'), 2.5);
      rr(c, -8, -21, 16, 8, 3); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.moveTo(-4, -6); c.lineTo(4, -6); c.lineTo(4, -1); c.lineTo(9, -1); c.lineTo(9, 7); c.lineTo(4, 7); c.lineTo(4, 12); c.lineTo(-4, 12); c.lineTo(-4, 7); c.lineTo(-9, 7); c.lineTo(-9, -1); c.lineTo(-4, -1); c.closePath(); fs(c, '#ef4b4b', 2);
      break;
    case 'teamrepair':
      rr(c, -24, -14, 48, 30, 6); fs(c, vg(c, -14, 16, '#9ee6a2', '#3fae4a'), 2.5);
      rr(c, -8, -21, 16, 8, 3); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
      [-11, 11].forEach(x => { c.save(); c.translate(x, 1); c.beginPath(); c.moveTo(-3, -7); c.lineTo(3, -7); c.lineTo(3, -3); c.lineTo(7, -3); c.lineTo(7, 3); c.lineTo(3, 3); c.lineTo(3, 7); c.lineTo(-3, 7); c.lineTo(-3, 3); c.lineTo(-7, 3); c.lineTo(-7, -3); c.lineTo(-3, -3); c.closePath(); fs(c, '#ffffff', 1.8); c.restore(); });
      break;
    case 'teleport': {
      c.save(); c.translate(0, 8); c.scale(1, .38);
      for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(0, 0, 26 - k * 7, t * 4 + k, t * 4 + k + 4.4); c.strokeStyle = ['#7b2fbf', '#b98cff', '#efe4ff'][k]; c.lineWidth = 5; c.stroke(); }
      c.restore();
      c.save(); c.rotate(-.5); bullet(c, 0, -4, 1.1, '#5b3a8c', ['#d4b8ff', '#7b2fbf']); c.restore();
      for (let i = 0; i < 4; i++) { const p = (t * .8 + i / 4) % 1; c.fillStyle = `rgba(239,228,255,${1 - p})`; star(c, -18 + i * 12, -10 - p * 16, 3.5, 1.4, 4, 0); c.fill(); }
      break; }
    case 'calm': {
      c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(-16, 22); c.lineTo(-16, -22); c.stroke();
      c.beginPath(); c.moveTo(-15, -20); c.quadraticCurveTo(-8, -6, -10, 8); c.lineTo(-4, 8); c.quadraticCurveTo(-2, -6, -15, -20); fs(c, vg(c, -20, 8, '#ffffff', '#ff8a5a'), 2);
      circ(c, 9, 2, 15); c.lineWidth = 6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#ef4b4b'; c.stroke();
      c.beginPath(); c.moveTo(-1, 12); c.lineTo(19, -8); c.lineWidth = 6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#ef4b4b'; c.stroke();
      break; }
    case 'shield': {
      c.beginPath(); c.moveTo(0, -24); c.quadraticCurveTo(14, -16, 22, -17); c.quadraticCurveTo(24, 12, 0, 24); c.quadraticCurveTo(-24, 12, -22, -17); c.quadraticCurveTo(-14, -16, 0, -24); c.closePath();
      fs(c, vg(c, -24, 24, '#bfe8ff', '#55aef0', '#1f6fae'), 2.8);
      c.beginPath(); c.moveTo(0, -17); c.quadraticCurveTo(9, -11, 15, -12); c.quadraticCurveTo(16, 8, 0, 17); c.closePath(); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill();
      const sh = (t * .7) % 1; c.save(); c.globalAlpha = .8 * (1 - sh); c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.moveTo(-14 + sh * 20, -14); c.lineTo(-20 + sh * 20, 6); c.stroke(); c.restore();
      break; }
    case 'fuel':
      rr(c, -16, -16, 32, 38, 5); fs(c, vg(c, -16, 22, '#ff8a6a', '#d6402a', '#9a2a1c'), 2.6);
      rr(c, -10, -24, 10, 9, 2); fs(c, '#4a5266', 2.2); c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(2, -16); c.quadraticCurveTo(10, -26, 14, -16); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-10, -8); c.lineTo(10, 14); c.moveTo(10, -8); c.lineTo(-10, 14); c.stroke();
      c.beginPath(); c.moveTo(0, -4); c.quadraticCurveTo(8, 6, 0, 11); c.quadraticCurveTo(-8, 6, 0, -4); fs(c, '#ffe066', 1.8);
      break;
  }
  c.restore();
}

function rock(c, s, rot, seed) {
  c.save(); c.rotate(rot); c.beginPath();
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, r = s * (.8 + hash(i + seed) * .35); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.closePath(); fs(c, vg(c, -s, s, '#c9b196', '#8a7058', '#5a4636'), 2.2);
  c.fillStyle = 'rgba(255,255,255,.35)'; ell(c, -s * .3, -s * .35, s * .3, s * .15, -.5); c.fill(); c.restore();
}
function drawShell(c, sh, t, ang) {
  c.lineJoin = 'round'; c.lineCap = 'round';
  switch (sh.key) {
    case 'rock': rock(c, 10, t * 9, 1); break;
    case 'pebble': rock(c, 6.5, t * 11, 4); break;
    case 'drill': c.save(); c.rotate(ang);
      c.beginPath(); c.moveTo(-14, -4); c.lineTo(-20, -9); c.lineTo(-16, 0); c.lineTo(-20, 9); c.lineTo(-14, 4); c.closePath(); fs(c, '#4a5266', 2);
      rr(c, -15, -7, 18, 14, 6); fs(c, vg(c, -7, 7, '#ff8a6a', '#e0503c', '#9a2a1c'), 2.2);
      c.save(); c.beginPath(); c.moveTo(2, -7); c.lineTo(17, 0); c.lineTo(2, 7); c.closePath(); fs(c, vg(c, -7, 7, '#f2f4f8', '#9aa1af'), 2.2); c.clip();
      c.strokeStyle = 'rgba(60,64,80,.6)'; c.lineWidth = 1.6; for (let x = -4 + (t * 40) % 5; x < 20; x += 5) { c.beginPath(); c.moveTo(x, -8); c.lineTo(x + 5, 8); c.stroke(); } c.restore();
      c.fillStyle = '#ffd34d'; c.fillRect(-9, -7, 3, 14); c.restore(); break;
    case 'ironball': {
      c.save(); c.rotate(ang); c.strokeStyle = '#6b7385'; c.lineWidth = 2.4;
      [-14, -21].forEach(x => { ell(c, x, 0, 4, 2.6); c.stroke(); }); c.restore();
      const g = c.createRadialGradient(-3, -3, 1, 0, 0, 10); g.addColorStop(0, '#dfe4ee'); g.addColorStop(.4, '#7d8698'); g.addColorStop(1, '#2c3140');
      circ(c, 0, 0, 10); fs(c, g, 2.2); break; }
    case 'quake': c.save(); c.rotate(t * 3); rr(c, -10, -9, 20, 18, 3); fs(c, vg(c, -9, 9, '#8d7a68', '#4d3f34'), 2.2);
      c.strokeStyle = '#ffa53a'; c.lineWidth = 2; c.shadowColor = '#ff8a2a'; c.shadowBlur = 6; c.beginPath(); c.moveTo(-7, -6); c.lineTo(-1, -1); c.lineTo(-4, 3); c.lineTo(3, 7); c.moveTo(-1, -1); c.lineTo(6, -5); c.stroke(); c.restore(); break;
    case 'meteor': {
      c.save(); c.rotate(ang); const g = c.createRadialGradient(0, 0, 4, -6, 0, 24); g.addColorStop(0, 'rgba(255,240,160,.95)'); g.addColorStop(.5, 'rgba(255,120,40,.7)'); g.addColorStop(1, 'rgba(255,80,30,0)');
      c.fillStyle = g; ell(c, -8, 0, 26, 16); c.fill(); c.restore(); rock(c, 12, t * 4, 9);
      c.strokeStyle = '#ff9a3a'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-5, -3); c.lineTo(0, 2); c.lineTo(5, -1); c.stroke(); break; }
    case 'drop': c.save(); c.rotate(ang); c.beginPath(); c.moveTo(-15, 0); c.bezierCurveTo(-6, -8, 10, -10, 10, 0); c.bezierCurveTo(10, 10, -6, 8, -15, 0);
      fs(c, vg(c, -9, 9, '#d8f4ff', '#62bdf0', '#2a86c2'), 2.2); c.fillStyle = 'rgba(255,255,255,.85)'; ell(c, 3, -3.5, 3.5, 2); c.fill(); c.restore(); break;
    case 'thunder': {
      if ((t * 8) % 1 < .6) { c.beginPath(); c.moveTo(-2, 6); c.lineTo(3, 12); c.lineTo(-1, 13); c.lineTo(4, 22); c.lineTo(-5, 12); c.lineTo(-1, 11); c.closePath(); fs(c, '#ffe066', 1.8); }
      c.beginPath(); [[-8, 2, 7], [0, -4, 9], [8, 2, 7], [0, 4, 7]].forEach(([x, y, r]) => { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); });
      c.strokeStyle = OUT; c.lineWidth = 4.5; c.stroke(); c.fillStyle = '#8693a6'; c.fill(); c.save(); c.clip(); c.fillStyle = '#5e6a7c'; c.fillRect(-20, 4, 40, 10); c.restore(); break; }
    case 'storm': for (let k = 0; k < 4; k++) { c.save(); c.translate(0, 8 - k * 6); c.rotate(t * 14 + k); c.strokeStyle = k % 2 ? 'rgba(255,255,255,.95)' : 'rgba(160,190,215,.95)'; c.lineWidth = 3; ell(c, 0, 0, 6 + k * 4, 2.5 + k * 1.2); c.setLineDash([10, 6]); c.stroke(); c.restore(); } c.setLineDash([]); break;
    case 'ember': { const f = 1 + Math.sin(t * 30) * .12; c.save(); c.rotate(ang);
      c.beginPath(); c.moveTo(-22 * f, 0); c.quadraticCurveTo(-6, -10, 6, -6); c.quadraticCurveTo(-6, 10, -22 * f, 0); c.fillStyle = 'rgba(255,120,40,.85)'; c.fill(); c.restore();
      const g = c.createRadialGradient(0, 0, 1, 0, 0, 10); g.addColorStop(0, '#ffffff'); g.addColorStop(.35, '#ffe066'); g.addColorStop(.75, '#ff8a2a'); g.addColorStop(1, '#d6402a'); circ(c, 0, 0, 9 * f); fs(c, g, 2); break; }
    case 'molotov': c.save(); c.rotate(t * 7); rr(c, -6, -6, 12, 16, 5); fs(c, vg(c, -6, 10, '#9fe3a8', '#4f9e5c'), 2.2); rr(c, -2.5, -13, 5, 8, 1.5); fs(c, '#3f7d4b', 2);
      c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-3.5, -3, 2, 9); flame(c, 0, -13, .7, t); c.restore(); break;
    case 'phoenix': { c.save(); c.rotate(ang); const fl = Math.sin(t * 22);
      [-1, 1].forEach(sd => { c.save(); c.scale(1, sd * (.5 + .5 * Math.abs(fl))); c.beginPath(); c.moveTo(-2, 0); c.quadraticCurveTo(-8, -22, -22, -20); c.quadraticCurveTo(-12, -12, -10, 0); c.closePath(); fs(c, vg(c, -22, 0, '#ffe066', '#ff6a2a'), 2); c.restore(); });
      c.beginPath(); c.moveTo(-12, 0); c.quadraticCurveTo(-26, -6, -32, 2); c.quadraticCurveTo(-24, 2, -12, 3); fs(c, '#ff8a2a', 1.8);
      ell(c, 0, 0, 12, 6); fs(c, vg(c, -6, 6, '#fff3a0', '#ff8a2a'), 2.2); c.beginPath(); c.moveTo(11, -2); c.lineTo(17, 0); c.lineTo(11, 2); fs(c, '#ffd34d', 1.6);
      circ(c, 5, -1.5, 1.6); c.fillStyle = OUT; c.fill(); c.restore(); break; }
    case 'magball': { const g = c.createRadialGradient(-3, -3, 1, 0, 0, 9); g.addColorStop(0, '#f2f4f8'); g.addColorStop(1, '#5b5f70'); circ(c, 0, 0, 8.5); fs(c, g, 2.2);
      c.strokeStyle = 'rgba(185,140,255,.9)'; c.lineWidth = 1.6; ell(c, 0, 0, 15, 5, t * 2); c.stroke(); ell(c, 0, 0, 15, 5, t * 2 + 1.6); c.stroke();
      [0, 1].forEach(k => { const a = t * 8 + k * Math.PI, r0 = t * 2 + k * 1.6; const px = Math.cos(a) * 15, py = Math.sin(a) * 5; circ(c, px * Math.cos(r0) - py * Math.sin(r0), px * Math.sin(r0) + py * Math.cos(r0), 2.6); c.fillStyle = '#e5d4ff'; c.fill(); }); break; }
    case 'horseshoe': c.save(); c.rotate(t * 6); c.lineCap = 'butt'; c.beginPath(); c.moveTo(-6, -9); c.lineTo(-6, 0); c.arc(0, 0, 6, Math.PI, 0, true); c.lineTo(6, -9);
      c.strokeStyle = OUT; c.lineWidth = 8; c.stroke(); c.strokeStyle = '#e8474f'; c.lineWidth = 5; c.stroke(); rr(c, -9, -13, 6, 5, 1); fs(c, '#e3e7ee', 1.6); rr(c, 3, -13, 6, 5, 1); fs(c, '#e3e7ee', 1.6); c.restore(); break;
    case 'emorb': { const g = c.createRadialGradient(0, 0, 2, 0, 0, 16); g.addColorStop(0, '#ffffff'); g.addColorStop(.4, '#d4b8ff'); g.addColorStop(1, 'rgba(140,90,230,0)'); c.fillStyle = g; circ(c, 0, 0, 16); c.fill();
      c.strokeStyle = '#efe4ff'; c.lineWidth = 1.8; const k = Math.floor(t * 14); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + k; c.beginPath(); c.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); for (let j = 1; j <= 3; j++) { const d = 6 + j * 5, aa = a + (hash(i * 7 + j + k) - .5) * .6; c.lineTo(Math.cos(aa) * d, Math.sin(aa) * d); } c.stroke(); } break; }
    case 'spore': { const s = sh.small ? .6 : 1; const g = c.createRadialGradient(0, 0, 1, 0, 0, 14 * s); g.addColorStop(0, '#fbffd8'); g.addColorStop(.45, '#c8f06a'); g.addColorStop(1, 'rgba(140,210,80,0)'); c.fillStyle = g; circ(c, 0, 0, 14 * s); c.fill();
      circ(c, 0, 0, 5.5 * s); fs(c, '#e9ff9a', 1.8); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * 3; circ(c, Math.cos(a) * 9 * s, Math.sin(a) * 9 * s, 1.6 * s); c.fillStyle = '#f4ffc0'; c.fill(); } break; }
    case 'toadstool': c.save(); c.rotate(Math.sin(t * 8) * .3); rr(c, -4, -2, 8, 12, 3); fs(c, '#f2e6d0', 2); c.beginPath(); c.moveTo(-13, 0); c.bezierCurveTo(-13, -16, 13, -16, 13, 0); c.closePath();
      fs(c, vg(c, -12, 0, '#c77dff', '#7b2fbf'), 2.2); [[-6, -5], [3, -8], [7, -3]].forEach(([x, y]) => { circ(c, x, y, 1.9); c.fillStyle = '#b6f36a'; c.fill(); }); c.restore(); break;
    case 'icecube': c.save(); c.rotate(t * 5); rr(c, -9, -9, 18, 18, 3); fs(c, 'rgba(205,240,255,.92)', 2.2); c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-5, -5); c.lineTo(-5, 2); c.moveTo(-5, -5); c.lineTo(2, -5); c.stroke();
      c.strokeStyle = 'rgba(80,160,200,.6)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(3, 2); c.lineTo(7, 7); c.stroke(); c.restore(); break;
    case 'snowflake': c.save(); c.rotate(t * 4); for (let pass = 0; pass < 2; pass++) { c.strokeStyle = pass ? '#ffffff' : '#2f7fa8'; c.lineWidth = pass ? 2.4 : 5; for (let i = 0; i < 6; i++) { c.save(); c.rotate(i * TAU / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -12); c.moveTo(0, -7); c.lineTo(-4, -10); c.moveTo(0, -7); c.lineTo(4, -10); c.stroke(); c.restore(); } } c.restore(); break;
    case 'wave': c.save(); c.rotate(ang); circ(c, 0, 0, 13); fs(c, vg(c, -13, 13, '#bdeeff', '#3aa0d8', '#1d5f99'), 2.4);
      c.beginPath(); c.moveTo(-12, -2); c.quadraticCurveTo(-4, -14, 8, -10); c.quadraticCurveTo(14, -6, 10, 0); c.quadraticCurveTo(6, -6, 0, -4); c.closePath(); fs(c, '#ffffff', 2);
      c.fillStyle = 'rgba(255,255,255,.6)'; circ(c, -5, 5, 2); c.fill(); circ(c, 3, 7, 1.4); c.fill(); c.restore(); break;
    case 'beacon': { const col = sh.color || '#ff7a3c'; c.save(); c.rotate(ang); rr(c, -10, -4.5, 18, 9, 4.5); fs(c, '#e8ecf2', 2); rr(c, 2, -4.5, 8, 9, 4); fs(c, col, 2); c.restore();
      const on = (t * 8) % 1 < .5; c.save(); c.globalCompositeOperation = 'lighter'; puff(c, 0, 0, on ? 14 : 9, col === '#2fe0ff' ? '47,224,255' : '255,122,60', on ? .55 : .3); c.restore(); break; }
    case 'bolt': c.save(); c.rotate(ang); c.shadowColor = '#2fe0ff'; c.shadowBlur = 14; rr(c, -18, -5, 28, 10, 5); c.fillStyle = '#2fe0ff'; c.fill(); rr(c, -12, -2.5, 20, 5, 2.5); c.fillStyle = '#ffffff'; c.fill(); c.restore(); break;
    default: circ(c, 0, 0, 8); fs(c, '#ccc');
  }
}
function trail(c, sh, pts, t) {
  pts.forEach(([x, y], i) => {
    const k = 1 - i / pts.length, j = i + Math.floor(t * 30);
    switch (sh.trail) {
      case 'dust': puff(c, x, y, 2 + (1 - k) * 4, '200,170,135', k * .55); break;
      case 'smoke': puff(c, x, y, 3 + (1 - k) * 6, '225,220,215', k * .6); break;
      case 'fire': c.save(); c.globalCompositeOperation = 'lighter'; puff(c, x, y, 3 + k * 7, k > .6 ? '255,210,90' : '255,110,40', k * .6); c.restore(); break;
      case 'drops': if (i % 2 === 0) { circ(c, x + (hash(j) - .5) * 6, y + (1 - k) * 10, 2.2 * k + .6); c.fillStyle = `rgba(150,215,250,${k})`; c.fill(); } break;
      case 'spark': if (i % 2 === 0) { const col = sh.color || '#ffe066'; c.strokeStyle = rgba(col, k); c.lineWidth = 1.6; const s = 3 * k + 1, ox = (hash(j) - .5) * 8, oy = (hash(j + 1) - .5) * 8; c.beginPath(); c.moveTo(x + ox - s, y + oy); c.lineTo(x + ox + s, y + oy); c.moveTo(x + ox, y + oy - s); c.lineTo(x + ox, y + oy + s); c.stroke(); } break;
      case 'wind': if (i % 3 === 0) { c.strokeStyle = `rgba(255,255,255,${k * .8})`; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 6 + (1 - k) * 8, 0, Math.PI * 1.2); c.stroke(); } break;
      case 'glow': puff(c, x, y, 2 + k * 5, sh.color === '#2fe0ff' ? '47,224,255' : sh.color === '#b98cff' ? '185,140,255' : '200,240,106', k * .45); break;
      case 'frost': if (i % 2 === 0) { c.save(); c.translate(x + (hash(j) - .5) * 8, y + (hash(j + 2) - .5) * 8); c.rotate(.785); c.fillStyle = `rgba(230,250,255,${k})`; c.fillRect(-2, -2, 4, 4); c.restore(); } break;
      case 'bubbles': if (i % 2 === 0) { circ(c, x + (hash(j) - .5) * 6, y - (1 - k) * 8, 1.5 + (1 - k) * 3); c.strokeStyle = `rgba(190,120,240,${k})`; c.lineWidth = 1.4; c.stroke(); } break;
    }
  });
}
const BOOM = {
  dirt: ['#fff1c1', '#ffb347', '#8a6040'], fire: ['#fff6a8', '#ff6a2a', '#ffb347'], quake: ['#ffe0a0', '#c98042', '#7a5a40'],
  water: ['#ffffff', '#5fc3f0', '#bfeaff'], electric: ['#ffffff', '#b98cff', '#e9ddff'], wind: ['#ffffff', '#c6d6e6', '#ffffff'],
  toxic: ['#f4ffb0', '#8ad24a', '#b36ad9'], ice: ['#ffffff', '#9fe6ff', '#ffffff'], beam: ['#ffffff', '#2fe0ff', '#c8fbff'],
};
function boom(c, sh, x, y, p) {
  const [c1, c2, c3] = BOOM[sh.boom], R = sh.R, a = 1 - p, kind = sh.boom;
  const mid = sh.boom === 'electric' && sh.color ? sh.color : c2;
  const rad = R * (.5 + .9 * p);
  const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, rgba(c1, a)); g.addColorStop(.5, rgba(mid, a * .9)); g.addColorStop(1, rgba(mid, 0));
  c.fillStyle = g; circ(c, x, y, rad); c.fill();
  c.strokeStyle = rgba(mid, a * .8); c.lineWidth = 3 * a + 1; circ(c, x, y, R * (.3 + 1.3 * p)); c.stroke();
  for (let i = 0; i < 12; i++) {
    const an = -Math.PI * (.08 + .84 * hash(i + R)), sp = R * (.9 + hash(i + 5) * 1.3), px = x + Math.cos(an) * sp * p, py = y + Math.sin(an) * sp * p + 40 * p * p;
    c.save(); c.translate(px, py); c.globalAlpha = a;
    if (kind === 'water') { ell(c, 0, 0, 2.5, 4, an); c.fillStyle = c3; c.fill(); }
    else if (kind === 'ice') { c.rotate(an); c.beginPath(); c.moveTo(-4, 0); c.lineTo(4, -2); c.lineTo(3, 2); c.closePath(); fs(c, c3, 1.2); }
    else if (kind === 'toxic') { circ(c, 0, -p * 10, 3); c.strokeStyle = c3; c.lineWidth = 1.6; c.stroke(); }
    else if (kind === 'electric' || kind === 'beam') { c.strokeStyle = c1; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-3, -3); c.lineTo(3, 3); c.moveTo(3, -3); c.lineTo(-3, 3); c.stroke(); }
    else if (kind === 'wind') { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 5, an, an + 2.4); c.stroke(); }
    else { c.fillStyle = c3; c.fillRect(-2.5, -2.5, 5, 5); }
    c.restore();
  }
  if (kind === 'electric' || kind === 'beam') { c.strokeStyle = rgba('#ffffff', a); c.lineWidth = 2; for (let i = 0; i < 5; i++) { const an = i / 5 * TAU + p * 3; c.beginPath(); c.moveTo(x, y); for (let j = 1; j <= 3; j++) { const d = R * .45 * j * (.6 + p), aa = an + (hash(i * 3 + j) - .5) * .9; c.lineTo(x + Math.cos(aa) * d, y + Math.sin(aa) * d); } c.stroke(); } }
  if (kind === 'fire') for (let i = 0; i < 3; i++) { c.save(); c.globalAlpha = a; flame(c, x - R * .4 + i * R * .4, y - 2, .8 + p, p * 10 + i); c.restore(); }
  if (kind === 'quake') { c.strokeStyle = rgba('#5a3b22', a); c.lineWidth = 2; [-1, 1].forEach(d => { c.beginPath(); c.moveTo(x, y + 2); for (let j = 1; j <= 4; j++) c.lineTo(x + d * j * R * .35 * (.5 + p), y + 2 + (j % 2 ? 4 : -1)); c.stroke(); }); ell(c, x, y + 4, R * (.6 + 1.4 * p), 4 + 3 * p); c.strokeStyle = rgba('#ffe0a0', a * .8); c.stroke(); }
  if (kind === 'water') { c.strokeStyle = rgba('#ffffff', a); c.lineWidth = 3; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * R * .25, y); c.quadraticCurveTo(x + i * R * .4, y - R * (1 - Math.abs(i) * .25) * p * 1.4, x + i * R * .55, y - R * .3 * p); c.stroke(); } }
}

/* ---------- 지속 효과: 독 안개, 불바다 ---------- */
// x 중심, gy 땅 높이, r 반경, a 전체 투명도(사라질 때 0으로)
function poisonFog(c, x, gy, r, t, a = 1) {
  c.save();
  // 바닥 독 웅덩이
  const pg = c.createRadialGradient(x, gy, 4, x, gy, r);
  pg.addColorStop(0, `rgba(150,220,70,${.45 * a})`); pg.addColorStop(1, 'rgba(150,220,70,0)');
  c.fillStyle = pg; ell(c, x, gy + 2, r, 10); c.fill();
  // 피어오르는 안개 덩어리
  for (let i = 0; i < 9; i++) {
    const ph = (t * .12 + i / 9) % 1, side = (hash(i) - .5) * 2;
    const bx = x + side * r * .8 + Math.sin(t * .9 + i * 1.7) * 10, by = gy - 10 - ph * r * .9 - hash(i + 3) * 14;
    const br = r * (.35 + .25 * hash(i + 7)) * (.7 + ph * .6), al = Math.sin(ph * Math.PI) * .55 * a;
    const g = c.createRadialGradient(bx, by, 2, bx, by, br);
    const col = i % 3 === 0 ? '170,230,90' : '150,80,200';
    g.addColorStop(0, `rgba(${col},${al})`); g.addColorStop(.6, `rgba(${col},${al * .5})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; circ(c, bx, by, br); c.fill();
  }
  // 거품
  for (let i = 0; i < 7; i++) {
    const ph = (t * .6 + i / 7) % 1, bx = x + (hash(i + 11) - .5) * r * 1.4, by = gy - ph * 46;
    circ(c, bx, by, 2 + 2.5 * hash(i)); c.lineWidth = 1.5; c.strokeStyle = `rgba(200,140,240,${(1 - ph) * a})`; c.stroke();
  }
  // 바닥에 자란 독버섯
  [[-.55, .8], [0, 1.1], [.5, .7], [.85, .55]].forEach(([u, s], i) => {
    const grow = Math.min(1, a * 1.5);
    c.save(); c.globalAlpha = a; c.translate(x + u * r, gy + 3); c.scale(s * grow, s * grow); c.rotate(Math.sin(t * 2 + i) * .08);
    rr(c, -3, -10, 6, 10, 2); fs(c, '#efe0c8', 1.6);
    c.beginPath(); c.moveTo(-10, -9); c.bezierCurveTo(-10, -22, 10, -22, 10, -9); c.closePath(); fs(c, vg(c, -21, -9, '#c77dff', '#7b2fbf'), 1.8);
    circ(c, -4, -14, 1.6); c.fillStyle = '#b6f36a'; c.fill(); circ(c, 4, -16, 1.3); c.fill();
    c.restore();
  });
  c.restore();
}
function fireField(c, x, gy, r, t, a = 1) {
  c.save();
  const g = c.createRadialGradient(x, gy, 2, x, gy, r * 1.2);
  g.addColorStop(0, `rgba(255,140,40,${.5 * a})`); g.addColorStop(1, 'rgba(255,140,40,0)');
  c.fillStyle = g; ell(c, x, gy - 4, r * 1.2, 22); c.fill();
  c.globalAlpha = a;
  for (let i = 0; i < 6; i++) { const u = -1 + i * .4; flame(c, x + u * r * .9, gy + 3, .7 + .5 * hash(i) + .15 * Math.sin(t * 6 + i), t + i * .7); }
  for (let i = 0; i < 6; i++) { const ph = (t * .8 + i / 6) % 1; circ(c, x + (hash(i + 4) - .5) * r * 1.6 + Math.sin(t * 3 + i) * 4, gy - 8 - ph * 50, 1.8); c.fillStyle = `rgba(255,210,90,${1 - ph})`; c.fill(); }
  c.restore();
}
function zoneLabel(c, x, y, text, col) {
  c.save(); c.font = '13px Jua, sans-serif'; c.textAlign = 'center';
  const w = c.measureText(text).width + 14;
  rr(c, x - w / 2, y - 14, w, 19, 9.5); c.fillStyle = 'rgba(31,45,82,.85)'; c.fill();
  c.fillStyle = col; c.fillText(text, x, y); c.restore();
}
