// 生成 Tauri 应用图标（无需外部依赖，纯 Node 实现）。
// 设计：紫色渐变背景 + 白色圆角面板 + 三条 prompt 列表线条。
// 用法：node scripts/gen-icons.mjs   （也可 pnpm icons）
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src-tauri/icons"
);

/* ---------- CRC32 ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ---------- PNG 编码 ---------- */
function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * size * 4, y * size * 4 + size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- 绘图 ---------- */
const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

// 点到圆角矩形的覆盖率（带简单抗锯齿）
function roundRectCoverage(px, py, x0, y0, x1, y1, rad) {
  const halfW = (x1 - x0) / 2;
  const halfH = (y1 - y0) / 2;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const dx = Math.max(Math.abs(px - cx) - (halfW - rad), 0);
  const dy = Math.max(Math.abs(py - cy) - (halfH - rad), 0);
  const dist = Math.sqrt(dx * dx + dy * dy) - rad;
  return Math.min(Math.max(0.5 - dist, 0), 1);
}

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const bgTop = hex("#7c6cff");
  const bgBottom = hex("#a855f7");

  // macOS 图标网格：四周留白 + 居中的圆角方“身体”
  const margin = size * 0.098; // 约 100/1024
  const bx0 = margin;
  const by0 = margin;
  const bx1 = size - margin;
  const by1 = size - margin;
  const bw = bx1 - bx0;
  const bodyRadius = bw * 0.225; // 接近 macOS squircle 圆角

  // 白色面板（相对 body 定位）
  const px0 = bx0 + bw * 0.2;
  const px1 = bx1 - bw * 0.2;
  const py0 = by0 + bw * 0.255;
  const py1 = by1 - bw * 0.255;
  const panelRadius = bw * 0.1;
  const panelH = py1 - py0;
  const panelW = px1 - px0;

  // 三条列表线（相对 panel 定位）
  const lineColors = [hex("#7c6cff"), hex("#a855f7"), hex("#c7b8ff")];
  const lineWidths = [0.66, 0.84, 0.44];
  const lineH = panelH * 0.15;
  const gap = panelH * 0.13;
  const linesTop = py0 + panelH * 0.145;
  const lx0 = px0 + panelW * 0.16;
  const lineAreaW = panelW * 0.68;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const fx = x + 0.5;
      const fy = y + 0.5;

      // 圆角方身体的覆盖率（决定透明边距）
      const bodyCov = roundRectCoverage(
        fx,
        fy,
        bx0,
        by0,
        bx1,
        by1,
        bodyRadius
      );
      if (bodyCov <= 0) {
        buf[i] = 0;
        buf[i + 1] = 0;
        buf[i + 2] = 0;
        buf[i + 3] = 0;
        continue;
      }

      // 渐变背景
      const t = (x + y) / (2 * size);
      let r = lerp(bgTop[0], bgBottom[0], t);
      let g = lerp(bgTop[1], bgBottom[1], t);
      let b = lerp(bgTop[2], bgBottom[2], t);

      // 白色面板
      const panelCov = roundRectCoverage(
        fx,
        fy,
        px0,
        py0,
        px1,
        py1,
        panelRadius
      );
      if (panelCov > 0) {
        r = lerp(r, 255, panelCov * 0.97);
        g = lerp(g, 255, panelCov * 0.97);
        b = lerp(b, 255, panelCov * 0.97);
      }

      // 三条列表线
      for (let k = 0; k < 3; k++) {
        const ly0 = linesTop + k * (lineH + gap);
        const ly1 = ly0 + lineH;
        const lx1 = lx0 + lineAreaW * lineWidths[k];
        const cov = roundRectCoverage(fx, fy, lx0, ly0, lx1, ly1, lineH / 2);
        if (cov > 0) {
          const c = lineColors[k];
          r = lerp(r, c[0], cov);
          g = lerp(g, c[1], cov);
          b = lerp(b, c[2], cov);
        }
      }

      buf[i] = clamp255(r);
      buf[i + 1] = clamp255(g);
      buf[i + 2] = clamp255(b);
      buf[i + 3] = clamp255(bodyCov * 255);
    }
  }
  return buf;
}

const pngCache = new Map();
function pngOf(size) {
  if (!pngCache.has(size)) pngCache.set(size, encodePng(size, drawIcon(size)));
  return pngCache.get(size);
}

/* ---------- ICO ---------- */
function buildIco(png256) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = 0; // width 256 -> 0
  entry[1] = 0; // height 256 -> 0
  entry[2] = 0; // color count
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bit count
  entry.writeUInt32LE(png256.length, 8);
  entry.writeUInt32LE(6 + 16, 12); // offset
  return Buffer.concat([header, entry, png256]);
}

/* ---------- ICNS ---------- */
function icnsEntry(type, png) {
  const head = Buffer.alloc(8);
  head.write(type, 0, "ascii");
  head.writeUInt32BE(png.length + 8, 4);
  return Buffer.concat([head, png]);
}
function buildIcns() {
  // OSType -> 像素尺寸（均为 PNG 数据）
  const map = [
    ["ic11", 32],
    ["ic12", 64],
    ["ic07", 128],
    ["ic08", 256],
    ["ic09", 512],
    ["ic10", 1024],
  ];
  const body = Buffer.concat(map.map(([t, s]) => icnsEntry(t, pngOf(s))));
  const head = Buffer.alloc(8);
  head.write("icns", 0, "ascii");
  head.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([head, body]);
}

/* ---------- 输出 ---------- */
fs.mkdirSync(OUT_DIR, { recursive: true });
const write = (name, buf) => {
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
  console.log(`  ✓ ${name} (${buf.length} bytes)`);
};

console.log(`生成图标到 ${OUT_DIR}`);
write("32x32.png", pngOf(32));
write("128x128.png", pngOf(128));
write("128x128@2x.png", pngOf(256));
write("icon.png", pngOf(512));
write("icon.ico", buildIco(pngOf(256)));
write("icon.icns", buildIcns());
console.log("图标生成完成。");
