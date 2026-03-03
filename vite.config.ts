import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import fs from 'fs';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// Audio generation function (extracted from generate-audio.ts)
async function generateAudioForProject(projectId: string) {
  const projectPath = path.resolve(process.cwd(), 'public', 'projects', projectId, `${projectId}.json`);
  
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project file not found: ${projectPath}`);
  }

  const project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
  
  console.log(`Generating audio for project: ${project.name} (${projectId})`);
  
  const OUTPUT_DIR = path.resolve(process.cwd(), 'public/projects', projectId, 'audio');
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let clipIndex = 0;
  const results = [];

  for (let i = 0; i < project.clips.length; i++) {
    const clip = project.clips[i];
    
    // Only process clips with speech
    if (!clip.speech || typeof clip.speech !== 'string' || !clip.speech.trim()) {
      continue;
    }

    const speechText = clip.speech.trim();
    const isChinese = /[\u4e00-\u9fa5]/.test(speechText);
    const voice = clip.voice || (isChinese ? 'zh-CN-YunjianNeural' : 'en-US-GuyNeural');

    console.log(`Generating clip ${clipIndex} using voice: ${voice}...`);

    try {
      const tts = new MsEdgeTTS();
      
      await tts.setMetadata(
        voice,
        OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
      );

      const audioPath = path.join(OUTPUT_DIR, `${clipIndex}.mp3`);

      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${isChinese ? 'zh-CN' : 'en-US'}'>
        <voice name='${voice}'>
          <prosody pitch='+0Hz' rate='+0%' volume='+0%'>
            ${speechText}
          </prosody>
        </voice>
      </speak>`;

      const result = await tts.rawToStream(ssml);
      const audioFile = fs.createWriteStream(audioPath);
      const metadata: any[] = [];

      // Handle metadata if available
      if (result.metadataStream) {
        result.metadataStream.on('data', (data) => {
          let content = data;
          if (Buffer.isBuffer(data)) {
            content = data.toString('utf8');
          }
          if (typeof content === 'string') {
            try {
              const parsed = JSON.parse(content);
              metadata.push(parsed);
            } catch (e) {
              // Ignore non-json chunks
            }
          } else {
            metadata.push(content);
          }
        });
      }

      await new Promise((resolve, reject) => {
        result.audioStream.pipe(audioFile);
        result.audioStream.on('end', resolve);
        result.audioStream.on('error', reject);
      });

      // Save metadata if we have any
      if (metadata.length > 0) {
        const metaPath = path.join(OUTPUT_DIR, `${clipIndex}.json`);
        fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
        console.log(`✅ Saved metadata: ${metaPath}`);
      }

      // Save clip info for reference
      const clipInfoPath = path.join(OUTPUT_DIR, `${clipIndex}_info.json`);
      fs.writeFileSync(clipInfoPath, JSON.stringify({
        originalClipIndex: i,
        clipIndex,
        speech: speechText,
        voice,
        audioFile: `${clipIndex}.mp3`,
        metadataFile: metadata.length > 0 ? `${clipIndex}.json` : null
      }, null, 2));

      results.push({
        clipIndex,
        originalClipIndex: i,
        speech: speechText.substring(0, 100),
        audioFile: `${clipIndex}.mp3`
      });

      console.log(`✅ Generated: ${audioPath}`);
      clipIndex++;

    } catch (err) {
      console.error(`❌ Error generating audio for clip ${i}:`, err);
      throw err;
    }
  }

  return { projectId, generatedFiles: results.length, results };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      // Custom plugin to handle API routes
      {
        name: 'audio-api',
        configureServer(server) {
          server.middlewares.use('/api/generate-audio', async (req, res, next) => {
            console.log('[API] Received request:', req.method, req.url);
            
            if (req.method !== 'POST') {
              console.log('[API] Method not allowed:', req.method);
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }

            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });

            req.on('end', async () => {
              try {
                console.log('[API] Request body:', body);
                const { projectId } = JSON.parse(body);
                
                if (!projectId) {
                  console.log('[API] Missing projectId');
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'projectId is required' }));
                  return;
                }

                console.log(`[API] Starting audio generation for project: ${projectId}`);
                const result = await generateAudioForProject(projectId);
                
                console.log('[API] Audio generation completed:', result);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ 
                  success: true, 
                  message: `Generated ${result.generatedFiles} audio files`,
                  ...result 
                }));
              } catch (error) {
                console.error('[API] Audio generation failed:', error);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ 
                  error: 'Audio generation failed', 
                  details: error.message 
                }));
              }
            });
          });
        }
      }
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});