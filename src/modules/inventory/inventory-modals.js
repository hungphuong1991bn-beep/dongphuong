// src/modules/inventory/inventory-modals.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- 📊 Số liệu — Thêm/Sửa Sổ nguyên liệu -->
<div class="modal" id="nlModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title" id="nlModalTitle">Thêm dòng Sổ nguyên liệu</div>
    <div id="nlErr" class="modal-err"></div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Ngày *</div><input id="nlNgay" type="date" class="field-inp"></div>
      <div class="field"><div class="field-lbl">Nguyên liệu</div><input id="nlNguyenLieu" class="field-inp" placeholder="VD: Fi20B (để trống nếu chỉ ghi Phế/Phoi)"></div>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Mã cuộn / Heat-Lot</div><input id="nlHeatLot" class="field-inp" placeholder="VD: B190225102"></div>
      <div class="field"><div class="field-lbl">Độ dẫn điện</div><input id="nlDoDanDien" class="field-inp" type="text" inputmode="decimal" placeholder="VD: 96.2 - 98.5"></div>
    </div>
    <div class="field"><div class="field-lbl">Số lượng (kg)</div><input id="nlSoLuong" class="field-inp" type="number" step="0.01" placeholder="VD: 2502"></div>
    <div class="field">
      <div class="field-lbl">Loại thành phẩm chạy <span style="font-weight:400;color:var(--text4)">(nhiều loại trên cùng 1 cuộn)</span></div>
      <div class="nl-multi-list" id="nlTPList"></div>
      <button type="button" class="nl-multi-add" onclick="nlTPAdd()">+ Thêm loại thành phẩm khác</button>
    </div>
    <div class="field"><div class="field-lbl">Số mét chạy</div><input id="nlSoMet" class="field-inp" placeholder="VD: 200m"></div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Khu máy 🏭</div>
        <select id="nlKhuMay" class="field-inp" onchange="nlOnKhuMayChange()"></select>
      </div>
      <div class="field"><div class="field-lbl">Máy <span style="font-weight:400;color:var(--text4)">(nhớ khu máy)</span></div>
        <select id="nlMay" class="field-inp" onchange="nlOnMayChange()"></select>
      </div>
    </div>
    <div class="field">
      <div class="field-lbl">Phế và đầu mẩu (kg) <span class="nl-multi-total" id="nlPheTotal">0 kg</span></div>
      <div class="nl-multi-list" id="nlPheList"></div>
      <button type="button" class="nl-multi-add" onclick="nlMultiAdd('phe')">+ Thêm mã phế/đầu mẩu khác</button>
    </div>
    <div class="field">
      <div class="field-lbl">Phoi (kg) <span class="nl-multi-total" id="nlPhoiTotal">0 kg</span></div>
      <div class="nl-multi-list" id="nlPhoiList"></div>
      <button type="button" class="nl-multi-add" onclick="nlMultiAdd('phoi')">+ Thêm mã phoi khác</button>
    </div>
    <div class="field"><div class="field-lbl">Khách hàng (tuỳ chọn)</div>
      <input id="nlDonHang" class="field-inp" list="nlKhachHangList" placeholder="Gõ tên khách hàng...">
      <datalist id="nlKhachHangList"></datalist>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">PO</div><input id="nlPO" class="field-inp"></div>
      <div class="field"><div class="field-lbl">WO</div><input id="nlWO" class="field-inp"></div>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Đơn hàng (liên kết truy xuất)</div><select id="nlDonHangId" class="field-inp"></select></div>
      <div class="field"><div class="field-lbl">Mã lô sản xuất</div><input id="nlMaLoSX" class="field-inp" placeholder="Tuỳ chọn"></div>
    </div>
    <div class="field"><div class="field-lbl">Ghi chú</div><input id="nlGhiChu" class="field-inp"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('nlModal')">Huỷ</button>
      <button class="btn btn-primary" onclick="nlSave()">💾 Lưu</button>
    </div>
  </div>
</div>

<!-- 📊 Số liệu — Thêm/Sửa Sổ máy Rút / Sổ máy Đánh bóng + Cắt (dùng chung form) -->
<div class="modal" id="mcModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title" id="mcModalTitle">Thêm dòng Sổ máy</div>
    <div id="mcErr" class="modal-err"></div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Ngày *</div><input id="mcNgay" type="date" class="field-inp"></div>
      <div class="field"><div class="field-lbl">Quy cách *</div><input id="mcQuyCach" class="field-inp" placeholder="VD: Φ18×6000 hoặc 10x100"></div>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Loại NL</div>
        <input id="mcLoaiNL" class="field-inp" list="mcLoaiNLList" placeholder="VD: Fi20B">
        <datalist id="mcLoaiNLList"></datalist>
      </div>
      <div class="field"><div class="field-lbl">Hàng</div>
        <select id="mcHang" class="field-inp">
          <option value="Bo cạnh">Bo cạnh</option>
          <option value="Đặc biệt">Đặc biệt</option>
          <option value="Dẹt">Dẹt</option>
        </select>
      </div>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Số thanh *</div><input id="mcSoThanh" class="field-inp" type="number"></div>
      <div class="field"><div class="field-lbl">Công đoạn</div>
        <select id="mcCongDoan" class="field-inp" onchange="mcOnCongDoanChange()"></select>
      </div>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Máy 🏭 <span style="font-weight:400;color:var(--text4)">(nhớ khu máy)</span></div>
        <select id="mcMay" class="field-inp" onchange="mcOnMayChange()"></select>
      </div>
      <div class="field"><div class="field-lbl">Ca SX</div>
        <select id="mcCa" class="field-inp"><option value="">—</option><option value="1">Ca 1</option><option value="2">Ca 2</option><option value="3">Ca 3</option></select>
      </div>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Người SX *</div><input id="mcNguoiSX" class="field-inp"></div>
      <div class="field"></div>
    </div>
    <div class="field"><div class="field-lbl">Khách hàng</div>
      <input id="mcKhachHang" class="field-inp" list="mcKhachHangList" placeholder="Chọn hoặc gõ tên khách hàng...">
      <datalist id="mcKhachHangList"></datalist>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Đơn hàng (liên kết truy xuất)</div><select id="mcDonHangId" class="field-inp"></select></div>
      <div class="field"><div class="field-lbl">Mã lô sản xuất</div><input id="mcMaLoSX" class="field-inp" placeholder="Tuỳ chọn"></div>
    </div>
    <div class="field"><div class="field-lbl">Mã lô nguyên liệu / Heat-Lot nguồn</div><input id="mcHeatLot" class="field-inp" placeholder="Tuỳ chọn — để liên kết ngược về Sổ nguyên liệu"></div>
    <div class="field"><div class="field-lbl">Ghi chú</div><input id="mcGhiChu" class="field-inp"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('mcModal')">Huỷ</button>
      <button class="btn btn-primary" onclick="mcSave()">💾 Lưu</button>
    </div>
  </div>
</div>

<!-- 📊 Số liệu — Chi tiết 1 dòng (bấm vào dòng trong bảng) — xem ĐẦY ĐỦ toàn
     bộ thông tin (kể cả các trường bị ẩn/rút gọn trên bảng), có thể Sửa
     hoặc Xoá ngay tại đây. -->
<div class="modal kh-drawer" id="slDetailModal" onclick="if(event.target===this)closeModal('slDetailModal');">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title" id="slDetailTitle">Chi tiết dòng dữ liệu</div>
    <div id="slDetailBody" style="font-size:13px;color:var(--text2);line-height:1.6"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('slDetailModal')">Đóng</button>
      <button class="btn danger" id="slDetailDeleteBtn" style="background:var(--red-l);color:var(--red-m);border:1px solid var(--red-m)" onclick="">🗑️ Xoá</button>
      <button class="btn" style="background:var(--brand);color:#fff;flex:1" id="slDetailEditBtn" onclick="">✏️ Sửa</button>
    </div>
  </div>
</div>`);
