const mongoose = require('mongoose');

// Kết nối tới MongoDB
mongoose.connect(
  'mongodb+srv://duchieufaryoung0:80E9gUahdOXmGKuy@cluster0.6nlv1cv.mongodb.net/telegram_bot_db?retryWrites=true&w=majority',
  { useNewUrlParser: true, useUnifiedTopology: true }
);
const db = mongoose.connection;

// Định nghĩa schema cho tin nhắn chứa từ khóa
const MessageSchema = new mongoose.Schema({
  userId: Number,
  groupId: Number,
  date: String,
  keyword: String,
});

const Message = mongoose.model('Message', MessageSchema);

const keywordRegex = /(ca\s?1|Ca\s?1|C\s?1|c\s?1|ca1|Ca1|C1|c1|ca\s?2|Ca\s?2|C\s?2|c\s?2|ca2|Ca2|C2|c2)\s*/gi;
const warningGroupId = -1002103270166;

function normalizeKeyword(keyword) {
  if (/ca\s?1|Ca\s?1|C\s?1|c\s?1|ca1|Ca1|C1|c1/gi.test(keyword)) {
    return 'Ca 1';
  } else if (/ca\s?2|Ca\s?2|C\s?2|c\s?2|ca2|Ca2|C2|c2/gi.test(keyword)) {
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

  if (keywordRegex.test(messageText)) {
    const currentDate = new Date().toLocaleDateString();

    const keywords = messageText.match(keywordRegex);

    for (const rawKeyword of keywords) {
      const keyword = normalizeKeyword(rawKeyword);
      await Message.create({ userId, groupId: chatId, date: currentDate, keyword });

      const messageCount = await Message.countDocuments({ userId, groupId: chatId, date: currentDate, keyword });

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
  await Message.deleteMany({});
}

module.exports = {
  handleMessage,
  resetKeywords,
};
