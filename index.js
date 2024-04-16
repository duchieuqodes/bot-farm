const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const keep_alive = require('./keep_alive.js')

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

// Hàm gửi bảng công vào thời điểm cố định hàng ngày
function sendDailyReport() {
    const currentDate = new Date();
    const currentHour = currentDate.getUTCHours(); // Lấy giờ hiện tại theo múi giờ UTC
    const currentMinute = currentDate.getUTCMinutes(); // Lấy phút hiện tại theo múi giờ UTC

    // Kiểm tra xem có đến thời điểm gửi bảng công không (00:13 theo giờ Việt Nam)
    if (currentHour === 14 && currentMinute === 0) { // 17h13 theo múi giờ UTC tương đương 00h13 theo múi giờ Việt Nam
        const chatId = '-1002050799248'; // Thay thế bằng ID của nhóm muốn gửi bảng công

        let response = '';

        response += `Bảng Công Ngày ${new Date().toLocaleDateString()} (Cập nhật tự động):\n\n\n`;
        response += 'TÊN👩‍🎤|\t\tQUẨY💃|\tCỘNG➕|\tTIỀN💰\n\n';// Reset tổng số ảnh của thành viên sau 10 giây
        
    

        for (const userId in memberInfo) {
            for (const date in memberInfo[userId]) {
                const info = memberInfo[userId][date];
                response += `${info['ten']}\t\t\t${info['quay']}q +\t${info['keo']}c\t\t\t${info['tinh_tien']}vnđ\n`;
            }
        }

        if (response === '') {
            response = 'Chưa có số nào được gửi trong nhóm.';
        }

        bot.sendMessage(chatId, response);
    }
}

// Kiểm tra thời gian và gửi bảng công mỗi phút
setInterval(sendDailyReport, 60000); // Kiểm tra mỗi phút


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
        }, 30 * 60 * 1000); // 30 phút
    }

    // Kiểm tra nếu tin nhắn chứa chuỗi cấm
    if (msg.text && bannedStringsRegex.test(msg.text)) {
        bot.sendMessage(chatId, 'Mình đang kiểm tra bài nộp của bạn...đợi xíu 🐷z zz', { reply_to_message_id: msg.message_id }).then(() => {
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
                        bot.sendMessage(chatId, 'Bài nộp hợp lệ, đã ghi nhận vào bảng công ❤🥳', { reply_to_message_id: msg.message_id }).then(() => {
                        // Reset tổng số ảnh của thành viên
                        membersPhotos[userId] = 0;
                        fs.writeFileSync(dataFilePath, JSON.stringify(membersPhotos));
                    });
                    } else {
                        bot.sendMessage(chatId, 'Bài nộp không hợp lệ 😭 có thể do đếm sai số lượng quẩy hoặc sai cú pháp nộp 🥺, bài nộp của bạn đã bị gỡ hãy kiểm tra và nộp lại! 🤧🐵 (Cú pháp nộp hợp lệ "Số ca + số quẩy + số cộng" ví dụ: Ca1 5q 1c)', { reply_to_message_id: msg.message_id }).then(() => {
                            // Xóa tất cả các tin nhắn chứa hình ảnh được gửi trong 20 giây trở lại đây của thành viên
                            if (photoMessages[userId] && photoMessages[userId].length > 0) {
                                const currentTime = Math.floor(Date.now() / 1000);
                                const twentySecondsAgo = currentTime - 20;
                                const recentPhotoMessages = photoMessages[userId].filter(message => message.date >= twentySecondsAgo);
                                recentPhotoMessages.forEach(message => {
                                    bot.deleteMessage(chatId, message.messageId);
                                });
                            }
// Reset tổng số ảnh của thành viên
                        membersPhotos[userId] = 0;
                        fs.writeFileSync(dataFilePath, JSON.stringify(membersPhotos));
                        });
                    }
                }
            }, 5000); // 5 giây
        });
    }

// Kiểm tra nếu tin nhắn là lời chào và gửi URL hình ảnh vào nhóm
    if (msg.text === '/start') {
        bot.sendMessage(chatId, 'Chào các cậu, tớ là Isadora đây 🐷, tớ là AI trợ lý của anh Hieu Gà 🐔, tớ sẽ quản lý bài nộp giúp mọi người nhé! 👩‍🎤👋');
        const imageUrl = 'https://iili.io/Jvt7fTP.png'; // Thay đổi URL hình ảnh của bot ở đây
        bot.sendPhoto(chatId, imageUrl);
    }

    // Kiểm tra nếu tin nhắn của thành viên chứa các từ chào hỏi
    if (msg.text && /(chào bot|chào chị|chào isadora|Isadora)/i.test(msg.text)) {
        bot.sendMessage(chatId, 'Chào cậu, tớ là Isadora đây 🐷, tớ là AI trợ lý của anh Hieu Gà 🐔 , có gì khó khăn cứ nhắn tớ nhé! 👩‍🎤', { reply_to_message_id: msg.message_id });
    }

    // Kiểm tra nếu có ai đó trích dẫn tin nhắn gốc của bot
    if (msg.reply_to_message && msg.reply_to_message.from.username === 'Trolyaihieuga_bot') {
        bot.sendMessage(chatId, "Tớ ko hiểu 🥺, tớ chỉ là AI được anh Hieu Gà đào tạo để quản lý bài nộp của mọi người 😊. Hi vọng tương lai tớ sẽ biết nhiều thứ hơn 🤯", { reply_to_message_id: msg.message_id });
    }

  
    // Thêm code tính bảng công ở đây
    const userId = msg.from.id;
    const firstName = msg.from.first_name;
    const lastName = msg.from.last_name;
    const fullName = lastName ? `${firstName} ${lastName}` : firstName;
    const currentDate = new Date().toLocaleDateString(); // Lấy ngày hiện tại

    // Kiểm tra xem tin nhắn có chứa các chuỗi cấm hay không
    const containsBanStrings = /(ca\s?1|ca1|ca\s?2|Ca\s?2|Ca\s?1|Ca1|Ca\s?2|Ca2)/gi.test(msg.text);

    // Nếu tin nhắn không chứa các chuỗi cấm, không tính vào bảng công
    if (!containsBanStrings) {
        return;
    }

    // Loại bỏ các số ngay sau chuỗi cấm
    const numbers = msg.text.replace(/(ca\s?1|ca1|ca\s?2|Ca\s?2|Ca\s?1|Ca1|Ca\s?2|Ca2)\s*/gi, '').match(/\d+/g);

    if (numbers) {
        const sum = numbers.reduce((acc, num) => acc + parseInt(num), 0);

        // Tính quẩy và kéo
        const quay = numbers.filter(num => num > sum / 2).reduce((acc, num) => acc + parseInt(num), 0);
        const keo = sum - quay;

        // Lưu thông tin vào memberInfo
        if (!memberInfo[userId]) {
            memberInfo[userId] = {};
        }

        if (!memberInfo[userId][currentDate]) {
            memberInfo[userId][currentDate] = {
                'ten': fullName,
                'quay': 0,
                'keo': 0,
                'tinh_tien': 0
            };
        }

        memberInfo[userId][currentDate]['quay'] += quay;
        memberInfo[userId][currentDate]['keo'] += keo;
        memberInfo[userId][currentDate]['tinh_tien'] += quay * 500 + keo * 1000;
    }
});

// Lệnh để bot trả về thông tin của mỗi thành viên trong nhóm
bot.onText(/\/bc/, (msg) => {
    const chatId = msg.chat.id;
    let response = '';

    response += `Bảng công ngày hôm nay (${new Date().toLocaleDateString()}):\n`;
    response += 'HỌ TÊN👩‍🎤\t\tQUẨY💃\tCỘNG➕\tTỔNG TIỀN💰\n';

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
    response += 'HỌ TÊN👩‍🎤\t\tQUẨY💃\tCỘNG➕\tTỔNG TIỀN💰\n';

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

