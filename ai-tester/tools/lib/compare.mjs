// So sánh từng phần tử trong một section: Figma (node) ↔ website (styles.json).
// Không có sai số: mọi chênh lệch ≥ 0.01 đều ghi NG. Việc áp quy tắc (C-xx, R-xx) do AI làm sau khi đọc bảng.
//
// Hệ toạ độ: x tính từ mép trái trang (viewport = width frame Figma nên so trực tiếp được);
// y tính từ mép trên section. Lệch chung của cả section (vd khoảng cách giữa các section khác Figma,
// hoặc selector bao thêm padding) được tính bằng trung vị, báo MỘT dòng, rồi trừ trước khi so từng phần tử
// — để các dòng NG còn lại là lệch thật bên trong section.
//
// Mỗi dòng: { section, kind, figma, site, prop, expected, actual, delta, status: OK|NG|REVIEW, note, figBox, siteBox }
//   figBox: toạ độ trong ảnh PNG của section Figma (để cắt ảnh); siteBox: toạ độ tuyệt đối trên trang.

const VECTOR_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'ELLIPSE', 'REGULAR_POLYGON']);
const TEXT_CASE = { UPPER: 'uppercase', LOWER: 'lowercase', TITLE: 'capitalize', ORIGINAL: 'none' };
const key = (s) => (s || '').replace(/[\s　]+/g, '');
const lines = (s) => (s || '').replace(/\r/g, '').split('\n').map((l) => l.replace(/[ \t　]+/g, ' ').trim()).filter(Boolean).join('\n');
const r2 = (n) => Math.round(n * 100) / 100;
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

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

/** Làm phẳng cây Figma của section: text / box / image / icon. pos = {x: từ mép frame, y: từ mép section}; crop = trong PNG section */
export function flattenFigma(section, frameBox) {
  const so = section.absoluteBoundingBox;
  const fx = frameBox ? frameBox.x : so.x;
  const items = [];
  const isIcon = (n) => {
    if (VECTOR_TYPES.has(n.type)) return n.absoluteBoundingBox?.width > 0 && n.absoluteBoundingBox?.height > 0;
    if (!n.children?.length) return false;
    return n.children.every((c) => c.visible === false || isIcon(c));
  };
  const walk = (n, depth) => {
    if (!n || n.visible === false) return;
    let b = n.absoluteBoundingBox;
    if (depth > 0 && b) {
      // Đường kẻ (LINE / vector dẹt) → khối mỏng có độ dày = stroke, so như một khối (divider)
      const flat = n.type === 'LINE' || (VECTOR_TYPES.has(n.type) && (b.width === 0 || b.height === 0));
      if (flat) {
        const t = n.strokeWeight || 1;
        b = b.height === 0 ? { ...b, height: t } : b.width === 0 ? { ...b, width: t } : b;
        const pos = { x: b.x - fx, y: b.y - so.y, width: b.width, height: b.height };
        items.push({ id: n.id, name: n.name, pos, crop: { x: b.x - so.x, y: b.y - so.y, width: b.width, height: b.height }, node: n, kind: 'line' });
        return;
      }
      const pos = { x: b.x - fx, y: b.y - so.y, width: b.width, height: b.height };
      const crop = { x: b.x - so.x, y: b.y - so.y, width: b.width, height: b.height };
      const base = { id: n.id, name: n.name, pos, crop, node: n };
      if (n.type === 'TEXT') {
        // Chữ nhiều style: lấy style chiếm nhiều ký tự nhất (base + override), không mặc định lấy style gốc
        const ov = n.characterStyleOverrides || [];
        const mixed = ov.some((v) => v);
        let style = n.style ?? {}, fills = n.fills;
        if (mixed) {
          const count = new Map();
          const len = (n.characters ?? '').length;
          for (let i = 0; i < len; i++) { const k = ov[i] ?? 0; count.set(k, (count.get(k) || 0) + 1); }
          const dom = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
          const o = dom ? n.styleOverrideTable?.[dom] : null;
          if (o) { style = { ...style, ...o }; if (o.fills) fills = o.fills; }
        }
        items.push({ ...base, kind: 'text', chars: n.characters ?? '', style, fills, mixed });
        return;
      }
      if (isIcon(n)) { items.push({ ...base, kind: 'icon' }); return; }
      const visual = solidFill(n.fills) || hasImageFill(n.fills)
        || ((n.strokes || []).some((s) => s.visible !== false) && (n.strokeWeight ?? 0) > 0)
        || (n.effects || []).some((e) => e.visible !== false && e.type === 'DROP_SHADOW');
      if (visual) items.push({ ...base, kind: hasImageFill(n.fills) ? 'image' : 'box' });
    }
    for (const c of n.children || []) walk(c, depth + 1);
  };
  walk(section, 0);
  return items;
}

/** Phần tử website thuộc section: pos = {x: từ mép trang, y: từ mép section} */
export function siteItems(data, sectionName) {
  const sec = data.sections[sectionName];
  if (!sec || sec.missing) return null;
  const sy = sec.rect.y;
  const pos = (b) => b && { x: b.x, y: b.y - sy, width: b.width, height: b.height };
  return data.elements.filter((e) => e.sections.includes(sectionName)).map((e) => ({ ...e, pos: pos(e.rect), tpos: pos(e.textBox) }));
}

const iou = (a, b) => {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.width, b.x + b.width), y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const uni = a.width * a.height + b.width * b.height - inter;
  return uni > 0 ? inter / uni : 0;
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const shift = (b, o) => ({ ...b, x: b.x + o.x, y: b.y + o.y });

const pad = (e) => ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'].reduce((s, p) => s + (parseFloat(e.style[p]) || 0), 0);
/**
 * Phần tử đại diện cho khối chữ: đi lên qua các thẻ inline tới khối chữ "trơn" (không nền/viền/padding) có cùng nội dung.
 * Không đi lên nút/nhãn có padding — khi đó giữ phần tử inline và so theo tâm chữ.
 */
function textHost(byIdx, e) {
  let cur = e;
  while (cur.inline && cur.parent != null) {
    const p = byIdx.get(cur.parent);
    if (!p || key(p.fullText) !== key(e.fullText) || p.hasVisual || pad(p) > 0) break;
    cur = p;
  }
  return cur;
}

export function compareSection(sectionName, figmaSection, data, frameBox, { dynamic = false } = {}) {
  const rows = [];
  // Section nội dung động (CMS): khác nội dung so với Figma là bình thường → REVIEW, không NG
  const push = (r) => rows.push({ section: sectionName, ...r, ...(dynamic && r.prop === 'content' && r.status === 'NG' ? { status: 'REVIEW', note: `Nội dung CMS. ${r.note ?? ''}` } : {}) });
  const site = siteItems(data, sectionName);
  if (!site) { push({ kind: 'section', prop: 'selector', status: 'REVIEW', note: 'Không tìm thấy section trên website (selector sai hoặc thiếu)' }); return rows; }
  const byIdx = new Map(site.map((e) => [e.i, e]));
  const fig = flattenFigma(figmaSection, frameBox);
  const secCtx = { kind: 'section', figma: figmaSection.id, site: data.sections[sectionName].selector };
  const fb = figmaSection.absoluteBoundingBox, sb = data.sections[sectionName].rect;
  num(push, secCtx, 'width', fb.width, sb.width, 'Khung section phụ thuộc selector (có thể bao cả padding)');
  num(push, secCtx, 'height', fb.height, sb.height, 'Khung section phụ thuộc selector (có thể bao cả padding)');

  // --- Lượt 1: ghép chữ theo nội dung (không phụ thuộc vị trí) ---
  const texts = site.filter((e) => e.fullText);
  const usedSite = new Set();
  const pairs = [];
  const pending = [];
  for (const f of fig.filter((x) => x.kind === 'text')) {
    const k = key(f.chars);
    if (!k) continue;
    const cands = texts.filter((e) => key(e.fullText) === k && !usedSite.has(e.i))
      .filter((e) => !texts.some((c) => c.parent === e.i && key(c.fullText) === k));
    if (!cands.length) { pending.push(f); continue; }
    pairs.push({ f, cands });
  }
  // Lệch chung theo y (trung vị) từ các cặp chữ chắc chắn: một ứng viên, khối chứa không inline.
  // x KHÔNG chuẩn hoá: viewport = width frame Figma nên x so trực tiếp theo mép trang.
  const sure = pairs.filter((p) => p.cands.length === 1).map((p) => ({ f: p.f, e: textHost(byIdx, p.cands[0]) })).filter(({ e }) => !e.inline);
  const off = { x: 0, y: sure.length >= 2 ? median(sure.map(({ f, e }) => e.pos.y - f.pos.y)) : 0 };
  if (sure.length >= 2) {
    const d = r2(off.y);
    push({ ...secCtx, prop: 'lệch chung y', expected: 0, actual: d, delta: d, status: Math.abs(d) < 0.01 ? 'OK' : 'NG',
      note: `Trung vị từ ${sure.length} cặp chữ. Khác 0 → khoảng cách phía trên section lệch (hoặc selector bao thêm padding); y từng phần tử bên dưới đã trừ lệch chung này` });
  }

  // So từng cặp chữ (chọn ứng viên gần vị trí Figma nhất sau khi trừ lệch chung)
  for (const { f, cands } of pairs) {
    const free = cands.filter((e) => !usedSite.has(e.i));
    if (!free.length) { pending.push(f); continue; }
    const [deep, host] = free.map((e) => [e, textHost(byIdx, e)]).sort((a, b) => dist(a[1].pos, shift(f.pos, off)) - dist(b[1].pos, shift(f.pos, off)))[0];
    usedSite.add(deep.i); usedSite.add(host.i);
    compareText(push, f, host, off, false, styleSource(byIdx, site, deep));
  }
  // Chữ Figma không khớp nguyên văn → ghép theo vị trí (nghi sai nội dung)
  const leftovers = texts.filter((e) => e.ownText && !usedSite.has(e.i));
  for (const f of pending) {
    let best = null, bi = 0;
    for (const e of leftovers) { if (usedSite.has(e.i)) continue; const v = iou(shift(f.pos, off), e.tpos || e.pos); if (v > bi) { bi = v; best = e; } }
    if (best && bi > 0.3) {
      usedSite.add(best.i);
      const host = textHost(byIdx, best);
      push({ kind: 'text', figma: `${f.id} ${f.name}`, site: desc(host), figBox: f.crop, siteBox: host.rect, prop: 'content', expected: lines(f.chars), actual: host.text, status: 'NG', note: `Ghép theo vị trí (IoU ${bi.toFixed(2)})` });
      compareText(push, f, host, off, true, styleSource(byIdx, site, best));
    } else {
      push({ kind: 'text', figma: `${f.id} ${f.name}`, prop: 'content', expected: lines(f.chars), actual: '(không tìm thấy trên website)', status: 'REVIEW', note: 'Thiếu chữ, hoặc nội dung lấy từ CMS' });
    }
  }
  const insideUsed = (e) => { for (let p = e.parent; p != null; p = byIdx.get(p)?.parent) if (usedSite.has(p)) return true; return false; };
  for (const e of leftovers.filter((e) => !usedSite.has(e.i) && !insideUsed(e))) {
    push({ kind: 'text', site: desc(e), prop: 'content', expected: '(không có trong Figma)', actual: e.ownText, status: 'REVIEW', note: 'Chữ thừa trên website, hoặc nội dung CMS' });
  }

  // --- Khối, đường kẻ, ảnh, icon: ghép theo vị trí (đã trừ lệch chung y) ---
  const visuals = site.filter((e) => e.hasVisual);
  const usedV = new Set();
  const center = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  const similarSize = (a, b) => a.width > 0 && a.height > 0 && b.width / a.width < 2 && b.width / a.width > 0.5 && b.height / a.height < 2 && b.height / a.height > 0.5;
  for (const f of fig.filter((x) => x.kind !== 'text')) {
    const pool = f.kind === 'icon' ? visuals.filter((e) => e.tag === 'svg' || e.tag === 'img' || e.style['background-image'] !== 'none')
      : f.kind === 'image' ? visuals.filter((e) => e.tag === 'img' || e.tag === 'picture' || e.tag === 'video' || e.style['background-image'] !== 'none')
      : visuals;
    const target = shift(f.pos, off);
    let best = null, bi = 0;
    if (f.kind === 'line') {
      // Đường kẻ: phần tử có viền / nền mỏng trùng vị trí (cùng mép trên hoặc dưới, chồng theo chiều dài)
      for (const e of pool) {
        if (usedV.has(e.i)) continue;
        const edges = [e.pos.y, e.pos.y + e.pos.height - (parseFloat(e.style['border-bottom-width']) || 0)];
        const nearEdge = edges.some((y) => Math.abs(y - target.y) <= 2);
        const overlap = Math.min(e.pos.x + e.pos.width, target.x + target.width) - Math.max(e.pos.x, target.x);
        const v = nearEdge ? overlap / Math.max(e.pos.width, target.width) : 0;
        if (v > bi) { bi = v; best = e; }
      }
      if (!best || bi < 0.8) { push({ kind: 'line', figma: `${f.id} ${f.name}`, prop: 'match', expected: box(f.pos), actual: '(không có)', status: 'REVIEW', note: 'Không tìm thấy đường kẻ tương ứng (có thể vẽ bằng ::before/::after)' }); continue; }
      usedV.add(best.i);
      const ctx = { kind: 'line', figma: `${f.id} ${f.name}`, site: desc(best), figBox: f.crop, siteBox: best.rect };
      num(push, ctx, 'x', f.pos.x, best.pos.x);
      num(push, ctx, 'width', f.pos.width, best.pos.width);
      const st = (f.node.strokes || []).find((s) => s.visible !== false && s.type === 'SOLID');
      const bw = ['top', 'bottom', 'left', 'right'].find((sd) => parseFloat(best.style[`border-${sd}-width`]) > 0);
      if (st) str(push, ctx, 'màu đường kẻ', hex(st.color, st.opacity ?? 1), bw ? cssHex(best.style[`border-${bw}-color`] ?? best.style['border-top-color']) : cssHex(best.style['background-color']));
      continue;
    }
    for (const e of pool) { if (usedV.has(e.i)) continue; const v = iou(target, e.pos); if (v > bi) { bi = v; best = e; } }
    // icon nhỏ: IoU nhạy với lệch vài px → cho phép ghép theo khoảng cách tâm nếu gần và cùng cỡ
    if ((!best || bi < 0.5) && f.kind === 'icon') {
      const near = pool.filter((e) => !usedV.has(e.i) && similarSize(f.pos, e.pos)).map((e) => [e, dist(center(e.pos), center(target))]).sort((a, b) => a[1] - b[1])[0];
      if (near && near[1] <= Math.max(8, f.pos.width)) { best = near[0]; bi = iou(target, best.pos); } else best = null;
    }
    if (!best || (bi < 0.5 && f.kind !== 'icon')) {
      push({ kind: f.kind, figma: `${f.id} ${f.name}`, prop: 'match', expected: box(f.pos), actual: best ? `${desc(best)} IoU ${bi.toFixed(2)}` : '(không có)', status: 'REVIEW', note: 'Không ghép được phần tử website' });
      continue;
    }
    usedV.add(best.i);
    const ctx = { kind: f.kind, figma: `${f.id} ${f.name}`, site: desc(best), figBox: f.crop, siteBox: best.rect };
    num(push, ctx, 'x', f.pos.x + off.x, best.pos.x);
    num(push, ctx, 'y', f.pos.y + off.y, best.pos.y);
    num(push, ctx, 'width', f.pos.width, best.pos.width);
    num(push, ctx, 'height', f.pos.height, best.pos.height);
    if (f.kind === 'box') compareBox(push, ctx, f.node, best);
  }
  // Cho bước so ảnh chồng: lệch chung, vùng chữ đã so (khác biệt trong đó là do vẽ chữ — C-02), vùng ảnh (C-04)
  const boxesOf = (kind) => { const m = new Map(); for (const r of rows) if (r.kind === kind && r.figBox) m.set(r.figma, r.figBox); return [...m.values()]; };
  rows.meta = { off, explainedText: boxesOf('text'), images: boxesOf('image'), figX: figmaSection.absoluteBoundingBox.x - (frameBox ? frameBox.x : figmaSection.absoluteBoundingBox.x) };
  return rows;
}

/** Phần tử mang style chữ thật: chính phần tử có chữ; nếu chữ bị tách thành nhiều con (animation) → con đầu tiên có chữ */
function styleSource(byIdx, site, e) {
  if (e.ownText) return e;
  const kids = site.filter((c) => { for (let p = c.parent; p != null; p = byIdx.get(p)?.parent) if (p === e.i) return true; return false; });
  return kids.find((c) => c.ownText) ?? e;
}

function compareText(push, f, e, off, already = false, src = e) {
  const ctx = { kind: 'text', figma: `${f.id} ${f.name}`, site: desc(e), figBox: f.crop, siteBox: e.rect };
  const s = f.style, cs = src.style;
  // Viết hoa/thường: so textCase Figma với text-transform CSS; nội dung so không phân biệt hoa thường khi có transform
  const figCase = TEXT_CASE[s.textCase ?? 'ORIGINAL'] ?? 'none';
  const cssCase = cs['text-transform'] || 'none';
  if (s.textCase || cssCase !== 'none') str(push, ctx, 'text-transform', figCase, cssCase);
  const exp = lines(f.chars), act = e.text || '';
  const sameText = cssCase !== 'none' || figCase !== 'none' ? exp.toLowerCase() === act.toLowerCase() : exp === act;
  if (!already && !sameText) {
    const sameNoBreak = exp.replace(/\n/g, '').toLowerCase() === act.replace(/\n/g, '').toLowerCase();
    push({ ...ctx, prop: 'content', expected: exp, actual: act, status: 'NG', note: sameNoBreak ? 'Khác vị trí xuống dòng chỉ định (\\n Figma ↔ <br> website)' : 'Khác khoảng trắng' });
  }
  if (f.mixed) push({ ...ctx, prop: 'style', status: 'REVIEW', note: 'Đoạn chữ có nhiều style trong Figma — so phần style chính, cần xem tay phần còn lại' });
  num(push, ctx, 'font-size', s.fontSize, parseFloat(cs['font-size']));
  num(push, ctx, 'font-weight', s.fontWeight, parseFloat(cs['font-weight']));
  const lh = cs['line-height'] === 'normal' ? null : parseFloat(cs['line-height']);
  let lhOk = false;
  if (s.lineHeightPx != null) {
    if (lh == null) push({ ...ctx, prop: 'line-height', expected: r2(s.lineHeightPx), actual: 'normal', status: 'REVIEW', note: 'C-03' });
    else { lhOk = Math.abs(lh - s.lineHeightPx) < 0.01; num(push, ctx, 'line-height', s.lineHeightPx, lh, 'C-03'); }
  }
  num(push, ctx, 'letter-spacing', s.letterSpacing ?? 0, cs['letter-spacing'] === 'normal' ? 0 : parseFloat(cs['letter-spacing']));
  const fam = (cs['font-family'] || '').split(',').map((x) => x.trim().replace(/^["']|["']$/g, ''));
  if (s.fontFamily) {
    const idx = fam.findIndex((x) => x.toLowerCase() === s.fontFamily.toLowerCase());
    push({ ...ctx, prop: 'font-family', expected: s.fontFamily, actual: fam.join(', '),
      status: idx === 0 ? 'OK' : idx > 0 ? 'REVIEW' : 'NG',
      note: idx > 0 ? `Có trong font stack nhưng sau ${fam.slice(0, idx).join(', ')}` : '' });
  }
  const fill = solidFill(f.fills);
  if (fill) str(push, ctx, 'color', hex(fill.color, fill.opacity ?? 1), cssHex(cs.color));
  const auto = s.textAutoResize === 'WIDTH_AND_HEIGHT';
  // Căn lề chỉ có nghĩa với hộp chữ độ rộng cố định
  const align = { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify' }[s.textAlignHorizontal];
  if (align && !auto && !e.inline) str(push, ctx, 'text-align', align, ({ start: 'left', end: 'right' })[e.style['text-align']] ?? e.style['text-align']);
  // CSS cộng letter-spacing sau ký tự cuối, Figma không → trừ một letter-spacing khỏi độ rộng hộp chữ thật
  const ls = cs['letter-spacing'] === 'normal' ? 0 : parseFloat(cs['letter-spacing']) || 0;
  const tb = e.tpos ? { ...e.tpos, width: e.tpos.width - ls } : null;
  const fb = { ...f.pos, y: f.pos.y + off.y };
  // Vị trí ngang của hộp chữ tự co giãn: website có thể neo chữ theo mép trái, tâm (flex/căn giữa) hoặc mép phải.
  // So cả 3 mốc, lấy mốc khớp nhất; chênh độ rộng chữ báo riêng ở dòng width → không bỏ sót lệch.
  const xEdge = (b, why) => {
    const c = [['x (mép trái)', fb.x, b.x], ['x (tâm)', fb.x + fb.width / 2, b.x + b.width / 2], ['x (mép phải)', fb.x + fb.width, b.x + b.width]]
      .sort((p, q) => Math.abs(p[2] - p[1]) - Math.abs(q[2] - q[1]))[0];
    num(push, ctx, c[0], c[1], c[2], why);
  };
  // Chữ inline, hoặc chữ nằm thẳng trong nhãn/nút có nền-viền-padding: khung phần tử ≠ hộp chữ → so theo hộp chữ thật, trục y theo tâm
  const boxed = e.inline || e.hasVisual || pad(e) > 0;
  if (boxed || (!tb && auto)) {
    const b = tb ?? e.pos;
    xEdge(b, 'So hộp chữ thật (chữ inline / trong nhãn, nút)');
    num(push, ctx, 'tâm y', fb.y + fb.height / 2, b.y + b.height / 2, 'So tâm dòng chữ (chữ inline / trong nhãn, nút)');
    if (auto && tb) num(push, ctx, 'width', fb.width, tb.width, ls ? 'Đã trừ letter-spacing sau ký tự cuối' : '');
    return;
  }
  if (auto && tb) {
    xEdge(tb, 'Mốc khớp nhất trong 3 mốc');
    num(push, ctx, 'width', fb.width, tb.width, ls ? 'Đã trừ letter-spacing sau ký tự cuối' : '');
  } else {
    num(push, ctx, 'x', fb.x, e.pos.x);
  }
  num(push, ctx, 'y', fb.y, e.pos.y);
  const dh = e.pos.height - f.pos.height;
  num(push, ctx, 'height', f.pos.height, e.pos.height,
    lhOk && Math.abs(dh) < 1 ? 'Line-height khớp; lệch < 1px có thể do Figma làm tròn hộp chữ (C-03)' : 'Chiều cao khối chữ = số dòng × line-height');
}

function compareBox(push, ctx, n, e) {
  const cs = e.style;
  const fill = solidFill(n.fills);
  if (fill) str(push, ctx, 'background-color', hex(fill.color, fill.opacity ?? 1), cssHex(cs['background-color']));
  const radii = n.rectangleCornerRadii ?? (n.cornerRadius != null ? [n.cornerRadius, n.cornerRadius, n.cornerRadius, n.cornerRadius] : [0, 0, 0, 0]);
  const cssR = ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'].map((p) => parseFloat(cs[p]) || 0);
  // Bo góc lớn hơn nửa cạnh ngắn được vẽ như nửa cạnh ngắn → so giá trị hiển thị thật
  const fMax = Math.min(n.absoluteBoundingBox.width, n.absoluteBoundingBox.height) / 2;
  const sMax = Math.min(e.pos.width, e.pos.height) / 2;
  radii.forEach((v, i) => num(push, ctx, ['radius-tl', 'radius-tr', 'radius-br', 'radius-bl'][i], Math.min(v, fMax), Math.min(cssR[i], sMax)));
  const stroke = (n.strokes || []).find((s) => s.visible !== false && s.type === 'SOLID');
  if (stroke && n.strokeWeight > 0) {
    const sides = n.individualStrokeWeights;
    const fw = sides ? `${sides.top}/${sides.right}/${sides.bottom}/${sides.left}` : `${n.strokeWeight}`;
    // Nguồn viền trên website: border của phần tử → ::before/::after → box-shadow inset dạng "0 0 0 Npx"
    let sw = ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'].map((p) => parseFloat(cs[p]) || 0);
    let color = cssHex(cs['border-top-color']) ?? cssHex(cs['border-bottom-color']);
    let src = '';
    if (sw.every((v) => v === 0) && e.pseudoBorder) { sw = e.pseudoBorder.widths; color = cssHex(e.pseudoBorder.color); src = `viền vẽ bằng ${e.pseudoBorder.from}`; }
    const inset = sw.every((v) => v === 0) && String(cs['box-shadow']).match(/(rgba?\([^)]+\))\s+0px\s+0px\s+0px\s+([\d.]+)px\s+inset/);
    if (inset) { sw = [1, 1, 1, 1].map(() => parseFloat(inset[2])); color = cssHex(inset[1]); src = 'viền vẽ bằng box-shadow inset'; }
    const swS = sides ? sw.join('/') : String(Math.max(...sw));
    const note = [n.strokeAlign && n.strokeAlign !== 'INSIDE' ? `Figma stroke ${n.strokeAlign}` : '', src].filter(Boolean).join('; ');
    str(push, ctx, 'border-width', fw, swS, note);
    if (Math.max(...sw) > 0) str(push, ctx, 'border-color', hex(stroke.color, stroke.opacity ?? 1), color, src);
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
