// src/core/router.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════════════
// Tài khoản có vai trò "solieu" (Số liệu) bị khoá cứng chỉ được dùng tab
// 📊 Số liệu (toàn màn hình, giống TV Mode) — chỉ ngoại lệ cho tab Cài đặt
// để vẫn có đường vào bấm Đăng xuất (qua nút bánh răng nổi #slGearBtn).
function soLieuLocked(){ return currentUser?.role==='solieu'; }
function applyRoleNav(){
  // Tài khoản Số liệu: ẩn hết các mục menu khác (sidebar + bottom-nav),
  // chỉ chừa lại đúng 1 mục "📊 Số liệu" để không thể bấm sang tab khác.
  const locked = soLieuLocked();
  document.querySelectorAll('.sb-item').forEach(x=>{
    x.style.display = (!locked || x.id==='sbi-soLieu') ? '' : 'none';
  });
  const bnav = $('bottomNav');
  if(bnav) bnav.style.display = locked ? 'none' : '';
  slSyncFullscreenClass();
}
// Đồng bộ class toàn trang <body> để hiện/ẩn giao diện full màn hình của
// tài khoản Số liệu — gọi mỗi khi đăng nhập/khôi phục phiên và mỗi lần
// goTab() để luôn khớp đúng trạng thái hiện tại.
function slSyncFullscreenClass(){
  try{ document.body.classList.toggle('sl-fullscreen', soLieuLocked()); }catch(e){}
}
// Bấm nút bánh răng nổi: đang ở Số liệu → mở Cài đặt (để đăng xuất); đang
// ở Cài đặt → quay lại Số liệu.
function slToggleSettings(){
  if(!soLieuLocked()) return;
  goTab(currentTab==='settings' ? 'soLieu' : 'settings');
}
function defaultTabFor(){ if(soLieuLocked()) return 'soLieu'; return dhTvLocked() ? 'dieuHanh' : 'dashboard'; }
function goTab(tab){
  // Tab "Khách hàng" — Admin và Nhân viên SX đều được phép mở (isStaff()),
  // chặn cả khi bị gọi trực tiếp, chỉ Chỉ xem/Số liệu mới bị ép về tab khác.
  if(tab==='khachHang' && !isStaff()) tab = defaultTabFor();
  // Tài khoản Số liệu bị khoá cứng → luôn ép về tab 📊 Số liệu, CHỈ trừ khi
  // chính người dùng chủ động mở Cài đặt (qua nút bánh răng) để đăng xuất.
  if(soLieuLocked() && tab!=='settings') tab='soLieu';
  // Cửa sổ đang ở TV Mode khoá cứng → luôn ép về Điều hành SX, bất kể tab
  // nào được truyền vào (kể cả nếu có thao tác/điều hướng lỡ xảy ra ngay
  // trong chính cửa sổ TV). Tự bật lại TV Mode + fullscreen nếu vì lý do
  // gì đó đang bị tắt (ví dụ cửa sổ vừa được tải lại).
  if(dhTvLocked()){
    tab='dieuHanh';
    if(!dhTvMode){
      dhTvMode=true;
      dhApplyFullscreen(true, true);
    }
    dhSyncFullscreenClass();
  } else if(dhTvMode){
    // Phòng trường hợp hiếm: cửa sổ vẫn còn cờ dhTvMode nhưng khoá đã bị gỡ
    // (ví dụ dữ liệu storage bị xoá thủ công) — tắt luôn class fullscreen.
    dhTvMode=false;
    dhSyncFullscreenClass();
  }
  currentTab=tab;
  // Sidebar
  document.querySelectorAll('.sb-item').forEach(x=>x.classList.remove('active'));
  const si=$('sbi-'+tab); if(si) si.classList.add('active');
  // Bottom nav
  document.querySelectorAll('.bn').forEach(x=>x.classList.remove('active'));
  const bn=$('bn-'+tab); if(bn) bn.classList.add('active');
  // Title
  const titles={dashboard:'Tổng quan',dorDang:'Đơn Hàng',keHoach:'Kế hoạch SX',dieuHanh:'🏭 Điều hành SX',hoanThanh:'Đơn hoàn thành',baoCao:'Báo cáo',khachHang:'🧑\u200d🤝\u200d🧑 Khách hàng',nhanSu:'Quản lý nhân sự',chamCong:'Chấm công',baoTriMay:'Bảo trì máy',khuon:'Quản lý Khuôn',checkSheet:'📋 Check Sheet Thiết bị',lichLamViec:'Lịch làm việc',nhatKy:'Nhật ký thao tác',settings:'Cài đặt',qrCode:'Quản lý mã QR',soLieu:'📊 Số liệu'};
  $('pageTitle').textContent=titles[tab]||tab;
  // Badge "Realtime" + nút "Làm mới" trên Global Header: chỉ hiện ở tab
  // Tổng quan (nơi dữ liệu cập nhật theo thời gian thực), các tab khác ẩn.
  const tlb=$('topbarLiveBadge'), trb=$('topbarRefreshBtn');
  if(tlb) tlb.style.display = (tab==='dashboard') ? '' : 'none';
  if(trb) trb.style.display = (tab==='dashboard') ? '' : 'none';
  // FAB: admin mới thấy nút thêm đơn
  // FAB: admin thấy nút + ở tất cả các tab
  const fabEl=$('fab');
  if(fabEl){ fabEl.classList.toggle('show', isAdmin()); }
  // Nút bánh răng nổi (chỉ tài khoản Số liệu): đổi icon tuỳ tab đang mở —
  // ⚙️ để mở Cài đặt, ✕ để đóng Cài đặt quay lại Số liệu.
  slSyncFullscreenClass();
  const gearEl=$('slGearBtn');
  if(gearEl && soLieuLocked()){
    const inSettings = (tab==='settings');
    gearEl.textContent = inSettings ? '✕' : '⚙️';
    gearEl.title = inSettings ? 'Quay lại Số liệu' : 'Cài đặt / Đăng xuất';
  }
  $('mainWrap').scrollTop=0;
  closeSB();
  // Scroll bottom nav đến nút active
  setTimeout(()=>{
    const nav=document.getElementById('bottomNav');
    const btn=document.getElementById('bn-'+tab);
    if(nav&&btn){ const bLeft=btn.offsetLeft; const bW=btn.offsetWidth; const nW=nav.offsetWidth; nav.scrollTo({left:bLeft-(nW/2-bW/2),behavior:'smooth'}); }
  },50);
  renderTab(tab);
  updateBadges();
  if(typeof tbUpdateFilterBtn==='function') tbUpdateFilterBtn(tbFilterTab());
  if(tab==='nhatKy'){ actLog.forEach(l=>l.read=true); logSave(); updateLogBadge(); }
  if(fbOk()) updateOnline();
}

// ════════════════════════════════════════════════════════════
// RENDER
// ════════════════════════════════════════════════════════════
function renderTab(tab){
  const fns={dashboard:renderDashboard,dorDang:renderDorDang,keHoach:renderKeHoach,dieuHanh:renderDieuHanh,hoanThanh:renderHoanThanh,baoCao:renderBaoCao,khachHang:renderKhachHang,nhanSu:renderNhanSu,chamCong:renderChamCong,baoTriMay:renderBaoTriMay,khuon:renderKhuon,checkSheet:renderCheckSheet,lichLamViec:renderLichLamViec,nhatKy:renderNhatKy,settings:renderSettings,qrCode:renderQR,soLieu:renderSoLieu};
  if(fns[tab]) fns[tab]();
}
