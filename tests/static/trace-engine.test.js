// Chạy: node tests/static/trace-engine.test.js  (lõi truy xuất: liên kết chỉ bằng khóa, không ghép theo tên)
const fs=require('fs'); const vm=require('vm');
vm.runInThisContext(fs.readFileSync(require('path').join(__dirname,'../../src/modules/trace/trace-engine.js'),'utf8'));
const assert=require('assert'); let pass=0; const t=(n,f)=>{try{f();pass++;console.log('✓',n)}catch(e){console.log('✗',n,'\n  ',e.message);process.exitCode=1}};
const src={
 orders:[{id:'o1',customer:'Alpha',po:'PO-100',type:'10x100',matCodes:['H-777']},
         {id:'o2',customer:'Beta',po:'PO-200',type:'10x100'},
         {id:'o3',customer:'Alpha',po:'PO-300',type:'10x100'}],
 qr:[{id:'q1',qrCode:'DP-20260101-000001',productCode:'SP-20260101-000001',orderId:'o1'}],
 nl:[{id:'n1',heatLot:'H-777',donHangId:'o1',maLoSX:'LOT-A'},
     {id:'n2',heatLot:' h-777 ',donHangId:'o2'},          // cùng lô, đơn khác (khác hoa/thường, khoảng trắng)
     {id:'n3',heatLot:'H-888',donHangId:'o1'}],           // đơn o1 dùng 2 lô NL
 rut:[{id:'r1',donHangId:'o1',heatLot:'H-777',may:'R1',maLoSX:'LOT-A'},
      {id:'r2',donHangId:'',heatLot:'',khachHang:'Alpha',quyCach:'10x100'}], // chỉ trùng tên/quy cách → KHÔNG được ghép
 db:[{id:'d1',donHangId:'o2',heatLot:'H-777'}]
};
const ids=a=>a.map(x=>x.id).sort().join(',');
t('tìm theo mã đơn (ID)',()=>{const r=trSearch('o1',src);assert.equal(ids(r.primary.orders),'o1');assert.equal(ids(r.primary.qr),'q1');});
t('tìm theo PO',()=>{assert.equal(ids(trSearch('po-200',src).primary.orders),'o2');});
t('tìm theo Heat-Lot (không phân biệt hoa/thường/khoảng trắng)',()=>{const r=trSearch('h-777',src);assert.equal(ids(r.seeds.nl),'n1,n2');});
t('1 lô NL dùng cho nhiều đơn → đơn khác ở "related"',()=>{const r=trSearch('o1',src);assert.ok(ids(r.related.orders).includes('o2'));assert.ok(ids(r.related.db).includes('d1'));});
t('1 đơn dùng nhiều lô NL',()=>{const r=trSearch('o1',src);assert.deepEqual(r.material.heatLots.sort(),['H-777','H-888'].sort());});
t('hyphen khác nhau = lô khác (so khớp nghiêm ngặt)',()=>{const s2={...src,nl:[...src.nl,{id:'nx',heatLot:'H 777'}]};assert.ok(!ids(trSearch('h-777',s2).seeds.nl).includes('nx'));});
t('KHÔNG ghép theo tên KH/quy cách (r2 không xuất hiện)',()=>{const r=trSearch('o1',src);assert.ok(!ids(r.primary.rut).includes('r2'));assert.ok(!ids(r.related.rut).includes('r2'));});
t('tìm bằng tên KH chỉ là tìm kiếm, không tạo liên kết cho dòng sổ',()=>{const r=trSearch('alpha',src);assert.equal(ids(r.seeds.orders),'o1,o3');assert.ok(!ids(r.primary.rut).includes('r2'));});
t('mã lô SX gom các dòng cùng lô',()=>{const r=trSearch('LOT-A',src);assert.equal(ids(r.primary.rut),'r1');assert.equal(ids(r.primary.nl),'n1');});
t('QR: mã & link công khai',()=>{assert.equal(ids(trSearch('DP-20260101-000001',src).primary.orders),'o1');assert.equal(ids(trSearch('https://x/y/?qr=DP-20260101-000001&db=abc',src).primary.orders),'o1');});
t('mã sản phẩm',()=>{assert.equal(ids(trSearch('SP-20260101-000001',src).primary.orders),'o1');});
t('thiếu mã liên kết → có GAP, không đoán',()=>{const r=trSearch('o3',src);assert.ok(r.gaps.some(g=>g.code==='NO_LEDGER_LINK'&&g.orderId==='o3'));assert.ok(r.gaps.some(g=>g.code==='NO_QR'));assert.equal(trCoverage('o3',r,src).level,'none');});
t('tìm theo lô không kéo thêm lô khác của đơn, nhưng coverage vẫn tính đủ',()=>{const r=trSearch('H-888',src);assert.equal(ids(r.primary.nl),'n3');assert.equal(ids(r.primary.orders),'o1');assert.equal(trCoverage('o1',r,src).level,'partial');});
t('coverage đầy đủ/một phần',()=>{const r=trSearch('o1',src);assert.equal(trCoverage('o1',r,src).level,'partial');});
t('rút thiếu Heat-Lot → cảnh báo CHƯA XÁC ĐỊNH',()=>{const r=trSearch('o1',src);assert.ok(!r.gaps.some(g=>g.code==='NO_HEATLOT_rut'));const s2={...src,rut:[{id:'r9',donHangId:'o1'}]};assert.ok(trSearch('o1',s2).gaps.some(g=>g.code==='NO_HEATLOT_rut'));});
t('ô nhập rỗng / ngắn → không khớp bừa',()=>{assert.equal(trSearch('',src).primary,null);assert.equal(ids(trSearch('h',src).primary.nl),'');});
t('không đổi dữ liệu nguồn',()=>{const snap=JSON.stringify(src);trSearch('o1',src);trSearch('h-777',src);assert.equal(JSON.stringify(src),snap);});

// ── Tìm theo quy cách kích thước: 10x100 / 10*100 / 10 X 100 / 10×100 ──
const specSrc={
 orders:[{id:'s1',customer:'A',po:'P1',type:'Đồng thanh dẹt',thickness:'10',width:'100',length:4000},
         {id:'s2',customer:'B',po:'P2',type:'Đồng thanh dẹt',thickness:'110',width:'100',length:3000},
         {id:'s3',customer:'C',po:'P3',type:'Đồng tròn',isRound:true,phi:18,length:6000},
         {id:'s4',customer:'D',po:'P4',type:'10*100 mạ',thickness:'5',width:'30',length:2000}],
 qr:[{id:'qs',qrCode:'DP-1',productCode:'SP-1',orderId:'s1',productName:'Đồng thanh',spec:{thickness:10,width:100,length:4000}}],
 nl:[], rut:[{id:'rs',donHangId:'',heatLot:'',quyCach:'10 x 100'}], db:[]
};
['10x100','10*100','10X100','10×100','10 x 100',' 10 * 100 ','10x100mm'].forEach(q=>{
  t('quy cách "'+q+'" tìm ra đơn 10x100 (và dòng sổ cùng quy cách)',()=>{const r=trSearch(q,specSrc);assert.ok(ids(r.seeds.orders).includes('s1'),ids(r.seeds.orders));assert.ok(ids(r.seeds.rut).includes('rs'));assert.ok(ids(r.seeds.qr).includes('qs'));});
});
t('gõ đủ 10x100x4000 vẫn ra đơn & QR (không cần dòng sổ)',()=>{const r=trSearch('10x100x4000',specSrc);assert.ok(ids(r.seeds.orders).includes('s1'));assert.ok(ids(r.seeds.qr).includes('qs'));assert.ok(!ids(r.seeds.orders).includes('s2'));});
t('10x100 KHÔNG khớp 110x100 (so khớp theo ranh giới số)',()=>{assert.ok(!ids(trSearch('10x100',specSrc).seeds.orders).includes('s2'));});
t('quy cách nằm ở giữa: 100x4000 khớp 10x100x4000',()=>{assert.ok(ids(trSearch('100x4000',specSrc).seeds.orders).includes('s1'));});
t('loại hàng ghi sẵn 10*100 vẫn khớp khi gõ 10x100',()=>{const s={...specSrc,orders:[{id:'z',customer:'Z',type:'10*100 mạ'}]};assert.equal(ids(trSearch('10x100',s).seeds.orders),'z');});
t('Φ18 / phi18 / Ø18 tìm ra đồng tròn',()=>{['Φ18','phi18','Ø18','phi 18'].forEach(q=>assert.ok(ids(trSearch(q,specSrc).seeds.orders).includes('s3'),q));});
t('số trơn "100" không bị coi là quy cách',()=>{assert.equal(trSpecQuery('100'),'');assert.equal(trSpecQuery('po-100'),'');assert.equal(ids(trSearch('100',specSrc).seeds.rut),'');});
t('số thập phân 2,5x30 = 2.5*30',()=>{assert.equal(trSpecQuery('2,5x30'),trSpecQuery('2.5*30'));});
console.log(pass+' passed');
