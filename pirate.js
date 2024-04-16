const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");


mongoose.connect('mongodb+srv://duchieufaryoung0:80E9gUahdOXmGKuy@cluster0.6nlv1cv.mongodb.net/telegram_bot_db?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });

const accountSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true },
  username: String,
  gold: Number,
  specialGemCount: Number,
  spinCount: Number,
  robberyCount: Number,
  level: Number,
  exp: Number,
  islandImage: String,
  lastSpecialSpinTime: Date,
  lastRobberyTime: { type: Date, default: null },
  islandUpgradeCount: {
    type: Number,
    default: 0,
  },
  currentIslandImageUrl: {
    type: String,
    default: 'default-island-url',
  },
});

const bot = new TelegramBot('', {
  polling: true,
  request: {
    prefer_authorize: 'never',
    preferred_language: 'vi',
  },
});


const Account = mongoose.model('Account', accountSchema);



bot.onText(/Đảo cướp biển/, async (msg) => {
  const userId = msg.from.id;
  let account = await Account.findOne({ userId });

  if (!account) {
    account = new Account({
      userId,
      username: msg.from.username,
      gold: 100000,
      specialGemCount: 0,
      spinCount: 10,
      robberyCount: 5,
      level: 1,
      exp: 0,
      islandImage: 'https://img.upanh.tv/2023/11/23/Cap0.jpg',
    });

    await account.save();
  }

  bot.sendMessage(msg.chat.id, `Chào mừng, ${msg.from.first_name}!`, {
    reply_markup: {
      keyboard: [
        [{ text: 'Đảo Của Bạn 🏝️' }], [{ text: 'Quay Thưởng 🎰' }, { text: 'Vòng Quay Đặc Biệt 🃏' }],
        [{ text: 'Nâng Cấp Hòn Đảo 🚀' }], [{ text: 'Đi Cướp Biển ☠️' }],[{ text: 'Quay lại'}],
      ],
      resize_keyboard: true,
    },
  });
});

// Xử lý khi nhấn vào nút reply keyboard Quản lý người dùng
bot.onText(/Quản lý người dùng/, async (msg) => {
  const adminUsername = 'duchieu287'; // Replace with the actual admin username

  if (msg.from.username === adminUsername) {
    const totalAccounts = await Account.countDocuments();
    const totalSpecialGems = await Account.aggregate([{ $group: { _id: null, total: { $sum: "$specialGemCount" } } }]);

    const replyMessage = `
      Tổng số tài khoản hiện tại: ${totalAccounts}
      Tổng số Ngọc Biển Huyền Bí: ${totalSpecialGems.length > 0 ? totalSpecialGems[0].total : 0}
    `;

    bot.sendMessage(msg.chat.id, replyMessage);
  } else {
    bot.sendMessage(msg.chat.id, 'Bạn không có quyền truy cập vào quản lý người dùng.');
  }
});


bot.onText(/Đảo Của Bạn/, async (msg) => {
  const userId = msg.from.id;
  const account = await Account.findOne({ userId });

  if (account) {
    bot.sendPhoto(msg.chat.id, account.islandImage, {
      caption: `
        Thông tin đảo của bạn:
        Tặc danh: ${account.username} 🧑
        Số Vàng: ${account.gold} Vàng 🌕
        Ngọc Biển Huyền Bí: ${account.specialGemCount} Viên🔮
        Số lượt quay thưởng: ${account.spinCount} 🔄
        Số lượt cướp đảo: ${account.robberyCount} ☠️
        Level: ${account.level} 🎚️
        Exp: ${account.exp} 🌟
            `,
    });
  } else {
    bot.sendMessage(msg.chat.id, 'Tài khoản không tồn tại.');
  }
});

// Add your other handlers here...

// Xử lý khi nhấn vào nút reply keyboard Quay Thưởng
let spinInProgress = false;

bot.onText(/Quay Thưởng/, async (msg) => {
  const userId = msg.from.id;
  let account = await Account.findOne({ userId });
  const spinImage = 'https://img.upanh.tv/2023/11/25/Spin2.gif';

  // Kiểm tra nếu quay thưởng đang diễn ra, không phản hồi và xóa tin nhắn "Quay Thưởng" mới
  if (spinInProgress) {
    bot.deleteMessage(msg.chat.id, msg.message_id);
    return;
  }

  if (account && account.spinCount > 0) {

    // Gửi ảnh GIF bằng hàm sendDocument và lấy message ID
    const spinMessage = await bot.sendDocument(msg.chat.id, spinImage, { caption: 'Đang quay thưởng...' });
    const spinMessageId = spinMessage.message_id;

    // Đặt cờ báo hiệu đang quay thưởng
    spinInProgress = true;

    // Giảm số lượt quay và lưu vào database
    account.spinCount--;
    await account.save();

    setTimeout(async () => {

      // Tính xác suất thưởng 
      const randomNumber = Math.random() * 100;
      let reward;

      if (randomNumber < 60) {
        // 60% vàng từ 2000 đến 30000 vàng
        const goldAmount = Math.floor(Math.random() * (30000 - 2000 + 1)) + 2000;
        account.gold += goldAmount;
        reward = `Bạn đã nhận được ${goldAmount} 🌕 vàng!`;
      } else if (randomNumber < 80) {
        // 20% exp từ 2 đến 12 exp
        const expAmount = Math.floor(Math.random() * (12 - 2 + 1)) + 2;
        account.exp += expAmount;
        reward = `Bạn đã nhận được ${expAmount}  🌟 exp!`;
      } else if (randomNumber < 90) {
        // 10% số lượt quay từ 1 đến 5
        const spinAmount = Math.floor(Math.random() * (5 - 1 + 1)) + 1;
        account.spinCount += spinAmount;
        reward = `Bạn đã nhận được thêm ${spinAmount} lượt quay thưởng! 🎰`;
      } else {
        // 10% số lượt cướp đảo là 1
        account.robberyCount += 1;
        reward = 'Bạn nhận được thêm 1 lượt cướp đảo! ☠️';
      }

      // Lưu lại thông tin tài khoản
      await account.save();

      // Hiển thị thông điệp thưởng
      bot.sendMessage(msg.chat.id, reward);
      // Xóa tin nhắn ảnh GIF sau khi hiển thị kết quả
      bot.deleteMessage(msg.chat.id, spinMessageId);
      // Reset cờ báo hiệu đã kết thúc quay thưởng
      spinInProgress = false;

    }, 3500);
  } else if (account && account.spinCount === 0) {
    bot.sendMessage(msg.chat.id, '🚫 Bạn đã hết lượt quay thưởng. Vào Vòng Quay Đặc Biệt để có thể nhận thêm lượt quay');
  } else {
    bot.sendMessage(msg.chat.id, 'Tài khoản không tồn tại.');
  }
});

// Xử lý khi nhấn vào các nút khác trong reply_markup
bot.on('callback_query', (query) => {
  // Kiểm tra nếu đang quay thưởng, xóa tin nhắn và không phản hồi
  if (spinInProgress) {
    bot.deleteMessage(query.message.chat.id, query.message.message_id);
  } else {
    // Xử lý các nút callback_query khác nếu cần
    // ...
  }
});

// Xử lý khi nhấn vào các nút reply_markup Đảo Của Bạn, Nâng Cấp Hòn Đảo, Đi Cướp Biển
bot.onText(/Đảo Của Bạn|Nâng Cấp Hòn Đảo|Đi Cướp Biển/, (msg) => {
  // Kiểm tra nếu đang quay thưởng, xóa tin nhắn và không phản hồi
  if (spinInProgress) {
    bot.deleteMessage(msg.chat.id, msg.message_id);
  } else {
    // Xử lý các nút reply_markup khác nếu cần
    // ...
  }
});
// ...


// Xử lý khi nhấn vào nút reply keyboard Quay Thưởng
bot.onText(/Vòng Quay Đặc Biệt/, async (msg) => {
  const userId = msg.from.id;
  let account = await Account.findOne({ userId });
  const spinImage = 'https://img.upanh.tv/2023/11/25/Goldspin.gif';

  // Kiểm tra nếu quay thưởng đang diễn ra, không phản hồi và xóa tin nhắn mới
  if (spinInProgress) {
    bot.deleteMessage(msg.chat.id, msg.message_id);
    return;
  }

  if (account && account.spinCount > 0) {
    // Kiểm tra nếu đã quay vòng quay đặc biệt trong ngày
    const currentTime = new Date();
    const timeDiffInHours = account.lastSpecialSpinTime
      ? (currentTime - account.lastSpecialSpinTime) / (1000 * 60 * 60)
      : 24; // Set a default value of 24 hours if no previous record is found

    if (timeDiffInHours >= 24) {
      // Gửi ảnh GIF bằng hàm sendDocument và lấy message ID
      const spinMessage = await bot.sendDocument(msg.chat.id, spinImage, { caption: 'Đang quay thưởng...' });
      const spinMessageId = spinMessage.message_id;

      // Đặt cờ báo hiệu đang quay thưởng
      spinInProgress = true;

      // Giảm số lượt quay và lưu vào database
      account.spinCount--;
      account.lastSpecialSpinTime = currentTime;
      await account.save();

      // Đặt độ trễ 5 giây để hiển thị kết quả quay thưởng
      setTimeout(async () => {
        const isSpecialSpin = Math.random() <= 0.05; // 5% probability for a special spin
        let reward;

        if (isSpecialSpin) {
          // 5% có thể nhận được 200-400 số lượt quay thưởng
          const specialSpinAmount = Math.floor(Math.random() * (400 - 200 + 1)) + 200;
          account.spinCount += specialSpinAmount;
          reward = `Chúc mừng 🥳! Bạn nhận được ${specialSpinAmount} số lượt quay thưởng.`;
        } else {
          // 95% nhận được 50-150 số lượt quay thưởng
          const normalSpinAmount = Math.floor(Math.random() * (150 - 50 + 1)) + 50;
          account.spinCount += normalSpinAmount;
          reward = `Chúc mừng 🥳! Bạn nhận được ${normalSpinAmount} số lượt quay thưởng.`;
        }

        // Lưu lại thông tin tài khoản
        await account.save();

        // Hiển thị thông điệp thưởng
        bot.sendMessage(msg.chat.id, reward);

        // Xóa tin nhắn ảnh GIF sau khi hiển thị kết quả
        bot.deleteMessage(msg.chat.id, spinMessageId);

        // Reset cờ báo hiệu đã kết thúc quay thưởng
        spinInProgress = false;
      }, 5000); // 5 seconds delay
    } else {
      // Thông báo nếu chưa hết thời gian chờ để quay vòng quay đặc biệt
      const remainingTime = Math.ceil(24 - timeDiffInHours);
      const formattedTime = remainingTime > 1 ? `${remainingTime} giờ` : '1 giờ';

      // Tạo nút Reply_markup cho việc xác nhận sử dụng Viên Ngọc Biển Thần Bí
      const replyMarkup = {
        reply_markup: {
          keyboard: [
            [{ text: 'Đồng ý' }],
            [{ text: 'Trở lại' }],
          ],
          resize_keyboard: true,
        },
      };

      // Gửi tin nhắn xác nhận
      bot.sendMessage(
        msg.chat.id,
        `Bạn đã hết lượt thưởng đặc biệt hôm nay, hãy chờ ${formattedTime} nữa để có thêm lượt quay miễn phí. Bạn có muốn sử dụng 46 Viên Ngọc Biển Huyền Bí 🔮 để quay ngay không? (Sử dụng 46 Viên Ngọc Biển 🔮 sẽ tăng x5 phần thưởng nhận được)`,
        replyMarkup
      );
    }
  } else if (account && account.spinCount === 0) {
    bot.sendMessage(msg.chat.id, 'Bạn đã hết lượt quay thưởng.');
  } else {
    bot.sendMessage(msg.chat.id, 'Tài khoản không tồn tại.');
  }
});

// Xử lý khi người dùng chọn "Đồng ý" hoặc "Quay về"
bot.onText(/Đồng ý|Trở lại/, async (msg, match) => {
  const userId = msg.from.id;
  const choice = match[0];

  if (choice === 'Đồng ý') {
    let account = await Account.findOne({ userId });

    if (account && account.specialGemCount >= 46) {
      // Trừ 46 viên ngọc biển thần bí
      account.specialGemCount -= 46;

      // Reset số giờ chờ quay thưởng đặc biệt
      account.lastSpecialSpinTime = new Date(0);

      // Lưu lại thông tin tài khoản
      await account.save();

      // Thực hiện quay thưởng đặc biệt
      const spinImage = 'https://img.upanh.tv/2023/11/25/Goldspin.gif';

      // Gửi ảnh GIF bằng hàm sendDocument và lấy message ID
      const spinMessage = await bot.sendDocument(msg.chat.id, spinImage, { caption: 'Đang quay thưởng đặc biệt...' });
      const spinMessageId = spinMessage.message_id;

      // Đặt cờ báo hiệu đang quay thưởng
      spinInProgress = true;

      // Đặt độ trễ 5 giây để hiển thị kết quả quay thưởng
      setTimeout(async () => {
        const isSpecialSpin = Math.random() <= 0.1; // 5% probability for a special spin
        let reward;

        if (isSpecialSpin) {
          // 5% có thể nhận được 200-400 số lượt quay thưởng
          const specialSpinAmount = Math.floor(Math.random() * (675 - 540 + 1)) + 540;
          account.spinCount += specialSpinAmount;
          reward = `Chúc mừng 🥳! Bạn nhận được ${specialSpinAmount} số lượt quay thưởng!`;
        } else {
          // 95% nhận được 50-150 số lượt quay thưởng
          const normalSpinAmount = Math.floor(Math.random() * (405 - 270 + 1)) + 270;
          account.spinCount += normalSpinAmount;
          reward = `Chúc mừng 🥳! bạn nhận được ${normalSpinAmount} số lượt quay thưởng.`;
        }

        // Lưu lại thông tin tài khoản
        await account.save();

        // Hiển thị thông điệp thưởng
        bot.sendMessage(msg.chat.id, reward);

        // Xóa tin nhắn ảnh GIF sau khi hiển thị kết quả
        bot.deleteMessage(msg.chat.id, spinMessageId);

        // Reset cờ báo hiệu đã kết thúc quay thưởng
        spinInProgress = false;
      }, 5000); // 5 seconds delay
    } else {
      bot.sendMessage(msg.chat.id, 'Bạn không đủ Ngọc Biển Huyền Bí 🔮 để thực hiện điều này. Hãy nạp thêm.');
    }
  } else if (choice === 'Quay về') {
    // Thực hiện xử lý khi người dùng chọn "Quay về"
    // ...
  }
});




const robbingStatus = {};
let selectedRobberUsername;

bot.onText(/Cướp Đảo Ngay của @(.+)/, async (msg, match) => {
  const userId = msg.from.id;
  const account = await Account.findOne({ userId });

  if (selectedRobberUsername && selectedRobberUsername === match[1]) {
    if (!robbingStatus[userId] && account && account.robberyCount > 0) {
      const currentTime = new Date();
      const lastRobberyTime = account.lastRobberyTime || new Date(0);
      const timeDiffInSeconds = (currentTime - lastRobberyTime) / 1000;

      if (timeDiffInSeconds >= 86400) {
        robbingStatus[userId] = true;

        const targetAccount = await Account.findOne({
          username: selectedRobberUsername,
          userId: { $ne: userId },
          gold: { $gt: 0 },
        });

        if (targetAccount) {
          const isHighAmount = Math.random() <= 0.1;
          const stolenAmount = isHighAmount
            ? Math.floor(Math.random() * (350000 - 200000 + 1)) + 200000
            : Math.floor(Math.random() * (140000 - 85000 + 1)) + 85000;

          targetAccount.gold -= stolenAmount;
          account.gold += stolenAmount;
          account.lastRobberyTime = currentTime;

          account.robberyCount--;

          await targetAccount.save();
          await account.save();

          bot.sendPhoto(msg.chat.id, targetAccount.islandImage, {
            caption: ` ☠️ Bạn đã cướp thành công ${stolenAmount} vàng từ hòn đảo của @${selectedRobberUsername}!
                  Thông tin hòn đảo đã cướp:
                  Tặc Danh: ${selectedRobberUsername}
                  Số Vàng còn lại: ${targetAccount.gold} 🌕
                        
                       
                  Level: ${targetAccount.level} 
                  Exp: ${targetAccount.exp} 🌟
                    `,
          });

          const messageToVictim = `
Bạn vừa bị cướp ${stolenAmount} vàng bởi tặc danh ${account.username}!
                        Số Vàng hiện tại của bạn: ${targetAccount.gold}
`;

          bot.sendMessage(targetAccount.userId, messageToVictim);
        } else {
          bot.sendMessage(msg.chat.id, 'Hòn đảo ảo ảnh hoặc không thể cướp hòn đảo này.');
        }

        robbingStatus[userId] = false;
      } else {
        const remainingTime = 86400 - timeDiffInSeconds;
        bot.sendMessage(
          msg.chat.id,
          `🚫 Bạn đã cướp hòn đảo hôm nay, bạn chỉ có thể cướp một đảo một lần trong 24 tiếng. Vui lòng đợi ${remainingTime.toFixed(0)} giây.`
        );
      }
    } else if (account && account.robberyCount === 0) {
      bot.sendMessage(msg.chat.id, 'Bạn đã hết lượt cướp đảo.');
    }
  } else {
    bot.sendMessage(msg.chat.id, 'Bạn chỉ có thể cướp đảo đã tìm được.');
  }
});

// ...

// Function to generate the main menu keyboard
function generateMainMenuKeyboard() {
  return {
    keyboard: [
      [{ text: 'Đảo Của Bạn 🏝️' }], [{ text: 'Quay Thưởng 🎉' }, { text: 'Vòng Quay Đặc Biệt 🃏' }],
      [{ text: 'Nâng Cấp Hòn Đảo 🚀' }], [{ text: 'Đi Cướp Biển ☠️' }], [{text: 'Quay lại'}],
    ],
    resize_keyboard: true,
  };
}

bot.onText(/Đi Cướp Biển/, async (msg) => {
  selectedRobberUsername = '';
  const randomAccount = await Account.aggregate([
    { $match: { gold: { $gt: 0 } } },
    { $sample: { size: 1 } }
  ]);

  if (randomAccount.length > 0) {
    selectedRobberUsername = randomAccount[0].username;

    const keyboard = {
      reply_markup: {
        keyboard: [
          [{ text: `Cướp Đảo Ngay của @${selectedRobberUsername}` }],
          [{ text: 'Trở lại' }],
        ],

        resize_keyboard: true,
      },
    };

    bot.sendMessage(msg.chat.id, `Đã tìm thấy một hòn đảo @${selectedRobberUsername} để cướp.`, keyboard)
  } else {
    bot.sendMessage(msg.chat.id, 'Không tìm thấy tài khoản phù hợp để cướp vàng.');
  }
});

bot.onText(/Nâng Cấp Hòn Đảo/, async (msg) => {
  const userId = msg.from.id;
  const account = await Account.findOne({ userId });

  if (account) {
    const upgradeCost = calculateIslandUpgradeCost(account.islandUpgradeCount);

    const confirmMessage = `Bạn có muốn nâng cấp hòn đảo lên cấp ${account.islandUpgradeCount + 1} với số tiền là ${upgradeCost} vàng. Bạn có chắc chắn muốn nâng cấp không?`;
    const confirmOptions = {
      reply_markup: {
        keyboard: [
          [{ text: 'Xác nhận nâng cấp' }],
          [{ text: 'Trở lại' }],
        ],
        resize_keyboard: true,
      },
    };

    bot.sendMessage(msg.chat.id, confirmMessage, confirmOptions);

    bot.onText(/Xác nhận nâng cấp/, async (msg) => {
      if (account.gold >= upgradeCost) {
        account.gold -= upgradeCost;
        account.islandUpgradeCount++;

        if (account.islandUpgradeCount === 1) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap1.jpg';
        }
        if (account.islandUpgradeCount === 2) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap2.jpg';
        }
        if (account.islandUpgradeCount === 3) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap3.jpg';
        }
        if (account.islandUpgradeCount === 4) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap4.jpg';
        }
        if (account.islandUpgradeCount === 5) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap5.jpg';
        }
        if (account.islandUpgradeCount === 6) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap6.jpg';
        }
        if (account.islandUpgradeCount === 7) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap7.jpg';
        }
        if (account.islandUpgradeCount === 8) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap8.jpg';
        }
        if (account.islandUpgradeCount === 9) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap9.jpg';
        }
        if (account.islandUpgradeCount === 10) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap10.jpg';
        }
        if (account.islandUpgradeCount === 11) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap11.jpg';
        }
        if (account.islandUpgradeCount === 12) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap12.jpg';
        }
        if (account.islandUpgradeCount === 13) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap13 .jpg';
        }
        if (account.islandUpgradeCount === 14) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap14.jpg';
        }
        if (account.islandUpgradeCount === 15) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap15.jpg';
        }
        if (account.islandUpgradeCount === 16) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap19.jpg';
        }
        if (account.islandUpgradeCount === 19) {
          account.islandImage = 'https://img.upanh.tv/2023/11/23/Cap19.jpg';
        }
        else if
          (account.islandUpgradeCount === 20) {
          account.islandImage = 'https://example.com/your-island-image-url-2.jpg';
        }

        await account.save();

        const successMessage = `Bạn đã nâng cấp hòn đảo thành công lần thứ ${account.islandUpgradeCount}!`;
        bot.sendMessage(msg.chat.id, successMessage);

        bot.removeTextListener(/Xác nhận nâng cấp/);
      } else {
        const errorMessage = 'Bạn không đủ vàng để nâng cấp hòn đảo.';
        bot.sendMessage(msg.chat.id, errorMessage);

        bot.removeTextListener(/Xác nhận nâng cấp/);
      }
    });
  } else {
    bot.sendMessage(msg.chat.id, 'Tài khoản không tồn tại.');
  }
});
// Xử lý khi nhấn vào nút Quay Lại
bot.onText(/Trở lại/, async (msg) => {
  const currentTime = new Date();
  const currentHour = currentTime.getHours() + 7;
  let greetingMessage;

  let imageUrl;

  if (currentHour >= 6 && currentHour < 18) {
    const morningGreetings = [
      'Ban ngày là lúc tốt nhất để khai thác tài nguyên trên hòn đảo. Hãy kiểm tra mỏ và bạn sẽ tìm thấy nhiều điều bất ngờ!',
      'Mỗi buổi sáng, tôi tìm kiếm cảm hứng từ bức tranh tuyệt vời của biển cả và bắt đầu một ngày mới tràn đầy năng lượng',
      'Ban ngày là thời điểm chúng ta cần tăng cường an ninh. Ai cũng phải bảo vệ hòn đảo của mình!',
      'Cửa hàng của tôi đang mở cửa, hãy ghé nếu bạn muốn nâng cấp hòn đảo của mình.',
      'Nhìn xa ra biển cả buổi sáng làm bạn cảm thấy như đang đối diện với những cuộc phiêu lưu mới.',
      // Thêm các lời chào buổi sáng khác vào đây
    ];
    greetingMessage = morningGreetings[Math.floor(Math.random() * morningGreetings.length)];
    // Nếu là giờ từ 6h đến 18h, sử dụng hàm sendPhoto để hiển thị hình ảnh url 1
    imageUrl = 'https://img.upanh.tv/2023/11/25/Ngay1.gif'; // Thay thế bằng URL thực tế của hình ảnh
    bot.sendDocument(msg.chat.id, imageUrl, { caption: 'Chào buổi sáng, thủy thủ! Bạn đã kiểm tra kho báu của mình chưa?' });
  } else {

    const eveningGreetings = [
      'Dưới ánh đèn trăng, hãy ngồi lại và kể cho tôi nghe những câu chuyện về những thời kỳ huyền bí của biển cả.',
      'Buổi tối là lúc cá biển trở nên tĩnh lặng và nguy hiểm hơn', 'Khi bóng đêm bao trùm, tôi tiếp tục công việc mỏ của mình. Càng tối, càng ít người để quấy rối.', 'Buổi tối là thời gian tuyệt vời để mua sắm. Cửa hàng của ta đang có những ưu đãi đặc biệt đó', 'Dưới bóng tối, hãy cẩn thận, những câu chuyện về hồn ma trên biển cả có thể là có thật',
      // Thêm các lời chào buổi tối khác vào đây
    ];
    greetingMessage = eveningGreetings[Math.floor(Math.random() * eveningGreetings.length)];
    // Nếu không phải giờ từ 6h đến 18h, sử dụng hàm sendDocument để hiển thị hình ảnh gif từ URL khác
    imageUrl = 'https://img.upanh.tv/2023/11/24/dem.gif'; // Thay thế bằng URL thực tế của hình ảnh gif
    bot.sendDocument(msg.chat.id, imageUrl, { caption: 'Dưới ánh trăng, biển cả trở nên yên bình, nhưng có những bí mật đen tối...' });
  }
  // Gửi lời chào tương ứng

  bot.sendMessage(msg.chat.id, greetingMessage, { reply_markup: generateMainMenuKeyboard() });
});

function calculateIslandUpgradeCost(upgradeCount) {
  const initialCost = 120000;
  const additionalCostPercentage = 0.18;
  return Math.floor(initialCost * Math.pow(1 + additionalCostPercentage, upgradeCount));
}
