// KIỂM THỬ LỊCH LÀM VIỆC THEO NGÀY (GĐ2): logic thuần + ghi dữ liệu (Firebase giả lập, 2 thiết bị, mất mạng, phân quyền).
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path'); const FakeFB=require('./helpers/fake-firebase.js');
const root=path.join(__dirname,'../..'); const rd=f=>fs.readFileSync(path.join(root,f),'utf8'); let n=0; const ok=m=>console.log('✓',m,++n);
function fnSrc(src,name){ let s=src.indexOf('function '+name+'('); let d=0,i=src.indexOf('{',s); for(let j=i;j<src.length;j++){ if(src[j]==='{')d++; else if(src[j]==='}'){ d--; if(!d) return src.slice(s,j+1); } } }
const FORMULA=['parseCongValue','computeCongTotalStr'].map(f=>fnSrc(rd('src/modules/attendance/attendance-view.js'),f)).join('\n');
function device(fb,opt={}){ const store=opt.store||new Map(), timers=new Map(); let tid=0;
  const ctx={console,Date,Object,Math,JSON,parseInt,parseFloat,String,Number,Array,Set,Promise,isNaN,
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}, navigator:{onLine:true}, window:{addEventListener(){}},
    setTimeout:f=>{timers.set(++tid,f);return tid;}, clearTimeout:id=>timers.delete(id), DB:{attendance:{},attMeta:{},workers:[],nghiPhep:[],lichLamViec:[]}, currentUser:opt.user||{id:'u1',name:'Admin',role:'admin'},
    showToast(){}, log(){}, lsSave(){}, fbOk:()=>true, fbRead:p=>fb.read(p), fbWrite:(p,d,m)=>fb.write(p,d,m||'PUT'), setSyncDot(){}, scheduleUIRefresh(){}, guardViewer(){return ctx.isViewer();}, clearDirty(){}, endSave(){} };
  vm.createContext(ctx); const run=c=>vm.runInContext(c,ctx);
  run(rd('src/core/permissions.js')); run(FORMULA); run(rd('src/modules/attendance/attendance-core.js')); run(rd('src/modules/attendance/attendance-service.js'));
  run(fnSrc(rd('src/modules/attendance/attendance-schedule.js'),'llvShiftKey')); run(rd('src/modules/attendance/schedule-core.js')); run(rd('src/modules/attendance/schedule-service.js'));
  return {ctx,run,store,tick:()=>{const f=[...timers.values()];timers.clear();f.forEach(x=>x());}}; }
const W=[{id:'w1',name:'An',boPhan:'Lò',trangThai:'Đang làm'},{id:'w2',name:'Bình',boPhan:'Lò',trangThai:'Đang làm'},{id:'w3',name:'Cường',boPhan:'Kéo',trangThai:'Đang làm'},{id:'w4',name:'Dũng',boPhan:'Lò',trangThai:'Đã nghỉ việc'}];
const LLV=[{id:'s1',name:'Lò',rows:[{name:'An',time:'Ca 1 : 6h – 14h'},{name:'Bình',time:'Ca 2 : 14h – 22h'},{name:'Cường',time:'HC : 7h – 17h'}]}];
const mk=(fb,o)=>{ const d=device(fb||new FakeFB(),o); d.run(`DB.workers=${JSON.stringify(W)}; DB.lichLamViec=${JSON.stringify(LLV)}`); return d; };
(async()=>{
// ── ca & giờ ──
{ const d=mk(); const S=d.run(`schCatalog().map(s=>s.id).join()`); assert.strictEqual(S,'ca1,ca2,ca3,hc,tangca,nghi');
  assert.strictEqual(d.run(`schShiftHours(schShiftById('ca3'))`),8); assert.strictEqual(d.run(`schShiftHours(Object.assign({},schShiftById('hc'),{breakMin:60}))`),9); assert.strictEqual(d.run(`schShiftById('ca1').minStaff`),0);
  ok('Danh mục ca có sẵn đúng giờ (Ca 1 06–14, Ca 2 14–22, Ca 3 22–06 qua nửa đêm = 8h, HC 07–17); nghỉ giữa ca được trừ; quân số tối thiểu mặc định 0 (chưa đặt)');
  const bad=d.run(`schValidateShift({id:'x',name:'',start:'25:00',end:'06:00',breakMin:999,minStaff:-1,kind:'work'},schCatalog(true))`); assert(bad.length>=4); assert(d.run(`schValidateShift({id:'x',name:'ca 1',start:'06:00',end:'14:00',breakMin:0,minStaff:1,kind:'work'},schCatalog(true))`).some(e=>/Đã có ca/.test(e))); ok('Kiểm tra hợp lệ ca: giờ sai, nghỉ giữa ca, quân số âm, trùng tên'); }
// ── Admin tạo/sửa ca ──
{ const fb=new FakeFB(), A=mk(fb); let r=await A.run(`schSaveShift({name:'Ca 4',start:'18:00',end:'02:00',breakMin:30,minStaff:3,type:'rotating'})`); assert(r.ok); const id=r.id;
  assert.strictEqual(A.run(`schShiftHours(schShiftById('${id}'))`),7.5); assert.strictEqual(fb.root.data.shiftCatalog[id].minStaff,3); ok('Admin tạo ca mới (18:00–02:00, nghỉ 30 phút → 7,5h); lên Firebase khi đã xác nhận');
  r=await A.run(`schSaveShift({id:'ca1',name:'Ca 1',start:'05:30',end:'13:30',breakMin:30,minStaff:4})`); assert(r.ok); assert.strictEqual(A.run(`schShiftById('ca1').start`),'05:30'); assert.strictEqual(A.run(`schShiftById('ca1').builtin`),true); assert.strictEqual(fb.root.data.shiftCatalog.ca1.minStaff,4); ok('Sửa giờ bắt đầu/kết thúc, nghỉ giữa ca, quân số tối thiểu của ca có sẵn (không mất ca)');
  r=await A.run(`schSaveShift({name:'ca 4',start:'18:00',end:'02:00'})`); assert.strictEqual(r.reason,'invalid'); ok('Chặn tạo ca trùng tên');
  r=await A.run(`schSetShiftActive('${id}',false)`); assert(r.ok); assert(!A.run(`schCatalog().some(s=>s.id==='${id}')`)); assert(A.run(`schCatalog(true).some(s=>s.id==='${id}')`)); ok('Ngừng dùng ca (không xoá — dữ liệu phân ca cũ vẫn còn tên ca)');
  const S=mk(fb,{user:{id:'u2',name:'NV',role:'staff'}}), V=mk(fb,{user:{id:'u3',name:'Xem',role:'viewer'}});
  for(const D of [S,V]){ assert.strictEqual((await D.run(`schSaveShift({name:'X',start:'01:00',end:'02:00'})`)).ok,false); assert.strictEqual((await D.run(`schSetAssign('2026-11-10','w1','ca2')`)).ok,false); assert.strictEqual(D.run(`schSetOT('2026-11-10','w1','2')`).ok,false); }
  assert.strictEqual(S.run('attPendingCount()'),0); ok('Nhân viên & Viewer không sửa được danh mục ca / phân ca / tăng ca (chặn ở tầng xử lý, như Lịch làm việc hiện có)'); }
// ── nhân lực trong ngày ──
{ const fb=new FakeFB(), A=mk(fb); await A.run(`schSaveShift({id:'ca1',name:'Ca 1',start:'06:00',end:'14:00',breakMin:0,minStaff:2})`); await A.run(`schSaveShift({id:'ca2',name:'Ca 2',start:'14:00',end:'22:00',breakMin:0,minStaff:1})`);
  const R=d=>A.run(`(function(){const r=schDayRoster('${d}','all'); return JSON.parse(JSON.stringify({t:r.totals,s:r.shifts.map(x=>[x.shift.id,x.actual,x.min,x.short]),un:r.unassigned.map(w=>w.id),lv:r.leave.map(x=>x.w.id),c:r.conflicts.map(x=>x.code)}))})()`);
  let r=R('2026-11-10'); // Thứ Ba: ca mặc định từ bảng lịch cũ
  assert.strictEqual(r.t.workers,3); assert.strictEqual(r.t.required,3); assert.strictEqual(r.t.actual,3); assert.strictEqual(r.t.short,1); assert.strictEqual(r.t.response,66.7); assert(r.s.some(x=>x[0]==='ca1'&&x[1]===1&&x[3]===1)); ok('Dashboard ngày: cần 3, có 3 (Ca1 thiếu 1: có 1/cần 2), đáp ứng 66,7% — người "Đã nghỉ việc" không tính; ca mặc định lấy từ bảng lịch bộ phận cũ');
  assert.strictEqual(R('2026-11-08').t.actual,0); ok('Chủ nhật: không tự áp ca mặc định (chỉ ngày đã phân riêng mới tính)');
  assert.strictEqual(R('2026-11-10').t.workers,3); assert.strictEqual(A.run(`schDayRoster('2026-11-10','Kéo').totals.workers`),1); ok('Lọc theo bộ phận');
  // phân ca riêng
  let x=await A.run(`schSetAssign('2026-11-10','w3','ca1')`); assert(x.ok&&x.applied===1); r=R('2026-11-10'); assert(r.s.some(y=>y[0]==='ca1'&&y[1]===2&&y[3]===0)); assert.strictEqual(fb.root.data.shiftAssign['2026-11'].w3['10'],'ca1'); ok('Phân ca cho nhân viên (HC → Ca 1): ghi đúng ô /data/shiftAssign, Ca 1 đủ người');
  x=await A.run(`schSetAssign('2026-11-10','w3','')`); r=R('2026-11-10'); assert(r.s.some(y=>y[0]==='hc'&&y[1]===1)); ok('Bỏ phân riêng → quay về ca mặc định');
  await A.run(`schSetAssign('2026-11-10','w2','nghi')`); r=R('2026-11-10'); assert(r.lv.includes('w2')); ok('Xếp ca "Nghỉ" tính vào danh sách nghỉ, không tính nhân lực');
  // nghỉ phép: chỉ đơn ĐÃ DUYỆT
  A.run(`DB.nghiPhep=[{workerId:'w1',status:'Chờ duyệt',fromDate:'2026-11-10',toDate:'2026-11-10'},{workerId:'w3',status:'Đã duyệt',fromDate:'2026-11-10',toDate:'2026-11-11',loai:'Nghỉ phép năm'}]`);
  r=R('2026-11-10'); assert(!r.lv.includes('w1')&&r.lv.includes('w3')); ok('Đơn nghỉ CHỜ DUYỆT không tính là nghỉ; đơn ĐÃ DUYỆT tự nhận diện');
  await A.run(`schSetAssign('2026-11-11','w3','ca2')`); r=R('2026-11-11'); assert(r.c.includes('leave')); ok('Cảnh báo xếp ca trùng thời gian nghỉ phép đã duyệt');
  A.run(`DB.lichLamViec.push({id:'s2',name:'Kéo',rows:[{name:'an',time:'Ca 2 : 14h – 22h'}]})`); assert(R('2026-11-12').c.includes('dup')); ok('Cảnh báo cùng 1 người xuất hiện ở nhiều bảng lịch với ca khác nhau');
  // tăng ca
  assert((A.run(`schSetOT('2026-11-12','w1','2.5')`)).ok); assert.strictEqual(A.run(`schSetOT('2026-11-12','w1','abc')`).reason,'invalid'); A.run(`DB.attendance={'2026-11':{w2:{12:'1.3'}}}`); const ot=A.run(`schDayRoster('2026-11-12','all').ot.map(o=>[o.w.id,o.reg,o.actual])`); assert.strictEqual(JSON.stringify(ot),'[["w1",2.5,0],["w2",0,3]]'); ok('Đăng ký tăng ca + đối chiếu giờ tăng ca thực tế trong bảng công'); await A.run('attFlush()'); }
// ── kế hoạch hàng loạt ──
{ const A=mk(); A.run(`DB.nghiPhep=[{workerId:'w1',status:'Đã duyệt',fromDate:'2026-11-11',toDate:'2026-11-11'}]`);
  const P=(o)=>A.run(`(function(){const p=schPlanAssign(Object.assign({workers:schScopeWorkers('Lò')},${JSON.stringify(o)})); return JSON.parse(JSON.stringify({n:p.changes.length,sk:p.skipped,c:p.changes.slice(0,3)}))})()`);
  let p=P({from:'2026-11-09',to:'2026-11-15',shiftId:'ca2',mode:'empty',skipSun:true,skipHol:true,skipLeave:true}); assert.strictEqual(p.sk.sun,2); assert.strictEqual(p.sk.leave,1); assert.strictEqual(p.n,2*7-2-1); ok('Phân ca hàng loạt: bỏ Chủ nhật, bỏ ngày nghỉ phép đã duyệt (2 người × 7 ngày − 2 − 1 = 11)');
  A.run(`DB.shiftAssign={'2026-11':{w1:{9:'ca3'}}}`); p=P({from:'2026-11-09',to:'2026-11-09',shiftId:'ca2',mode:'empty'}); assert.strictEqual(p.sk.kept,1); p=P({from:'2026-11-09',to:'2026-11-09',shiftId:'ca2',mode:'overwrite'}); assert(p.c.some(c=>c.wid==='w1'&&c.old==='ca3')); ok('Chỉ ô trống vs ghi đè (liệt kê giá trị cũ để xác nhận)');
  assert.strictEqual(P({from:'2026-11-09',to:'2026-11-09',shiftId:'khongco'}).sk.invalid,1); ok('Ca không tồn tại bị loại');
  // sao chép tuần trước
  A.run(`DB.shiftAssign={'2026-11':{w1:{2:'ca1',3:'ca1',4:'ca3'},w2:{2:'ca2'}}}; DB.nghiPhep=[]`);
  const cp=A.run(`(function(){const p=schPlanCopy({workers:schScopeWorkers('Lò'),srcFrom:'2026-11-02',dstFrom:'2026-11-09',days:7,mode:'empty'}); return JSON.parse(JSON.stringify(p.changes.map(c=>[c.wid,c.date,c.new])))})()`);
  assert(cp.some(c=>c[0]==='w1'&&c[1]==='2026-11-10'&&c[2]==='ca1')&&cp.some(c=>c[0]==='w1'&&c[1]==='2026-11-11'&&c[2]==='ca3')&&cp.some(c=>c[0]==='w1'&&c[1]==='2026-11-12'&&c[2]==='ca1')); ok('Sao chép lịch từ tuần trước (giữ nguyên thứ trong tuần; ca mặc định cũng được chuyển thành phân riêng)');
  const cm=A.run(`(function(){A=schPlanCopyMonth({workers:schScopeWorkers('Lò'),ym:'2026-12'}); return A.skipped.nodate})()`); ok('Sao chép từ tháng trước (ngày d → ngày d; bỏ ngày không tồn tại)');
  const rot=A.run(`(function(){const p=schPlanRotation({workers:schScopeWorkers('Lò'),from:'2026-11-09',to:'2026-11-22',weeks:2,shifts:['ca1','ca2','ca3'],mode:'overwrite',skipSun:true}); return JSON.parse(JSON.stringify(p.changes.filter(c=>c.date==='2026-11-09'||c.date==='2026-11-16').map(c=>[c.wid,c.date,c.new])))})()`);
  assert.strictEqual(JSON.stringify(rot),'[["w1","2026-11-09","ca1"],["w2","2026-11-09","ca2"],["w1","2026-11-16","ca2"],["w2","2026-11-16","ca3"]]'); ok('Luân phiên theo tuần: mỗi tuần mỗi người chuyển sang ca kế tiếp');
  const sw=A.run(`(function(){const [a,b]=schScopeWorkers('Lò'); const p=schPlanSwap({a:a,b:b,from:'2026-11-02',to:'2026-11-04'}); return JSON.parse(JSON.stringify({n:p.changes.length,sk:p.skipped,c:p.changes.filter(c=>c.date==='2026-11-02').map(c=>[c.wid,c.new])}))})()`);
  assert.strictEqual(JSON.stringify(sw.c),'[["w1","ca2"],["w2","ca1"]]'); ok('Đổi ca giữa 2 nhân viên (An Ca 1 ↔ Bình Ca 2); ngày một bên chưa có ca thì bỏ qua, không suy diễn'); }
// ── áp dụng + 2 thiết bị + mất mạng ──
{ const fb=new FakeFB(), A=mk(fb), B=mk(fb);
  A.run(`DB.shiftAssign={'2026-11':{w1:{2:'ca1'}}}`); const plan=A.run(`JSON.parse(JSON.stringify(schPlanAssign({workers:schScopeWorkers('Lò'),from:'2026-11-09',to:'2026-11-10',shiftId:'ca3',mode:'empty'}).changes))`);
  const r=await A.run(`schApplyAssign(${JSON.stringify(plan)},'Phân ca hàng loạt')`); assert(r.ok&&r.applied===4); assert.strictEqual(fb.root.data.shiftAssign['2026-11'].w2['10'],'ca3');
  await new Promise(r=>setTimeout(r,30)); const au=Object.values(fb.root.attAudit['2026-11']); assert(au.some(a=>a.ty==='schAssign'&&a.c===4&&a.by==='Admin'&&a.det.length===4)); ok('Áp hàng loạt: ghi từng ô, báo OK sau khi Firebase xác nhận; nhật ký ghi người/thời gian/4 ô trước→sau');
  const hist=await A.run(`schAuditLoad('2026-11')`); assert(hist.length>=1&&hist.every(h=>/^sch/.test(h.ty))); ok('Lịch sử điều chỉnh lịch tách khỏi lịch sử công');
  // 2 thiết bị
  await Promise.all([A.run(`schSetAssign('2026-11','w1','hc')`.replace("'2026-11'","'2026-11-20'")),B.run(`schSetAssign('2026-11-21','w1','ca2')`)]); const row=await fb.read('/data/shiftAssign/2026-11/w1'); assert.strictEqual(row[20],'hc'); assert.strictEqual(row[21],'ca2'); assert.strictEqual(row[9],'ca3'); ok('2 thiết bị phân 2 ngày khác nhau của cùng 1 người → giữ đủ, không đè ô khác');
  // máy B nhận realtime
  B.run(`attOnRealtime('/data/shiftAssign/2026-11/w1',${JSON.stringify(row)})`); assert.strictEqual(B.run(`schAssigned(DB.workers[0],'2026-11-20')`),'hc'); ok('Máy khác nhận phân ca qua SSE và hiển thị đúng');
  // mất mạng → tải lại
  fb.online=false; A.run(`schSetAssign('2026-11-25','w2','ca3')`); const f=await A.run('attFlush()'); assert.strictEqual(f.ok,false); assert.strictEqual(A.run('attPendingCount()'),1);
  const A2=device(fb,{store:A.store}); A2.run(`DB.workers=${JSON.stringify(W)}`); assert.strictEqual(A2.run('attPendingCount()'),1); A2.run('attOnBoot()'); A2.tick();
  A2.run(`attOnSnapshot(${JSON.stringify({shiftAssign:fb.root.data.shiftAssign})})`); assert.strictEqual(A2.run(`schAssigned(DB.workers[1],'2026-11-25')`),'ca3'); ok('Mất mạng + tải lại trang: phân ca chưa gửi vẫn còn và không bị bản server cũ ghi đè');
  await new Promise(r=>setTimeout(r,30)); fb.online=true; const f2=await A2.run('attFlush()'); if(!f2.ok) console.log('   lỗi:',JSON.stringify(f2),JSON.stringify(A2.store.get('sx_att_outbox_v2')).slice(0,300)); assert(f2.ok); assert.strictEqual(fb.root.data.shiftAssign['2026-11'].w2['25'],'ca3'); ok('Có mạng lại: tự gửi'); }
// ── tổng hợp tháng ──
{ const A=mk(); await A.run(`schSaveShift({id:'ca1',name:'Ca 1',start:'06:00',end:'14:00',minStaff:2})`); const m=A.run(`JSON.parse(JSON.stringify(schMonthSummary('2026-11','all')))`); assert.strictEqual(m.length,30); const d10=m.find(x=>x.date==='2026-11-10'); assert(d10.short>=1&&d10.counts.some(c=>c.id==='ca1')); assert.strictEqual(m.find(x=>x.date==='2026-11-08').counts.filter(c=>c.actual>0).length,0); ok('Tổng hợp tháng: số người từng ca mỗi ngày, cảnh báo thiếu, 30 ngày'); }
// ── phân ca không ảnh hưởng công đã chốt ──
{ const A=mk(); A.run(`DB.attMeta={months:{'2026-11':{lock:{by:'Admin',at:1}}}}`); A.run(`DB.attendance={'2026-11':{w1:{9:'1'}}}`); const before=JSON.stringify(A.run('DB.attendance')); const r=await A.run(`schSetAssign('2026-11-09','w1','ca3')`); assert(r.ok); assert.strictEqual(JSON.stringify(A.run('DB.attendance')),before); assert.strictEqual(A.run(`attIsLocked('2026-11')`),true); ok('Đổi ca trong tháng đã chốt công: lịch cập nhật, bảng công đã chốt KHÔNG đổi'); }
console.log('\nschedule-data.test: '+n+' nhóm kiểm thử đạt');
})().catch(e=>{console.error('✗ THẤT BẠI:',e.stack||e);process.exit(1)});
