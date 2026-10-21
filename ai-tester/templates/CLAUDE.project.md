# CLAUDE.md — Dự án <Tên dự án>

> File dữ liệu dự án của AI Tester (`.ai-tester/CLAUDE.md` trong repo website). Quy trình nằm ở skill `/ai-tester:test` của plugin; file này **chỉ** chứa thông tin, quy tắc và quyết định riêng của dự án, tối đa 200 dòng. Không sao chép nội dung skill vào đây.
> Quy tắc ở file này được ưu tiên hơn `knowledge/common-rules.md`, nhưng không được ghi đè mục 1 (Nguyên tắc) của skill.
> Mọi giá trị trong file này phải có nguồn: Figma (node-id) hoặc người dùng xác nhận (ngày). Không có nguồn → để trống và hỏi.

## 1. Thông tin bắt buộc
Trước khi test, mọi dòng phải có giá trị hoặc ghi "Không áp dụng (người dùng xác nhận ngày …)".

| Mục | Giá trị | Nguồn |
|---|---|---|
| Tên dự án | | |
| Mã PROJECT (Bug ID) | | |
| Figma file | | |
| Styleguide / file base (link, node-id — hoặc "Không có") | | |
| Website (môi trường test) | | |
| Cách truy cập website (basic auth...) — không ghi mật khẩu | | |
| CMS | | |
| Quyền CMS hiện có | | |
| Được phép thao tác dữ liệu CMS? | | |
| Thang mức độ bug (riêng dự án, hoặc "dùng C-09") | | |
| Breakpoint chuyển PC/SP | | |
| Độ rộng thiết bị test thêm (PC / SP, theo C-05) | | |
| Figma token để đọc comment (chỉ ghi "đã có / chưa có") | | |
| Trình duyệt mục tiêu | | |
| Quy tắc chung nào KHÔNG áp dụng cho dự án | | |

## 2. Màn hình
Viewport width = width của frame Figma tương ứng. Viewport height: lấy từ Figma (vd frame FV dùng chiều cao màn hình) hoặc người dùng xác nhận — ảnh hưởng phần tử dùng `100vh`.

| Màn hình | Mã SCREEN | URL website | Frame PC (node-id) | Width × height viewport PC | Frame SP (node-id) | Width × height viewport SP | Frame trung gian | CMS liên quan |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

## 3. Section (mã SECTION dùng trong Bug ID; node-id + selector dùng cho `run.json`)
| Mã SCREEN | Tên section trong Figma | node-id PC | node-id SP | Selector website PC | Selector website SP | Nội dung CMS? | Mã SECTION |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## 4. Quy tắc & quyết định
Mỗi câu trả lời của người dùng được lưu tại đây đúng nội dung và đúng phạm vi đã xác nhận. Tra bảng này trước khi hỏi.

| ID | Phạm vi (dự án / màn hình / phần tử) | Quy tắc | Tình huống gốc / câu hỏi | Ngày | Trạng thái |
|---|---|---|---|---|---|
| R-01 | | | | | Hiệu lực / Thay thế bởi R-xx |

## 5. Câu hỏi đang chờ trả lời
Có câu trả lời → lưu vào mục 4, rồi xóa dòng câu hỏi khỏi bảng này.

| # | Ngày hỏi | Câu hỏi | Hạng mục bị ảnh hưởng |
|---|---|---|---|
| | | | |
