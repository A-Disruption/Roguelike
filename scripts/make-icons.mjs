// Renders the 8x8 player sprite into PNG app icons (no image libraries needed).
import { deflateSync, crc32 } from "node:zlib";
import { writeFileSync } from "node:fs";

const BG = "#080A0E";
const GLOW = "#2A1D10";
const pal = { c:"#38445A", d:"#4C5A73", f:"#D9B48A", k:"#12161E", e:"#E9A13B" };
const rows = [
  "..cccc..",
  ".cddddc.",
  ".cffffc.",
  ".cfkkfc.",
  "..dddd..",
  ".cddddc.",
  ".cc..cce",
  ".c....ce",
];

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

function icon(size, file) {
  const scale = Math.floor((size * 0.6) / 8);
  const off = Math.floor((size - scale * 8) / 2);
  const [br, bg, bb] = hex(BG), [gr, gg, gb] = hex(GLOW);
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      // soft lamplight behind the sprite
      const d = Math.hypot(x - size / 2, y - size / 2) / (size * 0.5);
      const t = Math.max(0, 1 - d) ** 1.6;
      let rgb = [br + (gr - br) * t, bg + (gg - bg) * t, bb + (gb - bb) * t].map(Math.round);
      const sx = Math.floor((x - off) / scale), sy = Math.floor((y - off) / scale);
      if (sx >= 0 && sy >= 0 && sx < 8 && sy < 8) {
        const ch = rows[sy][sx];
        if (ch !== ".") rgb = hex(pal[ch]);
      }
      raw.set(rgb, row + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(new URL(`../public/${file}`, import.meta.url), png);
  console.log("wrote", file);
}

icon(180, "apple-touch-icon.png");
icon(192, "icon-192.png");
icon(512, "icon-512.png");
icon(64, "favicon.png");
