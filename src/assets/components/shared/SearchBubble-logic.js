// src/components/shared/SearchBubble-logic.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


let _usOpenTab = null;

// Đếm số bộ lọc (không tính từ khóa) đang áp dụng — hiện số trên nút Bộ lọc
function usActiveCount(tab){
  if(tab==='dorDang') return [filterStatus!=='all', !!ddRecvFrom, ddPriorityFilter!=='all', ddCustomerFilter!=='all', ddSpecFilter!=='all'].filter(Boolean).length;
  if(tab==='keHoach') return [khFilterStatus!=='all', khFilterCustomer!=='all', khFilterPriority!=='all', khFilterSpec!=='all', khFilterStage!=='all', khFilterOwner!=='all', !!(khCreatedFrom||khCreatedTo), !!(khDueFrom||khDueTo)].filter(Boolean).length;
  if(tab==='hoanThanh') return [htFilterStatus!=='all', htCustomerFilter!=='all', htFilterPriority!=='all', htFilterSpec!=='all', !!(htDoneFrom||htDoneTo)].filter(Boolean).length;
  return 0;
}

// Thanh tìm kiếm gọn (Search Bubble) — nút "Bộ lọc chi tiết" riêng của từng
// tab đã được BỎ (chuyển lên 1 nút 🔧 duy nhất cạnh ô tìm kiếm trung tâm ở
// Topbar, xem tbFilterBtnClick()/tbUpdateFilterBtn()); ở đây chỉ còn hiện
// chip từ khoá đang lọc (nếu có) để người dùng biết & xoá nhanh.
function usBarHTML(tab, searchVal, searchId, placeholder){
  // Đồng bộ huy hiệu số bộ lọc đang áp dụng trên nút 🔧 ở Topbar mỗi khi tab
  // này render lại.
  tbUpdateFilterBtn(tab);
  // Ô tìm kiếm riêng của từng tab đã được BỎ — ô tìm kiếm nhanh dùng chung
  // ở giữa Topbar (#tbGlobalSearch) đã tìm được trên MỌI tab, kèm bộ lọc
  // thông minh (tự nhận diện mức ưu tiên "gấp 1..8", trạng thái, khách
  // hàng, tên tab...) ngay trong chính ô đó — xem hàm tbSmartSearchGo().
  // Vẫn giữ input ẩn (hidden) để các hàm cũ (usAttachSearchInput/usClearSearch/
  // clearSearch...) đọc-ghi giá trị searchQ/khSearchQ/htSearchQ không bị lỗi.
  const kw = (searchVal||'').replace(/"/g,'&quot;');
  if(!searchVal) return `<input class="search-inp" id="${searchId}" type="hidden" value="${kw}">`;
  return `
  <div class="us-bar">
    <input class="search-inp" id="${searchId}" type="hidden" value="${kw}">
    <span class="us-active-kw" title="Đang lọc theo từ khóa từ ô tìm kiếm nhanh">🔎 “${kw}”<button onclick="usClearSearch('${tab}')" title="Xóa từ khóa">✕</button></span>
  </div>`;
}

function usClearSearch(tab){
  if(tab==='dorDang'){ searchQ=''; renderDorDang(); }
  else if(tab==='keHoach'){ khSearchQ=''; renderKeHoach(); }
  else if(tab==='hoanThanh'){ htSearchQ=''; htMobPage=1; renderHoanThanh(); }
}

// Gắn debounce (300ms) cho ô tìm kiếm: gõ mượt, nhưng chỉ lọc lại danh sách
// sau khi ngừng gõ — tăng hiệu năng rõ rệt khi dữ liệu lớn.
function usAttachSearchInput(inputEl, setter, renderFn, hadFocus, caretPos){
  if(!inputEl) return;
  const debouncedRender = debounce(()=>{ renderFn(); }, 300);
  inputEl.addEventListener('input', function(){ setter(this.value); debouncedRender(); });
  if(hadFocus){
    inputEl.focus();
    const pos = caretPos!==null ? Math.min(caretPos, inputEl.value.length) : inputEl.value.length;
    try{ inputEl.setSelectionRange(pos, pos); }catch(e){}
  }
}

// Nội dung bên trong Bottom Sheet/Floating Panel — mỗi tab có bộ trường khác
// nhau (dùng lại NGUYÊN onchange/biến đã có), chỉ đổi vị trí hiển thị.
function usSheetBody(tab){
  if(tab==='dorDang'){
    const allActive = DB.orders.filter(o=>o.status!=='done');
    const customers = [...new Set(allActive.map(o=>o.customer).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
    const specs = [...new Set(allActive.map(o=>specStr(o)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
    return `
      <div class="dd-fld"><label>Trạng thái</label>
        <select onchange="filterStatus=this.value;renderDorDang()">
          <option value="all">Tất cả</option>
          <option value="unplanned" ${filterStatus==='unplanned'?'selected':''}>Chưa lập kế hoạch</option>
          <option value="planned" ${filterStatus==='planned'?'selected':''}>Đã lập kế hoạch</option>
          <option value="producing" ${filterStatus==='producing'?'selected':''}>Đang sản xuất</option>
        </select>
      </div>
      <div class="dd-fld"><label>Ưu tiên</label>
        <select onchange="ddPriorityFilter=this.value;renderDorDang()">
          <option value="all">Tất cả</option>
          ${Object.keys(PRI_COLOR).map(p=>`<option value="${p}" ${ddPriorityFilter===p?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="dd-fld"><label>Khách hàng</label>
        <select onchange="ddCustomerFilter=this.value;renderDorDang()">
          <option value="all">Tất cả</option>
          ${customers.map(c=>`<option value="${c.replace(/"/g,'&quot;')}" ${ddCustomerFilter===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="dd-fld"><label>Quy cách</label>
        <select onchange="ddSpecFilter=this.value;renderDorDang()">
          <option value="all">Tất cả</option>
          ${specs.map(s=>`<option value="${s.replace(/"/g,'&quot;')}" ${ddSpecFilter===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="dd-fld"><label>Ngày đặt từ</label><input type="date" value="${ddRecvFrom}" onchange="ddRecvFrom=this.value;renderDorDang()"></div>`;
  }
  if(tab==='keHoach'){
    const allActive = DB.orders.filter(o=>o.status!=='done');
    const owners = [...new Set(allActive.map(o=>o.createdBy).filter(Boolean))].map(uid=>(DB.users||[]).find(u=>u.id===uid)).filter(Boolean);
    const customers = [...new Set(allActive.map(o=>o.customer).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
    const specs = [...new Set(allActive.map(o=>specStr(o)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
    return `
      <div class="dd-fld"><label>Khách hàng</label>
        <select onchange="khFilterCustomer=this.value;renderKeHoach()">
          <option value="all">Tất cả</option>
          ${customers.map(c=>`<option value="${c.replace(/"/g,'&quot;')}" ${khFilterCustomer===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="dd-fld"><label>Mức ưu tiên</label>
        <select onchange="khFilterPriority=this.value;renderKeHoach()">
          <option value="all">Tất cả</option>
          ${Object.keys(PRI_COLOR).map(p=>`<option value="${p}" ${khFilterPriority===p?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="dd-fld"><label>Quy cách</label>
        <select onchange="khFilterSpec=this.value;renderKeHoach()">
          <option value="all">Tất cả</option>
          ${specs.map(s=>`<option value="${s.replace(/"/g,'&quot;')}" ${khFilterSpec===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="dd-fld"><label>Công đoạn</label>
        <select onchange="khFilterStage=this.value;renderKeHoach()">
          <option value="all">Tất cả</option>
          ${STAGES.map(s=>`<option value="${s.key}" ${khFilterStage===s.key?'selected':''}>${s.label}</option>`).join('')}
        </select>
      </div>
      <div class="dd-fld"><label>Người phụ trách</label>
        <select onchange="khFilterOwner=this.value;renderKeHoach()">
          <option value="all">Tất cả</option>
          ${owners.map(u=>`<option value="${u.id}" ${khFilterOwner===u.id?'selected':''}>${u.name}</option>`).join('')}
        </select>
      </div>
      <div class="us-sheet-grid">
        <div class="dd-fld"><label>Ngày tạo từ</label><input type="date" value="${khCreatedFrom}" onchange="khCreatedFrom=this.value;renderKeHoach()"></div>
        <div class="dd-fld"><label>Ngày tạo đến</label><input type="date" value="${khCreatedTo}" onchange="khCreatedTo=this.value;renderKeHoach()"></div>
        <div class="dd-fld"><label>Hạn giao từ</label><input type="date" value="${khDueFrom}" onchange="khDueFrom=this.value;renderKeHoach()"></div>
        <div class="dd-fld"><label>Hạn giao đến</label><input type="date" value="${khDueTo}" onchange="khDueTo=this.value;renderKeHoach()"></div>
      </div>`;
  }
  if(tab==='hoanThanh'){
    const allDone = DB.orders.filter(o=>o.status==='done');
    const customers = [...new Set(allDone.map(o=>o.customer).filter(Boolean))].sort();
    const specs = [...new Set(allDone.map(o=>specStr(o)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
    return `
      <div class="dd-fld"><label>Trạng thái</label>
        <select onchange="htFilterStatus=this.value;renderHoanThanh()">
          <option value="all" ${htFilterStatus==='all'?'selected':''}>Tất cả</option>
          <option value="new" ${htFilterStatus==='new'?'selected':''}>Chờ nhập kho</option>
          <option value="shipping" ${htFilterStatus==='shipping'?'selected':''}>Đã nhập kho / Chờ giao</option>
          <option value="delivered" ${htFilterStatus==='delivered'?'selected':''}>Đã giao</option>
          <option value="returned" ${htFilterStatus==='returned'?'selected':''}>Hoàn trả</option>
        </select>
      </div>
      <div class="dd-fld"><label>Khách hàng</label>
        <select onchange="htCustomerFilter=this.value;renderHoanThanh()">
          <option value="all">Tất cả</option>
          ${customers.map(c=>`<option value="${c}" ${htCustomerFilter===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="dd-fld"><label>Ưu tiên</label>
        <select onchange="htFilterPriority=this.value;renderHoanThanh()">
          <option value="all">Tất cả</option>
          ${Object.keys(PRI_COLOR).map(p=>`<option value="${p}" ${htFilterPriority===p?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="dd-fld"><label>Quy cách</label>
        <select onchange="htFilterSpec=this.value;renderHoanThanh()">
          <option value="all">Tất cả</option>
          ${specs.map(s=>`<option value="${s.replace(/"/g,'&quot;')}" ${htFilterSpec===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="us-sheet-grid">
        <div class="dd-fld"><label>Hoàn thành từ</label><input type="date" value="${htDoneFrom}" onchange="htDoneFrom=this.value;renderHoanThanh()"></div>
        <div class="dd-fld"><label>Hoàn thành đến</label><input type="date" value="${htDoneTo}" onchange="htDoneTo=this.value;renderHoanThanh()"></div>
      </div>`;
  }
  return '';
}

function usTitle(tab){
  return tab==='dorDang' ? '🔍 Bộ lọc — Đơn hàng' : tab==='keHoach' ? '🔍 Bộ lọc — Kế hoạch sản xuất' : '🔍 Bộ lọc — Đơn hoàn thành';
}

function usResetCurrent(){
  if(_usOpenTab==='dorDang') ddResetFilters();
  else if(_usOpenTab==='keHoach') khResetFilters();
  else if(_usOpenTab==='hoanThanh') htResetFilters();
  if(_usOpenTab){ $('usSheetBody').innerHTML = usSheetBody(_usOpenTab); }
}

// Tự khôi phục khung Bottom Sheet/Floating Panel nếu vì lý do gì đó các thẻ
// #usOverlay/#usSheet bị thiếu trong DOM (an toàn tuyệt đối, tránh trường hợp
// bấm nút Bộ lọc mà không có phản hồi gì trên một số trình duyệt/thiết bị).
function usEnsureDom(){
  let overlay = document.getElementById('usOverlay');
  let sheet = document.getElementById('usSheet');
  if(overlay && sheet) return {overlay, sheet};
  if(!overlay){
    overlay = document.createElement('div');
    overlay.className = 'us-overlay';
    overlay.id = 'usOverlay';
    overlay.onclick = usClose;
    document.body.appendChild(overlay);
  }
  if(!sheet){
    sheet = document.createElement('div');
    sheet.className = 'us-sheet';
    sheet.id = 'usSheet';
    sheet.innerHTML = `
      <div class="us-sheet-handle"></div>
      <div class="us-sheet-header">
        <b id="usSheetTitle">Bộ lọc</b>
        <button class="us-sheet-close" onclick="usClose()">✕</button>
      </div>
      <div class="us-sheet-body" id="usSheetBody"></div>
      <div class="us-sheet-footer">
        <button class="dd-reset-btn" onclick="usResetCurrent()">↺ Đặt lại</button>
        <button class="us-sheet-apply" onclick="usClose()">Áp dụng</button>
      </div>`;
    document.body.appendChild(sheet);
  }
  return {overlay, sheet};
}
function usOpen(tab, btn){
  try{
    _usOpenTab = tab;
    const {overlay, sheet} = usEnsureDom();
    const titleEl = document.getElementById('usSheetTitle');
    const bodyEl = document.getElementById('usSheetBody');
    if(titleEl) titleEl.textContent = usTitle(tab);
    if(bodyEl) bodyEl.innerHTML = usSheetBody(tab);
    overlay.classList.add('show');
    // requestAnimationFrame đảm bảo trình duyệt đã ghi nhận trạng thái ban đầu
    // (visibility:hidden + transform) trước khi thêm .show, để transition
    // trượt lên luôn chạy mượt mà thay vì nhảy đột ngột hoặc không hiển thị.
    requestAnimationFrame(()=>sheet.classList.add('show'));
    usPositionDesktop(btn);
    document.body.style.overflow='hidden';
  }catch(err){
    console.error('usOpen lỗi:', err);
  }
}
function usClose(){
  try{
    _usOpenTab = null;
    const overlay = document.getElementById('usOverlay');
    const sheet = document.getElementById('usSheet');
    if(overlay) overlay.classList.remove('show');
    if(sheet) sheet.classList.remove('show');
    document.body.style.overflow='';
  }catch(err){
    console.error('usClose lỗi:', err);
  }
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && _usOpenTab) usClose(); });
// Định vị Floating Panel ngay dưới nút Bộ lọc trên Desktop (>=900px); trên
// Mobile dùng CSS cố định dạng Bottom Sheet nên không cần tính vị trí.
function usPositionDesktop(btn){
  const sheet = $('usSheet');
  if(!sheet || window.innerWidth<900 || !btn) return;
  const r = btn.getBoundingClientRect();
  const w = sheet.offsetWidth || 400;
  let left = r.right - w;
  left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
  sheet.style.left = left+'px';
  sheet.style.right = 'auto';
  sheet.style.top = (r.bottom + 8)+'px';
}
