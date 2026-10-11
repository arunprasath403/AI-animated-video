# Plan format

A **plan** is a small JSON file that describes the video scene by scene. Every scene has:
- a `type`, which sets the animation
- `say`, the narration for that scene
- a few visual fields

The narration drives the timing: each `cue` word makes its visual appear exactly when the narrator says that word.

```json
{
  "title": "What is a Multi-Agent System?",
  "series": "EP.07 / AI",
  "theme": "ocean",
  "scenes": [
    { "type": "hook", "say": "One AI agent can do a task. A team of agents can run a whole project.",
      "kicker": "AI teamwork", "title": "One AI is not enough", "highlight": "enough", "icon": "bot" },
    { "type": "orbit", "say": "An orchestrator hands out the work. A researcher, a coder, a tester and a writer each own one job.",
      "center": { "icon": "brain", "name": "Orchestrator" },
      "items": [ { "icon": "search", "name": "Researcher", "cue": "researcher" },
                 { "icon": "code", "name": "Coder", "cue": "coder" } ] },
    { "type": "outro", "say": "Many small specialists, one shared goal.", "title": "Small agents, big results",
      "highlight": "big", "sub": "that's a multi-agent system", "next": "NEXT: what is MCP?", "visual": "particles", "icon": "network" }
  ]
}
```

`theme` is optional. Leave it out and the themes rotate.

Full examples:
- [`plans/multi-agent-systems.json`](../plans/multi-agent-systems.json)
- [`plans/aws-vs-azure.json`](../plans/aws-vs-azure.json)
- [`plans/red-team-cyber.json`](../plans/red-team-cyber.json)
- [`examples/`](../examples)

## Scene types and rules

This is the exact text `c2v prompt` gives a chatbot. It comes from [`src/schema.mjs`](../src/schema.mjs).

```text
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


Rules:
- 6 to 8 scenes. First scene is "hook", last is "outro".
- "say" is the narration for that scene: 1-2 short spoken sentences, simple words, active voice, no emoji, no markdown. Whole video 90-150 words.
- Every "cue" MUST be a single word copied exactly from that scene's "say"; the visual appears when the narrator says it.
- "icon" values are short hints: a product or brand name ("docker", "aws lambda", "postgres", "github", "react") or a plain noun ("server", "database", "user", "lock", "laptop", "cloud", "code", "brain", "money", "globe").
- Explain one idea per scene; show it, don't just list it. Prefer flow, orbit, compare, scale, code and stat scenes over plain cards.
- Facts must be accurate. Numbers must be realistic.
- Output ONLY a JSON object: {"title":"...","series":"2-3 word topic label","scenes":[...]}.
```

## Icons

An `icon` is a plain hint, and it resolves in this order:
1. **AWS architecture icons** for AWS services: `"aws lambda"`, `"s3"`, `"dynamodb"`
2. **Brand logos** (simple-icons): `"docker"`, `"github"`, `"react"`, `"postgres"`
3. **Lucide glyphs** for everything else: `"server"`, `"database"`, `"lock"`, `"brain"`, `"bot"`, `"users"`

Any [lucide icon name](https://lucide.dev/icons) works exactly as written.

## Check before rendering

```bash
c2v check plans/my-topic.json
```

The checker repairs small mistakes on its own, such as text that is too long or a missing cue. It lists anything you need to fix yourself and estimates the video length.
