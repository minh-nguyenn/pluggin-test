# Quy tắc chung (áp dụng mọi dự án)

Chỉ ghi vào đây những quy tắc **người dùng đã xác nhận áp dụng chung**. Quy tắc riêng dự án → mục "Quy tắc & quyết định" trong `.ai-tester/CLAUDE.md` của repo website.
| # | Quy tắc | Ngày | Nguồn | Ghi chú |
|---|---|---|---|---|
| C-01 | **Giá trị lẻ trong Figma** (vd 13.33px): so giá trị đo được trên website với đúng giá trị Figma; lệch là NG. Trong bug phải giải thích cho tester: giá trị Figma, giá trị trình duyệt hiển thị/làm tròn, chênh lệch bao nhiêu và vì sao. | 2026-10-19 | Người dùng xác nhận | Áp dụng mọi dự án |
| C-02 | **Font render khác nhau** (độ đậm, khử răng cưa, độ rộng chữ giữa Figma/trình duyệt/OS): chỉ so thuộc tính CSS (font-family, font-size, font-weight, line-height, letter-spacing). Khác biệt chỉ do cách vẽ chữ → ghi chú, không tính NG. | 2026-10-19 | Người dùng xác nhận | Áp dụng mọi dự án |
| C-03 | **Line-height**: quy đổi line-height của Figma (%, Auto...) sang px rồi so với computed line-height; lệch là NG. Vị trí chữ lệch chỉ do khác cách tính line-height (khi giá trị quy đổi đã khớp) → không tính NG. Figma để Auto mà không quy đổi được chắc chắn → hỏi theo mục 4 của skill. | 2026-10-19 | Người dùng xác nhận | Áp dụng mọi dự án |
| C-05 | **Độ rộng test**: (1) so chính xác từng giá trị ở đúng width frame Figma (PC, SP); (2) thêm một lượt ở các độ rộng thiết bị của dự án (vd PC 1366/1536/1600 — lấy từ file dự án, chưa có thì hỏi) để kiểm tra layout không vỡ, căn lề, co giãn, ẩn/hiện, xuống dòng — không so từng px ở các độ rộng này vì Figma không có thiết kế tương ứng. | 2026-10-21 | Người dùng xác nhận | Áp dụng mọi dự án |
| C-04 | **Ảnh bị nén** (jpg/webp): không so pixel màu ảnh. Kiểm tra đúng ảnh, kích thước, tỷ lệ, crop, độ nét. Lệch màu do nén không tính NG. | 2026-10-19 | Người dùng xác nhận | Áp dụng mọi dự án |
