// src/modules/planning/planning-fx.js — hiệu ứng "dòng chảy sản xuất" cho tab Kế hoạch SX.
// CHỈ thay phần HIỂN THỊ: giữ nguyên logic đổi công đoạn (requestSetStage), dữ liệu và trạng thái.
// Không đụng renderStageTracker/renderProgressBar gốc nên tab Đơn hàng không bị ảnh hưởng.

// Luồng công đoạn Đùn → Rút → Đánh bóng → Cắt.
// Đoạn nối của công đoạn ĐANG CHẠY có hạt sáng chạy sang công đoạn kế tiếp;
// đoạn đã qua = xanh lá liền mạch; đoạn chưa tới = nét đứt mờ.
function khStageFlow(o, clickable){
  const s = o.status==='cutting' ? 'running' : o.status;
  if(s==='pending') return `<div class="kh-flow kh-flow-idle">
    <div class="kh-flow-hd"><span class="kh-flow-lbl">Luồng công đoạn</span><span class="kh-flow-pct is-wait">Chờ vào máy</span></div>
    <div class="kh-flow-track">${STAGES.map((st,i)=>`${i?'<div class="kh-link is-todo"><span class="kh-rail"></span></div>':''}
      <div class="kh-node st-todo" title="${st.label}"><div class="kh-dot">${st.icon}</div><div class="kh-name">${st.label}</div></div>`).join('')}</div>
  </div>`;
  const curIdx = STAGES.findIndex(x=>x.key===o.stage);
  const act = s==='done' ? STAGES.length : (curIdx<0 ? 0 : curIdx);
  const pct = Math.round(act/STAGES.length*100);
  const canClick = clickable && s!=='done';
  const cur = STAGES[act];
  return `<div class="kh-flow${s==='done'?' kh-flow-done':' kh-flow-live'}">
    <div class="kh-flow-hd">
      <span class="kh-flow-lbl">${s==='done' ? 'Luồng công đoạn' : `<i class="kh-live-dot"></i>Đang ở ${cur?cur.label:''}`}</span>
      <span class="kh-flow-pct${s==='done'?' is-done':''}">${s==='done' ? '✓ Hoàn tất' : pct+'%'}</span>
    </div>
    <div class="kh-flow-track">${STAGES.map((st,i)=>{
      const state = i<act ? 'st-done' : (i===act && s!=='done' ? 'st-active' : 'st-todo');
      // Đoạn nối i-1 → i: đang chảy nếu công đoạn i-1 là công đoạn hiện tại
      const link = !i ? '' : (i-1===act && s!=='done'
        ? `<div class="kh-link is-flow"><span class="kh-rail"></span><i class="kh-spark"></i><i class="kh-spark"></i><i class="kh-spark"></i></div>`
        : `<div class="kh-link ${i<=act?'is-done':'is-todo'}"><span class="kh-rail"></span></div>`);
      return `${link}<div class="kh-node ${state}" data-clickable="${canClick?1:0}" ${canClick?`onclick="event.stopPropagation();requestSetStage('${o.id}','${st.key}')"`:''} title="${st.label}">
        <div class="kh-dot">${state==='st-done'?'✓':st.icon}</div><div class="kh-name">${st.label}</div></div>`;
    }).join('')}</div>
  </div>`;
}

// Thanh tiến độ số lượng: đang chạy có sọc chuyển động + vệt sáng quét; đủ số lượng thì xanh lá tĩnh.
function khProgressFx(o){
  const qty = o.qty||0, done = o.doneQty||0;
  if(!qty || o.status==='pending') return '';
  const unit = o.isCoil ? 'cuộn' : (o.isRound ? 'cây' : 'thanh');
  const pct = Math.min(100, Math.round(done/qty*100));
  const full = pct>=100, remain = Math.max(0, qty-done);
  const tone = full ? 'is-full' : pct>=50 ? 'is-mid' : 'is-low';
  return `<div class="kh-prog ${tone}">
    <div class="kh-prog-top">
      <span class="kh-prog-lbl">Số ${unit} đã sản xuất</span>
      <span class="kh-prog-remain">${full ? '✅ Đã đủ' : 'Còn '+remain+' '+unit}</span>
    </div>
    <div class="kh-prog-val"><b>${done}</b><small>/ ${qty} ${unit}</small><em>${pct}%</em></div>
    <div class="kh-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span class="kh-bar-fill" style="width:${pct}%"></span></div>
    ${o.progressNote ? `<div class="kh-prog-note">📋 ${o.progressNote}</div>` : ''}
  </div>`;
}
