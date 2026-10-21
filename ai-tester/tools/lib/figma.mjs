// Figma REST API: lấy cây node, ảnh PNG, thông tin phiên bản. Token đọc từ biến môi trường FIGMA_TOKEN
// (Windows: nếu tiến trình chưa có thì đọc biến môi trường cấp User). Không ghi token vào file.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function figmaToken() {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN;
  if (process.platform === 'win32') {
    try {
      const v = execSync(
        `powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('FIGMA_TOKEN','User')"`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      if (v) return v;
    } catch {}
  }
  return null;
}

async function api(url) {
  const tk = figmaToken();
  if (!tk) throw new Error('Chưa có FIGMA_TOKEN (biến môi trường).');
  const res = await fetch(`https://api.figma.com${url}`, { headers: { 'X-Figma-Token': tk } });
  if (!res.ok) throw new Error(`Figma API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export const normId = (id) => String(id).replace(/-/g, ':');

/** Phiên bản file (nhẹ): { name, lastModified, version } */
export async function fileMeta(fileKey) {
  const j = await api(`/v1/files/${fileKey}?depth=1`);
  return { name: j.name, lastModified: j.lastModified, version: j.version };
}

/** Lấy cây node (cache theo thư mục). Trả { meta, nodes: { id: document } } */
export async function fetchNodes(fileKey, ids, cacheDir, { refresh = false } = {}) {
  ids = ids.map(normId);
  const cacheFile = cacheDir && path.join(cacheDir, `nodes-${ids.join('_').replace(/:/g, '-')}.json`);
  if (cacheFile && !refresh && fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  const j = await api(`/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(ids.join(','))}`);
  const out = {
    meta: { fileKey, name: j.name, lastModified: j.lastModified, version: j.version, fetchedAt: new Date().toISOString() },
    nodes: Object.fromEntries(Object.entries(j.nodes).map(([id, v]) => [id, v?.document ?? null])),
  };
  if (cacheFile) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(cacheFile, JSON.stringify(out)); }
  return out;
}

/** Xuất PNG các node (scale 1) vào thư mục; trả { id: đường dẫn } */
export async function exportPngs(fileKey, ids, dir, { refresh = false } = {}) {
  ids = ids.map(normId);
  fs.mkdirSync(dir, { recursive: true });
  const fileOf = (id) => path.join(dir, `${id.replace(/[:;]/g, '-')}.png`);
  const need = ids.filter((id) => refresh || !fs.existsSync(fileOf(id)));
  for (let i = 0; i < need.length; i += 20) {
    const batch = need.slice(i, i + 20);
    const j = await api(`/v1/images/${fileKey}?ids=${encodeURIComponent(batch.join(','))}&format=png&scale=1`);
    for (const id of batch) {
      const url = j.images?.[id];
      if (!url) continue;
      const r = await fetch(url);
      if (r.ok) fs.writeFileSync(fileOf(id), Buffer.from(await r.arrayBuffer()));
    }
  }
  return Object.fromEntries(ids.filter((id) => fs.existsSync(fileOf(id))).map((id) => [id, fileOf(id)]));
}

/** Tìm node theo id trong cây */
export function findNode(root, id) {
  id = normId(id);
  const stack = [root];
  while (stack.length) {
    const n = stack.pop();
    if (!n) continue;
    if (n.id === id) return n;
    if (n.children) stack.push(...n.children);
  }
  return null;
}

export async function comments(fileKey) {
  return (await api(`/v1/files/${fileKey}/comments`)).comments ?? [];
}
