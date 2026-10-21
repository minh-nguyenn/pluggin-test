// Cắt + phóng to một vùng để xem kỹ, đặt Figma và website cạnh nhau — dùng thay cho việc tự viết script cắt ảnh.
//
//   node crop.mjs --out <file.png> [--zoom 3]
//        --figma <png section Figma> --frect x,y,w,h      (toạ độ trong ảnh section Figma)
//        --site <site.png> --srect x,y,w,h                 (toạ độ tuyệt đối trên trang)
//   Có thể chỉ đưa một bên (--figma hoặc --site).
//   PNG section Figma có sẵn trong <cache>/png/<node-id>.png sau khi chạy run.mjs.
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { load, crop, fit } from '../lib/image.mjs';

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const rect = (s) => s && s.split(',').map(Number);
const zoom = Number(arg('zoom') || 3);
const parts = [];
if (arg('figma') && arg('frect')) { const [x, y, w, h] = rect(arg('frect')); parts.push(crop(load(arg('figma')), x, y, w, h)); }
if (arg('site') && arg('srect')) { const [x, y, w, h] = rect(arg('srect')); parts.push(crop(load(arg('site')), x, y, w, h)); }
if (!parts.length || !arg('out')) { console.error('Cần --out và ít nhất một cặp --figma/--frect hoặc --site/--srect'); process.exit(1); }
const s = Math.min(zoom, 1600 / Math.max(...parts.map((p) => p.width)), 2000 / Math.max(...parts.map((p) => p.height)));
const scaled = parts.map((p) => fit(p, p.width * s, p.height * s, s));
const gap = 8, W = scaled.reduce((t, p) => t + p.width, 0) + gap * (scaled.length + 1), H = Math.max(...scaled.map((p) => p.height)) + gap * 2;
const out = new PNG({ width: W, height: H });
for (let i = 0; i < out.data.length; i += 4) { out.data[i] = 230; out.data[i + 1] = 0; out.data[i + 2] = 120; out.data[i + 3] = 255; }
let x = gap;
for (const p of scaled) { PNG.bitblt(p, out, 0, 0, p.width, p.height, x, gap); x += p.width + gap; }
fs.writeFileSync(arg('out'), PNG.sync.write(out));
console.log(`OK ${arg('out')} (×${s.toFixed(2)})`);
