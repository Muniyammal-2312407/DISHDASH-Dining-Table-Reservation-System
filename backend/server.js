const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins (Vercel frontend, local dev, etc.)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => console.log('❌ MongoDB Connection Error:', err));

// ========== MODELS ========== //

// Admin User Model
const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  restaurantName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    default: 'admin'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Hash password before saving
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
adminSchema.methods.toJSON = function () {
  const admin = this.toObject();
  delete admin.password;
  return admin;
};

const Admin = mongoose.model('Admin', adminSchema);

// Menu Item Model with Categories
const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: {
    type: String,
    required: true,
    enum: ['Appetizers', 'Main Course', 'Desserts', 'Beverages', 'Specials']
  },
  image: String,
  isAvailable: { type: Boolean, default: true },
  preparationTime: Number,
  restaurantId: { type: String, default: 'restaurant123' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

// Order Model
const orderSchema = new mongoose.Schema({
  orderNumber: String,
  restaurantId: String,
  tableId: String,
  customerName: String,
  items: [{
    name: String,
    price: Number,
    quantity: Number,
    category: String
  }],
  totalAmount: Number,
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'],
    default: 'pending'
  },
  paymentType: {
    type: String,
    enum: ['online', 'offline'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  servedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

// ========== AUTH MIDDLEWARE ========== //
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify admin still exists and is active
    const admin = await Admin.findById(decoded.adminId);
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: 'Admin account not found or inactive' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// ========== ROUTES ========== //

// 🔐 AUTH ROUTES

// Admin Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password, restaurantName, phone } = req.body;

    // Validation
    if (!username || !email || !password || !restaurantName) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [{ email }, { username }]
    });

    if (existingAdmin) {
      return res.status(400).json({
        message: 'Admin with this email or username already exists'
      });
    }

    // Create new admin
    const admin = new Admin({
      username,
      email,
      password,
      restaurantName,
      phone
    });

    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        adminId: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Admin account created successfully!',
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        restaurantName: admin.restaurantName,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Signup error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Admin with this email or username already exists'
      });
    }

    res.status(500).json({
      message: 'Server error during signup',
      error: error.message
    });
  }
});

// Admin Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(400).json({ message: 'Admin account is deactivated' });
    }

    // Check password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        adminId: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful!',
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        restaurantName: admin.restaurantName,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Server error during login',
      error: error.message
    });
  }
});

// Get current admin profile
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    res.json({
      admin: req.admin
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 👥 CUSTOMER ROUTES

// Get all menu items grouped by category
app.get('/api/menu', async (req, res) => {
  try {
    const menu = await MenuItem.find({ isAvailable: true });

    // Group by category for frontend
    const menuByCategory = menu.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {});

    res.json(menuByCategory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get menu for restaurant (with categories)
app.get('/api/menu/:restaurantId', async (req, res) => {
  try {
    const menu = await MenuItem.find({
      restaurantId: req.params.restaurantId,
      isAvailable: true
    });

    // Group by category for frontend
    const menuByCategory = menu.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {});

    res.json(menuByCategory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new order
app.post('/api/orders', async (req, res) => {
  try {
    const orderCount = await Order.countDocuments();
    const orderNumber = `ORD${(orderCount + 1).toString().padStart(6, '0')}`;

    const order = new Order({
      ...req.body,
      orderNumber: orderNumber
    });

    await order.save();

    // Update payment status for online payments
    if (req.body.paymentType === 'online') {
      // Mock payment processing
      setTimeout(async () => {
        order.paymentStatus = 'paid';
        await order.save();
      }, 2000);
    }

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 👨‍💼 ADMIN ROUTES

// Get all orders (newest first)
app.get('/api/admin/orders', auth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete completed order
app.delete('/api/admin/orders/:orderId', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await Order.findByIdAndDelete(req.params.orderId);
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update order status
app.patch('/api/admin/orders/:orderId/status', auth, async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.orderId,
      {
        status: req.body.status,
        servedBy: req.admin._id // Track which admin served the order
      },
      { new: true }
    );
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 🍽️ MENU CRUD OPERATIONS

// Get all menu items
app.get('/api/admin/menu', auth, async (req, res) => {
  try {
    const menu = await MenuItem.find().sort({ category: 1, name: 1 });
    res.json(menu);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new menu item
app.post('/api/admin/menu', auth, async (req, res) => {
  try {
    const menuItem = new MenuItem({
      ...req.body,
      createdBy: req.admin._id
    });
    await menuItem.save();
    res.status(201).json(menuItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update menu item
app.put('/api/admin/menu/:id', auth, async (req, res) => {
  try {
    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(menuItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete menu item
app.delete('/api/admin/menu/:id', auth, async (req, res) => {
  try {
    await MenuItem.findByIdAndDelete(req.params.id);
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ========== SEED DATA ========== //

// Create sample data with admin account
app.get('/api/seed-data', async (req, res) => {
  try {
    // Clear existing data
    await Admin.deleteMany({});
    await MenuItem.deleteMany({});
    await Order.deleteMany({});

    // Create sample admin account
    const admin = new Admin({
      username: 'admin',
      email: 'admin@foodheaven.com',
      password: 'admin123',
      restaurantName: 'Food Heaven Restaurant',
      phone: '+91 9876543210'
    });
    await admin.save();

    // Create sample menu items with categories
    const menuItems = [
      {
        name: "Garlic Bread",
        description: "Toasted bread with garlic butter and herbs",
        price: 149,
        category: "Appetizers",
        preparationTime: 10,
        isAvailable: true,
        createdBy: admin._id
      },
      {
        name: "French Fries",
        description: "Crispy golden fries with seasoning",
        price: 99,
        category: "Appetizers",
        preparationTime: 8,
        isAvailable: true,
        createdBy: admin._id
      },
      {
        name: "Margherita Pizza",
        description: "Classic pizza with tomato sauce and mozzarella",
        price: 399,
        category: "Main Course",
        preparationTime: 20,
        isAvailable: true,
        createdBy: admin._id
      },
      {
        name: "Butter Chicken",
        description: "Tender chicken in rich tomato gravy",
        price: 449,
        category: "Main Course",
        preparationTime: 25,
        isAvailable: true,
        createdBy: admin._id
      },
      {
        name: "Chocolate Brownie",
        description: "Warm chocolate brownie with ice cream",
        price: 199,
        category: "Desserts",
        preparationTime: 5,
        isAvailable: true,
        createdBy: admin._id
      },
      {
        name: "Ice Cream Sundae",
        description: "Vanilla ice cream with chocolate sauce and nuts",
        price: 129,
        category: "Desserts",
        preparationTime: 3,
        isAvailable: true,
        createdBy: admin._id
      },
      {
        name: "Fresh Lime Soda",
        description: "Refreshing lime soda with mint",
        price: 79,
        category: "Beverages",
        preparationTime: 2,
        isAvailable: true,
        createdBy: admin._id
      },
      {
        name: "Cold Coffee",
        description: "Chilled coffee with cream and ice",
        price: 149,
        category: "Beverages",
        preparationTime: 5,
        isAvailable: true,
        createdBy: admin._id
      },
      {
        name: "Chef's Special Pasta",
        description: "Creamy pasta with mushrooms and herbs",
        price: 349,
        category: "Specials",
        preparationTime: 15,
        isAvailable: true,
        createdBy: admin._id
      }
    ];

    await MenuItem.insertMany(menuItems);

    res.json({
      message: '✅ Sample data created successfully!',
      admin: {
        username: 'admin',
        email: 'admin@foodheaven.com',
        password: 'admin123'
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get occupied tables (tables with active orders)
app.get('/api/tables/occupied', async (req, res) => {
  try {
    const activeOrders = await Order.find({
      status: { $in: ['pending', 'preparing', 'ready'] }
    }).select('tableId');
    const occupiedTables = [...new Set(activeOrders.map(o => o.tableId))];
    res.json({ occupiedTables });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Basic route
app.get('/', (req, res) => {
  res.json({ message: '🚀 Restaurant Order System API is running!' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🎯 Server running on http://localhost:${PORT}`);
  console.log(`📊 MongoDB: restaurant_db`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? 'Set' : 'Not set'}`);
});