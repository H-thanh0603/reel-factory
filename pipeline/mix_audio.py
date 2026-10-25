"""Mix narration (gapped) + procedural music into final_audio.wav for one video.
Usage: mix_audio.py <video_id> <rootDir>"""
import sys, json, pathlib, subprocess

VID, ROOT = sys.argv[1], pathlib.Path(sys.argv[2])
out = ROOT / "output" / VID
plan = json.loads((out / "plan.json").read_text())
total = plan["total"]
narr = out / "narration.wav"
final = out / "final_audio.wav"

# narration track: each segment delayed to its offset, summed (no normalization)
inputs, filters = [], []
for i, s in enumerate(plan["segs"]):
    inputs += ["-i", s["wav"]]
    filters.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=mono,adelay={int(s['offset']*1000)}|{int(s['offset']*1000)}[a{i}]")
filters.append("".join(f"[a{i}]" for i in range(len(plan["segs"]))) +
               f"amix=inputs={len(plan['segs'])}:normalize=0,apad=whole_dur={total}[narr]")
subprocess.run(["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(filters), "-map", "[narr]",
                "-ar", "48000", "-ac", "1", narr], check=True, capture_output=True)

music = ROOT / "assets" / "music" / f"{plan.get('music','warm')}.wav"
if not music.exists():
    music = ROOT / "assets" / "music" / "warm.wav"
mv = {"warm": 0.30, "pulse": 0.24, "dark": 0.34, "bright": 0.22}.get(plan.get("music", "warm"), 0.28)
fade = max(1.5, total * 0.08)
subprocess.run(["ffmpeg", "-y",
    "-i", narr,
    "-stream_loop", "-1", "-i", str(music), "-t", str(total),
    "-filter_complex",
    f"[1:a]volume={mv},afade=t=out:st={total-fade:.2f}:d={fade:.2f}[m];[0:a][m]amix=inputs=2:normalize=0,alimiter=limit=0.95[out]",
    "-map", "[out]", "-ar", "48000", "-ac", "2", final], check=True, capture_output=True)
print(f"[{VID}] final_audio.wav ({total:.1f}s)")
