// Squiggles glyph recognizer: template matching over resampled strokes.
(function (root) {
  const N = 48;
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function pathLen(p) { let d = 0; for (let i = 1; i < p.length; i++) d += dist(p[i - 1], p[i]); return d; }
  function resample(pts, n) {
    const I = pathLen(pts) / (n - 1); let D = 0; const out = [{ x: pts[0].x, y: pts[0].y }];
    const p = pts.map(q => ({ x: q.x, y: q.y }));
    for (let i = 1; i < p.length; i++) {
      const d = dist(p[i - 1], p[i]);
      if (D + d >= I && d > 0) {
        const t = (I - D) / d;
        const q = { x: p[i - 1].x + t * (p[i].x - p[i - 1].x), y: p[i - 1].y + t * (p[i].y - p[i - 1].y) };
        out.push(q); p.splice(i, 0, q); D = 0;
      } else D += d;
    }
    while (out.length < n) out.push({ x: p[p.length - 1].x, y: p[p.length - 1].y });
    return out.slice(0, n);
  }
  function bbox(p) {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const q of p) { a = Math.min(a, q.x); b = Math.min(b, q.y); c = Math.max(c, q.x); d = Math.max(d, q.y); }
    return { x: a, y: b, w: c - a, h: d - b };
  }
  // Scale each axis to unit size, but never amplify a thin axis more than 3x relative to the long one.
  function normalize(pts) {
    const p = resample(pts, N); const bb = bbox(p); const m = Math.max(bb.w, bb.h) || 1;
    const sx = Math.max(bb.w, m * 0.33), sy = Math.max(bb.h, m * 0.33);
    let cx = 0, cy = 0; for (const q of p) { cx += q.x; cy += q.y; } cx /= N; cy /= N;
    return p.map(q => ({ x: (q.x - cx) / sx, y: (q.y - cy) / sy }));
  }
  function rotate(p, a) { const c = Math.cos(a), s = Math.sin(a); return p.map(q => ({ x: q.x * c - q.y * s, y: q.x * s + q.y * c })); }
  function avgDist(a, b) { let d = 0; for (let i = 0; i < N; i++) d += dist(a[i], b[i]); return d / N; }

  // ---- Template shapes (y grows downward, like the screen) ----
  function poly(vs, closed) { const p = vs.map(([x, y]) => ({ x, y })); if (closed) p.push({ x: vs[0][0], y: vs[0][1] }); return densify(p); }
  function densify(p) { const o = []; for (let i = 0; i < p.length - 1; i++) for (let t = 0; t < 10; t++) o.push({ x: p[i].x + (p[i + 1].x - p[i].x) * t / 10, y: p[i].y + (p[i + 1].y - p[i].y) * t / 10 }); o.push(p[p.length - 1]); return o; }
  function fn(f, n = 120) { const o = []; for (let i = 0; i <= n; i++) o.push(f(i / n)); return o; }
  function mirror(p) { return p.map(q => ({ x: -q.x, y: q.y })); }

  const zig = k => { const v = []; for (let i = 0; i <= k * 2; i++) v.push([i, i % 2 ? 0 : 1]); return poly(v); };
  const SHAPES = {
    peak:   { closed: false, t: [poly([[0, 1], [0.5, 0], [1, 1]])] },
    saw:    { closed: false, t: [zig(2), zig(3), zig(4), mirror(zig(2)).map(q => ({ x: q.x, y: 1 - q.y }))] },
    ring:   { closed: true,  t: [fn(t => ({ x: Math.cos(t * 6.283), y: Math.sin(t * 6.283) }))] },
    pyramid:{ closed: true,  t: [poly([[0.5, 0], [1, 1], [0, 1]], true)] },
    block:  { closed: true,  t: [poly([[0, 0], [1, 0], [1, 1], [0, 1]], true)] },
    swirl:  { closed: false, t: [2, 2.6, 3.2].map(turns => fn(t => { const a = t * turns * 6.283; const r = 0.08 + t; return { x: r * Math.cos(a), y: r * Math.sin(a) }; }, 200))
                               .flatMap(p => [p, mirror(p)]) },
    key:    { closed: false, t: [poly([[0, 0], [0, 1], [1, 1], [1, 0], [2, 0], [2, 1]]), poly([[0, 1], [0, 0], [1, 0], [1, 1], [2, 1], [2, 0]]),
                                 poly([[0, 0], [0, 1], [1, 1], [1, 0]]).map(q => q) ] },
  };
  // key: square "meander" step from the drawing's bottom row
  SHAPES.key.t = [poly([[0, 0], [0, 1], [1, 1], [1, 0], [2, 0], [2, 1], [3, 1]]), poly([[0, 1], [0, 0], [1, 0], [1, 1], [2, 1], [2, 0], [3, 0]]),
                  poly([[0, 0], [0, 1], [1, 1], [1, 0], [2, 0], [2, 1]]), poly([[0, 1], [0, 0], [1, 0], [1, 1], [2, 1], [2, 0]])];

  const TEMPLATES = [];
  for (const [name, s] of Object.entries(SHAPES)) for (const t of s.t) {
    const n = normalize(t); TEMPLATES.push({ name, closed: s.closed, p: n });
    TEMPLATES.push({ name, closed: s.closed, p: n.slice().reverse() });
  }

  function smooth(pts) {
    const p = resample(pts, 64); const o = [];
    for (let i = 0; i < p.length; i++) { let x = 0, y = 0, c = 0; for (let j = Math.max(0, i - 2); j <= Math.min(p.length - 1, i + 2); j++) { x += p[j].x; y += p[j].y; c++; } o.push({ x: x / c, y: y / c }); }
    o[0] = p[0]; o[o.length - 1] = p[p.length - 1]; return o;
  }
  function corners(p) {
    const turn = []; const K = 3;
    for (let i = 0; i < p.length; i++) {
      if (i < K || i >= p.length - K) { turn.push(0); continue; }
      const a = Math.atan2(p[i].y - p[i - K].y, p[i].x - p[i - K].x), b = Math.atan2(p[i + K].y - p[i].y, p[i + K].x - p[i].x);
      let d = Math.abs(b - a); if (d > Math.PI) d = 2 * Math.PI - d; turn.push(d);
    }
    let c = 0;
    for (let i = 0; i < turn.length; i++) {
      if (turn[i] < 1.0) continue;
      let isMax = true; for (let j = Math.max(0, i - 4); j <= Math.min(turn.length - 1, i + 4); j++) if (turn[j] > turn[i] || (turn[j] === turn[i] && j < i)) isMax = false;
      if (isMax) c++;
    }
    return c;
  }
  // 1 when every segment runs horizontal/vertical, -1 when every segment runs at 45 degrees
  function axisness(p) {
    let s = 0, w = 0;
    for (let i = 2; i < p.length; i += 2) { const dx = p[i].x - p[i - 2].x, dy = p[i].y - p[i - 2].y, l = Math.hypot(dx, dy); if (!l) continue; s += Math.cos(4 * Math.atan2(dy, dx)) * l; w += l; }
    return w ? s / w : 0;
  }
  const CORNERS = { peak: [1, 1], saw: [3, 9], ring: [0, 0], pyramid: [2, 3], block: [3, 4], swirl: [0, 2], key: [4, 7] };

  function lineCheck(pts) {
    const L = pathLen(pts), e = dist(pts[0], pts[pts.length - 1]);
    if (L < 1 || e / L < 0.88) return null;
    const ang = Math.abs(Math.atan2(pts[pts.length - 1].y - pts[0].y, pts[pts.length - 1].x - pts[0].x)) * 180 / Math.PI;
    const a = ang > 90 ? 180 - ang : ang;
    if (a < 25) return 'rule';
    if (a > 65) return 'pillar';
    return 'slash';
  }

  function recognize(raw, allowed) {
    if (!raw || raw.length < 4) return null;
    const bb = bbox(raw); const size = Math.max(bb.w, bb.h);
    if (size < 18) return null;
    raw = smooth(raw);
    const ln = lineCheck(raw);
    const nc = corners(raw), ax = axisness(raw);
    if (ln) return { name: ln, score: 1 };
    if (allowed && !allowed.some(a => SHAPES[a])) return { name: null };
    let p = normalize(raw);
    const closed = dist(raw[0], raw[raw.length - 1]) < size * 0.3;
    let best = { name: null, d: Infinity }, second = Infinity; const per = {};
    for (const T of TEMPLATES) {
      if (allowed && !allowed.includes(T.name)) continue;
      let d = Infinity;
      const shifts = T.closed && closed ? 12 : 1;
      for (let s = 0; s < shifts; s++) {
        const k = Math.round(s * N / shifts);
        const q = k ? p.slice(k).concat(p.slice(0, k)) : p;
        const qn = k ? normalize(q) : q;
        for (const a of [-0.25, 0, 0.25]) d = Math.min(d, avgDist(a ? rotate(qn, a) : qn, T.p));
      }
      if (T.closed && !closed) d *= 1.35;
      if (!T.closed && closed && T.name !== 'swirl') d *= 1.25;
      const [lo, hi] = CORNERS[T.name]; d += 0.06 * Math.max(0, lo - nc, nc - hi);
      if (T.name === 'key') d += 0.25 * Math.max(0, 0.45 - ax);
      if (T.name === 'saw') d += 0.25 * Math.max(0, ax - 0.35);
      per[T.name] = Math.min(per[T.name] ?? Infinity, d);
    }
    const ranked = Object.entries(per).sort((a, b) => a[1] - b[1]);
    best = { name: ranked[0][0], d: ranked[0][1] }; second = ranked[1] ? ranked[1][1] : Infinity;
    if (best.d > 0.42) return { name: null, d: best.d, guess: best.name };
    return { name: best.name, score: 1 - best.d, d: best.d, margin: second - best.d, corners: nc };
  }

  const api = { recognize, SHAPES, normalize, corners, smooth };
  if (typeof module !== 'undefined') module.exports = api; else root.Glyphs = api;
})(this);
