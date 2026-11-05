// src/modules/attendance/attendance-export.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Dựng mảng 2 chiều (đúng khung cột như bảng hiển thị trên app) dùng chung
// cho cả xuất .xlsx (SheetJS) lẫn phương án dự phòng .csv
function buildAttendanceRows(){
  const ym = curYM();
  const [y,m] = ym.split('-').map(Number);
  const nDays = daysInMonth(ym);
  const monthData = DB.attendance[ym] || {};
  const rows = [];
  rows.push([`BẢNG CHẤM CÔNG THÁNG ${m}/${y}`]);
  rows.push([]);
  rows.push(['STT','Họ và tên','Bộ phận', ...Array.from({length:nDays},(_,i)=>String(i+1)), 'Tổng công']);
  rows.push(['','','Ngày trong tháng', ...Array.from({length:nDays},(_,i)=>weekdayVN(y,m,i+1)), '']);
  DB.workers.forEach((w,i)=>{
    const rowData = monthData[w.id] || {};
    const row = [i+1, w.name||'', w.boPhan||''];
    for(let d=1; d<=nDays; d++) row.push(rowData[d]!==undefined?rowData[d]:'');
    row.push(computeTotal(w.id));
    rows.push(row);
  });
  rows.push([]);
  rows.push(['Ghi chú: Đủ ngày công = 1, Nửa ngày công = 0.5, Không công = 0. Làm thêm giờ cộng vào công ngày (VD thêm 2h = 1.2).']);
  return {rows, ym, y, m, nDays};
}

function exportAttendanceExcel(){if(guardViewer())return;
  const {rows, ym, y, m, nDays} = buildAttendanceRows();
  const nCols = 3 + nDays + 1; // STT + Tên + Bộ phận + các ngày + Tổng công

  if(typeof XLSX==='undefined'){
    // Thư viện Excel chưa tải xong → xuất tạm .csv, khung cột vẫn đúng như app
    showToast('⏳ Thư viện Excel chưa tải xong, đang xuất tạm .csv...', true);
    csvDownload(`Bang_cham_cong_${ym}.csv`, rows);
    loadSheetJs();
    return;
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Gộp ô tiêu đề cho giống khung tiêu đề trên app
  ws['!merges'] = [
    {s:{r:0,c:0}, e:{r:0,c:nCols-1}},
    {s:{r:rows.length-1,c:0}, e:{r:rows.length-1,c:nCols-1}}
  ];
  // Độ rộng cột: STT nhỏ, Họ tên rộng, mỗi ngày hẹp, Tổng công vừa — đúng tỉ lệ như bảng trên app
  ws['!cols'] = [{wch:5}, {wch:22}, {wch:14}, ...Array.from({length:nDays},()=>({wch:5})), {wch:11}];
  // Ghim (freeze) 2 dòng tiêu đề + 3 cột đầu, giống thanh cuộn dính trên app
  ws['!freeze'] = {xSplit:3, ySplit:4};
  ws['!rows'] = rows.map(()=>({hpt:18}));
  // Viền khung cho toàn bộ vùng bảng (kể cả khi mở bằng Excel/Sheets đều có khung ô rõ ràng)
  const range = XLSX.utils.decode_range(ws['!ref']);
  for(let R=2; R<=range.e.r-1; R++){
    for(let C=0; C<=range.e.c; C++){
      const addr = XLSX.utils.encode_cell({r:R,c:C});
      if(!ws[addr]) ws[addr] = {t:'s', v:''};
      ws[addr].s = {
        border:{top:{style:'thin',color:{rgb:'000000'}},bottom:{style:'thin',color:{rgb:'000000'}},left:{style:'thin',color:{rgb:'000000'}},right:{style:'thin',color:{rgb:'000000'}}},
        alignment:{horizontal: C<3?'left':'center', vertical:'center'},
        font: (R<=3) ? {bold:true} : undefined
      };
    }
  }
  ws['A1'] = {t:'s', v:rows[0][0], s:{font:{bold:true,sz:14}, alignment:{horizontal:'center'}}};

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `ChamCong_${ym}`);
  XLSX.writeFile(wb, `Bang_cham_cong_${ym}.xlsx`);
  showToast('✅ Đã xuất file chấm công tháng '+m+'/'+y);
}

function printAttendance(size){if(guardViewer())return;
  size = (size==='A3') ? 'A3' : 'A4';
  const ym = curYM();
  const [y,m] = ym.split('-').map(Number);
  const nDays = daysInMonth(ym);
  const monthData = DB.attendance[ym] || {};
  const dayCols = Array.from({length:nDays}, (_,i)=>i+1);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bảng chấm công ${m}/${y}</title>
  <style>
    @page{ size:${size} landscape; margin:8mm; }
    body{ font-family:Arial,Helvetica,sans-serif; color:#000; }
    h1{ text-align:center; font-size:16px; margin:0 0 4px; text-transform:uppercase }
    .sub{ text-align:center; font-size:12px; margin-bottom:10px }
    table{ border-collapse:collapse; width:100%; font-size:9.5px; table-layout:fixed }
    th,td{ border:1px solid #000; padding:2px 3px; text-align:center; overflow:hidden }
    th{ background:#f0f0f0; font-weight:bold }
    td.name{ text-align:left; white-space:nowrap }
    .wd{ font-size:8px; color:#444; display:block }
    .sun{ color:#c00 }
    .total{ font-weight:bold; background:#f7f7f7 }
    .legend{ margin-top:10px; font-size:10px; line-height:1.5 }
    .stt{ width:24px }
    .name{ width:120px }
    .dept{ width:80px }
  </style></head><body>
    <h1>Bảng chấm công tháng ${m} năm ${y}</h1>
    <table>
      <thead><tr>
        <th class="stt">STT</th><th class="name">Họ và tên</th><th class="dept">Bộ phận</th>
        ${dayCols.map(d=>`<th>${d}<span class="wd ${weekdayVN(y,m,d)==='CN'?'sun':''}">${weekdayVN(y,m,d)}</span></th>`).join('')}
        <th>Tổng công</th>
      </tr></thead>
      <tbody>
        ${DB.workers.map((w,i)=>{
          const rowData = monthData[w.id]||{};
          return `<tr>
            <td>${i+1}</td>
            <td class="name">${(w.name||'').replace(/</g,'&lt;')}</td>
            <td class="dept">${(w.boPhan||'—').toString().replace(/</g,'&lt;')}</td>
            ${dayCols.map(d=>`<td>${rowData[d]!==undefined?rowData[d]:''}</td>`).join('')}
            <td class="total">${computeTotal(w.id)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="legend">
      <b>Ghi chú:</b> Đủ ngày công = 1 &nbsp;·&nbsp; Nửa ngày công = 0.5 &nbsp;·&nbsp; Không công = 0.<br>
      Làm thêm giờ thì cộng vào công ngày, ví dụ làm thêm 2 tiếng thì ghi 1.2 (1 là công 1 ngày 8 tiếng, 0.2 là làm thêm 2 tiếng).
    </div>
  </body></html>`;

  const w = window.open('', '_blank');
  if(!w){ showToast('❌ Trình duyệt chặn cửa sổ in, vui lòng cho phép popup', true); return; }
  w.document.open(); w.document.write(html); w.document.close();
  w.onload = ()=>{ w.focus(); w.print(); };
}
