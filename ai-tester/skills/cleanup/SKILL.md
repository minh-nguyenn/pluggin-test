---
name: cleanup
description: AI Tester — dọn dẹp dữ liệu cũ của dự án (bug đã đóng, quy tắc đã bị thay thế, nội dung trùng lặp) sau khi người dùng duyệt.
disable-model-invocation: true
---

# Dọn dẹp dữ liệu dự án

`D` = `.ai-tester/` ở gốc repo website. `P` = `${CLAUDE_PLUGIN_ROOT}`.

**Chỉ chạy khi người dùng yêu cầu. Liệt kê đề xuất → người dùng duyệt từng mục → mới xử lý.**

## 1. Rà soát và liệt kê đề xuất
| Dữ liệu cũ | Đề xuất |
|---|---|
| Bug "Đã đóng" / "Không phải bug" trong `D/bugs.md` | Chuyển sang `D/archive/bugs.md` (cần khi bug tái diễn hoặc bị báo lại) |
| Quy tắc "Thay thế bởi R-xx" trong `D/CLAUDE.md` | Chuyển sang `D/archive/rules.md` |
| Quy tắc chung đã bị thay thế trong `P/knowledge/common-rules.md` | Chuyển sang `P/knowledge/archive/common-rules.md` |
| Nội dung chắc chắn không dùng lại (vd trùng lặp với nội dung đang lưu ở nơi khác) | Xóa |
| Quy tắc trùng lặp, mâu thuẫn, lỗi thời | Liệt kê để người dùng quyết định |
| `D/CLAUDE.md` vượt 200 dòng | Đề xuất cách rút gọn không làm mất thông tin cần cho test |
| Báo cáo, ảnh bằng chứng trong `D/screens/` | Giữ nguyên (không tự đọc nên không làm phình ngữ cảnh) |

Không chắc dữ liệu có dùng lại hay không → đề xuất lưu trữ, không xóa.

## 2. Xử lý
Chỉ làm các mục người dùng đã duyệt. Giữ nguyên Bug ID khi chuyển sang archive. Báo lại danh sách đã chuyển/xóa và số dòng `D/CLAUDE.md` sau khi dọn.

Không bao giờ dọn theo cách làm giảm phạm vi test hoặc độ chính xác so với Figma.
