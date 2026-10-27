/* Rijual Ki Khaniya — Games (alag file: purani files ko nahi chhuti)
   Kahaniyan wahi se aati hain jahan se main app leta hai (Supabase `stories` table), sirf PADHNE ke liye. */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const TEST = /[?&]rktest=1/.test(location.search);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function hash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 } return h >>> 0 }
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
function shuffle(arr, r = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch (e) { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } }
};
const fmtTime = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

/* ---------- Progress (sirf is phone mein) ---------- */
const PROG_KEY = 'rk_games_v1';
function bestOf(game, id) { const p = LS.get(PROG_KEY, {}); return (p[game] || {})[id] || null }
function saveBest(game, id, rec) {
  const p = LS.get(PROG_KEY, {}); p[game] = p[game] || {};
  const old = p[game][id];
  if (!old || rec.stars > old.stars || (rec.stars === old.stars && rec.moves < old.moves)) p[game][id] = rec;
  LS.set(PROG_KEY, p);
}

/* ---------- Sound (user ke button/tap dabane ke baad hi shuru) ---------- */
const Snd = {
  ctx: null, on: LS.get('rk_games_sound', true),
  init() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)() } catch (e) { } }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => { });
  },
  toggle() { this.on = !this.on; LS.set('rk_games_sound', this.on); if (this.on) this.init(); return this.on },
  tone(f, d = .12, type = 'sine', v = .13, t0 = 0) {
    if (!this.on || !this.ctx) return;
    try {
      const t = this.ctx.currentTime + t0, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + d + .02);
    } catch (e) { }
  },
  flip() { this.tone(520, .06) }, match() { this.tone(660, .1); this.tone(880, .16, 'sine', .13, .1) },
  miss() { this.tone(210, .14, 'triangle') }, star() { this.tone(988, .08); this.tone(1318, .12, 'sine', .12, .08) },
  step() { this.tone(300, .04, 'square', .04) },
  clap() {
    if (!this.on || !this.ctx) return;
    try {
      for (let i = 0; i < 7; i++) {
        const t = this.ctx.currentTime + i * .13, len = Math.floor(this.ctx.sampleRate * .06), buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
        for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len);
        const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = buf; g.gain.value = .5; s.connect(g); g.connect(this.ctx.destination); s.start(t);
      }
    } catch (e) { }
  }
};
document.addEventListener('pointerdown', () => Snd.init(), { passive: true });
document.addEventListener('keydown', () => Snd.init());
function soundBtn(btn) {
  const set = () => { btn.textContent = Snd.on ? '🔊 Sound On' : '🔇 Sound Off' };
  set(); btn.onclick = () => { Snd.toggle(); set() };
}

/* ---------- Confetti ---------- */
let confettiRAF = 0;
function confetti() {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let cv = $('confetti');
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'confetti'; cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60;border-radius:0'; document.body.appendChild(cv) }
  const dpr = window.devicePixelRatio || 1; cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  const ctx = cv.getContext('2d'), cols = ['#ff5d73', '#ffd166', '#7bdff2', '#6d4aff', '#23985b', '#ff9db8'];
  const ps = Array.from({ length: 150 }, () => ({ x: Math.random() * cv.width, y: -Math.random() * cv.height * .5, vx: (Math.random() - .5) * 4 * dpr, vy: (2 + Math.random() * 4) * dpr, s: (6 + Math.random() * 8) * dpr, c: cols[Math.floor(Math.random() * cols.length)], r: Math.random() * 6, vr: (Math.random() - .5) * .3 }));
  cancelAnimationFrame(confettiRAF); const t0 = performance.now();
  (function loop(now) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore() });
    if (now - t0 < 3200) confettiRAF = requestAnimationFrame(loop); else ctx.clearRect(0, 0, cv.width, cv.height);
  })(t0);
}

/* ---------- Kahaniyan (wahi data source: Supabase `stories`, sirf padhna) ---------- */
let stories = [], hiddenInfo = { n: 0, values: [] }, dataSource = 'none';
const BAD = ['draft', 'pending', 'rejected', 'unpublished', 'hidden', 'false', '0', 'private', 'review', 'waiting'];
const GOOD = ['approved', 'published', 'live', 'active', 'public', 'true', '1', 'visible'];
function publishState(row) {
  // Agar tumhari table mein approval/status ka column ho to Draft/Pending kahaniyan yahan nahi dikhengi.
  for (const f of ['status', 'approval_status', 'approved', 'is_approved', 'published', 'is_published']) {
    if (!(f in row)) continue;
    const v = row[f]; if (v === null || v === undefined || v === '') continue;   // purani kahaniyan (column khaali) dikhengi
    if (typeof v === 'boolean') { if (!v) return { ok: false, why: f + '=false' }; continue }
    const t = String(v).toLowerCase().trim();
    if (BAD.includes(t)) return { ok: false, why: f + '=' + t };
    if ((f === 'status' || f === 'approval_status') && !GOOD.includes(t)) return { ok: false, why: f + '=' + t };
  }
  return { ok: true };
}
function readCache(k) { const d = LS.get(k, null); return Array.isArray(d) ? d : null }
async function loadStories() {
  const cfg = window.APP_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !String(cfg.SUPABASE_URL).includes('PASTE_') && cfg.SUPABASE_PUBLISHABLE_KEY && !String(cfg.SUPABASE_PUBLISHABLE_KEY).includes('PASTE_');
  let rows = null;
  if (configured && window.supabase) {
    try {
      // Anonymous (public) client: admin login ka session yahan use nahi hota, taaki sirf public kahaniyan dikhein.
      const c = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { data, error } = await c.from('stories').select('id, title, content, image_url, created_at').order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) { rows = data; dataSource = 'live'; LS.set('rk_games_stories_v1', data) }
    } catch (e) { console.error(e) }
  }
  if (!rows) { rows = readCache('rk_games_stories_v1') || readCache('rk_stories_v1'); dataSource = rows ? 'offline' : 'none' }
  hiddenInfo = { n: 0, values: [] }; stories = [];
  (rows || []).forEach(r => {
    const st = publishState(r);
    if (!st.ok) { hiddenInfo.n++; if (!hiddenInfo.values.includes(st.why)) hiddenInfo.values.push(st.why); return }
    stories.push({ id: String(r.id), title: r.title || 'कहानी', text: r.content || r.text || '', emoji: r.emoji || '', image: r.image_url || r.image || '' });
  });
}

/* ---------- Router ---------- */
const GAMES = {
  maze: { name: 'Maze Game', icon: '🧩', pick: 'Maze के लिए कहानी चुनो' },
  color: { name: 'Rang Bharo', icon: '🎨', pick: 'रंग भरने के लिए कहानी चुनो' },
  memory: { name: 'Memory Card Game', icon: '🃏', pick: 'Memory Game के लिए कहानी चुनो' }
};
let cleanup = null;
function showView(name) { ['hub', 'picker', 'play'].forEach(v => $(v).classList.toggle('hidden', v !== name)); window.scrollTo({ top: 0 }) }
function crumbs(items) {
  const box = $('crumbs'); box.textContent = '';
  items.forEach(([label, href]) => { const a = document.createElement('a'); a.className = 'pill'; a.textContent = label; a.href = href; box.appendChild(a) });
}
function setStatus() {
  const s = $('status'); let msg = '';
  if (dataSource === 'none') msg = '⚠️ कहानियाँ लोड नहीं हो पाईं। इंटरनेट जाँचें और पेज फिर खोलें।';
  else if (dataSource === 'offline') msg = '📴 इंटरनेट नहीं है — पिछली बार सेव हुई कहानियाँ दिख रही हैं।';
  if (hiddenInfo.n && !msg) msg = '';
  s.textContent = msg; s.classList.toggle('hidden', !msg);
}
function route() {
  if (cleanup) { try { cleanup() } catch (e) { } cleanup = null }
  const parts = decodeURIComponent(location.hash.slice(1)).split('/');
  const g = parts[0], id = parts[1];
  if (!GAMES[g]) { renderHub(); return }
  if (!id) { renderPicker(g); return }
  const st = stories.find(x => x.id === id);
  if (!st) { renderPicker(g); return }
  renderPlay(g, st);
}
function renderHub() {
  crumbs([['📚 सभी कहानियाँ', './index.html']]); showView('hub');
}
function renderPicker(g) {
  crumbs([['🎮 Games Menu', '#'], ['📚 सभी कहानियाँ', './index.html']]); showView('picker');
  $('pickerTitle').textContent = GAMES[g].icon + ' ' + GAMES[g].pick;
  const grid = $('storyGrid'); grid.textContent = '';
  if (!stories.length) {
    const p = document.createElement('div'); p.className = 'notice'; p.style.gridColumn = '1/-1';
    p.textContent = dataSource === 'none' ? 'कहानियाँ अभी लोड नहीं हुईं।' : 'अभी कोई प्रकाशित कहानी नहीं है। नई कहानी प्रकाशित होते ही यहाँ अपने-आप दिखेगी।';
    if (hiddenInfo.n) p.textContent += ' (' + hiddenInfo.n + ' कहानी Draft/Pending होने से छिपी हैं: ' + hiddenInfo.values.join(', ') + ')';
    grid.appendChild(p); return;
  }
  stories.forEach(s => {
    const b = document.createElement('button'); b.className = 'storycard'; b.dataset.id = s.id;
    const best = bestOf(g, s.id);
    const top = s.image ? '<img class="thumb" loading="lazy" alt="" src="' + esc(s.image) + '">' : '<div class="emoji">' + esc(s.emoji || '📖') + '</div>';
    b.innerHTML = top + '<strong>' + esc(s.title) + '</strong><small>' + (best ? '⭐'.repeat(Math.max(1, Math.min(3, best.stars || 1))) + ' खेल चुके हो' : 'खेलो →') + '</small>';
    b.onclick = () => { location.hash = '#' + g + '/' + encodeURIComponent(s.id) };
    grid.appendChild(b);
  });
  if (hiddenInfo.n) {
    const p = document.createElement('div'); p.className = 'muted'; p.style.gridColumn = '1/-1';
    p.textContent = 'ℹ️ ' + hiddenInfo.n + ' कहानी Draft/Pending होने से यहाँ नहीं दिख रही हैं।'; grid.appendChild(p);
  }
}
function renderPlay(g, st) {
  crumbs([['← कहानी चुनो', '#' + g], ['🎮 Games Menu', '#'], ['📚 सभी कहानियाँ', './index.html']]); showView('play');
  const box = $('play'); box.textContent = '';
  const head = document.createElement('div'); head.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:6px';
  head.innerHTML = (st.image ? '<img alt="" src="' + esc(st.image) + '" style="width:46px;height:46px;border-radius:12px;object-fit:cover">' : '<span style="font-size:34px">' + esc(st.emoji || '📖') + '</span>') +
    '<div><div class="muted">' + GAMES[g].icon + ' ' + GAMES[g].name + '</div><strong style="font-size:18px">' + esc(st.title) + '</strong></div>';
  box.appendChild(head);
  const body = document.createElement('div'); box.appendChild(body);
  if (g === 'maze') playMaze(st, body); else if (g === 'memory') playMemory(st, body); else playColor(st, body);
}

/* =====================================================================
   1) MAZE
   ===================================================================== */
const DIRS = { N: [0, -1, 1, 4], E: [1, 0, 2, 8], S: [0, 1, 4, 1], W: [-1, 0, 8, 2] };   // dx,dy,bit,opposite
const ALGOS = ['dfs', 'prim', 'kruskal', 'sidewinder', 'bintree'];
const ALGO_NAMES = ['घुमावदार गलियाँ', 'जाल', 'पहेली-पुल', 'लहरें', 'सीढ़ियाँ'];
function genMaze(w, h, algo, r) {
  const open = Array.from({ length: h }, () => new Uint8Array(w));
  const carve = (x, y, d) => { const [dx, dy, b, o] = DIRS[d]; open[y][x] |= b; open[y + dy][x + dx] |= o };
  const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  if (algo === 'dfs') {
    const seen = Array.from({ length: h }, () => new Uint8Array(w)); const st = [[Math.floor(r() * w), Math.floor(r() * h)]]; seen[st[0][1]][st[0][0]] = 1;
    while (st.length) {
      const [x, y] = st[st.length - 1];
      const nb = shuffle(Object.keys(DIRS), r).filter(d => { const nx = x + DIRS[d][0], ny = y + DIRS[d][1]; return inb(nx, ny) && !seen[ny][nx] });
      if (!nb.length) { st.pop(); continue }
      const d = nb[0], nx = x + DIRS[d][0], ny = y + DIRS[d][1]; carve(x, y, d); seen[ny][nx] = 1; st.push([nx, ny]);
    }
  } else if (algo === 'prim') {
    const seen = Array.from({ length: h }, () => new Uint8Array(w)), fr = [];
    const add = (x, y) => { seen[y][x] = 1; for (const d in DIRS) { const nx = x + DIRS[d][0], ny = y + DIRS[d][1]; if (inb(nx, ny) && !seen[ny][nx]) fr.push([x, y, d]) } };
    add(Math.floor(r() * w), Math.floor(r() * h));
    while (fr.length) {
      const i = Math.floor(r() * fr.length), [x, y, d] = fr[i]; fr[i] = fr[fr.length - 1]; fr.pop();
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
      if (!seen[ny][nx]) { carve(x, y, d); add(nx, ny) }
    }
  } else if (algo === 'kruskal') {
    const par = Array.from({ length: w * h }, (_, i) => i), find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a] } return a };
    const edges = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (x < w - 1) edges.push([x, y, 'E']); if (y < h - 1) edges.push([x, y, 'S']) }
    shuffle(edges, r).forEach(([x, y, d]) => { const nx = x + DIRS[d][0], ny = y + DIRS[d][1], a = find(y * w + x), b = find(ny * w + nx); if (a !== b) { par[a] = b; carve(x, y, d) } });
  } else if (algo === 'sidewinder') {
    for (let y = 0; y < h; y++) {
      let run = [];
      for (let x = 0; x < w; x++) {
        run.push(x);
        const east = x < w - 1 && (y === 0 || r() < .5);
        if (east) carve(x, y, 'E');
        else if (y > 0) { const c = run[Math.floor(r() * run.length)]; carve(c, y, 'N'); run = [] }
      }
    }
  } else {  // bintree
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = []; if (y > 0) ch.push('N'); if (x < w - 1) ch.push('E');
      if (ch.length) carve(x, y, ch[Math.floor(r() * ch.length)]);
    }
  }
  return open;
}
function mazeSolve(open, w, h, sx, sy, ex, ey) {   // BFS: raasta mile to path, warna null
  const prev = new Int32Array(w * h).fill(-2); prev[sy * w + sx] = -1; const q = [[sx, sy]];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i]; if (x === ex && y === ey) break;
    for (const d in DIRS) { const [dx, dy, b] = DIRS[d]; if (!(open[y][x] & b)) continue; const nx = x + dx, ny = y + dy; if (prev[ny * w + nx] === -2) { prev[ny * w + nx] = y * w + x; q.push([nx, ny]) } }
  }
  if (prev[ey * w + ex] === -2) return null;
  const path = []; let c = ey * w + ex; while (c !== -1) { path.push([c % w, Math.floor(c / w)]); c = prev[c] } return path.reverse();
}
function playMaze(story, root) {
  const CFG = { easy: { n: 7, stars: 3 }, medium: { n: 11, stars: 5 }, hard: { n: 15, stars: 7 } };
  const seedBase = hash(story.id), hue = seedBase % 360;
  let diff = (LS.get('rk_games_diff', {}).maze) || 'easy'; if (!CFG[diff]) diff = 'easy';
  let level = 0, m = null, timer = 0, raf = 0, paused = false, won = false, pausedAt = 0, pausedTotal = 0;
  const pImg = new Image(); let pImgOk = false; if (story.image) { pImg.onload = () => { pImgOk = true; draw() }; pImg.src = story.image }
  const glyph = story.emoji || '🐻';
  root.innerHTML = `
    <div class="bar seg" id="mzDiff"></div>
    <div class="bar"><span class="stat" id="mzLevel"></span><span class="stat" id="mzMoves">👣 0</span><span class="stat" id="mzTime">⏱ 00:00</span><span class="stat" id="mzStars">⭐ 0/0</span></div>
    <div class="stage"><canvas id="mzCv" aria-label="Maze"></canvas><div id="mzOv" class="overlay hidden"></div></div>
    <div class="dpad" aria-label="Controls"><button class="u" data-d="N" aria-label="ऊपर">▲</button><button class="l" data-d="W" aria-label="बाएँ">◀</button><button class="d" data-d="S" aria-label="नीचे">▼</button><button class="r" data-d="E" aria-label="दाएँ">▶</button></div>
    <div class="bar" style="justify-content:center"><button class="secondary" id="mzPause">⏸ Pause</button><button class="secondary" id="mzRestart">🔄 Restart</button><button class="secondary" id="mzNext">➡️ अगला Level</button><button class="secondary" id="mzSound"></button></div>
    <div class="muted" style="text-align:center">कंप्यूटर: Arrow Keys / WASD · मोबाइल: बटन या स्वाइप करो</div>`;
  const cv = root.querySelector('#mzCv'), ctx = cv.getContext('2d'), ov = root.querySelector('#mzOv');
  soundBtn(root.querySelector('#mzSound'));
  const seg = root.querySelector('#mzDiff');
  [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].forEach(([k, l]) => {
    const b = document.createElement('button'); b.textContent = l; b.dataset.k = k; b.className = k === diff ? 'on' : '';
    b.onclick = () => { diff = k; const d = LS.get('rk_games_diff', {}); d.maze = k; LS.set('rk_games_diff', d); [...seg.children].forEach(x => x.classList.toggle('on', x.dataset.k === k)); level = 0; build() };
    seg.appendChild(b);
  });
  function build() {
    const { n, stars } = CFG[diff], algoIdx = (seedBase + level) % ALGOS.length, algo = ALGOS[algoIdx];
    const r = mulberry((seedBase ^ Math.imul(level + 1, 7919) ^ Math.imul(n, 131)) >>> 0);
    let open = genMaze(n, n, algo, r);
    const corners = [[0, 0, n - 1, n - 1], [n - 1, 0, 0, n - 1], [0, n - 1, n - 1, 0], [n - 1, n - 1, 0, 0]], [sx, sy, ex, ey] = corners[(seedBase + level) % 4];
    if (!mazeSolve(open, n, n, sx, sy, ex, ey)) open = genMaze(n, n, 'dfs', r);   // suraksha: hal na mile to dfs maze
    const cells = []; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!(x === sx && y === sy) && !(x === ex && y === ey)) cells.push(x + ',' + y);
    const starSet = new Set(shuffle(cells, r).slice(0, stars));
    m = { n, open, sx, sy, ex, ey, px: sx, py: sy, ax: sx, ay: sy, stars: starSet, got: new Set(), moves: 0, t0: 0, secs: 0, algoIdx, total: stars };
    paused = false; won = false; pausedAt = 0; pausedTotal = 0; m.pausedMs0 = () => pausedTotal + (paused && pausedAt ? Date.now() - pausedAt : 0);
    ov.classList.add('hidden'); clearInterval(timer);
    root.querySelector('#mzPause').textContent = '⏸ Pause';
    sizeCanvas(); updateHud(); draw();
    if (TEST) window.__rk.maze = () => m;
  }
  function sizeCanvas() {
    const maxW = Math.min(root.clientWidth || 360, 560), cell = Math.max(18, Math.floor(maxW / m.n)), css = cell * m.n, dpr = window.devicePixelRatio || 1;
    m.cell = cell; cv.style.width = css + 'px'; cv.style.height = css + 'px'; cv.width = css * dpr; cv.height = css * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    root.querySelector('.stage').style.width = css + 'px';
  }
  function updateHud() {
    root.querySelector('#mzLevel').textContent = 'Level ' + (level + 1) + ' · ' + ALGO_NAMES[m.algoIdx];
    root.querySelector('#mzMoves').textContent = '👣 ' + m.moves;
    root.querySelector('#mzTime').textContent = '⏱ ' + fmtTime(m.secs);
    root.querySelector('#mzStars').textContent = '⭐ ' + m.got.size + '/' + m.total;
  }
  function draw() {
    if (!m) return; const { n, cell, open } = m, S = cell * n;
    ctx.clearRect(0, 0, S, S);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { ctx.fillStyle = (x + y) % 2 ? `hsl(${hue},70%,94%)` : `hsl(${(hue + 40) % 360},70%,91%)`; ctx.fillRect(x * cell, y * cell, cell, cell) }
    ctx.fillStyle = '#c8f2d8'; ctx.fillRect(m.sx * cell, m.sy * cell, cell, cell);
    ctx.fillStyle = '#ffe58b'; ctx.fillRect(m.ex * cell, m.ey * cell, cell, cell);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = Math.floor(cell * .5) + 'px system-ui,"Apple Color Emoji","Noto Color Emoji",sans-serif';
    ctx.fillText('🏠', (m.sx + .5) * cell, (m.sy + .52) * cell); ctx.fillText('🏁', (m.ex + .5) * cell, (m.ey + .52) * cell);
    m.stars.forEach(k => { if (m.got.has(k)) return; const [x, y] = k.split(',').map(Number); ctx.fillText('⭐', (x + .5) * cell, (y + .52) * cell) });
    ctx.strokeStyle = '#4b2bd6'; ctx.lineWidth = Math.max(4, cell * .14); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const o = open[y][x];
      if (!(o & 1)) { ctx.moveTo(x * cell, y * cell); ctx.lineTo((x + 1) * cell, y * cell) }
      if (!(o & 4)) { ctx.moveTo(x * cell, (y + 1) * cell); ctx.lineTo((x + 1) * cell, (y + 1) * cell) }
      if (!(o & 8)) { ctx.moveTo(x * cell, y * cell); ctx.lineTo(x * cell, (y + 1) * cell) }
      if (!(o & 2)) { ctx.moveTo((x + 1) * cell, y * cell); ctx.lineTo((x + 1) * cell, (y + 1) * cell) }
    }
    ctx.stroke();
    const cx = (m.ax + .5) * cell, cy = (m.ay + .5) * cell, rad = cell * .36;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#6d4aff'; ctx.stroke();
    if (pImgOk) { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rad - 2, 0, 7); ctx.clip(); ctx.drawImage(pImg, cx - rad, cy - rad, rad * 2, rad * 2); ctx.restore() }
    else { ctx.font = Math.floor(cell * .5) + 'px system-ui,"Apple Color Emoji","Noto Color Emoji",sans-serif'; ctx.fillText(glyph, cx, cy + 1) }
  }
  function animate() {
    cancelAnimationFrame(raf);
    (function step() {
      const dx = m.px - m.ax, dy = m.py - m.ay;
      if (Math.abs(dx) < .02 && Math.abs(dy) < .02) { m.ax = m.px; m.ay = m.py; draw(); return }
      m.ax += dx * .35; m.ay += dy * .35; draw(); raf = requestAnimationFrame(step);
    })();
  }
  function move(d) {
    if (!m || paused || won) return;
    const [dx, dy, bit] = DIRS[d]; if (!(m.open[m.py][m.px] & bit)) return;   // deewar ke paar nahi ja sakte
    if (!m.t0) { m.t0 = Date.now(); timer = setInterval(() => { if (!paused && !won) { m.secs = Math.floor((Date.now() - m.t0 - m.pausedMs0()) / 1000); updateHud() } }, 250) }
    m.px += dx; m.py += dy; m.moves++; Snd.step();
    const k = m.px + ',' + m.py; if (m.stars.has(k) && !m.got.has(k)) { m.got.add(k); Snd.star() }
    updateHud(); animate();
    if (m.px === m.ex && m.py === m.ey) win();
  }
  function win() {
    won = true; clearInterval(timer); m.secs = Math.floor((Date.now() - m.t0 - m.pausedMs0()) / 1000); updateHud();
    const got = m.got.size, stars = got >= m.total ? 3 : got >= Math.ceil(m.total / 2) ? 2 : 1;
    saveBest('maze', story.id, { stars, moves: m.moves, time: m.secs });
    ov.innerHTML = '<h2>🎉 Congratulations!</h2><p style="font-size:22px;font-weight:800">शाबाश!</p><p>' + '⭐'.repeat(stars) + '<br>' + got + '/' + m.total + ' तारे · ' + m.moves + ' कदम · ' + fmtTime(m.secs) + '</p><div class="bar" style="justify-content:center"><button class="primary" id="ovNext">➡️ अगला Level</button><button class="secondary" id="ovAgain">🔁 फिर खेलो</button></div>';
    ov.classList.remove('hidden'); ov.querySelector('#ovNext').onclick = nextLevel; ov.querySelector('#ovAgain').onclick = () => build();
    confetti(); Snd.clap();
  }
  function nextLevel() { level++; build() }
  root.querySelector('#mzNext').onclick = nextLevel;
  root.querySelector('#mzRestart').onclick = () => build();
  root.querySelector('#mzPause').onclick = () => {
    if (!m || won) return; paused = !paused;
    if (paused) { pausedAt = Date.now(); ov.innerHTML = '<h2>⏸ रुका हुआ</h2><button class="primary" id="ovResume">▶️ Resume</button>'; ov.classList.remove('hidden'); ov.querySelector('#ovResume').onclick = () => root.querySelector('#mzPause').click() }
    else { pausedTotal += Date.now() - pausedAt; pausedAt = 0; ov.classList.add('hidden') }
    root.querySelector('#mzPause').textContent = paused ? '▶️ Resume' : '⏸ Pause';
  };
  root.querySelectorAll('.dpad button').forEach(b => {
    b.addEventListener('pointerdown', e => { e.preventDefault(); move(b.dataset.d) });
    b.addEventListener('click', e => { if (e.detail === 0) move(b.dataset.d) });
  });
  const keyMap = { ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E', w: 'N', W: 'N', s: 'S', S: 'S', a: 'W', A: 'W', d: 'E', D: 'E' };
  const onKey = e => { const d = keyMap[e.key]; if (!d) return; if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; e.preventDefault(); move(d) };
  document.addEventListener('keydown', onKey);
  let sx0 = 0, sy0 = 0;
  cv.addEventListener('touchstart', e => { const t = e.changedTouches[0]; sx0 = t.clientX; sy0 = t.clientY }, { passive: true });
  cv.addEventListener('touchend', e => {
    const t = e.changedTouches[0], dx = t.clientX - sx0, dy = t.clientY - sy0;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N'));
  }, { passive: true });
  const onResize = () => { if (m) { sizeCanvas(); draw() } }; window.addEventListener('resize', onResize);
  cleanup = () => { document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); clearInterval(timer); cancelAnimationFrame(raf) };
  build();
}

/* =====================================================================
   2) MEMORY CARDS
   ===================================================================== */
const STOP = new Set(['लेकिन', 'क्योंकि', 'उसने', 'उसके', 'उसकी', 'अपनी', 'अपने', 'अपना', 'तभी', 'हमेशा', 'सभी', 'वहाँ', 'यहाँ', 'बहुत', 'उन्होंने', 'उनकी', 'उनके', 'इसलिए', 'अचानक', 'कुछ', 'कोई', 'उन्हें', 'मेरी', 'मेरा', 'तुम्हारी', 'तुम्हारा', 'हमारी', 'हमारा', 'करने', 'करना', 'होता', 'होती', 'जाता', 'जाती', 'वाला', 'वाली', 'वाले', 'लगा', 'लगी', 'लगे', 'रहता', 'रहती', 'रहते', 'बोला', 'बोली', 'पूछा', 'कहा', 'फिर', 'आखिर', 'जैसे', 'जिससे', 'जिसे', 'किसी', 'बाद', 'पहले', 'साथ', 'लिए', 'सीख']);
const ICONS = ['🌟', '🌈', '🍎', '🐠', '🦋', '🌻', '🚀', '🎈', '🐢', '🍓', '🐝', '🎵', '🌙', '🍌', '🐸', '⚽', '🧸', '🍉'];
function cleanWord(w) { return w.replace(/[।॥.,!?;:"“”‘’'()\[\]\-–—…]/g, '').trim() }
function storyWords(text) {
  const seen = new Set(), out = [];
  (text || '').replace(/\n?सीख\s*[:：][^\n]*/g, '').split(/\s+/).forEach(t => {
    if (/[-–—]/.test(t)) return; const w = cleanWord(t);
    if (w && /[ऀ-ॿ]/.test(w) && Array.from(w).length >= 4 && !STOP.has(w) && !seen.has(w)) { seen.add(w); out.push(w) }
  });
  return out;
}
function playMemory(story, root) {
  const CFG = { easy: { pairs: 3, cols: 3 }, medium: { pairs: 6, cols: 4 }, hard: { pairs: 10, cols: 5 } };
  let diff = (LS.get('rk_games_diff', {}).memory) || 'easy'; if (!CFG[diff]) diff = 'easy';
  let deck = [], first = null, lock = false, moves = 0, matches = 0, misses = 0, secs = 0, t0 = 0, timer = 0, generic = 0, pairsN = 0;
  root.innerHTML = `
    <div class="bar seg" id="mmDiff"></div>
    <div class="bar"><span class="stat" id="mmMoves">👣 Moves: 0</span><span class="stat" id="mmTime">⏱ 00:00</span><span class="stat" id="mmScore">⭐ Score: 0</span></div>
    <div class="stage" style="max-width:580px"><div class="mem" id="mmGrid"></div><div id="mmOv" class="overlay hidden"></div></div>
    <div class="muted" id="mmNote" style="text-align:center"></div>
    <div class="bar" style="justify-content:center"><button class="primary" id="mmAgain">🔁 Play Again</button><button class="secondary" id="mmSound"></button></div>`;
  const grid = root.querySelector('#mmGrid'), ov = root.querySelector('#mmOv'), seg = root.querySelector('#mmDiff');
  soundBtn(root.querySelector('#mmSound'));
  [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].forEach(([k, l]) => {
    const b = document.createElement('button'); b.textContent = l; b.dataset.k = k; b.className = k === diff ? 'on' : '';
    b.onclick = () => { diff = k; const d = LS.get('rk_games_diff', {}); d.memory = k; LS.set('rk_games_diff', d); [...seg.children].forEach(x => x.classList.toggle('on', x.dataset.k === k)); newGame() };
    seg.appendChild(b);
  });
  const score = () => Math.max(0, matches * 100 - misses * 10);
  function hud() {
    root.querySelector('#mmMoves').textContent = '👣 Moves: ' + moves; root.querySelector('#mmTime').textContent = '⏱ ' + fmtTime(secs); root.querySelector('#mmScore').textContent = '⭐ Score: ' + score();
  }
  function buildItems(n) {
    const items = []; generic = 0;
    if (story.image) items.push({ key: 'img', type: 'image', src: story.image });                     // isi kahani ki apni photo
    shuffle(storyWords(story.text)).forEach(w => { if (items.length < n) items.push({ key: 'w:' + w, type: 'word', text: w }) });   // isi kahani ke shabd
    shuffle(ICONS).forEach(ic => { if (items.length < n) { items.push({ key: 'i:' + ic, type: 'icon', text: ic }); generic++ } });   // surakshit aam icon
    return items.slice(0, n);
  }
  function faceHTML(it) {
    if (it.type === 'image') return '<img alt="" src="' + esc(it.src) + '" onerror="this.replaceWith(document.createTextNode(\'🖼️\'))">';
    return esc(it.text);
  }
  function newGame() {
    clearInterval(timer); first = null; lock = false; moves = 0; matches = 0; misses = 0; secs = 0; t0 = 0; ov.classList.add('hidden');
    const { pairs, cols } = CFG[diff]; pairsN = pairs;
    const items = buildItems(pairs);
    deck = shuffle(items.flatMap((it, i) => [{ it, id: i + 'a' }, { it, id: i + 'b' }]));
    grid.style.gridTemplateColumns = 'repeat(' + cols + ',minmax(0,1fr))'; grid.textContent = '';
    deck.forEach((c, idx) => {
      const b = document.createElement('button'); b.className = 'card'; b.dataset.key = c.it.key; b.dataset.idx = idx; b.setAttribute('aria-label', 'कार्ड ' + (idx + 1));
      b.innerHTML = '<div class="in"><div class="b">❓</div><div class="f' + (c.it.type === 'word' ? ' word' : '') + '">' + faceHTML(c.it) + '</div></div>';
      b.onclick = () => flip(b, c); grid.appendChild(b);
    });
    root.querySelector('#mmNote').textContent = generic ? 'ℹ️ इस कहानी में पर्याप्त शब्द/चित्र नहीं थे, इसलिए ' + generic + ' जोड़ी सामान्य आइकन से बनी हैं।' : '';
    hud();
  }
  function flip(b, c) {
    if (lock || b.classList.contains('flip') || b.classList.contains('done')) return;
    if (!t0) { t0 = Date.now(); timer = setInterval(() => { secs = Math.floor((Date.now() - t0) / 1000); hud() }, 250) }
    b.classList.add('flip'); Snd.flip();
    if (!first) { first = { b, c }; return }
    moves++; const a = first; first = null; lock = true;
    if (a.c.it.key === c.it.key) {
      matches++; setTimeout(() => { a.b.classList.add('done'); b.classList.add('done'); a.b.classList.remove('flip'); b.classList.remove('flip'); lock = false; Snd.match(); hud(); if (matches === pairsN) win() }, 350);
    } else {
      misses++; setTimeout(() => { a.b.classList.remove('flip'); b.classList.remove('flip'); lock = false; Snd.miss() }, 800);
    }
    hud();
  }
  function win() {
    clearInterval(timer); secs = Math.floor((Date.now() - t0) / 1000); hud();
    const ratio = moves / pairsN, stars = ratio <= 1.6 ? 3 : ratio <= 2.6 ? 2 : 1;
    saveBest('memory', story.id, { stars, moves, time: secs, score: score() });
    ov.innerHTML = '<h2>🎉 शाबाश!</h2><p style="font-size:24px">' + '⭐'.repeat(stars) + '</p><p>' + moves + ' Moves · ' + fmtTime(secs) + ' · Score ' + score() + '</p><button class="primary" id="ovAgain">🔁 Play Again</button>';
    ov.classList.remove('hidden'); ov.querySelector('#ovAgain').onclick = newGame; confetti(); Snd.clap();
  }
  root.querySelector('#mmAgain').onclick = newGame;
  cleanup = () => clearInterval(timer);
  newGame();
}

/* =====================================================================
   3) RANG BHARO (Coloring)
   ===================================================================== */
const PALETTE = ['#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#00c7be', '#32ade6', '#0a63d6', '#7d4cdb', '#ff6fa8', '#8b5a2b', '#222222', '#ffffff'];
function drawGeneric(kind) {
  const W = 600, H = 450, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.strokeStyle = '#000'; x.lineWidth = 6; x.lineJoin = 'round'; x.lineCap = 'round';
  const poly = pts => { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.stroke() };
  if (kind === 'sun') {
    x.beginPath(); x.arc(300, 225, 90, 0, 7); x.stroke();
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, a1 = a - .13, a2 = a + .13; poly([[300 + Math.cos(a1) * 115, 225 + Math.sin(a1) * 115], [300 + Math.cos(a) * 190, 225 + Math.sin(a) * 190], [300 + Math.cos(a2) * 115, 225 + Math.sin(a2) * 115]]) }
    x.beginPath(); x.arc(270, 205, 9, 0, 7); x.stroke(); x.beginPath(); x.arc(330, 205, 9, 0, 7); x.stroke(); x.beginPath(); x.arc(300, 235, 40, .15 * Math.PI, .85 * Math.PI); x.stroke();
  } else if (kind === 'house') {
    poly([[130, 400], [130, 220], [470, 220], [470, 400]]); poly([[100, 225], [300, 70], [500, 225]]);
    poly([[270, 400], [270, 290], [340, 290], [340, 400]]); poly([[170, 260], [170, 320], [230, 320], [230, 260]]); poly([[370, 260], [370, 320], [430, 320], [430, 260]]);
    poly([[380, 90], [380, 160], [420, 190], [420, 90]]);
  } else if (kind === 'tree') {
    poly([[260, 420], [270, 280], [330, 280], [340, 420]]);
    [[300, 200, 110], [210, 260, 80], [390, 260, 80], [250, 130, 70], [350, 130, 70]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.stroke() });
    x.fillStyle = '#fff'; [[300, 200, 108], [210, 260, 78], [390, 260, 78]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill() });
    x.beginPath(); x.arc(300, 200, 110, 0, 7); x.stroke();
  } else {  // fish
    x.beginPath(); x.ellipse(280, 225, 170, 100, 0, 0, 7); x.stroke();
    poly([[440, 225], [560, 130], [560, 320]]); x.beginPath(); x.arc(190, 200, 14, 0, 7); x.stroke();
    x.beginPath(); x.arc(205, 255, 40, .1 * Math.PI, .9 * Math.PI); x.stroke();
    [[270, 160], [330, 160], [270, 290], [330, 290]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 28, 0, 7); x.stroke() });
  }
  return c;
}
const GENERIC = [['sun', '☀️ सूरज'], ['house', '🏠 घर'], ['tree', '🌳 पेड़'], ['fish', '🐟 मछली']];

function loadImg(src, cors) {
  return new Promise(res => { const i = new Image(); if (cors) i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src });
}
// Photo se kaali rekhaon wali line-art (Sobel edge). Asli line-art nahi: andaza hai.
function edgeMask(img, sens) {
  const s = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(16, Math.round(img.naturalWidth * s)), h = Math.max(16, Math.round(img.naturalHeight * s));
  const t = document.createElement('canvas'); t.width = w; t.height = h; const x = t.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
  const b = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) { let sum = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) sum += g[(y + j) * w + xx + i]; b[y * w + xx] = sum / 9 }
  const mag = new Float32Array(w * h), hist = new Uint32Array(512);
  for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) {
    const i = y * w + xx, gx = -b[i - w - 1] - 2 * b[i - 1] - b[i + w - 1] + b[i - w + 1] + 2 * b[i + 1] + b[i + w + 1], gy = -b[i - w - 1] - 2 * b[i - w] - b[i - w + 1] + b[i + w - 1] + 2 * b[i + w] + b[i + w + 1];
    const m = Math.sqrt(gx * gx + gy * gy); mag[i] = m; hist[Math.min(511, m | 0)]++;
  }
  const p = .93 - sens * .18, target = p * (w - 2) * (h - 2); let acc = 0, thr = 0; for (let i = 0; i < 512; i++) { acc += hist[i]; if (acc >= target) { thr = i; break } }
  thr = Math.max(22, thr);
  const line = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) if (mag[i] > thr) line[i] = 1;
  const out = new Uint8Array(w * h);     // 3x3 dilate: rekha thodi moti
  for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) { const i = y * w + xx; if (line[i] || line[i - 1] || line[i + 1] || line[i - w] || line[i + w]) out[i] = 1 }
  return { w, h, alpha: out.map(v => v * 255), mask: out };
}
function artFromCanvas(c) {   // saaf kaali-safed drawing (generic ya admin ki di hui line-art) se mask
  const w = c.width, h = c.height, d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data, alpha = new Uint8Array(w * h), mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { const lum = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2], a = d[i * 4 + 3] < 128 ? 0 : 255 - lum; alpha[i] = a; mask[i] = a > 85 ? 1 : 0 }
  return { w, h, alpha, mask };
}
function playColor(story, root) {
  root.innerHTML = `
    <div id="clInfo" class="notice"></div>
    <div id="clMain" class="hidden">
      <div class="colorwrap"><canvas id="clCv"></canvas></div>
      <div class="palette" id="clPal"></div>
      <div class="bar">
        <span class="seg"><button id="tFill" class="on">🪣 रंग भरो</button><button id="tBrush">🖌️ Brush</button><button id="tErase">🧽 Eraser</button></span>
        <label class="inl">Brush <input type="range" id="clSize" min="4" max="48" value="16"></label>
      </div>
      <div class="bar"><label class="inl">अपना रंग <input type="color" id="clCustom" value="#ff6fa8"></label><span id="clSensWrap" class="hidden"><label class="inl">रेखाएँ <input type="range" id="clSens" min="0" max="100" value="50"></label></span></div>
      <div class="bar" style="justify-content:center"><button class="secondary" id="clUndo">↩️ Undo</button><button class="secondary" id="clReset">🗑️ Reset</button><button class="primary" id="clSave">⬇️ PNG Download</button><button class="secondary" id="clGen">🎨 सामान्य चित्र</button></div>
    </div>`;
  const info = root.querySelector('#clInfo'), main = root.querySelector('#clMain'), cv = root.querySelector('#clCv'), ctx = cv.getContext('2d');
  let art = null, lineC = null, colorC = null, cctx = null, tool = 'fill', color = PALETTE[0], undo = [], mode = '', photoImg = null, drawing = false, last = null;
  PALETTE.forEach((c, i) => { const b = document.createElement('button'); b.className = 'sw' + (i === 0 ? ' on' : ''); b.style.background = c; b.setAttribute('aria-label', 'रंग ' + (i + 1)); b.onclick = () => setColor(c, b); root.querySelector('#clPal').appendChild(b) });
  function setColor(c, btn) { color = c; root.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === btn)); if (tool === 'erase') setTool('brush') }
  root.querySelector('#clCustom').oninput = e => setColor(e.target.value, null);
  const tools = { fill: root.querySelector('#tFill'), brush: root.querySelector('#tBrush'), erase: root.querySelector('#tErase') };
  function setTool(t) { tool = t; Object.entries(tools).forEach(([k, b]) => b.classList.toggle('on', k === t)) }
  Object.entries(tools).forEach(([k, b]) => b.onclick = () => setTool(k));
  function setArt(a) {
    art = a; cv.width = a.w; cv.height = a.h; cv.style.width = Math.min(a.w, root.clientWidth ? root.clientWidth - 24 : a.w, 640) + 'px'; cv.style.height = 'auto';
    lineC = document.createElement('canvas'); lineC.width = a.w; lineC.height = a.h; const lc = lineC.getContext('2d'), id = lc.createImageData(a.w, a.h);
    for (let i = 0; i < a.w * a.h; i++) { id.data[i * 4 + 3] = a.alpha[i] }   // rgb=0 (kaala), alpha = rekha
    lc.putImageData(id, 0, 0);
    colorC = document.createElement('canvas'); colorC.width = a.w; colorC.height = a.h; cctx = colorC.getContext('2d', { willReadFrequently: true });
    undo = []; redraw(); main.classList.remove('hidden');
    try { main.scrollIntoView({ block: 'nearest' }) } catch (e) { }
  }
  function redraw() { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(colorC, 0, 0); ctx.drawImage(lineC, 0, 0) }
  function pushUndo() { undo.push(cctx.getImageData(0, 0, colorC.width, colorC.height)); if (undo.length > 25) undo.shift() }
  function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
  function floodFill(px, py) {
    const { w, h, mask } = art; px |= 0; py |= 0;
    if (px < 0 || py < 0 || px >= w || py >= h) return false;
    if (mask[py * w + px]) {   // rekha par daba diya: paas ka khaali pixel dhoondho
      let f = false; for (let r = 1; r <= 4 && !f; r++) for (let j = -r; j <= r && !f; j++) for (let i = -r; i <= r; i++) { const nx = px + i, ny = py + j; if (nx >= 0 && ny >= 0 && nx < w && ny < h && !mask[ny * w + nx]) { px = nx; py = ny; f = true; break } }
      if (!f) return false;
    }
    const img = cctx.getImageData(0, 0, w, h), d = img.data, [r, g, b] = hex(color), seen = new Uint8Array(w * h), st = [px, py];
    while (st.length) {
      const y = st.pop(), x0 = st.pop(); let x = x0;
      while (x >= 0 && !mask[y * w + x] && !seen[y * w + x]) x--; x++;
      let up = false, dn = false;
      while (x < w && !mask[y * w + x] && !seen[y * w + x]) {
        const i = y * w + x; seen[i] = 1; d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
        if (y > 0) { const u = !mask[i - w] && !seen[i - w]; if (u && !up) { st.push(x, y - 1); up = true } else if (!u) up = false }
        if (y < h - 1) { const q = !mask[i + w] && !seen[i + w]; if (q && !dn) { st.push(x, y + 1); dn = true } else if (!q) dn = false }
        x++;
      }
    }
    cctx.putImageData(img, 0, 0); return true;
  }
  function pt(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height] }
  cv.addEventListener('pointerdown', e => {
    if (!art) return; e.preventDefault(); const [x, y] = pt(e);
    if (tool === 'fill') { pushUndo(); floodFill(x, y); redraw(); return }
    pushUndo(); drawing = true; last = [x, y]; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); stroke(x, y, x, y);
  });
  cv.addEventListener('pointermove', e => { if (!drawing) return; const [x, y] = pt(e); stroke(last[0], last[1], x, y); last = [x, y] });
  const end = () => { drawing = false; last = null }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  function stroke(x1, y1, x2, y2) {
    const size = +root.querySelector('#clSize').value * (cv.width / Math.max(300, cv.getBoundingClientRect().width || cv.width));
    cctx.save(); cctx.lineCap = 'round'; cctx.lineJoin = 'round'; cctx.lineWidth = size;
    if (tool === 'erase') { cctx.globalCompositeOperation = 'destination-out'; cctx.strokeStyle = '#000' } else cctx.strokeStyle = color;
    cctx.beginPath(); cctx.moveTo(x1, y1); cctx.lineTo(x2 + .01, y2 + .01); cctx.stroke(); cctx.restore(); redraw();
  }
  root.querySelector('#clUndo').onclick = () => { if (!undo.length) return; cctx.putImageData(undo.pop(), 0, 0); redraw() };
  root.querySelector('#clReset').onclick = () => { if (!art) return; pushUndo(); cctx.clearRect(0, 0, colorC.width, colorC.height); redraw() };
  root.querySelector('#clSave').onclick = () => {
    if (!art) return; const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height; const x = t.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, t.width, t.height); x.drawImage(colorC, 0, 0); x.drawImage(lineC, 0, 0);
    try {
      t.toBlob(b => { if (!b) { alert('इस ब्राउज़र में डाउनलोड नहीं हो पाया। तस्वीर को लंबा दबाकर सेव करें।'); return } const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'rang-bharo.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); saveBest('color', story.id, { stars: 1, moves: 0 }) }, 'image/png');
    } catch (e) { alert('इस ब्राउज़र में डाउनलोड नहीं हो पाया।') }
  };
  const sens = root.querySelector('#clSens');
  sens.onchange = () => { if (mode === 'photo' && photoImg) setArt(edgeMask(photoImg, sens.value / 100)) };
  function showGeneric() {
    info.className = 'notice'; info.innerHTML = 'ℹ️ <b>यह सामान्य चित्र है, इस कहानी का नहीं।</b> चित्र बदलने के लिए नीचे चुनो।<div class="bar" id="clGenBar"></div>';
    GENERIC.forEach(([k, l]) => { const b = document.createElement('button'); b.className = 'secondary'; b.textContent = l; b.onclick = () => { mode = 'generic'; sensHide(); setArt(artFromCanvas(drawGeneric(k))) }; info.querySelector('#clGenBar').appendChild(b) });
    mode = 'generic'; sensHide(); setArt(artFromCanvas(drawGeneric('sun')));
  }
  function sensHide() { root.querySelector('#clSensWrap').classList.toggle('hidden', mode !== 'photo') }
  root.querySelector('#clGen').onclick = showGeneric;
  (async () => {
    info.textContent = '⏳ तस्वीर तैयार हो रही है…';
    // 1) Admin ki di hui saaf line-art (optional): game-art/<kahani-id>-line.png
    const given = await loadImg('game-art/' + encodeURIComponent(story.id) + '-line.png', false);
    if (given) {
      const c = document.createElement('canvas'); const s = Math.min(1, 600 / Math.max(given.naturalWidth, given.naturalHeight)); c.width = Math.round(given.naturalWidth * s); c.height = Math.round(given.naturalHeight * s);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(given, 0, 0, c.width, c.height);
      mode = 'given'; sensHide(); info.className = 'notice'; info.textContent = '🖼️ इस कहानी की Line Art — रंग भरो!'; setArt(artFromCanvas(c)); return;
    }
    // 2) Kahani ki photo se andaza
    if (story.image) {
      const img = await loadImg(story.image, true);
      if (img) {
        try { photoImg = img; mode = 'photo'; const a = edgeMask(img, .5); sensHide(); info.className = 'notice'; info.textContent = '📷 कहानी की फोटो से बना अंदाज़ी रेखाचित्र (असली line-art नहीं)। रेखाएँ कम/ज़्यादा करने के लिए “रेखाएँ” स्लाइडर चलाओ।'; setArt(a); return }
        catch (e) { console.error(e) }
      }
      info.className = 'notice'; info.innerHTML = '⚠️ इस कहानी की फोटो से रेखाचित्र नहीं बन पाया (फोटो सुरक्षा कारणों से पढ़ी नहीं जा सकी)।'; showGenericPrompt(); return;
    }
    info.className = 'notice'; info.innerHTML = '🖼️ <b>इस कहानी की Coloring Picture अभी उपलब्ध नहीं है।</b> चित्र जल्द उपलब्ध होगा।'; showGenericPrompt();
  })();
  function showGenericPrompt() {
    const b = document.createElement('button'); b.className = 'primary'; b.style.marginTop = '8px'; b.textContent = '🎨 सामान्य चित्र में रंग भरो (कहानी का नहीं)'; b.onclick = showGeneric; info.appendChild(document.createElement('br')); info.appendChild(b);
  }
  cleanup = () => { drawing = false };
}

/* ---------- Start ---------- */
if (TEST) window.__rk = { genMaze, mazeSolve, hash, mulberry, ALGOS, edgeMask, publishState, storyWords };
document.querySelectorAll('.gamecard').forEach(b => b.onclick = () => { location.hash = '#' + b.dataset.game });
window.addEventListener('hashchange', route);
(async () => {
  $('hub').classList.remove('hidden'); crumbs([['📚 सभी कहानियाँ', './index.html']]);
  await loadStories(); setStatus(); route();
})();
})();
