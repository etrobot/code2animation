<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AgentSaaS Video Editor

A powerful video editor with TTS (Text-to-Speech) and automated rendering capabilities.

View your app in AI Studio: https://ai.studio/apps/2c282826-7ff3-43c4-8c36-273d06d1c4ff

## Features

- Interactive video preview with playback controls
- TTS audio generation using Microsoft Edge TTS
- Automated video rendering with Puppeteer and FFmpeg
- Support for transitions, media clips, and timing
- Portrait and landscape orientations
- Frame-by-frame rendering at 30 FPS

## Quick Start

**Prerequisites:** Node.js 18+, FFmpeg

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Generate TTS audio:
   ```bash
   pnpm generate-audio video-1
   ```

3. Run the preview:
   ```bash
   pnpm dev
   ```

4. Render the final video:
   ```bash
   pnpm render video-1
   ```

## Commands

### Development
```bash
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm preview          # Preview production build
```

### Audio Generation
```bash
pnpm generate-audio <projectId>
```
Generates TTS audio files for all speech clips in a project.

### Video Rendering
```bash
pnpm render <projectId> [--portrait]
```
Renders the complete video with audio to MP4.

Examples:
```bash
pnpm render video-1              # Landscape (1920x1080)
pnpm render video-1 --portrait   # Portrait (1080x1920)
```

## Project Structure

```
├── public/
│   ├── projects/          # Video project definitions
│   │   └── video-1/
│   │       ├── video-1.json
│   │       └── footage/   # HTML media components
│   ├── audio/             # Generated TTS audio files
│   └── video/             # Rendered output videos
├── scripts/
│   ├── generate-audio.ts  # TTS generation script
│   └── render.js          # Video rendering script
└── src/
    ├── App.tsx            # Main application
    ├── components/        # React components
    └── hooks/             # Custom hooks (useTTS)
```

## Installing FFmpeg

### macOS
```bash
brew install ffmpeg
```

### Linux
```bash
sudo apt-get install ffmpeg
```

### Windows
Download from https://ffmpeg.org/download.html

## Troubleshooting

### Puppeteer browser issues
Set the browser path:
```bash
export PUPPETEER_EXECUTABLE_PATH=/path/to/chrome
```

Or install Chromium:
```bash
npx puppeteer browsers install chrome
```

### Audio not playing
Make sure to generate audio first:
```bash
pnpm generate-audio video-1
```

Then refresh the browser.

## Learn More

- [Scripts Documentation](./scripts/README.md)
- [Components Documentation](./src/components/README.md)
- [Hooks Documentation](./src/hooks/README.md)
