// src/modules/attendance/attendance-view.js  — GIAI ĐOẠN 1 (v2.6.0)
// ════════════════════════════════════════════════════════════
// CHẤM CÔNG — giao diện ERP: dashboard, bộ lọc, bảng cố định cột tên/tiêu đề ngày,
// phân biệt CN/lễ/ngày nghỉ, cảnh báo bất thường, khoá kỳ, nhật ký, trạng thái đồng bộ.
// Khối công thức parseCongValue / computeCongTotalStr / computeTotal GIỮ NGUYÊN VĂN từ bản gốc.
// Dữ liệu: DB.attendance[YYYY-MM][workerId][ngày] (không đổi) — ghi qua attendance-service.js.
// ════════════════════════════════════════════════════════════
let _attYM = null;
let _attAutoFollow = true;

// Bộ lọc giữ lại trong phiên (chuyển tab/tháng không mất); không lưu lâu dài.
let _attFilter = (function(){ try{ return Object.assign({dept:'all', shift:'all', status:'all', q:''}, JSON.parse(sessionStorage.getItem('sx_att_filter')||'{}')); }catch(e){ return {dept:'all', shift:'all', status:'all', q:''}; } })();
function attSaveFilter(){ try{ sessionStorage.setItem('sx_att_filter', JSON.stringify(_attFilter)); }catch(e){} }
let _attIssuesOpen = false;

function attEsc(s){ return s==null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function changeAttMonth(ym){
  if(!attValidYM(ym)) return;             // ô chọn tháng bị xoá trống → bỏ qua, không làm hỏng bảng
  _attYM = ym; _attAutoFollow = (ym===todayStr().slice(0,7)); renderChamCong();
}
function shiftAttMonth(delta){
  _attYM = attShiftYM(curYM(), delta);     // đúng khi qua năm (12→01) và tháng 2
  _attAutoFollow = (_attYM===todayStr().slice(0,7));
  renderChamCong();
}

// Ca hiện tại của nhân viên = ca ghi trong Lịch làm việc (khớp theo tên, như llvWorkerDept). Không suy diễn nếu không có.
function attShiftMap(){
  const m = {};
  (DB.lichLamViec||[]).forEach(s=>(s.rows||[]).forEach(r=>{
    const nm = (r.name||'').trim().toLowerCase(); if(!nm || m[nm]) return;
    m[nm] = (typeof llvShiftKey==='function') ? llvShiftKey(r.time) : 'khac';
  }));
  return m;
}
function attShiftLabel(k){ return (typeof LLV_SHIFT_SHORT!=='undefined' && LLV_SHIFT_SHORT[k]) || k; }

// Mô hình dữ liệu của bảng: dùng chung cho giao diện, xuất Excel, in ấn.
function attBuildModel(ym, filter){
  ym = ym || curYM(); filter = filter || _attFilter;
  const sm = attShiftMap();
  const shiftOf = w => sm[(w.name||'').trim().toLowerCase()] || 'khac';
  const monthRows = DB.attendance[ym] || {};
  const workers = attFilterWorkers(DB.workers||[], filter, monthRows, shiftOf);
  const ctx = {ym, today: todayStr(), holidays: attHolidays(), nghiPhep: DB.nghiPhep||[]};
  const rows = workers.map(w=>({w, row: monthRows[w.id]||{}, shift: shiftOf(w), stats: attWorkerMonthStats(w, monthRows[w.id], ctx)}));
  return {ym, y:+ym.slice(0,4), m:+ym.slice(5,7), n:attDaysIn(ym), rows, ctx, agg: attAggregate(rows), hol: ctx.holidays,
          locked: attLockInfo(ym), allWorkers: (DB.workers||[]).length};
}

// Chuyển 1 ô nhập công thành {cong, otHours}.
// Quy ước nhập: "1" = 1 công (8 giờ) · "0.5" = nửa công · "0" = nghỉ.
// Phần thập phân (sau dấu chấm, khi phần nguyên ≥1) được hiểu là SỐ GIỜ
// LÀM THÊM trong ngày đó, ví dụ "1.2" = 1 công + làm thêm 2 giờ.
// Nếu phần nguyên = 0 thì phần thập phân vẫn là phần lẻ công bình thường
// (ví dụ "0.5" = nửa công, không phải 5 giờ).
function parseCongValue(raw){
  if(raw===undefined||raw===null) return {cong:0, ot:0};
  const s = String(raw).trim().replace(',', '.');
  if(s==='') return {cong:0, ot:0};
  const m = s.match(/^(\d+)(?:\.(\d+))?$/);
  if(!m){ const n=parseFloat(s); return {cong:isNaN(n)?0:n, ot:0}; } // fallback giá trị lạ
  const intPart = parseInt(m[1], 10);
  const decStr = m[2] || '';
  if(decStr==='') return {cong:intPart, ot:0};
  if(intPart===0) return {cong:parseFloat('0.'+decStr), ot:0}; // phần lẻ công (vd 0.5 = nửa công)
  // Phần thập phân = số giờ làm thêm (1 chữ số thập phân ⇄ 1 chữ số giờ):
  // "1.2" → 2 giờ · "1.25" → 2.5 giờ (hỗ trợ làm thêm nửa giờ)
  const otHours = parseFloat('0.'+decStr) * 10;
  return {cong:intPart, ot:otHours};
}

// Tổng công của cả tháng: cộng dồn riêng số công và số giờ làm thêm của
// từng ngày, sau đó GIỜ LÀM THÊM ĐỦ 8 GIỜ sẽ được quy đổi thành 1 công.
// Ví dụ: ngày 1 chấm 1.2 (1 công + 2h thêm giờ), ngày 2 chấm 1.2 (1 công +
// 2h thêm giờ) ⇒ tổng = 2 công + 4 giờ thêm giờ ⇒ hiển thị "2.4" (chưa đủ
// 8h nên chưa quy đổi). Nếu giờ thêm giờ cộng dồn đủ/vượt 8h thì cứ mỗi 8h
// được +1 công, phần dư còn lại vẫn hiển thị là số giờ thêm giờ.
// Công thức DUY NHẤT tính tổng công từ dữ liệu thô 1 dòng chấm công
// ({ngày: giá trị nhập}) — dùng chung cho CẢ tab quản lý nhân sự (computeTotal)
// LẪN trang công khai quét mã QR (pubComputeTotal) để 2 nơi luôn ra cùng 1 kết
// quả. Trước đây trang công khai dùng công thức cộng dồn khác (chỉ parseFloat
// đơn giản, không quy đổi giờ làm thêm ≥8h thành công) nên bị lệch tổng công
// so với tab quản lý nhân sự (VD 28.6 công ở tab quản lý nhưng quét QR lại
// hiện 27.6 công vì thiếu 1 công quy đổi từ giờ làm thêm).
function computeCongTotalStr(rowData){
  let cong = 0, ot = 0;
  Object.values(rowData||{}).forEach(v=>{
    const p = parseCongValue(v);
    cong += p.cong;
    ot += p.ot;
  });
  // Quy đổi giờ làm thêm đủ 8h thành công, phần dư (<8h) giữ lại làm giờ thêm giờ
  const extraCong = Math.floor(ot/8 + 1e-9);
  let otRest = Math.round((ot - extraCong*8) * 10) / 10;
  if(otRest >= 8) { otRest = 0; } // an toàn, tránh sai số float
  cong += extraCong;
  cong = Math.round(cong*10)/10;
  if(otRest <= 0) return cong.toString();
  // Có giờ thêm giờ dư: ghép "phần công.giờ dư" theo đúng quy ước nhập ban đầu
  const congInt = Math.floor(cong + 1e-9);
  const congFrac = Math.round((cong - congInt) * 10) / 10; // phần lẻ công (nửa công) nếu có
  if(congFrac > 0){
    // Trường hợp hiếm: vừa có nửa công lẻ vừa có giờ thêm giờ dư → ghi rõ riêng
    return cong.toString() + ' +' + otRest + 'h';
  }
  const otDigit = otRest % 1 === 0 ? Math.round(otRest) : otRest;
  return congInt + '.' + otDigit;
}
function computeTotal(workerId){
  const ym = curYM();
  const rowData = DB.attendance[ym]?.[workerId] || {};
  return computeCongTotalStr(rowData);
}


// ───────────────────────────────────────────────────────────
// Tự chuyển sang tháng mới khi qua nửa đêm (nếu đang theo dõi tháng hiện tại).
// KHÔNG còn đọc lại toàn bộ ô từ DOM để ghi (lỗi gốc): mọi ô đã được ghi ngay khi sửa (attSetCell),
// việc chuyển tháng chỉ đẩy nốt hàng đợi rồi đổi tháng. Tháng mới KHÔNG bị tạo dữ liệu rỗng giả.
// ───────────────────────────────────────────────────────────
function maintainAttMonth(){
  const realYM = todayStr().slice(0,7);
  if(_attAutoFollow && _attYM && _attYM!==realYM){
    if(attPendingCount()) attFlush();
    _attYM = realYM;
    if(currentTab==='chamCong') renderChamCong();
    else if(currentTab==='nhanSu') renderNhanSu();
  }
}
setInterval(maintainAttMonth, 30000);

// Giữ tên cũ (mã khác có thể gọi). Nay: đẩy hàng đợi và CHỈ báo thành công khi Firebase đã xác nhận.
async function saveAllAttendance(ymParam, silent){
  if(guardViewer()) return;
  const r = await attFlush();
  if(silent) return r;
  if(r.ok) showToast('✅ Đã đồng bộ toàn bộ bảng chấm công lên máy chủ');
  else showToast('⚠️ Chưa gửi được ' + r.pending + ' thay đổi — đã lưu trên máy, sẽ tự gửi lại khi có mạng', true);
  return r;
}

// ─── Trạng thái đồng bộ (huy hiệu trên đầu bảng) ───
function attSyncBadgeHtml(info){
  info = info || attSyncInfo();
  if(info.state==='offline') return `<span class="att2-sync att2-sync--warn">📴 Mất kết nối · ${info.pending} thay đổi sẽ tự gửi lại</span>`;
  if(info.state==='error')   return `<span class="att2-sync att2-sync--err">⚠️ Lỗi gửi · ${info.pending} thay đổi đang thử lại</span>`;
  if(info.state==='sending' || info.pending>0) return `<span class="att2-sync att2-sync--wait">⏳ Đang gửi${info.pending?(' · '+info.pending+' thay đổi'):''}…</span>`;
  return `<span class="att2-sync att2-sync--ok">✅ Đã đồng bộ</span>`;
}
if(typeof attOnSyncChange==='function') attOnSyncChange(function(info){ const el=document.getElementById('attSyncBadge'); if(el) el.innerHTML = attSyncBadgeHtml(info); });

// ─── Ô chấm công ───
function attCellClass(raw, extra){
  const i = attCellInfo(raw);
  let c = 'att2-cell';
  if(i.state==='invalid') c += ' is-bad';
  else if(i.state==='ok'){ c += ' k-'+i.kind; if(i.warn.length) c += ' is-warn'; }
  return c + (extra||'');
}
function attCellTitle(raw){
  const i = attCellInfo(raw); if(i.state==='empty') return '';
  const t = i.warn.map(c=>ATT_WARN_TEXT[c]).filter(Boolean);
  if(i.state==='ok' && i.kind==='ot') t.unshift('1 công + ' + i.ot + ' giờ tăng ca');
  return t.join(' · ');
}
function attDayHead(model, d){
  const ds = attDateStr(model.ym, d), sun = attIsSunday(model.ym, d), hol = model.hol[ds];
  const isToday = ds === todayStr();
  const cls = 'att2-dh' + (sun?' is-sun':'') + (hol?' is-hol':'') + (isToday?' is-today':'');
  return `<th class="${cls}" title="${hol?attEsc(hol):''}"><div>${d}</div><div class="att2-wd">${weekdayVN(model.y, model.m, d)}</div></th>`;
}
function attRowHtml(r, model, canEdit, idx){
  const w = r.w, s = r.stats, ym = model.ym;
  const inactive = (w.trangThai||'Đang làm') !== 'Đang làm';
  const miss = {}; s.missingDays.forEach(d=>miss[d]=1);
  const issueDays = {}; s.issues.forEach(i=>{ if(i.day) issueDays[i.day]=1; });
  let tds = '';
  for(let d=1; d<=model.n; d++){
    const v = r.row[d]!==undefined ? r.row[d] : '';
    const ds = attDateStr(ym,d), sun = attIsSunday(ym,d), hol = model.hol[ds];
    const tdc = (sun?'is-sun ':'') + (hol?'is-hol ':'') + (miss[d]?'is-miss':'');
    const extra = issueDays[d] && attCellInfo(v).state==='ok' && !attCellInfo(v).warn.length ? ' is-warn' : '';
    tds += `<td class="${tdc}"><input class="${attCellClass(v, extra)}" id="cell_${w.id}_${d}" data-w="${w.id}" data-d="${d}" data-v="${attEsc(v)}" value="${attEsc(v)}" inputmode="decimal" autocomplete="off" title="${attEsc(attCellTitle(v))}" ${canEdit?'':'readonly'} onfocus="this.select()" onchange="attCellChange(this)"></td>`;
  }
  const note = attNoteOf(ym, w.id);
  return `<tr data-w="${w.id}" class="${inactive?'is-inactive':''}">
    <td class="att2-c-stt">${idx+1}</td>
    <td class="att2-c-code">${attEsc(w.maNV||'')}</td>
    <td class="att2-c-name" title="${attEsc(w.name||'')}"><span>${attEsc(w.name||'(chưa đặt tên)')}</span>${inactive?`<em>${attEsc(w.trangThai)}</em>`:''}</td>
    <td class="att2-c-dept">${typeof llvDeptBadgeHtml==='function'?llvDeptBadgeHtml(w.boPhan, attEsc):attEsc(w.boPhan||'')}</td>
    <td class="att2-c-pos">${attEsc(w.chucVu||'—')}</td>
    ${tds}
    <td class="att2-sum att2-tot" id="wkTotal_${w.id}">${s.congStr}</td>
    <td class="att2-sum" id="attOt_${w.id}">${s.otRaw>0?s.otRaw+'h':'—'}</td>
    <td class="att2-sum" id="attOff_${w.id}">${s.offDays||'—'}</td>
    <td class="att2-c-note"><input class="att2-note" data-w="${w.id}" value="${attEsc(note)}" maxlength="300" placeholder="${canEdit?'Ghi chú…':''}" ${canEdit?'':'readonly'} onchange="attNoteChange(this)"></td>
  </tr>`;
}

// ─── Dashboard ───
function attDashHtml(model){
  const a = model.agg, workers = a.workers;
  const comp = a.completion;
  const tone = comp>=95?'ok':comp>=70?'warn':'bad';
  const congTxt = a.congUnits.toFixed(1).replace(/\.0$/,'') + (a.otRest>0 ? ` <small>+${a.otRest}h</small>` : '');
  const card = (lbl, val, cls, sub, click) => `<div class="att2-card ${cls||''}" ${click?`onclick="${click}" style="cursor:pointer"`:''}><div class="att2-card-v">${val}</div><div class="att2-card-l">${lbl}</div>${sub?`<div class="att2-card-s">${sub}</div>`:''}</div>`;
  return `
    ${card('Tổng nhân viên', workers, '', 'đang hiển thị / '+model.allWorkers+' hồ sơ')}
    ${card('Đã có dữ liệu', a.withData, 'ok', 'trong tháng')}
    ${card('Chưa có dữ liệu', a.noData, a.noData?'warn':'', 'chưa chấm ngày nào')}
    ${card('Tổng công tháng', congTxt, 'ok', 'đã quy đổi 8h tăng ca = 1 công')}
    ${card('Giờ tăng ca', a.otRaw + 'h', '', 'ghi nhận trước quy đổi')}
    ${card('Ngày nghỉ', a.offDays, '', 'ô chấm 0')}
    ${card('Thiếu dữ liệu', a.missingCells, a.missingCells?'bad':'ok', a.missingCells?'ô cần bổ sung · bấm để xem':'không có ô thiếu', 'attToggleIssues()')}
    <div class="att2-card att2-card--prog ${tone}"><div class="att2-card-v">${comp}%</div><div class="att2-card-l">Hoàn thành chấm công</div>
      <div class="att2-bar"><i style="width:${Math.min(100,comp)}%"></i></div><div class="att2-card-s">${a.expectedCells-a.missingCells}/${a.expectedCells} ô cần chấm</div></div>`;
}
function attIssuesHtml(model){
  const items = [];
  model.rows.forEach(r=>{
    const nm = attEsc(r.w.name||'(chưa đặt tên)');
    if(r.stats.missingDays.length) items.push({w:r.w.id, sev:'miss', txt:`<b>${nm}</b> · thiếu dữ liệu ngày ${r.stats.missingDays.slice(0,12).join(', ')}${r.stats.missingDays.length>12?'…':''} (${r.stats.missingDays.length} ngày)`, d:r.stats.missingDays[0]});
    r.stats.issues.forEach(i=>items.push({w:r.w.id, sev:i.sev, d:i.day, txt:`<b>${nm}</b> · ${i.day?('ngày '+i.day):'cả tháng'}: ${attEsc(ATT_WARN_TEXT[i.code]||i.code)}${i.code==='format'||i.code==='ot>month'?` (“${attEsc(i.value)}”)`:` (“${attEsc(i.value)}”)`}`}));
  });
  if(!items.length) return `<div class="att2-empty-s">✅ Không có ô thiếu hoặc bất thường trong phạm vi đang lọc.</div>`;
  return `<div class="att2-issue-hd">Cảnh báo (${items.length}) — bấm một dòng để tới ô tương ứng</div>` + items.slice(0,150).map(i=>`<button class="att2-issue att2-issue--${i.sev}" onclick="attGoCell('${i.w}',${i.d||1})">${i.txt}</button>`).join('') + (items.length>150?`<div class="att2-empty-s">… còn ${items.length-150} cảnh báo khác (xem trong bảng/Excel)</div>`:'');
}
function attToggleIssues(){ _attIssuesOpen = !_attIssuesOpen; const el = document.getElementById('attIssues'); if(el){ el.style.display = _attIssuesOpen?'block':'none'; if(_attIssuesOpen) el.scrollIntoView({behavior:'smooth',block:'nearest'}); } }
function attGoCell(wid, d){
  const el = document.getElementById('cell_'+wid+'_'+d); if(!el) return;
  el.scrollIntoView({behavior:'smooth', block:'center', inline:'center'}); setTimeout(()=>{ el.focus(); }, 250);
}
// Cập nhật nhẹ dashboard + tổng của 1 dòng sau khi sửa ô (không vẽ lại cả bảng → giữ focus).
function attRefreshLive(wid){
  const model = attBuildModel();
  const dash = document.getElementById('attDash'); if(dash) dash.innerHTML = attDashHtml(model);
  const iss = document.getElementById('attIssues'); if(iss && _attIssuesOpen) iss.innerHTML = attIssuesHtml(model);
  const r = model.rows.find(x=>x.w.id===wid);
  if(r){
    const t = document.getElementById('wkTotal_'+wid); if(t) t.textContent = r.stats.congStr;
    const o = document.getElementById('attOt_'+wid); if(o) o.textContent = r.stats.otRaw>0 ? r.stats.otRaw+'h' : '—';
    const f = document.getElementById('attOff_'+wid); if(f) f.textContent = r.stats.offDays || '—';
  }
}
function attCellChange(el){
  if(guardViewer()){ el.value = el.dataset.v||''; return; }
  const ym = curYM(), wid = el.dataset.w, d = +el.dataset.d;
  const res = attSetCell(ym, wid, d, el.value);
  if(!res.ok){
    const prev = el.dataset.v||'';
    if(res.reason==='invalid') showToast('⚠️ “'+el.value.trim()+'” sai định dạng — chỉ nhập số: 1, 0.5, 0, 1.2 (1 công + 2 giờ)…', true);
    else if(res.reason==='locked') showToast('🔒 Kỳ chấm công đã chốt — Admin cần mở khoá mới sửa được', true);
    else showToast('⚠️ Không lưu được ô này', true);
    el.value = prev; return;
  }
  const v = el.value.trim(); el.value = v; el.dataset.v = v;
  el.className = attCellClass(v); el.title = attCellTitle(v);
  const td = el.parentElement; if(td) td.classList.remove('is-miss');
  attRefreshLive(wid);
}
function attNoteChange(el){
  if(guardViewer()){ return; }
  const r = attSetNote(curYM(), el.dataset.w, el.value);
  if(!r.ok && r.reason==='locked'){ showToast('🔒 Kỳ đã chốt — không sửa được ghi chú', true); el.value = attNoteOf(curYM(), el.dataset.w); }
}
// Bàn phím: Enter/↓ xuống dòng dưới, ↑ lên dòng trên (cùng ngày) — nhập nhanh theo cột như bảng giấy.
document.addEventListener('keydown', function(e){
  const t = e.target; if(!t || !t.classList || !t.classList.contains('att2-cell')) return;
  let dr = 0, dc = 0;
  if(e.key==='Enter' || e.key==='ArrowDown') dr = 1; else if(e.key==='ArrowUp') dr = -1;
  else if(e.key==='ArrowRight' && t.selectionStart===t.value.length) dc = 1; else if(e.key==='ArrowLeft' && t.selectionStart===0) dc = -1; else return;
  e.preventDefault();
  const tr = t.closest('tr'); let target = null;
  if(dr){ let row = dr>0 ? tr.nextElementSibling : tr.previousElementSibling; while(row && !row.querySelector('.att2-cell')) row = dr>0?row.nextElementSibling:row.previousElementSibling; if(row) target = row.querySelector('.att2-cell[data-d="'+t.dataset.d+'"]'); }
  else target = tr.querySelector('.att2-cell[data-d="'+(+t.dataset.d+dc)+'"]');
  if(target){ t.blur(); target.focus(); }
});

// ─── Bộ lọc (chỉ vẽ lại phần bảng, giữ nguyên ô tìm kiếm đang gõ) ───
function attSetFilter(key, val){
  _attFilter[key] = val; attSaveFilter();
  const model = attBuildModel();
  const wrap = document.getElementById('attTableWrap'); if(wrap) wrap.innerHTML = attTableHtml(model);
  const dash = document.getElementById('attDash'); if(dash) dash.innerHTML = attDashHtml(model);
  const iss = document.getElementById('attIssues'); if(iss) iss.innerHTML = attIssuesHtml(model);
}
function attResetFilter(){ _attFilter = {dept:'all', shift:'all', status:'all', q:''}; attSaveFilter(); renderChamCong(); }

function attTableHtml(model){
  const canEdit = !isViewer() && !model.locked;
  const {rows} = model;
  const dayHeads = Array.from({length:model.n}, (_,i)=>attDayHead(model, i+1)).join('');
  if(!rows.length){
    const filtered = _attFilter.dept!=='all'||_attFilter.shift!=='all'||_attFilter.status!=='all'||_attFilter.q;
    return `<div class="att2-empty"><div class="att2-empty-i">🗓️</div><div class="att2-empty-t">${model.allWorkers?'Không có nhân viên phù hợp bộ lọc':'Chưa có hồ sơ nhân viên'}</div>
      <div class="att2-empty-d">${model.allWorkers?'Thử đổi bộ lọc hoặc xoá bộ lọc để xem tất cả.':'Danh sách chấm công lấy từ <b>Quản lý nhân sự</b> — thêm nhân viên ở đó (hoặc bấm “Thêm nhân viên” nếu bạn là Admin).'}</div>
      ${filtered?`<button class="set-btn att2-btn" onclick="attResetFilter()">✕ Xoá bộ lọc</button>`:`<button class="set-btn att2-btn" onclick="goTab('nhanSu')">👥 Mở Quản lý nhân sự</button>`}</div>`;
  }
  return `<div class="att2-scroll"><table id="attTable" class="att2-table">
    <thead><tr>
      <th class="att2-c-stt">STT</th><th class="att2-c-code">Mã NV</th><th class="att2-c-name">Họ và tên</th><th class="att2-c-dept">Bộ phận</th><th class="att2-c-pos">Chức vụ</th>
      ${dayHeads}
      <th class="att2-sum att2-tot" title="Quy ước: 8 giờ tăng ca = 1 công">Tổng công</th><th class="att2-sum" title="Tổng giờ tăng ca ghi nhận (trước quy đổi)">Giờ TC</th><th class="att2-sum">Ngày nghỉ</th><th class="att2-c-note">Ghi chú</th>
    </tr></thead>
    <tbody>${rows.map((r,i)=>attRowHtml(r, model, canEdit, i)).join('')}</tbody>
  </table></div>`;
}

let _attRenderPending = false;
function renderChamCong(){
  // Không vẽ lại khi người dùng đang gõ dở ở một ô (cập nhật realtime từ máy khác sẽ làm mất nội dung đang nhập).
  const ae = document.activeElement;
  if(ae && ae.classList && ((ae.classList.contains('att2-cell') && ae.value !== ae.dataset.v) || (ae.classList.contains('att2-note') && ae.value !== attNoteOf(curYM(), ae.dataset.w)))){ _attRenderPending = true; return; }
  _attRenderPending = false;
  const keepId = ae && ae.id === 'attSearch' ? 'attSearch' : null, keepPos = keepId ? ae.selectionStart : 0;
  const scEl = document.querySelector('#attTableWrap .att2-scroll'); const scTop = scEl ? scEl.scrollTop : 0, scLeft = scEl ? scEl.scrollLeft : 0;

  const model = attBuildModel(), ym = model.ym, {y, m} = model;
  const admin = isAdmin(), viewer = isViewer(), locked = model.locked;
  const depts = Array.from(new Set((DB.workers||[]).map(w=>(w.boPhan||'').trim()).filter(Boolean))).sort();
  const sel = (cur, v) => cur===v ? ' selected' : '';
  const btn = (cls, on, txt, extra) => `<button class="set-btn att2-btn ${cls||''}" onclick="${on}" ${extra||''}>${txt}</button>`;
  const lockBanner = locked ? `<div class="att2-lock">🔒 <b>Kỳ chấm công tháng ${m}/${y} đã chốt</b> bởi ${attEsc(locked.by||'?')} lúc ${attEsc(vnDateTimeShort(locked.at))}. Dữ liệu chỉ xem; ${admin?'bạn là Admin nên có thể mở khoá.':'chỉ Admin được mở khoá.'}
      ${admin?btn('att2-btn--sm','attOpenUnlock()','🔓 Mở khoá kỳ'):''}</div>` : (() => { const mm = _attMetaMonth(ym,false); const lu = mm && mm.lastUnlock; return lu ? `<div class="att2-info">🔓 Kỳ này đã được ${attEsc(lu.by)} mở khoá lúc ${attEsc(vnDateTimeShort(lu.at))} — lý do: ${attEsc(lu.reason)}</div>` : ''; })();

  $('mc').innerHTML = `
  <div class="att2">
    <div class="card att2-head">
      <div class="att2-head-row">
        <div>
          <div class="att2-kicker">Bảng chấm công</div>
          <div class="att2-title">Tháng ${m}/${y} ${locked?'<span class="att2-pill att2-pill--lock">🔒 Đã chốt</span>':'<span class="att2-pill">Đang mở</span>'}</div>
        </div>
        <div class="att2-head-r"><span id="attSyncBadge">${attSyncBadgeHtml()}</span>
          <button class="chip" onclick="goTab('nhanSu')" title="Hồ sơ, hợp đồng, nghỉ phép, kỷ luật">👥 Quản lý nhân sự →</button></div>
      </div>
      <div class="att2-nav">
        <button class="chip" onclick="shiftAttMonth(-1)" aria-label="Tháng trước">←</button>
        <input type="month" class="field-inp att2-month" value="${ym}" onchange="changeAttMonth(this.value)">
        <button class="chip" onclick="shiftAttMonth(1)" aria-label="Tháng sau">→</button>
        <button class="chip" onclick="changeAttMonth(todayStr().slice(0,7))">Tháng này</button>
      </div>
    </div>
    ${lockBanner}
    <div class="att2-dash" id="attDash">${attDashHtml(model)}</div>
    <div class="card att2-issues" id="attIssues" style="display:${_attIssuesOpen?'block':'none'}">${attIssuesHtml(model)}</div>

    <div class="card att2-filters">
      <input id="attSearch" class="field-inp att2-search" placeholder="🔍 Tìm theo tên hoặc mã nhân viên…" value="${attEsc(_attFilter.q)}" oninput="attSetFilter('q', this.value)">
      <select class="field-inp" onchange="attSetFilter('dept', this.value)" aria-label="Bộ phận"><option value="all">Tất cả bộ phận</option>${depts.map(d=>`<option value="${attEsc(d)}"${sel(_attFilter.dept,d)}>${attEsc(d)}</option>`).join('')}</select>
      <select class="field-inp" onchange="attSetFilter('shift', this.value)" aria-label="Ca làm việc"><option value="all">Tất cả ca</option>${['ca1','ca2','ca3','hc','tangca','nghi','khac'].map(k=>`<option value="${k}"${sel(_attFilter.shift,k)}>${attShiftLabel(k)}</option>`).join('')}</select>
      <select class="field-inp" onchange="attSetFilter('status', this.value)" aria-label="Trạng thái"><option value="all">Trạng thái: mặc định</option>${['Đang làm','Tạm nghỉ','Đã nghỉ việc'].map(k=>`<option value="${k}"${sel(_attFilter.status,k)}>${k}</option>`).join('')}</select>
      ${(_attFilter.dept!=='all'||_attFilter.shift!=='all'||_attFilter.status!=='all'||_attFilter.q)?btn('att2-btn--ghost','attResetFilter()','✕ Xoá lọc'):''}
    </div>

    <div class="card att2-tools">
      ${viewer?'':btn('att2-btn--pri','attSaveNow()','💾 Lưu &amp; đồng bộ','title="Dữ liệu đã tự lưu khi sửa từng ô; nút này chờ máy chủ xác nhận"')}
      ${(viewer||locked)?'':btn('','attOpenBulk(\'fill\')','⚡ Chấm hàng loạt')}
      ${(viewer||locked)?'':btn('','attOpenBulk(\'copyday\')','📋 Sao chép từ ngày')}
      ${(viewer||locked)?'':btn('','attOpenBulk(\'byshift\')','🕒 Điền theo ca')}
      ${(viewer||locked)?'':btn('att2-btn--lock','attOpenLock()','🔒 Chốt kỳ')}
      ${btn('','attOpenAudit()','📜 Lịch sử sửa')}
      <details class="att2-menu"><summary class="set-btn att2-btn">⬇️ Xuất / In ▾</summary><div class="att2-menu-b">
        ${viewer?'':`<button onclick="exportAttendanceExcel()">📗 Excel bảng công (theo bộ lọc)</button>
        <button onclick="exportAttendanceByDept()">📗 Excel tách theo bộ phận</button>
        <button onclick="exportAttendanceReports()">📊 Excel báo cáo tổng hợp (công · tăng ca · nghỉ · thiếu · số liệu lương)</button>
        <button onclick="printAttendance('A4')">🖨️ In A4 (ngang)</button><button onclick="printAttendance('A3')">🖨️ In A3</button>
        <button onclick="captureAttendance()">📷 Chụp ảnh gửi nhóm</button>
        <button onclick="openCcllvQrModal()">🏷 Mã QR xem Chấm công &amp; Lịch làm việc</button>`}
        ${viewer?'<div class="att2-empty-s">Tài khoản Xem không xuất/in được.</div>':''}
      </div></details>
      ${admin?btn('','attOpenHolidays()','🎌 Ngày lễ'):''}
      ${admin?btn('','addWorker()','➕ Thêm nhân viên'):''}
    </div>

    <div class="card att2-tablecard"><div id="attCaptureArea">
      <div class="att2-captitle">Bảng chấm công tháng ${m}/${y}</div>
      <div id="attTableWrap">${attTableHtml(model)}</div>
    </div></div>
    <div class="card att2-legend">
      <b>Cách chấm:</b> đủ công <b>1</b> · nửa công <b>0.5</b> · nghỉ <b>0</b> · tăng ca: <b>1.2</b> = 1 công + 2 giờ, <b>1.25</b> = 1 công + 2,5 giờ · đủ 8 giờ tăng ca = +1 công.
      <span class="att2-key"><i class="k-full"></i>Đủ công</span><span class="att2-key"><i class="k-half"></i>Nửa công</span><span class="att2-key"><i class="k-off"></i>Nghỉ</span><span class="att2-key"><i class="k-ot"></i>Tăng ca</span><span class="att2-key"><i class="k-bad"></i>Lỗi/bất thường</span><span class="att2-key"><i class="k-sun"></i>Chủ nhật</span><span class="att2-key"><i class="k-hol"></i>Ngày lễ</span><span class="att2-key"><i class="k-miss"></i>Thiếu dữ liệu</span>
    </div>
  </div>`;
  const sc = document.querySelector('#attTableWrap .att2-scroll'); if(sc){ sc.scrollTop = scTop; sc.scrollLeft = scLeft; }
  if(keepId){ const el = document.getElementById(keepId); if(el){ el.focus(); try{ el.setSelectionRange(keepPos, keepPos); }catch(e){} } }
}
// Khi rời ô sau khi có cập nhật bị hoãn → vẽ lại.
document.addEventListener('focusout', function(){ if(_attRenderPending) setTimeout(function(){ if(_attRenderPending && currentTab==='chamCong') renderChamCong(); }, 60); });

// Nút "Lưu & đồng bộ": chỉ báo thành công khi Firebase đã xác nhận.
async function attSaveNow(){
  if(guardViewer()) return;
  const badge = document.getElementById('attSyncBadge'); if(badge) badge.innerHTML = attSyncBadgeHtml({state:'sending', pending:attPendingCount()});
  const r = await attFlush();
  if(r.ok) showToast('✅ Đã đồng bộ lên máy chủ — mọi thiết bị sẽ thấy dữ liệu này');
  else showToast('⚠️ Chưa gửi được ' + r.pending + ' thay đổi (' + (r.error||'lỗi mạng') + '). Dữ liệu đã lưu trên máy và sẽ tự gửi lại.', true);
}
