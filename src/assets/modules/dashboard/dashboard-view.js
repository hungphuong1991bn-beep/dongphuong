// src/modules/dashboard/dashboard-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Header trên cùng của Tổng quan: chỉ tiêu đề + làm mới (page-specific).
// Ngày/giờ, thông báo, tài khoản KHÔNG lặp lại ở đây nữa — đã có sẵn và
// dùng chung DUY NHẤT ở Global Header (topbar) cho mọi tab.


// Hàng 6 thẻ KPI tổng quan
function buildOvKpis(orders){
  const total = orders.length;
  const running = orders.filter(o=>o.status==='running'||o.status==='cutting').length;
  const overdue = orders.filter(ddOverdue).length;
  const totalKg = orders.reduce((s,o)=>s+(parseFloat(o.kg)||0),0);
  const runningKg = orders.filter(o=>o.status==='running'||o.status==='cutting').reduce((s,o)=>s+(parseFloat(o.kg)||0),0);
  const today0 = new Date(); today0.setHours(0,0,0,0);
  const yesterday0 = today0.getTime()-86400000;
  const todayOrders = orders.filter(o=>(o.createdAt||0)>=today0.getTime()).length;
  const doneOrdersArr = orders.filter(o=>o.status==='done');
  const doneToday = doneOrdersArr.filter(o=>(o.doneAt||0)>=today0.getTime()).length;
  const doneYesterday = doneOrdersArr.filter(o=>(o.doneAt||0)>=yesterday0 && (o.doneAt||0)<today0.getTime()).length;
  const doneDelta = doneYesterday ? Math.round((doneToday-doneYesterday)/doneYesterday*100) : (doneToday>0?100:0);
  const doneOnTime = doneOrdersArr.filter(o=>!o.deliveryDate||o.doneAt<=new Date(o.deliveryDate).getTime()+86400000).length;
  const hieuSuat = doneOrdersArr.length ? Math.round(doneOnTime/doneOrdersArr.length*100) : 100;
  const todayEndTs = new Date(new Date().toDateString()).getTime() + 86400000;
  const withDue = orders.filter(o=>o.deliveryDate);
  const shouldBeDoneNow = withDue.filter(o=>new Date(o.deliveryDate).getTime()<todayEndTs).length;
  const shouldBeDoneAndDone = withDue.filter(o=>new Date(o.deliveryDate).getTime()<todayEndTs && o.status==='done').length;
  const planPct = shouldBeDoneNow ? Math.round(shouldBeDoneAndDone/shouldBeDoneNow*100) : 100;

  const cards = [
    {ic:'📈', bg:'var(--purple-l)', col:'var(--purple-m)', lbl:'Tổng đơn hàng', val:total, delta:`+${todayOrders} đơn mới hôm nay`, dcls:todayOrders>0?'up':'flat', click:"goToDorDangAll()"},
    {ic:'▶️', bg:'#dbeafe', col:'var(--brand2)', lbl:'Đang sản xuất', val:running, delta:`${total?Math.round(running/total*100):0}% tổng đơn`, dcls:'flat', click:"goToKeHoachFilter('running')"},
    {ic:'✅', bg:'var(--green-l)', col:'var(--green)', lbl:'Hoàn thành hôm nay', val:doneToday, delta:`${doneDelta>=0?'+':''}${doneDelta}% so với hôm qua`, dcls:doneDelta>=0?'up':'warn', click:"goToDorDangToday()"},
    {ic:'⏰', bg:'var(--red-l)', col:'var(--red-m)', lbl:'Trễ tiến độ', val:overdue, delta:`${total?Math.round(overdue/total*100):0}% tổng đơn`, dcls:overdue>0?'warn':'flat', click:"goToKeHoachFilter('overdue')"},
    {ic:'💼', bg:'var(--pink-l)', col:'var(--pink-m)', lbl:'Tổng khối lượng', val:ovFmtKg(totalKg)+' kg', delta:`${ovFmtKg(runningKg)}kg đang sản xuất`, dcls:'flat', click:"goToDorDangAll()"},
    {ic:'🎯', bg:'var(--cyan-l)', col:'var(--cyan-m)', lbl:'Hiệu suất chung', val:hieuSuat+'%', delta:`Tiến độ kế hoạch ${planPct}%`, dcls:planPct>=80?'up':'flat', click:"toggleDashMore()"}
  ];
  return `<div class="ov-kpi-grid">${cards.map(c=>`
    <div class="ov-kpi-card" onclick="${c.click}">
      <div class="ov-kpi-top">
        <div class="ov-kpi-ic" style="background:${c.bg};color:${c.col}">${c.ic}</div>
        <div class="ov-kpi-lbl">${c.lbl}</div>
      </div>
      <div class="ov-kpi-val">${c.val}</div>
      <div class="ov-kpi-delta ${c.dcls}">${c.dcls==='up'?'↑ ':''}${c.delta}</div>
    </div>`).join('')}</div>`;
}

// Sơ đồ hiệu suất theo công đoạn (Máy Đùn → Máy Rút → Đánh Bóng → Cắt)
function buildOvStageFlow(orders){
  const flowBase = orders.filter(o=>o.status!=='pending');
  const totalFlow = flowBase.length || 1;
  const nodes = STAGES.map((s,i)=>{
    const passed = flowBase.filter(o=>{
      if(o.status==='done') return true;
      const oi = STAGES.findIndex(x=>x.key===(o.stage||'dun'));
      return oi>=i;
    }).length;
    const pct = Math.round(passed/totalFlow*100);
    const cls = pct>=100 ? 'ovdone' : (pct>0 ? 'ovactive' : 'ovpending');
    const icon = pct>=100 ? '✓' : s.icon;
    return {label:s.label, pct, cls, icon, passed};
  });
  const html = nodes.map((n,i)=>`
    <div class="ov-flow-node">
      <div class="ov-flow-circle ${n.cls}">${n.icon}</div>
      <div class="ov-flow-lbl">${n.label}</div>
      <div class="ov-flow-pct">${n.pct}%</div>
      <div class="ov-flow-sub">${n.passed} / ${totalFlow} thành</div>
    </div>
    ${i<nodes.length-1?'<div class="ov-flow-connector"></div>':''}
  `).join('');
  return `<div class="ov-flow">${html}</div>`;
}

// Biểu đồ đường: hiệu suất giao hàng đúng hạn theo 7 ngày gần nhất
function buildOvDailyChart(orders){
  const days = [];
  for(let i=6;i>=0;i--){
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
    const dayEndTs = d.getTime()+86400000;
    const withDue = orders.filter(o=>o.deliveryDate && new Date(o.deliveryDate).getTime()<dayEndTs);
    let val = null;
    if(withDue.length){
      const onTime = withDue.filter(o=>o.status==='done' && o.doneAt && o.doneAt<dayEndTs).length;
      val = Math.round(onTime/withDue.length*100);
    }
    days.push({d, val});
  }
  // Điền giá trị còn thiếu bằng giá trị gần nhất trước đó để đường liền mạch
  let lastVal = 100;
  days.forEach(x=>{ if(x.val===null) x.val = lastVal; else lastVal = x.val; });

  const w=520,h=150,padL=28,padR=8,padT=14,padB=22;
  const stepX = days.length>1 ? (w-padL-padR)/(days.length-1) : 0;
  const yFor = v => padT + (1-Math.max(0,Math.min(100,v))/100)*(h-padT-padB);
  const xFor = i => padL + i*stepX;
  const linePts = days.map((x,i)=>`${xFor(i).toFixed(1)},${yFor(x.val).toFixed(1)}`).join(' ');
  const areaPts = `${padL},${h-padB} ${linePts} ${xFor(days.length-1).toFixed(1)},${h-padB}`;
  const gridLines = [0,25,50,75,100].map(v=>`<line x1="${padL}" y1="${yFor(v).toFixed(1)}" x2="${w-padR}" y2="${yFor(v).toFixed(1)}" stroke="#EEF1F6" stroke-width="1"/>
    <text x="4" y="${(yFor(v)+3).toFixed(1)}" font-size="9" fill="#9096A5">${v}</text>`).join('');
  const dots = days.map((x,i)=>{
    const cx=xFor(i).toFixed(1), cy=yFor(x.val).toFixed(1);
    const tip = (fmtDate(x.d.toISOString())+': <b>'+x.val+'%</b>').replace(/'/g,"&#39;");
    return `<circle class="ov-chart-tooltip-dot" cx="${cx}" cy="${cy}" r="3.4" fill="#2856D6" stroke="#fff" stroke-width="1.5"
      onmouseenter="ctShow(event,'${tip}')" onmousemove="ctMove(event)" onmouseleave="ctHide()" ontouchstart="ctShow(event,'${tip}')"/>`;
  }).join('');
  const lastLbl = `<text x="${xFor(days.length-1).toFixed(1)}" y="${(yFor(days[days.length-1].val)-8).toFixed(1)}" font-size="11" font-weight="700" fill="#2856D6" text-anchor="end">${days[days.length-1].val}%</text>`;
  const xLabels = days.map((x,i)=>`<text x="${xFor(i).toFixed(1)}" y="${h-6}" font-size="9" fill="#9096A5" text-anchor="middle">${String(x.d.getDate()).padStart(2,'0')}/${String(x.d.getMonth()+1).padStart(2,'0')}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="150" style="display:block;overflow:visible">
    ${gridLines}
    <polygon points="${areaPts}" fill="#2856D6" fill-opacity="0.07"/>
    <polyline points="${linePts}" fill="none" stroke="#2856D6" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${lastLbl}${xLabels}
  </svg>`;
}

// Bảng đơn hàng đang sản xuất
function buildOvProducingTable(orders){
  const active = orders.filter(o=>o.status==='running'||o.status==='cutting')
    .sort((a,b)=>{
      const da = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Infinity;
      const db = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Infinity;
      return da-db;
    }).slice(0,6);
  if(!active.length) return `<div class="ov-empty">✅ Hiện không có đơn nào đang sản xuất</div>`;
  const rows = active.map(o=>{
    const pct = o.qty ? Math.round((o.doneQty||0)/o.qty*100) : 0;
    const stageLbl = STAGE_LABEL[o.stage||'dun'] || 'Máy Đùn';
    let dueHtml = '<span class="ov-due-badge ok">—</span>';
    if(o.deliveryDate){
      const isLate = ddOverdue(o);
      const daysLeft = (new Date(o.deliveryDate)-Date.now())/86400000;
      const cls = isLate ? 'late' : (daysLeft<3 ? 'soon':'ok');
      const lbl = isLate ? 'Trễ hạn' : (daysLeft<3 ? 'Sắp hạn':'Đúng hạn');
      dueHtml = `<span class="ov-due-badge ${cls}">${fmtDate(o.deliveryDate)}</span><div class="ov-progress-txt">${lbl}</div>`;
    }
    return `<tr onclick="goToOrderInPlan('${o.id}')">
      <td><div class="ov-order-cust">${(o.customer||'—').replace(/</g,'&lt;')}</div><div class="ov-order-code">${ddCode(o)}</div></td>
      <td><span class="ov-stage-badge">${stageLbl}</span></td>
      <td><div class="ov-progress-mini"><div class="ov-progress-mini-fill" style="width:${Math.max(2,pct)}%"></div></div><span class="ov-progress-txt">${pct}%</span><div class="ov-progress-txt">${o.doneQty||0} / ${o.qty||0} thành</div></td>
      <td>${dueHtml}</td>
    </tr>`;
  }).join('');
  return `<div class="ov-table-wrap"><table class="ov-table">
    <thead><tr><th>Mã đơn / Khách hàng</th><th>Công đoạn hiện tại</th><th>Tiến độ</th><th>Kế hoạch giao</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// Danh sách cảnh báo & thông báo (dùng lại dữ liệu buildSmartAlerts đã có)
function buildOvAlertsList(orders){
  const alerts = buildSmartAlerts(orders).slice(0,6);
  if(!alerts.length) return `<div class="ov-empty">✅ Không có cảnh báo nào</div>`;
  return alerts.map(a=>{
    const cls = a.sev==='r'?'r':(a.sev==='o'?'o':'b');
    return `<div class="ov-alert-item" onclick="${(a.action||'').replace(/"/g,'&quot;')}">
      <div class="ov-alert-ic ${cls}">${a.icon||'🔔'}</div>
      <div class="ov-alert-txt">${a.text}</div>
    </div>`;
  }).join('');
}

// Nhân lực theo ca hôm nay (dữ liệu thật từ Lịch làm việc)
function buildOvShiftPanel(){
  const wf = buildWorkforceData();
  if(!wf.totalWorkers){
    return `<div class="ov-empty">👥 Chưa có dữ liệu phân ca · vào tab <b>Lịch làm việc</b></div>`;
  }
  const shiftDefs = [
    {k:'ca1', label:'Ca 1 (06:00 - 14:00)'},
    {k:'ca2', label:'Ca 2 (14:00 - 22:00)'},
    {k:'ca3', label:'Ca 3 (22:00 - 06:00)'}
  ];
  const rows = shiftDefs.map(s=>{
    const n = wf.shiftCounts[s.k]||0;
    const pct = wf.totalWorkers ? Math.round(n/wf.totalWorkers*100) : 0;
    return `<div class="ov-shift-row">
      <div class="ov-shift-top"><span>${s.label}</span><span>${pct}%</span></div>
      <div class="ov-shift-bar"><div class="ov-shift-fill" style="width:${Math.max(2,pct)}%"></div></div>
      <div class="ov-progress-txt">${n}/${wf.totalWorkers} người</div>
    </div>`;
  }).join('');
  return `${rows}
    <div class="ov-shift-foot">
      <div class="ov-shift-foot-item"><div class="ov-shift-foot-val">${wf.workingCount}</div><div class="ov-shift-foot-lbl">Đang làm việc</div></div>
      <div class="ov-shift-foot-item"><div class="ov-shift-foot-val">${wf.totalWorkers}</div><div class="ov-shift-foot-lbl">Tổng nhân lực</div></div>
    </div>`;
}

// Biểu đồ cột: khối lượng sản xuất (kg) 7 ngày gần nhất
function buildOvVolumeChart(orders){
  const days = [];
  for(let i=6;i>=0;i--){
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
    const dayEndTs = d.getTime()+86400000;
    const kg = orders.filter(o=>o.status==='done' && (o.doneAt||0)>=d.getTime() && (o.doneAt||0)<dayEndTs)
      .reduce((s,o)=>s+(parseFloat(o.kg)||0),0);
    days.push({d, kg});
  }
  const w=520,h=140,padL=8,padR=8,padT=10,padB=20;
  const max = Math.max(1, ...days.map(x=>x.kg));
  const bw = (w-padL-padR)/days.length*0.55;
  const gap = (w-padL-padR)/days.length;
  const bars = days.map((x,i)=>{
    const bh = Math.max(2, (x.kg/max)*(h-padT-padB));
    const bx = padL + i*gap + (gap-bw)/2;
    const by = h-padB-bh;
    const tip = (String(x.d.getDate()).padStart(2,'0')+'/'+String(x.d.getMonth()+1).padStart(2,'0')+': <b>'+ovFmtKg(x.kg)+'kg</b>').replace(/'/g,"&#39;");
    return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="#2856D6" fill-opacity="${i===days.length-1?1:0.55}"
      onmouseenter="ctShow(event,'${tip}')" onmousemove="ctMove(event)" onmouseleave="ctHide()" ontouchstart="ctShow(event,'${tip}')"/>
      <text x="${(bx+bw/2).toFixed(1)}" y="${h-6}" font-size="9" fill="#9096A5" text-anchor="middle">${String(x.d.getDate()).padStart(2,'0')}/${String(x.d.getMonth()+1).padStart(2,'0')}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="140" style="display:block">${bars}</svg>`;
}

// Hoạt động gần đây (dùng lại nhật ký thao tác thật — actLog)
function buildOvRecentActivity(){
  const list = (typeof actLog!=='undefined' ? actLog : []).slice(0,6);
  if(!list.length) return `<div class="ov-empty">Chưa có hoạt động nào được ghi nhận</div>`;
  return list.map(l=>`
    <div class="ov-activity-item">
      <div class="ov-activity-av">${userInitials(l.user)}</div>
      <div>
        <div class="ov-activity-txt"><b>${(l.user||'?').replace(/</g,'&lt;')}</b> ${(l.action||'').replace(/</g,'&lt;')}${l.detail?' · '+(l.detail+'').replace(/</g,'&lt;').slice(0,60):''}</div>
        <div class="ov-activity-time">${onlineTimeAgo(l.ts)}</div>
      </div>
    </div>`).join('');
}
// Lời chào cá nhân hoá ở đầu tab Tổng quan, tự đổi theo giờ trong ngày
// (sáng/trưa/chiều/tối) và tên tài khoản đang đăng nhập.
function ovGreetingPhrase(){
  const h = new Date().getHours();
  if(h>=5 && h<11) return 'Chào buổi sáng';
  if(h>=11 && h<13) return 'Chào buổi trưa';
  if(h>=13 && h<18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}
function buildOvGreeting(){
  const name = (currentUser && currentUser.name) ? currentUser.name : '';
  const nameHtml = name ? sanitizeDisplayText(name) : 'bạn';
  return `<div class="dash-greet">
    <div>
      <div class="dash-greet-title">${ovGreetingPhrase()}, ${nameHtml}! 👋</div>
      <div class="dash-greet-sub">Chúc bạn một ngày làm việc hiệu quả.</div>
    </div>
  </div>`;
}
function renderDashboard(){
  const orders = DB.orders;
  const total   = orders.length;
  const waiting = orders.filter(o=>o.status==='pending').length;
  const running = orders.filter(o=>o.status==='running'||o.status==='cutting').length;
  const done    = orders.filter(o=>o.status==='done').length;
  const overdue = orders.filter(ddOverdue).length;
  const totalKg = orders.reduce((s,o)=>s+(parseFloat(o.kg)||0),0).toFixed(1);
  const now = Date.now();

  // ══════════ CHỈ SỐ TỔNG QUAN ══════════
  const today0 = new Date(); today0.setHours(0,0,0,0);
  const todayOrders   = orders.filter(o=>(o.createdAt||0)>=today0.getTime()).length;
  const runningKg     = orders.filter(o=>o.status==='running'||o.status==='cutting').reduce((s,o)=>s+(parseFloat(o.kg)||0),0).toFixed(1);
  const doneOrdersArr = orders.filter(o=>o.status==='done');
  const doneToday     = doneOrdersArr.filter(o=>(o.doneAt||0)>=today0.getTime()).length;
  const doneOnTime    = doneOrdersArr.filter(o=>!o.deliveryDate||o.doneAt<=new Date(o.deliveryDate).getTime()+86400000).length;
  const hieuSuat      = doneOrdersArr.length ? Math.round(doneOnTime/doneOrdersArr.length*100) : 100;
  const machineWarn   = (typeof MACHINES!=='undefined' && typeof machineStatus==='function') ? MACHINES.filter(m=>machineStatus(m.id)==='hong').length : 0;
  const maintTonWarn  = (typeof MACHINES!=='undefined' && typeof getMaintTonState==='function') ? MACHINES.filter(m=>{ const s=getMaintTonState(m.id); return s && s.level!=='ok'; }).length : 0;
  const canhBao       = overdue + machineWarn + maintTonWarn;
  setTimeout(checkMaintTonAlerts, 300);

  // Tiến độ kế hoạch trong ngày: % đơn có hạn giao TỪ HÔM NAY TRỞ VỀ TRƯỚC
  // đã hoàn thành. Dùng mốc "hết ngày hôm nay" (không phải giờ hiện tại) để
  // 1 đơn có hạn giao đúng hôm nay được tính suốt cả ngày (không bị tính
  // "trễ hạn" chỉ vì đã qua nửa đêm) — khớp với cách tính quá hạn dùng
  // chung ddOverdue() ở các tab khác.
  const todayEndTs = new Date(new Date().toDateString()).getTime() + 86400000;
  const withDue = orders.filter(o=>o.deliveryDate);
  const shouldBeDoneNow = withDue.filter(o=>new Date(o.deliveryDate).getTime()<todayEndTs).length;
  const shouldBeDoneAndDone = withDue.filter(o=>new Date(o.deliveryDate).getTime()<todayEndTs && o.status==='done').length;
  const planPct = shouldBeDoneNow ? Math.round(shouldBeDoneAndDone/shouldBeDoneNow*100) : 100;

  const insights = aiGetInsights(orders);
  const foremanSug = buildForemanSuggestions(orders);
  const workerPanel = buildWorkerTodayPanel(orders);

  const notifBanner = ('Notification' in window&&Notification.permission!=='granted')
    ? `<div class="notif-bar"><span>🔔</span><p>Bật thông báo nhận đơn mới tức thì</p><button onclick="requestNotif();this.closest('.notif-bar')?.remove()">Bật</button></div>` : '';

  $('mc').innerHTML=`
    <div class="ov-wrap">
      ${buildOvGreeting()}
      ${notifBanner}
      <div id="onlineEl"></div>
      ${workerPanel}

      ${buildOvKpis(orders)}

      <div class="ov-row3">
        <div class="ov-panel">
          <div class="ov-panel-title">🔗 Hiệu suất theo công đoạn <span class="ov-sub2">(hôm nay)</span></div>
          ${buildOvStageFlow(orders)}
        </div>
        <div class="ov-panel">
          <div class="ov-panel-title">📈 Hiệu suất theo ngày <span class="ov-sub2">(7 ngày gần nhất)</span></div>
          ${buildOvDailyChart(orders)}
        </div>
        <div class="ov-panel">
          <div class="ov-panel-title">🍩 Tỷ lệ trạng thái đơn hàng</div>
          ${buildDashboardStatusDonut(orders)}
        </div>
      </div>

      <div class="ov-row2">
        <div class="ov-panel">
          <div class="ov-panel-title">📦 Đơn hàng đang sản xuất <button class="ov-see-all" onclick="goToKeHoachFilter('running')">Xem tất cả →</button></div>
          ${buildOvProducingTable(orders)}
        </div>
        <div class="ov-panel">
          <div class="ov-panel-title">🚨 Cảnh báo &amp; thông báo <button class="ov-see-all" onclick="scrollToSmartAlerts()">Xem tất cả →</button></div>
          ${buildOvAlertsList(orders)}
        </div>
        <div class="ov-panel">
          <div class="ov-panel-title">👥 Nhân lực theo ca <span class="ov-sub2">(hôm nay)</span></div>
          ${buildOvShiftPanel()}
        </div>
      </div>

      <div class="ov-row-bottom">
        <div class="ov-panel">
          <div class="ov-panel-title">⚖️ Khối lượng sản xuất (kg)</div>
          ${(function(){
            const today0=new Date(); today0.setHours(0,0,0,0);
            const yest0=today0.getTime()-86400000;
            const done=orders.filter(o=>o.status==='done');
            const kgToday=done.filter(o=>(o.doneAt||0)>=today0.getTime()).reduce((s,o)=>s+(parseFloat(o.kg)||0),0);
            const kgYest=done.filter(o=>(o.doneAt||0)>=yest0&&(o.doneAt||0)<today0.getTime()).reduce((s,o)=>s+(parseFloat(o.kg)||0),0);
            const kgWeek=done.filter(o=>(o.doneAt||0)>=today0.getTime()-6*86400000).reduce((s,o)=>s+(parseFloat(o.kg)||0),0);
            const delta = kgYest ? Math.round((kgToday-kgYest)/kgYest*100) : (kgToday>0?100:0);
            return `<div class="ov-vol-stats">
              <div><div class="ov-vol-stat-lbl">Hôm nay</div><div class="ov-vol-stat-val">${ovFmtKg(kgToday)} kg</div><div class="ov-vol-stat-delta ${delta>=0?'up':'down'}">${delta>=0?'↑':'↓'} ${Math.abs(delta)}%</div></div>
              <div><div class="ov-vol-stat-lbl">Hôm qua</div><div class="ov-vol-stat-val">${ovFmtKg(kgYest)} kg</div></div>
              <div><div class="ov-vol-stat-lbl">7 ngày gần nhất</div><div class="ov-vol-stat-val">${ovFmtKg(kgWeek)} kg</div></div>
            </div>
            ${buildOvVolumeChart(orders)}`;
          })()}
        </div>
        <div class="ov-panel">
          <div class="ov-panel-title">🕐 Hoạt động gần đây <button class="ov-see-all" onclick="goTab('nhatKy')">Xem tất cả →</button></div>
          ${buildOvRecentActivity()}
        </div>
      </div>

      <!-- THAO TÁC NHANH + AI QUẢN ĐỐC (bổ sung thêm, không có trong ảnh mẫu) -->
      <div class="ov-row-bottom">
        <div class="dash-side-card" style="margin:0">
          <div class="dash-side-card-title">⚡ Thao tác nhanh</div>
          <div class="dash-qa-grid">
            ${canCreateOrder()?`<button class="dash-qa-btn" onclick="openAddOrder()"><div class="dash-qa-ic" style="background:#eef2ff;color:#4f46e5">＋</div><div class="dash-qa-lbl">Thêm đơn hàng</div></button>`:''}
            <button class="dash-qa-btn" onclick="goTab('keHoach')"><div class="dash-qa-ic" style="background:#dbeafe;color:#1d4ed8">📋</div><div class="dash-qa-lbl">Kế hoạch SX</div></button>
            <button class="dash-qa-btn" onclick="goTab('qrCode')"><div class="dash-qa-ic" style="background:#f0fdf4;color:#0C7A54">📷</div><div class="dash-qa-lbl">Quét QR</div></button>
            <button class="dash-qa-btn" onclick="goTab('chamCong')"><div class="dash-qa-ic" style="background:#fef3c7;color:#b45309">🕐</div><div class="dash-qa-lbl">Chấm công</div></button>
            <button class="dash-qa-btn" onclick="goTab('baoCao')"><div class="dash-qa-ic" style="background:#f3f4f6;color:#374151">📊</div><div class="dash-qa-lbl">Báo cáo</div></button>
            <button class="dash-qa-btn" onclick="openAiChatWindow()"><div class="dash-qa-ic" style="background:#f5f3ff;color:#7c3aed">🤖</div><div class="dash-qa-lbl">AI Copilot</div></button>
          </div>
        </div>
        ${(insights.length||foremanSug.length)?`<div class="ai-banner" style="margin:0">
          <div class="ai-banner-title">🤖 AI Quản đốc · phân tích &amp; đề xuất · ${vnTimeHM(new Date())}</div>
          ${insights.map(i=>`<div class="ai-insight"><span class="ai-insight-icon">${i.icon}</span><span class="ai-insight-text">${i.text}</span></div>`).join('')}
          ${foremanSug.map(s=>`<div class="ai-insight"><span class="ai-insight-icon">${s.icon}</span><span class="ai-insight-text">${s.text}</span></div>`).join('')}
        </div>`:'<div></div>'}
      </div>
    </div>
  `;

  // Load online users — dùng chung updateOnline() (ghi heartbeat của chính
  // mình + đọc lại toàn bộ danh sách + vẽ cả sidebar lẫn Dashboard) để tránh
  // 2 nơi có 2 công thức lọc khác nhau, từng là nguồn gây lệch/không hiện.
  setTimeout(()=>{ if($('onlineEl')) updateOnline(); },300);
  // Đồng hồ trên đầu trang cập nhật mỗi giây, khớp với đồng hồ hệ thống
  setTimeout(()=>{ const p=$('ovClockPill'); if(p) p.textContent='🕐 '+vnTimeHM(new Date()); },1000);
}

// Donut trạng thái đơn hàng dùng riêng cho khối "Tỷ lệ trạng thái đơn hàng"
function buildDashboardStatusDonut(orders){
  const total = orders.length;
  const wait = orders.filter(o=>o.status==='pending').length;
  const run  = orders.filter(o=>o.status==='running'||o.status==='cutting').length;
  const done = orders.filter(o=>o.status==='done').length;
  const overdue = orders.filter(ddOverdue).length;
  if(!total) return `<div class="ov-empty">Chưa có dữ liệu</div>`;
  const seg = [
    {label:'Đang sản xuất', value:run, color:'#3b82f6'},
    {label:'Chờ sản xuất', value:wait, color:'#94a3b8'},
    {label:'Trễ tiến độ', value:overdue, color:'#ef4444'},
    {label:'Hoàn thành', value:done, color:'#15966C'}
  ];
  const legend = seg.map(s=>`<div class="chart-legend-row">
      <span class="chart-legend-dot" style="background:${s.color}"></span>
      <span class="chart-legend-lbl">${s.label}</span>
      <span class="chart-legend-val">${s.value}</span>
      <span class="chart-legend-pct">${total?Math.round(s.value/total*100):0}%</span>
    </div>`).join('');
  return `<div style="display:flex;align-items:center;gap:14px">
    <div class="donut-wrap" style="width:110px;height:110px;flex-shrink:0">
      ${svgDonut(seg, 110, 16)}
      <div class="donut-center">
        <div class="donut-center-val">${total}</div>
        <div class="donut-center-lbl">TỔNG ĐƠN</div>
      </div>
    </div>
    <div class="chart-legend">${legend}</div>
  </div>`;
}

// Cuộn tới khối thống kê chi tiết (biểu đồ, KPI, AI insight) trên Dashboard.
// Khối này giờ luôn hiển thị sẵn (không còn ẩn/hiện) — hàm chỉ dùng để đưa
// người dùng tới đúng vị trí khi bấm vào thẻ Hiệu suất/Cảnh báo.
// Thu gọn / mở rộng 1 khung (panel) trên Dashboard — dùng chung cho khung
// "KPI tổng quan", "Nhân lực hôm nay" và các khung tương tự khác, giúp
// người dùng ẩn bớt để đỡ tốn diện tích màn hình khi không cần xem chi tiết.
function toggleDashPanel(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.toggle('dp-collapsed');
}

function toggleDashMore(){
  const el = document.getElementById('dashMoreStats');
  if(!el) return;
  el.scrollIntoView({behavior:'smooth',block:'start'});
}

// Thẻ KPI "Cảnh báo" trên Tổng quan → cuộn thẳng tới khối "🚨 Cảnh báo
// thông minh" ngay trên Dashboard, vì cảnh báo gồm nhiều loại khác nhau
// (máy hỏng, bảo trì, đơn quá hạn, công đoạn ùn tắc...) — mỗi cảnh báo
// trong danh sách đó đã tự trỏ đúng tới đúng tab/đơn liên quan khi bấm vào,
// nên không nên nhảy đại sang 1 tab cố định như trước.
function scrollToSmartAlerts(){
  const el = document.getElementById('dashSmartAlerts');
  if(!el) return;
  el.scrollIntoView({behavior:'smooth',block:'start'});
}

let _onlineExpanded = false;
let _lastOnlineList = [];
function toggleOnlinePanel(){ _onlineExpanded = !_onlineExpanded; renderOnlineStrip(); }
function renderOnlineStrip(){
  const el = $('onlineEl'); if(!el) return;
  const online = _lastOnlineList;
  if(!online.length){ el.innerHTML=''; return; }
  const tip = u => {
    const d = deviceInfo(u.device);
    const durTxt = u.since ? fmtOnlineDuration(u.since) : onlineTimeAgo(u.ts);
    return `${u.name} · ${roleLabel(u.role)} · Đang xem: ${TAB_LABEL[u.tab]||u.tab||'—'} · ${d.label} · Online ${durTxt}`.replace(/"/g,'&quot;');
  };
  el.innerHTML = `
    <div class="online-strip" onclick="toggleOnlinePanel()">
      <div class="online-strip-left">
        <div class="online-dot"></div>
        <span class="online-strip-label">Đang truy cập</span>
        <span class="online-strip-count">${online.length}</span>
        <span class="online-strip-breakdown">${roleBreakdownTxt(online)}</span>
      </div>
      <div class="online-avatar-stack">
        ${online.slice(0,5).map(u=>`<div class="online-avatar-sm" style="box-shadow:0 0 0 2px #fff,0 0 0 3px ${roleColor(u.role)}" title="${tip(u)}">${presenceAvatarHTML(u)}</div>`).join('')}
        ${online.length>5?`<div class="online-avatar-sm online-avatar-more">+${online.length-5}</div>`:''}
      </div>
      <svg class="online-strip-chevron${_onlineExpanded?' open':''}" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    ${_onlineExpanded?`<div class="online-detail">${online.map(u=>{
      const isMe = u._id===_devId;
      const d = deviceInfo(u.device);
      const durTxt = u.since ? fmtOnlineDuration(u.since) : onlineTimeAgo(u.ts);
      return `
      <div class="online-row${isMe?' me':''}">
        <div class="online-avatar" style="background:linear-gradient(135deg,${roleColor(u.role)},${roleColor(u.role)}cc)">${presenceAvatarHTML(u)}</div>
        <div class="online-row-body">
          <div class="online-row-name">${u.name}${isMe?' <span class="online-row-me">Bạn</span>':''}</div>
          <div class="online-row-meta">
            <span class="online-row-role" style="background:${roleColor(u.role)}1a;color:${roleColor(u.role)}">${roleIcon(u.role)} ${roleLabel(u.role)}</span>
            <span class="online-row-tag">👀 ${TAB_LABEL[u.tab]||u.tab||'—'}</span>
            <span class="online-row-tag">${d.icon} ${d.label}</span>
          </div>
        </div>
        <div class="online-row-right">
          <span class="online-row-dur" title="Đang truy cập được ${durTxt}">⏱ ${durTxt}</span>
        </div>
      </div>`;
    }).join('')}</div>`:''}
  `;
}
