// src/components/shared/Modal.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────

let _cfCb = null;
function openModal(id){ $(id).classList.add('open'); }
function closeModal(id){ $(id).classList.remove('open'); }

// ── Bấm ra ngoài (vùng nền mờ phía sau) sẽ tự đóng modal ──
// Dùng "event delegation" (1 listener duy nhất gắn ở document) thay vì gắn
// riêng từng modal, để tự áp dụng luôn cho MỌI modal hiện có lẫn modal thêm
// mới sau này mà không cần sửa lại chỗ khác. Chỉ đóng khi bấm ĐÚNG vào lớp
// nền mờ (div.modal) — bấm bên trong nội dung modal (modal-box) hoặc bất kỳ
// phần tử con nào bên trong đó sẽ KHÔNG bị đóng nhầm.
document.addEventListener('click', function(e){
  if(e.target.classList && e.target.classList.contains('modal') && e.target.classList.contains('open')){
    closeModal(e.target.id);
  }
});
function confirm2(title,body,cb){
  $('cfTitle').textContent=title;
  $('cfBody').textContent=body;
  _cfCb=cb; openModal('cfModal');
}
function cfOK(){ closeModal('cfModal'); if(_cfCb){_cfCb();_cfCb=null;} }
