// KIỂM THỬ GIAO DIỆN CHẤM CÔNG (GĐ1) — mã THẬT (core/service/view/bulk/export/schedule) + DOM jsdom.
// Chạy: NODE_PATH=tests/node_modules node tests/static/attendance-view.test.js
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path'),{JSDOM}=require('jsdom');
const root=path.join(__dirname,'../..'); const rd=f=>fs.readFileSync(path.join(root,f),'utf8');
let n=0; const ok=m=>console.log('✓',m,++n);

function setup(user,workers,att,extra={}){
  const dom=new JSDOM('<body><div id="mc"></div><div id="toast"></div></body>',{url:'http://localhost/'});
  const document=dom.window.document, store=new Map(), toasts=[], printed=[], csv=[], confirms=[];
  const ctx={console,Date,Object,Math,JSON,parseInt,parseFloat,String,Number,Array,Set,Promise,isNaN,document,
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}, sessionStorage:{getItem:()=>null,setItem(){}},
    navigator:{onLine:true}, window:{addEventListener(){},open:()=>({document:{open(){},write:h=>printed.push(h),close(){}},focus(){},print(){}})}, setTimeout:(f)=>0, clearTimeout(){}, setInterval:()=>0,
    DB:{attendance:att||{},attMeta:extra.meta||{},workers:workers,nghiPhep:extra.nghiPhep||[],lichLamViec:extra.llv||[],kyLuat:[]}, currentUser:user, currentTab:'chamCong',
    showToast:(m,e)=>toasts.push({m,e}), log(){}, lsSave(){}, fbOk:()=>true, fbRead:async()=>null, fbWrite:async()=>({}), setSyncDot(){}, scheduleUIRefresh(){}, goTab(){}, renderNhanSu(){},
    openModal:id=>document.getElementById(id).classList.add('open'), closeModal:id=>document.getElementById(id).classList.remove('open'), confirm2:(t,b,cb)=>confirms.push({t,b,cb}),
    csvDownload:(f,rows)=>csv.push({f,rows}), uid:()=>'x'+Math.random().toString(36).slice(2,6), captureAndShareElement(){}, openCcllvQrModal(){}, loadSheetJs(){} };
  ctx.setInterval=()=>0; ctx.setTimeout=()=>0; ctx.clearTimeout=()=>{}; ctx.$=id=>document.getElementById(id);
  ctx.window.open=()=>({document:{open(){},write:h=>printed.push(h),close(){}},focus(){},print(){}});
  vm.createContext(ctx); const run=c=>vm.runInContext(c,ctx);
  ['src/core/permissions.js','src/utils/date.js'].forEach(f=>run(rd(f)));
  run(`todayStr=function(d){ if(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); } return '2026-11-13'; }`);
  ['src/modules/attendance/attendance-core.js','src/modules/attendance/attendance-service.js','src/modules/attendance/attendance-view.js','src/modules/attendance/attendance-schedule.js','src/modules/attendance/attendance-bulk.js','src/modules/attendance/attendance-export.js'].forEach(f=>run(rd(f)));
  run(`_attYM='2026-11'`);
  return {ctx,run,document,toasts,printed,csv,confirms};
}
const W=[{id:'w1',name:'An',maNV:'NV001',boPhan:'Lò',chucVu:'Công nhân',trangThai:'Đang làm',ngayVaoLam:'2026-01-01'},
         {id:'w2',name:'Bình <b>',maNV:'NV002',boPhan:'Kéo',chucVu:'Tổ trưởng',trangThai:'Đang làm',ngayVaoLam:'2026-01-01'},
         {id:'w3',name:'Cường',maNV:'NV003',boPhan:'Lò',chucVu:'Công nhân',trangThai:'Đã nghỉ việc',ngayVaoLam:'2025-01-01'}];
const ATT={'2026-11':{w1:{2:'1',3:'1',4:'1',5:'1',6:'1',9:'1.2'},w2:{2:'0'}},'2026-10':{w3:{5:'1'}}};
const ADMIN={id:'u1',name:'Admin',role:'admin'}, STAFF={id:'u2',name:'NV',role:'staff'}, VIEW={id:'u3',name:'Xem',role:'viewer'};
const txt=(d,id)=>d.getElementById(id).textContent.replace(/\s+/g,' ');

(async()=>{
{ const t=setup(ADMIN,JSON.parse(JSON.stringify(W)),JSON.parse(JSON.stringify(ATT))); t.run('renderChamCong()'); const d=t.document;
  assert(d.getElementById('attTable'),'có bảng'); assert.strictEqual(d.querySelectorAll('#attTable tbody tr').length,2,'Cường (đã nghỉ việc, không có công tháng 11) bị ẩn');
  ok('Render bảng; người đã nghỉ việc không có công trong tháng được ẩn');
  const dash=txt(d,'attDash'); assert(/Tổng nhân viên/.test(dash)&&/Thiếu dữ liệu/.test(dash)&&/Hoàn thành chấm công/.test(dash)&&/Giờ tăng ca/.test(dash)&&/Ngày nghỉ/.test(dash)&&/Tổng công tháng/.test(dash)&&/Chưa có dữ liệu/.test(dash)&&/Đã có dữ liệu/.test(dash));
  assert(/31\.8%/.test(dash),'tỷ lệ hoàn thành 31.8% ('+dash+')'); assert.strictEqual(d.querySelector('.att2-card.bad .att2-card-v').textContent.trim(),'15'); assert(/ô cần bổ sung/.test(dash)); ok('Dashboard đủ 8 chỉ số; số liệu tính từ dữ liệu thật (thiếu 15 ô, hoàn thành 31.8%)');
  assert.strictEqual(d.querySelectorAll('.att2-dh.is-sun').length,5,'5 Chủ nhật trong tháng 11/2026'); ok('Phân biệt Chủ nhật trên tiêu đề ngày');
  assert(d.querySelector('.att2-c-name')&&d.querySelector('.att2-table thead th')); const css=fs.readFileSync(path.join(root,'src/styles/attendance.css'),'utf8');
  assert(/\.att2-table thead th\{position:sticky;top:0/.test(css)&&/\.att2-c-name\{position:sticky;left:34px/.test(css)&&/\.att2-scroll\{overflow:auto;max-height/.test(css)); ok('CSS: cố định tiêu đề ngày (cuộn dọc) và cột tên (cuộn ngang)');
  assert(!/<b>/.test(d.querySelector('#attTable tbody').innerHTML.replace(/<\/?(tr|td|span|em|input)[^>]*>/g,'')) || d.querySelector('.att2-c-name[title="Bình <b>"]'),''); assert(!d.querySelector('#attTable b')); ok('Tên chứa HTML được escape (không chèn thẻ vào bảng)');
  // sửa ô hợp lệ / sai
  const cell=d.getElementById('cell_w1_10'); cell.value='abc'; t.run(`attCellChange(document.getElementById('cell_w1_10'))`); assert.strictEqual(cell.value,''); assert(t.toasts.some(x=>x.e&&/sai định dạng/.test(x.m))); assert.strictEqual(t.run('attPendingCount()'),0); ok('Nhập sai định dạng: báo lỗi, trả ô về giá trị cũ, không ghi gì');
  cell.value='1'; t.run(`attCellChange(document.getElementById('cell_w1_10'))`); assert.strictEqual(t.run('attPendingCount()'),1); assert.strictEqual(cell.dataset.v,'1'); assert(/k-full/.test(cell.className)); assert(/7(\.\d)?/.test(txt(d,'wkTotal_w1'))); ok('Nhập hợp lệ: vào hàng đợi, tô màu ô, cập nhật tổng công ngay (không vẽ lại bảng)');
  cell.value='1.9'; t.run(`attCellChange(document.getElementById('cell_w1_10'))`); assert(/is-warn/.test(cell.className)); ok('Giờ tăng ca 9h/ngày: nhận nhưng đánh dấu cảnh báo bất thường');
  // bộ lọc
  const search=d.getElementById('attSearch'); t.run(`attSetFilter('q','bình')`); assert.strictEqual(d.querySelectorAll('#attTable tbody tr').length,1); assert.strictEqual(d.getElementById('attSearch'),search,'ô tìm kiếm không bị tạo lại'); assert(/Tổng nhân viên/.test(txt(d,'attDash')));
  t.run(`attSetFilter('q','')`); t.run(`attSetFilter('dept','Lò')`); assert.strictEqual(d.querySelectorAll('#attTable tbody tr').length,1); t.run(`attSetFilter('dept','all')`);
  t.run(`attSetFilter('status','Đã nghỉ việc')`); assert.strictEqual(d.querySelectorAll('#attTable tbody tr').length,1); t.run(`attSetFilter('status','all')`);
  t.run(`attSetFilter('q','zzz')`); assert(d.querySelector('.att2-empty')); assert(/Không có nhân viên phù hợp/.test(d.querySelector('.att2-empty').textContent)); t.run(`attSetFilter('q','')`); ok('Bộ lọc tên/mã · bộ phận · trạng thái; không có kết quả → Empty State; không mất ô tìm kiếm');
  // không vẽ lại khi đang gõ dở
  const c2=d.getElementById('cell_w2_5'); c2.focus(); c2.value='0.5'; const before=d.getElementById('attTable'); t.run('renderChamCong()'); assert.strictEqual(d.getElementById('attTable'),before,'giữ nguyên DOM'); assert.strictEqual(c2.value,'0.5'); assert.strictEqual(t.run('_attRenderPending'),true); ok('Cập nhật realtime KHÔNG làm mất ô đang gõ dở (hoãn vẽ lại)');
  c2.value=''; c2.blur(); t.run('renderChamCong()'); assert.notStrictEqual(d.getElementById('attTable'),before); }

// khoá kỳ → chỉ xem
{ const t=setup(STAFF,JSON.parse(JSON.stringify(W)),JSON.parse(JSON.stringify(ATT)),{meta:{months:{'2026-11':{lock:{by:'Admin',at:Date.now()}}}}}); t.run('renderChamCong()'); const d=t.document;
  assert(d.querySelector('.att2-lock')); assert(/chỉ Admin được mở khoá/.test(d.querySelector('.att2-lock').textContent)); assert(!d.querySelector('.att2-lock button')); assert(d.querySelectorAll('#attTable .att2-cell:not([readonly])').length===0);
  const c=d.getElementById('cell_w1_12'); c.value='1'; t.run(`attCellChange(document.getElementById('cell_w1_12'))`); assert.strictEqual(c.value,''); assert(t.toasts.some(x=>/đã chốt/.test(x.m))); assert.strictEqual(t.run('attPendingCount()'),0);
  assert(!/Chốt kỳ|Chấm hàng loạt/.test(d.querySelector('.att2-tools').textContent)); ok('Kỳ đã chốt: banner, mọi ô readonly, ẩn nút sửa; nhân viên không thấy nút Mở khoá; sửa bằng code vẫn bị chặn');
  const a=setup(ADMIN,JSON.parse(JSON.stringify(W)),JSON.parse(JSON.stringify(ATT)),{meta:{months:{'2026-11':{lock:{by:'Admin',at:Date.now()}}}}}); a.run('renderChamCong()'); assert(/Mở khoá kỳ/.test(a.document.querySelector('.att2-lock').textContent)); ok('Admin thấy nút Mở khoá kỳ'); }

// Viewer
{ const t=setup(VIEW,JSON.parse(JSON.stringify(W)),JSON.parse(JSON.stringify(ATT))); t.run('renderChamCong()'); const d=t.document;
  assert.strictEqual(d.querySelectorAll('#attTable .att2-cell:not([readonly])').length,0); const tools=d.querySelector('.att2-tools').textContent; assert(!/Lưu &|Lưu & đồng bộ|hàng loạt|Chốt kỳ|Thêm nhân viên|Ngày lễ/.test(tools)); assert(/Tài khoản Xem không xuất/.test(tools));
  const c=d.getElementById('cell_w1_12'); c.value='1'; t.run(`attCellChange(document.getElementById('cell_w1_12'))`); assert.strictEqual(t.run('attPendingCount()'),0); ok('Viewer: ô readonly, ẩn nút sửa/xuất, và bị chặn ở tầng xử lý'); }

// Empty state
{ const t=setup(ADMIN,[],{}); t.run('renderChamCong()'); assert(/Chưa có hồ sơ nhân viên/.test(t.document.querySelector('.att2-empty').textContent)); ok('Chưa có nhân viên → Empty State hướng dẫn sang Quản lý nhân sự'); }

// Bộ lọc ca theo Lịch làm việc
{ const llv=[{id:'s1',name:'Lò',rows:[{name:'An',time:'Ca 1 : 6h – 14h'},{name:'bình <b>',time:'Ca 2 : 14h – 22h'}]}]; const t=setup(ADMIN,JSON.parse(JSON.stringify(W)),JSON.parse(JSON.stringify(ATT)),{llv}); t.run('renderChamCong()'); t.run(`attSetFilter('shift','ca2')`);
  const rows=t.document.querySelectorAll('#attTable tbody tr'); assert.strictEqual(rows.length,1); assert.strictEqual(rows[0].dataset.w,'w2'); ok('Lọc theo ca lấy từ Lịch làm việc (khớp tên, không phân biệt hoa/thường)'); }

// Chấm hàng loạt: hộp thoại + xác nhận ghi đè
{ const t=setup(STAFF,JSON.parse(JSON.stringify(W)),JSON.parse(JSON.stringify(ATT))); t.run('renderChamCong()'); const d=t.document; t.run(`attOpenBulk('fill')`);
  d.getElementById('ab_from').value='2'; d.getElementById('ab_to').value='4'; t.run('attBulkPreview()'); assert(/Sẽ ghi/.test(d.getElementById('ab_prev').textContent)); assert(!d.getElementById('ab_go').disabled);
  d.querySelector('input[name="ab_mode"][value="overwrite"]').checked=true; t.run('attBulkPreview()'); assert(/sẽ bị thay thế/.test(d.getElementById('ab_prev').textContent)); assert(d.getElementById('ab_go').disabled,'ghi đè phải tick xác nhận'); assert.notStrictEqual(d.getElementById('ab_okwrap').style.display,'none');
  d.getElementById('ab_ok').checked=true; t.run('attBulkPreview()'); assert(!d.getElementById('ab_go').disabled); ok('Chấm hàng loạt: xem trước số ô; ghi đè bắt buộc tick xác nhận mới bật nút Áp dụng');
  d.getElementById('ab_val').value='__custom'; t.run('attBulkValueChanged()'); d.getElementById('ab_custom').value='x1'; t.run('attBulkPreview()'); assert(/sai định dạng/.test(d.getElementById('ab_prev').textContent)); assert(d.getElementById('ab_go').disabled); ok('Giá trị hàng loạt sai định dạng bị chặn ngay ở bước xem trước');
  d.getElementById('ab_val').value='__clear'; t.run('attBulkValueChanged()'); assert(d.querySelector('input[name="ab_mode"][value="overwrite"]').checked); ok('Chọn "Xoá trắng" tự chuyển sang chế độ ghi đè (cần xác nhận)');
  t.run(`attDlgClose('attBulkModal')`); t.run(`attOpenBulk('copyday')`); assert(d.getElementById('ab_src')); t.run(`attOpenBulk('byshift')`); assert(d.getElementById('ab_shift')); ok('Có đủ 3 chế độ: hàng loạt · sao chép từ ngày · điền theo ca'); }

// Xuất / in
{ const t=setup(ADMIN,JSON.parse(JSON.stringify(W)),JSON.parse(JSON.stringify(ATT))); t.run('renderChamCong()');
  const b=t.run('buildAttendanceRows()'); assert.strictEqual(b.rows[2].length,4+30+2); assert.strictEqual(JSON.stringify(b.rows[2].slice(0,4)),JSON.stringify(['STT','Họ và tên','Bộ phận','Chức vụ'])); assert.strictEqual(b.rows[2][4+30],'Tổng công'); assert.strictEqual(b.rows[2][4+31],'Giờ tăng ca'); assert.strictEqual(b.rows[4][1],'An'); assert.strictEqual(b.rows[4][4+8],'1.2');
  ['Mã NV','Ngày nghỉ','Ghi chú'].forEach(c=>assert(!b.rows[2].includes(c),'đã bỏ cột '+c)); ok('Dòng xuất Excel: STT · Tên · Bộ phận · Chức vụ · 30 ngày · Tổng công · Giờ TC (đã bỏ Mã NV, Ngày nghỉ, Ghi chú)');
  // Xuất thật bằng ExcelJS
  const ExcelJS=require('exceljs'); { const WP=Object.getPrototypeOf(new ExcelJS.Workbook().addWorksheet('x')), o=WP.addRow; if(!o.__p){ WP.addRow=function(r,...a){ return o.call(this, Array.isArray(r)?Array.from(r):r, ...a); }; WP.addRow.__p=1; } } /* mảng từ vm khác realm → chuyển về mảng thường (chỉ cần cho test) */ t.ctx.ExcelJS=ExcelJS; t.ctx.window.ExcelJS=ExcelJS; t.ctx.ensureExcelJs=async()=>{}; const dl=[]; t.ctx.attDownloadWb=async(wb,f)=>{ dl.push({f,buf:await wb.xlsx.writeBuffer()}); };
  await t.run('exportAttendanceExcel()'); assert.strictEqual(dl.length,1); assert(/Bang_cham_cong_2026-11\.xlsx/.test(dl[0].f));
  { const wb=new ExcelJS.Workbook(); await wb.xlsx.load(dl[0].buf); const ws=wb.worksheets[0]; const hdr=ws.getRow(3).values.slice(1); assert.deepStrictEqual(hdr.slice(0,4),['STT','Họ và tên','Bộ phận','Chức vụ']); assert.strictEqual(hdr.length,36); assert.strictEqual(ws.getRow(5).getCell(2).value,'An'); }
  ok('Xuất .xlsx thật bằng ExcelJS: mở lại đọc đúng tiêu đề và dữ liệu');
  dl.length=0; await t.run('exportAttendanceByDept()'); { const wb=new ExcelJS.Workbook(); await wb.xlsx.load(dl[0].buf); assert.strictEqual(wb.worksheets.length,2); } ok('Excel tách theo bộ phận: 2 sheet (Lò, Kéo)');
  dl.length=0; await t.run('exportAttendanceReports()'); { const wb=new ExcelJS.Workbook(); await wb.xlsx.load(dl[0].buf); assert.deepStrictEqual(wb.worksheets.map(x=>x.name),['BangCong','TongCong_TangCa','NgayNghi','ThieuDuLieu','SoLieuLuong']); wb.worksheets.forEach(ws=>ws.eachRow(r=>r.eachCell(c=>assert.notStrictEqual(c.value,'Mã NV')))); } ok('Excel báo cáo tổng hợp: đủ 5 sheet, không còn cột Mã NV');
  dl.length=0; await t.run(`exportWorkerAttendance('w1')`); assert.strictEqual(dl.length,1); ok('Excel bảng công cá nhân xuất được');
  t.ctx.ensureExcelJs=async()=>{ throw new Error('x'); }; dl.length=0; await t.run('exportAttendanceExcel()'); assert.strictEqual(dl.length,0); assert(t.toasts.some(x=>x.e&&/thư viện/.test(x.m))); ok('Mất mạng/không tải được thư viện → báo lỗi rõ ràng, không treo');
  // Toolbar: đã bỏ 4 nút
  { const t2=setup(ADMIN,JSON.parse(JSON.stringify(W)),JSON.parse(JSON.stringify(ATT))); t2.run('renderChamCong()'); const tl=t2.document.querySelector('.att2-tools').textContent; ['Chấm hàng loạt','Sao chép từ ngày','Điền theo ca','Chốt kỳ'].forEach(x=>assert(!tl.includes(x),'còn nút '+x)); assert(/Xuất \/ In/.test(tl)); ok('Thanh công cụ đã bỏ: Chấm hàng loạt · Sao chép từ ngày · Điền theo ca · Chốt kỳ'); }
  t.run(`printAttendance('A4')`); const h=t.printed.pop(); assert(/Người lập bảng/.test(h)&&/Trưởng bộ phận/.test(h)&&/ĐÔNG PHƯƠNG/.test(h)&&/size:A4 landscape/.test(h)&&!/<b>Bình/.test(h)); assert(/Kỳ chưa chốt/.test(h)); ok('In A4: tiêu đề, tóm tắt, chú giải, khối chữ ký, escape tên');
  t.run(`printWorkerAttendance('w1')`); assert(/Bảng công tháng 11 năm 2026/.test(t.printed.pop())); ok('In bảng công cá nhân'); 
  const V=setup(VIEW,JSON.parse(JSON.stringify(W)),JSON.parse(JSON.stringify(ATT))); await V.run("exportAttendanceExcel()"); V.run(`printAttendance('A4')`); assert.strictEqual(V.csv.length+V.printed.length,0); ok('Viewer không xuất/in được'); }

// Chuyển tháng
{ const t=setup(ADMIN,JSON.parse(JSON.stringify(W)),JSON.parse(JSON.stringify(ATT))); t.run(`_attYM='2026-12'; shiftAttMonth(1)`); assert.strictEqual(t.run('curYM()'),'2027-01'); assert(/Tháng 1\/2027/.test(txt(t.document,'mc'))); t.run(`changeAttMonth('')`); assert.strictEqual(t.run('curYM()'),'2027-01'); t.run(`shiftAttMonth(-2)`); assert.strictEqual(t.run('curYM()'),'2026-11'); ok('Chuyển tháng qua năm; ô tháng bị xoá trống không làm hỏng bảng'); }

console.log('\nattendance-view.test: '+n+' nhóm kiểm thử đạt'); process.exit(0);
})().catch(e=>{ console.error('✗ THẤT BẠI:',e.stack||e); process.exit(1); });
