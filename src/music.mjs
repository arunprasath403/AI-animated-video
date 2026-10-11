// Generates an original music bed + sound effects from the seed (no samples, no
// licences), ducks it under the voice and writes the final stereo mix.
import path from "node:path";
import { writeWav, readWav, resample } from "./wav.mjs";
import { rng } from "./util.mjs";

const SR = 48000;
const PROGRESSIONS = [
  [[0, 3, 7], [-4, 0, 3], [-9, -5, 0], [-2, 2, 5]],   // i  VI III VII (minor epic)
  [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]],  // I  V vi IV (uplifting)
  [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]],   // i VII VI v (driving)
  [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 5]], // maj7 lo-fi
];

function onePoleLP(x, fc) {
  const y = new Float32Array(x.length); let s = 0;
  for (let i = 0; i < x.length; i++) { const f = typeof fc === "function" ? fc(i) : fc; const a = Math.exp((-2 * Math.PI * f) / SR); s = (1 - a) * x[i] + a * s; y[i] = s; }
  return y;
}
const normalize = (x) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < x.length; i++) x[i] /= m; return x; };

export function makeMix({ seed, vo, voRate, total, cues, musicFile, musicGain = 0.17, genre }) {
  const r = rng(seed * 7 + 3), N = Math.ceil(total * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  let music;
  if (musicFile) {
    const m = readWav(musicFile); const x = resample(m.data, m.rate, SR);
    music = [new Float32Array(N), new Float32Array(N)];
    for (let i = 0; i < N; i++) music[0][i] = music[1][i] = x[i % x.length];
  } else { music = synthMusic(r, N, genre); let pk = 1e-6; for (const ch of music) for (const v of ch) pk = Math.max(pk, Math.abs(v)); for (const ch of music) for (let i = 0; i < ch.length; i++) ch[i] /= pk; }

  // fade in/out and duck under the voice
  const v = vo.length === N ? vo : (() => { const y = new Float32Array(N); y.set(vo.subarray(0, Math.min(N, vo.length))); return y; })();
  const env = onePoleLP(v.map(Math.abs), 6); normalize(env);
  for (let i = 0; i < N; i++) {
    const t = i / SR, fade = Math.min(1, t / 1.2) * Math.min(1, (total - t) / 1.4), duck = 1 - 0.55 * Math.min(1, env[i] * 4);
    music[0][i] *= fade * duck; music[1][i] *= fade * duck;
  }

  const sfx = new Float32Array(N);
  const add = (x, at, g) => { const i0 = Math.floor(at * SR); for (let i = 0; i < x.length && i0 + i < N; i++) if (i0 + i >= 0) sfx[i0 + i] += g * x[i]; };
  const noise = (n) => Float32Array.from({ length: n }, () => r() * 2 - 1);
  const whoosh = (d = 0.5) => { const n = Math.floor(d * SR), x = noise(n); const hi = onePoleLP(x, (i) => 300 + 5200 * Math.pow(i / n, 1.5)), lo = onePoleLP(x, (i) => (300 + 5200 * Math.pow(i / n, 1.5)) * 0.25); const y = hi.map((v, i) => (v - lo[i]) * Math.pow(Math.sin(Math.PI * i / n), 2)); return normalize(y); };
  const impact = () => { const n = Math.floor(0.9 * SR), nz = onePoleLP(noise(n), 1200); const y = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * (45 + 90 * Math.exp(-t * 18)) / SR; y[i] = Math.sin(ph) * Math.exp(-t * 5) + 0.4 * nz[i] * Math.exp(-t * 25); } return normalize(y); };
  const pop = (f) => { const n = Math.floor(0.12 * SR), y = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * f * (1 + 0.6 * Math.exp(-t * 60)) / SR; y[i] = Math.sin(ph) * Math.exp(-t * 38); } return y; };
  const tick = () => { const n = Math.floor(0.06 * SR), y = new Float32Array(n); for (let i = 0; i < n; i++) y[i] = Math.sin(2 * Math.PI * 2400 * i / SR) * Math.exp(-i / SR * 80); return y; };
  const riser = (d = 1.2) => { const n = Math.floor(d * SR), y = onePoleLP(noise(n), (i) => 300 + 7000 * (i / n) ** 2); return normalize(y.map((v, i) => v * (i / n) ** 2)); };
  const popFreqs = [880, 988, 1175, 1319];
  let pk = 0;
  for (const c of cues) {
    if (c.kind === "whoosh") add(whoosh(), c.t - 0.25, 0.45);
    else if (c.kind === "impact") add(impact(), c.t, 0.55);
    else if (c.kind === "pop") add(pop(popFreqs[pk++ % popFreqs.length]), c.t, 0.22);
    else if (c.kind === "tick") add(tick(), c.t, 0.35);
    else if (c.kind === "riser") add(riser(1.2), c.t, 0.35);
  }

  let peak = 0;
  for (let i = 0; i < N; i++) {
    const base = 0.95 * v[i] + 0.3 * sfx[i];
    L[i] = Math.tanh((base + musicGain * music[0][i]) * 1.1) / Math.tanh(1.1);
    R[i] = Math.tanh((base + musicGain * music[1][i]) * 1.1) / Math.tanh(1.1);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  for (let i = 0; i < N; i++) { L[i] *= 0.89 / peak; R[i] *= 0.89 / peak; }
  return [L, R];
}

// Genres: each theme gets its own kind of score. Key, tempo and progression vary by seed.
const GENRES = {
  synthwave: { bpm: [96, 112], progs: [0, 2], cutoff: [900, 1400], attack: 1.0, kick: "four", hats: "off", clap: false, arp: "saw16", pad: 1, bass: false },
  lofi:      { bpm: [72, 84], progs: [3], cutoff: [480, 700], attack: 0.4, kick: "lofi", hats: "swing", clap: "brush", arp: "keys", pad: 0.7, crackle: true },
  minimal:   { bpm: [118, 124], progs: [0, 2], cutoff: [450, 750], attack: 1.5, kick: "four", hats: "off", clap: true, arp: "stab", pad: 0.45 },
  punchy:    { bpm: [100, 110], progs: [1, 2], cutoff: [900, 1300], attack: 0.2, kick: "punch", hats: "eighth", clap: true, arp: "none", pad: 0.45, bass: true },
  uplift:    { bpm: [100, 108], progs: [1], cutoff: [1300, 1900], attack: 0.8, kick: "soft", hats: "off", clap: false, arp: "pluck8", pad: 0.9 },
  cinematic: { bpm: [64, 72], progs: [0], cutoff: [800, 1100], attack: 2.2, kick: "boom", hats: "none", clap: false, arp: "ostinato", pad: 1.1, drone: true },
  outrun:    { bpm: [112, 120], progs: [0, 2], cutoff: [1100, 1600], attack: 0.6, kick: "four", hats: "eighth", clap: true, arp: "saw16", pad: 0.8, bass: "pulse" },
  dark:      { bpm: [124, 130], progs: [2], cutoff: [380, 600], attack: 1.2, kick: "four", hats: "off", clap: false, arp: "acid", pad: 0.4, bass: "pulse", drone: true },
  bounce:    { bpm: [116, 124], progs: [1], cutoff: [1400, 2000], attack: 0.1, kick: "punch", hats: "eighth", clap: true, arp: "stab", pad: 0.35, bass: true },
  ambient:   { bpm: [60, 70], progs: [3, 1], cutoff: [700, 1000], attack: 3, kick: "none", hats: "none", clap: false, arp: "bell", pad: 1.2, drone: true },
  house:     { bpm: [120, 124], progs: [3], cutoff: [1000, 1500], attack: 0.3, kick: "four", hats: "off", clap: true, arp: "keys", pad: 0.6, bass: "offbeat" },
  jazz:      { bpm: [82, 92], progs: [3], cutoff: [600, 900], attack: 0.5, kick: "lofi", hats: "swing", clap: "brush", arp: "keys", pad: 0.55, bass: "walk", crackle: true },
  chip:      { bpm: [128, 140], progs: [0, 2], cutoff: [2400, 3200], attack: 0.05, kick: "four", hats: "eighth", clap: true, arp: "chip", pad: 0.25, bass: "pulse" },
  orchestral:{ bpm: [70, 80], progs: [0, 1], cutoff: [900, 1300], attack: 1.6, kick: "boom", hats: "none", clap: false, arp: "ostinato", pad: 1.2, drone: false, bell: true },
  trap:      { bpm: [70, 76], progs: [0], cutoff: [700, 1000], attack: 0.8, kick: "half", hats: "trap", clap: "snare3", arp: "bell", pad: 0.6, bass: "808" },
};

function synthMusic(r, N, genreName = "synthwave") {
  const G = GENRES[genreName] || GENRES.synthwave;
  const root = 110 * Math.pow(2, Math.floor(r() * 7) / 12);
  const prog = PROGRESSIONS[r.pick(G.progs)], bpm = Math.round(r.range(G.bpm[0], G.bpm[1])), beat = 60 / bpm, bar = beat * 4, chordLen = bar * 2;
  const cutoff = r.range(G.cutoff[0], G.cutoff[1]), T = N / SR;
  const TAB = 4096, saw = new Float32Array(TAB);
  for (let i = 0; i < TAB; i++) { let s = 0; for (let k = 1; k < 14; k++) s += Math.sin((2 * Math.PI * k * i) / TAB) / k; saw[i] = s * 0.55; }
  const L = new Float32Array(N), R = new Float32Array(N), drums = new Float32Array(N), pump = new Float32Array(N).fill(1);
  const chordAt = (t) => prog[Math.floor(t / chordLen) % prog.length];
  const freq = (semi, oct = 0) => root * Math.pow(2, semi / 12 + oct);

  // pads
  const padL = new Float32Array(N), padR = new Float32Array(N);
  for (let c = 0; c * chordLen < T + chordLen; c++) {
    const st = Math.floor(c * chordLen * SR), len = Math.floor(chordLen * 1.25 * SR);
    for (const semi of prog[c % prog.length]) {
      for (const [det, ch] of [[-0.0014, padL], [0.0014, padR]]) {
        const inc = (freq(semi) * (1 + det) * TAB) / SR; let ph = r() * TAB;
        for (let i = 0; i < len && st + i < N; i++) {
          const t = i / SR, e = Math.min(1, t / G.attack) * Math.min(1, Math.pow(Math.max(0, (len / SR - t) / 1.6), 2));
          ch[st + i] += (saw[Math.floor(ph) % TAB] + 0.6 * Math.sin((ph / TAB) * Math.PI)) * e; ph += inc;
        }
      }
    }
    if (G.drone) { const f = freq(prog[c % prog.length][0], -1); let ph = 0; for (let i = 0; i < len && st + i < N; i++) { ph += (2 * Math.PI * f) / SR; const e = Math.min(1, i / SR / 2) * Math.min(1, (len - i) / SR / 2); const v = (Math.sin(ph) + 0.4 * Math.sin(ph * 1.5)) * e * 0.9; padL[st + i] += v; padR[st + i] += v; } }
  }
  const pl = normalize(onePoleLP(padL, cutoff)), pr = normalize(onePoleLP(padR, cutoff));

  // melodic layer
  const notes = [];
  const add16 = (step, pattern) => { for (let t = bar; t < T - 1; t += step) notes.push(pattern(t)); };
  if (G.arp === "saw16") add16(beat / 4, (t) => { const ch = chordAt(t), k = Math.round(t / (beat / 4)); return { t, f: freq(ch[k % ch.length], 1), d: 0.16, g: 0.22, wave: "saw" }; });
  if (G.arp === "pluck8") add16(beat / 2, (t) => { const ch = chordAt(t), k = Math.round(t / (beat / 2)); return { t, f: freq(ch[[0, 1, 2, 1][k % 4] % ch.length], 1 + (k % 8 > 5 ? 1 : 0)), d: 0.35, g: 0.3, wave: "pluck" }; });
  if (G.arp === "ostinato") add16(beat / 2, (t) => { const ch = chordAt(t), k = Math.round(t / (beat / 2)); return { t, f: freq(ch[k % 2 ? 2 : 0], -1), d: 0.28, g: 0.32, wave: "saw" }; });
  if (G.arp === "stab") for (let t = bar; t < T - 1; t += bar) for (const o of [beat * 1.5, beat * 3.5]) { const ch = chordAt(t); for (const s of ch) notes.push({ t: t + o, f: freq(s, 1), d: 0.18, g: 0.12, wave: "pluck" }); }
  if (G.arp === "keys") for (let t = bar; t < T - 1; t += beat * 2) { const ch = chordAt(t); ch.forEach((s, j) => notes.push({ t: t + j * 0.03, f: freq(s, 1), d: 1.2, g: 0.13, wave: "bell" })); }
  if (G.arp === "chip") add16(beat / 4, (t) => { const ch = chordAt(t), k = Math.round(t / (beat / 4)); return { t, f: freq(ch[k % ch.length], 1 + (k % 4 === 3 ? 1 : 0)), d: 0.1, g: 0.16, wave: "square" }; });
  if (G.arp === "acid") add16(beat / 4, (t) => { const ch = chordAt(t), k = Math.round(t / (beat / 4)); return { t, f: freq([0, 0, 12, 0, 7, 0, 10, 3][k % 8] + ch[0], -1), d: 0.12, g: [1, 3, 6].includes(k % 8) ? 0.34 : 0.2, wave: "saw" }; });
  if (G.arp === "bell" || G.bell) for (let t = bar, k = 0; t < T - 1; t += beat * (G.arp === "bell" ? 1 : 2), k++) { if (r() < 0.35) continue; const ch = chordAt(t); notes.push({ t, f: freq(ch[Math.floor(r() * ch.length)], 1 + (r() < 0.3 ? 1 : 0)), d: 2, g: 0.15, wave: "bell" }); }
  if (G.bass === "pulse") for (let t = bar; t < T - 1; t += beat / 2) notes.push({ t, f: freq(chordAt(t)[0], -1), d: 0.2, g: 0.32, wave: "saw" });
  if (G.bass === "offbeat") for (let t = bar + beat / 2; t < T - 1; t += beat) notes.push({ t, f: freq(chordAt(t)[0], -1), d: 0.25, g: 0.4, wave: "square" });
  if (G.bass === "walk") for (let t = bar, k = 0; t < T - 1; t += beat, k++) { const ch = chordAt(t); notes.push({ t, f: freq([ch[0], ch[1], ch[2], ch[1] + 1][k % 4], -2), d: beat * 0.9, g: 0.5, wave: "sine" }); }
  if (G.bass === "808") for (let t = bar; t < T - 1; t += bar) for (const o of [0, beat * 2.5]) notes.push({ t: t + o, f: freq(chordAt(t)[0], -2), d: 0.9, g: 0.7, wave: "808" });
  if (G.bass === true) for (let t = bar; t < T - 1; t += beat / 2) { const k = Math.round(t / (beat / 2)) % 8; if ([0, 3, 4, 6].includes(k)) notes.push({ t, f: freq(chordAt(t)[0], -1), d: 0.22, g: 0.45, wave: "square" }); }
  const mel = new Float32Array(N);
  for (const n of notes) {
    const i0 = Math.floor(n.t * SR), len = Math.floor(n.d * SR); let ph = 0;
    for (let i = 0; i < len && i0 + i < N; i++) {
      const t = i / SR; ph += n.f / SR; const p = ph % 1;
      if (n.wave === "sine" || n.wave === "808") { const env = n.wave === "808" ? Math.exp(-t * 2.2) : Math.exp(-t * 4); mel[i0 + i] += Math.sin(2 * Math.PI * ph * (n.wave === "808" ? 1 + 0.5 * Math.exp(-t * 30) : 1)) * n.g * env * Math.min(1, t / 0.005); continue; }
      let v = n.wave === "saw" ? 2 * p - 1 : n.wave === "square" ? (p < 0.5 ? 1 : -1) * 0.6 : n.wave === "bell" ? Math.sin(2 * Math.PI * ph) + 0.3 * Math.sin(2 * Math.PI * ph * 3.01) : Math.sin(2 * Math.PI * ph) + 0.35 * Math.sin(4 * Math.PI * ph);
      mel[i0 + i] += v * n.g * Math.exp(-t * (n.wave === "bell" ? 3 : 9)) * Math.min(1, t / 0.004);
    }
  }
  const melF = onePoleLP(mel, cutoff * 2.2);

  // drums
  const hit = (at, fn, len) => { const i0 = Math.floor(at * SR), n = Math.floor(len * SR); for (let i = 0; i < n && i0 + i < N; i++) drums[i0 + i] += fn(i / SR); };
  const duck = (at, depth = 0.55) => { const i0 = Math.floor(at * SR), m = Math.floor(0.3 * SR); for (let i = 0; i < m && i0 + i < N; i++) pump[i0 + i] = Math.min(pump[i0 + i], 1 - depth + depth * (i / m)); };
  const kick = (at, g = 1) => { let ph = 0; hit(at, (t) => { ph += (2 * Math.PI * (50 + 70 * Math.exp(-t * 32))) / SR; return g * Math.sin(ph) * Math.exp(-t * 13); }, 0.3); duck(at); };
  const noiseHit = (at, g, decay, len) => hit(at, (t) => g * (r() * 2 - 1) * Math.exp(-t * decay), len);
  const start = 2.4;
  for (let b = start, k = 0; b < T - 1; b += beat, k++) {
    const inBar = k % 4;
    if (G.kick === "four" || G.kick === "soft") kick(b, G.kick === "soft" ? 0.55 : 0.9);
    if (G.kick === "lofi" && (inBar === 0 || inBar === 2)) kick(b, 0.7);
    if (G.kick === "lofi" && inBar === 2) kick(b + beat * 0.5, 0.5);
    if (G.kick === "punch" && (inBar === 0 || inBar === 2)) kick(b, 1);
    if (G.kick === "punch" && inBar === 1) kick(b + beat * 0.5, 0.8);
    if (G.kick === "boom" && k % 8 === 0) { let ph = 0; hit(b, (t) => { ph += (2 * Math.PI * (38 + 30 * Math.exp(-t * 8))) / SR; return 1.2 * Math.sin(ph) * Math.exp(-t * 3.2); }, 1.4); noiseHit(b, 0.25, 18, 0.4); duck(b, 0.35); }
    if (G.clap === true && (inBar === 1 || inBar === 3)) noiseHit(b, 0.5, 28, 0.2);
    if (G.clap === "brush" && (inBar === 1 || inBar === 3)) noiseHit(b, 0.25, 12, 0.3);
    if (G.kick === "half" && (inBar === 0 || (inBar === 2 && k % 8 === 6))) kick(b, 1);
    if (G.kick === "half" && inBar === 3 && k % 8 === 3) kick(b + beat * 0.5, 0.8);
    if (G.clap === "snare3" && inBar === 2) { noiseHit(b, 0.6, 22, 0.25); hit(b, (t) => 0.4 * Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 30), 0.15); }
    if (b > start + bar) {
      if (G.hats === "off") noiseHit(b + beat / 2, 0.18, 90, 0.05);
      if (G.hats === "eighth") { noiseHit(b, 0.12, 90, 0.05); noiseHit(b + beat / 2, 0.16, 90, 0.05); }
      if (G.hats === "trap") { const roll = k % 4 === 3 && r() < 0.6 ? 6 : 2; for (let j = 0; j < roll; j++) noiseHit(b + (j * beat) / roll, 0.11, 110, 0.04); }
      if (G.hats === "swing") { noiseHit(b, 0.08, 70, 0.05); noiseHit(b + beat * 0.62, 0.1, 70, 0.05); }
    }
  }
  const dr = new Float32Array(N); { let prev = 0; for (let i = 0; i < N; i++) { const hp = drums[i] - prev * 0.0; dr[i] = hp; prev = drums[i]; } }
  if (G.crackle) for (let i = 0; i < N; i += Math.floor(SR * (0.02 + r() * 0.12))) dr[i] += (r() * 2 - 1) * 0.25;

  for (let i = 0; i < N; i++) {
    const p = 0.55 * G.pad * pump[i], m = 0.6 * melF[i] * (0.6 + 0.4 * pump[i]), d = 0.55 * dr[i];
    L[i] = p * pl[i] + m + d; R[i] = p * pr[i] + m * 0.9 + d;
  }
  return [L, R];
}

export function writeMix(file, channels) { writeWav(file, SR, channels); }
export { SR as MIX_RATE };
export const mixPath = (dir) => path.join(dir, "assets", "mix.wav");
