import puppeteer from 'puppeteer-core';
import { spawn, execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const args = process.argv.slice(2);
const projectId = args.find(arg => !arg.startsWith('--'));

function getArgValue(name) {
  const withEq = args.find(arg => arg.startsWith(`--${name}=`));
  if (withEq) return withEq.slice(`--${name}=`.length) || null;
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1) return args[idx + 1] || null;
  return null;
}

if (!projectId) {
  console.error('Please specify a project ID');
  process.exit(1);
}

const scriptName = getArgValue('script') || projectId;

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const FRAME_MS = 1000 / FPS;

const BASE_PORT = 5175;

const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'video');
const FRAMES_DIR = path.join(OUTPUT_DIR, `frames-${projectId}`);
const FINAL_VIDEO = path.join(OUTPUT_DIR, `render-${projectId}.mp4`);

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

if (fs.existsSync(FRAMES_DIR)) {
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
}
fs.mkdirSync(FRAMES_DIR, { recursive: true });

function detectBrowserExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const platform = os.platform();

  if (platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }

  const candidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'brave-browser', 'brave'];
  for (const name of candidates) {
    try {
      const result = execSync(`which ${name}`, { encoding: 'utf-8' }).trim();
      if (result) return result;
    } catch {
    }
  }
  return null;
}

function loadRenderTimings(audioDir) {
  if (!fs.existsSync(audioDir)) return [];
  const timingFiles = fs.readdirSync(audioDir).filter(f => f.endsWith('.json'));
  const indexed = timingFiles.map(file => ({
    file,
    index: Number.parseInt(path.basename(file, '.json'), 10)
  })).filter(item => Number.isFinite(item.index)).sort((a, b) => a.index - b.index);

  const timings = [];
  let currentStart = 0;
  for (const item of indexed) {
    try {
      const raw = fs.readFileSync(path.join(audioDir, item.file), 'utf-8');
      const data = JSON.parse(raw);
      const lastWord = Array.isArray(data) && data.length > 0 ? data[data.length - 1] : null;
      let duration = 4;
      if (lastWord && lastWord.Metadata) {
        const meta = lastWord.Metadata.find(m => m.Type === 'WordBoundary');
        if (meta) {
          duration = (meta.Data.Offset + meta.Data.Duration) / 10000000 + 0.5;
        }
      }
      timings.push({ start: currentStart, end: currentStart + duration, duration });
      currentStart += duration;
    } catch {
      const duration = 4;
      timings.push({ start: currentStart, end: currentStart + duration, duration });
      currentStart += duration;
    }
  }
  return timings;
}

async function findFreePort(startPort) {
  const { createServer } = await import('net');
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      findFreePort(startPort + 1).then(resolve).catch(reject);
    });
  });
}

async function waitForHttpOk(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start <= timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch {
    }
    await sleep(200);
  }
  throw new Error(`Server not reachable: ${url}`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForViteReady(server, port, timeoutMs = 20000) {
  let serverStarted = false;
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!serverStarted) reject(new Error('Server start timeout'));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      server.stdout?.removeAllListeners?.('data');
      server.stderr?.removeAllListeners?.('data');
      server.removeAllListeners?.('error');
      server.removeAllListeners?.('exit');
    };

    server.stdout.on('data', (data) => {
      const text = data.toString();
      process.stdout.write(text);
      if (text.includes('Local:') || text.includes('ready in')) {
        serverStarted = true;
        cleanup();
        resolve(null);
      }
    });

    server.stderr.on('data', (data) => {
      const msg = data.toString();
      process.stderr.write(msg);
      if (msg.includes('EADDRINUSE')) {
        cleanup();
        reject(new Error(`Port ${port} is already in use`));
      }
    });

    server.on('error', (err) => {
      cleanup();
      reject(err);
    });

    server.on('exit', (code) => {
      cleanup();
      reject(new Error(`Server exited early with code ${code ?? 'unknown'}`));
    });
  });
}

async function main() {
  const audioDir = path.resolve(process.cwd(), 'public', 'audio', projectId);
  if (!fs.existsSync(audioDir) || fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3')).length === 0) {
    console.log(`TTS Audio not found for ${projectId}. Generating...`);
    execSync(`npx tsx scripts/generate-audio.ts ${projectId}`, { stdio: 'inherit' });
  }

  const renderTimings = loadRenderTimings(audioDir);
  const portOverride = getArgValue('port');
  const portStart = portOverride ? Number.parseInt(portOverride, 10) : BASE_PORT;
  const startPort = Number.isFinite(portStart) ? portStart : BASE_PORT;
  let server = null;
  let browser = null;
  let baseUrl = null;

  try {
    let attemptStart = startPort;
    for (let attempt = 0; attempt < 5; attempt++) {
      const port = await findFreePort(attemptStart);
      baseUrl = `http://127.0.0.1:${port}/?record=true&project=${encodeURIComponent(projectId)}&script=${encodeURIComponent(scriptName)}`;

      console.log(`Starting Vite server on port ${port}...`);
      server = spawn('pnpm', ['exec', 'vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      });

      try {
        await waitForViteReady(server, port);
        await waitForHttpOk(baseUrl);
        break;
      } catch (e) {
        server.kill('SIGINT');
        server = null;
        attemptStart = port + 1;
        if (attempt === 4) throw e;
      }
    }

    console.log('Launching browser for frame-by-frame rendering...');
    const executablePath = detectBrowserExecutable();
    if (!executablePath) {
      throw new Error('System Chrome/Chromium not found. Set PUPPETEER_EXECUTABLE_PATH to your Chrome executable.');
    }
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath,
      args: [
        `--window-size=${WIDTH},${HEIGHT}`,
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-dev-shm-usage'
      ],
      defaultViewport: null
    });

    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.goto(baseUrl, { waitUntil: 'networkidle0' });
    await sleep(1000);

    await page.evaluate(() => {
      window.suppressTTS = true;
    });

    let frameIndex = 0;
    const digits = 6;

    if (renderTimings.length === 0) {
      const duration = 10;
      const totalFrames = Math.round(duration * FPS);
      for (let i = 0; i < totalFrames; i++) {
        const t = i / FPS;
        await page.evaluate((time) => {
          if (window.seekTo) window.seekTo(time);
        }, t);
        await sleep(FRAME_MS);
        const filePath = path.join(FRAMES_DIR, `frame-${String(frameIndex).padStart(digits, '0')}.png`);
        await page.screenshot({ path: filePath, type: 'png' });
        frameIndex += 1;
      }
    } else {
      for (let clipIndex = 0; clipIndex < renderTimings.length; clipIndex++) {
        const timing = renderTimings[clipIndex];
        const clipFrames = Math.max(1, Math.round(timing.duration * FPS));

        await page.evaluate((index) => {
          if (window.setClipIndex) window.setClipIndex(index);
        }, clipIndex);
        await sleep(300);

        for (let i = 0; i < clipFrames; i++) {
          const t = i / FPS;
          await page.evaluate((time) => {
            if (window.seekTo) window.seekTo(time);
          }, t);
          await sleep(FRAME_MS);
          const filePath = path.join(FRAMES_DIR, `frame-${String(frameIndex).padStart(digits, '0')}.png`);
          await page.screenshot({ path: filePath, type: 'png' });
          frameIndex += 1;
        }
      }
    }

    console.log('Frames rendered. Combining with ffmpeg...');

    const audioFiles = fs.existsSync(audioDir)
      ? fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3')).sort((a, b) => {
        const ia = Number.parseInt(path.basename(a, '.mp3'), 10);
        const ib = Number.parseInt(path.basename(b, '.mp3'), 10);
        if (Number.isNaN(ia) || Number.isNaN(ib)) return a.localeCompare(b);
        return ia - ib;
      })
      : [];

    let combinedAudio = null;

    if (audioFiles.length > 0) {
      const concatListPath = path.join(OUTPUT_DIR, `audio-${projectId}-concat.txt`);
      const tempAudioPath = path.join(OUTPUT_DIR, `audio-${projectId}.mp3`);

      const listContent = audioFiles
        .map(f => `file '${path.join(audioDir, f).replace(/'/g, "'\\''")}'`)
        .join('\n');
      fs.writeFileSync(concatListPath, listContent);

      const concatResult = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', tempAudioPath], {
        stdio: 'inherit'
      });

      if (concatResult.status === 0) {
        combinedAudio = tempAudioPath;
      } else {
        console.warn('Audio concatenation failed, continuing without audio');
      }
    }

    const framePattern = path.join(FRAMES_DIR, 'frame-%06d.png');
    const ffmpegArgs = ['-y', '-framerate', String(FPS), '-i', framePattern];

    if (combinedAudio) {
      ffmpegArgs.push('-i', combinedAudio, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest');
    } else {
      ffmpegArgs.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p');
    }

    ffmpegArgs.push(FINAL_VIDEO);

    const ffmpegResult = spawnSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' });
    if (ffmpegResult.status !== 0) {
      console.error('ffmpeg failed with exit code', ffmpegResult.status);
      process.exitCode = ffmpegResult.status || 1;
    } else {
      console.log(`Render complete: ${FINAL_VIDEO}`);
      
      // Clean up temporary files
      console.log('Cleaning up temporary files...');
      
      // Remove frames directory
      if (fs.existsSync(FRAMES_DIR)) {
        fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
        console.log(`Removed frames directory: ${FRAMES_DIR}`);
      }
      
      // Remove temporary audio files
      const concatListPath = path.join(OUTPUT_DIR, `audio-${projectId}-concat.txt`);
      const tempAudioPath = path.join(OUTPUT_DIR, `audio-${projectId}.mp3`);
      
      if (fs.existsSync(concatListPath)) {
        fs.unlinkSync(concatListPath);
        console.log(`Removed audio concat list: ${concatListPath}`);
      }
      
      if (fs.existsSync(tempAudioPath)) {
        fs.unlinkSync(tempAudioPath);
        console.log(`Removed temporary audio: ${tempAudioPath}`);
      }
      
      console.log('Cleanup complete.');
    }
  } finally {
    await browser?.close?.().catch(() => {});
    server?.kill?.('SIGINT');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
