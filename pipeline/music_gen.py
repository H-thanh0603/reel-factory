"""Generate procedural background music loops (no copyright issues).
Usage: music_gen.py [rootDir]  -> assets/music/{warm,pulse,dark,bright}.wav (96s, 48kHz stereo)"""
import sys, wave, pathlib
import numpy as np

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).parent.parent)
SR = 48000
DUR = 96.0
N = int(SR * DUR)

def note(f): return f

def synth_pad(freqs, t, detune=0.7, cutoff_lfo=0.15):
    """Soft detuned pad with slow brightness LFO."""
    out = np.zeros_like(t)
    for f in freqs:
        for dt in (-detune, detune):
            ph = 2 * np.pi * (f + dt) * t + np.random.rand() * 6.28
            out += np.sin(ph) + 0.35 * np.sin(2 * ph)
    out /= (len(freqs) * 2 * 1.35)
    # slow lowpass feel: mix with heavily lowpassed version
    kernel = np.ones(220) / 220
    soft = np.convolve(out, kernel, mode="same")
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * cutoff_lfo * t + 1.0)
    return out * (0.45 + 0.55 * lfo) + soft * 0.55

def pluck(f, t, env_t=0.35):
    """Simple decaying pluck."""
    ph = 2 * np.pi * f * t
    sig = np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    env = np.exp(-t / env_t) * (t > 0)
    return sig * env

def place(buf, sig, at):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    if j > i: buf[i:j] += sig[: j - i]

def finalize(sig, gain=0.85):
    sig = sig / (np.max(np.abs(sig)) + 1e-9) * gain
    # gentle fade in/out edges for clean loop
    f = int(SR * 1.2)
    sig[:f] *= np.linspace(0, 1, f) ** 2
    return sig

t = np.arange(N) / SR
CH = {  # chords as frequencies
    "Am7":  [110.0, 164.81, 196.0, 246.94, 329.63],
    "Fmaj7":[ 87.31, 130.81, 174.61, 220.0, 261.63],
    "Cmaj7":[ 65.41, 130.81, 164.81, 196.0, 246.94],
    "G6":   [ 98.0, 146.83, 196.0, 246.94, 293.66],
    "Dm7":  [ 73.42, 146.83, 174.61, 220.0, 261.63],
    "Em":   [ 82.41, 123.47, 164.81, 196.0, 246.94],
}
def bar_chords(names, bar=8.0):
    """One voice per chord segment; returns mono buffer."""
    buf = np.zeros(N)
    for k, nm in enumerate(names * 100):
        at = k * bar
        if at >= DUR: break
        tt = t[: int(bar * SR) + int(4.0 * SR)]
        seg = synth_pad(CH[nm], tt)
        fade = int(0.8 * SR)
        seg[:fade] *= np.linspace(0, 1, fade)
        place(buf, seg, at)
    return buf

# ---- warm: soft major pads (C-Am-F-G) ----
buf = bar_chords(["Cmaj7", "Am7", "Fmaj7", "G6"], bar=8.0)
w = finalize(buf, 0.5)
st = np.stack([w, np.roll(w, 900)], 1)

# ---- pulse: pads + soft arpeggio at 105 bpm ----
buf2 = bar_chords(["Am7", "Fmaj7", "Cmaj7", "G6"], bar=8.0)
arp = np.zeros(N)
step = 60 / 105 / 2
seq = ["Am7", "Am7", "Fmaj7", "Fmaj7", "Cmaj7", "Cmaj7", "G6", "G6"]
for k in range(int(DUR / step)):
    ch = CH[seq[(k // 8) % len(seq)]]
    f = ch[2 + (k % 3)] * 2
    tt = np.arange(int(0.5 * SR)) / SR
    place(arp, pluck(f, tt, 0.3) * 0.5, k * step)
buf2 = buf2 * 0.9 + arp * 0.35
w2 = finalize(buf2, 0.5)
st2 = np.stack([w2, np.roll(w2, 700)], 1)

# ---- dark: minor drone (Dm-Em) ----
buf3 = bar_chords(["Dm7", "Dm7", "Em", "Em"], bar=12.0)
w3 = finalize(buf3, 0.5)
st3 = np.stack([w3, np.roll(w3, 1400)], 1)

# ---- bright: airy arp over F-C-G-Am, sparser pads ----
buf4 = bar_chords(["Fmaj7", "Cmaj7", "G6", "Am7"], bar=8.0) * 0.55
arp4 = np.zeros(N)
step4 = 60 / 120 / 2
for k in range(int(DUR / step4)):
    ch = CH[["Fmaj7", "Cmaj7", "G6", "Am7"][(k // 16) % 4]]
    f = ch[1 + (k % 4)] * 4
    tt = np.arange(int(0.35 * SR)) / SR
    place(arp4, pluck(f, tt, 0.22) * 0.6, k * step4)
w4 = finalize(buf4 + arp4 * 0.5, 0.5)
st4 = np.stack([w4, np.roll(w4, 500)], 1)

(out := ROOT / "assets" / "music").mkdir(parents=True, exist_ok=True)
for name, data in [("warm", st), ("pulse", st2), ("dark", st3), ("bright", st4)]:
    with wave.open(str(ROOT / "assets" / "music" / f"{name}.wav"), "wb") as wf:
        wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
        wf.writeframes((np.clip(data, -1, 1) * 32767).astype(np.int16).tobytes())
    print(f"music/{name}.wav written")
