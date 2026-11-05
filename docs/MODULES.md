# MODULES — danh sách module và trách nhiệm

Mọi file là `<script>` thường dùng chung phạm vi toàn cục (xem ARCHITECTURE.md §3). Thứ tự nạp: `index.html`.

## Core / Services / Components / Utils

### `src/core/` — Nền tảng ứng dụng (hằng số, trạng thái, phân quyền, điều hướng, khởi động)

- `app.js`
- `constants.js`
- `embedded-assets.js`
- `permissions.js`
- `router.js`
- `state-manager.js`

### `src/services/` — Dịch vụ dùng chung (Firebase, đồng bộ, sao lưu, lưu trữ, thông báo, truy xuất, cập nhật, presence)

- `backup.js`
- `firebase.js`
- `notification.js`
- `presence.js`
- `storage.js`
- `sync-realtime.js`
- `sync.js`
- `traceability.js`
- `update.js`

### `src/components/` — Thành phần giao diện dùng chung (markup + hành vi)

- `BottomNav.js`
- `GlobalHeader.js`
- `NotificationCenter.js`
- `SetupScreens.js`
- `Sidebar.js`

### `src/components/shared/` — Modal/Toast/ComboBox/ActionMenu/SearchBubble… dùng chung

- `ActionMenu.js`
- `ComboBox.js`
- `ConfirmModal.js`
- `FloatingButtons.js`
- `Modal.js`
- `ProgressModal.js`
- `PwaBar-close.js`
- `PwaBar-open.js`
- `SearchBubble-logic.js`
- `SearchBubble.js`
- `Toast.js`
- `capture.js`
- `charts.js`

### `src/utils/` — Tiện ích: ngày, định dạng, kiểm tra hợp lệ, nạp thư viện ngoài

- `date.js`
- `format.js`
- `helpers.js`
- `lib-loader.js`
- `validation.js`

## Modules nghiệp vụ

### `src/modules/account/` — Tài khoản: menu người dùng, hồ sơ, đổi mật khẩu, CRUD tài khoản, đồng bộ users

- `account-menu.js`
- `account-modals.js`
- `account-service.js`
- `account-users.js`

### `src/modules/ai/` — Trợ lý AI (chỉ Admin): chat, lệnh tiếng Việt cục bộ, gọi API Claude

- `ai-chat.js`
- `ai-commands.js`
- `ai-llm.js`
- `ai-widget.js`
- `ai.css`

### `src/modules/attendance/` — Chấm công, Lịch làm việc, xuất/in, chụp ảnh gửi nhóm

- `attendance-capture.js`
- `attendance-export.js`
- `attendance-schedule.js`
- `attendance-service.js`
- `attendance-view.js`

### `src/modules/audit/` — Nhật ký thao tác (log) và màn hình Nhật ký

- `audit-log.js`
- `audit-view.js`

### `src/modules/auth/` — Đăng nhập, băm mật khẩu, chống dò mật khẩu

- `auth.css`
- `login-screen.js`
- `login.js`
- `password.js`

### `src/modules/checklist/` — Check Sheet thiết bị hàng ngày

- `checklist-data.js`
- `checklist-export.js`
- `checklist-service.js`
- `checklist-view.js`

### `src/modules/customers/` — Tab Khách hàng (Admin/Nhân viên)

- `customers-view.js`
- `customers.css`

### `src/modules/dashboard/` — Tổng quan: KPI, cảnh báo thông minh, biểu đồ, phân tích đơn (AI rule-based)

- `dashboard-overview.css`
- `dashboard-view.js`
- `dashboard-widgets.js`
- `dashboard.css`
- `insights.js`

### `src/modules/hr/` — Nhân sự: hồ sơ, nghỉ phép, kỷ luật

- `hr-leave-discipline.js`
- `hr-modal.js`
- `hr-service.js`
- `hr-view.js`
- `hr-workers.js`

### `src/modules/inventory/` — Tab 📊 Số liệu: Sổ nguyên liệu / máy Rút / máy Đánh bóng, xuất Excel/in, tự dọn

- `inventory-export.js`
- `inventory-modals.js`
- `inventory-service.js`
- `inventory-view.js`
- `inventory.css`

### `src/modules/maintenance/` — Bảo trì máy + cảnh báo thay vành nước/dầu theo tấn

- `maintenance-data.js`
- `maintenance-modal.js`
- `maintenance-service.js`
- `maintenance-ton-modals.js`
- `maintenance-ton.js`
- `maintenance-view.js`
- `maintenance.css`

### `src/modules/molds/` — Quản lý Khuôn: tổng hợp & số lượng, xuất Excel

- `molds-blocks.css`
- `molds-data.js`
- `molds-export.js`
- `molds-modals.js`
- `molds-qty.js`
- `molds-service.js`
- `molds-view.js`
- `molds.css`

### `src/modules/orders/` — Đơn hàng: danh sách, form, lọc, xuất, đồng bộ (merge/ETag), thùng rác, tự dọn

- `orders-cards.js`
- `orders-detail-modal.js`
- `orders-export.js`
- `orders-filter.js`
- `orders-form.js`
- `orders-list.css`
- `orders-modal.js`
- `orders-service.js`
- `orders-shared.js`
- `orders-view.js`
- `orders.css`

### `src/modules/planning/` — Kế hoạch SX: thẻ kế hoạch, phân công máy, chi tiết

- `planning-cards.css`
- `planning-detail.js`
- `planning-erp.css`
- `planning-machines.js`
- `planning-modals.js`
- `planning-nav.js`
- `planning-view.js`
- `planning.css`

### `src/modules/production/` — Điều hành SX: thẻ máy, panel V3, tự điều phối đơn chạy tiếp

- `production-dh4.css`
- `production-dispatch.js`
- `production-panels.js`
- `production-tv-v3.css`
- `production-view.js`
- `production.css`

### `src/modules/qr/` — Mã QR thành phẩm, in tem, trang công khai (quét/khuôn/nhân sự/chấm công)

- `qr-actions.js`
- `qr-modals.js`
- `qr-print.js`
- `qr-public-ccllv.js`
- `qr-public-khuon.js`
- `qr-public-nhansu.js`
- `qr-public-scan.js`
- `qr-public-screen.js`
- `qr-public.css`
- `qr-service.js`
- `qr-share.js`
- `qr-view.js`
- `qr.css`

### `src/modules/quality/` — Đơn hoàn thành / thành phẩm: nhập kho, giao hàng, QC

- `quality-actions.js`
- `quality-detail-modal.js`
- `quality-export.js`
- `quality-view.js`
- `quality.css`

### `src/modules/reports/` — Báo cáo

- `reports-charts.css`
- `reports-view.js`
- `reports.css`

### `src/modules/settings/` — Cài đặt, phiên bản & cập nhật, cấu hình Firebase

- `settings-version.css`
- `settings-version.js`
- `settings-view.js`
- `settings.css`

### `src/modules/tv-mode/` — TV Mode (toàn màn hình) cho Điều hành SX

- `tv-mode.css`
- `tv-mode.js`


## Quy ước tên file trong mỗi module
- `*-service.js`: dữ liệu (lưu/gộp/đồng bộ, xoá, tự dọn)
- `*-view.js`: dựng giao diện tab (`renderXxx`)
- `*-export.js`, `*-actions.js`, `*-form.js`: xuất file / thao tác / form
- `*-modal(s).js`: markup modal (document.write đúng vị trí cũ)
- `*-data.js`: dữ liệu mặc định/hằng của module
- `*.css`: đoạn CSS liên tiếp của module (xem ARCHITECTURE.md §4)
