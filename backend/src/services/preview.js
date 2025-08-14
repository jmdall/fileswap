import sharp from 'sharp';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper pour extraire des frames d'une vidéo avec ffmpeg
async function extractVideoFrames(buffer, mimeType, count = 2) {
    const tempDir = path.join(__dirname, '../../temp');
    await fs.mkdir(tempDir, { recursive: true });

    // Déterminer l'extension en fonction du type MIME
    const extension = mimeType.includes('mp4') ? '.mp4' :
        mimeType.includes('webm') ? '.webm' :
            mimeType.includes('avi') ? '.avi' :
                mimeType.includes('mov') ? '.mov' : '.mp4';

    const inputFile = path.join(tempDir, `input_${nanoid()}${extension}`);
    const frames = [];

    try {
        // Écrire le buffer dans un fichier temporaire
        await fs.writeFile(inputFile, buffer);
        console.log(`[Preview] Video file written to temp: ${inputFile}`);

        // Obtenir la durée de la vidéo
        const duration = await getVideoDuration(inputFile);
        console.log(`[Preview] Video duration: ${duration} seconds`);

        // Extraire les frames à différents moments
        const positions = count === 1 ? [duration * 0.3] : [duration * 0.1, duration * 0.5];

        for (let i = 0; i < positions.length; i++) {
            const outputFile = path.join(tempDir, `frame_${nanoid()}.jpg`);
            const position = Math.max(0, positions[i]); // S'assurer que la position est positive

            console.log(`[Preview] Extracting frame ${i + 1} at position ${position}s...`);

            await new Promise((resolve, reject) => {
                const args = [
                    '-ss', position.toString(),
                    '-i', inputFile,
                    '-vframes', '1',
                    '-q:v', '2',
                    '-vf', 'scale=320:-1',
                    '-f', 'image2',
                    outputFile,
                    '-y'
                ];

                console.log(`[Preview] ffmpeg command: ffmpeg ${args.join(' ')}`);
                const ffmpeg = spawn('ffmpeg', args);

                let stderr = '';
                ffmpeg.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                ffmpeg.on('close', (code) => {
                    if (code === 0) {
                        console.log(`[Preview] Frame ${i + 1} extracted successfully`);
                        resolve();
                    } else {
                        console.error(`[Preview] ffmpeg stderr: ${stderr}`);
                        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
                    }
                });

                ffmpeg.on('error', (err) => {
                    console.error(`[Preview] ffmpeg error: ${err.message}`);
                    reject(err);
                });
            });

            // Vérifier que le fichier existe avant de le lire
            if (await fs.access(outputFile).then(() => true).catch(() => false)) {
                const frameBuffer = await fs.readFile(outputFile);
                console.log(`[Preview] Frame ${i + 1} read, size: ${frameBuffer.length} bytes`);
                frames.push(frameBuffer);

                // Nettoyer le fichier frame temporaire
                await fs.unlink(outputFile).catch(() => {});
            } else {
                console.error(`[Preview] Frame file not found: ${outputFile}`);
            }
        }

        return frames;
    } catch (error) {
        console.error(`[Preview] Error in extractVideoFrames: ${error.message}`);
        throw error;
    } finally {
        // Nettoyer le fichier input temporaire
        await fs.unlink(inputFile).catch(() => {});
    }
}

// Helper pour obtenir la durée d'une vidéo
function getVideoDuration(inputFile) {
    return new Promise((resolve, reject) => {
        const args = [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            inputFile
        ];

        console.log(`[Preview] ffprobe command: ffprobe ${args.join(' ')}`);
        const ffprobe = spawn('ffprobe', args);

        let duration = '';
        let stderr = '';

        ffprobe.stdout.on('data', (data) => {
            duration += data.toString();
        });

        ffprobe.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ffprobe.on('close', (code) => {
            if (code === 0) {
                const durationFloat = parseFloat(duration.trim());
                console.log(`[Preview] Video duration detected: ${durationFloat}s`);
                resolve(durationFloat);
            } else {
                console.error(`[Preview] ffprobe stderr: ${stderr}`);
                reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
            }
        });

        ffprobe.on('error', (err) => {
            console.error(`[Preview] ffprobe error: ${err.message}`);
            reject(err);
        });
    });
}

// Fonction principale de génération de preview
export async function generatePreview(buffer, mimeType, filename) {
    console.log(`[Preview] Starting preview generation for ${filename} (${mimeType})`);

    try {
        // Skip if buffer is empty
        if (!buffer || buffer.length === 0) {
            console.log('[Preview] Buffer is empty');
            return null;
        }

        // Traiter les vidéos
        if (mimeType && mimeType.startsWith('video/')) {
            console.log(`[Preview] Processing video file`);

            // Vérifier que ffmpeg est disponible
            try {
                await new Promise((resolve, reject) => {
                    const ffmpegTest = spawn('ffmpeg', ['-version']);
                    ffmpegTest.on('close', (code) => {
                        if (code === 0) resolve();
                        else reject(new Error('ffmpeg not available'));
                    });
                    ffmpegTest.on('error', () => reject(new Error('ffmpeg not found')));
                });
            } catch (error) {
                console.error('[Preview] ffmpeg is not installed or not in PATH');
                console.error('[Preview] Please install ffmpeg to enable video preview generation');
                return null;
            }

            try {
                // Extraire 2 frames de la vidéo
                const frames = await extractVideoFrames(buffer, mimeType, 2);

                if (frames.length === 0) {
                    console.log('[Preview] No frames extracted from video');
                    return null;
                }

                // Vérifier que les frames sont valides
                for (let i = 0; i < frames.length; i++) {
                    try {
                        const metadata = await sharp(frames[i]).metadata();
                        console.log(`[Preview] Frame ${i + 1} metadata:`, {
                            width: metadata.width,
                            height: metadata.height,
                            format: metadata.format
                        });
                    } catch (err) {
                        console.error(`[Preview] Invalid frame ${i + 1}:`, err.message);
                        return null;
                    }
                }

                // Si on a 2 frames, créer une image composite
                let compositeBuffer;

                if (frames.length === 2) {
                    console.log('[Preview] Creating composite with 2 frames');

                    // Redimensionner chaque frame
                    const frame1 = await sharp(frames[0])
                        .resize(256, 144, { fit: 'inside' })
                        .jpeg()
                        .toBuffer();

                    const frame2 = await sharp(frames[1])
                        .resize(256, 144, { fit: 'inside' })
                        .jpeg()
                        .toBuffer();

                    // Créer une image composite verticale
                    compositeBuffer = await sharp({
                        create: {
                            width: 256,
                            height: 320,
                            channels: 3,
                            background: { r: 0, g: 0, b: 0 }
                        }
                    })
                        .composite([
                            { input: frame1, top: 10, left: 0 },
                            { input: frame2, top: 166, left: 0 }
                        ])
                        .jpeg({ quality: 80 })
                        .toBuffer();

                } else {
                    // Une seule frame
                    compositeBuffer = await sharp(frames[0])
                        .resize(256, 256, { fit: 'inside' })
                        .toBuffer();
                }

                // Ajouter le watermark pour vidéo (sans flou)
                const watermarkText = Buffer.from(
                    `<svg width="256" height="${frames.length === 2 ? 320 : 256}">
            <defs>
              <style>
                .watermark { 
                  fill: rgba(255, 255, 255, 0.8); 
                  font-size: 32px; 
                  font-weight: bold;
                  font-family: Arial, sans-serif;
                }
                .watermark-bg { 
                  fill: rgba(0, 0, 0, 0.4); 
                  font-size: 32px; 
                  font-weight: bold;
                  font-family: Arial, sans-serif;
                }
                .info {
                  fill: rgba(255, 255, 255, 0.9);
                  font-size: 14px;
                  font-family: Arial, sans-serif;
                }
              </style>
            </defs>
            <!-- Fond semi-transparent pour le texte -->
            <rect x="0" y="0" width="256" height="30" fill="rgba(0, 0, 0, 0.6)"/>
            <!-- Texte d'info -->
            <text x="10" y="20" class="info">VIDEO PREVIEW - ${frames.length} frame${frames.length > 1 ? 's' : ''}</text>
            <!-- Watermark -->
            <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" 
                  class="watermark-bg" transform="translate(1, 1)">VIDEO</text>
            <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" 
                  class="watermark">VIDEO</text>
          </svg>`
                );

                // Composite du watermark sur l'image
                const finalBuffer = await sharp(compositeBuffer)
                    .composite([{
                        input: watermarkText,
                        top: 0,
                        left: 0,
                        blend: 'over'
                    }])
                    .jpeg({ quality: 70 })
                    .toBuffer();

                console.log(`[Preview] Video preview generated successfully`);

                return {
                    buffer: finalBuffer,
                    extension: 'jpg',
                    mimeType: 'image/jpeg',
                    metadata: {
                        type: 'video',
                        frames: frames.length,
                        originalSize: buffer.length
                    }
                };

            } catch (videoError) {
                console.error('[Preview] Video processing error:', videoError.message);
                console.error('[Preview] Stack trace:', videoError.stack);
                // Si ffmpeg n'est pas installé ou erreur, retourner null
                return null;
            }
        }

        // Traiter les images
        if (mimeType && mimeType.startsWith('image/')) {
            console.log(`[Preview] Processing image file`);

            try {
                // Get image metadata first
                const metadata = await sharp(buffer).metadata();
                console.log(`[Preview] Image metadata:`, {
                    width: metadata.width,
                    height: metadata.height,
                    format: metadata.format,
                    channels: metadata.channels
                });

                // Generate thumbnail with heavy blur and watermark
                console.log('[Preview] Generating blurred thumbnail...');

                // First, create the blurred thumbnail
                const thumbnailBuffer = await sharp(buffer)
                    .resize(256, 256, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .blur(15) // Heavy gaussian blur (15 pixels radius)
                    .modulate({
                        brightness: 0.8,  // Slightly darker
                        saturation: 0.5   // Reduce color saturation
                    })
                    .jpeg({
                        quality: 40,  // Lower quality for additional degradation
                        mozjpeg: true // Use mozjpeg encoder for better compression
                    })
                    .toBuffer();

                // Get actual dimensions of the thumbnail
                const thumbnailMetadata = await sharp(thumbnailBuffer).metadata();
                const thumbWidth = thumbnailMetadata.width;
                const thumbHeight = thumbnailMetadata.height;

                // Create a watermark overlay that matches the thumbnail dimensions
                const watermarkText = Buffer.from(
                    `<svg width="${thumbWidth}" height="${thumbHeight}">
            <defs>
              <style>
                .watermark { 
                  fill: rgba(255, 255, 255, 0.7); 
                  font-size: ${Math.min(thumbWidth, thumbHeight) * 0.2}px; 
                  font-weight: bold;
                  font-family: Arial, sans-serif;
                }
                .watermark-bg { 
                  fill: rgba(0, 0, 0, 0.3); 
                  font-size: ${Math.min(thumbWidth, thumbHeight) * 0.2}px; 
                  font-weight: bold;
                  font-family: Arial, sans-serif;
                }
              </style>
            </defs>
            <!-- Shadow/background text -->
            <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" 
                  class="watermark-bg" transform="translate(2, 2) rotate(-30 ${thumbWidth/2} ${thumbHeight/2})">PREVIEW</text>
            <!-- Main text -->
            <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" 
                  class="watermark" transform="rotate(-30 ${thumbWidth/2} ${thumbHeight/2})">PREVIEW</text>
          </svg>`
                );

                // Composite the watermark over the blurred image
                const thumbnail = await sharp(thumbnailBuffer)
                    .composite([{
                        input: watermarkText,
                        top: 0,
                        left: 0,
                        blend: 'over'
                    }])
                    .jpeg({ quality: 60 })
                    .toBuffer();

                console.log(`[Preview] Image thumbnail generated successfully, size: ${thumbnail.length} bytes`);

                return {
                    buffer: thumbnail,
                    extension: 'jpg',
                    mimeType: 'image/jpeg',
                    metadata: {
                        type: 'image',
                        width: metadata.width,
                        height: metadata.height,
                        format: metadata.format,
                        originalSize: buffer.length,
                        thumbnailSize: thumbnail.length
                    }
                };
            } catch (sharpError) {
                console.error('[Preview] Image processing error:', sharpError.message);
                throw sharpError;
            }
        }

        // Type de fichier non supporté pour la preview
        console.log(`[Preview] Unsupported file type for preview: ${mimeType}`);
        return null;

    } catch (error) {
        console.error('[Preview] Preview generation failed:', error.message);
        console.error('[Preview] Stack trace:', error.stack);
        return null;
    }
}
