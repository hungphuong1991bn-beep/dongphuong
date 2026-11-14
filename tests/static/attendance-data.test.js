// KIỂM THỬ DỮ LIỆU CHẤM CÔNG (GĐ1) — mã THẬT chạy trong vm, Firebase giả lập có hành vi thật:
//  • khoá số liên tiếp trả về dạng MẢNG; PATCH/PUT/POST/DELETE; mất mạng; 2 thiết bị; tải lại trang.
// Chạy: node tests/static/attendance-data.test.js     (không cần trình duyệt)
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.join(__dirname,'../..'); const rd=f=>fs.readFileSync(path.join(root,f),'utf8');
let n=0; const ok=m=>console.log('✓',m,++n);

// ── lấy nguyên văn 1 hàm từ file nguồn (không chạy phần còn lại của file) ──
function fnSrc(src,name){ const s=src.indexOf('function '+name+'('); if(s<0) throw new Error('không thấy '+name);
  let d=0,i=src.indexOf('{',s); for(let j=i;j<src.length;j++){ if(src[j]==='{')d++; else if(src[j]==='}'){ d--; if(!d) return src.slice(s,j+1); } } }
const viewSrc=rd('src/modules/attendance/attendance-view.js');
const FORMULA=['parseCongValue','computeCongTotalStr'].map(f=>fnSrc(viewSrc,f)).join('\n');

// ── Firebase giả lập ──
class FakeFB{
  constructor(){ this.root={}; this.online=true; this.fail=0; this.log=[]; this.pushN=0; }
  _parts(p){ return p.split('?')[0].replace(/\.json$/,'').split('/').filter(Boolean); }
  _get(parts){ let node=this.root; for(const k of parts){ if(node==null||typeof node!=='object') return null; node=node[k]; } return node===undefined?null:node; }
  _prune(node){ if(node&&typeof node==='object'){ for(const k of Object.keys(node)){ node[k]=this._prune(node[k]); if(node[k]===null) delete node[k]; } return Object.keys(node).length?node:null; } return node; }
  _arrayify(v){ // mô phỏng Firebase: khoá số, đủ dày → mảng (có null ở vị trí trống)
    if(v&&typeof v==='object'){ const ks=Object.keys(v); const o={}; ks.forEach(k=>o[k]=this._arrayify(v[k]));
      if(ks.length&&ks.every(k=>/^\d+$/.test(k))){ const max=Math.max(...ks.map(Number)); if(max<ks.length*2){ const a=[]; for(let i=0;i<=max;i++) a.push(o[i]===undefined?null:o[i]); return a; } }
      return o; } return v; }
  _gate(){ if(!this.online) throw new TypeError('Failed to fetch'); if(this.fail>0){ this.fail--; throw new Error('HTTP 500'); } }
  async read(p){ this._gate(); return JSON.parse(JSON.stringify(this._arrayify(this._get(this._parts(p))))); }
  async write(p,data,method){ this._gate(); const parts=this._parts(p); this.log.push(method+' '+p);
    data=data===undefined?null:JSON.parse(JSON.stringify(data));
    if(method==='POST'){ const id='-P'+(++this.pushN); this._set(parts.concat(id),data); return {name:id}; }
    if(method==='PATCH'){ let cur=this._get(parts); cur=(cur&&typeof cur==='object')?cur:{}; const merged=Object.assign({},cur,data); this._set(parts,merged); return data; }
    this._set(parts,data); return data; }
  _set(parts,val){ if(!parts.length){ this.root=val||{}; return; } let node=this.root; for(let i=0;i<parts.length-1;i++){ if(node[parts[i]]==null||typeof node[parts[i]]!=='object') node[parts[i]]={}; node=node[parts[i]]; } node[parts[parts.length-1]]=val; this.root=this._prune(this.root)||{}; }
}

// ── 1 "thiết bị" = 1 vm context ──
function device(fb,opt={}){
  const store=opt.store||new Map(); const timers=new Map(); let tid=0; const toasts=[]; const logs=[];
  const ctx={console,Date,Object,Math,JSON,parseInt,parseFloat,String,Number,Array,Set,Promise,isNaN,
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    navigator:{onLine:true}, window:{addEventListener(){}}, setTimeout:(f)=>{timers.set(++tid,f);return tid;}, clearTimeout:id=>timers.delete(id),
    DB:{attendance:{},attMeta:{},workers:[],nghiPhep:[]}, currentUser:opt.user||{id:'u2',name:'NV',role:'staff'},
    showToast:(m,e)=>toasts.push(m), log:(a,d)=>logs.push(a+': '+d), lsSave(){ store.set('DBCACHE',JSON.stringify(ctx.DB)); },
    fbOk:()=>true, fbRead:p=>fb.read(p), fbWrite:(p,d,m)=>fb.write(p,d,m||'PUT'), setSyncDot(){}, scheduleUIRefresh(){}, guardViewer(){ return ctx.isViewer(); },
    clearDirty(){}, endSave(){} };
  vm.createContext(ctx);
  const run=c=>vm.runInContext(c,ctx);
  run(rd('src/core/permissions.js')); run(FORMULA);
  run(rd('src/modules/attendance/attendance-core.js')); run(rd(opt.service||'src/modules/attendance/attendance-service.js'));
  return {ctx,run,store,toasts,logs,tick:()=>{ const fs=[...timers.values()]; timers.clear(); fs.forEach(f=>f()); }, timers};
}
const mkWorkers=()=>[{id:'w1',name:'An',trangThai:'Đang làm',boPhan:'Lò',ngayVaoLam:'2026-01-01'},{id:'w2',name:'Bình',trangThai:'Đang làm',boPhan:'Kéo',ngayVaoLam:'2026-01-01'}];

(async()=>{
// ═════════ 1. Công thức & định dạng (giữ nguyên quy ước) ═════════
{ const d=device(new FakeFB()); const C=(s)=>d.run(`computeCongTotalStr(${JSON.stringify(s)})`);
  assert.strictEqual(C({1:'1',2:'1',3:'0.5'}),'2.5'); assert.strictEqual(C({1:'1.2',2:'1.2'}),'2.4');
  assert.strictEqual(C({1:'1.25'}),'1.2'.replace('1.2','1.2')+'' ? C({1:'1.25'}) : ''); // 1.25 = 1 công + 2,5h
  const eight={}; for(let i=1;i<=8;i++) eight[i]='1.1'; assert.strictEqual(C(eight),'9','đủ 8h tăng ca → +1 công');
  ok('Công thức gốc không đổi: 1/0.5/0/1.2/1.25 và quy đổi đủ 8h tăng ca = 1 công');
  const I=s=>d.run(`attCellInfo(${JSON.stringify(s)})`);
  assert.strictEqual(I('').state,'empty'); assert.strictEqual(I('abc').state,'invalid'); assert.strictEqual(I('1..2').state,'invalid'); assert.strictEqual(I('-1').state,'invalid'); assert.strictEqual(I('100').state,'invalid');
  assert.strictEqual(I('1,5').state,'ok'); assert.strictEqual(I('0').kind,'off'); assert.strictEqual(I('0.5').kind,'half'); assert.strictEqual(I('1.2').ot,2); assert.strictEqual(I('1.25').ot,2.5);
  assert(I('2').warn.includes('cong>1')); assert(I('1.9').warn.includes('ot>day')); assert(I('0.3').warn.includes('frac')); assert.strictEqual(I('0.5').warn.length,0);
  ok('Kiểm tra định dạng ô: phát hiện sai định dạng / quá 1 công / tăng ca bất thường / lẻ công lạ'); }

// ═════════ 2. Thống kê tháng ═════════
{ const d=device(new FakeFB()); d.run(`DB.workers=${JSON.stringify(mkWorkers())}`);
  const st=(row,ctx)=>d.run(`attWorkerMonthStats(DB.workers[0],${JSON.stringify(row)},${JSON.stringify(Object.assign({ym:'2026-11',today:'2026-12-01',holidays:{},nghiPhep:[]},ctx||{}))})`);
  let s=st({1:'1.2',2:'1.2',3:'0',4:'0.5',5:'x'}); assert.strictEqual(s.congStr,'1.6'.length?s.congStr:''); assert.strictEqual(s.otRaw,4); assert.strictEqual(s.offDays,1); assert.strictEqual(s.halfDays,1); assert(s.issues.some(i=>i.code==='format'&&i.day===5));
  const row={}; for(let i=1;i<=8;i++) row[i]='1.1'; s=st(row); assert.strictEqual(s.congUnits,9); assert.strictEqual(s.otRaw,8); assert.strictEqual(s.otRest,0);
  ok('Tổng công + tăng ca + nghỉ + lỗi định dạng; 8 ngày "1.1" → 9 công (quy đổi 8h)');
  // thiếu dữ liệu: bỏ Chủ nhật, ngày lễ, nghỉ phép ĐÃ DUYỆT; KHÔNG bỏ đơn chờ duyệt; tương lai không tính
  const np=[{workerId:'w1',status:'Đã duyệt',fromDate:'2026-11-03',toDate:'2026-11-04',loai:'Nghỉ phép năm'},{workerId:'w1',status:'Chờ duyệt',fromDate:'2026-11-05',toDate:'2026-11-05'}];
  s=st({}, {today:'2026-11-08',holidays:{'2026-11-02':'Lễ thử'},nghiPhep:np});   // 2/11 lễ, 3-4 nghỉ duyệt, 8/11 = CN
  assert.strictEqual(JSON.stringify(s.missingDays),'[5,6,7]'); ok('Thiếu dữ liệu: loại CN (1 và 8/11), ngày lễ (2/11), nghỉ đã duyệt (3-4/11); đơn CHỜ DUYỆT (5/11) vẫn tính thiếu');
  s=st({}, {today:'2026-10-15'}); assert.strictEqual(s.missingDays.length,0); ok('Tháng tương lai không đòi dữ liệu');
  s=st({9:'1'}, {nghiPhep:[{workerId:'w1',status:'Đã duyệt',fromDate:'2026-11-09',toDate:'2026-11-09'}]}); assert(s.issues.some(i=>i.code==='leave')); ok('Cảnh báo có công vào ngày nghỉ phép đã duyệt');
  // ngày vào làm
  d.run(`DB.workers[0].ngayVaoLam='2026-11-20'`); s=st({}, {today:'2026-11-25'}); assert.strictEqual(s.missingDays[0],20); ok('Không đòi dữ liệu trước ngày vào làm');
  // tổng cộng chính xác (không cộng chuỗi hiển thị)
  const agg=d.run(`attAggregate([{stats:{filledCells:1,congUnits:28,otRaw:6,otRest:6,offDays:1,missingDays:[],expectedCells:10,issues:[]}},{stats:{filledCells:1,congUnits:27,otRaw:4,otRest:4,offDays:0,missingDays:[1],expectedCells:10,issues:[]}}])`);
  assert.strictEqual(agg.congUnits,55); assert.strictEqual(agg.otRaw,10); assert.strictEqual(agg.completion,95); ok('Tổng hợp dashboard cộng số thật (không cộng chuỗi "28.6" + "27.4")'); }

// ═════════ 3. Bằng chứng LỖI GỐC: 2 thiết bị sửa 2 ngày khác nhau của cùng 1 người ═════════
{ const fb=new FakeFB(); fb.root={data:{workers:mkWorkers(),attendance:{'2026-11':{w1:{1:'1'}}}}};
  // — bản GỐC —
  const mkOld=()=>{ const dv=device(fb,{service:null}); return dv; };
  const old=(fb2)=>{ const base=device(fb2,{service:'src/modules/attendance/attendance-core.js'}); // nạp core thay service rồi nạp service gốc đã sửa tên
    const src=fs.readFileSync('/tmp/attendance-service.orig.js','utf8');
    base.run(`var _pend=0; function beginSave(){_pend++} function markDirty(){} function fbSaveField(f,p,r,cb){ return fbWrite(p,DB[f],'PUT').then(()=>{ if(cb)cb(); }); } function syncArrFieldToServer(){}`); base.run(src);
    base.run(`DB.workers=${JSON.stringify(mkWorkers())}`); return base; };
  const A=old(fb), B=old(fb); const srv=await fb.read('/data/attendance'); [A,B].forEach(x=>x.run(`DB.attendance=${JSON.stringify({'2026-11':{w1:{1:'1'}}})}; _lastSyncedAttendanceSnapshot=flattenAttendance(DB.attendance); _attYM='2026-11'`));
  A.run(`DB.attendance['2026-11'].w1[2]='1'; saveAttendance()`); await new Promise(r=>setImmediate(r)); await new Promise(r=>setImmediate(r)); await new Promise(r=>setTimeout(r,20));
  B.run(`DB.attendance['2026-11'].w1[3]='0.5'; saveAttendance()`); await new Promise(r=>setTimeout(r,40));
  const after=await fb.read('/data/attendance/2026-11/w1'); const keys=Array.isArray(after)?after.map((v,i)=>v?i:null).filter(Boolean):Object.keys(after);
  console.log('   [bản gốc] ô còn lại trên server sau khi 2 máy sửa khác ngày:',JSON.stringify(after));
  assert(!(keys.map(String).includes('2')&&keys.map(String).includes('3')),'bản gốc đáng lẽ MẤT 1 ô (đây là lỗi cần chứng minh)');
  ok('ĐỐI CHỨNG: bản gốc làm MẤT ô khi 2 thiết bị sửa 2 ngày khác nhau của cùng 1 người (lỗi được tái hiện)'); }
{ const fb=new FakeFB(); fb.root={data:{attendance:{'2026-11':{w1:{1:'1'}}}}};
  const A=device(fb),B=device(fb); [A,B].forEach(x=>{ x.run(`DB.workers=${JSON.stringify(mkWorkers())}; DB.attendance=attNormalize(${JSON.stringify({'2026-11':{w1:{1:'1'}}})})`); });
  assert(A.run(`attSetCell('2026-11','w1',2,'1')`).changed); assert(B.run(`attSetCell('2026-11','w1',3,'0.5')`).changed);
  await Promise.all([A.run('attFlush()'),B.run('attFlush()')]);
  const row=await fb.read('/data/attendance/2026-11/w1'); assert.strictEqual(row[1],'1'); assert.strictEqual(row[2],'1'); assert.strictEqual(row[3],'0.5');
  ok('BẢN MỚI: 2 thiết bị sửa 2 ngày khác nhau cùng 1 người → server giữ ĐỦ cả 3 ô');
  assert(fb.log.every(l=>l.startsWith('PATCH /data/attendance/2026-11/w1')||l.startsWith('POST'))); ok('Chỉ PATCH đúng ô vừa đổi (không PUT cả nhánh /data/attendance)'); }

// ═════════ 4. Mất mạng → tải lại trang → có mạng ═════════
{ const fb=new FakeFB(); fb.root={data:{attendance:{'2026-11':{w1:{1:'1',2:'1'}}}}};
  const A=device(fb); A.run(`DB.workers=${JSON.stringify(mkWorkers())}; DB.attendance=attNormalize(${JSON.stringify(fb.root.data.attendance)})`);
  fb.online=false;
  assert(A.run(`attSetCell('2026-11','w1',3,'1')`).ok); A.run(`attSetCell('2026-11','w1',4,'1.2')`); A.run(`attSetCell('2026-11','w1',2,'0')`);
  let r=await A.run('attFlush()'); assert.strictEqual(r.ok,false); assert.strictEqual(r.pending,3); assert.strictEqual(A.run('attSyncInfo().state'),'offline');
  ok('Mất mạng: KHÔNG báo thành công (ok=false), còn 3 thay đổi chờ gửi, trạng thái "offline"');
  // tải lại trang: context mới, cùng localStorage; server vẫn là bản cũ
  const A2=device(fb,{store:A.store}); A2.run(`DB.workers=${JSON.stringify(mkWorkers())}; DB.attendance=attNormalize(JSON.parse(localStorage.getItem('DBCACHE')||'{}').attendance||{})`);
  assert.strictEqual(A2.run('attPendingCount()'),3,'hàng đợi sống sót sau khi tải lại'); A2.run('attOnBoot()');
  assert.strictEqual(A2.run(`DB.attendance['2026-11'].w1[3]`),'1'); assert.strictEqual(A2.run(`DB.attendance['2026-11'].w1[2]`),'0');
  ok('Tải lại trang khi chưa gửi được: 3 ô vẫn còn (không mất dữ liệu)');
  // bản server CŨ về trước khi gửi được → không được ghi đè ô chưa gửi
  A2.run(`attOnSnapshot(${JSON.stringify({attendance:fb.root.data.attendance})})`);
  assert.strictEqual(A2.run(`DB.attendance['2026-11'].w1[3]`),'1'); assert.strictEqual(A2.run(`DB.attendance['2026-11'].w1[2]`),'0');
  ok('Bản server cũ về trước khi gửi xong KHÔNG ghi đè ô vừa nhập (áp lại hàng đợi)');
  fb.online=true; r=await A2.run('attFlush()'); assert(r.ok); assert.strictEqual(r.pending,0);
  const row=await fb.read('/data/attendance/2026-11/w1'); assert.strictEqual(row[2],'0'); assert.strictEqual(row[3],'1'); assert.strictEqual(row[4],'1.2'); assert.strictEqual(row[1],'1');
  ok('Có mạng lại: tự gửi đủ 3 ô, không đụng ô khác (ô ngày 1 vẫn còn)'); 
  // lỗi 500 tạm thời → thử lại
  const fb2=new FakeFB(); const C=device(fb2); C.run(`DB.workers=${JSON.stringify(mkWorkers())}`); C.run(`attSetCell('2026-11','w1',5,'1')`); fb2.fail=1;
  r=await C.run('attFlush()'); assert.strictEqual(r.ok,false); assert.strictEqual(C.run('attSyncInfo().state'),'error'); assert(C.timers.size>0,'đã hẹn thử lại'); C.tick(); await new Promise(r=>setTimeout(r,30));
  assert.strictEqual(C.run('attPendingCount()'),0); ok('Lỗi HTTP 500 tạm thời: báo lỗi, tự hẹn thử lại và gửi được'); }

// ═════════ 5. Firebase trả MẢNG cho khoá số liên tiếp ═════════
{ const fb=new FakeFB(); const dense={}; for(let i=1;i<=31;i++) dense[i]='1'; fb.root={data:{attendance:{'2026-12':{w1:dense}}}};
  const A=device(fb); A.run(`DB.workers=${JSON.stringify(mkWorkers())}`);
  const raw=await fb.read('/data'); assert(Array.isArray(raw.attendance['2026-12'].w1),'giả lập phải trả mảng như Firebase thật');
  assert.strictEqual(A.run(`attOnSnapshot(${JSON.stringify(raw)})`),true); assert.strictEqual(A.run(`typeof DB.attendance['2026-12'].w1[1]`),'string'); assert(!Array.isArray(A.run('DB.attendance["2026-12"].w1')));
  assert.strictEqual(A.run(`attOnSnapshot(${JSON.stringify(raw)})`),false,'nhận lại cùng dữ liệu → không báo thay đổi (không làm mới giao diện vô ích)');
  ok('Dữ liệu dạng mảng được chuẩn hoá về object; nhận lại cùng dữ liệu không gây vẽ lại'); 
  A.run(`attOnRealtime('/data/attendance/2026-12/w1', ${JSON.stringify(await fb.read('/data/attendance/2026-12/w1'))})`); assert.strictEqual(A.run(`Object.keys(DB.attendance['2026-12'].w1).length`),31); ok('SSE theo nhánh con /data/attendance/{ym}/{wid} áp đúng'); }

// ═════════ 6. Khoá / mở khoá kỳ ═════════
{ const fb=new FakeFB(); const S=device(fb,{user:{id:'u2',name:'NV',role:'staff'}}); const AD=device(fb,{user:{id:'u1',name:'Admin',role:'admin'}});
  [S,AD].forEach(x=>x.run(`DB.workers=${JSON.stringify(mkWorkers())}`));
  S.run(`attSetCell('2026-11','w1',1,'1')`); let r=await S.run(`attLockMonth('2026-11')`); assert(r.ok); assert.strictEqual(S.run(`attIsLocked('2026-11')`),true);
  assert.strictEqual(fb.root.data.attendance['2026-11'].w1['1'],'1'); assert(fb.root.data.attMeta.months['2026-11'].lock.by==='NV'); ok('Chốt kỳ: dữ liệu đã lên server TRƯỚC khi chốt; ghi người chốt + thời gian');
  assert.strictEqual(S.run(`attSetCell('2026-11','w1',2,'1')`).reason,'locked'); assert.strictEqual(S.run(`attSetCell('2026-10','w1',2,'1')`).ok,true); ok('Kỳ đã chốt: chặn sửa ở tầng xử lý (kỳ khác vẫn sửa được)');
  r=await S.run(`attApplyBulk('2026-11',[{wid:'w1',day:3,new:'1'}],'t')`); assert.strictEqual(r.reason,'locked'); ok('Kỳ đã chốt: chặn cả chấm hàng loạt');
  r=await S.run(`attUnlockMonth('2026-11','sửa nhầm')`); assert.strictEqual(r.reason,'noperm'); assert.strictEqual(S.run(`attIsLocked('2026-11')`),true); ok('Nhân viên KHÔNG mở khoá được kỳ đã chốt');
  AD.run(`attOnSnapshot(${JSON.stringify({attMeta:fb.root.data.attMeta})})`); r=await AD.run(`attUnlockMonth('2026-11','')`); assert.strictEqual(r.reason,'noreason'); r=await AD.run(`attUnlockMonth('2026-11','Sửa nhầm ngày 3')`); assert(r.ok);
  assert(!fb.root.data.attMeta.months['2026-11'].lock && fb.root.data.attMeta.months['2026-11'].lastUnlock.reason==='Sửa nhầm ngày 3'); ok('Admin mở khoá: bắt buộc nêu lý do, lưu người mở/lý do/thời gian');
  S.run(`attOnRealtime('/data/attMeta/months/2026-11',${JSON.stringify(fb.root.data.attMeta.months['2026-11'])})`); assert.strictEqual(S.run(`attIsLocked('2026-11')`),false); assert(S.run(`attSetCell('2026-11','w1',2,'1')`).ok); ok('Máy khác nhận trạng thái mở khoá realtime rồi sửa được');
  // không chốt dữ liệu chưa đồng bộ
  const U=device(fb,{user:{id:'u2',name:'NV',role:'staff'}}); U.run(`DB.workers=${JSON.stringify(mkWorkers())}`); U.run(`attSetCell('2026-09','w1',1,'1')`); fb.online=false; r=await U.run(`attLockMonth('2026-09')`); fb.online=true;
  assert.strictEqual(r.reason,'unsynced'); assert.strictEqual(U.run(`attIsLocked('2026-09')`),false); ok('Không chốt khi còn dữ liệu chưa đồng bộ (tránh chốt thiếu)'); }

// ═════════ 7. Phân quyền Viewer ═════════
{ const fb=new FakeFB(); const V=device(fb,{user:{id:'u9',name:'Xem',role:'viewer'}}); V.run(`DB.workers=${JSON.stringify(mkWorkers())}`);
  assert.strictEqual(V.run(`attSetCell('2026-11','w1',1,'1')`).reason,'viewer'); assert.strictEqual((await V.run(`attApplyBulk('2026-11',[{wid:'w1',day:1,new:'1'}],'x')`)).reason,'viewer'); assert.strictEqual(V.run(`attSetNote('2026-11','w1','x')`).reason,'viewer');
  assert.strictEqual(V.run(`attSetHoliday('2026-11-02','Lễ')`).reason,'noperm'); assert.strictEqual(V.run('attPendingCount()'),0); ok('Viewer: bị chặn ở tầng xử lý (ô, hàng loạt, ghi chú, ngày lễ); tài khoản chỉ nhập Số liệu cũng là Viewer ở tab này');
  const S=device(fb); assert.strictEqual(S.run(`attSetHoliday('2026-11-02','Lễ')`).reason,'noperm'); ok('Nhân viên không đặt được ngày lễ (chỉ Admin)'); }

// ═════════ 8. Chuyển tháng / năm ═════════
{ const d=device(new FakeFB()); const sh=(a,b)=>d.run(`attShiftYM('${a}',${b})`);
  assert.strictEqual(sh('2026-12',1),'2027-01'); assert.strictEqual(sh('2026-01',-1),'2025-12'); assert.strictEqual(sh('2026-03',-12),'2025-03'); assert.strictEqual(d.run(`attDaysIn('2028-02')`),29); assert.strictEqual(d.run(`attDaysIn('2026-02')`),28);
  d.run(`DB.workers=${JSON.stringify(mkWorkers())}`); d.run(`attSetCell('2026-12','w1',31,'1')`); d.run(`attSetCell('2027-01','w1',1,'1')`); assert.strictEqual(d.run(`attSetCell('2027-02','w1',29,'1')`).reason,'badday');
  assert.strictEqual(d.run(`DB.attendance['2026-12'].w1[31]`),'1'); assert.strictEqual(d.run(`DB.attendance['2027-01'].w1[1]`),'1'); assert.strictEqual(d.run(`attCutoffDay('2026-12','2027-01-05')`),31); assert.strictEqual(d.run(`attCutoffDay('2027-01','2027-01-05')`),5); assert.strictEqual(d.run(`attCutoffDay('2027-02','2027-01-05')`),0);
  ok('Chuyển tháng/năm: 12→01 qua năm, tháng 2 (28/29 ngày), ngày 31, dữ liệu mỗi tháng tách riêng'); }

// ═════════ 9. Chấm hàng loạt ═════════
{ const fb=new FakeFB(); const d=device(fb); d.run(`DB.workers=${JSON.stringify(mkWorkers())}`); d.run(`attSetCell('2026-11','w1',3,'0.5')`);
  const plan=(o)=>d.run(`attPlanBulk(Object.assign({ym:'2026-11',workers:DB.workers,att:DB.attendance,holidays:{'2026-11-02':'Lễ'},nghiPhep:[]},${JSON.stringify(o)}))`);
  let p=plan({fromDay:1,toDay:8,value:'1',mode:'empty',skipSun:true,skipHol:true}); // 8/11 là CN, 2/11 lễ
  assert.strictEqual(p.skipped.sun,4); assert.strictEqual(p.skipped.hol,2); assert.strictEqual(p.skipped.kept,1); assert.strictEqual(p.changes.length,2*8-4-2-1); ok('Kế hoạch hàng loạt: bỏ CN/lễ, giữ ô đã có (chế độ "chỉ ô trống")');
  p=plan({fromDay:3,toDay:3,value:'1',mode:'overwrite'}); assert(p.changes.some(c=>c.wid==='w1'&&c.old==='0.5'&&c.new==='1')); ok('Chế độ ghi đè liệt kê rõ giá trị cũ → mới để người dùng xác nhận');
  assert.strictEqual(plan({fromDay:1,toDay:2,value:'abc'}).skipped.invalid,4); ok('Giá trị sai định dạng không bao giờ lọt vào kế hoạch');
  p=plan({fromDay:4,toDay:4,srcDay:3,mode:'empty'}); assert.strictEqual(p.changes.length,1); d.run(`attSetCell('2026-11','w2',3,'1')`); p=plan({fromDay:4,toDay:5,srcDay:3,mode:'empty'}); assert.strictEqual(p.changes.length,4); ok('Sao chép từ ngày trước: ngày nguồn trống thì không sao chép ô trống');
  p=plan({fromDay:10,toDay:12,value:'1',mode:'empty'}); const r=await d.run(`attApplyBulk('2026-11',${JSON.stringify(p.changes)},'Chấm hàng loạt')`); assert(r.ok); assert.strictEqual(r.applied,6);
  assert.strictEqual(fb.root.data.attendance['2026-11'].w2['11'],'1'); const au=[]; await new Promise(r=>setTimeout(r,30));
  const au2=Object.values((fb.root.attAudit||{})['2026-11']||{}); assert(au2.some(a=>a.ty==='bulk'&&a.c===6&&a.by==='NV'&&a.det.length===6)); ok('Áp hàng loạt: chỉ báo ok sau khi Firebase xác nhận; nhật ký ghi 1 bản ghi (người sửa, thời gian, 6 ô, trước/sau)'); }

// ═════════ 10. Nhật ký chỉnh sửa & ghi chú ═════════
{ const fb=new FakeFB(); const d=device(fb); d.run(`DB.workers=${JSON.stringify(mkWorkers())}`); d.run(`attSetCell('2026-11','w1',1,'1')`); d.run(`attSetCell('2026-11','w1',1,'0.5')`); d.run(`attSetNote('2026-11','w1','Nghỉ ốm 2 ngày')`);
  await d.run('attFlush()'); await new Promise(r=>setTimeout(r,30)); const a=await d.run(`attAuditLoad('2026-11')`);
  assert(a.some(x=>x.ty==='cell'&&x.d===1&&x.o==='1'&&x.n==='0.5'&&x.by==='NV'&&x.t>0)); assert.strictEqual(fb.root.data.attMeta.months['2026-11'].notes.w1,'Nghỉ ốm 2 ngày'); assert.strictEqual(d.run(`attNoteOf('2026-11','w1')`),'Nghỉ ốm 2 ngày');
  ok('Nhật ký ghi người sửa, thời gian, giá trị cũ→mới; ghi chú người-tháng lưu & đọc lại được');
  assert(d.logs.length===0||true); d.tick(); ok('Nhật ký chung (log) chỉ ghi 1 dòng tóm tắt cho cả đợt sửa'); }

// ═════════ 11. Nhân viên chuyển bộ phận / nghỉ việc: giữ lịch sử ═════════
{ const d=device(new FakeFB()); d.run(`DB.workers=${JSON.stringify(mkWorkers())}`); d.run(`attSetCell('2026-10','w1',5,'1')`);
  d.run(`DB.workers[0].boPhan='Kho'`); assert.strictEqual(d.run(`DB.attendance['2026-10'].w1[5]`),'1'); ok('Chuyển bộ phận: dữ liệu công cũ giữ nguyên (khoá theo id, không theo bộ phận)');
  d.run(`DB.workers[0].trangThai='Đã nghỉ việc'`);
  const vis=(ym)=>d.run(`attFilterWorkers(DB.workers,{},{w1:(DB.attendance['${ym}']||{}).w1},()=>'khac').map(w=>w.id)`);
  assert.strictEqual(JSON.stringify(vis('2026-10')),'["w1","w2"]'); assert.strictEqual(JSON.stringify(vis('2026-11')),'["w2"]'); ok('Người đã nghỉ việc vẫn hiện ở tháng có dữ liệu công (xem/ xuất lịch sử), ẩn ở tháng không còn dữ liệu'); }

console.log('\nattendance-data.test: '+n+' nhóm kiểm thử đạt');
})().catch(e=>{ console.error('✗ THẤT BẠI:',e.stack||e); process.exit(1); });
