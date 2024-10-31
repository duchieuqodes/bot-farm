const mongoose = require('mongoose');
const axios = require('axios');
const moment = require('moment-timezone');

// Import model Trasua
const BangCong2 = mongoose.model('BangCong2', BangCongSchema);


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

  async function processAndDistributeTimesheets2(chatId, isToday) {
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

        if (bangCongs.length === 0) continue;

        let totalAmount = 0;
        let content = bangCongs.map(bangCong => {
          totalAmount += bangCong.tinh_tien;
          totalAmountByUser[bangCong.ten] = (totalAmountByUser[bangCong.ten] || 0) + bangCong.tinh_tien;
          return `${bangCong.ten}\t${bangCong.quay}\t${bangCong.keo}\t${bangCong.bill || 0}\t${bangCong.anh || 0}\t${bangCong.tinh_tien} vnd`;
        }).join('\n');

        const managementFee = managementFees[groupId] || 0;
        totalAmount += managementFee;
        content += `\nQuản lý\t-\t-\t-\t-\t${managementFee} vnd`;

        const groupName = await fetchGroupTitle(groupId);
        const imageUrl = await generateTimesheetImage2(content, groupName, totalAmount, dateStr);
        await bot.sendPhoto(chatId, imageUrl);
      }

      let totalAmountContent = '';
      for (const [userName, totalAmount] of Object.entries(totalAmountByUser)) {
        totalAmountContent += `<TR><TD ALIGN="LEFT">${userName}</TD><TD ALIGN="RIGHT">${totalAmount} vnd</TD></TR>`;
      }
      const totalAmountImageUrl = await generateSummaryImage2(totalAmountContent, dateStr);
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

  async function generateTimesheetImage2(content, groupName, totalAmount, dateStr) {
    const url = 'https://quickchart.io/graphviz?format=png&layout=dot&graph=';
    const graph = `
      digraph G {
        node [shape=plaintext];
        a [label=<
          <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="8" STYLE="font-family: Arial, sans-serif;">
            <TR>
              <TD COLSPAN="6" ALIGN="CENTER" STYLE="font-size: 14px; padding: 10px;">
                ${groupName} ${dateStr}
              </TD>
            </TR>
            <TR STYLE="background-color: #2C3E50; color: white;">
              <TD ALIGN="LEFT">Tên</TD>
              <TD ALIGN="CENTER">Quẩy</TD>
              <TD ALIGN="CENTER">Cộng</TD>
              <TD ALIGN="CENTER">Bill</TD>
              <TD ALIGN="CENTER">Ảnh</TD>
              <TD ALIGN="RIGHT">Tiền công</TD>
            </TR>
            ${content.split('\n').map(line => {
              const cells = line.split('\t');
              return `
                <TR>
                  <TD ALIGN="LEFT" STYLE="padding: 6px;">${cells[0]}</TD>
                  <TD ALIGN="CENTER" STYLE="padding: 6px;">${cells[1]}</TD>
                  <TD ALIGN="CENTER" STYLE="padding: 6px;">${cells[2]}</TD>
                  <TD ALIGN="CENTER" STYLE="padding: 6px;">${cells[3]}</TD>
                  <TD ALIGN="CENTER" STYLE="padding: 6px;">${cells[4]}</TD>
                  <TD ALIGN="RIGHT" STYLE="padding: 6px;">${cells[5]}</TD>
                </TR>
              `;
            }).join('')}
            <TR STYLE="background-color: #F8F9FA;">
              <TD COLSPAN="5" ALIGN="RIGHT" STYLE="padding: 8px;">Tổng số tiền:</TD>
              <TD ALIGN="RIGHT" STYLE="padding: 8px;">${totalAmount} vnd</TD>
            </TR>
          </TABLE>
        >];
      }
    `;
    return `${url}${encodeURIComponent(graph)}`;
  }

  async function generateSummaryImage2(content, dateStr) {
    const url = 'https://quickchart.io/graphviz?format=png&layout=dot&graph=';
    const graph = `
      digraph G {
        node [shape=plaintext];
        a [label=<
          <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="8" STYLE="font-family: Arial, sans-serif;">
            <TR>
              <TD COLSPAN="2" ALIGN="CENTER" STYLE="background-color: #2C3E50; color: white; padding: 10px;">
                Tổng số tiền của từng thành viên từ tất cả các nhóm ${dateStr}
              </TD>
            </TR>
            ${content}
          </TABLE>
        >];
      }
    `;
    return `${url}${encodeURIComponent(graph)}`;
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
  // Register command handlers
  bot.onText(/\/111/, async (msg) => {
    const chatId = msg.chat.id;
    await processAndDistributeTimesheets2(chatId, false);
  });

  bot.onText(/\/homnaylan/, async (msg) => {
    const chatId = msg.chat.id;
    await processAndDistributeTimesheets2(chatId, true);
  });
};
