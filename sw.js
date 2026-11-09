// ════════════════════════════════════════════════════════════
// SERVICE WORKER — chỉ hỗ trợ cài đặt/cập nhật app (PWA), KHÔNG cache
// dữ liệu nghiệp vụ (đơn hàng, chấm công...) — dữ liệu đó luôn lấy
// trực tiếp từ Firebase, không qua SW.
//
// SỬA LỖI GỐC "app chạy bản cũ dù đã deploy bản mới": bản trước dùng
// cache-first cho MỌI request (kể cả index.html/JS) — 1 khi index.html
// đã được cache lần đầu, các lần mở app sau LUÔN nhận lại đúng bản đó,
// không hề gọi mạng kiểm tra bản mới. Sửa: index.html/JS/manifest/
// version.json dùng NETWORK-FIRST (luôn thử tải bản mới nhất từ mạng,
// chỉ dùng cache khi mất mạng hẳn); cache-first CHỈ áp dụng cho tài
// nguyên tĩnh khác (ảnh, icon...) để tải nhanh, ít tốn data.
// ════════════════════════════════════════════════════════════

// Đổi số này mỗi khi deploy bản mới (hoặc để build pipeline tự thay) —
// tên cache đổi theo giúp bước 'activate' dọn sạch mọi cache cũ.
const CACHE = 'sx-thanh-cai-v12'; // v3: refactor module hoá — thêm toàn bộ src/**.js|css vào bộ cache app-shell
// Danh sách này PHẢI khớp các <script src>/<link href> trong index.html (kiểm tra bởi tests/static/verify-sw.js).
const ASSETS = [
  './index.html',
  './manifest.json',
  './src/vendor/qrcode.js',
  './src/core/constants.js',
  './src/core/embedded-assets.js',
  './src/utils/helpers.js',
  './src/utils/date.js',
  './src/utils/format.js',
  './src/utils/validation.js',
  './src/components/SetupScreens.js',
  './src/modules/qr/qr-public-screen.js',
  './src/modules/auth/login-screen.js',
  './src/components/Sidebar.js',
  './src/components/GlobalHeader.js',
  './src/components/BottomNav.js',
  './src/components/shared/SearchBubble.js',
  './src/components/shared/FloatingButtons.js',
  './src/modules/ai/ai-widget.js',
  './src/components/shared/Toast.js',
  './src/components/shared/ProgressModal.js',
  './src/components/shared/PwaBar-open.js',
  './src/assets/brand-logo.js',
  './src/components/shared/PwaBar-close.js',
  './src/components/NotificationCenter.js',
  './src/modules/orders/orders-modal.js',
  './src/modules/maintenance/maintenance-modal.js',
  './src/modules/molds/molds-modals.js',
  './src/modules/inventory/inventory-modals.js',
  './src/modules/hr/hr-modal.js',
  './src/modules/maintenance/maintenance-ton-modals.js',
  './src/modules/account/account-modals.js',
  './src/components/shared/ConfirmModal.js',
  './src/modules/orders/orders-detail-modal.js',
  './src/modules/quality/quality-detail-modal.js',
  './src/modules/planning/planning-modals.js',
  './src/modules/qr/qr-modals.js',
  './src/modules/molds/molds-data.js',
  './src/modules/checklist/checklist-data.js',
  './src/modules/maintenance/maintenance-data.js',
  './src/core/state-manager.js',
  './src/modules/orders/orders-service.js',
  './src/modules/account/account-service.js',
  './src/services/notification.js',
  './src/services/firebase.js',
  './src/services/storage.js',
  './src/modules/attendance/attendance-service.js',
  './src/modules/checklist/checklist-service.js',
  './src/modules/inventory/inventory-service.js',
  './src/modules/qr/qr-service.js',
  './src/modules/hr/hr-service.js',
  './src/modules/maintenance/maintenance-service.js',
  './src/modules/molds/molds-service.js',
  './src/modules/audit/audit-log.js',
  './src/modules/ai/ai-chat.js',
  './src/modules/ai/ai-commands.js',
  './src/modules/ai/ai-llm.js',
  './src/services/sync.js',
  './src/services/backup.js',
  './src/services/sync-realtime.js',
  './src/core/permissions.js',
  './src/modules/account/account-menu.js',
  './src/services/presence.js',
  './src/components/shared/Modal.js',
  './src/modules/auth/password.js',
  './src/modules/auth/login.js',
  './src/core/app.js',
  './src/core/router.js',
  './src/modules/planning/planning-nav.js',
  './src/modules/orders/orders-shared.js',
  './src/modules/dashboard/insights.js',
  './src/components/shared/charts.js',
  './src/modules/dashboard/dashboard-factory.js',
  './src/modules/dashboard/dashboard-widgets.js',
  './src/modules/dashboard/dashboard-view.js',
  './src/modules/orders/orders-filter.js',
  './src/modules/orders/orders-view.js',
  './src/components/shared/ActionMenu.js',
  './src/modules/orders/orders-export.js',
  './src/components/shared/SearchBubble-logic.js',
  './src/modules/planning/planning-view.js',
  './src/modules/tv-mode/tv-mode.js',
  './src/modules/production/production-panels.js',
  './src/modules/production/production-view.js',
  './src/modules/planning/planning-detail.js',
  './src/modules/quality/quality-view.js',
  './src/modules/quality/quality-export.js',
  './src/modules/quality/quality-actions.js',
  './src/modules/quality/cp-seed.js',
  './src/modules/quality/cp-core.js',
  './src/modules/quality/cp-view.js',
  './src/modules/quality/cp-forms.js',
  './src/modules/quality/cp-master.js',
  './src/modules/quality/cp-reports.js',
  './src/modules/quality/cp-export.js',
  './src/modules/reports/reports-view.js',
  './src/modules/customers/customers-view.js',
  './src/modules/audit/audit-view.js',
  './src/modules/settings/settings-version.js',
  './src/modules/settings/settings-view.js',
  './src/modules/hr/hr-workers.js',
  './src/modules/attendance/attendance-view.js',
  './src/modules/hr/hr-view.js',
  './src/modules/hr/hr-leave-discipline.js',
  './src/modules/attendance/attendance-export.js',
  './src/modules/attendance/attendance-schedule.js',
  './src/modules/maintenance/maintenance-view.js',
  './src/modules/molds/molds-view.js',
  './src/modules/molds/molds-export.js',
  './src/utils/lib-loader.js',
  './src/modules/inventory/inventory-view.js',
  './src/modules/inventory/inventory-export.js',
  './src/modules/trace/trace-engine.js',
  './src/modules/trace/trace-view.js',
  './src/components/shared/ModuleEnhance.js',
  './src/modules/orders/orders-insight.js',
  './src/modules/planning/planning-insight.js',
  './src/modules/inventory/inventory-insight.js',
  './src/modules/trace/trace-export.js',
  './src/modules/tv-mode/tv-wakelock.js',
  './src/modules/checklist/checklist-view.js',
  './src/modules/checklist/checklist-export.js',
  './src/modules/molds/molds-qty.js',
  './src/modules/maintenance/maintenance-ton.js',
  './src/components/shared/ComboBox.js',
  './src/modules/orders/orders-form.js',
  './src/modules/orders/orders-cards.js',
  './src/modules/planning/planning-machines.js',
  './src/modules/production/production-dispatch.js',
  './src/modules/account/account-users.js',
  './src/services/update.js',
  './src/services/traceability.js',
  './src/modules/qr/qr-public-scan.js',
  './src/modules/qr/qr-share.js',
  './src/modules/qr/qr-public-nhansu.js',
  './src/modules/qr/qr-public-ccllv.js',
  './src/modules/qr/qr-public-khuon.js',
  './src/modules/qr/qr-view.js',
  './src/modules/qr/qr-actions.js',
  './src/modules/qr/qr-print.js',
  './src/components/shared/capture.js',
  './src/modules/attendance/attendance-capture.js',
  './src/styles/tokens.css',
  './src/modules/qr/qr-public.css',
  './src/modules/auth/auth.css',
  './src/styles/components.css',
  './src/styles/layout.css',
  './src/modules/qr/qr.css',
  './src/styles/layout-content.css',
  './src/styles/components-cards.css',
  './src/modules/dashboard/dashboard.css',
  './src/modules/maintenance/maintenance.css',
  './src/modules/molds/molds.css',
  './src/modules/inventory/inventory.css',
  './src/modules/trace/trace.css',
  './src/modules/molds/molds-blocks.css',
  './src/styles/components-modal.css',
  './src/modules/settings/settings.css',
  './src/styles/notification.css',
  './src/modules/reports/reports.css',
  './src/modules/settings/settings-version.css',
  './src/styles/components-misc.css',
  './src/modules/orders/orders.css',
  './src/modules/planning/planning.css',
  './src/modules/tv-mode/tv-mode.css',
  './src/modules/production/production.css',
  './src/modules/customers/customers.css',
  './src/modules/production/production-tv-v3.css',
  './src/styles/components-header.css',
  './src/modules/orders/orders-list.css',
  './src/modules/quality/quality.css',
  './src/modules/quality/cp.css',
  './src/styles/announce.css',
  './src/modules/ai/ai.css',
  './src/styles/components-empty.css',
  './src/modules/reports/reports-charts.css',
  './src/styles/responsive.css',
  './src/styles/layout-redesign.css',
  './src/modules/dashboard/dashboard-overview.css',
  './src/modules/planning/planning-cards.css',
  './src/styles/redesign-2026.css',
  './src/modules/planning/planning-erp.css',
  './src/styles/responsive-mobile.css',
  './src/styles/design-system.css',
  './src/modules/dashboard/dashboard-factory.css',
  './src/styles/modules-insight.css',
  './src/styles/header-erp.css',
  './src/modules/production/production-dh4.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  // KHÔNG tự self.skipWaiting() ở đây nữa — index.html chủ động gửi
  // message SKIP_WAITING (xem listener 'message' bên dưới) đúng lúc
  // muốn kích hoạt bản mới (sau khi hiện banner báo có bản mới), tránh
  // đột ngột đổi bản/reload giữa lúc người dùng đang thao tác dở.
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Lệnh "kích hoạt bản mới ngay" gửi từ index.html khi phát hiện bản
// mới đã cài xong (nw.postMessage({type:'SKIP_WAITING'})) — trước đây
// KHÔNG có listener này nên lệnh gửi đi rơi vào hư không.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // không can thiệp POST/PUT lên Firebase
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // request tới Firebase/API khác origin: đi thẳng qua mạng

  const isAppShell = req.mode === 'navigate'
    || url.pathname.endsWith('.html')
    || url.pathname.endsWith('.js')
    || url.pathname.endsWith('.css') // CSS nay là file riêng (trước đây nằm trong index.html) → cũng phải NETWORK-FIRST để không chạy bản cũ
    || url.pathname.endsWith('manifest.json')
    || url.pathname.endsWith('version.json');

  if (isAppShell) {
    // NETWORK-FIRST: luôn ưu tiên bản mới nhất từ mạng; chỉ rơi về
    // cache khi mất mạng hẳn (không fetch được).
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, resClone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Tài nguyên tĩnh khác (ảnh, icon, font...): cache-first cho nhanh,
  // vẫn âm thầm cập nhật cache ngầm cho lần sau.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, resClone)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
