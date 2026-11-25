# Nâng cấp v2.14.0 — Tạm dừng / Tiếp tục sản xuất + Truy xuất lịch sử sản xuất

## 1. Thiết kế dữ liệu (trong bản ghi đơn `/data/orders/{id}` — KHÔNG thêm nhánh Firebase)

| Trường | Ý nghĩa |
|---|---|
| `status` | `pending` / `running` / **`paused`** / `done` (giá trị cũ `cutting` vẫn hiểu là running) |
| `startedAt` | Bắt đầu **lần đầu** (đã có, giữ nguyên) |
| `resumedAt` / `pausedAt` | Bắt đầu phiên gần nhất / tạm dừng gần nhất |
| `accumulatedRunMs` | Tổng ms các phiên **đã đóng** — chỉ đổi trong `rcEndSession()` |
| `runSessions[]` | `{id,no,stage,machineId,startAt,endAt,runMs,by,byId,startReason,endBy,endReason,legacy?}` |
| `pauseHistory[]` | `{id,no,at,resumeAt,pausedMs,reason,by,byId,resumeBy,stage,machineId,runMsAtPause,auto?,closedReason?}` |

Tận dụng, không trùng lặp: `machineAssign`, `machineHistory`, `machineActiveAt/StartAt`, `stage` giữ nguyên vai trò cũ. `machineHistory` (1 bản ghi/công đoạn, bị ghi đè khi gán lại) vẫn được ghi như trước; **lịch sử đầy đủ nằm ở `runSessions`**.

**Tổng thời gian chạy** = `accumulatedRunMs` + (đang chạy ? `now − startAt` phiên đang mở : 0), tính lại từ timestamp mỗi lần hiển thị, giờ máy chủ (`nowSrv`). Không dùng `doneAt − startedAt`.

**Đơn cũ** (chưa có phiên): giữ công thức cũ nên số liệu không đổi. Khi có thao tác đầu tiên mới tạo phiên, đánh dấu `legacy:true` (mốc bắt đầu = giờ bắt đầu đơn, không có người vận hành) — không bịa dữ liệu.

## 2. File thay đổi

Mới: `planning/planning-runctl.js|css`, `trace/trace-history.js`, `trace/trace-history-view.js`, `trace/trace-history.css`, 3 test static + `tests/e2e/runctl-ui.js`.
Sửa: `orders-service.js` (setStatus, hashOrders), `production-dispatch.js` (hàng đợi, tự chạy tiếp, đổi máy), `orders-cards.js` (setStage), `planning-view|detail|machines|fx.js`, `orders-shared|view.js`, `core/app.js` (đồng hồ), `quality-view|actions|export.js`, `reports-view.js`, `insights.js`, `GlobalHeader.js`, `index.html`, `sw.js` (CACHE v32), `tests/run-all.sh`, `machine-assign.test.js` (nạp thêm module mới).

## 3. Quyết định nghiệp vụ cần anh/chị biết

1. **Lý do tạm dừng:** Nhân viên **bắt buộc** nhập; Admin được bỏ trống (diễn giải "không bắt buộc nếu người quản lý cho phép"). Nếu muốn một công tắc cấu hình riêng thì cần bổ sung cài đặt.
2. **Máy được giải phóng → đơn đang xếp hàng sẵn trên máy đó (đã gán đúng máy) sẽ tự chạy tiếp**, cùng cơ chế auto-dispatch có sẵn cho "hoàn thành"/"về chờ". Hộp thoại tạm dừng cảnh báo rõ đơn nào sẽ tự chạy. Đơn không được gán trước thì bắt đầu thủ công.
3. Đơn **tạm dừng không nằm trong hàng đợi tự chạy** — chỉ bấm "Tiếp tục" mới chạy lại.
4. Đơn đang tạm dừng **không đổi công đoạn** được (phải tiếp tục trước); đổi máy khi tạm dừng được, ghi nhận ở phiên sau.
5. Nút "Chuyển về Chờ sản xuất" vẫn còn: chốt phiên, giữ tổng đã chạy.
6. Admin "Đưa về Chờ SX" từ tab Hoàn thành **xoá cả dữ liệu phiên/tạm dừng** (đơn quay về như chưa chạy) — nếu không tổng cộng dồn cũ sẽ dính sang lần chạy mới.

## 4. Kiểm soát đồng thời (nhiều thiết bị)

Khoá theo đơn → đợi lượt ghi dở → **đọc lại server** → kiểm tra trạng thái + trùng máy trên dữ liệu mới → ghi (ETag/version sẵn có) → **đọc lại 3 lượt** (0/3/8 s) xác nhận; nếu 2 thiết bị cùng chiếm 1 máy, đơn bắt đầu **sau** tự tạm dừng (ghi `auto`). Lỗi mạng: thao tác vẫn ghi cục bộ và đẩy lên khi có mạng.

## 5. Kết quả kiểm thử (chạy thật, 25/11/2026)

| Test | Nội dung | Kết quả |
|---|---|---|
| 1 | Chạy 30p → dừng → 2 giờ sau tiếp tục | ✅ 30p đứng yên suốt 2 giờ; sau tiếp tục 10p = 40p |
| 2 | Đơn A dừng → đơn B chạy cùng máy | ✅ B có đồng hồ riêng; A đứng yên |
| 3 | A tiếp tục khi máy đang chạy B | ✅ chặn, báo "Máy đùn TJ550 (1) đang chạy đơn PO-B" |
| 4 | 5 phiên, 4 lần dừng | ✅ tổng = tổng phiên, `accumulatedRunMs` = Σ `runMs`, không cộng thời gian nghỉ |
| 5 | TJ550(1) → TJ550(2) → … → Rút | ✅ đủ phiên, máy cũ không bị ghi đè |
| 6 | Hoàn thành → tab Hoàn thành | ✅ tổng quan + từng công đoạn + bảng phiên + lịch sử dừng/đổi máy |
| 7 | F5, thiết bị khác, mất mạng, 2 thiết bị đồng thời | ✅ khôi phục chính xác; lặp 12 lần ngẫu nhiên: 0 lần trùng máy |
| 8 | Đơn cũ chưa có lịch sử máy | ✅ "CHƯA CÓ DỮ LIỆU", không phát sinh dữ liệu giả |
| 9 | Cơ chế lưu trữ/dọn đơn hoàn thành | ✅ `autoCleanupDoneOrders`, `AUTOCLEAN_DAYS=30` giống bản gốc từng ký tự |

Số lượng: `run-clock` 21, `run-concurrency` 7, `trace-history` 9 nhóm; `machine-assign` 14; E2E Chromium thật `runctl-ui` **21/21** (2 thiết bị: máy tính + điện thoại; admin + nhân viên). Các test tĩnh có sẵn khác đều đạt; `verify-sw` đạt.

## 6. Chưa kiểm chứng / giới hạn đã biết (nói thật)

- **`hr-delete-sync` và `attendance-data` lỗi cả ở bản gốc** (cần file `/tmp/*.orig.js` không có ở đây) — không phải hồi quy.
- **Chưa chạy** phần `run-all.sh` cần git `baseline-v2.5.141` (so ảnh giao diện, `functional.js`, `sync-stress.js`, `tools/refactor/verify.js`): gói nhận được không có lịch sử git. Nên chạy trên repo thật trước khi phát hành.
- **Xuất Excel/PDF:** dữ liệu 4 trang Excel đã kiểm khớp mô hình; **chưa kiểm tải file `.xlsx` thật** (thư viện ExcelJS tải từ CDN, bị chặn trong môi trường này) và chưa kiểm hộp thoại in PDF.
- Firebase REST **không có transaction nhiều đơn** → chống trùng máy là "kiểm tra lại + tự sửa" (hội tụ trong vài giây), không phải khoá cứng tuyệt đối.
- Máy giữ song song ở công đoạn đã qua (gán lại thủ công) không tách thành phiên riêng; đồng hồ vẫn một mốc theo đơn.
- Đơn xếp hàng chờ máy ở trạng thái `running` vẫn tính giờ (hành vi cũ giữ nguyên).
- Màn Khách hàng đếm đơn tạm dừng vào nhóm "chờ"; Dashboard chưa có widget riêng cho đơn tạm dừng.
- Thiết bị đang dùng bản cũ (cache) không hiểu `paused` — cần tải lại để nhận Service Worker v32.
- Ảnh chụp giao diện mẫu dùng dữ liệu seed cũ nên hiện "530 giờ" (ngày bắt đầu 3/11) — không phải lỗi tính giờ.
