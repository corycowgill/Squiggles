// Squiggles — a glyph-drawing defense game, inspired by a ballpoint doodle of a ziggurat.
(() => {
  'use strict';
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  const css = getComputedStyle(document.documentElement);
  const C = {
    paper: css.getPropertyValue('--paper').trim() || '#f2f1ea',
    ink: css.getPropertyValue('--ink').trim() || '#26222f',
    pen: css.getPropertyValue('--pen').trim() || '#2c3a91',
    maroon: css.getPropertyValue('--maroon').trim() || '#4b1c24',
    red: css.getPropertyValue('--redpencil').trim() || '#b13a2c',
  };
  const HAND = '"Reenie Beanie", "Segoe Print", "Comic Sans MS", cursive';
  const BODY = '"Patrick Hand", "Segoe Print", "Comic Sans MS", cursive';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- glyph catalogue ----------
  const GLYPHS = {
    pillar:  { label: 'Pillar' },
    rule:    { label: 'Rule' },
    peak:    { label: 'Peak' },
    ring:    { label: 'Ring' },
    pyramid: { label: 'Pyramid' },
    saw:     { label: 'Sawtooth' },
    swirl:   { label: 'Swirl' },
    slash:   { label: 'Hatch' },
    block:   { label: 'Block' },
    key:     { label: 'Meander' },
  };
  // Wave at which each glyph joins the pool.
  const UNLOCK = { pillar: 1, rule: 1, peak: 1, ring: 2, pyramid: 3, saw: 4, swirl: 6, slash: 7, block: 8, key: 9 };
  const ORDER = Object.keys(UNLOCK);

  // Unit glyph shapes, centred on 0,0 within roughly [-0.5, 0.5].
  function glyphPts(name) {
    const P = [];
    switch (name) {
      case 'rule': return [[-0.5, 0], [0.5, 0]];
      case 'pillar': return [[0, -0.5], [0, 0.5]];
      case 'slash': return [[-0.4, 0.4], [0.4, -0.4]];
      case 'peak': return [[-0.45, 0.38], [0, -0.42], [0.45, 0.38]];
      case 'saw': for (let i = 0; i <= 6; i++) P.push([-0.5 + i / 6, i % 2 ? -0.3 : 0.3]); return P;
      case 'ring': for (let i = 0; i <= 40; i++) { const a = -Math.PI / 2 - i / 40 * Math.PI * 2; P.push([Math.cos(a) * 0.43, Math.sin(a) * 0.43]); } return P;
      case 'pyramid': return [[0, -0.42], [0.46, 0.38], [-0.46, 0.38], [0, -0.42]];
      case 'block': return [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4], [-0.4, -0.4]];
      case 'swirl': for (let i = 0; i <= 80; i++) { const t = i / 80, a = t * Math.PI * 2 * 2.3; P.push([Math.cos(a) * (0.04 + t * 0.44), Math.sin(a) * (0.04 + t * 0.44)]); } return P;
      case 'key': return [[-0.5, -0.3], [-0.5, 0.3], [-0.17, 0.3], [-0.17, -0.3], [0.17, -0.3], [0.17, 0.3], [0.5, 0.3]];
    }
    return [];
  }
  const GLYPH_CACHE = {};
  for (const g of ORDER) GLYPH_CACHE[g] = subdivide(glyphPts(g), 0.08);

  // ---------- hand-drawn line helpers ----------
  let boil = 0, boilT = 0;
  function hsh(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; }
  function subdivide(pts, step) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / step));
      for (let k = 0; k < n; k++) out.push([x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n]);
    }
    if (pts.length) out.push(pts[pts.length - 1]);
    return out;
  }
  // Draws a jittered polyline. Jitter re-rolls every "boil" frame so linework shimmers like hand-drawn animation.
  function ink(pts, o = {}) {
    const amp = o.amp ?? 1.1, seed = o.seed ?? 0, b = o.still ? 0 : boil;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const k = seed * 13.71 + i * 3.17 + b * 101.3;
      const x = pts[i][0] + hsh(k) * amp, y = pts[i][1] + hsh(k + 57.3) * amp;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    if (o.close) ctx.closePath();
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.color !== null) {
      ctx.strokeStyle = o.color || C.ink; ctx.lineWidth = o.w ?? 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.globalAlpha *= 1; ctx.stroke();
    }
  }
  const L = (x1, y1, x2, y2, step = 10) => subdivide([[x1, y1], [x2, y2]], step);
  const circlePts = (cx, cy, r, n = 24, wob = 0, seed = 0) => {
    const P = [];
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; const rr = r * (1 + wob * hsh(seed + (i % n) * 1.7)); P.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    return P;
  };
  function drawGlyph(name, x, y, s, o = {}) {
    const P = GLYPH_CACHE[name].map(([a, b]) => [x + a * s, y + b * s]);
    ink(P, { amp: o.amp ?? Math.max(0.4, s * 0.025), w: o.w ?? Math.max(1.6, s * 0.08), color: o.color, seed: o.seed ?? 3, still: o.still });
  }
  function partialGlyph(name, x, y, s, t, color, w) {
    const all = GLYPH_CACHE[name]; const n = Math.max(2, Math.floor(all.length * t));
    const P = all.slice(0, n).map(([a, b]) => [x + a * s, y + b * s]);
    ink(P, { amp: 0.6, w, color, still: true });
    const tip = P[P.length - 1];
    if (t < 1) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(tip[0], tip[1], w * 1.6, 0, 7); ctx.fill(); }
  }

  // ---------- audio ----------
  let AC = null, master = null, muted = false;
  try { muted = localStorage.getItem('squiggles.muted') === '1'; } catch (e) {}
  function audio() {
    if (AC) return AC;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(AC.destination);
      const len = AC.sampleRate * 1.5, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      AC.noise = buf;
      // Continuous pen-on-paper scratch, gain driven by pen speed.
      const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.8;
      AC.scratch = AC.createGain(); AC.scratch.gain.value = 0;
      src.connect(bp).connect(AC.scratch).connect(master); src.start();
    } catch (e) { AC = null; }
    return AC;
  }
  function tone(freq, dur, type = 'triangle', vol = 0.25, when = 0, slide = 0) {
    if (!AC || muted) return;
    const t = AC.currentTime + when, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function crumple(vol = 0.3, dur = 0.25, freq = 1200) {
    if (!AC || muted) return;
    const t = AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = AC.noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.5;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur);
  }
  const SCALE = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  const sfx = {
    pop(i) { tone(SCALE[Math.min(i, SCALE.length - 1)], 0.18, 'triangle', 0.22); tone(SCALE[Math.min(i, SCALE.length - 1)] * 2, 0.1, 'sine', 0.06, 0.02); },
    erase() { crumple(0.35, 0.3, 900); tone(180, 0.2, 'sine', 0.15, 0, 0.5); },
    whiff() { tone(150, 0.16, 'sine', 0.12, 0, 0.7); },
    hurt() { tone(220, 0.5, 'sawtooth', 0.12, 0, 0.35); crumple(0.4, 0.4, 400); },
    unlock() { [0, 2, 4, 7].forEach((n, i) => tone(SCALE[n], 0.3, 'triangle', 0.18, i * 0.09)); },
    burst() { [7, 5, 4, 2, 0].forEach((n, i) => tone(SCALE[n], 0.35, 'triangle', 0.2, i * 0.05)); crumple(0.5, 0.6, 700); },
    wave() { tone(523.25, 0.2, 'triangle', 0.16); tone(783.99, 0.35, 'triangle', 0.16, 0.12); },
    over() { [4, 2, 1, 0].forEach((n, i) => tone(SCALE[n] / 2, 0.45, 'triangle', 0.18, i * 0.2)); },
  };
  function setMuted(m) {
    muted = m; $('muteBtn').textContent = m ? '×' : '♪'; $('muteBtn').setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
    if (master) master.gain.value = m ? 0 : 0.5;
    try { localStorage.setItem('squiggles.muted', m ? '1' : '0'); } catch (e) {}
  }

  // ---------- layout ----------
  let W = 0, H = 0, DPR = 1, safe = { t: 0, r: 0, b: 0, l: 0 };
  const Z = { tiers: [], temple: null, door: { x: 0, y: 0 }, base: 0, cx: 0 };
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    const s = getComputedStyle($('safe'));
    safe = { t: parseFloat(s.paddingTop) || 0, r: parseFloat(s.paddingRight) || 0, b: parseFloat(s.paddingBottom) || 0, l: parseFloat(s.paddingLeft) || 0 };
    layout();
  }
  function layout() {
    const baseW = Math.min(W * 0.86, 600), base = H - safe.b - Math.max(18, H * 0.04);
    const th = Math.min(H * 0.085, 70);
    Z.cx = W / 2; Z.base = base;
    Z.tiers = [
      { w: baseW, h: th * 1.25 },
      { w: baseW * 0.7, h: th },
      { w: baseW * 0.45, h: th * 0.85 },
    ];
    let y = base;
    for (const t of Z.tiers) { t.x = Z.cx - t.w / 2; t.y = y - t.h; y -= t.h; }
    const tw = baseW * 0.3, tH = th * 1.6;
    Z.temple = { x: Z.cx - tw / 2, y: y - tH, w: tw, h: tH };
    Z.door = { x: Z.cx, y: y - tH * 0.38 };
    Z.scale = Math.min(1.25, Math.max(0.72, Math.min(W, H) / 640));
  }

  // ---------- state ----------
  const S = {
    mode: 'title', // title | intro | play | over
    t: 0, score: 0, wave: 0, lives: 5, combo: 0, sun: 0,
    enemies: [], parts: [], texts: [], strokes: [], scratches: [],
    spawnQueue: [], spawnT: 0, introQueue: [], intro: null, shake: 0, blotHurt: 0, blotJoy: 0,
    paused: false, best: 0, waveClear: 0, burstFlash: 0,
  };
  try { S.best = +localStorage.getItem('squiggles.best') || 0; } catch (e) {}

  const unlocked = () => ORDER.filter(g => UNLOCK[g] <= Math.max(1, S.wave));

  // ---------- enemies ----------
  const TYPES = {
    bubble:   { r: 17, speed: 1.0, glyphs: [1, 1], wave: 1 },
    wiggler:  { r: 20, speed: 0.85, glyphs: [1, 2], wave: 1 },
    hatch:    { r: 15, speed: 1.55, glyphs: [1, 1], wave: 2 },
    sawback:  { r: 22, speed: 0.75, glyphs: [2, 2], wave: 3 },
    snail:    { r: 24, speed: 0.5, glyphs: [3, 4], wave: 4 },
    maze:     { r: 54, speed: 0.22, glyphs: [9, 11], wave: 99 },
  };
  function pickGlyph(pool) {
    // Lean toward the newest glyph so fresh unlocks show up often.
    const newest = pool.filter(g => UNLOCK[g] === Math.max(...pool.map(p => UNLOCK[p])));
    if (S.wave > 1 && Math.random() < 0.3) return newest[(Math.random() * newest.length) | 0];
    return pool[(Math.random() * pool.length) | 0];
  }
  function makeEnemy(type) {
    const T = TYPES[type], pool = unlocked();
    const n = T.glyphs[0] + ((Math.random() * (T.glyphs[1] - T.glyphs[0] + 1)) | 0) + (type !== 'maze' && S.wave >= 8 && Math.random() < 0.3 ? 1 : 0);
    const glyphs = []; for (let i = 0; i < n; i++) glyphs.push(pickGlyph(pool));
    const e = { type, glyphs, max: n, r: T.r * Z.scale, t: Math.random() * 10, seed: Math.random() * 1000, flash: 0, dead: 0, wp: null, spd: T.speed };
    if (type === 'sawback') {
      // Crawls in along the ground and climbs the ziggurat steps.
      const side = Math.random() < 0.5 ? -1 : 1;
      e.x = side < 0 ? -40 : W + 40; e.y = Z.base - e.r * 0.7;
      e.wp = [];
      for (let i = 0; i < Z.tiers.length; i++) {
        const t = Z.tiers[i], ex = side < 0 ? t.x : t.x + t.w;
        e.wp.push([ex - side * e.r * 0.6, t.y + t.h - e.r * 0.7], [ex - side * e.r * 0.6, t.y - e.r * 0.7]);
      }
      e.wp.push([Z.door.x, Z.door.y]);
    } else {
      // Drift in from the top and sides of the page.
      const a = Math.PI * (0.05 + Math.random() * 0.9);
      const R = Math.hypot(W, H) * 0.55;
      e.x = W / 2 - Math.cos(a) * R; e.y = Math.min(Z.door.y - 40, H * 0.55) - Math.sin(a) * R;
      e.x = Math.max(-60, Math.min(W + 60, e.x)); e.y = Math.max(-60, e.y);
      if (type === 'maze') { e.x = W / 2 + (Math.random() - 0.5) * W * 0.3; e.y = -80; e.spawnT = 3; }
    }
    return e;
  }
  function buildWave(w) {
    const q = [];
    const types = Object.keys(TYPES).filter(k => TYPES[k].wave <= w);
    const count = w % 5 === 0 ? 4 + w : 5 + w * 2;
    if (w % 5 === 0) q.push('maze');
    for (let i = 0; i < count; i++) {
      let t = types[(Math.random() * types.length) | 0];
      if (w <= 2 && i < 2) t = 'bubble';
      q.push(t);
    }
    return q;
  }
  function startWave() {
    S.wave++;
    S.spawnQueue = buildWave(S.wave);
    S.spawnT = 1.2;
    S.waveClear = 0;
    const fresh = ORDER.filter(g => UNLOCK[g] === S.wave);
    S.introQueue = fresh.slice();
    floatText(W / 2, H * 0.3, S.wave % 5 === 0 ? `Wave ${S.wave}: the Maze` : `Wave ${S.wave}`, 64, C.ink, 2.2);
    sfx.wave();
    if (S.introQueue.length) nextIntro(); else S.mode = 'play';
  }
  function nextIntro() {
    const g = S.introQueue.shift();
    if (!g) { S.intro = null; S.mode = 'play'; return; }
    S.intro = { g, t: 0, ok: 0, tries: 0 };
    S.mode = 'intro';
    sfx.unlock();
  }

  // ---------- effects ----------
  function floatText(x, y, str, size = 34, color = C.ink, life = 1.2) { S.texts.push({ x, y, str, size, color, life, max: life }); }
  function splat(x, y, n, color = C.ink, spd = 160) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.3 + Math.random());
      S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, r: 1.2 + Math.random() * 3, life: 0.6 + Math.random() * 0.5, color });
    }
  }

  // ---------- input ----------
  let drawing = null, lastPen = null, penVel = 0;
  const penPos = { x: W / 2, y: H / 2, active: false };
  cv.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    audio(); if (AC && AC.state === 'suspended') AC.resume();
    cv.setPointerCapture(e.pointerId);
    drawing = { id: e.pointerId, pts: [{ x: e.clientX, y: e.clientY, t: performance.now() }] };
    penPos.x = e.clientX; penPos.y = e.clientY; penPos.active = true; lastPen = { x: e.clientX, y: e.clientY, t: performance.now() };
    e.preventDefault();
  });
  cv.addEventListener('pointermove', e => {
    penPos.x = e.clientX; penPos.y = e.clientY;
    if (!drawing || e.pointerId !== drawing.id) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) {
      const p = drawing.pts[drawing.pts.length - 1];
      if (Math.hypot(ev.clientX - p.x, ev.clientY - p.y) >= 2) drawing.pts.push({ x: ev.clientX, y: ev.clientY });
    }
    const now = performance.now(), dt = Math.max(1, now - lastPen.t);
    penVel = Math.min(1, Math.hypot(e.clientX - lastPen.x, e.clientY - lastPen.y) / dt / 2);
    lastPen = { x: e.clientX, y: e.clientY, t: now };
    if (AC && AC.scratch) AC.scratch.gain.setTargetAtTime(muted ? 0 : penVel * 0.1, AC.currentTime, 0.02);
  });
  const endStroke = e => {
    if (!drawing || e.pointerId !== drawing.id) return;
    const pts = drawing.pts; drawing = null; penPos.active = false;
    if (AC && AC.scratch) AC.scratch.gain.setTargetAtTime(0, AC.currentTime, 0.03);
    handleStroke(pts);
  };
  cv.addEventListener('pointerup', endStroke);
  cv.addEventListener('pointercancel', endStroke);

  function bboxOf(pts) {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const p of pts) { a = Math.min(a, p.x); b = Math.min(b, p.y); c = Math.max(c, p.x); d = Math.max(d, p.y); }
    return { x: a, y: b, w: c - a, h: d - b, cx: (a + c) / 2, cy: (b + d) / 2 };
  }
  function sunHit(x, y) { return Math.hypot(x - safe.l, y - safe.t) < 110 * Z.scale; }

  function handleStroke(pts) {
    const bb = bboxOf(pts), tiny = Math.max(bb.w, bb.h) < 18;
    const st = { pts, life: 0.6, max: 0.6, color: C.pen, label: null };
    S.strokes.push(st);
    if (S.paused) return;

    if (tiny) {
      if (S.mode === 'play' && S.sun >= 1 && sunHit(pts[0].x, pts[0].y)) inkburst();
      else if (S.mode === 'intro' && S.intro.t > 1.5) nextIntro();
      st.life = 0.2;
      return;
    }

    const allowed = S.mode === 'title' || S.mode === 'over' ? ORDER : unlocked();
    let r = Glyphs.recognize(pts, allowed);
    let name = r && r.name;

    if (S.mode === 'title' || S.mode === 'over') {
      st.label = name ? GLYPHS[name].label : '?';
      if (name) { sfx.pop(ORDER.indexOf(name) % 8); splat(bb.cx, bb.cy, 8, C.pen, 90); } else sfx.whiff();
      return;
    }

    if (S.mode === 'intro') {
      S.intro.tries++;
      if (name === S.intro.g || (S.intro.tries >= 3 && name)) {
        st.label = GLYPHS[S.intro.g].label + '!'; st.color = C.pen;
        sfx.pop(5); splat(bb.cx, bb.cy, 18, C.pen, 160);
        S.intro.ok = 0.7;
      } else {
        st.label = name ? GLYPHS[name].label + '?' : '?';
        sfx.whiff();
      }
      return;
    }

    if (S.mode !== 'play') return;
    const fronts = new Set(S.enemies.filter(e => !e.dead && e.glyphs.length).map(e => e.glyphs[0]));
    if (!name || !fronts.has(name)) {
      // Second look, restricted to glyphs that would actually hit something.
      const r2 = Glyphs.recognize(pts, [...fronts]);
      if (r2 && r2.name && fronts.has(r2.name) && (r2.d ?? 0) < 0.3) name = r2.name;
    }
    const hits = name ? S.enemies.filter(e => !e.dead && e.glyphs[0] === name) : [];
    if (!hits.length) {
      st.label = name ? GLYPHS[name].label + '?' : '?'; st.color = 'rgba(38,34,47,0.5)';
      S.combo = 0; sfx.whiff();
      return;
    }
    st.label = GLYPHS[name].label;
    S.combo++;
    let pts10 = 0;
    hits.forEach((e, i) => { pts10 += popGlyph(e, i); });
    const mult = hits.length;
    const gain = pts10 * mult * (1 + Math.min(S.combo, 20) * 0.1);
    S.score += Math.round(gain);
    if (mult >= 2) floatText(bb.cx, bb.y - 10, mult === 2 ? 'Double!' : mult === 3 ? 'Triple!' : `${mult}× Scribble-out!`, 40, C.pen, 1.1);
    if (S.combo >= 3 && S.combo % 5 === 0) floatText(bb.cx, bb.y - 46, `${S.combo} streak`, 30, C.maroon, 1);
    S.sun = Math.min(1, S.sun + 0.045 * hits.length);
    S.blotJoy = 0.6;
    sfx.pop(Math.min(7, hits.length + Math.floor(S.combo / 3)));
  }

  function popGlyph(e, i) {
    e.glyphs.shift();
    e.flash = 0.3;
    const gp = glyphAnchor(e, 0);
    splat(gp.x, gp.y, 10, C.pen, 120);
    if (!e.glyphs.length) {
      e.dead = 0.0001;
      S.scratches.push({ x: e.x, y: e.y, r: e.r, t: 0, seed: e.seed });
      floatText(e.x, e.y - e.r, '+' + (e.type === 'maze' ? 500 : 25 * e.max), 30, C.ink, 1);
      setTimeout(sfx.erase, 60 * i);
      if (e.type === 'maze') { S.shake = 0.6; splat(e.x, e.y, 60, C.ink, 260); return 500; }
      return 25 * e.max;
    }
    if (e.type === 'maze') e.r = Math.max(30 * Z.scale, e.r * 0.94);
    return 10;
  }

  function inkburst() {
    S.sun = 0; S.burstFlash = 1; S.shake = 0.4; sfx.burst();
    floatText(W / 2, H * 0.4, 'Inkburst!', 72, C.maroon, 1.4);
    S.enemies.filter(e => !e.dead && e.glyphs.length).forEach((e, i) => popGlyph(e, i));
    S.score += 50;
  }

  // ---------- update ----------
  function update(dt) {
    S.t += dt;
    boilT += dt; if (boilT > (reduceMotion ? 0.5 : 1 / 7)) { boilT = 0; boil = (boil + 1) % 3; }
    for (const s of S.strokes) s.life -= dt;
    S.strokes = S.strokes.filter(s => s.life > 0);
    for (const p of S.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.vx *= 0.98; }
    S.parts = S.parts.filter(p => p.life > 0);
    for (const t of S.texts) { t.life -= dt; t.y -= 22 * dt; }
    S.texts = S.texts.filter(t => t.life > 0);
    for (const s of S.scratches) s.t += dt;
    S.scratches = S.scratches.filter(s => s.t < 0.9);
    S.shake = Math.max(0, S.shake - dt); S.blotHurt = Math.max(0, S.blotHurt - dt); S.blotJoy = Math.max(0, S.blotJoy - dt);
    S.burstFlash = Math.max(0, S.burstFlash - dt * 1.5);

    if (S.mode === 'intro') {
      S.intro.t += dt;
      if (S.intro.ok > 0) { S.intro.ok -= dt; if (S.intro.ok <= 0) nextIntro(); }
    }
    if (S.mode === 'title' || S.mode === 'over') { ambient(dt); return; }
    if (S.mode !== 'play') return;

    // spawning
    S.spawnT -= dt;
    if (S.spawnT <= 0 && S.spawnQueue.length) {
      S.enemies.push(makeEnemy(S.spawnQueue.shift()));
      S.spawnT = Math.max(0.75, 3.1 - S.wave * 0.2) * (0.7 + Math.random() * 0.6);
    }

    const base = Math.max(H * 0.04, 26) * (1 + (S.wave - 1) * 0.07);
    for (const e of S.enemies) {
      if (e.dead) { e.dead += dt; continue; }
      e.t += dt; e.flash = Math.max(0, e.flash - dt);
      const spd = base * e.spd;
      let tx = Z.door.x, ty = Z.door.y;
      if (e.wp && e.wp.length) { [tx, ty] = e.wp[0]; if (Math.hypot(tx - e.x, ty - e.y) < 6) { e.wp.shift(); continue; } }
      const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
      let ux = dx / d, uy = dy / d;
      let wob = 0;
      if (e.type === 'wiggler') wob = Math.sin(e.t * 3) * 0.9;
      if (e.type === 'bubble') wob = Math.sin(e.t * 1.6) * 0.4;
      if (e.type === 'hatch') wob = Math.sin(e.t * 7 + e.seed) * 1.1;
      if (e.type === 'maze') wob = Math.sin(e.t * 0.7) * 0.6;
      const m = e.type === 'hatch' ? (0.6 + 0.6 * Math.abs(Math.sin(e.t * 2.5))) : 1;
      e.x += (ux - uy * wob) * spd * m * dt;
      e.y += (uy + ux * wob) * spd * m * dt;
      if (e.type === 'maze') {
        e.spawnT -= dt;
        if (e.spawnT <= 0) {
          e.spawnT = Math.max(2.2, 4.5 - S.wave * 0.1);
          const h = makeEnemy('hatch'); h.x = e.x; h.y = e.y; S.enemies.push(h); splat(e.x, e.y, 8);
        }
      }
      if (!e.wp?.length && Math.hypot(Z.door.x - e.x, Z.door.y - e.y) < e.r * 0.6 + 14) {
        e.dead = 0.0001; e.reached = true;
        hurt(e.type === 'maze' ? 3 : 1);
      }
    }
    S.enemies = S.enemies.filter(e => !e.dead || e.dead < 0.6);

    if (!S.spawnQueue.length && !S.enemies.some(e => !e.dead)) {
      S.waveClear += dt;
      if (S.waveClear > 1.4) {
        S.score += 100 * S.wave;
        floatText(W / 2, H * 0.42, `Page clean  +${100 * S.wave}`, 40, C.pen, 1.6);
        if (S.lives < 5 && S.wave % 3 === 0) { S.lives++; floatText(W / 2, H * 0.48, 'Blot regains a drop of ink', 30, C.maroon, 1.8); }
        startWave();
      }
    }
  }
  function hurt(n) {
    S.lives -= n; S.combo = 0; S.blotHurt = 0.8; S.shake = 0.45; sfx.hurt();
    splat(Z.door.x, Z.door.y, 26, C.red, 200);
    floatText(Z.door.x, Z.temple.y - 10, n > 1 ? `−${n} ink` : '−1 ink', 36, C.red, 1.2);
    if (S.lives <= 0) gameOver();
  }
  function ambient(dt) {
    // Idle scribbles drifting around on the title page.
    if (S.enemies.length < 4 && Math.random() < dt * 0.6) {
      const types = ['bubble', 'wiggler', 'hatch', 'snail'];
      const e = makeEnemy(types[(Math.random() * types.length) | 0]);
      e.x = Math.random() < 0.5 ? -40 : W + 40; e.y = H * (0.1 + Math.random() * 0.4); e.vx = e.x < 0 ? 30 : -30; e.ambient = true;
      S.enemies.push(e);
    }
    for (const e of S.enemies) { e.t += dt; e.x += (e.vx || 0) * dt; e.y += Math.sin(e.t * 1.5) * 10 * dt; }
    S.enemies = S.enemies.filter(e => e.x > -80 && e.x < W + 80);
  }

  // ---------- flow ----------
  function newGame() {
    Object.assign(S, { mode: 'play', score: 0, wave: 0, lives: 5, combo: 0, sun: 0, enemies: [], parts: [], texts: [], scratches: [], spawnQueue: [], paused: false });
    $('titleScreen').hidden = true; $('overScreen').hidden = true; $('pauseBtn').hidden = false;
    startWave();
  }
  function gameOver() {
    S.mode = 'over'; sfx.over();
    const isBest = S.score > S.best;
    if (isBest) { S.best = S.score; try { localStorage.setItem('squiggles.best', String(S.best)); } catch (e) {} }
    $('oScore').textContent = S.score; $('oWave').textContent = S.wave; $('oBest').textContent = S.best;
    $('overTitle').textContent = isBest && S.score > 0 ? 'A new best page.' : 'The page is overrun.';
    $('oNote').textContent = S.wave >= 9 ? 'You met every glyph in the codex.' : `Next glyph to meet: ${GLYPHS[ORDER.find(g => UNLOCK[g] > S.wave) || 'key'].label}, on wave ${UNLOCK[ORDER.find(g => UNLOCK[g] > S.wave) || 'key']}.`;
    $('pauseBtn').hidden = true;
    setTimeout(() => { $('overScreen').hidden = false; $('againBtn').focus(); }, 900);
    S.enemies.forEach(e => { if (!e.dead) e.vx = (e.x < W / 2 ? -1 : 1) * 40; e.ambient = true; });
  }
  function setPaused(p) {
    if (S.mode !== 'play' && S.mode !== 'intro') p = false;
    S.paused = p; $('pauseScreen').hidden = !p;
    if (p) $('resumeBtn').focus();
  }

  // ---------- drawing ----------
  function drawPaper() {
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    // faint fibres
    ctx.globalAlpha = 0.05; ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const x = (hsh(i * 7.1) * 0.5 + 0.5) * W, y = (hsh(i * 3.3 + 9) * 0.5 + 0.5) * H, a = hsh(i * 1.9) * 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // The photographer's hand shadow, drifting slowly over the lower-left of the page.
    const sx = W * 0.18 + Math.sin(S.t * 0.13) * 30, sy = H * 0.62 + Math.cos(S.t * 0.11) * 20;
    const g = ctx.createRadialGradient(sx, sy, 10, sx, sy, Math.max(W, H) * 0.45);
    g.addColorStop(0, 'rgba(38,34,47,0.075)'); g.addColorStop(1, 'rgba(38,34,47,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function drawDecor() {
    const s = Z.scale, ox = safe.l, oy = safe.t;
    ctx.save(); ctx.globalAlpha = 0.85;
    // The sun-arc in the corner doubles as the Inkburst meter.
    const R1 = 92 * s, R2 = 120 * s;
    const arc = (r, a0, a1, n = 26) => { const P = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; P.push([ox + Math.cos(a) * r, oy + Math.sin(a) * r]); } return P; };
    const charged = S.sun;
    // fill wedge for charge
    if (charged > 0) {
      ctx.beginPath(); ctx.moveTo(ox, oy);
      const end = 0.06 + (Math.PI / 2 - 0.12) * charged;
      for (let i = 0; i <= 24; i++) { const a = 0.06 + (end - 0.06) * i / 24; ctx.lineTo(ox + Math.cos(a) * R1, oy + Math.sin(a) * R1); }
      ctx.closePath(); ctx.fillStyle = S.sun >= 1 ? `rgba(75,28,36,${0.55 + 0.25 * Math.sin(S.t * 6)})` : 'rgba(75,28,36,0.28)'; ctx.fill();
    }
    ink(arc(R1, 0.04, Math.PI / 2 - 0.04), { seed: 1, w: 2 });
    ink(arc(R1 * 0.72, 0.04, Math.PI / 2 - 0.04), { seed: 2, w: 2 });
    // teeth
    const teeth = []; const n = 11;
    for (let i = 0; i <= n * 2; i++) { const a = 0.05 + (Math.PI / 2 - 0.1) * i / (n * 2); const r = i % 2 ? R2 : R1 + 4; teeth.push([ox + Math.cos(a) * r, oy + Math.sin(a) * r]); }
    ink(teeth, { seed: 3, w: 2 });
    if (S.mode === 'play' && S.sun >= 1) {
      ctx.font = `${26 * s}px ${HAND}`; ctx.fillStyle = C.maroon; ctx.textAlign = 'left';
      ctx.fillText('tap the sun!', ox + R2 * 0.55, oy + R2 + 22 * s);
    }
    // wavy lines + circle trail
    const wv = []; for (let i = 0; i <= 40; i++) wv.push([ox + 12 * s + i * 3.6 * s, oy + R2 + 52 * s + Math.sin(i * 0.55) * 7 * s]);
    ink(wv, { seed: 4, w: 1.8 });
    for (let i = 0; i < 6; i++) ink(circlePts(ox + 160 * s - i * 26 * s + (i > 2 ? 0 : 0), oy + 40 * s + i * 30 * s, 7 * s, 12, 0.15, i), { seed: 10 + i, w: 1.6 });
    // hatching, top right
    const hx = W - safe.r - 150 * s, hy = oy + 70 * s;
    for (let i = 0; i < 9; i++) ink(L(hx + i * 2, hy + i * 9 * s, hx + 130 * s, hy + i * 9 * s + 4 + i * 2.2, 14), { seed: 30 + i, w: 1.3, amp: 0.8 });
    ctx.restore();
  }

  function drawZiggurat() {
    const tiers = Z.tiers;
    for (let k = 0; k < tiers.length; k++) {
      const t = tiers[k];
      ink([[t.x, t.y + t.h], [t.x, t.y], [t.x + t.w, t.y], [t.x + t.w, t.y + t.h]].flatMap((p, i, a) => i < a.length - 1 ? subdivide([p, a[i + 1]], 14).slice(0, -1) : [p]), { seed: 50 + k, w: 2.2, fill: C.paper });
      // triangle band like the sketch: alternate up/down teeth across the tier
      const teeth = k === 0 ? 5 : k === 1 ? 4 : 3;
      const P = [];
      for (let i = 0; i <= teeth * 2; i++) P.push([t.x + t.w * i / (teeth * 2), i % 2 ? (k === 0 ? t.y + t.h : t.y) : (k === 0 ? t.y : t.y + t.h)]);
      ink(subdivide(P, 14), { seed: 60 + k, w: 1.7 });
    }
    // ground line
    ink(L(Math.max(0, Z.cx - W), Z.base, Math.min(W, Z.cx + W), Z.base, 18), { seed: 70, w: 2 });
    // temple
    const T = Z.temple;
    ink(subdivide([[T.x, T.y + T.h], [T.x, T.y], [T.x + T.w, T.y], [T.x + T.w, T.y + T.h]], 12), { seed: 80, w: 2.2, fill: C.paper });
    const roof = []; for (let i = 0; i <= 20; i++) roof.push([T.x + T.w * 0.12 + T.w * 0.76 * i / 20, T.y - 8 + Math.sin(i * 0.9) * 3]);
    ink(roof, { seed: 81, w: 1.6 });
    // inner shrine frame with the roof triangle
    const ix = T.x + T.w * 0.12, iw = T.w * 0.76, iy = T.y + T.h * 0.1, ih = T.h * 0.85;
    ink(subdivide([[ix, iy + ih], [ix, iy], [ix + iw, iy], [ix + iw, iy + ih]], 10), { seed: 82, w: 1.6 });
    ink(subdivide([[ix + 4, iy + ih * 0.42], [ix + iw / 2, iy + 4], [ix + iw - 4, iy + ih * 0.42], [ix + 4, iy + ih * 0.42]], 10), { seed: 83, w: 1.6 });
    // little doorknob & TT marks
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(T.x + T.w * 0.05, T.y + T.h * 0.2, 2.4, 0, 7); ctx.fill();
    ctx.font = `${14 * Z.scale}px ${BODY}`; ctx.textAlign = 'center'; ctx.fillText('TT', ix + iw - 12, iy + ih - 6);
    // cracks for each lost ink drop
    for (let i = 0; i < 5 - S.lives; i++) {
      const cx = T.x + T.w * (0.15 + 0.7 * (hsh(i * 9.1) * 0.5 + 0.5)), P = [[cx, T.y + T.h]];
      for (let j = 1; j < 5; j++) P.push([cx + hsh(i * 3 + j) * 9, T.y + T.h - j * T.h * 0.12]);
      ink(P, { seed: 90 + i, w: 1.5, color: C.red, still: true });
    }
    drawBlot();
  }

  function drawBlot() {
    const T = Z.temple, x = Z.door.x, s = Z.scale;
    const hop = S.blotJoy > 0 ? -Math.abs(Math.sin(S.blotJoy * 10)) * 6 : 0;
    const y = Z.door.y + T.h * 0.12 + hop, r = Math.min(T.w * 0.26, 30 * s);
    const P = [];
    for (let i = 0; i <= 26; i++) {
      const a = Math.PI + i / 26 * Math.PI; P.push([x + Math.cos(a) * r * (1 + 0.08 * Math.sin(i * 1.3 + S.t * 3)), y + Math.sin(a) * r * 0.85]);
    }
    P.push([x + r * 1.35, y + 3], [x - r * 1.35, y + 3]);
    ctx.save();
    if (S.blotHurt > 0) ctx.translate(Math.sin(S.t * 60) * 3, 0);
    ink(P, { seed: 99, w: 2, fill: C.maroon, close: true });
    // scribbled fill texture, like the marker in the sketch
    ctx.save(); ctx.clip();
    ctx.globalAlpha = 0.5;
    for (let i = -6; i < 7; i++) ink(L(x + i * r * 0.22 - r * 0.4, y + 4, x + i * r * 0.22 + r * 0.4, y - r, 8), { seed: 120 + i, w: 1.2, color: '#1b0c10' });
    ctx.restore();
    // eyes look toward the pen or the closest scribble
    let lx = penPos.x, ly = penPos.y;
    if (!penPos.active) { const near = S.enemies.filter(e => !e.dead).sort((a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - ((b.x - x) ** 2 + (b.y - y) ** 2))[0]; if (near) { lx = near.x; ly = near.y; } }
    const blink = (S.t % 4.2) < 0.12;
    for (const sx of [-0.38, 0.38]) {
      const ex = x + sx * r, ey = y - r * 0.42;
      ctx.fillStyle = C.paper; ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.2, blink ? 1.5 : r * 0.24, 0, 0, 7); ctx.fill();
      if (!blink) {
        const a = Math.atan2(ly - ey, lx - ex);
        ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(ex + Math.cos(a) * r * 0.08, ey + Math.sin(a) * r * 0.1, S.blotHurt > 0 ? r * 0.06 : r * 0.1, 0, 7); ctx.fill();
      }
    }
    ctx.restore();
  }

  // Each scribble type is drawn out of a motif from the sketch.
  function drawEnemyBody(e) {
    const { x, y, r, seed } = e, t = e.t;
    const col = e.flash > 0 ? C.pen : C.ink;
    switch (e.type) {
      case 'bubble': {
        ink(circlePts(x, y, r, 20, 0.08, seed), { seed, w: 2, fill: C.paper, color: col });
        ink(circlePts(x + r * 0.35, y - r * 0.35, r * 0.18, 8, 0.1, seed + 1), { seed: seed + 1, w: 1.3, color: col });
        eyes(x - r * 0.15, y + r * 0.1, r * 0.55, e); break;
      }
      case 'wiggler': {
        const P = []; for (let i = 0; i <= 22; i++) P.push([x - r * 1.4 + i * r * 0.13, y + Math.sin(i * 0.7 + t * 6) * r * 0.35]);
        ink(P, { seed, w: 3.2, color: col });
        eyes(x + r * 1.45, y + Math.sin(22 * 0.7 + t * 6) * r * 0.35 - 3, r * 0.45, e); break;
      }
      case 'hatch': {
        for (let i = 0; i < 6; i++) ink(L(x - r + i * r * 0.32, y + r * 0.7, x - r * 0.3 + i * r * 0.32, y - r * 0.8, 6), { seed: seed + i, w: 1.6, color: col, amp: 1.4 });
        eyes(x, y - r * 0.1, r * 0.6, e); break;
      }
      case 'sawback': {
        const P = [[x - r * 1.2, y + r * 0.5]];
        for (let i = 0; i <= 8; i++) P.push([x - r * 1.2 + i * r * 0.3, y + (i % 2 ? -r * 0.6 : -r * 0.05)]);
        P.push([x + r * 1.2, y + r * 0.5]);
        ink(subdivide(P, 6), { seed, w: 2, fill: C.paper, close: true, color: col });
        for (let i = 0; i < 4; i++) { const lg = Math.sin(t * 10 + i * 1.6) * r * 0.2; ink(L(x - r * 0.8 + i * r * 0.5, y + r * 0.5, x - r * 0.8 + i * r * 0.5 + lg, y + r * 0.85, 4), { seed: seed + i, w: 1.6, color: col }); }
        eyes(x + r * 0.6, y + r * 0.15, r * 0.45, e); break;
      }
      case 'snail': {
        const P = []; for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2 * 2.6 + t * 0.6; const rr = r * (0.08 + i / 60 * 0.9); P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
        ink(circlePts(x, y, r, 22, 0.05, seed), { seed, w: 2, fill: C.paper, color: col });
        ink(P, { seed: seed + 2, w: 1.7, color: col });
        eyes(x, y + r * 0.95, r * 0.45, e); break;
      }
      case 'maze': {
        // The square spiral from the sketch, alive.
        const P = []; let cx = x, cy = y, len = r * 0.18, dir = 0;
        P.push([cx, cy]);
        for (let i = 0; i < 12; i++) { const dx = [1, 0, -1, 0][dir], dy = [0, 1, 0, -1][dir]; cx += dx * len; cy += dy * len; P.push([cx, cy]); dir = (dir + 1) % 4; if (i % 2) len += r * 0.18; }
        const rot = Math.sin(t * 0.8) * 0.1; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.translate(-x, -y);
        ink(subdivide([[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r], [x - r, y - r]], 10), { seed, w: 2.6, fill: C.paper, color: col });
        ink(subdivide(P, 8), { seed: seed + 1, w: 2.2, color: col });
        ctx.restore();
        eyes(x, y - r * 1.15, r * 0.5, e); break;
      }
    }
  }
  function eyes(x, y, s, e) {
    const tx = Z.door.x - x, ty = Z.door.y - y, a = Math.atan2(ty, tx);
    for (const dx of [-0.32, 0.32]) {
      ctx.fillStyle = C.paper; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(x + dx * s, y, s * 0.26, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x + dx * s + Math.cos(a) * s * 0.1, y + Math.sin(a) * s * 0.1, s * 0.12, 0, 7); ctx.fill();
    }
  }
  function glyphAnchor(e, i) {
    const n = Math.min(e.glyphs.length || 1, e.type === "maze" ? 6 : 4), sz = 30 * Z.scale, gap = 6;
    const total = n * sz + (n - 1) * gap;
    return { x: e.x - total / 2 + sz / 2 + i * (sz + gap), y: e.y - e.r - sz * 0.95 - (e.type === 'maze' ? 14 : 0), sz };
  }
  function drawGlyphTags(e) {
    const vis = e.glyphs.slice(0, e.type === 'maze' ? 6 : 4);
    vis.forEach((g, i) => {
      const a = glyphAnchor(e, i), front = i === 0, sz = front ? a.sz * 1.12 : a.sz * 0.9;
      // a scrap of paper pinned to the scribble
      const hs = sz / 2;
      ctx.globalAlpha = front ? 1 : 0.55;
      ink(subdivide([[a.x - hs, a.y - hs], [a.x + hs, a.y - hs], [a.x + hs, a.y + hs], [a.x - hs, a.y + hs], [a.x - hs, a.y - hs]], 8), { seed: e.seed + i * 7, w: front ? 1.8 : 1.2, fill: C.paper, amp: 0.8 });
      drawGlyph(g, a.x, a.y, sz * 0.66, { w: front ? 2.2 : 1.6, seed: e.seed + i, color: front ? C.ink : C.ink });
      ctx.globalAlpha = 1;
    });
    if (e.glyphs.length > vis.length) {
      const a = glyphAnchor(e, vis.length - 1);
      ctx.font = `${20 * Z.scale}px ${BODY}`; ctx.fillStyle = C.ink; ctx.textAlign = 'left';
      ctx.fillText(`+${e.glyphs.length - vis.length}`, a.x + a.sz * 0.7, a.y + 6);
    }
  }
  function drawEnemies() {
    for (const e of S.enemies) {
      ctx.save();
      if (e.dead) ctx.globalAlpha = Math.max(0, 1 - e.dead / 0.6);
      drawEnemyBody(e);
      if (!e.dead && !e.ambient) drawGlyphTags(e);
      ctx.restore();
    }
    // scribble-outs over erased enemies
    for (const s of S.scratches) {
      const p = Math.min(1, s.t / 0.25), fade = s.t > 0.5 ? 1 - (s.t - 0.5) / 0.4 : 1;
      const P = []; const n = 14;
      for (let i = 0; i <= n * p; i++) P.push([s.x - s.r * 1.2 + (i / n) * s.r * 2.4, s.y + (i % 2 ? -s.r : s.r) * 0.9 + hsh(s.seed + i) * 4]);
      ctx.globalAlpha = Math.max(0, fade);
      if (P.length > 1) ink(P, { seed: s.seed, w: 2.6, color: C.pen, still: true });
      ctx.globalAlpha = 1;
    }
  }

  function drawStrokes() {
    const live = drawing ? [{ pts: drawing.pts, life: 1, max: 1, color: C.pen }] : [];
    for (const s of S.strokes.concat(live)) {
      if (s.pts.length < 2) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life / s.max * 1.4));
      ctx.strokeStyle = s.color; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(s.pts[0].x, s.pts[0].y);
      for (let i = 1; i < s.pts.length - 1; i++) { const m = { x: (s.pts[i].x + s.pts[i + 1].x) / 2, y: (s.pts[i].y + s.pts[i + 1].y) / 2 }; ctx.quadraticCurveTo(s.pts[i].x, s.pts[i].y, m.x, m.y); }
      const last = s.pts[s.pts.length - 1]; ctx.lineTo(last.x, last.y); ctx.stroke();
      if (s.label) {
        ctx.font = `${34 * Z.scale}px ${HAND}`; ctx.fillStyle = s.color; ctx.textAlign = 'center';
        const bb = bboxOf(s.pts); ctx.fillText(s.label, bb.cx, Math.max(30, bb.y - 8));
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawFx() {
    for (const p of S.parts) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const t of S.texts) {
      ctx.globalAlpha = Math.min(1, t.life / t.max * 2.5);
      ctx.font = `${t.size * Z.scale}px ${HAND}`; ctx.fillStyle = t.color; ctx.textAlign = 'center';
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    if (S.burstFlash > 0) { ctx.fillStyle = `rgba(75,28,36,${S.burstFlash * 0.18})`; ctx.fillRect(0, 0, W, H); }
  }

  function drawHUD() {
    if (S.mode !== 'play' && S.mode !== 'intro') return;
    const s = Z.scale;
    ctx.textAlign = 'center'; ctx.fillStyle = C.ink;
    ctx.font = `${54 * s}px ${HAND}`;
    ctx.fillText(String(S.score), W / 2, safe.t + 46 * s);
    ctx.font = `${17 * s}px ${BODY}`; ctx.globalAlpha = 0.6;
    ctx.fillText(`wave ${S.wave}` + (S.combo >= 2 ? `  ·  streak ${S.combo}` : ''), W / 2, safe.t + 68 * s);
    ctx.globalAlpha = 1;
    // ink drops: the filled squares from the sketch's corner
    const lx = W / 2 - 2 * 22 * s, ly = safe.t + 90 * s;
    for (let i = 0; i < 5; i++) {
      const x = lx + i * 22 * s, d = 7 * s;
      ink([[x, ly - d], [x + d, ly], [x, ly + d], [x - d, ly], [x, ly - d]], { seed: 200 + i, w: 1.6, fill: i < S.lives ? C.maroon : C.paper, amp: 0.6 });
    }
  }

  function drawIntro() {
    if (S.mode !== 'intro' || !S.intro) return;
    const g = S.intro.g, s = Z.scale;
    const cw = Math.min(W - 32, 360), ch = 300 * s, x = W / 2 - cw / 2, y = Math.max(safe.t + 110 * s, H * 0.26 - ch / 2);
    ctx.save();
    ctx.fillStyle = 'rgba(38,34,47,0.12)'; ctx.fillRect(x + 6, y + 7, cw, ch);
    ink(subdivide([[x, y], [x + cw, y], [x + cw, y + ch], [x, y + ch], [x, y]], 16), { seed: 300, w: 2.2, fill: C.paper });
    ctx.textAlign = 'center'; ctx.fillStyle = C.maroon; ctx.font = `${18 * s}px ${BODY}`;
    ctx.fillText('NEW GLYPH', W / 2, y + 30 * s);
    ctx.fillStyle = C.ink; ctx.font = `${50 * s}px ${HAND}`;
    ctx.fillText(GLYPHS[g].label, W / 2, y + 72 * s);
    const tr = Math.min(1, (S.intro.t % 2.6) / 1.6);
    partialGlyph(g, W / 2, y + ch * 0.58, 110 * s, tr, C.pen, 3);
    ctx.fillStyle = C.ink; ctx.globalAlpha = 0.7; ctx.font = `${17 * s}px ${BODY}`;
    ctx.fillText(S.intro.ok > 0 ? 'Got it.' : S.intro.t > 1.5 ? 'Draw it anywhere, or tap to skip' : 'Draw it anywhere on the page', W / 2, y + ch - 18 * s);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawPaper();
    ctx.save();
    if (S.shake > 0 && !reduceMotion) ctx.translate(hsh(S.t * 90) * S.shake * 10, hsh(S.t * 77 + 3) * S.shake * 10);
    drawDecor();
    drawZiggurat();
    drawEnemies();
    drawFx();
    ctx.restore();
    drawHUD();
    drawIntro();
    drawStrokes();
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!S.paused) update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ---------- UI wiring ----------
  function buildCodex() {
    const box = $('codex');
    for (const g of ORDER) {
      const f = document.createElement('figure'), c = document.createElement('canvas'), cap = document.createElement('figcaption');
      c.width = 88; c.height = 88; cap.textContent = GLYPHS[g].label;
      const x = c.getContext('2d'); x.scale(2, 2); x.strokeStyle = C.ink; x.lineWidth = 2.2; x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath(); GLYPH_CACHE[g].forEach(([a, b], i) => { const px = 22 + a * 30, py = 22 + b * 30; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
      f.append(c, cap); box.append(f);
    }
  }
  $('startBtn').addEventListener('click', () => { audio(); AC && AC.resume(); newGame(); });
  $('againBtn').addEventListener('click', () => { audio(); newGame(); });
  $('resumeBtn').addEventListener('click', () => setPaused(false));
  $('pauseBtn').addEventListener('click', () => setPaused(!S.paused));
  $('muteBtn').addEventListener('click', () => { audio(); setMuted(!muted); });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Escape' || e.key === 'p') && (S.mode === 'play' || S.mode === 'intro')) setPaused(!S.paused);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
  window.addEventListener('resize', resize);

  setMuted(muted);
  buildCodex();
  resize();
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.load) document.fonts.load(`40px ${HAND}`).catch(() => {});
})();
