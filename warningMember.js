const groups = {
  "-1002039100507": "BẢNG CÔNG NHÓM CỘNG ĐỒNG NẮM BẮT CƠ HỘI",
  "-1002004082575": "BẢNG CÔNG NHÓM HỘI NHÓM",
  "-1002123430691": "BẢNG CÔNG NHÓM DẪN LỐI THÀNH CÔNG",
  "-1002143712364": "BẢNG CÔNG NHÓM CÙNG NHAU CHIA SẺ",
  "-1002128975957": "BẢNG CÔNG NHÓM HƯỚNG TỚI TƯƠNG LAI",
  "-1002080535296": "BẢNG CÔNG NHÓM TRAO ĐỔI CÔNG VIỆC 2",
  "-1002091101362": "BẢNG CÔNG NHÓM TRAO ĐỔI CÔNG VIỆC 1", 
  "-1002129896837": "BẢNG CÔNG NHÓM GROUP I MẠNH ĐỨC CHIA SẺ", 
  "-1002228252389": "BẢNG CÔNG NHÓM OMARKET Comunity", 
};

const mongoose = require('mongoose');

// Kết nối tới MongoDB
mongoose.connect(
  'mongodb+srv://duchieufaryoung0:80E9gUahdOXmGKuy@cluster0.6nlv1cv.mongodb.net/telegram_bot_db?retryWrites=true&w=majority',
  { useNewUrlParser: true, useUnifiedTopology: true }
);
const db = mongoose.connection;

// Định nghĩa schema cho tin nhắn chứa từ khóa
const WarningSchema = new mongoose.Schema({
  userId: Number,
  groupId: Number,
  date: String,
  keyword: String,
});

const Warning = mongoose.model('Warning', WarningSchema);

const keywordRegex = /\b(ca\s?1|c\s?1|ca\s?2|c\s?2)\b/gi;
const warningGroupId = -1002103270166;

function normalizeKeyword(keyword) {
  const lowerKeyword = keyword.toLowerCase().replace(/\s+/g, '');
  if (lowerKeyword === 'ca1' || lowerKeyword === 'c1') {
    return 'Ca 1';
  } else if (lowerKeyword === 'ca2' || lowerKeyword === 'c2') {
    return 'Ca 2';
  }
  return keyword;
}

const getMention = (user) => {
  if (user.username) {
    return `@${user.username}`;
  } else {
    const name = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
    return `[${name}](tg://user?id=${user.id})`;
  }
};

async function handleMessage(bot, msg, groupNames) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userName = getMention(msg.from);
  const messageText = msg.text;

  if (groups.hasOwnProperty(chatId) && keywordRegex.test(messageText)) {
    const currentDate = new Date().toLocaleDateString();

    const keywords = messageText.match(keywordRegex);

    for (const rawKeyword of keywords) {
      const keyword = normalizeKeyword(rawKeyword);
      await Warning.create({ userId, groupId: chatId, date: currentDate, keyword });

      const messageCount = await Warning.countDocuments({ userId, groupId: chatId, date: currentDate, keyword });

      if (messageCount > 1) {
        const groupName = groupNames[chatId] || `nhóm ${chatId}`;
        const warningMessage = `${userName} đã nộp ${keyword} quá 1 lần trong nhóm ${groupName} hôm nay, bạn vui lòng nộp cẩn thận hơn nhé`;

        bot.sendMessage(warningGroupId, warningMessage, { parse_mode: 'Markdown' });
        break;
      }
    }
  }
}

async function resetKeywords() {
  await Warning.deleteMany({});
}

module.exports = {
  handleMessage,
  resetKeywords,
};
