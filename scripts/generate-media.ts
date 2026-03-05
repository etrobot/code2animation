
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function encodeImageToBase64(imagePath: string): Promise<string> {
    const data = await fs.promises.readFile(imagePath);
    return data.toString('base64');
}

interface GrokGenerateOptions {
    prompt: string;
    imagePath?: string;
    outputPath?: string;
    model?: string;
    type?: 'image' | 'video' | 'text2video';
}

async function grokGenerate({ prompt, imagePath, outputPath, model, type = 'image' }: GrokGenerateOptions) {
    // Use environment variables for model selection if not explicitly provided
    if (!model) {
        model = type === 'text2video' || type === 'video' 
            ? process.env.GENAI_VIDEO_MODEL 
            : process.env.GENAI_MAGE_MODEL;
    }
    const apiUrl = process.env.GENAI_BASE_URL+"/v1/chat/completions";
    const headers = {
        "Authorization": "Bearer "+process.env.GENAI_TOKEN,
        "Content-Type": "application/json"
    };

    let payload: any;

    if (imagePath) {
        if (!fs.existsSync(imagePath)) {
            console.error(`Error: Image file not found: ${imagePath}`);
            return null;
        }

        console.log(`Reading image: ${imagePath}`);
        try {
            const base64Image = await encodeImageToBase64(imagePath);
            console.log(`Image encoded successfully (${base64Image.length} bytes)`);

            payload = {
                model,
                stream: false,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`
                                }
                            },
                            {
                                type: "text",
                                text: prompt
                            }
                        ]
                    }
                ]
            };
        } catch (e) {
            console.error(`Error encoding image: ${e}`);
            return null;
        }
    } else {
        payload = {
            model,
            stream: false,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        };
    }

    console.log(`\nSending request to API...`);
    console.log(`Prompt: ${prompt}`);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API request failed: ${response.status} ${text}`);
        }

        const result = await response.json() as any;
        console.log(`\n✓ API Response received successfully`);

        if (result.choices) {
            for (const choice of result.choices) {
                const message = choice.message || {};
                const content = message.content || '';

                const urlMatch = content.match(/(?:src|href)="([^"]+)"|!\[.*?\]\((https?:\/\/[^\)]+)\)/);
                if (urlMatch) {
                    const mediaUrl = urlMatch[1] || urlMatch[2];
                    console.log(`\n✓ Generated content URL: ${mediaUrl}`);

                    if (mediaUrl.includes('localhost') || mediaUrl.includes('127.0.0.1')) {
                        console.log(`⚠️  Note: The URL is a localhost URL, which means the file is on the API server.`);
                    } else if (outputPath) {
                        try {
                            const outputDir = path.dirname(path.resolve(outputPath));
                            if (!fs.existsSync(outputDir)) {
                                fs.mkdirSync(outputDir, { recursive: true });
                            }

                            console.log(`Downloading content to: ${outputPath}`);
                            const mediaResponse = await fetch(mediaUrl);
                            if (!mediaResponse.ok) throw new Error(`Download failed: ${mediaResponse.statusText}`);

                            let finalOutputPath = outputPath;
                            const urlWithoutQuery = mediaUrl.split('?')[0];
                            if (urlWithoutQuery.match(/\.(jpg|jpeg|png|webp)$/i)) {
                                if (outputPath.match(/\.(mp4|avi|mov)$/i)) {
                                    const base = outputPath.replace(/\.[^/.]+$/, "");
                                    const ext = urlWithoutQuery.split('.').pop();
                                    finalOutputPath = `${base}.${ext}`;
                                    console.log(`⚠️  URL points to image, adjusted output to: ${finalOutputPath}`);
                                }
                            }

                            const buffer = await mediaResponse.arrayBuffer();
                            await fs.promises.writeFile(finalOutputPath, Buffer.from(buffer));
                            console.log(`✓ Saved to: ${finalOutputPath}`);
                        } catch (e) {
                            console.error(`✗ Download failed: ${e}`);
                        }
                    }
                }
            }
        }
        return result;
    } catch (e) {
        console.error(`\n✗ API request failed: ${e}`);
        return null;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const params: GrokGenerateOptions = { prompt: '' };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--prompt') params.prompt = args[++i];
        else if (args[i] === '--image') params.imagePath = args[++i];
        else if (args[i] === '--output') params.outputPath = args[++i];
        else if (args[i] === '--type') {
            const type = args[++i] as 'image' | 'video' | 'text2video';
            params.type = type;
        }
        else if (args[i] === '--model') params.model = args[++i];
    }

    if (!params.prompt) {
        console.log('Usage: tsx scripts/generate-media.ts --prompt "your prompt" [--image path] [--output path] [--type image|video|text2video] [--model model_name]');
        return;
    }

    await grokGenerate(params);
}

main().catch(console.error);
