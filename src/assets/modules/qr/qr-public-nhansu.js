// src/modules/qr/qr-public-nhansu.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ── Trang công khai ──
let _pubNs = { workers:[], nghiPhep:[], search:'', status:'all', tab:'ds', dbUrl:'' };
let _pubNsPollTimer = null;

async function pubNsFetchData(dbUrl){
  let workers=[], nghiPhep=[], kyLuat=[], errMsg=null;
  try{
    const [rw, rn, rk] = await Promise.all([
      fetch(await fbAppendAuth(dbUrl + '/data/workers.json?print=pretty'), {cache:'no-store'}),
      fetch(await fbAppendAuth(dbUrl + '/data/nghiPhep.json?print=pretty'), {cache:'no-store'}),
      fetch(await fbAppendAuth(dbUrl + '/data/kyLuat.json?print=pretty'), {cache:'no-store'})
    ]);
    if(!rw.ok){
      errMsg = (rw.status===401||rw.status===403)
        ? `⚠️ Không kết nối được tới máy chủ dữ liệu (mã lỗi HTTP ${rw.status}).<br>Có thể quy tắc bảo mật (Rules) của Firebase đang chặn truy cập công khai.`
        : `⚠️ Không kết nối được tới máy chủ dữ liệu.<br>Vui lòng thử lại sau ít phút hoặc liên hệ nhà máy.`;
    } else {
      const dw = await rw.json();
      const dn = rn.ok ? await rn.json() : null;
      workers = Array.isArray(dw) ? dw.filter(Boolean) : Object.values(dw||{}).filter(Boolean);
      nghiPhep = Array.isArray(dn) ? dn.filter(Boolean) : Object.values(dn||{}).filter(Boolean);
      const dk = rk.ok ? await rk.json() : null;
      kyLuat = Array.isArray(dk) ? dk.filter(Boolean) : Object.values(dk||{}).filter(Boolean);
    }
  }catch(e){
    errMsg = `⚠️ Không có kết nối mạng hoặc máy chủ dữ liệu không phản hồi.<br>Vui lòng kiểm tra lại Wi-Fi/4G rồi thử quét lại.`;
  }
  return {workers, nghiPhep, kyLuat, errMsg};
}

async function renderPublicNhanSu(){
  $('loginScreen').classList.remove('active');
  $('publicScanScreen').classList.add('active');
  const wrap = $('pubWrap');
  const params = new URLSearchParams(location.search);
  const dbUrl = (params.get('db') || fbUrl() || '').replace(/\/$/,'');
  if(!dbUrl){
    wrap.innerHTML = `<div class="pub-msg">⚠️ Không thể tải dữ liệu — liên kết thiếu thông tin kết nối.<br>Vui lòng liên hệ nhà máy để được hỗ trợ.</div>`;
    return;
  }
  const {workers, nghiPhep, kyLuat, errMsg} = await pubNsFetchData(dbUrl);
  if(errMsg){ wrap.innerHTML = `<div class="pub-msg">${errMsg}</div>`; return; }
  _pubNs = { workers, nghiPhep, kyLuat, search:'', status:'all', tab:'ds', dbUrl };

  wrap.innerHTML = `
    <div class="pub-header">
      <div class="pub-header-logo"><img src="${DP_LOGO_DATAURL}" alt="Logo Đông Phương" class="pub-header-logo-img"><span>CÔNG TY CP CÔNG THƯƠNG ĐÔNG PHƯƠNG</span></div>
      <div class="pub-header-title">👥 Danh sách nhân sự</div>
      <div class="pub-header-code">Xem công khai — cập nhật trực tiếp từ hệ thống</div>
    </div>
    <div id="pubNsSyncStatus" class="pub-kh-sync ok">🟢 Đang đồng bộ dữ liệu</div>
    <div id="pubNsSummary" class="pub-kh-summary pub-kh-summary-2"></div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="chip pub-ns-tab active" data-tab="ds" onclick="pubNsSetTab('ds')" style="flex:1">👥 Danh sách</button>
      <button class="chip pub-ns-tab" data-tab="np" onclick="pubNsSetTab('np')" style="flex:1">🏖️ Nghỉ phép</button>
    </div>
    <div id="pubNsBody"></div>
    <div id="pubNsDetail" style="display:none;position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.5);overflow-y:auto;padding:14px" onclick="if(event.target===this)pubNsClose()"></div>
    <div class="pub-kh-updated" id="pubNsUpdated">Cập nhật lúc ${fmtDateTime(Date.now())}</div>
    <div class="pub-footer">Trang xem danh sách nhân sự — vui lòng liên hệ quản lý nếu có sai lệch.<br>Liên hệ SĐT/Zalo: 0979698351</div>
  `;
  pubNsRenderAll();
  if(!_pubCcllvTracked.has('nhansu')){
    _pubCcllvTracked.add('nhansu');
    pubTrackScan('nhansu');
  }
  if(_pubNsPollTimer) clearInterval(_pubNsPollTimer);
  _pubNsPollTimer = setInterval(pubNsRefresh, 30000);
}

async function pubNsRefresh(){
  const st = $('pubNsSyncStatus');
  try{
    const {workers, nghiPhep, kyLuat, errMsg} = await pubNsFetchData(_pubNs.dbUrl);
    if(errMsg){ if(st){ st.className='pub-kh-sync danger'; st.textContent='🔴 Không thể cập nhật dữ liệu mới'; } return; }
    _pubNs.workers = workers; _pubNs.nghiPhep = nghiPhep; _pubNs.kyLuat = kyLuat;
    if(_pubNs.openId) pubNsOpen(_pubNs.openId, true);
    if(st){ st.className='pub-kh-sync ok'; st.textContent='🟢 Đang đồng bộ dữ liệu'; }
    const upd = $('pubNsUpdated'); if(upd) upd.textContent = 'Cập nhật lúc ' + fmtDateTime(Date.now());
    pubNsRenderAll();
  }catch(e){
    if(st){ st.className='pub-kh-sync danger'; st.textContent='🔴 Không thể cập nhật dữ liệu mới'; }
  }
}

function pubNsSetTab(t){
  _pubNs.tab = t;
  document.querySelectorAll('.pub-ns-tab').forEach(el=>el.classList.toggle('active', el.dataset.tab===t));
  pubNsRenderBody();
}
function pubNsSetSearch(v){ _pubNs.search = v||''; pubNsRenderBody(); }
function pubNsSetStatus(v){ _pubNs.status = v; pubNsRenderBody(); }

// Đơn nghỉ phép hiển thị công khai: bỏ đơn bị từ chối
function pubNsLeaves(){
  return (_pubNs.nghiPhep||[]).filter(k=>k.status!=='Từ chối')
    .slice().sort((a,b)=>String(b.fromDate||'').localeCompare(String(a.fromDate||'')));
}
function pubNsOnLeaveToday(){
  const today = todayStr();
  return (_pubNs.nghiPhep||[]).filter(k=>k.status==='Đã duyệt' && (k.fromDate||'')<=today && today<=(k.toDate||''));
}

function pubNsRenderAll(){
  const ws = _pubNs.workers;
  const working = ws.filter(w=>(w.trangThai||'Đang làm')==='Đang làm').length;
  const sum = $('pubNsSummary');
  if(sum) sum.innerHTML = `
    <div class="pub-kh-sum-card"><div class="pub-kh-sum-n">${working}</div><div class="pub-kh-sum-lbl">Đang làm việc</div></div>
    <div class="pub-kh-sum-card"><div class="pub-kh-sum-n">${pubNsOnLeaveToday().length}</div><div class="pub-kh-sum-lbl">Nghỉ phép hôm nay</div></div>`;
  pubNsRenderBody();
}

function pubNsRenderBody(){
  const body = $('pubNsBody'); if(!body) return;
  const active = document.activeElement;
  const wasSearch = active && active.classList && active.classList.contains('pub-kh-search');
  const caret = wasSearch ? active.selectionStart : null;
  body.innerHTML = _pubNs.tab==='np' ? pubNsLeaveHtml() : pubNsListHtml();
  if(wasSearch){
    const inp = body.querySelector('.pub-kh-search');
    if(inp){ inp.focus(); if(caret!=null) inp.setSelectionRange(caret, caret); }
  }
}

function pubNsListHtml(){
  const q = (_pubNs.search||'').trim().toLowerCase();
  const onLeaveIds = new Set(pubNsOnLeaveToday().map(k=>k.workerId));
  let list = _pubNs.workers.filter(w=>_pubNs.status==='all' || (w.trangThai||'Đang làm')===_pubNs.status);
  if(q) list = list.filter(w=>[w.name,w.maNV,w.chucVu,w.boPhan].filter(Boolean).join(' ').toLowerCase().includes(q));
  list = list.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'vi'));
  const stBtn = (v,l)=>`<button class="pub-kh-chip ${_pubNs.status===v?'active':''}" onclick="pubNsSetStatus('${v}')">${l}</button>`;
  return `
    <div class="pub-kh-toolbar">
      <input class="pub-kh-search" placeholder="🔎 Tìm tên, mã NV, chức vụ, bộ phận..." value="${pubEsc(_pubNs.search)}" oninput="pubNsSetSearch(this.value)">
      <div class="pub-kh-chips">
        ${stBtn('all','Tất cả ('+_pubNs.workers.length+')')}
        ${stBtn('Đang làm','🟢 Đang làm')}
        ${stBtn('Tạm nghỉ','🟡 Tạm nghỉ')}
        ${stBtn('Đã nghỉ việc','⚪ Đã nghỉ việc')}
      </div>
    </div>
    ${list.length===0 ? `<div class="pub-kh-empty">🗂️ Không tìm thấy nhân viên phù hợp</div>` : `
    <div class="pub-card" style="padding:6px 12px">
      ${list.map((w,i)=>{
        const st = w.trangThai || 'Đang làm';
        return `<div onclick="pubNsOpen('${pubEsc(w.id)}')" style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer">
          <div style="width:34px;height:34px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${pubEsc(workerInitials(w.name))}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:13.5px;color:var(--text)">${i+1}. ${pubEsc(w.name||'(Chưa đặt tên)')}</div>
            <div style="font-size:11.5px;color:var(--text3)">${[w.maNV?('Mã NV: '+pubEsc(w.maNV)):'', pubEsc(w.chucVu||''), pubEsc(w.boPhan||'')].filter(Boolean).join(' · ') || '—'}</div>
            ${w.ngayVaoLam?`<div style="font-size:11px;color:var(--text4)">Vào làm: ${pubEsc(w.ngayVaoLam)}</div>`:''}
            ${onLeaveIds.has(w.id)?`<div style="font-size:11px;font-weight:700;color:#0e7490">🏖️ Đang nghỉ phép</div>`:''}
          </div>
          <span class="ns-badge" style="background:${NS_STATUS_BG[st]||'#f1f5f9'};color:${NS_STATUS_COLOR[st]||'#6b7280'};white-space:nowrap">${pubEsc(st)}</span>
          <span style="color:var(--text4);font-size:16px">›</span>
        </div>`;
      }).join('')}
    </div>`}
  `;
}

// ── Chi tiết 1 nhân viên: hiện TOÀN BỘ thông tin hồ sơ + nghỉ phép + kỷ luật ──
function pubNsClose(){
  _pubNs.openId = null;
  const d = $('pubNsDetail'); if(d){ d.style.display='none'; d.innerHTML=''; }
  document.body.style.overflow = '';
}
function pubNsOpen(id, keepScroll){
  const w = _pubNs.workers.find(x=>String(x.id)===String(id));
  const d = $('pubNsDetail'); if(!w || !d) return;
  _pubNs.openId = id;
  const st = w.trangThai || 'Đang làm';
  const row = (l,v)=>`<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px"><div style="width:120px;flex-shrink:0;color:var(--text3)">${l}</div><div style="flex:1;font-weight:600;color:var(--text);word-break:break-word">${v===''||v==null?'—':pubEsc(v)}</div></div>`;
  const money = w.luongCoBan ? (Number(w.luongCoBan)||0).toLocaleString('vi-VN')+' VNĐ' : '';
  const leaves = (_pubNs.nghiPhep||[]).filter(k=>k.workerId===w.id)
    .slice().sort((a,b)=>String(b.fromDate||'').localeCompare(String(a.fromDate||'')));
  const kls = (_pubNs.kyLuat||[]).filter(k=>k.workerId===w.id)
    .slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const stColor = {'Chờ duyệt':'#f59e0b','Đã duyệt':'#22c55e','Từ chối':'#ef4444'};
  const sec = t=>`<div style="font-size:12px;font-weight:800;color:var(--brand);text-transform:uppercase;letter-spacing:.4px;margin:14px 0 4px">${t}</div>`;
  d.innerHTML = `<div style="background:var(--card);border-radius:14px;max-width:520px;margin:20px auto;padding:16px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
      <div style="width:48px;height:48px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;flex-shrink:0">${pubEsc(workerInitials(w.name))}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:16px;font-weight:800;color:var(--text)">${pubEsc(w.name||'(Chưa đặt tên)')}</div>
        <span class="ns-badge" style="background:${NS_STATUS_BG[st]||'#f1f5f9'};color:${NS_STATUS_COLOR[st]||'#6b7280'}">${pubEsc(st)}</span>
      </div>
      <button onclick="pubNsClose()" style="border:1px solid var(--border);background:var(--bg2);color:var(--text2);border-radius:8px;width:34px;height:34px;font-size:15px;cursor:pointer">✕</button>
    </div>
    ${sec('Thông tin cá nhân')}
    ${row('Mã nhân viên',w.maNV)}${row('Giới tính',w.gioiTinh)}${row('Ngày sinh',w.ngaySinh?fmtDate(w.ngaySinh):'')}
    ${row('Số điện thoại',w.sdt)}${row('CCCD/CMND',w.cccd)}${row('Địa chỉ',w.diaChi)}
    ${sec('Công việc')}
    ${row('Chức vụ',w.chucVu)}${row('Bộ phận / Tổ',w.boPhan)}${row('Ngày vào làm',w.ngayVaoLam?fmtDate(w.ngayVaoLam):'')}
    ${row('Loại hợp đồng',w.loaiHopDong)}${row('Lương cơ bản',money)}
    ${sec('Tài khoản ngân hàng')}
    ${row('Ngân hàng',w.nganHang)}${row('Số tài khoản',w.soTaiKhoan)}
    ${sec('Ghi chú')}
    ${row('Ghi chú',w.ghiChu)}
    ${sec('Nghỉ phép ('+leaves.length+')')}
    ${leaves.length ? leaves.map(k=>`<div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:12.5px">
      <div style="display:flex;gap:8px;align-items:center"><b style="flex:1">${pubEsc(k.loai||'Nghỉ phép')}</b><span class="ns-badge" style="color:#fff;background:${stColor[k.status]||'#6b7280'}">${pubEsc(k.status||'Chờ duyệt')}</span></div>
      <div style="color:var(--text3)">${fmtDate(k.fromDate)}${k.toDate&&k.toDate!==k.fromDate?' → '+fmtDate(k.toDate):''}</div>
      ${k.lydo?`<div style="color:var(--text4)">Lý do: ${pubEsc(k.lydo)}</div>`:''}</div>`).join('') : '<div style="font-size:12.5px;color:var(--text4);padding:6px 0">Chưa có đơn nghỉ phép</div>'}
    ${sec('Kỷ luật ('+kls.length+')')}
    ${kls.length ? kls.map(k=>`<div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:12.5px">
      <div style="display:flex;gap:8px"><b style="flex:1;color:#dc2626">${pubEsc(k.loai||'Vi phạm')}</b><span style="color:var(--text3)">${fmtDate(k.date)}</span></div>
      ${k.lydo?`<div style="color:var(--text3)">Lý do: ${pubEsc(k.lydo)}</div>`:''}
      ${k.nguoiqd?`<div style="color:var(--text4)">Người quyết định: ${pubEsc(k.nguoiqd)}</div>`:''}
      ${k.ghichu?`<div style="color:var(--text4)">Ghi chú: ${pubEsc(k.ghichu)}</div>`:''}</div>`).join('') : '<div style="font-size:12.5px;color:var(--text4);padding:6px 0">Không có kỷ luật</div>'}
    <button onclick="pubNsClose()" style="width:100%;margin-top:14px;padding:10px;border:none;border-radius:10px;background:var(--brand);color:#fff;font-weight:700;font-size:13px;cursor:pointer">Đóng</button>
  </div>`;
  d.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function pubNsLeaveHtml(){
  const list = pubNsLeaves();
  const today = todayStr();
  const stColor = {'Chờ duyệt':'#f59e0b','Đã duyệt':'#22c55e'};
  if(!list.length) return `<div class="pub-kh-empty">🏖️ Chưa có đơn nghỉ phép nào</div>`;
  return `<div class="pub-card" style="padding:6px 12px">
    ${list.map(k=>{
      const now = k.status==='Đã duyệt' && (k.fromDate||'')<=today && today<=(k.toDate||'');
      const range = (k.fromDate===k.toDate || !k.toDate) ? fmtDate(k.fromDate) : `${fmtDate(k.fromDate)} → ${fmtDate(k.toDate)}`;
      return `<div style="padding:9px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;font-weight:700;font-size:13.5px;color:var(--text)">${pubEsc(k.workerName||'—')}</div>
          <span class="ns-badge" style="color:#fff;background:${stColor[k.status]||'#6b7280'};white-space:nowrap">${pubEsc(k.status||'Chờ duyệt')}</span>
        </div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">${pubEsc(k.loai||'Nghỉ phép')} · ${range}</div>
        ${now?`<div style="font-size:11px;font-weight:700;color:#0e7490;margin-top:2px">🏖️ Đang nghỉ hôm nay</div>`:''}
      </div>`;
    }).join('')}
  </div>`;
}
