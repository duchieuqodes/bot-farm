const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = '6748384489:AAGV42T0PoOel_1519X5ot_rLLnpQqqDTdA';
const bot = new TelegramBot(token, { polling: true });

// Đường dẫn tới file lưu trữ dữ liệu
const dataFilePath = 'members_photos.json';

// Load dữ liệu từ file
let membersPhotos = {};
if (fs.existsSync(dataFilePath)) {
    membersPhotos = JSON.parse(fs.readFileSync(dataFilePath));
}

// Chuỗi cấm
const bannedStringsRegex = /(ca\s?1|ca1|ca\s?2|Ca\s?2|Ca\s?1|Ca1|Ca\s?2|Ca2)/gi;

// Lưu trữ tin nhắn chứa hình ảnh của từng thành viên
let photoMessages = {};

// Đối tượng lưu trữ thông tin của mỗi thành viên trong nhóm
const memberInfo = {};

// Lời chào và URL hình ảnh
const greetingMessage = "Chào các cậu, tớ là Isadora đây 🐷, tớ là AI trợ lý của anh Hieu Gà 🐔, tớ sẽ là người quản lý bài nộp của mọi người nhé! 👩‍🎤";
const imageUrl = "https://iili.io/Jvt7fTP.png";

// Lắng nghe sự kiện khi nhận lệnh /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    // Gửi lời chào và URL hình ảnh vào nhóm
    bot.sendMessage(chatId, greetingMessage);
    bot.sendPhoto(chatId, imageUrl);
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    // Kiểm tra nếu tin nhắn chứa ảnh
    if (msg.photo) {
        const userId = msg.from.id;

        // Lưu tin nhắn gửi hình ảnh của thành viên
        photoMessages[userId] = photoMessages[userId] || [];
        photoMessages[userId].push({ messageId: msg.message_id, date: msg.date });

        // Tăng số ảnh đã gửi của thành viên
        membersPhotos[userId] = (membersPhotos[userId] || 0) + 1;

        // Lưu dữ liệu vào file
        fs.writeFileSync(dataFilePath, JSON.stringify(membersPhotos));
                                    
// Reset tổng số ảnh của thành viên sau 10 giây
        setTimeout(() => {
            membersPhotos[userId] = 0;
            fs.writeFileSync(dataFilePath, JSON.stringify(membersPhotos));
        }, 60000); // 10 giây
    }

    // Kiểm tra nếu tin nhắn chứa chuỗi cấm
    if (msg.text && bannedStringsRegex.test(msg.text)) {
        bot.sendMessage(chatId, 'Mình đang kiểm tra bài nộp của bạn... chờ chút 🐷 z zz', { reply_to_message_id: msg.message_id }).then(() => {
            setTimeout(() => {
                const matches = msg.text.match(bannedStringsRegex);
                if (matches) {
                    let sum = 0;
                    matches.forEach(match => {
                        const index = msg.text.indexOf(match);
                        const numbersAfterMatch = msg.text.substring(index + match.length).match(/\d+/g);
                        if (numbersAfterMatch) {
                            sum += numbersAfterMatch.reduce((acc, cur) => acc + parseInt(cur), 0);
                        }
                    });

const userId = msg.from.id;
                    const userPhotoCount = membersPhotos[userId] || 0;

                    if (sum === userPhotoCount) {
                        bot.sendMessage(chatId, 'Bài nộp hợp lệ, đã ghi nhận vào bảng công ❤🥳', { reply_to_message_id: msg.message_id });
                    } else {
                        bot.sendMessage(chatId, 'Bài nộp không hợp lệ 😭 có thể do đếm sai số lượng quẩy hoặc nộp sai quy định 🥺, bài nộp của bạn đã bị gỡ hãy kiểm tra và nộp lại! 🤧🐵', { reply_to_message_id: msg.message_id }).then(() => {
                            // Xóa tất cả các tin nhắn chứa hình ảnh được gửi trong 20 giây trở lại đây của thành viên
                            if (photoMessages[userId] && photoMessages[userId].length > 0) {
                                const currentTime = Math.floor(Date.now() / 1000);
                                const twentySecondsAgo = currentTime - 20;
                                const recentPhotoMessages = photoMessages[userId].filter(message => message.date >= twentySecondsAgo);
                                recentPhotoMessages.forEach(message => {
                                    bot.deleteMessage(chatId, message.messageId);
                                });
                            }
                        });
                    }
                }
            }, 5000); // 5 giây
        });
    }

    // Kiểm tra nếu tin nhắn chứa các từ gửi lời chào
    if (msg.text && /(Chào bot|Chào chị|Chào isadora|Isadora|Cậu xinh quá|Hi isadora|Chào em|Xinh thế)/i.test(msg.text)) {
        bot.sendMessage(chatId, greetingMessage, { reply_to_message_id: msg.message_id });
    }

    // Kiểm tra nếu có ai đó trích dẫn tin nhắn gốc của bot
    if (msg.reply_to_message && msg.reply_to_message.from.username === 'Trolyaihieuga_bot') {
        bot.sendMessage(chatId, "Tớ ko hiểu 🥺, tớ chỉ là AI được anh Hieu Gà đào tạo để quản lý bài nộp của mọi người 😊. Hi vọng tương lai tớ sẽ biết nhiều thứ hơn 🤯", { reply_to_message_id: msg.message_id });
    }
});

// Lệnh để bot trả về thông tin của mỗi thành viên trong nhóm
bot.onText(/\/member_info/, (msg) => {
    const chatId = msg.chat.id;
    let response = '';

    response += `Bảng công ngày hôm nay (${new Date().toLocaleDateString()}):\n`;
    response += 'Họ tên|\t\t|Quẩy|\t|Cộng|\t|Tính tiền\n';

    for (const userId in memberInfo) {
        for (const date in memberInfo[userId]) {
            const info = memberInfo[userId][date];
            response += `${info['ten']}\t\t${info['quay']}q +\t${info['keo']}c\t${info['tinh_tien']}vnđ\n`;
        }
    }

    if (response === '') {
        response = 'Chưa có số nào được gửi trong nhóm.';
    }

    bot.sendMessage(chatId, response);
});

// Lệnh để tính toán bảng công theo ngày mà người dùng yêu cầu
bot.onText(/\/bc(\d{1,2})?\/(\d{1,2})?\/(\d{4})?/, (msg, match) => {
    const chatId = msg.chat.id;
    const requestedDate = match[0] ? new Date(`${match[3] || new Date().getFullYear()}-${match[2] || (new Date().getMonth() + 1)}-${match[1] || new Date().getDate()}`).toLocaleDateString() : new Date().toLocaleDateString();

    let response = `Bảng công ngày ${requestedDate}:\n`;
    response += 'Họ tên\t\tQuẩy\tKéo\tTính tiền\n';

    let found = false;
    for (const userId in memberInfo) {
        for (const date in memberInfo[userId]) {
            if (date === requestedDate) {
                const info = memberInfo[userId][date];
                response += `${info['ten']}\t\t${info['quay']}q +\t${info['keo']}c\t${info['tinh_tien']}vnđ\n`;
                found = true;
            }
        }
    }

    if (!found) {
        response = 'Không có dữ liệu cho ngày này.';
    }

    bot.sendMessage(chatId, response);
});

