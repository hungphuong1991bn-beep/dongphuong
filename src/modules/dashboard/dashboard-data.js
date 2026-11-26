// src/modules/dashboard/dashboard-data.js — Tổng quan Smart Factory: LỚP DỮ LIỆU (CHỈ ĐỌC)
// ────────────────────────────────────────────────────────────────────
// • Không ghi DB, không sửa dữ liệu gốc. Mọi hàm là hàm thuần trên DB hiện có.
// • Quy tắc số liệu:
//   - "Chưa có dữ liệu" (null) ≠ "bằng 0" (0) ≠ "chưa đồng bộ" (M.sync.state==='pending').
//   - Sản lượng toàn nhà máy = đơn HOÀN THÀNH (1 lần, không cộng dồn các công đoạn).
//     Từng công đoạn đọc sổ riêng của công đoạn đó, hiển thị riêng, KHÔNG cộng với nhau.
//   - OEE chỉ hiện khi ĐỦ đầu vào (thời gian kế hoạch + tốc độ chuẩn + thời gian chạy + chất lượng).
// ────────────────────────────────────────────────────────────────────
const SF_DAY = 86400000;
const SF_STAGE_KEYS = ['dun','rut','danhbong','cat'];

function sfDateTs(s){                       // 'YYYY-MM-DD' → 0h GIỜ ĐỊA PHƯƠNG (null nếu sai)
  if(typeof s!=='string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if(!m) return null;
  return new Date(+m[1], +m[2]-1, +m[3]).getTime();
}
function sfAddDays(ts, n){ const d=new Date(ts); d.setDate(d.getDate()+n); return d.getTime(); }
function sfDay0(ts){ const d=new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }
function sfIn(ts, a, b){ return typeof ts==='number' && isFinite(ts) && ts>=a && ts<b; }
function sfKg(o){ const v = parseFloat(o && o.kg); return v>0 ? v : 0; }
function sfArr(v){ return Array.isArray(v) ? v : (v && typeof v==='object' ? Object.keys(v).map(k=>v[k]) : []); }
function sfSessions(o){ return (typeof rcSessions==='function') ? sfArr(rcSessions(o)) : sfArr(o && o.runSessions); }
function sfPauses(o){ return (typeof rcPauses==='function') ? sfArr(rcPauses(o)) : sfArr(o && o.pauseHistory); }

// ── Khoảng thời gian ───────────────────────────────────────────────
function sfRange(period, anchorTs){
  const a = sfDay0(anchorTs); let from, to;
  if(period==='day'){ from=a; to=sfAddDays(a,1); }
  else if(period==='week'){ const dow=(new Date(a).getDay()+6)%7; from=sfAddDays(a,-dow); to=sfAddDays(from,7); }
  else if(period==='month'){ const d=new Date(a); from=new Date(d.getFullYear(),d.getMonth(),1).getTime(); to=new Date(d.getFullYear(),d.getMonth()+1,1).getTime(); }
  else { const d=new Date(a); from=new Date(d.getFullYear(),0,1).getTime(); to=new Date(d.getFullYear()+1,0,1).getTime(); }
  return {from, to, period};
}
function sfPrevRange(r){
  const d=new Date(r.from);
  if(r.period==='day') return sfRange('day', sfAddDays(r.from,-1));
  if(r.period==='week') return sfRange('week', sfAddDays(r.from,-7));
  if(r.period==='month') return sfRange('month', new Date(d.getFullYear(),d.getMonth()-1,1).getTime());
  return sfRange('year', new Date(d.getFullYear()-1,0,1).getTime());
}
const SF_DOW = ['CN','T2','T3','T4','T5','T6','T7'];
function sfPad(n){ return String(n).padStart(2,'0'); }
function sfBuckets(r){
  const out=[];
  if(r.period==='year'){
    const y=new Date(r.from).getFullYear();
    for(let m=0;m<12;m++) out.push({from:new Date(y,m,1).getTime(), to:new Date(y,m+1,1).getTime(), label:'Tháng '+(m+1), short:'T'+(m+1)});
    return out;
  }
  let start, n;
  if(r.period==='day'){ start=sfAddDays(r.from,-6); n=7; }
  else if(r.period==='week'){ start=r.from; n=7; }
  else { start=r.from; n=Math.round((r.to-r.from)/SF_DAY); }
  for(let i=0;i<n;i++){
    const f=sfAddDays(start,i), d=new Date(f);
    const dm=sfPad(d.getDate())+'/'+sfPad(d.getMonth()+1);
    out.push({from:f, to:sfAddDays(f,1), label:SF_DOW[d.getDay()]+' '+dm, short: r.period==='month' ? String(d.getDate()) : dm});
  }
  return out;
}
function sfRangeLabel(r){
  const f=new Date(r.from), t=new Date(r.to-1);
  const dm=d=>sfPad(d.getDate())+'/'+sfPad(d.getMonth()+1)+'/'+d.getFullYear();
  if(r.period==='day') return dm(f);
  if(r.period==='month') return 'Tháng '+(f.getMonth()+1)+'/'+f.getFullYear();
  if(r.period==='year') return 'Năm '+f.getFullYear();
  return dm(f)+' – '+dm(t);
}

// ── Bộ lọc ─────────────────────────────────────────────────────────
function sfNormFilter(f){
  f = f || {};
  const p = ['day','week','month','year'].indexOf(f.period)>=0 ? f.period : 'day';
  const anchor = typeof f.anchor==='number' && isFinite(f.anchor) ? f.anchor : Date.now();
  const stage = SF_STAGE_KEYS.indexOf(f.stage)>=0 ? f.stage : '';
  const machine = (typeof MACHINES!=='undefined' && MACHINES.some(m=>m.id===f.machine)) ? f.machine : '';
  const shift = ['1','2','3'].indexOf(String(f.shift))>=0 ? String(f.shift) : '';
  return {period:p, anchor, stage, machine, shift};
}
function sfStatusKey(o){
  const s=o && o.status;
  if(s==='done') return 'done'; if(s==='paused') return 'paused';
  if(s==='running'||s==='cutting') return 'running'; return 'new';
}
function sfTouchesStage(o, st){
  if((o.stage||'dun')===st && sfStatusKey(o)!=='done' && sfStatusKey(o)!=='new') return true;
  if(sfSessions(o).some(s=>s && s.stage===st)) return true;
  return !!(o.machineAssign && o.machineAssign[st]);
}
function sfTouchesMachine(o, mid){
  if(sfSessions(o).some(s=>s && s.machineId===mid)) return true;
  const has = obj => obj && typeof obj==='object' && Object.keys(obj).some(k=>{ const v=obj[k]; return v===mid || (v && v.machineId===mid); });
  return has(o.machineAssign) || has(o.machineActiveAt) || has(o.machineHistory);
}
function sfOrderPass(o, f){
  if(!o) return false;
  if(f.stage && !sfTouchesStage(o, f.stage)) return false;
  if(f.machine && !sfTouchesMachine(o, f.machine)) return false;
  return true;   // lọc theo CA không áp dụng được cho đơn hàng (đơn không ghi ca) → M.unsupported
}
function sfMachineName(id){ const m=(typeof MACHINES!=='undefined')&&MACHINES.find(x=>x.id===id); return m?m.name:id; }
function sfMachineByName(n){ return (typeof MACHINES!=='undefined') ? MACHINES.find(x=>x.name===n) : null; }

// ── Trạng thái đồng bộ ─────────────────────────────────────────────
// state: 'local' (không dùng Firebase) | 'offline' | 'error' | 'pending' (chưa đồng bộ lần nào) | 'ok'
function sfSyncState(){
  try{
    if(typeof fbOk==='function' && !fbOk()) return {state:'local', at:null};
    if(typeof navigator!=='undefined' && navigator.onLine===false) return {state:'offline', at:(typeof _lastSyncOkAt!=='undefined'?_lastSyncOkAt:null)};
    const dot = typeof document!=='undefined' && document.getElementById('syncDot');
    const cls = dot ? dot.className : '';
    const at = (typeof _lastSyncOkAt!=='undefined') ? _lastSyncOkAt : null;
    if(/\berror\b/.test(cls)) return {state:'error', at};
    if(/net-off/.test(cls)) return {state:'offline', at};
    if(!at) return {state:'pending', at:null};
    return {state:'ok', at};
  }catch(e){ return {state:'pending', at:null}; }
}

// ── Mô hình chính ──────────────────────────────────────────────────
function sfBuild(fIn, nowIn){
  const f = sfNormFilter(fIn), now = nowIn || Date.now();
  const R = sfRange(f.period, f.anchor), P = sfPrevRange(R), B = sfBuckets(R);
  const all = (typeof DB!=='undefined' && DB.orders) ? DB.orders : [];
  const orders = all.filter(o=>sfOrderPass(o,f));
  const M = {f, R, P, B, now, sync: sfSyncState(), unsupported:{}, empty: !all.length};
  if(f.shift) M.unsupported.orders = ['Ca'];

  // 1) Đơn hàng
  const isOpen = o => o.status!=='done';
  const doneIn = (o,r) => o.status==='done' && sfIn(Number(o.doneAt), r.from, r.to);
  const scope = orders.filter(o=>isOpen(o) || doneIn(o,R));
  const cnt = {new:0,running:0,paused:0,done:0}; let overdue=0;
  scope.forEach(o=>{ cnt[sfStatusKey(o)]++; if(typeof ddOverdue==='function' && ddOverdue(o)) overdue++; });
  const createdIn = r => orders.filter(o=>sfIn(Number(o.createdAt), r.from, r.to));
  M.orders = {
    total: scope.length, new:cnt.new, running:cnt.running, paused:cnt.paused, done:cnt.done, overdue,
    createdR: createdIn(R).length, createdP: createdIn(P).length,
    bucketCreated: B.map(b=>orders.filter(o=>sfIn(Number(o.createdAt), b.from, b.to)).length),
    list:{ all:scope, new:scope.filter(o=>sfStatusKey(o)==='new'), running:scope.filter(o=>sfStatusKey(o)==='running'),
           paused:scope.filter(o=>sfStatusKey(o)==='paused'), done:scope.filter(o=>sfStatusKey(o)==='done'),
           overdue:scope.filter(o=>typeof ddOverdue==='function' && ddOverdue(o)) }
  };

  // 2) Sản lượng & kế hoạch (kg)  — kế hoạch: đơn có hạn giao trong kỳ; thực tế: đơn hoàn thành trong kỳ
  const dueTs = o => sfDateTs(o.deliveryDate);
  const planOrders = r => orders.filter(o=>sfIn(dueTs(o), r.from, r.to));
  const sumKg = l => l.reduce((s,o)=>s+sfKg(o),0);
  const planR = planOrders(R), planP = planOrders(P);
  const planDoneR = planR.filter(o=>o.status==='done');
  const actualR = orders.filter(o=>doneIn(o,R)), actualP = orders.filter(o=>doneIn(o,P));
  const noDue = orders.filter(o=>isOpen(o) && !o.deliveryDate);
  M.output = {
    planKg:sumKg(planR), actualKg:sumKg(actualR), planDoneKg:sumKg(planDoneR),
    missingKg:sumKg(planR.filter(o=>o.status!=='done')),
    planKgP:sumKg(planP), actualKgP:sumKg(actualP),
    planCount:planR.length, planDoneCount:planDoneR.length,
    pct: planR.length && sumKg(planR)>0 ? sumKg(planDoneR)/sumKg(planR) : null,
    pctP: planP.length && sumKg(planP)>0 ? sumKg(planP.filter(o=>o.status==='done'))/sumKg(planP) : null,
    noKgOrders: scope.filter(o=>!sfKg(o)).length,
    noDueOpen: noDue.length,
    bucketPlan: B.map(b=>sumKg(planOrders(b))),
    bucketActual: B.map(b=>sumKg(orders.filter(o=>doneIn(o,b)))),
    bucketPct: B.map(b=>{ const l=planOrders(b), k=sumKg(l); return l.length&&k>0 ? sumKg(l.filter(o=>o.status==='done'))/k : null; }),
    list:{ plan:planR, actual:actualR, missing:planR.filter(o=>o.status!=='done') }
  };

  // 3) Tiến độ đơn đang mở: đúng tiến độ / nguy cơ trễ (≤48h) / quá hạn / chưa có hạn giao
  const t0 = sfDay0(now), open = orders.filter(isOpen);
  const prog = {ontrack:[], risk:[], overdue:[], nodue:[]};
  open.forEach(o=>{
    if(!o.deliveryDate){ prog.nodue.push(o); return; }
    if(typeof ddOverdue==='function' && ddOverdue(o)){ prog.overdue.push(o); return; }
    const d = dueTs(o);
    if(d!==null && d - t0 <= 2*SF_DAY && !o.delivered) prog.risk.push(o); else prog.ontrack.push(o);
  });
  const withDue = prog.ontrack.length+prog.risk.length+prog.overdue.length;
  M.progress = {...prog, openTotal:open.length, withDue, pct: withDue ? prog.ontrack.length/withDue : null};

  // 4) Chất lượng — theo mã QR (DB.qrProducts); "sửa chữa" chưa có trường dữ liệu
  const qrAll = (DB.qrProducts||[]);
  const qrTs = p => { const d = sfDateTs(p.prodDate); return d!==null ? d : Number(p.createdAt); };
  const qrIn = (r)=>qrAll.filter(p=>{
    if(!sfIn(qrTs(p), r.from, r.to)) return false;
    if(f.stage && p.currentStage && p.currentStage!==f.stage && f.stage!=='' && SF_STAGE_KEYS.indexOf(p.currentStage)>=0) return false;
    if(f.machine && sfMachineName(f.machine)!==p.machine && f.machine!==p.machine) return false;
    if(f.shift && String(p.shift||'').replace(/\D/g,'')!==f.shift) return false;
    return true;
  });
  const qty = p => Number(p.quantity)>0 ? Number(p.quantity) : 1;
  const qc = list => {
    const pass=list.filter(p=>p.qcResult==='pass'), fail=list.filter(p=>p.qcResult==='fail'), pend=list.filter(p=>p.qcResult!=='pass'&&p.qcResult!=='fail');
    const q=l=>l.reduce((s,p)=>s+qty(p),0);
    const judged=q(pass)+q(fail);
    return {pass:q(pass), ng:q(fail), pending:q(pend), judged, rate: judged ? q(pass)/judged : null, lists:{pass,fail,pend}};
  };
  M.quality = {...qc(qrIn(R)), prevRate: qc(qrIn(P)).rate, repair:null,
    bucketRate: B.map(b=>qc(qrIn(b)).rate), totalQr:qrAll.length};

  // 5) Giao hàng đúng hạn — đơn ĐÃ GIAO (delivered/deliveredAt)
  const delivIn = r => orders.filter(o=>o.delivered && sfIn(Number(o.deliveredAt), r.from, r.to));
  const onTimeOf = l => l.filter(o=>{ const d=dueTs(o); return d===null || Number(o.deliveredAt) < sfAddDays(d,1); });
  const dR=delivIn(R), dP=delivIn(P);
  M.delivery = {n:dR.length, onTime:onTimeOf(dR).length, rate: dR.length ? onTimeOf(dR).length/dR.length : null,
    prevRate: dP.length ? onTimeOf(dP).length/dP.length : null,
    bucketRate: B.map(b=>{ const l=delivIn(b); return l.length ? onTimeOf(l).length/l.length : null; }),
    late: dR.filter(o=>!onTimeOf([o]).length), list:dR,
    doneOnTimeRate: actualR.length ? actualR.filter(o=>{const d=dueTs(o); return d===null||Number(o.doneAt)<sfAddDays(d,1);}).length/actualR.length : null};

  // 6) Máy: giờ chạy thực tế (phiên chạy ∩ kỳ), số lần dừng + thời gian dừng
  M.machines = sfMachineStats(all, f, R, now);

  // 7) OEE: chỉ khi đủ đầu vào
  M.oee = sfOee(M);

  // 8) Công đoạn (sổ riêng từng công đoạn — KHÔNG cộng chéo)
  M.stages = sfStageStats(f, R, B, orders);

  // 9) Kho
  M.warehouse = sfWarehouse(orders, R, f);

  // 10) Nhân lực
  M.workforce = sfWorkforce(f, R, now);
  return M;
}

function sfMachineStats(allOrders, f, R, now){
  const list = (typeof MACHINES!=='undefined' ? MACHINES : []).filter(m=>(!f.machine||m.id===f.machine) &&
    (!f.stage || (typeof ASSIGN_STAGES!=='undefined' && ASSIGN_STAGES.some(s=>s.key===f.stage && s.group===m.group))));
  const by = {}; list.forEach(m=>by[m.id]={m, runMs:0, sessions:0, pauses:0, pauseMs:0, orders:new Set(), rows:[]});
  let legacy=0, unattributed=0;
  allOrders.forEach(o=>{
    sfSessions(o).forEach(s=>{
      if(!s) return;
      if(s.legacy){ legacy++; return; }              // phiên cũ không có máy/giờ thật → không tính
      if(!s.machineId){ unattributed++; return; }
      const e = by[s.machineId]; if(!e) return;
      const a=Number(s.startAt), b = s.endAt ? Number(s.endAt) : now;
      if(!isFinite(a) || !isFinite(b)) return;
      const ov = Math.min(b,R.to) - Math.max(a,R.from);
      if(ov<=0) return;
      e.runMs += ov; e.sessions++; e.orders.add(o.id); e.rows.push({o, ms:ov, stage:s.stage});
    });
    sfPauses(o).forEach(p=>{
      if(!p || !p.machineId) return; const e=by[p.machineId]; if(!e) return;
      const a=Number(p.at), b = p.resumeAt ? Number(p.resumeAt) : now;
      if(!isFinite(a)) return;
      const ov = Math.min(b,R.to) - Math.max(a,R.from);
      if(ov<=0) return;
      e.pauses++; e.pauseMs += ov;
    });
  });
  const rows = Object.keys(by).map(k=>({...by[k], orders:by[k].orders.size}));
  const withRun = rows.filter(r=>r.runMs>0);
  return {rows, top:[...rows].sort((a,b)=>b.runMs-a.runMs), low:[...rows].sort((a,b)=>a.runMs-b.runMs),
    anyRun: withRun.length>0, legacy, unattributed};
}

function sfOee(M){
  const inputs = [
    {key:'run',  label:'Thời gian chạy thực tế của máy', ok: M.machines.anyRun, note: M.machines.anyRun ? 'Có (từ phiên chạy đã ghi)' : 'Chưa có phiên chạy trong kỳ'},
    {key:'plan', label:'Thời gian kế hoạch sản xuất của máy (lịch/ca máy)', ok:false, note:'Hệ thống chưa lưu lịch chạy theo máy'},
    {key:'std',  label:'Tốc độ chuẩn / công suất thiết kế của máy', ok:false, note:'Chưa khai báo'},
    {key:'qual', label:'Chất lượng (đạt / NG)', ok: M.quality.judged>0, note: M.quality.judged>0 ? 'Có (kết quả QC mã QR)' : 'Chưa có kết quả QC trong kỳ'}
  ];
  const ready = inputs.every(i=>i.ok);
  return {ready, inputs, value:null};    // chỉ tính khi ready; hiện chưa có nguồn nên value luôn null → không bịa số
}

function sfStageStats(f, R, B, orders){
  const inR = r => row => sfIn(sfDateTs(row.ngay), r.from, r.to);
  const mOk = row => !f.machine || sfMachineName(f.machine)===row.may || (sfMachineByName(row.may)||{}).id===f.machine;
  const sOk = row => !f.shift || String(row.ca||'')===f.shift;
  const rows = (arr)=>sfArr(arr);
  const cat = rows(DB.mayDanhBongLog).filter(r=>/c[aắ]t/i.test(String(r.congDoan||'')) || String(r.congDoan||'').toLowerCase().indexOf('cat')>=0);
  const db  = rows(DB.mayDanhBongLog).filter(r=>cat.indexOf(r)<0);
  const defs = [
    {key:'dun',label:'Đùn', unit:'kg nguyên liệu nạp', src:rows(DB.nguyenLieuLog), val:r=>parseFloat(r.soLuong)||0, noShift:true, extra:src=>({phe:src.reduce((s,r)=>s+(parseFloat(r.phe)||0),0), phoi:src.reduce((s,r)=>s+(parseFloat(r.phoi)||0),0)})},
    {key:'rut',label:'Rút', unit:'thanh', src:rows(DB.mayRutLog), val:r=>Number(r.soThanh)||0},
    {key:'danhbong',label:'Đánh bóng', unit:'thanh', src:db, val:r=>Number(r.soThanh)||0},
    {key:'cat',label:'Cắt', unit:'thanh', src:cat, val:r=>Number(r.soThanh)||0}
  ];
  const wip = (st)=>orders.filter(o=>sfStatusKey(o)==='running' && (o.stage||'dun')===st);
  const out = defs.filter(d=>!f.stage||d.key===f.stage).map(d=>{
    const rowsAll = d.src.filter(mOk).filter(d.noShift ? (()=>true) : sOk);
    const rr = rowsAll.filter(inR(R));
    const sum = l=>l.reduce((s,r)=>s+d.val(r),0);
    const linked = rr.filter(r=>r.donHangId).length;
    return {key:d.key, label:d.label, unit:d.unit, rows:rr.length, value:sum(rr), linked, unlinked:rr.length-linked,
      noShift: !!(d.noShift && f.shift), extra: d.extra ? d.extra(rr) : null,
      hasAnyLedger: d.src.length>0,
      buckets: B.map(b=>sum(rowsAll.filter(inR(b)))), list:rr, running:wip(d.key).length};
  });
  return {rows:out};
}

function sfWarehouse(orders, R, f){
  const done = orders.filter(o=>o.status==='done' && !o.returned);
  const wait = done.filter(o=>!o.whIn);
  const inStock = done.filter(o=>o.whIn && !o.delivered);
  const inR = done.filter(o=>o.whIn && sfIn(Number(o.whAt), R.from, R.to));
  const outR = done.filter(o=>o.delivered && sfIn(Number(o.deliveredAt), R.from, R.to));
  const sum = l=>l.reduce((s,o)=>s+sfKg(o),0);
  const nl = sfArr(DB.nguyenLieuLog).filter(r=>sfIn(sfDateTs(r.ngay), R.from, R.to));
  const qr = sfArr(DB.qrProducts);
  return {
    fg:{wait:wait.length, waitKg:sum(wait), stock:inStock.length, stockKg:sum(inStock), inR:inR.length, inRKg:sum(inR), outR:outR.length, outRKg:sum(outR),
        lists:{wait, stock:inStock, inR, outR}},
    rm:{lots:nl.length, kg:nl.reduce((s,r)=>s+(parseFloat(r.soLuong)||0),0), balance:null},   // tồn nguyên liệu: chưa có dữ liệu
    qr:{inStock:qr.filter(p=>p.status==='in_stock').length, total:qr.length}
  };
}

function sfWorkforce(f, R, now){
  const ds = (typeof todayStr==='function' && f.period==='day') ? todayStr(new Date(R.from)) : (typeof todayStr==='function' ? todayStr(new Date(now)) : '');
  if(typeof schDayRoster!=='function' || !(DB.workers||[]).length) return {ds, available:false};
  try{
    const r = schDayRoster(ds);
    const shifts = r.shifts.map(x=>({id:x.shift.id, name:x.shift.name, actual:x.actual, min:x.min, short:x.short}));
    return {ds, available:true, totals:r.totals, shifts, leave:r.leave.length, ot:r.ot.length};
  }catch(e){ return {ds, available:false, error:String(e && e.message || e)}; }
}
