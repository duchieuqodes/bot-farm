const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const moment = require('moment');
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
  nhan_anh_bill: { type: Number, default: 0 } // Ensure default is 0
});

 // Define the schema and model for Trasua
const trasuaSchema = new mongoose.Schema({
  userId: Number,
  groupId: Number,
  date: String,
  ten: String,
  acc: Number,
  tinh_tien: Number,
});

const Trasua = mongoose.model('Trasua', trasuaSchema);


//Định nghĩa schema cho thành viên
const MemberSchema = new mongoose.Schema({
  userId: { type: Number, unique: true },
  fullname: String,
  level: Number,
  previousQuay: Number,
  previousKeo: Number,
  levelPercent: Number,
  exp: { type: Number, default: 0 },
  consecutiveDays: { type: Number, default: 0 },
  lastSubmissionDate: { type: Date, default: null },
  lastConsecutiveUpdate: { type: Date, default: null }, // Thêm trường này
  assets: {
    quay: Number,
    keo: Number,
    vnd: Number
  },
  hasInteracted: { type: Boolean, default: false } // New field to track interaction
});

// Định nghĩa schema cho tin nhắn
const MessageSchema = new mongoose.Schema({
  messageId: Number,
  userId: Number,
  chatId: Number,
  text: String,
  date: { type: Date, default: Date.now }
});

// Định nghĩa schema cho nhiệm vụ hàng ngày
const DailyTaskSchema = new mongoose.Schema({
  userId: Number,
  date: Date,
  quayTask: Number,
  keoTask: Number,
  billTask: Number,
  completedQuay: { type: Boolean, default: false },
  completedKeo: { type: Boolean, default: false },
  completedBill: { type: Boolean, default: false }
  
});

// Add this to your schema definitions
const VipCardSchema = new mongoose.Schema({
  userId: Number,
  issueDate: { type: Date, default: Date.now },
  type: { type: String, enum: ['level_up', 'week', 'month'], required: true },
  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },
  expBonus: { type: Number, required: true },
  keoBonus: { type: Number, required: true },
  quayBonus: { type: Number, required: true },
  keoLimit: { type: Number, required: true },
  quayLimit: { type: Number, required: true }
});

// Create a model from the schema
const VipCard = mongoose.model('VipCard', VipCardSchema);

// Tạo model từ schema
const BangCong2 = mongoose.model('BangCong2', BangCongSchema);

// Định nghĩa schema cho trạng thái hàng ngày
const DailyGiftStatusSchema = new mongoose.Schema({
  date: String,
  dailyGiftClaims: [Number], // Danh sách các user đã nhận quà
  giftWonToday: { type: Boolean, default: false },
});

const DailyGiftStatus = mongoose.model('DailyGiftStatus', DailyGiftStatusSchema);
//Tạo model từ schema
const Member = mongoose.model('Member', MemberSchema);
const Message = mongoose.model('Message', MessageSchema);
const DailyTask = mongoose.model('DailyTask', DailyTaskSchema);

const token = '7150645082:AAH-N2VM6qx3iFEhK59YHx2e1oy3Bi1EzXc';
const url = 'https://bot-farm-twjg.onrender.com'; // URL của webhook
const port = process.env.PORT || 3000;


// Khởi tạo bot với chế độ webhook
const bot = new TelegramBot(token, { webHook: { port: port } });
// Thiết lập webhook của bạn
bot.setWebHook(`${url}/bot${token}`);

// Khởi tạo express server
const app = express();
app.use(bodyParser.json());

// Định nghĩa route cho webhook
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});
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

// Hàm để xóa các thẻ VipCard đã hết hiệu lực
const deleteExpiredVipCards = async () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  await VipCard.deleteMany({ validUntil: { $lt: now } });
  console.log('Đã xóa các thẻ VIP đã hết hiệu lực.');
};

// Thiết lập công việc cron để chạy lúc 0h mỗi ngày
cron.schedule('0 0 * * *', deleteExpiredVipCards);


// Thiết lập cron job để xóa dữ liệu DailyTask của những ngày trước đó
cron.schedule('0 0 * * *', async () => {
  const currentDate = new Date().setHours(0, 0, 0, 0);

  try {
    const result = await DailyTask.deleteMany({
      $or: [
        { date: { $lt: currentDate } },
        { date: { $exists: false } }
      ]
    });
    console.log(`Đã xóa ${result.deletedCount} nhiệm vụ hàng ngày trước ngày ${new Date(currentDate).toLocaleDateString()}`);
  } catch (error) {
    console.error("Lỗi khi xóa dữ liệu từ MongoDB:", error);
  }
});

const accRegex = /xong\s*\d+\s*acc/i;

// Đăng ký sự kiện cho bot
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

    // Chỉ kiểm tra nếu không phải là nhóm có ID
  if (chatId !== -1002103270166) {
  
    // Kiểm tra nếu tin nhắn chứa từ khóa "xong (số) acc"
    const messageContent = msg.text || msg.caption;
    if (messageContent && /xong\s*\d+\s*acc/gi.test(messageContent)) {
      await processAccMessage(msg); // Gọi hàm xử lý tin nhắn từ acc.js
    }
  }
});

async function processAccMessage(msg) {
  const messageContent = msg.text || msg.caption;
  const accMatches = messageContent.match(accRegex);
  const userId = msg.from.id;
  const groupId = msg.chat.id;

  let acc = 0;

  if (accMatches) {
    accMatches.forEach((match) => {
      const number = parseInt(match.match(/\d+/)[0]); // Lấy số acc
      acc += number; // Thêm vào số acc
    });
  }

  const currentDate = new Date().toLocaleDateString();
  const firstName = msg.from.first_name;
  const lastName = msg.from.last_name;
  const fullName = lastName ? `${firstName} ${lastName}` : firstName;

  let totalMoney = acc * 5000; // Tính tiền cho số Acc

  const responseMessage = `Bài nộp của ${fullName} đã được ghi nhận với ${acc} Acc đang chờ kiểm tra ❤🥳`;

  bot.sendMessage(groupId, responseMessage, { reply_to_message_id: msg.message_id }).then(async () => {
    let trasua = await Trasua.findOne({ userId, groupId, date: currentDate });

    if (!trasua) {
      trasua = await Trasua.create({
        userId,
        groupId,
        date: currentDate,
        ten: fullName,
        acc,
        tinh_tien: totalMoney,
      });
    } else {
      trasua.acc += acc;
      trasua.tinh_tien += totalMoney;
      await trasua.save();
    }
  });
}


// Lệnh /thom để hiển thị bảng công tổng
bot.onText(/\/thom/, async (msg) => {
  const chatId = msg.chat.id;
  const currentDate = new Date().toLocaleDateString();

  // Tìm các bản ghi bảng công có groupId -1002163768880 trong ngày hiện tại
  const bangCongList = await Trasua.find({ groupId: -1002163768880, date: currentDate });
  if (bangCongList.length === 0) {
    bot.sendMessage(chatId, 'Chưa có bảng công nào được ghi nhận trong ngày hôm nay.');
    return;
  }

  let responseMessage = `BẢNG CÔNG NHÓM ZALO THOM - ${new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}\n\n`;
  let totalMoney = 0;

  bangCongList.forEach(entry => {
    responseMessage += `${entry.ten}: ${entry.acc} Acc ${entry.tinh_tien.toLocaleString()} VNĐ\n\n`;
    totalMoney += entry.tinh_tien;
  });

  responseMessage += `Tổng tiền: ${totalMoney.toLocaleString()} VNĐ`;

  bot.sendMessage(chatId, responseMessage);
});



// Tìm các số theo sau bởi ký tự hoặc từ khóa xác định hành vi
const regex = /\d+(ca1|ca2|q|Q|c|C)/gi;

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

// Chỉ kiểm tra nếu không phải là nhóm có ID
  if (chatId !== -1002103270166 && chatId !== -1002163768880) {
    // Kiểm tra nếu tin nhắn chứa chuỗi cấm
    // Kiểm tra cả văn bản và chú thích
    const messageContent = msg.text || msg.caption;
    if (messageContent) {
      // Chỉ thực hiện kiểm tra bảng công nếu tin nhắn chứa chuỗi cấm
      if (regex.test(messageContent)) {
        processMessage(msg); // Xử lý tin nhắn trực tiếp
      }
    }
  }
});

async function processMessage(msg) {
  const messageContent = msg.text || msg.caption;
  const matches = messageContent.match(regex);
  const userId = msg.from.id;
  const groupId = msg.chat.id;

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

  const vipCard = await VipCard.findOne({
    userId,
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() }
  });

  let pricePerQuay = 500;
  let pricePerKeo = 1000;
  let pricePerKeoBonus = 0;
  let pricePerQuayBonus = 0;
  let exp = 0;

  if (vipCard) {
    if (vipCard.type === 'level_up') {
      pricePerQuay = 600;
      pricePerKeo = 1100;
    } else if (vipCard.type === 'week' || vipCard.type === 'month') {
      pricePerQuay = 600;
      pricePerKeo = 1100;
      exp = vipCard.expBonus;
    }

    if (vipCard.keoLimit && keo > vipCard.keoLimit) {
      const remainingKeo = vipCard.keoLimit;
      pricePerKeo = 1000;
      pricePerKeoBonus = remainingKeo * 100;
    }

    if (vipCard.quayLimit && quay > vipCard.quayLimit) {
      const remainingQuay = vipCard.quayLimit;
      pricePerQuay = 500;
      pricePerQuayBonus = remainingQuay * 100;
    }
  }

  const responseMessage = `Bài nộp của ${fullName} đã được ghi nhận với ${quay}q, ${keo}c đang chờ kiểm tra ❤🥳`;

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
        tinh_tien: (quay * pricePerQuay + keo * pricePerKeo) + (pricePerKeoBonus + pricePerQuayBonus),
      });
    } else {
      bangCong.quay += quay;
      bangCong.keo += keo;
      bangCong.tinh_tien += (quay * pricePerQuay + keo * pricePerKeo) + (pricePerKeoBonus + pricePerQuayBonus);

      const member = await Member.findOne({ userId });
      member.exp += exp;

      if (exp > 0) {
        member.levelPercent += Math.floor(exp / 10);
      }

      await bangCong.save();
    }

    await updateLevelPercent(userId);
    await updateMissionProgress(userId);
  });
}

        
       
const kickbot = {
  "-1002039100507": "CỘNG ĐỒNG NẮM BẮT CƠ HỘI",
  "-1002004082575": "Hội Nhóm",
  "-1002123430691": "DẪN LỐI THÀNH CÔNG",
  "-1002143712364": "CÙNG NHAU CHIA SẺ",
  "-1002128975957": "HƯỚNG TỚI TƯƠNG LAI",
  "-1002080535296": "TRAO ĐỔI CÔNG VIỆC 2",
  "-1002091101362": "TRAO ĐỔI CÔNG VIỆC 1", 
  "-1002129896837": "GROUP I MẠNH ĐỨC CHIA SẺ", 
  "-1002228252389": "ORMARKET community",
  "-1002103270166": "Tổng bank",
  "-1002128289933": "test",
  "-1002108234982": "community free",
  "-1002163768880": "tra sua",
  "-4201367303": "LÀM GIÀU CÙNG NHAU"
};                                                        
          
// Bảng tra cứu tên nhóm dựa trên ID nhóm
const groupNames = {
  "-1002039100507": "CỘNG ĐỒNG NẮM BẮT CƠ HỘI",
  "-1002004082575": "Hội Nhóm",
  "-1002123430691": "DẪN LỐI THÀNH CÔNG",
  "-1002143712364": "CÙNG NHAU CHIA SẺ",
  "-1002128975957": "HƯỚNG TỚI TƯƠNG LAI",
  "-1002080535296": "TRAO ĐỔI CÔNG VIỆC 2",
  "-1002091101362": "TRAO ĐỔI CÔNG VIỆC 1", 
  "-1002129896837": "GROUP I MẠNH ĐỨC CHIA SẺ", 
  "-1002228252389": "ORMARKET community",
  "-4201367303": "LÀM GIÀU CÙNG NHAU" 
};

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

    // Lấy danh sách các groupId cần tính toán
    const groupIds = Object.keys(groupNames).map(id => parseInt(id, 10));

    // Truy vấn để tổng hợp bảng công của các thành viên trong ngày hôm qua
    const aggregatedData = await BangCong2.aggregate([
      {
        $match: {
          date: { $gte: startOfYesterday, $lte: endOfYesterday },
          groupId: { $in: groupIds } // Chỉ lấy các nhóm trong groupNames
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

const groupCodes = {
  "cđnbch": "-1002039100507",
  "kttn": "-1002004082575",
  "dltc": "-1002123430691",
  "cncs": "-1002143712364",
  "bđkn": "-1002128975957",
  "tđcv2": "-1002080535296",
  "tđcv1": "-1002091101362",
  "gimđcs": "-1002129896837",
  "cf": "-1002108234982",
  "tgu": "-1002228252389", 
  "lgcn": "-4201367303" 
};

const groups = {
  "-1002039100507": "BẢNG CÔNG NHÓM CỘNG ĐỒNG NẮM BẮT CƠ HỘI",
  "-1002004082575": "BẢNG CÔNG NHÓM KIẾM THÊM THU NHẬP",
  "-1002123430691": "BẢNG CÔNG NHÓM DẪN LỐI THÀNH CÔNG",
  "-1002143712364": "BẢNG CÔNG NHÓM CÙNG NHAU CHIA SẺ",
  "-1002128975957": "BẢNG CÔNG NHÓM BƯỚC ĐI KHỞI NGHIỆP",
  "-1002080535296": "BẢNG CÔNG NHÓM TRAO ĐỔI CÔNG VIỆC 2",
  "-1002091101362": "BẢNG CÔNG NHÓM TRAO ĐỔI CÔNG VIỆC 1", 
  "-1002129896837": "BẢNG CÔNG NHÓM GROUP I MẠNH ĐỨC CHIA SẺ", 
  "-1002228252389": "BẢNG CÔNG NHÓM TECH GEEK UNITES", 
  "-4201367303": "LÀM GIÀU CÙNG NHAU" 
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

 // Cập nhật tự động tên nhóm vào đối tượng groups
bot.on('message', (msg) => {
  const chatId = msg.chat.id.toString();
  const chatTitle = msg.chat.title;

  if (chatId && chatTitle) {
    groups[chatId] = chatTitle;
  }
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
  if (level >= 1 && level <= 2) return '🥚';
  if (level >= 3 && level < 5) return '🐣';
  if (level >= 5 && level < 7) return '🐥';
  if (level >= 8 && level <= 9) return '🐦';
  if (level >= 10 && level <= 11) return '🦜';
  if (level >= 12 && level <= 13) return '🦄';
  if (level >= 14 && level <= 15) return '🖤⃝🤍';
  if (level >= 16 && level <= 18) return '🤰🏻';
  if (level >= 19 && level <= 20) return '👶🏻';
  if (level >= 21 && level <= 23) return '🧛🏻';
  if (level >= 24 && level <= 26) return '🥷';
  if (level >= 27 && level <= 29) return '🧙‍♂️';
  if (level >= 30 && level <= 33) return '💀';
  if (level >= 34 && level <= 37) return '🕯🪦🕯';
  if (level >= 38 && level <= 41) return '🧟‍♀️🦇';
  if (level >= 42 && level <= 46) return '👹';
  if (level >= 47 && level <= 52) return '˚˖𓍢ִִ໋🌊🦈˚˖𓍢ִ✧˚';
  if (level >= 53 && level <= 55) return '💠VIP💠';
  if (level >= 56 && level <= 59) return '💎VIP💎';
  if (level >= 60 && level <= 64) return '🪩VIP🪩';
  if (level >= 65 && level <= 67) return '🩻VIP🩻';
  if (level >= 68 && level <= 70) return '🪬VIP🪬୧⍤⃝💐';
  if (level >= 71 & level <= 73) return '🥉CHIẾN THẦN⚔️🛡';
  if (level >= 74 & level <= 76) return '🥈Á THẦN🐉⚜️';
  if (level >= 77 & level <= 79) return '🪙VÔ ĐỊCH🐲👸';
  if (level >= 80) return '👑 HUYỀN THOẠI🦋⃟🥀™️';

  if (level >= 100) return 'ﮩ٨ـﮩﮩ٨ـ🫀ﮩ٨ـﮩﮩ٨ـ🔑';
  return '';
}

// Hàm lấy emoji sao dựa theo phần trăm level
function getStarEmoji(levelPercent) {
  if (levelPercent < 25) return '★☆☆☆☆';
  if (levelPercent < 50) return '★★☆☆☆';
  if (levelPercent < 75) return '★★★☆☆';
  if (levelPercent < 90) return '★★★★☆';
  if (levelPercent < 100) return '★★★★★';
  if (levelPercent >= 100) return '✪✪✪✪✪';
  return '';
}

const replyKeyboard4 = {
  reply_markup: {
    keyboard: [
      [{ text: 'Xem tài khoản 🧾' }, { text: 'Nhiệm vụ hàng ngày 🪂' }],
      [{ text: 'Túi đồ 🎒' }, { text: 'Nhiệm vụ nguyệt trường kỳ 📜' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

bot.onText(/\/update/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const members = await Member.find({});
    if (!members.length) {
      bot.sendMessage(chatId, 'Không tìm thấy thành viên nào.');
      return;
    }

    for (let member of members) {
      bot.sendMessage(member.userId, 'Đã Cập nhật phiên bản mới hãy cập nhật thông tin của bạn:', replyKeyboard4);
    }

    bot.sendMessage(chatId, 'Đã gửi thông báo cập nhật cho tất cả thành viên.');
  } catch (error) {
    console.error('Lỗi khi gửi thông báo cập nhật:', error);
    bot.sendMessage(chatId, 'Đã xảy ra lỗi khi gửi thông báo cập nhật.');
  }
});




// Lệnh /start để tham gia bot
bot.onText(/\/start/, async (msg) => {
  const userId = msg.from.id;
  const fullname = `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();
  const opts = {
    reply_markup: {
    keyboard: [
      [{ text: 'Xem tài khoản 🧾' }, { text: 'Nhiệm vụ hàng ngày 🪂' }],
      [{ text: 'Túi đồ 🎒' }, { text: 'Nhiệm vụ nguyệt trường kỳ 📜' }]
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

// Hàm kiểm tra và rời khỏi các nhóm không được phép
async function leaveUnauthorizedGroups() {
  try {
    const updates = await bot.getUpdates();
    const groups = new Set();

    // Thu thập tất cả các group chat id từ các cập nhật
    updates.forEach(update => {
      if (update.message && update.message.chat && update.message.chat.type === 'supergroup') {
        groups.add(update.message.chat.id);
      }
    });

    // Kiểm tra và rời khỏi các nhóm không được phép
    for (const chatId of groups) {
      if (!kickbot.hasOwnProperty(chatId.toString())) {
        console.log(`Leaving unauthorized group: ${chatId}`);
        try {
          await bot.sendMessage(chatId, "Cha mẹ đứa nào add tao vào nhóm đây xin phép anh Hieu Gà chưa @duchieu287");
          await bot.leaveChat(chatId);
        } catch (error) {
          console.error(`Failed to leave unauthorized group ${chatId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch updates:', error);
  }
}
// Gọi hàm rời khỏi các nhóm không được phép khi khởi động bot
leaveUnauthorizedGroups();

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const messageContent = msg.text || msg.caption;

 // Kiểm tra nếu tin nhắn đến từ nhóm không được phép
  if (chatId < 0 && !kickbot.hasOwnProperty(chatId.toString())) {
    console.log(`Unauthorized group detected: ${chatId}`);
    try {
      // Gửi tin nhắn cảnh báo vào nhóm
      await bot.sendMessage(chatId, "Cha mẹ đứa nào add tao vào nhóm đấy xin phép anh Hieu Gà chưa @duchieu287");
    } catch (error) {
      console.error(`Failed to send warning message to ${chatId}:`, error);
    }
    
    // Rời khỏi nhóm không được phép
    try {
      await bot.leaveChat(chatId);
    } catch (error) {
      console.error(`Failed to leave chat ${chatId}:`, error);
    }
    return;
  }
  
  // Bỏ qua lệnh bot và tin nhắn bắt đầu bằng "chưa có"
  if (msg.text && (msg.text.startsWith('/') || msg.text.startsWith('chưa có'))) return;

  // Tìm hoặc tạo mới thành viên
  let member = await Member.findOne({ userId });
  if (!member) {
    member = new Member({
      userId,
      fullname: msg.from.first_name,
      hasInteracted: chatId > 0 // Mark as interacted if from private chat
    });
    await member.save();
  } else if (chatId > 0) {
    // Đánh dấu người dùng đã tương tác với bot trong cuộc trò chuyện riêng tư
    await Member.updateOne({ userId }, { $set: { hasInteracted: true } });
  }

  // Nếu tin nhắn từ cuộc trò chuyện riêng tư
  if (chatId > 0) {
    const fullname = member.fullname;
    const level = member.level;
    const levelPercent = member.levelPercent;
    const rankEmoji = getRankEmoji(level);
    const starEmoji = getStarEmoji(levelPercent);

    const captionText = msg.caption || 'hình ảnh';
    const responseMessage = `Quẩy thủ: <a href="tg://user?id=${userId}">${fullname}</a> ${rankEmoji} (Level: ${level}):
    ${starEmoji}
    
    Lời nhắn: ${msg.text || captionText}`;

    // Định nghĩa tùy chọn phản hồi
    const replyOpts = {
      reply_markup: {
        keyboard: [
          [{ text: 'Xem tài khoản 🧾' }, { text: 'Nhiệm vụ hàng ngày 🪂' }],
          [{ text: 'Túi đồ 🎒' }, { text: 'Nhiệm vụ nguyệt trường kỳ 📜' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      },
      parse_mode: 'HTML'
    };

    // Gửi thông điệp phản hồi đến người gửi
    try {
      await bot.sendMessage(chatId, responseMessage, replyOpts);
    } catch (error) {
      console.error(`Failed to send message to ${chatId}:`, error);
    }
    if (messageContent) {
      // Forward the message to all other members in private chats
      await sendMessageToAllMembers(responseMessage, userId);
    }
  } else {
    
   }
});

// Function to send messages to all members who have interacted
async function sendMessageToAllMembers(messageText, senderUserId) {
  try {
    const members = await Member.find({ hasInteracted: true });
    members.forEach(async (member) => {
      if (member.userId !== senderUserId) {
        try {
          await bot.sendMessage(member.userId, messageText, { parse_mode: 'HTML' });
        } catch (error) {
          if (error.response && error.response.statusCode === 403) {
            console.error(`Error sending message to ${member.userId}: Bot can't initiate conversation`);
          } else {
            console.error(`Error sending message to ${member.userId}:`, error);
          }
        }
      }
    });
  } catch (error) {
    console.error("Error sending message to all members:", error);
  }
}

const groupNames2 = {
  "-1002039100507": "CỘNG ĐỒNG NẮM BẮT CƠ HỘI",
  "-1002004082575": "Hội Nhóm",
  "-1002123430691": "DẪN LỐI THÀNH CÔNG",
  "-1002143712364": "CÙNG NHAU CHIA SẺ",
  "-1002128975957": "HƯỚNG TỚI TƯƠNG LAI",
  "-1002080535296": "TRAO ĐỔI CÔNG VIỆC 2",
  "-1002091101362": "TRAO ĐỔI CÔNG VIỆC 1", 
  "-1002129896837": "GROUP I MẠNH ĐỨC CHIA SẺ", 
  "-1002228252389": "BƯỚC ĐI KHỞI NGHIỆP", 
  "-1002108234982": "Community free, be truly rich",
  "-1002128289933": "test", 
  "-4201367303": "LÀM GIÀU CÙNG NHAU"

};

// Hàm reset previousKeo và previousQuay
const resetPreviousValues = async () => {
  try {
    const members = await Member.find();
    for (let member of members) {
      member.previousKeo = 0;
      member.previousQuay = 0;
      await member.save();
    }
    console.log('Reset previousKeo và previousQuay thành công.');
  } catch (error) {
    console.error('Lỗi khi reset previousKeo và previousQuay:', error);
  }
};
// Lên lịch chạy hàng ngày vào 0h00
cron.schedule('58 19 * * *', resetPreviousValues);


const updateLevelPercent = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  try {
    let member = await Member.findOne({ userId });

    if (!member) {
      console.error(`Không tìm thấy thành viên với userId: ${userId}`);
      return;
    }

    const bangCongRecords = await BangCong2.find({
      userId: userId,
      date: { $gte: today, $lt: endOfToday },
      groupId: { $in: Object.keys(groupNames2) }
    });
    const totalQuay = bangCongRecords.reduce((acc, record) => acc + (record.quay || 0), 0);
    const totalKeo = bangCongRecords.reduce((acc, record) => acc + (record.keo || 0), 0);

    const previousQuay = member.previousQuay || 0;
    const previousKeo = member.previousKeo || 0;

    if (totalQuay > previousQuay || totalKeo > previousKeo) {
      
      let levelPercentIncrease = 0;
      levelPercentIncrease += (totalQuay - previousQuay) * 0.5;
      levelPercentIncrease += (totalKeo - previousKeo) * 1.4;

      member.levelPercent = (member.levelPercent || 0) + levelPercentIncrease;

      let levelIncreased = false;
      while (member.levelPercent >= 100) {
        member.level += 1;
        member.levelPercent -= 100; // Chỉ trừ đi 100, giữ lại phần dư
        levelIncreased = true;
      }

      member.previousQuay = totalQuay;
      member.previousKeo = totalKeo;

      await member.save();

      if (levelIncreased && member.level % 5 === 0) {
        await issueLevelUpVipCard(userId, member.level);
      }
    }
  } catch (error) {
    console.error('Lỗi khi cập nhật levelPercent:', error);
  }
};

const issueLevelUpVipCard = async (userId, level) => {
  const member = await Member.findOne({ userId });
  if (!member) return;

  // Tính số ngày sử dụng dựa trên level
  let daysValid = (level % 20) / 5;
  if (daysValid === 0) {
    daysValid = 4; // Nếu level là bội số của 20, thẻ có thời hạn 4 ngày
  }
  
  const now = new Date();
  const validFrom = new Date(now.setDate(now.getDate() + 1)); // Hiệu lực từ ngày mai
  validFrom.setHours(0, 0, 0, 0); // Bắt đầu từ 00:00:00 ngày mai
  const validUntil = new Date(validFrom);
  validUntil.setDate(validFrom.getDate() + daysValid); // Hiệu lực trong 1 ngày
  validUntil.setHours(1, 0, 0, 0); // Kết thúc vào 23:59:59 ngày sau đó

  const vipCard = new VipCard({
    userId,
    type: 'level_up',
    validFrom,
    validUntil,
    expBonus: 0, // Không tăng exp
    keoBonus: 100,
    quayBonus: 100, // Tính 600đ/quẩy
    keoLimit: 3,
    quayLimit: 3
  });
  await vipCard.save();

  
  const formattedValidFrom = `${validFrom.getDate()}/${validFrom.getMonth() + 1}/${validFrom.getFullYear()}`;
  const message = `Chúc mừng quẩy thủ ${member.fullname} đã đạt level ${level} 🌟 và nhận được 1 thẻ VIP Bonus 🎫 có hiệu lực từ ngày ${formattedValidFrom}, hạn sử dụng ${daysValid} ngày. 
  
  Ưu đãi: Mã tăng 15% 100đ/quẩy 🥯🥨, 15% 100đ/kẹo 🍬(tăng tối đa 600vnđ/lần nộp. Áp dụng cho sản phẩm Quẩy, Kẹo và một số thành viên tham gia nhiệm vụ nhất định)`;
  const gifUrl = 'https://iili.io/JQSRkrv.gif'; // Thay thế bằng URL của ảnh GIF. 
    // Retrieve all members
  const members = await Member.find({});
  for (const member of members) {
    // Send message to each member's chat ID
    bot.sendAnimation(member.userId, gifUrl, { caption: message });
  }

  // Send message to the specific group ID
  const groupId = -1002103270166;
  bot.sendAnimation(groupId, gifUrl, { caption: message });
};
  
const issueWeeklyVipCard = async (userId) => {
  const member = await Member.findOne({ userId });
  const now = new Date();
  const randomDay = new Date(now);
  randomDay.setDate(now.getDate() + Math.floor(Math.random() * 7));

  const validFrom = new Date(randomDay);
  validFrom.setHours(0, 0, 0, 0);
  const validUntil = new Date(validFrom);
  validUntil.setDate(validFrom.getDate() + 1);
  validUntil.setHours(1, 0, 0, 0);

  const expBonus = 220 + Math.floor(Math.random() * 101); // Random từ 220 đến 320

  const vipCard = new VipCard({
    userId,
    type: 'week',
    validFrom,
    validUntil,
    expBonus,
    keoBonus: 100,
    quayBonus: 100, // Tính 600đ/quẩy
    keoLimit: 2,
    quayLimit: 2
  });

  await vipCard.save();

  const message = `Chúc mừng ${member.fullname} đã nhận được thẻ VIP tuần 🎫! Có hiệu lực từ ngày ${validFrom.toLocaleDateString()} đến ${validUntil.toLocaleDateString()}.

  Ưu đãi: Nhận được ${expBonus} exp, 2 Mã tăng 15% 100đ/quẩy, 15% 100đ/cộng (tăng tối đa 400vnđ/mỗi lần nộp. Áp dụng cho sản phẩm Quẩy, Cộng và một số thành viên tham gia nhiệm vụ nhất định)`;
  const gifUrl = 'https://iili.io/JQSRkrv.gif'; // Thay thế bằng URL của ảnh GIF. 
   
  const members = await Member.find({});
  for (const member of members) {
    // Send message to each member's chat ID
    bot.sendAnimation(member.userId, gifUrl, { caption: message });
  }

  // Send message to the specific group ID
  const groupId = -1002103270166;
  bot.sendAnimation(groupId, gifUrl, { caption: message });
};

const issueMonthlyVipCard = async (userId) => {
  const now = new Date();
  const randomDay = new Date(now);
  randomDay.setDate(now.getDate() - Math.floor(Math.random() * 7));

  const validFrom = new Date(randomDay);
  validFrom.setHours(0, 0, 0, 0);
  const validUntil = new Date(validFrom);
  validUntil.setDate(validFrom.getDate() + 2);
  validUntil.setHours(1, 0, 0, 0);

  const expBonus = 720 + Math.floor(Math.random() * 101); // Random từ 720 đến 820

  const vipCard = new VipCard({
    userId,
    type: 'month',
    validFrom,
    validUntil,
    expBonus,
    keoBonus: 100,
    quayBonus: 100, // Tính 600đ/quẩy
    keoLimit: 4,
    quayLimit: 3
  });

  await vipCard.save();

  const message = `🌟 Chúc mừng ${member.fullname} đã nhận được thẻ VIP tháng 💳! Có hiệu lực từ ngày ${validFrom.toLocaleDateString()} đến ${validUntil.toLocaleDateString()}.
  
  Ưu đãi: Nhận được ${expBonus} exp, 2 Mã tăng 15% 100đ/quẩy, 15% 100đ/cộng (tăng tối đa 600vnđ/mỗi lần nộp. Áp dụng cho sản phẩm Quẩy, Cộng và một số thành viên tham gia nhiệm vụ nhất định)`;
  
    // Retrieve all members
  const members = await Member.find({});
  const gifUrl = 'https://iili.io/JQSRkrv.gif'; // Thay thế bằng URL của ảnh GIF. 
   
  for (const member of members) {
    // Send message to each member's chat ID
    bot.sendAnimation(member.userId, gifUrl, { caption: message });
  }

  // Send message to the specific group ID
  const groupId = -1002103270166;
  bot.sendAnimation(groupId, gifUrl, { caption: message });
};

//Cập nhật hàm xử lý tiến độ nhiệm vụ trường kỳ
const updateMissionProgress = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  try {
    let member = await Member.findOne({ userId });

    if (!member) {
      console.error(`Không tìm thấy thành viên với userId: ${userId}`);
      return;
    }

    const bangCongRecords = await BangCong2.find({
      userId: userId,
      date: { $gte: today, $lt: endOfToday }
    });

    if (bangCongRecords.length > 0) {
      if (!member.lastConsecutiveUpdate || member.lastConsecutiveUpdate < today) {
        member.consecutiveDays += 1;
        member.lastConsecutiveUpdate = today;

        if (member.consecutiveDays === 7) {
          await issueWeeklyVipCard(userId);
        } else if (member.consecutiveDays === 30) {
          await issueMonthlyVipCard(userId);
        }
      }
    } else {
      member.consecutiveDays = 0;
    }

    await member.save();
  } catch (error) {
    console.error('Lỗi khi cập nhật tiến độ nhiệm vụ:', error);
  }
};


const deleteMemberByFullname = async (fullname) => {
  try {
    const result = await Member.deleteOne({ fullname: fullname });
    if (result.deletedCount > 0) {
      console.log(`Thành viên với fullname '${fullname}' đã bị xóa`);
    } else {
      console.log(`Không tìm thấy thành viên với fullname '${fullname}'`);
    }
  } catch (error) {
    console.error('Lỗi khi xóa thành viên:', error);
  }
};

// Tạo ngẫu nhiên nhiệm vụ
function generateDailyTasks() {
  const quayTask = Math.floor(Math.random() * 15) + 7; // 5-50 quay
  const keoTask = Math.floor(Math.random() * 8) + 4; // 3-20 keo
  const billTask = Math.floor(Math.random() * 1) + 1; // 1-10 nhận ảnh bill
  return {
    quayTask,
    keoTask,
    billTask
  };
}



async function checkAndUpdateBillCount(userId, text, groupId) {
  const match = text.match(/(\d+)\s*(ảnh|bill)/i);
  if (match) {
    let count = parseInt(match[1], 10);
    if (isNaN(count)) {
      count = 0; // Default to 0 if NaN
    }
    if (count > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      // Tìm kiếm bangCong dựa trên userId, groupId và date
      let bangCong = await BangCong2.findOne({ userId, groupId, date: { $gte: today, $lt: endOfToday } });
      if (!bangCong) {
        // Nếu không tồn tại, tạo một bản ghi mới cho bangCong
        bangCong = new BangCong2({ userId, date: new Date(), quay: 0, keo: 0, tinh_tien: 0, nhan_anh_bill: 0, groupId: groupId });
      }

      // Check if experience was already received today
      let dailyTask = await DailyTask.findOne({ userId, date: { $gte: today, $lt: endOfToday } });
      if (!dailyTask) {
        dailyTask = new DailyTask({ userId, date: new Date(), quayTask: 0, keoTask: 0, billTask: count, completedBill: true, experienceReceived: false });
      } else {
        dailyTask.billTask = count;
        dailyTask.completedBill = true;
      }

      // Only grant experience if it hasn't been received yet
      if (!dailyTask.experienceReceived) {
        // Grant experience here (adjust the logic as needed)
        dailyTask.experienceReceived = true;
      }

      bangCong.nhan_anh_bill = count; // Set nhan_anh_bill to the current count
      await dailyTask.save();
      await bangCong.save();
    }
  }
}

// Thông tin Cloudinary
const cloudinary = {
  cloud_name: 'dvgqc5i4n',
  api_key: '743276718962993',
  api_secret: '02v-rlQstSdcpd_6IekFwQ-tdNA'
};

// Hàm để loại bỏ emoji từ fullname, giữ lại các ký tự tiếng Việt có dấu
function sanitizeFullname(fullname) {
  return fullname.replace(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F700}-\u{1F77F}|\u{1F780}-\u{1F7FF}|\u{1F800}-\u{1F8FF}|\u{1F900}-\u{1F9FF}|\u{1FA00}-\u{1FA6F}|\u{1FA70}-\u{1FAFF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu, '').trim();
}

// Hàm để tạo URL ảnh với văn bản tùy chỉnh
async function generateImageUrl(userId, fullname, level, starEmoji, totalQuayYesterday, totalKeoYesterday, totalTinhTienYesterday, totalBonusYesterday, totalQuayToday, totalKeoToday, totalTinhTienToday, totalBonusToday) {

  // Lọc fullname để loại bỏ emoji và ký tự đặc biệt
  const sanitizedFullname = sanitizeFullname(fullname);

  let member = await Member.findOne({ userId });
  
  // URL cơ bản của ảnh
  let url = `https://res.cloudinary.com/${cloudinary.cloud_name}/image/upload/`;

  // Thêm văn bản vào các vị trí xác định từ Photoshop
  url += `l_text:arial_46_bold_italic_center:${member.level},co_rgb:FFFFFF,g_north_west,x_406,y_410/`;// Level (giữ nguyên)

  // Thêm fullName và level (kích thước nhỏ hơn so với các thay đổi khác)
  url += `l_text:arial_65_bold_italic_center:${encodeURIComponent(sanitizedFullname)},co_rgb:FFFFFF,g_north_west,x_74,y_302/`; // Full Name

  // Văn bản khác (tăng gấp đôi kích thước, in đậm, in nghiêng, màu trắng, font game 2D)
  url += `l_text:arial_70_bold_italic_center:${totalKeoYesterday},co_rgb:FFFFFF,g_north_west,x_300,y_940/`; // Total Keo Yesterday
  url += `l_text:arial_70_bold_italic_center:${totalBonusYesterday},co_rgb:FFFFFF,g_north_west,x_805,y_940/`; // Total Bonus Yesterday
  url += `l_text:arial_70_bold_italic_center:${totalQuayYesterday},co_rgb:FFFFFF,g_north_west,x_305,y_750/`; // Total Quay Yesterday
  url += `l_text:arial_70_bold_italic_center:${totalTinhTienYesterday},co_rgb:FFFFFF,g_north_west,x_805,y_750/`; // Total Tinh Tien Yesterday

  // Thêm văn bản cho hôm nay
  url += `l_text:arial_70_bold_italic_center:${totalKeoToday},co_rgb:FFFFFF,g_north_west,x_300,y_1430/`; // Total Keo Today
  url += `l_text:arial_70_bold_italic_center:${totalBonusToday},co_rgb:FFFFFF,g_north_west,x_815,y_1430/`; // Total Bonus Today
  url += `l_text:arial_70_bold_italic_center:${totalQuayToday},co_rgb:FFFFFF,g_north_west,x_300,y_1240/`; // Total Quay Today
  url += `l_text:arial_70_bold_italic_center:${totalTinhTienToday},co_rgb:FFFFFF,g_north_west,x_815,y_1240/`; // Total Tinh Tien Today

 
  // Thêm emoji từ hàm starEmoji
  url += `l_text:arial_48_bold_italic_center:${encodeURIComponent(starEmoji)},co_rgb:FFFFFF,g_north_west,x_720,y_190/`; // Star Emoji
  // Thêm ảnh gốc
  url += "v1717336612/kub77rwh14uuopyyykdt.jpg"; // Thay thế "sample.jpg" bằng đường dẫn đến ảnh của bạn

  return url;
}



async function generateTaskImageUrl(userId, fullname, quayTask, keoTask, billTask, totalQuayToday, totalKeoToday, totalBillToday) {
  // Lọc fullname để loại bỏ emoji và ký tự đặc biệt
  
let dailyTask = await DailyTask.findOne({ userId, date: today });

  // URL cơ bản của ảnh
  let url = `https://res.cloudinary.com/${cloudinary.cloud_name}/image/upload/`;


  // Nhiệm vụ hàng ngày
  url += `l_text:arial_70_bold_italic_center:${totalQuayToday}/${quayTask},co_rgb:FFFFFF,g_north_west,x_300,y_940/`; // Quay Task
  url += `l_text:arial_70_bold_italic_center:${totalKeoToday}/${keoTask},co_rgb:FFFFFF,g_north_west,x_805,y_940/`; // Keo Task
  url += `l_text:arial_70_bold_italic_center:${totalBillToday}/${billTask},co_rgb:FFFFFF,g_north_west,x_305,y_750/`; // Bill Task

  // Thêm ảnh gốc
  url += "v1717336612/kub77rwh14uuopyyykdt.jpg"; // Thay thế "sample.jpg" bằng đường dẫn đến ảnh của bạn

  return url;
}

// Xử lý sự kiện khi nút "Xem tài khoản" hoặc "Nhiệm vụ hôm nay" được nhấn
bot.on('message', async (msg) => {
  const userId = msg.from.id;
  const fullname = `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();
  const today = new Date();
  const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
      
  // Đặt giờ phút giây của hôm nay về đầu ngày (00:00:00)
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(19, 59, 59, 999);

// Đặt giờ phút giây của yesterday về đầu ngày (00:00:00)
    yesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(19, 59, 59, 999); // Đặt giờ phút giây của endOfYesterday về cuối ngày (23:59:59.999)

  // Kiểm tra và cập nhật số lượng nhan_anh_bill nếu tin nhắn chứa từ khóa phù hợp
  if (msg.text) {
    await checkAndUpdateBillCount(userId, msg.text);
  } else if (msg.caption) {
    await checkAndUpdateBillCount(userId, msg.caption);
  }

  if (msg.text === 'Xem tài khoản 🧾' || msg.text === 'Nhiệm vụ hàng ngày 🪂' || msg.text === 'Túi đồ 🎒' || msg.text === 'Nhiệm vụ nguyệt trường kỳ 📜') {
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
        bot.sendMessage(msg.chat.id, `Tài khoản của bạn đã được tạo mới, ${fullname}!`, {
          reply_markup: {
            keyboard: [
      [{ text: 'Xem tài khoản 🧾' }, { text: 'Nhiệm vụ hàng ngày 🪂' }],
      [{ text: 'Túi đồ 🎒' }, { text: 'Nhiệm vụ nguyệt trường kỳ 📜' }]
    ],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        });
      }

      
      // Lấy thông tin từ BangCong2
      const bangCongRecordsYesterday = await BangCong2.find({ userId: userId, date: { $gte: yesterday, $lt: endOfYesterday } });     
      const bangCongRecordsToday = await BangCong2.find({ userId: userId, date: { $gte: today, $lt: endOfToday } });
      const totalQuayYesterday = bangCongRecordsYesterday.reduce((acc, record) => acc + (record.quay || 0), 0);
      const totalKeoYesterday = bangCongRecordsYesterday.reduce((acc, record) => acc + (record.keo || 0), 0);    
      const totalQuayToday = bangCongRecordsToday.reduce((acc, record) => acc + (record.quay || 0), 0);
      const totalKeoToday = bangCongRecordsToday.reduce((acc, record) => acc + (record.keo || 0), 0);
      const totalBillToday = bangCongRecordsToday.reduce((acc, record) => acc + (record.nhan_anh_bill || 0), 0);
      const totalTinhTienYesterday = bangCongRecordsYesterday.reduce((acc, record) => acc + (record.tinh_tien || 0), 0);
      const totalTinhTienToday = bangCongRecordsToday.reduce((acc, record) => acc + (record.tinh_tien || 0), 0);
      
      const totalBonusYesterday = totalTinhTienYesterday - ((totalKeoYesterday * 1000) + (totalQuayYesterday * 500));
      const totalBonusToday = totalTinhTienToday - ((totalKeoToday * 1000) + (totalQuayToday * 500));

      
      if (msg.text === 'Xem tài khoản 🧾') {
        const rankEmoji = getRankEmoji(member.level);
        const starEmoji = getStarEmoji(member.levelPercent);
        const level = `${member.level}`;
        const imageUrl = await generateImageUrl(userId, fullname, level, starEmoji, totalQuayYesterday, totalKeoYesterday, totalTinhTienYesterday, totalBonusYesterday, totalQuayToday, totalKeoToday, totalTinhTienToday, totalBonusToday);
        
const responseMessage = `
        Thông tin tài khoản 🩴:
        Quẩy thủ 👹: ${member.fullname}
        Level: ${member.level} ${rankEmoji} + ${member.levelPercent.toFixed(2)}% 
        ${starEmoji}
        
        Tài sản quẩy ngày hôm qua 🎒:
        Tổng Quẩy: ${totalQuayYesterday} 🥨
        Tổng Kẹo: ${totalKeoYesterday} 🍬
        Tổng tính tiền: ${bangCongRecordsYesterday.reduce((acc, record) => acc + (record.tinh_tien || 0), 0)} VNĐ
        Tổng tiền VIP bonus: ${totalBonusYesterday} VNĐ ▲
        
        Tài sản quẩy ngày hôm nay 🎒:
        Tổng Quẩy: ${totalQuayToday} 🥨
        Tổng Kẹo: ${totalKeoToday} 🍬
        Tổng tính tiền: ${bangCongRecordsToday.reduce((acc, record) => acc + (record.tinh_tien || 0), 0)} VNĐ   
        Tổng tiền VIP bonus: ${totalBonusToday} VNĐ ▲

        Lưu ý ⚠: Tổng tài sản trên là bao gồm cả nhóm quẩy Comunity free và Be truly rich nếu có.
      `;
       bot.sendPhoto(msg.chat.id, imageUrl, { caption: 'Thông tin tài khoản' });

        bot.sendMessage(msg.chat.id, responseMessage, {
          reply_markup: {
            keyboard: [
      [{ text: 'Xem tài khoản 🧾' }, { text: 'Nhiệm vụ hàng ngày 🪂' }],
      [{ text: 'Túi đồ 🎒' }, { text: 'Nhiệm vụ nguyệt trường kỳ 📜' }]
    ],
              resize_keyboard: true,
              one_time_keyboard: false
            }
          });
      } else if (msg.text === 'Nhiệm vụ hàng ngày 🪂') {
        // Kiểm tra xem nhiệm vụ hàng ngày đã tồn tại chưa
        let dailyTask = await DailyTask.findOne({ userId, date: today });

        if (!dailyTask) {
          // Tạo mới nhiệm vụ hàng ngày nếu chưa tồn tại
          const tasks = generateDailyTasks();
          dailyTask = new DailyTask({
            userId,
            date: today,
            quayTask: tasks.quayTask,
            keoTask: tasks.keoTask,
            billTask: tasks.billTask,
            
          });
          await dailyTask.save();
        }

        
        // Lấy thông tin từ BangCong2 cho hôm nay
        const bangCongRecordsToday = await BangCong2.find({ userId, date: { $gte: today, $lt: endOfToday } });
        const totalQuayToday = bangCongRecordsToday.reduce((acc, record) => acc + (record.quay || 0), 0);
        const totalKeoToday = bangCongRecordsToday.reduce((acc, record) => acc + (record.keo || 0), 0);
        const totalBillToday = bangCongRecordsToday.reduce((acc, record) => acc + (record.nhan_anh_bill || 0), 0);

        const taskImageUrl = await generateTaskImageUrl(userId, fullname, dailyTask.quayTask, dailyTask.keoTask, dailyTask.billTask, totalQuayToday, totalKeoToday, totalBillToday);

        
        let taskMessage = `Nhiệm vụ hôm nay của ${fullname}:\n\n`;
        const tasks = [
          { name: 'Quẩy🥨', completed: dailyTask.completedQuay, total: totalQuayToday, goal: dailyTask.quayTask },
          { name: 'Kẹo🍬', completed: dailyTask.completedKeo, total: totalKeoToday, goal: dailyTask.keoTask },
          { name: 'Bill hoặc ảnh quẩy (vd: 1 ảnh, 1 bill)', completed: dailyTask.completedBill, total: totalBillToday, goal: dailyTask.billTask }
        ];

        for (let task of tasks) {
          if (!task.completed && task.total >= task.goal) {
            // Hoàn thành nhiệm vụ
            task.completed = true;
            const exp = Math.floor(Math.random() * 120) + 60; // Random 10-50 điểm exp
            member.levelPercent += exp * 0.1;
            // Kiểm tra nếu levelPercent >= 100 thì tăng level
            if (member.levelPercent >= 100) {
              member.level += Math.floor(member.levelPercent / 100);
              member.levelPercent %= 100;
            }
            await member.save();

            if (task.name === 'Quẩy🥨') {
              dailyTask.completedQuay = true;
            } else if (task.name === 'Kẹo🍬') {
              dailyTask.completedKeo = true;
            } else if (task.name === 'Bill hoặc ảnh quẩy (vd: 1 ảnh, 1 bill)') {
              dailyTask.completedBill = true;
               
            }
            await dailyTask.save();

            bot.sendMessage(msg.chat.id, `Chúc mừng ${fullname} 🥳 đã hoàn thành nhiệm vụ ${task.name} và nhận được ${exp} điểm kinh nghiệm!👺`);
          }
          taskMessage += `Hoàn thành ${task.name}: ${task.total}/${task.goal} (Phần thường: điểm kinh nghiệm)\n\n`;
        
        }
        const gifUrl = 'https://iili.io/JQSaM6g.gif'; // Thay thế bằng URL của ảnh GIF
  
  bot.sendAnimation(msg.chat.id, gifUrl, {
  caption: taskMessage,
  reply_markup: {
    keyboard: [
      [{ text: 'Xem tài khoản 🧾' }, { text: 'Nhiệm vụ hàng ngày 🪂' }],
      [{ text: 'Túi đồ 🎒' }, { text: 'Nhiệm vụ nguyệt trường kỳ 📜' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
});
   bot.sendPhoto(msg.chat.id, taskImageUrl, { caption: 'Nhiệm vụ hàng ngày' });

      }
    } catch (error) {
      console.error('Lỗi khi truy vấn dữ liệu:', error);
      bot.sendMessage(msg.chat.id, 'Đã xảy ra lỗi khi truy vấn dữ liệu.', {
        reply_markup: {
          keyboard: [
      [{ text: 'Xem tài khoản 🧾' }, { text: 'Nhiệm vụ hàng ngày 🪂' }],
      [{ text: 'Túi đồ 🎒' }, { text: 'Nhiệm vụ nguyệt trường kỳ 📜' }]
    ],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      });
    }
  }
});

const getInventory = async (userId) => {
  const vipCards = await VipCard.find({ userId, validUntil: { $gte: new Date() } });
  // Thêm các loại vật phẩm khác nếu có
  const specialItems = []; // Ví dụ nếu có

  return {
    vipCards,
    specialItems
  };
};

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (text === 'Nhiệm vụ nguyệt trường kỳ 📜') {
    const member = await Member.findOne({ userId });
    if (!member) {
      bot.sendMessage(chatId, 'Không tìm thấy thông tin thành viên.');
      return;
    }

    const message = `Tiến độ nhiệm vụ của bạn 📜:
    
- Bạn Đã quẩy 🥨🥯 liên tiếp được: ${member.consecutiveDays} ngày.

        Phần thưởng nhiệm vụ Trường Kỳ: 
        Quẩy 7 ngày liên tiếp : Nhận 1 thẻ VIP tuần 🎟️.
        Quẩy 30 ngày liên tiếp : Nhận thẻ VIP tháng 💳.

Lưu ý ⚠️: Nếu không làm trong 1 ngày bất kỳ, tiến độ nhiệm vụ sẽ trở về ban đầu 🔚.`;

    bot.sendMessage(chatId, message);
  }

  if (text === 'Túi đồ 🎒') {
    const member = await Member.findOne({ userId });
    if (!member) {
      bot.sendMessage(chatId, 'Không tìm thấy thông tin thành viên.');
      return;
    }

    const vipCards = await VipCard.find({ userId, validUntil: { $gte: new Date() } });
    if (vipCards.length === 0) {
      const emptyMessage = `🎒 Túi đồ của ${member.fullname} đang trống! 

Mẹo 💡: Đạt các mốc level 5, 10, 15, 20,... và làm nhiệm vụ Nguyệt Truyền Kỳ để nhận được các vật phẩm quà tặng có giá trị.`;
      bot.sendMessage(chatId, emptyMessage);
    } else {
      let itemsMessage = `Túi đồ của ${member.fullname}:\n\n`;

      vipCards.forEach(card => {
        itemsMessage += `- Thẻ VIP bonus ${card.type === 'week' ? 'tuần 🎫' : card.type === 'month' ? 'tháng 🎫 ' : 'level_up 🎫'}: Hiệu lực từ ${card.validFrom.toLocaleDateString()} đến ${card.validUntil.toLocaleDateString()}\n`;
        if (card.expBonus) itemsMessage += `  • Điểm kinh nghiệm: ${card.expBonus}\n`;
        if (card.keoBonus) itemsMessage += `  • tăng ${card.keoBonus}đ/kẹo, tối đa ${card.keoLimit} kẹo 🍬/ mỗi lần nộp\n`;
        if (card.quayBonus) itemsMessage += `  • tăng ${card.quayBonus}đ/quẩy, tối đa ${card.quayLimit} quẩy/ mỗi lần nộp 🥯🥨\n\n`;
      });

      bot.sendMessage(chatId, itemsMessage);
    }
  }
});


const replyKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: 'Xem tài khoản 🧾' }, { text: 'Nhiệm vụ hàng ngày 🪂' }],
      [{ text: 'Túi đồ 🎒' }, { text: 'Nhiệm vụ nguyệt trường kỳ 📜' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};



// Xử lý lệnh "/bup" để xóa hết dữ liệu trong schema Member
bot.onText(/\/bup/, async (msg) => {
  const userId = msg.from.id;

  try {
    // Kiểm tra quyền hạn của người dùng
    // Thêm điều kiện kiểm tra quyền hạn ở đây nếu cần thiết

    // Xóa hết dữ liệu từ schema Member
    await Message.deleteMany({});
    bot.sendMessage(msg.chat.id, 'Đã xóa hết dữ liệu từ schema Member.');
  } catch (error) {
    console.error('Lỗi khi xóa dữ liệu từ schema Member:', error);
    bot.sendMessage(msg.chat.id, 'Đã xảy ra lỗi khi xóa dữ liệu từ schema Member.');
  }
});





// Lắng nghe lệnh /thongbao
bot.onText(/\/thongbao "(.*)" "(.*)"/, (msg, match) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  // Chỉ cho phép username @duchieu287 thực hiện lệnh này
  if (username !== 'Duchieu287') {
    bot.sendMessage(chatId, 'Bạn không có quyền sử dụng lệnh này.');
    return;
  }
  // Định nghĩa groupId mà thông báo sẽ được gửi đến
const groupId = -1002103270166;
  // Lấy tên tính năng và nội dung thông báo từ lệnh
  const featureName = match[1];
  const notificationContent = match[2];
  const currentDate = moment().format('DD/MM/YYYY');

  // Định dạng thông báo
  const message = `TÍNH NĂNG MỚI 🔵:\nLần cập nhật gần đây: ${currentDate}\n${featureName}\nNội dung cập nhật:\n${notificationContent}`;

  // Gửi thông báo đến groupId
  bot.sendMessage(groupId, message)
    .then(() => {
      bot.sendMessage(chatId, 'Thông báo đã được gửi thành công.');
    })
    .catch((error) => {
      console.error('Lỗi khi gửi thông báo:', error);
      bot.sendMessage(chatId, 'Có lỗi xảy ra khi gửi thông báo.');
    });
});
