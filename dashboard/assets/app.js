/* ============ HELPERS ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const AR = '<svg class="ar" viewBox="0 0 16 10" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M0 5h14M10 1l4 4-4 4"/></svg>';
const BK = '<svg viewBox="0 0 16 10" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M16 5H2M6 1L2 5l4 4"/></svg>';
const FAM = Object.fromEntries(FAMILIES.map(f => [f.id, f]));
const draftAttr = d => d ? ' data-draft' : '';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// service → family + group lookup
const LOC = {};
FAMILIES.forEach(f => f.groups.forEach((g, gi) => g.services.forEach(id => { LOC[id] = { fam: f, grp: g, gi }; })));
const ORDER = FAMILIES.flatMap(f => f.groups.flatMap(g => g.services));

let CTX = "";          // conversation context carried to the contact form
let EX = { fam: "et", grp: "a" };
let SV = { q: "", view: "agenda" };
let INSF = "all";
let OUTTAB = {};

/* ============ GLYPHS (abstract, line-based) ============ */
function glyph(id) {
  const c1 = "var(--accent)", c2 = "var(--head)";
  let p = "";
  if (id === "et") { // architecture: stacked planes rising
    for (let i = 0; i < 7; i++) { const y = 62 - i * 8, x = 6 + i * 9; p += `<path d="M${x} ${y}h${44}" stroke="${i > 4 ? c1 : c2}" stroke-width="${i > 4 ? 2 : 1.2}" opacity="${0.35 + i * 0.1}"/>`; }
    p += `<path d="M6 66V10" stroke="${c2}" stroke-width="1" opacity=".4"/><circle cx="104" cy="14" r="4" fill="${c1}"/>`;
  } else if (id === "ai") { // flowing bundle
    for (let i = 0; i < 9; i++) { const o = i * 3.2; p += `<path d="M2 ${50 - o}C30 ${70 - o},44 ${8 + o},70 ${30 + o * 0.4}S100 ${12 + o},118 ${20 + o}" stroke="${i > 5 ? c1 : c2}" stroke-width="${i > 5 ? 1.6 : 1}" fill="none" opacity="${0.3 + i * 0.08}"/>`; }
  } else { // intelligence: many signals converge to a decision point
    for (let i = 0; i < 9; i++) { const y = 6 + i * 7.5; p += `<path d="M2 ${y}C50 ${y},70 36,100 36" stroke="${i === 4 ? c1 : c2}" stroke-width="${i === 4 ? 2 : 1}" fill="none" opacity="${i === 4 ? 1 : 0.4}"/>`; }
    p += `<circle cx="104" cy="36" r="5" fill="${c1}"/><circle cx="104" cy="36" r="11" fill="none" stroke="${c1}" opacity=".35"/>`;
  }
  return `<svg viewBox="0 0 122 72" fill="none" aria-hidden="true">${p}</svg>`;
}
function insightArt(i, cat) {
  const seed = (i * 37 + cat.length * 11) % 100;
  let p = "";
  const n = 22;
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1), a = 18 + seed % 20;
    const y0 = 150 - t * 60, y1 = 60 + Math.sin(seed + t * 3) * a, y2 = 120 - t * 40;
    p += `<path d="M-10 ${y0.toFixed(1)}C90 ${(y1).toFixed(1)},170 ${(y2 + 30).toFixed(1)},330 ${(70 + t * 70).toFixed(1)}" stroke="rgba(127,209,214,${(0.08 + t * 0.4).toFixed(2)})" fill="none" stroke-width="1"/>`;
  }
  p += `<circle cx="${220 + seed % 60}" cy="${60 + seed % 40}" r="4" fill="#009da7"/>`;
  return `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="320" height="200" fill="#062329"/>${p}</svg>`;
}

/* ============ WAVES (deck line-bundle motif) ============ */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let waveJobs = [];
function waves(canvas, o = {}) {
  const ctx = canvas.getContext("2d");
  const N = o.n || 38, dpr = Math.min(devicePixelRatio || 1, 2);
  let w = 0, h = 0, phase = o.phase || 0, raf = 0, visible = true;
  function size() { const r = canvas.getBoundingClientRect(); w = r.width; h = r.height; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(w * (o.from ?? 0.25), 0, w, 0);
    g.addColorStop(0, "rgba(127,209,214,0)"); g.addColorStop(0.5, "rgba(127,209,214,.55)"); g.addColorStop(1, "rgba(0,157,167,.9)");
    ctx.strokeStyle = g;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      ctx.globalAlpha = 0.12 + 0.5 * t * t;
      ctx.lineWidth = i === N - 1 ? 1.4 : 0.8;
      ctx.beginPath();
      for (let x = 0; x <= w + 8; x += 8) {
        const u = x / w;
        const y = h * ((o.base ?? 0.7) - 0.22 * t) + Math.sin(u * Math.PI * 1.5 + phase + t * 1.3) * h * 0.13 * (0.5 + t) + Math.sin(u * Math.PI * 3.2 - phase * 0.6 + t * 2.2) * h * 0.035;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function loop() { phase += 0.0025; draw(); raf = visible ? requestAnimationFrame(loop) : 0; }
  size(); draw();
  const ro = new ResizeObserver(() => { size(); draw(); }); ro.observe(canvas);
  let io;
  if (!reduce) {
    io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); });
    io.observe(canvas);
  }
  return () => { cancelAnimationFrame(raf); ro.disconnect(); io && io.disconnect(); };
}

/* ============ HERO IMAGE MOTION (light only, image untouched) ============ */
function heroFx(cv) {
  const ctx = cv.getContext("2d"), dpr = Math.min(devicePixelRatio || 1, 2);
  const IW = 1999, IH = 1125; // coordinates measured on the source image
  const NODES = [[1848,425],[1870,508],[1923,422],[1980,405],[1876,358],[1910,494],[1981,472],[1967,338],[1931,557],[1898,350],[1909,464],[1821,350],[1943,246],[1959,294],[1799,577],[1923,489],[1640,452],[1665,385],[1945,340],[1770,408],[1587,335],[1896,285],[1833,277],[1755,265],[1896,366],[1801,491]];
  const WAVE = [[1459,991],[1572,962],[1727,1014],[643,963],[488,1022],[979,1042],[376,1000],[818,1062],[1849,927],[1317,1005],[134,894],[251,944],[1930,838],[1106,1009],[30,943],[1982,953],[1712,879],[1562,1079],[5,803],[1192,1102],[879,956],[1374,903],[699,1081],[506,888],[1502,863],[1206,945],[193,1042],[304,833],[1812,807]];
  const EDGES = [];
  NODES.forEach((a, i) => NODES.forEach((b, j) => { if (j > i && Math.hypot(a[0]-b[0], a[1]-b[1]) < 150) EDGES.push([i, j]); }));
  const CREST = [[0,760],[200,880],[420,905],[640,935],[860,975],[1080,965],[1300,915],[1520,872],[1760,820],[1999,750]];
  const crestAt = x => { for (let k = 1; k < CREST.length; k++) if (x <= CREST[k][0]) { const [x0,y0] = CREST[k-1], [x1,y1] = CREST[k]; return y0 + (y1-y0)*(x-x0)/(x1-x0); } return 750; };
  const seed = NODES.map(() => Math.random() * 6.28), wseed = WAVE.map(() => Math.random() * 6.28);
  const motes = Array.from({ length: 46 }, () => ({ x: Math.random() * IW, y: 450 + Math.random() * 675, r: 0.8 + Math.random() * 2.2, s: 0.08 + Math.random() * 0.22, p: Math.random() * 6.28 }));
  let pulses = [], w = 0, h = 0, raf = 0, visible = true, last = performance.now(), nextPulse = 0;
  function size() { const r = cv.getBoundingClientRect(); w = r.width; h = r.height; cv.width = w * dpr; cv.height = h * dpr; }
  function frame(t) {
    const dt = Math.min(50, t - last); last = t;
    // map image coords → canvas (object-fit: cover, anchored bottom-centre)
    const sc = Math.max(w / IW, h / IH), ox = (w - IW * sc) / 2, oy = h - IH * sc;
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
    ctx.clearRect(-ox / sc, -oy / sc, w / sc, h / sc);
    ctx.globalCompositeOperation = "lighter";
    const T = t / 1000;
    // 1. glow travelling along the wave crest
    const gx = ((T / 16) % 1) * (IW + 600) - 300, gy = crestAt(Math.max(0, Math.min(IW, gx)));
    let g;
    ctx.save(); ctx.translate(gx, gy); ctx.scale(1, 0.42);
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, 300);
    g.addColorStop(0, "rgba(90,230,240,.2)"); g.addColorStop(0.6, "rgba(90,230,240,.05)"); g.addColorStop(1, "rgba(90,230,240,0)");
    ctx.fillStyle = g; ctx.fillRect(-300, -300, 600, 600); ctx.restore();
    // 2. twinkling network nodes
    NODES.forEach(([x, y], i) => {
      const a = Math.max(0, Math.sin(T * 0.9 + seed[i])) ** 3;
      if (a < 0.02) return;
      g = ctx.createRadialGradient(x, y, 0, x, y, 26);
      g.addColorStop(0, `rgba(150,245,250,${0.55 * a})`); g.addColorStop(1, "rgba(150,245,250,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26, 0, 6.283); ctx.fill();
    });
    WAVE.forEach(([x, y], i) => {
      const a = Math.max(0, Math.sin(T * 0.7 + wseed[i])) ** 4;
      if (a < 0.03) return;
      g = ctx.createRadialGradient(x, y, 0, x, y, 16);
      g.addColorStop(0, `rgba(150,245,250,${0.5 * a})`); g.addColorStop(1, "rgba(150,245,250,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16, 0, 6.283); ctx.fill();
    });
    // 3. light pulses along network edges
    if (t > nextPulse && EDGES.length) { const e = EDGES[(Math.random() * EDGES.length) | 0]; pulses.push({ e, k: 0, rev: Math.random() < 0.5 }); nextPulse = t + 500 + Math.random() * 900; }
    pulses = pulses.filter(p => (p.k += dt / 1500) < 1);
    pulses.forEach(p => {
      let [a, b] = p.e.map(i => NODES[i]); if (p.rev) [a, b] = [b, a];
      const k = p.k * p.k * (3 - 2 * p.k), x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k, al = Math.sin(p.k * Math.PI);
      g = ctx.createRadialGradient(x, y, 0, x, y, 14);
      g.addColorStop(0, `rgba(200,255,255,${0.9 * al})`); g.addColorStop(1, "rgba(200,255,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 14, 0, 6.283); ctx.fill();
    });
    // 4. slow drifting motes
    motes.forEach(m => {
      m.y -= m.s * dt / 16; m.x += Math.sin(T * 0.3 + m.p) * 0.15;
      if (m.y < 380) { m.y = 1125; m.x = Math.random() * IW; }
      const al = 0.25 + 0.25 * Math.sin(T * 1.3 + m.p), fade = Math.min(1, (m.y - 380) / 200);
      ctx.fillStyle = `rgba(120,230,240,${al * fade})`; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 1.6, 0, 6.283); ctx.fill();
    });
    ctx.globalCompositeOperation = "source-over";
    raf = visible ? requestAnimationFrame(frame) : 0;
  }
  size();
  const ro = new ResizeObserver(size); ro.observe(cv);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } });
  io.observe(cv);
  return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
}


/* ============ HERO SCENE: code-drawn landscape (wave mesh + network), sharp at any size ============ */
function heroScene(cv) {
  const ctx = cv.getContext("2d"), dpr = Math.min(devicePixelRatio || 1, 2);
  let W = 0, H = 0, bg = null, raf = 0, visible = true, lastDraw = 0, masks = [], net = [], edges = [];
  // deterministic random so the composition is identical on every load
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const sprite = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(170,250,255,1)"); r.addColorStop(.18, "rgba(90,225,238,.55)"); r.addColorStop(1, "rgba(60,200,220,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return c; })();
  function buildBg() {
    bg = document.createElement("canvas"); bg.width = W * dpr; bg.height = H * dpr;
    const g = bg.getContext("2d"); g.scale(dpr, dpr);
    let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#022a34"); gr.addColorStop(.55, "#03414f"); gr.addColorStop(1, "#022f3a");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    gr = g.createRadialGradient(W * .98, H * .02, 0, W * .98, H * .02, Math.max(W, H) * .55);
    gr.addColorStop(0, "rgba(20,190,205,.42)"); gr.addColorStop(.45, "rgba(10,120,140,.12)"); gr.addColorStop(1, "rgba(10,120,140,0)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    gr = g.createRadialGradient(W * .5, H * .95, 0, W * .5, H * .95, W * .6);
    gr.addColorStop(0, "rgba(10,140,160,.22)"); gr.addColorStop(1, "rgba(10,140,160,0)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    sd = 11;
    for (let i = 0; i < 46; i++) { // soft out-of-focus particles for depth
      const x = rnd() * W, y = H * (.25 + rnd() * .75), r = 4 + rnd() * 16, a = .05 + rnd() * .12;
      const b = g.createRadialGradient(x, y, 0, x, y, r); b.addColorStop(0, `rgba(80,210,225,${a})`); b.addColorStop(.7, `rgba(80,210,225,${a * .6})`); b.addColorStop(1, "rgba(80,210,225,0)");
      g.fillStyle = b; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
  }
  function buildNet() {
    net = []; edges = []; return;   // top network removed at client request
    // the network lives only in the band above "From Agenda to Impact", so it never crosses the journey
    const hr = cv.getBoundingClientRect(), j = $(".hero .hj-title");
    let yMax = .3;
    if (j && getComputedStyle($(".hj-svg")).display !== "none") yMax = Math.max(.12, (j.getBoundingClientRect().top - hr.top - 26) / H);
    sd = 23; net = [];
    let guard = 0;
    while (net.length < 74 && guard++ < 5000) {
      const yMin = (82) / H, x = .44 + rnd() * .6, y = yMin + rnd() * Math.max(.02, yMax - yMin);
      if (x < .52 && rnd() < (.52 - x) / .1) continue;                // feather the left edge of the band
      if (net.some(n => Math.hypot((n.x - x) * W, (n.y - y) * H) < 34)) continue;   // even spacing, no clumps
      net.push({ x, y, r: .7 + rnd() * 1.6, p: rnd() * 6.28, sp: .6 + rnd() * 1.4, big: rnd() < .18 });
    }
    edges = [];
    net.forEach((a, i) => { net.map((b, j) => [j, Math.hypot((a.x - b.x) * 1.6, a.y - b.y)]).filter(d => d[0] !== i).sort((p, q) => p[1] - q[1]).slice(0, 4).forEach(([j, d]) => { if (d < .12 && !edges.some(e => e[0] === j && e[1] === i)) edges.push([i, j]); }); });
  }
  function readMasks() {
    const hr = cv.getBoundingClientRect();
    masks = $$(".hero .hj-lbl, .hero .hj-title, .hero-copy, .hdr .nav, .hdr .hdr-tools, .hdr .brand").filter(el => el.offsetParent !== null || el.getClientRects().length).map(el => { const r = el.getBoundingClientRect(); return [r.left - hr.left - 22, r.top - hr.top - 18, r.right - hr.left + 22, r.bottom - hr.top + 18]; });
  }
  const masked = (x, y) => masks.some(m => x > m[0] && x < m[2] && y > m[1] && y < m[3]);
  function size() { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; if (!W || !H) return; cfg.hz = W < 1200 ? .4 : .662; cfg.fy = W < 1200 ? .3 : .185; cv.width = W * dpr; cv.height = H * dpr; buildBg(); buildNet(); readMasks(); draw(performance.now()); }
  // 3D particle terrain: true perspective, rolling hills, glowing ridges, dust and depth haze
  const WAVE_AR = 1018 / 3229, WAVE_VIS = .95, WAVE_PTS = [[0.7299,0.7871],[0.7601,0.7865],[0.7865,0.7407],[0.8344,0.7237],[0.8637,0.8239],[0.3218,0.7437],[0.8658,0.7618],[0.8235,0.6968],[0.244,0.8358],[0.2716,0.8382],[0.2682,0.7603],[0.2282,0.71],[0.282,0.8546],[0.4897,0.8676],[0.2198,0.8098],[0.1882,0.8012],[0.8378,0.7938],[0.3213,0.7925],[0.4094,0.8995],[0.3164,0.8537],[0.8602,0.7358],[0.516,0.7821],[0.3348,0.7793],[0.9248,0.6859],[0.6586,0.8092],[0.244,0.7311],[0.8037,0.7159],[0.2221,0.7701],[0.067,0.6336],[0.8549,0.7818],[0.1254,0.7123],[0.6747,0.8817],[0.711,0.8827],[0.8476,0.7355],[0.9184,0.7844],[0.5342,0.8433],[0.3686,0.8284],[0.4051,0.8603],[0.7261,0.8329],[0.7354,0.8174],[0.1747,0.7854],[0.6462,0.884],[0.0394,0.7111],[0.018,0.6897],[0.293,0.783],[0.2289,0.8251],[0.7709,0.8275],[0.9653,0.5443],[0.9719,0.7076],[0.6115,0.8508],[0.5531,0.8159],[0.1887,0.71],[0.3055,0.7328],[0.1348,0.7363],[0.6562,0.8797],[0.8135,0.8176],[0.0283,0.6898],[0.9524,0.6973],[0.5128,0.8688],[0.5995,0.8278],[0.8239,0.7331],[0.4453,0.8989],[0.9397,0.5981],[0.7756,0.6749],[0.8946,0.7808],[0.154,0.7442],[0.6277,0.8687],[0.0081,0.6562],[0.5869,0.8605],[0.3885,0.8869],[0.3411,0.8823],[0.7005,0.8036],[0.3757,0.7804],[0.7621,0.6803],[0.687,0.7865],[0.0455,0.6658],[0.6648,0.8619],[0.5606,0.8658],[0.374,0.8627],[0.3025,0.7693],[0.8798,0.7483],[0.5545,0.774],[0.0325,0.6004],[0.4898,0.8342],[0.7818,0.8262],[0.0738,0.7006],[0.1714,0.7115],[0.7959,0.8615],[0.5753,0.844],[0.1259,0.7841]];
  const waveImg = new Image(); waveImg.src = "{{WAVE}}"; waveImg.onload = () => { waveCv = null; draw(performance.now()); };
  let waveCv = null;
  function buildWave() {   // soften the top edge so the wave rises out of the background
    waveCv = document.createElement("canvas"); waveCv.width = Math.round(W * dpr); waveCv.height = Math.round(W * dpr * WAVE_AR);
    const g = waveCv.getContext("2d"); g.drawImage(waveImg, 0, 0, waveCv.width, waveCv.height);
    g.globalCompositeOperation = "destination-in";
    const m = g.createLinearGradient(0, 0, 0, waveCv.height); m.addColorStop(0, "rgba(0,0,0,0)"); m.addColorStop(.28, "rgba(0,0,0,.35)"); m.addColorStop(.55, "rgba(0,0,0,1)"); m.addColorStop(1, "rgba(0,0,0,1)");
    g.fillStyle = m; g.fillRect(0, 0, waveCv.width, waveCv.height);
  }
  const COLS = 124, ROWS = 30, Z0 = 1.15, Z1 = 8, XR = 4.9;
  const ss = (e0, e1, x) => { const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
  sd = 91; const VR = Array.from({ length: COLS * ROWS }, () => [rnd(), rnd(), rnd(), rnd(), rnd(), rnd()]);   // fixed per-vertex randomness
  const cfg = { hz: .662, fy: .185, cam: 3, fx: .9 };
  function wavePt(c, r, t) {
    const v = VR[r * COLS + c], k = r / (ROWS - 1);
    let z = 1 / (1 / Z1 + (1 / Z0 - 1 / Z1) * k);                 // k: 0 = far, 1 = near (even screen spacing)
    z *= 1 + (v[4] - .5) * .05;                                   // a little irregularity, like a real mesh
    const x = (-XR + 2 * XR * c / (COLS - 1)) + (v[5] - .5) * .045;
    const sx = W * .5 + x * W * cfg.fx / z;
    const u = (sx / W - .5) * 2, side = ss(.25, 1.1, Math.abs(u));
    const h = .55 * Math.sin(x * 2.5 + t * .3 + z * .9) + .45 * Math.sin(x * 1.05 - z * .7 + 1.3 + t * .18) + .14 * Math.sin(x * 5.2 + z * 1.9 - t * .45) + 1.15 * side;
    const sy = H * cfg.hz + (cfg.cam - h) * H * cfg.fy / z;
    return [sx, sy, h, z, k, sx > -W * .12 && sx < W * 1.12];
  }
  function draw(now) {
    if (!W) return;
    const t = reduce ? 0 : now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(bg, 0, 0, W, H);
    // real wave (from the original artwork): slow drift and breathing, with its own nodes twinkling
    if (waveImg.complete && waveImg.naturalWidth) {
      if (!waveCv || waveCv.width !== Math.round(W * dpr)) buildWave();
      const dx = Math.sin(t * .045) * W * .018, sc = 1 + .012 * Math.sin(t * .07), bw = W * 1.06 * sc, bh = bw * WAVE_AR;
      const lift = innerHeight * .06, x0 = (W - bw) / 2 + dx, y0 = Math.max(H - lift - bh * (W < 1500 ? WAVE_VIS - .07 : WAVE_VIS), WMINY0) + Math.sin(t * .09) * H * .006, dh = H - y0 + 4;   // wave stretched to reach the hero's bottom edge
      // ripple: draw the wave in thin vertical slices, each lifted by a travelling sine, so the hills roll
      const SL = Math.max(90, Math.round(W / 8)), sw = waveCv.width / SL, dw = bw / SL;
      const amp = H * .022, rip = u => Math.sin(u * 6.3 - t * .55) * .65 + Math.sin(u * 13.1 + t * .38) * .35;
      for (let i = 0; i < SL; i++) { const u = i / SL, dy = rip(u) * amp;
        ctx.drawImage(waveCv, i * sw, 0, sw + 1, waveCv.height, x0 + i * dw, y0 + dy, dw + 1, dh); }
      ctx.globalCompositeOperation = "lighter";
      WAVE_PTS.forEach(([u, v], i) => {
        const b = Math.pow(Math.max(0, Math.sin(t * (.5 + (i % 7) * .13) + i * 1.7)), 5);
        if (b < .04) return;
        const x = x0 + u * bw, y = y0 + v * dh + rip(u) * amp, s = 10 + (i % 5) * 3;
        ctx.globalAlpha = .75 * b * Math.min(1, v * 2.2); ctx.drawImage(sprite, x - s, y - s, s * 2, s * 2);
      });
      const gx = x0 + (((t / 22) % 1) * 1.3 - .15) * bw, gy = y0 + bh * .62;
      ctx.globalAlpha = 1;
      const gl = ctx.createRadialGradient(gx, gy, 0, gx, gy, bw * .14);
      gl.addColorStop(0, "rgba(90,230,240,.10)"); gl.addColorStop(1, "rgba(90,230,240,0)");
      ctx.fillStyle = gl; ctx.fillRect(gx - bw * .14, gy - bw * .14, bw * .28, bw * .28);
      ctx.globalCompositeOperation = "source-over";
    }
    // network (upper right), kept clear of text
    const pts = net.map(n => [n.x * W + Math.sin(t * .25 + n.p) * 4, n.y * H + Math.cos(t * .2 + n.p) * 3 - 3]);
    ctx.globalCompositeOperation = "source-over"; ctx.lineWidth = .8;
    edges.forEach(([i, j]) => { const a = pts[i], b = pts[j]; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (masked(mx, my) || masked(a[0], a[1]) || masked(b[0], b[1])) return;
      ctx.strokeStyle = "rgba(110,225,238,.38)"; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
    ctx.globalCompositeOperation = "lighter";
    net.forEach((n, i) => { const [x, y] = pts[i]; if (masked(x, y)) return;
      const b = Math.pow(Math.max(0, Math.sin(t * n.sp + n.p)), 6), tw = .45 + .55 * (.5 + .5 * Math.sin(t * .7 + n.p * 2)), s = (n.big ? 11 : 5) * n.r * .6 * (.85 + .5 * b);   // steady shimmer plus an occasional star-like blink
      ctx.globalAlpha = Math.min(1, .35 + .4 * tw + .6 * b); ctx.drawImage(sprite, x - s, y - s, s * 2, s * 2); });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  function loop(now) { if (now - lastDraw > 33) { draw(now); lastDraw = now; } raf = visible ? requestAnimationFrame(loop) : 0; }
  size();
  const ro = new ResizeObserver(size); ro.observe(cv);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf && !reduce) raf = requestAnimationFrame(loop); });
  io.observe(cv);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { buildNet(); readMasks(); draw(performance.now()); });
  return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
}

function mountWaves() { waveJobs.forEach(f => f()); waveJobs = []; $$("canvas[data-waves]").forEach(c => waveJobs.push(waves(c, JSON.parse(c.dataset.waves || "{}")))); const hs = $(".hero-scene"); if (hs) waveJobs.push(heroScene(hs)); }

/* ============ SEARCH INDEX (Journey B) ============ */
const INDEX = [
  ...Object.entries(S).map(([id, s]) => ({ type: "Capability", name: s.name, sub: `${LOC[id].fam.name} · ${LOC[id].grp.name}`, href: `#service.${id}`, kw: s.kw + " " + s.hero })),
  ...Object.entries(ASSESS).map(([id, a]) => ({ type: "Assessment", name: a.name, sub: a.line, href: `#assessment.${id}`, kw: a.kw })),
  ...FAMILIES.map(f => ({ type: "Family", name: f.name, sub: f.promise, href: `#family.${f.id}`, kw: f.preview.join(" ") })),
  ...INDUSTRIES.map(i => ({ type: "Industry", name: i.name, sub: i.line, href: `#industry.${i.id}`, kw: (i.domains || []).map(d => d[0]).join(" ") + " " + i.priorities.map(p => p[0]).join(" ") })),
  ...AGENDA.map((a, i) => ({ type: "Client agenda", name: a.title, sub: a.line, href: `#agenda.${i + 1}`, kw: a.line })),
  ...INSIGHTS.map((a, i) => ({ type: "Insight", name: a.title, sub: a.dek, href: `#insight.${i + 1}`, kw: a.dek + " " + ((ARTICLES[i + 1] && ARTICLES[i + 1].glance) || []).join(" ") }))
];
function search(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const toks = q.split(/\s+/).filter(Boolean);
  const out = [];
  for (const it of INDEX) {
    const n = it.name.toLowerCase(), k = it.kw.toLowerCase(), s = it.sub.toLowerCase();
    let sc = 0, ok = true;
    for (const t of toks) {
      let ts = 0;
      if (n.includes(t)) ts += n.split(/[\s&,-]+/).some(w => w.startsWith(t)) ? 12 : 8;
      if (new RegExp(`(^|\\s)${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(k)) ts += 6; else if (k.includes(t)) ts += 3;
      if (s.includes(t)) ts += 2;
      if (!ts) { ok = false; break; }
      sc += ts;
    }
    if (!ok) continue;
    if (n.includes(q)) sc += 15;
    if (it.type === "Capability") sc += 1;
    if (it.type === "Assessment") sc += 2;
    out.push({ ...it, sc });
  }
  return out.sort((a, b) => b.sc - a.sc);
}
function hi(text, q) {
  const toks = q.trim().split(/\s+/).filter(t => t.length > 1).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  let h = esc(text);
  if (!toks.length) return h;
  return h.replace(new RegExp(`(${toks.join("|")})`, "gi"), "<mark>$1</mark>");
}

/* ============ SHARED BLOCKS ============ */
function crumbs(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb"><a class="back" href="#" data-back>${BK} Back</a>` +
    items.map((it, i) => (i ? '<span class="s">/</span>' : "") + (it[1] ? `<a href="${it[1]}">${esc(it[0])}</a>` : `<span aria-current="page">${esc(it[0])}</span>`)).join("") + "</nav>";
}
function svcLink(id, cls = "svc-row") {
  const s = S[id];
  return `<a class="${cls}" href="#service.${id}"><strong>${esc(s.name)}${s.assess ? ' <span class="tag as">Assessment</span>' : ""}</strong><p${draftAttr(s.draft)}>${esc(s.hero)}</p>${AR}</a>`;
}
function mini(id) {
  const s = S[id], l = LOC[id];
  return `<a class="mini" href="#service.${id}"><span class="k">${esc(l.fam.name)}</span><strong>${esc(s.name)}</strong><p${draftAttr(s.draft)}>${esc(s.hero)}</p></a>`;
}
function assessCard(id, withDims) {
  const a = ASSESS[id];
  return `<a class="as-card" href="#assessment.${id}">
    <div class="scale" aria-hidden="true">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= 2 ? "on" : ""}"></i>`).join("")}</div>
    <h3>${esc(a.name)}</h3><p>${esc(a.line)}</p>
    ${withDims ? `<div class="as-dims" data-draft>${a.dims.join(" · ")}</div>` : ""}
    <span class="link">View assessment ${AR}</span></a>`;
}
function outCard(i) {
  const o = OUTCOMES[i], tab = OUTTAB[i] || "challenge", idx = ["challenge", "intervention", "outcome"].indexOf(tab);
  return `<article class="out" data-out="${i}">
    <div class="out-top">${o.fams.map(f => `<a class="tag" href="#family.${f}">${esc(FAM[f].name)}</a>`).join(" ")}<span class="illus">Illustrative · anonymised</span></div>
    <h3>${esc(o.title)}</h3>
    <div class="out-tabs" role="tablist">${["challenge", "intervention", "outcome"].map(t => `<button role="tab" aria-selected="${t === tab}" data-otab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div>
    <div class="out-steps" aria-hidden="true">${[0, 1, 2].map(k => `<i class="${k <= idx ? "on" : ""}"></i>`).join("")}</div>
    <p class="out-body" data-draft>${esc(o[tab])}</p>
    <span class="illus">${esc(o.sector)}</span>
  </article>`;
}
/* approved editorial banners: [image, object-position chosen to keep each visual thesis in frame] */
const INS_PHOTO = { 0: ["{{INS1}}", "72% 50%"], 1: ["{{INS2}}", "50% 50%"], 3: ["{{INS4}}", "68% 50%"] };
/* approved editorial photography (takes precedence over the graphic system) */
const INS_PHOTO2 = { 0: ["{{INS1P}}", "80% 50%"], 1: ["{{INS2P}}", "50% 40%"], 2: ["{{INS3P}}", "70% 20%"], 4: ["{{INS5P}}", "80% 50%"], 5: ["{{INS6P}}", "85% 35%"], 6: ["{{INS7P}}", "100% 50%"], 8: ["{{INS9P}}", "100% 30%"], 7: ["{{INS8P}}", "75% 50%"], 3: ["{{INS4P}}", "70% 40%"] };
function insCard(i) {
  const a = INSIGHTS[i], cat = INSIGHT_CATS.find(c => c[0] === a.cat)[1];
  const ed = ED_ART[i], ph = INS_PHOTO2[i];
  return `<a class="ins" href="#insight.${i + 1}"><div class="ins-art${ph ? " ins-photo" : ed ? " ins-ed" : ""}">${ph ? `<img src="${ph[0]}" alt="" loading="lazy" style="object-position:${ph[1]}">` : ed ? ed() : insightArt(i, a.cat)}</div>
    <div class="ins-meta"><span class="tag">${esc(cat)}</span><span>${a.type}</span><span>${a.mins} min read</span></div>
    <h3 data-draft>${esc(a.title)}</h3><p data-draft>${esc(a.dek)}</p></a>`;
}
function talk(title, line, ctx) {
  return `<section class="final ink"><canvas data-waves='{"base":0.85,"from":0.3}' aria-hidden="true"></canvas>
    <div class="wrap final-in"><span class="eyebrow">Talk to our team</span><h2>${title}</h2><p class="lede">${line}</p>
    <div class="hero-cta"><a class="btn btn-p" href="#contact" data-ctx="${esc(ctx || "")}">Talk to Strategic Advisory ${AR}</a><a class="btn btn-s" href="#services">Explore Our Capabilities</a></div></div></section>`;
}
function phero({ crumbs: c, eyebrow, title, stmt, meta, draft }) {
  return `<section class="phero ink"><canvas data-waves='{"base":0.8,"from":0.45,"n":30}' aria-hidden="true"></canvas>
    <div class="wrap">${c}<div class="phero-in"><span class="eyebrow">${eyebrow}</span><h1>${esc(title)}</h1>${stmt ? `<p class="stmt"${draftAttr(draft)}>${esc(stmt)}</p>` : ""}${meta ? `<div class="phero-meta">${meta}</div>` : ""}</div></div></section>`;
}
function subnav(title, links, ctx) {
  return `<div class="subnav" id="subnav"><div class="wrap subnav-in"><span class="t">${esc(title)}</span>${links.map(l => `<a href="#${l[0]}" data-scroll="${l[0]}">${l[1]}</a>`).join("")}<a class="btn btn-p" href="#contact" data-ctx="${esc(ctx || "")}">Talk to us</a></div></div>`;
}

/* ============ EXPLORER (Family → Group → Service) ============ */
function explorer() {
  const f = FAM[EX.fam], g = f.groups.find(x => x.id === EX.grp) || f.groups[0];
  return `<div class="ex" id="explorer">
    <div class="ex-tabs" role="tablist" aria-label="Strategic Advisory disciplines">${FAMILIES.map(x => `<button class="ex-tab" role="tab" aria-selected="${x.id === f.id}" data-exf="${x.id}"><span class="n">Family ${x.n}</span><strong>${esc(x.name)}</strong></button>`).join("")}</div>
    <div class="ex-body">
      <div class="ex-groups" role="tablist" aria-label="Service groupings"><span class="lbl">Service groupings</span>${f.groups.map(x => `<button class="ex-g" role="tab" aria-selected="${x.id === g.id}" data-exg="${x.id}"><i>${x.id.toUpperCase()}</i><span>${esc(x.name)}</span></button>`).join("")}</div>
      <div class="ex-panel"><div class="ex-ph"><h3>${esc(g.name)}</h3><a class="link" href="#family.${f.id}">${esc(f.cta)} ${AR}</a></div>${g.services.map(id => svcLink(id)).join("")}</div>
    </div>
    <div class="ex-foot"><span>Delivered independently where appropriate, or combined into broader advisory engagements.</span><a class="link" href="#services">View All Capabilities ${AR}</a></div>
  </div>`;
}


/* From Agenda to Impact path: points in a 1000×600 box, rising toward the network */
const HJ = [[20,330,"Shape","Set direction and priorities"],[220,262,"Design","Define what must change"],[420,194,"Architect","Connect capability and technology"],[620,126,"Enable","Empower the organization to act"],[820,58,"Institutionalize","Make the capability last"]];
const HJ_PATH = (() => { const P = [[-80,384], ...HJ.map(n => [n[0], n[1]]), [1000,14]]; let d = `M${P[0][0]} ${P[0][1]}`;
  for (let i = 0; i < P.length - 1; i++) { const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)},${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)},${p2[0]} ${p2[1]}`; }
  return d; })();

let AGSEL = 0;
function agList() {
  const g = AGENDA_VOICE[AGSEL].g;
  return AGENDA_VOICE.map((v, i) => v.g !== g ? "" : `<button class="sel-item" id="agt-${i}" aria-controls="agp" aria-pressed="${i === AGSEL}" data-ag="${i}"><span class="sel-say">${esc(v.say)}</span><span class="sel-ar">${AR}</span></button><div class="sel-inline" data-agi="${i}"${i === AGSEL ? "" : " hidden"}>${i === AGSEL ? agPanel(i) : ""}</div>`).join("");
}
function agPanel(i) {
  const v = AGENDA_VOICE[i];
  let t, href;
  if (v.start[0] === "a") { t = ASSESS[v.start[1]].name; href = `#assessment.${v.start[1]}`; }
  else { t = FAM[v.start[1]].modules[v.start[2]][1]; href = `#family.${v.start[1]}`; }
  return `<div class="sp-in"><span class="eyebrow">${esc(AG_GROUPS[v.g][0])}</span>
    <p class="sp-q">“${esc(v.q)}”</p>
    <div class="sp-caps"><span class="sp-l">How we help</span>${v.picks.map(id => `<a href="#service.${id}"><span>${esc(S[id].name)}</span>${AR}</a>`).join("")}</div>
    <div class="sp-foot"><a class="btn btn-p" href="${href}">Start with: ${esc(t)} ${AR}</a><a class="link" href="#agenda.${v.page}">See the full agenda ${AR}</a></div></div>`;
}
function pNeed(n) {
  const i = n - 1, v = AGENDA_VOICE[i]; if (!v) return pNotFound();
  let st;
  if (v.start[0] === "a") { const s = ASSESS[v.start[1]]; st = { t: s.name, p: s.line, href: `#assessment.${v.start[1]}`, l: "View assessment" }; }
  else { const m = FAM[v.start[1]].modules[v.start[2]]; st = { t: m[1], p: m[2], href: `#family.${v.start[1]}`, l: `Explore ${FAM[v.start[1]].name}` }; }
  const more = AGENDA_VOICE.map((x, k) => [x, k]).filter(([x, k]) => x.g === v.g && k !== i);
  return `${phero({ crumbs: crumbs([["Home", "#home"], ["What are you trying to achieve?", "#home.agenda"], [AG_GROUPS[v.g][0]]]), eyebrow: AG_GROUPS[v.g][0], title: v.say, stmt: v.q, draft: true })}
  <section class="sec"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">How we help</span><h2 class="h2">The capabilities that address this</h2></div>
    <div class="mini-grid">${v.picks.map(mini).join("")}</div>
    <div class="start" style="margin-top:32px"><div><span class="eyebrow">Where to start</span><h3>${esc(st.t)}</h3><p>${esc(st.p)}</p></div><a class="btn btn-p" href="${st.href}">${st.l} ${AR}</a></div>
  </div></section>
  <section class="sec alt"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">Related</span><h2 class="h2">Other agendas in ${esc(AG_GROUPS[v.g][0].toLowerCase())}</h2></div>
    <ul class="need-more">${more.map(([x, k]) => `<li><a href="#need.${k + 1}"><span>${esc(x.say)}</span>${AR}</a></li>`).join("")}</ul>
  </div></section>
  ${talk("Talk to our advisory team", "Tell us where you are today. We will help you shape the right first step.", v.say)}`;
}
/* ============ PAGES ============ */
function pHome() {
  return `
  <section class="hero ink" aria-label="Blackstone Strategic Advisory">
    <div class="hero-media" aria-hidden="true"><canvas class="hero-scene"></canvas></div>
    <div class="hero-line amb" id="s-amb" role="img" aria-label="Ambition and impact meet in capability. The distance between ambition and impact is capability.">
      <div class="amb-stage" aria-hidden="true"><span class="amb-t amb-tl">Ambition</span><div class="amb-c amb-l"></div><div class="amb-c amb-r"></div><svg class="amb-lens" viewBox="0 0 132 100" preserveAspectRatio="none"><defs><radialGradient id="ambg"><stop offset="0" stop-color="#0f8f99"/><stop offset="1" stop-color="#0a5f68"/></radialGradient></defs><path d="M66 2.63 A50 50 0 0 1 66 97.37 A50 50 0 0 1 66 2.63Z"/></svg><b class="amb-cap">Capability</b><span class="amb-t amb-tr">Impact</span></div>
      <div class="amb-auto" aria-hidden="true"><div class="aa-row"><span class="aa-track"></span>${["Assist", "Recommend", "Orchestrate", "Act"].map((t, i) => `<span class="aa-step" style="--k:${i}"><b>${t}</b><i></i></span>`).join("")}</div><p class="aa-cap">Increasing autonomy →</p><i class="aa-mover"></i></div>
      <div class="amb-wf" aria-hidden="true"><span class="mx-f"><span class="mx-node mx-h"><i></i></span><em>Human capability</em></span><span class="mx-op mx-x">×</span><span class="mx-f"><span class="mx-node mx-ai"><i></i><b></b></span><em>AI</em></span><span class="mx-op mx-ar"><span class="mx-sig"></span>→</span><span class="mx-out"><svg class="mx-net" viewBox="0 0 120 96" aria-hidden="true"><path class="ml ml1" style="--d:0" d="M60 48L60.0 20.0"/><path class="ml ml1" style="--d:1" d="M60 48L84.2 34.0"/><path class="ml ml1" style="--d:2" d="M60 48L84.2 62.0"/><path class="ml ml1" style="--d:3" d="M60 48L60.0 76.0"/><path class="ml ml1" style="--d:4" d="M60 48L35.8 62.0"/><path class="ml ml1" style="--d:5" d="M60 48L35.8 34.0"/><path class="ml ml2" style="--d:0" d="M60.0 20.0L84.2 34.0"/><path class="ml ml2" style="--d:1" d="M84.2 34.0L84.2 62.0"/><path class="ml ml2" style="--d:2" d="M84.2 62.0L60.0 76.0"/><path class="ml ml2" style="--d:3" d="M60.0 76.0L35.8 62.0"/><path class="ml ml2" style="--d:4" d="M35.8 62.0L35.8 34.0"/><path class="ml ml2" style="--d:5" d="M35.8 34.0L60.0 20.0"/><path class="ml ml3" style="--d:0" d="M60.0 20.0L82.0 9.9"/><path class="ml ml3" style="--d:0" d="M84.2 34.0L82.0 9.9"/><path class="ml ml3" style="--d:1" d="M84.2 34.0L104.0 48.0"/><path class="ml ml3" style="--d:1" d="M84.2 62.0L104.0 48.0"/><path class="ml ml3" style="--d:2" d="M84.2 62.0L82.0 86.1"/><path class="ml ml3" style="--d:2" d="M60.0 76.0L82.0 86.1"/><path class="ml ml3" style="--d:3" d="M60.0 76.0L38.0 86.1"/><path class="ml ml3" style="--d:3" d="M35.8 62.0L38.0 86.1"/><path class="ml ml3" style="--d:4" d="M35.8 62.0L16.0 48.0"/><path class="ml ml3" style="--d:4" d="M35.8 34.0L16.0 48.0"/><path class="ml ml3" style="--d:5" d="M35.8 34.0L38.0 9.9"/><path class="ml ml3" style="--d:5" d="M60.0 20.0L38.0 9.9"/><circle class="mn mn1" style="--d:0" cx="60.0" cy="20.0" r="3.4"/><circle class="mn mn1" style="--d:1" cx="84.2" cy="34.0" r="3.4"/><circle class="mn mn1" style="--d:2" cx="84.2" cy="62.0" r="3.4"/><circle class="mn mn1" style="--d:3" cx="60.0" cy="76.0" r="3.4"/><circle class="mn mn1" style="--d:4" cx="35.8" cy="62.0" r="3.4"/><circle class="mn mn1" style="--d:5" cx="35.8" cy="34.0" r="3.4"/><circle class="mn mn2" style="--d:0" cx="82.0" cy="9.9" r="2.4"/><circle class="mn mn2" style="--d:1" cx="104.0" cy="48.0" r="2.4"/><circle class="mn mn2" style="--d:2" cx="82.0" cy="86.1" r="2.4"/><circle class="mn mn2" style="--d:3" cx="38.0" cy="86.1" r="2.4"/><circle class="mn mn2" style="--d:4" cx="16.0" cy="48.0" r="2.4"/><circle class="mn mn2" style="--d:5" cx="38.0" cy="9.9" r="2.4"/><circle class="mx-halo" cx="60" cy="48" r="15"/><circle class="mx-core" cx="60" cy="48" r="8"/></svg><span class="mx-res"><b>10X</b><em>Potential</em></span></span></div>
      <div class="amb-oe" aria-hidden="true">${["Discipline", "Efficiency", "Resilience", "Performance"].map((t, i) => `${i ? `<i style="--k:${i}">→</i>` : ""}<span style="--k:${i}">${t}</span>`).join("")}<b class="oe-rule"></b></div>
      <div class="amb-c6" aria-hidden="true">${["Agenda", "Capability", "Institutionalisation"].map((t, i) => `${i ? `<i style="--k:${i}"></i>` : ""}<span style="--k:${i}">${t}</span>`).join("")}</div>
      <p class="amb-line" aria-hidden="true"><span class="al al-0">The distance between ambition and impact is <b>capability</b></span><span class="al al-1">Agentic AI turns autonomy into <b>enterprise capability</b></span><span class="al al-2">AI doesn&rsquo;t replace human capability. It <b>multiplies it</b></span><span class="al al-3">Complexity should never be <b>the price of performance</b></span><span class="al al-4">Make transformation an <b>institutional capability</b> — not another programme</span></p>
    </div>
    <div class="wrap hero-in">
      <div class="hero-copy hs-wrap">
        <div class="hs-stack">
          <div class="hs is-on" data-s="0" id="hs-0" role="group" aria-roledescription="slide" aria-label="1 of 5">
            <span class="eyebrow">For The Decisions That Shape What&rsquo;s Next</span>
            <h1><span class="hl">Turn Ambition into</span> <span class="hl">Capability to Create</span> <span class="hl"><em>Enduring Value</em></span></h1>
            <p class="lede">We bring strategy, technology and execution together to turn complex ambitions into coordinated action — strengthening the capabilities, operating models and foundations required to create enduring value.</p>
            <div class="hero-cta"><a class="btn btn-p" href="#value">See How We Create Value ${AR}</a><a class="btn btn-s" href="#contact">Start a Conversation</a></div>
          </div>
          <div class="hs" data-s="1" id="hs-1" role="group" aria-roledescription="slide" aria-label="2 of 5" aria-hidden="true" inert>
            <span class="eyebrow">The Next Enterprise Shift</span>
            <h1><span class="hl">When AI Can Act,</span> <span class="hl">the Enterprise</span> <span class="hl"><em>Must Evolve</em></span></h1>
            <p class="lede">Agentic AI is moving from assisting people to acting across workflows, decisions and systems. Capturing its value requires more than deploying agents — it requires redesigning work, decision rights, architecture and governance for a new level of autonomy.</p>
            <div class="hero-cta"><a class="btn btn-p" href="#agenda.1">Explore the Agentic Enterprise ${AR}</a><a class="btn btn-s" href="#contact" data-ctx="Agentic AI">Start a Conversation</a></div>
          </div>
          <div class="hs" data-s="2" id="hs-2" role="group" aria-roledescription="slide" aria-label="3 of 5" aria-hidden="true" inert>
            <span class="eyebrow">The AI-Ready Workforce</span>
            <h1><span class="hl">Build an AI-Ready</span> <span class="hl">Workforce to Unlock</span> <span class="hl"><em>10X Potential</em></span></h1>
            <p class="lede">AI is reshaping roles, skills and how work gets done. Building an AI-ready workforce requires more than new skills — it requires combining human judgement with AI to amplify capability, adapt ways of working and accelerate performance.</p>
            <div class="hero-cta"><a class="btn btn-p" href="#workforce">Build an AI-Ready Workforce ${AR}</a><a class="btn btn-s" href="#contact" data-ctx="AI-ready workforce">Start a Conversation</a></div>
          </div>
          <div class="hs" data-s="3" id="hs-3" role="group" aria-roledescription="slide" aria-label="4 of 5" aria-hidden="true" inert>
            <span class="eyebrow">The Performance Imperative</span>
            <h1><span class="hl">Run Smarter. Build</span> <span class="hl">a Stronger, More</span> <span class="hl"><em>Adaptive Enterprise</em></span></h1>
            <p class="lede">As organisations scale, complexity, cost and operational risk scale with them. Building a high-performing enterprise requires stronger governance, rationalised complexity, optimised cost and the resilience to adapt and perform through continuous change.</p>
            <div class="hero-cta"><a class="btn btn-p" href="#performance">Strengthen Operational Excellence ${AR}</a><a class="btn btn-s" href="#contact" data-ctx="Operational excellence">Start a Conversation</a></div>
          </div>
          <div class="hs" data-s="4" id="hs-4" role="group" aria-roledescription="slide" aria-label="5 of 5" aria-hidden="true" inert>
            <span class="eyebrow">How Transformation Endures</span>
            <h1><span class="hl">Turn Transformation into</span> <span class="hl">an Institutional</span> <span class="hl"><em>Capability</em></span></h1>
            <p class="lede">C6 connects strategy, knowledge, people, processes, governance and technology to turn complex transformation agendas into capabilities that can be executed, embedded and sustained.</p>
            <div class="hero-cta"><a class="btn btn-p" href="#c6">Explore the C6 Framework ${AR}</a><a class="btn btn-s" href="#contact" data-ctx="C6 Framework">Start a Conversation</a></div>
          </div>
        </div>
        <div class="hs-nav hs-dots" role="tablist" aria-label="Hero stories">${[["01", "Enduring value"], ["02", "Agentic AI"], ["03", "AI-ready workforce"], ["04", "Operational excellence"], ["05", "C6 Framework"]].map(([n, t], i) => `<button type="button" role="tab" data-hs="${i}" aria-controls="hs-${i}" aria-selected="${i === 0}" aria-label="Story ${n}: ${t}" tabindex="${i === 0 ? 0 : -1}"><span>${n}</span><em>${t}</em></button>`).join("")}<button type="button" class="hs-pause" aria-label="Pause stories" aria-pressed="false"><svg viewBox="0 0 12 12" aria-hidden="true"><path class="ps" d="M4 3v6M8 3v6"/><path class="pl" d="M4 2.6v6.8L9.6 6z"/></svg></button></div>
      </div>
      <div class="hero-journey" aria-label="From agenda to impact">
        <p class="hj-title">From Agenda to Impact</p>
        <p class="hj-intro">How we move an executive agenda from intent to institutional impact</p>
        <div class="hj-stage">
          <svg class="hj-svg" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="hjg" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#7fd1d6" stop-opacity="0"/><stop offset=".12" stop-color="#7fd1d6" stop-opacity=".55"/><stop offset=".88" stop-color="#7fd1d6" stop-opacity=".75"/><stop offset="1" stop-color="#7fd1d6" stop-opacity="0"/></linearGradient></defs>
            <path class="hj-base" d="${HJ_PATH}"/>
            <path class="hj-line" d="${HJ_PATH}" pathLength="1"/>
            <path class="hj-pulse" d="${HJ_PATH}" pathLength="1"/>
          </svg>
          ${HJ.map((n, i) => `<div class="hj-lead" style="left:${n[0] / 10}%;top:${n[1] / 6}%;height:calc(${73 - n[1] / 6}% - 10px);--i:${i}"></div><div class="hj-node" style="left:${n[0] / 10}%;top:${n[1] / 6}%;--i:${i}"><i></i></div><div class="hj-lbl" style="left:${n[0] / 10}%;--i:${i}"><em>0${i + 1}</em><b>${n[2]}</b><span>${n[3]}</span></div>`).join("")}
        </div>
        <div class="c6v" role="img" aria-label="The C6 Framework: six connected capabilities — Connect (intelligence and context), Collaborate (align people and perspectives), Co-Vision (shape shared ambition), Craft (design capabilities and operating models), Construct (turn design into reality) and Constitute (embed capability institutionally) — around C6.">
          <p class="hj-title">The C6 Framework</p>
          <p class="hj-intro">From transformation agenda to institutional capability</p>
          <div class="c6m" aria-hidden="true">
            <svg class="c6-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path class="c6-x" pathLength="1" d="M39 17L72 50"/><path class="c6-x" pathLength="1" d="M61 17L61 83"/><path class="c6-x" pathLength="1" d="M72 50L39 83"/><path class="c6-x" pathLength="1" d="M61 83L28 50"/><path class="c6-x" pathLength="1" d="M39 83L39 17"/><path class="c6-x" pathLength="1" d="M28 50L61 17"/><path class="c6-ring" pathLength="1" d="M39 17L61 17L72 50L61 83L39 83L28 50Z"/><path class="c6-sp" pathLength="1" style="--k:0" d="M50 50L39 17"/><path class="c6-sp" pathLength="1" style="--k:1" d="M50 50L61 17"/><path class="c6-sp" pathLength="1" style="--k:2" d="M50 50L72 50"/><path class="c6-sp" pathLength="1" style="--k:3" d="M50 50L61 83"/><path class="c6-sp" pathLength="1" style="--k:4" d="M50 50L39 83"/><path class="c6-sp" pathLength="1" style="--k:5" d="M50 50L28 50"/></svg>
            <div class="c6-core"><b>C6</b></div>
            <span class="c6-n" style="left:39%;top:17%;--k:0;--sx:-140px;--sy:330px"><i></i></span><span class="c6-n" style="left:61%;top:17%;--k:1;--sx:60px;--sy:360px"><i></i></span><span class="c6-n" style="left:72%;top:50%;--k:2;--sx:150px;--sy:300px"><i></i></span><span class="c6-n" style="left:61%;top:83%;--k:3;--sx:-40px;--sy:390px"><i></i></span><span class="c6-n" style="left:39%;top:83%;--k:4;--sx:-210px;--sy:350px"><i></i></span><span class="c6-n" style="left:28%;top:50%;--k:5;--sx:-90px;--sy:300px"><i></i></span><div class="c6-lbl c6-l" style="--k:0;top:17%;right:calc(61% + 20px)"><em>01</em><b>Connect</b><span>Connect intelligence &amp; context</span></div><div class="c6-lbl c6-r" style="--k:1;top:17%;left:calc(61% + 20px)"><em>02</em><b>Collaborate</b><span>Align people &amp; perspectives</span></div><div class="c6-lbl c6-r" style="--k:2;top:50%;left:calc(72% + 20px)"><em>03</em><b>Co-Vision</b><span>Shape shared ambition</span></div><div class="c6-lbl c6-r" style="--k:3;top:83%;left:calc(61% + 20px)"><em>04</em><b>Craft</b><span>Design capabilities &amp; operating models</span></div><div class="c6-lbl c6-l" style="--k:4;top:83%;right:calc(61% + 20px)"><em>05</em><b>Construct</b><span>Turn design into reality</span></div><div class="c6-lbl c6-l" style="--k:5;top:50%;right:calc(72% + 20px)"><em>06</em><b>Constitute</b><span>Embed capability institutionally</span></div>
          </div>
          <ol class="c6-list"><li><em>01</em><b>Connect</b><span>Connect intelligence &amp; context</span></li><li><em>02</em><b>Collaborate</b><span>Align people &amp; perspectives</span></li><li><em>03</em><b>Co-Vision</b><span>Shape shared ambition</span></li><li><em>04</em><b>Craft</b><span>Design capabilities &amp; operating models</span></li><li><em>05</em><b>Construct</b><span>Turn design into reality</span></li><li><em>06</em><b>Constitute</b><span>Embed capability institutionally</span></li></ol>
        </div>
        <div class="oev" role="img" aria-label="The high-performance enterprise: four interconnected disciplines around operational excellence — govern (clarify accountability and control), rationalise (remove complexity and duplication), optimise (improve cost and resource efficiency) and strengthen (build resilience and continuity).">
          <p class="hj-title">The High-Performance Enterprise</p>
          <p class="hj-intro">Building the discipline to perform efficiently, effectively and resiliently</p>
          <div class="oe" aria-hidden="true">
            <svg class="oe-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path class="oe-ring" d="M36 19L64 19L64 81L36 81Z"/><path class="oe-sp" style="--k:0" d="M50 50L36 19"/><path class="oe-sp" style="--k:1" d="M50 50L64 19"/><path class="oe-sp" style="--k:2" d="M50 50L64 81"/><path class="oe-sp" style="--k:3" d="M50 50L36 81"/></svg>
            <span class="oe-orb"></span>
            <div class="oe-core"><span>Operational<br>excellence</span></div>
            <span class="oe-n oe-tl" style="left:36%;top:19%;--k:0"><i></i></span><span class="oe-n oe-tr" style="left:64%;top:19%;--k:1"><i></i></span><span class="oe-n oe-br" style="left:64%;top:81%;--k:2"><i></i></span><span class="oe-n oe-bl" style="left:36%;top:81%;--k:3"><i></i></span><div class="oe-lbl oe-l-tl" style="--k:0;top:19%"><em>01</em><b>Govern</b><span>Clarify accountability &amp; control</span></div><div class="oe-lbl oe-l-tr" style="--k:1;top:19%"><em>02</em><b>Rationalise</b><span>Remove complexity &amp; duplication</span></div><div class="oe-lbl oe-l-br" style="--k:2;top:81%"><em>03</em><b>Optimise</b><span>Improve cost &amp; resource efficiency</span></div><div class="oe-lbl oe-l-bl" style="--k:3;top:81%"><em>04</em><b>Strengthen</b><span>Build resilience &amp; continuity</span></div>
          </div>
          <ol class="oe-list"><li><em>01</em><b>Govern</b><span>Clarify accountability &amp; control</span></li><li><em>02</em><b>Rationalise</b><span>Remove complexity &amp; duplication</span></li><li><em>03</em><b>Optimise</b><span>Improve cost &amp; resource efficiency</span></li><li><em>04</em><b>Strengthen</b><span>Build resilience &amp; continuity</span></li></ol>
        </div>
        <div class="wfv" role="img" aria-label="The 10X workforce: Equip — build AI fluency and skills; Augment — amplify individual capability; Adapt — evolve roles and ways of working; Scale — embed AI across the workforce. Built on leadership, skills, culture and governance.">
          <p class="hj-title">The 10X Workforce</p>
          <p class="hj-intro">Amplifying human capability through AI</p>
          <div class="wf" aria-hidden="true">
            <svg class="wf-svg" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
            <div class="wf-c wf-c0" style="left:8%;--k:0;--r:0px"><i></i></div><span class="wf-lead" style="left:8%;--r:10px;--k:0"></span><div class="wf-c wf-c1" style="left:34%;--k:1;--r:34px"><span class="wf-ring" style="--r:34px"></span><b style="--a:0deg;--r:34px"></b><b style="--a:120deg;--r:34px"></b><b style="--a:240deg;--r:34px"></b><i></i></div><span class="wf-lead" style="left:34%;--r:34px;--k:1"></span><div class="wf-c wf-c2" style="left:60%;--k:2;--r:46px"><span class="wf-ring" style="--r:46px"></span><b style="--a:0deg;--r:46px"></b><b style="--a:60deg;--r:46px"></b><b style="--a:120deg;--r:46px"></b><b style="--a:180deg;--r:46px"></b><b style="--a:240deg;--r:46px"></b><b style="--a:300deg;--r:46px"></b><b class="in" style="--a:60deg;--r:22px"></b><b class="in" style="--a:180deg;--r:22px"></b><b class="in" style="--a:300deg;--r:22px"></b><i></i></div><span class="wf-lead" style="left:60%;--r:46px;--k:2"></span><div class="wf-c wf-c3" style="left:86%;--k:3;--r:62px"><span class="wf-ring" style="--r:62px"></span><b style="--a:0deg;--r:62px"></b><b style="--a:36deg;--r:62px"></b><b style="--a:72deg;--r:62px"></b><b style="--a:108deg;--r:62px"></b><b style="--a:144deg;--r:62px"></b><b style="--a:180deg;--r:62px"></b><b style="--a:216deg;--r:62px"></b><b style="--a:252deg;--r:62px"></b><b style="--a:288deg;--r:62px"></b><b style="--a:324deg;--r:62px"></b><b class="in" style="--a:30deg;--r:36px"></b><b class="in" style="--a:90deg;--r:36px"></b><b class="in" style="--a:150deg;--r:36px"></b><b class="in" style="--a:210deg;--r:36px"></b><b class="in" style="--a:270deg;--r:36px"></b><b class="in" style="--a:330deg;--r:36px"></b><i></i></div><span class="wf-lead" style="left:86%;--r:62px;--k:3"></span><div class="hj-lbl wf-lbl" style="left:8%"><em>01</em><b>Equip</b><span>Build AI fluency &amp; skills</span></div><div class="hj-lbl wf-lbl" style="left:34%"><em>02</em><b>Augment</b><span>Amplify individual capability</span></div><div class="hj-lbl wf-lbl" style="left:60%"><em>03</em><b>Adapt</b><span>Evolve roles &amp; ways of working</span></div><div class="hj-lbl wf-lbl" style="left:86%"><em>04</em><b>Scale</b><span>Embed AI across the workforce</span></div>
            <span class="wf-spine"></span><p class="wf-found"></p><p class="wf-base2"><span>Foundation</span>Leadership · Skills · Culture · Governance</p>
          </div>
          <ol class="wf-list"><li><em>01</em><b>Equip</b><span>Build AI fluency &amp; skills</span></li><li><em>02</em><b>Augment</b><span>Amplify individual capability</span></li><li><em>03</em><b>Adapt</b><span>Evolve roles &amp; ways of working</span></li><li><em>04</em><b>Scale</b><span>Embed AI across the workforce</span></li></ol>
          <p class="wf-foundm">Leadership · Skills · Culture · Governance</p>
        </div>
        <div class="agv" role="img" aria-label="The Agentic Enterprise: human intent sets goals, priorities and constraints; agentic orchestration reasons, plans, coordinates and executes, enabled by enterprise capabilities — data, applications, workflows and knowledge; this produces decisions and actions, which escalate to human oversight where required and feed learning back into orchestration. Governance, human oversight, decision rights and accountability surround the whole system.">
          <p class="hj-title">The Agentic Enterprise</p>
          <p class="hj-intro">From human intent to governed autonomous action</p>
          <div class="agx" aria-hidden="true">
            <div class="ag2">
              <div class="ag2-frame"><span class="ag2-gov">Governance · Decision rights · Human oversight · Accountability</span></div>
              <div class="ag2-in">
              <svg class="ag2-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path class="ag2-spine" d="M44 22V80"/>
                ${[38, 47, 56, 65].map(y => `<path class="ag2-cap-l" d="M23 ${y}C32 ${y} 34 51 40 51"/>`).join("")}
                <path class="ag2-esc" d="M42.5 78C35 72 35 28 42.5 24"/>
                </svg>
              <i class="ag2-pulse"></i>
              <div class="ag2-node ag2-intent" style="top:22%"><i></i></div>
              <div class="ag2-node ag2-hub" style="top:51%"><span class="ag2-orbit"><b></b><b></b><b></b><b></b><b></b></span><i></i></div>
              <div class="ag2-node ag2-act" style="top:80%"><i></i></div>
              <div class="hj-lbl ag2-lbl" style="top:22%"><em>01</em><b>Human intent</b><span>Set outcomes &amp; boundaries</span></div>
              <div class="hj-lbl ag2-lbl ag2-lbl-o" style="top:51%"><em>02</em><b>Agentic orchestration</b><span>Reason · coordinate · execute</span></div>
              <div class="hj-lbl ag2-lbl" style="top:80%"><em>03</em><b>Intelligent action</b><span>Decide · act · escalate</span></div>
              <p class="ag2-en">Enabled by</p>
              <span class="ag2-cap" style="top:38%">Data<i></i></span><span class="ag2-cap" style="top:47%">Knowledge<i></i></span><span class="ag2-cap" style="top:56%">Applications<i></i></span><span class="ag2-cap" style="top:65%">Workflows<i></i></span>
              <span class="ag2-esct">Escalate</span>
              </div>
            </div>
            <ol class="agx-list">
              <li class="k"><em>01</em><b>Human intent</b><span>Set outcomes &amp; boundaries</span></li>
              <li class="k"><em>02</em><b>Agentic orchestration</b><span>Reason · coordinate · execute</span></li>
              <li class="en"><em></em><b>Enabled by</b><span>Data · knowledge · applications · workflows</span></li>
              <li class="k"><em>03</em><b>Intelligent action</b><span>Decide · act · escalate</span></li>
            </ol>
            <p class="agx-autm">Assist → Recommend → Orchestrate → Act<small>Increasing autonomy</small></p>
            <p class="agx-govbar">Governance · Decision rights · Human oversight · Accountability</p>
          </div>
        </div>
      </div>
    </div>
  </section>



  <section class="sec pos2" id="s-position"><div class="wrap">
    <div class="pos2-grid">
      <div class="pos2-copy">
        <span class="eyebrow">Our Position</span>
        <h2>Strategy that doesn't stop at advice. <span>Technology that doesn't start with implementation</span></h2>
        <p class="lede">Blackstone combines boardroom-level strategic advisory with deep technology and execution capability — connecting executive ambition to enduring value.</p>
      </div>
      <figure class="cmp" id="pf" aria-label="Strategy firms are deep in boardroom strategy with lighter technology and execution reach; technology firms the reverse; Blackstone Strategic Advisory brings both in one advisory relationship.">
        <div class="cmp-head"><span></span><span>Boardroom Strategy</span><span>Technology &amp; Execution</span></div>
        <div class="cmp-row ctx"><div class="cmp-name"><b>Strategy Firms</b><span>Deep strategic advisory — lighter technology and execution reach</span></div><div class="cmp-bar full"><i></i></div><div class="cmp-bar part"><i></i></div></div>
        <div class="cmp-row ctx"><div class="cmp-name"><b>Technology Firms</b><span>Deep technology and execution — lighter boardroom advisory reach</span></div><div class="cmp-bar part"><i></i></div><div class="cmp-bar full"><i></i></div></div>
        <div class="cmp-bs">
          <div class="cmp-row"><div class="cmp-name"><b>Blackstone<br>Strategic Advisory</b><span>Boardroom credibility. Technology depth. One advisory relationship</span></div><div class="cmp-bar one"><i></i></div></div>
          <ol class="vc" aria-label="Value continuum">${["Strategy", "Capability", "Technology", "Execution", "Value"].map((w, i) => `<li${i === 4 ? ' class="v"' : ""}>${w}</li>`).join("")}</ol>
        </div>
      </figure>
    </div>
  </div></section>

  <section class="sec alt sel-sec" id="s-agenda"><div class="wrap">
    <div class="sel-head"><span class="eyebrow">Start with your agenda</span><h2 class="h2">What are you trying to achieve?</h2></div>
    <div class="needs">${AG_GROUPS.map((g, gi) => `<div class="need-col"><h3><span class="nc-ic">${DISC_IC[g[1]]}</span>${esc(g[0])}</h3><ul>${AGENDA_VOICE.map((v, i) => v.g !== gi ? "" : `<li><a href="#need.${i + 1}"><span>${esc(v.say)}</span>${AR}</a></li>`).join("")}</ul></div>`).join("")}</div>
  </div></section>

  <section class="as-band" id="s-assess"><div class="wrap as-band-in">
    <div><span class="eyebrow">Assessments</span><p class="as-band-t">Not sure where to start? Begin with a diagnostic</p></div>
    <ul>${Object.entries(ASSESS).map(([id, x]) => `<li><a href="#assessment.${id}"><span>${esc(x.name)}</span>${AR}</a></li>`).join("")}</ul>
  </div></section>



  <section class="sec" id="s-insights"><div class="wrap">
    <div class="sec-head row"><div style="display:grid;gap:16px"><span class="eyebrow">Insights</span><h2 class="h2">Our Latest Thinking</h2></div><a class="btn btn-s" href="#insights">All insights ${AR}</a></div>
    <div class="chips" style="margin:-16px 0 32px">${INSIGHT_CATS.map(c => `<a class="chip" href="#insights" data-insf="${c[0]}">${c[1]}</a>`).join("")}</div>
    <div class="ins-grid">${[0, 1, 3].map(insCard).join("")}</div>
    <form class="ins-sub" data-sub novalidate><p>Get our latest perspectives delivered to you</p><div class="ins-sub-f"><input type="email" required placeholder="Work email" aria-label="Work email"><button class="btn btn-p" type="submit">Subscribe ${AR}</button></div></form>
  </div></section>

  <section class="final ink final-home"><canvas data-waves='{"base":1.1,"from":0.5}' aria-hidden="true"></canvas>
    <div class="wrap final-in final-split"><div class="final-copy"><span class="eyebrow">Next step</span><h2>Where could we create the greatest impact together?</h2>
    <p class="lede">Whether the priority is enterprise transformation, AI at scale or stronger executive intelligence, we can help shape the path from ambition to execution.</p>
    <div class="hero-cta"><a class="btn btn-p" href="#contact">Start a Conversation ${AR}</a><a class="btn btn-s" href="#services">Explore Our Capabilities</a></div></div>
    <figure class="final-who"><img src="{{LEADER}}" alt="Muhammad Mohsin Tariq" width="88" height="88" loading="lazy">
      <figcaption><b>Muhammad Mohsin Tariq</b><span>Senior Director, Strategic Advisory</span><em>Blackstone eIT</em>
      <p>Speak directly with our Strategic Advisory team.</p>
      <a class="final-mail" href="mailto:muhammadm@blackstoneeit.com">muhammadm@blackstoneeit.com ${AR}</a>
      <small>Dubai, United Arab Emirates</small></figcaption></figure></div></section>`;
}

function pFamily(id) {
  const f = FAM[id]; if (!f) return pNotFound();
  const ctx = f.name;
  const rel = f.related;
  const ins = INSIGHTS.map((a, i) => [a, i]).filter(([a]) => f.insights.includes(a.cat)).slice(0, 3).map(([, i]) => i);
  return `
  ${phero({ crumbs: crumbs([["Strategic Advisory", "#home"], [f.name]]), eyebrow: `Strategic Advisory Discipline ${f.n}`, title: f.name, stmt: f.promise,
    meta: `<span>${esc(f.deckDesc)}</span><span>Typical entry diagnostic <b>${f.duration}</b></span>` })}
  ${subnav(f.name, [["challenges", "Challenges"], ["how", "How we help"], ["services", "Capabilities"], ["assessments", "Assessments"], ["related", "Related"], ["outcomes", "Outcomes"], ["insights", "Insights"]], ctx)}

  <section class="sec" id="challenges"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">The challenges we help solve</span><h2 class="h2">What leaders tell us</h2></div>
    <div class="sig"><ul class="sig-list">${f.signals.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
    <div class="quote"><span class="eyebrow">Typical conversation</span><p>“${esc(f.question)}”</p></div></div>
  </div></section>

  <section class="sec alt" id="how"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">How we help</span><h2 class="h2">Seven connected entry points</h2><p class="lede">Each engagement can start where your need is sharpest and connect across strategy, architecture, governance, capability and intelligence.</p></div>
    <div class="mods">${f.modules.map(m => `<div class="mod"><span class="l">${esc(m[0])}</span><strong>${esc(m[1])}</strong><p>${esc(m[2])}</p></div>`).join("")}<div class="mod dur"><span class="l">Typical entry diagnostic</span><strong>${f.duration}</strong><p>${esc(f.deckDesc)}</p></div></div>
    <div class="approach"><div class="h"><b>Our Approach</b><span>One Connected Advisory Model</span></div>${APPROACH.map((a, i) => `<div class="st"><i>${String(i + 1).padStart(2, "0")}</i><b>${a[0]}</b><span>${a[1]}</span></div>`).join("")}</div>
  </div></section>

  <section class="sec" id="services"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">Capability groupings &amp; individual capabilities</span><h2 class="h2">Core advisory capabilities</h2><p class="lede">Delivered independently where appropriate, or combined into broader advisory engagements.</p></div>
    <div class="groups">${f.groups.map(g => `<div class="grp" id="grp-${f.id}-${g.id}"><div class="grp-h"><i>${g.id.toUpperCase()}</i><h3>${esc(g.name)}</h3></div>${g.services.map(s => svcLink(s, "")).join("")}</div>`).join("")}</div>
  </div></section>

  <section class="sec alt" id="assessments"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">Diagnostic entry points</span><h2 class="h2">Start with an assessment</h2></div>
    <div class="assess" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">${f.assessments.map(a => assessCard(a, true)).join("")}</div>
  </div></section>

  <section class="sec" id="related"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">Related capabilities</span><h2 class="h2">Connected across the model</h2><p class="lede">Capabilities from our other disciplines that often combine with ${esc(f.name)}.</p></div>
    <div class="mini-grid">${rel.map(mini).join("")}</div>
  </div></section>

  <section class="sec alt" id="outcomes"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">Relevant client outcomes</span><h2 class="h2">From advisory to outcomes</h2></div>
    <div class="outs">${f.outcomes.map(outCard).join("")}</div>
  </div></section>

  <section class="sec" id="insights"><div class="wrap">
    <div class="sec-head row"><div style="display:grid;gap:16px"><span class="eyebrow">Related insights</span><h2 class="h2">Our latest thinking</h2></div><a class="btn btn-s" href="#insights">All insights ${AR}</a></div>
    <div class="ins-grid">${ins.map(insCard).join("")}</div>
  </div></section>

  ${talk(`Talk to our ${esc(f.name)} team`, `Tell us about your priorities. We will help you find the right place to start, from a focused diagnostic to a broader engagement.`, ctx)}`;
}

function pService(id) {
  const s = S[id]; if (!s) return pNotFound();
  const { fam: f, grp: g } = LOC[id];
  const i = ORDER.indexOf(id), prev = ORDER[i - 1], next = ORDER[i + 1];
  const start = s.assess || f.assessments[0];
  const d = s.draft;
  return `
  ${phero({ crumbs: crumbs([["Strategic Advisory", "#home"], [f.name, `#family.${f.id}`], [g.name, `#family.${f.id}`], [s.name]]), eyebrow: `${f.name} · ${g.name}`, title: s.name, stmt: s.hero, draft: d })}
  ${subnav(s.name, [["challenge", "The challenge"], ["how", "How we help"], ["gain", "What you gain"], ["related", "Related capabilities"]], s.name)}
  <div class="wrap svc-layout">
    <div class="svc-main">
      <section id="challenge"><span class="eyebrow">The challenge</span><h2 style="margin-top:12px">Why it matters</h2><p class="body"${draftAttr(d)}>${esc(s.challenge)}</p></section>
      <section id="how"><span class="eyebrow">How we help</span><h2 style="margin-top:12px">What we do</h2><ol class="how"${draftAttr(d)}>${s.how.map(h => `<li>${esc(h)}</li>`).join("")}</ol>${s.assess === "governance" ? `<div style="margin-top:36px">${fwBlock()}</div>` : ""}</section>
      <section id="gain"><span class="eyebrow">What you gain</span><h2 style="margin-top:12px">The outcome</h2><ul class="gain"${draftAttr(d)}>${s.gain.map(h => `<li>${esc(h)}</li>`).join("")}</ul></section>
      <section id="related"><span class="eyebrow">Related capabilities</span><h2 style="margin-top:12px">Often connected with</h2><div class="mini-grid">${s.related.map(mini).join("")}</div>
        <div class="pn">${prev ? `<a href="#service.${prev}"><span>← Previous</span><strong>${esc(S[prev].name)}</strong></a>` : "<span></span>"}${next ? `<a class="r" href="#service.${next}"><span>Next →</span><strong>${esc(S[next].name)}</strong></a>` : ""}</div>
      </section>
    </div>
    <aside class="side">
      <div class="side-card dark"><h4>Talk to Strategic Advisory</h4><p>Discuss ${esc(s.name)} with our advisory team.</p><a class="btn btn-p" href="#contact" data-ctx="${esc(s.name)}">Talk to Strategic Advisory ${AR}</a></div>
      <div class="side-card"><h4>Part of</h4><div class="path"><a href="#family.${f.id}">${esc(f.name)}</a><span>${esc(g.name)}</span></div></div>
      <div class="side-card"><h4>A good place to start</h4><a class="link" href="#assessment.${start}">${esc(ASSESS[start].name)} ${AR}</a></div>
      <div class="side-card sibs"><h4>More in ${esc(g.name)}</h4>${g.services.map(x => `<a class="${x === id ? "cur" : ""}" href="#service.${x}">${esc(S[x].name)}</a>`).join("")}</div>
    </aside>
  </div>
  ${talk("Talk to Strategic Advisory", `Tell us where you are today. We will shape a focused engagement around ${esc(s.name)}, on its own or as part of a broader programme.`, s.name)}`;
}

const DISC = {
  et: ["Transform the enterprise", "Align strategy, operating model, technology and execution around what must change.", ["Strategy","Operating Model","Technology","Execution"]],
  ai: ["Build intelligence into the enterprise", "Turn AI ambition into governed, scalable capability and measurable value.", ["AI","Data","Architecture","Governance","Adoption"]],
  ei: ["Strengthen how the enterprise decides", "Turn data, performance and foresight into faster, better-informed executive action.", ["Decisions","Performance","Foresight","Institutional Intelligence"]]
};
/* thin line icons — same family as the C6 marks; used only on discipline headers and agenda rows */
const IC = (d) => `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const DISC_IC = {
  et: IC('<path d="M16 4 28 10 16 16 4 10Z"/><path d="M4 16l12 6 12-6"/><path d="M4 22l12 6 12-6"/>'),
  ai: IC('<rect x="9" y="9" width="14" height="14" rx="2"/><rect x="13" y="13" width="6" height="6" rx="1"/><path d="M13 4v5M19 4v5M13 23v5M19 23v5M4 13h5M4 19h5M23 13h5M23 19h5"/>'),
  ei: IC('<path d="M5 22a11 11 0 1 1 22 0"/><path d="M16 22 22 13"/><circle cx="16" cy="22" r="1.6"/><path d="M8.5 15.5l1.6 1M23.5 15.5l-1.6 1M16 11v2"/>')
};
const AG_IC = [
  IC('<circle cx="16" cy="16" r="4"/><circle cx="6" cy="8" r="2.5"/><circle cx="26" cy="8" r="2.5"/><circle cx="16" cy="27" r="2.5"/><path d="M8.2 9.4l4.6 4.2M23.8 9.4l-4.6 4.2M16 20v4.5"/>'),
  IC('<circle cx="7" cy="24" r="2.5"/><path d="M9.5 24H15a4 4 0 0 0 0-8h-2a4 4 0 0 1 0-8h6"/><path d="M22 4v10"/><path d="M22 4h6l-2 2.5 2 2.5h-6"/>'),
  IC('<path d="M26 13A10 10 0 0 0 8 9"/><path d="M8 4v5h5"/><path d="M6 19a10 10 0 0 0 18 4"/><path d="M24 28v-5h-5"/>'),
  IC('<path d="M6 9h12M24 9h2M6 16h4M16 16h10M6 23h14M26 23h0"/><circle cx="21" cy="9" r="2.5"/><circle cx="13" cy="16" r="2.5"/><circle cx="23" cy="23" r="2.5"/>'),
  IC('<rect x="5" y="11" width="14" height="14" rx="2"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M19 11 27 3M21 3h6v6"/>'),
  IC('<circle cx="16" cy="16" r="12"/><path d="M20.5 11.5 18 18l-6.5 2.5L14 14Z"/><circle cx="16" cy="16" r="1"/>'),
  IC('<path d="M4 12 16 5l12 7"/><path d="M6 12h20"/><path d="M8 15v9M13 15v9M19 15v9M24 15v9"/><path d="M4 27h24"/>')
];
const IND_IC = {
  government: IC('<path d="M5 27h22"/><path d="M7 27V14h18v13"/><path d="M5 14h22"/><path d="M11 18v5M16 18v5M21 18v5"/><path d="M16 14V5"/><path d="M16 5h6l-1.5 2 1.5 2h-6"/>'),
  energy: IC('<path d="M18 3 7 18h8l-2 11 12-16h-8z"/>'),
  transport: IC('<circle cx="7" cy="8" r="3"/><circle cx="25" cy="24" r="3"/><path d="M10 8h9a4 4 0 0 1 0 8h-6a4 4 0 0 0 0 8h9"/>'),
  healthcare: IC('<path d="M3 17h6l3-7 4 14 3-9 2 2h8"/>'),
  food: IC('<path d="M16 29V9"/><path d="M16 13c-4 0-6-3-6-6 4 0 6 3 6 6zM16 13c4 0 6-3 6-6-4 0-6 3-6 6zM16 20c-4 0-6-3-6-6 4 0 6 3 6 6zM16 20c4 0 6-3 6-6-4 0-6 3-6 6z"/>'),
  tourism: IC('<path d="M16 28V12"/><path d="M16 12c-2-4-7-5-10-3M16 12c2-4 7-5 10-3M16 12c-4-1-8 1-9 5M16 12c4-1 8 1 9 5M16 12c0-4-2-7-5-8"/><path d="M8 28h16"/>'),
  realestate: IC('<path d="M4 28h24"/><path d="M7 28V12l7-4v20"/><path d="M14 28V5l11 5v18"/><path d="M18 14h3M18 18h3M18 22h3M10 16h1M10 20h1"/>'),
  technology: IC('<path d="M16 14v14"/><path d="M11 28l5-14 5 14"/><circle cx="16" cy="11" r="2"/><path d="M11 6a7 7 0 0 0 0 10M21 6a7 7 0 0 1 0 10"/>'),
  industrial: IC('<path d="M4 28V16l7 4v-4l7 4v-4l7 4V6h3v22z"/><path d="M4 28h24"/>'),
  retail: IC('<path d="M7 11h18l-1.5 17h-15z"/><path d="M12 14V9a4 4 0 0 1 8 0v5"/>'),
  education: IC('<path d="M2 12 16 6l14 6-14 6z"/><path d="M8 15v6c0 2 4 4 8 4s8-2 8-4v-6"/><path d="M28 13v8"/>'),
  financial: IC('<ellipse cx="16" cy="8" rx="9" ry="3"/><path d="M7 8v5c0 1.7 4 3 9 3s9-1.3 9-3V8"/><path d="M7 13v5c0 1.7 4 3 9 3s9-1.3 9-3v-5"/><path d="M7 18v5c0 1.7 4 3 9 3s9-1.3 9-3v-5"/>')
};
function capDisciplines() {
  const gi = { et: 0, ai: 1, ei: 2 }, feat = { et: 3, ai: 0, ei: 1 };
  return `<nav class="cap-jump" aria-label="Jump to discipline">${FAMILIES.map(f => `<button type="button" data-capjump="cap-${f.id}"><span class="cj-ic">${DISC_IC[f.id]}</span>${esc(f.name)}</button>`).join("")}</nav>
  ${FAMILIES.map(f => { const d = DISC[f.id], qs = AGENDA_VOICE.map((v, i) => [v, i]).filter(([v]) => v.g === gi[f.id]).slice(0, 2), k = feat[f.id], ins = INSIGHTS[k], ph = INS_PHOTO[k];
    return `<section class="cap-d" id="cap-${f.id}">
    <header class="cap-dh"><div class="cap-nw"><span class="cap-ic">${DISC_IC[f.id]}</span></div><div><span class="eyebrow">${esc(d[0])}</span><h2>${esc(f.name)}</h2><p>${esc(d[1])}</p><span class="sys-path">${d[2].join('<em>→</em>')}</span></div><a class="link" href="#family.${f.id}">Explore ${esc(f.name)} ${AR}</a></header>
    <div class="cap-body">
      <div class="cap-main">
        <div class="cap-qs"><h3>You may be facing</h3><ul>${qs.map(([v, i]) => `<li><a href="#need.${i + 1}">“${esc(v.say)}”</a></li>`).join("")}</ul></div>
        <h3 class="cap-how">How we help</h3>
        <div class="cap-groups" style="--g:${f.groups.length}">${f.groups.map(g => `<div class="cap-g"><h3>${esc(g.name)}</h3><ul>${g.services.map(id => `<li><a href="#service.${id}"><b>${esc(S[id].name)}</b><span>${esc(S[id].hero || "")}</span></a></li>`).join("")}</ul></div>`).join("")}</div>
      </div>
    </div>
  </section>`; }).join("")}
  <div class="cap-close"><p>Where does your transformation need to move next?</p><a class="btn btn-p" href="#contact">Start a conversation ${AR}</a></div>`;
}
function pServices() {
  return `
  <section class="phero ink cap-hero"><canvas data-waves='{"base":0.92,"from":0.5,"n":30}' aria-hidden="true"></canvas>
    <div class="wrap">${crumbs([["Strategic Advisory", "#home"], ["Capabilities"]])}
    <div class="cap-hero-in">
      <div class="cap-hero-copy"><span class="eyebrow">Capabilities</span><h1>The capabilities to move from ambition to impact</h1><p class="stmt">Three connected disciplines — brought together around the transformation outcomes you need to achieve</p></div>
      <div class="cap-model" role="img" aria-label="Three connected capability areas — Enterprise Transformation, AI Transformation and Enablement, and Executive Intelligence — converging on Enduring Value.">
        <svg class="cm-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="cm-arc" d="M50 12A37 41 0 0 1 79 80"/><path class="cm-arc" d="M79 80A37 41 0 0 1 21 80"/><path class="cm-arc" d="M21 80A37 41 0 0 1 50 12"/><path class="cm-sp" style="--k:0" d="M50 54L50 12"/><path class="cm-sp" style="--k:1" d="M50 54L21 80"/><path class="cm-sp" style="--k:2" d="M50 54L79 80"/></svg>
        <div class="cm-core" aria-hidden="true"><span>Enduring<br>Value</span></div>
        <span class="cm-n" style="left:50%;top:12%;--k:0"><i></i></span><span class="cm-n" style="left:21%;top:80%;--k:1"><i></i></span><span class="cm-n" style="left:79%;top:80%;--k:2"><i></i></span><a class="cm-l cm-t" href="#family.et" style="left:50%;top:12%;--k:0"><em>01</em><b>Enterprise Transformation</b></a><a class="cm-l cm-b" href="#family.ai" style="left:21%;top:80%;--k:1"><em>02</em><b>AI Transformation &amp; Enablement</b></a><a class="cm-l cm-b" href="#family.ei" style="left:79%;top:80%;--k:2"><em>03</em><b>Executive Intelligence</b></a>
      </div>
    </div></div>
  </section>
  <section class="sec tight cap-listing"><div class="wrap">
    <div class="cap-intro"><span class="eyebrow">Start with your priority</span><p>Explore the challenges you need to address or the capabilities required to deliver them</p></div>
    <div class="svc-tools cap-tools">
      <div class="exp-by"><span class="seg-lbl" id="exp-by">Explore by</span><div class="seg" role="group" aria-labelledby="exp-by">${[["agenda", "Agenda"], ["family", "Discipline"]].map(([v, l]) => `<button aria-pressed="${SV.view === v}" data-svview="${v}">${l}</button>`).join("")}</div></div>
      <label class="search search-sm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="svc-q" type="search" placeholder="Search capabilities" value="${esc(SV.q)}" aria-label="Search capabilities and assessments" autocomplete="off"></label>
    </div>
    <div id="svc-out">${servicesOut()}</div>
  </div></section>
  <section class="sec alt"><div class="wrap">
    <div class="sec-head row"><div style="display:grid;gap:16px"><span class="eyebrow">Not sure where to start?</span><h2 class="h2">Assess where you are first</h2></div><a class="btn btn-s" href="#assessments">Explore Assessments ${AR}</a></div>
    <div class="assess">${Object.keys(ASSESS).map(id => assessCard(id)).join("")}</div>
  </div></section>`;
}
/* executive question per agenda, Capabilities page only */
const AG_CQ = [
  AGENDA[0].question,
  "How do we turn strategic priorities into coordinated execution, measurable outcomes and lasting enterprise capability?",
  AGENDA[2].question,
  AGENDA[3].question,
  "How do we move AI beyond scattered pilots to governed, enterprise-wide value we can measure?",
  "How do we give leadership timely, trusted intelligence to make faster and better-governed decisions?",
  AGENDA[6].question
];
function servicesOut() {
  if (SV.q.trim()) {
    const r = search(SV.q);
    if (!r.length) return `<div class="empty">No matches for “${esc(SV.q)}”. Try a broader term, browse by discipline below, or <a class="link" href="#contact" data-ctx="${esc(SV.q)}">ask our advisory team ${AR}</a></div>`;
    return `<p style="font-size:.86rem;color:var(--fg-3);margin-bottom:12px">${r.length} result${r.length > 1 ? "s" : ""}</p><div class="res">${r.map(x => `<a href="${x.href}"><strong>${hi(x.name, SV.q)}</strong><small>${esc(x.sub)}</small><span class="tag${x.type === "Assessment" ? " as" : ""}">${x.type}</span></a>`).join("")}</div>`;
  }
  if (SV.view === "agenda") {
    return `<div class="by-ag">${AGENDA.map((a, i) => `<details${i === 0 ? " open" : ""}><summary><span class="ag-ic">${AG_IC[i] || ""}</span><span class="ag-hd"><b>${esc(a.title)}</b><span class="ag-q">${esc(AG_CQ[i])}</span></span></summary><div class="inner"><span class="ag-rl">Relevant capabilities</span><div class="ag-chips">${a.services.map(s => `<a class="chip" href="#service.${s}">${esc(S[s].name)}</a>`).join("")}</div><a class="link ag-go" href="#agenda.${i + 1}">Explore this agenda ${AR}</a></div></details>`).join("")}</div>`;
  }
  if (SV.view === "az") {
    const ids = Object.keys(S).sort((a, b) => S[a].name.localeCompare(S[b].name));
    const by = {};
    ids.forEach(id => (by[S[id].name[0]] ||= []).push(id));
    return `<div class="az">${Object.entries(by).map(([L, xs]) => `<div class="az-l"><h4>${L}</h4>${xs.map(id => `<a href="#service.${id}">${esc(S[id].name)}<small>${esc(LOC[id].fam.name)}</small></a>`).join("")}</div>`).join("")}</div>`;
  }
  return capDisciplines();
}

function pAssessments() {
  return `
  <section class="wrap">${crumbs([["Strategic Advisory", "#home"], ["Assessments & Accelerators"]])}
    <div class="lphero"><span class="eyebrow">Assessments &amp; accelerators</span><h1>Assess Where You Are. See Where to Go Next</h1><p class="lede">Focused diagnostics provide a rapid, evidence-based view of current maturity, critical gaps and priority actions — creating a practical starting point for transformation.</p></div>
  </section>
  <section class="sec tight" style="padding-top:0"><div class="wrap"><div class="assess" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">${Object.keys(ASSESS).map(id => assessCard(id, true)).join("")}</div></div></section>
  <section class="sec alt"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">How assessments work</span><h2 class="h2">Evidence first, then priorities</h2></div>
    <ol class="steps3" data-draft><li><b>Scope and evidence</b><p>Agree the scope and ambition, then gather evidence through documents, data and leadership interviews.</p></li><li><b>Maturity and gaps</b><p>Assess current maturity against a fit-for-purpose model and compare it with your ambition.</p></li><li><b>Priorities and roadmap</b><p>Agree priority actions and a practical roadmap, ready to move into a broader engagement where needed.</p></li></ol>
  </div></section>
  <section class="sec"><div class="wrap">${fwBlock()}</div></section>
  ${talk("Request an assessment", "Tell us what you want to understand. We will recommend the right diagnostic and scope it to your context.", "Assessments")}`;
}
function fwBlock() {
  return `<div class="fw"><div><span class="eyebrow">Fit for your environment</span><h3 style="margin-top:10px">We sell the outcome, not the framework</h3></div>
  <div data-draft><p>Every assessment uses a maturity model selected and tailored to your sector, regulatory context and ambition. Recognised industry frameworks inform the work where they fit. They are tools within the engagement, not the engagement itself.</p>
  <p class="ex-fw">Frameworks we commonly draw on include COBIT, ITIL, TOGAF, ISO management standards, agile and scaled delivery frameworks, and relevant national and sector standards.</p></div></div>`;
}

function pAssessment(id) {
  const a = ASSESS[id]; if (!a) return pNotFound();
  const f = FAM[a.fam];
  return `
  ${phero({ crumbs: crumbs([["Strategic Advisory", "#home"], ["Assessments", "#assessments"], [a.name]]), eyebrow: `Assessment · ${f.name}`, title: a.name, stmt: a.line })}
  ${subnav(a.name, [["dims", "What we assess"], ["receive", "What you receive"], ["fw", "Frameworks"], ["leads", "Where it leads"]], a.name)}
  <section class="sec" id="dims"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">What we assess</span><h2 class="h2">Assessment dimensions</h2></div>
    <ul class="dims" data-draft>${a.dims.map((d, i) => `<li><div class="scale" aria-hidden="true">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= 1 + (i % 3) ? "on" : ""}" style="${k <= 1 + (i % 3) ? "background:var(--accent)" : ""}"></i>`).join("")}</div><b>${esc(d)}</b></li>`).join("")}</ul>
  </div></section>
  <section class="sec alt" id="receive"><div class="wrap two">
    <div><span class="eyebrow">What you receive</span><h2 class="h2" style="margin:14px 0 24px">A practical starting point</h2><ul class="ticks" data-draft>${a.receive.map(r => `<li>${esc(r)}</li>`).join("")}</ul></div>
    <div><span class="eyebrow">How it works</span><h2 class="h2" style="margin:14px 0 24px">Three steps</h2><ol class="steps3" style="grid-template-columns:1fr" data-draft><li><b>Scope and evidence</b><p>Agree scope and ambition, then gather evidence through documents, data and leadership interviews.</p></li><li><b>Maturity and gaps</b><p>Assess maturity against a fit-for-purpose model and compare it with your ambition.</p></li><li><b>Priorities and roadmap</b><p>Agree priority actions and a roadmap leadership can act on.</p></li></ol></div>
  </div></section>
  <section class="sec" id="fw"><div class="wrap">${a.frameworks ? fwBlock() : `<div class="fw"><div><span class="eyebrow">Fit for your environment</span><h3 style="margin-top:10px">A model that suits your context</h3></div><p data-draft>We assess against a maturity model selected and tailored to your sector, regulatory context and ambition, so results lead directly to priorities that make sense for you.</p></div>`}</div></section>
  <section class="sec alt" id="leads"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">Where it leads</span><h2 class="h2">From diagnosis to action</h2><p class="lede">Assessment findings typically lead into these advisory capabilities.</p></div>
    <div class="mini-grid">${[a.service, ...a.leads.filter(x => x !== a.service)].slice(0, 4).map(mini).join("")}</div>
    <p style="margin-top:28px"><a class="link" href="#family.${f.id}">Explore ${esc(f.name)} ${AR}</a></p>
  </div></section>
  ${talk(`Request the ${esc(a.name)}`, "Tell us about your context and what you want to understand. We will scope the assessment with you.", a.name)}`;
}

function pAgenda(n) {
  const a = AGENDA[n - 1]; if (!a) return pNotFound();
  const fam = FAM[a.fam];
  let signals, question, dS = false;
  if (a.from) { signals = a.title === "Translate Strategy into Execution" ? [0, 1, 3].map(i => fam.signals[i]) : FAM[a.from].signals; question = FAM[a.from].question; }
  else { signals = a.draftSignals; question = a.question; dS = true; }
  const byFam = FAMILIES.map(f => [f, a.services.filter(s => LOC[s].fam.id === f.id)]).filter(x => x[1].length);
  let start;
  if (a.start.type === "assess") { const s = ASSESS[a.start.id]; start = { k: "Diagnostic entry point", t: s.name, p: s.line, href: `#assessment.${a.start.id}`, l: "View assessment" }; }
  else { const m = FAM[a.start.fam].modules[a.start.idx]; start = { k: `Entry point · ${FAM[a.start.fam].name}`, t: m[1], p: m[2], href: `#family.${a.start.fam}`, l: `Explore ${FAM[a.start.fam].name}` }; }
  return `
  ${phero({ crumbs: crumbs([["Strategic Advisory", "#home"], ["What are you trying to achieve?", "#home.agenda"], [a.title]]), eyebrow: `Client agenda ${a.n}`, title: a.title, stmt: a.line })}
  <section class="sec"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">What we often hear</span><h2 class="h2">Does this sound familiar?</h2></div>
    <div class="sig"><ul class="sig-list"${draftAttr(dS)}>${signals.map(s => `<li>${esc(s)}</li>`).join("")}</ul><div class="quote"${draftAttr(dS)}><span class="eyebrow">The question to answer</span><p>“${esc(question)}”</p></div></div>
  </div></section>
  <section class="sec alt"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">Where to start</span><h2 class="h2">A practical first step</h2></div>
    <div class="start"><div><span class="eyebrow">${esc(start.k)}</span><h3>${esc(start.t)}</h3><p>${esc(start.p)}</p></div><a class="btn btn-p" href="${start.href}">${start.l} ${AR}</a></div>
  </div></section>
  <section class="sec"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">Capabilities that help</span><h2 class="h2">How Blackstone can help</h2><p class="lede">${byFam.length > 1 ? "This agenda draws on more than one discipline. Our capabilities are designed to combine." : "Core capabilities for this agenda."}</p></div>
    <div class="fam-split">${byFam.map(([f, xs]) => `<div><h4><span class="fs-ic">${DISC_IC[f.id]}</span>${esc(f.name)} <a href="#family.${f.id}">Explore →</a></h4><div class="mini-grid">${xs.map(id => `<a class="mini" href="#service.${id}"><span class="k">${esc(LOC[id].grp.name)}</span><strong>${esc(S[id].name)}</strong><p${draftAttr(S[id].draft)}>${esc(S[id].hero)}</p></a>`).join("")}</div></div>`).join("")}</div>
  </div></section>
  ${talk("Talk to our advisory team", `Tell us what you are trying to achieve. We will help you shape the path from ambition to execution.`, a.title)}`;
}

/* ============ FLAGSHIP: THE AGENTIC ENTERPRISE (agenda 01) ============ */
const AE_STAGES = [
  ["Assist", "AI drafts, summarises and retrieves information for a person", "The person, at every step", "Quality review of what AI produces"],
  ["Recommend", "AI analyses options and proposes a course of action", "The person, informed by the recommendation", "Evidence and explanation behind every recommendation"],
  ["Orchestrate", "AI coordinates tasks across systems and teams within a defined workflow", "The person sets the goal and approves key checkpoints", "Defined checkpoints, escalation rules and a full audit trail"],
  ["Act", "AI executes actions within authority delegated in advance", "Authority is delegated within clear boundaries", "Decision rights, limits, live monitoring and the ability to intervene"]
];
const AE_REDESIGN = [
  ["Work and workflows", "Redesign processes so agents and people each do what they do best", ["ai-operating-model", "ai-use-cases", "tom"]],
  ["Decision rights", "Define which decisions agents may take, which they recommend and which they escalate", ["decision-governance", "governance-framework"]],
  ["Controls and human oversight", "Build governance, monitoring and the ability to intervene into every agentic workflow", ["ai-governance"]],
  ["Data and architecture", "Give agents trusted data, integrated systems and secure, governed access", ["data-ai-architecture", "data-strategy"]],
  ["People and accountability", "Prepare people to direct, supervise and work alongside agents — and keep accountability with them", ["ai-adoption", "capability-change"]]
];
const AE_AGENTS = [
  ["Scoping Agent", "Identifies the regulations, services and entities the proposal touches"],
  ["Impact Agent", "Assesses the effect on each item and flags conflicts"],
  ["Coordination Agent", "Drafts the consultation and routes it to accountable owners"]
];
const AE_ITEMS = [
  ["Business Licensing Regulation", "Regulation", "Governs the licence being digitised", null],
  ["Fees and Charges Framework", "Regulation", "Sets the fees the new service would collect", ["High", "The new service collects fees the current framework does not cover", "The fee schedule lists services by name and the new service is not on it"]],
  ["Cross-Entity Data Sharing Policy", "Policy", "Applies to applicant data exchanged between entities", ["High", "Applicant data would flow to two other entities, so a data-sharing agreement is required", "The policy requires an agreement for every cross-entity exchange"]],
  ["Commercial Registration Service", "Service · Economic development entity", "Holds the same applicant data", ["Medium", "Applicants may enter the same details twice unless the two records are linked", "Inferred from overlapping data fields; not yet confirmed with the owner"]],
  ["Municipal Permits Service", "Service · Municipality", "Issues permits that depend on the licence", ["Medium", "The permit workflow assumes a paper licence and needs an integration change", "Based on the published service description; integration details unconfirmed"]],
  ["Digital Service Standards", "Policy", "Apply to every new digital service", null]
];
let AED = { s: 0, keep: AE_ITEMS.map(() => true), t: [] };
function aeClear() { AED.t.forEach(clearTimeout); AED.t = []; }
function aeAgent(i, st) {
  const res = i === 0 ? `Proposed ${AE_ITEMS.length} items for review` : i === 1 ? (() => { const f = AE_ITEMS.filter((x, k) => AED.keep[k] && x[3]); const h = f.filter(x => x[3][0] === "High").length; return `${h} high-impact and ${f.length - h} medium findings`; })() : aeConsult();
  return `<li class="aed-ag aed-${st}"><span class="aed-st" aria-hidden="true"></span><div><b>${AE_AGENTS[i][0]}</b><span>${AE_AGENTS[i][1]}</span>${st === "done" ? `<em>${res}</em>` : st === "run" ? `<em class="aed-wk">Working…</em>` : ""}</div></li>`;
}
function aeEntities() { return [3, 4].filter(k => AED.keep[k]).length + (AED.keep[2] || AED.keep[5] ? 1 : 0); }
function aeConsult() { const n = aeEntities(); return n ? `Consultation drafted for ${n} entit${n === 1 ? "y" : "ies"}` : "No other entities need consulting"; }
function aeDemoBody() {
  const s = AED.s, st = i => s === 0 ? "wait" : i === 0 ? (s === 1 ? "run" : "done") : i === 1 ? (s < 3 ? "wait" : s === 3 ? "run" : "done") : (s < 4 ? "wait" : s === 4 ? "run" : "done");
  const agents = `<ol class="aed-agents">${AE_AGENTS.map((_, i) => aeAgent(i, st(i))).join("")}</ol>`;
  let panel = "";
  if (s === 0) panel = `<div class="aed-panel aed-idle"><p>Three agents will work through the proposal. They will stop for your decision before anything moves forward.</p><button class="btn btn-p" type="button" data-aed="run">Run the agents ${AR}</button></div>`;
  else if (s === 1 || s === 3 || s === 4) panel = `<div class="aed-panel aed-busy"><span class="aed-bar"><i></i></span><p>${s === 1 ? "Scoping the proposal…" : s === 3 ? "Assessing impact on the items you confirmed…" : "Drafting the consultation…"}</p></div>`;
  else if (s === 2) { const n = AED.keep.filter(Boolean).length;
    panel = `<div class="aed-panel aed-check"><span class="aed-k">Your decision · Confirm scope</span><p>The Scoping Agent proposes these items. Remove anything that should not be assessed, then let the agents continue.</p>
    <ul class="aed-items">${AE_ITEMS.map((x, k) => `<li><label><input type="checkbox" data-aedk="${k}"${AED.keep[k] ? " checked" : ""}><span><b>${esc(x[0])}</b><small>${esc(x[1])} · ${esc(x[2])}</small></span></label></li>`).join("")}</ul>
    <div class="aed-act"><button class="btn btn-p" type="button" data-aed="confirm"${n ? "" : " disabled"}>Confirm ${n} item${n === 1 ? "" : "s"} &amp; continue ${AR}</button><span>${AE_ITEMS.length - n ? `${AE_ITEMS.length - n} removed by you` : "Nothing removed"}</span></div></div>`; }
  else { const f = AE_ITEMS.map((x, k) => [x, k]).filter(([x, k]) => AED.keep[k] && x[3]), h = f.filter(([x]) => x[3][0] === "High");
    panel = `<div class="aed-panel aed-res"><span class="aed-k">What the agents concluded</span>
    <p class="aed-sum">${h.length ? `${h.length} high-impact issue${h.length > 1 ? "s" : ""} need${h.length > 1 ? "" : "s"} resolving before launch${h.length ? ": " + h.map(([x]) => x[0] === "Fees and Charges Framework" ? "fee coverage" : "a data-sharing agreement").join(" and ") : ""}.` : "No high-impact issues in the items you confirmed."} ${aeConsult()}.</p>
    <ul class="aed-find">${f.map(([x]) => `<li><span class="aed-c aed-c-${x[3][0].toLowerCase()}">${x[3][0]} confidence</span><b>${esc(x[0])}</b><p>${esc(x[3][1])}</p><small>Why: ${esc(x[3][2])}</small></li>`).join("") || `<li><p>No conflicts found in the items you confirmed.</p></li>`}</ul>
    ${s === 5 ? `<div class="aed-act"><span class="aed-k">Your decision</span><button class="btn btn-p" type="button" data-aed="approve">Approve &amp; send for consultation ${AR}</button><button class="btn btn-s" type="button" data-aed="back">Change scope</button></div>`
      : `<div class="aed-fin"><b>Approved by you.</b> The consultation goes to accountable owners, with a full record of what each agent did and what you changed. <button class="link" type="button" data-aed="reset">Run again</button></div>`}</div>`; }
  return `<div class="aed-grid">${agents}${panel}</div>`;
}
function aeRun(from) {
  aeClear(); const v = $("#aed-body"); if (!v) return;
  const step = (s, ms, next) => AED.t.push(setTimeout(() => { if (!$("#aed-body")) return; AED.s = s; $("#aed-body").innerHTML = aeDemoBody(); next && next(); }, ms));
  const d = reduce ? 0 : 1;
  if (from === "run") { AED.s = 1; AED.keep = AE_ITEMS.map(() => true); v.innerHTML = aeDemoBody(); step(2, 1800 * d); }
  if (from === "confirm") { AED.s = 3; v.innerHTML = aeDemoBody(); step(4, 1900 * d, () => step(5, 1700 * d)); }
}
function pAgentic() {
  const a = AGENDA[0];
  return `
  <section class="phero ink ae-hero"><canvas data-waves='{"base":0.8,"from":0.45,"n":30}' aria-hidden="true"></canvas>
    <div class="wrap">${crumbs([["Strategic Advisory", "#home"], ["What are you trying to achieve?", "#home.agenda"], [a.title]])}
    <div class="ae-hero-in">
      <div class="ae-hero-copy"><span class="eyebrow">The Agentic Enterprise</span>
        <h1><span class="hl">When AI Can Act,</span> <span class="hl">the Enterprise</span> <span class="hl"><em>Must Evolve</em></span></h1>
        <p class="stmt">Agentic AI is moving from assisting people to acting across workflows, decisions and systems. Capturing its value requires redesigning work, decision rights, architecture and governance — with people firmly in control</p>
        <div class="hero-cta"><button class="btn btn-p" type="button" data-scroll="ae-demo">See it in action ${AR}</button><a class="btn btn-s" href="#contact" data-ctx="Agentic AI">Start a Conversation</a></div>
      </div>
      <div class="ae-model" role="img" aria-label="Human intent sets outcomes and boundaries; agentic orchestration reasons, coordinates and executes; intelligent action decides, acts and escalates to people when required — all within governance, decision rights, human oversight and accountability">
        <div class="ae-m-in" aria-hidden="true">
          <span class="ae-spine"></span><span class="ae-esc"></span><i class="ae-pulse"></i>
          ${[["Human intent", "Set outcomes & boundaries"], ["Agentic orchestration", "Reason · coordinate · execute"], ["Intelligent action", "Decide · act · escalate"]].map((x, i) => `<div class="ae-n ae-n${i}" style="--k:${i}"><span class="ae-dot">${i === 1 ? `<span class="ae-orbit"><b></b><b></b><b></b><b></b></span>` : ""}</span><p><b>${x[0]}</b><span>${x[1]}</span></p></div>`).join("")}
          <span class="ae-esct">Escalate to people</span>
        </div>
        <p class="ae-gov">Governance · Decision rights · Human oversight · Accountability</p>
      </div>
    </div></div></section>
  <section class="sec ae-chal"><div class="wrap ae-chal-in">
    <div><span class="eyebrow">The challenge</span><h2 class="h2">Agents are arriving faster than enterprises are redesigned for them</h2>
      <ul class="ae-sig">${a.draftSignals.map(s => `<li>${esc(s)}</li>`).join("")}</ul></div>
    <div class="ae-q"><span class="eyebrow">The question to answer</span><p>${esc(a.question)}</p></div>
  </div></section>
  <section class="sec alt ae-shift"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">The shift</span><h2 class="h2">From AI that assists to AI that acts</h2><p class="lede">Each step up in autonomy changes who decides and what oversight is required. The goal is appropriate autonomy, not maximum autonomy</p></div>
    <div class="ae-steps" role="tablist" aria-label="Levels of autonomy">${AE_STAGES.map((x, i) => `<button type="button" role="tab" class="ae-step" aria-selected="${i === 2}" data-aestage="${i}"><span class="ae-sd"></span><b>${x[0]}</b></button>`).join("")}<span class="ae-steps-l" aria-hidden="true"><small>Increasing autonomy</small></span></div>
    <div class="ae-stage" id="ae-stage" aria-live="polite">${aeStage(2)}</div>
  </div></section>
  <section class="sec ink ae-demo" id="ae-demo"><div class="wrap">
    <div class="ae-demo-head"><div><span class="eyebrow">See it in action</span><h2 class="h2">An agentic workflow, with people in control</h2></div>
      <p class="ae-scn"><span>Illustrative example</span>A ministry proposes a new digital licensing service for small businesses. It touches regulations and services owned by other government entities</p></div>
    <div id="aed-body">${aeDemoBody()}</div>
    <p class="ae-rule">Agents recommend. People decide</p>
  </div></section>
  <section class="sec ae-re"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">What must change</span><h2 class="h2">What the enterprise must redesign</h2><p class="lede">Deploying agents is the easy part. Value comes from redesigning the enterprise around them</p></div>
    <div class="ae-re-list">${AE_REDESIGN.map(x => `<div class="ae-re-row"><div><h3>${esc(x[0])}</h3><p>${esc(x[1])}</p></div><div class="ae-re-caps"><span>How we help</span>${x[2].filter(id => S[id]).map(id => `<a href="#service.${id}">${esc(S[id].name)} <i>→</i></a>`).join("")}</div></div>`).join("")}</div>
  </div></section>
  <section class="sec alt ae-start"><div class="wrap">
    <div class="ae-start-in">
      <div><span class="eyebrow">Where to start</span><h2 class="h2">Know where you stand before agents act</h2><p class="lede">Assess the data, platforms, people and governance that agentic AI depends on</p></div>
      ${assessCard("ai")}
    </div>
    <div class="ae-persp"><div class="sec-head row"><div style="display:grid;gap:16px"><span class="eyebrow">Our perspective</span><h2 class="h2">Read our thinking</h2></div><a class="btn btn-s" href="#insights">All insights ${AR}</a></div>
      <div class="ins-grid">${[5, 6, 7].map(insCard).join("")}</div></div>
  </div></section>
  ${talk("Design your agentic enterprise", "Tell us where AI is starting to act in your organisation. We will help you redesign work, decision rights and governance so it creates value safely.", "Agentic AI")}`;
}
function aeStage(i) {
  const x = AE_STAGES[i];
  return `<div class="ae-stage-in" style="--lv:${i}"><div><span class="ae-sk">Stage ${i + 1} of 4</span><h3>${x[0]}</h3></div><dl><div><dt>What AI does</dt><dd>${esc(x[1])}</dd></div><div><dt>Who decides</dt><dd>${esc(x[2])}</dd></div><div><dt>Oversight required</dt><dd>${esc(x[3])}</dd></div></dl></div>`;
}
document.addEventListener("click", e => {
  const s = e.target.closest && e.target.closest("[data-aestage]");
  if (s) { const i = +s.dataset.aestage; $$("[data-aestage]").forEach(b => b.setAttribute("aria-selected", b === s)); $("#ae-stage").innerHTML = aeStage(i); return; }
  const d = e.target.closest && e.target.closest("[data-aed]"); if (!d) return;
  const k = d.dataset.aed;
  if (k === "run" || k === "confirm") aeRun(k);
  else if (k === "approve") { AED.s = 6; $("#aed-body").innerHTML = aeDemoBody(); }
  else if (k === "back") { aeClear(); AED.s = 2; $("#aed-body").innerHTML = aeDemoBody(); }
  else if (k === "reset") { aeClear(); AED.s = 0; AED.keep = AE_ITEMS.map(() => true); $("#aed-body").innerHTML = aeDemoBody(); }
});
document.addEventListener("change", e => { const c = e.target.closest && e.target.closest("[data-aedk]"); if (!c) return; AED.keep[+c.dataset.aedk] = c.checked; const y = scrollY; $("#aed-body").innerHTML = aeDemoBody(); scrollTo(0, y); const n = $(`[data-aedk="${c.dataset.aedk}"]`); n && n.focus(); });

/* ============ STORY 01 PAGE: FROM AMBITION TO ENDURING VALUE ============ */
const EV_STALL = [
  ["Strategy without a path", "Priorities are clear, but not translated into coordinated programmes, ownership and measures"],
  ["Operating models that no longer fit", "Structures, processes and decision rights were built for yesterday’s agenda"],
  ["Technology that does not connect", "Investment adds platforms faster than it builds capability"],
  ["Change that does not last", "Gains fade once programmes close and partners leave"]
];
const EV_STAGES = [
  ["Shape", "Set direction and priorities", "Where should we focus, and what does success look like?", "Clarify ambition, set priorities and define measurable outcomes", "An agreed strategic agenda with clear priorities and ownership", ["strategy-development", "strategy-to-execution", "ai-strategy"]],
  ["Design", "Define what must change", "What must change in how we are organised and run?", "Design the operating model, processes, governance and decision rights", "A target operating model the organisation can implement", ["tom", "governance-framework", "decision-governance"]],
  ["Architect", "Connect capability and technology", "How do capability, data and technology fit together?", "Design the enterprise, data and AI architecture that enables the operating model", "A connected architecture and an investable roadmap", ["ea", "data-ai-architecture", "digital-rationalisation"]],
  ["Enable", "Empower the organization to act", "How do we equip the organisation to deliver?", "Build skills and adoption, and give leaders the performance and decision intelligence they need", "People, performance and intelligence aligned to the agenda", ["capability-change", "kpi", "decision-intelligence"]],
  ["Institutionalize", "Make the capability last", "How do we make the capability outlast the programme?", "Embed governance, learning and institutional intelligence so improvement continues", "Capability that keeps improving after the programme ends", ["institutional-intelligence", "pmo", "ai-adoption"]]
];
const EV_VALUE = [
  ["aim", "Sharper priorities", "Fewer, clearer priorities with accountable owners"],
  ["clock", "Faster decisions", "Leaders act on timely, trusted intelligence"],
  ["coins", "Focused investments", "Spend directed to what moves the agenda"],
  ["rocket", "Accelerated execution", "Coordinated delivery across the enterprise"],
  ["people", "Adaptive capability", "An organisation that keeps learning and improving"]
];
function evStage(i) {
  const x = EV_STAGES[i];
  return `<div class="ev-stage-in"><div class="ev-sh"><span class="ae-sk">Stage ${i + 1} of 5</span><h3>${x[0]}</h3><p>${esc(x[1])}</p></div>
    <div class="ev-sb"><p class="ev-q">${esc(x[2])}</p>
    <dl><div><dt>What we do</dt><dd>${esc(x[3])}</dd></div><div><dt>What you get</dt><dd>${esc(x[4])}</dd></div></dl>
    <div class="ev-caps"><span>Capabilities</span>${x[5].filter(id => S[id]).map(id => `<a href="#service.${id}">${esc(S[id].name)} <i>→</i></a>`).join("")}</div></div></div>`;
}
function pValue() {
  const pts = [[60, 300], [290, 240], [520, 175], [750, 115], [960, 50]];
  return `
  <section class="phero ink ev-hero"><canvas data-waves='{"base":0.8,"from":0.45,"n":30}' aria-hidden="true"></canvas>
    <div class="wrap">${crumbs([["Strategic Advisory", "#home"], ["Enduring Value"]])}
    <div class="ae-hero-in">
      <div class="ae-hero-copy"><span class="eyebrow">Enduring Value</span>
        <h1><span class="hl">Turn Ambition into</span> <span class="hl">Capability to Create</span> <span class="hl"><em>Enduring Value</em></span></h1>
        <p class="stmt">We bring strategy, technology and execution together to turn complex ambitions into coordinated action — strengthening the capabilities, operating models and foundations required to create enduring value</p>
        <div class="hero-cta"><button class="btn btn-p" type="button" data-scroll="ev-journey">See how we work ${AR}</button><a class="btn btn-s" href="#contact">Start a Conversation</a></div>
      </div>
      <div class="ev-bridge" role="img" aria-label="Ambition on one side and enduring value on the other, bridged by capability">
        <svg viewBox="0 0 480 300" aria-hidden="true">
          <path class="evb-gap" d="M40 230 C 150 230, 330 90, 440 70"/>
          <path class="evb-line" d="M40 230 C 150 230, 330 90, 440 70" pathLength="1"/>
        </svg>
        <span class="evb-n evb-a" style="left:8.3%;top:63.9%"><i></i><b>Ambition</b></span>
        <span class="evb-n evb-c" style="left:50%;top:43.75%"><i></i><b>Capability</b></span>
        <span class="evb-n evb-v" style="left:91.7%;top:19.4%"><i></i><b>Enduring value</b></span>
        <p class="evb-t">The distance between ambition and impact is <em>capability</em></p>
      </div>
    </div></div></section>
  <section class="sec ev-sec ev-stall"><div class="wrap ae-chal-in">
    <div><span class="eyebrow">The challenge</span><h2 class="h2">Ambition is rarely the problem. Capability is</h2>
      <div class="ev-stall-list">${EV_STALL.map(x => `<div><h3>${esc(x[0])}</h3><p>${esc(x[1])}</p></div>`).join("")}</div></div>
    <div class="ae-q"><span class="eyebrow">The question to answer</span><p>How do we turn our ambition into the capability to deliver it — and keep delivering it?</p></div>
  </div></section>
  <section class="sec alt ev-sec" id="ev-journey"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">How we work</span><h2 class="h2">From agenda to impact</h2><p class="lede">How we move an executive agenda from intent to institutional impact. Select a stage to see what it involves</p></div>
    <div class="ev-path" role="tablist" aria-label="Stages from agenda to impact">
      <svg viewBox="0 0 1000 340" preserveAspectRatio="none" aria-hidden="true"><path class="ev-path-l" d="M0 318 ${pts.map(p => "L" + p.join(" ")).join(" ")} L1000 36"/></svg>
      ${pts.map((p, i) => `<button type="button" role="tab" class="ev-pn" aria-selected="${i === 0}" data-evstage="${i}" style="left:${p[0] / 10}%;top:${p[1] / 3.4}%"><span class="ev-pd"></span><b>${EV_STAGES[i][0]}</b></button>`).join("")}
    </div>
    <div class="ae-stage" id="ev-stage" aria-live="polite">${evStage(0)}</div>
  </div></section>
  <section class="sec ev-sec ev-disc"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">Three connected disciplines</span><h2 class="h2">One agenda, not three silos</h2><p class="lede">Strategy shapes capability. AI amplifies it. Intelligence continuously improves it</p></div>
    <div class="ev-disc-grid">${FAMILIES.map(f => `<a class="ev-d" href="#family.${f.id}"><span class="ev-d-ic">${DISC_IC[f.id]}</span><h3>${esc(f.name)}</h3><p>${esc(f.promise)}</p><span class="link">Explore ${AR}</span></a>`).join("")}</div>
  </div></section>
  <section class="sec ink ev-sec ev-val"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">The outcome</span><h2 class="h2">What enduring value looks like</h2></div>
    <div class="ev-val-grid">${EV_VALUE.map(x => `<div><span class="ev-v-ic">${iicIco(x[0])}</span><h3>${x[1]}</h3><p>${x[2]}</p></div>`).join("")}</div>
  </div></section>
  <section class="sec alt ev-sec ev-start"><div class="wrap ev-start-in">
    <div><span class="eyebrow">Where to start</span><h2 class="h2">Start with what you are trying to achieve</h2><p class="lede">Choose the agenda closest to your priorities, or explore every capability</p>
      <div class="hero-cta" style="margin-top:24px"><a class="btn btn-p" href="#services.all">Explore all capabilities ${AR}</a><a class="btn btn-s" href="#c6">How we work: C6</a></div></div>
    <ul class="ev-ag">${AGENDA.map((a, i) => `<li><a href="#agenda.${i + 1}"><span class="ag-ic">${AG_IC[i] || ""}</span><b>${esc(a.title)}</b><i>→</i></a></li>`).join("")}</ul>
  </div></section>
  ${talk("Turn your ambition into capability", "Tell us what you are trying to achieve. We will help you shape the path from ambition to enduring value.", "Enduring value")}`;
}
document.addEventListener("click", e => {
  const s = e.target.closest && e.target.closest("[data-evstage]"); if (!s) return;
  $$("[data-evstage]").forEach(b => b.setAttribute("aria-selected", b === s)); $("#ev-stage").innerHTML = evStage(+s.dataset.evstage);
});

/* ============ FLAGSHIP STORY PAGES (03 workforce, 04 performance) + C6 upgrades ============ */
const FPS = {};
function fpStage(id, i) {
  const st = FPS[id], x = st[i];
  return `<div class="ev-stage-in"><div class="ev-sh"><span class="ae-sk">${i + 1} of ${st.length}</span><h3>${esc(x[0])}</h3><p>${esc(x[1])}</p></div>
    <div class="ev-sb"><p class="ev-q">${esc(x[2])}</p>
    <dl><div><dt>What it involves</dt><dd>${esc(x[3])}</dd></div><div><dt>What it builds</dt><dd>${esc(x[4])}</dd></div></dl>
    ${x[5] && x[5].length ? `<div class="ev-caps"><span>Capabilities</span>${x[5].filter(id => S[id]).map(id => `<a href="#service.${id}">${esc(S[id].name)} <i>→</i></a>`).join("")}</div>` : ""}</div></div>`;
}
function fpExplorer(id, stages, sel = 0) {
  FPS[id] = stages;
  return `<div class="fp-steps" style="--n:${stages.length}" role="tablist">${stages.map((x, i) => `<button type="button" role="tab" class="ae-step" aria-selected="${i === sel}" data-fpset="${id}" data-fpstage="${i}"><span class="ae-sd"></span><b>${esc(x[0])}</b></button>`).join("")}</div>
    <div id="fp-${id}" aria-live="polite">${fpStage(id, sel)}</div>`;
}
function fpPage(o) {
  return `
  <section class="phero ink ev-hero ${o.cls}"><canvas data-waves='{"base":0.8,"from":0.45,"n":30}' aria-hidden="true"></canvas>
    <div class="wrap">${crumbs([["Strategic Advisory", "#home"], [o.crumb]])}
    <div class="ae-hero-in">
      <div class="ae-hero-copy"><span class="eyebrow">${o.eyebrow}</span>
        <h1><span class="hl">${o.hl[0]}</span> <span class="hl">${o.hl[1]}</span> <span class="hl"><em>${o.hl[2]}</em></span></h1>
        <p class="stmt">${o.lede}</p>
        <div class="hero-cta"><button class="btn btn-p" type="button" data-scroll="${o.cls}-centre">${o.primary} ${AR}</button><a class="btn btn-s" href="#contact" data-ctx="${esc(o.ctx)}">Start a Conversation</a></div>
      </div>
      ${o.visual}
    </div></div></section>
  <section class="sec ev-sec ev-stall"><div class="wrap ae-chal-in">
    <div><span class="eyebrow">The challenge</span><h2 class="h2">${o.chal[0]}</h2>
      <div class="ev-stall-list">${o.chal[1].map(x => `<div><h3>${esc(x[0])}</h3><p>${esc(x[1])}</p></div>`).join("")}</div></div>
    <div class="ae-q"><span class="eyebrow">The question to answer</span><p>${esc(o.chal[2])}</p></div>
  </div></section>
  <section class="sec alt ev-sec"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">${o.exp[0]}</span><h2 class="h2">${o.exp[1]}</h2><p class="lede">${o.exp[2]}</p></div>
    ${fpExplorer(o.cls, o.exp[3])}
  </div></section>
  <section class="sec ink ev-sec fp-centre" id="${o.cls}-centre"><div class="wrap">${o.centre}</div></section>
  <section class="sec ev-sec ev-disc"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">The outcome</span><h2 class="h2">${o.out[0]}</h2></div>
    <div class="fp-out">${o.out[1].map(x => `<div><span class="ev-v-ic">${iicIco(x[0])}</span><h3>${x[1]}</h3><p>${x[2]}</p></div>`).join("")}</div>
  </div></section>
  <section class="sec alt ev-sec ae-start"><div class="wrap">
    <div class="ae-start-in">
      <div><span class="eyebrow">Where to start</span><h2 class="h2">${o.start[0]}</h2><p class="lede">${o.start[1]}</p></div>
      ${assessCard(o.start[2])}
    </div>
    <div class="ae-persp"><div class="sec-head row"><div style="display:grid;gap:16px"><span class="eyebrow">Our perspective</span><h2 class="h2">Read our thinking</h2></div><a class="btn btn-s" href="#insights">All insights ${AR}</a></div>
      <div class="ins-grid">${o.start[3].map(insCard).join("")}</div></div>
  </div></section>
  ${talk(o.talk[0], o.talk[1], o.ctx)}`;
}

/* ---- Story 03: AI-ready workforce ---- */
const WF_ROLES = [
  ["Leaders", "Set direction from periodic reports and briefings", "Steer with continuous, AI-assisted insight and spend more time on judgement, trade-offs and people", "Asking the right questions of AI, governing its use and leading change"],
  ["Managers", "Coordinate work, track progress and compile updates", "Agents handle routine coordination; managers focus on priorities, quality and developing their teams", "Redesigning team workflows and supervising human–AI work"],
  ["Specialists", "Research, analyse and draft from scratch", "Start from AI-prepared analysis and drafts, then apply expertise where it matters most", "Validating AI output, domain judgement and responsible use"],
  ["Frontline teams", "Navigate systems and processes to serve each request", "AI assistants surface the right information and next step in the moment of service", "Working confidently with AI tools and knowing when to escalate"]
];
let WFSEL = 0;
function wfRole(i) {
  const r = WF_ROLES[i];
  return `<div class="fp-role"><div><span class="aed-k">Today</span><p>${esc(r[1])}</p></div><div class="fp-role-ai"><span class="aed-k">With AI</span><p>${esc(r[2])}</p></div><div><span class="aed-k">New capability needed</span><p>${esc(r[3])}</p></div></div>`;
}
function pWorkforce() {
  return fpPage({
    cls: "fpw", crumb: "AI-Ready Workforce", eyebrow: "The AI-Ready Workforce", ctx: "AI-ready workforce",
    hl: ["Build an AI-Ready", "Workforce to Unlock", "10X Potential"],
    lede: "AI is reshaping roles, skills and how work gets done. Building an AI-ready workforce requires more than new skills — it requires combining human judgement with AI to amplify capability, adapt ways of working and accelerate performance",
    primary: "See how roles change",
    visual: `<div class="fp-rings" role="img" aria-label="Human judgement at the centre, amplified through four expanding rings: equip, augment, adapt and scale">
      <div class="fpr-in" aria-hidden="true">${["Scale", "Adapt", "Augment", "Equip"].map((t, i) => `<span class="fpr" style="--r:${100 - i * 22}%;--k:${3 - i}"><b>${t}</b></span>`).join("")}<span class="fpr-core">Human<br>judgement</span></div>
      <p class="evb-t">AI doesn’t replace human capability. It <em>multiplies</em> it</p></div>`,
    chal: ["AI is changing work faster than people are being prepared for it", [
      ["Tools without fluency", "AI tools are available, but few people know how to use them well or safely"],
      ["Pilots without adoption", "Early wins stay with enthusiasts and never reach everyday work"],
      ["Roles not redesigned", "AI is added on top of existing jobs instead of reshaping them"],
      ["Uncertainty and resistance", "People are unsure what AI means for their role, so they hold back"]],
      "How do we equip our people to work with AI so that it amplifies their capability rather than replaces it?"],
    exp: ["The 10X workforce", "Equip, augment, adapt, scale", "Four moves that turn AI from a tool some people use into a capability the whole workforce has. Select one to see what it involves", [
      ["Equip", "Build AI fluency and skills", "Do our people know how to use AI well, safely and responsibly?", "Build AI literacy for everyone and deeper skills for those who shape and supervise AI", "A workforce confident to use AI within clear guidelines", ["ai-adoption", "capability-change"]],
      ["Augment", "Amplify individual capability", "Where can AI make each person more effective today?", "Identify the highest-value tasks to augment and put the right tools in people’s hands", "Measurable gains in quality and speed in everyday work", ["ai-use-cases", "ai-value"]],
      ["Adapt", "Evolve roles and ways of working", "How should roles, teams and workflows change around AI?", "Redesign roles, workflows and decision rights so people and AI each do what they do best", "Roles and processes designed for human–AI work", ["ai-operating-model", "tom"]],
      ["Scale", "Embed AI across the workforce", "How do we make AI part of how the whole organisation works?", "Scale adoption with governance, change management and performance measures", "AI capability that is embedded, governed and sustained", ["ai-governance", "ai-maturity"]]]],
    centre: `<div class="ae-demo-head"><div><span class="eyebrow">See how roles change</span><h2 class="h2">The same people, amplified</h2></div><p class="ae-scn"><span>Select a role</span>AI changes every role differently. The goal is not fewer people — it is more capable ones</p></div>
      <div class="fp-tabs" role="tablist">${WF_ROLES.map((r, i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-wfrole="${i}">${r[0]}</button>`).join("")}</div>
      <div id="wf-role" aria-live="polite">${wfRole(0)}</div>
      <p class="ae-rule">Built on leadership, skills, culture and governance</p>`,
    out: ["What an AI-ready workforce delivers", [
      ["rocket", "Faster, better work", "People spend less time on routine tasks and more on judgement"],
      ["people", "Confident adoption", "AI becomes part of everyday work, not a side project"],
      ["aim", "Roles fit for the future", "Jobs designed around what people and AI each do best"],
      ["bulb", "Continuous learning", "Skills keep pace as AI capabilities evolve"],
      ["risk", "Responsible use", "Clear guidelines so people use AI safely and with confidence"]]],
    start: ["Know how ready your people are", "Assess AI skills, adoption, governance and the foundations your workforce depends on", "ai", [0, 6, 4]],
    talk: ["Build your AI-ready workforce", "Tell us where AI is changing work in your organisation. We will help you equip, augment and adapt your people to amplify their capability."]
  });
}

/* ---- Story 04: operational excellence ---- */
const OE_CHECK = [
  [0, "Accountability for key decisions and outcomes is unclear"],
  [0, "Governance adds approvals but not control"],
  [1, "We run overlapping applications, platforms or contracts"],
  [1, "Processes have grown complex through workarounds"],
  [2, "Technology and operating costs are rising faster than value"],
  [2, "Investment is spread across too many priorities"],
  [3, "A single failure could disrupt critical services"],
  [3, "We struggle to absorb change without disruption"]
];
const OE_DISC = [
  ["Govern", "Clarify accountability and control", ["governance-framework", "pmo", "decision-governance"]],
  ["Rationalise", "Remove complexity and duplication", ["digital-rationalisation", "ea", "tom"]],
  ["Optimise", "Improve cost and resource efficiency", ["digital-maturity", "kpi", "strategy-to-execution"]],
  ["Strengthen", "Build resilience and continuity", ["ea", "capability-change", "intelligence-architecture"]]
];
let OESEL = new Set();
function oeResult() {
  if (!OESEL.size) return `<div class="aed-panel aed-idle"><p>Select the statements that describe your organisation today. We will show where to focus first.</p></div>`;
  const sc = OE_DISC.map((d, i) => [i, [...OESEL].filter(k => OE_CHECK[k][0] === i).length]).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
  return `<div class="aed-panel aed-res"><span class="aed-k">Where to focus first</span>
    <p class="aed-sum">${sc.length === 1 ? `Start with <b>${OE_DISC[sc[0][0]][0]}</b>` : `Start with <b>${OE_DISC[sc[0][0]][0]}</b>, then ${sc.slice(1).map(x => OE_DISC[x[0]][0]).join(" and ")}`}</p>
    <ul class="aed-find">${sc.map(([i]) => `<li><b>${OE_DISC[i][0]}</b><p>${OE_DISC[i][1]}</p><div class="fp-capl">${OE_DISC[i][2].filter(id => S[id]).map(id => `<a href="#service.${id}">${esc(S[id].name)} →</a>`).join("")}</div></li>`).join("")}</ul>
    <small class="fp-note">Indicative only — a starting point for a conversation, not an assessment</small></div>`;
}
function pPerformance() {
  return fpPage({
    cls: "fpp", crumb: "Operational Excellence", eyebrow: "The Performance Imperative", ctx: "Operational excellence",
    hl: ["Run Smarter. Build", "a Stronger, More", "Adaptive Enterprise"],
    lede: "As organisations scale, complexity, cost and operational risk scale with them. Building a high-performing enterprise requires stronger governance, rationalised complexity, optimised cost and the resilience to adapt and perform through continuous change",
    primary: "Find where to focus",
    visual: `<div class="fp-oe" role="img" aria-label="Operational excellence at the centre of four connected disciplines: govern, rationalise, optimise and strengthen">
      <div class="fpo-in" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path class="fpo-ring" d="M14 24H86V76H14Z"/>${[[14, 24], [86, 24], [86, 76], [14, 76]].map((p, k) => `<path class="fpo-sp" style="--k:${k}" d="M50 50L${p[0]} ${p[1]}"/>`).join("")}</svg>
        <span class="fpo-core">Operational<br>excellence</span>
        ${OE_DISC.map((d, k) => `<span class="fpo-n fpo-n${k}" style="--k:${k};left:${[14, 86, 86, 14][k]}%;top:${[24, 24, 76, 76][k]}%"><i></i><span class="fpo-l"><b>${d[0]}</b><small>${d[1]}</small></span></span>`).join("")}</div>
      <p class="evb-t">Complexity should never be the <em>price of performance</em></p></div>`,
    chal: ["Scale brings complexity. Complexity erodes performance", [
      ["Unclear accountability", "Decisions slow down when ownership and control are blurred"],
      ["Accumulated complexity", "Applications, contracts and processes multiply faster than they are retired"],
      ["Cost without value", "Spend grows, but not in proportion to what the organisation delivers"],
      ["Fragile operations", "Critical services depend on a few people, systems or suppliers"]],
      "How do we run more efficiently and more resiliently — without adding complexity?"],
    exp: ["The high-performance enterprise", "Govern, rationalise, optimise, strengthen", "Four connected disciplines around operational excellence. Select one to see what it involves", [
      ["Govern", "Clarify accountability and control", "Who owns what, and how are decisions controlled?", "Define governance, decision rights and the management rhythm that keeps the enterprise in control", "Clear accountability with fewer, faster approvals", ["governance-framework", "pmo", "decision-governance"]],
      ["Rationalise", "Remove complexity and duplication", "What can we simplify, consolidate or retire?", "Rationalise applications, platforms, contracts and processes across the enterprise", "A simpler estate that is cheaper to run and easier to change", ["digital-rationalisation", "ea", "tom"]],
      ["Optimise", "Improve cost and resource efficiency", "Where is spend not creating value?", "Align investment and resources to priorities and measure what they deliver", "Spend directed to what matters, with performance made visible", ["digital-maturity", "kpi", "strategy-to-execution"]],
      ["Strengthen", "Build resilience and continuity", "Can we absorb disruption and keep performing?", "Reduce single points of failure in people, systems and suppliers and build adaptive capability", "Operations that keep performing through change", ["ea", "capability-change", "intelligence-architecture"]]]],
    centre: `<div class="ae-demo-head"><div><span class="eyebrow">Find where to focus</span><h2 class="h2">Where is complexity costing you?</h2></div><p class="ae-scn"><span>Quick self-check</span>Select what is true for your organisation today. It takes under a minute</p></div>
      <div class="aed-grid"><ul class="fp-check">${OE_CHECK.map((x, k) => `<li><label><input type="checkbox" data-oek="${k}"><span>${esc(x[1])}</span></label></li>`).join("")}</ul><div id="oe-res">${oeResult()}</div></div>`,
    out: ["What high performance looks like", [
      ["aim", "Clear accountability", "Everyone knows who owns which decisions and outcomes"],
      ["chart", "Lower complexity", "Fewer systems, contracts and workarounds to manage"],
      ["coins", "Cost aligned to value", "Spend directed to what the organisation must deliver"],
      ["risk", "Resilient operations", "Critical services that keep running through disruption"],
      ["people", "Adaptive capacity", "The ability to absorb change and keep improving"]]],
    start: ["Know where complexity sits", "Assess governance, technology and operating maturity to see where to act first", "governance", [3, 4, 2]],
    talk: ["Build a stronger, more adaptive enterprise", "Tell us where complexity, cost or risk is holding you back. We will help you govern, rationalise, optimise and strengthen."]
  });
}

/* ---- C6 page additions ---- */
const C6_MOVES = [
  ["Connect", "Intelligence and context", "What is really happening, and who needs to be involved?", "Connect leadership, stakeholders and external signals around the agenda that matters", "A shared, evidence-based understanding of the challenge", ["decision-needs", "intelligence-architecture"]],
  ["Collaborate", "Align people and perspectives", "How do we work on the challenge together, not around it?", "Bring the institution and its partners together with clear roles and ways of working", "Alignment and ownership across organisational boundaries", ["governance-framework", "capability-change"]],
  ["Co-Vision", "Shape shared ambition", "What future are we committing to, and what comes first?", "Shape a shared vision and agree the priorities everyone will act on", "One agreed ambition with clear priorities", ["strategy-development", "ai-strategy"]],
  ["Craft", "Design capabilities and operating models", "What must we design to make the vision real?", "Design the strategy, capabilities, operating model and solutions required", "A design the institution can build and run", ["tom", "ea", "ai-operating-model"]],
  ["Construct", "Turn design into reality", "How do we deliver without losing coherence?", "Mobilise the programmes, platforms and change that make it real", "Delivered capability, governed as one agenda", ["strategy-to-execution", "pmo"]],
  ["Constitute", "Embed capability institutionally", "How does this become part of how we work?", "Embed the new policies, strategies and capabilities into how the institution operates", "Capability that outlasts the programme", ["institutional-intelligence", "decision-governance"]]
];
const C6_CMP = [
  ["Ends when", "The budget or timeline runs out", "It never ends — it keeps improving"],
  ["Owned by", "A programme team or partner", "The institution itself"],
  ["Knowledge", "Leaves with the team", "Stays, and compounds"],
  ["Measured by", "Milestones delivered", "Outcomes sustained"],
  ["After launch", "Gains fade", "Capability strengthens"]
];
document.addEventListener("click", e => {
  const s = e.target.closest && e.target.closest("[data-fpstage]");
  if (s) { const id = s.dataset.fpset; $$(`[data-fpset="${id}"]`).forEach(b => b.setAttribute("aria-selected", b === s)); $("#fp-" + id).innerHTML = fpStage(id, +s.dataset.fpstage); return; }
  const r = e.target.closest && e.target.closest("[data-wfrole]");
  if (r) { $$("[data-wfrole]").forEach(b => b.setAttribute("aria-selected", b === r)); $("#wf-role").innerHTML = wfRole(+r.dataset.wfrole); }
});
document.addEventListener("change", e => { const c = e.target.closest && e.target.closest("[data-oek]"); if (!c) return; c.checked ? OESEL.add(+c.dataset.oek) : OESEL.delete(+c.dataset.oek); $("#oe-res").innerHTML = oeResult(); });

function pOutcomes() {
  return `<section class="wrap">${crumbs([["Strategic Advisory", "#home"], ["Client Outcomes"]])}
    <div class="lphero"><span class="eyebrow">Client outcomes</span><h1>From Advisory to Measurable Outcomes</h1><p class="lede">Examples of how our disciplines come together around a client challenge. Details are anonymised.</p></div></section>
  <section class="sec tight" style="padding-top:0"><div class="wrap"><div class="outs">${OUTCOMES.map((_, i) => outCard(i)).join("")}</div></div></section>
  ${talk("Where could we create the greatest impact together?", "Tell us about your challenge and the outcome you need.", "Client outcomes")}`;
}

function pInsights() {
  const list = INSIGHTS.map((a, i) => [a, i]).filter(([a]) => INSF === "all" || a.cat === INSF).map(([, i]) => i);
  return `<section class="wrap">${crumbs([["Home", "#home"], ["Insights"]])}
    <div class="lphero"><span class="eyebrow">Insights</span><h1>Our Latest Thinking</h1><p class="lede">Perspectives on transformation, AI and intelligence for government and enterprise leaders.</p></div></section>
  <section class="sec tight" style="padding-top:0"><div class="wrap">
    <a class="c6-band" href="#c6"><div><span class="eyebrow">Our Transformation Framework</span><strong>C6</strong></div><span class="c6-words">${C6.map(c => c[0]).join(" · ")}</span><span class="link">Explore ${AR}</span></a>
    <div class="filters" role="group" aria-label="Filter by category"><button aria-pressed="${INSF === "all"}" data-insf="all">All</button>${INSIGHT_CATS.map(c => `<button aria-pressed="${INSF === c[0]}" data-insf="${c[0]}">${c[1]}</button>`).join("")}</div>
    <div class="ins-grid">${list.length ? list.map(insCard).join("") : '<p class="empty">New thinking in this category is coming soon.</p>'}</div>
  </div></section>`;
}
const artSlug = t => "art-" + t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const artToc = b => [...b.matchAll(/<h2>(.*?)<\/h2>/g)].map(m => [artSlug(m[1]), m[1]]);
const artBody = b => b.replace(/<h2>(.*?)<\/h2>/g, (_, t) => `<h2 id="${artSlug(t)}">${t}</h2>`);
addEventListener("scroll", () => { const bs = document.querySelectorAll("[data-art-to]"); if (!bs.length) return; let cur = null; bs.forEach(b => { const t = document.getElementById(b.dataset.artTo); if (t && t.getBoundingClientRect().top < 160) cur = b; }); bs.forEach(b => b.classList.toggle("on", b === cur)); }, { passive: true });
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-art-to]"); if (!b) return; const t = document.getElementById(b.dataset.artTo); if (t) scrollTo({ top: t.getBoundingClientRect().top + scrollY - 110, behavior: "smooth" }); });
document.addEventListener("click", e => {
  const z = e.target.closest && e.target.closest("[data-iic-zoom]");
  if (z) { const o = document.createElement("div"); o.className = "iic-lb"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "The Institutional Intelligence Cycle");
    o.innerHTML = `<button type="button" class="iic-lb-x" aria-label="Close">×</button><div class="iic-lb-in">${z.querySelector(".iv-stage").outerHTML}</div>`;
    document.body.appendChild(o); document.body.style.overflow = "hidden"; o.querySelector("button").focus(); return; }
  const lb = e.target.closest && e.target.closest(".iic-lb"); if (lb) { lb.remove(); document.body.style.overflow = ""; }
});
document.addEventListener("keydown", e => { if (e.key === "Escape") { const lb = document.querySelector(".iic-lb"); if (lb) { lb.remove(); document.body.style.overflow = ""; } } });
function artRender(art, famFor) {
  const toc = artToc(art.body);
  const side = (n) => `<aside class="art-side"><div class="art-toc"><h4>In this article</h4><ol>${toc.map(([id, t]) => `<li><button type="button" data-art-to="${id}">${esc(t)}</button></li>`).join("")}</ol></div>
      ${n === 0 && art.glance ? `<div class="art-glance"><h4>At a glance</h4><ol>${art.glance.map(g => `<li>${esc(g)}</li>`).join("")}</ol></div>` : ""}
      <div class="art-side-cta"><p>Where does your organization stand?</p><a class="link" href="#assessment.${art.cta[1]}">${esc(ASSESS[art.cta[1]].name)} ${AR}</a></div></aside>`;
  const parts = [artBody(art.body).replace("<!--BAND-->", art.band ? `<div class="art-fig">${art.band()}</div>` : "")];
  const tail = `${art.sources.length ? `<aside class="art-src"><h4>Sources</h4><ol>${art.sources.map(k => `<li><a href="${SRC[k][1]}" target="_blank" rel="noopener">${esc(SRC[k][0])} <span aria-hidden="true">↗</span></a></li>`).join("")}</ol></aside>` : ""}
      ${art.promo ? `<div class="art-next art-promo"><p>${esc(art.promo[0])}</p><span>${esc(art.promo[1])}</span><div class="hero-cta"><a class="btn btn-p" href="${art.promo[2]}">${esc(art.promo[3] || "Explore the capability")} ${AR}</a><a class="btn btn-s" href="#contact" data-ctx="${esc(art.promo[4])}">Start a conversation ${AR}</a></div></div>` : `<div class="art-next"><p>${esc(art.cta[0])}</p><div class="hero-cta"><a class="btn btn-p" href="#assessment.${art.cta[1]}">Take the ${esc(ASSESS[art.cta[1]].name)} ${AR}</a><a class="btn btn-s" href="#family.${famFor}">Explore ${esc(FAM[famFor].name)}</a></div></div>`}`;
  return parts.map((p, i) => `<div class="art-layout"><article class="article art-full">${p}${i === parts.length - 1 ? tail : ""}</article>${side(i)}</div>${i < parts.length - 1 && art.band ? `<div class="art-band">${art.band()}</div>` : ""}`).join("");
}
document.addEventListener("click", e => { const s = e.target.closest && e.target.closest("[data-art-share]"); if (!s) return;
  const done = () => { s.textContent = "Link copied"; setTimeout(() => s.textContent = "Share", 1800); };
  try { navigator.clipboard.writeText(location.href).then(done, done); } catch (_) { done(); } });
function pInsight(n) {
  const a = INSIGHTS[n - 1]; if (!a) return pNotFound();
  const cat = INSIGHT_CATS.find(c => c[0] === a.cat);
  const famFor = { ai: "ai", future: "ai", decision: "ei", institutional: "ei", enterprise: "et", government: "et" }[a.cat];
  const art = ARTICLES[n];
  const more = INSIGHTS.map((x, i) => [x, i]).filter(([x, i]) => i !== n - 1).filter(([, i]) => !art || ARTICLES[i + 1]).slice(0, 3).map(([, i]) => i);
  return `<section class="wrap">${crumbs([["Strategic Advisory", "#home"], ["Insights", "#insights"], [cat[1]]])}
    <div class="lphero"><div class="ins-meta"><span class="tag">${cat[1]}</span><span>${a.type}</span><span>${a.mins} min read</span></div><h1${art ? "" : " data-draft"}>${esc(a.title)}</h1><p class="lede"${art ? "" : " data-draft"}>${esc(art ? art.standfirst : a.dek)}</p>${art ? `<div class="art-by"><img src="{{LEADER}}" alt="" width="48" height="48"><div><b>Muhammad Mohsin Tariq</b><span>Senior Director, Strategic Advisory</span><span>Blackstone eIT</span></div><span class="art-date">${esc(art.date || "")}</span><button type="button" class="art-share" data-art-share aria-label="Copy link to this article">Share</button></div>` : ""}</div></section>
  <section class="sec tight" style="padding-top:0"><div class="wrap">${art ? "" : `<div class="ins-art" style="aspect-ratio:21/8;margin-bottom:48px">${insightArt(n, a.cat)}</div>`}
    ${art ? artRender(art, famFor) : `<div class="article"><p class="ph">Placeholder article. The full text will appear here once the piece is approved for publication.</p><p class="ph">Articles in this section are written for senior leaders and connect each perspective to a practical next step, from a focused diagnostic to a broader advisory engagement.</p>
    <p><a class="link" href="#family.${famFor}">Related: ${esc(FAM[famFor].name)} ${AR}</a></p></div>`}</div></section>
  <section class="sec alt"><div class="wrap"><div class="sec-head"><span class="eyebrow">More thinking</span><h2 class="h2">Continue reading</h2></div><div class="ins-grid">${more.map(insCard).join("")}</div></div></section>`;
}

function pContact() {
  const famGuess = FAMILIES.find(f => CTX && (CTX === f.name || (S[Object.keys(S).find(k => S[k].name === CTX)] && LOC[Object.keys(S).find(k => S[k].name === CTX)].fam.id === f.id)));
  return `<section class="wrap">${crumbs([["Strategic Advisory", "#home"], ["Start a Conversation"]])}
    <div class="lphero"><span class="eyebrow">Start a conversation</span><h1>Where could we create the greatest impact together?</h1><p class="lede">Tell us about your priorities. A member of our Strategic Advisory team will be in touch.</p></div></section>
  <section class="sec tight" style="padding-top:0"><div class="wrap two" style="grid-template-columns:1.4fr 1fr">
    <div id="form-host">
    <form class="form" id="ct-form" novalidate>
      <label><span>Full name</span><input id="ct-name" name="name" autocomplete="name" required><span class="err">Enter your name.</span></label>
      <label><span>Title / role</span><input id="ct-role" name="role" autocomplete="organization-title" placeholder="e.g. Director General, CIO"></label>
      <label><span>Organisation</span><input id="ct-org" name="org" autocomplete="organization" required><span class="err">Enter your organisation.</span></label>
      <label><span>Work email</span><input id="ct-email" name="email" type="email" autocomplete="email" required><span class="err">Enter a valid work email, e.g. name@organisation.ae</span></label>
      <label class="full"><span>Area of interest</span><select id="ct-area" name="area"><option value="">Not sure yet. Help me find the right starting point</option>${FAMILIES.map(f => `<option${famGuess && famGuess.id === f.id ? " selected" : ""}>${esc(f.name)}</option>`).join("")}<option${CTX === "Assessments" || Object.values(ASSESS).some(a => a.name === CTX) ? " selected" : ""}>An assessment</option></select></label>
      <label class="full"><span>What would you like to discuss?</span><textarea id="ct-msg" name="msg" placeholder="Your priorities, the challenge you face or the service you are interested in">${CTX ? esc(`I'd like to discuss: ${CTX}`) : ""}</textarea></label>
      <div class="full"><button class="btn btn-p" type="submit">Start a Conversation ${AR}</button></div>
    </form></div>
    <aside class="ct-side" data-draft>
      <div class="item"><b>What happens next</b><p>We review your note and arrange a short conversation with a senior advisor relevant to your priorities.</p></div>
      <div class="item"><b>A focused first conversation</b><p>We discuss your agenda, what has been tried so far and where a diagnostic or broader engagement would help most.</p></div>
      <div class="item"><b>No obligation</b><p>The first conversation is about understanding your context. We will suggest a practical next step only if it helps.</p></div>
    </aside>
  </div></section>`;
}
function pNotFound() {
  return `<section class="wrap" style="padding-block:120px"><h1 class="h2">That page isn't part of this prototype yet</h1><p class="lede" style="margin:16px 0 28px">Use the menu, or return to the Strategic Advisory overview.</p><a class="btn btn-p" href="#home">Back to overview ${AR}</a></section>`;
}




/* C6 in action — illustrative run */
const C6_RUN = [
  ["Scaling AI across the institution", ["Leadership, data owners and frontline teams map where AI is already used and where demand is coming from", "Business, technology, legal and risk form one AI working group with clear roles", "An agreed AI ambition and a short list of priority use cases tied to institutional goals", "The AI operating model, governance and data foundations are designed", "Priority use cases are delivered on a shared platform under one governance model", "AI policy, decision rights and skills are embedded in how the institution works"], "AI is now a governed institutional capability — not a collection of pilots"],
  ["Redesigning the operating model", ["Strategy, performance data and staff insight show where the current model breaks down", "Sector leaders co-own the redesign instead of receiving it", "A shared picture of how the institution must work to deliver its mandate", "The target operating model, processes and decision rights are designed", "The transition is delivered in waves while services keep running", "New structures, roles and governance are formalised and measured"], "The institution can now redesign itself as its mandate changes"],
  ["Delivering a new strategy", ["External signals, stakeholder expectations and performance gaps are brought together", "Entities and partners are engaged around shared outcomes", "Strategic priorities are agreed and owned by leadership", "Programmes, measures and the capabilities required are designed", "Programmes are mobilised and governed as one portfolio", "Strategy is reviewed continuously through a standing performance rhythm"], "Strategy becomes a living management discipline, not a document"]
];
let C6R = { sc: 0, s: -1, t: [] };
function c6RunBody() {
  const r = C6_RUN[C6R.sc], s = C6R.s, done = s >= 6;
  const list = `<ol class="aed-agents c6r-list">${C6.map((c, i) => { const st = s < 0 || i > s ? "wait" : i === s && !done ? "run" : "done";
    return `<li class="aed-ag aed-${st}"><span class="aed-st" aria-hidden="true"></span><div><b>C${i + 1} · ${c[0]}</b>${st === "done" ? `<em>${esc(r[1][i])}</em>` : st === "run" ? `<em class="aed-wk">In progress…</em>` : ""}</div></li>`; }).join("")}</ol>`;
  const panel = s < 0 ? `<div class="aed-panel aed-idle"><p>${esc(r[0])}: see what each movement contributes, and what the institution keeps at the end.</p><button class="btn btn-p" type="button" data-c6run>Run C6 ${AR}</button></div>`
    : !done ? `<div class="aed-panel aed-busy"><span class="aed-k">Movement ${s + 1} of 6 · ${C6[s][0]}</span><p class="aed-sum">${esc(r[1][s])}</p><span class="aed-bar"><i></i></span></div>`
    : `<div class="aed-panel aed-res"><span class="aed-k">What became institutional</span><p class="aed-sum">${esc(r[2])}</p><p>The six movements did not end with a delivered programme. They left a capability the institution owns, governs and keeps improving.</p><div class="aed-act"><button class="btn btn-p" type="button" data-c6run>Run again ${AR}</button><span>Or choose another agenda above</span></div></div>`;
  return `<div class="aed-grid">${list}${panel}</div>`;
}
function c6Run() {
  C6R.t.forEach(clearTimeout); C6R.t = []; C6R.s = 0; const v = $("#c6r-body"); if (!v) return; v.innerHTML = c6RunBody();
  for (let k = 1; k <= 6; k++) C6R.t.push(setTimeout(() => { if (!$("#c6r-body")) return; C6R.s = k; $("#c6r-body").innerHTML = c6RunBody(); }, k * (reduce ? 1 : 1500)));
}
document.addEventListener("click", e => {
  if (e.target.closest && e.target.closest("[data-c6run]")) { c6Run(); return; }
  const t = e.target.closest && e.target.closest("[data-c6sc]"); if (!t) return;
  C6R.t.forEach(clearTimeout); C6R.t = []; C6R.sc = +t.dataset.c6sc; C6R.s = -1;
  $$("[data-c6sc]").forEach(b => b.setAttribute("aria-selected", b === t)); $("#c6r-body").innerHTML = c6RunBody();
});
function pC6() {
  return `<section class="phero ink c6-q" aria-labelledby="c6-q-h"><canvas data-waves='{"base":0.8,"from":0.45,"n":30}' aria-hidden="true"></canvas>
    <div class="wrap">${crumbs([["Home", "#home"], ["Insights", "#insights"], ["C6 Framework"]])}<div class="c6-q-in"><span class="eyebrow">The Question</span><h2 class="c6-q-h" id="c6-q-h">How do organizations move beyond transformation initiatives to build <em>institutional intelligence</em> — strengthening how they learn, decide, act and continuously adapt?</h2></div></div></section>
  <section class="goal" id="s-goal" aria-labelledby="goal-h"><div class="wrap goal-in">
    <div class="goal-fw">
      <span class="eyebrow">Our Transformation Framework</span>
      <h1 class="goal-h1">C6</h1>
      <p class="goal-st">Turn transformation into an institutional capability — not another programme</p>
      <button type="button" class="link" data-c6moves>See the six movements ${AR}</button>
    </div>
    <div class="goal-c6" role="img" aria-label="The C6 Transformation Framework: Connect, Collaborate, Co-Vision, Craft, Construct and Constitute around C6.">
      <img src="{{C6IMG}}" alt="The C6 Transformation Framework: six connected capabilities — Connect, Collaborate, Co-Vision, Craft, Construct and Constitute — around a central C6" width="1339" height="1175">
    </div>
    <div class="goal-txt">
      <span class="eyebrow">Our Goal</span>
      <p class="goal-set">Our goal is simple:</p>
      <h2 id="goal-h" class="goal-st">Build organizations that learn faster, decide better and turn change into enduring capability</h2>
      <figure class="goal-who">
      <img src="{{LEADER}}" alt="Muhammad Mohsin Tariq" width="88" height="88" loading="lazy">
      <figcaption><b>Muhammad Mohsin Tariq</b><span>Senior Director, Strategic Advisory</span><em>Blackstone eIT</em></figcaption>
    </figure>
    </div>

  </div></section>
  <section class="sec alt ev-sec" id="c6-moves"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">Six connected movements</span><h2 class="h2">Connect, Collaborate, Co-Vision, Craft, Construct, Constitute</h2><p class="lede">C6 is how we work with institutions. Each movement builds on the last, and the cycle repeats as the environment changes.</p></div>
    ${fpExplorer("c6", C6_MOVES)}
  </div></section>
  <section class="sec ink ev-sec fp-centre" id="c6-run"><div class="wrap">
    <div class="ae-demo-head"><div><span class="eyebrow">See C6 in action</span><h2 class="h2">One agenda, six movements, one lasting capability</h2></div>
      <p class="ae-scn"><span>Illustrative example · choose an agenda</span>Watch how C6 moves an agenda from first conversation to a capability the institution keeps</p></div>
    <div class="fp-tabs" role="tablist">${C6_RUN.map((r, i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-c6sc="${i}">${r[0]}</button>`).join("")}</div>
    <div id="c6r-body">${c6RunBody()}</div>
    <p class="ae-rule">Then the cycle begins again, as the environment changes</p>
  </div></section>
  <section class="sec ev-sec c6-cmp-sec"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">Why it matters</span><h2 class="h2">An institutional capability — not another programme</h2></div>
    <div class="c6-cmp" role="table"><div class="c6-cmp-h" role="row"><span role="columnheader"></span><span role="columnheader">A transformation programme</span><span role="columnheader">An institutional capability</span></div>${C6_CMP.map(r => `<div class="c6-cmp-r" role="row"><b role="rowheader">${r[0]}</b><span role="cell">${r[1]}</span><span role="cell">${r[2]}</span></div>`).join("")}</div>
  </div></section>
  <section class="sec alt ev-sec c6-ii"><div class="wrap">
    <div class="two"><div><span class="eyebrow">Institutional Intelligence</span><h2 class="h2" style="margin-top:14px">A management discipline, not a one-off method</h2></div>
    <div><p class="lede" data-draft>Institutional Intelligence is the discipline of sensing change, deciding well and adapting continuously as a whole institution. C6 turns that discipline into a way of working, from the first conversation to new policies, strategies and capabilities that become part of how the institution operates.</p>
    <p style="margin-top:20px"><a class="link" href="#insights.institutional-intelligence">Read more on Institutional Intelligence ${AR}</a></p></div></div>
    <div class="c6-iic">${IIC()}</div>
  </div></section>
  <section class="sec ev-sec ae-start"><div class="wrap">
    <div class="ae-start-in">
      <div><span class="eyebrow">Where to start</span><h2 class="h2">Know how ready your institution is</h2><p class="lede">Assess the governance, management practices and capabilities that make transformation last</p></div>
      ${assessCard("governance")}
    </div>
    <div class="ae-persp"><div class="sec-head row"><div style="display:grid;gap:16px"><span class="eyebrow">Our perspective</span><h2 class="h2">Read our thinking</h2></div><a class="btn btn-s" href="#insights">All insights ${AR}</a></div>
      <div class="ins-grid">${[1, 4, 7].map(insCard).join("")}</div></div>
  </div></section>
  ${talk("Bring C6 to your agenda", "Talk to us about applying the C6 framework to your transformation priorities.", "C6 Transformation Framework")}`;
}
function pInsightFormat(id) {
  const f = INSIGHT_FORMATS.find(x => x[0] === id); if (!f) return pNotFound();
  let body;
  if (f[3] === "subscribe") body = `<form class="form sub-form" id="sub-form" novalidate style="max-width:640px"><label class="full"><span>Work email</span><input id="sub-email" type="email" autocomplete="email" required><span class="err">Enter a valid work email.</span></label>
    <fieldset class="full sub-topics"><legend>Topics</legend>${INSIGHT_CATS.map(c => `<label><input type="checkbox" id="sub-${c[0]}" checked> ${c[1]}</label>`).join("")}</fieldset>
    <div class="full"><button class="btn btn-p" type="submit">Subscribe ${AR}</button></div></form>`;
  else if (f[3] === "cases") body = `<div class="outs">${OUTCOMES.map((_, i) => outCard(i)).join("")}</div>`;
  else body = `<div class="ins-grid">${[0, 1, 2].map(i => insCard((i + id.length) % INSIGHTS.length)).join("")}</div><p class="empty ph" style="margin-top:24px">Placeholder articles. ${esc(f[1])} content will appear here once published.</p>`;
  return `<section class="wrap">${crumbs([["Home", "#home"], ["Insights", "#insights"], [f[1]]])}
    <div class="lphero"><span class="eyebrow">Insights</span><h1>${esc(f[1])}</h1><p class="lede" data-draft>${esc(f[2])}</p></div></section>
  <section class="sec tight" style="padding-top:0"><div class="wrap">${body}</div></section>`;
}

/* ============ INDUSTRIES ============ */
function pIndustries() {
  const gov = INDUSTRIES.find(i => i.featured), rest = INDUSTRIES.filter(i => !i.featured);
  return `<section class="wrap">${crumbs([["Home", "#home"], ["Industries"]])}
    <div class="lphero"><span class="eyebrow">Industries</span><h1>Sector expertise applied to your strategic priorities</h1><p class="lede">Our advisory capabilities stay the same. How they apply depends on your sector: its agenda, pressures and decisions.</p></div></section>
  <section class="sec tight" style="padding-top:0"><div class="wrap">
    <a class="ind-feat" href="#industry.government"><div><span class="ind-ic ind-ic-lg">${IND_IC.government}</span><span class="eyebrow">Featured sector</span><h2>${esc(gov.name)}</h2><p data-draft>${esc(gov.line)}</p><span class="link">Explore ${esc(gov.name)} ${AR}</span></div>
      <ul>${gov.domains.map(d => `<li>${esc(d[0])}</li>`).join("")}</ul></a>
    <div class="ind-grid">${rest.map(i => `<a class="ind-row" href="#industry.${i.id}"><span class="ind-ic">${IND_IC[i.id] || ""}</span><strong>${esc(i.name)}</strong><p data-draft>${esc(i.line)}</p>${AR}</a>`).join("")}</div>
  </div></section>
  ${talk("Talk to our sector advisors", "Tell us about your organisation and its agenda. We will bring the relevant sector and advisory expertise together.", "Industries")}`;
}
function pIndustry(id) {
  const ind = INDUSTRIES.find(i => i.id === id); if (!ind) return pNotFound();
  const a = ASSESS[ind.assess];
  const links = [["context", "Client context"], ...(ind.domains ? [["domains", "Domains"]] : []), ["priorities", "Strategic priorities"], ["services", "How we help"], ["proof", "Experience"]];
  return `
  ${phero({ crumbs: crumbs([["Home", "#home"], ["Industries", "#industries"], [ind.name]]), eyebrow: "Industry", title: ind.name, stmt: ind.line, draft: true })}
  ${subnav(ind.name, links, ind.name)}
  <section class="sec" id="context"><div class="wrap two" style="align-items:start">
    <div><span class="eyebrow">Client context</span><h2 class="h2" style="margin-top:14px">The agenda leaders are working on</h2></div>
    <p class="lede" data-draft style="font-size:1.2rem;color:var(--fg)">${esc(ind.context)}</p>
  </div></section>
  ${ind.domains ? `<section class="sec alt" id="domains"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">Domains within ${esc(ind.name)}</span><h2 class="h2">Where we work across government</h2><p class="lede">Each domain has its own mandate and decisions. We apply the same advisory capabilities to each context.</p></div>
    <div class="dom-grid" data-draft>${ind.domains.map((d, i) => `<div class="dom"><i>${String(i + 1).padStart(2, "0")}</i><strong>${esc(d[0])}</strong><p>${esc(d[1])}</p></div>`).join("")}</div>
  </div></section>` : ""}
  <section class="sec${ind.domains ? "" : " alt"}" id="priorities"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">Strategic priorities</span><h2 class="h2">What matters most in ${esc(ind.name)}</h2></div>
    <ol class="pri" data-draft>${ind.priorities.map(p => `<li><strong>${esc(p[0])}</strong><p>${esc(p[1])}</p></li>`).join("")}</ol>
  </div></section>
  <section class="sec${ind.domains ? " alt" : ""}" id="services"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">How Blackstone helps</span><h2 class="h2">Relevant advisory services</h2><p class="lede">A focused selection for this sector, drawn from our three Strategic Advisory disciplines.</p></div>
    <div class="mini-grid">${ind.services.map(mini).join("")}</div>
    <div class="start" style="margin-top:32px"><div><span class="eyebrow">A good place to start</span><h3>${esc(a.name)}</h3><p>${esc(a.line)}</p></div><a class="btn btn-p" href="#assessment.${ind.assess}">View assessment ${AR}</a></div>
  </div></section>
  <section class="sec" id="proof"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">Proof &amp; experience</span><h2 class="h2">Relevant client outcomes</h2></div>
    ${ind.outcomes.length ? `<div class="outs">${ind.outcomes.map(outCard).join("")}</div>` : `<p class="empty" data-draft>Sector case material will be added here once cleared for publication.</p>`}
  </div></section>
  ${talk(`Talk to us about ${esc(ind.name)}`, "Tell us about your organisation and its agenda. We will bring the right sector and advisory expertise to the conversation.", ind.name)}`;
}

/* ============ ROUTER ============ */
const TITLES = { home: "Strategic Advisory", services: "Capabilities", assessments: "Assessments & Accelerators", outcomes: "Client Outcomes", insights: "Insights", contact: "Start a Conversation", industries: "Industries" };
let firstRender = true;
/* remember where the reader was on each page, so Back returns them to the same spot */
const SCROLLPOS = {}; let viaLink = false;
document.addEventListener("click", e => {
  const l = e.target.closest && e.target.closest('a[href^="#"]');
  if (!l || l.hasAttribute("data-back") || e.defaultPrevented) return;
  const h = l.getAttribute("href"); if (h === "#" || h === location.hash) return;
  SCROLLPOS[location.hash || "#home"] = scrollY; viaLink = true;
}, true);
/* anchor the hero signature line just above the wave crest, and always clear of the content above it */
/* mirror the hero: the journey takes exactly the visual width of the left copy, so both sit the same distance from the centre */
/* fit the hero: on short or very wide screens, scale the copy and the right-hand model so the signature clears the wave */
let HZ = 1, WMINY0 = 0;
function fitHero() {
  const hero = document.querySelector(".hero"), line = document.querySelector(".hero-line"), parts = [".hero-copy", ".hero-journey"].map(q => document.querySelector(q));
  if (!hero || !line || parts.some(x => !x)) return;
  HZ = 1; WMINY0 = 0; parts.forEach(x => x.style.zoom = "");
  balanceHero(); centreAg2();
  if (innerWidth >= 1200) {
    const H = hero.clientHeight, W = hero.clientWidth, bh = W * 1.06 * (1018 / 3229);
    const y0 = H - innerHeight * .06 - bh * (W < 1500 ? .88 : .95), crest = y0 + .74 * (H - y0), hr = hero.getBoundingClientRect();
    const top0 = parts[0].getBoundingClientRect().top - hr.top;
    const content = Math.max(...[...hero.querySelectorAll(".hero-cta, .hj-lbl, .hs-nav")].map(e => e.getBoundingClientRect().bottom - hr.top));
    line.style.removeProperty("--D");
    const lhMin = line.offsetHeight - line.querySelector(".amb-c").offsetWidth + 96;
    const s = Math.max(.76, Math.min(1, (crest + 30 - 54 - lhMin - top0) / (content - top0)));
    if (s < .995) { HZ = s; parts.forEach(x => x.style.zoom = s); balanceHero(); centreAg2(); }
    /* keep the wave's rising edge below the copy, buttons and story bubbles */
    const cb = Math.max(...[...hero.querySelectorAll(".hero-cta, .hj-lbl, .hs-nav")].filter(e => e.getBoundingClientRect().height).map(e => e.getBoundingClientRect().bottom - hr.top));
    const needCrest = cb + 24 + lhMin + 30;   /* and the signature + line sit above the wave's crest */
    WMINY0 = Math.max((cb + 30 - .42 * H) / .58, (needCrest - .74 * H) / .26);
  }
  placeHeroLine();
}
addEventListener("resize", fitHero);
/* C6 reveal: each node starts on the wave surface, spread across the lower hero, and rises to its place */
function placeC6Start() {
  const hero = document.querySelector(".hero"), m = document.querySelector(".c6m"); if (!hero || !m) return;
  const hr = hero.getBoundingClientRect(), W = hr.width, H = hr.height;
  const fx = [.56, .74, .96, .84, .64, .46];          // different areas of the surface
  const fy = [.90, .86, .84, .93, .95, .91];
  m.querySelectorAll(".c6-n").forEach((n, k) => {
    const r = n.getBoundingClientRect();
    n.style.setProperty("--sx", Math.round((hr.left + W * fx[k] - r.left) / HZ) + "px");
    n.style.setProperty("--sy", Math.round((hr.top + H * fy[k] - r.top) / HZ) + "px");
  });
}
function centreAg2() {
  const box = document.querySelector(".ag2"), inn = document.querySelector(".ag2-in"); if (!box || !inn) return;
  inn.style.transform = ""; box.style.flex = ""; box.style.height = "";
  const c60 = document.querySelector(".c6m"); if (c60) { c60.style.flex = ""; c60.style.height = ""; }
  const oe0 = document.querySelector(".oe"); if (oe0) { oe0.style.flex = ""; oe0.style.height = ""; }
  const wf0 = document.querySelector(".wf"); if (wf0) { wf0.style.flex = ""; wf0.style.height = ""; const f0 = wf0.querySelector(".wf-base2"); if (f0) { f0.style.left = ""; f0.style.right = ""; } }
  if (innerWidth < 1200) return;
  /* frame ends level with the bottom of Story 01's step labels */
  const lb = Math.max(...[...document.querySelectorAll(".hj-stage .hj-lbl")].map(e => e.getBoundingClientRect().bottom));
  const bt = box.getBoundingClientRect().top;
  if (lb > bt + 200) { box.style.flex = "none"; box.style.height = Math.round((lb - bt) / HZ) + "px"; }
  const c6m = document.querySelector(".c6m");
  if (c6m) { c6m.style.flex = ""; c6m.style.height = ""; const ct = c6m.getBoundingClientRect().top; if (lb > ct + 200) { c6m.style.flex = "none"; c6m.style.height = Math.round((lb - ct) / HZ) + "px"; } }
  if (c6m) placeC6Start();
  const oe = document.querySelector(".oe");
  if (oe) { oe.style.flex = ""; oe.style.height = ""; const ot = oe.getBoundingClientRect().top; if (lb > ot + 200) { oe.style.flex = "none"; oe.style.height = Math.round((lb - ot) / HZ) + "px"; } }
  const wf = document.querySelector(".wf");
  if (wf) { wf.style.flex = ""; wf.style.height = ""; const wt = wf.getBoundingClientRect().top; if (lb > wt + 200) { wf.style.flex = "none"; wf.style.height = Math.round((lb - wt) / HZ) + "px"; }
    /* step labels sit on the same row as Story 01's step labels */
    /* the foundation is the model's last line and ends level with Story 01's labels and Story 02's frame;
       the step labels sit just above it */
    const fbx = wf.querySelector(".wf-base2"), lbls = [...wf.querySelectorAll(".wf-lbl")];
    if (fbx && lbls.length) { wf.style.setProperty("--lt", "0px");
      const fh = fbx.getBoundingClientRect().height / HZ, lh = Math.max(...lbls.map(e => e.getBoundingClientRect().height)) / HZ;
      wf.style.setProperty("--lt", Math.round((lb - wt) / HZ - fh - 18 - lh) + "px"); }
    /* foundation: rule and text centred on the actual bounding width of the four-stage model */
    const fb = wf.querySelector(".wf-base2"), wr = wf.getBoundingClientRect();
    if (fb) { const rs = [...wf.querySelectorAll(".wf-c > *, .wf-lbl b, .wf-lbl span, .wf-lbl em")].map(e => { const g = document.createRange(); g.selectNodeContents(e); const r = e.children.length || e.tagName === "I" || e.tagName === "B" && e.closest(".wf-c") ? e.getBoundingClientRect() : g.getBoundingClientRect(); return r; }).filter(r => r.width);
      const L = Math.min(...rs.map(r => r.left)) - wr.left, R = Math.max(...rs.map(r => r.right)) - wr.left; fb.style.left = Math.round(L / HZ) + "px"; fb.style.right = Math.round((wr.width - R) / HZ) + "px"; } }
  const els = [...inn.querySelectorAll(".ag2-lbl, .ag2-cap, .ag2-en, .ag2-node i, .ag2-orbit")];
  const rs = els.map(e => e.getBoundingClientRect()).filter(r => r.width);
  const L = Math.min(...rs.map(r => r.left)), R = Math.max(...rs.map(r => r.right)), b = box.getBoundingClientRect();
  inn.style.transform = `translateX(${Math.round(((b.left + b.right) / 2 - (L + R) / 2) / HZ)}px)`;
}
function balanceHero() {
  const j = document.querySelector(".hero-journey"), c = document.querySelector(".hero-copy");
  if (!j || !c) return;
  if (innerWidth < 1200) { j.style.width = ""; return; }
  const rects = [...c.querySelectorAll('.hs[data-s="0"] :is(h1, .lede, .hero-cta, .eyebrow)')].flatMap(e => { const r = document.createRange(); r.selectNodeContents(e); return [...r.getClientRects()]; });
  const left = Math.min(...rects.map(r => r.left)), right = Math.max(...rects.map(r => r.right));
  j.style.width = Math.round((right - left) / HZ) + "px";
}
/* C6 section: text blocks sit on the outer margins, C6 centred between them */
function balanceC6() {
  const img = $(".goal-c6 img"), fw = $(".goal-fw"), tx = $(".goal-txt"); if (!img || !fw || !tx) return;
  img.style.setProperty("--c6x", "0px"); tx.style.width = "";
  if (innerWidth < 1181) return;
  /* the goal block takes the narrowest width that keeps its statement on the same lines, and hugs the right margin */
  const h = $("#goal-h"), lines = () => Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)), base = lines();
  let lo = 240, hi = Math.floor(tx.getBoundingClientRect().width);
  while (hi - lo > 2) { const m = (lo + hi) >> 1; tx.style.width = `${m}px`; if (lines() > base) lo = m; else hi = m; }
  tx.style.width = `${hi + 2}px`;
  /* the hexagon group sits on the midpoint between the two text blocks */
  const fwR = Math.max(...[...fw.children].map(e => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect().right; }));
  const txL = tx.getBoundingClientRect().left, ir = img.getBoundingClientRect();
  img.style.setProperty("--c6x", `${Math.round((fwR + txL) / 2 - (ir.left + ir.width / 2))}px`);
}
addEventListener("resize", balanceC6);
function placeHeroLine() {
  const hero = document.querySelector(".hero"), line = document.querySelector(".hero-line");
  if (!hero || !line) return;
  if (innerWidth < 1200) { line.style.top = ""; return; }
  const H = hero.clientHeight, W = hero.clientWidth, bh = W * 1.06 * (1018 / 3229);
  const y0 = Math.max(H - innerHeight * .06 - bh * (W < 1500 ? .88 : .95), WMINY0);
  const crest = y0 + .74 * (H - y0);              // wave crest at the page's centre line
  const hr = hero.getBoundingClientRect();
  const content = Math.max(...[...hero.querySelectorAll(".hero-cta, .hj-lbl, .hs-nav")].map(e => e.getBoundingClientRect().bottom - hr.top));
  /* size the circles to the space that is actually free between the content and the wave */
  line.style.removeProperty("--D");
  const base = line.querySelector(".amb-c").offsetWidth, extra = line.offsetHeight - base;
  const room = (crest - 30) - (content + 24) - extra;
  const D = Math.max(96, Math.min(base, room));
  line.style.setProperty("--D", D + "px");
  const lh = line.offsetHeight, ideal = crest - lh - 30, min = content + 24;
  line.style.top = Math.round(Math.max(ideal, min)) + "px";
}


/* story 02 signature: a point rises, travels right and leaves a node at each stage */
function playAuto() {
  const box = document.querySelector(".amb-auto"), mv = box && box.querySelector(".aa-mover"); if (!mv) return;
  const steps = [...box.querySelectorAll(".aa-step")], line = box.querySelector(".aa-row");
  (playAuto.anims || []).forEach(a => a.cancel()); playAuto.anims = [];
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { box.classList.remove("aa-play"); return; }
  box.classList.add("aa-play");
  const br = box.getBoundingClientRect();
  const pts = steps.map(st => { const r = st.querySelector("i").getBoundingClientRect(); return [r.left + r.width / 2 - br.left, r.top + r.height / 2 - br.top, r.width]; });
  const T0 = 350, RISE = 650, HOP = 620;
  const kf = [{ transform: `translate(${pts[0][0]}px, ${pts[0][1] + 46}px) scale(.6)`, opacity: 0, offset: 0 }];
  const total = RISE + HOP * 3;
  kf.push({ transform: `translate(${pts[0][0]}px, ${pts[0][1]}px) scale(1)`, opacity: 1, offset: RISE / total });
  for (let k = 1; k < 4; k++) kf.push({ transform: `translate(${pts[k][0]}px, ${pts[k][1]}px) scale(${pts[k][2] / pts[0][2]})`, opacity: 1, offset: (RISE + HOP * k) / total });
  playAuto.anims.push(mv.animate(kf, { duration: total, delay: T0, easing: "cubic-bezier(.45,.05,.25,1)", fill: "forwards" }));
  playAuto.anims.push(mv.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: T0 + total + 150, fill: "forwards" }));
  playAuto.anims.push(line.animate([{ "--aa": 0 }, { "--aa": 0 }], { duration: 1 }));
  steps.forEach((st, k) => {
    const at = T0 + RISE + HOP * k, n = st.querySelector("i"), lab = st.querySelector("b");
    playAuto.anims.push(n.animate([{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1.9)", opacity: 1, offset: .35 }, { transform: "scale(.9)", opacity: .55, offset: .6 }, { transform: "scale(1.25)", opacity: 1, offset: .8 }, { transform: "scale(1)", opacity: "" }], { duration: 750, delay: at, fill: "backwards", easing: "ease-out" }));
    playAuto.anims.push(lab.animate([{ opacity: 0, transform: lab.style.transform || "" }, { opacity: 1 }], { duration: 450, delay: at - 120, fill: "backwards" }));
  });
  const seg = box.querySelector(".aa-track");
  if (seg) playAuto.anims.push(seg.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: HOP * 3, delay: T0 + RISE, easing: "cubic-bezier(.45,.05,.25,1)", fill: "backwards" }));
}

/* story 01: the ambition/impact circles play once each time the story appears; the story hands over after they meet */
function replayAmb() {
  const el = document.getElementById("s-amb"); if (!el) return;
  clearInterval(window.__ambLoop); clearTimeout(window.__ambT);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.classList.add("in", "seen"); return; }
  el.classList.add("reset"); el.classList.remove("in", "amb-out"); void el.offsetWidth; el.classList.remove("reset");
  window.__ambT = setTimeout(() => el.classList.add("in", "seen"), 250);
}
/* hero: two stories, 7s each, progress line, pause on interaction */
function armHeroStories() {
  const hero = document.querySelector(".hero"); if (!hero || !hero.querySelector(".hs-nav")) return;
  cancelAnimationFrame(window.__hsRAF);
  const DURS = [6200, 7000, 7000, 7000, 9000], reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const slides = [...hero.querySelectorAll(".hs")], tabs = [...hero.querySelectorAll("[data-hs]")];
  let cur = 0, t = 0, last = performance.now(), hold = 0;
  const show = (n, focus) => {
    const dir = n < cur ? -1 : 1; hero.style.setProperty("--hsd", dir);
    cur = (n + slides.length) % slides.length; t = 0;
    slides.forEach((el, k) => { const on = k === cur; el.classList.toggle("is-on", on); el.toggleAttribute("inert", !on); el.setAttribute("aria-hidden", String(!on)); });
    tabs.forEach((b, k) => { const on = k === cur; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; b.style.setProperty("--p", on ? 0 : 0); });
    hero.classList.toggle("hs-2", cur === 1);
    hero.classList.toggle("hs-3", cur === 2); hero.classList.toggle("hs-4", cur === 3); hero.classList.toggle("hs-5", cur === 4); hero.classList.toggle("hs-alt", cur !== 0);
    if (cur === 1) requestAnimationFrame(playAuto);
    if (cur === 0) replayAmb();
    if (focus) tabs[cur].focus();
  };
  hero.__hsShow = show;
  const loop = (now) => {
    if (!document.body.contains(hero)) return;
    const dt = Math.min(now - last, 100); last = now;
    const paused = hold > 0 || document.hidden || reduce;
    const DUR = DURS[cur] || 7000;
    if (!paused) { t += dt; if (t >= DUR) show(cur + 1); }
    tabs[cur].style.setProperty("--p", reduce ? 1 : Math.min(t / (DURS[cur] || 7000), 1));
    window.__hsRAF = requestAnimationFrame(loop);
  };
  const zone = hero.querySelector(".hero-in");
  /* pause only while the pointer is on something interactive (buttons, story bubbles), not anywhere over the hero */
  hero.querySelectorAll(".hero-cta a, .hs-nav button").forEach(el => { el.addEventListener("mouseenter", () => { hold |= 1; }); el.addEventListener("mouseleave", () => { hold &= ~1; }); });
  zone.addEventListener("focusin", e => { if (e.target.matches(":focus-visible")) hold |= 2; });
  zone.addEventListener("focusout", () => { if (!zone.contains(document.activeElement)) hold &= ~2; });
  tabs.forEach((b, k) => b.addEventListener("click", () => show(k)));
  const pb = hero.querySelector(".hs-pause");
  if (pb) pb.addEventListener("click", () => { const on = !(hold & 8); hold = on ? hold | 8 : hold & ~8; pb.setAttribute("aria-pressed", String(on)); pb.setAttribute("aria-label", on ? "Play stories" : "Pause stories"); hero.classList.toggle("hs-paused", on); });
  hero.querySelector(".hs-nav").addEventListener("keydown", e => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); show(cur + (e.key === "ArrowRight" ? 1 : -1), true); }
    if (e.key === "Home") { e.preventDefault(); show(0, true); } if (e.key === "End") { e.preventDefault(); show(slides.length - 1, true); }
  });
  /* two-finger sideways swipe on a trackpad (horizontal wheel) slides between stories; vertical scrolling is untouched */
  let wx = 0, wLock = 0, wT = 0;
  hero.addEventListener("wheel", e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2) return;
    e.preventDefault();
    const now = performance.now();
    if (now < wLock) return;
    if (now - wT > 250) wx = 0; wT = now;
    wx += e.deltaX;
    if (Math.abs(wx) > 60) { show(cur + (wx > 0 ? 1 : -1)); wx = 0; wLock = now + 900; }
  }, { passive: false });
  let tx = null, ty = 0;
  zone.addEventListener("touchstart", e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; hold |= 4; }, { passive: true });
  zone.addEventListener("touchend", e => { hold &= ~4; if (tx === null) return; const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; tx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(cur + (dx < 0 ? 1 : -1)); }, { passive: true });
  show(0); window.__hsRAF = requestAnimationFrame(loop);
}
/* ambition / impact / capability: the two circles meet when the section comes into view */
let ambIO;
function armAmb() {
  const s = document.getElementById("s-amb"); if (!s) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) { s.classList.add("in"); return; }
  s.classList.remove("in", "seen"); setTimeout(() => s.classList.add("in"), 900); setTimeout(() => s.classList.add("seen"), 3400);
  /* replay: hold the final state, fade out, then let the circles meet again */
  clearInterval(window.__ambLoop);
  window.__ambLoop = setInterval(() => {
    const el = document.getElementById("s-amb"); if (!el) { clearInterval(window.__ambLoop); return; }
    if (document.hidden) return;
    el.classList.add("amb-out");
    setTimeout(() => { el.classList.add("reset"); el.classList.remove("in", "amb-out"); void el.offsetWidth; el.classList.remove("reset");
      setTimeout(() => el.classList.add("in"), 120); }, 900);
  }, 9000);
}
function render() {
  const raw = location.hash.slice(1) || "home";
  const dot = raw.indexOf(".");
  const r = dot < 0 ? raw : raw.slice(0, dot), p = dot < 0 ? "" : raw.slice(dot + 1);
  let html, scrollTo = null;
  switch (r) {
    case "home": html = pHome(); if (p) scrollTo = "s-" + p; break;
    case "family": html = pFamily(p); break;
    case "service": html = pService(p); break;
    case "services": if (FAM[p]) { EX.fam = p; EX.grp = "a"; SV.view = "family"; } else if (p === "all") { SV.view = "family"; SV.q = ""; } else if (!SV.q) SV.view = "agenda"; html = pServices(); break;
    case "assessments": html = pAssessments(); break;
    case "assessment": html = pAssessment(p); break;
    case "agenda": if (+p === 1) { aeClear(); AED.s = 0; AED.keep = AE_ITEMS.map(() => true); html = pAgentic(); } else html = pAgenda(+p); break;
    case "need": html = pNeed(+p); break;
    case "outcomes": html = pOutcomes(); break;
    case "insights": html = p ? pInsightFormat(p) : pInsights(); break;
    case "c6": C6R.t.forEach(clearTimeout); C6R = { sc: 0, s: -1, t: [] }; html = pC6(); break;
    case "value": html = pValue(); break;
    case "workforce": html = pWorkforce(); break;
    case "performance": OESEL = new Set(); html = pPerformance(); break;
    case "insight": html = pInsight(+p); break;
    case "contact": html = pContact(); break;
    case "industries": html = pIndustries(); break;
    case "industry": html = pIndustry(p); break;
    default: html = pNotFound();
  }
  const v = $("#view");
  v.innerHTML = html;
  v.classList.remove("enter"); void v.offsetWidth; if (!firstRender) v.classList.add("enter");
  closeMega(); closeDrawer(); closePal();
  $$(".nav>a[data-r]").forEach(a => a.classList.toggle("on", a.dataset.r === r || (a.dataset.r === "services" && ["service", "family"].includes(r)) || (a.dataset.r === "assessments" && r === "assessment") || (a.dataset.r === "insights" && r === "insight")));
  const sa = $("#nav-sa"); sa.classList.toggle("on", ["industries", "industry"].includes(r)); $("#nav-ins").classList.toggle("on", ["insights", "insight", "c6"].includes(r)); const nc = $("#nav-cap"); nc && nc.classList.toggle("on", ["services", "service", "family"].includes(r));
  document.body.classList.toggle("home", r === "home"); hdrState();
  const pending = sessionStorageGet("scrollAfter");
  if (pending) { scrollTo = pending; sessionStorageSet("scrollAfter", ""); }
  if (scrollTo && $("#" + scrollTo)) requestAnimationFrame(() => $("#" + scrollTo).scrollIntoView({ behavior: firstRender ? "instant" : "smooth" }));
  else {
    const key = location.hash || "#home", saved = !viaLink && !firstRender ? SCROLLPOS[key] : null;
    window.scrollTo({ top: 0, behavior: "instant" });
    if (saved != null) { const go = () => window.scrollTo({ top: saved, behavior: "instant" }); go(); requestAnimationFrame(go); setTimeout(go, 250); }
  }
  viaLink = false;
  mountWaves(); armAmb(); armHeroStories(); fitHero(); setTimeout(fitHero, 400); document.fonts && document.fonts.ready.then(fitHero); balanceC6(); setTimeout(balanceC6, 300); { const ci = $(".goal-c6 img"); ci && !ci.complete && ci.addEventListener("load", balanceC6, { once: true }); } document.fonts && document.fonts.ready.then(() => { balanceC6(); fitHero(); }); setTimeout(fitHero, 50); setTimeout(fitHero, 2600); bindSubnav(); armPos(); requestAnimationFrame(drawSys); document.fonts && document.fonts.ready.then(drawSys);
  let t = $("h1", v)?.textContent || TITLES[r] || "Strategic Advisory";
  document.title = (r === "home" ? "Strategic Advisory" : t) + " · Blackstone eIT";
  firstRender = false;
}
let _ss = {};
function sessionStorageGet(k) { return _ss[k] || ""; }
function sessionStorageSet(k, v) { _ss[k] = v; }

function armPos() {
  const f = $("#pf"); if (!f || reduce) return;
  if (f.getBoundingClientRect().top < innerHeight * .9) return;
  f.classList.add("arm");
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { f.classList.add("play"); io.disconnect(); } }, { threshold: .35 });
  io.observe(f);
}
/* Strategic Advisory model: draw fine connections between the three disciplines and the core */
function drawSys() {
  const sys = $("#sys"); if (!sys) return;
  const svg = $(".sys-svg", sys), R = sys.getBoundingClientRect();
  if (getComputedStyle(svg).display === "none") return;
  svg.setAttribute("viewBox", `0 0 ${R.width} ${R.height}`);
  const pt = el => { const r = el.getBoundingClientRect(); return [r.left - R.left + r.width / 2, r.top - R.top + r.height / 2]; };
  const P = Object.fromEntries(["et", "ai", "ei"].map(k => [k, pt($(`.sys-${k} .sys-dot`, sys))])), C = pt($(".sys-core", sys));
  const cr = $(".sys-core", sys).getBoundingClientRect().width / 2;
  const toCore = k => { const [x, y] = P[k], dx = C[0] - x, dy = C[1] - y, d = Math.hypot(dx, dy); return [C[0] - dx / d * cr, C[1] - dy / d * cr]; };
  const arc = (a, b, bend) => { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy); const cx = mx - dy / d * bend, cy = my + dx / d * bend; return `M${a[0]} ${a[1]} Q${cx} ${cy} ${b[0]} ${b[1]}`; };
  let h = "";
  ["et", "ai", "ei"].forEach(k => { const e = toCore(k); h += `<path class="sl sl-core" data-k="${k}" d="M${P[k][0]} ${P[k][1]} L${e[0]} ${e[1]}"/>`; });
  [["et", "ai", -.27], ["ai", "ei", -.16], ["ei", "et", -.16]].forEach(([a, b, f]) => { const bend = f * Math.hypot(P[b][0] - P[a][0], P[b][1] - P[a][1]); h += `<path class="sl sl-ring" data-k="${a} ${b}" d="${arc(P[a], P[b], bend)}"/>`; });
  svg.innerHTML = h;
}
addEventListener("resize", () => drawSys());
document.addEventListener("mouseover", e => { const d = e.target.closest && e.target.closest("[data-sys]"); const sys = $("#sys"); if (!sys) return;
  const k = d ? d.dataset.sys : ""; if (sys.dataset.on === k) return; sys.dataset.on = k;
  $$(".sl", sys).forEach(p => p.classList.toggle("hot", !!k && p.dataset.k.split(" ").includes(k))); });
/* sticky sub-nav: active section + stuck title */
let subIO;
function bindSubnav() {
  subIO && subIO.disconnect();
  const sn = $("#subnav"); if (!sn) return;
  const links = $$("a[data-scroll]", sn);
  const secs = links.map(a => document.getElementById(a.dataset.scroll)).filter(Boolean);
  subIO = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.dataset.scroll === e.target.id)); });
  }, { rootMargin: "-45% 0px -50% 0px" });
  secs.forEach(s => subIO.observe(s));
  const onScroll = () => sn.classList.toggle("stuck", sn.getBoundingClientRect().top <= 73);
  window.removeEventListener("scroll", window.__snScroll || (() => { }));
  window.__snScroll = onScroll; window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
}

/* ============ MEGA MENU / DRAWER ============ */
const MEGA = {};
function buildMega() {
  const gov = INDUSTRIES.find(i => i.featured), rest = INDUSTRIES.filter(i => !i.featured);
  MEGA.insights = `<div class="wrap ins-mega">
    <a class="c6-feat" href="#c6"><span class="eyebrow">Our Transformation Framework</span><strong>C6</strong><span class="link">Explore the C6 Framework ${AR}</span></a>
    <ul class="im-list ins-list">${INSIGHT_FORMATS.map(f => `<li><a href="#insights.${f[0]}">${esc(f[1])}</a></li>`).join("")}</ul>
    <div class="im-head"><h4>Insights</h4><p>Perspectives and frameworks for leaders shaping what comes next</p><a class="link" href="#insights">All insights ${AR}</a></div>
  </div>`;
  const CAP_PICK = { et: ["strategy-development", "strategy-to-execution", "tom", "ea", "pmo"], ai: ["ai-strategy", "ai-use-cases", "ai-governance", "ai-operating-model"], ei: ["decision-intelligence", "kpi", "dashboard", "predictive", "institutional-intelligence"] };
  MEGA.capabilities = `<div class="wrap cap-mega">
    <div class="im-head"><h4>Capabilities</h4><p>Three connected disciplines, brought together around the outcomes you need to achieve</p><a class="link" href="#services.all">All capabilities ${AR}</a></div>
    ${FAMILIES.map(f => `<div class="cmg-col"><a class="cmg-t" href="#family.${f.id}"><span class="im-ic">${DISC_IC[f.id]}</span>${esc(f.name)}</a><ul>${f.id === "ai" ? `<li><a href="#agenda.1">The Agentic Enterprise</a></li>` : ""}${CAP_PICK[f.id].filter(id => S[id]).map(id => `<li><a href="#service.${id}">${esc(S[id].name)}</a></li>`).join("")}</ul></div>`).join("")}
    <div class="cmg-foot"><a class="link" href="#services">Start with your agenda ${AR}</a></div>
  </div>`;
  MEGA.industries = `<div class="wrap ind-mega">
    <div class="im-head"><h4>Industries</h4><p>Sector expertise applied to your strategic priorities</p><a class="link" href="#industries">All industries ${AR}</a></div>
    <div class="im-gov"><a class="im-gov-t" href="#industry.government"><span class="im-ic">${IND_IC.government}</span>${esc(gov.name)} <span>→</span></a><p>${esc(gov.line)}</p>
      <ul>${gov.domains.map(d => `<li><a href="#industry.government" data-scrollafter="domains">${esc(d[0])}</a></li>`).join("")}</ul></div>
    <ul class="im-list">${rest.map(i => `<li><a href="#industry.${i.id}"><span class="im-ic">${IND_IC[i.id] || ""}</span>${esc(i.name)}</a></li>`).join("")}</ul>
  </div>`;
  $("#drawer-body").innerHTML = `
    <a class="dl" href="#home">Home</a>
    
    <details><summary>Industries <svg class="chev" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 3l4 4 4-4"/></svg></summary>${INDUSTRIES.map(i => `<a href="#industry.${i.id}">${esc(i.name)}</a>`).join("")}<a href="#industries" style="color:var(--accent-ink);font-weight:600">All industries →</a></details>
    <details><summary>Capabilities <svg class="chev" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 3l4 4 4-4"/></svg></summary>${FAMILIES.map(f => `<a href="#family.${f.id}">${esc(f.name)}</a>`).join("")}<a href="#agenda.1">${esc(AGENDA[0].title)}</a><a href="#services">Start with your agenda</a><a href="#services.all" style="color:var(--accent-ink);font-weight:600">All capabilities →</a></details>
    <details><summary>Insights <svg class="chev" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 3l4 4 4-4"/></svg></summary><a href="#c6" style="color:var(--accent-ink);font-weight:600">Our Transformation Framework: C6</a>${INSIGHT_FORMATS.map(f => `<a href="#insights.${f[0]}">${esc(f[1])}</a>`).join("")}</details>
    <a class="btn btn-p" href="#contact">Start a Conversation ${AR}</a>`;
}
let megaT;
function hdrState() { const hero = document.body.classList.contains("home") && $(".hero"); $(".hdr").classList.toggle("pinned", !!hero && hero.getBoundingClientRect().bottom <= 0); }
window.addEventListener("scroll", hdrState, { passive: true });
let megaKind = "";
function openMega(kind = "industries") { clearTimeout(megaT); if (megaKind !== kind) { $("#mega").innerHTML = MEGA[kind]; megaKind = kind; } $(".hdr").classList.add("mega-on"); $("#mega").classList.add("open"); $$(".mega-btn").forEach(b => b.setAttribute("aria-expanded", b.dataset.mega === kind)); }
function closeMega() { $(".hdr").classList.remove("mega-on"); $("#mega").classList.remove("open"); $$(".mega-btn").forEach(b => b.setAttribute("aria-expanded", "false")); }
function openDrawer() { $("#drawer").classList.add("open"); document.body.style.overflow = "hidden"; }
function closeDrawer() { $("#drawer").classList.remove("open"); document.body.style.overflow = ""; }

/* ============ PALETTE ============ */
let palSel = 0, palRes = [];
function openPal(q = "") { closeMega(); closeDrawer(); const p = $("#pal"); p.classList.add("open"); const i = $("#pal-q"); i.placeholder = innerWidth < 600 ? "Search" : "What are you looking for?"; i.value = q; palRender(); setTimeout(() => i.focus(), 30); }
function closePal() { $("#pal").classList.remove("open"); }
const PAL_POP = ["Operating model", "AI readiness", "Cost optimisation", "AI governance", "KPIs", "Enterprise architecture"];
const PAL_ORDER = ["Capability", "Assessment", "Insight", "Industry", "Family", "Client agenda"];
const PAL_LBL = { Capability: "Capabilities", Assessment: "Assessments", Insight: "Insights", Industry: "Industries", Family: "Disciplines", "Client agenda": "Client agendas" };
function palRender() {
  const q = $("#pal-q").value; const list = $("#pal-list");
  $("[data-palclear]").hidden = !q;
  if (!q.trim()) {
    const ins = [0, 1, 3, 6].map(i => INDEX.find(x => x.href === `#insight.${i + 1}`));
    const as = Object.keys(ASSESS).map(id => INDEX.find(x => x.href === `#assessment.${id}`));
    palRes = [...ins, ...as];
    list.innerHTML = `<div class="pal-home">
      <div class="pal-col"><h4>Popular searches</h4><div class="pal-chips">${PAL_POP.map(t => `<button type="button" data-palq="${esc(t)}">${esc(t)}</button>`).join("")}</div>
        <h4>Start with an assessment</h4>${as.map((x, i) => `<a class="pal-item pal-as" href="${x.href}" data-pi="${i + ins.length}"><strong>${esc(x.name)}</strong>${AR}</a>`).join("")}</div>
      <div class="pal-col"><h4>Latest insights</h4>${ins.map((x, i) => { const n = +x.href.split(".")[1] - 1, ph = INS_PHOTO2[n];
        return `<a class="pal-item pal-ins" href="${x.href}" data-pi="${i}">${ph ? `<img src="${ph[0]}" alt="" style="object-position:${ph[1]}" loading="lazy">` : ""}<span><small>${esc((INSIGHT_CATS.find(c => c[0] === INSIGHTS[n].cat) || [0, "Insight"])[1])}</small><strong>${esc(x.name)}</strong></span></a>`; }).join("")}</div></div>`;
  } else {
    const r = search(q).slice(0, 18);
    palRes = PAL_ORDER.flatMap(t => r.filter(x => x.type === t));
    let k = 0;
    list.innerHTML = palRes.length ? `<p class="pal-count">${palRes.length} result${palRes.length > 1 ? "s" : ""} for “${esc(q)}”</p>` + PAL_ORDER.map(t => { const g = palRes.filter(x => x.type === t); return g.length ? `<section class="pal-grp"><h4>${PAL_LBL[t]}</h4><div>${g.map(x => `<a class="pal-item pal-res" href="${x.href}" data-pi="${k++}"><strong>${hi(x.name, q)}</strong><small>${esc(x.sub)}</small></a>`).join("")}</div></section>` : ""; }).join("")
      : `<div class="pal-none"><p>No results for “${esc(q)}”.</p><a class="link" href="#contact" data-ctx="${esc(q)}">Ask our advisory team ${AR}</a></div>`;
  }
  palSel = q.trim() && palRes.length ? 0 : -1; palHL();
}
function palHL() { $$(".pal-item").forEach(el => el.classList.toggle("sel", +el.dataset.pi === palSel)); const s = $(".pal-item.sel"); s && s.scrollIntoView({ block: "nearest" }); }

/* ============ EVENTS ============ */
document.addEventListener("submit", e => { const f = e.target.closest && e.target.closest("[data-sub]"); if (!f) return; e.preventDefault();
  const i = f.querySelector("input"); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.value)) { i.setAttribute("aria-invalid", "true"); i.focus(); return; }
  f.innerHTML = `<p>Thank you. You'll receive our next perspective by email.</p><span class="ins-sub-n">Prototype: no data has been sent.</span>`; });
addEventListener("scroll", () => { const bs = document.querySelectorAll("[data-capjump]"); if (!bs.length) return; let cur = null; bs.forEach(b => { const t = document.getElementById(b.dataset.capjump); if (t && t.getBoundingClientRect().top < 200) cur = b; }); bs.forEach(b => b.classList.toggle("on", b === cur)); }, { passive: true });
document.addEventListener("click", e => { const m = e.target.closest && e.target.closest("[data-c6moves]"); if (m) { const t = document.getElementById("c6-moves"); t && scrollTo({ top: t.getBoundingClientRect().top + scrollY - 80, behavior: "smooth" }); } });
document.addEventListener("click", e => { const d = e.target.closest && e.target.closest("[data-capdoor]"); if (!d) return;
  if (SV.view !== "family" || SV.q) { SV.view = "family"; SV.q = ""; const q = $("#svc-q"); if (q) q.value = ""; $$("[data-svview]").forEach(b => b.setAttribute("aria-pressed", b.dataset.svview === "family")); $("#svc-out").innerHTML = servicesOut(); }
  const t = document.getElementById(d.dataset.capdoor); if (t) scrollTo({ top: t.getBoundingClientRect().top + scrollY - 90, behavior: "smooth" }); });
document.addEventListener("click", e => { const j = e.target.closest && e.target.closest("[data-capjump]"); if (!j) return; const t = document.getElementById(j.dataset.capjump); if (t) scrollTo({ top: t.getBoundingClientRect().top + scrollY - 90, behavior: "smooth" }); });
document.addEventListener("click", e => {
  const t = e.target;
  const back = t.closest("[data-back]");
  if (back) { e.preventDefault(); if (navDepth > 0) { navDepth -= 2; history.back(); } else location.hash = "home"; return; }
  const ctxA = t.closest("[data-ctx]"); if (ctxA) CTX = ctxA.dataset.ctx;
  else if (t.closest('a[href="#contact"]')) CTX = "";
  const sa = t.closest("[data-scrollafter]"); if (sa) sessionStorageSet("scrollAfter", sa.dataset.scrollafter);
  const sc = t.closest("[data-scroll]");
  if (sc) { e.preventDefault(); const el = document.getElementById(sc.dataset.scroll); el && el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); return; }
  const a = t.closest('a[href^="#"]');
  if (a && a.getAttribute("href") === location.hash && !sc) { e.preventDefault(); render(); }
  if (t.closest("[data-pal]")) { e.preventDefault(); openPal(); return; }
  if (t.closest("#pal") && !t.closest(".pal-box")) { closePal(); return; }
  if (t.closest("[data-palx]")) { closePal(); return; }
  if (t.closest("[data-palclear]")) { const i = $("#pal-q"); i.value = ""; palRender(); i.focus(); return; }
  const pq = t.closest("[data-palq]"); if (pq) { const i = $("#pal-q"); i.value = pq.dataset.palq; palRender(); i.focus(); return; }
  const agg = t.closest("[data-agg]"); if (agg) { setAg(AGENDA_VOICE.findIndex(v => v.g === +agg.dataset.agg)); return; }
  const ag = t.closest("[data-ag]");
  if (ag) { setAg(+ag.dataset.ag, true); return; }
  const ft = t.closest("[data-famtoggle]");
  if (ft) { const card = $("#fam-" + ft.dataset.famtoggle); const o = card.classList.toggle("open"); ft.setAttribute("aria-expanded", o); return; }
  const exf = t.closest("[data-exf]"); if (exf) { EX = { fam: exf.dataset.exf, grp: "a" }; $("#ex-host").innerHTML = explorer(); $(`[data-exf="${EX.fam}"]`).focus(); return; }
  const exg = t.closest("[data-exg]"); if (exg) { EX.grp = exg.dataset.exg; $("#ex-host").innerHTML = explorer(); $(`[data-exg="${EX.grp}"]`).focus(); return; }
  const ot = t.closest("[data-otab]"); if (ot) { const card = ot.closest("[data-out]"); OUTTAB[card.dataset.out] = ot.dataset.otab; card.outerHTML = outCard(+card.dataset.out); return; }
  const sv = t.closest("[data-svview]"); if (sv) { SV.view = sv.dataset.svview; SV.q = ""; $("#svc-q").value = ""; $$("[data-svview]").forEach(b => b.setAttribute("aria-pressed", b === sv)); $("#svc-out").innerHTML = servicesOut(); return; }
  const inf = t.closest("[data-insf]"); if (inf) { INSF = inf.dataset.insf; if (location.hash === "#insights") { e.preventDefault(); render(); } return; }
  const mb = t.closest(".mega-btn"); if (mb) { ($("#mega").classList.contains("open") && megaKind === mb.dataset.mega) ? closeMega() : openMega(mb.dataset.mega); return; }
  const rb = t.closest("#region-btn"); const rm = $("#region-menu");
  if (rb) { const open = rm.hidden; rm.hidden = !open; rb.setAttribute("aria-expanded", open); return; }
  const rg = t.closest("[data-region]");
  if (rg) { $("#region-label").textContent = rg.dataset.region; $$("[data-region]").forEach(x => x.setAttribute("aria-pressed", x === rg)); rm.hidden = true; $("#region-btn").setAttribute("aria-expanded", "false"); return; }
  if (rm && !rm.hidden && !t.closest(".region")) { rm.hidden = true; $("#region-btn").setAttribute("aria-expanded", "false"); }
  if (t.closest("#burger")) { openDrawer(); return; }
  if (t.closest("#drawer-x")) { closeDrawer(); return; }
  if (!t.closest(".hdr")) closeMega();
});
$("#mega").addEventListener("mouseenter", () => clearTimeout(megaT));
document.addEventListener("input", e => {
  if (e.target.id === "svc-q") { SV.q = e.target.value; $("#svc-out").innerHTML = servicesOut(); }
  if (e.target.id === "pal-q") palRender();
});
document.addEventListener("keydown", e => {
  const pal = $("#pal").classList.contains("open");
  if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { e.preventDefault(); openPal(); return; }
  if (e.key === "Escape") { closePal(); closeMega(); closeDrawer(); }
  if (pal && e.key === "ArrowDown") { e.preventDefault(); palSel = Math.min(palSel + 1, palRes.length - 1); palHL(); }
  if (pal && e.key === "ArrowUp") { e.preventDefault(); palSel = Math.max(palSel - 1, 0); palHL(); }
  if (pal && e.key === "Enter" && palRes[palSel]) { e.preventDefault(); const h = palRes[palSel].href; closePal(); location.hash = h.slice(1); }
});
document.addEventListener("submit", e => {
  if (e.target.id === "sub-form") { e.preventDefault(); const em = $("#sub-email"), ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value); em.closest("label").classList.toggle("bad", !ok); if (!ok) { em.focus(); return; } e.target.outerHTML = `<div class="done" style="max-width:640px"><span class="eyebrow">Subscribed</span><h2>Thank you.</h2><p class="lede">You will receive new insights on the topics you selected.</p><p style="font-size:.84rem;color:var(--fg-3)">Prototype: no data has been sent.</p></div>`; return; }
  if (e.target.id !== "ct-form") return;
  e.preventDefault();
  const f = e.target; let ok = true;
  [["ct-name", v => v.trim()], ["ct-org", v => v.trim()], ["ct-email", v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)]].forEach(([id, test]) => {
    const el = $("#" + id), bad = !test(el.value); el.closest("label").classList.toggle("bad", bad); if (bad && ok) { el.focus(); ok = false; }
  });
  if (!ok) return;
  const name = $("#ct-name").value.trim().split(" ")[0];
  $("#form-host").innerHTML = `<div class="done"><span class="eyebrow">Received</span><h2>Thank you, ${esc(name)}.</h2><p class="lede">Your note is with our Strategic Advisory team. We will be in touch to arrange a first conversation.</p><p style="font-size:.84rem;color:var(--fg-3)">Prototype: no data has been sent.</p><div class="hero-cta" style="margin-top:8px"><a class="btn btn-s" href="#services">Explore Our Capabilities</a><a class="link" href="#home">Back to overview ${AR}</a></div></div>`;
  window.scrollTo({ top: 0, behavior: "smooth" });
});
function setAg(i, fromClick) {
  const mobile = matchMedia("(max-width:900px)").matches;
  if (mobile && fromClick && i === AGSEL) { const el = $(`[data-agi="${i}"]`); el.hidden = !el.hidden; return; }
  const regroup = AGENDA_VOICE[i].g !== AGENDA_VOICE[AGSEL].g;
  AGSEL = i;
  if (regroup) { $("#aglist").innerHTML = agList(); $$(".sel-tab").forEach(b => b.setAttribute("aria-selected", +b.dataset.agg === AGENDA_VOICE[i].g)); }
  $$(".sel-item").forEach(b => b.setAttribute("aria-pressed", +b.dataset.ag === i));
  $("#agp").innerHTML = agPanel(i);
  $$("[data-agi]").forEach(el => { el.hidden = +el.dataset.agi !== i; if (!el.hidden) el.innerHTML = agPanel(i); });
}
document.addEventListener("keydown", e => {
  const it = e.target.closest && e.target.closest(".sel-item"); if (!it || !["ArrowDown", "ArrowUp"].includes(e.key)) return;
  e.preventDefault(); const ids = $$(".sel-item").map(b => +b.dataset.ag), k = ids.indexOf(+it.dataset.ag), n = ids[(k + (e.key === "ArrowDown" ? 1 : ids.length - 1)) % ids.length]; setAg(n); $(`#agt-${n}`).focus();
});
let navDepth = 0;
window.addEventListener("hashchange", () => { navDepth = Math.max(0, navDepth + 1); render(); });

/* review notes */

buildMega();
render();
