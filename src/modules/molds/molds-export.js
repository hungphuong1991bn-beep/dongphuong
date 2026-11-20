// src/modules/molds/molds-export.js  — tách từ index.html gốc (v2.5.141).
// v2.10.2: SỬA LỖI xuất Excel thiếu khuôn so với màn hình — xem ghi chú "LỖI GỐC" ở mục "Phân nhóm & lập kế hoạch xuất" bên dưới.
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ══════════════════════════════════════════════════════════════════
// XUẤT EXCEL — BẢNG TỔNG HỢP KHUÔN
// Giữ NGUYÊN 100% khung mẫu gốc (logo, tiêu đề, màu, viền, độ rộng cột,
// merge ô…) bằng cách nạp thẳng file mẫu (nhúng sẵn dạng base64) rồi chỉ
// GHI ĐÈ giá trị dữ liệu — không tự vẽ lại style, nên không bao giờ lệch
// định dạng so với file mẫu đính kèm.
// ══════════════════════════════════════════════════════════════════

// File mẫu "Tổng hợp Khuôn" gốc (Bảng tổng hợp khuôn Đồng thanh cái –
// Điện cực – Phi tròn), nhúng dạng base64 để không cần tải thêm file nào.
const KHUON_XLSX_TEMPLATE_B64 = "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";

// Cấu trúc các khối cột trong file mẫu — mỗi khối gồm 1 hoặc nhiều cột
// "CHỦNG LOẠI" liền nhau, dùng chung 1 cột STT (cột A) cho toàn bảng.
// Đúng thứ tự trái→phải như trong file mẫu: ĐỒNG THANH DẸT (3 cột) →
// PHI TRÒN (2 cột) → ĐIỆN CỰC (2 cột) → BO CẠNH (2 cột) → YÊU CẦU & CHUẨN (2 cột).
const KHUON_XLSX_GROUPS = [
  {category:'Đồng thanh dẹt', cols:['B','C','D']},
  {category:'Phi tròn',        cols:['E','F']},
  {category:'Điện cực',        cols:['G','H']},
  {category:'Bo cạnh',         cols:['I','J']},
  {category:'Yêu cầu & chuẩn', cols:['K','L']}
];
const KHUON_XLSX_FIRST_DATA_ROW  = 7;  // dòng đầu tiên chứa dữ liệu (STT=1)
const KHUON_XLSX_TEMPLATE_ROWS   = 55; // số dòng dữ liệu có sẵn trong mẫu (dòng 7→61)
const KHUON_XLSX_TEMPLATE_LASTCOL = 12; // cột L

function khColIdx(letter){ return letter.toUpperCase().charCodeAt(0) - 64; }

// ── Phân nhóm & lập kế hoạch xuất ────────────────────────────────────
// LỖI GỐC (đã sửa, v2.10.2): xuất Excel thiếu khuôn so với màn hình vì
//  (1) khXlsxBuildPlan BỎ bản ghi có size rỗng/null/thiếu trường (`skipped++`) → mất khuôn nhưng
//      phép đối chiếu cũ so "số ghi ra" với `plan.total` (ĐÃ trừ các bản ghi bị bỏ) nên luôn báo
//      "đủ 433/433" dù giao diện có 437;
//  (2) tên nhóm tùy chỉnh bị gộp nhầm vào nhóm mặc định bằng regex (vd "Điện cực đặc biệt" → "Điện cực",
//      "Khuôn phi 2" → "Phi tròn") làm sai tên nhóm trong file;
//  (3) luôn xuất cả danh mục, bỏ qua bộ lọc nhóm/tìm kiếm đang bật, không có chế độ rõ ràng;
//  (4) không đọc lại file đã tạo để đối chiếu.
// Quy tắc hiện nay:
//   • MỌI bản ghi object trong danh sách cần xuất đều có mặt đúng 1 lần (kể cả trùng kích thước,
//     thiếu size → ghi "(chưa có kích thước – ID …)", size dạng số, nhóm rỗng/lạ).
//   • Tên nhóm chỉ khớp 5 khối mẫu khi TRÙNG TÊN sau chuẩn hoá hoa/thường/dấu/khoảng trắng; nhóm khác
//     (kể cả nhóm tùy chỉnh) có khối cột riêng, đúng tên nhóm.
//   • Sau khi ghi, đọc lại chính file .xlsx và đối chiếu từng ô; lệch → KHÔNG tải file, báo nguyên nhân.
const KHUON_XLSX_EXTRA_COLS = 2; // mỗi nhóm ngoài mẫu chiếm 2 cột (giống khối "Yêu cầu & chuẩn")

// Trả về tên nhóm CHUẨN của mẫu (1 trong 5) hoặc null nếu là nhóm khác/rỗng.
function khXlsxGroupOf(category){
  const k = khNormCat(category);
  if(!k) return null;
  for(const g of KHUON_XLSX_GROUPS){ if(khNormCat(g.category)===k) return g.category; }
  return null;
}

// Nội dung ô của 1 bản ghi: kích thước (đã cắt khoảng trắng đầu/cuối); thiếu → ghi rõ, không bỏ dòng.
function khXlsxCellText(x){
  const size = String(x.size==null?'':x.size).trim();
  if(size) return size;
  const id = (x.id==null||x.id==='') ? '' : ' – ID ' + x.id;
  return '(chưa có kích thước' + id + ')';
}

// Lập kế hoạch xuất: mỗi khối = {category, label, cols:[chỉ số cột], chunks, rowsPerCol, extra}.
// Hàm thuần (không đụng DOM/ExcelJS) để kiểm thử được.
//   total   = số bản ghi hợp lệ đưa vào kế hoạch (PHẢI bằng số bản ghi object của danh sách đầu vào)
//   invalid = số phần tử KHÔNG phải bản ghi (null/undefined/kiểu nguyên thủy) — không phải khuôn
//   noSize  = số bản ghi thiếu kích thước (vẫn được xuất)
function khXlsxBuildPlan(catalog){
  const fixed = {}; KHUON_XLSX_GROUPS.forEach(g=>{ fixed[g.category] = []; });
  const extras = new Map(); // khoá chuẩn hoá -> {label, list}
  let total = 0, invalid = 0, noSize = 0;
  (catalog||[]).forEach(x=>{
    if(!x || typeof x!=='object'){ invalid++; return; }
    const size = String(x.size==null?'':x.size).trim();
    if(!size) noSize++;
    const rec = Object.assign({}, x, {size, text:khXlsxCellText(x)});
    total++;
    const g = khXlsxGroupOf(x.category);
    if(g){ fixed[g].push(rec); return; }
    const label = khCleanCat(x.category) || 'Chưa phân nhóm';
    const key = khNormCat(label) || 'chua phan nhom';
    if(!extras.has(key)) extras.set(key, {label, list:[]});
    extras.get(key).list.push(rec);
  });

  // Sắp xếp theo `size` (rỗng → cuối, giữ thứ tự gốc) bằng đúng sortKhuonList của giao diện.
  const split = (list, ncols)=>{
    const sorted = sortKhuonList(list, 'size');
    const rowsPerCol = Math.ceil(sorted.length / ncols) || 0;
    return {rowsPerCol, chunks: Array.from({length:ncols}, (_,i)=> sorted.slice(i*rowsPerCol, (i+1)*rowsPerCol))};
  };

  const blocks = KHUON_XLSX_GROUPS.map(g=>{
    const cols = g.cols.map(khColIdx);
    return Object.assign({category:g.category, label:g.category, cols, extra:false}, split(fixed[g.category], cols.length));
  });
  let nextCol = KHUON_XLSX_TEMPLATE_LASTCOL + 1;
  [...extras.values()]
    .sort((a,b)=>a.label.localeCompare(b.label,'vi'))
    .forEach(e=>{
      const cols = Array.from({length:KHUON_XLSX_EXTRA_COLS}, (_,i)=> nextCol + i);
      nextCol += KHUON_XLSX_EXTRA_COLS;
      blocks.push(Object.assign({category:e.label, label:e.label, cols, extra:true}, split(e.list, cols.length)));
    });

  return {
    blocks, total, invalid, noSize,
    lastCol: nextCol - 1,
    neededRows: Math.max(1, ...blocks.map(b=>b.rowsPerCol)),
    extraBlocks: blocks.filter(b=>b.extra)
  };
}
// Số bản ghi thực sự được xếp vào các khối của kế hoạch.
function khXlsxPlanPlaced(plan){
  return plan.blocks.reduce((s,b)=> s + b.chunks.reduce((t,a)=>t+a.length,0), 0);
}

function khXlsxCloneStyle(st){ return JSON.parse(JSON.stringify(st||{})); }

// Đọc chữ trong 1 ô ExcelJS (chuỗi / số / rich text / công thức) → chuỗi đã cắt khoảng trắng.
function khXlsxReadCell(v){
  if(v===null||v===undefined) return '';
  if(typeof v==='object'){
    if(Array.isArray(v.richText)) return v.richText.map(t=>t.text).join('').trim();
    if(v.result!==undefined) return String(v.result).trim();
    if(v.text!==undefined) return String(v.text).trim();
    if(v instanceof Date) return v.toISOString();
    return String(v).trim();
  }
  return String(v).trim();
}

// ĐỐI CHIẾU SAU KHI XUẤT: nạp lại CHÍNH file .xlsx vừa tạo, quét mọi ô dữ liệu (từ dòng đầu dữ liệu,
// cột B đến cột cuối) và so từng giá trị với kế hoạch. Trả {ok, expected, actual, missing[], extra[]}.
async function khXlsxVerifyBuffer(buf, plan){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  const exp = new Map();
  plan.blocks.forEach(b=>b.chunks.forEach(a=>a.forEach(r=>{ exp.set(r.text, (exp.get(r.text)||0)+1); })));
  const got = new Map(); let actual = 0;
  for(let r=KHUON_XLSX_FIRST_DATA_ROW; r<=ws.rowCount; r++){
    for(let c=2; c<=plan.lastCol; c++){
      const t = khXlsxReadCell(ws.getCell(r, c).value);
      if(!t) continue;
      actual++; got.set(t, (got.get(t)||0)+1);
    }
  }
  const missing = [], extra = [];
  exp.forEach((n,t)=>{ const g=got.get(t)||0; for(let i=g;i<n;i++) missing.push(t); });
  got.forEach((n,t)=>{ const e=exp.get(t)||0; for(let i=e;i<n;i++) extra.push(t); });
  return {ok: actual===plan.total && !missing.length && !extra.length, expected: plan.total, actual, missing, extra};
}

// Dựng workbook từ file mẫu + danh sách `list`, ghi ra buffer và ĐỌC LẠI để đối chiếu.
// Không đụng DOM/thông báo nên kiểm thử được bằng ExcelJS thật.
// meta: {note} — chuỗi bổ sung sau "Cập nhật: dd/mm/yyyy" (ghi rõ chế độ xuất theo bộ lọc).
async function khXlsxGenerate(list, meta){
  meta = meta || {};
  const plan = khXlsxBuildPlan(list);
  const {blocks, neededRows, lastCol, extraBlocks} = plan;
  const totalRows = Math.max(neededRows, KHUON_XLSX_TEMPLATE_ROWS);

  // (1) Đối chiếu TRƯỚC khi ghi: kế hoạch phải chứa đủ mọi bản ghi hợp lệ của danh sách đầu vào.
  const srcRecords = (list||[]).filter(x=>x && typeof x==='object').length;
  const placedInPlan = khXlsxPlanPlaced(plan);
  if(plan.total !== srcRecords || placedInPlan !== srcRecords){
    return {plan, verify:{ok:false, expected:srcRecords, actual:placedInPlan, missing:[], extra:[],
      reason:`Kế hoạch xuất chỉ xếp được ${placedInPlan}/${srcRecords} khuôn (lỗi phân nhóm dữ liệu)`}};
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(b64ToArrayBuffer(KHUON_XLSX_TEMPLATE_B64));
  const ws = wb.worksheets[0];

  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  ws.getCell('A4').value = `Cập nhật: ${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}` + (meta.note ? '  ·  ' + meta.note : '');

  // Nhiều dữ liệu hơn 55 dòng có sẵn trong mẫu → thêm dòng, nhân bản
  // đúng định dạng của dòng dữ liệu cuối cùng trong mẫu cho dòng mới.
  if(neededRows > KHUON_XLSX_TEMPLATE_ROWS){
    const templateLastRow = ws.getRow(KHUON_XLSX_FIRST_DATA_ROW + KHUON_XLSX_TEMPLATE_ROWS - 1);
    for(let r = KHUON_XLSX_TEMPLATE_ROWS; r < neededRows; r++){
      const row = ws.getRow(KHUON_XLSX_FIRST_DATA_ROW + r);
      row.height = templateLastRow.height;
      for(let c=1; c<=KHUON_XLSX_TEMPLATE_LASTCOL; c++){
        row.getCell(c).style = khXlsxCloneStyle(templateLastRow.getCell(c).style);
      }
    }
  }

  // Có nhóm ngoài mẫu → dựng thêm cột bên phải cột L bằng cách nhân bản
  // style của chính khối "Yêu cầu & chuẩn" (cột K = trái, L = phải).
  if(extraBlocks.length){
    const lastDataRow = KHUON_XLSX_FIRST_DATA_ROW + totalRows - 1;
    const colK = KHUON_XLSX_TEMPLATE_LASTCOL - 1, colL = KHUON_XLSX_TEMPLATE_LASTCOL;
    const widthL = (ws.getColumn(colL).width) || 12;
    // Dòng tiêu đề 1-4 đang gộp ô A:L → bỏ gộp, phủ style sang cột mới rồi gộp lại tới cột cuối.
    for(let r=1; r<=4; r++){
      ws.unMergeCells(r, 1, r, KHUON_XLSX_TEMPLATE_LASTCOL);
      for(let c=KHUON_XLSX_TEMPLATE_LASTCOL+1; c<=lastCol; c++){
        ws.getCell(r, c).style = khXlsxCloneStyle(ws.getCell(r, colL).style);
      }
      ws.mergeCells(r, 1, r, lastCol);
    }
    extraBlocks.forEach(b=>{
      b.cols.forEach((c, i)=>{
        const src = i===0 ? colK : colL;
        ws.getColumn(c).width = widthL;
        [5,6].forEach(r=>{ ws.getCell(r, c).style = khXlsxCloneStyle(ws.getCell(r, src).style); });
        for(let r=KHUON_XLSX_FIRST_DATA_ROW; r<=lastDataRow; r++){
          ws.getCell(r, c).style = khXlsxCloneStyle(ws.getCell(r, src).style);
        }
      });
      ws.mergeCells(5, b.cols[0], 5, b.cols[b.cols.length-1]);
    });
  }

  // Xoá sạch toàn bộ vùng dữ liệu cũ (STT + tất cả các cột) trước khi
  // ghi dữ liệu mới, để không sót giá trị mẫu/lần xuất trước — kể cả
  // các dòng dư ra ngoài số dòng cần dùng lần này (chỉ xoá nội dung,
  // giữ nguyên định dạng/viền nên khung bảng không đổi).
  for(let r=0; r<totalRows; r++){
    const rowNum = KHUON_XLSX_FIRST_DATA_ROW + r;
    for(let c=1; c<=lastCol; c++) ws.getCell(rowNum, c).value = null;
  }

  // File mẫu gốc có 1 ô dữ liệu (D55) lỡ mang font Calibri 11 thay vì Arial 9 →
  // ô nào lệch font so với dòng dữ liệu chuẩn thì lấy lại định dạng của ô liền trên.
  for(let r=KHUON_XLSX_FIRST_DATA_ROW+1; r<KHUON_XLSX_FIRST_DATA_ROW+totalRows; r++){
    for(let c=2; c<=lastCol; c++){
      const cell = ws.getCell(r, c), f = cell.font;
      if(f && (f.name!=='Arial' || f.size!==9)) cell.style = khXlsxCloneStyle(ws.getCell(r-1, c).style);
    }
  }

  // Tiêu đề khối cho các nhóm ngoài mẫu
  extraBlocks.forEach(b=>{
    ws.getCell(5, b.cols[0]).value = String(b.label).toUpperCase() + '  ';
    b.cols.forEach(c=>{ ws.getCell(6, c).value = 'CHỦNG LOẠI'; });
  });

  // Ghi STT + dữ liệu từng khối cột
  for(let r=0; r<neededRows; r++){
    const rowNum = KHUON_XLSX_FIRST_DATA_ROW + r;
    ws.getCell(rowNum, 1).value = r + 1;
    blocks.forEach(b=>{
      b.cols.forEach((colIdx, ci)=>{
        const item = b.chunks[ci][r];
        if(item) ws.getCell(rowNum, colIdx).value = item.text;
      });
    });
  }

  // Nhiều dòng → cho phép in nhiều trang (mẫu ép vừa 1 trang) và lặp tiêu đề cột;
  // thêm cột → chuyển ngang để vẫn đọc được.
  if(neededRows > KHUON_XLSX_TEMPLATE_ROWS){
    ws.pageSetup.fitToHeight = 0;
    ws.pageSetup.printTitlesRow = '5:6';
  }
  if(extraBlocks.length) ws.pageSetup.orientation = 'landscape';

  const buf = await wb.xlsx.writeBuffer();
  // (2) Đối chiếu SAU khi ghi: đọc lại chính file vừa tạo.
  const verify = await khXlsxVerifyBuffer(buf, plan);
  return {buf, plan, verify, now};
}

// Mô tả bộ lọc đang bật (hiển thị trong hộp chọn, tiêu đề file và thông báo).
function khXlsxFilterText(info){
  const parts = [];
  if(info.catFilter!=='all') parts.push('Nhóm: ' + (info.catFilter || 'Chưa phân nhóm'));
  if(info.search) parts.push('Từ khóa: "' + info.search + '"');
  return parts.join('; ');
}

// Hộp chọn chế độ xuất khi ĐANG có bộ lọc/tìm kiếm — không tự đoán thay người dùng.
function khExportAskMode(allCount, visCount, info){
  const body = $('khExportModeBody');
  if(!body){ // không có hộp thoại (không nên xảy ra) → chọn an toàn: xuất toàn bộ, nói rõ
    showToast('ℹ️ Đang xuất TOÀN BỘ danh mục (' + allCount + ' kích thước)');
    return exportKhuonCatalogExcel('all');
  }
  body.innerHTML = `
    <div style="font-size:13px;line-height:1.6;margin-bottom:12px">Bạn đang lọc danh sách (<b>${esc(khXlsxFilterText(info))}</b>). Chọn nội dung cần xuất ra Excel:</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-primary" ${visCount?'':'disabled'} onclick="closeModal('khExportModal');exportKhuonCatalogExcel('filtered')">📥 Xuất theo bộ lọc (${visCount} kích thước)</button>
      <button class="btn btn-ghost" onclick="closeModal('khExportModal');exportKhuonCatalogExcel('all')">📥 Xuất toàn bộ danh mục (${allCount} kích thước)</button>
    </div>`;
  openModal('khExportModal');
}

// Xuất file Excel "Tổng hợp Khuôn" — nạp file mẫu gốc, chia danh sách khuôn vào các khối cột
// (sắp xếp kích thước tăng dần bằng đúng logic sortKhuonList của giao diện), rồi tải .xlsx về.
//   mode 'all'      : TOÀN BỘ danh mục (khCatalogRecords) — bỏ qua bộ lọc.
//   mode 'filtered' : ĐÚNG danh sách giao diện đang hiển thị sau bộ lọc nhóm + tìm kiếm.
//   mode bỏ trống   : không có bộ lọc → toàn bộ; đang có bộ lọc → hỏi người dùng chọn.
// Danh sách nguồn là DB.khuonCatalog (cùng nguồn với giao diện) — không sửa/xoá dữ liệu gốc.
// Chỉ báo thành công khi file đọc lại KHỚP 100% danh sách cần xuất; lệch → không tải file, báo nguyên nhân.
async function exportKhuonCatalogExcel(mode){
  const all = khCatalogRecords();
  const info = khCatalogFilterInfo();
  const visible = khCatalogVisible(all, info.catFilter, info.search);
  if(!mode){
    if(info.active && visible.length !== all.length){ khExportAskMode(all.length, visible.length, info); return; }
    mode = 'all';
  }
  const list = mode==='filtered' ? visible : all;
  if(!list.length){ showToast(mode==='filtered' ? '⚠️ Bộ lọc hiện tại không có kích thước nào để xuất' : '⚠️ Danh mục khuôn đang trống — không có gì để xuất', true); return; }

  showToast('⏳ Đang tạo file Excel...', false);
  try{ await ensureExcelJs(); }
  catch(e){ showToast('❌ Không tải được thư viện xuất Excel — kiểm tra kết nối mạng rồi thử lại', true); return; }
  if(!window.ExcelJS){ showToast('⏳ Thư viện Excel chưa tải xong, vui lòng bấm "Xuất Excel" lại sau vài giây', true); return; }

  try{
    const filterNote = mode==='filtered' ? `Xuất theo bộ lọc (${list.length}/${all.length}) — ${khXlsxFilterText(info)}` : '';
    const {buf, plan, verify, now} = await khXlsxGenerate(list, {note:filterNote});

    if(!verify.ok){
      const sample = (a)=> a.slice(0,5).join(', ') + (a.length>5 ? `… (+${a.length-5})` : '');
      const cause = verify.reason
        || ((verify.missing.length ? `thiếu ${verify.missing.length} khuôn trong file: ${sample(verify.missing)}` : '')
          + (verify.missing.length && verify.extra.length ? '; ' : '')
          + (verify.extra.length ? `thừa ${verify.extra.length} ô không thuộc danh sách: ${sample(verify.extra)}` : '')
          + (!verify.missing.length && !verify.extra.length ? `số ô trong file (${verify.actual}) khác số khuôn cần xuất (${verify.expected})` : ''));
      console.error('[Xuất Excel khuôn] lệch số liệu', {mode, expected:verify.expected, actual:verify.actual, missing:verify.missing, extra:verify.extra, reason:verify.reason});
      showToast(`❌ Xuất Excel KHÔNG khớp (file ${verify.actual}/${verify.expected} khuôn) — ${cause}. Chưa tải file, vui lòng báo quản trị`, true);
      return;
    }

    const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const pad = n => String(n).padStart(2,'0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
    a.href = url; a.download = `Tong_hop_Khuon_${stamp}${mode==='filtered'?'_theo_bo_loc':''}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const more = plan.extraBlocks.length ? ` · gồm ${plan.extraBlocks.length} nhóm ngoài mẫu: ${plan.extraBlocks.map(b=>b.label).join(', ')}` : '';
    const nosz = plan.noSize ? ` · ${plan.noSize} khuôn thiếu kích thước (đã ghi chú trong file)` : '';
    const scope = mode==='filtered' ? 'THEO BỘ LỌC' : 'TOÀN BỘ danh mục';
    showToast(`✅ Đã xuất Excel (${scope}) — đối chiếu đạt: ${verify.actual}/${verify.expected} khuôn${more}${nosz}`);
  }catch(err){
    console.error(err);
    showToast('❌ Xuất Excel thất bại: ' + (err && err.message || err), true);
  }
}
