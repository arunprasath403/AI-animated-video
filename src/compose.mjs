// Turns a validated plan + voice timings into a HyperFrames project folder:
// index.html (scene shells + PLAN data), engine/visual scripts, fonts, icons.
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./util.mjs";
import { installIcon } from "./icons.mjs";

const nm = (p) => path.join(ROOT, "node_modules", p);
const FONTS = [
  ["@fontsource/space-grotesk/files", "space-grotesk-latin-500-normal.woff2"], ["@fontsource/space-grotesk/files", "space-grotesk-latin-700-normal.woff2"],
  ["@fontsource/inter/files", "inter-latin-500-normal.woff2"], ["@fontsource/inter/files", "inter-latin-800-normal.woff2"],
  ["@fontsource/jetbrains-mono/files", "jetbrains-mono-latin-500-normal.woff2"], ["@fontsource/jetbrains-mono/files", "jetbrains-mono-latin-700-normal.woff2"],
  ["@fontsource/ibm-plex-mono/files", "ibm-plex-mono-latin-500-normal.woff2"], ["@fontsource/ibm-plex-mono/files", "ibm-plex-mono-latin-700-normal.woff2"],
  ["@fontsource/dm-serif-display/files", "dm-serif-display-latin-400-normal.woff2"], ["@fontsource/archivo-black/files", "archivo-black-latin-400-normal.woff2"],
  ["@fontsource/sora/files", "sora-latin-500-normal.woff2"], ["@fontsource/sora/files", "sora-latin-700-normal.woff2"],
  ["@fontsource/playfair-display/files", "playfair-display-latin-700-normal.woff2"], ["@fontsource/unbounded/files", "unbounded-latin-700-normal.woff2"],
  ["@fontsource/caveat/files", "caveat-latin-700-normal.woff2"], ["@fontsource/bebas-neue/files", "bebas-neue-latin-400-normal.woff2"],
  ["@fontsource/bangers/files", "bangers-latin-400-normal.woff2"], ["@fontsource/syne/files", "syne-latin-800-normal.woff2"],
  ["@fontsource/vt323/files", "vt323-latin-400-normal.woff2"], ["@fontsource/fraunces/files", "fraunces-latin-800-normal.woff2"],
  ["@fontsource/orbitron/files", "orbitron-latin-800-normal.woff2"], ["@fontsource/cinzel/files", "cinzel-latin-700-normal.woff2"],
];
const clean = (w) => String(w).toLowerCase().replace(/[^a-z0-9]/g, "");

function copyAssets(dir) {
  const a = path.join(dir, "assets");
  fs.mkdirSync(path.join(a, "fonts"), { recursive: true });
  fs.mkdirSync(path.join(a, "three"), { recursive: true });
  fs.copyFileSync(nm("gsap/dist/gsap.min.js"), path.join(a, "gsap.min.js"));
  for (const f of ["three.module.js", "three.core.js"]) fs.copyFileSync(nm("three/build/" + f), path.join(a, "three", f));
  for (const [d, f] of FONTS) fs.copyFileSync(nm(d + "/" + f), path.join(a, "fonts", f));
  for (const f of ["visuals.js"]) fs.copyFileSync(path.join(ROOT, "template", f), path.join(a, f));
}

// Times every scene and every cued element from the narration's word timings.
export function timePlan(plan, words, total) {
  const S = plan.scenes;
  S.forEach((sc, i) => {
    sc.t0 = i === 0 ? 0 : +Math.max(0, sc.voStart - 0.3).toFixed(3);
  });
  S.forEach((sc, i) => { sc.t1 = i < S.length - 1 ? S[i + 1].t0 : total; });
  S.forEach((sc, i) => {
    const W = words.filter((w) => w.scene === i);
    const lo = sc.t0 + 0.3, hi = Math.max(lo, sc.t1 - 0.75);
    const find = (cue, after) => {
      const c = clean(String(cue).split(/\s+/)[0]);
      if (!c) return null;
      const hit = W.find((w) => w.s >= after - 0.01 && clean(w.w) === c) || W.find((w) => w.s >= after - 0.01 && (clean(w.w).startsWith(c) || c.startsWith(clean(w.w)) && clean(w.w).length > 3));
      return hit ? hit.s - 0.08 : null;
    };
    const place = (list) => {
      const n = list.length; let prev = lo - 0.25;
      list.forEach((it, k) => {
        const even = lo + ((hi - lo) * k) / n;
        let t = find(it.cue, prev + 0.2);
        if (t === null) t = Math.max(even, prev + 0.35);
        t = Math.min(Math.max(t, prev + 0.25, lo), hi);
        it.at = +t.toFixed(3); prev = t;
      });
    };
    if (["cards", "steps", "orbit"].includes(sc.type)) place(sc.items);
    else if (sc.type === "flow") place(sc.nodes);
    else {
      const t = find(sc.cue, lo);
      sc.at = +Math.min(Math.max(t ?? lo + 0.35, lo), hi).toFixed(3);
      if (sc.type === "scale" && sc.back) { const b = find(sc.back, sc.at + 0.6); sc.backAt = b && b < sc.t1 - 0.5 ? +b.toFixed(3) : null; }
    }
  });
  return plan;
}

// Sound effect cues for the music stage, aligned to what appears on screen.
export function sfxCues(plan) {
  const cues = [];
  plan.scenes.forEach((sc, i) => {
    if (i > 0) cues.push({ t: sc.t0 - 0.2, kind: "whoosh" });
    const items = sc.items || sc.nodes;
    if (items) items.forEach((it) => cues.push({ t: it.at, kind: "pop" }));
    else if (sc.at) cues.push({ t: sc.at, kind: sc.type === "stat" ? "tick" : "pop" });
    if (sc.backAt) cues.push({ t: sc.backAt, kind: "pop" });
    if (sc.type === "hook") cues.push({ t: 0.12, kind: "impact" });
    if (sc.type === "outro") { cues.push({ t: sc.t0 - 1.2, kind: "riser" }); cues.push({ t: sc.t0 + 0.05, kind: "impact" }); }
  });
  return cues.filter((c) => c.t >= 0).sort((a, b) => a.t - b.t);
}

export function compose(plan, voice, style, dir, brand) {
  fs.mkdirSync(dir, { recursive: true });
  copyAssets(dir);
  const assets = path.join(dir, "assets");
  const ink = style.palette.ink;
  const ic = (h) => (h ? installIcon(h, assets, ink) : null);
  for (const sc of plan.scenes) {
    if (sc.icon) sc.icon = ic(sc.icon);
    for (const it of sc.items || []) if (it.icon) it.icon = ic(it.icon);
    for (const nd of sc.nodes || []) nd.icon = ic(nd.icon);
    if (sc.center) sc.center.icon = ic(sc.center.icon);
    if (sc.left) sc.left.icon = ic(sc.left.icon);
    if (sc.right) sc.right.icon = ic(sc.right.icon);
  }
  const total = voice.total;
  timePlan(plan, voice.words, total);
  const three = [];
  const first = plan.scenes[0], last = plan.scenes[plan.scenes.length - 1];
  if (first.type === "hook" && style.hookVisual) three.push({ t0: 0, t1: first.t1, visual: style.hookVisual });
  if (style.ambient3d) three.push({ t0: first.type === "hook" && style.hookVisual ? first.t1 : 0, t1: last.type === "outro" ? last.t0 : total, visual: "shards" });
  if (last.type === "outro") three.push({ t0: last.t0, t1: total, visual: style.no3d ? null : last.visual });
  for (let k = three.length - 1; k >= 0; k--) if (!three[k].visual) three.splice(k, 1);

  const P = style.palette;
  const lumOf = (h) => { const n = parseInt(h.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
  const onAccent = lumOf(P.accent) > 0.55 ? "#05070d" : "#ffffff";
  const codeKw = lumOf(P.accent) < 0.12 || lumOf(P.accent) > 0.93 ? P.accent2 : P.accent;
  const data = {
    title: plan.title, series: plan.series, duration: total, brand, style, three,
    words: voice.words.map((w) => ({ w: w.w, s: w.s, e: w.e, scene: w.scene })),
    scenes: plan.scenes.map(({ say, voStart, voEnd, ...rest }) => rest),
  };
  const css = fs.readFileSync(path.join(ROOT, "template", "style.css"), "utf8");
  const glow = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const shells = plan.scenes.map((sc, i) =>
    `      <section id="sc-${i}" class="clip" data-start="${sc.t0}" data-duration="${(sc.t1 - sc.t0 + 0.02).toFixed(3)}" data-track-index="2"><div class="inner"><div class="cam"></div></div></section>`).join("\n");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const html = `<!doctype html>
<html lang="en" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>${esc(plan.title)}</title>
    <script src="assets/gsap.min.js"></script>
    <script type="importmap">{ "imports": { "three": "./assets/three/three.module.js" } }</script>
    <style>
      :root { --ink: ${P.ink}; --muted: ${P.muted}; --accent: ${P.accent}; --accent2: ${P.accent2}; --accent-glow: ${glow(P.accent, 0.55)}; --good: ${P.good}; --bad: ${P.bad};
        --display: "${style.fonts.display}"; --display-w: ${style.fonts.displayWeight}; --body: "${style.fonts.body}"; --mono: "${style.fonts.mono}";
        --line: ${P.line}; --faint: ${P.faint}; --pkt: ${P.pkt}; --hl: ${P.hl}; --on-accent: ${onAccent}; --code-kw: ${codeKw}; --code-num: ${P.accent2}; }
${css}
    </style>
  </head>
  <body>
    <div id="root" class="card-${style.card}${style.dark ? "" : " light"}" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1080" data-height="1920">
      <div id="bg" class="clip" data-start="0" data-duration="${total}" data-track-index="0"><canvas id="bg-canvas" width="540" height="960"></canvas></div>
      <div id="three" class="clip" data-start="0" data-duration="${total}" data-track-index="1"><div id="three-wrap"><canvas id="three-canvas" width="1080" height="1920"></canvas></div></div>
${shells}
      <div id="fx" class="clip" data-start="0" data-duration="${total}" data-track-index="6"><div id="fx-layer" class="full"></div></div>
${style.letterbox ? `      <div id="letterbox" class="clip" data-start="0" data-duration="${total}" data-track-index="7"><div class="bars" style="top:0"></div><div class="bars" style="bottom:0"></div></div>\n` : ""}      <div id="progress" class="clip" data-start="0" data-duration="${total}" data-track-index="8"><div class="prog">${plan.scenes.map((_, i) => `<span class="seg"><i id="seg-${i}"></i></span>`).join("")}</div></div>
      <div id="brand" class="clip" data-start="0" data-duration="${total}" data-track-index="3">
        <div class="brand"><span class="brand-dot"></span>${esc(brand.channel)}</div>
        <div class="ep">${esc(plan.series || "")}</div>
      </div>
      <div id="captions" class="clip" data-start="0" data-duration="${total}" data-track-index="4"><div class="cap"><div class="cap-pill" id="cap-pill"></div></div></div>
      <audio id="mix" src="assets/mix.wav" data-start="0" data-duration="${total}" data-track-index="5"></audio>
    </div>
    <script>window.PLAN = ${JSON.stringify(data)};</script>
    <script>
${fs.readFileSync(path.join(ROOT, "template", "engine.js"), "utf8")}
    </script>
    <script type="module" src="assets/visuals.js"></script>
  </body>
</html>
`;
  fs.writeFileSync(path.join(dir, "index.html"), html);
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ id: path.basename(dir), name: plan.title, createdAt: new Date().toISOString() }, null, 2));
  fs.writeFileSync(path.join(dir, "hyperframes.json"), JSON.stringify({ $schema: "https://hyperframes.heygen.com/schema/hyperframes.json", paths: { blocks: "compositions", components: "compositions/components", assets: "assets" } }, null, 2));
  return { total, cues: sfxCues(plan) };
}
