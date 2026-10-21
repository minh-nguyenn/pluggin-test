# CLAUDE.md — Bảo trì plugin AI Tester

Thư mục này là **marketplace nội bộ `aitest`** chứa plugin **`ai-tester`** (kiểm thử UI website theo Figma & CMS). Tester dùng plugin trong repo website; thư mục này chỉ để phát triển và bảo trì plugin.

Ngôn ngữ làm việc: **tiếng Việt**.

## Cấu trúc

```
.claude-plugin/marketplace.json    # Marketplace "aitest" → plugin ./ai-tester
README.md                          # Hướng dẫn cho tester — cập nhật khi tính năng/cách dùng thay đổi
ai-tester/                         # Plugin root (${CLAUDE_PLUGIN_ROOT})
  .claude-plugin/plugin.json
  skills/test/SKILL.md             # Nguyên tắc + quy trình test (thay cho CLAUDE.md gốc trước đây)
  skills/retest/SKILL.md
  skills/cleanup/SKILL.md          # Chỉ người dùng gọi
  skills/update/SKILL.md           # Chỉ người dùng gọi — rà soát nền tảng
  agents/ui-reviewer.md            # Subagent kiểm tra chéo
  hooks/hooks.json                 # Chặn ghi mật khẩu; kiểm tra báo cáo
  scripts/*.cjs                    # Script của hook (CommonJS vì package.json là "type": "module")
  tools/run/run.mjs                # So sánh tự động Figma ↔ website (công cụ chính)
  tools/lib/figma.mjs              #   Figma REST API + cache (FIGMA_TOKEN)
  tools/lib/measure.mjs            #   Đo website: mọi viewport trong 1 lần mở Chrome
  tools/lib/compare.mjs            #   Ghép + so từng phần tử trong section
  tools/lib/image.mjs              #   Ảnh đối chiếu vùng NG
  tools/figma/comments.mjs         # Đọc comment Figma (FIGMA_TOKEN)
  package.json, package-lock.json  # playwright, pngjs, pixelmatch — `npm install` tại ai-tester/
  knowledge/                       # Quy tắc chung, checklist, bài học — AI ghi vào khi học
  templates/                       # Mẫu file cho `.ai-tester/` của repo website
```

Dữ liệu từng dự án nằm trong **repo website**, thư mục `.ai-tester/` (không nằm ở đây).

## Quy tắc bảo trì

1. **Không tự đặt giá trị** thông số test (viewport, sai số, mức độ bug...). Mọi giá trị lấy từ Figma hoặc người dùng xác nhận.
2. Plugin được cài từ marketplace thư mục local nên **nạp tại chỗ**: sửa file ở đây có hiệu lực ở phiên sau hoặc sau `/reload-plugins`. Không cần tăng version. Không thêm `version` vào `plugin.json` khi chưa thống nhất cách phát hành (version cố định sẽ chặn cập nhật nếu sau này phân phối qua git).
3. `knowledge/` là dữ liệu sống: AI ghi quy tắc chung và bài học vào đây khi test. Nếu sau này phân phối qua git (plugin bị copy vào cache), phải có cách đưa thay đổi `knowledge/` trở lại repo trước khi đổi cách cài.
4. Một thông tin — một nơi; số loại file cố định; chống phình không được làm giảm phạm vi hay độ chính xác test.
5. Giới hạn độ dài: `skills/*/SKILL.md` tối đa 500 dòng; `.ai-tester/CLAUDE.md` của dự án tối đa 200 dòng.
6. Mỗi lần sửa plugin: chạy `claude plugin validate ./ai-tester` và `claude plugin validate .`; chạy thử hook/script liên quan; cập nhật `README.md` nếu cách dùng thay đổi; cập nhật ngày "Rà soát lần cuối" trong `skills/test/SKILL.md` nếu thay đổi công cụ.
7. Hook chỉ được tác động lên `.ai-tester/` và `knowledge/`/`templates/` của plugin — không chặn hay sửa mã nguồn website.
8. Sửa `tools/lib/compare.mjs` hoặc `measure.mjs`: chạy lại bài tự kiểm tra (dựng Figma giả từ `styles.json` của một trang thật, cài vài lệch) — mọi lệch cài vào phải ra NG, phần còn lại ra OK.
