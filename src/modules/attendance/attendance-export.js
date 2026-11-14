// src/modules/attendance/attendance-export.js  — GIAI ĐOẠN 1 (v2.6.0)
// Xuất Excel / in A4 cho Chấm công. Dùng CHUNG mô hình attBuildModel() với giao diện nên số liệu luôn khớp màn hình.
// Hàm cũ giữ nguyên tên: buildAttendanceRows, exportAttendanceExcel, printAttendance.
// LƯU Ý: chưa có quy định lương chính thức → các báo cáo CHỈ tổng hợp số liệu (công, giờ tăng ca, ngày nghỉ),
// KHÔNG tính tiền. Định mức công chuẩn/tháng chưa có nên "thiếu công" = thiếu DỮ LIỆU chấm công.

const ATT_NOTE_LINE = 'Ghi chú: Đủ công = 1, nửa công = 0.5, nghỉ = 0. Tăng ca ghi sau dấu chấm (1.2 = 1 công + 2 giờ). Đủ 8 giờ tăng ca quy đổi 1 công.';

function attXlsxReady(fallbackName, fallbackRows){
  if(typeof XLSX !== 'undefined') return true;
  showToast('⏳ Thư viện Excel chưa tải xong, đang xuất tạm .csv...', true);
  if(fallbackRows) csvDownload(fallbackName.replace(/\.xlsx$/,'.csv'), fallbackRows);
  if(typeof loadSheetJs === 'function') loadSheetJs();
  return false;
}
function attSheetName(s, used){
  let n = String(s||'Sheet').replace(/[\\\/\?\*\[\]:]/g,' ').trim().slice(0,28) || 'Sheet', k = n, i = 2;
  while(used && used[k]){ k = n.slice(0,25) + '_' + (i++); } if(used) used[k] = 1; return k;
}
function attSheet(rows, widths, merges, freeze){
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if(widths) ws['!cols'] = widths.map(w=>({wch:w}));
  if(merges) ws['!merges'] = merges;
  if(freeze) ws['!freeze'] = freeze;
  return ws;
}
function attLeaveInfoText(r, model){
  const l = attLeaveDays(r.w, model.ym, DB.nghiPhep||[]); const ds = Object.keys(l).map(Number).sort((a,b)=>a-b);
  return ds.length ? ds.join(', ') + ' (' + Array.from(new Set(ds.map(d=>l[d]))).join(', ') + ')' : '';
}
function attOffDaysList(r, model){
  const out = []; for(let d=1; d<=model.n; d++){ const i = attCellInfo(r.row[d]); if(i.state==='ok' && i.kind==='off') out.push(d); } return out;
}

// ── Bảng công (đúng khung như màn hình; có Mã NV, Chức vụ, Giờ TC, Ngày nghỉ, Ghi chú) ──
function buildAttendanceRows(model){
  model = model || attBuildModel();
  const {ym, y, m, n} = model, rows = [];
  rows.push([`BẢNG CHẤM CÔNG THÁNG ${m}/${y}`]);
  const scope = []; if(_attFilter.dept!=='all') scope.push('Bộ phận: '+_attFilter.dept); if(_attFilter.shift!=='all') scope.push('Ca: '+attShiftLabel(_attFilter.shift));
  rows.push([scope.length ? scope.join(' · ') : 'Tất cả bộ phận', model.locked ? 'Kỳ đã chốt' : 'Kỳ đang mở']);
  rows.push(['STT','Mã NV','Họ và tên','Bộ phận','Chức vụ', ...Array.from({length:n},(_,i)=>String(i+1)), 'Tổng công','Giờ tăng ca','Ngày nghỉ','Ghi chú']);
  rows.push(['','','','','Thứ', ...Array.from({length:n},(_,i)=>weekdayVN(y,m,i+1)), '','','','']);
  model.rows.forEach((r,i)=>{
    const row = [i+1, r.w.maNV||'', r.w.name||'', r.w.boPhan||'', r.w.chucVu||''];
    for(let d=1; d<=n; d++) row.push(r.row[d]!==undefined ? r.row[d] : '');
    row.push(r.stats.congStr, r.stats.otRaw||0, r.stats.offDays||0, attNoteOf(ym, r.w.id));
    rows.push(row);
  });
  rows.push([]); rows.push([ATT_NOTE_LINE]);
  return {rows, ym, y, m, nDays:n, model};
}
function attBangCongSheet(model){
  const b = buildAttendanceRows(model), nCols = 5 + model.n + 4;
  return attSheet(b.rows, [5,9,24,14,14, ...Array.from({length:model.n},()=>5), 11,11,10,24],
    [{s:{r:0,c:0},e:{r:0,c:nCols-1}}, {s:{r:b.rows.length-1,c:0},e:{r:b.rows.length-1,c:nCols-1}}], {xSplit:3, ySplit:4});
}
function exportAttendanceExcel(){
  if(guardViewer()) return;
  const model = attBuildModel(); if(!model.rows.length){ showToast('⚠️ Không có dữ liệu để xuất (kiểm tra bộ lọc)', true); return; }
  const fname = `Bang_cham_cong_${model.ym}.xlsx`;
  if(!attXlsxReady(fname, buildAttendanceRows(model).rows)) return;
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, attBangCongSheet(model), `ChamCong_${model.ym}`);
  XLSX.writeFile(wb, fname); showToast('✅ Đã xuất bảng chấm công tháng '+model.m+'/'+model.y);
}
// Mỗi bộ phận 1 sheet (không phụ thuộc bộ lọc bộ phận đang chọn)
function exportAttendanceByDept(){
  if(guardViewer()) return;
  const all = attBuildModel(curYM(), Object.assign({}, _attFilter, {dept:'all'}));
  if(!all.rows.length){ showToast('⚠️ Không có dữ liệu để xuất', true); return; }
  const fname = `Cham_cong_theo_bo_phan_${all.ym}.xlsx`;
  if(!attXlsxReady(fname, buildAttendanceRows(all).rows)) return;
  const groups = {}; all.rows.forEach(r=>{ const k = (r.w.boPhan||'').trim() || '(Chưa có bộ phận)'; (groups[k] = groups[k]||[]).push(r); });
  const wb = XLSX.utils.book_new(), used = {};
  Object.keys(groups).sort().forEach(k=>{ const mdl = Object.assign({}, all, {rows:groups[k]}); XLSX.utils.book_append_sheet(wb, attBangCongSheet(mdl), attSheetName(k, used)); });
  XLSX.writeFile(wb, fname); showToast('✅ Đã xuất '+Object.keys(groups).length+' bộ phận');
}
// ── Báo cáo tổng hợp: tổng công & tăng ca · ngày nghỉ · thiếu công · số liệu phục vụ tính lương ──
function exportAttendanceReports(){
  if(guardViewer()) return;
  const model = attBuildModel(); if(!model.rows.length){ showToast('⚠️ Không có dữ liệu để xuất', true); return; }
  const fname = `Bao_cao_cham_cong_${model.ym}.xlsx`;
  const sum = [['BÁO CÁO TỔNG CÔNG & TĂNG CA THÁNG '+model.m+'/'+model.y],[],['STT','Mã NV','Họ và tên','Bộ phận','Chức vụ','Ca (theo lịch)','Số ngày có công','Tổng công (quy ước)','Số công (đã quy đổi)','Giờ tăng ca ghi nhận','Giờ tăng ca dư (<8h)','Số ngày nghỉ (0)','Số ngày thiếu dữ liệu']];
  model.rows.forEach((r,i)=>sum.push([i+1, r.w.maNV||'', r.w.name||'', r.w.boPhan||'', r.w.chucVu||'', attShiftLabel(r.shift), r.stats.workedDays, r.stats.congStr, r.stats.congUnits, r.stats.otRaw, r.stats.otRest, r.stats.offDays, r.stats.missingDays.length]));
  const a = model.agg; sum.push([]); sum.push(['','','TỔNG','','','','','',a.congUnits,a.otRaw,a.otRest,a.offDays,a.missingCells]);
  const off = [['BÁO CÁO NGÀY NGHỈ THÁNG '+model.m+'/'+model.y],['Ngày nghỉ = ô chấm 0. Nghỉ phép = đơn ĐÃ DUYỆT (đơn chờ duyệt/từ chối không tính).'],['STT','Mã NV','Họ và tên','Bộ phận','Số ngày chấm nghỉ (0)','Các ngày chấm nghỉ','Ngày nghỉ phép đã duyệt']];
  model.rows.forEach((r,i)=>{ const od = attOffDaysList(r, model), lv = attLeaveInfoText(r, model); if(od.length || lv) off.push([i+1, r.w.maNV||'', r.w.name||'', r.w.boPhan||'', od.length, od.join(', '), lv]); });
  const mis = [['BÁO CÁO NHÂN VIÊN THIẾU DỮ LIỆU CHẤM CÔNG THÁNG '+model.m+'/'+model.y],['Không tính Chủ nhật, ngày lễ đã khai báo, ngày nghỉ phép đã duyệt, ngày chưa tới và ngày trước khi vào làm. Chưa có định mức công chuẩn nên không đánh giá "thiếu công" theo số công.'],['STT','Mã NV','Họ và tên','Bộ phận','Số ngày thiếu','Các ngày thiếu','Ô bất thường']];
  model.rows.forEach((r,i)=>{ const iss = r.stats.issues.map(x=>(x.day?('ng.'+x.day+' '):'')+(ATT_WARN_TEXT[x.code]||x.code)).join('; '); if(r.stats.missingDays.length || iss) mis.push([i+1, r.w.maNV||'', r.w.name||'', r.w.boPhan||'', r.stats.missingDays.length, r.stats.missingDays.join(', '), iss]); });
  const pay = [['SỐ LIỆU CÔNG PHỤC VỤ TÍNH LƯƠNG THÁNG '+model.m+'/'+model.y],['CHƯA CÓ quy định lương chính thức → file này CHỈ tổng hợp số liệu, không có số tiền. Kỳ chấm công: '+(model.locked?'ĐÃ CHỐT':'CHƯA CHỐT (số liệu có thể còn thay đổi)')],['Mã NV','Họ và tên','Bộ phận','Chức vụ','Trạng thái','Số công (đã quy đổi 8h TC = 1 công)','Giờ tăng ca ghi nhận','Giờ tăng ca dư (<8h)','Số ngày có công','Số ngày nghỉ (0)','Nghỉ phép đã duyệt (ngày)']];
  model.rows.forEach(r=>pay.push([r.w.maNV||'', r.w.name||'', r.w.boPhan||'', r.w.chucVu||'', r.w.trangThai||'Đang làm', r.stats.congUnits, r.stats.otRaw, r.stats.otRest, r.stats.workedDays, r.stats.offDays, r.stats.leaveDays]));
  if(!attXlsxReady(fname, sum)) return;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, attBangCongSheet(model), 'BangCong');
  XLSX.utils.book_append_sheet(wb, attSheet(sum,[5,9,24,14,14,14,12,14,14,14,14,12,14]), 'TongCong_TangCa');
  XLSX.utils.book_append_sheet(wb, attSheet(off,[5,9,24,14,14,34,36]), 'NgayNghi');
  XLSX.utils.book_append_sheet(wb, attSheet(mis,[5,9,24,14,12,34,50]), 'ThieuDuLieu');
  XLSX.utils.book_append_sheet(wb, attSheet(pay,[9,24,14,14,12,18,14,14,12,12,14]), 'SoLieuLuong');
  XLSX.writeFile(wb, fname); showToast('✅ Đã xuất báo cáo chấm công tháng '+model.m+'/'+model.y);
}
// ── Bảng công từng nhân viên (Excel) ──
function attWorkerDayRows(w, model){
  const row = (DB.attendance[model.ym]||{})[w.id] || {}, leave = attLeaveDays(w, model.ym, DB.nghiPhep||[]), out = [];
  for(let d=1; d<=model.n; d++){
    const ds = attDateStr(model.ym,d), i = attCellInfo(row[d]), tag = [];
    if(attIsSunday(model.ym,d)) tag.push('Chủ nhật'); if(model.hol[ds]) tag.push(model.hol[ds]); if(leave[d]) tag.push('Nghỉ phép: '+leave[d]);
    out.push({d, ds, wd:weekdayVN(model.y,model.m,d), raw:row[d]!==undefined?row[d]:'', info:i, tag:tag.join(' · ')});
  }
  return out;
}
function exportWorkerAttendance(wid, ym){
  if(guardViewer()) return;
  const w = (DB.workers||[]).find(x=>x.id===wid); if(!w) return;
  const model = attBuildModel(ym || curYM(), {dept:'all',shift:'all',status:'all',q:''}); const r = model.rows.find(x=>x.w.id===wid) || {stats: attWorkerMonthStats(w, (DB.attendance[model.ym]||{})[wid], model.ctx)};
  const rows = [[`BẢNG CÔNG CÁ NHÂN THÁNG ${model.m}/${model.y}`],['Họ và tên: '+(w.name||''), 'Mã NV: '+(w.maNV||''), 'Bộ phận: '+(w.boPhan||''), 'Chức vụ: '+(w.chucVu||'')],[],['Ngày','Thứ','Giá trị chấm','Số công','Giờ tăng ca','Ghi chú']];
  attWorkerDayRows(w, model).forEach(x=>rows.push([x.d+'/'+model.m, x.wd, x.raw, x.info.state==='ok'?x.info.cong:'', x.info.state==='ok'&&x.info.ot?x.info.ot:'', x.tag]));
  rows.push([]); rows.push(['Tổng công (quy ước)', r.stats.congStr]); rows.push(['Số công (đã quy đổi)', r.stats.congUnits]); rows.push(['Giờ tăng ca ghi nhận', r.stats.otRaw]); rows.push(['Số ngày nghỉ (0)', r.stats.offDays]);
  const fname = `Cham_cong_${(w.maNV||w.name||'NV').toString().replace(/\s+/g,'_')}_${model.ym}.xlsx`;
  if(!attXlsxReady(fname, rows)) return;
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, attSheet(rows,[12,8,14,10,12,34],[{s:{r:0,c:0},e:{r:0,c:5}}]), 'CongCaNhan'); XLSX.writeFile(wb, fname);
  showToast('✅ Đã xuất bảng công của '+(w.name||'nhân viên'));
}

// ── In A4/A3 ──
function attPrintCss(size, landscape){
  return `@page{ size:${size} ${landscape?'landscape':'portrait'}; margin:8mm 8mm 10mm; }
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0}
    .hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}
    .co{font-weight:700;font-size:12px;letter-spacing:.5px}.co small{display:block;font-weight:400;font-size:10px;color:#444}
    h1{text-align:center;font-size:16px;margin:2px 0 2px;text-transform:uppercase}
    .sub{text-align:center;font-size:11px;margin-bottom:8px;color:#222}
    table{border-collapse:collapse;width:100%;font-size:9.5px;table-layout:fixed}
    th,td{border:1px solid #000;padding:2px 2px;text-align:center;overflow:hidden}
    th{background:#e8ecf4;font-weight:700} td.l{text-align:left;white-space:nowrap;padding-left:4px}
    .wd{display:block;font-size:7.5px;color:#444}.sun,.sunc{background:#fbe4e1}.hol,.holc{background:#fff0cf}.tot{font-weight:700;background:#f2f2f2}
    .grp td{background:#dfe6f5;font-weight:700;text-align:left;padding:3px 6px}
    .page-b{page-break-before:always}
    .foot{margin-top:10px;font-size:10.5px}.sign{display:flex;justify-content:space-around;margin-top:16px;text-align:center;font-size:11px}.sign div{width:30%}.sign i{display:block;height:54px}
    .legend{margin-top:6px;font-size:9.5px;line-height:1.5;color:#222}
    thead{display:table-header-group} tr{page-break-inside:avoid}`;
}
function attSignBlock(){
  return `<div class="sign"><div><b>Người lập bảng</b><br><small>(Ký, ghi rõ họ tên)</small><i></i></div><div><b>Trưởng bộ phận</b><br><small>(Ký, ghi rõ họ tên)</small><i></i></div><div><b>Giám đốc</b><br><small>(Ký, đóng dấu)</small><i></i></div></div>`;
}
function printAttendance(size){
  if(guardViewer()) return;
  size = (size==='A3') ? 'A3' : 'A4';
  const model = attBuildModel(); if(!model.rows.length){ showToast('⚠️ Không có dữ liệu để in (kiểm tra bộ lọc)', true); return; }
  const {y, m, n, ym} = model, dayCols = Array.from({length:n},(_,i)=>i+1);
  const head = `<thead><tr><th style="width:22px">STT</th><th style="width:44px">Mã NV</th><th style="width:118px">Họ và tên</th><th style="width:62px">Bộ phận</th>
    ${dayCols.map(d=>{ const ds=attDateStr(ym,d); return `<th class="${attIsSunday(ym,d)?'sun':model.hol[ds]?'hol':''}">${d}<span class="wd">${weekdayVN(y,m,d)}</span></th>`; }).join('')}
    <th style="width:34px">Tổng công</th><th style="width:28px">Giờ TC</th><th style="width:26px">Nghỉ</th></tr></thead>`;
  const tr = (r,i)=>`<tr><td>${i+1}</td><td>${attEsc(r.w.maNV||'')}</td><td class="l">${attEsc(r.w.name||'')}</td><td>${attEsc(r.w.boPhan||'')}</td>
    ${dayCols.map(d=>{ const ds=attDateStr(ym,d); return `<td class="${attIsSunday(ym,d)?'sunc':model.hol[ds]?'holc':''}">${attEsc(r.row[d]!==undefined?r.row[d]:'')}</td>`; }).join('')}
    <td class="tot">${attEsc(r.stats.congStr)}</td><td>${r.stats.otRaw||''}</td><td>${r.stats.offDays||''}</td></tr>`;
  const groups = {}; model.rows.forEach(r=>{ const k=(r.w.boPhan||'').trim()||'(Chưa có bộ phận)'; (groups[k]=groups[k]||[]).push(r); });
  const keys = Object.keys(groups).sort(), multi = _attFilter.dept==='all' && keys.length>1;
  const body = multi ? keys.map((k,gi)=>`<div class="${gi?'page-b':''}"><div class="sub"><b>Bộ phận: ${attEsc(k)}</b></div><table>${head}<tbody>${groups[k].map(tr).join('')}</tbody></table>${gi===keys.length-1?'':attSignBlock()}</div>`).join('')
                     : `<table>${head}<tbody>${model.rows.map(tr).join('')}</tbody></table>`;
  const a = model.agg;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bảng chấm công ${m}/${y}</title><style>${attPrintCss(size,true)}</style></head><body>
    <div class="hd"><div class="co">ĐÔNG PHƯƠNG<small>Bảng chấm công</small></div><div style="font-size:10px;text-align:right">${model.locked?'Kỳ đã chốt lúc '+attEsc(vnDateTimeShort(model.locked.at)):'Kỳ chưa chốt'}<br>In lúc ${attEsc(vnDateTimeShort(new Date()))}</div></div>
    <h1>Bảng chấm công tháng ${m} năm ${y}</h1>
    <div class="sub">${_attFilter.dept!=='all'?('Bộ phận: <b>'+attEsc(_attFilter.dept)+'</b> · '):''}${a.workers} nhân viên · Tổng công: <b>${a.congUnits}</b> · Giờ tăng ca: <b>${a.otRaw}h</b> · Ngày nghỉ: <b>${a.offDays}</b></div>
    ${body}
    <div class="legend"><b>Ghi chú:</b> Đủ công = 1 · Nửa công = 0.5 · Nghỉ = 0 · Tăng ca ghi sau dấu chấm (1.2 = 1 công + 2 giờ) · Đủ 8 giờ tăng ca quy đổi 1 công. Nền hồng = Chủ nhật, nền vàng = ngày lễ.</div>
    ${attSignBlock()}</body></html>`;
  attOpenPrint(html);
}
function printWorkerAttendance(wid, ym){
  if(guardViewer()) return;
  const w = (DB.workers||[]).find(x=>x.id===wid); if(!w) return;
  const model = attBuildModel(ym || curYM(), {dept:'all',shift:'all',status:'all',q:''}); const st = attWorkerMonthStats(w, (DB.attendance[model.ym]||{})[wid], model.ctx);
  const rows = attWorkerDayRows(w, model).map(x=>`<tr class="${attIsSunday(model.ym,x.d)?'sunc':model.hol[x.ds]?'holc':''}"><td>${x.d}/${model.m}</td><td>${x.wd}</td><td>${attEsc(x.raw)}</td><td>${x.info.state==='ok'?x.info.cong:''}</td><td>${x.info.state==='ok'&&x.info.ot?x.info.ot:''}</td><td class="l">${attEsc(x.tag)}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bảng công ${attEsc(w.name||'')} ${model.m}/${model.y}</title><style>${attPrintCss('A4',false)} table{font-size:11px} td{padding:3px 5px}</style></head><body>
    <div class="hd"><div class="co">ĐÔNG PHƯƠNG<small>Bảng công cá nhân</small></div><div style="font-size:10px;text-align:right">In lúc ${attEsc(vnDateTimeShort(new Date()))}</div></div>
    <h1>Bảng công tháng ${model.m} năm ${model.y}</h1>
    <div class="sub">Họ và tên: <b>${attEsc(w.name||'')}</b> · Mã NV: <b>${attEsc(w.maNV||'')}</b> · Bộ phận: <b>${attEsc(w.boPhan||'')}</b> · Chức vụ: <b>${attEsc(w.chucVu||'')}</b></div>
    <table><thead><tr><th>Ngày</th><th>Thứ</th><th>Giá trị chấm</th><th>Số công</th><th>Giờ TC</th><th>Ghi chú</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="foot">Tổng công (quy ước): <b>${attEsc(st.congStr)}</b> · Số công đã quy đổi: <b>${st.congUnits}</b> · Giờ tăng ca: <b>${st.otRaw}h</b> · Ngày nghỉ: <b>${st.offDays}</b></div>
    ${attSignBlock()}</body></html>`;
  attOpenPrint(html);
}
function attOpenPrint(html){
  const w = window.open('', '_blank');
  if(!w){ showToast('❌ Trình duyệt chặn cửa sổ in, vui lòng cho phép popup', true); return; }
  w.document.open(); w.document.write(html); w.document.close();
  w.onload = ()=>{ w.focus(); w.print(); };
}
