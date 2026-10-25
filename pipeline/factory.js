// Factory orchestrator: TTS -> mix -> render for each video, N workers in parallel.
// Usage: node pipeline/factory.js [ids...]  (default: all not-yet-done)
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const VENV_PY = path.join(ROOT, '..', 'VieNeu-TTS', '.venv', 'bin', 'python');
const CONC = parseInt(process.env.CONC || '2', 10);

function loadVideos() {
  const all = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'content')).filter(f => f.startsWith('videos') && f.endsWith('.json')).sort())
    all.push(...JSON.parse(fs.readFileSync(path.join(ROOT, 'content', f), 'utf8')));
  return all;
}
const done = new Set(fs.existsSync(path.join(ROOT, 'dist'))
  ? fs.readdirSync(path.join(ROOT, 'dist')).filter(f => f.endsWith('.mp4')).map(f => f.slice(0, 3)) : []);

let videos = loadVideos();
const argIds = process.argv.slice(2);
if (argIds.length) videos = videos.filter(v => argIds.includes(v.id));
const queue = videos.filter(v => !done.has(v.id));

console.log(`Factory: ${queue.length} videos to build (${done.size} already done), concurrency ${CONC}`);
if (!fs.existsSync(path.join(ROOT, 'assets', 'music', 'warm.wav'))) {
  console.log('Generating music variants...');
  spawnSync(VENV_PY, [path.join(__dirname, "music_gen.py"), ROOT], { stdio: 'inherit' });
}

let qi = 0, ok = 0, fail = 0;
const t0 = Date.now();
function worker(n) {
  while (qi < queue.length) {
    const v = queue[qi++];
    const steps = [
      ['TTS', VENV_PY, [path.join(__dirname, 'tts_batch.py'), v.id, ROOT]],
      ['MIX', 'python3', [path.join(__dirname, 'mix_audio.py'), v.id, ROOT]],
      ['RENDER', 'node', [path.join(__dirname, 'render.js'), path.join(ROOT, 'output', v.id, 'spec.json'), ROOT]],
    ];
    let failed = null;
    for (const [name, cmd, args] of steps) {
      const r = spawnSync(cmd, args, { encoding: 'utf8' });
      const out = (r.stdout || '') + (r.stderr || '');
      if (r.status !== 0) { failed = `${name}: ${out.slice(-1200)}`; break; }
      console.log(out.trim().split('\n').filter(l => /spec|final_audio|DONE|frames done/.test(l)).map(l => `[w${n}] ${l}`).join('\n'));
    }
    if (failed) { fail++; console.error(`[w${n}] ❌ ${v.id} ${v.slug}\n${failed}`); }
    else { ok++; console.log(`[w${n}] ✅ ${v.id}-${v.slug} | done ${ok}/${queue.length} (${((Date.now() - t0) / 60000).toFixed(1)}min)`); }
  }
}
const workers = Array.from({ length: Math.min(CONC, queue.length) }, (_, i) => worker(i + 1));
Promise.all(workers).then(() => {
  console.log(`\nFACTORY FINISHED: ${ok} ok, ${fail} failed, ${((Date.now() - t0) / 60000).toFixed(1)} min total`);
  process.exit(fail ? 1 : 0);
});
