// Chạy: node tests/static/trace-timeline.test.js
// Khóa các quy tắc của nâng cấp Truy xuất: QC + timeline + phạm vi tìm. Nguyên tắc cốt lõi: KHÔNG tự tạo liên kết khi thiếu khóa.
const fs=require('fs'), vm=require('vm'), assert=require('assert');
vm.runInThisContext(fs.readFileSync(require('path').join(__dirname,'../../src/modules/trace/trace-engine.js'),'utf8'));
let pass=0; const t=(n,f)=>{try{f();pass++;console.log('✓',n)}catch(e){console.log('✗',n,'\n  ',e.message);process.exitCode=1}};
const T=Date.parse('2026-11-02T08:00:00');
const src={
 orders:[{id:'oA',customer:'ABC',po:'PO-A',delivered:true,deliveredAt:T+1e6,deliveredBy:'Hùng',exportSlipNo:'PX-9',createdAt:T},{id:'oB',customer:'XYZ',po:'PO-B',createdAt:T}],
 nl:[{id:'n1',donHangId:'oA',heatLot:'HL-1',maLoSX:'LSX-1',may:'E-02',createdAt:T+1,updatedBy:'Minh',wo:'WO-5'},{id:'n2',donHangId:'oB',heatLot:'HL-2'}],
 rut:[{id:'r1',donHangId:'oA',heatLot:'HL-1',maLoSX:'LSX-1',may:'R-3',nguoiSanXuat:'Tuấn',ngay:'2026-11-04'}],
 db:[{id:'d1',donHangId:'oA',congDoan:'Đánh bóng',may:'B-1',maLoSX:'LSX-1'},{id:'d2',donHangId:'oA',congDoan:'Cắt',may:'C-2',maLoSX:'LSX-1'}],
 qr:[{id:'q1',qrCode:'DP-1',productCode:'SP-1',orderId:'oA'}],
 qc:[{id:'c1',type:'chk',form:'rut',orderId:'oA',lot:'LSX-1',inspector:'Hà',createdAt:T+5,result:'OK'},
     {id:'c2',type:'fqc',orderId:'oA',productCode:'SP-1',inspector:'Hà',createdAt:T+9,result:'NG'},
     {id:'c3',type:'chk',form:'cat',orderId:'',lot:'LSX-1',inspector:'Phong',createdAt:T+7,result:'OK'},   // mồ côi, nối theo mã lô
     {id:'c4',type:'chk',form:'dun',orderId:'',lot:'',customer:'ABC',inspector:'Mồi',result:'OK'},       // chỉ trùng tên khách → KHÔNG nối
     {id:'c5',type:'chk',form:'cat',orderId:'oA',lot:'LSX-1',status:'draft',result:'NG',createdAt:T+8}]};  // nháp → không tính vào kết quả
const ids=a=>a.map(x=>x.id).sort().join(',');
t('QC nối bằng ID đơn / mã lô; KHÔNG nối theo tên khách hàng',()=>{ const r=trSearch('PO-A',src); assert.strictEqual(ids(r.primary.qc),'c1,c2,c3,c5'); assert.ok(!r.primary.qc.some(q=>q.id==='c4')); });
t('Lý do liên kết QC được ghi rõ',()=>{ const r=trSearch('PO-A',src); assert.strictEqual(r.qcVia.c3,'Theo mã lô'); assert.strictEqual(r.qcVia.c1,'Theo ID đơn hàng'); });
t('Timeline đơn đủ chuỗi: 8/8, nhà cung cấp luôn "nodata"',()=>{ const tl=trTimeline('oA',src); assert.strictEqual(tl.have+'/'+tl.total,'8/8'); assert.strictEqual(tl.stages.find(s=>s.key==='supplier').status,'nodata'); });
t('Máy đùn = Sổ nguyên liệu; Máy cắt tách khỏi đánh bóng',()=>{ const tl=trTimeline('oA',src); assert.deepStrictEqual(tl.stages.find(s=>s.key==='material').machines,['E-02']); assert.deepStrictEqual(tl.stages.find(s=>s.key==='cut').machines,['C-2']); assert.deepStrictEqual(tl.stages.find(s=>s.key==='polish').machines,['B-1']); });
t('Đơn thiếu: công đoạn không có khóa → missing, không điền tạm',()=>{ const tl=trTimeline('oB',src); ['rut','polish','cut','qc','qr','delivery'].forEach(k=>assert.strictEqual(tl.stages.find(s=>s.key===k).status,'missing',k)); assert.strictEqual(tl.have+'/'+tl.total,'2/8'); });
t('QC: nháp không làm đổi kết luận; có NG → NG',()=>{ const q=trTimeline('oA',src).stages.find(s=>s.key==='qc'); assert.strictEqual(q.result,'NG'); const only={...src,qc:[src.qc[0],src.qc[4]]}; assert.strictEqual(trTimeline('oA',only).stages.find(s=>s.key==='qc').result,'OK'); });
t('Giao hàng có số phiếu xuất & người giao',()=>{ const d=trTimeline('oA',src).stages.find(s=>s.key==='delivery').items[0]; assert.ok(d.detail.includes('PX-9')); assert.strictEqual(d.who,'Hùng'); });
t('Mốc thời gian: dòng chỉ có ngày không bị báo là có giờ',()=>{ const it=trTimeline('oA',src).stages.find(s=>s.key==='rut').items[0]; assert.strictEqual(it.exact,false); assert.ok(it.ts>0); const nl=trTimeline('oA',src).stages.find(s=>s.key==='material').items[0]; assert.strictEqual(nl.exact,true); });
t('Phạm vi tìm: mã lô không ra khi chọn "Mã đơn"; WO chỉ ra ở "Phiếu SX"/"Tất cả"',()=>{
  assert.strictEqual(trSearch('HL-1',src,'order').primary.orders.length,0); assert.ok(trSearch('HL-1',src,'lot').primary.nl.length>0);
  assert.strictEqual(trSearch('WO-5',src,'product').primary.nl.length,0); assert.strictEqual(trSearch('WO-5',src,'wo').primary.nl.length,1); assert.strictEqual(trSearch('WO-5',src,'all').primary.nl.length,1); });
t('Tìm theo mã sản phẩm / số phiếu QC',()=>{ assert.strictEqual(trSearch('SP-1',src,'product').primary.qr.length,1); assert.ok(trSearch('SP-1',src,'all').primary.qc.some(q=>q.id==='c2')); });
t('Không có kết quả → rỗng, không ném lỗi',()=>{ const r=trSearch('KHONG-CO',src); assert.strictEqual(r.primary.orders.length+r.primary.qc.length,0); });
t('Không ghi vào nguồn (chỉ đọc)',()=>{ const snap=JSON.stringify(src); trSearch('PO-A',src); trTimeline('oA',src); trTimeline('oB',src); assert.strictEqual(JSON.stringify(src),snap); });
console.log(pass+' passed');
