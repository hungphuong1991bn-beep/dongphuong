// src/modules/customers/customers-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// TAB "KHÁCH HÀNG" (chỉ Admin) — quan sát tình trạng TỪNG khách hàng đã
// từng có đơn trong hệ thống: bao nhiêu đơn, bao nhiêu đã xong/chưa xong,
// đang có đơn trễ hạn hay không, mức ưu tiên cao nhất hiện tại... Toàn bộ
// số liệu được TÍNH TRỰC TIẾP từ DB.orders (tab Đơn hàng) mỗi lần render,
// nên luôn khớp 100% với dữ liệu đơn hàng, không lưu trùng ở đâu khác.
// ════════════════════════════════════════════════════════════
let khcSearchQ = '';       // ô tìm kiếm theo tên khách hàng
let khcFilter  = 'all';    // all | active | overdue | done
let khcSort    = 'recent'; // recent | orders | kg | name
let khcExpanded = new Set(); // tên khách hàng đang mở rộng xem chi tiết đơn

function khcBuildStats(){
  const now = Date.now();
  const map = new Map(); // customer -> stats
  (DB.orders||[]).forEach(o=>{
    const name = (o.customer||'').trim();
    if(!name) return;
    if(!map.has(name)) map.set(name, {
      name, orders:[], total:0, done:0, running:0, pending:0, overdue:0,
      kgTotal:0, kgDone:0, bestRank:99, bestPriority:null,
      lastOrderAt:0, nextDelivery:null
    });
    const r = map.get(name);
    const st = rptStatusOf(o);
    r.orders.push(o);
    r.total++;
    r.kgTotal += (parseFloat(o.kg)||0);
    if(st==='done'){ r.done++; r.kgDone += (parseFloat(o.kg)||0); }
    else{
      if(st==='running') r.running++; else r.pending++;
      if(o.deliveryDate){
        const due = new Date(o.deliveryDate).getTime();
        if(due < now) r.overdue++;
        if(!r.nextDelivery || due < r.nextDelivery) r.nextDelivery = due;
      }
      const rank = parseInt(String(o.priority||'GẤP 9').replace('GẤP ',''))||9;
      if(rank < r.bestRank){ r.bestRank = rank; r.bestPriority = o.priority || null; }
    }
    if(o.createdAt && o.createdAt > r.lastOrderAt) r.lastOrderAt = o.createdAt;
  });
  const rows = [...map.values()].map(r=>{
    r.notDone = r.total - r.done;
    r.pct = r.total ? Math.round(r.done / r.total * 100) : 0;
    // Sắp xếp đơn trong từng khách hàng theo 3 tầng ưu tiên:
    // 1) Đơn CHƯA XONG lên trên hết, đơn ĐÃ HOÀN THÀNH đẩy xuống dưới cùng.
    // 2) Trong nhóm chưa xong: đơn "GẤP" số càng nhỏ càng khẩn cấp → GẤP 1
    //    luôn nằm trên cùng, rồi tới GẤP 2, GẤP 3... và đơn không gắn mức
    //    ưu tiên xếp cuối nhóm.
    // 3) Cùng mức ưu tiên: đơn tạo gần đây nhất lên trước.
    const prRank = o => o.priority ? (parseInt(String(o.priority).replace('GẤP ',''))||9) : 99;
    r.orders.sort((a,b)=>{
      const aDone = rptStatusOf(a)==='done' ? 1 : 0;
      const bDone = rptStatusOf(b)==='done' ? 1 : 0;
      if(aDone!==bDone) return aDone-bDone;
      if(!aDone){
        const pr = prRank(a)-prRank(b);
        if(pr!==0) return pr;
      }
      return (b.createdAt||0)-(a.createdAt||0);
    });
    return r;
  });
  return rows;
}

function khcSetFilter(f){ khcFilter = f; renderKhachHang(); }
function khcSetSort(v){ khcSort = v; renderKhachHang(); }
function khcSearch(v){ khcSearchQ = v; renderKhachHang(); }
function khcToggleExpand(name){
  if(khcExpanded.has(name)) khcExpanded.delete(name); else khcExpanded.add(name);
  renderKhachHang();
}

function renderKhachHang(){
  // Phòng thủ 2 lớp: dù nút sidebar/bottom-nav đã ẩn, vẫn chặn thẳng nếu
  // không phải Admin/Nhân viên SX (isStaff() = admin||staff).
  if(!isStaff()){
    $('mc').innerHTML = `<div class="empty" style="padding:40px 0"><div class="empty-icon">🔒</div>Chỉ Quản trị viên / Nhân viên SX mới được xem tab này</div>`;
    return;
  }
  let rows = khcBuildStats();

  // Bộ lọc nhanh
  if(khcFilter==='active') rows = rows.filter(r=>r.running+r.pending>0);
  else if(khcFilter==='overdue') rows = rows.filter(r=>r.overdue>0);
  else if(khcFilter==='done') rows = rows.filter(r=>r.notDone===0);

  // Tìm kiếm theo tên
  if(khcSearchQ.trim()){
    const q = khcSearchQ.trim().toLowerCase();
    rows = rows.filter(r=>r.name.toLowerCase().includes(q));
  }

  // Sắp xếp
  if(khcSort==='orders') rows.sort((a,b)=>b.total-a.total);
  else if(khcSort==='kg') rows.sort((a,b)=>b.kgTotal-a.kgTotal);
  else if(khcSort==='name') rows.sort((a,b)=>a.name.localeCompare(b.name,'vi'));
  else rows.sort((a,b)=>(b.lastOrderAt||0)-(a.lastOrderAt||0)); // recent

  // Ưu tiên khách có đơn trễ hạn hoặc GẤP 1/2 lên đầu danh sách, dù chọn sort gì
  rows.sort((a,b)=> (b.overdue>0?1:0)-(a.overdue>0?1:0) || (a.bestRank||99)-(b.bestRank||99) || 0);

  const allRows = khcBuildStats();
  const totalCustomers = allRows.length;
  const totalOrders = allRows.reduce((s,r)=>s+r.total,0);
  const totalDone = allRows.reduce((s,r)=>s+r.done,0);
  const totalActive = allRows.reduce((s,r)=>s+r.running+r.pending,0);
  const totalOverdueCust = allRows.filter(r=>r.overdue>0).length;
  const overallPct = totalOrders ? Math.round(totalDone/totalOrders*100) : 0;

  const filterChips = [
    {key:'all', label:'Tất cả', n:allRows.length},
    {key:'active', label:'Đang có đơn chạy', n:allRows.filter(r=>r.running+r.pending>0).length},
    {key:'overdue', label:'Có đơn trễ hạn', n:totalOverdueCust},
    {key:'done', label:'Đã hoàn tất hết', n:allRows.filter(r=>r.notDone===0).length},
  ];

  const cardsHTML = rows.length ? rows.map(r=>{
    const pc = PRI_COLOR[r.bestPriority] || '#64748B';
    const isExp = khcExpanded.has(r.name);
    const initials = userInitials(r.name);
    return `
    <div class="khc-card${r.overdue>0?' khc-card-overdue':''}">
      <div class="khc-card-top" onclick="khcToggleExpand('${r.name.replace(/'/g,"\\'")}')">
        <div class="khc-avatar">${esc(initials)}</div>
        <div class="khc-card-main">
          <div class="khc-card-name">${esc(r.name)}${r.bestPriority?`<span class="khc-pri-badge" style="background:${pc}22;color:${pc};border-color:${pc}77">🚩 ${r.bestPriority}</span>`:''}</div>
          <div class="khc-card-sub">${r.total} đơn · Đơn gần nhất ${r.lastOrderAt?fmtDate(r.lastOrderAt):'—'}${r.nextDelivery?` · Giao gần nhất ${fmtDate(r.nextDelivery)}`:''}</div>
        </div>
        <div class="khc-card-pct"><div class="khc-card-pct-num">${r.pct}%</div><div class="khc-card-pct-lbl">hoàn thành</div></div>
        <svg class="khc-chevron${isExp?' open':''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="khc-progress"><div class="khc-progress-fill" style="width:${r.pct}%"></div></div>
      <div class="khc-stats-row">
        <span class="khc-stat khc-stat-done">✅ ${r.done} xong</span>
        <span class="khc-stat khc-stat-run">⚙️ ${r.running} đang chạy</span>
        <span class="khc-stat khc-stat-wait">⏳ ${r.pending} chờ SX</span>
        ${r.overdue?`<span class="khc-stat khc-stat-overdue">⚠️ ${r.overdue} trễ hạn</span>`:''}
        <span class="khc-stat khc-stat-kg">⚖️ ${r.kgTotal.toFixed(1)}kg (${r.kgDone.toFixed(1)}kg đã giao)</span>
      </div>
      ${isExp?`<div class="khc-order-list">
        ${r.orders.map((o,idx)=>{
          const si = statusInfo(o.status);
          const opc = PRI_COLOR[o.priority] || '#64748B';
          const isDone = rptStatusOf(o)==='done';
          // Chèn dải phân cách ngay trước đơn ĐÃ XONG đầu tiên trong danh
          // sách (đơn chưa xong đã được sắp lên trên từ khcBuildStats),
          // giúp mắt nhận ra ngay ranh giới "việc cần làm" vs "đã xong".
          const prevDone = idx>0 ? rptStatusOf(r.orders[idx-1])==='done' : false;
          const divider = (isDone && !prevDone) ? `<div class="khc-order-divider">✅ Đã hoàn thành</div>` : '';
          return `${divider}<div class="khc-order-row${isDone?' khc-order-row-done':''}" onclick="event.stopPropagation();ddViewDetail('${o.id}')">
            <span class="khc-order-spec">${esc(specStr(o))}</span>
            ${o.type?`<span class="khc-order-type">${esc(o.type)}</span>`:''}
            <span class="khc-order-mat">${esc(ddMaterialLabel(o.material))}</span>
            <span class="khc-order-qty">${esc(qtyLabel(o))}</span>
            <span class="khc-order-badge ${si.cls}">${si.label}</span>
            ${o.priority?`<span class="khc-order-pri" style="color:${opc}">🚩 ${o.priority}</span>`:''}
            <span class="khc-order-kg">${(parseFloat(o.kg)||0).toFixed(1)}kg</span>
            <span class="khc-order-date">${o.deliveryDate?('Giao '+fmtDate(o.deliveryDate)):''}</span>
          </div>`;
        }).join('')}
      </div>`:''}
    </div>`;
  }).join('') : `<div class="empty" style="padding:36px 0"><div class="empty-icon">🔍</div>${khcSearchQ?`Không tìm thấy khách hàng "${esc(khcSearchQ)}"`:'Chưa có khách hàng nào có đơn trong hệ thống'}</div>`;

  $('mc').innerHTML = `
    <div class="dd-page-head">
      <div>
        <div class="dd-page-title">🧑‍🤝‍🧑 Khách hàng</div>
        <div class="dd-page-sub">Theo dõi tình trạng từng khách hàng — cập nhật trực tiếp từ tab Đơn hàng · Admin & Nhân viên SX xem được</div>
      </div>
    </div>

    <div class="rpt-grid rpt-grid-4col">
      <div class="rpt-item"><div class="rpt-num">${totalCustomers}</div><div class="rpt-lbl">Khách hàng</div></div>
      <div class="rpt-item"><div class="rpt-num">${totalOrders}</div><div class="rpt-lbl">Tổng đơn</div></div>
      <div class="rpt-item"><div class="rpt-num">${totalActive}</div><div class="rpt-lbl">Đơn chưa xong</div></div>
      <div class="rpt-item"><div class="rpt-num" style="color:${totalOverdueCust?'var(--red-m)':'inherit'}">${totalOverdueCust}</div><div class="rpt-lbl">Khách có đơn trễ</div></div>
    </div>

    <div class="card" style="padding:14px;margin-top:10px">
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:6px"><span>Tỉ lệ hoàn thành chung</span><span style="color:var(--green-m)">${overallPct}%</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${overallPct}%"></div></div>
    </div>

    <div class="search-wrap" style="margin:12px 0 8px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input class="search-inp" type="search" placeholder="🔍 Tìm theo tên khách hàng..." value="${esc(khcSearchQ)}" oninput="khcSearch(this.value)" autocomplete="off">
    </div>

    <div class="khc-chip-row">
      ${filterChips.map(c=>`<button class="khc-chip${khcFilter===c.key?' active':''}" onclick="khcSetFilter('${c.key}')">${c.label} <b>${c.n}</b></button>`).join('')}
      <select class="khc-sort-select" onchange="khcSetSort(this.value)">
        <option value="recent" ${khcSort==='recent'?'selected':''}>Mới nhất</option>
        <option value="orders" ${khcSort==='orders'?'selected':''}>Nhiều đơn nhất</option>
        <option value="kg" ${khcSort==='kg'?'selected':''}>Sản lượng cao nhất</option>
        <option value="name" ${khcSort==='name'?'selected':''}>Tên A-Z</option>
      </select>
    </div>

    <div class="khc-grid">${cardsHTML}</div>
  `;
}
