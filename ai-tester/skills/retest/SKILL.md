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
2. **Chạy lại `run.mjs`** với `D/screens/<s>/run.json` đã có (cùng thư mục cache Figma). Script tự so `lastModified` của Figma với lần trước:
   - Figma **đã đổi** → `summary.md` có cảnh báo ⚠. Với từng bug: so giá trị "Mong đợi" đã ghi với giá trị Figma mới (`compare.json`). Khác → design đã thay đổi: báo người dùng, đánh dấu bug đó "Chờ xác nhận", không kết luận retest cho bug đó.
   - Figma không đổi → dùng kết quả để kết luận từng bug.
3. Mỗi bug: tìm dòng tương ứng trong `compare.json` (cùng section, phần tử, thuộc tính) → OK thì "Đã đóng", còn NG thì "Mở lại". Bug tương tác/link/nội dung → đo lại bằng chuột thật / `curl`, ghi giờ đo.
4. **Kiểm tra hồi quy**: mọi dòng NG mới trong `summary.md` (không thuộc bug cũ) ở cả PC, SP và các độ rộng thiết bị → xử lý như lượt test thường (áp quy tắc, hỏi nếu chưa có căn cứ, ghi bug mới).
5. Bug giống một bug đã đóng → tra `D/archive/bugs.md`; tái diễn → ghi rõ và cập nhật `${CLAUDE_PLUGIN_ROOT}/knowledge/lessons-learned.md`.
6. Cập nhật trạng thái trong `D/bugs.md` (Đã đóng / Mở lại / Chờ xác nhận) và cột Retest.
7. Thêm kết quả vào mục "8. Kết quả retest" của báo cáo mới `D/screens/<screen>/report-YYYYMMDD.md` (loại test: Retest). Không xóa kết quả cũ.
8. Tóm tắt trong chat: số bug đã đóng / mở lại / chờ xác nhận, bug hồi quy mới (nếu có).
9. Còn bug Mở lại / hồi quy sửa được → in lại lời nhắc sửa cho Claude của dự án (như Bước 7 skill `test`): `Fix các bug <ID…> theo mục "Thông tin để sửa" trong .ai-tester/bugs.md, tuân theo CLAUDE.md và .claude của dự án.` Hết bug → "Sẵn sàng bàn giao tester" (kèm bug còn chờ xác nhận, nếu có).

AI Tester không sửa code khi retest — chỉ đo, kết luận và cập nhật `D/bugs.md`.

**Không chạy kiểm tra chéo (`ui-reviewer`) khi retest** — `run.mjs` (so số liệu + so ảnh chồng) và kiểm tra hồi quy đã đủ. Ngoại lệ: Figma đổi nhiều, hoặc website sửa lớn (layout/section mới) → hỏi người dùng có chạy lại như lượt test đầu không.
