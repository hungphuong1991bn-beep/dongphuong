// src/components/Sidebar.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`  <!-- Sidebar Overlay -->
  <div class="sidebar-overlay" id="sbOverlay" onclick="closeSB()"></div>

  <!-- Sidebar -->
  <div class="sidebar" id="sidebar">
    <div class="sb-header">
      <button type="button" class="sb-collapse-btn" id="sbCollapseBtn" onclick="toggleSBCollapse()" title="Thu gọn / mở rộng menu" aria-label="Thu gọn menu"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      <div class="sb-avatar"><img id="sbBrandLogo" src="" alt="logo"></div>
      <div>
        <div class="sb-brand-name">CÔNG TY CỔ PHẦN<br>CÔNG THƯƠNG ĐÔNG PHƯƠNG</div>
        <div style="display:none">
          <div class="sb-name" id="sbName">—</div>
          <div class="sb-role" id="sbRole">—</div>
        </div>
      </div>
    </div>
    <div class="sb-nav">
      <div class="sb-section" data-g="dieuHanh">Điều hành</div>
      <button class="sb-item" title="Tổng quan" data-g="dieuHanh" id="sbi-dashboard" onclick="goTab('dashboard')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        Tổng quan
      </button>
      <button class="sb-item" title="Điều hành SX" data-g="dieuHanh" id="sbi-dieuHanh" onclick="goTab('dieuHanh')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="13" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        Điều hành SX
      </button>
      <button class="sb-item" title="Báo cáo" data-g="dieuHanh" id="sbi-baoCao" onclick="goTab('baoCao')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        Báo cáo
      </button>
      <div class="sb-section" data-g="kinhDoanh">Kinh doanh</div>
      <button class="sb-item" title="Đơn Hàng 0" data-g="kinhDoanh" id="sbi-dorDang" onclick="goTab('dorDang')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        Đơn Hàng <span class="sb-badge" id="sbBadge" style="display:none">0</span>
      </button>
      <button class="sb-item" title="Khách hàng 0" data-g="kinhDoanh" id="sbi-khachHang" onclick="goTab('khachHang')" style="display:none">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path stroke-linecap="round" stroke-linejoin="round" d="M23 21v-3.5a3.5 3.5 0 00-2.5-3.36M16 3.6a3.5 3.5 0 010 6.8"/></svg>
        Khách hàng <span class="sb-badge" style="display:none" id="sbKhcBadge">0</span>
      </button>
      <div class="sb-section" data-g="sanXuat">Sản xuất</div>
      <button class="sb-item" title="Kế hoạch SX" data-g="sanXuat" id="sbi-keHoach" onclick="goTab('keHoach')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
        Kế hoạch SX
      </button>
      <button class="sb-item" title="Đơn hoàn thành" data-g="sanXuat" id="sbi-hoanThanh" onclick="goTab('hoanThanh')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Đơn hoàn thành
      </button>
      <div class="sb-section" data-g="kho">Kho và nguyên liệu</div>
      <button class="sb-item" title="Số liệu: Sổ nguyên liệu, Sổ máy rút, Sổ máy đánh bóng" data-g="kho" id="sbi-soLieu" onclick="goTab('soLieu')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 3v18h18" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 15l4-4 3 3 5-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Sổ nguyên liệu &amp; máy
      </button>
      <div class="sb-section" data-g="chatLuong">Chất lượng</div>
      <button class="sb-item" title="Truy xuất &amp; Khiếu nại" data-g="chatLuong" id="sbi-truyXuat" onclick="goTab('truyXuat')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/></svg>
        Truy xuất &amp; Khiếu nại
      </button>
      <button class="sb-item" title="Quản lý mã QR" data-g="chatLuong" id="sbi-qrCode" onclick="goTab('qrCode')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="21"/><line x1="21" y1="14" x2="21" y2="21"/><line x1="14" y1="17.5" x2="21" y2="17.5"/></svg>
        Quản lý mã QR
      </button>
      <div class="sb-section" data-g="nhaMay">Quản lý nhà máy</div>
      <button class="sb-item" title="Bảo trì máy 0" data-g="nhaMay" id="sbi-baoTriMay" onclick="goTab('baoTriMay')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
        Bảo trì máy <span class="sb-badge" id="sbBtmBadge" style="display:none">0</span>
      </button>
      <button class="sb-item" title="Quản lý Khuôn 0" data-g="nhaMay" id="sbi-khuon" onclick="goTab('khuon')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        Quản lý Khuôn <span class="sb-badge" id="sbKhuonBadge" style="display:none">0</span>
      </button>
      <button class="sb-item" title="Check Sheet Thiết bị" data-g="nhaMay" id="sbi-checkSheet" onclick="goTab('checkSheet')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 3v4M16 3v4M3 9h18" stroke-linecap="round"/><path d="M8 13l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Check Sheet Thiết bị
      </button>
      <button class="sb-item" title="Quản lý nhân sự" data-g="nhaMay" id="sbi-nhanSu" onclick="goTab('nhanSu')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        Quản lý nhân sự
      </button>
      <button class="sb-item" title="Lịch làm việc" data-g="nhaMay" id="sbi-lichLamViec" onclick="goTab('lichLamViec')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Lịch làm việc
      </button>
      <button class="sb-item" title="Chấm công" data-g="nhaMay" id="sbi-chamCong" onclick="goTab('chamCong')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke-linecap="round"/><path d="M9 16l1.5 1.5L15 13" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Chấm công
      </button>
      <div class="sb-section" data-g="heThong">Hệ thống</div>
      <button class="sb-item" title="Nhật ký thao tác !" data-g="heThong" id="sbi-nhatKy" onclick="goTab('nhatKy')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Nhật ký thao tác <span class="sb-badge" id="sbLogBadge" style="display:none">!</span>
      </button>
      <button class="sb-item" title="Cài đặt 🆕" data-g="heThong" id="sbi-settings" onclick="goTab('settings')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        Cài đặt <span class="sb-badge" id="sbVerBadge" style="display:none;background:var(--brand2)" title="Có bản cập nhật mới">🆕</span>
      </button>
    </div>
    <div class="sb-footer">
      <div class="sb-scanstats" id="sbScanStats" style="display:none"></div>
      <div class="sb-online" id="sbOnline"></div>
      <button class="sb-logout" onclick="doLogout()">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
        Đăng xuất
      </button>
    </div>
  </div>`);


// ── Tổng lượt quét mã QR (đơn hàng + chấm công/lịch làm việc), hiển thị ở
// đầu khung "Đang truy cập" trong sidebar — CHỈ ADMIN xem được, giúp quản lý
// nắm được mức độ dùng mã QR dán ở xưởng/trên tem sản phẩm mà không cần mở
// riêng modal tạo mã QR. Có cache 30s để không gọi Firebase liên tục mỗi lần
// danh sách "Đang truy cập" được vẽ lại (~mỗi 20s heartbeat).
let _scanStatsLastFetch = 0;
let _scanStatsCache = null;
async function renderSidebarScanStats(force){
  const box = document.getElementById('sbScanStats');
  if(!box) return;
  if(!isAdmin() || !fbOk()){ box.style.display='none'; box.innerHTML=''; return; }
  const now = Date.now();
  if(!force && _scanStatsCache && (now-_scanStatsLastFetch)<30000){
    box.style.display='';
    box.innerHTML = scanStatsSidebarHtml(_scanStatsCache);
    return;
  }
  _scanStatsLastFetch = now;
  try{
    const [donhang, chamcong, lichlamviec] = await Promise.all([
      fetchScanStats('donhang'), fetchScanStats('chamcong'), fetchScanStats('lichlamviec')
    ]);
    const stats = {donhang, chamcong, lichlamviec};
    _scanStatsCache = stats;
    const box2 = document.getElementById('sbScanStats');
    if(!box2) return; // sidebar đã đổi trong lúc tải
    box2.style.display='';
    box2.innerHTML = scanStatsSidebarHtml(stats);
  }catch(e){ /* im lặng bỏ qua — không ảnh hưởng phần còn lại của sidebar */ }
}
function scanStatsSidebarHtml(s){
  const tong = (s.donhang?.total||0) + (s.chamcong?.total||0) + (s.lichlamviec?.total||0);
  const homNay = (s.donhang?.today||0) + (s.chamcong?.today||0) + (s.lichlamviec?.today||0);
  return `<div class="sb-scanstats-hd">📷 Tổng lượt quét mã QR</div>
    <div class="sb-scanstats-total">${tong}<span class="sb-scanstats-today">hôm nay ${homNay}</span></div>
    <div class="sb-scanstats-rows">
      <span title="Tra cứu đơn hàng">📦 ${s.donhang?.total||0}</span>
      <span title="Chấm công">🗓️ ${s.chamcong?.total||0}</span>
      <span title="Lịch làm việc">📅 ${s.lichlamviec?.total||0}</span>
    </div>`;
}

// Tra avatar THẬT của 1 người trong danh sách "Đang truy cập" — presence
// (nhịp tim online) chỉ gửi tên/vai trò để nhẹ, KHÔNG gửi kèm ảnh avatar mỗi
// 20s; avatar luôn được lấy tươi từ DB.users (đã đồng bộ Firebase) theo
// "uid" (username) gửi kèm presence, fallback so tên nếu thiết bị cũ chưa
// gửi uid. Nhờ vậy khi 1 người đổi avatar, MỌI nơi hiển thị người đó —
// kể cả trên thiết bị khác — tự cập nhật theo, không cần sửa gì thêm.
function presenceAvatarHTML(u){
  const match = (typeof DB!=='undefined' && DB.users)
    ? DB.users.find(x=>(u.uid && x.username===u.uid) || x.name===u.name)
    : null;
  const avatar = match && match.avatar;
  return avatar ? `<img src="${avatar}" alt="avatar">` : userInitials(u.name);
}
function renderPresenceLists(online){
  renderSidebarScanStats();
  const sb = document.getElementById('sbOnline');
  if(sb){
    sb.innerHTML = online.length>0
      ? `<div class="sb-online-hd"><span>🟢 Đang truy cập (${online.length})</span><span class="sb-online-breakdown">${roleBreakdownTxt(online)}</span></div>
         <div class="sb-online-list">${online.map(u=>{
           const isMe = u._id===_devId;
           const d = deviceInfo(u.device);
           const tabTxt = TAB_LABEL[u.tab]||u.tab||'—';
           const durTxt = u.since ? fmtOnlineDuration(u.since) : onlineTimeAgo(u.ts);
           const tip = `${u.name} · ${roleLabel(u.role)} · Đang xem: ${tabTxt} · ${d.label} · Online ${durTxt}`.replace(/"/g,'&quot;');
           return `
           <div class="sb-online-row" title="${tip}">
             <div class="sb-online-avatar" style="box-shadow:0 0 0 2px ${roleColor(u.role)}">${presenceAvatarHTML(u)}</div>
             <div class="sb-online-body">
               <div class="sb-online-name">${u.name}${isMe?' <span class="sb-online-me">Bạn</span>':''}</div>
               <div class="sb-online-tab">${roleIcon(u.role)} ${d.icon} ${tabTxt} · ⏱ ${durTxt}</div>
             </div>
           </div>`;
         }).join('')}</div>`
      : '';
  }
  // Đồng bộ luôn khối chi tiết trên Dashboard (nếu đang mở) để số liệu
  // luôn mới — không cần rời tab rồi quay lại mới thấy cập nhật.
  if(document.getElementById('onlineEl')){
    _lastOnlineList = online;
    renderOnlineStrip();
  }
}

// ── Thanh cuộn ngang ở TRÊN bảng (đơn hàng / hoàn thành) ─────────────
// Giúp kéo xem hết các cột mà không cần cuộn xuống dưới cùng của bảng
// trước. Đồng bộ 2 chiều với vùng bảng thật, và vẫn giữ vuốt ngang mượt
// trực tiếp trên bảng ở điện thoại (toàn bộ cột, kể cả cột khách hàng,
// cuộn cùng nhau vì không còn cột nào bị "đóng băng").
function initTopScroll(topId, innerId, wrapId, tableId){
  const top = document.getElementById(topId);
  const inner = document.getElementById(innerId);
  const wrap = document.getElementById(wrapId);
  const table = document.getElementById(tableId);
  if(!top||!inner||!wrap||!table) return;
  const sync = ()=>{ inner.style.width = table.scrollWidth+'px'; };
  sync();
  // Nếu ảnh/nội dung load sau làm bảng đổi kích thước, đồng bộ lại 1 lần nữa
  setTimeout(sync, 200);
  let lock = false;
  top.onscroll = ()=>{ if(lock) return; lock=true; wrap.scrollLeft = top.scrollLeft; lock=false; };
  wrap.onscroll = ()=>{ if(lock) return; lock=true; top.scrollLeft = wrap.scrollLeft; lock=false; };
}

// ── Thu gọn / mở rộng menu (chỉ desktop ≥700px). Chỉ lưu SỞ THÍCH hiển thị
// của thiết bị này (localStorage), không đụng dữ liệu nghiệp vụ.
function applySBCollapse(){
  let c=false; try{ c = localStorage.getItem('dp_sb_collapsed')==='1'; }catch(e){}
  document.body.classList.toggle('sb-collapsed', c);
}
function toggleSBCollapse(){
  const c = !document.body.classList.contains('sb-collapsed');
  document.body.classList.toggle('sb-collapsed', c);
  try{ localStorage.setItem('dp_sb_collapsed', c?'1':'0'); }catch(e){}
}
document.addEventListener('DOMContentLoaded', applySBCollapse);
function toggleSB(){ $('sidebar').classList.toggle('open'); $('sbOverlay').classList.toggle('active'); }
function closeSB(){ $('sidebar').classList.remove('open'); $('sbOverlay').classList.remove('active'); }

function updateBadges(){
  const n=DB.orders.filter(ddIsNew).length;
  const sb=$('sbBadge'); if(sb){sb.style.display=n>0?'inline-block':'none';sb.textContent=n>9?'9+':n;}
  const bd=$('bnDot'); if(bd) bd.classList.toggle('show',n>0);
  updateBtmBadge();
  updateKhuonBadge();
}

function updateBtmBadge(){
  const n = (DB.baoTri||[]).filter(r=>r.status==='dang_sua').length;
  const b = $('sbBtmBadge');
  if(b){ b.style.display = n>0?'inline-block':'none'; b.textContent = n>9?'9+':n; }
}

// Badge số lượng khuôn sắp hết/hết hàng (số lượng <=1) — nhắc Admin bổ sung khuôn
function updateKhuonBadge(){
  const n = (DB.khuonQty||[]).filter(r=>Number(r.qty)<=1).length;
  const b = $('sbKhuonBadge');
  if(b){ b.style.display = n>0?'inline-block':'none'; b.textContent = n>9?'9+':n; }
}
