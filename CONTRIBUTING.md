# Contributing

Pull requests are welcome, especially new themes, scene types and plans.

## Project map

```
bin/c2v.mjs         CLI
src/schema.mjs      scene vocabulary + validator
src/llm.mjs         the plan brief (c2v prompt) + optional auto mode
src/voice.mjs       Kokoro TTS per scene, word timings
src/icons.mjs       icon resolver (AWS / brands / lucide)
src/style.mjs       themes + seeded art direction
src/compose.mjs     builds the HyperFrames project and times every cue
src/music.mjs       music genres, SFX, ducking, final mix
template/engine.js  scene animations (GSAP)
template/visuals.js shader backgrounds + Three.js moments
template/style.css  layout, fonts, per-theme cards and captions
plans/, examples/   ready-made plans
media/              sample output videos and previews
```

## Add a theme

1. **`src/style.mjs`:** add an entry to `THEMES`.
   - Set `dark`, `bg`, `display`, `body`, `mono`, `card`, `captions`, `transitions`, `music`, `hook` and `three`.
   - Add `palettes`, each with a `bg: [base, feature, feature2]` triple.
   - If you add a background, add its name to `BG_MODES`.
2. **`template/visuals.js`:** for a new background, add an `else if (uMode < N.5)` branch in the fragment shader. `uA`, `uB` and `uC` are the three scene tint colours.
3. **`template/style.css`:** add `#root.card-<name>` card variables and `#cap-pill.cap-<name>` caption styles.
4. **`src/music.mjs`:** optionally add a genre to `GENRES`.
5. **Preview without rendering:**
   ```bash
   c2v make examples/what-is-docker.json --theme <name> --no-render
   npx hyperframes snapshot projects/what-is-docker --at 2.6,7.5,12.5
   ```

## Add a scene type

1. **`template/engine.js`:** add a builder `B.myscene = (sc, root, t0, t1) => { ... }`. Use the shared `tl` timeline and the `el`, `icon` and `words` helpers.
2. **`template/style.css`:** add its CSS.
3. **`src/schema.mjs`:** describe it in `SCENE_DOCS` and add it to `validatePlan`.
4. **`src/compose.mjs`:** if it has cued items, add it to `timePlan`.

## Guidelines

- Keep everything **free and offline**: no paid APIs, and no assets with restrictive licences.
- Keep renders **deterministic**: no `Math.random()` and no wall-clock time. Use the seeded `rnd()` and the timeline time.
- Pin new dependencies to an exact version.
