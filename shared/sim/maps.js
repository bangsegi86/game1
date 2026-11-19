// 맵 5종: 지형(재질 격자)과 규칙. 서버와 화면이 같이 쓴다. 하늘 그림은 client/js/render.js
export const MAT = ['', 'soil', 'rock', 'steel', 'leaf', 'wood', 'cap', 'ice', 'plank'];
export const MK = Object.fromEntries(MAT.map((m, i) => [m, i]).filter(([m]) => m));
const TAU = Math.PI * 2;
/* 지형 그리기 도구 (u, v = 0~1 비율 좌표) */
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

// 맵 5종. 모두 끝에서 끝까지 걸어서 갈 수 있는 땅이고(경사는 탱크가 오를 수 있는 만큼만), 바닥에 부서지지 않는 암반이 있어 떨어져 죽는 곳이 없다.
// 나무·피라미드·폭포·종유석 같은 장식은 모두 배경 그림이라 탱크도 포탄도 막지 않는다.
const ns = u => .006 * Math.sin(u * 41) + .004 * Math.sin(u * 97 + 1);
// 점들을 부드럽게 이은 지형선 (평평한 단 + 오를 수 있는 비탈)
const path = (pts, n = 1) => u => { let i = 0; while (i < pts.length - 2 && u > pts[i + 1][0]) i++; const [u0, v0] = pts[i], [u1, v1] = pts[i + 1], k = Math.min(1, Math.max(0, (u - u0) / (u1 - u0))); return v0 + (v1 - v0) * k * k * (3 - 2 * k) + n * ns(u); };
const valleyY = path([[0, .3], [.11, .31], [.18, .42], [.27, .43], [.35, .55], [.44, .57], [.5, .6], [.56, .57], [.65, .55], [.73, .43], [.82, .42], [.89, .31], [1, .3]]);
const templeY = path([[0, .5], [.1, .5], [.15, .42], [.23, .42], [.31, .55], [.42, .56], [.48, .5], [.56, .5], [.62, .56], [.69, .56], [.77, .44], [.84, .43], [.91, .33], [1, .33]]);
const bridgeY = path([[0, .4], [.12, .38], [.27, .42], [.38, .6], [.5, .64], [.62, .6], [.73, .42], [.88, .38], [1, .4]]);
const caveY = path([[0, .36], [.11, .37], [.19, .5], [.3, .51], [.36, .6], [.46, .6], [.5, .55], [.54, .6], [.63, .6], [.7, .5], [.79, .49], [.88, .35], [1, .35]]);
const cloudY = u => .78 + .012 * Math.sin(u * 31) + .008 * Math.sin(u * 73 + 2);
const ISLES = [[.1, .045, .58], [.37, .045, .61], [.63, .045, .58], [.9, .045, .56]];
const isleY = u => ISLES.reduce((m, [cu, hw, top]) => Math.min(m, top + Math.max(0, Math.abs(u - cu) - hw) * 2.8 + .3 * ns(u)), 1);
const skyY = u => Math.min(cloudY(u), isleY(u));
// 땅 → 바위층 → 맨 아래 암반(부서지지 않음)
const ground = (c, w, h, fn, rockAt = .9) => { under(c, w, h, fn, 0, 1, 'soil'); under(c, w, h, typeof rockAt === 'function' ? rockAt : u => rockAt + .012 * Math.sin(u * 9), 0, 1, 'rock'); under(c, w, h, () => .965, 0, 1, 'steel'); };

/* ---------- 배경 그림 (막지 않는 장식) ---------- */
const hr = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const poly = (c, w, h, pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach(([u, v], i) => i ? c.lineTo(u * w, v * h) : c.moveTo(u * w, v * h)); c.closePath(); c.fill(); };
const ball = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
function bushTree(c, x, y, s, col) { c.fillStyle = '#5a3a22'; c.fillRect(x - s * .08, y - s * .5, s * .16, s * .5); [[0, -.8, .42], [-.28, -.6, .3], [.28, -.6, .3]].forEach(([dx, dy, r]) => ball(c, x + dx * s, y + dy * s, r * s, col)); }
function pine(c, x, y, s, col) { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * .32, y); c.lineTo(x - s * .32, y); c.closePath(); c.fill(); }
function palm(c, x, y, s) {
  c.strokeStyle = '#8a6236'; c.lineWidth = s * .07; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + s * .15, y - s * .5, x + s * .05, y - s); c.stroke();
  c.fillStyle = '#4f8f3a'; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * .55; c.beginPath(); c.ellipse(x + s * .05 + Math.cos(a) * s * .28, y - s + Math.sin(a) * s * .14 + s * .08, s * .3, s * .07, a, 0, TAU); c.fill(); }
}
function rockIsle(c, x, y, s, top, rock) { c.fillStyle = rock; c.beginPath(); c.moveTo(x - s, y); c.lineTo(x + s, y); c.lineTo(x + s * .2, y + s * 1.1); c.lineTo(x - s * .3, y + s * .7); c.closePath(); c.fill(); c.fillStyle = top; c.fillRect(x - s, y - s * .12, s * 2, s * .2); }

function valleyDeco(c, w, h) {
  // 먼 산맥
  const peaks = []; for (let i = 0; i <= 14; i++) peaks.push([i / 14, .36 - (i % 2 ? .08 + hr(i) * .07 : 0) - .04 * Math.sin(i)]);
  poly(c, w, h, [[0, .6], ...peaks, [1, .6]], '#8fa6cc'); poly(c, w, h, [[0, .6], ...peaks.map(([u, v], i) => [u, v + .07 + .02 * hr(i + 3)]), [1, .6]], '#7a98b4');
  // 골짜기 아래로 굽이치는 강
  c.fillStyle = '#9fd4ef'; c.beginPath(); for (let i = 0; i <= 20; i++) { const k = i / 20, v = .42 + k * .3, u = .5 + .06 * Math.sin(k * 7), half = .004 + k * .03; c.lineTo((u - half) * w, v * h); } for (let i = 20; i >= 0; i--) { const k = i / 20, v = .42 + k * .3, u = .5 + .06 * Math.sin(k * 7), half = .004 + k * .03; c.lineTo((u + half) * w, v * h); } c.fill();
  // 양쪽 뒤편의 높은 절벽과 나무
  poly(c, w, h, [[0, .14], [.06, .12], [.12, .2], [.16, .45], [0, .45]], '#c2a06a'); poly(c, w, h, [[1, .12], [.95, .1], [.88, .19], [.84, .45], [1, .45]], '#c2a06a');
  poly(c, w, h, [[0, .14], [.06, .12], [.12, .2], [.11, .23], [0, .18]], '#6fae4a'); poly(c, w, h, [[1, .12], [.95, .1], [.88, .19], [.89, .22], [1, .17]], '#6fae4a');
  for (let i = 0; i < 7; i++) { bushTree(c, (.01 + i * .018) * w, (.15 + hr(i) * .03) * h, h * .07, '#4c8f3a'); bushTree(c, (.99 - i * .018) * w, (.13 + hr(i + 9) * .03) * h, h * .07, '#4c8f3a'); }
}
function templeDeco(c, w, h) {
  // 피라미드
  const px = .44, base = .62, half = .17, top = .17;
  poly(c, w, h, [[px - half, base], [px, top], [px + half, base]], '#e2bf7c'); poly(c, w, h, [[px, top], [px + half, base], [px + .02, base]], '#c99c5c');
  c.strokeStyle = 'rgba(120,80,40,.25)'; c.lineWidth = 1; for (let v = top + .03; v < base; v += .028) { const k = (v - top) / (base - top); c.beginPath(); c.moveTo((px - half * k) * w, v * h); c.lineTo((px + half * k) * w, v * h); c.stroke(); }
  // 스핑크스 같은 돌 짐승 석상
  const sx = .63, sy = .5; c.fillStyle = '#d9b06c';
  c.fillRect((sx - .09) * w, (sy - .08) * h, .16 * w, .08 * h); c.fillRect((sx - .13) * w, (sy - .025) * h, .07 * w, .025 * h);
  poly(c, w, h, [[sx + .035, sy - .08], [sx + .035, sy - .2], [sx + .055, sy - .25], [sx + .095, sy - .25], [sx + .115, sy - .2], [sx + .115, sy - .08]], '#d9b06c');
  poly(c, w, h, [[sx + .028, sy - .21], [sx + .075, sy - .27], [sx + .122, sy - .21], [sx + .118, sy - .1], [sx + .1, sy - .1], [sx + .098, sy - .2], [sx + .052, sy - .2], [sx + .05, sy - .1], [sx + .032, sy - .1]], '#c29452');
  c.fillStyle = '#b8874a'; c.fillRect((sx + .062) * w, (sy - .2) * h, .026 * w, .06 * h);
  // 야자수
  [[.2, .52, .13], [.27, .5, .1], [.6, .56, .09], [.95, .4, .12]].forEach(([u, v, s]) => palm(c, u * w, v * h, s * h));
}
function skyDeco(c, w, h) {
  // 멀리 떠 있는 성
  c.globalAlpha = .75; rockIsle(c, .72 * w, .3 * h, .07 * w, '#b9c6e8', '#9aa6cf');
  const cx = .72 * w, cy = .3 * h, s = w / 960; c.fillStyle = '#c9d2f0';
  [[-40, 30, 40], [-14, 18, 66], [10, 22, 52], [34, 16, 36]].forEach(([dx, bw, th]) => { c.fillRect(cx + dx * s, cy - th * s, bw * s, th * s); poly(c, 1, 1, [[cx + dx * s - 3 * s, cy - th * s], [cx + (dx + bw / 2) * s, cy - (th + 20) * s], [cx + (dx + bw + 3) * s, cy - th * s]], '#aab4dc'); c.fillStyle = '#c9d2f0'; });
  c.globalAlpha = 1;
  // 작은 바위섬들
  [[.2, .18, .02], [.3, .3, .014], [.5, .16, .016], [.56, .36, .012], [.86, .22, .018], [.44, .42, .01]].forEach(([u, v, s]) => rockIsle(c, u * w, v * h, s * w, '#7cbf5a', '#9b8a74'));
}
function bridgeDeco(c, w, h) {
  poly(c, w, h, [[0, .5], [.1, .3], [.2, .36], [.32, .24], [.45, .34], [.58, .22], [.7, .32], [.82, .26], [1, .36], [1, .5]], '#9db8c8');
  // 폭포
  const g = c.createLinearGradient(0, .28 * h, 0, .9 * h); g.addColorStop(0, '#e8f6ff'); g.addColorStop(1, '#bfe2f5'); c.fillStyle = g;
  c.fillRect(.58 * w, .28 * h, .05 * w, .62 * h); c.fillRect(.64 * w, .36 * h, .03 * w, .54 * h);
  c.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 8; i++) c.fillRect((.585 + hr(i) * .04) * w, .28 * h, 2, .6 * h);
  for (let i = 0; i < 9; i++) ball(c, (.56 + hr(i + 3) * .14) * w, (.84 + hr(i + 7) * .05) * h, (.02 + hr(i) * .02) * w, 'rgba(255,255,255,.6)');
  poly(c, w, h, [[.54, .28], [.58, .28], [.58, .9], [.52, .9]], '#8c7a5a'); poly(c, w, h, [[.67, .36], [.72, .3], [.74, .9], [.67, .9]], '#8c7a5a');
  // 전나무 숲 (두 겹)
  for (let i = 0; i < 40; i++) pine(c, (i / 40 + hr(i) * .02) * w, (.5 + hr(i + 1) * .05) * h, (.12 + hr(i + 2) * .06) * h, '#3f7a52');
  for (let i = 0; i < 30; i++) pine(c, (i / 30 + hr(i + 50) * .03) * w, (.62 + hr(i + 51) * .06) * h, (.16 + hr(i + 52) * .06) * h, '#2f6644');
}
function caveDeco(c, w, h) {
  // 위쪽 틈으로 들어오는 빛줄기
  const g = c.createLinearGradient(.6 * w, 0, .45 * w, h); g.addColorStop(0, 'rgba(255,220,140,.45)'); g.addColorStop(1, 'rgba(255,220,140,0)'); c.fillStyle = g;
  c.beginPath(); c.moveTo(.58 * w, 0); c.lineTo(.7 * w, 0); c.lineTo(.6 * w, h); c.lineTo(.4 * w, h); c.closePath(); c.fill();
  // 뒤편 바위 기둥과 물
  for (let i = 0; i < 6; i++) { const u = .08 + i * .17 + hr(i) * .05, top = .3 + hr(i + 4) * .2, bw = .05 + hr(i + 8) * .04; poly(c, w, h, [[u - bw, .9], [u - bw * .6, top], [u + bw * .5, top - .02], [u + bw, .9]], '#4a3f78'); }
  c.fillStyle = '#3d6fae'; c.fillRect(0, .7 * h, w, .3 * h); c.fillStyle = 'rgba(180,220,255,.5)'; for (let i = 0; i < 30; i++) c.fillRect(hr(i) * w, (.71 + hr(i + 2) * .2) * h, 10 + hr(i + 3) * 30, 2);
  // 천장 종유석
  c.fillStyle = '#2a2350'; c.fillRect(0, 0, w, .05 * h);
  for (let i = 0; i < 46; i++) { const u = i / 46 + hr(i) * .01, L = .06 + hr(i + 5) * (i % 3 ? .12 : .26), bw = .008 + hr(i + 9) * .014; poly(c, w, h, [[u - bw, .04], [u + bw, .04], [u + bw * .1, .04 + L]], i % 2 ? '#3a3168' : '#463b7c'); }
  // 빛나는 수정
  [[.15, .62], [.42, .55], [.8, .6]].forEach(([u, v], i) => { const x = u * w, y = v * h, s = h * .03; c.fillStyle = 'rgba(150,230,255,.35)'; c.beginPath(); c.arc(x, y, s * 2.2, 0, TAU); c.fill(); poly(c, 1, 1, [[x - s * .4, y + s], [x, y - s], [x + s * .4, y + s]], '#9ef0ff'); });
}

export const MAPS = {
  valley: {
    n: '골짜기', d: '양쪽 높은 절벽에서 단을 따라 골짜기 아래까지 내려가는 맵. 높은 단이 유리하지만 비탈로 어디든 갈 수 있다.', tags: ['기본 맵', '높은 단', '강한 바람'],
    grav: 1, windMax: 20, liquid: null, spawn: [.12, .88], ev: { tornado: .35, lightning: .2, meteors: .05 },
    pal: { soil: ['#b98a52', '#6a4628'], crust: '#6fbf4a', rock: ['#c7a46c', '#7c6040'], steel: '#4a4038' },
    sky: { stops: ['#4f9de8', '#9fd0f5', '#e4f4fb'], clouds: 6, extra: valleyDeco, far: [['#6fae6a', .5, .03, 7, 1], ['#5c9e58', .56, .025, 11, 2]] },
    terrain(c, w, h) { ground(c, w, h, valleyY, u => valleyY(u) + .05); },
  },
  temple: {
    n: '모래 신전', d: '피라미드와 돌 석상이 보이는 사막 유적. 사암 단을 오르내리며 싸운다.', tags: ['계단 지형', '모래 회오리'],
    grav: 1, windMax: 20, liquid: null, spawn: [.1, .9], ev: { tornado: .4, meteors: .1 },
    pal: { soil: ['#f0cf86', '#c09a5a'], crust: '#f8e2a8', rock: ['#e2b46a', '#9a6e3a'], steel: '#6a4a2a' },
    sky: { stops: ['#4a90e0', '#9cc8f2', '#f6e8c8'], clouds: 4, extra: templeDeco, far: [['#efd29a', .6, .02, 5, 0]] },
    terrain(c, w, h) { ground(c, w, h, templeY, u => templeY(u) + .03); },
  },
  sky: {
    n: '구름섬', d: '구름 위에 떠 있는 섬들. 섬 사이는 두꺼운 구름 바닥이라 걸어서 건너갈 수 있다.', tags: ['구름 바닥', '높은 섬'],
    grav: 1, windMax: 20, liquid: null, spawn: [.1, .9], ev: { tornado: .35, lightning: .3 },
    pal: { soil: ['#a07a52', '#6a4a30'], crust: '#7cc95a', rock: ['#9a8a74', '#5e5446'], ice: ['#ffffff', '#c8d6ee'], steel: '#9aa8c8' },
    sky: { stops: ['#3f8ff0', '#8ec4f6', '#dcefff'], clouds: 9, extra: skyDeco },
    terrain(c, w, h) {
      under(c, w, h, cloudY, 0, 1, 'ice');
      // 섬: 위는 걸을 수 있는 풀밭, 옆 비탈은 구름 바닥까지 이어지고, 아래는 구름 속으로 늘어진 바위
      ISLES.forEach(([cu, hw, top]) => {
        const pts = []; for (let u = Math.max(0, cu - hw - .2); u <= Math.min(1, cu + hw + .2); u += .002) if (isleY(u) < cloudY(u)) pts.push([u, isleY(u)]);
        if (!pts.length) return;
        blob(c, w, h, [...pts, [pts[pts.length - 1][0], cloudY(pts[pts.length - 1][0]) + .02], [cu + hw * .3, top + .34], [cu - hw * .35, top + .3], [pts[0][0], cloudY(pts[0][0]) + .02]], 'soil');
        blob(c, w, h, [[cu - hw, top + .07], [cu + hw, top + .07], [cu + hw * .25, top + .32], [cu - hw * .3, top + .27]], 'rock');
      });
      under(c, w, h, () => .965, 0, 1, 'steel');
    },
  },
  bridge: {
    n: '통나무 다리', d: '숲속 협곡 위에 놓인 긴 통나무 다리. 다리가 끊어지면 협곡 바닥으로 떨어져 다치지만, 비탈을 올라 다시 돌아올 수 있다.', tags: ['다리 끊기', '낙하 피해'],
    grav: 1, windMax: 20, liquid: null, spawn: [.12, .88], ev: { tornado: .3, lightning: .2 },
    pal: { soil: ['#9a7448', '#5a3e26'], crust: '#6cb84a', rock: ['#b89a6a', '#6e5636'], plank: '#9a6638', steel: '#4a4038' },
    sky: { stops: ['#5aa0e6', '#a6d2f2', '#e6f4f2'], clouds: 5, extra: bridgeDeco },
    terrain(c, w, h) {
      c.fillStyle = MK.plank; c.beginPath(); for (let u = .255; u <= .745; u += .005) { const k = (u - .255) / .49; c.lineTo(u * w, (.418 + .022 * Math.sin(Math.PI * k)) * h); } for (let u = .745; u >= .255; u -= .005) { const k = (u - .255) / .49; c.lineTo(u * w, (.458 + .022 * Math.sin(Math.PI * k)) * h); } c.closePath(); c.fill();
      // 다리를 먼저 그리고 땅을 덮어서, 널판은 협곡 위 빈 곳에만 남는다 (다리 밑 비탈을 오르는 탱크가 끼이지 않게)
      ground(c, w, h, bridgeY, u => bridgeY(u) + .05);
    },
  },
  cave: {
    n: '수정 동굴', d: '종유석이 늘어진 커다란 동굴 속 바위 단. 바람이 약해 조준이 쉽다.', tags: ['약한 바람', '높은 단'],
    grav: 1, windMax: 8, liquid: null, spawn: [.1, .9], ev: { meteors: .3, pillar: .2 },
    pal: { soil: ['#7a6aa8', '#43386e'], crust: '#9c8fd0', rock: ['#6a5c9c', '#3a3062'], steel: '#2e2850' },
    sky: { stops: ['#231d48', '#3a2f6e', '#5a4c8e'], extra: caveDeco },
    terrain(c, w, h) { ground(c, w, h, caveY, u => caveY(u) + .025); },
  },
  demo: {
    n: '연습장', d: '도감용 평지', tags: [], grav: 1, windMax: 0, liquid: null, spawn: [.16, .82], ev: {},
    pal: { soil: ['#c98b4f', '#6a4228'], crust: '#e8c27a', rock: ['#8a8478', '#55504a'] },
    sky: { stops: ['#f2b880', '#f7d9a8', '#f9e7c4'], sun: [.82, .2, .05, '#fff3d6'], far: [['#e2b590', .62, .05, 8, 0]] },
    terrain(c, w, h) { under(c, w, h, u => .8 + .02 * Math.sin(u * 9 + 1), 0, 1, 'soil'); },
  },
};

export const MAP_ORDER = ['valley', 'temple', 'sky', 'bridge', 'cave'];
