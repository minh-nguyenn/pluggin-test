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
 * So ảnh chồng cả section (tín hiệu độc lập, không qua AI): Figma PNG ↔ vùng tương ứng trên ảnh website.
 * So theo khối block×block px (màu trung bình) để bỏ nhiễu khử răng cưa / nén ảnh; gom khối khác nhau thành vùng.
 * Vùng nằm trong hộp phần tử đã so số liệu (chữ, ảnh) coi là đã được giải thích → bỏ.
 * Trả: { regions: [{x,y,width,height (toạ độ trong section Figma), score}], file }
 *   siteOrigin: {x, y} — điểm trên ảnh website ứng với góc trên-trái section Figma
 *   explained: hộp (toạ độ section Figma) của các phần tử đã so
 */
export function overlayDiff(figmaPng, sitePng, siteOrigin, explained, outFile, { block = 8, threshold = 40, minBlocks = 3, images = [], imageThreshold = 70 } = {}) {
  const F = load(figmaPng), S = load(sitePng);
  const W = F.width, H = Math.min(F.height, S.height - Math.max(0, Math.floor(siteOrigin.y)));
  if (H <= 0) return { regions: [], file: null };
  const site = crop(S, siteOrigin.x, siteOrigin.y, W, H);
  const bw = Math.ceil(W / block), bh = Math.ceil(H / block);
  const avg = (img, bx, by) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = by * block; y < Math.min(img.height, (by + 1) * block); y++) for (let x = bx * block; x < Math.min(img.width, (bx + 1) * block); x++) {
      const i = (y * img.width + x) * 4, a = img.data[i + 3] / 255;
      r += img.data[i] * a + 255 * (1 - a); g += img.data[i + 1] * a + 255 * (1 - a); b += img.data[i + 2] * a + 255 * (1 - a); n++;
    }
    return n ? [r / n, g / n, b / n] : [255, 255, 255];
  };
  const inExplained = (x, y) => explained.some((e) => x >= e.x - 2 && x <= e.x + e.width + 2 && y >= e.y - 2 && y <= e.y + e.height + 2);
  const diff = new Uint8Array(bw * bh);
  const score = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    const a = avg(F, bx, by), b = avg(site, bx, by);
    const d = (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3;
    const cx = bx * block + block / 2, cy = by * block + block / 2;
    // Trong ảnh: chỉ báo khi khác rất mạnh (sai ảnh), bỏ khác nhẹ do nén (C-04)
    const inImage = images.some((e) => cx >= e.x && cx <= e.x + e.width && cy >= e.y && cy <= e.y + e.height);
    if (d >= (inImage ? imageThreshold : threshold) && !inExplained(cx, cy)) { diff[by * bw + bx] = 1; score[by * bw + bx] = d; }
  }
  // Gom khối liền kề thành vùng
  const seen = new Uint8Array(bw * bh), regions = [];
  for (let i = 0; i < diff.length; i++) {
    if (!diff[i] || seen[i]) continue;
    const q = [i]; seen[i] = 1; let x1 = Infinity, y1 = Infinity, x2 = -1, y2 = -1, n = 0, s = 0;
    while (q.length) {
      const k = q.pop(), x = k % bw, y = (k / bw) | 0; n++; s += score[k];
      x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = x + dx, ny = y + dy, j = ny * bw + nx;
        if (nx >= 0 && ny >= 0 && nx < bw && ny < bh && diff[j] && !seen[j]) { seen[j] = 1; q.push(j); }
      }
    }
    if (n >= minBlocks) regions.push({ x: x1 * block, y: y1 * block, width: (x2 - x1 + 1) * block, height: (y2 - y1 + 1) * block, blocks: n, score: Math.round(s / n) });
  }
  regions.sort((a, b) => b.blocks * b.score - a.blocks * a.score);
  if (!regions.length) return { regions, file: null };
  // Ảnh: [Figma | website], vùng khác tô viền hồng
  const out = new PNG({ width: W * 2 + 8, height: H });
  out.data.fill(255);
  PNG.bitblt(F, out, 0, 0, W, Math.min(H, F.height), 0, 0);
  PNG.bitblt(site, out, 0, 0, W, H, W + 8, 0);
  const mark = (ox, r) => {
    for (let x = r.x; x < r.x + r.width; x++) for (const y of [r.y, r.y + 1, r.y + r.height - 2, r.y + r.height - 1]) put(ox + x, y);
    for (let y = r.y; y < r.y + r.height; y++) for (const x of [r.x, r.x + 1, r.x + r.width - 2, r.x + r.width - 1]) put(ox + x, y);
  };
  const put = (x, y) => { if (x < 0 || y < 0 || x >= out.width || y >= out.height) return; const i = (y * out.width + x) * 4; out.data[i] = 230; out.data[i + 1] = 0; out.data[i + 2] = 120; out.data[i + 3] = 255; };
  for (const r of regions) { mark(0, r); mark(W + 8, r); }
  fs.writeFileSync(outFile, PNG.sync.write(fit(out, 2400, 4000)));
  return { regions, file: outFile };
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
