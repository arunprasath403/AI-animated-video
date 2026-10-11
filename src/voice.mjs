// Voice stage: Kokoro TTS (via `hyperframes tts`, runs locally) per scene, then word timings.
// Word timings are estimated from pauses + word length; pass --whisper for exact
// timings from a local whisper.cpp transcription.
import fs from "node:fs";
import path from "node:path";
import { readWav, writeWav, resample } from "./wav.mjs";
import { hf, log, findPython } from "./util.mjs";

const SR = 48000;

function speechSegments(x, rate) {
  const hop = Math.round(rate * 0.01), n = Math.floor(x.length / hop), rms = new Float32Array(n);
  let mx = 0;
  for (let i = 0; i < n; i++) { let s = 0; for (let j = i * hop; j < (i + 1) * hop; j++) s += x[j] * x[j]; rms[i] = Math.sqrt(s / hop); mx = Math.max(mx, rms[i]); }
  const thr = Math.max(mx * 0.04, 1e-4), segs = [];
  let start = -1, last = -1, sil = 0;
  for (let i = 0; i < n; i++) {
    if (rms[i] > thr) { if (start < 0) start = i; sil = 0; last = i; }
    else if (start >= 0 && ++sil >= 14) { segs.push([start * 0.01, (last + 1) * 0.01]); start = -1; }
  }
  if (start >= 0) segs.push([start * 0.01, (last + 1) * 0.01]);
  return segs.length ? segs : [[0, x.length / rate]];
}

// Splits text into phrases at punctuation, matches them to detected speech segments,
// and spreads each phrase's words by length.
function estimateWords(text, segs, offset) {
  const phrases = text.split(/(?<=[.,?!;:…])\s+/).map((p) => p.trim()).filter(Boolean);
  const a0 = segs[0][0], a1 = segs[segs.length - 1][1];
  let rel = segs.map(([a, b]) => [a - a0, b - a0]);
  if (rel.length !== phrases.length) {
    const tot = phrases.reduce((s, p) => s + p.length, 0); let c = 0; rel = [];
    for (const p of phrases) { const d = (a1 - a0) * p.length / tot; rel.push([c, c + d]); c += d; }
  }
  const words = [];
  phrases.forEach((p, k) => {
    const [pa, pb] = rel[k], ws = p.split(/\s+/), wt = ws.map((w) => w.replace(/\W/g, "").length + 1.5), tot = wt.reduce((a, b) => a + b, 0);
    let c = pa;
    ws.forEach((w, i) => { const d = (pb - pa) * wt[i] / tot; words.push({ w, s: +(offset + c).toFixed(3), e: +(offset + c + d).toFixed(3) }); c += d; });
  });
  return words;
}

// Makes the text friendlier for TTS without changing what captions show.
const speakable = (s) => s.replace(/\bEC2\b/g, "E C 2").replace(/\bS3\b/g, "S 3").replace(/\bAPI\b/g, "A P I").replace(/\bAPIs\b/g, "A P Is")
  .replace(/\bSQL\b/g, "sequel").replace(/\bCLI\b/g, "C L I").replace(/\bAWS\b/g, "A W S").replace(/\bGPU\b/g, "G P U").replace(/\bCPU\b/g, "C P U")
  .replace(/\bLLMs?\b/g, (m) => (m.endsWith("s") ? "L L Ms" : "L L M")).replace(/\bk8s\b/gi, "kubernetes").replace(/\bJSON\b/g, "jason");

export async function synthVoice(plan, dir, opts) {
  const py = findPython();
  if (!py) throw new Error("Python 3 not found. The voice needs it. Run setup.ps1 again, or install Python 3.12 and run: py -m pip install kokoro-onnx soundfile");
  const voDir = path.join(dir, "vo");
  fs.mkdirSync(voDir, { recursive: true });
  const jobs = plan.scenes.map((sc, i) => ({ i, text: speakable(sc.say), file: path.join(voDir, `s${i}.wav`) }));
  const todo = jobs.filter((j) => !(fs.existsSync(j.file) && fs.existsSync(j.file + ".txt") && fs.readFileSync(j.file + ".txt", "utf8") === `${opts.voice}|${opts.speed}|${j.text}`));
  log(`voice: synthesizing ${todo.length} of ${jobs.length} scenes with Kokoro (${opts.voice})`);
  const par = Math.max(1, opts.ttsParallel || 3);
  for (let k = 0; k < todo.length; k += par) {
    await Promise.all(todo.slice(k, k + par).map(async (j) => {
      // Text goes through a file so quotes and % signs survive the Windows shell.
      const txt = j.file.replace(/\.wav$/, ".say.txt");
      fs.writeFileSync(txt, j.text.replace(/%/g, " percent"));
      await hf(["tts", JSON.stringify(txt), "-v", opts.voice, "-s", String(opts.speed), "-o", JSON.stringify(j.file)], { quiet: true });
      fs.writeFileSync(j.file + ".txt", `${opts.voice}|${opts.speed}|${j.text}`);
    }));
  }

  const lead = 0.3, gap = opts.sceneGap ?? 0.35;
  let t = lead;
  const pieces = [], words = [];
  plan.scenes.forEach((sc, i) => {
    const { rate, data } = readWav(jobs[i].file);
    const segs = speechSegments(data, rate);
    const a0 = Math.max(0, segs[0][0] - 0.02), a1 = Math.min(data.length / rate, segs[segs.length - 1][1] + 0.06);
    const clip = resample(data.subarray(Math.floor(a0 * rate), Math.floor(a1 * rate)), rate, SR);
    const ws = estimateWords(sc.say, segs.map(([a, b]) => [a - a0, b - a0]), t);
    ws.forEach((w) => (w.scene = i));
    sc.voStart = +t.toFixed(3); sc.voEnd = +(t + clip.length / SR).toFixed(3);
    pieces.push({ at: t, clip });
    words.push(...ws);
    t += clip.length / SR + (i < plan.scenes.length - 1 ? gap : 0);
  });
  const tail = opts.tail ?? 1.8;
  const total = +(t + tail).toFixed(2);
  const vo = new Float32Array(Math.ceil(total * SR));
  for (const p of pieces) vo.set(p.clip, Math.floor(p.at * SR));
  let peak = 0; for (const v of vo) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < vo.length; i++) vo[i] *= 0.89 / peak;
  writeWav(path.join(voDir, "vo_full.wav"), SR, [vo]);

  if (opts.whisper) {
    try {
      const exact = await whisperWords(path.join(voDir, "vo_full.wav"), dir, words);
      if (exact) { log("voice: using whisper word timings"); return { vo, rate: SR, words: exact, total }; }
    } catch (e) { log("voice: whisper failed, keeping estimated timings (" + e.message + ")"); }
  }
  return { vo, rate: SR, words, total };
}

// Aligns whisper's words to our script words in order, so captions keep the script's spelling.
async function whisperWords(wav, dir, est) {
  await hf(["transcribe", JSON.stringify(wav), "-d", JSON.stringify(dir), "--model", "base.en"], { quiet: true });
  const tf = path.join(dir, "transcript.json");
  if (!fs.existsSync(tf)) return null;
  const raw = JSON.parse(fs.readFileSync(tf, "utf8"));
  const wl = (Array.isArray(raw) ? raw : raw.words || raw.segments?.flatMap((s) => s.words || []) || [])
    .map((w) => ({ t: String(w.text ?? w.word ?? "").toLowerCase().replace(/[^a-z0-9]/g, ""), s: +(w.start ?? w.s), e: +(w.end ?? w.e) }))
    .filter((w) => w.t && isFinite(w.s));
  if (wl.length < est.length * 0.6) return null;
  let j = 0;
  return est.map((w) => {
    const key = w.w.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (let k = j; k < Math.min(wl.length, j + 4); k++) if (wl[k].t === key) { j = k + 1; return { ...w, s: +wl[k].s.toFixed(3), e: +wl[k].e.toFixed(3) }; }
    return w;
  });
}
