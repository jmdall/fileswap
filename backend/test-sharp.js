// Test if sharp is working correctly
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

console.log('Testing Sharp installation...\n');

// Check if sharp is properly installed
try {
    sharp.versions().then(versions => {
        console.log('✅ Sharp is installed');
        console.log('Versions:', versions);
        console.log('');
    });
} catch (error) {
    console.error('❌ Sharp error:', error);
    process.exit(1);
}

// Create a test image
async function testSharp() {
    try {
        console.log('Creating test image...');
        
        // Create a simple test image
        const testImage = await sharp({
            create: {
                width: 300,
                height: 200,
                channels: 3,
                background: { r: 255, g: 0, b: 0 }
            }
        })
        .png()
        .toBuffer();
        
        console.log('✅ Test image created, size:', testImage.length, 'bytes');
        
        // Try to create a thumbnail
        console.log('Creating thumbnail...');
        const thumbnail = await sharp(testImage)
            .resize(256, 256, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 80 })
            .toBuffer();
            
        console.log('✅ Thumbnail created, size:', thumbnail.length, 'bytes');
        
        // Save the test thumbnail
        const outputPath = path.join(__dirname, 'test-thumbnail.jpg');
        fs.writeFileSync(outputPath, thumbnail);
        console.log('✅ Test thumbnail saved to:', outputPath);
        
        console.log('\n✅ Sharp is working correctly!');
        
    } catch (error) {
        console.error('❌ Sharp test failed:', error);
        console.log('\nTry reinstalling sharp:');
        console.log('  npm uninstall sharp');
        console.log('  npm install sharp@latest');
    }
}

testSharp();
