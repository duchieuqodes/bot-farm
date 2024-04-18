const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const mongoose = require('mongoose');
const cron = require('node-cron');

const keep_alive = require('./keep_alive.js')


const token = '6748384489:AAGV42T0PoOel_1519X5ot_rLLnpQqqDTdA';
const bot = new TelegramBot(token, { polling: true });

// Kết nối tới MongoDB
mongoose.connect('mongodb+srv://duchieufaryoung0:80E9gUahdOXmGKuy@cluster0.6nlv1cv.mongodb.net/telegram_bot_db?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;

// Định nghĩa schema cho bảng công
const BangCongSchema = new mongoose.Schema({
    userId: Number,
    date: Date,
    ten: String,
    quay: Number,
    keo: Number,
    image: Number,
    tinh_tien: Number
});

// Tạo model từ schema
const BangCong = mongoose.model('BangCong', BangCongSchema);

// Đường dẫn tới file lưu trữ dữ liệu
const dataFilePath = 'members_photos.json';

// Load dữ liệu từ file
let membersPhotos = {};
if (fs.existsSync(dataFilePath)) {
    membersPhotos = JSON.parse(fs.readFileSync(dataFilePath));
}

// Chuỗi cấm
const bannedStringsRegex = /(ca\s?1|ca1|ca\s?2|Ca\s?2|Ca\s?1|Ca1|Ca\s?2|Ca2|C1|C2|c\s?1|c\s?2|C\s?1|C\s?2)\s*/gi;

// Lưu trữ tin nhắn chứa hình ảnh của từng thành viên
let photoMessages = {};

// Đối tượng lưu trữ thông tin của mỗi thành viên trong nhóm
const memberInfo = {};
// Lưu trữ thông tin về người dùng  
// Hàm gửi bảng công vào thời điểm cố định hàng ngày
async function sendDailyReport() {
    const currentDate = new Date();
    const currentHour = currentDate.getUTCHours(); // Lấy giờ hiện tại theo múi giờ UTC
    const currentMinute = currentDate.getUTCMinutes(); // Lấy phút hiện tại theo múi giờ UTC

    // Kiểm tra xem có đến thời điểm gửi bảng công không (00:13 theo giờ Việt Nam)
    if ((currentHour === 14 && currentMinute === 0) || (currentHour === 7 && currentMinute === 0)) { // 17h13 theo múi giờ UTC tương đương 00h13 theo múi giờ Việt Nam
        const chatId = '-1002050799248'; // Thay thế bằng ID của nhóm muốn gửi bảng công

        let response = '';
        response += `Bảng Công Hôm Nay ${currentDate.getDate()}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}  (Cập nhật lại tự động sau mỗi ca ):\n\n\n`;
        response += 'HỌ TÊN👩‍🎤|\t\tQUẨY💃|\tCỘNG➕|\tTIỀN💰\n\n'; // Reset tổng số ảnh của thành viên sau 10 giây

        try {
            // Lấy dữ liệu bảng công từ MongoDB cho ngày hiện tại
            const currentDate = new Date().toLocaleDateString(); // Ngày hiện tại
            const bangCongs = await BangCong.find({ date: currentDate });

            bangCongs.forEach(bangCong => {
                const formattedTien = bangCong.tinh_tien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // Định dạng số tiền thành dạng ngăn cách bằng dấu chấm
            response += `${bangCong.ten}\t\t${bangCong.quay}q +\t${bangCong.keo}c\t${formattedTien}vnđ\n`;
        });
        } catch (error) {
            console.error('Lỗi khi truy vấn dữ liệu từ MongoDB:', error);
            response += 'Đã xảy ra lỗi khi truy vấn dữ liệu từ cơ sở dữ liệu.';
        }

        if (response === '') {
            response = 'Chưa có số nào được gửi trong nhóm.';
        }

        bot.sendMessage(chatId, response);
    }
}

// Kiểm tra thời gian và gửi bảng công mỗi phút
setInterval(sendDailyReport, 60000); // Kiểm tra mỗi phút


// Hàm để gửi tin nhắn ngẫu nhiên vào 7h hàng ngày theo giờ Việt Nam
function sendRandomMessage() {
    // Lời nhắn ngẫu nhiên
    const randomMessages = [
        "Nắng đã lên, gió đã lùa, team ta mau dậy đi 'quẩy' thôi nào! ☀️🍃 Chúc cả team một buổi sáng tràn đầy năng lượng, sẵn sàng bùng nổ nhiệt huyết cho ngày làm việc 'quẩy nhóm' hăng say!",
        "Chào buổi sáng team yêu dấu! 🎊 Hôm nay là ngày 'quẩy nhóm' tung nóc, hãy cùng nhau biến nó thành một ngày thật bùng nổ và đáng nhớ nhé!",
        "⏰ Chuông báo thức đã reo, team ơi hãy thức dậy và nạp thêm năng lượng cho một ngày 'quẩy nhóm' cực 'phiêu' nào!",
        "🌞 Bầu trời xanh, mây trắng, nắng vàng rực rỡ - khung cảnh hoàn hảo cho một ngày 'quẩy nhóm' cực đã! Chúc cả team có một ngày làm việc vui vẻ và hiệu quả!",
        "🎶 Nhạc đã sẵn sàng, tâm hồn đã hân hoan, team ta cùng nhau 'quẩy' cho tưng bừng náo nhiệt nhé!",
        "🤪 Cười nào team ơi! Nụ cười là bí quyết cho một ngày 'quẩy nhóm' vui vẻ và thành công!",
        "☕️ Cà phê thơm lừng, bánh mì giòn tan - bữa sáng hoàn hảo để khởi đầu một ngày 'quẩy nhóm' tuyệt vời! Chúc cả team ngon miệng và có một ngày làm việc tràn đầy năng lượng!",
        "💪 Lên nào team ơi! Hôm nay là ngày để chúng ta 'quẩy' hết mình và chinh phục mọi thử thách!",
        "🎯 Mục tiêu đã đặt sẵn, tinh thần đã hừng hực - team ta cùng nhau 'quẩy' cho đến khi nào thành công thôi nào!",
        "🤝 Teamwork là sức mạnh! Hãy cùng nhau phối hợp ăn ý, hỗ trợ lẫn nhau để có một ngày 'quẩy nhóm' thật hiệu quả và gắn kết!",
        "😜 'Quẩy nhóm' mà không vui thì còn gì vui nữa? Cùng nhau biến ngày làm việc thành một bữa tiệc vui nhộn và đáng nhớ nhé!",
        "💃 Nhảy nào team ơi! Nhịp điệu sôi động sẽ giúp chúng ta thêm hăng say và 'quẩy' hết mình trong ngày làm việc!",
        "🤩 Hôm nay 'quẩy nhóm' mà không selfie thì quả là thiếu sót! Cùng nhau lưu lại những khoảnh khắc vui vẻ và đáng nhớ nhé!",
        "🎉 'Quẩy nhóm' là để bung xõa, là phải hết mình! Hãy cởi bỏ mọi lo toan và tận hưởng niềm vui của ngày làm việc!",
        "🎁 'Quẩy nhóm' cũng có quà nha! Hãy hoàn thành tốt nhiệm vụ để nhận được những phần thưởng bất ngờ nhé!",
        "🏆 'Quẩy nhóm' là để chiến thắng! Hãy cùng nhau nỗ lực hết mình để đạt được mục tiêu chung của team!",
        "🧠 'Quẩy nhóm' cũng cần trí tuệ! Hãy cùng nhau brainstorming để tìm ra những ý tưởng sáng tạo và đột phá!",
        "💡 'Quẩy nhóm' là cơ hội để học hỏi và phát triển! Hãy tích cực trao đổi kinh nghiệm và hỗ trợ lẫn nhau để cùng nhau tiến bộ!",
        "😄 'Quẩy nhóm' là để gắn kết! Hãy cùng nhau chia sẻ những niềm vui, nỗi buồn và tạo nên những kỷ niệm đẹp đẽ bên nhau!",
        "💖 'Quẩy nhóm' là gia đình! Hãy luôn yêu thương, thấu hiểu và hỗ trợ lẫn nhau như những người thân yêu trong gia đình!",
        "😜 'Quẩy nhóm' là để bung lụa! Hãy cởi bỏ mọi rào cản và thể hiện cá tính độc đáo của bản thân!",
        "🤪 'Quẩy nhóm' là để troll nhau! Hãy cùng nhau trêu đùa, chọc ghẹo nhau một cách vui vẻ để ngày làm việc thêm sôi động!",
        "🤫 'Quẩy nhóm' là để bí mật! Hãy cùng nhau chia sẻ những bí mật nho nhỏ để gắn kết tình cảm thêm khăng khít!",
        "🤫 'Quẩy nhóm' là để thả thính! Hãy cùng nhau 'thả thính' để lan tỏa năng lượng tích cực và tạo bầu không khí vui vẻ cho team!"
    ];

    // Chọn ngẫu nhiên một lời nhắn từ danh sách
    const randomIndex = Math.floor(Math.random() * randomMessages.length);
    const randomMessage = randomMessages[randomIndex];

    // Lấy thời gian hiện tại
    const currentTime = new Date();
    const chatId = '-1002050799248'; // Thay thế bằng ID của nhóm muốn gửi bảng công
    
    // Kiểm tra nếu là 7h sáng theo giờ Việt Nam
    if (currentTime.getUTCHours() === 0 && currentTime.getUTCMinutes() === 0) {
        // Gửi tin nhắn ngẫu nhiên vào nhóm
        bot.sendMessage(chatId, randomMessage);
    }
}

// Thiết lập hẹn giờ để gửi tin nhắn vào 7h hàng ngày
setInterval(sendRandomMessage, 24 * 60 * 60 * 1000); // 24 giờ



// Mảng các lời nhắn ngẫu nhiên
const randomMessages = [
    "🚨🚨🚨 Cảnh báo! Cảnh báo! Còn 5 phút nữa là đến giờ rồi! Mọi người ơi, nhanh tay hoàn thành công việc và chuẩn bị tinh thần 'quẩy nhóm' nào!",
    "🏃‍♀️🏃‍♂️ Nhanh lên nào cả team! Chỉ còn 3 phút nữa là đến giờ 'quẩy nhóm' rồi! Ai chưa sẵn sàng thì nhanh lên nhé, không là 'lỡ nhịp' mất đấy!",
    "⏰ Giờ G 'quẩy nhóm' đang đến rất gần! Mọi người ơi, hãy tập trung cao độ và hoàn thành nốt những công việc còn dang dở để có thể 'quẩy' hết mình!",
    "⏱️⏱️⏱️ Tích tắc... tích tắc... Còn 2 phút nữa là đến giờ 'quẩy nhóm' rồi! Mọi người ơi, hãy tắt chuông điện thoại và tập trung vào đây nào!",
    "⏳⏳⏳ Hết giờ rồi! Hết giờ rồi! Mọi người ơi, nhanh tay di chuyển đến nơi 'quẩy nhóm' ngay!",
    "💨💨💨 Nhanh lên nào cả team! 'Quẩy nhóm' đang chờ đợi chúng ta!",
    "🏃‍♀️🏃‍♂️ Ai trễ giờ 'quẩy nhóm' sẽ phải chịu hình phạt 'cute' nhé!",
    "😜😜😜 Isadora không thể chờ đợi được nữa! HÃY CÙNG 'QUẨY NHÓM' THÔI NÀO!",
    "🤩🤩🤩 Isadora hứa hẹn 'quẩy nhóm' hôm nay sẽ là 'quẩy' 'siêu cấp' và 'siêu đỉnh'.",
    "💃🕺 Isadora đã sẵn sàng 'cháy' hết mình với cả team rồi đây! Ai chưa sẵn sàng thì nhanh lên nhé, 'quẩy nhóm' đang chờ đợi chúng ta!",
    "😎😎😎 Isadora tin rằng 'quẩy nhóm' là cơ hội để mọi người thể hiện cá tính và tài năng của bản thân. Hãy cùng nhau 'quẩy' và tỏa sáng nhé!",
    "🤪🤪🤪 Isadora đã chuẩn bị sẵn sàng 'bung lụa' trong 'quẩy nhóm' hôm nay rồi đây! Mọi người nhớ 'quẩy' theo phong cách của riêng mình nhé!",
    "😜😜😜 Isadora cam đoan rằng 'quẩy nhóm' hôm nay sẽ là 'quẩy' 'siêu bựa', 'siêu lầy' và 'siêu hài hước'. Hãy cùng nhau 'quẩy' và tận hưởng những giây phút vui vẻ nhất!",
    "💃🕺 Isadora không thể chờ đợi được nữa! HÃY CÙNG 'QUẨY NHÓM' VỚI ISADORA NÀO!",
    "🤩🤩🤩 Isadora hứa hẹn 'quẩy nhóm' hôm nay sẽ là 'quẩy' 'siêu cấp' và 'siêu đỉnh'.",
    "🤪🤪🤪 Isadora đã chuẩn bị sẵn sàng 'chiêu thức' 'quẩy nhóm' độc đáo nhất rồi đây! Mọi người hãy cùng chờ đón và 'quẩy' thật嗨 nhé!",
    "😎😎😎 Isadora tin rằng 'sức mạnh tập thể' sẽ khiến 'quẩy nhóm' hôm nay trở nên bùng nổ hơn bao giờ hết! Hãy cùng nhau 'quẩy' hết mình nào cả team!",
    "💃🕺 Isadora đã sẵn sàng 'cháy' hết mình với cả team rồi đây! Ai chưa sẵn sàng thì nhanh lên nhé, 'quẩy nhóm' đang chờ đợi chúng ta!",
    "🤩🤩🤩 Isadora tin rằng 'quẩy nhóm' là bí quyết để nâng cao hiệu quả công việc. Hãy cùng nhau 'quẩy' và gặt hái nhiều thành công hơn nữa nhé!",
    "😜😜😜 Isadora cam đoan rằng 'quẩy nhóm' hôm nay sẽ là 'quẩy' 'siêu bựa', 'siêu lầy' và 'siêu hài hước'. Hãy cùng nhau 'quẩy' và tận hưởng những giây phút vui vẻ nhất!",
    "🤪🤪🤪 Isadora đã chuẩn bị sẵn sàng 'bung lụa' trong 'quẩy nhóm' hôm nay rồi đây! Mọi người nhớ 'quẩy' theo phong cách của riêng mình nhé!"
];

// Hàm gửi tin nhắn ngẫu nhiên vào lúc 12h50 và 19h50 hàng ngày
cron.schedule('50 12,19 * * *', () => {
    const randomIndex = Math.floor(Math.random() * randomMessages.length);
    const message = randomMessages[randomIndex];
    const chatId = '-1002050799248'; // Thay thế bằng ID của nhóm muốn gửi bảng công
    bot.sendMessage(chatId, message);
}, {
    timezone: "Asia/Ho_Chi_Minh"
});



bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    // Kiểm tra nếu tin nhắn chứa ảnh
    if (msg.photo || msg.caption) {
        const userId = msg.from.id;

        // Lưu tin nhắn gửi hình ảnh hoặc caption của thành viên
        const messageData = { messageId: msg.message_id, date: msg.date, caption: msg.caption };
        photoMessages[userId] = photoMessages[userId] || [];
        photoMessages[userId].push(messageData);

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
     if ((msg.text || msg.caption) && bannedStringsRegex.test(msg.text || msg.caption)) { // Thêm kiểm tra nếu tin nhắn chứa caption
        const messageContent = msg.text || msg.caption;
        
             
                const matches = messageContent.match(bannedStringsRegex);
                if (matches) {
                    let sum = 0;
                    matches.forEach(match => {
                        const index = messageContent.indexOf(match);
                        const numbersAfterMatch = messageContent.substring(index + match.length).match(/\d+/g);
                        if (numbersAfterMatch) {
                            sum += numbersAfterMatch.reduce((acc, cur) => acc + parseInt(cur), 0);
                        }
                    });

                    const userId = msg.from.id;
                    const userPhotoCount = membersPhotos[userId] || 0;

                    if (true) {
                        bot.sendMessage(chatId, 'Bài nộp hợp lệ, đã ghi vào bảng công ❤🥳', { reply_to_message_id: msg.message_id }).then(async () => {
                            // Reset tổng số ảnh của thành viên
                            membersPhotos[userId] = 0;
                            fs.writeFileSync(dataFilePath, JSON.stringify(membersPhotos));

                            // Lưu dữ liệu vào MongoDB
                            const currentDate = new Date().toLocaleDateString();
                         const firstName = msg.from.first_name;
                            const lastName = msg.from.last_name;
                            const fullName = lastName ? `${firstName} ${lastName}` : firstName;

                            // Kiểm tra xem đã tồn tại bảng công cho thành viên trong ngày hiện tại chưa
                            let bangCong = await BangCong.findOne({ userId, date: currentDate });

                            // Nếu chưa tồn tại bảng công cho thành viên trong ngày hiện tại, tạo mới

// Nếu chưa tồn tại bảng công cho thành viên trong ngày hiện tại, tạo mới
if (!bangCong) {
    // Loại bỏ các số ngay sau chuỗi cấm
    const numbers = messageContent.replace(/(ca\s?1|ca1|ca\s?2|Ca\s?2|Ca\s?1|Ca1|Ca\s?2|Ca2|C1|C2|c\s?1|c\s?2|C\s?1|C\s?2)\s*/gi, '').match(/\d+/g);
    // Cộng số ảnh vào biến image
    const images = messageContent.match(/\b\d+\s*ảnh\b/gi);
    let image = 0;
    if (images) {
        image = images.reduce((acc, img) => acc + parseInt(img), 0);
    }

    if (numbers && numbers.length === 2 && numbers[0] === numbers[1]) {
        const sum = parseInt(numbers[0]) * 2;

        // Tính quẩy và kéo
        const quay = sum / 2;
        const keo = sum / 2;

        // Tạo bảng công mới cho thành viên trong ngày hiện tại
        bangCong = await BangCong.create({
            userId,
            date: currentDate,
            ten: fullName,
            quay,
            keo,
            image,
            tinh_tien: quay * 350 + keo * 1000 + image * 2000
        });
    } else if (numbers && numbers.length > 0) {
        const sum = numbers.reduce((acc, num) => acc + parseInt(num), 0);

        // Tính quẩy và kéo
        const quay = numbers.filter(num => num > sum / 2).reduce((acc, num) => acc + parseInt(num), 0);
        const keo = sum - quay;

        // Tạo bảng công mới cho thành viên trong ngày hiện tại
        bangCong = await BangCong.create({
            userId,
            date: currentDate,
            ten: fullName,
            quay,
            keo,
            image,
            tinh_tien: quay * 350 + keo * 1000 + image * 2000
        });
    }
} else {
    const numbers = messageContent.replace(/(ca\s?1|ca1|ca\s?2|Ca\s?2|Ca\s?1|Ca1|Ca\s?2|Ca2|C1|C2|c\s?1|c\s?2|C\s?1|C\s?2)\s*/gi, '').match(/\d+/g);
    // Cộng số ảnh vào biến image
    const images = messageContent.match(/\b\d+\s*ảnh\b/gi);
    let image = 0;
    if (images) {
        image = images.reduce((acc, img) => acc + parseInt(img), 0);
    }

    if (numbers && numbers.length === 2 && numbers[0] === numbers[1]) {
        const sum = parseInt(numbers[0]) * 2;

        // Tính quẩy và kéo
        const quay = sum / 2;
        const keo = sum / 2;

        // Cập nhật dữ liệu bảng công
        bangCong.quay += quay;
        bangCong.keo += keo;
        bangCong.image += image;
        bangCong.tinh_tien += quay * 350 + keo * 1000 + image * 2000;

        await bangCong.save();
    } else if (numbers && numbers.length > 0) {
        const sum = numbers.reduce((acc, num) => acc + parseInt(num), 0);

        // Tính quẩy và kéo
        const quay = numbers.filter(num => num > sum / 2).reduce((acc, num) => acc + parseInt(num), 0);
        const keo = sum - quay;

        // Cập nhật dữ liệu bảng công
        bangCong.quay += quay;
        bangCong.keo += keo;
        bangCong.image += image;
        bangCong.tinh_tien += quay * 350 + keo * 1000 + image * 2000;

        await bangCong.save();
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
});


bot.onText(/\/bc/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        // Lấy dữ liệu bảng công từ MongoDB cho ngày hiện tại
        const currentDate = new Date().toLocaleDateString(); // Ngày hiện tại
        const bangCongs = await BangCong.find({ date: currentDate });

        let response = '';
        response += `Bảng Công Ngày Hôm Nay (${currentDate}):\n\n\n`;
        response += 'HỌ TÊN👩‍🎤\t\tQUẨY💃\tCỘNG➕\tTỔNG TIỀN💰\n\n';

        bangCongs.forEach(bangCong => {
            const formattedTien = bangCong.tinh_tien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // Định dạng số tiền thành dạng ngăn cách bằng dấu chấm
            response += `${bangCong.ten}\t\t${bangCong.quay}q +\t${bangCong.keo}c\t${formattedTien}vnđ\n`;
        });

        if (response === '') {
            response = 'Chưa có số nào được gửi trong nhóm vào ngày hôm nay.';
        }
bot.sendMessage(chatId, response);
    } catch (error) {
        console.error('Lỗi khi truy vấn dữ liệu từ MongoDB:', error);
        bot.sendMessage(chatId, 'Đã xảy ra lỗi khi truy vấn dữ liệu từ cơ sở dữ liệu.');
    }
});

        
// Lệnh để tính toán bảng công theo ngày mà người dùng yêu cầu
bot.onText(/\/bc(\d{1,2})?\/(\d{1,2})?\/(\d{4})?/, async (msg, match) => {
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

// Lệnh để reset dữ liệu bảng công từ MongoDB cho ngày hiện tại
bot.onText(/\/resetbc/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        // Kiểm tra vai trò của người gửi lệnh
        const member = await bot.getChatMember(chatId, userId);
        const isAdmin = member.status === 'creator' || member.status === 'administrator';

        if (!isAdmin) {
            // Nếu không phải là quản trị viên, thông báo không có quyền
            bot.sendMessage(chatId, 'Bạn không có quyền reset dữ liệu bảng công.');
            return;
        }

        // Lấy ngày hiện tại
        const currentDate = new Date().toLocaleDateString();

        // Xóa dữ liệu bảng công cho ngày hiện tại từ MongoDB
        await BangCong.deleteMany({ date: currentDate });

        // Thông báo reset thành công
        bot.sendMessage(chatId, `Đã reset dữ liệu bảng công cho ngày ${currentDate}.`);
    } catch (error) {
        console.error('Lỗi khi reset dữ liệu bảng công:', error);
        bot.sendMessage(chatId, 'Đã xảy ra lỗi khi reset dữ liệu bảng công.');
    }
});

// Lệnh để reset dữ liệu bảng công từ MongoDB cho các ngày trước đó
bot.onText(/Tính bc mới/i, async (msg) => {
    const chatId = msg.chat.id;

    try {
        // Reply với thông điệp xác nhận
        bot.sendMessage(chatId, "Dạ, Isadora đã ghi nhận. Bắt đầu tính tổng lương mới từ hôm nay ạ👌", { reply_to_message_id: msg.message_id });

        // Lấy ngày hiện tại
        const currentDate = new Date().toLocaleDateString();

        // Xóa dữ liệu bảng công cho các ngày trước đó từ MongoDB
        await BangCong.deleteMany({ date: { $lt: currentDate } });
    } catch (error) {
        console.error('Lỗi khi reset dữ liệu bảng công:', error);
        bot.sendMessage(chatId, 'Đã xảy ra lỗi khi reset dữ liệu bảng công.');
    }
});


// Lệnh để hiển thị bảng công của từng ngày trong cơ sở dữ liệu
bot.onText(/(Chốt bc|Xem tổng bc)/i, async (msg) => {
    const chatId = msg.chat.id;
    const randomResponse = [
        "Chào anh Hiếu Gà, Isadora đây ạ! 🙋‍♀️ Bảng công tổng đây ạ, anh xem có cần chỉnh sửa gì không ạ? 📋",
        "Xin chào anh Hiếu Gà! Bảng công tổng nóng hổi vừa ra lò, anh xem và góp ý cho em nhé! ♨️",
        "Isadora gửi bảng công tổng cho anh Hiếu Gà đây ạ! Nhớ kiểm tra kỹ và phản hồi cho em nha! 💌",
        "Bảng công tổng đã đến tay anh Hiếu Gà rồi ạ! Anh xem có gì cần chỉnh sửa thì cứ báo em nhé! 📝",
        "Isadora gửi bảng công tổng cho anh Hiếu Gà với tốc độ ánh sáng! ⚡️",
        "Bảng công tổng đã được Isadora chuẩn bị chu đáo, anh Hiếu Gà chỉ việc kiểm tra và duyệt thôi ạ! ✅",
        "Chúc anh và mọi người một ngày làm việc hiệu quả và suôn sẻ với bảng công tổng đầy đủ thông tin! 📈",
        "Đây là bảng công tổng, cùng Isadora hoàn thành công việc một cách xuất sắc nào! 💪",
        "Isadora luôn sẵn sàng hỗ trợ anh Hiếu Gà và mọi người mọi lúc mọi nơi! 🤗",
        "Em xin gửi bảng công tổng, chúc cả team một ngày làm việc vui vẻ và gặt hái được nhiều thành công! 🎉"
    ];

    try {
        let response = '';

        // Lấy tất cả các ngày có dữ liệu bảng công từ MongoDB
        const dates = await BangCong.distinct('date');

        // Hiển thị bảng công của từng ngày
        for (const date of dates) {
            const bangCongs = await BangCong.find({ date });

          // Định dạng ngày theo chuẩn số ngày/số tháng/số năm
            const formattedDate = new Date(date).toLocaleDateString('vi-VN');

            response += `Bảng Công Ngày ${formattedDate}:\n\n`;
            response += 'TÊN👩‍🎤\t\tQUẨY💃\tCỘNG➕\tTIỀN💰\n';
            bangCongs.forEach(bangCong => {
                const formattedTien = bangCong.tinh_tien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // Định dạng số tiền thành dạng ngăn cách bằng dấu chấm
            response += `${bangCong.ten}\t\t${bangCong.quay}q +\t${bangCong.keo}c\t${formattedTien}vnđ\n`;
        });
            response += '\n\n';
        }

        // Tính toán tổng bảng công và tổng tiền của tất cả thành viên từ tất cả các ngày
        const totalBangCong = {};
        let totalMoney = 0;
        for (const date of dates) {
            const bangCongs = await BangCong.find({ date });
            bangCongs.forEach(bangCong => {
                if (!totalBangCong[bangCong.userId]) {
                    totalBangCong[bangCong.userId] = { ten: bangCong.ten, quay: 0, keo: 0, tinh_tien: 0 };
                }
                totalBangCong[bangCong.userId].quay += bangCong.quay;
                totalBangCong[bangCong.userId].keo += bangCong.keo;
                totalBangCong[bangCong.userId].tinh_tien += bangCong.tinh_tien;
                totalMoney += bangCong.tinh_tien;
            });
        }

        // Hiển thị tổng bảng công và tổng tiền của tất cả thành viên
        response += '\nTổng Bảng Công Các Ngày:\n\n';
        response += 'TÊN👩‍🎤\t\tQUẨY💃\tCỘNG➕\tTIỀN💰\n';
        for (const userId in totalBangCong) {
            const bangCong = totalBangCong[userId];
            const formattedTien = bangCong.tinh_tien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            response += `${bangCong.ten}\t\t${bangCong.quay}q +\t${bangCong.keo}c\t${formattedTien}vnđ\n\n`;
        }
        const formattedTotalMoney = totalMoney.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // Định dạng số tiền thành dạng ngăn cách bằng dấu chấm
        response += `Tổng tiền của CTV: ${formattedTotalMoney}vnđ`;

        // Gửi thông điệp chứa bảng công của từng ngày và tổng bảng công của tất cả thành viên
        bot.sendMessage(chatId, response);
    // Phản hồi cho quản trị viên với nội dung ngẫu nhiên
        const randomIndex = Math.floor(Math.random() * randomResponse.length);
        const replyMessage = randomResponse[randomIndex];
        bot.sendMessage(chatId, replyMessage, { reply_to_message_id: msg.message_id });
    } catch (error) {
        console.error('Lỗi khi hiển thị bảng công:', error);
        bot.sendMessage(chatId, 'Đã xảy ra lỗi khi hiển thị bảng công.');
    }
});


// Lệnh để xử lý tin nhắn của quản trị viên để cập nhật dữ liệu bảng công từ tin nhắn của quản trị viên
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

  // Kiểm tra vai trò của người gửi lệnh nếu là quản trị viên
        const member = await bot.getChatMember(chatId, msg.from.id);
        if (member.status === 'creator' || member.status === 'administrator') {

    // Kiểm tra nếu tin nhắn không phải là reply và có chứa thông tin để cập nhật bảng công
    if (!msg.reply_to_message && msg.text) {
        const editedContent = msg.text.trim();
        const userInfoRegex = /(.+),\s*(\d+)\s*q,\s*(\d+)\s*c/;
        const matches = editedContent.match(userInfoRegex);

        
            if (matches) {
                const fullName = matches[1].trim();
                const quay = parseInt(matches[2]);
                const keo = parseInt(matches[3]);

                try {
                    // Kiểm tra xem đã tồn tại bảng công cho thành viên có tên như trong tin nhắn chưa
                    const currentDate = new Date().toLocaleDateString();
                    let bangCong = await BangCong.findOne({ ten: fullName, date: currentDate });

                    if (bangCong) {
                        // Nếu đã tồn tại bảng công cho thành viên, cập nhật dữ liệu quay và kéo
                        bangCong.quay = quay;
                        bangCong.keo = keo;
                        bangCong.tinh_tien = quay * 350 + keo * 1000;
                        await bangCong.save();
                    } else {
                        // Nếu chưa tồn tại bảng công cho thành viên, tạo mới
                        bangCong = await BangCong.create({
                            ten: fullName,
                            quay,
                            keo,
                            tinh_tien: quay * 350 + keo * 1000,
                            date: currentDate
                        });
                    }

                    // Phản hồi lại tin nhắn của quản trị viên
                    bot.sendMessage(chatId, "Em đã cập nhật bảng công như anh yêu cầu");
                } catch (error) {
                    console.error('Lỗi khi cập nhật bảng công:', error);
                    bot.sendMessage(chatId, 'Đã xảy ra lỗi khi cập nhật bảng công.');
                }
            }
        } else {
            
   }
    }
});

