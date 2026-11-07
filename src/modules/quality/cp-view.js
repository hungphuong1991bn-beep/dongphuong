// src/modules/quality/cp-view.js — ControlPlan: điều hướng, Tổng quan (KPI + bộ lọc + thẻ biểu mẫu), danh sách phiếu
const cpUI = {view:'home', arg:'', F:Object.assign({}, CP_FILTER0), q:'', page:1, ed:null, og:{}};   // og: nhóm đang mở ở Tổng quan {A:true,...}
const CP_PAGE = 50;

function renderControlPlan(){
  if(cpUI.ed) return;                                         // đang mở phiếu: không vẽ lại để khỏi mất chữ đang nhập
  const a=document.activeElement;
  if(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.closest && a.closest('#cpRoot')) return;
  cpRender();
}
function cpGo(view, arg){ cpUI.view=view; cpUI.arg=arg||''; cpUI.page=1; cpUI.q=''; cpUI.ed=null; cpRender(); const m=$('mc'); if(m) m.scrollTop=0; window.scrollTo(0,0); }
function cpSetF(k,v){ cpUI.F[k]=v; cpUI.page=1; cpRender(); }
function cpResetF(){ cpUI.F=Object.assign({},CP_FILTER0); cpUI.page=1; cpRender(); }
function cpSetQ(v){ cpUI.q=v; cpUI.page=1; cpRender(); }
function cpPage(n){ cpUI.page=n; cpRender(); }

function cpRender(){
  const root=$('mc'); if(!root) return;
  const v=cpUI.view; let body='';
  try{
    if(cpUI.ed) body=cpEdHtml();
    else if(v==='home') body=cpHomeHtml();
    else if(v==='list') body=cpListHtml(cpUI.arg);
    else if(v==='cp') body=cpMasterCpHtml();
    else if(v==='pfmea') body=cpPfmeaHtml();
    else if(v==='aql') body=cpAqlHtml();
    else if(v==='defects') body=cpDefectsHtml();
    else if(v==='reports') body=cpReportsHtml();
    else if(v==='review') body=cpReviewHtml();
    else if(v==='admin') body=cpAdminHtml();
    else body=cpHomeHtml();
  }catch(e){ console.error(e); body='<div class="cp-banner err">Lỗi hiển thị: '+cpH(e.message)+'</div>'; }
  const rv=cpReviewList().length, sel=(k)=>cpUI.view===k?' on':'';
  root.innerHTML=`<div class="cp-wrap" id="cpRoot">
    <div class="cp-head"><div><div class="cp-title">🛡️ ControlPlan – Hệ thống kiểm soát chất lượng</div>
      <div class="cp-sub">Biểu mẫu QC điền trực tiếp trên phần mềm, tự đồng bộ, liên kết đơn hàng – lô – sổ máy. Excel chỉ còn là nguồn đối chiếu.</div></div>
      <div class="cp-chips"><span class="cp-chip">👤 ${cpH(CP_ROLE_LABEL[cpRole()])}</span><span id="cpSyncBadge" class="cp-sync ok" onclick="cpSyncDialog()" style="cursor:pointer"></span></div></div>
    <div class="cp-nav">
      <button class="${sel('home')}" onclick="cpGo('home')">🏠 Tổng quan</button>
      <button class="${sel('reports')}" onclick="cpGo('reports')">📊 Báo cáo</button>
      <button class="${sel('review')}" onclick="cpGo('review')">🔍 Cần kiểm tra${rv?`<span class="cp-badge">${rv>999?'999+':rv}</span>`:''}</button>
      ${cpCan('config')?`<button class="${sel('admin')}" onclick="cpGo('admin')">⚙️ Quản trị</button>`:''}
    </div>${body}</div>`;
  cpSyncBadge();
}

// ── thành phần dùng chung ─────────────────────────────────────────────────────
function cpResPill(r){ const x=CP_RES[r]||CP_RES.UNK; return `<span class="cp-pill ${x.c}">${x.t}</span>`; }
function cpSrcPill(r){ return r.source==='excel'?'<span class="cp-pill xl" title="Dữ liệu lịch sử nhập từ Excel">Excel</span>':'<span class="cp-pill blue">PM</span>'; }
function cpBackBtn(to){ return `<button class="cp-btn" onclick="cpGo('${to||'home'}')">← Quay lại</button>`; }
function cpOpts(list, cur, blank){ return (blank===false?'':`<option value="">${cpH(blank||'— Tất cả —')}</option>`)+list.map(o=>{ const v=typeof o==='object'?o.v:o, t=typeof o==='object'?o.t:o; return `<option value="${cpH(v)}"${String(v)===String(cur)?' selected':''}>${cpH(t)}</option>`; }).join(''); }

function cpFiltersHtml(){
  const F=cpUI.F;
  const stages=['dothang','dun','rut','danhbong','cat','fqc'].map(k=>({v:k,t:CP_STAGE_LABEL[k]}));
  const any=Object.keys(F).some(k=>F[k]);
  return `<div class="cp-filters"><div class="cp-fgrid">
    <div><label>Từ ngày</label><input type="date" value="${cpH(F.from)}" onchange="cpSetF('from',this.value)"></div>
    <div><label>Đến ngày</label><input type="date" value="${cpH(F.to)}" onchange="cpSetF('to',this.value)"></div>
    <div><label>Công đoạn</label><select onchange="cpSetF('stage',this.value)">${cpOpts(stages,F.stage)}</select></div>
    <div><label>Nhân viên QC</label><select onchange="cpSetF('qc',this.value)">${cpOpts(cpPeople(),F.qc)}</select></div>
    <div><label>Khách hàng</label><select onchange="cpSetF('customer',this.value)">${cpOpts(cpCustomers().map(c=>({v:c.key,t:c.name})),F.customer)}</select></div>
    <div><label>Mã đơn hàng</label><input value="${cpH(F.order)}" placeholder="PO / mã đơn" onchange="cpSetF('order',this.value.trim())"></div>
    <div><label>Mã sản phẩm</label><input value="${cpH(F.product)}" onchange="cpSetF('product',this.value.trim())"></div>
    <div><label>Mã lô</label><input value="${cpH(F.lot)}" onchange="cpSetF('lot',this.value.trim())"></div>
    <div><label>Kết quả</label><select onchange="cpSetF('result',this.value)">${cpOpts([{v:'OK',t:'OK'},{v:'NG',t:'NG'},{v:'UNK',t:'Chưa xác định'}],F.result)}</select></div>
    <div><label>Nguồn</label><select onchange="cpSetF('source',this.value)">${cpOpts([{v:'app',t:'Nhập trên phần mềm'},{v:'excel',t:'Lịch sử từ Excel'}],F.source)}</select></div>
    <div style="display:flex;align-items:flex-end">${any?'<button class="cp-btn" onclick="cpResetF()">✕ Xoá lọc</button>':''}</div>
  </div></div>`;
}

// ── TỔNG QUAN ────────────────────────────────────────────────────────────────
function cpHomeHtml(){
  const K=cpKpis(cpUI.F), F=cpUI.F;
  const kp=(n,l,c,go)=>`<div class="cp-kpi${go?' click':''}" style="--k:${c}" ${go?`onclick="${go}"`:''}><b>${n}</b><span>${l}</span></div>`;
  const empty=!cpRecs().some(r=>r.type==='chk'||r.type==='fqc');
  let h=`<div class="cp-kpis">
    ${kp(K.total,'Tổng số phiếu kiểm tra','#2563eb')}${kp(K.today,'Số phiếu hôm nay','#0d9488')}${kp(K.ok,'Phiếu đạt OK','#047857')}${kp(K.ng,'Phiếu NG','#dc2626')}
    ${kp(K.holdOpen,'Lô đang HOLD',' #d97706',"cpGo('list','hold')")}${kp(K.ncrOpen,'NCR chưa đóng','#9333ea',"cpGo('list','ncr')")}${kp(K.d8Open,'Hành động 8D đang xử lý','#0369a1',"cpGo('list','eightd')")}
    ${kp(K.unk,'Chưa xác định kết quả','#64748b',"cpGo('review')")}${kp(K.drafts,'Bản nháp','#94a3b8')}</div>`;
  if(empty) h+=`<div class="cp-banner info">Chưa có phiếu nào. ${cpCan('config')?'Quản trị viên vào <b>⚙️ Quản trị ▸ Nhập dữ liệu từ Excel</b> để nạp lịch sử và danh mục.':'Nhờ Quản trị viên nạp dữ liệu lịch sử từ Excel, hoặc bấm vào một biểu mẫu để tạo phiếu đầu tiên.'}</div>`;
  if(Object.keys(F).some(k=>F[k])) h+=`<div class="cp-banner info">Các KPI đang tính theo bộ lọc bên dưới.</div>`;
  h+=cpFiltersHtml();
  // Toolbar: mở/thu gọn tất cả + xuất Excel toàn bộ
  const nOpen=CP_GROUPS.filter(g=>cpUI.og[g.key]).length;
  h+=`<div class="cp-gtools"><div class="cp-ghint">👇 Bấm vào từng nhóm để mở danh sách biểu mẫu của nhóm đó.</div><span class="grow"></span>
    <button class="cp-btn" onclick="cpGroupAll(${nOpen<CP_GROUPS.length?'true':'false'})">${nOpen<CP_GROUPS.length?'⤢ Mở tất cả':'⤡ Thu gọn tất cả'}</button>
    <button class="cp-btn g" onclick="cpExportAll()" title="Xuất toàn bộ ControlPlan ra một file Excel gồm trang Tổng quan và từng biểu mẫu">⬇ Xuất Excel toàn bộ</button></div>`;
  const stats={}; CP_FORMS.forEach(f=>{ stats[f.key]=cpCardStats(f.key,F); });
  CP_GROUPS.forEach(g=>{
    const forms=CP_FORMS.filter(f=>f.g===g.key), isOpen=!!cpUI.og[g.key];
    const frm=forms.filter(f=>f.kind==='form'), sumN=frm.reduce((t,f)=>t+stats[f.key].n,0), sumToday=frm.reduce((t,f)=>t+stats[f.key].today,0), sumNg=frm.reduce((t,f)=>t+stats[f.key].ng,0);
    const chips=frm.length
      ? `<span class="cp-gchip"><b>${sumN}</b> phiếu</span><span class="cp-gchip"><b>${sumToday}</b> hôm nay</span><span class="cp-gchip${sumNg?' ng':''}"><b>${sumNg}</b> ${g.key==='D'?'đang mở':'NG'}</span>`
      : `<span class="cp-gchip"><b>${forms.reduce((t,f)=>t+stats[f.key].n,0)}</b> mục danh mục</span>`;
    h+=`<section class="cp-gsec${isOpen?' open':''}" data-g="${g.key}" style="--gc:${g.color}">
      <div class="cp-ghead" role="button" tabindex="0" aria-expanded="${isOpen}" onclick="cpToggleGroup('${g.key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();cpToggleGroup('${g.key}')}">
        <span class="cp-gchev" aria-hidden="true">▸</span>
        <div class="cp-gtitle"><b>${g.title}</b><small>${forms.length} biểu mẫu${frm.length?'':' · tiêu chuẩn tham chiếu'}</small></div>
        <div class="cp-gchips">${chips}</div>
        <button class="cp-btn cp-gx" onclick="event.stopPropagation();cpExportGroup('${g.key}')" title="Xuất Excel nhóm này">⬇ Excel</button>
      </div>
      <div class="cp-gbody"><div class="cp-cards">`;
    forms.forEach(f=>{
      const s=stats[f.key], isForm=f.kind==='form';
      const lbl=isForm?(f.key==='hold'?'Đang HOLD':(f.key==='ncr'||f.key==='eightd')?'Chưa đóng':'NG'):'';
      h+=`<div class="cp-card" style="--gc:${g.color}"><div class="cp-card-top"><div class="cp-ico">${f.icon}</div><div><h4>${f.no}. ${cpH(f.title)}</h4><div class="cp-code">${f.code?'Mã: '+cpH(f.code):'Mã biểu mẫu: chưa quy định'}</div></div></div>
        <div class="cp-desc">${cpH(f.desc)}</div>
        <div class="cp-stats"><div class="cp-stat"><b>${s.n}</b><span>${isForm?'Phiếu đã ghi':cpH(s.unit)}</span></div>${isForm?`<div class="cp-stat"><b>${s.today}</b><span>Hôm nay</span></div><div class="cp-stat"><b class="${s.ng?'ng':''}">${s.ng}</b><span>${lbl}</span></div>`:''}</div>
        <div class="cp-card-foot"><span class="cp-live">● Hoạt động</span><button class="cp-btn" onclick="cpExportForm('${f.key}')" title="Xuất Excel biểu mẫu này">⬇ Excel</button><button class="cp-btn p" onclick="cpOpenForm('${f.key}')">Mở biểu mẫu</button></div></div>`;
    });
    h+='</div></div></section>';
  });
  const toc=cpSeed().toc||{};
  if(toc.flow) h+=`<div class="cp-flow"><h5>Luồng liên kết dữ liệu</h5><div class="cp-flowrow">${String(toc.flow).split(/→|->/).map(x=>`<span>${cpH(x.trim())}</span>`).join('<i>→</i>')}</div></div>`;
  return h;
}
function cpOpenForm(key){
  const f=cpFormDef(key);
  if(f.kind==='cp') return cpGo('cp'); if(f.kind==='pfmea') return cpGo('pfmea'); if(f.kind==='aql') return cpGo('aql'); if(f.kind==='defect') return cpGo('defects');
  cpGo('list', key);
}

// Mở / đóng nhóm ngay trên DOM (không vẽ lại cả trang → giữ nguyên vị trí cuộn, có hiệu ứng mượt).
// Kiểu accordion: mở nhóm nào thì các nhóm khác tự thu lại; bấm lại nhóm đang mở để đóng.
function cpToggleGroup(k){
  const was=!!cpUI.og[k];
  cpUI.og = was ? {} : {[k]:true};
  cpSyncGroups();
  if(!was){ const el=document.querySelector('#cpRoot .cp-gsec[data-g="'+k+'"]'); if(el) setTimeout(()=>{ try{ el.scrollIntoView({behavior:'smooth', block:'nearest'}); }catch(e){} }, 30); }
}
function cpGroupAll(on){ cpUI.og={}; if(on) CP_GROUPS.forEach(g=>{ cpUI.og[g.key]=true; }); cpRender(); }
function cpSyncGroups(){
  document.querySelectorAll('#cpRoot .cp-gsec').forEach(el=>{
    const on=!!cpUI.og[el.getAttribute('data-g')]; el.classList.toggle('open', on);
    const hd=el.querySelector('.cp-ghead'); if(hd) hd.setAttribute('aria-expanded', on?'true':'false');
  });
  const n=Object.keys(cpUI.og).length, b=document.querySelector('#cpRoot .cp-gtools .cp-btn:not(.g)');
  if(b){ const all=n>=CP_GROUPS.length; b.textContent=all?'⤡ Thu gọn tất cả':'⤢ Mở tất cả'; b.setAttribute('onclick','cpGroupAll('+(all?'false':'true')+')'); }
}

// ── DANH SÁCH PHIẾU ──────────────────────────────────────────────────────────
function cpListRows(key){
  const type=CP_TYPE_OF_FORM[key], F=cpUI.F, q=cpNorm(cpUI.q);
  let l=cpRecs().filter(r=>r && r.type===type && !r.void && (type!=='chk'||r.form===key) && cpMatch(r,F));
  if(q) l=l.filter(r=>cpNorm(JSON.stringify([r.code,r.customer,r.spec,r.lot,r.productCode,r.orderCode,r.po,r.inspector,r.title,r.desc,r.reason])).indexOf(q)>=0);
  const k=r=>(r.date||cpYmd(new Date(r.createdAt||0)))+String(r.src&&r.src.row?String(r.src.row).padStart(6,'0'):String(r.createdAt||0));
  return l.sort((a,b)=>k(b).localeCompare(k(a)));
}
function cpListHtml(key){
  const f=cpFormDef(key), type=CP_TYPE_OF_FORM[key], rows=cpListRows(key);
  const canNew=cpCan('create');
  let h=`<div class="cp-bar">${cpBackBtn()}<b style="font-size:16px">${f.icon} ${cpH(f.title)}</b><span class="grow"></span>
    ${canNew?`<button class="cp-btn p big" onclick="cpNew('${key}')">➕ Tạo phiếu${type==='chk'||type==='fqc'?' kiểm tra':''}</button>`:''}</div>`;
  h+=cpFiltersHtml();
  h+=`<div class="cp-bar"><input class="grow" type="search" placeholder="Tìm theo mã phiếu, khách hàng, quy cách, lô…" value="${cpH(cpUI.q)}" onchange="cpSetQ(this.value)">
      <button class="cp-btn" onclick="cpExportList('${key}')">⬇ Excel</button><button class="cp-btn" onclick="cpPrintList('${key}')">🖨 PDF</button></div>`;
  if(!rows.length) return h+`<div class="cp-empty">Không có phiếu nào khớp bộ lọc.${canNew?'<br><br><button class="cp-btn p" onclick="cpNew(\''+key+'\')">➕ Tạo phiếu đầu tiên</button>':''}</div>`;
  let head, line;
  if(type==='chk' && key!=='dothang'){
    const hasLen=key!=='dun';
    head=['Ngày','Mã phiếu','Ca','Khách hàng','Quy cách','Xưởng / Máy','Mã lô','Giờ','Mẫu','Dày','Rộng'].concat(hasLen?['Dài']:[]).concat(['Ngoại quan','Kết luận','QC','Liên kết','Nguồn']);
    line=(r,l)=>[cpFmtDate(r.date),r.code,r.shift,cpCust(r),r.spec,[r.workshop,r.machine].filter(Boolean).join(' / ')||'—',r.lot||'—',l.time,l.n,cpV(l.thick),cpV(l.width)].concat(hasLen?[cpV(l.length)]:[]).concat([cpAppear(l), cpResPill(l.result), r.inspector, cpLinkPill(r), cpSrcPill(r)]);
  } else if(key==='dothang'){
    head=['Ngày','Mã phiếu','Khách hàng','Quy cách','Xưởng','Mã lô','Cạnh','Mặt','Vểnh','Vặn','Tiêu chuẩn','Kết luận','QC','Liên kết','Nguồn'];
    line=(r,l)=>[cpFmtDate(r.date),r.code,cpCust(r),r.spec,r.workshop||'—',r.lot||'—',l.edge,l.face,l.warp,l.twist,r.standard,cpResPill(l.result),r.inspector,cpLinkPill(r),cpSrcPill(r)];
  }
  if(type==='chk'){
    const flat=[]; rows.forEach(r=>(r.lines||[]).forEach(l=>flat.push([r,l])));
    const tot=flat.length, pages=Math.max(1,Math.ceil(tot/CP_PAGE)); cpUI.page=Math.min(cpUI.page,pages);
    const sl=flat.slice((cpUI.page-1)*CP_PAGE, cpUI.page*CP_PAGE);
    h+=`<div class="cp-tw"><table class="cp-t"><thead><tr>${head.map(x=>`<th>${x}</th>`).join('')}${''}</tr></thead><tbody>${sl.map(([r,l])=>`<tr class="click${r.status==='draft'?' draft':''}" onclick="cpOpen('${r.id}')">${line(r,l).map(c=>`<td>${typeof c==='string'&&c.startsWith('<span')?c:cpH(c==null||c===''?'—':c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    return h+cpPager(tot,pages,'dòng đo / '+rows.length+' phiếu');
  }
  const cols={
    fqc:['Ngày','Mã phiếu','Khách hàng','Mã SP','Mã lô','SL lô','Code / Cỡ mẫu','Major / Minor / Critical','Kết luận','QA/QC','Nguồn'],
    ncr:['Số NCR','Ngày','Mã SP','Mã lô','Công đoạn','Mô tả NG','SL ảnh hưởng','Phân loại','Trạng thái','Quyết định'],
    hold:['Số HOLD','Ngày giờ','Mã SP','Mã lô','SL','Lý do','Trạng thái','Người HOLD','NCR'],
    eightd:['Số 8D','Ngày mở','Vấn đề','Khách hàng','Mã lô','Tiến độ','Quá hạn','Trạng thái','Phụ trách']
  }[key];
  const cell={
    fqc:r=>[cpFmtDate(r.date),r.code,cpCust(r),r.productCode||'CHƯA XÁC ĐỊNH',r.lot||'—',r.lotQty,(r.aqlCode||'—')+' / '+(r.sampleSize||'—'),(r.majorNG||0)+' / '+(r.minorNG||0)+' / '+(r.criticalNG||0),cpResPill(r.result),r.inspector,cpSrcPill(r)],
    ncr:r=>[r.code,cpFmtDate(r.date),r.productCode||'—',r.lot||'—',r.stage,String(r.desc||'').slice(0,70),r.qtyAffected,r.klass,cpStatusPill(r.status),r.disposition||'—'],
    hold:r=>[r.code,cpFmtTs(r.heldAt),r.productCode||'—',r.lot||'—',r.qty,String(r.reason||'').slice(0,60),cpStatusPill(r.status),r.holdBy,(cpGet(r.ncrId)||{}).code||'—'],
    eightd:r=>{ const p=cp8dProgress(r); return [r.code,cpFmtDate(r.date),String(r.title||'').slice(0,60),cpCust(r),r.lot||'—',p.done+'/9',p.late?`<span class="cp-pill ng">${p.late} bước</span>`:'—',cpStatusPill(r.status),r.leader]; }
  }[key];
  const pages=Math.max(1,Math.ceil(rows.length/CP_PAGE)); cpUI.page=Math.min(cpUI.page,pages);
  const sl=rows.slice((cpUI.page-1)*CP_PAGE, cpUI.page*CP_PAGE);
  h+=`<div class="cp-tw"><table class="cp-t"><thead><tr>${cols.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${sl.map(r=>`<tr class="click" onclick="cpOpen('${r.id}')">${cell(r).map(c=>`<td>${typeof c==='string'&&c.startsWith('<span')?c:cpH(c==null||c===''?'—':c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return h+cpPager(rows.length,pages,'phiếu');
}
function cpPager(tot,pages,unit){
  return `<div class="cp-pager"><button class="cp-btn" ${cpUI.page<=1?'disabled':''} onclick="cpPage(${cpUI.page-1})">‹</button><span>Trang ${cpUI.page}/${pages} · ${tot} ${unit}</span><button class="cp-btn" ${cpUI.page>=pages?'disabled':''} onclick="cpPage(${cpUI.page+1})">›</button></div>`;
}
function cpV(v){ return v==null||v===''?'':String(v); }
function cpAppear(l){ if(l.appearance&&l.appearance!=='OK') return l.appearance+(cpDefect(l.appearance)?' – '+cpDefect(l.appearance).name:''); return l.appearance==='OK'?'OK':(l.appearanceNote||''); }
function cpLinkPill(r){ const s=cpLinkStatus(r); return `<span class="cp-pill ${s.c==='ok'?'ok':s.c==='warn'?'warn':'unk'}">${s.t}</span>`; }
function cpStatusPill(s){ const c=/Đóng|RELEASE|Hoàn/i.test(s)?'ok':/Phế|HOLD|Mở/i.test(s)?'ng':'warn'; return `<span class="cp-pill ${c}">${cpH(s)}</span>`; }
function cp8dProgress(r){ const t=cpToday(); let done=0, late=0; (r.steps||[]).forEach(s=>{ if(s.status==='Hoàn thành') done++; else if(s.due && s.due<t) late++; }); return {done,late}; }

// ── Xuất PDF (in) + ma trận dữ liệu ────────────────────────────────────────────────────
function cpExportMatrix(key){
  const rows=cpListRows(key), type=CP_TYPE_OF_FORM[key], out=[];
  if(type==='chk'){
    const dt=key==='dothang';
    out.push(dt?['Ngày','Mã phiếu','Khách hàng','Quy cách','Xưởng','Mã lô','Độ thẳng cạnh','Độ thẳng mặt','Độ vểnh','Độ vặn','Tiêu chuẩn','Kết luận','QC','Liên kết','Nguồn']
              :['Ngày','Mã phiếu','Ca','Khách hàng','Quy cách','Xưởng','Máy','Mã lô','Giờ','Mẫu','Dày','Rộng','Dài','Ngoại quan','Kết luận','QC','Liên kết','Nguồn']);
    rows.forEach(r=>(r.lines||[]).forEach(l=>out.push(dt?[r.date,r.code,cpCust(r),r.spec,r.workshop,r.lot,l.edge,l.face,l.warp,l.twist,r.standard,l.result,r.inspector,cpLinkStatus(r).t,r.source==='excel'?'Excel':'PM']
      :[r.date,r.code,r.shift,cpCust(r),r.spec,r.workshop,r.machine,r.lot,l.time,l.n,l.thick,l.width,l.length,cpAppear(l),l.result,r.inspector,cpLinkStatus(r).t,r.source==='excel'?'Excel':'PM'])));
  } else {
    out.push(['Mã','Ngày','Khách hàng','Mã SP','Mã lô','Trạng thái/Kết luận','Người tạo']);
    rows.forEach(r=>out.push([r.code,r.date||cpFmtTs(r.createdAt),cpCust(r),r.productCode,r.lot,r.result||r.status,r.createdBy]));
  }
  return out;
}
// cpDownloadXlsx / cpExportList / cpExportForm / cpExportGroup / cpExportAll → xem cp-export.js (xuất Excel chuyên nghiệp)
function cpPrintMatrix(title, rows){
  const w=window.open('','_blank'); if(!w){ showToast('Trình duyệt chặn cửa sổ in — cho phép pop-up rồi thử lại', true); return; }
  w.document.write(`<html><head><meta charset="utf-8"><title>${cpH(title)}</title><style>body{font:11px Arial,sans-serif;margin:14px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #888;padding:3px 5px;text-align:left}th{background:#e2e8f0}h2{margin:0 0 8px}</style></head><body><h2>${cpH(title)}</h2><div>Xuất ngày ${cpFmtTs(Date.now())} · ${cpH(cpActor())}</div><br><table>${rows.map((r,i)=>'<tr>'+r.map(c=>`<${i?'td':'th'}>${cpH(c==null?'':c)}</${i?'td':'th'}>`).join('')+'</tr>').join('')}</table><script>setTimeout(function(){window.print()},300)<\/script></body></html>`);
  w.document.close();
}
function cpPrintList(key){ cpPrintMatrix(cpFormDef(key).title, cpExportMatrix(key)); }

function cpSyncDialog(){
  const i=cpSyncInfo(), conf=cpConflicts();
  cpModal(`<h3>Trạng thái đồng bộ</h3><div class="cp-banner ${i.cls==='ok'?'ok':i.cls==='err'?'err':'warn'}">${cpH(i.text)}</div>
    <p style="font-size:13px">Mục chờ gửi: <b>${i.n}</b>. Dữ liệu luôn được lưu trên thiết bị trước, rồi tự gửi lên máy chủ; mất mạng sẽ tự thử lại khi có mạng.</p>
    <button class="cp-btn p" onclick="cpFlush();cpModalClose()">🔄 Đồng bộ ngay</button>
    ${conf.length?`<h4>Xung đột đồng bộ (${conf.length})</h4>`+conf.map((c,k)=>`<div class="cp-banner warn">${cpH((c.mine||{}).code||c.id)} — bản của ${cpH(c.by)} lúc ${cpFmtTs(c.ts)} <button class="cp-btn" onclick="cpConflictRestore(${k});cpModalClose()">Khôi phục bản của tôi</button> <button class="cp-btn" onclick="cpConflictDiscard(${k});cpSyncDialog()">Bỏ</button></div>`).join(''):''}
    <div style="text-align:right;margin-top:10px"><button class="cp-btn" onclick="cpModalClose()">Đóng</button></div>`);
}
function cpModal(html){ cpModalClose(); const d=document.createElement('div'); d.className='cp-mod'; d.id='cpMod'; d.innerHTML='<div>'+html+'</div>'; document.body.appendChild(d); }
function cpModalClose(){ const d=$('cpMod'); if(d) d.remove(); }
