const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Ensure uploads/ directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// Middleware
app.use(cors({
  origin: "http://127.0.0.1:5500",
  methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
  credentials: false
}));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "../images")));
app.use("/uploads", express.static(uploadDir));

// MongoDB connection
mongoose.connect("mongodb://127.0.0.1:27017/shoekart", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.connection.on("connected", () => console.log("MongoDB connected"));
mongoose.connection.on("error", err => console.error("MongoDB error:", err));

// Schemas
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ["user", "admin"], default: "user" },
  isFirstLogin: { type: Boolean, default: true },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }]
});

const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String,
  category: { type: String, enum: ["men", "women", "kids"], required: true }
});

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  products: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      productName: String,
      productPrice: Number,
      quantity: Number
    }
  ],
  totalAmount: Number,
  status: { type: String, enum: ["Pending", "Shipped", "Delivered"], default: "Pending" },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);
const Product = mongoose.model("Product", ProductSchema);
const Order = mongoose.model("Order", OrderSchema);

// Routes

// Signup
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password, confirm, role } = req.body;
    if (password !== confirm) return res.status(400).json({ success: false, message: "Passwords do not match" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ success: false, message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = await new User({ name, email, password: hashed, role }).save();

    res.json({ success: true, role: newUser.role });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ success: false, message: "Invalid password" });

    if (user.role !== role) return res.status(403).json({ success: false, message: `Incorrect role. Registered as ${user.role}` });

    const isNewUser = user.isFirstLogin;
    if (isNewUser) {
      user.isFirstLogin = false;
      await user.save();
    }

    res.json({ success: true, role: user.role, isNewUser });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Wishlist
app.post("/wishlist", async (req, res) => {
  try {
    const { email, productId } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (!user.wishlist.includes(productId)) {
      user.wishlist.push(productId);
      await user.save();
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Wishlist error:", err);
    res.status(500).json({ success: false });
  }
});

app.get("/wishlist/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email }).populate("wishlist");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json(user.wishlist);
  } catch (err) {
    console.error("Get wishlist error:", err);
    res.status(500).json({ success: false });
  }
});

// Product APIs
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find(req.query.category ? { category: req.query.category } : {});
    res.json(products);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
});

app.post("/products", upload.single("imageFile"), async (req, res) => {
  try {
    const { name, price, category, imageUrl } = req.body;
    if (!name || !price || !category) return res.status(400).json({ success: false, message: "All fields required" });

    let image = "";
    if (req.file) image = `/uploads/${req.file.filename}`;
    else if (imageUrl) image = imageUrl;
    else return res.status(400).json({ success: false, message: "Image is required" });

    const product = new Product({ name, price, category, image });
    await product.save();
    res.json({ success: true, product });
  } catch (err) {
    console.error("Add product error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});

// Order APIs
app.post("/orders", async (req, res) => {
  try {
    const { email, products, totalAmount } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const productData = await Promise.all(products.map(async p => {
      const product = await Product.findById(p.productId);
      if (!product) throw new Error(`Product not found: ${p.productId}`);
      return {
        productId: product._id,
        productName: product.name,
        productPrice: product.price,
        quantity: p.quantity
      };
    }));

    const order = new Order({ userId: user._id, products: productData, totalAmount });
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    console.error("Order creation error:", err);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
});

app.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find().populate("userId", "email").sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("Orders fetch error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});

app.put("/orders/:id", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json({ success: true, order });
  } catch (err) {
    console.error("Update order error:", err);
    res.status(500).json({ success: false, message: "Failed to update order" });
  }
});

// Analytics
app.get("/analytics", async (req, res) => {
  try {
    const [totalUsers, totalAdmins, totalProducts, totalOrders, totalRevenueAgg] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "admin" }),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([{ $group: { _id: null, revenue: { $sum: "$totalAmount" } } }])
    ]);

    res.json({
      totalUsers,
      totalAdmins,
      totalProducts,
      totalOrders,
      totalRevenue: totalRevenueAgg[0]?.revenue || 0
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ success: false, message: "Analytics failed" });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
