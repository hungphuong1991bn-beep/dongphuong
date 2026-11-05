// src/modules/reports/reports-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────



// ════════════════════════════════════════════════════════════
// BÁO CÁO — tổng quan, biểu đồ trạng thái, xu hướng sản lượng,
// top khách hàng. Toàn bộ biểu đồ vẽ bằng SVG/CSS thuần (không
// phụ thuộc thư viện ngoài) để nhẹ và hoạt động tốt offline.
// ════════════════════════════════════════════════════════════
function rptStatusOf(o){ return o.status==='cutting'?'running':(o.status||'pending'); }

function rptDayKey(ts){ const d=new Date(ts); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function rptDayLabel(ts){ const d=new Date(ts); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`; }

// Biểu đồ cột đứng (SVG) — sản lượng KG hoàn thành theo từng ngày
function buildDailyBarChart(days){
  const W=320,H=132,padB=22,padT=10,padL=4,padR=4;
  const innerW=W-padL-padR, innerH=H-padT-padB;
  const n=days.length;
  const gap=3;
  const barW=Math.max(4,(innerW/n)-gap);
  const max=Math.max(1,...days.map(d=>d.kg));
  let bars='', labels='';
  days.forEach((d,i)=>{
    const x=padL+i*(innerW/n)+ (innerW/n - barW)/2;
    const h=d.kg>0?Math.max(2,(d.kg/max)*innerH):0;
    const y=padT+innerH-h;
    const isLast=i===n-1;
    const color=isLast?'var(--brand2)':'var(--brand3)';
    bars+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" fill="${color}" opacity="${d.kg>0?1:.18}"><title>${d.label}: ${d.kg.toFixed(1)} kg</title></rect>`;
    if(i===0||i===n-1||i===Math.floor(n/2)){
      labels+=`<text x="${(x+barW/2).toFixed(1)}" y="${H-6}" font-size="8.5" fill="var(--text4)" text-anchor="middle">${d.label}</text>`;
    }
  });
  const gridY=padT+innerH;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">
    <line x1="${padL}" y1="${gridY}" x2="${W-padR}" y2="${gridY}" stroke="var(--border)" stroke-width="1"/>
    ${bars}${labels}
  </svg>`;
}

// Biểu đồ donut (conic-gradient CSS) — tỷ trọng trạng thái đơn hàng
function buildStatusDonut(counts,total){
  const segs=[
    {key:'done',label:'Hoàn thành',color:'#10b981',val:counts.done},
    {key:'running',label:'Đang chạy',color:'#3b82f6',val:counts.running},
    {key:'pending',label:'Chờ SX',color:'#f59e0b',val:counts.pending},
  ];
  let acc=0; const stops=[];
  segs.forEach(s=>{
    const pct = total? (s.val/total*100) : 0;
    const from=acc, to=acc+pct;
    stops.push(`${s.color} ${from.toFixed(2)}% ${to.toFixed(2)}%`);
    acc=to;
  });
  const gradient = total ? stops.join(',') : 'var(--border) 0% 100%';
  const legend = segs.map(s=>`<div class="chart-legend-item"><span class="chart-legend-dot" style="background:${s.color}"></span>${s.label}: <b>${s.val}</b></div>`).join('');
  return `<div style="display:flex;align-items:center;gap:16px">
    <div style="width:96px;height:96px;border-radius:50%;background:conic-gradient(${gradient});flex-shrink:0;display:flex;align-items:center;justify-content:center;position:relative">
      <div style="width:60px;height:60px;border-radius:50%;background:var(--card);display:flex;flex-direction:column;align-items:center;justify-content:center">
        <div style="font-size:16px;font-weight:800;color:var(--text)">${total}</div>
        <div style="font-size:8.5px;color:var(--text3)">đơn</div>
      </div>
    </div>
    <div class="chart-legend" style="flex-direction:column;gap:8px;margin-top:0">${legend}</div>
  </div>`;
}

function renderBaoCao(){
  const orders=DB.orders;
  const done=orders.filter(o=>o.status==='done');
  const running=orders.filter(o=>rptStatusOf(o)==='running');
  const pending=orders.filter(o=>rptStatusOf(o)==='pending');
  const totalKg=orders.reduce((s,o)=>s+(parseFloat(o.kg)||0),0);
  const doneKg=done.reduce((s,o)=>s+(parseFloat(o.kg)||0),0);
  const pct=orders.length?Math.round(done.length/orders.length*100):0;
  const avgKg=orders.length?(totalKg/orders.length):0;
  const customersArr=[...new Set(orders.map(o=>o.customer).filter(Boolean))];

  // Thời gian SX trung bình (từ startedAt → doneAt) của các đơn đã xong
  const withDuration=done.filter(o=>o.startedAt&&o.doneAt&&o.doneAt>o.startedAt);
  const avgDurMs=withDuration.length? withDuration.reduce((s,o)=>s+(o.doneAt-o.startedAt),0)/withDuration.length : 0;

  // 14 ngày gần nhất — sản lượng KG hoàn thành theo ngày
  const N=14;
  const dayMap={};
  for(let i=N-1;i>=0;i--){
    const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
    dayMap[rptDayKey(d.getTime())]={label:rptDayLabel(d.getTime()),kg:0,count:0};
  }
  done.forEach(o=>{
    if(!o.doneAt) return;
    const k=rptDayKey(o.doneAt);
    if(dayMap[k]){ dayMap[k].kg+=(parseFloat(o.kg)||0); dayMap[k].count++; }
  });
  const last14=Object.values(dayMap);
  const kg7=last14.slice(7).reduce((s,d)=>s+d.kg,0);
  const kgPrev7=last14.slice(0,7).reduce((s,d)=>s+d.kg,0);
  const trendPct = kgPrev7>0 ? Math.round(((kg7-kgPrev7)/kgPrev7)*100) : (kg7>0?100:0);
  const trendUp = kg7>=kgPrev7;

  // Top khách hàng theo KG
  const custStats=customersArr.map(c=>{
    const ords=orders.filter(o=>o.customer===c);
    const kg=ords.reduce((s,o)=>s+(parseFloat(o.kg)||0),0);
    const d=ords.filter(o=>o.status==='done').length;
    return {name:c,count:ords.length,kg,done:d};
  }).sort((a,b)=>b.kg-a.kg);
  const topCust=custStats.slice(0,5);
  const maxCustKg=Math.max(1,...topCust.map(c=>c.kg));

  const donut=buildStatusDonut({done:done.length,running:running.length,pending:pending.length},orders.length);
  const barChart=buildDailyBarChart(last14);

  $('mc').innerHTML=`
    <div class="sec-title">Tổng quan</div>
    <div class="rpt-grid rpt-grid-4col">
      <div class="rpt-item"><div class="rpt-num">${orders.length}</div><div class="rpt-lbl">Tổng đơn</div></div>
      <div class="rpt-item"><div class="rpt-num">${done.length}</div><div class="rpt-lbl">Hoàn thành</div></div>
      <div class="rpt-item"><div class="rpt-num">${totalKg.toFixed(1)}</div><div class="rpt-lbl">Tổng KG</div></div>
      <div class="rpt-item"><div class="rpt-num">${doneKg.toFixed(1)}</div><div class="rpt-lbl">KG đã giao</div></div>
    </div>

    ${buildKpiTrackPanel(orders)}

    <div class="card" style="padding:14px;margin-top:10px">
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:6px"><span>Tiến độ hoàn thành</span><span style="color:var(--green-m)">${pct}%</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="kpi-mini-grid">
        <div class="kpi-mini"><div class="kpi-mini-num" style="color:var(--amber-m)">${pending.length}</div><div class="kpi-mini-lbl">Chờ SX</div></div>
        <div class="kpi-mini"><div class="kpi-mini-num" style="color:var(--brand2)">${running.length}</div><div class="kpi-mini-lbl">Đang chạy</div></div>
        <div class="kpi-mini"><div class="kpi-mini-num" style="color:var(--green-m)">${avgKg.toFixed(1)}</div><div class="kpi-mini-lbl">KG TB/đơn</div></div>
      </div>
      ${avgDurMs?`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:12px;color:var(--text3);display:flex;justify-content:space-between"><span>⏱ Thời gian SX trung bình</span><b style="color:var(--text2)">${fmtDuration(avgDurMs)}</b></div>`:''}
    </div>

    <div class="sec-title">Trạng thái đơn hàng</div>
    <div class="card chart-card">
      ${donut}
    </div>

    <div class="sec-title">Sản lượng 14 ngày gần nhất</div>
    <div class="card chart-card">
      <div class="chart-card-head">
        <div>
          <div class="chart-card-title">KG hoàn thành / ngày</div>
          <div class="chart-card-sub">7 ngày gần nhất: <b style="color:var(--text2)">${kg7.toFixed(1)} kg</b></div>
        </div>
        <span class="ver-status-badge ${trendUp?'ok':'off'}">${trendUp?'▲':'▼'} ${Math.abs(trendPct)}% so với tuần trước</span>
      </div>
      ${barChart}
    </div>

    <div class="sec-title">Top khách hàng theo sản lượng</div>
    <div class="card chart-card">
      ${topCust.length?topCust.map(c=>`
        <div class="hbar-row">
          <div class="hbar-row-lbl" title="${c.name}">${c.name}</div>
          <div class="hbar-row-track"><div class="hbar-row-fill" style="width:${Math.max(6,(c.kg/maxCustKg*100))}%"><span class="hbar-row-val">${c.kg.toFixed(1)}kg</span></div></div>
        </div>`).join(''):'<div class="empty" style="padding:16px 0">Chưa có dữ liệu</div>'}
    </div>

    <div class="sec-title">Khách hàng (${customersArr.length})</div>
    <div class="card" style="padding:0 14px">
      ${custStats.length?custStats.map(c=>{
        return `<div class="cust-row"><span style="font-weight:600">${c.name}</span><span style="color:var(--text3);font-size:12.5px">${c.count} đơn · ${c.kg.toFixed(1)}kg · ${c.done} xong</span></div>`;
      }).join(''):'<div class="empty" style="padding:16px 0">Chưa có dữ liệu</div>'}
    </div>
  `;
}
