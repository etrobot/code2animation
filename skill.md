# Code2Animation Video Editor Skill

A comprehensive video editing and rendering skill that enables AI agents to create code-driven animations with text-to-speech narration and smooth transitions.

## Purpose

This skill allows agents to:
- Create and preview interactive video projects with animations
- Generate TTS audio narration using Microsoft Edge TTS
- Render complete videos with synchronized audio and visual effects
- Support both portrait and landscape video formats
- Apply smooth transition effects between media elements

## Core Capabilities

### 1. Interactive Video Preview
- Real-time preview of video projects in the browser
- Playback controls for testing and debugging
- Support for transitions, media clips, and timing adjustments
- Frame-by-frame seeking for precise editing
- Live transition preview with easing effects

### 2. Transition System
- **transitionIn**: Each media defines its own entrance animation
- **Supported transitions**: fade, zoom, slide2Left, slideUp, none
- **Easing**: Built-in easeOutCubic for smooth slide and zoom animations
- **stayInClip**: Media can persist throughout entire clip duration
- **Cross-clip transitions**: Automatic handling of clip boundaries

### 3. TTS Audio Generation
- Automated text-to-speech using Microsoft Edge TTS (msedge-tts)
- Support for multiple voices (English and Chinese)
- Word-level timing metadata for lip-sync and animations
- Audio file caching for faster previews

### 4. Video Rendering
- Automated frame-by-frame rendering using Puppeteer
- FFmpeg integration for video encoding and audio mixing
- 30 FPS output at 1920x1080 (landscape) or 1080x1920 (portrait)
- Deterministic rendering for consistent results
- Transition effects preserved in final output

## Project Configuration Format

### Media Item Properties
- **src**: HTML filename in the footage directory
- **words**: Trigger phrase from speech that activates this media
- **transitionIn**: Entrance animation type (optional)
- **transitionDuration**: Duration in seconds (optional, default: 0.6s)
- **stayInClip**: If true, media remains visible until clip ends (optional)

### Transition Types
- **fade**: Opacity transition (0 → 1)
- **zoom**: Scale transition (2x → 1x) with opacity
- **slide2Left**: Horizontal slide from right (100% → 0%)
- **slideUp**: Vertical slide from bottom (100% → 0%)
- **none**: No transition effect

### Transition Behavior
- **transitionIn**: Defines how this media enters the scene
- **transitionDuration**: Duration in seconds (default: 0.6s)
- **stayInClip**: If true, media remains visible until clip ends
- **Easing**: slide2Left and slideUp use easeOutCubic for smooth deceleration

### Reference Implementation
See `public/projects/openclaw_projects.json` for a complete working example demonstrating multi-media clips, stayInClip layering, and all transition types.

---

## Video Creation Best Practices

These are hard-won lessons from real production experience. Follow them strictly.

### 1. Split Media into Granular HTML Files

**DO NOT** put all content for a clip into a single HTML file. This creates a "slideshow" look.

**Instead**, break each clip into 2–3 separate HTML media files, each covering a different region of the screen:

```json
{
  "type": "footage",
  "speech": "...",
  "media": [
    { "src": "project1_title.html",    "words": "第一",       "transitionIn": "slide2Left", "stayInClip": true },
    { "src": "project1_workflow.html", "words": "一个YouTuber", "transitionIn": "zoom",      "stayInClip": true },
    { "src": "project1_stats.html",    "words": "结果5天",     "transitionIn": "slideUp" }
  ]
}
```

Each HTML file uses **absolute positioning** to place itself in a specific area within the canvas:

```html
<style>
  :root { --t: 0; }
  body { margin: 0; width: 1080px; height: 1920px; /* portrait */ }
  .header-container {
    position: absolute;
    top: 200px;  /* Title at the top area */
    width: 100%;
  }
</style>
```

Use `stayInClip: true` on earlier media so content accumulates as new media slides in on top.

### 2. Never Duplicate Entrance Animations

**The transition system (`transitionIn`) handles entrance effects.** Do NOT add fade-in, slide-in, or scale-up animations inside HTML files — they will conflict with `transitionIn` and look chaotic.

🚫 **Wrong** — HTML has its own fade-in that conflicts with `transitionIn: "zoom"`:
```css
.card {
  --p: clamp(0, calc((var(--t) - 0.1) / 0.8), 1);
  opacity: var(--p);
  transform: scale(calc(0.9 + 0.1 * var(--p)));
}
```

✅ **Correct** — HTML is fully visible, `transitionIn` handles the entrance:
```css
.card {
  opacity: 1;
  /* No entrance animation here — transitionIn handles it */
}
```

Only use CSS `--t` animations for **content-internal** effects (e.g., a counter ticking up, text highlighting), not for entrance/exit.

### 3. Use Inline SVG Icons, Not Emojis

Emojis look unprofessional in rendered video. Use inline SVG icons instead:

🚫 **Wrong**:
```html
<span class="icon">🤖</span> 自动选题
```

✅ **Correct**:
```html
<span class="icon">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round" style="width: 1em; height: 1em;">
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
    <rect x="9" y="9" width="6" height="6"></rect>
    <!-- ... more path data -->
  </svg>
</span> 自动选题
```

Use Lucide/Feather-style SVGs for a clean, modern look.

### 4. Do Not Use External Product Images

Never hotlink images from third-party SaaS products (n8n, Stackby, etc.) as background or illustration unless the video is specifically about that product. It looks like free advertising for unrelated brands.

If an image is needed, either:
- use unsplash images
- Use abstract/decorative elements in CSS (gradients, borders, shapes)
- Use text-based layouts (cards, grids, tables) which render crisply

### 5. Video Backgrounds: Let Them Play Naturally

For decorative background videos (e.g., ambient loops), **never try to sync `video.currentTime` with the timeline**. Setting `currentTime` every frame triggers expensive async seeking that causes choppy playback in both preview and render modes.

✅ **Correct** — just let it autoplay (ensure source is 30fps):
```html
<video autoplay loop muted playsinline preload="auto" src="/video/bg.mp4"></video>
```

⚠️ **Important**: Background video source should be converted to **30fps** to avoid frame skipping, but this alone DOES NOT fix the rendering speed issue:
```bash
ffmpeg -i input.mp4 -r 30 -c:v libx264 -crf 18 output_30fps.mp4
```

**The 4x Speed Drift Problem & Solution:**
During Puppeteer rendering, the browser takes roughly ~4x longer to process each frame than real-time (due to screenshots and I/O). However, background videos with `autoplay` continue playing in real-time "wall-clock" speed in the background. As a result, when you render 30 frames (1 second of timeline), the video has actually played for ~4 seconds in real-time. This creates a 4x fast-forward effect in the final rendered video.

To perfectly compensate for this, you MUST inject a script that detects render mode and slows down the video `playbackRate` to ~`0.25`:

```html
<script>
    try {
        // IFRAME context: Must use window.parent to correctly detect ?record=true
        if (new URLSearchParams(window.parent.location.search).get('record') === 'true') {
            document.querySelector('video').playbackRate = 0.25;
        }
    } catch (e) {}
</script>
```

🚫 **Wrong** — controlling currentTime causes stuttering:
```js
window.onTimelineUpdate = (t) => {
  vid.currentTime = t % vid.duration; // DON'T DO THIS
};
```

### 6. Seamless Video Loops with Ping-Pong

Short video clips often have a visible "jump" when they loop. Fix this by creating a **ping-pong version** (forward + reverse):

```bash
# Step 1: Reverse the video
ffmpeg -y -i input.mp4 -vf "reverse" -af "areverse" /tmp/reversed.mp4

# Step 2: Concat forward + reverse
ffmpeg -y -f concat -safe 0 \
  -i <(echo "file '$(pwd)/input.mp4'" && echo "file '/tmp/reversed.mp4'") \
  -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -r 30 -an output_pingpong.mp4
```

Then use the 30fps ping-pong file as the loop source. The last frame of the forward pass is identical to the first frame of the reverse pass, so the loop is perfectly seamless.

### 7. Background HTML Structure

The `background` property in the project JSON points to an HTML file that renders behind all media. For video backgrounds:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <style>
        :root { --t: 0; }
        body { margin: 0; width: 1080px; height: 1920px; background-color: black; }
        video {
            position: absolute; top: 0; left: 0;
            width: 100%; height: 100%;
            object-fit: cover; z-index: 1;
            opacity: 0.5; /* dim so foreground text stands out */
        }
    </style>
</head>
<body>
    <video autoplay loop muted playsinline preload="auto" src="/video/myBackground.mp4"></video>
    <script>
        try {
            if (new URLSearchParams(window.parent.location.search).get('record') === 'true') {
                document.querySelector('video').playbackRate = 0.25;
            }
        } catch (e) {}
    </script>
</body>
</html>
```

### 8. HTML Media File Template

Every media HTML file should follow this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        :root { --t: 0; }
        body {
            margin: 0;
            width: 1080px;  /* portrait */
            height: 1920px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white;
            overflow: hidden;
            position: relative;
        }
        .content {
            position: absolute;
            top: 200px;     /* position within the canvas */
            left: 50%;
            transform: translateX(-50%);
            width: 85%;
            /* styling... */
        }
    </style>
</head>
<body>
    <div class="content">
        <!-- Content here -->
    </div>
</body>
</html>
```

Key rules:
- **Always set** `body` to match canvas dimensions (1080×1920 portrait or 1920×1080 landscape)
- **Use `position: absolute`** to place content in a specific screen region
- **No entrance animations** — let `transitionIn` handle that
- **No background colors on body** — the global background HTML handles that

---

## Technical Requirements

### System Dependencies
- **Node.js**: 18 or higher
- **FFmpeg**: Required for video encoding and audio mixing
- **Chromium/Chrome**: Used by Puppeteer for headless rendering

### Node.js Dependencies
- **React & Vite**: Frontend framework and build tool
- **Puppeteer**: Headless browser for frame capture
- **msedge-tts**: Microsoft Edge TTS for audio generation
- **Express**: Optional HTTP server (for TTS API endpoint)
- **Motion (Framer Motion)**: Animation library
- **Tailwind CSS**: Styling framework

## Shell Commands Used

This skill executes the following shell commands:

### Audio Generation
```bash
npx tsx scripts/generate-audio.ts <projectId>
```
- Reads project JSON configuration
- Generates MP3 audio files using Edge TTS
- Saves word-level timing metadata

### Video Rendering
```bash
pnpm render <projectId> [--portrait]
```
- Starts a local Vite dev server
- Launches Puppeteer to capture frames
- Uses FFmpeg to encode video and mix audio
- Cleans up temporary files

### FFmpeg Operations
- Frame encoding: `ffmpeg -framerate 30 -i frames/frame-%05d.jpg -c:v libx264 ...`
- Audio mixing: `ffmpeg -i video.mp4 -i audio1.mp3 -i audio2.mp3 -filter_complex ...`
- Video ping-pong: `ffmpeg -vf "reverse"` + concat

### Browser Detection
- Uses `which` command to find Chrome/Chromium on Linux/macOS
- Respects `PUPPETEER_EXECUTABLE_PATH` environment variable

## API Endpoints (Optional)

The skill may expose an HTTP endpoint for TTS generation:

```
POST /api/tts
Content-Type: application/json

{
  "text": "Text to speak",
  "voice": "en-US-GuyNeural",
  "rate": "+0%",
  "pitch": "+0Hz"
}
```

This endpoint is optional and only used when pre-generated audio files are not available.

## Security Considerations

### File System Access
- Reads from: `public/projects/<projectId>/`
- Writes to: `public/projects/<projectId>/audio/`, `public/video/`
- Creates temporary directories for frame storage
- Cleans up temporary files after rendering

### Network Access
- Starts local HTTP server on port 5175+ (configurable)
- Connects to Microsoft Edge TTS service (external)
- No external API keys required for basic functionality

### Process Execution
- Spawns child processes for: Vite dev server, FFmpeg encoding
- Uses `execSync` for: browser detection, audio generation trigger
- All commands are predefined and not user-controllable

## Environment Variables

Optional configuration:
- `PUPPETEER_EXECUTABLE_PATH`: Custom browser path for Puppeteer
- `FASTMCP_LOG_LEVEL`: Logging level (default: ERROR)

## Project Structure

```
public/
  projects/
    <projectId>/
      <projectId>.json       # Project configuration
      footage/               # HTML/CSS media components
      audio/                 # Generated TTS audio files
        0.mp3, 1.mp3, ...
        0.json, 1.json, ...  # Word timing metadata
  video/
    render-<projectId>-landscape.mp4
    render-<projectId>-portrait.mp4
```

## Usage Example

```bash
# 1. Generate audio for a project
pnpm generate-audio openclaw_projects

# 2. Preview in browser
pnpm dev

# 3. Render final video
pnpm render openclaw_projects

# 4. Render portrait version
pnpm render openclaw_projects --portrait
```

## HTML Animation Guidelines

When creating HTML animations for video rendering, use the **CSS variable timeline** model.

### Core Model
- Renderer controls time: Puppeteer sets `--t` every frame.
- Page only renders state: `DOM = f(t)`.
- No lifecycle animation APIs (`play/start/reset`) and no hidden runtime state.
- **Transition system handles entrance effects**: Don't implement slide/fade transitions in HTML - use the project's `transitionIn` property instead.

### ✅ Required Patterns
- Define timeline root:
  ```css
  :root { --t: 0; }
  ```
- Every animated property must derive from `--t`.
- Always clamp normalized progress values:
  ```css
  --p: clamp(0, calc((var(--t) - var(--start)) / var(--duration)), 1);
  ```
- Express initial/ending states directly in CSS (seek-safe at any frame).
- Use small deterministic JS only for content mapping (e.g., subtitle/text index from `t`).
- **Let transition system handle entrance**: Focus on content animation, not entrance effects.

### 🚫 Forbidden Patterns
- `transition`
- `animation` / `@keyframes`
- `window.registerFrameAnimation(...)`
- `requestAnimationFrame` loops for timeline progression
- Implicit time from `Date.now()` / `performance.now()` for visual state
- **Manual entrance transitions**: Don't implement slide/fade in HTML - use `transitionIn` in project config
- **Fade-out effects**: Elements should not disappear after animation completes. Use `opacity: var(--p)` instead of `opacity: calc(var(--p) * (1 - var(--fade)))` to keep elements visible at their final state.
- **Emoji icons**: Use inline SVG icons instead
- **External product images**: Don't hotlink images from unrelated SaaS products
- **Video `currentTime` manipulation**: Never set `video.currentTime` in `onTimelineUpdate` — causes choppy playback

### Easing (without transition)
Use math on progress directly:
```css
--p: clamp(0, calc((var(--t) - var(--start)) / var(--duration)), 1);
--ease-out: calc(1 - (1 - var(--p)) * (1 - var(--p)));
opacity: var(--ease-out);
```

### JS Hook Pattern (text/content only)
```html
<script>
  const labels = ['A', 'B', 'C'];
  const el = document.getElementById('label');

  window.onTimelineUpdate = (t) => {
    const idx = Math.floor(Math.max(0, t) / 1.2) % labels.length;
    el.textContent = labels[idx];
  };
</script>
```

### Time Semantics (`t` vs `globalTime`)
- `onTimelineUpdate(t, globalTime)` supports two time domains:
  - `t`: clip-local time (resets to `0` when clip changes). This is the default for most HTML animations.
  - `globalTime`: continuous timeline across clips. Use only when an element must stay continuous through cross-clip transitions.
- Do **not** assume `t` is media-local. If a media appears mid-clip, `t` may already be large when it first becomes visible.
- For media-local behavior (e.g., toggle starts animating when this media appears), anchor from first visible `globalTime` and derive:
  - `local = globalTime - mediaStartGlobalTime`
- Keep fallback for compatibility:
  ```js
  window.onTimelineUpdate = (t, globalTime) => {
    const g = Number.isFinite(globalTime) ? globalTime : t;
    // use `t` for normal clip-local animation, `g` only when continuity is required
  };
  ```

### Determinism Checklist
- Seeking to any `t` yields exactly one deterministic frame.
- Animation state must not depend on "previous frame".
- Cross-clip transition visuals should be continuous in both clips.
- Final frame (`t = totalDuration`) must remain on the last clip (no wrap to first clip).
- Background videos are an exception — they play naturally and are NOT deterministic (this is acceptable for decorative backgrounds).

## Limitations

- Requires FFmpeg to be installed on the system
- TTS generation requires internet connection (Microsoft Edge TTS)
- Rendering is CPU-intensive and may take several minutes
- Maximum TTS text length: ~1000 characters per clip
- Frame capture requires sufficient disk space
- Background videos in render mode may not be perfectly time-synced (acceptable for decorative use)

## Transparency Statement

This skill executes shell commands and spawns child processes for video rendering. All operations are limited to:
1. Starting a local development server (Vite)
2. Running FFmpeg for video encoding
3. Launching Puppeteer for frame capture
4. Detecting browser executables on the system

No arbitrary code execution or user input is passed to shell commands. All file paths and commands are predefined and validated.
