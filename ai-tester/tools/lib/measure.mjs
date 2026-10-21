// Đo website: mở trình duyệt MỘT lần, đo các viewport SONG SONG (mặc định 3 cùng lúc).
// Viewport so với Figma: ảnh toàn trang + computed style mọi phần tử + hộp chữ + section + hover + anchor + link.
// Viewport chỉ kiểm tra layout (không có figmaFrame): đo nhẹ (không lấy CSS), chỉ chụp ảnh khi có lỗi.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const HIDE_SCROLLBAR = 'html{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}';
// Công cụ của chế độ dev (không thuộc giao diện) — ẩn để không lẫn vào ảnh chụp / so ảnh chồng
export const DEV_OVERLAYS = ['#nuxt-devtools-container', 'nuxt-devtools-frame', 'nuxt-devtools-inspect-panel', '#vue-tracer-overlay', '.nuxt-devtools-panel', 'vite-error-overlay', '#__vue-devtools-container__', '[data-v-inspector-overlay]', 'nuxt-loading-indicator', '.nuxt-loading-indicator'];
export { HIDE_SCROLLBAR };
/** Chờ mọi animation/transition đang chạy kết thúc (tối đa `ms`), để ảnh chụp đúng trạng thái cuối */
export async function waitAnimations(page, ms = 6000) {
  await page.evaluate((limit) => Promise.race([
    Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming?.().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
    new Promise((r) => setTimeout(r, limit)),
  ]), ms).catch(() => {});
}
export const isLocal = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|[\w-]+\.local)(:\d+)?\//i.test(url + '/');

export function pickSel(sel, vp) {
  if (!sel || typeof sel === 'string') return sel || null;
  return sel[vp.name] ?? sel[vp.figmaFrame] ?? sel.default ?? null;
}

export async function measureAll(cfg, outDir, log = () => {}) {
  const user = process.env.BASIC_AUTH_USER;
  const httpCredentials = user ? { username: user, password: process.env.BASIC_AUTH_PASS ?? '' } : undefined;
  const browser = await chromium.launch({ channel: 'chrome' });
  const results = {};
  const queue = [...cfg.viewports];
  const worker = async () => {
    while (queue.length) {
      const vp = queue.shift();
      try { results[vp.name] = await measureOne(browser, cfg, vp, outDir, httpCredentials); log(`đo xong ${vp.name}`); }
      catch (e) { results[vp.name] = { dir: path.join(outDir, vp.name), data: null, error: String(e.message || e).split('\n')[0] }; log(`LỖI ${vp.name}: ${results[vp.name].error}`); }
    }
  };
  try { await Promise.all(Array.from({ length: Math.min(cfg.concurrency ?? 3, queue.length) }, worker)); }
  finally { await browser.close(); }
  return results;
}

async function measureOne(browser, cfg, vp, outDir, httpCredentials) {
  const full = Boolean(vp.figmaFrame);
  const dir = path.join(outDir, vp.name);
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, httpCredentials });
  context.setDefaultTimeout(5000);
  const hide = [...DEV_OVERLAYS, ...(cfg.hideSelectors || [])].join(',') + '{display:none!important}';
  const css = (cfg.hideScrollbar !== false ? HIDE_SCROLLBAR : '') + hide;
  await context.addInitScript((c) => {
    const add = () => { const s = document.createElement('style'); s.textContent = c; document.documentElement.appendChild(s); };
    if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add);
  }, css);
  try {
    const page = await context.newPage();
    // Dev server local luôn giữ kết nối HMR → không bao giờ "networkidle": chờ load rồi chờ thêm settleMs
    const waitUntil = cfg.waitUntil ?? (isLocal(cfg.url) ? 'load' : 'networkidle');
    await page.goto(cfg.url, { waitUntil, timeout: 90000 });
    if (waitUntil === 'load') await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    // Cuộn hết trang để nạp ảnh lazy, rồi về đầu trang
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); }
      scrollTo(0, 0);
    });
    await page.waitForTimeout(cfg.settleMs ?? 1500);
    await waitAnimations(page); // vd FV có animation 1–2s: chụp khi chưa xong → ảnh trống
    const sections = (cfg.sections || []).map((s) => ({ name: s.name, selector: pickSel(s.selector, vp) }));
    const data = await page.evaluate(collect, { sections, light: !full });
    const hasLayoutIssue = data.doc.scrollWidth > data.doc.vw + 0.5 || data.overflow.length > 0;
    if (full || hasLayoutIssue) await page.screenshot({ path: path.join(dir, 'site.png'), fullPage: true });

    data.hover = [];
    data.anchors = [];
    if (full) {
      if (vp.hover !== false) {
        for (const h of cfg.hover || []) {
          const sel = pickSel(h.selector ?? h, vp);
          if (sel) data.hover.push(await hoverDiff(page, sel, h.name ?? sel));
        }
      }
      if (cfg.functional !== false) data.anchors = await anchorChecks(page);
    }
    data.meta = { url: cfg.url, viewport: { name: vp.name, width: vp.width, height: vp.height }, light: !full, measuredAt: new Date().toISOString(), browser: browser.version() };
    fs.writeFileSync(path.join(dir, 'styles.json'), JSON.stringify(data));
    return { dir, data };
  } finally {
    await context.close();
  }
}

async function hoverDiff(page, sel, name) {
  try {
    // Chỉ phần tử đang hiển thị (vd link menu SP bị ẩn thì bỏ qua, không chờ timeout)
    const loc = page.locator(sel).locator('visible=true').first();
    if (!(await loc.count())) return { name, selector: sel, error: 'Không có phần tử đang hiển thị' };
    await loc.scrollIntoViewIfNeeded({ timeout: 3000 });
    const snap = () => loc.evaluate((el) => {
      const P = ['color', 'background-color', 'background-image', 'border-color', 'opacity', 'transform', 'scale', 'text-decoration-line', 'box-shadow', 'filter'];
      const pick = (e) => { const s = getComputedStyle(e); return Object.fromEntries(P.map((p) => [p, s.getPropertyValue(p)])); };
      return { self: pick(el), children: [...el.querySelectorAll('*')].slice(0, 30).map(pick) };
    });
    const before = await snap();
    await loc.hover({ timeout: 3000 });
    await page.waitForTimeout(600);
    const after = await snap();
    await page.mouse.move(0, 0);
    const changes = [];
    const cmp = (a, b, where) => { for (const k of Object.keys(a)) if (a[k] !== b[k]) changes.push({ where, prop: k, before: a[k], after: b[k] }); };
    cmp(before.self, after.self, 'self');
    before.children.forEach((c, i) => after.children[i] && cmp(c, after.children[i], `child[${i}]`));
    return { name, selector: sel, changes };
  } catch (e) {
    return { name, selector: sel, error: `Không đo được: ${String(e.message || e).split('\n')[0]}` };
  }
}

/** Click thật (chuột) từng anchor cùng trang đang hiển thị; đo vị trí mục tiêu so với đáy header cố định */
async function anchorChecks(page) {
  const links = await page.evaluate(() => {
    const out = [], seen = new Set();
    for (const a of document.querySelectorAll('a[href]')) {
      const u = new URL(a.getAttribute('href'), location.href);
      if (u.origin + u.pathname !== location.origin + location.pathname || !u.hash || u.hash === '#') continue;
      const r = a.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(a).visibility === 'hidden') continue;
      if (seen.has(u.hash)) continue; seen.add(u.hash);
      out.push({ i: out.length, hash: decodeURIComponent(u.hash), rawHash: u.hash, text: a.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) });
    }
    return out.slice(0, 20);
  });
  const res = [];
  for (const l of links) {
    try {
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(300);
      // Tìm lại link theo href mỗi lần (framework có thể vẽ lại DOM sau mỗi lần click)
      const loc = page.locator(`a[href$="${l.rawHash}"]`).locator('visible=true').first();
      await loc.scrollIntoViewIfNeeded({ timeout: 3000 });
      const before = await page.evaluate(() => scrollY);
      const box = await loc.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      // Chờ cuộn (kể cả cuộn mượt) dừng hẳn: scrollY không đổi trong 400ms, tối đa 5s
      await page.evaluate(() => new Promise((done) => {
        let last = -1, still = 0; const t0 = performance.now();
        const tick = () => { if (scrollY === last) still += 100; else { still = 0; last = scrollY; } if (still >= 400 || performance.now() - t0 > 5000) done(); else setTimeout(tick, 100); };
        setTimeout(tick, 200);
      }));
      const m = await page.evaluate((hash) => {
        const t = document.getElementById(hash.slice(1)) || document.querySelector(`[name="${hash.slice(1)}"]`);
        let headerBottom = 0;
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
          const r = el.getBoundingClientRect();
          if (r.top <= 0.5 && r.height > 0 && r.height < innerHeight / 2 && r.width >= innerWidth * 0.8) headerBottom = Math.max(headerBottom, r.bottom);
        }
        return { found: Boolean(t), targetTop: t ? t.getBoundingClientRect().top : null, scrollY, url: location.href, headerBottom };
      }, l.hash);
      res.push({ ...l, before, ...m });
    } catch (e) {
      res.push({ ...l, error: String(e.message || e).split('\n')[0] });
    }
  }
  // Mở trang trực tiếp với #hash (link chia sẻ, link từ trang khác): đích có bị header che không
  const base = page.url().split('#')[0];
  for (const l of links) {
    try {
      await page.goto(base + l.rawHash, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1500);
      await waitAnimations(page, 3000);
      const m = await page.evaluate((hash) => {
        const t = document.getElementById(hash.slice(1));
        let headerBottom = 0;
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
          const r = el.getBoundingClientRect();
          if (r.top <= 0.5 && r.height > 0 && r.height < innerHeight / 2 && r.width >= innerWidth * 0.8) headerBottom = Math.max(headerBottom, r.bottom);
        }
        return { found: Boolean(t), targetTop: t ? t.getBoundingClientRect().top : null, scrollY, headerBottom };
      }, l.hash);
      res.push({ ...l, direct: true, before: 0, ...m });
    } catch (e) {
      res.push({ ...l, direct: true, error: String(e.message || e).split('\n')[0] });
    }
  }
  return res;
}

/** Status HTTP của mọi link (một lần cho cả trang) */
export async function linkChecks(cfg, hrefs, { concurrency = 8 } = {}) {
  const user = process.env.BASIC_AUTH_USER;
  const auth = user ? 'Basic ' + Buffer.from(`${user}:${process.env.BASIC_AUTH_PASS ?? ''}`).toString('base64') : null;
  const origin = new URL(cfg.url).origin;
  const list = [...new Set(hrefs)];
  const out = [];
  const queue = [...list];
  const worker = async () => {
    while (queue.length) {
      const href = queue.shift();
      if (/^(tel|mailto):/i.test(href)) { out.push({ href, kind: href.split(':')[0].toLowerCase(), value: decodeURIComponent(href.split(':').slice(1).join(':')) }); continue; }
      let u; try { u = new URL(href, cfg.url); } catch { out.push({ href, error: 'URL không hợp lệ' }); continue; }
      if (!/^https?:$/.test(u.protocol)) { out.push({ href, kind: u.protocol }); continue; }
      if (u.origin === origin && u.pathname === new URL(cfg.url).pathname && u.hash) continue; // anchor cùng trang: đã kiểm bằng click
      try {
        const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 10000);
        const r = await fetch(u, { redirect: 'follow', signal: ctl.signal, headers: u.origin === origin && auth ? { Authorization: auth } : {} });
        clearTimeout(tm);
        out.push({ href, kind: u.origin === origin ? 'nội bộ' : 'ngoài', status: r.status, finalUrl: r.url !== u.href ? r.url : undefined });
      } catch (e) { out.push({ href, kind: u.origin === origin ? 'nội bộ' : 'ngoài', error: e.name === 'AbortError' ? 'Quá 10s' : String(e.message) }); }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

// Chạy trong trình duyệt
function collect({ sections, light }) {
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
    if (light) {
      // Đo nhẹ: chỉ cần thông tin để báo lỗi tràn
      const fullText = norm(el.textContent).slice(0, 80);
      const item = { i: out.elements.length, tag: el.tagName.toLowerCase(), rect: abs(r), fullText, sections: secEls.filter(([, s]) => s.contains(el)).map(([n]) => n), parent: null };
      index.set(el, item.i);
      const p = el.parentElement; if (p && index.has(p)) item.parent = index.get(p);
      out.elements.push(item);
      if (r.right > innerWidth + 0.5 && cs.position !== 'fixed') {
        let clipped = false;
        for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible') { clipped = true; break; }
        if (!clipped) out.overflow.push({ i: item.i, kind: 'vượt mép phải viewport', right: r.right });
      }
      if (fullText && el.scrollWidth > el.clientWidth + 1 && (cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis')) {
        out.overflow.push({ i: item.i, kind: cs.textOverflow === 'ellipsis' ? 'chữ bị cắt bằng "…" (kiểm tra có đúng thiết kế không)' : 'chữ bị cắt', scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
      }
      continue;
    }
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
  // Mọi href (kể cả link đang ẩn, vd menu SP) để kiểm tra status một lần
  out.hrefs = light ? [] : [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.href || a.getAttribute('href')))];
  return out;
}
