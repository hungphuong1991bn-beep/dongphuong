#!/usr/bin/env node
// KIỂM CHỨNG TĨNH quá trình tách: chứng minh không mất/đổi mã, thứ tự nạp an toàn.
//   node tools/refactor/verify.js <index.html gốc> <thư-mục-đã-build>
// Thoát mã 0 nếu mọi kiểm tra đạt.
const fs = require('fs'), path = require('path'), vm = require('vm');
const acorn = require(process.env.ACORN_PATH || 'acorn');
const M = require('./manifest');
const orig = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').split('\n');
const root = path.resolve(process.argv[3]);
const lines = (a, b) => orig.slice(a - 1, b);
const HDR_END = '// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────';
let fails = 0; const ok = m => console.log('  ✓ ' + m); const bad = m => { fails++; console.log('  ✗ ' + m); };
const rd = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');

// ── 1. JS: tập hợp các khối mã khớp tuyệt đối với bản gốc ──
console.log('[1] JS — mọi khối mã top-level được bảo toàn nguyên văn');
const JS_START = 8153, JS_END = 25657;
const jsSrc = lines(JS_START, JS_END).join('\n');
function chunkify(src){
  const ast = acorn.parse(src, {ecmaVersion:'latest'}); const out = []; let prev = 0;
  for(const n of ast.body){ out.push({text: src.slice(prev, n.end).trim(), node: n, start: n.start, end: n.end, prevEnd: prev}); prev = n.end; }
  return {chunks: out, trailing: src.slice(prev).trim(), ast};
}
const o = chunkify(jsSrc);
const newChunks = []; let newTrailing = []; const fileNodes = {}; // file → [{node,src}]
const jsFiles = [];
(function walk(d, rel){
  for(const e of fs.readdirSync(d, {withFileTypes:true})){
    const p = path.join(d, e.name), r = rel ? rel + '/' + e.name : e.name;
    if(e.isDirectory()) walk(p, r); else if(r.endsWith('.js')) jsFiles.push(r);
  }
})(path.join(root, 'src'), '');
const slotFiles = new Set(M.SLOTS.map(s => s[1]));
for(const f of jsFiles){
  if(f.startsWith('vendor/') || f.startsWith('assets/')) continue;
  const t = rd(f); const i = t.indexOf(HDR_END); if(i < 0){ bad('thiếu header ' + f); continue; }
  const body = t.slice(i + HDR_END.length);
  const c = chunkify(body);
  const real = c.chunks.filter(k => !(k.node.type === 'ExpressionStatement' && /^document\.write\(/.test(body.slice(k.node.start, k.node.start + 15)) && slotFiles.has(f)));
  real.forEach(k => newChunks.push(k.text)); if(c.trailing) newTrailing.push(c.trailing);
  fileNodes[f] = {src: body, chunks: c.chunks, real};
}
const key = a => a.slice().sort();
// Ngoại lệ có chủ đích (sửa lỗi) — xem tools/refactor/patches.json
const PATCH = fs.existsSync(path.join(__dirname, 'patches.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'patches.json'), 'utf8')) : {patched: [], added: []};
const declNames = n => n.type === 'FunctionDeclaration' ? [n.id.name] : n.type === 'VariableDeclaration' ? n.declarations.map(d => d.id.name) : [];
const isPatched = (n, set) => declNames(n).some(x => set.includes(x));
const patchedNew = []; const addedNew = [];
for(const f of jsFiles){ const fn = fileNodes[f]; if(!fn) continue; for(const k of fn.real){ if(isPatched(k.node, PATCH.patched)) patchedNew.push(declNames(k.node)[0]); else if(isPatched(k.node, PATCH.added)) addedNew.push(declNames(k.node)[0]); } }
const patchedOrig = o.chunks.filter(c => isPatched(c.node, PATCH.patched)).map(c => declNames(c.node)[0]);
if(PATCH.patched.length || PATCH.added.length){
  const okP = JSON.stringify(patchedNew.sort()) === JSON.stringify(patchedOrig.sort()) && patchedNew.length === PATCH.patched.length && addedNew.length === PATCH.added.length;
  if(okP) ok(`ngoại lệ sửa lỗi có chủ đích: sửa ${PATCH.patched.join(', ')} · thêm ${PATCH.added.join(', ')} (tools/refactor/patches.json)`); else bad('ngoại lệ trong patches.json không khớp mã (thiếu/thừa khối)');
}
const keepOrig = o.chunks.filter(c => !isPatched(c.node, PATCH.patched)).map(c => c.text);
const keepNew = []; for(const f of jsFiles){ const fn = fileNodes[f]; if(!fn) continue; for(const k of fn.real){ if(!isPatched(k.node, PATCH.patched) && !isPatched(k.node, PATCH.added)) keepNew.push(k.text); } }
const A = key(keepOrig), B = key(keepNew);
if(A.length !== B.length) bad(`số khối khác nhau: gốc ${A.length} · mới ${B.length}`);
else if(A.some((x, i) => x !== B[i])) bad('có khối mã bị đổi nội dung');
else ok(`${A.length} khối mã (hàm/biến/lệnh) trùng khớp từng ký tự giữa bản gốc và bản mới`);
if(newTrailing.join('\n') === o.trailing) ok('phần đuôi script khớp'); else bad('phần đuôi script khác (' + JSON.stringify(o.trailing.slice(0,60)) + ' vs ' + JSON.stringify(newTrailing.join('|').slice(0,60)) + ')');

// ── 2. CSS ──
console.log('[2] CSS — nối các file theo thứ tự = CSS gốc');
const css1 = lines(2371, 6528).join('\n');
const cat = M.CSS_CUTS.map(([f]) => { const t = rd(f); return t.slice(t.indexOf('\n') + 1).replace(/\n$/, ''); }).join('\n');
if(cat === css1) ok(`${M.CSS_CUTS.length} file CSS nối lại = CSS gốc (${css1.length} ký tự)`); else bad('CSS nối lại khác bản gốc');
const c2 = rd(M.CSS2_FILE); if(c2.slice(c2.indexOf('\n') + 1).replace(/\n$/, '') === lines(6531, 6823).join('\n')) ok('CSS #dh4-style khớp'); else bad('CSS dh4 khác');

// ── 3. HTML slots ──
console.log('[3] HTML — markup tạo ra bởi document.write = markup gốc');
for(const [id, file, a, b] of M.SLOTS){
  let w = ''; const sandbox = {document: {write: s => { w += s; }}};
  const fn0 = fileNodes[file]; const wn = fn0.chunks.find(k => k.node.type === 'ExpressionStatement' && /^document\.write\(/.test(fn0.src.slice(k.node.start, k.node.start + 15)));
  vm.runInNewContext(fn0.src.slice(wn.node.start, wn.node.end), sandbox, {filename: file});
  if(w === lines(a, b).join('\n')) {} else bad('slot ' + id + ' (' + file + ') khác markup gốc');
}
ok(`${M.SLOTS.length} khối markup được kiểm tra`);
const logo = rd(M.LOGO_SCRIPT.file); if(logo.includes(lines(M.LOGO_SCRIPT.from, M.LOGO_SCRIPT.to).join('\n'))) ok('script logo khớp'); else bad('script logo khác');
const qr = rd('vendor/qrcode.js'); if(qr.includes(lines(19, 2366).join('\n'))) ok('thư viện QR nhúng nguyên văn'); else bad('qrcode.js khác');

// ── 4. index.html tham chiếu ──
console.log('[4] index.html — tham chiếu file');
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const refs = [...idx.matchAll(/<script src="(src\/[^"]+)"/g)].map(m => m[1]).concat([...idx.matchAll(/<link rel="stylesheet"[^>]*href="(src\/[^"]+)"/g)].map(m => m[1]));
const missing = refs.filter(r => !fs.existsSync(path.join(root, r)));
if(missing.length) bad('thiếu file: ' + missing.join(', ')); else ok(refs.length + ' tham chiếu đều tồn tại');
const dup = refs.filter((r, i) => refs.indexOf(r) !== i); if(dup.length) bad('nạp trùng: ' + dup.join(', ')); else ok('không file nào nạp 2 lần');
const allSrc = [...jsFiles.map(f => 'src/' + f)];
const unref = allSrc.filter(f => !refs.includes(f)); if(unref.length) bad('file không được nạp: ' + unref.join(', ')); else ok('mọi file JS đều được nạp');

// ── 5. Thứ tự nạp: tham chiếu "tức thời" phải có sẵn ──
console.log('[5] Thứ tự nạp — mã chạy ngay khi nạp chỉ dùng thứ đã được định nghĩa');
const order = refs.filter(r => r.endsWith('.js') && !r.includes('/vendor/') && !r.includes('/assets/')).map(r => r.slice(4));
const fileIdx = new Map(order.map((f, i) => [f, i]));
const glob = new Map(); let seq = 0; const eager = [];
for(const f of order){
  const fn = fileNodes[f]; if(!fn) continue;
  for(const k of fn.real){
    const n = k.node; seq++;
    if(n.type === 'FunctionDeclaration') glob.set(n.id.name, {kind: 'func', file: f, seq, node: n, src: fn.src});
    else if(n.type === 'VariableDeclaration'){ for(const d of n.declarations){ const names = []; (function pn(p){ if(!p) return; if(p.type === 'Identifier') names.push(p.name); else if(p.type === 'ObjectPattern') p.properties.forEach(x => pn(x.value || x.argument)); else if(p.type === 'ArrayPattern') p.elements.forEach(pn); })(d.id); names.forEach(nm => glob.set(nm, {kind: n.kind, file: f, seq, node: d, src: fn.src})); } eager.push({f, seq, node: n, src: fn.src}); }
    else eager.push({f, seq, node: n, src: fn.src});
  }
}
// thứ tự gốc (để biết "đã khai báo trước" trong bản gốc)
const origSeq = new Map(); { let s = 0; for(const c of o.chunks){ s++; const n = c.node; if(n.type === 'FunctionDeclaration') origSeq.set(n.id.name, s); else if(n.type === 'VariableDeclaration') n.declarations.forEach(d => { if(d.id.name) origSeq.set(d.id.name, s); }); } }
const origEagerSeq = new Map(); { let s = 0; for(const c of o.chunks){ s++; origEagerSeq.set(jsSrc.slice(c.node.start, c.node.end), s); } }
const SYNC_CB = new Set(['map','filter','forEach','reduce','reduceRight','some','every','find','findIndex','findLast','flatMap','sort','from','replace','fill']); // callback chạy ĐỒNG BỘ
const runsNow = (n, parent) => { if(!parent || parent.type !== 'CallExpression') return false; if(parent.callee === n) return true; return parent.callee.type === 'MemberExpression' && !parent.callee.computed && SYNC_CB.has(parent.callee.property.name) && parent.arguments.includes(n); };
function idents(node, src, follow){ // định danh tham chiếu thực thi tức thời (bỏ qua thân hàm trừ IIFE)
  const res = new Set();
  (function visit(n, parent){
    if(!n || typeof n.type !== 'string') return;
    if(n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression' || n.type === 'FunctionDeclaration'){
      if(!runsNow(n, parent)) return;
    }
    if(n.type === 'Identifier'){ res.add(n.name); return; }
    if(n.type === 'MemberExpression'){ visit(n.object, n); if(n.computed) visit(n.property, n); return; }
    if(n.type === 'Property'){ if(n.computed) visit(n.key, n); visit(n.value, n); return; }
    for(const k of Object.keys(n)){ if(k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; if(Array.isArray(v)) v.forEach(x => visit(x, n)); else if(v && typeof v.type === 'string') visit(v, n); }
  })(node, null);
  return res;
}
function callees(node, isBody){ // hàm được GỌI tức thời (bỏ qua callback chạy muộn, trừ IIFE)
  const res = new Set();
  (function visit(n, parent){ if(!n || typeof n.type !== 'string') return;
    if(n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression' || n.type === 'FunctionDeclaration'){
      if(!runsNow(n, parent)) return; }
    if(n.type === 'CallExpression' && n.callee.type === 'Identifier') res.add(n.callee.name);
    for(const k of Object.keys(n)){ if(k === 'type') continue; const v = n[k]; if(Array.isArray(v)) v.forEach(x => visit(x, n)); else if(v && typeof v.type === 'string') visit(v, n); } })(node, null);
  return res;
}
let eagerChecks = 0; const problems = [];
for(const e of eager){
  const text = e.src.slice(e.node.start, e.node.end);
  const refsE = idents(e.node, e.src);
  // mở rộng: các hàm được gọi tức thời → duyệt thân để lấy thêm biến let/const cần khởi tạo + hàm cần có
  const closure = new Set(refsE); const queue = [...callees(e.node)].filter(x => glob.get(x)?.kind === 'func'); const seen = new Set();
  while(queue.length){ const fnm = queue.pop(); if(seen.has(fnm)) continue; seen.add(fnm); const g = glob.get(fnm); if(!g || g.kind !== 'func') continue; closure.add(fnm);
    const body = g.node; idents(body.body, g.src).forEach(x => closure.add(x)); callees(body.body).forEach(x => { if(glob.get(x)?.kind === 'func') queue.push(x); }); }
  for(const nm of closure){
    const g = glob.get(nm); if(!g) continue; eagerChecks++;
    if(g.kind === 'func'){ if(fileIdx.get(g.file) > fileIdx.get(e.f)) problems.push(`HÀM "${nm}" (${g.file}) nạp SAU mã chạy-ngay trong ${e.f}: ${text.slice(0, 60).replace(/\s+/g, ' ')}`); }
    else {
      const os = origSeq.get(nm), oe = origEagerSeq.get(text);
      const origBefore = os !== undefined && oe !== undefined && os < oe;
      const newBefore = g.seq < e.seq;
      if(origBefore && !newBefore) problems.push(`BIẾN "${nm}" (${g.file}) khai báo SAU mã chạy-ngay trong ${e.f}: ${text.slice(0, 60).replace(/\s+/g, ' ')}`);
    }
  }
}
if(problems.length){ [...new Set(problems)].forEach(bad); } else ok(`${eager.length} lệnh chạy-ngay, ${eagerChecks} phụ thuộc — không có phụ thuộc nào bị đảo thứ tự`);
// khai báo trùng giữa các file (gây SyntaxError)
const seenDecl = new Map(); const dups = [];
for(const f of order){ const fn = fileNodes[f]; if(!fn) continue; for(const k of fn.real){ const n = k.node; const names = n.type === 'FunctionDeclaration' ? [n.id.name] : n.type === 'VariableDeclaration' ? n.declarations.map(d => d.id.name).filter(Boolean) : []; names.forEach(nm => { if(seenDecl.has(nm) && !(n.type === 'FunctionDeclaration')) dups.push(nm); seenDecl.set(nm, f); }); } }
if(dups.length) bad('khai báo let/const trùng: ' + dups.join(',')); else ok('không có khai báo let/const trùng giữa các file');

// ── 6. Thứ tự đăng ký listener/timer (lệnh chạy-ngay dạng ExpressionStatement) phải GIỮ NGUYÊN so với bản gốc ──
console.log('[6] Thứ tự các lệnh đăng ký sự kiện/timer khi nạp');
const exprOrig = o.chunks.filter(c => c.node.type === 'ExpressionStatement' || c.node.type === 'IfStatement').map(c => jsSrc.slice(c.node.start, c.node.end));
const exprNew = eager.filter(e => e.node.type === 'ExpressionStatement' || e.node.type === 'IfStatement').map(e => e.src.slice(e.node.start, e.node.end));
const sameSet = exprOrig.length === exprNew.length && [...exprOrig].sort().join('\u0000') === [...exprNew].sort().join('\u0000');
if(!sameSet) bad('tập lệnh chạy-ngay khác bản gốc');
else {
  // chỉ cần giữ thứ tự TƯƠNG ĐỐI giữa các lệnh cùng loại sự kiện trên cùng target (listener cùng target chạy theo thứ tự đăng ký)
  const tgt = t => (t.match(/^(document|window)\.addEventListener\('([a-zA-Z]+)'/) || [])[0];
  const group = arr => { const m = new Map(); arr.forEach(t => { const k = tgt(t); if(k){ if(!m.has(k)) m.set(k, []); m.get(k).push(t); } }); return m; };
  const go = group(exprOrig), gn = group(exprNew); let diff = 0;
  for(const [k, v] of go){ if(JSON.stringify(v) !== JSON.stringify(gn.get(k))){ diff++; bad('thứ tự listener "' + k + '" bị đổi\n      gốc: ' + v.map(x => x.slice(0, 70).replace(/\s+/g,' ')).join('\n           ') + '\n      mới: ' + gn.get(k).map(x => x.slice(0, 70).replace(/\s+/g,' ')).join('\n           ')); } }
  if(!diff) ok(`${[...go.values()].reduce((a, b) => a + b.length, 0)} listener trên ${go.size} cặp (target, sự kiện) giữ nguyên thứ tự đăng ký`);
}
console.log(fails ? `\n✗ ${fails} kiểm tra THẤT BẠI` : '\n✓ TẤT CẢ kiểm tra tĩnh ĐẠT');
process.exit(fails ? 1 : 0);
