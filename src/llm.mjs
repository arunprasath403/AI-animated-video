// Script writer. Two ways to get a plan:
//  1. buildPrompt(): a ready prompt you paste into Claude (or any assistant); save the JSON reply.
//  2. writePlan(): optional automatic mode via any OpenAI-compatible endpoint
//     (Ollama, LM Studio, llama.cpp, vLLM). Off unless llm.enabled is true in c2v.config.json.
import { SCENE_DOCS, RULES, validatePlan } from "./schema.mjs";
import { log } from "./util.mjs";

const EXAMPLE = {
  title: "What is a CDN?", series: "EP.07 / WEB",
  scenes: [
    { type: "hook", say: "Why does a website in another country load instantly?", kicker: "the internet trick", title: "Why is it so fast?", highlight: "fast", icon: "globe" },
    { type: "stat", say: "Light in fiber takes about 70 milliseconds to cross the planet and back.", value: "70", suffix: "ms", label: "one round trip across Earth", icon: "timer", cue: "70" },
    { type: "flow", say: "Without a CDN, your request travels to one far away server, every single time.", nodes: [{ icon: "user", name: "You", desc: "in Mumbai", cue: "your" }, { icon: "globe", name: "Internet", desc: "12,000 km", cue: "travels" }, { icon: "server", name: "Origin server", desc: "in Virginia", cue: "server" }], reply: true },
    { type: "orbit", say: "A CDN copies your files to servers in hundreds of cities, close to every user.", center: { icon: "server", name: "Origin" }, items: [{ icon: "server", name: "Tokyo", cue: "copies" }, { icon: "server", name: "London", cue: "servers" }, { icon: "server", name: "Mumbai", cue: "hundreds" }, { icon: "server", name: "Sao Paulo", cue: "cities" }] },
    { type: "compare", say: "So the trip drops from 200 milliseconds to just 20.", left: { title: "Origin only", icon: "turtle", points: ["200 ms", "one location"] }, right: { title: "With CDN", icon: "zap", points: ["20 ms", "300+ cities"] }, cue: "20" },
    { type: "cards", say: "Cloudflare, Akamai and CloudFront run the biggest ones.", items: [{ icon: "cloudflare", kicker: "the giant", name: "Cloudflare", desc: "free tier", cue: "Cloudflare" }, { icon: "akamai", kicker: "the veteran", name: "Akamai", desc: "since 1998", cue: "Akamai" }, { icon: "aws cloudfront", kicker: "on AWS", name: "CloudFront", desc: "600+ locations", cue: "CloudFront" }] },
    { type: "outro", say: "That's a CDN. The internet, moved closer to you.", title: "The internet, moved closer", highlight: "closer", sub: "that's a CDN", next: "NEXT: what is DNS?", visual: "globe" },
  ],
};

const SYSTEM = `You are the head writer of a viral tech-explainer channel for YouTube Shorts and Instagram Reels.
You write tight, accurate, surprising 30-50 second scripts AND direct the visuals: each scene picks an animated scene type that SHOWS the idea.
Open with a hook question or a surprising fact. Build understanding step by step. End with a memorable one-liner.
${SCENE_DOCS}
${RULES}
Example output for the topic "What is a CDN?":
${JSON.stringify(EXAMPLE)}`;

// The same brief the local model gets, for pasting into Claude or any chat assistant.
export function buildPrompt(topic, notes = "") {
  return `${SYSTEM}\n\nTopic: ${topic}\n${notes ? "Notes from the producer: " + notes + "\n" : ""}Write the JSON plan now. Reply with only the JSON.`;
}

function extractJson(text) {
  const s = String(text).replace(/```(?:json)?/g, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("No JSON object in model output");
  return JSON.parse(s.slice(a, b + 1));
}

async function chat(cfg, messages) {
  const url = cfg.baseUrl.replace(/\/$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cfg.apiKey ? { Authorization: "Bearer " + cfg.apiKey } : {}) },
    body: JSON.stringify({ model: cfg.model, messages, temperature: cfg.temperature ?? 0.8, response_format: { type: "json_object" }, ...(cfg.extra || {}) }),
  }).catch((e) => { throw new Error(`Cannot reach the LLM at ${url} (${e.message}). Is Ollama running? Try: ollama serve`); });
  if (!res.ok) throw new Error(`LLM error ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

export async function writePlan(topic, cfg, { notes = "" } = {}) {
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Topic: ${topic}\n${notes ? "Notes from the producer: " + notes + "\n" : ""}Write the JSON plan now.` },
  ];
  let last = null;
  for (let attempt = 1; attempt <= (cfg.retries ?? 3); attempt++) {
    log(`script: asking ${cfg.model} (attempt ${attempt})`);
    const out = await chat(cfg, messages);
    let parsed;
    try { parsed = extractJson(out); } catch (e) { messages.push({ role: "assistant", content: out }, { role: "user", content: "That was not valid JSON. Reply with ONLY the JSON object." }); continue; }
    const v = validatePlan(parsed);
    last = v;
    if (!v.fatal && v.errors.length <= 2) { if (v.errors.length) log("script: auto-fixed: " + v.errors.join(" | ")); return v.plan; }
    log("script: fixing: " + v.errors.join(" | "));
    messages.push({ role: "assistant", content: JSON.stringify(parsed) }, { role: "user", content: "Fix these problems and reply with the full corrected JSON only:\n- " + v.errors.join("\n- ") });
  }
  if (last && !last.fatal) return last.plan;
  throw new Error("The model could not produce a valid plan. Try a bigger model (e.g. qwen2.5:14b) or pass --plan with a hand-written JSON.");
}
