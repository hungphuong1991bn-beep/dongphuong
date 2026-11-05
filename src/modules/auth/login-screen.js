// src/modules/auth/login-screen.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<div id="loginScreen" class="screen active">
  <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:24px">
    <div class="login-card" id="loginCard">
      <div class="lc-logo">
        <img id="lcLogoImg" src="" alt="Logo Đông Phương">
        <h1>Đông Phương</h1>
        <p>Hệ thống quản lý sản xuất thanh cái</p>
      </div>
      <div id="loginErr" class="login-err"></div>
      <div class="field">
        <div class="field-lbl">Tài khoản đăng nhập</div>
        <input id="lu" class="field-inp" type="text" placeholder="Tên đăng nhập" autocomplete="username">
      </div>
      <div class="field">
        <div class="field-lbl">Mật khẩu</div>
        <input id="lp" class="field-inp" type="password" placeholder="••••••••" autocomplete="current-password">
      </div>
      <button class="login-btn" id="loginBtn" onclick="doLogin()">Đăng nhập →</button>
      <div class="login-credit">
        <p>PHÁT TRIỂN BỞI</p>
        <b>Vũ Thái Hùng</b>
        <p style="margin-top:2px;font-size:11px;color:var(--text4)">Bộ phận Thanh Cái · Đông Phương</p>
      </div>
    </div>
  </div>
</div>`);
