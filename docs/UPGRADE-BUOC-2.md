# Nâng cấp UI/UX – Bước 2 (v2.5.177 → nền tảng dùng chung)

Mốc quay lại: bản v2.5.177 nguyên trạng (không có `.git` trong gói; so bằng SHA-256).

## File thay đổi
| File | Thay đổi |
|---|---|
| `src/components/shared/dp-ui.js` | **MỚI**: `dpNotify`, `dpUI.state.*`, `dpUI.modal.*`, lịch sử thông báo |
| `src/styles/dp-ui.css` | **MỚI**: kiểu cho thông báo, trạng thái, chấm "Ngoại tuyến" |
| `src/components/GlobalHeader.js` | `setSyncDot`: thêm trạng thái `offline`; nhãn lỗi "Mất kết nối" → "Lỗi đồng bộ". `ok`/`saving` giữ nguyên |
| `src/services/sync.js` | 1 dòng: sự kiện `offline` gọi `setSyncDot('offline')` (trước là `'error'`) |
| `index.html`, `sw.js` | nạp 2 file mới; cache `v12` → `v13` |
| `tests/static/dp-ui.test.js`, `tests/run-all.sh` | kiểm thử mới (23 nhóm) |

## Hướng dẫn dùng
```js
dpNotify('success'|'info'|'warning'|'error', 'Nội dung', {ttl:ms, scope:'system'|'business'}); // error mặc định giữ đến khi đóng
dpUI.history();            // warning/error gần đây (tối đa 50, lưu localStorage)
dpUI.state.loading(el,{rows:5});  dpUI.state.empty(el,{filtered:true});
dpUI.state.error(el,{title,error,onRetry});  dpUI.state.offline(el,{onRetry});
dpUI.modal.markClean('idModal');  // gọi trước khi đóng modal sau khi LƯU thành công nếu cần
// Ô nhập không nên tính là "dữ liệu chưa lưu": thêm data-dp-nodirty vào ô hoặc vùng chứa nó.
```
`showToast(msg,isErr)` và `confirm2()` **giữ nguyên** chữ ký và giao diện; `showToast(...,true)` nay còn ghi vào lịch sử.

## Hành vi đổi có chủ đích
1. Bấm nền mờ khi modal có dữ liệu đã nhập → hỏi "Đóng biểu mẫu?" thay vì đóng ngay. Nút ×/Hủy gọi `closeModal()` trực tiếp **chưa** bị chặn (để không chặn luồng lưu-rồi-đóng).
2. Mất mạng → chấm đồng bộ xám "Ngoại tuyến" (trước: đỏ "Mất kết nối").

## Lỗi phát hiện, CHƯA sửa (xử lý riêng)
- `notification.css` dòng 4: `top:calc(var(--top)+var(--safe-t)+12px)` thiếu khoảng trắng quanh `+` nên khai báo không hợp lệ, `#toast` không nhận vị trí `top` như ý định. Sửa sẽ làm toast cũ đổi vị trí; cần xem trên thiết bị thật.

## Chưa làm / chưa kiểm
- Chưa: Sidebar nhóm lại, DataTable dùng chung, thay `alert/confirm/prompt` (3/7/13), áp `dpUI.state` vào từng module, tối ưu nạp script.
- Chưa kiểm trên trình duyệt thật: giao diện `dp-ui.css`, responsive, e2e Playwright, Firebase thật. Kiểm thử Bước 2 chạy bằng jsdom nên không chứng minh bố cục.

---
# Bước 3 — Sidebar nhóm lại + DataTable dùng chung

## File thay đổi
| File | Thay đổi |
|---|---|
| `src/components/Sidebar.js` | Chỉ đổi **nhóm/thứ tự** 19 mục: Tổng quan · Đơn hàng · Sản xuất · Số liệu và kho · Chất lượng · Khuôn, thiết bị và bảo trì · Nhân sự · Quản trị hệ thống. Biểu tượng, nhãn, tooltip, `id="sbi-*"`, `goTab(...)`, huy hiệu **không đổi** (đã đối chiếu từng mục với bản gốc) |
| `src/components/shared/dp-ui.js` | thêm `dpUI.nav.sync()` + quan sát: tự ẩn tiêu đề nhóm khi mọi mục trong nhóm bị ẩn (ví dụ tài khoản "Số liệu" trước đây còn thấy các tiêu đề trống) |
| `src/components/shared/dp-table.js` | **MỚI** `dpUI.table(host, opts)` — tùy chọn, không thay bảng nào |
| `src/styles/dp-ui.css` | CSS DataTable (thẻ trên ≤640px), màu nhóm "Nhân sự" |
| `index.html`, `sw.js` | nạp `dp-table.js`; cache v13 → v14 (190 tài nguyên khớp) |
| `tests/static/dp-step3.test.js`, `run-all.sh` | 25 nhóm kiểm thử |

Nhóm theo yêu cầu nhưng **chỉ module có thật**; các nhóm chỉ có 1 mục được gộp (Kế hoạch + Điều hành = "Sản xuất"; Khuôn + Check Sheet + Bảo trì; Nhật ký Audit + Cài đặt = "Quản trị hệ thống"). TV Mode không phải tab của Sidebar nên không có mục riêng. Không đổi phân quyền: `applyRoleNav`, `isStaff()` và các chốt chặn giữ nguyên.

## Dùng dpUI.table
```js
const t = dpUI.table(document.getElementById('host'), {
  columns:[ {key:'id',label:'Mã đơn',sort:true,sticky:true},
            {key:'sl',label:'Số lượng',sort:true,align:'right'},
            {key:'ghi',label:'Ghi chú',priority:'low'},           // ẩn sau nút "Chi tiết" trên điện thoại
            {key:'x',label:'Thao tác',render:r=>nodeCuaBan(r)} ],  // render trả Node hoặc chữ; KHÔNG trả chuỗi HTML
  rows, rowKey:'id', pageSize:25, onRowClick:r=>moChiTiet(r), onRetry:()=>taiLai() });
t.setRows(newRows);   // giữ nguyên tìm kiếm / sắp xếp / trang
t.setLoading(); t.setError(err); t.destroy();   // gọi destroy() khi rời tab
```
Có: tìm không dấu, sắp xếp số/chữ tự nhiên (ô trống luôn cuối), phân trang, tổng bản ghi, đổi số dòng, tooltip cho nội dung dài, trạng thái Loading/Empty/Error. Chưa có: đổi độ rộng cột, xuất Excel/PDF (module nào đã có xuất thì giữ nút xuất của nó), xác nhận xóa (dùng `confirm2`).

## Chưa làm / chưa kiểm
- **Chưa áp dụng cho bảng nào**: 25 bảng hiện có (9 class khác nhau) giữ nguyên. Chuyển từng bảng là bước riêng, mỗi bảng cần so sánh dữ liệu trước/sau.
- Chưa kiểm trên trình duyệt thật: bố cục Sidebar 8 nhóm (thu gọn, Drawer mobile, cuộn), chiều cao menu, màu nhóm "Nhân sự", thẻ DataTable ở 320–640px.
