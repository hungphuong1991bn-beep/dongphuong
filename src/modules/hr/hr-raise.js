// src/modules/hr/hr-raise.js — v2.10.0: tab "📈 Tăng lương" (CHỈ ADMIN) — ghi nhận tăng lương theo ngày hiệu lực.
// Dữ liệu + quy tắc nằm ở hr-salary.js (hrRaise*). File này chỉ lo giao diện. Tài khoản khác Admin: không dựng gì.

let _rsYear = 'all';       // 'all' | '2026' ...
let _rsWorker = 'all';
let _rsSearch = '';       // ô tìm trong bảng "Mức lương hiện tại"

function rsMoney(n){ return _nsShowSalary ? Number(n || 0).toLocaleString('vi-VN') : '••••••'; }

function rsYears(){
  const set = new Set([String(new Date().getFullYear())]);
  hrRaiseList().forEach(r => { if(r.date) set.add(r.date.slice(0, 4)); });
  return Array.from(set).sort().reverse();
}
function rsFiltered(){
  return hrRaiseList().filter(r => (_rsYear === 'all' || (r.date || '').slice(0, 4) === _rsYear) && (_rsWorker === 'all' || r.workerId === _rsWorker))
    .slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function renderRaiseList(){
  if(!hrSalaryCan()) return '';
  const all = hrRaiseList();
  if(!all.length) return `<div style="text-align:center;color:var(--text4);padding:18px;font-size:13px">Chưa có lần tăng lương nào · bấm "➕ Ghi nhận tăng lương"</div>`;
  const list = rsFiltered();
  if(!list.length) return `<div style="text-align:center;color:var(--text4);padding:18px;font-size:13px">Không có lần tăng lương nào khớp bộ lọc</div>`;
  const today = todayStr();
  const pcts = list.filter(r => r.from > 0 && r.to > r.from).map(r => (r.to - r.from) / r.from * 100);
  const avg = pcts.length ? (pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
  const nWorkers = new Set(list.map(r => r.workerId)).size;
  return `<div style="font-size:12px;color:var(--text3);margin-bottom:8px">${list.length} lượt · ${nWorkers} nhân viên${pcts.length ? ' · trung bình <b>+' + avg.toFixed(1) + '%</b>' : ''}</div>
  <div style="overflow-x:auto"><table class="ns-table" style="min-width:760px">
    <thead><tr><th>Ngày hiệu lực</th><th>Nhân viên</th><th style="text-align:right">Lương cũ</th><th style="text-align:right">Lương mới</th><th style="text-align:right">Chênh lệch</th><th>Lý do</th><th style="text-align:center">Trạng thái</th><th style="width:40px"></th></tr></thead>
    <tbody>${list.map(r => {
      const diff = r.to - r.from, pct = r.from > 0 ? (Math.abs(diff) / r.from * 100).toFixed(1) : '', neg = diff < 0;
      const pending = r.date > today;
      return `<tr>
        <td style="white-space:nowrap;font-weight:600">${nsEsc(fmtDate(r.date))}</td>
        <td style="font-weight:600">${nsEsc(r.workerName || '')}</td>
        <td style="text-align:right;color:var(--text3)">${r.from ? rsMoney(r.from) : '—'}</td>
        <td style="text-align:right;font-weight:700">${rsMoney(r.to)}</td>
        <td style="text-align:right;color:${neg ? '#dc2626' : '#16a34a'};font-weight:700;white-space:nowrap">${_nsShowSalary ? (neg ? '−' : '+') + Math.abs(diff).toLocaleString('vi-VN') : '••••'}${pct ? ' <span style="font-weight:500;font-size:11px">(' + (neg ? '−' : '+') + pct + '%)</span>' : ''}</td>
        <td style="max-width:200px;color:var(--text3)">${neg || r.kind === 'adjust' ? '<span class="ns-badge" style="background:#fee2e2;color:#b91c1c;margin-right:4px">Điều chỉnh</span>' : ''}${nsEsc(r.lydo || r.reason || '')}</td>
        <td style="text-align:center"><span class="ns-badge" style="background:${pending ? '#fef3c7' : '#dcfce7'};color:${pending ? '#b45309' : '#166534'}">${pending ? '⏳ Chờ hiệu lực' : '✓ Đã áp dụng'}</span></td>
        <td style="text-align:center"><button class="icon-btn del" onclick="deleteRaise('${nsEsc(r.id)}')" title="Xoá lần ghi nhận" style="font-size:13px">🗑</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

// ── Bảng MỨC LƯƠNG HIỆN TẠI của từng nhân viên (v2.11.0): chỗ duy nhất để cập nhật lương ──
function rsCurrentRows(){
  const q = (typeof normalizeKhuonSearch === 'function' ? normalizeKhuonSearch(_rsSearch) : String(_rsSearch || '').toLowerCase().trim());
  const norm = s => (typeof normalizeKhuonSearch === 'function' ? normalizeKhuonSearch(s) : String(s || '').toLowerCase());
  return (DB.workers || []).filter(w => nsStatusOf(w) !== 'Đã nghỉ việc')
    .filter(w => !q || norm([w.name, w.maNV, w.boPhan, w.chucVu].join(' ')).includes(q))
    .slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi'));
}
function renderCurrentSalary(){
  if(!hrSalaryCan()) return '';
  const rows = rsCurrentRows(), today = todayStr();
  if(!rows.length) return `<div style="text-align:center;color:var(--text4);padding:14px;font-size:13px">Không có nhân viên nào khớp</div>`;
  return `<div style="overflow-x:auto"><table class="ns-table" style="min-width:640px">
    <thead><tr><th>Nhân viên</th><th>Bộ phận</th><th style="text-align:right">Mức lương hiện tại</th><th>Hiệu lực từ</th><th style="width:130px"></th></tr></thead>
    <tbody>${rows.map(w => {
      const cur = hrSalaryGet(w.id), last = hrRaiseLast(w.id);
      const next = hrRaiseList(w.id).find(r => r.date > today);
      return `<tr>
        <td style="font-weight:600">${nsEsc(w.name || '(Chưa đặt tên)')}${w.maNV ? `<span style="color:var(--text4);font-weight:400"> · ${nsEsc(w.maNV)}</span>` : ''}</td>
        <td style="font-size:12.5px">${nsEsc(w.boPhan || '—')}</td>
        <td style="text-align:right;font-weight:700;white-space:nowrap">${cur ? rsMoney(cur) : '<span style="color:var(--text4);font-weight:400">Chưa có</span>'}${next ? `<div style="font-size:10.5px;font-weight:500;color:#b45309">⏳ ${rsMoney(next.to)} từ ${nsEsc(fmtDate(next.date))}</div>` : ''}</td>
        <td style="font-size:12px;white-space:nowrap;color:var(--text3)">${last ? nsEsc(fmtDate(last.date)) : '—'}</td>
        <td style="text-align:center"><button class="ns-chip" style="white-space:nowrap" onclick="openRaiseForm('${nsEsc(w.id)}')">${cur ? '✏️ Cập nhật lương' : '➕ Thiết lập lương'}</button></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}
function rsRefreshCurrent(){ const el = document.getElementById('rsCurList'); if(el) el.innerHTML = renderCurrentSalary(); }
function rsSetSearch(v){ _rsSearch = v || ''; rsRefreshCurrent(); }
function rsRefreshList(){ const el = document.getElementById('raiseList'); if(el) el.innerHTML = renderRaiseList(); }
function rsSetFilter(k, v){ if(k === 'year') _rsYear = v; else _rsWorker = v; rsRefreshList(); }

// Nội dung panel (chỉ Admin; non-Admin trả chuỗi rỗng)
function renderRaisePanel(){
  if(!hrSalaryCan()) return '';
  const workers = (DB.workers || []).filter(w => nsStatusOf(w) !== 'Đã nghỉ việc');
  const years = rsYears();
  return `<div class="card" style="padding:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <div style="font-weight:700;font-size:15px;color:#7c3aed">📈 Mức lương &amp; lịch sử tăng lương <span style="font-weight:500;font-size:11px;color:var(--text4)">🔒 chỉ Admin thấy</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="ns-chip" onclick="nsToggleSalary(event)">${_nsShowSalary ? '🙈 Ẩn số tiền' : '👁 Hiện số tiền'}</button>
        <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer" onclick="exportRaisesExcel()">📥 Xuất Excel</button>
        <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px;background:#7c3aed;color:#fff;font-weight:700;border:none;cursor:pointer" onclick="openRaiseForm()">✏️ Cập nhật mức lương</button>
      </div>
    </div>
    <div id="raiseForm" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px">
      <div style="font-weight:700;font-size:13px;margin-bottom:10px">📝 Cập nhật mức lương hiện tại</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Nhân viên *</label>
          <select id="rs_worker" class="field-inp" style="width:100%" onchange="rsHint()">
            <option value="">-- Chọn nhân viên --</option>
            ${workers.map(w => `<option value="${nsEsc(w.id)}">${nsEsc(w.name || '(Chưa đặt tên)')}${w.maNV ? ' · ' + nsEsc(w.maNV) : ''}</option>`).join('')}
          </select></div>
        <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Ngày hiệu lực * <span style="color:var(--text4)">(ngày/tháng/năm bắt đầu hưởng lương mới)</span></label>
          <input type="date" id="rs_date" class="field-inp" style="width:100%" value="${todayStr()}"></div>
        <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Mức lương mới (VNĐ) * <span style="color:var(--text4)">(sẽ thành "mức lương hiện tại" từ ngày hiệu lực)</span></label>
          <input type="number" id="rs_to" class="field-inp" style="width:100%" min="0" inputmode="numeric" placeholder="VD: 7000000" autocomplete="off" oninput="rsHint()"></div>
        <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Lý do / ghi chú</label>
          <input type="text" id="rs_reason" class="field-inp" style="width:100%" placeholder="VD: Tăng lương định kỳ, nâng bậc..."></div>
      </div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text3);margin-top:10px;cursor:pointer"><input type="checkbox" id="rs_adjust"> Điều chỉnh / giảm lương (sửa nhập sai, hạ bậc — không phải tăng lương)</label>
      <div id="rs_hint" style="font-size:12px;color:var(--text3);margin-top:8px"></div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="set-btn" style="width:auto;padding:9px 18px;background:#7c3aed;color:#fff;font-weight:700;border:none;cursor:pointer" onclick="saveRaise()">💾 Lưu</button>
        <button class="set-btn" style="width:auto;padding:9px 14px;border:none;cursor:pointer" onclick="closeRaiseForm()">✕ Hủy</button>
      </div>
    </div>
    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <div style="font-weight:700;font-size:13px">💰 Mức lương hiện tại của từng nhân viên</div>
        <input id="rsSearch" class="field-inp" style="width:auto;min-width:180px;flex:1;max-width:280px" placeholder="🔎 Tìm tên, mã NV, bộ phận..." value="${nsEsc(_rsSearch)}" oninput="rsSetSearch(this.value)">
      </div>
      <div id="rsCurList">${renderCurrentSalary()}</div>
    </div>
    <div style="font-weight:700;font-size:13px;margin-bottom:8px">🕘 Lịch sử thay đổi mức lương</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <select id="rsFilterYear" class="field-inp" style="width:auto" onchange="rsSetFilter('year', this.value)">
        <option value="all">Tất cả các năm</option>
        ${years.map(y => `<option value="${y}" ${_rsYear === y ? 'selected' : ''}>Năm ${y}</option>`).join('')}
      </select>
      <select id="rsFilterWorker" class="field-inp" style="width:auto;max-width:240px" onchange="rsSetFilter('worker', this.value)">
        <option value="all">Tất cả nhân viên</option>
        ${(DB.workers || []).map(w => `<option value="${nsEsc(w.id)}" ${_rsWorker === w.id ? 'selected' : ''}>${nsEsc(w.name || '(Chưa đặt tên)')}</option>`).join('')}
      </select>
    </div>
    <div id="raiseList">${renderRaiseList()}</div>
  </div>`;
}

function rsHint(){
  const el = document.getElementById('rs_hint'); if(!el) return;
  const wid = (document.getElementById('rs_worker') || {}).value, to = hrSalaryNum((document.getElementById('rs_to') || {}).value);
  if(!wid){ el.textContent = ''; return; }
  const cur = hrSalaryGet(wid);
  let t = cur ? 'Lương hiện tại: ' + cur.toLocaleString('vi-VN') + ' VNĐ' : 'Nhân viên này chưa có mức lương — lần lưu này sẽ THIẾT LẬP mức lương ban đầu';
  if(cur && to > cur) t += ' → tăng +' + (to - cur).toLocaleString('vi-VN') + ' (+' + ((to - cur) / cur * 100).toFixed(1) + '%)';
  else if(cur && to && to < cur) t += ' → thấp hơn ' + (cur - to).toLocaleString('vi-VN') + ' — tích "Điều chỉnh / giảm lương" để lưu';
  el.textContent = t;
}
function openRaiseForm(wid){
  if(!hrSalaryCan()) return;
  const f = document.getElementById('raiseForm'); if(!f) return;
  const set = (id, v) => { const e = document.getElementById(id); if(e) e.value = v; };
  set('rs_worker', wid || ''); set('rs_date', todayStr()); set('rs_to', ''); set('rs_reason', ''); const _adj = document.getElementById('rs_adjust'); if(_adj) _adj.checked = false; rsHint();
  f.style.display = 'block'; f.scrollIntoView({behavior: 'smooth', block: 'start'});
}
function closeRaiseForm(){ const f = document.getElementById('raiseForm'); if(f) f.style.display = 'none'; }
// Từ hồ sơ nhân viên → mở thẳng form tăng lương cho người đó
function nsOpenRaiseForm(wid){
  if(!hrSalaryCan()) return;
  if(typeof closeWorkerProfile === 'function') closeWorkerProfile();
  goNsTab('tangluong'); openRaiseForm(wid);
}

function saveRaise(){
  if(guardViewer()) return;
  if(!hrSalaryCan()){ showToast('🔒 Chỉ Admin mới có quyền ghi nhận tăng lương', true); return; }
  const v = id => (document.getElementById(id) || {}).value;
  const res = hrRaiseAdd({workerId: v('rs_worker'), date: v('rs_date'), to: v('rs_to'), reason: v('rs_reason'), adjust: !!(document.getElementById('rs_adjust') || {}).checked});
  if(!res.ok){ showToast('⚠️ ' + res.error, true); return; }
  const r = res.raise;
  log(r.kind === 'adjust' ? 'Điều chỉnh lương' : 'Tăng lương', `${r.workerName || '?'} · hiệu lực ${r.date} (số tiền không ghi vào nhật ký)`, '');
  showToast(r.date > todayStr() ? '✅ Đã lưu — sẽ tự áp dụng từ ngày ' + fmtDate(r.date) : '✅ Đã cập nhật mức lương hiện tại');
  closeRaiseForm();
  renderNhanSu();
}
function deleteRaise(id){
  if(guardViewer() || !hrSalaryCan()) return;
  confirm2('Xoá lần ghi nhận tăng lương', 'Chỉ xoá bản ghi lịch sử này. Mức lương hiện tại của nhân viên KHÔNG bị đổi lại — nếu cần đổi, hãy cập nhật mức lương mới (tích \"Điều chỉnh / giảm lương\" nếu thấp hơn). Tiếp tục?', () => {
    if(hrRaiseDelete(id)){ log('Xoá ghi nhận tăng lương', '', ''); showToast('🗑️ Đã xoá'); renderNhanSu(); }
  });
}

// Xuất Excel theo bộ lọc năm/nhân viên (chỉ Admin)
async function exportRaisesExcel(){
  if(guardViewer() || !hrSalaryCan()) return;
  const list = rsFiltered();
  if(!list.length){ showToast('⚠️ Không có dữ liệu tăng lương để xuất (kiểm tra bộ lọc)', true); return; }
  if(typeof attExcelReady !== 'function' || !(await attExcelReady())) return;
  try{
    const rows = [['LỊCH SỬ TĂNG LƯƠNG' + (_rsYear !== 'all' ? ' NĂM ' + _rsYear : '')], ['Xuất ngày ' + fmtDate(todayStr()) + ' · ' + list.length + ' lượt'],
      ['STT', 'Ngày hiệu lực', 'Nhân viên', 'Lương cũ (VNĐ)', 'Lương mới (VNĐ)', 'Chênh lệch (VNĐ)', '% tăng', 'Lý do', 'Trạng thái']];
    list.forEach((r, i) => rows.push([i + 1, fmtDate(r.date), r.workerName || '', r.from || '', r.to, r.to - r.from, r.from > 0 ? +((r.to - r.from) / r.from * 100).toFixed(1) : '', (r.kind === 'adjust' || r.to < r.from ? '[Điều chỉnh] ' : '') + (r.reason || ''), r.date > todayStr() ? 'Chờ hiệu lực' : 'Đã áp dụng']));
    const wb = new ExcelJS.Workbook();
    const ws = attAddSheet(wb, 'Tang_luong', rows, {widths: [5, 14, 24, 15, 15, 15, 8, 28, 14], mergeRows: [1, 2], freezeY: 3, hdr: 3, last: rows.length, leftCols: [3, 8]});
    for(let r = 4; r <= rows.length; r++){ [4, 5, 6].forEach(c => { ws.getCell(r, c).numFmt = '#,##0'; }); }
    await attDownloadWb(wb, 'Lich_su_tang_luong_' + (_rsYear !== 'all' ? _rsYear : 'tat_ca') + '.xlsx');
    log('Xuất lịch sử tăng lương', list.length + ' lượt', '');
    showToast('✅ Đã xuất ' + list.length + ' lượt tăng lương');
  }catch(e){ console.error(e); showToast('❌ Xuất Excel lỗi: ' + (e && e.message || e), true); }
}
