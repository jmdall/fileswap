// Quick test to check if preview generation works
import { generatePreview } from './src/services/preview.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPreviewGeneration() {
    console.log('Testing preview generation...\n');
    
    try {
        // Create a test image buffer (red square)
        const sharp = (await import('sharp')).default;
        
        console.log('Creating test image...');
        const testImageBuffer = await sharp({
            create: {
                width: 800,
                height: 600,
                channels: 3,
                background: { r: 255, g: 100, b: 100 }
            }
        })
        .png()
        .toBuffer();
        
        console.log(`Test image created: ${testImageBuffer.length} bytes`);
        
        // Test preview generation
        console.log('\nGenerating preview...');
        const preview = await generatePreview(testImageBuffer, 'image/png', 'test.png');
        
        if (preview) {
            console.log('\n✅ Preview generated successfully!');
            console.log('Preview details:', {
                size: preview.buffer.length,
                mimeType: preview.mimeType,
                extension: preview.extension,
                metadata: preview.metadata
            });
            
            // Save the preview to check it
            const outputPath = path.join(__dirname, 'test-preview-output.jpg');
            await fs.writeFile(outputPath, preview.buffer);
            console.log(`\n✅ Preview saved to: ${outputPath}`);
            console.log('Open this file to verify the preview works.');
            
        } else {
            console.log('\n❌ Preview generation returned null');
        }
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        console.error('\nThis means Sharp is not working properly.');
        console.error('Try:');
        console.error('  1. npm uninstall sharp');
        console.error('  2. npm cache clean --force');
        console.error('  3. npm install sharp@latest');
    }
}

testPreviewGeneration();
