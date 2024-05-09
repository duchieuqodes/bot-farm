const RSSParser = require('rss-parser');
const schedule = require('node-schedule');

const parser = new RSSParser();

// Danh sách các nguồn RSS
const rssFeeds = [
  'https://vnexpress.net/rss/gia-dinh.rss',
  'https://baotintuc.vn/xa-hoi.rss',
  'https://nld.com.vn/rss/giai-tri.rss',
];

// Hàm để chọn ngẫu nhiên một nguồn RSS
function getRandomRSSFeed() {
  const randomIndex = Math.floor(Math.random() * rssFeeds.length);
  return rssFeeds[randomIndex];
}

// Hàm để gửi mô tả bài viết mới nhất từ một nguồn RSS
async function sendLatestNews(bot, chatId) {
  try {
    const randomFeed = getRandomRSSFeed();
    const feed = await parser.parseURL(randomFeed);

    if (feed.items.length > 0) {
      const latestNews = feed.items[0];
      const description = latestNews.contentSnippet || latestNews.description;

      bot.sendMessage(chatId, description);
    } else {
      bot.sendMessage(chatId, 'Không tìm thấy tin tức nào.');
    }
  } catch (error) {
    console.error('Lỗi khi lấy RSS:', error);
    bot.sendMessage(chatId, 'Có lỗi khi lấy tin tức. Hãy thử lại sau.');
  }
}

// Thiết lập lịch trình gửi tin nhắn
function setupNewsSchedule(bot, chatId) {
  // Giờ được tính theo múi giờ GMT+7 (Giờ Việt Nam)
  const times = [
    '0 0 0 * * *',  // 7h00 (GMT+7)
    '0 0 9 * * *',  // 16h00 (GMT+7)
    '0 0 14 * * *', // 21h00 (GMT+7)
  ];

  times.forEach(time => {
    schedule.scheduleJob(time, () => {
      sendLatestNews(bot, chatId);
    });
  });
}

// Xuất các hàm để sử dụng trong tệp khác
module.exports = {
  sendLatestNews,
  setupNewsSchedule,
};
