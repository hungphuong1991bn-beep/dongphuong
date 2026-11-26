// Quy tắc dữ liệu Tổng quan Smart Factory (dashboard-data.js): không bịa số, không cộng trùng, OEE cần đủ đầu vào.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const src=fs.readFileSync(path.join(__dirname,'../../src/modules/dashboard/dashboard-data.js'),'utf8').replace(/^const /gm,'var ');
const D=86400000, now=new Date(2026,10,25,15,0,0).getTime(), t0=new Date(2026,10,25).getTime();
const ds=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
function run(DB){ const ctx={DB,console,Date,Math,Number,parseFloat,isFinite,Object,Array,Set,String,
  MACHINES:[{id:'m1',group:'Máy rút',name:'Máy rút 1'},{id:'m2',group:'Máy đùn',name:'Máy đùn 1'}],
  ASSIGN_STAGES:[{key:'rut',group:'Máy rút'},{key:'dun',group:'Máy đùn'}],
  ddOverdue:o=>o.status!=='done'&&o.deliveryDate&&new Date(o.deliveryDate)<new Date(t0),todayStr:d=>ds(d.getTime())};
  vm.createContext(ctx); vm.runInContext(src,ctx); return ctx; }
// 1) DB rỗng: 0 ≠ null; OEE không có số; kho nguyên liệu không có tồn
let c=run({orders:[]}); let M=c.sfBuild({period:'day',anchor:now},now);
assert.strictEqual(M.orders.total,0); assert.strictEqual(M.output.pct,null,'không có kế hoạch → null, không phải 0');
assert.strictEqual(M.quality.rate,null); assert.strictEqual(M.delivery.rate,null); assert.strictEqual(M.oee.ready,false); assert.strictEqual(M.oee.value,null);
assert.strictEqual(M.warehouse.rm.balance,null); assert.strictEqual(M.quality.repair,null);
// 2) Sản lượng: đơn hoàn thành tính 1 lần; sổ công đoạn không cộng chéo
const DB={orders:[
 {id:'a',status:'done',kg:1000,doneAt:now-3600000,createdAt:now-5*D,deliveryDate:ds(t0)},
 {id:'b',status:'running',kg:500,deliveryDate:ds(t0),createdAt:now-D,runSessions:[{stage:'rut',machineId:'m1',startAt:now-4*3600000,endAt:null}]},
 {id:'c',status:'pending',kg:200,deliveryDate:ds(t0-2*D),createdAt:now-D},
 {id:'d',status:'pending',kg:0,createdAt:now}],
 mayRutLog:[{id:'1',ngay:ds(t0),soThanh:100,may:'Máy rút 1',ca:'1'}], nguyenLieuLog:[{id:'n',ngay:ds(t0),soLuong:900}],
 qrProducts:[{id:'q',qcResult:'pass',quantity:8,prodDate:ds(t0)},{id:'r',qcResult:'fail',quantity:2,prodDate:ds(t0)}],
 pauseHistory:[]};
c=run(DB); M=c.sfBuild({period:'day',anchor:now},now);
assert.strictEqual(M.output.actualKg,1000,'sản lượng thực tế = kg đơn hoàn thành, không cộng sổ công đoạn');
assert.strictEqual(M.output.planKg,1500); assert.strictEqual(M.output.missingKg,500); assert(Math.abs(M.output.pct-1000/1500)<1e-9);
assert.strictEqual(M.orders.overdue,1); assert.strictEqual(M.progress.nodue.length,1,'đơn chưa có hạn giao tách riêng');
assert.strictEqual(M.output.noKgOrders,1,'đơn thiếu kg được báo, không tính 0 âm thầm');
const rut=M.stages.rows.find(s=>s.key==='rut'), dun=M.stages.rows.find(s=>s.key==='dun');
assert.strictEqual(rut.value,100); assert.strictEqual(dun.value,900); assert.strictEqual(M.output.actualKg,1000,'không phải 100+900');
assert.strictEqual(M.quality.pass,8); assert.strictEqual(M.quality.ng,2); assert.strictEqual(M.quality.rate,0.8);
// 3) Giờ chạy máy cắt theo kỳ; phiên legacy không tính; OEE vẫn không có số dù có giờ chạy
assert(Math.abs(M.machines.rows.find(r=>r.m.id==='m1').runMs-4*3600000)<1);
DB.orders.push({id:'L',status:'done',doneAt:now,runSessions:[{stage:'rut',machineId:'m1',startAt:now-100*3600000,endAt:now,legacy:true}]});
M=c.sfBuild({period:'day',anchor:now},now); assert.strictEqual(M.machines.legacy,1); assert(M.machines.rows.find(r=>r.m.id==='m1').runMs<5*3600000);
assert.strictEqual(M.oee.ready,false); assert.strictEqual(M.oee.value,null);
// 4) Bộ lọc: máy/công đoạn/ca; ca không áp dụng cho đơn
M=c.sfBuild({period:'day',anchor:now,machine:'m1'},now); assert.strictEqual(M.orders.list.running.length,1);
M=c.sfBuild({period:'day',anchor:now,shift:'2'},now); assert.strictEqual(JSON.stringify(M.unsupported.orders),'["Ca"]'); assert.strictEqual(M.stages.rows.find(s=>s.key==='rut').value,0);
assert.strictEqual(M.stages.rows.find(s=>s.key==='dun').noShift,true);
// 4b) Ca 1 giữ dòng sổ ca 1
M=c.sfBuild({period:'day',anchor:now,shift:'1'},now); assert.strictEqual(M.stages.rows.find(s=>s.key==='rut').value,100);
// 5) Khoảng thời gian
const w=c.sfRange('week',new Date(2026,10,26).getTime()); assert.strictEqual(new Date(w.from).getDay(),1); assert.strictEqual((w.to-w.from)/D,7);
assert.strictEqual(c.sfBuckets(c.sfRange('year',now)).length,12); assert.strictEqual(c.sfBuckets(c.sfRange('month',now)).length,30);
// 6) Đồng bộ: chưa đồng bộ không bị coi là "0"
assert.strictEqual(M.empty,false); console.log('OK dashboard-sf (data rules)');
