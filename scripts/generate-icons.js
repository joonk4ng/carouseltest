qnconst sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [192, 512];
const sourceIcon = path.resolve(__dirname, '../public/logo.svg');
const outputDir = path.resolve(__dirname, '../public/icons');

console.log('Source icon path:', sourceIcon);
console.log('Output directory:', outputDir);

// Create icons directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Verify source file exists
if (!fs.existsSync(sourceIcon)) {
  console.error('Source icon file does not exist:', sourceIcon);
  process.exit(1);
}

// Read the SVG file
const svgBuffer = fs.readFileSync(sourceIcon);

// Generate icons for each size
sizes.forEach(size => {
  const outputFile = path.join(outputDir, `icon-${size}.png`);
  console.log(`Generating ${size}x${size} icon to:`, outputFile);
  
  sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outputFile)
    .then(() => console.log(`Generated ${size}x${size} icon`))
    .catch(err => console.error(`Error generating ${size}x${size} icon:`, err));
}); 