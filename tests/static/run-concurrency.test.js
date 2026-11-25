// v2.14.0 — KIỂM THỬ ĐỒNG THỜI NHIỀU THIẾT BỊ (TEST 7): Firebase giả lập CÓ ETag, mỗi thiết bị là 1 vm riêng chạy mã THẬT
// (orders-service: writeOrderRecord/mergeAndSaveOrders + planning-runctl + dispatch + applyFieldChange của sync-realtime).
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const root=path.join(__dirname,'../..'); const rd=f=>fs.readFileSync(path.join(root,f),'utf8');
const realST=setTimeout; const sleep=ms=>new Promise(r=>realST(r,ms));
let n=0; const ok=m=>console.log('✓',m,++n);
function fnSrc(src,name){ let s=src.indexOf('function '+name+'('); if(s<0) throw new Error('không thấy '+name); let d=0,i=src.indexOf('{',s),j=i; for(;j<src.length;j++){ if(src[j]==='{')d++; else if(src[j]==='}'){ d--; if(!d) break; } } return src.slice(s,j+1); }

class Server{
  constructor(){ this.orders={}; this.ver={}; this.online=true; this.latency=()=>0; this.writes=[]; }
  _gate(){ if(!this.online) throw new TypeError('Failed to fetch'); }
  async read(p){ await sleep(this.latency()); this._gate(); const parts=p.split('/').filter(Boolean);
    if(parts.length===2) return Object.keys(this.orders).length?JSON.parse(JSON.stringify(this.orders)):null;
    return this.orders[parts[2]]?JSON.parse(JSON.stringify(this.orders[parts[2]])):null; }
  async readETag(p){ const d=await this.read(p); const id=p.split('/')[3]; return {data:d, etag:'v'+(this.ver[id]||0)}; }
  async writeETag(p,data,etag,method){ await sleep(this.latency()); this._gate(); const id=p.split('/')[3];
    if(etag!=='*' && etag!=='v'+(this.ver[id]||0)) return {ok:false,conflict:true};
    this.ver[id]=(this.ver[id]||0)+1; this.writes.push({id,status:data&&data.status});
    if(method==='DELETE'||data==null) delete this.orders[id]; else this.orders[id]=JSON.parse(JSON.stringify(data)); return {ok:true,etag:'v'+this.ver[id]}; }
}
const FILES=['src/core/constants.js','src/modules/planning/planning-machines.js','src/modules/planning/planning-runctl.js','src/modules/production/production-panels.js','src/modules/production/production-dispatch.js','src/modules/orders/orders-cards.js','src/modules/orders/orders-service.js'];
const rt=rd('src/services/sync-realtime.js');
function device(srv,name,role){
  const toasts=[]; const dirty=new Set();
  const ctx={console,Date,Object,Math,JSON,parseInt,parseFloat,String,Number,Array,Set,Map,Promise,isFinite,
    requestAnimationFrame:()=>{},
    setTimeout:(f,ms)=> (ms===3000 && /mergeAndSaveOrders/.test(String(f))) ? 0 : realST(f,ms),
    document:{addEventListener(){},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],body:{}}, addEventListener(){}, localStorage:{getItem:()=>null,setItem(){}},
    DB:{orders:[],users:[]}, currentTab:'keHoach', currentUser:{id:name,name,role:role||'staff'},
    guardViewer:()=>false,isStaff:()=>true,isAdmin:()=>false,isViewer:()=>false,
    renderTab(){},refreshKhDetailIfOpen(){},updateBadges(){},goTab(){},goToOrderCard(){},pushNotif(){},alertUser(){},openQrGenForOrder(){},scheduleAiAutoPromoteCheck(){},
    log(){}, showToast:(m)=>toasts.push(m), addNotif(){}, dhTvMode:false, ddCode:o=>o.po||o.id, specStr:()=>'', qtyLabel:()=>'', esc:s=>String(s), machineStatus:()=>'ok', fmtDateTime:t=>''+t, fmtDate:t=>''+t, fmtDuration:ms=>Math.floor(ms/60000)+'p',
    confirm2(){}, withPlanLock:(id,fn)=>{fn();return true;}, window:{dpUI:{modal:{markClean(){}}}}, dpUI:null,
    fbOk:()=>true, fbRead:p=>srv.read(p), fbReadETag:p=>srv.readETag(p), fbWriteETag:(p,d,e,m)=>srv.writeETag(p,d,e,m), fbWrite:async()=>{},
    lsSave(){}, setSyncDot(){}, markDirty:f=>dirty.add(f), clearDirty:f=>dirty.delete(f), getDirtyFields:()=>[...dirty],
    scheduleUIRefresh(){}, notifyNewOrder(){}, actorName:()=>name, _toasts:toasts, nowSrv:()=>Date.now()};
  ctx.dpUI=ctx.window.dpUI; vm.createContext(ctx);
  FILES.forEach(f=>vm.runInContext(rd(f).replace(/^const /gm,'var '),ctx,{filename:f}));
  vm.runInContext(`var _pendingSaves=0; function beginSave(){_pendingSaves++} function endSave(){_pendingSaves=Math.max(0,_pendingSaves-1)} var _lastHash='', _knownIds=new Set();
    RC_VERIFY_DELAYS=[0,40,80]; ${fnSrc(rt,'applyFieldChange')}`,ctx);
  return {ctx,toasts,run:c=>vm.runInContext(c,ctx), load(){ ctx.DB.orders=Object.values(JSON.parse(JSON.stringify(srv.orders))); vm.runInContext('_lastSyncedOrdersSnapshot=snapshotOrders(DB.orders);_lastHash=hashOrders(DB.orders)',ctx); },
    settle:async()=>{ for(let i=0;i<200 && ctx._pendingSaves>0;i++) await sleep(10); await sleep(250); }};
}
const mkOrder=(id,extra)=>Object.assign({id,customer:'KH-'+id,po:'PO-'+id,status:'paused',stage:'dun',priority:'GẤP 1',startedAt:1000,accumulatedRunMs:600000,version:1,updatedAt:1,
  machineAssign:{dun:'m_tj500_1'},runSessions:[{id:'s0',no:1,stage:'dun',machineId:'m_tj500_1',startAt:1000,endAt:601000,runMs:600000,by:'x',endReason:'pause'}],
  pauseHistory:[{id:'p0',no:1,at:601000,resumeAt:null,pausedMs:null,reason:'r',by:'x'}],pausedAt:601000},extra||{});
const machineRunners=srv=>Object.values(srv.orders).filter(o=>o.status==='running'&&o.machineAssign&&o.machineAssign.dun==='m_tj500_1');

(async()=>{
// S1 — 2 thiết bị cùng bấm "Tiếp tục" 2 đơn khác nhau trên CÙNG máy, cùng khoảnh khắc
{ const srv=new Server(); srv.orders={A:mkOrder('A'),B:mkOrder('B')}; srv.ver={A:1,B:1}; srv.latency=()=>5+Math.random()*10;
  const X=device(srv,'X'), Y=device(srv,'Y'); X.load(); Y.load();
  const [rx,ry]=await Promise.all([X.run(`rcResumeOrder('A')`),Y.run(`rcResumeOrder('B')`)]);
  await Promise.all([X.settle(),Y.settle()]); await sleep(400);
  assert.strictEqual(machineRunners(srv).length,1,'sau khi hội tụ chỉ 1 đơn chiếm máy, thực tế: '+JSON.stringify(Object.values(srv.orders).map(o=>o.id+':'+o.status)));
  const loser=Object.values(srv.orders).find(o=>o.status==='paused'), winner=machineRunners(srv)[0];
  assert(loser.pauseHistory.some(p=>p.auto), 'đơn thua được ghi nhận là tự động tạm dừng'); assert.strictEqual(loser.pauseHistory.length,2);
  assert(winner.runSessions.filter(s=>s.endAt==null).length===1); assert.strictEqual(loser.runSessions.filter(s=>s.endAt==null).length,0);
  ok('2 thiết bị cùng tiếp tục 2 đơn trên 1 máy: sau đồng bộ chỉ còn 1 đơn chạy, đơn kia tự tạm dừng (có ghi "tự động")'); }
// S1b — chạy nhiều lần để chắc chắn không phải may mắn
{ let bad=0; for(let k=0;k<12;k++){ const srv=new Server(); srv.orders={A:mkOrder('A'),B:mkOrder('B')}; srv.ver={A:1,B:1}; srv.latency=()=>Math.random()*20;
  const X=device(srv,'X'), Y=device(srv,'Y'); X.load(); Y.load(); await Promise.all([X.run(`rcResumeOrder('A')`),Y.run(`rcResumeOrder('B')`)]); await Promise.all([X.settle(),Y.settle()]); await sleep(300);
  if(machineRunners(srv).length!==1) bad++; }
  assert.strictEqual(bad,0,bad+'/12 lượt bị chạy trùng máy'); ok('Lặp 12 lần với độ trễ mạng ngẫu nhiên: 0 lần 2 đơn cùng chiếm 1 máy'); }
// S2 — 2 thiết bị cùng tạm dừng 1 đơn
{ const srv=new Server(); srv.orders={A:mkOrder('A',{status:'running',pausedAt:undefined,accumulatedRunMs:0,resumedAt:1000,runSessions:[{id:'s0',no:1,stage:'dun',machineId:'m_tj500_1',startAt:1000,endAt:null,by:'x'}],pauseHistory:[]})}; srv.ver={A:1}; srv.latency=()=>5+Math.random()*10;
  const X=device(srv,'X'), Y=device(srv,'Y'); X.load(); Y.load();
  await Promise.all([X.run(`rcDoPause('A','từ X')`),Y.run(`rcDoPause('A','từ Y')`)]); await Promise.all([X.settle(),Y.settle()]);
  const a=srv.orders.A; assert.strictEqual(a.status,'paused'); assert.strictEqual(a.pauseHistory.length,1,'không nhân đôi lịch sử tạm dừng'); assert.strictEqual(a.runSessions.length,1); assert(a.runSessions[0].endAt!=null&&a.runSessions[0].runMs>0);
  assert.strictEqual(a.accumulatedRunMs,a.runSessions[0].runMs); ok('2 thiết bị cùng tạm dừng 1 đơn: 1 bản ghi tạm dừng, tổng giờ đúng, không ghi chồng'); }
// S3 — thiết bị cũ (dữ liệu stale) tạm dừng đơn đã hoàn thành ở máy khác
{ const srv=new Server(); const run0=mkOrder('A',{status:'running',pausedAt:undefined,accumulatedRunMs:0,runSessions:[{id:'s0',no:1,stage:'dun',machineId:'m_tj500_1',startAt:1000,endAt:null,by:'x'}],pauseHistory:[]});
  srv.orders={A:run0}; srv.ver={A:1}; const X=device(srv,'X'), Y=device(srv,'Y'); X.load(); Y.load();
  await X.run(`setStatus('A','done')`); await X.settle(); assert.strictEqual(srv.orders.A.status,'done');
  Y.toasts.length=0;
  const srvDone=srv.orders.A.status; assert.strictEqual(srvDone,'done'); ok('Đơn đã hoàn thành ở thiết bị khác: server giữ nguyên "done"');
  await Y.run(`rcRefresh()`); const r2=Y.run(`rcDoPause('A','muộn')`); assert.strictEqual(r2.ok,false); assert.strictEqual(srv.orders.A.status,'done'); assert(Y.toasts.some(t=>/không còn ở trạng thái Đang sản xuất/.test(t)));
  ok('Thiết bị cũ: đọc lại server rồi mới quyết định → từ chối tạm dừng đơn đã xong, báo rõ, không ghi đè'); }
// S4 — F5 / đăng nhập thiết bị khác: trạng thái + thời gian + lịch sử khôi phục đúng từ server
{ const srv=new Server(); srv.orders={A:mkOrder('A',{status:'running',pausedAt:undefined,accumulatedRunMs:0,resumedAt:5000,runSessions:[{id:'s0',no:1,stage:'dun',machineId:'m_tj500_1',startAt:5000,endAt:null,by:'x'}],pauseHistory:[]})}; srv.ver={A:1};
  const X=device(srv,'X'); X.load(); await X.run(`rcDoPause('A','nghỉ trưa')`); await X.settle();
  const before=X.run(`rcRunMs(DB.orders[0])`); assert(before>0);
  const Z=device(srv,'Z'); Z.load();   // thiết bị mới / F5: dữ liệu chỉ từ server
  assert.strictEqual(Z.run(`rcRunMs(DB.orders[0])`),before); assert.strictEqual(Z.run(`DB.orders[0].status`),'paused'); assert.strictEqual(Z.run(`DB.orders[0].pauseHistory[0].reason`),'nghỉ trưa');
  await sleep(120); assert.strictEqual(Z.run(`rcRunMs(DB.orders[0])`),before,'thiết bị mới: đồng hồ đơn tạm dừng đứng yên');
  const r=await Z.run(`rcResumeOrder('A')`); assert(r.ok); await Z.settle(); assert.strictEqual(srv.orders.A.status,'running'); assert.strictEqual(srv.orders.A.runSessions.length,2);
  const W=device(srv,'W'); W.load(); const t0=W.run(`rcRunMs(DB.orders[0])`); await sleep(150); assert(W.run(`rcRunMs(DB.orders[0])`)>=t0+100,'sau tiếp tục, thiết bị khác thấy đồng hồ chạy');
  assert(t0>=before&&t0<before+1000,'cộng dồn từ '+before+' (không tính khoảng nghỉ)');
  ok('F5 / thiết bị khác: trạng thái, thời gian chạy, lý do tạm dừng, số phiên đều khôi phục chính xác; tiếp tục từ thiết bị khác cộng dồn đúng'); }
// S5 — mất mạng: tạm dừng khi offline, nối lại thì đẩy lên đúng
{ const srv=new Server(); srv.orders={A:mkOrder('A',{status:'running',pausedAt:undefined,accumulatedRunMs:0,resumedAt:5000,runSessions:[{id:'s0',no:1,stage:'dun',machineId:'m_tj500_1',startAt:5000,endAt:null,by:'x'}],pauseHistory:[]})}; srv.ver={A:1};
  const X=device(srv,'X'); X.load(); srv.online=false; const rf=await X.run(`rcRefresh()`); assert.strictEqual(rf.online,false);
  const res=X.run(`rcDoPause('A','mất mạng')`); assert(res.ok); await sleep(100);
  assert.strictEqual(srv.orders.A.status,'running','offline: server chưa thấy'); assert.strictEqual(X.run(`DB.orders[0].status`),'paused');
  const t1=X.run(`rcRunMs(DB.orders[0])`); await sleep(80); assert.strictEqual(X.run(`rcRunMs(DB.orders[0])`),t1,'offline: đồng hồ cục bộ vẫn đứng');
  srv.online=true; await X.run(`mergeAndSaveOrders(0)`); await X.settle();
  assert.strictEqual(srv.orders.A.status,'paused'); assert.strictEqual(srv.orders.A.pauseHistory[0].reason,'mất mạng'); assert.strictEqual(srv.orders.A.accumulatedRunMs,t1);
  ok('Mất mạng: tạm dừng vẫn ghi cục bộ, nối lại thì đẩy lên server đúng mốc giờ/lý do/tổng giờ'); }
console.log('\nrun-concurrency.test: '+n+' nhóm kiểm tra đạt'); process.exit(0);
})().catch(e=>{ console.error('✗',e.stack||e); process.exit(1); });
