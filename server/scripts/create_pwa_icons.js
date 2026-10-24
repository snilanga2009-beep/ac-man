const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const publicDir = path.join(__dirname, '../../client/public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Generate SVG Icon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="50%" stop-color="#0369a1"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="frostGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#a5f3fc"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <!-- Background Rounded Squircle -->
  <rect width="512" height="512" rx="115" fill="url(#bgGrad)"/>
  <rect x="16" y="16" width="480" height="480" rx="100" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="4"/>

  <!-- AC Air Cooling & Snowflake Symbol -->
  <g transform="translate(256, 230)" filter="url(#glow)">
    <!-- Central Snowflake Hub -->
    <circle r="28" fill="#ffffff" />
    <circle r="14" fill="#0284c7" />

    <!-- 6 Snowflake Spikes -->
    <!-- 0 deg -->
    <g>
      <line x1="0" y1="-28" x2="0" y2="-110" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
      <path d="M-22 -80 L0 -105 L22 -80" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-16 -50 L0 -68 L16 -50" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <!-- 60 deg -->
    <g transform="rotate(60)">
      <line x1="0" y1="-28" x2="0" y2="-110" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
      <path d="M-22 -80 L0 -105 L22 -80" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-16 -50 L0 -68 L16 -50" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <!-- 120 deg -->
    <g transform="rotate(120)">
      <line x1="0" y1="-28" x2="0" y2="-110" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
      <path d="M-22 -80 L0 -105 L22 -80" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-16 -50 L0 -68 L16 -50" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <!-- 180 deg -->
    <g transform="rotate(180)">
      <line x1="0" y1="-28" x2="0" y2="-110" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
      <path d="M-22 -80 L0 -105 L22 -80" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-16 -50 L0 -68 L16 -50" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <!-- 240 deg -->
    <g transform="rotate(240)">
      <line x1="0" y1="-28" x2="0" y2="-110" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
      <path d="M-22 -80 L0 -105 L22 -80" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-16 -50 L0 -68 L16 -50" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <!-- 300 deg -->
    <g transform="rotate(300)">
      <line x1="0" y1="-28" x2="0" y2="-110" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
      <path d="M-22 -80 L0 -105 L22 -80" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-16 -50 L0 -68 L16 -50" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>

  <!-- Typography Brand: AC-PRO -->
  <text x="256" y="425" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="900" fill="#ffffff" letter-spacing="4">
    AC-PRO
  </text>
  <text x="256" y="460" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="#38bdf8" letter-spacing="6">
    TECHNICIAN &amp; SAAS
  </text>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgIcon);
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon);

// Function to generate raw uncompressed PNG with pure Node.js
function createPng(width, height, getPixel) {
  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw Image data (filter type 0 per scanline)
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);

  const crc = crc32(typeAndData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([len, typeAndData, crcBuf]);
}

// CRC32 implementation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Gradient generator for AC-Pro icon
function acProPixel(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;

  // Center distance
  const cx = w / 2;
  const cy = h / 2 - h * 0.06;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background Gradient (Sky blue to deep navy)
  let r = Math.floor(2 + (15 - 2) * ny);
  let g = Math.floor(132 + (23 - 132) * (nx * 0.5 + ny * 0.5));
  let b = Math.floor(199 + (42 - 199) * ny);

  // Snowflake core highlight
  if (dist < w * 0.08) {
    return [255, 255, 255, 255];
  }

  // Snowflake 6 arms
  const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 60;
  const symAngle = Math.abs(angle - 30);
  if (dist < w * 0.32 && symAngle < (3 - dist / (w * 0.15))) {
    return [255, 255, 255, 255];
  }

  // Soft cyan glow around snowflake
  if (dist < w * 0.38) {
    const glowFactor = (1 - dist / (w * 0.38)) * 0.5;
    r = Math.min(255, Math.floor(r + 56 * glowFactor));
    g = Math.min(255, Math.floor(g + 189 * glowFactor));
    b = Math.min(255, Math.floor(b + 248 * glowFactor));
  }

  return [r, g, b, 255];
}

// Write 192x192, 512x512, apple-touch-icon 180x180
const png192 = createPng(192, 192, acProPixel);
const png512 = createPng(512, 512, acProPixel);
const pngApple = createPng(180, 180, acProPixel);

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), png192);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), png512);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), pngApple);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon-precomposed.png'), pngApple);

console.log('✅ Generated PWA icons in client/public/: favicon.svg, icon.svg, icon-192.png, icon-512.png, apple-touch-icon.png');
