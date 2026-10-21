# Danh sách bug — <Tên dự án>

Bug ID: `<PROJECT>-<SCREEN>-<SECTION>-<số thứ tự>` (mã lấy từ `CLAUDE.md` của dự án)
Mức độ: theo thang trong `CLAUDE.md` của dự án / C-09
Trạng thái: Mới → Đang sửa → Đã sửa (chờ retest) → Đã đóng / Mở lại / Không phải bug / Chờ xác nhận

## Tóm tắt

| Bug ID | Màn hình | Section / phần tử | PC/SP | Loại | Mức độ | Mô tả ngắn | Sửa được ngay? | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | Có / Cần xác nhận | |

## Chi tiết

<!-- Mỗi bug một khối như dưới. Mục "Thông tin để sửa" chỉ ghi DỮ KIỆN, đủ để Claude của dự án sửa mà không cần đo lại;
     cách triển khai (token, utility, cấu trúc component…) do Claude của dự án quyết định theo CLAUDE.md và .claude/ của repo. -->

### <Bug ID> — <mô tả ngắn>
- **Vị trí hiển thị**: <màn hình> · <section> · <phần tử> · <PC/SP, viewport>
- **Mô tả**: <1–2 câu dễ hiểu cho người không đọc code>
- **Mong đợi (Figma)**: <giá trị> — node `<node-id>` (Figma lastModified <...>)
- **Thực tế (đo)**: <giá trị> — <cách đo, giờ đo, commit>
- **Chênh lệch**: <vd +4px, #333333 → #3A3A3A>
- **Căn cứ**: <C-xx / R-xx nếu có>
- **Bằng chứng**: `screens/<screen>/evidence/<...>` (chỉ trên máy người test)
- **Thông tin để sửa**:
  - Vị trí code: `<đường dẫn>:<dòng>` (component / class / biến CSS / hằng số liên quan)
  - Hiện tại: `<đoạn code hoặc giá trị hiện tại>`
  - Cần đạt: <giá trị đúng theo Figma, vd letter-spacing 1.5px, màu #0f5eb2, href tới trang tồn tại>
  - Ảnh hưởng: <component dùng chung ở đâu khác — cần kiểm lại màn nào>
  - Kiểm lại: <cách xác nhận sau khi sửa, vd `/ai-tester:retest <Bug ID>`, dòng nào trong `compare.json` phải thành OK>
- **Phát hiện**: <ngày>, lượt <1/2>
- **Trạng thái**: <...> · **Retest**: <ngày, kết quả>
