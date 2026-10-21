---
name: fix
description: AI Tester — sửa code các bug mà AI Tester đã ghi trong .ai-tester/bugs.md (theo Bug ID, theo màn hình, hoặc "tất cả bug sửa được"), rồi tự retest. Dùng khi người dùng yêu cầu fix/sửa bug sau lượt test.
argument-hint: "[Bug ID... | màn hình | tất cả]"
---

# Sửa bug AI Tester

Đầu vào: $ARGUMENTS

`D` = `.ai-tester/` ở gốc repo website. Đây là bước **duy nhất** của AI Tester được sửa mã nguồn website, và chỉ khi người dùng gọi.

## 1. Chọn bug
- Đọc `D/bugs.md` (bảng Tóm tắt + khối Chi tiết), `D/CLAUDE.md` (quy tắc dự án), và `CLAUDE.md` của repo (convention code).
- Danh sách sửa: Bug ID người dùng đưa; hoặc mọi bug của màn được nêu; hoặc "tất cả" = mọi bug trạng thái **Mới / Mở lại** có "Sửa được ngay? = Có".
- **Bỏ qua** bug "Cần xác nhận" / "Chờ xác nhận" / thiếu mục "Cách sửa" → liệt kê lại cho người dùng, không đoán.

## 2. Sửa
- Mỗi bug: mở đúng file trong "Cách sửa", đối chiếu "Hiện tại" với code thật (code có thể đã đổi từ lúc test — khác thì đọc lại và xác định lại vị trí, không sửa mù).
- Sửa **tối thiểu**, đúng giá trị Figma trong bug. Theo convention của repo: dùng token / utility / biến CSS có sẵn (vd giá trị co giãn theo viewport, token màu), không hard-code khi repo có cách chuẩn.
- Component dùng chung (mục "Ảnh hưởng") → kiểm tra màn khác đang dùng có bị ảnh hưởng không; nếu thay đổi làm lệch màn khác so với Figma của màn đó → dừng và hỏi.
- Không sửa thứ ngoài danh sách. Thấy lỗi khác trong lúc sửa → ghi vào báo cáo cuối, không tự sửa.
- Cập nhật trạng thái bug → "Đã sửa (chờ retest)", ghi file:dòng đã sửa vào khối Chi tiết.

## 3. Tự retest
- Chạy `/ai-tester:retest` cho các bug vừa sửa (dev server local tự tải lại code): `run.mjs` + đo lại tương tác nếu là bug tương tác.
- Bug vẫn NG → sửa lại một lần nữa nếu nguyên nhân rõ; còn NG → để "Mở lại" và báo người dùng.
- Kiểm hồi quy: dòng NG **mới** xuất hiện sau khi sửa → báo ngay (có thể do chính lần sửa).

## 4. Báo cáo trong chat
| Bug ID | File:dòng đã sửa | Thay đổi | Retest |
|---|---|---|---|

Kèm: bug bỏ qua (và lý do), lỗi hồi quy (nếu có), lệnh tiếp theo nếu còn bug (vd `/ai-tester:fix <ID…>`). Hết bug sửa được → ghi "Sẵn sàng bàn giao tester" kèm danh sách bug còn chờ xác nhận.

Không commit / push trừ khi người dùng yêu cầu.
