const axios = require('axios');
const moment = require('moment-timezone');
const cron = require('node-cron'); // Thư viện để thiết lập cron jobs
const mongoose = require('mongoose');

// Import model BangCong2
const BangCong2 = mongoose.model('BangCong2');


// Chức năng tự động gửi hình ảnh vào 9h sáng mỗi ngày (theo giờ Việt Nam)
cron.schedule('30 1 * * *', async () => { // 2 giờ UTC là 9 giờ sáng theo giờ Việt Nam
  const chatId = '-1002103270166';
  await processAndDistributeOtherTimesheets(chatId);
});



// Object to hold management fees for each groupId
const managementFees = {
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

const allowedGroupIds = [
  -1002230199552, -1002449707024, -1002160116020, -1002259135527, -1002349272974, -1002312409314, -1002439441449, -1002178207739, -1002235474314, -1002186698265, -1002205826480,
  -1002311358141, -1002481836552, -1002245725621, -1002350493572, -1002300392959, -1002113921526, -1002243393101, -1002311651580
];

async function processAndDistributeTimesheets(chatId, isToday) {
 const targetDate = isToday ? new Date() : new Date(Date.now() - 86400000); // Today or Yesterday
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  const dateStr = `${targetDate.getDate()}/${targetDate.getMonth() + 1}/${targetDate.getFullYear()}`;


try {
    let totalAmountByUser = {}; // Đối tượng để lưu tổng số tiền của mỗi người dùng

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

      // Add management fee for the groupId
      const managementFee = managementFees[groupId] || 0;
      totalAmount += managementFee;

      // Append management fee to the content
      content += `\nQuản lý\t-\t-\t-\t-\t${managementFee}vnđ`;

      const groupName = await fetchGroupTitle(groupId);
      const imageUrl = await generateTimesheetImage(content, groupName, totalAmount, dateStr);
      await bot.sendPhoto(chatId, imageUrl);
    }

    let totalAmountContent = '';
    for (const [userName, totalAmount] of Object.entries(totalAmountByUser)) {
      totalAmountContent += `<TR><TD ALIGN="LEFT" STYLE="font-weight: bold;">${userName}</TD><TD ALIGN="CENTER">${totalAmount}vnđ</TD></TR>`;
    }
    const totalAmountImageUrl = await generateSummaryImage(totalAmountContent, dateStr);
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


async function generateTimesheetImage(content, groupName, totalAmount, dateStr) {
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
  return imageUrl;
}

async function generateSummaryImage(content, dateStr) {
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

async function fetchGroupTitle(groupId) {
  try {
    const chat = await bot.getChat(groupId);
    return chat.title;
  } catch (error) {
    console.error(`Error getting group name for ${groupId}:`, error);
    return `Nhóm ${groupId}`;
  }
}

module.exports = (bot) => {
bot.onText(/\/bangconglan/, async (msg) => {
  const chatId = msg.chat.id;
  await processAndDistributeTimesheets(chatId, false);
});

bot.onText(/\/homnaylan/, async (msg) => {
  const chatId = msg.chat.id;
  await processAndDistributeTimesheets(chatId, true);
});


bot.onText(/\/bangconghieu/, async (msg) => {
  const chatId = msg.chat.id;
  await processAndDistributeOtherTimesheets(chatId);
});
};

async function processAndDistributeOtherTimesheets(chatId) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const startOfYesterday = new Date(yesterday);
  startOfYesterday.setHours(0, 0, 0, 0);
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999);
  const dateStr = `${yesterday.getDate()}/${yesterday.getMonth() + 1}/${yesterday.getFullYear()}`;

  try {
    let totalAmountByUser = {}; // Đối tượng để lưu tổng số tiền của mỗi người dùng

    // Fetch all unique groupIds from the database
    const allGroupIds = await BangCong2.distinct('groupId', {
      date: { $gte: startOfYesterday, $lte: endOfYesterday }
    });

    // Filter out the allowedGroupIds
    const otherGroupIds = allGroupIds.filter(id => !allowedGroupIds.includes(id));

    for (const groupId of otherGroupIds) {
      const bangCongs = await BangCong2.find({
        date: { $gte: startOfYesterday, $lte: endOfYesterday },
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

      const groupName = await fetchGroupTitle(groupId);
      const imageUrl = await generateTimesheetImage(content, groupName, totalAmount, dateStr);
      await bot.sendPhoto(chatId, imageUrl);
    }

    let totalAmountContent = '';
    for (const [userName, totalAmount] of Object.entries(totalAmountByUser)) {
      totalAmountContent += `<TR><TD ALIGN="LEFT" STYLE="font-weight: bold;">${userName}</TD><TD ALIGN="CENTER">${totalAmount}vnđ</TD></TR>`;
    }
    const totalAmountImageUrl = await generateSummaryImage(totalAmountContent, dateStr);
    await bot.sendPhoto(chatId, totalAmountImageUrl);

    const message = await bot.sendMessage(chatId, `Bảng công các nhóm khác (${dateStr}) đã được tạo và gửi thành công!`);
    await bot.pinChatMessage(chatId, message.message_id);
  } catch (error) {
    console.error('Lỗi khi truy vấn dữ liệu từ MongoDB:', error);
    bot.sendMessage(chatId, 'Failed to create images for other groups.');
  }
}


