const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'assets');
const source = path.join(assets, 'app-icon-source.png');
const suppliedSource = 'C:/Users/limer/Desktop/血月狼人杀徽章.png';

async function render(destination, size, fit = 'cover') {
  await sharp(source)
    .flatten({ background: '#050505' })
    .resize(size, size, { fit })
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(assets, destination));
}

async function main() {
  try {
    await fs.access(source);
  } catch {
    await fs.copyFile(suppliedSource, source);
  }
  await Promise.all([
    render('icon.png', 1024),
    render('splash-icon.png', 512, 'contain'),
    render('favicon.png', 128),
  ]);
  const foreground = await sharp(source)
    .flatten({ background: '#050505' })
    .resize(716, 716, { fit: 'cover' })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: foreground, left: 154, top: 154 }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(assets, 'android-icon-foreground.png'));
  await sharp(source)
    .flatten({ background: '#050505' })
    .resize(716, 716, { fit: 'cover' })
    .grayscale()
    .threshold(150)
    .png({ compressionLevel: 9 })
    .toFile(path.join(assets, 'android-icon-monochrome.png'));
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: '#050505',
    },
  }).png().toFile(path.join(assets, 'android-icon-background.png'));
  const metadata = await fs.stat(path.join(assets, 'icon.png'));
  process.stdout.write(`Generated icon assets (${metadata.size} bytes)\n`);
}

main().catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
