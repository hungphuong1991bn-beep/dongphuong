// src/modules/attendance/schedule-view.js  — GIAI ĐOẠN 2 (v2.7.0)
// Lịch làm việc: Theo bộ phận (bảng cũ, giữ nguyên) · Ngày · Tuần · Tháng · Ca làm việc.
// Dữ liệu & quy tắc: schedule-core.js / schedule-service.js. Chỉ Admin sửa; nhân viên & Viewer chỉ xem.

let _sch = (function(){ try{ return Object.assign({mode:'sheet', date:'', dept:'all'}, JSON.parse(sessionStorage.getItem('sx_sch_state')||'{}')); }catch(e){ return {mode:'sheet', date:'', dept:'all'}; } })();
function schSaveState(){ try{ sessionStorage.setItem('sx_sch_state', JSON.stringify(_sch)); }catch(e){} }
function schCurDate(){ if(!schValidDate(_sch.date)) _sch.date = todayStr(); return _sch.date; }
function schDeptList(){ return Array.from(new Set((DB.workers||[]).map(w=>(w.boPhan||'').trim()).filter(Boolean))).sort(); }
function schShortName(s){ return s ? s.name : 'Chưa phân'; }
function schPill(s, dim){ return s ? `<span class="sch2-pill${dim?' is-def':''}" style="background:${s.bg};color:${s.color}" title="${attEsc(schShiftLabel(s))}">${attEsc(s.name)}</span>` : '<span class="sch2-none">—</span>'; }

function schSetMode(m){ _sch.mode = m; schSaveState(); renderLichLamViec(); }
function schSetDate(v){ if(!schValidDate(v) && !/^\d{4}-\d{2}$/.test(v||'')) return; _sch.date = v.length===7 ? v+'-01' : v; schSaveState(); renderLichLamViec(); }
function schNav(dir){
  const d = schCurDate();
  if(_sch.mode==='week') _sch.date = schAddDays(d, 7*dir);
  else if(_sch.mode==='month') _sch.date = attShiftYM(d.slice(0,7), dir) + '-01';
  else _sch.date = schAddDays(d, dir);
  schSaveState(); renderLichLamViec();
}
function schToday(){ _sch.date = todayStr(); schSaveState(); renderLichLamViec(); }
function schSetDept(v){ _sch.dept = v; schSaveState(); renderLichLamViec(); }
function schGoDay(ds){ _sch.mode = 'day'; _sch.date = ds; schSaveState(); renderLichLamViec(); }

function schModeBar(){
  const modes = [['sheet','📋 Theo bộ phận'],['day','📅 Ngày'],['week','🗓 Tuần'],['month','📆 Tháng'],['shifts','⚙️ Ca làm việc']];
  const showNav = ['day','week','month'].includes(_sch.mode), d = schCurDate();
  const nav = showNav ? `<div class="sch2-nav">
      <button class="chip" onclick="schNav(-1)" aria-label="Trước">←</button>
      ${_sch.mode==='month' ? `<input type="month" class="field-inp sch2-date" value="${d.slice(0,7)}" onchange="schSetDate(this.value)">` : `<input type="date" class="field-inp sch2-date" value="${d}" onchange="schSetDate(this.value)">`}
      <button class="chip" onclick="schNav(1)" aria-label="Sau">→</button>
      <button class="chip" onclick="schToday()">Hôm nay</button>
      <select class="field-inp sch2-dept" onchange="schSetDept(this.value)" aria-label="Bộ phận"><option value="all">Tất cả bộ phận</option>${schDeptList().map(x=>`<option value="${attEsc(x)}"${_sch.dept===x?' selected':''}>${attEsc(x)}</option>`).join('')}</select></div>` : '';
  return `<div class="card sch2-bar"><div class="sch2-modes">${modes.map(m=>`<button class="chip${_sch.mode===m[0]?' active':''}" onclick="schSetMode('${m[0]}')">${m[1]}</button>`).join('')}</div>${nav}</div>`;
}

// ── Điểm vào: giữ tên renderLichLamViec (router & mã cũ vẫn gọi) ──
function renderLichLamViec(){
  if(_sch.mode==='sheet'){ llvRenderSheets(); $('mc').insertAdjacentHTML('afterbegin', schModeBar()); return; }
  let body = '';
  if(_sch.mode==='day') body = schDayHtml(); else if(_sch.mode==='week') body = schWeekHtml(); else if(_sch.mode==='month') body = schMonthHtml(); else body = schShiftsHtml();
  $('mc').innerHTML = `<div class="sch2">${schModeBar()}${body}</div>`;
}

function schToolbar(){
  if(!schCanEdit()) return `<div class="card sch2-ro">${isViewer()?'👁 Tài khoản Xem':'🔒 Chỉ Admin phân ca'} — bạn chỉ xem được lịch. Nghỉ phép đã duyệt được tự nhận diện.</div>`;
  const b=(on,t,c)=>`<button class="set-btn sch2-btn ${c||''}" onclick="${on}">${t}</button>`;
  return `<div class="card sch2-tools">${b("schOpenBulk('assign')",'⚡ Phân ca hàng loạt','sch2-btn--pri')}${b("schOpenBulk('copyweek')",'📋 Sao chép từ tuần trước')}${b("schOpenBulk('copymonth')",'📋 Sao chép từ tháng trước')}${b("schOpenBulk('rotate')",'🔄 Luân phiên theo tuần')}${b("schOpenBulk('swap')",'⇄ Đổi ca 2 người')}${b('schOpenOT()','⏱ Đăng ký tăng ca')}${b('schOpenHistory()','📜 Lịch sử điều chỉnh')}</div>`;
}
const schCard = (lbl, val, cls, sub) => `<div class="att2-card ${cls||''}"><div class="att2-card-v">${val}</div><div class="att2-card-l">${lbl}</div>${sub?`<div class="att2-card-s">${sub}</div>`:''}</div>`;

// ═════════ NGÀY ═════════
function schDayHtml(){
  const ds = schCurDate(), r = schDayRoster(ds, _sch.dept), t = r.totals, edit = schCanEdit();
  const [y,m,d] = ds.split('-').map(Number), hol = attHolidays()[ds];
  const chip = (it, sh) => { const nm = attEsc(it.w.name||'(chưa đặt tên)'); const extra = (it.reg>0?` <small title="Đăng ký tăng ca ${it.reg}h">⏱${it.reg}h</small>`:'');
    return edit ? `<button class="sch2-chip${it.src==='default'?' is-def':''}" onclick="schOpenAssign('${it.w.id}','${ds}')" title="${it.src==='default'?'Ca mặc định từ bảng bộ phận — bấm để phân riêng':'Đã phân riêng — bấm để đổi'}">${nm}${extra}</button>` : `<span class="sch2-chip${it.src==='default'?' is-def':''}">${nm}${extra}</span>`; };
  const cols = r.shifts.map(x=>{ const s = x.shift, pct = x.min>0 ? Math.min(100, Math.round(x.actual/x.min*100)) : (x.actual?100:0);
    return `<div class="sch2-col${x.short?' is-short':''}"><div class="sch2-col-h" style="background:${s.bg};color:${s.color}"><b>${attEsc(s.name)}</b><span>${s.start&&s.end?s.start+'–'+s.end:''}</span></div>
      <div class="sch2-col-s"><b>${x.actual}</b>${x.min?` / ${x.min} người`:' người'} ${x.short?`<span class="sch2-warn">⚠ Thiếu ${x.short}</span>`:(x.min?'<span class="sch2-okt">✓ Đủ</span>':'')}</div>
      ${x.min?`<div class="att2-bar"><i style="width:${pct}%;background:${x.short?'var(--red-m)':'var(--green-m)'}"></i></div>`:''}
      <div class="sch2-chips">${x.items.length?x.items.map(it=>chip(it,s)).join(''):'<span class="att2-empty-s">Chưa có ai</span>'}</div></div>`; }).join('');
  const side = (title, arr, fn, cls) => `<div class="card sch2-side ${cls||''}"><div class="sch2-side-h">${title} <b>${arr.length}</b></div>${arr.length?arr.map(fn).join(''):'<span class="att2-empty-s">Không có</span>'}</div>`;
  return `${schToolbar()}
  <div class="card sch2-dayhead"><div class="att2-title">${weekdayVN(y,m,d)}, ${schPad(d)}/${schPad(m)}/${y} ${hol?`<span class="att2-pill" style="background:var(--amber-l);color:var(--amber)">🎌 ${attEsc(hol)}</span>`:''}${schIsSunday(ds)?'<span class="att2-pill att2-pill--lock">Chủ nhật</span>':''}</div>
    <div class="att2-empty-s">${_sch.dept==='all'?'Tất cả bộ phận':'Bộ phận '+attEsc(_sch.dept)} · ${t.workers} nhân viên đang làm (lấy từ Quản lý nhân sự). Ca <i>in nghiêng</i> = ca mặc định từ bảng lịch bộ phận, chưa phân riêng cho ngày này.</div></div>
  <div class="att2-dash sch2-dash">${schCard('Nhân lực cần thiết', t.required||'—', '', t.required?'tổng quân số tối thiểu các ca':'chưa đặt quân số tối thiểu')}${schCard('Nhân lực thực tế', t.actual, 'ok', 'đang xếp vào ca')}${schCard('Số người thiếu', t.short, t.short?'bad':'ok', t.short?'cần bổ sung':'đủ theo quân số')}${schCard('Đang nghỉ', t.leave, '', 'nghỉ phép đã duyệt + xếp "Nghỉ"')}${schCard('Tăng ca', t.ot, '', 'đăng ký / đã chấm')}${schCard('Chưa phân ca', t.unassigned, t.unassigned?'warn':'', 'chưa có ca nào')}${schCard('Tỷ lệ đáp ứng', t.response===null?'—':t.response+'%', t.response===null?'':(t.response>=100?'ok':t.response>=80?'warn':'bad'), 'theo quân số tối thiểu')}</div>
  ${t.short?`<div class="att2-lock">⚠️ <b>Thiếu nhân lực ngày này:</b> ${r.shifts.filter(x=>x.short).map(x=>attEsc(x.shift.name)+' thiếu '+x.short).join(' · ')}</div>`:''}
  <div class="sch2-cols">${cols}</div>
  <div class="sch2-sides">
    ${side('🏖 Đang nghỉ', r.leave, x=>`<div class="sch2-li">${attEsc(x.w.name)} <small>${attEsc(x.type)}</small></div>`)}
    ${side('⏱ Tăng ca', r.ot, x=>`<div class="sch2-li">${attEsc(x.w.name)} <small>${x.reg?'đăng ký '+x.reg+'h':''}${x.reg&&x.actual?' · ':''}${x.actual?'đã chấm '+x.actual+'h':''}</small></div>`)}
    ${side('❓ Chưa phân ca', r.unassigned, w=>edit?`<button class="sch2-chip" onclick="schOpenAssign('${w.id}','${ds}')">${attEsc(w.name)}</button>`:`<span class="sch2-chip">${attEsc(w.name)}</span>`, r.unassigned.length?'is-warn':'')}
    ${r.conflicts.length?side('⚠️ Cảnh báo', r.conflicts, c=>`<div class="sch2-li"><b>${attEsc(c.w.name)}</b> <small>${attEsc(c.text)}</small></div>`, 'is-warn'):''}
  </div>`;
}

// ═════════ TUẦN ═════════
function schWeekHtml(){
  const dates = schWeekDates(schCurDate()), ctx = schMakeCtx(), workers = schScopeWorkers(_sch.dept), edit = schCanEdit(), today = todayStr();
  const rosters = dates.map(ds=>schDayRoster(ds, _sch.dept, ctx));
  const head = dates.map((ds,i)=>{ const [y,m,d]=ds.split('-').map(Number); const hol=ctx.hol[ds]; return `<th class="${schIsSunday(ds)?'is-sun':''}${hol?' is-hol':''}${ds===today?' is-today':''}" title="${hol?attEsc(hol):''}"><a href="javascript:schGoDay('${ds}')">${weekdayVN(y,m,d)}<br>${schPad(d)}/${schPad(m)}</a></th>`; }).join('');
  const rows = workers.map(w=>`<tr><td class="sch2-w-name" title="${attEsc(w.name||'')}">${attEsc(w.name||'(chưa đặt tên)')}<small>${attEsc(w.boPhan||'')}</small></td>${dates.map(ds=>{
      const lv = schLeaveOn(ctx, w, ds), eff = schEffective(ctx, w, ds), s = ctx.cat[eff.id], bad = lv && eff.src==='assigned' && s && s.kind!=='off';
      const inner = lv ? `<span class="sch2-pill sch2-pill--leave" title="${attEsc(lv)}">🏖 Nghỉ</span>` : schPill(s && s.active!==false ? s : (s||null), eff.src==='default');
      return `<td class="${schIsSunday(ds)?'is-sun':''}${bad?' is-bad':''}" ${edit?`onclick="schOpenAssign('${w.id}','${ds}')" style="cursor:pointer"`:''}>${inner}${bad?'<span class="sch2-warn">⚠</span>':''}</td>`; }).join('')}</tr>`).join('');
  const foot = rosters.map(r=>`<td class="${r.totals.short?'is-bad':''}"><b>${r.totals.actual}</b>${r.totals.required?`/${r.totals.required}`:''}${r.totals.short?`<div class="sch2-warn">Thiếu ${r.totals.short}</div>`:''}</td>`).join('');
  if(!workers.length) return `${schToolbar()}<div class="card att2-empty"><div class="att2-empty-i">👥</div><div class="att2-empty-t">Chưa có nhân viên đang làm${_sch.dept!=='all'?' ở bộ phận này':''}</div><div class="att2-empty-d">Danh sách lấy từ Quản lý nhân sự.</div><button class="set-btn att2-btn" onclick="goTab('nhanSu')">👥 Mở Quản lý nhân sự</button></div>`;
  return `${schToolbar()}<div class="card sch2-weekcard"><div class="att2-captitle">Lịch tuần ${schPad(+dates[0].slice(8,10))}/${dates[0].slice(5,7)} – ${schPad(+dates[6].slice(8,10))}/${dates[6].slice(5,7)}/${dates[6].slice(0,4)}</div>
    <div class="att2-scroll sch2-scroll"><table class="sch2-weektable"><thead><tr><th class="sch2-w-name">Nhân viên</th>${head}</tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td class="sch2-w-name"><b>Nhân lực / cần</b></td>${foot}</tr></tfoot></table></div>
    <div class="att2-legend">${schCatalog().filter(s=>s.kind!=='off'||true).map(s=>`<span class="att2-key">${schPill(s)}</span>`).join('')}<span class="att2-key"><span class="sch2-pill is-def" style="background:#f1f5f9;color:#475569">in nghiêng</span> ca mặc định (chưa phân riêng)</span><span class="att2-key"><span class="sch2-pill sch2-pill--leave">🏖 Nghỉ</span> nghỉ phép đã duyệt</span></div></div>`;
}

// ═════════ THÁNG ═════════
function schMonthHtml(){
  const ym = schCurDate().slice(0,7), sum = schMonthSummary(ym, _sch.dept), cat = {}; schCatalog(true).forEach(s=>cat[s.id]=s);
  const first = ym+'-01', off = schDow(first), today = todayStr(), edit = schCanEdit();
  const shortDays = sum.filter(x=>x.short>0).length, shortTotal = sum.reduce((a,x)=>a+x.short,0), leaveTotal = sum.reduce((a,x)=>a+x.leave,0), otTotal = sum.reduce((a,x)=>a+x.ot,0);
  let cells = ''; for(let i=0;i<off;i++) cells += '<div class="sch2-mc is-blank"></div>';
  sum.forEach(x=>{ const d = +x.date.slice(8,10), hol = attHolidays()[x.date];
    cells += `<button class="sch2-mc${schIsSunday(x.date)?' is-sun':''}${hol?' is-hol':''}${x.date===today?' is-today':''}${x.short?' is-short':''}" onclick="schGoDay('${x.date}')" title="${hol?attEsc(hol):''}"><div class="sch2-mc-d">${d}${x.short?' <span class="sch2-warn">⚠</span>':''}</div>
      <div class="sch2-mc-p">${x.counts.filter(c=>c.actual>0).map(c=>{ const s = cat[c.id]; return s?`<i style="background:${s.bg};color:${s.color}" class="${c.short?'is-short':''}">${attEsc(s.name)} ${c.actual}${c.min?'/'+c.min:''}</i>`:''; }).join('')}</div>
      <div class="sch2-mc-f">${x.leave?`<span>🏖${x.leave}</span>`:''}${x.ot?`<span>⏱${x.ot}</span>`:''}${x.unassigned?`<span title="Chưa phân ca">❓${x.unassigned}</span>`:''}</div></button>`; });
  const [y,m] = ym.split('-').map(Number);
  return `${schToolbar()}
  <div class="att2-dash sch2-dash">${schCard('Ngày thiếu nhân lực', shortDays, shortDays?'bad':'ok', 'trên '+sum.length+' ngày')}${schCard('Lượt người thiếu', shortTotal, shortTotal?'bad':'', 'cộng dồn các ngày')}${schCard('Lượt nghỉ', leaveTotal, '', 'ngày-người nghỉ')}${schCard('Lượt tăng ca', otTotal, '', 'ngày-người có tăng ca')}</div>
  ${!schCatalog().some(s=>s.minStaff>0)?'<div class="att2-info">ℹ️ Chưa đặt <b>quân số tối thiểu</b> cho ca nào nên chưa có cảnh báo thiếu nhân lực. Admin đặt ở tab “⚙️ Ca làm việc”.</div>':''}
  <div class="card sch2-month"><div class="att2-captitle">Tháng ${m}/${y}</div><div class="sch2-mgrid">${['T2','T3','T4','T5','T6','T7','CN'].map(x=>`<div class="sch2-mh">${x}</div>`).join('')}${cells}</div></div>`;
}

// ═════════ CA LÀM VIỆC ═════════
function schShiftsHtml(){
  const admin = isAdmin(), list = schCatalog(true);
  return `${admin?`<div class="card sch2-tools"><button class="set-btn sch2-btn sch2-btn--pri" onclick="schOpenShiftEditor('')">➕ Tạo ca mới</button></div>`:'<div class="card sch2-ro">🔒 Chỉ Admin được tạo/sửa ca. Bạn chỉ xem được danh mục.</div>'}
  <div class="att2-info">ℹ️ <b>Nghỉ giữa ca</b> và <b>quân số tối thiểu</b> chưa có quy định nên mặc định 0 (không cảnh báo). Admin nhập theo quy định của công ty.</div>
  <div class="card"><div class="att2-scroll sch2-scroll"><table class="sch2-shifttable"><thead><tr><th>Ca</th><th>Giờ làm</th><th>Nghỉ giữa ca</th><th>Số giờ làm</th><th>Quân số tối thiểu</th><th>Loại</th><th>Trạng thái</th>${admin?'<th></th>':''}</tr></thead><tbody>
  ${list.map(s=>{ const h = schShiftHours(s); return `<tr class="${s.active?'':'is-off'}"><td>${schPill(s)}${s.builtin?' <small>có sẵn</small>':''}</td><td>${s.kind==='off'?'—':(s.start+' – '+s.end)}</td><td>${s.kind==='off'?'—':s.breakMin+' phút'}</td><td>${h===null?'—':h+' giờ'}</td><td>${s.kind==='off'?'—':(s.minStaff||'<span class="att2-empty-s">chưa đặt</span>')}</td><td>${s.type==='fixed'?'Cố định':s.type==='rotating'?'Luân phiên':'<span class="att2-empty-s">chưa chọn</span>'}</td><td>${s.active?'Đang dùng':'Ngừng dùng'}</td>${admin?`<td><button class="chip" onclick="schOpenShiftEditor('${s.id}')">✏️ Sửa</button> <button class="chip" onclick="schToggleShift('${s.id}',${s.active?'false':'true'})">${s.active?'Ngừng':'Dùng lại'}</button></td>`:''}</tr>`; }).join('')}
  </tbody></table></div></div>`;
}
function schOpenShiftEditor(id){
  if(!isAdmin()){ attFail('noperm'); return; }
  const s = id ? schShiftById(id) : {id:'', name:'', start:'06:00', end:'14:00', breakMin:0, minStaff:0, type:'', kind:'work'}; if(!s) return;
  const off = s.kind==='off';
  attDialog('schShiftModal', id?'✏️ Sửa ca '+attEsc(s.name):'➕ Tạo ca mới', `
    <div class="field"><div class="field-lbl">Tên ca *</div><input id="se_name" class="field-inp" maxlength="30" value="${attEsc(s.name)}"></div>
    ${off?'':`<div class="modal-row"><div class="field"><div class="field-lbl">Giờ bắt đầu *</div><input id="se_start" type="time" class="field-inp" value="${s.start}"></div><div class="field"><div class="field-lbl">Giờ kết thúc *</div><input id="se_end" type="time" class="field-inp" value="${s.end}"></div></div>
    <div class="modal-row"><div class="field"><div class="field-lbl">Nghỉ giữa ca (phút)</div><input id="se_break" type="number" min="0" max="240" class="field-inp" value="${s.breakMin}"></div><div class="field"><div class="field-lbl">Quân số tối thiểu</div><input id="se_min" type="number" min="0" max="999" class="field-inp" value="${s.minStaff}"></div></div>
    <div class="field"><div class="field-lbl">Loại ca</div><select id="se_type" class="field-inp"><option value="">Chưa chọn</option><option value="fixed"${s.type==='fixed'?' selected':''}>Ca cố định</option><option value="rotating"${s.type==='rotating'?' selected':''}>Ca luân phiên</option></select></div>`}
    <div id="se_err" class="att2-bad"></div>`,
    `<button class="btn btn-ghost" onclick="attDlgClose('schShiftModal')">Hủy</button><button class="btn btn-primary" id="se_go" onclick="schDoSaveShift('${id||''}')">Lưu</button>`);
}
async function schDoSaveShift(id){
  const g = x => { const e = document.getElementById(x); return e ? e.value : undefined; }, cur = id ? schShiftById(id) : null;
  const def = {id:id||'', name:g('se_name'), start:g('se_start')!==undefined?g('se_start'):(cur&&cur.start)||'', end:g('se_end')!==undefined?g('se_end'):(cur&&cur.end)||'', breakMin:g('se_break')!==undefined?g('se_break'):0, minStaff:g('se_min')!==undefined?g('se_min'):0, type:g('se_type')||'', kind:(cur&&cur.kind)||'work'};
  if(cur && cur.kind==='off'){ def.minStaff = 0; def.breakMin = 0; }
  const b = document.getElementById('se_go'); b.disabled = true; b.textContent = 'Đang lưu…';
  const r = await schSaveShift(def);
  if(!r.ok && r.reason==='invalid'){ b.disabled = false; b.textContent = 'Lưu'; document.getElementById('se_err').textContent = '⚠️ ' + (r.errors||[]).join(' · '); return; }
  attDlgClose('schShiftModal');
  if(!r.ok && r.reason) attFail(r.reason); else if(!r.ok) showToast('⚠️ Đã lưu trên máy nhưng CHƯA gửi được lên máy chủ — sẽ tự gửi lại khi có mạng', true); else showToast('✅ Đã lưu ca và đồng bộ');
  renderLichLamViec();
}
async function schToggleShift(id, active){
  const s = schShiftById(id); if(!s) return;
  const go = async()=>{ const r = await schSetShiftActive(id, active); if(!r.ok && r.reason) attFail(r.reason); else if(!r.ok) showToast('⚠️ Chưa gửi được lên máy chủ — sẽ tự gửi lại', true); else showToast(active?'✅ Đã dùng lại ca':'✅ Đã ngừng dùng ca'); renderLichLamViec(); };
  if(!active) confirm2('Ngừng dùng ca', `Ngừng dùng "${s.name}"? Ca này sẽ không còn trong danh sách chọn. Lịch đã phân trước đây KHÔNG bị xoá.`, go); else go();
}

// ═════════ PHÂN CA 1 NGƯỜI ═════════
function schOpenAssign(wid, ds){
  if(!schCanEdit()){ attFail(isViewer()?'viewer':'noperm'); return; }
  const w = (DB.workers||[]).find(x=>x.id===wid); if(!w) return; const ctx = schMakeCtx(), eff = schEffective(ctx, w, ds), lv = schLeaveOn(ctx, w, ds), cur = schAssigned(w, ds);
  attDialog('schAssignModal', '🔁 Đổi ca · '+attEsc(w.name||''), `
    <div class="att2-dlg-note">Ngày <b>${attEsc(fmtDate(ds))}</b> · ${attEsc(w.boPhan||'')} · hiện tại: ${eff.id?schPill(ctx.cat[eff.id], eff.src==='default')+(eff.src==='default'?' (ca mặc định)':''):'chưa có ca'}</div>
    ${lv?`<div class="att2-bad" style="margin-bottom:8px">⚠️ Nhân viên có đơn nghỉ phép đã duyệt ngày này (${attEsc(lv)}). Xếp ca vẫn được nhưng sẽ bị cảnh báo trùng.</div>`:''}
    <div class="field"><div class="field-lbl">Ca làm việc</div><select id="sa_shift" class="field-inp"><option value="">(Bỏ phân riêng — dùng ca mặc định)</option>${schCatalog().map(s=>`<option value="${s.id}"${cur===s.id?' selected':''}>${attEsc(schShiftLabel(s))}</option>`).join('')}${cur&&!ctx.cat[cur]?`<option value="${attEsc(cur)}" selected>${attEsc(cur)} (không còn)</option>`:''}</select></div>`,
    `<button class="btn btn-ghost" onclick="attDlgClose('schAssignModal')">Hủy</button><button class="btn btn-primary" onclick="schDoAssign('${wid}','${ds}')">Lưu</button>`);
}
async function schDoAssign(wid, ds){
  const v = document.getElementById('sa_shift').value; attDlgClose('schAssignModal');
  const r = await schSetAssign(ds, wid, v);
  if(!r.ok && r.reason) attFail(r.reason); else if(!r.ok) showToast('⚠️ Đã lưu trên máy nhưng CHƯA gửi được lên máy chủ — sẽ tự gửi lại', true); else showToast('✅ Đã cập nhật ca và đồng bộ');
  renderLichLamViec();
}

// ═════════ HÀNG LOẠT / SAO CHÉP / LUÂN PHIÊN / ĐỔI CA ═════════
let _schBulk = {kind:'assign', plan:null};
function schOpenBulk(kind){
  if(!schCanEdit()){ attFail(isViewer()?'viewer':'noperm'); return; }
  const workers = schScopeWorkers(_sch.dept); if(!workers.length){ showToast('⚠️ Không có nhân viên đang làm trong phạm vi này', true); return; }
  _schBulk = {kind, plan:null}; const d = schCurDate(), mon = schMonday(d), cat = schCatalog().filter(s=>s.kind!=='off'||kind==='assign');
  const titles = {assign:'⚡ Phân ca hàng loạt', copyweek:'📋 Sao chép lịch từ tuần trước', copymonth:'📋 Sao chép lịch từ tháng trước', rotate:'🔄 Luân phiên ca theo tuần', swap:'⇄ Đổi ca giữa 2 nhân viên'};
  const shiftSel = (id,withClear)=>`<select id="${id}" class="field-inp" onchange="schBulkPreview()">${withClear?'<option value="">(Bỏ phân riêng — dùng ca mặc định)</option>':''}${cat.map(s=>`<option value="${s.id}">${attEsc(schShiftLabel(s))}</option>`).join('')}</select>`;
  const dates = (a,b)=>`<div class="modal-row"><div class="field"><div class="field-lbl">Từ ngày</div><input id="${a}" type="date" class="field-inp" value="${d}" oninput="schBulkPreview()"></div><div class="field"><div class="field-lbl">Đến ngày</div><input id="${b}" type="date" class="field-inp" value="${schAddDays(d,6)}" oninput="schBulkPreview()"></div></div>`;
  const modeBox = `<div class="field"><div class="field-lbl">Khi ngày đã được phân ca riêng</div><label class="att2-chk"><input type="radio" name="sb_mode" value="empty" checked onchange="schBulkPreview()"> Chỉ điền ô <b>chưa phân</b></label><label class="att2-chk"><input type="radio" name="sb_mode" value="overwrite" onchange="schBulkPreview()"> <b>Ghi đè</b> (cần xác nhận)</label></div>`;
  const opts = (sun)=>`<div class="field">${sun?'<label class="att2-chk"><input type="checkbox" id="sb_sun" checked onchange="schBulkPreview()"> Bỏ qua Chủ nhật</label>':''}<label class="att2-chk"><input type="checkbox" id="sb_leave" checked onchange="schBulkPreview()"> Bỏ qua ngày nghỉ phép <b>đã duyệt</b></label></div>`;
  let body = '';
  if(kind==='assign') body = `<div class="field"><div class="field-lbl">Ca làm việc</div>${shiftSel('sb_shift', true)}</div>${dates('sb_from','sb_to')}${modeBox}<div class="field"><label class="att2-chk"><input type="checkbox" id="sb_hol" checked onchange="schBulkPreview()"> Bỏ qua ngày lễ</label></div>${opts(true)}`;
  else if(kind==='copyweek') body = `<div class="field"><div class="field-lbl">Tuần đích (chọn 1 ngày bất kỳ trong tuần)</div><input id="sb_dst" type="date" class="field-inp" value="${d}" oninput="schBulkPreview()"></div><div id="sb_srcinfo" class="att2-dlg-note"></div>${modeBox}${opts(false)}`;
  else if(kind==='copymonth') body = `<div class="field"><div class="field-lbl">Tháng đích</div><input id="sb_ym" type="month" class="field-inp" value="${d.slice(0,7)}" oninput="schBulkPreview()"></div><div id="sb_srcinfo" class="att2-dlg-note"></div>${modeBox}${opts(false)}`;
  else if(kind==='rotate') body = `<div class="field"><div class="field-lbl">Các ca luân phiên (theo thứ tự)</div>${schCatalog().filter(s=>s.kind==='work').map(s=>`<label class="att2-chk"><input type="checkbox" class="sb_rot" value="${s.id}" ${['ca1','ca2','ca3'].includes(s.id)?'checked':''} onchange="schBulkPreview()"> ${attEsc(schShiftLabel(s))}</label>`).join('')}</div>${dates('sb_from','sb_to').replace(schAddDays(d,6), schAddDays(d,13))}<div class="field"><div class="field-lbl">Lệch vòng (0 = người đầu danh sách bắt đầu từ ca đầu)</div><input id="sb_off" type="number" min="0" max="20" class="field-inp" value="0" oninput="schBulkPreview()"></div><div class="att2-dlg-note">Người thứ <i>i</i>, tuần thứ <i>k</i> nhận ca thứ (i + k + lệch) mod số ca. Danh sách người sắp theo tên.</div>${modeBox}${opts(true)}`;
  else if(kind==='swap') body = `<div class="modal-row"><div class="field"><div class="field-lbl">Nhân viên A</div><select id="sb_a" class="field-inp" onchange="schBulkPreview()">${workers.map(w=>`<option value="${w.id}">${attEsc(w.name||'')}</option>`).join('')}</select></div><div class="field"><div class="field-lbl">Nhân viên B</div><select id="sb_b" class="field-inp" onchange="schBulkPreview()">${workers.map((w,i)=>`<option value="${w.id}"${i===1?' selected':''}>${attEsc(w.name||'')}</option>`).join('')}</select></div></div>${dates('sb_from','sb_to')}<div class="att2-dlg-note">Mỗi ngày: A nhận ca của B và ngược lại. Ngày một người nghỉ phép / chưa có ca sẽ bỏ qua.</div>`;
  attDialog('schBulkModal', titles[kind], `<div class="att2-dlg-note">Phạm vi: <b>${workers.length}</b> nhân viên đang làm${_sch.dept!=='all'?' · bộ phận '+attEsc(_sch.dept):' · tất cả bộ phận'}.</div>${body}<div id="sb_prev" class="att2-prev"></div><label class="att2-chk att2-confirm" id="sb_okwrap" style="display:none"><input type="checkbox" id="sb_ok" onchange="schBulkPreview()"> <span id="sb_oktxt"></span></label>`,
    `<button class="btn btn-ghost" onclick="attDlgClose('schBulkModal')">Hủy</button><button class="btn btn-primary" id="sb_go" onclick="schBulkApply()" disabled>Áp dụng</button>`);
  schBulkPreview();
}
function schBulkRead(){
  const g = id => document.getElementById(id), k = _schBulk.kind, workers = schScopeWorkers(_sch.dept), ctx = schMakeCtx();
  const mode = (document.querySelector('input[name="sb_mode"]:checked')||{}).value || 'empty', skipLeave = g('sb_leave') ? g('sb_leave').checked : false;
  const rng = ()=>({from:g('sb_from').value, to:g('sb_to').value}), okR = r => schValidDate(r.from) && schValidDate(r.to) && r.from <= r.to && schDiffDays(r.from, r.to) <= 120;
  if(k==='assign'){ const r = rng(); if(!okR(r)) return {err:'Khoảng ngày không hợp lệ (tối đa 120 ngày)'}; return {plan:schPlanAssign({ctx, workers, from:r.from, to:r.to, shiftId:g('sb_shift').value, mode, skipSun:g('sb_sun').checked, skipHol:g('sb_hol').checked, skipLeave})}; }
  if(k==='copyweek'){ const dst = g('sb_dst').value; if(!schValidDate(dst)) return {err:'Chọn tuần đích'}; const dm = schMonday(dst), sm = schAddDays(dm, -7); g('sb_srcinfo').innerHTML = `Sao chép lịch tuần <b>${fmtDate(sm)} – ${fmtDate(schAddDays(sm,6))}</b> → tuần <b>${fmtDate(dm)} – ${fmtDate(schAddDays(dm,6))}</b>. Ca mặc định cũng được chuyển thành phân riêng.`; return {plan:schPlanCopy({ctx, workers, srcFrom:sm, dstFrom:dm, days:7, mode, skipLeave})}; }
  if(k==='copymonth'){ const ym = g('sb_ym').value; if(!attValidYM(ym)) return {err:'Chọn tháng đích'}; g('sb_srcinfo').innerHTML = `Sao chép ngày d của tháng <b>${attShiftYM(ym,-1)}</b> → ngày d của tháng <b>${ym}</b> (không giữ nguyên thứ trong tuần).`; return {plan:schPlanCopyMonth({ctx, workers, ym, mode, skipLeave})}; }
  if(k==='rotate'){ const r = rng(); if(!okR(r)) return {err:'Khoảng ngày không hợp lệ (tối đa 120 ngày)'}; const shifts = Array.from(document.querySelectorAll('.sb_rot:checked')).map(e=>e.value); if(shifts.length<2) return {err:'Chọn ít nhất 2 ca để luân phiên'}; const weeks = Math.floor(schDiffDays(schMonday(r.from), r.to)/7)+1;
    return {plan:schPlanRotation({ctx, workers, from:r.from, to:r.to, weeks, shifts, offset:+g('sb_off').value||0, mode, skipSun:g('sb_sun').checked, skipLeave})}; }
  if(k==='swap'){ const r = rng(); if(!okR(r)) return {err:'Khoảng ngày không hợp lệ'}; const a = workers.find(w=>w.id===g('sb_a').value), b = workers.find(w=>w.id===g('sb_b').value); if(!a||!b||a.id===b.id) return {err:'Chọn 2 nhân viên khác nhau'}; return {plan:schPlanSwap({ctx, a, b, from:r.from, to:r.to})}; }
  return {err:'?'};
}
function schBulkPreview(){
  const prev = document.getElementById('sb_prev'); if(!prev) return; const go = document.getElementById('sb_go');
  const R = schBulkRead(); if(R.err){ prev.innerHTML = `<span class="att2-bad">⚠️ ${attEsc(R.err)}</span>`; go.disabled = true; _schBulk.plan = null; return; }
  const plan = R.plan; _schBulk.plan = plan; const over = plan.changes.filter(c=>c.old!=='' && c.old!==c.new).length, sk = plan.skipped, people = new Set(plan.changes.map(c=>c.wid)).size;
  if(sk.invalid){ prev.innerHTML = '<span class="att2-bad">⚠️ Ca chọn không hợp lệ</span>'; go.disabled = true; _schBulk.plan = null; return; }
  const cat = {}; schCatalog(true).forEach(s=>{ cat[s.id]=s; }); const nm = id => id?(cat[id]?cat[id].name:id):'(mặc định)';
  const sample = plan.changes.slice(0,6).map(c=>`<li>${attEsc(c.name)} · ${attEsc(fmtDate(c.date))}: ${attEsc(nm(c.old))} → <b>${attEsc(nm(c.new))}</b></li>`).join('');
  prev.innerHTML = `<div class="att2-prev-h">${plan.changes.length?`Sẽ thay đổi <b>${plan.changes.length}</b> ô cho <b>${people}</b> nhân viên${over?` · <span class="att2-bad">${over} ô đã phân riêng sẽ bị thay</span>`:''}`:'Không có ô nào cần thay đổi'}</div>${sample?`<ul class="att2-prev-l">${sample}${plan.changes.length>6?`<li>… và ${plan.changes.length-6} ô khác</li>`:''}</ul>`:''}<div class="att2-prev-s">Bỏ qua: ${Object.keys(sk).filter(x=>sk[x]).map(x=>({sun:'Chủ nhật',hol:'ngày lễ',leave:'nghỉ phép đã duyệt',kept:'giữ dữ liệu cũ',same:'đã đúng',empty:'chưa có ca',nodate:'ngày không tồn tại'}[x]||x)+' '+sk[x]).join(' · ')||'không có'}</div>`;
  const okw = document.getElementById('sb_okwrap'); okw.style.display = over ? 'block' : 'none'; document.getElementById('sb_oktxt').textContent = `Tôi xác nhận thay ${over} ô đã được phân ca riêng`;
  go.disabled = !(plan.changes.length && (!over || document.getElementById('sb_ok').checked));
}
async function schBulkApply(){
  const plan = _schBulk.plan; if(!plan || !plan.changes.length) return; const go = document.getElementById('sb_go'); go.disabled = true; go.textContent = 'Đang gửi…';
  const label = document.querySelector('#schBulkModal .modal-title').textContent; const r = await schApplyAssign(plan.changes, label); attDlgClose('schBulkModal');
  if(!r.ok && r.reason) attFail(r.reason); else if(!r.ok) showToast('⚠️ Đã lưu '+r.applied+' ô trên máy nhưng CHƯA gửi được lên máy chủ ('+(r.error||'lỗi mạng')+'). Sẽ tự gửi lại khi có mạng.', true); else showToast('✅ Đã cập nhật '+r.applied+' ô lịch và đồng bộ');
  renderLichLamViec();
}

// ═════════ ĐĂNG KÝ TĂNG CA ═════════
function schOpenOT(){
  if(!schCanEdit()){ attFail(isViewer()?'viewer':'noperm'); return; }
  const ds = schCurDate(), workers = schScopeWorkers(_sch.dept), ctx = schMakeCtx();
  const rows = workers.map(w=>({w, reg:schOtReg(w,ds), act:schOtActual(w,ds)})).filter(x=>x.reg>0||x.act>0);
  attDialog('schOtModal', '⏱ Tăng ca ngày '+attEsc(fmtDate(ds)), `
    <div class="modal-row"><div class="field"><div class="field-lbl">Nhân viên</div><select id="ot_w" class="field-inp">${workers.map(w=>`<option value="${w.id}">${attEsc(w.name||'')}</option>`).join('')}</select></div><div class="field"><div class="field-lbl">Số giờ đăng ký</div><input id="ot_h" class="field-inp" inputmode="decimal" placeholder="VD: 2 hoặc 2.5"></div></div>
    <div id="ot_err" class="att2-bad"></div>
    <div class="att2-hol-l">${rows.length?rows.map(x=>`<div class="att2-hol-i"><span><b>${attEsc(x.w.name)}</b> · đăng ký ${x.reg||0}h · đã chấm ${x.act||0}h</span>${x.reg?`<button class="icon-btn del" onclick="schClearOT('${x.w.id}')" title="Huỷ đăng ký">🗑</button>`:''}</div>`).join(''):'<div class="att2-empty-s">Chưa có đăng ký/ghi nhận tăng ca ngày này.</div>'}</div>`,
    `<button class="btn btn-ghost" onclick="schOpenOTStats()">📊 Thống kê tháng</button><button class="btn btn-ghost" onclick="attDlgClose('schOtModal')">Đóng</button><button class="btn btn-primary" onclick="schAddOT()">Đăng ký</button>`);
}
async function schAddOT(){
  const r = schSetOT(schCurDate(), document.getElementById('ot_w').value, document.getElementById('ot_h').value);
  if(!r.ok){ if(r.reason==='invalid'){ document.getElementById('ot_err').textContent = '⚠️ Nhập số giờ từ 0.5 đến 24 (VD 2 hoặc 2.5)'; return; } attFail(r.reason); return; }
  schOpenOT(); renderLichLamViec();
}
function schClearOT(wid){ const r = schSetOT(schCurDate(), wid, ''); if(!r.ok){ attFail(r.reason); return; } schOpenOT(); renderLichLamViec(); }
function schOpenOTStats(){
  const ym = schCurDate().slice(0,7), ctx = {ym, today:todayStr(), holidays:attHolidays(), nghiPhep:DB.nghiPhep||[]};
  const rows = schScopeWorkers(_sch.dept).map(w=>{ let reg = 0; schMonthDates(ym).forEach(ds=>{ reg += schOtReg(w, ds); }); const act = attWorkerMonthStats(w, (DB.attendance[ym]||{})[w.id], ctx).otRaw; return {w, reg:Math.round(reg*10)/10, act}; }).filter(x=>x.reg>0||x.act>0);
  attDialog('schOtStatModal', '📊 Tăng ca tháng '+ym.split('-')[1]+'/'+ym.split('-')[0], `<div class="att2-scroll" style="max-height:55dvh"><table class="att2-audit-t"><thead><tr><th>Nhân viên</th><th>Đăng ký (giờ)</th><th>Đã chấm công (giờ)</th></tr></thead><tbody>${rows.length?rows.map(x=>`<tr><td>${attEsc(x.w.name)}</td><td>${x.reg}</td><td>${x.act}</td></tr>`).join(''):'<tr><td colspan="3" class="att2-empty-s">Chưa có dữ liệu tăng ca.</td></tr>'}</tbody></table></div><div class="att2-empty-s">“Đã chấm công” lấy từ phần giờ sau dấu chấm trong bảng chấm công (trước quy đổi 8 giờ = 1 công).</div>`,
    `<button class="btn btn-ghost" onclick="attDlgClose('schOtStatModal')">Đóng</button>`);
}

// ═════════ LỊCH SỬ ĐIỀU CHỈNH ═════════
async function schOpenHistory(){
  const ym = schCurDate().slice(0,7);
  attDialog('schHistModal', '📜 Lịch sử điều chỉnh lịch tháng '+ym.split('-')[1]+'/'+ym.split('-')[0], '<div id="sh_body" class="att2-audit"><div class="att2-empty-s">⏳ Đang tải…</div></div>', `<button class="btn btn-ghost" onclick="attDlgClose('schHistModal')">Đóng</button>`);
  const list = await schAuditLoad(ym), el = document.getElementById('sh_body'); if(!el) return; const nameOf = id => ((DB.workers||[]).find(w=>w.id===id)||{}).name || '(đã xoá)'; const cat = {}; schCatalog(true).forEach(s=>cat[s.id]=s); const sn = id => id?(cat[id]?cat[id].name:id):'(mặc định)';
  if(!list.length){ el.innerHTML = '<div class="att2-empty-s">Chưa có điều chỉnh nào được ghi lại cho tháng này.</div>'; return; }
  const what = a => a.ty==='schAssign' ? `${attEsc(a.m||'Phân ca')}: <b>${a.c}</b> ô`+(a.det?`<br><small>${a.det.slice(0,4).map(d=>attEsc(nameOf(d[0]))+' '+attEsc(fmtDate(d[1]))+': '+attEsc(sn(d[2]))+'→'+attEsc(sn(d[3]))).join(' · ')}${a.det.length>4?' …':''}</small>`:'') : a.ty==='schOT' ? `Tăng ca ${attEsc(a.wn||nameOf(a.wid))} ${attEsc(fmtDate(a.d))}: ${a.o||'—'} → <b>${a.n||'(huỷ)'}</b>h` : attEsc(a.m||a.ty);
  el.innerHTML = `<table class="att2-audit-t"><thead><tr><th>Thời gian</th><th>Người sửa</th><th>Nội dung</th></tr></thead><tbody>${list.slice(0,200).map(a=>`<tr><td>${attEsc(vnDateTimeShort(a.t))}</td><td>${attEsc(a.by||'?')}</td><td>${what(a)}</td></tr>`).join('')}</tbody></table>`;
}
