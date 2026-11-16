// Nhập kho ở Tổng quan phải ĐỒNG BỘ với tab Đơn hoàn thành (cùng htWarehouseSummary)
// và khối "Tình trạng sản xuất theo công đoạn" phải đã bị bỏ. Chạy: node tests/static/dashboard-warehouse-sync.test.js
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const R=p=>fs.readFileSync(path.join(__dirname,'../../src/modules',p),'utf8');
const now=Date.now(), old=now-3*86400000;
const DB={orders:[
 {id:'1',status:'done',kg:10,doneAt:now},                                  // chờ nhập
 {id:'2',status:'done',kg:20,doneAt:now,whIn:true,whAt:now},               // nhập hôm nay (chờ giao)
 {id:'3',status:'done',kg:30,doneAt:old,whIn:true,whAt:old,delivered:true},// đã nhập + đã giao
 {id:'4',status:'done',kg:5,doneAt:now,returned:true},                      // hoàn trả: không tính chờ nhập
 {id:'5',status:'running',kg:99,stage:'dun'}],nguyenLieuLog:[]};
const ctx={DB,AUTOCLEAN_DAYS:30,console,Date,parseFloat,Number,Set,
  todayStr:()=>new Date().toISOString().slice(0,10),ovFmtKg:v=>String(Math.round(v)),
  STAGES:[],goTab:t=>ctx._tab=t};
vm.createContext(ctx);
vm.runInContext(R('quality/quality-view.js').replace(/^let /gm,'var '),ctx);
vm.runInContext(R('dashboard/dashboard-view.js'),ctx);
const w=vm.runInContext('htWarehouseSummary(DB.orders)',ctx);
assert.strictEqual(w.wait.length,1,'chờ nhập');
assert.strictEqual(w.inWh.length,2,'đã nhập kho');
assert.strictEqual(w.inToday.length,1,'nhập hôm nay');
assert.strictEqual(w.kgIn,50);
const html=vm.runInContext('buildOvBusbarFlow(DB.orders)',ctx);
assert(/Nhập Kho/.test(html)&&/<b>2<\/b><small>đơn đã nhập kho/.test(html),'node Nhập Kho đúng số');
assert(/1 đơn chờ nhập/.test(html));
assert(/ovGoWarehouse\('new'\)/.test(html),'bấm → lọc Chờ nhập kho');
vm.runInContext("ovGoWarehouse('wh_all')",ctx);
assert.strictEqual(ctx._tab,'hoanThanh'); assert.strictEqual(vm.runInContext('htFilterStatus',ctx),'wh_all');
const fac=R('dashboard/dashboard-factory.js');
assert(!/buildDpStageBoard/.test(fac)&&!/Tình trạng sản xuất theo công đoạn<\/div>/.test(fac),'đã bỏ khối công đoạn');
assert(/dpOpenStageList/.test(fac),'giữ drawer cho sơ đồ quy trình');
console.log('OK dashboard-warehouse-sync');
