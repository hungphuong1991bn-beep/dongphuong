// v2.14.0 — KIỂM THỬ: tạm dừng / tiếp tục sản xuất, thời gian chạy cộng dồn, chuyển đơn trên cùng máy, đổi máy.
// Chạy MÃ THẬT (constants, planning-machines, planning-runctl, production-*, orders-*) trong vm; đồng hồ do test điều khiển.
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const root=path.join(__dirname,'../..'); const rd=f=>fs.readFileSync(path.join(root,f),'utf8');
const MIN=60000, HOUR=3600000;
const toasts=[], logs=[], notifs=[], confirms=[];
const ctx={console,Date,Object,Math,JSON,parseInt,parseFloat,String,Number,Array,Set,Map,Promise,isFinite,
  setTimeout:(f)=>{}, requestAnimationFrame:()=>{}, document:{addEventListener(){},getElementById:()=>null,querySelectorAll:()=>[],body:{}}, addEventListener(){}, localStorage:{getItem:()=>null,setItem(){}},
  DB:{orders:[],users:[]}, currentTab:'keHoach', T:1000000,
  guardViewer:()=>ctx._viewer===true, isStaff:()=>ctx._role!=='viewer', isAdmin:()=>ctx._role==='admin', isViewer:()=>ctx._viewer===true,
  renderTab(){}, refreshKhDetailIfOpen(){}, updateBadges(){}, goTab(){}, goToOrderCard(){}, pushNotif(){}, alertUser(){}, openQrGenForOrder(){}, scheduleAiAutoPromoteCheck(){},
  saveOrders(){ ctx._saves=(ctx._saves||0)+1; }, log:(a,d,id,b,af)=>logs.push({a,d,id,b,af}), showToast:(m,e)=>toasts.push(m), addNotif:(...x)=>notifs.push(x),
  dhTvMode:false, ddCode:o=>o.po||o.id, specStr:()=>'Φ18', qtyLabel:()=>'', esc:s=>String(s==null?'':s), machineStatus:()=>'ok',
  fmtDateTime:t=>'t'+t, fmtDate:t=>'d'+t, fmtDuration:ms=>{ if(!ms||ms<0) return ''; const m=Math.floor(ms/60000); return m<60?m+'p':Math.floor(m/60)+'g'+(m%60?m%60+'p':''); },
  confirm2:(t,m,cb)=>confirms.push({t,m,cb}), withPlanLock:(id,fn)=>{ fn(); return true; },
  currentUser:{id:'u1',name:'Tuấn',role:'staff'}, _role:'staff', fbOk:()=>false,
  window:{dpUI:{modal:{markClean(){}}}}, dpUI:null};
ctx.nowSrv=()=>ctx.T; ctx.dpUI=ctx.window.dpUI; vm.createContext(ctx);
['src/core/constants.js','src/modules/planning/planning-machines.js','src/modules/planning/planning-runctl.js','src/modules/production/production-panels.js','src/modules/production/production-dispatch.js','src/modules/orders/orders-cards.js','src/modules/orders/orders-service.js']
 .forEach(f=>{ try{ vm.runInContext(rd(f).replace(/^const /gm,'var '),ctx,{filename:f}); }catch(e){ console.error('load fail',f,e.message); process.exit(1);} });
const run=c=>vm.runInContext(c,ctx); run('saveOrders=function(){ __saves++ }; var __saves=0;');
let n=0; const ok=m=>console.log('✓',m,++n);
const O=(i)=>run(`DB.orders[${i}]`); const RM=(id)=>run(`rcRunMs(DB.orders.find(x=>x.id==='${id}'))`);
const mk=(o)=>Object.assign({id:'A',customer:'KH1',po:'PO-A',status:'pending',priority:'GẤP 1',machineAssign:{dun:'m_tj500_1'}},o);
const setT=t=>{ ctx.T=t; };
const T0=10*HOUR;

(async()=>{
// ── TEST 1: chạy 30p → tạm dừng → 2 giờ sau tiếp tục ──
run(`DB.orders=[${JSON.stringify(mk({}))}]`); setT(T0);
run(`setStatus('A','running')`);
assert.strictEqual(O(0).status,'running'); assert.strictEqual(O(0).startedAt,T0); assert.strictEqual(O(0).runSessions.length,1);
setT(T0+30*MIN); assert.strictEqual(RM('A'),30*MIN);
run(`rcDoPause('A','Hết nguyên liệu')`);
assert.strictEqual(O(0).status,'paused'); assert.strictEqual(O(0).pausedAt,T0+30*MIN); assert.strictEqual(O(0).accumulatedRunMs,30*MIN);
setT(T0+30*MIN+2*HOUR); assert.strictEqual(RM('A'),30*MIN,'đang nghỉ 2 giờ: tổng chạy vẫn 30 phút');
ok('TEST 1a: chạy 30p → tạm dừng; sau 2 giờ vẫn 30p (đồng hồ đứng, không cộng thời gian chờ)');
const r1=await run(`rcResumeOrder('A')`); assert(r1.ok);
assert.strictEqual(RM('A'),30*MIN,'ngay lúc tiếp tục: vẫn 30p'); assert.strictEqual(O(0).resumedAt,T0+150*MIN);
setT(T0+150*MIN+10*MIN); assert.strictEqual(RM('A'),40*MIN);
ok('TEST 1b: tiếp tục → cộng dồn từ 30p (sau 10p chạy = 40p), không tính 2 giờ nghỉ');
assert.strictEqual(O(0).pauseHistory.length,1); const ph=O(0).pauseHistory[0];
assert.strictEqual(ph.at,T0+30*MIN); assert.strictEqual(ph.resumeAt,T0+150*MIN); assert.strictEqual(ph.pausedMs,2*HOUR); assert.strictEqual(ph.reason,'Hết nguyên liệu'); assert.strictEqual(ph.by,'Tuấn');
ok('Lịch sử tạm dừng: thời điểm dừng/chạy lại, thời gian nghỉ, lý do, người thao tác');
assert.strictEqual(JSON.stringify(O(0).machineAssign),JSON.stringify({dun:'m_tj500_1'})); ok('Phân công máy giữ nguyên sau tạm dừng/tiếp tục');

// ── TEST 2: A tạm dừng → B chạy cùng máy; A đứng yên ──
run(`DB.orders=[${JSON.stringify(mk({id:'A',customer:'KH1'}))},${JSON.stringify(mk({id:'B',po:'PO-B',customer:'KH2'}))}]`); setT(T0);
run(`setStatus('A','running')`); setT(T0+20*MIN);
run(`setStatus('B','running')`);
assert.strictEqual(O(1).status,'pending'); assert(toasts.some(t=>/đang chạy đơn PO-A/.test(t))); ok('Máy đang bận: đơn B bị chặn khi A còn chạy (hành vi cũ giữ nguyên)');
run(`rcDoPause('A','Chuyển sang đơn gấp')`);   // B đang xếp hàng trên máy → tự chạy tiếp khi máy trống (AUTO DISPATCH có sẵn)
assert.strictEqual(O(0).status,'paused'); assert.strictEqual(O(1).status,'running','B chạy sau khi máy trống');
const a0=RM('A'); setT(T0+80*MIN); assert.strictEqual(RM('A'),a0,'đồng hồ A đứng yên khi B chạy'); assert.strictEqual(RM('A'),20*MIN);
assert.strictEqual(RM('B'),60*MIN,'B có đồng hồ riêng, tính từ lúc bắt đầu của B'); assert.strictEqual(O(1).startedAt,T0+20*MIN);
ok('TEST 2: A tạm dừng, B chạy cùng máy — B có đồng hồ riêng, A đứng yên 20p');
// B không được gán trước: bắt đầu thủ công cũng chạy bình thường
run(`DB.orders=[${JSON.stringify(mk({id:'A'}))},${JSON.stringify(mk({id:'B',po:'PO-B',machineAssign:{}}))}]`); setT(T0);
run(`setStatus('A','running')`); setT(T0+5*MIN); run(`rcDoPause('A','x')`); run(`assignMachine('B','dun','m_tj500_1')`);
assert.strictEqual(O(1).status,'running'); ok('TEST 2b: máy đã được giải phóng — gán máy cho B (đang chờ) → B chạy được ngay');

// ── TEST 3: A tiếp tục khi máy đang chạy B ──
toasts.length=0;
const r3=await run(`rcResumeOrder('A')`);
assert.strictEqual(r3.ok,false); assert.strictEqual(r3.code,'machine-busy'); assert.strictEqual(O(0).status,'paused','A vẫn tạm dừng');
const msg=toasts.find(t=>/Chưa thể tiếp tục/.test(t)); assert(msg&&/Máy đùn TJ550 \(1\)/.test(msg)&&/PO-B/.test(msg)); assert.strictEqual(O(0).runSessions.filter(s=>s.endAt==null).length,0);
ok('TEST 3: tiếp tục khi máy đang chạy đơn B → bị chặn, thông báo rõ tên máy + đơn đang dùng, không mở phiên');
// B xong → A tiếp tục được
setT(T0+30*MIN); run(`setStatus('B','done')`);
assert((await run(`rcResumeOrder('A')`)).ok); assert.strictEqual(O(0).status,'running'); ok('B hoàn thành → A tiếp tục được');

// ── TEST 4: nhiều phiên / nhiều lần dừng ──
run(`DB.orders=[${JSON.stringify(mk({}))}]`); setT(T0); run(`setStatus('A','running')`);
const plan=[[20,30],[45,120],[15,10],[60,5]]; let t=T0, expectRun=0;
for(const [runMin,restMin] of plan){ t+=runMin*MIN; setT(t); run(`rcDoPause('A','nghỉ')`); expectRun+=runMin*MIN; t+=restMin*MIN; setT(t); assert((await run(`rcResumeOrder('A')`)).ok); }
t+=7*MIN; setT(t); expectRun+=7*MIN;
assert.strictEqual(RM('A'),expectRun); assert.strictEqual(O(0).pauseHistory.length,4); assert.strictEqual(O(0).runSessions.length,5);
setT(t+3*MIN); run(`setStatus('A','done')`); expectRun+=3*MIN;
const d=O(0); assert.strictEqual(d.accumulatedRunMs,expectRun);
const sumSess=d.runSessions.reduce((s,x)=>s+x.runMs,0); assert.strictEqual(sumSess,expectRun,'accumulatedRunMs = tổng runMs các phiên'); assert(d.runSessions.every(s=>s.endAt!=null));
assert.strictEqual(RM('A'),expectRun,'sau hoàn thành: tổng chạy chốt đúng, không phụ thuộc doneAt-startedAt'); assert(d.doneAt-d.startedAt>expectRun);
ok('TEST 4: 5 phiên, 4 lần tạm dừng — tổng = tổng các phiên ('+(expectRun/MIN)+'p), không cộng '+(plan.reduce((s,p)=>s+p[1],0))+'p nghỉ');
setT(t+10*HOUR); assert.strictEqual(RM('A'),expectRun); ok('Đơn đã xong: thời gian chạy không đổi theo thời gian trôi');

// ── TEST 5: đổi máy TJ550(1) → TJ550(2) → rút ──
run(`DB.orders=[${JSON.stringify(mk({machineAssign:{dun:'m_tj500_1',rut:'m_rut100_1'}}))}]`); setT(T0); run(`setStatus('A','running')`);
setT(T0+30*MIN); run(`rcDoPause('A','Máy hỏng / sự cố')`); setT(T0+40*MIN);
run(`assignMachine('A','dun','m_tj550_2')`);   // đổi máy khi đang tạm dừng
assert.strictEqual(O(0).machineAssign.dun,'m_tj550_2'); assert.strictEqual(O(0).runSessions.length,1,'đang tạm dừng: chưa mở phiên mới');
setT(T0+50*MIN); assert((await run(`rcResumeOrder('A')`)).ok);
let s=O(0).runSessions; assert.strictEqual(s.length,2); assert.strictEqual(s[0].machineId,'m_tj500_1'); assert.strictEqual(s[0].endReason,'pause'); assert.strictEqual(s[1].machineId,'m_tj550_2'); assert.strictEqual(s[1].startReason,'resume');
setT(T0+80*MIN); run(`assignMachine('A','dun','m_tj400')`);   // đổi máy khi ĐANG chạy
s=O(0).runSessions; assert.strictEqual(s.length,3); assert.strictEqual(s[1].endReason,'switch'); assert.strictEqual(s[1].runMs,30*MIN); assert.strictEqual(s[2].machineId,'m_tj400'); assert.strictEqual(RM('A'),60*MIN,'đổi máy không làm mất/dư thời gian');
setT(T0+90*MIN); run(`setStage('A','rut')`);
s=O(0).runSessions; assert.strictEqual(s.length,4); assert.strictEqual(s[3].stage,'rut'); assert.strictEqual(s[3].machineId,'m_rut100_1'); assert.strictEqual(s[2].endReason,'stage');
assert.strictEqual(s.slice(0,3).map(x=>x.machineId).join(),'m_tj500_1,m_tj550_2,m_tj400');
assert.strictEqual(O(0).machineHistory.dun.machineId,'m_tj400'); // machineHistory cũ vẫn được ghi như trước
ok('TEST 5: TJ550(1) → (tạm dừng) → TJ550(2) → TJ400 → sang Rút: đủ 4 phiên, máy cũ không bị ghi đè');
assert.strictEqual(RM('A'),70*MIN); ok('Tổng thời gian chạy xuyên các lần đổi máy/công đoạn liền mạch (70p)');

// ── Đơn CŨ (chưa có phiên) ──
run(`DB.orders=[{id:'L',customer:'Cũ',status:'running',stage:'rut',startedAt:${T0},machineAssign:{rut:'m_rut50'},machineActiveAt:{rut:'m_rut50'}}]`);
setT(T0+3*HOUR); assert.strictEqual(RM('L'),3*HOUR); assert.strictEqual(run(`rcRunSource(DB.orders[0])`),'legacy'); assert(!run(`rcHasModel(DB.orders[0])`));
assert.strictEqual(run(`rcClockText(DB.orders[0])`),'⏱ 03:00:00'); ok('Đơn cũ đang chạy: đồng hồ giữ nguyên cách tính cũ (now − startedAt) — không đổi số sau nâng cấp');
run(`rcDoPause('L','')`);
const L=O(0); assert.strictEqual(L.accumulatedRunMs,3*HOUR,'tạm dừng đơn cũ: giữ đúng 3 giờ đã hiển thị'); assert.strictEqual(L.runSessions[0].legacy,true); assert.strictEqual(L.runSessions[0].stage,'rut'); assert.strictEqual(L.runSessions[0].machineId,'m_rut50'); assert.strictEqual(L.runSessions[0].by,'');
ok('Đơn cũ tạm dừng: phiên khôi phục đánh dấu legacy, máy/công đoạn đúng thực tế, KHÔNG bịa người vận hành');
run(`DB.orders=[{id:'D',customer:'Cũ',status:'done',startedAt:${T0},doneAt:${T0+5*HOUR}}]`); assert.strictEqual(RM('D'),5*HOUR); assert.strictEqual(run(`rcSessions(DB.orders[0]).length`),0);
ok('Đơn cũ đã hoàn thành: thời gian = doneAt − startedAt như cũ, không tự sinh phiên');
assert.strictEqual(run(`rcRunMs({status:'pending'})`),0);

// ── Khoá chống bấm nhiều lần / điều kiện trạng thái ──
run(`DB.orders=[${JSON.stringify(mk({}))}]`); setT(T0); run(`setStatus('A','running')`); setT(T0+MIN);
const r=run(`rcDoPause('A','a')`); const r2=run(`rcDoPause('A','b')`);
assert(r.ok); assert.strictEqual(r2.ok,false); assert.strictEqual(O(0).pauseHistory.length,1,'bấm tạm dừng lần 2: không ghi thêm'); assert.strictEqual(O(0).runSessions.length,1);
const both=await Promise.all([run(`rcResumeOrder('A')`),run(`rcResumeOrder('A')`)]);
assert.strictEqual(both.filter(x=>x.ok).length,1); assert.strictEqual(O(0).runSessions.length,2,'bấm tiếp tục 2 lần cùng lúc: chỉ mở 1 phiên'); assert.strictEqual(both.find(x=>!x.ok).code,'busy');
run(`setStatus('A','running')`); assert.strictEqual(O(0).runSessions.length,2,'setStatus(running) khi đang chạy: bỏ qua, không mở phiên thứ 2');
ok('Khoá: bấm đúp tạm dừng / tiếp tục / bắt đầu không ghi trùng phiên hay lịch sử');
run(`DB.orders=[${JSON.stringify(mk({status:'paused',accumulatedRunMs:MIN,pauseHistory:[{id:'p',no:1,at:1,resumeAt:null}],runSessions:[]}))}]`);
run(`setStatus('A','running')`); // đi qua setStatus: phải chuyển sang luồng tiếp tục (kiểm tra máy), không chạy tắt
await new Promise(r=>setImmediate(r)); assert.strictEqual(O(0).status,'running'); ok('setStatus(running) trên đơn tạm dừng được chuyển qua luồng tiếp tục (không bỏ qua kiểm tra máy)');

// ── Quyền ──
run(`DB.orders=[${JSON.stringify(mk({status:'paused',accumulatedRunMs:MIN}))}]`); ctx._viewer=true;
const rv=await run(`rcResumeOrder('A')`); assert.strictEqual(rv.ok,false); assert.strictEqual(O(0).status,'paused'); ctx._viewer=false;
ok('Tài khoản Xem không tiếp tục được');

// ── Đồng bộ: hash đổi khi tạm dừng/tiếp tục/đổi máy ──
const h=(i)=>run(`hashOrders(DB.orders)`);
run(`DB.orders=[${JSON.stringify(mk({}))}]`); setT(T0); run(`setStatus('A','running')`); const h1=h();
run(`DB.orders[0].version=(DB.orders[0].version||0)+1`); assert.notStrictEqual(h(),h1); ok('hashOrders nhận ra thay đổi version (đổi máy khi trạng thái giữ nguyên không bị bỏ sót khi đồng bộ)');
// Dữ liệu từ Firebase: mảng có thể về dạng object khoá số
run(`DB.orders=[{id:'F',status:'running',stage:'dun',startedAt:${T0},accumulatedRunMs:0,runSessions:{0:{id:'x',no:1,stage:'dun',machineId:'',startAt:${T0},endAt:null,by:'a'}}}]`); setT(T0+MIN);
assert.strictEqual(RM('F'),MIN); run(`rcDoPause('F','')`); assert(Array.isArray(O(0).runSessions)&&O(0).runSessions[0].runMs===MIN);
ok('Firebase trả mảng dạng object khoá số: vẫn tính/ghi đúng');
console.log('\nrun-clock.test: '+n+' nhóm kiểm tra đạt');
})().catch(e=>{ console.error('✗',e.stack||e); process.exit(1); });
