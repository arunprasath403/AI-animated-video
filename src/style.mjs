// Art direction. Every video gets a THEME (a whole visual language: background, type,
// cards, captions, transitions, music genre) plus seeded variation inside it.
// Themes rotate so consecutive videos never share a look.
import { rng } from "./util.mjs";

const hex = (h) => parseInt(h.slice(1), 16);
const toHex = (n) => "#" + n.toString(16).padStart(6, "0");
export function mix(a, b, k) { const A = hex(a), B = hex(b); const c = [16, 8, 0].map((s) => Math.round(((A >> s) & 255) * (1 - k) + ((B >> s) & 255) * k)); return toHex((c[0] << 16) | (c[1] << 8) | c[2]); }

const F = {
  grotesk: ["Grotesk", 700], inter: ["Inter", 700], serif: ["DMSerif", 400], archivo: ["Archivo", 400], sora: ["Sora", 700],
  playfair: ["Playfair", 700], unbounded: ["Unbounded", 700], jet: ["Mono", 500], plex: ["Plex", 500],
  caveat: ["Caveat", 700], bebas: ["Bebas", 400], bangers: ["Bangers", 400], syne: ["Syne", 800], vt: ["VT323", 400],
  fraunces: ["Fraunces", 800], orbitron: ["Orbitron", 800], cinzel: ["Cinzel", 700],
};

// Each theme: background shader(s), fonts, card + caption style, transitions, music genre,
// hook layouts and 3D moments, plus palettes. Themes from `outrun` on use a `bg` triple per
// palette: [base, feature, second feature] for the shader.
export const THEMES = {
  neon: {
    dark: true, bg: ["smoke", "aurora", "grid", "bokeh"], display: [F.grotesk, F.inter], body: "Grotesk", mono: F.jet, card: "glass",
    captions: ["pill", "clean", "block"], transitions: ["slide", "zoom", "rise", "flip"], music: "synthwave", hook: ["center"], three: ["warp", "particles"],
    palettes: [
      { accent: "#ff9900", accent2: "#5ee7ff" }, { accent: "#3ddc97", accent2: "#8b7bff" }, { accent: "#4f8cff", accent2: "#ff5ec4" },
      { accent: "#c6ff3d", accent2: "#3dd6ff" }, { accent: "#ff4f8b", accent2: "#5effc1" }, { accent: "#b388ff", accent2: "#ffb86b" },
    ],
  },
  paper: {
    dark: false, bg: ["paper"], display: [F.serif], body: "Inter", mono: F.plex, card: "paper",
    captions: ["ink"], transitions: ["wipe", "push", "iris"], music: "lofi", hook: ["type", "center"], three: [],
    palettes: [
      { accent: "#ff4d2e", accent2: "#2353ff", paper: "#f4efe6" }, { accent: "#0f9d58", accent2: "#ff8a00", paper: "#f1f4ec" },
      { accent: "#7b2cff", accent2: "#ff3d7f", paper: "#f5f0f7" }, { accent: "#e63946", accent2: "#1d3557", paper: "#f6f1e7" },
    ],
  },
  blueprint: {
    dark: true, bg: ["blueprint"], display: [F.sora], body: "Sora", mono: F.plex, card: "outline",
    captions: ["mono"], transitions: ["slice", "slide", "iris"], music: "minimal", hook: ["type"], three: ["particles"],
    palettes: [{ accent: "#ffd23f", accent2: "#7ee8fa", base: "#0b2a5b" }, { accent: "#ff7a59", accent2: "#c9e4ff", base: "#0a2342" }, { accent: "#5cffb0", accent2: "#ffffff", base: "#102a4c" }],
  },
  brutal: {
    dark: false, bg: ["blocks"], display: [F.archivo], body: "Inter", mono: F.jet, card: "brutal",
    captions: ["brutal"], transitions: ["wipe", "slice", "push"], music: "punchy", hook: ["type"], three: [],
    palettes: [
      { accent: "#111111", accent2: "#ff3d7f", blocks: ["#ffd400", "#ff5ca8", "#00d1ff", "#b6ff3b", "#ff7a00", "#a78bfa"] },
      { accent: "#111111", accent2: "#2b59ff", blocks: ["#f4f1de", "#e07a5f", "#81b29a", "#f2cc8f", "#3d405b", "#ffd166"] },
      { accent: "#111111", accent2: "#ff2e2e", blocks: ["#ffffff", "#ffe600", "#ff2e2e", "#00e0a4", "#4d7cff", "#ffb3c7"] },
    ],
  },
  glass: {
    dark: true, bg: ["mesh"], display: [F.unbounded, F.sora], body: "Sora", mono: F.jet, card: "frost",
    captions: ["frost"], transitions: ["zoom", "iris", "rise"], music: "uplift", hook: ["center"], three: ["particles", "warp"],
    palettes: [
      { accent: "#ffffff", accent2: "#ffe14d", mesh: ["#6a00ff", "#ff2e93", "#ff8a00"] }, { accent: "#ffffff", accent2: "#7dffda", mesh: ["#0057ff", "#00c2ff", "#7b2cff"] },
      { accent: "#ffffff", accent2: "#ffd6a5", mesh: ["#ff4e50", "#f9d423", "#d62a8a"] }, { accent: "#ffffff", accent2: "#b9fbc0", mesh: ["#0f9b8e", "#2948ff", "#00d9a6"] },
    ],
  },
  cinema: {
    dark: true, bg: ["cinema"], display: [F.playfair], body: "Inter", mono: F.jet, card: "cinema",
    captions: ["subtitle"], transitions: ["dip", "zoom", "push"], music: "cinematic", hook: ["center", "type"], three: ["shards"],
    palettes: [{ accent: "#e8c37a", accent2: "#7aa7e8" }, { accent: "#e86b5a", accent2: "#e8c37a" }, { accent: "#9be7c4", accent2: "#e8c37a" }],
  },
  outrun: {
    dark: true, bg: ["sunset"], display: [F.orbitron], body: "Sora", mono: F.jet, card: "outrun",
    captions: ["outrun"], transitions: ["slide", "zoom", "glitch"], music: "outrun", hook: ["center", "type"], three: ["warp"],
    palettes: [
      { accent: "#ff3cac", accent2: "#2bd2ff", bg: ["#140027", "#2bd2ff", "#ff3cac"] },
      { accent: "#ff7b00", accent2: "#c86bff", bg: ["#16001f", "#c86bff", "#ff7b00"] },
      { accent: "#f9f871", accent2: "#ff4fd8", bg: ["#0d0221", "#ff4fd8", "#ff9a3c"] },
    ],
  },
  terminal: {
    dark: true, bg: ["rain"], display: [F.vt], body: "Mono", mono: F.jet, card: "terminal",
    captions: ["term"], transitions: ["slice", "glitch", "slide"], music: "dark", hook: ["type"], three: ["warp"], muted: "#7fbf8f",
    palettes: [
      { accent: "#39ff6a", accent2: "#c6ff7a", bg: ["#010703", "#39ff6a", "#c6ff7a"] },
      { accent: "#ffb000", accent2: "#ffd36b", bg: ["#080500", "#ffb000", "#ffe6a6"] },
      { accent: "#4dd8ff", accent2: "#b4f3ff", bg: ["#00060a", "#4dd8ff", "#c6f6ff"] },
    ],
  },
  comic: {
    dark: false, bg: ["burst"], display: [F.bangers], body: "Inter", mono: F.jet, card: "comic",
    captions: ["comic"], transitions: ["zoom", "wipe", "flash"], music: "bounce", hook: ["center", "type"], three: [], hl: "#e0262f",
    palettes: [
      { accent: "#e0262f", accent2: "#1e5bff", bg: ["#ffd93d", "#ffbf1f", "#e0262f"] },
      { accent: "#1e5bff", accent2: "#ff2d8a", bg: ["#7fd8ff", "#4cc3ff", "#1e5bff"] },
      { accent: "#ff2d8a", accent2: "#00b37a", bg: ["#ffb3d1", "#ff8fbd", "#ff2d8a"] },
    ],
  },
  swiss: {
    dark: false, bg: ["dots"], display: [F.inter], body: "Inter", mono: F.plex, card: "swiss",
    captions: ["swiss"], transitions: ["slice", "push", "slide"], music: "minimal", hook: ["type"], three: [],
    palettes: [
      { accent: "#e3000f", accent2: "#111111", bg: ["#f2f0eb", "#111111", "#e3000f"] },
      { accent: "#0047ff", accent2: "#111111", bg: ["#eeeeea", "#111111", "#0047ff"] },
      { accent: "#ff5a00", accent2: "#111111", bg: ["#f4f1e8", "#111111", "#ff5a00"] },
    ],
  },
  cosmos: {
    dark: true, bg: ["nebula"], display: [F.syne, F.sora], body: "Sora", mono: F.jet, card: "cosmos",
    captions: ["clean", "frost"], transitions: ["zoom", "rise", "iris"], music: "ambient", hook: ["center"], three: ["particles", "globe"], muted: "#b9b4e6",
    palettes: [
      { accent: "#ffb2f0", accent2: "#7ad8ff", bg: ["#04020d", "#6c2bd9", "#ff4fa3"] },
      { accent: "#ffd27a", accent2: "#8fa8ff", bg: ["#020510", "#1c4bd6", "#ff8a3d"] },
      { accent: "#7affd8", accent2: "#c49bff", bg: ["#02060a", "#0f8f8a", "#8a3dff"] },
    ],
  },
  circuit: {
    dark: true, bg: ["circuit"], display: [F.orbitron, F.sora], body: "Sora", mono: F.plex, card: "chip",
    captions: ["mono"], transitions: ["slice", "iris", "glitch"], music: "dark", hook: ["center", "type"], three: ["globe"], muted: "#9cc9b4",
    palettes: [
      { accent: "#ffd23f", accent2: "#3dffb0", bg: ["#03140d", "#2f8f63", "#ffd23f"] },
      { accent: "#ff6b3d", accent2: "#3dd6ff", bg: ["#020d16", "#22708f", "#ff6b3d"] },
      { accent: "#c6ff3d", accent2: "#ff4fd8", bg: ["#0a0614", "#5a3d8f", "#c6ff3d"] },
    ],
  },
  chalk: {
    dark: true, bg: ["chalk"], display: [F.caveat], body: "Inter", mono: F.jet, card: "chalk",
    captions: ["chalk"], transitions: ["push", "rise", "iris"], music: "lofi", hook: ["center", "type"], three: [], muted: "#cfd8cf",
    palettes: [
      { accent: "#ffe066", accent2: "#8fd3ff", bg: ["#1d2b24", "#dfe8df", "#ffe066"] },
      { accent: "#ff9ec7", accent2: "#9dffb0", bg: ["#22262b", "#e6e6e6", "#ff9ec7"] },
      { accent: "#7fe0ff", accent2: "#ffd27f", bg: ["#18242e", "#dde6ee", "#7fe0ff"] },
    ],
  },
  holo: {
    dark: true, bg: ["holo"], display: [F.syne, F.unbounded], body: "Sora", mono: F.jet, card: "holo",
    captions: ["frost"], transitions: ["zoom", "flip", "rise"], music: "house", hook: ["center"], three: ["particles"], muted: "#e3dcf5",
    palettes: [
      { accent: "#ffffff", accent2: "#b6f9ff", bg: ["#0b0816", "#c9b8ff", "#7affe1"] },
      { accent: "#ffffff", accent2: "#ffc6f0", bg: ["#0a0a12", "#ffd1f0", "#a8e6ff"] },
    ],
  },
  noir: {
    dark: true, bg: ["noir"], display: [F.serif, F.playfair], body: "Inter", mono: F.plex, card: "noir",
    captions: ["noir"], transitions: ["dip", "push", "slice"], music: "jazz", hook: ["type", "center"], three: [], muted: "#a8a8a8",
    palettes: [
      { accent: "#e8e8e8", accent2: "#e3262f", bg: ["#030303", "#d9d9d9", "#e3262f"] },
      { accent: "#e8e8e8", accent2: "#f2b134", bg: ["#030303", "#d4d0c8", "#f2b134"] },
    ],
  },
  topo: {
    dark: false, bg: ["topo"], display: [F.fraunces], body: "Inter", mono: F.plex, card: "topo",
    captions: ["ink"], transitions: ["wipe", "iris", "push"], music: "ambient", hook: ["type", "center"], three: [],
    palettes: [
      { accent: "#c2541b", accent2: "#2f6b4f", bg: ["#efe7d6", "#8a6a43", "#2f6b4f"] },
      { accent: "#1f5f8b", accent2: "#c98a1b", bg: ["#e9eee8", "#4c7a8a", "#c98a1b"] },
      { accent: "#7a3b8f", accent2: "#d9534f", bg: ["#f1e9e4", "#8a5a6a", "#d9534f"] },
    ],
  },
  glitch: {
    dark: true, bg: ["crt"], display: [F.vt, F.orbitron], body: "Mono", mono: F.jet, card: "crt",
    captions: ["glitch"], transitions: ["glitch", "flash", "slice"], music: "chip", hook: ["type", "center"], three: ["warp"], muted: "#9db4c0",
    palettes: [
      { accent: "#00f0ff", accent2: "#ff2a6d", bg: ["#05060a", "#00f0ff", "#ff2a6d"] },
      { accent: "#b6ff00", accent2: "#ff00e6", bg: ["#050805", "#b6ff00", "#ff00e6"] },
    ],
  },
  ocean: {
    dark: true, bg: ["ocean"], display: [F.sora, F.fraunces], body: "Sora", mono: F.jet, card: "frost",
    captions: ["frost"], transitions: ["rise", "zoom", "iris"], music: "ambient", hook: ["center"], three: ["particles", "globe"], muted: "#bfe3ea",
    palettes: [
      { accent: "#7affea", accent2: "#ffd27a", bg: ["#022a3a", "#7affea", "#2bb3c0"] },
      { accent: "#8fd0ff", accent2: "#ff9e7a", bg: ["#04213f", "#8fd0ff", "#3d7bd9"] },
    ],
  },
  pastel: {
    dark: false, bg: ["pastel"], display: [F.syne, F.unbounded], body: "Inter", mono: F.plex, card: "soft",
    captions: ["soft"], transitions: ["rise", "zoom", "iris"], music: "house", hook: ["center", "type"], three: [],
    palettes: [
      { accent: "#6b4eff", accent2: "#ff6fa5", bg: ["#fbf6f0", "#ffc8dd", "#bde0fe"] },
      { accent: "#0f9d7a", accent2: "#ff8a5b", bg: ["#f6fbf4", "#caffbf", "#ffd6a5"] },
      { accent: "#e2475b", accent2: "#4a6cff", bg: ["#fdf7f2", "#ffd6e0", "#cdb4ff"] },
    ],
  },
  riso: {
    dark: false, bg: ["riso"], display: [F.bebas], body: "Inter", mono: F.plex, card: "riso",
    captions: ["riso"], transitions: ["wipe", "slice", "push"], music: "bounce", hook: ["type"], three: [],
    palettes: [
      { accent: "#ff48b0", accent2: "#0078bf", bg: ["#f3eee3", "#ff48b0", "#0078bf"] },
      { accent: "#ff6c2f", accent2: "#00a95c", bg: ["#f4efe4", "#ff6c2f", "#00a95c"] },
      { accent: "#765ba7", accent2: "#ffe800", bg: ["#f2ede2", "#ffe800", "#765ba7"] },
    ],
  },
  luxe: {
    dark: true, bg: ["deco"], display: [F.cinzel], body: "Inter", mono: F.plex, card: "luxe",
    captions: ["luxe"], transitions: ["dip", "iris", "zoom"], music: "orchestral", hook: ["center"], three: ["particles"], muted: "#c9b98f",
    palettes: [
      { accent: "#e6c27a", accent2: "#f5e6c4", bg: ["#050403", "#e6c27a", "#8a6a2f"] },
      { accent: "#d8d8e0", accent2: "#a7c7e7", bg: ["#04050a", "#c9ccd6", "#3d4a6b"] },
    ],
  },
  kinetic: {
    dark: true, bg: ["speed"], display: [F.bebas], body: "Inter", mono: F.jet, card: "kinetic",
    captions: ["kinetic"], transitions: ["push", "flash", "glitch", "slice"], music: "trap", hook: ["type"], three: ["warp"],
    palettes: [
      { accent: "#d7ff1f", accent2: "#ff3b3b", bg: ["#07090f", "#d7ff1f", "#ff3b3b"] },
      { accent: "#ff5c00", accent2: "#00c2ff", bg: ["#0a0706", "#ff5c00", "#00c2ff"] },
      { accent: "#00f5a0", accent2: "#ff2bd6", bg: ["#050a09", "#00f5a0", "#ff2bd6"] },
    ],
  },
};
export const BG_MODES = ["smoke", "aurora", "grid", "bokeh", "paper", "blueprint", "mesh", "blocks", "cinema",
  "sunset", "rain", "burst", "dots", "nebula", "circuit", "chalk", "holo", "noir", "topo", "crt", "ocean", "pastel", "riso", "deco", "speed"];
export const THEME_NAMES = Object.keys(THEMES);

// Picks a theme different from the last few videos (history lives in c2v.config.json).
export function pickTheme(seed, history = [], forced) {
  if (forced && THEMES[forced]) return forced;
  const r = rng(seed * 13 + 1);
  const fresh = THEME_NAMES.filter((t) => !history.slice(-3).includes(t));
  return r.pick(fresh.length ? fresh : THEME_NAMES);
}

export function makeStyle(seed, sceneCount, overrides = {}) {
  const r = rng(seed);
  const themeName = overrides.theme && THEMES[overrides.theme] ? overrides.theme : pickTheme(seed, overrides.history || []);
  const T = THEMES[themeName];
  const pal = { ...r.pick(T.palettes) };
  if (overrides.palette) Object.assign(pal, { accent: overrides.palette.accent || pal.accent });
  const [displayFont, displayWeight] = r.pick(T.display);
  const dark = T.dark;
  const ink = dark ? "#f5f6fa" : "#141414";
  const palette = {
    ...pal, ink, muted: T.muted || (dark ? (themeName === "blueprint" ? "#a9c1e6" : themeName === "glass" ? "#fff3fb" : "#9aa6bf") : "#55524d"),
    good: dark ? "#3ddc84" : "#0a9c55", bad: dark ? "#ff5a5f" : "#e0262f",
    line: dark ? "rgba(255,255,255,0.28)" : "rgba(17,17,17,0.35)", faint: dark ? "rgba(255,255,255,0.09)" : "rgba(17,17,17,0.10)",
    hl: T.hl || (themeName === "brutal" ? "#ffe600" : themeName === "glass" || pal.accent === "#ffffff" ? pal.accent2 : pal.accent),
    pkt: dark ? "#ffffff" : pal.accent2, bar: pal.accent,
  };
  // background tint per scene
  let sceneTint;
  if (themeName === "brutal") { const order = [...pal.blocks].sort(() => r() - 0.5); sceneTint = Array.from({ length: sceneCount }, (_, i) => [order[i % order.length], "#111111"]); }
  else if (themeName === "paper") sceneTint = Array.from({ length: sceneCount }, (_, i) => [mix(i % 2 ? pal.accent2 : pal.accent, pal.paper, 0.78), mix(i % 2 ? pal.accent : pal.accent2, pal.paper, 0.82), pal.paper]);
  else if (themeName === "blueprint") sceneTint = Array.from({ length: sceneCount }, () => [pal.base, pal.accent2]);
  else if (themeName === "glass") sceneTint = Array.from({ length: sceneCount }, (_, i) => { const m = pal.mesh; return [m[i % 3], m[(i + 1) % 3], m[(i + 2) % 3]]; });
  else if (themeName === "cinema") sceneTint = Array.from({ length: sceneCount }, (_, i) => [mix(pal.accent, "#000000", 0.55), mix(i % 2 ? pal.accent2 : pal.accent, "#000000", 0.4)]);
  else if (pal.bg) sceneTint = Array.from({ length: sceneCount }, (_, i) => (i % 2 ? [pal.bg[0], pal.bg[2], pal.bg[1]] : [...pal.bg]));
  else { const deepA = mix(pal.accent2, "#04060c", 0.55), deepB = mix(pal.accent, "#04060c", 0.5); sceneTint = Array.from({ length: sceneCount }, (_, i) => (i % 2 ? [deepB, pal.accent2] : [deepA, pal.accent])); }

  const bgName = overrides.shader && T.bg.includes(overrides.shader) ? overrides.shader : r.pick(T.bg);
  const transitions = [];
  for (let i = 0; i < sceneCount; i++) { let t; do t = r.pick(T.transitions); while (i && t === transitions[i - 1] && T.transitions.length > 1); transitions.push(t); }
  return {
    seed, theme: themeName, dark, palette, sceneTint,
    shader: { mode: BG_MODES.indexOf(bgName), name: bgName, warp: +r.range(2.2, 3.4).toFixed(2), speed: +r.range(0.08, 0.16).toFixed(3), scale: +r.range(1.1, 1.8).toFixed(2) },
    transitions,
    caption: overrides.caption || r.pick(T.captions),
    fonts: { display: displayFont, displayWeight, body: T.body, mono: T.mono[0] },
    card: T.card,
    hook: r.pick(T.hook),
    no3d: !T.three.length,
    hookVisual: T.three.length ? r.pick(T.three.filter((v) => v !== "shards").length ? T.three.filter((v) => v !== "shards") : ["particles"]) : null,
    ambient3d: T.three.includes("shards"),
    music: T.music,
    camera: r.pick(["push", "drift", "float"]),
    letterbox: themeName === "cinema",
    tilt: themeName === "neon" ? +r.range(-0.3, 0.3).toFixed(2) : 0,
  };
}
