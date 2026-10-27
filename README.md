# Gõ Mây

Demo luyện gõ **tiếng Việt có dấu**, dành cho trẻ em và người lớn. HTML + CSS + JavaScript thuần, không framework, không CDN, không bước build. Ảnh SVG vẽ trực tiếp, có sẵn trong thư mục assets.

## Chạy ngay

- Mở **index.html** bằng Chrome/Edge để dùng trực tiếp, kể cả khi không có mạng. Không cần Node cho cách này. Trình duyệt có thể xử lý lưu trữ dưới `file://` khác nhau.
- Cách khuyến nghị trên Windows: mở **Mo-Go-May.cmd**, rồi truy cập **http://127.0.0.1:4173**. Cần Node.js >=18.
- Hoặc chạy `npm start` / `node server.cjs` tại thư mục này. Không cần `npm install`. Server chỉ lắng nghe loopback, không mở ra mạng LAN. Địa chỉ/cổng cố định giúp giữ cùng vùng lưu trữ.

## Có gì trong demo

- Khu vườn 2D và thỏ di chuyển theo tiến độ. Chế độ tập trung ẩn khu vườn.
- 12 bài tiếng Việt: 6 miễn phí và 6 bài Plus có nhãn khóa. Mỗi bài là một đoạn luyện; chưa phải giáo trình chuyên sâu dạy 10 ngón theo từng hàng phím.
- Bàn phím QWERTY màu theo ngón; nhận phím thật đang bấm, đánh dấu F/J ở đầu bài. Không suy diễn một phím vật lý duy nhất cho chữ Việt có dấu.
- Bộ gõ do máy người dùng cung cấp (UniKey/EVKey/IME hệ điều hành). Chưa cài bộ gõ tiếng Việt thì cần bật/cài bộ gõ tương ứng. Web không tự chuyển Telex.
- Từ đang ghép dấu được để tạm, chỉ đánh dấu sai khi chốt bằng dấu cách/Enter. Câu cuối tự hoàn thành khi khớp chính xác cả chữ hoa, dấu câu. Chuẩn hóa Unicode NFC. Có thể quay lại sửa. Không cho paste/drop qua thao tác giao diện.
- Lỗi là khoảng cách chỉnh sửa ở từ đã chốt, được ghi nhận một lần cho mỗi cặp vị trí/nội dung sai trong lượt luyện. Sau khi sửa, lỗi đã ghi vẫn được tính. Đây là điểm luyện tập đơn giản, không phải phép đo chuẩn hóa mọi thao tác bàn phím/IME.
- WPM = ký tự đúng / 5 / số phút. Thời gian chạy khi ô nhập đang được chọn; tạm dừng khi chuyển tab/view hoặc mở hộp thoại. Số liệu realtime có thể dao động với bài ngắn.
- Kết quả, cài đặt và chế độ xem thử Plus lưu localStorage (`go-may:v1`), tối đa 200 lượt. Có xuất JSON để giữ bản sao, chưa có nhập bản sao. Dữ liệu hỏng/bị chặn không làm ngừng luyện.
- Lộ trình, bộ lọc bài học, thống kê, lịch sử, âm thanh tùy chọn, hướng dẫn Telex, hỗ trợ reduced motion và giao diện màn hình nhỏ. Sản phẩm hướng tới bàn phím vật lý.

## Dùng thử và trả phí

Nút **Khám phá Plus → Xem thử Plus miễn phí** mở khóa demo trên máy. Có thể tắt trong Cài đặt. **Không có giao dịch, đăng nhập Google hay gói đã mua thật.** Các bài miễn phí không hết hạn. Chưa chốt giá, chưa thu dữ liệu người dùng.

**Không dùng khóa JavaScript/localStorage này để bảo vệ sản phẩm trả phí thật.** Người dùng kiểm soát mã và dữ liệu trên máy; bài Plus đang đi kèm trong file lessons.js chỉ để xem demo.

## Chuẩn bị cho Firebase sau này

Ranh giới tích hợp là `src/services.js`: hiện thực lưu local, kiểm tra quyền và thêm kết quả hiện tại có thể được thay bằng adapter bất đồng bộ.

1. Tạo Firebase project, bật Google provider trong Authentication, cấu hình authorized domains; chỉ triển khai khi có cấu hình dự án thật. Nút Google trong demo hiện bị vô hiệu hóa và ghi rõ “Sắp có”.
2. Dùng Firebase Auth đăng nhập Google trên HTTP/HTTPS. Đổi adapter và các chỗ gọi UI sang async/await, có trạng thái chờ/lỗi/đăng xuất. Không chỉ dán config rồi coi như tích hợp xong.
3. Firestore lưu `users/{uid}` và `users/{uid}/results/{resultId}`. Dùng ID kết quả ổn định để đồng bộ không trùng, có luồng nhập tiến độ local sau khi đăng nhập. Rules chỉ cho chủ tài khoản đọc/ghi dữ liệu luyện tập của mình.
4. Quyền trả phí nằm trong `entitlements/{uid}`, chỉ backend được ghi; client chỉ được đọc quyền của chính mình. Không chấp nhận `plusPreview` hay trường role do người dùng ghi làm bằng chứng đã mua.
5. Khi có thanh toán, backend xác minh webhook/chữ ký và cấp quyền một cách idempotent. Tuyệt đối không đặt secret, service account hoặc khóa cổng thanh toán vào frontend.
6. Muốn hạn chế tải bài Plus trước khi mua, bỏ nội dung khỏi bundle tĩnh và tải từ API có kiểm tra ID token + entitlement. Nội dung đã tải để dùng offline vẫn có thể bị sao chép; cần xác định chính sách offline phù hợp.
7. Chốt giá, nội dung gói, hỗ trợ/hoàn tiền, chính sách dữ liệu và cách vận hành tài khoản phụ huynh/trẻ em trước khi bán thật. Chưa có các chức năng này trong demo.

## Cấu trúc

`index.html` — giao diện · `style.css` — hình thức/chuyển động · `src/app.js` — tương tác · `src/core.js` — chấm bài thuần · `src/lessons.js` — nội dung · `src/services.js` — adapter local · `assets/` — SVG đi kèm · `server.cjs` — server local không phụ thuộc thư viện.

## Kiểm tra

`npm test` chạy Node test runner tích hợp. Các test tập trung vào Unicode, dấu chưa hoàn tất, sửa lỗi, từ thừa, tính điểm, quyền demo và dữ liệu lưu bị hỏng. Chạy browser QA với mã trong `tests/browser-check.cjs` nếu có Playwright và Chromium, xem hướng dẫn đầu file.

Sự kiện IME trong test chỉ là mô phỏng, không thay thế thử trực tiếp bộ gõ thật trên Windows/macOS. Trước phát hành cần thử UniKey/EVKey và bộ gõ hệ điều hành, với Telex/VNI trên các trình duyệt mục tiêu.
