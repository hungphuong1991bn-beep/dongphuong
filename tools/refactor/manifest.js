// ════════════════════════════════════════════════════════════════════
// MANIFEST TÁCH MÃ NGUỒN — mô tả CHÍNH XÁC mỗi khối mã của index.html gốc
// được chuyển tới file nào. Dùng bởi build.js (sinh src/) và verify.js
// (chứng minh không mất/đổi 1 ký tự nào). Không chứa logic nghiệp vụ.
//
// NGUYÊN TẮC AN TOÀN:
//  • JS: ứng dụng gốc là 1 <script> toàn cục (hàm/biến dùng chung qua phạm vi
//    toàn cục + onclick="..." trong HTML). Vì vậy mỗi file src/**.js vẫn là
//    <script> thường (KHÔNG type=module) nạp theo thứ tự có kiểm chứng.
//  • CSS: thứ tự cascade là bất biến → mỗi file là 1 đoạn LIÊN TIẾP của CSS gốc,
//    nạp đúng thứ tự gốc.
//  • HTML: mỗi khối markup được document.write tại ĐÚNG vị trí cũ trong DOM.
// ════════════════════════════════════════════════════════════════════
const N = s => new Set(s.trim().split(/\s+/));

// ───────────────────────── JS ─────────────────────────
// Thứ tự trong mảng = thứ tự ƯU TIÊN khớp luật (luật đầu tiên khớp thắng).
// Mỗi luật: file, names (tên khai báo), re (regex tên), ranges (dòng bắt đầu
// khối trong script chính gốc, [từ, đến] gồm cả hai đầu).
const JS_RULES = [
  // ── tài sản nhúng (base64) ──
  { file:'core/embedded-assets.js', names:N('WS_REGULAR_B64 WS_BOLD_B64 DP_LOGO_DATAURL') },

  // ── tiện ích dùng chung (utils/) ──
  { file:'utils/helpers.js', names:N('$ uid debounce escapeHtml esc _stripDiacritics _khStripAccents csvDownload b64ToArrayBuffer') },
  { file:'utils/date.js', names:N('VN_WEEKDAYS VN_WEEKDAYS_SHORT VN_MONTHS pad2 vnDateDMY vnDateDM vnTimeHM vnDateTimeShort fmtDate todayStr curYM daysInMonth weekdayVN updateTopbarClock') },
  { file:'utils/format.js', names:N('fmtNum fmtHrs fmtDuration fmtDateTime fmtTimeDateShort ovFmtKg fmtOnlineDuration fmtSyncAgo onlineTimeAgo userInitials') },
  { file:'utils/validation.js', names:N('sanitizeDisplayText parseDimInput') },
  { file:'utils/lib-loader.js', names:N('_exceljsPromise ensureExcelJs loadSheetJs _html2canvasPromise ensureHtml2Canvas _qrLibPromise ensureQrLib') },
  { file:'utils/lib-loader.js', re:/^X (ensureExcelJs\(\)|loadSheetJs\(\))/ },

  // ── core ──
  { file:'core/permissions.js', names:N('isAdmin isStaff isViewer guardViewer isSlEditor guardSlEdit canCreateOrder guardCreateOrder guardNotAdmin roleIcon roleLabel roleColor') },
  { file:'core/router.js', names:N('soLieuLocked applyRoleNav slSyncFullscreenClass slToggleSettings defaultTabFor goTab renderTab') },
  { file:'core/app.js', re:/^X document\.addEventListener\('DOMContentLoaded',\(\)=>\{/ },
  { file:'core/state-manager.js', names:N('currentUser currentTab DB actLog searchQ filterStatus') },

  // ── services ──
  { file:'services/firebase.js', ranges:[[244,384]] },
  { file:'services/storage.js', ranges:[[385,419]] },
  { file:'services/notification.js', names:N('_unlockAudioOnce _notifOk notifSoundOn notifVibrateOn _audioCtx NOTIF_KEY notifList _notifUnread notifLoad notifSave addNotif sendBroadcast _lastBroadcastId checkBroadcast requestNotif pushNotif notifyNewOrder getAudioCtx _tone playNotifSound vibrateDevice alertUser toggleNotifSound toggleNotifVibrate testNotifAlert') },
  { file:'services/notification.js', re:/^X document\.addEventListener\('(click|touchstart)', _unlockAudioOnce/ },
  { file:'services/backup.js', ranges:[[2842,2939]] },
  { file:'services/presence.js', names:N('_devId _sessionStart deviceInfo TAB_LABEL _clockOffset nowSrv roleBreakdownTxt showFbNotConfigured refreshOnlineListOnly updateOnline') },
  { file:'services/presence.js', re:/^X window\.addEventListener\('beforeunload'/ },
  { file:'services/traceability.js', names:N('QR_STAGES QR_STAGE_LABEL COPPER_GRADES qrStatusInfo qrDateStr qrPublicUrl genUniqueQrCode _qrBatchCounter') },
  { file:'services/update.js', ranges:[[15372,15665]] },
  { file:'services/update.js', names:N('_deferInstall') },
  // sync: tầng hạ tầng đồng bộ (đánh dấu thay đổi, merge mảng theo id, khởi động, SSE/polling)
  { file:'services/sync.js', names:N('_pendingSaves beginSave endSave _pollTimer _lastHash _knownIds _saving DIRTY_KEY getDirtyFields markDirty clearDirty fbSaveField actorName saveAll snapshotArrById _lastSyncedArrSnap mergeAndSaveArrField syncArrFieldToServer initAndStartSync') },
  { file:'services/sync.js', ranges:[[2818,2840]] },
  { file:'services/sync-realtime.js', ranges:[[2940,3257]] },

  // ── components dùng chung ──
  { file:'components/GlobalHeader.js', names:N('tbFilterTab tbFilterBtnClick tbMobileSearchToggle tbMobileSearchClose tbUpdateFilterBtn tbGlobalSearchGo _tbGlobalSearchLiveDebounced tbGlobalSearchLive topbarRefreshClick _lastSyncOkAt _syncTickTimer tickSyncAgo setSyncDot') },
  { file:'components/Sidebar.js', names:N('initTopScroll toggleSB closeSB updateBadges updateBtmBadge updateKhuonBadge _scanStatsLastFetch _scanStatsCache renderSidebarScanStats scanStatsSidebarHtml presenceAvatarHTML renderPresenceLists') },
  { file:'components/NotificationCenter.js', names:N('updateBellBadge animateBell flashScreen closeNotifPanel NOTIF_ICO renderNotifList clickNotif markAllRead ANN_KEY _annType _currentAnn ANN_ICO ANN_LABEL openAnnounce selectAnnType renderAnnPreview buildAnnHTML publishAnnounce showAnnBanner hideAnnBanner dismissAnnounce _lastAnnId checkAnnounce clearAnnounce') },
  { file:'components/shared/Toast.js', names:N('_toastT showToast') },
  { file:'components/shared/Modal.js', names:N('_cfCb openModal closeModal confirm2 cfOK') },
  { file:'components/shared/Modal.js', ranges:[[3941,3945]] },
  { file:'components/shared/SearchBubble-logic.js', ranges:[[6279,6539]] },
  { file:'components/shared/ActionMenu.js', names:N('closeAllActionMenus openActionMenu') },
  { file:'components/shared/ActionMenu.js', ranges:[[5750,5752],[17492,17499]] },
  { file:'components/shared/ComboBox.js', ranges:[[14071,14128]] },
  { file:'components/shared/charts.js', ranges:[[4748,4825]] },
  { file:'components/shared/capture.js', names:N('captureAndShareElement') },
  { file:'components/SetupScreens.js', names:N('saveFbCfg skipFb') },

  // ── auth ──
  { file:'modules/auth/password.js', ranges:[[4030,4109]] },
  { file:'modules/auth/login.js', ranges:[[4110,4231]] },

  // ── account (tài khoản / menu người dùng) ──
  { file:'modules/account/account-service.js', names:N('snapshotUsers _lastSyncedUsersSnapshot saveUsers mergeAndSaveUsers _editUserId') },
  { file:'modules/account/account-menu.js', ranges:[[3355,3583]] },
  { file:'modules/account/account-users.js', ranges:[[15179,15256]] },

  // ── audit ──
  { file:'modules/audit/audit-log.js', names:N('saveLog log updateLogBadge') },
  { file:'modules/audit/audit-view.js', ranges:[[9708,9793]] },

  // ── AI trợ lý ──
  { file:'modules/ai/ai-llm.js', ranges:[[2373,2601]] },
  { file:'modules/ai/ai-commands.js', ranges:[[1853,2372],[2602,2637]] },
  { file:'modules/ai/ai-chat.js', ranges:[[1629,1852]] },

  // ── orders ──
  { file:'modules/orders/orders-service.js', names:N('snapshotOrders _lastSyncedOrdersSnapshot dedupeOrdersByIdKeepNewest _healingLegacyKeys healOrdersLegacyKeys saveOrders stampOrderVersion writeOrderRecord mergeAndSaveOrders _lastSyncedTrashSnapshot saveOrdersTrash mergeAndSaveOrdersTrash AUTOCLEAN_LOCK_KEY AUTOCLEAN_MIN_INTERVAL_MS AUTOCLEAN_DAYS _autoCleanRunning autoCleanLastRun canRunAutoClean autoCleanupDoneOrders hashOrders _savingOrder saveOrder _saveOrderImpl ordersLookDuplicate findDuplicateOrders deleteOrder setStatus _editOrderId ddRecvFrom ddPriorityFilter ddCustomerFilter ddSpecFilter ddSelected') },
  { file:'modules/orders/orders-shared.js', names:N('statusInfo orderSpecGridHTML priColor specStr qtyLabel ddProgressPct') },
  { file:'modules/orders/orders-filter.js', names:N('_normSpecQuery _specTokenMatch matchSearch _smartTokenNorm _smartFindPhrase') },
  { file:'modules/orders/orders-export.js', names:N('ddExportExcel') },
  { file:'modules/orders/orders-cards.js', names:N('goToOrderCard renderAIWarn renderProgressBar renderStageTracker setStage') },
  { file:'modules/orders/orders-form.js', ranges:[[14131,14216],[14695,14809]] },
  { file:'modules/orders/orders-view.js', ranges:[[5612,6273],[6540,6828]] },

  // ── dashboard ──
  { file:'modules/dashboard/insights.js', names:N('aiAnalyzeOrder aiGetInsights') },
  { file:'modules/dashboard/dashboard-widgets.js', ranges:[[4826,5051]] },
  { file:'modules/dashboard/dashboard-view.js', ranges:[[5052,5611]] },

  // ── planning / production / tv-mode ──
  { file:'modules/planning/planning-machines.js', ranges:[[14359,14406],[14629,14694]] },
  { file:'modules/planning/planning-detail.js', ranges:[[8361,8586]] },
  { file:'modules/planning/planning-nav.js', names:N('goToOrderInPlan') },
  { file:'modules/planning/planning-view.js', ranges:[[6829,7132]] },
  { file:'modules/tv-mode/tv-mode.js', names:N('dhToggleTv _dhWatchersBound dhBindAutoFit') },
  { file:'modules/tv-mode/tv-mode.js', ranges:[[7133,7250]] },
  { file:'modules/production/production-dispatch.js', ranges:[[14407,14628],[14971,15084]] },
  { file:'modules/production/production-view.js', names:N('renderDieuHanh dhTickClock') },
  { file:'modules/production/production-panels.js', ranges:[[7251,8229]] },

  // ── quality (đơn hoàn thành / thành phẩm) ──
  { file:'modules/quality/quality-export.js', ranges:[[8785,8873]] },
  { file:'modules/quality/quality-actions.js', ranges:[[8874,9146]] },
  { file:'modules/quality/quality-view.js', ranges:[[8587,8784],[9147,9334]] },

  // ── reports / customers ──
  { file:'modules/reports/reports-view.js', ranges:[[9335,9501]] },
  { file:'modules/customers/customers-view.js', ranges:[[9502,9707]] },

  // ── settings ──
  { file:'modules/settings/settings-version.js', ranges:[[9794,10058]] },
  { file:'modules/settings/settings-view.js', ranges:[[10059,10159]] },

  // ── hr / attendance ──
  { file:'modules/hr/hr-service.js', names:N('saveWorkers') },
  { file:'modules/hr/hr-workers.js', names:N('refreshWorkerViews nextWorkerCode addWorker renameWorker deleteWorker setSelectKeepCustom openWorkerProfile saveWorkerProfile') },
  { file:'modules/hr/hr-view.js', ranges:[[10531,10815]] },
  { file:'modules/hr/hr-leave-discipline.js', ranges:[[10816,11009]] },
  { file:'modules/attendance/attendance-service.js', names:N('flattenAttendance unflattenAttendance _lastSyncedAttendanceSnapshot saveAttendance mergeAndSaveAttendance saveLichLamViec') },
  { file:'modules/attendance/attendance-export.js', ranges:[[11010,11151]] },
  { file:'modules/attendance/attendance-schedule.js', ranges:[[11152,11664]] },
  { file:'modules/attendance/attendance-capture.js', ranges:[[17485,17505]] },
  { file:'modules/attendance/attendance-view.js', ranges:[[10160,10530]] },

  // ── maintenance ──
  { file:'modules/maintenance/maintenance-data.js', names:N('MAINT_TON_INFO maintTypeOfMachine') },
  { file:'modules/maintenance/maintenance-service.js', names:N('saveBaoTri') },
  { file:'modules/maintenance/maintenance-ton.js', ranges:[[13887,14061]] },
  { file:'modules/maintenance/maintenance-view.js', ranges:[[11665,11897]] },

  // ── molds ──
  { file:'modules/molds/molds-data.js', ranges:[[108,118]] },
  { file:'modules/molds/molds-service.js', names:N('saveKhuonCatalog saveKhuonQty') },
  { file:'modules/molds/molds-export.js', ranges:[[12143,12281]] },
  { file:'modules/molds/molds-qty.js', ranges:[[13623,13886]] },
  { file:'modules/molds/molds-view.js', ranges:[[11898,12142]] },

  // ── inventory (tab Số liệu) ──
  { file:'modules/inventory/inventory-service.js', names:N('SL_AUTOCLEAN_LOCK_KEY SL_AUTOCLEAN_DAYS _slAutoCleanRunning SL_REMIND_DAYS_BEFORE SL_REMIND_LOCK_KEY slDaysUntilAutoDelete slSoonExpireInfo slRemindBannerHTML slRemindExportIfNeeded slAutoCleanLastRun canRunSlAutoClean autoCleanupSoLieu writeSlLogRecord syncSlFieldPerRecord applySingleSlItemChange _slMigratedField migrateSlLogIfArray saveNguyenLieuLog saveMayRutLog saveMayDanhBongLog') },
  { file:'modules/inventory/inventory-export.js', ranges:[[12887,13228]] },
  { file:'modules/inventory/inventory-view.js', ranges:[[12282,12886]] },

  // ── checklist ──
  { file:'modules/checklist/checklist-data.js', ranges:[[119,163]] },
  { file:'modules/checklist/checklist-service.js', names:N('flattenCsData unflattenCsData _lastSyncedCsDataSnapshot saveCsTemplates saveCsData mergeAndSaveCsData') },
  { file:'modules/checklist/checklist-export.js', ranges:[[13486,13622]] },
  { file:'modules/checklist/checklist-view.js', ranges:[[13229,13485]] },

  // ── QR ──
  { file:'modules/qr/qr-service.js', names:N('saveQrProducts') },
  { file:'modules/qr/qr-share.js', ranges:[[15878,16086]] },
  { file:'modules/qr/qr-public-nhansu.js', ranges:[[16087,16323]] },
  { file:'modules/qr/qr-public-ccllv.js', ranges:[[16324,16543]] },
  { file:'modules/qr/qr-public-khuon.js', ranges:[[16544,16693]] },
  { file:'modules/qr/qr-public-scan.js', ranges:[[15742,15877]] },
  { file:'modules/qr/qr-print.js', ranges:[[17201,17404]] },
  { file:'modules/qr/qr-actions.js', ranges:[[16953,17200]] },
  { file:'modules/qr/qr-view.js', ranges:[[16694,16952]] },

  // ── còn lại theo vùng ──
  { file:'core/constants.js', ranges:[[1,107],[183,190]] },
  { file:'modules/settings/settings-firebase.js', ranges:[[15257,15284]] },
];

// Thứ tự NẠP file JS (phase 'pre' = đầu <body>, 'slot:<id>' = tại vị trí markup, 'main' = cuối <body>)
// Thứ tự trong 'main' do build.js tính theo vị trí gốc, có thể ghim ở đây.
const JS_PRE = ['core/constants.js','core/embedded-assets.js','utils/helpers.js','utils/date.js','utils/format.js','utils/validation.js'];

// ───────────────────────── CSS ─────────────────────────
// [file, dòng bắt đầu trong style #1 gốc] — mỗi file chạy tới dòng bắt đầu của file kế tiếp.
const CSS_CUTS = [
  ['styles/tokens.css',1],
  ['modules/qr/qr-public.css',32],
  ['modules/auth/auth.css',117],
  ['styles/components.css',126],
  ['styles/layout.css',172],
  ['modules/qr/qr.css',298],
  ['styles/layout-content.css',353],
  ['styles/components-cards.css',397],
  ['modules/dashboard/dashboard.css',538],
  ['modules/maintenance/maintenance.css',828],
  ['modules/molds/molds.css',861],
  ['modules/inventory/inventory.css',916],
  ['modules/molds/molds-blocks.css',971],
  ['styles/components-modal.css',1005],
  ['modules/settings/settings.css',1020],
  ['styles/notification.css',1051],
  ['modules/reports/reports.css',1113],
  ['modules/settings/settings-version.css',1155],
  ['styles/components-misc.css',1187],
  ['modules/orders/orders.css',1203],
  ['modules/planning/planning.css',1399],
  ['modules/tv-mode/tv-mode.css',1438],
  ['modules/production/production.css',1989],
  ['modules/customers/customers.css',2433],
  ['modules/production/production-tv-v3.css',2484],
  ['styles/components-header.css',2624],
  ['modules/orders/orders-list.css',2663],
  ['modules/quality/quality.css',2835],
  ['styles/announce.css',2940],
  ['modules/ai/ai.css',3042],
  ['styles/components-empty.css',3084],
  ['modules/reports/reports-charts.css',3093],
  ['styles/responsive.css',3170],
  ['styles/layout-redesign.css',3236],
  ['modules/dashboard/dashboard-overview.css',3326],
  ['modules/planning/planning-cards.css',3584],
  ['styles/redesign-2026.css',3665],
  ['modules/planning/planning-erp.css',3873],
  ['styles/responsive-mobile.css',4087],
];
const CSS2_FILE = 'modules/production/production-dh4.css'; // <style id="dh4-style"> thứ hai

// ───────────────────────── HTML slots ─────────────────────────
// [id, file, dòng đầu, dòng cuối] của index.html gốc (gồm cả hai đầu)
const SLOTS = [
  ['setup','components/SetupScreens.js',6828,6868],
  ['pubscan','modules/qr/qr-public-screen.js',6870,6876],
  ['login','modules/auth/login-screen.js',6878,6903],
  ['sidebar','components/Sidebar.js',6907,7006],
  ['topbar','components/GlobalHeader.js',7011,7082],
  ['bottomnav','components/BottomNav.js',7094,7149],
  ['search','components/shared/SearchBubble.js',7153,7167],
  ['fab','components/shared/FloatingButtons.js',7169,7171],
  ['aiwidget','modules/ai/ai-widget.js',7173,7214],
  ['toast','components/shared/Toast.js',7216,7217],
  ['progress','components/shared/ProgressModal.js',7219,7247],
  ['pwa1','components/shared/PwaBar-open.js',7249,7251],
  // 7252-7261 = script logo (đi vào src/assets/brand-logo.js, giữ nguyên vị trí)
  ['pwa2','components/shared/PwaBar-close.js',7262,7265],
  ['notif','components/NotificationCenter.js',7267,7340],
  ['m-orders','modules/orders/orders-modal.js',7342,7443],
  ['m-btm','modules/maintenance/maintenance-modal.js',7445,7491],
  ['m-molds','modules/molds/molds-modals.js',7493,7550],
  ['m-inv','modules/inventory/inventory-modals.js',7552,7674],
  ['m-hr','modules/hr/hr-modal.js',7677,7761],
  ['m-ton','modules/maintenance/maintenance-ton-modals.js',7763,7827],
  ['m-acc','modules/account/account-modals.js',7829,7924],
  ['m-cf','components/shared/ConfirmModal.js',7926,7937],
  ['m-dd','modules/orders/orders-detail-modal.js',7939,7951],
  ['m-ht','modules/quality/quality-detail-modal.js',7953,7965],
  ['m-kh','modules/planning/planning-modals.js',7967,7991],
  ['m-qr','modules/qr/qr-modals.js',7994,8150],
];
const LOGO_SCRIPT = {file:'assets/brand-logo.js', from:7253, to:7260}; // nội dung giữa <script> (7252) và </script> (7261)

module.exports = { JS_RULES, JS_PRE, CSS_CUTS, CSS2_FILE, SLOTS, LOGO_SCRIPT };
