// KIỂM THỬ LIÊN KẾT HR ↔ Lịch làm việc ↔ Chấm công (v2.8.0). Chạy: node tests/static/hr-link.test.js
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.join(__dirname,'../..'); const rd=f=>fs.readFileSync(path.join(root,f),'utf8');
let n=0; const ok=m=>console.log('✓',m,++n);
function setup(workers,llv,viewer){
  const saved=[]; const ctx={console,Date,Object,Math,JSON,String,Number,Array,Set,parseInt,parseFloat,isNaN,
    DB:{workers,lichLamViec:llv||[],attendance:{},nghiPhep:[]}, isViewer:()=>!!viewer, saveLichLamViec(){saved.push(JSON.stringify(ctx.DB.lichLamViec));}, llvShiftKey:t=>/ca\s*1/i.test(t||'')?'ca1':/ca\s*2/i.test(t||'')?'ca2':'khac', llvWorkerDept:()=>'' };
  vm.createContext(ctx); vm.runInContext(rd('src/modules/hr/hr-link.js'),ctx);
  return {ctx,saved,run:c=>vm.runInContext(c,ctx)};
}
const W=()=>[{id:'w1',name:'An',gioiTinh:'Nam',boPhan:'Lò',trangThai:'Đang làm'},{id:'w2',name:'Bình',gioiTinh:'Nữ',boPhan:'Kéo',trangThai:'Đang làm'},{id:'w3',name:'Cường',boPhan:'',trangThai:'Đang làm'},{id:'w4',name:'Dũng',boPhan:'Lò',trangThai:'Đã nghỉ việc'}];

{ const t=setup(W(),[]); const c=t.run('hrLinkSyncSchedule()'); const s=t.ctx.DB.lichLamViec;
  assert(c>0); assert.strictEqual(s.length,2,'tự tạo 2 bảng Lò, Kéo'); assert.strictEqual(s[0].id,'llv_auto_lo'); assert.strictEqual(s[0].rows.length,1); assert.strictEqual(s[0].rows[0].wid,'w1'); assert.strictEqual(s[0].rows[0].time,'');
  assert.strictEqual(s[1].rows[0].gender,'Nữ'); assert.strictEqual(t.saved.length,1); ok('Nhân viên có Bộ phận tự lên Lịch (không nhập lại); ca để trống, không tự bịa ca'); 
  assert(!JSON.stringify(s).includes('Cường')&&!JSON.stringify(s).includes('Dũng')); ok('Người chưa có Bộ phận / đã nghỉ việc không bị đưa lên lịch');
  assert.strictEqual(t.run('hrLinkNoDeptCount()'),1); ok('Đếm nhân viên chưa có Bộ phận để nhắc HR');
  assert.strictEqual(t.run('hrLinkSyncSchedule()'),0); assert.strictEqual(t.saved.length,1); ok('Chạy lại không đổi gì thì không ghi/không tạo trùng (idempotent)'); }

{ const llv=[{id:'llv_thanhcai',name:'Bộ phận Lò',rows:[{name:'an',gender:'',time:'Ca 1 : 6h – 14h',leave:'',note:'x'},{name:'Người ngoài',time:'Ca 2'}]}];
  const t=setup(W(),llv); t.run('hrLinkSyncSchedule()'); const s=t.ctx.DB.lichLamViec; assert.strictEqual(s.length,2,'không tạo bảng "Lò" trùng với "Bộ phận Lò"');
  const r=s[0].rows[0]; assert.strictEqual(r.wid,'w1'); assert.strictEqual(r.name,'An'); assert.strictEqual(r.gender,'Nam'); assert.strictEqual(r.time,'Ca 1 : 6h – 14h'); assert.strictEqual(r.note,'x'); assert.strictEqual(s[0].rows.length,2); ok('Dòng nhập tay cũ được gắn id theo tên, giữ nguyên ca/ghi chú; bảng "Bộ phận Lò" khớp bộ phận "Lò"');
  assert(s[0].rows.some(x=>x.name==='Người ngoài'&&!x.wid)); ok('Dòng không khớp hồ sơ nào được giữ nguyên'); }

{ const t=setup(W(),[]); t.run('hrLinkSyncSchedule()'); t.ctx.DB.workers[0].name='An Mới'; t.ctx.DB.workers[0].gioiTinh='Nữ'; t.ctx.DB.lichLamViec[0].rows[0].time='Ca 2 : 14h – 22h'; t.run('hrLinkSyncSchedule()');
  const r=t.ctx.DB.lichLamViec[0].rows[0]; assert.strictEqual(r.name,'An Mới'); assert.strictEqual(r.gender,'Nữ'); assert.strictEqual(r.time,'Ca 2 : 14h – 22h'); ok('HR đổi tên/giới tính → lịch tự cập nhật, ca đã chọn không mất');
  t.ctx.DB.workers.push({id:'w9',name:'Em mới',boPhan:'Lò',trangThai:'Đang làm'}); t.run('hrLinkSyncSchedule()'); assert.strictEqual(t.ctx.DB.lichLamViec[0].rows.length,2); ok('Thêm nhân viên mới ở HR → tự có mặt ở Lịch');
  t.ctx.DB.workers[0].boPhan='Kéo'; t.run('hrLinkSyncSchedule({prune:true})'); assert.strictEqual(t.ctx.DB.lichLamViec[0].rows.filter(r=>r.wid==='w1').length,1); ok('Đổi bộ phận không làm nhân đôi/mất dòng');
  t.ctx.DB.workers[1].trangThai='Đã nghỉ việc'; t.run('hrLinkSyncSchedule()'); assert(t.ctx.DB.lichLamViec.some(s=>s.rows.some(r=>r.wid==='w2')),'không prune khi chỉ mở lịch'); t.run('hrLinkSyncSchedule({prune:true})'); assert(!t.ctx.DB.lichLamViec.some(s=>s.rows.some(r=>r.wid==='w2'))); ok('HR cho nghỉ việc → dòng bị bỏ khỏi lịch (chỉ khi HR thay đổi)');
  t.ctx.DB.workers=t.ctx.DB.workers.filter(x=>x.id!=='w9'); t.run('hrLinkSyncSchedule({prune:true})'); assert(!t.ctx.DB.lichLamViec.some(s=>s.rows.some(r=>r.wid==='w9'))); ok('HR xoá nhân viên → dòng bị bỏ khỏi lịch'); }

{ const t=setup([],[{id:'a',name:'Lò',rows:[{wid:'w1',name:'An'}]}]); assert.strictEqual(t.run('hrLinkSyncSchedule({prune:true})'),0); assert.strictEqual(t.ctx.DB.lichLamViec[0].rows.length,1); ok('Danh sách nhân sự chưa tải về (rỗng) → không xoá gì');
  const v=setup(W(),[],true); assert.strictEqual(v.run('hrLinkSyncSchedule()'),0); assert.strictEqual(v.ctx.DB.lichLamViec.length,0); ok('Tài khoản Xem không ghi dữ liệu'); }

{ const t=setup(W(),[{id:'a',name:'Lò',rows:[{wid:'w1',name:'An'},{wid:'w1',name:'An'}]}]); t.run('hrLinkSyncSchedule()'); assert.strictEqual(t.ctx.DB.lichLamViec.find(s=>s.id==='a').rows.length,1); ok('Dòng trùng cùng 1 nhân viên được gộp'); }

// Chấm công + lịch theo ngày khớp theo id (kể cả khi trùng tên)
{ const src=rd('src/modules/attendance/attendance-view.js'), core=rd('src/modules/attendance/schedule-core.js');
  const ctx={console,Date,Object,Math,JSON,String,Number,Array,Set,parseInt,parseFloat,isNaN,DB:{lichLamViec:[{rows:[{wid:'w1',name:'An',time:'Ca 2'}]}],workers:[],shiftCatalog:{}},llvShiftKey:t=>/ca\s*2/i.test(t||'')?'ca2':'khac'};
  vm.createContext(ctx); vm.runInContext(core,ctx);
  const m=vm.runInContext('schLegacyMap()',ctx); assert.strictEqual(m.map['id:w1'],'ca2');
  const eff=vm.runInContext("schEffective({legacy:schLegacyMap().map,dup:{},hol:{}}, {id:'w1',name:'Tên khác'}, '2026-11-12')",ctx); assert.strictEqual(eff.id,'ca2'); ok('Lịch theo ngày + Chấm công lấy ca theo ID nhân viên (đổi tên vẫn khớp)'); }
console.log('\nhr-link.test: '+n+' nhóm kiểm thử đạt');
