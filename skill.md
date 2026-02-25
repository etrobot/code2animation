---
name: code2animation
description: End-to-end video production skill using the code2animation framework (https://github.com/etrobot/code2animation). Use this skill whenever the user wants to produce a code animation video, tech explainer video, or any animated video using code2animation — including writing the script, generating TTS audio, creating HTML/React visual assets, and rendering the final MP4. Trigger on any of: "make a video", "create an animation", "generate a code animation", "produce a tech video", "write a code2animation script", "render a video with code2animation", or any request that involves scripting + TTS + rendering in this stack. Always use this skill for the full pipeline, not just individual steps.
---

# Code2Animation Skill

You are an end-to-end video production assistant for the [code2animation](https://github.com/etrobot/code2animation) project. Given a topic or brief, you handle the full pipeline:

1. **Write the video script** — author a structured `VideoClip[]` array
2. **Generate TTS audio** — run `generate-audio.ts` to synthesize narration
3. **Create HTML/React visual assets** — produce custom footage files if needed
4. **Render the final video** — run `render.js` to output an MP4

---

## Prerequisites

Confirm these are available before starting:

- Node.js >= 18, pnpm >= 10.14.0
- FFmpeg installed and on PATH
- Chrome/Chromium available (or `PUPPETEER_EXECUTABLE_PATH` set)
- code2animation repo cloned and `pnpm install` completed
- Dev server running: `pnpm dev` (default: http://localhost:3000)

---

## Pipeline Overview

```
[User Brief]
     │
     ▼
① Write Script (public/script/<name>.js)
     │
     ▼
② Generate TTS Audio (pnpm tsx scripts/generate-audio.ts <name>)
     │
     ▼
③ Create Visual Assets (public/footage/*.html or media files)
     │
     ▼
④ Render Video (node scripts/render.js <projectId> --script <name>)
     │
     ▼
[Output: public/video/render-<projectId>.mp4]
```

---

## Step 1 — Write the Script

### File location

```
public/script/<scriptName>.json
```

### Script format

```json
// public/script/myVideo.json
{
  "projects": {
    "myVideo": {
      "name": "My Video",
      "clips": [
        {
          "type": "footagesAroundTitle",
          "title": "CODE\n2\nANIMATION",
          "speech": "Code2Animation is finally here. Transforming your scripts into cinematic visuals with pure control.",
          "media": [
            { "src": "/footage/chatbot.html", "word": "Code" },
            { "src": "/footage/chatbot.html", "word": "Animation" },
            { "src": "/footage/chatbot.html", "word": "cinematic" }
          ]
        },
        {
          "type": "footagesFullScreen",
          "title": "PURE\nCONTROL",
          "speech": "Absolute control over every pixel, every transition, and every word.",
          "media": [
            { "src": "/footage/chatbot.html", "word": "pure" },
            { "src": "/footage/chatbot.html", "word": "control" },
            { "src": "/footage/chatbot.html", "word": "pixel" }
          ]
        }
      ]
    }
  }
}
```

### Clip types

| Type | Visual style |
|------|-------------|
| `footagesAroundTitle` | Title/subtitle centered, media clips around it |
| `footagesFullScreen` | Media fills entire screen |

### MediaItem fields

```typescript
interface MediaItem {
  src?: string;       // path relative to public/ e.g. "footage/demo.mp4"
  word?: string;      // trigger word for timing synchronization
}
```

### Script writing best practices

- Keep each `speech` natural and conversational — it becomes the spoken narration.
- Match `duration` to speech length: ~130 words/minute as a guide.
- Use `footagesAroundTitle` for intro/transition clips, `footagesFullScreen` for deep-dives.
- Vary themes across clips for visual interest (`dark` → `neon` → `light`).
- For code clips, prefer short, illustrative snippets (< 20 lines).
- Aim for 5–12 clips per video (60–180 seconds total).
- Use `media.word` fields to synchronize visual elements with spoken words.
- For Chinese content, ensure `media.word` matches Chinese words in the speech text.

---

## Step 2 — Generate TTS Audio

After writing the script, generate all narration audio:

```bash
pnpm tsx scripts/generate-audio.ts <scriptName>
```

This reads each clip's `speech` field, synthesizes audio using Microsoft Edge TTS, and writes `.mp3` files to `public/audio/`. It also aligns audio timelines so durations match speech length.

**Voice options** (set per-clip via `voice` field):
- `en-US-JennyNeural` — friendly female (default)
- `en-US-GuyNeural` — male
- `zh-CN-XiaoxiaoNeural` — Mandarin female
- Browse full list: https://speech.microsoft.com/portal/voicegallery

---

## Step 3 — Create Visual Assets

### Option A: Use existing footage

Place video/image files in `public/footage/` and reference them via `src` in `MediaItem`.

### Option B: Create custom HTML animations

For dynamic visuals, create self-contained HTML files in `public/footage/`:

```html
<!-- public/footage/my-chart.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; background: #0f0f1a; display: flex;
           align-items: center; justify-content: center;
           width: 1920px; height: 1080px; }
    /* your animation styles */
  </style>
</head>
<body>
  <!-- animated SVG, Canvas, or DOM content -->
  <script>
    // animation logic — use CSS animations or requestAnimationFrame
  </script>
</body>
</html>
```

Reference it in the script:
```js
{ type: 'video', src: 'footage/my-chart.html' }
```

Puppeteer will render this HTML frame-by-frame during the render step.

### HTML asset guidelines

- Canvas size: **1920×1080px** (hardcode in CSS)
- Use CSS animations or JS-driven frame updates — both work with Puppeteer
- No external network calls — bundle everything inline or use `public/` paths
- Test locally by opening the HTML in a browser first
- Prefer smooth, loopable animations for background footage

### Option C: Code snippets (inline)

No file needed — pass code directly:
```js
media: [{ type: 'code', lang: 'python', content: 'print("hello")' }]
```

---

## Step 4 — Render the Video

```bash
node scripts/render.js <projectId> --script <scriptName>
```

Optional flags:
```bash
--port 5175       # specify dev server port if 3000 is taken
--force-audio     # force regeneration of TTS audio even if files exist
```

Output: `public/video/render-<projectId>.mp4`

The renderer:
1. Launches Puppeteer pointing at `http://localhost:<port>?script=<scriptName>`
2. Captures frames for each clip with progress logging
3. Composites audio + video with FFmpeg
4. Writes the final MP4

### Rendering improvements

- **Accurate timing**: Clip durations calculated from all WordBoundary events to prevent premature video ending
- **Progress logging**: Shows per-clip progress and frame rendering status
- **Silent project support**: Skips audio generation for projects without speech
- **Forced audio regeneration**: Use `--force-audio` to regenerate TTS when speech content changes

---

## Full Example Workflow

User brief: *"Make a 1-minute video introducing TypeScript generics"*

```bash
# 1. Write script → public/script/ts-generics.json  (see format above)

# 2. Generate TTS
pnpm tsx scripts/generate-audio.ts ts-generics

# 3. Create any custom HTML footage → public/footage/generics-diagram.html

# 4. Start dev server (if not running)
pnpm dev &

# 5. Render
node scripts/render.js ts-generics-video --script ts-generics

# Output: public/video/render-ts-generics-video.mp4
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Chrome not found | Set `PUPPETEER_EXECUTABLE_PATH=/path/to/chrome` |
| FFmpeg not found | Install via `brew install ffmpeg` or `apt install ffmpeg` |
| Audio out of sync | Re-run `generate-audio.ts`; check `rate` field |
| HTML asset blank | Open the `.html` file in browser to debug; check console errors |
| Port conflict | Use `--port` flag with a free port |
| Script not loading | Ensure file is at `public/script/<name>.json` with proper JSON structure |
| Video ends prematurely | Use `--force-audio` to regenerate timing data |
| Wrong language spoken | Check voice field in clips; ensure `media.word` matches speech language |
| Media timing off | Verify `media.word` values match actual words in speech text |

---

## Recent Updates

### JS to JSON Migration
- Video scripts now use JSON format instead of JavaScript modules
- Scripts located at `public/script/<name>.json` with `{projects: {...}}` structure
- Frontend loads scripts via `fetch()` instead of dynamic imports
- Audio generation script reads JSON from filesystem

### Chinese Speech Support
- Added `zh-CN-XiaoxiaoNeural` voice for Mandarin narration
- Enhanced word boundary matching for Chinese text processing
- Improved timing synchronization with Chinese TTS tokens

### Rendering Enhancements
- **Progress logging**: Real-time feedback during frame rendering
- **Accurate timing**: Clip durations calculated from all WordBoundary events
- **Silent projects**: Automatic detection and skipping of audio generation
- **Force audio regeneration**: `--force-audio` flag for updating changed speech

### Word Trigger Optimization
- Enhanced `media.word` matching with normalization and fuzzy matching
- Support for Chinese characters and multi-word triggers
- Robust handling of TTS token variations

---

## AI Script-Writing Tips

When authoring scripts for a user:

1. **Gather the brief first**: topic, target length, audience, preferred theme, language/voice.
2. **Outline before scripting**: list clip titles and key points, confirm with user.
3. **Write speech naturally**: read it aloud mentally — does it flow? Avoid bullet-point prose.
4. **Interleave clip types**: don't use the same type back-to-back more than twice.
5. **Code clips**: show only the most relevant lines; add comments inside the code for clarity.
6. **End strong**: last clip should summarize or call-to-action with an upbeat `speech`.
7. **After scripting**: immediately proceed to generate audio and assets unless user says otherwise.