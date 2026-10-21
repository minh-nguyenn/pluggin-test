// Đọc comment của file Figma qua Figma REST API.
//
// Cách dùng:
//   FIGMA_TOKEN=<token cá nhân> node tools/figma/comments.mjs --file <fileKey> [--node <node-id>] [--all]
//   --node : chỉ lấy comment gắn với node đó (vd 1:23 hoặc 1-23) và các trả lời của nó
//   --all  : lấy cả comment đã resolve (mặc định chỉ lấy comment chưa resolve)
// Token: tạo trong Figma > Settings > Security > Personal access tokens (quyền đọc file comments).
// Không ghi token vào file; chỉ đặt bằng biến môi trường lúc chạy.

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, [])
);
const figmaToken = process.env.FIGMA_TOKEN;
if (!args.file) { console.error('Thiếu --file <fileKey>.'); process.exit(1); }
if (!figmaToken) { console.error('Chưa có biến môi trường FIGMA_TOKEN.'); process.exit(2); }

const res = await fetch(`https://api.figma.com/v1/files/${args.file}/comments`, {
  headers: { 'X-Figma-Token': figmaToken },
});
if (!res.ok) {
  console.error(`Figma API lỗi ${res.status}: ${await res.text()}`);
  process.exit(3);
}
const { comments = [] } = await res.json();

const node = typeof args.node === 'string' ? args.node.replace('-', ':') : null;
const roots = comments.filter((c) => !c.parent_id
  && (args.all || !c.resolved_at)
  && (!node || c.client_meta?.node_id === node));
const replies = (id) => comments.filter((c) => c.parent_id === id)
  .sort((a, b) => a.created_at.localeCompare(b.created_at));

const out = roots
  .sort((a, b) => a.created_at.localeCompare(b.created_at))
  .map((c) => ({
    id: c.id,
    node_id: c.client_meta?.node_id ?? null,
    author: c.user?.handle,
    created_at: c.created_at,
    resolved_at: c.resolved_at,
    message: c.message,
    replies: replies(c.id).map((r) => ({ id: r.id, author: r.user?.handle, created_at: r.created_at, message: r.message })),
  }));

console.log(JSON.stringify({ file: args.file, node, includeResolved: Boolean(args.all), count: out.length, comments: out }, null, 2));
