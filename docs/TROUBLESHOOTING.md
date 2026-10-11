# Troubleshooting

Start with `c2v doctor`. It checks Node, FFmpeg, Python with the voice model, and Chrome.

| Problem | Fix |
|---|---|
| `hyperframes tts ... exited 1` / `Python 3 not found` | The voice runs in Python. On Windows, run `winget install -e --id Python.Python.3.12`, open a **new** terminal, then run `py -3.12 -m pip install kokoro-onnx soundfile`. On macOS/Linux, run `python3 -m pip install kokoro-onnx soundfile`. |
| `node` / `ffmpeg` "not recognized" after setup | Close the terminal and open a new one so the updated PATH loads. |
| `c2v check` reports errors | Fix the listed fields. A `cue` must be a word that appears in that scene's `say`. |
| Captions a little early or late | Add `--whisper` for exact word timing (uses whisper.cpp locally). |
| Render can't find Chrome | Run `npx hyperframes browser ensure`. |
| No sound on a phone preview | The MP4 has AAC stereo audio, but some in-app previewers start muted. Try VLC or another player. |
| Render is slow | Use `--quality draft` while iterating. Close other heavy apps, since rendering uses every CPU core. |
| A file is too big to share | Re-encode it: `ffmpeg -i in.mp4 -c:v libx264 -crf 24 -c:a copy out.mp4` |

**Optional automatic scripts.** Set `"llm": {"enabled": true, "baseUrl": "...", "model": "..."}` in `c2v.config.json` to use any OpenAI-compatible endpoint, such as Ollama or LM Studio. `c2v make "topic"` then writes the plan itself, and `c2v batch topics.txt` makes one video per line.
