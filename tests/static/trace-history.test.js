// v2.14.0 — KIỂM THỬ TRUY XUẤT LỊCH SỬ SẢN XUẤT (TEST 6, 8, 9): luồng thật → thBuild → giao diện; dữ liệu cũ/thiếu; lưu trữ không đổi.
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path'), cp=require('child_process');
const root=path.join(__dirname,'../..'); const rd=f=>fs.readFileSync(path.join(root,f),'utf8');
const MIN=60000, HOUR=3600000, T0=Date.UTC(2026,10,3,1,0,0);
const toasts=[], reg={};
const mkEl=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){},contains:()=>true},setAttribute(){},querySelectorAll:()=>[],cloneNode(){return mkEl();},onclick:null});
const ctx={console,Date,Object,Math,JSON,parseInt,parseFloat,String,Number,Array,Set,Map,Promise,isFinite,setTimeout:()=>0,requestAnimationFrame:()=>{},
  document:{addEventListener(){},getElementById:id=>reg[id]||null,querySelector:()=>null,querySelectorAll:()=>[],
    createElement:()=>mkEl(), body:{appendChild(el){ const m=(el.innerHTML||'').match(/id="([A-Za-z]+)"/g)||[]; m.forEach(x=>{ const id=x.slice(4,-1); reg[id]=mkEl(); }); reg.thModal=reg.thModal||mkEl(); }}},
  addEventListener(){}, localStorage:{getItem:()=>null,setItem(){}}, T:T0,
  DB:{orders:[],users:[{id:'u9',name:'Chị Lan'}],qrProducts:[],nguyenLieuLog:[],mayRutLog:[],mayDanhBongLog:[],cpRecords:[]}, currentTab:'hoanThanh', currentUser:{id:'u1',name:'Tuấn',role:'staff'},
  guardViewer:()=>false,isStaff:()=>true,isAdmin:()=>false,isViewer:()=>false,renderTab(){},refreshKhDetailIfOpen(){},updateBadges(){},goTab(){},goToOrderCard(){},pushNotif(){},alertUser(){},openQrGenForOrder(){},scheduleAiAutoPromoteCheck(){},
  saveOrders(){}, log(){}, showToast:m=>toasts.push(m), addNotif(){}, dhTvMode:false, ddCode:o=>o.po||o.id, specStr:o=>'Φ'+(o.w||18), qtyLabel:()=>'', esc:s=>String(s==null?'':s).replace(/</g,'&lt;'),
  machineStatus:()=>'ok', fmtDateTime:t=>new Date(t+7*HOUR).toISOString().replace('T',' ').slice(0,16), fmtDate:t=>new Date(t+7*HOUR).toISOString().slice(0,10),
  fmtDuration:ms=>{ if(!ms||ms<0) return ''; const m=Math.floor(ms/60000); return m<60?m+'p':Math.floor(m/60)+'g'+(m%60?m%60+'p':''); },
  confirm2(){}, withPlanLock:(id,fn)=>{fn();return true;}, fbOk:()=>false, openModal(){}, closeModal(){}, htIsFresh:()=>false, htViewDetail(){}, actorName:()=>'Tuấn', statusInfo:s=>({label:s}),
  window:{dpUI:{modal:{markClean(){}}}}, dpUI:null};
ctx.nowSrv=()=>ctx.T; ctx.dpUI=ctx.window.dpUI; vm.createContext(ctx);
['src/core/constants.js','src/modules/planning/planning-machines.js','src/modules/planning/planning-runctl.js','src/modules/production/production-panels.js','src/modules/production/production-dispatch.js','src/modules/orders/orders-cards.js','src/modules/orders/orders-service.js','src/modules/trace/trace-engine.js','src/modules/trace/trace-history.js','src/modules/trace/trace-history-view.js']
 .forEach(f=>{ try{ vm.runInContext(rd(f).replace(/^const /gm,'var '),ctx,{filename:f}); }catch(e){ console.error('load fail',f,e.message); process.exit(1);} });
const run=c=>vm.runInContext(c,ctx); run('saveOrders=function(){}');
let n=0; const ok=m=>console.log('✓',m,++n); const setT=t=>{ctx.T=t;};
const J=x=>JSON.stringify(x);
(async()=>{

// ── TEST 6: luồng thật → hoàn thành → truy xuất đầy đủ ──
run(`DB.orders=[${J({id:'A',customer:'KH Một',po:'PO-1',type:'Thanh cái',w:18,qty:100,kg:500,doneQty:96,status:'pending',priority:'GẤP 1',createdBy:'u9',machineAssign:{dun:'m_tj500_1',rut:'m_rut100_1'}})},
  ${J({id:'X',customer:'KH Một',po:'PO-1',type:'Thanh cái',qty:10,status:'pending',machineAssign:{}})}]`);   // đơn X trùng tên KH + PO với A (bẫy liên kết)
setT(T0); run(`setStatus('A','running')`);
setT(T0+30*MIN); run(`rcDoPause('A','Máy hỏng / sự cố')`);
setT(T0+45*MIN); run(`assignMachine('A','dun','m_tj550_2')`);
setT(T0+60*MIN); assert((await run(`rcResumeOrder('A')`)).ok);
setT(T0+120*MIN); run(`setStage('A','rut')`);
setT(T0+150*MIN); run(`setStatus('A','done')`);
run(`DB.orders[0].doneBy='Tuấn'; DB.qrProducts=[{id:'q1',orderId:'A',productCode:'TC-18-001',copperGrade:'C1100'},{id:'q2',orderId:'X',productCode:'TC-X',copperGrade:'C1020'}];
 DB.nguyenLieuLog=[{id:'n1',donHangId:'A',may:'TJ550 số 2',soLuong:'800',soMetChay:'1200',nguoiSanXuat:'Anh Bình',ca:'Ca 1',ghiChu:'Chạy ổn định',heatLot:'H-77'},{id:'n2',donHangId:'X',customer:'KH Một',may:'TJ550 số 1',soLuong:'999',nguoiSanXuat:'Người lạ'}];
 DB.mayRutLog=[{id:'r1',donHangId:'A',may:'Rút 100T',soThanh:'96',nguoiSanXuat:'Anh Cường',ca:'Ca 2'}];
 DB.cpRecords=[{id:'c1',orderId:'A',type:'fqc',code:'FQC-001',result:'OK',inspector:'QC Hà',createdAt:${T0+160*MIN}},{id:'c2',orderId:'X',type:'fqc',code:'FQC-X',result:'NG',inspector:'QC Khác',createdAt:${T0+161*MIN}},{id:'c3',type:'ncr',code:'NCR-PO',po:'PO-1',inspector:'QC Hà',createdAt:${T0+162*MIN}}]`);
setT(T0+3*HOUR);
const before=J(run('DB.orders[0]'));
const m=run(`thBuild('A')`); assert.strictEqual(J(run('DB.orders[0]')),before,'thBuild chỉ đọc, không sửa dữ liệu');
const ov=m.overview;
assert.strictEqual(ov.code,'PO-1'); assert.strictEqual(ov.customer,'KH Một'); assert.strictEqual(ov.qtyOrdered,100); assert.strictEqual(ov.qtyDone,96); assert.strictEqual(ov.owner,'Chị Lan');
assert.strictEqual(ov.productCodes.join(),'TC-18-001'); assert.strictEqual(ov.copperGrades.join(),'C1100'); assert.strictEqual(ov.startedAt,T0); assert.strictEqual(ov.doneAt,T0+150*MIN);
assert.strictEqual(ov.runMs,(30+60+30)*MIN,'chạy 30p + 60p (60→120) + 30p rút = 120p; nghỉ 30p không tính'); assert.strictEqual(ov.runSource,'sessions'); assert.strictEqual(ov.pauseCount,1); assert.strictEqual(ov.pausedMs,30*MIN);
ok('TEST 6a: tổng quan đúng — mã đơn, KH, PO, mã SP/mác đồng (từ QR theo ID), SL đặt/hoàn thành, giờ bắt đầu/xong, tổng chạy 120p, người phụ trách');
const [dun,rut,db,cat]=m.stages;
assert.strictEqual(dun.state,'done'); assert.strictEqual(dun.machineIds.join(),'m_tj500_1,m_tj550_2'); assert.strictEqual(dun.sessions.length,2); assert.strictEqual(dun.runMs,90*MIN); assert.strictEqual(dun.source,'sessions');
assert.strictEqual(dun.startAt,T0); assert.strictEqual(dun.endAt,T0+120*MIN); assert.strictEqual(dun.qty.input,800); assert.strictEqual(dun.qty.output,1200); assert.strictEqual(dun.operatorsLedger.join(),'Anh Bình'); assert.strictEqual(dun.notes.join(),'Chạy ổn định');
assert.strictEqual(dun.ledgerMachines.join(),'TJ550 số 2'); assert(dun.actors.includes('Tuấn'));
assert.strictEqual(rut.state,'done'); assert.strictEqual(rut.machineIds.join(),'m_rut100_1'); assert.strictEqual(rut.runMs,30*MIN); assert.strictEqual(rut.qty.done,96); assert.strictEqual(rut.operatorsLedger.join(),'Anh Cường');
assert.strictEqual(db.state,'missing'); assert.strictEqual(cat.state,'missing'); assert.strictEqual(db.runMs,null); assert.strictEqual(db.machineIds.length,0); assert.strictEqual(db.operatorsLedger.length,0);
ok('TEST 6b: Đùn (2 máy, 90p, SL vào/ra từ Sổ đùn) & Rút (96 thanh) đủ; Đánh bóng/Cắt không có dữ liệu → "missing", KHÔNG bịa máy/giờ/người');
assert.strictEqual(m.machineChanges.length,1); const mc=m.machineChanges[0]; assert.strictEqual(mc.from,'m_tj500_1'); assert.strictEqual(mc.to,'m_tj550_2'); assert.strictEqual(mc.viaPause,true); assert.strictEqual(mc.by,'Tuấn');
assert.strictEqual(m.runTable.length,3); assert.strictEqual(m.runTable.map(r=>r.machineId).join(),'m_tj500_1,m_tj550_2,m_rut100_1'); assert.strictEqual(m.runTable.map(r=>r.no).join(),'1,2,3'); assert.strictEqual(m.runTable.map(r=>r.runMs/MIN).join(),'30,60,30');
assert.strictEqual(m.pauses.length,1); assert.strictEqual(m.pauses[0].reason,'Máy hỏng / sự cố'); assert.strictEqual(m.pauses[0].pausedMs,30*MIN); assert.strictEqual(m.pauses[0].resumeAt,T0+60*MIN);
ok('TEST 5/6: TJ550(1) → tạm dừng → TJ550(2) → Rút: bảng Lần/Công đoạn/Máy/Bắt đầu/Kết thúc/Thời gian chạy/Người; lịch sử đổi máy; lịch sử tạm dừng đủ');
assert.strictEqual(m.qc.items.length,1); assert.strictEqual(m.qc.items[0].code,'FQC-001'); assert.strictEqual(m.qc.result,'OK'); assert.strictEqual(m.qc.items[0].inspector,'QC Hà');
assert(!m.qc.items.some(i=>i.code==='FQC-X'||i.code==='NCR-PO'),'phiếu QC của đơn khác / chỉ trùng PO không bị gắn nhầm'); assert(!m.stages[0].ledgerRows||dun.ledgerRows===1,'dòng sổ của đơn X (cùng KH+PO) không bị lẫn');
ok('Liên kết theo ID đơn: đơn X trùng tên KH + PO không bị lẫn dòng Sổ máy / phiếu QC / QR');
assert(m.gaps.some(g=>/ĐÁNH BÓNG/.test(g))&&m.gaps.some(g=>/CẮT/.test(g))); ok('Danh sách "dữ liệu chưa ghi nhận" nêu đúng Đánh bóng & Cắt');

// ── Giao diện ──
run(`_thId='A'; thEnsureModal(); thRender()`); const html=reg.thBody.innerHTML;
['Thông tin tổng quan','CÔNG ĐOẠN 1 – ĐÙN','CÔNG ĐOẠN 2 – RÚT','CÔNG ĐOẠN 3 – ĐÁNH BÓNG','CÔNG ĐOẠN 4 – CẮT','CÔNG ĐOẠN 5 – KIỂM TRA CHẤT LƯỢNG','HOÀN THÀNH','TC-18-001','C1100','02:00:00','Máy đùn TJ550 (1) → Máy đùn TJ550 (2)','Máy hỏng / sự cố','FQC-001','Lịch sử thay đổi máy','is-done','is-missing','CHƯA CÓ DỮ LIỆU','Người vận hành']
 .forEach(s=>assert(html.includes(s),'UI thiếu: '+s));
assert(!html.includes('Người lạ')&&!html.includes('999')); ok('Giao diện: đủ 5 khối công đoạn + hoàn thành, timeline màu trạng thái, bảng phiên chạy, lịch sử đổi máy/tạm dừng, nhãn CHƯA CÓ DỮ LIỆU');
const sh=run(`thSheets(_thModel)`); assert.strictEqual(sh.runs.length,4); assert.strictEqual(sh.pauses.length,2); assert(sh.stages.length>=6); assert.strictEqual(sh.overview.find(r=>r[0]==='Tổng thời gian chạy thực tế')[1],'02:00:00'); ok('Dữ liệu xuất Excel: 4 trang (tổng quan, công đoạn, phiên chạy, tạm dừng) khớp mô hình');

// ── TEST 8: đơn cũ chưa có dữ liệu lịch sử ──
run(`DB.orders=[${J({id:'L1',customer:'Cũ 1',po:'OLD-1',qty:50,doneQty:50,status:'done',startedAt:T0,doneAt:T0+8*HOUR,stage:'danhbong',machineAssign:{dun:'m_tj500_1',rut:'m_rut50'},machineHistory:{dun:{machineId:'m_tj500_1',startAt:T0,endAt:T0+3*HOUR}}})},
  ${J({id:'L2',customer:'Cũ 2',po:'OLD-2',status:'done',qty:5})}]`);
const l1=run(`thBuild('L1')`);
assert.strictEqual(l1.overview.runSource,'legacy'); assert.strictEqual(l1.overview.runMs,8*HOUR); assert(l1.gaps.some(g=>/hoàn thành trước khi có tính năng tạm dừng/.test(g)));
assert.strictEqual(l1.stages[0].source,'history'); assert.strictEqual(l1.stages[0].runMs,null,'đơn cũ: KHÔNG tự suy ra thời gian chạy của công đoạn'); assert.strictEqual(l1.stages[0].spanMs,3*HOUR); assert.strictEqual(l1.stages[0].actors.length,0);
assert.strictEqual(l1.stages[1].source,'assigned'); assert.strictEqual(l1.stages[1].state,'missing'); assert.strictEqual(l1.stages[1].machineIds.length,0,'chỉ phân công ≠ máy đã chạy'); assert.strictEqual(l1.stages[1].assignedMachineId,'m_rut50');
assert.strictEqual(l1.runTable.length,0); assert.strictEqual(l1.legacyRows.length,1); assert.strictEqual(l1.legacyRows[0].runMs,null); assert.strictEqual(l1.legacyRows[0].by,''); assert.strictEqual(l1.pauses.length,0);
const l2=run(`thBuild('L2')`); assert(l2.stages.every(s=>s.state==='missing'&&s.machineIds.length===0&&s.runMs===null&&s.actors.length===0)); assert.strictEqual(l2.runTable.length+l2.legacyRows.length,0); assert.strictEqual(l2.overview.runMs,0);
run(`_thId='L1'; thRender()`); let h1=reg.thBody.innerHTML; assert(h1.includes('CHƯA CÓ DỮ LIỆU')&&h1.includes('chỉ phân công, chưa xác nhận đã chạy')&&h1.includes('không phải giờ chạy thực'));
run(`_thId='L2'; thRender()`); assert(reg.thBody.innerHTML.includes('CHƯA CÓ DỮ LIỆU')); assert.strictEqual(run(`thBuild('khong-co')`),null);
ok('TEST 8: đơn cũ — xem được thông tin đơn; máy cũ chỉ có mốc giờ → thời gian chạy "CHƯA CÓ DỮ LIỆU"; chỉ phân công không bị coi là đã chạy; đơn trống không phát sinh dữ liệu giả');

// ── TEST 10 (v2.14.1): máy theo phân máy ở Kế hoạch SX hiện trong Hành trình công đoạn ──
run(`DB.orders=[${J({id:'P1',customer:'KH P',po:'PO-P',qty:10,status:'done',startedAt:T0,doneAt:T0+5*HOUR,stage:'danhbong',
  machineAssign:{rut:'m_rut50',danhbong:'m_danhbong_2'},
  machineHistory:{dun:{machineId:'m_tj400',startAt:T0,endAt:T0+2*HOUR}}})}]`);
const p1=run(`thBuild('P1')`);
assert.strictEqual(p1.stages[0].plan.machineId,'m_tj400'); assert.strictEqual(p1.stages[0].plan.via,'history');
assert.strictEqual(p1.stages[1].plan.machineId,'m_rut50'); assert.strictEqual(p1.stages[1].plan.via,'assign');
assert.strictEqual(p1.stages[2].plan.machineId,'m_danhbong_2'); assert.strictEqual(p1.stages[3].plan,null,'công đoạn chưa phân máy → null, không đoán');
assert.strictEqual(p1.routing.map(r=>r.machineId).join(),'m_tj400,m_rut50,m_danhbong_2,');
run(`_thId='P1'; thRender()`); const hp=reg.thBody.innerHTML;
['Máy theo Kế hoạch SX (phân máy)','Máy đùn TJ400','Máy rút 50','Máy đánh bóng - 2','Kế hoạch SX chưa phân máy','đã lưu vết khi đơn đi qua công đoạn','đang gán trong Kế hoạch SX','🗂 Kế hoạch: Máy rút 50']
  .forEach(x=>assert(hp.includes(x),'UI thiếu: '+x));
const shp=run(`thSheets(_thModel)`); assert(shp.stages[0].includes('Máy theo Kế hoạch SX (phân máy)')); assert(shp.stages.every(r=>r.length===shp.stages[0].length),'mọi dòng sheet công đoạn cùng số cột');
// máy thực tế khác máy phân công → cảnh báo, không im lặng
run(`DB.orders=[${J({id:'P2',customer:'KH Q',po:'PO-Q',qty:10,status:'pending',machineAssign:{dun:'m_tj300'}})}]`);
setT(T0); run(`setStatus('P2','running')`); setT(T0+HOUR); run(`DB.orders[0].machineAssign.dun='m_tj400'`); setT(T0+2*HOUR); run(`setStatus('P2','done')`);
const p2=run(`thBuild('P2')`); assert.strictEqual(p2.stages[0].plan.machineId,'m_tj400'); assert.strictEqual(p2.stages[0].planDiff,true); assert(p2.gaps.some(g=>/phân máy .* nhưng phiên chạy ghi/.test(g)));
run(`DB.orders[0].machineAssign.dun='m_tj300'`); assert.strictEqual(run(`thBuild('P2')`).stages[0].planDiff,false);
ok('TEST 10: Hành trình công đoạn đọc máy từ phân máy Kế hoạch SX (machineAssign + machineHistory), công đoạn chưa phân → trống, lệch máy thực tế → cảnh báo, Excel thêm cột khớp');

// ── TEST 9: cơ chế lưu trữ / dọn đơn hoàn thành KHÔNG đổi ──
const fnBody=(src,name)=>{ const s=src.indexOf(name); let d=0,i=src.indexOf('{',s),j=i; for(;j<src.length;j++){ if(src[j]==='{')d++; else if(src[j]==='}'){ d--; if(!d) break; } } return src.slice(s,j+1); };
const origPath='/tmp/orig/dongphuong-main/src/modules/orders/orders-service.js';
if(fs.existsSync(origPath)){
  const o=fs.readFileSync(origPath,'utf8'), c=rd('src/modules/orders/orders-service.js');
  ['async function autoCleanupDoneOrders','function shouldAutoClean','function autoCleanLastRun','async function dailyAutoClean'].forEach(fn=>{ if(o.includes(fn)) assert.strictEqual(fnBody(c,fn),fnBody(o,fn),fn+' bị thay đổi'); });
  assert(c.includes('const AUTOCLEAN_MIN_INTERVAL_MS = 24*60*60*1000;'));
  const oq=fs.readFileSync('/tmp/orig/dongphuong-main/src/modules/quality/quality-view.js','utf8'), cq=rd('src/modules/quality/quality-view.js');
  const keep=s=>s.split('\n').filter(l=>/(HT_PURGE_WARN_DAYS|AUTOCLEAN_DAYS|purgeAt|function htIsExpiringSoon|function htPurgeDaysLeft)/.test(l)).join('\n');
  assert(keep(oq).length>50,'bộ lọc phải bắt được logic thời hạn'); assert.strictEqual(keep(cq),keep(oq),'logic thời hạn lưu trữ ở quality-view bị đổi');
  const oc=fs.readFileSync('/tmp/orig/dongphuong-main/src/core/constants.js','utf8'), cc=rd('src/core/constants.js'); assert.strictEqual(keep(cc),keep(oc)); assert(keep(c).includes('AUTOCLEAN_DAYS = 30'),'AUTOCLEAN_DAYS vẫn = 30');
  assert.strictEqual(keep(c),keep(o),'orders-service: thời hạn dọn bị đổi');
  ok('TEST 9: autoCleanupDoneOrders và thời hạn lưu trữ/dọn đơn hoàn thành giữ NGUYÊN so với bản gốc (so khớp từng ký tự)');
} else { console.log('(bỏ qua so khớp bản gốc: không có /tmp/orig)'); }
console.log('\ntrace-history.test: '+n+' nhóm kiểm tra đạt');
})().catch(e=>{ console.error('✗',e.stack||e); process.exit(1); });
