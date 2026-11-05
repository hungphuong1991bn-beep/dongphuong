# MIGRATION

## Triển khai (Web / GitHub Pages)
Đẩy toàn bộ repo (gồm `index.html`, `src/`, `sw.js`) lên gốc Pages như cũ. Cần đồng thời triển khai `src/` — chỉ chép `index.html` sẽ lỗi. Service worker v3 tự thay cache cũ.

## Android
Không đổi quy trình: tag `android-v*` → workflow build, Capacitor sync. App nạp URL Pages nên nhận bản mới khi Pages cập nhật.

## Windows
Không đổi: workflow desktop + electron-builder. App nạp URL Pages.

## Quay lui
`git checkout baseline-v2.5.141` (hoặc `git revert` merge) trả lại đúng bản `index.html` đơn lẻ. Dữ liệu Firebase/schema không đổi nên không cần chuyển dữ liệu; sau khi quay lui nên bump cache `sw.js` để trình duyệt bỏ cache v3.

## Sinh lại `src/` từ bản gốc
```
ACORN_PATH=<acorn> node tools/refactor/build.js <index.html gốc> <thư-mục-đích>
node tools/refactor/verify.js ...      # xem tests/run-all.sh
```
## Chạy toàn bộ kiểm thử
`cd tests && npm i` (nếu cần) rồi `bash tests/run-all.sh` (cần Playwright + Chromium, acorn).

## Thêm/sửa mã về sau
Sửa trực tiếp file trong `src/`. Giữ nguyên thứ tự `<script>/<link>` trong `index.html`; thêm file mới thì thêm vào `sw.js` ASSETS và chạy `run-all.sh`. Lưu ý `build.js` chỉ dùng để tái sinh từ bản gốc; sau khi sửa tay `src/`, đừng chạy lại đè lên.
