// src/modules/quality/cp-reports.js — ControlPlan: báo cáo OK/NG theo nhiều chiều, HOLD / NCR / 8D, xu hướng, xuất Excel / PDF
function cpAgg(list, keyFn, labelFn){
  const m=new Map();
  list.forEach(r=>{ const k=keyFn(r)||'—'; let a=m.get(k); if(!a){ a={key:k,label:(labelFn?labelFn(r):k)||k,ok:0,ng:0,unk:0}; m.set(k,a); } if(r.result==='OK') a.ok++; else if(r.result==='NG') a.ng++; else a.unk++; });
  return [...m.values()].map(a=>Object.assign(a,{n:a.ok+a.ng+a.unk, rate:(a.ok+a.ng)?a.ng/(a.ok+a.ng):null})).sort((x,y)=>y.n-x.n);
}
function cpReportData(F){
  const ins=cpInspections(F), UNKL='CHƯA XÁC ĐỊNH';
  const D={ins};
  D.stage=cpAgg(ins, r=>r.type==='fqc'?'fqc':r.form, r=>CP_STAGE_LABEL[r.type==='fqc'?'fqc':r.form]);
  D.customer=cpAgg(ins, r=>cpCustKey(r.customer)||'', r=>cpCust(r)||UNKL);
  D.spec=cpAgg(ins.filter(r=>r.type==='chk'), r=>cpSpecKey(r.spec), r=>r.spec||UNKL);
  D.machine=cpAgg(ins.filter(r=>r.type==='chk'), r=>r.machine||'', r=>r.machine||'(chưa ghi máy)');
  D.shift=cpAgg(ins.filter(r=>r.type==='chk'&&r.form!=='dothang'), r=>r.shift||'', r=>r.shift||'(chưa ghi ca)');
  D.inspector=cpAgg(ins, r=>r.inspector||'', r=>r.inspector||'(chưa ghi)');
  D.month=cpAgg(ins.filter(r=>r.date), r=>String(r.date).slice(0,7)).sort((a,b)=>a.key.localeCompare(b.key));
  // theo mã lỗi: đếm dòng đo NG có mã lỗi ngoại quan
  const dm=new Map(); let ngNoCode=0;
  ins.forEach(r=>(r.lines||[]).forEach(l=>{ if(l.result!=='NG') return; const c=l.appearance&&l.appearance!=='OK'?l.appearance:''; if(!c){ ngNoCode++; return; } dm.set(c,(dm.get(c)||0)+1); }));
  D.defect=[...dm.entries()].map(([c,n])=>({code:c,name:(cpDefect(c)||{}).name||'',n})).sort((a,b)=>b.n-a.n); D.ngNoCode=ngNoCode;
  const today=cpToday(), holds=cpOf('hold',r=>cpMatch(r,F)), ncrs=cpOf('ncr',r=>cpMatch(r,F)), d8=cpOf('eightd',r=>cpMatch(r,F));
  D.holdOpen=holds.filter(h=>CP_HOLD_OPEN.includes(h.status)).length; D.holdAll=holds.length; D.holdRel=holds.filter(h=>h.status==='RELEASE').length; D.holdScrap=holds.filter(h=>h.status==='Phế phẩm').length;
  D.ncrOpen=ncrs.filter(n=>n.status!=='Đã đóng').length; D.ncrAll=ncrs.length;
  D.d8Open=d8.filter(x=>x.status!=='Đã đóng').length;
  D.d8Late=[]; d8.forEach(x=>{ if(x.status==='Đã đóng') return; (x.steps||[]).forEach(s=>{ if(s.status!=='Hoàn thành' && s.due && s.due<today) D.d8Late.push({code:x.code,id:x.id,step:s.step,title:s.title,owner:s.owner,due:s.due,days:Math.round((new Date(today)-new Date(s.due))/864e5)}); }); });
  return D;
}
function cpRateCell(a){ return a.rate==null?'—':(a.rate*100).toFixed(1)+'%'; }
function cpAggTable(title, rows, head){
  const mx=Math.max(1,...rows.map(a=>a.n));
  return `<div class="cp-sec">${title}</div>`+(rows.length?cpTable([head,'Tổng','OK','NG','Chưa xác định','Tỷ lệ NG',''],rows.slice(0,40).map(a=>`<tr>${cpTd(a.label)}${cpTd(a.n)}${cpTd(a.ok)}<td class="${a.ng?'ng':''}">${a.ng}</td>${cpTd(a.unk)}<td><b>${cpRateCell(a)}</b></td><td style="min-width:90px"><div class="cp-prog"><i style="width:${Math.round(a.n/mx*100)}%"></i></div></td></tr>`)):'<div class="cp-empty">Chưa có dữ liệu.</div>')+(rows.length>40?`<div class="cp-dinfo">Hiển thị 40/${rows.length} dòng đầu — xuất Excel để xem đủ.</div>`:'');
}
function cpReportsHtml(){
  const D=cpReportData(cpUI.F), tot=D.ins.length, ng=D.ins.filter(r=>r.result==='NG').length, ok=D.ins.filter(r=>r.result==='OK').length;
  return `<div class="cp-bar">${cpBackBtn()}<b style="font-size:16px">📊 Báo cáo chất lượng</b><span class="grow"></span>
    <button class="cp-btn" onclick="cpReportXlsx()">⬇ Excel</button><button class="cp-btn" onclick="cpReportPdf()">🖨 PDF</button></div>
    ${cpFiltersHtml()}
    <div class="cp-kpis"><div class="cp-kpi" style="--k:#2563eb"><b>${tot}</b><span>Phiếu kiểm tra</span></div><div class="cp-kpi" style="--k:#047857"><b>${ok}</b><span>OK</span></div><div class="cp-kpi" style="--k:#dc2626"><b>${ng}</b><span>NG</span></div>
      <div class="cp-kpi" style="--k:#b91c1c"><b>${(ok+ng)?(ng/(ok+ng)*100).toFixed(1)+'%':'—'}</b><span>Tỷ lệ NG (trên phiếu đã có kết luận)</span></div>
      <div class="cp-kpi click" style="--k:#d97706" onclick="cpGo('list','hold')"><b>${D.holdOpen}</b><span>Lô đang HOLD</span></div><div class="cp-kpi click" style="--k:#9333ea" onclick="cpGo('list','ncr')"><b>${D.ncrOpen}</b><span>NCR chưa đóng</span></div>
      <div class="cp-kpi click" style="--k:#0369a1" onclick="cpGo('list','eightd')"><b>${D.d8Open}</b><span>8D đang mở</span></div><div class="cp-kpi" style="--k:#dc2626"><b>${D.d8Late.length}</b><span>Bước 8D quá hạn</span></div></div>
    <div class="cp-dinfo">Phiếu "Chưa xác định" không tính vào tỷ lệ NG. Dữ liệu gồm cả lịch sử nhập từ Excel (nhãn "Excel") và phiếu mới trên phần mềm; dùng bộ lọc <b>Nguồn</b> để tách riêng.</div>
    ${cpAggTable('Theo công đoạn',D.stage,'Công đoạn')}
    <div class="cp-sec">Theo mã lỗi ngoại quan (số dòng đo NG)</div>${D.defect.length?cpTable(['Mã lỗi','Tên lỗi','Số dòng NG'],D.defect.map(d=>`<tr>${cpTd(d.code)}${cpTd(d.name)}${cpTd(d.n)}</tr>`)):'<div class="cp-empty">Chưa có dòng NG gắn mã lỗi.</div>'}
    ${D.ngNoCode?`<div class="cp-dinfo">${D.ngNoCode} dòng NG chưa gắn mã lỗi (dữ liệu lịch sử hoặc NG do số đo).</div>`:''}
    ${cpAggTable('Theo khách hàng',D.customer,'Khách hàng')}${cpAggTable('Theo quy cách',D.spec,'Quy cách')}${cpAggTable('Theo máy',D.machine,'Máy')}${cpAggTable('Theo ca',D.shift,'Ca')}${cpAggTable('Theo nhân viên kiểm',D.inspector,'Nhân viên QC')}
    ${cpAggTable('Xu hướng theo tháng',D.month,'Tháng')}
    <div class="cp-sec">8D quá hạn</div>${D.d8Late.length?cpTable(['Hồ sơ 8D','Bước','Phụ trách','Hạn','Quá hạn (ngày)'],D.d8Late.map(x=>`<tr class="click" onclick="cpOpen('${x.id}')">${cpTd(x.code)}${cpTd(x.step+' – '+x.title)}${cpTd(x.owner)}${cpTd(cpFmtDate(x.due))}<td class="ng">${x.days}</td></tr>`)):'<div class="cp-empty">Không có bước 8D nào quá hạn.</div>'}
    <div class="cp-dinfo">HOLD: ${D.holdAll} phiếu (đã RELEASE ${D.holdRel}, phế phẩm ${D.holdScrap}, đang mở ${D.holdOpen}) · NCR: ${D.ncrAll} phiếu.</div>`;
}
function cpReportMatrices(){
  const D=cpReportData(cpUI.F), A=(t,rows)=>({name:t,rows:[[t.replace(/^.* /,''),'Tổng','OK','NG','Chưa xác định','Tỷ lệ NG %']].concat(rows.map(a=>[a.label,a.n,a.ok,a.ng,a.unk,a.rate==null?'':+(a.rate*100).toFixed(2)]))});
  return [
    {name:'Tổng hợp',rows:[['Chỉ tiêu','Giá trị'],['Phiếu kiểm tra',D.ins.length],['OK',D.ins.filter(r=>r.result==='OK').length],['NG',D.ins.filter(r=>r.result==='NG').length],['Lô đang HOLD',D.holdOpen],['NCR chưa đóng',D.ncrOpen],['8D đang mở',D.d8Open],['Bước 8D quá hạn',D.d8Late.length],['Ngày xuất',cpToday()],['Người xuất',cpActor()]]},
    A('Công đoạn',D.stage),{name:'Mã lỗi',rows:[['Mã lỗi','Tên lỗi','Số dòng NG']].concat(D.defect.map(d=>[d.code,d.name,d.n]))},
    A('Khách hàng',D.customer),A('Quy cách',D.spec),A('Máy',D.machine),A('Ca',D.shift),A('Nhân viên QC',D.inspector),A('Theo tháng',D.month),
    {name:'8D quá hạn',rows:[['Hồ sơ','Bước','Phụ trách','Hạn','Quá hạn (ngày)']].concat(D.d8Late.map(x=>[x.code,x.step+' '+x.title,x.owner,x.due,x.days]))}
  ];
}
function cpReportXlsx(){ cpDownloadXlsx('ControlPlan_BaoCao_'+cpToday()+'.xlsx', cpReportMatrices()); }
function cpReportPdf(){ const m=cpReportMatrices(); const rows=[]; m.forEach(s=>{ rows.push([s.name]); s.rows.forEach(r=>rows.push(r)); rows.push([]); }); cpPrintMatrix('Báo cáo chất lượng ControlPlan – '+cpFmtDate(cpToday()), rows); }
