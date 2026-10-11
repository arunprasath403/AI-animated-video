#!/usr/bin/env node
// c2v: tech topic in, animated explainer video out.
//   node bin/c2v.mjs make "What is Docker?"
//   node bin/c2v.mjs make --plan examples/what-is-docker.json
import fs from "node:fs";
import path from "node:path";
import { ROOT, log, hf, run, slugify, hashStr, findPython } from "../src/util.mjs";
import { writePlan, buildPrompt } from "../src/llm.mjs";
import { validatePlan } from "../src/schema.mjs";
import { synthVoice } from "../src/voice.mjs";
import { makeStyle, THEMES } from "../src/style.mjs";
import { compose } from "../src/compose.mjs";
import { makeMix, writeMix, mixPath } from "../src/music.mjs";

const DEFAULTS = {
  channel: "BYTE-SIZED",
  handle: "@bytesized",
  llm: { enabled: false, baseUrl: "http://localhost:11434/v1", model: "qwen2.5:7b", apiKey: "", temperature: 0.8 },
  voice: "am_michael",
  speed: 1.05,
  quality: "high",
  fps: 30,
  ttsParallel: 3,
  whisper: false,
  lambda: { region: "us-east-1", stackName: "hyperframes-default" },
};

function loadConfig() {
  const f = path.join(ROOT, "c2v.config.json");
  if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(DEFAULTS, null, 2));
  const c = JSON.parse(fs.readFileSync(f, "utf8"));
  return { ...DEFAULTS, ...c, llm: { ...DEFAULTS.llm, ...c.llm }, lambda: { ...DEFAULTS.lambda, ...c.lambda } };
}

function saveConfig(cfg) { try { fs.writeFileSync(path.join(ROOT, "c2v.config.json"), JSON.stringify(cfg, null, 2)); } catch {} }

function parseArgs(argv) {
  const pos = [], o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) o[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) o[k] = argv[++i];
      else o[k] = true;
    } else pos.push(a);
  }
  return { pos, o };
}

const HELP = `
c2v - code to video (free, local, open source)

  c2v make <plan.json>          voice, animate and render a plan (see plans/ and examples/)
  c2v prompt "<topic>"          print a prompt to paste into Claude; save its JSON reply as plans/<name>.json
  c2v check <plan.json>         validate a plan without rendering
  c2v make "<topic>"            optional: auto-write the plan with a local LLM (needs llm.enabled in c2v.config.json)
  c2v render <projectDir>       re-render an existing project
  c2v batch <topics.txt>        one topic per line
  c2v lambda-deploy             one-time: deploy the HyperFrames renderer to your AWS account
  c2v doctor                    check Node, FFmpeg, Python voice, Chrome
  c2v voices                    list TTS voices
  c2v themes                    list the 22 visual themes

Options:
  --seed <n|random>   look & music seed (default: from topic, so re-runs match)
  --voice <id>        e.g. am_michael, af_heart, bm_george (see: c2v voices)
  --speed <x>         narration speed (default 1.05)
  --model <name>      LLM model (default from c2v.config.json)
  --theme <name>      one of 22 themes (see: c2v themes); default rotates so videos differ
  --seed <n|random>   different palette, font, transitions and music inside a theme
  --music <file.wav>  use your own music bed instead of the generated one
  --whisper           exact caption timing via local whisper.cpp
  --quality <q>       draft | standard | high
  --lambda            render on AWS Lambda instead of this PC
  --no-render         build the project only (preview with: npx hyperframes preview <dir>)
`;

async function make(topic, o, cfg) {
  let plan;
  if (!o.plan && /\.json$/i.test(topic)) { o.plan = topic; topic = ""; }
  if (o.plan) {
    const v = validatePlan(JSON.parse(fs.readFileSync(path.resolve(o.plan), "utf8")));
    if (v.errors.length) log("plan: " + v.errors.join(" | "));
    if (v.fatal) throw new Error("Plan file has fatal problems.");
    plan = v.plan;
  } else {
    if (!topic) throw new Error("Give a plan file: c2v make plans/what-is-dns.json");
    if (!cfg.llm.enabled) throw new Error(`No plan file given. Write one first:\n  1. c2v prompt "${topic}"   (copies a prompt into plans/; paste it into Claude)\n  2. save Claude's JSON reply as plans/<name>.json\n  3. c2v make plans/<name>.json`);
    plan = await writePlan(topic, { ...cfg.llm, ...(o.model ? { model: o.model } : {}), ...(o["base-url"] ? { baseUrl: o["base-url"] } : {}) }, { notes: o.notes || "" });
  }
  const slug = slugify(plan.title);
  const dir = path.resolve(o.out || path.join(ROOT, "projects", slug));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "plan.json"), JSON.stringify(plan, null, 2));
  log(`project: ${dir}`);

  const seed = o.seed === "random" ? Math.floor(Math.random() * 1e9) : o.seed ? Number(o.seed) : hashStr(plan.title);
  const style = makeStyle(seed, plan.scenes.length, { theme: o.theme || plan.theme, shader: o.shader, caption: o.caption, history: cfg.themeHistory || [] });
  log(`style: theme ${style.theme}, seed ${seed}, background ${style.shader.name}, display font ${style.fonts.display}, captions ${style.caption}, music ${style.music}`);
  cfg.themeHistory = [...(cfg.themeHistory || []), style.theme].slice(-6); saveConfig(cfg);

  const voice = await synthVoice(plan, dir, { voice: o.voice || cfg.voice, speed: Number(o.speed || cfg.speed), ttsParallel: cfg.ttsParallel, whisper: o.whisper || cfg.whisper });
  log(`voice: ${voice.total}s`);

  const { total, cues } = compose(plan, voice, style, dir, { channel: cfg.channel, handle: cfg.handle });
  log("music: generating score and sound effects");
  writeMix(mixPath(dir), makeMix({ seed, vo: voice.vo, voRate: voice.rate, total, cues, genre: style.music, musicFile: o.music && path.resolve(o.music) }));
  fs.writeFileSync(path.join(dir, "timing.json"), JSON.stringify({ total, words: voice.words, cues }, null, 1));

  if (o["no-render"] || o.render === false) { log(`done. Preview: npx hyperframes preview "${dir}"`); return dir; }
  return render(dir, o, cfg, slug);
}

async function render(dir, o, cfg, slug = path.basename(dir)) {
  if (o.lambda) {
    log("render: AWS Lambda (needs `c2v lambda-deploy` once and AWS credentials)");
    await hf(["lambda", "render", JSON.stringify(dir), "--wait", "--quality", o.quality || cfg.quality, "--fps", String(cfg.fps), "--region", cfg.lambda.region, "--stack-name", cfg.lambda.stackName]);
    return dir;
  }
  const outDir = path.join(ROOT, "videos");
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, slug + ".mp4");
  log("render: local Chrome + FFmpeg (a 45 s video takes a few minutes)");
  await hf(["render", JSON.stringify(dir), "--quality", o.quality || cfg.quality, "--fps", String(cfg.fps), "--output", JSON.stringify(out)]);
  log(`video: ${out}`);
  return out;
}

async function doctor(cfg) {
  const ok = (m) => console.log("  \x1b[32m✓\x1b[0m " + m), bad = (m) => console.log("  \x1b[31m✗\x1b[0m " + m);
  const [maj] = process.versions.node.split(".").map(Number);
  maj >= 20 ? ok("Node " + process.versions.node) : bad("Node 20+ required (you have " + process.versions.node + ")");
  try { await run("ffmpeg", ["-version"], { quiet: true }); ok("FFmpeg found"); } catch { bad("FFmpeg not found in PATH (winget install Gyan.FFmpeg)"); }
  const py = findPython();
  if (!py) bad("Python 3 not found (voice needs it). Run setup.ps1, or: winget install Python.Python.3.12");
  else try { await run(JSON.stringify(py), ["-c", JSON.stringify("import kokoro_onnx, soundfile")], { quiet: true }); ok("Python + kokoro-onnx: " + py); }
  catch { bad(`kokoro-onnx missing. Run: "${py}" -m pip install kokoro-onnx soundfile`); }
  if (cfg.llm.enabled) try {
    const r = await fetch(cfg.llm.baseUrl.replace(/\/v1\/?$/, "") + "/api/tags");
    const j = await r.json(); const names = (j.models || []).map((m) => m.name);
    ok("Ollama running" + (names.length ? ": " + names.join(", ") : ""));
    if (!names.some((n) => n.startsWith(cfg.llm.model.split(":")[0]))) bad(`Model ${cfg.llm.model} not pulled. Run: ollama pull ${cfg.llm.model}`);
  } catch { bad(`No LLM at ${cfg.llm.baseUrl}. Install Ollama (https://ollama.com) and run: ollama pull ${cfg.llm.model}`); }
  console.log("\nHyperFrames doctor:");
  await hf(["doctor"]).catch(() => {});
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, o } = parseArgs(rest);
  const cfg = loadConfig();
  if (o.render === undefined && rest.includes("--no-render")) o["no-render"] = true;
  switch (cmd) {
    case "make": await make(pos.join(" "), o, cfg); break;
    case "prompt": {
      const topic = pos.join(" ");
      if (!topic) throw new Error('Usage: c2v prompt "What is DNS?"');
      const f = path.join(ROOT, "plans", slugify(topic) + ".prompt.txt");
      fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buildPrompt(topic, o.notes || ""));
      console.log(buildPrompt(topic, o.notes || ""));
      log(`prompt saved: ${f}\nPaste it into Claude, save the JSON reply as plans/${slugify(topic)}.json, then: c2v make plans/${slugify(topic)}.json`);
      break;
    }
    case "check": {
      const v = validatePlan(JSON.parse(fs.readFileSync(path.resolve(pos[0]), "utf8")));
      const words = v.plan ? v.plan.scenes.reduce((n, s) => n + s.say.split(/\s+/).length, 0) : 0;
      if (v.errors.length) v.errors.forEach((e) => log((v.fatal ? "ERROR " : "fix ") + e)); else log(`plan OK: ${v.plan.scenes.length} scenes, ${words} words (~${Math.round(words / 2.6)} s)`);
      if (v.fatal) process.exit(1);
      break;
    }
    case "plan": {
      const plan = await writePlan(pos.join(" "), { ...cfg.llm, ...(o.model ? { model: o.model } : {}) });
      const f = path.join(ROOT, "plans", slugify(plan.title) + ".json");
      fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(plan, null, 2));
      log("plan written: " + f);
      break;
    }
    case "render": await render(path.resolve(pos[0]), o, cfg); break;
    case "batch": {
      const topics = fs.readFileSync(pos[0], "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
      for (const t of topics) { try { await make(t, { ...o }, cfg); } catch (e) { log(`FAILED "${t}": ${e.message}`); } }
      break;
    }
    case "lambda-deploy": await hf(["lambda", "deploy", "--region", cfg.lambda.region, "--stack-name", cfg.lambda.stackName]); break;
    case "doctor": await doctor(cfg); break;
    case "voices": await hf(["tts", "--list"]); break;
    case "themes": for (const [k, T] of Object.entries(THEMES)) console.log(`  ${k.padEnd(10)} ${T.dark ? "dark " : "light"}  bg ${T.bg.join("/").padEnd(26)} font ${T.display.map((d) => d[0]).join("/").padEnd(18)} music ${T.music}`); break;
    default: console.log(HELP);
  }
}

main().catch((e) => { console.error("\x1b[31m[c2v] " + e.message + "\x1b[0m"); process.exit(1); });
