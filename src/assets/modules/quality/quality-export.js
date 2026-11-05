// src/modules/quality/quality-export.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Xuất Excel (CSV) đúng danh sách đang lọc/hiển thị ở tab Đơn hoàn thành
// ════════════════════════════════════════════════════════════════════
// XUẤT EXCEL CHUYÊN NGHIỆP — Tab Đơn hoàn thành: dùng chung khung xuất
// Excel chuyên nghiệp (exportProfessionalExcel) như tab Đơn hàng và 3 sổ
// Số liệu — xem ghi chú chi tiết ở ddExportExcel() phía trên.
// ════════════════════════════════════════════════════════════════════
async function htExportExcel(){
  const ids = _htVisibleIds||[];
  if(!ids.length){ showToast && showToast('Không có đơn thành phẩm để xuất'); return; }
  const rows = ids.map(id=>DB.orders.find(o=>o.id===id)).filter(Boolean);
  const now = new Date(); const pad=n=>String(n).padStart(2,'0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
  const sorted = rows.slice().sort((a,b)=> (b.doneAt||0)-(a.doneAt||0));
  const data = sorted.map((o,i)=>{
    const st = htStage(o);
    const dur = (o.startedAt&&o.doneAt) ? fmtDuration(o.doneAt-o.startedAt) : '';
    return {
      stt: i+1, code: htCode(o), customer: o.customer||'', po: o.po||'',
      type: o.type||'', material: ddMaterialLabel(o.material), spec: specStr(o),
      qty: qtyLabel(o), kg: o.kg||'', createdAt: o.createdAt,
      doneAtText: o.doneAt?fmtDateTime(o.doneAt):'', duration: dur,
      status: st.label, confirmedBy: htConfirmedBy(o), note: o.note||''
    };
  });
  // Chốt đúng tập ID các đơn đang thực sự được đưa vào file lần này — dùng
  // để, SAU KHI file đã tải về thành công, hỏi có muốn xoá vĩnh viễn đúng
  // các đơn này hay không, để lần xuất kế tiếp không bị lặp lại các đơn đã
  // xuất trước đó (xem htConfirmClearAfterExport bên dưới).
  const exportedIds = sorted.map(o=>o.id);
  await exportProfessionalExcel({
    docTitle: 'SỔ THEO DÕI ĐƠN HÀNG HOÀN THÀNH', docCode: 'TC-05', sheetName: 'HoanThanh',
    columns:[
      {header:'STT', key:'stt', width:6, numFmt:'num'},
      {header:'Mã đơn / PO', key:'code', width:14},
      {header:'Khách hàng', key:'customer', width:18},
      {header:'Loại', key:'type', width:12},
      {header:'Nguyên liệu', key:'material', width:16},
      {header:'Quy cách', key:'spec', width:16},
      {header:'Số lượng', key:'qty', width:16},
      {header:'KL (kg)', key:'kg', width:10, numFmt:'num'},
      {header:'Ngày đặt', key:'createdAt', width:12, numFmt:'date'},
      {header:'Hoàn thành lúc', key:'doneAtText', width:16},
      {header:'Thời gian SX', key:'duration', width:12},
      {header:'Trạng thái', key:'status', width:14},
      {header:'Xác nhận bởi', key:'confirmedBy', width:16},
      {header:'Ghi chú', key:'note', width:22}
    ],
    rows: data,
    totalsCols:['kg'],
    filename:`Don_hoan_thanh_${stamp}.xlsx`,
    onExported: ()=> htConfirmClearAfterExport(exportedIds)
  });
}

// ════════════════════════════════════════════════════════════════════
// SAU KHI XUẤT EXCEL (tab "Đơn hoàn thành"): hỏi xác nhận rồi XOÁ VĨNH
// VIỄN đúng các đơn vừa được ghi vào file Excel đã tải về khỏi DB.orders
// — KHÔNG còn chuyển vào Thùng rác nữa (đã bỏ cơ chế soft-delete cho
// luồng này), để lần xuất Excel kế tiếp không lặp lại các đơn đã xuất
// trước đó nữa. Không thể khôi phục sau khi xoá — dữ liệu chỉ còn lại
// trong file Excel đã tải về. Chỉ admin (đúng quyền xoá đơn — xem
// canDel=isAdmin() ở htToggleMenu) mới được hỏi; các vai trò khác vẫn
// xuất Excel bình thường và không bị hỏi/không mất dữ liệu.
// ════════════════════════════════════════════════════════════════════
function htConfirmClearAfterExport(exportedIds){
  if(!isAdmin()) return; // không đủ quyền xoá đơn — giữ nguyên dữ liệu
  if(!exportedIds || !exportedIds.length) return;
  confirm2(
    '🗑️ Xoá vĩnh viễn đơn sau khi xuất?',
    `Đã xuất ${exportedIds.length} đơn ra file Excel — dữ liệu đã được lưu đầy đủ trong file vừa tải về. Bạn có muốn XOÁ VĨNH VIỄN các đơn này khỏi hệ thống để lần xuất sau không bị trùng lặp không? Không thể hoàn tác.`,
    ()=> htClearAfterExport(exportedIds)
  );
}
function htClearAfterExport(exportedIds){
  const idSet = new Set(exportedIds);
  const removed = DB.orders.filter(o=>o && idSet.has(o.id));
  if(!removed.length) return;
  DB.orders = DB.orders.filter(o=>!idSet.has(o.id));
  log('Xoá vĩnh viễn đơn hoàn thành sau khi xuất Excel',
    `${removed.length} đơn: ${removed.map(o=>o.customer||o.id).slice(0,10).join(', ')}${removed.length>10?'…':''}`,
    null, null, {ids:[...idSet], deletedBy:'AFTER_EXPORT_HT_PERMANENT'});
  saveOrders();
  if(currentTab==='hoanThanh') renderTab(currentTab);
  updateBadges();
  showToast(`🗑️ Đã xoá vĩnh viễn ${removed.length} đơn — không còn trùng lặp ở lần xuất sau`);
}
