// src/modules/orders/orders-modal.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- MODALS -->
<!-- Order Modal -->
<div class="modal" id="orderModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title" id="orderModalTitle">Thêm đơn hàng</div>
    <div id="orderErr" class="modal-err"></div>
    <div class="field">
      <div class="field-lbl">Khách hàng *</div>
      <div class="combo-wrap">
        <input id="ofCust" class="field-inp" placeholder="Tên khách hàng" autocomplete="off" oninput="renderComboList('ofCust', getCustomerHistory(), this.value)" onfocus="renderComboList('ofCust', getCustomerHistory(), this.value)">
        <button type="button" class="combo-arrow" id="ofCustArrow" onclick="toggleComboList('ofCust', getCustomerHistory())" title="Xem tên khách hàng đã lưu">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="combo-list" id="ofCustList"></div>
      </div>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Mã PO</div><input id="ofPO" class="field-inp" placeholder="PO number"></div>
      <div class="field"><div class="field-lbl">Độ ưu tiên</div>
        <select id="ofPri" class="field-inp">
          <option value="GẤP 1">GẤP 1</option><option value="GẤP 2">GẤP 2</option><option value="GẤP 3">GẤP 3</option>
          <option value="GẤP 4">GẤP 4</option><option value="GẤP 5">GẤP 5</option><option value="GẤP 6">GẤP 6</option>
          <option value="GẤP 7">GẤP 7</option><option value="GẤP 8">GẤP 8</option>
        </select>
      </div>
    </div>
    <div class="field">
      <div class="field-lbl">Nguyên liệu</div>
      <select id="ofMat" class="field-inp">
        <option value="A">A (đồng tấm)</option>
        <option value="B*" selected>B* (onsan)</option>
        <option value="B">B</option>
        <option value="Khác">Khác</option>
      </select>
    </div>
    <!-- Φ: thanh tròn -->
    <div class="field">
      <div class="field-lbl" style="display:flex;align-items:center;gap:6px">
        <span style="font-size:15px;font-weight:800;color:#b45309">Φ</span> Đường kính (mm)
        <span style="font-size:10px;color:var(--text4);font-weight:400">— Chỉ nhập cho thanh tròn</span>
      </div>
      <input id="ofPhi" class="field-inp" type="number" step="0.1" placeholder="VD: 6, 8, 10... (để trống nếu thanh dẹt)" oninput="calcKgAuto()">
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Dày (mm) <span style="font-size:10px;color:var(--text4)">bỏ qua nếu nhập Φ · ghi được 6/10, 6-10, 3.71/9.71</span></div><input id="ofThk" class="field-inp" type="text" inputmode="decimal" autocomplete="off" placeholder="VD: 6 hoặc 6/10" oninput="calcKgAuto()"></div>
      <div class="field"><div class="field-lbl">Rộng (mm) <span style="font-size:10px;color:var(--text4)">bỏ qua nếu nhập Φ · ghi được 6/10, 6-10, 3.71/9.71</span></div><input id="ofW" class="field-inp" type="text" inputmode="decimal" autocomplete="off" placeholder="VD: 20 hoặc 3.71/9.71" oninput="calcKgAuto()"></div>
    </div>
    <!-- Bo cạnh: R tự động = Dày/2 (readonly), hiển thị diện tích tiết diện thực tế A và KG -->
    <div id="ofBcPanel" style="display:none;background:#fff7ed;border:1.5px solid #fdba74;border-radius:10px;padding:10px 12px;margin-bottom:14px">
      <div style="font-size:12px;font-weight:800;color:#9a3412;margin-bottom:8px">⭕ Chế độ Bo cạnh — R tự động = Dày ÷ 2</div>
      <div class="modal-row">
        <div class="field" style="margin-bottom:8px"><div class="field-lbl">Dày T (mm)</div><input id="ofBcT" class="field-inp" readonly tabindex="-1" style="background:var(--bg2);cursor:not-allowed" placeholder="—"></div>
        <div class="field" style="margin-bottom:8px"><div class="field-lbl">Rộng W (mm)</div><input id="ofBcW" class="field-inp" readonly tabindex="-1" style="background:var(--bg2);cursor:not-allowed" placeholder="—"></div>
      </div>
      <div class="modal-row">
        <div class="field" style="margin-bottom:8px"><div class="field-lbl">R tự động (mm)</div><input id="ofR" class="field-inp" readonly tabindex="-1" style="background:var(--bg2);cursor:not-allowed;font-weight:700" placeholder="—"></div>
        <div class="field" style="margin-bottom:8px"><div class="field-lbl">Diện tích thực tế A (mm²)</div><input id="ofA" class="field-inp" readonly tabindex="-1" style="background:var(--bg2);cursor:not-allowed;font-weight:700" placeholder="—"></div>
      </div>
      <div id="ofBcSummary" style="font-size:11.5px;color:#7c2d12;line-height:1.55"></div>
      <div id="ofBcWarn" style="display:none;font-size:11.5px;font-weight:700;color:var(--red-m,#dc2626);margin-top:4px"></div>
    </div>
    <!-- Toggle: Đơn hàng dạng cuộn (dây/băng đồng cuốn thành cuộn thay vì cắt thanh) -->
    <div class="field" style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
      <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:8px">
        <span style="font-size:13px;font-weight:700;color:var(--text2)">📀 Đơn hàng dạng cuộn (dây/băng cuốn cuộn)</span>
        <input id="ofIsCoil" type="checkbox" style="width:20px;height:20px;flex-shrink:0" onchange="toggleCoilMode()">
      </label>
      <div id="ofCoilExample" style="display:none;font-size:10.5px;color:var(--text4);margin-top:6px;line-height:1.5">
        VD: 2×12mm × cuộn = <b>15 cuộn</b>, mỗi cuộn <b>100m</b> → tổng <b>1.500m</b>
      </div>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl" id="ofLLabelTxt">Dài (mm)</div><input id="ofL" class="field-inp" type="number" placeholder="4000" value="4000" oninput="calcKgAuto()"></div>
      <div class="field"><div class="field-lbl" id="ofQtyLabelTxt">Số cây / Số thanh</div><input id="ofQty" class="field-inp" type="number" placeholder="0" oninput="calcKgAuto()"></div>
    </div>
    <div id="ofCoilInfo" style="display:none;font-size:11.5px;font-weight:700;color:#075985;background:#e0f2fe;border:1px solid #7dd3fc;border-radius:8px;padding:6px 10px;margin:-6px 0 10px"></div>
    <div class="modal-row">
      <div class="field">
        <div class="field-lbl">KG <span id="kgAutoLabel" style="font-size:10px;color:var(--green-m);font-weight:600"></span></div>
        <input id="ofKg" class="field-inp" type="number" step="0.01" placeholder="Tự tính">
      </div>
      <div class="field"><div class="field-lbl">Hạn giao</div><input id="ofDate" class="field-inp" type="date"></div>
    </div>
    <div class="field">
      <div class="field-lbl">Loại / Quy cách</div>
      <div class="combo-wrap">
        <input id="ofType" class="field-inp" placeholder="VD: Thanh dẹt, Lục giác..." autocomplete="off" oninput="renderComboList('ofType', getQuyCachHistory(), this.value); calcKgAuto()" onfocus="renderComboList('ofType', getQuyCachHistory(), this.value)">
        <button type="button" class="combo-arrow" id="ofTypeArrow" onclick="toggleComboList('ofType', getQuyCachHistory())" title="Chọn nhanh: Bo cạnh, Loại đặc biệt...">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="combo-list" id="ofTypeList"></div>
      </div>
    </div>
    <div class="field"><div class="field-lbl">Địa chỉ giao</div><input id="ofAddr" class="field-inp" placeholder=""></div>
    <div class="field"><div class="field-lbl">Ghi chú</div><input id="ofNote" class="field-inp" placeholder=""></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('orderModal')">Huỷ</button>
      <button class="btn btn-primary" id="ofSaveBtn" onclick="saveOrder()">💾 Lưu đơn hàng</button>
    </div>
  </div>
</div>`);
