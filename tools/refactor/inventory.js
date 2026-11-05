#!/usr/bin/env node
// Sinh bản đồ hiện trạng (Giai đoạn 1): hàm/biến theo file, đường dẫn Firebase, khoá localStorage, listener.
//   node tools/refactor/inventory.js <thư-mục-gốc> > docs/INVENTORY.md
const fs = require('fs'), path = require('path'); const acorn = require(process.env.ACORN_PATH || 'acorn');
const root = path.resolve(process.argv[2]); const files = [];
(function w(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p = path.join(d,e.name); if(e.isDirectory()) w(p); else if(p.endsWith('.js')) files.push(p); } })(path.join(root,'src'));
files.sort(); const fb = new Map(), ls = new Map(), lst = [], stat = [];
for(const f of files){ const rel = path.relative(path.join(root,'src'), f); if(rel.startsWith('vendor')||rel.startsWith('assets')) continue; const src = fs.readFileSync(f,'utf8'); let fn = 0, vars = [], big = 0;
  const ast = acorn.parse(src,{ecmaVersion:'latest',locations:true});
  for(const n of ast.body){ if(n.type==='FunctionDeclaration') fn++; else if(n.type==='VariableDeclaration') n.declarations.forEach(d=>d.id.name&&vars.push(d.id.name)); }
  stat.push([rel, src.split('\n').length, fn, vars.length]);
  for(const m of src.matchAll(/['"`](\/(?:data|presence|log|backups|announce|broadcast|scanStats|[a-zA-Z]+)\/[A-Za-z0-9_\/${}.\-]*)['"`]/g)) if(/^\/(data|presence|log|backups|announce|broadcast|scanStats|lock|locks|meta|pub)/.test(m[1])){ if(!fb.has(m[1])) fb.set(m[1],new Set()); fb.get(m[1]).add(rel); }
  for(const m of src.matchAll(/localStorage\.(?:get|set|remove)Item\(\s*['"`]([^'"`]+)['"`]/g)){ if(!ls.has(m[1])) ls.set(m[1],new Set()); ls.get(m[1]).add(rel); }
  for(const m of src.matchAll(/(?:^|\n)(?:document|window)\.addEventListener\('(\w+)'/g)) lst.push([m[1], rel]);
}
const o = [];
o.push('# INVENTORY — bản đồ hiện trạng sau tách module (sinh tự động)\n');
o.push('Sinh bởi `tools/refactor/inventory.js`. Danh sách đường dẫn Firebase/khoá localStorage lấy bằng quét mã nguồn (tham khảo, đối chiếu thêm bằng mắt khi đổi nghiệp vụ).\n');
o.push('## Thống kê theo file\n\n| File | Dòng | Hàm | Biến/hằng top-level |\n|---|---:|---:|---:|'); stat.forEach(s=>o.push(`| \`src/${s[0]}\` | ${s[1]} | ${s[2]} | ${s[3]} |`));
o.push('\n## Đường dẫn Firebase đang dùng (nơi tham chiếu)\n'); [...fb].sort().forEach(([k,v])=>o.push(`- \`${k}\` — ${[...v].map(x=>'`'+x+'`').join(', ')}`));
o.push('\n## Khoá localStorage\n'); [...ls].sort().forEach(([k,v])=>o.push(`- \`${k}\` — ${[...v].map(x=>'`'+x+'`').join(', ')}`));
o.push('\n## Listener toàn cục đăng ký khi nạp\n'); const g={}; lst.forEach(([e,f])=>{ (g[e]=g[e]||[]).push(f); }); Object.entries(g).sort().forEach(([e,fs])=>o.push(`- \`${e}\` ×${fs.length}: ${[...new Set(fs)].map(x=>'`'+x+'`').join(', ')}`));
console.log(o.join('\n'));
