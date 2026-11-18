// Nâng cấp UI: sơ đồ quy trình (Tổng quan) + dòng chảy sản xuất (Kế hoạch SX). Chỉ kiểm tra hiển thị, KHÔNG đổi nghiệp vụ.
// Chạy: node tests/static/ui-flow-fx.test.js   (jsdom, không phải trình duyệt thật)
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const R=p=>fs.readFileSync(path.join(__dirname,'../../src/modules',p),'utf8');
const STAGES=[{key:'dun',label:'Đùn',icon:'D'},{key:'rut',label:'Rút',icon:'R'},{key:'danhbong',label:'Đánh bóng',icon:'B'},{key:'cat',label:'Cắt',icon:'C'}];
const calls=[];
const ctx={console,Date,Math,parseFloat,Number,Set,STAGES,DB:{orders:[],nguyenLieuLog:[]},AUTOCLEAN_DAYS:30,
  todayStr:()=>'2026-11-17',ovFmtKg:v=>String(Math.round(v)),goTab:()=>{},requestSetStage:(...a)=>calls.push(a),
  document:{addEventListener(){},hidden:false,documentElement:{classList:{toggle(c,v){ctx._cls=[c,v]}}}},window:{}};
vm.createContext(ctx);
vm.runInContext(R('planning/planning-fx.js').replace(/^const /gm,'var '),ctx);
vm.runInContext(R('quality/quality-view.js').replace(/^let /gm,'var '),ctx);
vm.runInContext(R('dashboard/dashboard-view.js').replace(/^const /gm,'var '),ctx);

// ── Kế hoạch SX: luồng công đoạn ──
const run=vm.runInContext("khStageFlow({id:'A1',status:'running',stage:'rut'},true)",ctx);
assert.strictEqual((run.match(/kh-link is-flow/g)||[]).length,1,'chỉ 1 đoạn nối có hạt sáng (đoạn sau công đoạn đang chạy)');
assert.strictEqual((run.match(/class="kh-spark"/g)||[]).length,2,'2 hạt lệch pha, không dày đặc');
assert(/<span class="kh-lane"[^>]*><i class="kh-spark"><\/i><i class="kh-spark"><\/i><\/span>/.test(run),'hạt nằm trong lane (không tràn)');
assert(/requestSetStage\('A1','dun'\)/.test(run)&&/requestSetStage\('A1','cat'\)/.test(run),'giữ nguyên thao tác đổi công đoạn');
assert((run.match(/st-done/g)||[]).length===1&&(run.match(/st-active/g)||[]).length===1,'trạng thái xong/đang/chờ không đổi');
const pend=vm.runInContext("khStageFlow({id:'A2',status:'pending'},true)",ctx);
assert(!/kh-spark/.test(pend)&&!/st-active/.test(pend)&&!/st-done/.test(pend),'đơn chờ: không hạt sáng, không giả đang chạy');
const done=vm.runInContext("khStageFlow({id:'A3',status:'done'},true)",ctx);
assert(!/kh-spark/.test(done)&&!/st-active/.test(done)&&!/onclick/.test(done),'đơn xong: không hạt sáng, không bấm đổi công đoạn');
// ── Thanh tiến độ ──
let p=vm.runInContext("khProgressFx({id:'A1',status:'running',qty:100,doneQty:30})",ctx);
assert(/width:30%;--from:0%/.test(p)&&/<b>30<\/b>/.test(p)&&/<em>30%<\/em>/.test(p),'lần đầu chạy từ 0 → giá trị thật');
p=vm.runInContext("khProgressFx({id:'A1',status:'running',qty:100,doneQty:60})",ctx);
assert(/width:60%;--from:30%/.test(p),'đổi tiến độ: chạy từ giá trị cũ tới mới');
p=vm.runInContext("khProgressFx({id:'A1',status:'running',qty:100,doneQty:100})",ctx);
assert(/is-full/.test(p)&&/width:100%/.test(p));
assert.strictEqual(vm.runInContext("khProgressFx({id:'Z',status:'pending',qty:5,doneQty:0})",ctx),'');
assert(ctx._cls&&ctx._cls[0]==='fx-paused','đã gắn xử lý tab ẩn');

// ── Tổng quan: sơ đồ quy trình ──
ctx.DB.orders=[{id:'1',status:'running',stage:'dun',kg:10},{id:'2',status:'pending',kg:5},{id:'3',status:'done',kg:7,doneAt:Date.now()}];
const h=vm.runInContext('buildOvBusbarFlow(DB.orders)',ctx);
assert.strictEqual((h.match(/class="ovp-node /g)||[]).length,6,'đủ 6 công đoạn');
['Nguyên Liệu','Đùn','Rút','Đánh Bóng','Cắt Ngắn','Nhập Kho'].forEach(n=>assert(h.includes(`<div class="ovp-name">${n}</div>`),n));
assert(/Nguyên liệu → Đùn → Rút → Đánh bóng → Cắt ngắn → Nhập kho/.test(h),'giữ nguyên quy trình');
assert.strictEqual((h.match(/class="ovp-pipe /g)||[]).length,5,'5 đường dẫn');
assert.strictEqual((h.match(/class="ovp-p"/g)||[]).length,5,'1 hạt chính / đường dẫn');
assert.strictEqual((h.match(/class="ovp-p ovp-p2"/g)||[]).length,5,'+1 hạt lệch pha / đường dẫn (tổng 2)');
assert(/<b>1<\/b><small>đơn đã nhập kho/.test(h),'Nhập Kho = số đơn hoàn thành');
assert.strictEqual((h.match(/<svg /g)||[]).length,3,'3 node dùng icon SVG');
assert(/class="ovp-photo" src="src\/assets\/stage-danhbong\.jpg" alt="Đánh Bóng"/.test(h)&&/OVP_ICONS\.danhbong/.test(h),'node Đánh Bóng dùng ảnh máy + icon dự phòng');
assert(/class="ovp-photo" src="src\/assets\/stage-rut\.jpg" alt="Rút"/.test(h)&&/OVP_ICONS\.rut/.test(h),'node Rút dùng ảnh tủ điều khiển + icon dự phòng');
assert(/<div class="ovp-icon has-photo"><img class="ovp-photo" src="src\/assets\/stage-dun\.jpg" alt="Đùn"/.test(h),'node Đùn dùng ảnh máy đùn thay icon');
assert(/this\.outerHTML=OVP_ICONS\.dun/.test(h),'có icon dự phòng khi ảnh lỗi');
assert(/dpOpenStageList\('dun'\)/.test(h)&&/dpOpenStageList\('cat'\)/.test(h)&&/goTab\('soLieu'\)/.test(h),'bấm node vẫn mở đúng chi tiết');
assert(/tone-run/.test(h)&&/tone-idle/.test(h),'màu: đang chạy xanh dương / chờ trung tính');
console.log('OK ui-flow-fx');
