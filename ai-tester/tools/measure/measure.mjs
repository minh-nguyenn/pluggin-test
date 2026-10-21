// Đo website bằng Playwright: chụp ảnh + xuất computed style của mọi phần tử hiển thị.
// Tùy chọn: so sánh pixel với ảnh Figma (cùng kích thước) để tạo ảnh diff.
//
// Cách dùng:
//   node tools/measure/measure.mjs --url <URL> --width <px> --out <thư mục>
//        [--height <px>] [--scope "<CSS selector>"] [--figma <figma.png>] [--wait <ms>]
// Basic auth: đặt biến môi trường BASIC_AUTH_USER / BASIC_AUTH_PASS (không ghi vào file).
//
// Kết quả trong --out:
//   site.png      ảnh toàn trang (hoặc vùng --scope)
//   styles.json   { meta, elements: [{ path, tag, text, rect, style }] }
//   diff.png      (khi có --figma) vùng khác biệt; tỷ lệ khác biệt in ra console và meta

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);
if (!args.url || !args.width || !args.out) {
  console.error('Thiếu tham số. Cần --url, --width, --out (width lấy từ frame Figma).');
  process.exit(1);
}

const width = Number(args.width);
const height = Number(args.height || 800);
const out = path.resolve(args.out);
fs.mkdirSync(out, { recursive: true });

const authUser = process.env.BASIC_AUTH_USER;
const httpCredentials = authUser ? { username: authUser, password: process.env.BASIC_AUTH_PASS ?? '' } : undefined;

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, httpCredentials });
const page = await context.newPage();
await page.goto(args.url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
if (args.wait) await page.waitForTimeout(Number(args.wait));

const sitePng = path.join(out, 'site.png');
if (args.scope) await page.locator(args.scope).first().screenshot({ path: sitePng });
else await page.screenshot({ path: sitePng, fullPage: true });

const elements = await page.evaluate((scope) => {
  const PROPS = [
    'display', 'position', 'width', 'height',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
    'color', 'text-align', 'text-decoration-line', 'text-transform', 'white-space',
    'background-color', 'background-image', 'opacity',
    'border-top-width', 'border-top-style', 'border-top-color',
    'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-radius', 'box-shadow', 'gap', 'object-fit', 'object-position',
  ];
  const cssPath = (el) => {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && e !== document.body; e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) { parts.unshift(`${s}#${e.id}`); break; }
      const cls = [...e.classList].slice(0, 2).join('.');
      if (cls) s += `.${cls}`;
      const sib = e.parentElement ? [...e.parentElement.children].filter((c) => c.tagName === e.tagName) : [];
      if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(e) + 1})`;
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  const root = scope ? document.querySelector(scope) : document.body;
  if (!root) return [];
  const list = [];
  for (const el of [root, ...root.querySelectorAll('*')]) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK'].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
    const style = {};
    for (const p of PROPS) style[p] = cs.getPropertyValue(p);
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    list.push({
      path: cssPath(el),
      tag: el.tagName.toLowerCase(),
      text: ownText.slice(0, 200),
      alt: el.getAttribute('alt'),
      src: el.currentSrc || el.getAttribute('src') || undefined,
      href: el.getAttribute('href') || undefined,
      rect: { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height },
      style,
    });
  }
  return list;
}, args.scope || null);

const meta = { url: args.url, viewport: { width, height }, scope: args.scope || null, measuredAt: new Date().toISOString(), browser: browser.version() };

if (args.figma) {
  const a = PNG.sync.read(fs.readFileSync(args.figma));
  const b = PNG.sync.read(fs.readFileSync(sitePng));
  if (a.width !== b.width || a.height !== b.height) {
    meta.diff = { error: `Kích thước khác nhau: figma ${a.width}x${a.height}, site ${b.width}x${b.height}` };
  } else {
    const diff = new PNG({ width: a.width, height: a.height });
    const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0 });
    fs.writeFileSync(path.join(out, 'diff.png'), PNG.sync.write(diff));
    meta.diff = { differentPixels: n, ratio: n / (a.width * a.height) };
  }
  console.log('diff:', JSON.stringify(meta.diff));
}

fs.writeFileSync(path.join(out, 'styles.json'), JSON.stringify({ meta, elements }, null, 2));
console.log(`OK: ${elements.length} phần tử → ${out}`);
await browser.close();
