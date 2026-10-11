// Minimal WAV read/write (PCM16 / PCM24 / PCM32 / float32), mono mixdown, resampling.
import fs from "node:fs";

export function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") throw new Error("Not a WAV file: " + file);
  let off = 12, fmt = null, data = null;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === "fmt ") fmt = { format: b.readUInt16LE(off + 8), channels: b.readUInt16LE(off + 10), rate: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    if (id === "data") data = b.subarray(off + 8, off + 8 + Math.min(size, b.length - off - 8));
    off += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error("Bad WAV: " + file);
  const bps = fmt.bits / 8, frames = Math.floor(data.length / (bps * fmt.channels));
  const out = new Float32Array(frames);
  const isFloat = fmt.format === 3 || (fmt.format === 0xfffe && fmt.bits === 32 && false);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < fmt.channels; c++) {
      const p = (i * fmt.channels + c) * bps;
      if (isFloat) s += data.readFloatLE(p);
      else if (fmt.bits === 16) s += data.readInt16LE(p) / 32768;
      else if (fmt.bits === 24) s += data.readIntLE(p, 3) / 8388608;
      else if (fmt.bits === 32) s += data.readInt32LE(p) / 2147483648;
      else s += (data[p] - 128) / 128;
    }
    out[i] = s / fmt.channels;
  }
  return { rate: fmt.rate, data: out };
}

// Writes interleaved stereo (or mono) 16-bit PCM.
export function writeWav(file, rate, channels) {
  const n = channels[0].length, ch = channels.length;
  const b = Buffer.alloc(44 + n * ch * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * ch * 2, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * ch * 2, 28); b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * ch * 2, 40);
  let p = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, channels[c][i])); b.writeInt16LE(Math.round(v * 32767), p); p += 2; }
  fs.writeFileSync(file, b);
}

// Catmull-Rom resampler; fine for speech upsampling (24k -> 48k).
export function resample(x, from, to) {
  if (from === to) return x;
  const n = Math.floor(x.length * to / from), y = new Float32Array(n), r = from / to;
  const at = (i) => x[Math.max(0, Math.min(x.length - 1, i))];
  for (let i = 0; i < n; i++) {
    const t = i * r, k = Math.floor(t), f = t - k;
    const p0 = at(k - 1), p1 = at(k), p2 = at(k + 1), p3 = at(k + 2);
    y[i] = p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0)));
  }
  return y;
}
