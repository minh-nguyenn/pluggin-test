---
name: retest
description: AI Tester — kiểm tra lại (retest) các bug đã được sửa trên website so với Figma, kèm kiểm tra hồi quy. Dùng khi người dùng yêu cầu retest bug theo Bug ID hoặc theo màn hình.
argument-hint: "[Bug ID... | tên màn hình]"
---

# Retest

Đầu vào: $ARGUMENTS

Áp dụng toàn bộ nguyên tắc và quy trình của skill `test`: đọc `${CLAUDE_PLUGIN_ROOT}/skills/test/SKILL.md` trước (mục 1–6, 8, 9). `D` = `.ai-tester/` ở gốc repo website.

## Các bước
1. Đọc `D/CLAUDE.md`, `D/bugs.md`, `D/figma-issues.md`, báo cáo gần nhất của màn hình. Xác định danh sách bug cần retest: theo Bug ID người dùng đưa, hoặc mọi bug "Đã sửa (chờ retest)" của màn hình được nêu. Không rõ → hỏi.
2. **Kiểm tra design có đổi không**: đọc lại giá trị Figma của các node trong từng bug, so với giá trị "Mong đợi" đã ghi. Khác → design đã thay đổi: báo người dùng ngay, đánh dấu bug đó "Chờ xác nhận", không kết luận retest cho bug đó.
3. Đo lại từng bug ở đúng viewport đã ghi, kèm bằng chứng mới (`<BugID>_<pc|sp>_site_retest-YYYYMMDD.png`).
4. **Kiểm tra hồi quy**: khu vực xung quanh, cả PC và SP, cả các độ rộng thiết bị của dự án (sửa PC có thể làm hỏng SP).
5. Bug giống một bug đã đóng → tra `D/archive/bugs.md`; tái diễn → ghi rõ và cập nhật `${CLAUDE_PLUGIN_ROOT}/knowledge/lessons-learned.md`.
6. Cập nhật trạng thái trong `D/bugs.md` (Đã đóng / Mở lại / Chờ xác nhận) và cột Retest.
7. Thêm kết quả vào mục "8. Kết quả retest" của báo cáo mới `D/screens/<screen>/report-YYYYMMDD.md` (loại test: Retest). Không xóa kết quả cũ.
8. Tóm tắt trong chat: số bug đã đóng / mở lại / chờ xác nhận, bug hồi quy mới (nếu có).
