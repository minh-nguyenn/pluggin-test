// Đo website: mở trình duyệt MỘT lần, đo mọi viewport trong cấu hình.
// Mỗi viewport: ảnh toàn trang + computed style mọi phần tử hiển thị + hộp chữ + vị trí section + hover + lỗi tràn.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const HIDE_SCROLLBAR = 'html{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}';

export function pickSel(sel, vp) {
  if (!sel || typeof sel === 'string') return sel || null;
  return sel[vp.name] ?? sel[vp.figmaFrame] ?? sel.default ?? null;
}

export async function measureAll(cfg, outDir) {
  const user = process.env.BASIC_AUTH_USER;
  const httpCredentials = user ? { username: user, password: process.env.BASIC_AUTH_PASS ?? '' } : undefined;
  const browser = await chromium.launch({ channel: 'chrome' });
  const results = {};
  try {
    for (const vp of cfg.viewports) {
      const dir = path.join(outDir, vp.name);
      fs.mkdirSync(dir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, httpCredentials,
      });
      if (cfg.hideScrollbar !== false) {
        await context.addInitScript((css) => {
          const add = () => { const s = document.createElement('style'); s.textContent = css; document.documentElement.appendChild(s); };
          if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add);
        }, HIDE_SCROLLBAR);
      }
      const page = await context.newPage();
      await page.goto(cfg.url, { waitUntil: 'networkidle', timeout: 90000 });
      await page.evaluate(() => document.fonts.ready);
      // Cuộn hết trang để nạp ảnh lazy, rồi về đầu trang
      await page.evaluate(async () => {
        const step = innerHeight;
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
        scrollTo(0, 0);
      });
      await page.waitForTimeout(cfg.settleMs ?? 1500);
      await page.screenshot({ path: path.join(dir, 'site.png'), fullPage: true });

      const sections = (cfg.sections || []).map((s) => ({ name: s.name, selector: pickSel(s.selector, vp) }));
      const data = await page.evaluate(collect, { sections });

      data.hover = [];
      if (vp.hover !== false) {
        for (const h of cfg.hover || []) {
          const sel = pickSel(h.selector ?? h, vp);
          if (!sel) continue;
          data.hover.push(await hoverDiff(page, sel, h.name ?? sel));
        }
      }
      data.meta = { url: cfg.url, viewport: { name: vp.name, width: vp.width, height: vp.height }, measuredAt: new Date().toISOString(), browser: browser.version() };
      fs.writeFileSync(path.join(dir, 'styles.json'), JSON.stringify(data));
      results[vp.name] = { dir, data };
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return results;
}

async function hoverDiff(page, sel, name) {
  const loc = page.locator(sel).first();
  if (!(await loc.count())) return { name, selector: sel, error: 'Không tìm thấy phần tử' };
  await loc.scrollIntoViewIfNeeded();
  const snap = () => loc.evaluate((el) => {
    const P = ['color', 'background-color', 'background-image', 'border-color', 'opacity', 'transform', 'scale', 'text-decoration-line', 'box-shadow', 'filter'];
    const pick = (e) => { const s = getComputedStyle(e); return Object.fromEntries(P.map((p) => [p, s.getPropertyValue(p)])); };
    return { self: pick(el), children: [...el.querySelectorAll('*')].slice(0, 30).map(pick) };
  });
  const before = await snap();
  await loc.hover();
  await page.waitForTimeout(600);
  const after = await snap();
  await page.mouse.move(0, 0);
  const changes = [];
  const cmp = (a, b, where) => { for (const k of Object.keys(a)) if (a[k] !== b[k]) changes.push({ where, prop: k, before: a[k], after: b[k] }); };
  cmp(before.self, after.self, 'self');
  before.children.forEach((c, i) => after.children[i] && cmp(c, after.children[i], `child[${i}]`));
  return { name, selector: sel, changes };
}

// Chạy trong trình duyệt
function collect({ sections }) {
  const PROPS = ['display', 'position', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color',
    'text-align', 'text-decoration-line', 'text-transform', 'background-color', 'background-image', 'opacity',
    'border-top-width', 'border-top-color', 'border-top-style', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
    'box-shadow', 'object-fit', 'overflow-x', 'text-overflow', 'white-space',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left'];
  const abs = (r) => ({ x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height });
  const norm = (s) => (s || '').replace(/[\s　]+/g, ' ').trim();
  const out = {
    doc: { scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, vw: innerWidth, vh: innerHeight },
    sections: {}, elements: [], overflow: [],
  };
  const secEls = [];
  for (const s of sections) {
    const el = s.selector ? document.querySelector(s.selector) : null;
    out.sections[s.name] = el ? { selector: s.selector, rect: abs(el.getBoundingClientRect()) } : { selector: s.selector, missing: true };
    if (el) secEls.push([s.name, el]);
  }
  const all = [...document.body.querySelectorAll('*')];
  const index = new Map();
  for (const el of all) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'META', 'LINK', 'BR'].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0) continue;
    const style = {};
    for (const p of PROPS) style[p] = cs.getPropertyValue(p);
    const textNodes = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    const ownText = norm(textNodes.map((n) => n.textContent).join(''));
    let textBox = null;
    if (textNodes.length) {
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const n of textNodes) {
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) { if (!q.width) continue; x1 = Math.min(x1, q.left); y1 = Math.min(y1, q.top); x2 = Math.max(x2, q.right); y2 = Math.max(y2, q.bottom); }
      }
      if (x1 < Infinity) textBox = { x: x1 + scrollX, y: y1 + scrollY, width: x2 - x1, height: y2 - y1 };
    }
    // Viền vẽ bằng ::before / ::after (thường gặp khi làm hover) — ghi lại để so với stroke Figma
    let pseudoBorder = null;
    for (const ps of ['::before', '::after']) {
      const p = getComputedStyle(el, ps);
      if (p.content === 'none' || p.display === 'none') continue;
      const w = ['top', 'right', 'bottom', 'left'].map((sd) => parseFloat(p.getPropertyValue(`border-${sd}-width`)) || 0);
      if (w.some((v) => v > 0)) { pseudoBorder = { from: ps, widths: w, color: p.getPropertyValue('border-top-color') || p.getPropertyValue('border-bottom-color') }; break; }
    }
    const tag = el.tagName.toLowerCase();
    const hasVisual = tag === 'img' || tag === 'svg' || tag === 'video' || tag === 'canvas' || tag === 'picture'
      || (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') || cs.backgroundImage !== 'none'
      || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0
      || cs.boxShadow !== 'none' || Boolean(pseudoBorder);
    const fullText = norm(el.textContent).slice(0, 500);
    // text: nội dung hiển thị, GIỮ xuống dòng (<br>, block) để so "xuống dòng chỉ định" với \n của Figma
    const text = fullText ? (el.innerText || '').replace(/\r/g, '').split('\n').map((l) => l.replace(/[ \t　]+/g, ' ').trim()).filter(Boolean).join('\n').slice(0, 500) : '';
    const item = {
      i: out.elements.length, tag, cls: (el.getAttribute('class') || '').slice(0, 80),
      rect: abs(r), style, pseudoBorder, ownText: ownText.slice(0, 500), fullText, text, textBox,
      inline: cs.display.startsWith('inline') && cs.display !== 'inline-block' && cs.display !== 'inline-flex' && cs.display !== 'inline-grid',
      hasVisual, src: el.currentSrc || el.getAttribute('src') || undefined, href: el.getAttribute('href') || undefined,
      alt: el.getAttribute('alt') ?? undefined, sections: secEls.filter(([, s]) => s.contains(el)).map(([n]) => n),
      parent: null,
    };
    index.set(el, item.i);
    const p = el.parentElement; if (p && index.has(p)) item.parent = index.get(p);
    out.elements.push(item);
    // Lỗi tràn: chỉ báo phần tử thật sự lộ ra ngoài viewport (không nằm trong khung đã che như slider)
    if (r.right > innerWidth + 0.5 && cs.position !== 'fixed') {
      let clipped = false;
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if (ox !== 'visible') { clipped = true; break; }
      }
      if (!clipped) out.overflow.push({ i: item.i, kind: 'vượt mép phải viewport', right: r.right });
    }
    // Chữ bị cắt: chỉ xét phần tử có chữ
    if (item.fullText && el.scrollWidth > el.clientWidth + 1 && (cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis')) {
      out.overflow.push({ i: item.i, kind: cs.textOverflow === 'ellipsis' ? 'chữ bị cắt bằng "…" (kiểm tra có đúng thiết kế không)' : 'chữ bị cắt', scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
    }
  }
  return out;
}
