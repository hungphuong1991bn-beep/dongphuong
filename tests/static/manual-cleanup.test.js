// Kiểm thử dọn thủ công (Admin) + xác nhận không còn tự xoá. Chạy: node tests/static/manual-cleanup.test.js
const fs=require('fs'), vm=require('vm'), path=require('path'); const R=path.join(__dirname,'..','..');
let fail=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fail++; };
// 1) sync.js không còn gọi tự xoá
const sync=fs.readFileSync(R+'/src/services/sync.js','utf8');
ok(!/autoCleanupDoneOrders\(\)\s*;|autoCleanupSoLieu\(\)\s*;|slRemindExportIfNeeded\(\)\s*;/.test(sync.replace(/\/\*[\s\S]*?\*\//g,'')),'sync.js không còn lệnh tự xoá');
// 2) module dọn thủ công với môi trường giả
const DAY=864e5, now=Date.now(); const pad=n=>String(n).padStart(2,'0');
const dstr=n=>{const d=new Date(now-n*DAY);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
function env(role){
  const calls={saved:0,slSaved:[],logs:[],toasts:[],confirm:null};
  const ctx={DB:{orders:[{id:'o1',status:'done',doneAt:now-40*DAY},{id:'o2',status:'done',doneAt:now-5*DAY},{id:'o3',status:'run'},{id:'o4',status:'done',doneAt:now-31*DAY}],
      nguyenLieuLog:[{id:'a',ngay:dstr(40)},{id:'b',ngay:dstr(2)},{id:'c'}],mayRutLog:[{id:'d',ngay:dstr(50)}],mayDanhBongLog:[]},
    AUTOCLEAN_DAYS:30, SL_AUTOCLEAN_DAYS:32, _pendingSaves:0, getDirtyFields:()=>[], currentTab:'x',
    SL_META:{nguyenLieu:{field:'nguyenLieuLog',label:'Sổ máy đùn'},mayRut:{field:'mayRutLog',label:'Sổ máy Rút'},mayDanhBong:{field:'mayDanhBongLog',label:'Sổ máy Đánh bóng'}},
    isAdmin:()=>role==='admin', showToast:m=>calls.toasts.push(m), confirm2:(t,b,cb)=>{calls.confirm={t,b,cb};},
    log:(...a)=>calls.logs.push(a), saveOrders:()=>calls.saved++, slDoSave:t=>calls.slSaved.push(t), renderTab(){}, updateBadges(){}, renderSoLieu(){}, console};
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(R+'/src/modules/admin/manual-cleanup.js','utf8'),ctx); return {ctx,calls};
}
let e=env('admin');
ok(e.ctx.dpCleanupDoneOrdersList().map(o=>o.id).join()==='o1,o4','chọn đúng đơn done quá 30 ngày (o1,o4), giữ o2 và đơn đang chạy');
const c=e.ctx.dpCleanupSlCounts(); ok(c.nguyenLieu===1&&c.mayRut===1&&c.total===2,'đếm đúng dòng sổ quá 32 ngày; dòng thiếu Ngày không bị tính');
ok(e.ctx.dpOrdersCleanupBtnHTML().includes('Dọn 2 đơn')&&e.ctx.dpSlCleanupBtnHTML().includes('Dọn 2 dòng'),'Admin thấy nút kèm số lượng');
e.ctx.dpCleanupOrdersManual(); ok(!!e.calls.confirm&&e.calls.saved===0&&e.ctx.DB.orders.length===4,'chưa xác nhận → chưa xoá gì');
e.calls.confirm.cb(); ok(e.ctx.DB.orders.map(o=>o.id).join()==='o2,o3'&&e.calls.saved===1,'xác nhận → chỉ xoá o1,o4 và gọi saveOrders');
ok(e.calls.logs.length===1&&e.calls.logs[0][4].deletedBy==='MANUAL_ADMIN','ghi Nhật ký thao tác MANUAL_ADMIN');
e.ctx.dpCleanupSlManual(); e.calls.confirm.cb();
ok(e.ctx.DB.nguyenLieuLog.map(r=>r.id).join()==='b,c'&&e.ctx.DB.mayRutLog.length===0&&e.calls.slSaved.join()==='nguyenLieu,mayRut','xoá đúng dòng sổ quá hạn, lưu từng sổ có thay đổi');
// 3) không phải Admin
e=env('staff'); e.ctx.dpCleanupOrdersManual(); e.ctx.dpCleanupSlManual();
ok(!e.calls.confirm&&e.ctx.DB.orders.length===4,'staff bị chặn');
ok(e.ctx.dpOrdersCleanupBtnHTML()===''&&e.ctx.dpSlCleanupBtnHTML()==='','staff không thấy nút');
// 4) Admin bị gỡ quyền giữa lúc mở hộp thoại và bấm xác nhận
e=env('admin'); e.ctx.dpCleanupOrdersManual(); e.ctx.isAdmin=()=>false; e.calls.confirm.cb();
ok(e.ctx.DB.orders.length===4,'mất quyền trước khi xác nhận → không xoá');
// 5) đang đồng bộ dở
e=env('admin'); e.ctx.dpCleanupOrdersManual(); e.ctx._pendingSaves=1; e.calls.confirm.cb();
ok(e.ctx.DB.orders.length===4&&e.calls.toasts.length>0,'đang ghi dở → không xoá, báo người dùng');
console.log(fail?`\n${fail} LỖI`:'\nTẤT CẢ ĐẠT'); process.exit(fail?1:0);
