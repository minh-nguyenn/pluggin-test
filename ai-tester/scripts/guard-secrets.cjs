// PreToolUse (Write|Edit): chặn ghi mật khẩu / token / basic auth vào dữ liệu AI Tester.
// Chỉ kiểm tra file trong `.ai-tester/` của repo website và `knowledge/`, `templates/` của plugin,
// để không chặn nhầm mã nguồn website (vd `password: string`).
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  const ti = input.tool_input || {};
  const file = String(ti.file_path || '').replace(/\\/g, '/');
  const pluginRoot = String(process.env.CLAUDE_PLUGIN_ROOT || '').replace(/\\/g, '/').toLowerCase();
  const lower = file.toLowerCase();
  const inScope = lower.includes('/.ai-tester/')
    || (pluginRoot && (lower.startsWith(`${pluginRoot}/knowledge/`) || lower.startsWith(`${pluginRoot}/templates/`)));
  if (!inScope) process.exit(0);

  const text = [ti.content, ti.new_string].filter(Boolean).join('\n');
  const patterns = [
    [/(password|passwd|pwd|パスワード|mật khẩu|token|api[_-]?key|secret)\s*[:=：]\s*(?!process\.env|\$|\{|<)[A-Za-z0-9!@#%^&*()_+\-=\[\]{};'",.\/?~]{4,}/i, 'mật khẩu / token'],
    [/https?:\/\/[^\s\/:@|]+:[^\s\/@|]+@/i, 'thông tin đăng nhập trong URL (user:pass@)'],
  ];
  for (const [re, label] of patterns) {
    const m = text.match(re);
    if (m) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            `Chặn ghi vào ${file}: phát hiện ${label} ("${m[0].slice(0, 40)}"). ` +
            'Quy tắc: không lưu mật khẩu/token vào file. Chỉ ghi "đã có quyền / chưa có quyền".',
        },
      }));
      process.exit(0);
    }
  }
  process.exit(0);
});
