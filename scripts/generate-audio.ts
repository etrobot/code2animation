import fs from 'fs';
import path from 'path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// Type definitions for the video project structure
interface MediaItem {
  src?: string;
  words?: string[];
  type?: string;
  transitionType?: string;
  duration?: number;
}

interface VideoClip {
  type: string;
  speech?: string;
  media?: MediaItem[];
  transitionType?: string;
  duration?: number;
  voice?: string;
}

interface VideoProject {
  name: string;
  background?: string;
  clips: VideoClip[];
}

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadVideoProject(projectId: string): VideoProject {
  const projectPath = path.resolve(process.cwd(), 'public', 'projects', projectId, `${projectId}.json`);
  
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project file not found: ${projectPath}`);
  }

  const raw = fs.readFileSync(projectPath, 'utf-8');
  return JSON.parse(raw);
}

// Helper function to split long text into chunks if needed
function splitTextIntoChunks(text: string, maxChars: number): string[] {
  const sentences = text.split(/[。！？.!?]/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    const sentenceWithPunctuation = trimmedSentence + (text.includes('。') ? '。' : '.');
    
    if ((currentChunk + sentenceWithPunctuation).length <= maxChars) {
      currentChunk += sentenceWithPunctuation;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentenceWithPunctuation;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function generateAudioForProject(projectId: string) {
  const project = loadVideoProject(projectId);
  
  console.log(`Generating audio for project: ${project.name} (${projectId})`);
  
  const OUTPUT_DIR = path.resolve(process.cwd(), 'public/projects', projectId, 'audio');
  await ensureDir(OUTPUT_DIR);

  let clipIndex = 0;

  for (let i = 0; i < project.clips.length; i++) {
    const clip = project.clips[i];
    
    // Skip transition clips - they don't have speech
    if (clip.type === 'transition') {
      console.log(`Skipping transition clip ${i + 1}`);
      continue;
    }

    // Only process clips with speech
    if (!clip.speech || typeof clip.speech !== 'string' || !clip.speech.trim()) {
      console.log(`Skipping clip ${i + 1} (no speech)`);
      continue;
    }

    const speechText = clip.speech.trim();

    // Check character limit for Edge-TTS
    const charCount = speechText.length;
    const maxChars = 1000; // Conservative limit

    if (charCount > maxChars) {
      console.warn(`⚠️  Clip ${i + 1} has ${charCount} characters, exceeding recommended limit of ${maxChars}`);
      console.warn(`Consider splitting into multiple clips or shortening the text.`);
      console.warn(`Text preview: ${speechText.substring(0, 100)}...`);
      
      // For now, we'll still try to generate but warn the user
      // In production, you might want to auto-split or reject
    } else {
      console.log(`✅ Clip ${i + 1} character count: ${charCount}/${maxChars}`);
    }

    // Determine voice for this clip
    const isChinese = /[\u4e00-\u9fa5]/.test(speechText);
    const voice = clip.voice || (isChinese ? 'zh-CN-YunjianNeural' : 'en-US-GuyNeural');

    console.log(`Generating clip ${clipIndex + 1} (original clip ${i + 1}) using voice: ${voice}...`);
    console.log(`Speech text: ${speechText.substring(0, 100)}${speechText.length > 100 ? '...' : ''}`);

    try {
      // Create a new TTS instance for each clip to avoid state issues
      const tts = new MsEdgeTTS();
      
      await tts.setMetadata(
        voice,
        OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
      );

      const audioPath = path.join(OUTPUT_DIR, `${clipIndex}.mp3`);
      const metaPath = path.join(OUTPUT_DIR, `${clipIndex}.json`);

      // Generate SSML for better control (optional)
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${isChinese ? 'zh-CN' : 'en-US'}'>
        <voice name='${voice}'>
          <prosody pitch='+0Hz' rate='+0%' volume='+0%'>
            ${speechText}
          </prosody>
        </voice>
      </speak>`;

      // Use rawToStream for SSML or toStream for plain text
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
        fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
      }

      // Save clip info for reference
      const clipInfoPath = path.join(OUTPUT_DIR, `${clipIndex}_info.json`);
      fs.writeFileSync(clipInfoPath, JSON.stringify({
        originalClipIndex: i,
        clipIndex,
        speech: speechText,
        voice,
        charCount,
        audioFile: `${clipIndex}.mp3`
      }, null, 2));

      console.log(`✅ Saved: ${audioPath}`);
      clipIndex++;

    } catch (err) {
      console.error(`❌ Error generating audio for clip ${i + 1}:`, err);
    }
  }

  console.log(`🎉 Generated ${clipIndex} audio files for project ${projectId}`);
}

async function main() {
  const args = process.argv.slice(2);
  const targetProject = args[0];

  if (!targetProject) {
    console.error('Usage: npx tsx scripts/generate-audio.ts <projectId>');
    console.error('Example: npx tsx scripts/generate-audio.ts video-1');
    process.exit(1);
  }

  try {
    await generateAudioForProject(targetProject);
    console.log('🎵 Audio generation complete.');
  } catch (error) {
    console.error('❌ Audio generation failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);