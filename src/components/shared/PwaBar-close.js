// src/components/shared/PwaBar-close.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`  <div style="flex:1"><div style="font-size:13px;font-weight:700">Cài đặt ứng dụng</div><div style="font-size:11.5px;color:#94a3b8;margin-top:1px">Hoạt động offline, nhanh hơn</div></div>
  <button onclick="installPWA()" style="background:var(--brand);color:#fff;border:none;border-radius:8px;padding:8px 13px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">Cài</button>
  <button onclick="document.getElementById('pwaBar').style.display='none'" style="border:none;background:none;color:#64748b;font-size:20px;cursor:pointer;padding:2px 4px">✕</button>
</div>`);
