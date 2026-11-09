# Kiểm thử Global Header (Giai đoạn 2)
Chạy từ thư mục `tests/` sau `npm i` (cần Playwright + Chromium). Firebase là bản giả lập, không chạm dữ liệu thật.

    node e2e/header-qa/hdr.js   <webroot> <thư-mục-ảnh>   # 10 kích thước × 8 tab: tên công ty, điều khiển nằm TRONG khung, chiều cao Header
    node e2e/header-qa/behav.js <webroot>                 # nút đồng bộ (không ghi Firebase), nút 📢 Soạn trong panel chuông
    node e2e/header-qa/scan.js  <webroot> <kết-quả.json>  # 19 tab × 5 kích thước: tràn ngang, trang trắng, lỗi JS

`<webroot>` = thư mục gốc dự án (chứa index.html), ví dụ `..`.
