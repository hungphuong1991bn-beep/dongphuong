// src/modules/planning/planning-insight.js — Giai đoạn 3: "Tải giao hàng 7 ngày tới" cho tab Kế hoạch (CHỈ ĐỌC)
// Theo hạn giao (deliveryDate) của đơn chưa hoàn thành, chưa giao. Chỉ cộng kg/đơn có sẵn; đơn không có kg tính 0 và nói rõ.
function plnLoadModel(){
  const act = (DB.orders||[]).filter(o=>o && o.status!=='done' && !o.delivered);
  const days = [];
  const t0 = new Date(); t0.setHours(0,0,0,0);
  for(let i=0;i<7;i++){
    const d = new Date(t0.getTime()+i*86400000);
    const list = act.filter(o=>dpDaysTo(o.deliveryDate)===i);
    days.push({i, label: i===0?'Hôm nay':(i===1?'Ngày mai':d.toLocaleDateString('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit'})), list,
      kg: list.reduce((s,o)=>s+(Number(o.kg)||0),0), noKg: list.filter(o=>!(Number(o.kg)>0)).length});
  }
  const late = act.filter(o=>{ const d=dpDaysTo(o.deliveryDate); return d!=null && d<0; });
  const later = act.filter(o=>{ const d=dpDaysTo(o.deliveryDate); return d!=null && d>6; });
  const noDue = act.filter(o=>!o.deliveryDate);
  return {days, late, later, noDue};
}
function plnInsightHTML(){
  const m = plnLoadModel();
  const maxKg = Math.max(1, ...m.days.map(d=>d.kg));
  const bars = m.days.map(d=>`<button class="dp-day ${d.list.length?'':'zero'}" onclick="plnOpenDay(${d.i})" title="${d.list.length} đơn${d.noKg?` (${d.noKg} đơn chưa có kg)`:''}">
      <div class="dp-day-bar"><i style="height:${Math.round(d.kg/maxKg*100)}%"></i></div>
      <b>${d.list.length}</b><span>${fmtNum(d.kg)} kg</span><em>${escapeHtml(d.label)}</em></button>`).join('');
  const side = [
    ['late','⚠️','Trễ hạn',m.late,'danger'],['later','🗓️','Sau 7 ngày',m.later,'info'],['nodue','📅','Chưa có ngày giao',m.noDue,'info']
  ].map(([k,ic,l,list,c])=>`<button class="dp-chip ${list.length?c:'zero'}" onclick="plnOpenGroup('${k}')"><span>${ic}</span><b>${list.length}</b><em>${l}</em></button>`).join('');
  return `<div class="dp-strip-t">Tải giao hàng 7 ngày tới <small>(theo hạn giao, đơn chưa hoàn thành)</small></div>
    <div class="dp-days">${bars}</div><div class="dp-chips" style="margin-top:8px">${side}</div>`;
}
function plnOpenDay(i){
  const d = plnLoadModel().days[i]; if(!d) return;
  dpDrawer(`📆 ${escapeHtml(d.label)} — ${d.list.length} đơn · ${fmtNum(d.kg)} kg`, (d.noKg?`<div class="dp-hint">${d.noKg} đơn chưa có khối lượng (kg) nên không được cộng vào tổng.</div>`:'')+dpOrderRows(d.list));
}
function plnOpenGroup(k){
  const m = plnLoadModel(); const map = {late:['⚠️ Trễ hạn',m.late], later:['🗓️ Hạn giao sau 7 ngày',m.later], nodue:['📅 Chưa có ngày giao',m.noDue]};
  const g = map[k]; if(!g) return; dpDrawer(`${g[0]} (${g[1].length})`, dpOrderRows(g[1]));
}
dpEnhanceRender('renderKeHoach', ()=>dpMountStrip('plnInsight', plnInsightHTML()));
