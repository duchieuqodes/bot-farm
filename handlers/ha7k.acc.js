const mongoose = require('mongoose');

// Import model Trasua
const Trasua = mongoose.model('Trasua');

const accRegex8 = /xong.*?(\d+).*?acc/i;

async function processAccMessage8(msg, bot) {
    const messageContent = msg.text || msg.caption;
    const accMatches = messageContent.match(accRegex8);
    const userId = msg.from.id;
    const groupId = msg.chat.id;

    let acc = 0;

    if (accMatches) {
        acc = parseInt(accMatches[1]);
    }

    if (acc > 30) {
        bot.sendMessage(groupId, 'Nào, Nghịch linh tinh là xấu tính 😕', { reply_to_message_id: msg.message_id });
        return;
    }

    const currentDate = new Date().toLocaleDateString();
    const firstName = msg.from.first_name;
    const lastName = msg.from.last_name;
    const fullName = lastName ? `${firstName} ${lastName}` : firstName;

    let totalMoney = acc * 7000;

    const responseMessage = `Bài nộp của ${fullName} đã được ghi nhận với ${acc} Acc đang chờ kiểm tra ❤🥳, tổng tiền: +${totalMoney} VND`;

    bot.sendMessage(groupId, responseMessage, { reply_to_message_id: msg.message_id }).then(async () => {
        let trasua = await Trasua.findOne({ userId, groupId, date: currentDate });

        if (!trasua) {
            trasua = await Trasua.create({
                userId,
                groupId,
                date: currentDate,
                ten: fullName,
                acc,
                tinh_tien: totalMoney,
            });
        } else {
            trasua.acc += acc;
            trasua.tinh_tien += totalMoney;
            await trasua.save();
        }
    });
}

module.exports = (bot) => {
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;

        if (chatId == -1002247863313) {
            const messageContent = msg.text || msg.caption;
            if (messageContent && accRegex8.test(messageContent)) {
                await processAccMessage8(msg, bot);
            }
        }
    });
};
