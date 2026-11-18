// 캔버스 없이 도형을 칸(재질 번호) 격자에 칠하는 작은 그리기 도구.
// 서버(Node)와 브라우저가 똑같은 지형을 만들도록 맵 그리기와 땅 파기에 함께 쓴다.
const TAU = Math.PI * 2;

export class MaskCtx {
  constructor(grid, w, h) { this.grid = grid; this.w = w; this.h = h; this.fillStyle = 1; this.globalCompositeOperation = 'source-over'; this.paths = []; this.cur = null; this.keep = null; }
  beginPath() { this.paths = []; this.cur = null; }
  moveTo(x, y) { this.cur = [[x, y]]; this.paths.push(this.cur); }
  lineTo(x, y) { if (!this.cur) return this.moveTo(x, y); this.cur.push([x, y]); }
  closePath() { if (this.cur && this.cur.length) this.cur.push([...this.cur[0]]); }
  _last() { return this.cur && this.cur.length ? this.cur[this.cur.length - 1] : [0, 0]; }
  quadraticCurveTo(cx, cy, x, y) { const [x0, y0] = this._last(); for (let i = 1; i <= 16; i++) { const t = i / 16, u = 1 - t; this.lineTo(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y); } }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) { const [x0, y0] = this._last(); for (let i = 1; i <= 20; i++) { const t = i / 20, u = 1 - t; this.lineTo(u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x, u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y); } }
  arc(x, y, r, a0, a1, ccw) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw) {
    let span = a1 - a0;
    if (!ccw && span < 0) span += TAU * Math.ceil(-span / TAU); if (ccw && span > 0) span -= TAU * Math.ceil(span / TAU);
    if (Math.abs(span) >= TAU) span = ccw ? -TAU : TAU;
    const n = Math.max(8, Math.ceil(Math.abs(span) / TAU * 48)), cr = Math.cos(rot), sr = Math.sin(rot);
    for (let i = 0; i <= n; i++) { const a = a0 + span * i / n, px = Math.cos(a) * rx, py = Math.sin(a) * ry; const X = x + px * cr - py * sr, Y = y + px * sr + py * cr; i === 0 && !this.cur ? this.moveTo(X, Y) : this.lineTo(X, Y); }
  }
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  fillRect(x, y, w, h) { const save = this.paths; this.paths = []; this.rect(x, y, w, h); this.fill(); this.paths = save; }
  fill() {
    const v = this.globalCompositeOperation === 'destination-out' ? 0 : this.fillStyle;
    fillPolys(this.grid, this.w, this.h, this.paths, v, this.keep);
  }
}

// 0이 아닌 감김 규칙으로 다각형들을 칠한다. keep(재질 번호)은 지우지 않는다(철판 보호)
export function fillPolys(grid, W, H, polys, value, keep) {
  const edges = [];
  let ymin = Infinity, ymax = -Infinity;
  for (const p of polys) for (let i = 0; i + 1 < p.length; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[i + 1]; if (y0 === y1) continue;
    edges.push(y0 < y1 ? [x0, y0, x1, y1, 1] : [x1, y1, x0, y0, -1]);
    ymin = Math.min(ymin, y0, y1); ymax = Math.max(ymax, y0, y1);
  }
  // 닫히지 않은 경로도 닫아서 칠한다
  for (const p of polys) if (p.length > 2) { const [x0, y0] = p[p.length - 1], [x1, y1] = p[0]; if ((x0 !== x1 || y0 !== y1) && y0 !== y1) { edges.push(y0 < y1 ? [x0, y0, x1, y1, 1] : [x1, y1, x0, y0, -1]); } }
  const y0 = Math.max(0, Math.floor(ymin)), y1 = Math.min(H - 1, Math.ceil(ymax));
  const xs = [];
  for (let y = y0; y <= y1; y++) {
    const sy = y + .5; xs.length = 0;
    for (const e of edges) if (sy >= e[1] && sy < e[3]) xs.push([e[0] + (sy - e[1]) * (e[2] - e[0]) / (e[3] - e[1]), e[4]]);
    if (!xs.length) continue;
    xs.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i][1];
      if (wind !== 0) {
        const a = Math.max(0, Math.ceil(xs[i][0] - .5)), b = Math.min(W - 1, Math.floor(xs[i + 1][0] - .5)), row = y * W;
        for (let x = a; x <= b; x++) if (keep == null || grid[row + x] !== keep) grid[row + x] = value;
      }
    }
  }
}

// 울퉁불퉁한 원(폭발 구덩이) 다각형. 서버와 화면이 같은 모양을 쓴다
export const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export function raggedPoly(x, y, r, ry, extra = 0) {
  const seed = Math.floor(x * 7 + y * 3), n = 30, pts = [];
  for (let i = 0; i <= n; i++) { const a = i / n * TAU, k = 1 + (hash(seed + i % n) - .5) * .18; pts.push([x + Math.cos(a) * (r * k + extra), y + Math.sin(a) * (ry * k + extra)]); }
  return pts;
}
