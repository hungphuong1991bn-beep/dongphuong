// src/modules/checklist/checklist-export.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Xuất Excel Check Sheet Thiết bị — dựng bảng từ đầu bằng ExcelJS (không
// dùng file mẫu cố định vì số khu vực/hạng mục tuỳ chỉnh theo Admin), giữ
// đúng bố cục chuyên nghiệp của file gốc: tiêu đề, tháng/năm, tên thiết bị,
// bảng có viền đầy đủ, ô trạng thái tô màu xanh/đỏ, chú thích ký hiệu.
async function exportCheckSheetExcel(groupId){
  const group = (DB.csTemplates||[]).find(g=>g.id===groupId);
  if(!group){ showToast('❌ Không tìm thấy nhóm thiết bị để xuất', true); return; }
  showToast('⏳ Đang tạo file Excel...', false);
  try{ await ensureExcelJs(); }
  catch(e){ showToast('❌ Không tải được thư viện xuất Excel — kiểm tra kết nối mạng rồi thử lại', true); return; }
  if(!window.ExcelJS){ showToast('⏳ Thư viện Excel chưa tải xong, vui lòng bấm "Xuất Excel" lại sau vài giây', true); return; }

  try{
    const ym = csYM();
    const [y,m] = ym.split('-').map(Number);
    const nDays = daysInMonth(ym);
    const totalCols = 3 + nDays;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Check Sheet', {views:[{state:'frozen', xSplit:3, ySplit:6}]});

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 30;
    ws.getColumn(3).width = 16;
    for(let c=4;c<=totalCols;c++) ws.getColumn(c).width = 4.3;

    const thin = {style:'thin', color:{argb:'FF888888'}};
    const borderAll = {top:thin,left:thin,bottom:thin,right:thin};

    ws.mergeCells(1,1,1,totalCols);
    const titleCell = ws.getCell(1,1);
    titleCell.value = 'BẢNG KIỂM THIẾT BỊ';
    titleCell.font = {bold:true, size:16, name:'Arial'};
    titleCell.alignment = {horizontal:'center', vertical:'middle'};
    ws.getRow(1).height = 24;

    ws.mergeCells(2,1,2,totalCols);
    const dateCell = ws.getCell(2,1);
    dateCell.value = `Tháng ${m}     Năm ${y}`;
    dateCell.font = {bold:true, size:12, name:'Arial'};
    dateCell.alignment = {horizontal:'center'};
    ws.getRow(2).height = 18;

    ws.mergeCells(3,1,3,totalCols);
    const nameCell = ws.getCell(3,1);
    nameCell.value = `Tên thiết bị : ${group.name}`;
    nameCell.font = {bold:true, size:12, name:'Arial'};
    nameCell.alignment = {horizontal:'left'};
    ws.getRow(3).height = 18;
    ws.getRow(4).height = 4;

    const headerRow = 5, wdRow = 6;
    ws.mergeCells(headerRow,1,wdRow,1); ws.getCell(headerRow,1).value = 'STT';
    ws.mergeCells(headerRow,2,wdRow,2); ws.getCell(headerRow,2).value = 'Hạng mục';
    ws.mergeCells(headerRow,3,wdRow,3); ws.getCell(headerRow,3).value = 'Tiêu chuẩn';
    for(let d=1; d<=nDays; d++){
      ws.getCell(headerRow, 3+d).value = d;
      const wd = weekdayVN(y,m,d);
      const wdCell = ws.getCell(wdRow, 3+d);
      wdCell.value = wd;
      wdCell.font = {size:8, name:'Arial', bold:true, color:{argb: wd==='CN'?'FFDC2626':'FF1D4ED8'}};
      wdCell.alignment = {horizontal:'center', vertical:'middle'};
      wdCell.border = borderAll;
    }
    for(let c=1;c<=totalCols;c++){
      const cell = ws.getCell(headerRow,c);
      cell.font = {bold:true, size:10, name:'Arial'};
      cell.alignment = {horizontal:'center', vertical:'middle'};
      cell.border = borderAll;
      cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFDCE6F1'}};
      const c2 = ws.getCell(wdRow,c);
      c2.border = borderAll;
      c2.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFDCE6F1'}};
    }

    let r = wdRow + 1;
    (group.sections||[]).forEach(sec=>{
      ws.mergeCells(r,1,r,totalCols);
      const sCell = ws.getCell(r,1);
      sCell.value = sec.name;
      sCell.font = {bold:true, size:11, name:'Arial'};
      sCell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFEFF2F7'}};
      sCell.border = borderAll;
      ws.getRow(r).height = 18;
      r++;
      let stt=0;
      (sec.items||[]).forEach(it=>{
        stt++;
        const itemKey = group.id+'|'+sec.id+'|'+it.id;
        const rowData = (DB.csData[ym]||{})[itemKey] || {};
        ws.getCell(r,1).value = stt;
        ws.getCell(r,2).value = it.name;
        ws.getCell(r,3).value = it.std || '';
        for(let c=1;c<=3;c++){
          const cell = ws.getCell(r,c);
          cell.font = {size:10, name:'Arial'};
          cell.alignment = {horizontal: c===2?'left':'center', vertical:'middle', wrapText:c===2};
          cell.border = borderAll;
        }
        for(let d=1; d<=nDays; d++){
          const v = rowData[d] || '';
          const st = CS_STATUS[v];
          const cell = ws.getCell(r, 3+d);
          cell.value = st ? st.short : '';
          cell.alignment = {horizontal:'center', vertical:'middle'};
          cell.border = borderAll;
          cell.font = {bold:true, size:10, name:'Arial', color:{argb: v==='ok'?'FF15803D': v==='ng'?'FFB91C1C':'FF000000'}};
          if(st) cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb: v==='ok'?'FFDCFCE7':'FFFEE2E2'}};
        }
        r++;
      });
    });

    r++;
    ws.mergeCells(r,1,r,totalCols);
    const legendCell = ws.getCell(r,1);
    legendCell.value = `Ký hiệu :     ✓ = ${CS_STATUS.ok.label}          ✗ = ${CS_STATUS.ng.label}`;
    legendCell.font = {italic:true, size:10, name:'Arial'};
    r++;

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const pad = n=>String(n).padStart(2,'0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
    const safeName = (group.name||'CheckSheet').toString().replace(/[^a-zA-Z0-9À-ỹ ]/g,'').replace(/\s+/g,'_');
    a.href = url; a.download = `CheckSheet_${safeName}_${ym}_${stamp}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✅ Đã xuất file Excel Check Sheet Thiết bị');
  }catch(err){
    console.error(err);
    showToast('❌ Xuất Excel thất bại: ' + (err && err.message || err), true);
  }
}
