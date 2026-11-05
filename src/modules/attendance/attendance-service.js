// src/modules/attendance/attendance-service.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


function flattenAttendance(att){
  const m = {};
  Object.keys(att||{}).forEach(ym=>{
    const workers = (att||{})[ym]||{};
    Object.keys(workers).forEach(wid=>{ m[ym+'|'+wid] = JSON.stringify(workers[wid]); });
  });
  return m;
}
function unflattenAttendance(map){
  const att = {};
  Object.keys(map).forEach(key=>{
    const i = key.indexOf('|');
    const ym = key.slice(0,i), wid = key.slice(i+1);
    if(!att[ym]) att[ym] = {};
    try{ att[ym][wid] = JSON.parse(map[key]); }catch(e){}
  });
  return att;
}
let _lastSyncedAttendanceSnapshot = {};

function saveAttendance(){if(guardViewer())return;
  lsSave();
  if(!fbOk()) return;
  setSyncDot('saving');
  markDirty('attendance');
  beginSave();
  mergeAndSaveAttendance();
}

async function mergeAndSaveAttendance(){
  const localFlat = flattenAttendance(DB.attendance);
  const changedKeys = new Set();
  Object.keys(localFlat).forEach(k=>{ if(localFlat[k]!==_lastSyncedAttendanceSnapshot[k]) changedKeys.add(k); });
  const removedKeys = new Set();
  Object.keys(_lastSyncedAttendanceSnapshot).forEach(k=>{ if(!localFlat[k]) removedKeys.add(k); });

  let mergedFlat;
  try{
    const serverRaw = await fbRead('/data/attendance');
    const serverFlat = flattenAttendance(serverRaw||{});
    mergedFlat = {...serverFlat};
    Object.keys(localFlat).forEach(k=>{
      if(changedKeys.has(k) || !(k in serverFlat)) mergedFlat[k] = localFlat[k];
    });
    removedKeys.forEach(k=>{ delete mergedFlat[k]; });
  }catch(e){
    mergedFlat = localFlat;
  }

  DB.attendance = unflattenAttendance(mergedFlat);
  lsSave();
  scheduleUIRefresh(false);
  return fbSaveField('attendance', '/data/attendance', false, ()=>{ _lastSyncedAttendanceSnapshot = flattenAttendance(DB.attendance); });
}

function saveLichLamViec(){if(guardViewer())return;
  lsSave();
  syncArrFieldToServer('lichLamViec', '/data/lichLamViec');
}
