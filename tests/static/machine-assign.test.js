// Kiểm tra logic Phân công máy / chuyển công đoạn (mã THẬT, chạy trong vm, không cần trình duyệt)
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const root=path.join(__dirname,'../..');
const rd=f=>fs.readFileSync(path.join(root,f),'utf8');
const toasts=[]; const confirms=[];
const ctx={console, Date, Object, Math, JSON, parseInt, String, Number, Array, setTimeout:(f)=>{}, requestAnimationFrame:()=>{}, document:{addEventListener(){},getElementById:()=>null,querySelectorAll:()=>[],body:{}}, addEventListener(){}, localStorage:{getItem:()=>null,setItem(){}}, 
  DB:{orders:[]}, currentTab:'keHoach', currentUser:{name:'t'},
  guardViewer:()=>false, isStaff:()=>true, isViewer:()=>false,
  renderTab(){}, refreshKhDetailIfOpen(){}, saveOrders(){}, log(){}, showToast:(m)=>toasts.push(m), addNotif(){}, goToOrderCard(){},
  dhTvMode:false, ddCode:o=>o.id, specStr:()=>'', qtyLabel:()=>'', fmtDateTime:()=>'', machineStatus:()=>'ok',
  confirm2:(t,m,cb)=>confirms.push({t,m,cb}),
  withPlanLock:(id,fn)=>{fn();return true;},
  window:{dpUI:{modal:{markClean:(id)=>{ctx._clean=id;}}}}, dpUI:null};
ctx.dpUI=ctx.window.dpUI; vm.createContext(ctx);
const strip=s=>s; 
['src/core/constants.js','src/modules/planning/planning-machines.js','src/modules/production/production-panels.js','src/modules/production/production-dispatch.js','src/modules/orders/orders-cards.js','src/modules/orders/orders-service.js']
 .forEach(f=>{ try{ vm.runInContext(rd(f).replace(/^const /gm,'var '),ctx,{filename:f}); }catch(e){ console.error('load fail',f,e.message); process.exit(1);} });
const run=c=>vm.runInContext(c,ctx); run('saveOrders=function(){};updateBadges=function(){};goTab=function(){};pushNotif=function(){};alertUser=function(){};openQrGenForOrder=function(){};scheduleAiAutoPromoteCheck=function(){};');
let n=0; const ok=m=>console.log('✓',m,++n);

// Đơn đang chạy Đùn, đã gán đủ 4 công đoạn
run(`DB.orders=[{id:'A',customer:'KH',status:'running',stage:'dun',startedAt:1,machineAssign:{dun:'m_tj300',rut:'m_rut50',danhbong:'m_danhbong_2',cat:'m_cat_1'}}];`);
run(`requestSetStage('A','danhbong')`);
assert.strictEqual(confirms.length,1,'phải hỏi xác nhận'); assert(/BỎ QUA 1 công đoạn/.test(confirms[0].m)); assert(/Máy đùn TJ300/.test(confirms[0].m));
assert.strictEqual(run(`DB.orders[0].stage`),'dun','chưa xác nhận thì CHƯA đổi'); ok('Bấm công đoạn → hỏi xác nhận, chưa đổi dữ liệu');
confirms[0].cb();
assert.strictEqual(run(`DB.orders[0].stage`),'danhbong');
assert.strictEqual(run(`DB.orders[0].machineAssign.dun`),undefined);
assert.strictEqual(run(`DB.orders[0].machineHistory.dun.machineId`),'m_tj300'); assert.strictEqual(run(`DB.orders[0].machineHistory.rut.machineId`),'m_rut50'); ok('Nhả máy công đoạn đã qua nhưng LƯU lịch sử máy');
assert.strictEqual(run(`DB.orders[0].machineAssign.danhbong`),'m_danhbong_2'); ok('Máy công đoạn mới giữ nguyên');

// Gán máy cho công đoạn hiện tại khi đơn đang chạy → có mốc bắt đầu riêng
run(`DB.orders=[{id:'B',customer:'KH',status:'running',stage:'danhbong',startedAt:1000,machineAssign:{}}]`);
run(`assignMachine('B','danhbong','m_danhbong_1')`);
assert(run(`DB.orders[0].machineActiveStartAt.danhbong`)>1000); ok('Gán máy công đoạn hiện tại → ghi mốc "Chạy từ" đúng lúc gán');
assert.strictEqual(ctx._clean,'khDetailModal'); ok('Gán máy → drawer được đánh dấu "sạch" (không hỏi "Đóng biểu mẫu?")');
run(`assignMachine('B','danhbong','')`);
assert.strictEqual(run(`DB.orders[0].machineActiveAt.danhbong`),undefined); ok('Bỏ gán → xoá dấu đang chạy của máy cũ');

// Panel hiển thị công đoạn đã qua / thiếu máy
run(`DB.orders=[{id:'C',customer:'KH',status:'running',stage:'danhbong',machineAssign:{danhbong:'m_danhbong_2'},machineHistory:{dun:{machineId:'m_tj300',endAt:5}}}]`);
const html=run(`khMachineAssignHTML(DB.orders[0])`);
assert(/data-dp-nodirty/.test(html)); assert(/đã chạy trên <b>Máy đùn TJ300/.test(html)); assert(/chưa ghi nhận máy nào/.test(html)); ok('Panel: Đùn hiện "đã chạy trên TJ300", Rút hiện "chưa ghi nhận", có data-dp-nodirty');
run(`DB.orders=[{id:'D',customer:'KH',status:'running',stage:'rut',machineAssign:{}}]`);
assert(/CHƯA gán máy/.test(run(`khMachineAssignHTML(DB.orders[0])`))); ok('Đơn đang chạy mà thiếu máy → cảnh báo rõ');

// ── Rà soát vòng 2 ──
// Đơn CHỜ được gán máy công đoạn sau (máy trống) → KHÔNG được tự nhảy sang chạy ở công đoạn đó
run(`DB.orders=[{id:'P',customer:'KH',status:'pending',machineAssign:{}}]`);
run(`assignMachine('P','danhbong','m_danhbong_2')`);
assert.strictEqual(run(`DB.orders[0].status`),'pending'); assert.strictEqual(run(`DB.orders[0].stage`),undefined); assert.strictEqual(run(`DB.orders[0].startedAt`),undefined);
assert.strictEqual(run(`DB.orders[0].machineAssign.danhbong`),'m_danhbong_2'); ok('Đơn chờ gán máy Đánh bóng: vẫn Chờ, không bị bỏ qua Đùn, vẫn giữ phân công');
// Đơn chờ gán máy Đùn trống → vẫn tự chạy như thiết kế cũ
run(`DB.orders=[{id:'P2',customer:'KH',status:'pending',machineAssign:{}}]`);
run(`assignMachine('P2','dun','m_tj300')`);
assert.strictEqual(run(`DB.orders[0].status`),'running'); assert.strictEqual(run(`DB.orders[0].stage`),'dun'); ok('Đơn chờ gán máy Đùn trống: vẫn tự chạy ở Đùn (hành vi cũ giữ nguyên)');
// Đơn đang Đùn, gán trước máy Rút → không tự chạy tiếp lặp vô hạn
const nlog=()=>0; run(`var __logs=[]; log=function(a){__logs.push(a)};`);
run(`DB.orders=[{id:'Q',customer:'KH',status:'running',stage:'dun',startedAt:1,machineAssign:{dun:'m_tj300'},machineActiveAt:{dun:'m_tj300'}}]`);
run(`assignMachine('Q','rut','m_rut50')`); for(let i=0;i<5;i++) run('dhAutoDispatchSweepAll()');
assert.strictEqual(run(`__logs.filter(x=>x==='Tự động chạy tiếp').length`),0); assert.strictEqual(run(`DB.orders[0].machineActiveAt.rut`),undefined); ok('Gán trước máy Rút cho đơn đang Đùn: quét 5 lần không sinh "Tự động chạy tiếp" (hết vòng lặp ghi thừa)');
// Đơn xong nhả TẤT CẢ máy đang giữ → đơn chờ ở máy Rút được đẩy lên
run(`DB.orders=[{id:'A',customer:'A',status:'running',stage:'danhbong',startedAt:1,machineAssign:{rut:'m_rut50',danhbong:'m_danhbong_1'},machineActiveAt:{rut:'m_rut50',danhbong:'m_danhbong_1'}},{id:'B',customer:'B',status:'running',stage:'rut',startedAt:1,machineAssign:{rut:'m_rut50'},machineActiveAt:{rut:''}}]`);
run(`setStatus('A','done')`);
assert.strictEqual(run(`DB.orders[1].machineActiveAt.rut`),'m_rut50'); ok('Đơn A xong: máy Rút A giữ song song cũng được nhả → đơn B chờ chạy tiếp');
// Đưa đơn về Chờ → nhả máy
run(`DB.orders=[{id:'A',customer:'A',status:'running',stage:'rut',startedAt:1,machineAssign:{rut:'m_rut50'},machineActiveAt:{rut:'m_rut50'}},{id:'B',customer:'B',status:'running',stage:'rut',startedAt:1,machineAssign:{rut:'m_rut50'},machineActiveAt:{rut:''}}]`);
run(`setStatus('A','pending')`);
assert.strictEqual(run(`DB.orders[1].machineActiveAt.rut`),'m_rut50'); ok('Đưa đơn về Chờ sản xuất → máy được nhả cho đơn kế tiếp');

// drawer chi tiết không bị coi là biểu mẫu
assert(/id="khDetailBody" data-dp-nodirty/.test(rd('src/modules/planning/planning-modals.js'))); ok('khDetailBody có data-dp-nodirty');
console.log(`\nmachine-assign.test: ${n} kiểm tra đạt`);
