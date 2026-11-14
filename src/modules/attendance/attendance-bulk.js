// src/modules/attendance/attendance-bulk.js  — GIAI ĐOẠN 1 (v2.6.0)
// Hộp thoại: chấm hàng loạt · sao chép từ ngày · điền theo ca · chốt/mở khoá kỳ · lịch sử sửa · ngày lễ.
// Mọi thao tác ghi đều đi qua attendance-service.js (kiểm quyền + khoá kỳ ở tầng xử lý) và CÓ XÁC NHẬN
// trước khi sửa/xoá hàng loạt. Chỉ báo thành công sau khi Firebase xác nhận.

function attDialog(id, title, bodyHtml, footerHtml){
  let el = document.getElementById(id);
  if(!el){ el = document.createElement('div'); el.className = 'modal'; el.id = id; document.body.appendChild(el); }
  el.innerHTML = `<div class="modal-box att2-dlg" data-dp-nodirty="1"><div class="modal-handle"></div><div class="modal-title">${title}</div>${bodyHtml}<div class="modal-footer">${footerHtml}</div></div>`;
  openModal(id);
}
function attDlgClose(id){ closeModal(id); }
function attFail(reason, extra){
  const m = {viewer:'🔒 Tài khoản này chỉ được xem', locked:'🔒 Kỳ chấm công đã chốt — Admin cần mở khoá', noperm:'🔒 Chỉ Admin được thực hiện thao tác này',
    unsynced:'⚠️ Còn thay đổi chưa đồng bộ lên máy chủ — kiểm tra mạng rồi thử lại', network:'⚠️ Lỗi mạng, chưa thực hiện được', noreason:'⚠️ Vui lòng nhập lý do'};
  showToast((m[reason]||'⚠️ Không thực hiện được') + (extra?(' ('+extra+')'):''), true);
}

// ═════════ CHẤM HÀNG LOẠT / SAO CHÉP / ĐIỀN THEO CA ═════════
let _attBulk = {mode:'fill', plan:null};
const ATT_VALUE_PRESETS = [['1','1 · đủ công'],['0.5','0.5 · nửa công'],['0','0 · nghỉ'],['1.1','1.1 · +1 giờ TC'],['1.2','1.2 · +2 giờ TC'],['1.4','1.4 · +4 giờ TC'],['__custom','Giá trị khác…'],['__clear','(Xoá trắng ô)']];

function attOpenBulk(mode){
  if(guardViewer()) return;
  const ym = curYM();
  if(attIsLocked(ym)){ attFail('locked'); return; }
  const model = attBuildModel(); const n = model.n;
  if(!model.rows.length){ showToast('⚠️ Không có nhân viên nào trong bộ lọc hiện tại', true); return; }
  _attBulk = {mode, plan:null};
  const today = todayStr(); const defDay = today.slice(0,7)===ym ? +today.slice(8,10) : 1;
  const title = mode==='copyday' ? '📋 Sao chép chấm công từ ngày khác' : mode==='byshift' ? '🕒 Điền chấm công theo ca' : '⚡ Chấm công hàng loạt';
  const num = (id, v) => `<input id="${id}" type="number" class="field-inp" min="1" max="${n}" value="${v}" oninput="attBulkPreview()">`;
  const valuePick = `<div class="field"><div class="field-lbl">Giá trị chấm</div><select id="ab_val" class="field-inp" onchange="attBulkValueChanged()">${ATT_VALUE_PRESETS.map(p=>`<option value="${p[0]}">${p[1]}</option>`).join('')}</select>
      <input id="ab_custom" class="field-inp" style="display:none;margin-top:6px" placeholder="VD: 1.25" oninput="attBulkPreview()"></div>`;
  const shiftPick = mode==='byshift' ? `<div class="field"><div class="field-lbl">Áp dụng cho nhân viên thuộc ca (theo Lịch làm việc)</div><select id="ab_shift" class="field-inp" onchange="attBulkPreview()">${['ca1','ca2','ca3','hc','tangca'].map(k=>`<option value="${k}">${attShiftLabel(k)}</option>`).join('')}</select></div>` : '';
  const srcPick = mode==='copyday' ? `<div class="field"><div class="field-lbl">Sao chép từ ngày</div>${num('ab_src', Math.max(1, defDay-1))}</div>` : '';
  attDialog('attBulkModal', title, `
    <div class="att2-dlg-note">Phạm vi: <b>${model.rows.filter(r=>(r.w.trangThai||'Đang làm')==='Đang làm').length}</b> nhân viên <b>đang làm</b> trong bộ lọc hiện tại (tháng ${model.m}/${model.y}).</div>
    ${shiftPick}${srcPick}
    <div class="modal-row"><div class="field"><div class="field-lbl">${mode==='copyday'?'Đến các ngày: từ':'Từ ngày'}</div>${num('ab_from', defDay)}</div><div class="field"><div class="field-lbl">Đến ngày</div>${num('ab_to', defDay)}</div></div>
    ${mode==='copyday' ? '' : valuePick}
    <div class="field"><div class="field-lbl">Khi ô đã có dữ liệu</div>
      <label class="att2-chk"><input type="radio" name="ab_mode" value="empty" checked onchange="attBulkPreview()"> Chỉ điền ô <b>trống</b> (giữ nguyên ô đã chấm)</label>
      <label class="att2-chk"><input type="radio" name="ab_mode" value="overwrite" onchange="attBulkPreview()"> <b>Ghi đè</b> ô đã có dữ liệu (cần xác nhận)</label></div>
    <div class="field"><label class="att2-chk"><input type="checkbox" id="ab_sun" checked onchange="attBulkPreview()"> Bỏ qua Chủ nhật</label>
      <label class="att2-chk"><input type="checkbox" id="ab_hol" checked onchange="attBulkPreview()"> Bỏ qua ngày lễ (đã khai báo)</label>
      <label class="att2-chk"><input type="checkbox" id="ab_leave" checked onchange="attBulkPreview()"> Bỏ qua ngày nghỉ phép <b>đã duyệt</b></label></div>
    <div id="ab_prev" class="att2-prev"></div>
    <label class="att2-chk att2-confirm" id="ab_okwrap" style="display:none"><input type="checkbox" id="ab_ok" onchange="attBulkPreview()"> <span id="ab_oktxt"></span></label>`,
    `<button class="btn btn-ghost" onclick="attDlgClose('attBulkModal')">Hủy</button><button class="btn btn-primary" id="ab_go" onclick="attBulkApply()" disabled>Áp dụng</button>`);
  attBulkPreview();
}
function attBulkValueChanged(){
  const v = document.getElementById('ab_val').value;
  document.getElementById('ab_custom').style.display = v==='__custom' ? 'block' : 'none';
  if(v==='__clear'){ const r = document.querySelector('input[name="ab_mode"][value="overwrite"]'); if(r) r.checked = true; }
  attBulkPreview();
}
function attBulkRead(){
  const g = id => document.getElementById(id);
  const model = attBuildModel(); const mode = _attBulk.mode;
  let value = '';
  if(mode!=='copyday'){ const sv = g('ab_val').value; value = sv==='__custom' ? g('ab_custom').value.trim() : sv==='__clear' ? '' : sv; }
  let workers = model.rows.filter(r=>(r.w.trangThai||'Đang làm')==='Đang làm');
  if(mode==='byshift'){ const sk = g('ab_shift').value; workers = workers.filter(r=>r.shift===sk); }
  const modeRadio = document.querySelector('input[name="ab_mode"]:checked');
  return {model, value, workers:workers.map(r=>r.w), opt:{
    ym:model.ym, workers:null, fromDay:+g('ab_from').value, toDay:+g('ab_to').value, value, mode: modeRadio?modeRadio.value:'empty',
    skipSun:g('ab_sun').checked, skipHol:g('ab_hol').checked, skipLeave:g('ab_leave').checked,
    holidays:model.hol, nghiPhep:DB.nghiPhep||[], att:DB.attendance, srcDay: mode==='copyday' ? (+g('ab_src').value||null) : null}};
}
function attBulkPreview(){
  const prev = document.getElementById('ab_prev'); if(!prev) return;
  const R = attBulkRead(); R.opt.workers = R.workers;
  const go = document.getElementById('ab_go');
  if(R.opt.fromDay > R.opt.toDay || !(R.opt.fromDay>=1) || R.opt.toDay > R.model.n){ prev.innerHTML = '<span class="att2-bad">⚠️ Khoảng ngày không hợp lệ</span>'; go.disabled = true; _attBulk.plan = null; return; }
  if(_attBulk.mode==='copyday' && !(R.opt.srcDay>=1 && R.opt.srcDay<=R.model.n)){ prev.innerHTML = '<span class="att2-bad">⚠️ Ngày nguồn không hợp lệ</span>'; go.disabled = true; _attBulk.plan = null; return; }
  if(_attBulk.mode!=='copyday' && !attCellValid(R.value)){ prev.innerHTML = '<span class="att2-bad">⚠️ Giá trị sai định dạng (chỉ nhập số, vd 1, 0.5, 1.2)</span>'; go.disabled = true; _attBulk.plan = null; return; }
  if(!R.workers.length){ prev.innerHTML = '<span class="att2-bad">⚠️ Không có nhân viên nào thuộc phạm vi này</span>'; go.disabled = true; _attBulk.plan = null; return; }
  const plan = attPlanBulk(R.opt); _attBulk.plan = plan; _attBulk.value = R.value; _attBulk.label = document.querySelector('#attBulkModal .modal-title').textContent;
  const over = plan.changes.filter(c=>c.old!=='').length, sk = plan.skipped, names = {}; R.workers.forEach(w=>names[w.id]=w.name);
  const people = new Set(plan.changes.map(c=>c.wid)).size;
  const sample = plan.changes.slice(0,5).map(c=>`<li>${attEsc(c.name||'?')} · ngày ${c.day}: ${c.old?attEsc(c.old):'—'} → <b>${c.new===''?'(xoá)':attEsc(c.new)}</b></li>`).join('');
  prev.innerHTML = `<div class="att2-prev-h">${plan.changes.length ? `Sẽ ghi <b>${plan.changes.length}</b> ô cho <b>${people}</b> nhân viên${over?` · <span class="att2-bad">${over} ô đang có dữ liệu sẽ bị thay thế</span>`:''}` : 'Không có ô nào cần thay đổi'}</div>
    ${sample?`<ul class="att2-prev-l">${sample}${plan.changes.length>5?`<li>… và ${plan.changes.length-5} ô khác</li>`:''}</ul>`:''}
    <div class="att2-prev-s">Bỏ qua: ${sk.sun} ô Chủ nhật · ${sk.hol} ô ngày lễ · ${sk.leave} ô nghỉ phép đã duyệt · ${sk.kept} ô giữ nguyên dữ liệu cũ · ${sk.same} ô đã đúng giá trị</div>`;
  const okw = document.getElementById('ab_okwrap'), ok = document.getElementById('ab_ok');
  okw.style.display = over ? 'block' : 'none';
  document.getElementById('ab_oktxt').textContent = `Tôi xác nhận thay thế ${over} ô đang có dữ liệu`;
  go.disabled = !(plan.changes.length && (!over || ok.checked));
}
async function attBulkApply(){
  const plan = _attBulk.plan; if(!plan || !plan.changes.length) return;
  const ym = curYM(); const go = document.getElementById('ab_go'); go.disabled = true; go.textContent = 'Đang gửi…';
  const r = await attApplyBulk(ym, plan.changes, _attBulk.label || 'Chấm hàng loạt');
  attDlgClose('attBulkModal');
  if(!r.ok && r.reason){ attFail(r.reason); }
  else if(!r.ok) showToast('⚠️ Đã lưu '+r.applied+' ô trên máy nhưng CHƯA gửi được lên máy chủ ('+(r.error||'lỗi mạng')+'). Sẽ tự gửi lại khi có mạng.', true);
  else showToast('✅ Đã ghi '+r.applied+' ô và đồng bộ lên máy chủ');
  renderChamCong();
}

// ═════════ CHỐT / MỞ KHOÁ KỲ ═════════
function attOpenLock(){
  if(guardViewer()) return;
  const ym = curYM(), [y,m] = ym.split('-'); const model = attBuildModel(ym, {dept:'all',shift:'all',status:'all',q:''}); const a = model.agg;
  attDialog('attLockModal', '🔒 Chốt kỳ chấm công '+m+'/'+y, `
    <div class="att2-dlg-note">Sau khi chốt, <b>không ai sửa được</b> công tháng này (kể cả chấm hàng loạt). Chỉ <b>Admin</b> mở khoá lại được và phải nêu lý do.</div>
    <div class="att2-prev">${a.missingCells?`<span class="att2-bad">⚠️ Còn ${a.missingCells} ô thiếu dữ liệu</span> — nên bổ sung trước khi chốt.<br>`:'✅ Không còn ô thiếu dữ liệu.<br>'}
    ${a.issueCount?`<span class="att2-bad">⚠️ ${a.issueCount} ô bất thường</span> chưa xử lý.<br>`:''}
    Tổng công: <b>${a.congUnits}</b> · giờ tăng ca: <b>${a.otRaw}h</b> · ${a.workers} nhân viên.</div>`,
    `<button class="btn btn-ghost" onclick="attDlgClose('attLockModal')">Hủy</button><button class="btn btn-primary" id="al_go" onclick="attDoLock()">🔒 Chốt kỳ</button>`);
}
async function attDoLock(){
  const ym = curYM(); const b = document.getElementById('al_go'); b.disabled = true; b.textContent = 'Đang chốt…';
  const r = await attLockMonth(ym); attDlgClose('attLockModal');
  if(r.ok) showToast('🔒 Đã chốt kỳ chấm công tháng '+ym.split('-')[1]+'/'+ym.split('-')[0]); else attFail(r.reason, r.pending?(r.pending+' thay đổi chờ gửi'):r.error);
  renderChamCong();
}
function attOpenUnlock(){
  if(!isAdmin()){ attFail('noperm'); return; }
  const ym = curYM();
  attDialog('attUnlockModal', '🔓 Mở khoá kỳ '+ym.split('-')[1]+'/'+ym.split('-')[0], `
    <div class="att2-dlg-note">Mở khoá sẽ cho phép sửa lại công tháng này. Thao tác được ghi vào nhật ký (người mở, thời gian, lý do).</div>
    <div class="field"><div class="field-lbl">Lý do mở khoá *</div><textarea id="au_reason" class="field-inp" rows="3" maxlength="200" placeholder="VD: Sửa nhầm công ngày 12 của anh A"></textarea></div>`,
    `<button class="btn btn-ghost" onclick="attDlgClose('attUnlockModal')">Hủy</button><button class="btn btn-primary" onclick="attDoUnlock()">🔓 Mở khoá</button>`);
}
async function attDoUnlock(){
  const ym = curYM(); const reason = document.getElementById('au_reason').value.trim();
  if(!reason){ attFail('noreason'); return; }
  const r = await attUnlockMonth(ym, reason); attDlgClose('attUnlockModal');
  if(r.ok) showToast('🔓 Đã mở khoá kỳ chấm công'); else attFail(r.reason, r.error);
  renderChamCong();
}

// ═════════ LỊCH SỬ SỬA ═════════
async function attOpenAudit(){
  const ym = curYM();
  attDialog('attAuditModal', '📜 Lịch sử chỉnh sửa tháng '+ym.split('-')[1]+'/'+ym.split('-')[0], `<div id="aa_body" class="att2-audit"><div class="att2-empty-s">⏳ Đang tải…</div></div>`,
    `<button class="btn btn-ghost" onclick="attDlgClose('attAuditModal')">Đóng</button>`);
  const list = (await attAuditLoad(ym)).filter(a=>!/^sch/.test(a.ty||'')); const el = document.getElementById('aa_body'); if(!el) return;
  const nameOf = id => ((DB.workers||[]).find(w=>w.id===id)||{}).name || '(đã xoá)';
  if(!list.length){ el.innerHTML = '<div class="att2-empty-s">Chưa có lịch sử chỉnh sửa nào được ghi lại cho tháng này.</div>'; return; }
  const what = a => {
    if(a.ty==='cell') return `${attEsc(a.wn||nameOf(a.wid))} · ngày ${a.d}: ${a.o?attEsc(a.o):'—'} → <b>${a.n?attEsc(a.n):'(xoá)'}</b>`;
    if(a.ty==='bulk') return `${attEsc(a.m||'Hàng loạt')}: <b>${a.c}</b> ô` + (a.det?`<br><small>${a.det.slice(0,4).map(d=>attEsc(nameOf(d[0]))+' ng.'+d[1]+': '+(d[2]||'—')+'→'+(d[3]||'xoá')).join(' · ')}${a.det.length>4?' …':''}</small>`:'');
    if(a.ty==='note') return `Ghi chú ${attEsc(nameOf(a.wid))}: ${attEsc(a.n||'(xoá)')}`;
    if(a.ty==='holiday') return `Ngày lễ ${attEsc(a.d)}: ${attEsc(a.n)}`;
    return attEsc(a.m||a.ty);
  };
  el.innerHTML = `<table class="att2-audit-t"><thead><tr><th>Thời gian</th><th>Người sửa</th><th>Nội dung</th></tr></thead><tbody>${list.slice(0,200).map(a=>`<tr><td>${attEsc(vnDateTimeShort(a.t))}</td><td>${attEsc(a.by||'?')}</td><td>${what(a)}</td></tr>`).join('')}</tbody></table>${list.length>200?'<div class="att2-empty-s">Hiển thị 200 dòng mới nhất.</div>':''}`;
}

// ═════════ NGÀY LỄ (Admin) ═════════
function attOpenHolidays(){
  if(!isAdmin()){ attFail('noperm'); return; }
  const y = curYM().slice(0,4); const hol = attHolidays();
  const list = Object.keys(hol).filter(d=>d.startsWith(y)).sort();
  attDialog('attHolModal', '🎌 Ngày lễ năm '+y, `
    <div class="att2-dlg-note">Ngày lễ được tô màu trên bảng và <b>không bị tính là “thiếu dữ liệu”</b>. Ngày lễ âm lịch (Tết, Giỗ Tổ…) thay đổi theo năm nên Admin tự nhập theo thông báo của công ty.</div>
    <div class="att2-hol-l">${list.length?list.map(d=>`<div class="att2-hol-i"><span><b>${attEsc(fmtDate(d))}</b> · ${attEsc(hol[d])}</span><button class="icon-btn del" onclick="attDelHoliday('${d}')" title="Xoá">🗑</button></div>`).join(''):'<div class="att2-empty-s">Chưa khai báo ngày lễ nào cho năm này.</div>'}</div>
    <div class="modal-row"><div class="field"><div class="field-lbl">Ngày</div><input id="ah_d" type="date" class="field-inp" value="${y}-01-01"></div><div class="field"><div class="field-lbl">Tên ngày lễ</div><input id="ah_n" class="field-inp" maxlength="60" placeholder="VD: Quốc khánh"></div></div>`,
    `<button class="btn btn-ghost" onclick="attAddFixedHolidays()" title="1/1, 30/4, 1/5, 2/9 — ngày dương lịch cố định">＋ 4 ngày lễ dương lịch cố định</button><button class="btn btn-ghost" onclick="attDlgClose('attHolModal')">Đóng</button><button class="btn btn-primary" onclick="attAddHoliday()">Thêm</button>`);
}
function attAddHoliday(){
  const d = document.getElementById('ah_d').value, n = document.getElementById('ah_n').value.trim();
  if(!d || !n){ showToast('⚠️ Nhập ngày và tên ngày lễ', true); return; }
  const r = attSetHoliday(d, n); if(!r.ok){ attFail(r.reason); return; }
  attOpenHolidays(); if(currentTab==='chamCong') renderChamCong();
}
function attAddFixedHolidays(){
  const y = curYM().slice(0,4);
  [['01-01','Tết Dương lịch'],['04-30','Ngày Giải phóng miền Nam'],['05-01','Quốc tế Lao động'],['09-02','Quốc khánh']].forEach(([md,nm])=>{ if(!attHolidays()[y+'-'+md]) attSetHoliday(y+'-'+md, nm); });
  attOpenHolidays(); if(currentTab==='chamCong') renderChamCong();
}
function attDelHoliday(d){
  confirm2('Xoá ngày lễ', 'Xoá ngày lễ '+fmtDate(d)+'? Ngày này sẽ lại được tính là ngày thường khi kiểm tra thiếu dữ liệu.', ()=>{
    attSetHoliday(d, null); attOpenHolidays(); if(currentTab==='chamCong') renderChamCong();
  });
}
