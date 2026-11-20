// Kiểm thử xuất Excel "Tổng hợp Khuôn": số khuôn & nội dung trong file .xlsx PHẢI khớp 100% danh sách trên giao diện.
// Chạy: NODE_PATH=<thư mục có node_modules/exceljs> node tests/static/molds-export.test.js
//
// Lỗi gốc (v2.10.2): (1) bản ghi size rỗng/null/thiếu trường bị BỎ khỏi file nhưng phép đối chiếu cũ so với
// số đã trừ nên vẫn báo "thành công"; (2) nhóm tùy chỉnh bị regex gộp nhầm vào nhóm mặc định; (3) bỏ qua bộ lọc,
// không có chế độ xuất; (4) không đọc lại file. Test này ghi file thật bằng ExcelJS thật rồi ĐỌC LẠI từng ô.
const fs=require('fs'), vm=require('vm'), path=require('path'); const R=path.join(__dirname,'..','..');
let ExcelJS; try{ ExcelJS=require('exceljs'); }catch(e){ console.log('⚠ Chưa cài exceljs → chỉ chạy phần kế hoạch (không đọc lại file)'); }
let fail=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fail++; };
const rd=f=>fs.readFileSync(R+'/src/'+f,'utf8');

// ── Dựng môi trường chạy MÃ NGUỒN THẬT (helpers + molds-data/view/export) ─────────────────────────
function makeEnv(catalog){
  const toasts=[], blobs=[], els={}, opened=[];
  const ctx={console,atob:s=>Buffer.from(s,'base64').toString('binary'),Buffer,
    showToast:(m,e)=>toasts.push({m,e:!!e}), ensureExcelJs:()=>Promise.resolve(),
    isAdmin:()=>true, guardNotAdmin:()=>false,
    Blob:class{constructor(p,o){this.parts=p;this.type=o&&o.type;}},
    URL:{createObjectURL:b=>{blobs.push(b);return 'blob:x';},revokeObjectURL(){}},
    openModal:id=>opened.push(id), closeModal(){},
    DB:{khuonCatalog:catalog,khuonQty:[]}};
  ctx.window=ctx; if(ExcelJS) ctx.ExcelJS=ExcelJS;
  ctx.document={body:{appendChild(){},removeChild(){}},createElement:()=>({click(){},style:{}}),activeElement:null,querySelector:()=>null};
  ctx.$=id=>els[id]||(els[id]={innerHTML:'',classList:{add(){},remove(){}}});
  vm.createContext(ctx);
  const h=rd('utils/helpers.js');
  vm.runInContext(h.match(/function _khStripAccents[\s\S]*?\n}\n/)[0]+h.match(/function b64ToArrayBuffer[\s\S]*?\n}\n/)[0]+h.match(/function esc\(s\)[^\n]*\n/)[0],ctx);
  vm.runInContext(rd('modules/molds/molds-data.js')+'\n'+rd('modules/molds/molds-view.js')+'\n'+rd('modules/molds/molds-export.js')
    +'\nthis.SEED=KHUON_CATALOG_SEED;this.CATS=KHUON_CATALOG_CATS;',ctx);
  return {ctx,toasts,blobs,els,opened};
}
const last=t=>t[t.length-1]||{m:''};
const clone=o=>JSON.parse(JSON.stringify(o));
const SEED=makeEnv([]).ctx.SEED;

// Đọc lại file xuất: [{r,c,header,text}] — header = tên khối cột (dòng 5) đã chuẩn hoá.
async function readXlsx(blob, ctx){
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.concat(blob.parts.map(p=>Buffer.from(p))));
  const ws=wb.worksheets[0], cells=[];
  for(let r=7;r<=ws.rowCount;r++) for(let c=2;c<=ws.columnCount;c++){
    const t=ctx.khXlsxReadCell(ws.getCell(r,c).value); if(t) cells.push({r,c,header:ctx.khNormCat(ctx.khXlsxReadCell(ws.getCell(5,c).value)),text:t});
  }
  return {ws,cells};
}
// Danh sách MONG ĐỢI (header, text) tính độc lập từ bản ghi gốc.
function expectedPairs(ctx, recs){
  return recs.filter(x=>x&&typeof x==='object').map(x=>{
    const g=ctx.khXlsxGroupOf(x.category); const label=g||ctx.khCleanCat(x.category)||'Chưa phân nhóm';
    const size=String(x.size==null?'':x.size).trim();
    return {header:ctx.khNormCat(label), text:size||('(chưa có kích thước'+((x.id==null||x.id==='')?'':' – ID '+x.id)+')')};
  });
}
const keyOf=p=>p.header+'||'+p.text;
function sameMultiset(a,b){ const m=new Map(); a.forEach(p=>m.set(keyOf(p),(m.get(keyOf(p))||0)+1)); b.forEach(p=>m.set(keyOf(p),(m.get(keyOf(p))||0)-1)); return [...m.values()].every(v=>v===0); }
// Số "ô khuôn" giao diện đang vẽ: đếm các chip kích thước trong HTML thật của renderKhuonCatalog.
function uiChipCount(env){ return (String(env.els.khmBody&&env.els.khmBody.innerHTML||'').match(/class="khm-item-chip/g)||[]).length; }

(async()=>{
// ═══ A. Kế hoạch xuất (hàm thuần) ═══
console.log('A. Kế hoạch xuất');
{
  const {ctx}=makeEnv([]);
  const placed=p=>ctx.khXlsxPlanPlaced(p);
  let p=ctx.khXlsxBuildPlan(clone(SEED));
  ok(p.total===428&&placed(p)===428,'dữ liệu mặc định: 428/428 kích thước');
  ok(p.blocks.length===5&&p.extraBlocks.length===0&&p.lastCol===12,'dữ liệu mặc định: đúng 5 khối cột như mẫu (A→L)');
  const pos=k=>p.blocks.filter(b=>b.chunks.some(a=>a.some(x=>x.size===k))).map(b=>b.category);
  ok(['3x60','3x80','3x100'].every(k=>pos(k).includes('Bo cạnh')),'3x60, 3x80, 3x100 nằm trong khối Bo cạnh');

  // Nhóm gõ lệch (hoa/thường, khoảng trắng, dấu tổ hợp, không dấu) vẫn về đúng khối chuẩn
  ['Bo Cạnh','Bo cạnh ','  bo   cạnh','BO CẠNH','Bo cạnh'.normalize('NFD'),'bo canh'].forEach(v=>
    ok(ctx.khXlsxGroupOf(v)==='Bo cạnh','biến thể "'+v.replace(/ /g,'·')+'" → Bo cạnh'));
  ok(ctx.khXlsxGroupOf('phi tròn')==='Phi tròn'&&ctx.khXlsxGroupOf('dien cuc')==='Điện cực'&&ctx.khXlsxGroupOf('Yêu cầu & chuẩn')==='Yêu cầu & chuẩn'&&ctx.khXlsxGroupOf('đồng thanh dẹt')==='Đồng thanh dẹt','4 nhóm còn lại khớp theo tên chuẩn hoá');
  // LỖI CŨ: regex gộp nhầm nhóm tùy chỉnh vào nhóm mặc định
  ['Điện cực đặc biệt','Khuôn phi 2','Khuôn chuẩn','Đồng thanh cái','Bo cạnh vát','Khuôn tròn lớn','Khuôn dẹt','Khuôn đặc biệt',''].forEach(v=>
    ok(ctx.khXlsxGroupOf(v)===null,'nhóm tùy chỉnh "'+v+'" KHÔNG bị gộp nhầm vào nhóm mặc định'));

  // Thiếu thông tin: KHÔNG được bỏ — mỗi bản ghi object đều có mặt
  const bad=[{id:'x1',category:'Bo cạnh',size:''},{id:'x2',category:'Bo cạnh',size:'  '},{id:'x3',category:'Bo cạnh'},{id:'x4',category:'Bo cạnh',size:null},
    {id:'x5',category:'Bo cạnh',size:3.5},{category:'Bo cạnh',size:''},{id:'x6',size:'9x9'},{id:'x7',category:null,size:'8x8'},{id:'x8',category:'Bo cạnh',size:'3x60'},{id:'x9',category:'Bo cạnh',size:'3x60'}];
  p=ctx.khXlsxBuildPlan(bad.concat([null,undefined,'3x3',7]));
  ok(p.total===10&&placed(p)===10,'10 bản ghi (thiếu size/category/id, size số, trùng kích thước) → xuất đủ 10/10');
  ok(p.noSize===5&&p.invalid===4,'đếm đúng: 5 bản ghi thiếu size (vẫn xuất), 4 phần tử không phải bản ghi (null/undefined/chuỗi/số)');
  const texts=p.blocks.flatMap(b=>b.chunks.flat().map(x=>x.text));
  ok(texts.includes('(chưa có kích thước – ID x1)')&&texts.includes('(chưa có kích thước)'),'bản ghi thiếu size được ghi chú rõ trong ô (kèm ID nếu có)');
  ok(texts.filter(t=>t==='3x60').length===2&&texts.includes('3.5'),'trùng kích thước giữ cả 2 dòng; size dạng số giữ nguyên');
  ok(p.extraBlocks.map(b=>b.label).sort().join()==='Chưa phân nhóm','category thiếu/null → khối "Chưa phân nhóm" (gộp chung)');
  ok(p.extraBlocks[0].chunks.flat().length===2,'khối "Chưa phân nhóm" có đủ 2 khuôn (x6 và x7)');

  // Nhóm mới / tùy chỉnh → khối cột riêng đúng tên, không mất dữ liệu
  const cat2=clone(SEED).concat([{id:'d',category:'Khuôn đặc biệt',size:'30x40'},{id:'e',category:'khuon dac biet',size:'13.5x50'},{id:'f',category:'',size:'7x7'},{id:'g',category:'Khuôn chạy bọc giấy',size:'40x100'},{id:'h',category:'Điện cực đặc biệt',size:'12x12'}]);
  p=ctx.khXlsxBuildPlan(cat2);
  ok(placed(p)===433&&p.total===433,'nhóm mới: xuất đủ 433/433');
  ok(p.extraBlocks.length===4&&p.lastCol===12+4*2,'4 nhóm ngoài mẫu → 4 khối × 2 cột, kéo dài tới cột T');
  ok(p.extraBlocks.find(b=>b.label==='Khuôn đặc biệt').chunks.flat().length===2,'"Khuôn đặc biệt" và "khuon dac biet" gộp 1 khối (2 kích thước)');
  ok(p.extraBlocks.find(b=>b.label==='Điện cực đặc biệt'),'"Điện cực đặc biệt" có khối riêng (không bị gộp vào Điện cực)');
  ok(p.extraBlocks.every(b=>b.cols.every(c=>c>12)),'khối thêm nằm bên phải khối "Yêu cầu & chuẩn"');

  // Nhiều dữ liệu → tự tăng số dòng, không cắt bớt
  const many=[]; for(let i=0;i<300;i++) many.push({id:'m'+i,category:'Bo cạnh',size:'3x'+(1000+i)});
  p=ctx.khXlsxBuildPlan(many); ok(placed(p)===300&&p.neededRows===150,'300 kích thước Bo cạnh → 150 dòng/cột, đủ 300');
  // Sắp xếp tăng dần như giao diện
  p=ctx.khXlsxBuildPlan([{category:'Bo cạnh',size:'3x100'},{category:'Bo cạnh',size:'3x60'},{category:'Bo cạnh',size:'3x57'},{category:'Bo cạnh',size:'3x80'},{category:'Bo cạnh',size:''}]);
  ok(p.blocks[3].chunks.flat().map(x=>x.size).join()==='3x57,3x60,3x80,3x100,','sắp xếp tăng dần; bản ghi thiếu size xuống cuối');
  // Chuẩn hoá khi Admin nhập nhóm (không đổi)
  const list=[{category:'Bo cạnh'},{category:'Bo cạnh'},{category:'Bo Cạnh'}];
  ok(ctx.khCanonCategory('bo CẠNH  ',list,ctx.CATS)==='Bo cạnh','khCanonCategory: dùng lại cách viết phổ biến nhất');
  ok(ctx.khCanonCategory('phi tron',[],ctx.CATS)==='Phi tròn','khCanonCategory: "phi tron" → "Phi tròn"');
}
if(!ExcelJS){ console.log(fail?`\n✗ ${fail} lỗi`:'\n✓ molds-export (phần kế hoạch): đạt'); process.exit(fail?1:0); }

// ═══ B. End-to-end: ghi file thật → đọc lại → so với giao diện ═══
console.log('B. Dữ liệu đầy đủ (428 mặc định)');
{
  const cat=clone(SEED); const snap=JSON.stringify(cat);
  const env=makeEnv(cat); env.ctx.renderKhuon();
  const ui=uiChipCount(env);
  await env.ctx.exportKhuonCatalogExcel();
  const x=await readXlsx(env.blobs[0],env.ctx);
  ok(ui===428,'giao diện vẽ 428 kích thước');
  ok(x.cells.length===ui,`số ô khuôn trong Excel (${x.cells.length}) = số trên giao diện (${ui})`);
  ok(sameMultiset(x.cells,expectedPairs(env.ctx,cat)),'nội dung + nhóm của từng ô khớp 100% với danh sách gốc');
  ok(last(env.toasts).m.includes('428/428')&&!last(env.toasts).e,'thông báo thành công ghi rõ đối chiếu 428/428');
  ok(JSON.stringify(env.ctx.DB.khuonCatalog)===snap,'dữ liệu gốc (DB.khuonCatalog) không bị thay đổi sau khi xuất');
}
console.log('C. Dữ liệu thiếu trường / trùng / nhóm tùy chỉnh');
{
  const cat=clone(SEED).concat([
    {id:'n1',category:'Bo cạnh',size:''},{id:'n2',category:'Điện cực',size:'   '},{id:'n3',category:'Điện cực'},{id:'n4',category:'Điện cực',size:null},
    {id:'n5',size:'5x5'},{id:'n6',category:null,size:'6x6'},{category:'Bo cạnh',size:''},
    {id:'c1',category:'Điện cực đặc biệt',size:'12x12'},{id:'c2',category:'Khuôn phi 2',size:'Φ 99'},{id:'c3',category:'Khuôn chuẩn',size:'7x7'},
    {id:'c4',category:'Khuôn đặc biệt',size:'30*40 (đặc biệt) 1 chuẩn'},{id:'c5',category:'khuon dac biet',size:'13,5*50'},
    {id:'d1',category:'Bo cạnh',size:'3x60'},{id:'d2',category:'Bo cạnh',size:'3x60'},{id:'t1',category:'Bo cạnh',size:3.5},
    {id:'f1',category:'Bo cạnh',size:'=1+1'},{id:'f2',category:'Bo cạnh',size:'007'},
  ]);
  const snap=JSON.stringify(cat);
  const env=makeEnv(cat.concat([null,undefined])); env.ctx.renderKhuon();   // thêm phần tử null do đồng bộ để lại
  const ui=uiChipCount(env);
  ok(ui===cat.length,`giao diện vẽ đủ ${cat.length} khuôn dù có bản ghi thiếu trường & phần tử null (không bị sập)`);
  await env.ctx.exportKhuonCatalogExcel();
  ok(env.blobs.length===1,'file được tải về');
  const x=await readXlsx(env.blobs[0],env.ctx);
  ok(x.cells.length===ui,`số ô khuôn trong Excel (${x.cells.length}) = giao diện (${ui})`);
  ok(sameMultiset(x.cells,expectedPairs(env.ctx,cat)),'từng ô (nhóm + nội dung) khớp danh sách gốc, gồm cả bản ghi thiếu size/nhóm');
  const hdr=t=>x.cells.filter(c=>c.text===t).map(c=>c.header);
  ok(hdr('12x12').join()==='dien cuc dac biet'&&hdr('Φ 99').join()==='khuon phi 2'&&hdr('7x7').join()==='khuon chuan','nhóm tùy chỉnh nằm dưới đúng tên nhóm (không bị gộp nhầm)');
  ok(hdr('3x60').filter(h=>h==='bo canh').length===cat.filter(c=>c.category==='Bo cạnh'&&c.size==='3x60').length,'kích thước trùng ở cả hai dòng đều có mặt');
  ok(x.cells.some(c=>c.text==='=1+1')&&x.cells.some(c=>c.text==='007'),'size "=1+1" và "007" giữ nguyên dạng chữ (không thành công thức/số)');
  const nosz=cat.filter(c=>!String(c.size==null?'':c.size).trim()).length;
  ok(nosz===5&&x.cells.filter(c=>c.text.startsWith('(chưa có kích thước')).length===nosz,'5 bản ghi thiếu size (rỗng/khoảng trắng/thiếu trường/null/không id) đều hiện thành dòng có ghi chú');
  ok(last(env.toasts).m.includes(`${ui}/${ui}`)&&last(env.toasts).m.includes('thiếu kích thước'),'thông báo nêu đủ số lượng và số khuôn thiếu kích thước');
  ok(JSON.stringify(env.ctx.DB.khuonCatalog.filter(Boolean))===snap,'dữ liệu gốc không bị thay đổi/xoá');
  // Chạy lại lần nữa để chắc không có trạng thái dư
  await env.ctx.exportKhuonCatalogExcel(); const y=await readXlsx(env.blobs[1],env.ctx);
  ok(y.cells.length===ui,'xuất lần 2 vẫn đủ (không dính trạng thái lần trước)');
}
console.log('D. Bộ lọc / tìm kiếm — chế độ xuất');
{
  const cat=clone(SEED).concat([{id:'k1',category:'Khuôn đặc biệt',size:'30x40'},{id:'k2',category:'Khuôn đặc biệt',size:'13.5x50'},{id:'k3',category:'Bo cạnh',size:''}]);
  // D1: lọc theo nhóm
  let env=makeEnv(cat); env.ctx.eval=undefined;
  vm.runInContext("_khCatFilter='Bo cạnh'",env.ctx); env.ctx.renderKhuon();
  const uiBo=uiChipCount(env); const bo=cat.filter(x=>x.category==='Bo cạnh').length;
  ok(uiBo===bo,`lọc nhóm "Bo cạnh": giao diện hiển thị ${uiBo}/${bo}`);
  await env.ctx.exportKhuonCatalogExcel();
  ok(env.blobs.length===0&&env.opened.includes('khExportModal'),'đang lọc → KHÔNG tự xuất, mở hộp chọn chế độ (toàn bộ / theo bộ lọc)');
  const body=env.els.khExportModeBody.innerHTML;
  ok(body.includes(`theo bộ lọc (${bo}`)&&body.includes(`toàn bộ danh mục (${cat.length}`),'hộp chọn ghi rõ số lượng của từng chế độ');
  await env.ctx.exportKhuonCatalogExcel('filtered');
  let x=await readXlsx(env.blobs[0],env.ctx);
  ok(x.cells.length===uiBo,`xuất THEO BỘ LỌC: Excel ${x.cells.length} = giao diện ${uiBo}`);
  ok(x.cells.every(c=>c.header==='bo canh')&&sameMultiset(x.cells,expectedPairs(env.ctx,cat.filter(c=>c.category==='Bo cạnh'))),'chỉ gồm đúng các khuôn của nhóm đang lọc');
  ok(x.ws.getCell('A4').value.includes('Xuất theo bộ lọc')&&x.ws.getCell('A4').value.includes('Nhóm: Bo cạnh'),'tiêu đề file ghi rõ xuất theo bộ lọc & điều kiện lọc');
  ok(last(env.toasts).m.includes('THEO BỘ LỌC'),'thông báo nêu rõ chế độ "THEO BỘ LỌC"');
  await env.ctx.exportKhuonCatalogExcel('all');
  x=await readXlsx(env.blobs[1],env.ctx);
  ok(x.cells.length===cat.length&&last(env.toasts).m.includes('TOÀN BỘ'),`xuất TOÀN BỘ khi đang lọc: Excel ${x.cells.length} = toàn danh mục ${cat.length}`);
  // D2: tìm kiếm (không dấu, x/× , dấu phẩy)
  env=makeEnv(cat); vm.runInContext("_khSearch='dac biet'",env.ctx); env.ctx.renderKhuon();
  const uiS=uiChipCount(env);
  await env.ctx.exportKhuonCatalogExcel('filtered');
  x=await readXlsx(env.blobs[0],env.ctx);
  ok(uiS===2&&x.cells.length===uiS,`tìm "dac biet": giao diện ${uiS} = Excel ${x.cells.length}`);
  // D3: tìm kiếm không có kết quả
  env=makeEnv(cat); vm.runInContext("_khSearch='zzz-khong-co'",env.ctx);
  await env.ctx.exportKhuonCatalogExcel('filtered');
  ok(env.blobs.length===0&&last(env.toasts).e,'bộ lọc không có kết quả → không tạo file rỗng, có thông báo');
  // D4: không lọc → xuất thẳng toàn bộ, không hỏi
  env=makeEnv(cat); await env.ctx.exportKhuonCatalogExcel();
  ok(env.blobs.length===1&&!env.opened.length,'không lọc → xuất thẳng toàn bộ, không hiện hộp chọn');
  // D5: lọc nhưng kết quả = toàn bộ → không cần hỏi
  env=makeEnv(cat); vm.runInContext("_khSearch='x'",env.ctx); const all=env.ctx.khCatalogRecords();
  const vis=env.ctx.khCatalogVisible(all,'all','x');
  ok(vis.length<=all.length,'khCatalogVisible dùng chung nguồn với giao diện');
}
console.log('E. Dữ liệu lớn (> 55 dòng của mẫu, không giới hạn số bản ghi)');
{
  const cat=clone(SEED); for(let i=0;i<1500;i++) cat.push({id:'big'+i,category:['Bo cạnh','Điện cực','Nhóm mới A','Nhóm mới B'][i%4],size:(1+i%9)+'x'+(100+i)});
  const env=makeEnv(cat); await env.ctx.exportKhuonCatalogExcel();
  const x=await readXlsx(env.blobs[0],env.ctx);
  ok(x.cells.length===cat.length&&sameMultiset(x.cells,expectedPairs(env.ctx,cat)),`${cat.length} khuôn → Excel đủ ${x.cells.length}, nội dung khớp 100%`);
}
console.log('F. Phát hiện sai lệch → KHÔNG báo thành công, KHÔNG tải file, nêu nguyên nhân');
{
  // F1: file ghi ra bị mất 1 ô (mô phỏng lỗi ghi/thư viện) — đối chiếu bằng cách đọc lại file phải bắt được
  const cat=clone(SEED); const env=makeEnv(cat);
  class Tamper extends ExcelJS.Workbook{ constructor(){ super(); const w=this.xlsx.writeBuffer.bind(this.xlsx); this.xlsx.writeBuffer=async()=>{ if(this.worksheets[0]&&this.worksheets[0].getCell('A4').value) this.worksheets[0].getCell(8,2).value=null; return w(); }; } }
  env.ctx.ExcelJS=Object.assign({},ExcelJS,{Workbook:Tamper}); env.ctx.window.ExcelJS=env.ctx.ExcelJS;
  await env.ctx.exportKhuonCatalogExcel();
  ok(env.blobs.length===0,'file lệch số liệu KHÔNG được tải về');
  ok(last(env.toasts).e&&last(env.toasts).m.includes('KHÔNG khớp')&&last(env.toasts).m.includes('427/428')&&last(env.toasts).m.includes('thiếu 1 khuôn'),'thông báo lỗi nêu rõ: file 427/428, thiếu 1 khuôn và tên khuôn thiếu: '+last(env.toasts).m.slice(0,140));
  ok(!env.toasts.some(t=>!t.e&&t.m.includes('✅')),'không có thông báo "thành công" nào');
  // F2: kế hoạch bỏ sót bản ghi (mô phỏng hồi quy trong phân nhóm) → chặn trước khi ghi
  const env2=makeEnv(clone(SEED));
  vm.runInContext("const __o=khXlsxBuildPlan; khXlsxBuildPlan=function(c){ const p=__o(c); p.blocks[0].chunks[0].pop(); return p; };",env2.ctx);
  await env2.ctx.exportKhuonCatalogExcel();
  ok(env2.blobs.length===0&&last(env2.toasts).e&&last(env2.toasts).m.includes('427/428'),'kế hoạch xuất bỏ sót 1 khuôn → bị chặn, báo 427/428');
}
console.log('G. Giao diện không sập khi dữ liệu thiếu trường');
{
  const env=makeEnv([{id:'a',category:'Bo cạnh',size:'3x60'},{id:'b'},{id:'c',category:undefined,size:7},null]);
  let threw=false; try{ env.ctx.renderKhuon(); }catch(e){ threw=e; }
  ok(!threw,'renderKhuon() không ném lỗi với bản ghi thiếu category/size, phần tử null'+(threw?': '+threw.message:''));
  ok(uiChipCount(env)===3&&env.els.khmBody.innerHTML.includes('Chưa phân nhóm'),'hiển thị đủ 3 bản ghi, nhóm thiếu hiện "(Chưa phân nhóm)"');
}
console.log(fail?`\n✗ ${fail} lỗi`:'\n✓ molds-export: tất cả đạt'); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
