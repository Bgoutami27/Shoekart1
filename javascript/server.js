const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/shoekart", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => console.log("MongoDB connected"));

// Mongoose Schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
});
const User = mongoose.model("User", UserSchema);

// Serve signup and login pages
app.get("/signup", (req, res) => res.sendFile(path.join(__dirname, "views/signup.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "views/login.html")));

// Handle signup
app.post("/signup", async (req, res) => {
  const { name, email, password, confirm } = req.body;

  if (password !== confirm) return res.json({ success: false, message: "Passwords do not match" });

  const existingUser = await User.findOne({ email });
  if (existingUser) return res.json({ success: false, message: "Email already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({ name, email, password: hashedPassword });
  await newUser.save();

  res.json({ success: true });
});

// Handle login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user) return res.json({ success: false, message: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.json({ success: false, message: "Invalid password" });

  res.json({ success: true });
});

// Dashboard page
app.get("/dashboard", (req, res) => {
  res.send("<h1>Welcome to ShoeKart Dashboard!</h1>");
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
