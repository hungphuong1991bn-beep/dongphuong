// src/modules/molds/molds-qty.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────



// Danh mục loại khuôn hiển thị tách riêng — Đùn và Kéo (Rút) mỗi loại 1
// khối bảng riêng biệt, không còn gộp chung 1 bảng như trước.
const KH_QTY_TYPES = [
  {key:'Đùn', icon:'🧵', label:'Khuôn Đùn', accent:'dun'},
  {key:'Kéo', icon:'🪝', label:'Khuôn Rút (Kéo)', accent:'keo'}
];

function renderKhuonQty(qty, cats, admin){
  const q = _khSearch;
  const filtered = qty.filter(x=>
    (_khQtyFilter==='all'||x.category===_khQtyFilter) &&
    khuonMatchesSearch(x, q)
  );
  const visibleTypes = _khQtyTypeFilter==='all' ? KH_QTY_TYPES : KH_QTY_TYPES.filter(t=>t.key===_khQtyTypeFilter);

  $('khmBody').innerHTML = `
    <div class="khm-toolbar">
      <input class="khm-search" placeholder="🔎 Tìm kích thước, nhóm, loại, ghi chú..." value="${(_khSearch||'').replace(/"/g,'&quot;')}" oninput="khSetSearch(this.value)">
      ${admin?`<button class="khm-add-btn" onclick="khQtyOpenAdd()">+ Thêm khuôn vào kho</button>`:''}
    </div>
    <div class="khm-chip-row">
      <button class="khm-chip ${_khQtyTypeFilter==='all'?'active':''}" onclick="khSetQtyType('all')">🗂️ Hiển thị: Cả hai loại</button>
      <button class="khm-chip ${_khQtyTypeFilter==='Đùn'?'active':''}" onclick="khSetQtyType('Đùn')">🧵 Khuôn Đùn</button>
      <button class="khm-chip ${_khQtyTypeFilter==='Kéo'?'active':''}" onclick="khSetQtyType('Kéo')">🪝 Khuôn Rút (Kéo)</button>
    </div>
    <div class="khm-chip-row">
      <button class="khm-chip ${_khQtyFilter==='all'?'active':''}" onclick="khSetQtyFilter('all')">Tất cả nhóm</button>
      ${cats.map(c=>`<button class="khm-chip ${_khQtyFilter===c?'active':''}" onclick="khSetQtyFilter('${c.replace(/'/g,"\\'")}')">${c}</button>`).join('')}
    </div>
    ${filtered.length===0?`<div class="empty"><div class="empty-icon">📦</div>Không tìm thấy khuôn nào phù hợp</div>`:
      visibleTypes.map(t=>khQtyTypeSectionHtml(t, filtered.filter(x=>x.loai===t.key), admin)).join('')
    }
  `;
}

// Render 1 khối riêng (Đùn hoặc Kéo): sắp xếp theo Ngày mua mới nhất lên
// đầu tiên (ví dụ khuôn mua 14/8/2026 sẽ ở trên cùng) + gắn nhãn 🆕 Mới
// cho khuôn vừa đặt mua gần đây để dễ nhận biết.
function khQtyTypeSectionHtml(t, list, admin){
  list = sortKhuonByNgayMuaDesc(list);
  const totalQty = list.reduce((s,r)=>s+(Number(r.qty)||0),0);
  const newCount = list.filter(r=>khIsRecentNgayMua(r.ngayMua)).length;
  return `
    <div class="khm-type-section khm-type-${t.accent}">
      <div class="khm-type-header">
        <div class="khm-type-title"><span class="khm-type-icon">${t.icon}</span>${t.label}</div>
        <div class="khm-type-meta">
          <span class="khm-type-count">${list.length} mục</span>
          <span class="khm-type-count">${totalQty} khuôn</span>
          ${newCount>0?`<span class="khm-type-count khm-type-count-new">🆕 ${newCount} mới đặt</span>`:''}
        </div>
      </div>
      ${list.length===0?`<div class="empty" style="padding:24px 12px"><div class="empty-icon">📦</div>Chưa có ${t.label.toLowerCase()} nào phù hợp</div>`:`
      <div class="khm-table-wrap">
        <table class="khm-table">
          <thead><tr>
            <th class="khm-col-stt">STT</th><th>Nhóm khuôn</th><th class="khm-col-size">Kích thước</th><th>SL</th><th>Ngày mua</th><th>Tình trạng</th><th>Ghi chú</th>${admin?'<th></th>':''}
          </tr></thead>
          <tbody>
            ${list.map((r,i)=>{
              const st = khuonStatusOf(r.qty);
              const isNew = khIsRecentNgayMua(r.ngayMua);
              return `<tr class="${isNew?'khm-row-new':''}">
                <td class="khm-col-stt" data-label="STT">${i+1}</td>
                <td data-label="Nhóm khuôn">${(r.category||'').replace(/</g,'&lt;')}</td>
                <td class="khm-col-size" data-label="Kích thước"><b>${(r.size||'').replace(/</g,'&lt;')}</b></td>
                <td data-label="Số lượng">${r.qty??0}</td>
                <td data-label="Ngày mua"><span class="khm-date-cell">${fmtKhuonNgayMua(r.ngayMua)}${isNew?'<span class="khm-new-badge">🆕 Mới</span>':''}</span></td>
                <td data-label="Tình trạng"><span class="khm-status-pill ${st.cls}">${st.label}</span></td>
                <td data-label="Ghi chú">${(r.note||'—').replace(/</g,'&lt;')}</td>
                ${admin?`<td><div class="khm-row-actions">
                  <button class="khm-icon-btn" title="Sửa" onclick="khQtyOpenEdit('${r.id}')">✏️</button>
                  <button class="khm-icon-btn danger" title="Xóa" onclick="khQtyDelete('${r.id}')">🗑</button>
                </div></td>`:''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}
    </div>
  `;
}

function khFillGroupDatalist(listId, cats){
  const dl = $(listId); if(!dl) return;
  dl.innerHTML = cats.map(c=>`<option value="${c.replace(/"/g,'&quot;')}">`).join('');
}

// ── Tổng hợp Khuôn: thêm / sửa / xóa (chỉ Admin) ──
function khCatOpenAdd(){if(guardNotAdmin())return;
  _khCatEditId = null;
  $('khCatModalTitle').textContent = 'Thêm kích thước khuôn';
  $('khCatDelBtn').style.display = 'none'; // đang thêm mới — chưa có gì để xóa
  $('khCatGroup').value = _khCatFilter!=='all'?_khCatFilter:'';
  $('khCatSize').value = '';
  $('khCatErr').style.display='none';
  khFillGroupDatalist('khCatGroupList', khLiveCategories(KHUON_CATALOG_CATS, DB.khuonCatalog));
  openModal('khCatModal');
}
function khCatOpenEdit(id){if(guardNotAdmin())return;
  const it = (DB.khuonCatalog||[]).find(x=>x.id===id); if(!it) return;
  _khCatEditId = id;
  $('khCatModalTitle').textContent = 'Sửa kích thước khuôn';
  $('khCatDelBtn').style.display = ''; // đang sửa 1 mục có sẵn — cho phép xóa luôn tại đây
  $('khCatGroup').value = it.category||'';
  $('khCatSize').value = it.size||'';
  $('khCatErr').style.display='none';
  khFillGroupDatalist('khCatGroupList', khLiveCategories(KHUON_CATALOG_CATS, DB.khuonCatalog));
  openModal('khCatModal');
}
function khCatSave(){if(guardNotAdmin())return;
  const category = $('khCatGroup').value.trim();
  const size = $('khCatSize').value.trim();
  if(!category||!size){ $('khCatErr').textContent='Vui lòng nhập đủ Nhóm khuôn và Kích thước'; $('khCatErr').style.display='block'; return; }
  if(_khCatEditId){
    const it = (DB.khuonCatalog||[]).find(x=>x.id===_khCatEditId); if(!it) return;
    const before = {...it};
    it.category = category; it.size = size;
    saveKhuonCatalog();
    log('Sửa danh mục khuôn', `${category} · ${size}`, '', before, it);
  } else {
    const rec = { id:'kc_'+uid(), category, size };
    DB.khuonCatalog.push(rec);
    saveKhuonCatalog();
    log('Thêm danh mục khuôn', `${category} · ${size}`, '', null, rec);
  }
  closeModal('khCatModal');
  renderKhuon();
  showToast('✅ Đã lưu danh mục khuôn');
}

// ── Xóa kích thước trong "Tổng hợp Khuôn" (chỉ Admin) ──
// Trước đây tab này chỉ có Thêm/Sửa, không có đường nào xóa một kích thước
// đã nhập nhầm. Ba hàm dưới bổ sung: xóa 1 mục, xóa nhiều mục đã tick, và
// xóa cả một nhóm khuôn. Tất cả đều đi qua confirm2 + ghi nhật ký giống
// khQtyDelete() để lịch sử thao tác không bị thiếu.
// Lưu ý: danh mục (khuonCatalog) và kho (khuonQty) là 2 bảng riêng — xóa
// kích thước khỏi danh mục KHÔNG tự xóa khuôn cùng cỡ đang có trong kho,
// nên nếu còn tồn kho thì cảnh báo rõ trong hộp xác nhận.
function khCatQtyRefs(it){
  const sz = (it.size||'').trim().toLowerCase();
  return (DB.khuonQty||[]).filter(r=>(r.size||'').trim().toLowerCase()===sz);
}
function khCatToggleSel(id, checked){
  if(checked) _khCatSel.add(id); else _khCatSel.delete(id);
  renderKhuon();
}
function khCatClearSel(){ _khCatSel.clear(); renderKhuon(); }

function khCatDelete(id){if(guardNotAdmin())return;
  const it = (DB.khuonCatalog||[]).find(x=>x.id===id); if(!it) return;
  const refs = khCatQtyRefs(it);
  const warn = refs.length ? ` — ⚠️ Lưu ý: vẫn còn ${refs.length} mục cỡ này trong "Số lượng Khuôn" (kho) — xóa ở đây chỉ bỏ khỏi danh mục tổng hợp, không đụng tới dữ liệu kho.` : '';
  confirm2('Xóa kích thước khuôn', `Xóa "${it.size}" khỏi nhóm "${it.category}"?${warn}`, ()=>{
    DB.khuonCatalog = (DB.khuonCatalog||[]).filter(x=>x.id!==id);
    _khCatSel.delete(id);
    saveKhuonCatalog();
    log('Xóa danh mục khuôn', `${it.category} · ${it.size}`, '', it, null);
    renderKhuon();
    showToast('🗑 Đã xóa kích thước khuôn');
  });
}

function khCatDeleteSelected(){if(guardNotAdmin())return;
  const ids = [..._khCatSel];
  const items = (DB.khuonCatalog||[]).filter(x=>ids.includes(x.id));
  if(!items.length){ showToast('Chưa chọn kích thước nào', true); return; }
  const preview = items.slice(0,8).map(x=>x.size).join(', ') + (items.length>8?`… (+${items.length-8})`:'');
  confirm2('Xóa nhiều kích thước', `Xóa ${items.length} kích thước đã chọn? — ${preview}`, ()=>{
    DB.khuonCatalog = (DB.khuonCatalog||[]).filter(x=>!ids.includes(x.id));
    _khCatSel.clear();
    saveKhuonCatalog();
    log('Xóa danh mục khuôn (nhiều mục)', `${items.length} kích thước: ${preview}`, '', items, null);
    renderKhuon();
    showToast(`🗑 Đã xóa ${items.length} kích thước`);
  });
}

function khCatDeleteGroup(category){if(guardNotAdmin())return;
  const items = (DB.khuonCatalog||[]).filter(x=>x.category===category);
  if(!items.length) return;
  confirm2('Xóa cả nhóm khuôn', `Xóa TOÀN BỘ ${items.length} kích thước của nhóm "${category}"? Không thể hoàn tác.`, ()=>{
    DB.khuonCatalog = (DB.khuonCatalog||[]).filter(x=>x.category!==category);
    items.forEach(x=>_khCatSel.delete(x.id));
    saveKhuonCatalog();
    log('Xóa nhóm danh mục khuôn', `${category} · ${items.length} kích thước`, '', items, null);
    if(_khCatFilter===category) _khCatFilter='all';
    renderKhuon();
    showToast(`🗑 Đã xóa nhóm "${category}" (${items.length} kích thước)`);
  });
}

// Xóa ngay trong hộp thoại "Sửa kích thước khuôn" — đóng modal trước rồi mới
// hỏi xác nhận để 2 modal không chồng lên nhau.
function khCatDeleteFromModal(){
  const id = _khCatEditId;
  if(!id) return;
  closeModal('khCatModal');
  khCatDelete(id);
}


// ── Số lượng Khuôn: thêm / sửa / xóa (chỉ Admin) ──
function khQtyOpenAdd(){if(guardNotAdmin())return;
  _khQtyEditId = null;
  $('khQtyModalTitle').textContent = 'Thêm khuôn vào kho';
  $('khQtyLoai').value = 'Đùn';
  $('khQtyGroup').value = _khQtyFilter!=='all'?_khQtyFilter:'';
  $('khQtySize').value = '';
  $('khQtyNum').value = '';
  $('khQtyDate').value = new Date().toISOString().slice(0,10);
  $('khQtyNote').value = '';
  $('khQtyErr').style.display='none';
  khFillGroupDatalist('khQtyGroupList', khLiveCategories(KHUON_QTY_CATS, DB.khuonQty));
  openModal('khQtyModal');
}
function khQtyOpenEdit(id){if(guardNotAdmin())return;
  const it = (DB.khuonQty||[]).find(x=>x.id===id); if(!it) return;
  _khQtyEditId = id;
  $('khQtyModalTitle').textContent = 'Sửa khuôn trong kho';
  $('khQtyLoai').value = it.loai||'Đùn';
  $('khQtyGroup').value = it.category||'';
  $('khQtySize').value = it.size||'';
  $('khQtyNum').value = it.qty??0;
  $('khQtyDate').value = it.ngayMua||'';
  $('khQtyNote').value = it.note||'';
  $('khQtyErr').style.display='none';
  khFillGroupDatalist('khQtyGroupList', khLiveCategories(KHUON_QTY_CATS, DB.khuonQty));
  openModal('khQtyModal');
}
function khQtySave(){if(guardNotAdmin())return;
  const loai = $('khQtyLoai').value;
  const category = $('khQtyGroup').value.trim();
  const size = $('khQtySize').value.trim();
  const numVal = $('khQtyNum').value;
  if(!category||!size||numVal===''){ $('khQtyErr').textContent='Vui lòng nhập đủ Nhóm khuôn, Kích thước và Số lượng'; $('khQtyErr').style.display='block'; return; }
  const data = { loai, category, size, qty:Number(numVal)||0, ngayMua:$('khQtyDate').value||null, note:$('khQtyNote').value.trim() };
  if(_khQtyEditId){
    const it = (DB.khuonQty||[]).find(x=>x.id===_khQtyEditId); if(!it) return;
    const before = {...it};
    Object.assign(it, data);
    saveKhuonQty();
    log('Sửa kho khuôn', `${loai} · ${category} · ${size} · SL ${data.qty}`, '', before, it);
  } else {
    const rec = { id:'kq_'+uid(), ...data };
    DB.khuonQty.push(rec);
    saveKhuonQty();
    log('Thêm kho khuôn', `${loai} · ${category} · ${size} · SL ${data.qty}`, '', null, rec);
  }
  closeModal('khQtyModal');
  updateKhuonBadge();
  renderKhuon();
  showToast('✅ Đã lưu kho khuôn');
}
function khQtyDelete(id){if(guardNotAdmin())return;
  const it = (DB.khuonQty||[]).find(x=>x.id===id); if(!it) return;
  confirm2('Xóa khuôn khỏi kho', `Xóa "${it.size}" (${it.loai}) khỏi kho?`, ()=>{
    DB.khuonQty = DB.khuonQty.filter(x=>x.id!==id);
    saveKhuonQty();
    log('Xóa kho khuôn', `${it.loai} · ${it.category} · ${it.size}`, '', it, null);
    updateKhuonBadge();
    renderKhuon();
    showToast('Đã xóa');
  });
}
