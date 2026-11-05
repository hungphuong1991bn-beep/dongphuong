// src/modules/molds/molds-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────

// Phân tích chuỗi kích thước khuôn -> {isRound, a, b, valid}.
// Với "A x B": a = chiều dày, b = chiều rộng. Khuôn tròn (Φ/φ/fi): a = đường kính.
// Hỗ trợ: 2x8, 2X8, 2×8, 2 x 8, 2x8.0, 2x7,5, fi9,8, Φ20...
function parseKhuonSize(raw){
  const s = String(raw==null?'':raw).trim();
  if(!s) return {isRound:false, a:null, b:null, valid:false, raw:s};
  const norm = s.replace(/(\d),(\d)/g,'$1.$2').replace(/×/g,'x');
  const roundMatch = norm.match(/(?:Φ|φ|fi)\s*([\d]+(?:\.[\d]+)?)/i);
  if(roundMatch){
    const d = parseFloat(roundMatch[1]);
    return {isRound:true, a:d, b:0, valid:!isNaN(d), raw:s};
  }
  const nums = norm.match(/\d+(?:\.\d+)?/g);
  if(!nums || !nums.length) return {isRound:false, a:null, b:null, valid:false, raw:s};
  const a = parseFloat(nums[0]);
  const b = nums.length>1 ? parseFloat(nums[1]) : 0;
  return {isRound:false, a, b, valid:!isNaN(a), raw:s};
}
// Sắp xếp danh sách khuôn theo kích thước tăng dần: chiều dày tăng dần →
// cùng chiều dày thì chiều rộng tăng dần. Bản ghi không đọc được kích thước
// hợp lệ bị đẩy xuống cuối (so sánh theo chuỗi gốc để không mất dữ liệu).
function sortKhuonList(list, sizeKey){
  sizeKey = sizeKey || 'size';
  return (list||[]).slice().sort((x,y)=>{
    const px = parseKhuonSize(x[sizeKey]);
    const py = parseKhuonSize(y[sizeKey]);
    if(!px.valid && !py.valid) return String(x[sizeKey]||'').localeCompare(String(y[sizeKey]||''),'vi');
    if(!px.valid) return 1;
    if(!py.valid) return -1;
    if(px.isRound !== py.isRound) return px.isRound ? 1 : -1;
    if(px.a !== py.a) return px.a - py.a;
    return (px.b||0) - (py.b||0);
  });
}
// Chuẩn hóa chuỗi tìm kiếm: bỏ dấu tiếng Việt, thường hóa, chuẩn hóa x/X/×
// thành "x" (bỏ khoảng trắng quanh x), dấu phẩy thập phân -> dấu chấm, bỏ
// khoảng trắng thừa. Dùng chung cho cả từ khóa tìm và dữ liệu so khớp.
function normalizeKhuonSearch(str){
  let s = _khStripAccents(String(str||'')).toLowerCase();
  s = s.replace(/[×*]/g,'x');
  s = s.replace(/,(\d)/g,'.$1');
  // Chuẩn hóa số thập phân: 8.0 -> 8, 7.50 -> 7.5 (bỏ số 0 thừa vô nghĩa)
  s = s.replace(/\d+\.\d+/g, m=>String(parseFloat(m)));
  s = s.replace(/\s*x\s*/g,'x');
  s = s.replace(/\s+/g,' ').trim();
  return s;
}
// "Kéo" hiển thị trong UI là "Kéo (Rút)" nên tìm "kéo" hoặc "rút" đều phải ra.
function _khLoaiSynonyms(loai){
  const l = (loai||'').trim();
  if(l==='Kéo') return 'kéo rút';
  return l;
}
// Bản ghi khuôn có khớp từ khóa tìm kiếm không — tìm đồng thời trong loại
// khuôn, nhóm khuôn, kích thước và ghi chú.
function khuonMatchesSearch(rec, query){
  const q = normalizeKhuonSearch(query);
  if(!q) return true;
  const hay = normalizeKhuonSearch([rec.size||'', rec.category||'', _khLoaiSynonyms(rec.loai||''), rec.note||''].join(' '));
  return hay.includes(q);
}
// Danh sách nhóm khuôn "sống" — hợp nhất nhóm hạt giống + nhóm thực tế đang
// có trong dữ liệu hiện tại (không duplicate, có sắp xếp) để Autocomplete/
// datalist luôn hiển thị đầy đủ nhóm mới nhất sau khi Thêm/Sửa/Xóa.
function khLiveCategories(seedCats, list){
  const set = new Set(seedCats||[]);
  (list||[]).forEach(x=>{ if(x && x.category) set.add(x.category); });
  return [...set].sort((a,b)=>a.localeCompare(b,'vi'));
}

let _khTab = 'catalog';       // 'catalog' | 'qty'
let _khSearch = '';
let _khCatFilter = 'all';     // lọc theo nhóm ở tab Tổng hợp Khuôn
let _khQtyFilter = 'all';     // lọc theo nhóm ở tab Số lượng Khuôn
let _khQtyTypeFilter = 'all'; // lọc theo loại (Đùn/Kéo) ở tab Số lượng Khuôn
let _khCatEditId = null;
let _khQtyEditId = null;
// Tập id kích thước đang được tick chọn ở tab "Tổng hợp Khuôn" (xóa hàng loạt)
let _khCatSel = new Set();

function khGoSubTab(tab){
  _khTab = tab; _khSearch=''; _khCatFilter='all'; _khQtyFilter='all'; _khQtyTypeFilter='all';
  _khCatSel.clear(); // bỏ mọi mục đang tick chọn khi đổi tab con
  renderKhuon();
}
// Gõ tìm kiếm không bị "rớt" ô input mỗi ký tự: lưu trạng thái focus + vị
// trí con trỏ trước khi vẽ lại toàn bộ khối, rồi khôi phục lại sau đó —
// nếu không, mỗi lần renderKhuon() dựng lại DOM sẽ tạo ô input mới,
// khiến ô tìm kiếm mất focus và người dùng phải click lại sau mỗi ký tự.
function khSetSearch(val){
  _khSearch = val||'';
  khRenderPreservingSearchFocus();
}
function khRenderPreservingSearchFocus(){
  const active = document.activeElement;
  const wasFocused = !!(active && active.classList && active.classList.contains('khm-search'));
  const caret = wasFocused ? active.selectionStart : null;
  renderKhuon();
  if(wasFocused){
    const inp = document.querySelector('#mc .khm-search');
    if(inp){ inp.focus(); if(caret!=null) inp.setSelectionRange(caret, caret); }
  }
}
function khSetCatFilter(c){ _khCatFilter = c; renderKhuon(); }
function khSetQtyFilter(c){ _khQtyFilter = c; renderKhuon(); }
function khSetQtyType(t){ _khQtyTypeFilter = t; renderKhuon(); }

// Tình trạng tồn kho tính từ số lượng: <=0 Hết hàng, <=1 Sắp hết, còn lại Có sẵn
function khuonStatusOf(qty){
  const q = Number(qty)||0;
  if(q<=0) return {cls:'danger', label:'⛔ Hết hàng'};
  if(q<=1) return {cls:'warn', label:'⚠️ Sắp hết'};
  return {cls:'ok', label:'✅ Có sẵn'};
}

// ── Ngày mua khuôn: parse "chịu lỗi" nhiều định dạng (ISO 2025-06-28,
// dd/mm/yyyy, và cả lỗi gõ như "19/12*2025") -> trả về Date hoặc null. ──
function khParseNgayMua(raw){
  if(raw===null||raw===undefined) return null;
  const s = String(raw).trim();
  if(!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(m){ const d=new Date(+m[1],+m[2]-1,+m[3]); return isNaN(d)?null:d; }
  m = s.match(/^(\d{1,2})[\/\-*.](\d{1,2})[\/\-*.](\d{4})$/);
  if(m){ const d=new Date(+m[3],+m[2]-1,+m[1]); return isNaN(d)?null:d; }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
// Hiển thị ngày mua dạng dd/mm/yyyy — chịu được cả các định dạng lỗi gõ ở trên.
function fmtKhuonNgayMua(raw){
  const d = khParseNgayMua(raw);
  return d ? vnDateDMY(d) : '—';
}
// Khuôn được xem là "mới đặt" nếu ngày mua trong vòng 30 ngày gần nhất
// (so với hôm nay) — dùng để gắn nhãn 🆕 nổi bật trên danh sách.
function khIsRecentNgayMua(raw){
  const d = khParseNgayMua(raw);
  if(!d) return false;
  const days = (Date.now() - d.getTime()) / 86400000;
  return days >= -1 && days <= 30;
}
// Sắp xếp danh sách khuôn theo Ngày mua MỚI NHẤT lên đầu tiên (ví dụ khuôn
// mua ngày 14/8/2026 sẽ hiển thị lên đầu). Bản ghi không có/không đọc được
// ngày mua bị đẩy xuống cuối danh sách.
function sortKhuonByNgayMuaDesc(list){
  return (list||[]).slice().sort((x,y)=>{
    const dx = khParseNgayMua(x.ngayMua), dy = khParseNgayMua(y.ngayMua);
    if(!dx && !dy) return 0;
    if(!dx) return 1;
    if(!dy) return -1;
    return dy.getTime() - dx.getTime();
  });
}

function renderKhuon(){
  const admin = isAdmin();
  const catalog = DB.khuonCatalog||[];
  const qty = DB.khuonQty||[];
  const totalQty = qty.reduce((s,r)=>s+(Number(r.qty)||0),0);
  const lowStock = qty.filter(r=>Number(r.qty)<=1).length;
  const outStock = qty.filter(r=>Number(r.qty)<=0).length;

  const catCats = [...new Set(catalog.map(x=>x.category))];
  const qtyCats = [...new Set(qty.map(x=>x.category))];

  $('mc').innerHTML = `
    <div class="khm-tabs" style="align-items:center">
      <button class="khm-tab-btn ${_khTab==='catalog'?'active':''}" onclick="khGoSubTab('catalog')">📋 Tổng hợp Khuôn</button>
      <button class="khm-tab-btn ${_khTab==='qty'?'active':''}" onclick="khGoSubTab('qty')">📦 Số lượng Khuôn</button>
      <button class="set-btn" style="width:auto;margin-left:auto;padding:8px 14px;font-size:12.5px;background:var(--brand);color:#fff;font-weight:700;white-space:nowrap" onclick="openKhuonQrModal()">🏷 Mã QR tổng hợp Khuôn (công khai)</button>
    </div>
    ${!admin?`<div class="khm-locked-note">🔒 Chỉ Quản trị viên (Admin) mới có quyền thêm/sửa/xóa dữ liệu Khuôn. Bạn đang ở chế độ chỉ xem.</div>`:''}
    <div class="khm-stats">
      <div class="khm-stat-card"><div class="khm-stat-num">${catalog.length}</div><div class="khm-stat-lbl">Kích thước trong danh mục</div></div>
      <div class="khm-stat-card"><div class="khm-stat-num">${qty.length}</div><div class="khm-stat-lbl">Mục khuôn trong kho</div></div>
      <div class="khm-stat-card"><div class="khm-stat-num">${totalQty}</div><div class="khm-stat-lbl">Tổng số khuôn hiện có</div></div>
      <div class="khm-stat-card warn"><div class="khm-stat-num">${lowStock}</div><div class="khm-stat-lbl">Sắp hết / cần đặt thêm</div></div>
      <div class="khm-stat-card danger"><div class="khm-stat-num">${outStock}</div><div class="khm-stat-lbl">Đã hết hàng</div></div>
    </div>
    <div id="khmBody"></div>
  `;
  if(_khTab==='catalog') renderKhuonCatalog(catalog, catCats, admin);
  else renderKhuonQty(qty, qtyCats, admin);
}

function renderKhuonCatalog(catalog, cats, admin){
  const q = _khSearch;
  let list = catalog.filter(x=> (_khCatFilter==='all'||x.category===_khCatFilter) && khuonMatchesSearch(x, q));
  const groups = {};
  list.forEach(x=>{ (groups[x.category]=groups[x.category]||[]).push(x); });
  Object.keys(groups).forEach(g=>{ groups[g] = sortKhuonList(groups[g], 'size'); });
  const groupNames = Object.keys(groups).sort((a,b)=>a.localeCompare(b,'vi'));

  // Chỉ giữ lại các mục đang được tick mà vẫn còn tồn tại trong danh mục —
  // tránh "xóa nhầm" id cũ còn sót lại sau khi dữ liệu được đồng bộ lại.
  const liveIds = new Set(catalog.map(x=>x.id));
  [..._khCatSel].forEach(id=>{ if(!liveIds.has(id)) _khCatSel.delete(id); });
  const selCount = _khCatSel.size;

  $('khmBody').innerHTML = `
    <div class="khm-toolbar">
      <input class="khm-search" placeholder="🔎 Tìm kích thước, nhóm khuôn..." value="${(_khSearch||'').replace(/"/g,'&quot;')}" oninput="khSetSearch(this.value)">
      <button class="khm-add-btn" style="background:#1B3A6B" onclick="exportKhuonCatalogExcel()">📥 Xuất Excel</button>
      ${admin?`<button class="khm-add-btn" onclick="khCatOpenAdd()">+ Thêm kích thước</button>`:''}
    </div>
    ${admin&&selCount?`<div class="khm-bulk-bar">
      <span>🗑 Đã chọn ${selCount} kích thước</span>
      <button class="khm-bulk-del" onclick="khCatDeleteSelected()">Xóa ${selCount} mục đã chọn</button>
      <button class="khm-bulk-clear" onclick="khCatClearSel()">Bỏ chọn</button>
    </div>`:''}
    <div class="khm-chip-row">
      <button class="khm-chip ${_khCatFilter==='all'?'active':''}" onclick="khSetCatFilter('all')">Tất cả (${catalog.length})</button>
      ${cats.map(c=>`<button class="khm-chip ${_khCatFilter===c?'active':''}" onclick="khSetCatFilter('${c.replace(/'/g,"\\'")}')">${c} (${catalog.filter(x=>x.category===c).length})</button>`).join('')}
    </div>
    ${groupNames.length===0?`<div class="empty"><div class="empty-icon">🗂️</div>Không tìm thấy kích thước khuôn nào phù hợp</div>`:
      groupNames.map(g=>`
        <div class="khm-cat-section">
          <div class="khm-cat-title">${g} <span class="khm-cat-count">${groups[g].length} kích thước</span>${admin?` <span class="khm-item-del" style="position:static;padding:2px 6px;font-size:11px;font-weight:700" title="Xóa toàn bộ nhóm này" onclick="khCatDeleteGroup('${g.replace(/'/g,"\\'")}')">🗑 Xóa nhóm</span>`:''}</div>
          <div class="khm-item-grid">
            ${groups[g].map(it=>`
              <div class="khm-item-chip${_khCatSel.has(it.id)?' khm-sel':''}">
                ${admin?`<span class="khm-item-del" title="Xóa kích thước này" onclick="khCatDelete('${it.id}')">🗑</span>`:''}
                ${admin?`<span class="khm-item-edit" onclick="khCatOpenEdit('${it.id}')">✏️</span>`:''}
                <span class="khm-item-size">${it.size.replace(/</g,'&lt;')}</span>
                ${admin?`<input type="checkbox" class="khm-item-chk" title="Chọn để xóa hàng loạt" ${_khCatSel.has(it.id)?'checked':''} onclick="khCatToggleSel('${it.id}',this.checked)">`:''}
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')
    }
  `;
}
