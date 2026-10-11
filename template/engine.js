// code-to-video scene engine.
// Reads window.PLAN (scenes with resolved times and icons) and builds one paused GSAP
// timeline for HyperFrames. Everything is deterministic: same plan, same frames.
(function () {
  const PLAN = window.PLAN, S = PLAN.style, C = S.palette;
  const tl = gsap.timeline({ paused: true });
  const $ = (s) => document.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  let seed = S.seed % 2147483646 + 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let uid = 0;
  const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; e.id = "e" + uid++; if (html !== undefined) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); e.id = "e" + uid++; if (parent) parent.appendChild(e); return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const rgba = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // An icon tile: AWS service icons keep their own square; others sit on a tinted glass tile.
  function icon(ic, size, parent, cls) {
    const box = el("div", "ico " + (cls || ""), parent);
    box.style.width = box.style.height = size + "px";
    box.style.setProperty("--sz", size + "px");
    if (!ic) return box;
    if (ic.kind === "aws") { box.classList.add("ico-aws"); el("img", "", box).src = ic.src; return box; }
    box.classList.add("ico-tile");
    box.style.setProperty("--tint", ic.tint || (C.accent === "#111111" || C.accent === "#ffffff" ? C.accent2 : C.accent));
    box.style.setProperty("--sz", size + "px");
    const im = el("img", "", box); im.src = ic.src;
    return box;
  }

  const GLOW = S.dark;
  const glowPulse = (target, t, color, strength = 60) => {
    if (GLOW) tl.fromTo(target, { boxShadow: `0 0 0px ${color}`, scale: 1 }, { boxShadow: `0 0 ${strength}px ${rgba(color, 0.9)}`, scale: 1.1, duration: 0.25, yoyo: true, repeat: 1 }, t);
    else tl.fromTo(target, { scale: 1, rotation: 0 }, { scale: 1.14, rotation: -4, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" }, t);
  };

  function counter(node, from, to, at, dur, fmt) {
    const o = { v: from };
    node.textContent = fmt(from);
    tl.to(o, { v: to, duration: dur, ease: "power2.out", onUpdate: () => (node.textContent = fmt(o.v)) }, at);
  }

  // Scene transitions. Overlay kinds (wipe, dip) cover the cut with a panel.
  const ENTER = {
    slide: [{ x: 300, opacity: 0 }, { x: 0 }], zoom: [{ scale: 1.18, opacity: 0, filter: "blur(18px)" }, { scale: 1, filter: "blur(0px)" }],
    rise: [{ y: 180, opacity: 0 }, { y: 0 }], flip: [{ rotationY: 38, opacity: 0, transformPerspective: 1600 }, { rotationY: 0, transformPerspective: 1600 }],
    push: [{ yPercent: 100 }, { yPercent: 0 }], iris: [{ clipPath: "circle(0% at 50% 45%)" }, { clipPath: "circle(80% at 50% 45%)" }],
    slice: [{ clipPath: "inset(50% 0% 50% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }],
    flash: [{ scale: 1.12 }, { scale: 1 }],
  };
  const EXIT = { slide: { x: -300, opacity: 0 }, zoom: { scale: 0.9, filter: "blur(16px)", opacity: 0 }, rise: { y: -180, opacity: 0 }, flip: { rotationY: -38, transformPerspective: 1600, opacity: 0 }, push: { yPercent: -100 }, iris: { scale: 0.85, opacity: 0 }, slice: { scaleY: 0.02, opacity: 0 }, flash: { scale: 1.06 } };
  function enter(inner, kind, t) {
    if (kind === "glitch") {
      const k = [[34, "inset(0% 0% 62% 0%)"], [-26, "inset(30% 0% 20% 0%)"], [14, "inset(0% 0% 0% 0%)"], [-6, "inset(0% 0% 0% 0%)"], [0, "none"]];
      tl.set(inner, { opacity: 1 }, t);
      k.forEach(([x, cp], j) => tl.set(inner, { x, clipPath: cp, skewX: j < 3 ? (j % 2 ? 6 : -6) : 0 }, t + j * 0.045));
      return;
    }
    if (kind === "wipe" || kind === "dip") { tl.fromTo(inner, { opacity: 0 }, { opacity: 1, duration: 0.01 }, t); return; }
    const [from, to] = ENTER[kind];
    tl.fromTo(inner, { opacity: 1, ...from }, { opacity: 1, ...to, duration: kind === "push" ? 0.55 : 0.5, ease: kind === "push" ? "power4.inOut" : "power4.out" }, kind === "push" ? t - 0.3 : t);
  }
  function exit(inner, kind, t) {
    if (kind === "glitch") {
      [[-22, "inset(10% 0% 40% 0%)"], [30, "inset(50% 0% 5% 0%)"], [-40, "inset(0% 0% 70% 0%)"]].forEach(([x, cp], j) => tl.set(inner, { x, clipPath: cp }, t - 0.14 + j * 0.045));
      tl.set(inner, { opacity: 0 }, t);
      return;
    }
    if (kind === "wipe" || kind === "dip") { tl.to(inner, { opacity: 0, duration: 0.01 }, t); return; }
    tl.to(inner, { ...EXIT[kind], duration: kind === "push" ? 0.55 : 0.34, ease: kind === "push" ? "power4.inOut" : "power3.in" }, t - (kind === "push" ? 0.3 : 0.34));
  }
  // overlay transitions
  function overlay(kind, t, i) {
    const layer = $("#fx-layer");
    if (kind === "wipe") {
      const a = el("div", "wipe", layer), b = el("div", "wipe2", layer), dir = i % 2 ? -1 : 1;
      tl.fromTo(a, { xPercent: 100 * dir }, { xPercent: 0, duration: 0.32, ease: "power3.in" }, t - 0.32);
      tl.fromTo(b, { xPercent: 100 * dir }, { xPercent: 0, duration: 0.3, ease: "power3.in" }, t - 0.22);
      tl.to(b, { xPercent: -100 * dir, duration: 0.42, ease: "power3.out" }, t + 0.08);
      tl.to(a, { xPercent: -100 * dir, duration: 0.42, ease: "power3.out" }, t + 0.16);
    } else if (kind === "glitch") {
      for (let j = 0; j < 6; j++) {
        const b = el("div", "gbar", layer); b.style.top = Math.floor(rnd() * 1800) + "px"; b.style.height = 20 + Math.floor(rnd() * 120) + "px";
        b.style.background = j % 2 ? C.accent : C.accent2;
        tl.fromTo(b, { opacity: 0, x: (rnd() - 0.5) * 300 }, { opacity: 0.85, x: 0, duration: 0.04 }, t - 0.12 + j * 0.03);
        tl.to(b, { opacity: 0, duration: 0.04 }, t + 0.06 + j * 0.02);
      }
    } else if (kind === "flash") {
      const f = el("div", "flash", layer);
      tl.fromTo(f, { opacity: 0 }, { opacity: 0.9, duration: 0.08, ease: "power2.in" }, t - 0.08);
      tl.to(f, { opacity: 0, duration: 0.35, ease: "power2.out" }, t + 0.02);
    } else if (kind === "dip") {
      const d = el("div", "dip", layer);
      tl.fromTo(d, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.in" }, t - 0.3);
      tl.to(d, { opacity: 0, duration: 0.5, ease: "power2.out" }, t + 0.05);
    }
  }

  // Splits a headline into word spans; the highlight word gets the accent colour.
  function words(parent, text, highlight) {
    const hl = String(highlight || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return String(text).split(/\s+/).filter(Boolean).map((w) => {
      const s = el("span", "word", parent, esc(w));
      if (hl && w.toLowerCase().replace(/[^a-z0-9]/g, "") === hl) s.classList.add("hl");
      return s;
    });
  }

  // ---------------- scene builders ----------------
  const B = {};

  B.hook = (sc, root, t0, t1) => (S.hook === "type" ? hookType : hookCenter)(sc, root, t0, t1);

  // Giant kinetic type, left aligned: editorial / brutalist openers.
  function hookType(sc, root, t0, t1) {
    const box = el("div", "hook-type", root);
    const ic = icon(sc.icon, 150, box);
    tl.fromTo(ic, { scale: 0, rotation: -30 }, { scale: 1, rotation: 0, duration: 0.55, ease: "back.out(2)" }, t0 + 0.1);
    const k = el("div", "ht-kicker", box, `<span class="kdot"></span>${esc(sc.kicker || PLAN.series || "")}`);
    tl.fromTo(k, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.5, ease: "power3.out" }, t0 + 0.25);
    const hl = String(sc.highlight || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const ws = String(sc.title).split(/\s+/).filter(Boolean);
    const lines = []; let cur = "";
    ws.forEach((w) => { if ((cur + " " + w).trim().length > 11 && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); });
    if (cur) lines.push(cur);
    lines.forEach((ln, i) => {
      const L = el("div", "ht-line", box);
      const inner = el("span", "", L, esc(ln));
      if (hl && ln.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").includes(hl)) L.classList.add("hl");
      tl.fromTo(inner, { yPercent: 110, rotation: 4 }, { yPercent: 0, rotation: 0, duration: 0.6, ease: "power4.out" }, t0 + 0.4 + i * 0.13);
    });
    const bar = el("span", "ht-bar", box);
    tl.fromTo(bar, { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, transformOrigin: "0% 50%", duration: 0.7, ease: "power4.inOut" }, t0 + 0.6 + lines.length * 0.13);
    tl.to(box, { y: -30, duration: t1 - t0, ease: "none" }, t0);
  }

  function hookCenter(sc, root, t0, t1) {
    const stage = el("div", "hook-stage", root);
    const rings = el("div", "rings", stage);
    for (let i = 0; i < 3; i++) {
      const r = el("div", "ring", rings);
      tl.fromTo(r, { scale: 0.5, opacity: 0.9 }, { scale: 2.6, opacity: 0, duration: 1.4, ease: "power2.out" }, t0 + 0.15 + i * 0.22);
    }
    const orbit = el("div", "orbit-dots", stage);
    for (let i = 0; i < 12; i++) {
      const d = el("span", "odot", orbit); const a = (i / 12) * Math.PI * 2, r = 230 + (i % 3) * 26;
      d.style.left = 300 + Math.cos(a) * r - 6 + "px"; d.style.top = 300 + Math.sin(a) * r - 6 + "px";
      d.style.background = i % 2 ? C.bar : C.accent2;
    }
    tl.fromTo(orbit, { rotation: 0, opacity: 0, scale: 0.7 }, { rotation: 140, opacity: 1, scale: 1, duration: t1 - t0, ease: "power1.out" }, t0);
    const ic = icon(sc.icon, 250, stage, "hook-icon");
    tl.fromTo(ic, { scale: 0.2, opacity: 0, rotation: -25 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.7, ease: "back.out(1.8)" }, t0 + 0.1);
    tl.to(ic, { y: -16, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: Math.max(0, Math.floor((t1 - t0 - 1) / 1.1)) }, t0 + 0.8);
    const k = el("div", "kicker", root, `<span class="kdot"></span>${esc(sc.kicker || PLAN.series || "")}`);
    tl.fromTo(k, { clipPath: "inset(0 100% 0 0)", opacity: 1 }, { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "power3.out" }, t0 + 0.35);
    const h = el("div", "hook-title", root);
    const ws = words(h, sc.title, sc.highlight);
    tl.fromTo(ws, { y: 90, opacity: 0, rotationX: -70 }, { y: 0, opacity: 1, rotationX: 0, duration: 0.6, ease: "power4.out", stagger: 0.09 }, t0 + 0.45);
  }

  B.stat = (sc, root, t0, t1) => {
    const at = sc.at;
    const ic = icon(sc.icon, 150, root, "stat-icon");
    tl.fromTo(ic, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.8)" }, t0 + 0.15);
    const svg = svgEl("svg", { class: "stat-ring", viewBox: "0 0 640 640" }, root);
    svgEl("circle", { cx: 320, cy: 320, r: 280, fill: "none", stroke: C.faint, "stroke-width": 26 }, svg);
    const L = 2 * Math.PI * 280;
    const arc = svgEl("circle", { cx: 320, cy: 320, r: 280, fill: "none", stroke: C.bar, "stroke-width": 26, "stroke-linecap": "round", "stroke-dasharray": L, "stroke-dashoffset": L, transform: "rotate(-90 320 320)" }, svg);
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; svgEl("line", { x1: 320 + Math.cos(a) * 236, y1: 320 + Math.sin(a) * 236, x2: 320 + Math.cos(a) * (i % 5 ? 226 : 214), y2: 320 + Math.sin(a) * (i % 5 ? 226 : 214), stroke: C.line, "stroke-width": 3 }, svg); }
    tl.fromTo(svg, { opacity: 0, scale: 0.85, rotation: -30 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.7, ease: "power3.out" }, t0 + 0.2);
    tl.to(arc, { attr: { "stroke-dashoffset": L * 0.12 }, duration: 1.4, ease: "power3.out" }, at);
    const raw = String(sc.value), m = raw.match(/-?[\d,]*\.?\d+/);
    const val = m ? parseFloat(m[0].replace(/,/g, "")) : 0;
    const pre = (sc.prefix || "") + (m ? raw.slice(0, m.index).trim() : ""), suf = (m ? raw.slice(m.index + m[0].length).trim() : raw) + (sc.suffix || "");
    const dec = m && m[0].includes(".") ? m[0].split(".")[1].length : 0;
    const n = el("div", "stat-num", root);
    const v = el("span", "", n); el("span", "stat-suf", n, esc(suf));
    const fmt = (x) => pre + (dec ? x.toFixed(dec) : Math.round(x).toLocaleString("en-US"));
    counter(v, 0, val, at, 1.3, fmt);
    tl.fromTo(n, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.6)" }, at - 0.1);
    const lab = el("div", "stat-label", root, esc(sc.label));
    tl.fromTo(lab, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, at + 0.35);
    if (GLOW) tl.fromTo(n, { textShadow: `0 0 0px ${C.accent}` }, { textShadow: `0 0 50px ${rgba(C.accent, 0.8)}`, duration: 0.4, yoyo: true, repeat: 1 }, at + 1.2);
  };

  B.cards = (sc, root, t0, t1) => {
    const wrap = el("div", "cards", root);
    const n = sc.items.length;
    wrap.style.gap = n > 2 ? "34px" : "50px";
    sc.items.forEach((it, i) => {
      const c = el("div", "card xcard", wrap);
      const ic = icon(it.icon, n > 2 ? 190 : 220, c);
      const txt = el("div", "xtxt", c, `<span class="xk">${esc(it.kicker)}</span><span class="xn">${esc(it.name)}</span><span class="xd">${esc(it.desc)}</span>`);
      const shine = el("div", "shine", c);
      tl.fromTo(c, { rotationX: -80, opacity: 0, y: 70, transformPerspective: 1600 }, { rotationX: 0, opacity: 1, y: 0, duration: 0.6, ease: "power4.out" }, it.at);
      tl.fromTo(ic, { scale: 0.4 }, { scale: 1, duration: 0.55, ease: "back.out(1.9)" }, it.at + 0.05);
      tl.fromTo(shine, { x: -400 }, { x: 1100, duration: 0.8, ease: "power2.inOut" }, it.at + 0.25);
      tl.fromTo(txt.children, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, stagger: 0.07, ease: "power3.out" }, it.at + 0.12);
    });
  };

  B.flow = (sc, root, t0, t1) => {
    const n = sc.nodes.length, X = 210;
    const span = Math.min(230 * (n - 1), 940), top = 360 + (940 - span) / 2 + 20;
    const Y = sc.nodes.map((_, i) => (n === 1 ? 830 : top + (span / (n - 1)) * i));
    if (sc.group) {
      const g0 = Y[sc.group.from] - 100, g1 = Y[n - 1] + 100;
      const g = el("div", "grp", root, `<span class="grp-tag">${esc(sc.group.label)}</span>`);
      g.style.top = g0 + "px"; g.style.height = g1 - g0 + "px";
      tl.fromTo(g, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.5 }, t0 + 0.25);
    }
    const svg = svgEl("svg", { class: "full", viewBox: "0 0 1080 1920" }, root);
    const edges = [];
    for (let i = 0; i < n - 1; i++) {
      const p = svgEl("line", { x1: X, y1: Y[i] + 74, x2: X, y2: Y[i + 1] - 74, stroke: C.line, "stroke-width": 5, "stroke-linecap": "round" }, svg);
      const L = Y[i + 1] - Y[i] - 148; p.setAttribute("stroke-dasharray", L); edges.push(p);
      tl.fromTo(p, { attr: { "stroke-dashoffset": L } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.4, ease: "power2.out" }, t0 + 0.35 + i * 0.07);
    }
    const nodes = sc.nodes.map((nd, i) => {
      const row = el("div", "fnode", root); row.style.top = Y[i] - 70 + "px";
      const ic = icon(nd.icon, 140, row);
      const lab = el("div", "flab", row, `<span class="fn">${esc(nd.name)}</span><span class="fd">${esc(nd.desc)}</span>`);
      tl.fromTo(row, { opacity: 0, scale: 0.7 }, { opacity: 0.38, scale: 1, duration: 0.4, ease: "back.out(1.7)" }, t0 + 0.2 + i * 0.06);
      tl.set(lab, { opacity: 0 }, t0);
      return { row, ic, lab };
    });
    const lit = (i, t) => {
      tl.to(nodes[i].row, { opacity: 1, duration: 0.2 }, t);
      glowPulse(nodes[i].ic, t, C.hl);
      tl.fromTo(nodes[i].lab, { x: 50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, t);
    };
    const packet = (a, b, t, dur, back) => {
      const d = el("div", "pkt", root);
      d.style.boxShadow = GLOW ? `0 0 26px 10px ${back ? C.good : C.hl}` : `0 0 0 6px ${back ? C.good : C.ink}`;
      tl.fromTo(d, { x: X - 16, y: Y[a] - 16, opacity: 0 }, { opacity: 1, duration: 0.06 }, t);
      tl.to(d, { y: Y[b] - 16, duration: dur, ease: "power2.inOut" }, t);
      tl.to(d, { opacity: 0, duration: 0.08 }, t + dur);
    };
    sc.nodes.forEach((nd, i) => {
      if (i > 0) { const dur = clamp(nd.at - sc.nodes[i - 1].at - 0.05, 0.2, 0.55); packet(i - 1, i, nd.at - dur, dur); }
      lit(i, nd.at);
    });
    if (sc.reply && n > 1) {
      const last = sc.nodes[n - 1].at + 0.35, room = t1 - 0.6 - last, dur = clamp(room, 0.3, 0.9);
      if (room > 0.3) {
        packet(n - 1, 0, last, dur, true);
        const ck = el("div", "check", root, "✓"); ck.style.left = X + 60 + "px"; ck.style.top = Y[0] - 90 + "px";
        tl.fromTo(ck, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2.2)" }, last + dur);
      }
    }
  };

  B.chart = (sc, root, t0, t1) => {
    const card = el("div", "card chart", root);
    el("span", "label", card, esc(sc.label));
    const W = 820, H = 380, svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart-svg" }, card);
    for (let g = 1; g <= 3; g++) svgEl("line", { x1: 0, x2: W, y1: H - g * (H / 4), y2: H - g * (H / 4), stroke: C.faint, "stroke-width": 2 }, svg);
    const vals = sc.values, mx = Math.max(...vals) || 1, bw = W / vals.length, top = vals.indexOf(Math.max(...vals));
    const at = sc.at;
    tl.fromTo(card, { opacity: 0, y: 80 }, { opacity: 1, y: 0, duration: 0.5, ease: "power4.out" }, t0 + 0.15);
    vals.forEach((v, i) => {
      const h = (v / mx) * (H - 40);
      const r = svgEl("rect", { x: i * bw + bw * 0.16, width: bw * 0.68, y: H, height: 0, rx: 8, fill: i === top ? C.accent2 : C.bar, stroke: S.card === "brutal" ? "#111" : "none", "stroke-width": 4 }, svg);
      tl.to(r, { attr: { y: H - h, height: h }, duration: 0.35, ease: "power3.out" }, at + i * 0.07);
    });
    if (sc.line) {
      const pts = vals.map((v, i) => `${i * bw + bw / 2},${H - (v / mx) * (H - 40) - 26}`).join(" ");
      const pl = svgEl("polyline", { points: pts, fill: "none", stroke: C.accent2, "stroke-width": 7, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-dasharray": 3000, "stroke-dashoffset": 3000 }, svg);
      tl.to(pl, { attr: { "stroke-dashoffset": 0 }, duration: 1.3, ease: "none" }, at);
    }
    if (sc.legend && sc.legend.length) {
      const lg = el("div", "legend", card);
      sc.legend.forEach((name, i) => el("span", "", lg, `<i style="background:${i ? C.bar : C.accent2}"></i>${esc(name)}`));
    }
  };

  B.compare = (sc, root, t0, t1) => {
    // neutral: two options side by side (AWS vs Azure); default: bad vs good (old way vs new way)
    const neutral = sc.mode === "neutral";
    const side = (o, cls, good, t) => {
      const c = el("div", "card cmp " + cls, root);
      icon(o.icon, 130, c);
      el("div", "cmp-t", c, esc(o.title));
      const col = neutral ? (good ? C.accent2 : C.accent) : good ? C.good : C.bad;
      const mark = neutral ? "▸" : good ? "✓" : "✕";
      const pts = o.points.map((p) => el("div", "cmp-p", c, `<b style="color:${col}">${mark}</b><span>${esc(p)}</span>`));
      c.style.borderColor = rgba(col, 0.5);
      tl.fromTo(c, { opacity: 0, y: 60, rotationY: good ? -25 : 25, transformPerspective: 1400 }, { opacity: 1, y: 0, rotationY: 0, duration: 0.55, ease: "power4.out" }, t);
      tl.fromTo(pts, { opacity: 0, x: good ? 30 : -30 }, { opacity: 1, x: 0, duration: 0.35, stagger: 0.12, ease: "power3.out" }, t + 0.3);
      return c;
    };
    const L = side(sc.left, "cmp-l", false, t0 + 0.2);
    const vs = el("div", "vs", root, "VS");
    tl.fromTo(vs, { scale: 0, opacity: 0, rotation: -90 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.45, ease: "back.out(2)" }, sc.at - 0.25);
    side(sc.right, "cmp-r", true, sc.at);
    if (!neutral) tl.to(L, { opacity: 0.55, scale: 0.96, duration: 0.4 }, sc.at + 0.3);
  };

  B.steps = (sc, root, t0, t1) => {
    if (sc.title) { const t = el("span", "label steps-title", root, esc(sc.title)); tl.fromTo(t, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, t0 + 0.15); }
    const n = sc.items.length, gapY = Math.min(190, 900 / n), y0 = 470 + (900 - gapY * n) / 2;
    const rail = el("div", "rail", root); rail.style.top = y0 + 50 + "px"; rail.style.height = gapY * (n - 1) + "px";
    const fill = el("div", "rail-fill", rail);
    tl.fromTo(fill, { scaleY: 0, transformOrigin: "50% 0%" }, { scaleY: 1, duration: Math.max(0.5, sc.items[n - 1].at - sc.items[0].at), ease: "none", transformOrigin: "50% 0%" }, sc.items[0].at);
    sc.items.forEach((it, i) => {
      const row = el("div", "step", root); row.style.top = y0 + i * gapY + "px";
      const num = el("div", "step-n", row, String(i + 1));
      if (it.icon) icon(it.icon, 104, row);
      el("div", "step-t", row, esc(it.text));
      tl.fromTo(row, { opacity: 0, x: 70 }, { opacity: 1, x: 0, duration: 0.45, ease: "power4.out" }, it.at);
      tl.fromTo(num, { scale: 0.3, backgroundColor: "rgba(0,0,0,0)" }, { scale: 1, backgroundColor: C.accent, duration: 0.45, ease: "back.out(2)" }, it.at);
    });
  };

  const KWS = new Set("def|return|import|from|const|let|var|function|class|if|else|for|while|in|await|async|new|FROM|RUN|COPY|CMD|EXPOSE|WORKDIR|ENV|SELECT|WHERE|INSERT|apiVersion|kind|true|false|None|null|export|package|func|print|echo|docker|kubectl|npm|pip".split("|"));
  const KW = /x/g;
  // Single-pass tokenizer so later rules never touch markup added by earlier ones.
  function highlightCode(line) {
    const re = /("[^"]*"|'[^']*')|((?:#|\/\/).*$)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]+\b)/g;
    let out = "", last = 0, m;
    KW.lastIndex = 0;
    while ((m = re.exec(line))) {
      out += esc(line.slice(last, m.index));
      const tok = esc(m[0]);
      if (m[1]) out += `<span class="c-str">${tok}</span>`;
      else if (m[2] && !/^#!/.test(line) && !/^#include/.test(line)) out += `<span class="c-cm">${tok}</span>`;
      else if (m[3]) out += `<span class="c-num">${tok}</span>`;
      else if (m[4] && KWS.has(m[4])) out += `<span class="c-kw">${tok}</span>`;
      else out += tok;
      last = m.index + m[0].length;
    }
    return out + esc(line.slice(last));
  }
  B.code = (sc, root, t0, t1) => {
    const win = el("div", "card term", root);
    el("div", "term-bar", win, `<i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span>${esc(sc.file)}</span>`);
    const body = el("div", "term-body", win);
    tl.fromTo(win, { opacity: 0, y: 90, rotationX: 18, transformPerspective: 1600 }, { opacity: 1, y: 0, rotationX: 0, duration: 0.6, ease: "power4.out" }, t0 + 0.15);
    let t = Math.max(sc.at, t0 + 0.5);
    const budget = t1 - 0.6 - t, total = sc.lines.reduce((a, l) => a + Math.max(4, l.length), 0);
    const per = clamp(budget / total, 0.008, 0.035);
    const cur = el("span", "cursor", body);
    sc.lines.forEach((line, i) => {
      const ln = el("div", "term-line", body, `<span class="ln">${i + 1}</span><span class="code">${highlightCode(line) || "&nbsp;"}</span>`);
      const code = ln.lastChild, len = Math.max(1, line.length), d = Math.max(4, len) * per;
      tl.fromTo(code, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: d, ease: `steps(${len})` }, t);
      tl.set(cur, { top: 18 + i * 58, left: 92 }, t);
      tl.fromTo(cur, { x: 0 }, { x: len * 22.8, duration: d, ease: `steps(${len})` }, t);
      t += d + 0.06;
    });
    tl.to(cur, { opacity: 0, duration: 0.01, yoyo: true, repeat: Math.max(1, Math.floor((t1 - t) / 0.4)) * 2 - 1, repeatDelay: 0.38 }, t);
  };

  B.scale = (sc, root, t0, t1) => {
    const card = el("div", "card spark", root, `<span class="label">${esc(sc.label)}</span>`);
    const svg = svgEl("svg", { viewBox: "0 0 828 230", class: "spark-svg" }, card);
    const line = svgEl("polyline", { fill: "none", stroke: C.accent2, "stroke-width": 7, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    const st = { up: 0, down: 0 };
    const draw = () => {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const x = (i * 828) / 40, k = clamp((i - 14) / 10, 0, 1), kd = clamp((i - 30) / 8, 0, 1);
        const y = 190 - 14 * Math.sin(i * 0.8) - st.up * k * 150 + st.down * kd * 150;
        pts.push(x.toFixed(1) + "," + y.toFixed(1));
      }
      line.setAttribute("points", pts.join(" "));
      line.setAttribute("stroke", st.up > 0.5 && st.down < 0.5 ? C.bad : C.accent2);
    };
    draw();
    tl.fromTo(card, { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.5, ease: "power4.out" }, t0 + 0.15);
    tl.to(st, { up: 1, duration: 0.6, ease: "power4.out", onUpdate: draw }, sc.at - 0.2);
    if (sc.backAt) tl.to(st, { down: 1, duration: 0.6, ease: "power3.inOut", onUpdate: draw }, sc.backAt - 0.2);
    const box = el("div", "asg", root, `<span class="asg-tag">${esc(sc.unit)}</span>`);
    tl.fromTo(box, { opacity: 0 }, { opacity: 1, duration: 0.4 }, t0 + 0.25);
    const cols = sc.to > 8 ? 5 : 4, rows = Math.ceil(sc.to / cols), cell = 160;
    const ox = 540 - (cols * cell) / 2 + 20, oy = 840 + (3 - rows) * cell * 0.4;
    for (let i = 0; i < sc.to; i++) {
      const it = icon(sc.icon, 120, root, "slot"); it.style.left = ox + (i % cols) * cell + "px"; it.style.top = oy + Math.floor(i / cols) * cell + "px";
      if (i < sc.from) tl.fromTo(it, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.8)" }, t0 + 0.35 + i * 0.08);
      else {
        tl.fromTo(it, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2)" }, sc.at + (i - sc.from) * 0.08);
        if (sc.backAt) tl.to(it, { scale: 0, opacity: 0, duration: 0.3, ease: "power3.in" }, sc.backAt + (sc.to - 1 - i) * 0.05);
      }
    }
    const cnt = el("div", "inst", root, `<b></b> ${esc(sc.unit)} running`);
    const o = { v: sc.from }; cnt.firstChild.textContent = sc.from;
    tl.to(o, { v: sc.to, duration: 0.08 * (sc.to - sc.from) + 0.3, ease: "none", onUpdate: () => (cnt.firstChild.textContent = Math.round(o.v)) }, sc.at);
    if (sc.backAt) tl.to(o, { v: sc.from, duration: 0.5, ease: "none", onUpdate: () => (cnt.firstChild.textContent = Math.round(o.v)) }, sc.backAt);
    tl.fromTo(cnt, { opacity: 0 }, { opacity: 1, duration: 0.3 }, t0 + 0.4);
  };

  B.orbit = (sc, root, t0, t1) => {
    const cx = 540, cy = 850, R = 340, n = sc.items.length;
    const spin = el("div", "spin", root);
    const svg = svgEl("svg", { class: "full", viewBox: "0 0 1080 1920" }, spin);
    svgEl("circle", { cx, cy, r: R, fill: "none", stroke: C.line, "stroke-width": 2, "stroke-dasharray": "6 14" }, svg);
    const rot = 24;
    tl.fromTo(spin, { rotation: -rot / 2 }, { rotation: rot / 2, duration: t1 - t0, ease: "none", transformOrigin: `${cx}px ${cy}px` }, t0);
    for (let i = 0; i < 3; i++) {
      const p = el("div", "pulse", root);
      tl.fromTo(p, { scale: 0.4, opacity: 0.7 }, { scale: 2.3, opacity: 0, duration: 1.6, ease: "power1.out", repeat: Math.max(0, Math.floor((t1 - t0 - 1.6) / 1.6)) }, t0 + 0.2 + i * 0.53);
    }
    const c = icon(sc.center.icon, 220, root, "orb-center");
    tl.fromTo(c, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.7)" }, t0 + 0.15);
    if (sc.center.name) { const nm = el("div", "orb-cname", root, esc(sc.center.name)); tl.fromTo(nm, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, t0 + 0.4); }
    sc.items.forEach((it, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      const L = R - 150;
      const ln = svgEl("line", { x1: cx + Math.cos(a) * 130, y1: cy + Math.sin(a) * 130, x2: cx + Math.cos(a) * (R - 80), y2: cy + Math.sin(a) * (R - 80), stroke: C.bar, "stroke-width": 4, "stroke-dasharray": L, "stroke-dashoffset": L }, svg);
      tl.to(ln, { attr: { "stroke-dashoffset": 0 }, duration: 0.35, ease: "power2.out" }, it.at - 0.1);
      const sat = el("div", "sat", spin); sat.style.left = x - 75 + "px"; sat.style.top = y - 70 + "px";
      tl.fromTo(sat, { rotation: rot / 2 }, { rotation: -rot / 2, duration: t1 - t0, ease: "none" }, t0);
      const pop = el("div", "sat-pop", sat);
      const ic = icon(it.icon, 130, pop);
      el("div", "sat-n", pop, esc(it.name));
      tl.fromTo(pop, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2)" }, it.at);
      const d = el("div", "pkt sm", spin); d.style.boxShadow = GLOW ? `0 0 18px 7px ${C.hl}` : `0 0 0 5px ${C.ink}`;
      tl.fromTo(d, { x: cx - 10, y: cy - 10, opacity: 0 }, { opacity: 1, duration: 0.05 }, it.at - 0.1);
      tl.to(d, { x: x - 10, y: y - 10, duration: 0.35, ease: "power2.in" }, it.at - 0.1);
      tl.to(d, { opacity: 0, duration: 0.05 }, it.at + 0.25);
      glowPulse(ic, it.at + 0.2, C.hl, 50);
    });
  };

  B.outro = (sc, root, t0, t1) => {
    const box = el("div", "outro", root);
    if (sc.icon) { const ic = icon(sc.icon, 170, box, "outro-icon"); tl.fromTo(ic, { opacity: 0, scale: 0.5, y: 40 }, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "back.out(1.7)" }, t0 + 0.35); }
    const h = el("div", "outro-big", box);
    const ws = words(h, sc.title, sc.highlight);
    tl.fromTo(ws, { opacity: 0, y: 70, filter: "blur(10px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55, stagger: 0.08, ease: "power4.out" }, t0 + 0.6);
    if (sc.sub) { const s = el("div", "outro-sub", box, esc(sc.sub)); tl.fromTo(s, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45 }, t0 + 1.2); }
    if (sc.next) { const nx = el("div", "outro-next", box, esc(sc.next)); tl.fromTo(nx, { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 0.7, ease: "power3.out" }, Math.max(t0 + 1.6, t1 - 1.8)); }
    if (PLAN.brand.handle) { const f = el("div", "outro-follow", box, "FOLLOW " + esc(PLAN.brand.handle)); tl.fromTo(f, { opacity: 0 }, { opacity: 1, duration: 0.4 }, Math.max(t0 + 1.9, t1 - 1.4)); }
  };

  // ---------------- build ----------------
  PLAN.scenes.forEach((sc, i) => {
    const inner = $("#sc-" + i + " .inner"), cam = $("#sc-" + i + " .cam");
    (B[sc.type] || B.cards)(sc, cam, sc.t0, sc.t1);
    // slow camera move inside every scene
    const d = sc.t1 - sc.t0, dir = i % 2 ? 1 : -1;
    if (S.camera === "push") tl.fromTo(cam, { scale: 1 }, { scale: 1.06, duration: d, ease: "none" }, sc.t0);
    else if (S.camera === "drift") tl.fromTo(cam, { x: -18 * dir, scale: 1.02 }, { x: 18 * dir, scale: 1.04, duration: d, ease: "none" }, sc.t0);
    else tl.fromTo(cam, { y: 16, rotation: -0.4 * dir }, { y: -16, rotation: 0.4 * dir, duration: d, ease: "sine.inOut" }, sc.t0);
    const tr = S.transitions[i];
    if (i > 0) { enter(inner, tr, sc.t0); overlay(tr, sc.t0, i); } else tl.fromTo(inner, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0);
    if (i < PLAN.scenes.length - 1) exit(inner, S.transitions[i + 1], sc.t1);
    // progress segment
    const seg = $("#seg-" + i);
    if (seg) tl.fromTo(seg, { scaleX: 0 }, { scaleX: 1, duration: d, ease: "none" }, sc.t0);
  });

  // Three.js layer visibility (hook + outro)
  PLAN.three.forEach((r) => {
    tl.fromTo("#three-wrap", { opacity: 0 }, { opacity: 1, duration: 0.6 }, r.t0);
    tl.to("#three-wrap", { opacity: 0, duration: 0.4 }, r.t1 - 0.4);
  });
  tl.set("#three-wrap", { opacity: 0 }, 0);

  // ---------------- captions ----------------
  const outro = PLAN.scenes[PLAN.scenes.length - 1];
  const capEnd = outro.type === "outro" ? outro.t0 : PLAN.duration;
  const capWords = PLAN.words.filter((w) => w.s < capEnd - 0.1);
  const groups = []; let g = [];
  capWords.forEach((w, i) => {
    g.push(w);
    const nx = capWords[i + 1];
    if (g.length === 3 || /[.,?!:;]$/.test(w.w) || !nx || nx.scene !== w.scene) { groups.push(g); g = []; }
  });
  const pill = $("#cap-pill");
  pill.classList.add("cap-" + S.caption);
  groups.forEach((grp, gi) => {
    const box = el("div", "cg", pill);
    box.style.display = "none";
    const spans = grp.map((w) => el("span", "cw", box, esc(w.w.replace(/[.,;:]$/, ""))));
    const start = grp[0].s, nextStart = gi < groups.length - 1 ? groups[gi + 1][0].s : capEnd, end = Math.min(nextStart, grp[grp.length - 1].e + 0.6);
    tl.set(box, { display: "flex" }, start);
    tl.fromTo(box, { y: 16, opacity: 0.3, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 0.16, ease: "power2.out" }, start);
    tl.set(box, { display: "none" }, end);
    grp.forEach((w, wi) => {
      const base = { brutal: "#ffffff", ink: "#141414", comic: "#111111", swiss: "#ffffff", soft: "#1d1a24", riso: "#f6f1e6", kinetic: "#ffffff", term: C.accent }[S.caption] || C.ink;
      if (S.caption === "block") { tl.to(spans[wi], { backgroundColor: C.hl, color: "#05070d", duration: 0.05 }, w.s); tl.to(spans[wi], { backgroundColor: "rgba(0,0,0,0)", color: base, duration: 0.08 }, w.e); }
      else if (S.caption === "kinetic" || S.caption === "swiss" || S.caption === "riso") { tl.to(spans[wi], { backgroundColor: C.accent, color: S.caption === "kinetic" ? "#111111" : "#ffffff", duration: 0.04 }, w.s); tl.to(spans[wi], { backgroundColor: "rgba(0,0,0,0)", color: base, duration: 0.06 }, w.e); }
      else if (S.caption === "brutal") { tl.to(spans[wi], { backgroundColor: C.hl, color: "#111111", duration: 0.04 }, w.s); tl.to(spans[wi], { backgroundColor: "rgba(0,0,0,0)", color: base, duration: 0.06 }, w.e); }
      else { tl.to(spans[wi], { color: C.hl, scale: 1.08, duration: 0.06 }, w.s); tl.to(spans[wi], { color: base, scale: 1, duration: 0.1 }, w.e); }
    });
  });
  tl.set("#cap-pill", { opacity: 0 }, 0);
  if (groups.length) { tl.to("#cap-pill", { opacity: 1, duration: 0.2 }, groups[0][0].s); tl.to("#cap-pill", { opacity: 0, duration: 0.2 }, capEnd - 0.25); }

  // brand
  tl.fromTo(".brand, .ep, .prog", { opacity: 0, y: -20 }, { opacity: 0.95, y: 0, duration: 0.6, stagger: 0.1 }, 0.1);

  window.__timelines = window.__timelines || {};
  window.__timelines["main"] = tl;
})();
