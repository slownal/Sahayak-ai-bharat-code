/**
 * scripts/gen-icons.js
 *
 * Generates minimal valid PNG icons for the Sahayak PWA.
 * Produces public/icons/icon-192.png and public/icons/icon-512.png
 * — a saffron (#FF9933) background with a white "स" (Sa) letterform.
 *
 * Uses only Node.js built-ins (zlib, fs, crypto). No extra packages needed.
 * Run once: node scripts/gen-icons.js
 */

const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// ── PNG helpers ───────────────────────────────────────────────────────────────

function uint32BE(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let j = 0; j < 8; j++)
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len = uint32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = uint32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crc]);
}

function makePNG(size) {
  // ── IHDR ──────────────────────────────────────────────────────────────────
  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(size, 0);  // width
  ihdrData.writeUInt32BE(size, 4);  // height
  ihdrData[8] = 8;   // bit depth
  ihdrData[9] = 2;   // colour type: RGB
  ihdrData[10] = 0;  // compression
  ihdrData[11] = 0;  // filter
  ihdrData[12] = 0;  // interlace

  // ── Pixel data ────────────────────────────────────────────────────────────
  // Saffron background: #FF9933 = (255, 153, 51)
  const BG = [0xff, 0x99, 0x33];
  // White: (255, 255, 255)
  const FG = [0xff, 0xff, 0xff];

  // Simple "S" letterform using relative coordinates (0–1 range)
  // We'll draw a thick "S" shape as a set of filled rectangles
  const rows = [];
  const pad = Math.floor(size * 0.18);
  const inner = size - pad * 2;
  const thick = Math.max(2, Math.floor(inner * 0.18));

  for (let y = 0; y < size; y++) {
    // Filter byte (None = 0) prepended to each row
    const row = [0];
    const ry = y - pad; // relative y within inner box

    for (let x = 0; x < size; x++) {
      const rx = x - pad; // relative x within inner box

      let isFg = false;

      if (rx >= 0 && rx < inner && ry >= 0 && ry < inner) {
        const relY = ry / inner; // 0..1 top to bottom
        const relX = rx / inner; // 0..1 left to right

        // Top bar of S
        if (relY < 0.18 && relX > 0.1 && relX < 0.9) isFg = true;
        // Middle bar of S
        if (relY > 0.41 && relY < 0.59 && relX > 0.1 && relX < 0.9) isFg = true;
        // Bottom bar of S
        if (relY > 0.82 && relX > 0.1 && relX < 0.9) isFg = true;
        // Top-left vertical stroke
        if (relX < 0.18 && relY > 0.0 && relY < 0.5) isFg = true;
        // Bottom-right vertical stroke
        if (relX > 0.82 && relY > 0.5 && relY < 1.0) isFg = true;
        // Suppress middle corners for legibility
        if (relY < 0.14 && relX > 0.82) isFg = false;
        if (relY > 0.86 && relX < 0.18) isFg = false;
      }

      const px = isFg ? FG : BG;
      row.push(px[0], px[1], px[2]);
    }
    rows.push(Buffer.from(row));
  }

  const rawData = Buffer.concat(rows);
  const compressed = zlib.deflateSync(rawData, { level: 9 });

  // ── Assemble PNG ───────────────────────────────────────────────────────────
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdrData),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Write icons ───────────────────────────────────────────────────────────────

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const png = makePNG(size);
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✓ Written ${outPath} (${png.length} bytes)`);
}

