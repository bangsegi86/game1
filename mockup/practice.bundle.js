(() => {
  // ../shared/sim/maps.js
  var MAT = ["", "soil", "rock", "steel", "leaf", "wood", "cap", "ice", "plank"];
  var MK = Object.fromEntries(MAT.map((m, i) => [m, i]).filter(([m]) => m));
  var TAU2 = Math.PI * 2;
  function under(c, w, h, fn, u0, u1, mat, bottom = 1.05) {
    c.fillStyle = MK[mat];
    c.beginPath();
    c.moveTo(u0 * w, bottom * h);
    for (let x = u0 * w; x <= u1 * w + 0.5; x += 2) c.lineTo(x, fn(x / w) * h);
    c.lineTo(u1 * w, bottom * h);
    c.closePath();
    c.fill();
  }
  function blob(c, w, h, pts, mat) {
    c.fillStyle = MK[mat];
    c.beginPath();
    pts.forEach(([u, v], i) => i ? c.lineTo(u * w, v * h) : c.moveTo(u * w, v * h));
    c.closePath();
    c.fill();
  }
  function box(c, w, h, u, v, uw, vh, mat) {
    c.fillStyle = MK[mat];
    c.fillRect(u * w, v * h, uw * w, vh * h);
  }
  function tree(c, w, h, u, v, s = 1) {
    const x = u * w, y = v * h, k = s * w / 960;
    c.fillStyle = MK.wood;
    c.fillRect(x - 4 * k, y - 36 * k, 8 * k, 44 * k);
    c.fillStyle = MK.leaf;
    [[0, -54, 22], [-16, -42, 16], [16, -42, 16], [0, -72, 15]].forEach(([dx, dy, r]) => {
      c.beginPath();
      c.arc(x + dx * k, y + dy * k, r * k, 0, TAU2);
      c.fill();
    });
  }
  function island(c, w, h, u, v, uw, depth) {
    const x0 = u * w, x1 = (u + uw) * w, y = v * h, d = depth * h, m = (x0 + x1) / 2, s = x1 - x0;
    c.fillStyle = MK.soil;
    c.beginPath();
    c.moveTo(x0, y + 6);
    for (let x = x0; x <= x1; x += 3) c.lineTo(x, y - 5 * Math.sin((x - x0) / s * Math.PI) + 2 * Math.sin(x * 0.09));
    c.lineTo(x1, y + 6);
    c.quadraticCurveTo(m + s * 0.2, y + d * 0.9, m, y + d);
    c.quadraticCurveTo(m - s * 0.25, y + d * 0.7, x0, y + 6);
    c.fill();
    c.fillStyle = MK.rock;
    c.beginPath();
    c.moveTo(x0 + s * 0.1, y + d * 0.3);
    c.quadraticCurveTo(m, y + d * 0.45, x1 - s * 0.1, y + d * 0.3);
    c.quadraticCurveTo(m + s * 0.14, y + d * 0.95, m, y + d - 2);
    c.quadraticCurveTo(m - s * 0.2, y + d * 0.65, x0 + s * 0.1, y + d * 0.3);
    c.fill();
  }
  var hillsY = (u) => 0.66 + 0.06 * Math.sin(u * 7 + 0.4) + 0.03 * Math.sin(u * 19 + 2);
  var valleyY = (u) => u < 0.3 ? 0.42 + 0.012 * Math.sin(u * 30) : 0.42 + (u - 0.3) * 0.62;
  var moonY = (u) => 0.68 + 0.04 * Math.sin(u * 5 + 1) + 0.02 * Math.sin(u * 17);
  var mountY = (u) => 0.8 - 0.46 * Math.exp(-(((u - 0.5) / 0.12) ** 2)) - 0.05 * Math.exp(-(((u - 0.18) / 0.08) ** 2)) - 0.05 * Math.exp(-(((u - 0.82) / 0.08) ** 2)) + 0.012 * Math.sin(u * 23);
  var caveY = (u) => 0.4 + 0.03 * Math.sin(u * 9 + 1) + 0.015 * Math.sin(u * 27);
  var iceY = (u) => 0.58 + 0.035 * Math.sin(u * 6 + 0.5) + 0.015 * Math.sin(u * 21);
  var volY = (u) => {
    const cone = Math.max(0, 1 - Math.abs(u - 0.5) / 0.2), cr = Math.abs(u - 0.5) < 0.04 ? 0.06 * (1 - Math.abs(u - 0.5) / 0.04) : 0;
    return 0.74 - cone * 0.42 + cr + 0.012 * Math.sin(u * 23);
  };
  var arenaY = (u) => {
    const x = 2 * u - 1, v = 0.44 + 0.36 * (1 - x * x);
    return Math.abs(x) > 0.45 ? Math.round(v * 28) / 28 : v;
  };
  var brgY = (u) => 0.5 + 0.02 * Math.sin((u < 0.5 ? u : 1 - u) * 20);
  var mirror = (pts) => pts.map(([u, v]) => [1 - u, v]);
  var hole = (c, w, h, f) => {
    c.globalCompositeOperation = "destination-out";
    f();
    c.globalCompositeOperation = "source-over";
  };
  var MAPS = {
    hills: {
      n: "\uCD08\uB85D\uC5B8\uB355",
      d: "\uC644\uB9CC\uD55C \uC5B8\uB355\uACFC \uB098\uBB34\uAC00 \uC788\uB294 \uAE30\uBCF8 \uB9F5. \uCC98\uC74C \uD558\uB294 \uC0AC\uB78C\uC5D0\uAC8C \uC88B\uB2E4.",
      tags: ["\uC785\uBB38", "\uB098\uBB34\uB3C4 \uBD80\uC11C\uC9D0"],
      grav: 1,
      windMax: 8,
      liquid: null,
      spawn: [0.17, 0.83],
      ev: { tornado: 0.25, lightning: 0.15, meteors: 0.1 },
      pal: { soil: ["#b07a48", "#5e3a22"], crust: "#7cc25a", rock: ["#8a8478", "#55504a"], leaf: "#4f9e3c", wood: "#7a4f2c" },
      sky: { stops: ["#7ec8f0", "#bfe6f7", "#e8f6f0"], sun: [0.8, 0.18, 0.035, "#fff6c8"], clouds: 5, far: [["#a6d6b8", 0.6, 0.05, 6, 1], ["#86c49a", 0.68, 0.04, 9, 2]] },
      terrain(c, w, h) {
        under(c, w, h, hillsY, 0, 1, "soil");
        [0.07, 0.31, 0.6, 0.93].forEach((u) => tree(c, w, h, u, hillsY(u) + 6e-3, 0.8));
      }
    },
    valley: {
      n: "\uACE8\uC9DC\uAE30",
      d: "\uC591\uCABD \uB192\uC740 \uACE0\uC6D0 \uC0AC\uC774\uB85C \uBC14\uB2E5\uC774 \uBCF4\uC774\uC9C0 \uC54A\uB294 \uAE4A\uC740 \uACE8\uC9DC\uAE30. \uBC00\uB824 \uB5A8\uC5B4\uC9C0\uBA74 \uADF8\uB300\uB85C \uB099\uC0AC.",
      tags: ["\uD544\uC218 \uB9F5", "\uB099\uC0AC \uC8FC\uC758", "\uAC15\uD55C \uBC14\uB78C"],
      grav: 1,
      windMax: 10,
      liquid: { y: 0.9, type: "water" },
      spawn: [0.15, 0.85],
      ev: { tornado: 0.35, lightning: 0.2, meteors: 0.05 },
      pal: { soil: ["#a87a4e", "#5a3c26"], crust: "#86c45e", rock: ["#a0958a", "#5c544e"], leaf: "#3f8f46", wood: "#6d4526" },
      sky: { stops: ["#f0a070", "#f6cc98", "#fbe6c2"], sun: [0.5, 0.34, 0.05, "#fff0c0"], clouds: 3, far: [["#cf9f8c", 0.48, 0.09, 5, 0], ["#b08478", 0.57, 0.06, 8, 1.5]] },
      terrain(c, w, h) {
        under(c, w, h, valleyY, 0, 0.418, "soil");
        under(c, w, h, (u) => valleyY(1 - u), 0.582, 1, "soil");
        const wall = [[0.395, 0.482], [0.418, 0.494], [0.426, 0.56], [0.419, 0.64], [0.434, 0.74], [0.427, 0.84], [0.442, 1.05], [0.37, 1.05], [0.38, 0.6]];
        blob(c, w, h, wall, "rock");
        blob(c, w, h, mirror(wall), "rock");
        blob(c, w, h, [[0.474, 0.76], [0.49, 0.722], [0.512, 0.718], [0.527, 0.75], [0.534, 1.05], [0.466, 1.05]], "rock");
        [0.05, 0.22, 0.78, 0.95].forEach((u) => tree(c, w, h, u, valleyY(u < 0.5 ? u : 1 - u) + 6e-3, 0.8));
      }
    },
    mountain: {
      n: "\uD070 \uC0B0",
      d: "\uAC00\uC6B4\uB370 \uB192\uC740 \uC0B0\uC774 \uAC00\uB85C\uB9C9\uB294 \uB9F5. \uC0B0\uC744 \uB118\uAE30\uB294 \uACE0\uAC01 \uD3EC\uACA9\uACFC, \uC0B0\uC744 \uAE4E\uC544 \uAE38\uC744 \uB0B4\uB294 \uC2F8\uC6C0\uC774 \uB41C\uB2E4.",
      tags: ["\uACE0\uAC01 \uD3EC\uACA9", "\uC0B0 \uAE4E\uAE30"],
      grav: 1,
      windMax: 10,
      liquid: null,
      spawn: [0.14, 0.86],
      ev: { tornado: 0.3, lightning: 0.2, meteors: 0.1 },
      pal: { soil: ["#a77a4c", "#5c3c24"], crust: "#88c45a", rock: ["#9b9286", "#5a534c"], leaf: "#3f8f46", wood: "#6d4526" },
      sky: { stops: ["#8fc6ee", "#cfe8f6", "#eef7f4"], sun: [0.2, 0.16, 0.03, "#fffbe0"], clouds: 6, far: [["#b9cfe0", 0.42, 0.12, 5, 1], ["#9fbfa8", 0.6, 0.05, 9, 0]] },
      terrain(c, w, h) {
        under(c, w, h, mountY, 0, 1, "soil");
        under(c, w, h, (u) => mountY(u) + 0.025, 0.37, 0.63, "rock");
        [0.05, 0.28, 0.72, 0.95].forEach((u) => tree(c, w, h, u, mountY(u) + 6e-3, 0.75));
      }
    },
    cave: {
      n: "\uB545\uAD74",
      d: "\uB545 \uBC11\uC5D0 \uCEE4\uB2E4\uB780 \uB3D9\uAD74\uC774 \uC228\uC5B4 \uC788\uB2E4. \uB545\uC774 \uD30C\uC774\uBA74 \uB3D9\uAD74\uB85C \uB5A8\uC5B4\uC9C0\uACE0, \uB3D9\uAD74 \uC18D\uC5D0 \uC228\uC5B4 \uC2F8\uC6B8 \uC218\uB3C4 \uC788\uB2E4.",
      tags: ["\uC9C0\uD558 \uB3D9\uAD74", "\uC5EC\uB7EC \uCE35"],
      grav: 1,
      windMax: 8,
      liquid: null,
      spawn: [0.12, 0.88],
      ev: { lightning: 0.2, meteors: 0.2 },
      pal: { soil: ["#9a7048", "#4a3020"], crust: "#7fbf55", rock: ["#7d7468", "#3f3a34"], leaf: "#4f9e3c", wood: "#6d4526" },
      sky: { stops: ["#7aa7d8", "#b8d4ec", "#e6eef2"], clouds: 4, far: [["#97b5a8", 0.34, 0.04, 6, 0]] },
      terrain(c, w, h) {
        under(c, w, h, caveY, 0, 1, "soil");
        under(c, w, h, (u) => 0.9 + 0.02 * Math.sin(u * 13), 0, 1, "rock");
        hole(c, w, h, () => [[0.5, 0.68, 0.22, 0.1], [0.2, 0.6, 0.1, 0.055], [0.8, 0.6, 0.1, 0.055], [0.34, 0.79, 0.07, 0.045], [0.66, 0.79, 0.07, 0.045]].forEach(([u, v, rx, ry]) => {
          c.beginPath();
          c.ellipse(u * w, v * h, rx * w, ry * h, 0, 0, TAU2);
          c.fill();
        }));
        [0.4, 0.46, 0.54, 0.6].forEach((u, i) => blob(c, w, h, [[u - 0.012, 0.585], [u + 0.012, 0.585], [u, 0.63 + 0.012 * (i % 2)]], "rock"));
        [0.1, 0.9].forEach((u) => tree(c, w, h, u, caveY(u) + 6e-3, 0.75));
      },
      backTerrain(c, w, h) {
        under(c, w, h, caveY, 0, 1, "soil");
      }
    },
    ruins: {
      n: "\uC0AC\uB9C9 \uC720\uC801",
      d: "\uB192\uC774\uAC00 \uC81C\uAC01\uAC01\uC778 \uB3CC\uAE30\uB465\uC774 \uB298\uC5B4\uC120 \uC720\uC801. \uB192\uC740 \uAE30\uB465\uC744 \uCC28\uC9C0\uD558\uAC70\uB098, \uC0C1\uB300 \uAE30\uB465\uC744 \uBB34\uB108\uB728\uB824 \uB5A8\uC5B4\uB728\uB9B0\uB2E4.",
      tags: ["\uACE0\uC800\uCC28 \uD07C", "\uAE30\uB465 \uBB34\uB108\uB728\uB9AC\uAE30"],
      grav: 1,
      windMax: 9,
      liquid: null,
      spawn: [0.1, 0.9],
      ev: { tornado: 0.3, meteors: 0.15 },
      pal: { soil: ["#e2b670", "#9a6a3a"], crust: "#f3d79a", rock: ["#d29a62", "#7c4e2c"] },
      sky: {
        stops: ["#2c2a5a", "#6a5a8a", "#d9a07a"],
        stars: true,
        far: [["#8a6a6a", 0.62, 0, 1, 0]],
        extra(c, w, h) {
          c.fillStyle = "rgba(120,80,90,.55)";
          [[0.22, 0.62, 0.12], [0.62, 0.6, 0.16]].forEach(([u, v, s]) => {
            c.beginPath();
            c.moveTo((u - s) * w, v * h + 40);
            c.lineTo(u * w, (v - s * 1.1) * h);
            c.lineTo((u + s) * w, v * h + 40);
            c.fill();
          });
        }
      },
      terrain(c, w, h) {
        under(c, w, h, (u) => 0.84 + 0.015 * Math.sin(u * 15), 0, 1, "soil");
        [[0.05, 0.09, 0.5], [0.19, 0.07, 0.63], [0.31, 0.09, 0.45], [0.45, 0.08, 0.58], [0.58, 0.07, 0.48], [0.7, 0.09, 0.62], [0.85, 0.09, 0.47]].forEach(([u, uw, t], i) => {
          box(c, w, h, u, t, uw, 0.9 - t, "rock");
          box(c, w, h, u - 0.01, t - 0.022, uw + 0.02, 0.026, "rock");
          if (i % 2) blob(c, w, h, [[u, t - 0.022], [u + uw * 0.4, t - 0.05], [u + uw * 0.7, t - 0.03], [u + uw, t - 0.022]], "rock");
        });
        box(c, w, h, 0.36, 0.815, 0.1, 0.03, "rock");
      }
    },
    city: {
      n: "\uBB34\uB108\uC9C4 \uB3C4\uC2DC",
      d: "\uBD80\uC11C\uC9C4 \uBE4C\uB529\uC774 \uB298\uC5B4\uC120 \uB3C4\uC2DC. \uBE4C\uB529 \uC625\uC0C1\uC744 \uC624\uAC00\uBA70 \uC2F8\uC6B0\uACE0, \uBE4C\uB529\uC744 \uAE4E\uC544 \uC5C4\uD3D0\uBB3C\uC744 \uB9CC\uB4E0\uB2E4.",
      tags: ["\uBE4C\uB529 \uC625\uC0C1", "\uC5C4\uD3D0\uBB3C"],
      grav: 1,
      windMax: 8,
      liquid: null,
      spawn: [0.09, 0.91],
      ev: { lightning: 0.25, pillar: 0.15, meteors: 0.1 },
      pal: { soil: ["#5d5a62", "#2e2c33"], crust: "#8a8890", rock: ["#b06a4e", "#5e3426"], steel: "#8f99a8" },
      sky: {
        stops: ["#3a2f55", "#8a5f7a", "#e8a070"],
        sun: [0.75, 0.5, 0.05, "#ffd0a0"],
        extra(c, w, h) {
          c.fillStyle = "rgba(40,30,60,.75)";
          for (let i = 0; i < 22; i++) {
            const u = i / 22, bh = 0.18 + hash(i + 2) * 0.25;
            c.fillRect(u * w, (0.72 - bh) * h, w / 26, bh * h + 200);
          }
        }
      },
      terrain(c, w, h) {
        under(c, w, h, (u) => 0.86, 0, 1, "soil");
        const bl = [[0.03, 0.12, 0.5], [0.17, 0.08, 0.63], [0.28, 0.1, 0.43], [0.41, 0.07, 0.6], [0.52, 0.1, 0.46], [0.65, 0.08, 0.64], [0.76, 0.11, 0.49], [0.9, 0.08, 0.56]];
        bl.forEach(([u, uw, t], i) => {
          box(c, w, h, u, t, uw, 0.88 - t, "rock");
          if (i % 3 === 1) blob(c, w, h, [[u, t], [u + uw * 0.3, t - 0.03], [u + uw * 0.55, t - 5e-3], [u + uw * 0.8, t - 0.045], [u + uw, t]], "rock");
        });
        hole(c, w, h, () => bl.forEach(([u, uw, t]) => {
          for (let y = t + 0.04; y < 0.8; y += 0.07) for (let x = u + 0.012; x < u + uw - 0.02; x += 0.03) c.fillRect(x * w, y * h, 0.012 * w, 0.03 * h);
        }));
        box(c, w, h, 0.14, 0.5, 0.04, 0.012, "steel");
        box(c, w, h, 0.37, 0.46, 0.05, 0.012, "steel");
        box(c, w, h, 0.62, 0.49, 0.04, 0.012, "steel");
        box(c, w, h, 0.86, 0.52, 0.05, 0.012, "steel");
      },
      backTerrain(c, w, h) {
        under(c, w, h, (u) => 0.86, 0, 1, "soil");
        [[0.03, 0.12, 0.5], [0.17, 0.08, 0.63], [0.28, 0.1, 0.43], [0.41, 0.07, 0.6], [0.52, 0.1, 0.46], [0.65, 0.08, 0.64], [0.76, 0.11, 0.49], [0.9, 0.08, 0.56]].forEach(([u, uw, t]) => box(c, w, h, u, t, uw, 0.88 - t, "rock"));
      }
    },
    castle: {
      n: "\uC131\uCC44",
      d: "\uC591\uCABD \uC131\uBCBD \uC704\uC5D0\uC11C \uB9C8\uC8FC \uBCF4\uB294 \uACF5\uC131\uC804. \uAC00\uC6B4\uB370 \uD574\uC790\uB97C \uAC74\uB108\uB294 \uB2E4\uB9AC\uB294 \uBD80\uC11C\uC9C4\uB2E4.",
      tags: ["\uC131\uBCBD \uC5C4\uD3D0", "\uB2E4\uB9AC \uD30C\uAD34", "\uD574\uC790 \uB099\uC0AC"],
      grav: 1,
      windMax: 9,
      liquid: { y: 0.84, type: "water" },
      spawn: [0.1, 0.9],
      ev: { lightning: 0.2, meteors: 0.15, tornado: 0.1 },
      pal: { soil: ["#8f7a58", "#4e4030"], crust: "#7cb55a", rock: ["#a49c90", "#5e574f"], plank: "#9a6a3c", leaf: "#3f8f46", wood: "#6d4526" },
      sky: { stops: ["#6f8fc8", "#b9c8e2", "#ebe6dc"], clouds: 5, far: [["#9fb0a0", 0.6, 0.04, 7, 0]] },
      terrain(c, w, h) {
        under(c, w, h, (u) => 0.74 + 0.01 * Math.sin(u * 17), 0, 0.44, "soil");
        under(c, w, h, (u) => 0.74 + 0.01 * Math.sin(u * 17), 0.56, 1, "soil");
        const side = (f) => {
          blob(c, w, h, f([[0.03, 0.5], [0.2, 0.5], [0.2, 0.76], [0.03, 0.76]]), "rock");
          for (let i = 0; i < 5; i++) blob(c, w, h, f([[0.03 + i * 0.036, 0.47], [0.048 + i * 0.036, 0.47], [0.048 + i * 0.036, 0.5], [0.03 + i * 0.036, 0.5]]), "rock");
          blob(c, w, h, f([[0.15, 0.33], [0.21, 0.33], [0.21, 0.5], [0.15, 0.5]]), "rock");
          for (let i = 0; i < 3; i++) blob(c, w, h, f([[0.15 + i * 0.024, 0.3], [0.162 + i * 0.024, 0.3], [0.162 + i * 0.024, 0.33], [0.15 + i * 0.024, 0.33]]), "rock");
        };
        side((p) => p);
        side(mirror);
        hole(c, w, h, () => {
          [[0.08, 0.6], [0.92, 0.6]].forEach(([u, v]) => {
            c.beginPath();
            c.ellipse(u * w, v * h, 0.025 * w, 0.05 * h, 0, Math.PI, 0);
            c.lineTo((u + 0.025) * w, 0.76 * h);
            c.lineTo((u - 0.025) * w, 0.76 * h);
            c.fill();
          });
        });
        box(c, w, h, 0.42, 0.72, 0.16, 0.02, "plank");
        [0.3, 0.7].forEach((u) => tree(c, w, h, u, 0.745, 0.7));
      },
      backTerrain(c, w, h) {
        this.terrainNoHole(c, w, h);
      },
      terrainNoHole(c, w, h) {
        under(c, w, h, (u) => 0.74, 0, 0.44, "soil");
        under(c, w, h, (u) => 0.74, 0.56, 1, "soil");
        blob(c, w, h, [[0.03, 0.5], [0.2, 0.5], [0.2, 0.76], [0.03, 0.76]], "rock");
        blob(c, w, h, mirror([[0.03, 0.5], [0.2, 0.5], [0.2, 0.76], [0.03, 0.76]]), "rock");
      }
    },
    bridge: {
      n: "\uC544\uCC14\uD55C \uB2E4\uB9AC",
      d: "\uAE4A\uC740 \uD611\uACE1 \uC704\uC5D0 \uAE30\uB2E4\uB780 \uD310\uC790 \uB2E4\uB9AC \uD558\uB098. \uB2E4\uB9AC\uB97C \uB04A\uC73C\uBA74 \uC704\uC5D0 \uC788\uB358 \uD0F1\uD06C\uB294 \uBAA8\uB450 \uB5A8\uC5B4\uC9C4\uB2E4.",
      tags: ["\uB2E4\uB9AC \uB04A\uAE30", "\uB099\uC0AC \uC8FC\uC758"],
      grav: 1,
      windMax: 10,
      liquid: { y: 0.92, type: "water" },
      spawn: [0.1, 0.9],
      ev: { tornado: 0.35, lightning: 0.2 },
      pal: { soil: ["#9c7a50", "#4c3a26"], crust: "#80c05a", rock: ["#8e8a84", "#4c4844"], plank: "#a8763f", leaf: "#3f8f46", wood: "#6a4424" },
      sky: { stops: ["#5f8fd0", "#a9c8ea", "#e4eef4"], sun: [0.5, 0.14, 0.03, "#ffffff"], clouds: 7, far: [["#8aa6c0", 0.55, 0.08, 4, 1], ["#7f9aa4", 0.68, 0.05, 8, 0]] },
      terrain(c, w, h) {
        under(c, w, h, brgY, 0, 0.23, "soil");
        under(c, w, h, brgY, 0.77, 1, "soil");
        const cliff = [[0.2, 0.51], [0.23, 0.515], [0.235, 0.6], [0.225, 0.7], [0.24, 0.82], [0.23, 1.05], [0.16, 1.05], [0.18, 0.7]];
        blob(c, w, h, cliff, "rock");
        blob(c, w, h, mirror(cliff), "rock");
        box(c, w, h, 0.22, 0.5, 0.56, 0.016, "plank");
        blob(c, w, h, [[0.48, 0.72], [0.5, 0.69], [0.52, 0.72], [0.53, 1.05], [0.47, 1.05]], "rock");
        box(c, w, h, 0.495, 0.516, 0.01, 0.18, "wood");
        [0.05, 0.95].forEach((u) => tree(c, w, h, u, brgY(u) + 6e-3, 0.75));
      }
    },
    arena: {
      n: "\uD22C\uAE30\uC7A5",
      d: "\uB465\uADFC \uACBD\uAE30\uC7A5. \uC591\uCABD \uACC4\uB2E8\uC2DD \uAD00\uC911\uC11D\uC5D0\uC11C \uC2DC\uC791\uD574 \uAC00\uC6B4\uB370 \uBC14\uB2E5\uC73C\uB85C \uBAB0\uB9AC\uAE30 \uC27D\uB2E4.",
      tags: ["\uACC4\uB2E8 \uC9C0\uD615", "\uAC00\uC6B4\uB370\uB85C \uBAB0\uB9BC"],
      grav: 1,
      windMax: 6,
      liquid: null,
      spawn: [0.13, 0.87],
      ev: { pillar: 0.3, lightning: 0.15 },
      pal: { soil: ["#c9a070", "#7a5a3a"], crust: "#e0c08a", rock: ["#c8bca8", "#7a7064"] },
      sky: { stops: ["#e89060", "#f4c08a", "#fbe2c0"], sun: [0.5, 0.2, 0.05, "#fff2c0"], far: [["#c88a6a", 0.5, 0.02, 3, 0]] },
      terrain(c, w, h) {
        under(c, w, h, arenaY, 0, 1, "rock");
        under(c, w, h, arenaY, 0.3, 0.7, "soil");
        [[0.02, 0.26], [0.94, 0.26]].forEach(([u, t]) => {
          box(c, w, h, u, t, 0.04, 0.45 - t, "rock");
          box(c, w, h, u - 8e-3, t - 0.02, 0.056, 0.02, "rock");
        });
      }
    },
    mesa: {
      n: "\uBAA8\uB798\uD611\uACE1",
      d: "\uD3C9\uD3C9\uD55C \uBC14\uC704 \uD0D1(\uBA54\uC0AC)\uC774 \uC19F\uC740 \uC0AC\uB9C9. \uB192\uC740 \uD0D1\uC744 \uCC28\uC9C0\uD558\uBA74 \uC720\uB9AC\uD558\uB2E4.",
      tags: ["\uACE0\uC800\uCC28 \uD07C", "\uBAA8\uB798 \uD68C\uC624\uB9AC"],
      grav: 1,
      windMax: 10,
      liquid: null,
      spawn: [0.1, 0.85],
      ev: { tornado: 0.4, meteors: 0.1 },
      pal: { soil: ["#e6b86e", "#9a6a3a"], crust: "#f6dca0", rock: ["#cf7e4e", "#7a3f26"] },
      sky: {
        stops: ["#f2b670", "#f9dca6", "#fdf0d0"],
        sun: [0.2, 0.2, 0.045, "#fff7d8"],
        far: [["#e7b48a", 0.6, 0.03, 4, 0]],
        extra(c, w, h) {
          c.fillStyle = "rgba(205,130,90,.45)";
          [[0.12, 0.48, 0.1], [0.4, 0.52, 0.08], [0.7, 0.45, 0.12]].forEach(([u, v, s]) => {
            c.fillRect(u * w, v * h, s * w, h);
          });
        }
      },
      terrain(c, w, h) {
        under(c, w, h, (u) => 0.86 + 0.02 * Math.sin(u * 11), 0, 1, "soil");
        [[0.04, 0.16, 0.52], [0.27, 0.4, 0.42], [0.55, 0.66, 0.5], [0.78, 0.92, 0.44]].forEach(([a, b, t]) => {
          blob(c, w, h, [[a - 0.01, 0.88], [a + 0.012, t + 0.05], [a + 0.02, t], [b - 0.02, t], [b - 0.012, t + 0.05], [b + 0.01, 0.88]], "rock");
          box(c, w, h, a + 0.02, t - 0.014, b - a - 0.04, 0.022, "soil");
        });
      }
    },
    ice: {
      n: "\uBE59\uD558 \uACC4\uACE1",
      d: "\uBBF8\uB044\uB7EC\uC6B4 \uBE59\uD558 \uC704. \uC5BC\uC74C \uD2C8(\uD06C\uB808\uBC14\uC2A4) \uC544\uB798\uB294 \uC5BC\uC74C\uBB3C\uC774\uB77C \uBE60\uC9C0\uBA74 \uB099\uC0AC.",
      tags: ["\uBBF8\uB044\uB7EC\uC6C0", "\uD06C\uB808\uBC14\uC2A4 \uB099\uC0AC"],
      slip: true,
      grav: 1,
      windMax: 9,
      liquid: { y: 0.86, type: "water" },
      spawn: [0.14, 0.86],
      ev: { lightning: 0.25, tornado: 0.2 },
      pal: { soil: ["#9fb6c8", "#5d7488"], crust: "#ffffff", ice: ["#d8f2ff", "#78b8dc"], rock: ["#7f8c98", "#4a5560"] },
      sky: { stops: ["#9ab8dc", "#cfe2f2", "#eef6fb"], sun: [0.75, 0.2, 0.03, "#ffffff"], clouds: 4, far: [["#c3d4e6", 0.5, 0.08, 6, 1], ["#e2ecf5", 0.62, 0.03, 10, 0]] },
      terrain(c, w, h) {
        under(c, w, h, iceY, 0, 1, "ice");
        under(c, w, h, (u) => 0.9 + 0.015 * Math.sin(u * 9), 0, 1, "rock");
        hole(c, w, h, () => [0.31, 0.5, 0.69].forEach((u) => {
          c.beginPath();
          c.moveTo((u - 0.024) * w, (iceY(u - 0.024) - 0.02) * h);
          c.lineTo((u + 0.024) * w, (iceY(u + 0.024) - 0.02) * h);
          c.lineTo((u + 4e-3) * w, 0.97 * h);
          c.lineTo((u - 4e-3) * w, 0.97 * h);
          c.closePath();
          c.fill();
        }));
      },
      backTerrain(c, w, h) {
        under(c, w, h, iceY, 0, 1, "ice");
      }
    },
    factory: {
      n: "\uD3D0\uACF5\uC7A5",
      d: "\uBD80\uC11C\uC9C0\uC9C0 \uC54A\uB294 \uCCA0\uD310\uACFC \uCCA0\uACE8 \uB2E4\uB9AC\uAC00 \uC788\uB294 \uACF5\uC7A5 \uD130. \uAC00\uC6B4\uB370 \uC0B0\uC131 \uC6C5\uB369\uC774\uB294 \uB099\uC0AC.",
      tags: ["\uCCA0\uD310\uC740 \uC548 \uBD80\uC11C\uC9D0", "\uC5C4\uD3D0\uBB3C", "\uB099\uC0AC \uC8FC\uC758"],
      grav: 1,
      windMax: 7,
      liquid: { y: 0.93, type: "acid" },
      spawn: [0.13, 0.87],
      ev: { pillar: 0.2, lightning: 0.2 },
      pal: { soil: ["#7a6a5a", "#3e342c"], crust: "#8f8f7a", rock: ["#a8664c", "#5e3426"], steel: "#9aa4b2" },
      sky: {
        stops: ["#4f4570", "#9f84a4", "#e3bba0"],
        far: [["#4a4060", 0.62, 0, 1, 0]],
        extra(c, w, h) {
          c.fillStyle = "rgba(60,50,85,.8)";
          [[0.1, 0.35, 0.03], [0.16, 0.28, 0.025], [0.82, 0.3, 0.03], [0.62, 0.4, 0.02]].forEach(([u, v, s]) => c.fillRect(u * w, v * h, s * w, h));
          c.fillRect(0, 0.55 * h, w, h);
        }
      },
      terrain(c, w, h) {
        under(c, w, h, (u) => 0.8 + 0.015 * Math.sin(u * 13), 0, 0.4, "soil");
        under(c, w, h, (u) => 0.8 + 0.015 * Math.sin(u * 13), 0.6, 1, "soil");
        box(c, w, h, 0.06, 0.6, 0.14, 0.22, "rock");
        box(c, w, h, 0.8, 0.56, 0.14, 0.26, "rock");
        box(c, w, h, 0.05, 0.585, 0.16, 0.02, "steel");
        box(c, w, h, 0.79, 0.545, 0.16, 0.02, "steel");
        box(c, w, h, 0.37, 0.62, 0.26, 0.025, "steel");
        box(c, w, h, 0.385, 0.645, 0.012, 0.3, "steel");
        box(c, w, h, 0.603, 0.645, 0.012, 0.3, "steel");
        box(c, w, h, 0.46, 0.4, 0.08, 0.015, "steel");
        box(c, w, h, 0.495, 0.415, 0.01, 0.205, "steel");
        box(c, w, h, 0.25, 0.66, 0.07, 0.14, "rock");
        box(c, w, h, 0.68, 0.64, 0.06, 0.16, "rock");
      }
    },
    shroom: {
      n: "\uBC84\uC12F\uC232",
      d: "\uAC70\uB300\uD55C \uBC84\uC12F \uAC13\uC774 \uCE35\uCE35\uC774 \uC788\uB294 \uC232. \uAC13 \uC704\uC5D0 \uC62C\uB77C\uC11C\uBA74 \uB192\uC740 \uC790\uB9AC.",
      tags: ["\uC5EC\uB7EC \uCE35", "\uAC13\uC740 \uC798 \uBD80\uC11C\uC9D0"],
      grav: 1,
      windMax: 8,
      liquid: null,
      spawn: [0.12, 0.9],
      ev: { tornado: 0.2, lightning: 0.15, meteors: 0.1 },
      pal: { soil: ["#6a5a7a", "#342a40"], crust: "#7fd06c", wood: "#efe0c8", cap: "#e5487a", leaf: "#4f9e3c" },
      sky: {
        stops: ["#284a5a", "#5f9a9a", "#c4e4cc"],
        far: [["#3f6f6a", 0.52, 0.06, 7, 0], ["#4f807a", 0.62, 0.05, 11, 1]],
        extra(c, w, h) {
          for (let i = 0; i < 30; i++) {
            c.fillStyle = `rgba(230,255,160,${0.4 + hash(i) * 0.5})`;
            circ(c, hash(i + 3) * w, (0.2 + hash(i + 7) * 0.5) * h, 1.5);
            c.fill();
          }
        }
      },
      terrain(c, w, h) {
        under(c, w, h, (u) => 0.84 + 0.02 * Math.sin(u * 9), 0, 1, "soil");
        [[0.12, 0.58, 0.1], [0.32, 0.44, 0.085], [0.52, 0.62, 0.11], [0.72, 0.4, 0.1], [0.9, 0.6, 0.085]].forEach(([u, v, r]) => {
          box(c, w, h, u - 0.014, v, 0.028, 0.86 - v, "wood");
          c.fillStyle = MK.cap;
          c.beginPath();
          c.ellipse(u * w, v * h + 6, r * w, r * w * 0.55, 0, Math.PI, 0);
          c.closePath();
          c.fill();
        });
      }
    },
    volcano: {
      n: "\uD654\uC0B0 \uC9C0\uB300",
      d: "\uAC00\uC6B4\uB370 \uD654\uC0B0\uC774 \uBD88\uAE30\uB465\uC744 \uBFDC\uB294 \uB545. \uACF3\uACF3\uC758 \uC6A9\uC554 \uC6C5\uB369\uC774\uC5D0 \uBE60\uC9C0\uBA74 \uB099\uC0AC.",
      tags: ["\uBD88\uAE30\uB465 \uC790\uC8FC", "\uC6A9\uC554 \uC6C5\uB369\uC774"],
      grav: 1,
      windMax: 9,
      liquid: { y: 0.88, type: "lava" },
      spawn: [0.12, 0.88],
      ev: { pillar: 0.55, meteors: 0.25 },
      pal: { soil: ["#6a5048", "#2a1c1c"], crust: "#8a7a6a", rock: ["#4a3a3a", "#1e1414"] },
      sky: {
        stops: ["#2a1420", "#7a2a2a", "#e0703a"],
        far: [["#3a1a20", 0.58, 0.05, 5, 0]],
        extra(c, w, h) {
          for (let i = 0; i < 6; i++) {
            c.fillStyle = `rgba(60,40,45,${0.35 - i * 0.04})`;
            circ(c, (0.5 + i * 0.04) * w, (0.2 - i * 0.03) * h, (0.04 + i * 0.02) * w);
            c.fill();
          }
        }
      },
      terrain(c, w, h) {
        under(c, w, h, volY, 0, 1, "rock");
        under(c, w, h, (u) => volY(u) + 0.03, 0, 0.3, "soil");
        under(c, w, h, (u) => volY(u) + 0.03, 0.7, 1, "soil");
        hole(c, w, h, () => [[0.25, 0.86], [0.75, 0.86]].forEach(([u, v]) => {
          c.beginPath();
          c.ellipse(u * w, v * h, 0.05 * w, 0.11 * h, 0, 0, TAU2);
          c.fill();
        }));
      }
    },
    ships: {
      n: "\uBC14\uB2E4 \uC704 \uACB0\uD22C",
      d: "\uBC14\uB2E4 \uC704 \uB450 \uCC99\uC758 \uBC30\uAC00 \uB9C8\uC8FC \uBCF4\uACE0 \uC3DC\uB2E4. \uAC11\uD310\uC744 \uAE4E\uC544 \uB0B4\uBA74 \uBC30 \uBC11 \uBC14\uB2E4\uB85C \uB5A8\uC5B4\uC9C4\uB2E4.",
      tags: ["\uBC30 \uAC11\uD310", "\uB099\uC0AC \uC8FC\uC758"],
      grav: 1,
      windMax: 10,
      liquid: { y: 0.78, type: "water" },
      spawn: [0.17, 0.83],
      ev: { tornado: 0.35, lightning: 0.25 },
      pal: { soil: ["#8a7a60", "#4a3e30"], crust: "#c8b890", rock: ["#7a7a80", "#44444a"], plank: "#9a6438", wood: "#5e3c22", leaf: "#f2eee2" },
      sky: { stops: ["#4f86c8", "#9cc4ea", "#e2eef6"], sun: [0.5, 0.16, 0.03, "#ffffff"], clouds: 6 },
      terrain(c, w, h) {
        const ship = (f) => {
          blob(c, w, h, f([[0.03, 0.58], [0.36, 0.58], [0.34, 0.72], [0.29, 0.86], [0.09, 0.86], [0.05, 0.72]]), "plank");
          blob(c, w, h, f([[0.05, 0.48], [0.13, 0.48], [0.13, 0.58], [0.05, 0.58]]), "plank");
          blob(c, w, h, f([[0.3, 0.52], [0.36, 0.52], [0.36, 0.58], [0.3, 0.58]]), "plank");
          blob(c, w, h, f([[0.198, 0.18], [0.208, 0.18], [0.208, 0.58], [0.198, 0.58]]), "wood");
          blob(c, w, h, f([[0.208, 0.2], [0.29, 0.27], [0.208, 0.44]]), "leaf");
        };
        ship((p) => p);
        ship(mirror);
        blob(c, w, h, [[0.46, 0.76], [0.48, 0.7], [0.52, 0.69], [0.54, 0.76], [0.55, 1.05], [0.45, 1.05]], "rock");
      }
    },
    moon: {
      n: "\uB2EC\uAE30\uC9C0",
      d: "\uC911\uB825\uC774 \uC808\uBC18\uC778 \uB2EC. \uBC14\uB78C\uC774 \uC5C6\uACE0 \uD3EC\uD0C4\uC774 \uC544\uC8FC \uBA40\uB9AC \uB0A0\uC544\uAC04\uB2E4.",
      tags: ["\uC911\uB825 50%", "\uBC14\uB78C \uC5C6\uC74C", "\uC6B4\uC11D \uC790\uC8FC"],
      grav: 0.5,
      windMax: 0,
      liquid: null,
      spawn: [0.12, 0.88],
      ev: { meteors: 0.5 },
      pal: { soil: ["#b8b8c0", "#6a6a78"], crust: "#dcdce4", steel: "#c8d0dc" },
      sky: { stops: ["#05060f", "#0d1024", "#1a1d3a"], stars: true, planet: [0.78, 0.2, 0.06, "#4f98e0"], far: [["#2a2c40", 0.62, 0.04, 5, 0]] },
      terrain(c, w, h) {
        under(c, w, h, moonY, 0, 1, "soil");
        c.globalCompositeOperation = "destination-out";
        [[0.25, 30], [0.45, 22], [0.68, 34]].forEach(([u, r]) => {
          c.beginPath();
          c.ellipse(u * w, moonY(u) * h + 4, r * w / 960 * 1.6, r * w / 960 * 0.7, 0, 0, TAU2);
          c.fill();
        });
        c.globalCompositeOperation = "source-over";
        [[0.34, 26], [0.58, 20]].forEach(([u, r]) => {
          c.fillStyle = MK.steel;
          c.beginPath();
          c.arc(u * w, moonY(u) * h + 3, r * w / 960, Math.PI, 0);
          c.fill();
        });
      }
    },
    sky: {
      n: "\uAD6C\uB984\uC12C",
      d: "\uD558\uB298\uC5D0 \uB72C \uC12C\uB4E4. \uC544\uB798\uB294 \uB05D\uC5C6\uB294 \uD5C8\uACF5\uC774\uB77C \uBC00\uB824\uB098\uBA74 \uBC14\uB85C \uB099\uC0AC.",
      tags: ["\uB099\uC0AC \uC8FC\uC758", "\uC12C \uC0AC\uC774 \uC774\uB3D9 \uBD88\uAC00"],
      grav: 1,
      windMax: 10,
      liquid: { y: 1.02, type: "void" },
      spawn: [0.13, 0.86],
      ev: { tornado: 0.35, lightning: 0.3 },
      pal: { soil: ["#9a7a58", "#5a4632"], crust: "#9ad66a", rock: ["#8b8aa0", "#55546a"], leaf: "#5aa84a", wood: "#7a4f2c" },
      sky: { stops: ["#5fa8e8", "#9ccff2", "#d6ecf8"], sun: [0.85, 0.14, 0.035, "#ffffff"], clouds: 10 },
      terrain(c, w, h) {
        island(c, w, h, 0.03, 0.5, 0.21, 0.24);
        island(c, w, h, 0.28, 0.63, 0.14, 0.17);
        island(c, w, h, 0.44, 0.41, 0.13, 0.19);
        island(c, w, h, 0.61, 0.6, 0.14, 0.16);
        island(c, w, h, 0.77, 0.48, 0.2, 0.24);
        tree(c, w, h, 0.07, 0.5, 0.7);
        tree(c, w, h, 0.93, 0.48, 0.7);
        tree(c, w, h, 0.5, 0.405, 0.65);
      }
    },
    demo: {
      n: "\uC5F0\uC2B5\uC7A5",
      d: "\uB3C4\uAC10\uC6A9 \uD3C9\uC9C0",
      tags: [],
      grav: 1,
      windMax: 0,
      liquid: null,
      spawn: [0.16, 0.82],
      ev: {},
      pal: { soil: ["#c98b4f", "#6a4228"], crust: "#e8c27a", rock: ["#8a8478", "#55504a"] },
      sky: { stops: ["#f2b880", "#f7d9a8", "#f9e7c4"], sun: [0.82, 0.2, 0.05, "#fff3d6"], far: [["#e2b590", 0.62, 0.05, 8, 0]] },
      terrain(c, w, h) {
        under(c, w, h, (u) => 0.8 + 0.02 * Math.sin(u * 9 + 1), 0, 1, "soil");
      }
    }
  };
  MAPS.castle.backTerrain = MAPS.castle.terrainNoHole;

  // ../shared/sim/raster.js
  var TAU3 = Math.PI * 2;
  var MaskCtx = class {
    constructor(grid, w, h) {
      this.grid = grid;
      this.w = w;
      this.h = h;
      this.fillStyle = 1;
      this.globalCompositeOperation = "source-over";
      this.paths = [];
      this.cur = null;
      this.keep = null;
    }
    beginPath() {
      this.paths = [];
      this.cur = null;
    }
    moveTo(x, y) {
      this.cur = [[x, y]];
      this.paths.push(this.cur);
    }
    lineTo(x, y) {
      if (!this.cur) return this.moveTo(x, y);
      this.cur.push([x, y]);
    }
    closePath() {
      if (this.cur && this.cur.length) this.cur.push([...this.cur[0]]);
    }
    _last() {
      return this.cur && this.cur.length ? this.cur[this.cur.length - 1] : [0, 0];
    }
    quadraticCurveTo(cx, cy, x, y) {
      const [x0, y0] = this._last();
      for (let i = 1; i <= 16; i++) {
        const t = i / 16, u = 1 - t;
        this.lineTo(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y);
      }
    }
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
      const [x0, y0] = this._last();
      for (let i = 1; i <= 20; i++) {
        const t = i / 20, u = 1 - t;
        this.lineTo(u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x, u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y);
      }
    }
    arc(x, y, r, a0, a1, ccw) {
      this.ellipse(x, y, r, r, 0, a0, a1, ccw);
    }
    ellipse(x, y, rx, ry, rot, a0, a1, ccw) {
      let span = a1 - a0;
      if (!ccw && span < 0) span += TAU3 * Math.ceil(-span / TAU3);
      if (ccw && span > 0) span -= TAU3 * Math.ceil(span / TAU3);
      if (Math.abs(span) >= TAU3) span = ccw ? -TAU3 : TAU3;
      const n = Math.max(8, Math.ceil(Math.abs(span) / TAU3 * 48)), cr = Math.cos(rot), sr = Math.sin(rot);
      for (let i = 0; i <= n; i++) {
        const a = a0 + span * i / n, px = Math.cos(a) * rx, py = Math.sin(a) * ry;
        const X = x + px * cr - py * sr, Y = y + px * sr + py * cr;
        i === 0 && !this.cur ? this.moveTo(X, Y) : this.lineTo(X, Y);
      }
    }
    rect(x, y, w, h) {
      this.moveTo(x, y);
      this.lineTo(x + w, y);
      this.lineTo(x + w, y + h);
      this.lineTo(x, y + h);
      this.closePath();
    }
    fillRect(x, y, w, h) {
      const save = this.paths;
      this.paths = [];
      this.rect(x, y, w, h);
      this.fill();
      this.paths = save;
    }
    fill() {
      const v = this.globalCompositeOperation === "destination-out" ? 0 : this.fillStyle;
      fillPolys(this.grid, this.w, this.h, this.paths, v, this.keep);
    }
  };
  function fillPolys(grid, W, H, polys, value, keep) {
    const edges = [];
    let ymin = Infinity, ymax = -Infinity;
    for (const p of polys) for (let i = 0; i + 1 < p.length; i++) {
      const [x0, y02] = p[i], [x1, y12] = p[i + 1];
      if (y02 === y12) continue;
      edges.push(y02 < y12 ? [x0, y02, x1, y12, 1] : [x1, y12, x0, y02, -1]);
      ymin = Math.min(ymin, y02, y12);
      ymax = Math.max(ymax, y02, y12);
    }
    for (const p of polys) if (p.length > 2) {
      const [x0, y02] = p[p.length - 1], [x1, y12] = p[0];
      if ((x0 !== x1 || y02 !== y12) && y02 !== y12) {
        edges.push(y02 < y12 ? [x0, y02, x1, y12, 1] : [x1, y12, x0, y02, -1]);
      }
    }
    const y0 = Math.max(0, Math.floor(ymin)), y1 = Math.min(H - 1, Math.ceil(ymax));
    const xs = [];
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (const e of edges) if (sy >= e[1] && sy < e[3]) xs.push([e[0] + (sy - e[1]) * (e[2] - e[0]) / (e[3] - e[1]), e[4]]);
      if (!xs.length) continue;
      xs.sort((a, b) => a[0] - b[0]);
      let wind = 0;
      for (let i = 0; i < xs.length - 1; i++) {
        wind += xs[i][1];
        if (wind !== 0) {
          const a = Math.max(0, Math.ceil(xs[i][0] - 0.5)), b = Math.min(W - 1, Math.floor(xs[i + 1][0] - 0.5)), row = y * W;
          for (let x = a; x <= b; x++) if (keep == null || grid[row + x] !== keep) grid[row + x] = value;
        }
      }
    }
  }
  var hash2 = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  function raggedPoly(x, y, r, ry, extra = 0) {
    const seed = Math.floor(x * 7 + y * 3), n = 30, pts = [];
    for (let i = 0; i <= n; i++) {
      const a = i / n * TAU3, k = 1 + (hash2(seed + i % n) - 0.5) * 0.18;
      pts.push([x + Math.cos(a) * (r * k + extra), y + Math.sin(a) * (ry * k + extra)]);
    }
    return pts;
  }

  // ../shared/gamedata.js
  var TANK_NAMES = { mole: "\uB450\uB354\uC9C0", hammer: "\uB9DD\uCE58", cloud: "\uAD6C\uB984\uC5F4\uCC28", bee: "\uBD88\uAF43\uBC8C", magnet: "\uC790\uC11D\uD3EC", shroom: "\uBC84\uC12F\uD3EC", whale: "\uC5BC\uC74C\uACE0\uB798", laser: "\uB808\uC774\uC800\uB85C\uBD07", random: "\uB79C\uB364" };
  var TANK_STATS = {
    mole: { hp: 1e3, amin: 0, amax: 70, pivot: [-8, -50], len: 42, w: 96 },
    hammer: { hp: 1200, amin: 20, amax: 60, pivot: [12, -60], len: 46, w: 112 },
    cloud: { hp: 900, amin: 30, amax: 90, pivot: [18, -46], len: 38, w: 92, hover: true },
    bee: { hp: 950, amin: 0, amax: 80, pivot: [40, -32], len: 30, w: 90 },
    magnet: { hp: 1e3, amin: 10, amax: 70, pivot: [30, -46], len: 36, w: 100 },
    shroom: { hp: 1050, amin: 25, amax: 85, pivot: [32, -32], len: 34, w: 96 },
    whale: { hp: 1100, amin: 5, amax: 65, pivot: [14, -60], len: 34, w: 104 },
    laser: { hp: 850, amin: 0, amax: 45, pivot: [-20, -58], len: 44, w: 96 }
  };
  var SHELL_STATS = {
    mole: [{ n: "\uB3CC\uD0C4", dmg: 200, r: 34, cr: 34, wind: 1, wt: 1, R: 24 }, { n: "\uD30C\uD3B8\uD0C4", dmg: 110, r: 24, cr: 20, wind: 1, wt: 1, R: 15, spread: [-1.5, 0, 1.5], pspread: [0.91, 1, 1.09] }, { n: "\uB545\uAD74 \uD3ED\uD0C4", dmg: 380, r: 60, cr: 50, wind: 0.8, wt: 1.1, R: 36, shape: "tunnel", sp: "erupt" }],
    hammer: [{ n: "\uCCA0\uAD6C", dmg: 260, r: 30, cr: 30, wind: 0.5, wt: 1.2, R: 24 }, { n: "\uC9C0\uC9C4\uD0C4", dmg: 230, r: 44, cr: [70, 24], wind: 0.6, wt: 1.2, R: 28, shape: "ellipse" }, { n: "\uBA54\uD14C\uC624", dmg: 480, r: 56, cr: 64, wind: 0.4, wt: 1.3, R: 44, sp: "meteor" }],
    cloud: [{ n: "\uBB3C\uBC29\uC6B8", dmg: 180, r: 30, cr: 18, wind: 1.2, wt: 0.9, R: 22 }, { n: "\uBC88\uAC1C\uAD6C\uB984", dmg: 210, r: 30, cr: 26, wind: 0, wt: 1, R: 24 }, { n: "\uD3ED\uD48D", dmg: 300, r: 70, cr: 20, wind: 1.5, wt: 0.8, R: 40, sp: "tornado" }],
    bee: [{ n: "\uBD88\uC528", dmg: 190, r: 30, cr: 30, wind: 1, wt: 1, R: 22 }, { n: "\uD654\uC5FC\uBCD1", dmg: 160, r: 36, cr: 22, wind: 1, wt: 1, R: 26, fx: "burn" }, { n: "\uBD88\uC0AC\uC870", dmg: 420, r: 50, cr: 48, wind: 0.7, wt: 0.9, R: 40, sp: "phoenix" }],
    magnet: [{ n: "\uC790\uAE30\uD0C4", dmg: 190, r: 30, cr: 30, wind: 1, wt: 1, R: 22 }, { n: "\uB04C\uC5B4\uB2F9\uAE40\uD0C4", dmg: 220, r: 30, cr: 30, wind: 1, wt: 1, R: 24, fx: "home" }, { n: "\uC790\uAE30\uD3ED\uD48D", dmg: 340, r: 64, cr: 40, wind: 0.8, wt: 1, R: 40, sp: "storm" }],
    shroom: [{ n: "\uD3EC\uC790", dmg: 170, r: 30, cr: 26, wind: 1.4, wt: 0.8, R: 22 }, { n: "\uD3EC\uC790\uBE44", dmg: 70, r: 20, cr: 14, wind: 1.4, wt: 0.8, R: 12, spread: [-3, -1.5, 0, 1.5, 3], pspread: [0.84, 0.92, 1, 1.08, 1.16] }, { n: "\uB3C5\uBC84\uC12F\uBC2D", dmg: 240, r: 60, cr: 30, wind: 1, wt: 1, R: 38, sp: "shroom" }],
    whale: [{ n: "\uC5BC\uC74C\uB369\uC774", dmg: 200, r: 32, cr: 30, wind: 0.9, wt: 1.1, R: 24 }, { n: "\uBE59\uACB0\uD0C4", dmg: 150, r: 32, cr: 16, wind: 1, wt: 1, R: 26, fx: "freeze" }, { n: "\uD574\uC77C", dmg: 400, r: 62, cr: 40, wind: 0.6, wt: 1.2, R: 42, sp: "wave" }],
    laser: [{ n: "\uBE54\uD0C4", dmg: 210, r: 28, cr: 28, wind: 0.7, wt: 0.9, R: 22 }, { n: "\uAD00\uD1B5 \uB808\uC774\uC800", dmg: 170, r: 22, cr: 12, wind: 0, wt: 0, R: 20, shape: "line" }, { n: "\uAD81\uADF9 \uBE54", dmg: 500, r: 44, cr: 40, wind: 0, wt: 1, R: 40, sp: "ufo" }]
  };
  var SLOT_DELAY = [0, 60, 120];
  var ITEM_INFO = {
    double: { n: "\uC5F0\uBC1C\uD0C4", delay: 150 },
    power: { n: "\uAC15\uD654\uD0C4", delay: 80 },
    repair: { n: "\uC218\uB9AC\uD0B7", delay: 60 },
    teamrepair: { n: "\uD300 \uC218\uB9AC\uD0B7", delay: 120 },
    teleport: { n: "\uC21C\uAC04\uC774\uB3D9\uD0C4", delay: 100 },
    calm: { n: "\uBC14\uB78C\uC815\uC9C0", delay: 50 },
    shield: { n: "\uBCF4\uD638\uB9C9", delay: 70 },
    fuel: { n: "\uC5F0\uB8CC\uD1B5", delay: 30 }
  };
  var TURN_BASE_DELAY = 100;
  var SUDDEN_DEATH_TURN = 30;

  // ../shared/sim/world.js
  var G0 = 380;
  var SPEED = 6.6;
  var WINDK = 14;
  var DT = 1 / 60;
  var WORLD_W = 1440;
  var WORLD_H = 600;
  var STEEL = MK.steel;
  var LEAF = MK.leaf;
  var WOOD = MK.wood;
  var BASE = /* @__PURE__ */ new Map();
  function baseGrid(mapId, w, h) {
    const key = `${mapId}:${w}x${h}`;
    if (!BASE.has(key)) {
      const g = new Uint8Array(w * h);
      MAPS[mapId].terrain(new MaskCtx(g, w, h), w, h);
      BASE.set(key, g);
    }
    return BASE.get(key).slice();
  }
  var opsHash = (ops) => {
    let h = 0;
    const s = JSON.stringify(ops);
    for (let i = 0; i < s.length; i++) h = h * 31 + s.charCodeAt(i) | 0;
    return h;
  };
  function backGrid(mapId, w, h) {
    const m = MAPS[mapId];
    if (!m.backTerrain) return null;
    const g = new Uint8Array(w * h);
    m.backTerrain(new MaskCtx(g, w, h), w, h);
    return g;
  }
  var r1 = (v) => Math.round(v * 10) / 10;
  var EVENT_INFO = {
    tornado: { n: "\uD68C\uC624\uB9AC", turns: 2 },
    pillar: { n: "\uBD88\uAE30\uB465", turns: 2 },
    meteors: { n: "\uC6B4\uC11D \uC18C\uB098\uAE30", turns: 0 },
    lightning: { n: "\uBCBC\uB77D", turns: 0 }
  };
  var Sim = class {
    constructor({ w = WORLD_W, h = WORLD_H, map = "hills", tankScale = 0.5 } = {}) {
      this.w = w;
      this.h = h;
      this.ts = tankScale;
      this.reset(map);
    }
    get map() {
      return MAPS[this.mapId];
    }
    reset(mapId) {
      if (mapId) this.mapId = mapId;
      this.grid = baseGrid(this.mapId, this.w, this.h);
      this.ops = [];
      this.g = G0 * this.map.grav;
      this.liquidY = this.map.liquid ? this.map.liquid.y * this.h : this.h + 30;
      this.tanks = [];
      this.shells = [];
      this.specials = [];
      this.events = [];
      this.zones = [];
      this.pending = [];
      this.clock = 0;
      this.wind = { ang: 0, str: 0 };
      this.fxq = [];
      this.teleported = false;
    }
    fx(type, d = {}) {
      this.fxq.push({ type, ...d });
    }
    /* ---------- 지형 ---------- */
    solid(x, y) {
      x |= 0;
      y |= 0;
      return x >= 0 && x < this.w && y >= 0 && y < this.h && this.grid[y * this.w + x] !== 0;
    }
    // 탱크가 설 수 있는 땅: 나무(잎·줄기)는 포탄은 막지만 탱크는 그 앞을 지나간다
    stand(x, y) {
      x |= 0;
      y |= 0;
      if (x < 0 || x >= this.w || y < 0 || y >= this.h) return false;
      const m = this.grid[y * this.w + x];
      return m !== 0 && m !== LEAF && m !== WOOD;
    }
    ground(x, from = 0) {
      for (let y = Math.max(0, from | 0); y < this.h; y++) if (this.stand(x, y) || this.stand(x - 7, y) || this.stand(x + 7, y)) return y;
      return this.h + 200;
    }
    applyOp(op) {
      const poly = op.k === "rect" ? [[op.x, op.y], [op.x + op.w, op.y], [op.x + op.w, op.y + op.h], [op.x, op.y + op.h], [op.x, op.y]] : raggedPoly(op.x, op.y, op.r, op.ry);
      fillPolys(this.grid, this.w, this.h, [poly], 0, STEEL);
    }
    carve(op) {
      this.applyOp(op);
      this.ops.push(op);
      this.fx("carve", { op });
    }
    carveRound(x, y, r, ry, scorch = true) {
      this.carve({ k: "round", x: r1(x), y: r1(y), r: r1(r), ry: r1(ry || r), s: scorch ? 1 : 0 });
    }
    carveRect(x, y, w, h) {
      this.carve({ k: "rect", x: r1(x), y: r1(y), w: r1(w), h: r1(h), s: 1 });
    }
    /* ---------- 바람 (ang 0 = 오른쪽, 90 = 위) ---------- */
    windVec() {
      const a = this.wind.ang * Math.PI / 180, s = this.wind.str * WINDK;
      return [Math.cos(a) * s, -Math.sin(a) * s];
    }
    static nextWind(prev, max, rnd = Math.random) {
      if (!max) return { ang: 0, str: 0 };
      let w = { ...prev };
      if (rnd() < 0.18) w = { ang: rnd() * 360, str: rnd() * max };
      else {
        w.ang = (w.ang + (rnd() - 0.5) * 80 + 360) % 360;
        w.str = Math.max(0, Math.min(max, w.str + (rnd() - 0.5) * 5));
      }
      return { ang: Math.round(w.ang), str: Math.round(w.str) };
    }
    /* ---------- 탱크 ---------- */
    addTank({ uid, tankId, x, facing = 1, team = "solo", name = "" }) {
      const S = TANK_STATS[tankId];
      const t = {
        uid,
        tankId,
        S,
        name,
        team,
        x,
        y: 0,
        hp: S.hp,
        max: S.hp,
        angle: Math.min(Math.max(45, S.amin), S.amax),
        facing,
        fuel: 100,
        vx: 0,
        vy: 0,
        air: false,
        fallFrom: 0,
        firedAt: -9,
        hitAt: -9,
        moving: false,
        shield: false,
        frozen: 0,
        canMove: true,
        dead: false,
        sunk: false,
        left: false,
        kills: 0,
        dealt: 0,
        lastHitBy: null,
        delay: 0,
        tilt: 0
      };
      t.y = this.ground(x, 0);
      t.fallFrom = t.y;
      t.tilt = this.slope(t);
      this.clampAngle(t);
      this.tanks.push(t);
      return t;
    }
    tankOf(uid) {
      return this.tanks.find((t) => t.uid === uid);
    }
    // 기울기(도): 탱크 앞쪽이 내려가면 +. 각도 범위는 몸체를 따라 돌아가므로 내리막에선 아래로도 쏠 수 있다
    slope(t) {
      const f = t.facing || 1, gF = this.ground(t.x + f * 12, t.y - 24), gB = this.ground(t.x - f * 12, t.y - 24);
      if (gF > this.h || gB > this.h) return t.tilt || 0;
      return Math.round(Math.max(-35, Math.min(35, Math.atan2(gF - gB, 24) * 180 / Math.PI)));
    }
    angleRange(t) {
      return [t.S.amin - t.tilt, t.S.amax - t.tilt];
    }
    clampAngle(t) {
      const [lo, hi] = this.angleRange(t);
      t.angle = Math.round(Math.max(lo, Math.min(hi, t.angle)));
    }
    enemies(a, b) {
      return a && b && a !== b && (a.team === "solo" || a.team !== b.team);
    }
    kill(t, by) {
      if (t.dead) return;
      t.dead = true;
      t.hp = 0;
      const killer = by ?? this.tankOf(t.lastHitBy);
      if (killer && this.enemies(killer, t)) killer.kills++;
      this.fx("death", { uid: t.uid });
    }
    damage(t, dmg, from, label) {
      if (t.dead) return 0;
      dmg = Math.round(t.shield ? dmg / 2 : dmg);
      if (dmg <= 0) return 0;
      t.hp = Math.max(0, t.hp - dmg);
      t.hitAt = this.clock;
      if (from && from !== t) {
        t.lastHitBy = from.uid;
        if (this.enemies(from, t)) from.dealt += dmg;
      }
      this.fx("float", { x: t.x, y: t.y - 60, text: (label || "") + "-" + dmg, color: "#c92a2a" });
      if (t.hp <= 0) this.kill(t, from && from !== t ? from : null);
      return dmg;
    }
    hurtArea(x, y, R, dmg, from, o = {}) {
      for (const t of this.tanks) {
        if (t.dead) continue;
        let d = Math.hypot(t.x - x, t.y - 18 - y);
        if (o.columnW) d = Math.abs(t.x - x) < o.columnW ? Math.abs(t.x - x) : 1e9;
        if (o.tall && Math.abs(t.x - x) < R && t.y > y - 20 && t.y < y + o.tall + 30) d = Math.abs(t.x - x);
        const RR = R + 12;
        if (d < RR) this.damage(t, dmg * (1 - 0.6 * Math.min(1, d / RR)), from);
      }
    }
    float(x, y, text, color) {
      this.fx("float", { x, y, text, color });
    }
    boom(x, y, o) {
      this.fx("boom", { x, y, ...o });
    }
    muzzle(t) {
      const a = t.angle * Math.PI / 180, sc = this.ts, lift = t.S.hover ? -12 * sc : 0, r = (t.tilt || 0) * Math.PI / 180;
      const [qx, qy] = t.S.pivot, lx = qx * Math.cos(r) - qy * Math.sin(r), ly = qx * Math.sin(r) + qy * Math.cos(r);
      const px = t.x + lx * sc * t.facing, py = t.y + ly * sc + lift, L = t.S.len * sc + 4;
      return [px + Math.cos(a) * L * t.facing, py - Math.sin(a) * L];
    }
    pivotPos(t) {
      const sc = this.ts, r = (t.tilt || 0) * Math.PI / 180, [qx, qy] = t.S.pivot;
      return [t.x + (qx * Math.cos(r) - qy * Math.sin(r)) * sc * t.facing, t.y + (qx * Math.sin(r) + qy * Math.cos(r)) * sc + (t.S.hover ? -12 * sc : 0)];
    }
    move(t, dir, dt) {
      t.facing = dir;
      if (t.fuel <= 0 || !t.canMove || t.air || t.dead) return 0;
      const nx = t.x + dir * 50 * dt;
      if (nx < 12 || nx > this.w - 12) return 0;
      const ny = this.ground(nx, t.y - 14);
      if (ny < t.y - 12) return 0;
      const ahead = this.ground(t.x + dir * 6, t.y - 14);
      if (t.y - ahead > 8.5) return 0;
      t.moving = true;
      t.x = nx;
      if (ny <= t.y + 2) {
        t.y = ny;
        t.fallFrom = ny;
      }
      if (this.map.slip) {
        t.slideV = dir * 55;
        t.lastMove = this.clock;
      }
      const used = 22 * dt * (ny < t.y ? 1.5 : 1);
      t.fuel = Math.max(0, t.fuel - used);
      return used;
    }
    /* ---------- 발사 ---------- */
    fire(t, slot, p, o = {}) {
      const sh = SHELL_STATS[t.tankId][slot];
      t.firedAt = this.clock;
      this.teleported = false;
      const spawn = () => (sh.spread || [0]).forEach((da, i) => {
        const pk = sh.pspread ? sh.pspread[i] : 1;
        const a = (t.angle + da) * Math.PI / 180, v = sh.shape === "line" ? 900 : p * pk * SPEED, [ox, oy] = this.muzzle(t);
        this.shells.push({ x: ox, y: oy, sx: ox, sy: oy, vx: Math.cos(a) * t.facing * v, vy: -Math.sin(a) * v, sh, tankId: t.tankId, slot, owner: t, age: 0, trail: [], mode: "fly", dug: 0, dist: 0, lastCarve: null, k: o.boost || 1, teleport: !!o.teleport });
      });
      spawn();
      if (o.double) this.queued = { wait: 0.4, fn: () => {
        if (t.dead) return;
        t.firedAt = this.clock;
        spawn();
        this.fx("fire", { uid: t.uid, second: true });
      } };
      this.fx("fire", { uid: t.uid });
    }
    hitTank(s) {
      return this.tanks.find((t) => !t.dead && (t !== s.owner || s.age > 0.25) && Math.hypot(t.x - s.x, t.y - 36 * this.ts - s.y) < 40 * this.ts);
    }
    impact(s, x, y, hitTank) {
      s.done = true;
      const sh = s.sh, k = s.k, owner = s.owner;
      const base = { tankId: s.tankId, slot: s.slot, R: sh.R * k };
      if (sh.sp && sh.sp !== "phoenix" && sh.sp !== "erupt") {
        let gy = hitTank ? hitTank.y : this.ground(x, Math.max(0, y - 40));
        if (gy > this.h) gy = y;
        const sp = { type: sh.sp, x, y, gy, t: 0, sh, k, base, owner, side: s.vx >= 0 ? 1 : -1, dir: owner && owner.facing || 1, hit: /* @__PURE__ */ new Set(), done: [], flash: [], wx: x, fired: false };
        if (sh.sp === "tornado") sp.dir = Math.sign(this.windVec()[0]) || sp.dir;
        this.specials.push(sp);
        this.afterHit(s, x, y);
        return;
      }
      if (sh.sp === "erupt") {
        this.specials.push({ type: "erupt", x, y, t: 0, sh, k, base, owner });
        this.afterHit(s, x, y);
        return;
      }
      if (sh.shape === "ellipse") this.carveRound(x, y, sh.cr[0] * k, sh.cr[1] * k);
      else this.carveRound(x, y, sh.cr * k);
      this.boom(x, y, { ...base, debris: Math.round(8 + (Array.isArray(sh.cr) ? sh.cr[0] : sh.cr) * 0.3), shake: Math.min(0.6, sh.r / 90) });
      for (const t of this.tanks) {
        if (t.dead) continue;
        const R = sh.r * k + 12, d = Math.hypot(t.x - x, t.y - 18 - y);
        if (d >= R) continue;
        this.damage(t, sh.dmg * k * (1 - 0.6 * Math.min(1, d / R)), owner);
        if (sh.fx === "freeze" && !t.dead) {
          t.frozen = 1;
          this.float(t.x, t.y - 90, "\uBE59\uACB0!", "#1f6fae");
        }
        if (sh.fx === "push") {
          t.vx = (Math.sign(t.x - x) || 1) * 200;
          t.vy = -220;
          t.air = true;
        }
      }
      if (sh.fx === "burn") this.zones.push({ type: "burn", x: r1(x), r: 40, turns: 2, dmg: 60, born: this.clock, from: owner?.uid });
      if (sh.sp === "phoenix") {
        this.zones.push({ type: "burn", x: r1(x), r: 50, turns: 2, dmg: 60, born: this.clock, from: owner?.uid });
        this.specials.push({ type: "phoenix", x, gy: this.ground(x, Math.max(0, y - 40)), t: 0 });
      }
      this.afterHit(s, x, y);
    }
    afterHit(s, x, y) {
      if (s.teleport && s.owner && !s.owner.dead && !this.teleported) {
        this.teleported = true;
        const t = s.owner;
        t.x = Math.max(14, Math.min(this.w - 14, x));
        t.y = this.ground(t.x, Math.max(0, y - 80));
        t.fallFrom = t.y;
        t.vy = 0;
        this.float(t.x, t.y - 80, "\uC21C\uAC04\uC774\uB3D9!", "#7b2fbf");
      }
    }
    /* ---------- 필살기 진행 (그림은 화면 쪽) ---------- */
    stepSpecial(s, dt) {
      const W = this;
      switch (s.type) {
        case "ufo":
          if (s.t >= 1.45 && !s.fired) {
            s.fired = true;
            const r = s.sh.cr * s.k / 2;
            W.carveRect(s.x - r, 0, r * 2, s.gy + 70);
            W.hurtArea(s.x, s.gy - 20, s.sh.r * s.k, s.sh.dmg * s.k, s.owner, { columnW: r + 14 });
            W.boom(s.x, s.gy, { ...s.base, shake: 0.7 });
          }
          return s.t < 2.7;
        case "meteor":
          if (s.t >= 1.15 && !s.fired) {
            s.fired = true;
            W.carveRound(s.x, s.gy, s.sh.cr * s.k);
            W.hurtArea(s.x, s.gy - 10, s.sh.r * s.k, s.sh.dmg * s.k, s.owner);
            W.boom(s.x, s.gy, { ...s.base, R: s.base.R * 1.2, debris: 26, power: 1.6, shake: 1.1 });
          }
          return s.t < 2;
        case "erupt":
          if (s.t >= 0.7 && !s.fired) {
            s.fired = true;
            W.carveRound(s.x, s.y, s.sh.cr * s.k);
            const top = W.ground(s.x, 0);
            if (top < s.y) W.carveRect(s.x - 12, top - 4, 24, s.y - top + 4);
            W.hurtArea(s.x, Math.min(s.y, top + 10), s.sh.r * s.k + 20, s.sh.dmg * s.k, s.owner, { tall: s.y - top });
            W.boom(s.x, top + 6, { ...s.base, debris: 30, power: 2, shake: 0.8 });
          }
          return s.t < 1.6;
        case "tornado":
          if (s.t < 2.6) {
            s.x += s.dir * 130 * dt;
            s.gy = W.ground(s.x, 0);
          }
          for (const t of W.tanks) {
            if (t.dead || s.hit.has(t)) continue;
            if (Math.abs(t.x - s.x) < 34 && t.y > s.gy - 150) {
              s.hit.add(t);
              W.damage(t, s.sh.dmg * s.k, s.owner);
              t.vy = -420;
              t.vx = s.dir * 190;
              t.air = true;
            }
          }
          return s.t < 3;
        case "storm":
          [0.45, 0.65, 0.85, 1.05, 1.25].forEach((tt, i) => {
            if (s.t >= tt && !s.done[i]) {
              s.done[i] = true;
              const x = s.x + [-50, 30, -15, 55, 0][i] * s.k, gy = W.ground(x, 0);
              s.flash[i] = { x, gy, t: s.t };
              W.carveRound(x, gy, 16 * s.k);
              W.hurtArea(x, gy - 10, 30, s.sh.dmg * s.k / 4.2, s.owner);
              W.boom(x, gy, { kind: "electric", R: 18, color: "#b98cff", shake: 0.25 });
            }
          });
          return s.t < 1.8;
        case "shroom":
          if (s.t >= 0.85 && !s.fired) {
            s.fired = true;
            W.carveRound(s.x, s.gy, s.sh.cr * s.k);
            W.hurtArea(s.x, s.gy - 30, s.sh.r * s.k, s.sh.dmg * s.k, s.owner);
            W.boom(s.x, s.gy - 60, { kind: "toxic", R: 50 * s.k, shake: 0.4 });
            W.zones.push({ type: "poison", x: r1(s.x), r: 80, turns: 3, dmg: 80, born: W.clock, from: s.owner?.uid });
          }
          return s.t < 1.5;
        case "wave":
          if (!s.fired) {
            s.fired = true;
            W.carveRound(s.x, s.gy, s.sh.cr * s.k);
            W.hurtArea(s.x, s.gy - 10, s.sh.r * s.k, s.sh.dmg * s.k * 0.75, s.owner);
            W.boom(s.x, s.gy, s.base);
          }
          s.wx += s.dir * 230 * dt;
          for (const t of W.tanks) {
            if (t.dead || s.hit.has(t) || t === s.owner) continue;
            if (Math.abs(t.x - s.wx) < 30) {
              s.hit.add(t);
              W.damage(t, s.sh.dmg * s.k * 0.25, s.owner);
              t.vx = s.dir * 240;
              t.vy = -260;
              t.air = true;
            }
          }
          return s.t < 1.9;
        case "phoenix":
          return s.t < 1;
      }
      return false;
    }
    /* ---------- 돌발 이벤트 (어떤 이벤트를 어디에 낼지는 서버가 정해서 넘긴다) ---------- */
    static pickEvent(sim, rnd = Math.random) {
      const ev = sim.map.ev || {};
      let r = rnd(), type = null;
      for (const k in ev) {
        r -= ev[k] * 0.45;
        if (r < 0) {
          type = k;
          break;
        }
      }
      if (!type) return null;
      const live = sim.tanks.filter((t) => !t.dead), e = { type, x: Math.round(120 + rnd() * (sim.w - 240)) };
      if (type === "lightning" && live.length) {
        const t = live[Math.floor(rnd() * live.length)];
        e.x = Math.round(t.x + (rnd() - 0.5) * 60);
      }
      if (type === "pillar") for (let i = 0; i < 20; i++) {
        const x = Math.round(60 + rnd() * (sim.w - 120));
        if (sim.ground(x, 0) < sim.liquidY && live.every((t) => Math.abs(t.x - x) > 50)) {
          e.x = x;
          break;
        }
      }
      if (type === "meteors") e.xs = [0, 1, 2].map(() => Math.round(80 + rnd() * (sim.w - 160)));
      return e;
    }
    addEvent(spec) {
      const e = { ...spec, t: 0, turns: EVENT_INFO[spec.type].turns, hit: /* @__PURE__ */ new Set(), done: [] };
      this.events.push(e);
      this.fx("banner", { text: "\uB3CC\uBC1C! " + EVENT_INFO[spec.type].n });
      return e;
    }
    stepEvents(dt) {
      for (const e of this.events) {
        e.t += dt;
        if (e.type === "tornado") e.gy = Math.min(this.ground(e.x, 0), this.liquidY);
        if (e.type === "pillar") {
          e.gy = this.ground(e.x, 0);
          if (e.t > 1 && !e.done[0]) {
            e.done[0] = true;
            this.fx("shake", { v: 0.3 });
          }
        }
        if (e.type === "meteors") e.xs.forEach((x, i) => {
          const tt = 0.4 + i * 0.45;
          if (e.t > tt + 0.7 && !e.done[i]) {
            e.done[i] = true;
            const y = this.ground(x, 0);
            this.carveRound(x, y, 26);
            this.hurtArea(x, y - 10, 26, 90, null);
            this.boom(x, y, { kind: "fire", R: 28, debris: 12, shake: 0.3 });
          }
        });
        if (e.type === "lightning" && e.t > 0.7 && !e.done[0]) {
          e.done[0] = true;
          const y = this.ground(e.x, 0);
          this.carveRound(e.x, y, 18);
          this.hurtArea(e.x, y - 10, 24, 110, null);
          this.boom(e.x, y, { kind: "electric", R: 22, color: "#bfe0ff", shake: 0.35 });
        }
      }
      this.events = this.events.filter((e) => e.type === "meteors" ? e.t < 2.4 : e.type === "lightning" ? e.t < 1.3 : true);
    }
    shellVsEvents(s, dt) {
      for (const e of this.events) {
        const gy = e.gy ?? this.h;
        if (e.type === "tornado" && e.t > 0.5 && s.mode === "fly" && Math.abs(s.x - e.x) < 30 && s.y > gy - 170 && s.y < gy + 4 && !(s.caught && s.caught.includes(e.x))) {
          (s.caught ||= []).push(e.x);
          s.mode = "spin";
          s.spin = { x: e.x, t: 0, ph: s.x < e.x ? Math.PI : 0, r: Math.max(8, Math.abs(s.x - e.x)), top: s.y - 130 };
          this.float(e.x, s.y - 16, "\uD718\uB9D0\uB9BC!", "#3a2600");
          return false;
        }
        if (e.type === "pillar" && e.t > 1 && Math.abs(s.x - e.x) < 18 && s.y > gy - 150 && s.y < gy && !(s.fired && s.fired.includes(e.x))) {
          (s.fired ||= []).push(e.x);
          s.k = Math.round(s.k * 1.3 * 100) / 100;
          s.powered = true;
          this.float(s.x, s.y - 18, "\uD30C\uC6CC\uC5C5!", "#ff6a2a");
        }
      }
      return false;
    }
    spinStep(s, h) {
      const sp = s.spin;
      sp.t += h;
      sp.ph += h * 13;
      sp.r = Math.min(26, sp.r + h * 20);
      const y = s.y - h * 130, x = sp.x + Math.cos(sp.ph) * sp.r;
      s.vx = (x - s.x) / h;
      s.vy = (y - s.y) / h;
      s.x = x;
      s.y = y;
      if (sp.t > 1.1 || s.y < sp.top || s.y < 10) {
        const dir = -Math.sin(sp.ph) >= 0 ? 1 : -1;
        s.vx = dir * 420;
        s.vy = -240;
        s.mode = "fly";
        s.spin = null;
      }
    }
    /* ---------- 턴 ---------- */
    turnStart(t) {
      this.teleported = false;
      this.events.forEach((e) => {
        e.turns--;
        e.hit = /* @__PURE__ */ new Set();
      });
      this.events = this.events.filter((e) => !(e.type === "tornado" || e.type === "pillar") || e.turns > 0);
      for (const z of this.zones) {
        if (!t.dead && Math.abs(t.x - z.x) < z.r) this.damage(t, z.dmg, this.tankOf(z.from), z.type === "burn" ? "\uD654\uC0C1 " : "\uB3C5 ");
        z.turns--;
      }
      this.zones = this.zones.filter((z) => z.turns > 0);
      t.canMove = true;
      t.shield = false;
      t.fuel = 100;
      if (t.frozen > 0) {
        t.frozen--;
        t.canMove = false;
        this.float(t.x, t.y - 90, "\uC5BC\uC5B4\uC11C \uBABB \uC6C0\uC9C1\uC784", "#1f6fae");
      }
    }
    // 서든데스: 30턴 이후 매 턴 물이 12px씩 차오른다 (물이 없는 맵은 맵 아래에서 생긴다)
    suddenDeath() {
      if (!this.map.liquid || this.map.liquid.type === "void") this.sdLiquid = true;
      this.liquidY = Math.min(this.liquidY, this.h) - 12;
      this.fx("banner", { text: "\uC11C\uB4E0\uB370\uC2A4! \uBB3C\uC774 \uCC28\uC624\uB978\uB2E4" });
    }
    /* ---------- 한 프레임 ---------- */
    step(dt = DT) {
      this.clock += dt;
      this.pending.forEach((p) => p.at -= dt);
      this.pending = this.pending.filter((p) => {
        if (p.at <= 0) {
          p.fn();
          return false;
        }
        return true;
      });
      const [wx, wy] = this.windVec(), liquid = this.map.liquid || this.sdLiquid;
      for (const s of this.shells) {
        const sh = s.sh;
        for (let k = 0; k < 4 && !s.done; k++) {
          const h = dt / 4;
          s.age += h;
          if (s.mode === "spin") {
            this.spinStep(s, h);
            continue;
          }
          if (s.mode === "dig") {
            s.x += s.vx * h;
            s.y += s.vy * h;
            s.dug += Math.hypot(s.vx, s.vy) * h;
            if (this.hitTank(s) || s.dug >= 80 || s.y > this.h - 4) {
              this.impact(s, s.x, s.y);
              break;
            }
            continue;
          }
          if (sh.shape !== "line") {
            s.vx += wx * sh.wind * h;
            s.vy += (wy * sh.wind + this.g * sh.wt) * h;
          }
          if (sh.fx === "home") {
            let best = null, bd = 150;
            for (const t of this.tanks) {
              if (t.dead || t === s.owner) continue;
              const d = Math.hypot(t.x - s.x, t.y - 18 - s.y);
              if (d < bd) {
                bd = d;
                best = t;
              }
            }
            if (best) {
              s.vx += (best.x - s.x) / bd * 600 * h;
              s.vy += (best.y - 18 - s.y) / bd * 600 * h;
            }
          }
          s.x += s.vx * h;
          s.y += s.vy * h;
          if (this.shellVsEvents(s, h)) break;
          if (s.x < -300 || s.x > this.w + 300 || s.y > this.h + 40) {
            s.done = true;
            if (liquid && s.y > this.liquidY - 4) this.fx("splash", { x: s.x });
            break;
          }
          if (liquid && this.map.liquid?.type !== "void" && s.y > this.liquidY) {
            s.done = true;
            this.fx("splash", { x: s.x });
            break;
          }
          const ht = this.hitTank(s);
          if (sh.shape === "line") {
            s.dist += 900 * h;
            if (ht) {
              this.impact(s, s.x, s.y, ht);
              break;
            }
            if (this.solid(s.x, s.y) && (!s.lastCarve || Math.hypot(s.x - s.lastCarve[0], s.y - s.lastCarve[1]) > 5)) {
              this.carveRound(s.x, s.y, sh.cr / 2, 0, false);
              s.lastCarve = [s.x, s.y];
            }
            if (s.dist > 1100) s.done = true;
            continue;
          }
          if (ht || this.solid(s.x, s.y)) {
            if (sh.shape === "tunnel" && !ht) {
              s.mode = "dig";
              const sp = Math.hypot(s.vx, s.vy) || 1;
              s.vx = s.vx / sp * 170;
              s.vy = Math.abs(s.vy / sp * 170) + 40;
            } else this.impact(s, s.x, s.y, ht);
          }
        }
        if (s.mode === "dig" && !s.done) this.carveRound(s.x, s.y, 10, 0, false);
        s.trail.unshift([s.x, s.y]);
        if (s.trail.length > 12) s.trail.pop();
      }
      this.shells = this.shells.filter((s) => !s.done);
      this.specials = this.specials.filter((s) => {
        s.t += dt;
        return this.stepSpecial(s, dt);
      });
      if (this.queued && !this.shells.length && !this.specials.length && !this.tanks.some((t) => !t.sunk && !t.left && (t.air || this.ground(t.x, t.y - 3) > t.y + 1))) {
        this.queued.wait -= dt;
        if (this.queued.wait <= 0) {
          const q = this.queued;
          this.queued = null;
          q.fn();
        }
      }
      this.stepEvents(dt);
      for (const t of this.tanks) {
        t.moving = false;
        this.settle(t, dt);
      }
    }
    settle(t, dt) {
      if (t.sunk || t.left) return true;
      const g = this.ground(t.x, t.y - 3);
      if (t.air || g > t.y + 1) {
        t.vy += 900 * dt;
        t.x += t.vx * dt;
        if (t.x < 10 || t.x > this.w - 10) {
          t.x = Math.max(10, Math.min(this.w - 10, t.x));
          t.vx = 0;
        }
        const ny = t.y + t.vy * dt;
        if (t.vy > 0) {
          const land = this.ground(t.x, t.y - 3);
          if (ny >= land && land < this.h && land < this.liquidY + 6) {
            t.y = land;
            t.air = false;
            t.vx = 0;
            const fall = t.y - t.fallFrom;
            if (fall > 40) this.damage(t, fall * 1.2, null, "\uB099\uD558 ");
            t.vy = 0;
            t.fallFrom = t.y;
            t.tilt = this.slope(t);
            this.clampAngle(t);
            return true;
          }
        }
        t.y = ny;
        if (t.y > this.liquidY + 6 || t.y > this.h + 20) {
          t.sunk = true;
          this.float(t.x, Math.min(this.liquidY, this.h) - 30, "\uB099\uC0AC!", "#c92a2a");
          if (this.map.liquid && this.map.liquid.type !== "void" || this.sdLiquid) this.fx("splash", { x: t.x });
          this.kill(t, null);
          return true;
        }
        return false;
      }
      t.y = g;
      t.vy = 0;
      t.fallFrom = t.y;
      if (this.map.slip && !t.dead && this.clock - (t.lastMove ?? -9) > dt * 1.5) this.slide(t, dt);
      if (!t.dead) {
        const tl = this.slope(t);
        if (tl !== t.tilt) {
          t.tilt = tl;
          this.clampAngle(t);
        }
      }
      if (t.y > this.liquidY + 6 && !t.dead) {
        t.sunk = true;
        this.float(t.x, this.liquidY - 30, "\uB099\uC0AC!", "#c92a2a");
        this.kill(t, null);
      }
      return true;
    }
    // 얼음: 멈춘 뒤에도 미끄러지고, 비탈에서는 아래로 밀린다
    slide(t, dt) {
      const down = Math.sin((t.tilt || 0) * Math.PI / 180) * (t.facing || 1);
      t.slideV = ((t.slideV || 0) + down * 160 * dt) * (1 - 1.6 * dt);
      if (Math.abs(t.slideV) < 2 && Math.abs(down) < 0.12) {
        t.slideV = 0;
        return;
      }
      const nx = t.x + t.slideV * dt;
      if (nx < 12 || nx > this.w - 12) {
        t.slideV = 0;
        return;
      }
      const ny = this.ground(nx, t.y - 14);
      if (ny < t.y - 6) {
        t.slideV = 0;
        return;
      }
      t.x = nx;
      if (ny <= t.y + 2) {
        t.y = ny;
        t.fallFrom = ny;
      }
    }
    busy() {
      return this.shells.length > 0 || this.pending.length > 0 || !!this.queued || this.specials.length > 0 || this.tanks.some((t) => !t.sunk && !t.left && (t.air || this.ground(t.x, t.y - 3) > t.y + 1)) || this.events.some((e) => e.type === "meteors" && e.t < 2.4 || e.type === "lightning" && e.t < 1.3 || e.type === "pillar" && e.t < 1.6);
    }
    /* ---------- 아이템 (즉시 효과는 여기서, 발사에 붙는 효과는 표시만) ---------- */
    useItem(t, id) {
      const heal = (x, n) => {
        if (x.dead) return;
        x.hp = Math.min(x.max, x.hp + n);
        this.float(x.x, x.y - 60, "+" + n, "#2f9e44");
      };
      if (id === "repair") heal(t, 250);
      if (id === "teamrepair") this.tanks.filter((x) => x === t || t.team !== "solo" && x.team === t.team).forEach((x) => heal(x, 150));
      if (id === "calm") this.wind = { ...this.wind, str: 0 };
      if (id === "shield") t.shield = true;
      if (id === "fuel") t.fuel = 200;
      this.fx("item", { uid: t.uid, id });
    }
    /* ---------- 동기화 ---------- */
    snapshot() {
      return {
        clock: this.clock,
        wind: { ...this.wind },
        liquidY: this.liquidY,
        sdLiquid: !!this.sdLiquid,
        ops: this.ops.length,
        tanks: this.tanks.map((t) => ({ uid: t.uid, x: t.x, y: t.y, vx: t.vx, vy: t.vy, air: t.air, fallFrom: t.fallFrom, hp: t.hp, angle: t.angle, facing: t.facing, fuel: t.fuel, tilt: t.tilt, shield: t.shield, frozen: t.frozen, canMove: t.canMove, dead: t.dead, sunk: t.sunk, left: t.left, kills: t.kills, dealt: t.dealt, lastHitBy: t.lastHitBy, delay: t.delay })),
        events: this.events.map((e) => ({ type: e.type, x: e.x, xs: e.xs, gy: e.gy, t: e.t, turns: e.turns, done: e.done })),
        zones: this.zones.map((z) => ({ ...z }))
      };
    }
    restore(s) {
      this.clock = s.clock;
      this.wind = { ...s.wind };
      this.liquidY = s.liquidY;
      this.sdLiquid = s.sdLiquid;
      for (const d of s.tanks) {
        const t = this.tankOf(d.uid);
        if (t) Object.assign(t, d);
      }
      this.events = s.events.map((e) => ({ ...e, hit: /* @__PURE__ */ new Set(), done: [...e.done || []] }));
      this.zones = s.zones.map((z) => ({ ...z }));
      this.shells = [];
      this.specials = [];
      this.pending = [];
      this.queued = null;
    }
    // 바람·지형을 반영해 목표 x에 닿는 파워 (도움말·테스트용)
    solvePower(t, slot, targetX, withWind = true) {
      const sh = SHELL_STATS[t.tankId][slot], [wx, wy] = withWind ? this.windVec() : [0, 0];
      const land = (p) => {
        const a = t.angle * Math.PI / 180, [ox, oy] = this.muzzle(t);
        let x = ox, y = oy, vx = Math.cos(a) * t.facing * p * SPEED, vy = -Math.sin(a) * p * SPEED;
        for (let i = 0; i < 900; i++) {
          const h = 1 / 120;
          vx += wx * sh.wind * h;
          vy += (wy * sh.wind + this.g * sh.wt) * h;
          x += vx * h;
          y += vy * h;
          if (vy > 0 && (this.solid(x, y) || y > this.h)) return x;
        }
        return x;
      };
      let lo = 5, hi = 100;
      const want = (targetX - t.x) * t.facing;
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2, got = (land(mid) - t.x) * t.facing;
        if (got < want) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    }
  };
  function spawnPositions(sim, players, rnd = Math.random) {
    const top = (x) => {
      for (let y = 0; y < sim.h; y++) {
        const m = sim.grid[y * sim.w + x];
        if (m) return m;
      }
      return 0;
    };
    const tree2 = (x) => [x - 7, x, x + 7].some((xx) => xx >= 0 && xx < sim.w && (top(xx) === MK.leaf || top(xx) === MK.wood));
    const cands = [];
    for (let x = 30; x < sim.w - 30; x += 6) {
      const g = sim.ground(x, 0);
      if (g < sim.h - 10 && g < sim.liquidY - 20 && !tree2(x)) cands.push(x);
    }
    const used = [], pick = (target) => {
      let best = null, bd = 1e9;
      for (const x of cands) {
        if (used.some((u) => Math.abs(u - x) < 70)) continue;
        const d = Math.abs(x - target);
        if (d < bd) {
          bd = d;
          best = x;
        }
      }
      if (best == null) best = cands[Math.floor(rnd() * cands.length)] ?? sim.w / 2;
      used.push(best);
      return best;
    };
    const out = {}, [L, R] = sim.map.spawn;
    const place = (list, a, b) => list.forEach((p, i) => {
      const u = list.length === 1 ? (a + b) / 2 : a + (b - a) * i / (list.length - 1);
      out[p.userId] = pick(u * sim.w + (rnd() - 0.5) * 30);
    });
    if (players.some((p) => p.team === "red")) {
      place(players.filter((p) => p.team === "red"), Math.max(0.04, L - 0.1), Math.min(0.45, L + 0.22));
      place(players.filter((p) => p.team === "blue"), Math.max(0.55, R - 0.22), Math.min(0.96, R + 0.1));
    } else place(players, Math.max(0.04, L - 0.08), Math.min(0.96, R + 0.08));
    return out;
  }

  // src/bot.js
  function botTurn(g, uid, rnd = Math.random) {
    const sim = g.sim, me = sim.tankOf(uid), p = g.player(uid);
    const foes = sim.tanks.filter((t) => !t.dead && sim.enemies(me, t)).sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x));
    const foe = foes[0];
    if (!foe) return g.onPass(uid);
    const pick = (id) => p.items.findIndex((i) => !i.used && i.id === id);
    let k = -1;
    if (me.hp < me.max * 0.55) k = pick("repair") >= 0 ? pick("repair") : pick("teamrepair");
    if (k < 0 && rnd() < 0.3) k = p.items.findIndex((i) => !i.used && ["power", "double", "shield"].includes(i.id) && !p.flags[i.id]);
    if (k >= 0) {
      try {
        g.onItem(uid, k);
      } catch {
      }
    }
    me.facing = Math.sign(foe.x - me.x) || me.facing;
    const slot = !p.ssUsed && me.hp <= me.max / 2 && rnd() < 0.6 ? 2 : rnd() < 0.7 ? 0 : 1, sh = SHELL_STATS[me.tankId][slot];
    if (sh.shape === "line") {
      g.onAim(uid, Math.atan2(me.y - 20 - (foe.y - 18), Math.abs(foe.x - me.x)) * 180 / Math.PI);
      return g.onFire(uid, slot, 60);
    }
    const [lo, hi] = sim.angleRange(me);
    g.onAim(uid, Math.max(lo, Math.min(hi, 40 + rnd() * 12)));
    const pw = sim.solvePower(me, slot, foe.x, true) + (rnd() * 10 - 5);
    g.onFire(uid, slot, Math.max(10, Math.min(100, pw)));
  }

  // src/game.js
  var shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  var GameSession = class {
    constructor(setup, { send, onOver, now: now2 = () => Date.now() }) {
      this.setup = setup;
      this.send = send;
      this.onOver = onOver;
      this.now = now2;
      this.sim = new Sim({ map: setup.mapId });
      const players = shuffle([...setup.players]);
      const pos = spawnPositions(this.sim, players);
      this.players = players.map((p, i) => {
        const facing = p.team === "blue" ? -1 : p.team === "red" ? 1 : pos[p.userId] < this.sim.w / 2 ? 1 : -1;
        const t = this.sim.addTank({ uid: p.userId, tankId: p.tankId, x: pos[p.userId], facing, team: p.team, name: p.nickname });
        t.delay = i;
        return { uid: p.userId, nickname: p.nickname, team: p.team, tankId: p.tankId, x: t.x, facing, items: p.items.map((id) => ({ id, used: false })), ssUsed: false, flags: {}, bot: !!p.bot };
      });
      this.turnNo = 0;
      this.cur = null;
      this.phase = "starting";
      this.moveDir = 0;
      this.lastPos = 0;
      this.dirty = false;
      this.wait = 1.5;
      this.sim.wind = Sim.nextWind({ ang: 180, str: 3 }, this.sim.map.windMax);
    }
    player(uid) {
      return this.players.find((p) => p.uid === uid);
    }
    startInfo() {
      return {
        roomId: this.setup.roomId,
        mapId: this.setup.mapId,
        mode: this.setup.mode,
        turnSeconds: this.setup.turnSeconds,
        players: this.players.map((p) => ({ uid: p.uid, nickname: p.nickname, team: p.team, tankId: p.tankId, x: p.x, facing: p.facing, items: p.items.map((i) => i.id), bot: p.bot }))
      };
    }
    fullState(uid) {
      const me = this.player(uid);
      return { start: this.startInfo(), ops: this.sim.ops, snapshot: this.sim.snapshot(), turn: this.turnInfo(), bag: me ? me.items : [], ssUsed: me?.ssUsed, flags: me ? me.flags : {}, phase: this.phase };
    }
    turnInfo() {
      return this.cur ? { turnNo: this.turnNo, uid: this.cur.uid, left: Math.max(0, (this.deadline - this.now()) / 1e3), seconds: this.setup.turnSeconds, order: this.order() } : null;
    }
    /* ---------- 진행 ---------- */
    tick(dt) {
      if (this.phase === "over") return;
      const sim = this.sim;
      if (this.phase === "aim" && this.cur?.bot) {
        this.botWait -= dt;
        if (this.botWait <= 0) {
          this.botWait = Infinity;
          try {
            botTurn(this, this.cur.uid);
          } catch (e) {
            try {
              this.onPass(this.cur.uid);
            } catch {
            }
          }
        }
      }
      if (this.phase === "aim" && this.moveDir) {
        const t = sim.tankOf(this.cur.uid);
        const used = sim.move(t, this.moveDir, dt);
        if (used) {
          this.moveUsed += used;
          this.dirty = true;
        }
      }
      sim.step(dt);
      sim.fxq.length = 0;
      if (this.phase === "aim") {
        const t = sim.tankOf(this.cur.uid);
        if (t.dead) return this.endTurn();
        if (Math.abs(t.x - (this.sentX ?? t.x)) > 0.5 || Math.abs(t.y - (this.sentY ?? t.y)) > 0.5) this.dirty = true;
        if (this.dirty && this.now() - this.lastPos > 50) {
          this.sentX = t.x;
          this.sentY = t.y;
          this.lastPos = this.now();
          this.dirty = false;
          this.send("game:pos", { uid: t.uid, x: t.x, y: t.y, facing: t.facing, fuel: t.fuel, angle: t.angle, tilt: t.tilt, moving: !!this.moveDir });
        }
        if (this.now() > this.deadline) {
          this.send("game:timeout", { uid: t.uid });
          t.delay += TURN_BASE_DELAY + this.turnState.itemDelay + Math.round(this.moveUsed);
          this.endTurn();
        }
      } else if (this.phase === "resolve") {
        if (!sim.busy()) {
          this.phase = "between";
          this.wait = 0.5;
        }
      } else if (this.phase === "between" || this.phase === "starting") {
        if (!sim.busy()) {
          this.wait -= dt;
          if (this.wait <= 0) {
            this.phase === "starting" ? this.nextTurn() : this.endTurn(true);
          }
        }
      }
    }
    alive() {
      return this.sim.tanks.filter((t) => !t.dead && !t.left);
    }
    overCheck() {
      const live = this.alive();
      if (this.setup.mode === "team") {
        const teams = new Set(live.map((t) => t.team));
        if (teams.size <= 1) return { winnerTeam: [...teams][0] || null };
      } else if (live.length <= 1) return { winnerTeam: live[0] ? "uid:" + live[0].uid : null };
      return null;
    }
    endTurn(afterResolve) {
      this.moveDir = 0;
      const res = this.overCheck();
      if (res) return this.finish(res);
      this.send("game:sync", { snapshot: this.sim.snapshot(), ops: this.sim.ops.length, hash: opsHash(this.sim.ops) });
      this.nextTurn();
    }
    nextTurn() {
      const sim = this.sim, live = this.alive().sort((a, b) => a.delay - b.delay || this.players.findIndex((p) => p.uid === a.uid) - this.players.findIndex((p) => p.uid === b.uid));
      if (!live.length) return this.finish({ winnerTeam: null });
      const t = live[0];
      this.turnNo++;
      this.cur = this.player(t.uid);
      sim.turnStart(t);
      if (this.turnNo > 1) sim.wind = Sim.nextWind(sim.wind, sim.map.windMax);
      let event = null;
      if (this.turnNo > 2) {
        event = Sim.pickEvent(sim);
        if (event) sim.addEvent(event);
      }
      const sd = this.turnNo > SUDDEN_DEATH_TURN;
      if (sd) sim.suddenDeath();
      sim.fxq.length = 0;
      this.turnState = { itemUsed: false, flags: {}, itemDelay: 0 };
      this.moveUsed = 0;
      this.moveDir = 0;
      this.deadline = this.now() + this.setup.turnSeconds * 1e3 + 500;
      this.phase = "aim";
      this.botWait = 1.4;
      this.send("game:turn", { turnNo: this.turnNo, uid: t.uid, seconds: this.setup.turnSeconds, wind: sim.wind, event, sd, snapshot: sim.snapshot(), order: this.order(), flags: this.cur.flags });
      if (t.dead) this.endTurn();
    }
    order() {
      return this.alive().sort((a, b) => a.delay - b.delay).map((t) => t.uid);
    }
    /* ---------- 입력 ---------- */
    isTurn(uid) {
      return this.phase === "aim" && this.cur && this.cur.uid === uid;
    }
    onMove(uid, dir) {
      if (!this.isTurn(uid)) return;
      this.moveDir = [-1, 0, 1].includes(dir) ? dir : 0;
      if (!this.moveDir) this.dirty = true;
    }
    onAim(uid, angle) {
      if (!this.isTurn(uid)) return;
      const t = this.sim.tankOf(uid);
      if (typeof angle !== "number" || !isFinite(angle)) return;
      t.angle = Math.round(angle);
      this.sim.clampAngle(t);
      this.dirty = true;
    }
    onItem(uid, index) {
      if (!this.isTurn(uid)) throw new Error("\uC9C0\uAE08\uC740 \uB0B4 \uCC28\uB840\uAC00 \uC544\uB2C8\uC5D0\uC694.");
      if (this.turnState.itemUsed) throw new Error("\uC544\uC774\uD15C\uC740 \uD134\uB9C8\uB2E4 \uD558\uB098\uB9CC \uC4F8 \uC218 \uC788\uC5B4\uC694.");
      const p = this.player(uid), it = p.items[index];
      if (!it || it.used) throw new Error("\uC4F8 \uC218 \uC5C6\uB294 \uC544\uC774\uD15C\uC774\uC5D0\uC694.");
      const fireItem = ["double", "power", "teleport"].includes(it.id);
      if (fireItem && p.flags[it.id]) throw new Error("\uC774\uBBF8 \uAC78\uB824 \uC788\uB294 \uD6A8\uACFC\uC608\uC694. \uB2E4\uC74C \uBC1C\uC0AC\uC5D0 \uD568\uAED8 \uB098\uAC00\uC694.");
      it.used = true;
      this.turnState.itemUsed = true;
      this.turnState.itemDelay = ITEM_INFO[it.id].delay;
      const t = this.sim.tankOf(uid);
      if (fireItem) p.flags[it.id] = true;
      else this.sim.useItem(t, it.id);
      this.sim.fxq.length = 0;
      this.send("game:item", { uid, index, id: it.id, flags: p.flags, snapshot: this.sim.snapshot() });
    }
    onFire(uid, slot, power) {
      if (!this.isTurn(uid)) throw new Error("\uC9C0\uAE08\uC740 \uB0B4 \uCC28\uB840\uAC00 \uC544\uB2C8\uC5D0\uC694.");
      const t = this.sim.tankOf(uid), p = this.player(uid);
      if (![0, 1, 2].includes(slot)) throw new Error("\uC5C6\uB294 \uD3EC\uD0C4\uC774\uC5D0\uC694.");
      if (slot === 2 && (p.ssUsed || t.hp > t.max / 2)) throw new Error("\uD544\uC0B4\uAE30\uB294 \uCCB4\uB825 50% \uC774\uD558\uC5D0\uC11C \uD55C \uBC88\uB9CC \uC4F8 \uC218 \uC788\uC5B4\uC694.");
      if (slot === 2) p.ssUsed = true;
      power = Math.max(1, Math.min(100, Number(power) || 0));
      const f = p.flags, opts = { boost: f.power ? 1.3 : 1, double: !!f.double, teleport: !!f.teleport };
      p.flags = {};
      this.moveDir = 0;
      const snapshot = this.sim.snapshot();
      this.sim.fire(t, slot, power, opts);
      t.delay += TURN_BASE_DELAY + SLOT_DELAY[slot] + this.turnState.itemDelay + Math.round(this.moveUsed);
      this.phase = "resolve";
      this.send("game:shot", { uid, slot, power, angle: t.angle, opts, snapshot });
    }
    onPass(uid) {
      if (!this.isTurn(uid)) throw new Error("\uC9C0\uAE08\uC740 \uB0B4 \uCC28\uB840\uAC00 \uC544\uB2C8\uC5D0\uC694.");
      const t = this.sim.tankOf(uid);
      t.delay += TURN_BASE_DELAY + this.turnState.itemDelay + Math.round(this.moveUsed);
      this.send("game:pass", { uid });
      this.endTurn();
    }
    playerLeft(uid) {
      const t = this.sim.tankOf(uid);
      if (!t || t.left) return;
      t.left = true;
      this.sim.kill(t, null);
      this.sim.fxq.length = 0;
      this.send("game:left", { uid });
      if (this.phase === "aim" && this.cur?.uid === uid) this.endTurn();
      else {
        const res = this.overCheck();
        if (res && this.phase !== "over") this.finish(res);
      }
    }
    finish({ winnerTeam }) {
      if (this.phase === "over") return;
      this.phase = "over";
      const results = this.players.map((p) => {
        const t = this.sim.tankOf(p.uid);
        const win = winnerTeam != null && (winnerTeam === p.team || winnerTeam === "uid:" + p.uid);
        return { uid: p.uid, nickname: p.nickname, team: p.team, tankId: p.tankId, kills: t.kills, dealt: t.dealt, alive: !t.dead, sunk: t.sunk, left: t.left, win };
      });
      this.send("game:over", { winnerTeam, turns: this.turnNo, results, snapshot: this.sim.snapshot() });
      this.onOver?.({ winnerTeam, results, mapId: this.setup.mapId, mode: this.setup.mode });
    }
  };

  // ../client/js/render.js
  var hex3 = (s) => {
    const n = parseInt(s.slice(1), 16);
    return [n >> 16, n >> 8 & 255, n & 255];
  };
  var mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  var ease = (u) => u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u);
  var lerp = (a, b, k) => a + (b - a) * k;
  function hash22(x, y) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0;
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
  }
  function palette(m) {
    const p = m.pal, two = (v, d) => Array.isArray(v) ? [hex3(v[0]), hex3(v[1])] : v ? [hex3(v), hex3(v).map((x) => x * 0.6)] : d;
    const s = two(p.soil, [[176, 122, 72], [94, 58, 34]]), r = two(p.rock, [[138, 132, 120], [85, 80, 74]]), i = two(p.ice, [[216, 242, 255], [120, 184, 220]]);
    return { soil0: s[0], soil1: s[1], rock0: r[0], rock1: r[1], ice0: i[0], ice1: i[1], crust: p.crust ? hex3(p.crust) : null, steel0: hex3(p.steel || "#9aa4b2"), leaf0: hex3(p.leaf || "#4f9e3c"), wood0: hex3(p.wood || "#7a4f2c"), cap0: hex3(p.cap || "#e5487a"), plank0: hex3(p.plank || "#a0703f") };
  }
  function shadeMat(m, d, x, y, P, out) {
    let c, k = 1;
    const n = hash22(x >> 1, y >> 1) - 0.5, n2 = hash22(x >> 3, y >> 3) - 0.5;
    if (m === "soil") {
      c = mix3(P.soil0, P.soil1, Math.min(1, d / 150));
      k = 1 + 0.07 * Math.sin(y * 0.2 + n2 * 4) + n * 0.12;
      if (hash22(x >> 2, y >> 2) > 0.975) k *= 0.72;
      if (P.crust && d < 7) {
        c = P.crust;
        k = (d < 2 ? 1.08 : d > 5 ? 0.76 : 1) + n * 0.1;
      }
    } else if (m === "rock") {
      c = mix3(P.rock0, P.rock1, Math.min(1, d / 120));
      k = 1 + 0.12 * Math.sin(y * 0.35 + n2 * 6) + n * 0.14;
      if (hash22(x >> 2, y >> 1) > 0.97) k *= 0.7;
    } else if (m === "steel") {
      c = P.steel0;
      const sx = x % 48, sy = y % 24;
      k = sx < 2 || sy < 2 ? 0.62 : 1 + n * 0.05;
      if ((sx - 6) ** 2 + (sy - 7) ** 2 < 4 || (sx - 42) ** 2 + (sy - 7) ** 2 < 4) k = 1.3;
      if (d < 2) k *= 1.2;
    } else if (m === "leaf") {
      c = P.leaf0;
      k = 0.8 + hash22(x >> 3, y >> 3) * 0.35 + n * 0.12;
      if (d < 3) k *= 1.15;
    } else if (m === "wood") {
      c = P.wood0;
      k = 1 + 0.1 * Math.sin(x * 0.9 + n2 * 3) + n * 0.08;
    } else if (m === "cap") {
      c = P.cap0;
      const cx = Math.floor(x / 26), cy = Math.floor(y / 20), ox = cx * 26 + 6 + hash22(cx, cy) * 14, oy = cy * 20 + 4 + hash22(cy, cx) * 12;
      if ((x - ox) ** 2 + (y - oy) ** 2 < 22) c = [255, 244, 247];
      k = 1 + n * 0.06 - Math.min(0.3, d / 60);
    } else if (m === "plank") {
      c = P.plank0;
      k = (y % 9 < 1 ? 0.62 : 1) + 0.07 * Math.sin(x * 0.35 + n2 * 4) + n * 0.06;
      if (d < 2) k *= 1.15;
    } else {
      c = mix3(P.ice0, P.ice1, Math.min(1, d / 70));
      k = 1 + 0.08 * Math.sin((x + y) * 0.12) + n * 0.05;
      if (P.crust && d < 6) {
        c = P.crust;
        k = d > 4 ? 0.86 : 1;
      }
    }
    out[0] = Math.min(255, c[0] * k);
    out[1] = Math.min(255, c[1] * k);
    out[2] = Math.min(255, c[2] * k);
  }
  function skyPaint(c, w, h, o) {
    const g = c.createLinearGradient(0, 0, 0, h);
    o.stops.forEach((col, i) => g.addColorStop(i / (o.stops.length - 1), col));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    if (o.stars) for (let i = 0; i < 160; i++) {
      c.fillStyle = `rgba(255,255,255,${0.25 + hash(i) * 0.75})`;
      const s = hash(i + 5) > 0.9 ? 2 : 1.2;
      c.fillRect(hash(i + 1) * w, hash(i + 2) * h * 0.85, s, s);
    }
    if (o.sun) {
      const [u, v, r, col] = o.sun, R = r * w;
      const sg = c.createRadialGradient(u * w, v * h, 0, u * w, v * h, R * 3);
      sg.addColorStop(0, rgba(col, 0.6));
      sg.addColorStop(1, rgba(col, 0));
      c.fillStyle = sg;
      c.fillRect(0, 0, w, h);
      c.fillStyle = col;
      circ(c, u * w, v * h, R);
      c.fill();
    }
    if (o.planet) {
      const [u, v, r, col] = o.planet, R = r * w, x = u * w, y = v * h;
      const pg = c.createRadialGradient(x - R * 0.4, y - R * 0.4, R * 0.1, x, y, R);
      pg.addColorStop(0, "#bfe6ff");
      pg.addColorStop(0.6, col);
      pg.addColorStop(1, "#1d3f7a");
      c.fillStyle = pg;
      circ(c, x, y, R);
      c.fill();
      c.fillStyle = "rgba(120,200,120,.5)";
      ell(c, x - R * 0.2, y, R * 0.35, R * 0.2, 0.4);
      c.fill();
    }
    if (o.extra) o.extra(c, w, h);
    (o.far || []).forEach(([col, base, amp, f, ph]) => {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) {
        const u = x / w;
        c.lineTo(x, (base + amp * Math.sin(u * f + ph) + amp * 0.4 * Math.sin(u * f * 2.7 + ph * 2)) * h);
      }
      c.lineTo(w, h);
      c.fill();
    });
    for (let i = 0; i < (o.clouds || 0); i++) {
      const x = hash(i + 9) * w, y = (0.06 + hash(i + 3) * 0.3) * h, k = (0.6 + hash(i) * 0.8) * w / 960;
      c.fillStyle = o.cloudCol || "rgba(255,255,255,.72)";
      [[0, 0, 40, 12], [26, -8, 26, 12], [-22, -4, 22, 10]].forEach(([dx, dy, rx, ry]) => {
        ell(c, x + dx * k, y + dy * k, rx * k, ry * k);
        c.fill();
      });
    }
  }
  function drawUFO(c, x, y, t, glow) {
    c.save();
    c.translate(x, y);
    if (glow) {
      const g = c.createRadialGradient(0, 14, 2, 0, 14, 60 * glow);
      g.addColorStop(0, "rgba(160,250,255,.9)");
      g.addColorStop(1, "rgba(47,224,255,0)");
      c.fillStyle = g;
      circ(c, 0, 14, 60 * glow);
      c.fill();
    }
    ell(c, 0, -8, 22, 18);
    fs(c, vg(c, -26, 4, "rgba(220,255,255,.95)", "rgba(60,200,230,.85)"), 2.5);
    c.fillStyle = "rgba(255,255,255,.7)";
    ell(c, -7, -16, 6, 3, -0.4);
    c.fill();
    ell(c, 0, 4, 52, 13);
    fs(c, vg(c, -9, 17, "#f2f5fa", "#a6b0c0", "#5d6878"), 2.8);
    ell(c, 0, 12, 22, 5);
    fs(c, "#4c5563", 2);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.9 + i * Math.PI * 0.3 / 1, px = Math.cos(i / 7 * TAU + t * 3) * 44, on = Math.sin(i / 7 * TAU + t * 3) > 0;
      if (!on) continue;
      circ(c, px, 6, 3);
      c.fillStyle = ["#ff5d5d", "#ffd34d", "#7fe36b", "#2fe0ff"][i % 4];
      c.fill();
    }
    c.restore();
  }
  function drawTornado(c, x, gy, H, t, a = 1, col = "230,236,240") {
    c.save();
    c.globalAlpha = a;
    for (let i = 0; i < 14; i++) {
      const k = i / 13, y = gy - k * H, r = 6 + k * k * 44 + Math.sin(t * 9 + i) * 2, sx = x + Math.sin(t * 4 + k * 5) * 10 * k;
      c.beginPath();
      c.ellipse(sx, y, r, 4 + k * 5, 0, t * 10 + i, t * 10 + i + 4.4);
      c.strokeStyle = `rgba(${col},${0.35 + 0.5 * (1 - k)})`;
      c.lineWidth = 3.5;
      c.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const p = (t * 1.3 + i / 8) % 1, ang = t * 12 + i * 2, r = 8 + p * 40;
      c.fillStyle = `rgba(140,110,80,${(1 - p) * 0.9})`;
      c.fillRect(x + Math.cos(ang) * r, gy - p * H * 0.8, 3, 3);
    }
    c.restore();
  }
  function drawPillar(c, x, gy, H, t, a = 1) {
    c.save();
    c.globalAlpha = a;
    const g = c.createLinearGradient(x - 18, 0, x + 18, 0);
    g.addColorStop(0, "rgba(255,90,30,0)");
    g.addColorStop(0.3, "rgba(255,120,40,.85)");
    g.addColorStop(0.5, "rgba(255,240,170,.95)");
    g.addColorStop(0.7, "rgba(255,120,40,.85)");
    g.addColorStop(1, "rgba(255,90,30,0)");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - 18, gy);
    for (let y = gy; y >= gy - H; y -= 8) c.lineTo(x - 14 - Math.sin(y * 0.08 + t * 14) * 5, y);
    c.lineTo(x, gy - H - 16);
    for (let y = gy - H; y <= gy; y += 8) c.lineTo(x + 14 + Math.sin(y * 0.08 + t * 14 + 1) * 5, y);
    c.closePath();
    c.fill();
    c.globalCompositeOperation = "lighter";
    for (let i = 0; i < 8; i++) {
      const p = (t * 1.5 + i / 8) % 1;
      puff(c, x + Math.sin(i * 3 + t * 5) * 10, gy - p * H, 6 + p * 8, "255,160,60", (1 - p) * 0.5);
    }
    c.restore();
  }
  function drawBolt(c, x0, y0, x1, y1, seed, a) {
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    const pts = [[x0, y0]];
    for (let i = 1; i < 8; i++) {
      const k = i / 8;
      pts.push([lerp(x0, x1, k) + (hash(seed + i) - 0.5) * 30, lerp(y0, y1, k)]);
    }
    pts.push([x1, y1]);
    [[10, `rgba(160,200,255,${0.35 * a})`], [5, `rgba(220,240,255,${0.8 * a})`], [2, `rgba(255,255,255,${a})`]].forEach(([lw, col]) => {
      c.strokeStyle = col;
      c.lineWidth = lw;
      c.beginPath();
      pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
      c.stroke();
    });
    c.restore();
  }
  function drawStormCloud(c, x, y, s, t, a) {
    c.save();
    c.globalAlpha = a;
    c.translate(x, y);
    c.scale(s, s);
    c.beginPath();
    [[-40, 4, 20], [-18, -8, 26], [10, -10, 24], [36, 2, 20], [0, 8, 24]].forEach(([px, py, r]) => {
      c.moveTo(px + r, py);
      c.arc(px, py, r, 0, TAU);
    });
    c.strokeStyle = OUT;
    c.lineWidth = 6;
    c.stroke();
    c.fillStyle = "#5c5f7a";
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = "#3c3e56";
    c.fillRect(-70, 8, 140, 30);
    c.restore();
    c.restore();
  }
  function drawGiantShroom(c, x, gy, k, t, burst2) {
    if (k <= 0) return;
    c.save();
    c.translate(x, gy);
    c.scale(k, k);
    rr(c, -12, -96, 24, 98, 10);
    fs(c, vg(c, -96, 0, "#fff6e6", "#d6c4a8"), 3);
    if (!burst2) {
      c.beginPath();
      c.moveTo(-64, -88);
      c.bezierCurveTo(-64, -150, 64, -150, 64, -88);
      c.quadraticCurveTo(0, -100, -64, -88);
      c.closePath();
      fs(c, vg(c, -140, -88, "#d79bff", "#9b4dca", "#5e1f8f"), 3.2);
      [[-30, -118, 9], [6, -130, 10], [34, -108, 7], [-46, -98, 6]].forEach(([px, py, r]) => {
        circ(c, px, py, r);
        c.fillStyle = "#b6f36a";
        c.fill();
      });
      eyes(c, { er: 7, eyes: [[-12, -70], [10, -70]], c: { main: "#efe0c8" }, seed: 0 }, { mood: "focus", t });
    }
    c.restore();
  }
  function drawWhale(c, x, y, rot, s) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.scale(s, s);
    c.beginPath();
    c.moveTo(-50, 0);
    c.bezierCurveTo(-46, -30, 20, -36, 46, -12);
    c.bezierCurveTo(56, 0, 40, 18, 0, 16);
    c.bezierCurveTo(-30, 16, -44, 10, -50, 0);
    c.closePath();
    fs(c, vg(c, -30, 16, "#a6e6f0", "#48aec4", "#256f86"), 3);
    c.beginPath();
    c.moveTo(-48, 0);
    c.quadraticCurveTo(-66, -4, -78, -20);
    c.quadraticCurveTo(-70, -2, -82, 10);
    c.quadraticCurveTo(-64, 6, -48, 4);
    fs(c, "#48aec4", 2.5);
    c.fillStyle = "#e4f7f9";
    ell(c, 10, 8, 30, 7);
    c.fill();
    circ(c, 30, -8, 4);
    c.fillStyle = "#fff";
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = OUT;
    c.stroke();
    circ(c, 31, -8, 2.2);
    c.fillStyle = OUT;
    c.fill();
    c.restore();
  }
  var SPECIALS = {
    ufo: {
      // 레이저로봇: 우주선이 내려와 수직 레이저
      step(W, s, dt) {
        if (s.t >= 1.45 && !s.fired) {
          s.fired = true;
          const r = s.sh.cr * s.k / 2;
          W.carveRect(s.x - r, 0, r * 2, s.gy + 70);
          W.hurtArea(s.x, s.gy - 20, s.sh.r * s.k, s.sh.dmg * s.k, s.owner, { columnW: r + 14 });
          W.boomAt(s.sh, s.x, s.gy, s.k);
          W.shake += 0.7;
        }
        return s.t < 2.7;
      },
      draw(c, W, s) {
        const t = s.t, y = t < 0.9 ? lerp(-80, 46, ease(t / 0.9)) : t < 2 ? 46 + Math.sin(t * 5) * 2 : 46 - (t - 2) * 300;
        const x = s.x + (t > 2 ? (t - 2) * 120 : 0);
        if (t > 0.9 && t < 1.45) {
          const k = (t - 0.9) / 0.55;
          c.strokeStyle = `rgba(47,224,255,${0.4 + 0.4 * Math.sin(t * 30)})`;
          c.lineWidth = 2;
          c.setLineDash([6, 6]);
          c.beginPath();
          c.moveTo(s.x, y + 16);
          c.lineTo(s.x, s.gy);
          c.stroke();
          c.setLineDash([]);
          c.strokeStyle = "#ff4d4d";
          c.lineWidth = 2.5;
          ell(c, s.x, s.gy, 30 * (1.4 - k * 0.5), 8);
          c.stroke();
        }
        if (t >= 1.45 && t < 2.05) {
          const p = (t - 1.45) / 0.6, bw = (s.sh.cr * s.k / 2 + 6) * Math.sin(Math.min(1, p * 1.3) * Math.PI) + 4;
          const g = c.createLinearGradient(s.x - bw, 0, s.x + bw, 0);
          g.addColorStop(0, "rgba(47,224,255,0)");
          g.addColorStop(0.25, "rgba(47,224,255,.9)");
          g.addColorStop(0.5, "#ffffff");
          g.addColorStop(0.75, "rgba(47,224,255,.9)");
          g.addColorStop(1, "rgba(47,224,255,0)");
          c.fillStyle = g;
          c.fillRect(s.x - bw, y + 14, bw * 2, s.gy + 70 - y);
        }
        drawUFO(c, x, y, t, t > 0.9 && t < 2.05 ? Math.min(1, (t - 0.9) * 2) : 0);
      }
    },
    meteor: {
      // 망치: 신호탄 자리에 운석 낙하
      step(W, s, dt) {
        if (s.t >= 1.15 && !s.fired) {
          s.fired = true;
          W.carveRound(s.x, s.gy, s.sh.cr * s.k);
          W.hurtArea(s.x, s.gy - 10, s.sh.r * s.k, s.sh.dmg * s.k, s.owner);
          W.boomAt(s.sh, s.x, s.gy, s.k * 1.2);
          W.debris(s.x, s.gy, 26, 1.6);
          W.shake += 1.1;
        }
        return s.t < 2;
      },
      draw(c, W, s) {
        const t = s.t;
        W.dim = Math.max(W.dim, t < 1.5 ? Math.min(0.35, t * 0.8) : Math.max(0, 0.35 - (t - 1.5)));
        if (t < 1.15) {
          const u = Math.max(0, (t - 0.2) / 0.95) ** 1.6, x = lerp(s.x - 320 * s.side, s.x, u), y = lerp(-120, s.gy, u);
          for (let i = 1; i < 14; i++) {
            const uu = Math.max(0, u - i * 0.03);
            c.save();
            c.globalCompositeOperation = "lighter";
            puff(c, lerp(s.x - 320 * s.side, s.x, uu), lerp(-120, s.gy, uu), 18 - i, i < 5 ? "255,220,120" : "255,110,40", 0.5 * (1 - i / 14));
            c.restore();
          }
          c.save();
          c.translate(x, y);
          c.scale(2.2, 2.2);
          drawShell(c, { key: "meteor" }, t, Math.atan2(s.gy + 120, 320 * s.side));
          c.restore();
          if (t < 0.6) {
            c.strokeStyle = "#ff4d4d";
            c.lineWidth = 2.5;
            ell(c, s.x, s.gy, 34, 9);
            c.stroke();
          }
        }
      }
    },
    erupt: {
      // 두더지: 땅속 폭발 후 분출
      step(W, s, dt) {
        W.shake = Math.max(W.shake, s.t < 0.7 ? 0.25 : 0);
        if (s.t >= 0.7 && !s.fired) {
          s.fired = true;
          W.carveRound(s.x, s.y, s.sh.cr * s.k);
          const top = W.ground(s.x, 0);
          if (top < s.y) W.carveRect(s.x - 12, top - 4, 24, s.y - top + 4);
          W.hurtArea(s.x, Math.min(s.y, top + 10), s.sh.r * s.k + 20, s.sh.dmg * s.k, s.owner, { tall: s.y - top });
          W.boomAt(s.sh, s.x, top + 6, s.k);
          W.debris(s.x, top, 30, 2);
          W.shake += 0.8;
        }
        return s.t < 1.6;
      },
      draw(c, W, s) {
        if (s.t < 0.7) {
          const top = W.ground(s.x, 0), k = s.t / 0.7;
          c.strokeStyle = `rgba(40,20,10,${0.4 + k * 0.5})`;
          c.lineWidth = 2;
          [-1, 1].forEach((d) => {
            c.beginPath();
            c.moveTo(s.x, top + 2);
            for (let j = 1; j <= 4; j++) c.lineTo(s.x + d * j * 10 * k, top + 2 + (j % 2 ? 5 : 0));
            c.stroke();
          });
        }
      }
    },
    tornado: {
      // 구름열차: 회오리가 땅을 따라 이동
      step(W, s, dt) {
        if (s.t < 2.6) {
          s.x += s.dir * 130 * dt;
          s.gy = W.ground(s.x, 0);
        }
        W.tanks.forEach((t) => {
          if (t.dead || s.hit.has(t)) return;
          if (Math.abs(t.x - s.x) < 34 && t.y > s.gy - 150) {
            s.hit.add(t);
            W.damage(t, s.sh.dmg * s.k, s.owner);
            t.vy = -420;
            t.vx = s.dir * 190;
            t.air = true;
          }
        });
        return s.t < 3;
      },
      draw(c, W, s) {
        const a = Math.min(1, s.t * 3, (3 - s.t) * 2);
        drawTornado(c, s.x, s.gy, 150, s.t, a);
      }
    },
    storm: {
      // 자석포: 먹구름에서 번개 5발
      step(W, s, dt) {
        [0.45, 0.65, 0.85, 1.05, 1.25].forEach((tt, i) => {
          if (s.t >= tt && !s.done[i]) {
            s.done[i] = true;
            const x = s.x + [-50, 30, -15, 55, 0][i] * s.k, gy = W.ground(x, 0);
            s.flash[i] = { x, gy, t: s.t };
            W.carveRound(x, gy, 16 * s.k);
            W.hurtArea(x, gy - 10, 30, s.sh.dmg * s.k / 4.2, s.owner);
            W.boomAt({ boom: "electric", R: 18, color: "#b98cff" }, x, gy, 1);
            W.shake += 0.25;
          }
        });
        return s.t < 1.8;
      },
      draw(c, W, s) {
        const a = Math.min(1, s.t * 3, (1.8 - s.t) * 3);
        drawStormCloud(c, s.x, 40, 1.3, s.t, a);
        s.flash.forEach((f, i) => {
          if (f && s.t - f.t < 0.18) drawBolt(c, s.x + (i - 2) * 14, 60, f.x, f.gy, i * 13 + Math.floor(s.t * 30), 1 - (s.t - f.t) / 0.18);
        });
      }
    },
    shroom: {
      // 버섯포: 거대 독버섯이 자라 터지며 독 안개
      step(W, s, dt) {
        if (s.t >= 0.85 && !s.fired) {
          s.fired = true;
          W.carveRound(s.x, s.gy, s.sh.cr * s.k);
          W.hurtArea(s.x, s.gy - 30, s.sh.r * s.k, s.sh.dmg * s.k, s.owner);
          W.boomAt({ boom: "toxic", R: 50 }, s.x, s.gy - 60, s.k);
          W.zones.push({ type: "poison", x: s.x, r: 80, turns: 3, dmg: 80, born: W.clock });
          W.shake += 0.4;
        }
        return s.t < 1.5;
      },
      draw(c, W, s) {
        const k = ease(s.t / 0.7) * (s.t > 0.85 ? Math.max(0, 1 - (s.t - 0.85) * 2) : 1);
        drawGiantShroom(c, s.x, s.gy + 4, k, s.t, s.t > 0.85);
      }
    },
    wave: {
      // 얼음고래: 해일이 밀려가고 고래가 뛰어오른다
      step(W, s, dt) {
        if (!s.fired) {
          s.fired = true;
          W.carveRound(s.x, s.gy, s.sh.cr * s.k);
          W.hurtArea(s.x, s.gy - 10, s.sh.r * s.k, s.sh.dmg * s.k * 0.75, s.owner);
          W.boomAt(s.sh, s.x, s.gy, s.k);
        }
        s.wx += s.dir * 230 * dt;
        W.tanks.forEach((t) => {
          if (t.dead || s.hit.has(t) || t === s.owner) return;
          if (Math.abs(t.x - s.wx) < 30) {
            s.hit.add(t);
            W.damage(t, s.sh.dmg * s.k * 0.25, s.owner);
            t.vx = s.dir * 240;
            t.vy = -260;
            t.air = true;
          }
        });
        return s.t < 1.9;
      },
      draw(c, W, s) {
        const a = Math.min(1, (1.9 - s.t) * 2), H = 80 * (1 - s.t / 2.2);
        c.save();
        c.globalAlpha = a;
        const x0 = s.x, x1 = s.wx, gy = W.ground(s.wx, 0);
        c.beginPath();
        c.moveTo(x0, W.ground(x0, 0));
        for (let x = x0; s.dir > 0 ? x <= x1 : x >= x1; x += s.dir * 6) {
          const k = Math.abs(x - x0) / Math.max(1, Math.abs(x1 - x0));
          c.lineTo(x, W.ground(x, 0) - H * k * k - Math.sin(x * 0.08 + s.t * 10) * 4);
        }
        c.lineTo(x1 + s.dir * 18, gy - H * 0.6);
        c.quadraticCurveTo(x1 + s.dir * 30, gy - H, x1 + s.dir * 6, gy - H - 6);
        c.lineTo(x1, gy);
        c.closePath();
        fs(c, vg(c, gy - H, gy, "rgba(220,250,255,.95)", "rgba(80,180,230,.85)", "rgba(30,110,170,.85)"), 2.5);
        c.restore();
        if (s.t > 0.2 && s.t < 1.2) {
          const p = (s.t - 0.2) / 1;
          drawWhale(c, s.x + s.dir * (20 + p * 120), s.gy - Math.sin(p * Math.PI) * 120, s.dir * (-0.9 + p * 1.8), s.dir);
        }
      }
    },
    phoenix: {
      // 불꽃벌: 착탄 후 불기둥
      step(W, s) {
        return s.t < 1;
      },
      draw(c, W, s) {
        drawPillar(c, s.x, s.gy, 140 * ease(s.t / 0.3), s.t, Math.min(1, (1 - s.t) * 3));
      }
    }
  };
  function bakeTerrain(mapId, grid, w, h, bgrid) {
    const P = palette(MAPS[mapId]), fg = new ImageData(w, h), bk = new ImageData(w, h), st = new ImageData(w, h), out = [0, 0, 0];
    for (let x = 0; x < w; x++) {
      let d = 0, prev = false;
      for (let y = 0; y < h; y++) {
        const m = grid[y * w + x], i = (y * w + x) * 4;
        if (!m) {
          prev = false;
          continue;
        }
        d = prev ? d + 1 : 0;
        prev = true;
        const mat = MAT[m];
        shadeMat(mat, d, x, y, P, out);
        if (mat === "leaf" || mat === "wood") prev = false;
        fg.data[i] = out[0];
        fg.data[i + 1] = out[1];
        fg.data[i + 2] = out[2];
        fg.data[i + 3] = 255;
        if (mat !== "leaf" && mat !== "wood") {
          bk.data[i] = out[0] * 0.38 + 8;
          bk.data[i + 1] = out[1] * 0.36 + 6;
          bk.data[i + 2] = out[2] * 0.4 + 14;
          bk.data[i + 3] = 255;
        }
        if (mat === "steel") {
          st.data[i] = out[0];
          st.data[i + 1] = out[1];
          st.data[i + 2] = out[2];
          st.data[i + 3] = 255;
        }
      }
    }
    if (bgrid) {
      bk.data.fill(0);
      for (let x = 0; x < w; x++) {
        let d = 0, prev = false;
        for (let y = 0; y < h; y++) {
          const m = bgrid[y * w + x], i = (y * w + x) * 4;
          if (!m) {
            prev = false;
            continue;
          }
          d = prev ? d + 1 : 0;
          prev = true;
          const mat = MAT[m];
          if (mat === "leaf" || mat === "wood") continue;
          shadeMat(mat, d, x, y, P, out);
          bk.data[i] = out[0] * 0.38 + 8;
          bk.data[i + 1] = out[1] * 0.36 + 6;
          bk.data[i + 2] = out[2] * 0.4 + 14;
          bk.data[i + 3] = 255;
        }
      }
    }
    const cv = (img) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").putImageData(img, 0, 0);
      return c;
    };
    return { fg: cv(fg), back: cv(bk), steel: cv(st) };
  }
  var Renderer = class {
    constructor(sim, o = {}) {
      this.sim = sim;
      this.w = sim.w;
      this.h = sim.h;
      this.labels = o.labels !== false;
      this.me = o.me;
      this.sky = document.createElement("canvas");
      this.sky.width = this.w;
      this.sky.height = this.h;
      skyPaint(this.sky.getContext("2d"), this.w, this.h, sim.map.sky);
      this.rebuild();
      this.booms = [];
      this.floats = [];
      this.parts = [];
      this.splashes = [];
      this.shake = 0;
      this.dim = 0;
      this.banner = null;
      this.t = 0;
    }
    ground(x, from) {
      return this.sim.ground(x, from);
    }
    // 처음부터 다시 그리기: 기본 지형을 굽고 지금까지의 땅 파기를 다시 적용한다
    rebuild() {
      const b = bakeTerrain(this.sim.mapId, baseGrid(this.sim.mapId, this.w, this.h), this.w, this.h, backGrid(this.sim.mapId, this.w, this.h));
      this.fg = b.fg;
      this.back = b.back;
      this.steel = b.steel;
      this.fctx = this.fg.getContext("2d", { willReadFrequently: true });
      for (const op of this.sim.ops) this.carveVisual(op);
    }
    carveVisual(op) {
      const c = this.fctx;
      c.save();
      c.globalCompositeOperation = "destination-out";
      c.beginPath();
      let bx, by, bw, bh;
      if (op.k === "rect") {
        c.rect(op.x, op.y, op.w, op.h);
        bx = op.x;
        by = op.y;
        bw = op.w;
        bh = op.h;
      } else {
        raggedPoly(op.x, op.y, op.r, op.ry).forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
        c.closePath();
        bx = op.x - op.r;
        by = op.y - op.ry;
        bw = op.r * 2;
        bh = op.ry * 2;
      }
      c.fill();
      if (op.s) {
        c.globalCompositeOperation = "source-atop";
        if (op.k === "rect") {
          [[op.x - 12, op.x], [op.x + op.w + 12, op.x + op.w]].forEach(([a, b2]) => {
            const g = c.createLinearGradient(a, 0, b2, 0);
            g.addColorStop(0, "rgba(38,20,10,0)");
            g.addColorStop(1, "rgba(38,20,10,.55)");
            c.fillStyle = g;
            c.fillRect(Math.min(a, b2), op.y, 12, op.h);
          });
        } else {
          c.translate(op.x, op.y);
          c.scale(1, op.ry / op.r);
          const g = c.createRadialGradient(0, 0, op.r * 0.85, 0, 0, op.r + 15);
          g.addColorStop(0, "rgba(38,20,10,.62)");
          g.addColorStop(0.45, "rgba(38,20,10,.28)");
          g.addColorStop(1, "rgba(38,20,10,0)");
          c.fillStyle = g;
          c.fillRect(-op.r - 20, -op.r - 20, op.r * 2 + 40, op.r * 2 + 40);
        }
      }
      c.restore();
      c.drawImage(this.steel, bx - 20, by - 20, bw + 40, bh + 40, bx - 20, by - 20, bw + 40, bh + 40);
    }
    colorAt(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return "#8a6040";
      const d = this.fctx.getImageData(x | 0, y | 0, 1, 1).data;
      return d[3] > 40 ? `rgb(${d[0]},${d[1]},${d[2]})` : "#8a6040";
    }
    debris(x, y, n, power = 1) {
      const col = this.colorAt(x, y + 4);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * (0.12 + 0.76 * Math.random()), s = (90 + Math.random() * 220) * power;
        this.parts.push({ x, y: y - 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.9 + Math.random() * 0.7, col, size: 2 + Math.random() * 3.5 });
      }
    }
    // 시뮬레이션이 쌓아 둔 화면 일 처리
    drain() {
      for (const f of this.sim.fxq) {
        this.onFx?.(f);
        if (f.type === "carve") this.carveVisual(f.op);
        else if (f.type === "boom") {
          const base = f.tankId ? SHELLS[f.tankId][f.slot] : { boom: f.kind || "dirt", color: f.color };
          this.booms.push({ sh: { ...base, R: f.R || base.R || 24 }, x: f.x, y: f.y, t0: this.t });
          if (f.debris) this.debris(f.x, f.y, f.debris, f.power || 0.7 + f.debris / 60);
          if (f.shake) this.shake += f.shake;
        } else if (f.type === "float") this.floats.push({ x: f.x, y: f.y, s: f.text, c: f.color, life: 1.3 });
        else if (f.type === "splash") this.splashes.push({ x: f.x, t0: this.t });
        else if (f.type === "banner") this.banner = { text: f.text, t0: this.t };
        else if (f.type === "shake") this.shake += f.v;
      }
      this.sim.fxq.length = 0;
    }
    update(dt) {
      this.t += dt;
      this.shake = Math.max(0, this.shake - dt * 1.6);
      this.dim = Math.max(0, this.dim - dt);
      this.drain();
      this.booms = this.booms.filter((b) => this.t - b.t0 < 0.8);
      this.splashes = this.splashes.filter((s) => this.t - s.t0 < 1);
      this.parts.forEach((p) => {
        p.vy += 600 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (this.sim.solid(p.x, p.y) && p.vy > 0) {
          p.vy *= -0.25;
          p.vx *= 0.5;
        }
      });
      this.parts = this.parts.filter((p) => p.life > 0);
      this.floats.forEach((f) => {
        f.y -= 30 * dt;
        f.life -= dt;
      });
      this.floats = this.floats.filter((f) => f.life > 0);
    }
    draw(c, o = {}) {
      const S = this.sim, clock = S.clock;
      const sx = this.shake ? (hash(Math.floor(this.t * 60)) - 0.5) * this.shake * 12 : 0, sy = this.shake ? (hash(Math.floor(this.t * 60) + 7) - 0.5) * this.shake * 12 : 0;
      const cam = o.cam || { x: 0, y: 0 };
      c.save();
      c.drawImage(this.sky, cam.x * 0.5, cam.y * 0.5, this.w, this.h);
      c.translate(sx, sy);
      c.drawImage(this.back, 0, 0, this.w, this.h);
      this.drawLiquid(c);
      c.drawImage(this.fg, 0, 0, this.w, this.h);
      S.zones.forEach((z) => {
        const gy = S.ground(z.x, 0), a = Math.min(1, (clock - (z.born || 0)) * 2);
        if (z.type === "poison") poisonFog(c, z.x, gy, z.r, this.t, a);
        else fireField(c, z.x, gy, z.r, this.t, a);
        if (this.labels) zoneLabel(c, z.x, gy - z.r - 20, (z.type === "poison" ? "\uB3C5 " : "\uBD88 ") + z.turns + "\uD134", z.type === "poison" ? "#d4a6ff" : "#ffb36b");
      });
      S.events.forEach((e) => this.drawEvent(c, e));
      S.tanks.forEach((t) => this.drawTank(c, t, o));
      S.shells.forEach((s) => {
        if (s.sh.shape === "line") {
          c.save();
          c.lineCap = "round";
          c.strokeStyle = "rgba(47,224,255,.55)";
          c.lineWidth = 10;
          c.beginPath();
          c.moveTo(s.sx, s.sy);
          c.lineTo(s.x, s.y);
          c.stroke();
          c.strokeStyle = "#fff";
          c.lineWidth = 3;
          c.stroke();
          c.restore();
          return;
        }
        const art = SHELLS[s.tankId][s.slot];
        trail(c, art, s.trail.slice(1), this.t);
        if (s.powered || s.k > 1) {
          const g = c.createRadialGradient(s.x, s.y, 2, s.x, s.y, 20);
          g.addColorStop(0, "rgba(255,120,50,.75)");
          g.addColorStop(1, "rgba(255,90,40,0)");
          c.fillStyle = g;
          circ(c, s.x, s.y, 20);
          c.fill();
        }
        c.save();
        c.translate(s.x, s.y);
        c.scale(0.95, 0.95);
        drawShell(c, art, this.t, Math.atan2(s.vy, s.vx));
        c.restore();
        if (s.y < 0) {
          c.fillStyle = "#c92a2a";
          c.beginPath();
          c.moveTo(s.x, 4);
          c.lineTo(s.x - 6, 14);
          c.lineTo(s.x + 6, 14);
          c.fill();
        }
      });
      S.specials.forEach((s) => SPECIALS[s.type]?.draw(c, this, s));
      this.booms.forEach((b) => boom(c, b.sh, b.x, b.y, (this.t - b.t0) / 0.8));
      this.parts.forEach((p) => {
        c.globalAlpha = Math.min(1, p.life * 2);
        c.fillStyle = p.col;
        c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      });
      c.globalAlpha = 1;
      this.floats.forEach((f) => {
        c.save();
        c.globalAlpha = Math.min(1, f.life);
        c.font = "20px Jua, sans-serif";
        c.textAlign = "center";
        c.lineJoin = "round";
        c.lineWidth = 4;
        c.strokeStyle = "#fff8e8";
        c.strokeText(f.s, f.x, f.y);
        c.fillStyle = f.c;
        c.fillText(f.s, f.x, f.y);
        c.restore();
      });
      c.restore();
      if (this.dim > 0) {
        c.fillStyle = `rgba(20,8,20,${this.dim})`;
        c.fillRect(0, 0, this.w, this.h);
      }
      if (!o.cam) this.drawBanner(c, this.w, this.h);
    }
    drawBanner(c, vw, vh) {
      if (this.banner && this.t - this.banner.t0 < 1.8) {
        const p = (this.t - this.banner.t0) / 1.8, a = Math.min(1, p * 6, (1 - p) * 4);
        c.save();
        c.globalAlpha = a;
        c.font = "30px Jua, sans-serif";
        c.textAlign = "center";
        c.lineJoin = "round";
        c.lineWidth = 7;
        c.strokeStyle = OUT;
        const y = vh * 0.3 - (1 - Math.min(1, p * 5)) * 20;
        c.strokeText(this.banner.text, vw / 2, y);
        c.fillStyle = "#ffd34d";
        c.fillText(this.banner.text, vw / 2, y);
        c.restore();
      }
    }
    drawLiquid(c) {
      const S = this.sim, L = S.map.liquid || (S.sdLiquid ? { type: "water" } : null);
      if (!L || L.type === "void" && !S.sdLiquid) return;
      const type = L.type === "void" ? "water" : L.type, y0 = S.liquidY, t = this.t;
      const cols = { water: ["rgba(120,200,240,.75)", "rgba(30,90,160,.92)"], lava: ["rgba(255,190,70,.95)", "rgba(170,40,20,.98)"], acid: ["rgba(170,240,90,.8)", "rgba(60,120,40,.92)"] }[type];
      const g = c.createLinearGradient(0, y0, 0, this.h);
      g.addColorStop(0, cols[0]);
      g.addColorStop(1, cols[1]);
      const wave = (x) => y0 + Math.sin(x * 0.04 + t * 2) * 3 + Math.sin(x * 0.11 - t * 3) * 1.5;
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, this.h);
      for (let x = 0; x <= this.w; x += 8) c.lineTo(x, wave(x));
      c.lineTo(this.w, this.h);
      c.fill();
      c.strokeStyle = type === "lava" ? "rgba(255,240,170,.9)" : "rgba(255,255,255,.7)";
      c.lineWidth = 2;
      c.beginPath();
      for (let x = 0; x <= this.w; x += 8) x ? c.lineTo(x, wave(x)) : c.moveTo(x, wave(x));
      c.stroke();
      if (type === "lava") for (let i = 0; i < 8; i++) {
        const p = (t * 0.5 + i / 8) % 1;
        circ(c, hash(i) * this.w, y0 + 8 - p * 8, 3 + p * 4);
        c.fillStyle = `rgba(255,220,120,${1 - p})`;
        c.fill();
      }
      this.splashes.forEach((s) => {
        const p = t - s.t0;
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI * (0.2 + 0.6 * hash(i)), v = 120 + hash(i + 3) * 80;
          c.fillStyle = type === "lava" ? "rgba(255,170,60,.9)" : "rgba(200,240,255,.9)";
          circ(c, s.x + Math.cos(a) * v * p, y0 + Math.sin(a) * v * p + 300 * p * p, 3);
          c.fill();
        }
      });
    }
    drawEvent(c, e) {
      const S = this.sim, t = this.t;
      if (e.type === "tornado") drawTornado(c, e.x, e.gy ?? S.ground(e.x, 0), 170, t, Math.min(1, e.t * 2), "200,210,220");
      if (e.type === "pillar") {
        const gy = e.gy ?? S.ground(e.x, 0);
        if (e.t < 1) {
          const k = e.t * 6 % 1 < 0.5;
          c.fillStyle = `rgba(255,120,40,${k ? 0.8 : 0.4})`;
          ell(c, e.x, gy, 22, 6);
          c.fill();
        } else drawPillar(c, e.x, gy, 150 * ease((e.t - 1) / 0.3), t, 1);
      }
      if (e.type === "meteors") e.xs.forEach((x, i) => {
        const tt = 0.4 + i * 0.45, u = (e.t - tt) / 0.7;
        if (u < 0 || u > 1) return;
        const gy = S.ground(x, 0), px = lerp(x - 160, x, u), py = lerp(-40, gy, u);
        c.save();
        c.translate(px, py);
        c.scale(1.2, 1.2);
        drawShell(c, { key: "meteor" }, t, 0.8);
        c.restore();
      });
      if (e.type === "lightning") {
        const a = Math.min(1, e.t * 3, (1.3 - e.t) * 3);
        drawStormCloud(c, e.x, 46, 1, t, a);
        if (e.t > 0.7 && e.t < 0.9) drawBolt(c, e.x, 60, e.x, S.ground(e.x, 0), Math.floor(t * 30), 1 - (e.t - 0.7) / 0.2);
      }
    }
    drawTank(c, t, o) {
      if (t.sunk && t.y > this.h + 10 || t.left) return;
      const S = this.sim, T = tankById(t.tankId);
      let st = "idle", ph = null;
      if (t.dead) st = "dead";
      else if (S.clock - t.hitAt < 0.6) {
        st = "hit";
        ph = S.clock - t.hitAt;
      } else if (S.clock - t.firedAt < 0.5) {
        st = "fire";
        ph = S.clock - t.firedAt;
      } else if (t.moving || t.movingVis) st = "move";
      else if (t.hp <= t.max * 0.25) st = "danger";
      renderTank(c, this.w, this.h, T, st, this.t, t.x, t.y, S.ts, { flip: t.facing, angle: t.angle + (t.tilt || 0), tilt: (t.tilt || 0) * Math.PI / 180, phaseT: ph, noText: true });
      if (t.shield) {
        c.strokeStyle = "rgba(160,220,255,.85)";
        c.fillStyle = "rgba(85,174,240,.15)";
        c.lineWidth = 2.5;
        circ(c, t.x, t.y - 20, 32);
        c.fill();
        c.stroke();
      }
      if (t.frozen > 0) {
        c.save();
        c.translate(t.x + 22, t.y - 40);
        c.scale(0.7, 0.7);
        drawShell(c, { key: "snowflake" }, this.t, 0);
        c.restore();
      }
      if (t.dead || !this.labels) return;
      const active = o.active === t.uid, top = t.y - (t.S.hover ? 74 : 60), col = t.team === "red" ? "#d63c2a" : t.team === "blue" ? "#1f6fae" : t.uid === this.me ? "#d63c2a" : "#3a2600";
      c.fillStyle = "rgba(20,28,52,.65)";
      c.fillRect(t.x - 23, t.y + 5, 46, 6);
      c.fillStyle = t.hp / t.max > 0.5 ? "#3fae4a" : t.hp / t.max > 0.25 ? "#f0a020" : "#d63c3c";
      c.fillRect(t.x - 23, t.y + 5, 46 * t.hp / t.max, 6);
      c.textAlign = "center";
      c.font = `600 12px "Noto Sans KR", sans-serif`;
      c.lineJoin = "round";
      c.lineWidth = 3.5;
      c.strokeStyle = "rgba(255,248,232,.9)";
      c.strokeText(t.name, t.x, t.y + 25);
      c.fillStyle = col;
      c.fillText(t.name, t.x, t.y + 25);
      if (active) {
        const b = Math.abs(Math.sin(this.t * 5)) * 8, y = top - 6 - b;
        c.fillStyle = "#e8352a";
        c.strokeStyle = "rgba(40,10,10,.8)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(t.x, y);
        c.lineTo(t.x - 11, y - 12);
        c.lineTo(t.x - 4, y - 12);
        c.lineTo(t.x - 4, y - 26);
        c.lineTo(t.x + 4, y - 26);
        c.lineTo(t.x + 4, y - 12);
        c.lineTo(t.x + 11, y - 12);
        c.closePath();
        c.fill();
        c.stroke();
      }
      if (t.uid === this.me && !active) {
        c.strokeStyle = "rgba(255,183,3,.7)";
        c.lineWidth = 2;
        ell(c, t.x, t.y + 2, 26, 6);
        c.stroke();
      }
    }
    // 내 차례에 탱크 둘레에 발사 가능 각도(위·아래 한계)와 지금 각도를 보여 준다
    drawAimFan(c, t) {
      const [lo, hi] = this.sim.angleRange(t), [px, py] = this.sim.pivotPos(t), R = 46, f = t.facing, rad = (d) => d * Math.PI / 180;
      const pt = (d, r) => [px + Math.cos(rad(d)) * r * f, py - Math.sin(rad(d)) * r];
      c.save();
      c.beginPath();
      c.moveTo(px, py);
      for (let d = lo; d <= hi + 0.01; d += 2) c.lineTo(...pt(Math.min(d, hi), R));
      c.closePath();
      c.fillStyle = "rgba(127,208,108,.16)";
      c.fill();
      c.beginPath();
      for (let d = lo; d <= hi + 0.01; d += 2) {
        const [x, y] = pt(Math.min(d, hi), R);
        d === lo ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.strokeStyle = "rgba(127,208,108,.85)";
      c.lineWidth = 3;
      c.stroke();
      c.strokeStyle = "#ff4a3a";
      c.lineWidth = 2.5;
      [lo, hi].forEach((d) => {
        c.beginPath();
        c.moveTo(...pt(d, 12));
        c.lineTo(...pt(d, R + 8));
        c.stroke();
      });
      c.setLineDash([3, 5]);
      c.beginPath();
      c.moveTo(...pt(0, 14));
      c.lineTo(...pt(0, R + 10));
      c.strokeStyle = "rgba(36,29,46,.35)";
      c.stroke();
      c.setLineDash([]);
      const [ax, ay] = pt(t.angle, R + 12);
      c.strokeStyle = "#ffb703";
      c.lineWidth = 3;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(...pt(t.angle, 18));
      c.lineTo(ax, ay);
      c.stroke();
      c.font = "15px Jua, sans-serif";
      c.textAlign = "center";
      c.lineJoin = "round";
      c.lineWidth = 4;
      c.strokeStyle = "rgba(255,248,232,.9)";
      const [tx, ty] = pt(t.angle, R + 26);
      c.strokeText(t.angle + "\xB0", tx, ty + 5);
      c.fillStyle = "#3a2600";
      c.fillText(t.angle + "\xB0", tx, ty + 5);
      c.restore();
    }
    drawWind(c, x, y, r = 24) {
      c.save();
      c.translate(x, y);
      circ(c, 0, 0, r + 8);
      c.fillStyle = "rgba(31,45,82,.85)";
      c.fill();
      circ(c, 0, 0, r);
      c.strokeStyle = "rgba(244,239,225,.35)";
      c.lineWidth = 1.5;
      c.stroke();
      for (let i = 0; i < 8; i++) {
        const a2 = i * Math.PI / 4;
        c.beginPath();
        c.moveTo(Math.cos(a2) * (r - 4), Math.sin(a2) * (r - 4));
        c.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
        c.stroke();
      }
      const s = this.sim.wind.str, a = -this.sim.wind.ang * Math.PI / 180;
      if (s > 0) {
        c.rotate(a);
        const L = 6 + s / 10 * (r - 4);
        c.strokeStyle = "#ffd34d";
        c.fillStyle = "#ffd34d";
        c.lineWidth = 3.5;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(-L, 0);
        c.lineTo(L - 6, 0);
        c.stroke();
        c.beginPath();
        c.moveTo(L + 2, 0);
        c.lineTo(L - 8, -6);
        c.lineTo(L - 8, 6);
        c.closePath();
        c.fill();
        c.rotate(-a);
      }
      c.font = "15px Jua, sans-serif";
      c.textAlign = "center";
      c.fillStyle = "#f4efe1";
      c.fillText(s, 0, r + 26);
      c.restore();
    }
  };

  // ../client/js/sound.js
  var ac = null;
  var master = null;
  var muted = false;
  try {
    muted = localStorage.getItem("sc_mute") === "1";
  } catch {
  }
  function ctx() {
    if (!ac) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      ac = new A();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  ["pointerdown", "keydown"].forEach((ev) => addEventListener(ev, () => ctx(), { once: true }));
  function noise(dur) {
    const a = ac, b = a.createBuffer(1, Math.max(1, a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = a.createBufferSource();
    s.buffer = b;
    return s;
  }
  function env(node, t, peak, attack, decay) {
    node.gain.setValueAtTime(0, t);
    node.gain.linearRampToValueAtTime(peak, t + attack);
    node.gain.exponentialRampToValueAtTime(1e-3, t + attack + decay);
  }
  function tone(type, f0, f1, dur, vol, delay = 0) {
    const a = ac, t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, vol, 5e-3, dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function burst(dur, cutoff, vol, delay = 0, q = 0.7) {
    const a = ac, t = a.currentTime + delay, s = noise(dur + 0.1), f = a.createBiquadFilter(), g = a.createGain();
    f.type = "lowpass";
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, cutoff / 6), t + dur);
    f.Q.value = q;
    env(g, t, vol, 4e-3, dur);
    s.connect(f);
    f.connect(g);
    g.connect(master);
    s.start(t);
    s.stop(t + dur + 0.1);
  }
  var SFX = {
    fire: () => {
      burst(0.18, 1800, 0.5);
      tone("square", 180, 60, 0.15, 0.18);
    },
    boom: (big) => {
      burst(big ? 0.9 : 0.5, big ? 900 : 1400, big ? 0.9 : 0.65);
      tone("sine", big ? 90 : 120, 35, big ? 0.7 : 0.4, 0.5);
    },
    hit: () => {
      tone("square", 520, 260, 0.09, 0.12);
    },
    splash: () => {
      burst(0.45, 3500, 0.35, 0, 3);
    },
    item: () => {
      tone("triangle", 660, 0, 0.08, 0.2);
      tone("triangle", 990, 0, 0.12, 0.2, 0.07);
    },
    turn: () => {
      tone("sine", 784, 0, 0.12, 0.22);
      tone("sine", 1175, 0, 0.2, 0.22, 0.1);
    },
    banner: () => {
      tone("sawtooth", 220, 440, 0.35, 0.12);
      tone("sawtooth", 330, 660, 0.35, 0.1, 0.05);
    },
    zap: () => {
      burst(0.25, 6e3, 0.3, 0, 8);
      tone("sawtooth", 1400, 200, 0.2, 0.12);
    },
    tick: () => {
      tone("square", 1200, 0, 0.03, 0.06);
    },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, 0, 0.25, 0.2, i * 0.12)),
    lose: () => [392, 330, 262].forEach((f, i) => tone("triangle", f, 0, 0.3, 0.18, i * 0.16))
  };
  function play(name, arg) {
    if (muted) return;
    const a = ctx();
    if (!a || a.state !== "running") return;
    try {
      SFX[name]?.(arg);
    } catch {
    }
  }
  function setMuted(m) {
    muted = m;
    try {
      localStorage.setItem("sc_mute", m ? "1" : "0");
    } catch {
    }
    if (master) master.gain.value = m ? 0 : 0.5;
  }
  var isMuted = () => muted;

  // ../client/js/battle.js
  var $ = (id) => document.getElementById(id);
  var esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var VW = 960;
  var VH = 480;
  var MM = { w: 216, h: 90, x: VW - 226, y: 10 };
  function createBattle({ socket, me, toast: toast2, onExit, onQuit }) {
    const cv = $("field");
    cv.width = VW * DPR;
    cv.height = VH * DPR;
    const ctx2 = cv.getContext("2d");
    let cam = { x: 0, y: 0 }, camHold = 0, chatLines = [];
    let sim = null, ren = null, start2 = null, bag = [], ssUsed = false, turn = null, deadline = 0, phase = "idle", order = [];
    let lastTick = 0, flags = {}, weapon = 0, power = 0, charging = false, turnItemUsed = false, keys = {}, sentDir = 0, lastAimSent = 0, aimDirty = false, acc = 0, last = 0, running = false;
    const myTank = () => sim?.tankOf(me());
    const mine = () => phase === "aim" && turn?.uid === me();
    function begin(s) {
      start2 = s;
      sim = new Sim({ map: s.mapId });
      MM.h = Math.round(MM.w * sim.h / sim.w);
      s.players.forEach((p) => {
        const t = sim.addTank({ uid: p.uid, tankId: p.tankId, x: p.x, facing: p.facing, team: p.team, name: p.nickname });
      });
      const mp = s.players.find((p) => p.uid === me());
      bag = (mp?.items || []).map((id) => ({ id, used: false }));
      ssUsed = false;
      weapon = 0;
      power = 0;
      charging = false;
      ren = new Renderer(sim, { me: me() });
      ren.onFx = (f) => {
        if (f.type === "fire") play("fire");
        else if (f.type === "boom") play(f.kind === "electric" || f.kind === "beam" ? "zap" : "boom", (f.R || 24) > 34);
        else if (f.type === "float" && /^[^+]*-\d/.test(f.text)) play("hit");
        else if (f.type === "splash") play("splash");
        else if (f.type === "banner") play("banner");
        else if (f.type === "item") play("item");
      };
      phase = "wait";
      turn = null;
      order = [];
      const mt = sim.tankOf(me());
      if (mt) {
        cam.x = mt.x - VW / 2;
        cam.y = mt.y - VH * 0.55;
        clampCam();
      }
      $("resultBox").hidden = true;
      renderWeapons();
      renderItems();
      if (!running) {
        running = true;
        last = performance.now();
        requestAnimationFrame(loop);
      }
    }
    function loadState(st) {
      begin(st.start);
      for (const op of st.ops) {
        sim.applyOp(op);
        sim.ops.push(op);
      }
      ren.rebuild();
      sim.restore(st.snapshot);
      bag = st.bag.map((b) => ({ ...b }));
      ssUsed = !!st.ssUsed;
      flags = { ...st.flags || {} };
      if (st.turn) {
        turn = { uid: st.turn.uid, turnNo: st.turn.turnNo };
        order = st.turn.order || [];
        deadline = performance.now() + st.turn.left * 1e3;
        phase = st.phase === "aim" ? "aim" : "resolve";
      }
      renderWeapons();
      renderItems();
    }
    async function resync() {
      const r = await new Promise((res) => socket().timeout(8e3).emit("game:state", {}, (e, v) => res(e ? null : v)));
      if (r?.ok) loadState(r.state);
    }
    const on = {
      "game:start": (s) => begin(s),
      "game:state": (st) => loadState(st),
      "game:turn": (d) => {
        if (!sim) return resync();
        const t = sim.tankOf(d.uid);
        if (t) sim.turnStart(t);
        sim.wind = d.wind;
        if (d.event) sim.addEvent(d.event);
        if (d.sd) sim.suddenDeath();
        sim.restore(d.snapshot);
        turn = { uid: d.uid, turnNo: d.turnNo };
        deadline = performance.now() + d.seconds * 1e3;
        order = d.order;
        phase = "aim";
        power = 0;
        charging = false;
        turnItemUsed = false;
        sentDir = 0;
        if (d.uid === me()) {
          play("turn");
          flags = { ...d.flags || {} };
          const f = Object.keys(flags).map((k) => ITEM_INFO[k].n);
          toast2(f.length ? `\uB0B4 \uCC28\uB840\uC608\uC694! \uAC78\uB824 \uC788\uB294 \uD6A8\uACFC: ${f.join(", ")}` : "\uB0B4 \uCC28\uB840\uC608\uC694!");
          if (weapon === 2 && !ssReady()) weapon = 0;
        }
        renderWeapons();
        renderItems();
      },
      "game:pos": (d) => {
        const t = sim?.tankOf(d.uid);
        if (!t) return;
        t.x = d.x;
        t.y = d.y;
        t.facing = d.facing;
        t.fuel = d.fuel;
        t.movingVis = d.moving;
        if (d.tilt != null) t.tilt = d.tilt;
        if (d.uid !== me() || !mine()) t.angle = d.angle;
        else sim.clampAngle(t);
      },
      "game:item": (d) => {
        if (!sim) return;
        const t = sim.tankOf(d.uid);
        if (["double", "power", "teleport"].includes(d.id)) sim.float(t.x, t.y - 84, itemById(d.id).n, "#3a2600");
        else sim.useItem(t, d.id);
        sim.restore(d.snapshot);
        if (d.uid === me()) {
          bag[d.index].used = true;
          flags = { ...d.flags || {} };
        }
        turnItemUsed = true;
        renderItems();
        play("item");
      },
      "game:shot": (d) => {
        if (!sim) return;
        sim.restore(d.snapshot);
        const t = sim.tankOf(d.uid);
        t.angle = d.angle;
        t.movingVis = false;
        sim.fire(t, d.slot, d.power, d.opts);
        phase = "resolve";
        charging = false;
        if (d.uid === me() && d.slot === 2) ssUsed = true;
        if (d.uid === me()) flags = {};
        t.lastPower = d.power;
        renderItems();
        renderWeapons();
      },
      "game:sync": (d) => {
        if (!sim) return;
        if (sim.ops.length !== d.ops || opsHash(sim.ops) !== d.hash) return resync();
        sim.restore(d.snapshot);
        phase = "wait";
      },
      "game:pass": (d) => {
        const t = sim?.tankOf(d.uid);
        if (t) sim.float(t.x, t.y - 70, "\uD134 \uB118\uAE40", "#3a2600");
        phase = "wait";
      },
      "game:timeout": (d) => {
        if (d.uid === me()) toast2("\uC2DC\uAC04\uC774 \uB2E4 \uB3FC\uC11C \uCC28\uB840\uAC00 \uB118\uC5B4\uAC14\uC5B4\uC694.", true);
        phase = "wait";
      },
      "game:left": (d) => {
        const t = sim?.tankOf(d.uid);
        if (t) {
          t.left = true;
          t.dead = true;
          sim.float(t.x, t.y - 60, "\uB098\uAC10", "#3a2600");
        }
      },
      "game:over": (d) => {
        phase = "over";
        turn = null;
        setTimeout(() => {
          showResult(d);
          play(d.results.find((r) => r.uid === me())?.win ? "win" : "lose");
        }, 1400);
      },
      "room:chat": (m) => {
        chatLines.push({ from: m.system ? "" : m.from, text: m.text, at: performance.now() });
        if (chatLines.length > 30) chatLines.shift();
      }
    };
    function showResult(d) {
      const meRes = d.results.find((r) => r.uid === me());
      $("resultTitle").textContent = d.winnerTeam == null ? "\uBB34\uC2B9\uBD80" : meRes?.win ? "\uC2B9\uB9AC!" : "\uD328\uBC30";
      $("resultSub").textContent = `${d.turns}\uD134 \xB7 ${d.winnerTeam === "red" ? "\uB808\uB4DC\uD300 \uC2B9\uB9AC" : d.winnerTeam === "blue" ? "\uBE14\uB8E8\uD300 \uC2B9\uB9AC" : d.winnerTeam ? d.results.find((r) => "uid:" + r.uid === d.winnerTeam)?.nickname + " \uC2B9\uB9AC" : "\uBAA8\uB450 \uC4F0\uB7EC\uC84C\uC5B4\uC694"} \xB7 \uC804\uC801\uC774 \uC800\uC7A5\uB410\uC5B4\uC694`;
      $("resultRows").innerHTML = d.results.sort((a, b) => b.win - a.win || b.kills - a.kills || b.dealt - a.dealt).map((r) => `<tr><td class="${r.team}">${r.team === "red" ? "\uB808\uB4DC" : r.team === "blue" ? "\uBE14\uB8E8" : "-"}</td><td>${esc(r.nickname)}${r.uid === me() ? " (\uB098)" : ""}</td><td>${TANK_NAMES[r.tankId]}</td><td>${r.kills}</td><td>${r.dealt.toLocaleString()}</td><td class="${r.win ? "win" : "lose"}">${r.win ? "\uC2B9\uB9AC" : r.left ? "\uB098\uAC10" : r.sunk ? "\uB099\uC0AC" : r.alive ? "\uC0DD\uC874" : "\uD0C8\uB77D"}</td></tr>`).join("");
      $("resultBox").hidden = false;
    }
    $("toRoomBtn").onclick = () => {
      $("resultBox").hidden = true;
      phase = "idle";
      onExit();
    };
    const ssReady = () => {
      const t = myTank();
      return t && !ssUsed && t.hp <= t.max / 2;
    };
    function renderWeapons() {
      const t = myTank();
      if (!t) return;
      $("weapons").innerHTML = SHELL_STATS[t.tankId].map((s, k) => `<button data-w="${k}" aria-pressed="${weapon === k}" ${k === 2 && !ssReady() ? "disabled" : ""}><kbd>${k === 2 ? "SS" : k + 1}</kbd>${s.n} <small>${s.dmg}${s.spread ? "\xD7" + s.spread.length : ""}</small></button>`).join("");
    }
    $("weapons").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b && !b.disabled) {
        weapon = +b.dataset.w;
        renderWeapons();
      }
    });
    function renderItems() {
      const el = $("gameItems");
      el.innerHTML = "";
      let key = 0;
      bag.forEach((b, i) => {
        const it = itemById(b.id), k = "QWERTY"[key];
        key += it.size;
        const btn = document.createElement("button");
        btn.className = `item ${it.size === 2 ? "w2" : ""} ${b.used ? "used" : ""}`;
        btn.disabled = b.used || turnItemUsed || !mine();
        btn.title = it.d;
        const c = document.createElement("canvas");
        c.style.width = c.style.height = "36px";
        c.width = c.height = 36 * DPR;
        const g = c.getContext("2d");
        g.setTransform(DPR, 0, 0, DPR, 0, 0);
        g.translate(18, 18);
        g.scale(36 / 64, 36 / 64);
        drawItemIcon(g, b.id, 0, true);
        btn.append(c);
        btn.insertAdjacentHTML("beforeend", `<div><b><kbd>${k}</kbd> ${it.n}</b><small>${b.used ? "\uC0AC\uC6A9\uD568" : it.tip}</small></div>`);
        btn.onclick = () => useItem(i);
        el.append(btn);
      });
    }
    function useItem(i) {
      if (!mine() || turnItemUsed || bag[i]?.used) return;
      socket().emit("game:item", { index: i }, (r) => {
        if (r && !r.ok) toast2(r.error, true);
      });
    }
    (function ticks() {
      const g = $("dialTicks");
      if (!g || g.childNodes.length) return;
      let h = "";
      for (let d = 0; d < 360; d += 15) {
        const r0 = d % 45 ? 46 : 42, a = d * Math.PI / 180;
        h += `<line x1="${60 + r0 * Math.cos(a)}" y1="${60 - r0 * Math.sin(a)}" x2="${60 + 50 * Math.cos(a)}" y2="${60 - 50 * Math.sin(a)}" stroke="#4a62a0" stroke-width="${d % 45 ? 1 : 1.6}"/>`;
      }
      g.innerHTML = h;
    })();
    function hud() {
      const t = myTank();
      if (!t) return;
      const [lo, hi] = sim.angleRange(t);
      $("deg").textContent = t.angle + "\xB0";
      $("degRange").textContent = `\uC9C0\uAE08 ${lo}~${hi}\xB0` + (t.tilt ? ` (\uAE30\uC6B8\uAE30 ${t.tilt > 0 ? "\uC55E\uC73C\uB85C" : "\uB4A4\uB85C"} ${Math.abs(t.tilt)}\xB0)` : "");
      const P = (d, r) => [60 + r * Math.cos(d * Math.PI / 180), 60 - r * Math.sin(d * Math.PI / 180)];
      const set = (id, d, r) => {
        const [x, y] = P(d, r);
        $(id).setAttribute("x2", x);
        $(id).setAttribute("y2", y);
      };
      set("needle", t.angle, 46);
      set("lineLo", lo, 52);
      set("lineHi", hi, 52);
      const [x1, y1] = P(lo, 50), [x2, y2] = P(hi, 50);
      $("dialRange").setAttribute("d", `M60 60 L${x1} ${y1} A50 50 0 ${hi - lo > 180 ? 1 : 0} 0 ${x2} ${y2} Z`);
      $("dialG").setAttribute("transform", t.facing < 0 ? "translate(120 0) scale(-1 1)" : "");
      $("dialLo").textContent = lo;
      $("dialHi").textContent = hi;
      $("powFill").style.width = power + "%";
      $("powNum").textContent = Math.round(power);
      $("powLast").hidden = t.lastPower == null;
      $("powLast").style.left = (t.lastPower || 0) + "%";
      $("fuelFill").style.width = Math.min(100, t.fuel) + "%";
      $("fuelNum").textContent = Math.round(t.fuel);
      $("hpFill").style.width = t.hp / t.max * 100 + "%";
      $("hpNum").textContent = t.hp;
      $("delayNum").textContent = t.delay;
      const cur = turn && sim.tankOf(turn.uid), chip = $("turnChip");
      chip.textContent = phase === "over" ? "\uAC8C\uC784 \uB05D" : !cur ? "\uC900\uBE44 \uC911" : cur.uid === me() ? "\uB0B4 \uCC28\uB840" : `${cur.name} \uCC28\uB840`;
      chip.classList.toggle("mine", mine());
      const left = Math.max(0, Math.ceil((deadline - performance.now()) / 1e3));
      $("timer").textContent = phase === "aim" ? left : "\u2013";
      if (mine() && left <= 5 && left > 0 && left !== lastTick) {
        lastTick = left;
        play("tick");
      }
      const names = order.map((uid) => sim.tankOf(uid)).filter(Boolean);
      $("order").innerHTML = `${sim.map.n} \xB7 \uD134 ${turn?.turnNo || 0} \xB7 \uC21C\uC11C ` + names.map((x) => `<span class="${x.uid === turn?.uid ? "cur" : ""}">${esc(x.name)}</span>`).join("");
      const fl = Object.keys(flags).map((k) => ITEM_INFO[k].n);
      $("flags").textContent = fl.length ? "\uB300\uAE30 \uC911 \uD6A8\uACFC: " + fl.join(" + ") : "";
      $("flags").hidden = !fl.length;
      $("passBtn").disabled = !mine();
      const ssBtn = document.querySelector('#weapons [data-w="2"]');
      if (ssBtn && ssBtn.disabled === ssReady()) renderWeapons();
    }
    function loop(now2) {
      if (!running) return;
      const dt = Math.min(0.1, (now2 - last) / 1e3);
      last = now2;
      if (sim && !$("s-game").hidden) {
        acc = Math.min(acc + dt, 0.5);
        while (acc >= DT) {
          acc -= DT;
          sim.step(DT);
        }
        ren.update(dt);
        if (mine()) {
          const t = myTank(), dir = keys.left ? -1 : keys.right ? 1 : 0;
          if (dir !== sentDir) {
            sentDir = dir;
            socket().emit("game:move", { dir });
          }
          if (keys.up || keys.down) {
            t.aimAcc = (t.aimAcc || 0) + 30 * dt;
            while (t.aimAcc >= 1) {
              t.aimAcc--;
              t.angle += keys.up ? 1 : -1;
              sim.clampAngle(t);
              aimDirty = true;
            }
          }
          if (aimDirty && now2 - lastAimSent > 80) {
            aimDirty = false;
            lastAimSent = now2;
            socket().emit("game:aim", { angle: t.angle });
          }
          if (charging) power = Math.min(100, power + 55 * dt);
        }
        updateCam(dt);
        ctx2.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx2.save();
        ctx2.translate(-Math.round(cam.x), -Math.round(cam.y));
        ren.draw(ctx2, { active: phase !== "over" ? turn?.uid : null, cam, vw: VW, vh: VH });
        if (mine() && !myTank().dead) ren.drawAimFan(ctx2, myTank());
        ctx2.restore();
        ren.drawBanner(ctx2, VW, VH);
        ren.drawWind(ctx2, VW / 2, 40);
        drawMinimap();
        drawRoster();
        drawChat(now2);
        drawOffscreen();
        hud();
      }
      requestAnimationFrame(loop);
    }
    function clampCam() {
      cam.x = Math.max(0, Math.min(sim.w - VW, cam.x));
      cam.y = Math.max(0, Math.min(sim.h - VH, cam.y));
    }
    function camGoal() {
      if (sim.specials.length) {
        const s = sim.specials[0];
        return [s.wx ?? s.x, (s.gy ?? s.y) - 140];
      }
      if (sim.shells.length) {
        const s = sim.shells[0];
        return [s.x + s.vx * 0.25, s.y];
      }
      const t = turn && sim.tankOf(turn.uid);
      if (t && !t.sunk) return [t.x, t.y - 60];
      return null;
    }
    function updateCam(dt) {
      if (camHold > 0 && !sim.shells.length && !sim.specials.length) {
        camHold -= dt;
        return;
      }
      const g = camGoal();
      if (!g) return;
      const k = Math.min(1, dt * (sim.shells.length ? 5 : 3));
      cam.x += (g[0] - VW / 2 - cam.x) * k;
      cam.y += (g[1] - VH * 0.55 - cam.y) * k;
      clampCam();
    }
    function toCanvas(e) {
      const r = cv.getBoundingClientRect();
      return [(e.clientX - r.left) * VW / r.width, (e.clientY - r.top) * VH / r.height];
    }
    let drag = null;
    cv.addEventListener("pointerdown", (e) => {
      if (!sim) return;
      const [x, y] = toCanvas(e);
      if (x >= MM.x && x <= MM.x + MM.w && y >= MM.y && y <= MM.y + MM.h) {
        cam.x = (x - MM.x) / MM.w * sim.w - VW / 2;
        cam.y = (y - MM.y) / MM.h * sim.h - VH / 2;
        clampCam();
        camHold = 3;
        return;
      }
      drag = { x, y, cx: cam.x, cy: cam.y };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const [x, y] = toCanvas(e);
      cam.x = drag.cx - (x - drag.x);
      cam.y = drag.cy - (y - drag.y);
      clampCam();
      camHold = 3;
    });
    ["pointerup", "pointercancel"].forEach((ev) => cv.addEventListener(ev, () => drag = null));
    const teamCol = (t) => t.team === "red" ? "#ff6a55" : t.team === "blue" ? "#55aef0" : t.uid === me() ? "#ffb703" : "#f4efe1";
    function drawMinimap() {
      const c = ctx2, { x, y, w, h } = MM, k = w / sim.w;
      c.save();
      c.globalAlpha = 0.92;
      c.fillStyle = "rgba(20,28,52,.85)";
      c.fillRect(x - 3, y - 3, w + 6, h + 6);
      c.drawImage(ren.sky, x, y, w, h);
      c.drawImage(ren.fg, x, y, w, h);
      if (sim.map.liquid && sim.map.liquid.type !== "void" || sim.sdLiquid) {
        c.fillStyle = sim.map.liquid?.type === "lava" ? "rgba(255,120,40,.8)" : "rgba(80,160,230,.8)";
        c.fillRect(x, y + sim.liquidY * k, w, h - sim.liquidY * k);
      }
      c.globalAlpha = 1;
      sim.events.forEach((e) => {
        c.fillStyle = e.type === "pillar" ? "#ff7a3c" : "#e6eef5";
        c.fillRect(x + e.x * k - 1.5, y + (e.gy ?? sim.h) * k - 14, 3, 14);
      });
      sim.tanks.forEach((t) => {
        if (t.left || t.sunk) return;
        c.fillStyle = t.dead ? "#555" : teamCol(t);
        c.beginPath();
        c.arc(x + t.x * k, y + t.y * k - 3, t.uid === turn?.uid ? 4 : 3, 0, 7);
        c.fill();
      });
      sim.shells.forEach((s) => {
        c.fillStyle = "#fff";
        c.fillRect(x + s.x * k - 1.5, y + s.y * k - 1.5, 3, 3);
      });
      c.strokeStyle = "#ffd34d";
      c.lineWidth = 1.5;
      c.strokeRect(x + cam.x * k, y + cam.y * k, VW * k, VH * k);
      c.strokeStyle = "rgba(255,255,255,.35)";
      c.lineWidth = 1;
      c.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
      c.restore();
    }
    function drawRoster() {
      const c = ctx2, x0 = MM.x, y0 = MM.y + MM.h + 14;
      c.save();
      c.font = '600 12.5px "Noto Sans KR", sans-serif';
      c.textAlign = "left";
      c.lineJoin = "round";
      sim.tanks.forEach((t, i) => {
        const y = y0 + i * 18, txt = (t.uid === turn?.uid ? "\u25B6 " : "") + t.name + (t.left ? " (\uB098\uAC10)" : t.dead ? " (\uD0C8\uB77D)" : "");
        c.lineWidth = 3;
        c.strokeStyle = "rgba(20,20,35,.75)";
        c.strokeText(txt, x0, y);
        c.fillStyle = t.dead ? "#9aa0ad" : teamCol(t);
        c.fillText(txt, x0, y);
        if (!t.dead) {
          c.fillStyle = "rgba(20,28,52,.7)";
          c.fillRect(x0 + 140, y - 8, 70, 6);
          c.fillStyle = t.hp / t.max > 0.5 ? "#3fae4a" : t.hp / t.max > 0.25 ? "#f0a020" : "#d63c3c";
          c.fillRect(x0 + 140, y - 8, 70 * t.hp / t.max, 6);
        }
      });
      c.restore();
    }
    function drawChat(now2) {
      const c = ctx2, lines = chatLines.filter((l) => now2 - l.at < 15e3).slice(-6);
      c.save();
      c.font = '13px "Noto Sans KR", sans-serif';
      c.textAlign = "left";
      c.lineJoin = "round";
      lines.forEach((l, i) => {
        const a = Math.min(1, (15e3 - (now2 - l.at)) / 2e3), y = 26 + i * 19;
        c.globalAlpha = a;
        const s = l.from ? `[${l.from}] ${l.text}` : l.text;
        c.lineWidth = 3.5;
        c.strokeStyle = "rgba(15,20,40,.8)";
        c.strokeText(s, 14, y);
        c.fillStyle = l.from ? "#f4efe1" : "#ffd34d";
        c.fillText(s, 14, y);
      });
      c.restore();
    }
    function drawOffscreen() {
      const c = ctx2;
      sim.tanks.forEach((t) => {
        if (t.dead) return;
        const sx = t.x - cam.x, sy = t.y - 20 - cam.y;
        if (sx >= 0 && sx <= VW && sy >= 0 && sy <= VH) return;
        const x = Math.max(14, Math.min(VW - 14, sx)), y = Math.max(14, Math.min(VH - 14, sy)), a = Math.atan2(sy - y, sx - x);
        c.save();
        c.translate(x, y);
        c.rotate(a);
        c.fillStyle = teamCol(t);
        c.strokeStyle = "rgba(20,20,35,.8)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(10, 0);
        c.lineTo(-6, -7);
        c.lineTo(-6, 7);
        c.closePath();
        c.fill();
        c.stroke();
        c.restore();
      });
    }
    const active = () => !$("s-game").hidden && sim;
    function pass() {
      if (!mine()) return;
      charging = false;
      socket().emit("game:pass", {}, (r) => {
        if (r && !r.ok) toast2(r.error, true);
      });
    }
    $("passBtn").onclick = pass;
    const muteBtn = $("muteBtn");
    const muteLabel = () => muteBtn.textContent = isMuted() ? "\uC18C\uB9AC \uCF1C\uAE30" : "\uC18C\uB9AC \uB044\uAE30";
    muteLabel();
    muteBtn.onclick = () => {
      setMuted(!isMuted());
      muteLabel();
    };
    let quitArm = 0;
    const quitBtn = $("quitBtn");
    quitBtn.onclick = () => {
      if (phase === "over" || phase === "idle") return;
      if (performance.now() - quitArm > 3e3) {
        quitArm = performance.now();
        quitBtn.textContent = "\uD55C \uBC88 \uB354 \uB204\uB974\uBA74 \uB098\uAC00\uC694";
        setTimeout(() => quitBtn.textContent = "\uAC8C\uC784 \uB098\uAC00\uAE30", 3e3);
        return;
      }
      phase = "idle";
      quitBtn.textContent = "\uAC8C\uC784 \uB098\uAC00\uAE30";
      socket().emit("room:leave", {}, () => (onQuit || onExit)());
    };
    $("gameChat").addEventListener("submit", (e) => {
      e.preventDefault();
      const i = $("gameMsg");
      if (!i.value.trim()) {
        i.blur();
        return;
      }
      socket().emit("room:chat", { text: i.value }, (r) => {
        if (r && !r.ok) toast2(r.error, true);
      });
      i.value = "";
      i.blur();
    });
    function startCharge() {
      if (mine() && !charging) {
        charging = true;
        power = 0;
      }
    }
    function release() {
      if (!charging) return;
      charging = false;
      if (!mine()) return;
      const t = myTank();
      socket().emit("game:aim", { angle: t.angle });
      socket().emit("game:fire", { slot: weapon, power: Math.max(1, power) }, (r) => {
        if (r && !r.ok) toast2(r.error, true);
      });
    }
    const KEYMAP = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
    addEventListener("keydown", (e) => {
      if (!active() || e.target.matches("input, select, textarea")) return;
      if (e.key === "Enter") {
        e.preventDefault();
        keys = {};
        $("gameMsg").focus();
        return;
      }
      const k = KEYMAP[e.key];
      if (k) {
        keys[k] = true;
        e.preventDefault();
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) startCharge();
      }
      if (e.key.toLowerCase() === "p" && !e.repeat) pass();
      if (e.key === "1") {
        weapon = 0;
        renderWeapons();
      }
      if (e.key === "2") {
        weapon = 1;
        renderWeapons();
      }
      if (e.key === "3" && ssReady()) {
        weapon = 2;
        renderWeapons();
      }
      const qi = "qwerty".indexOf(e.key.toLowerCase());
      if (qi >= 0 && !e.repeat) {
        let c = 0;
        bag.forEach((b, i) => {
          if (c === qi) useItem(i);
          c += itemById(b.id).size;
        });
      }
    });
    addEventListener("keyup", (e) => {
      const k = KEYMAP[e.key];
      if (k) keys[k] = false;
      if (e.code === "Space" && active()) {
        e.preventDefault();
        release();
      }
    });
    addEventListener("blur", () => {
      keys = {};
    });
    document.querySelectorAll("[data-hold]").forEach((b) => {
      const k = b.dataset.hold;
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        keys[k] = true;
        b.setPointerCapture(e.pointerId);
      });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => b.addEventListener(ev, () => keys[k] = false));
    });
    const fb = $("fireBtn");
    fb.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      fb.setPointerCapture(e.pointerId);
      startCharge();
    });
    fb.addEventListener("pointerup", release);
    fb.addEventListener("pointercancel", release);
    return { on, inGame: () => phase !== "idle" && phase !== "over" };
  }

  // ../mockup/practice.js
  var ME = 1;
  var AI = 2;
  var session = null;
  var battle = null;
  var timer = null;
  var aiTimer = null;
  var now = () => performance.now();
  var fakeSocket = {
    connected: true,
    emit(ev, data = {}, cb) {
      const reply = (r) => cb && cb(r);
      try {
        if (!session) throw new Error("\uAC8C\uC784\uC774 \uC5C6\uC5B4\uC694.");
        if (ev === "game:state") return reply({ ok: true, state: session.fullState(ME) });
        if (ev === "game:move") session.onMove(ME, data.dir);
        if (ev === "game:aim") session.onAim(ME, data.angle);
        if (ev === "game:fire") session.onFire(ME, data.slot, data.power);
        if (ev === "game:item") session.onItem(ME, data.index);
        if (ev === "game:pass") session.onPass(ME);
        if (ev === "room:leave") {
          session.playerLeft(ME);
          clearInterval(timer);
        }
        if (ev === "room:chat") {
          const text = String(data.text || "").slice(0, 200);
          queueMicrotask(() => battle.on["room:chat"]({ from: "\uD3EC\uD0C4\uC655", text }));
          if (Math.random() < 0.5) setTimeout(() => battle.on["room:chat"]({ from: "\uC5F0\uC2B5 \uC0C1\uB300", text: ["\u314B\u314B \uBC14\uB78C \uC798 \uBD10", "\uC774\uBC88\uC5D4 \uB9DE\uD78C\uB2E4", "\uC88B\uC740 \uC0F7\uC778\uB370?", "\uAD6C\uB369\uC774 \uC870\uC2EC\uD574\uB77C"][Math.floor(Math.random() * 4)] }), 900);
        }
        reply({ ok: true });
      } catch (e) {
        reply({ ok: false, error: e.message });
      }
    },
    timeout() {
      return { emit: (ev, data, cb) => this.emit(ev, data, (r) => cb(null, r)) };
    }
  };
  function toast(msg, err) {
    let t = document.querySelector(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      document.body.append(t);
    }
    t.textContent = msg;
    t.classList.toggle("err", !!err);
    t.hidden = false;
    clearTimeout(t._h);
    t._h = setTimeout(() => t.hidden = true, 2400);
  }
  function start(cfg) {
    clearInterval(timer);
    clearTimeout(aiTimer);
    const foeTank = cfg.tank === "laser" ? "hammer" : "laser";
    session = new GameSession({ roomId: 1, mapId: cfg.map, mode: "team", turnSeconds: 20, players: [
      { userId: ME, nickname: "\uD3EC\uD0C4\uC655", team: "red", tankId: cfg.tank, items: cfg.bag },
      { userId: AI, nickname: "\uC5F0\uC2B5 \uC0C1\uB300", team: "blue", tankId: foeTank, items: ["repair", "power", "double", "shield"], bot: true }
    ] }, {
      now,
      send: (ev, d) => {
        queueMicrotask(() => battle.on[ev]?.(JSON.parse(JSON.stringify(d))));
      },
      onOver: () => {
      }
    });
    battle.on["game:start"](session.startInfo());
    let last = now(), acc = 0;
    timer = setInterval(() => {
      const t = now();
      acc = Math.min(acc + (t - last) / 1e3, 0.25);
      last = t;
      while (acc >= DT) {
        acc -= DT;
        session.tick(DT);
      }
    }, 1e3 / 60);
  }
  battle = createBattle({ socket: () => fakeSocket, me: () => ME, toast, onExit: () => {
    location.hash = "room";
  } });
  var lastCfg = null;
  window.practice = { start: (cfg) => {
    lastCfg = cfg;
    start(cfg);
  } };
  var maybeStart = () => {
    if (location.hash === "#game" && (!session || session.phase === "over")) window.practice.start(lastCfg || { tank: "hammer", map: "valley", bag: ["double", "teleport", "power", "repair"] });
  };
  addEventListener("hashchange", maybeStart);
  maybeStart();
})();
