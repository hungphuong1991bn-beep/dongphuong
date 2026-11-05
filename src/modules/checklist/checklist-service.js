// src/modules/checklist/checklist-service.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Check Sheet Thiết bị: DB.csData[ym][itemKey][day] = 'ok'|'ng' — cùng hình
// dạng với DB.attendance nên dùng chung cơ chế flatten/merge-theo-khoá.
function flattenCsData(cs){
  const m = {};
  Object.keys(cs||{}).forEach(ym=>{
    const items = (cs||{})[ym]||{};
    Object.keys(items).forEach(ik=>{ m[ym+'|'+ik] = JSON.stringify(items[ik]); });
  });
  return m;
}
function unflattenCsData(map){
  const cs = {};
  Object.keys(map).forEach(key=>{
    const i = key.indexOf('|');
    const ym = key.slice(0,i), ik = key.slice(i+1);
    if(!cs[ym]) cs[ym] = {};
    try{ cs[ym][ik] = JSON.parse(map[key]); }catch(e){}
  });
  return cs;
}
let _lastSyncedCsDataSnapshot = {};

// Check Sheet Thiết bị — lưu cấu trúc (nhóm/khu vực/hạng mục): chỉ Admin.
function saveCsTemplates(){if(guardNotAdmin())return;
  lsSave();
  syncArrFieldToServer('csTemplates', '/data/csTemplates');
}

function saveCsData(){if(guardViewer())return;
  lsSave();
  if(!fbOk()) return;
  setSyncDot('saving');
  markDirty('csData');
  beginSave();
  mergeAndSaveCsData();
}
async function mergeAndSaveCsData(){
  const localFlat = flattenCsData(DB.csData);
  const changedKeys = new Set();
  Object.keys(localFlat).forEach(k=>{ if(localFlat[k]!==_lastSyncedCsDataSnapshot[k]) changedKeys.add(k); });
  const removedKeys = new Set();
  Object.keys(_lastSyncedCsDataSnapshot).forEach(k=>{ if(!localFlat[k]) removedKeys.add(k); });

  let mergedFlat;
  try{
    const serverRaw = await fbRead('/data/csData');
    const serverFlat = flattenCsData(serverRaw||{});
    mergedFlat = {...serverFlat};
    Object.keys(localFlat).forEach(k=>{
      if(changedKeys.has(k) || !(k in serverFlat)) mergedFlat[k] = localFlat[k];
    });
    removedKeys.forEach(k=>{ delete mergedFlat[k]; });
  }catch(e){
    mergedFlat = localFlat;
  }

  DB.csData = unflattenCsData(mergedFlat);
  lsSave();
  scheduleUIRefresh(false);
  return fbSaveField('csData', '/data/csData', false, ()=>{ _lastSyncedCsDataSnapshot = flattenCsData(DB.csData); });
}
