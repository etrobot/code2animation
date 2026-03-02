# AgentSaaS Video Editor Skill

A comprehensive video editing and rendering skill that enables AI agents to create code-driven animations with text-to-speech narration.

## Purpose

This skill allows agents to:
- Create and preview interactive video projects with animations
- Generate TTS audio narration using Microsoft Edge TTS
- Render complete videos with synchronized audio and visual effects
- Support both portrait and landscape video formats

## Core Capabilities

### 1. Interactive Video Preview
- Real-time preview of video projects in the browser
- Playback controls for testing and debugging
- Support for transitions, media clips, and timing adjustments
- Frame-by-frame seeking for precise editing

### 2. TTS Audio Generation
- Automated text-to-speech using Microsoft Edge TTS (msedge-tts)
- Support for multiple voices (English and Chinese)
- Word-level timing metadata for lip-sync and animations
- Audio file caching for faster previews

### 3. Video Rendering
- Automated frame-by-frame rendering using Puppeteer
- FFmpeg integration for video encoding and audio mixing
- 30 FPS output at 1920x1080 (landscape) or 1080x1920 (portrait)
- Deterministic rendering for consistent results

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
node scripts/render.js <projectId> [--portrait]
```
- Starts a local Vite dev server
- Launches Puppeteer to capture frames
- Uses FFmpeg to encode video and mix audio
- Cleans up temporary files

### FFmpeg Operations
- Frame encoding: `ffmpeg -framerate 30 -i frames/frame-%05d.jpg -c:v libx264 ...`
- Audio mixing: `ffmpeg -i video.mp4 -i audio1.mp3 -i audio2.mp3 -filter_complex ...`

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
pnpm generate-audio video-1

# 2. Preview in browser
pnpm dev

# 3. Render final video
pnpm render video-1

# 4. Render portrait version
pnpm render video-1 --portrait
```

## Limitations

- Requires FFmpeg to be installed on the system
- TTS generation requires internet connection (Microsoft Edge TTS)
- Rendering is CPU-intensive and may take several minutes
- Maximum TTS text length: ~1000 characters per clip
- Frame capture requires sufficient disk space

## Transparency Statement

This skill executes shell commands and spawns child processes for video rendering. All operations are limited to:
1. Starting a local development server (Vite)
2. Running FFmpeg for video encoding
3. Launching Puppeteer for frame capture
4. Detecting browser executables on the system

No arbitrary code execution or user input is passed to shell commands. All file paths and commands are predefined and validated.
