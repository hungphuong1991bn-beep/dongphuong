// src/modules/hr/hr-insight.js — v2.9.0: nâng cấp tab Quản lý nhân sự
// Hàm tính toán + tiện ích dùng cho Danh sách NV / Hồ sơ / Nghỉ phép / Kỷ luật / Thống kê.
// KHÔNG ghi dữ liệu ở file này (trừ log khi xuất Excel). Lương luôn đi qua hr-salary.js (chỉ Admin).

const NS_DEFAULT_DEPTS = ['Thanh Cái','Lò','Kéo','Kho','Băm ép','Aomaga'];
const NS_DEFAULT_POSITIONS = ['Công nhân','Tổ trưởng','Trưởng ca','Quản đốc','Kế toán','Bảo vệ','Lái xe','Kỹ thuật/Bảo trì'];

function nsEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function nsStatusOf(w){ return (w && w.trangThai) || 'Đang làm'; }
function nsIsActive(w){ return nsStatusOf(w) === 'Đang làm'; }

// 'YYYY-MM-DD' → {y,m,d} (không dùng new Date(string) để khỏi lệch múi giờ)
function nsParseYMD(s){ const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? {y:+m[1], m:+m[2], d:+m[3]} : null; }

// Số tháng làm việc: từ ngày vào làm → hôm nay (hoặc ngày nghỉ việc nếu đã nghỉ). -1 nếu chưa có ngày vào làm
function nsSeniorityMonths(w, todayYmd){
  const a = nsParseYMD(w && w.ngayVaoLam);
  if(!a) return -1;
  const endStr = (nsStatusOf(w) === 'Đã nghỉ việc' && w.ngayNghiViec) ? w.ngayNghiViec : (todayYmd || todayStr());
  const b = nsParseYMD(endStr);
  if(!b) return -1;
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if(b.d < a.d) months--;
  return months < 0 ? 0 : months;
}
function nsSeniorityText(w, todayYmd){
  const mo = nsSeniorityMonths(w, todayYmd);
  if(mo < 0) return '';
  if(mo < 1) return '< 1 tháng';
  const y = Math.floor(mo / 12), r = mo % 12;
  if(!y) return r + ' tháng';
  return r ? (y + ' năm ' + r + ' tháng') : (y + ' năm');
}

// Hồ sơ đang làm việc mà thiếu thông tin quan trọng → danh sách nhãn còn thiếu
function nsMissingFields(w){
  if(!w || !nsIsActive(w)) return [];
  const miss = [];
  if(!(w.name || '').trim()) miss.push('Họ tên');
  if(!(w.boPhan || '').trim()) miss.push('Bộ phận');
  if(!(w.chucVu || '').trim()) miss.push('Chức vụ');
  if(!(w.sdt || '').trim()) miss.push('SĐT');
  if(!w.ngayVaoLam) miss.push('Ngày vào làm');
  return miss;
}

// Ngày sinh rơi vào tháng đang xét (mặc định tháng hiện tại) → trả số ngày trong tháng, 0 nếu không
function nsBirthdayDay(w, month){
  const b = nsParseYMD(w && w.ngaySinh);
  if(!b) return 0;
  const m = month || (nsParseYMD(todayStr()) || {}).m;
  return b.m === m ? b.d : 0;
}

// Số ngày của 1 đơn nghỉ (tính cả ngày đầu và ngày cuối)
function nsLeaveDays(k){
  const a = nsParseYMD(k && k.fromDate), b = nsParseYMD(k && (k.toDate || k.fromDate));
  if(!a || !b) return 0;
  const da = Date.UTC(a.y, a.m - 1, a.d), db = Date.UTC(b.y, b.m - 1, b.d);
  return db < da ? 0 : Math.round((db - da) / 86400000) + 1;
}
// Tập id nhân viên đang nghỉ phép HÔM NAY (chỉ tính đơn đã duyệt)
function nsOnLeaveTodayIds(){
  const t = todayStr(), set = new Set();
  (DB.nghiPhep || []).forEach(k => { if(k.status === 'Đã duyệt' && (k.fromDate || '') <= t && t <= (k.toDate || k.fromDate || '')) set.add(k.workerId); });
  return set;
}
// Đơn mới có trùng ngày với đơn khác (chưa bị từ chối) của cùng nhân viên không? Trả đơn trùng đầu tiên hoặc null
function nsFindLeaveOverlap(workerId, from, to, ignoreId){
  return (DB.nghiPhep || []).find(k => k.workerId === workerId && k.id !== ignoreId && k.status !== 'Từ chối'
    && (k.fromDate || '') <= to && from <= (k.toDate || k.fromDate || '')) || null;
}

// Danh sách bộ phận / chức vụ để lọc: mặc định + mọi giá trị đang dùng trong hồ sơ
function nsDeptList(){
  const set = new Set(NS_DEFAULT_DEPTS);
  (DB.workers || []).forEach(w => { const v = (w.boPhan || '').trim(); if(v) set.add(v); });
  return Array.from(set);
}
function nsPositionList(){
  const set = new Set(NS_DEFAULT_POSITIONS);
  (DB.workers || []).forEach(w => { const v = (w.chucVu || '').trim(); if(v) set.add(v); });
  return Array.from(set);
}
// Tên Việt: sắp theo TÊN (từ cuối) rồi họ tên đầy đủ
function nsNameSortKey(w){
  const n = (w.name || '').trim(); if(!n) return '￿';
  const parts = n.split(/\s+/);
  return parts[parts.length - 1] + ' ' + n;
}
function nsCmpVi(a, b){ return String(a).localeCompare(String(b), 'vi'); }

// ── Lịch sử trong hồ sơ nhân viên (chỉ đọc) ──
function renderWorkerHistoryHtml(w){
  if(!w) return '';
  const ym = curYM(), [y, m] = ym.split('-').map(Number);
  const leaves = (DB.nghiPhep || []).filter(k => k.workerId === w.id).slice().sort((a, b) => String(b.fromDate || '').localeCompare(String(a.fromDate || '')));
  const discs = (DB.kyLuat || []).filter(k => k.workerId === w.id).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const approvedDays = leaves.filter(k => k.status === 'Đã duyệt').reduce((s, k) => s + nsLeaveDays(k), 0);
  const sen = nsSeniorityText(w);
  const chip = (lbl, val, color) => `<div style="flex:1;min-width:92px;background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:8px 6px;text-align:center"><div style="font-size:15px;font-weight:800;color:${color || 'var(--brand)'}">${val}</div><div style="font-size:10.5px;color:var(--text3);margin-top:1px">${lbl}</div></div>`;
  const stC = {'Chờ duyệt':'#f59e0b','Đã duyệt':'#22c55e','Từ chối':'#ef4444'};
  const lvRows = leaves.slice(0, 5).map(k => `<div style="display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px"><span style="flex:1">${nsEsc(k.loai || 'Nghỉ phép')} · ${fmtDate(k.fromDate)}${k.toDate && k.toDate !== k.fromDate ? ' → ' + fmtDate(k.toDate) : ''} <span style="color:var(--text4)">(${nsLeaveDays(k)} ngày)</span></span><span class="ns-badge" style="color:#fff;background:${stC[k.status] || '#6b7280'}">${nsEsc(k.status || 'Chờ duyệt')}</span></div>`).join('');
  const dcRows = discs.slice(0, 5).map(k => `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px"><b style="color:#dc2626">${nsEsc(k.loai || 'Vi phạm')}</b><span style="flex:1;color:var(--text3)">${nsEsc(k.lydo || '')}</span><span style="color:var(--text4);white-space:nowrap">${fmtDate(k.date)}</span></div>`).join('');
  let raiseBlock = '';
  if(typeof hrSalaryCan === 'function' && hrSalaryCan()){
    const rs = hrRaiseList(w.id).slice().reverse();
    raiseBlock = `<div style="margin-top:10px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:2px"><div style="font-size:11.5px;font-weight:700;color:#7c3aed;flex:1">🔒 Lịch sử tăng lương (${rs.length})</div><button class="ns-chip" onclick="nsOpenRaiseForm('${nsEsc(w.id)}')">📈 Cập nhật lương</button></div>${rs.slice(0, 5).map(r => `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px"><b style="white-space:nowrap">${fmtDate(r.date)}</b><span style="flex:1;color:var(--text3)">${r.from ? r.from.toLocaleString('vi-VN') + ' → ' : ''}<b style="color:var(--text)">${r.to.toLocaleString('vi-VN')}</b>${r.reason ? ' · ' + nsEsc(r.reason) : ''}</span>${r.date > hrToday() ? '<span class="ns-badge" style="background:#fef3c7;color:#b45309">chờ hiệu lực</span>' : ''}</div>`).join('')}</div>`;
  }
  return `<div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--border)">
    <div style="font-size:12px;font-weight:800;color:var(--brand);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">📋 Tóm tắt & lịch sử</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${chip('Thâm niên', sen || '—')}
      ${chip('Công tháng ' + m + '/' + y, computeTotal(w.id) || 0, 'var(--green)')}
      ${chip('Nghỉ phép đã duyệt', approvedDays + ' ngày', 'var(--amber)')}
      ${chip('Kỷ luật', discs.length, discs.length ? '#dc2626' : 'var(--text4)')}
    </div>
    ${leaves.length ? `<div style="margin-top:10px"><div style="font-size:11.5px;font-weight:700;color:var(--text3);margin-bottom:2px">Nghỉ phép gần đây${leaves.length > 5 ? ' (5/' + leaves.length + ')' : ''}</div>${lvRows}</div>` : ''}
    ${raiseBlock}
    ${discs.length ? `<div style="margin-top:10px"><div style="font-size:11.5px;font-weight:700;color:var(--text3);margin-bottom:2px">Kỷ luật gần đây${discs.length > 5 ? ' (5/' + discs.length + ')' : ''}</div>${dcRows}</div>` : ''}
  </div>`;
}

// ── Xuất Excel danh sách nhân viên (theo đúng bộ lọc + sắp xếp đang chọn) ──
// Cột Lương hiện tại CHỈ có khi người xuất là Admin. Không xuất CCCD / số tài khoản.
async function exportWorkersExcel(){
  if(guardViewer()) return;
  const list = (typeof nsFilteredWorkers === 'function') ? nsFilteredWorkers() : (DB.workers || []);
  if(!list.length){ showToast('⚠️ Không có nhân viên để xuất (kiểm tra bộ lọc)', true); return; }
  if(typeof attExcelReady !== 'function' || !(await attExcelReady())) return;
  try{
    const admin = hrSalaryCan();
    const head = ['STT','Mã NV','Họ và tên','Giới tính','Ngày sinh','SĐT','Chức vụ','Bộ phận','Ngày vào làm','Thâm niên','Loại hợp đồng','Trạng thái'];
    if(admin) head.push('Lương hiện tại (VNĐ)');
    const rows = [['DANH SÁCH NHÂN VIÊN'], ['Xuất ngày ' + fmtDate(todayStr()) + ' · ' + list.length + ' người'], head];
    list.forEach((w, i) => {
      const r = [i + 1, w.maNV || '', w.name || '', w.gioiTinh || '', w.ngaySinh ? fmtDate(w.ngaySinh) : '', w.sdt || '', w.chucVu || '', w.boPhan || '',
        w.ngayVaoLam ? fmtDate(w.ngayVaoLam) : '', nsSeniorityText(w), w.loaiHopDong || '', nsStatusOf(w)];
      if(admin) r.push(hrSalaryGet(w.id) || '');
      rows.push(r);
    });
    const widths = [5, 10, 24, 9, 12, 14, 16, 14, 13, 14, 14, 13]; if(admin) widths.push(18);
    const wb = new ExcelJS.Workbook();
    const ws = attAddSheet(wb, 'Nhan_vien', rows, {widths, mergeRows:[1, 2], freezeY:3, hdr:3, last:rows.length, leftCols:[3, 6, 7, 8]});
    if(admin){ const c = widths.length; for(let r = 4; r <= rows.length; r++) ws.getCell(r, c).numFmt = '#,##0'; }
    await attDownloadWb(wb, 'Danh_sach_nhan_vien_' + todayStr() + '.xlsx');
    log('Xuất danh sách nhân sự', list.length + ' nhân viên' + (admin ? ' (kèm lương hiện tại)' : ''), '');
    showToast('✅ Đã xuất ' + list.length + ' nhân viên');
  }catch(e){ console.error(e); showToast('❌ Xuất Excel lỗi: ' + (e && e.message || e), true); }
}
