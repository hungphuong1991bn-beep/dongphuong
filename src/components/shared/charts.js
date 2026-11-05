// src/components/shared/charts.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// DASHBOARD CHART HELPERS (SVG thuần, không phụ thuộc thư viện ngoài)
// ════════════════════════════════════════════════════════════
// ── Chart tooltip (hover trên PC, chạm trên điện thoại) ──
function ctEl(){
  let tip = document.getElementById('chartTip');
  if(!tip){ tip = document.createElement('div'); tip.id='chartTip'; tip.className='chart-tip'; document.body.appendChild(tip); }
  return tip;
}
function ctMove(evt){
  const tip = ctEl();
  const pt = evt.touches && evt.touches[0] ? evt.touches[0] : evt;
  const pad = 14;
  let left = pt.clientX + pad, top = pt.clientY + pad;
  const tw = tip.offsetWidth || 120, th = tip.offsetHeight || 34;
  if(left + tw > window.innerWidth - 8) left = pt.clientX - tw - pad;
  if(top + th > window.innerHeight - 8) top = pt.clientY - th - pad;
  if(left < 4) left = 4;
  if(top < 4) top = 4;
  tip.style.left = left+'px';
  tip.style.top = top+'px';
}
function ctShow(evt, html){
  if(evt && evt.touches) evt.stopPropagation();
  const tip = ctEl();
  tip.innerHTML = html;
  tip.style.display = 'block';
  ctMove(evt);
}
function ctHide(){
  const tip = document.getElementById('chartTip');
  if(tip) tip.style.display = 'none';
}
document.addEventListener('touchstart', ctHide, {passive:true});
document.addEventListener('scroll', ctHide, {passive:true, capture:true});

function svgDonut(segments, size, thickness){
  size = size||120; thickness = thickness||16;
  const r = (size-thickness)/2, c = size/2;
  const circumference = 2*Math.PI*r;
  const total = segments.reduce((s,x)=>s+x.value,0) || 1;
  let cumulative = 0;
  const circles = segments.filter(s=>s.value>0).map(seg=>{
    const frac = seg.value/total;
    const dash = frac*circumference;
    const dashOffset = circumference - (cumulative/total)*circumference;
    cumulative += seg.value;
    const pct = Math.round(frac*100);
    const tipHtml = (seg.label+': <b>'+seg.value+'</b> ('+pct+'%)').replace(/'/g,"&#39;");
    return `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${thickness}" stroke-dasharray="${dash.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}" stroke-linecap="${segments.filter(s=>s.value>0).length>1?'butt':'round'}" transform="rotate(-90 ${c} ${c})" onmouseenter="ctShow(event,'${tipHtml}')" onmousemove="ctMove(event)" onmouseleave="ctHide()" ontouchstart="ctShow(event,'${tipHtml}')"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" style="display:block">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="${thickness}"/>
    ${circles}
  </svg>`;
}

function hBarChartHtml(data, opts){
  opts = opts||{};
  const suffix = opts.suffix||'';
  const max = Math.max(1, ...data.map(d=>d.value));
  if(!data.length) return `<div class="chart-empty-mini">Chưa có dữ liệu</div>`;
  return data.map(d=>{
    const pct = Math.max(2, Math.round(d.value/max*100));
    const tipHtml = (d.label+': <b>'+d.value+suffix+'</b>').replace(/'/g,"&#39;");
    return `<div class="hbar-row" onmouseenter="ctShow(event,'${tipHtml}')" onmousemove="ctMove(event)" onmouseleave="ctHide()" ontouchstart="ctShow(event,'${tipHtml}')">
      <div class="hbar-lbl" title="${d.label}">${d.label}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${d.color}"></div></div>
      <div class="hbar-val">${d.value}${suffix}</div>
    </div>`;
  }).join('');
}
