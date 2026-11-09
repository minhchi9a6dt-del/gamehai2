# Đôi bạn cá nhỏ và nòng nọc — 5 nhóm / 5 iPad

Ứng dụng học tập Tiếng Việt lớp 2. Giáo viên tạo phòng, học sinh quét QR, mỗi nhóm 1 iPad, giáo viên bấm bắt đầu, iPad tự vào bài, nhóm nộp bài và giáo viên xem kết quả.

## Đưa lên Netlify (QUAN TRỌNG)

Ứng dụng cần **Netlify Functions + Netlify Blobs** để kết nối các thiết bị. **Không** triển khai bằng cách chỉ kéo thư mục `public` hoặc kéo tệp ZIP vào mục deploy thủ công: khi đó phần máy chủ có thể không được triển khai.

1. Giải nén toàn bộ ZIP và đưa cả thư mục dự án lên một repository GitHub (có `netlify.toml`, `package.json`, `netlify/functions/game.mjs`, `public/`).
2. Trên Netlify chọn **Add new project → Import an existing project → GitHub** và chọn repository.
3. Cấu hình: Build command để trống; Publish directory: `public`; Functions directory: `netlify/functions`. (Đã có trong `netlify.toml`.)
4. Bấm Deploy. Netlify sẽ cài package `@netlify/blobs` và đóng gói function.
5. Giáo viên mở website, bấm **Tạo phòng**; học sinh quét QR (hoặc truy cập liên kết) và chọn nhóm. Đợi đủ 5 nhóm rồi giáo viên bấm Bắt đầu.
6. Thử trước với 2 thiết bị; sau đó thử 5 iPad cùng lúc.

## Ghi chú kỹ thuật

- Ứng dụng lấy trạng thái máy chủ mỗi 1,5 giây (polling), vì vậy thiết bị nhận lệnh gần như đồng thời nhưng có thể lệch khoảng 1–2 giây tùy mạng. Mốc thời gian bắt đầu và nộp bài được tính ở máy chủ.
- Dữ liệu phòng lưu bằng Netlify Blobs; giáo viên giữ quyền điều khiển bằng token lưu trong trình duyệt tạo phòng. Không xóa dữ liệu trình duyệt giữa giờ học.
- Mỗi nhóm chỉ được nộp một lần. Nếu mất mạng, học sinh có thể mở lại cùng đường dẫn trên **cùng iPad** để tiếp tục.
- Mã QR dùng dịch vụ ảnh QR bên ngoài. Nếu không hiển thị do mạng chặn, dùng liên kết hoặc mã phòng.
- Vì không có source gốc, câu dẫn trong 3 câu hỏi là bản dựng lại để minh họa; giáo viên có thể chỉnh nội dung trong `public/index.html` và đáp án trong `netlify/functions/game.mjs`.
- Đối với lớp học đông và sử dụng lâu dài, nên nâng cấp lên backend có giao dịch nguyên tử và xác thực/giới hạn yêu cầu. Đây là phiên bản mẫu có backend, chưa được thử nghiệm trực tiếp trên Netlify hay 5 iPad thực tế.
