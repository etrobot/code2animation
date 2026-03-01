---
name: code2animation
description: End-to-end video production skill using the code2animation framework (https://github.com/etrobot/code2animation). Use this skill whenever the user wants to produce a code animation video, tech explainer video, or any animated video using code2animation — including writing the script, generating TTS audio, creating HTML/React visual assets, and rendering the final MP4. Trigger on any of: "make a video", "create an animation", "generate a code animation", "produce a tech video", "write a code2animation script", "render a video with code2animation", or any request that involves scripting + TTS + rendering in this stack. Always use this skill for the full pipeline, not just individual steps.
---

# Code2Animation Skill

## Prerequisites

- Node.js >= 18
- pnpm >= 10.14.0 (`npm install -g pnpm`)
- FFmpeg (`brew install ffmpeg`)
- Chrome/Chromium/Brave
- Complete `pnpm install`
- Start dev server: `pnpm dev`

## Core Workflow

1. **Write Script** → `public/script/<name>.json`
2. **Generate Audio** → `pnpm tsx scripts/generate-audio.ts <name>`
3. **Prepare Assets** → `public/footage/*.html` or media files
4. **Render Video** → `node scripts/render.js <projectId> --script <name> --portrait`

## Four Component Types

| Type | Purpose |
|------|---------|
| `tweet` | Twitter-style display for social content and opinions |
| `docSpot` | Document display with keyword highlighting and scroll positioning |
| `footagesFullScreen` | Fullscreen media playback with speech keywords |
| `footagesAroundTitle` | Centered title with media clips appearing around it |

## Custom Assets

### HTML Animation Assets
Create custom HTML files in `public/footage/`:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; background: #0f0f1a; 
           width: 1920px; height: 1080px; }
    /* Animation styles */
  </style>
</head>
<body>
  <!-- Animation content -->
  <script>
    // Animation logic
  </script>
</body>
</html>
```

### Script Format
Reference `public/script/openclaw-v2026-2-26.json`

### Common Commands
```bash
# Render video (portrait recommended)
pnpm run render:video-1 --portrait

# Generate audio
pnpm tsx scripts/generate-audio.ts <scriptName>

# Debug mode
LOG_LEVEL=debug pnpm run render:video-1
```