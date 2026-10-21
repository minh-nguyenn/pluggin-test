// In giá trị chính xác của các node Figma (để kiểm chứng / so tay) — đọc từ cache của run.mjs, thiếu thì gọi API.
//
//   node figma-values.mjs --cache <figma-cache> --nodes 7290:51760,I11103:57096;11956:53104 [--file <fileKey>]
//
// Mỗi node: loại, tên, toạ độ (so với frame trang chứa nó), kích thước, chữ + style (font, cỡ, độ đậm, line-height,
// letter-spacing, textCase), màu fill, viền, bo góc, shadow, opacity.
import fs from 'node:fs';
import path from 'node:path';
import { fetchNodes, normId } from '../lib/figma.mjs';

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
if (!arg('nodes')) { console.error('Cần --nodes id1,id2 (và --cache hoặc --file)'); process.exit(1); }
const ids = arg('nodes').split(',').map((s) => normId(s.trim()));

// Tìm node trong mọi file cache; nhớ frame gốc (node cấp cao nhất của file cache) để tính toạ độ trang
const roots = [];
if (arg('cache') && fs.existsSync(arg('cache'))) {
  for (const f of fs.readdirSync(arg('cache')).filter((x) => x.startsWith('nodes-'))) {
    const j = JSON.parse(fs.readFileSync(path.join(arg('cache'), f), 'utf8'));
    for (const doc of Object.values(j.nodes)) if (doc) roots.push({ doc, meta: j.meta });
  }
}
const find = (id) => {
  for (const r of roots) {
    const stack = [r.doc];
    while (stack.length) { const n = stack.pop(); if (n.id === id) return { n, frame: r.doc, meta: r.meta }; if (n.children) stack.push(...n.children); }
  }
  return null;
};
const missing = ids.filter((id) => !find(id));
if (missing.length) {
  if (!arg('file')) { console.error(`Không có trong cache: ${missing.join(', ')} — thêm --file <fileKey> để gọi API`); process.exit(2); }
  const res = await fetchNodes(arg('file'), missing, null, { refresh: true });
  for (const doc of Object.values(res.nodes)) if (doc) roots.push({ doc, meta: res.meta });
}

const h = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
const hex = (c, a = 1) => `#${h(c.r)}${h(c.g)}${h(c.b)}${(c.a ?? 1) * a < 0.999 ? h((c.a ?? 1) * a) : ''}`;
const r2 = (n) => Math.round(n * 100) / 100;
for (const id of ids) {
  const hit = find(id);
  if (!hit) { console.log(`${id}: không tìm thấy`); continue; }
  const { n, frame } = hit, b = n.absoluteBoundingBox, fb = frame.absoluteBoundingBox;
  const out = { id: n.id, type: n.type, name: n.name, frame: `${frame.id} ${frame.name}`,
    pos: b && { x: r2(b.x - fb.x), y: r2(b.y - fb.y), width: r2(b.width), height: r2(b.height) } };
  if (n.type === 'TEXT') {
    const s = n.style || {};
    out.text = n.characters;
    out.style = { fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeightPx: s.lineHeightPx, letterSpacing: s.letterSpacing, textCase: s.textCase, textAlign: s.textAlignHorizontal, autoResize: s.textAutoResize };
    if (n.characterStyleOverrides?.some((v) => v)) out.mixedStyles = n.styleOverrideTable;
  }
  const fill = (n.fills || []).filter((f) => f.visible !== false).map((f) => (f.type === 'SOLID' ? hex(f.color, f.opacity ?? 1) : f.type));
  if (fill.length) out.fills = fill;
  const st = (n.strokes || []).filter((s) => s.visible !== false && s.type === 'SOLID');
  if (st.length) out.stroke = { color: hex(st[0].color, st[0].opacity ?? 1), weight: n.individualStrokeWeights ?? n.strokeWeight, align: n.strokeAlign };
  if (n.cornerRadius || n.rectangleCornerRadii) out.radius = n.rectangleCornerRadii ?? n.cornerRadius;
  const fx = (n.effects || []).filter((e) => e.visible !== false);
  if (fx.length) out.effects = fx.map((e) => `${e.type} ${e.color ? hex(e.color) : ''} ${e.offset ? `${e.offset.x},${e.offset.y}` : ''} r${e.radius ?? ''} s${e.spread ?? 0}`);
  if ((n.opacity ?? 1) < 1) out.opacity = n.opacity;
  if (n.layoutMode) out.autoLayout = { mode: n.layoutMode, padding: [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft], gap: n.itemSpacing };
  console.log(JSON.stringify(out));
}
