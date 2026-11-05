// src/modules/qr/qr-public-ccllv.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


let _pubCcllvTab = 'llv';
const _pubCcllvTracked = new Set(); // tránh đếm trùng lượt xem cùng 1 tab trong 1 lần mở trang
function pubCcllvSwitchTab(tab){
  _pubCcllvTab = tab;
  document.querySelectorAll('.pub-ccllv-tab').forEach(el=>el.classList.toggle('active', el.dataset.tab===tab));
  document.querySelectorAll('.pub-ccllv-panel').forEach(el=>el.style.display = (el.dataset.tab===tab) ? '' : 'none');
  if(!_pubCcllvTracked.has(tab)){
    _pubCcllvTracked.add(tab);
    pubTrackScan(tab==='cc' ? 'chamcong' : 'lichlamviec');
  }
}

// ── Trang công khai: bảng chấm công cho phép xem lại các tháng trước
// (trước đây cố định tháng hiện tại) — dữ liệu attendance đã tải về đủ
// mọi tháng có sẵn từ Firebase (/data/attendance), chỉ cần đổi tháng
// đang hiển thị mà không cần tải lại trang ──
let _pubCc = { workers:[], attendance:{}, ym:'' };

// Trả về danh sách các tháng có dữ liệu (định dạng "YYYY-MM"), SẮP XẾP TĂNG
// DẦN (cũ → mới) để dễ tính lùi/tiến 1 tháng.
function pubCcAvailableMonthsAsc(){
  const set = new Set(Object.keys(_pubCc.attendance||{}).filter(k=>/^\d{4}-\d{2}$/.test(k)));
  set.add(todayStr().slice(0,7));
  return [...set].sort();
}

function pubCcBuildAttTable(ym){
  const workers = _pubCc.workers;
  const monthData = (_pubCc.attendance||{})[ym] || {};
  const [y,m] = ym.split('-').map(Number);
  const nDays = daysInMonth(ym);
  const dayCols = Array.from({length:nDays}, (_,i)=>i+1);
  return workers.length ? `
    <div style="overflow-x:auto">
      <table style="border-collapse:collapse;font-size:11px;white-space:nowrap">
        <thead>
          <tr>
            <th style="position:sticky;left:0;background:var(--card);border:1px solid var(--border);padding:4px 6px;z-index:1">Họ và tên</th>
            <th style="border:1px solid var(--border);padding:4px 6px;min-width:80px">Bộ phận</th>
            ${dayCols.map(d=>`<th style="border:1px solid var(--border);padding:3px 4px;min-width:26px">
              <div>${d}</div><div style="font-size:9px;color:${weekdayVN(y,m,d)==='CN'?'var(--red-m)':'var(--text4)'}">${weekdayVN(y,m,d)}</div>
            </th>`).join('')}
            <th style="border:1px solid var(--border);padding:4px 6px;background:var(--green-l);color:var(--green)">Tổng công</th>
          </tr>
        </thead>
        <tbody>
          ${workers.map(w=>{
            const rowData = monthData[w.id] || {};
            return `<tr>
              <td style="position:sticky;left:0;background:var(--card);border:1px solid var(--border);padding:4px 6px;text-align:left;font-weight:700">${pubEsc(w.name||'—')}</td>
              <td style="border:1px solid var(--border);padding:4px 6px;text-align:center">${llvDeptBadgeHtml(w.boPhan, pubEsc)}</td>
              ${dayCols.map(d=>`<td style="border:1px solid var(--border);padding:3px;text-align:center">${pubEsc(rowData[d]!==undefined?rowData[d]:'')}</td>`).join('')}
              <td style="border:1px solid var(--border);padding:4px 6px;text-align:center;font-weight:700;background:var(--green-l);color:var(--green)">${pubComputeTotal(rowData)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="font-size:10.5px;color:var(--text4);margin-top:8px;line-height:1.5">
      <b>Ghi chú:</b> Đủ ngày công = 1 · Nửa ngày công = 0.5 · Không công = 0. Làm thêm giờ cộng thêm vào công ngày (VD: 1.2 = 1 công + làm thêm 2 tiếng).
    </div>
  ` : `<div style="font-size:12px;color:var(--text4);text-align:center;padding:10px 0">Chưa có dữ liệu người lao động</div>`;
}

function pubCcRenderAtt(){
  const body = $('pubCcBody'); if(!body) return;
  body.innerHTML = pubCcBuildAttTable(_pubCc.ym);
  const [y,m] = _pubCc.ym.split('-').map(Number);
  const lbl = $('pubCcMonthLbl'); if(lbl) lbl.textContent = `Bảng chấm công tháng ${m}/${y}`;
  const sel = $('pubCcMonthSel'); if(sel) sel.value = _pubCc.ym;
  const months = pubCcAvailableMonthsAsc();
  const idx = months.indexOf(_pubCc.ym);
  const prevBtn = $('pubCcPrevBtn'); if(prevBtn) prevBtn.disabled = idx<=0;
  const nextBtn = $('pubCcNextBtn'); if(nextBtn) nextBtn.disabled = idx===-1 || idx>=months.length-1;
}

function pubCcSetMonth(ym){
  if(!ym) return;
  _pubCc.ym = ym;
  pubCcRenderAtt();
}

function pubCcShiftMonth(delta){
  const months = pubCcAvailableMonthsAsc();
  const idx = months.indexOf(_pubCc.ym);
  if(idx===-1) return;
  const newIdx = idx + delta;
  if(newIdx>=0 && newIdx<months.length) pubCcSetMonth(months[newIdx]);
}

// ── Trang công khai: xem TOÀN BỘ lịch làm việc + bảng chấm công tháng
// hiện tại, dùng khi người lao động quét mã QR dán ở bảng tin/xưởng SX ──
async function renderPublicCcllv(){
  $('loginScreen').classList.remove('active');
  $('publicScanScreen').classList.add('active');
  const wrap = $('pubWrap');
  const params = new URLSearchParams(location.search);
  const dbUrl = (params.get('db') || fbUrl() || '').replace(/\/$/,'');

  if(!dbUrl){
    wrap.innerHTML = `<div class="pub-msg">⚠️ Không thể tải dữ liệu — liên kết thiếu thông tin kết nối.<br>Vui lòng liên hệ nhà máy để được hỗ trợ.</div>`;
    return;
  }

  let workers=[], attendance={}, lichLamViec=[], nghiPhep=[], errMsg=null;
  try{
    const _authQs = await fbAppendAuth(''); // '' hoặc '?auth=TOKEN' — ghép chung cho cả 4 URL bên dưới
    const _wq = u => u + (_authQs ? (u.includes('?')?_authQs.replace('?','&'):_authQs) : '');
    const [rw, ra, rl, rn] = await Promise.all([
      fetch(_wq(dbUrl + '/data/workers.json?print=pretty'), {cache:'no-store'}),
      fetch(_wq(dbUrl + '/data/attendance.json?print=pretty'), {cache:'no-store'}),
      fetch(_wq(dbUrl + '/data/lichLamViec.json?print=pretty'), {cache:'no-store'}),
      fetch(_wq(dbUrl + '/data/nghiPhep.json?print=pretty'), {cache:'no-store'})
    ]);
    if(!rw.ok || !ra.ok || !rl.ok){
      const badStatus = [rw,ra,rl].map(r=>r.status).find(s=>s===401||s===403);
      errMsg = badStatus
        ? `⚠️ Không kết nối được tới máy chủ dữ liệu (mã lỗi HTTP ${badStatus}).<br>Có thể quy tắc bảo mật (Rules) của Firebase đang chặn truy cập công khai.`
        : `⚠️ Không kết nối được tới máy chủ dữ liệu.<br>Vui lòng thử lại sau ít phút hoặc liên hệ nhà máy.`;
    } else {
      const dw = await rw.json(), da = await ra.json(), dl = await rl.json();
      const dn = rn.ok ? await rn.json() : null;
      workers = Array.isArray(dw) ? dw.filter(Boolean) : Object.values(dw||{}).filter(Boolean);
      attendance = da || {};
      lichLamViec = Array.isArray(dl) ? dl.filter(Boolean) : Object.values(dl||{}).filter(Boolean);
      nghiPhep = Array.isArray(dn) ? dn.filter(Boolean) : Object.values(dn||{}).filter(Boolean);
    }
  }catch(e){
    errMsg = `⚠️ Không có kết nối mạng hoặc máy chủ dữ liệu không phản hồi.<br>Vui lòng kiểm tra lại Wi-Fi/4G rồi thử quét lại.`;
  }

  if(errMsg){
    wrap.innerHTML = `<div class="pub-msg">${errMsg}</div>`;
    return;
  }

  // Lưu state để đổi tháng xem chấm công mà không cần tải lại dữ liệu
  _pubCc = { workers, attendance, ym: todayStr().slice(0,7) };
  const monthsAsc = pubCcAvailableMonthsAsc();
  const monthOptionsHtml = monthsAsc.slice().reverse()
    .map(mm=>{ const [yy,mo]=mm.split('-').map(Number); return `<option value="${mm}" ${mm===_pubCc.ym?'selected':''}>Tháng ${mo}/${yy}</option>`; })
    .join('');

  // ── Khối Lịch làm việc: gộp theo ca, giống bản quản trị ──
  const llvHtml = lichLamViec.length ? lichLamViec.map(sheet=>{
    const groups = llvGroupRows(sheet.rows||[]);
    return `
      <div class="pub-card">
        <div class="pub-card-title">${pubEsc(sheet.name||'Bộ phận')}</div>
        ${sheet.period?`<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:2px">📅 ${pubEsc(sheet.period)}</div>`:''}
        ${sheet.warning?`<div style="font-size:11.5px;color:#b45309;margin-bottom:8px">⚠️ ${pubEsc(sheet.warning)}</div>`:''}
        ${groups.map(g=>`
          <div style="margin-top:8px">
            <div style="display:inline-block;padding:3px 10px;border-radius:10px;background:${g.meta.bg};color:${g.meta.color};font-weight:700;font-size:12px;margin-bottom:6px">${g.meta.label} · ${g.items.length} người</div>
            <div style="display:flex;flex-direction:column;gap:0">
              ${g.items.map(({r},gi)=>{
                const leaveRec = llvActiveLeave(r.name, nghiPhep, sheet);
                const leaveTxt = leaveRec ? `${leaveRec.loai||'Đang nghỉ'}${leaveRec.toDate?` · đến ${pubEsc(leaveRec.toDate)}`:''}` : (r.leave||'');
                const dept = llvWorkerDept(r.name, workers);
                return `
                <div style="display:flex;align-items:center;gap:8px;padding:6px 2px;border-bottom:1px solid var(--border);font-size:12.5px">
                  <span style="color:var(--text4);min-width:18px">${gi+1}.</span>
                  <span style="flex:1;font-weight:700;color:var(--text)">${pubEsc(r.name||'—')}${r.gender?` <span style="font-weight:500;color:var(--text4)">(${pubEsc(r.gender)})</span>`:''}</span>
                  ${dept?llvDeptBadgeHtml(dept, pubEsc):''}
                  <span style="color:var(--text3)">${pubEsc(r.time||'')}</span>
                </div>
                ${leaveTxt?`<div style="font-size:11px;color:#0e7490;font-weight:700;padding:0 0 2px 26px">🏖️ ${pubEsc(leaveTxt)}</div>`:''}
                ${r.note?`<div style="font-size:11px;color:var(--text4);padding:0 0 4px 26px">📝 ${pubEsc(r.note)}</div>`:''}
              `;}).join('')}
            </div>
          </div>
        `).join('') || '<div style="font-size:12px;color:var(--text4);padding:6px 0">Chưa có nhân viên trong lịch</div>'}
      </div>
    `;
  }).join('') : `<div class="pub-card"><div style="font-size:12px;color:var(--text4);text-align:center;padding:10px 0">Chưa có lịch làm việc nào được đăng</div></div>`;

  // ── Khối Bảng chấm công: dạng bảng cuộn ngang, có thể chọn xem lại
  // các tháng trước qua dropdown hoặc nút lùi/tiến (◀ ▶) ──
  const attHtml = `
    <div class="pub-card">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <div class="pub-card-title" id="pubCcMonthLbl" style="margin-bottom:0;flex:1;min-width:140px">Bảng chấm công tháng ${_pubCc.ym.split('-')[1]}/${_pubCc.ym.split('-')[0]}</div>
        <div style="display:flex;align-items:center;gap:4px">
          <button id="pubCcPrevBtn" onclick="pubCcShiftMonth(-1)" style="border:1px solid var(--border);background:var(--card);color:var(--text2);border-radius:8px;padding:5px 9px;font-weight:800;cursor:pointer">◀</button>
          <select id="pubCcMonthSel" onchange="pubCcSetMonth(this.value)" style="border:1px solid var(--border);border-radius:8px;padding:5px 8px;font-size:12px;font-weight:700;font-family:inherit;background:var(--card);color:var(--text)">${monthOptionsHtml}</select>
          <button id="pubCcNextBtn" onclick="pubCcShiftMonth(1)" style="border:1px solid var(--border);background:var(--card);color:var(--text2);border-radius:8px;padding:5px 9px;font-weight:800;cursor:pointer">▶</button>
        </div>
      </div>
      <div id="pubCcBody">${pubCcBuildAttTable(_pubCc.ym)}</div>
    </div>
  `;

  wrap.innerHTML = `
    <div class="pub-header">
      <div class="pub-header-logo"><img src="${DP_LOGO_DATAURL}" alt="Logo Đông Phương" class="pub-header-logo-img"><span>CÔNG TY CP CÔNG THƯƠNG ĐÔNG PHƯƠNG</span></div>
      <div class="pub-header-title">Chấm công &amp; Lịch làm việc</div>
      <div class="pub-header-code">Cập nhật trực tiếp từ hệ thống — ${fmtDate(todayStr())}</div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="chip pub-ccllv-tab active" data-tab="llv" onclick="pubCcllvSwitchTab('llv')" style="flex:1">📅 Lịch làm việc</button>
      <button class="chip pub-ccllv-tab" data-tab="cc" onclick="pubCcllvSwitchTab('cc')" style="flex:1">🗓️ Chấm công</button>
    </div>
    <div class="pub-ccllv-panel" data-tab="llv">${llvHtml}</div>
    <div class="pub-ccllv-panel" data-tab="cc" style="display:none">${attHtml}</div>
    <div class="pub-footer">Trang xem chấm công &amp; lịch làm việc — vui lòng liên hệ quản lý nếu có sai lệch. Liên hệ SDT : 0979698351 - Zalo : 0979698351</div>
  `;
  pubCcRenderAtt();
  if(!_pubCcllvTracked.has('llv')){
    _pubCcllvTracked.add('llv');
    pubTrackScan('lichlamviec');
  }
}
