// src/components/GlobalHeader.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`    <div class="topbar">
      <button class="topbar-menu" onclick="toggleSB()">
        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <img id="topbarLogoImg" class="topbar-logo" src="" alt="logo">
      <!-- Mobile: một khối gọn trong CÙNG Global Header (không có header thứ hai). Hàng 1 = tên tab + nút chức năng; hàng 2 = ngày • giờ realtime. -->
      <div class="topbar-mh">
        <div class="topbar-mh-top">
          <div class="topbar-mh-title" id="pageTitleMobile">Tổng quan</div>
          <button type="button" class="topbar-mh-icon" onclick="topbarRefreshClick(this)" title="Làm mới dữ liệu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          </button>
          <span class="topbar-mh-sync" id="mhSyncDot" title="Trạng thái đồng bộ"></span>
          <button type="button" class="topbar-mh-icon" onclick="openNotifPanel()" title="Thông báo" aria-label="Thông báo" style="position:relative">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>
            <span class="topbar-bell-badge js-bell-badge">0</span>
          </button>
          <button type="button" class="topbar-mh-icon" id="mhAvatarBtn" onclick="toggleAccountDropdown(event)" title="Tài khoản" aria-label="Tài khoản">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>
          </button>
          <button type="button" class="topbar-mh-icon" id="topbarMhSearchBtn" onclick="tbMobileSearchToggle()" title="Tìm kiếm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </div>
        <div class="topbar-mh-row">
          <span class="topbar-mh-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span id="clockDateMobile">--/--/----</span>
          </span>
          <span class="topbar-mh-dot">•</span>
          <span class="topbar-mh-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
            <span id="clockTimeMobile">--:--:--</span>
          </span>
        </div>
        <div class="topbar-mh-searchrow" id="topbarMhSearchRow">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="tbGlobalSearchMobile" placeholder="🔍 Tìm mã đơn, khách hàng, &quot;gấp 1&quot;, &quot;kế hoạch&quot;..." oninput="tbGlobalSearchLive(this.value)" onkeydown="if(event.key==='Enter'){tbGlobalSearchGo(this.value);this.blur();}">
          <button type="button" class="topbar-mh-search-close" onclick="tbMobileSearchClose()" title="Đóng tìm kiếm">✕</button>
        </div>
      </div>
      <div class="topbar-title" id="pageTitle">Tổng quan</div>
      <div class="tb-search-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" class="tb-search-input" id="tbGlobalSearch" placeholder="🔍 Tìm & lọc thông minh: mã đơn, khách hàng, &quot;gấp 1&quot;, &quot;kế hoạch&quot;, &quot;đã giao&quot;..." title="Ô tìm kiếm chung cho mọi tab — tự nhận diện mức ưu tiên, trạng thái, khách hàng và tab cần xem ngay trong câu gõ vào. VD: &quot;Hoàng Gia gấp 2&quot;, &quot;kế hoạch chưa lên&quot;, &quot;đã giao tuần này&quot;" oninput="tbGlobalSearchLive(this.value)" onkeydown="if(event.key==='Enter'){tbGlobalSearchGo(this.value)}">
      </div>
      <button type="button" class="tb-filter-btn" id="tbFilterBtn" title="Bộ lọc chi tiết" onclick="tbFilterBtnClick(this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 4 21 4 14 13 14 19 10 21 10 13 3 4"/></svg></button>
      <div class="tb-toolgroup" id="clock" title="Giờ hệ thống">
        <div class="tb-datebox">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span class="tc-date" id="clockDate">--/--/----</span>
          <svg class="tb-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="tb-timebox">
          <span class="tc-live"></span>
          <span class="tc-time" id="clockTime">--:--:--</span>
        </div>
      </div>
      <div class="topbar-sync" id="syncDot" role="button" tabindex="0" onclick="topbarRefreshClick(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();topbarRefreshClick(this)}" title="Đồng bộ / làm mới dữ liệu — bấm để làm mới">
        <span class="sync-dot"></span>
        <span class="sync-text">
          <span class="sync-label" id="syncLabel">Đồng bộ</span>
          <span class="sync-time" id="syncTimeAgo">--</span>
        </span>
      </div>
      <button type="button" class="topbar-bell" id="bellBtn" onclick="openNotifPanel()" title="Trung tâm thông báo" aria-label="Thông báo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>
        <span class="topbar-bell-badge" id="bellBadge">0</span>
      </button>
      <button class="avatar-btn" id="avatarBtn" onclick="toggleAccountDropdown(event)" aria-haspopup="true" aria-expanded="false" title="Tài khoản của tôi">
        <span class="ab-photo"><img id="avatarBtnImg" src="" alt="avatar"><span class="ab-initials" id="abInitials">?</span></span><span class="ab-text"><span class="ab-name" id="abName">—</span><span class="ab-role" id="abRole">—</span></span><svg class="ab-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
      <div class="acc-dd" id="accDropdown"></div>
    </div>`);

let _lastSyncOkAt = null;
let _syncTickTimer = null;
function tickSyncAgo(){
  const t = $('syncTimeAgo');
  if(t) t.textContent = fmtSyncAgo(_lastSyncOkAt);
}
function setSyncDot(state){
  const d=$('syncDot'); if(!d) return;
  // 4 trạng thái: ok (Đồng bộ) · saving (Đang lưu) · error (Lỗi đồng bộ) · offline (Ngoại tuyến, mất mạng)
  const _cls = state==='error'?' error':state==='saving'?' offline':state==='offline'?' net-off':'';
  const _ttl = state==='ok'?'Đã đồng bộ':state==='saving'?'Đang lưu...':state==='offline'?'Ngoại tuyến — thay đổi chưa được xác nhận lưu lên máy chủ':'Lỗi đồng bộ';
  d.className='topbar-sync'+_cls;
  d.title = _ttl;
  const mh=$('mhSyncDot'); if(mh){ mh.className='topbar-mh-sync'+_cls; mh.title=_ttl; }
  const lbl = $('syncLabel');
  if(lbl) lbl.textContent = state==='ok'?'Đồng bộ':state==='saving'?'Đang lưu...':state==='offline'?'Ngoại tuyến':'Lỗi đồng bộ';
  if(state==='ok'){
    _lastSyncOkAt = Date.now();
    tickSyncAgo();
    if(!_syncTickTimer) _syncTickTimer = setInterval(tickSyncAgo, 1000);
  } else {
    const t = $('syncTimeAgo');
    if(t) t.textContent = state==='saving' ? 'Đang xử lý' : 'Kiểm tra mạng';
  }
}

// Nút "Làm mới" trên Global Header (chỉ hiện ở tab Tổng quan) — làm mới
// đúng dữ liệu của tab đang mở, tránh phải tự cuộn xuống tìm nút riêng.
function topbarRefreshClick(el){
  // Nút ĐỒNG BỘ duy nhất của Global Header (desktop: chỉ báo đồng bộ; mobile: nút ⟳). Chỉ đọc, không ghi Firebase.
  if(currentTab==='dashboard' && typeof renderDashboard==='function') renderDashboard();
  else if(typeof renderTab==='function'){ try{ renderTab(currentTab); }catch(e){ console.warn('[refresh]',e); } } // vẽ lại từ dữ liệu đã đồng bộ
  if(el && el.setAttribute){ el.setAttribute('data-spin','1'); clearTimeout(el._spinT); el._spinT=setTimeout(()=>el.removeAttribute('data-spin'),700); } // dùng attribute: setSyncDot() ghi đè className nên class sẽ bị mất
}

// ── Bộ lọc chi tiết hợp nhất ở Topbar (thay cho nút riêng từng tab) ──
// Xác định tab nào sẽ được áp bộ lọc khi bấm nút 🔽 (icon phễu lọc — trước
// đây là cờ lê 🔧 dễ khiến người dùng nhầm thành "Cài đặt hệ thống") cạnh ô
// tìm kiếm trung tâm: đúng tab đang mở nếu đó là 1 trong 3 tab có bộ lọc
// (Đơn hàng/Kế hoạch SX/Đơn hoàn thành), ngược lại mặc định về tab Đơn hàng
// — cùng logic với ô tìm kiếm nhanh tbGlobalSearchGo() để hành vi luôn nhất quán.
function tbFilterTab(){
  return (currentTab==='keHoach'||currentTab==='hoanThanh') ? currentTab : 'dorDang';
}
function tbFilterBtnClick(btn){
  usOpen(tbFilterTab(), btn);
}

// ── Icon "🔍 Tìm kiếm" trên Global Header mobile (≤640px): TRƯỚC ĐÂY bấm vào
// chỉ mở Bottom Sheet Bộ lọc (usOpen), không gõ tìm trực tiếp được vì ô chữ
// #tbGlobalSearch của Topbar Desktop bị ẩn hẳn trên mobile. NAY: bật/tắt 1
// hàng ô tìm kiếm chữ riêng ngay trong Global Header, dùng chung logic tìm
// kiếm thông minh (tbGlobalSearchLive/tbGlobalSearchGo) với ô Desktop.
function tbMobileSearchToggle(){
  const tb = document.querySelector('.topbar-mh');
  const btn = document.getElementById('topbarMhSearchBtn');
  if(!tb) return;
  const opening = !tb.classList.contains('mob-search-open');
  tb.classList.toggle('mob-search-open', opening);
  if(btn) btn.classList.toggle('active', opening);
  if(opening){
    setTimeout(()=>{
      const inp = document.getElementById('tbGlobalSearchMobile');
      if(inp) inp.focus();
    }, 60);
  }
}
function tbMobileSearchClose(){
  const tb = document.querySelector('.topbar-mh');
  const btn = document.getElementById('topbarMhSearchBtn');
  const inp = document.getElementById('tbGlobalSearchMobile');
  if(inp && inp.value){ inp.value=''; tbGlobalSearchGo(''); }
  if(inp) inp.blur();
  if(tb) tb.classList.remove('mob-search-open');
  if(btn) btn.classList.remove('active');
}
// Cập nhật huy hiệu số bộ lọc đang áp dụng trên nút 🔧 ở Topbar — gọi mỗi
// khi 1 trong 3 tab render lại (xem usBarHTML) để huy hiệu luôn đúng.
function tbUpdateFilterBtn(tab){
  const btn = document.getElementById('tbFilterBtn');
  if(!btn) return;
  const n = usActiveCount(tab);
  const old = btn.querySelector('.tb-filter-badge');
  if(old) old.remove();
  btn.classList.toggle('has-active', !!n);
  if(n){
    const b = document.createElement('span');
    b.className = 'tb-filter-badge';
    b.textContent = n;
    btn.appendChild(b);
  }
}

// live=true → đang gõ trực tiếp (gọi từ tbGlobalSearchLive, có debounce) —
// chỉ vẽ lại bảng nếu KHÔNG cần đổi tab, để không giật/cuộn màn hình mỗi lần
// gõ 1 ký tự. live=false (mặc định, khi bấm Enter) → giữ hành vi cũ, luôn
// goTab() kể cả khi ở đúng tab hiện tại.
function tbGlobalSearchGo(raw, opts){
  const live = !!(opts && opts.live);
  raw = (raw||'').trim();

  if(!raw){
    // TRƯỚC ĐÂY: gõ trực tiếp mà xoá hết ô tìm kiếm không làm gì cả (return
    // sớm), khiến kết quả lọc/tìm kiếm CŨ vẫn còn nguyên trên màn hình dù ô
    // tìm kiếm đã trống — trông như "tìm kiếm bị treo/không chịu tìm lại".
    // NAY: xoá sạch mọi bộ lọc nhanh đã áp (kể cả suy ra từ câu tìm trước
    // đó) và vẽ lại đúng tab đang xem, không nhảy/cuộn màn hình.
    const tab0 = (currentTab==='keHoach'||currentTab==='hoanThanh') ? currentTab : 'dorDang';
    searchQ=''; filterStatus='all'; ddRecvFrom=''; ddPriorityFilter='all'; ddCustomerFilter='all'; ddSpecFilter='all';
    khSearchQ=''; khFilterStatus='all'; khFilterCustomer='all'; khFilterPriority='all'; khFilterSpec='all';
    khFilterStage='all'; khFilterOwner='all'; khCreatedFrom=''; khCreatedTo=''; khDueFrom=''; khDueTo='';
    htSearchQ=''; htFilterStatus='all'; htDoneFrom=''; htDoneTo=''; htCustomerFilter='all'; htFilterPriority='all'; htFilterSpec='all';
    if(tab0==='dorDang' && typeof renderDorDang==='function') renderDorDang();
    else if(tab0==='keHoach' && typeof renderKeHoach==='function') renderKeHoach();
    else if(tab0==='hoanThanh' && typeof renderHoanThanh==='function') renderHoanThanh();
    return;
  }

  const rawTokens = raw.split(/\s+/);
  const nTokens = rawTokens.map(_smartTokenNorm);
  const used = new Array(rawTokens.length).fill(false);

  // 1) Nhận diện tab đích — mặc định GIỮ NGUYÊN tab đang mở (trước đây luôn
  // mặc định nhảy về "Đơn hàng" khiến gõ tìm ở tab Kế hoạch SX / Hoàn thành
  // bị nhảy sai tab). Chỉ đổi sang tab khác khi người dùng gõ rõ từ khoá
  // tên tab đó ("kế hoạch", "đã giao", "hoàn thành"...) trong câu tìm.
  let tab = (currentTab==='keHoach'||currentTab==='hoanThanh') ? currentTab : 'dorDang';
  if(_smartFindPhrase(nTokens, used, [['ke','hoach']])) tab = 'keHoach';
  else if(_smartFindPhrase(nTokens, used, [['hoan','thanh'],['da','giao'],['nhap','kho'],['hoan','tra'],['cho','giao']])) tab = 'hoanThanh';

  // 2) Nhận diện mức ưu tiên "gấp N" (N = 1..8)
  let priority = null;
  for(let i=0;i<nTokens.length;i++){
    if(used[i]) continue;
    const mLien = nTokens[i].match(/^gap([1-8])$/);
    if(mLien){ priority = 'GẤP '+mLien[1]; used[i]=true; break; }
    if(nTokens[i]==='gap' && i+1<nTokens.length && !used[i+1] && /^[1-8]$/.test(nTokens[i+1])){
      priority = 'GẤP '+nTokens[i+1]; used[i]=true; used[i+1]=true; break;
    }
  }

  // 3) Nhận diện trạng thái đơn — riêng theo từng tab đích
  const statusMapByTab = {
    dorDang: [[['chua','len','ke','hoach'],'unplanned'],[['chua','lap','ke','hoach'],'unplanned'],
      [['da','len','ke','hoach'],'planned'],[['da','lap','ke','hoach'],'planned'],
      [['dang','san','xuat'],'producing'],[['dang','cat'],'producing']],
    hoanThanh: [[['cho','nhap','kho'],'new'],[['da','nhap','kho'],'shipping'],[['cho','giao'],'shipping'],
      [['da','giao'],'delivered'],[['hoan','tra'],'returned']],
    keHoach: [[['dang','cho'],'pending'],[['dang','chay'],'running'],[['qua','han'],'overdue'],[['uu','tien'],'priority']]
  };
  let status = null;
  for(const [phrase, key] of (statusMapByTab[tab]||[])){
    if(_smartFindPhrase(nTokens, used, [phrase])){ status = key; break; }
  }

  // 4) Nhận diện tên khách hàng — so với danh sách khách đã có đơn, ưu tiên
  // tên khớp nhiều từ nhất trước (tránh nhận nhầm "Hoàng Gia" khi thực ra
  // câu gõ là "Hoàng Gia Phát").
  let customer = null;
  const custCandidates = [...new Set((DB.orders||[]).map(o=>o.customer).filter(Boolean))]
    .map(c=>({name:c, tokens:_smartTokenNorm(c).split(/\s+/).filter(Boolean)}))
    .filter(c=>c.tokens.length)
    .sort((a,b)=>b.tokens.length-a.tokens.length);
  for(const c of custCandidates){
    if(_smartFindPhrase(nTokens, used, [c.tokens])){ customer = c.name; break; }
  }

  // 5) Phần chữ còn lại (chưa được nhận diện ở trên) → từ khoá tìm kiếm tự do
  const leftover = rawTokens.filter((_,i)=>!used[i]).join(' ').trim();

  // Reset toàn bộ bộ lọc của cả 3 tab trước khi áp bộ lọc mới nhận diện được,
  // để không bị lẫn với lần lọc thủ công trước đó (dùng lại nguyên các biến/
  // hàm lọc searchQ/khSearchQ/htSearchQ... đã có sẵn của từng tab).
  searchQ=''; filterStatus='all'; ddRecvFrom=''; ddPriorityFilter='all'; ddCustomerFilter='all'; ddSpecFilter='all';
  khSearchQ=''; khFilterStatus='all'; khFilterCustomer='all'; khFilterPriority='all'; khFilterSpec='all';
  khFilterStage='all'; khFilterOwner='all'; khCreatedFrom=''; khCreatedTo=''; khDueFrom=''; khDueTo='';
  htSearchQ=''; htFilterStatus='all'; htDoneFrom=''; htDoneTo=''; htCustomerFilter='all'; htFilterPriority='all'; htFilterSpec='all';

  if(tab==='dorDang'){
    filterStatus = status || 'all';
    ddPriorityFilter = priority || 'all';
    ddCustomerFilter = customer || 'all';
    searchQ = leftover;
  } else if(tab==='keHoach'){
    khFilterStatus = status || 'all';
    khFilterPriority = priority || 'all';
    khFilterCustomer = customer || 'all';
    khSearchQ = leftover;
  } else {
    htFilterStatus = status || 'all';
    htCustomerFilter = customer || 'all';
    htSearchQ = leftover;
  }

  const renderThis = ()=>{
    if(tab==='dorDang' && typeof renderDorDang==='function') renderDorDang();
    else if(tab==='keHoach' && typeof renderKeHoach==='function') renderKeHoach();
    else if(tab==='hoanThanh' && typeof renderHoanThanh==='function') renderHoanThanh();
  };

  if(live && tab===currentTab){
    // Đang gõ trực tiếp, không cần đổi tab → chỉ vẽ lại bảng đang xem, KHÔNG
    // gọi goTab() (tránh cuộn màn hình về đầu trang/đóng menu mỗi lần gõ).
    renderThis();
  } else {
    goTab(tab);
    setTimeout(renderThis, 0);
  }
}

// Gọi khi người dùng ĐANG GÕ trong ô tìm kiếm Topbar (oninput) — có debounce
// 300ms để không lọc lại danh sách sau từng phím gõ, mượt hơn khi dữ liệu
// lớn. TRƯỚC ĐÂY ô này chỉ tìm khi bấm Enter, nên gõ xong quên bấm Enter (rất
// dễ xảy ra, nhất là trên điện thoại) sẽ trông như "tìm kiếm không hoạt động"
// / "tìm ra tất cả" vì danh sách vẫn hiển thị y như trước khi gõ.
const _tbGlobalSearchLiveDebounced = debounce(v=>tbGlobalSearchGo(v, {live:true}), 300);
function tbGlobalSearchLive(v){
  _tbGlobalSearchLiveDebounced(v);
}
