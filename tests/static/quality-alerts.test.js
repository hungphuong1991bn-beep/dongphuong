// Chạy: node tests/static/quality-alerts.test.js
// Khóa logic nâng cấp Chất lượng: cảnh báo dữ liệu chưa nhập, lịch sử theo lô/đơn, thời gian kiểm tra, 4 nhóm biểu mẫu.
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
globalThis.DB={cpRecords:[]}; globalThis.currentUser={name:'QC1',role:'admin'}; globalThis.localStorage={getItem(){return null},setItem(){},removeItem(){}};
globalThis.window=globalThis; globalThis.addEventListener=()=>{}; globalThis.removeEventListener=()=>{}; globalThis.document={getElementById(){return null},addEventListener(){}};
vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../../src/modules/quality/cp-core.js'),'utf8'));
let pass=0; const t=(n,f)=>{try{f();pass++;console.log('✓',n)}catch(e){console.log('✗',n,'\n  ',e.message);process.exitCode=1}};
const NOW=Date.parse('2026-11-10T12:00:00'), H=3600e3;
const mk=o=>Object.assign({status:'done',source:'app',date:'2026-11-10'},o);
const reset=a=>{ DB.cpRecords=a; };
const keys=()=>cpAlertList(NOW).map(a=>a.key+':'+a.n).join(' ');

t('4 nhóm: Control Plan · AQL · Kiểm tra QC · Hồ sơ chất lượng',()=>{
  assert.deepStrictEqual(CP_GROUPS.map(g=>g.key),['A','B','C','D']);
  const of=g=>CP_FORMS.filter(f=>f.g===g).map(f=>f.key).join(',');
  assert.strictEqual(of('A'),'cp,pfmea'); assert.strictEqual(of('B'),'aql,defects');
  assert.strictEqual(of('C'),'dothang,dun,rut,danhbong,cat,fqc'); assert.strictEqual(of('D'),'ncr,hold,eightd');
  assert.strictEqual(CP_FORMS.length,13); // không mất biểu mẫu nào
});
t('Không có phiếu → không cảnh báo',()=>{ reset([]); assert.strictEqual(keys(),''); });
t('Phiếu đủ OK + mã lô + đơn → không cảnh báo',()=>{ reset([mk({id:'a',type:'chk',form:'rut',result:'OK',lot:'L1',orderId:'o1',createdAt:NOW-H})]); assert.strictEqual(keys(),''); });
t('Thiếu kết luận / mã lô / đơn được đếm đúng, mỗi loại một lần',()=>{
  reset([mk({id:'a',type:'chk',form:'rut',result:'UNK',lot:'',orderId:'',createdAt:NOW-H}), mk({id:'b',type:'fqc',result:'OK',lot:'L2',orderId:'',createdAt:NOW-H})]);
  assert.strictEqual(keys(),'unk:1 nolot:1 noorder:2'); });
t('Phiếu nhập từ Excel KHÔNG vào cảnh báo (đã có hộp "Cần kiểm tra")',()=>{ reset([mk({id:'x',type:'chk',form:'rut',source:'excel',result:'UNK',lot:'',orderId:''})]); assert.strictEqual(keys(),''); });
t('Nháp: chỉ cảnh báo khi quá 24 giờ; phiếu huỷ bị bỏ qua',()=>{
  reset([mk({id:'d1',type:'chk',form:'cat',status:'draft',createdAt:NOW-2*H}), mk({id:'d2',type:'chk',form:'cat',status:'draft',createdAt:NOW-30*H}), mk({id:'v',type:'chk',form:'cat',status:'draft',createdAt:NOW-90*H,void:true})]);
  assert.strictEqual(keys(),'draft:1'); });
t('HOLD chưa giải quyết & 8D quá hạn',()=>{
  reset([mk({id:'h',type:'hold',status:'HOLD'}), mk({id:'h2',type:'hold',status:'RELEASE'}), mk({id:'e',type:'eightd',status:'Đang xử lý',steps:[{status:'Mở',due:'2020-01-01'}]}), mk({id:'e2',type:'eightd',status:'Đã đóng',steps:[{status:'Mở',due:'2020-01-01'}]})]);
  const k=keys(); assert.ok(/hold:1/.test(k)&&/d8late:1/.test(k),k); });
t('Chỉ đọc: cảnh báo & lịch sử không sửa dữ liệu',()=>{ const a=[mk({id:'a',type:'chk',result:'UNK',orderId:'o1',lot:'L'})]; reset(a); const snap=JSON.stringify(a); cpAlertList(NOW); cpHistoryFor(a[0]); assert.strictEqual(JSON.stringify(a),snap); });

t('Lịch sử: nối theo ID đơn / mã lô / mã sản phẩm; KHÔNG nối theo tên khách hàng',()=>{
  const cur=mk({id:'cur',type:'chk',form:'rut',orderId:'o1',lot:'L1',productCode:'SP1',customer:'ABC'});
  reset([cur, mk({id:'a',type:'chk',orderId:'o1',createdAt:3}), mk({id:'b',type:'fqc',orderId:'',lot:' l1 ',createdAt:2}), mk({id:'c',type:'chk',orderId:'',lot:'',productCode:'sp1',createdAt:1}),
         mk({id:'d',type:'chk',orderId:'o9',lot:'L9',customer:'ABC',createdAt:9}), mk({id:'e',type:'chk',orderId:'o1',void:true}), mk({id:'cp',type:'cp',orderId:'o1'})]);
  const h=cpHistoryFor(cur); assert.deepStrictEqual(h.map(x=>x.r.id+':'+x.via),['a:Cùng đơn hàng','b:Cùng mã lô','c:Cùng mã sản phẩm']); });
t('Lịch sử: phiếu không có khóa nào → rỗng (không đoán)',()=>{ const cur=mk({id:'cur',type:'chk'}); reset([cur, mk({id:'z',type:'chk',customer:'ABC'})]); assert.strictEqual(cpHistoryFor(cur).length,0); });
t('Thời gian kiểm tra: có giờ chỉ khi bản ghi thật sự có createdAt',()=>{
  assert.ok(/\d{2}:\d{2}$/.test(cpWhen({createdAt:NOW})));
  assert.strictEqual(cpWhen({date:'2026-11-09'}),'09/11/2026');   // chỉ ngày → không bịa giờ
  assert.strictEqual(cpWhen({}),'—'); });
console.log(pass+' passed');
process.exit(process.exitCode||0);   // cp-core.js bật bộ hẹn giờ đồng bộ khi nạp → phải thoát chủ động
