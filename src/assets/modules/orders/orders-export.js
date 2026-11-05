// src/modules/orders/orders-export.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════════════
// XUẤT EXCEL CHUYÊN NGHIỆP — Tab Đơn hàng: dùng lại đúng khung xuất Excel
// (exportProfessionalExcel — xem định nghĩa gần tab 📊 Số liệu) đang áp
// dụng cho 3 sổ Số liệu: có tên công ty, tên sổ, mã hồ sơ, ngày/người
// xuất, header tô màu + viền, AutoFilter, Freeze Header, dòng TỔNG CỘNG,
// chữ ký Người lập/Người kiểm tra/QA, canh in khổ A4 ngang.
// Xuất đúng danh sách ĐANG HIỂN THỊ (đã áp bộ lọc/tìm kiếm hiện tại),
// giữ nguyên hành vi như trước — chỉ nâng cấp phần khung/định dạng.
// ════════════════════════════════════════════════════════════════════
async function ddExportExcel(){
  const ids = _ddVisibleIds||[];
  if(!ids.length){ showToast && showToast('Không có đơn hàng để xuất'); return; }
  const rows = ids.map(id=>DB.orders.find(o=>o.id===id)).filter(Boolean);
  const now = new Date(); const pad=n=>String(n).padStart(2,'0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
  const sorted = rows.slice().sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
  const data = sorted.map((o,i)=>{
    const meta = ddStatusMeta(o);
    const doneUnit = o.isCoil?'cuộn':(o.isRound?'cây':'thanh');
    return {
      stt: i+1, code: ddCode(o), customer: o.customer||'', po: o.po||'',
      type: o.type||'', material: ddMaterialLabel(o.material), spec: specStr(o),
      qty: qtyLabel(o), kg: o.kg||'', doneQty: `${o.doneQty||0} ${doneUnit}`,
      progress: ddProgressPct(o)+'%', createdAt: o.createdAt, deliveryDate: o.deliveryDate,
      priority: o.priority||'', status: meta.label, owner: ddOwner(o), note: o.note||''
    };
  });
  await exportProfessionalExcel({
    docTitle: 'SỔ THEO DÕI ĐƠN HÀNG SẢN XUẤT', docCode: 'TC-01', sheetName: 'DonHang',
    columns:[
      {header:'STT', key:'stt', width:6, numFmt:'num'},
      {header:'Mã đơn / PO', key:'code', width:14},
      {header:'Khách hàng', key:'customer', width:18},
      {header:'Loại', key:'type', width:12},
      {header:'Nguyên liệu', key:'material', width:16},
      {header:'Quy cách', key:'spec', width:16},
      {header:'Số lượng KH', key:'qty', width:16},
      {header:'KL (kg)', key:'kg', width:10, numFmt:'num'},
      {header:'Đã sản xuất', key:'doneQty', width:14},
      {header:'Tiến độ', key:'progress', width:10},
      {header:'Ngày đặt', key:'createdAt', width:12, numFmt:'date'},
      {header:'Hạn giao', key:'deliveryDate', width:12, numFmt:'date'},
      {header:'Ưu tiên', key:'priority', width:10},
      {header:'Trạng thái', key:'status', width:16},
      {header:'Người phụ trách', key:'owner', width:16},
      {header:'Ghi chú', key:'note', width:22}
    ],
    rows: data,
    totalsCols:['kg'],
    filename:`Don_hang_${stamp}.xlsx`
  });
}
