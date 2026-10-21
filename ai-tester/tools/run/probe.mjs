// Chạy kịch bản tương tác (khai báo bằng JSON) trên nhiều viewport — thay cho việc tự viết script Playwright.
//
//   node probe.mjs --url <URL> --actions <actions.json> --out <thư mục> [--viewports pc=1536x900,sp=375x667]
//
// actions.json: mảng bước, chạy lần lượt trên từng viewport (các viewport chạy song song):
//   { "do": "click",   "selector": "header button.menu" }            // click chuột thật vào tâm phần tử đang hiển thị
//   { "do": "hover",   "selector": "a.cta" }
//   { "do": "press",   "value": "Escape" }
//   { "do": "scroll",  "value": 1200 }                                 // scrollTo(0, value); hoặc "selector" để cuộn tới phần tử
//   { "do": "wait",    "value": 800 }                                  // ms; luôn chờ thêm animation kết thúc
//   { "do": "goto",    "value": "/recruit#facilities" }               // đường dẫn tương đối hoặc URL đầy đủ
//   { "do": "measure", "name": "drawer", "selector": "nav.drawer", "props": ["opacity", "transform"], "all": false }
//   { "do": "state",   "name": "sau click" }                           // scrollY, URL, phần tử focus
//   { "do": "shot",    "name": "drawer-open", "selector": "nav.drawer" }  // bỏ selector = ảnh viewport; "full": true = toàn trang
//   { "do": "only",    "viewports": ["sp"] }                           // các bước sau chỉ chạy ở viewport này (["*"] = tất cả)
// Kết quả: <out>/probe.json (theo viewport, từng bước) + ảnh <out>/<viewport>-<name>.png
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { DEV_OVERLAYS, HIDE_SCROLLBAR, isLocal, waitAnimations } from '../lib/measure.mjs';

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
if (!arg('url') || !arg('actions') || !arg('out')) { console.error('Cần --url, --actions, --out'); process.exit(1); }
const url = arg('url'), out = path.resolve(arg('out'));
const actions = JSON.parse(fs.readFileSync(arg('actions'), 'utf8'));
const viewports = (arg('viewports') || 'pc=1536x900,sp=375x667').split(',').map((v) => { const [name, wh] = v.split('='); const [w, h] = wh.split('x').map(Number); return { name, width: w, height: h }; });
fs.mkdirSync(out, { recursive: true });

const DEFAULT_PROPS = ['display', 'visibility', 'opacity', 'transform', 'color', 'background-color', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'border-top-width', 'border-top-color', 'box-shadow'];
const user = process.env.BASIC_AUTH_USER;
const httpCredentials = user ? { username: user, password: process.env.BASIC_AUTH_PASS ?? '' } : undefined;
const browser = await chromium.launch({ channel: 'chrome' });
const result = {};

await Promise.all(viewports.map(async (vp) => {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, httpCredentials });
  ctx.setDefaultTimeout(5000);
  await ctx.addInitScript((c) => { const add = () => { const s = document.createElement('style'); s.textContent = c; document.documentElement.appendChild(s); }; if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add); },
    HIDE_SCROLLBAR + DEV_OVERLAYS.join(',') + '{display:none!important}');
  const page = await ctx.newPage();
  const steps = [];
  const go = async (u) => { await page.goto(u, { waitUntil: isLocal(u) ? 'load' : 'networkidle', timeout: 60000 }); await page.waitForTimeout(800); await waitAnimations(page); };
  let active = true;
  try {
    await go(url);
    for (const [i, a] of actions.entries()) {
      if (a.do === 'only') { active = a.viewports.includes('*') || a.viewports.includes(vp.name); continue; }
      if (!active) continue;
      const step = { i, do: a.do, name: a.name, selector: a.selector };
      try {
        const loc = a.selector ? page.locator(a.selector).locator('visible=true').first() : null;
        if (a.do === 'click' || a.do === 'hover') {
          await loc.scrollIntoViewIfNeeded();
          const b = await loc.boundingBox();
          if (a.do === 'click') await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); else await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
          await page.waitForTimeout(400); await waitAnimations(page, 3000);
        } else if (a.do === 'press') { await page.keyboard.press(a.value); await page.waitForTimeout(300); await waitAnimations(page, 3000); }
        else if (a.do === 'scroll') { if (loc) await loc.scrollIntoViewIfNeeded(); else await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), Number(a.value)); await page.waitForTimeout(400); }
        else if (a.do === 'wait') { await page.waitForTimeout(Number(a.value) || 500); await waitAnimations(page, 3000); }
        else if (a.do === 'goto') await go(new URL(a.value, url).href);
        else if (a.do === 'measure') {
          const props = a.props || DEFAULT_PROPS;
          step.value = await page.locator(a.selector).evaluateAll((els, { props, all }) => (all ? els : els.slice(0, 1)).map((el) => {
            const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
            return { visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none', rect: { x: r.x, y: r.y + scrollY, width: r.width, height: r.height, viewportTop: r.top }, text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 80), style: Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)])) };
          }), { props, all: Boolean(a.all) });
        } else if (a.do === 'state') step.value = await page.evaluate(() => ({ url: location.href, scrollY, focus: document.activeElement?.tagName + (document.activeElement?.className ? '.' + String(document.activeElement.className).split(' ')[0] : '') }));
        else if (a.do === 'shot') {
          const file = path.join(out, `${vp.name}-${a.name || i}.png`);
          if (loc) await loc.screenshot({ path: file }); else await page.screenshot({ path: file, fullPage: Boolean(a.full) });
          step.value = path.basename(file);
        }
      } catch (e) { step.error = String(e.message || e).split('\n')[0]; }
      steps.push(step);
    }
  } catch (e) { steps.push({ error: `Không mở được trang: ${String(e.message || e).split('\n')[0]}` }); }
  result[vp.name] = steps;
  await ctx.close();
}));
await browser.close();
fs.writeFileSync(path.join(out, 'probe.json'), JSON.stringify(result, null, 1));
for (const [vp, steps] of Object.entries(result)) {
  console.log(`== ${vp}`);
  for (const s of steps) console.log(` ${s.i ?? ''} ${s.do ?? ''} ${s.name ?? s.selector ?? ''}: ${s.error ? 'LỖI ' + s.error : s.value !== undefined ? JSON.stringify(s.value).slice(0, 300) : 'ok'}`);
}
