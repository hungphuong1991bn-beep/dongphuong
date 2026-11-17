// Kiểm thử xuất Excel "Tổng hợp Khuôn": KHÔNG được bỏ sót chủng loại nào. Chạy: node tests/static/molds-export.test.js
// Lỗi gốc: hàm xuất lọc cứng `x.category === 'Bo cạnh'`… nên nhóm gõ lệch tên (hoa/thường, thừa dấu cách,
// dấu tổ hợp) hoặc nhóm mới (vd "Khuôn đặc biệt") biến mất khỏi file Excel dù vẫn hiện đủ trên màn hình.
const fs=require('fs'), vm=require('vm'), path=require('path'); const R=path.join(__dirname,'..','..');
let fail=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fail++; };
const rd=f=>fs.readFileSync(R+'/src/'+f,'utf8');
const ctx={console}; vm.createContext(ctx);
const h=rd('utils/helpers.js');
vm.runInContext(h.match(/function _khStripAccents[\s\S]*?\n}\n/)[0],ctx);
vm.runInContext(rd('modules/molds/molds-data.js')+'\n'+rd('modules/molds/molds-view.js')+'\n'+rd('modules/molds/molds-export.js')
  +'\nthis.SEED=KHUON_CATALOG_SEED;this.CATS=KHUON_CATALOG_CATS;',ctx);
const plan=c=>ctx.khXlsxBuildPlan(c);
const placed=p=>p.blocks.reduce((s,b)=>s+b.chunks.reduce((t,a)=>t+a.length,0),0);

// 1) Dữ liệu mặc định: đủ 428/428, đúng 5 khối, không có khối thừa
let p=plan(ctx.SEED.map(x=>({...x})));
ok(p.total===428&&placed(p)===428,'dữ liệu mặc định: xuất đủ 428/428 kích thước');
ok(p.blocks.length===5&&p.extraBlocks.length===0&&p.lastCol===12,'dữ liệu mặc định: đúng 5 khối cột như mẫu (A→L)');
const pos=k=>p.blocks.filter(b=>b.chunks.some(a=>a.some(x=>x.size===k))).map(b=>b.category);
ok(['3x60','3x80','3x100'].every(k=>pos(k).includes('Bo cạnh')),'3x60, 3x80, 3x100 nằm trong khối Bo cạnh');

// 2) Nhóm gõ lệch tên vẫn được xếp đúng khối chuẩn
const variants=['Bo Cạnh','Bo cạnh ','  bo   cạnh','BO CẠNH','Bo cạnh'.normalize('NFD'),'bo canh'];
variants.forEach((v,i)=>{ ctx.__v=v; ok(ctx.khXlsxGroupOf(v)==='Bo cạnh','biến thể "'+v.replace(/ /g,'·')+'" → Bo cạnh'); });
ok(ctx.khXlsxGroupOf('Đồng thanh cái')==='Đồng thanh dẹt'&&ctx.khXlsxGroupOf('phi tròn')==='Phi tròn'&&ctx.khXlsxGroupOf('dien cuc')==='Điện cực'&&ctx.khXlsxGroupOf('Yêu cầu & chuẩn')==='Yêu cầu & chuẩn','nhận đúng các tên gần giống của 4 nhóm còn lại');
ok(ctx.khXlsxGroupOf('Khuôn đặc biệt')===null&&ctx.khXlsxGroupOf('')===null,'nhóm lạ/rỗng không bị ép vào nhóm chuẩn');
const cat=ctx.SEED.map(x=>({...x}));
cat.push({id:'a',category:'Bo cạnh',size:'3x57'},{id:'b',category:'Bo Cạnh',size:'3x70'},{id:'c',category:'Bo cạnh ',size:'3x75'});
p=plan(cat);
ok(placed(p)===p.total&&p.total===431&&p.extraBlocks.length===0,'3 kích thước nhóm lệch tên (gồm 3x57) đều có mặt, không sinh khối thừa');
ok(pos('3x57').join()==='Bo cạnh','3x57 nằm trong khối Bo cạnh');

// 3) Nhóm mới / không nhóm → khối cột riêng bên phải, không mất dữ liệu
const cat2=ctx.SEED.map(x=>({...x}));
cat2.push({id:'d',category:'Khuôn đặc biệt',size:'30x40'},{id:'e',category:'khuon dac biet',size:'13.5x50'},{id:'f',category:'',size:'7x7'},{id:'g',category:'Khuôn chạy bọc giấy',size:'40x100'});
p=plan(cat2);
ok(placed(p)===p.total&&p.total===432,'nhóm mới: xuất đủ 432/432');
ok(p.extraBlocks.length===3&&p.lastCol===12+3*2,'3 nhóm ngoài mẫu → 3 khối × 2 cột, kéo dài tới cột R');
ok(p.extraBlocks.find(b=>b.label==='Khuôn đặc biệt').chunks.flat().length===2,'"Khuôn đặc biệt" và "khuon dac biet" gộp chung 1 khối (2 kích thước)');
ok(p.extraBlocks.every(b=>b.cols.every(c=>c>12)),'khối thêm nằm bên phải khối "Yêu cầu & chuẩn", không đè lên khối của mẫu');

// 4) Bản ghi lỗi: không có kích thước → bỏ qua có đếm; null không làm sập
p=plan([{id:'x',category:'Bo cạnh',size:'  '},null,{id:'y',category:'Bo cạnh',size:'3x57'}]);
ok(p.total===1&&p.skipped===1&&placed(p)===1,'bản ghi rỗng/null được bỏ qua, phần còn lại vẫn xuất');

// 5) Nhiều dữ liệu → tự tăng số dòng, không cắt bớt
const many=[]; for(let i=0;i<300;i++) many.push({id:'m'+i,category:'Bo cạnh',size:'3x'+(1000+i)});
p=plan(many); ok(placed(p)===300&&p.neededRows===150,'300 kích thước Bo cạnh → 150 dòng/cột, đủ 300');

// 6) Sắp xếp tăng dần giữ nguyên như giao diện
p=plan([{category:'Bo cạnh',size:'3x100'},{category:'Bo cạnh',size:'3x60'},{category:'Bo cạnh',size:'3x57'},{category:'Bo cạnh',size:'3x80'}]);
ok(p.blocks[3].chunks.flat().map(x=>x.size).join()==='3x57,3x60,3x80,3x100','sắp xếp kích thước tăng dần (3x57,3x60,3x80,3x100)');

// 7) Chuẩn hoá khi Admin nhập nhóm
const list=[{category:'Bo cạnh'},{category:'Bo cạnh'},{category:'Bo Cạnh'}];
ok(ctx.khCanonCategory('bo CẠNH  ',list,ctx.CATS)==='Bo cạnh','gõ "bo CẠNH  " → dùng lại cách viết đang có nhiều nhất "Bo cạnh"');
ok(ctx.khCanonCategory('Khuôn mới',list,ctx.CATS)==='Khuôn mới'&&ctx.khCanonCategory('  Khuôn   mới ',[],[])==='Khuôn mới','nhóm mới được giữ nguyên (chỉ làm gọn khoảng trắng)');
ok(ctx.khCanonCategory('phi tron',[],ctx.CATS)==='Phi tròn','gõ không dấu "phi tron" → tự về nhóm mặc định "Phi tròn"');
ok(ctx.khCanonCategory('Phi Tròn',[],ctx.CATS)==='Phi tròn','khớp nhóm mặc định dù danh mục đang trống');

console.log(fail?`\n✗ ${fail} lỗi`:'\n✓ molds-export: tất cả đạt'); process.exit(fail?1:0);
