const mongoose = require('mongoose');

// Import model Trasua
const Trasua = mongoose.model('Trasua');

module.exports = (bot) => {
  bot.onText(/\/5ngay/, async (msg) => {
    const chatId = msg.chat.id;
    const groupId = -1002128975957; // Sử dụng groupId theo yêu cầu

    // Lấy tất cả các bản ghi bảng công theo groupId
    const bangCongList = await Trasua.find({ groupId });
    if (bangCongList.length === 0) {
      bot.sendMessage(chatId, 'Chưa có bảng công nào được ghi nhận.');
      return;
    }

    // Tạo đối tượng để phân chia bảng công theo ngày và tổng hợp tiền và acc cho mỗi thành viên
    const bangCongByMember = {};

    bangCongList.forEach(entry => {
      const date = new Date(entry.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

      // Nếu thành viên chưa tồn tại trong bảng, khởi tạo
      if (!bangCongByMember[entry.ten]) {
        bangCongByMember[entry.ten] = {
          totalAcc: 0,
          totalMoney: 0,
          records: {},
        };
      }

      // Nếu ngày chưa tồn tại cho thành viên, khởi tạo
      if (!bangCongByMember[entry.ten].records[date]) {
        bangCongByMember[entry.ten].records[date] = {
          acc: 0,
          tinh_tien: 0,
        };
      }

      // Cộng dồn acc và tiền cho ngày và tổng
      bangCongByMember[entry.ten].records[date].acc += entry.acc;
      bangCongByMember[entry.ten].records[date].tinh_tien += entry.tinh_tien;
      bangCongByMember[entry.ten].totalAcc += entry.acc;
      bangCongByMember[entry.ten].totalMoney += entry.tinh_tien;
    });

    // Tạo thông báo kết quả
    let responseMessage = `BẢNG CÔNG NHÓM "LAN LAN 19H" TỔNG HỢP\n\n`;
    let totalMoney = 0;

    // Duyệt qua từng thành viên để hiển thị thông tin
    Object.keys(bangCongByMember).forEach(ten => {
      const member = bangCongByMember[ten];
      responseMessage += `${ten}:\n`;

      // Hiển thị bảng công phân theo ngày
      Object.keys(member.records).forEach(date => {
        const record = member.records[date];
        responseMessage += `  Ngày ${date}: ${record.acc} Acc - ${record.tinh_tien.toLocaleString()} VNĐ\n`;
      });

      responseMessage += `  Tổng Acc: ${member.totalAcc} - Tổng tiền: ${member.totalMoney.toLocaleString()} VNĐ\n\n`;
      totalMoney += member.totalMoney;
    });

    responseMessage += `TỔNG TIỀN CẢ NHÓM: ${totalMoney.toLocaleString()} VNĐ`;

    bot.sendMessage(chatId, responseMessage);
  });
};
