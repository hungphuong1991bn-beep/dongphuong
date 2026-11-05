// src/core/app.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Enter to login
document.addEventListener('DOMContentLoaded',()=>{
  // Logo công ty ở đầu Sidebar (thay cho tên tài khoản trước đây)
  try{ const bl=$('sbBrandLogo'); if(bl) bl.src=DP_LOGO_DATAURL; }catch(e){}
  // TV Mode khoá cứng qua URL (?tv=1) — dùng cho CỬA SỔ TV riêng (Windows
  // Extend: 1 PC + 1 màn PC + 1 TV). Mở link này trên cửa sổ TV, tab sẽ tự
  // khoá vĩnh viễn ở "Điều hành sản xuất" — không liên quan/không ảnh hưởng
  // tới cửa sổ PC đang thao tác bình thường (2 cửa sổ = 2 currentTab độc
  // lập, không dùng chung). Lưu vào sessionStorage (riêng theo từng cửa sổ)
  // nên vẫn giữ khoá nếu cửa sổ TV lỡ bị tải lại, không cần bấm lại nút TV
  // Mode hay F5 thủ công mỗi lần.
  if(new URLSearchParams(location.search).get('tv')==='1'){
    try{ sessionStorage.setItem('sx_tv_locked','1'); localStorage.setItem('sx_tv_locked','1'); }catch(e){}
  }
  // Nếu link mở ra từ việc quét mã QR (khách hàng dùng camera điện thoại
  // thường, không qua app) → hiện thẳng trang tra cứu công khai, không
  // yêu cầu đăng nhập, và bỏ qua toàn bộ luồng khởi tạo app bên dưới.
  const _qrParam = new URLSearchParams(location.search).get('qr');
  if(_qrParam){
    renderPublicScan(_qrParam);
    return;
  }
  // Link QR xem Chấm công + Lịch làm việc (dán ở bảng tin/xưởng SX) —
  // cũng hiện thẳng trang công khai, không yêu cầu đăng nhập.
  const _pubParam = new URLSearchParams(location.search).get('pub');
  if(_pubParam==='ccllv'){
    renderPublicCcllv();
    return;
  }
  // Link QR xem Tổng hợp Khuôn (dán tại xưởng khuôn/kho khuôn) — khách
  // hàng và mọi người quét bằng camera điện thoại thường, hiện thẳng
  // trang công khai, không yêu cầu đăng nhập.
  if(_pubParam==='khuon'){
    renderPublicKhuon();
    return;
  }
  // Link QR xem Danh sách nhân sự + Nghỉ phép (công khai, không đăng nhập).
  if(_pubParam==='nhansu'){
    renderPublicNhanSu();
    return;
  }
  $('lp').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });
  $('lu').addEventListener('keydown',e=>{ if(e.key==='Enter') $('lp').focus(); });
  // Restore session nếu đã đăng nhập trước đó
  const savedUid = localStorage.getItem('sx_session_uid');
  if(savedUid){
    lsLoad();
    const savedUser = DB.users.find(u=>u.id===savedUid);
    if(savedUser){
      currentUser = savedUser;
      // Dọn mật khẩu chữ thường còn sót (nếu có) ngay khi mở app, không
      // cần đợi ai đó đăng nhập lại mới được băm
      // FIX MẤT TÀI KHOẢN: KHÔNG được ghi đè cả mảng /data/users bằng
      // fbWrite(...,'PUT') dùng DB.users cục bộ (có thể đang CŨ hơn server,
      // ví dụ thiết bị này chưa đồng bộ tài khoản mới tạo ở máy khác) —
      // trước đây làm vậy đã xoá mất tài khoản mới tạo trên các thiết bị
      // khác. Dùng mergeAndSaveUsers() (đã có sẵn, đọc lại server rồi merge
      // theo từng id) để chỉ áp mật khẩu vừa băm lại, không đụng tài khoản
      // của người khác.
      migrateUserPasswords(DB.users).then(changed=>{
        if(changed){ lsSave(); if(fbOk()) mergeAndSaveUsers().catch(()=>{}); }
      });
      updateTopbarProfile(savedUser);
      $('loginScreen').classList.remove('active');
      $('appScreen').classList.add('active');
      notifLoad();
      initAndStartSync().then(()=>{
        updateOnline();
        // Load announce đang active từ Firebase
        if(fbOk()) checkAnnounce();

      });
      requestNotif();
      updateBellBadge();
      // Hiện nút viết TB cho admin
      const wb=$('annWriteBtn');
      if(wb) wb.style.display=isAdmin()?'flex':'none';
      aiCacheLoad(); updateAiBubble();
      applyRoleNav();
      goTab(defaultTabFor());
    } else {
      localStorage.removeItem('sx_session_uid');
    }
  }
  updateTopbarClock();
  setInterval(updateTopbarClock, 1000);

  // Đồng hồ đếm thời gian chạy — cập nhật mỗi giây
  setInterval(()=>{
    const now=Date.now();
    DB.orders.forEach(o=>{
      if((o.status==='running'||o.status==='cutting')&&o.startedAt){
        const el=document.getElementById('clk-'+o.id);
        if(!el) return;
        const ms=now-o.startedAt;
        const totalSec=Math.floor(ms/1000);
        const h=Math.floor(totalSec/3600);
        const m=Math.floor((totalSec%3600)/60);
        const s=totalSec%60;
        const hh=h>0?String(h).padStart(2,'0')+':':'';
        const mm=String(m).padStart(2,'0');
        const ss=String(s).padStart(2,'0');
        el.textContent='⏱ '+hh+mm+':'+ss;
      }
    });
  },1000);
});
