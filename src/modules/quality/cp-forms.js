// src/modules/quality/cp-forms.js — ControlPlan: biểu mẫu nhập liệu (phiếu kiểm tra, FQC, NCR, HOLD/RELEASE, 8D) + quy trình khi NG
const CP_DISPO = ['RELEASE – giải phóng','Rework / Sửa chữa','Phân loại (Sort)','Chấp nhận đặc biệt (Concession)','Phế phẩm','Trả lại'];
const CP_HOLD_DISPO = ['RELEASE – giải phóng','Rework / Sửa chữa','Phân loại (Sort)','Phế phẩm','Trả lại'];
const CP_KLASS = ['Critical','Major','Minor'];

function cpPathGet(o,p){ return p.split('.').reduce((a,k)=>a==null?a:a[k], o); }
function cpPathSet(o,p,v){ const ks=p.split('.'); let a=o; for(let i=0;i<ks.length-1;i++){ if(a[ks[i]]==null) a[ks[i]]={}; a=a[ks[i]]; } a[ks[ks.length-1]]=v; }

// ── mở / tạo ────────────────────────────────────────────────────────────────
function cpNew(key, preset){
  if(cpGuard('create')) return;
  const rec=cpBlank(key); if(preset) Object.assign(rec, preset);
  cpUI.view='list'; cpUI.arg=key; cpUI.ed={rec, orig:null, isNew:true, ro:false, reason:'', key, errs:{}};
  cpEdRender();
}
function cpOpen(id){
  const rec=cpGet(id); if(!rec) return;
  const key=rec.type==='chk'?rec.form:rec.type;
  const ro = !(cpCanEdit(rec) && (rec.status==='draft' || rec.type==='ncr' || rec.type==='hold' || rec.type==='eightd'));
  cpUI.view='list'; cpUI.arg=key; cpUI.ed={rec:cpClone(rec), orig:cpClone(rec), isNew:false, ro, reason:'', key, errs:{}};
  cpEdRender();
}
function cpEdClose(){ cpUI.ed=null; cpRender(); }
function cpEdRender(){
  const m=$('mc'), sy=window.scrollY, st=m?m.scrollTop:0;
  cpRender(); if(m) m.scrollTop=st; window.scrollTo(0,sy);
  cpEdValidateUI();
}

// ── tạo khung điều khiển ────────────────────────────────────────────────────
function cpFld(path,label,o){
  o=o||{}; const ed=cpUI.ed, v=cpPathGet(ed.rec,path), ro=ed.ro||o.ro, dis=ro?' disabled':'';
  const val=cpH(v==null?'':v); let ctl;
  const common=`data-p="${path}" data-k="${o.kind||'text'}"${dis}`;
  if(o.opts){
    const list=o.opts.slice(); if(v && list.indexOf(v)<0 && !list.some(x=>x&&x.v===v)) list.push(v);
    ctl=`<select ${common} onchange="cpEdIn(this,${o.struct?1:0})">${cpOpts(list,v,o.blank===undefined?'— Chọn —':o.blank)}</select>`;
  } else if(o.kind==='area') ctl=`<textarea ${common} oninput="cpEdIn(this)">${val}</textarea>`;
  else if(o.kind==='date') ctl=`<input type="date" ${common} value="${val}" onchange="cpEdIn(this,${o.struct?1:0})">`;
  else if(o.kind==='time') ctl=`<input type="time" ${common} value="${val}" onchange="cpEdIn(this)">`;
  else if(o.combo==='customer') ctl=`<div class="cp-cb"><input ${common} value="${val}" autocomplete="off" placeholder="${cpH(o.ph||'Gõ chữ đầu hoặc bấm mũi tên để chọn…')}" ${o.ro?'readonly':''} oninput="cpEdIn(this);cpCbOpen(this)" onfocus="cpCbOpen(this)" onkeydown="cpCbKey(event,this)" onblur="cpCbBlur(this)"><button type="button" class="cp-cb-arrow" tabindex="-1" ${dis} onmousedown="event.preventDefault()" onclick="cpCbToggle(this)">▾</button><div class="cp-cb-list" hidden></div></div>`;
  else ctl=`<input ${common} value="${val}" ${o.kind==='num'?'inputmode="decimal"':''} ${o.list?`list="${o.list}"`:''} ${o.ph?`placeholder="${cpH(o.ph)}"`:''} ${o.ro?'readonly':''} oninput="cpEdIn(this)" ${o.struct?'onchange="cpEdIn(this,1)"':''}>`;
  return `<label class="cp-f ${o.cls||''}"><span>${label}${o.req?' *':''}</span>${ctl}<div class="cp-err" data-e="${path}"></div>${o.hint?`<small>${o.hint}</small>`:''}</label>`;
}

// ── ô Khách hàng dạng hộp chọn: mũi tên + gõ chữ đầu/tên để lọc ─────────────
function cpCbMatch(q){
  const all=cpCustomers(); const k=cpCustKey(q); if(!k) return all;
  const pre=[], mid=[];
  all.forEach(c=>{ const i=c.key.indexOf(k); if(i===0) pre.push(c); else if(i>0) mid.push(c); });
  return pre.concat(mid);
}
function cpCbBox(el){ return el.closest('.cp-cb'); }
function cpCbRender(box,hi){
  const inp=box.querySelector('input'), list=box.querySelector('.cp-cb-list');
  const m=cpCbMatch(box._all?'':inp.value); box._items=m; box._hi=(hi==null?(m.length&&box._q?0:-1):hi);
  list.innerHTML=m.length?m.map((c,i)=>`<div class="cp-cb-it${i===box._hi?' on':''}" data-i="${i}" onmousedown="event.preventDefault();cpCbPick(this,${i})">${cpH(c.name)}</div>`).join(''):'<div class="cp-cb-empty">Không có khách hàng khớp — vẫn có thể gõ tên mới</div>';
  list.hidden=false;
}
function cpCbOpen(inp){ const box=cpCbBox(inp); if(inp.disabled||inp.readOnly) return; box._all=false; box._q=!!inp.value.trim(); cpCbRender(box); }
function cpCbToggle(btn){
  const box=cpCbBox(btn), inp=box.querySelector('input'), list=box.querySelector('.cp-cb-list'); if(inp.disabled) return;
  if(!list.hidden){ list.hidden=true; return; }
  box._all=true; box._q=false; inp.focus(); cpCbRender(box,-1); box._all=true;
}
function cpCbPick(itEl,i){
  const box=cpCbBox(itEl), inp=box.querySelector('input'), c=box._items[i]; if(!c) return;
  inp.value=c.name; cpEdIn(inp); box.querySelector('.cp-cb-list').hidden=true;
}
function cpCbBlur(inp){ const box=cpCbBox(inp); setTimeout(()=>{ const l=box.querySelector('.cp-cb-list'); if(l) l.hidden=true; },150); }
function cpCbKey(e,inp){
  const box=cpCbBox(inp), list=box.querySelector('.cp-cb-list');
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();
    if(list.hidden){ box._all=!inp.value.trim(); box._q=!!inp.value.trim(); cpCbRender(box,-1); }
    const n=(box._items||[]).length; if(!n) return;
    let h=box._hi+(e.key==='ArrowDown'?1:-1); h=h<0?n-1:h>=n?0:h;
    box._hi=h; list.querySelectorAll('.cp-cb-it').forEach((x,i)=>{ x.classList.toggle('on',i===h); if(i===h) x.scrollIntoView({block:'nearest'}); });
  } else if(e.key==='Enter'){
    if(!list.hidden && box._hi>=0){ e.preventDefault(); cpCbPick(list.querySelector('.cp-cb-it.on')||list.firstChild,box._hi); }
  } else if(e.key==='Escape'){ list.hidden=true; }
  else if(e.key==='Tab'){ if(!list.hidden && box._hi>=0 && box._q){ cpCbPick(list.querySelector('.cp-cb-it.on'),box._hi); } list.hidden=true; }
}
function cpEdIn(el, structural){
  const ed=cpUI.ed; if(!ed||ed.ro) return;
  const p=el.dataset.p; let v=el.value;
  cpPathSet(ed.rec, p, v);
  if(p==='_pick') return;
  cpEdDerive(p);
  if(structural) cpEdRender(); else cpEdValidateUI();
}
function cpEdDerive(p){
  const r=cpUI.ed.rec;
  if(r.type==='fqc') cpFqcRecalc(r);
  if(r.type==='chk' && /^lines\.\d+\.(thick|width|length|appearance)$/.test(p)){
    const i=+p.split('.')[1], l=r.lines[i];
    if(p.endsWith('appearance')){ if(l.appearance && l.appearance!=='OK') l.result='NG'; else if(l.appearance==='OK' && l.result==='NG' && !l.qtyNG) l.result=''; cpEdRender(); }
  }
}
function cpSetLine(i,k,v){ const ed=cpUI.ed; if(!ed||ed.ro) return; ed.rec.lines[i][k]=v; if(k==='result' && v==='OK'){ ed.rec.lines[i].qtyNG=null; } cpEdRender(); }
function cpAddLine(){ const ed=cpUI.ed; if(!ed||ed.ro) return; const L=ed.rec.lines, last=L[L.length-1]||{}; const n=cpBlankLine(ed.rec.form, (+last.n||L.length)+1); ed.rec.lines.push(n); cpEdRender(); }
function cpDelLine(i){ const ed=cpUI.ed; if(!ed||ed.ro||ed.rec.lines.length<2) return; ed.rec.lines.splice(i,1); cpEdRender(); }

// ── liên kết đơn hàng / lô ──────────────────────────────────────────────────
function cpOrderListHtml(){
  const l=cpOrders().slice(-400).reverse(); return `<datalist id="cpOrdList">${l.map(o=>`<option value="${cpH(cpOrderLabel(o))}"></option>`).join('')}</datalist>`;
}
function cpApplyOrder(rec,o){
  rec.orderId=o.id; rec.orderCode=(typeof ddCode==='function'?ddCode(o):o.po||o.id); rec.po=o.po||''; rec.customer=o.customer||rec.customer;
  if('spec' in rec && !rec.spec) rec.spec=(typeof specStr==='function'?specStr(o):'');
  const prods=cpProductsForOrder(o.id); if('productCode' in rec && !rec.productCode && prods.length===1) rec.productCode=prods[0].code;
}
function cpPickOrder(label){
  const ed=cpUI.ed; if(!ed||ed.ro) return;
  if(!label){ ed.rec.orderId=''; ed.rec.orderCode=''; ed.rec.po=''; cpEdRender(); return; }
  const o=cpOrders().find(o=>cpOrderLabel(o)===label); if(!o){ showToast('Không tìm thấy đơn hàng đó — chọn từ danh sách gợi ý', true); return; }
  cpApplyOrder(ed.rec,o);
  const lots=cpLotsForOrder(o.id, ed.rec.form||'');
  if('lot' in ed.rec && !ed.rec.lot && lots.length===1){ ed.rec.lot=lots[0].lot; if('machine' in ed.rec && !ed.rec.machine) ed.rec.machine=lots[0].machine; ed.rec.ledger={field:lots[0].ledgerField,id:lots[0].ledgerId}; }
  cpEdRender();
}
function cpScanResolve(){
  const ed=cpUI.ed; if(!ed||ed.ro) return; const inp=$('cpScan'); const hit=cpResolveCode(inp&&inp.value);
  if(!hit){ showToast('Không tìm thấy mã này trong đơn hàng / QR / sổ máy — kiểm tra lại hoặc chọn đơn thủ công', true); return; }
  const r=ed.rec; const o=hit.orderId?cpOrderById(hit.orderId):null; if(o) cpApplyOrder(r,o);
  if(hit.productCode && 'productCode' in r) r.productCode=hit.productCode;
  if(hit.lot && 'lot' in r) r.lot=hit.lot; if(hit.machine && 'machine' in r) r.machine=hit.machine;
  r.linkVia=hit.via+': '+inp.value.trim(); showToast('✓ Đã điền thông tin từ '+hit.via); cpEdRender();
}
function cpLinkBlock(){
  const ed=cpUI.ed, r=ed.rec, ro=ed.ro;
  const lots=cpLotsForOrder(r.orderId, r.form||''), prods=cpProductsForOrder(r.orderId);
  const st=cpLinkStatus(r);
  return `<div class="cp-sec">Liên kết đơn hàng / lô</div>${cpOrderListHtml()}
    <datalist id="cpLotList">${lots.map(x=>`<option value="${cpH(x.lot)}">${cpH(x.machine)}</option>`).join('')}</datalist>
    <datalist id="cpProdList">${prods.map(x=>`<option value="${cpH(x.code)}"></option>`).join('')}</datalist>
    <div class="cp-grid">
      <label class="cp-f w2"><span>Quét / nhập mã đơn, mã lô, mã QR</span><div style="display:flex;gap:6px"><input id="cpScan" placeholder="Quét bằng đầu đọc mã vạch hoặc dán mã…" ${ro?'disabled':''} onkeydown="if(event.key==='Enter'){event.preventDefault();cpScanResolve()}"><button type="button" class="cp-btn" ${ro?'disabled':''} onclick="cpScanResolve()">Tra</button></div></label>
      <label class="cp-f w2"><span>Đơn hàng</span><input list="cpOrdList" value="${cpH(r.orderId&&cpOrderById(r.orderId)?cpOrderLabel(cpOrderById(r.orderId)):'')}" placeholder="Gõ để tìm đơn hàng…" ${ro?'disabled':''} onchange="cpPickOrder(this.value)"></label>
    </div>
    <div class="cp-dinfo">Trạng thái liên kết: <span class="cp-pill ${st.c==='ok'?'ok':st.c==='warn'?'warn':'unk'}">${st.t}</span>${r.orderCode?' · Đơn <b>'+cpH(r.orderCode)+'</b>':''}${r.linkVia?' · '+cpH(r.linkVia):''}
      ${!r.orderId?' — chưa chọn đơn: phần mềm <b>không tự ghép</b> theo tên khách hàng/quy cách; QC bổ sung khi xác định được.':''}</div>`;
}

// ── dựng form theo loại ─────────────────────────────────────────────────────
function cpEdHtml(){
  const ed=cpUI.ed, r=ed.rec, f=cpFormDef(ed.key);
  const body = r.type==='chk'?cpEdChk(): r.type==='fqc'?cpEdFqc(): r.type==='ncr'?cpEdNcr(): r.type==='hold'?cpEdHold(): cpEd8d();
  const hist=(r.hist||[]).slice().reverse();
  return `<div class="cp-ed" id="cpEd">
    <div class="cp-bar"><button class="cp-btn" onclick="cpEdClose()">← Quay lại danh sách</button><span class="grow"></span>${r.source==='excel'?'<span class="cp-pill xl">Dữ liệu lịch sử từ Excel · '+cpH(r.src&&r.src.sheet)+' dòng '+cpH(r.src&&r.src.row)+'</span>':''}</div>
    <h3>${f.icon} ${cpH(f.title)}</h3>
    <div class="cp-dinfo">Mã phiếu: <b>${cpH(r.code||'(tự cấp khi lưu)')}</b> · Trạng thái: <b>${cpH(r.status==='draft'?'Bản nháp':r.status==='done'?'Đã hoàn tất':r.status)}</b>${r.void?' · <span class="cp-pill ng">ĐÃ HUỶ</span>':''}${r.createdBy?' · Tạo bởi '+cpH(r.createdBy)+' '+cpFmtTs(r.createdAt):''}${r.updatedBy&&r.rev>1?' · Sửa cuối bởi '+cpH(r.updatedBy)+' '+cpFmtTs(r.updatedAt):''}</div>
    ${r.review&&r.review.length&&!r.reviewed?`<div class="cp-banner warn"><b>Dữ liệu cần kiểm tra:</b><ul style="margin:4px 0 0 18px">${r.review.map(x=>`<li>${cpH(x)}</li>`).join('')}</ul></div>`:''}
    <div id="cpErrSum"></div>${body}
    ${cpHistoryHtml(r)}
    ${hist.length?`<div class="cp-sec">Nhật ký thay đổi</div><ul class="cp-hist">${hist.map(h=>`<li><b>${cpFmtTs(h.ts)}</b> · ${cpH(h.by)} — ${cpH(h.act)}${h.reason?' ("'+cpH(h.reason)+'")':''}${(h.ch&&h.ch.length)?'<br><span style="color:#64748b">'+h.ch.map(cpH).join('; ')+'</span>':''}</li>`).join('')}</ul>`:''}
    ${cpEdFooter()}</div>`;
}
function cpApprHint(){ return ''; }

function cpEdChk(){
  const ed=cpUI.ed, r=ed.rec, form=r.form, dt=form==='dothang', ro=ed.ro;
  const ws=['Xưởng 1','Xưởng 2','Xưởng 3'], machines=cpMachinesFor(form);
  let h=cpLinkBlock()+`<div class="cp-sec">Thông tin phiếu</div><div class="cp-grid">
    ${cpFld('date','Ngày',{kind:'date',req:1})}
    ${dt?'':cpFld('shift','Ca',{opts:['Ca 1','Ca 2','Ca 3'],blank:false})}
    ${cpFld('customer','Khách hàng',{combo:'customer',hint:r.orderId?'Tự điền từ đơn hàng':''})}
    ${cpFld('spec','Quy cách',{req:1,ph:'vd 10*60, Ø71'})}
    ${cpFld('workshop','Xưởng sản xuất',{opts:ws})}
    ${machines.length?cpFld('machine','Máy',{opts:machines}):''}
    ${cpFld('productCode','Mã sản phẩm',{list:'cpProdList',hint:r.productCode?'':'Để trống = CHƯA XÁC ĐỊNH'})}
    ${cpFld('lot','Mã lô',{list:'cpLotList',hint:r.lot?'':'Để trống = CHƯA XÁC ĐỊNH'})}
    ${dt?cpFld('standard','Tiêu chuẩn',{}):''}
    ${cpFld('inspector','Người kiểm tra',{ro:!cpCan('editAny')})}
  </div>`;
  if(!dt) h+=`<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700;font-size:12.5px">Dung sai tuỳ chọn (tự cảnh báo khi số đo ngoài khoảng)</summary><div class="cp-grid" style="margin-top:6px">
    ${['thick:Dày'].concat(form!=='dun'?[]:[]).concat(['width:Rộng']).concat(form==='dun'?[]:['length:Dài']).map(x=>{ const [k,t]=x.split(':'); return cpFld('tol.'+k+'.min',t+' – min',{kind:'num'})+cpFld('tol.'+k+'.max',t+' – max',{kind:'num'}); }).join('')}</div></details>`;
  h+=`<div class="cp-sec">Kết quả đo theo mẫu</div><div class="cp-lines"><table class="cp-lt stack"><thead><tr><th>Mẫu</th><th>Giờ</th>${dt?'<th>Độ thẳng cạnh</th><th>Độ thẳng mặt</th><th>Độ vểnh</th><th>Độ vặn</th>':`<th>Dày</th><th>Rộng</th>${form==='dun'?'':'<th>Dài</th>'}<th style="min-width:200px">Ngoại quan</th><th>SL ảnh hưởng</th>`}<th>Kết luận</th><th></th></tr></thead><tbody>`;
  r.lines.forEach((l,i)=>{
    const pfx='lines.'+i+'.';
    const LBL={time:'Giờ',thick:'Dày',width:'Rộng',length:'Dài',edge:'Độ thẳng cạnh',face:'Độ thẳng mặt',warp:'Độ vểnh',twist:'Độ vặn'};
    const cell=(k,o)=>`<td data-label="${LBL[k]||''}">${cpLineIn(pfx+k,o)}</td>`;
    h+=`<tr class="${l.result==='NG'?'ngrow':''}"><td style="width:56px" data-label="Mẫu">${cpLineIn(pfx+'n',{kind:'num'})}</td>${cell('time',{kind:'time'})}`;
    if(dt) h+=['edge','face','warp','twist'].map(k=>cell(k,{list:'cpDat',ph:'Đạt / mm'})).join('');
    else{
      h+=cell('thick',{kind:'num'})+cell('width',{kind:'num'})+(form==='dun'?'':cell('length',{kind:'num'}));
      const d=cpDefect(l.appearance);
      h+=`<td data-label="Ngoại quan">${cpLineIn(pfx+'appearance',{opts:cpDefects().map(x=>({v:x.code,t:x.code+(x.code==='OK'?'':' – '+x.name)})),blank:false,struct:1})}
        ${l.appearance&&l.appearance!=='OK'?'':(l.appearanceNote?`<div class="cp-dinfo">Ghi chú gốc: ${cpH(l.appearanceNote)}</div>`:'')}
        ${d&&d.code!=='OK'?`<div class="cp-dinfo"><b>Đạt khi:</b> ${cpH(d.accept)}<br><b>Phản ứng khi NG:</b> ${cpH(d.reaction)}</div>`:''}</td>
        <td style="width:90px" data-label="SL NG">${l.result==='NG'?cpLineIn(pfx+'qtyNG',{kind:'num',ph:'SL'}):'<span style="color:#94a3b8">—</span>'}</td>`;
    }
    h+=`<td data-label="Kết luận"><div class="cp-seg"><button type="button" class="ok ${l.result==='OK'?'on':''}" ${ro?'disabled':''} onclick="cpSetLine(${i},'result','OK')">OK</button><button type="button" class="ng ${l.result==='NG'?'on':''}" ${ro?'disabled':''} onclick="cpSetLine(${i},'result','NG')">NG</button></div>
      ${l.resultRaw&&l.result==='UNK'?`<div class="cp-dinfo">Gốc: "${cpH(l.resultRaw)}"</div>`:''}<div class="cp-err" data-e="${pfx}result"></div><div class="cp-err" data-e="${pfx}x"></div></td>
      <td class="cp-lt-x">${ro||r.lines.length<2?'':`<button type="button" class="cp-btn" title="Xoá dòng" onclick="cpDelLine(${i})">✕</button>`}</td></tr>`;
  });
  h+=`</tbody></table></div><datalist id="cpDat"><option value="Đạt"></option></datalist>${ro?'':'<div class="cp-bar"><button type="button" class="cp-btn big" onclick="cpAddLine()">➕ Thêm dòng đo</button></div>'}
    <div class="cp-bar"><span class="cp-res">Kết luận phiếu: <b id="cpResB" class="unk">—</b></span></div>`;
  return h;
}
function cpLineIn(path,o){
  const ed=cpUI.ed, v=cpPathGet(ed.rec,path), ro=ed.ro, dis=ro?' disabled':'';
  const k=o.kind||'text';
  if(o.opts) return `<select data-p="${path}" data-k="text"${dis} onchange="cpEdIn(this,${o.struct?1:0})">${cpOpts(o.opts,v,o.blank===false?false:'—')}</select><div class="cp-err" data-e="${path}"></div>`;
  if(k==='time') return `<input type="time" data-p="${path}" data-k="time"${dis} value="${cpH(v||'')}" onchange="cpEdIn(this)"><div class="cp-err" data-e="${path}"></div>`;
  return `<input data-p="${path}" data-k="${k}"${dis} value="${cpH(v==null?'':v)}" ${k==='num'?'inputmode="decimal"':''} ${o.list?`list="${o.list}"`:''} ${o.ph?`placeholder="${cpH(o.ph)}"`:''} oninput="cpEdIn(this)"><div class="cp-err" data-e="${path}"></div>`;
}

// ── FQC ──────────────────────────────────────────────────────────────────────
function cpFqcRecalc(r){
  const lk=cpAqlLookup(r.lotQty, r.level, r.aqlMajor, r.aqlMinor, r.aqlCritical);
  r.aqlCode=lk.ok?lk.code:''; r.sampleSize=lk.ok?lk.n:''; r.acMajor=lk.major?lk.major.ac:''; r.reMajor=lk.major?lk.major.re:''; r.acMinor=lk.minor?lk.minor.ac:''; r.reMinor=lk.minor?lk.minor.re:'';
  r.acCritical=lk.critical?lk.critical.ac:0;
  const ev=cpAqlEvaluate(lk, r.majorNG, r.minorNG, r.criticalNG);
  r.result=ev.result; r.evalReasons=ev.reasons; r._lk=lk;
}
function cpEdFqc(){
  const ed=cpUI.ed, r=ed.rec; cpFqcRecalc(r); const lk=r._lk, levels=((cpAqlRec()||{}).levels)||[];
  const lvOpts=levels.map(x=>({v:x,t:'AQL '+x}));
  return cpLinkBlock()+`<div class="cp-sec">Thông tin lô</div><div class="cp-grid">
    ${cpFld('date','Ngày',{kind:'date',req:1})}${cpFld('productCode','Mã sản phẩm',{list:'cpProdList'})}${cpFld('customer','Khách hàng',{combo:'customer'})}
    ${cpFld('po','PO',{})}${cpFld('lot','Mã lô',{list:'cpLotList'})}${cpFld('lotQty','Số lượng lô',{kind:'num',req:1,hint:'Quy mô lô (số lượng)'})}
    ${cpFld('inspector','QA/QC',{ro:!cpCan('editAny')})}</div>
    <div class="cp-sec">Kế hoạch lấy mẫu (tự tra bảng AQL)</div><div class="cp-grid">
    ${cpFld('level','Level kiểm tra',{opts:['II','I','III','S-1','S-2','S-3','S-4'],blank:false,struct:1,hint:'Workbook chỉ có bảng Level II'})}
    ${cpFld('aqlMajor','AQL Major',{opts:lvOpts,struct:1,req:1})}${cpFld('aqlMinor','AQL Minor',{opts:lvOpts,struct:1})}${cpFld('aqlCritical','AQL Critical (nếu áp dụng)',{opts:lvOpts,struct:1,hint:'Để trống = không chấp nhận lỗi Critical'})}</div>
    <div class="cp-banner ${lk.ok?'info':'warn'}">${lk.ok?`Code <b>${lk.code}</b> · Cỡ mẫu <b>${lk.n}</b> (lô ${lk.range}) · Major ${lk.major?`Ac <b>${lk.major.ac}</b> / Re <b>${lk.major.re}</b>`:'—'} · Minor ${lk.minor?`Ac <b>${lk.minor.ac}</b> / Re <b>${lk.minor.re}</b>`:'—'} · Critical ${lk.critical?`Ac <b>${lk.critical.ac}</b>`:'không chấp nhận'}`:cpH(lk.errors.join(' · '))}
      <br><small>${cpH(CP_AQL_WARN)}</small></div>
    <div class="cp-sec">Kết quả kiểm</div><div class="cp-grid">${cpFld('majorNG','Số lỗi Major',{kind:'num'})}${cpFld('minorNG','Số lỗi Minor',{kind:'num'})}${cpFld('criticalNG','Số lỗi Critical',{kind:'num'})}${cpFld('note','Ghi chú',{kind:'area',cls:'wf'})}</div>
    <div class="cp-bar"><span class="cp-res">Kết luận lô theo AQL: <b id="cpResB" class="${CP_RES[r.result].c}">${CP_RES[r.result].t}</b></span></div>
    ${r.evalReasons&&r.evalReasons.length?`<div class="cp-banner err">${cpH(r.evalReasons.join('; '))} — <b>không được RELEASE lô</b>; tạo HOLD/NCR.</div>`:(r.result==='OK'?'<div class="cp-banner ok">Đạt theo bảng AQL đang áp dụng. Việc giải phóng lô vẫn do QA phê duyệt trong HOLD/RELEASE (nếu lô đang HOLD).</div>':'')}`;
}

// ── NCR ──────────────────────────────────────────────────────────────────────
function cpEdNcr(){
  const ed=cpUI.ed, r=ed.rec, locked=r.status==='Chờ phê duyệt'||r.status==='Đã đóng';
  const stg=['Đùn','Rút','Đánh bóng','Cắt','Độ thẳng','FQC','Nguyên liệu','Khác'];
  return cpLinkBlock()+`<div class="cp-sec">Phiếu NCR</div><div class="cp-grid">
    ${cpFld('date','Ngày',{kind:'date',req:1})}${cpFld('productCode','Mã sản phẩm',{list:'cpProdList'})}${cpFld('lot','Mã lô',{list:'cpLotList'})}${cpFld('stage','Công đoạn',{opts:stg,req:1})}
    ${cpFld('klass','Phân loại',{opts:CP_KLASS,req:1})}${cpFld('qtyAffected','Số lượng ảnh hưởng',{kind:'num',req:1})}${cpFld('standard','Tiêu chuẩn',{cls:'w2'})}
    ${cpFld('desc','Mô tả NG',{kind:'area',cls:'wf',req:1})}${cpFld('containment','Hành động ngăn chặn',{kind:'area',cls:'wf'})}
    ${cpFld('cause','Nguyên nhân (do người điều tra xác định — hệ thống không tự kết luận)',{kind:'area',cls:'wf'})}${cpFld('action','Hành động khắc phục',{kind:'area',cls:'wf'})}
    ${cpFld('verification','Xác nhận hiệu lực',{kind:'area',cls:'wf',ro:!cpCan('verify')})}${cpFld('disposition','Quyết định xử lý',{opts:CP_DISPO})}
    ${cpFld('owner','Người phụ trách (QA/QC)',{opts:cpQaUsers()})}</div>
    <div class="cp-dinfo">${r.holdId&&cpGet(r.holdId)?'HOLD liên quan: <b>'+cpH(cpGet(r.holdId).code)+'</b> · ':''}${r.sourceId&&cpGet(r.sourceId)?'Phiếu gốc: <b>'+cpH(cpGet(r.sourceId).code)+'</b> · ':''}${r.eightdId&&cpGet(r.eightdId)?'8D: <b>'+cpH(cpGet(r.eightdId).code)+'</b>':''}
      ${r.approvedBy?`<br>QA phê duyệt: <b>${cpH(r.approvedBy)}</b> ${cpFmtTs(r.approvedAt)}`:''}${r.verifiedBy?`<br>Xác nhận hiệu lực: <b>${cpH(r.verifiedBy)}</b> ${cpFmtTs(r.verifiedAt)}`:''}</div>`;
}
function cpQaUsers(){ return (DB.users||[]).filter(u=>u&&(u.qcRole||u.role==='admin')).map(u=>u.name||u.username); }

// ── HOLD / RELEASE ───────────────────────────────────────────────────────────
function cpVerifyCandidates(h){
  if(!h.lot && !h.orderId) return [];
  const since=cpYmd(new Date(h.heldAt||0));
  return cpRecs().filter(x=>cpIsInspection(x) && !x.void && x.status==='done' && x.result==='OK' && (x.date||'')>=since &&
    ((h.lot && cpNorm(x.lot)===cpNorm(h.lot)) || (h.orderId && x.orderId===h.orderId && (!h.lot || !x.lot || cpNorm(x.lot)===cpNorm(h.lot)))));
}
function cpHoldReleaseCheck(h){
  const e=[];
  if(!cpCan('approve')) e.push('Chỉ QA/Quản lý chất lượng hoặc Quản trị viên được RELEASE');
  if(h.status!=='Chờ phê duyệt') e.push('Lô phải ở trạng thái "Chờ phê duyệt"');
  if(h.disposition!=='RELEASE – giải phóng') e.push('Quyết định xử lý phải là "RELEASE – giải phóng"');
  if(!String(h.investigation||'').trim()) e.push('Chưa có kết quả điều tra');
  if(!h.lot && !h.orderId) e.push('Chưa xác định mã lô/đơn hàng của lô bị HOLD — không thể đối chiếu phiếu kiểm tra');
  const v=h.verifyId&&cpGet(h.verifyId);
  if(!v) e.push('Chưa gắn phiếu kiểm tra lại đạt (OK) cho đúng lô này');
  else if(v.result!=='OK') e.push('Phiếu kiểm tra đã gắn không đạt');
  const n=h.ncrId&&cpGet(h.ncrId); if(n && n.status!=='Đã đóng' && n.status!=='Chờ phê duyệt') e.push('NCR liên quan ('+n.code+') chưa hoàn tất xử lý');
  return e;
}
function cpEdHold(){
  const ed=cpUI.ed, r=ed.rec, cands=cpVerifyCandidates(r), final=r.status==='RELEASE'||r.status==='Phế phẩm';
  const ncrs=cpOf('ncr').map(n=>({v:n.id,t:n.code+' – '+String(n.desc||'').slice(0,40)}));
  const chk=r.status==='Chờ phê duyệt'?cpHoldReleaseCheck(r):[];
  return cpLinkBlock()+`<div class="cp-sec">Phiếu HOLD</div>
    <div class="cp-steps" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));margin-bottom:8px">${['HOLD','Đang điều tra','Chờ phê duyệt','RELEASE','Phế phẩm'].map(s=>`<div class="cp-step ${r.status===s?'doing':''}" style="text-align:center;padding:6px"><b>${s}</b></div>`).join('')}</div>
    <div class="cp-grid">
    ${cpFld('productCode','Mã sản phẩm',{list:'cpProdList'})}${cpFld('lot','Mã lô',{list:'cpLotList',req:1})}${cpFld('qty','Số lượng',{kind:'num',req:1})}
    <label class="cp-f"><span>Ngày giờ HOLD</span><input readonly value="${cpFmtTs(r.heldAt)}"></label>
    ${cpFld('holdBy','Người HOLD',{ro:true})}${cpFld('owner','QA/QC phụ trách',{opts:cpQaUsers()})}
    ${cpFld('reason','Lý do HOLD',{kind:'area',cls:'wf',req:1})}${cpFld('scope','Phạm vi ảnh hưởng',{kind:'area',cls:'wf'})}${cpFld('containment','Hành động ngăn chặn',{kind:'area',cls:'wf'})}
    ${cpFld('investigation','Kết quả điều tra',{kind:'area',cls:'wf'})}${cpFld('disposition','Quyết định xử lý',{opts:CP_HOLD_DISPO})}
    ${cpFld('ncrId','NCR liên quan',{opts:ncrs})}
    <label class="cp-f w2"><span>Phiếu kiểm tra lại đạt (điều kiện RELEASE)</span><select data-p="verifyId" ${ed.ro||final?'disabled':''} onchange="cpEdIn(this,1)">${cpOpts(cands.map(x=>({v:x.id,t:x.code+' · '+cpFmtDate(x.date)+' · '+cpFormLabelOf(x)})),r.verifyId,'— Chưa gắn —')}</select><small>${cands.length?'':'Chưa có phiếu OK nào cùng mã lô/đơn sau thời điểm HOLD — hãy tạo phiếu kiểm tra lại.'}</small></label>
    <label class="cp-f"><span>Người RELEASE</span><input readonly value="${cpH(r.releaseBy||'')}"></label><label class="cp-f"><span>Ngày giờ RELEASE</span><input readonly value="${r.releaseAt?cpFmtTs(r.releaseAt):''}"></label></div>
    ${chk.length?`<div class="cp-banner warn"><b>Điều kiện RELEASE chưa đủ:</b><ul style="margin:4px 0 0 18px">${chk.map(x=>`<li>${cpH(x)}</li>`).join('')}</ul></div>`:''}`;
}

// ── 8D ───────────────────────────────────────────────────────────────────────
function cpEd8d(){
  const ed=cpUI.ed, r=ed.rec, ro=ed.ro||r.status==='Đã đóng', t=cpToday(), p=cp8dProgress(r);
  const ncrs=cpOf('ncr').map(n=>({v:n.id,t:n.code}));
  let h=cpLinkBlock()+`<div class="cp-sec">Hồ sơ 8D</div><div class="cp-grid">${cpFld('title','Vấn đề / tiêu đề',{cls:'w2',req:1})}${cpFld('trigger','Nguồn phát sinh',{opts:['Lỗi nội bộ','Khiếu nại khách hàng','Lỗi lặp lại','Khác']})}
    ${cpFld('leader','Trưởng nhóm 8D',{})}${cpFld('customer','Khách hàng',{combo:'customer'})}${cpFld('productCode','Mã sản phẩm',{list:'cpProdList'})}${cpFld('lot','Mã lô',{list:'cpLotList'})}${cpFld('ncrId','NCR liên quan',{opts:ncrs})}</div>
    <div class="cp-bar"><div class="cp-prog grow"><i style="width:${Math.round(p.done/9*100)}%"></i></div><b>${p.done}/9 bước</b>${p.late?`<span class="cp-pill ng">${p.late} bước quá hạn</span>`:''}</div><div class="cp-steps">`;
  r.steps.forEach((s,i)=>{
    const late=s.status!=='Hoàn thành' && s.due && s.due<t, pf='steps.'+i+'.';
    h+=`<div class="cp-step ${s.status==='Hoàn thành'?'done':late?'late':s.status==='Đang xử lý'?'doing':''}"><h5>${cpH(s.step)} – ${cpH(s.title)} ${late?'<span class="cp-pill ng">Quá hạn</span>':''}</h5><div class="cp-grid">`;
    if(s.step==='D2'){ h+=['what:What – Việc gì','where:Where – Ở đâu','when:When – Khi nào','who:Who – Ai','why:Why – Tại sao','how:How – Như thế nào','howMany:How many – Bao nhiêu'].map(x=>{ const [k,l]=x.split(':'); return cpFld('w5h2.'+k,l,{}); }).join(''); }
    h+=cpFld(pf+'content','Nội dung',{kind:'area',cls:'wf'})+cpFld(pf+'owner','Người phụ trách',{})+cpFld(pf+'due','Hạn hoàn thành',{kind:'date'})+cpFld(pf+'evidence','Bằng chứng (mô tả / đường dẫn)',{cls:'w2'})+cpFld(pf+'status','Trạng thái',{opts:['Open','Đang xử lý','Hoàn thành'],blank:false})+`</div>${s.doneAt?`<div class="cp-dinfo">Hoàn thành bởi ${cpH(s.doneBy)} lúc ${cpFmtTs(s.doneAt)}</div>`:''}</div>`;
  });
  return h+'</div>';
}

// ── chân trang: nút theo trạng thái & quyền ─────────────────────────────────
function cpEdFooter(){
  const ed=cpUI.ed, r=ed.rec; let b='';
  const editable=!ed.ro;
  if(r.type==='chk'||r.type==='fqc'){
    if(editable){
      if(!ed.isNew && r.status==='done') b+=`<input id="cpReason" style="max-width:340px" placeholder="Lý do sửa (bắt buộc)" value="${cpH(ed.reason)}" oninput="cpUI.ed.reason=this.value">`;
      if(r.status==='draft') b+=`<button class="cp-btn" onclick="cpSave(false)">💾 Lưu nháp</button>`;
      b+=`<button class="cp-btn g big" onclick="cpSave(true)">✔ Hoàn tất</button>`;
      if(r.status==='draft' && !ed.isNew) b+=`<button class="cp-btn d" onclick="cpDraftDelete()">🗑 Xoá nháp</button>`;
    } else if(cpCan('editAny') && r.status==='done' && !r.void){
      b+=`<button class="cp-btn p" onclick="cpUI.ed.ro=false;cpEdRender()">✏️ Sửa (ghi lý do & nhật ký)</button><button class="cp-btn d" onclick="cpVoid()">🚫 Huỷ phiếu</button>`;
    }
    if(cpCanDeleteRec(r) && !ed.isNew && !(editable && r.status==='draft')) b+=`<button class="cp-btn d" onclick="cpDeleteRec()" title="Chỉ Quản trị viên — xoá hẳn phiếu, không khôi phục được">🗑 Xoá phiếu (Admin)</button>`;
    if(r.type==='fqc' && r.status==='done' && r.result==='NG' && !r.ngFollow && cpCan('create')) b+=`<button class="cp-btn d" onclick="cpNgDialog('${r.id}')">⚠ Xử lý NG (HOLD/NCR)</button>`;
  } else if(r.type==='ncr'){
    const s=r.status, can=cpCan('create');
    if(editable && s!=='Chờ phê duyệt' && s!=='Đã đóng') b+=`<button class="cp-btn" onclick="cpSave(false)">💾 Lưu</button>`;
    if(can && s==='Mở') b+=`<button class="cp-btn p" onclick="cpNcrAct('start')">▶ Bắt đầu xử lý</button>`;
    if(cpCan('verify') && (s==='Đang xử lý')) b+=`<button class="cp-btn" onclick="cpNcrAct('verify')">☑ Xác nhận hiệu lực</button>`;
    if(can && s==='Đang xử lý') b+=`<button class="cp-btn p" onclick="cpNcrAct('submit')">📤 Gửi QA phê duyệt</button>`;
    if(cpCan('approve') && s==='Chờ phê duyệt') b+=`<button class="cp-btn g" onclick="cpNcrAct('approve')">✔ QA phê duyệt & đóng</button><button class="cp-btn" onclick="cpNcrAct('reopen')">↩ Trả lại xử lý</button>`;
  } else if(r.type==='hold'){
    const s=r.status;
    if(editable && (s==='HOLD'||s==='Đang điều tra')) b+=`<button class="cp-btn" onclick="cpSave(false)">💾 Lưu</button>`;
    if(cpCan('investigate') && s==='HOLD') b+=`<button class="cp-btn p" onclick="cpHoldAct('investigate')">🔎 Bắt đầu điều tra</button>`;
    if(cpCan('investigate') && s==='Đang điều tra') b+=`<button class="cp-btn p" onclick="cpHoldAct('submit')">📤 Gửi phê duyệt</button>`;
    if(s==='Chờ phê duyệt'){
      if(cpCan('approve')) b+=`<button class="cp-btn g" onclick="cpHoldAct('release')">✔ RELEASE lô</button><button class="cp-btn d" onclick="cpHoldAct('scrap')">Phế phẩm</button><button class="cp-btn" onclick="cpHoldAct('reopen')">↩ Trả về điều tra</button>`;
      else b+=`<span class="cp-banner warn" style="margin:0">🔒 Chờ QA/Quản lý chất lượng phê duyệt — bạn không có quyền RELEASE.</span>`;
    }
    if(s==='HOLD'||s==='Đang điều tra'){ if(!cpCan('approve')) b+=`<span class="cp-dinfo">🔒 Chỉ QA được RELEASE lô.</span>`; }
  } else if(r.type==='eightd'){
    if(r.status!=='Đã đóng'){
      if(editable) b+=`<button class="cp-btn p" onclick="cpSave(false)">💾 Lưu hồ sơ 8D</button>`;
      if(cpCan('approve')) b+=`<button class="cp-btn g" onclick="cpEightdClose()">✔ Đóng hồ sơ (D8)</button>`;
    }
  }
  return `<div class="cp-stick">${r.type==='chk'||r.type==='fqc'?'':''}${b}<button class="cp-btn" onclick="cpEdClose()">Đóng</button></div>`;
}

// ── kiểm tra dữ liệu nhập (hiện lỗi ngay) ───────────────────────────────────
function cpValidate(rec, complete){
  const E={}, nonNum=v=>v!==''&&v!=null&&cpNum(v)===null;
  const add=(p,m)=>{ if(!E[p]) E[p]=m; };
  if(rec.date==null||rec.date==='') add('date','Chọn ngày'); else if(rec.date>cpToday() && rec.source!=='excel') add('date','Ngày ở tương lai');
  if(rec.type==='chk'){
    if(complete && !String(rec.spec||'').trim()) add('spec','Nhập quy cách');
    if(!rec.lines.length) add('lines.0.x','Cần ít nhất 1 dòng đo');
    rec.lines.forEach((l,i)=>{
      const p='lines.'+i+'.';
      if(rec.form==='dothang'){
        ['edge','face','warp','twist'].forEach(k=>{ if(complete && !String(l[k]||'').trim()) add(p+k,'Nhập giá trị hoặc "Đạt"'); });
      } else {
        ['thick','width','length'].forEach(k=>{
          if(!(k in l)) return;
          if(nonNum(l[k])) add(p+k,'Phải là số');
          else{ const t=rec.tol&&rec.tol[k], n=cpNum(l[k]); if(t && n!==null){ const mn=cpNum(t.min), mx=cpNum(t.max);
            if((mn!==null&&n<mn)||(mx!==null&&n>mx)){ add(p+k,'Ngoài dung sai'+(l.result==='OK'?' — không thể chọn OK':'')); if(l.result==='OK') add(p+'x','Số đo ngoài dung sai nhưng chọn OK'); } } }
        });
        if(complete && !['thick','width','length'].some(k=>k in l&&cpNum(l[k])!==null) && !(l.appearance)) add(p+'x','Nhập ít nhất một số đo hoặc ngoại quan');
        if(l.result==='NG' && (!l.appearance||l.appearance==='OK') && !String(l.appearanceNote||'').trim()) add(p+'appearance','NG: chọn mã lỗi ngoại quan (hoặc ghi mô tả)');
        if(l.result==='OK' && l.appearance && l.appearance!=='OK') add(p+'result','Ngoại quan có lỗi — không thể kết luận OK');
        if(l.result==='NG' && nonNum(l.qtyNG)) add(p+'qtyNG','Phải là số');
      }
      if(complete && l.result!=='OK' && l.result!=='NG') add(p+'result','Chọn OK hoặc NG');
      if(l.time && !/^\d{1,2}:\d{2}$/.test(l.time)) add(p+'time','Giờ không hợp lệ');
    });
  } else if(rec.type==='fqc'){
    cpFqcRecalc(rec);
    if(!(Number(rec.lotQty)>=1)) add('lotQty','Nhập số lượng lô');
    if(!rec.aqlMajor && !rec.aqlMinor) add('aqlMajor','Chọn AQL Major hoặc Minor');
    if(rec._lk && rec._lk.errors.some(x=>/Level/.test(x))) add('level','Level này chưa có bảng được duyệt');
    ['majorNG','minorNG','criticalNG'].forEach(k=>{ const n=cpNum(rec[k]); if(n===null||n<0||n%1) add(k,'Số nguyên ≥ 0'); else if(rec.sampleSize && n>rec.sampleSize) add(k,'Lớn hơn cỡ mẫu ('+rec.sampleSize+')'); });
  } else if(rec.type==='ncr'){
    if(complete||true){ if(!String(rec.desc||'').trim()) add('desc','Mô tả NG'); if(!rec.stage) add('stage','Chọn công đoạn'); if(!rec.klass) add('klass','Chọn phân loại'); if(!(cpNum(rec.qtyAffected)>0)) add('qtyAffected','Nhập số lượng ảnh hưởng (> 0)'); }
  } else if(rec.type==='hold'){
    if(!String(rec.reason||'').trim()) add('reason','Nhập lý do HOLD');
    if(!(cpNum(rec.qty)>0)) add('qty','Nhập số lượng (> 0)');
    if(!String(rec.lot||'').trim() && !rec.orderId && !String(rec.productCode||'').trim()) add('lot','Cần mã lô, mã SP hoặc đơn hàng để xác định lô bị HOLD');
  } else if(rec.type==='eightd'){
    if(!String(rec.title||'').trim()) add('title','Nhập tiêu đề vấn đề');
  }
  return E;
}
function cpEdValidateUI(){
  const ed=cpUI.ed; if(!ed) return;
  const r=ed.rec; if(r.type==='chk') r.result=cpCalcResult(cpNormalized(r));
  const E=ed.ro?{}:cpValidate(r, true); ed.errs=E;
  document.querySelectorAll('#cpEd [data-e]').forEach(el=>{ const m=E[el.dataset.e]; el.textContent=m||''; const lab=el.closest('.cp-f'); if(lab) lab.classList.toggle('bad',!!m); });
  document.querySelectorAll('#cpEd .cp-lt td').forEach(td=>{ td.classList.remove('bad'); });
  const rb=$('cpResB'); if(rb && r.type==='chk'){ const x=CP_RES[r.result]||CP_RES.UNK; rb.className=x.c; rb.textContent=x.t; }
  const n=Object.keys(E).length, s=$('cpErrSum'); if(s) s.innerHTML=n&&!ed.ro?`<div class="cp-banner err">Còn <b>${n}</b> mục cần sửa trước khi bấm <b>Hoàn tất</b> (bản nháp vẫn lưu được).</div>`:'';
}
// đổi chuỗi nhập thành số khi lưu
function cpNormalized(rec){
  const r=cpClone(rec);
  if(r.type==='chk') r.lines.forEach(l=>{ ['thick','width','length','n','qtyNG'].forEach(k=>{ if(k in l){ const n=cpNum(l[k]); l[k]=(l[k]===''||l[k]==null)?null:(n===null?l[k]:n); } }); });
  if(r.type==='fqc') ['lotQty','majorNG','minorNG','criticalNG'].forEach(k=>{ const n=cpNum(r[k]); r[k]=n===null?r[k]:n; });
  if(r.type==='ncr') r.qtyAffected=cpNum(r.qtyAffected)===null?r.qtyAffected:cpNum(r.qtyAffected);
  if(r.type==='hold') r.qty=cpNum(r.qty)===null?r.qty:cpNum(r.qty);
  Object.keys(r).forEach(k=>{ if(k[0]==='_') delete r[k]; });
  return r;
}
function cpDiff(a,b){
  const ch=[]; const skip=new Set(['hist','rev','updatedAt','updatedBy','evalReasons','result']);
  Object.keys(b).forEach(k=>{ if(skip.has(k)||k[0]==='_') return; const x=JSON.stringify(a&&a[k]), y=JSON.stringify(b[k]); if(x!==y){ if(k==='lines'){ ch.push('Dòng đo thay đổi ('+((a&&a.lines)||[]).length+'→'+b.lines.length+' dòng)'); const n=Math.max(((a&&a.lines)||[]).length,b.lines.length); for(let i=0;i<n;i++){ const o=((a&&a.lines)||[])[i]||{}, w=b.lines[i]||{}; Object.keys(w).forEach(f=>{ if(JSON.stringify(o[f])!==JSON.stringify(w[f])) ch.push('dòng '+(i+1)+' '+f+': '+(o[f]==null||o[f]===''?'∅':o[f])+' → '+(w[f]==null||w[f]===''?'∅':w[f])); }); } } else ch.push(k+': '+(x===undefined?'∅':String(a[k]))+' → '+String(b[k])); } });
  return ch;
}

// ── lưu ──────────────────────────────────────────────────────────────────────
function cpSave(complete, quiet){
  const ed=cpUI.ed; if(!ed||ed.ro) return null;
  if(ed.isNew && cpGuard('create')) return null;
  const rec=cpNormalized(ed.rec), E=cpValidate(ed.rec, !!complete);
  if(complete||rec.type==='ncr'||rec.type==='hold'||rec.type==='eightd'){ if(Object.keys(E).length){ ed.errs=E; cpEdValidateUI(); showToast('Còn lỗi nhập liệu — xem các ô đỏ', true); const f=document.querySelector('#cpEd .cp-f.bad, #cpEd .cp-err:not(:empty)'); if(f) f.scrollIntoView({block:'center'}); return null; } }
  else { const hard=Object.keys(E).filter(k=>/^lines\.\d+\.(thick|width|length|time)$|^date$/.test(k)); if(hard.length){ cpEdValidateUI(); showToast('Sửa các ô sai định dạng rồi lưu nháp', true); return null; } }
  const wasDone=ed.orig && ed.orig.status==='done', wasNew=ed.isNew;
  if(wasDone && !String(ed.reason||'').trim()){ showToast('Nhập lý do sửa phiếu đã hoàn tất', true); const i=$('cpReason'); if(i) i.focus(); return null; }
  if(rec.type==='chk') rec.result=cpCalcResult(rec);
  if(rec.type==='chk'||rec.type==='fqc') rec.status=complete?'done':'draft';
  if(!rec.code) rec.code=cpNewCode(rec.type, rec.form, rec.date);
  if(rec.type==='hold' && wasNew) rec.heldAt=rec.heldAt||Date.now();
  let act = wasNew ? (complete?'Tạo & hoàn tất ':'Lưu nháp ')+cpFormLabelOf(rec) : (wasDone?'Sửa phiếu đã hoàn tất':(complete&&ed.orig.status==='draft'?'Hoàn tất phiếu':'Cập nhật '+cpFormLabelOf(rec)));
  const changes = wasNew?[]:cpDiff(ed.orig, rec);
  if(!wasNew && !changes.length && !(complete&&ed.orig.status==='draft')){ showToast('Không có thay đổi'); return rec; }
  cpPut(rec,{act, reason:wasDone?ed.reason:'', changes});
  ed.rec=cpClone(rec); ed.orig=cpClone(rec); ed.isNew=false; ed.reason='';
  if(quiet) return rec;
  showToast('✓ Đã lưu '+rec.code+(cpPending()?' (chờ đồng bộ)':''));
  const ng=(rec.type==='chk'||rec.type==='fqc') && complete && rec.result==='NG' && !rec.ngFollow;
  if(complete || rec.type==='ncr'||rec.type==='hold'||rec.type==='eightd'){ cpUI.ed=null; cpRender(); if(ng) cpNgDialog(rec.id); }
  else { ed.ro=false; cpEdRender(); }
  return rec;
}
function cpDraftDelete(){
  const r=cpUI.ed.rec;
  cpAsk({title:'Xoá bản nháp', msg:'Xoá bản nháp '+(r.code||'')+'? Không khôi phục được.', label:'🗑 Xoá nháp', danger:true}, ()=>{ cpDeleteDraft(r.id); showToast('🗑 Đã xoá bản nháp '+(r.code||'')); cpEdClose(); });
}
function cpDeleteRec(){
  const r=cpGet(cpUI.ed.rec.id); if(!r) return;
  if(!cpCanDeleteRec(r)){ showToast('🔒 Chỉ Quản trị viên mới được xoá phiếu Check Sheet', true); return; }
  const linked=cpRecs().filter(x=>x && x.sourceId===r.id).length;
  cpAsk({title:'🗑 Xoá hẳn phiếu '+(r.code||''), danger:true, reason:true, label:'🗑 Xoá vĩnh viễn', ph:'Lý do xoá phiếu (bắt buộc)',
    msg:'Phiếu '+(r.code||'')+(r.customer?' · '+r.customer:'')+(r.spec?' · '+r.spec:'')+' sẽ bị xoá vĩnh viễn, không khôi phục được.'+(linked?'\n⚠ Có '+linked+' hồ sơ NCR/HOLD/8D lập từ phiếu này (vẫn giữ, nhưng mất liên kết).':'')},
    why=>{ if(cpDeleteRecord(r.id, why)){ showToast('🗑 Đã xoá phiếu '+(r.code||'')); cpEdClose(); } else showToast('Không xoá được phiếu', true); });
}
function cpVoid(){
  const r=cpGet(cpUI.ed.rec.id); if(!r||cpGuard('editAny')) return;
  cpAsk({title:'🚫 Huỷ phiếu '+(r.code||''), danger:true, reason:true, label:'🚫 Huỷ phiếu', ph:'Lý do huỷ phiếu (bắt buộc)', msg:'Phiếu không bị xoá, chỉ đánh dấu ĐÃ HUỶ và ghi nhật ký.'},
    why=>{ const cur=cpGet(r.id); if(!cur) return; const c=cpClone(cur); c.void=true; c.voidReason=why; cpPut(c,{act:'Huỷ phiếu', reason:why}); showToast('Đã huỷ '+c.code); cpEdClose(); });
}

// ── Quy trình khi phát hiện NG ───────────────────────────────────────────────
function cpNgDialog(id){
  const r=cpGet(id); if(!r) return;
  const codes=[]; (r.lines||[]).forEach(l=>{ if(l.result==='NG' && l.appearance && l.appearance!=='OK' && codes.indexOf(l.appearance)<0) codes.push(l.appearance); });
  const ngLines=(r.lines||[]).filter(l=>l.result==='NG');
  const sum=ngLines.reduce((a,l)=>a+(+l.qtyNG||0),0);
  const sugNcr = codes.some(c=>{ const d=cpDefect(c); return d && /HOLD|NCR|phế|cách ly/i.test(d.reaction||''); }) || r.type==='fqc';
  cpModal(`<h3 style="color:#b91c1c">⚠ PHÁT HIỆN NG — ${cpH(r.code)}</h3>
    <div class="cp-banner err">${r.type==='fqc'?cpH((r.evalReasons||[]).join('; ')||'Lô không đạt AQL'):`${ngLines.length} dòng đo NG${codes.length?': '+codes.map(c=>cpH(c+' '+((cpDefect(c)||{}).name||''))).join(', '):''}`}</div>
    ${codes.map(c=>{ const d=cpDefect(c); return d?`<div class="cp-dinfo"><b>${cpH(c)}</b>: phản ứng theo danh mục — ${cpH(d.reaction)}</div>`:''; }).join('')}
    <div class="cp-grid" style="margin:10px 0"><label class="cp-f"><span>Số lượng ảnh hưởng *</span><input id="ngQty" inputmode="decimal" value="${sum||''}" placeholder="vd 50"></label>
      <label class="cp-f"><span>QA/QC phụ trách xử lý</span><select id="ngOwner">${cpOpts(cpQaUsers(),'',  '— Chọn —')}</select></label></div>
    <label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" id="ngHold" checked style="width:20px;min-height:20px"> Tạo phiếu <b>HOLD</b> — cách ly lô, chặn xuất hàng</label>
    <label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" id="ngNcr" ${sugNcr?'checked':''} style="width:20px;min-height:20px"> Tạo <b>NCR</b> (nguyên nhân & khắc phục để trống — người điều tra xác định)</label>
    <label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" id="ng8d" style="width:20px;min-height:20px"> Mở hồ sơ <b>8D</b> (khi lỗi nghiêm trọng/lặp lại)</label>
    <div class="cp-dinfo">Phần mềm không tự kết luận nguyên nhân và không tự Release sản phẩm NG.</div>
    <div id="ngErr" class="cp-err"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="cp-btn" onclick="cpModalClose()">Để sau</button><button class="cp-btn d big" onclick="cpNgConfirm('${r.id}')">Xác nhận</button></div>`);
}
function cpNgConfirm(id){
  const r=cpGet(id); if(!r) return; const qty=cpNum($('ngQty').value);
  if(!(qty>0)){ $('ngErr').textContent='Nhập số lượng ảnh hưởng (> 0)'; return; }
  const wantHold=$('ngHold').checked, wantNcr=$('ngNcr').checked, want8d=$('ng8d').checked, owner=$('ngOwner').value;
  if(!cpCan('create')){ cpGuard('create'); return; }
  const codes=[]; (r.lines||[]).forEach(l=>{ if(l.result==='NG' && l.appearance && l.appearance!=='OK' && codes.indexOf(l.appearance)<0) codes.push(l.appearance); });
  const stageLbl=r.type==='fqc'?'FQC':(CP_STAGE_LABEL[r.form]||'');
  const base={orderId:r.orderId||'',orderCode:r.orderCode||'',customer:r.customer||'',productCode:r.productCode||'',lot:r.lot||'',sourceId:r.id,owner:owner||''};
  const desc=(r.type==='fqc'?'Lô không đạt AQL: '+(r.evalReasons||[]).join('; '):'NG phát hiện ở phiếu '+r.code+(codes.length?' — mã lỗi '+codes.map(c=>c+' '+((cpDefect(c)||{}).name||'')).join(', '):''));
  let hold=null, ncr=null, d8=null;
  if(wantHold){ hold=Object.assign(cpBlank('hold'),base,{code:cpNewCode('hold'),qty,reason:desc,heldAt:Date.now(),status:'HOLD',scope:'Theo mã lô '+(r.lot||'CHƯA XÁC ĐỊNH')}); }
  if(wantNcr){ ncr=Object.assign(cpBlank('ncr'),base,{code:cpNewCode('ncr'),date:cpToday(),stage:stageLbl,desc,qtyAffected:qty,klass:codes.some(c=>/critical/i.test((cpDefect(c)||{}).reaction||''))||(r.criticalNG>0)?'Critical':'',standard:codes.map(c=>(cpDefect(c)||{}).accept).filter(Boolean).join(' | ')}); }
  if(want8d){ d8=Object.assign(cpBlank('eightd'),base,{code:cpNewCode('eightd'),title:desc.slice(0,120),trigger:'Lỗi nội bộ'}); }
  if(hold&&ncr){ hold.ncrId=ncr.id; ncr.holdId=hold.id; }
  if(d8&&ncr){ d8.ncrId=ncr.id; ncr.eightdId=d8.id; }
  [hold,ncr,d8].forEach(x=>{ if(x) cpPut(x,{act:'Tạo tự động từ NG '+r.code}); });
  const c=cpClone(r); c.ngFollow={holdId:hold&&hold.id||'',ncrId:ncr&&ncr.id||'',eightdId:d8&&d8.id||'',at:Date.now(),qty};
  if(hold){ c.holdId=hold.id; } cpPut(c,{act:'Chuyển xử lý NG', changes:[[hold&&hold.code,ncr&&ncr.code,d8&&d8.code].filter(Boolean).join(', ')]});
  try{ pushNotif('NG '+r.code, (owner?owner+' phụ trách · ':'')+'SL ảnh hưởng '+qty+(hold?' · '+hold.code:'')); }catch(e){}
  cpModalClose(); showToast('✓ Đã tạo '+[hold&&hold.code,ncr&&ncr.code,d8&&d8.code].filter(Boolean).join(', ')); cpRender();
}

// ── hành động trạng thái HOLD / NCR / 8D ────────────────────────────────────
function cpHoldAct(act){
  const ed=cpUI.ed; if(!ed) return;
  const rec=cpNormalized(ed.rec); const old=cpGet(rec.id)||{status:rec.status};
  const need=(a)=>{ if(cpGuard(a)) return false; return true; };
  if(act==='investigate'){ if(!need('investigate')) return; if(!ed.isNew||true){} rec.status='Đang điều tra'; }
  else if(act==='submit'){ if(!need('investigate')) return;
    const E=cpValidate(rec,true); if(Object.keys(E).length){ ed.errs=E; cpEdValidateUI(); showToast('Hoàn thiện thông tin HOLD trước khi gửi', true); return; }
    if(!String(rec.investigation||'').trim()||!rec.disposition){ showToast('Cần kết quả điều tra và quyết định xử lý trước khi gửi phê duyệt', true); return; } rec.status='Chờ phê duyệt'; }
  else if(act==='release'){ if(!need('approve')) return; const e=cpHoldReleaseCheck(rec); if(e.length){ cpModal('<h3>Chưa thể RELEASE</h3><ul>'+e.map(x=>'<li>'+cpH(x)+'</li>').join('')+'</ul><div style="text-align:right"><button class="cp-btn" onclick="cpModalClose()">Đóng</button></div>'); return; }
    return cpAsk({title:'RELEASE lô '+(rec.lot||''), msg:'RELEASE lô '+(rec.lot||'')+' — số lượng '+rec.qty+'? Thao tác được ghi nhật ký.', label:'RELEASE'}, ()=>{ rec.status='RELEASE'; rec.releaseBy=cpActor(); rec.releaseAt=Date.now(); fin(); }); }
  else if(act==='scrap'){ if(!need('approve')) return; if(rec.disposition!=='Phế phẩm'){ showToast('Chọn quyết định xử lý "Phế phẩm" trước', true); return; } return cpAsk({title:'PHẾ PHẨM', msg:'Xác nhận PHẾ PHẨM lô '+(rec.lot||'')+'?', label:'Phế phẩm', danger:true}, ()=>{ rec.status='Phế phẩm'; rec.releaseBy=cpActor(); rec.releaseAt=Date.now(); fin(); }); }
  else if(act==='reopen'){ if(!need('approve')) return; rec.status='Đang điều tra'; }
  fin();
  function fin(){
    cpPut(rec,{act:{investigate:'HOLD → Đang điều tra',submit:'Gửi phê duyệt',release:'RELEASE lô',scrap:'Phế phẩm',reopen:'Trả về điều tra'}[act], changes:cpDiff(old,rec)});
    showToast('✓ '+rec.code+' → '+rec.status); cpUI.ed=null; cpRender();
  }
}
function cpNcrAct(act){
  const ed=cpUI.ed; if(!ed) return; const rec=cpNormalized(ed.rec), old=cpGet(rec.id)||{};
  if(act==='start'){ if(cpGuard('create')) return; rec.status='Đang xử lý'; }
  else if(act==='verify'){ if(cpGuard('verify')) return; if(!String(rec.verification||'').trim()){ showToast('Nhập nội dung xác nhận hiệu lực', true); return; } rec.verifiedBy=cpActor(); rec.verifiedAt=Date.now(); }
  else if(act==='submit'){ if(cpGuard('create')) return; if(!String(rec.cause||'').trim()||!String(rec.action||'').trim()||!rec.disposition){ showToast('Cần nguyên nhân, hành động khắc phục và quyết định xử lý trước khi gửi', true); return; } rec.status='Chờ phê duyệt'; }
  else if(act==='approve'){ if(cpGuard('approve')) return; if(!rec.verifiedBy){ showToast('Cần xác nhận hiệu lực trước khi QA phê duyệt', true); return; } rec.status='Đã đóng'; rec.approvedBy=cpActor(); rec.approvedAt=Date.now(); }
  else if(act==='reopen'){ if(cpGuard('approve')) return; rec.status='Đang xử lý'; }
  const E=cpValidate(rec,true); if(Object.keys(E).length){ ed.errs=E; cpEdValidateUI(); showToast('Còn lỗi nhập liệu', true); return; }
  cpPut(rec,{act:{start:'NCR: bắt đầu xử lý',verify:'NCR: xác nhận hiệu lực',submit:'NCR: gửi QA',approve:'NCR: QA phê duyệt & đóng',reopen:'NCR: trả lại xử lý'}[act], changes:cpDiff(old,rec)});
  showToast('✓ '+rec.code+' → '+rec.status); cpUI.ed=null; cpRender();
}
function cpEightdClose(){
  const ed=cpUI.ed; if(!ed||cpGuard('approve')) return; const rec=cpNormalized(ed.rec);
  const open=rec.steps.filter((s,i)=>i<8 && s.status!=='Hoàn thành').map(s=>s.step);
  if(open.length){ showToast('Chưa hoàn thành: '+open.join(', ')+' — không thể đóng hồ sơ', true); return; }
  if(!String(rec.steps[8].content||'').trim()){ showToast('D8: nhập nội dung kết luận/đóng hồ sơ', true); return; }
  const old=cpGet(rec.id)||{}; rec.steps[8].status='Hoàn thành'; rec.steps[8].doneAt=Date.now(); rec.steps[8].doneBy=cpActor(); rec.status='Đã đóng';
  cpPut(rec,{act:'8D: đóng hồ sơ (D8)', changes:cpDiff(old,rec)}); showToast('✓ Đã đóng '+rec.code); cpUI.ed=null; cpRender();
}
// 8D: khi lưu, ghi nhận bước vừa chuyển "Hoàn thành"
const _cpSaveBase=cpSave;
cpSave=function(complete,quiet){
  const ed=cpUI.ed;
  if(ed && ed.rec.type==='eightd'){ ed.rec.steps.forEach((s,i)=>{ const o=ed.orig&&ed.orig.steps&&ed.orig.steps[i]; if(s.status==='Hoàn thành' && (!o||o.status!=='Hoàn thành')){ s.doneAt=Date.now(); s.doneBy=cpActor(); } else if(s.status!=='Hoàn thành'){ s.doneAt=0; s.doneBy=''; } }); }
  return _cpSaveBase(complete,quiet);
};
