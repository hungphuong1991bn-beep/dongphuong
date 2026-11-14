// ── Firebase giả lập ──
class FakeFB{
  constructor(){ this.root={}; this.online=true; this.fail=0; this.log=[]; this.pushN=0; }
  _parts(p){ return p.split('?')[0].replace(/\.json$/,'').split('/').filter(Boolean); }
  _get(parts){ let node=this.root; for(const k of parts){ if(node==null||typeof node!=='object') return null; node=node[k]; } return node===undefined?null:node; }
  _prune(node){ if(node&&typeof node==='object'){ for(const k of Object.keys(node)){ node[k]=this._prune(node[k]); if(node[k]===null) delete node[k]; } return Object.keys(node).length?node:null; } return node; }
  _arrayify(v){ // mô phỏng Firebase: khoá số, đủ dày → mảng (có null ở vị trí trống)
    if(v&&typeof v==='object'){ const ks=Object.keys(v); const o={}; ks.forEach(k=>o[k]=this._arrayify(v[k]));
      if(ks.length&&ks.every(k=>/^\d+$/.test(k))){ const max=Math.max(...ks.map(Number)); if(max<ks.length*2){ const a=[]; for(let i=0;i<=max;i++) a.push(o[i]===undefined?null:o[i]); return a; } }
      return o; } return v; }
  _gate(){ if(!this.online) throw new TypeError('Failed to fetch'); if(this.fail>0){ this.fail--; throw new Error('HTTP 500'); } }
  async read(p){ this._gate(); return JSON.parse(JSON.stringify(this._arrayify(this._get(this._parts(p))))); }
  async write(p,data,method){ this._gate(); const parts=this._parts(p); this.log.push(method+' '+p);
    data=data===undefined?null:JSON.parse(JSON.stringify(data));
    if(method==='POST'){ const id='-P'+(++this.pushN); this._set(parts.concat(id),data); return {name:id}; }
    if(method==='PATCH'){ let cur=this._get(parts); cur=(cur&&typeof cur==='object')?cur:{}; const merged=Object.assign({},cur,data); this._set(parts,merged); return data; }
    this._set(parts,data); return data; }
  _set(parts,val){ if(!parts.length){ this.root=val||{}; return; } let node=this.root; for(let i=0;i<parts.length-1;i++){ if(node[parts[i]]==null||typeof node[parts[i]]!=='object') node[parts[i]]={}; node=node[parts[i]]; } node[parts[parts.length-1]]=val; this.root=this._prune(this.root)||{}; }
}


module.exports = FakeFB;
