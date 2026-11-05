// src/modules/qr/qr-public-khuon.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// TRANG CÔNG KHAI: TỔNG HỢP KHUÔN
// Khách hàng và bất kỳ ai quét mã QR dán tại xưởng khuôn / kho khuôn sẽ
// mở thẳng trang này bằng camera điện thoại thường — không cần cài app,
// không cần đăng nhập — xem trực tiếp danh mục kích thước khuôn và số
// lượng khuôn tồn kho, đọc dữ liệu trực tiếp từ Firebase RTDB.
// ════════════════════════════════════════════════════════════
let _pubKh = { catalog:[], search:'', catFilter:'all', dbUrl:'' };
let _pubKhPollTimer = null;

// Tải dữ liệu khuôn (chỉ Danh mục kích thước) từ Firebase RTDB công khai.
// Theo yêu cầu, trang công khai KHÔNG còn hiển thị Số lượng/tồn kho khuôn —
// chỉ tải & hiển thị mục Tổng hợp Khuôn (danh mục kích thước).
async function pubKhFetchData(dbUrl){
  let catalog=[], errMsg=null;
  try{
    const rc = await fetch(await fbAppendAuth(dbUrl + '/data/khuonCatalog.json?print=pretty'), {cache:'no-store'});
    if(!rc.ok){
      errMsg = (rc.status===401||rc.status===403)
        ? `⚠️ Không kết nối được tới máy chủ dữ liệu (mã lỗi HTTP ${rc.status}).<br>Có thể quy tắc bảo mật (Rules) của Firebase đang chặn truy cập công khai.`
        : `⚠️ Không kết nối được tới máy chủ dữ liệu.<br>Vui lòng thử lại sau ít phút hoặc liên hệ nhà máy.`;
    } else {
      const dc = await rc.json();
      catalog = Array.isArray(dc) ? dc.filter(Boolean) : Object.values(dc||{}).filter(Boolean);
    }
  }catch(e){
    errMsg = `⚠️ Không có kết nối mạng hoặc máy chủ dữ liệu không phản hồi.<br>Vui lòng kiểm tra lại Wi-Fi/4G rồi thử quét lại.`;
  }
  return {catalog, errMsg: errMsg||null};
}

async function renderPublicKhuon(){
  $('loginScreen').classList.remove('active');
  $('publicScanScreen').classList.add('active');
  const wrap = $('pubWrap');
  const params = new URLSearchParams(location.search);
  const dbUrl = (params.get('db') || fbUrl() || '').replace(/\/$/,'');

  if(!dbUrl){
    wrap.innerHTML = `<div class="pub-msg">⚠️ Không thể tải dữ liệu — liên kết thiếu thông tin kết nối.<br>Vui lòng liên hệ nhà máy để được hỗ trợ.</div>`;
    return;
  }

  const {catalog, errMsg} = await pubKhFetchData(dbUrl);
  if(errMsg){
    wrap.innerHTML = `<div class="pub-msg">${errMsg}</div>`;
    return;
  }

  _pubKh = { catalog, search:'', catFilter:'all', dbUrl };

  const catCount = [...new Set(catalog.map(x=>x.category))].length;

  wrap.innerHTML = `
    <div class="pub-header">
      <div class="pub-header-logo"><img src="${DP_LOGO_DATAURL}" alt="Logo Đông Phương" class="pub-header-logo-img"><span>CÔNG TY CP CÔNG THƯƠNG ĐÔNG PHƯƠNG</span></div>
      <div class="pub-header-title">🧩 KHO KHUÔN — Tổng hợp Khuôn</div>
      <div class="pub-header-code">Tra cứu công khai danh mục kích thước khuôn — chỉ xem, tìm kiếm, lọc — cập nhật trực tiếp từ hệ thống</div>
    </div>
    <div id="pubKhSyncStatus" class="pub-kh-sync ok">🟢 Đang đồng bộ dữ liệu</div>
    <div class="pub-kh-summary pub-kh-summary-2">
      <div class="pub-kh-sum-card"><div class="pub-kh-sum-n">${catalog.length}</div><div class="pub-kh-sum-lbl">Kích thước</div></div>
      <div class="pub-kh-sum-card"><div class="pub-kh-sum-n">${catCount}</div><div class="pub-kh-sum-lbl">Nhóm khuôn</div></div>
    </div>
    <div id="pubKhBody"></div>
    <div class="pub-kh-updated" id="pubKhUpdated">Cập nhật lúc ${fmtDateTime(Date.now())}</div>
    <div class="pub-footer">Trang tra cứu khuôn công khai — vui lòng liên hệ nhà máy nếu cần đặt thêm khuôn hoặc có sai lệch số liệu.<br>Liên hệ SĐT/Zalo: 0979698351</div>
  `;
  pubKhRenderBody();

  if(!_pubCcllvTracked.has('khuon')){
    _pubCcllvTracked.add('khuon');
    pubTrackScan('khuon');
  }

  // Realtime: tự động làm mới dữ liệu định kỳ để khi Admin thay đổi danh
  // mục khuôn, trang QR đang mở cũng tự cập nhật mà không cần quét lại.
  if(_pubKhPollTimer) clearInterval(_pubKhPollTimer);
  _pubKhPollTimer = setInterval(pubKhRefresh, 20000);
}

// Làm mới dữ liệu khuôn định kỳ (giữ nguyên Search/Filter đang chọn).
async function pubKhRefresh(){
  if(!_pubKh.dbUrl) return;
  const statusEl = $('pubKhSyncStatus');
  try{
    const {catalog, errMsg} = await pubKhFetchData(_pubKh.dbUrl);
    if(errMsg){
      if(statusEl){ statusEl.className='pub-kh-sync danger'; statusEl.textContent='🔴 Không thể cập nhật dữ liệu mới'; }
      return;
    }
    _pubKh.catalog = catalog;
    if(statusEl){ statusEl.className='pub-kh-sync ok'; statusEl.textContent='🟢 Đang đồng bộ dữ liệu'; }
    const upd = $('pubKhUpdated'); if(upd) upd.textContent = 'Cập nhật lúc ' + fmtDateTime(Date.now());
    const catCount = [...new Set(catalog.map(x=>x.category))].length;
    const nums = document.querySelectorAll('#pubWrap .pub-kh-summary .pub-kh-sum-n');
    if(nums.length===2){
      nums[0].textContent = catalog.length;
      nums[1].textContent = catCount;
    }
    pubKhRenderBody();
  }catch(e){
    if(statusEl){ statusEl.className='pub-kh-sync danger'; statusEl.textContent='🔴 Không thể cập nhật dữ liệu mới'; }
  }
}

function pubKhSetSearch(val){ _pubKh.search = val||''; pubKhRenderBody(); }
function pubKhSetCat(c){ _pubKh.catFilter = c; pubKhRenderBody(); }

function pubKhRenderBody(){
  const body = $('pubKhBody'); if(!body) return;
  const active = document.activeElement;
  const wasSearchFocused = active && active.classList && active.classList.contains('pub-kh-search');
  const caret = wasSearchFocused ? active.selectionStart : null;
  pubKhRenderCatalog(body);
  if(wasSearchFocused){
    const inp = body.querySelector('.pub-kh-search');
    if(inp){ inp.focus(); if(caret!=null) inp.setSelectionRange(caret, caret); }
  }
}



// Trang công khai: chỉ hiển thị mục Tổng hợp Khuôn (danh mục kích thước),
// KHÔNG còn hiển thị Số lượng/tồn kho khuôn theo yêu cầu.
function pubKhRenderCatalog(body){
  const { catalog } = _pubKh;
  const q = _pubKh.search;
  const cats = [...new Set(catalog.map(x=>x.category))].sort((a,b)=>a.localeCompare(b,'vi'));
  let list = catalog.filter(x=>
    (_pubKh.catFilter==='all' || x.category===_pubKh.catFilter) &&
    khuonMatchesSearch(x, q)
  );
  const groups = {};
  list.forEach(x=>{ (groups[x.category]=groups[x.category]||[]).push(x); });
  Object.keys(groups).forEach(g=>{ groups[g] = sortKhuonList(groups[g], 'size'); });
  const groupNames = Object.keys(groups).sort((a,b)=>a.localeCompare(b,'vi'));

  body.innerHTML = `
    <div class="pub-kh-toolbar">
      <input class="pub-kh-search" placeholder="🔎 Tìm kích thước, nhóm khuôn..." value="${pubEsc(_pubKh.search)}" oninput="pubKhSetSearch(this.value)">
      <div class="pub-kh-chips">
        <button class="pub-kh-chip ${_pubKh.catFilter==='all'?'active':''}" onclick="pubKhSetCat('all')">Tất cả (${catalog.length})</button>
        ${cats.map(c=>`<button class="pub-kh-chip ${_pubKh.catFilter===c?'active':''}" onclick="pubKhSetCat('${c.replace(/'/g,"\\'")}')">${pubEsc(c)} (${catalog.filter(x=>x.category===c).length})</button>`).join('')}
      </div>
    </div>
    ${groupNames.length===0 ? `<div class="pub-kh-empty">🗂️ Không tìm thấy kích thước khuôn nào phù hợp</div>` :
      groupNames.map(g=>`
        <div class="pub-kh-cat-title">${pubEsc(g)} <span class="pub-kh-cat-count">${groups[g].length} kích thước</span></div>
        <div class="pub-kh-grid">
          ${groups[g].map(it=>`<div class="pub-kh-chip-item">${pubEsc(it.size)}</div>`).join('')}
        </div>
      `).join('')
    }
  `;
}
