// KIỂM THỬ: (1) lỗi "xoá bị sống lại" của lớp đồng bộ mảng-theo-id, (2) xoá nhân viên không làm mất lịch sử.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.join(__dirname,'../..'); const rd=f=>fs.readFileSync(f.startsWith('/')?f:path.join(root,f),'utf8');
let n=0; const ok=m=>console.log('✓',m,++n);
function fnSrc(src,name){ let s=src.indexOf('function '+name+'('); if(s<0) throw new Error('không thấy '+name); if(src.slice(Math.max(0,s-6),s)==='async ') s-=6; let d=0,i=src.indexOf('{',src.indexOf('function '+name+'(')); for(let j=i;j<src.length;j++){ if(src[j]==='{')d++; else if(src[j]==='}'){ d--; if(!d) return src.slice(s,j+1); } } }
const mk=(syncFile,workers)=>{ const server={workers:JSON.parse(JSON.stringify(workers))};
  const ctx={console,JSON,Object,Array,Promise,DB:{workers:JSON.parse(JSON.stringify(workers))},fbRead:async p=>JSON.parse(JSON.stringify(server.workers)),lsSave(){},scheduleUIRefresh(){},
    fbSaveField:(f,p,r,cb)=>{ server.workers=JSON.parse(JSON.stringify(ctx.DB[f])); if(cb)cb(); }};
  vm.createContext(ctx); const src=rd(syncFile); const run=c=>vm.runInContext(c,ctx);
  run(['snapshotArrById','mergeAndSaveArrField'].map(f=>fnSrc(src,f)).join('\n')); run('var _lastSyncedArrSnap={workers:{}};');
  if(src.includes('function initArrSnapshots')) run(['initArrSnapshots','asArr'].map(f=>fnSrc(src,f)).join('\n')+'\n var _x=0;');
  return {ctx,run,server}; };
const WK=[{id:'A',name:'An'},{id:'B',name:'Bình'}];
(async()=>{
{ const t=mk('/tmp/sync.orig.js',WK); t.ctx.DB.workers=t.ctx.DB.workers.filter(w=>w.id!=='A'); await t.run(`mergeAndSaveArrField('workers','/data/workers')`);
  console.log('   [bản gốc] server sau khi xoá An ở phiên mới:',JSON.stringify(t.server.workers.map(w=>w.id))); assert(t.server.workers.some(w=>w.id==='A')); ok('ĐỐI CHỨNG: bản gốc — xoá đầu tiên trong phiên mới bị "sống lại" (An vẫn còn trên server)'); }
{ const t=mk('src/services/sync.js',WK); t.run('initArrSnapshots()'); t.ctx.DB.workers=t.ctx.DB.workers.filter(w=>w.id!=='A'); await t.run(`mergeAndSaveArrField('workers','/data/workers')`);
  assert.strictEqual(JSON.stringify(t.server.workers.map(w=>w.id)),'["B"]'); ok('BẢN MỚI: xoá ngay phiên đầu được ghi nhận đúng, không sống lại');
  assert.strictEqual(JSON.stringify(t.run(`asArr({0:{id:'x'},2:{id:'y'}})`).map(o=>o.id)),'["x","y"]'); assert.strictEqual(t.run('asArr(null).length'),0); ok('Dữ liệu Firebase dạng object-có-lỗ-hổng luôn được đưa về mảng'); }

// deleteWorker
const hw=rd('src/modules/hr/hr-workers.js'); const code=['workerHistoryCount','deleteWorker'].map(f=>fnSrc(hw,f)).join('\n');
const dev=(user)=>{ const logs=[],toasts=[],conf=[]; const ctx={console,Object,Array,Set,JSON,DB:{workers:[{id:'w1',name:'An',trangThai:'Đang làm'},{id:'w2',name:'Trống',trangThai:'Đang làm'}],
    attendance:{'2026-10':{w1:{5:'1',6:'1'}}},nghiPhep:[{workerId:'w1',status:'Đã duyệt'}],kyLuat:[]},guardViewer:()=>user.role==='viewer',isAdmin:()=>user.role==='admin',
    confirm2:(t,b,cb)=>conf.push({t,b,cb}),saveWorkers(){ctx.saved=(ctx.saved||0)+1},log:(a,d)=>logs.push(a),refreshWorkerViews(){},showToast:(m)=>toasts.push(m),todayStr:()=>'2026-11-13'};
  vm.createContext(ctx); vm.runInContext(code,ctx); return {ctx,logs,toasts,conf}; };
{ const d=dev({role:'admin'}); d.ctx.deleteWorker('w1'); assert(/KHÔNG thể xóa/.test(d.conf[0].b)); d.conf[0].cb();
  const w=d.ctx.DB.workers.find(x=>x.id==='w1'); assert(w&&w.trangThai==='Đã nghỉ việc'&&w.ngayNghiViec==='2026-11-13'); assert.strictEqual(Object.keys(d.ctx.DB.attendance['2026-10'].w1).length,2); assert.strictEqual(d.ctx.DB.nghiPhep.length,1);
  ok('Nhân viên có lịch sử: KHÔNG bị xoá — chuyển "Đã nghỉ việc", công/nghỉ phép giữ nguyên (bản gốc xoá luôn công)');
  d.ctx.deleteWorker('w2'); assert(/Xóa hồ sơ trống/.test(d.conf[1].t)); d.conf[1].cb(); assert(!d.ctx.DB.workers.find(x=>x.id==='w2')); ok('Hồ sơ trống (thêm nhầm) vẫn xoá hẳn được, có xác nhận'); }
{ const d=dev({role:'staff'}); d.ctx.deleteWorker('w1'); assert.strictEqual(d.conf.length,0); assert(/Chỉ Admin/.test(d.toasts[0])); const v=dev({role:'viewer'}); v.ctx.deleteWorker('w1'); assert.strictEqual(v.conf.length,0); ok('Nhân viên & Viewer không xoá/cho nghỉ việc được (chặn ở tầng xử lý)'); }
console.log('\nhr-delete-sync.test: '+n+' nhóm đạt');
})().catch(e=>{console.error('✗',e.stack||e);process.exit(1)});
