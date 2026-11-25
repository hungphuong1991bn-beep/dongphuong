// src/components/shared/ProgressModal.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- Progress Modal -->
<div class="modal" id="progressModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title" id="progressModalTitle">Cập nhật tiến độ</div>
    <div id="progressErr" class="modal-err"></div>
    <div class="field">
      <div class="field-lbl">Số thanh đã chạy</div>
      <input id="pmDoneQty" class="field-inp" type="number" min="0" placeholder="0">
      <div style="font-size:11.5px;color:var(--text3);margin-top:4px" id="pmQtyHint"></div>
    </div>
    <div class="field">
      <div class="field-lbl">Mã nguyên liệu đầu vào</div>
      <div style="display:flex;gap:8px">
        <input id="pmMatCode" class="field-inp" placeholder="VD: NL-001, Cuộn A3..." style="flex:1">
        <button onclick="pmAddMat()" style="padding:0 14px;border-radius:var(--r-sm);border:none;background:var(--brand);color:#fff;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">+ Thêm</button>
      </div>
      <div id="pmMatList" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px"></div>
    </div>
    <div class="field">
      <div class="field-lbl">Ghi chú tiến độ</div>
      <input id="pmNote" class="field-inp" placeholder="VD: Đã cắt xong lô 1...">
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('progressModal')">Huỷ</button>
      <button class="btn btn-primary" onclick="saveProgress()">💾 Lưu tiến độ</button>
    </div>
  </div>
</div>`);
