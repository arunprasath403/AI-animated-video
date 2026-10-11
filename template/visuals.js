// Seek-driven WebGL layers: a shader background (4 seeded looks) and Three.js 3D
// moments (warp tunnel, particle galaxy, globe). Both redraw on every `hf-seek`.
import * as THREE from "three";

const PLAN = window.PLAN, S = PLAN.style;
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

// ---------- background shader ----------
const bc = document.getElementById("bg-canvas");
const gl = bc.getContext("webgl", { preserveDrawingBuffer: true, antialias: false });
const VS = "attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }";
const FS = `precision highp float;
uniform vec2 uRes; uniform float uT; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uMode; uniform float uWarp; uniform float uSpeed; uniform float uScale; uniform float uTilt; uniform float uLight;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
void main(){
  vec2 p = (gl_FragCoord.xy - .5*uRes) / uRes.y; float t = uT * uSpeed;
  p = mat2(cos(uTilt), -sin(uTilt), sin(uTilt), cos(uTilt)) * p;
  vec3 base = vec3(0.012,0.016,0.035), col = base;
  if (uMode < .5) {
    vec2 q = vec2(fbm(p*uScale + vec2(0., t)), fbm(p*uScale + vec2(5.2, -t)));
    vec2 r = vec2(fbm(p*1.4 + uWarp*q + vec2(1.7, 9.2) + t*.6), fbm(p*1.4 + uWarp*q + vec2(8.3, 2.8) - t*.5));
    float f = fbm(p*1.2 + 2.6*r);
    col = mix(col, uA*.6, smoothstep(.35,.95,f));
    col = mix(col, uB*.5, smoothstep(.55,1.05,length(r)) * .5);
  } else if (uMode < 1.5) {
    float w = fbm(vec2(p.x*uScale*1.4 + t*1.5, t*.7));
    for (int i=0;i<3;i++){ float fi=float(i); float y = .25 - fi*.18 + (w-.5)*.55 + .06*sin(p.x*3.+t*4.+fi*2.);
      float band = exp(-pow((p.y-y)*(7.+fi*3.),2.)); col += mix(uA, uB, fi/2.) * band * (.45 - fi*.08) * (.6+.6*fbm(p*3.+t+fi)); }
    col += uA*.12*fbm(p*2.+t);
  } else if (uMode < 2.5) {
    float hz = -.05; vec3 sky = mix(base, uA*.35, smoothstep(-.4,.9,p.y));
    col = sky;
    if (p.y < hz) { float d = hz - p.y; vec2 g = vec2(p.x/d, 1./d + t*6.); vec2 f = abs(fract(g*vec2(.9,.5))-.5);
      float line = smoothstep(.06,.0,min(f.x,f.y)*d*3.); col = mix(base*.6, uB*.42, line*smoothstep(.0,.3,d)*smoothstep(1.4,.2,d)) + uA*.1*smoothstep(.5,.0,d); }
    col += uB*.22*exp(-pow((p.y-hz)*14.,2.));
    col += uA*.18*fbm(p*2.5+vec2(t,0.));
  } else if (uMode < 3.5) {
    col = mix(base, uA*.25, fbm(p*1.5+t));
    for (int i=0;i<22;i++){ float fi=float(i); vec2 c = vec2(h(vec2(fi,1.3))-.5, h(vec2(fi,7.1))-.5)*vec2(1.2,1.9);
      c.y = mod(c.y + t*(.15+.2*h(vec2(fi,3.))) + .95, 1.9) - .95; float rad = .03 + .09*h(vec2(fi,9.));
      float b = smoothstep(rad, rad*.7, length(p-c)); col += mix(uA,uB,h(vec2(fi,5.))) * b * .22; }
  } else if (uMode < 4.5) {
    // paper: warm sheet, two soft ink blobs, paper fibre
    col = uC;
    vec2 c1 = vec2(-.35 + .12*sin(t*2.), .45 + .08*cos(t*1.7)), c2 = vec2(.38 + .1*cos(t*1.3), -.35 + .1*sin(t*2.2));
    col = mix(col, uA, smoothstep(.55, .0, length(p-c1)) * .9);
    col = mix(col, uB, smoothstep(.6, .0, length(p-c2)) * .8);
    col -= .035 * fbm(p*vec2(40., 3.) + 3.) - .02*fbm(p*9.);
  } else if (uMode < 5.5) {
    // blueprint: drafting grid
    col = uA * (1.05 - .35*length(p));
    vec2 g = (p + vec2(t*.15, t*.08)) * 18.; vec2 f = abs(fract(g) - .5);
    float minor = smoothstep(.03, .0, min(f.x, f.y) / 18. * 12.);
    vec2 G = (p + vec2(t*.15, t*.08)) * 3.; vec2 F2 = abs(fract(G) - .5);
    float major = smoothstep(.012, .0, min(F2.x, F2.y) / 3. * 1.2);
    col += uB * (minor * .07 + major * .22);
    col += uB * .08 * smoothstep(.7, .0, length(p - vec2(.2, .3)));
  } else if (uMode < 6.5) {
    // mesh gradient
    vec2 q = p + .25*vec2(fbm(p*1.3 + t), fbm(p*1.3 - t));
    vec2 a = vec2(-.4 + .2*sin(t*1.7), .55), b = vec2(.45, .1 + .25*cos(t*1.3)), c = vec2(-.1 + .25*cos(t), -.6);
    float wa = 1./pow(length(q-a)+.15, 2.), wb = 1./pow(length(q-b)+.15, 2.), wc = 1./pow(length(q-c)+.15, 2.);
    col = (uA*wa + uB*wb + uC*wc) / (wa+wb+wc);
    col *= .82 + .18*fbm(p*2. + t);
  } else if (uMode < 7.5) {
    // bold color blocks with halftone + stripes
    col = uA;
    vec2 hp = p*42.; float dotR = .5 * smoothstep(-.2, .9, p.x - p.y*.6);
    float dots = smoothstep(dotR, dotR - .08, length(fract(hp) - .5));
    col = mix(col, col*.86, dots * step(.15, p.x - p.y*.6));
    float stripe = step(.5, fract((p.x + p.y)*7. - t*1.5)) * smoothstep(.05, .0, abs(p.y + .62 - p.x*.15) - .06);
    col = mix(col, uB, stripe * .9);
  } else if (uMode < 8.5) {
    // cinema: dark set, light shafts, dust
    col = vec3(.01, .01, .014);
    vec2 d = normalize(vec2(.45, -1.)); float along = dot(p - vec2(-.7, 1.), d), across = dot(p - vec2(-.7, 1.), vec2(-d.y, d.x));
    float shafts = fbm(vec2(across*9., t*.6)) * smoothstep(1.8, .0, along) * smoothstep(.0, .3, along);
    col += uA * pow(shafts, 2.2) * 1.3;
    col += uB * .12 * smoothstep(.8, .0, length(p - vec2(.3, -.5)));
    float dust = step(.997, h(floor(gl_FragCoord.xy/2.) + floor(uT*8.))) * shafts;
    col += dust * .8;
  } else if (uMode < 9.5) {
    // sunset: outrun sky, striped sun low on the horizon, neon grid floor
    float hz = -.36; vec2 sc = vec2(0., hz + .1); float sr = .2, d = length(p - sc);
    col = mix(uA * .8, mix(uA, uC, .35), smoothstep(.6, hz, p.y));
    col += step(.996, h(floor(gl_FragCoord.xy / 2.))) * smoothstep(.0, .5, p.y) * .6;
    if (p.y > hz) {
      float yy = (sc.y - p.y) / sr, cut = yy > -.2 ? step(fract(yy * 5. - t * 1.5), (yy + .2) * .5) : 0.;
      vec3 sunc = mix(uC, vec3(1., .82, .35), smoothstep(-.2, .2, p.y - sc.y));
      col = mix(col, sunc * .6, smoothstep(sr, sr - .005, d) * (1. - cut));
      col += uC * .18 * exp(-max(d - sr, 0.) * 7.);
    } else {
      float dd = hz - p.y + .02; vec2 g = vec2(p.x / dd, 1. / dd + t * 8.); vec2 f = abs(fract(g * vec2(.9, .5)) - .5);
      float line = smoothstep(.07, .0, min(f.x, f.y) * dd * 3.);
      col = mix(uA * .4, uB * .6, line * smoothstep(1.2, .05, dd)) + uC * .08 * smoothstep(.3, .0, dd);
    }
    col += uB * .25 * exp(-pow((p.y - hz) * 50., 2.));
  } else if (uMode < 10.5) {
    // rain: falling glyph columns
    col = uA;
    vec2 g = p * 34.; vec2 id = floor(g), f = fract(g);
    float sp = .5 + h(vec2(id.x, 1.)) * 1.3, off = h(vec2(id.x, 2.)) * 30.;
    float tr = fract(-(p.y + .5) * .55 - uT * sp * .25 + off);
    float glyph = step(.45, h(floor(f * vec2(3., 5.)) + id * 7.31 + floor(uT * 6. * sp))) * step(.12, f.x) * step(f.x, .88) * step(.08, f.y) * step(f.y, .92);
    float b = pow(tr, 7.) * step(.35, h(vec2(id.x, 9.)));
    col += uB * glyph * b * .3 + uC * glyph * step(.985, tr) * b * .45;
    col += uB * .04 * fbm(p * 2. + t);
    col *= .9 + .1 * sin(gl_FragCoord.y * 1.5708);
  } else if (uMode < 11.5) {
    // burst: comic sunburst rays + halftone
    vec2 o = vec2(0., .22); float a = atan(p.y - o.y, p.x - o.x);
    float rays = step(.5, fract(a / 6.2832 * 20. + t * .25));
    col = mix(uA, uB, rays * .5);
    float rad = .46 * smoothstep(.25, 1.15, length(p - o));
    float dots = smoothstep(rad, rad - .07, length(fract(p * 40.) - .5));
    col = mix(col, uC, dots * .45);
  } else if (uMode < 12.5) {
    // dots: swiss grid, a moving disc and a rule
    col = uA;
    col = mix(col, uB, smoothstep(.1, .07, length(fract(p * 22.) - .5)) * .18);
    vec2 cc = vec2(.27 + .02 * sin(t * 2.), .47 + .02 * cos(t * 1.4));
    col = mix(col, uC, smoothstep(.12, .118, length(p - cc)));
    col = mix(col, uB, step(abs(p.x + .245), .006) * .9);
    col = mix(col, uB, step(abs(p.y + .4), .003) * step(p.x, .2) * .8);
  } else if (uMode < 13.5) {
    // nebula with stars
    float f = fbm(p * 1.5 + vec2(t * .5, -t * .3)), g2 = fbm(p * 2.8 + f * 2.3 - t * .3);
    col = uA + uB * pow(f, 2.6) * 1.4 + uC * pow(g2, 3.5) * 1.3;
    for (int i = 0; i < 2; i++) { float s = 70. + float(i) * 50.; vec2 sp = p * s + float(i) * 13.; vec2 id = floor(sp);
      float st = step(.985, h(id)) * smoothstep(.35, .0, length(fract(sp) - .5)); col += st * (.55 + .45 * sin(uT * 3. + h(id + 4.) * 30.)); }
  } else if (uMode < 14.5) {
    // circuit board traces with travelling pulses
    vec2 g = p * 9. + vec2(0., t * .4); vec2 id = floor(g), f = fract(g); float r1 = h(id);
    float lh = smoothstep(.05, .025, abs(f.y - .5)) * step(.4, r1), lv = smoothstep(.05, .025, abs(f.x - .5)) * step(r1, .6);
    float pad = smoothstep(.13, .1, length(f - .5)) * step(.75, h(id + 3.));
    float tr = max(max(lh, lv), pad);
    col = uA + uA * .4 * fbm(p * 3.) + uB * .22 * tr;
    float pos = lh > .5 ? f.x : f.y, pl = fract(uT * .9 + h(id + 7.));
    col += uC * tr * smoothstep(.15, .0, abs(pos - pl)) * step(.55, h(id + 9.)) * 1.3;
  } else if (uMode < 15.5) {
    // chalk: slate board, smudges, erased arcs, dust
    col = uA * (1. + .25 * (fbm(p * vec2(2.5, 1.2) + t * .2) - .5));
    col += uB * .06 * smoothstep(.5, .9, fbm(p * vec2(6., 1.5) + 3.));
    float arc = smoothstep(.03, .0, abs(length(p - vec2(.35, .55)) - .45)) * smoothstep(.3, .7, fbm(p * 8.));
    col += uB * arc * .1;
    col += uC * .05 * smoothstep(.04, .0, abs(p.y + .62 + .02 * sin(p.x * 9.))) * step(p.x, .15);
    col += (h(gl_FragCoord.xy * .7) - .5) * .05;
  } else if (uMode < 16.5) {
    // holo: iridescent foil sheen
    float f = fbm(p * 1.2 + t * .6), th = p.x * 1.4 + p.y * .9 + f * 2.4 + t * .7;
    vec3 irid = mix(.5 + .5 * cos(6.2832 * (th + vec3(0., .33, .67))), vec3(1.), .4);
    col = mix(uA, irid * mix(uB, uC, .5 + .5 * sin(th)) * .8, .3 * smoothstep(.15, .85, f + .2));
    col += vec3(.18) * exp(-pow((p.x + p.y * .5 - sin(t * 1.5) * .7) * 5., 2.));
  } else if (uMode < 17.5) {
    // noir: blinds of light, smoke, rain
    col = vec3(.018);
    float blinds = step(.42, fract((p.y + p.x * .35) * 8. + t * .2));
    col += uB * blinds * smoothstep(.85, .0, length((p - vec2(-.3, .3)) * vec2(.8, 1.1))) * .3;
    col += uB * .05 * fbm(p * 2. + vec2(t, -t * .5));
    vec2 rp = vec2(p.x * 90., p.y * 3. + uT * 2.4); float rid = floor(rp.x), rr = fract(rp.y + h(vec2(rid, 1.)) * 10.);
    col += uB * .2 * step(.93, h(vec2(rid, 2.))) * smoothstep(.0, .05, rr) * smoothstep(.25, .05, rr) * smoothstep(.2, .0, abs(fract(rp.x) - .5));
    col += uC * .1 * smoothstep(.6, .0, length(p - vec2(.3, -.65)));
  } else if (uMode < 18.5) {
    // topo: contour map
    float e = fbm(p * 1.5 + vec2(t * .25, 0.)) + .3 * fbm(p * 4. - t * .1);
    float k = e * 13., d = abs(fract(k) - .5), major = step(.5, mod(floor(k + .5), 5.)) < .5 ? 1. : 0.;
    col = mix(uA, uC, smoothstep(.62, .78, e) * .22);
    col = mix(col, uB, smoothstep(.42, .48 - major * .02, d) * (.35 + major * .3));
    col -= .025 * fbm(p * vec2(30., 3.));
  } else if (uMode < 19.5) {
    // crt: scanlines, tearing, rgb noise
    float row = floor(p.y * 30.), fr = floor(uT * 8.);
    float band = step(.95, h(vec2(row, fr)));
    vec2 q = p + vec2(band * (h(vec2(fr, row)) - .5) * .1, 0.);
    col = uA + uB * .08 * fbm(q * 3. + t);
    vec2 gg = abs(fract(q * 5.) - .5); col += uB * .1 * smoothstep(.485, .5, max(gg.x, gg.y));
    col += mix(uB, uC, step(.5, h(vec2(row, fr + 1.)))) * band * .12;
    col += uB * .07 * smoothstep(.06, .0, abs(fract(p.y * .5 - uT * .12) - .5));
    col *= .78 + .22 * sin(gl_FragCoord.y * 1.5708);
  } else if (uMode < 20.5) {
    // ocean: deep water, caustics, light rays, bubbles
    col = mix(uA * .45, uA, smoothstep(-.9, .9, p.y));
    vec2 q = p * 3.2 + vec2(0., t);
    float c = 1. - abs(fbm(q + fbm(q * .7 + t * 1.3) * 1.8) * 2. - 1.);
    col += uB * pow(c, 7.) * .5 * smoothstep(-.9, .6, p.y);
    float shafts = fbm(vec2(p.x * 7. + p.y * 1.5, t * .5)) * smoothstep(-.6, .9, p.y);
    col += uC * pow(shafts, 2.5) * .5;
    for (int i = 0; i < 12; i++) { float fi = float(i); vec2 c2 = vec2(h(vec2(fi, 2.)) - .5, mod(h(vec2(fi, 5.)) * 1.9 + uT * (.05 + .05 * h(vec2(fi, 8.))), 1.9) - .95) * vec2(.6, 1.);
      float rr = .006 + .012 * h(vec2(fi, 3.)); col += uB * .5 * smoothstep(rr, rr * .6, abs(length(p - c2) - rr * .5)); }
  } else if (uMode < 21.5) {
    // pastel: soft drifting blobs on cream
    col = uA;
    vec2 c1 = vec2(-.2 + .1 * sin(t * 1.7), .45 + .1 * cos(t * 1.2)), c2 = vec2(.25 + .1 * cos(t * 1.3), -.05 + .12 * sin(t * 1.9)), c3 = vec2(-.15 + .1 * cos(t), -.55);
    col = mix(col, uB, smoothstep(.55, .0, length(p - c1)) * .95);
    col = mix(col, uC, smoothstep(.5, .0, length(p - c2)) * .9);
    col = mix(col, mix(uB, uC, .5), smoothstep(.45, .0, length(p - c3)) * .8);
    col += (h(gl_FragCoord.xy + floor(uT * 12.)) - .5) * .035;
  } else if (uMode < 22.5) {
    // riso: two inks, multiply, grain, misregistration
    col = uA; float gr = h(gl_FragCoord.xy * .5 + 1.);
    vec2 c1 = vec2(.2 + .02 * sin(t * 1.5), .4);
    float s1 = smoothstep(.15, .147, length(p - c1)), band = step(abs(p.y + .44 + .02 * sin(p.x * 12. + t * 2.)), .025);
    float s2 = smoothstep(.1, .097, length(p - c1 - vec2(-.12, -.1) - vec2(.008, .005))) + step(abs(p.x + .24), .008) * step(-.45, p.y);
    col = mix(col, col * uB, clamp(max(s1, band), 0., 1.) * (.5 + .3 * gr));
    col = mix(col, col * uC, clamp(s2, 0., 1.) * (.5 + .3 * gr));
    col -= .03 * fbm(p * vec2(40., 4.));
  } else if (uMode < 23.5) {
    // deco: gold fan, arcs and a double frame
    vec2 d = p - vec2(0., -1.0); float a = atan(d.x, d.y), r = length(d);
    float rays = smoothstep(.44, .5, abs(fract(a * 24. / 6.2832) - .5)) * smoothstep(1.55, .2, r);
    float arcs = smoothstep(.46, .5, abs(fract(r * 5. - t * .3) - .5)) * smoothstep(1.6, .3, r);
    col = uA + uB * (rays * .2 + arcs * .14) + uC * .1 * smoothstep(1.2, .0, r);
    col += uB * .1 * exp(-pow((a - sin(t * 1.2) * .7) * 3., 2.)) * smoothstep(1.5, .2, r);
    vec2 q = abs(p); float bd = max(q.x - .255, q.y - .475);
    col += uB * (smoothstep(.003, .0, abs(bd)) * .55 + smoothstep(.002, .0, abs(bd + .014)) * .35);
  } else {
    // speed: diagonal speed lines and a slash stripe
    vec2 q = mat2(.94, -.34, .34, .94) * p;
    float lane = floor(q.y * 46.), ly = abs(fract(q.y * 46.) - .5);
    float seg = fract(q.x * (.6 + h(vec2(lane, 1.))) - uT * (.6 + h(vec2(lane, 3.)) * 1.6) + h(vec2(lane, 2.)));
    float ln = step(.72, h(vec2(lane, 5.))) * smoothstep(.0, .04, seg) * smoothstep(.55, .2, seg) * smoothstep(.2, .0, ly);
    col = uA + uA * .5 * fbm(p * 2. + t) + mix(uB, uC, step(.5, h(vec2(lane, 6.)))) * ln * .45;
    col = mix(col, uC * .55, smoothstep(.004, .0, abs(q.y - .52) - .05) * .7);
  }
  float vig = smoothstep(1.2, .25, length(p*vec2(1.,.82)));
  if (uMode < 3.5) { col += uB * .05 * smoothstep(.6, .0, length(p - vec2(.0, .25))); col *= vig; }
  else if (uMode > 3.5 && uMode < 4.5 || uMode > 6.5 && uMode < 7.5) col *= mix(1., vig, .25);
  else if (uMode > 7.5 && uMode < 8.5) col *= vig * vig;
  else if (uMode > 8.5) col *= mix(1., vig, uLight > .5 ? .18 : .7);
  else col *= mix(1., vig, .6);
  col += (h(gl_FragCoord.xy + floor(uT*24.)) - .5) * (uMode > 7.5 && uMode < 8.5 ? .07 : .04);
  gl_FragColor = vec4(col, 1.);
}`;
const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
const prog = gl.createProgram();
gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const U = (k) => gl.getUniformLocation(prog, k);
const tints = PLAN.scenes.map((sc, i) => [sc.t0, hex(S.sceneTint[i][0]), hex(S.sceneTint[i][1]), hex(S.sceneTint[i][2] || S.sceneTint[i][1])]);
function tintAt(t) {
  let i = 0; while (i < tints.length - 1 && t >= tints[i + 1][0]) i++;
  const cur = tints[i], prev = tints[Math.max(0, i - 1)], k = i ? Math.min(1, (t - cur[0]) / (S.shader.name === "blocks" || S.shader.name === "crt" ? 0.05 : 0.9)) : 1;
  const mix = (a, b) => a.map((v, j) => v + (b[j] - v) * k);
  return [mix(prev[1], cur[1]), mix(prev[2], cur[2]), mix(prev[3], cur[3])];
}
function drawBg(t) {
  const [A, Bc, Cc] = tintAt(t);
  gl.viewport(0, 0, bc.width, bc.height);
  gl.uniform2f(U("uRes"), bc.width, bc.height); gl.uniform1f(U("uT"), t);
  gl.uniform3fv(U("uA"), A); gl.uniform3fv(U("uB"), Bc); gl.uniform3fv(U("uC"), Cc);
  gl.uniform1f(U("uMode"), S.shader.mode); gl.uniform1f(U("uWarp"), S.shader.warp); gl.uniform1f(U("uSpeed"), S.shader.speed); gl.uniform1f(U("uScale"), S.shader.scale); gl.uniform1f(U("uTilt"), S.tilt); gl.uniform1f(U("uLight"), S.dark ? 0 : 1);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// ---------- Three.js moments ----------
const canvas = document.getElementById("three-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1080, 1920, false); renderer.setPixelRatio(1);
const camera = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.1, 200);
const A = new THREE.Color(S.palette.accent), B2 = new THREE.Color(S.palette.accent2);
let s = (S.seed % 2147483646) + 1; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
const dot = document.createElement("canvas"); dot.width = dot.height = 64;
{ const c = dot.getContext("2d"), g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,0.65)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }
const tex = new THREE.CanvasTexture(dot);
const pmat = (size, opacity) => new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });

function makeWarp() {
  const scene = new THREE.Scene(), N = 2400, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), base = [];
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2, r = 0.6 + rnd() * 5, z = -rnd() * 90;
    base.push([Math.cos(a) * r, Math.sin(a) * r, z]);
    const c = rnd() < 0.5 ? A : B2; col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(g, pmat(0.16, 0.95)));
  return { scene, draw(lt) {
    const sp = 14 + 30 * Math.exp(-lt * 1.2);
    for (let i = 0; i < N; i++) { const b = base[i]; let z = b[2] + lt * sp; z = ((z % 90) + 90) % 90 - 90; pos[i * 3] = b[0]; pos[i * 3 + 1] = b[1] + 1.2; pos[i * 3 + 2] = z; }
    g.attributes.position.needsUpdate = true;
    camera.position.set(0, 1.2, 6); camera.lookAt(0, 1.2, -10); camera.rotation.z = lt * 0.12;
  } };
}

function makeGalaxy() {
  const scene = new THREE.Scene(), N = 5000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const arms = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < N; i++) {
    const r = Math.pow(rnd(), 0.6) * 3.2, arm = (i % arms) / arms * Math.PI * 2, a = arm + r * 1.35 + (rnd() - 0.5) * 0.5;
    pos.set([Math.cos(a) * r + (rnd() - 0.5) * 0.2, (rnd() - 0.5) * 0.18 * (3.4 - r), Math.sin(a) * r + (rnd() - 0.5) * 0.2], i * 3);
    const c = A.clone().lerp(B2, Math.min(1, r / 3)); col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const grp = new THREE.Group(); grp.add(new THREE.Points(g, pmat(0.05, 0.85))); scene.add(grp);
  return { scene, draw(lt) {
    grp.rotation.y = lt * 0.35; grp.rotation.x = 0.55 + Math.sin(lt * 0.4) * 0.08; grp.position.y = 1.5;
    grp.scale.setScalar(0.75 + 0.25 * (1 - Math.pow(1 - Math.min(1, lt / 1.6), 3)));
    camera.position.set(0, 0, 9); camera.lookAt(0, 0, 0); camera.rotation.z = 0;
  } };
}

function makeGlobe() {
  const scene = new THREE.Scene(), grp = new THREE.Group(); scene.add(grp);
  const N = 2600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963; pos.set([Math.cos(th) * r, y, Math.sin(th) * r], i * 3); col.set([B2.r * 0.8, B2.g * 0.8, B2.b * 0.8], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  grp.add(new THREE.Points(g, pmat(0.028, 0.8)));
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.985, 48, 48), new THREE.MeshBasicMaterial({ color: 0x050a1c })));
  const ll = (lat, lon) => { const a = (90 - lat) * Math.PI / 180, b = (lon + 180) * Math.PI / 180; return new THREE.Vector3(-Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)); };
  const cities = [[39, -77], [45.5, -122.7], [37.7, -122.4], [53.3, -6.3], [50.1, 8.7], [51.5, -0.1], [19.1, 72.9], [1.35, 103.8], [35.7, 139.7], [-33.9, 151.2], [-23.5, -46.6], [45.5, -73.6], [25.2, 55.3], [37.5, 127], [12.97, 77.6], [-26.2, 28]].map(([a, b]) => ll(a, b));
  cities.forEach((v) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: A, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.copy(v.clone().multiplyScalar(1.01)); sp.scale.set(0.15, 0.15, 1); grp.add(sp); });
  const arcs = [];
  for (let k = 0; k < 14; k++) {
    const a = cities[Math.floor(rnd() * cities.length)], b = cities[Math.floor(rnd() * cities.length)];
    if (a === b) continue;
    const mid = a.clone().add(b).normalize().multiplyScalar(1 + a.distanceTo(b) * 0.35);
    const geo = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(64));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: A, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }));
    grp.add(line); arcs.push(line);
  }
  return { scene, draw(lt) {
    grp.rotation.y = -1.2 + lt * 0.22; grp.rotation.x = -0.25; grp.position.set(0, 0.95, 0);
    grp.scale.setScalar(0.82 + 0.18 * (1 - Math.pow(1 - Math.min(1, lt / 1.4), 3)));
    arcs.forEach((l, i) => { const k = Math.max(0, Math.min(1, (lt - 0.5 - i * 0.12) / 0.6)); l.geometry.setDrawRange(0, Math.floor(65 * k)); });
    camera.position.set(0, 0, 7.2); camera.lookAt(0, 0, 0); camera.rotation.z = 0;
  } };
}

// Floating wireframe shards and dust, a slow dolly through them (ambient 3D for cinema).
function makeShards() {
  const scene = new THREE.Scene(), grp = new THREE.Group(); scene.add(grp);
  const geos = [new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0), new THREE.TetrahedronGeometry(1, 0), new THREE.TorusGeometry(0.8, 0.02, 6, 48)];
  const items = [];
  for (let i = 0; i < 46; i++) {
    const m = new THREE.LineSegments(new THREE.EdgesGeometry(geos[i % geos.length]), new THREE.LineBasicMaterial({ color: i % 3 ? A : B2, transparent: true, opacity: 0.18 + rnd() * 0.3, blending: THREE.AdditiveBlending }));
    m.position.set((rnd() - 0.5) * 14, (rnd() - 0.5) * 22, -rnd() * 40);
    const sc = 0.2 + rnd() * 1.1; m.scale.setScalar(sc);
    items.push({ m, rx: (rnd() - 0.5) * 0.6, ry: (rnd() - 0.5) * 0.6 }); grp.add(m);
  }
  const N = 1500, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos.set([(rnd() - 0.5) * 20, (rnd() - 0.5) * 30, -rnd() * 45], i * 3); const c = A.clone().multiplyScalar(0.6 + rnd() * 0.4); col.set([c.r, c.g, c.b], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  grp.add(new THREE.Points(g, pmat(0.05, 0.6)));
  return { scene, draw(lt) {
    items.forEach((it) => { it.m.rotation.x = lt * it.rx; it.m.rotation.y = lt * it.ry; });
    camera.position.set(Math.sin(lt * 0.1) * 0.8, 0, 8 - lt * 0.35); camera.lookAt(0, 0, -30); camera.rotation.z = Math.sin(lt * 0.07) * 0.05;
  } };
}

const makers = { warp: makeWarp, particles: makeGalaxy, globe: makeGlobe, shards: makeShards };
const moments = PLAN.three.map((r) => ({ ...r, v: (makers[r.visual] || makeGalaxy)() }));

function renderAt(t) {
  drawBg(t);
  const m = moments.find((r) => t >= r.t0 - 0.05 && t <= r.t1 + 0.05);
  if (m) { m.v.draw(t - m.t0); renderer.render(m.v.scene, camera); }
}
window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(window.__hfThreeTime || 0);
