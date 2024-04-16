const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
const keep_alive = require('./keep_alive.js')
const pirate = require('./pirate.js')

// Kết nối MongoDB
mongoose.connect(
  "",
  { useNewUrlParser: true, useUnifiedTopology: true },
);

// Định nghĩa schema cho dữ liệu người chơi và hạt giống
const playerSchema = new mongoose.Schema({
  telegramId: Number,
  username: String,
  seedsThanhLong: { type: Number, default: 0 },
  seedsDuaHau: { type: Number, default: 0 },
  gold: { type: Number, default: 100000 },
  land: { type: Number, default: 1 },
  lastHarvestTime: Number,
  currentSeed: String,
  harvestTime: Number,
  crops: {
    pest: { type: Number, default: 0 }, // Số con sâu bọ
    health: { type: Number, default: 100 }, // Sức khỏe cây trồng (%)
    freshness: { type: String, default: "Tươi" }, // Độ tươi tốt của cây trồng
  },
  fertilizer: { type: Number, default: 1000 }, // Số lượng phân bón
  pesticide: { type: Number, default: 1000 },
  isStolen: { type: Boolean, default: false }, // Thêm trường robbed// Số lượng thuốc diệt sâu
});

// Tạo model từ schema
const Player = mongoose.model("Player", playerSchema);
// Thay đổi URL webhook thành URL công khai của server nếu bạn triển khai bot trên môi trường production
const bot = new TelegramBot("", {
  polling: true,
});

// Lắng nghe sự kiện khi người dùng bắt đầu trò chơi
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  let player = await Player.findOne({ telegramId });

  if (!player) {
    const username = msg.from.username;
    player = new Player({ telegramId, username });
    await player.save();
  } else {
  }

  // Gửi menu mặc định
  sendDefaultReplyMarkup(chatId);
});

// Tạo nút reply markup cho cửa hàng và vào nông trại
bot.onText(/\/menu/, (msg) => {
  const opts = {
    reply_markup: {
      keyboard: [["Đảo Cướp Biển"],["Cửa hàng"], ["Vào Nông Trại"], ["Xem Tài khoản"]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
  bot.sendMessage(msg.chat.id, "Chọn một tùy chọn:", opts);
});

// Xem thông tin tài khoản
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  if (msg.text === "Xem Tài khoản") {
    const player = await Player.findOne({ telegramId });

    if (player) {
      bot.sendMessage(
        chatId,
        `Tên: ${player.username}\nHạt thanh long: ${player.seedsThanhLong} (${player.seedsThanhLong / player.land} mỗi ô đất)\nHạt dưa hấu: ${player.seedsDuaHau} (${player.seedsDuaHau / player.land} mỗi ô đất)\nVàng: ${player.gold}\nÔ đất: ${player.land}`,
      );
    } else {
    }
  } else if (msg.text === "Cửa hàng") {
    const imageUrl = "https://img.upanh.tv/2023/12/01/mainmenushopplants.jpg";
    bot.sendPhoto(chatId, imageUrl, {
      reply_markup: {
        keyboard: [
          ["Mua hạt thanh long", "Mua hạt dưa hấu"],
          ["Mua phân bón", "Mua thuốc sâu bọ"],
          ["Quay lại"],
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    });
  } else if (msg.text === "Vào Nông Trại") {
    enterFarm(chatId);
  }
});

// Xử lý chức năng vào nông trại
function enterFarm(chatId) {
  Player.findOne({ telegramId: chatId }, async (err, player) => {
    if (err || !player) {
      bot.sendMessage(chatId, "Có lỗi xảy ra, vui lòng thử lại sau.");
      return;
    }

    let message = `Số ô đất hiện có: ${player.land}\n`;
    if (player.currentSeed) {
      const remainingTime = player.harvestTime - Math.floor(Date.now() / 1000);
      if (remainingTime <= 0) {
        message += `Đã có thể thu hoạch ${player.currentSeed === "seedsThanhLong" ? "Thanh Long" : "Dưa Hấu"} này,`;
        // Hiển thị tình trạng cây trồng
        message += `\nTình trạng cây trồng:`;
        message += `\n- Sâu bọ: ${player.crops.pest}`;
        message += `\n- Sức khỏe cây trồng: ${player.crops.health}%`;
        message += `\n- Độ tươi tốt: ${player.crops.freshness}`;
      } else {
        message += `Đang gieo hạt ${player.currentSeed === "seedsThanhLong" ? "Thanh Long" : "Dưa Hấu"}, thời gian chờ thu hoạch còn lại: ${remainingTime} giây`;
        // Hiển thị tình trạng cây trồng
        message += `\nTình trạng cây trồng:`;
        message += `\n- Sâu bọ: ${player.crops.pest}`;
        message += `\n- Sức khỏe cây trồng: ${player.crops.health}%`;
        message += `\n- Độ tươi tốt: ${player.crops.freshness}`;
      }
    } else {
      message += "Hiện không có gì đang trồng";
    }

    const opts = {
      reply_markup: {
        keyboard: [
          ["Gieo hạt", "Thu hoạch"],
          [
            "Diệt sâu (" + player.pesticide + " viên)",
            "Bón phân (" + player.fertilizer + " bịch)",
          ],
          ["Tưới nước", "Mua ô đất"],
          ["Cập nhật lại", "Quay lại"],
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    };

    bot.sendMessage(chatId, message, opts);
  });
}

// Xử lý chức năng Mua ô đất khi nhấn nút menu reply markup
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const player = await Player.findOne({ telegramId: chatId });

  if (!player) {
    return;
  }

  // Kiểm tra xem người dùng nhấn vào nút "Mua ô đất" hay không
  if (msg.text === "Mua ô đất") {
    const price =
      player.land > 1
        ? Math.round(15000 * Math.pow(1.3, player.land - 2))
        : 10000;
    const confirmationMessage = `Bạn đang có ${player.land} ô đất. Bạn có muốn mua ô đất thứ ${player.land + 1} với giá ${price}đ không?`;

    const keyboard = {
      keyboard: [[{ text: "Có" }, { text: "Quay về nông trại" }]],
      resize_keyboard: true,
      one_time_keyboard: false,
    };

    bot.sendMessage(chatId, confirmationMessage, { reply_markup: keyboard });
  }
});

// Xử lý lựa chọn mua ô đất
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const player = await Player.findOne({ telegramId: chatId });

  if (!player) {
    bot.sendMessage(chatId, "Bạn chưa có tài khoản nè!");
    return;
  }

  if (msg.text === "Có") {
    const price =
      player.land > 1
        ? Math.round(15000 * Math.pow(1.3, player.land - 2))
        : 10000;
    if (player.gold < price) {
      bot.sendMessage(chatId, "Bạn không đủ vàng để mua ô đất này!");
      return;
    }

    player.gold -= price;
    player.land += 1;
    await player.save();
    bot.sendMessage(
      chatId,
      `Bạn đã mua thành công ô đất thứ ${player.land} với giá ${price}đ.`,
    );
  } else if (msg.text === "Quay về nông trại") {
  }
});

// Hàm bắt đầu đếm ngược cho thời gian chờ thu hoạch và cập nhật trạng thái của cây trồng
function startCountdown(chatId, endTime, seedType) {
  const seedTypeName = seedType === "seedsThanhLong" ? "Thanh Long" : "Dưa Hấu";
  const interval = setInterval(async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const remainingTime = endTime - currentTime;
    if (remainingTime <= 0) {
      clearInterval(interval);
      bot.sendMessage(chatId, `ĐÃ CÓ THỂ THU HOẠCH ${seedTypeName}!`);
    } else {
      // Cập nhật trạng thái của cây trồng
      const player = await Player.findOne({ telegramId: chatId });
      if (player && player.crops) {
        // Tăng số sâu bọ (30% xuất hiện sau mỗi 5 giây)
        if (Math.random() < 0.3) {
          player.crops.pest += 1;
        }
        // Kiểm tra và giảm sức khỏe của cây trồng
        if (player.crops.freshness === "Khô" || player.crops.pest > 0) {
          // Giảm sức khỏe của cây trồng (0.5% mỗi 5 giây nếu có sâu bọ, 0.4% mỗi 5 giây nếu cây trồng khô)
          if (player.crops.pest > 0) {
            player.crops.health = Math.max(0, player.crops.health - 0.5);
          } else {
            player.crops.health = Math.max(0, player.crops.health - 0.4);
          }
        }
        // Kiểm tra và cập nhật độ tươi tốt của cây trồng (sau 30 giây)
        if (currentTime % 30 === 0) {
          player.crops.freshness = "Khô";
        }
        // Đảm bảo sức khỏe cây trồng không vượt quá 0% và không âm
        player.crops.health = Math.max(0, Math.min(player.crops.health, 100));
        await player.save();
      }
    }
  }, 1000); // Đếm ngược mỗi 5 giây
}

// Xử lý chức năng gieo hạt
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const player = await Player.findOne({ telegramId });

  if (!player) {
    bot.sendMessage(chatId, "Bạn chưa có tài khoản ỏ!");
    return;
  }

  if (msg.text === "Gieo hạt") {
    if (player.lastHarvestTime && player.lastHarvestTime > Date.now() / 1000) {
      bot.sendMessage(
        chatId,
        `Hãy chờ đến khi có thể thu hoạch trước khi gieo hạt!`,
      );
      return;
    }
    const opts = {
      reply_markup: {
        keyboard: [
          [`Gieo hạt thanh long (${player.seedsThanhLong} hạt)`],
          [`Gieo hạt dưa hấu (${player.seedsDuaHau} hạt)`],
          [`Quay về nông trại`],
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    };
    bot.sendMessage(chatId, "Chọn loại hạt muốn gieo:", opts);
  } else if (msg.text.includes("Gieo hạt thanh long")) {
    if (player.lastHarvestTime && player.lastHarvestTime > Date.now() / 1000) {
      bot.sendMessage(
        chatId,
        `Hãy chờ đến khi có thể thu hoạch trước khi gieo hạt!`,
      );
      return;
    }
    if (player.seedsThanhLong <= 0) {
      bot.sendMessage(chatId, "Bạn không có hạt thanh long để gieo!");
      return;
    }
    enterFarm(chatId);
    player.currentSeed = "seedsThanhLong";
    player.harvestTime = Math.floor(Date.now() / 1000) + 60; // Thời gian chờ 1 phút
    player.seedsThanhLong -= player.land;
    player.crops = { pest: 0, health: 100, freshness: "Tươi" }; // Tạo cây trồng mới
    await player.save();
    bot.sendMessage(
      chatId,
      `Bạn đã gieo hạt thanh long vào ${player.land} ô đất.`,
    );
    startCountdown(chatId, player.harvestTime, "seedsThanhLong");
    enterFarm(chatId);
  } else if (msg.text.includes("Gieo hạt dưa hấu")) {
    if (player.lastHarvestTime && player.lastHarvestTime > Date.now() / 1000) {
      bot.sendMessage(
        chatId,
        `Hãy chờ đến khi có thể thu hoạch trước khi gieo hạt!`,
      );
      return;
    }
    if (player.seedsDuaHau <= 0) {
      bot.sendMessage(chatId, "Bạn không có hạt dưa hấu để gieo!");
      return;
    }
    enterFarm(chatId);
    player.currentSeed = "seedsDuaHau";
    player.harvestTime = Math.floor(Date.now() / 1000) + 120; // Thời gian chờ 2 phút
    player.seedsDuaHau -= player.land;
    player.crops = { pest: 0, health: 100, freshness: "Tươi" }; // Tạo cây trồng mới
    await player.save();
    bot.sendMessage(
      chatId,
      `Bạn đã gieo hạt dưa hấu vào ${player.land} ô đất.`,
    );
    startCountdown(chatId, player.harvestTime, "seedsDuaHau");
    enterFarm(chatId);
  }
});

// Xử lý chức năng thu hoạch
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const player = await Player.findOne({ telegramId });

  if (!player) {
    return;
  }

  if (msg.text === "Thu hoạch") {
    if (!player.currentSeed || player.harvestTime > Date.now() / 1000) {
      bot.sendMessage(chatId, "Hiện không có gì để thu hoạch!");
      return;
    }

    let goldEarned = 0;
    if (player.currentSeed === "seedsThanhLong") {
      goldEarned = player.land * 800 * (player.crops.health / 100);
    } else if (player.currentSeed === "seedsDuaHau") {
      goldEarned = player.land * 1000 * (player.crops.health / 100);
    }

    player.currentSeed = "";
    player.harvestTime = 0;
    player.gold += goldEarned;
    await player.save();
    bot.sendMessage(
      chatId,
      `Bạn đã thu hoạch thành công và nhận được ${goldEarned} vàng.`,
    );
  }
});

// Hàm gửi nút reply markup mặc định
function sendDefaultReplyMarkup(chatId) {
  const opts = {
    reply_markup: {
      keyboard: [["Cửa hàng"], ["Vào Nông Trại"], ["Xem Tài khoản"]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
  bot.sendMessage(chatId, "Chọn một tùy chọn:", opts);
}

// Xử lý chức năng mua phân bón và thuốc sâu bọ
bot.onText(/Mua (phân bón|thuốc sâu bọ)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const player = await Player.findOne({ telegramId });

  if (!player) {
    bot.sendMessage(chatId, "Bạn chưa có tài khoản k!");
    return;
  }

  const item = match[1].toLowerCase();
  let itemType, price;

  switch (item) {
    case "phân bón":
      itemType = "fertilizer";
      price = 50;
      break;
    case "thuốc sâu bọ":
      itemType = "pesticide";
      price = 25;
      break;
    default:
      bot.sendMessage(chatId, "Chức năng không hợp lệ!");
      return;
  }

  const opts = {
    reply_markup: JSON.stringify({
      force_reply: true,
      selective: true,
    }),
  };

  bot
    .sendMessage(chatId, "Vui lòng nhập số lượng muốn mua:", opts)
    .then((sentMessage) => {
      bot.once("message", async (msg) => {
        const quantity = parseInt(msg.text);
        if (isNaN(quantity) || quantity <= 0) {
          bot.sendMessage(chatId, "Số lượng không hợp lệ!");
          sendShopMenu(chatId);
          return;
        }

        const totalCost = quantity * price;
        if (player.gold < totalCost) {
          bot.sendMessage(chatId, "Bạn không có đủ vàng!");
          sendShopMenu(chatId);
          return;
        }

        // Mua phân bón hoặc thuốc sâu bọ
        player.gold -= totalCost;
        player[itemType] += quantity;
        await player.save();
        bot.sendMessage(
          chatId,
          `Bạn đã mua ${quantity} ${item} thành công! Tổng số tiền đã mua: ${totalCost}đ`,
        );
        sendShopMenu(chatId);
      });
    });
});

// Xử lý chức năng mua hạt thanh long và dưa hấu
bot.onText(/Mua hạt (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const player = await Player.findOne({ telegramId });

  if (!player) {
    bot.sendMessage(chatId, "Bạn chưa có tài khoản q!");
    return;
  }

  const item = match[1].toLowerCase();
  let seedType, price;

  switch (item) {
    case "thanh long":
      seedType = "seedsThanhLong";
      price = 400;
      break;
    case "dưa hấu":
      seedType = "seedsDuaHau";
      price = 550;
      break;
    default:
      bot.sendMessage(chatId, "Chức năng không hợp lệ!");
      return;
  }

  const opts = {
    reply_markup: JSON.stringify({
      force_reply: true,
      selective: true,
    }),
  };

  bot
    .sendMessage(chatId, "Vui lòng nhập số lượng muốn mua:", opts)
    .then((sentMessage) => {
      bot.once("message", async (msg) => {
        const quantity = parseInt(msg.text);
        if (isNaN(quantity) || quantity <= 0) {
          bot.sendMessage(chatId, "Số lượng không hợp lệ!");
          sendShopMenu(chatId);
          return;
        }

        const totalCost = quantity * price;
        if (player.gold < totalCost) {
          bot.sendMessage(chatId, "Bạn không có đủ vàng!");
          sendShopMenu(chatId);
          return;
        }

        // Mua hạt thanh long hoặc dưa hấu
        player.gold -= totalCost;
        player[seedType] += quantity;
        await player.save();
        bot.sendMessage(
          chatId,
          `Bạn đã mua ${quantity} hạt ${item} thành công! Tổng số tiền đã mua: ${totalCost}đ`,
        );

        sendShopMenu(chatId);
      });
    });
});

const imageUrl = "https://img.upanh.tv/2023/12/01/mainmenushopplants.jpg";

// Hàm gửi lại menu cửa hàng
function sendShopMenu(chatId) {
  const opts = {
    reply_markup: {
      keyboard: [
        ["Mua hạt thanh long", "Mua hạt dưa hấu"],
        ["Mua phân bón", "Mua thuốc sâu bọ"],
        ["Quay lại"],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
    caption: "Menu Cửa hàng:",
    parse_mode: "Markdown",
    disable_notification: true,
  };

  bot.sendPhoto(chatId, imageUrl, opts);
}

//Xử lý chức năng Bón phân, Tưới nước, Diệt sâu
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const player = await Player.findOne({ telegramId });

  if (!player) {
    return;
  }

  switch (true) {
    case /Diệt sâu/i.test(msg.text):
      handlePesticide(chatId, player);
      break;
    case /Bón phân/i.test(msg.text):
      handleFertilizer(chatId, player);
      break;
    case /Tưới nước/i.test(msg.text):
      handleWatering(chatId, player);
      break;
    case /Cập nhật lại/i.test(msg.text):
      enterFarm(chatId); // Gọi lại menu Vào Nông Trại
      break;
    default:
  }
});

async function handleFertilizer(chatId, player) {
  if (player.fertilizer < 1) {
    bot.sendMessage(chatId, "Bạn không có đủ phân bón!");
    return;
  }

  player.fertilizer -= 25;
  player.crops.health += 25;
  player.crops.health = Math.min(100, player.crops.health);
  await player.save();
  bot.sendMessage(
    chatId,
    "Bạn đã bón phân thành công hãy ấn cập nhật lại để xem tình trạng cây trồng!",
  );
}

async function handleWatering(chatId, player) {
  player.crops.freshness = "Tươi";
  await player.save();
  bot.sendMessage(
    chatId,
    "Bạn đã tưới nước thành công hãy ấn cập nhật lại để xem tình trạng cây trồng!",
  );
}

async function handlePesticide(chatId, player) {
  if (player.pesticide < 1) {
    bot.sendMessage(chatId, "Bạn không có đủ thuốc diệt sâu!");
    return;
  }

  player.pesticide -= player.crops.pest;
  player.crops.pest = 0;
  await player.save();
  bot.sendMessage(
    chatId,
    "Bạn đã diệt sâu thành công hãy ấn cập nhật lại để xem tình trạng cây trồng!",
  );
}

//Nút quay lại
// Xử lý khi người dùng ấn nút "Quay lại"
bot.onText(/Quay lại/, (msg) => {
  const chatId = msg.chat.id;
  sendMainMenu(chatId);
});

// Hàm gửi menu chính
function sendMainMenu(chatId) {
  const opts = {
    reply_markup: {
      keyboard: [["Vào Nông Trại"], ["Cửa hàng", "Xem Tài khoản"]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };

  bot.sendMessage(chatId, "Map chính:", opts);
}

// Xử lý khi người dùng ấn nút "Quay về nông trại"
bot.onText(/Quay về nông trại/, (msg) => {
  const chatId = msg.chat.id;
  enterFarm(chatId);
});

// Xử lý lệnh /check
bot.onText(/\/check/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  // Kiểm tra quyền hạn của người gửi
  if (!isAdmin(telegramId)) {
    bot.sendMessage(chatId, "Bạn không có quyền truy cập vào chức năng này!");
    return;
  }

  // Hiển thị menu tùy chọn
  const opts = {
    reply_markup: {
      keyboard: [["Xem danh sách", "Kiểm tra tài khoản"]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };

  bot.sendMessage(chatId, "Chọn một trong các chức năng sau:", opts);
});

// Xử lý nút "Xem danh sách"
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  if (msg.text === "Xem danh sách") {
    const players = await Player.find({}, "username telegramId");

    let playerList = "Tổng số người chơi: " + players.length + "\n";
    players.forEach((player) => {
      playerList += `Username: ${player.username}, ID: ${player.telegramId}\n`;
    });

    bot.sendMessage(chatId, playerList);
  }
});

// Xử lý nút "Kiểm tra tài khoản"
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  if (msg.text === "Kiểm tra tài khoản") {
    bot.sendMessage(
      chatId,
      "Vui lòng nhập tên người chơi hoặc ID để kiểm tra:",
    );
    // Lắng nghe tin nhắn tiếp theo của người dùng để nhận tên người chơi hoặc ID
    bot.once("message", async (msg) => {
      const playerName = msg.text.trim();
      let player;

      // Kiểm tra nếu người dùng nhập là ID
      if (!isNaN(playerName)) {
        player = await Player.findOne({ telegramId: parseInt(playerName) });
      } else {
        // Kiểm tra theo tên người chơi
        player = await Player.findOne({ username: playerName });
      }

      if (!player) {
        bot.sendMessage(chatId, "Không tìm thấy người chơi!");
        return;
      }

      // Hiển thị thông tin tài khoản
      let accountInfo = `Username: ${player.username}\nSố vàng: ${player.gold}\nSố ô đất: ${player.land}`;

      if (player.currentSeed) {
        if (player.harvestTime <= Math.floor(Date.now() / 1000)) {
          accountInfo += `\nĐÃ CÓ THỂ THU HOẠCH`;

          accountInfo += `\nTên hạt giống đang gieo: ${player.currentSeed === "seedsThanhLong" ? "Thanh Long" : "Dưa Hấu"}`;
          accountInfo += `\nSức khỏe cây trồng: ${player.crops.health}`;

          accountInfo += `\nĐộ tươi tốt: ${player.crops.freshness}`;
          accountInfo += `\nSố sâu bọ: ${player.crops.pest}`;
        } else {
          const remainingTime =
            player.harvestTime - Math.floor(Date.now() / 1000);
          accountInfo += `\nTên hạt giống đang gieo: ${player.currentSeed === "seedsThanhLong" ? "Thanh Long" : "Dưa Hấu"}`;
          accountInfo += `\nSức khỏe cây trồng: ${player.crops.health}`;
          accountInfo += `\nThời gian chờ còn lại: ${remainingTime <= 0 ? "Đã có thể thu hoạch" : remainingTime + " giây"}`;
          accountInfo += `\nĐộ tươi tốt: ${player.crops.freshness}`;
          accountInfo += `\nSố sâu bọ: ${player.crops.pest}`;
        }
      } else {
        accountInfo += `\nHiện không có gì đang trồng`;
      }

      bot.sendMessage(chatId, accountInfo);
    });
  }
});
