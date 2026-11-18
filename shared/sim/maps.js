// 맵 9종: 지형(재질 격자)과 규칙. 서버와 화면이 같이 쓴다. 하늘 그림은 client/js/render.js
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

const hillsY = u => .66 + .06 * Math.sin(u * 7 + .4) + .03 * Math.sin(u * 19 + 2);
const valleyY = u => u < .3 ? .42 + .012 * Math.sin(u * 30) : .42 + (u - .3) * .62;
const moonY = u => .68 + .04 * Math.sin(u * 5 + 1) + .02 * Math.sin(u * 17);
const mountY = u => .8 - .46 * Math.exp(-(((u - .5) / .12) ** 2)) - .05 * Math.exp(-(((u - .18) / .08) ** 2)) - .05 * Math.exp(-(((u - .82) / .08) ** 2)) + .012 * Math.sin(u * 23);
const caveY = u => .4 + .03 * Math.sin(u * 9 + 1) + .015 * Math.sin(u * 27);
const iceY = u => .58 + .035 * Math.sin(u * 6 + .5) + .015 * Math.sin(u * 21);
const volY = u => { const cone = Math.max(0, 1 - Math.abs(u - .5) / .2), cr = Math.abs(u - .5) < .04 ? .06 * (1 - Math.abs(u - .5) / .04) : 0; return .74 - cone * .42 + cr + .012 * Math.sin(u * 23); };
const arenaY = u => { const x = 2 * u - 1, v = .44 + .36 * (1 - x * x); return Math.abs(x) > .45 ? Math.round(v * 28) / 28 : v; };
const brgY = u => .5 + .02 * Math.sin((u < .5 ? u : 1 - u) * 20);
const mirror = (pts) => pts.map(([u, v]) => [1 - u, v]);
const hole = (c, w, h, f) => { c.globalCompositeOperation = 'destination-out'; f(); c.globalCompositeOperation = 'source-over'; };
export const MAPS = {
  hills: {
    n: '초록언덕', d: '완만한 언덕과 나무가 있는 기본 맵. 처음 하는 사람에게 좋다.', tags: ['입문', '나무도 부서짐'],
    grav: 1, windMax: 8, liquid: null, spawn: [.17, .83], ev: { tornado: .25, lightning: .15, meteors: .1 },
    pal: { soil: ['#b07a48', '#5e3a22'], crust: '#7cc25a', rock: ['#8a8478', '#55504a'], leaf: '#4f9e3c', wood: '#7a4f2c' },
    sky: { stops: ['#7ec8f0', '#bfe6f7', '#e8f6f0'], sun: [.8, .18, .035, '#fff6c8'], clouds: 5, far: [['#a6d6b8', .6, .05, 6, 1], ['#86c49a', .68, .04, 9, 2]] },
    terrain(c, w, h) { under(c, w, h, hillsY, 0, 1, 'soil'); [.07, .31, .6, .93].forEach(u => tree(c, w, h, u, hillsY(u) + .006, .8)); },
  },
  valley: {
    n: '골짜기', d: '양쪽 높은 고원 사이로 바닥이 보이지 않는 깊은 골짜기. 밀려 떨어지면 그대로 낙사.', tags: ['필수 맵', '낙사 주의', '강한 바람'],
    grav: 1, windMax: 10, liquid: { y: .9, type: 'water' }, spawn: [.15, .85], ev: { tornado: .35, lightning: .2, meteors: .05 },
    pal: { soil: ['#a87a4e', '#5a3c26'], crust: '#86c45e', rock: ['#a0958a', '#5c544e'], leaf: '#3f8f46', wood: '#6d4526' },
    sky: { stops: ['#f0a070', '#f6cc98', '#fbe6c2'], sun: [.5, .34, .05, '#fff0c0'], clouds: 3, far: [['#cf9f8c', .48, .09, 5, 0], ['#b08478', .57, .06, 8, 1.5]] },
    terrain(c, w, h) {
      under(c, w, h, valleyY, 0, .418, 'soil'); under(c, w, h, u => valleyY(1 - u), .582, 1, 'soil');
      const wall = [[.395, .482], [.418, .494], [.426, .56], [.419, .64], [.434, .74], [.427, .84], [.442, 1.05], [.37, 1.05], [.38, .6]];
      blob(c, w, h, wall, 'rock'); blob(c, w, h, mirror(wall), 'rock');
      blob(c, w, h, [[.474, .76], [.49, .722], [.512, .718], [.527, .75], [.534, 1.05], [.466, 1.05]], 'rock');
      [.05, .22, .78, .95].forEach(u => tree(c, w, h, u, valleyY(u < .5 ? u : 1 - u) + .006, .8));
    },
  },
  mountain: {
    n: '큰 산', d: '가운데 높은 산이 가로막는 맵. 산을 넘기는 고각 포격과, 산을 깎아 길을 내는 싸움이 된다.', tags: ['고각 포격', '산 깎기'],
    grav: 1, windMax: 10, liquid: null, spawn: [.14, .86], ev: { tornado: .3, lightning: .2, meteors: .1 },
    pal: { soil: ['#a77a4c', '#5c3c24'], crust: '#88c45a', rock: ['#9b9286', '#5a534c'], leaf: '#3f8f46', wood: '#6d4526' },
    sky: { stops: ['#8fc6ee', '#cfe8f6', '#eef7f4'], sun: [.2, .16, .03, '#fffbe0'], clouds: 6, far: [['#b9cfe0', .42, .12, 5, 1], ['#9fbfa8', .6, .05, 9, 0]] },
    terrain(c, w, h) { under(c, w, h, mountY, 0, 1, 'soil'); under(c, w, h, u => mountY(u) + .025, .37, .63, 'rock'); [.05, .28, .72, .95].forEach(u => tree(c, w, h, u, mountY(u) + .006, .75)); },
  },
  cave: {
    n: '땅굴', d: '땅 밑에 커다란 동굴이 숨어 있다. 땅이 파이면 동굴로 떨어지고, 동굴 속에 숨어 싸울 수도 있다.', tags: ['지하 동굴', '여러 층'],
    grav: 1, windMax: 8, liquid: null, spawn: [.12, .88], ev: { lightning: .2, meteors: .2 },
    pal: { soil: ['#9a7048', '#4a3020'], crust: '#7fbf55', rock: ['#7d7468', '#3f3a34'], leaf: '#4f9e3c', wood: '#6d4526' },
    sky: { stops: ['#7aa7d8', '#b8d4ec', '#e6eef2'], clouds: 4, far: [['#97b5a8', .34, .04, 6, 0]] },
    terrain(c, w, h) {
      under(c, w, h, caveY, 0, 1, 'soil'); under(c, w, h, u => .9 + .02 * Math.sin(u * 13), 0, 1, 'rock');
      hole(c, w, h, () => [[.5, .68, .22, .1], [.2, .6, .1, .055], [.8, .6, .1, .055], [.34, .79, .07, .045], [.66, .79, .07, .045]].forEach(([u, v, rx, ry]) => { c.beginPath(); c.ellipse(u * w, v * h, rx * w, ry * h, 0, 0, TAU); c.fill(); }));
      [.4, .46, .54, .6].forEach((u, i) => blob(c, w, h, [[u - .012, .585], [u + .012, .585], [u, .63 + .012 * (i % 2)]], 'rock'));
      [.1, .9].forEach(u => tree(c, w, h, u, caveY(u) + .006, .75));
    },
    backTerrain(c, w, h) { under(c, w, h, caveY, 0, 1, 'soil'); },
  },
  ruins: {
    n: '사막 유적', d: '높이가 제각각인 돌기둥이 늘어선 유적. 높은 기둥을 차지하거나, 상대 기둥을 무너뜨려 떨어뜨린다.', tags: ['고저차 큼', '기둥 무너뜨리기'],
    grav: 1, windMax: 9, liquid: null, spawn: [.1, .9], ev: { tornado: .3, meteors: .15 },
    pal: { soil: ['#e2b670', '#9a6a3a'], crust: '#f3d79a', rock: ['#d29a62', '#7c4e2c'] },
    sky: { stops: ['#2c2a5a', '#6a5a8a', '#d9a07a'], stars: true, far: [['#8a6a6a', .62, .0, 1, 0]],
      extra(c, w, h) { c.fillStyle = 'rgba(120,80,90,.55)'; [[.22, .62, .12], [.62, .6, .16]].forEach(([u, v, s]) => { c.beginPath(); c.moveTo((u - s) * w, v * h + 40); c.lineTo(u * w, (v - s * 1.1) * h); c.lineTo((u + s) * w, v * h + 40); c.fill(); }); } },
    terrain(c, w, h) {
      under(c, w, h, u => .84 + .015 * Math.sin(u * 15), 0, 1, 'soil');
      [[.05, .09, .5], [.19, .07, .63], [.31, .09, .45], [.45, .08, .58], [.58, .07, .48], [.7, .09, .62], [.85, .09, .47]].forEach(([u, uw, t], i) => {
        box(c, w, h, u, t, uw, .9 - t, 'rock'); box(c, w, h, u - .01, t - .022, uw + .02, .026, 'rock');
        if (i % 2) blob(c, w, h, [[u, t - .022], [u + uw * .4, t - .05], [u + uw * .7, t - .03], [u + uw, t - .022]], 'rock');
      });
      box(c, w, h, .36, .815, .1, .03, 'rock');
    },
  },
  city: {
    n: '무너진 도시', d: '부서진 빌딩이 늘어선 도시. 빌딩 옥상을 오가며 싸우고, 빌딩을 깎아 엄폐물을 만든다.', tags: ['빌딩 옥상', '엄폐물'],
    grav: 1, windMax: 8, liquid: null, spawn: [.09, .91], ev: { lightning: .25, pillar: .15, meteors: .1 },
    pal: { soil: ['#5d5a62', '#2e2c33'], crust: '#8a8890', rock: ['#b06a4e', '#5e3426'], steel: '#8f99a8' },
    sky: { stops: ['#3a2f55', '#8a5f7a', '#e8a070'], sun: [.75, .5, .05, '#ffd0a0'],
      extra(c, w, h) { c.fillStyle = 'rgba(40,30,60,.75)'; for (let i = 0; i < 22; i++) { const u = i / 22, bh = .18 + hash(i + 2) * .25; c.fillRect(u * w, (.72 - bh) * h, w / 26, bh * h + 200); } } },
    terrain(c, w, h) {
      under(c, w, h, u => .86, 0, 1, 'soil');
      const bl = [[.03, .12, .5], [.17, .08, .63], [.28, .1, .43], [.41, .07, .6], [.52, .1, .46], [.65, .08, .64], [.76, .11, .49], [.9, .08, .56]];
      bl.forEach(([u, uw, t], i) => { box(c, w, h, u, t, uw, .88 - t, 'rock'); if (i % 3 === 1) blob(c, w, h, [[u, t], [u + uw * .3, t - .03], [u + uw * .55, t - .005], [u + uw * .8, t - .045], [u + uw, t]], 'rock'); });
      hole(c, w, h, () => bl.forEach(([u, uw, t]) => { for (let y = t + .04; y < .8; y += .07) for (let x = u + .012; x < u + uw - .02; x += .03) c.fillRect(x * w, y * h, .012 * w, .03 * h); }));
      box(c, w, h, .14, .5, .04, .012, 'steel'); box(c, w, h, .37, .46, .05, .012, 'steel'); box(c, w, h, .62, .49, .04, .012, 'steel'); box(c, w, h, .86, .52, .05, .012, 'steel');
    },
    backTerrain(c, w, h) { under(c, w, h, u => .86, 0, 1, 'soil'); [[.03, .12, .5], [.17, .08, .63], [.28, .1, .43], [.41, .07, .6], [.52, .1, .46], [.65, .08, .64], [.76, .11, .49], [.9, .08, .56]].forEach(([u, uw, t]) => box(c, w, h, u, t, uw, .88 - t, 'rock')); },
  },
  castle: {
    n: '성채', d: '양쪽 성벽 위에서 마주 보는 공성전. 가운데 해자를 건너는 다리는 부서진다.', tags: ['성벽 엄폐', '다리 파괴', '해자 낙사'],
    grav: 1, windMax: 9, liquid: { y: .84, type: 'water' }, spawn: [.1, .9], ev: { lightning: .2, meteors: .15, tornado: .1 },
    pal: { soil: ['#8f7a58', '#4e4030'], crust: '#7cb55a', rock: ['#a49c90', '#5e574f'], plank: '#9a6a3c', leaf: '#3f8f46', wood: '#6d4526' },
    sky: { stops: ['#6f8fc8', '#b9c8e2', '#ebe6dc'], clouds: 5, far: [['#9fb0a0', .6, .04, 7, 0]] },
    terrain(c, w, h) {
      under(c, w, h, u => .74 + .01 * Math.sin(u * 17), 0, .44, 'soil'); under(c, w, h, u => .74 + .01 * Math.sin(u * 17), .56, 1, 'soil');
      const side = f => {
        blob(c, w, h, f([[.03, .5], [.2, .5], [.2, .76], [.03, .76]]), 'rock');
        for (let i = 0; i < 5; i++) blob(c, w, h, f([[.03 + i * .036, .47], [.048 + i * .036, .47], [.048 + i * .036, .5], [.03 + i * .036, .5]]), 'rock');
        blob(c, w, h, f([[.15, .33], [.21, .33], [.21, .5], [.15, .5]]), 'rock');
        for (let i = 0; i < 3; i++) blob(c, w, h, f([[.15 + i * .024, .3], [.162 + i * .024, .3], [.162 + i * .024, .33], [.15 + i * .024, .33]]), 'rock');
      };
      side(p => p); side(mirror);
      hole(c, w, h, () => { [[.08, .6], [.92, .6]].forEach(([u, v]) => { c.beginPath(); c.ellipse(u * w, v * h, .025 * w, .05 * h, 0, Math.PI, 0); c.lineTo((u + .025) * w, .76 * h); c.lineTo((u - .025) * w, .76 * h); c.fill(); }); });
      box(c, w, h, .42, .72, .16, .02, 'plank');
      [.3, .7].forEach(u => tree(c, w, h, u, .745, .7));
    },
    backTerrain(c, w, h) { this.terrainNoHole(c, w, h); },
    terrainNoHole(c, w, h) { under(c, w, h, u => .74, 0, .44, 'soil'); under(c, w, h, u => .74, .56, 1, 'soil'); blob(c, w, h, [[.03, .5], [.2, .5], [.2, .76], [.03, .76]], 'rock'); blob(c, w, h, mirror([[.03, .5], [.2, .5], [.2, .76], [.03, .76]]), 'rock'); },
  },
  bridge: {
    n: '아찔한 다리', d: '깊은 협곡 위에 기다란 판자 다리 하나. 다리를 끊으면 위에 있던 탱크는 모두 떨어진다.', tags: ['다리 끊기', '낙사 주의'],
    grav: 1, windMax: 10, liquid: { y: .92, type: 'water' }, spawn: [.1, .9], ev: { tornado: .35, lightning: .2 },
    pal: { soil: ['#9c7a50', '#4c3a26'], crust: '#80c05a', rock: ['#8e8a84', '#4c4844'], plank: '#a8763f', leaf: '#3f8f46', wood: '#6a4424' },
    sky: { stops: ['#5f8fd0', '#a9c8ea', '#e4eef4'], sun: [.5, .14, .03, '#ffffff'], clouds: 7, far: [['#8aa6c0', .55, .08, 4, 1], ['#7f9aa4', .68, .05, 8, 0]] },
    terrain(c, w, h) {
      under(c, w, h, brgY, 0, .23, 'soil'); under(c, w, h, brgY, .77, 1, 'soil');
      const cliff = [[.2, .51], [.23, .515], [.235, .6], [.225, .7], [.24, .82], [.23, 1.05], [.16, 1.05], [.18, .7]];
      blob(c, w, h, cliff, 'rock'); blob(c, w, h, mirror(cliff), 'rock');
      box(c, w, h, .22, .5, .56, .016, 'plank');
      blob(c, w, h, [[.48, .72], [.5, .69], [.52, .72], [.53, 1.05], [.47, 1.05]], 'rock');
      box(c, w, h, .495, .516, .01, .18, 'wood');
      [.05, .95].forEach(u => tree(c, w, h, u, brgY(u) + .006, .75));
    },
  },
  arena: {
    n: '투기장', d: '둥근 경기장. 양쪽 계단식 관중석에서 시작해 가운데 바닥으로 몰리기 쉽다.', tags: ['계단 지형', '가운데로 몰림'],
    grav: 1, windMax: 6, liquid: null, spawn: [.13, .87], ev: { pillar: .3, lightning: .15 },
    pal: { soil: ['#c9a070', '#7a5a3a'], crust: '#e0c08a', rock: ['#c8bca8', '#7a7064'] },
    sky: { stops: ['#e89060', '#f4c08a', '#fbe2c0'], sun: [.5, .2, .05, '#fff2c0'], far: [['#c88a6a', .5, .02, 3, 0]] },
    terrain(c, w, h) {
      under(c, w, h, arenaY, 0, 1, 'rock'); under(c, w, h, arenaY, .3, .7, 'soil');
      [[.02, .26], [.94, .26]].forEach(([u, t]) => { box(c, w, h, u, t, .04, .45 - t, 'rock'); box(c, w, h, u - .008, t - .02, .056, .02, 'rock'); });
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
    n: '빙하 계곡', d: '미끄러운 빙하 위. 얼음 틈(크레바스) 아래는 얼음물이라 빠지면 낙사.', tags: ['미끄러움', '크레바스 낙사'], slip: true,
    grav: 1, windMax: 9, liquid: { y: .86, type: 'water' }, spawn: [.14, .86], ev: { lightning: .25, tornado: .2 },
    pal: { soil: ['#9fb6c8', '#5d7488'], crust: '#ffffff', ice: ['#d8f2ff', '#78b8dc'], rock: ['#7f8c98', '#4a5560'] },
    sky: { stops: ['#9ab8dc', '#cfe2f2', '#eef6fb'], sun: [.75, .2, .03, '#ffffff'], clouds: 4, far: [['#c3d4e6', .5, .08, 6, 1], ['#e2ecf5', .62, .03, 10, 0]] },
    terrain(c, w, h) {
      under(c, w, h, iceY, 0, 1, 'ice'); under(c, w, h, u => .9 + .015 * Math.sin(u * 9), 0, 1, 'rock');
      hole(c, w, h, () => [.31, .5, .69].forEach(u => { c.beginPath(); c.moveTo((u - .024) * w, (iceY(u - .024) - .02) * h); c.lineTo((u + .024) * w, (iceY(u + .024) - .02) * h); c.lineTo((u + .004) * w, .97 * h); c.lineTo((u - .004) * w, .97 * h); c.closePath(); c.fill(); }));
    },
    backTerrain(c, w, h) { under(c, w, h, iceY, 0, 1, 'ice'); },
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
    n: '화산 지대', d: '가운데 화산이 불기둥을 뿜는 땅. 곳곳의 용암 웅덩이에 빠지면 낙사.', tags: ['불기둥 자주', '용암 웅덩이'],
    grav: 1, windMax: 9, liquid: { y: .88, type: 'lava' }, spawn: [.12, .88], ev: { pillar: .55, meteors: .25 },
    pal: { soil: ['#6a5048', '#2a1c1c'], crust: '#8a7a6a', rock: ['#4a3a3a', '#1e1414'] },
    sky: { stops: ['#2a1420', '#7a2a2a', '#e0703a'], far: [['#3a1a20', .58, .05, 5, 0]],
      extra(c, w, h) { for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(60,40,45,${.35 - i * .04})`; circ(c, (.5 + i * .04) * w, (.2 - i * .03) * h, (.04 + i * .02) * w); c.fill(); } } },
    terrain(c, w, h) {
      under(c, w, h, volY, 0, 1, 'rock'); under(c, w, h, u => volY(u) + .03, 0, .3, 'soil'); under(c, w, h, u => volY(u) + .03, .7, 1, 'soil');
      hole(c, w, h, () => [[.25, .86], [.75, .86]].forEach(([u, v]) => { c.beginPath(); c.ellipse(u * w, v * h, .05 * w, .11 * h, 0, 0, TAU); c.fill(); }));
    },
  },
  ships: {
    n: '바다 위 결투', d: '바다 위 두 척의 배가 마주 보고 쏜다. 갑판을 깎아 내면 배 밑 바다로 떨어진다.', tags: ['배 갑판', '낙사 주의'],
    grav: 1, windMax: 10, liquid: { y: .78, type: 'water' }, spawn: [.17, .83], ev: { tornado: .35, lightning: .25 },
    pal: { soil: ['#8a7a60', '#4a3e30'], crust: '#c8b890', rock: ['#7a7a80', '#44444a'], plank: '#9a6438', wood: '#5e3c22', leaf: '#f2eee2' },
    sky: { stops: ['#4f86c8', '#9cc4ea', '#e2eef6'], sun: [.5, .16, .03, '#ffffff'], clouds: 6 },
    terrain(c, w, h) {
      const ship = f => {
        blob(c, w, h, f([[.03, .58], [.36, .58], [.34, .72], [.29, .86], [.09, .86], [.05, .72]]), 'plank');
        blob(c, w, h, f([[.05, .48], [.13, .48], [.13, .58], [.05, .58]]), 'plank');
        blob(c, w, h, f([[.3, .52], [.36, .52], [.36, .58], [.3, .58]]), 'plank');
        blob(c, w, h, f([[.198, .18], [.208, .18], [.208, .58], [.198, .58]]), 'wood');
        blob(c, w, h, f([[.208, .2], [.29, .27], [.208, .44]]), 'leaf');
      };
      ship(p => p); ship(mirror);
      blob(c, w, h, [[.46, .76], [.48, .7], [.52, .69], [.54, .76], [.55, 1.05], [.45, 1.05]], 'rock');
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
  sky: {
    n: '구름섬', d: '하늘에 뜬 섬들. 아래는 끝없는 허공이라 밀려나면 바로 낙사.', tags: ['낙사 주의', '섬 사이 이동 불가'],
    grav: 1, windMax: 10, liquid: { y: 1.02, type: 'void' }, spawn: [.13, .86], ev: { tornado: .35, lightning: .3 },
    pal: { soil: ['#9a7a58', '#5a4632'], crust: '#9ad66a', rock: ['#8b8aa0', '#55546a'], leaf: '#5aa84a', wood: '#7a4f2c' },
    sky: { stops: ['#5fa8e8', '#9ccff2', '#d6ecf8'], sun: [.85, .14, .035, '#ffffff'], clouds: 10 },
    terrain(c, w, h) { island(c, w, h, .03, .5, .21, .24); island(c, w, h, .28, .63, .14, .17); island(c, w, h, .44, .41, .13, .19); island(c, w, h, .61, .6, .14, .16); island(c, w, h, .77, .48, .2, .24); tree(c, w, h, .07, .5, .7); tree(c, w, h, .93, .48, .7); tree(c, w, h, .5, .405, .65); },
  },
  demo: {
    n: '연습장', d: '도감용 평지', tags: [], grav: 1, windMax: 0, liquid: null, spawn: [.16, .82], ev: {},
    pal: { soil: ['#c98b4f', '#6a4228'], crust: '#e8c27a', rock: ['#8a8478', '#55504a'] },
    sky: { stops: ['#f2b880', '#f7d9a8', '#f9e7c4'], sun: [.82, .2, .05, '#fff3d6'], far: [['#e2b590', .62, .05, 8, 0]] },
    terrain(c, w, h) { under(c, w, h, u => .8 + .02 * Math.sin(u * 9 + 1), 0, 1, 'soil'); },
  },
};
MAPS.castle.backTerrain = MAPS.castle.terrainNoHole;
export const MAP_ORDER = ['hills', 'valley', 'mountain', 'cave', 'ruins', 'city', 'castle', 'bridge', 'arena', 'mesa', 'ice', 'factory', 'shroom', 'volcano', 'ships', 'moon', 'sky'];
