# AI Tester — Plugin Claude Code kiểm thử UI theo Figma & CMS

AI Tester là plugin cho Claude Code. Cài vào **repo mã nguồn website**, tester gọi `/ai-tester:test` kèm link Figma và URL website. AI sẽ so sánh website với thiết kế, đối chiếu CMS, quản lý bug và báo cáo bằng tiếng Việt. Dữ liệu test được lưu ngay trong repo website, ở thư mục `.ai-tester/`.

---

## 1. Cài đặt

### Yêu cầu
- Claude Code (terminal, VS Code hoặc desktop app).
- **Node.js** và **Chrome** trên máy (script đo dùng Chrome có sẵn).
- Đã kết nối **Figma MCP** bằng tài khoản có quyền xem file design.
- Đã kết nối công cụ **trình duyệt**: Claude in Chrome hoặc trình duyệt tích hợp.

### Bước 1 — Lấy plugin về máy (một lần)
Copy hoặc clone thư mục `aitest` về máy, rồi cài thư viện cho script đo:
```
cd <đường dẫn>/aitest/ai-tester
npm install
```

### Bước 1b — Cài Figma token (một lần mỗi máy, bắt buộc để so sánh chính xác)
Token dùng để đọc toàn bộ thông số của frame Figma (vị trí, font, màu… của mọi phần tử) và đọc comment.
1. Tạo token: Figma › Settings › Security › Personal access tokens. Cấp quyền đọc **File content** và **Comments**.
2. Lưu token thành biến môi trường của tài khoản Windows. Mở PowerShell và chạy (thay `<token>` bằng token thật):
   ```
   [Environment]::SetEnvironmentVariable('FIGMA_TOKEN', '<token>', 'User')
   ```
   Token chỉ nằm trong biến môi trường của máy bạn, **không** nằm trong file nào. Script của plugin tự đọc biến này, không cần khởi động lại Claude Code.

### Bước 2 — Thêm marketplace (một lần mỗi máy)
Trong Claude Code:
```
/plugin marketplace add <đường dẫn>/aitest
```
Máy hiện tại đã được thêm sẵn (`C:/Users/minhh/Documents/aitest`).

### Bước 3 — Cài plugin cho repo website
Mở Claude Code **ở thư mục gốc repo website**, rồi:
```
/plugin install ai-tester@aitest
```
Khi được hỏi phạm vi, chọn **local**: chỉ bật cho bạn, trong repo này. Sau đó chạy `/reload-plugins` hoặc mở phiên mới.

> Hãy cài từ marketplace thư mục local như trên. Khi đó plugin được nạp **tại chỗ**, nên quy tắc chung và bài học mà AI ghi vào `ai-tester/knowledge/` được giữ lại, và mọi dự án cùng dùng chung.

---

## 2. Cách dùng

| Lệnh | Việc AI làm |
|---|---|
| `/ai-tester:test <thông tin>` | Test một màn hình: đọc Figma, đo website, kiểm tra chéo, ghi bug, viết báo cáo |
| `/ai-tester:retest <Bug ID… hoặc tên màn hình>` | Retest bug đã sửa, kèm kiểm tra hồi quy |
| `/ai-tester:cleanup` | Đề xuất dọn dữ liệu cũ; bạn duyệt rồi AI mới làm |
| `/ai-tester:update` | Rà soát công cụ AI mới và đề xuất nâng cấp plugin |

Bạn cũng có thể nói bằng lời, ví dụ "test màn hình TOP theo Figma này…". AI sẽ tự dùng skill `test`.

### Test màn hình đầu tiên của repo
```
/ai-tester:test
Màn hình: TOP
Figma PC: <link>
Figma SP: <link>
Website: <URL>
CMS: <URL> (nếu có)
Độ rộng thiết bị: PC 1366 / 1536 / 1600, SP 375
```
Lần đầu, AI tạo thư mục `.ai-tester/` và hỏi những thông tin còn thiếu, ví dụ: tên và mã dự án, mã màn hình, thang mức độ bug, cách truy cập website, quyền CMS, Figma token. Mỗi thông tin chỉ cần trả lời **một lần**.

### Các lần sau
- Màn hình mới: chỉ cần đưa link Figma và URL.
- Retest: `/ai-tester:retest ABC-TOP-MAINVISUAL-01 ABC-TOP-FOOTER-02`
- Thêm hoặc đổi quy tắc: nói trực tiếp kèm phạm vi, ví dụ "Nút CTA khi hover giảm opacity 0.7, áp dụng toàn dự án".

### Lưu ý
- **Mật khẩu và token** (basic auth, CMS, Figma): chỉ đưa khi AI cần. Hook sẽ chặn nếu AI định ghi chúng vào file.
- Khi AI hỏi, trả lời kèm **phạm vi áp dụng** (chỉ chỗ này / cả màn hình / cả dự án / mọi dự án) để AI không hỏi lại.
- AI chỉ **đọc** CMS, và **không sửa mã nguồn website**.
- **Figma token**: tạo tại Figma › Settings › Security › Personal access tokens. Token dùng để đọc comment trong Figma.

---

## 3. Viewport và quy tắc so sánh

- So **chính xác từng giá trị** ở đúng độ rộng frame Figma (PC, SP). **Không có sai số**: lệch 1px hay 1 mã màu đều là NG.
- Test thêm ở **độ rộng thiết bị** của dự án để kiểm tra layout không vỡ, căn lề, co giãn. Ở các độ rộng này AI không so từng px.

| Mã | Trường hợp | Cách xử lý |
|---|---|---|
| C-01 | Giá trị lẻ trong Figma (vd 13.33px) | So đúng với Figma, lệch là NG; bug giải thích vì sao lệch |
| C-02 | Font hiển thị khác giữa Figma / trình duyệt / OS | Chỉ so thuộc tính CSS; khác do cách vẽ chữ thì ghi chú |
| C-03 | Line-height | Quy đổi line-height Figma sang px rồi so; lệch là NG |
| C-04 | Ảnh bị nén | Không so pixel màu; kiểm tra đúng ảnh, kích thước, crop, độ nét |
| C-05 | Độ rộng test | So chính xác ở width frame Figma + lượt kiểm tra layout ở độ rộng thiết bị |
| C-07 | Figma không nhất quán trong cùng component | Dùng giá trị được dùng nhiều hơn; số lần bằng nhau thì hỏi |
| C-08 | Lưới chia cột lệch do Figma làm tròn (vd 334 trong 335) | Chấp nhận site chia đều |
| C-09 | Thang mức độ bug | High (chức năng hỏng, 404, sai nội dung) / Medium (lệch dễ thấy) / Low (lệch nhỏ vài px) |
| C-06 | Git | Commit `.ai-tester/`; không commit ảnh/số liệu bằng chứng (`evidence/`) |

Danh sách mới nhất: [ai-tester/knowledge/common-rules.md](ai-tester/knowledge/common-rules.md).

---

## 4. Kết quả nằm ở đâu (trong repo website)

| Nội dung | Vị trí |
|---|---|
| Báo cáo từng lượt test | `.ai-tester/screens/<màn-hình>/report-YYYYMMDD.md` |
| Ảnh & số liệu đo | `.ai-tester/screens/<màn-hình>/evidence/` |
| Danh sách bug | `.ai-tester/bugs.md` |
| Vấn đề / comment trong Figma | `.ai-tester/figma-issues.md` |
| Quy tắc đã xác nhận, câu hỏi đang chờ | `.ai-tester/CLAUDE.md` |
| Giá trị chuẩn từ styleguide | `.ai-tester/styleguide.md` |

**Git:** commit thư mục `.ai-tester/` cùng repo website để cả đội xem được bug và báo cáo. Ảnh và số liệu bằng chứng (`evidence/`) **không** được commit, vì `.ai-tester/.gitignore` do AI tạo đã loại trừ chúng. Chúng chỉ nằm trên máy người test. Vì vậy mỗi bug và báo cáo luôn ghi đủ giá trị Figma, giá trị đo và chênh lệch, để người đọc hiểu được mà không cần ảnh.

Trạng thái mỗi hạng mục: **OK** / **NG** / **Cần xác nhận (Need Check)** / **Chưa kiểm tra** / **Không thể kiểm tra**.
**Bug ID**: `ABC-TOP-MAINVISUAL-01` = mã dự án – mã màn hình – section (theo Figma) – số thứ tự.

---

## 5. Tính năng

| Tính năng | Mô tả |
|---|---|
| Khởi tạo dự án | Tạo `.ai-tester/` trong repo website; tự đọc frame, width, section, node-id từ Figma; hỏi thông tin còn thiếu một lần |
| Đọc Figma toàn diện | Đọc hết thông số màn được giao, màn và component liên quan, styleguide / design system, comment Figma |
| Đối chiếu màn tương tự | Khi Figma không thống nhất, tìm màn có layout tương tự làm bằng chứng khi hỏi |
| Test UI | Không sai số; mỗi lỗi ghi mong đợi / thực tế / chênh lệch; checklist gồm layout, kích thước, khoảng cách, font, màu, ảnh, nội dung, trạng thái, link, slide, modal, phân trang, số điện thoại, responsive, trường hợp biên |
| So sánh tự động | `tools/run/run.mjs`: đọc Figma một lần (có cache, tự báo khi design đổi), đo mọi độ rộng trong một lần mở trình duyệt, so **từng phần tử** (chữ: nội dung, font, cỡ, độ đậm, line-height, letter-spacing, màu, vị trí; khối: vị trí, kích thước, nền, bo góc, viền, shadow; ảnh/icon: vị trí, kích thước), xuất bảng NG và ảnh [Figma \| website] của vùng lệch, **so ảnh chồng** cả section để bắt vùng khác mà so số liệu không thấy (hoạ tiết, ảnh nền, icon sai hình). Một màn PC + SP + 2 độ rộng thiết bị chạy khoảng 1 phút |
| Test CMS | Đối chiếu từng trường CMS với website |
| Kiểm tra chéo | Subagent `ui-reviewer` chạy song song ngay từ đầu, độc lập với lượt 1: kiểm tra tương tác bằng chuột thật, link, nội dung, trường hợp biên, và tự đo 10 phần tử mẫu để kiểm chứng script. Hai lượt khác nhau thì đo lại bằng công cụ khác. Không chạy khi retest |
| Quản lý bug & retest | Bug theo màn hình → section, có bằng chứng; retest kiểm tra design đã đổi chưa và kiểm tra hồi quy |
| Hỏi ngay, không đoán | Gặp điểm chưa rõ thì hỏi ngay; lưu câu trả lời để không hỏi lại |
| Hook bảo vệ | Chặn ghi mật khẩu/token vào `.ai-tester/`; tự kiểm tra báo cáo thiếu mục hoặc kết luận quá mức |
| Học hỏi | Quy tắc chung và bài học dùng chung cho mọi dự án, tại `ai-tester/knowledge/` |

---

## 6. Lưu ý hiện tại
- Đã chạy thử lần đầu trên repo La Class Recruit (màn TOP); bài học ghi ở [lessons-learned.md](ai-tester/knowledge/lessons-learned.md). Công cụ so sánh tự động (`run.mjs`) được viết sau lần chạy đó: phần đo website đã chạy thật, phần so với Figma mới kiểm chứng bằng dữ liệu giả — cần chạy thật với Figma token.
- Hãy báo lại chỗ AI làm chưa đúng; AI sẽ ghi thành bài học.
- Bảo trì plugin: xem [CLAUDE.md](CLAUDE.md).
