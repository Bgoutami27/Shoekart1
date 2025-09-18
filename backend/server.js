// -------------------- IMPORTS --------------------
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config();

// -------------------- APP SETUP --------------------
const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads/ directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// -------------------- MIDDLEWARE --------------------
const allowedOrigins = [
  "https://shoekart1.onrender.com",
  "http://localhost:3000" // optional, for local testing
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests (like Postman)
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, "../frontend")));
app.use("/backend/views", express.static(path.join(__dirname, "views")));
app.use("/backend/public", express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "../images")));
app.use("/uploads", express.static(uploadDir));

// -------------------- DATABASE CONNECTION --------------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Atlas connected successfully"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// -------------------- SCHEMAS --------------------
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: String,
  role: { type: String, default: "user" },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  cart: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      quantity: { type: Number, default: 1 }
    }
  ]
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, enum: ["men", "women", "kids"], required: true },
  description: { type: String, default: "" },
  image: { type: String, required: true },

  // New fields
  size: { type: String, default: "" },
  brand: { type: String, default: "" },
  rating: { type: Number, min: 1, max: 5, default: null },
  color: { type: String, default: "" },

  createdAt: { type: Date, default: Date.now }
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

const profileSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  address: String,
});

// -------------------- MODELS --------------------
const User = mongoose.model("User", UserSchema);
const Product = mongoose.model("Product", productSchema);  // ✅ FIXED
const Order = mongoose.model("Order", OrderSchema);
const Profile = mongoose.model("Profile", profileSchema);


// GET profile
// ✅ Get profile by email and auto-create if not exists
app.get("/api/profile/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);

    // Find Profile
    let profile = await Profile.findOne({ email });

    // Find User for name
    const user = await User.findOne({ email });

    // ✅ Auto-create profile if not exists
    if (!profile) {
      profile = new Profile({
        name: user?.name || "New User",  // fetch actual name from User collection
        email,
        phone: "",
        address: ""
      });
      await profile.save();
    }

    res.json({ success: true, profile });
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



// ✅ Update or create profile
// ✅ Update profile by email
app.put("/api/profile/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const { name, phone, address } = req.body;

    // Update or create profile
    let profile = await Profile.findOne({ email });
    if (!profile) {
      profile = new Profile({ email, name, phone, address });
    } else {
      profile.name = name;
      profile.phone = phone;
      profile.address = address;
    }
    await profile.save();

    // ✅ Sync name to User collection
    await User.updateOne({ email }, { $set: { name } });

    res.json({ success: true, message: "Profile updated successfully", profile });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Signup
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password, confirm, role } = req.body;
    if (password !== confirm) return res.status(400).json({ success: false, message: "Passwords do not match" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ success: false, message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);

    // ✅ Save name to MongoDB
    const newUser = await new User({ 
      name, 
      email, 
      password: hashed, 
      role 
    }).save();

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

// -------------------- WISHLIST ROUTES --------------------
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

app.delete("/wishlist/remove", async (req, res) => {
  try {
    const { email, productId } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    await User.updateOne({ email }, { $pull: { wishlist: productId } });
    res.json({ success: true, message: "Product removed from wishlist" });
  } catch (err) {
    console.error("❌ Wishlist removal error:", err);
    res.status(500).json({ success: false, message: "Failed to remove from wishlist" });
  }
});

// -------------------- CART ROUTES --------------------
// -------------------- SAFE CART ROUTE --------------------
app.get("/cart/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const user = await User.findOne({ email })
      .populate("cart.productId")
      .lean(); // lean() for faster, plain JS objects

    if (!user || !Array.isArray(user.cart)) {
      // Always return an empty array instead of 404 or HTML
      return res.status(200).json([]);
    }

    // Filter out broken or missing product references
    const cleanedCart = user.cart
      .filter(item => item.productId) // removes null/undefined products
      .map(item => ({
        _id: item.productId._id,
        name: item.productId.name,
        price: item.productId.price,
        quantity: item.quantity
      }));

    res.status(200).json(cleanedCart);
  } catch (err) {
    console.error("Get cart error:", err);
    // Even on server error, send empty array so frontend doesn't break
    res.status(200).json([]);
  }
});

app.post("/cart", async (req, res) => {
  try {
    const { email, productId, quantity } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const existing = user.cart.find(item => item.productId.toString() === productId);
    if (existing) {
      existing.quantity += quantity || 1;
    } else {
      user.cart.push({ productId, quantity: quantity || 1 });
    }

    await user.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Add cart error:", err);
    res.status(500).json({ success: false });
  }
});

app.delete("/cart/remove", async (req, res) => {
  try {
    const { email, productId } = req.body;

    // Find user & populate products
    const user = await User.findOne({ email }).populate("cart.productId");
    if (!user) {
      return res.status(200).json([]); // Always send array
    }

    // Remove the product from the cart
    user.cart = user.cart.filter(
      item => item.productId && item.productId._id.toString() !== productId
    );

    await user.save();

    // Prepare cleaned cart response
    const cleanedCart = user.cart
      .filter(item => item.productId) // remove broken refs
      .map(item => ({
        _id: item.productId._id,
        name: item.productId.name,
        price: item.productId.price,
        quantity: item.quantity
      }));

    res.status(200).json(cleanedCart);
  } catch (err) {
    console.error("Remove cart error:", err);
    res.status(200).json([]); // Still return array on error
  }
});



// -------------------- PRODUCT ROUTES --------------------
app.get("/products", async (req, res) => {
  try {
    const { category, priceMin, priceMax, size, rating, brand, color } = req.query;

    let filter = {};

    if (category) filter.category = category;
    if (size) filter.size = size;
    if (brand) filter.brand = brand;
   if (color) {
  filter.color = { $regex: new RegExp(`^${color}$`, "i") };
}

    if (rating) filter.rating = { $gte: Number(rating) };
    if (priceMin || priceMax) filter.price = {};
    if (priceMin) filter.price.$gte = Number(priceMin);
    if (priceMax) filter.price.$lte = Number(priceMax);

    const products = await Product.find(filter);
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});


// ✅ Get single product by ID
app.get("/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ Add product (Admin)
app.post("/products", upload.single("imageFile"), async (req, res) => {
  try {
    console.log("REQ BODY:", req.body); // <--- debug

    const { name, price, category, description } = req.body;
    const size = req.body.size || "";
    const brand = req.body.brand || "";
    const color = req.body.color || "";
    const rating = req.body.rating ? Number(req.body.rating) : null;
    const imageUrl = req.body.imageUrl;

    let imagePath = "";

    if (req.file) {
      imagePath = "/uploads/" + req.file.filename;
    } else if (imageUrl) {
      imagePath = imageUrl;
    } else {
      return res.status(400).json({ success: false, message: "Image required" });
    }

    const product = new Product({
      name,
      price,
      category,
      description,
      size,
      brand,
      color,
      rating,
      image: imagePath
    });

    await product.save();
    res.json({ success: true, product });
  } catch (err) {
    console.error("Add product error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
app.put("/products/:id", upload.single("imageFile"), async (req, res) => {
  try {
    const { name, price, category, description, size, brand, rating, color, imageUrl } = req.body;
    const { id } = req.params;

    const updateData = { name, price, category, description, size, brand, color, rating: rating ? Number(rating) : null };

    if (req.file) {
      updateData.image = "/uploads/" + req.file.filename;
    } else if (imageUrl) {
      updateData.image = imageUrl;
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, { new: true });
    res.json({ success: true, product: updatedProduct });
  } catch (err) {
    console.error("Update product error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Delete product
app.delete("/products/:id", async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// -------------------- ORDER ROUTES --------------------
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

// -------------------- ANALYTICS --------------------
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

// -------------------- SERVE FRONTEND --------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/Ecommerce.html"));
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
