// src/modules/orders/orders-cards.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Cuộn đúng tới thẻ đơn vừa cập nhật (thay vì nhảy lên đầu trang) và làm nổi bật để dễ nhận ra
function goToOrderCard(orderId){
  if(!orderId) return;
  setTimeout(()=>{
    const el = document.querySelector(`[data-order-id="${orderId}"]`);
    if(!el) return;
    el.scrollIntoView({behavior:'smooth', block:'center'});
    el.classList.add('flash-highlight');
    setTimeout(()=>el.classList.remove('flash-highlight'), 2000);
  }, 60);
}

// ════ AI WARNING BLOCK — hiện trong mọi card mọi tab ═══════
// Gộp thông minh tất cả tín hiệu (thời gian chạy, tiến độ, hạn giao) thành
// ĐÚNG 1 DÒNG duy nhất/đơn — tránh xếp chồng nhiều dòng gây rối mắt.
function renderAIWarn(o){
  const s = o.status==='cutting'?'running':o.status;
  if(s==='done') return ''; // Đơn xong không cần cảnh báo

  const ai = aiAnalyzeOrder(o);
  if(!ai.oneLine) return '';

  const cls = ai.oneLine.level==='red'?'critical':'warning';
  return `<div class="ai-card-warn"><div class="ai-card-warn-row ${cls}${ai.critical?' ai-card-warn-jump':''}">
      <span class="ai-card-warn-ico">${ai.oneLine.icon}</span>
      <span class="ai-card-warn-txt">${ai.oneLine.msg}</span>
      ${ai.critical?'<span class="ai-card-warn-jumptag">AI ưu tiên</span>':''}
    </div></div>`;
}

// Helper hiển thị progress bar — số lượng đã sản xuất (thanh hoặc cuộn)
function renderProgressBar(o){
  const qty=o.qty||0; const done=o.doneQty||0;
  if(!qty||o.status==='pending') return '';
  const unit = o.isCoil ? 'cuộn' : (o.isRound?'cây':'thanh');
  const pct=Math.min(100,Math.round(done/qty*100));
  const remain=Math.max(0,qty-done);
  const isDone=pct>=100;
  const color=isDone?'var(--green-m)':pct>=50?'var(--brand3)':'var(--amber-m)';
  const bg=isDone?'#f0fdf4':pct>=50?'#eff6ff':'#fffbeb';
  const remainBg=isDone?'#dcfce7':'#fef3c7';
  const remainColor=isDone?'#166534':'#92400e';
  return `<div class="card-progress">
    <div class="card-progress-box" style="background:${bg}">
      <div class="card-progress-icon" style="background:${color}20;color:${color}">📊</div>
      <div class="card-progress-info">
        <div class="card-progress-lbl">Số ${unit} đã sản xuất</div>
        <div class="card-progress-val" style="color:${color}">${done}<small>/ ${qty} ${unit}</small></div>
      </div>
      <div class="card-progress-remain" style="background:${remainBg};color:${remainColor}">${isDone?'✅ Đã đủ':'Còn '+remain+' '+unit}</div>
    </div>
    ${o.progressNote?`<div style="margin-top:5px;padding:5px 8px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-left:3px solid var(--brand);border-radius:0 6px 6px 0;display:flex;align-items:flex-start;gap:5px">
      <span style="font-size:11px;flex-shrink:0">📋</span>
      <span style="font-size:10.5px;font-weight:700;color:#1e3a8a;line-height:1.4">${o.progressNote}</span>
    </div>`:''}
  </div>`;
}

// ── Tiến độ công đoạn: Máy Đùn -> Máy Rút -> Đánh Bóng ──
function renderStageTracker(o, clickable){
  const s = o.status==='cutting'?'running':o.status;
  if(s==='pending') return ''; // chưa chạy thì chưa có công đoạn
  const curIdx = STAGES.findIndex(x=>x.key===o.stage);
  const activeIdx = s==='done' ? STAGES.length : (curIdx<0?0:curIdx);
  const pct = Math.round((activeIdx/STAGES.length)*100);
  return `<div class="stage-tracker">
    <div class="stage-tracker-hd">
      <span class="stage-tracker-lbl">🏭 Công đoạn sản xuất</span>
      <span class="stage-tracker-pct${s==='done'?' is-done':''}">${s==='done'?'✓ Hoàn tất':pct+'%'}</span>
    </div>
    <div class="stage-steps">
      ${STAGES.map((st,i)=>{
        const state = i<activeIdx ? 'st-done' : (i===activeIdx&&s!=='done' ? 'st-active' : 'st-todo');
        const canClick = clickable && s!=='done';
        return `${i>0?`<div class="stage-line${i<=activeIdx?' done':''}"></div>`:''}
        <div class="stage-step ${state}" data-clickable="${canClick?1:0}" ${canClick?`onclick="event.stopPropagation();requestSetStage('${o.id}','${st.key}')"`:''} title="${st.label}">
          <div class="stage-dot">${state==='st-done'?'✓':st.icon}</div>
          <div class="stage-name">${st.label}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// Badge gọn hiển thị công đoạn hiện tại (dùng ở mini-card dashboard)

// Bấm vào bước công đoạn → HỎI XÁC NHẬN trước khi đổi. Trước đây 1 lần chạm
// nhầm trên màn hình cảm ứng ở xưởng đã nhảy thẳng sang công đoạn khác và
// NHẢ (xoá) máy đã gán của các công đoạn trước — người dùng thấy Đùn/Rút
// quay về "— Chưa gán —" mà không hiểu vì sao.
function requestSetStage(id, stage){
  if(guardViewer()) return;
  const o = DB.orders.find(x=>x.id===id); if(!o || !isStaff()) return;
  const cur = o.stage || 'dun';
  if(cur===stage) return;
  const ci = assignStageIndex(cur), ni = assignStageIndex(stage);
  const rel = [];
  if(ni>0) ASSIGN_STAGES.slice(0,ni).forEach(s=>{
    const mid = o.machineAssign && o.machineAssign[s.key];
    if(mid) rel.push(`${s.label}: ${machineById(mid)?.name||mid}`);
  });
  let msg = `Chuyển đơn "${o.customer||''}" từ ${STAGE_LABEL[cur]||cur} sang ${STAGE_LABEL[stage]||stage}?`;
  if(ni-ci>1) msg += ` Đơn sẽ BỎ QUA ${ni-ci-1} công đoạn ở giữa.`;
  if(ni<ci) msg += ' Đây là quay LẠI công đoạn trước.';
  if(rel.length && ni>ci) msg += ` Máy các công đoạn đã qua sẽ được nhả (vẫn lưu lịch sử): ${rel.join(', ')}.`;
  confirm2('Chuyển công đoạn?', msg, ()=>setStage(id, stage));
}

function setStage(id, stage){if(guardViewer())return;
  withPlanLock(id, ()=>{
    // CHỈ CẬP NHẬT bản ghi đơn hàng đã có theo id — KHÔNG tạo bản ghi mới,
    // KHÔNG đổi id của đơn.
    const o = DB.orders.find(x=>x.id===id); if(!o) return;
    if(!isStaff()) return;
    const old = o.stage;
    if(old===stage) return;

    // SỬA LỖI GỐC (đơn chờ tiếp theo kẹt vĩnh viễn dù máy cũ đã trống thật):
    // TRƯỚC ĐÂY nếu máy của công đoạn MỚI đang bận đơn khác, hàm này CHẶN
    // LUÔN toàn bộ thao tác chuyển công đoạn (return sớm, không đổi o.stage,
    // không nhả máy công đoạn cũ) — khiến máy công đoạn CŨ (VD Đùn) không
    // bao giờ được nhả ra, nên đơn đang xếp hàng sẵn ở máy cũ (VD "B") bị
    // kẹt mãi mãi, kể cả sau này máy công đoạn mới đã trống cũng không có
    // gì gọi lại để thử tiếp cho đơn này.
    //
    // NAY: đơn LUÔN được phép sang công đoạn mới VÀ máy công đoạn cũ LUÔN
    // được nhả ngay (không phụ thuộc máy công đoạn mới bận hay rảnh) — đúng
    // với thực tế: đơn đã thực sự rời khỏi máy cũ rồi. Nếu máy công đoạn mới
    // đang bận, đơn chỉ đơn giản trở thành "ĐƠN CHẠY TIẾP" (đang xếp hàng)
    // của máy đó — không được đánh dấu "đang chạy" (machineActiveAt) — nên
    // không xảy ra 2 đơn cùng "đang chạy" 1 máy; và khi máy đó trống ra (dù
    // do bất kỳ đơn nào khác hoàn thành), promoteQueuedOrderToRunning() vẫn
    // tìm thấy đúng đơn này trong hàng đợi và tự đẩy lên RUNNING (đã sửa để
    // không còn bỏ qua đơn có status='running' — xem promoteQueuedOrderToRunning).
    o.stage = stage;
    const releasedIds = dhReleaseEarlierMachines(o, stage);
    const releasedNames = releasedIds.map(mid=>machineById(mid)?.name||mid);

    const newMachineId = o.machineAssign ? o.machineAssign[stage] : '';
    let queuedToast = '';
    if(newMachineId){
      const busy = dhOrderAtMachine(newMachineId);
      if(busy && busy.id!==o.id){
        queuedToast = `🕐 ${machineById(newMachineId)?.name||'Máy'} đang chạy đơn ${ddCode(busy)} (${busy.customer||''}) — ${o.customer||''} sẽ tự động chạy tiếp khi máy trống`;
      } else {
        // Máy công đoạn mới đang trống → xác nhận đơn này đang chạy thật
        // tại đó NGAY, không cần đợi 1 lượt promote riêng.
        dhMarkActiveAtMachine(o, stage, newMachineId);
      }
    }

    log('Cập nhật công đoạn', `${o.customer||''} · ${STAGE_LABEL[stage]||stage}${releasedNames.length?` · Nhả máy: ${releasedNames.join(', ')}`:''}`, id, {stage:old||''}, {stage});
    renderTab(currentTab);
    refreshKhDetailIfOpen(id); // panel chi tiết (nếu đang mở đúng đơn) cập nhật ngay, không cần đóng/mở lại
    goToOrderCard(id);
    showToast(queuedToast || `🏭 Công đoạn: ${STAGE_LABEL[stage]||stage}`);
    saveOrders(); // ghi Database + đồng bộ Realtime ngay

    // AUTO DISPATCH (mục 11): máy (hoặc các máy) vừa được nhả ra ở trên có
    // thể đang có đơn khác xếp hàng sẵn — đẩy dây chuyền domino, không cần
    // thao tác thủ công.
    releasedIds.forEach(mid=>promoteQueuedOrderToRunning(mid));
  });
}
