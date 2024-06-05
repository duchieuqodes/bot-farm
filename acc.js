// acc.js
const { bot, BangCong2} = require('./index'); // Import các module cần thiết

const accRegex = /xong\s*\d+\s*acc/i;

async function processAccMessage(bot, msg) {
  const messageContent = msg.text || msg.caption;
  const accMatches = messageContent.match(accRegex);
  const userId = msg.from.id;
  const groupId = msg.chat.id;

  let acc = 0;

  if (accMatches) {
    accMatches.forEach((match) => {
      const number = parseInt(match.match(/\d+/)[0]); // Lấy số acc
      acc += number; // Thêm vào số acc
    });
  }

  const currentDate = new Date().toLocaleDateString();
  const firstName = msg.from.first_name;
  const lastName = msg.from.last_name;
  const fullName = lastName ? `${firstName} ${lastName}` : firstName;

  let totalMoney = acc * 5000; // Tính tiền cho số Acc

  const responseMessage = `Bài nộp của ${fullName} đã được ghi nhận với ${acc} Acc đang chờ kiểm tra ❤🥳`;

  bot.sendMessage(groupId, responseMessage, { reply_to_message_id: msg.message_id }).then(async () => {
    let bangCong = await BangCong2.findOne({ userId, groupId, date: currentDate });

    if (!bangCong) {
      bangCong = await BangCong2.create({
        userId,
        groupId,
        date: currentDate,
        ten: fullName,
        acc,
        tinh_tien: totalMoney,
      });
    } else {
      bangCong.acc += acc;
      bangCong.tinh_tien += totalMoney;
      await bangCong.save();
    }

    });
}



module.exports = {
  processAccMessage
};
