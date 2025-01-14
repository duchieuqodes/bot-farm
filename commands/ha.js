const mongoose = require('mongoose');

// Import model Trasua
const Trasua = mongoose.model('Trasua');

module.exports = (bot) => {
    bot.onText(/\/ha(homnay|homqua)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const command = match[1];

        let targetDate = new Date();
        let dateLabel = '';

        if (command === 'homqua') {
            targetDate.setDate(targetDate.getDate() - 1);
            dateLabel = 'HÔM QUA';
        } else if (command === 'homnay') {
            dateLabel = 'HÔM NAY';
        }

        const formattedDate = targetDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

        const groupIds = [-1002247863313, -1002303292016];
        const groupNames = {
            "-1002247863313": "NHÓM HÀ 11H30 -14H-19H30-21H:",
            "-1002303292016": "NHÓM HÀ 11H30, 19H30:"
        };

        let responseMessage = `BẢNG CÔNG ${dateLabel} - ${formattedDate}\n\n`;
        let hasData = false;

        for (const groupId of groupIds) {
            const bangCongList = await Trasua.find({ groupId: groupId, date: targetDate.toLocaleDateString() });
            
            if (bangCongList.length > 0) {
                hasData = true;
                responseMessage += `${groupNames[groupId.toString()]}\n`;
                let totalMoney = 0;

                bangCongList.forEach(entry => {
                    responseMessage += `${entry.ten}: ${entry.acc} Acc ${entry.tinh_tien.toLocaleString()} VNĐ\n`;
                    totalMoney += entry.tinh_tien;
                });

                responseMessage += `Tổng tiền: ${totalMoney.toLocaleString()} VNĐ\n\n`;
            }
        }

        if (!hasData) {
            bot.sendMessage(chatId, `Chưa có bảng công nào được ghi nhận trong ${dateLabel.toLowerCase()}.`);
        } else {
            bot.sendMessage(chatId, responseMessage);
        }
    });
};
