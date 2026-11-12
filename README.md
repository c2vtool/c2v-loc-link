# C2V Lọc Link

Extension Chrome / Edge giúp gom link video **Instagram Reel** và **Facebook**, xếp lưới Reels theo lượt xem ngay trên trang **IG & FB**, rồi copy dán vào **C2V Download**.

## Cài đặt (Load unpacked)

1. Tải repo (nút xanh **Code** → **Download ZIP**) và giải nén.
2. Mở `chrome://extensions` (Chrome) hoặc `edge://extensions` (Edge).
3. Bật **Developer mode**.
4. Bấm **Load unpacked** → chọn thư mục có file `manifest.json`.

Đã cài bản cũ: vào trang extension → **Reload**.

## Cách dùng

1. Mở trang kênh **Instagram** hoặc **Facebook** → tab **Reels** (lưới có số view).
2. Thanh **C2V** hiện trên trang:
   - **Xếp lưới:** Lượt xem (+ like/comment trên IG) · Tăng / Giảm dần
   - **Nhịp** — chỉnh tốc độ cuộn
   - **Chạy lưới** — tự cuộn xuống (bấm lại thành **Dừng**)
   - **Đầu trang** — nhảy về trên
3. Cuộn (hoặc bật Chạy lưới) để gom đủ video.
4. Bấm icon extension → **Làm mới** → lọc view tối thiểu nếu cần → **Copy** → dán C2V.

**Copy chỉ lấy URL** để dán thẳng vào C2V Download.

## Lọc trong popup

| Tuỳ chọn | Ý nghĩa |
|---|---|
| View tối thiểu | Chỉ giữ reel ≥ số view (`10k`, `1.5M`…) |
| Sắp xếp | View / Like / Comment |
| Chỉ link có view | Bỏ link chưa đọc được view |
| Hiện view trong danh sách | Xem trước; Copy vẫn chỉ URL |

Một số layout Instagram không hiện số view trên ô → số có thể = 0; cuộn thêm rồi **Làm mới**.

## Quyền & quyền riêng tư

- Chỉ chạy trên Instagram / Facebook.
- Danh sách link chỉ giữ trong bộ nhớ của từng tab/kênh, không gửi server. Tải lại trang hoặc đổi kênh sẽ gom lại; đóng/mở popup vẫn giữ link đã gom trong tab đó. Cài đặt extension vẫn lưu trên máy.
- Không đọc mật khẩu hay cookie đăng nhập.

## Phiên bản

- `1.3.27` — IG đọc view trong đúng ô video, dừng trước hàng/lưới chung; không lấy số từ caption/ô bên cạnh. Nhận cả ô dùng link /p/ và /tv/ khi xếp lưới; popup và lưới dùng chung cách đọc view.
- `1.3.26` — Chỉ gom/lọc link trong trang cá nhân/kênh IG hoặc FB. Trang chủ, khám phá và luồng video chung không gom; rời trang cá nhân sẽ xóa danh sách tab và popup hướng dẫn mở kênh.
- `1.3.25` — IG tạm dừng sắp xếp trong lúc Chạy lưới, xếp lại khi Dừng; đổi tiêu chí sẽ dừng cuộn. Gom link IG giới hạn tần suất để giảm khựng do quét mỗi sự kiện cuộn.
- `1.3.24` — Sắp xếp IG xuyên suốt các hàng của lưới, gồm video ghim và hàng mới tải thêm; Tắt khôi phục thứ tự gốc, giữ cấu trúc các hàng.
- `1.3.23` — Thanh điều khiển IG chỉ hiện ở trang kênh/lưới Reels, không xuất hiện ở trang chủ, Explore, tin nhắn hoặc trang xem từng video; tác vụ chờ không tạo lại thanh sau khi rời kênh.
- `1.3.22` — Gộp Instagram / IG Reel thành một nút Instagram, hiện toàn bộ link Instagram đã gom.
- `1.3.21` — Sửa popup bị co thành dải mỏng khi vừa mở do giới hạn chiều cao theo viewport ban đầu của Chrome.
- `1.3.20` — Thanh cuộn tối màu đồng bộ giao diện; popup vừa chiều cao, luôn hiện Làm mới / Copy / Xóa, chỉ cuộn trong danh sách link.
- `1.3.19` — Bỏ lựa chọn Like / Bình luận trên cả Instagram, Facebook và popup. Các lựa chọn cũ tự chuyển về View.
- `1.3.18` — Bỏ danh sách link lưu chung theo tên miền. Mỗi tab/kênh gom riêng, F5 bắt đầu lại, chuyển kênh không trộn link cũ; bỏ quét HTML nhúng có thể chứa dữ liệu trang khác.
- `1.3.17` — Bỏ lựa chọn Like / Bình luận trên Facebook (thanh lưới và popup); giữ các lựa chọn này cho Instagram. Cài đặt FB cũ tự chuyển về Lượt xem.
- `1.3.16` — Popup chỉ hiện chỉ số đang chọn: View / Like / Bình luận. Nếu chưa gom được chỉ số đó, ghi rõ chưa có dữ liệu thay vì ghép view vào dòng like/bình luận. Like/bình luận FB chỉ đọc được khi xuất hiện trên từng ô video; không tự mở từng Reel để lấy thêm.
- `1.3.15` — Popup xếp link chưa có số liệu xuống cuối ở cả hai chiều; khi bật Hiện số liệu, ghi rõ chỉ số chưa có dữ liệu.
- `1.3.14` — Bộ lọc tối thiểu và Chỉ link có số liệu trong popup đổi theo View / Like / Bình luận đang chọn; thêm sắp xếp bình luận tăng dần.
- `1.3.13` — Cố định kích thước nút trên thanh FB; đổi tiêu chí, tăng/giảm hoặc Chạy/Dừng không làm các nút dịch chuyển.
- `1.3.12` — Đổi tiêu chí FB áp dụng ngay; chọn Tắt trả các ô Reels về thứ tự Facebook đã tải trước khi sắp xếp, gồm cả video tải thêm.
- `1.3.11` — Thêm xếp lưới FB theo lượt thích / bình luận và gom các số này vào popup khi chúng xuất hiện trên từng ô video. Ô không có dữ liệu tương tác được xếp cuối; không suy ra like / bình luận từ view.
- `1.3.10` — Gom và hiện lượt xem trên ô Reels Facebook trong popup; hỗ trợ lọc view FB và số tiếng Việt như `1,2 triệu`. Link đã gom được bổ sung view khi ô video xuất hiện lại trên trang.
- `1.3.0` — Thêm xếp lưới Reels trên Facebook (+ IG như trước)

## Liên hệ

- GitHub: [c2vtool](https://github.com/c2vtool)
- Telegram: `tv04_de`
