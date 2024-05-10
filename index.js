const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const request = require('request');
const cron = require('node-cron'); // Thư viện để thiết lập cron jobs
const keep_alive = require('./keep_alive.js')
const { resetDailyGiftStatus, sendMorningMessage, handleGiftClaim } = require('./gift');
const { setupNewsSchedule, sendLatestNews } = require('./news.js');
const handleNewChatMembers = require('./ban'); // Nhập module ban

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

// Tạo model từ schema
const BangCong2 = mongoose.model('BangCong2', BangCongSchema);

// Định nghĩa schema cho trạng thái hàng ngày
const DailyGiftStatusSchema = new mongoose.Schema({
  date: String,
  dailyGiftClaims: [Number], // Danh sách các user đã nhận quà
  giftWonToday: { type: Boolean, default: false },
});

const DailyGiftStatus = mongoose.model('DailyGiftStatus', DailyGiftStatusSchema);

const token = '7150645082:AAH-N2VM6qx3iFEhK59YHx2e1oy3Bi1EzXc';
const bot = new TelegramBot(token, { polling: true });

// Chuỗi cấmm
const bannedStringsRegex = /(ca\s?1|ca1|ca\s?2|Ca\s?2|Ca\s?1|Ca1|Ca\s?2|Ca2|C1|C2|c\s?1|c\s?2|C\s?1|C\s?2)\s*/gi;

// Thiết lập cron job để xóa dữ liệu bảng công của 2 ngày trước, ngoại trừ bảng công có groupId -1002108234982
cron.schedule('0 0 * * *', async () => {
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
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
    const matches = messageContent.match(regex);
      const userId = msg.from.id;
      const groupId = chatId;
      
    
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
          } else if (suffix.toLowerCase() === 'c' || suffix === 'acc') {
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
        bot.sendMessage(chatId, responseMessage, { reply_to_message_id: msg.message_id }).then(async () => {
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
      });
    
  }
  }
  }
});
       
                                             
          
// Bảng tra cứu tên nhóm dựa trên ID nhóm
const groupNames = {
  "-1002039100507": "CỘNG ĐỒNG NẮM BẮT CƠ HỘI",
  "-1002004082575": "KHÔNG NGỪNG PHÁT TRIỂN",
  "-1002123430691": "DẪN LỐI THÀNH CÔNG",
  "-1002143712364": "THU NHẬP MỖI NGÀY",
  "-1002128975957": "CỘNG ĐỒNG KHỞI NGHIỆP",
  "-1002129896837": "KHÔNG NGỪNG ĐỔI MỚI",
  "-1002091101362": "CURRENCY SHINING STAR GROUP", 
  "-1002080535296": "CỘNG ĐỒNG VIỆT NAM", 
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



   

bot.onText(/\/tong/, async (msg) => {
  const chatId = msg.chat.id;

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
});

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

// Lệnh /edit để chỉnh sửa bảng công
bot.onText(/\/edit (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1]; // Phần sau "/edit"

  // Phân tích cú pháp để lấy các tham số
  const parts = text.split(',');
  if (parts.length !== 4) {
    bot.sendMessage(chatId, 'Định dạng không hợp lệ. Đúng định dạng là: /edit groupId, ten, quay, keo.');
    return;
  }

  const [groupId, rawTen, quayStr, keoStr] = parts.map((p) => p.trim());
  const quay = parseInt(quayStr, 10); // Chuyển đổi quay thành số nguyên
  const keo = parseInt(keoStr, 10); // Chuyển đổi keo thành số nguyên

  if (isNaN(quay) || isNaN(keo)) {
    bot.sendMessage(chatId, 'Quay và Keo phải là số.');
    return;
  }

  try {
    const normalizedRawTen = normalizeName(rawTen); // Chuẩn hóa tên đầu vào

    const currentDate = new Date().toLocaleDateString();

    // Tìm bảng công với tên gần đúng (loại bỏ icon và emoji)
    const bangCong = await BangCong2.findOne({
      groupId,
      date: currentDate,
      ten: { $regex: normalizedRawTen, $options: 'i' }, // So khớp không phân biệt chữ hoa/thường
    });

    if (!bangCong) {
      bot.sendMessage(chatId, `Không tìm thấy bảng công cho thành viên có tên gần đúng với "${rawTen}" trong nhóm ${groupId}.`);
      return;
    }

    // Cập nhật quay và keo
    bangCong.quay = quay;
    bangCong.keo = keo;

    // Cập nhật tổng tiền
    bangCong.tinh_tien = quay * 500 + keo * 1000;

    await bangCong.save(); // Lưu thay đổi

    bot.sendMessage(chatId, `Bảng công cho thành viên có tên gần đúng với "${rawTen}" trong nhóm ${groupId} đã được cập nhật.`);
  } catch (error) {
    console.error('Lỗi khi chỉnh sửa bảng công:', error);
    bot.sendMessage(chatId, 'Đã xảy ra lỗi khi chỉnh sửa bảng công. Vui lòng thử lại.');
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
    for (const member in totalByMember) {
      const formattedTotal = totalByMember[member].toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      response += `${member}: ${formattedTotal}vnđ\n`;
    }

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

// Xử lý lệnh /bchomqua để hiển thị bảng công cho tất cả các nhóm
bot.onText(/\/homqua/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Tính ngày hôm qua
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const formattedYesterday = yesterday.toLocaleDateString(); // Định dạng ngày để dùng trong truy vấn

    // Lấy bảng công của ngày hôm qua, loại trừ nhóm có chatId -1002108234982
    const bangCongs = await BangCong2.find({
      date: formattedYesterday,
      groupId: { $ne: -1002108234982 }, // Loại trừ nhóm này
    });

    if (bangCongs.length === 0) {
      bot.sendMessage(chatId, `Không có bảng công nào cho ngày ${formattedYesterday}.`);
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

      response += `Bảng công nhóm ${groupName} (${formattedYesterday}):\n\n`;

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
});


const timezoneOffset = 1 * 60 * 60 * 1000; // Múi giờ Việt Nam (UTC +7)

// Hàm gửi bảng công
const sendBangCong = async (chatId) => {
  const currentDate = new Date(new Date().getTime() + timezoneOffset).toLocaleDateString();
  const maxRetries = 10; // Số lần thử tối đa
  let retries = 0;
  let sent = false;

  while (!sent && retries < maxRetries) {
    try {
      const bangCongs = await BangCong2.find({
        date: currentDate,
        groupId: { $ne: -1002108234982 }, // Loại trừ nhóm này
      });

      if (bangCongs.length === 0) {
        bot.sendMessage(chatId, "Không có bảng công nào cho ngày hôm nay.");
        return;
      }

      const groupedByGroupId = {};
      bangCongs.forEach((bangCong) => {
        const groupId = bangCong.groupId ? bangCong.groupId.toString() : ''; // Kiểm tra nếu groupId không undefined
        if (!groupedByGroupId[groupId]) {
          groupedByGroupId[groupId] = [];
        }
        groupedByGroupId[groupId].push(bangCong);
      });

      let response = '';

      for (const groupId in groupedByGroupId) {
        if (!groupId) {
          continue;
        }

        const groupData = groupedByGroupId[groupId];
        const groupName = groupNames[groupId] || `Nhóm ${groupId}`; // Lấy tên nhóm từ bảng tra cứu

        response += `Bảng công nhóm ${groupName}:\n\n`;

        let totalGroupMoney = 0; // Biến để tính tổng số tiền của nhóm

        groupData.forEach((bangCong) => {
          if (bangCong.tinh_tien !== undefined) { // Kiểm tra trước khi truy cập thuộc tính
            const formattedTien = bangCong.tinh_tien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            response += `${bangCong.ten}\t\t${bangCong.quay}q +\t${bangCong.keo}c\t${formattedTien}vnđ\n`;
            totalGroupMoney += bangCong.tinh_tien;
          }
        });

        const formattedTotal = totalGroupMoney.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        response += `Tổng tiền: ${formattedTotal}vnđ\n\n`;
      }

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

      sent = true; // Nếu gửi thành công, thoát vòng lặp
    } catch (error) {
      console.error('Lỗi khi truy vấn dữ liệu từ MongoDB:', error);
      retries++; // Tăng số lần thử lại
      if (retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 30 * 60 * 1000)); // Chờ 30 phút trước khi thử lại
      }
    }
  }

  if (!sent) {
    bot.sendMessage(chatId, 'Không thể gửi bảng công trước 7h sáng.');
  }
};

// Thiết lập cron job gửi vào lúc 2h sáng hàng ngày (giờ Việt Nam)
cron.schedule('0 18 * * *', async () => {
  const chatId = -1002128289933; // ID nhóm mà bạn muốn gửi
  await sendBangCong(chatId);
});

// Thay thế YOUR_API_KEY bằng API key OpenWeatherMap của bạn
const apiKey = '679360c3eef6d2165d3833d29b5eccf4';

// ChatId của nhóm bạn muốn gửi dự báo thời tiết
const chatId = -1002103270166;

// Bảng dịch các trạng thái thời tiết từ tiếng Anh sang tiếng Việt
const weatherDescriptions = {
  'clear sky': 'ngày nắng nóng, có nơi nắng nóng gay gắt 🌤️',
  'few clouds': 'ngày nắng nóng 🌤️',
  'scattered clouds': 'Có mây ☁',
  'broken clouds': 'Nhiều mây ☁',
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
  const rainKeywords = ['ngày có lúc có mưa rào và rải rác có giông 🌫️', 'ngày có mưa rào và có giông vài nơi 🌫️', 'có mưa rào và giông rải rác 🌫️'];
  const cloudKeywords = ['Có mây ☁️', 'Nhiều mây ☁', 'Nhiều mây ☁'];
  const sunKeywords = ['ngày nắng nóng 🌤️', 'ngày nắng nóng, có nơi nắng nóng gay gắt 🌤️'];

  // Nếu buổi sáng hoặc buổi chiều tối có mưa rào, giông và có mây
  if (rainKeywords.some(k => morningDescription.includes(k)) || rainKeywords.some(k => eveningDescription.includes(k))) {
    if (cloudKeywords.some(k => morningDescription.includes(k)) || cloudKeywords.some(k => eveningDescription.includes(k))) {
      return 'https://iili.io/JrX4YXe.gif'; // GIF cho mưa và mây
    }
  }

  // Nếu buổi sáng hoặc buổi chiều tối có nắng hoặc nắng nóng
  if (sunKeywords.some(k => morningDescription.includes(k)) || sunKeywords.some(k => eveningDescription.includes(k))) {
    return 'https://iili.io/JrXfzI1.gif'; // GIF cho trời nắng
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

//ban.js
// Danh sách các tên thành viên không bị ban
let exemptedNames = [
    'Ngocai98',
    'Tuấn Tú',
    'Linh Đan',
    'GIA HÂN 🧏🏻‍♀️',
    'Soài Lắk 🎀',
    'Emlysa',
    'N h M i',
    'xZK006x',
    'Nguyen Linh',
    'hoahoa',
    'Hocdb Hocdv',
    'Louis_manh❄',
    'LE TRAM 🍄',
    'Hương Lê 🍋',
    'Đỗ Hoài Nam',
    'Nguyễn Trọng Nguyên',
    'Ng Chi',
    'Liên',
    'Tôn Nguyễn Thọ Cường',
    'Kien',
    'Kiều Thư',
    'Bé yến . Ý',
    'Lele1111',
    'Lan Quỳnh',
    'Minh Quang Quang',
    'Mr ` Nam (2)',
    'Hải An',
    'N Thọ',
    'Thu Hương',
    'NGUYEN TRONG PHUC PHUCNGUYEN'
];


// Liên kết sự kiện 'new_chat_members' với hàm từ ban.js
bot.on('new_chat_members', (msg) => {
    handleNewChatMembers(bot, msg, exemptedNames); // Gọi hàm ban/unban với danh sách loại trừ
});

// Xử lý lệnh /notban
bot.onText(/\/notban (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const nameToExempt = match[1].trim(); // Lấy tên thành viên từ lệnh

    exemptedNames.push(nameToExempt); // Thêm tên vào danh sách không ban
    bot.sendMessage(chatId, `Không ban thành viên có tên gần đúng: ${nameToExempt}`);
});
