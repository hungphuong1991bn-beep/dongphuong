# INVENTORY — bản đồ hiện trạng sau tách module (sinh tự động)

Sinh bởi `tools/refactor/inventory.js`. Danh sách đường dẫn Firebase/khoá localStorage lấy bằng quét mã nguồn (tham khảo, đối chiếu thêm bằng mắt khi đổi nghiệp vụ).

## Thống kê theo file

| File | Dòng | Hàm | Biến/hằng top-level |
|---|---:|---:|---:|
| `src/components/BottomNav.js` | 60 | 0 | 0 |
| `src/components/GlobalHeader.js` | 289 | 10 | 3 |
| `src/components/NotificationCenter.js` | 316 | 17 | 7 |
| `src/components/SetupScreens.js` | 74 | 2 | 0 |
| `src/components/Sidebar.js` | 235 | 10 | 2 |
| `src/components/shared/ActionMenu.js` | 40 | 2 | 0 |
| `src/components/shared/ComboBox.js` | 72 | 8 | 1 |
| `src/components/shared/ConfirmModal.js` | 16 | 0 | 0 |
| `src/components/shared/FloatingButtons.js` | 7 | 0 | 0 |
| `src/components/shared/Modal.js` | 25 | 4 | 1 |
| `src/components/shared/ProgressModal.js` | 33 | 0 | 0 |
| `src/components/shared/PwaBar-close.js` | 8 | 0 | 0 |
| `src/components/shared/PwaBar-open.js` | 7 | 0 | 0 |
| `src/components/shared/SearchBubble-logic.js` | 265 | 11 | 1 |
| `src/components/shared/SearchBubble.js` | 19 | 0 | 0 |
| `src/components/shared/Toast.js` | 22 | 1 | 1 |
| `src/components/shared/capture.js` | 57 | 1 | 0 |
| `src/components/shared/charts.js` | 77 | 6 | 0 |
| `src/core/app.js` | 112 | 0 | 0 |
| `src/core/constants.js` | 111 | 2 | 16 |
| `src/core/embedded-assets.js` | 15 | 0 | 3 |
| `src/core/permissions.js` | 50 | 12 | 0 |
| `src/core/router.js` | 110 | 7 | 0 |
| `src/core/state-manager.js` | 18 | 0 | 6 |
| `src/modules/account/account-menu.js` | 224 | 13 | 2 |
| `src/modules/account/account-modals.js` | 100 | 0 | 0 |
| `src/modules/account/account-service.js` | 69 | 3 | 2 |
| `src/modules/account/account-users.js` | 82 | 6 | 0 |
| `src/modules/ai/ai-chat.js` | 225 | 24 | 7 |
| `src/modules/ai/ai-commands.js` | 563 | 20 | 3 |
| `src/modules/ai/ai-llm.js` | 231 | 4 | 1 |
| `src/modules/ai/ai-widget.js` | 46 | 0 | 0 |
| `src/modules/attendance/attendance-capture.js` | 15 | 2 | 0 |
| `src/modules/attendance/attendance-export.js` | 130 | 3 | 0 |
| `src/modules/attendance/attendance-schedule.js` | 518 | 26 | 6 |
| `src/modules/attendance/attendance-service.js` | 64 | 5 | 1 |
| `src/modules/attendance/attendance-view.js` | 240 | 9 | 2 |
| `src/modules/audit/audit-log.js` | 38 | 3 | 0 |
| `src/modules/audit/audit-view.js` | 86 | 3 | 2 |
| `src/modules/auth/login-screen.js` | 30 | 0 | 0 |
| `src/modules/auth/login.js` | 135 | 7 | 1 |
| `src/modules/auth/password.js` | 66 | 6 | 0 |
| `src/modules/checklist/checklist-data.js` | 46 | 2 | 2 |
| `src/modules/checklist/checklist-export.js` | 142 | 1 | 0 |
| `src/modules/checklist/checklist-service.js` | 66 | 5 | 1 |
| `src/modules/checklist/checklist-view.js` | 258 | 19 | 3 |
| `src/modules/customers/customers-view.js` | 209 | 6 | 4 |
| `src/modules/dashboard/dashboard-view.js` | 495 | 17 | 2 |
| `src/modules/dashboard/dashboard-widgets.js` | 232 | 7 | 0 |
| `src/modules/dashboard/insights.js` | 164 | 2 | 0 |
| `src/modules/hr/hr-leave-discipline.js` | 198 | 14 | 1 |
| `src/modules/hr/hr-modal.js` | 89 | 0 | 0 |
| `src/modules/hr/hr-service.js` | 16 | 1 | 0 |
| `src/modules/hr/hr-view.js` | 290 | 5 | 5 |
| `src/modules/hr/hr-workers.js` | 129 | 8 | 0 |
| `src/modules/inventory/inventory-export.js` | 345 | 6 | 0 |
| `src/modules/inventory/inventory-modals.js` | 127 | 0 | 0 |
| `src/modules/inventory/inventory-service.js` | 272 | 14 | 6 |
| `src/modules/inventory/inventory-view.js` | 606 | 55 | 15 |
| `src/modules/maintenance/maintenance-data.js` | 21 | 1 | 1 |
| `src/modules/maintenance/maintenance-modal.js` | 51 | 0 | 0 |
| `src/modules/maintenance/maintenance-service.js` | 9 | 1 | 0 |
| `src/modules/maintenance/maintenance-ton-modals.js` | 69 | 0 | 0 |
| `src/modules/maintenance/maintenance-ton.js` | 179 | 12 | 1 |
| `src/modules/maintenance/maintenance-view.js` | 237 | 14 | 3 |
| `src/modules/molds/molds-data.js` | 15 | 0 | 4 |
| `src/modules/molds/molds-export.js` | 120 | 2 | 5 |
| `src/modules/molds/molds-modals.js` | 62 | 0 | 0 |
| `src/modules/molds/molds-qty.js` | 271 | 17 | 1 |
| `src/modules/molds/molds-service.js` | 14 | 2 | 0 |
| `src/modules/molds/molds-view.js` | 237 | 19 | 8 |
| `src/modules/orders/orders-cards.js` | 147 | 5 | 0 |
| `src/modules/orders/orders-detail-modal.js` | 17 | 0 | 0 |
| `src/modules/orders/orders-export.js` | 57 | 1 | 0 |
| `src/modules/orders/orders-filter.js` | 97 | 5 | 0 |
| `src/modules/orders/orders-form.js` | 192 | 11 | 3 |
| `src/modules/orders/orders-modal.js` | 106 | 0 | 0 |
| `src/modules/orders/orders-service.js` | 689 | 19 | 14 |
| `src/modules/orders/orders-shared.js` | 92 | 6 | 0 |
| `src/modules/orders/orders-view.js` | 583 | 24 | 1 |
| `src/modules/planning/planning-detail.js` | 233 | 15 | 1 |
| `src/modules/planning/planning-machines.js` | 111 | 7 | 0 |
| `src/modules/planning/planning-modals.js` | 29 | 0 | 0 |
| `src/modules/planning/planning-nav.js` | 33 | 1 | 0 |
| `src/modules/planning/planning-view.js` | 307 | 13 | 12 |
| `src/modules/production/production-dispatch.js` | 353 | 8 | 2 |
| `src/modules/production/production-panels.js` | 984 | 41 | 5 |
| `src/modules/production/production-view.js` | 69 | 2 | 0 |
| `src/modules/qr/qr-actions.js` | 250 | 11 | 0 |
| `src/modules/qr/qr-modals.js` | 161 | 0 | 0 |
| `src/modules/qr/qr-print.js` | 210 | 5 | 3 |
| `src/modules/qr/qr-public-ccllv.js` | 217 | 7 | 3 |
| `src/modules/qr/qr-public-khuon.js` | 161 | 7 | 2 |
| `src/modules/qr/qr-public-nhansu.js` | 242 | 14 | 2 |
| `src/modules/qr/qr-public-scan.js` | 140 | 4 | 1 |
| `src/modules/qr/qr-public-screen.js` | 11 | 0 | 0 |
| `src/modules/qr/qr-service.js` | 12 | 1 | 0 |
| `src/modules/qr/qr-share.js` | 212 | 17 | 0 |
| `src/modules/qr/qr-view.js` | 247 | 10 | 5 |
| `src/modules/quality/quality-actions.js` | 277 | 14 | 0 |
| `src/modules/quality/quality-detail-modal.js` | 17 | 0 | 0 |
| `src/modules/quality/quality-export.js` | 91 | 3 | 0 |
| `src/modules/quality/quality-view.js` | 391 | 17 | 13 |
| `src/modules/reports/reports-view.js` | 172 | 6 | 0 |
| `src/modules/settings/settings-version.js` | 273 | 12 | 5 |
| `src/modules/settings/settings-view.js` | 106 | 1 | 0 |
| `src/modules/tv-mode/tv-mode.js` | 190 | 9 | 2 |
| `src/services/backup.js` | 96 | 5 | 3 |
| `src/services/firebase.js` | 145 | 9 | 3 |
| `src/services/notification.js` | 177 | 17 | 8 |
| `src/services/presence.js` | 115 | 6 | 4 |
| `src/services/storage.js` | 39 | 4 | 0 |
| `src/services/sync-realtime.js` | 328 | 11 | 6 |
| `src/services/sync.js` | 353 | 12 | 7 |
| `src/services/traceability.js` | 68 | 4 | 4 |
| `src/services/update.js` | 299 | 7 | 8 |
| `src/utils/date.js` | 47 | 11 | 3 |
| `src/utils/format.js` | 79 | 10 | 0 |
| `src/utils/helpers.js` | 68 | 9 | 0 |
| `src/utils/lib-loader.js` | 75 | 4 | 3 |
| `src/utils/validation.js` | 26 | 2 | 0 |

## Đường dẫn Firebase đang dùng (nơi tham chiếu)

- `/backups/` — `services/backup.js`
- `/data/` — `modules/inventory/inventory-service.js`, `services/sync.js`
- `/data/_conn_test.json` — `components/SetupScreens.js`
- `/data/attendance` — `modules/attendance/attendance-service.js`, `services/sync-realtime.js`
- `/data/baoTri` — `modules/maintenance/maintenance-service.js`, `services/sync-realtime.js`, `services/sync.js`
- `/data/csData` — `modules/checklist/checklist-service.js`
- `/data/csTemplates` — `modules/checklist/checklist-service.js`, `services/sync.js`
- `/data/khuonCatalog` — `modules/molds/molds-service.js`, `services/sync.js`
- `/data/khuonQty` — `modules/molds/molds-service.js`, `services/sync.js`
- `/data/kyLuat` — `modules/hr/hr-leave-discipline.js`, `services/sync-realtime.js`, `services/sync.js`
- `/data/lichLamViec` — `modules/attendance/attendance-service.js`, `services/sync-realtime.js`, `services/sync.js`
- `/data/mayDanhBongLog` — `services/sync-realtime.js`, `services/sync.js`
- `/data/mayDanhBongLog/` — `services/sync-realtime.js`
- `/data/mayRutLog` — `services/sync-realtime.js`, `services/sync.js`
- `/data/mayRutLog/` — `services/sync-realtime.js`
- `/data/nghiPhep` — `modules/hr/hr-leave-discipline.js`, `services/sync-realtime.js`, `services/sync.js`
- `/data/nguyenLieuLog` — `services/sync-realtime.js`, `services/sync.js`
- `/data/nguyenLieuLog/` — `services/sync-realtime.js`
- `/data/orders` — `services/sync-realtime.js`
- `/data/orders/` — `modules/orders/orders-service.js`, `services/sync-realtime.js`
- `/data/ordersTrash` — `modules/orders/orders-service.js`, `services/sync-realtime.js`
- `/data/qrProducts` — `modules/qr/qr-service.js`, `services/sync-realtime.js`, `services/sync.js`
- `/data/scanStats/` — `modules/qr/qr-public-scan.js`
- `/data/users` — `modules/account/account-service.js`, `modules/auth/login.js`, `modules/auth/password.js`, `services/sync-realtime.js`
- `/data/workers` — `modules/hr/hr-service.js`, `services/sync-realtime.js`, `services/sync.js`
- `/presence/` — `modules/auth/login.js`, `services/presence.js`

## Khoá localStorage

- `customerNameHistory` — `components/shared/ComboBox.js`
- `quyCachHistory` — `components/shared/ComboBox.js`
- `sx_app_ver` — `services/update.js`
- `sx_dev` — `services/presence.js`
- `sx_notif_sound_off` — `services/notification.js`
- `sx_notif_vibrate_off` — `services/notification.js`
- `sx_session_uid` — `core/app.js`, `modules/auth/login.js`
- `sx_tv_locked` — `core/app.js`, `modules/tv-mode/tv-mode.js`

## Listener toàn cục đăng ký khi nạp

- `DOMContentLoaded` ×1: `core/app.js`
- `appinstalled` ×1: `services/update.js`
- `beforeinstallprompt` ×1: `services/update.js`
- `beforeunload` ×1: `services/presence.js`
- `click` ×5: `components/shared/ActionMenu.js`, `components/shared/ComboBox.js`, `components/shared/Modal.js`, `modules/account/account-menu.js`, `services/notification.js`
- `keydown` ×2: `components/shared/SearchBubble-logic.js`, `modules/account/account-menu.js`
- `offline` ×1: `services/sync.js`
- `online` ×2: `services/sync.js`, `services/update.js`
- `resize` ×2: `components/shared/ActionMenu.js`, `modules/account/account-menu.js`
- `scroll` ×3: `components/shared/ActionMenu.js`, `components/shared/charts.js`, `modules/account/account-menu.js`
- `touchstart` ×2: `components/shared/charts.js`, `services/notification.js`
- `visibilitychange` ×3: `services/sync.js`, `services/update.js`
