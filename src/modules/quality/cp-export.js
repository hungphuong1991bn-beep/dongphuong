// src/modules/quality/cp-export.js — ControlPlan: XUẤT EXCEL CHUYÊN NGHIỆP (lưu trữ tài liệu QC)
// ────────────────────────────────────────────────────────────────────────────────
// Một bộ khung dùng chung cho mọi nơi xuất Excel của ControlPlan:
//   • cpExportAll()        — toàn bộ ControlPlan: trang "Tổng quan" + mỗi biểu mẫu một trang tính
//   • cpExportGroup(g)     — một nhóm (A/B/C/D)
//   • cpExportForm(key)    — một biểu mẫu
//   • cpExportList(key)    — danh sách đang xem (đã áp bộ lọc + tìm kiếm)
//   • cpDownloadXlsx(name, sheets) — API cũ {name, rows[][]} (Báo cáo, Control Plan, PFMEA…) nay cũng ra file chuẩn
// Khung mỗi trang: logo + tên công ty, tiêu đề, mã hồ sơ / ngày xuất / người xuất, phạm vi lọc,
// tiêu đề bảng tô màu có viền, dòng kẻ sọc, tô màu OK/NG, số căn giữa, ngày dd/mm/yyyy thật,
// AutoFilter, đóng băng tiêu đề, khổ in A4 ngang + lặp tiêu đề + số trang, khối chữ ký.
// Chỉ ĐỌC dữ liệu — không ghi DB.
// ────────────────────────────────────────────────────────────────────────────────
const CP_XL = {
  co:'CÔNG TY CỔ PHẦN CÔNG THƯƠNG ĐÔNG PHƯƠNG', F:'Arial',
  navy:'FF14306B', blue:'FF1D3FAE', ink:'FF1F2937', mute:'FF6B7280', line:'FFC9D2E3', soft:'FFF1F5FB', zebra:'FFF8FAFD', white:'FFFFFFFF',
  cls:{ ok:{bg:'FFD1FAE5',fg:'FF065F46'}, ng:{bg:'FFFEE2E2',fg:'FF991B1B'}, warn:{bg:'FFFEF3C7',fg:'FF92400E'}, unk:{bg:'FFE5E7EB',fg:'FF374151'} }
};
const CP_XL_SHORT = {cp:'Control Plan', pfmea:'PFMEA', aql:'AQL', defects:'Mã lỗi', dothang:'Độ thẳng', dun:'Check Đùn', rut:'Check Rút', danhbong:'Check Đánh bóng', cat:'Check Cắt', fqc:'FQC', ncr:'NCR', hold:'HOLD-RELEASE', eightd:'8D'};
const CP_XL_THIN = {style:'thin', color:{argb:CP_XL.line}};

// ── tiện ích ────────────────────────────────────────────────────────────────────
function cpXlArgb(h){ return 'FF'+String(h||'#1D3FAE').replace('#','').toUpperCase(); }
function cpXlFill(argb){ return {type:'pattern', pattern:'solid', fgColor:{argb:argb}}; }
function cpXlBox(){ return {top:CP_XL_THIN, left:CP_XL_THIN, bottom:CP_XL_THIN, right:CP_XL_THIN}; }
function cpXlFont(o){ return Object.assign({name:CP_XL.F, size:10, color:{argb:CP_XL.ink}}, o||{}); }
function cpXlTxt(v){ return v==null ? '' : String(v); }
function cpXlPad(n){ return String(n).padStart(2,'0'); }
function cpXlStamp(d){ d=d||new Date(); return d.getFullYear()+cpXlPad(d.getMonth()+1)+cpXlPad(d.getDate())+'_'+cpXlPad(d.getHours())+cpXlPad(d.getMinutes()); }
function cpXlSheetName(n, used){
  const base = String(n||'Sheet').replace(/[\\\/\?\*\[\]:]/g,' ').replace(/\s+/g,' ').trim().slice(0,31) || 'Sheet';
  let k=base, i=2;
  while(used.has(k.toLowerCase())){ const suf=' ('+i+')'; k=base.slice(0,31-suf.length)+suf; i++; }
  used.add(k.toLowerCase()); return k;
}
function cpXlIso(v){ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(cpXlTxt(v)); return m ? new Date(Date.UTC(+m[1], +m[2]-1, +m[3])) : null; }   // UTC để Excel không lệch ngày theo múi giờ
function cpXlRes(v){ const s=cpXlTxt(v).trim().toUpperCase(); if(s==='OK') return {t:'OK', c:'ok'}; if(s==='NG') return {t:'NG', c:'ng'}; return {t:'Chưa xác định', c:'unk'}; }
function cpXlStatusCls(s){ s=cpXlTxt(s); if(!s||s==='—') return ''; if(/Đóng|RELEASE|Hoàn/i.test(s)) return 'ok'; if(/Phế|HOLD|^Mở|Bản nháp/i.test(s)) return /Bản nháp/i.test(s)?'unk':'ng'; return 'warn'; }
function cpXlScope(){
  const F=cpUI.F||{}, out=[], lab={from:'Từ ngày', to:'Đến ngày', stage:'Công đoạn', qc:'Nhân viên QC', customer:'Khách hàng', order:'Mã đơn hàng', product:'Mã sản phẩm', lot:'Mã lô', result:'Kết quả', source:'Nguồn'};
  Object.keys(lab).forEach(k=>{
    let v=F[k]; if(!v) return;
    if(k==='from'||k==='to') v=cpFmtDate(v);
    else if(k==='stage') v=CP_STAGE_LABEL[v]||v;
    else if(k==='customer') v=(cpCustCanon()[v])||v;
    else if(k==='result') v={OK:'OK', NG:'NG', UNK:'Chưa xác định'}[v]||v;
    else if(k==='source') v={app:'Nhập trên phần mềm', excel:'Lịch sử từ Excel'}[v]||v;
    out.push(lab[k]+': '+v);
  });
  return out.length ? out.join('  ·  ') : 'Toàn bộ dữ liệu (không áp bộ lọc)';
}
function cpXlSave(buf, name){
  const blob=new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 800);
}

// ── kiểu cột & độ rộng ──────────────────────────────────────────────────────────
function cpXlTypes(head, rows){
  return head.map((h,i)=>{
    const H=cpXlTxt(h).trim();
    if(/^(Kết luận|Kết quả)$/i.test(H)) return 'res';
    if(/^Trạng thái/i.test(H)) return 'st';
    if(/^(Ngày|Ngày mở|Hạn)$/i.test(H)) return 'date';
    let n=0, num=0; rows.forEach(r=>{ const v=r[i]; if(v===''||v==null) return; n++; if(typeof v==='number' && isFinite(v)) num++; });
    if(n && num===n) return 'num';
    if(num>0 && num>=n*0.4) return 'mix';   // cột đo (số xen chữ "Đạt"…) → căn giữa cho đều
    if(/^(STT|#|Giờ|Mẫu|Ca|Nguồn|Liên kết|Level|Code)$/i.test(H)) return 'ctr';
    return 'txt';
  });
}
function cpXlWidth(h, rows, i, type){
  let m=0;
  rows.forEach(r=>{ const v=r[i]; if(v==null||v==='') return; const s=(v instanceof Date)?'00/00/0000':String(v); s.split('\n').forEach(t=>{ m=Math.max(m,t.length); }); });
  const words=cpXlTxt(h).split(/\s+/).map(w=>w.length), hw=(words.length?Math.max.apply(null,words):4)+3, full=cpXlTxt(h).length+3;
  let w=Math.max(m+3, hw, Math.min(full,16));
  if(type==='date') w=Math.max(w,12);
  if(type==='res') w=Math.max(w,15);
  if(type==='st') w=Math.max(w,14);
  return Math.max(7, Math.min(w, 46));
}

// ── khung đầu trang (logo + công ty + tiêu đề + meta) ───────────────────────────
function cpXlBrand(ws, nCols, title, ctx, metaExtra){
  const F=CP_XL.F;
  ws.mergeCells(1,2,1,nCols); const c1=ws.getCell(1,2); c1.value=CP_XL.co; c1.font={name:F,size:13,bold:true,color:{argb:CP_XL.navy}}; c1.alignment={vertical:'middle',horizontal:'left',indent:1};
  ws.getRow(1).height=26;
  ws.mergeCells(2,2,2,nCols); const c2=ws.getCell(2,2); c2.value=title; c2.font={name:F,size:15,bold:true,color:{argb:CP_XL.blue}}; c2.alignment={vertical:'middle',horizontal:'left',indent:1,wrapText:true};
  ws.getRow(2).height=28;
  for(let c=1;c<=nCols;c++) ws.getCell(3,c).fill=cpXlFill(CP_XL.blue);
  ws.getRow(3).height=3;
  const rt=(pairs)=>({richText:pairs.reduce((a,p,i)=>{ if(i) a.push({text:'     |     ',font:cpXlFont({size:9.5,color:{argb:CP_XL.line}})}); a.push({text:p[0]+': ',font:cpXlFont({size:9.5,bold:true,color:{argb:CP_XL.mute}})}); a.push({text:cpXlTxt(p[1]),font:cpXlFont({size:9.5,bold:true})}); return a; },[])});
  const meta=(metaExtra||[]).concat([['Mã hồ sơ',ctx.code],['Ngày xuất',ctx.dateStr],['Người xuất',ctx.actor]]);
  ws.mergeCells(4,1,4,nCols); ws.getCell(4,1).value=rt(meta); ws.getRow(4).height=19;
  ws.mergeCells(5,1,5,nCols); ws.getCell(5,1).value=rt([['Phạm vi dữ liệu',ctx.scope]]); ws.getRow(5).height=19;
  [4,5].forEach(r=>{ const c=ws.getCell(r,1); c.fill=cpXlFill(CP_XL.soft); c.alignment={vertical:'middle',horizontal:'left',indent:1,wrapText:true}; });
  ws.getRow(6).height=6;
  if(ctx.logoId!=null) ws.addImage(ctx.logoId, {tl:{col:0.12,row:0.12}, ext:{width:50,height:43}});
}
function cpXlSigns(ws, r, nCols){
  const a=Math.ceil(nCols/3), b=Math.ceil(nCols*2/3), spans=[[1,a],[a+1,b],[b+1,nCols]], names=['Người lập','Người kiểm tra','QA xác nhận'];
  spans.forEach((sp,i)=>{
    if(sp[1]<sp[0]) return;
    if(sp[1]>sp[0]) ws.mergeCells(r,sp[0],r,sp[1]);
    const c=ws.getCell(r,sp[0]); c.value=names[i]; c.font=cpXlFont({bold:true}); c.alignment={horizontal:'center'};
    if(sp[1]>sp[0]) ws.mergeCells(r+4,sp[0],r+4,sp[1]);
    const d=ws.getCell(r+4,sp[0]); d.value='(Ký, ghi rõ họ tên)'; d.font=cpXlFont({italic:true,size:9,color:{argb:CP_XL.mute}}); d.alignment={horizontal:'center'};
  });
  return r+5;
}
function cpXlFinish(ws, nCols, lastRow, ctx, noteRow){
  ws.mergeCells(noteRow,1,noteRow,nCols);
  const n=ws.getCell(noteRow,1); n.value='Tài liệu được xuất tự động từ phần mềm quản lý sản xuất Đông Phương – ControlPlan. Số liệu tại thời điểm xuất; bản in/Excel có giá trị tham chiếu khi có chữ ký xác nhận.';
  n.font=cpXlFont({italic:true,size:8.5,color:{argb:CP_XL.mute}}); n.alignment={horizontal:'left',wrapText:true,vertical:'top'}; ws.getRow(noteRow).height=24;
  ws.pageSetup.printArea='A1:'+ws.getColumn(nCols).letter+noteRow;
  ws.headerFooter.oddFooter='&L&"Arial,Italic"&8 '+CP_XL.co+' - '+ctx.code+'&C&"Arial,Regular"&8 Trang &P / &N&R&"Arial,Regular"&8 Xuất: '+ctx.dateStr;
}

// ── trang tính DỮ LIỆU ───────────────────────────────────────────────────────────
function cpXlTableSheet(wb, s, ctx){
  const HR=7, F=CP_XL.F;
  const head=s.head.slice(), rows=s.rows.map(r=>r.slice());
  const stt=s.stt!==false;
  if(stt){ head.unshift('STT'); rows.forEach((r,i)=>r.unshift(i+1)); }
  const types=cpXlTypes(head, rows); if(stt) types[0]='ctr';
  const nCols=Math.max(head.length,3), isInt=head.map((h,i)=>types[i]==='num' && rows.every(r=>r[i]===''||r[i]==null||Number.isInteger(r[i])));
  const widths=head.map((h,i)=>cpXlWidth(h,rows,i,types[i])); widths[0]=Math.max(widths[0],8);
  const ws=wb.addWorksheet(s.xlName, {
    properties:{tabColor:{argb:s.tab||CP_XL.blue}},
    views:[{state:'frozen', ySplit:HR, showGridLines:false}],
    pageSetup:{orientation:'landscape', paperSize:9, fitToPage:true, fitToWidth:1, fitToHeight:0, printTitlesRow:HR+':'+HR, horizontalCentered:true, margins:{left:0.35,right:0.35,top:0.5,bottom:0.65,header:0.25,footer:0.3}}
  });
  widths.forEach((w,i)=>{ ws.getColumn(i+1).width=w; });
  for(let i=head.length;i<nCols;i++) ws.getColumn(i+1).width=12;
  cpXlBrand(ws, nCols, s.title, ctx, s.meta);

  // tiêu đề bảng
  head.forEach((h,i)=>{
    const c=ws.getCell(HR,i+1); c.value=h; c.font={name:F,size:10,bold:true,color:{argb:CP_XL.white}};
    c.fill=cpXlFill(CP_XL.blue); c.alignment={horizontal:'center',vertical:'middle',wrapText:true};
    c.border={top:CP_XL_THIN,left:{style:'thin',color:{argb:'FF8FA3D6'}},bottom:CP_XL_THIN,right:{style:'thin',color:{argb:'FF8FA3D6'}}};
  });
  ws.getRow(HR).height=34;

  // dữ liệu
  rows.forEach((row,ri)=>{
    const rr=HR+1+ri; let lines=1;
    head.forEach((h,ci)=>{
      const cell=ws.getCell(rr,ci+1), t=types[ci], v=row[ci];
      cell.font=cpXlFont(); cell.border=cpXlBox();
      cell.alignment={vertical:'middle', wrapText:true, horizontal:t==='txt'?'left':'center'};
      if(ri%2) cell.fill=cpXlFill(CP_XL.zebra);
      if(t==='date'){ const d=cpXlIso(v); if(d){ cell.value=d; cell.numFmt='dd/mm/yyyy'; } else cell.value=cpXlTxt(v); }
      else if(t==='num' && typeof v==='number'){ cell.value=v; cell.numFmt=isInt[ci]?'#,##0':'#,##0.00'; }
      else if(t==='res'){ const k=cpXlRes(v), x=CP_XL.cls[k.c]; cell.value=k.t; cell.font=cpXlFont({bold:true,color:{argb:x.fg}}); cell.fill=cpXlFill(x.bg); }
      else if(t==='st'){ const k=cpXlStatusCls(v), x=CP_XL.cls[k]; cell.value=cpXlTxt(v); if(x){ cell.font=cpXlFont({bold:true,color:{argb:x.fg}}); cell.fill=cpXlFill(x.bg); } }
      else cell.value=cpXlTxt(v);
      const txt=(v instanceof Date)?'':cpXlTxt(v); if(txt.length>widths[ci]-1){ const l=txt.split('\n').reduce((a,p)=>a+Math.max(1,Math.ceil(p.length/Math.max(1,widths[ci]-1))),0); if(l>lines) lines=l; } else if(txt.indexOf('\n')>=0){ lines=Math.max(lines,txt.split('\n').length); }
    });
    if(lines>1) ws.getRow(rr).height=Math.min(200, lines*13+5); else ws.getRow(rr).height=18;
  });
  let r=HR+rows.length+1;
  if(!rows.length){
    ws.mergeCells(HR+1,1,HR+1,nCols); const c=ws.getCell(HR+1,1); c.value='Không có dữ liệu trong phạm vi lọc.'; c.font=cpXlFont({italic:true,color:{argb:CP_XL.mute}}); c.alignment={horizontal:'center',vertical:'middle'}; c.border=cpXlBox(); ws.getRow(HR+1).height=26; r=HR+2;
  } else {
    ws.autoFilter={from:{row:HR,column:1}, to:{row:HR+rows.length,column:nCols}};
  }
  // dòng tổng hợp
  (s.foot||[]).forEach(t=>{
    ws.mergeCells(r,1,r,nCols); const c=ws.getCell(r,1); c.value=t; c.font=cpXlFont({bold:true}); c.fill=cpXlFill(CP_XL.soft); c.alignment={horizontal:'left',vertical:'middle',indent:1,wrapText:true}; c.border=cpXlBox(); ws.getRow(r).height=20; r++;
  });
  (s.notes||[]).forEach(t=>{
    ws.mergeCells(r,1,r,nCols); const c=ws.getCell(r,1); c.value=t; c.font=cpXlFont({italic:true,size:9,color:{argb:CP_XL.mute}}); c.alignment={horizontal:'left',vertical:'top',wrapText:true}; ws.getRow(r).height=Math.max(16,Math.ceil(t.length/(nCols*9))*13+4); r++;
  });
  r+=1;
  r=cpXlSigns(ws, r, nCols);
  cpXlFinish(ws, nCols, r, ctx, r+1);
  return ws;
}

// ── trang TỔNG QUAN ─────────────────────────────────────────────────────────────
function cpXlBand(ws, r, c1, c2, fillArgb, border){
  for(let c=c1;c<=c2;c++){ const x=ws.getCell(r,c); if(fillArgb) x.fill=cpXlFill(fillArgb); if(border) x.border=border; }
}
function cpXlOverview(wb, o, ctx){
  const F=CP_XL.F, N=10, FKEY=o.F||{};
  const ws=wb.addWorksheet('Tổng quan', {
    properties:{tabColor:{argb:CP_XL.navy}}, views:[{showGridLines:false}],
    pageSetup:{orientation:'portrait', paperSize:9, fitToPage:true, fitToWidth:1, fitToHeight:1, horizontalCentered:true, margins:{left:0.35,right:0.35,top:0.5,bottom:0.65,header:0.25,footer:0.3}}
  });
  for(let i=1;i<=N;i++) ws.getColumn(i).width=i===N?17:13.5;
  cpXlBrand(ws, N, o.title, ctx, o.meta);
  let r=7;
  const section=(t)=>{
    ws.mergeCells(r,1,r,N); const c=ws.getCell(r,1); c.value=t; c.font={name:F,size:11,bold:true,color:{argb:CP_XL.navy}}; c.alignment={vertical:'middle',horizontal:'left'};
    cpXlBand(ws, r, 1, N, null, {bottom:{style:'medium',color:{argb:CP_XL.navy}}}); ws.getRow(r).height=22; r++;
    ws.getRow(r).height=6; r++;
  };

  // I. KPI
  section('I.  CHỈ TIÊU CHẤT LƯỢNG' + (o.groups.length<4?'  (toàn hệ thống)':''));
  const K=o.kpis;
  const cards=[
    ['Tổng số phiếu kiểm tra',K.total,'#2563EB'], ['Số phiếu hôm nay',K.today,'#0D9488'], ['Phiếu đạt OK',K.ok,'#047857'], ['Phiếu NG',K.ng,'#DC2626'],
    ['Tỷ lệ NG (trên phiếu đã có kết luận)',(K.ok+K.ng)?K.ng/(K.ok+K.ng):null,'#B91C1C','pct'],
    ['Lô đang HOLD',K.holdOpen,'#D97706'], ['NCR chưa đóng',K.ncrOpen,'#9333EA'], ['Hành động 8D đang xử lý',K.d8Open,'#0369A1'], ['Chưa xác định kết quả',K.unk,'#64748B'], ['Bản nháp',K.drafts,'#94A3B8']
  ];
  [0,1].forEach(g=>{
    const rl=r, rv=r+1;
    cards.slice(g*5, g*5+5).forEach((cd,k)=>{
      const c1=1+k*2, c2=c1+1, col=cpXlArgb(cd[2]);
      ws.mergeCells(rl,c1,rl,c2); ws.mergeCells(rv,c1,rv,c2);
      for(let c=c1;c<=c2;c++){
        const a=ws.getCell(rl,c), b=ws.getCell(rv,c);
        a.fill=cpXlFill(CP_XL.soft); b.fill=cpXlFill(CP_XL.soft);
        const gap={style:'thick',color:{argb:CP_XL.white}}, ba={top:{style:'thick',color:{argb:col}}}, bb={bottom:{style:'thin',color:{argb:CP_XL.line}}};
        if(c===c1){ ba.left=gap; bb.left=gap; } if(c===c2){ ba.right=gap; bb.right=gap; }
        a.border=ba; b.border=bb;
      }
      const a=ws.getCell(rl,c1), b=ws.getCell(rv,c1);
      a.value=cd[0]; a.font={name:F,size:9,bold:true,color:{argb:CP_XL.mute}}; a.alignment={horizontal:'center',vertical:'middle',wrapText:true};
      if(cd[3]==='pct'){ if(cd[1]==null){ b.value='—'; } else { b.value=cd[1]; b.numFmt='0.0%'; } } else { b.value=cd[1]; b.numFmt='#,##0'; }
      b.font={name:F,size:22,bold:true,color:{argb:col}}; b.alignment={horizontal:'center',vertical:'middle'};
    });
    ws.getRow(rl).height=30; ws.getRow(rv).height=40; r+=3; ws.getRow(r-1).height=6;
  });

  // II. Danh mục biểu mẫu
  section('II.  DANH MỤC BIỂU MẪU VÀ SỐ LIỆU');
  const spans=[[1,1],[2,5],[6,7],[8,8],[9,9],[10,10]], heads=['STT','Biểu mẫu','Mã biểu mẫu','Số lượng','Hôm nay','NG / Đang mở'];
  const rowOf=(rr,vals,styler)=>{ spans.forEach((sp,i)=>{ if(sp[1]>sp[0]) ws.mergeCells(rr,sp[0],rr,sp[1]); for(let c=sp[0];c<=sp[1];c++){ ws.getCell(rr,c).border=cpXlBox(); } const c=ws.getCell(rr,sp[0]); c.value=vals[i]; styler(c,i); }); };
  rowOf(r, heads, (c,i)=>{ c.font={name:F,size:10,bold:true,color:{argb:CP_XL.white}}; c.alignment={horizontal:'center',vertical:'middle',wrapText:true}; for(let x=spans[i][0];x<=spans[i][1];x++) ws.getCell(r,x).fill=cpXlFill(CP_XL.blue); });
  ws.getRow(r).height=26; r++;
  let tot={n:0,today:0,ng:0};
  o.groups.forEach(g=>{
    ws.mergeCells(r,1,r,N); const gc=ws.getCell(r,1), col=cpXlArgb(g.color);
    gc.value=g.title+'   ('+g.items.length+' biểu mẫu)'; gc.font={name:F,size:10.5,bold:true,color:{argb:CP_XL.white}}; gc.alignment={horizontal:'left',vertical:'middle',indent:1};
    cpXlBand(ws, r, 1, N, col, cpXlBox()); ws.getRow(r).height=22; r++;
    g.items.forEach((it,ix)=>{
      const f=it.f, s=it.s, isForm=f.kind==='form', unit=isForm?'phiếu':s.unit, zebra=ix%2?CP_XL.zebra:null;
      const vals=[f.no, f.no+'. '+f.title, f.code||'Chưa quy định', s.n, isForm?s.today:'—', isForm?s.ng:'—'];
      rowOf(r, vals, (c,i)=>{
        c.font=cpXlFont(); c.alignment={horizontal:i===1?'left':'center',vertical:'middle',wrapText:true,indent:i===1?1:0};
        if(i===1 && it.link){ c.value={text:vals[1], hyperlink:"#'"+it.link.replace(/'/g,"''")+"'!A1", tooltip:'Mở trang dữ liệu'}; c.font=cpXlFont({color:{argb:'FF1D4ED8'},underline:true,bold:true}); }
        if(i===3){ c.numFmt='#,##0" '+unit+'"'; c.font=cpXlFont({bold:true}); }
        if(i===4 && isForm) c.numFmt='#,##0';
        if(i===5 && isForm){ c.numFmt='#,##0'; if(s.ng>0){ c.font=cpXlFont({bold:true,color:{argb:CP_XL.cls.ng.fg}}); c.fill=cpXlFill(CP_XL.cls.ng.bg); } }
        if((i===4||i===5) && !isForm) c.font=cpXlFont({color:{argb:CP_XL.mute}});
        if(zebra && !(i===5 && isForm && s.ng>0)) for(let x=spans[i][0];x<=spans[i][1];x++) ws.getCell(r,x).fill=cpXlFill(zebra);
      });
      ws.getRow(r).height=22; r++;
      if(isForm){ tot.n+=s.n; tot.today+=s.today; tot.ng+=s.ng; }
    });
  });
  // dòng cộng (chỉ các biểu mẫu có phiếu)
  rowOf(r, ['', 'TỔNG CỘNG CÁC BIỂU MẪU CÓ PHIẾU', '', tot.n, tot.today, tot.ng], (c,i)=>{
    c.font=cpXlFont({bold:true}); c.alignment={horizontal:i===1?'left':'center',vertical:'middle',indent:i===1?1:0}; if(i>=3) c.numFmt='#,##0'; for(let x=spans[i][0];x<=spans[i][1];x++) ws.getCell(r,x).fill=cpXlFill(CP_XL.soft);
  });
  ws.getRow(r).height=22; r+=2;

  // III. Ghi chú
  section('III.  GHI CHÚ');
  (o.notes||[]).forEach(t=>{
    ws.mergeCells(r,1,r,N); const c=ws.getCell(r,1); c.value='•  '+t; c.font=cpXlFont({size:9.5}); c.alignment={horizontal:'left',vertical:'top',wrapText:true,indent:1}; ws.getRow(r).height=Math.max(16,Math.ceil(t.length/125)*13+4); r++;
  });
  r+=1;
  r=cpXlSigns(ws, r, N);
  cpXlFinish(ws, N, r, ctx, r+1);
  return ws;
}

// ── dữ liệu từng biểu mẫu → đặc tả trang tính ───────────────────────────────────
function cpXlLinkTxt(r){ try{ return cpLinkStatus(r).t; }catch(e){ return ''; } }
function cpXlNumOr(v){ const n=cpNum(v); return n==null ? cpXlTxt(v) : n; }
function cpXlTs(ts){ return ts ? cpFmtTs(ts) : ''; }
function cpXlFormSpecs(key){
  const f=cpFormDef(key); if(!f) return [];
  const g=CP_GROUPS.find(x=>x.key===f.g)||{}, tab=cpXlArgb(g.color), type=CP_TYPE_OF_FORM[key];
  const base={key:key, name:String(f.no).padStart(2,'0')+' '+(CP_XL_SHORT[key]||f.title), title:f.no+'. '+f.title.toUpperCase(), tab:tab, meta:[['Mã biểu mẫu', f.code||'Chưa quy định']], notes:[], foot:[]};
  const mk=(o)=>Object.assign({}, base, o);

  if(key==='cp'){ const m=cpMasterCpMatrix(); return [mk({head:m[0], rows:m.slice(1), stt:false, foot:['Tổng số: '+(m.length-1)+' dòng kế hoạch kiểm soát']})]; }
  if(key==='pfmea'){ const m=cpPfmeaMatrix(); return [mk({head:m[0], rows:m.slice(1), stt:false, foot:['Tổng số: '+(m.length-1)+' dòng phân tích rủi ro (RPN = S × O × D)']})]; }
  if(key==='defects'){ const l=cpDefects(); return [mk({head:['Mã','Tên lỗi','Tiêu chuẩn đạt','Phản ứng khi NG','Tham chiếu'], rows:l.map(d=>[d.code,d.name,d.accept,d.reaction,d.ref]), foot:['Tổng số: '+l.length+' mã lỗi ngoại quan']})]; }
  if(key==='aql'){
    const T=cpAqlRec(); if(!T) return [mk({head:['Nội dung'], rows:[], notes:['Chưa có bảng AQL.']})];
    const lv=T.levels||[];
    return [mk({head:['Quy mô lô','Code','Cỡ mẫu'].concat(lv.map(c=>'AQL '+c)), rows:(T.codes||[]).map(c=>[c.range, c.code, cpXlNumOr(c.n)].concat(lv.map(a=>(T.table[c.code]||{})[a]||'—'))), meta:[['Mã biểu mẫu',f.code],['Mức kiểm tra','Level '+(T.inspectionLevel||'II')]], notes:[CP_AQL_WARN]})];
  }
  const rows=cpListRows(key);
  if(type==='chk'){
    const dt=key==='dothang', hasLen=key!=='dun', flat=[]; rows.forEach(r=>(r.lines||[]).forEach(l=>flat.push([r,l])));
    const head=dt ? ['Ngày','Mã phiếu','Khách hàng','Đơn hàng','Quy cách','Xưởng','Mã lô','Độ thẳng cạnh','Độ thẳng mặt','Độ vểnh','Độ vặn','Tiêu chuẩn','Kết luận','QC','Trạng thái phiếu','Liên kết','Nguồn']
                   : ['Ngày','Mã phiếu','Ca','Khách hàng','Đơn hàng','Quy cách','Xưởng','Máy','Mã lô','Giờ','Mẫu','Dày','Rộng'].concat(hasLen?['Dài']:[]).concat(['Ngoại quan','Kết luận','QC','Trạng thái phiếu','Liên kết','Nguồn']);
    const src=r=>r.source==='excel'?'Excel':'PM', stt=r=>r.status==='draft'?'Bản nháp':'Hoàn tất', od=r=>r.orderCode||r.po||'';
    const out=flat.map(([r,l])=> dt ? [r.date,r.code,cpCust(r),od(r),r.spec,r.workshop,r.lot,cpXlNumOr(l.edge),cpXlNumOr(l.face),cpXlNumOr(l.warp),cpXlNumOr(l.twist),r.standard,l.result,r.inspector,stt(r),cpXlLinkTxt(r),src(r)]
                                    : [r.date,r.code,r.shift,cpCust(r),od(r),r.spec,r.workshop,r.machine,r.lot,l.time,l.n,cpXlNumOr(l.thick),cpXlNumOr(l.width)].concat(hasLen?[cpXlNumOr(l.length)]:[]).concat([cpAppear(l),l.result,r.inspector,stt(r),cpXlLinkTxt(r),src(r)]));
    const ok=flat.filter(x=>x[1].result==='OK').length, ng=flat.filter(x=>x[1].result==='NG').length;
    return [mk({head:head, rows:out, foot:['Tổng cộng: '+rows.length+' phiếu  ·  '+flat.length+' dòng đo  ·  OK: '+ok+'  ·  NG: '+ng+'  ·  Chưa xác định: '+(flat.length-ok-ng)]})];
  }
  if(type==='fqc'){
    const ok=rows.filter(r=>r.result==='OK').length, ng=rows.filter(r=>r.result==='NG').length;
    return [mk({head:['Ngày','Mã phiếu','Khách hàng','Đơn hàng','Mã SP','Mã lô','SL lô','Level','Code','Cỡ mẫu','AQL Major','AQL Minor','AQL Critical','Major NG','Minor NG','Critical NG','Kết luận','QA/QC','Ghi chú','Nguồn'],
      rows:rows.map(r=>[r.date,r.code,cpCust(r),r.orderCode||r.po||'',r.productCode||'CHƯA XÁC ĐỊNH',r.lot,cpXlNumOr(r.lotQty),r.level,r.aqlCode,cpXlNumOr(r.sampleSize),r.aqlMajor,r.aqlMinor,r.aqlCritical,cpXlNumOr(r.majorNG||0),cpXlNumOr(r.minorNG||0),cpXlNumOr(r.criticalNG||0),r.result,r.inspector,r.note,r.source==='excel'?'Excel':'PM']),
      foot:['Tổng cộng: '+rows.length+' phiếu FQC  ·  Đạt (OK): '+ok+'  ·  Không đạt (NG): '+ng+'  ·  Chưa xác định: '+(rows.length-ok-ng)]})];
  }
  if(type==='ncr'){
    const open=rows.filter(r=>r.status!=='Đã đóng').length;
    return [mk({head:['Số NCR','Ngày','Khách hàng','Đơn hàng','Mã SP','Mã lô','Công đoạn','Mô tả NG','Tiêu chuẩn','SL ảnh hưởng','Phân loại','Hành động ngăn chặn','Nguyên nhân','Hành động khắc phục','Kiểm chứng','Quyết định','Trạng thái','Phụ trách','Phê duyệt bởi'],
      rows:rows.map(r=>[r.code,r.date,cpCust(r),r.orderCode||r.po||'',r.productCode,r.lot,r.stage,r.desc,r.standard,cpXlNumOr(r.qtyAffected),r.klass,r.containment,r.cause,r.action,r.verification,r.disposition,r.status,r.owner,r.approvedBy]),
      foot:['Tổng cộng: '+rows.length+' NCR  ·  Chưa đóng: '+open+'  ·  Đã đóng: '+(rows.length-open)]})];
  }
  if(type==='hold'){
    const open=rows.filter(r=>CP_HOLD_OPEN.includes(r.status)).length;
    return [mk({head:['Số HOLD','Thời điểm HOLD','Khách hàng','Đơn hàng','Mã SP','Mã lô','SL','Lý do','Phạm vi','Ngăn chặn','Điều tra','Quyết định','Trạng thái','Người HOLD','Phụ trách','Người RELEASE','Thời điểm RELEASE','NCR liên kết'],
      rows:rows.map(r=>[r.code,cpXlTs(r.heldAt),cpCust(r),r.orderCode||r.po||'',r.productCode,r.lot,cpXlNumOr(r.qty),r.reason,r.scope,r.containment,r.investigation,r.disposition,r.status,r.holdBy,r.owner,r.releaseBy,cpXlTs(r.releaseAt),(cpGet(r.ncrId)||{}).code||'']),
      foot:['Tổng cộng: '+rows.length+' phiếu HOLD  ·  Đang mở: '+open+'  ·  Đã xử lý: '+(rows.length-open)]})];
  }
  if(type==='eightd'){
    const open=rows.filter(r=>r.status!=='Đã đóng').length, steps=[];
    rows.forEach(r=>(r.steps||[]).forEach(s=>steps.push([r.code,s.step,s.title,s.content,s.owner,s.due,s.evidence,s.status])));
    const sum=mk({head:['Số 8D','Ngày mở','Vấn đề','Khách hàng','Mã SP','Mã lô','Nguồn kích hoạt','Tiến độ','Bước quá hạn','Trạng thái','Trưởng nhóm'],
      rows:rows.map(r=>{ const p=cp8dProgress(r); return [r.code,r.date,r.title,cpCust(r),r.productCode,r.lot,r.trigger,p.done+'/9',p.late,r.status,r.leader]; }),
      foot:['Tổng cộng: '+rows.length+' hồ sơ 8D  ·  Đang xử lý: '+open+'  ·  Đã đóng: '+(rows.length-open)]});
    const det=mk({name:String(f.no).padStart(2,'0')+' 8D - Chi tiết bước', title:f.no+'. 8D – CHI TIẾT TỪNG BƯỚC D0–D8', head:['Số 8D','Bước','Tên bước','Nội dung','Phụ trách','Hạn','Bằng chứng','Trạng thái'], rows:steps, stt:true, foot:['Tổng cộng: '+steps.length+' bước thuộc '+rows.length+' hồ sơ 8D']});
    return [sum, det];
  }
  return [];
}

// ── lõi dựng & tải file ─────────────────────────────────────────────────────────
async function cpXlExport(o){
  // o = {keys:[formKey], file, title, overview:bool, groups:[groupKey]}
  if(typeof showToast==='function') showToast('⏳ Đang tạo file Excel...', false);
  try{ await ensureExcelJs(); }catch(e){ showToast('❌ Không tải được thư viện xuất Excel — kiểm tra kết nối mạng rồi thử lại', true); return false; }
  if(typeof ExcelJS==='undefined'){ showToast('⏳ Thư viện Excel chưa tải xong, vui lòng thử lại sau vài giây', true); return false; }
  try{
    const now=new Date(), used=new Set(['tổng quan']);
    const ctx={code:(o.code||'CP-QC')+'-'+cpXlStamp(now).replace('_','-'), dateStr:cpFmtDate(cpYmd(now))+' '+cpHm(now), actor:cpActor(), scope:o.scope||cpXlScope(), logoId:null};
    const wb=new ExcelJS.Workbook(); wb.creator=ctx.actor; wb.created=now; wb.title=o.title; wb.company=CP_XL.co;
    try{ if(typeof DP_LOGO_DATAURL!=='undefined' && DP_LOGO_DATAURL) ctx.logoId=wb.addImage({base64:DP_LOGO_DATAURL, extension:'jpeg'}); }catch(e){ ctx.logoId=null; }

    const specs=[], linkOf={};
    (o.keys||[]).forEach(k=>{ cpXlFormSpecs(k).forEach((sp,i)=>{ sp.xlName=cpXlSheetName(sp.name, used); if(i===0) linkOf[k]=sp.xlName; specs.push(sp); }); });
    (o.sheets||[]).forEach(sp=>{ sp.xlName=cpXlSheetName(sp.name, used); specs.push(sp); });

    if(o.overview){
      const F=cpUI.F||{}, gk=o.groups||CP_GROUPS.map(g=>g.key);
      cpXlOverview(wb, {
        title:o.title, F:F, kpis:cpKpis(F),
        groups:CP_GROUPS.filter(g=>gk.indexOf(g.key)>=0).map(g=>({title:g.title, color:g.color, items:CP_FORMS.filter(f=>f.g===g.key).map(f=>({f:f, s:cpCardStats(f.key,F), link:linkOf[f.key]||''}))})),
        notes:[
          'Phạm vi số liệu: '+ctx.scope+'.',
          'Các chỉ tiêu KPI chỉ tính phiếu kiểm tra đã hoàn tất; phiếu "Chưa xác định" không được tính vào tỷ lệ NG; bản nháp được thống kê riêng.',
          'Cột "NG / Đang mở": với Check Sheet và FQC là số phiếu NG; với HOLD là số lô đang HOLD; với NCR và 8D là số hồ sơ chưa đóng.',
          'Nhấp vào tên biểu mẫu để chuyển tới trang dữ liệu tương ứng trong file này. Dữ liệu gồm cả lịch sử nhập từ Excel (nhãn "Excel") và phiếu nhập trên phần mềm (nhãn "PM").'
        ]
      }, ctx);
    }
    specs.forEach(sp=>cpXlTableSheet(wb, sp, ctx));
    if(wb.worksheets.length===0) throw new Error('Không có dữ liệu để xuất');
    const buf=await wb.xlsx.writeBuffer();
    cpXlSave(buf, o.file);
    showToast('✅ Đã xuất file Excel: '+o.title);
    return true;
  }catch(e){ console.error('[cp-export]', e); showToast('❌ Xuất Excel thất bại: '+(e&&e.message||e), true); return false; }
}

// ── điểm vào cho giao diện ──────────────────────────────────────────────────────
function cpExportAll(){
  return cpXlExport({keys:CP_FORMS.map(f=>f.key), overview:true, code:'CP-QC', title:'BÁO CÁO TỔNG HỢP HỆ THỐNG KIỂM SOÁT CHẤT LƯỢNG – CONTROLPLAN', file:'ControlPlan_QC_TongHop_'+cpXlStamp()+'.xlsx'});
}
function cpExportGroup(gk){
  const g=CP_GROUPS.find(x=>x.key===gk); if(!g) return;
  return cpXlExport({keys:CP_FORMS.filter(f=>f.g===gk).map(f=>f.key), groups:[gk], overview:true, code:'CP-'+gk, title:g.title.toUpperCase(), file:'ControlPlan_Nhom'+gk+'_'+cpXlStamp()+'.xlsx'});
}
function cpExportForm(key){
  const f=cpFormDef(key); if(!f) return;
  return cpXlExport({keys:[key], overview:false, code:'CP-'+String(f.no).padStart(2,'0'), title:f.title.toUpperCase(), file:'ControlPlan_'+String(f.no).padStart(2,'0')+'_'+key+'_'+cpXlStamp()+'.xlsx'});
}
function cpExportList(key){ return cpExportForm(key); }   // danh sách đang xem = cùng bộ lọc + ô tìm kiếm

// API cũ: sheets = [{name, rows:[[tiêu đề...],[dòng...]], title?}] — dùng cho Báo cáo, Control Plan, PFMEA…
function cpDownloadXlsx(name, sheets, title){
  const list=(sheets||[]).filter(s=>s&&s.rows&&s.rows.length).map(s=>({name:s.name, title:String(s.title||s.name).toUpperCase(), head:s.rows[0].map(x=>x==null?'':x), rows:s.rows.slice(1), tab:CP_XL.blue, stt:s.stt!==false && !/^#$/.test(cpXlTxt(s.rows[0][0])), meta:[], notes:[], foot:[(s.rows.length-1)+' dòng dữ liệu']}));
  if(!list.length){ showToast('Không có dữ liệu để xuất', true); return Promise.resolve(false); }
  return cpXlExport({keys:[], sheets:list, overview:false, code:'CP-BC', title:title||list[0].title, file:name});
}
