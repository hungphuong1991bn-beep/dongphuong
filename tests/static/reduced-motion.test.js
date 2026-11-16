// Khi OS bật giảm chuyển động, hiệu ứng lặp vô hạn KHÔNG được lặp 0.01ms/vòng (gây nhấp nháy)
const fs=require('fs'),path=require('path'),assert=require('assert');
const css=fs.readFileSync(path.join(__dirname,'../../src/styles/design-system.css'),'utf8');
const m=css.match(/@media \(prefers-reduced-motion:reduce\)\{([\s\S]*?)\n\}/);
assert(m,'thiếu khối reduced-motion');
assert(/animation-duration:\.01ms!important/.test(m[1]));
assert(/animation-iteration-count:1!important/.test(m[1]),'phải ép lặp 1 lần');
assert(/\.sync-dot\{animation:none!important\}/.test(m[1]),'chấm đồng bộ phải đứng yên');
console.log('OK reduced-motion');
