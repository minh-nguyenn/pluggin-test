# Checklist kiểm thử UI theo Figma

Áp dụng cho từng section, cả **PC** và **SP**. Mọi giá trị so sánh lấy từ Figma, phải khớp tuyệt đối (không có sai số). Mục nào không áp dụng → ghi "N/A" kèm lý do trong báo cáo.
Mục có đánh dấu `[+ YYYY-MM-DD]` là mục bổ sung từ bài học (xem `knowledge/lessons-learned.md`).

## A. Layout
- [ ] Thứ tự section/phần tử đúng Figma
- [ ] Căn lề (trái/giữa/phải), căn dọc
- [ ] Chiều rộng nội dung tối đa (max-width / container), padding hai bên
- [ ] Số cột, grid, gap giữa các item
- [ ] Vị trí phần tử cố định (header sticky, nút floating...)
- [ ] Không bị tràn ngang (horizontal scroll) ở mọi viewport

## B. Kích thước & khoảng cách
- [ ] Width/height của khối, ảnh, nút, icon
- [ ] Margin/padding giữa các section và trong component
- [ ] Khoảng cách giữa tiêu đề – nội dung – nút
- [ ] Border width, border-radius
- [ ] Shadow (offset, blur, màu, opacity)

## C. Typography
- [ ] Font family (kể cả font fallback tiếng Nhật)
- [ ] Font size, font weight
- [ ] Line-height, letter-spacing
- [ ] Màu chữ
- [ ] Text-align, xuống dòng chỉ định (`<br>`), giới hạn số dòng / ellipsis
- [ ] Text-decoration (underline link...)

## D. Màu sắc
- [ ] Background của section/khối
- [ ] Màu nút, border, divider
- [ ] Gradient (hướng, điểm màu)
- [ ] Opacity / overlay

## E. Hình ảnh & icon
- [ ] Đúng ảnh, đúng tỷ lệ, không méo, crop đúng vùng (object-fit / object-position)
- [ ] Độ nét (không mờ trên màn hình retina)
- [ ] Icon đúng loại, kích thước, màu
- [ ] Ảnh khác nhau giữa PC/SP (nếu Figma quy định)
- [ ] Thuộc tính alt có nội dung phù hợp

## F. Nội dung
- [ ] Text đúng từng ký tự so với Figma (dấu câu, full-width/half-width, ký hiệu)
- [ ] Không còn text placeholder / dummy
- [ ] Ngày tháng, số, đơn vị đúng định dạng

## G. Trạng thái & tương tác
- [ ] Hover, active, focus, disabled của link/nút
- [ ] Menu / accordion / tab / modal: trạng thái mở/đóng, animation nếu có thiết kế
- [ ] Form: placeholder, lỗi validate, trạng thái nhập
- [ ] Trạng thái rỗng (không có dữ liệu), loading
- [ ] Cursor pointer trên phần tử click được
- [ ] Slide / carousel: số slide, nút prev/next, dots, autoplay, vuốt trên SP, vòng lặp, trạng thái slide đầu/cuối `[+ 2026-10-21, L-01]`
- [ ] Modal / popup: mở, đóng (nút X, click nền, phím Esc), cuộn bên trong, khóa cuộn nền, hiển thị SP `[+ 2026-10-21, L-01]`

## H. Link & điều hướng
- [ ] Link đến đúng URL, mở cùng tab / tab mới đúng yêu cầu
- [ ] Anchor link cuộn đến đúng vị trí (không bị header che)
- [ ] Breadcrumb, pagination
- [ ] Phân trang: số trang, trang hiện tại, nút đầu/cuối/trước/sau, trạng thái disabled, URL khi chuyển trang `[+ 2026-10-21, L-01]`
- [ ] Số điện thoại / email: nội dung đúng từng ký tự, link `tel:` / `mailto:` đúng (đặc biệt trên SP) `[+ 2026-10-21, L-01]`

## I. Responsive (PC ↔ SP)
- [ ] Bố cục SP đúng Figma SP (thứ tự, số cột, ẩn/hiện phần tử)
- [ ] Breakpoint chuyển đổi PC/SP đúng quy định dự án
- [ ] Breakpoint trung gian (chỉ khi Figma có frame hoặc `CLAUDE.md` của dự án có quy định) không vỡ layout
- [ ] Hamburger menu / điều hướng SP
- [ ] Vùng chạm nút trên SP đủ lớn, không chồng lấn

## J. Trường hợp biên
- [ ] Text dài hơn thiết kế (tiêu đề dài, tên dài) — không vỡ layout
- [ ] Số lượng item nhiều/ít hơn thiết kế
- [ ] Ảnh lỗi / không có ảnh
- [ ] Các yêu cầu bổ sung trong `CLAUDE.md` của dự án
