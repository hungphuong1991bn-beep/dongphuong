// src/core/constants.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
// ════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════
const FB_KEY  = 'sx_fb_url';
const LS_KEY  = 'sx_db_v2';
const LOG_KEY = 'sx_log_v2';

// ── NÂNG CẤP BẢO MẬT FIREBASE (xem thêm ở khối "FIREBASE HELPERS" bên dưới) ──
// FB_API_KEY: apiKey Web của dự án Firebase — KHÔNG phải bí mật cần giấu,
// nó chỉ giúp trình duyệt định danh đúng dự án khi gọi Firebase Authentication
// (bảo mật thật sự nằm ở Rules + việc bắt buộc phải có auth token, xem dưới).
// FB_DEFAULT_URL: Database URL mặc định — CHỈ được dùng khi máy/thiết bị đó
// CHƯA từng cấu hình Firebase (localStorage rỗng). Máy nào đã có sẵn URL riêng
// (kể cả URL khác) vẫn giữ nguyên URL đã lưu, không bị ghi đè — không ảnh
// hưởng tài khoản/dữ liệu đang dùng của các máy hiện tại.
const FB_API_KEY     = 'AIzaSyBAqkO_gkcmB7HKH3fQn1kORMTph8wQfz0';
const FB_DEFAULT_URL = 'https://hung-6fc47-default-rtdb.asia-southeast1.firebasedatabase.app';
const FB_REFRESH_LS  = 'sx_fb_refresh_v1';

// Phiên bản ứng dụng (hiển thị tại Cài đặt ▸ Phiên bản & Cập nhật).
// Đây chỉ là số DỰ PHÒNG dùng khi chưa đồng bộ được version.json (vd lần
// mở đầu tiên khi offline). Số phiên bản THẬT được .github/workflows/
// bump-version.yml tự động tăng lên và ghi vào version.json mỗi khi có
// code mới được đẩy lên nhánh main — không cần sửa tay số này nữa.
const APP_VERSION    = '2.5.1';
const APP_BUILD_DATE = '2026-07-04';

// Thang màu mức ưu tiên: 1 dải màu chuyển dần từ đỏ đậm (khẩn cấp nhất)
// sang cam/hổ phách rồi tới xám-xanh trung tính (ít khẩn cấp hơn) — thay
// cho dải cầu vồng nhiều tông màu không liên quan trước đây, để giao diện
// nhìn chuyên nghiệp/đồng bộ hơn nhưng vẫn phân biệt rõ 8 mức.
const PRI_COLOR = {
  'GẤP 1':'#B91C1C','GẤP 2':'#DC2626','GẤP 3':'#E4572E','GẤP 4':'#D97706',
  'GẤP 5':'#CA8A04','GẤP 6':'#64748B','GẤP 7':'#475569','GẤP 8':'#334155'
};

// Danh sách máy móc cố định — dùng cho tab Bảo trì máy
const MACHINES = [
  {id:'m_tj500_1', group:'Máy đùn', name:'Máy đùn TJ550 (1)', icon:'🏭'},
  {id:'m_tj550_2', group:'Máy đùn', name:'Máy đùn TJ550 (2)', icon:'🏭'},
  {id:'m_tj400',   group:'Máy đùn', name:'Máy đùn TJ400',     icon:'🏭'},
  {id:'m_tj300',   group:'Máy đùn', name:'Máy đùn TJ300',     icon:'🏭'},
  {id:'m_rut100_1',group:'Máy rút', name:'Máy rút 100 - 1',   icon:'⚙️'},
  {id:'m_rut100_2',group:'Máy rút', name:'Máy rút 100 - 2',   icon:'⚙️'},
  {id:'m_rut50',   group:'Máy rút', name:'Máy rút 50',        icon:'⚙️'},
  {id:'m_danhbong_1',group:'Máy đánh bóng', name:'Máy đánh bóng - 1', icon:'✨'},
  {id:'m_danhbong_2',group:'Máy đánh bóng', name:'Máy đánh bóng - 2', icon:'✨'},
  {id:'m_cat_1',    group:'Máy cắt', name:'Máy cắt 1', icon:'✂️'},
  {id:'m_cat_2',    group:'Máy cắt', name:'Máy cắt 2', icon:'✂️'}
];

// ── Phân công máy theo Công đoạn (dùng cho tab Kế hoạch SX + Điều hành SX) ──
// Mỗi công đoạn gán với đúng 1 nhóm máy trong MACHINES ở trên (group phải khớp
// tuyệt đối tên nhóm). Đây là danh sách CÔNG ĐOẠN PHÂN CÔNG MÁY — độc lập với
// STAGES (luồng trạng thái Đùn→Rút→Đánh bóng đã chạy production từ trước) để
// KHÔNG đụng vào logic chuyển trạng thái/tiến độ hiện có (an toàn dữ liệu cũ).
// Việc phân công máy được lưu ngay trong bản ghi đơn hàng (o.machineAssign),
// nên khi saveOrders() chạy, nó tự đồng bộ Realtime cùng các trường khác của
// đơn — không cần tạo thêm nhánh Firebase mới, không có dữ liệu trùng.
const ASSIGN_STAGES = [
  {key:'dun',      label:'Đùn',        group:'Máy đùn',        icon:'🔧'},
  {key:'rut',      label:'Rút',        group:'Máy rút',        icon:'🔩'},
  {key:'danhbong', label:'Đánh bóng',  group:'Máy đánh bóng',  icon:'✨'},
  {key:'cat',      label:'Cắt',        group:'Máy cắt',        icon:'✂️'}
];
const ASSIGN_STAGE_LABEL = Object.fromEntries(ASSIGN_STAGES.map(s=>[s.key, s.label]));

// ── Màu nhận diện riêng cho từng KHU VỰC MÁY ở tab Điều hành SX (mỗi công
// đoạn Đùn/Rút/Đánh bóng/Cắt có 1 tông màu cố định, KHÔNG trùng với các màu
// trạng thái máy đang dùng — trắng=Chạy, đỏ=Sự cố, tím=Bảo trì, xanh dương
// nhạt=Sẵn sàng, vàng=Chờ — để không gây nhầm lẫn giữa "màu khu vực" và "màu
// trạng thái". Dùng để tô viền/tiêu đề/nhãn khu vực máy — chuyên nghiệp,
// hiện đại, dễ phân biệt cả khi nhìn từ xa trên màn TV.
// Bảng màu khu vực máy (Bảng điều hành SX — TV Mode): trước đây dùng các màu
// "neon" tương phản mạnh (cyan/indigo/hồng magenta/emerald) rời rạc, đặt cạnh
// nhau trên nền navy tạo cảm giác sặc sỡ, thiếu chuyên nghiệp. Bảng màu mới
// dùng chung 1 "họ" tông lạnh (xanh dương → ngọc lam → tím than) + đúng 1 màu
// ấm (cam) làm điểm nhấn cho công đoạn cuối — vẫn đủ tương phản để phân biệt
// nhanh 4 khu vực, nhưng hài hoà, đồng bộ hơn với nền/khung TV Mode.
const GROUP_COLOR = {
  'Máy đùn':        '#3B9EFF', // Xanh dương (đồng bộ với brand)
  'Máy rút':        '#7C8CF8', // Chàm/tím than nhạt
  'Máy đánh bóng':  '#2DD4BF', // Ngọc lam (teal)
  'Máy cắt':        '#F0924A'  // Cam đất — điểm nhấn duy nhất
};
function dhGroupColor(g){ return GROUP_COLOR[g] || '#8fc0ff'; }
// Vị trí (0,1,2,3...) của 1 công đoạn trong luồng Đùn→Rút→Đánh bóng→Cắt — dùng
// để so sánh "công đoạn A có phải TRƯỚC/TRÙNG hay SAU công đoạn hiện tại của
// đơn không" (xem dhIsOrderRunningAtStage() — cho phép công đoạn ĐÃ CHẠY QUA
// vẫn được coi là "đang chạy song song" nếu máy đó vẫn còn giữ đúng đơn này).
function assignStageIndex(stageKey){
  const i = ASSIGN_STAGES.findIndex(s=>s.key===stageKey);
  return i===-1 ? 0 : i;
}
const BTM_TYPE_LABEL = {hong:'🔴 Hỏng đột xuất', baotri:'🟡 Bảo trì định kỳ', kiemtra:'🔵 Kiểm tra định kỳ'};

// Công đoạn sản xuất: Máy Đùn -> Máy Rút -> Đánh Bóng -> Cắt (Cắt là công đoạn
// SAU CÙNG theo đúng quy trình thực tế của xưởng). Thứ tự mảng này quyết định
// cả thứ tự cột hiển thị trong tab "Kế hoạch SX" lẫn cách tính % tiến độ/xác
// định công đoạn "trước/sau" (findIndex theo mảng) — nên khi đổi thứ tự ở đây,
// toàn bộ luồng chuyển công đoạn tự động khớp theo đúng quy trình mới.
const STAGES = [
  {key:'dun', label:'Máy Đùn', icon:'🔧'},
  {key:'rut', label:'Máy Rút', icon:'🔩'},
  {key:'danhbong', label:'Đánh Bóng', icon:'✨'},
  {key:'cat', label:'Cắt', icon:'✂️'}
];
const STAGE_LABEL = Object.fromEntries(STAGES.map(s=>[s.key, s.label]));
