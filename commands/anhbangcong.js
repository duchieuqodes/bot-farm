const axios = require('axios');
const moment = require('moment-timezone');

const mongoose = require('mongoose');

// Import model BangCong2
const BangCong2 = mongoose.model('BangCong2');

// Đối tượng lưu phí quản lý cho mỗi groupId
// Lên lịch tự động gửi bảng công vào 9 giờ sáng Việt Nam mỗi ngày

// Đối tượng chứa phí quản lý cho từng groupId
const updatedManagementFees = {
  '-1002230199552': 100000,
  '-1002178207739': 50000,
  '-1002205826480': 50000, 
  '-1002235474314': 70000,
  '-1002311651580': 50000, 
  '-1002449707024': 70000, 
  '-1002186698265': 75000,
  '-1002439441449': 80000, 
  '-1002350493572': 75000,
  '-1002311358141': 50000,
  '-1002245725621': 50000,
  '-1002481836552': 80000, 
  '-1002300392959': 75000,
  '-1002113921526': 90000,
  '-1002243393101': 50000,
  '-1002349272974': 80000, 
  '-1002259135527': 75000,
  '-1002160116020': 50000 
};

// Hàm xử lý và phân phối bảng công cho từng nhóm
async function processAndDistributeTimesheetsUpdated(chatId, isToday) {
  const targetDate = isToday ? new Date() : new Date(Date.now() - 86400000); 
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  const dateStr = `${targetDate.getDate()}/${targetDate.getMonth() + 1}/${targetDate.getFullYear()}`;

  try {
    let totalAmountByUser = {};

    for (const groupId of allowedGroupIds) {
      const bangCongs = await BangCong2.find({
        date: { $gte: startOfDay, $lte: endOfDay },
        groupId: groupId
      });

      if (bangCongs.length === 0) {
        continue;
      }

      let totalAmount = 0;
      let content = bangCongs.map(bangCong => {
        totalAmount += bangCong.tinh_tien;
        totalAmountByUser[bangCong.ten] = (totalAmountByUser[bangCong.ten] || 0) + bangCong.tinh_tien;
        return `${bangCong.ten}\t${bangCong.quay}\t${bangCong.keo}\t${bangCong.bill || 0}\t${bangCong.anh || 0}\t${bangCong.tinh_tien}vnđ`;
      }).join('\n');

      // Thêm phí quản lý cho từng nhóm
      const managementFee = updatedManagementFees[groupId] || 0;
      totalAmount += managementFee;

      content += `\nQuản lý\t-\t-\t-\t-\t${managementFee}vnđ`;

      const groupName = await fetchGroupTitleUpdated(groupId);
      const imageUrl = await createTimesheetImage(content, groupName, totalAmount, dateStr);
      console.log('Generated Image URL:', imageUrl); // Kiểm tra URL được tạo ra

      await bot.sendPhoto(chatId, imageUrl);
    }

    let totalAmountContent = '';
    for (const [userName, totalAmount] of Object.entries(totalAmountByUser)) {
      totalAmountContent += `<TR><TD ALIGN="LEFT" STYLE="font-weight: bold;">${userName}</TD><TD ALIGN="CENTER">${totalAmount}vnđ</TD></TR>`;
    }
    const totalAmountImageUrl = await createSummaryImage(totalAmountContent, dateStr);
    console.log('Total Amount Image URL:', totalAmountImageUrl); // Kiểm tra URL của tổng số tiền

    await bot.sendPhoto(chatId, totalAmountImageUrl);

    if (!isToday) {
      const messages = [
        `Attention, attention! Bảng công (${dateStr}) nóng hổi vừa ra lò, ai chưa check điểm danh là lỡ mất cơ hội "ăn điểm" với sếp đó nha!`,
        `Bảng công (${dateStr}) - Phiên bản "limited edition", hãy nhanh tay "sưu tầm" trước khi hết hàng! ‍♀️‍♂️`,
      ];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      const message = await bot.sendMessage(chatId, randomMessage);
      await bot.pinChatMessage(chatId, message.message_id);
    }
  } catch (error) {
    console.error('Lỗi khi truy vấn dữ liệu từ MongoDB:', error);
    bot.sendMessage(chatId, 'Failed to create image.');
  }
}

// Hàm tạo hình ảnh bảng công
async function createTimesheetImage(content, groupName, totalAmount, dateStr) {
  const url = 'https://quickchart.io/graphviz?format=png&layout=dot&graph=';
  const graph = `
    digraph G {
      node [shape=plaintext];
      a [label=<
        <TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" STYLE="font-family: 'Arial', sans-serif; border: 1px solid black;">
          <TR><TD COLSPAN="6" ALIGN="CENTER" BGCOLOR="#FFCC00" STYLE="font-size: 16px; font-weight: bold;">${groupName} - ${dateStr}</TD></TR>
          <TR STYLE="font-weight: bold; background-color: #FFCC00;">
            <TD ALIGN="CENTER">Tên</TD>
            <TD ALIGN="CENTER">Quẩy</TD>
            <TD ALIGN="CENTER">Cộng</TD>
            <TD ALIGN="CENTER">Bill</TD>
            <TD ALIGN="CENTER">Ảnh</TD>
            <TD ALIGN="CENTER">Tiền công</TD>
          </TR>
          ${content.split('\n').map(line => `<TR><TD ALIGN="LEFT" STYLE="font-weight: bold;">${line.split('\t').join('</TD><TD ALIGN="CENTER">')}</TD></TR>`).join('')}
          <TR STYLE="font-weight: bold;">
            <TD COLSPAN="3" ALIGN="LEFT">Tổng số tiền</TD>
            <TD ALIGN="CENTER">${totalAmount}vnđ</TD>
            <TD COLSPAN="2"></TD>
          </TR>
        </TABLE>
      >];
    }
  `;
  
  const imageUrl = `${url}${encodeURIComponent(graph)}`;
  console.log('URL Length:', imageUrl.length); // Kiểm tra độ dài của URL
  console.log('Graph Data:', graph); // Kiểm tra nội dung của graph
  
  if (imageUrl.length > 2000) {
    console.error("URL quá dài, không thể gửi qua Telegram");
    throw new Error("URL quá dài để gửi qua Telegram");
  }

  return imageUrl;
}



// Hàm tạo hình ảnh tổng kết
async function createSummaryImage(content, dateStr) {
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
  console.log('Graph Data for Summary:', graph); // In dữ liệu của graph để kiểm tra lỗi định dạng
  return imageUrl;
}

// Hàm lấy tên nhóm từ groupId
async function fetchGroupTitleUpdated(groupId) {
  try {
    const chat = await bot.getChat(groupId);
    return chat.title;
  } catch (error) {
    console.error(`Error getting group name for ${groupId}:`, error);
    return `Nhóm ${groupId}`;
  }
}
module.exports = (bot) => {
// Lệnh nhận bảng công
bot.onText(/\/bangconglan/, async (msg) => {
  const chatId = msg.chat.id;
  await processAndDistributeTimesheetsUpdated(chatId, false);
});

// Lệnh nhận bảng công hôm nay
bot.onText(/\/homnaylan/, async (msg) => {
  const chatId = msg.chat.id;
  await processAndDistributeTimesheetsUpdated(chatId, true);
});
};
