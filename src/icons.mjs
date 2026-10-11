// Resolves free-text icon hints ("docker", "aws lambda", "database") to a local SVG.
// Sources (all free): aws-icons (MIT, official AWS set), simple-icons (CC0 brand logos),
// lucide-static (ISC, generic glyphs).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = (name) => path.join(ROOT, "node_modules", name);

const norm = (s) => String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
const squash = (s) => norm(s).replace(/ /g, "");

let CAT = null;
function catalog() {
  if (CAT) return CAT;
  const aws = new Map();
  const awsDir = path.join(pkgDir("aws-icons"), "icons");
  for (const sub of ["architecture-service", "architecture-group", "resource"]) {
    const d = path.join(awsDir, sub);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith(".svg")) continue;
      const base = f.slice(0, -4);
      const plain = base.replace(/^(Amazon|AWS)/, "");
      const entry = { file: path.join(d, f), kind: sub === "architecture-service" ? "aws" : "awsres", id: "aws-" + base };
      for (const k of [squash(base), squash(plain), squash(base.replace(/([a-z])([A-Z])/g, "$1 $2"))]) if (k && !aws.has(k)) aws.set(k, entry);
    }
  }
  const brands = new Map();
  const siDir = pkgDir("simple-icons");
  const si = JSON.parse(fs.readFileSync(path.join(siDir, "data", "simple-icons.json"), "utf8"));
  for (const it of si) {
    const entry = { file: path.join(siDir, "icons", it.slug + ".svg"), kind: "brand", hex: it.hex, id: "si-" + it.slug };
    const keys = [squash(it.title), squash(it.slug)];
    for (const a of (it.aliases && it.aliases.aka) || []) keys.push(squash(a));
    for (const k of keys) if (k && !brands.has(k)) brands.set(k, entry);
  }
  const glyphs = new Map();
  const lcDir = pkgDir("lucide-static");
  const tags = JSON.parse(fs.readFileSync(path.join(lcDir, "tags.json"), "utf8"));
  for (const f of fs.readdirSync(path.join(lcDir, "icons"))) {
    const name = f.slice(0, -4);
    glyphs.set(name, { file: path.join(lcDir, "icons", f), kind: "glyph", id: "lc-" + name, tags: [name.replace(/-/g, " "), ...(tags[name] || [])].map(norm) });
  }
  const custom = new Map();
  const cDir = path.join(ROOT, "template", "icons");
  if (fs.existsSync(cDir)) for (const f of fs.readdirSync(cDir)) if (f.endsWith(".svg")) custom.set(squash(f.slice(0, -4)), { file: path.join(cDir, f), kind: "logo", id: "c-" + f.slice(0, -4) });
  custom.set("amazonwebservices", custom.get("aws"));
  CAT = { aws, brands, glyphs, custom };
  return CAT;
}

const AWS_ALIAS = {
  s3: "AmazonSimpleStorageService", sqs: "AmazonSimpleQueueService", sns: "AmazonSimpleNotificationService", iam: "AWSIdentityandAccessManagement",
  ecs: "AmazonElasticContainerService", eks: "AmazonElasticKubernetesService", elb: "ElasticLoadBalancing", alb: "ElasticLoadBalancing",
  loadbalancer: "ElasticLoadBalancing", vpc: "AmazonVirtualPrivateCloud", apigateway: "AmazonAPIGateway", stepfunctions: "AWSStepFunctions",
  autoscaling: "AmazonEC2AutoScaling", cloud: "AWSCloud",
};
const LUCIDE_BRANDS = new Set(["github", "gitlab", "figma", "chrome", "slack", "twitter", "youtube", "twitch", "instagram", "facebook", "linkedin", "codepen", "codesandbox", "dribbble", "framer", "trello", "pocket", "chromium"]);
const BRAND_ALIAS = { postgres: "postgresql", k8s: "kubernetes", js: "javascript", ts: "typescript", node: "nodedotjs", nodejs: "nodedotjs", golang: "go", mongo: "mongodb", gcp: "googlecloud", vscode: "visualstudiocode", hf: "huggingface" };

// Common words a script writer uses, mapped to good generic glyphs.
const SYN = {
  user: "user", users: "users", people: "users", person: "user", you: "user", customer: "user", developer: "code-xml",
  server: "server", servers: "server", computer: "monitor", laptop: "laptop", phone: "smartphone", mobile: "smartphone", app: "app-window",
  database: "database", db: "database", sql: "database", storage: "hard-drive", disk: "hard-drive", file: "file", files: "files",
  cloud: "cloud", azure: "cloud", microsoftazure: "cloud", microsoft: "app-window", openai: "brain-circuit", internet: "globe", web: "globe", world: "globe", network: "network", api: "webhook", request: "send", response: "reply",
  code: "code-xml", terminal: "square-terminal", cli: "square-terminal", bug: "bug", security: "shield-check", lock: "lock", key: "key-round",
  money: "badge-dollar-sign", cost: "badge-dollar-sign", price: "badge-dollar-sign", time: "timer", fast: "zap", speed: "gauge", lightning: "zap",
  ai: "brain-circuit", llm: "brain-circuit", gpt: "brain-circuit", neural: "brain-circuit", brain: "brain", model: "brain-circuit", robot: "bot", chat: "messages-square", message: "message-square", email: "mail",
  container: "container", box: "box", package: "package", queue: "list-ordered", cache: "layers", layers: "layers", stack: "layers",
  chart: "chart-column", graph: "chart-line", data: "database-zap", search: "search", settings: "settings", gear: "settings", check: "circle-check",
  error: "circle-x", warning: "triangle-alert", load: "scale", balancer: "scale", router: "router", wifi: "wifi", git: "git-branch", branch: "git-branch",
  question: "circle-help", idea: "lightbulb", rocket: "rocket", fire: "flame", star: "sparkles", magic: "wand-sparkles", video: "clapperboard",
  image: "image", music: "music", function: "square-function", lambda: "square-function", event: "bell-ring", notification: "bell-ring", calendar: "calendar",
  pipeline: "workflow", workflow: "workflow", deploy: "rocket", build: "hammer", test: "flask-conical", scale: "trending-up", growth: "trending-up",
  token: "coins", tokens: "coins", text: "type", word: "type", vector: "move-3d", embedding: "orbit", gpu: "cpu", cpu: "cpu", chip: "cpu", memory: "memory-stick",
};

function fuzzyGlyph(q) {
  const { glyphs } = catalog();
  const words = norm(q).split(" ").filter(Boolean);
  for (const w of words) if (SYN[w] && glyphs.has(SYN[w])) return glyphs.get(SYN[w]);
  let best = null, bestScore = 0;
  for (const g of glyphs.values()) {
    let s = 0;
    for (const w of words) {
      if (g.tags[0] === w) s += 5;
      else if (g.tags[0].split(" ").includes(w)) s += 3;
      else if (g.tags.some((t) => t === w)) s += 2;
      else if (g.tags.some((t) => t.split(" ").includes(w))) s += 1;
    }
    s -= g.tags[0].split(" ").length * 0.05;
    if (s > bestScore) { bestScore = s; best = g; }
  }
  return bestScore >= 1 ? best : glyphs.get("sparkles");
}

export function resolveIcon(hint) {
  const { aws, brands, glyphs, custom } = catalog();
  const raw = String(hint || "").trim();
  const q = norm(raw);
  if (!q) return glyphs.get("sparkles");
  const sq = squash(raw);
  const awsHint = /\b(aws|amazon)\b/.test(q);
  const stripped = squash(q.replace(/\b(aws|amazon)\b/g, ""));
  if (q.startsWith("lucide ") && glyphs.has(q.slice(7).replace(/ /g, "-"))) return glyphs.get(q.slice(7).replace(/ /g, "-"));
  if (custom.get(sq)) return custom.get(sq);
  const dash = q.replace(/ /g, "-");
  if (glyphs.has(dash) && !LUCIDE_BRANDS.has(dash)) return glyphs.get(dash);
  const awsKey = (k) => AWS_ALIAS[k] ? squash(AWS_ALIAS[k]) : k;
  if (awsHint && (aws.get(awsKey(stripped)) || aws.get(sq))) return aws.get(awsKey(stripped)) || aws.get(sq);
  if (brands.get(sq) || brands.get(BRAND_ALIAS[sq])) return brands.get(sq) || brands.get(BRAND_ALIAS[sq]);
  if (aws.get(sq) && aws.get(sq).kind === "aws") return aws.get(sq);
  if (/^[a-z0-9]{2,5}$/.test(sq) && AWS_ALIAS[sq] && sq !== "cloud") return aws.get(awsKey(sq));
  if (glyphs.has(q.replace(/ /g, "-"))) return glyphs.get(q.replace(/ /g, "-"));
  if (SYN[q] && glyphs.has(SYN[q])) return glyphs.get(SYN[q]);
  if (SYN[sq] && glyphs.has(SYN[sq])) return glyphs.get(SYN[sq]);
  if (awsHint && stripped) {
    for (const [k, v] of aws) if (k.includes(stripped) && v.kind === "aws") return v;
  }
  return fuzzyGlyph(q);
}

const lum = (hex) => { const n = parseInt(hex, 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };

// Copies the icon into the project, recolored for a dark stage. Returns { src, kind, tint }.
export function installIcon(hint, assetsDir, ink = "#f5f6fa") {
  const r = resolveIcon(hint);
  const dir = path.join(assetsDir, "icons");
  fs.mkdirSync(dir, { recursive: true });
  let svg = fs.readFileSync(r.file, "utf8").replace(/<!--[\s\S]*?-->/g, "").trim();
  let tint = null;
  if (r.kind === "glyph") svg = svg.replace(/currentColor/g, ink).replace(/stroke-width="2"/, 'stroke-width="1.6"');
  if (r.kind === "brand") {
    const color = lum(r.hex) < 0.18 ? ink : "#" + r.hex;
    tint = "#" + r.hex;
    svg = svg.replace("<svg ", `<svg fill="${color}" `).replace(/<title>[\s\S]*?<\/title>/, "");
  }
  if (r.kind === "logo") svg = svg.replace(/#ffffff|#fff\b/gi, ink);
  if (r.kind === "awsres") svg = svg.replace(/#232[fF]3[dDeE]/g, ink);
  const id = r.kind === "logo" || r.kind === "glyph" || r.kind === "awsres" ? `${r.id}-${ink.slice(1)}` : r.id;
  fs.writeFileSync(path.join(dir, id + ".svg"), svg);
  return { src: `assets/icons/${id}.svg`, kind: r.kind, tint };
}
