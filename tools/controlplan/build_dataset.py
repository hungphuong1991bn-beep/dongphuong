#!/usr/bin/env python3
"""
Chuyển ControlPlan_AQL_Checksheet.xlsx -> dữ liệu nhập cho phân hệ ControlPlan.
  python3 tools/controlplan/build_dataset.py <file.xlsx> <thư-mục-gốc-dự-án>

Sinh ra:
  src/modules/quality/cp-seed.js                    (danh mục chuẩn: Control Plan, PFMEA, AQL, mã lỗi, 8D, mục lục)
  src/modules/quality/data/cp-import-dataset.json   (dữ liệu lịch sử: 5 sheet phiếu kiểm tra, mỗi dòng Excel = 1 bản ghi)
  docs/controlplan/IMPORT-REPORT.md                 (báo cáo ánh xạ + số dòng + dòng cần kiểm tra)

NGUYÊN TẮC: không suy diễn. Giá trị không chắc chắn được GIỮ NGUYÊN chữ gốc và gắn cờ `review`.
Chạy lại cho ra đúng cùng kết quả (id bản ghi cố định theo sheet + số dòng).
"""
import sys, json, re, hashlib, datetime, collections, os
import openpyxl

SRC, ROOT = sys.argv[1], sys.argv[2]
FILE = 'ControlPlan_AQL_Checksheet.xlsx'   # tên file gốc (file đầu vào có thể được đổi tên khi tải lên)
wb = openpyxl.load_workbook(SRC)
sha = hashlib.sha256(open(SRC,'rb').read()).hexdigest()

def s(v):
    if v is None: return ''
    if isinstance(v, datetime.datetime): return v.strftime('%Y-%m-%d')
    if isinstance(v, float) and v == int(v) and abs(v) < 1e12: return str(int(v))
    return re.sub(r'\s+', ' ', str(v)).strip()

def iso(v): return v.strftime('%Y-%m-%d') if isinstance(v, datetime.datetime) else ''
TODAY_LIMIT = '2026-11-06'   # ngày lập báo cáo; ngày sau mốc này = tương lai

# ---------- chuẩn hoá có kiểm soát ----------
def norm_shift(v):
    t = s(v).lower().replace(' ', '')
    m = re.fullmatch(r'ca(\d)', t)
    return ('Ca ' + m.group(1)) if m else s(v)

def norm_workshop(v):
    t = s(v)
    m = re.fullmatch(r'(?i)x[ưu]ởng\s*(\d+)', t)
    return ('Xưởng ' + m.group(1)) if m else ''      # chỉ nhận dạng đúng "Xưởng N"

def lot_code(v):
    """Cột "Lô" trong workbook thực chất là MÃ NGÀY ddmmyyyy (bị Excel đổi thành số/ngày)."""
    if isinstance(v, datetime.datetime): return v.strftime('%d%m%Y'), v.strftime('%Y-%m-%d')
    if isinstance(v, (int, float)):
        d = str(int(v)).zfill(8)
        try:
            dt = datetime.datetime.strptime(d, '%d%m%Y'); return d, dt.strftime('%Y-%m-%d')
        except ValueError: return str(int(v)), ''
    t = s(v); return t, ''

def num(v):
    """-> (số hoặc None, chữ gốc nếu phải chuyển đổi/không đọc được)"""
    if v is None or v == '': return None, ''
    if isinstance(v, bool): return None, str(v)
    if isinstance(v, (int, float)): return float(v) if isinstance(v, float) else int(v), ''
    t = s(v)
    if re.fullmatch(r'-?\d+,\d+', t): return float(t.replace(',', '.')), t       # 7,10 -> 7.1
    if re.fullmatch(r'-?\d+(\.\d+)?', t): return float(t), t
    return None, t                                                               # '4*87', '.124.98', '302+3' ...

def hhmm(t):
    m = re.fullmatch(r'(\d{1,2})h(\d{0,2})', s(t).lower())
    if not m: return ''
    h, mi = int(m.group(1)), int(m.group(2) or 0)
    return f'{h:02d}:{mi:02d}' if h < 24 and mi < 60 else ''

OK_WORDS = {'đạt', 'ok'}
NG_WORDS = {'ng', 'không đạt'}
def verdict(v):
    t = s(v).lower()
    if t in OK_WORDS: return 'OK'
    if t in NG_WORDS: return 'NG'
    return 'UNK'

def canon_names(values):
    """Gộp cùng một tên chỉ khác hoa/thường/khoảng trắng; chọn dạng xuất hiện nhiều nhất."""
    cnt = collections.defaultdict(collections.Counter)
    for v in values:
        t = s(v)
        if t: cnt[t.lower()][t] += 1
    return {k: c.most_common(1)[0][0] for k, c in cnt.items()}

# ---------- đọc 5 sheet phiếu ----------
CFG = {
  # sheet: (form, prefix, hàng tiêu đề, cột đầu, cột cuối, header kỳ vọng)
  'Check_Dun':      ('dun',      'DUN', 4, 1, 13, ['Ngày','Khách Hàng','Quy Cách','Ca','Mã SP','Lô','Giờ','Mẫu','Dày','Rộng','Ngoại quan','Kết luận','QC']),
  'Check_Rut':      ('rut',      'RUT', 6, 1, 14, ['Ngày','Khách Hàng','Quy cách','Ca','Mã SP','Lô','Giờ','Mẫu','Dày','Rộng','Dài','Ngoại quan','Kết luận','QC']),
  'Check_DanhBong': ('danhbong', 'DB',  4, 1, 14, ['Ngày','Khách hàng','Quy cách','Ca','Mã SP','Lô','Giờ','Mẫu','Dày','Rộng','Dài','Ngoại quan','Kết luận','QC']),
  'Check_Cat':      ('cat',      'CAT', 4, 1, 14, ['Ngày','Khách Hàng','Quy cách','Ca','Mã SP','Lô','Giờ','Mẫu','Dày','Rộng','Dài','Ngoại quan','Kết luận','QC']),
  'ĐỘ thẳng':       ('dothang',  'DT',  3, 2, 12, ['Ngày','Xưởng Sản Xuất','Khách Hàng','Quy cách','Độ thẳng cạnh','Độ thẳng mặt','Độ vểnh','Độ vặn','Tiêu chuẩn','OK/NG','Người kiểm']),
}
COLMAP = {}
records, skipped, per_sheet = [], [], []
all_qc = []
rawrows = {}
for sheet, (form, pre, hrow, c0, c1, exp) in CFG.items():
    ws = wb[sheet]
    hdr = [s(ws.cell(hrow, c).value) for c in range(c0, c1 + 1)]
    assert [h.strip().lower() for h in hdr] == [h.strip().lower() for h in exp], (sheet, hdr)   # xác minh cột, không dựa số thứ tự mù
    rows = []
    for r in range(hrow + 1, ws.max_row + 1):
        vals = [ws.cell(r, c).value for c in range(c0, c1 + 1)]
        if any(v is not None for v in vals): rows.append((r, vals))
    rawrows[sheet] = rows
    last = rows[-1][1]
    qc_col = c1 - c0
    all_qc += [v[qc_col] for _, v in rows]

QC_CANON = canon_names(all_qc)
CUST_ALL = []
for sheet, (form, pre, hrow, c0, c1, exp) in CFG.items():
    ci = 2 if form == 'dothang' else 1
    CUST_ALL += [v[ci] for _, v in rawrows[sheet]]

def qc_name(v): return QC_CANON.get(s(v).lower(), s(v))

for sheet, (form, pre, hrow, c0, c1, exp) in CFG.items():
    n_imp = n_skip = n_rev = 0
    for r, v in rawrows[sheet]:
        code = f'{pre}-XL-{r:04d}'
        rid = f'cpx-chk-{form}-r{r}'
        review, rawdiff = [], {}
        src = {'sheet': sheet, 'row': r}
        if form == 'dothang':
            d, xs, cust, spec, edge, face, warp, twist, std, ok, qc = v
            has_data = any(x is not None for x in (cust, spec, edge, face, warp, twist, ok)) or isinstance(d, datetime.datetime)
            has_core = any(x is not None for x in (cust, spec, edge, face, warp, twist, ok))
            if not has_core:
                skipped.append({'sheet': sheet, 'row': r, 'reason': 'Dòng mẫu trống: chỉ có giá trị mặc định (Tiêu chuẩn/Người kiểm), không có ngày hay kết quả đo', 'raw': [s(x) for x in v]})
                n_skip += 1; continue
            date = iso(d)
            wk = ''; lot = ''; lotdate = ''
            if isinstance(xs, str):
                wk = norm_workshop(xs)
                if not wk: rawdiff['xuongRaw'] = s(xs); review.append(f'Cột "Xưởng Sản Xuất" có giá trị lạ: {s(xs)}')
            elif xs is not None:
                lot, lotdate = lot_code(xs)
            line = {'n': 1, 'edge': s(edge), 'face': s(face), 'warp': s(warp), 'twist': s(twist), 'result': verdict(ok)}
            res = line['result']
            if res == 'UNK':
                review.append('Chưa có kết luận OK/NG' + (f' (gốc: {s(ok)})' if s(ok) else ''))
            rec = {'id': rid, 'type': 'chk', 'form': form, 'code': code, 'status': 'done', 'source': 'excel', 'date': date,
                   'customer': s(cust), 'workshop': wk, 'lot': lot,
                   'spec': s(spec), 'standard': s(std), 'inspector': qc_name(qc), 'lines': [line], 'result': res}
        else:
            if form == 'dun':
                d, cust, spec, ca, msp, lo, gio, mau, day, rong, nq, kl, qc = v; dai = None
            else:
                d, cust, spec, ca, msp, lo, gio, mau, day, rong, dai, nq, kl, qc = v
            core = [cust, spec, ca, msp, lo, gio, mau, day, rong, dai]   # Ngoại quan/Kết luận/QC thường được điền sẵn bằng dropdown nên không tính là dữ liệu
            if all(x is None for x in core):
                skipped.append({'sheet': sheet, 'row': r, 'reason': 'Dòng mẫu trống: chỉ có ngày/kết luận/tên QC điền sẵn, không có khách hàng, quy cách hay số đo', 'raw': [s(x) for x in v]})
                n_skip += 1; continue
            date = iso(d)
            wk = norm_workshop(msp)
            if s(msp) and not wk: rawdiff['maSpRaw'] = s(msp); review.append(f'Cột "Mã SP" có giá trị không phải xưởng: {s(msp)}')
            lot, lotdate = lot_code(lo)
            thick, rt = num(day); width, rw = num(rong); length, rl = num(dai)
            raw = {}
            for k, val, rr in (('thick', thick, rt), ('width', width, rw), ('length', length, rl)):
                if rr and (val is None or str(val) != rr):
                    raw[k] = rr
                    if val is None: review.append(f'Số đo không đọc được ({ {"thick":"Dày","width":"Rộng","length":"Dài"}[k] }): "{rr}"')
            ap = s(nq); rs = s(kl); vd = verdict(kl)
            ap_code = 'OK' if ap.lower() in OK_WORDS else ''
            ap_note = '' if (ap_code or not ap) else ap
            if ap_note: review.append(f'Ngoại quan ghi tự do (chưa gán mã NG-xx): "{ap_note}"')
            if vd == 'UNK': review.append(f'Kết luận không phải Đạt/NG: "{rs}"' if rs else 'Thiếu kết luận')
            line = {'n': int(mau) if isinstance(mau, (int, float)) else None, 'time': s(gio), 't': hhmm(gio), 'thick': thick, 'width': width, 'length': length,
                    'appearance': ap_code, 'appearanceNote': ap_note, 'resultRaw': rs, 'result': vd}
            if raw: line['raw'] = raw
            if line['time'] and not line['t']: review.append(f'Giờ không đọc được: "{line["time"]}"')
            res = vd
            rec = {'id': rid, 'type': 'chk', 'form': form, 'code': code, 'status': 'done', 'source': 'excel', 'date': date,
                   'customer': s(cust), 'shift': norm_shift(ca), 'workshop': wk, 'lot': lot,
                   'spec': s(spec), 'inspector': qc_name(qc), 'lines': [line], 'result': res}
        # kiểm tra ngày
        if not date: review.append('Thiếu ngày')
        elif date > TODAY_LIMIT: review.append(f'Ngày {date} ở tương lai so với ngày lập dữ liệu ({TODAY_LIMIT})')
        if date and lotdate and lotdate != date:
            review.append(f'Ngày {date} không khớp mã ngày ở cột Lô ({lot} = {lotdate})')
        if rawdiff: rec['rawDiff'] = rawdiff
        rec['src'] = src
        if review: rec['review'] = review; n_rev += 1
        records.append(rec); n_imp += 1
    per_sheet.append({'sheet': sheet, 'form': form, 'excelRows': len(rawrows[sheet]), 'imported': n_imp, 'skipped': n_skip, 'needReview': n_rev,
                      'headerRow': hrow, 'cols': exp})
    COLMAP[sheet] = exp

# ---------- danh mục chuẩn (seed) ----------
ws = wb['Control Plan']
FORM_OF = {'FR-EX-01': 'dun', 'FR-RU-01': 'rut', 'FR-PO-01': 'danhbong', 'FR-CT-01': 'cat', 'FR-FQC-01': 'fqc'}
SOP = {'Đùn': 'SOP-01', 'Rút': 'SOP-02', 'Đánh bóng': 'SOP-03', 'Cắt': 'SOP-04', 'FQC': 'SOP-05'}   # theo ghi chú ô trong workbook
cp = []
for r in range(2, ws.max_row + 1):
    row = [ws.cell(r, c).value for c in range(1, 13)]
    if not any(row): continue
    cp.append({'id': f'cpx-cp-{int(row[0])}', 'type': 'cp', 'no': int(row[0]), 'stage': s(row[1]), 'characteristic': s(row[2]), 'standard': s(row[3]), 'equipment': s(row[4]),
               'method': s(row[5]), 'sample': s(row[6]), 'frequency': s(row[7]), 'class': s(row[8]), 'control': s(row[9]), 'reaction': s(row[10]), 'formCode': s(row[11]),
               'formKey': FORM_OF.get(s(row[11]), ''), 'sop': SOP.get(s(row[1]), ''), 'source': 'excel', 'src': {'file': FILE, 'sheet': 'Control Plan', 'row': r}})
ws = wb['PFMEA']
pf = []
for r in range(2, ws.max_row + 1):
    row = [ws.cell(r, c).value for c in range(1, 17)]
    if not any(row): continue
    def iv(x):
        try: return int(str(x).strip())
        except Exception: return None
    pf.append({'id': f'cpx-pfmea-{int(row[0])}', 'type': 'pfmea', 'no': int(row[0]), 'stage': s(row[1]), 'requirement': s(row[2]), 'failureMode': s(row[3]), 'effect': s(row[4]), 'S': iv(row[5]),
               'cause': s(row[6]), 'O': iv(row[7]), 'prevention': s(row[8]), 'detection': s(row[9]), 'D': iv(row[10]), 'rpnExcel': s(row[11]), 'action': s(row[12]),
               'owner': s(row[13]), 'due': iso(row[14]) if isinstance(row[14], datetime.datetime) else s(row[14]), 'status': s(row[15]) or 'Open',
               'source': 'excel', 'src': {'file': FILE, 'sheet': 'PFMEA', 'row': r}})
ws = wb['Danh_muc_ma_loi']
df = []
for r in range(5, ws.max_row + 1):
    row = [ws.cell(r, c).value for c in range(1, 6)]
    if not row[0]: continue
    df.append({'id': f'cpx-defect-{s(row[0])}', 'type': 'defect', 'code': s(row[0]), 'name': s(row[1]), 'accept': s(row[2]), 'reaction': s(row[3]), 'ref': s(row[4]),
               'source': 'excel', 'src': {'file': FILE, 'sheet': 'Danh_muc_ma_loi', 'row': r}})
ws = wb['8D']
d8 = []
for r in range(2, ws.max_row + 1):
    row = [ws.cell(r, c).value for c in range(1, 7)]
    if not row[0]: continue
    d8.append({'step': s(row[0]), 'title': s(row[1]), 'owner': s(row[2]), 'due': s(row[3]), 'evidence': s(row[4]), 'status': s(row[5]) or 'Open'})
ws = wb['00_MUC_LUC']
toc = {'title': s(ws['A1'].value), 'intro': s(ws['A2'].value), 'flow': s(ws['A19'].value), 'items': []}
for r in range(5, 17):
    row = [ws.cell(r, c).value for c in range(1, 5)]
    if row[0]: toc['items'].append({'no': int(row[0]), 'sheet': s(row[1]), 'content': s(row[2]), 'stages': s(row[3])})

# ---------- AQL ----------
ws = wb['AQL']
codes = []
for r in range(5, 20):
    codes.append({'range': s(ws.cell(r, 1).value), 'code': s(ws.cell(r, 2).value), 'n': int(ws.cell(r, 3).value)})
aql_hdr1 = [s(ws.cell(4, c).value) for c in range(4, 11)]          # AQL 0.01 .. 0.15
aql_hdr2 = [s(ws.cell(20, c).value) for c in range(1, 10)]         # AQL 0.25 .. 10   (bảng thứ 2 KHÔNG có cột Code/Số mẫu)
levels = [h.replace('AQL', '').strip() for h in aql_hdr1 + aql_hdr2]
table = {}
for i, c in enumerate(codes):
    row1 = [s(ws.cell(5 + i, k).value) for k in range(4, 11)]
    row2 = [s(ws.cell(21 + i, k).value) for k in range(1, 10)]
    table[c['code']] = dict(zip(levels, row1 + row2))
for code, row in table.items():
    for lv, v in row.items(): assert re.fullmatch(r'\d+/\d+', v), (code, lv, v)
aql = {'id': 'cpx-aql-table', 'type': 'aql', 'title': s(ws['A1'].value), 'note1': s(ws['A2'].value), 'note2': s(ws['A3'].value), 'inspectionLevel': 'II',
       'codes': codes, 'levels': levels, 'table': table, 'source': 'excel',
       'src': {'file': FILE, 'sheet': 'AQL', 'rows': 'A4:J19 (AQL 0.01–0.15) + A20:I35 (AQL 0.25–10)'},
       'caveat': 'Bảng thứ hai (AQL 0.25–10, dòng 21–35) không có cột Code/Số mẫu; được ghép với bảng thứ nhất THEO THỨ TỰ DÒNG (dòng 21 = Code A … dòng 35 = Code Q).'}

seed = {'controlPlan': cp, 'pfmea': pf, 'defects': df, 'aql': aql, 'eightD': d8, 'toc': toc, 'sourceFile': FILE, 'sourceSha256': sha}
with open(os.path.join(ROOT, 'src/modules/quality/cp-seed.js'), 'w', encoding='utf-8') as f:
    f.write('// src/modules/quality/cp-seed.js — SINH TỰ ĐỘNG bởi tools/controlplan/build_dataset.py từ ' + FILE + '\n')
    f.write('// Danh mục chuẩn của ControlPlan (Control Plan, PFMEA, AQL, mã lỗi ngoại quan, bước 8D, mục lục). KHÔNG sửa tay.\n')
    f.write('const CP_SEED = ' + json.dumps(seed, ensure_ascii=False, indent=1) + ';\n')

dataset = {'meta': {'source': FILE, 'sha256': sha, 'builder': 'tools/controlplan/build_dataset.py v1', 'sheets': per_sheet, 'columnMap': COLMAP,
                    'empty': {'FQC_AQL': 'chỉ có tiêu đề, không có dòng dữ liệu', 'NCR': 'chỉ có tiêu đề, không có dòng dữ liệu', 'HOLD_RELEASE': 'chỉ có tiêu đề, không có dòng dữ liệu'}},
           'records': records, 'skipped': skipped}
with open(os.path.join(ROOT, 'src/modules/quality/data/cp-import-dataset.json'), 'w', encoding='utf-8') as f:
    json.dump(dataset, f, ensure_ascii=False, separators=(',', ':'))

# ---------- báo cáo ----------
os.makedirs(os.path.join(ROOT, 'docs/controlplan'), exist_ok=True)
rev_cnt = collections.Counter()
for rec in records:
    for t in rec.get('review', []):
        key = re.sub(r'"[^"]*"', '"…"', t); key = re.sub(r'\d{4}-\d{2}-\d{2}', 'YYYY-MM-DD', key); key = re.sub(r'\(\d+ = [^)]*\)', '(…)', key)
        rev_cnt[key] += 1
L = ['# Báo cáo nhập dữ liệu Excel → ControlPlan', '', f'- File nguồn: `{FILE}` (SHA-256 `{sha}`)', '- Công cụ: `tools/controlplan/build_dataset.py` (chạy lại cho kết quả giống hệt)', '',
     '## 1. Số dòng theo sheet', '', '| Sheet Excel | Dòng có dữ liệu | Đã chuẩn bị nhập | Bỏ qua (dòng mẫu trống) | Cần kiểm tra |', '|---|---:|---:|---:|---:|']
for p in per_sheet: L.append(f"| {p['sheet']} | {p['excelRows']} | {p['imported']} | {p['skipped']} | {p['needReview']} |")
L += [f"| Control Plan | {len(cp)} | {len(cp)} | 0 | 0 |", f"| PFMEA | {len(pf)} | {len(pf)} | 0 | 0 |", f"| AQL | 15 mã × 16 mức AQL | bảng đầy đủ | 0 | 1 (xem §4) |",
      f"| Danh_muc_ma_loi | {len(df)} | {len(df)} | 0 | 0 |", f"| 8D | {len(d8)} | {len(d8)} (mẫu 9 bước) | 0 | 0 |", f"| 00_MUC_LUC | {len(toc['items'])} | điều hướng | 0 | 0 |",
      '| FQC_AQL, NCR, HOLD_RELEASE | 0 | 0 | 0 | 0 |  ← chỉ có dòng tiêu đề trong workbook, **không có dữ liệu lịch sử** |', '']
tot_x = sum(p['excelRows'] for p in per_sheet); tot_i = sum(p['imported'] for p in per_sheet); tot_s = sum(p['skipped'] for p in per_sheet)
L += [f'**Tổng 5 sheet phiếu: {tot_x} dòng = {tot_i} nhập + {tot_s} bỏ qua.** (Kiểm tra đẳng thức: {tot_x == tot_i + tot_s})', '', '## 2. Ánh xạ cột (đã xác minh tiêu đề từng sheet, không dựa số thứ tự mù)', '']
MAPTXT = {'Ngày': 'date', 'Khách Hàng': 'customer', 'Khách hàng': 'customer', 'Quy Cách': 'spec', 'Quy cách': 'spec', 'Ca': 'shift', 'Mã SP': '**workshop** (xưởng) — cột này chứa "Xưởng 1/2/3", KHÔNG phải mã sản phẩm; không có productCode/orderId/mã lô SX → liên kết = CHƯA XÁC ĐỊNH',
          'Lô': 'lot (mã ngày ddmmyyyy; Excel đã đổi thành số/ngày nên chuẩn hoá lại 8 chữ số; KHÔNG phải mã lô sản xuất thật)', 'Giờ': 'lines[].time (+ t = HH:MM)', 'Mẫu': 'lines[].n', 'Dày': 'lines[].thick', 'Rộng': 'lines[].width', 'Dài': 'lines[].length',
          'Ngoại quan': 'lines[].appearance (OK) hoặc appearanceNote (mô tả tự do)', 'Kết luận': 'lines[].result (OK/NG/UNK) + resultRaw', 'QC': 'inspector', 'Xưởng Sản Xuất': 'workshop nếu là "Xưởng N"; nếu là số/ngày thì là mã ngày → lot',
          'Độ thẳng cạnh': 'lines[].edge', 'Độ thẳng mặt': 'lines[].face', 'Độ vểnh': 'lines[].warp', 'Độ vặn': 'lines[].twist', 'Tiêu chuẩn': 'standard', 'OK/NG': 'lines[].result', 'Người kiểm': 'inspector'}
for sh, cols in COLMAP.items():
    L += [f'**{sh}**', '', '| Cột Excel | Trường ứng dụng |', '|---|---|'] + [f'| {c} | {MAPTXT.get(c, c)} |' for c in cols] + ['']
L += ['## 3. Chuẩn hoá đã áp dụng (không đổi ý nghĩa; chữ gốc vẫn lưu ở `rawDiff` / `lines[].raw` / `resultRaw`)', '',
      '- Ca: `Ca1`, `ca 1`, `Ca 1 ` → `Ca 1`. Xưởng: `xưởng  1` → `Xưởng 1`. Tên QC: gộp chỉ khác hoa/thường (`Hà văn Tú` → `Hà Văn Tú`).',
      '- Số đo ghi dấu phẩy (`7,10`) → 7.1 (chữ gốc giữ trong `lines[].raw`). Số đo không đọc được (`4*87`, `.124.98`, `302+3`) → để trống, giữ chữ gốc, gắn cờ cần kiểm tra.',
      '- Tên khách hàng: chỉ cắt khoảng trắng thừa; **không** sửa chính tả. Phần mềm gộp khi thống kê bằng khoá không phân biệt hoa/thường/khoảng trắng.',
      '- Kết luận: `Đạt/ĐẠT/OK` → OK; `NG/Không Đạt` → NG; còn lại → UNK (**không suy diễn**).', '',
      '## 4. Điểm cần người có thẩm quyền xác nhận', '']
for k, n in rev_cnt.most_common(): L.append(f'- {n} dòng: {k}')
L += ['', '- **AQL**: workbook chỉ có Level II (suy ra từ khoảng quy mô lô 2–8=A … 500.001+=Q); bảng AQL 0.25–10 ghép với bảng AQL 0.01–0.15 theo thứ tự dòng; workbook tự ghi "bảng rút gọn". Giá trị Ac/Re được giữ nguyên, **chưa đối chiếu với ISO 2859-1 gốc**.',
      '- **Control Plan** dòng "Nguyên liệu" (FR-IN-01) không có biểu mẫu tương ứng trong 13 mục nghiệp vụ → hiển thị nhưng không có nút mở.',
      '- **PFMEA**: cột RPN trong workbook để trống → phần mềm tự tính S×O×D; "Hạn hoàn thành" để trống.', '',
      '## 5. Dòng bỏ qua (không nhập — kèm nội dung gốc, không bị xoá khỏi workbook)', '', '| Sheet | Dòng | Lý do | Nội dung gốc |', '|---|---:|---|---|']
# gộp các dòng liên tiếp cùng lý do/nội dung thành một khoảng cho gọn
grp = []
for k in skipped:
    key = (k['sheet'], k['reason'], ' ‖ '.join(x for x in k['raw'] if x))
    if grp and grp[-1][0] == key and grp[-1][2] == k['row'] - 1: grp[-1][2] = k['row']
    else: grp.append([key, k['row'], k['row']])
for key, r0, r1 in grp: L.append(f"| {key[0]} | {r0 if r0 == r1 else f'{r0}–{r1}'} | {key[1]} | {key[2]} |")
L += ['', '## 6. Dòng cần kiểm tra (đã nhập, gắn cờ `review`)', '']
for rec in records:
    if rec.get('review'): L.append(f"- `{rec['src']['sheet']}` dòng {rec['src']['row']} ({rec['date'] or 'không ngày'}, {rec['customer'] or '—'}, {rec['spec'] or '—'}): " + '; '.join(rec['review']))
open(os.path.join(ROOT, 'docs/controlplan/IMPORT-REPORT.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print(json.dumps({'per_sheet': per_sheet, 'skipped': len(skipped), 'review_kinds': rev_cnt}, ensure_ascii=False, indent=1, default=dict))
