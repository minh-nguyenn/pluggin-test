# Bài học kinh nghiệm

Ghi lại: lỗi bị bỏ sót ở lượt 1, lỗi người dùng chỉ ra mà AI không phát hiện, lỗi tái diễn, vấn đề quy trình, và nguyên nhân gốc đã xác minh.
Mỗi bài học phải dẫn đến một hành động cụ thể (thêm mục checklist, thêm bước quy trình...).

## 1. Bài học

| # | Ngày | Dự án / Màn hình | Chuyện gì xảy ra | Vì sao bỏ sót / nguyên nhân | Hành động phòng tránh | Phạm vi (chung/riêng) | Đã xử lý (mục checklist / file dự án) |
|---|---|---|---|---|---|---|---|
| L-01 | 2026-10-21 | Chung | Prompt tester đang dùng yêu cầu kiểm tra slide, modal, phân trang, số điện thoại; checklist chưa có | Checklist ban đầu chưa bao quát các component tương tác thường gặp | Thêm mục kiểm tra slide, modal, phân trang, SĐT/email | Chung | `ui-checklist.md` mục G, H |
| L-02 | 2026-10-21 | RECRUIT / TOP (lần chạy đầu) | Lượt test chạy ~43 phút vẫn chưa xong (chưa có báo cáo, kiểm tra chéo dừng giữa chừng) | Mỗi phép đo viết script tạm mới và khởi động lại trình duyệt (~30 lần Bash, 10–145s/lần); đọc ~25 ảnh ở lượt 1 + 53 ảnh ở lượt 2 (~20MB) để so bằng mắt; `get_design_context` trả 50–150KB/lần; subagent làm lại toàn bộ từ đầu (20 lần `get_design_context`, 22 phút) | Script so sánh tự động Figma ↔ website theo từng phần tử, đo mọi độ rộng trong một lần mở trình duyệt, cache dữ liệu Figma, chỉ xem ảnh vùng lệch, giới hạn phạm vi kiểm tra chéo | Chung | Chờ người dùng duyệt phương án tối ưu |
| L-03 | 2026-10-21 | RECRUIT / TOP | Nhiều section được kết luận "khớp hình" sau khi xem ảnh ghép Figma/site | So bằng mắt, không có bảng giá trị từng phần tử → không chứng minh được khớp từng px | Kết luận OK chỉ khi có bảng giá trị Figma vs đo được cho từng phần tử; ảnh chỉ dùng để tìm vùng nghi ngờ | Chung | Chờ người dùng duyệt phương án tối ưu |
| L-04 | 2026-10-21 | RECRUIT / TOP | Đo theo `top.check.json` do dev tự viết từ Figma | Spec của dev là cách dev hiểu Figma → kiểm tra vòng tròn, sai trong spec không bị phát hiện; chỉ phủ 123 điểm đo | Giá trị mong đợi phải lấy trực tiếp từ Figma (node-id); spec của dev chỉ để tham khảo | Chung | Chờ người dùng duyệt phương án tối ưu |
| L-05 | 2026-10-21 | RECRUIT / TOP | AI đưa lựa chọn "Đề xuất mặc định" cho cả nhóm thông tin bắt buộc; độ rộng thiết bị (SP 360/375/400/767, PC 768/1064/1366/1920) và quyền CMS được chốt theo đề xuất của AI | Gộp nhiều giá trị vào một lựa chọn "mặc định" → người dùng không thấy từng giá trị | Không dùng lựa chọn "mặc định" gộp; liệt kê từng giá trị kèm nguồn để người dùng xác nhận từng mục | Chung | Skill `test` mục 4 |
| L-06 | 2026-10-21 | RECRUIT / TOP | AI sửa nhầm tool trong repo website (`.claude/tools/…` bằng `sed -i`) rồi tự hoàn lại | Muốn chỉnh tham số tool của dev nên sửa thẳng file | Muốn dùng tool của repo với tham số khác → copy vào scratchpad; không bao giờ sửa file ngoài `.ai-tester/` | Chung | Skill `test` mục 1 (nguyên tắc 12) |
| L-07 | 2026-10-21 | RECRUIT / TOP | Lượt 1 ghi anchor link OK (đo bằng `element.click()` 1 lần, target top 70); lượt 2 và đo lại sau đó: anchor không cuộn (bug High) | Chỉ đo tương tác 1 lần ở đầu phiên, không dùng chuột thật, không đo lại trước khi kết luận; site dev có thể deploy lại trong lúc test | Tương tác quan trọng (anchor, slider, modal, menu) đo bằng sự kiện chuột thật + kiểm thay đổi trạng thái (scrollY, class mở), và chạy lại ngay trước khi viết báo cáo; ghi giờ đo | Chung | `ui-checklist.md` mục G, H (thêm 2026-10-21) |
| L-08 | 2026-10-21 | RECRUIT / TOP | Lượt 1 bỏ sót: letter-spacing caption FV PC, padding nhãn お知らせ, kích thước icon mũi tên card, mega-menu PC và drawer SP lệch Figma | Dựa vào file thông số có sẵn của dev (`*.check.json`) — chỉ có các thuộc tính dev chọn; trạng thái mở menu header không nằm trong lượt so ảnh trang | So mọi thuộc tính typography (cả letter-spacing) của mọi text với Figma (script `run.mjs`); mở và so từng trạng thái của header (mega-menu, drawer) với frame Figma tương ứng; so icon phóng to | Chung | `ui-checklist.md` mục C, E, G (thêm 2026-10-21); script `tools/run/run.mjs` |
| L-09 | 2026-10-21 | RECRUIT / TOP (lần 2, có `run.mjs`) | Lượt test vẫn ~23 phút: `run.mjs` crash 3 lần (hover vào link menu SP đang ẩn → chờ timeout 30s; hàm cắt ảnh đọc ra ngoài buffer), AI vá bản sao rồi chạy lại 4 lần (~10 phút); AI tự viết script cắt/phóng ảnh; subagent tự viết script kiểm link/anchor (54 lần Bash) | Lỗi của plugin; script chưa có kiểm link/anchor, chưa đo song song, PNG Figma tải tuần tự sau khi đo | Sửa hover (chỉ phần tử hiển thị, timeout 3s, không crash) và cắt ảnh; đo song song 3 viewport; viewport layout đo nhẹ; tải PNG Figma song song lúc đo; tự kiểm status link + click anchor; `crop.mjs`; ảnh review tự phóng to; thu hẹp subagent. Cấu hình thật 9 viewport/14 section: từ ~10 phút còn 59s (lần đầu), ~37s (PC+SP) | Chung | `tools/run`, `tools/lib`, skill `test` mục 6, `ui-reviewer` |

> Ghi chú 2026-10-21: L-07, L-08 do phiên test ghi nhầm số hiệu (L-02, L-03) và nhầm bảng; đã chuyển về đây.

## 2. Kinh nghiệm từ các câu hỏi

Mỗi lần AI phải hỏi người dùng → ghi 1 dòng: vì sao phải hỏi và lần sau làm gì để hỏi sớm hơn / không phải hỏi lại. Câu trả lời cụ thể vẫn lưu ở quy tắc (R-xx / C-xx); ở đây chỉ ghi kinh nghiệm.

| Ngày | Dự án / Màn hình | Câu hỏi | Vì sao phải hỏi | Câu trả lời (ID quy tắc) | Lần sau làm gì |
|---|---|---|---|---|---|
| 2026-10-21 | RECRUIT / TOP | URL người dùng đưa (`entetsu-reform.entetsu.org`) là site khác, `/recruit` 404 | Đầu vào sai site; AI mất ~6 phút dò URL trước khi hỏi | Dùng `la-class.entetsu.org` (`.ai-tester/CLAUDE.md` mục 1) | Bước kiểm tra đầu vào: mở URL, đối chiếu title/đường dẫn với dự án và Figma; sai → hỏi ngay trong 1 phút đầu |
| 2026-10-21 | RECRUIT | Mã PROJECT cho Bug ID | Dự án mới, skill cấm tự đặt | `RECRUIT` | Hỏi chung với các thông tin khởi tạo khác trong một lần |
| 2026-10-21 | RECRUIT | Test 1 màn hay cả ~17 màn | Đầu vào chỉ ghi "recruit" | Chỉ TOP | Đầu vào phải nêu màn hình cụ thể; thiếu → hỏi phạm vi ngay từ đầu |
| 2026-10-21 | RECRUIT | Các thông tin bắt buộc còn thiếu (quyền CMS, độ rộng thiết bị…) | Template có nhiều mục bắt buộc | "Đề xuất mặc định" | Xem L-05: liệt kê từng giá trị, không gộp "mặc định" |
| 2026-10-21 | RECRUIT | Thang mức độ bug | `common-rules.md` chưa có thang nào | High / Medium / Low (riêng dự án) | Hỏi người dùng có muốn đưa thang này thành quy tắc chung không, để dự án sau khỏi hỏi |
| 2026-10-21 | RECRUIT / TOP | Footer SP: cùng component mà Figma có mục cao 45px và 48px | Figma không nhất quán trong cùng component | Dùng 48px vì được dùng nhiều hơn (R-06 dự án) | Gặp component không nhất quán → đếm số lần dùng mỗi giá trị, đưa vào câu hỏi; hỏi luôn phạm vi (AI đã tự ghi "không suy rộng" mà không hỏi phạm vi) |
| 2026-10-21 | RECRUIT / TOP | Lưới 2 cột SP: Figma tổng 334 trong khung 335, site chia đều 157.5/163.5 | Figma thiếu 1px, không thể khớp tuyệt đối cả hai | Chấp nhận chia đều (R-07 dự án) | Lỗi làm tròn kiểu này có thể lặp ở dự án khác → hỏi người dùng có áp dụng chung không |
| 2026-10-21 | RECRUIT / TOP | Khối お知らせ TOP ẩn khi không có tin, trái với quy tắc "list rỗng hiện câu trống" | Quy tắc dự án mâu thuẫn với code hiện tại | TOP được ẩn — ngoại lệ (R-04 dự án) | Khi thấy ngoại lệ của quy tắc đã có → ghi ngoại lệ ngay cạnh quy tắc gốc |

## 3. Hiệu quả kiểm tra chéo

Mỗi lượt test đầu của một màn hình → 1 dòng. Dùng để quyết định đưa loại lỗi nào vào script/checklist lượt 1, và khi nào thu hẹp lượt 2.

| Ngày | Dự án / Màn hình | Lượt 2 phát hiện mới (số, theo loại) | Kiểm chứng script (số điểm sai / 10) | Vùng so ảnh chồng chưa giải thích | Hành động |
|---|---|---|---|---|---|
| 2026-10-21 | RECRUIT / TOP (trước khi có `run.mjs`) | 5: tương tác 1 (anchor không cuộn), typography 1 (letter-spacing), spacing 1 (padding nhãn), icon 1, trạng thái header 1 | — | — | Đã đưa vào checklist (L-07, L-08) và script (`run.mjs` so mọi typography) |
