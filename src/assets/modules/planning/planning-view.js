// src/modules/planning/planning-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ── Khung "Thời gian sản xuất" hợp nhất trong thẻ Kế hoạch SX: đang chạy
// thì đếm giờ chạy máy realtime (dùng lại đúng id clk-{id} để setInterval
// cũ tự cập nhật mỗi giây, không cần sửa gì thêm); chưa chạy thì đếm ngược
// đến hạn giao (còn bao nhiêu ngày / trễ bao nhiêu ngày); đã xong thì hiện
// tổng thời gian đã sản xuất.
function khTimeInfo(o, s){
  if(s==='running' && o.startedAt){
    return {cls:'tm-running', id:`clk-${o.id}`, val:'⏱ --:--', lbl:'Đang chạy'};
  }
  if(s==='done'){
    const dur = (o.doneAt && o.startedAt) ? fmtDuration(o.doneAt-o.startedAt) : '—';
    return {cls:'tm-done', id:'', val:'✅ '+dur, lbl:'TG sản xuất'};
  }
  if(o.deliveryDate){
    const daysLeft = Math.ceil((new Date(o.deliveryDate)-Date.now())/86400000);
    if(daysLeft<0) return {cls:'tm-overdue', id:'', val:'⚠️ Trễ '+Math.abs(daysLeft)+'ng', lbl:'Quá hạn'};
    if(daysLeft===0) return {cls:'tm-warn', id:'', val:'🔴 Hôm nay', lbl:'Hạn giao'};
    if(daysLeft===1) return {cls:'tm-warn', id:'', val:'🟡 Còn 1ng', lbl:'Hạn giao'};
    return {cls:'tm-wait', id:'', val:'⏳ Còn '+daysLeft+'ng', lbl:'Hạn giao'};
  }
  return {cls:'tm-wait', id:'', val:'—', lbl:'Thời gian'};
}

function khPlanCard(o, seq){
  const s=o.status==='cutting'?'running':o.status;
  const pc=PRI_COLOR[o.priority]||'#64748b';
  const overdue=khIsOverdue(o);
  const dueSoon = !overdue && s!=='done' && o.deliveryDate && (new Date(o.deliveryDate)-new Date())<86400000*2;
  const canStatus=isStaff();
  const canEdit=isAdmin();
  const si=statusInfo(s);
  const ti=khTimeInfo(o, s);
  const priNum = parseInt(String(o.priority||'').replace('GẤP ',''))||9;
  const priHigh = priNum<=3;
  const seqCls = overdue?'is-overdue':dueSoon?'is-duesoon':`st-${s}`;
  const machChip = khMachineChip(o);

  return `<div class="card kh-plan-card st-${s}${overdue?' is-overdue':''}${dueSoon?' is-duesoon':''}" data-order-id="${o.id}" onclick="khViewDetail('${o.id}')">
    <div class="card-header kh-hd status-${s}${overdue?' is-overdue':''}${dueSoon?' is-duesoon':''}">
      <div class="kh2-hd-top">
        ${seq!=null?`<div class="kh-seq-badge ${seqCls}" title="STT ${seq}">${seq}</div>`:''}
        <span class="kh2-badge status-${s}">${si.label}</span>
        ${o.priority?`<span class="kh2-badge pri${priHigh?'':' pri-low'}" style="${priHigh?`background:${pc}1f;color:${pc};border-color:${pc}55`:''}">🚩 ${o.priority}</span>`:''}
        ${overdue?`<span class="kh-overdue">⚠️ QUÁ HẠN</span>`:dueSoon?`<span class="kh-overdue is-duesoon">🟡 SẮP ĐẾN HẠN</span>`:''}
      </div>
      <div class="kh2-cust">${o.customer||'—'}</div>
      <div class="card-customer-row">
        ${o.po?`<span class="kh2-po">📄 PO: <b>${o.po}</b></span>`:''}
        <div class="kh-owner-chip" title="Người phụ trách">👤 ${ddOwner(o)}</div>
      </div>
    </div>
    ${orderSpecGridHTML(o)}
    <div class="kh2-time">
      <div class="kh2-time-col"><b>${o.startedAt?fmtDate(o.startedAt):(o.createdAt?fmtDate(o.createdAt):'—')}</b><span>${o.startedAt?'Bắt đầu':'Ngày tạo'}</span></div>
      <div class="kh2-time-col right"><b class="${overdue?'late':dueSoon?'soon':''}">${o.deliveryDate?fmtDate(o.deliveryDate):'—'}</b><span>Giao hàng</span></div>
    </div>
    ${machChip?`<div class="kh-meta-row">${machChip}</div>`:''}
    ${o.note?`<div class="card-note">📝 ${o.note}</div>`:''}
    ${renderProgressBar(o)}
    ${s!=='pending'?`<div class="kh2-timeinfo ${ti.cls}"><span>${ti.lbl}</span><b${ti.id?` id="${ti.id}"`:''}>${ti.val}</b></div>`:''}
    ${renderStageTracker(o, canStatus)}
    ${renderAIWarn(o)}
    ${canStatus?`<div class="kh-plan-actions" onclick="event.stopPropagation()">
      ${s==='pending'?`<button class="kh-abtn start" id="kh-start-${o.id}" onclick="khPlanAction('${o.id}','running',this,event)" title="Bắt đầu sản xuất">
        <span class="kh-abtn-spin"></span><span class="kh-abtn-label"><span class="kh-abtn-ico">▶️</span><span class="kh-abtn-txt">Bắt đầu sản xuất</span></span>
      </button>`:''}
      ${s==='running'?`<button class="kh-abtn finish" id="kh-done-${o.id}" onclick="khPlanAction('${o.id}','done',this,event)" title="Hoàn thành">
        <span class="kh-abtn-spin"></span><span class="kh-abtn-label"><span class="kh-abtn-ico">✅</span><span class="kh-abtn-txt">Hoàn thành</span></span>
      </button>
      <button class="kh-abtn progress" onclick="khQuickProgress('${o.id}',event)" title="Cập nhật tiến độ chi tiết">
        <span class="kh-abtn-spin"></span><span class="kh-abtn-label"><span class="kh-abtn-ico">📊</span><span class="kh-abtn-txt">Tiến độ</span></span>
      </button>`:''}
      <button class="kh-util-icon kh-more" title="Thao tác khác" onclick="khToggleMenu('${o.id}',event)">⋯</button>
    </div>`:''}
  </div>`;
}

// Ripple lan tỏa từ điểm bấm — hiệu ứng phản hồi tức thì khi chạm nút
function khRipple(ev, btn){
  if(!ev || !btn) return;
  const old = btn.querySelector('.kh-ripple'); if(old) old.remove();
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.8;
  const cx = (typeof ev.clientX==='number' && ev.clientX) ? ev.clientX : rect.left+rect.width/2;
  const cy = (typeof ev.clientY==='number' && ev.clientY) ? ev.clientY : rect.top+rect.height/2;
  const span = document.createElement('span');
  span.className = 'kh-ripple';
  span.style.width = span.style.height = size+'px';
  span.style.left = (cx-rect.left-size/2)+'px';
  span.style.top = (cy-rect.top-size/2)+'px';
  btn.appendChild(span);
  span.addEventListener('animationend', ()=>span.remove());
}

// Bấm nút "Bắt đầu sản xuất" / "Hoàn thành" trong Kế hoạch SX:
// hiệu ứng ripple + loading ngắn, sau đó cập nhật trạng thái Realtime
// (không cần tải lại trang) thông qua setStatus() có sẵn của hệ thống.
// Khoá dùng chung cho MỌI thao tác sửa 1 kế hoạch sản xuất (Bắt đầu chạy,
// Chuyển công đoạn, Cập nhật tiến độ, Hoàn thành...) — đảm bảo đúng 1 đơn
// (theo id) không bị 2 thao tác chồng nhau xử lý cùng lúc (VD bấm rất nhanh
// 2 lần, hoặc thao tác từ Thẻ và từ Panel chi tiết cùng lúc). Các thao tác
// này CHỈ ĐƯỢC PHÉP CẬP NHẬT bản ghi đã có theo id — không bao giờ tạo mới.
const _planActionLock = new Set();
function withPlanLock(id, fn){
  if(_planActionLock.has(id)) return false;
  _planActionLock.add(id);
  try{ fn(); } finally { setTimeout(()=>_planActionLock.delete(id), 300); }
  return true;
}

function khPlanAction(id, newStatus, btn, ev){
  if(ev) ev.stopPropagation();
  if(!btn || btn.classList.contains('is-loading')) return;
  khRipple(ev, btn);
  btn.classList.add('is-loading');
  btn.disabled = true;
  setTimeout(()=>{ withPlanLock(id, ()=>setStatus(id, newStatus)); }, 360);
}

// ── State bộ lọc Kế hoạch sản xuất (ERP/MES table, đồng bộ Tab Đơn hàng) ──
let khSearchQ       = ''; // ô tìm kiếm
let khFilterStatus  = 'all'; // all | pending | running | overdue | priority
let khFilterCustomer= 'all';
let khFilterPriority= 'all';
let khFilterSpec    = 'all'; // lọc theo quy cách (VD: Φ18×6000mm)
let khFilterStage   = 'all';
let khFilterOwner   = 'all';
let khCreatedFrom = '', khCreatedTo = '';
let khDueFrom = '', khDueTo = '';

function khIsOverdue(o){
  return o.status!=='done' && !!o.deliveryDate && new Date(o.deliveryDate) < new Date(new Date().toDateString());
}
function khIsTopPriority(o){
  return !!o.priority && parseInt(String(o.priority).replace('GẤP ',''))<=3;
}

// Bấm vào 1 KPI card → bật/tắt lọc theo card đó (bấm lại card đang chọn để bỏ lọc)
function setKhFilter(f){
  khFilterStatus = (khFilterStatus===f) ? 'all' : f;
  renderKeHoach();
}

// Nhảy từ Tổng quan (Dashboard) sang tab Kế hoạch SX và áp đúng bộ lọc
// tương ứng (Chờ SX / Đang SX / Trễ tiến độ / Ưu tiên) — để các thẻ KPI trên
// Tổng quan trỏ thẳng tới ĐÚNG danh sách đơn hàng liên quan, không phải chỉ
// mở tab rồi để người dùng tự lọc lại.
function goToKeHoachFilter(f){
  khFilterStatus = f;
  goTab('keHoach');
}

// Nhảy sang tab Đơn Hàng, bỏ hết bộ lọc đang áp dụng (dùng cho thẻ KPI
// "Tổng đơn hàng" / "Sản lượng tổng" trên Tổng quan — chỉ set biến bộ lọc,
// KHÔNG tự render ở đây vì goTab()->renderTab() sẽ render lại ngay sau).
function goToDorDangAll(){
  searchQ=''; filterStatus='all'; ddRecvFrom=''; ddPriorityFilter='all'; ddCustomerFilter='all'; ddSpecFilter='all';
  goTab('dorDang');
}
// Nhảy sang tab Đơn hoàn thành, bỏ hết bộ lọc đang áp dụng (dùng cho thẻ KPI
// "Tổng hoàn thành" trên Tổng quan)

// Nhảy sang tab Đơn Hàng và lọc đúng các đơn được TẠO trong hôm nay (dùng
// cho thẻ KPI "Đơn hàng hôm nay" trên Tổng quan)
function goToDorDangToday(){
  filterStatus = 'all'; searchQ=''; ddRecvFrom=todayStr(); ddPriorityFilter='all'; ddCustomerFilter='all'; ddSpecFilter='all';
  goTab('dorDang');
}

function khResetFilters(){
  khFilterStatus='all'; khFilterCustomer='all'; khFilterPriority='all'; khFilterSpec='all';
  khFilterStage='all'; khFilterOwner='all';
  khCreatedFrom=''; khCreatedTo=''; khDueFrom=''; khDueTo=''; khSearchQ='';
  renderKeHoach();
  showToast('↺ Đã đặt lại bộ lọc');
}

function renderKeHoach(){
  // #khSearch giờ luôn là input ẩn (xem usBarHTML) — bỏ đọc lại giá trị DOM
  // cũ đè lên khSearchQ, lý do xem chú thích tương tự ở đầu renderDorDang().
  const caretPos=null, hadFocus=false;

  const priSort=(a,b)=>parseInt((a.priority||'GẤP 9').replace('GẤP ',''))-parseInt((b.priority||'GẤP 9').replace('GẤP ',''));
  // Lưới an toàn khi RENDER: đảm bảo danh sách hiển thị luôn duy nhất theo
  // id (Map tự loại id trùng, giữ bản xuất hiện sau cùng) — không bao giờ
  // render 2 thẻ cho cùng 1 đơn dù dữ liệu nguồn có vấn đề gì đi nữa.
  const _uniqOrders = [...new Map(DB.orders.map(o=>[o.id,o])).values()];
  // Đơn đã hoàn thành (status='done') theo dõi ở tab riêng "Hoàn thành", không hiện ở Kế hoạch
  const allActive = _uniqOrders.filter(o=>o.status!=='done');
  const doneCount = DB.orders.filter(o=>o.status==='done').length;

  const waiting     = allActive.filter(o=>o.status==='pending');
  const running     = allActive.filter(o=>o.status==='running'||o.status==='cutting');
  const overdueList = allActive.filter(khIsOverdue);
  const priorityList= allActive.filter(khIsTopPriority);
  const totalKg     = allActive.reduce((s,o)=>s+(Number(o.kg)||0),0);
  const kgSum = arr=>arr.reduce((s,o)=>s+(Number(o.kg)||0),0);
  const doneKg = DB.orders.filter(o=>o.status==='done').reduce((s,o)=>s+(Number(o.kg)||0),0);

  const owners = [...new Set(allActive.map(o=>o.createdBy).filter(Boolean))]
    .map(uid=>(DB.users||[]).find(u=>u.id===uid)).filter(Boolean);
  const customers = [...new Set(allActive.map(o=>o.customer).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));

  // Áp bộ lọc + tìm kiếm
  let list = allActive;
  if(khSearchQ) list = list.filter(o=>matchSearch(o, khSearchQ));
  if(khFilterStatus==='pending') list = list.filter(o=>o.status==='pending');
  else if(khFilterStatus==='running') list = list.filter(o=>o.status==='running'||o.status==='cutting');
  else if(khFilterStatus==='overdue') list = list.filter(khIsOverdue);
  else if(khFilterStatus==='priority') list = list.filter(khIsTopPriority);
  if(khFilterCustomer!=='all') list = list.filter(o=>o.customer===khFilterCustomer);
  if(khFilterPriority!=='all') list = list.filter(o=>o.priority===khFilterPriority);
  if(khFilterSpec!=='all') list = list.filter(o=>specStr(o)===khFilterSpec);
  if(khFilterStage!=='all') list = list.filter(o=>(o.stage||'')===khFilterStage);
  if(khFilterOwner!=='all') list = list.filter(o=>o.createdBy===khFilterOwner);
  if(khCreatedFrom||khCreatedTo) list = list.filter(o=>ddInRange(o.createdAt, khCreatedFrom, khCreatedTo));
  if(khDueFrom||khDueTo) list = list.filter(o=>ddInRange(o.deliveryDate, khDueFrom, khDueTo));
  // Sắp xếp: đơn ĐANG CHẠY lên trên trước (đơn nào chạy trước → xếp trước,
  // tức thời gian bắt đầu sớm hơn thì lên trên); đơn CHỜ SẢN XUẤT xếp sau
  // cùng, theo mức ưu tiên — giúp theo dõi luồng sản xuất, tránh rối mắt.
  const khSort=(a,b)=>{
    const aRun = a.status==='running'||a.status==='cutting';
    const bRun = b.status==='running'||b.status==='cutting';
    if(aRun && !bRun) return -1;
    if(!aRun && bRun) return 1;
    if(aRun && bRun) return (a.startedAt||0)-(b.startedAt||0);
    return priSort(a,b);
  };
  list = list.slice().sort(khSort);

  const stats = [
    {key:'pending',  icon:'⏳', ic:'#FCF0DE', col:'#C2700A', n:waiting.length,      l:'Chờ sản xuất',  sub:kgSum(waiting).toLocaleString('vi-VN')+' kg'},
    {key:'running',  icon:'⚙️', ic:'#DBEAFE', col:'#2856D6', n:running.length,      l:'Đang sản xuất', sub:kgSum(running).toLocaleString('vi-VN')+' kg'},
    {key:'priority', icon:'🚩', ic:'#FEE2E2', col:'#DC2626', n:priorityList.length, l:'Đơn ưu tiên',   sub:kgSum(priorityList).toLocaleString('vi-VN')+' kg'},
    {key:'overdue',  icon:'⚠️', ic:'#FEE2E2', col:'#DC2626', n:overdueList.length,  l:'Trễ tiến độ',   sub:kgSum(overdueList).toLocaleString('vi-VN')+' kg'},
  ];

  const isFiltered = khSearchQ||khFilterStatus!=='all'||khFilterCustomer!=='all'||khFilterPriority!=='all'||khFilterSpec!=='all'||khFilterStage!=='all'||khFilterOwner!=='all'||khCreatedFrom||khCreatedTo||khDueFrom||khDueTo;

  // ── Chip tóm tắt bộ lọc đang áp dụng (không đổi logic — chỉ đọc lại các
  // biến bộ lọc đã có sẵn và gọi lại đúng setter + renderKeHoach() khi bấm ✕,
  // giống hệt việc chọn "Tất cả" trong Bottom Sheet bộ lọc hiện tại). ──
  const KH_STATUS_LABEL = {pending:'Chờ sản xuất', running:'Đang sản xuất', overdue:'Trễ tiến độ', priority:'Đơn ưu tiên'};
  const filterChips = [];
  if(khFilterStatus!=='all') filterChips.push({l:'Trạng thái', v:KH_STATUS_LABEL[khFilterStatus]||khFilterStatus, clear:"setKhFilter('"+khFilterStatus+"')"});
  if(khFilterCustomer!=='all') filterChips.push({l:'Khách hàng', v:khFilterCustomer, clear:"khFilterCustomer='all';renderKeHoach()"});
  if(khFilterPriority!=='all') filterChips.push({l:'Ưu tiên', v:khFilterPriority, clear:"khFilterPriority='all';renderKeHoach()"});
  if(khFilterSpec!=='all') filterChips.push({l:'Quy cách', v:khFilterSpec, clear:"khFilterSpec='all';renderKeHoach()"});
  if(khFilterStage!=='all'){ const stg=STAGES.find(x=>x.key===khFilterStage); filterChips.push({l:'Công đoạn', v:stg?stg.label:khFilterStage, clear:"khFilterStage='all';renderKeHoach()"}); }
  if(khFilterOwner!=='all'){ const ow=(DB.users||[]).find(u=>u.id===khFilterOwner); filterChips.push({l:'Phụ trách', v:ow?ow.name:khFilterOwner, clear:"khFilterOwner='all';renderKeHoach()"}); }
  if(khCreatedFrom||khCreatedTo) filterChips.push({l:'Ngày tạo', v:(khCreatedFrom||'…')+' → '+(khCreatedTo||'…'), clear:"khCreatedFrom='';khCreatedTo='';renderKeHoach()"});
  if(khDueFrom||khDueTo) filterChips.push({l:'Hạn giao', v:(khDueFrom||'…')+' → '+(khDueTo||'…'), clear:"khDueFrom='';khDueTo='';renderKeHoach()"});

  $('mc').innerHTML=`
    <div class="kh-page">
    <div class="dd-overview">
      <span><b>${allActive.length}</b>kế hoạch đang quản lý</span>
      <span><b>${customers.length}</b>khách hàng</span>
      <span><b>${totalKg.toLocaleString('vi-VN')}kg</b>tổng khối lượng</span>
    </div>

    <div class="dd-stats-sticky kh-kpi-sticky"><div class="dd-stats kh-kpi-row">
      ${stats.map(s=>`<button class="dd-stat${khFilterStatus===s.key?' active':''}" onclick="setKhFilter('${s.key}')">
        <div class="dd-stat-ic" style="background:${s.ic};color:${s.col}">${s.icon}</div>
        <div class="dd-stat-txt"><div class="dd-stat-n">${s.n}</div><div class="dd-stat-l">${s.l}</div><div class="dd-stat-sub">${s.sub}</div></div>
      </button>`).join('')}
      <button class="dd-stat" title="Xem ở tab Hoàn thành" onclick="goTab('hoanThanh')">
        <div class="dd-stat-ic" style="background:#E3F5EE;color:#0C7A54">✅</div>
        <div class="dd-stat-txt"><div class="dd-stat-n">${doneCount}</div><div class="dd-stat-l">Hoàn thành</div><div class="dd-stat-sub">${doneKg.toLocaleString('vi-VN')} kg</div></div>
      </button>
      <button class="dd-stat" style="cursor:default" onclick="void(0)">
        <div class="dd-stat-ic" style="background:#EEF0F3;color:#556072">⚖️</div>
        <div class="dd-stat-txt"><div class="dd-stat-n">${totalKg.toLocaleString('vi-VN')}</div><div class="dd-stat-l">Tổng khối lượng</div><div class="dd-stat-sub">kg · tất cả kế hoạch</div></div>
      </button>
    </div></div>

    <div class="kh-filter-bar">
      <div class="kh-filter-left">
        <span class="kh-filter-label">Bộ lọc đang áp dụng:</span>
        ${filterChips.length ? filterChips.map(c=>`<span class="kh-chip">${c.l}: ${c.v}<button onclick="${c.clear}" title="Bỏ lọc ${c.l}">✕</button></span>`).join('')
          : `<span class="kh-chip kh-chip-empty">Tất cả kế hoạch</span>`}
        ${khSearchQ?`<span class="kh-chip">🔎 “${khSearchQ.replace(/"/g,'&quot;')}”<button onclick="usClearSearch('keHoach')" title="Xóa từ khóa">✕</button></span>`:''}
        ${isFiltered?`<button class="kh-chip-clear" onclick="khResetFilters()">Xóa tất cả</button>`:''}
      </div>
      <div style="display:none">${usBarHTML('keHoach', khSearchQ, 'khSearch', '🔍 Tìm khách hàng, PO, mã, quy cách (VD: fi18, 2x12 cuộn)...')}</div>
      <div class="kh-filter-right">
        <span class="kh-filter-count">Hiển thị <b>${list.length}</b> / ${allActive.length} kế hoạch</span>
        <span class="kh-legend">
          <span><b style="background:#2563EB"></b>Đang chạy</span>
          <span><b style="background:#F59E0B"></b>Sắp hạn</span>
          <span><b style="background:#DC2626"></b>Quá hạn</span>
        </span>
      </div>
    </div>
    </div>

    ${!list.length
      ? `<div class="ord-empty">${isFiltered?'🔍 Không tìm thấy kế hoạch phù hợp':'📋 Chưa có kế hoạch sản xuất nào'}</div>`
      : `<div class="kh-page"><div class="kh-plan-grid">${list.map((o,i)=>khPlanCard(o,i+1)).join('')}</div></div>`}
  `;
  usAttachSearchInput(document.getElementById('khSearch'), v=>khSearchQ=v, renderKeHoach, hadFocus, caretPos);
}
