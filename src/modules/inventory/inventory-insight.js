// src/modules/inventory/inventory-insight.js — Giai đoạn 3: "Độ phủ liên kết truy xuất" cho 3 sổ (CHỈ ĐỌC)
// Đếm dòng của sổ đang xem đã có khóa liên kết (donHangId / Heat-Lot / Mã lô SX) — nền tảng của tab Truy xuất.
// Không tự ghép, không sửa dòng nào; dòng thiếu khóa chỉ được liệt kê để người dùng bổ sung thủ công.
function slLinkStats(tab){
  const rows = slArr(tab);
  const has = v => v!==undefined && v!==null && String(v).trim()!=='';
  const withOrder = rows.filter(r=>has(r.donHangId)).length;
  const withLot = rows.filter(r=>has(r.heatLot)).length;
  const withSX = rows.filter(r=>has(r.maLoSX)).length;
  const missing = rows.filter(r=>!has(r.donHangId));
  return {n:rows.length, withOrder, withLot, withSX, missing};
}
function slInsightHTML(){
  const tab = _slTab, s = slLinkStats(tab);
  if(!s.n) return `<div class="dp-strip-t">Liên kết truy xuất <small>(${escapeHtml(SL_META[tab].label)})</small></div><div class="dp-hint"><span class="ds-na">CHƯA CÓ DỮ LIỆU</span> Sổ chưa có dòng nào.</div>`;
  const pct = n => Math.round(n/s.n*100)+'%';
  const chip = (cls, ic, v, l) => `<span class="dp-chip ${cls}" style="cursor:default"><span>${ic}</span><b>${v}</b><em>${l}</em></span>`;
  return `<div class="dp-strip-t">Liên kết truy xuất <small>(${escapeHtml(SL_META[tab].label)} · ${s.n} dòng)</small></div>
    <div class="dp-chips">
      ${chip(s.withOrder===s.n?'ok':'warn','🔗',pct(s.withOrder),'dòng gắn Đơn hàng')}
      ${chip(s.withLot===s.n?'ok':'warn','🏷️',pct(s.withLot),'dòng có Heat-Lot')}
      ${chip(s.withSX===s.n?'ok':'warn','📦',pct(s.withSX),'dòng có Mã lô SX')}
      ${s.missing.length?`<button class="dp-chip danger" onclick="slOpenUnlinked()"><span>🧩</span><b>${s.missing.length}</b><em>dòng chưa gắn đơn</em></button>`:''}
    </div>
    <div class="dp-hint">Dòng cũ nhập trước khi có trường liên kết sẽ hiện chưa gắn — hệ thống không tự đoán; mở dòng và chọn đơn để bổ sung.</div>`;
}
function slOpenUnlinked(){
  const tab = _slTab, rows = slLinkStats(tab).missing.slice().sort((a,b)=>String(b.ngay||'').localeCompare(String(a.ngay||'')));
  const body = rows.length ? rows.slice(0,200).map(r=>`<div class="dp-li" onclick="dpCloseDrawer();slViewDetail('${esc(tab)}','${esc(r.id)}')"><b>${escapeHtml(tab==='nguyenLieu'?(r.nguyenLieu||r.heatLot||'(dòng phế/phoi)'):(r.quyCach||'—'))}</b><span>${escapeHtml(fmtDate(r.ngay))} · ${escapeHtml(r.khachHang||'—')}</span><em>${escapeHtml(r.heatLot||'chưa có Heat-Lot')}</em></div>`).join('')
    + (rows.length>200?`<div class="dp-hint">Chỉ hiện 200 dòng mới nhất / ${rows.length}.</div>`:'') : '<div class="ds-empty">Không có dòng nào.</div>';
  dpDrawer(`🧩 ${escapeHtml(SL_META[tab].label)} — chưa gắn đơn (${rows.length})`, body);
}
dpEnhanceRender('renderSoLieu', ()=>dpMountStrip('slInsight', slInsightHTML(), '.sl-tabs'));
