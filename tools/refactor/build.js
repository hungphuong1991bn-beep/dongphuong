#!/usr/bin/env node
// Sinh cấu trúc src/ + index.html mới từ index.html GỐC (baseline) theo manifest.js
//   node tools/refactor/build.js <index.html gốc> <thư-mục-đích>
// Công cụ này chỉ CẮT & CHUYỂN mã (không viết lại): verify.js chứng minh điều đó.
const fs = require('fs'), path = require('path');
const acorn = require(process.env.ACORN_PATH || 'acorn');
const M = require('./manifest');

const srcFile = path.resolve(process.argv[2]); const outDir = path.resolve(process.argv[3]);
const L = fs.readFileSync(srcFile, 'utf8').split('\n');           // L[i] = dòng i+1
const lines = (a, b) => L.slice(a - 1, b);                         // gồm cả hai đầu
const HDR_END = '// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────';
const CSS_HDR_PREFIX = '/* ▸ ';

function write(rel, content){
  const f = path.join(outDir, 'src', rel); fs.mkdirSync(path.dirname(f), {recursive:true}); fs.writeFileSync(f, content);
}

// ═══ 1. JS chính (dòng 8153..25657 của index.html gốc) ═══
const JS_START = 8153, JS_END = 25657;
const jsSrc = lines(JS_START, JS_END).join('\n');
const ast = acorn.parse(jsSrc, {ecmaVersion:'latest', locations:true});
const nameOf = n => n.type === 'FunctionDeclaration' ? n.id.name
  : n.type === 'VariableDeclaration' ? n.declarations.map(d => d.id.name || '{..}')
  : 'X ' + jsSrc.slice(n.start, n.start + 70).replace(/\s+/g, ' ');
const chunks = []; let prev = 0;
for(const n of ast.body){
  chunks.push({text: jsSrc.slice(prev, n.end), ln: n.loc.start.line, name: nameOf(n), kind: n.type});
  prev = n.end;
}
const trailing = jsSrc.slice(prev);
function fileFor(c){
  const names = Array.isArray(c.name) ? c.name : [c.name];
  for(const r of M.JS_RULES){
    if(r.names && names.some(x => r.names.has(x))) return r.file;
    if(r.re && r.re.test(names[0])) return r.file;
    if(r.ranges && r.ranges.some(([a,b]) => c.ln >= a && c.ln <= b)) return r.file;
  }
  return null;
}
const byFile = new Map(); const unassigned = [];
chunks.forEach((c, i) => {
  const f = fileFor(c); c.file = f;
  if(!f){ unassigned.push(c); return; }
  if(!byFile.has(f)) byFile.set(f, []); byFile.get(f).push(c); c.idx = i;
});
if(unassigned.length){
  console.error('CHƯA GÁN FILE:', unassigned.map(c => c.ln + ' ' + c.name).join('\n  ')); process.exit(2);
}
// phần đuôi (khoảng trắng/comment sau khối cuối) đi cùng file của khối cuối
byFile.get(chunks[chunks.length - 1].file).push({text: trailing, ln: 1e9, name:'(đuôi)', idx: chunks.length});

// ═══ 2. HTML slots ═══
const slotByFile = new Map();
for(const [id, file, a, b] of M.SLOTS){
  const html = lines(a, b).join('\n');
  const esc = html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  if(/<\/script/i.test(html)) throw new Error('slot ' + id + ' chứa </script>');
  slotByFile.set(file, {id, code: 'document.write(`' + esc + '`);\n'});
}

// ═══ 3. Ghi file JS ═══
const descr = f => '// ' + f;
const allJsFiles = new Set([...byFile.keys(), ...slotByFile.keys()]);
const firstLine = new Map(); // vị trí gốc nhỏ nhất → thứ tự nạp 'main'
for(const f of allJsFiles){
  const parts = [];
  const slot = slotByFile.get(f);
  const cs = byFile.get(f) || [];
  parts.push('// src/' + f + '  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic');
  if(slot) parts.push('// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).');
  parts.push(HDR_END);
  let body = parts.join('\n') + '\n';
  if(slot) body += slot.code;
  body += cs.map(c => c.text).join('');
  if(!body.endsWith('\n')) body += '\n';
  write(f, body);
  // khoá thứ tự nạp: ưu tiên vị trí gốc của LỆNH ĐĂNG KÝ sự kiện/timer đầu tiên (giữ đúng thứ tự listener), nếu không có thì khối đầu tiên
  const xs = cs.filter(c => c.kind === 'ExpressionStatement' || c.kind === 'IfStatement').map(c => c.idx);
  firstLine.set(f, cs.length ? (xs.length ? Math.min(...xs) : Math.min(...cs.map(c => c.idx))) : -1);
}
// vendor + asset
const QR_FROM = 19, QR_TO = 2366;
write('vendor/qrcode.js', '// src/vendor/qrcode.js — thư viện QR Code Generator (Kazuhiko Arase, MIT), nhúng nguyên văn\n' + HDR_END + '\n' + lines(QR_FROM, QR_TO).join('\n') + '\n');
write(M.LOGO_SCRIPT.file, '// src/assets/brand-logo.js — logo thương hiệu (data URL) + gán vào các <img>, chạy tại đúng vị trí cũ trong #pwaBar\n' + HDR_END + '\n' + lines(M.LOGO_SCRIPT.from, M.LOGO_SCRIPT.to).join('\n') + '\n');

// ═══ 4. CSS ═══
const css1 = lines(2371, 6528); const css1n = css1.length;
const cuts = M.CSS_CUTS;
for(let i = 0; i < cuts.length; i++){
  const [f, s] = cuts[i]; const e = i + 1 < cuts.length ? cuts[i + 1][1] - 1 : css1n;
  write(f, CSS_HDR_PREFIX + 'src/' + f + ' — đoạn LIÊN TIẾP dòng ' + s + '–' + e + ' của CSS gốc; thứ tự nạp = thứ tự cascade, KHÔNG đổi thứ tự ◂ */\n' + css1.slice(s - 1, e).join('\n') + '\n');
}
write(M.CSS2_FILE, CSS_HDR_PREFIX + 'src/' + M.CSS2_FILE + ' — nguyên khối <style id="dh4-style"> gốc ◂ */\n' + lines(6531, 6823).join('\n') + '\n');

// ═══ 5. index.html mới ═══
const mainFiles = [...allJsFiles].filter(f => !slotByFile.has(f) && !M.JS_PRE.includes(f))
  .sort((a, b) => firstLine.get(a) - firstLine.get(b));
const script = f => `<script src="src/${f}"></script>`;
const out = [];
out.push(...lines(1, 17).slice(0, 17 - 1 + 0)); // dòng 1..16 (giữ nguyên), dòng 17 là <!-- ... --> ? kiểm tra bên dưới
// (dòng 17 gốc là chú thích hoặc rỗng; ta giữ nguyên từ 1..17 thay vì cắt)
out.length = 0; out.push(...lines(1, 17));
out.push('<script src="src/vendor/qrcode.js"></script>');
out.push(...lines(2368, 2369));
out.push('<!-- CSS: tách thành các file LIÊN TIẾP theo đúng thứ tự cascade gốc — KHÔNG đổi thứ tự các <link> dưới đây -->');
for(const [f] of cuts) out.push(`<link rel="stylesheet" href="src/${f}">`);
out.push(`<link rel="stylesheet" id="dh4-style" href="src/${M.CSS2_FILE}">`);
out.push(...lines(6825, 6827)); // </head>, <body>, dòng trống
out.push('<!-- Nạp trước: hằng số + tiện ích dùng chung (chỉ khai báo, không chạm DOM) -->');
for(const f of M.JS_PRE) out.push(script(f));
// thân trang: thay từng slot bằng <script>
let cur = 6828; const slots = [...M.SLOTS].sort((a, b) => a[2] - b[2]);
for(const [id, file, a, b] of slots){
  out.push(...lines(cur, a - 1));
  if(id === 'pwa2'){ out.push(script(M.LOGO_SCRIPT.file)); }
  out.push(script(file));
  cur = b + 1;
  if(id === 'pwa1') cur = 7262;   // bỏ qua 7252–7261 (script logo, đã chuyển sang asset)
}
out.push(...lines(cur, 8151));
out.push('<!-- Mã nghiệp vụ: nạp ĐÚNG thứ tự dưới đây (đã kiểm chứng bằng tools/refactor/verify.js) -->');
for(const f of mainFiles) out.push(script(f));
out.push(...lines(25659, L.length));
fs.writeFileSync(path.join(outDir, 'index.html'), out.join('\n'));
fs.writeFileSync(path.join(outDir, 'tools/refactor/.load-order.json'), JSON.stringify({pre: M.JS_PRE, slots: slots.map(s => s[1]), main: mainFiles}, null, 1));
console.log('JS files:', allJsFiles.size, '· CSS files:', cuts.length + 1, '· main order:', mainFiles.length);
