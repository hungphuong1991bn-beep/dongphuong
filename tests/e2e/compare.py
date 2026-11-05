#!/usr/bin/env python3
"""So sánh 2 thư mục do capture.js xuất ra (TRƯỚC vs SAU refactor).
   python3 compare.py <thư-mục-gốc> <thư-mục-sau> [--px-tol 0.05]
 - DOM / nội dung tab / computed-style / CSSOM: phải GIỐNG HỆT từng byte.
 - Ảnh chụp: so từng điểm ảnh; cho phép sai lệch rất nhỏ (% điểm ảnh) vì đồng hồ/thời lượng online chạy theo giờ thật.
 - Lỗi console + request Firebase ghi: phải trùng.
Thoát mã 0 nếu đạt, 1 nếu có khác biệt."""
import sys, os, json, glob
import numpy as np
from PIL import Image, ImageChops
a, b = sys.argv[1], sys.argv[2]
tol = 0.05
if '--px-tol' in sys.argv: tol = float(sys.argv[sys.argv.index('--px-tol')+1])
fails = []; ok = 0
def rd(p, mode='r'): 
    with open(p, mode) as f: return f.read()
names = sorted(os.listdir(a))
exact = [n for n in names if n.endswith(('.html', '.json')) and n != 'report.json']
for n in exact:
    pa, pb = os.path.join(a, n), os.path.join(b, n)
    if not os.path.exists(pb): fails.append(f'THIẾU {n}'); continue
    import re
    ws = (lambda t: re.sub(r'>\s+<', '><', t)) if n.startswith(('dom-','overlay-')) else (lambda t: t)  # DOM toàn trang: bỏ qua khoảng trắng giữa thẻ (index.html mới gọn hơn)
    if ws(rd(pa)) == ws(rd(pb)): ok += 1
    else: fails.append(f'KHÁC {n}')
shots = [n for n in names if n.endswith('.png')]
worst = (0, '')
for n in shots:
    pb = os.path.join(b, n)
    if not os.path.exists(pb): fails.append(f'THIẾU {n}'); continue
    A = Image.open(os.path.join(a, n)).convert('RGB'); B = Image.open(pb).convert('RGB')
    if A.size != B.size: fails.append(f'KÍCH THƯỚC ẢNH {n} {A.size} vs {B.size}'); continue
    d = np.array(ImageChops.difference(A, B)).max(axis=2)
    frac = 100.0 * np.count_nonzero(d) / d.size
    if frac > worst[0]: worst = (frac, n)
    if frac > tol: fails.append(f'ẢNH KHÁC {n}: {frac:.3f}% điểm ảnh')
    else: ok += 1
ra, rb = json.load(open(os.path.join(a,'report.json'))), json.load(open(os.path.join(b,'report.json')))
norm = lambda l: sorted(set(x for x in l))
if norm(ra['errors']) != norm(rb['errors']): fails.append(f"LỖI CONSOLE khác: {ra['errors'][:3]} vs {rb['errors'][:3]}")
else: ok += 1
if norm(ra['resources']) != norm(rb['resources']): fails.append(f"REQUEST THẤT BẠI khác: {set(ra['resources'])^set(rb['resources'])}")
else: ok += 1
strip = lambda w: sorted(set(x if not x.startswith('PUT /presence/') else 'PUT /presence/*' for x in w))
for wa, wb in zip(ra['fbWrites'], rb['fbWrites']):
    if strip(wa['writes']) != strip(wb['writes']): fails.append(f"GHI FIREBASE khác ({wa['vp']}): {set(strip(wa['writes']))^set(strip(wb['writes']))}")
    else: ok += 1
print(f'ĐẠT {ok} mục · KHÁC {len(fails)} mục · ảnh chụp lệch nhiều nhất: {worst[0]:.4f}% ({worst[1]}) · ngưỡng {tol}%')
for f in fails[:60]: print('  ✗', f)
sys.exit(1 if fails else 0)
