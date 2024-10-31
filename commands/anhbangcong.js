const axios = require('axios');
const moment = require('moment-timezone');

const mongoose = require('mongoose');

// Import model BangCong2
const BangCong2 = mongoose.model('BangCong2');

cron.schedule('30 1 * * *', async () => { // 2 giờ UTC là 9 giờ sáng theo giờ Việt Nam
  const targetChatId = '-1002103270166';
  await handleAndDistributeOtherTimesheets(targetChatId);
});

// Đối tượng lưu phí quản lý cho mỗi groupId
const managementFeesByGroup = {
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

async function handleAndDistributeTimesheets(targetChatId, isCurrentDay) {
 const chosenDate = isCurrentDay ? new Date() : new Date(Date.now() - 86400000); // Hôm nay hoặc Hôm qua
  const startOfChosenDay = new Date(chosenDate);
  startOfChosenDay.setHours(0, 0, 0, 0);
  const endOfChosenDay = new Date(chosenDate);
  endOfChosenDay.setHours(23, 59, 59, 999);
  const dateString = `${chosenDate.getDate()}/${chosenDate.getMonth() + 1}/${chosenDate.getFullYear()}`;

  try {
    let totalEarningsByUser = {}; // Đối tượng để lưu tổng số tiền của mỗi người dùng

    for (const groupId of allowedGroupIds) {
      const timesheets = await TimesheetCollection.find({
        date: { $gte: startOfChosenDay, $lte: endOfChosenDay },
        groupId: groupId
      });

      if (timesheets.length === 0) {
        continue;
      }

      let groupTotalEarnings = 0;
      let timesheetContent = timesheets.map(timesheet => {
        groupTotalEarnings += timesheet.earnings;
        totalEarningsByUser[timesheet.name] = (totalEarningsByUser[timesheet.name] || 0) + timesheet.earnings;
        return `${timesheet.name}\t${timesheet.booth}\t${timesheet.extra}\t${timesheet.bill || 0}\t${timesheet.photo || 0}\t${timesheet.earnings}vnđ`;
      }).join('\n');

      // Thêm phí quản lý cho groupId
      const groupManagementFee = managementFeesByGroup[groupId] || 0;
      groupTotalEarnings += groupManagementFee;

      // Thêm phí quản lý vào nội dung bảng công
      timesheetContent += `\nQuản lý\t-\t-\t-\t-\t${groupManagementFee}vnđ`;

      const groupTitle = await retrieveGroupTitle(groupId);
      const imageUrl = await createTimesheetImage(timesheetContent, groupTitle, groupTotalEarnings, dateString);
      await bot.sendPhoto(targetChatId, imageUrl);
    }

    let userTotalEarningsContent = '';
    for (const [userName, totalEarnings] of Object.entries(totalEarningsByUser)) {
      userTotalEarningsContent += `<TR><TD ALIGN="LEFT" STYLE="font-weight: bold;">${userName}</TD><TD ALIGN="CENTER">${totalEarnings}vnđ</TD></TR>`;
    }
    const totalEarningsImageUrl = await createSummaryImage(userTotalEarningsContent, dateString);
    await bot.sendPhoto(targetChatId, totalEarningsImageUrl);

    if (!isCurrentDay) {
      const alertMessages = [
        `Attention, attention! Bảng công (${dateString}) nóng hổi vừa ra lò, ai chưa check điểm danh là lỡ mất cơ hội "ăn điểm" với sếp đó nha!`,
        `Bảng công (${dateString}) - Phiên bản "limited edition", hãy nhanh tay "sưu tầm" trước khi hết hàng! ‍♀️‍♂️`,
      ];
      const chosenMessage = alertMessages[Math.floor(Math.random() * alertMessages.length)];
      const alertMessage = await bot.sendMessage(targetChatId, chosenMessage);
      await bot.pinChatMessage(targetChatId, alertMessage.message_id);
    }
  } catch (error) {
    console.error('Lỗi khi truy vấn dữ liệu từ MongoDB:', error);
    bot.sendMessage(targetChatId, 'Failed to create image.');
  }
}

async function createTimesheetImage(content, groupTitle, totalEarnings, dateString) {
  const url = 'https://quickchart.io/graphviz?format=png&layout=dot&graph=';
  const graph = `
    digraph G {
      node [shape=plaintext];
      a [label=<
        <TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" STYLE="font-family: 'Arial', sans-serif; border: 1px solid black;">
          <TR><TD COLSPAN="6" ALIGN="CENTER" BGCOLOR="#3A4B57" STYLE="font-size: 18px; font-weight: bold; color: white;">${groupTitle} - ${dateString}</TD></TR>
          <TR STYLE="font-weight: bold; background-color: #2D3E4F; color: white;">
            <TD ALIGN="CENTER">Tên</TD>
            <TD ALIGN="CENTER">Quẩy</TD>
            <TD ALIGN="CENTER">Cộng</TD>
            <TD ALIGN="CENTER">Bill</TD>
            <TD ALIGN="CENTER">Ảnh</TD>
            <TD ALIGN="CENTER">Tiền công</TD>
          </TR>
          ${content.split('\n').map(line => `<TR><TD ALIGN="LEFT">${line.split('\t').join('</TD><TD ALIGN="CENTER">')}</TD></TR>`).join('')}
          <TR STYLE="font-weight: bold; background-color: #EFEFEF;">
            <TD COLSPAN="5" ALIGN="RIGHT">Tổng số tiền</TD>
            <TD ALIGN="CENTER">${totalEarnings} vnđ</TD>
          </TR>
        </TABLE>
      >];
    }
  `;
  const imageUrl = `${url}${encodeURIComponent(graph)}`;
  return imageUrl;
}

async function createSummaryImage(content, dateString) {
  const url = 'https://quickchart.io/graphviz?format=png&layout=dot&graph=';
  const graph = `
    digraph G {
      node [shape=plaintext];
      a [label=<
        <TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" STYLE="font-family: 'Arial', sans-serif; border: 1px solid black;">
          <TR><TD COLSPAN="2" ALIGN="CENTER" BGCOLOR="#3A4B57" STYLE="font-size: 18px; font-weight: bold; color: white;">Tổng số tiền của từng thành viên từ tất cả các nhóm - ${dateString}</TD></TR>
          ${content}
        </TABLE>
      >];
    }
  `;
  const imageUrl = `${url}${encodeURIComponent(graph)}`;
  return imageUrl;
}

async function retrieveGroupTitle(groupId) {
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
  const targetChatId = msg.chat.id;
  await handleAndDistributeTimesheets(targetChatId, false);
});

bot.onText(/\/homnaylan/, async (msg) => {
  const targetChatId = msg.chat.id;
  await handleAndDistributeTimesheets(targetChatId, true);
});
};
