const cron = require('node-cron');

// Danh sách các câu chào buổi sáng ngẫu nhiên
const morningGreetings = [
  "Chào buổi sáng! Ai muốn nhận quà?",
  "Buổi sáng tốt lành! Ai sẽ là người may mắn hôm nay?",
  "Chúc buổi sáng vui vẻ! Ai muốn thử vận may?",
  "Sáng nay thật tuyệt! Ai muốn nhận quà?",
  "Chúc mọi người một buổi sáng tươi sáng! Ai sẽ nhận quà hôm nay?",
];

// Đặt lại trạng thái hàng ngày
function resetDailyGiftStatus(DailyGiftStatus) {
  cron.schedule(
    '49 0 * * *',
    async () => {
      await DailyGiftStatus.updateMany(
        {}, 
        { $set: { dailyGiftClaims: [], giftWonToday: false } }
      );
    },
    {
      timezone: 'Asia/Ho_Chi_Minh',
    }
  );
}

// Gửi tin nhắn chào buổi sáng
function sendMorningMessage(bot) {
  const chatId = -1002128289933; // ID nhóm cần gửi tin nhắn

  cron.schedule(
    '50 0 * * *',
    () => {
      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: 'Nhận lộc may mắn hôm nay',
              callback_data: 'lucky_gift',
            },
          ],
        ],
      };

      const morningGreeting = morningGreetings[
        Math.floor(Math.random() * morningGreetings.length)
      ];

      bot.sendMessage(chatId, morningGreeting, {
        reply_markup: inlineKeyboard,
      });
    },
    {
      timezone: 'Asia/Ho_Chi_Minh',
    }
  );
}

// Xử lý khi người dùng nhận phần quà
async function handleGiftClaim(bot, callbackQuery, BangCong2, DailyGiftStatus) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const fullName = `${callbackQuery.from.first_name} ${callbackQuery.from.last_name || ''}`;

  const today = new Date().toLocaleDateString();

  // Truy xuất trạng thái từ MongoDB
  let dailyStatus = await DailyGiftStatus.findOne({ date: today });

  if (!dailyStatus) {
    dailyStatus = await DailyGiftStatus.create({
      date: today,
      dailyGiftClaims: [],
      giftWonToday: false,
    });
  }

  if (dailyStatus.dailyGiftClaims.includes(userId)) {
    bot.answerCallbackQuery(callbackQuery.id, {
      text: "Bạn đã thử nhận lộc hôm nay rồi!",
      show_alert: true,
    });
    return;
  }

  if (dailyStatus.giftWonToday) {
    bot.answerCallbackQuery(callbackQuery.id, {
      text: "Đã có người nhận được lộc hôm nay rồi, hãy thử vận may vào ngày mai.",
      show_alert: true,
    });
    return;
  }

  // Cập nhật trạng thái trong bộ nhớ và MongoDB
  dailyStatus.dailyGiftClaims.push(userId);

  const isWinner = Math.random() < 0.20;

  if (isWinner) {
    dailyStatus.giftWonToday = true;

    // Tạo số ngẫu nhiên từ 400 đến 1000
const randomAmount = 400 + Math.random() * (1000 - 400);

// Làm tròn đến hàng chục
const prize = Math.round(randomAmount / 10) * 10;


    bot.answerCallbackQuery(callbackQuery.id, {
      text: `Chúc mừng! Bạn đã trúng lộc ${prize}vnđ 🎉`,
      show_alert: true,
    });

    await BangCong2.create({
      userId,
      groupId: chatId,
      date: today,
      ten: fullName,
      giftWon: true,
      prizeAmount: prize,
    });

    await dailyStatus.save(); // Lưu trạng thái cập nhật

    bot.sendMessage(chatId, `Chúc mừng ${fullName} đã nhận được lộc may mắn hôm nay với ${prize}vnđ!`);
  } else {
    bot.answerCallbackQuery(callbackQuery.id, {
      text: "Rất tiếc! Bạn không trúng lộc hôm nay, hãy thử lại vào ngày mai.",
      show_alert: true,
    });
  }

  await dailyStatus.save(); // Đảm bảo trạng thái được lưu
}

module.exports = {
  resetDailyGiftStatus,
  sendMorningMessage,
  handleGiftClaim,
};
