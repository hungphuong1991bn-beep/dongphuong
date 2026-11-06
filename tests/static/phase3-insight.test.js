// Kiểm thử Giai đoạn 3 bằng jsdom (KHÔNG phải trình duyệt thật): nạp mã THẬT của utils + dashboard-factory (dpDrawer)
// + các file *-insight / trace-export; các hàm render gốc của tab được THAY BẰNG hàm giả chỉ ghi #mc (vì chúng cần toàn bộ ứng dụng).
// Mục tiêu: kiểm logic đếm/ghép dải, tính chất "chỉ đọc", chịu lỗi, CSV. Không thay thế kiểm thử UI trên trình duyệt.
const path=require('path'), fs=require('fs'), {JSDOM}=require('jsdom'), assert=require('assert');
const R=p=>fs.readFileSync(path.join(__dirname,'..','..',p),'utf8');
const dom=new JSDOM('<body><div id="mc"></div></body>',{runScripts:'outside-only',url:'http://localhost/'});
const w=dom.window; const run=(code,name)=>{ try{ w.eval(code); }catch(e){ console.error('LOAD FAIL',name,e); process.exit(1); } };
const day=n=>{ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); const z=x=>String(x).padStart(2,'0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; };
w.eval(`var DB={orders:[],users:[],nguyenLieuLog:[],mayRutLog:[],mayDanhBongLog:[],qrProducts:[]};
 var _slTab='nguyenLieu'; var _trQ='';
 var SL_META={nguyenLieu:{label:'Sổ nguyên liệu'},mayRut:{label:'Sổ máy Rút'},mayDanhBong:{label:'Sổ máy Đánh bóng + Cắt'}};
 function slArr(t){return {nguyenLieu:DB.nguyenLieuLog,mayRut:DB.mayRutLog,mayDanhBong:DB.mayDanhBongLog}[t];}
 function khIsTopPriority(o){return !!o.priority && parseInt(String(o.priority).replace('GẤP ',''))<=3;}
 function slViewDetail(){} function ddViewDetail(){}
 var __toast=[]; function showToast(m,e){__toast.push([m,!!e]);}
 function renderDorDang(){document.getElementById('mc').innerHTML='<div class="dd-page-head">ĐH</div>';}
 function renderKeHoach(){document.getElementById('mc').innerHTML='<div class="kh-head">KH</div>';}
 function renderSoLieu(){document.getElementById('mc').innerHTML='<div class="sl-tabs">T</div><div id="slStats"></div>';}
 function trRun(){document.getElementById('mc').innerHTML='<div id="trResult">'+(_trQ?'<section class="tr-sec">x</section>':'')+'</div>';}
 function trSearch(q){return window.__res;}`);
['src/utils/helpers.js','src/utils/date.js','src/utils/format.js'].forEach(f=>run(R(f),f));
// dashboard-factory dùng nhiều hàm khác khi gọi; chỉ cần dpDrawer/dpOrderRows lúc nạp → thử nạp thật
run(R('src/modules/dashboard/dashboard-factory.js'),'dashboard-factory');
['src/components/shared/ModuleEnhance.js','src/modules/orders/orders-insight.js','src/modules/planning/planning-insight.js','src/modules/inventory/inventory-insight.js','src/modules/trace/trace-export.js'].forEach(f=>run(R(f),f));
const $=id=>w.document.getElementById(id); const txt=id=>($(id)||{}).textContent||'';
let n=0; const ok=m=>{n++;console.log('✓',m);};
// ── dữ liệu mẫu
w.eval(`DB.orders=[
 {id:'a1',customer:'KH A',po:'P1',status:'pending',deliveryDate:'${day(2)}',kg:100,priority:'GẤP 1'},
 {id:'a2',customer:'KH B',po:'P2',status:'running',deliveryDate:'${day(0)}',kg:50},
 {id:'a3',customer:'',po:'P3',status:'pending',kg:30,planned:true},
 {id:'a4',customer:'KH C',po:'P4',status:'pending',deliveryDate:'${day(-2)}',kg:20},
 {id:'a5',customer:'KH D',po:'P5',status:'done',deliveryDate:'${day(1)}',kg:999},
 {id:'a6',customer:'KH E',po:'P6',status:'pending',deliveryDate:'${day(10)}'}
]`);
const snap=JSON.stringify(JSON.parse(w.eval('JSON.stringify(DB)')));
// 1. Đơn hàng
w.renderDorDang();
assert($('ordInsight'), 'có dải đơn'); assert($('mc').firstChild.id==='ordInsight','dải nằm đầu #mc'); assert($('mc').querySelector('.dd-page-head'),'nội dung gốc còn nguyên');
const g=w.ordAttentionGroups(); const by=k=>g.find(x=>x.key===k).list.map(o=>o.id).sort().join(',');
assert.strictEqual(by('soon'),'a1,a2','đến hạn ≤3 ngày: a1(+2), a2(hôm nay); không gồm a4 trễ, a5 done, a6 +10');
assert.strictEqual(by('urgent'),'a1','ưu tiên cao chưa kế hoạch');
assert.strictEqual(by('nodue'),'a3','chưa có ngày giao');
assert.strictEqual(by('nocust'),'a3','chưa có khách');
ok('Đơn hàng: 4 nhóm đếm đúng, không lẫn đơn done/trễ/xa');
w.renderDorDang(); assert.strictEqual(w.document.querySelectorAll('#ordInsight').length,1); ok('Render lại không tạo dải trùng');
w.ordOpenAttention('soon'); assert(/2\)/.test($('dpDrawer').textContent)||$('dpDrawer').classList.contains('open')); assert($('dpDrawer').classList.contains('open')); ok('Bấm chip mở ngăn danh sách');
// 2. Kế hoạch
w.renderKeHoach(); assert($('plnInsight'));
const m=w.plnLoadModel();
assert.strictEqual(m.days[0].list.map(o=>o.id).join(),'a2'); assert.strictEqual(m.days[2].list.map(o=>o.id).join(),'a1');
assert.strictEqual(m.days[2].kg,100); assert.strictEqual(m.late.map(o=>o.id).join(),'a4'); assert.strictEqual(m.later.map(o=>o.id).join(),'a6'); assert.strictEqual(m.noDue.map(o=>o.id).join(),'a3');
assert.strictEqual(m.days[3].list.length,0,'đơn done không tính (a5 hạn +1)'); assert.strictEqual(m.days[1].list.length,0);
assert.strictEqual(m.days.reduce((s,d)=>s+d.noKg,0),0);
ok('Kế hoạch: gán đúng ngày, trễ/sau 7 ngày/không hạn, bỏ đơn done');
w.eval('DB.orders.push({id:"a7",customer:"Z",status:"pending",deliveryDate:"'+day(2)+'"})'); assert.strictEqual(w.plnLoadModel().days[2].noKg,1); ok('Đơn thiếu kg được đếm riêng, không cộng bừa');
// 3. Sổ liệu
w.eval(`DB.nguyenLieuLog=[{id:'n1',ngay:'2026-11-01',heatLot:'H1',donHangId:'a1',maLoSX:'L1'},{id:'n2',ngay:'2026-11-02',heatLot:'H2'},{id:'n3',ngay:'2026-11-03',nguyenLieu:'Cu',donHangId:' '}]`);
w.renderSoLieu(); assert($('slInsight')); assert($('mc').children[0].className==='sl-tabs' && $('mc').children[1].id==='slInsight','dải ngay sau .sl-tabs');
const s=w.slLinkStats('nguyenLieu'); assert.strictEqual(s.n,3); assert.strictEqual(s.withOrder,1); assert.strictEqual(s.withLot,2); assert.strictEqual(s.withSX,1); assert.strictEqual(s.missing.length,2);
ok('Sổ liệu: độ phủ liên kết đúng (khoảng trắng coi là thiếu)');
w._slTab='mayRut'; w.renderSoLieu(); assert(/CHƯA CÓ DỮ LIỆU/.test($('slInsight').innerHTML)); ok('Sổ rỗng → CHƯA CÓ DỮ LIỆU, không chia 0');
w.eval(`DB.mayRutLog=[{id:'r1',ngay:'2026-11-01',quyCach:'<img src=x onerror=alert(1)>',khachHang:'K'}]`); w.slOpenUnlinked();
assert(!$('dpDrawer').querySelector('img'),'tên dòng sổ được escape (không chèn HTML)'); ok('Escape HTML trong ngăn danh sách sổ');
// 4. Truy xuất CSV
w._trQ='H1'; w.eval(`window.__res={primary:{orders:[DB.orders[0]],nl:[DB.nguyenLieuLog[0]],rut:[],db:[],qr:[{qrCode:'QR1',productName:'=HYPERLINK("x")',quantity:5,currentStage:'cut',qcResult:'pass'}]},related:{orders:[],nl:[DB.nguyenLieuLog[1]],rut:[],db:[]}}`);
w.trRun(); assert($('trExportBar'),'có nút xuất'); w._trQ=''; w.trRun(); assert(!$('trExportBar'),'không kết quả → không nút'); w._trQ='H1';
const rows=w.trBuildCsvRows(w.__res); assert.strictEqual(rows.length,5); assert(rows[0][0]==='Nhóm');
assert(/Dùng chung lô/.test(rows[4][0]),'nhóm liên quan được gắn nhãn');
assert.strictEqual(w.trCsvCell('=HYPERLINK("x")'),`"'=HYPERLINK(""x"")"`); assert.strictEqual(w.trCsvCell('a"b'),'"a""b"'); assert.strictEqual(w.trCsvCell(null),'""');
ok('CSV: 4 nhóm dòng + nhãn liên quan, chống công thức, nháy kép đúng');
let blobs=0; w.URL.createObjectURL=b=>{blobs++; return 'blob:x';}; w.URL.revokeObjectURL=()=>{}; w.HTMLAnchorElement.prototype.click=function(){};
w.trExportCsv(); assert.strictEqual(blobs,1); assert(/Đã xuất 4/.test(w.__toast.at(-1)[0])); ok('Xuất CSV tạo 1 tệp, thông báo số dòng');
w._trQ=''; w.trExportCsv(); assert.strictEqual(w.__toast.at(-1)[1],true); ok('Ô tìm rỗng → báo lỗi, không tạo tệp');
// 5. Chịu lỗi + chỉ đọc
w.eval('DB.orders=null'); w.renderDorDang(); assert($('mc').querySelector('.dd-page-head'),'lỗi dải không làm mất nội dung gốc'); ok('Lỗi dữ liệu trong dải → nội dung tab gốc vẫn hiển thị');
w.eval('DB.orders='+JSON.stringify(JSON.parse(snap).orders));
// Chỉ đọc: chụp DB, chạy mọi dải + mở mọi ngăn + xuất CSV, DB phải y nguyên
const before=w.eval('JSON.stringify(DB)');
w._slTab='nguyenLieu'; w._trQ='H1';
w.renderDorDang(); w.renderKeHoach(); w.renderSoLieu(); w.trRun();
['soon','urgent','nodue','nocust'].forEach(k=>w.ordOpenAttention(k)); [0,1,2,3,4,5,6].forEach(i=>w.plnOpenDay(i)); ['late','later','nodue'].forEach(k=>w.plnOpenGroup(k)); w.slOpenUnlinked();
w.trExportCsv();
assert.strictEqual(w.eval('JSON.stringify(DB)'),before,'DB không bị đổi'); ok('Chỉ đọc: DB y nguyên sau khi chạy toàn bộ dải/ngăn/xuất CSV');
assert.strictEqual(w.dpEnhanceRender('renderDorDang',()=>{}),false,'không bọc hai lần'); ok('Không bọc 2 lần');
console.log(`\n${n} nhóm kiểm thử đạt`);
