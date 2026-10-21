---
name: update
description: AI Tester — rà soát nền tảng plugin theo năng lực mới của AI và công cụ (Claude Code, Figma MCP, trình duyệt), đề xuất cập nhật skill, subagent, hook, script, checklist.
disable-model-invocation: true
---

# Rà soát nền tảng

`P` = `${CLAUDE_PLUGIN_ROOT}`. Mục tiêu: test **nhanh hơn, chính xác hơn, ít bỏ sót hơn** khi AI và công cụ thay đổi.

## Các bước
1. Đọc nền tảng hiện tại: `P/skills/*/SKILL.md`, `P/agents/*.md`, `P/hooks/hooks.json`, `P/scripts/*`, `P/tools/*`, `P/knowledge/checklists/*`, `P/knowledge/lessons-learned.md`.
2. Tra tài liệu chính thức: Claude Code (skills, subagents, hooks, plugins), danh sách công cụ Figma MCP và công cụ trình duyệt có trong phiên.
3. So sánh và liệt kê đề xuất. Mỗi đề xuất gồm: thay đổi gì, ở file nào, lý do, lợi ích (nhanh hơn / chính xác hơn / ít bỏ sót hơn), rủi ro. Ưu tiên chuyển bước làm tay thành script/hook khi công cụ cho phép; ưu tiên các lỗi lặp lại trong `lessons-learned.md`.
4. Chỉ sửa sau khi người dùng duyệt từng đề xuất.
5. Sau khi sửa: cập nhật ngày "Rà soát lần cuối" ở mục 6 của `P/skills/test/SKILL.md`, cập nhật `README.md` ở thư mục marketplace nếu tính năng hoặc cách dùng thay đổi, chạy `claude plugin validate` cho plugin.

Không thay đổi nào được làm giảm phạm vi hay độ chính xác test.
