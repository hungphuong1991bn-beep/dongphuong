// src/modules/quality/cp-master.js — ControlPlan: danh mục (Control Plan, PFMEA, AQL, mã lỗi), "Cần kiểm tra", Quản trị, ENGINE NHẬP EXCEL AN TOÀN
const CP_DATASET_URL = 'src/modules/quality/data/cp-import-dataset.json';

// ── Đưa danh mục seed thành bản ghi thật trước khi sửa (để cpMasterList không chỉ còn 1 dòng) ──
function cpMaterialise(type, seedKey){
  if(cpOf(type).length) return;
  const list=(cpSeed()[seedKey]||[]).map(r=>{ const o=cpClone(r); delete o._seed; o.createdAt=Date.now(); o.createdBy='Nạp danh mục chuẩn'; return o; });
  if(list.length) cpPutMany(list);
}
function cpTable(head, rows, cls){ return `<div class="cp-tw"><table class="cp-t ${cls||''}"><thead><tr>${head.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`; }
const cpTd=v=>`<td>${cpH(v==null?'':v)}</td>`;

// ── 1. CONTROL PLAN ──────────────────────────────────────────────────────────
function cpMasterCpHtml(){
  const l=cpControlPlan(), q=cpNorm(cpUI.q), can=cpCan('master');
  const rows=l.filter(r=>!q||cpNorm(JSON.stringify(r)).indexOf(q)>=0);
  const stages=[...new Set(l.map(r=>r.stage))];
  return `<div class="cp-bar">${cpBackBtn()}<b style="font-size:16px">📐 Control Plan – Kế hoạch kiểm soát</b><span class="grow"></span>
    <input type="search" placeholder="Tìm đặc tính, công đoạn…" value="${cpH(cpUI.q)}" onchange="cpSetQ(this.value)">
    <button class="cp-btn" onclick="cpDownloadXlsx('ControlPlan_KeHoach_'+cpToday()+'.xlsx',[{name:'Control Plan',rows:cpMasterCpMatrix()}])">⬇ Excel</button></div>
    ${l[0]&&l[0]._seed?'<div class="cp-banner info">Đang hiển thị danh mục chuẩn lấy từ workbook (chưa nạp vào dữ liệu). Quản trị viên nạp ở ⚙️ Quản trị ▸ Nhập dữ liệu để có thể chỉnh sửa.</div>':''}
    <div class="cp-dinfo">${rows.length}/${l.length} dòng · ${stages.length} công đoạn. Bấm <b>Mở phiếu</b> để điền đúng biểu mẫu kiểm tra của công đoạn đó.</div>`+
    cpTable(['#','Công đoạn','Đặc tính','Tiêu chuẩn','Thiết bị','Phương pháp','Cỡ mẫu','Tần suất','Loại','Kiểm soát','Phản ứng khi NG','Biểu mẫu',''],
      rows.map(r=>`<tr>${cpTd(r.no)}${cpTd(r.stage)}${cpTd(r.characteristic)}${cpTd(r.standard)}${cpTd(r.equipment)}${cpTd(r.method)}${cpTd(r.sample)}${cpTd(r.frequency)}<td><span class="cp-pill ${/critical/i.test(r.class)?'ng':/major/i.test(r.class)?'warn':'unk'}">${cpH(r.class||'')}</span></td>${cpTd(r.control)}${cpTd(r.reaction)}
        <td>${cpH(r.formCode||'')}${r.formKey?`<br><button class="cp-btn p" onclick="event.stopPropagation();cpOpenForm('${r.formKey}')">Mở phiếu</button>`:''}</td>
        <td>${can?`<button class="cp-btn" onclick="cpMasterEdit('cp','${r.id}')">✏️</button>`:''}</td></tr>`));
}
function cpMasterCpMatrix(){ return [['#','Công đoạn','Đặc tính','Tiêu chuẩn','Thiết bị','Phương pháp','Cỡ mẫu','Tần suất','Loại','Kiểm soát','Phản ứng','Mã biểu mẫu']].concat(cpControlPlan().map(r=>[r.no,r.stage,r.characteristic,r.standard,r.equipment,r.method,r.sample,r.frequency,r.class,r.control,r.reaction,r.formCode])); }

// ── sửa 1 dòng danh mục (modal) ──────────────────────────────────────────────
const CP_MASTER_FIELDS = {
  cp:[['stage','Công đoạn'],['characteristic','Đặc tính'],['standard','Tiêu chuẩn'],['equipment','Thiết bị'],['method','Phương pháp'],['sample','Cỡ mẫu'],['frequency','Tần suất'],['class','Loại (Critical/Major/Minor)'],['control','Kiểm soát'],['reaction','Phản ứng khi NG'],['formCode','Mã biểu mẫu']],
  pfmea:[['stage','Công đoạn'],['requirement','Yêu cầu'],['failureMode','Dạng lỗi'],['effect','Ảnh hưởng'],['S','Severity S (1-10)','n'],['cause','Nguyên nhân'],['O','Occurrence O (1-10)','n'],['prevention','Kiểm soát phòng ngừa'],['detection','Kiểm soát phát hiện'],['D','Detection D (1-10)','n'],['action','Hành động khắc phục'],['owner','Người phụ trách'],['due','Hạn (YYYY-MM-DD)'],['status','Trạng thái']],
  defect:[['code','Mã lỗi'],['name','Tên lỗi'],['accept','Tiêu chuẩn đạt'],['reaction','Phản ứng khi NG'],['ref','Tham chiếu']]
};
const CP_MASTER_NEED = {cp:'master', pfmea:'master', defect:'config'};
function cpMasterEdit(type, id){
  if(cpGuard(CP_MASTER_NEED[type])) return;
  const seedKey={cp:'controlPlan',pfmea:'pfmea',defect:'defects'}[type];
  if(id!=='new') cpMaterialise(type, seedKey);
  const r = id==='new' ? {id:cpUid('cp'), type, source:'app', createdAt:0} : cpGet(id); if(!r) return;
  cpUI.me={type, rec:cpClone(r), isNew:id==='new'};
  const f=CP_MASTER_FIELDS[type];
  cpModal(`<h3>${id==='new'?'Thêm dòng':'Sửa dòng'} — ${{cp:'Control Plan',pfmea:'PFMEA',defect:'Mã lỗi'}[type]}</h3>
    <div class="cp-grid">${f.map(x=>`<label class="cp-f${/Tiêu chuẩn|Phản ứng|Dạng|Ảnh|Nguyên|Hành|phòng|phát/.test(x[1])?' w2':''}"><span>${x[1]}</span><input id="me_${x[0]}" value="${cpH(r[x[0]]==null?'':r[x[0]])}" ${x[2]==='n'?'inputmode="numeric"':''}></label>`).join('')}</div>
    <label class="cp-f"><span>Lý do chỉnh sửa (bắt buộc)</span><input id="me_reason"></label><div id="me_err" class="cp-err"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="cp-btn" onclick="cpModalClose()">Huỷ</button><button class="cp-btn p" onclick="cpMasterSave()">Lưu</button></div>`);
}
function cpMasterSave(){
  const me=cpUI.me; if(!me||cpGuard(CP_MASTER_NEED[me.type])) return; const r=me.rec, old=cpGet(r.id)||{}, ch=[], err=$('me_err');
  const reason=($('me_reason').value||'').trim(); if(!reason){ err.textContent='Nhập lý do chỉnh sửa'; return; }
  for(const x of CP_MASTER_FIELDS[me.type]){
    let v=$('me_'+x[0]).value.trim();
    if(x[2]==='n'){ if(v===''){ v=null; } else { const n=cpNum(v); if(n===null||n<1||n>10||n%1){ err.textContent=x[1]+': số nguyên 1–10'; return; } v=n; } }
    if(String(old[x[0]]==null?'':old[x[0]])!==String(v==null?'':v)) ch.push(x[0]+': '+(old[x[0]]==null?'∅':old[x[0]])+' → '+(v==null?'∅':v));
    r[x[0]]=v;
  }
  if(me.type==='defect'){ if(!r.code){ err.textContent='Nhập mã lỗi'; return; } if(me.isNew && cpDefects().some(d=>d.code===r.code)){ err.textContent='Mã lỗi đã tồn tại'; return; } }
  if(!me.isNew && !ch.length){ cpModalClose(); return; }
  if(me.isNew){ r.no=(cpMasterListMax(me.type)+1); }
  cpPut(r,{act:(me.isNew?'Thêm':'Sửa')+' danh mục '+me.type, reason, changes:ch}); cpModalClose(); showToast('✓ Đã lưu'); cpRender();
}
function cpMasterListMax(type){ return Math.max(0,...cpOf(type).map(r=>r.no||0)); }

// ── 2. PFMEA ─────────────────────────────────────────────────────────────────
function cpPfmeaHtml(){
  const l=cpPfmea(), can=cpCan('master'), q=cpNorm(cpUI.q);
  const sorted=l.map(r=>({r,rpn:cpRpn(r)})).filter(x=>!q||cpNorm(JSON.stringify(x.r)).indexOf(q)>=0);
  if(cpUI.sortRpn) sorted.sort((a,b)=>(b.rpn||0)-(a.rpn||0));
  return `<div class="cp-bar">${cpBackBtn()}<b style="font-size:16px">⚠️ PFMEA – Phân tích rủi ro quá trình</b><span class="grow"></span>
    <input type="search" placeholder="Tìm…" value="${cpH(cpUI.q)}" onchange="cpSetQ(this.value)">
    <button class="cp-btn ${cpUI.sortRpn?'p':''}" onclick="cpUI.sortRpn=!cpUI.sortRpn;cpRender()">↓ Xếp theo RPN</button>
    <button class="cp-btn" onclick="cpDownloadXlsx('PFMEA_'+cpToday()+'.xlsx',[{name:'PFMEA',rows:cpPfmeaMatrix()}])">⬇ Excel</button></div>
    <div class="cp-dinfo">RPN = S × O × D, tự tính khi đủ 3 giá trị. Cột "RPN trong Excel" để trống ở workbook gốc. Phần mềm không tự đặt ngưỡng hành động — ngưỡng do QA quy định.</div>`+
    cpTable(['#','Công đoạn','Yêu cầu','Dạng lỗi','Ảnh hưởng','S','Nguyên nhân','O','Phòng ngừa','Phát hiện','D','RPN','Hành động','Phụ trách','Hạn','Trạng thái',''],
      sorted.map(({r,rpn})=>`<tr>${cpTd(r.no)}${cpTd(r.stage)}${cpTd(r.requirement)}${cpTd(r.failureMode)}${cpTd(r.effect)}${cpTd(r.S)}${cpTd(r.cause)}${cpTd(r.O)}${cpTd(r.prevention)}${cpTd(r.detection)}${cpTd(r.D)}
        <td>${rpn==null?'<span class="cp-pill unk">thiếu S/O/D</span>':`<b>${rpn}</b>`}</td>${cpTd(r.action)}${cpTd(r.owner)}${cpTd(r.due)}${cpTd(r.status)}<td>${can?`<button class="cp-btn" onclick="cpMasterEdit('pfmea','${r.id}')">✏️</button>`:''}</td></tr>`));
}
function cpPfmeaMatrix(){ return [['#','Công đoạn','Yêu cầu','Dạng lỗi','Ảnh hưởng','S','Nguyên nhân','O','Phòng ngừa','Phát hiện','D','RPN','Hành động','Phụ trách','Hạn','Trạng thái']].concat(cpPfmea().map(r=>[r.no,r.stage,r.requirement,r.failureMode,r.effect,r.S,r.cause,r.O,r.prevention,r.detection,r.D,cpRpn(r),r.action,r.owner,r.due,r.status])); }

// ── 3. AQL ───────────────────────────────────────────────────────────────────
function cpAqlHtml(){
  const T=cpAqlRec(), A=cpUI.aql=cpUI.aql||{lot:'',level:'II',maj:'',min:'',cri:''};
  if(!T) return cpBackBtn()+'<div class="cp-banner err">Chưa có bảng AQL. Quản trị viên cần nạp dữ liệu.</div>';
  const lv=(T.levels||[]).map(x=>({v:x,t:'AQL '+x})), lk=A.lot?cpAqlLookup(A.lot,A.level,A.maj,A.min,A.cri):null;
  const cols=T.levels||[];
  return `<div class="cp-bar">${cpBackBtn()}<b style="font-size:16px">🧮 AQL – Cỡ mẫu & tiêu chí chấp nhận</b></div>
    <div class="cp-banner warn">${cpH(CP_AQL_WARN)}</div>
    <div class="cp-sec">Tra nhanh</div><div class="cp-grid">
      <label class="cp-f"><span>Quy mô lô</span><input inputmode="numeric" value="${cpH(A.lot)}" onchange="cpUI.aql.lot=this.value;cpRender()"></label>
      <label class="cp-f"><span>Level</span><select onchange="cpUI.aql.level=this.value;cpRender()">${cpOpts(['II','I','III','S-1','S-2','S-3','S-4'],A.level,false)}</select></label>
      <label class="cp-f"><span>AQL Major</span><select onchange="cpUI.aql.maj=this.value;cpRender()">${cpOpts(lv,A.maj)}</select></label>
      <label class="cp-f"><span>AQL Minor</span><select onchange="cpUI.aql.min=this.value;cpRender()">${cpOpts(lv,A.min)}</select></label>
      <label class="cp-f"><span>AQL Critical</span><select onchange="cpUI.aql.cri=this.value;cpRender()">${cpOpts(lv,A.cri,'— Không chấp nhận —')}</select></label></div>
    ${lk?(lk.ok?`<div class="cp-banner ok">Lô <b>${cpH(A.lot)}</b> → Code <b>${lk.code}</b> · Cỡ mẫu <b>${lk.n}</b> · Major ${lk.major?`Ac ${lk.major.ac}/Re ${lk.major.re}`:'—'} · Minor ${lk.minor?`Ac ${lk.minor.ac}/Re ${lk.minor.re}`:'—'} · Critical ${lk.critical?`Ac ${lk.critical.ac}`:'không chấp nhận'}${lk.warnings.length>1?'<br>'+cpH(lk.warnings.slice(1).join('; ')):''}</div>`:`<div class="cp-banner err">${cpH(lk.errors.join(' · '))}</div>`):''}
    <div class="cp-sec">Bảng tra (Level ${cpH(T.inspectionLevel||'II')})</div>`+
    cpTable(['Quy mô lô','Code','Cỡ mẫu'].concat(cols.map(c=>'AQL '+c)), (T.codes||[]).map(c=>`<tr>${cpTd(c.range)}${cpTd(c.code)}${cpTd(c.n)}${cols.map(a=>cpTd((T.table[c.code]||{})[a]||'—')).join('')}</tr>`));
}

// ── 4. MÃ LỖI ────────────────────────────────────────────────────────────────
function cpDefectsHtml(){
  const l=cpDefects(), can=cpCan('config');
  return `<div class="cp-bar">${cpBackBtn()}<b style="font-size:16px">🔎 Danh mục mã lỗi ngoại quan</b><span class="grow"></span>${can?'<button class="cp-btn p" onclick="cpMasterEdit(\'defect\',\'new\')">➕ Thêm mã lỗi</button>':''}</div>
    <div class="cp-dinfo">Khi QC chọn mã lỗi trong phiếu, hệ thống tự điền tên lỗi, tiêu chuẩn đạt và phản ứng.</div>`+
    cpTable(['Mã','Tên lỗi','Tiêu chuẩn đạt','Phản ứng khi NG','Tham chiếu',''], l.map(d=>`<tr>${cpTd(d.code)}${cpTd(d.name)}${cpTd(d.accept)}${cpTd(d.reaction)}${cpTd(d.ref)}<td>${can?`<button class="cp-btn" onclick="cpMasterEdit('defect','${d.id}')">✏️</button>`:''}</td></tr>`));
}

// ── 5. CẦN KIỂM TRA (dòng dữ liệu chưa chắc chắn) ────────────────────────────
function cpReviewHtml(){
  const l=cpReviewList(), can=cpCan('review'), q=cpNorm(cpUI.q);
  const by={}; l.forEach(r=>(r.review||[]).forEach(x=>{ const k=String(x).replace(/\d+/g,'#').slice(0,60); by[k]=(by[k]||0)+1; }));
  const rows=l.filter(r=>!q||cpNorm(JSON.stringify([r.code,r.customer,r.spec,r.review,r.src])).indexOf(q)>=0).slice(0,300);
  return `<div class="cp-bar">${cpBackBtn()}<b style="font-size:16px">🔍 Dữ liệu cần kiểm tra</b><span class="grow"></span><input type="search" placeholder="Tìm…" value="${cpH(cpUI.q)}" onchange="cpSetQ(this.value)"></div>
    <div class="cp-banner info">Đây là các dòng nhập từ Excel mà phần mềm <b>không tự suy đoán</b> (kết luận lạ, ngày/lô lệch, số không đọc được…). Giá trị gốc được giữ nguyên. Người có quyền mở phiếu để sửa (ghi lý do) hoặc bấm <b>Đã xác nhận</b>.</div>
    ${Object.keys(by).length?`<div class="cp-dinfo">${Object.keys(by).map(k=>`<span class="cp-pill warn">${cpH(k)} · ${by[k]}</span>`).join(' ')}</div>`:''}
    ${rows.length?cpTable(['Nguồn (sheet/dòng)','Ngày','Công đoạn','Khách hàng','Quy cách','Lý do cần kiểm tra','Kết luận gốc',''],rows.map(r=>`<tr class="click" onclick="cpOpen('${r.id}')">${cpTd((r.src&&r.src.sheet||'')+' / '+(r.src&&r.src.row||''))}${cpTd(cpFmtDate(r.date))}${cpTd(CP_STAGE_LABEL[r.form])}${cpTd(cpCust(r))}${cpTd(r.spec)}<td>${(r.review||[]).map(cpH).join('<br>')}</td>${cpTd((r.lines||[]).map(x=>x.resultRaw).filter(Boolean).join(', '))}<td>${can?`<button class="cp-btn" onclick="event.stopPropagation();cpReviewOk('${r.id}')">✔ Đã xác nhận</button>`:''}</td></tr>`)):'<div class="cp-empty">Không còn dòng nào cần kiểm tra 🎉</div>'}
    ${l.length>rows.length?`<div class="cp-dinfo">Hiển thị ${rows.length}/${l.length} — dùng ô tìm để thu hẹp.</div>`:''}`;
}
function cpReviewOk(id){
  if(cpGuard('review')) return; const r=cpGet(id); if(!r) return;
  const why=prompt('Ghi chú xác nhận (vd: "đã đối chiếu sổ giấy"). Giá trị gốc vẫn được giữ:'); if(why==null) return; if(!why.trim()){ showToast('Cần ghi chú xác nhận', true); return; }
  const c=cpClone(r); c.reviewed=true; c.reviewNote=why.trim(); c.reviewedBy=cpActor(); c.reviewedAt=Date.now();
  cpPut(c,{act:'Xác nhận dữ liệu cần kiểm tra', reason:why.trim()}); cpRender();
}

// ── 6. QUẢN TRỊ ──────────────────────────────────────────────────────────────
function cpAdminHtml(){
  if(!cpCan('config')) return cpBackBtn()+'<div class="cp-banner err">Chỉ Quản trị viên.</div>';
  const staff=(DB.users||[]).filter(u=>u&&u.role==='staff'), logs=cpOf('importLog').sort((a,b)=>b.at-a.at), imp=cpUI.imp||{log:[],busy:false};
  const byForm={}; cpRecs().forEach(r=>{ if(r&&r.source==='excel'&&r.type==='chk') byForm[r.form]=(byForm[r.form]||0)+1; });
  return `<div class="cp-bar">${cpBackBtn()}<b style="font-size:16px">⚙️ Quản trị ControlPlan</b></div>
  <div class="cp-sec">Phân quyền QC</div><div class="cp-dinfo">Vai trò QC chỉ áp dụng cho tài khoản "staff". Admin luôn có toàn quyền. Tài khoản chưa gán = chỉ xem. Chỉ <b>QA</b> và <b>Admin</b> được RELEASE / phê duyệt NCR / đóng 8D.</div>
  ${staff.length?cpTable(['Tài khoản','Vai trò ControlPlan'],staff.map((u,i)=>`<tr>${cpTd(u.name||u.username)}<td><select onchange="cpSetQcRole('${cpH(u.id)}',this.value)">${cpOpts([{v:'qc',t:'Nhân viên QC'},{v:'lead',t:'Trưởng QC'},{v:'qa',t:'QA / Quản lý chất lượng'}],u.qcRole,'Chỉ xem (sản xuất)')}</select></td></tr>`)):'<div class="cp-dinfo">Chưa có tài khoản staff.</div>'}
  <div class="cp-sec">Nhập dữ liệu từ Excel (ControlPlan_AQL_Checksheet.xlsx)</div>
  <div class="cp-banner info">An toàn: ① tải bản sao lưu dữ liệu hiện tại ② kiểm tra bộ dữ liệu ③ <b>chỉ thêm bản ghi còn thiếu</b> (mã cố định theo sheet+dòng nên chạy lại không bị trùng, không ghi đè phiếu đã có/đã sửa) ④ đối chiếu số lượng + lấy mẫu kiểm tra ⑤ ghi nhật ký nhập. Phiếu nhập từ Excel được gắn nhãn <b>Excel</b>; phiếu mới trên phần mềm gắn <b>PM</b>.</div>
  <div class="cp-dinfo">Hiện có trên phần mềm (nguồn Excel): ${['dun','rut','danhbong','cat','dothang'].map(k=>CP_STAGE_LABEL[k]+' '+(byForm[k]||0)).join(' · ')}</div>
  <div class="cp-bar"><button class="cp-btn p big" ${imp.busy?'disabled':''} onclick="cpImportRun()">⬆ Nhập dữ liệu Excel vào phần mềm</button><button class="cp-btn" onclick="cpBackupDownload()">💾 Tải sao lưu ControlPlan</button></div>
  <pre id="cpImpLog" class="cp-log">${cpH((imp.log||[]).join('\n'))}</pre>
  ${logs.length?`<div class="cp-sec">Lịch sử nhập</div>`+cpTable(['Thời điểm','Người','Thêm mới','Đã có (bỏ qua)','Kết quả kiểm tra'],logs.map(x=>`<tr>${cpTd(cpFmtTs(x.at))}${cpTd(x.by)}${cpTd(x.added)}${cpTd(x.existing)}<td><span class="cp-pill ${x.ok?'ok':'ng'}">${x.ok?'Khớp':'Lệch — xem log'}</span></td></tr>`)):''}
  <div class="cp-sec">Ghi chú kỹ thuật</div><ul class="cp-dinfo" style="margin-left:18px"><li>Dữ liệu ControlPlan lưu tại <code>/data/cpRecords/{id}</code> — từng bản ghi, không bao giờ ghi đè cả nhánh /data.</li><li>Chức năng sao lưu Firebase tự động của app vẫn tắt theo cấu hình của bạn; nút sao lưu ở đây chỉ tải file JSON về máy.</li></ul>`;
}
function cpSetQcRole(uid, role){
  if(cpGuard('config')) return; const u=(DB.users||[]).find(x=>x&&x.id===uid); if(!u) return;
  const old=u.qcRole||''; if(role) u.qcRole=role; else delete u.qcRole;
  try{ saveUsers(); }catch(e){ console.error(e); }
  try{ log('ControlPlan · Phân quyền', (u.name||u.username)+': '+(old||'—')+' → '+(role||'—'), ''); }catch(e){}
  showToast('✓ Đã cập nhật vai trò'); cpRender();
}

// ── Sao lưu & Nhập Excel ─────────────────────────────────────────────────────
async function cpBackupData(){
  const local=cpRecs().map(cpStrip); let srv=null;
  if(typeof fbOk==='function' && fbOk()){ srv=await fbRead(CP_PATH); }                 // lỗi mạng → ném lỗi → huỷ nhập
  const map={}; local.forEach(r=>{ map[r.id]=r; }); if(srv) Object.values(srv).forEach(r=>{ if(r&&r.id&&!map[r.id]) map[r.id]=r; });
  return {kind:'controlplan-backup', at:new Date().toISOString(), by:cpActor(), count:Object.keys(map).length, records:Object.values(map)};
}
function cpSaveFile(name, text){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'application/json'})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },800); }
async function cpBackupDownload(){ try{ const b=await cpBackupData(); cpSaveFile('controlplan-backup-'+cpToday()+'-'+Date.now()+'.json', JSON.stringify(b)); showToast('✓ Đã tải sao lưu ('+b.count+' bản ghi)'); }catch(e){ showToast('Không sao lưu được: '+e.message, true); } }
function cpImpLog(s){ const i=cpUI.imp=cpUI.imp||{log:[],busy:false}; i.log.push(new Date().toLocaleTimeString('vi-VN')+'  '+s); const el=$('cpImpLog'); if(el){ el.textContent=i.log.join('\n'); el.scrollTop=el.scrollHeight; } }
function cpSig(r){ const o=cpStrip(r); ['rev','updatedAt','updatedBy','createdAt','createdBy','createdById','hist'].forEach(k=>delete o[k]); return JSON.stringify(o, Object.keys(o).sort()); }
async function cpWaitFlush(ms){ const t0=Date.now(); while(cpPending() && Date.now()-t0<ms){ await cpFlush(); if(cpPending()) await new Promise(r=>setTimeout(r,800)); } return !cpPending(); }

async function cpImportRun(){
  if(cpGuard('config')) return; const st=cpUI.imp=cpUI.imp||{log:[],busy:false}; if(st.busy) return;
  if(!confirm('Nhập dữ liệu từ Excel vào ControlPlan?\n\nHệ thống sẽ tải bản sao lưu trước, chỉ thêm bản ghi còn thiếu và không sửa/xoá dữ liệu hiện có.')) return;
  st.busy=true; st.log=[]; cpRender();
  try{
    cpImpLog('① Sao lưu dữ liệu hiện tại…');
    const bk=await cpBackupData(); cpSaveFile('controlplan-backup-truoc-nhap-'+Date.now()+'.json', JSON.stringify(bk)); cpImpLog('   Đã tải file sao lưu: '+bk.count+' bản ghi.');
    cpOnSnapshot(Object.fromEntries(bk.records.map(r=>[r.id,r])));                  // hợp nhất bản ghi trên server mà máy này chưa có (tránh ghi đè bản của máy khác)
    cpImpLog('② Đọc bộ dữ liệu Excel…');
    const res=await fetch(CP_DATASET_URL, {cache:'no-cache'}); if(!res.ok) throw new Error('Không tải được bộ dữ liệu ('+res.status+')');
    const ds=await res.json(), recs=ds.records||[], meta=ds.meta||{};
    const ids=new Set(recs.map(r=>r.id)); if(ids.size!==recs.length) throw new Error('Bộ dữ liệu có mã trùng');
    const expect={}; (meta.sheets||[]).forEach(s=>{ expect[s.form]=s.imported; });
    const have={}; recs.forEach(r=>{ have[r.form]=(have[r.form]||0)+1; });
    for(const k of Object.keys(expect)) if(expect[k]!==(have[k]||0)) throw new Error('Số dòng sheet '+k+' không khớp báo cáo ('+(have[k]||0)+' ≠ '+expect[k]+')');
    cpImpLog('   Bộ dữ liệu hợp lệ: '+recs.length+' phiếu ('+Object.keys(have).map(k=>CP_STAGE_LABEL[k]+' '+have[k]).join(', ')+'); '+(ds.skipped||[]).length+' dòng bỏ qua (xem IMPORT-REPORT.md).');
    const before=cpRecs().length;
    cpImpLog('③ Thêm các bản ghi còn thiếu (không ghi đè)…');
    const toAdd=[], now=Date.now(); let existing=0;
    recs.forEach(r=>{ if(cpGet(r.id)){ existing++; return; } const o=cpClone(r); o.createdAt=now; o.createdBy='Nhập từ Excel'; o.createdById=''; o.importedAt=now; toAdd.push(o); });
    const seed=cpSeed(), masters=[['cp','controlPlan'],['pfmea','pfmea'],['defect','defects']];
    masters.forEach(([t,k])=>{ if(!cpOf(t).length){ (seed[k]||[]).forEach(r=>{ if(cpGet(r.id)) return; const o=cpClone(r); delete o._seed; o.createdAt=now; o.createdBy='Nhập từ Excel'; toAdd.push(o); }); } });
    if(!cpOf('aql').length && seed.aql){ const a=cpClone(seed.aql); delete a._seed; a.id=a.id||'cpx-aql-1'; a.type='aql'; a.source='excel'; a.createdAt=now; a.createdBy='Nhập từ Excel'; if(!cpGet(a.id)) toAdd.push(a); }
    cpImpLog('   Thêm mới '+toAdd.length+' · đã có sẵn (bỏ qua) '+existing);
    if(toAdd.length) cpPutMany(toAdd);
    cpImpLog('④ Đồng bộ lên máy chủ…'); const flushed=await cpWaitFlush(180000); cpImpLog(flushed?'   Đã đồng bộ xong.':'   ⚠ Còn mục chưa đồng bộ — sẽ tự gửi lại khi có mạng.');
    cpImpLog('⑤ Đối chiếu sau khi nhập…');
    let ok=true; const after=cpRecs().length;
    if(after!==before+toAdd.length){ ok=false; cpImpLog('   ✖ Số bản ghi cục bộ lệch: '+after+' ≠ '+(before+toAdd.length)); } else cpImpLog('   ✔ Số bản ghi cục bộ: '+before+' → '+after);
    const cnt={}; cpRecs().forEach(r=>{ if(r&&r.type==='chk'&&r.source==='excel') cnt[r.form]=(cnt[r.form]||0)+1; });
    Object.keys(expect).forEach(k=>{ const m=(cnt[k]||0)===expect[k]; if(!m) ok=false; cpImpLog('   '+(m?'✔':'✖')+' '+CP_STAGE_LABEL[k]+': '+(cnt[k]||0)+' / '+expect[k]); });
    if(typeof fbOk==='function' && fbOk() && flushed){
      const srv=await fbRead(CP_PATH)||{}, sv=Object.keys(srv);
      const sc=sv.filter(x=>/^cpx-chk-/.test(x)).length; const m=sc>=recs.length; if(!m) ok=false;
      cpImpLog('   '+(m?'✔':'✖')+' Máy chủ có '+sc+' phiếu kiểm tra nguồn Excel (cần ≥ '+recs.length+')');
      const sample=[]; for(let i=0;i<Math.min(12,recs.length);i++) sample.push(recs[Math.floor(Math.random()*recs.length)]);
      let bad=0; sample.forEach(r=>{ const s=srv[r.id]; if(!s || (cpSig(s)!==cpSig(cpGet(r.id)))) bad++; });
      if(bad) ok=false; cpImpLog('   '+(bad?'✖':'✔')+' Lấy mẫu '+sample.length+' phiếu so với máy chủ: '+(bad?bad+' lệch':'khớp'));
    } else cpImpLog('   (bỏ qua đối chiếu máy chủ: chưa đồng bộ xong hoặc chạy ngoại tuyến)');
    const lg={id:'cpx-importlog-'+now, type:'importLog', source:'app', at:now, by:cpActor(), added:toAdd.length, existing, ok, sha256:meta.sha256||'', file:meta.source||'', createdAt:now, createdBy:cpActor()};
    cpPut(lg,{}); cpImpLog(ok?'HOÀN TẤT — số liệu khớp.':'HOÀN TẤT nhưng có điểm lệch — kiểm tra log ở trên.');
  }catch(e){ console.error(e); cpImpLog('✖ DỪNG: '+e.message+' — dữ liệu hiện có không bị thay đổi.'); }
  finally{ st.busy=false; const el=$('cpImpLog'); const keep=st.log.slice(); cpRender(); const e2=$('cpImpLog'); if(e2){ e2.textContent=keep.join('\n'); } }
}
