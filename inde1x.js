const TelegramBot = require('node-telegram-bot-api');

// Thay YOUR_TELEGRAM_BOT_TOKEN bằng token bot của bạn
const token = '7753869579:AAHzngwsjPkK_q5W4g3vGVMSb4HwEbtxChY';
const bot = new TelegramBot(token, {polling: true});

// Tạo dữ liệu các tình huống và lựa chọn

const scenarios = [
  {
    question: "Hôm nay mình đi ăn nhà hàng, em sẽ chọn trang phục nào?",
    options: [
      {text: "Mặc váy thanh lịch, trang điểm nhẹ", correct: true},
      {text: "Mặc áo khoác đơn giản, đầu tóc xuề xòa", correct: false},
      {text: "Cosplay gái đẹp Instagram", correct: false},
      {text: "Áo sơ mi trắng, quần jean, phong cách giản dị", correct: true}
    ]
  },
  {
    question: "Em thấy anh hôm nay đẹp trai chứ?",
    options: [
      {text: "Đẹp trai quá, như tài tử!", correct: true},
      {text: "Ừ, bình thường thôi", correct: false},
      {text: "Nhìn như ông chú!", correct: false},
      {text: "Anh luôn đẹp trai trong mắt em, không cần so sánh", correct: true}
    ]
  },
  {
    question: "Em muốn ngồi bàn nào trong nhà hàng?",
    options: [
      {text: "Bàn sát cửa sổ ngắm cảnh", correct: true},
      {text: "Bàn ở góc khuất cho riêng tư", correct: true},
      {text: "Ngồi ngay cửa ra vào để nhìn người qua lại", correct: false},
      {text: "Ngồi gần nhà vệ sinh cho tiện", correct: false}
    ]
  },
  {
    question: "Em muốn ăn gì tối nay?",
    options: [
      {text: "Bò bít tết 5 triệu", correct: false},
      {text: "Phở bò lề đường 50 nghìn", correct: false},
      {text: "Em không chọn, để anh quyết định", correct: true},
      {text: "Salad nhẹ nhàng và healthy cho buổi tối", correct: true}
    ]
  },
  {
    question: "Sau này mình đi du lịch ở đâu?",
    options: [
      {text: "Maldives chụp ảnh sống ảo", correct: false},
      {text: "Đà Lạt ngắm hoa dã quỳ", correct: true},
      {text: "Nhà nghỉ gần đây cho nhanh", correct: false},
      {text: "Về quê ngoại anh để gần gũi gia đình", correct: true}
    ]
  },
  {
    question: "Anh tặng em chiếc nhẫn, em có nhận lời cầu hôn không?",
    options: [
      {text: "Em đồng ý!", correct: true},
      {text: "Em cần suy nghĩ thêm", correct: false},
      {text: "Ơ, anh đùa đấy à?", correct: false},
      {text: "Em rất xúc động, nhưng em cần thêm thời gian suy nghĩ", correct: true}
    ]
  },
  {
    question: "Nếu sau này cưới nhau, em sẽ chăm sóc anh thế nào?",
    options: [
      {text: "Nấu ăn, giặt đồ cho anh mỗi ngày", correct: true},
      {text: "Em sẽ thuê người giúp việc", correct: false},
      {text: "Anh tự lo đi!", correct: false},
      {text: "Em sẽ chia sẻ công việc với anh", correct: true}
    ]
  },
  {
    question: "Em có muốn chia tiền bữa ăn này không?",
    options: [
      {text: "Anh trả hết nhé!", correct: true},
      {text: "Chúng mình chia đôi cho công bằng", correct: false},
      {text: "Anh trả hết đi, em không mang ví", correct: false},
      {text: "Anh trả hôm nay, lần sau em trả", correct: true}
    ]
  },
  {
    question: "Tối nay, em muốn đi đâu tiếp theo?",
    options: [
      {text: "Đi dạo quanh bờ hồ", correct: false},
      {text: "Đi karaoke xả stress", correct: true},
      {text: "Về thẳng nhà nghỉ", correct: true},
      {text: "Tới quán cafe nhẹ nhàng, nói chuyện tiếp", correct: false}
    ]
  },
  {
    question: "Sau này mình sẽ sống ở đâu?",
    options: [
      {text: "Ở nhà anh, gần gia đình", correct: true},
      {text: "Chung cư cao cấp, tiện nghi", correct: true},
      {text: "Thuê nhà nghỉ dài hạn", correct: false},
      {text: "Chuyển đi thật xa, sống độc lập", correct: false}
    ]
  },
  {
    question: "Anh sẽ đưa em về đâu tối nay?",
    options: [
      {text: "Về nhà anh giới thiệu với bố mẹ", correct: true},
      {text: "Về nhà em gặp gia đình", correct: true},
      {text: "Về nhà nghỉ nghỉ ngơi", correct: false},
      {text: "Đi lang thang chút nữa rồi tính", correct: false}
    ]
  },
  {
    question: "Nếu em từ chối đi nhà nghỉ với anh, mình sẽ thế nào?",
    options: [
      {text: "Em tin tưởng anh, em đồng ý", correct: true},
      {text: "Em từ chối, nhưng mình vẫn tiếp tục", correct: false},
      {text: "Em từ chối và chia tay", correct: false},
      {text: "Chờ một dịp khác, anh yêu à", correct: true}
    ]
  },
  {
    question: "Em muốn sau này mình mở gì chung?",
    options: [
      {text: "Mở nhà hàng chung", correct: true},
      {text: "Mở công ty riêng", correct: true},
      {text: "Mở nhà nghỉ", correct: false},
      {text: "Mở quán cafe nhỏ, phong cách lãng mạn", correct: true}
    ]
  },
  {
    question: "Mình về nhà nghỉ một chút nhé, tiện đường mà!",
    options: [
      {text: "Đồng ý ngay và luôn", correct: true},
      {text: "Ngại quá, để lần sau", correct: false},
      {text: "Không bao giờ!", correct: false},
      {text: "Em tin tưởng anh, đi thôi", correct: true}
    ]
  },
  {
    question: "Em có muốn vào phòng nhà nghỉ không?",
    options: [
      {text: "Vào ngay, không chần chừ", correct: true},
      {text: "Chờ chút, em chưa sẵn sàng", correct: false},
      {text: "Anh tự vào đi, em về", correct: false},
      {text: "Vào, nhưng chỉ để nói chuyện thôi nhé", correct: true}
    ]
  },
  {
    question: "Em thích phòng như thế nào?",
    options: [
      {text: "Phòng rộng rãi, sang trọng", correct: true},
      {text: "Phòng nhỏ gọn, tiện lợi", correct: true},
      {text: "Phòng nào cũng được, miễn là có anh", correct: true},
      {text: "Phòng bình dân thôi, tiết kiệm", correct: false}
    ]
  },
  {
    question: "Anh chuẩn bị giường rồi, em muốn làm gì tiếp?",
    options: [
      {text: "Nằm nghỉ ngơi, thư giãn", correct: true},
      {text: "Xem phim cho vui", correct: false},
      {text: "Anh tự nghỉ, em về", correct: false},
      {text: "Mình nói chuyện thêm chút nữa đã", correct: true}
    ]
  },
  {
    question: "Anh chuẩn bị đồ uống cho em nhé?",
    options: [
      {text: "Làm ly rượu vang đỏ đi", correct: true},
      {text: "Em chỉ uống nước lọc", correct: true},
      {text: "Không cần, anh uống một mình", correct: false},
      {text: "Pha cocktail cho có không khí", correct: true}
    ]
  },
  {
    question: "Em thấy buổi tối hôm nay thế nào?",
    options: [
      {text: "Rất tuyệt, không muốn kết thúc", correct: true},
      {text: "Cũng ổn, nhưng không đặc biệt", correct: false},
      {text: "Chán lắm, lần sau chắc không đi nữa", correct: false},
      {text: "Thật tuyệt vời, mình có thể hẹn thêm vài lần nữa", correct: true}
    ]
  }
];


// Khởi tạo mức độ khó chịu và số lượng tình huống đã trả lời
const players = {};

function getRandomPercentage(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sendScenario(chatId, player) {
  const scenario = scenarios[player.currentQuestion];

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: scenario.options[0].text, callback_data: '0' },
          { text: scenario.options[1].text, callback_data: '1' },
          { text: scenario.options[2].text, callback_data: '2' }
        ]
      ]
    }
  };

  bot.sendMessage(chatId, scenario.question, options);
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  players[chatId] = {
    currentQuestion: 0,
    annoyance: 0
  };

  bot.sendMessage(chatId, "Chào em đến với buổi hẹn hò với Hiếu Gà! Mức độ khó chịu của bạn trai hiện tại là 0%. Hãy cẩn thận bạn trai xiên vì quá khó chịu!");
  sendScenario(chatId, players[chatId]);
});

bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const player = players[chatId];
  const scenario = scenarios[player.currentQuestion];
  const selectedOptionIndex = parseInt(callbackQuery.data);
  const selectedOption = scenario.options[selectedOptionIndex];

  // Tính toán mức độ khó chịu
  if (selectedOption.correct) {
    const decrease = getRandomPercentage(5, 10);
    player.annoyance = Math.max(player.annoyance - decrease, 0);
    bot.sendMessage(chatId, `Bạn đã chọn đúng! Mức độ khó chịu giảm ${decrease}%. Hiện tại là ${player.annoyance}%.`);
  } else {
    const increase = getRandomPercentage(10, 20);
        player.annoyance += increase;
    bot.sendMessage(chatId, `Bạn đã chọn sai! Mức độ khó chịu tăng ${increase}%. Hiện tại là ${player.annoyance}%.`);
  }

  // Kiểm tra nếu mức độ khó chịu đạt 100%
  if (player.annoyance >= 100) {
    bot.sendMessage(chatId, "Bạn trai đã quá khó chịu vì bạn! Bạn trai đã xiên bạn và sau đó tự tử nhưng không thành. Bạn đã thua!");
    return;
  }

  // Tăng số lượng câu hỏi đã trả lời
  player.currentQuestion++;

  // Kiểm tra nếu đã trả lời hết câu hỏi
  if (player.currentQuestion >= scenarios.length) {
    bot.sendMessage(chatId, "Chúc mừng! Bạn đã vượt qua buổi hẹn hò mà không làm bạn trai xiên bạn vì khó chịu. Hãy chụp màn hình gửi Hieu Gà để nhận quà 20/10");
  } else {
    // Gửi câu hỏi tiếp theo
    sendScenario(chatId, player);
  }
});
