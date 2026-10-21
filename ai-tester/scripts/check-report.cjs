// PostToolUse (Write|Edit): kiểm tra báo cáo test có đủ mục bắt buộc và không kết luận quá mức.
const fs = require('fs');
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  const ti = input.tool_input || {};
  const file = String(ti.file_path || '').replace(/\\/g, '/');
  if (!/\/\.ai-tester\/screens\/[^/]+\/report-\d{8}\.md$/.test(file)) process.exit(0);

  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { process.exit(0); }
  const problems = [];

  const required = [
    '## 1. Thông tin chung', '## 2. Tóm tắt', '## 3. Kết quả từng hạng mục', '## 4. Bug phát hiện',
    '## 5. Vấn đề chưa rõ trong Figma', '## 6. Hạng mục chưa kiểm tra', '## 7. Kiểm tra chéo',
    '## 8. Kết quả retest', '## 9. Kết luận',
  ];
  for (const h of required) if (!text.includes(h)) problems.push(`Thiếu mục "${h}".`);
  if (!/\|\s*Phiên bản Figma/.test(text)) problems.push('Thiếu dòng "Phiên bản Figma" trong Thông tin chung.');

  const count = (label) => {
    const m = text.match(new RegExp(`\\|\\s*${label}\\s*\\|\\s*(\\d+)\\s*\\|`));
    return m ? Number(m[1]) : null;
  };
  const open = ['Cần xác nhận', 'Chưa kiểm tra', 'Không thể kiểm tra'].map(count);
  const fullyCovered = open.every((n) => n === 0);
  const forbidden = text.match(/khớp\s*100\s*%|hoàn hảo|không có lỗi|đã test đầy đủ/i);
  if (forbidden && !fullyCovered) {
    problems.push(
      `Có cụm "${forbidden[0]}" nhưng phần Tóm tắt chưa cho thấy 0 hạng mục Cần xác nhận / Chưa kiểm tra / Không thể kiểm tra. Sửa kết luận cho trung thực.`
    );
  }

  if (problems.length) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `Báo cáo ${file} chưa đạt yêu cầu:\n- ${problems.join('\n- ')}`,
    }));
  }
  process.exit(0);
});
