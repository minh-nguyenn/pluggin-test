// Ảnh đối chiếu cho các dòng NG: [Figma | website] mỗi dòng một phần tử, chỉ vùng lệch.
import fs from 'node:fs';
import { PNG } from 'pngjs';

const load = (f) => PNG.sync.read(fs.readFileSync(f));

function crop(img, x, y, w, h) {
  x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y));
  w = Math.max(1, Math.min(Math.ceil(w), img.width - x)); h = Math.max(1, Math.min(Math.ceil(h), img.height - y));
  const out = new PNG({ width: w, height: h });
  for (let r = 0; r < h; r++) img.data.copy(out.data, r * w * 4, ((y + r) * img.width + x) * 4, ((y + r) * img.width + x + w) * 4);
  return out;
}

function fit(img, maxW, maxH) {
  const s = Math.min(1, maxW / img.width, maxH / img.height);
  if (s === 1) return img;
  const w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(img.width - 1, Math.floor(x / s)), sy = Math.min(img.height - 1, Math.floor(y / s));
    img.data.copy(out.data, (y * w + x) * 4, (sy * img.width + sx) * 4, (sy * img.width + sx) * 4 + 4);
  }
  return out;
}

/**
 * pairs: [{ figBox (tương đối section), siteBox (tuyệt đối trang) }]
 * figmaPng: ảnh PNG của section Figma; sitePng: ảnh toàn trang website
 */
export function reviewSheet(pairs, figmaPng, sitePng, outFile, { pad = 16, maxW = 560, maxH = 260, gap = 8 } = {}) {
  if (!pairs.length) return null;
  const F = load(figmaPng), S = load(sitePng);
  const rows = pairs.map(({ figBox, siteBox }) => {
    const a = fit(crop(F, figBox.x - pad, figBox.y - pad, figBox.width + pad * 2, figBox.height + pad * 2), maxW, maxH);
    const b = fit(crop(S, siteBox.x - pad, siteBox.y - pad, siteBox.width + pad * 2, siteBox.height + pad * 2), maxW, maxH);
    return [a, b];
  });
  const W = maxW * 2 + gap * 3, H = rows.reduce((s, [a, b]) => s + Math.max(a.height, b.height) + gap, gap);
  const out = new PNG({ width: W, height: H });
  out.data.fill(255);
  for (let i = 0; i < out.data.length; i += 4) { out.data[i] = 230; out.data[i + 1] = 0; out.data[i + 2] = 120; } // nền hồng để thấy mép
  let y = gap;
  for (const [a, b] of rows) {
    PNG.bitblt(a, out, 0, 0, a.width, a.height, gap, y);
    PNG.bitblt(b, out, 0, 0, b.width, b.height, gap * 2 + maxW, y);
    y += Math.max(a.height, b.height) + gap;
  }
  fs.writeFileSync(outFile, PNG.sync.write(out));
  return outFile;
}
