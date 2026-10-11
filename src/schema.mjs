// The scene vocabulary the script writer may use, plus a forgiving validator
// that repairs what small local models get wrong.
export const SCENE_DOCS = `
Scene types (pick the ones that best SHOW the idea; never use one type more than twice):
- hook:    {"type":"hook","say":"...","kicker":"2-4 word label","title":"short punchy headline (max 6 words)","highlight":"one word from title","icon":"hint"}
- stat:    {"type":"stat","say":"...","value":"a number like 100000, 99.9, 10x","prefix":"$ or empty","suffix":"%, x, + or empty","label":"what the number means","icon":"hint","cue":"word"}
- cards:   {"type":"cards","say":"...","items":[{"icon":"hint","kicker":"2-3 words","name":"1-2 words","desc":"max 4 words","cue":"word"}]}   (2-3 items)
- flow:    {"type":"flow","say":"...","group":{"label":"e.g. AWS Cloud","from":1},"nodes":[{"icon":"hint","name":"1-3 words","desc":"max 4 words","cue":"word"}],"reply":true}   (3-6 nodes, a request travels through them in order; group is optional and boxes nodes from index "from" onward; reply sends a response back)
- chart:   {"type":"chart","say":"...","label":"chart title","values":[8 to 12 numbers],"line":true,"legend":["series name","bar name"],"cue":"word"}
- compare: {"type":"compare","say":"...","mode":"versus | neutral","left":{"title":"old way","icon":"hint","points":["max 3 words",...]},"right":{"title":"new way","icon":"hint","points":[...]},"cue":"word"}   (2-3 points each; right side appears at cue; "versus" = bad vs good with ✕/✓, "neutral" = two fair options)
- steps:   {"type":"steps","say":"...","title":"short title","items":[{"text":"max 5 words","icon":"hint","cue":"word"}]}   (3-5 items)
- code:    {"type":"code","say":"...","file":"filename.ext","lines":["real code, max 32 chars per line", ...],"cue":"word"}   (3-7 lines)
- scale:   {"type":"scale","say":"...","label":"what is scaling","icon":"hint","from":2,"to":10,"unit":"servers","cue":"word","back":"word"}   (back is optional: a cue word where it shrinks back to "from")
- orbit:   {"type":"orbit","say":"...","center":{"icon":"hint","name":"1-2 words"},"items":[{"icon":"hint","name":"1-2 words","cue":"word"}]}   (3-6 items around a central idea)
- outro:   {"type":"outro","say":"...","title":"closing line (max 6 words)","highlight":"one word from title","sub":"short tagline","next":"NEXT: next topic?","visual":"globe | particles","icon":"hint"}
`;

export const RULES = `
Rules:
- 6 to 8 scenes. First scene is "hook", last is "outro".
- "say" is the narration for that scene: 1-2 short spoken sentences, simple words, active voice, no emoji, no markdown. Whole video 90-150 words.
- Every "cue" MUST be a single word copied exactly from that scene's "say"; the visual appears when the narrator says it.
- "icon" values are short hints: a product or brand name ("docker", "aws lambda", "postgres", "github", "react") or a plain noun ("server", "database", "user", "lock", "laptop", "cloud", "code", "brain", "money", "globe").
- Explain one idea per scene; show it, don't just list it. Prefer flow, orbit, compare, scale, code and stat scenes over plain cards.
- Facts must be accurate. Numbers must be realistic.
- Output ONLY a JSON object: {"title":"...","series":"2-3 word topic label","scenes":[...]}.
`;

const TYPES = ["hook", "stat", "cards", "flow", "chart", "compare", "steps", "code", "scale", "orbit", "outro"];
const str = (v, d = "") => (v === undefined || v === null ? d : String(v)).trim();
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const num = (v, d) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : d; };
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export function validatePlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== "object") return { errors: ["Output is not a JSON object."] };
  let scenes = arr(plan.scenes).filter((s) => s && typeof s === "object");
  if (scenes.length < 3) errors.push("Need at least 3 scenes.");
  scenes = scenes.map((s, i) => {
    let type = str(s.type).toLowerCase();
    if (!TYPES.includes(type)) { errors.push(`Scene ${i + 1}: unknown type "${s.type}", replaced with cards.`); type = "cards"; }
    const say = str(s.say || s.narration || s.text);
    if (!say) errors.push(`Scene ${i + 1}: missing "say".`);
    const o = { ...s, type, say };
    const items = (k, lo, hi) => { o[k] = arr(s[k]).slice(0, hi); if (o[k].length < lo) errors.push(`Scene ${i + 1} (${type}): needs at least ${lo} ${k}.`); };
    switch (type) {
      case "hook": o.title = cut(str(s.title, plan.title), 48); o.kicker = cut(str(s.kicker), 28); o.highlight = str(s.highlight); o.icon = str(s.icon, "sparkles"); break;
      case "stat": o.value = str(s.value, "0"); o.prefix = str(s.prefix); o.suffix = str(s.suffix); o.label = cut(str(s.label), 40); o.icon = str(s.icon, "chart"); break;
      case "cards": items("items", 1, 3); o.items = o.items.map((it) => ({ icon: str(it.icon, "box"), kicker: cut(str(it.kicker), 22), name: cut(str(it.name || it.title), 16), desc: cut(str(it.desc || it.description), 32), cue: str(it.cue) })); break;
      case "flow": items("nodes", 2, 6); o.nodes = o.nodes.map((n) => ({ icon: str(n.icon || n.name, "box"), name: cut(str(n.name), 20), desc: cut(str(n.desc), 28), cue: str(n.cue) }));
        o.group = s.group && str(s.group.label) ? { label: cut(str(s.group.label), 22), from: Math.max(0, Math.min(o.nodes.length - 1, Math.round(num(s.group.from, 1)))) } : null; o.reply = s.reply !== false; break;
      case "chart": o.values = arr(s.values).map((v) => num(v, 0)).filter((v) => v >= 0).slice(0, 14); if (o.values.length < 3) o.values = [2, 3, 2.5, 5, 8, 6, 3, 2, 4, 9, 6, 3];
        o.label = cut(str(s.label), 30); o.legend = arr(s.legend).map((x) => cut(str(x), 16)).slice(0, 2); o.line = s.line !== false; break;
      case "compare": o.mode = str(s.mode) === "neutral" ? "neutral" : "versus"; for (const side of ["left", "right"]) { const x = s[side] || {}; o[side] = { title: cut(str(x.title, side === "left" ? "Before" : "After"), 18), icon: str(x.icon, side === "left" ? "circle-x" : "circle-check"), points: arr(x.points).map((p) => cut(str(p), 22)).slice(0, 3) }; } break;
      case "steps": items("items", 2, 5); o.items = o.items.map((it) => (typeof it === "string" ? { text: cut(it, 34), icon: "", cue: "" } : { text: cut(str(it.text || it.name), 34), icon: str(it.icon), cue: str(it.cue) })); o.title = cut(str(s.title), 30); break;
      case "code": o.lines = arr(s.lines).map((l) => str(l).replace(/\t/g, "  ").slice(0, 40)).slice(0, 8); if (!o.lines.length) errors.push(`Scene ${i + 1}: code needs lines.`); o.file = cut(str(s.file, "main.py"), 24); break;
      case "scale": o.from = Math.max(1, Math.min(12, Math.round(num(s.from, 2)))); o.to = Math.max(o.from + 1, Math.min(12, Math.round(num(s.to, 10)))); o.icon = str(s.icon, "server"); o.unit = cut(str(s.unit, "servers"), 14); o.label = cut(str(s.label, "traffic"), 24); o.back = str(s.back); break;
      case "orbit": items("items", 2, 6); o.center = { icon: str(s.center?.icon || s.center?.name, "sparkles"), name: cut(str(s.center?.name), 16) }; o.items = o.items.map((it) => ({ icon: str(it.icon || it.name, "box"), name: cut(str(it.name), 14), cue: str(it.cue) })); break;
      case "outro": o.title = cut(str(s.title, plan.title), 44); o.highlight = str(s.highlight); o.sub = cut(str(s.sub), 40); o.next = cut(str(s.next), 40); o.visual = ["globe", "particles"].includes(str(s.visual)) ? str(s.visual) : "particles"; o.icon = str(s.icon); break;
    }
    return o;
  });
  if (scenes.length && scenes[scenes.length - 1].type !== "outro") errors.push('Last scene must be "outro".');
  const words = scenes.reduce((n, s) => n + s.say.split(/\s+/).filter(Boolean).length, 0);
  if (words > 190) errors.push(`Narration is ${words} words; keep it under 150.`);
  return { plan: { title: str(plan.title, "Untitled"), series: cut(str(plan.series), 22), ...(plan.theme ? { theme: str(plan.theme) } : {}), scenes }, errors, fatal: errors.some((e) => /at least|missing|not a JSON|needs lines/.test(e)) };
}
