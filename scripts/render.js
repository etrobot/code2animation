import puppeteer from 'puppeteer';
import { spawn, execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const args = process.argv.slice(2);
const isPortrait = args.includes('--portrait') || args.includes('portrait');
const skipCompress = args.includes('--no-compress') || args.includes('--skip-compress');
const projectId = args.find(arg => !arg.startsWith('--') && arg !== 'portrait');

if (!projectId) {
  console.error('Usage: npm run render <projectId> [--portrait] [--no-compress]');
  console.error('Example: npm run render video-1');
  console.error('Options:');
  console.error('  --portrait        Render in portrait mode (1080x1920)');
  console.error('  --no-compress     Skip video compression after rendering');
  process.exit(1);
}

const WIDTH = isPortrait ? 1080 : 1920;
const HEIGHT = isPortrait ? 1920 : 1080;
const FPS = 30;
const FRAME_MS = 1000 / FPS;
const BASE_PORT = 5175;

const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'video');
const FRAMES_DIR = path.join(OUTPUT_DIR, `frames-${projectId}-${isPortrait ? 'portrait' : 'landscape'}`);
const FINAL_VIDEO = path.join(OUTPUT_DIR, `render-${projectId}-${isPortrait ? 'portrait' : 'landscape'}.mp4`);

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

if (fs.existsSync(FRAMES_DIR)) {
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
}
fs.mkdirSync(FRAMES_DIR, { recursive: true });

function detectBrowserExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  
  const arch = os.arch();
  if (arch === 'x64') return undefined;
  
  const candidates = [
    'brave-browser',
    'chromium-browser', 
    'chromium',
    'google-chrome',
    'google-chrome-stable'
  ];
  
  for (const name of candidates) {
    try {
      const result = execSync(`which ${name}`, { encoding: 'utf-8' }).trim();
      if (result) return result;
    } catch { }
  }
  
  return undefined;
}

function loadRenderTimings(audioDir) {
  if (!fs.existsSync(audioDir)) return [];
  
  const timingFiles = fs.readdirSync(audioDir).filter(f => f.endsWith('_info.json'));
  const indexed = timingFiles
    .map(file => ({
      file,
      index: Number.parseInt(path.basename(file, '_info.json'), 10)
    }))
    .filter(item => Number.isFinite(item.index))
    .sort((a, b) => a.index - b.index);
  
  const timings = [];
  let currentStart = 0;
  
  for (const item of indexed) {
    try {
      const audioPath = path.join(audioDir, `${item.index}.mp3`);
      let duration = 4; // default
      
      if (fs.existsSync(audioPath)) {
        try {
          // Use ffprobe to get actual audio duration
          const result = execSync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
            { encoding: 'utf-8' }
          ).trim();
          
          const parsedDuration = parseFloat(result);
          if (!isNaN(parsedDuration) && parsedDuration > 0) {
            duration = parsedDuration + 0.3; // Add small buffer
          }
        } catch (err) {
          console.warn(`Failed to get duration for ${audioPath}, using default`);
        }
      }
      
      timings.push({ 
        start: currentStart, 
        end: currentStart + duration, 
        duration,
        audioFile: `${item.index}.mp3`
      });
      
      console.log(`Audio ${item.index}: ${duration.toFixed(2)}s (cumulative: ${currentStart.toFixed(2)}s)`);
      currentStart += duration;
    } catch (err) {
      console.warn(`Failed to load timing for ${item.file}:`, err);
      const duration = 4;
      timings.push({ 
        start: currentStart, 
        end: currentStart + duration, 
        duration,
        audioFile: `${item.index}.mp3`
      });
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

async function main() {
  // Load project config to check expected audio count
  const projectConfigPath = path.resolve(process.cwd(), 'public', 'projects', projectId, `${projectId}.json`);
  
  if (!fs.existsSync(projectConfigPath)) {
    console.error(`❌ Project config not found: ${projectConfigPath}`);
    process.exit(1);
  }
  
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf-8'));
  const expectedAudioCount = projectConfig.clips.filter(c => c.type !== 'transition' && c.speech).length;
  
  // Check if audio exists
  const audioDir = path.resolve(process.cwd(), 'public', 'projects', projectId, 'audio');
  const existingAudioFiles = fs.existsSync(audioDir) 
    ? fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3'))
    : [];
  
  const needsGeneration = existingAudioFiles.length < expectedAudioCount;
  
  if (needsGeneration) {
    console.log(`\n⚠️  Audio files incomplete for project "${projectId}"`);
    console.log(`   Expected: ${expectedAudioCount} files, Found: ${existingAudioFiles.length} files`);
    console.log(`📢 Generating audio using TTS...\n`);
    
    try {
      execSync(`npm run generate-audio ${projectId}`, { stdio: 'inherit' });
      console.log(`\n✅ Audio generation completed!\n`);
    } catch (error) {
      console.error(`\n❌ Failed to generate audio:`, error.message);
      console.error(`\nPlease run manually: npm run generate-audio ${projectId}`);
      process.exit(1);
    }
  } else {
    console.log(`✅ Audio files complete for project "${projectId}" (${existingAudioFiles.length}/${expectedAudioCount})`);
  }
  
  const renderTimings = loadRenderTimings(audioDir);
  console.log(`Loaded ${renderTimings.length} audio clips for rendering`);
  
  const PORT = await findFreePort(BASE_PORT);
  const BASE_URL = `http://localhost:${PORT}/?record=true&orientation=${isPortrait ? 'portrait' : 'landscape'}&project=${projectId}`;
  
  console.log(`Starting Vite server on port ${PORT}...`);
  const server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });
  
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 20000);
    
    server.stdout.on('data', (data) => {
      if (data.toString().includes('Local:') || data.toString().includes('ready in')) {
        clearTimeout(timeout);
        resolve(null);
      }
    });
    
    server.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('EADDRINUSE')) {
        clearTimeout(timeout);
        reject(new Error(`Port ${PORT} is already in use`));
      }
    });
  });
  
  console.log('Launching browser for frame-by-frame rendering...');
  const executablePath = detectBrowserExecutable();
  const browser = await puppeteer.launch({
    headless: "new",
    ...(executablePath ? { executablePath } : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--window-size=${WIDTH},${HEIGHT}`,
      '--ignore-gpu-blocklist',
      '--enable-gpu',
      '--enable-accelerated-2d-canvas',
      '--use-gl=egl',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--mute-audio',
    ],
    defaultViewport: null
  });
  
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  
  await page.evaluateOnNewDocument((timings) => {
    window.__renderTimings = timings;
    window.__skipAudioPreload = true;
  }, renderTimings);
  
  console.log(`Navigating to ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  
  console.log('Waiting for app to be ready...');
  await Promise.race([
    page.waitForFunction(() => typeof window.seekTo === 'function', { timeout: 30000 }),
    page.waitForSelector('.ready-to-record', { timeout: 30000 })
  ]);
  
  // Prepare app for deterministic rendering
  await page.evaluate(() => {
    window.suppressTTS = true;
  });
  
  const totalDuration = await page.evaluate(() => {
    return window.getTotalDuration();
  });
  
  if (totalDuration === 0) {
    console.error('Project has 0 duration. Check your project config.');
    await browser.close();
    server.kill();
    process.exit(1);
  }
  
  console.log(`Total duration: ${totalDuration.toFixed(2)}s. Starting frame capture...`);
  const totalFrames = Math.ceil(totalDuration * FPS);
  
  for (let i = 0; i <= totalFrames; i++) {
    const time = i / FPS;
    
    await page.evaluate((t) => {
      if (typeof window.seekTo === 'function') {
        window.seekTo(t);
      } else {
        throw new Error('window.seekTo is not available - page may have reloaded');
      }
    }, time);
    
    // Wait longer for iframes to load and animate
    await new Promise(r => setTimeout(r, 100));
    
    if (i % 10 === 0) {
      process.stdout.write(`\rRendering frame ${i}/${totalFrames} (${((i / totalFrames) * 100).toFixed(1)}%)`);
    }
    
    const framePath = path.join(FRAMES_DIR, `frame-${String(i).padStart(5, '0')}.jpg`);
    await page.screenshot({ 
      path: framePath, 
      type: 'jpeg', 
      quality: 95,
      optimizeForSpeed: true 
    });
  }
  
  process.stdout.write('\n');
  console.log('Capture complete. Closing browser...');
  
  const audioLog = await page.evaluate(() => {
    return window.getAudioLog ? window.getAudioLog() : [];
  });
  
  await browser.close();
  server.kill();
  
  if (audioLog.length === 0) {
    console.warn('No audio log found. Rendering video without audio...');
  }
  
  console.log('Assembling video with ffmpeg...');
  await assembleVideo(audioLog);
  
  console.log('\n🎬 Render pipeline completed!');
}

async function assembleVideo(audioLog) {
  const tempVideo = path.join(OUTPUT_DIR, `temp_video_${projectId}.mp4`);
  
  console.log('Step 1: Encoding frames...');
  spawnSync('ffmpeg', [
    '-y',
    '-framerate', String(FPS),
    '-i', path.join(FRAMES_DIR, 'frame-%05d.jpg'),
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    tempVideo
  ], { stdio: 'inherit' });
  
  if (audioLog.length === 0) {
    console.warn('No audio found, saving video only.');
    fs.renameSync(tempVideo, FINAL_VIDEO);
    fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
    console.log(`\nSuccess! Rendered video saved to: ${FINAL_VIDEO}`);
    return;
  }
  
  console.log('Step 2: Mixing audio...');
  const inputs = ['-i', tempVideo];
  const filterComplex = [];
  const audioMap = [];
  let validAudioCount = 0;
  
  for (let i = 0; i < audioLog.length; i++) {
    const log = audioLog[i];
    const audioPath = path.join(process.cwd(), 'public', 'projects', log.file);
    
    if (fs.existsSync(audioPath)) {
      inputs.push('-i', audioPath);
      validAudioCount++;
      const delay = Math.max(0, Math.round(log.startTime * 1000)); // Convert to milliseconds
      filterComplex.push(`[${validAudioCount}:a]adelay=${delay}|${delay}[a${validAudioCount}]`);
      audioMap.push(`[a${validAudioCount}]`);
    }
  }
  
  if (validAudioCount > 0) {
    filterComplex.push(`${audioMap.join('')}amix=inputs=${validAudioCount}:duration=longest:dropout_transition=0:normalize=0[aout]`);
    
    const ffmpegArgs = [
      '-y',
      ...inputs,
      '-filter_complex', filterComplex.join(';'),
      '-map', '0:v',
      '-map', '[aout]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      FINAL_VIDEO
    ];
    
    console.log('Running final ffmpeg mix...');
    spawnSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' });
  } else {
    console.warn('No valid audio files found, copying video only.');
    fs.renameSync(tempVideo, FINAL_VIDEO);
  }
  
  // Cleanup
  if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo);
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  
  console.log(`\n✅ Rendered video saved to: ${FINAL_VIDEO}`);
  
  // Compress the video (unless --no-compress flag is set)
  if (!skipCompress) {
    console.log('\n🗜️  Starting video compression...');
    try {
      const compressResult = spawnSync('node', [
        path.join(process.cwd(), 'scripts', 'compress.js'),
        FINAL_VIDEO,
        '--crf=23',
        '--preset=medium'
      ], { stdio: 'inherit' });
      
      if (compressResult.status === 0) {
        const compressedFile = FINAL_VIDEO.replace('.mp4', '-compressed.mp4');
        console.log(`\n✅ Compressed video saved to: ${compressedFile}`);
      } else {
        console.warn(`\n⚠️  Compression failed, but original video is available at: ${FINAL_VIDEO}`);
      }
    } catch (error) {
      console.warn(`\n⚠️  Compression error: ${error.message}`);
      console.log(`Original video is available at: ${FINAL_VIDEO}`);
    }
  } else {
    console.log('\n⏭️  Skipping compression (--no-compress flag set)');
  }
}

main().catch(err => {
  console.error('Render failed:', err);
  process.exit(1);
});
