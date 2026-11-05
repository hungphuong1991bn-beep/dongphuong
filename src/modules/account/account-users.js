// src/modules/account/account-users.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// USERS CRUD
// ════════════════════════════════════════════════════════════
function openAddUser(){if(guardViewer())return; _editUserId=null; $('userModalTitle').textContent='Thêm tài khoản'; ['ufUser','ufPass','ufName','ufEmail','ufPhone'].forEach(id=>$(id).value=''); $('ufRole').value='staff'; $('userErr').style.display='none'; openModal('userModal'); }
function editUser(id){if(guardViewer())return;
  const u=DB.users.find(x=>x.id===id); if(!u) return;
  _editUserId=id; $('userModalTitle').textContent='Sửa tài khoản';
  $('ufUser').value=u.username; $('ufPass').value=''; $('ufName').value=u.name;
  $('ufRole').value=u.role; $('ufEmail').value=u.email||''; $('ufPhone').value=u.phone||'';
  $('userErr').style.display='none'; openModal('userModal');
}
async function saveUser(){if(guardViewer())return;
  const username=sanitizeDisplayText($('ufUser').value.trim()), name=sanitizeDisplayText($('ufName').value.trim()), role=$('ufRole').value, pass=$('ufPass').value, email=$('ufEmail').value.trim(), phone=$('ufPhone').value.trim();
  const errEl=$('userErr'); errEl.style.display='none';
  if(!username||!name){ errEl.textContent='Nhập đủ thông tin'; errEl.style.display='block'; return; }
  if(!/^[a-zA-Z0-9_.]{3,30}$/.test(username)){ errEl.textContent='Tên đăng nhập chỉ gồm chữ/số/._ (3-30 ký tự)'; errEl.style.display='block'; return; }
  if(pass && pass.length<4){ errEl.textContent='Mật khẩu ít nhất 4 ký tự'; errEl.style.display='block'; return; }
  if(_editUserId){
    const idx=DB.users.findIndex(x=>x.id===_editUserId);
    const before={role:DB.users[idx].role};
    DB.users[idx]={...DB.users[idx],name,role,email,phone};
    if(pass){
      const {passwordHash, salt} = await makePasswordFields(pass);
      DB.users[idx].passwordHash=passwordHash; DB.users[idx].salt=salt;
      delete DB.users[idx].password;
    }
    log('Sửa TK',`${name} · vai trò: ${role}`,''  ,before,{role});
    showToast('✅ Đã cập nhật tài khoản');
  } else {
    if(!pass){ errEl.textContent='Nhập mật khẩu'; errEl.style.display='block'; return; }
    if(DB.users.find(x=>x.username===username)){ errEl.textContent='Tên đăng nhập đã tồn tại'; errEl.style.display='block'; return; }
    const newId=uid();
    const {passwordHash, salt} = await makePasswordFields(pass);
    DB.users.push({id:newId,username,passwordHash,salt,role,name,email,phone});
    log('Thêm TK',`${name} · @${username} · ${role}`,'',null,{username,role});
    showToast('✅ Đã thêm tài khoản');
  }
  closeModal('userModal'); renderTab(currentTab); saveUsers();
}
function deleteUser(id){if(guardViewer())return;
  const u=DB.users.find(x=>x.id===id); if(!u) return;
  if(u.role==='admin'&&DB.users.filter(x=>x.role==='admin').length<=1){ showToast('❌ Phải có ít nhất 1 admin',true); return; }
  confirm2('Xóa tài khoản',`Xóa tài khoản "${u.name}" (@${u.username})?`,()=>{
    log('Xóa TK',`${u.name} · @${u.username}`,'',{username:u.username,role:u.role},null);
    DB.users=DB.users.filter(x=>x.id!==id);
    renderTab(currentTab); showToast('Đã xóa tài khoản'); saveUsers();
  });
}
function saveProfile(){if(guardViewer())return;
  const idx=DB.users.findIndex(x=>x.id===currentUser.id);
  ensureUserProfileFields(DB.users[idx]);
  DB.users[idx].name=sanitizeDisplayText($('epName').value.trim())||DB.users[idx].name;
  DB.users[idx].email=$('epEmail').value.trim();
  DB.users[idx].phone=$('epPhone').value.trim();
  DB.users[idx].position=sanitizeDisplayText($('epPosition').value.trim());
  DB.users[idx].department=sanitizeDisplayText($('epDept').value.trim());
  if(_pendingAvatarDataUrl!==undefined){ DB.users[idx].avatar=_pendingAvatarDataUrl; _pendingAvatarDataUrl=undefined; }
  currentUser=DB.users[idx];
  updateTopbarProfile(currentUser);
  log('Sửa TK','Cập nhật thông tin cá nhân','');
  closeModal('profileModal'); renderSettings(); showToast('✅ Đã lưu'); saveUsers();
}
async function savePass(){if(guardViewer())return;
  const old=$('cpOld').value, nw=$('cpNew').value, cf=$('cpCf').value;
  const err=$('passErr'); err.style.display='none';
  if(!old || !nw || !cf){ err.textContent='Vui lòng nhập đầy đủ thông tin, không được để trống'; err.style.display='block'; return; }
  const idx=DB.users.findIndex(x=>x.id===currentUser.id);
  if(!(await verifyPassword(DB.users[idx], old))){ err.textContent='Mật khẩu hiện tại không đúng'; err.style.display='block'; return; }
  if(nw.length<4){ err.textContent='Mật khẩu mới ít nhất 4 ký tự'; err.style.display='block'; return; }
  if(nw!==cf){ err.textContent='Mật khẩu mới và xác nhận không khớp'; err.style.display='block'; return; }
  const {passwordHash, salt} = await makePasswordFields(nw);
  DB.users[idx].passwordHash=passwordHash; DB.users[idx].salt=salt;
  delete DB.users[idx].password;
  currentUser=DB.users[idx];
  log('Đổi MK','Đổi mật khẩu thành công','');
  closeModal('passModal'); showToast('✅ Đã đổi mật khẩu'); saveUsers();
}
