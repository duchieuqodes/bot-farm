const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const cron = require('node-cron'); // Thư viện để thiết lập cron jobs
const keep_alive = require('./keep_alive.js')

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
});

// Tạo model từ schema
const BangCong2 = mongoose.model('BangCong2', BangCongSchema);

const token = '7150645082:AAGUNk7BrBPYJqv085nINEGx7p5tCE9WcK0';
const bot = new TelegramBot(token, { polling: true });

// Chuỗi cấmm
const bannedStringsRegex = /(ca\s?1|ca1|ca\s?2|Ca\s?2|Ca\s?1|Ca1|Ca\s?2|Ca2|C1|C2|c\s?1|c\s?2|C\s?1|C\s?2)\s*/gi;

// Thiết lập cron job để xóa dữ liệu bảng công của ngày hôm trước
cron.schedule('0 0 * * *', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const formattedYesterday = new Date(yesterday.toLocaleDateString());

  try {
    const result = await BangCong2.deleteMany({ date: formattedYesterday });
    console.log(`Đã xóa ${result.deletedCount} bảng công của ngày ${formattedYesterday.toLocaleDateString()}`);
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

      bot.sendMessage(chatId, 'Bài nộp đã được ghi nhận đang chờ kiểm tra ❤🥳', { reply_to_message_id: msg.message_id }).then(async () => {
        const currentDate = new Date().toLocaleDateString();
        const firstName = msg.from.first_name;
        const lastName = msg.from.last_name;
        const fullName = lastName ? `${firstName} ${lastName}` : firstName;

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
  "-1002143712364": "TỔNG UY TÍN CHẤT LƯỢNG",
  "-1002128975957": "CỘNG ĐỒNG KHỞI NGHIỆP",
  "-1002129896837": "KHÔNG NGỪNG ĐỔI MỚI",
  "-1002091101362": "CURRENCY SHINING STAR GROUP", 
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
bot.onText(/\/bc2/, async (msg) => {
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
bot.onText(/\/reset2/, async (msg) => {
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
