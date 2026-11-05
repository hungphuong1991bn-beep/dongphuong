// src/modules/qr/qr-modals.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- ═══════ MODULE QR: các modal ═══════ -->

<!-- Modal: tạo hàng loạt mã QR khi đơn hàng hoàn thành -->
<div class="modal" id="qrGenModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title">🏷 Tạo mã QR thành phẩm</div>
    <div id="qrGenErr" class="modal-err"></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px" id="qrGenOrderInfo"></div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl" id="qgQtyLabelTxt">Tổng số thanh của đơn</div><input id="qgQty" class="field-inp" type="number" min="1" oninput="updateQrGenPreview()"></div>
      <div class="field"><div class="field-lbl" id="qgGroupLabelTxt">Số thanh gộp / 1 mã QR</div><input id="qgGroupSize" class="field-inp" type="number" min="1" oninput="updateQrGenPreview()"></div>
    </div>
    <div class="field"><div class="field-lbl">Số tem in / 1 mã QR</div><input id="qgLabelsPerCode" class="field-inp" type="number" min="1" value="2" oninput="updateQrGenPreview()"></div>
    <div style="font-size:12px;color:var(--brand);font-weight:700;margin-bottom:8px" id="qrGenPreview"></div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Mác đồng</div>
        <select id="qgGrade" class="field-inp">
          <option value="C1100">C1100</option><option value="C1020">C1020</option>
          <option value="C1011">C1011</option><option value="Khác">Khác</option>
        </select>
      </div>
      <div class="field"><div class="field-lbl">Máy sản xuất</div><input id="qgMachine" class="field-inp" placeholder="VD: Máy đùn 01"></div>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Ca sản xuất</div>
        <select id="qgShift" class="field-inp"><option value="Ca 1">Ca 1</option><option value="Ca 2">Ca 2</option><option value="Ca 3">Ca 3</option></select>
      </div>
      <div class="field"><div class="field-lbl">Người sản xuất</div><input id="qgProducer" class="field-inp" placeholder="Tên người sản xuất"></div>
    </div>
    <div class="field"><div class="field-lbl">Người vận hành</div><input id="qgOperator" class="field-inp" placeholder="Tên người vận hành"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('qrGenModal')">Bỏ qua</button>
      <button class="btn btn-primary" onclick="confirmGenQr()">🏷 Tạo mã QR</button>
    </div>
  </div>
</div>

<!-- Modal: mã QR công khai xem Chấm công + Lịch làm việc (người lao động quét
     bằng camera điện thoại thường, không cần cài app / đăng nhập) -->
<div class="modal" id="ccllvQrModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title">🏷 Mã QR xem Chấm công &amp; Lịch làm việc</div>
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:12px">
      In hoặc dán mã này ở bảng tin, xưởng sản xuất… Người lao động chỉ cần dùng camera điện thoại quét là xem được toàn bộ <b>lịch làm việc</b> và <b>bảng chấm công</b> mới nhất — không cần cài app, không cần đăng nhập.
    </div>
    <div style="display:flex;justify-content:center;padding:10px 0">
      <div id="ccllvQrCanvasWrap" style="background:#fff;padding:12px;border-radius:12px;box-shadow:var(--sh)">
        <span style="font-size:12px;color:var(--text4)">Đang tạo mã QR…</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;background:var(--bg2);border-radius:10px;padding:8px 10px;margin-bottom:10px">
      <span style="font-size:11.5px;color:var(--text3);word-break:break-all;flex:1" id="ccllvQrLinkTxt"></span>
    </div>
    <div id="ccllvQrWarn" style="display:none;font-size:11.5px;color:var(--red-m);margin-bottom:10px">⚠️ Chưa bật Firebase Sync (Cài đặt ▸ Cấu hình Firebase Sync) — mã QR sẽ KHÔNG xem được từ điện thoại khác cho tới khi bật đồng bộ.</div>
    <div id="ccllvQrStats" style="display:flex;gap:8px;margin-bottom:10px"></div>
    <div class="modal-footer" style="flex-wrap:wrap">
      <button class="btn btn-ghost" onclick="closeModal('ccllvQrModal')">Đóng</button>
      <button class="btn btn-ghost" onclick="copyCcllvLink()">🔗 Sao chép liên kết</button>
      <button class="btn btn-primary" onclick="downloadCcllvQr()">⬇️ Tải ảnh mã QR</button>
    </div>
  </div>
</div>

<!-- Modal: mã QR công khai TỔNG HỢP KHUÔN (khách hàng & mọi người quét bằng
     camera điện thoại thường, không cần cài app / đăng nhập, xem được toàn
     bộ danh mục khuôn + số lượng khuôn tồn kho, cập nhật trực tiếp) -->
<div class="modal" id="khuonQrModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title">🏷 Mã QR tổng hợp Khuôn</div>
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:12px">
      In hoặc dán mã này ở khu vực xưởng khuôn, kho khuôn… Khách hàng và mọi người chỉ cần dùng camera điện thoại quét là xem được toàn bộ <b>danh mục kích thước khuôn</b> và <b>số lượng khuôn tồn kho</b> mới nhất — không cần cài app, không cần đăng nhập.
    </div>
    <div style="display:flex;justify-content:center;padding:10px 0">
      <div id="khuonQrCanvasWrap" style="background:#fff;padding:12px;border-radius:12px;box-shadow:var(--sh)">
        <span style="font-size:12px;color:var(--text4)">Đang tạo mã QR…</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;background:var(--bg2);border-radius:10px;padding:8px 10px;margin-bottom:10px">
      <span style="font-size:11.5px;color:var(--text3);word-break:break-all;flex:1" id="khuonQrLinkTxt"></span>
    </div>
    <div id="khuonQrWarn" style="display:none;font-size:11.5px;color:var(--red-m);margin-bottom:10px">⚠️ Chưa bật Firebase Sync (Cài đặt ▸ Cấu hình Firebase Sync) — mã QR sẽ KHÔNG xem được từ điện thoại khác cho tới khi bật đồng bộ.</div>
    <div id="khuonQrStats" style="display:flex;gap:8px;margin-bottom:10px"></div>
    <div class="modal-footer" style="flex-wrap:wrap">
      <button class="btn btn-ghost" onclick="closeModal('khuonQrModal')">Đóng</button>
      <button class="btn btn-ghost" onclick="copyKhuonLink()">🔗 Sao chép liên kết</button>
      <button class="btn btn-primary" onclick="downloadKhuonQr()">⬇️ Tải ảnh mã QR</button>
    </div>
  </div>
</div>

<!-- Modal: Mã QR công khai Danh sách nhân sự -->
<div class="modal" id="nhanSuQrModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title">🏷 Mã QR danh sách nhân sự</div>
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:12px">
      In hoặc dán mã này ở bảng tin, xưởng sản xuất… Mọi người chỉ cần dùng camera điện thoại quét là xem được <b>danh sách nhân viên</b> (họ tên, mã NV, chức vụ, bộ phận, trạng thái) và <b>tình hình nghỉ phép</b> — không cần cài app, không cần đăng nhập. Bấm vào từng nhân viên trên trang công khai sẽ hiện <b>toàn bộ hồ sơ</b> (gồm SĐT, CCCD, lương, tài khoản ngân hàng, nghỉ phép, kỷ luật) — ai có link/mã QR đều xem được, hãy chỉ dán ở nơi tin cậy.
    </div>
    <div style="display:flex;justify-content:center;padding:10px 0">
      <div id="nhanSuQrCanvasWrap" style="background:#fff;padding:12px;border-radius:12px;box-shadow:var(--sh)">
        <span style="font-size:12px;color:var(--text4)">Đang tạo mã QR…</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;background:var(--bg2);border-radius:10px;padding:8px 10px;margin-bottom:10px">
      <span style="font-size:11.5px;color:var(--text3);word-break:break-all;flex:1" id="nhanSuQrLinkTxt"></span>
    </div>
    <div id="nhanSuQrWarn" style="display:none;font-size:11.5px;color:var(--red-m);margin-bottom:10px">⚠️ Chưa bật Firebase Sync (Cài đặt ▸ Cấu hình Firebase Sync) — mã QR sẽ KHÔNG xem được từ điện thoại khác cho tới khi bật đồng bộ.</div>
    <div id="nhanSuQrStats" style="display:flex;gap:8px;margin-bottom:10px"></div>
    <div class="modal-footer" style="flex-wrap:wrap">
      <button class="btn btn-ghost" onclick="closeModal('nhanSuQrModal')">Đóng</button>
      <button class="btn btn-ghost" onclick="copyNhanSuLink()">🔗 Sao chép liên kết</button>
      <button class="btn btn-primary" onclick="downloadNhanSuQr()">⬇️ Tải ảnh mã QR</button>
    </div>
  </div>
</div>

<!-- Modal: chi tiết 1 mã QR (kết quả quét / xem trong danh sách) -->
<div class="modal" id="qrDetailModal">
  <div class="modal-box" style="max-height:88vh;overflow-y:auto">
    <div class="modal-handle"></div>
    <div class="modal-title" id="qrDetailTitle">Chi tiết thành phẩm</div>
    <div id="qrDetailBody"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('qrDetailModal')">Đóng</button>
      <button class="btn btn-primary" id="qrDetailPrintBtn" onclick="openPrintModal(_qrDetailId)">🖨 In tem</button>
    </div>
  </div>
</div>


<!-- Modal: in tem QR -->
<div class="modal" id="qrPrintModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title">🖨 In tem QR</div>
    <div class="field-lbl" style="margin-bottom:6px">Kích cỡ tem</div>
    <div class="qr-print-size" id="qrPrintSizeRow">
      <div class="qr-print-opt active" data-size="40x30" onclick="selectPrintSize('40x30')">40×30 mm</div>
      <div class="qr-print-opt" data-size="50x30" onclick="selectPrintSize('50x30')">50×30 mm</div>
      <div class="qr-print-opt" data-size="70x50" onclick="selectPrintSize('70x50')">70×50 mm</div>
      <div class="qr-print-opt" data-size="a4" onclick="selectPrintSize('a4')">A4 nhiều tem</div>
    </div>
    <div id="qrPrintCountWrap" style="display:none" class="field"><div class="field-lbl">Số lượng tem trên trang A4</div><input id="qpCount" class="field-inp" type="number" min="1" value="24"></div>
    <div id="qrPrintPerCodeWrap" class="field"><div class="field-lbl">Số tem in / mỗi mã QR</div><input id="qpLabelsPerCode" class="field-inp" type="number" min="1" value="2"></div>
    <div class="qr-label-preview">
      <div id="qrPrintCanvasWrap" style="width:70px;height:70px;display:flex;align-items:center;justify-content:center;background:#f1f5f9;border-radius:6px">QR</div>
      <div style="font-size:11px;color:var(--text3);line-height:1.5">Tem gồm: Logo Đông Phương, mã QR, mã sản phẩm, quy cách, khách hàng, chiều dài, số lượng, ngày sản xuất</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('qrPrintModal')">Huỷ</button>
      <button class="btn btn-primary" onclick="generateLabelPDF()">⬇️ Xuất PDF & In</button>
    </div>
  </div>
</div>`);
