require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Kết nối MongoDB Atlas
const mongoURI =
  "mongodb+srv://duchieufaryoung0:80E9gUahdOXmGKuy@cluster0.6nlv1cv.mongodb.net/telegram_bot_db?retryWrites=true&w=majority";
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Error:", err));

// Middleware
app.use(express.json());
app.use(cors());

// Mô hình dữ liệu người chơi
const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  gold: { type: Number, default: 100 },
  level: { type: Number, default: 1 },
  seeds: { type: Number, default: 5 },
  farm: { type: Array, default: [] }, // Chứa dữ liệu cây trồng
});

const User = mongoose.model("User", UserSchema);

// Đăng ký tài khoản
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const existingUser = await User.findOne({ username });
  if (existingUser) return res.status(400).json({ message: "Tên đăng nhập đã tồn tại" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ username, password: hashedPassword });
  await newUser.save();
  res.json({ message: "Đăng ký thành công" });
});

// Đăng nhập
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ message: "Tài khoản không tồn tại" });

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(400).json({ message: "Sai mật khẩu" });

  const token = jwt.sign({ userId: user._id }, "secretKey", { expiresIn: "24h" });
  res.json({ token, user });
});

// Cập nhật dữ liệu farm (trồng cây, thu hoạch)
app.post("/update-farm", async (req, res) => {
  const { username, farm } = req.body;
  await User.updateOne({ username }, { farm });
  res.json({ message: "Cập nhật farm thành công" });
});

// Socket.io - Multiplayer
io.on("connection", (socket) => {
  console.log("Người chơi đã kết nối:", socket.id);

  socket.on("player-move", (data) => {
    io.emit("player-move", data); // Gửi đến tất cả người chơi
  });

  socket.on("disconnect", () => {
    console.log("Người chơi đã thoát:", socket.id);
  });
});

// Khởi động server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server chạy trên cổng ${PORT}`));
