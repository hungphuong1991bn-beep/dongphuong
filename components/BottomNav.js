// src/components/BottomNav.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`    <nav class="bottom-nav" id="bottomNav">
      <button class="bn" id="bn-dashboard" onclick="goTab('dashboard')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        Home
      </button>
      <button class="bn" id="bn-dorDang" onclick="goTab('dorDang')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        Đơn Hàng
        <span class="bn-dot" id="bnDot"></span>
      </button>
      <button class="bn" id="bn-keHoach" onclick="goTab('keHoach')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
        Kế hoạch
      </button>
      <button class="bn" id="bn-dieuHanh" onclick="goTab('dieuHanh')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="13" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        Điều hành
      </button>
      <button class="bn" id="bn-hoanThanh" onclick="goTab('hoanThanh')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Đơn hoàn thành
      </button>
      <button class="bn" id="bn-baoCao" onclick="goTab('baoCao')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        Báo cáo
      </button>
      <!-- Tab "Khách hàng" chỉ dành riêng cho Admin (đồng bộ đúng logic với
           .sb-item#sbi-khachHang trong sidebar) — mặc định ẩn, được bật ở
           updateTopbarProfile() nếu isAdmin(). -->
      <button class="bn" id="bn-khachHang" onclick="goTab('khachHang')" style="display:none">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path stroke-linecap="round" stroke-linejoin="round" d="M23 21v-3.5a3.5 3.5 0 00-2.5-3.36M16 3.6a3.5 3.5 0 010 6.8"/></svg>
        Khách hàng
      </button>
      <button class="bn" id="bn-qrCode" onclick="goTab('qrCode')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="21"/><line x1="21" y1="14" x2="21" y2="21"/><line x1="14" y1="17.5" x2="21" y2="17.5"/></svg>
        Mã QR
      </button>
      <button class="bn" id="bn-nhanSu" onclick="goTab('nhanSu')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        Nhân sự
      </button>
      <button class="bn" id="bn-chamCong" onclick="goTab('chamCong')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke-linecap="round"/><path d="M9 16l1.5 1.5L15 13" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Chấm công
      </button>
      <button class="bn" id="bn-nhatKy" onclick="goTab('nhatKy')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Nhật ký
        <span class="bn-dot" id="bnLog" style="background:var(--red-m)"></span>
      </button>
      <button class="bn" id="bn-settings" onclick="goTab('settings')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        Tài khoản
        <span class="bn-dot" id="bnVerDot"></span>
      </button>
    </nav>`);
