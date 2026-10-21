# Báo cáo kiểm thử — <Dự án> / <Màn hình>

## 1. Thông tin chung
| Mục | Nội dung |
|---|---|
| Dự án | |
| Màn hình | |
| Figma PC / SP | |
| Website | |
| CMS | |
| Ngày test | YYYY-MM-DD |
| Môi trường / trình duyệt | |
| Viewport | PC: <width frame Figma> (node-id) / SP: <width frame Figma> (node-id) |
| Loại test | Lần đầu / Retest |
| Phiên bản code | Nhánh · commit · số file chưa commit (từ `summary.md`) |
| Phiên bản Figma | Thời điểm đọc + version/lastModified nếu công cụ cung cấp; giá trị Figma của các node đã đối chiếu lưu trong bảng mục 3 |

## 2. Tóm tắt
| Trạng thái | Số hạng mục |
|---|---|
| OK | |
| NG | |
| Cần xác nhận | |
| Chưa kiểm tra | |
| Không thể kiểm tra | |
| **Tổng** | |

| Mức độ bug (theo thang đã xác nhận trong rules) | Số lượng |
|---|---|
| | |

## 3. Kết quả từng hạng mục
| ID | Khu vực | Hạng mục | PC/SP | Mong đợi (Figma + node-id) | Thực tế | Chênh lệch | Trạng thái | Bug ID | Bằng chứng |
|---|---|---|---|---|---|---|---|---|---|
| UI-01 | | | | | | | | | |

## 4. Bug phát hiện (theo mức độ)
| Bug ID | Mức độ | Loại | Vị trí | Mô tả lỗi | Mong đợi | Thực tế | Chênh lệch | Nguyên nhân (nếu biết) | Bằng chứng | Lượt phát hiện |
|---|---|---|---|---|---|---|---|---|---|---|

## 5. Vấn đề chưa rõ trong Figma — cần người dùng xác nhận
1. **[FI-xxx]** Vị trí: … — Figma PC: … / Figma SP: … / Website: … — Đề xuất: …

## 6. Hạng mục chưa kiểm tra / không thể kiểm tra
| ID | Hạng mục | Lý do | Cần gì để kiểm tra |
|---|---|---|---|

## 7. Kiểm tra chéo (lượt 2)
- Phương pháp:
- Bug mới phát hiện ở lượt 2:
- Bài học ghi vào `knowledge/lessons-learned.md`:

## 8. Kết quả retest
| Bug ID | Ngày retest | Kết quả (Đã đóng / Mở lại) | Bằng chứng | Ghi chú hồi quy |
|---|---|---|---|---|

## 9. Kết luận
<!-- Trung thực về phạm vi. Ví dụ: "Đã kiểm tra 42/50 hạng mục; 8 hạng mục chưa kiểm tra do chưa có quyền CMS. Phát hiện 5 bug (1 High, 3 Medium, 1 Low). Chưa thể kết luận màn hình khớp hoàn toàn với Figma." -->

**Lệnh sửa** (bug sửa được ngay):
```
/ai-tester:fix <Bug ID …>
```
**Cần xác nhận trước khi sửa**: <Bug ID — câu hỏi>
**Trạng thái bàn giao**: Chưa sẵn sàng / Sẵn sàng bàn giao tester
