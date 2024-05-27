const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const axios = require('axios');
const request = require('request');
const cron = require('node-cron'); // Thư viện để thiết lập cron jobs
const keep_alive = require('./keep_alive.js');
const { resetDailyGiftStatus, sendMorningMessage, handleGiftClaim } = require('./gift');
const { setupNewsSchedule, sendLatestNews } = require('./news.js');
const { handleMessage, resetKeywords } = require('./warningMember');

// Kết nối tới MongoDB
mongoose.connect(
  'mongodb+srv://duchieufaryoung0:80E9gUahdOXmGKuy@cluster0.6nlv1cv.mongodb.net/telegram_bot_db?retryWrites=true&w=majority',
  { useNewUrlParser: true, useUnifiedTopology: true }
);
const db = mongoose.connection;

// Định nghĩa schema cho bảng công
const BangCongSchema = new mongoose.Schema({
  userId: Number,
  groupId: Number,
  date: Date,
  ten: String,
  quay: Number,
  keo: Number,
  tinh_tien: Number,
  giftWon: { type: Boolean, default: false },
  prizeAmount: { type: Number, default: 0 },
});

//Định nghĩa schema cho thành viên
const MemberSchema = new mongoose.Schema({
  userId: { type: Number, unique: true },
  fullname: String,
  level: Number,
  levelPercent: Number,
  assets: {
    quay: Number,
    keo: Number,
    vnd: Number
  }
});

// Định nghĩa schema cho tin nhắn
const MessageSchema = new mongoose.Schema({
  messageId: Number,
  userId: Number,
  chatId: Number,
  text: String,
  date: { type: Date, default: Date.now }
});


// Tạo model từ schema
const BangCong2 = mongoose.model('BangCong2', BangCongSchema);

// Định nghĩa schema cho trạng thái hàng ngày
const DailyGiftStatusSchema = new mongoose.Schema({
  date: String,
  dailyGiftClaims: [Number], // Danh sách các user đã nhận quà
  giftWonToday: { type: Boolean, default: false },
});

const DailyGiftStatus = mongoose.model('DailyGiftStatus', DailyGiftStatusSchema);
Tạo model từ schema
const Member = mongoose.model('Member', MemberSchema);
const Message = mongoose.model('Message', MessageSchema);


const token = '7150645082:AAH-N2VM6qx3iFEhK59YHx2e1oy3Bi1EzXc';
const bot = new TelegramBot(token, { polling: true });

// Chuỗi cấmm
const bannedStringsRegex = /(ca\s?1|ca1|ca\s?2|Ca\s?2|Ca\s?1|Ca1|Ca\s?2|Ca2|C1|C2|c\s?1|c\s?2|C\s?1|C\s?2)\s*/gi;

// Thiết lập cron job để xóa dữ liệu bảng công của 2 ngày trước, ngoại trừ bảng công có groupId -1002108234982
cron.schedule('0 0 * * *', async () => {
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 4);
  const formattedTwoDaysAgo = new Date(twoDaysAgo.toLocaleDateString());

  try {
    const result = await BangCong2.deleteMany({
      date: formattedTwoDaysAgo,
      groupId: { $ne: -1002108234982 }, // Loại trừ các bảng công với groupId này
    });
    console.log(`Đã xóa ${result.deletedCount} bảng công của ngày ${formattedTwoDaysAgo.toLocaleDateString()}`);
  } catch (error) {
    console.error("Lỗi khi xóa dữ liệu từ MongoDB:", error);
  }
});

// Tìm các số theo sau bởi ký tự hoặc từ khóa xác định hành vi
const regex = /\d+(q|Q|c|C|quẩy|cộng|acc)/gi;
const messageQueue = [];
let processingMessage = false;

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  // Chỉ kiểm tra nếu không phải là nhóm có ID
  if (chatId !== -1002103270166) {
    // Kiểm tra nếu tin nhắn chứa chuỗi cấm
    // Kiểm tra cả văn bản và chú thích
  const messageContent = msg.text || msg.caption;
  if (messageContent) {
    // Chỉ thực hiện kiểm tra bảng công nếu tin nhắn chứa chuỗi cấm
    if (regex.test(messageContent)) {
      messageQueue.push(msg); // Đưa tin nhắn vào hàng đợi

    if (!processingMessage) {
          processMessageQueue();
        }
      }
    }
  }
});

async function processMessageQueue() {
  if (messageQueue.length > 0) {
    processingMessage = true; // Đánh dấu đang xử lý tin nhắn
    
    const msg = messageQueue[0];
    const messageContent = msg.text || msg.caption;
    const matches = messageContent.match(regex);
      const userId = msg.from.id;
      const groupId = msg.chat.id;
      
    
      // Tìm tất cả số và ký tự sau số
      // Tìm tất cả số theo sau bởi q, c, Q, C, quẩy, cộng, hoặc acc
      
      let quay = 0;
      let keo = 0;

      if (matches) {
        matches.forEach((match) => {
          const number = parseInt(match); // Lấy số
          const suffix = match.slice(number.toString().length); // Lấy chữ cái hoặc từ theo sau số

          if (suffix.toLowerCase() === 'q' || suffix.toLowerCase() === 'p') {
            quay += number; // Nếu sau số là "q" hoặc "Q", thêm vào "quay"
          } else if (suffix.toLowerCase() === 'c' || suffix === '+') {
            keo += number; // Nếu sau số là "c", "C", hoặc "acc", thêm vào "keo"
          } else if (suffix === 'quẩy') {
            quay += number; // Nếu sau số là "quẩy", thêm vào "quay"
          } else if (suffix === 'cộng') {
            keo += number; // Nếu sau số là "cộng", thêm vào "keo"
          }
        });
      }

        const currentDate = new Date().toLocaleDateString();
        const firstName = msg.from.first_name;
        const lastName = msg.from.last_name;
        const fullName = lastName ? `${firstName} ${lastName}` : firstName;
        
        // Tạo thông báo mới
        const responseMessage = `Bài nộp của ${fullName} đã được ghi nhận với ${quay}q, ${keo}c đang chờ kiểm tra ❤🥳`;

        // Gửi thông báo mới và lưu bảng công
        bot.sendMessage(groupId, responseMessage, { reply_to_message_id: msg.message_id }).then(async () => {
        let bangCong = await BangCong2.findOne({ userId, groupId, date: currentDate });

        if (!bangCong) {
          bangCong = await BangCong2.create({
            userId,
            groupId,
            date: currentDate,
            ten: fullName,
            quay,
            keo,
            tinh_tien: quay * 500 + keo * 1000,
          });
        } else {
          bangCong.quay += quay;
          bangCong.keo += keo;
          bangCong.tinh_tien += quay * 500 + keo * 1000;

          await bangCong.save();
        }
          // Xóa tin nhắn đã xử lý khỏi hàng đợi
      messageQueue.shift();
      
      // Đánh dấu rằng không còn xử lý tin nhắn nào
      processingMessage = false;
      // Nếu còn tin nhắn trong hàng đợi, tiếp tục xử lý
      if (messageQueue.length > 0) {
        setTimeout(processMessageQueue, 5000); // Đợi 4 giây trước khi xử lý tin nhắn tiếp theo
      }
      });
    
  }
}                                                                
          
// Bảng tra cứu tên nhóm dựa trên ID nhóm
const groupNames = {
  "-1002039100507": "CỘNG ĐỒNG NẮM BẮT CƠ HỘI",
  "-1002004082575": "KHÔNG NGỪNG PHÁT TRIỂN",
  "-1002123430691": "DẪN LỐI THÀNH CÔNG",
  "-1002143712364": "CÙNG NHAU CHIA SẺ",
  "-1002128975957": "HƯỚNG TỚI TƯƠNG LAI",
  "-1002080535296": "TRAO ĐỔI CÔNG VIỆC 2",
  "-1002091101362": "TRAO ĐỔI CÔNG VIỆC 1", 
  "-1002129896837": "GROUP I MẠNH ĐỨC CHIA SẺ", 
  "-1002228252389": "BƯỚC ĐI KHỞI NGHIỆP", 
};

// Xử lý lệnh /bc để hiển thị bảng công cho tất cả các nhóm
bot.onText(/\/bc/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const currentDate = new Date().toLocaleDateString(); // Ngày hiện tại
    // Lấy bảng công cho ngày hiện tại, loại trừ nhóm có chatId -1002050799248
    const bangCongs = await BangCong2.find({
      date: currentDate,
      groupId: { $ne: -1002108234982 }, // Loại trừ nhóm này
    });

    if (bangCongs.length === 0) {
      bot.sendMessage(chatId, "Không có bảng công nào cho ngày hôm nay.");
      return;
    }

    // Tạo bảng công phân loại theo ID nhóm
    const groupedByGroupId = {};
    bangCongs.forEach((bangCong) => {
      const groupId = bangCong.groupId ? bangCong.groupId.toString() : ''; // Kiểm tra nếu groupId không undefined
      if (!groupedByGroupId[groupId]) {
        groupedByGroupId[groupId] = [];
      }
      groupedByGroupId[groupId].push(bangCong);
    });

    let response = '';

    // Tạo bảng công cho mỗi nhóm
    for (const groupId in groupedByGroupId) {
      if (!groupId) {
        continue; // Bỏ qua nếu groupId không hợp lệ
      }

      const groupData = groupedByGroupId[groupId];
      const groupName = groupNames[groupId] || `Nhóm ${groupId}`; // Lấy tên nhóm từ bảng tra cứu

      response += `Bảng công nhóm ${groupName}:\n\n`;

      let totalGroupMoney = 0; // Biến để tính tổng số tiền của nhóm

      groupData.forEach((bangCong) => {
        if (bangCong.tinh_tien !== undefined) { // Kiểm tra trước khi truy cập thuộc tính
          const formattedTien = bangCong.tinh_tien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
          response += `${bangCong.ten}\t\t${bangCong.quay}q +\t${bangCong.keo}c\t${formattedTien}vnđ\n`;
          totalGroupMoney += bangCong.tinh_tien; // Tính tổng tiền
        }
      });

      const formattedTotal = totalGroupMoney.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      response += `Tổng tiền: ${formattedTotal}vnđ\n\n`; // Hiển thị tổng tiền của nhóm
    }

    // Nếu response dài hơn 4000 ký tự, tách thành hai phần
    if (response.length > 4000) {
      const middle = Math.floor(response.length / 2);
      const splitIndex = response.lastIndexOf('\n', middle); // Tìm dấu ngắt dòng gần giữa nhất để chia

      const firstPart = response.substring(0, splitIndex).trim();
      const secondPart = response.substring(splitIndex).trim();

      bot.sendMessage(chatId, firstPart); // Gửi phần đầu tiên
      bot.sendMessage(chatId, secondPart); // Gửi phần còn lại
    } else {
      bot.sendMessage(chatId, response.trim()); // Nếu không dài quá, gửi bình thường
    }
  } catch (error) {
    console.error('Lỗi khi truy vấn dữ liệu từ MongoDB:', error);
    bot.sendMessage(chatId, 'Đã xảy ra lỗi khi truy vấn dữ liệu từ cơ sở dữ liệu.');
  }
});


// Lập lịch gửi bảng công tổng hợp vào 9h12 sáng hàng ngày theo giờ Việt Nam
cron.schedule('30 7 * * *', async () => {
  try {
    // Gửi bảng công tổng hợp
    await sendAggregatedData(-1002128289933);
  } catch (error) {
    console.error("Lỗi khi gửi bảng công tổng hợp:", error);
  }
}, {
  scheduled: true,
  timezone: "Asia/Ho_Chi_Minh"
});


bot.onText(/\/sum/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Gọi hàm tổng hợp dữ liệu và gửi bảng công tổng hợp
    await sendAggregatedData(chatId);
  } catch (error) {
    console.error("Lỗi khi truy vấn dữ liệu từ MongoDB:", error);
    bot.sendMessage(chatId, "Đã xảy ra lỗi khi truy vấn dữ liệu từ cơ sở dữ liệu.");
  }
});

async function sendAggregatedData(chatId) {
  try {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - 1); // Ngày hôm qua

    const startOfYesterday = new Date(currentDate.setHours(0, 0, 0, 0)); // Bắt đầu của ngày hôm qua
    const endOfYesterday = new Date(currentDate.setHours(23, 59, 59, 999)); // Kết thúc của ngày hôm qua

    // Truy vấn để tổng hợp bảng công của các thành viên trong ngày hôm qua
    const aggregatedData = await BangCong2.aggregate([
      {
        $match: { 
          date: { $gte: startOfYesterday, $lte: endOfYesterday },
          groupId: { $ne: -1002108234982 } // Loại trừ nhóm -1002108234982
        },
      },
      {
        $group: {
          _id: {
            userId: "$userId",
            ten: "$ten",
          },
          totalQuay: { $sum: "$quay" },
          totalKeo: { $sum: "$keo" },
          totalTinhTien: { $sum: "$tinh_tien" },
        },
      },
      {
        $sort: { totalTinhTien: -1 }, // Sắp xếp theo tổng tiền giảm dần
      },
    ]);

    if (aggregatedData.length === 0) {
      if (chatId) {
        bot.sendMessage(chatId, "Không có bảng công nào cho ngày hôm qua.");
      }
      return;
    }

    let response = "Bảng công tổng hợp cho ngày hôm qua:\n\n";
    response += "HỌ TÊN👩‍🎤\t\tQUẨY💃\tCỘNG➕\tTỔNG TIỀN💰\n";

    aggregatedData.forEach((data) => {
      const formattedTotal = data.totalTinhTien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      response += `${data._id.ten}\t\t${data.totalQuay}q +\t${data.totalKeo}c\t${formattedTotal}vnđ\n`;
    });

    if (chatId) {
      bot.sendMessage(chatId, response);
    } else {
      // Bạn có thể thay đổi logic gửi tin nhắn nếu không có chatId
    }
  } catch (error) {
    console.error("Lỗi khi truy vấn dữ liệu từ MongoDB:", error);
    if (chatId) {
      bot.sendMessage(chatId, "Đã xảy ra lỗi khi truy vấn dữ liệu từ cơ sở dữ liệu.");
    }
  }
}


bot.onText(/\/tong/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Gọi hàm tổng hợp dữ liệu và gửi bảng công tổng hợp
    await sendAggregatedData(chatId);
  } catch (error) {
    console.error("Lỗi khi truy vấn dữ liệu từ MongoDB:", error);
    bot.sendMessage(chatId, "Đã xảy ra lỗi khi truy vấn dữ liệu từ cơ sở dữ liệu.");
  }
});

async function sendAggregatedData(chatId) {
  try {
    const currentDate = new Date(); // Ngày hiện tại

    // Truy vấn để tổng hợp bảng công của các thành viên trong ngày hiện tại
    const aggregatedData = await BangCong2.aggregate([
      {
        $match: { date: new Date(currentDate.toLocaleDateString()),
        groupId: { $ne: -1002108234982 }, // Loại trừ nhóm -1002050799248 // Lọc theo ngày hiện tại
      },
      },

      {
        $group: {
          _id: {
            userId: "$userId",
            ten: "$ten",
          },
          totalQuay: { $sum: "$quay" },
          totalKeo: { $sum: "$keo" },
          totalTinhTien: { $sum: "$tinh_tien" },
        },
      },
      {
        $sort: { totalTinhTien: -1 }, // Sắp xếp theo tổng tiền giảm dần
      },
    ]);

    if (aggregatedData.length === 0) {
      bot.sendMessage(chatId, "Không có bảng công nào cho ngày hôm nay.");
      return;
    }

    let response = "Bảng công tổng hợp cho ngày hôm nay:\n\n";
    response += "HỌ TÊN👩‍🎤\t\tQUẨY💃\tCỘNG➕\tTỔNG TIỀN💰\n";

    aggregatedData.forEach((data) => {
      const formattedTotal = data.totalTinhTien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      response += `${data._id.ten}\t\t${data.totalQuay}q +\t${data.totalKeo}c\t${formattedTotal}vnđ\n`;
    });

    bot.sendMessage(chatId, response);
  } catch (error) {
    console.error("Lỗi khi truy vấn dữ liệu từ MongoDB:", error);
    bot.sendMessage(chatId, "Đã xảy ra lỗi khi truy vấn dữ liệu từ cơ sở dữ liệu.");
  }
}

// Lệnh /reset để xóa bảng công của những ngày trước
bot.onText(/\/reset/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Ngày hiện tại
    const currentDate = new Date().toLocaleDateString();
    
    // Xóa tất cả bảng công có ngày trước ngày hiện tại
    const result = await BangCong2.deleteMany({
      date: { $lt: currentDate },
      groupId: { $ne: -1002108234982 }, // Loại trừ nhóm có chatId -1002050799248
    });

    bot.sendMessage(chatId, `Đã xóa ${result.deletedCount} bảng công của những ngày trước.`);
  } catch (error) {
    console.error('Lỗi khi xóa bảng công:', error);
    bot.sendMessage(chatId, 'Đã xảy ra lỗi khi xóa bảng công. Vui lòng thử lại.');
  }
});

// Hàm loại bỏ icon và emoji từ tên
const normalizeName = (name) => {
  // Loại bỏ các icon, emoji hoặc ký tự đặc biệt không phải chữ cái
  return name.replace(/[^\w\s]/gi, '').toLowerCase().trim();
};

const groupCodes = {
  "cđnbch": "-1002039100507",
  "knpt": "-1002004082575",
  "dltc": "-1002123430691",
  "cncs": "-1002143712364",
  "httl": "-1002128975957",
  "tđcv2": "-1002080535296",
  "tđcv1": "-1002091101362",
  "gimđcs": "-1002129896837",
  "cf": "-1002108234982",
  "bđkn": "-1002228252389", 
};

bot.onText(/\/edit (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1].split(',').map(item => item.trim());
    const groupCode = input[0];
    const ten = input[1];
    const quay = input[2];
    const keo = input[3];
    const date = input[4];

    if (!groupCode || !ten || !quay || !keo || !date) {
        bot.sendMessage(chatId, 'Sai cú pháp. Vui lòng nhập đúng định dạng: /edit groupId, tên thành viên, số quay, số keo, ngày/tháng');
        return;
    }

    const groupId = groupCodes[groupCode];
    if (!groupId) {
        bot.sendMessage(chatId, `Mã nhóm không hợp lệ: ${groupCode}`);
        return;
    }

    const [day, month] = date.split('/');
    const year = new Date().getFullYear();
    const entryDate = new Date(year, month - 1, day);

    try {
        // Tìm kiếm thành viên gần đúng
        const regex = new RegExp(ten.split('').join('.*'), 'i');
        const bangCong = await BangCong2.findOne({
            groupId: Number(groupId),
            ten: { $regex: regex },
            date: entryDate
        });

        if (!bangCong) {
            bot.sendMessage(chatId, `Không tìm thấy bản ghi để cập nhật cho ${ten.trim()} vào ngày ${date}.`);
            return;
        }

        bangCong.quay = Number(quay);
        bangCong.keo = Number(keo);
        bangCong.tinh_tien = (Number(quay.trim()) * 500) + (Number(keo.trim()) * 1000); // Giả định tính tiền công là tổng số quay và keo nhân 1000
        await bangCong.save();

        bot.sendMessage(chatId, `Cập nhật thành công cho ${ten.trim()} vào ngày ${date}.`);
    } catch (error) {
        console.error('Lỗi khi cập nhật dữ liệu:', error);
        bot.sendMessage(chatId, 'Lỗi khi cập nhật dữ liệu.');
    }
});

// Các xử lý khác (ví dụ: xử lý message)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  // Các đoạn mã khác như xử lý bảng công...
});

// Lệnh /bc2 để xem bảng công từng ngày của nhóm -1002050799248 và bảng tổng số tiền của từng thành viên trong bảng công các ngày
bot.onText(/\/bangcong2/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const currentDate = new Date().toLocaleDateString();

    // Tìm tất cả bảng công cho nhóm -1002050799248
    const bangCongs = await BangCong2.find({ groupId: -1002108234982 });

    if (bangCongs.length === 0) {
      bot.sendMessage(chatId, "Không có bảng công nào cho nhóm Be truly rich");
      return;
    }

    // Phân loại bảng công theo ngày
    const groupedByDate = {};
    bangCongs.forEach((bangCong) => {
      const date = bangCong.date;
      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push(bangCong);
    });

    let response = '';

    // Tạo bảng công cho từng ngày
    for (const date in groupedByDate) {
      const dayData = groupedByDate[date];
      response += `Bảng công ngày ${date}:\n\n`;

      dayData.forEach((bangCong) => {
        const formattedTien = bangCong.tinh_tien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        response += `${bangCong.ten}\t\t${bangCong.quay}q +\t${bangCong.keo}c\t${formattedTien}vnđ\n`;
      });

      response += '\n';
    }

    // Tính tổng số tiền của từng thành viên
    const totalByMember = {};
    bangCongs.forEach((bangCong) => {
      if (!totalByMember[bangCong.ten]) {
        totalByMember[bangCong.ten] = 0;
      }
      totalByMember[bangCong.ten] += bangCong.tinh_tien;
    });

    response += 'Bảng tổng số tiền của từng thành viên:\n\n';
    let totalSum = 0;
    for (const member in totalByMember) {
      const formattedTotal = totalByMember[member].toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      response += `${member}: ${formattedTotal}vnđ\n`;
      totalSum += totalByMember[member];
    }

    // Tính tổng số tiền của tất cả thành viên
    const formattedTotalSum = totalSum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    response += `\nTổng số tiền của tất cả thành viên: ${formattedTotalSum}vnđ\n`;

    bot.sendMessage(chatId, response.trim());
  } catch (error) {
    console.error('Lỗi khi truy vấn bảng công:', error);
    bot.sendMessage(chatId, 'Đã xảy ra lỗi khi truy vấn bảng công. Vui lòng thử lại.');
  }
});

// Lệnh /reset2 để xóa bảng công của những ngày trước từ nhóm có chatId -1002050799248
bot.onText(/\/xoa/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const currentDate = new Date().toLocaleDateString();

    // Xóa tất cả bảng công của những ngày trước cho nhóm có chatId -1002050799248
    const result = await BangCong2.deleteMany({
      date: { $lt: currentDate },
      groupId: -1002108234982, // Chỉ xóa bảng công của nhóm này
    });

    bot.sendMessage(chatId, `Đã xóa ${result.deletedCount} bảng công của những ngày trước từ nhóm -1002050799248.`);
  } catch (error) {
    console.error('Lỗi khi xóa bảng công:', error);
    bot.sendMessage(chatId, 'Đã xảy ra lỗi khi xóa bảng công. Vui lòng thử lại.');
  }
});

bot.onText(/\/delete(\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  try {
    // Lấy số ngày từ lệnh
    const days = parseInt(match[1], 10);

    // Lấy ngày hiện tại
    const currentDate = new Date();
    // Trừ số ngày để lấy ngày của (số ngày) trước
    currentDate.setDate(currentDate.getDate() - days);
    const targetDate = currentDate.toLocaleDateString();

    // Xóa tất cả bảng công của những ngày từ (số ngày) trước trở đi cho nhóm có chatId -1002050799248
    const result = await BangCong2.deleteMany({
      date: { $lt: targetDate },
      groupId: -1002108234982, // Chỉ xóa bảng công của nhóm này
    });

    bot.sendMessage(chatId, `Đã xóa ${result.deletedCount} bảng công của những ngày từ ${days} ngày trước từ nhóm -1002050799248.`);
  } catch (error) {
    console.error('Lỗi khi xóa bảng công:', error);
    bot.sendMessage(chatId, 'Đã xảy ra lỗi khi xóa bảng công. Vui lòng thử lại.');
  }
});




// Lập lịch gửi bảng công tổng hợp vào 9h12 sáng hàng ngày theo giờ Việt Nam
cron.schedule('31 7 * * *', async () => {
  try {
    // Gửi bảng công tổng hợp vào groupId -1002128289933
    await sendAggregatedData(-1002128289933);
  } catch (error) {
    console.error("Lỗi khi gửi bảng công tổng hợp:", error);
  }
}, {
  scheduled: true,
  timezone: "Asia/Ho_Chi_Minh"
});

// Xử lý lệnh /homqua để hiển thị bảng công cho tất cả các nhóm
bot.onText(/\/homqua/, async (msg) => {
  const chatId = msg.chat.id;
  await sendAggregatedData(chatId);
});

async function sendAggregatedData(chatId) {
  try {
    // Tính ngày hôm qua
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));
    const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999));
    
    // Lấy bảng công của ngày hôm qua, loại trừ nhóm có chatId -1002108234982
    const bangCongs = await BangCong2.find({
      date: { $gte: startOfYesterday, $lte: endOfYesterday },
      groupId: { $ne: -1002108234982 }, // Loại trừ nhóm này
    });

    if (bangCongs.length === 0) {
      bot.sendMessage(chatId, `Không có bảng công nào cho ngày ${yesterday.toLocaleDateString()}.`);
      return;
    }

    // Tạo bảng công phân loại theo ID nhóm
    const groupedByGroupId = {};
    bangCongs.forEach((bangCong) => {
      const groupId = bangCong.groupId ? bangCong.groupId.toString() : '';
      if (!groupedByGroupId[groupId]) {
        groupedByGroupId[groupId] = [];
      }
      groupedByGroupId[groupId].push(bangCong);
    });

    let response = '';

    // Tạo bảng công cho mỗi nhóm
    for (const groupId in groupedByGroupId) {
      if (!groupId) {
        continue;
      }

      const groupData = groupedByGroupId[groupId];
      const groupName = groupNames[groupId] || `Nhóm ${groupId}`;

      response += `Bảng công nhóm ${groupName} (${yesterday.toLocaleDateString()}):\n\n`;

      let totalGroupMoney = 0;

      groupData.forEach((bangCong) => {
        if (bangCong.tinh_tien !== undefined) {
          const formattedTien = bangCong.tinh_tien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
          response += `${bangCong.ten}\t\t${bangCong.quay}q +\t${bangCong.keo}c\t${formattedTien}vnđ\n`;
          totalGroupMoney += bangCong.tinh_tien;
        }
      });

      const formattedTotal = totalGroupMoney.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      response += `Tổng tiền: ${formattedTotal}vnđ\n\n`;
    }

    // Kiểm tra độ dài response và gửi tin nhắn
    if (response.length > 4000) {
      const middle = Math.floor(response.length / 2);
      const splitIndex = response.lastIndexOf('\n', middle);

      const firstPart = response.substring(0, splitIndex).trim();
      const secondPart = response.substring(splitIndex).trim();

      bot.sendMessage(chatId, firstPart);
      bot.sendMessage(chatId, secondPart);
    } else {
      bot.sendMessage(chatId, response.trim());
    }
  } catch (error) {
    console.error('Lỗi khi truy vấn dữ liệu từ MongoDB:', error);
    bot.sendMessage(chatId, 'Đã xảy ra lỗi khi truy vấn dữ liệu từ cơ sở dữ liệu.');
  }
}



const groups = {
  "-1002039100507": "BẢNG CÔNG NHÓM CỘNG ĐỒNG NẮM BẮT CƠ HỘI",
  "-1002004082575": "BẢNG CÔNG NHÓM KHÔNG NGỪNG PHÁT TRIỂN",
  "-1002123430691": "BẢNG CÔNG NHÓM DẪN LỐI THÀNH CÔNG",
  "-1002143712364": "BẢNG CÔNG NHÓM CÙNG NHAU CHIA SẺ",
  "-1002128975957": "BẢNG CÔNG NHÓM HƯỚNG TỚI TƯƠNG LAI",
  "-1002080535296": "BẢNG CÔNG NHÓM TRAO ĐỔI CÔNG VIỆC 2",
  "-1002091101362": "BẢNG CÔNG NHÓM TRAO ĐỔI CÔNG VIỆC 1", 
  "-1002129896837": "BẢNG CÔNG NHÓM GROUP I MẠNH ĐỨC CHIA SẺ", 
  "-1002228252389": "BẢNG CÔNG NHÓM BƯỚC ĐI KHỞI NGHIỆP", 
};


let excludedGroups = [];
let additionalGroupsByDate = {}; // Object to store additional groups by date

// Hàm parse group codes
function parseGroupCodes(text) {
  return text.split(',').map(code => code.trim().toLowerCase());
}

// Lệnh /tempo: bỏ qua bảng công các nhóm
bot.onText(/\/tempo\s+\[([^\]]+)\]/, (msg, match) => {
  const chatId = msg.chat.id;
  const groupCodesToExclude = parseGroupCodes(match[1]);

  excludedGroups = groupCodesToExclude.map(code => groupCodes[code]);
  bot.sendMessage(chatId, `Đã bỏ qua bảng công các nhóm: ${groupCodesToExclude.join(', ')}`);
});

// Lệnh /add: thêm bảng công các nhóm từ ngày/tháng cụ thể
bot.onText(/\/add\s+\[([^\]]+)\]\s+(\d{1,2})\/(\d{1,2})/, (msg, match) => {
  const chatId = msg.chat.id;
  const groupCodesToAdd = parseGroupCodes(match[1]);
  const day = parseInt(match[2]);
  const month = parseInt(match[3]);

  const dateStr = `${day}/${month}`;

  if (!additionalGroupsByDate[dateStr]) {
    additionalGroupsByDate[dateStr] = [];
  }

  groupCodesToAdd.forEach(code => {
    const groupId = groupCodes[code];
    if (!additionalGroupsByDate[dateStr].includes(groupId)) {
      additionalGroupsByDate[dateStr].push(groupId);
    }
  });

  bot.sendMessage(chatId, `Đã ghi nhớ các nhóm: ${groupCodesToAdd.join(', ')} ngày ${dateStr} sẽ được tính thêm`);
});

// Chức năng tự động gửi hình ảnh vào 9h sáng mỗi ngày (theo giờ Việt Nam)
cron.schedule('30 13 * * *', async () => { // 2 giờ UTC là 9 giờ sáng theo giờ Việt Nam
  const chatId = '-1002103270166';
  await generateAndSendImages(chatId);
});

async function generateAndSendImages(chatId) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const startOfYesterday = new Date(yesterday);
  startOfYesterday.setHours(0, 0, 0, 0);
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999);
  const dateStr = `${yesterday.getDate()}/${yesterday.getMonth() + 1}`;

  try {
    let totalAmountByUser = {}; // Đối tượng để lưu tổng số tiền của mỗi người dùng
    const allGroups = [...Object.keys(groups), ...(additionalGroupsByDate[dateStr] || [])];

    for (const groupId of allGroups) {
      if (excludedGroups.includes(groupId)) continue; // Bỏ qua các nhóm trong danh sách loại trừ

      const groupName = groups[groupId] || `Nhóm ${groupId}`;
      const bangCongs = await BangCong2.find({
        date: { $gte: startOfYesterday, $lte: endOfYesterday },
        groupId: Number(groupId)
      });

      if (bangCongs.length === 0) {
        bot.sendMessage(chatId, `Không có dữ liệu bảng công cho ngày hôm qua cho nhóm ${groupName}.`);
        continue;
      }

      let totalAmount = 0;
      let content = bangCongs.map(bangCong => {
        totalAmount += bangCong.tinh_tien;
        totalAmountByUser[bangCong.ten] = (totalAmountByUser[bangCong.ten] || 0) + bangCong.tinh_tien;
        return `${bangCong.ten}\t${bangCong.quay}\t${bangCong.keo}\t${bangCong.tinh_tien}vnđ`;
      }).join('\n');

      const imageUrl = await createImage(content, groupName, totalAmount, dateStr);
      await bot.sendPhoto(chatId, imageUrl);
    }

    let totalAmountContent = '';
    for (const [userName, totalAmount] of Object.entries(totalAmountByUser)) {
      totalAmountContent += `<TR><TD ALIGN="LEFT" STYLE="font-weight: bold;">${userName}</TD><TD ALIGN="CENTER">${totalAmount}vnđ</TD></TR>`;
    }
    const totalAmountImageUrl = await createTotalAmountImage(totalAmountContent);
    await bot.sendPhoto(chatId, totalAmountImageUrl);

    const messages = [
            `Attention, attention! Bảng công (${dateStr}) nóng hổi vừa ra lò, ai chưa check điểm danh là lỡ mất cơ hội "ăn điểm" với sếp đó nha!`,
            `Chuông báo thức đã vang! ⏰⏰⏰ Bảng công (${dateStr}) đã có mặt, ai trễ hẹn là "ăn hành" với team trưởng Hieu Gà đó nha!`,           
`Quà tặng bất ngờ đây! Bảng công (${dateStr}) xinh xắn đã đến tay mọi người, ai check nhanh sẽ có quà ngon đó nha!`,
`Thám tử bảng công đã xuất hiện! ️‍♀️️‍♂️ Hãy nhanh chóng kiểm tra bảng công (${dateStr}) để tìm ra "bí ẩn" điểm số của bạn nào!`,
`Vinh danh những chiến binh cống hiến! Bảng công (${dateStr}) là minh chứng cho sự nỗ lực của bạn, hãy tự hào khoe chiến công với mọi người nhé!`,
`Nhảy đi nào các chiến binh! Bảng công (${dateStr}) sôi động đã có mặt, hãy cùng "phiêu" theo nhịp điệu quẩy nào!`,
`Học sinh ngoan đâu rồi điểm danh! ‍♀️‍♂️ Bảng công (${dateStr}) chính là bảng điểm "siêu cấp" để bạn đánh giá bản thân đó nha!`,
`Bếp trưởng đãi bảng công xin mời quý thực khách! Bảng công (${dateStr}) "đậm đà" hương vị thành công, mời mọi người thưởng thức!`,
`Quà tặng tri ân của Củ Khoai Nóng dành cho "quẩy thủ" xuất sắc! Bảng công (${dateStr}) là lời cảm ơn chân thành của công ty dành cho những ai đã cống hiến hết mình! ❤️❤️❤️`,
`Bùng nổ niềm vui với bảng công (${dateStr})! Hãy cùng nhau chúc mừng những thành công và tiếp tục tiến bước chinh phục những mục tiêu mới!`,
`Bảng công (${dateStr}) - Phiên bản "limited edition", hãy nhanh tay "sưu tầm" trước khi hết hàng! ‍♀️‍♂️`,
`Củ Khoai Nóng xin cảnh báo: Bảng công (${dateStr}) có thể gây nghiện, hãy cẩn thận khi sử dụng! ⚠️`,
`Bảng công (${dateStr}) - Phiên bản "limited edition", hãy nhanh tay "sưu tầm" trước khi hết hàng! ‍♀️‍♂️`,

        ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    const message = await bot.sendMessage(chatId, randomMessage);
    await bot.pinChatMessage(chatId, message.message_id);
  } catch (error) {
    console.error('Lỗi khi truy vấn dữ liệu từ MongoDB:', error);
    bot.sendMessage(chatId, 'Failed to create image.');
  }
}

async function createImage(content, groupName, totalAmount, dateStr) {
  const url = 'https://quickchart.io/graphviz?format=png&layout=dot&graph=';
  const graph = `
    digraph G {
      node [shape=plaintext];
      a [label=<
        <TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" STYLE="font-family: 'Arial', sans-serif; border: 1px solid black;">
          <TR><TD COLSPAN="4" ALIGN="CENTER" BGCOLOR="#FFCC00" STYLE="font-size: 16px; font-weight: bold;">${groupName} - ${dateStr}</TD></TR>
          <TR STYLE="font-weight: bold; background-color: #FFCC00;">
            <TD ALIGN="CENTER">Tên</TD>
            <TD ALIGN="CENTER">Quẩy</TD>
            <TD ALIGN="CENTER">Cộng</TD>
            <TD ALIGN="CENTER">Tiền công</TD>
          </TR>
                    ${content.split('\n').map(line => `<TR><TD ALIGN="LEFT" STYLE="font-weight: bold;">${line.split('\t').join('</TD><TD ALIGN="CENTER">')}</TD></TR>`).join('')}
          <TR STYLE="font-weight: bold;">
            <TD COLSPAN="3" ALIGN="LEFT">Tổng số tiền</TD>
            <TD ALIGN="CENTER">${totalAmount}vnđ</TD>
          </TR>
        </TABLE>
      >];
    }
  `;
  const imageUrl = `${url}${encodeURIComponent(graph)}`;
  return imageUrl;
}

async function createTotalAmountImage(content, dateStr) {
  const url = 'https://quickchart.io/graphviz?format=png&layout=dot&graph=';
  const graph = `
    digraph G {
      node [shape=plaintext];
      a [label=<
        <TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" STYLE="font-family: 'Arial', sans-serif; border: 1px solid black;">
          <TR><TD COLSPAN="2" ALIGN="CENTER" BGCOLOR="#FFCC00" STYLE="font-size: 16px; font-weight: bold;">Tổng số tiền của từng thành viên từ tất cả các nhóm ${dateStr}</TD></TR>
          ${content}
        </TABLE>
      >];
    }
  `;
  const imageUrl = `${url}${encodeURIComponent(graph)}`;
  return imageUrl;
}

bot.onText(/\/anhbangcong/, async (msg) => {
  const chatId = msg.chat.id;
  await generateAndSendImages(chatId);
});


// Thay thế YOUR_API_KEY bằng API key OpenWeatherMap của bạn
const apiKey = '679360c3eef6d2165d3833d29b5eccf4';

// ChatId của nhóm bạn muốn gửi dự báo thời tiết
const chatId = -1002103270166;

// Bảng dịch các trạng thái thời tiết từ tiếng Anh sang tiếng Việt
const weatherDescriptions = {
  'clear sky': 'ngày nắng nóng, có nơi nắng nóng gay gắt 🌤️',
  'few clouds': 'ngày nắng nóng 🌤️',
  'scattered clouds': 'Có mây, trưa chiều trời hửng nắng ☁',
  'broken clouds': 'Có mây, trưa chiều trời hửng nắng ☁',
  'overcast clouds': 'Nhiều mây ☁',
  'shower rain': 'ngày mưa rào và rải rác có giông 🌫️',
  'rain': 'ngày có mưa rào và có giông vài nơi 🌫️',
  'thunderstorm': 'Cụ bộ có mưa to',
  'squall': 'Gió giật',
  'drizzle': 'mưa nhỏ',
  'light rain': 'ngày có lúc có mưa rào và rải rác có giông 🌫️',
  'moderate rain': 'có mưa vừa đến mưa to',
  'heavy rain': 'mưa to',
  'light thunderstorm': 'giông rải rác',
  'thunderstorm with heavy rain': 'mưa rào và giông vài nơi 🌫️',
  'heavy thunderstorm': 'có giông vài nơi',
  'cold': 'trời lạnh',
  'hot': 'có nắng nóng',
};

// Bảng ánh xạ để tránh trùng lặp câu từ
const stateMapping = {
  'ngày có lúc có mưa rào và rải rác có giông 🌫️': 'có mưa vừa, mưa to và có nơi có giông 🌫️',
  'ngày có mưa rào và có giông vài nơi 🌫️': 'có mưa rào và giông rải rác 🌫️',
  'trời nắng': 'trời quang đãng',
  'Có mây, trưa chiều trời hửng nắng ☁': 'trời quang',
  // (Thêm các ánh xạ khác nếu cần)
};

// Hàm lấy hướng gió dựa trên độ
function getWindDirection(deg) {
  if (deg >= 337.5 || deg < 22.5) return 'Bắc';
  if (deg >= 22.5 && deg < 67.5) return 'Đông Bắc';
  if (deg >= 67.5 && deg < 112.5) return 'Đông';
  if (deg >= 112.5 && deg < 157.5) return 'Đông Nam';
  if (deg >= 157.5 && deg < 202.5) return 'Nam';
  if (deg >= 202.5 && deg < 247.5) return 'Tây Nam';
  if (deg >= 247.5 && deg < 292.5) return 'Tây';
  if (deg >= 292.5 && deg < 337.5) return 'Tây Bắc';
}

// Hàm lấy cấp gió dựa trên tốc độ gió
function getWindSpeedLevel(windSpeed) {
  if (windSpeed < 2) return 1;
  if (windSpeed >= 2 && windSpeed < 5) return 2;
  if (windSpeed >= 5 && windSpeed < 10) return 3;
  if (windSpeed >= 10 && windSpeed < 17) return 4;
  if (windSpeed >= 17 && windSpeed < 25) return 5;
  if (windSpeed >= 25 && windSpeed < 33) return 6;
  if (windSpeed >= 33 && windSpeed < 42) return 7;
  if (windSpeed >= 42 && windSpeed < 52) return 8;
  if (windSpeed >= 52 && windSpeed < 63) return 9;
  if (windSpeed >= 63) return 10;
}

// Hàm lấy trạng thái thời tiết phổ biến nhất
function getMostCommonWeatherDescription(descriptions) {
  const count = descriptions.reduce((acc, desc) => {
    if (!acc[desc]) {
      acc[desc] = 1;
    } else {
      acc[desc] += 1;
    }
    return acc;
  }, {});

  let mostCommon = '';
  let maxCount = 0;

  for (const desc in count) {
    if (count[desc] > maxCount) {
      mostCommon = desc;
      maxCount = count[desc];
    }
  }

  return mostCommon;
}

// Hàm định dạng ngày theo chuẩn "ngày/tháng/năm"
function formatDate(date) {
  const formatter = new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric'
  });
  return formatter.format(date);
}

// Hàm chọn ảnh GIF dựa trên trạng thái thời tiết
function selectWeatherGif(morningDescription, eveningDescription) {
  const rainKeywords = ['ngày có lúc có mưa rào và rải rác có giông 🌫️', 'ngày có mưa rào và có giông vài nơi 🌫️', 'có mưa rào và giông rải rác 🌫️', 'có mưa vừa đến mưa to' ];
  const cloudKeywords = ['Có mây ☁️', 'Nhiều mây ☁', 'Nhiều mây ☁'];
  const sunKeywords = ['ngày nắng nóng 🌤️', 'ngày nắng nóng, có nơi nắng nóng gay gắt 🌤️', 'Có mây, trưa chiều trời hửng nắng ☁'];
  

  // Nếu buổi sáng hoặc buổi chiều tối có mưa rào, giông và có mây
  if ((rainKeywords.some(k => morningDescription.includes(k)) && sunKeywords.some(k => morningDescription.includes(k))) || 
      (rainKeywords.some(k => eveningDescription.includes(k)) && sunKeywords.some(k => eveningDescription.includes(k)))) {
    return 'https://iili.io/JrXfzI1.gif'; // GIF cho mưa và mây
  }

  // Nếu buổi sáng hoặc buổi chiều tối có nắng hoặc nắng nóng
  if (sunKeywords.some(k => morningDescription.includes(k)) || sunKeywords.some(k => eveningDescription.includes(k))) {
    return 'https://iili.io/JrXLVxS.gif'; // GIF cho trời nắng
  }

  // Nếu không có mưa rào và giông
  if (!rainKeywords.some(k => morningDescription.includes(k)) && !rainKeywords.some(k => eveningDescription.includes(k))) {
    return 'https://iili.io/JrXLVxS.gif'; // GIF cho thời tiết không mưa rào và giông
  }

  return null; // Không có GIF
}



// Hàm lấy dự báo thời tiết chi tiết cho Hà Nội
function getDailyWeatherForecast() {
  const url = `https://api.openweathermap.org/data/2.5/forecast?q=Hanoi,Vietnam&appid=${apiKey}&units=metric`;

  request(url, (error, response, body) => {
    if (error) {
      console.error('Lỗi khi kết nối tới OpenWeatherMap:', error);
      return;
    }

    const data = JSON.parse(body);
    const forecasts = data.list;

    // Lấy ngày hiện tại từ timestamp và định dạng thành "ngày/tháng/năm"
    const currentDate = formatDate(new Date(forecasts[0].dt * 1000));

    // Tìm nhiệt độ thấp nhất và cao nhất trong ngày
    const minTemp = Math.min(...forecasts.map(f => f.main.temp_min));
    const maxTemp = Math.max(...forecasts.map(f => f.main.temp_max));

    // Buổi sáng chỉ hiển thị tổng 2 trạng thái
    const morningForecasts = forecasts.slice(0, 4); // Dự báo buổi sáng
    
    // Trạng thái mây duy nhất
    const cloudTypes = ['Có mây ☁️', 'Nhiều mây ☁', 'Nhiều mây ☁'];
    const uniqueCloudDescription = morningForecasts
      .map(f => weatherDescriptions[f.weather[0].description] || f.weather[0].description)
      .find(desc => cloudTypes.includes(desc));

    // Trạng thái khác
    const otherDescriptions = morningForecasts
      .map(f => weatherDescriptions[f.weather[0].description] || f.weather[0].description)
      .filter(desc => !cloudTypes.includes(desc));

    // Chọn 1 trạng thái không phải mây
    const nonCloudDescription = otherDescriptions[0];

    // Tổng hợp trạng thái buổi sáng
    const morningDescriptions = [uniqueCloudDescription, nonCloudDescription].filter(Boolean).join(", ");

    // Lấy mô tả duy nhất buổi chiều tối đến đêm
    const eveningForecasts = forecasts.slice(4, 8);
    const eveningDescriptions = eveningForecasts.map(
      f => weatherDescriptions[f.weather[0].description] || f.weather[0].description
    );

    let mostCommonEveningDescription = getMostCommonWeatherDescription(eveningDescriptions);

    // Nếu trạng thái buổi chiều tối đến đêm trùng với buổi sáng, thay đổi nội dung
    if (morningDescriptions.includes(mostCommonEveningDescription)) {
      mostCommonEveningDescription = stateMapping[mostCommonEveningDescription] || mostCommonEveningDescription;
    }
    // Kiểm tra có mưa rào, mưa giông, mưa lớn không
    const hasRainyWeather = [...morningForecasts, ...eveningForecasts].some(f =>
      ['ngày có lúc có mưa rào và rải rác có giông 🌫️', 'ngày có mưa rào và có giông vài nơi 🌫️', 'có mưa rào và giông rải rác 🌫️'].includes(weatherDescriptions[f.weather[0].description] || f.weather[0].description)
    );

    // Tìm tốc độ gió cao nhất và thấp nhất trong ngày
    const minWindSpeed = Math.min(...forecasts.map(f => f.wind.speed));
    const maxWindSpeed = Math.max(...forecasts.map(f => f.wind.speed));

    const wind_direction = getWindDirection(forecasts[forecasts.length - 1].wind.deg);

    

    let forecastMessage = `Dự báo thời tiết ngày ${currentDate}, khu vực Hà Nội:\n`;

    

    
    forecastMessage += `\n ${morningDescriptions},`;
    forecastMessage += ` chiều tối và đêm ${mostCommonEveningDescription}.`;
    forecastMessage += ` Gió ${wind_direction} cấp ${getWindSpeedLevel(minWindSpeed)}-${getWindSpeedLevel(maxWindSpeed)}.`;

    // Nếu có các trạng thái mưa rào, giông bão, mưa lớn, thêm cảnh báo
    if (hasRainyWeather) {
      forecastMessage += ` ⛈️ Trong mưa giông có khả năng xảy ra lốc, sét, mưa đá và gió giật mạnh.`;
    }
    forecastMessage += ` Nhiệt độ từ ${Math.round(minTemp)}°C đến ${Math.round(maxTemp)}°C🌡️. Thời tiết như này không quẩy thì hơi phí!`;

    // Chọn ảnh GIF phù hợp
    const selectedGif = selectWeatherGif(morningDescriptions, mostCommonEveningDescription);

    // Nếu có ảnh GIF, gửi ảnh GIF thay vì hiển thị URL
    if (selectedGif) {
      bot.sendAnimation(chatId, selectedGif, { caption: forecastMessage });
    } else {
      bot.sendMessage(chatId, forecastMessage);
    }
  });
}
// Thiết lập cron để gọi hàm vào 7 giờ sáng theo múi giờ Việt Nam
cron.schedule('0 6 * * *', getDailyWeatherForecast, {
  timezone: "Asia/Ho_Chi_Minh", // Đặt múi giờ cho Việt Nam
});

// Thiết lập các cron jobs
resetDailyGiftStatus(DailyGiftStatus); // Truyền mô hình DailyGiftStatus
sendMorningMessage(bot);

// Xử lý callback từ Telegram
bot.on('callback_query', async (callbackQuery) => {
  await handleGiftClaim(bot, callbackQuery, BangCong2, DailyGiftStatus); // Truyền mô hình DailyGiftStatus
});

//news.js
// ChatId của nhóm
const groupChatId = -1002103270166; // Thay bằng ChatId của nhóm bạn

// Thiết lập lịch trình gửi tin nhắn vào nhóm
setupNewsSchedule(bot, groupChatId);

//warningMember.js
bot.on('message', (msg) => {
  handleMessage(bot, msg, groupNames);
});

cron.schedule('50 6 * * *', async () => {
  await resetKeywords();
}, {
  timezone: "Asia/Ho_Chi_Minh"
});

bot.onText(/\/reset/, async (msg) => {
  await resetKeywords();
  bot.sendMessage(msg.chat.id, "Đã reset trường keyword của tất cả các tin nhắn.");
});








//forum.js
// Lịch trình để xóa hết dữ liệu từ schema vào 0h00 hàng ngày
cron.schedule('0 0 * * *', async () => {
  try {
    // Xóa hết dữ liệu từ schema
    await Message.deleteMany({});
    console.log('Đã xóa hết dữ liệu từ schema Message.');
  } catch (error) {
    console.error('Lỗi khi xóa dữ liệu từ schema Message:', error);
  }
});

// Hàm lấy emoji rank dựa theo level
function getRankEmoji(level) {
  if (level >= 1 && level <= 10) return '🥚';
  if (level >= 11 && level <= 15) return '🐣';
  if (level >= 16 && level <= 20) return '🐓';
  if (level >= 21 && level <= 30) return '🥉';
  if (level >= 31 && level <= 40) return '🥈';
  if (level >= 41 && level <= 55) return '🏅';
  if (level >= 56 && level <= 60) return '⚜️';
if (level >= 61 && level <= 65) return '🪽';
  if (level >= 66 && level <= 70) return '🏵️';
  if (level >= 71 & level <= 75) return '🧊';
  if (level >= 76 && level <= 80) return '💠';
  if (level >= 81 && level <= 85) return '💎VIP';
  if (level >= 86 && level <= 90) return '🪩VIP';
  if (level >= 91 && level <= 95) return '🩻VIP';
  if (level >= 91 && level >= 100) return 'ﮩ٨ـﮩﮩ٨ـ🫀ﮩ٨ـﮩﮩ٨ـADMIN🔑';
  return '';
}

// Hàm lấy emoji sao dựa theo phần trăm level
function getStarEmoji(levelPercent) {
  if (levelPercent >= 0 && levelPercent <= 25) return '✮';
  if (levelPercent >= 26 && levelPercent <= 50) return '✮✮';
  if (levelPercent >= 51 && levelPercent <= 75) return '✮✮✮';
  if (levelPercent >= 76 && levelPercent <= 90) return '✮✮✮✮';
  if (levelPercent >= 91 && levelPercent <= 100) return '✮✮✮✮✮';
  if (levelPercent >= 101 && levelPercent <= 1000) return '✪✪✪✪✪';
  return '';
}

// Lệnh /start để tham gia bot
bot.onText(/\/start/, async (msg) => {
  const userId = msg.from.id;
  const fullname = `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();
  const opts = {
    reply_markup: {
      keyboard: [
        [{ text: 'Xem tài khoản' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };

  try {
    // Kiểm tra xem thành viên đã tồn tại chưa
    let member = await Member.findOne({ userId });

    if (!member) {
      // Tạo mới thành viên nếu chưa tồn tại
      member = new Member({
        userId,
        fullname,
        level: 1,
        levelPercent: 0,
        assets: {
          quay: 0,
          keo: 0,
          vnd: 0
        }
      });

      await member.save();
      bot.sendMessage(msg.chat.id, `Chào mừng ${fullname} đã tham gia bot!`, opts);
     
    } else {
      bot.sendMessage(msg.chat.id, `${fullname}, bạn đã tham gia bot trước đó.`, opts);
    }
  } catch (error) {
    console.error('Lỗi khi thêm thành viên:', error);
    bot.sendMessage(msg.chat.id, 'Đã xảy ra lỗi khi thêm bạn vào hệ thống.');
  }
});

// Xử lý tin nhắn và hiển thị theo định dạng yêu cầu
bot.on('message', async (msg) => {
  // Kiểm tra nếu tin nhắn không phải từ cuộc trò chuyện cá nhân (chat riêng tư) thì bỏ qua
  if (msg.chat.type !== 'private') return;

  if (msg.text && (msg.text.startsWith('/') || msg.text.startsWith('Xem tài khoản'))) return; // Bỏ qua lệnh bot và "Xem tài khoản"


  const userId = msg.from.id;

  try {
    const member = await Member.findOne({ userId });

    if (!member) {
      bot.sendMessage(msg.chat.id, 'Bạn cần nhập /start để tham gia bot trước.');
      return;
    }

    const replyOpts = {
      reply_markup: {
        keyboard: [
          [{ text: 'Xem tài khoản' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      },
      parse_mode: 'HTML'
    };

    const fullname = member.fullname;
    const level = member.level;
    const levelPercent = member.levelPercent;

    const rankEmoji = getRankEmoji(level);
    const starEmoji = getStarEmoji(levelPercent);

    const captionText = msg.caption || 'hình ảnh'; 
    const responseMessage = `Quẩy thủ: <a href="tg://user?id=${userId}">${fullname}</a> ${rankEmoji} (Level: ${level})\n${starEmoji} (${levelPercent}%)\n\n${msg.text || captionText}`;

    // Lưu tin nhắn gốc vào database
    const originalMessage = new Message({
      messageId: msg.message_id,
      userId: msg.from.id,
      chatId: msg.chat.id,
      text: msg.text || captionText
   
    });

    await originalMessage.save();

    // Xóa tin nhắn gốc
    bot.deleteMessage(msg.chat.id, msg.message_id.toString());

    // Gửi tin nhắn theo định dạng yêu cầu cho chính người gửi
    if (msg.photo) {
      const photoId = msg.photo[msg.photo.length - 1].file_id;
      await bot.sendPhoto(msg.chat.id, photoId, replyOpts, { caption: responseMessage, parse_mode: 'HTML' });
    } else {
      await bot.sendMessage(msg.chat.id, responseMessage, replyOpts, { parse_mode: 'HTML' });
    }

    // Tạo inline keyboard
    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Trả lời tin nhắn này', callback_data: `reply_${msg.message_id}` }
          ]
        ]
      }
    };
    
    
       // Gửi tin nhắn tới tất cả thành viên khác kèm inline keyboard (bỏ qua phần này nếu là tin nhắn trả lời)
    if (!msg.reply_to_message) {
      const members = await Member.find({});
      for (let member of members) {
        if (member.userId !== userId) {
          if (msg.photo) {
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            await bot.sendPhoto(member.userId, photoId, { caption: responseMessage, parse_mode: 'HTML', ...opts });
          } else {
            await bot.sendMessage(member.userId, responseMessage, { parse_mode: 'HTML', ...opts });
          }
        }
      }
    }
  } catch (error) {
    console.error('Lỗi khi gửi tin nhắn:', error);
    bot.sendMessage(msg.chat.id, 'Đã xảy ra lỗi khi gửi tin nhắn.');
  }
});

// Xử lý callback query từ inline keyboard
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;

  if (data.startsWith('reply_')) {
    const originalMessageId = data.split('_')[1];

    // Yêu cầu nhập nội dung tin nhắn
    bot.sendMessage(callbackQuery.from.id, 'Vui lòng nhập nội dung tin nhắn trả lời:', {
      reply_markup: {
        force_reply: true
      }
    }).then((sentMessage) => {
      bot.onReplyToMessage(sentMessage.chat.id, sentMessage.message_id, async (replyMsg) => {
        try {
          // Lấy thông tin tin nhắn gốc từ database
          const originalMessage = await Message.findOne({ messageId: originalMessageId });
          const originalUser = await Member.findOne({ userId: originalMessage.userId });
          const replyUser = await Member.findOne({ userId: replyMsg.from.id });

          const originalTag = originalUser.fullname || `@${originalMessage.from.username}`;
          const replyTag = replyUser.fullname || `@${replyMsg.from.username}`;

          const rankEmoji = getRankEmoji(replyUser.level);
          const starEmoji = getStarEmoji(replyUser.levelPercent);

          const replyContent = `
            Quẩy thủ: <a href="tg://user?id=${replyMsg.from.id}">${replyTag}</a> ${rankEmoji} (Level: ${replyUser.level}):
            ${starEmoji}
            "Trích dẫn <a href="tg://user?id=${originalMessage.userId}">${originalTag}</a>: ${originalMessage.text}"

            ${replyTag} đã trả lời rằng: ${replyMsg.text}`;

          // Tạo inline keyboard cho tin nhắn trả lời
          const opts = {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Trả lời tin nhắn này', callback_data: `reply_${replyMsg.message_id}` }
                ]
              ]
            }
          };         

          // Gửi tin nhắn trả lời dưới dạng HTML cho tất cả thành viên
          const members = await Member.find({});
          for (let member of members) {
            if (member.userId !== replyMsg.from.id && member.userId !== originalMessage.userId) {
              await bot.sendMessage(member.userId, replyContent, opts);
            }
          }

          
          // Gửi lại tin nhắn trả lời cho người dùng gốc và người trả lời kèm bàn phím reply
          const replyOpts = {
            reply_markup: {
              keyboard: [
                [{ text: 'Xem tài khoản' }]
              ],
              resize_keyboard: true,
              one_time_keyboard: false
            },
            parse_mode: 'HTML'
          };
          await bot.sendMessage(originalMessage.userId, replyContent, opts, replyOpts);
          await bot.sendMessage(replyMsg.from.id, replyContent, opts, replyOpts); 
        } catch (error) {
          console.error('Lỗi khi xử lý trả lời tin nhắn:', error);
          bot.sendMessage(callbackQuery.from.id, 'Đã xảy ra lỗi khi trả lời tin nhắn.');
        }
      });
    });
  }
});

// Chức năng tính toán và cập nhật level và levelPercent
const calculateAndUpdateLevel = async () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  // Đặt giờ phút giây của yesterday về đầu ngày (00:00:00)
  yesterday.setHours(0, 0, 0, 0);
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999); // Đặt giờ phút giây của endOfYesterday về cuối ngày (23:59:59.999)

  try {
    const members = await Member.find({});

    for (let member of members) {
      const userId = member.userId;

      // Lấy thông tin từ BangCong2
      const bangCongRecords = await BangCong2.find({ userId: userId, date: { $gte: yesterday, $lt: endOfYesterday } }); 
      const totalQuay = bangCongRecords.reduce((acc, record) => acc + (record.quay || 0), 0);
      const totalKeo = bangCongRecords.reduce((acc, record) => acc + (record.keo || 0), 0);
      const uniqueGroupIds = [...new Set(bangCongRecords.map(record => record.groupId))];

      // Tính toán levelPercent
      let levelPercentIncrease = 0;
      levelPercentIncrease += totalQuay * (Math.random() * (0.07 - 0.05) + 0.05);
      levelPercentIncrease += totalKeo * (Math.random() * (0.015 - 0.009) + 0.009);
      levelPercentIncrease += uniqueGroupIds.length * (Math.random() * (0.015 - 0.01) + 0.01);

      if (isNaN(levelPercentIncrease)) {
        console.error(`NaN detected for userId ${userId}: levelPercentIncrease is NaN`);
        continue; // Bỏ qua cập nhật cho userId này nếu levelPercentIncrease là NaN
      }

      member.levelPercent = (member.levelPercent || 0) + levelPercentIncrease;
      if (member.levelPercent >= 100) {
        member.level += 1;
        member.levelPercent = 0;
      }
      await member.save();
    }
  } catch (error) {
    console.error('Lỗi khi cập nhật level và levelPercent:', error);
  }
};

// Lịch trình để chạy hàm calculateAndUpdateLevel mỗi 30 phút một lần
cron.schedule('0 0 * * *', () => {
  console.log('Chạy cập nhật level và levelPercent');
  calculateAndUpdateLevel();
});

// Xử lý sự kiện khi nút "Xem tài khoản" được nhấn
bot.on('message', async (msg) => {
  if (msg.text === 'Xem tài khoản') {
    const userId = msg.from.id;
    const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  
  // Đặt giờ phút giây của yesterday về đầu ngày (00:00:00)
  yesterday.setHours(0, 0, 0, 0);
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999); // Đặt giờ phút giây của endOfYesterday về cuối ngày (23:59:59.999)

    try {
      // Lấy thông tin từ BangCong2
      const bangCongRecords = await BangCong2.find({ userId: userId, date: { $gte: yesterday, $lt: endOfYesterday } });        
      const totalQuay = bangCongRecords.reduce((acc, record) => acc + (record.quay || 0), 0);
      const totalKeo = bangCongRecords.reduce((acc, record) => acc + (record.keo || 0), 0);

      // Lấy thông tin từ Member
      const member = await Member.findOne({ userId: userId });
      if (member) {
      const responseMessage = `
          Thông tin tài khoản:
          Tên: ${member.fullname}
          Level: ${member.level} + ${member.levelPercent.toFixed(2)}%
          
          Tài sản quẩy của bạn ngày hôm qua:
          Tổng Quẩy: ${totalQuay}
          Tổng Kẹo: ${totalKeo}
          Tổng Tính Tiền: ${bangCongRecords.reduce((acc, record) => acc + (record.tinh_tien || 0), 0)} VNĐ
        `;
        bot.sendMessage(msg.chat.id, responseMessage);
      } else {
        bot.sendMessage(msg.chat.id, 'Không tìm thấy thông tin thành viên.');
      }
    } catch (error) {
      console.error('Lỗi khi truy vấn dữ liệu:', error);
      bot.sendMessage(msg.chat.id, 'Đã xảy ra lỗi khi truy vấn dữ liệu.');
    }
  }
});

// Xử lý lệnh "/bup" để xóa hết dữ liệu trong schema Member
bot.onText(/\/bup/, async (msg) => {
  const userId = msg.from.id;

  try {
    // Kiểm tra quyền hạn của người dùng
    // Thêm điều kiện kiểm tra quyền hạn ở đây nếu cần thiết

    // Xóa hết dữ liệu từ schema Member
    await Member.deleteMany({});
    bot.sendMessage(msg.chat.id, 'Đã xóa hết dữ liệu từ schema Member.');
  } catch (error) {
    console.error('Lỗi khi xóa dữ liệu từ schema Member:', error);
    bot.sendMessage(msg.chat.id, 'Đã xảy ra lỗi khi xóa dữ liệu từ schema Member.');
  }
});
