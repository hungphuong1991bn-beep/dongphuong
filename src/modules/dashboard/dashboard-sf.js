// src/modules/dashboard/dashboard-sf.js — Tổng quan Smart Factory (giao diện điều hành)
// Thay renderDashboard(); bản cũ giữ nguyên dưới tên renderDashboardClassic() (dùng làm dự phòng khi lỗi
// hoặc khi người dùng chọn "Giao diện cũ"). CHỈ ĐỌC DB — không ghi dữ liệu nghiệp vụ.
// Cấu hình bố cục lưu ở localStorage + nhánh riêng /dashCfg (không đụng /data nên không ảnh hưởng đồng bộ).

const SF_LS_F='sx_sf_filters_v1', SF_LS_L='sx_sf_layout_v1', SF_LS_CLASSIC='sx_sf_classic', SF_LS_TV='sx_sf_tv';
let sfF = {period:'day', anchor:Date.now(), stage:'', machine:'', shift:''};
let sfLayout = null, sfShared = null, sfSharedLoaded = false;
let sfTv = false, sfLastM = null, sfMachTab = 'top', sfClockT = null, sfAutoT = null, sfWake = null, sfRenderBusy = false;

function sfEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function sfTip(html){ return `data-t="${sfEsc(html)}" onmouseenter="ctShow(event,this.getAttribute('data-t'))" onmousemove="ctMove(event)" onmouseleave="ctHide()" ontouchstart="ctShow(event,this.getAttribute('data-t'))"`; }
function sfLS(k,v){ try{ if(v===undefined) return localStorage.getItem(k); if(v===null) localStorage.removeItem(k); else localStorage.setItem(k,v); }catch(e){} return null; }
function sfNum(n,d){ return Number(n).toLocaleString('vi-VN',{maximumFractionDigits:d==null?0:d}); }
function sfFmtKg(kg){ return kg>=1000 ? sfNum(kg/1000,1)+' tấn' : sfNum(kg,0)+' kg'; }
function sfPct(x){ return x==null ? null : sfNum(x*100,1)+'%'; }
function sfHrs(ms){ return sfNum(ms/3600000,1)+' giờ'; }
const SF_NA = t => `<span class="sf-na">${sfEsc(t||'Chưa có dữ liệu')}</span>`;
const SF_PERIODS = [['day','Ngày'],['week','Tuần'],['month','Tháng'],['year','Năm']];

// ── Bố cục widget ───────────────────────────────────────────────────
const SF_WIDGETS = [
  {id:'oee',      title:'Hiệu suất sản xuất (OEE)',        span:3,  show:true,  build:()=>sfWOee},
  {id:'output',   title:'Sản lượng theo thời gian',        span:6,  show:true},
  {id:'progress', title:'Tiến độ đơn hàng',                span:3,  show:true},
  {id:'stages',   title:'Sản lượng theo công đoạn',        span:5,  show:true},
  {id:'machines', title:'Máy theo giờ chạy thực tế',       span:4,  show:true},
  {id:'alerts',   title:'Cảnh báo & thông báo',            span:3,  show:true},
  {id:'orders',   title:'Đơn đang sản xuất',               span:6,  show:true},
  {id:'quality',  title:'Chất lượng',                      span:6,  show:true},
  {id:'inventory',title:'Kho nguyên liệu & thành phẩm',    span:6,  show:true},
  {id:'workforce',title:'Nhân lực & ca sản xuất',          span:6,  show:true},
  {id:'ai',       title:'AI Quản đốc',                     span:6,  show:false},
  {id:'activity', title:'Hoạt động gần đây',               span:6,  show:false}
];
function sfDefaultLayout(){ return SF_WIDGETS.map(w=>({id:w.id, show:w.show, span:w.span})); }
function sfNormLayout(l){
  const known = {}; SF_WIDGETS.forEach(w=>known[w.id]=w);
  const out=[], seen={};
  (Array.isArray(l)?l:[]).forEach(x=>{ if(x && known[x.id] && !seen[x.id]){ seen[x.id]=1; const sp=[3,4,5,6,8,12].indexOf(+x.span)>=0?+x.span:known[x.id].span; out.push({id:x.id, show:x.show!==false, span:sp}); } });
  sfDefaultLayout().forEach(d=>{ if(!seen[d.id]) out.push(d); });
  return out;
}
function sfGetLayout(){
  if(sfLayout) return sfLayout;
  let local=null; try{ local=JSON.parse(sfLS(SF_LS_L)||'null'); }catch(e){}
  const admin = typeof isAdmin==='function' && isAdmin();
  sfLayout = sfNormLayout(admin ? (local||sfShared) : (sfShared||null));
  return sfLayout;
}
function sfSaveLayout(){
  sfLS(SF_LS_L, JSON.stringify(sfLayout));
  clearTimeout(sfSaveLayout._t);
  sfSaveLayout._t = setTimeout(async()=>{
    try{ if(typeof fbOk==='function' && fbOk()) { await fbWrite('/dashCfg/layout', sfLayout); sfShared = sfLayout; } }
    catch(e){ if(typeof showToast==='function') showToast('Đã lưu bố cục trên máy này, chưa đồng bộ được lên máy chủ',true); }
  }, 700);
}
async function sfLoadShared(){
  if(sfSharedLoaded) return; sfSharedLoaded = true;
  try{
    if(typeof fbOk!=='function' || !fbOk()) return;
    const v = await fbRead('/dashCfg/layout');
    if(v){ sfShared = sfNormLayout(Array.isArray(v)?v:Object.keys(v).map(k=>v[k])); sfLayout=null; if(currentTab==='dashboard') renderDashboard(); }
  }catch(e){ /* chưa có / bị chặn quyền → dùng bố cục mặc định hoặc cục bộ */ }
}
function sfLoadPrefs(){
  try{ const f=JSON.parse(sfLS(SF_LS_F)||'null'); if(f){ sfF.period=f.period||'day'; sfF.stage=f.stage||''; sfF.machine=f.machine||''; sfF.shift=f.shift||''; } }catch(e){}
  sfTv = sfLS(SF_LS_TV)==='1';
}
sfLoadPrefs();

// ── Biểu đồ SVG ─────────────────────────────────────────────────────
function sfSpark(vals, color){
  const w=100,h=30,pad=3, nums=vals.filter(v=>v!=null);
  if(nums.length<2) return `<svg class="sf-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="${h-4}" x2="${w}" y2="${h-4}" stroke="${color}" stroke-opacity=".3" stroke-dasharray="3 3"/></svg>`;
  const mn=Math.min(...nums), mx=Math.max(...nums), rg=(mx-mn)||1;
  const x=i=>pad+i*(w-2*pad)/(vals.length-1), y=v=>h-pad-((v-mn)/rg)*(h-2*pad);
  let segs=[], cur=[];
  vals.forEach((v,i)=>{ if(v==null){ if(cur.length) segs.push(cur); cur=[]; } else cur.push(x(i).toFixed(1)+','+y(v).toFixed(1)); });
  if(cur.length) segs.push(cur);
  return `<svg class="sf-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${segs.map(s=>s.length>1?`<polyline points="${s.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`:`<circle cx="${s[0].split(',')[0]}" cy="${s[0].split(',')[1]}" r="2" fill="${color}"/>`).join('')}</svg>`;
}
function sfRing(segs, size, thick, center){
  const r=(size-thick)/2, c=size/2, C=2*Math.PI*r, total=segs.reduce((s,x)=>s+x.v,0);
  let acc=0;
  const arcs = total>0 ? segs.filter(s=>s.v>0).map(s=>{
    const len=s.v/total*C, o=-acc/total*C; acc+=s.v;
    return `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thick}" stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${o.toFixed(2)}" transform="rotate(-90 ${c} ${c})" ${sfTip(s.label+': '+s.v+' ('+Math.round(s.v/total*100)+'%)')}/>`;
  }).join('') : '';
  return `<div class="sf-ring" style="--s:${size}"><svg viewBox="0 0 ${size} ${size}" role="img"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(148,180,255,.16)" stroke-width="${thick}" ${total>0?'':'stroke-dasharray="4 6"'}/>${arcs}</svg><div class="sf-ring-c">${center}</div></div>`;
}
function sfBarChart(M){
  const B=M.B, plan=M.output.bucketPlan, act=M.output.bucketActual;
  const mx=Math.max(1,...plan,...act), W=640, H=230, pl=44, pr=8, pt=14, pb=30, iw=W-pl-pr, ih=H-pt-pb, g=iw/B.length;
  const bw=Math.min(22, g*0.32), ty=v=>pt+ih-(v/mx)*ih;
  const unit = mx>=1000 ? 1000 : 1, ul = unit===1000 ? 't' : 'kg';
  let grid='';
  for(let i=0;i<=4;i++){ const v=mx*i/4, y=ty(v); grid+=`<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" stroke="rgba(148,180,255,.14)"/><text x="${pl-6}" y="${y+3}" text-anchor="end" class="sf-ax">${sfNum(v/unit, unit===1000?1:0)}${i===4?' '+ul:''}</text>`; }
  const every = B.length>16 ? 3 : (B.length>9 ? 2 : 1);
  let bars='';
  B.forEach((b,i)=>{
    const cx=pl+g*i+g/2, ph=ih-(ty(plan[i])-pt), ah=ih-(ty(act[i])-pt);
    const tip=`<b>${sfEsc(b.label)}</b><br>Kế hoạch: <b>${sfFmtKg(plan[i])}</b><br>Thực tế: <b>${sfFmtKg(act[i])}</b>`;
    bars+=`<g class="sf-bk" ${sfTip(tip)} onclick="sfOpen('bucket',${i})" role="button" tabindex="0" aria-label="${sfEsc(b.label)}">
      <rect x="${pl+g*i}" y="${pt}" width="${g}" height="${ih}" fill="transparent"/>
      <rect x="${(cx-bw-1).toFixed(1)}" y="${ty(plan[i]).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0,ph).toFixed(1)}" rx="2" fill="#38bdf8"/>
      <rect x="${(cx+1).toFixed(1)}" y="${ty(act[i]).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0,ah).toFixed(1)}" rx="2" fill="#34d399"/></g>`;
    if(i%every===0) bars+=`<text x="${cx.toFixed(1)}" y="${H-10}" text-anchor="middle" class="sf-ax">${sfEsc(b.short)}</text>`;
  });
  return `<svg class="sf-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Biểu đồ sản lượng kế hoạch và thực tế">${grid}${bars}</svg>`;
}

// ── Banner / bộ lọc ─────────────────────────────────────────────────
function sfSyncChip(M){
  const s=M.sync;
  const map={ok:['ok','Trực tuyến'], local:['warn','Chế độ cục bộ'], offline:['bad','Ngoại tuyến'], error:['bad','Lỗi đồng bộ'], pending:['warn','Chưa đồng bộ']};
  const [cls,txt]=map[s.state]||map.pending;
  return `<span class="sf-chip ${cls}" id="sfSyncChip"><i></i>${txt}</span>`;
}
function sfBanner(M){
  const d=new Date(typeof nowSrv==='function'?nowSrv():Date.now());
  const dow=['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'][d.getDay()];
  const name = (typeof currentUser!=='undefined' && currentUser && currentUser.name) ? sfEsc(currentUser.name) : '';
  return `<section class="sf-banner">
    <svg class="sf-skyline" viewBox="0 0 800 160" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
      <defs><linearGradient id="sfg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3b82f6" stop-opacity=".35"/><stop offset="1" stop-color="#0b1b3f" stop-opacity="0"/></linearGradient></defs>
      <path d="M0 160V110h60V90h40v20h50V70l40-14v54h40V96h30V60h50v50h40V84l50-18v44h60V92h40v18h60V74l60-20v56h60v50z" fill="url(#sfg)"/>
      <path d="M0 160V122h90v-18h60v18h70v-30l60 -14v44h80v-24h50v24h90v-34h70v34h230v38z" fill="#0c2250" fill-opacity=".85"/>
      <g fill="#7dd3fc" fill-opacity=".55"><rect x="110" y="122" width="6" height="4"/><rect x="124" y="122" width="6" height="4"/><rect x="300" y="116" width="6" height="4"/><rect x="316" y="116" width="6" height="4"/><rect x="520" y="110" width="6" height="4"/><rect x="536" y="110" width="6" height="4"/></g>
    </svg>
    <div class="sf-clock"><div class="sf-clock-d">${dow}, ${sfPad(d.getDate())}/${sfPad(d.getMonth()+1)}/${d.getFullYear()}</div><div class="sf-clock-t" id="sfClock">${sfPad(d.getHours())}:${sfPad(d.getMinutes())}:${sfPad(d.getSeconds())}</div>${sfSyncChip(M)}</div>
    <div class="sf-hello"><h1>Chào mừng trở lại${name?', '+name:''}!</h1><p>Hệ thống quản lý sản xuất thông minh Đông Phương</p></div>
    <div class="sf-slogan">Sản xuất thông minh<br>Kiến tạo tương lai</div>
  </section>`;
}
function sfFilters(M){
  const f=M.f, admin=typeof isAdmin==='function' && isAdmin();
  const seg=SF_PERIODS.map(([k,l])=>`<button class="sf-seg${f.period===k?' on':''}" onclick="sfSetF('period','${k}')" aria-pressed="${f.period===k}">${l}</button>`).join('');
  const dstr = typeof todayStr==='function' ? todayStr(new Date(f.anchor)) : '';
  const stOpts = `<option value="">Tất cả công đoạn</option>`+SF_STAGE_KEYS.map(k=>`<option value="${k}"${f.stage===k?' selected':''}>${sfEsc((STAGE_LABEL||{})[k]||k)}</option>`).join('');
  const ms=(typeof MACHINES!=='undefined'?MACHINES:[]).filter(m=>!f.stage||(typeof ASSIGN_STAGES!=='undefined'&&ASSIGN_STAGES.some(s=>s.key===f.stage&&s.group===m.group)));
  const mOpts = `<option value="">Tất cả máy</option>`+ms.map(m=>`<option value="${m.id}"${f.machine===m.id?' selected':''}>${sfEsc(m.name)}</option>`).join('');
  const shOpts = `<option value="">Tất cả ca</option>`+['1','2','3'].map(k=>`<option value="${k}"${f.shift===k?' selected':''}>Ca ${k}</option>`).join('');
  const active = f.stage||f.machine||f.shift;
  return `<section class="sf-filters" aria-label="Bộ lọc">
    <div class="sf-seggrp">${seg}</div>
    <div class="sf-datenav"><button class="sf-ib" onclick="sfShift(-1)" aria-label="Kỳ trước">‹</button>
      <label class="sf-date"><span>${sfEsc(sfRangeLabel(M.R))}</span><input type="date" value="${dstr}" onchange="sfSetAnchor(this.value)" aria-label="Chọn ngày"></label>
      <button class="sf-ib" onclick="sfShift(1)" aria-label="Kỳ sau">›</button><button class="sf-btn sm" onclick="sfToday()">Hôm nay</button></div>
    <select class="sf-sel" onchange="sfSetF('plant',this.value)" aria-label="Nhà máy" title="Hệ thống hiện quản lý 1 nhà máy"><option>Nhà máy Đông Phương</option></select>
    <select class="sf-sel" onchange="sfSetF('stage',this.value)" aria-label="Công đoạn">${stOpts}</select>
    <select class="sf-sel" onchange="sfSetF('machine',this.value)" aria-label="Máy">${mOpts}</select>
    <select class="sf-sel" onchange="sfSetF('shift',this.value)" aria-label="Ca">${shOpts}</select>
    ${active?`<button class="sf-btn sm ghost" onclick="sfClearF()">Xóa lọc</button>`:''}
    <span class="sf-sp"></span>
    ${admin?`<button class="sf-btn" onclick="sfOpenCustomize()">⚙ Tùy chỉnh</button>`:''}
    <button class="sf-btn" onclick="sfToggleTv()">📺 TV Mode</button>
  </section>${f.shift?`<div class="sf-note">Lọc theo <b>Ca ${f.shift}</b> chỉ áp dụng cho sổ Rút / Đánh bóng / Cắt, chất lượng QR và nhân lực. Đơn hàng, sản lượng đơn và Đùn không ghi ca nên không lọc theo ca.</div>`:''}`;
}

// ── KPI ─────────────────────────────────────────────────────────────
function sfDelta(cur, prev, fmt){
  if(cur==null || prev==null || prev===0) return `<span class="sf-dl flat">Chưa có kỳ trước để so sánh</span>`;
  const d=cur-prev, up=d>=0, p=Math.abs(d)/Math.abs(prev)*100;
  return `<span class="sf-dl ${d===0?'flat':up?'up':'dn'}">${d===0?'■':up?'▲':'▼'} ${fmt?fmt(Math.abs(d)):sfNum(p,1)+'%'} so với kỳ trước</span>`;
}
function sfKpis(M){
  const o=M.orders, out=M.output, q=M.quality, dl=M.delivery, C={blue:'#60a5fa',green:'#34d399',purple:'#a78bfa',orange:'#fb923c',teal:'#2dd4bf'};
  const card=(cls,ic,lbl,val,sub,delta,spark,col,click)=>`<button class="sf-kpi ${cls}" onclick="${click}"><span class="sf-kpi-ic" aria-hidden="true">${ic}</span><span class="sf-kpi-b"><span class="sf-kpi-l">${lbl}</span><span class="sf-kpi-v">${val}</span><span class="sf-kpi-s">${sub}</span>${delta}</span>${sfSpark(spark,col)}</button>`;
  const waiting = M.empty && M.sync.state==='pending';
  const V = (v)=> waiting ? SF_NA('Chưa đồng bộ') : v;
  const pctDelta = (a,b)=> (a==null||b==null)?`<span class="sf-dl flat">Chưa có kỳ trước để so sánh</span>`:sfDelta(a,b,x=>sfNum(x*100,1)+' điểm %');
  return `<section class="sf-kpis" aria-label="Chỉ số chính">
    ${card('k1','🗂','Tổng đơn hàng', V(sfNum(o.total)+' <small>đơn</small>'), `Mới <b>${o.new}</b> · Đang SX <b>${o.running}</b>${o.paused?` · Tạm dừng <b>${o.paused}</b>`:''} · Hoàn thành <b>${o.done}</b> · <span class="${o.overdue?'sf-bad':''}">Quá hạn <b>${o.overdue}</b></span>`, sfDelta(o.createdR,o.createdP,x=>sfNum(x)+' đơn mới'), o.bucketCreated, C.blue, "sfOpen('orders','all')")}
    ${card('k2','📦','Sản lượng thực tế', V(sfFmtKg(out.actualKg)), out.planCount? `Kế hoạch <b>${sfFmtKg(out.planKg)}</b> · Còn thiếu <b>${sfFmtKg(out.missingKg)}</b>` : 'Không có đơn đến hạn giao trong kỳ', sfDelta(out.actualKg,out.actualKgP), out.bucketActual, C.green, "sfOpen('output','actual')")}
    ${card('k3','✔','Hoàn thành kế hoạch', V(out.pct==null?SF_NA('Không có kế hoạch'):sfPct(out.pct)), `${out.planDoneCount}/${out.planCount} đơn đến hạn đã hoàn thành`, pctDelta(out.pct,out.pctP), out.bucketPct, C.purple, "sfOpen('output','plan')")}
    ${card('k4','🛡','Chất lượng (đạt)', V(q.rate==null?SF_NA('Chưa có Check Sheet'):sfPct(q.rate)), `Phiếu đạt <b>${sfNum(q.pass)}</b> · NG <b class="${q.ng?'sf-bad':''}">${sfNum(q.ng)}</b>${q.pending?` · Chờ KL <b>${sfNum(q.pending)}</b>`:''} · <em>Check Sheet công đoạn</em>`, pctDelta(q.rate,q.prevRate), q.bucketRate, C.orange, "sfOpen('quality','')")}
    ${card('k5','🚚','Giao hàng đúng hạn', V(dl.rate==null?SF_NA('Chưa có đơn đã giao'):sfPct(dl.rate)), dl.n?`${dl.onTime}/${dl.n} đơn đã giao đúng hạn`:(dl.doneOnTimeRate!=null?`Hoàn thành đúng hạn: <b>${sfPct(dl.doneOnTimeRate)}</b>`:'Chưa có đơn đã giao trong kỳ'), pctDelta(dl.rate,dl.prevRate), dl.bucketRate, C.teal, "sfOpen('delivery','')")}
  </section>`;
}

// ── Widget ──────────────────────────────────────────────────────────
function sfPanel(w, M, body, extraHead, cls){
  const uns = M.unsupported.orders && ['output','progress','orders'].indexOf(w.id)>=0 ? `<span class="sf-badge" title="Dữ liệu đơn hàng không ghi ca">không lọc theo ca</span>` : '';
  return `<section class="sf-panel ${cls||''}" data-w="${w.id}"><header><h2>${sfEsc(w.title)}</h2>${uns}<span class="sf-sp"></span>${extraHead||''}</header><div class="sf-body">${body}</div></section>`;
}
function sfWOee(M){
  const o=M.oee, ms=M.machines;
  const run=ms.rows.reduce((s,r)=>s+r.runMs,0), stops=ms.rows.reduce((s,r)=>s+r.pauses,0), stopMs=ms.rows.reduce((s,r)=>s+r.pauseMs,0);
  const ring = o.ready
    ? sfRing([{v:o.value,label:'OEE',color:o.value>=0.85?'#34d399':o.value>=0.6?'#fbbf24':'#f87171'},{v:1-o.value,label:'Hao hụt',color:'rgba(148,163,184,.25)'}],150,14,`<b class="sf-ring-v">${sfPct(o.value)}</b><small>OEE · ${o.okCount} máy</small>`)
    : sfRing([],150,14,`<b class="sf-ring-v">—</b><small>Chưa đủ dữ liệu</small>`);
  const apq = o.ready ? `<div><small>Khả dụng × Hiệu suất × Chất lượng</small><b>${sfPct(o.A)} × ${sfPct(o.P)} × ${sfPct(o.Q)}</b></div>` : '';
  const items=o.inputs.map(i=>`<li class="${i.ok?'ok':'no'}"><i>${i.ok?'✔':'✖'}</i><span>${sfEsc(i.label)}<small>${sfEsc(i.note)}</small></span></li>`).join('');
  return `<div class="sf-oee">${ring}<div class="sf-oee-facts">${apq}
      <div><small>Giờ chạy thực tế (cộng các máy)</small><b>${ms.anyRun?sfHrs(run):SF_NA('Chưa có phiên chạy')}</b></div>
      <div><small>Số lần tạm dừng · thời gian dừng</small><b>${ms.anyRun||stops?`${stops} lần · ${sfHrs(stopMs)}`:SF_NA('Chưa có')}</b></div></div></div>
    <ul class="sf-checks">${items}</ul>
    <p class="sf-foot">OEE chỉ tính cho máy có đủ cả 4 đầu vào, không ước lượng.</p>
    <button class="sf-link" onclick="sfOpen('oee','')">Xem chi tiết từng máy ›</button>`;
}
function sfWOutput(M){
  const out=M.output, per=M.f.period;
  const legend=`<div class="sf-legend"><span><i style="background:#38bdf8"></i>Kế hoạch (đơn có hạn giao)</span><span><i style="background:#34d399"></i>Thực tế (đơn hoàn thành)</span></div>`;
  const note = per==='day' ? '7 ngày gần nhất' : per==='week' ? 'Theo ngày trong tuần' : per==='month' ? 'Theo ngày trong tháng' : 'Theo tháng trong năm';
  const warn = out.noKgOrders ? `<div class="sf-foot">⚠ ${out.noKgOrders} đơn chưa có khối lượng (kg) nên chưa được tính vào sản lượng.</div>` : '';
  const none = !out.bucketPlan.some(v=>v>0) && !out.bucketActual.some(v=>v>0);
  return `<div class="sf-chart-h">${legend}<small>${note} · bấm cột để xem đơn</small></div>${none?`<div class="sf-empty">Không có sản lượng hoặc kế hoạch trong khoảng thời gian này.</div>`:sfBarChart(M)}${warn}`;
}
function sfWProgress(M){
  const p=M.progress;
  const center = p.pct==null ? `<b class="sf-ring-v">—</b><small>Chưa có hạn giao</small>` : `<b class="sf-ring-v">${sfNum(p.pct*100,1)}%</b><small>Đúng tiến độ</small>`;
  const segs=[{v:p.ontrack.length,color:'#34d399',label:'Đúng tiến độ',k:'ontrack'},{v:p.risk.length,color:'#fbbf24',label:'Nguy cơ trễ (≤48 giờ)',k:'risk'},{v:p.overdue.length,color:'#f87171',label:'Quá hạn',k:'overdue'},{v:p.nodue.length,color:'#94a3b8',label:'Chưa có hạn giao',k:'nodue'}];
  const leg=segs.map(s=>`<button class="sf-lg" onclick="sfOpen('progress','${s.k}')"><i style="background:${s.color}"></i><span>${s.label}</span><b>${s.v}</b></button>`).join('');
  const risk = p.risk.length ? `<button class="sf-alertbar" onclick="sfOpen('progress','risk')">🏆 ${p.risk.length} đơn có nguy cơ trễ hạn <span>Theo dõi ›</span></button>` : '';
  return `<div class="sf-prog">${sfRing(segs,150,16,center)}<div class="sf-leg">${leg}</div></div>${risk}${p.openTotal?'':`<div class="sf-empty">Không có đơn đang mở.</div>`}`;
}
function sfWStages(M){
  const cards=M.stages.rows.map(s=>{
    const max=Math.max(1,...s.buckets);
    const bars=s.buckets.map((v,i)=>`<i ${sfTip(sfEsc(M.B[i].label)+': <b>'+sfNum(v,s.key==='dun'?1:0)+'</b> '+s.unit)} style="height:${Math.max(v>0?6:2,v/max*100)}%"></i>`).join('');
    let val;
    if(s.noShift) val = SF_NA('Sổ Đùn không ghi ca');
    else if(!s.hasAnyLedger) val = SF_NA('Chưa có sổ');
    else val = `<b>${sfNum(s.value, s.key==='dun'?1:0)}</b> <small>${s.unit}</small>`;
    const sub = s.noShift ? '' : `${s.rows} dòng sổ${s.unlinked?` · <span class="sf-warn">${s.unlinked} chưa gắn đơn</span>`:''}`;
    const ex = s.extra ? `<div class="sf-sub">Phế ${sfNum(s.extra.phe,1)} kg · Phôi ${sfNum(s.extra.phoi,1)} kg</div>`:'';
    return `<button class="sf-stage" onclick="sfOpen('stage','${s.key}')"><span class="sf-stage-n">${sfEsc(s.label)}</span><span class="sf-stage-v">${val}</span><span class="sf-sub">${sub}</span>${ex}<span class="sf-bars ${s.noShift?'dim':''}">${bars}</span><span class="sf-sub">Đang chạy: <b>${s.running}</b> đơn</span></button>`;
  }).join('');
  const q=M.quality, w=M.warehouse.fg;
  const tail=`<button class="sf-stage" onclick="sfOpen('quality','')"><span class="sf-stage-n">Kiểm tra</span><span class="sf-stage-v">${q.judged?`<b>${sfNum(q.judged)}</b> <small>phiếu đã kết luận</small>`:SF_NA('Chưa có Check Sheet')}</span><span class="sf-sub">Đạt ${sfNum(q.pass)} · NG ${sfNum(q.ng)}</span></button>
    <button class="sf-stage" onclick="sfOpen('warehouse','inR')"><span class="sf-stage-n">Nhập kho</span><span class="sf-stage-v"><b>${w.inR}</b> <small>đơn · ${sfFmtKg(w.inRKg)}</small></span><span class="sf-sub">Đơn hoàn thành đã nhập kho trong kỳ</span></button>`;
  return `<div class="sf-stages">${cards}${M.f.stage?'':tail}</div><p class="sf-foot">Mỗi công đoạn đọc sổ riêng của công đoạn đó, đơn vị khác nhau — <b>không cộng dồn giữa các công đoạn</b>. Sản lượng toàn nhà máy chỉ tính từ đơn hoàn thành.</p>`;
}
function sfWMachines(M){
  const ms=M.machines, rows=(sfMachTab==='top'?ms.top:ms.low).slice(0,6);
  const mx=Math.max(1,...ms.rows.map(r=>r.runMs));
  const tabs=`<div class="sf-tabs"><button class="${sfMachTab==='top'?'on':''}" onclick="sfSetMachTab('top')">Chạy nhiều</button><button class="${sfMachTab==='low'?'on':''}" onclick="sfSetMachTab('low')">Chạy ít</button></div>`;
  if(!ms.rows.length) return `<div class="sf-empty">Không có máy phù hợp bộ lọc.</div>`;
  const list=rows.map(r=>`<button class="sf-mrow" onclick="sfOpen('machine','${r.m.id}')" ${sfTip('<b>'+sfEsc(r.m.name)+'</b><br>Chạy: '+sfHrs(r.runMs)+'<br>'+r.pauses+' lần dừng ('+sfHrs(r.pauseMs)+')')}><span class="sf-mn">${sfEsc(r.m.name)}</span><span class="sf-mbar"><i style="width:${Math.max(r.runMs>0?3:0,r.runMs/mx*100)}%"></i></span><b>${r.runMs>0?sfHrs(r.runMs):'0 giờ'}</b></button>`).join('');
  const note=`Giờ chạy lấy từ phiên chạy đã ghi (Tạm dừng/Tiếp tục).${ms.legacy?` ${ms.legacy} phiên cũ không có máy/giờ thật nên không tính.`:''} Chưa xếp hạng “hiệu suất” vì chưa có thời gian kế hoạch và tốc độ chuẩn.`;
  return `${tabs}${ms.anyRun?'':`<div class="sf-empty sm">Chưa có phiên chạy nào được ghi trong kỳ — các máy hiển thị 0 giờ là “chưa ghi nhận”, chưa chắc máy không chạy.</div>`}<div class="sf-mlist">${list}</div><p class="sf-foot">${note}</p>`;
}
function sfWAlerts(M){
  const items=[];
  if(M.sync.state==='offline') items.push({sev:'r',icon:'📡',text:'Thiết bị đang <b>ngoại tuyến</b> — số liệu có thể chưa mới nhất',action:''});
  if(M.sync.state==='error') items.push({sev:'r',icon:'⚠️',text:'<b>Lỗi đồng bộ</b> với máy chủ — kiểm tra kết nối',action:"goTab('settings')"});
  try{ if(typeof buildSmartAlerts==='function') buildSmartAlerts(DB.orders).forEach(a=>items.push(a)); }catch(e){}
  const fail=(DB.qrProducts||[]).filter(p=>p.qcResult==='fail').length;
  if(fail) items.push({sev:'o',icon:'❌',text:`<b>${fail}</b> mã QR / lô QC không đạt`,action:"goTab('qrCode')"});
  if(!items.length) return `<div class="sf-ok">✅ Không có cảnh báo nào.</div>`;
  return `<div class="sf-alerts">${items.slice(0,8).map(a=>`<button class="sf-al ${a.sev}" onclick="${sfEsc(a.action||'')}"><i>${a.icon||'🔔'}</i><span>${a.text}</span></button>`).join('')}</div>`;
}
function sfWOrders(M){
  const l=[...M.orders.list.running, ...M.orders.list.paused].sort((a,b)=>(sfDateTs(a.deliveryDate)||Infinity)-(sfDateTs(b.deliveryDate)||Infinity)).slice(0,8);
  if(!l.length) return `<div class="sf-empty">Hiện không có đơn nào đang sản xuất.</div>`;
  const rows=l.map(o=>{
    const hasP = o.qty>0 && o.doneQty!=null && o.doneQty!=='' && isFinite(Number(o.doneQty));
    const pct = hasP ? Math.min(100,Math.round(Number(o.doneQty)/o.qty*100)) : null;
    const late = typeof ddOverdue==='function' && ddOverdue(o);
    const st = (typeof STAGE_LABEL!=='undefined'&&STAGE_LABEL[o.stage||'dun'])||'—';
    return `<tr onclick="goToOrderInPlan('${sfEsc(o.id)}')"><td><b>${sfEsc(o.customer||'—')}</b><small>${sfEsc(typeof ddCode==='function'?ddCode(o):o.po||'')}</small></td><td><span class="sf-tag${o.status==='paused'?' warn':''}">${o.status==='paused'?'Tạm dừng':sfEsc(st)}</span></td>
      <td>${pct==null?`<small class="sf-na">Chưa cập nhật tiến độ</small>`:`<span class="sf-pb"><i style="width:${Math.max(2,pct)}%"></i></span><small>${pct}% · ${sfNum(o.doneQty)}/${sfNum(o.qty)}</small>`}</td>
      <td class="${late?'sf-bad':''}">${o.deliveryDate?sfEsc(fmtDate(o.deliveryDate)):'<small class="sf-na">Chưa có hạn</small>'}${late?'<small>Quá hạn</small>':''}</td></tr>`;
  }).join('');
  return `<div class="sf-tw"><table class="sf-t"><thead><tr><th>Đơn / Khách hàng</th><th>Công đoạn</th><th>Tiến độ</th><th>Hạn giao</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function sfWQuality(M){
  const q=M.quality, tot=q.pass+q.ng+q.pending;
  const seg=(v,c)=>tot?`<i style="width:${v/tot*100}%;background:${c}"></i>`:'';
  const stg=q.byStage.filter(x=>x.judged||x.pending).map(x=>`<span>${sfEsc((typeof CP_STAGE_LABEL!=='undefined'&&CP_STAGE_LABEL[x.key])||x.key)}: <b>${x.rate==null?'—':sfPct(x.rate)}</b></span>`).join(' · ');
  return `<div class="sf-q3"><button onclick="sfOpen('quality','pass')"><small>Phiếu đạt</small><b class="ok">${sfNum(q.pass)}</b></button><button onclick="sfOpen('quality','fail')"><small>Phiếu NG</small><b class="${q.ng?'bad':''}">${sfNum(q.ng)}</b></button><div><small>Sửa chữa</small><b>${SF_NA('Chưa ghi nhận')}</b></div></div>
    <div class="sf-split">${tot?seg(q.pass,'#34d399')+seg(q.ng,'#f87171')+seg(q.pending,'#64748b'):''}</div>
    <div class="sf-sub">${tot?`Chờ kết luận: <b>${sfNum(q.pending)}</b> · Tỷ lệ đạt: <b>${q.rate==null?'chưa có kết quả':sfPct(q.rate)}</b>${q.ngQty?` · SL NG ghi nhận: <b>${sfNum(q.ngQty)}</b>`:''}`:'Chưa có phiếu Check Sheet công đoạn trong kỳ này.'}</div>
    ${stg?`<div class="sf-sub">Theo công đoạn — ${stg}</div>`:''}
    <p class="sf-foot">Nguồn: ControlPlan QC ▸ Kiểm tra QC – Check Sheet công đoạn (Đùn · Rút · Đánh bóng · Cắt), phiếu đã hoàn tất, không huỷ. Hệ thống chưa có trường “sửa chữa/làm lại”, nên không hiển thị số.</p>`;
}
function sfWInventory(M){
  const w=M.warehouse, fg=w.fg, rm=w.rm;
  const t=(l,v,c,click)=>`<button class="sf-tile" ${click?`onclick="${click}"`:''}><small>${l}</small><b class="${c||''}">${v}</b></button>`;
  return `<h3 class="sf-h3">Thành phẩm (theo đơn hàng)</h3><div class="sf-tiles">
    ${t('Chờ nhập kho',`${fg.wait} <small>đơn · ${sfFmtKg(fg.waitKg)}</small>`,fg.wait?'warn':'',"sfOpen('warehouse','wait')")}
    ${t('Tồn kho (chưa giao)',`${fg.stock} <small>đơn · ${sfFmtKg(fg.stockKg)}</small>`,'',"sfOpen('warehouse','stock')")}
    ${t('Nhập kho trong kỳ',`${fg.inR} <small>đơn · ${sfFmtKg(fg.inRKg)}</small>`,'',"sfOpen('warehouse','inR')")}
    ${t('Đã giao trong kỳ',`${fg.outR} <small>đơn · ${sfFmtKg(fg.outRKg)}</small>`,'',"sfOpen('warehouse','outR')")}</div>
    <h3 class="sf-h3">Nguyên liệu</h3><div class="sf-tiles">
    ${t('Nạp vào sản xuất trong kỳ',rm.lots?`${rm.lots} <small>lô · ${sfFmtKg(rm.kg)}</small>`:SF_NA('Chưa có lô nào trong kỳ'),'',"goTab('soLieu')")}
    ${t('Tồn nguyên liệu',SF_NA('Chưa quản lý tồn'),'')}</div>
    <p class="sf-foot">Tồn thành phẩm = đơn đã nhập kho nhưng chưa giao (theo cờ trên đơn). Hệ thống chưa có sổ nhập/xuất/tồn nguyên liệu.</p>`;
}
function sfWWorkforce(M){
  const w=M.workforce;
  if(!w.available) return `<div class="sf-empty">${w.error?'Không đọc được lịch ca.':'Chưa có dữ liệu nhân sự / lịch làm việc.'} Vào tab <b>Lịch làm việc</b> để xếp ca.</div>`;
  const t=w.totals, sel=M.f.shift?'ca'+M.f.shift:'';
  const rows=w.shifts.map(s=>{ const pct=s.min?Math.min(100,s.actual/s.min*100):(s.actual?100:0);
    return `<div class="sf-shift${sel&&s.id===sel?' sel':''}${sel&&s.id!==sel?' dim':''}"><div><span>${sfEsc(s.name)}</span><b>${s.actual}${s.min?` / ${s.min}`:''} người</b></div><span class="sf-pb"><i style="width:${Math.max(s.actual?3:0,pct)}%;background:${s.short?'#fbbf24':'#34d399'}"></i></span>${s.short?`<small class="sf-warn">Thiếu ${s.short} người</small>`:''}</div>`; }).join('');
  return `<div class="sf-sub">Ngày ${sfEsc(typeof fmtDate==='function'?fmtDate(w.ds):w.ds)}</div>${rows||'<div class="sf-empty sm">Chưa có ca nào được xếp.</div>'}
    <div class="sf-tiles s4"><div class="sf-tile"><small>Nhân sự</small><b>${t.workers}</b></div><div class="sf-tile"><small>Nghỉ</small><b>${t.leave}</b></div><div class="sf-tile"><small>Tăng ca</small><b>${t.ot}</b></div><div class="sf-tile"><small>Chưa xếp ca</small><b class="${t.unassigned?'warn':''}">${t.unassigned}</b></div></div>
    <button class="sf-link" onclick="goTab('lichLamViec')">Mở Lịch làm việc ›</button>`;
}
function sfWAi(){
  let h=''; try{ (aiGetInsights(DB.orders)||[]).concat(buildForemanSuggestions(DB.orders)||[]).slice(0,8).forEach(i=>{ h+=`<div class="sf-ins"><i>${i.icon}</i><span>${i.text}</span></div>`; }); }catch(e){}
  return h||`<div class="sf-ok">✅ Chưa có đề xuất nào.</div>`;
}
function sfWActivity(){ try{ return `<div class="sf-act">${buildOvRecentActivity()}</div>`; }catch(e){ return `<div class="sf-empty">Không đọc được nhật ký.</div>`; } }

const SF_BODY = {oee:sfWOee, output:sfWOutput, progress:sfWProgress, stages:sfWStages, machines:sfWMachines, alerts:sfWAlerts, orders:sfWOrders, quality:sfWQuality, inventory:sfWInventory, workforce:sfWWorkforce, ai:sfWAi, activity:sfWActivity};
function sfWidgetHtml(item, M){
  const w=SF_WIDGETS.find(x=>x.id===item.id); if(!w) return '';
  let body, head='';
  try{
    body = SF_BODY[w.id](M);
    if(w.id==='orders') head=`<button class="sf-link" onclick="goToKeHoachFilter('running')">Xem tất cả ›</button>`;
    if(w.id==='alerts') head=`<button class="sf-link" onclick="sfOpen('alerts','')">Xem tất cả ›</button>`;
  }catch(e){ console.warn('[sf-widget]', w.id, e); body=`<div class="sf-empty bad">Không hiển thị được widget này. <button class="sf-link" onclick="renderDashboard()">Thử lại</button></div>`; }
  return `<div class="sf-w sf-c${item.span}">${sfPanel(w,M,body,head)}</div>`;
}

// ── Trạng thái toàn trang ───────────────────────────────────────────
function sfStatusBanner(M){
  const s=M.sync.state, ago = M.sync.at && typeof fmtSyncAgo==='function' ? fmtSyncAgo(M.sync.at) : '';
  if(s==='offline') return `<div class="sf-state bad" role="status">📡 Ngoại tuyến — đang hiển thị dữ liệu đã lưu trên thiết bị${ago?` (đồng bộ gần nhất: ${sfEsc(ago)})`:''}.</div>`;
  if(s==='error') return `<div class="sf-state bad" role="alert">⚠️ Lỗi đồng bộ với máy chủ — số liệu có thể chưa mới nhất. <button class="sf-link" onclick="renderDashboard()">Làm mới</button></div>`;
  if(s==='pending' && !M.empty) return `<div class="sf-state warn" role="status">⏳ Chưa đồng bộ với máy chủ — đang dùng dữ liệu lưu trên thiết bị, số liệu có thể chưa đầy đủ.</div>`;
  if(s==='local') return `<div class="sf-state warn" role="status">Thiết bị đang ở chế độ cục bộ (không dùng Firebase) — số liệu chỉ gồm dữ liệu trên máy này.</div>`;
  return '';
}
function sfSkeleton(){
  return `<div class="sf-wrap sf-sk" aria-busy="true" aria-label="Đang tải dữ liệu"><div class="sf-state warn">⏳ Đang tải dữ liệu từ máy chủ…</div><div class="sf-skg">${'<i></i>'.repeat(5)}</div><div class="sf-skg b">${'<i></i>'.repeat(3)}</div></div>`;
}

// ── Render chính ────────────────────────────────────────────────────
function renderDashboard(){
  const mc = document.getElementById('mc'); if(!mc) return;
  if(sfLS(SF_LS_CLASSIC)==='1'){ renderDashboardClassic(); sfClassicBar(mc); return; }
  if(sfRenderBusy) return; sfRenderBusy=true;
  try{
    sfF.anchor = typeof sfF.anchor==='number' ? sfF.anchor : Date.now();
    const empty = !(DB.orders||[]).length, st = sfSyncState();
    if(empty && st.state==='pending'){ mc.innerHTML = sfSkeleton(); sfLoadShared(); sfStartTimers(); return; }
    const M = sfBuild(sfF); sfLastM = M;
    const layout = sfGetLayout();
    const widgets = layout.filter(i=>i.show).map(i=>sfWidgetHtml(i,M)).join('');
    mc.innerHTML = `<div class="sf-wrap${sfTv?' tv':''}" id="sfWrap">${sfTv?`<button class="sf-tvx" onclick="sfToggleTv()">✕ Thoát TV Mode</button>`:''}${sfBanner(M)}${sfStatusBanner(M)}${sfTv?'':sfFilters(M)}${sfKpis(M)}<div class="sf-grid">${widgets||'<div class="sf-empty">Tất cả widget đang bị ẩn. Admin có thể bật lại ở “Tùy chỉnh”.</div>'}</div></div>`;
    sfLoadShared(); sfStartTimers(); sfApplyTv();
  }catch(e){
    console.error('[dashboard-sf] lỗi render, chuyển về giao diện cũ', e);
    try{ renderDashboardClassic(); const b=document.createElement('div'); b.className='sf-state bad'; b.textContent='Không dựng được Tổng quan mới (đã chuyển về giao diện cũ). '+(e&&e.message||''); mc.insertBefore(b, mc.firstChild); }
    catch(e2){ mc.innerHTML=`<div class="sf-state bad">Không hiển thị được Tổng quan. <button class="sf-link" onclick="renderDashboard()">Thử lại</button></div>`; }
  }finally{ sfRenderBusy=false; }
}
function sfClassicBar(mc){
  const b=document.createElement('div'); b.className='sf-classicbar';
  b.innerHTML=`Đang dùng giao diện Tổng quan cũ. <button class="sf-link" onclick="sfSetClassic(false)">Chuyển sang giao diện Smart Factory ›</button>`;
  mc.insertBefore(b, mc.firstChild);
}
function sfSetClassic(on){ sfLS(SF_LS_CLASSIC, on?'1':null); renderDashboard(); }

// ── Tương tác ───────────────────────────────────────────────────────
function sfSaveF(){ sfLS(SF_LS_F, JSON.stringify({period:sfF.period,stage:sfF.stage,machine:sfF.machine,shift:sfF.shift})); }
function sfSetF(k,v){
  if(k==='plant') return;
  sfF[k]=v;
  if(k==='stage' && sfF.machine && v){ const m=MACHINES.find(x=>x.id===sfF.machine); const st=ASSIGN_STAGES.find(s=>s.key===v); if(m&&st&&m.group!==st.group) sfF.machine=''; }
  sfSaveF(); renderDashboard();
}
function sfClearF(){ sfF.stage=sfF.machine=sfF.shift=''; sfSaveF(); renderDashboard(); }
function sfSetAnchor(s){ const t=sfDateTs(s); if(t!==null){ sfF.anchor=t; renderDashboard(); } }
function sfToday(){ sfF.anchor=Date.now(); renderDashboard(); }
function sfShift(dir){
  const R=sfRange(sfF.period, sfF.anchor), d=new Date(R.from);
  if(sfF.period==='day') sfF.anchor=sfAddDays(R.from,dir);
  else if(sfF.period==='week') sfF.anchor=sfAddDays(R.from,7*dir);
  else if(sfF.period==='month') sfF.anchor=new Date(d.getFullYear(),d.getMonth()+dir,1).getTime();
  else sfF.anchor=new Date(d.getFullYear()+dir,0,1).getTime();
  renderDashboard();
}
function sfSetMachTab(t){ sfMachTab=t; renderDashboard(); }

function sfOrderList(list){
  if(!list.length) return `<div class="ds-empty">Không có đơn nào.</div>`;
  return typeof dpOrderRows==='function' ? dpOrderRows(list) : list.map(o=>`<div class="dp-li"><b>${sfEsc(o.customer||'—')}</b></div>`).join('');
}
function sfOpen(kind, arg){
  const M=sfLastM; if(!M || typeof dpDrawer!=='function') return;
  let title='', body='';
  const def=(t,html)=>{ title=t; body=html; };
  if(kind==='orders') def('Đơn hàng trong phạm vi', ['new','running','paused','done','overdue'].map(k=>`<div class="dp-sec">${{new:'Mới / chờ SX',running:'Đang sản xuất',paused:'Tạm dừng',done:'Hoàn thành trong kỳ',overdue:'Quá hạn'}[k]} (${M.orders.list[k].length})</div>${sfOrderList(M.orders.list[k])}`).join('')+sfDefNote('Phạm vi = đơn chưa hoàn thành (hiện tại) + đơn hoàn thành trong kỳ. Quá hạn tính theo hôm nay.'));
  else if(kind==='output') def(arg==='plan'?'Đơn có hạn giao trong kỳ':'Đơn hoàn thành trong kỳ', (arg==='plan'?`<div class="dp-sec">Chưa hoàn thành — còn thiếu ${sfFmtKg(M.output.missingKg)} (${M.output.list.missing.length})</div>${sfOrderList(M.output.list.missing)}<div class="dp-sec">Đã hoàn thành (${M.output.planDoneCount})</div>${sfOrderList(M.output.list.plan.filter(o=>o.status==='done'))}`:sfOrderList(M.output.list.actual))+sfDefNote('Kế hoạch = tổng kg đơn có hạn giao trong kỳ. Thực tế = tổng kg đơn hoàn thành trong kỳ (kg theo đơn, mỗi đơn tính 1 lần). Hoàn thành kế hoạch = kg đơn đến hạn đã xong ÷ kg đơn đến hạn.'));
  else if(kind==='bucket'){ const b=M.B[+arg]; if(!b) return;
    const pl=(DB.orders||[]).filter(o=>sfOrderPass(o,M.f)&&sfIn(sfDateTs(o.deliveryDate),b.from,b.to)), ac=(DB.orders||[]).filter(o=>sfOrderPass(o,M.f)&&o.status==='done'&&sfIn(Number(o.doneAt),b.from,b.to));
    def(b.label, `<div class="dp-sec">Hoàn thành (${ac.length} đơn · ${sfFmtKg(ac.reduce((s,o)=>s+sfKg(o),0))})</div>${sfOrderList(ac)}<div class="dp-sec">Đến hạn giao (${pl.length} đơn · ${sfFmtKg(pl.reduce((s,o)=>s+sfKg(o),0))})</div>${sfOrderList(pl)}`); }
  else if(kind==='progress'){ const l=M.progress[arg]||[]; def({ontrack:'Đúng tiến độ',risk:'Nguy cơ trễ hạn (≤48 giờ)',overdue:'Quá hạn',nodue:'Chưa có hạn giao'}[arg]||'Đơn', sfOrderList(l)+sfDefNote('Chỉ tính đơn đang mở. “Chưa có hạn giao” được tách riêng, không coi là đúng tiến độ.')); }
  else if(kind==='quality'){ const L=M.quality.lists; const lbl=r=>r.result==='OK'?'Đạt':r.result==='NG'?'NG':'Chờ kết luận';
    const row=r=>`<div class="dp-li" onclick="dpCloseDrawer();goTab('controlPlan')"><b>${sfEsc(r.code||r.id)} · ${sfEsc((typeof CP_STAGE_LABEL!=='undefined'&&CP_STAGE_LABEL[r.form])||r.form)}</b><span>${sfEsc(r.date||'')} · ${sfEsc(r.machine||'chưa chọn máy')} · ${sfEsc(r.shift||'')} · ${sfEsc(r.customer||'')} ${r.lot?'· lô '+sfEsc(r.lot):''}</span><em>${lbl(r)}</em></div>`;
    const part=(t,l)=>`<div class="dp-sec">${t} (${l.length})</div>${l.length?l.slice(0,200).map(row).join(''):'<div class="ds-empty">Không có.</div>'}`;
    const bs=M.quality.byStage.map(x=>`<div class="dp-li"><b>${sfEsc((typeof CP_STAGE_LABEL!=='undefined'&&CP_STAGE_LABEL[x.key])||x.key)}</b><span>Đạt ${x.pass} · NG ${x.ng}${x.pending?' · chờ '+x.pending:''}</span><em>${x.rate==null?'—':sfPct(x.rate)}</em></div>`).join('');
    def('Chất lượng — Check Sheet công đoạn trong kỳ', `<div class="dp-sec">Tỷ lệ đạt theo công đoạn</div>${bs}`+(arg==='pass'?part('Đạt',L.pass):arg==='fail'?part('NG',L.fail):part('NG',L.fail)+part('Chờ kết luận',L.pend)+part('Đạt',L.pass))+sfDefNote('Tính theo SỐ PHIẾU Check Sheet công đoạn (ControlPlan QC) đã hoàn tất, không huỷ. Tỷ lệ đạt = phiếu OK ÷ (OK + NG); phiếu chưa kết luận không tính vào tỷ lệ. “Sửa chữa” chưa có trường dữ liệu.')); }
  else if(kind==='delivery') def('Đơn đã giao trong kỳ', `<div class="dp-sec">Giao trễ (${M.delivery.late.length})</div>${sfOrderList(M.delivery.late)}<div class="dp-sec">Tất cả đã giao (${M.delivery.n})</div>${sfOrderList(M.delivery.list)}`+sfDefNote('Đúng hạn = ngày giao thực tế ≤ hạn giao. Chỉ tính đơn đã đánh dấu “đã giao”.'));
  else if(kind==='warehouse') def({wait:'Chờ nhập kho',stock:'Tồn kho thành phẩm (chưa giao)',inR:'Nhập kho trong kỳ',outR:'Đã giao trong kỳ'}[arg]||'Kho', sfOrderList(M.warehouse.fg.lists[arg]||[]));
  else if(kind==='stage'){ const s=M.stages.rows.find(x=>x.key===arg); if(!s) return;
    const rows=s.list.slice(0,150).map(r=>`<div class="dp-li"><b>${sfEsc(r.ngay)} · ${sfEsc(r.quyCach||r.nguyenLieu||'—')}</b><span>${sfEsc(r.may||'—')}${r.ca?' · Ca '+sfEsc(r.ca):''} · ${r.donHangId?'đã gắn đơn':'chưa gắn đơn'}</span><em>${sfNum(r.soThanh!=null?r.soThanh:r.soLuong,1)} ${r.soThanh!=null?'thanh':'kg'}</em></div>`).join('');
    def(s.label+' — sổ trong kỳ', `<button class="ds-btn sm" onclick="dpOpenStageList('${s.key}')">Xem đơn đang chạy / chờ vào</button>${rows||'<div class="ds-empty">Không có dòng sổ nào trong kỳ.</div>'}`); }
  else if(kind==='machine'){ const r=M.machines.rows.find(x=>x.m.id===arg); if(!r) return;
    def(r.m.name, `<div class="sf-sub">Chạy: <b>${sfHrs(r.runMs)}</b> · ${r.pauses} lần dừng (${sfHrs(r.pauseMs)}) · OEE: ${(()=>{ const x=(M.oee.rows||[]).find(y=>y.m.id===r.m.id); return x&&x.ok ? '<b>'+sfPct(x.value)+'</b>' : SF_NA(x&&x.why?x.why:'Chưa đủ dữ liệu'); })()}</div>`+(r.rows.length?r.rows.map(x=>`<div class="dp-li" onclick="dpCloseDrawer();goToOrderInPlan('${sfEsc(x.o.id)}')"><b>${sfEsc(x.o.customer||'—')}</b><span>${sfEsc((STAGE_LABEL||{})[x.stage]||x.stage||'')}</span><em>${sfHrs(x.ms)}</em></div>`).join(''):'<div class="ds-empty">Chưa có phiên chạy trong kỳ.</div>')); }
  else if(kind==='oee'){ const O=M.oee, c=x=>x==null?'<small class="sf-na">—</small>':sfPct(x);
    const trs=O.rows.map(x=>`<tr><td>${sfEsc(x.m.name)}${x.rate?`<br><small>${x.rate.kgh} kg/h · ${sfEsc(x.rate.model)}</small>`:''}</td><td>${sfHrs(x.runMs)}</td><td>${x.hasPlan?sfHrs(x.planMs):'<small class="sf-na">—</small>'}</td><td>${c(x.A)}</td><td>${c(x.P)}</td><td>${c(x.Q)}</td><td>${x.ok?'<b>'+sfPct(x.value)+'</b>':`<small class="sf-na" title="${sfEsc(x.why)}">Chưa đủ</small>`}</td></tr>`).join('');
    def('Từng máy — OEE', `<table class="sf-t"><thead><tr><th>Máy</th><th>Giờ chạy</th><th>Giờ kế hoạch</th><th>Khả dụng</th><th>Hiệu suất</th><th>Chất lượng</th><th>OEE</th></tr></thead><tbody>${trs}</tbody></table>`+
      O.rows.filter(x=>!x.ok&&x.why).map(x=>`<div class="dp-li"><b>${sfEsc(x.m.name)}</b><span>Thiếu: ${sfEsc(x.why)}</span></div>`).join('')+
      `<div class="dp-sec">Đầu vào OEE</div>`+O.inputs.map(i=>`<div class="dp-li"><b>${i.ok?'✔':'✖'} ${sfEsc(i.label)}</b><span>${sfEsc(i.note)}</span></div>`).join('')+
      sfDefNote('OEE = Khả dụng × Hiệu suất × Chất lượng. • Khả dụng = giờ chạy thực tế ÷ giờ kế hoạch (đơn gán máy ở tab Kế hoạch SX, từ lúc bắt đầu chạy đến khi xong/hiện tại, nhân ca có người trong Lịch làm việc, trừ nghỉ giữa ca). • Hiệu suất = kg đùn thực tế (sổ Đùn của máy) ÷ (giờ chạy × công suất kg/giờ trong file Thông số máy), tối đa 100%. • Chất lượng = phiếu Check Sheet công đoạn đạt ÷ đã kết luận của đúng máy đó. Chỉ Máy đùn có công suất; Rút/Đánh bóng/Cắt chưa có nên chưa tính OEE.')); }
  else if(kind==='alerts'){ let h=''; try{ h=buildDpAlerts(DB.orders); }catch(e){} def('Cảnh báo quan trọng', h); }
  dpDrawer(sfEsc(title), body);
}
function sfDefNote(t){ return `<p class="dp-note" style="margin-top:12px">ⓘ ${sfEsc(t)}</p>`; }

// ── Tùy chỉnh widget (Admin) ────────────────────────────────────────
function sfOpenCustomize(){
  if(!(typeof isAdmin==='function' && isAdmin()) || typeof dpDrawer!=='function') return;
  const L=sfGetLayout();
  const rows=L.map((it,i)=>{ const w=SF_WIDGETS.find(x=>x.id===it.id);
    return `<div class="sf-cz"><label><input type="checkbox" ${it.show?'checked':''} onchange="sfCz(${i},'show',this.checked)"> ${sfEsc(w.title)}</label>
      <select onchange="sfCz(${i},'span',this.value)" aria-label="Độ rộng">${[[3,'Hẹp'],[4,'Vừa hẹp'],[5,'Vừa'],[6,'Nửa hàng'],[8,'Rộng'],[12,'Cả hàng']].map(([v,l])=>`<option value="${v}"${it.span===v?' selected':''}>${l}</option>`).join('')}</select>
      <button class="ds-btn sm" onclick="sfCz(${i},'up')" ${i?'':'disabled'} aria-label="Lên">↑</button><button class="ds-btn sm" onclick="sfCz(${i},'down')" ${i<L.length-1?'':'disabled'} aria-label="Xuống">↓</button></div>`; }).join('');
  dpDrawer('⚙ Tùy chỉnh Tổng quan', `<p class="dp-note">Bố cục được lưu cho toàn bộ người dùng (đồng bộ qua máy chủ); thiết bị chưa đồng bộ được vẫn giữ bản lưu trên máy này.</p>${rows}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="ds-btn sm" onclick="sfCzReset()">Khôi phục mặc định</button><button class="ds-btn sm" onclick="sfSetClassic(true);dpCloseDrawer()">Dùng giao diện Tổng quan cũ</button></div>`);
}
function sfCz(i,k,v){
  const L=sfGetLayout(); if(!L[i]) return;
  if(k==='show') L[i].show=!!v; else if(k==='span') L[i].span=+v;
  else if(k==='up' && i>0){ const t=L[i]; L[i]=L[i-1]; L[i-1]=t; }
  else if(k==='down' && i<L.length-1){ const t=L[i]; L[i]=L[i+1]; L[i+1]=t; }
  sfSaveLayout(); renderDashboard(); sfOpenCustomize();
}
function sfCzReset(){ sfLayout=sfDefaultLayout(); sfSaveLayout(); renderDashboard(); sfOpenCustomize(); }

// ── TV Mode ─────────────────────────────────────────────────────────
function sfApplyTv(){
  document.body.classList.toggle('sf-tv', sfTv && currentTab==='dashboard');
  sfWakeSync();
}
function sfToggleTv(){
  sfTv=!sfTv; sfLS(SF_LS_TV, sfTv?'1':null);
  try{ if(sfTv){ if(typeof dhFsRequest==='function') dhFsRequest(document.documentElement); } else if(typeof dhFsExit==='function' && typeof dhFsElement==='function' && dhFsElement()) dhFsExit(); }catch(e){}
  renderDashboard();
  if(!sfTv) document.body.classList.remove('sf-tv');
}
async function sfWakeSync(){
  try{
    if(!('wakeLock' in navigator)) return;
    const want = sfTv && currentTab==='dashboard' && !document.hidden;
    if(want && !sfWake) { sfWake = await navigator.wakeLock.request('screen'); sfWake.addEventListener('release',()=>{ sfWake=null; }); }
    else if(!want && sfWake){ const w=sfWake; sfWake=null; await w.release(); }
  }catch(e){ sfWake=null; }
}
['fullscreenchange','webkitfullscreenchange'].forEach(ev=>document.addEventListener(ev,()=>{
  if(sfTv && currentTab==='dashboard' && typeof dhFsElement==='function' && !dhFsElement()){ /* thoát fullscreen bằng Esc: giữ bố cục TV, nút ✕ để thoát hẳn */ }
}));
document.addEventListener('visibilitychange', ()=>{ sfWakeSync(); if(!document.hidden && currentTab==='dashboard' && sfLS(SF_LS_CLASSIC)!=='1') renderDashboard(); });

// ── Đồng hồ + tự cập nhật (nhẹ: chỉ đổi text đồng hồ mỗi giây; vẽ lại 60 giây/lần) ──
function sfStartTimers(){
  if(!sfClockT) sfClockT=setInterval(()=>{
    const el=document.getElementById('sfClock'); if(!el) return;
    const d=new Date(typeof nowSrv==='function'?nowSrv():Date.now());
    el.textContent=sfPad(d.getHours())+':'+sfPad(d.getMinutes())+':'+sfPad(d.getSeconds());
  },1000);
  if(!sfAutoT) sfAutoT=setInterval(()=>{ if(currentTab==='dashboard' && !document.hidden && sfLS(SF_LS_CLASSIC)!=='1') renderDashboard(); }, sfTv?30000:60000);
}
['online','offline'].forEach(ev=>window.addEventListener(ev,()=>{ if(currentTab==='dashboard') renderDashboard(); }));
