// sw.js ASSETS phải khớp đúng các <script src>/<link href> nội bộ của index.html (+ index.html, manifest.json)
const fs = require('fs'), path = require('path'); const root = path.resolve(__dirname, '../..');
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const refs = [...idx.matchAll(/<script src="(src\/[^"]+)"/g)].map(m => m[1]).concat([...idx.matchAll(/<link rel="stylesheet"[^>]*href="(src\/[^"]+)"/g)].map(m => m[1]));
const assets = [...sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];', sw.indexOf('const ASSETS'))).matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
const miss = refs.filter(r => !assets.includes(r)), extra = assets.filter(a => !refs.includes(a) && !['index.html', 'manifest.json'].includes(a));
if(miss.length || extra.length){ console.error('✗ sw.js ASSETS lệch index.html', {miss, extra}); process.exit(1); }
if(!/endsWith\('\.css'\)/.test(sw)){ console.error('✗ sw.js thiếu network-first cho .css'); process.exit(1); }
console.log(`✓ sw.js: ${assets.length} tài nguyên khớp index.html, CSS network-first`);
