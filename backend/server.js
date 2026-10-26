const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'dishdash-jwt-secret-key-2024';

// Middleware
app.use(cors({
  origin: '*', // Allow all origins (Vercel frontend, local dev, etc.)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, '../frontend/public/images')));


// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => console.log('❌ MongoDB Connection Error:', err));

// ========== CANONICAL RESTAURANT CONFIGURATION ========== //

const RESTAURANT_TABLES = [
  { id: '1', number: 1, seats: 2, zone: 'Window' },
  { id: '2', number: 2, seats: 2, zone: 'Window' },
  { id: '3', number: 3, seats: 4, zone: 'Main Hall' },
  { id: '4', number: 4, seats: 4, zone: 'Main Hall' },
  { id: '5', number: 5, seats: 4, zone: 'Main Hall' },
  { id: '6', number: 6, seats: 4, zone: 'Main Hall' },
  { id: '7', number: 7, seats: 6, zone: 'Family Booth' },
  { id: '8', number: 8, seats: 6, zone: 'Family Booth' },
  { id: '9', number: 9, seats: 8, zone: 'Private Corner' },
  { id: '10', number: 10, seats: 2, zone: 'Patio' },
];

const VALID_TIME_SLOTS = [
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'
];

// Helper: Calculate honest food preparation schedule
function calculateEstimatedPrep(items, targetTimeStr, reservationDateStr) {
  let maxItemPrep = 15;
  let totalQuantity = 0;

  for (const item of items) {
    const dishPrep = Number(item.prepTime || item.preparationTime) || 15;
    if (dishPrep > maxItemPrep) maxItemPrep = dishPrep;
    totalQuantity += Number(item.quantity) || 1;
  }

  // Realistic kitchen estimate: maximum dish prep + small batch buffer for volume
  const prepDurationMinutes = Math.min(60, maxItemPrep + Math.min(15, (totalQuantity - 1) * 2));

  let arrivalDate = null;
  if (reservationDateStr && targetTimeStr) {
    const [hours, mins] = targetTimeStr.split(':').map(Number);
    arrivalDate = new Date(`${reservationDateStr}T${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`);
  }

  const now = new Date();
  let estimatedPrepStart = null;
  let estimatedReady = null;

  if (arrivalDate && !isNaN(arrivalDate.getTime()) && arrivalDate > now) {
    const prepStartMs = arrivalDate.getTime() - (prepDurationMinutes * 60 * 1000);
    const effectiveStartMs = Math.max(now.getTime(), prepStartMs);
    estimatedPrepStart = new Date(effectiveStartMs);
    estimatedReady = new Date(effectiveStartMs + (prepDurationMinutes * 60 * 1000));
  } else {
    estimatedPrepStart = now;
    estimatedReady = new Date(now.getTime() + (prepDurationMinutes * 60 * 1000));
  }

  const formatHHMM = (d) => {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return {
    prepDurationMinutes,
    estimatedPrepStartTime: formatHHMM(estimatedPrepStart),
    estimatedReadyTime: formatHHMM(estimatedReady)
  };
}

// Webhook helper: Dispatch booking confirmation event to Pabbly Connect
async function sendBookingWebhook(reservationData, tableConfig) {
  const webhookUrl = process.env.PABBLY_BOOKING_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.trim()) {
    return; // Webhook not configured; silently skip
  }

  const payload = {
    event: 'reservation.created',
    timestamp: new Date().toISOString(),
    reservation: {
      id: reservationData._id,
      reservationNumber: reservationData.reservationNumber,
      customerName: reservationData.customerName,
      customerPhone: reservationData.customerPhone,
      customerEmail: reservationData.customerEmail || null,
      tableId: reservationData.tableId,
      tableNumber: tableConfig?.number || reservationData.tableId,
      zone: tableConfig?.zone || 'General',
      guestCount: reservationData.guestCount,
      reservationDate: reservationData.reservationDate,
      timeSlot: reservationData.timeSlot,
      endTime: reservationData.endTime,
      durationMinutes: reservationData.durationMinutes,
      status: reservationData.status,
      specialRequests: reservationData.specialRequests || '',
      createdAt: reservationData.createdAt
    }
  };

  try {
    const res = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DISHDASH-Booking-System/1.0'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.warn(`[Pabbly Webhook] Received HTTP ${res.status} from webhook endpoint.`);
    }
  } catch (error) {
    // Non-blocking: Network/webhook failure does not disrupt customer booking response
    console.warn('[Pabbly Webhook] Failed to deliver booking webhook notification.');
  }
}

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
    trim: true,
    default: 'DISHDASH Restaurant'
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

adminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

adminSchema.methods.toJSON = function () {
  const admin = this.toObject();
  delete admin.password;
  return admin;
};

const Admin = mongoose.model('Admin', adminSchema);

// Menu Item Model with Categories & Veg/Non-Veg
const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  price: { type: Number, required: true, min: 0 },
  category: {
    type: String,
    required: true,
    enum: [
      'Appetizers', 'Main Course', 'Desserts', 'Beverages', 'Specials',
      'South Indian Specials', 'Biryani & Rice', 'Curries & Breads', 'Starters & Snacks', 'Desserts & Drinks'
    ]
  },
  subCategory: { type: String, trim: true },
  image: String,
  isVegetarian: { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: true },
  preparationTime: { type: Number, default: 15 },
  restaurantId: { type: String, default: 'restaurant123' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

// Reservation Model
const reservationSchema = new mongoose.Schema({
  reservationNumber: { type: String, required: true, unique: true },
  restaurantId: { type: String, default: 'restaurant123' },
  customerName: { type: String, required: true, trim: true },
  customerPhone: { type: String, required: true, trim: true },
  customerEmail: { type: String, trim: true, lowercase: true },
  tableId: { type: String, required: true },
  guestCount: { type: Number, required: true, min: 1 },
  reservationDate: { type: String, required: true }, // Format: YYYY-MM-DD
  timeSlot: { type: String, required: true }, // Format: HH:mm
  endTime: { type: String }, // Calculated end of reservation (e.g. +90 mins)
  durationMinutes: { type: Number, default: 90 },
  status: {
    type: String,
    enum: ['confirmed', 'completed', 'cancelled'],
    default: 'confirmed'
  },
  specialRequests: { type: String, trim: true },
  linkedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  preOrderStatus: {
    type: String,
    enum: ['none', 'placed', 'preparing', 'ready', 'completed', 'cancelled'],
    default: 'none'
  }
}, { timestamps: true });

reservationSchema.index({ tableId: 1, reservationDate: 1, timeSlot: 1, status: 1 });
const Reservation = mongoose.model('Reservation', reservationSchema);

// Order Model (supports both instant dine-in and scheduled pre-orders)
const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  restaurantId: { type: String, default: 'restaurant123' },
  tableId: { type: String, required: true },
  customerName: { type: String, required: true, trim: true },
  customerPhone: { type: String, trim: true },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation' },
  reservationNumber: { type: String },
  isPreOrder: { type: Boolean, default: false },
  expectedArrivalTime: { type: String }, // e.g. "19:30" or "2026-10-16 19:30"
  estimatedPrepDuration: { type: Number, default: 15 },
  estimatedPrepStartTime: { type: String },
  estimatedReadyTime: { type: String },
  prepDelayMinutes: { type: Number, default: 0 },
  items: [{
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    category: String,
    isVegetarian: Boolean,
    prepTime: Number
  }],
  totalAmount: { type: Number, required: true, min: 0 },
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

    const decoded = jwt.verify(token, JWT_SECRET);

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

    if (!username || !email || !password || !restaurantName) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingAdmin = await Admin.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    if (existingAdmin) {
      return res.status(400).json({
        message: 'Admin with this email or username already exists'
      });
    }

    const admin = new Admin({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password,
      restaurantName: restaurantName.trim(),
      phone: phone ? phone.trim() : undefined
    });

    await admin.save();

    const token = jwt.sign(
      {
        adminId: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      },
      JWT_SECRET,
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

// Admin Login Handler
const handleAdminLogin = async (req, res) => {
  try {
    const { email, username, identifier: rawId, password } = req.body;
    const identifier = (email || username || rawId || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email or username and password are required' });
    }

    const admin = await Admin.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier }
      ]
    });

    if (!admin) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!admin.isActive) {
      return res.status(400).json({ message: 'Admin account is deactivated' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        adminId: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      },
      JWT_SECRET,
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
};

app.post('/api/auth/login', handleAdminLogin);
app.post('/api/admin/login', handleAdminLogin);

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

// 👥 MENU ROUTES

const groupByCategory = (items) => {
  return items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});
};

app.get('/api/menu', async (req, res) => {
  try {
    const menu = await MenuItem.find().sort({ category: 1, name: 1 });
    res.json(groupByCategory(menu));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/menu/:restaurantId', async (req, res) => {
  try {
    const menu = await MenuItem.find({
      restaurantId: req.params.restaurantId
    }).sort({ category: 1, name: 1 });

    res.json(groupByCategory(menu));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ========== SMART TABLE RESERVATION ROUTES ========== //

// Check table availability for a specific date, time slot, and guest count
app.get('/api/reservations/available-tables', async (req, res) => {
  try {
    const { date, timeSlot, guestCount } = req.query;

    if (!date || !timeSlot) {
      return res.status(400).json({ message: 'Both date (YYYY-MM-DD) and timeSlot (HH:mm) are required.' });
    }

    const guests = parseInt(guestCount, 10) || 1;

    // Reject past dates
    const today = new Date().toISOString().split('T')[0];
    if (date < today) {
      return res.status(400).json({ message: 'Reservation date cannot be in the past.' });
    }

    // If date is today, check if timeSlot is in the past
    let isSlotPassed = false;
    if (date === today) {
      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (timeSlot < currentHHMM) {
        isSlotPassed = true;
      }
    }

    // Retrieve all active confirmed reservations for this date and time slot
    const existingReservations = await Reservation.find({
      reservationDate: date,
      timeSlot: timeSlot,
      status: 'confirmed'
    }).select('tableId reservationNumber');

    const bookedTableIds = new Set(existingReservations.map(r => String(r.tableId)));

    // Distinguish: Current real-time food orders ONLY apply to immediate dining now,
    // not future dates or later hours!
    let currentOccupiedTables = new Set();
    if (date === today && !isSlotPassed) {
      const now = new Date();
      // Only if slot is within current 60 minutes
      const [slotH, slotM] = timeSlot.split(':').map(Number);
      const slotMinutes = slotH * 60 + slotM;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      if (Math.abs(slotMinutes - currentMinutes) <= 60) {
        const activeOrders = await Order.find({
          status: { $in: ['pending', 'preparing', 'ready'] }
        }).select('tableId');
        activeOrders.forEach(o => currentOccupiedTables.add(String(o.tableId)));
      }
    }

    // Build status for all 10 canonical tables
    const tableStatuses = RESTAURANT_TABLES.map(table => {
      const isBooked = bookedTableIds.has(String(table.id));
      const isCapacityExceeded = table.seats < guests;
      const isCurrentlyOccupied = currentOccupiedTables.has(String(table.id));

      let status = 'available';
      let reason = 'Available for booking';

      if (isSlotPassed) {
        status = 'slot_passed';
        reason = 'This time slot has already passed for today';
      } else if (isCapacityExceeded) {
        status = 'capacity_exceeded';
        reason = `Capacity: ${table.seats} ${table.seats === 1 ? 'seat' : 'seats'} — ${guests} guests requested`;
      } else if (isBooked) {
        status = 'reserved';
        reason = 'Already reserved for this time slot';
      } else if (isCurrentlyOccupied) {
        status = 'busy_now';
        reason = 'Currently occupied by dining guest';
      }

      return {
        ...table,
        status,
        reason,
        canBook: status === 'available'
      };
    });

    res.json({
      date,
      timeSlot,
      guestCount: guests,
      tables: tableStatuses,
      availableCount: tableStatuses.filter(t => t.canBook).length
    });
  } catch (error) {
    console.error('Available tables check error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new Table Reservation with atomic double-booking safeguard
app.post('/api/reservations', async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      tableId,
      guestCount,
      reservationDate,
      timeSlot,
      specialRequests
    } = req.body;

    // Validation
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ message: 'Customer name is required.' });
    }
    if (!customerPhone || !customerPhone.trim()) {
      return res.status(400).json({ message: 'Customer phone number is required.' });
    }

    // Optional email validation: validate format only if email is provided
    if (customerEmail && customerEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail.trim())) {
        return res.status(400).json({ message: 'Please provide a valid email address.' });
      }
    }
    if (!tableId) {
      return res.status(400).json({ message: 'Table selection is required.' });
    }
    if (!reservationDate || !timeSlot) {
      return res.status(400).json({ message: 'Reservation date and time slot are required.' });
    }

    const guests = parseInt(guestCount, 10);
    if (!guests || guests <= 0 || guests > 20) {
      return res.status(400).json({ message: 'Guest count must be between 1 and 20.' });
    }

    // Verify table exists and check capacity
    const tableConfig = RESTAURANT_TABLES.find(t => String(t.id) === String(tableId));
    if (!tableConfig) {
      return res.status(400).json({ message: `Table ${tableId} does not exist.` });
    }

    if (tableConfig.seats < guests) {
      return res.status(400).json({
        message: `Capacity: ${tableConfig.seats} ${tableConfig.seats === 1 ? 'seat' : 'seats'} — ${guests} guests requested. Please select a larger table.`
      });
    }

    // Date & Time validation
    const today = new Date().toISOString().split('T')[0];
    if (reservationDate < today) {
      return res.status(400).json({ message: 'Cannot reserve a date in the past.' });
    }

    if (reservationDate === today) {
      const now = new Date();
      const currentHHMM = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
      if (timeSlot < currentHHMM) {
        return res.status(400).json({ message: 'Selected time slot has already passed for today.' });
      }

      // Check real-time active food orders if slot is within current 60 minutes
      const [slotH, slotM] = timeSlot.split(':').map(Number);
      const slotMinutes = slotH * 60 + slotM;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      if (Math.abs(slotMinutes - currentMinutes) <= 60) {
        const activeOrder = await Order.findOne({
          tableId: String(tableId),
          status: { $in: ['pending', 'preparing', 'ready'] }
        });
        if (activeOrder) {
          return res.status(409).json({
            message: `Table ${tableConfig.number} is currently occupied by dining guests. Please choose an alternative table.`
          });
        }
      }
    }

    // ATOMIC SAFEGUARD: Concurrency check to prevent overlapping bookings
    const existingConflict = await Reservation.findOne({
      tableId: String(tableId),
      reservationDate,
      timeSlot,
      status: 'confirmed'
    });

    if (existingConflict) {
      return res.status(409).json({
        message: `Table ${tableConfig.number} has already been reserved for ${timeSlot} on ${reservationDate}. Please choose another table or time slot.`
      });
    }

    // Calculate end time (90 min reservation duration)
    const [h, m] = timeSlot.split(':').map(Number);
    const endMinutes = h * 60 + m + 90;
    const endH = Math.floor(endMinutes / 60) % 24;
    const endM = endMinutes % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    // Unique sequential reservation number with collision prevention
    let reservationNumber;
    const lastRes = await Reservation.findOne().sort({ createdAt: -1 }).select('reservationNumber');
    let resSeq = (await Reservation.countDocuments()) + 1;
    if (lastRes && lastRes.reservationNumber && lastRes.reservationNumber.startsWith('RES')) {
      const parsed = parseInt(lastRes.reservationNumber.replace('RES', ''), 10);
      if (!isNaN(parsed) && parsed >= resSeq) resSeq = parsed + 1;
    }
    do {
      reservationNumber = `RES${resSeq.toString().padStart(6, '0')}`;
      resSeq++;
    } while (await Reservation.exists({ reservationNumber }));

    const reservation = new Reservation({
      reservationNumber,
      restaurantId: 'restaurant123',
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail && customerEmail.trim() ? customerEmail.trim().toLowerCase() : undefined,
      tableId: String(tableId),
      guestCount: guests,
      reservationDate,
      timeSlot,
      endTime,
      durationMinutes: 90,
      status: 'confirmed',
      specialRequests: specialRequests ? specialRequests.trim() : undefined
    });

    await reservation.save();

    // Trigger Pabbly Connect booking automation asynchronously (non-blocking)
    sendBookingWebhook(reservation, tableConfig).catch(() => {});

    res.status(201).json({
      ...reservation.toObject(),
      reservation
    });
  } catch (error) {
    console.error('Reservation creation error:', error);
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'This table slot was just reserved by another guest. Please pick an alternative table.'
      });
    }
    res.status(400).json({ message: error.message });
  }
});

// Customer: Search & View My Reservations (by phone, email, or ID)
app.get('/api/reservations', async (req, res) => {
  try {
    const { phone, email } = req.query;
    if (!phone && !email) {
      return res.status(400).json({ message: 'Phone number or email is required to retrieve reservations.' });
    }

    const query = { status: { $ne: 'deleted' } };
    if (phone) {
      const cleanPhone = phone.trim();
      const digitsOnly = cleanPhone.replace(/\D/g, '');
      if (digitsOnly.length >= 7) {
        const lastDigits = digitsOnly.slice(-10);
        query.$or = [
          { customerPhone: cleanPhone },
          { customerPhone: { $regex: lastDigits + '$' } }
        ];
      } else {
        query.customerPhone = cleanPhone;
      }
    }
    if (email) query.customerEmail = email.trim().toLowerCase();

    const reservations = await Reservation.find(query)
      .sort({ reservationDate: -1, timeSlot: -1 })
      .populate('linkedOrderId');

    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Customer: Get single reservation details
app.get('/api/reservations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let reservation = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      reservation = await Reservation.findById(id).populate('linkedOrderId');
    }
    if (!reservation) {
      reservation = await Reservation.findOne({ reservationNumber: id.toUpperCase() }).populate('linkedOrderId');
    }

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found.' });
    }

    res.json(reservation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Customer / Staff: Cancel a reservation (releases table slot immediately)
app.patch('/api/reservations/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { phone } = req.body; // Optional customer verification

    let reservation = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      reservation = await Reservation.findById(id);
    }
    if (!reservation) {
      reservation = await Reservation.findOne({ reservationNumber: id.toUpperCase() });
    }

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found.' });
    }

    if (reservation.status === 'cancelled') {
      return res.status(400).json({ message: 'This reservation is already cancelled.' });
    }

    if (reservation.status === 'completed') {
      return res.status(400).json({ message: 'Completed dining reservations cannot be cancelled.' });
    }

    // Customer phone authorization check if provided
    if (phone && reservation.customerPhone !== phone.trim()) {
      return res.status(403).json({ message: 'Unauthorized: Phone number does not match this reservation.' });
    }

    reservation.status = 'cancelled';
    await reservation.save();

    // If pre-order exists and is still pending, cancel it too
    if (reservation.linkedOrderId) {
      await Order.findByIdAndUpdate(reservation.linkedOrderId, { status: 'cancelled' });
    }

    res.json({
      message: 'Reservation cancelled successfully. Table has been released.',
      reservation
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ========== ORDERS & PRE-ORDERING ROUTES ========== //

// Customer Order Tracking: Get order by ID or orderNumber
app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    let order = null;

    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId).populate('reservationId');
    }
    if (!order) {
      order = await Order.findOne({ orderNumber: orderId.toUpperCase() }).populate('reservationId');
    }

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new order (supports both instant dine-in order and reservation pre-order)
app.post('/api/orders', async (req, res) => {
  try {
    const {
      tableId,
      customerName,
      customerPhone,
      items,
      paymentType,
      restaurantId,
      reservationId,
      reservationNumber
    } = req.body;

    // Validate required fields
    if (!tableId || !customerName || !customerName.trim()) {
      return res.status(400).json({ message: 'Table number and customer name are required.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order must contain at least one dish item.' });
    }

    if (!['online', 'offline'].includes(paymentType)) {
      return res.status(400).json({ message: 'Invalid payment type. Must be online or offline.' });
    }

    // Optional: Link to confirmed table reservation
    let linkedReservation = null;
    if (reservationId && mongoose.Types.ObjectId.isValid(reservationId)) {
      linkedReservation = await Reservation.findById(reservationId);
    } else if (reservationNumber) {
      linkedReservation = await Reservation.findOne({ reservationNumber: reservationNumber.toUpperCase() });
    }

    // Server-side verification of items, availability, and prices directly from MongoDB
    const verifiedItems = [];
    let calculatedTotal = 0;

    for (const item of items) {
      const quantity = parseInt(item.quantity, 10);
      if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
        return res.status(400).json({
          message: `Invalid quantity for item "${item.name || 'dish'}". Quantity must be a positive integer.`
        });
      }

      let menuItem = null;
      if (item._id && mongoose.Types.ObjectId.isValid(item._id)) {
        menuItem = await MenuItem.findById(item._id);
      } else if (item.menuItemId && mongoose.Types.ObjectId.isValid(item.menuItemId)) {
        menuItem = await MenuItem.findById(item.menuItemId);
      }

      if (!menuItem && item.name) {
        menuItem = await MenuItem.findOne({ name: item.name });
        if (!menuItem) {
          const rawName = String(item.name).trim().toLowerCase();
          if (rawName === 'parota' || rawName === 'parotta') {
            menuItem = await MenuItem.findOne({ name: /parotta/i });
          } else if (rawName === 'biriyani' || rawName === 'biryani') {
            menuItem = await MenuItem.findOne({ name: /biryani/i });
          } else if (rawName === 'ice cream') {
            menuItem = await MenuItem.findOne({ name: /ice cream/i });
          } else {
            menuItem = await MenuItem.findOne({ name: new RegExp(`^${item.name}$`, 'i') });
          }
        }
      }

      if (!menuItem) {
        return res.status(400).json({
          message: `Item "${item.name || 'Unknown'}" was not found on the menu.`
        });
      }

      // Enforce availability validation on the backend
      if (menuItem.isAvailable === false) {
        return res.status(400).json({
          message: `Item "${menuItem.name}" is currently unavailable / sold out.`
        });
      }

      const trustedPrice = menuItem.price;
      calculatedTotal += trustedPrice * quantity;

      verifiedItems.push({
        menuItemId: menuItem._id,
        name: menuItem.name,
        price: trustedPrice,
        quantity,
        category: menuItem.category,
        isVegetarian: menuItem.isVegetarian,
        prepTime: menuItem.preparationTime || 15
      });
    }

    // Calculate Honest Kitchen Prep Schedule
    const targetArrivalTime = linkedReservation ? linkedReservation.timeSlot : null;
    const targetDate = linkedReservation ? linkedReservation.reservationDate : null;
    const prepSchedule = calculateEstimatedPrep(verifiedItems, targetArrivalTime, targetDate);

    // Unique sequential order number with collision prevention
    let orderNumber;
    const lastOrder = await Order.findOne().sort({ createdAt: -1 }).select('orderNumber');
    let ordSeq = (await Order.countDocuments()) + 1;
    if (lastOrder && lastOrder.orderNumber && lastOrder.orderNumber.startsWith('ORD')) {
      const parsed = parseInt(lastOrder.orderNumber.replace('ORD', ''), 10);
      if (!isNaN(parsed) && parsed >= ordSeq) ordSeq = parsed + 1;
    }
    do {
      orderNumber = `ORD${ordSeq.toString().padStart(6, '0')}`;
      ordSeq++;
    } while (await Order.exists({ orderNumber }));

    const order = new Order({
      orderNumber,
      restaurantId: restaurantId || 'restaurant123',
      tableId: String(tableId),
      customerName: customerName.trim(),
      customerPhone: customerPhone ? customerPhone.trim() : (linkedReservation ? linkedReservation.customerPhone : undefined),
      reservationId: linkedReservation ? linkedReservation._id : undefined,
      reservationNumber: linkedReservation ? linkedReservation.reservationNumber : undefined,
      isPreOrder: Boolean(linkedReservation),
      expectedArrivalTime: targetArrivalTime,
      estimatedPrepDuration: prepSchedule.prepDurationMinutes,
      estimatedPrepStartTime: prepSchedule.estimatedPrepStartTime,
      estimatedReadyTime: prepSchedule.estimatedReadyTime,
      items: verifiedItems,
      totalAmount: calculatedTotal,
      status: 'pending',
      paymentType,
      paymentStatus: paymentType === 'online' ? 'paid' : 'pending'
    });

    await order.save();

    // Link back to reservation if applicable
    if (linkedReservation) {
      linkedReservation.linkedOrderId = order._id;
      linkedReservation.preOrderStatus = 'placed';
      await linkedReservation.save();
    }

    res.status(201).json(order);
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(400).json({ message: error.message });
  }
});

// ========== 👨‍💼 ADMIN & KITCHEN ROUTES ========== //

// Admin: Get all reservations with filters
app.get('/api/admin/reservations', auth, async (req, res) => {
  try {
    const { status, date } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (date) query.reservationDate = date;

    const reservations = await Reservation.find(query)
      .sort({ reservationDate: -1, timeSlot: -1 })
      .populate('linkedOrderId');

    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Update reservation status
app.patch('/api/admin/reservations/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid reservation status' });
    }

    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    res.json(reservation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Kitchen Queue: View upcoming orders & pre-orders sorted by arrival / prep time
app.get('/api/admin/kitchen/queue', auth, async (req, res) => {
  try {
    // Fetch active kitchen orders
    const activeOrders = await Order.find({
      status: { $in: ['pending', 'preparing', 'ready'] }
    }).populate('reservationId').sort({ createdAt: 1 });

    // Separate pre-orders and instant dine-in
    const sortedQueue = activeOrders.sort((a, b) => {
      // Prioritize cooking stage
      if (a.status === 'preparing' && b.status !== 'preparing') return -1;
      if (b.status === 'preparing' && a.status !== 'preparing') return 1;

      // Then sort by scheduled ready time
      if (a.estimatedReadyTime && b.estimatedReadyTime) {
        return a.estimatedReadyTime.localeCompare(b.estimatedReadyTime);
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    res.json(sortedQueue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Kitchen: Update preparation delay (adds buffer when delay occurs)
app.patch('/api/admin/orders/:orderId/kitchen-delay', auth, async (req, res) => {
  try {
    const delayMinutes = parseInt(req.body.delayMinutes, 10);
    if (!delayMinutes || isNaN(delayMinutes)) {
      return res.status(400).json({ message: 'Valid delayMinutes integer is required.' });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.prepDelayMinutes = (order.prepDelayMinutes || 0) + delayMinutes;

    // Recalculate estimated ready time
    if (order.estimatedReadyTime) {
      const [h, m] = order.estimatedReadyTime.split(':').map(Number);
      const newMinutes = (h * 60 + m + delayMinutes) % 1440;
      const newH = Math.floor(newMinutes / 60);
      const newM = newMinutes % 60;
      order.estimatedReadyTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    }

    await order.save();
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Get all orders
app.get('/api/admin/orders', auth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Delete order
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

// Admin: Update order status
app.patch('/api/admin/orders/:orderId/status', auth, async (req, res) => {
  try {
    const allowedStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!allowedStatuses.includes(req.body.status)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }

    const updateFields = {
      status: req.body.status,
      servedBy: req.admin._id
    };

    if (req.body.status === 'completed' && req.body.markPaid) {
      updateFields.paymentStatus = 'paid';
    }

    const order = await Order.findByIdAndUpdate(
      req.params.orderId,
      updateFields,
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Synchronize preOrderStatus on linked reservation if present
    if (order.reservationId) {
      await Reservation.findByIdAndUpdate(order.reservationId, {
        preOrderStatus: req.body.status
      });
    }

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Menu CRUD
app.get('/api/admin/menu', auth, async (req, res) => {
  try {
    const menu = await MenuItem.find().sort({ category: 1, name: 1 });
    res.json(menu);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/admin/menu/:id/availability', auth, async (req, res) => {
  try {
    const { isAvailable } = req.body;
    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ message: 'isAvailable boolean is required' });
    }

    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      { isAvailable },
      { new: true }
    );

    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    res.json(menuItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

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

app.put('/api/admin/menu/:id', auth, async (req, res) => {
  try {
    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    res.json(menuItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/admin/menu/:id', auth, async (req, res) => {
  try {
    await MenuItem.findByIdAndDelete(req.params.id);
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ========== SEED DATA (SAFE & PROTECTED) ========== //

const handleSeed = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        message: 'Seed data endpoint is disabled in production to protect data integrity.'
      });
    }

    // Do NOT delete orders or reservations! Preserved for integrity.
    let admin = await Admin.findOne({ email: 'admin@dishdash.com' });
    if (!admin) {
      admin = await Admin.findOne({ email: 'admin@foodheaven.com' });
    }

    if (!admin) {
      admin = new Admin({
        username: 'admin',
        email: 'admin@dishdash.com',
        password: 'admin123',
        restaurantName: 'DISHDASH Restaurant',
        phone: '+91 9876543210'
      });
      await admin.save();
    }

    const sampleItems = [
      // --- South Indian Specials ---
      {
        name: "Kerala Parotta",
        description: "Layered, flaky golden-brown flatbread freshly made on the griddle with soft buttery layers",
        price: 40,
        category: "Specials",
        subCategory: "South Indian Specials",
        preparationTime: 12,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/kerala-parotta.jpg",
        aliases: ["parota", "parotta"],
        createdBy: admin._id
      },
      {
        name: "Kothu Parotta",
        description: "Shredded flaky parotta stir-fried on high heat with onions, curry leaves, aromatic spices, and salna",
        price: 160,
        category: "Specials",
        subCategory: "South Indian Specials",
        preparationTime: 15,
        isVegetarian: false,
        isAvailable: true,
        image: "/images/food/kothu-parotta.jpg",
        createdBy: admin._id
      },
      {
        name: "Plain Dosa",
        description: "Golden, paper-thin crispy fermented rice and lentil crepe served with coconut chutney and sambar",
        price: 80,
        category: "Specials",
        subCategory: "South Indian Specials",
        preparationTime: 10,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/plain-dosa.jpg",
        createdBy: admin._id
      },
      {
        name: "Masala Dosa",
        description: "Crisp golden crepe smeared with red chili chutney and stuffed with spiced mustard-tempered potato masala",
        price: 110,
        category: "Specials",
        subCategory: "South Indian Specials",
        preparationTime: 12,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/masala-dosa.jpg",
        createdBy: admin._id
      },
      {
        name: "Idli",
        description: "Steamed fluffy, pillowy-soft rice and lentil cakes served with home-style sambar and two fresh chutneys",
        price: 60,
        category: "Specials",
        subCategory: "South Indian Specials",
        preparationTime: 8,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/idli.jpg",
        createdBy: admin._id
      },
      {
        name: "Pongal",
        description: "Hearty, comforting South Indian dish of short-grain rice and yellow moong dal tempered with ghee, cumin, black pepper, and cashews",
        price: 90,
        category: "Specials",
        subCategory: "South Indian Specials",
        preparationTime: 10,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/pongal.jpg",
        createdBy: admin._id
      },
      {
        name: "Poori Masala",
        description: "Puffy, golden-brown deep-fried whole wheat breads served with traditional spiced potato onion gravy",
        price: 100,
        category: "Specials",
        subCategory: "South Indian Specials",
        preparationTime: 12,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/poori-masala.jpg",
        createdBy: admin._id
      },
      {
        name: "Appam",
        description: "Bowl-shaped soft fermented rice hoppers with a pillowy spongy center and crisp lace borders, served with coconut milk",
        price: 90,
        category: "Specials",
        subCategory: "South Indian Specials",
        preparationTime: 12,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/appam.jpg",
        createdBy: admin._id
      },
      {
        name: "Idiyappam",
        description: "Delicate steamed rice string hoppers served with rich vegetable kurma or sweet coconut milk",
        price: 90,
        category: "Specials",
        subCategory: "South Indian Specials",
        preparationTime: 12,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/idiyappam.jpg",
        createdBy: admin._id
      },

      // --- Biryani & Rice ---
      {
        name: "Chicken Biryani",
        description: "Fragrant long-grain basmati rice dum-cooked with tender marinated chicken, saffron, brown onions, and whole spices",
        price: 260,
        category: "Main Course",
        subCategory: "Biryani & Rice",
        preparationTime: 20,
        isVegetarian: false,
        isAvailable: true,
        image: "/images/food/chicken-biryani.jpg",
        aliases: ["biriyani", "biryani"],
        createdBy: admin._id
      },
      {
        name: "Mutton Biryani",
        description: "Royal slow-braised tender goat meat layered with fragrant basmati, clarified butter, mint, and saffron",
        price: 340,
        category: "Main Course",
        subCategory: "Biryani & Rice",
        preparationTime: 25,
        isVegetarian: false,
        isAvailable: true,
        image: "/images/food/mutton-biryani.jpg",
        createdBy: admin._id
      },
      {
        name: "Vegetable Biryani",
        description: "Aromatic dum-cooked basmati rice layered with garden vegetables, paneer cubes, saffron, mint, and biryani spices",
        price: 190,
        category: "Main Course",
        subCategory: "Biryani & Rice",
        preparationTime: 18,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/vegetable-biryani.jpg",
        createdBy: admin._id
      },
      {
        name: "Egg Biryani",
        description: "Flavorful spiced basmati rice layered with golden pan-roasted boiled eggs, caramelized onions, and fresh mint",
        price: 210,
        category: "Main Course",
        subCategory: "Biryani & Rice",
        preparationTime: 16,
        isVegetarian: false,
        isAvailable: true,
        image: "/images/food/egg-biryani.jpg",
        createdBy: admin._id
      },
      {
        name: "Chicken Fried Rice",
        description: "Wok-tossed long grain rice with seasoned diced chicken, scrambled eggs, crisp scallions, and light soy sauce",
        price: 220,
        category: "Main Course",
        subCategory: "Biryani & Rice",
        preparationTime: 15,
        isVegetarian: false,
        isAvailable: true,
        image: "/images/food/chicken-fried-rice.jpg",
        createdBy: admin._id
      },
      {
        name: "Paneer Fried Rice",
        description: "Indo-Chinese wok-fried rice with golden crispy paneer cubes, crunchy bell peppers, carrots, and spring onions",
        price: 200,
        category: "Main Course",
        subCategory: "Biryani & Rice",
        preparationTime: 15,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/paneer-fried-rice.jpg",
        createdBy: admin._id
      },

      // --- Curries & Breads ---
      {
        name: "Butter Chicken",
        description: "Charcoal-smoked tender chicken pieces simmered in a velvety tomato, cream, butter, and fenugreek makhani gravy",
        price: 280,
        category: "Main Course",
        subCategory: "Curries & Breads",
        preparationTime: 20,
        isVegetarian: false,
        isAvailable: true,
        image: "/images/food/butter-chicken.jpg",
        createdBy: admin._id
      },
      {
        name: "Paneer Butter Masala",
        description: "Soft fresh cottage cheese cubes cooked in rich, creamy tomato-cashew nut gravy with a touch of aromatic kasuri methi",
        price: 240,
        category: "Main Course",
        subCategory: "Curries & Breads",
        preparationTime: 18,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/paneer-butter-masala.jpg",
        createdBy: admin._id
      },
      {
        name: "Chicken Chettinad",
        description: "Traditional spicy Tamil Nadu chicken curry prepared with freshly roasted coriander, black peppercorns, and fresh coconut",
        price: 270,
        category: "Main Course",
        subCategory: "Curries & Breads",
        preparationTime: 20,
        isVegetarian: false,
        isAvailable: true,
        image: "/images/food/chicken-chettinad.jpg",
        createdBy: admin._id
      },
      {
        name: "Chapati",
        description: "Homestyle soft and thin unleavened whole wheat flatbread baked on an iron griddle with pure ghee",
        price: 30,
        category: "Main Course",
        subCategory: "Curries & Breads",
        preparationTime: 8,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/chapati.jpg",
        createdBy: admin._id
      },
      {
        name: "Butter Naan",
        description: "Classic pillowy tandoor-baked leavened flatbread brushed with generous melted salted butter",
        price: 50,
        category: "Main Course",
        subCategory: "Curries & Breads",
        preparationTime: 10,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/butter-naan.jpg",
        createdBy: admin._id
      },
      {
        name: "Garlic Naan",
        description: "Hand-stretched tandoor naan topped with minced roasted garlic, fresh coriander leaves, and creamy butter",
        price: 65,
        category: "Main Course",
        subCategory: "Curries & Breads",
        preparationTime: 10,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/garlic-naan.jpg",
        createdBy: admin._id
      },

      // --- Starters & Snacks ---
      {
        name: "Chicken 65",
        description: "Crunchy, spicy deep-fried boneless chicken bites marinated with fiery red chili, ginger-garlic, curry leaves, and lemon",
        price: 220,
        category: "Appetizers",
        subCategory: "Starters & Snacks",
        preparationTime: 15,
        isVegetarian: false,
        isAvailable: true,
        image: "/images/food/chicken-65.jpg",
        createdBy: admin._id
      },
      {
        name: "Gobi 65",
        description: "Crispy batter-coated cauliflower florets tossed in fragrant curry leaves, crushed pepper, and spicy red masala",
        price: 160,
        category: "Appetizers",
        subCategory: "Starters & Snacks",
        preparationTime: 12,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/gobi-65.jpg",
        createdBy: admin._id
      },
      {
        name: "Paneer Tikka",
        description: "Thick cubes of fresh malai paneer and crisp bell peppers marinated in spiced hung curd and chargrilled in the clay oven",
        price: 230,
        category: "Appetizers",
        subCategory: "Starters & Snacks",
        preparationTime: 15,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/paneer-tikka.jpg",
        createdBy: admin._id
      },
      {
        name: "Samosa",
        description: "Golden flaky triangular pastries filled with seasoned potatoes, green peas, and whole spices, served with tamarind chutney",
        price: 50,
        category: "Appetizers",
        subCategory: "Starters & Snacks",
        preparationTime: 8,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/samosa.jpg",
        createdBy: admin._id
      },
      {
        name: "French Fries",
        description: "Crisp golden russet potato fries tossed in fine sea salt and lightly dusted with smoky paprika",
        price: 110,
        category: "Appetizers",
        subCategory: "Starters & Snacks",
        preparationTime: 8,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/french-fries.jpg",
        createdBy: admin._id
      },
      {
        name: "Chicken Lollipop",
        description: "Frenched chicken winglets tossed in fiery Indo-Chinese Schezwan glaze, served with spicy garlic dipping sauce",
        price: 240,
        category: "Appetizers",
        subCategory: "Starters & Snacks",
        preparationTime: 18,
        isVegetarian: false,
        isAvailable: true,
        image: "/images/food/chicken-lollipop.jpg",
        createdBy: admin._id
      },

      // --- Desserts & Drinks ---
      {
        name: "Gulab Jamun",
        description: "Soft, golden-fried reduced milk dumplings soaked in warm rose and cardamom scented sugar syrup",
        price: 80,
        category: "Desserts",
        subCategory: "Desserts & Drinks",
        preparationTime: 5,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/gulab-jamun.jpg",
        createdBy: admin._id
      },
      {
        name: "Rasmalai",
        description: "Delicate poached cottage cheese discs steeped in chilled cardamom-flavored saffron milk and slivered pistachios",
        price: 110,
        category: "Desserts",
        subCategory: "Desserts & Drinks",
        preparationTime: 5,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/rasmalai.jpg",
        createdBy: admin._id
      },
      {
        name: "Chocolate Brownie",
        description: "Warm, fudgy Belgian dark chocolate brownie drizzled with rich chocolate ganache",
        price: 150,
        category: "Desserts",
        subCategory: "Desserts & Drinks",
        preparationTime: 5,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/chocolate-brownie.jpg",
        createdBy: admin._id
      },
      {
        name: "Fresh Lime Juice",
        description: "Chilled fresh-squeezed lime juice with crushed mint leaves, rock salt, and organic cane sugar",
        price: 70,
        category: "Beverages",
        subCategory: "Desserts & Drinks",
        preparationTime: 4,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/fresh-lime-juice.jpg",
        createdBy: admin._id
      },
      {
        name: "Mango Lassi",
        description: "Thick, creamy yogurt smoothie whipped with luscious Alphonso mango pulp and fragrant green cardamom",
        price: 95,
        category: "Beverages",
        subCategory: "Desserts & Drinks",
        preparationTime: 5,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/mango-lassi.jpg",
        createdBy: admin._id
      },
      {
        name: "Cold Coffee",
        description: "Slow-brewed rich espresso whipped with chilled creamy milk, Madagascar vanilla, and chocolate shavings",
        price: 120,
        category: "Beverages",
        subCategory: "Desserts & Drinks",
        preparationTime: 5,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/cold-coffee.jpg",
        createdBy: admin._id
      },
      {
        name: "Milkshakes",
        description: "Thick hand-spun milkshake made with rich dairy ice cream and topped with fresh whipped cream and fudge",
        price: 140,
        category: "Beverages",
        subCategory: "Desserts & Drinks",
        preparationTime: 6,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/milkshakes.jpg",
        createdBy: admin._id
      },

      // --- Existing Retained Dishes ---
      {
        name: "Garlic Bread",
        description: "Freshly baked artisan baguette slices brushed with fragrant garlic-herb butter and toasted to perfection",
        price: 140,
        category: "Appetizers",
        subCategory: "Starters & Snacks",
        preparationTime: 10,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/garlic-bread.jpg",
        createdBy: admin._id
      },
      {
        name: "Margherita Pizza",
        description: "Hand-stretched sourdough pizza with San Marzano tomatoes, fresh mozzarella, and aromatic sweet basil",
        price: 320,
        category: "Main Course",
        subCategory: "Curries & Breads",
        preparationTime: 20,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/margherita-pizza.jpg",
        createdBy: admin._id
      },
      {
        name: "Chef's Special Pasta",
        description: "Penne pasta tossed in creamy wild mushroom white sauce with fresh thyme, garlic, and aged parmesan",
        price: 280,
        category: "Specials",
        subCategory: "Curries & Breads",
        preparationTime: 15,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/chef-s-special-pasta.jpg",
        createdBy: admin._id
      },
      {
        name: "Ice Cream Sundae",
        description: "Triple-scoop ice cream topped with roasted almonds, warm chocolate fudge drizzle, and a maraschino cherry",
        price: 129,
        category: "Desserts",
        subCategory: "Desserts & Drinks",
        preparationTime: 5,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/ice-cream-sundae.jpg",
        aliases: ["ice cream"],
        createdBy: admin._id
      },
      {
        name: "Fresh Lime Soda",
        description: "Sparkling soda with freshly squeezed lime juice, mint leaves, and a touch of rock salt and sweet cane syrup",
        price: 80,
        category: "Beverages",
        subCategory: "Desserts & Drinks",
        preparationTime: 4,
        isVegetarian: true,
        isAvailable: true,
        image: "/images/food/fresh-lime-soda.jpg",
        createdBy: admin._id
      }
    ];

    const menuCount = await MenuItem.countDocuments();
    if (menuCount === 0) {
      await MenuItem.insertMany(sampleItems);
    } else {
      for (const item of sampleItems) {
        const searchNames = [item.name, ...(item.aliases || [])];
        const existing = await MenuItem.findOne({
          name: { $in: searchNames.map(n => new RegExp(`^${n}$`, 'i')) }
        });

        if (existing) {
          existing.name = item.name;
          existing.description = item.description;
          existing.price = item.price;
          existing.category = item.category;
          existing.subCategory = item.subCategory;
          existing.preparationTime = item.preparationTime;
          existing.isVegetarian = item.isVegetarian;
          existing.isAvailable = item.isAvailable;
          existing.image = item.image;
          await existing.save();
        } else {
          await MenuItem.create(item);
        }
      }
    }

    res.json({
      message: '✅ Sample data is ready!',
      admin: {
        username: admin.username,
        email: admin.email,
        restaurantName: admin.restaurantName
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ message: error.message });
  }
};

app.get('/api/seed-data', handleSeed);
app.post('/api/seed-data', handleSeed);

// Get currently active dining tables (immediate table orders)
app.get('/api/tables/occupied', async (req, res) => {
  try {
    const activeOrders = await Order.find({
      status: { $in: ['pending', 'preparing', 'ready'] }
    }).select('tableId');
    const occupiedTables = [...new Set(activeOrders.map(o => String(o.tableId)))];
    res.json({ occupiedTables });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Root Health Check
app.get('/', (req, res) => {
  res.json({ message: '🚀 DISHDASH Restaurant & Table Reservation API is running!' });
});

// Start Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🎯 DISHDASH Server running on http://localhost:${PORT}`);
  console.log(`📊 MongoDB URI: ${process.env.MONGODB_URI ? 'Connected to custom URI' : 'Default localhost'}`);
});