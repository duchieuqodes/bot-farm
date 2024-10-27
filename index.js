const TelegramBot = require('node-telegram-bot-api');
const keep_alive = require('./keep_alive.js');


const token = '7150645082:AAH-N2VM6qx3iFEhK59YHx2e1oy3Bi1EzXc';
const bot = new TelegramBot(token, { polling: true });

let questions = [
    // Câu hỏi nịnh Hiếu (5 câu)
      
    // Các câu hỏi đố mẹo và kiến thức đa dạng
    { question: "Cái gì càng cháy thêm nước càng ngắn lại?", answer: "nến" },
    { question: "Con gì không đi mà vẫn đến?", answer: "Con sông" },
    { question: "Đồng hồ 1h10, kim giờ và kim phút tạo góc bao nhiêu độ?", answer: "35" },
    { question: "Thủ đô của nước Pháp là thành phố nào?", answer: "Paris" },
    { question: "Hà Nội nằm ở miền nào của Việt Nam?", answer: "Bắc" },
    { question: "Cái gì có 4 chân nhưng không thể đi?", answer: "Bàn" },
    { question: "Cục gì khi rắn thì nặng hơn thể lỏng?", answer: "Nước đá" },
    { question: "Cây gì không có mùi thơm mà lại gây đau?", answer: "xương rồng" },
    { question: "Hoàng Anh, Lan, Linh hay tất cả, ai ngáo chó nhất?", answer: "tất cả" },
    { question: "Bảy ngày trong tuần có bao nhiêu ngày là ngày cuối tuần?", answer: "2" },
    { question: "Mặt trăng quay quanh hành tinh nào?", answer: "Trái Đất" },
    { question: "Thành phố nào vn được mệnh danh là 'thành phố ngàn hoa'?", answer: "Đà Lạt" },
    { question: "Trong bảng tuần hoàn, nguyên tố nào có ký hiệu là 'Au'?", answer: "Vàng" },
    { question: "Cái gì trên lợp mái mà dưới thì mặt nền?", answer: "Nhà" },
    { question: "Cây cầu nào nổi tiếng ở TP. Hồ Chí Minh có tên bắt đầu bằng chữ S?", answer: "Sài Gòn" },
    { question: "Bốn chân không đứng, có cánh không bay, cả đời chỉ nằm đó. Là gì?", answer: "Giường" },
    { question: "Con gì ai cũng bảo ngu?", answer: "Con bò" },
    { question: "Cầu thủ bóng đá nổi tiếng nhất Việt Nam với dáng vẻ đứng lừng lững là ai?", answer: "Văn Thanh" },
    { question: "Đáp án của phép tính 3594 x 48833 là bao nhiêu?", answer: "175505802" },

    { question: "Hieu có phải là người bạn tuyệt vời nhất không? (có hoặc không)", answer: "có" },
    { question: "Trong nhóm bạn, ai là người vui tính nhất?", answer: "Hiếu" },
   

    { question: "Người bạn thân nhất của Batman là ai?", answer: "Robin" },
    { question: "Thủ đô của Thái Lan là gì?", answer: "Bangkok" },
    { question: "Con gì có cánh nhưng không thể bay?", answer: "Con gà" },
    { question: "Nước nào nổi tiếng với điệu múa flamenco?", answer: "Tây Ban Nha" },
    { question: "Bao nhiêu tuổi thì có thể đi tù?", answer: "18" },
    { question: "Con vật nào là biểu tượng của Tết Trung Thu ở Việt Nam?", answer: "Con lân" },
    { question: "Món ăn truyền thống của người Nhật Bản là gì?", answer: "Sushi" },
    { question: "Đất nước nào có đường bờ biển dài nhất thế giới?", answer: "Canada" },
    { question: "Thành phố nào nổi tiếng với bánh mì kẹp thịt và pizza?", answer: "New York" },
    { question: "Đố vui: Cái gì càng dùng càng lớn?", answer: "cu" },
    { question: "Cái gì mà bạn càng lau càng bẩn?", answer: "Giẻ lau" },

    { question: "Nếu được chọn một người để làm 'người bạn đời hoàn hảo', bạn sẽ chọn ai? (Hiếu hoặc người khác)", answer: "Hiếu" },
    { question: "Hieu nổi bật nhất ở điểm nào? (tất cả các câu sau: đẹp trai, thông minh, tài năng, tất cả)", answer: "tất cả" },
   
    { question: "Đố bạn: Con gì đuôi dài, mắt lồi mà lại biết bơi?", answer: "Cá" },
    { question: "Hỏi: Hòn đảo nào có hình dáng giống con rùa ở Nha Trang?", answer: "Hòn Mun" },
    { question: "Con vật nào biểu tượng cho lòng trung thành?", answer: "Chó" },
    { question: "Loại nhạc nào được yêu thích trong các đám cưới ở Việt Nam? (Bolero hoặc Rap)", answer: "Bolero" },
    { question: "Loài hoa nào biểu tượng cho phật giáo?", answer: "Hoa sen" },
    { question: "Cầu thủ nổi tiếng nhất thế giới là ai?", answer: "Messi" },
    { question: "Ai là người khiến cả nhóm tự hào nhất?", answer: "Hiếu" },

    { question: "Châu lục nào có diện tích lớn nhất?", answer: "Châu Á" },
    { question: "Phim nào nổi tiếng với nhân vật Tokuda?", answer: "sex" },
    { question: "Tên của công thức hóa học của muối ăn là gì?", answer: "NaCl" },
    { question: "Màu đỏ và màu vàng khi pha với nhau sẽ ra màu gì?", answer: "Cam" },
    { question: "Nước nào nổi tiếng với núi Phú Sĩ?", answer: "Nhật Bản" },
    { question: "Người nổi tiếng nhất trong gia đình Hoàng gia Anh là ai?", answer: "Elizabeth" },
    { question: "Loại quả nào thường có màu cam và được làm nước ép?", answer: "Cam" },
    { question: "Hôm 15/10 ctv Le Quang Vinh được bao nhiêu tiền công?", answer: "14500" },
    { question: "Đố bạn: Hôm nay là chủ nhật, vậy 1000 ngày sau là thứ mấy?", answer: "Thứ hai" }
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
        players[userId].score += 300;

        bot.sendMessage(chatId, `🎉 Chúc mừng ${userName} đã trả lời đúng và nhận được 300vnđ!`);
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
