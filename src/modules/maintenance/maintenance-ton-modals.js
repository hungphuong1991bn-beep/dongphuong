// src/modules/maintenance/maintenance-ton-modals.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- Ghi sản lượng (tấn) cho máy — dùng để AI tính hạn thay vành nước/dầu -->
<div class="modal" id="tonLogModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title">➕ Ghi sản lượng đã chạy</div>
    <div id="tonLogErr" class="modal-err"></div>
    <div class="field">
      <div class="field-lbl">Máy</div>
      <input id="tonLogMachineName" class="field-inp" readonly style="background:var(--bg);font-weight:700">
    </div>
    <div class="field">
      <div class="field-lbl">Linh kiện đang theo dõi</div>
      <div id="tonLogPartName" style="font-size:13.5px;font-weight:700;color:var(--amber-m)"></div>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Số tấn đã chạy thêm *</div><input id="tonLogAmount" class="field-inp" type="number" step="0.1" min="0" placeholder="VD: 5.5"></div>
      <div class="field"><div class="field-lbl">Ngày</div><input id="tonLogDate" class="field-inp" type="date"></div>
    </div>
    <div class="field"><div class="field-lbl">Ghi chú (nếu có)</div><input id="tonLogNote" class="field-inp" placeholder=""></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('tonLogModal')">Huỷ</button>
      <button class="btn btn-primary" onclick="tonLogSave()">💾 Lưu</button>
    </div>
  </div>
</div>

<!-- Xác nhận đã thay vành nước / dầu máy — reset bộ đếm tấn về 0 -->
<div class="modal" id="tonResetModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title">✅ Xác nhận đã thay linh kiện</div>
    <div class="field">
      <div class="field-lbl">Máy</div>
      <input id="tonResetMachineName" class="field-inp" readonly style="background:var(--bg);font-weight:700">
    </div>
    <div class="modal-row">
      <div class="field">
        <div class="field-lbl">Linh kiện</div>
        <div id="tonResetPartName" style="font-size:13.5px;font-weight:700;color:var(--green-m);padding:12px 0"></div>
      </div>
      <div class="field">
        <div class="field-lbl">Đã chạy được</div>
        <div id="tonResetCurrentTon" style="font-size:13.5px;font-weight:700;color:var(--red-m);padding:12px 0"></div>
      </div>
    </div>
    <div class="field"><div class="field-lbl">Ngày thay</div><input id="tonResetDate" class="field-inp" type="date"></div>
    <div class="field"><div class="field-lbl">Ghi chú (người thực hiện, lý do...)</div><input id="tonResetNote" class="field-inp" placeholder=""></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('tonResetModal')">Huỷ</button>
      <button class="btn btn-primary" style="background:var(--green-m)" onclick="tonResetSave()">✅ Xác nhận đã thay — reset về 0 tấn</button>
    </div>
  </div>
</div>

<!-- Cửa sổ cảnh báo AI bảo trì (nhỏ, hiện đại) — tự bật khi có máy sắp/đã đến hạn thay -->
<div class="modal" id="maintAlertModal">
  <div class="modal-box" style="max-width:420px">
    <div class="modal-handle"></div>
    <div class="modal-title" id="maintAlertTitle">⚠️ Cảnh báo bảo trì máy</div>
    <div id="maintAlertBody"></div>
    <div class="modal-footer">
      <button class="btn btn-primary" style="width:100%" onclick="closeModal('maintAlertModal')">Đã hiểu, đóng</button>
    </div>
  </div>
</div>`);
