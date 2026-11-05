// src/modules/dashboard/dashboard-widgets.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────



// Xây dựng khối phân tích biểu đồ cho Dashboard


// Bảng KPI tiến độ kế hoạch vs thực tế (dạng thanh ngang nhiều màu)
function buildKpiTrackPanel(orders){
  const total = orders.length;
  if(!total) return '';
  const now = Date.now();
  const done = orders.filter(o=>o.status==='done');
  // Tiến độ kế hoạch: % đơn đã tới/qua hạn giao (đáng lẽ phải xong tính đến hôm nay)
  const withDue = orders.filter(o=>o.deliveryDate);
  const shouldBeDone = withDue.filter(o=>new Date(o.deliveryDate).getTime()<=now).length;
  const planPct = withDue.length ? Math.round(shouldBeDone/withDue.length*100) : 0;
  // Tiến độ thực tế: % đơn đã hoàn thành / tổng
  const actualPct = Math.round(done.length/total*100);
  // Chênh lệch tiến độ = thực tế - kế hoạch
  const diff = actualPct - planPct;
  // Tỷ lệ đúng hạn trong số đơn đã hoàn thành
  const doneOnTime = done.filter(o=>!o.deliveryDate || o.doneAt<=new Date(o.deliveryDate).getTime()+86400000).length;
  const onTimePct = done.length ? Math.round(doneOnTime/done.length*100) : 100;

  const rows = [
    {lbl:'Tiến độ kế hoạch', pct:planPct, color:'linear-gradient(90deg,#3b82f6,#2563eb)', sub:`${shouldBeDone}/${withDue.length} đơn tới hạn`},
    {lbl:'Tiến độ thực tế', pct:actualPct, color:'linear-gradient(90deg,#f59e0b,#d97706)', sub:`${done.length}/${total} đơn xong`},
    {lbl:'Chênh lệch tiến độ', pct:Math.min(100,Math.abs(diff)), color: diff>=0?'linear-gradient(90deg,#10b981,#059669)':'linear-gradient(90deg,#ef4444,#dc2626)',
      sub: diff>=0?`▲ Vượt tiến độ ${diff}%`:`▼ Chậm tiến độ ${Math.abs(diff)}%`, big:`${diff>=0?'+':''}${diff}%`, bigColor: diff>=0?'var(--green-m)':'var(--red-m)'},
    {lbl:'Tỷ lệ đúng hạn', pct:onTimePct, color:'linear-gradient(90deg,#8b5cf6,#7c3aed)', sub:`${doneOnTime}/${done.length||0} đơn giao đúng hạn`},
  ];

  return `<div class="kpi-track-card">
    <div class="kpi-track-card-title">🎯 KPI tiến độ sản xuất</div>
    ${rows.map(r=>{
      const tipVal = (r.big!==undefined?r.big:r.pct+'%');
      const tipHtml = (r.lbl+': <b>'+tipVal+'</b> — '+r.sub).replace(/'/g,"&#39;");
      return `
      <div class="kpi-track-row" style="cursor:pointer" onmouseenter="ctShow(event,'${tipHtml}')" onmousemove="ctMove(event)" onmouseleave="ctHide()" ontouchstart="ctShow(event,'${tipHtml}')">
        <div class="kpi-track-lbl">${r.lbl}</div>
        <div class="kpi-track-bar"><div class="kpi-track-fill" style="width:${Math.max(3,r.pct)}%;background:${r.color}"></div></div>
        <div class="kpi-track-val">
          <b style="color:${r.bigColor||'var(--text)'}">${r.big!==undefined?r.big:r.pct+'%'}</b>
          <small style="color:${r.bigColor?r.bigColor:'var(--text4)'}">${r.sub}</small>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ════════════════════════════════════════════════════════════════
// DASHBOARD ĐIỀU HÀNH THÔNG MINH — helpers
// ════════════════════════════════════════════════════════════════

// Mức độ nghiêm trọng của 1 công đoạn dựa trên các đơn đang nằm ở đó:
// 'g' xanh (ổn) → 'y' vàng (đang dồn) → 'o' cam (cảnh báo) → 'r' đỏ (nghẽn/nguy cấp)
function pipeSeverityByOrders(list){
  if(!list.length) return 'g';
  let hasCrit=false, hasWarn=false;
  list.forEach(o=>{
    const ai = aiAnalyzeOrder(o);
    if(ai.urgencyTag==='overdue'||ai.urgencyTag==='critical') hasCrit=true;
    else if(ai.urgencyTag==='warning') hasWarn=true;
  });
  if(hasCrit) return 'r';
  if(hasWarn) return 'o';
  if(list.length>=4) return 'y';
  return 'g';
}
function pipeSeverityByCount(n){
  if(n===0) return 'g';
  if(n<=3) return 'g';
  if(n<=6) return 'y';
  if(n<=10) return 'o';
  return 'r';
}

// Sơ đồ dây chuyền: Đùn → Rút → Cắt → Đánh bóng → Kho


// Danh sách cảnh báo thông minh, gộp từ nhiều nguồn dữ liệu thật của hệ thống
function buildSmartAlerts(orders){
  const alerts = []; // {sev:'r'|'o'|'y', icon, text, action}
  const now = Date.now();

  // 1) Máy hỏng
  if(typeof MACHINES!=='undefined' && typeof machineStatus==='function'){
    MACHINES.filter(m=>machineStatus(m.id)==='hong').forEach(m=>{
      alerts.push({sev:'r', icon:'🛑', text:`<b>${m.name}</b> đang hỏng — cần sửa chữa gấp`, action:"goTab('baoTriMay')"});
    });
    // 2) Máy tới hạn/cận hạn bảo trì theo sản lượng (tấn)
    if(typeof getMaintTonState==='function'){
      MACHINES.forEach(m=>{
        const st = getMaintTonState(m.id);
        if(st && st.level==='due') alerts.push({sev:'o', icon:'🧰', text:`<b>${m.name}</b> đã đạt mốc cần thay ${st.info.partName.toLowerCase()} (${st.tonNow}${st.info.unit})`, action:"goTab('baoTriMay')"});
        else if(st && st.level==='warn') alerts.push({sev:'y', icon:'🧰', text:`<b>${m.name}</b> sắp tới hạn thay ${st.info.partName.toLowerCase()} (${st.tonNow}${st.info.unit})`, action:"goTab('baoTriMay')"});
      });
    }
  }

  // 3) Công đoạn ùn tắc (nhiều đơn dồn ở 1 công đoạn)
  const activeOrders = orders.filter(o=>o.status==='running'||o.status==='cutting');
  const stageGroups = [
    {label:'Máy Đùn', list: activeOrders.filter(o=>o.status==='running'&&(!o.stage||o.stage==='dun'))},
    {label:'Máy Rút', list: activeOrders.filter(o=>o.status==='running'&&o.stage==='rut')},
    {label:'Cắt',      list: activeOrders.filter(o=>o.status==='cutting')},
    {label:'Đánh bóng',list: activeOrders.filter(o=>o.status==='running'&&o.stage==='danhbong')}
  ];
  stageGroups.forEach(g=>{
    if(g.list.length>=4) alerts.push({sev:'o', icon:'🚧', text:`Công đoạn <b>${g.label}</b> đang dồn <b>${g.list.length} đơn</b> — cân nhắc bổ sung nhân lực/tăng ca`, action:"goTab('keHoach')"});
  });

  // 4) Đơn quá hạn giao — dùng CHUNG ddOverdue() để khớp đúng với số liệu
  // ở tab Đơn Hàng/Kế hoạch SX, và trỏ sang Kế hoạch SX kèm bộ lọc "Trễ tiến độ"
  const overdueList = orders.filter(ddOverdue);
  if(overdueList.length){
    alerts.push({sev:'r', icon:'🔥', text:`<b>${overdueList.length} đơn đã quá hạn giao</b>: ${overdueList.slice(0,3).map(o=>o.customer||'—').join(', ')}${overdueList.length>3?'…':''}`, action:"goToKeHoachFilter('overdue')"});
  }

  // 5) Đơn có nguy cơ trễ (chạy quá lâu / sắp tới hạn), lấy tối đa 4 đơn nổi bật nhất
  const riskyOrders = activeOrders
    .map(o=>({o, ai:aiAnalyzeOrder(o)}))
    .filter(x=>x.ai.urgencyTag==='critical'||x.ai.urgencyTag==='warning')
    .sort((a,b)=>b.ai.score-a.ai.score)
    .slice(0,4);
  riskyOrders.forEach(({o,ai})=>{
    alerts.push({sev: ai.urgencyTag==='critical'?'r':'o', icon: ai.oneLine?.icon||'⚠️', text:`<b>${o.customer||'—'}</b> · ${ai.oneLine?.msg||'có nguy cơ trễ tiến độ'}`, action:`goToOrderInPlan('${o.id}')`});
  });

  const order = {r:0,o:1,y:2};
  alerts.sort((a,b)=>order[a.sev]-order[b.sev]);
  return alerts.slice(0,8);
}



// Danh sách đơn hàng ưu tiên xử lý (quá hạn, gấp, chạy lâu) — gộp AI-sort



// Đề xuất của "AI Quản đốc" — gộp insight sẵn có + gợi ý hành động theo máy/công đoạn
function buildForemanSuggestions(orders){
  const sug = [];
  if(typeof MACHINES!=='undefined' && typeof machineStatus==='function'){
    MACHINES.filter(m=>machineStatus(m.id)==='hong').forEach(m=>{
      const sameGroup = MACHINES.find(x=>x.group===m.group && x.id!==m.id && machineStatus(x.id)==='ok');
      sug.push({icon:'🔀', text: sameGroup
        ? `<b>${m.name}</b> đang hỏng — đề xuất chuyển đơn sang <b>${sameGroup.name}</b> để không gián đoạn tiến độ`
        : `<b>${m.name}</b> đang hỏng và chưa có máy cùng nhóm rảnh — cần ưu tiên sửa chữa hoặc điều tiết lịch chạy`});
    });
  }
  const activeOrders = orders.filter(o=>o.status==='running'||o.status==='cutting');
  const stageGroups = [
    {label:'Máy Đùn', list: activeOrders.filter(o=>o.status==='running'&&(!o.stage||o.stage==='dun'))},
    {label:'Máy Rút', list: activeOrders.filter(o=>o.status==='running'&&o.stage==='rut')},
    {label:'Cắt',      list: activeOrders.filter(o=>o.status==='cutting')},
    {label:'Đánh bóng',list: activeOrders.filter(o=>o.status==='running'&&o.stage==='danhbong')}
  ];
  stageGroups.forEach(g=>{
    if(g.list.length>=4) sug.push({icon:'👷', text:`Công đoạn <b>${g.label}</b> đang dồn ${g.list.length} đơn — đề xuất bổ sung nhân lực hoặc tăng ca để giải phóng điểm nghẽn`});
  });
  const overdueList = orders.filter(ddOverdue);
  if(overdueList.length) sug.push({icon:'⏫', text:`Có <b>${overdueList.length} đơn quá hạn</b> — đề xuất ưu tiên xử lý ngay trước các đơn khác`});
  return sug;
}

// ── NHÂN LỰC HÔM NAY: tổng người lao động / phân bố theo ca / đang nghỉ ──
// Gộp dữ liệu từ tất cả các bộ phận trong Lịch làm việc (DB.lichLamViec),
// dùng đúng logic ca (llvShiftKey) và đúng logic dò nghỉ phép đang hiệu lực
// (llvActiveLeave) đã có sẵn ở tab Lịch làm việc, để 2 nơi luôn khớp số liệu.
function buildWorkforceData(){
  const sheets = DB.lichLamViec || [];
  let totalWorkers = 0;
  const shiftCounts = {ca1:0,ca2:0,ca3:0,hc:0,tangca:0,nghi:0,khac:0};
  const onLeaveMap = new Map();
  const noShiftMap = new Map(); // người có ca = "Nghỉ (không xếp ca)"
  sheets.forEach(sheet=>{
    (sheet.rows||[]).forEach(r=>{
      if(!r.name || !r.name.trim()) return;
      totalWorkers++;
      const k = (typeof llvShiftKey==='function') ? llvShiftKey(r.time) : 'khac';
      shiftCounts[k] = (shiftCounts[k]||0)+1;
      const key = r.name.trim().toLowerCase();
      if(k==='nghi') noShiftMap.set(key, {name:r.name});
      const leaveRec = (typeof llvActiveLeave==='function') ? llvActiveLeave(r.name, null, sheet) : null;
      if(leaveRec){
        onLeaveMap.set(key, {name:r.name, loai:leaveRec.loai, toDate:leaveRec.toDate});
      }
    });
  });
  const pendingLeave = (DB.nghiPhep||[]).filter(k=>k.status==='Chờ duyệt').length;
  // Đang làm việc = tổng − (đang nghỉ phép ∪ nghỉ không xếp ca), gộp trùng theo tên
  const offDutySet = new Set([...onLeaveMap.keys(), ...noShiftMap.keys()]);
  const workingCount = Math.max(0, totalWorkers - offDutySet.size);
  return { totalWorkers, shiftCounts, onLeaveList:[...onLeaveMap.values()], noShiftCount: noShiftMap.size, offDutyCount: offDutySet.size, workingCount, pendingLeave, sheetsCount: sheets.length };
}



// Panel riêng cho Người lao động: chỉ hiện những gì họ cần biết trong ngày
// → Theo yêu cầu, ĐÃ TẮT ô "Hôm nay của bạn" trên Tổng quan của tài khoản
// nhân viên (return '' ngay từ đầu). Giữ nguyên phần code bên dưới (không
// xoá) để dễ bật lại sau này nếu cần, chỉ cần bỏ dòng return '' này đi.
function buildWorkerTodayPanel(orders){
  return '';
  if(!currentUser || currentUser.role!=='staff') return '';
  const today0 = new Date(); today0.setHours(0,0,0,0);
  const runningCount = orders.filter(o=>o.status==='running'||o.status==='cutting').length;
  const doneTodayArr = orders.filter(o=>o.status==='done'&&(o.doneAt||0)>=today0.getTime());
  const kgToday = doneTodayArr.reduce((s,o)=>s+(parseFloat(o.kg)||0),0).toFixed(1);

  let congTxt = '—';
  try{
    const ym = curYM ? curYM() : todayStr().slice(0,7);
    const day = new Date().getDate();
    const worker = (DB.workers||[]).find(w=>w.name && currentUser.name && w.name.trim().toLowerCase()===currentUser.name.trim().toLowerCase());
    const v = worker ? (DB.attendance?.[ym]?.[worker.id]?.[day]) : undefined;
    congTxt = (v!==undefined && v!=='') ? v+' công' : 'Chưa chấm công';
  }catch(e){ congTxt = '—'; }

  return `<div class="worker-today">
    <div class="worker-today-title">👷 Hôm nay của bạn · ${fmtDate(todayStr())}</div>
    <div class="worker-today-grid">
      <div class="worker-today-item"><div class="worker-today-val">${congTxt}</div><div class="worker-today-lbl">✅ Ca làm</div></div>
      <div class="worker-today-item"><div class="worker-today-val">${runningCount} đơn</div><div class="worker-today-lbl">✅ Đơn đang chạy</div></div>
      <div class="worker-today-item"><div class="worker-today-val">${doneTodayArr.length} đơn · ${kgToday}kg</div><div class="worker-today-lbl">✅ Sản lượng đã làm</div></div>
    </div>
  </div>`;
}
