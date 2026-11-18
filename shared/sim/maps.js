// 맵 4종: 지형(재질 격자)과 규칙. 서버와 화면이 같이 쓴다. 하늘 그림은 client/js/render.js
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

// 4개 맵 모두 끝에서 끝까지 이어진 땅이다. 막는 벽·기둥·나무·낭떠러지가 없고, 바닥 근처에는 부서지지 않는 암반이 있어 포탄 한 방에 뚫려 떨어지지 않는다.
const hillsY = u => .55 + .05 * Math.sin(u * 7 + .4) + .02 * Math.sin(u * 19 + 2);
const valleyY = u => .42 + .17 * Math.sin(Math.PI * u) + .012 * Math.sin(u * 23);
const dunesY = u => .5 + .045 * Math.sin(u * 10) + .015 * Math.sin(u * 27 + 1);
const snowY = u => .5 + .05 * Math.sin(u * 5) + .02 * Math.sin(u * 13 + .7);
// 땅 → 바위층 → 맨 아래 암반(부서지지 않음)
const ground = (c, w, h, fn) => { under(c, w, h, fn, 0, 1, 'soil'); under(c, w, h, u => .9 + .012 * Math.sin(u * 9), 0, 1, 'rock'); under(c, w, h, u => .965, 0, 1, 'steel'); };
export const MAPS = {
  hills: {
    n: '초록언덕', d: '완만한 언덕이 이어진 기본 맵. 어디든 걸어서 갈 수 있다.', tags: ['입문', '이어진 땅'],
    grav: 1, windMax: 8, liquid: null, spawn: [.15, .85], ev: { tornado: .25, lightning: .15, meteors: .1 },
    pal: { soil: ['#b07a48', '#5e3a22'], crust: '#7cc25a', rock: ['#8a8478', '#55504a'], steel: '#4a4440' },
    sky: { stops: ['#7ec8f0', '#bfe6f7', '#e8f6f0'], sun: [.8, .18, .035, '#fff6c8'], clouds: 5, far: [['#a6d6b8', .5, .05, 6, 1], ['#86c49a', .56, .04, 9, 2]] },
    terrain(c, w, h) { ground(c, w, h, hillsY); },
  },
  valley: {
    n: '골짜기', d: '양쪽이 높고 가운데가 낮은 넓은 그릇 모양 골짜기. 높은 쪽이 유리하지만 내려가는 길이 막히지 않는다.', tags: ['고저차', '강한 바람'],
    grav: 1, windMax: 10, liquid: null, spawn: [.15, .85], ev: { tornado: .35, lightning: .2, meteors: .05 },
    pal: { soil: ['#a87a4e', '#5a3c26'], crust: '#86c45e', rock: ['#a0958a', '#5c544e'], steel: '#4a4038' },
    sky: { stops: ['#f0a070', '#f6cc98', '#fbe6c2'], sun: [.5, .3, .05, '#fff0c0'], clouds: 3, far: [['#cf9f8c', .4, .09, 5, 0], ['#b08478', .48, .06, 8, 1.5]] },
    terrain(c, w, h) { ground(c, w, h, valleyY); },
  },
  dunes: {
    n: '모래언덕', d: '낮은 모래 둔덕이 물결처럼 이어진 사막. 바람이 세고 모래 회오리가 잘 인다.', tags: ['잔잔한 땅', '모래 회오리'],
    grav: 1, windMax: 10, liquid: null, spawn: [.15, .85], ev: { tornado: .4, meteors: .1 },
    pal: { soil: ['#e6b86e', '#9a6a3a'], crust: '#f6dca0', rock: ['#cf7e4e', '#7a3f26'], steel: '#5a3a26' },
    sky: { stops: ['#f2b670', '#f9dca6', '#fdf0d0'], sun: [.2, .2, .045, '#fff7d8'], far: [['#e7b48a', .46, .03, 4, 0]] },
    terrain(c, w, h) { ground(c, w, h, dunesY); },
  },
  snow: {
    n: '눈벌판', d: '눈 덮인 완만한 벌판. 바닥이 미끄러워 멈춘 뒤에도 조금 미끄러진다.', tags: ['미끄러움', '이어진 땅'], slip: true,
    grav: 1, windMax: 9, liquid: null, spawn: [.15, .85], ev: { lightning: .25, tornado: .2 },
    pal: { soil: ['#9fb6c8', '#5d7488'], crust: '#ffffff', rock: ['#7f8c98', '#4a5560'], steel: '#3e4650' },
    sky: { stops: ['#9ab8dc', '#cfe2f2', '#eef6fb'], sun: [.75, .2, .03, '#ffffff'], clouds: 4, far: [['#c3d4e6', .42, .08, 6, 1], ['#e2ecf5', .5, .03, 10, 0]] },
    terrain(c, w, h) { ground(c, w, h, snowY); },
  },
  demo: {
    n: '연습장', d: '도감용 평지', tags: [], grav: 1, windMax: 0, liquid: null, spawn: [.16, .82], ev: {},
    pal: { soil: ['#c98b4f', '#6a4228'], crust: '#e8c27a', rock: ['#8a8478', '#55504a'] },
    sky: { stops: ['#f2b880', '#f7d9a8', '#f9e7c4'], sun: [.82, .2, .05, '#fff3d6'], far: [['#e2b590', .62, .05, 8, 0]] },
    terrain(c, w, h) { under(c, w, h, u => .8 + .02 * Math.sin(u * 9 + 1), 0, 1, 'soil'); },
  },
};

export const MAP_ORDER = ['hills', 'valley', 'dunes', 'snow'];
