const TelegramBot = require('node-telegram-bot-api');
const token = '7753869579:AAHzngwsjPkK_q5W4g3vGVMSb4HwEbtxChY'; // Thay bằng token của bạn
const bot = new TelegramBot(token, { polling: true });

let questions = [
    { question: "Ai là người vừa đăng status 'tôi sẽ cưới trong năm nay' mà ai cũng ngỡ là đùa?", answer: "Trấn Thành" },
    { question: "Bộ phim nào có doanh thu khủng nhưng bị chê không thương tiếc trong tháng 10?", answer: "Chị chị em em 2" },
    { question: "Đất nước có dân số đông nhất thế giới hiện nay?", answer: "Trung Quốc" },
    { question: "Một tuần có mấy ngày?", answer: "7" },
    { question: "Số Pi bắt đầu với hai chữ số thập phân nào?", answer: "3.14" },
    { question: "Kim tự tháp nổi tiếng nằm ở đất nước nào?", answer: "Ai Cập" },
    { question: "Nguyên tố nào có ký hiệu hóa học là O?", answer: "Oxy" },
    { question: "Mặt trăng là vệ tinh của hành tinh nào?", answer: "Trái Đất" },
    { question: "Thành phố nào được mệnh danh là 'Hòn ngọc Viễn Đông'?", answer: "Sài Gòn" },
    { question: "Hà Nội là thủ đô của Việt Nam? (có hoặc không)", answer: "có" },
    { question: "Hieu có đẹp zai không? (có hoặc không)", answer: "có" },
    { question: "Yêu tinh nào nguy hiểm nhất trong nhóm Hieu Gà? (Lan, Hoàng Anh, Linh hoặc cả ba)", answer: "cả ba" },
    { question: "Nếu được hẹn hò với Hieu Gà bạn có đồng ý không? (có hoặc không)", answer: "có" },
    { question: "Ai là yêu tinh nữ xinh nhất trong nhóm Hieu Gà? (Lan, Hoàng Anh, Linh hoặc cả ba)", answer: "cả ba" },
    { question: "Đố vui: Quả gì không ăn được?", answer: "Quả bóng" },
    { question: "Cái gì càng lấy đi càng nhiều?", answer: "Lỗ" },
    { question: "Kể ra 1 trong 3 yêu tinh nữ nổi tiếng nhất nhóm Hieu gà tên là gì", answer: "Lan" },
    { question: "Con gì không thở mà vẫn sống?", answer: "Con rối" },
    { question: "Cái gì mà càng lau càng bẩn?", answer: "Giẻ lau" },
    { question: "Điền vào chỗ trống: Con gì đuôi dài, miệng thì kêu meo meo?", answer: "Mèo" },
    { question: "Trong bảng tuần hoàn, nguyên tố nào có ký hiệu là 'Fe'?", answer: "Sắt" },
    { question: "Con gì có 4 chân nhưng không thể đi?", answer: "Bàn" },
    { question: "Cái gì của Hieu Gà mà ai cũng muốn nghe?", answer: "Giọng nói" },
    { question: "Món ăn nào nổi tiếng ở Hà Nội có bún và thịt nướng?", answer: "Chả" },
    { question: "Cầu thủ Việt Nam nào được gọi là 'Quang Hải nhỏ'?", answer: "Quang Hải" },
    { question: "Loại nhạc nào phổ biến trong đám cưới ở miền Tây? (Bolero hoặc Rap)", answer: "Bolero" },
    { question: "Đất nước nào là quê hương của pizza?", answer: "Ý" },
    { question: "Công thức hóa học của nước là gì?", answer: "H2O" },
    { question: "Cái gì càng nhỏ càng cao?", answer: "Con số" },
    { question: "Con gà có bao nhiêu chân?", answer: "2" },
    { question: "Loài hoa nào thường nở vào mùa xuân?", answer: "Hoa đào" }
];


let currentQuestionIndex = 0;
let players = {}; // Để lưu điểm của người chơi
let timer;

bot.onText(/\/hieuga/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Chào mừng bạn đến với game của Hieu Gà! Hãy sẵn sàng trả lời những câu hỏi troll nhé.");
    startGame(chatId);
});

function startGame(chatId) {
    currentQuestionIndex = 0;
    players = {};
    askQuestion(chatId);
}

function askQuestion(chatId) {
    if (currentQuestionIndex >= questions.length) {
        endGame(chatId);
        return;
    }

    const question = questions[currentQuestionIndex];
    bot.sendMessage(chatId, `Câu hỏi ${currentQuestionIndex + 1}: ${question.question}`);
    
    timer = setTimeout(() => {
        bot.sendMessage(chatId, `Hết giờ! Câu trả lời là: ${question.answer}`);
        currentQuestionIndex++;
        askQuestion(chatId);
    }, 120000); // 2 phút cho mỗi câu hỏi
}

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = `${msg.from.first_name} ${msg.from.last_name || ''}`;
    
    if (msg.text.startsWith('/')) return; // Bỏ qua lệnh khác

    const question = questions[currentQuestionIndex];
    const answer = msg.text.trim().toLowerCase();
    const correctAnswer = question.answer.toLowerCase();

    if (answer === correctAnswer) {
        clearTimeout(timer);

        if (!players[userId]) players[userId] = { name: userName, score: 0 };
        players[userId].score += 1000;

        bot.sendMessage(chatId, `🎉 Chúc mừng ${userName} đã trả lời đúng và nhận được 1000vnđ!`);
        currentQuestionIndex++;
        askQuestion(chatId);
    }
});

function endGame(chatId) {
    let rankingMessage = "📊 Kết thúc game! Bảng xếp hạng:\n";
    const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);

    sortedPlayers.forEach((player, index) => {
        rankingMessage += `${index + 1}. ${player.name} - ${player.score} vnđ\n`;
    });

    bot.sendMessage(chatId, rankingMessage || "Không có ai trả lời đúng câu nào 😆");
}
