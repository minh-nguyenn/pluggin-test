// AI Tester — chạy so sánh tự động Figma ↔ website cho một màn hình.
//
//   node run.mjs --config <run.json> --out <thư mục kết quả> [--cache <thư mục cache Figma>] [--refresh-figma] [--only pc,sp] [--no-figma]
//
// run.json (AI tạo từ .ai-tester/CLAUDE.md — mọi giá trị phải có nguồn, không tự đặt):
// {
//   "url": "https://…/recruit",
//   "figma": { "fileKey": "ZEN2…", "frames": { "pc": "7290:51732", "sp": "7553:72110" } },
//   "viewports": [
//     { "name": "pc", "width": 1536, "height": 900, "figmaFrame": "pc" },   // so chính xác với Figma
//     { "name": "sp", "width": 375, "height": 667, "figmaFrame": "sp" },
//     { "name": "1366", "width": 1366, "height": 900 }                      // độ rộng thiết bị: chỉ kiểm tra layout (C-05)
//   ],
//   "sections": [
//     { "name": "FV", "figmaNode": { "pc": "7307:51877", "sp": "7553:72125" }, "selector": { "pc": "main > section:nth-of-type(1)", "sp": "…" } },
//     { "name": "NEWS", "figmaNode": "…", "selector": "…", "dynamic": true }   // nội dung lấy từ CMS: khác chữ → REVIEW, không NG
//   ],
//   "hover": [ { "name": "Nút CTA", "selector": "a.cta" } ],
//   "settleMs": 1500
// }
//
// Kết quả: <out>/summary.md (bảng NG/REVIEW tiếng Việt), <out>/<viewport>/{site.png, styles.json, compare.json, review-*.png}
// Basic auth: BASIC_AUTH_USER / BASIC_AUTH_PASS. Figma: FIGMA_TOKEN.

import fs from 'node:fs';
import path from 'node:path';
import { fetchNodes, fileMeta, exportPngs, findNode, normId } from '../lib/figma.mjs';
import { measureAll, linkChecks } from '../lib/measure.mjs';
import { compareSection } from '../lib/compare.mjs';
import { reviewSheet, overlayDiff } from '../lib/image.mjs';

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : undefined; };
if (!arg('config') || !arg('out')) { console.error('Cần --config <run.json> --out <thư mục>'); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(arg('config'), 'utf8'));
const out = path.resolve(arg('out'));
const cache = path.resolve(arg('cache') || path.join(out, '..', 'figma-cache'));
fs.mkdirSync(out, { recursive: true });
if (arg('only')) { const only = String(arg('only')).split(','); cfg.viewports = cfg.viewports.filter((v) => only.includes(v.name)); }

// Phiên bản code đang test (chạy trong repo website): commit, nhánh, số file chưa commit
let gitInfo = null;
try {
  const { execSync } = await import('node:child_process');
  const g = (c) => execSync(`git ${c}`, { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const dirty = g('status --porcelain').split('\n').filter(Boolean);
  gitInfo = { commit: g('rev-parse --short HEAD'), branch: g('rev-parse --abbrev-ref HEAD'), dirty: dirty.length };
} catch {}

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
const notes = [];

// 1. Figma (cache + phát hiện design thay đổi)
let frames = {};
let figmaMeta = null;
const useFigma = !arg('no-figma') && cfg.figma?.fileKey;
if (useFigma) {
  const ids = Object.values(cfg.figma.frames).map(normId);
  let refresh = Boolean(arg('refresh-figma'));
  const cached = fs.existsSync(cache) && fs.readdirSync(cache).find((f) => f.startsWith('nodes-'));
  if (cached && !refresh) {
    const old = JSON.parse(fs.readFileSync(path.join(cache, cached), 'utf8')).meta;
    const now = await fileMeta(cfg.figma.fileKey);
    if (now.lastModified !== old.lastModified) {
      notes.push(`⚠ Figma đã thay đổi từ lần đọc trước (${old.lastModified} → ${now.lastModified}). Đã đọc lại; kết quả retest các bug cũ cần kiểm tra lại giá trị mong đợi.`);
      refresh = true;
    }
  }
  const res = await fetchNodes(cfg.figma.fileKey, ids, cache, { refresh });
  figmaMeta = res.meta;
  for (const [k, id] of Object.entries(cfg.figma.frames)) frames[k] = res.nodes[normId(id)];
  log('Figma:', figmaMeta.name, figmaMeta.lastModified);
}

// 2. Đo website (một lần mở trình duyệt)
// Tải PNG mọi section từ Figma NGAY LÚC NÀY, song song với việc đo website (lần đầu có thể mất vài phút)
const allSecIds = useFigma ? [...new Set((cfg.sections || []).flatMap((s) => (typeof s.figmaNode === 'string' ? [s.figmaNode] : Object.values(s.figmaNode || {}))).map(normId))] : [];
const pngReady = useFigma && allSecIds.length
  ? exportPngs(cfg.figma.fileKey, allSecIds, path.join(cache, 'png')).catch((e) => { notes.push(`⚠ Không tải được ảnh section Figma: ${e.message}`); return {}; })
  : Promise.resolve({});
const measured = await measureAll(cfg, out, log);
log('Đã đo', Object.keys(measured).join(', '));

// 2b. Status mọi link (một lần cho cả trang, lấy từ các viewport so Figma)
let links = [];
if (cfg.functional !== false) {
  const hrefs = Object.values(measured).flatMap((m) => m.data?.hrefs ?? []);
  links = await linkChecks(cfg, hrefs);
  log('Đã kiểm tra', links.length, 'link');
}

// 3. So sánh + kiểm tra layout
const summary = [];
for (const vp of cfg.viewports) {
  const { dir, data, error } = measured[vp.name];
  const rows = [];
  if (!data) {
    rows.push({ section: '(trang)', kind: 'lỗi', prop: 'đo', status: 'REVIEW', note: `Không đo được viewport này: ${error}` });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'compare.json'), JSON.stringify(rows, null, 1));
    summary.push({ vp, rows, data: { doc: { scrollHeight: '?' }, sections: {} }, compared: false });
    continue;
  }
  // Anchor (click chuột thật): không cuộn tới đích / đích bị header che → NG; còn lại ghi số đo để AI so với design
  for (const a of data.anchors ?? []) {
    const base = { section: '(trang)', kind: 'anchor', site: `${a.text} → ${a.hash}` };
    if (a.error) rows.push({ ...base, prop: 'click', status: 'REVIEW', note: a.error });
    else if (!a.found) rows.push({ ...base, prop: 'đích', expected: a.hash, actual: '(không có phần tử có id này)', status: 'NG' });
    else {
      const top = Math.round(a.targetTop * 100) / 100, hb = Math.round(a.headerBottom * 100) / 100;
      const hidden = a.targetTop < a.headerBottom - 0.5;
      const notScrolled = a.scrollY === a.before && Math.abs(a.targetTop) > data.doc.vh;
      // Đích còn cách đáy header hơn 1/4 màn hình sau khi cuộn dừng hẳn → anchor không đưa đích lên đầu
      const far = !hidden && a.targetTop - a.headerBottom > data.doc.vh / 4;
      rows.push({ ...base, prop: 'vị trí đích sau click', expected: `sát đáy header (${hb})`, actual: `top ${top} (cách header ${Math.round((a.targetTop - a.headerBottom) * 100) / 100}), scrollY ${a.scrollY}`,
        status: hidden || notScrolled || far ? 'NG' : 'REVIEW',
        note: notScrolled ? 'Click không cuộn trang' : hidden ? 'Đích bị header che' : far ? 'Cuộn dừng nhưng đích chưa lên đầu màn hình' : 'Cuộn tới đích; AI so khoảng cách với design' });
    }
  }
  // Layout (mọi viewport)
  if (data.doc.scrollWidth > data.doc.vw + 0.5) rows.push({ section: '(trang)', kind: 'layout', prop: 'cuộn ngang', expected: data.doc.vw, actual: data.doc.scrollWidth, status: 'NG' });
  for (const o of data.overflow) {
    const e = data.elements[o.i];
    // chỉ báo phần tử ngoài cùng (bỏ con của phần tử đã báo)
    let p = e.parent, dup = false;
    while (p != null) { if (data.overflow.some((x) => x.i === p && x.kind === o.kind)) { dup = true; break; } p = data.elements[p]?.parent; }
    if (!dup) rows.push({ section: e.sections[0] ?? '(trang)', kind: 'layout', site: `${e.tag}#${e.i} ${e.fullText.slice(0, 30)}`, siteBox: e.rect, prop: o.kind, actual: JSON.stringify({ ...o, i: undefined }), status: 'REVIEW' });
  }
  // So với Figma (chỉ viewport có figmaFrame)
  const frame = vp.figmaFrame && frames[vp.figmaFrame];
  if (frame) {
    const secIdOf = (s) => normId(typeof s.figmaNode === 'string' ? s.figmaNode : s.figmaNode[vp.figmaFrame]);
    const metas = {};
    for (const s of cfg.sections || []) {
      const id = s.figmaNode && (typeof s.figmaNode === 'string' ? s.figmaNode : s.figmaNode[vp.figmaFrame]);
      if (!id) continue;
      const node = findNode(frame, id);
      if (!node) { rows.push({ section: s.name, kind: 'section', prop: 'figmaNode', expected: id, status: 'REVIEW', note: 'Không tìm thấy node trong frame Figma' }); continue; }
      const secRows = compareSection(s.name, node, data, frame.absoluteBoundingBox, { dynamic: Boolean(s.dynamic) });
      metas[s.name] = secRows.meta;
      rows.push(...secRows);
    }
    // So ảnh chồng từng section (tín hiệu độc lập): chỉ báo vùng khác mà chưa phần tử nào đã so giải thích được
    if (useFigma && Object.keys(metas).length) {
      const pngs = await pngReady;
      for (const s of cfg.sections.filter((x) => metas[x.name] && !data.sections[x.name]?.missing)) {
        const m = metas[s.name], png = pngs[secIdOf(s)];
        if (!png) continue;
        const origin = { x: m.figX, y: data.sections[s.name].rect.y + m.off.y };
        const { regions, file } = overlayDiff(png, path.join(dir, 'site.png'), origin, m.explainedText, path.join(dir, `overlay-${s.name}.png`), { images: m.images });
        for (const [i, r] of regions.entries()) rows.push({ section: s.name, kind: 'overlay', prop: 'vùng khác (ảnh chồng)', expected: `${r.x},${r.y} ${r.width}×${r.height}`, actual: `độ khác ${r.score}`, status: 'REVIEW', note: `Không trùng phần tử chữ/ảnh nào đã so — xem overlay-${s.name}.png vùng #${i + 1}` });
        if (file) log('Ảnh chồng:', path.relative(out, file), `(${regions.length} vùng)`);
      }
    }
    // Ảnh vùng lệch
    const ngBySection = {};
    for (const r of rows) if (r.status === 'NG' && r.figBox && r.siteBox) {
      const k = r.section; ngBySection[k] ??= new Map();
      const pairKey = `${r.figma}|${r.site}`;
      if (!ngBySection[k].has(pairKey)) ngBySection[k].set(pairKey, { figBox: r.figBox, siteBox: r.siteBox, idx: ngBySection[k].size + 1 });
      r.reviewRow = ngBySection[k].get(pairKey).idx;
    }
    const secIds = Object.keys(ngBySection).map((n) => { const s = cfg.sections.find((x) => x.name === n); return typeof s.figmaNode === 'string' ? s.figmaNode : s.figmaNode[vp.figmaFrame]; });
    if (secIds.length && useFigma) {
      const pngs = await pngReady;
      for (const [name, pairs] of Object.entries(ngBySection)) {
        const s = cfg.sections.find((x) => x.name === name);
        const id = normId(typeof s.figmaNode === 'string' ? s.figmaNode : s.figmaNode[vp.figmaFrame]);
        const list = [...pairs.values()];
        for (let i = 0; i < list.length; i += 15) {
          const f = reviewSheet(list.slice(i, i + 15), pngs[id], path.join(dir, 'site.png'), path.join(dir, `review-${name}-${i / 15 + 1}.png`));
          if (f) log('Ảnh đối chiếu:', path.relative(out, f));
        }
      }
    }
  }
  fs.writeFileSync(path.join(dir, 'compare.json'), JSON.stringify(rows, null, 1));
  summary.push({ vp, rows, data, compared: Boolean(frame) });
}

// 4. summary.md
const esc = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
let md = `# Kết quả so sánh tự động\n\nURL: ${cfg.url}\nĐo lúc: ${new Date().toISOString()} · Thời gian chạy: ${((Date.now() - t0) / 1000).toFixed(0)}s\n`;
if (figmaMeta) md += `Figma: ${figmaMeta.name} · lastModified ${figmaMeta.lastModified} · version ${figmaMeta.version}\n`;
if (gitInfo) md += `Code: nhánh ${gitInfo.branch} · commit ${gitInfo.commit}${gitInfo.dirty ? ` · ${gitInfo.dirty} file chưa commit` : ''}\n`;
for (const n of notes) md += `\n${n}\n`;
md += `\n> Script chỉ so số liệu, không áp quy tắc. AI phải đối chiếu từng dòng NG/REVIEW với quy tắc dự án (R-xx) và quy tắc chung (C-xx) trước khi kết luận.\n`;
for (const { vp, rows, data, compared } of summary) {
  const c = (s) => rows.filter((r) => r.status === s).length;
  md += `\n## ${vp.name} (${vp.width}×${vp.height})${compared ? ` — so với Figma frame ${vp.figmaFrame}` : ' — chỉ kiểm tra layout (C-05)'}\n\n`;
  md += `Trang cao ${data.doc.scrollHeight}px · OK ${c('OK')} · NG ${c('NG')} · REVIEW ${c('REVIEW')}\n\n`;
  for (const [name, s] of Object.entries(data.sections)) if (s.missing) md += `- ⚠ Section ${name}: không tìm thấy selector \`${s.selector}\`\n`;
  // Thứ tự: NG không phải số (nội dung, màu, font…) → NG lệch lớn → NG lệch < 1px → REVIEW
  const rank = (r) => (r.status === 'REVIEW' ? 3 : typeof r.delta !== 'number' ? 0 : Math.abs(r.delta) >= 1 ? 1 : 2);
  rows.sort((a, b) => rank(a) - rank(b) || (Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)));
  // Gộp dòng REVIEW giống hệt nhau (cùng thuộc tính, mong đợi, thực tế) thành một dòng ×N; NG giữ từng dòng
  const bad = [];
  const groups = new Map();
  for (const r of rows.filter((x) => x.status !== 'OK')) {
    if (r.status === 'REVIEW' && r.prop !== 'content' && r.prop !== 'match') {
      const g = `${r.kind}|${r.prop}|${r.expected}|${r.actual}|${r.note}`;
      if (groups.has(g)) { groups.get(g).count++; groups.get(g).sections.add(r.section); continue; }
      const item = { ...r, count: 1, sections: new Set([r.section]) };
      groups.set(g, item); bad.push(item);
    } else bad.push(r);
  }
  // Bảng chính: NG ≥ 1px / NG không phải số / REVIEW. Bảng phụ cuối mục: NG < 1px (thường C-01, C-03)
  const tiny = (r) => r.status === 'NG' && typeof r.delta === 'number' && Math.abs(r.delta) < 1;
  const table = (list, title) => {
    if (!list.length) return;
    md += `\n${title}\n\n| # | Section | Loại | Figma | Website | Thuộc tính | Mong đợi | Thực tế | Δ | KQ | Ảnh | Ghi chú |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
    list.forEach((r, i) => {
      const sec = r.count > 1 ? [...r.sections].join(', ') : r.section;
      const fig = r.count > 1 ? `(×${r.count} phần tử)` : r.figma;
      const site = r.count > 1 ? '' : r.site;
      const img = r.reviewRow ? `review-${r.section} #${r.reviewRow}` : r.kind === 'overlay' ? `overlay-${r.section}` : '';
      md += `| ${i + 1} | ${esc(sec)} | ${r.kind} | ${esc(fig)} | ${esc(site)} | ${r.prop} | ${esc(r.expected)} | ${esc(r.actual)} | ${r.delta ?? ''} | ${r.status} | ${img} | ${esc(r.note)} |\n`;
    });
  };
  table(bad.filter((r) => !tiny(r)), '### Cần xử lý');
  table(bad.filter(tiny), '### NG lệch < 1px (thường do toạ độ lẻ Figma C-01 hoặc làm tròn hộp chữ C-03 — AI vẫn phải xác nhận)');
  if (data.hover?.length) {
    md += `\n### Hover\n\n| Phần tử | Thay đổi khi hover |\n|---|---|\n`;
    for (const h of data.hover) md += `| ${esc(h.name)} | ${h.error ? h.error : h.changes.length ? esc(h.changes.map((x) => `${x.where} ${x.prop}: ${x.before} → ${x.after}`).join('; ')) : '(không đổi)'} |\n`;
  }
}
if (links.length) {
  const bad = links.filter((l) => l.error || (l.status && l.status >= 400));
  const telMail = links.filter((l) => l.kind === 'tel' || l.kind === 'mailto');
  md += `\n## Link (toàn trang)\n\n${links.length} link · lỗi ${bad.length} · tel/mailto ${telMail.length}\n`;
  if (bad.length) {
    md += `\n| # | Link | Loại | Kết quả | KQ |\n|---|---|---|---|---|\n`;
    bad.forEach((l, i) => { md += `| ${i + 1} | ${esc(l.href)} | ${l.kind ?? ''} | ${l.error ? esc(l.error) : `HTTP ${l.status}`} | NG |\n`; });
  }
  if (telMail.length) {
    md += `\n| tel / mailto | Giá trị (đối chiếu với chữ hiển thị và Figma) |\n|---|---|\n`;
    for (const l of telMail) md += `| ${l.kind} | ${esc(l.value)} |\n`;
  }
  const redirected = links.filter((l) => l.finalUrl);
  if (redirected.length) md += `\n${redirected.length} link bị chuyển hướng (xem \`links.json\`).\n`;
  fs.writeFileSync(path.join(out, 'links.json'), JSON.stringify(links, null, 1));
}
fs.writeFileSync(path.join(out, 'summary.md'), md);
log('Xong →', path.join(out, 'summary.md'));
