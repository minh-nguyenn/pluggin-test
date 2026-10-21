// So sánh từng phần tử trong một section: Figma (node) ↔ website (styles.json).
// Không có sai số: mọi chênh lệch ≥ 0.01 đều ghi NG. Việc áp quy tắc (C-xx, R-xx) do AI làm sau khi đọc bảng.
// Kết quả mỗi dòng: { section, kind, figma, site, prop, expected, actual, delta, status: OK|NG|REVIEW, note }

const VECTOR_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'ELLIPSE', 'REGULAR_POLYGON']);
const norm = (s) => (s || '').replace(/[\s　]+/g, ' ').trim();
const key = (s) => (s || '').replace(/[\s　]+/g, '');
const r2 = (n) => Math.round(n * 100) / 100;

function hex(c, a = 1) {
  const h = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  const alpha = (c.a ?? 1) * a;
  return `#${h(c.r)}${h(c.g)}${h(c.b)}${alpha < 0.999 ? h(alpha) : ''}`;
}
function cssHex(s) {
  const m = String(s || '').match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  const h = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}${a < 0.999 ? h(a * 255) : ''}`;
}
const solidFill = (fills) => (fills || []).find((f) => f.visible !== false && f.type === 'SOLID');
const hasImageFill = (fills) => (fills || []).some((f) => f.visible !== false && f.type === 'IMAGE');

/** Làm phẳng cây Figma của section thành danh sách phần tử text / visual / icon, toạ độ tương đối section */
export function flattenFigma(section) {
  const o = section.absoluteBoundingBox;
  const items = [];
  const rel = (b) => b && { x: b.x - o.x, y: b.y - o.y, width: b.width, height: b.height };
  const isIcon = (n) => {
    if (VECTOR_TYPES.has(n.type)) return true;
    if (!n.children?.length) return false;
    return n.children.every((c) => c.visible === false || isIcon(c));
  };
  const walk = (n, depth) => {
    if (!n || n.visible === false) return;
    const box = rel(n.absoluteBoundingBox);
    if (depth > 0 && box) {
      if (n.type === 'TEXT') {
        items.push({ kind: 'text', id: n.id, name: n.name, box, chars: n.characters ?? '', style: n.style ?? {}, fills: n.fills, mixed: Boolean(n.characterStyleOverrides?.some((v) => v)), node: n });
        return;
      }
      if (isIcon(n)) { items.push({ kind: 'icon', id: n.id, name: n.name, box, node: n }); return; }
      const visual = solidFill(n.fills) || hasImageFill(n.fills)
        || (n.strokes || []).some((s) => s.visible !== false) && (n.strokeWeight ?? 0) > 0
        || (n.effects || []).some((e) => e.visible !== false && e.type === 'DROP_SHADOW');
      if (visual) items.push({ kind: hasImageFill(n.fills) ? 'image' : 'box', id: n.id, name: n.name, box, node: n });
    }
    for (const c of n.children || []) walk(c, depth + 1);
  };
  walk(section, 0);
  return items;
}

/** Phần tử website thuộc section, toạ độ tương đối section */
export function siteItems(data, sectionName) {
  const sec = data.sections[sectionName];
  if (!sec || sec.missing) return null;
  const o = sec.rect;
  const rel = (b) => b && { x: b.x - o.x, y: b.y - o.y, width: b.width, height: b.height };
  return data.elements.filter((e) => e.sections.includes(sectionName)).map((e) => ({ ...e, box: rel(e.rect), tbox: rel(e.textBox) }));
}

const iou = (a, b) => {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.width, b.x + b.width), y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const uni = a.width * a.height + b.width * b.height - inter;
  return uni > 0 ? inter / uni : 0;
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Phần tử chứa đúng đoạn chữ: lấy phần tử sâu nhất có fullText khớp, rồi đi lên tới khối (block) gần nhất có cùng chữ */
function textHost(els, byIdx, e) {
  let cur = e;
  while (cur.inline && cur.parent != null && byIdx.get(cur.parent) && key(byIdx.get(cur.parent).fullText) === key(e.fullText)) cur = byIdx.get(cur.parent);
  return cur;
}

export function compareSection(sectionName, figmaSection, data) {
  const rows = [];
  const push = (r) => rows.push({ section: sectionName, ...r });
  const site = siteItems(data, sectionName);
  if (!site) { push({ kind: 'section', prop: 'selector', status: 'REVIEW', note: 'Không tìm thấy section trên website (selector sai hoặc thiếu)' }); return rows; }
  const byIdx = new Map(site.map((e) => [e.i, e]));
  const fig = flattenFigma(figmaSection);
  const sec = data.sections[sectionName].rect;
  const fb = figmaSection.absoluteBoundingBox;
  num(push, { kind: 'section', figma: figmaSection.id, site: data.sections[sectionName].selector }, 'width', fb.width, sec.width);
  num(push, { kind: 'section', figma: figmaSection.id, site: data.sections[sectionName].selector }, 'height', fb.height, sec.height);

  // --- Chữ ---
  const texts = site.filter((e) => e.fullText);
  const usedSite = new Set();
  const figTexts = fig.filter((f) => f.kind === 'text');
  const pending = [];
  for (const f of figTexts) {
    const k = key(f.chars);
    if (!k) continue;
    // phần tử sâu nhất có fullText khớp
    const cands = texts.filter((e) => key(e.fullText) === k && !usedSite.has(e.i))
      .filter((e) => !texts.some((c) => c.parent === e.i && key(c.fullText) === k));
    if (!cands.length) { pending.push(f); continue; }
    // Cùng một chữ có thể xuất hiện nhiều lần → chọn phần tử gần vị trí Figma nhất, chỉ đánh dấu phần tử đó
    const [deep, host] = cands.map((e) => [e, textHost(texts, byIdx, e)]).sort((a, b) => dist(a[1].box, f.box) - dist(b[1].box, f.box))[0];
    usedSite.add(deep.i); usedSite.add(host.i);
    compareText(push, f, host);
  }
  // Chữ Figma không khớp nguyên văn → ghép theo vị trí với chữ website còn lại (nghi sai nội dung)
  const leftovers = texts.filter((e) => e.ownText && !usedSite.has(e.i));
  for (const f of pending) {
    let best = null, bi = 0;
    for (const e of leftovers) { const v = iou(f.box, e.tbox || e.box); if (v > bi) { bi = v; best = e; } }
    if (best && bi > 0.3) {
      usedSite.add(best.i);
      push({ kind: 'text', figma: `${f.id} ${f.name}`, site: desc(best), figBox: f.box, siteBox: best.rect, prop: 'content', expected: norm(f.chars), actual: best.fullText, status: 'NG', note: `Ghép theo vị trí (IoU ${bi.toFixed(2)})` });
      compareText(push, f, textHost(texts, byIdx, best), true);
    } else {
      push({ kind: 'text', figma: `${f.id} ${f.name}`, prop: 'content', expected: norm(f.chars), actual: '(không tìm thấy trên website)', status: 'REVIEW', note: 'Thiếu chữ, hoặc nội dung lấy từ CMS' });
    }
  }
  // Bỏ qua phần tử nằm trong khối chữ đã ghép (vd chữ tách từng ký tự để làm animation)
  const insideUsed = (e) => { for (let p = e.parent; p != null; p = byIdx.get(p)?.parent) if (usedSite.has(p)) return true; return false; };
  for (const e of leftovers.filter((e) => !usedSite.has(e.i) && !insideUsed(e))) {
    push({ kind: 'text', site: desc(e), prop: 'content', expected: '(không có trong Figma)', actual: e.ownText, status: 'REVIEW', note: 'Chữ thừa trên website, hoặc nội dung CMS' });
  }

  // --- Khối, ảnh, icon ---
  const visuals = site.filter((e) => e.hasVisual);
  const usedV = new Set();
  for (const f of fig.filter((x) => x.kind !== 'text')) {
    const pool = f.kind === 'icon' ? visuals.filter((e) => e.tag === 'svg' || e.tag === 'img' || e.style['background-image'] !== 'none')
      : f.kind === 'image' ? visuals.filter((e) => e.tag === 'img' || e.tag === 'picture' || e.tag === 'video' || e.style['background-image'] !== 'none')
      : visuals;
    let best = null, bi = 0;
    for (const e of pool) { if (usedV.has(e.i)) continue; const v = iou(f.box, e.box); if (v > bi) { bi = v; best = e; } }
    if (!best || bi < 0.5) {
      push({ kind: f.kind, figma: `${f.id} ${f.name}`, prop: 'match', expected: box(f.box), actual: best ? `${desc(best)} IoU ${bi.toFixed(2)}` : '(không có)', status: 'REVIEW', note: 'Không ghép được phần tử website' });
      continue;
    }
    usedV.add(best.i);
    const ctx = { kind: f.kind, figma: `${f.id} ${f.name}`, site: desc(best), figBox: f.box, siteBox: best.rect };
    for (const p of ['x', 'y', 'width', 'height']) num(push, ctx, p, f.box[p], best.box[p]);
    if (f.kind === 'box') compareBox(push, ctx, f.node, best);
  }
  return rows;
}

function compareText(push, f, e, already = false) {
  const ctx = { kind: 'text', figma: `${f.id} ${f.name}`, site: desc(e), figBox: f.box, siteBox: e.rect };
  const s = f.style, cs = e.style;
  if (!already && norm(f.chars) !== e.fullText) push({ ...ctx, prop: 'content', expected: norm(f.chars), actual: e.fullText, status: 'NG', note: 'Khác khoảng trắng' });
  if (f.mixed) push({ ...ctx, prop: 'style', status: 'REVIEW', note: 'Đoạn chữ có nhiều style trong Figma — so phần style chính, cần xem tay phần còn lại' });
  num(push, ctx, 'font-size', s.fontSize, parseFloat(cs['font-size']));
  num(push, ctx, 'font-weight', s.fontWeight, parseFloat(cs['font-weight']));
  const lh = cs['line-height'] === 'normal' ? null : parseFloat(cs['line-height']);
  if (s.lineHeightPx != null) {
    if (lh == null) push({ ...ctx, prop: 'line-height', expected: r2(s.lineHeightPx), actual: 'normal', status: 'REVIEW', note: 'C-03' });
    else num(push, ctx, 'line-height', s.lineHeightPx, lh, 'C-03');
  }
  num(push, ctx, 'letter-spacing', s.letterSpacing ?? 0, cs['letter-spacing'] === 'normal' ? 0 : parseFloat(cs['letter-spacing']));
  const fam = (cs['font-family'] || '').split(',').map((x) => x.trim().replace(/^["']|["']$/g, ''));
  if (s.fontFamily) {
    const ok = fam.some((x) => x.toLowerCase() === s.fontFamily.toLowerCase());
    push({ ...ctx, prop: 'font-family', expected: s.fontFamily, actual: fam.join(', '), status: ok ? (fam[0].toLowerCase() === s.fontFamily.toLowerCase() ? 'OK' : 'REVIEW') : 'NG', note: ok && fam[0].toLowerCase() !== s.fontFamily.toLowerCase() ? 'Có trong font stack nhưng không đứng đầu' : '' });
  }
  const fill = solidFill(f.fills);
  if (fill) str(push, ctx, 'color', hex(fill.color, fill.opacity ?? 1), cssHex(cs.color));
  const align = { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify' }[s.textAlignHorizontal];
  if (align) str(push, ctx, 'text-align', align, ({ start: 'left', end: 'right' })[cs['text-align']] ?? cs['text-align']);
  // Vị trí: chữ tự co giãn (WIDTH_AND_HEIGHT) → so hộp chữ thật; chữ có độ rộng cố định → so khối chứa
  const auto = s.textAutoResize === 'WIDTH_AND_HEIGHT';
  const xb = auto && e.tbox ? e.tbox : e.box;
  num(push, ctx, 'x', f.box.x, xb.x);
  num(push, ctx, 'y', f.box.y, e.box.y);
  if (auto) num(push, ctx, 'width', f.box.width, xb.width);
  num(push, ctx, 'height', f.box.height, e.box.height, 'Chiều cao khối chữ = số dòng × line-height');
}

function compareBox(push, ctx, n, e) {
  const cs = e.style;
  const fill = solidFill(n.fills);
  if (fill) str(push, ctx, 'background-color', hex(fill.color, fill.opacity ?? 1), cssHex(cs['background-color']));
  const radii = n.rectangleCornerRadii ?? (n.cornerRadius != null ? [n.cornerRadius, n.cornerRadius, n.cornerRadius, n.cornerRadius] : [0, 0, 0, 0]);
  const cssR = ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'].map((p) => parseFloat(cs[p]) || 0);
  // Bo góc lớn hơn nửa cạnh ngắn được trình duyệt/Figma vẽ như nửa cạnh ngắn → so giá trị hiển thị thật
  const fMax = Math.min(n.absoluteBoundingBox.width, n.absoluteBoundingBox.height) / 2;
  const sMax = Math.min(e.box.width, e.box.height) / 2;
  radii.forEach((v, i) => num(push, ctx, ['radius-tl', 'radius-tr', 'radius-br', 'radius-bl'][i], Math.min(v, fMax), Math.min(cssR[i], sMax)));
  const stroke = (n.strokes || []).find((s) => s.visible !== false && s.type === 'SOLID');
  if (stroke && n.strokeWeight > 0) {
    num(push, ctx, 'border-width', n.strokeWeight, parseFloat(cs['border-top-width']) || parseFloat(cs['border-bottom-width']) || 0, n.strokeAlign && n.strokeAlign !== 'INSIDE' ? `Figma stroke ${n.strokeAlign}` : '');
    str(push, ctx, 'border-color', hex(stroke.color, stroke.opacity ?? 1), cssHex(cs['border-top-color']));
  }
  const sh = (n.effects || []).find((x) => x.visible !== false && x.type === 'DROP_SHADOW');
  if (sh) str(push, ctx, 'box-shadow', `${hex(sh.color)} ${sh.offset.x}px ${sh.offset.y}px ${sh.radius}px ${sh.spread ?? 0}px`, shadow(cs['box-shadow']));
  if ((n.opacity ?? 1) < 1) num(push, ctx, 'opacity', n.opacity, parseFloat(cs.opacity));
}

function shadow(v) {
  if (!v || v === 'none') return 'none';
  const m = v.match(/(rgba?\([^)]+\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?/);
  return m ? `${cssHex(m[1])} ${+m[2]}px ${+m[3]}px ${+m[4]}px ${+(m[5] ?? 0)}px` : v;
}

function num(push, ctx, prop, expected, actual, note = '') {
  if (expected == null || actual == null || Number.isNaN(actual)) return;
  const d = r2(actual - expected);
  push({ ...ctx, prop, expected: r2(expected), actual: r2(actual), delta: d, status: Math.abs(d) < 0.01 ? 'OK' : 'NG', note });
}
function str(push, ctx, prop, expected, actual, note = '') {
  if (expected == null || actual == null) return;
  push({ ...ctx, prop, expected, actual, status: String(expected).toLowerCase() === String(actual).toLowerCase() ? 'OK' : 'NG', note });
}
const box = (b) => `${r2(b.x)},${r2(b.y)} ${r2(b.width)}×${r2(b.height)}`;
const desc = (e) => `${e.tag}${e.cls ? '.' + e.cls.split(/\s+/).slice(0, 2).join('.') : ''}#${e.i}`;
