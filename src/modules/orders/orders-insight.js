// src/modules/orders/orders-insight.js — Giai đoạn 3: dải "Cần chú ý" cho tab Đơn hàng (CHỈ ĐỌC)
// Chỉ đếm từ DB.orders. Không đổi bộ lọc/dữ liệu gốc; bấm chip → mở ngăn danh sách (dpDrawer của Giai đoạn 2).
function ordAttentionGroups(){
  const act = (DB.orders||[]).filter(o=>o && o.status!=='done' && !o.delivered);
  const soon = act.filter(o=>{ const d=dpDaysTo(o.deliveryDate); return d!=null && d>=0 && d<=3; });
  const noDue = act.filter(o=>!o.deliveryDate);
  const urgentUnplanned = act.filter(o=>typeof khIsTopPriority==='function' && khIsTopPriority(o) && !o.planned && o.status!=='running' && o.status!=='cutting');
  const noCustomer = act.filter(o=>!String(o.customer||'').trim());
  return [
    {key:'soon', ic:'⏳', cls:'warn', lbl:'Đến hạn giao ≤ 3 ngày', list:soon, hint:'Hạn giao từ hôm nay đến 3 ngày tới, chưa hoàn thành'},
    {key:'urgent', ic:'🔥', cls:'danger', lbl:'Ưu tiên cao chưa lập kế hoạch', list:urgentUnplanned, hint:'Ưu tiên GẤP 1–3, chưa đánh dấu đã lập kế hoạch và chưa chạy'},
    {key:'nodue', ic:'📅', cls:'info', lbl:'Chưa có ngày giao', list:noDue, hint:'Không tính được trễ hạn cho các đơn này'},
    {key:'nocust', ic:'👤', cls:'info', lbl:'Chưa có tên khách hàng', list:noCustomer, hint:'Thiếu thông tin khách hàng'}
  ];
}
function ordInsightHTML(){
  const gs = ordAttentionGroups();
  const chips = gs.map(g=>`<button class="dp-chip ${g.list.length?g.cls:'zero'}" title="${escapeHtml(g.hint)}" onclick="ordOpenAttention('${g.key}')"><span>${g.ic}</span><b>${g.list.length}</b><em>${escapeHtml(g.lbl)}</em></button>`).join('');
  return `<div class="dp-strip-t">Cần chú ý <small>(đơn chưa hoàn thành, chưa giao)</small></div><div class="dp-chips">${chips}</div>`;
}
function ordOpenAttention(key){
  const g = ordAttentionGroups().find(x=>x.key===key); if(!g) return;
  dpDrawer(`${g.ic} ${escapeHtml(g.lbl)} (${g.list.length})`, `<div class="dp-hint">${escapeHtml(g.hint)}</div>${dpOrderRows(g.list)}`);
}
dpEnhanceRender('renderDorDang', ()=>dpMountStrip('ordInsight', ordInsightHTML()));
