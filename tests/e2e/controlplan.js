#!/usr/bin/env node
// KIỂM THỬ CONTROLPLAN qua giao diện thật (Firebase giả có SSE).  node controlplan.js <thư-mục-gốc-web> <thư-mục-xuất>
// Mỗi mục kiểm thử ghi PASS/FAIL; thoát mã 1 nếu có FAIL. Kết quả: <xuất>/controlplan-results.json
const fs=require('fs'), path=require('path');
const { chromium } = require('playwright');
const { MockDb, startServer, stubExternal, FB_PREFIX } = require('./mock-firebase');
const { seedData } = require('./seed');
const root=path.resolve(process.argv[2]||'.'), out=path.resolve(process.argv[3]||'/tmp/cp-out'); fs.mkdirSync(out,{recursive:true});
const R=[]; let fails=0;
const T=(sec,name,ok,info)=>{ R.push({sec,name,ok:!!ok,info:info===undefined?'':info}); if(!ok) fails++; console.log((ok?'  PASS ':'  FAIL ')+sec+' · '+name+(info!==undefined&&info!==''?'  → '+JSON.stringify(info):'')); };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function device(browser, port, vp){
  const ctx=await browser.newContext({viewport:vp||{width:1440,height:900}, serviceWorkers:'block', locale:'vi-VN', timezoneId:'Asia/Ho_Chi_Minh', acceptDownloads:true});
  await stubExternal(ctx);
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/exceljs/, r=>r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync('/tmp/xl/node_modules/exceljs/dist/exceljs.min.js','utf8')}));
  await ctx.addInitScript(({u})=>{ try{ if(!localStorage.getItem('sx_fb_url')) localStorage.setItem('sx_fb_url',u); }catch(e){} },{u:`http://127.0.0.1:${port}${FB_PREFIX}`});
  const page=await ctx.newPage(), errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('dialog',d=>d.accept().catch(()=>{}));
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load'}); await page.waitForTimeout(500);
  return {ctx,page,errs};
}
async function login(page,u,p){ await page.fill('#lu',u); await page.fill('#lp',p); await page.click('#loginBtn'); await page.waitForTimeout(1800); }
const ev=(p,f,a)=>p.evaluate(f,a);

(async()=>{
  const browser=await chromium.launch();
  const db=new MockDb(seedData), {server,port}=await startServer(root,db);
  const A=await device(browser,port); const pg=A.page;
  await login(pg,'admin','admin123');

  // ── 1. Mở tab / thẻ biểu mẫu / không lỗi JS
  await ev(pg,()=>goTab('controlPlan')); await pg.waitForTimeout(500);
  T('1 Tab','tab ControlPlan hiển thị', await ev(pg,()=>!!document.querySelector('#cpRoot')));
  T('1 Tab','có mục menu Chất lượng', await ev(pg,()=>!!document.getElementById('sbi-controlPlan')));
  T('1 Tab','13 thẻ biểu mẫu', (await ev(pg,()=>document.querySelectorAll('.cp-card').length))===13, await ev(pg,()=>document.querySelectorAll('.cp-card').length));
  T('1 Tab','4 nhóm A-D', (await ev(pg,()=>document.querySelectorAll('.cp-group').length))===4);
  T('1 Tab','không lỗi JS khi mở', A.errs.length===0, A.errs);

  // ── 2. Nhập Excel (idempotent)
  await ev(pg,()=>cpGo('admin'));
  const before=await ev(pg,()=>cpRecs().length);
  await ev(pg,()=>cpImportRun());
  for(let i=0;i<60;i++){ await sleep(1000); if(await ev(pg,()=>!(cpUI.imp&&cpUI.imp.busy))) break; }
  const log1=await ev(pg,()=>cpUI.imp.log.join('\n')); fs.writeFileSync(path.join(out,'import-run1.log'),log1);
  const cnt=await ev(pg,()=>{ const c={}; cpRecs().forEach(r=>{ if(r.type==='chk'&&r.source==='excel') c[r.form]=(c[r.form]||0)+1; }); return c; });
  T('3 Import','số phiếu theo sheet khớp báo cáo', cnt.dun===169&&cnt.rut===748&&cnt.danhbong===478&&cnt.cat===189&&cnt.dothang===142, cnt);
  const srvKeys=Object.keys(db.get('/data/cpRecords')||{});
  T('3 Import','máy chủ có đủ bản ghi', srvKeys.filter(k=>k.startsWith('cpx-chk-')).length===1726, srvKeys.length);
  T('3 Import','nhật ký nhập ok', await ev(pg,()=>cpOf('importLog').length===1&&cpOf('importLog')[0].ok===true), log1.split('\n').slice(-3));
  T('3 Import','danh mục: CP 13 / PFMEA 7 / mã lỗi 13 / AQL 1', await ev(pg,()=>cpOf('cp').length===13&&cpOf('pfmea').length===7&&cpOf('defect').length===13&&cpOf('aql').length===1));
  const total1=await ev(pg,()=>cpRecs().length);
  // chạy lại: không thêm gì
  await ev(pg,()=>cpImportRun()); for(let i=0;i<60;i++){ await sleep(1000); if(await ev(pg,()=>!(cpUI.imp&&cpUI.imp.busy))) break; }
  const total2=await ev(pg,()=>cpRecs().length);
  T('3 Import','chạy lại không trùng/không thêm (idempotent)', total2===total1+1 /* +1 importLog */, [total1,total2]);
  T('3 Import','số bản ghi chk trên máy chủ không đổi sau chạy lại', Object.keys(db.get('/data/cpRecords')||{}).filter(k=>k.startsWith('cpx-chk-')).length===1726);
  // không ghi đè bản đã sửa: sửa 1 phiếu lịch sử rồi nhập lại
  const sampleId='cpx-chk-dun-r5';
  await ev(pg,(id)=>{ const r=cpClone(cpGet(id)); r.inspector='NGƯỜI SỬA'; cpPut(r,{act:'test sửa',reason:'kiểm thử'}); },sampleId); await pg.waitForTimeout(800);
  await ev(pg,()=>cpImportRun()); for(let i=0;i<60;i++){ await sleep(1000); if(await ev(pg,()=>!(cpUI.imp&&cpUI.imp.busy))) break; }
  T('3 Import','nhập lại không ghi đè phiếu đã sửa', await ev(pg,(id)=>cpGet(id).inspector==='NGƯỜI SỬA',sampleId));
  T('3 Import','phiếu Excel gắn nhãn nguồn + vị trí gốc', await ev(pg,(id)=>{ const r=cpGet(id); return r.source==='excel'&&r.src.sheet==='Check_Dun'&&r.src.row===5; },sampleId));
  T('3 Import','dữ liệu lạ không bị suy diễn (UNK giữ dạng gốc)', await ev(pg,()=>{ const r=cpRecs().find(x=>x.type==='chk'&&x.form==='cat'&&x.lines.some(l=>l.result==='UNK'&&l.resultRaw)); return !!r&&r.review.length>0&&r.lines.find(l=>l.result==='UNK').resultRaw!==''; }));

  // ── 4. Dashboard / lọc
  await ev(pg,()=>cpGo('home')); await pg.waitForTimeout(300);
  const K=await ev(pg,()=>cpKpis({}));
  T('2 Dashboard','KPI tổng = số phiếu đã nhập', K.total===1726, K);
  T('2 Dashboard','KPI OK+NG+UNK = tổng', K.ok+K.ng+K.unk===K.total, K);
  const Kd=await ev(pg,()=>cpKpis({stage:'dun'}));
  T('2 Dashboard','lọc theo công đoạn Đùn', Kd.total===169, Kd.total);
  const Kr=await ev(pg,()=>cpKpis({from:'2026-10-01',to:'2026-10-31',result:'NG'}));
  T('2 Dashboard','lọc ngày + OK/NG', Kr.ng===Kr.total, Kr);
  T('2 Dashboard','lọc theo khách hàng (gộp hoa/thường)', await ev(pg,()=>{ const c=cpCustomers(); return c.length>0 && cpKpis({customer:c[0].key}).total>0; }));
  T('2 Dashboard','không lỗi JS', A.errs.length===0, A.errs);

  // ── 5. Phiếu mới: kiểm tra dữ liệu / lưu nháp / hoàn tất
  await ev(pg,()=>{ cpGo('list','dun'); cpNew('dun'); });
  const pre=await ev(pg,()=>({date:cpUI.ed.rec.date,insp:cpUI.ed.rec.inspector,shift:cpUI.ed.rec.shift,hm:cpUI.ed.rec.lines[0].time}));
  T('4 Phiếu','tự điền ngày/nhân viên/ca/giờ', pre.date&&pre.insp&&pre.shift&&pre.hm, pre);
  await ev(pg,()=>cpSave(true)); await pg.waitForTimeout(200);
  T('4 Phiếu','chặn hoàn tất khi thiếu dữ liệu', await ev(pg,()=>cpUI.ed!==null&&Object.keys(cpUI.ed.errs).length>0), await ev(pg,()=>Object.keys(cpUI.ed.errs)));
  await ev(pg,()=>{ const e=cpUI.ed.rec; e.spec='10*60'; e.customer='Kiểm Thử'; e.lines[0].thick='11.5'; e.lines[0].width='abc'; cpEdValidateUI(); });
  T('4 Phiếu','báo lỗi ngay khi nhập chữ vào ô số', await ev(pg,()=>!!cpUI.ed.errs['lines.0.width']));
  await ev(pg,()=>{ cpUI.ed.rec.lines[0].width='61,01'; cpUI.ed.rec.lines[0].result='OK'; cpEdValidateUI(); });
  T('4 Phiếu','chấp nhận số thập phân dấu phẩy', await ev(pg,()=>!cpUI.ed.errs['lines.0.width']));
  await ev(pg,()=>{ cpAddLine(); cpUI.ed.rec.lines[1].thick='11.4'; cpUI.ed.rec.lines[1].width='61'; cpUI.ed.rec.lines[1].result='OK'; });
  T('4 Phiếu','nhiều dòng đo trên 1 phiếu', await ev(pg,()=>cpUI.ed.rec.lines.length===2));
  await ev(pg,()=>cpSave(false)); await pg.waitForTimeout(200);
  const draftId=await ev(pg,()=>cpUI.ed&&cpUI.ed.rec.id);
  T('4 Phiếu','lưu nháp', await ev(pg,(id)=>cpGet(id)&&cpGet(id).status==='draft',draftId));
  T('4 Phiếu','nháp không tính vào KPI', (await ev(pg,()=>cpKpis({}).total))===1726);
  await ev(pg,()=>cpSave(true)); await pg.waitForTimeout(300);
  T('4 Phiếu','hoàn tất: có mã phiếu tự cấp + kết luận OK', await ev(pg,(id)=>{ const r=cpGet(id); return r.status==='done'&&/^DUN-\d{6}-\d{3}$/.test(r.code)&&r.result==='OK'&&r.source==='app'; },draftId), await ev(pg,(id)=>cpGet(id).code,draftId));
  T('4 Phiếu','nhật ký thay đổi trên phiếu', await ev(pg,(id)=>cpGet(id).hist.length>=2&&cpGet(id).createdBy,draftId));
  T('4 Phiếu','chưa liên kết đơn → CHƯA XÁC ĐỊNH (không tự ghép)', await ev(pg,(id)=>cpLinkStatus(cpGet(id)).t==='CHƯA XÁC ĐỊNH',draftId));
  // sửa phiếu đã hoàn tất cần lý do
  await ev(pg,(id)=>{ cpGo('list','dun'); cpOpen(id); },draftId);
  T('4 Phiếu','phiếu đã hoàn tất mở ở chế độ chỉ đọc', await ev(pg,()=>cpUI.ed.ro===true));
  await ev(pg,()=>{ cpUI.ed.ro=false; cpUI.ed.rec.spec='10*61'; cpEdRender(); cpSave(true); });
  T('4 Phiếu','sửa phiếu hoàn tất bắt buộc lý do', await ev(pg,(id)=>cpGet(id).spec==='10*60',draftId));
  await ev(pg,()=>{ cpUI.ed.reason='đo sai quy cách'; cpSave(true); }); await pg.waitForTimeout(200);
  T('4 Phiếu','sửa có lý do → ghi nhật ký', await ev(pg,(id)=>{ const h=cpGet(id).hist; const l=h[h.length-1]; return cpGet(id).spec==='10*61'&&l.reason==='đo sai quy cách'&&l.ch.length>0; },draftId));

  // ── 6. Quy trình NG
  await ev(pg,()=>{ cpGo('list','rut'); cpNew('rut'); const e=cpUI.ed.rec; e.spec='5*30'; e.customer='Kiểm Thử'; e.lot='06112026'; e.lines[0].thick='5.1'; e.lines[0].width='30'; e.lines[0].length='4000'; e.lines[0].appearance='NG-01'; e.lines[0].result='NG'; e.lines[0].qtyNG='12'; cpEdValidateUI(); });
  T('5 NG','NG có mã lỗi → hợp lệ & kết luận NG', await ev(pg,()=>!cpUI.ed.errs['lines.0.appearance']&&cpUI.ed.rec.result==='NG'));
  await ev(pg,()=>cpSave(true)); await pg.waitForTimeout(400);
  T('5 NG','hộp thoại NG tự hiện', await ev(pg,()=>!!document.getElementById('cpMod')&&document.querySelector('#cpMod h3').textContent.includes('NG')));
  await ev(pg,()=>{ document.getElementById('ngQty').value=''; cpNgConfirm(cpRecs().find(r=>r.type==='chk'&&r.form==='rut'&&r.result==='NG'&&r.source==='app').id); });
  T('5 NG','bắt buộc nhập số lượng ảnh hưởng', await ev(pg,()=>!!document.getElementById('cpMod')&&document.getElementById('ngErr').textContent!==''));
  await ev(pg,()=>{ document.getElementById('ngQty').value='12'; document.getElementById('ngNcr').checked=true; document.getElementById('ng8d').checked=true; cpNgConfirm(cpRecs().find(r=>r.type==='chk'&&r.form==='rut'&&r.result==='NG'&&r.source==='app').id); });
  const ngSt=await ev(pg,()=>{ const s=cpRecs().find(r=>r.type==='chk'&&r.form==='rut'&&r.source==='app'); const h=cpGet(s.ngFollow.holdId), n=cpGet(s.ngFollow.ncrId), d=cpGet(s.ngFollow.eightdId); return {hold:h&&h.status, holdLot:h&&h.lot, ncr:n&&n.status, ncrNo:n&&n.code, ncrCause:n&&n.cause, d8:d&&d.steps.length, link:h.ncrId===n.id&&n.eightdId===d.id, qty:n.qtyAffected}; });
  T('5 NG','tự tạo HOLD + NCR + 8D, liên kết nhau', ngSt.hold==='HOLD'&&ngSt.ncr==='Mở'&&ngSt.d8===9&&ngSt.link&&ngSt.qty===12, ngSt);
  T('5 NG','NCR tự cấp số, KHÔNG tự điền nguyên nhân', /^NCR-\d{4}-\d{3}$/.test(ngSt.ncrNo)&&ngSt.ncrCause==='', ngSt);
  T('5 NG','phiếu NG không bị tự đổi thành OK', await ev(pg,()=>cpRecs().find(r=>r.type==='chk'&&r.form==='rut'&&r.source==='app').result==='NG'));

  // ── 7. HOLD / RELEASE: điều kiện & phân quyền
  const holdId=await ev(pg,()=>cpOf('hold')[0].id);
  await ev(pg,(id)=>{ const h=cpClone(cpGet(id)); h.status='Chờ phê duyệt'; h.investigation='Do khuôn mòn'; h.disposition='RELEASE – giải phóng'; cpPut(h,{act:'test'}); },holdId);
  T('6 HOLD','RELEASE bị chặn khi chưa có phiếu kiểm tra lại đạt', await ev(pg,(id)=>cpHoldReleaseCheck(cpGet(id)).some(x=>/kiểm tra lại/.test(x)),holdId), await ev(pg,(id)=>cpHoldReleaseCheck(cpGet(id)),holdId));
  // tạo phiếu kiểm tra lại đạt cùng lô rồi gắn
  await ev(pg,()=>{ cpNew('rut'); const e=cpUI.ed.rec; e.spec='5*30'; e.customer='Kiểm Thử'; e.lot='06112026'; e.lines[0].thick='5'; e.lines[0].width='30'; e.lines[0].length='4000'; e.lines[0].result='OK'; cpSave(true); }); await pg.waitForTimeout(300);
  await ev(pg,(id)=>{ const h=cpClone(cpGet(id)); h.heldAt=Date.now()-3600000; const v=cpVerifyCandidates(h); h.verifyId=v.length?v[0].id:''; cpPut(h,{act:'gắn kiểm tra lại'}); },holdId);
  const chkAfter=await ev(pg,(id)=>cpHoldReleaseCheck(cpGet(id)),holdId);
  T('6 HOLD','có phiếu OK cùng lô → chỉ còn điều kiện NCR chưa đóng', chkAfter.length===1&&/NCR/.test(chkAfter[0]), chkAfter);
  // nhân viên không được RELEASE
  await ev(pg,()=>{ window._admin=currentUser; currentUser=Object.assign({},currentUser,{role:'staff',qcRole:'qc'}); });
  T('6 HOLD','nhân viên không có quyền RELEASE', await ev(pg,()=>!cpCan('approve')&&cpRole()==='qc'));
  await ev(pg,(id)=>{ cpGo('list','hold'); cpOpen(id); cpHoldAct('release'); },holdId);
  T('6 HOLD','QC tự RELEASE → bị từ chối', await ev(pg,(id)=>cpGet(id).status==='Chờ phê duyệt',holdId));
  T('6 HOLD','tài khoản đặt "Chỉ xem" không nhập được', await ev(pg,()=>{ currentUser=Object.assign({},window._admin,{role:'staff',qcRole:'prod'}); return cpRole()==='prod'&&!cpCan('create'); }));
  await ev(pg,()=>{ currentUser=Object.assign({},window._admin,{role:'staff',qcRole:'qa'}); });
  // đóng NCR trước (qa)
  await ev(pg,(id)=>{ const n=cpClone(cpGet(cpGet(id).ncrId)); n.status='Chờ phê duyệt'; n.cause='Khuôn mòn (người điều tra)'; n.action='Thay khuôn'; n.disposition='Phế phẩm'; n.klass='Major'; n.verification='Đã kiểm tra'; n.verifiedBy='QA'; cpPut(n,{act:'test'}); cpOpen(n.id); cpNcrAct('approve'); },holdId);
  T('6 HOLD','QA phê duyệt & đóng NCR', await ev(pg,(id)=>cpGet(cpGet(id).ncrId).status==='Đã đóng'&&!!cpGet(cpGet(id).ncrId).approvedBy,holdId));
  await ev(pg,(id)=>{ cpGo('list','hold'); cpOpen(id); cpHoldAct('release'); },holdId);
  T('6 HOLD','QA RELEASE khi đủ điều kiện', await ev(pg,(id)=>{ const h=cpGet(id); return h.status==='RELEASE'&&!!h.releaseBy&&!!h.releaseAt; },holdId));
  await ev(pg,()=>{ currentUser=window._admin; });

  // ── 8. 8D
  const d8Id=await ev(pg,()=>cpOf('eightd')[0].id);
  T('7 8D','9 bước D0–D8 có đủ trường', await ev(pg,(id)=>{ const d=cpGet(id); return d.steps.map(s=>s.step).join()==='D0,D1,D2,D3,D4,D5,D6,D7,D8'&&'owner' in d.steps[0]&&'due' in d.steps[0]&&'evidence' in d.steps[0]&&'status' in d.steps[0]; },d8Id));
  await ev(pg,(id)=>{ cpGo('list','eightd'); cpOpen(id); cpEightdClose(); },d8Id);
  T('7 8D','không đóng khi chưa xong các bước', await ev(pg,(id)=>cpGet(id).status!=='Đã đóng',d8Id));
  await ev(pg,(id)=>{ const d=cpClone(cpGet(id)); d.steps[0].due='2020-01-01'; cpPut(d,{act:'t'}); },d8Id);
  T('7 8D','bước quá hạn được đếm', await ev(pg,(id)=>cp8dProgress(cpGet(id)).late>=1,d8Id));

  // ── 9. FQC & AQL
  const lk=await ev(pg,()=>cpAqlLookup(500,'II','1','2.5',''));
  T('8 AQL','tra theo bảng workbook (lô 500)', lk.ok&&lk.n>0&&lk.major&&typeof lk.major.ac==='number', lk);
  T('8 AQL','Level khác II → cảnh báo, không suy diễn', await ev(pg,()=>{ const x=cpAqlLookup(500,'III','1','2.5',''); return !x.ok&&x.errors.some(e=>/Level/.test(e)); }));
  T('8 AQL','lô ngoài bảng → báo lỗi', await ev(pg,()=>!cpAqlLookup(0,'II','1.0','','').ok));
  T('8 AQL','Critical không chọn AQL → không chấp nhận lỗi nào', await ev(pg,()=>{ const l=cpAqlLookup(500,'II','1','2.5',''); return cpAqlEvaluate(l,0,0,1).result==='NG'&&cpAqlEvaluate(l,0,0,0).result==='OK'; }));
  await ev(pg,(a)=>{ cpGo('list','fqc'); cpNew('fqc'); const e=cpUI.ed.rec; e.lotQty='500'; e.aqlMajor='1'; e.aqlMinor='2.5'; e.customer='Kiểm Thử'; e.lot='06112026'; e.majorNG='9'; e.minorNG='0'; e.criticalNG='0'; cpEdDerive('majorNG'); cpEdValidateUI(); });
  T('9 FQC','kết luận tự tính từ AQL (NG khi vượt Ac)', await ev(pg,()=>cpUI.ed.rec.result==='NG'), await ev(pg,()=>({n:cpUI.ed.rec.sampleSize,ac:cpUI.ed.rec.acMajor,res:cpUI.ed.rec.result})));
  await ev(pg,()=>{ cpUI.ed.rec.majorNG='0'; cpEdDerive('majorNG'); });
  T('9 FQC','đạt khi số lỗi ≤ Ac', await ev(pg,()=>cpUI.ed.rec.result==='OK'));
  await ev(pg,()=>{ cpUI.ed.rec.majorNG='9999'; cpEdValidateUI(); });
  T('9 FQC','số lỗi lớn hơn cỡ mẫu bị báo lỗi', await ev(pg,()=>!!cpUI.ed.errs.majorNG));
  await ev(pg,()=>{ cpUI.ed.rec.majorNG='0'; cpEdDerive('majorNG'); cpSave(true); }); await pg.waitForTimeout(300);
  T('9 FQC','lưu FQC đạt', await ev(pg,()=>cpRecs().some(r=>r.type==='fqc'&&r.status==='done'&&r.result==='OK'&&/^FQC-/.test(r.code))));

  // ── 10. Danh mục: mã lỗi, PFMEA, Control Plan
  T('10 Danh mục','13 mã lỗi, mã lỗi tự điền tiêu chuẩn/phản ứng', await ev(pg,()=>{ const d=cpDefect('NG-01'); return cpDefects().length===13&&d.name&&d.accept&&d.reaction; }));
  T('10 Danh mục','PFMEA RPN = S×O×D', await ev(pg,()=>cpPfmea().every(p=>cpRpn(p)===p.S*p.O*p.D)), await ev(pg,()=>cpPfmea().map(p=>cpRpn(p))));
  T('10 Danh mục','RPN rỗng khi thiếu S/O/D (không tự bịa)', await ev(pg,()=>cpRpn({S:5,O:null,D:3})===null));
  await ev(pg,()=>cpGo('cp')); T('10 Danh mục','Control Plan có nút mở đúng phiếu', await ev(pg,()=>document.querySelectorAll('#cpRoot button[onclick*="cpOpenForm"]').length>=8));
  await ev(pg,()=>{ cpGo('pfmea'); cpGo('aql'); cpGo('defects'); cpGo('reports'); cpGo('review'); cpGo('admin'); cpGo('home'); });
  T('10 Danh mục','mọi màn hình danh mục/báo cáo vẽ được không lỗi', A.errs.length===0, A.errs);

  // ── 11. Báo cáo
  const rp=await ev(pg,()=>{ const D=cpReportData({}); return {stage:D.stage.length,tot:D.stage.reduce((a,s)=>a+s.n,0),cust:D.customer.length,def:D.defect.length,ins:D.inspector.length,hold:D.holdAll,late:D.d8Late.length}; });
  T('11 Báo cáo','tổng theo công đoạn = tổng phiếu', rp.tot===(await ev(pg,()=>cpKpis({}).total)), rp);
  T('11 Báo cáo','có thống kê khách hàng/mã lỗi/nhân viên/HOLD/8D quá hạn', rp.cust>0&&rp.def>0&&rp.ins>0&&rp.hold>=1&&rp.late>=1);
  await ev(pg,()=>cpGo('reports')); await pg.waitForTimeout(200);
  const dl=pg.waitForEvent('download',{timeout:20000}).catch(()=>null);
  await ev(pg,()=>cpReportXlsx()); const d=await dl;
  T('11 Báo cáo','xuất Excel', !!d&&/\.xlsx$/.test(d.suggestedFilename()), d&&d.suggestedFilename());
  const pop=pg.waitForEvent('popup',{timeout:8000}).catch(()=>null); await ev(pg,()=>cpReportPdf()); const pp=await pop; T('11 Báo cáo','xuất PDF (cửa sổ in)', !!pp); if(pp) await pp.close();

  // ── 12. Đồng bộ nhiều thiết bị + ngoại tuyến
  const B=await device(browser,port,{width:820,height:1180}); await login(B.page,'admin','admin123'); await B.page.evaluate(()=>goTab('controlPlan')); await B.page.waitForTimeout(1500);
  const bCount=await ev(B.page,()=>cpRecs().length), aCount=await ev(pg,()=>cpRecs().length);
  T('12 Đồng bộ','thiết bị B nhận đủ dữ liệu từ máy chủ', bCount>=aCount-1&&bCount>1700, [aCount,bCount]);
  await ev(pg,()=>{ cpGo('list','dothang'); cpNew('dothang'); const e=cpUI.ed.rec; e.spec='Ø71'; e.customer='Đồng bộ'; ['edge','face','warp','twist'].forEach(k=>e.lines[0][k]='Đạt'); e.lines[0].result='OK'; cpSave(true); }); await sleep(2500);
  T('12 Đồng bộ','phiếu mới ở A hiện trên B (realtime)', await ev(B.page,()=>cpRecs().some(r=>r.type==='chk'&&r.form==='dothang'&&r.customer==='Đồng bộ')));
  T('12 Đồng bộ','B giao diện tablet không tràn ngang', await ev(B.page,()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2));
  // ngoại tuyến
  await B.ctx.setOffline(true);
  await ev(B.page,()=>{ cpGo('list','dun'); cpNew('dun'); const e=cpUI.ed.rec; e.spec='8*40'; e.customer='Ngoại tuyến'; e.lines[0].thick='8'; e.lines[0].width='40'; e.lines[0].result='OK'; cpSave(true); }); await sleep(1500);
  T('12 Đồng bộ','mất mạng: vẫn lưu được và báo chờ đồng bộ', await ev(B.page,()=>cpPending()>0&&cpRecs().some(r=>r.customer==='Ngoại tuyến')), await ev(B.page,()=>cpSyncInfo().text));
  T('12 Đồng bộ','chưa có trên máy chủ khi offline', !Object.values(db.get('/data/cpRecords')).some(r=>r.customer==='Ngoại tuyến'));
  await B.ctx.setOffline(false); await ev(B.page,()=>cpFlush()); await sleep(2500);
  T('12 Đồng bộ','có mạng lại: tự gửi lên máy chủ', Object.values(db.get('/data/cpRecords')).some(r=>r.customer==='Ngoại tuyến')&&(await ev(B.page,()=>cpPending()))===0);
  T('12 Đồng bộ','đồng bộ không ghi đè nhánh khác (orders còn nguyên)', Object.keys(db.get('/data/orders')||{}).length===7);
  // xung đột: A và B cùng sửa 1 phiếu
  const cid=await ev(pg,()=>cpRecs().find(r=>r.customer==='Đồng bộ').id); await sleep(800);
  await B.ctx.setOffline(true);
  await ev(B.page,(id)=>{ const r=cpClone(cpGet(id)); r.note='B sửa offline'; r.spec='B-spec'; cpPut(r,{act:'B sửa',reason:'x'}); },cid);
  await ev(pg,(id)=>{ const r=cpClone(cpGet(id)); r.spec='A-spec'; cpPut(r,{act:'A sửa',reason:'x'}); },cid); await sleep(1500);
  await B.ctx.setOffline(false); await ev(B.page,()=>cpFlush()); await sleep(2500);
  T('12 Đồng bộ','xung đột sửa đồng thời: giữ bản máy chủ, cất bản của B (không mất âm thầm)', await ev(B.page,(id)=>cpGet(id).spec==='A-spec'&&cpConflicts().length===1,cid));
  T('12 Đồng bộ','máy chủ giữ bản A', db.get('/data/cpRecords/'+cid).spec==='A-spec');

  // ── 13. Giao diện điện thoại + hồi quy tab cũ
  const M=await device(browser,port,{width:390,height:844,isMobile:true,hasTouch:true}); await login(M.page,'admin','admin123');
  await M.page.evaluate(()=>{ goTab('controlPlan'); cpGo('list','rut'); }); await M.page.waitForTimeout(600);
  await M.page.screenshot({path:path.join(out,'mobile-list.png')});
  await M.page.evaluate(()=>cpNew('rut')); await M.page.waitForTimeout(400); await M.page.screenshot({path:path.join(out,'mobile-form.png')});
  T('13 UI','điện thoại: form không tràn ngang', await ev(M.page,()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2), await ev(M.page,()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]));
  T('13 UI','nút bấm đủ lớn cho cảm ứng (≥40px)', await ev(M.page,()=>{ const b=document.querySelector('#cpEd .cp-seg button'); return b&&b.getBoundingClientRect().height>=40; }), await ev(M.page,()=>{ const b=document.querySelector('#cpEd .cp-seg button'); return b&&b.getBoundingClientRect().height; }));
  await pg.evaluate(()=>{ cpGo('home'); }); await pg.setViewportSize({width:1440,height:900}); await pg.screenshot({path:path.join(out,'desktop-home.png')});
  const oldTabs=['dashboard','dorDang','keHoach','hoanThanh','baoCao','truyXuat','qrCode','soLieu','nhatKy','settings'];
  const e0=A.errs.length;
  for(const t of oldTabs){ await ev(pg,(t)=>goTab(t),t); await pg.waitForTimeout(250); }
  T('13 Hồi quy','các tab cũ vẫn mở bình thường, không lỗi JS', A.errs.length===e0, A.errs.slice(e0));
  await ev(pg,()=>goTab('controlPlan')); T('13 Hồi quy','quay lại ControlPlan sau khi đi tab khác', await ev(pg,()=>!!document.querySelector('#cpRoot')));
  T('13 Hồi quy','đơn hàng cũ không bị ảnh hưởng', await ev(pg,()=>DB.orders.length===7));
  T('13 Hồi quy','không lỗi JS toàn phiên (A,B,mobile)', A.errs.length+B.errs.length+M.errs.length===0, [A.errs,B.errs,M.errs]);

  // ── quyền xem
  await ev(pg,()=>doLogout()); await pg.waitForTimeout(400); await pg.evaluate(()=>{ localStorage.removeItem('sx_login_lock'); }); await pg.reload(); await pg.waitForTimeout(500);
  await login(pg,'nhanvien','nv123'); await ev(pg,()=>goTab('controlPlan')); await pg.waitForTimeout(500);
  T('13 Quyền','tài khoản staff mặc định = toàn quyền nhập/sửa: có nút tạo phiếu, lưu được phiếu', await ev(pg,()=>{ cpGo('list','dun'); if(cpRole()!=='full'||!document.querySelector('#cpRoot .cp-btn.big')) return false; cpNew('dun'); const e=cpUI.ed.rec; e.spec='8*40'; e.customer='NV'; e.lines[0].thick='8'; e.lines[0].width='40'; e.lines[0].result='OK'; const r=cpSave(true); return !!r&&r.createdBy; }), await ev(pg,()=>cpRole()));
  T('13 Quyền','staff mặc định: toàn quyền (nhập, sửa, duyệt/RELEASE, danh mục) nhưng không có quyền Quản trị', await ev(pg,()=>cpCan('approve')&&cpCan('create')&&cpCan('editAny')&&cpCan('verify')&&cpCan('master')&&!cpCan('config')));
  T('13 Quyền','staff không thấy mục Quản trị', await ev(pg,()=>!Array.from(document.querySelectorAll('.cp-nav button')).some(b=>/Quản trị/.test(b.textContent))));

  fs.writeFileSync(path.join(out,'controlplan-results.json'),JSON.stringify(R,null,1));
  console.log(`\n${R.length-fails}/${R.length} đạt`); await browser.close(); server.close(); process.exit(fails?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
