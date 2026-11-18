// KIỂM THỬ tab 📊 Số liệu (Sổ máy đùn / Sổ máy Rút / Sổ máy Đánh bóng+Cắt):
//   (1) Xuất Excel ĐẦY ĐỦ dòng + cột (đọc lại file .xlsx thật bằng ExcelJS)
//   (2) Xoá sau khi xuất: sạch trên máy, máy chủ VÀ thiết bị khác (kể cả khi máy chủ rỗng hẳn)
//   (3) Mất mạng/tắt app giữa chừng: lệnh xoá không bị mất, tự xoá tiếp, không "sống lại"
// Chạy: node tests/static/solieu-export-sync.test.js   (cần ExcelJS: NODE_PATH=<thư mục có node_modules/exceljs>)
const fs=require('fs'), vm=require('vm'), path=require('path'), assert=require('assert');
const R=path.join(__dirname,'..','..'); const rd=f=>fs.readFileSync(path.join(R,f),'utf8');
const FakeFB=require('./helpers/fake-firebase.js');
let ExcelJS; try{ ExcelJS=require('exceljs'); }catch(e){ console.log('⚠ Bỏ qua phần ExcelJS (chưa cài exceljs)'); }
let n=0; const ok=m=>console.log('  ✓',m,++n);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ── trích hàm/const theo tên từ file nguồn ──
function fnSrc(src,name){ let s=src.indexOf('function '+name+'('); if(s<0) throw new Error('không thấy '+name);
  if(src.slice(Math.max(0,s-6),s)==='async ') s-=6;
  let i=src.indexOf('{',src.indexOf('function '+name+'(')), d=0, j=i;
  for(;j<src.length;j++){ const c=src[j]; if(c==='{')d++; else if(c==='}'){ d--; if(!d) break; } }
  return src.slice(s,j+1); }
const syncSrc=rd('src/services/sync.js'), viewSrc=rd('src/modules/inventory/inventory-view.js');
const metaSrc=viewSrc.slice(viewSrc.indexOf('const SL_META = {'), viewSrc.indexOf('};', viewSrc.indexOf('const SL_META = {'))+2);

// ── 1 thiết bị = 1 context riêng (RAM + localStorage riêng), chung 1 máy chủ giả ──
function device(fb, ls, opt){
  opt=opt||{}; const toasts=[], logs=[], blobs=[], confirms=[]; let online=true;
  const store=ls||{};
  const ctx={ console, JSON, Object, Array, Set, Map, Promise, Date, Math, Number, String, isFinite, isNaN, setTimeout, clearTimeout, Blob:function(parts,o){ this.parts=parts; this.type=o&&o.type; },
    localStorage:{ getItem:k=>(k in store?store[k]:null), setItem:(k,v)=>{ store[k]=String(v); }, removeItem:k=>{ delete store[k]; } },
    navigator:{ get onLine(){ return fb.online; } },
    DB:{ orders:[{id:'ord1',customer:'KH A',po:'PO-1',type:'Thanh cái'}], nguyenLieuLog:[], mayRutLog:[], mayDanhBongLog:[] },
    currentUser:{ role:opt.role||'admin', name:'Tester' }, currentTab:'x',
    fbOk:()=>true, fbUrl:()=>'http://fake', fbAppendAuth:async u=>u,
    fbRead:async p=>fb.read(p), fbWrite:async(p,d,m)=>fb.write(p,d,m),
    fetch:async(url)=>{ // chỉ dùng cho ?shallow=true
      const p=url.replace('http://fake',''); const base=p.split('?')[0]; const v=await fb.read(base);
      const out=(v&&typeof v==='object')?Object.fromEntries(Object.keys(v).map(k=>[k,true])):null;
      return {ok:true, json:async()=>out}; },
    setSyncDot(){}, showToast:(m,e)=>toasts.push(m), log:(...a)=>logs.push(a), lsSave(){}, doPoll:async()=>{}, renderSoLieu(){},
    confirm2:(t,b,cb)=>confirms.push({t,b,cb}), isSlEditor:()=>(opt.role||'admin')!=='viewer', guardViewer:()=>false, guardSlEdit:()=>false,
    actorName:()=>'Tester', fmtNum:x=>String(Number(x)||0), fmtDateTime:ts=>new Date(ts).toISOString().slice(0,16).replace('T',' '),
    document:{ createElement:()=>({ click(){ ctx._lastDownload=this; } }), body:{ appendChild(){}, removeChild(){} } },
    URL:{ createObjectURL:b=>{ blobs.push(b); return 'blob:x'; }, revokeObjectURL(){} }, ensureExcelJs:async()=>{}, vnTimeHM:()=>'00:00', fmtDate:x=>x };
  ctx.window=ctx; // như trình duyệt: hàm toàn cục là thuộc tính của window
  vm.createContext(ctx); const run=c=>vm.runInContext(c,ctx);
  if(ExcelJS){ ctx.window.ExcelJS=ExcelJS; ctx.ExcelJS=ExcelJS; }
  run('let _pendingSaves=0; let _lastSyncedArrSnap={nguyenLieuLog:{},mayRutLog:{},mayDanhBongLog:{}};');
  run(['snapshotArrById','getDirtyFields','markDirty','clearDirty','beginSave','endSave','initArrSnapshots','asArr'].map(f=>fnSrc(syncSrc,f)).join('\n')+'\nconst DIRTY_KEY="sx_dirty_fields_v1";');
  run(metaSrc+'\n'+fnSrc(viewSrc,'slArr')+'\n'+fnSrc(viewSrc,'slDoSave'));
  run(rd('src/modules/inventory/inventory-service.js'));
  run(rd('src/modules/inventory/inventory-export.js'));
  ctx.__setOnline=v=>{ fb.online=v; }; ctx.run=run; ctx.toasts=toasts; ctx.logs=logs; ctx.blobs=blobs; ctx.confirms=confirms; ctx.store=store;
  return ctx;
}
const NL=(id,extra)=>Object.assign({id,ngay:'2026-11-1'+(id.length%9),nguyenLieu:'Cu-ETP',heatLot:'HL-'+id,soLuong:100,phe:2,phoi:1,donHangId:'ord1',maLoSX:'LOT-'+id,khachHang:'KH A',po:'PO-1',updatedAt:1700000000000,createdAt:1699999999000},extra||{});
const RUT=(id,extra)=>Object.assign({id,ngay:'2026-11-12',quyCach:'10x100',soThanh:50,congDoan:'Rút',may:'Máy rút 100 - 1',ca:'1',nguoiSanXuat:'An',khachHang:'KH A',heatLot:'HL-'+id,maLoSX:'LOT-'+id,donHangId:'ord1',updatedAt:1700000000000},extra||{});
const serverIds=(fb,f)=>{ const v=fb._get(['data',f]); return v?Object.keys(v).sort():[]; };

(async()=>{
console.log('1) Đồng bộ & xoá giữa 2 thiết bị');
{ const fb=new FakeFB(); const A=device(fb), B=device(fb);
  A.DB.nguyenLieuLog.push(NL('a1'),NL('a2'),NL('a3'));
  await A.run(`saveNguyenLieuLog()`);
  assert.deepStrictEqual(serverIds(fb,'nguyenLieuLog'),['a1','a2','a3']); ok('A thêm 3 dòng → lên máy chủ theo từng ID');
  assert.strictEqual(A.run('slQueueCount("nguyenLieuLog")'),0); ok('Hàng đợi bền rỗng sau khi máy chủ xác nhận');
  B.run(`slApplySnapshotAll(${JSON.stringify({data:null})}.data)`);
  B.run(`slApplySnapshotAll(${JSON.stringify({nguyenLieuLog:fb._get(['data','nguyenLieuLog'])})})`);
  assert.strictEqual(B.DB.nguyenLieuLog.length,3); ok('B nhận đủ 3 dòng');

  // A xuất Excel → xác nhận → xoá
  const exportedRows=A.DB.nguyenLieuLog.slice(), ids=exportedRows.map(r=>r.id);
  await A.run(`slClearAfterExport('nguyenLieu', ${JSON.stringify(ids)}, [])`);
  assert.deepStrictEqual(serverIds(fb,'nguyenLieuLog'),[]); assert.strictEqual(A.DB.nguyenLieuLog.length,0);
  ok('Xoá sau xuất: sạch trên máy A và trên máy chủ (nhánh rỗng hẳn)');
  assert(A.toasts.some(t=>/khỏi phần mềm và máy chủ/.test(t))); ok('Báo đã xoá khỏi máy chủ sau khi kiểm tra lại');

  // LỖI GỐC: máy chủ không còn dòng nào → B phải xoá sạch dữ liệu cũ
  B.run(`slApplySnapshotAll({})`);
  assert.strictEqual(B.DB.nguyenLieuLog.length,0); ok('B (máy khác) xoá sạch dữ liệu cũ khi máy chủ rỗng — lỗi gốc `if(data.xxx)` đã sửa');
}

console.log('2) Xuất Excel: đủ dòng, đủ cột, lấy dữ liệu mới nhất từ máy chủ');
if(ExcelJS){
  const fb=new FakeFB(); const A=device(fb), B=device(fb);
  A.DB.nguyenLieuLog.push(NL('n1'),NL('n2'),NL('n3'),NL('n4'),NL('n5'));
  A.DB.mayRutLog.push(RUT('r1'),RUT('r2',{ngay:'khong-hop-le'}),RUT('r3',{soThanh:'75'}));
  await A.run(`saveNguyenLieuLog(); saveMayRutLog();`);
  // B chỉ biết 2 dòng (bỏ lỡ sự kiện) → trước đây xuất thiếu
  B.DB.nguyenLieuLog=[NL('n1'),NL('n2')];
  await B.run(`exportSlExcel('nguyenLieu')`);
  assert.strictEqual(B.blobs.length,1);
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.concat(B.blobs[0].parts.map(p=>Buffer.from(p))));
  const ws=wb.worksheets[0]; const header=ws.getRow(6).values.slice(1);
  const data=[]; ws.eachRow((row,i)=>{ if(i>=8 && row.getCell(1).value && typeof row.getCell(1).value==='number') data.push(row); });
  assert.strictEqual(data.length,5); ok('B có sẵn 2 dòng nhưng file xuất đủ 5 dòng (đọc lại từ máy chủ trước khi xuất)');
  ['Đơn hàng liên kết','Mã lô SX','Mã cuộn/Heat-Lot','STT'].forEach(h=>assert(header.includes(h),'thiếu cột '+h)); ok('Có đủ cột Đơn hàng liên kết / Mã lô SX / Heat-Lot / STT');
  const c=h=>header.indexOf(h)+1;
  assert(/KH A · PO PO-1/.test(String(data[0].getCell(c('Đơn hàng liên kết')).value))); assert(/^LOT-/.test(String(data[0].getCell(c('Mã lô SX')).value))); ok('Giá trị Đơn hàng liên kết & Mã lô SX ra đúng');
  const d0=data[0].getCell(c('Ngày')).value; assert(d0 instanceof Date && d0.getUTCDate()>=10); ok('Ngày ghi dạng ngày dd/mm/yyyy, không lệch múi giờ');
  const total=ws.getRow(8+5).getCell(c('Số lượng (kg)')).value; assert.strictEqual(total,500); ok('Dòng TỔNG CỘNG đúng (500 kg)');
  assert.strictEqual(B.confirms.length,1); assert(/mọi thiết bị khác/.test(B.confirms[0].b)); ok('Chỉ sau khi xuất xong mới hỏi dọn dữ liệu');

  // Sổ Rút: ngày hỏng không làm hỏng cả file; thêm Heat-Lot nguồn
  await A.run(`exportSlExcel('mayRut')`);
  const wb2=new ExcelJS.Workbook(); await wb2.xlsx.load(Buffer.concat(A.blobs[0].parts.map(p=>Buffer.from(p))));
  const ws2=wb2.worksheets[0]; const h2=ws2.getRow(6).values.slice(1); const rows2=[]; ws2.eachRow((row,i)=>{ if(i>=8 && typeof row.getCell(1).value==='number') rows2.push(row); });
  assert.strictEqual(rows2.length,3); assert(h2.includes('Heat-Lot nguồn')&&h2.includes('Mã lô SX')); ok('Sổ Rút: đủ 3 dòng (kể cả dòng có ngày hỏng) + cột Heat-Lot nguồn / Mã lô SX');
  assert(rows2.some(r=>r.getCell(h2.indexOf('Số thanh')+1).value===75)); ok('Số lưu dạng chuỗi ("75") vẫn ra đúng kiểu số');

  // Mất mạng: vẫn xuất được, báo rõ, kèm cảnh báo khi dọn
  fb.online=false; A.confirms.length=0;
  await A.run(`exportSlExcel('nguyenLieu')`);
  assert(A.toasts.some(t=>/Không đọc được dữ liệu mới nhất/.test(t))); assert(/chưa đối chiếu/.test(A.confirms[0].b)); fb.online=true; ok('Mất mạng: vẫn xuất theo dữ liệu máy + cảnh báo rõ, không im lặng');
} else console.log('  (bỏ qua)');

console.log('3) Mất mạng / tắt app khi xoá — không mất lệnh xoá, không sống lại');
{ const fb=new FakeFB(); const ls={}; const A=device(fb,ls); const B=device(fb);
  A.DB.mayRutLog.push(RUT('x1'),RUT('x2'),RUT('x3'),RUT('x4'));
  await A.run(`saveMayRutLog()`); assert.strictEqual(serverIds(fb,'mayRutLog').length,4);
  B.run(`slApplySnapshotAll(${JSON.stringify({mayRutLog:fb._get(['data','mayRutLog'])})})`); assert.strictEqual(B.DB.mayRutLog.length,4);

  fb.online=false;                       // mất mạng đúng lúc dọn dữ liệu
  await A.run(`slClearAfterExport('mayRut', ['x1','x2','x3','x4'], [])`);
  assert.strictEqual(A.DB.mayRutLog.length,0); assert.strictEqual(serverIds(fb,'mayRutLog').length,4);
  assert(A.toasts.some(t=>/CHƯA xoá được trên máy chủ/.test(t))); ok('Offline: xoá cục bộ + báo rõ CHƯA xoá được trên máy chủ');
  assert.strictEqual(A.run('slQueueCount("mayRutLog")'),4); assert(JSON.parse(ls['sx_sl_pending_v1']).mayRutLog.del.length===4); ok('Lệnh xoá nằm trong hàng đợi BỀN (localStorage) — không mất');
  assert(JSON.parse(ls['sx_dirty_fields_v1']).includes('mayRutLog')); ok('Cờ dirty được đặt NGAY cả khi offline (bản gốc thoát sớm trước khi đặt cờ)');

  // Tắt app, mở lại: context mới, cùng localStorage; bản server cũ (còn 4 dòng) KHÔNG được làm sống lại
  fb.online=true;
  const A2=device(fb,ls); A2.DB.mayRutLog=[]; // cache cục bộ đã xoá
  A2.run(`slApplySnapshotAll(${JSON.stringify({mayRutLog:fb._get(['data','mayRutLog'])})})`);
  assert.strictEqual(A2.DB.mayRutLog.length,0); ok('Mở lại app: bản máy chủ cũ không làm 4 dòng đã xoá "sống lại"');
  await A2.run(`slFlushAll()`);
  assert.deepStrictEqual(serverIds(fb,'mayRutLog'),[]); assert.strictEqual(A2.run('slQueueCount("mayRutLog")'),0); ok('Có mạng lại: hàng đợi tự đẩy → máy chủ sạch');
  B.run(`slApplySnapshotAll({})`); assert.strictEqual(B.DB.mayRutLog.length,0); ok('Thiết bị B cũng sạch');

  // SSE: sự kiện trễ của dòng đang chờ xoá không được làm sống lại
  const C=device(fb); C.DB.mayRutLog=[]; C.run(`slQueueDel('mayRutLog',['z9'])`);
  C.run(`applySingleSlItemChange('mayRutLog','z9',${JSON.stringify(RUT('z9'))})`);
  assert.strictEqual(C.DB.mayRutLog.length,0); ok('Sự kiện realtime trễ không làm sống lại dòng đang chờ xoá');
}

console.log('4) Không xoá nhầm / không mất dữ liệu');
{ const fb=new FakeFB(); const A=device(fb);
  A.DB.nguyenLieuLog.push(NL('k1'),NL('k2'),NL('k3')); await A.run(`saveNguyenLieuLog()`);
  A.DB.nguyenLieuLog.push(NL('k4')); // dòng mới thêm sau khi chốt danh sách xuất
  await A.run(`slClearAfterExport('nguyenLieu',['k1','k2','k3'],[])`);
  assert.deepStrictEqual(A.DB.nguyenLieuLog.map(r=>r.id),['k4']); ok('Chỉ xoá đúng dòng đã xuất; dòng mới thêm k4 được giữ');
  assert.deepStrictEqual(serverIds(fb,'nguyenLieuLog'),['k4']); ok('Máy chủ giữ đúng k4 (đã được đẩy cùng lượt lưu)');

  // dòng thêm khi offline → không mất khi bản server cũ về
  const fb2=new FakeFB(); const ls={}; const D=device(fb2,ls); fb2.online=false;
  D.DB.mayRutLog.push(RUT('off1')); await D.run(`saveMayRutLog()`);
  fb2.online=true; const D2=device(fb2,ls); D2.DB.mayRutLog=[RUT('off1')];
  D2.run(`slApplySnapshotAll({})`); assert.strictEqual(D2.DB.mayRutLog.length,1); ok('Dòng thêm lúc offline được giữ khi máy chủ (cũ) chưa có');
  await D2.run(`slFlushAll()`); assert.deepStrictEqual(serverIds(fb2,'mayRutLog'),['off1']); ok('…và tự đẩy lên khi có mạng');

  // Viewer không bị hỏi xoá
  const V=device(new FakeFB(),null,{role:'viewer'}); V.run(`slConfirmClearAfterExport('nguyenLieu',['a'],[{id:'a'}])`); assert.strictEqual(V.confirms.length,0); ok('Viewer: chỉ xem/xuất, không bị hỏi xoá');
}

console.log('5) Lỗ hổng đã vá: dòng lệch key, sự kiện realtime khi đang ghi, mất sự kiện, ký tự lạ');
{ const fb=new FakeFB(); const A=device(fb), B=device(fb);
  // 5a) Máy chủ có dòng KHÔNG có trường id / id lệch key → trước đây giữ mãi trên máy, không xoá được
  fb._set(['data','nguyenLieuLog','kA'], {ngay:'2026-11-10',nguyenLieu:'Cu',soLuong:5});
  fb._set(['data','nguyenLieuLog','kB'], {id:'khac',ngay:'2026-11-10',nguyenLieu:'Cu',soLuong:6});
  A.run(`slApplySnapshotAll(${JSON.stringify({nguyenLieuLog:fb._get(['data','nguyenLieuLog'])})})`);
  assert.deepStrictEqual(Array.from(A.DB.nguyenLieuLog.map(r=>r.id).sort()),['kA','kB']); ok('Dòng thiếu id / lệch key được chuẩn hoá id = key trên máy chủ');
  await A.run(`slClearAfterExport('nguyenLieu',['kA','kB'],[])`);
  assert.deepStrictEqual(serverIds(fb,'nguyenLieuLog'),[]); assert.strictEqual(A.DB.nguyenLieuLog.length,0); ok('…và xoá được sạch cả trên máy chủ (trước đây còn sót mãi)');

  // 5b) Legacy mảng thiếu id: được gán id cố định, di trú không làm mất dòng
  const legacy=[{id:'L1',ngay:'2026-11-01',nguyenLieu:'Cu'},{ngay:'2026-11-02',nguyenLieu:'Cu2'}];
  const C=device(fb); C.run(`slApplySnapshotAll(${JSON.stringify({nguyenLieuLog:legacy})})`);
  assert.deepStrictEqual(Array.from(C.DB.nguyenLieuLog.map(r=>r.id)),['L1','lg1']); await C.run(`migrateSlLogIfArray('nguyenLieuLog','/data/nguyenLieuLog',${JSON.stringify(legacy)})`);
  assert.deepStrictEqual(serverIds(fb,'nguyenLieuLog'),['L1','lg1']); ok('Di trú dữ liệu cũ giữ cả dòng thiếu id (gán id cố định)');
  await C.run(`slClearAfterExport('nguyenLieu',['L1','lg1'],[])`); assert.deepStrictEqual(serverIds(fb,'nguyenLieuLog'),[]);

  // 5c) Sự kiện xoá realtime từ máy khác KHÔNG bị bỏ khi máy này đang có lượt ghi dở
  const fb2=new FakeFB(); const P=device(fb2);
  P.DB.mayRutLog.push(RUT('p1'),RUT('p2')); await P.run('saveMayRutLog()');
  P.run('_pendingSaves=1'); P.run(`applySingleSlItemChange('mayRutLog','p1',null)`);
  assert.deepStrictEqual(Array.from(P.DB.mayRutLog.map(r=>r.id)),['p2']); P.run('_pendingSaves=0'); ok('Đang ghi dở vẫn áp sự kiện xoá của thiết bị khác (trước đây bị bỏ → dòng còn mãi)');

  // 5d) Lỡ mất sự kiện realtime → đối chiếu (mở tab / nút Đồng bộ) vẫn kéo về đúng
  const fb3=new FakeFB(); const X=device(fb3), Y=device(fb3);
  X.DB.nguyenLieuLog.push(NL('s1'),NL('s2'),NL('s3')); await X.run('saveNguyenLieuLog()');
  Y.run(`slApplySnapshotAll(${JSON.stringify({nguyenLieuLog:fb3._get(['data','nguyenLieuLog'])})})`); assert.strictEqual(Y.DB.nguyenLieuLog.length,3);
  await X.run(`slClearAfterExport('nguyenLieu',['s1','s2'],[])`);   // Y không nhận được sự kiện nào
  assert.strictEqual(Y.DB.nguyenLieuLog.length,3);
  const rc=await Y.run('slReconcileAll()'); assert(rc.ok&&rc.changed); assert.deepStrictEqual(Array.from(Y.DB.nguyenLieuLog.map(r=>r.id)),['s3']); ok('Đối chiếu với máy chủ: máy Y bỏ đúng 2 dòng đã xoá ở máy X');
  const rc2=await Y.run('slReconcileAll()'); assert(rc2.ok&&!rc2.changed); ok('Đối chiếu lần 2: không đổi gì');
}
if(ExcelJS){
  const fb=new FakeFB(); const A=device(fb);
  const bad=NL('c1',{ghiChu:'abc\u0001def\u0008ghi', nguyenLieu:'Cu\u000bETP'});
  A.DB.nguyenLieuLog.push(bad,NL('c2'),NL('c3',{ghiChu:'x'.repeat(40000)})); await A.run('saveNguyenLieuLog()');
  await A.run(`exportSlExcel('nguyenLieu')`);
  assert.strictEqual(A.blobs.length,1,'phải tải được file dù có ký tự lạ');
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.concat(A.blobs[0].parts.map(p=>Buffer.from(p))));
  const ws=wb.worksheets[0]; const header=ws.getRow(6).values.slice(1); const gc=header.indexOf('Ghi chú')+1;
  const notes=[8,9,10].map(i=>String(ws.getRow(i).getCell(gc).value));
  assert(notes.includes('abcdefghi')); assert(notes.some(t=>t.length===32000)); ok('Ký tự điều khiển bị loại, ô quá dài bị cắt — file đủ 3 dòng, mở được');
  // kiểm tra lại file: dữ liệu nguồn nhiều hơn file → phải báo lỗi, không cho xoá
  A.confirms.length=0; A.blobs.length=0;
  let threw=false; try{ await A.run(`xlsVerifyBuffer(new ArrayBuffer(8),8,[{stt:1}],[{key:'stt'}])`); }catch(e){ threw=true; } assert(threw); ok('Kiểm tra lại file phát hiện file hỏng/thiếu dòng');
}

console.log('\nsolieu-export-sync.test: '+n+' kiểm tra đạt'); process.exit(0);
})().catch(e=>{ console.error('✗',e.stack||e); process.exit(1); });
