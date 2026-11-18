/* 포탄대결 월드 엔진
   맵 지형(재질별 픽셀 채색), 자연스러운 땅 파임, 2D 바람, 낙사, 필살기 연출, 돌발 이벤트.
   art.js 다음에 불러온다. 화면 목업과 도감이 모두 이 파일을 쓴다. */
const G0 = 380, SPEED = 5.6, WINDK = 14;
const MAT = [['soil', 255, 0, 0], ['rock', 0, 0, 255], ['steel', 0, 255, 0], ['leaf', 255, 255, 0], ['wood', 255, 0, 255], ['cap', 0, 255, 255], ['ice', 255, 255, 255]];
const MK = Object.fromEntries(MAT.map(([id, r, g, b]) => [id, `rgb(${r},${g},${b})`]));
function hash2(x, y) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const hex3 = s => { const n = parseInt(s.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const ease = u => u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u);
const lerp = (a, b, k) => a + (b - a) * k;

/* ---------- 지형 그리기 도구 (u, v = 0~1 비율 좌표) ---------- */
function under(c, w, h, fn, u0, u1, mat, bottom = 1.05) {
  c.fillStyle = MK[mat]; c.beginPath(); c.moveTo(u0 * w, bottom * h);
  for (let x = u0 * w; x <= u1 * w + .5; x += 2) c.lineTo(x, fn(x / w) * h);
  c.lineTo(u1 * w, bottom * h); c.closePath(); c.fill();
}
function blob(c, w, h, pts, mat) { c.fillStyle = MK[mat]; c.beginPath(); pts.forEach(([u, v], i) => i ? c.lineTo(u * w, v * h) : c.moveTo(u * w, v * h)); c.closePath(); c.fill(); }
function box(c, w, h, u, v, uw, vh, mat) { c.fillStyle = MK[mat]; c.fillRect(u * w, v * h, uw * w, vh * h); }
function tree(c, w, h, u, v, s = 1) {
  const x = u * w, y = v * h, k = s * w / 960;
  c.fillStyle = MK.wood; c.fillRect(x - 4 * k, y - 36 * k, 8 * k, 44 * k);
  c.fillStyle = MK.leaf; [[0, -54, 22], [-16, -42, 16], [16, -42, 16], [0, -72, 15]].forEach(([dx, dy, r]) => { c.beginPath(); c.arc(x + dx * k, y + dy * k, r * k, 0, TAU); c.fill(); });
}
function island(c, w, h, u, v, uw, depth) {
  const x0 = u * w, x1 = (u + uw) * w, y = v * h, d = depth * h, m = (x0 + x1) / 2, s = x1 - x0;
  c.fillStyle = MK.soil; c.beginPath(); c.moveTo(x0, y + 6);
  for (let x = x0; x <= x1; x += 3) c.lineTo(x, y - 5 * Math.sin((x - x0) / s * Math.PI) + 2 * Math.sin(x * .09));
  c.lineTo(x1, y + 6); c.quadraticCurveTo(m + s * .2, y + d * .9, m, y + d); c.quadraticCurveTo(m - s * .25, y + d * .7, x0, y + 6); c.fill();
  c.fillStyle = MK.rock; c.beginPath(); c.moveTo(x0 + s * .1, y + d * .3); c.quadraticCurveTo(m, y + d * .45, x1 - s * .1, y + d * .3);
  c.quadraticCurveTo(m + s * .14, y + d * .95, m, y + d - 2); c.quadraticCurveTo(m - s * .2, y + d * .65, x0 + s * .1, y + d * .3); c.fill();
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

/* ---------- 맵 9종 ---------- */
const hillsY = u => .66 + .06 * Math.sin(u * 7 + .4) + .03 * Math.sin(u * 19 + 2);
const valleyY = u => u < .3 ? .42 + .012 * Math.sin(u * 30) : .42 + (u - .3) * .62;
const moonY = u => .68 + .04 * Math.sin(u * 5 + 1) + .02 * Math.sin(u * 17);
const MAPS = {
  hills: {
    n: '초록언덕', d: '완만한 언덕과 나무가 있는 기본 맵. 처음 하는 사람에게 좋다.', tags: ['입문', '나무도 부서짐'],
    grav: 1, windMax: 8, liquid: null, spawn: [.17, .83], ev: { tornado: .25, lightning: .15, meteors: .1 },
    pal: { soil: ['#b07a48', '#5e3a22'], crust: '#7cc25a', rock: ['#8a8478', '#55504a'], leaf: '#4f9e3c', wood: '#7a4f2c' },
    sky: { stops: ['#7ec8f0', '#bfe6f7', '#e8f6f0'], sun: [.8, .18, .035, '#fff6c8'], clouds: 5, far: [['#a6d6b8', .6, .05, 6, 1], ['#86c49a', .68, .04, 9, 2]] },
    terrain(c, w, h) { under(c, w, h, hillsY, 0, 1, 'soil'); [.07, .31, .6, .93].forEach(u => tree(c, w, h, u, hillsY(u) + .006)); },
  },
  valley: {
    n: '골짜기', d: '양쪽 높은 고원 사이로 바닥이 보이지 않는 깊은 골짜기. 밀려 떨어지면 그대로 낙사.', tags: ['필수 맵', '낙사 주의', '강한 바람'],
    grav: 1, windMax: 10, liquid: { y: .9, type: 'water' }, spawn: [.15, .85], ev: { tornado: .35, lightning: .2, meteors: .05 },
    pal: { soil: ['#a87a4e', '#5a3c26'], crust: '#86c45e', rock: ['#a0958a', '#5c544e'], leaf: '#3f8f46', wood: '#6d4526' },
    sky: { stops: ['#f0a070', '#f6cc98', '#fbe6c2'], sun: [.5, .34, .05, '#fff0c0'], clouds: 3, far: [['#cf9f8c', .48, .09, 5, 0], ['#b08478', .57, .06, 8, 1.5]] },
    terrain(c, w, h) {
      under(c, w, h, valleyY, 0, .418, 'soil'); under(c, w, h, u => valleyY(1 - u), .582, 1, 'soil');
      const wall = [[.395, .482], [.418, .494], [.426, .56], [.419, .64], [.434, .74], [.427, .84], [.442, 1.05], [.37, 1.05], [.38, .6]];
      blob(c, w, h, wall, 'rock'); blob(c, w, h, wall.map(([u, v]) => [1 - u, v]), 'rock');
      blob(c, w, h, [[.474, .76], [.49, .722], [.512, .718], [.527, .75], [.534, 1.05], [.466, 1.05]], 'rock');
      [.05, .22, .78, .95].forEach(u => tree(c, w, h, u, valleyY(u < .5 ? u : 1 - u) + .006, .95));
    },
  },
  mesa: {
    n: '모래협곡', d: '평평한 바위 탑(메사)이 솟은 사막. 높은 탑을 차지하면 유리하다.', tags: ['고저차 큼', '모래 회오리'],
    grav: 1, windMax: 10, liquid: null, spawn: [.1, .85], ev: { tornado: .4, meteors: .1 },
    pal: { soil: ['#e6b86e', '#9a6a3a'], crust: '#f6dca0', rock: ['#cf7e4e', '#7a3f26'] },
    sky: { stops: ['#f2b670', '#f9dca6', '#fdf0d0'], sun: [.2, .2, .045, '#fff7d8'], far: [['#e7b48a', .6, .03, 4, 0]],
      extra(c, w, h) { c.fillStyle = 'rgba(205,130,90,.45)'; [[.12, .48, .1], [.4, .52, .08], [.7, .45, .12]].forEach(([u, v, s]) => { c.fillRect(u * w, v * h, s * w, h); }); } },
    terrain(c, w, h) {
      under(c, w, h, u => .86 + .02 * Math.sin(u * 11), 0, 1, 'soil');
      [[.04, .16, .52], [.27, .4, .42], [.55, .66, .5], [.78, .92, .44]].forEach(([a, b, t]) => {
        blob(c, w, h, [[a - .01, .88], [a + .012, t + .05], [a + .02, t], [b - .02, t], [b - .012, t + .05], [b + .01, .88]], 'rock');
        box(c, w, h, a + .02, t - .014, b - a - .04, .022, 'soil');
      });
    },
  },
  ice: {
    n: '얼음호수', d: '얼어붙은 호수 위 얼음 섬들. 섬 사이 물에 빠지면 낙사.', tags: ['낙사 주의', '얼음 섬'],
    grav: 1, windMax: 9, liquid: { y: .76, type: 'water' }, spawn: [.13, .86], ev: { lightning: .25, tornado: .2 },
    pal: { soil: ['#9fb6c8', '#5d7488'], crust: '#ffffff', ice: ['#d8f2ff', '#78b8dc'] },
    sky: { stops: ['#9ab8dc', '#cfe2f2', '#eef6fb'], sun: [.75, .2, .03, '#ffffff'], clouds: 4, far: [['#c3d4e6', .55, .07, 6, 1], ['#e2ecf5', .66, .03, 10, 0]] },
    terrain(c, w, h) { [[.02, .25, .66], [.31, .46, .7], [.52, .67, .63], [.73, .98, .67]].forEach(([a, b, v]) => blob(c, w, h, [[a, v + .025], [a + .02, v], [b - .02, v], [b, v + .025], [b - .03, .86], [a + .03, .86]], 'ice')); },
  },
  sky: {
    n: '구름섬', d: '하늘에 뜬 섬들. 아래는 끝없는 허공이라 밀려나면 바로 낙사.', tags: ['낙사 주의', '섬 사이 이동 불가'],
    grav: 1, windMax: 10, liquid: { y: 1.02, type: 'void' }, spawn: [.13, .86], ev: { tornado: .35, lightning: .3 },
    pal: { soil: ['#9a7a58', '#5a4632'], crust: '#9ad66a', rock: ['#8b8aa0', '#55546a'], leaf: '#5aa84a', wood: '#7a4f2c' },
    sky: { stops: ['#5fa8e8', '#9ccff2', '#d6ecf8'], sun: [.85, .14, .035, '#ffffff'], clouds: 10 },
    terrain(c, w, h) { island(c, w, h, .03, .5, .21, .24); island(c, w, h, .28, .63, .14, .17); island(c, w, h, .44, .41, .13, .19); island(c, w, h, .61, .6, .14, .16); island(c, w, h, .77, .48, .2, .24); tree(c, w, h, .07, .5, .85); tree(c, w, h, .93, .48, .85); tree(c, w, h, .5, .405, .8); },
  },
  factory: {
    n: '폐공장', d: '부서지지 않는 철판과 철골 다리가 있는 공장 터. 가운데 산성 웅덩이는 낙사.', tags: ['철판은 안 부서짐', '엄폐물', '낙사 주의'],
    grav: 1, windMax: 7, liquid: { y: .93, type: 'acid' }, spawn: [.13, .87], ev: { pillar: .2, lightning: .2 },
    pal: { soil: ['#7a6a5a', '#3e342c'], crust: '#8f8f7a', rock: ['#a8664c', '#5e3426'], steel: '#9aa4b2' },
    sky: { stops: ['#4f4570', '#9f84a4', '#e3bba0'], far: [['#4a4060', .62, .0, 1, 0]],
      extra(c, w, h) { c.fillStyle = 'rgba(60,50,85,.8)'; [[.1, .35, .03], [.16, .28, .025], [.82, .3, .03], [.62, .4, .02]].forEach(([u, v, s]) => c.fillRect(u * w, v * h, s * w, h)); c.fillRect(0, .55 * h, w, h); } },
    terrain(c, w, h) {
      under(c, w, h, u => .8 + .015 * Math.sin(u * 13), 0, .4, 'soil'); under(c, w, h, u => .8 + .015 * Math.sin(u * 13), .6, 1, 'soil');
      box(c, w, h, .06, .6, .14, .22, 'rock'); box(c, w, h, .8, .56, .14, .26, 'rock');
      box(c, w, h, .05, .585, .16, .02, 'steel'); box(c, w, h, .79, .545, .16, .02, 'steel');
      box(c, w, h, .37, .62, .26, .025, 'steel'); box(c, w, h, .385, .645, .012, .3, 'steel'); box(c, w, h, .603, .645, .012, .3, 'steel');
      box(c, w, h, .46, .4, .08, .015, 'steel'); box(c, w, h, .495, .415, .01, .205, 'steel');
      box(c, w, h, .25, .66, .07, .14, 'rock'); box(c, w, h, .68, .64, .06, .16, 'rock');
    },
  },
  shroom: {
    n: '버섯숲', d: '거대한 버섯 갓이 층층이 있는 숲. 갓 위에 올라서면 높은 자리.', tags: ['여러 층', '갓은 잘 부서짐'],
    grav: 1, windMax: 8, liquid: null, spawn: [.12, .9], ev: { tornado: .2, lightning: .15, meteors: .1 },
    pal: { soil: ['#6a5a7a', '#342a40'], crust: '#7fd06c', wood: '#efe0c8', cap: '#e5487a', leaf: '#4f9e3c' },
    sky: { stops: ['#284a5a', '#5f9a9a', '#c4e4cc'], far: [['#3f6f6a', .52, .06, 7, 0], ['#4f807a', .62, .05, 11, 1]],
      extra(c, w, h) { for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(230,255,160,${.4 + hash(i) * .5})`; circ(c, hash(i + 3) * w, (.2 + hash(i + 7) * .5) * h, 1.5); c.fill(); } } },
    terrain(c, w, h) {
      under(c, w, h, u => .84 + .02 * Math.sin(u * 9), 0, 1, 'soil');
      [[.12, .58, .1], [.32, .44, .085], [.52, .62, .11], [.72, .4, .1], [.9, .6, .085]].forEach(([u, v, r]) => {
        box(c, w, h, u - .014, v, .028, .86 - v, 'wood');
        c.fillStyle = MK.cap; c.beginPath(); c.ellipse(u * w, v * h + 6, r * w, r * w * .55, 0, Math.PI, 0); c.closePath(); c.fill();
      });
    },
  },
  volcano: {
    n: '화산섬', d: '가운데 화산이 불기둥을 뿜는 섬. 바다는 용암이라 빠지면 낙사.', tags: ['불기둥 자주', '낙사 주의'],
    grav: 1, windMax: 9, liquid: { y: .86, type: 'lava' }, spawn: [.12, .88], ev: { pillar: .55, meteors: .25 },
    pal: { soil: ['#6a5048', '#2a1c1c'], crust: '#8a7a6a', rock: ['#4a3a3a', '#1e1414'] },
    sky: { stops: ['#2a1420', '#7a2a2a', '#e0703a'], far: [['#3a1a20', .58, .05, 5, 0]],
      extra(c, w, h) { for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(60,40,45,${.35 - i * .04})`; circ(c, (.5 + i * .04) * w, (.2 - i * .03) * h, (.04 + i * .02) * w); c.fill(); } } },
    terrain(c, w, h) {
      under(c, w, h, u => { const cone = Math.max(0, 1 - Math.abs(u - .5) / .22), cr = Math.abs(u - .5) < .045 ? .07 * (1 - Math.abs(u - .5) / .045) : 0; return .8 - cone * .5 + cr + .012 * Math.sin(u * 23); }, .1, .9, 'rock');
      under(c, w, h, u => .7 + .03 * Math.sin(u * 12) + (u < .04 ? (.04 - u) * 4 : 0), 0, .3, 'soil'); under(c, w, h, u => .7 + .03 * Math.sin(u * 12) + (u > .96 ? (u - .96) * 4 : 0), .7, 1, 'soil');
    },
  },
  moon: {
    n: '달기지', d: '중력이 절반인 달. 바람이 없고 포탄이 아주 멀리 날아간다.', tags: ['중력 50%', '바람 없음', '운석 자주'],
    grav: .5, windMax: 0, liquid: null, spawn: [.12, .88], ev: { meteors: .5 },
    pal: { soil: ['#b8b8c0', '#6a6a78'], crust: '#dcdce4', steel: '#c8d0dc' },
    sky: { stops: ['#05060f', '#0d1024', '#1a1d3a'], stars: true, planet: [.78, .2, .06, '#4f98e0'], far: [['#2a2c40', .62, .04, 5, 0]] },
    terrain(c, w, h) {
      under(c, w, h, moonY, 0, 1, 'soil');
      c.globalCompositeOperation = 'destination-out'; [[.25, 30], [.45, 22], [.68, 34]].forEach(([u, r]) => { c.beginPath(); c.ellipse(u * w, moonY(u) * h + 4, r * w / 960 * 1.6, r * w / 960 * .7, 0, 0, TAU); c.fill(); }); c.globalCompositeOperation = 'source-over';
      [[.34, 26], [.58, 20]].forEach(([u, r]) => { c.fillStyle = MK.steel; c.beginPath(); c.arc(u * w, moonY(u) * h + 3, r * w / 960, Math.PI, 0); c.fill(); });
    },
  },
  demo: {
    n: '연습장', d: '도감용 평지', tags: [], grav: 1, windMax: 0, liquid: null, spawn: [.16, .82], ev: {},
    pal: { soil: ['#c98b4f', '#6a4228'], crust: '#e8c27a', rock: ['#8a8478', '#55504a'] },
    sky: { stops: ['#f2b880', '#f7d9a8', '#f9e7c4'], sun: [.82, .2, .05, '#fff3d6'], far: [['#e2b590', .62, .05, 8, 0]] },
    terrain(c, w, h) { under(c, w, h, u => .8 + .02 * Math.sin(u * 9 + 1), 0, 1, 'soil'); },
  },
};
const MAP_ORDER = ['hills', 'valley', 'mesa', 'ice', 'sky', 'factory', 'shroom', 'volcano', 'moon'];

/* ---------- 재질 채색 ---------- */
function palette(m) {
  const p = m.pal, two = (v, d) => Array.isArray(v) ? [hex3(v[0]), hex3(v[1])] : v ? [hex3(v), hex3(v).map(x => x * .6)] : d;
  const s = two(p.soil, [[176, 122, 72], [94, 58, 34]]), r = two(p.rock, [[138, 132, 120], [85, 80, 74]]), i = two(p.ice, [[216, 242, 255], [120, 184, 220]]);
  return { soil0: s[0], soil1: s[1], rock0: r[0], rock1: r[1], ice0: i[0], ice1: i[1], crust: p.crust ? hex3(p.crust) : null, steel0: hex3(p.steel || '#9aa4b2'), leaf0: hex3(p.leaf || '#4f9e3c'), wood0: hex3(p.wood || '#7a4f2c'), cap0: hex3(p.cap || '#e5487a') };
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
  else { c = mix3(P.ice0, P.ice1, Math.min(1, d / 70)); k = 1 + .08 * Math.sin((x + y) * .12) + n * .05; if (P.crust && d < 6) { c = P.crust; k = d > 4 ? .86 : 1; } }
  out[0] = Math.min(255, c[0] * k); out[1] = Math.min(255, c[1] * k); out[2] = Math.min(255, c[2] * k);
}
const WORLD_CACHE = {};
function bakeMap(id, w, h) {
  const key = id + ':' + w + 'x' + h; if (WORLD_CACHE[key]) return WORLD_CACHE[key];
  const m = MAPS[id], P = palette(m);
  const mk = document.createElement('canvas'); mk.width = w; mk.height = h; const mc = mk.getContext('2d'); m.terrain(mc, w, h);
  const src = mc.getImageData(0, 0, w, h).data;
  const fg = new ImageData(w, h), bk = new ImageData(w, h), st = new ImageData(w, h), out = [0, 0, 0], pass = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let d = 0, prev = false;
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4, a = src[i + 3];
      if (a < 40) { prev = false; continue; }
      d = prev ? d + 1 : 0; prev = true;
      let best = 0, bd = 1e9; for (let k = 0; k < MAT.length; k++) { const dd = (src[i] - MAT[k][1]) ** 2 + (src[i + 1] - MAT[k][2]) ** 2 + (src[i + 2] - MAT[k][3]) ** 2; if (dd < bd) { bd = dd; best = k; } }
      const mat = MAT[best][0]; shadeMat(mat, d, x, y, P, out);
      if (mat === 'leaf' || mat === 'wood') prev = false; // 나무 아래 흙은 나무와 상관없이 지면부터 깊이를 센다
      fg.data[i] = out[0]; fg.data[i + 1] = out[1]; fg.data[i + 2] = out[2]; fg.data[i + 3] = a;
      if (mat !== 'leaf' && mat !== 'wood') { bk.data[i] = out[0] * .38 + 8; bk.data[i + 1] = out[1] * .36 + 6; bk.data[i + 2] = out[2] * .4 + 14; bk.data[i + 3] = a; } else pass[y * w + x] = 1;
      if (mat === 'steel') { st.data[i] = out[0]; st.data[i + 1] = out[1]; st.data[i + 2] = out[2]; st.data[i + 3] = a; }
    }
  }
  const toCanvas = img => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(img, 0, 0); return c; };
  const sky = document.createElement('canvas'); sky.width = w; sky.height = h; skyPaint(sky.getContext('2d'), w, h, m.sky);
  return (WORLD_CACHE[key] = { fg, back: toCanvas(bk), steel: toCanvas(st), sky, pass });
}

/* ---------- 연출용 그림 ---------- */
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
function drawTornado(c, x, gy, H, t, a = 1, col = '230,236,240') {
  c.save(); c.globalAlpha = a;
  for (let i = 0; i < 14; i++) {
    const k = i / 13, y = gy - k * H, r = 6 + k * k * 44 + Math.sin(t * 9 + i) * 2, sx = x + Math.sin(t * 4 + k * 5) * 10 * k;
    c.beginPath(); c.ellipse(sx, y, r, 4 + k * 5, 0, t * 10 + i, t * 10 + i + 4.4); c.strokeStyle = `rgba(${col},${.35 + .5 * (1 - k)})`; c.lineWidth = 3.5; c.stroke();
  }
  for (let i = 0; i < 8; i++) { const p = (t * 1.3 + i / 8) % 1, ang = t * 12 + i * 2, r = 8 + p * 40; c.fillStyle = `rgba(140,110,80,${(1 - p) * .9})`; c.fillRect(x + Math.cos(ang) * r, gy - p * H * .8, 3, 3); }
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

/* ---------- 필살기 연출 ---------- */
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
        W.hurtArea(s.x, Math.min(s.y, top + 10), s.sh.r * s.k + 20, s.sh.dmg * s.k, s.owner, { tall: s.y - top }); W.boomAt(s.sh, s.x, top + 6, s.k); W.debris(s.x, top, 30, 2); W.shake += .8; }
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
      [.45, .65, .85, 1.05, 1.25].forEach((tt, i) => { if (s.t >= tt && !s.done[i]) { s.done[i] = true; const x = s.x + [-50, 30, -15, 55, 0][i] * s.k, gy = W.ground(x, 0); s.flash[i] = { x, gy, t: s.t }; W.carveRound(x, gy, 16 * s.k); W.hurtArea(x, gy - 10, 30, s.sh.dmg * s.k / 4.2, s.owner); W.boomAt({ boom: 'electric', R: 18, color: '#b98cff' }, x, gy, 1); W.shake += .25; } });
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

/* ---------- 돌발 이벤트 ---------- */
const EVENTS = {
  tornado: { n: '회오리', d: '맵을 떠돌며 포탄을 위로 튕기고 탱크를 날려 버린다. 2턴 유지.', turns: 2 },
  pillar: { n: '불기둥', d: '땅이 갈라지며 불기둥이 솟는다. 지나가는 포탄은 그 자리에서 터진다. 1턴 유지.', turns: 1 },
  meteors: { n: '운석 소나기', d: '운석 세 개가 무작위 위치에 떨어져 땅을 판다.', turns: 0 },
  lightning: { n: '벼락', d: '먹구름이 몰려와 탱크 근처에 벼락이 떨어진다.', turns: 0 },
};

/* ---------- 월드 ---------- */
class World {
  constructor(o = {}) {
    this.w = o.w || 960; this.h = o.h || 480; this.mapId = o.map || 'hills'; this.ts = o.tankScale || .5; this.labels = o.labels !== false;
    this.tc = document.createElement('canvas'); this.tc.width = this.w; this.tc.height = this.h;
    this.tctx = this.tc.getContext('2d', { willReadFrequently: true });
    this.mask = new Uint8Array(this.w * this.h);
    this.reset();
  }
  get map() { return MAPS[this.mapId]; }
  reset(mapId) {
    if (mapId) this.mapId = mapId;
    const b = bakeMap(this.mapId, this.w, this.h); this.baked = b;
    this.tctx.globalCompositeOperation = 'source-over'; this.tctx.putImageData(b.fg, 0, 0);
    this.refreshMask(0, 0, this.w, this.h);
    this.g = G0 * this.map.grav; this.liquidY = this.map.liquid ? this.map.liquid.y * this.h : this.h + 30;
    this.tanks = []; this.shells = []; this.booms = []; this.floats = []; this.parts = []; this.zones = []; this.specials = []; this.events = []; this.pending = [];
    this.clock = 0; this.shake = 0; this.dim = 0; this.banner = null; this.splashes = [];
    this.wind = { ang: 180, str: 0 };
  }
  /* 지형 */
  refreshMask(x0, y0, w, h) {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    const x1 = Math.min(this.w, Math.ceil(x0 + w)), y1 = Math.min(this.h, Math.ceil(y0 + h)); if (x1 <= x0 || y1 <= y0) return;
    const d = this.tctx.getImageData(x0, y0, x1 - x0, y1 - y0).data, rw = x1 - x0, W = this.w;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.mask[y * W + x] = d[((y - y0) * rw + (x - x0)) * 4 + 3] > 60 ? 1 : 0;
  }
  solid(x, y) { x |= 0; y |= 0; return x >= 0 && x < this.w && y >= 0 && y < this.h && this.mask[y * this.w + x] === 1; }
  stand(x, y) { x |= 0; y |= 0; return x >= 0 && x < this.w && y >= 0 && y < this.h && this.mask[y * this.w + x] === 1 && !this.baked.pass[y * this.w + x]; }
  ground(x, from = 0) { for (let y = Math.max(0, from | 0); y < this.h; y++) if (this.stand(x, y) || this.stand(x - 7, y) || this.stand(x + 7, y)) return y; return this.h + 200; }
  _carve(path, bx, by, bw, bh, scorch) {
    const c = this.tctx; c.save();
    c.globalCompositeOperation = 'destination-out'; path(c, 0); c.fill();
    if (scorch) { c.globalCompositeOperation = 'source-atop'; scorch(c); }
    c.restore();
    c.drawImage(this.baked.steel, bx - 20, by - 20, bw + 40, bh + 40, bx - 20, by - 20, bw + 40, bh + 40);
    this.refreshMask(bx - 20, by - 20, bw + 40, bh + 40);
  }
  carveRound(x, y, r, ry, scorch = true) {
    ry = ry || r; const seed = Math.floor(x * 7 + y * 3);
    const path = (c, e) => { c.beginPath(); const n = 30; for (let i = 0; i <= n; i++) { const a = i / n * TAU, k = 1 + (hash(seed + i % n) - .5) * .18; c.lineTo(x + Math.cos(a) * (r * k + e), y + Math.sin(a) * (ry * k + e)); } c.closePath(); };
    this._carve(path, x - r, y - ry, r * 2, ry * 2, scorch && (c => { c.save(); c.translate(x, y); c.scale(1, ry / r); const g = c.createRadialGradient(0, 0, r * .85, 0, 0, r + 15); g.addColorStop(0, 'rgba(38,20,10,.62)'); g.addColorStop(.45, 'rgba(38,20,10,.28)'); g.addColorStop(1, 'rgba(38,20,10,0)'); c.fillStyle = g; c.fillRect(-r - 20, -r - 20, r * 2 + 40, r * 2 + 40); c.restore(); }));
  }
  carveRect(x, y, w, h) {
    const path = c => { c.beginPath(); c.rect(x, y, w, h); };
    this._carve(path, x, y, w, h, c => { [[x - 12, x], [x + w + 12, x + w]].forEach(([a, b]) => { const g = c.createLinearGradient(a, 0, b, 0); g.addColorStop(0, 'rgba(38,20,10,0)'); g.addColorStop(1, 'rgba(38,20,10,.55)'); c.fillStyle = g; c.fillRect(Math.min(a, b), y, 12, h); }); });
  }
  colorAt(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '#8a6040'; const d = this.tctx.getImageData(x | 0, y | 0, 1, 1).data; return d[3] > 40 ? `rgb(${d[0]},${d[1]},${d[2]})` : '#8a6040'; }
  debris(x, y, n, power = 1, col) {
    col = col || this.colorAt(x, y + 4);
    for (let i = 0; i < n; i++) { const a = -Math.PI * (.12 + .76 * Math.random()), s = (90 + Math.random() * 220) * power; this.parts.push({ x, y: y - 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .9 + Math.random() * .7, col, size: 2 + Math.random() * 3.5 }); }
  }
  /* 바람: ang 0 = 오른쪽, 90 = 위 */
  windVec() { const a = this.wind.ang * Math.PI / 180, s = this.wind.str * WINDK; return [Math.cos(a) * s, -Math.sin(a) * s]; }
  nextWind() {
    if (!this.map.windMax) { this.wind = { ang: 0, str: 0 }; return; }
    if (Math.random() < .18) this.wind = { ang: Math.random() * 360, str: Math.random() * this.map.windMax };
    else { this.wind.ang = (this.wind.ang + (Math.random() - .5) * 80 + 360) % 360; this.wind.str = Math.max(0, Math.min(this.map.windMax, this.wind.str + (Math.random() - .5) * 5)); }
    this.wind.str = Math.round(this.wind.str);
  }
  /* 탱크 */
  addTank(id, x, facing, team, name) {
    const T = tankById(id), t = { T, name, team, x, y: 0, hp: T.hp, max: T.hp, angle: Math.min(Math.max(45, T.amin), T.amax), facing, fuel: 100, vx: 0, vy: 0, air: false, fallFrom: 0, firedAt: -9, hitAt: -9, moving: false, shield: false, frozen: 0, canMove: true, dead: false, lastPower: null };
    t.y = this.ground(x, 0); t.fallFrom = t.y; this.tanks.push(t); return t;
  }
  damage(t, dmg, from, label) {
    if (t.dead) return 0; dmg = Math.round(t.shield ? dmg / 2 : dmg);
    t.hp = Math.max(0, t.hp - dmg); t.hitAt = this.clock; this.float(t.x, t.y - 64 * this.ts * 2 + 4, (label || '') + '-' + dmg, '#c92a2a');
    if (t.hp <= 0) t.dead = true; return dmg;
  }
  hurtArea(x, y, R, dmg, from, o = {}) {
    this.tanks.forEach(t => {
      if (t.dead) return;
      let d = Math.hypot(t.x - x, t.y - 18 - y);
      if (o.columnW) d = Math.abs(t.x - x) < o.columnW ? Math.abs(t.x - x) : 1e9;
      if (o.tall && Math.abs(t.x - x) < R && t.y > y - 20 && t.y < y + o.tall + 30) d = Math.abs(t.x - x);
      const RR = R + 12; if (d < RR) this.damage(t, dmg * (1 - .6 * Math.min(1, d / RR)), from);
    });
  }
  float(x, y, s, c) { this.floats.push({ x, y, s, c, life: 1.3 }); }
  boomAt(sh, x, y, k = 1) { this.booms.push({ sh: Object.assign({}, sh, { R: (sh.R || 24) * k }), x, y, t0: this.clock }); }
  muzzle(t) {
    const a = t.angle * Math.PI / 180, sc = this.ts, lift = t.T.hover ? -12 * sc : 0;
    const px = t.x + t.T.pivot[0] * sc * t.facing, py = t.y + t.T.pivot[1] * sc + lift, L = t.T.len * sc + 4;
    return [px + Math.cos(a) * L * t.facing, py - Math.sin(a) * L];
  }
  fire(t, slot, p, o = {}) {
    const sh = SHELLS[t.T.id][slot]; t.firedAt = this.clock; t.lastPower = p;
    const spawn = () => (sh.spread || [0]).forEach((da, i) => {
      const a = (t.angle + da) * Math.PI / 180, v = sh.shape === 'line' ? 900 : p * (sh.pspread ? sh.pspread[i] : 1) * SPEED, [ox, oy] = this.muzzle(t);
      this.shells.push({ x: ox, y: oy, sx: ox, sy: oy, vx: Math.cos(a) * t.facing * v, vy: -Math.sin(a) * v, sh, owner: t, age: 0, trail: [], mode: 'fly', dug: 0, dist: 0, lastCarve: null, k: o.boost || 1, teleport: !!o.teleport });
    });
    spawn(); if (o.double) this.pending.push({ at: .45, fn: spawn });
  }
  /* 착탄 */
  impact(s, x, y, hitTank) {
    s.done = true; const sh = s.sh, k = s.k;
    if (sh.sp && SPECIALS[sh.sp] && sh.sp !== 'phoenix' && sh.sp !== 'erupt') {
      const sp = { type: sh.sp, x, y, gy: hitTank ? hitTank.y : this.ground(x, Math.max(0, y - 40)), t: 0, sh, k, owner: s.owner, side: s.vx >= 0 ? 1 : -1, dir: (s.owner && s.owner.facing) || 1, hit: new Set(), done: [], flash: [] };
      if (sp.gy > this.h) sp.gy = y; if (sh.sp === 'tornado') sp.dir = Math.sign(this.windVec()[0]) || sp.dir; sp.wx = x;
      this.specials.push(sp); this.afterHit(s, x, y); return;
    }
    if (sh.sp === 'erupt') { this.specials.push({ type: 'erupt', x, y, t: 0, sh, k, owner: s.owner }); this.afterHit(s, x, y); return; }
    if (sh.shape === 'ellipse') this.carveRound(x, y, sh.cr[0] * k, sh.cr[1] * k); else this.carveRound(x, y, sh.cr * k);
    this.debris(x, y, Math.round(8 + sh.cr * .3), .7 + sh.cr / 80);
    this.boomAt(sh, x, y, k); this.shake += Math.min(.6, sh.r / 90);
    this.tanks.forEach(t => {
      if (t.dead) return; const R = sh.r * k + 12, d = Math.hypot(t.x - x, t.y - 18 - y); if (d >= R) return;
      this.damage(t, sh.dmg * k * (1 - .6 * Math.min(1, d / R)), s.owner);
      if (sh.fx === 'freeze') { t.frozen = 1; this.float(t.x, t.y - 90, '빙결!', '#1f6fae'); }
      if (sh.fx === 'push') { t.vx = (Math.sign(t.x - x) || 1) * 200; t.vy = -220; t.air = true; }
    });
    if (sh.fx === 'burn') this.zones.push({ type: 'burn', x, r: 40, turns: 2, dmg: 60, born: this.clock });
    if (sh.fx === 'poison') this.zones.push({ type: 'poison', x, r: 60, turns: 3, dmg: 80, born: this.clock });
    if (sh.sp === 'phoenix') { this.zones.push({ type: 'burn', x, r: 50, turns: 2, dmg: 60, born: this.clock }); this.specials.push({ type: 'phoenix', x, gy: this.ground(x, Math.max(0, y - 40)), t: 0 }); }
    this.afterHit(s, x, y);
  }
  afterHit(s, x, y) {
    if (s.teleport && s.owner && !s.owner.dead && !this._teleported) { this._teleported = true; const t = s.owner; t.x = Math.max(14, Math.min(this.w - 14, x)); t.y = this.ground(t.x, Math.max(0, y - 80)); t.fallFrom = t.y; t.vy = 0; this.float(t.x, t.y - 80, '순간이동!', '#7b2fbf'); }
  }
  hitTank(s) { return this.tanks.find(t => !t.dead && (t !== s.owner || s.age > .25) && Math.hypot(t.x - s.x, t.y - 18 * this.ts * 2 - s.y) < 40 * this.ts); }
  /* 이벤트 */
  rollEvent(force) {
    const ev = this.map.ev || {}; let r = Math.random(), pick = force || null;
    if (!pick) for (const k in ev) { r -= ev[k] * .45; if (r < 0) { pick = k; break; } }
    if (!pick) return null;
    const live = this.tanks.filter(t => !t.dead);
    const e = { type: pick, t: 0, turns: EVENTS[pick].turns, x: 120 + Math.random() * (this.w - 240), hit: new Set(), done: [] };
    if (pick === 'lightning' && live.length) { const t = live[Math.floor(Math.random() * live.length)]; e.x = t.x + (Math.random() - .5) * 60; }
    if (pick === 'pillar') { for (let i = 0; i < 20; i++) { const x = 60 + Math.random() * (this.w - 120); if (this.ground(x, 0) < this.liquidY && live.every(t => Math.abs(t.x - x) > 50)) { e.x = x; break; } } }
    if (pick === 'meteors') e.xs = [0, 1, 2].map(() => 80 + Math.random() * (this.w - 160));
    this.events.push(e); this.banner = { text: '돌발! ' + EVENTS[pick].n, t0: this.clock };
    return e;
  }
  turnStart(t) {
    this._teleported = false;
    this.events.forEach(e => { e.turns--; e.hit = new Set(); }); this.events = this.events.filter(e => !(e.type === 'tornado' || e.type === 'pillar') || e.turns > 0);
    this.zones.forEach(z => { if (!t.dead && Math.abs(t.x - z.x) < z.r) this.damage(t, z.dmg, null, z.type === 'burn' ? '화상 ' : '독 '); z.turns--; });
    this.zones = this.zones.filter(z => z.turns > 0);
    t.canMove = true; t.shield = false; t.fuel = 100;
    if (t.frozen > 0) { t.frozen--; t.canMove = false; this.float(t.x, t.y - 90, '얼어서 못 움직임', '#1f6fae'); }
  }
  stepEvents(dt) {
    const gy = x => this.ground(x, 0);
    this.events.forEach(e => {
      e.t += dt;
      if (e.type === 'tornado') {
        e.x += (this.windVec()[0] * .25 + Math.sin(this.clock * .7) * 20) * dt; e.x = Math.max(40, Math.min(this.w - 40, e.x)); e.gy = Math.min(gy(e.x), this.liquidY);
        this.tanks.forEach(t => { if (!t.dead && !e.hit.has(t) && Math.abs(t.x - e.x) < 26 && e.t > .5) { e.hit.add(t); this.damage(t, 60, null); t.vy = -380; t.vx = (Math.sign(t.x - e.x) || 1) * 170; t.air = true; } });
      }
      if (e.type === 'pillar') { e.gy = gy(e.x); if (e.t > 1 && !e.done[0]) { e.done[0] = true; this.tanks.forEach(t => { if (!t.dead && Math.abs(t.x - e.x) < 30) { this.damage(t, 150, null); t.vy = -300; t.air = true; } }); this.shake += .4; } }
      if (e.type === 'meteors') e.xs.forEach((x, i) => { const tt = .4 + i * .45; if (e.t > tt + .7 && !e.done[i]) { e.done[i] = true; const y = gy(x); this.carveRound(x, y, 26); this.hurtArea(x, y - 10, 26, 90, null); this.boomAt({ boom: 'fire', R: 28 }, x, y); this.debris(x, y, 12, 1); this.shake += .3; } });
      if (e.type === 'lightning' && e.t > .7 && !e.done[0]) { e.done[0] = true; const y = gy(e.x); this.carveRound(e.x, y, 18); this.hurtArea(e.x, y - 10, 24, 110, null); this.boomAt({ boom: 'electric', R: 22, color: '#bfe0ff' }, e.x, y); this.shake += .35; }
    });
    this.events = this.events.filter(e => e.type === 'meteors' ? e.t < 2.4 : e.type === 'lightning' ? e.t < 1.3 : true);
  }
  shellVsEvents(s, dt) {
    for (const e of this.events) {
      if (e.type === 'tornado' && e.t > .5 && Math.abs(s.x - e.x) < 36 && s.y > (e.gy || this.h) - 160) { s.vy -= 1400 * dt; s.vx += (s.x > e.x ? 1 : -1) * 500 * dt; }
      if (e.type === 'pillar' && e.t > 1 && Math.abs(s.x - e.x) < 16 && s.y > (e.gy || this.h) - 150) { s.done = true; this.boomAt({ boom: 'fire', R: 20 }, s.x, s.y); this.float(s.x, s.y - 20, '불기둥에 막힘', '#c92a2a'); return true; }
    }
    return false;
  }
  /* 한 프레임 */
  step(dt) {
    this.clock += dt; this.shake = Math.max(0, this.shake - dt * 1.6); this.dim = Math.max(0, this.dim - dt);
    this.pending.forEach(p => p.at -= dt); this.pending = this.pending.filter(p => { if (p.at <= 0) { p.fn(); return false; } return true; });
    const [wx, wy] = this.windVec();
    for (const s of this.shells) {
      const sh = s.sh;
      for (let k = 0; k < 4 && !s.done; k++) {
        const h = dt / 4; s.age += h;
        if (s.mode === 'dig') { s.x += s.vx * h; s.y += s.vy * h; s.dug += Math.hypot(s.vx, s.vy) * h; if (this.hitTank(s) || s.dug >= 80 || s.y > this.h - 4) { this.impact(s, s.x, s.y); break; } continue; }
        if (sh.shape !== 'line') { s.vx += wx * sh.wind * h; s.vy += (wy * sh.wind + this.g * sh.wt) * h; }
        if (sh.fx === 'home') { const tg = this.tanks.filter(t => !t.dead && t !== s.owner).map(t => [t, Math.hypot(t.x - s.x, t.y - 18 - s.y)]).filter(([, d]) => d < 150).sort((a, b) => a[1] - b[1])[0]; if (tg) { const [t, d] = tg; s.vx += (t.x - s.x) / d * 600 * h; s.vy += (t.y - 18 - s.y) / d * 600 * h; } }
        s.x += s.vx * h; s.y += s.vy * h;
        if (this.shellVsEvents(s, h)) break;
        if (s.x < -300 || s.x > this.w + 300 || s.y > this.h + 40) { s.done = true; if (s.y > this.liquidY - 4 && this.map.liquid && this.map.liquid.type !== 'void') this.splashes.push({ x: s.x, t0: this.clock }); break; }
        if (s.y > this.liquidY && this.map.liquid && this.map.liquid.type !== 'void') { s.done = true; this.splashes.push({ x: s.x, t0: this.clock }); break; }
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
    this.specials = this.specials.filter(s => { s.t += dt; return SPECIALS[s.type].step(this, s, dt); });
    this.stepEvents(dt);
    this.booms = this.booms.filter(b => this.clock - b.t0 < .8);
    this.splashes = this.splashes.filter(s => this.clock - s.t0 < 1);
    this.parts.forEach(p => { p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (this.solid(p.x, p.y) && p.vy > 0) { p.vy *= -.25; p.vx *= .5; } });
    this.parts = this.parts.filter(p => p.life > 0);
    this.floats.forEach(f => { f.y -= 30 * dt; f.life -= dt; }); this.floats = this.floats.filter(f => f.life > 0);
    this.tanks.forEach(t => { t.moving = false; this.settle(t, dt); });
  }
  settle(t, dt) {
    if (t.sunk) return true;
    const g = this.ground(t.x, t.y - 3);
    if (t.air || g > t.y + 1) {
      t.vy += 900 * dt; t.x += t.vx * dt;
      if (t.x < 10 || t.x > this.w - 10) { t.x = Math.max(10, Math.min(this.w - 10, t.x)); t.vx = 0; }
      const ny = t.y + t.vy * dt;
      if (t.vy > 0) { const land = this.ground(t.x, t.y - 3); if (ny >= land && land < this.h) { t.y = land; t.air = false; t.vx = 0; const fall = t.y - t.fallFrom; if (fall > 40) this.damage(t, fall * 1.2, null, '낙하 '); t.vy = 0; t.fallFrom = t.y; return true; } }
      t.y = ny;
      if (t.y > this.liquidY + 6 || t.y > this.h + 20) {
        t.sunk = true; t.dead = true; t.hp = 0; this.float(t.x, Math.min(this.liquidY, this.h) - 30, '낙사!', '#c92a2a');
        if (this.map.liquid && this.map.liquid.type !== 'void') this.splashes.push({ x: t.x, t0: this.clock });
        return true;
      }
      return false;
    }
    t.y = g; t.vy = 0; t.fallFrom = t.y; return true;
  }
  busy() { return this.shells.length || this.pending.length || this.specials.length || this.booms.length || this.tanks.some(t => !t.sunk && (t.air || this.ground(t.x, t.y - 3) > t.y + 1)) || this.events.some(e => (e.type === 'meteors' && e.t < 2.4) || (e.type === 'lightning' && e.t < 1.3) || (e.type === 'pillar' && e.t < 1.6)); }
  move(t, dir, dt) {
    t.facing = dir; if (t.fuel <= 0 || !t.canMove || t.air) return;
    const nx = t.x + dir * 50 * dt; if (nx < 12 || nx > this.w - 12) return;
    const ny = this.ground(nx, t.y - 14); if (ny < t.y - 12) return;
    const ahead = this.ground(t.x + dir * 6, t.y - 14); if (t.y - ahead > 8.5) return;
    t.moving = true; t.x = nx; if (ny <= t.y + 2) { t.y = ny; t.fallFrom = ny; }
    t.fuel = Math.max(0, t.fuel - 22 * dt * (ny < t.y ? 1.5 : 1));
  }
  /* 도감·AI용: 바람 포함 궤적을 계산해 목표 x에 닿는 파워를 찾는다 */
  solvePower(t, slot, targetX, withWind = true) {
    const sh = SHELLS[t.T.id][slot], [wx, wy] = withWind ? this.windVec() : [0, 0];
    const land = p => { const a = t.angle * Math.PI / 180, [ox, oy] = this.muzzle(t); let x = ox, y = oy, vx = Math.cos(a) * t.facing * p * SPEED, vy = -Math.sin(a) * p * SPEED; for (let i = 0; i < 900; i++) { const h = 1 / 120; vx += wx * sh.wind * h; vy += (wy * sh.wind + this.g * sh.wt) * h; x += vx * h; y += vy * h; if (vy > 0 && (this.solid(x, y) || y > this.h)) return x; } return x; };
    let lo = 5, hi = 100; const want = (targetX - t.x) * t.facing;
    for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2, got = (land(mid) - t.x) * t.facing; if (got < want) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  /* 그리기 */
  draw(c, o = {}) {
    const sx = this.shake ? (hash(Math.floor(this.clock * 60)) - .5) * this.shake * 12 : 0, sy = this.shake ? (hash(Math.floor(this.clock * 60) + 7) - .5) * this.shake * 12 : 0;
    c.save(); c.drawImage(this.baked.sky, 0, 0, this.w, this.h); c.translate(sx, sy);
    c.drawImage(this.baked.back, 0, 0, this.w, this.h); c.drawImage(this.tc, 0, 0, this.w, this.h);
    this.drawLiquid(c);
    this.zones.forEach(z => { const gy = this.ground(z.x, 0), a = Math.min(1, (this.clock - (z.born || 0)) * 2); if (z.type === 'poison') poisonFog(c, z.x, gy, z.r, this.clock, a); else fireField(c, z.x, gy, z.r, this.clock, a); if (this.labels) zoneLabel(c, z.x, gy - z.r - 20, (z.type === 'poison' ? '독 ' : '불 ') + z.turns + '턴', z.type === 'poison' ? '#d4a6ff' : '#ffb36b'); });
    this.events.forEach(e => this.drawEvent(c, e));
    this.tanks.forEach(t => this.drawTank(c, t, o));
    this.shells.forEach(s => {
      if (s.sh.shape === 'line') { c.save(); c.lineCap = 'round'; c.strokeStyle = 'rgba(47,224,255,.55)'; c.lineWidth = 10; c.beginPath(); c.moveTo(s.sx, s.sy); c.lineTo(s.x, s.y); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke(); c.restore(); return; }
      trail(c, s.sh, s.trail.slice(1), this.clock);
      c.save(); c.translate(s.x, s.y); c.scale(.95, .95); drawShell(c, s.sh, this.clock, Math.atan2(s.vy, s.vx)); c.restore();
      if (s.y < 0) { c.fillStyle = '#c92a2a'; c.beginPath(); c.moveTo(s.x, 4); c.lineTo(s.x - 6, 14); c.lineTo(s.x + 6, 14); c.fill(); }
    });
    this.specials.forEach(s => SPECIALS[s.type].draw(c, this, s));
    this.booms.forEach(b => boom(c, b.sh, b.x, b.y, (this.clock - b.t0) / .8));
    this.parts.forEach(p => { c.globalAlpha = Math.min(1, p.life * 2); c.fillStyle = p.col; c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); c.strokeStyle = 'rgba(36,29,46,.4)'; c.lineWidth = .8; c.strokeRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }); c.globalAlpha = 1;
    this.floats.forEach(f => { c.save(); c.globalAlpha = Math.min(1, f.life); c.font = '20px Jua, sans-serif'; c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = '#fff8e8'; c.strokeText(f.s, f.x, f.y); c.fillStyle = f.c; c.fillText(f.s, f.x, f.y); c.restore(); });
    c.restore();
    if (this.dim > 0) { c.fillStyle = `rgba(20,8,20,${this.dim})`; c.fillRect(0, 0, this.w, this.h); }
    if (this.banner && this.clock - this.banner.t0 < 1.8) { const p = (this.clock - this.banner.t0) / 1.8, a = Math.min(1, p * 6, (1 - p) * 4); c.save(); c.globalAlpha = a; c.font = '30px Jua, sans-serif'; c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 7; c.strokeStyle = OUT; const y = this.h * .3 - (1 - Math.min(1, p * 5)) * 20; c.strokeText(this.banner.text, this.w / 2, y); c.fillStyle = '#ffd34d'; c.fillText(this.banner.text, this.w / 2, y); c.restore(); }
  }
  drawLiquid(c) {
    const L = this.map.liquid; if (!L || L.type === 'void') return;
    const y0 = this.liquidY, cols = { water: ['rgba(120,200,240,.75)', 'rgba(30,90,160,.92)'], lava: ['rgba(255,190,70,.95)', 'rgba(170,40,20,.98)'], acid: ['rgba(170,240,90,.8)', 'rgba(60,120,40,.92)'] }[L.type];
    const g = c.createLinearGradient(0, y0, 0, this.h); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
    c.fillStyle = g; c.beginPath(); c.moveTo(0, this.h); for (let x = 0; x <= this.w; x += 8) c.lineTo(x, y0 + Math.sin(x * .04 + this.clock * 2) * 3 + Math.sin(x * .11 - this.clock * 3) * 1.5); c.lineTo(this.w, this.h); c.fill();
    c.strokeStyle = L.type === 'lava' ? 'rgba(255,240,170,.9)' : 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.beginPath(); for (let x = 0; x <= this.w; x += 8) { const y = y0 + Math.sin(x * .04 + this.clock * 2) * 3 + Math.sin(x * .11 - this.clock * 3) * 1.5; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    if (L.type === 'lava') for (let i = 0; i < 8; i++) { const p = (this.clock * .5 + i / 8) % 1; circ(c, hash(i) * this.w, y0 + 8 - p * 8, 3 + p * 4); c.fillStyle = `rgba(255,220,120,${1 - p})`; c.fill(); }
    this.splashes.forEach(s => { const p = (this.clock - s.t0); for (let i = 0; i < 8; i++) { const a = -Math.PI * (.2 + .6 * hash(i)), v = 120 + hash(i + 3) * 80; c.fillStyle = L.type === 'lava' ? 'rgba(255,170,60,.9)' : 'rgba(200,240,255,.9)'; circ(c, s.x + Math.cos(a) * v * p, y0 + Math.sin(a) * v * p + 300 * p * p, 3); c.fill(); } });
  }
  drawEvent(c, e) {
    if (e.type === 'tornado') { const a = Math.min(1, e.t * 2) * (e.turns <= 0 ? .4 : 1); drawTornado(c, e.x, e.gy || this.ground(e.x, 0), 170, this.clock, a, '200,210,220'); }
    if (e.type === 'pillar') { const gy = e.gy || this.ground(e.x, 0); if (e.t < 1) { const k = (e.t * 6) % 1 < .5; c.fillStyle = `rgba(255,120,40,${k ? .8 : .4})`; ell(c, e.x, gy, 22, 6); c.fill(); c.strokeStyle = '#3a1a10'; c.lineWidth = 2; c.beginPath(); c.moveTo(e.x - 18, gy); c.lineTo(e.x - 6, gy + 3); c.lineTo(e.x + 4, gy - 1); c.lineTo(e.x + 18, gy + 2); c.stroke(); } else drawPillar(c, e.x, gy, 150 * ease((e.t - 1) / .3), this.clock, e.turns <= 0 ? .5 : 1); }
    if (e.type === 'meteors') e.xs.forEach((x, i) => { const tt = .4 + i * .45, u = (e.t - tt) / .7; if (u < 0 || u > 1) return; const gy = this.ground(x, 0), px = lerp(x - 160, x, u), py = lerp(-40, gy, u); for (let j = 1; j < 8; j++) { const uu = Math.max(0, u - j * .04); c.save(); c.globalCompositeOperation = 'lighter'; puff(c, lerp(x - 160, x, uu), lerp(-40, gy, uu), 9 - j, '255,140,50', .5 * (1 - j / 8)); c.restore(); } c.save(); c.translate(px, py); c.scale(1.2, 1.2); drawShell(c, { key: 'meteor' }, this.clock, .8); c.restore(); });
    if (e.type === 'lightning') { const a = Math.min(1, e.t * 3, (1.3 - e.t) * 3); drawStormCloud(c, e.x, 46, 1, this.clock, a); if (e.t > .7 && e.t < .9) drawBolt(c, e.x, 60, e.x, this.ground(e.x, 0), Math.floor(this.clock * 30), 1 - (e.t - .7) / .2); }
  }
  drawTank(c, t, o) {
    if (t.sunk && t.y > this.h + 10) return;
    let st = 'idle', ph = null;
    if (t.dead) st = 'dead'; else if (this.clock - t.hitAt < .6) { st = 'hit'; ph = this.clock - t.hitAt; } else if (this.clock - t.firedAt < .5) { st = 'fire'; ph = this.clock - t.firedAt; } else if (t.moving) st = 'move'; else if (t.hp <= t.max * .25) st = 'danger';
    renderTank(c, this.w, this.h, t.T, st, this.clock, t.x, t.y, this.ts, { flip: t.facing, angle: t.angle, phaseT: ph, noText: true });
    const sc = this.ts * 2;
    if (t.shield) { c.strokeStyle = 'rgba(160,220,255,.85)'; c.fillStyle = 'rgba(85,174,240,.15)'; c.lineWidth = 2.5; circ(c, t.x, t.y - 20 * sc, 32 * sc); c.fill(); c.stroke(); }
    if (t.frozen > 0) { c.save(); c.translate(t.x + 22 * sc, t.y - 40 * sc); c.scale(.7, .7); drawShell(c, { key: 'snowflake' }, this.clock, 0); c.restore(); }
    if (t.dead || !this.labels) return;
    const active = o.active === t, top = t.y - (t.T.hover ? 74 : 62) * sc;
    c.textAlign = 'center'; c.font = '600 12px "Noto Sans KR", sans-serif'; c.lineJoin = 'round';
    c.lineWidth = 3; c.strokeStyle = 'rgba(255,248,232,.85)'; c.strokeText(t.name, t.x, top - 8);
    c.fillStyle = t.team === 'red' ? '#b8321f' : '#1f6fae'; c.fillText(t.name, t.x, top - 8);
    c.fillStyle = 'rgba(31,45,82,.6)'; c.fillRect(t.x - 22, top - 2, 44, 6);
    c.fillStyle = t.hp / t.max > .5 ? '#3fae4a' : t.hp / t.max > .25 ? '#f0a020' : '#d63c3c'; c.fillRect(t.x - 22, top - 2, 44 * t.hp / t.max, 6);
    if (active) { c.fillStyle = '#ffb703'; c.beginPath(); c.moveTo(t.x, top - 22); c.lineTo(t.x - 7, top - 32); c.lineTo(t.x + 7, top - 32); c.fill(); }
  }
  drawWind(c, x, y, r = 24) {
    c.save(); c.translate(x, y);
    circ(c, 0, 0, r + 8); c.fillStyle = 'rgba(31,45,82,.85)'; c.fill();
    circ(c, 0, 0, r); c.strokeStyle = 'rgba(244,239,225,.35)'; c.lineWidth = 1.5; c.stroke();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4)); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.stroke(); }
    const s = this.wind.str, a = -this.wind.ang * Math.PI / 180;
    if (s > 0) { c.rotate(a); const L = 6 + s / 10 * (r - 4); c.strokeStyle = '#ffd34d'; c.fillStyle = '#ffd34d'; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-L, 0); c.lineTo(L - 6, 0); c.stroke(); c.beginPath(); c.moveTo(L + 2, 0); c.lineTo(L - 8, -6); c.lineTo(L - 8, 6); c.closePath(); c.fill(); c.rotate(-a); }
    c.font = '15px Jua, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#f4efe1'; c.fillText(s, 0, r + 26);
    c.restore();
  }
}
