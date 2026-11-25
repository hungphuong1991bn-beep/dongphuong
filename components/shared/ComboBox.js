// src/components/shared/ComboBox.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// ORDERS CRUD
// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
// COMBO GỢI Ý: "Loại / Quy cách" (ấn mũi tên ra ngay "Bo cạnh",
// "Loại đặc biệt"...) và "Khách hàng" (tên nhập lần đầu tự lưu, lần sau
// ấn mũi tên là ra) — dùng chung 1 bộ hàm cho cả 2 field trong form
// Thêm/Sửa đơn hàng.
// ════════════════════════════════════════════════════════════
const QUY_CACH_PINNED = ['Bo cạnh','Loại đặc biệt'];
function getQuyCachHistory(){
  let saved=[]; try{ saved=JSON.parse(localStorage.getItem('quyCachHistory')||'[]'); }catch(e){ saved=[]; }
  const fromOrders=(DB.orders||[]).map(o=>(o.type||'').trim()).filter(Boolean);
  const merged=[...QUY_CACH_PINNED];
  [...saved, ...fromOrders].forEach(v=>{ if(v && !merged.includes(v)) merged.push(v); });
  return merged;
}
function saveQuyCachHistory(val){
  if(!val) return;
  let saved=[]; try{ saved=JSON.parse(localStorage.getItem('quyCachHistory')||'[]'); }catch(e){ saved=[]; }
  if(QUY_CACH_PINNED.includes(val)) return; // đã có sẵn, không cần lưu lại
  saved=saved.filter(v=>v!==val); saved.unshift(val);
  localStorage.setItem('quyCachHistory', JSON.stringify(saved.slice(0,50)));
}
function getCustomerHistory(){
  let saved=[]; try{ saved=JSON.parse(localStorage.getItem('customerNameHistory')||'[]'); }catch(e){ saved=[]; }
  const fromOrders=(DB.orders||[]).map(o=>(o.customer||'').trim()).filter(Boolean);
  const merged=[...saved];
  fromOrders.forEach(v=>{ if(v && !merged.includes(v)) merged.push(v); });
  return merged;
}
function saveCustomerHistory(val){
  if(!val) return;
  let saved=[]; try{ saved=JSON.parse(localStorage.getItem('customerNameHistory')||'[]'); }catch(e){ saved=[]; }
  saved=saved.filter(v=>v!==val); saved.unshift(val);
  localStorage.setItem('customerNameHistory', JSON.stringify(saved.slice(0,100)));
}
function renderComboList(inputId, items, query){
  const listEl=$(inputId+'List'); if(!listEl) return;
  const q=(query||'').trim().toLowerCase();
  const filtered = q ? items.filter(v=>v.toLowerCase().includes(q)) : items;
  if(!filtered.length){
    listEl.innerHTML = q ? `<div class="combo-list-empty">Không có gợi ý khớp — cứ gõ tiếp, lần sau sẽ tự lưu</div>` : `<div class="combo-list-empty">Chưa có gợi ý nào</div>`;
  } else {
    listEl.innerHTML = filtered.map((v,i)=>`<div class="combo-list-item${i<2 && !q ? ' pin' : ''}" onmousedown="selectComboItem('${inputId}', ${JSON.stringify(v).replace(/"/g,'&quot;')})">${escapeHtml(v)}</div>`).join('');
  }
  listEl.classList.add('open');
  const arrow=$(inputId+'Arrow'); if(arrow) arrow.classList.add('open');
}
function toggleComboList(inputId, items){
  const listEl=$(inputId+'List'); if(!listEl) return;
  const isOpen = listEl.classList.contains('open');
  closeAllComboLists();
  if(!isOpen) renderComboList(inputId, items, '');
}
function selectComboItem(inputId, val){
  const inp=$(inputId); if(inp){ inp.value=val; inp.focus(); }
  closeAllComboLists();
  if(inputId==='ofType' && typeof calcKgAuto==='function') calcKgAuto(); // đổi sang/khỏi "Bo cạnh" → cập nhật R, A, KG ngay
}
function closeAllComboLists(){
  document.querySelectorAll('.combo-list.open').forEach(el=>el.classList.remove('open'));
  document.querySelectorAll('.combo-arrow.open').forEach(el=>el.classList.remove('open'));
}
document.addEventListener('click', function(e){
  if(!e.target.closest('.combo-wrap')) closeAllComboLists();
}, true);
