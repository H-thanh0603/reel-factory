// Renders one vertical video (1080x1920) from spec.json produced by tts_batch.py.
// Usage: node pipeline/render.js <specPath> [rootDir]
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FPS = 30;
const W = 1080, H = 1920;
const EXE = '/usr/bin/google-chrome';

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const ROOT = path.resolve(process.argv[3] || path.join(__dirname, '..'));
const OUT = path.join(ROOT, 'output', spec.id);
const FRAMES = path.join(OUT, 'frames');

const THEMES = {
  'neon-dark':      { bg:'#05070d', fg:'#f1f5f9', sub:'#94a3b8', a1:'#22d3ee', a2:'#e879f9', font:'Be Vietnam Pro', decor:['grid','blobs','vignette'] },
  'paper':          { bg:'#f5f1e8', fg:'#181511', sub:'#6b5d4f', a1:'#c2410c', a2:'#1d4ed8', font:'Noto Serif', decor:['paperlines','vignette-light'] },
  'gradient-pop':   { bg:'#2e1065', fg:'#ffffff', sub:'#e9d5ff', a1:'#fde047', a2:'#fb7185', font:'Be Vietnam Pro', decor:['gradient','blobs','grain'] },
  'terminal':       { bg:'#060a06', fg:'#d1fae5', sub:'#84cc16', a1:'#4ade80', a2:'#a3e635', font:'Noto Sans Mono', decor:['grid','scanlines','vignette'] },
  'minimal-light':  { bg:'#ffffff', fg:'#111111', sub:'#6b7280', a1:'#2563eb', a2:'#dc2626', font:'Be Vietnam Pro', decor:['dots'] },
  'retro-vhs':      { bg:'#1e1b4b', fg:'#f5f3ff', sub:'#a5b4fc', a1:'#f0abfc', a2:'#67e8f9', font:'Be Vietnam Pro', decor:['scanlines','blobs','vignette'] },
  'corporate-blue': { bg:'#081a33', fg:'#eff6ff', sub:'#93c5fd', a1:'#38bdf8', a2:'#fbbf24', font:'Be Vietnam Pro', decor:['grid','sweep','vignette'] },
  'sunset-warm':    { bg:'#fdf6ec', fg:'#292524', sub:'#78716c', a1:'#ea580c', a2:'#0d9488', font:'Noto Serif', decor:['blobs-light','vignette-light'] },
};
const TH = THEMES[spec.theme] || THEMES['neon-dark'];
const dark = !['paper', 'minimal-light', 'sunset-warm'].includes(spec.theme);

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Per-theme STRUCTURAL css — each theme gets its own layout language
const THEME_CSS = {
  'terminal': `
    .t-terminal .beat { align-items:flex-start; text-align:left; padding-left:30px; }
    .t-terminal #cat { border:none; padding:0; }
    .t-terminal .big { text-shadow:0 0 26px ${TH.a1}66; }
    .t-terminal .rule { display:none; }
    .t-terminal .sub2 { border-left:4px solid ${TH.a1}; padding-left:22px; }
    .t-terminal #prog { display:none; }
    .t-terminal #prompt { display:block; position:absolute; top:130px; left:110px; font-size:30px; color:${TH.a2}; z-index:20; }
    .t-terminal #pct { display:block; position:absolute; top:64px; right:80px; font-size:34px; color:${TH.a1}; z-index:20; }
    .t-terminal #cap { left:50%; transform:translateX(-50%); width:max-content; max-width:900px; background:${TH.a1}; color:#060a06; -webkit-text-stroke:0; padding:10px 28px; border-radius:10px; font-size:52px; }`,
  'paper': `
    .t-paper .beat { align-items:flex-start; text-align:left; padding-left:26px; }
    .t-paper #cat { border:none; padding:0; letter-spacing:10px; }
    .t-paper .big .acc { background:linear-gradient(transparent 60%, ${TH.a1}55 60%); color:inherit; }
    .t-paper .rule { display:none; }
    .t-paper .sub2::before { content:'— '; color:${TH.a1}; }
    .t-paper .beat::before { content:''; position:absolute; left:-34px; top:33%; bottom:33%; width:10px; border-radius:6px; background:linear-gradient(${TH.a1},${TH.a2}); }
    .t-paper #cap { color:#111; -webkit-text-stroke:7px #fff; }`,
  'gradient-pop': `
    .t-gradient-pop .beat .big { transform:rotate(-2deg); text-shadow:10px 10px 0 rgba(0,0,0,.35); }
    .t-gradient-pop #cat { background:${TH.a1}; color:#1e1b4b; border:none; transform:rotate(-2deg); font-weight:900; }
    .t-gradient-pop .rule { height:14px; transform:rotate(-2deg); }
    .t-gradient-pop .sub2 { color:#fff; }
    .t-gradient-pop #bggrad::before, .t-gradient-pop #bggrad::after { content:''; position:absolute; left:-70%; width:240%; height:380px; background:rgba(255,255,255,.08); transform:rotate(-11deg); }
    .t-gradient-pop #bggrad::before { top:32%; }
    .t-gradient-pop #bggrad::after { top:66%; background:rgba(0,0,0,.12); }
    .t-gradient-pop #cap { color:#fff; -webkit-text-stroke:9px #000; }`,
  'minimal-light': `
    .t-minimal-light .beat { justify-content:flex-end; align-items:flex-start; text-align:left; padding-bottom:430px; }
    .t-minimal-light #cat { border:none; padding:0; color:#9ca3af; }
    .t-minimal-light .rule { background:${TH.a1}; }
    .t-minimal-light #prog { height:4px; background:${TH.a1}; }
    .t-minimal-light #cap { color:#111; -webkit-text-stroke:7px #fff; }`,
  'retro-vhs': `
    .t-retro-vhs .big { text-shadow:5px 0 #f43f5e77, -5px 0 #22d3ee77; }
    .t-retro-vhs #cat { border-color:#f0abfc; color:#f0abfc; }
    .t-retro-vhs #stage { animation:jit .4s steps(2) infinite; }
    @keyframes jit { 0%{transform:translate(0,0)} 50%{transform:translate(2px,-1.5px)} 100%{transform:translate(-1.5px,1px)} }
    .t-retro-vhs #frame { display:block; position:absolute; inset:36px; border:3px solid ${TH.a1}55; pointer-events:none; z-index:30; }
    .t-retro-vhs #rec { display:block; position:absolute; top:70px; left:80px; font-size:30px; font-weight:700; color:#f43f5e; z-index:20; letter-spacing:2px; }`,
  'corporate-blue': `
    .t-corporate-blue .big { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14); border-left:12px solid ${TH.a1}; border-radius:30px; padding:60px 55px; text-align:left; }
    .t-corporate-blue .sub2 { background:rgba(255,255,255,.06); border-radius:0 0 30px 30px; margin-top:0; padding:0 55px 40px; text-align:left; margin-left:1.5px; width:calc(100% - 3px); }
    .t-corporate-blue .rule { display:none; }
    .t-corporate-blue #cat { left:50%; transform:translateX(-50%); }
    .t-corporate-blue #cap { color:#fff; -webkit-text-stroke:10px #000; }`,
  'sunset-warm': `
    .t-sunset-warm .beat::before { content:'\\201C'; position:absolute; top:21%; left:5%; font-size:300px; color:${TH.a1}40; font-family:Georgia,serif; line-height:1; }
    .t-sunset-warm #cat { border:none; padding:0; letter-spacing:8px; }
    .t-sunset-warm .rule { background:${TH.a1}; }
    .t-sunset-warm #cap { color:#292524; -webkit-text-stroke:7px #fff; }`,
  'neon-dark': `
    .t-neon-dark .big { text-shadow:0 0 60px ${TH.a1}44; }
    .t-neon-dark #cap { color:#fff; -webkit-text-stroke:10px #000; }`,
};

const beatsJS = JSON.stringify(spec.beats.map(b => ({ i: b.i, offset: b.offset, dur: b.dur, show: b.show, sub: b.sub || '', stat: b.stat || null })));
const capsJS = JSON.stringify(spec.captions);

const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@font-face { font-family:'Be Vietnam Pro'; src:url('file://${ROOT}/assets/fonts/BeVietnamPro-Regular.ttf'); font-weight:400; }
@font-face { font-family:'Be Vietnam Pro'; src:url('file://${ROOT}/assets/fonts/BeVietnamPro-Medium.ttf'); font-weight:500; }
@font-face { font-family:'Be Vietnam Pro'; src:url('file://${ROOT}/assets/fonts/BeVietnamPro-SemiBold.ttf'); font-weight:600; }
@font-face { font-family:'Be Vietnam Pro'; src:url('file://${ROOT}/assets/fonts/BeVietnamPro-Bold.ttf'); font-weight:700; }
@font-face { font-family:'Be Vietnam Pro'; src:url('file://${ROOT}/assets/fonts/BeVietnamPro-ExtraBold.ttf'); font-weight:800; }
@font-face { font-family:'Be Vietnam Pro'; src:url('file://${ROOT}/assets/fonts/BeVietnamPro-Black.ttf'); font-weight:900; }
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:${W}px; height:${H}px; overflow:hidden; background:${TH.bg}; }
body { font-family:'${TH.font}','Noto Sans','DejaVu Sans',sans-serif; color:${TH.fg}; }
#stage { position:relative; width:${W}px; height:${H}px; overflow:hidden; }
.decor { position:absolute; inset:0; pointer-events:none; }
.grid { background-image:linear-gradient(${dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.09)'} 1px, transparent 1px), linear-gradient(90deg, ${dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.09)'} 1px, transparent 1px); background-size:72px 72px; }
.dots { background-image:radial-gradient(rgba(0,0,0,.14) 2.5px, transparent 2.5px); background-size:64px 64px; }
.blob { position:absolute; border-radius:50%; filter:blur(110px); }
.blob-light { filter:blur(90px); opacity:.5; }
.scanlines { background:repeating-linear-gradient(0deg, rgba(0,0,0,.25) 0 2px, transparent 2px 5px); }
.vignette { background:radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.5) 100%); }
.vignette-light { background:radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,.1) 100%); }
.grain { opacity:.06; background-image:radial-gradient(rgba(255,255,255,.9) .5px, transparent .5px); background-size:9px 9px; }
#bggrad { background:linear-gradient(160deg, #4c1d95 0%, #9d174d 45%, #9a3412 100%); background-size:160% 160%; }
#prog { position:absolute; top:0; left:0; height:10px; width:0; background:linear-gradient(90deg, ${TH.a1}, ${TH.a2}); z-index:50; }
#cat { position:absolute; top:64px; left:80px; font-size:29px; font-weight:700; letter-spacing:6px; text-transform:uppercase;
  color:${TH.a1}; padding:12px 30px; border:2px solid ${TH.a1}77; border-radius:999px; opacity:.94; z-index:20; }
#brand { position:absolute; top:70px; right:80px; font-size:27px; font-weight:600; color:${TH.sub}; z-index:20; }
.beat { position:absolute; left:80px; right:80px; top:0; bottom:0; display:flex; flex-direction:column;
  justify-content:center; align-items:center; text-align:center; opacity:0; will-change:transform,opacity; }
.beat .num { font-size:44px; font-weight:800; color:${TH.a1}; letter-spacing:3px; margin-bottom:26px; }
.beat .big { font-weight:900; line-height:1.18; letter-spacing:-1px; white-space:pre-wrap; }
.beat .big .acc { font-style:normal; color:${TH.a1}; }
.beat .sub2 { margin-top:38px; font-size:40px; font-weight:500; color:${TH.sub}; line-height:1.4; }
.beat .rule { width:0; height:8px; margin-top:44px; border-radius:4px; background:linear-gradient(90deg, ${TH.a1}, ${TH.a2}); }
.listwrap { display:flex; flex-direction:column; gap:26px; width:100%; }
.item { display:flex; align-items:center; gap:30px; padding:34px 38px; border-radius:26px; text-align:left;
  background:${dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.035)'}; border:1.5px solid ${dark ? 'rgba(255,255,255,.13)' : 'rgba(0,0,0,.12)'}; opacity:0; }
.item .n { min-width:76px; height:76px; border-radius:20px; display:flex; align-items:center; justify-content:center;
  font-size:36px; font-weight:900; color:${TH.bg}; background:linear-gradient(135deg, ${TH.a1}, ${TH.a2}); }
.item .t { font-size:39px; font-weight:700; line-height:1.28; }
.item .t .acc { font-style:normal; color:${TH.a1}; }
#cap { position:absolute; left:60px; right:60px; top:1500px; text-align:center; font-weight:700; z-index:40;
  font-family:'Be Vietnam Pro','Noto Sans',sans-serif; font-size:56px; line-height:1.28; color:#fff;
  -webkit-text-stroke:11px #000; paint-order:stroke fill; }
.cta-ring { margin-bottom:46px; width:200px; height:200px; border-radius:50%;
  display:flex; align-items:center; justify-content:center; font-size:88px; color:${TH.bg};
  background:linear-gradient(135deg, ${TH.a1}, ${TH.a2}); box-shadow:0 0 90px ${TH.a1}66; }
.cta-pill { margin-top:48px; display:inline-block; padding:26px 60px; border-radius:999px; font-size:40px; font-weight:800;
  color:${TH.bg}; background:linear-gradient(90deg, ${TH.a1}, ${TH.a2}); }
#prompt, #pct, #rec, #frame { display:none; }
${THEME_CSS[spec.theme] || ''}
</style></head><body class="t-${spec.theme}">
<div id="stage">
  <div class="decor" id="bggrad" style="display:none"></div>
  <div class="decor grid" id="d-grid" style="display:none"></div>
  <div class="decor" id="d-blobs" style="display:none"></div>
  <div class="decor" id="d-sweep" style="display:none"></div>
  <div class="decor scanlines" id="d-scan" style="display:none"></div>
  <div class="decor dots" id="d-dots" style="display:none"></div>
  <div class="decor grain" id="d-grain" style="display:none"></div>
  <div class="decor vignette" id="d-vig" style="display:none"></div>
  <div id="prog"></div>
  <div id="cat">${esc(spec.category || '')}</div>
  <div id="brand">${esc(spec.handle || '')}</div>
  <div id="prompt">$ vietreel --topic="${esc((spec.category || '').toLowerCase())}"</div>
  <div id="pct">0%</div>
  <div id="rec">● REC <span id="tc">00:00</span></div>
  <div id="frame"></div>
  <div id="beats"></div>
  <div id="cap"></div>
</div>
<script>
const W = 1080, H = 1920;
const BEATS = ${beatsJS};
const CAPS = ${capsJS};
const TOTAL = ${spec.total};
const THEME = ${JSON.stringify(spec.theme)};
const LAYOUT = ${JSON.stringify(spec.layout)};
const ACC = '${TH.a1}';

const escH = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function fmtShow(s) {
  return escH(s).split('*').map((p, i) => i % 2 ? '<em class="acc">' + p + '</em>' : p).join('');
}
function bigSize(s) {
  const plain = s.replace(/\\*/g, '');
  if (plain.length <= 16) return 'font-size:116px';
  if (plain.length <= 30) return 'font-size:90px';
  if (plain.length <= 48) return 'font-size:72px';
  if (plain.length <= 72) return 'font-size:58px';
  return 'font-size:48px';
}

let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pb = document.getElementById('d-blobs');
const NBL = THEME === 'sunset-warm' ? 3 : 3;
const blobEls = [];
for (let i = 0; i < NBL; i++) {
  const d = document.createElement('div');
  const sz = (16 + rnd() * 18) * 10;
  d.className = 'blob' + (THEME === 'sunset-warm' ? ' blob-light' : '');
  d.style.width = d.style.height = sz + 'px';
  d.style.background = [ACC, '${TH.a2}', '${TH.a1}'][i % 3];
  d.style.opacity = .7;
  d._px = rnd(); d._py = rnd(); d._ph = rnd() * 6.28; d._sz = sz;
  pb.appendChild(d); blobEls.push(d);
}
if (THEME === 'gradient-pop') document.getElementById('bggrad').style.display = 'block';
if (THEME === 'retro-vhs') { pb.style.opacity = .8; }

const sweep = document.getElementById('d-sweep');
sweep.style.background = 'linear-gradient(105deg, transparent 30%, ${TH.fg}12 45%, transparent 60%)';
sweep.style.backgroundSize = '300% 100%';

// decor toggles per theme
const onId = id => { const el = document.getElementById(id); if (el) el.style.display = 'block'; };
const DECOR = ${JSON.stringify(TH.decor)};
DECOR.forEach(name => {
  if (name === 'grid') onId('d-grid');
  if (name === 'blobs' || name === 'blobs-light') onId('d-blobs');
  if (name === 'scanlines') onId('d-scan');
  if (name === 'dots') onId('d-dots');
  if (name === 'vignette') onId('d-vig');
  if (name === 'vignette-light') { const v = document.getElementById('d-vig'); if (v) { v.style.display = 'block'; v.style.background = 'radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,.1) 100%)'; } }
  if (name === 'grain') onId('d-grain');
  if (name === 'sweep') onId('d-sweep');
  if (name === 'paperlines') document.body.style.backgroundImage = 'repeating-linear-gradient(0deg, transparent 0 78px, rgba(24,21,17,.07) 78px 79px)';
});

// ---- build beats ----
const beatsHost = document.getElementById('beats');
BEATS.forEach((b, idx) => {
  const el = document.createElement('div'); el.className = 'beat';
  const isCta = idx === BEATS.length - 1 && LAYOUT !== 'list';
  if (LAYOUT === 'list' && idx === 1) {
    el.style.justifyContent = 'flex-start'; el.style.paddingTop = '400px';
    let items = '';
    BEATS.slice(1).forEach(x => {
      items += '<div class="item"><div class="n">•</div><div class="t">' + fmtShow(x.show) + '</div></div>';
    });
    el.innerHTML = '<div class="listwrap">' + items + '</div>';
  } else if (LAYOUT === 'list' && idx > 1) {
    el.remove; return;
  } else if (isCta) {
    el.innerHTML = '<div class="cta-ring">▶</div><div class="big" style="font-size:78px">' + fmtShow(b.show) + '</div>' +
      (b.sub ? '<div class="sub2">' + escH(b.sub) + '</div>' : '') + '<div class="cta-pill">THEO DÕI</div>';
  } else {
    let num = LAYOUT === 'numbered' ? '<div class="num">' + String(idx).padStart(2, '0') + '</div>' : '';
    let big;
    if (b.stat) big = '<div class="big stat-num" data-stat="' + b.stat + '" style="font-size:190px; letter-spacing:-3px">' + b.stat + '</div>';
    else big = '<div class="big" style="' + bigSize(b.show) + '">' + fmtShow(b.show) + '</div>';
    el.innerHTML = num + big + (b.sub ? '<div class="sub2">' + escH(b.sub) + '</div>' : '') + '<div class="rule"></div>';
  }
  beatsHost.appendChild(el);
});
// number list badges
[...beatsHost.querySelectorAll('.item .n')].forEach((n, k) => n.textContent = String(k + 1).padStart(2, '0'));

const capEl = document.getElementById('cap');
const ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
const easeOut = x => 1 - Math.pow(1 - x, 3);

window.__render = t => {
  const g = document.getElementById('d-grid');
  if (g.style.display !== 'none') g.style.backgroundPosition = (t * 8) + 'px ' + (t * 14) + 'px';
  blobEls.forEach((el, i) => {
    const x = (el._px + Math.sin(t * .1 + el._ph) * .07) * W - el._sz / 2;
    const y = ((el._py + t * .012 * (1 + i * .3)) % 1.15 - .08) * H;
    el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  });
  if (sweep.style.display !== 'none') sweep.style.backgroundPosition = (t * 25 - 80) + '% 0';
  const bg = document.getElementById('bggrad');
  if (bg.style.display !== 'none') bg.style.backgroundPosition = (50 + Math.sin(t * .15) * 30) + '% ' + (50 + Math.cos(t * .12) * 30) + '%';

  document.getElementById('prog').style.width = (Math.min(1, t / TOTAL) * W) + 'px';
  const pct = document.getElementById('pct');
  if (pct) pct.textContent = String(Math.floor(Math.min(1, t / TOTAL) * 100)).padStart(2, '0') + '%';
  const tc = document.getElementById('tc');
  if (tc) tc.textContent = new Date(t * 1000).toISOString().substr(14, 5);

  const isList = LAYOUT === 'list';
  BEATS.forEach((b, idx) => {
    const el = beatsHost.children[idx]; if (!el) return;
    const next = BEATS[idx + 1];
    const visStart = b.offset - .32, visEnd = next ? next.offset - .05 : TOTAL;
    if (isList && idx === 1) {
      // list host stays visible for the rest of the video; items fade themselves
      const inP = Math.min(1, (t - visStart) / .38);
      el.style.opacity = ease(inP);
      el.style.transform = 'translateY(' + ((1 - ease(inP)) * 44) + 'px)';
    } else if (t < visStart || t > visEnd) { el.style.opacity = 0; return; }
    const inP = Math.min(1, (t - visStart) / .38);
    const outP = next ? Math.min(1, Math.max(0, (visEnd - t) / .3)) : 1;
    if (!(isList && idx === 1)) el.style.opacity = Math.min(ease(inP), ease(outP));
    const drift = (1 - ease(inP)) * 44;
    const zoom = isList ? 1 : 1 + .03 * Math.min(1, (t - b.offset) / (b.dur + 1));
    el.style.transform = 'translateY(' + drift + 'px) scale(' + zoom + ')';
    const rule = el.querySelector('.rule');
    if (rule) rule.style.width = (easeOut(Math.min(1, (t - b.offset) / .8)) * 230) + 'px';

    if (isList) {
      if (idx === 0) { // hook fades out as items start
        const hEnd = BEATS[1].offset - .05;
        el.style.opacity = t > hEnd ? 0 : Math.min(ease(Math.min(1, t / .4)), 1);
      } else if (idx === 1) {
        [...el.querySelectorAll('.item')].forEach(it => {
          const k = +it.querySelector('.n').textContent - 1;
          const ib = BEATS[1 + k];
          const ivs = ib.offset - .3, ive = (BEATS[2 + k] ? BEATS[2 + k].offset - .05 : TOTAL);
          const vin = Math.min(1, Math.max(0, (t - ivs) / .4)), vout = Math.min(1, Math.max(0, (ive - t) / .3));
          it.style.opacity = Math.max(Math.min(vin, vout), t >= ivs ? .15 : 0);
          it.style.transform = 'translateY(' + ((1 - ease(vin)) * 38) + 'px)';
        });
      }
    }
    const stat = el.querySelector('.stat-num');
    if (stat) {
      const target = parseFloat(b.stat);
      if (target > 1900 && !b.stat.includes('.')) stat.textContent = b.stat;
      else {
        const p = easeOut(Math.min(1, (t - b.offset) / 1.0));
        const v = target * p;
        const dec = (String(b.stat).split('.')[1] || '').replace(/\\D/g, '').length;
        let num = dec ? v.toFixed(Math.min(1, dec)) : String(Math.round(v));
        if (!dec) num = Math.round(v).toLocaleString('en-US');
        if (b.stat.includes('%')) num += '%'; else if (b.stat.endsWith('x')) num += 'x';
        stat.textContent = (b.stat.startsWith('+') ? '+' : '') + num;
      }
    }
    if (THEME === 'terminal') {
      const big = el.querySelector('.big');
      if (big && !big.classList.contains('stat-num') && b.show) {
        const raw = b.show.replace(/\\*/g, '');
        const prog = Math.min(1, (t - b.offset) / (b.dur * .5));
        big.textContent = raw.slice(0, Math.floor(raw.length * prog)) + (prog < 1 ? '▌' : '');
      }
    }
  });

  let cur = null;
  for (const c of CAPS) { if (t >= c.start && t < c.end) { cur = c; break; } }
  capEl.textContent = cur ? cur.text : '';
};
window.__ready = true;
</script></body></html>`;

(async () => {
  fs.mkdirSync(FRAMES, { recursive: true });
  const pageFile = path.join(OUT, 'page.html');
  fs.writeFileSync(pageFile, html);

  const t0 = Date.now();
  const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=1', '--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto('file://' + pageFile);
  await page.waitForFunction('window.__ready === true');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);

  // debug: SNAPSHOT=sec renders one frame and exits
  if (process.env.SNAPSHOT) {
    const t = parseFloat(process.env.SNAPSHOT);
    await page.evaluate(t => window.__render(t), t);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    fs.writeFileSync(`/tmp/snap_${spec.id}_${t}.jpg`, buf);
    await browser.close();
    console.log(`snapshot ${spec.id} t=${t} -> /tmp/snap_${spec.id}_${t}.jpg`);
    return;
  }

  const TOTALF = Math.ceil(spec.total * FPS);
  for (let f = 0; f < TOTALF; f++) {
    await page.evaluate(t => window.__render(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 90 });
    fs.writeFileSync(path.join(FRAMES, String(f).padStart(4, '0') + '.jpg'), buf);
    if (f % 300 === 0) console.log(`[${spec.id}] frame ${f}/${TOTALF} (${((Date.now()-t0)/1000).toFixed(0)}s)`);
  }
  await browser.close();
  console.log(`[${spec.id}] frames done in ${((Date.now()-t0)/1000).toFixed(0)}s`);

  const mp4 = path.join(ROOT, 'dist', `${spec.id}-${spec.slug}.mp4`);
  execSync(`ffmpeg -y -framerate ${FPS} -i "${FRAMES}/%04d.jpg" -i "${OUT}/final_audio.wav" ` +
    `-c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart "${mp4}"`,
    { stdio: ['ignore', 'ignore', 'inherit'] });
  fs.rmSync(FRAMES, { recursive: true, force: true });
  fs.rmSync(pageFile, { force: true });
  console.log(`[${spec.id}] DONE ${mp4} in ${((Date.now()-t0)/1000).toFixed(0)}s total`);
})();
