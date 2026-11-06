// src/modules/trace/trace-export.js — Giai đoạn 3: xuất kết quả truy xuất ra CSV (CHỈ ĐỌC)
// Dùng lại trSearch() (hàm thuần, không ghi dữ liệu). CSV có BOM UTF-8 để Excel đọc đúng tiếng Việt;
// ô bắt đầu bằng = + - @ được thêm dấu ' phía trước để tránh bị Excel hiểu là công thức.
function trCsvCell(v){
  let s = (v===undefined||v===null) ? '' : String(v);
  if(/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g,'""') + '"';
}
function trBuildCsvRows(res){
  const H = ['Nhóm','Ngày','Mã PO / Mã QR','Khách hàng','Quy cách / Nguyên liệu / Sản phẩm','Heat-Lot','Mã lô SX','Số lượng','Ghi chú'];
  const rows = [H];
  const add = (grp, P) => {
    (P.orders||[]).forEach(o=>rows.push([grp+' · Đơn hàng', o.createdAt?new Date(o.createdAt).toISOString().slice(0,10):'', o.po||'', o.customer||'', o.type||'', '', '', o.qty||'', (typeof ddStatusMeta==='function'?ddStatusMeta(o).label:o.status||'')]));
    (P.nl||[]).forEach(r=>rows.push([grp+' · Sổ nguyên liệu', r.ngay||'', r.po||'', r.khachHang||'', r.nguyenLieu||'', r.heatLot||'', r.maLoSX||'', r.soLuong||'', r.may||'']));
    (P.rut||[]).forEach(r=>rows.push([grp+' · Sổ máy rút', r.ngay||'', '', r.khachHang||'', r.quyCach||'', r.heatLot||'', r.maLoSX||'', r.soThanh||'', r.may||'']));
    (P.db||[]).forEach(r=>rows.push([grp+' · Sổ đánh bóng + cắt', r.ngay||'', '', r.khachHang||'', r.quyCach||'', r.heatLot||'', r.maLoSX||'', r.soThanh||'', [r.congDoan,r.may].filter(Boolean).join(' / ')]));
    (P.qr||[]).forEach(p=>rows.push([grp+' · QR / thành phẩm', '', p.qrCode||'', '', p.productName||p.productCode||'', '', '', p.quantity||'', [p.currentStage, p.qcResult].filter(Boolean).join(' / ')]));
  };
  if(res.primary) add('Liên kết trực tiếp', res.primary);
  if(res.related) add('Dùng chung lô (có thể liên quan)', res.related);
  return rows;
}
function trExportCsv(){
  const q = (_trQ||'').trim();
  if(!q){ showToast('Nhập mã và tìm trước khi xuất', true); return; }
  let res; try{ res = trSearch(q); }catch(e){ console.warn('[trace-export]', e); showToast('Không xuất được kết quả', true); return; }
  const rows = trBuildCsvRows(res);
  if(rows.length<2){ showToast('Không có kết quả để xuất', true); return; }
  const csv = '\ufeff' + rows.map(r=>r.map(trCsvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a');
  const safe = q.replace(/[^\w\-]+/g,'_').slice(0,40) || 'ket-qua';
  a.href = url; a.download = `TruyXuat_${safe}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 2000);
  showToast(`✅ Đã xuất ${rows.length-1} dòng`);
}
// Gắn nút sau mỗi lần tìm có kết quả (bọc trRun; hàm gốc giữ nguyên)
dpEnhanceRender('trRun', ()=>{
  const box = document.getElementById('trResult'); if(!box) return;
  const old = document.getElementById('trExportBar'); if(old) old.remove();
  if(!(_trQ||'').trim() || !box.querySelector('.tr-sec')) return;
  const bar = document.createElement('div'); bar.id = 'trExportBar'; bar.className = 'dp-strip';
  bar.innerHTML = '<button class="ds-btn sm" onclick="trExportCsv()">📥 Xuất kết quả CSV</button> <span class="dp-hint" style="display:inline">Gồm đơn, dòng sổ, QR trực tiếp và nhóm dùng chung lô.</span>';
  box.insertBefore(bar, box.firstChild);
});
