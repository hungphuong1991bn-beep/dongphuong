// src/modules/inventory/inventory-export.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════════════
// XUẤT EXCEL CHUYÊN NGHIỆP — dùng chung 1 hàm dựng khung cho cả 3 sổ:
// Sổ nguyên liệu, Sổ máy Rút, Sổ máy Đánh bóng.
// Khung gồm: tên công ty, tên sổ, mã hồ sơ, ngày xuất, người xuất, header
// đầy đủ có viền + tô màu, wrap text, độ rộng cột hợp lý, định dạng ngày
// dd/mm/yyyy, AutoFilter, Freeze Header, dòng tổng cộng, chữ ký Người lập/
// Người kiểm tra/QA, Print Area khổ A4 ngang, lặp dòng tiêu đề khi in.
// ════════════════════════════════════════════════════════════════════
async function exportProfessionalExcel(opts){
  // opts = {docTitle, docCode, sheetName, columns:[{header,key,width,numFmt}], rows, totalsCols:[key,...], filename}
  showToast('⏳ Đang tạo file Excel...', false);
  try{ await ensureExcelJs(); }
  catch(e){ showToast('❌ Không tải được thư viện xuất Excel — kiểm tra kết nối mạng rồi thử lại', true); return; }
  if(!window.ExcelJS){ showToast('⏳ Thư viện Excel chưa tải xong, vui lòng thử lại sau vài giây', true); return; }

  try{
    const cols = opts.columns;
    const nCols = cols.length;
    const wb = new ExcelJS.Workbook();
    wb.creator = actorName();
    wb.created = new Date();
    const ws = wb.addWorksheet(opts.sheetName, {
      views:[{state:'frozen', ySplit:7}],
      pageSetup:{orientation:'landscape', paperSize:9, fitToPage:true, fitToWidth:1, fitToHeight:0,
        printTitlesRow:'1:7', margins:{left:0.3,right:0.3,top:0.4,bottom:0.4,header:0.2,footer:0.2}}
    });

    cols.forEach((c,i)=>{ ws.getColumn(i+1).width = c.width||16; });

    const thin = {style:'thin', color:{argb:'FF9AA5B8'}};
    const borderAll = {top:thin,left:thin,bottom:thin,right:thin};
    const now = new Date();
    const pad = n=>String(n).padStart(2,'0');
    const docCode = opts.docCode + '-' + now.getFullYear()+pad(now.getMonth()+1)+pad(now.getDate())+'-'+pad(now.getHours())+pad(now.getMinutes());

    ws.mergeCells(1,1,1,nCols);
    ws.getCell(1,1).value = 'CÔNG TY CỔ PHẦN CÔNG THƯƠNG ĐÔNG PHƯƠNG';
    ws.getCell(1,1).font = {bold:true, size:14, name:'Arial'};
    ws.getCell(1,1).alignment = {horizontal:'center'};
    ws.getRow(1).height = 20;

    ws.mergeCells(2,1,2,nCols);
    ws.getCell(2,1).value = opts.docTitle;
    ws.getCell(2,1).font = {bold:true, size:12.5, name:'Arial', color:{argb:'FF1D3FAE'}};
    ws.getCell(2,1).alignment = {horizontal:'center'};
    ws.getRow(2).height = 18;

    ws.mergeCells(3,1,3,Math.ceil(nCols/2));
    ws.getCell(3,1).value = `Mã hồ sơ: ${docCode}`;
    ws.getCell(3,1).font = {size:10, name:'Arial'};
    ws.mergeCells(3,Math.ceil(nCols/2)+1,3,nCols);
    ws.getCell(3,Math.ceil(nCols/2)+1).value = `Ngày xuất: ${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}`;
    ws.getCell(3,Math.ceil(nCols/2)+1).font = {size:10, name:'Arial'};
    ws.getCell(3,Math.ceil(nCols/2)+1).alignment = {horizontal:'right'};

    ws.mergeCells(4,1,4,nCols);
    ws.getCell(4,1).value = `Người xuất: ${actorName()}${opts.subtitle?'     '+opts.subtitle:''}`;
    ws.getCell(4,1).font = {size:10, name:'Arial', italic:true};
    ws.getRow(5).height = 4;

    const headerRow = 6;
    cols.forEach((c,i)=>{
      const cell = ws.getCell(headerRow, i+1);
      cell.value = c.header;
      cell.font = {bold:true, size:10.5, name:'Arial', color:{argb:'FFFFFFFF'}};
      cell.alignment = {horizontal:'center', vertical:'middle', wrapText:true};
      cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF1D3FAE'}};
      cell.border = borderAll;
    });
    ws.getRow(headerRow).height = 32;
    ws.getRow(7).height = 1; // dòng đệm mỏng để AutoFilter neo ngay dưới header

    // Dữ liệu phải bắt đầu từ hàng 8 (SAU dòng đệm ở hàng 7) — trước đây
    // là headerRow+1 = 7, tức là dòng dữ liệu ĐẦU TIÊN của mỗi sổ bị ghi
    // đè lên đúng dòng đệm cao 1px này, khiến toàn bộ dữ liệu dòng đó (ngày,
    // fi20/quy cách, mã, độ dẫn điện, loại thành phẩm...) tuy vẫn nằm trong
    // file nhưng bị ép dẹt gần như vô hình khi mở Excel — nhìn như bị thiếu.
    let r = headerRow+2;
    (opts.rows||[]).forEach(row=>{
      cols.forEach((c,i)=>{
        const cell = ws.getCell(r, i+1);
        let v = row[c.key];
        if(c.numFmt==='date' && v){ cell.value = new Date(v); cell.numFmt = 'dd/mm/yyyy'; }
        else { cell.value = (v===undefined||v===null)?'':v; if(c.numFmt==='num') cell.numFmt = '#,##0.##'; }
        cell.font = {size:10, name:'Arial'};
        cell.alignment = {horizontal: c.numFmt==='num'||c.numFmt==='date'?'center':'left', vertical:'middle', wrapText:true};
        cell.border = borderAll;
      });
      r++;
    });
    const lastDataRow = r-1;

    if(opts.totalsCols && opts.totalsCols.length && (opts.rows||[]).length){
      cols.forEach((c,i)=>{
        const cell = ws.getCell(r, i+1);
        cell.border = borderAll;
        cell.font = {bold:true, size:10, name:'Arial'};
        cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFEFF2F7'}};
        if(i===0){ cell.value = 'TỔNG CỘNG'; }
        else if(opts.totalsCols.includes(c.key)){
          const sum = (opts.rows||[]).reduce((s,row)=>s+(Number(row[c.key])||0),0);
          cell.value = sum; cell.numFmt='#,##0.##'; cell.alignment={horizontal:'center'};
        }
      });
      r++;
    }

    r++;
    ws.mergeCells(r,1,r,Math.ceil(nCols/3));
    ws.getCell(r,1).value = 'Người lập'; ws.getCell(r,1).font={bold:true,size:10,name:'Arial'}; ws.getCell(r,1).alignment={horizontal:'center'};
    ws.mergeCells(r,Math.ceil(nCols/3)+1,r,Math.ceil(nCols*2/3));
    ws.getCell(r,Math.ceil(nCols/3)+1).value = 'Người kiểm tra'; ws.getCell(r,Math.ceil(nCols/3)+1).font={bold:true,size:10,name:'Arial'}; ws.getCell(r,Math.ceil(nCols/3)+1).alignment={horizontal:'center'};
    ws.mergeCells(r,Math.ceil(nCols*2/3)+1,r,nCols);
    ws.getCell(r,Math.ceil(nCols*2/3)+1).value = 'QA xác nhận'; ws.getCell(r,Math.ceil(nCols*2/3)+1).font={bold:true,size:10,name:'Arial'}; ws.getCell(r,Math.ceil(nCols*2/3)+1).alignment={horizontal:'center'};
    r+=3;
    ws.mergeCells(r,1,r,Math.ceil(nCols/3));
    ws.getCell(r,1).value = '(Ký tên)'; ws.getCell(r,1).font={italic:true,size:9,name:'Arial',color:{argb:'FF9096A5'}}; ws.getCell(r,1).alignment={horizontal:'center'};
    ws.mergeCells(r,Math.ceil(nCols/3)+1,r,Math.ceil(nCols*2/3));
    ws.getCell(r,Math.ceil(nCols/3)+1).value = '(Ký tên)'; ws.getCell(r,Math.ceil(nCols/3)+1).font={italic:true,size:9,name:'Arial',color:{argb:'FF9096A5'}}; ws.getCell(r,Math.ceil(nCols/3)+1).alignment={horizontal:'center'};
    ws.mergeCells(r,Math.ceil(nCols*2/3)+1,r,nCols);
    ws.getCell(r,Math.ceil(nCols*2/3)+1).value = '(Ký tên)'; ws.getCell(r,Math.ceil(nCols*2/3)+1).font={italic:true,size:9,name:'Arial',color:{argb:'FF9096A5'}}; ws.getCell(r,Math.ceil(nCols*2/3)+1).alignment={horizontal:'center'};

    if((opts.rows||[]).length){
      ws.autoFilter = { from:{row:headerRow, column:1}, to:{row:lastDataRow, column:nCols} };
    }
    ws.pageSetup.printArea = `A1:${ws.getColumn(nCols).letter}${r}`;

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = opts.filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✅ Đã xuất file Excel '+opts.docTitle);
    // Chỉ gọi callback sau khi file ĐÃ thực sự được tạo & tải về thành công —
    // để các nơi gọi (VD dọn dữ liệu sau khi xuất) không bao giờ xoá nhầm
    // dữ liệu khi việc xuất file thất bại ở trên.
    if(typeof opts.onExported==='function') opts.onExported();
  }catch(err){
    console.error(err);
    showToast('❌ Xuất Excel thất bại: '+(err&&err.message||err), true);
  }
}

function nlDetailText(items){
  if(!Array.isArray(items) || !items.length) return '';
  return items.map(it=>`${it.ma?it.ma+': ':''}${fmtNum(it.kg)}kg`).join('; ');
}
function exportSlExcel(tab){
  const meta = SL_META[tab];
  const now = new Date(); const pad=n=>String(n).padStart(2,'0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
  // Ghi lại đúng tập ID các dòng đang được xuất ra file lần này — dùng để,
  // SAU KHI file đã tải về thành công, hỏi người dùng có muốn xoá đúng các
  // dòng này (dữ liệu vừa xuất + mọi dữ liệu cũ hơn đang có trong sổ, vì
  // exportSlExcel luôn xuất TOÀN BỘ sổ) khỏi hệ thống hay không, để giảm
  // dung lượng lưu trữ. Chỉ xoá đúng các ID đã chốt tại thời điểm bấm xuất —
  // không xoá theo "toàn bộ mảng hiện tại" phòng trường hợp có dòng mới
  // được thêm vào đúng lúc hộp thoại xác nhận đang mở.
  const exportedIds = slArr(tab).map(r=>r.id).filter(Boolean);
  const onExported = ()=> slConfirmClearAfterExport(tab, exportedIds);

  if(tab==='nguyenLieu'){
    exportProfessionalExcel({
      docTitle: 'SỔ GHI NGUYÊN LIỆU PHẾ PHOI VÀ CHẠY CÁC KÍCH CỠ', docCode: meta.code, sheetName:'SoNguyenLieu',
      columns:[
        {header:'Ngày', key:'ngay', width:12, numFmt:'date'},
        {header:'Giờ nhập', key:'createdAtText', width:16},
        {header:'Nguyên liệu', key:'nguyenLieu', width:16},
        {header:'Mã cuộn/Heat-Lot', key:'heatLot', width:18},
        {header:'Độ dẫn điện', key:'doDanDien', width:14},
        {header:'Số lượng (kg)', key:'soLuong', width:13, numFmt:'num'},
        {header:'Loại TP chạy', key:'loaiThanhPham', width:14},
        {header:'Số mét chạy', key:'soMetChay', width:12},
        {header:'Khu máy', key:'khuMay', width:14},
        {header:'Máy', key:'may', width:18},
        {header:'Phế/đầu mẩu (kg)', key:'phe', width:14, numFmt:'num'},
        {header:'Chi tiết mã Phế/đầu mẩu', key:'pheDetail', width:26},
        {header:'Phoi (kg)', key:'phoi', width:11, numFmt:'num'},
        {header:'Chi tiết mã Phoi', key:'phoiDetail', width:26},
        {header:'Khách hàng', key:'khachHang', width:16},
        {header:'PO', key:'po', width:12},
        {header:'WO', key:'wo', width:12},
        {header:'Ghi chú', key:'ghiChu', width:22},
        {header:'Người cập nhật', key:'updatedBy', width:16},
        {header:'Cập nhật lúc', key:'updatedAtText', width:16}
      ],
      rows: slArr('nguyenLieu').slice().sort((a,b)=> String(a.ngay||'').localeCompare(String(b.ngay||'')) || (a.updatedAt||0)-(b.updatedAt||0))
        .map(r=>({...r, pheDetail: nlDetailText(r.pheItems), phoiDetail: nlDetailText(r.phoiItems), createdAtText: (r.createdAt||r.updatedAt)?fmtDateTime(r.createdAt||r.updatedAt):'', updatedAtText: r.updatedAt?fmtDateTime(r.updatedAt):''})),
      totalsCols:['soLuong','phe','phoi'],
      filename:`So_nguyen_lieu_${stamp}.xlsx`,
      onExported
    });
  } else {
    const sorted = slArr(tab).slice().sort((a,b)=> String(a.ngay||'').localeCompare(String(b.ngay||'')) || (a.updatedAt||0)-(b.updatedAt||0));
    const rows = sorted.map((r,i)=>({...r, stt:i+1, caLabel: r.ca?('Ca '+r.ca):'', createdAtText: (r.createdAt||r.updatedAt)?fmtDateTime(r.createdAt||r.updatedAt):'', updatedAtText: r.updatedAt?fmtDateTime(r.updatedAt):''}));
    exportProfessionalExcel({
      docTitle: 'SỔ GHI THÀNH PHẨM '+(tab==='mayRut'?'RÚT':'ĐÁNH BÓNG + CẮT'), docCode: meta.code, sheetName: tab==='mayRut'?'SoMayRut':'SoMayDanhBongCat',
      columns:[
        {header:'STT', key:'stt', width:6, numFmt:'num'},
        {header:'Ngày', key:'ngay', width:12, numFmt:'date'},
        {header:'Giờ nhập', key:'createdAtText', width:16},
        {header:'Quy cách', key:'quyCach', width:16},
        {header:'Loại NL', key:'loaiNL', width:12},
        {header:'Hàng', key:'hang', width:12},
        {header:'Số thanh', key:'soThanh', width:10, numFmt:'num'},
        {header:'Công đoạn', key:'congDoan', width:12},
        {header:'Máy', key:'may', width:18},
        {header:'Ca SX', key:'caLabel', width:9},
        {header:'Người SX', key:'nguoiSanXuat', width:16},
        {header:'Khách hàng', key:'khachHang', width:16},
        {header:'Ghi chú', key:'ghiChu', width:20},
        {header:'Người cập nhật', key:'updatedBy', width:16},
        {header:'Cập nhật lúc', key:'updatedAtText', width:16}
      ],
      rows, totalsCols:['soThanh'],
      filename:`So_may_${tab==='mayRut'?'rut':'danh_bong_cat'}_${stamp}.xlsx`,
      onExported
    });
  }
}

// ════════════════════════════════════════════════════════════════════
// SAU KHI XUẤT EXCEL (tab 📊 Số liệu — cả 3 sổ: Nguyên liệu / Máy Rút /
// Máy Đánh bóng+Cắt): hỏi xác nhận rồi TỰ ĐỘNG XOÁ đúng các dòng dữ liệu
// vừa được ghi vào file Excel đã tải về (bao gồm cả dữ liệu cũ, vì mỗi
// lần xuất luôn xuất TOÀN BỘ sổ) khỏi hệ thống, để giảm bớt dung lượng
// lưu trữ — dữ liệu vẫn còn nguyên vẹn trong file Excel vừa tải về máy.
// Chỉ admin/nhân sự có quyền sửa sổ Số liệu (isSlEditor) mới được xoá;
// người chỉ có quyền xem (Viewer) xuất Excel bình thường nhưng KHÔNG bị
// hỏi xoá (guardSlEdit chặn) — dữ liệu của họ được giữ nguyên.
//
// NÂNG CẤP: việc lưu sau khi xoá (slDoSave→saveXxxLog) giờ đi qua
// syncSlFieldPerRecord — tự động so với ảnh chụp đồng bộ để nhận ra
// CHÍNH XÁC các dòng vừa biến mất (đúng các dòng vừa xuất) và gửi lệnh
// XOÁ RIÊNG từng dòng thẳng tới /data/<field>/{id}, giống hệt cơ chế
// Đơn hoàn thành — nên các thiết bị khác nhận được và xoá theo NGAY LẬP
// TỨC qua SSE, không còn tình trạng "xoá ở máy mình nhưng máy khác vẫn
// còn dữ liệu cũ".
// ════════════════════════════════════════════════════════════════════
function slConfirmClearAfterExport(tab, exportedIds){
  if(!isSlEditor()) return; // Viewer: chỉ xem/xuất, không có quyền xoá dữ liệu
  if(!exportedIds || !exportedIds.length) return; // sổ trống, không có gì để dọn
  const meta = SL_META[tab];
  confirm2(
    '🗑️ Dọn dữ liệu sau khi xuất?',
    `Đã xuất ${exportedIds.length} dòng của "${meta.label}" ra file Excel. Dữ liệu đã được lưu đầy đủ trong file vừa tải về — bạn có muốn xoá các dòng này khỏi hệ thống để giảm dung lượng lưu trữ không? Không thể hoàn tác.`,
    ()=> slClearAfterExport(tab, exportedIds)
  );
}
function slClearAfterExport(tab, exportedIds){
  const field = SL_META[tab].field;
  const idSet = new Set(exportedIds);
  const arr = DB[field]||[];
  const kept = arr.filter(r=> !(r && idSet.has(r.id)));
  const removed = arr.length - kept.length;
  if(removed<=0) return;
  DB[field] = kept;
  slDoSave(tab); // syncSlFieldPerRecord tự nhận ra đúng các ID vừa biến mất và gửi lệnh xoá riêng từng dòng lên server
  log(SL_META[tab].label, `Dọn dữ liệu sau khi xuất Excel — đã xoá ${removed} dòng (đã lưu trong file Excel vừa tải về)`, null, null, {deletedBy:'AFTER_EXPORT'});
  if(currentTab==='soLieu') renderSoLieu();
  showToast(`🗑️ Đã dọn ${removed} dòng dữ liệu — sổ đã gọn nhẹ hơn`);
}



// ════════════════════════════════════════════════════════════════════
// IN / XUẤT PDF CHUYÊN NGHIỆP — dựng khung in A4 ngang có tiêu đề công
// ty, tên sổ, mã hồ sơ, người/ngày xuất, bảng đầy đủ cột (kể cả cột Máy
// mới), dòng tổng cộng và 3 ô chữ ký Người lập/Người kiểm tra/QA — mở
// cửa sổ in để người dùng bấm "Lưu dưới dạng PDF" ngay trên trình
// duyệt, giống hệt cách xuất PDF Lịch làm việc đã có sẵn trong app.
// Tôn trọng đúng bộ lọc (tìm kiếm/khoảng ngày) đang áp dụng trên tab.
// ════════════════════════════════════════════════════════════════════
function slPrintExport(tab){
  const meta = SL_META[tab];
  const list = slArr(tab).slice().sort((a,b)=> String(a.ngay||'').localeCompare(String(b.ngay||'')) || (a.updatedAt||0)-(b.updatedAt||0));
  const filtered = list.filter(r=>{
    if(!inDateRange(r.ngay, _slFrom, _slTo)) return false;
    if(tab==='nguyenLieu') return matchesSearch(r, ['nguyenLieu','heatLot','loaiThanhPham','ghiChu','khachHang','doDanDien','may','khuMay'], _slSearch);
    return matchesSearch(r, ['quyCach','loaiNL','congDoan','nguoiSanXuat','khachHang','ghiChu','may'], _slSearch);
  });
  if(!filtered.length){ showToast('📭 Không có dữ liệu để xuất', true); return; }

  const now = new Date(); const pad=n=>String(n).padStart(2,'0');
  const docCode = `${meta.code}-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const e2 = v=>(v==null?'':String(v)).replace(/</g,'&lt;');

  let head, rows, totalLabel, totalVal;
  if(tab==='nguyenLieu'){
    head = ['Ngày','Giờ nhập','Nguyên liệu','Mã cuộn/Heat-Lot','Độ dẫn điện','Số lượng (kg)','Loại TP chạy','Số mét chạy','Khu máy','Máy','Phế/đầu mẩu (kg)','Phoi (kg)','Khách hàng','PO','WO','Ghi chú'];
    rows = filtered.map(r=>[fmtDate(r.ngay), (r.createdAt||r.updatedAt)?vnTimeHM(new Date(r.createdAt||r.updatedAt)):'—', e2(r.nguyenLieu), e2(r.heatLot), e2(r.doDanDien), fmtNum(r.soLuong), e2(r.loaiThanhPham), e2(r.soMetChay), e2(r.khuMay)||'—', e2(r.may)||'—', fmtNum(r.phe), fmtNum(r.phoi), e2(r.khachHang), e2(r.po), e2(r.wo), e2(r.ghiChu)]);
    totalLabel = 'Tổng số lượng (kg)';
    totalVal = fmtNum(filtered.reduce((s,r)=>s+(Number(r.soLuong)||0),0));
  } else {
    head = ['STT','Ngày','Giờ nhập','Quy cách','Loại NL','Hàng','Số thanh','Công đoạn','Máy','Ca SX','Người SX','Khách hàng','Ghi chú'];
    rows = filtered.map((r,i)=>[i+1, fmtDate(r.ngay), (r.createdAt||r.updatedAt)?vnTimeHM(new Date(r.createdAt||r.updatedAt)):'—', e2(r.quyCach), e2(r.loaiNL), e2(r.hang)||'—', fmtNum(r.soThanh), e2(r.congDoan)||'—', e2(r.may)||'—', r.ca?('Ca '+r.ca):'—', e2(r.nguoiSanXuat), e2(r.khachHang), e2(r.ghiChu)]);
    totalLabel = 'Tổng số thanh';
    totalVal = fmtNum(filtered.reduce((s,r)=>s+(Number(r.soThanh)||0),0));
  }
  const docTitle = tab==='nguyenLieu' ? 'SỔ GHI NGUYÊN LIỆU PHẾ PHOI VÀ CHẠY CÁC KÍCH CỠ'
    : 'SỔ GHI THÀNH PHẨM '+(tab==='mayRut'?'RÚT':'ĐÁNH BÓNG + CẮT');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${e2(meta.label)}</title>
  <style>
    @page{ size:A4 landscape; margin:10mm; }
    body{ font-family:Arial,Helvetica,sans-serif; color:#000; }
    h1{ text-align:center; font-size:15px; margin:0 0 2px; text-transform:uppercase }
    h2{ text-align:center; font-size:12.5px; margin:0 0 8px; color:${meta.color} }
    .meta{ display:flex; justify-content:space-between; font-size:10.5px; margin-bottom:8px; color:#333 }
    table{ border-collapse:collapse; width:100%; font-size:10px }
    th,td{ border:1px solid #000; padding:4px 5px; text-align:center }
    th{ background:${meta.color}; color:#fff; font-weight:bold }
    td:last-child{ text-align:left }
    tfoot td{ font-weight:bold; background:#EFF2F7 }
    .sign{ margin-top:28px; display:flex; justify-content:space-between; text-align:center; font-size:11px }
    .sign div{ width:32%; }
    .sign .tt{ font-weight:bold; margin-bottom:42px }
    .sub{ font-style:italic; color:#9096A5; font-size:9.5px }
  </style></head><body>
    <h1>Công ty Cổ phần Công Thương Đông Phương</h1>
    <h2>${e2(docTitle)}</h2>
    <div class="meta"><span>Mã hồ sơ: ${docCode}</span><span>Người xuất: ${e2(actorName())}</span><span>Ngày xuất: ${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}</span></div>
    <table>
      <thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row=>`<tr>${row.map(c=>`<td>${c===''||c==null?'—':c}</td>`).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="${head.length-1}" style="text-align:right">${totalLabel}</td><td>${totalVal}</td></tr></tfoot>
    </table>
    <div class="sign">
      <div><div class="tt">Người lập</div><div class="sub">(Ký, ghi rõ họ tên)</div></div>
      <div><div class="tt">Người kiểm tra</div><div class="sub">(Ký, ghi rõ họ tên)</div></div>
      <div><div class="tt">QA xác nhận</div><div class="sub">(Ký, ghi rõ họ tên)</div></div>
    </div>
  </body></html>`;
  const w = window.open('', '_blank');
  if(!w){ showToast('❌ Trình duyệt chặn cửa sổ in, vui lòng cho phép popup', true); return; }
  w.document.open(); w.document.write(html); w.document.close();
  w.onload = ()=>{ w.focus(); w.print(); };
}
