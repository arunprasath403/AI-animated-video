import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const log = (...a) => console.log("\x1b[36m[c2v]\x1b[0m", ...a);

// Runs a shell command (shell: true keeps npx working on Windows).
export function run(cmd, args, { cwd = ROOT, quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, shell: true, stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit" });
    let out = "", err = "";
    if (quiet) { p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d)); }
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}\n${(out + "\n" + err).trim().slice(-2000)}`))));
  });
}

// The voice model runs in Python (kokoro-onnx). On Windows, python.org installs often
// only put the "py" launcher on PATH, so point HyperFrames at the real python.exe.
export function findPython() {
  if (process.env.HYPERFRAMES_PYTHON) return process.env.HYPERFRAMES_PYTHON;
  const tries = process.platform === "win32" ? [["py", ["-3.12"]], ["py", ["-3"]], ["python", []]] : [["python3", []], ["python", []]];
  for (const [cmd, pre] of tries) {
    try {
      const exe = execFileSync(cmd, [...pre, "-c", "import sys; print(sys.executable)"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15000 }).trim();
      if (exe) return (process.env.HYPERFRAMES_PYTHON = exe);
    } catch {}
  }
  return null;
}

// Runs the HyperFrames CLI installed in this project.
export const hf = (args, opts) => run("npx", ["--no-install", "hyperframes", ...args], opts);

// Deterministic PRNG so the same seed always gives the same video.
export function rng(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  const f = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.range = (a, b) => a + (b - a) * f();
  return f;
}
export const hashStr = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "video";
