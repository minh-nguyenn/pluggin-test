# Checklist kiểm thử CMS

Mặc định **chỉ đọc**. Chỉ tạo/sửa/xóa dữ liệu khi người dùng cho phép rõ ràng và trên môi trường test.
Mục có đánh dấu `[+ YYYY-MM-DD]` là mục bổ sung từ bài học.

## A. Truy cập & phạm vi
- [ ] Ghi rõ quyền truy cập đang có và phần không truy cập được
- [ ] Xác định các trường CMS liên quan đến màn hình đang test

## B. Đối chiếu CMS ↔ website
- [ ] Từng trường (tiêu đề, nội dung, ảnh, ngày, danh mục, tag, link...) hiển thị đúng vị trí trên website
- [ ] Nội dung giống từng ký tự (kể cả xuống dòng, khoảng trắng, ký tự đặc biệt)
- [ ] Ảnh hiển thị đúng ảnh, đúng crop/kích thước
- [ ] Định dạng ngày/giờ, số
- [ ] Rich text: heading, list, link, bold, ảnh chèn hiển thị đúng style thiết kế

## C. Dữ liệu
- [ ] Dữ liệu thiếu (trường bắt buộc trống)
- [ ] Dữ liệu sai (lệch so với tài liệu/Figma/yêu cầu)
- [ ] Dữ liệu chưa được cập nhật (website hiển thị bản cũ, cache)
- [ ] Thứ tự sắp xếp (ngày, thứ tự thủ công)
- [ ] Trạng thái công khai / nháp / hẹn giờ đăng hiển thị đúng
- [ ] Số lượng item hiển thị, phân trang

## D. Trường hợp biên (khi được phép thao tác)
- [ ] Trường tùy chọn để trống → website không vỡ, không hiện nhãn thừa
- [ ] Text rất dài, ký tự đặc biệt, HTML
- [ ] Ảnh kích thước/tỷ lệ khác chuẩn
- [ ] Không có bài viết nào (trạng thái rỗng)

## E. Ghi nhận
- [ ] Liệt kê phần chưa kiểm tra được do thiếu quyền/thông tin
- [ ] Liệt kê mọi thay đổi đã thực hiện trên CMS (nếu có)
