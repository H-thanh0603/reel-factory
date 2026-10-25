#!/home/nht/.zcode/workspace/60458c32-f992-4286-8363-1442bd7fb84d/VieNeu-TTS/.venv/bin/python
"""Generate Vietnamese TTS for one video and write spec.json (timings + captions).
Usage: tts_batch.py <video_id> <rootDir>"""
import sys, json, wave, pathlib, time

VID, ROOT = sys.argv[1], pathlib.Path(sys.argv[2])
sys.path.insert(0, str(ROOT.parent / "VieNeu-TTS"))

from vieneu import Vieneu

def load_video(vid):
    for f in sorted((ROOT / "content").glob("videos*.json")):
        for v in json.loads(f.read_text()):
            if v["id"] == vid: return v
    raise SystemExit(f"video id {vid} not found")

v = load_video(VID)
out = ROOT / "output" / VID
(out / "tts").mkdir(parents=True, exist_ok=True)

LEAD, TAIL, OVERLAP = 0.35, 0.5, 0.12
INTRO = 0.55          # silent intro before first narration
CTA_HOLD = 1.1        # extra hold on last beat

t0 = time.time()
engine = Vieneu()

segs = []
for i, seg in enumerate(v["segments"]):
    say = seg["say"] if isinstance(seg, dict) else seg
    wav = out / "tts" / f"seg{i}.wav"
    if not wav.exists():
        audio = engine.infer(say, voice=v["voice"])
        engine.save(audio, str(wav))
    w = wave.open(str(wav))
    dur = w.getnframes() / w.getframerate()
    w.close()
    segs.append({"i": i, "wav": str(wav), "dur": round(dur, 3),
                 "say": say, "show": seg.get("show", ""), "sub": seg.get("sub", ""), "stat": seg.get("stat")})
    print(f"[{VID}] seg{i}: {dur:.2f}s ({time.time()-t0:.0f}s)", flush=True)

# timeline
cur = INTRO
for s in segs:
    s["offset"] = round(cur + LEAD, 3)
    cur = s["offset"] + s["dur"] + TAIL
    if s is not segs[-1]:
        cur -= OVERLAP
total = round(cur + CTA_HOLD, 3)

# captions: chunk say-text into <=3-word groups, timed by char share within narration window
caps = []
for s in segs:
    words = s["say"].split()
    chunks, cur_c, n = [], [], 0
    for wd in words:
        cur_c.append(wd); n += len(wd) + 1
        if n >= 16 or len(cur_c) == 3:
            chunks.append(" ".join(cur_c)); cur_c, n = [], 0
    if cur_c: chunks.append(" ".join(cur_c))
    total_chars = sum(len(c) for c in chunks)
    t = s["offset"]
    for c in chunks:
        d = s["dur"] * len(c) / total_chars
        caps.append({"start": round(t, 2), "end": round(t + d, 2), "text": c})
        t += d

spec = {
    "id": v["id"], "slug": v["slug"], "category": v["category"], "handle": v.get("handle", ""),
    "theme": v["theme"], "layout": v["layout"], "voice": v["voice"],
    "title": v["title"], "hashtags": v.get("hashtags", []),
    "total": total, "beats": [
        {"i": s["i"], "offset": s["offset"], "dur": s["dur"], "show": s["show"], "sub": s["sub"], "stat": s["stat"]}
        for s in segs],
    "captions": caps,
}
(out / "spec.json").write_text(json.dumps(spec, ensure_ascii=False, indent=1))
(out / "plan.json").write_text(json.dumps(
    {"segs": [{"wav": s["wav"], "offset": s["offset"]} for s in segs], "total": total,
     "music": v.get("music", "warm")}, ensure_ascii=False, indent=1))
print(f"[{VID}] spec.json written, total {total:.1f}s, TTS took {time.time()-t0:.0f}s", flush=True)
