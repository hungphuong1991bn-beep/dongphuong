// Dữ liệu mẫu cố định để so sánh trước/sau refactor (cùng dữ liệu → cùng giao diện)
const T0 = Date.parse('2026-11-03T08:00:00+07:00');
const day = 86400000;
function order(i, o){
  return Object.assign({
    id:'seed'+i, status:'pending', createdAt:T0-i*3600000, createdBy:'u1',
    customer:'Khách '+i, po:'PO-'+i, type:'Đồng thanh dẹt', material:'Đồng đỏ',
    thickness:'5', width:'30', length:4000, qty:20+i, kg:Math.round((5*30*4000*8.96/1e6)*(20+i)*1000)/1000,
    phi:0, isRound:false, isCoil:false, meterPerCoil:0, totalMeters:0,
    priority:'GẤP '+(1+(i%8)), deliveryDate:new Date(T0+(i-2)*day).toISOString().slice(0,10), address:'Hà Nội', note:'Ghi chú '+i,
    version:1, updatedAt:T0, updatedBy:'Quản trị viên'
  }, o||{});
}
const orders = [
  order(1,{status:'pending'}),
  order(2,{status:'running', startedAt:T0-4*3600000, machineAssign:{ext:'Máy đùn 1'}}),
  order(3,{status:'running', isRound:true, phi:18, thickness:0, width:0, length:6000, startedAt:T0-2*3600000}),
  order(4,{status:'done', completedAt:T0-day, finishedAt:T0-day}),
  order(5,{status:'pending', isCoil:true, meterPerCoil:100, totalMeters:2000, qty:20}),
  order(6,{status:'done', completedAt:T0-2*day, finishedAt:T0-2*day, customer:'Công ty ABC'}),
  order(7,{status:'pending', customer:'Công ty ABC', priority:'GẤP 1'}),
];
const seedData = {
  data: {
    orders: Object.fromEntries(orders.map(o=>[o.id,o])),
  }
};
module.exports = { seedData, T0 };
