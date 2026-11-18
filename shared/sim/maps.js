// 맵 9종: 지형(재질 격자)과 규칙. 서버와 화면이 같이 쓴다. 하늘 그림은 client/js/render.js
export const MAT = ['', 'soil', 'rock', 'steel', 'leaf', 'wood', 'cap', 'ice'];
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

const hillsY = u => .66 + .06 * Math.sin(u * 7 + .4) + .03 * Math.sin(u * 19 + 2);
const valleyY = u => u < .3 ? .42 + .012 * Math.sin(u * 30) : .42 + (u - .3) * .62;
const moonY = u => .68 + .04 * Math.sin(u * 5 + 1) + .02 * Math.sin(u * 17);
export const MAPS = {
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
    n: '얼음호수', d: '얼어붙은 호수 위 얼음 섬들. 섬 사이 물에 빠지면 낙사.', tags: ['낙사 주의', '얼음 섬', '미끄러움'], slip: true,
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

export const MAP_ORDER = ['hills', 'valley', 'mesa', 'ice', 'sky', 'factory', 'shroom', 'volcano', 'moon'];
