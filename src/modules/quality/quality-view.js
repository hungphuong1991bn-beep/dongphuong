// src/modules/quality/quality-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// THÀNH PHẨM (trước đây "Hoàn thành") — trung tâm quản lý đơn hàng
// SAU sản xuất: theo dõi nhập kho, chuẩn bị và xác nhận giao hàng.
// Không hiển thị tiến độ sản xuất vì đơn đã xong.
// ════════════════════════════════════════════════════════════
let htSearchQ = '';               // search query cho tab Đơn hàng đã hoàn thành
let htFilterStatus = 'all';       // all | today | new | wh_all | shipping | delivered | returned
let htDoneFrom = '', htDoneTo = ''; // lọc theo ngày hoàn thành
let htMobDateTab = 'all';         // tab khoảng ngày cho giao diện thẻ mobile: all|today|yesterday|7d|30d|custom
let htMobPage = 1;                // trang hiện tại của giao diện thẻ mobile (phân trang)
const HTM_PAGE_SIZE = 5;          // số thẻ / trang trên giao diện mobile
let htCustomerFilter = 'all';     // lọc theo khách hàng
let htFilterPriority = 'all';     // lọc theo mức ưu tiên
let htFilterSpec = 'all';         // lọc theo quy cách (VD: Φ18×6000mm)
let htSelected = new Set();       // các đơn đang chọn để thao tác hàng loạt
let _htVisibleIds = [];

// Đơn có phải vừa hoàn thành trong 24-48h gần nhất không (ẩn ngay khi người dùng đã xem)
function htIsFresh(o){
  if(!o.doneAt) return false;
  if(o.viewedDoneAt && o.viewedDoneAt>=o.doneAt) return false;
  return (Date.now()-o.doneAt) < 172800000; // 48h
}
function htIsToday(ts){
  if(!ts) return false;
  const d=new Date(ts), n=new Date();
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
}

// ── Nhắc nhở đơn SẮP bị tự động XOÁ VĨNH VIỄN ──────────────────────────
// Dùng lại đúng mốc AUTOCLEAN_DAYS (30 ngày kể từ doneAt) của
// autoCleanupDoneOrders() ở trên để tính còn bao nhiêu ngày nữa 1 đơn
// hoàn thành sẽ bị tự động xoá vĩnh viễn (KHÔNG qua Thùng rác, không thể
// khôi phục), rồi cảnh báo trước cho người dùng ngay trong tab "Đơn hoàn
// thành" (không đợi tới lúc đơn biến mất mới biết). null nghĩa là không
// áp dụng (đơn chưa có doneAt).
const HT_PURGE_WARN_DAYS = 5; // còn <= 5 ngày thì bắt đầu nhắc nhở
function htDaysUntilPurge(o){
  if(!o || !Number(o.doneAt)) return null;
  const purgeAt = Number(o.doneAt) + AUTOCLEAN_DAYS*24*60*60*1000;
  return Math.ceil((purgeAt - Date.now())/(24*60*60*1000));
}
function htIsExpiringSoon(o){
  const d = htDaysUntilPurge(o);
  return d!=null && d<=HT_PURGE_WARN_DAYS; // gồm cả đơn đã quá hạn (không còn tự xoá — chờ Admin dọn)
}

// Trạng thái nghiệp vụ của 1 đơn thành phẩm — 5 mốc: Hoàn thành → Đã nhập
// kho / Chờ giao → Đã giao, cộng thêm Hoàn trả (nếu có, luôn ưu tiên hiển thị)
function htStage(o){
  if(o.returned) return {key:'returned', label:'Hoàn trả', icon:'🔄', color:'#9C2E27', bg:'#FBEAE8', border:'#F3B7B1'};
  if(o.delivered) return {key:'delivered', label:'Đã giao', icon:'✅', color:'#6D28D9', bg:'#F3E8FF', border:'#D8B4FE'};
  if(o.whIn) return {key:'shipping', label:'Chờ giao', icon:'🚚', color:'#1D4ED8', bg:'#DBEAFE', border:'#93C5FD'};
  return {key:'new', label:'Hoàn thành', icon:'🟢', color:'#0C7A54', bg:'#E3F5EE', border:'#86EFAC'};
}

// Icon SVG hiện đại cho badge trạng thái (thay emoji để hiển thị đồng nhất trên
// mọi thiết bị/hệ điều hành, tránh lỗi icon hiển thị sai/lệch phông emoji)
function htStageIcon(key){
  const icons = {
    new:       '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    shipping:  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.5h11v8.5h-11z"/><path d="M13.5 9.5h3.6l3.4 3.2v2.3h-7z"/><circle cx="6.5" cy="17.5" r="1.7"/><circle cx="17" cy="17.5" r="1.7"/></svg>',
    delivered: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12.5l4 4L15.5 6"/><path d="M9.2 12.5l4 4L22.5 6"/></svg>',
    returned:  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3"/><path d="M3.2 3.8v5h5"/></svg>',
  };
  return icons[key] || '';
}

// Dòng phụ ngày/giờ hiển thị ngay dưới badge trạng thái — thay thế thông tin
// trước đây nằm ở 2 cột riêng "Nhập kho" / "Ngày giao" (nay đã gộp vào đây
// cho gọn, đỡ phải kéo ngang bảng mà vẫn không mất dữ liệu thời gian).
function htStatusSub(o, st){
  if(st.key==='returned') return o.returnedAt ? `Lúc ${fmtDateTime(o.returnedAt)}` : '';
  if(st.key==='delivered') return o.deliveredAt ? `Giao lúc ${fmtDateTime(o.deliveredAt)}` : '';
  if(st.key==='shipping') return o.whAt ? `Nhập kho ${fmtDateTime(o.whAt)}` : '';
  if(st.key==='new') return o.deliveryDate ? `Hạn giao ${fmtDate(o.deliveryDate)}` : '';
  return '';
}

function htCode(o){ return ddCode(o); }

// Nhảy sang tab Đơn Hàng và cuộn/nổi bật đúng đơn hàng đang xem ở tab
// "Đơn hàng đã hoàn thành" — cần reset bộ lọc/tìm kiếm ở Đơn Hàng trước để
// đảm bảo đơn chắc chắn hiển thị (nếu đang lọc dở dang sẽ không thấy được).
function htGoToOrderInDonHang(id, ev){
  if(ev) ev.stopPropagation();
  searchQ=''; filterStatus='all'; ddRecvFrom=''; ddPriorityFilter='all'; ddCustomerFilter='all'; ddSpecFilter='all';
  goTab('dorDang');
  setTimeout(()=>{
    const el = document.querySelector('[data-order-id="'+id+'"]');
    if(el){
      el.scrollIntoView({behavior:'smooth', block:'center'});
      el.classList.add('order-jump-highlight');
      setTimeout(()=>{ el.classList.remove('order-jump-highlight'); }, 2000);
    }
  }, 280);
}

// Người xác nhận gần nhất — ưu tiên mốc nghiệp vụ mới nhất đã xảy ra
function htConfirmedBy(o){
  if(o.delivered) return o.deliveredBy || o.whBy || o.doneBy || '—';
  if(o.whIn) return o.whBy || o.doneBy || '—';
  return o.doneBy || '—';
}

// ── Giao diện THẺ (card) trên MOBILE cho tab "Đơn hoàn thành" ──
// Dùng lại nguyên dữ liệu/hàm đã có (htStage, htCode, htConfirmedBy,
// specStr, qtyLabel...), chỉ thêm: dải tab lọc theo khoảng ngày (đặt
// trực tiếp vào htDoneFrom/htDoneTo đã có sẵn) + phân trang riêng cho
// danh sách thẻ (không ảnh hưởng bảng desktop, vẫn hiển thị đủ danh
// sách đã lọc).
// Trả về chuỗi ngày ĐỊA PHƯƠNG (giờ Việt Nam) dạng yyyy-mm-dd — TRƯỚC ĐÂY
// dùng toISOString() (giờ UTC) nên có thể lệch sang ngày hôm trước/sau,
// khiến tab "Hôm nay"/"Hôm qua" tính sai ngày cần lọc.
function _htmYmd(d){
  const dt=new Date(d);
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
}

function htmSetDateTab(key, ev){
  if(ev) ev.stopPropagation();
  if(key==='custom'){ htMobDateTab='custom'; usOpen('hoanThanh', ev?ev.currentTarget:null); return; }
  htMobDateTab = key;
  const now = new Date();
  if(key==='today'){ const s=_htmYmd(now); htDoneFrom=s; htDoneTo=s; }
  else if(key==='yesterday'){ const y=new Date(now); y.setDate(y.getDate()-1); const s=_htmYmd(y); htDoneFrom=s; htDoneTo=s; }
  else if(key==='7d'){ const f=new Date(now); f.setDate(f.getDate()-6); htDoneFrom=_htmYmd(f); htDoneTo=_htmYmd(now); }
  else if(key==='30d'){ const f=new Date(now); f.setDate(f.getDate()-29); htDoneFrom=_htmYmd(f); htDoneTo=_htmYmd(now); }
  else { htDoneFrom=''; htDoneTo=''; } // 'all'
  htMobPage = 1;
  renderHoanThanh();
}

function htmGoPage(n, totalPages){
  htMobPage = Math.max(1, Math.min(n, totalPages||1));
  renderHoanThanh();
  const list = document.getElementById('htmList');
  if(list) list.scrollIntoView({behavior:'smooth', block:'start'});
}

// Phân trang kiểu "« ‹ 1 2 3 4 5 … 10 › »" giống bảng dữ liệu quen thuộc
function htmPagerHTML(total, page, pageSize){
  const totalPages = Math.max(1, Math.ceil(total/pageSize));
  const cur = Math.min(Math.max(1,page), totalPages);
  const from = total ? (cur-1)*pageSize+1 : 0;
  const to = Math.min(total, cur*pageSize);
  let nums = [];
  if(totalPages<=7){ for(let i=1;i<=totalPages;i++) nums.push(i); }
  else{
    nums.push(1);
    if(cur>3) nums.push('…');
    const s=Math.max(2,cur-1), e=Math.min(totalPages-1,cur+1);
    for(let i=s;i<=e;i++) nums.push(i);
    if(cur<totalPages-2) nums.push('…');
    nums.push(totalPages);
  }
  return `<div class="htm-pager">
    <div class="htm-pager-nav">
      <button class="htm-pager-btn" ${cur<=1?'disabled':''} onclick="htmGoPage(1,${totalPages})" title="Trang đầu">«</button>
      <button class="htm-pager-btn" ${cur<=1?'disabled':''} onclick="htmGoPage(${cur-1},${totalPages})" title="Trang trước">‹</button>
      ${nums.map(n=>n==='…'?`<span class="htm-pager-dots">…</span>`:`<button class="htm-pager-btn${n===cur?' active':''}" onclick="htmGoPage(${n},${totalPages})">${n}</button>`).join('')}
      <button class="htm-pager-btn" ${cur>=totalPages?'disabled':''} onclick="htmGoPage(${cur+1},${totalPages})" title="Trang sau">›</button>
      <button class="htm-pager-btn" ${cur>=totalPages?'disabled':''} onclick="htmGoPage(${totalPages},${totalPages})" title="Trang cuối">»</button>
    </div>
    <div class="htm-pager-info">Hiển thị ${from} – ${to} của ${total} đơn</div>
  </div>`;
}

// 1 thẻ đơn thành phẩm trên mobile — 2 cột thông tin, mã đơn + trạng thái
// ở đầu thẻ, bấm vào thẻ mở đúng chi tiết như bản desktop (htViewDetail).
function htmCard(o){
  const st = htStage(o);
  const dur = (o.startedAt && o.doneAt) ? fmtDuration(o.doneAt-o.startedAt) : '—';
  const expSoon = htIsExpiringSoon(o);
  const purgeDays = expSoon ? htDaysUntilPurge(o) : null;
  return `<div class="htm-card${expSoon?' ht-expiring':''}" data-order-id="${o.id}" onclick="htViewDetail('${o.id}')">
    <div class="htm-top">
      <span class="htm-check" style="color:${st.color}">${htStageIcon(st.key)}</span>
      <span class="htm-code">${o.customer||'—'}</span>
      <span class="htm-badge" style="background:${st.bg};color:${st.color};border-color:${st.border}">${st.label}</span>
    </div>
    ${expSoon?`<div class="htm-expire-pill" title="Đơn đã gần/quá hạn lưu 30 ngày — chỉ Admin mới dọn được (thủ công, không khôi phục được)">⏳ ${purgeDays<=0?'Quá hạn lưu — chờ Admin dọn':'Còn '+purgeDays+' ngày tới hạn lưu'}</div>`:''}
    <div class="htm-grid">
      <div class="htm-cell"><span class="htm-lbl">Nguyên liệu</span><span class="htm-val">${ddMaterialLabel(o.material)}</span></div>
      <div class="htm-cell"><span class="htm-lbl">PO</span><span class="htm-val">${o.po||'—'}</span></div>
      <div class="htm-cell"><span class="htm-lbl">Sản phẩm</span><span class="htm-val">${o.type||'—'}</span></div>
      <div class="htm-cell"><span class="htm-lbl">Ngày nhận</span><span class="htm-val">${fmtDate(o.createdAt)}</span></div>
      <div class="htm-cell"><span class="htm-lbl">Quy cách</span><span class="htm-val">${specStr(o)}</span></div>
      <div class="htm-cell"><span class="htm-lbl">Hoàn thành lúc</span><span class="htm-val">${fmtDateTime(o.doneAt)}</span></div>
      <div class="htm-cell"><span class="htm-lbl">Số lượng kế hoạch</span><span class="htm-val">${qtyLabel(o)}</span></div>
      <div class="htm-cell"><span class="htm-lbl">Thời gian SX</span><span class="htm-val htm-val-dur">${dur}</span></div>
      <div class="htm-cell"><span class="htm-lbl">Số lượng hoàn thành</span><span class="htm-val htm-val-done">${qtyLabel(o)}${o.kg?` · ${o.kg}kg`:''}</span></div>
      <div class="htm-cell"><span class="htm-lbl">Nhân viên phụ trách</span><span class="htm-val">${htConfirmedBy(o)}</span></div>
    </div>
  </div>`;
}

// ── Thao tác hàng loạt ──

// ── 1 Card trong danh sách Hoàn thành (ERP/MES style, badge "Mới hoàn thành" ở góc trên phải) ──
function htRow(o, stt){
  const st = htStage(o);
  const fresh = htIsFresh(o);
  const expSoon = htIsExpiringSoon(o);
  const purgeDays = expSoon ? htDaysUntilPurge(o) : null;
  const rowCls = [fresh?'ht-fresh':'', expSoon?'ht-expiring':''].filter(Boolean).join(' ');
  return `<tr class="${rowCls}" data-order-id="${o.id}" onclick="htViewDetail('${o.id}')">
    <td><div class="ord-cust-info"><span class="ord-stt-badge" title="STT">${stt!=null?stt:''}</span><div class="ord-cust-info-txt"><span class="ord-cust-name">${o.customer||'—'}</span>${o.po?`<span class="ord-po-sub">PO ${o.po}</span>`:''}</div></div></td>
    <td>${o.type||'—'}</td>
    <td>${ddMaterialLabel(o.material)}</td>
    <td><span class="spec-chip">${specStr(o)}</span></td>
    <td>${qtyLabel(o)}${o.kg?`<div style="font-size:10.5px;color:var(--text4);font-weight:600">⚖️ ${o.kg}kg</div>`:''}</td>
    <td>${fmtDate(o.createdAt)}</td>
    <td style="color:#0C7A54;font-weight:800">${fmtDateTime(o.doneAt)}</td>
    <td style="color:var(--brand);font-weight:800">${o.startedAt&&o.doneAt?fmtDuration(o.doneAt-o.startedAt):'—'}</td>
    <td>
      <div class="ht-status-cell">
        <span class="dd-status-pill ht-status-pill-modern" style="background:${st.bg};color:${st.color};border-color:${st.border}"><span class="ht-status-ic">${htStageIcon(st.key)}</span>${st.label}</span>
        ${htStatusSub(o,st)?`<div class="ht-status-sub">${htStatusSub(o,st)}</div>`:''}
        ${fresh?'<span class="ht-fresh-pill">Mới</span>':''}
        ${expSoon?`<span class="ht-expire-pill" title="Đơn đã gần/quá hạn lưu 30 ngày — chỉ Admin mới dọn được (thủ công, không khôi phục được)">⏳ ${purgeDays<=0?'Sắp bị':'Còn '+purgeDays+' ngày'} xoá</span>`:''}
      </div>
    </td>
    <td>${htConfirmedBy(o)}</td>
    <td onclick="event.stopPropagation()" style="white-space:nowrap">
      <div class="dd-menu-wrap" style="display:inline-block"><button class="dd-act-btn icon-only" title="Thao tác" onclick="htToggleMenu('${o.id}',event)">⋮</button></div>
    </td>
  </tr>`;
}

function renderHoanThanh(){
  // #htSearch giờ luôn là input ẩn (xem usBarHTML) — bỏ đọc lại giá trị DOM
  // cũ đè lên htSearchQ, lý do xem chú thích tương tự ở đầu renderDorDang().
  const caretPos = null, hadFocus = false;

  const allDone = DB.orders.filter(o=>o.status==='done');
  const totalDone   = allDone.length;
  const doneToday   = allDone.filter(o=>htIsToday(o.doneAt)).length;
  const waitWh      = allDone.filter(o=>htStage(o).key==='new').length;
  const inWh        = allDone.filter(o=>o.whIn).length;
  const waitShip    = allDone.filter(o=>htStage(o).key==='shipping').length;
  const delivered   = allDone.filter(o=>o.delivered).length;
  const totalKg     = allDone.reduce((s,o)=>s+(Number(o.kg)||0),0);
  const totalCustomers = new Set(allDone.map(o=>o.customer).filter(Boolean)).size;
  const customers = [...new Set(allDone.map(o=>o.customer).filter(Boolean))].sort();
  // Đơn sắp bị AUTO CLEANUP xoá vĩnh viễn (xem HT_PURGE_WARN_DAYS/AUTOCLEAN_DAYS)
  const expiringSoon = allDone.filter(htIsExpiringSoon).sort((a,b)=>(a.doneAt||0)-(b.doneAt||0));
  const expiringCount = expiringSoon.length;

  // Áp bộ lọc
  let list = allDone;
  if(htSearchQ) list = list.filter(o=>htMatchSearch(o,htSearchQ));
  if(htFilterStatus==='today') list = list.filter(o=>htIsToday(o.doneAt));
  else if(htFilterStatus==='wh_all') list = list.filter(o=>o.whIn);
  else if(htFilterStatus==='expiringSoon') list = list.filter(htIsExpiringSoon);
  else if(htFilterStatus!=='all') list = list.filter(o=>htStage(o).key===htFilterStatus);
  if(htDoneFrom||htDoneTo) list = list.filter(o=>ddInRange(o.doneAt, htDoneFrom, htDoneTo));
  if(htCustomerFilter!=='all') list = list.filter(o=>o.customer===htCustomerFilter);
  if(htFilterPriority!=='all') list = list.filter(o=>o.priority===htFilterPriority);
  if(htFilterSpec!=='all') list = list.filter(o=>specStr(o)===htFilterSpec);
  list = htSmartSort(list);

  const stats = [
    {key:'all',       icon:'📦', ic:'#EEF0F3', col:'#556072', n:totalDone, l:'Tổng đơn hoàn thành'},
    {key:'today',     icon:'📅', ic:'#E3F5EE', col:'#0C7A54', n:doneToday, l:'Hoàn thành hôm nay'},
    {key:'new',       icon:'⏳', ic:'#FCF1DE', col:'#8A5A0E', n:waitWh,    l:'Chờ nhập kho'},
    {key:'wh_all',    icon:'📦', ic:'#DBEAFE', col:'#1D4ED8', n:inWh,      l:'Đã nhập kho'},
    {key:'shipping',  icon:'🚚', ic:'#DBEAFE', col:'#1D4ED8', n:waitShip,  l:'Chờ giao'},
    {key:'delivered', icon:'✅', ic:'#F3E8FF', col:'#6D28D9', n:delivered, l:'Đã giao'},
    {key:'expiringSoon', icon:'⏳', ic:'#FCF1DE', col:'#8A5A0E', n:expiringCount, l:'Sắp tới hạn dọn'},
  ];

  const selIds = list.map(o=>o.id);
  _htVisibleIds = selIds;
  const allChecked = selIds.length>0 && selIds.every(id=>htSelected.has(id));

  // Phân trang riêng cho giao diện THẺ mobile — không ảnh hưởng bảng desktop
  // (bảng desktop vẫn hiển thị đủ list đã lọc, có cuộn dọc như trước).
  const htmTotalPages = Math.max(1, Math.ceil(list.length/HTM_PAGE_SIZE));
  if(htMobPage>htmTotalPages) htMobPage = htmTotalPages;
  if(htMobPage<1) htMobPage = 1;
  const htmPageList = list.slice((htMobPage-1)*HTM_PAGE_SIZE, htMobPage*HTM_PAGE_SIZE);
  const htmEmptyMsg = htSearchQ||htFilterStatus!=='all'||htDoneFrom||htCustomerFilter!=='all'||htFilterPriority!=='all'||htFilterSpec!=='all'?'🔍 Không tìm thấy đơn thành phẩm phù hợp':'📦 Chưa có đơn nào hoàn thành sản xuất';

  // 4 thẻ KPI 2x2 riêng cho mobile (2 thẻ đầu bấm được để lọc nhanh, 2 thẻ
  // sau là số liệu tổng hợp — dùng đúng số liệu thật đã tính ở trên, không
  // có dữ liệu "trị giá đơn hàng" trong hệ thống nên thay bằng Khách hàng).
  const htmStats = [
    {key:'all',   c:'#2856D6', bg:'#DBEAFE', icon:'📄', n:totalDone, l:'Tất cả', unit:'đơn', clickable:true},
    {key:'today', c:'#0C7A54', bg:'#E3F5EE', icon:'📅', n:doneToday, l:'Hoàn thành hôm nay', unit:'đơn', clickable:true},
    {key:'kg',    c:'#7C3AED', bg:'#F3E8FF', icon:'📊', n:totalKg.toLocaleString('vi-VN'), l:'SL hoàn thành', unit:'kg', clickable:false},
    {key:'cust',  c:'#C2700A', bg:'#FCF1DE', icon:'👥', n:totalCustomers, l:'Khách hàng', unit:'khách hàng', clickable:false},
    {key:'expiringSoon', c:'#8A5A0E', bg:'#FCF1DE', icon:'⏳', n:expiringCount, l:'Sắp tới hạn dọn', unit:'đơn', clickable:true},
  ];
  const htmDateTabs = [
    {key:'all',       l:'Tất cả'},
    {key:'today',     l:'Hôm nay'},
    {key:'yesterday', l:'Hôm qua'},
    {key:'7d',        l:'7 ngày'},
    {key:'30d',       l:'30 ngày'},
    {key:'custom',    l:'Tùy chọn ⌄'},
  ];

  $('mc').innerHTML=`
    <div class="dd-page-head">
      <div>
        <div class="dd-page-title">✅ Đơn hoàn thành</div>
        <div class="dd-page-sub">Theo dõi đơn hàng đã hoàn thành sản xuất</div>
      </div>
      <div class="dd-page-actions">
        <button class="dd-page-btn" onclick="tbFilterBtnClick(this)">🔽 Bộ lọc</button>
        <button class="dd-page-btn" onclick="htResetFilters()">↺ Đặt lại</button>
        <button class="dd-page-btn" onclick="htExportExcel()">⬇️ Xuất Excel</button>
      </div>
    </div>
    <div class="dd-overview">
      <span><b>${totalDone}</b>đơn thành phẩm</span>
      <span><b>${totalKg.toLocaleString('vi-VN')}kg</b>tổng sản lượng</span>
      <span><b>${totalCustomers}</b>khách hàng</span>
    </div>

    ${expiringCount>0 ? `<div class="warn-banner" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;cursor:pointer" onclick="htSetFilter('expiringSoon')">
      <span>⏳ <b>${expiringCount} đơn</b> sắp tới hạn lưu ${AUTOCLEAN_DAYS} ngày trong ${HT_PURGE_WARN_DAYS} ngày tới. Hệ thống KHÔNG tự xoá — chỉ Admin dọn thủ công. ${typeof dpOrdersCleanupBtnHTML==='function'?dpOrdersCleanupBtnHTML():''}</span>
      <span style="font-weight:800;white-space:nowrap">Xem ngay →</span>
    </div>` : ''}

    <div class="dd-stats-sticky"><div class="dd-stats">
      ${stats.map(s=>`<button class="dd-stat${htFilterStatus===s.key?' active':''}" onclick="htSetFilter('${s.key}')">
        <div class="dd-stat-ic" style="background:${s.ic};color:${s.col}">${s.icon}</div>
        <div class="dd-stat-txt"><div class="dd-stat-n">${s.n}</div><div class="dd-stat-l">${s.l}</div></div>
      </button>`).join('')}
    </div>
    ${usBarHTML('hoanThanh', htSearchQ, 'htSearch', '🔍 Tìm mã đơn, khách hàng, mã sản phẩm, QR (VD: fi18, 2x12 cuộn)...')}
    </div>

    <div class="dd-mobile-only">
      <div class="htm-head">
        <div class="htm-title">✅ Đơn hoàn thành</div>
        <div class="htm-head-actions">
          <button type="button" class="htm-head-btn" onclick="tbFilterBtnClick(this)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 4 21 4 14 13 14 19 10 21 10 13 3 4"/></svg>
            Lọc
          </button>
          <button type="button" class="htm-head-btn xls" onclick="htExportExcel()">⬇️ Xuất Excel</button>
        </div>
      </div>
      <div class="htm-stats">
        ${htmStats.map(s=>`<div class="htm-stat${s.clickable?'':' static'}${s.clickable&&htFilterStatus===s.key?' active':''}" style="--mob-c:${s.c};--mob-bg:${s.bg}"${s.clickable?` onclick="htSetFilter('${s.key}')"`:''}>
          <div class="htm-stat-top"><span class="htm-stat-ic">${s.icon}</span><span class="htm-stat-lbl">${s.l}</span></div>
          <div class="htm-stat-n">${s.n}</div>
          <div class="htm-stat-unit">${s.unit}</div>
        </div>`).join('')}
      </div>
      <div class="htm-tabs">
        ${htmDateTabs.map(t=>`<div class="htm-tab${htMobDateTab===t.key?' active':''}" onclick="htmSetDateTab('${t.key}',event)">${t.l}</div>`).join('')}
      </div>
      ${!list.length
        ? `<div class="htm-empty">${htmEmptyMsg}</div>`
        : `<div class="htm-count">Hiển thị ${list.length} / ${totalDone} đơn thành phẩm</div>
           <div class="htm-list" id="htmList">${htmPageList.map(o=>htmCard(o)).join('')}</div>
           ${htmPagerHTML(list.length, htMobPage, HTM_PAGE_SIZE)}`}
    </div>

    ${!list.length
      ? `<div class="ord-empty">${htmEmptyMsg}</div>`
      : `<div class="ord-list-toolbar">
          <span class="ord-list-count">Hiển thị ${list.length} / ${totalDone} đơn thành phẩm</span>
        </div>
        <div class="dd-scrolltop" id="htScrollTop"><div class="dd-scrolltop-inner" id="htScrollTopInner"></div></div>
        <div class="dd-table-wrap" id="htTableWrap"><table class="dd-table" id="htTable" style="min-width:1240px"><thead><tr>
          <th>Khách hàng</th>
          <th>Sản phẩm</th>
          <th>Nguyên liệu</th>
          <th>Quy cách</th>
          <th>Số lượng</th>
          <th>Ngày Đặt</th>
          <th>Hoàn thành lúc</th>
          <th>Thời gian SX</th>
          <th>Trạng thái</th>
          <th>Xác nhận</th>
          <th>Thao tác</th>
        </tr></thead><tbody>${list.map((o,i)=>htRow(o,i+1)).join('')}</tbody></table></div>`}
  `;
  usAttachSearchInput(document.getElementById('htSearch'), v=>{htSearchQ=v; htMobPage=1;}, renderHoanThanh, hadFocus, caretPos);
  initTopScroll('htScrollTop','htScrollTopInner','htTableWrap','htTable');
}
