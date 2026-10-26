import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { formatTime12Hour } from './TableSelection';
import './AdminDashboard.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const CATEGORIES = [
  'South Indian Specials',
  'Biryani & Rice',
  'Curries & Breads',
  'Starters & Snacks',
  'Desserts & Drinks',
  'Specials',
  'Main Course',
  'Appetizers',
  'Desserts',
  'Beverages'
];

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   next: 'preparing', badgeCls: 'badge-pending',   actionText: 'Start Cooking 👨‍🍳' },
  preparing: { label: 'Cooking',   next: 'ready',     badgeCls: 'badge-preparing', actionText: 'Mark Ready 🍽️' },
  ready:     { label: 'Ready',     next: 'completed', badgeCls: 'badge-ready',     actionText: 'Mark Completed ✓' },
  completed: { label: 'Completed', next: null,        badgeCls: 'badge-completed', actionText: null },
  cancelled: { label: 'Cancelled', next: null,        badgeCls: 'badge-cancelled', actionText: null },
};

const DEFAULT_FORM = {
  name: '',
  description: '',
  price: '',
  category: 'Specials',
  subCategory: '',
  image: '',
  preparationTime: '15',
  isVegetarian: true,
  isAvailable: true,
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [kitchenQueue, setKitchenQueue] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [adminInfo, setAdminInfo] = useState(null);
  const [loading, setLoading] = useState({ orders: false, menu: false, form: false, reservations: false, kitchen: false });
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [menuForm, setMenuForm] = useState(DEFAULT_FORM);
  const [orderFilter, setOrderFilter] = useState('all');
  const [reservationFilter, setReservationFilter] = useState('all');
  const [menuCategory, setMenuCategory] = useState('All');
  const [searchMenu, setSearchMenu] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const token = localStorage.getItem('adminToken');
  const authHeaders = useMemo(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  const setLoad = (key, val) => setLoading(prev => ({ ...prev, [key]: val }));

  const handleLogout = useCallback(() => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    navigate('/admin/login');
    toast.info('Logged out from admin panel.');
  }, [navigate]);

  const fetchOrders = useCallback(async () => {
    const currentToken = localStorage.getItem('adminToken');
    if (!currentToken) return;

    setLoad('orders', true);
    try {
      const res = await axios.get(`${API}/api/admin/orders`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setOrders(res.data || []);
    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout();
      } else {
        toast.error('Failed to load live orders');
      }
    } finally {
      setLoad('orders', false);
    }
  }, [handleLogout]);

  const fetchKitchenQueue = useCallback(async () => {
    const currentToken = localStorage.getItem('adminToken');
    if (!currentToken) return;

    setLoad('kitchen', true);
    try {
      const res = await axios.get(`${API}/api/admin/kitchen/queue`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setKitchenQueue(res.data || []);
    } catch {
      // fallback to active orders
    } finally {
      setLoad('kitchen', false);
    }
  }, []);

  const fetchReservations = useCallback(async () => {
    const currentToken = localStorage.getItem('adminToken');
    if (!currentToken) return;

    setLoad('reservations', true);
    try {
      const res = await axios.get(`${API}/api/admin/reservations`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setReservations(res.data || []);
    } catch {
      toast.error('Failed to load table reservations');
    } finally {
      setLoad('reservations', false);
    }
  }, []);

  const fetchMenu = useCallback(async () => {
    const currentToken = localStorage.getItem('adminToken');
    if (!currentToken) return;

    setLoad('menu', true);
    try {
      const res = await axios.get(`${API}/api/admin/menu`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setMenuItems(res.data || []);
    } catch {
      toast.error('Failed to load menu items');
    } finally {
      setLoad('menu', false);
    }
  }, []);

  const refreshAllData = useCallback(() => {
    fetchOrders();
    fetchKitchenQueue();
    fetchReservations();
    fetchMenu();
  }, [fetchOrders, fetchKitchenQueue, fetchReservations, fetchMenu]);

  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
      return;
    }
    const info = localStorage.getItem('adminInfo');
    if (info) {
      try {
        setAdminInfo(JSON.parse(info));
      } catch (err) {
        console.error(err);
      }
    }
    refreshAllData();
  }, [navigate, token, refreshAllData]);

  // Order Status Update
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await axios.patch(
        `${API}/api/admin/orders/${orderId}/status`,
        { status: newStatus },
        authHeaders
      );
      setOrders(prev => prev.map(o => o._id === orderId ? res.data : o));
      setKitchenQueue(prev => prev.map(o => o._id === orderId ? res.data : o));
      toast.success(`Order moved to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      fetchKitchenQueue();
    } catch {
      toast.error('Failed to update order status');
    }
  };

  // Kitchen Delay Update
  const handleAddKitchenDelay = async (orderId, delayMinutes) => {
    try {
      const res = await axios.patch(
        `${API}/api/admin/orders/${orderId}/kitchen-delay`,
        { delayMinutes },
        authHeaders
      );
      setOrders(prev => prev.map(o => o._id === orderId ? res.data : o));
      setKitchenQueue(prev => prev.map(o => o._id === orderId ? res.data : o));
      toast.info(`Logged +${delayMinutes}m kitchen prep delay for Order #${res.data.orderNumber}`);
    } catch {
      toast.error('Failed to update kitchen delay');
    }
  };

  const deleteOrder = async (orderId) => {
    if (!window.confirm('Delete this order record permanently?')) return;
    try {
      await axios.delete(`${API}/api/admin/orders/${orderId}`, authHeaders);
      setOrders(prev => prev.filter(o => o._id !== orderId));
      setKitchenQueue(prev => prev.filter(o => o._id !== orderId));
      toast.success('Order deleted');
    } catch {
      toast.error('Failed to delete order');
    }
  };

  // Reservation Status Update
  const updateReservationStatus = async (reservationId, status) => {
    try {
      const res = await axios.patch(
        `${API}/api/admin/reservations/${reservationId}/status`,
        { status },
        authHeaders
      );
      setReservations(prev => prev.map(r => r._id === reservationId ? res.data : r));
      toast.success(`Reservation status updated to ${status}`);
    } catch {
      toast.error('Failed to update reservation');
    }
  };

  // Feature 3: Quick Availability Toggle
  const toggleItemAvailability = async (item) => {
    const newStatus = !item.isAvailable;
    try {
      const res = await axios.patch(
        `${API}/api/admin/menu/${item._id}/availability`,
        { isAvailable: newStatus },
        authHeaders
      );
      setMenuItems(prev => prev.map(m => m._id === item._id ? res.data : m));
      toast.success(
        `"${item.name}" marked as ${newStatus ? 'Available' : 'Unavailable'}`
      );
    } catch {
      toast.error('Failed to update availability status');
    }
  };

  // Menu Item CRUD
  const openMenuModal = (item = null) => {
    setEditingItem(item);
    setMenuForm(item ? {
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category: item.category,
      subCategory: item.subCategory || '',
      image: item.image || '',
      preparationTime: item.preparationTime?.toString() || '15',
      isVegetarian: item.isVegetarian !== false,
      isAvailable: item.isAvailable !== false,
    } : DEFAULT_FORM);
    setShowMenuModal(true);
  };

  const closeMenuModal = () => {
    setShowMenuModal(false);
    setEditingItem(null);
    setMenuForm(DEFAULT_FORM);
  };

  const handleMenuSubmit = async (e) => {
    e.preventDefault();
    if (!menuForm.name.trim() || !menuForm.price) {
      toast.error('Dish name and price are required');
      return;
    }

    setLoad('form', true);
    try {
      const payload = {
        name: menuForm.name.trim(),
        description: menuForm.description.trim(),
        price: Number(menuForm.price),
        category: menuForm.category,
        subCategory: menuForm.subCategory ? menuForm.subCategory.trim() : undefined,
        image: menuForm.image ? menuForm.image.trim() : undefined,
        preparationTime: menuForm.preparationTime ? Number(menuForm.preparationTime) : 15,
        isVegetarian: Boolean(menuForm.isVegetarian),
        isAvailable: Boolean(menuForm.isAvailable),
      };

      if (editingItem) {
        const res = await axios.put(`${API}/api/admin/menu/${editingItem._id}`, payload, authHeaders);
        setMenuItems(prev => prev.map(m => m._id === editingItem._id ? res.data : m));
        toast.success(`Updated "${payload.name}" successfully!`);
      } else {
        const res = await axios.post(`${API}/api/admin/menu`, payload, authHeaders);
        setMenuItems(prev => [...prev, res.data]);
        toast.success(`Added "${payload.name}" to menu!`);
      }
      closeMenuModal();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save menu item');
    } finally {
      setLoad('form', false);
    }
  };

  const deleteMenuItem = async (itemId) => {
    if (!window.confirm('Delete this menu item from customer menus?')) return;
    try {
      await axios.delete(`${API}/api/admin/menu/${itemId}`, authHeaders);
      setMenuItems(prev => prev.filter(m => m._id !== itemId));
      toast.success('Dish deleted from menu');
    } catch {
      toast.error('Failed to delete menu item');
    }
  };

  // Safe Seed Helper
  const handleSeedData = async () => {
    try {
      await axios.post(`${API}/api/seed-data`);
      toast.success('Sample dishes verified successfully.');
      refreshAllData();
    } catch {
      toast.error('Could not run seed endpoint.');
    }
  };

  // Metrics
  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter(o => o.status === 'pending').length;
    const preparing = orders.filter(o => o.status === 'preparing').length;
    const ready = orders.filter(o => o.status === 'ready').length;
    const completed = orders.filter(o => o.status === 'completed').length;
    const revenue = orders
      .filter(o => o.status === 'completed')
      .reduce((s, o) => s + (o.totalAmount || 0), 0);

    const activeReservations = reservations.filter(r => r.status === 'confirmed').length;
    const preOrdersCount = orders.filter(o => o.isPreOrder && o.status !== 'completed' && o.status !== 'cancelled').length;

    return { total, pending, preparing, ready, completed, revenue, activeReservations, preOrdersCount };
  }, [orders, reservations]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return orders;
    return orders.filter(o => o.status === orderFilter);
  }, [orders, orderFilter]);

  // Filtered reservations
  const filteredReservations = useMemo(() => {
    if (reservationFilter === 'all') return reservations;
    return reservations.filter(r => r.status === reservationFilter);
  }, [reservations, reservationFilter]);

  // Filtered menu
  const filteredMenu = useMemo(() => {
    return menuItems.filter(m => {
      const matchCat = menuCategory === 'All' || m.category === menuCategory || m.subCategory === menuCategory;
      const matchSearch = !searchMenu.trim() ||
        m.name.toLowerCase().includes(searchMenu.toLowerCase().trim()) ||
        (m.description && m.description.toLowerCase().includes(searchMenu.toLowerCase().trim())) ||
        (m.subCategory && m.subCategory.toLowerCase().includes(searchMenu.toLowerCase().trim()));
      return matchCat && matchSearch;
    });
  }, [menuItems, menuCategory, searchMenu]);

  return (
    <div className="admin-page-root">
      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand-block">
          <div className="sidebar-brand-title">DISHDASH</div>
          <div className="sidebar-brand-sub">{adminInfo?.restaurantName || 'Staff & Kitchen Portal'}</div>
        </div>

        <nav className="sidebar-nav-menu">
          <button
            type="button"
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">📊</span>
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'kitchen' ? 'active' : ''}`}
            onClick={() => { setActiveTab('kitchen'); setSidebarOpen(false); fetchKitchenQueue(); }}
          >
            <span className="nav-icon">👨‍🍳</span>
            <span>Kitchen Queue</span>
            {(stats.pending + stats.preparing) > 0 && (
              <span className="nav-badge">{stats.pending + stats.preparing}</span>
            )}
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'reservations' ? 'active' : ''}`}
            onClick={() => { setActiveTab('reservations'); setSidebarOpen(false); fetchReservations(); }}
          >
            <span className="nav-icon">📅</span>
            <span>Table Bookings</span>
            {stats.activeReservations > 0 && (
              <span className="nav-badge-sub">{stats.activeReservations}</span>
            )}
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => { setActiveTab('orders'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">📦</span>
            <span>All Orders</span>
            <span className="nav-badge-sub">{orders.length}</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'menu' ? 'active' : ''}`}
            onClick={() => { setActiveTab('menu'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">🍽️</span>
            <span>Menu & Stock</span>
            <span className="nav-badge-sub">{menuItems.length}</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="user-avatar">{adminInfo?.username?.charAt(0)?.toUpperCase() || 'A'}</div>
            <div className="user-details">
              <span className="user-name">{adminInfo?.username || 'Admin'}</span>
              <span className="user-role">Manager</span>
            </div>
          </div>
          <button
            type="button"
            className="btn-sidebar-logout"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* Main Panel */}
      <div className="admin-main-panel">
        {/* Header */}
        <header className="admin-header">
          <div className="header-left">
            <button
              type="button"
              className="btn-hamburger"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ☰
            </button>
            <h1 className="header-tab-title">
              {activeTab === 'dashboard' && 'Restaurant Overview'}
              {activeTab === 'kitchen' && 'Kitchen Live Queue & Pre-Orders'}
              {activeTab === 'reservations' && 'Customer Table Reservations'}
              {activeTab === 'orders' && 'Order Management'}
              {activeTab === 'menu' && 'Menu & Food Availability'}
            </h1>
          </div>

          <div className="header-right-actions">
            <button
              type="button"
              className="btn-header-action"
              onClick={refreshAllData}
              title="Refresh All Data"
            >
              🔄 Refresh
            </button>
            <button
              type="button"
              className="btn-header-action"
              onClick={handleSeedData}
              title="Verify Dishes"
            >
              🌱 Verify Dishes
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="admin-content-area">

          {/* ===== TAB 1: DASHBOARD ===== */}
          {activeTab === 'dashboard' && (
            <div className="tab-pane dashboard-pane">
              <div className="stats-row">
                <div className="metric-card">
                  <span className="metric-label">Total Orders</span>
                  <div className="metric-number">{stats.total}</div>
                  <span className="metric-note">Lifetime dining & pre-orders</span>
                </div>

                <div className="metric-card metric-pending">
                  <span className="metric-label">Kitchen Pending</span>
                  <div className="metric-number">{stats.pending}</div>
                  <span className="metric-note">Awaiting cooking dispatch</span>
                </div>

                <div className="metric-card metric-cooking">
                  <span className="metric-label">Cooking On Stoves</span>
                  <div className="metric-number">{stats.preparing}</div>
                  <span className="metric-note">Currently in kitchen</span>
                </div>

                <div className="metric-card metric-ready">
                  <span className="metric-label">Active Reservations</span>
                  <div className="metric-number">{stats.activeReservations}</div>
                  <span className="metric-note">{stats.preOrdersCount} pre-orders scheduled</span>
                </div>

                <div className="metric-card metric-revenue">
                  <span className="metric-label">Settled Revenue</span>
                  <div className="metric-number">₹{stats.revenue}</div>
                  <span className="metric-note">{stats.completed} completed orders</span>
                </div>
              </div>

              <div className="dashboard-grid-sections">
                <div className="dash-section-box">
                  <div className="box-title-row">
                    <h3>Upcoming Kitchen Pre-Orders & Priority Queue</h3>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setActiveTab('kitchen')}
                    >
                      Open Kitchen Queue →
                    </button>
                  </div>

                  {orders.filter(o => o.status === 'pending' || o.status === 'preparing').length === 0 ? (
                    <div className="dash-empty-box">
                      <p>✅ Kitchen queue clear. No dishes currently cooking or pending.</p>
                    </div>
                  ) : (
                    <div className="recent-orders-list">
                      {orders
                        .filter(o => o.status === 'pending' || o.status === 'preparing')
                        .slice(0, 4)
                        .map(order => (
                          <div key={order._id} className="quick-order-row">
                            <div className="q-left">
                              <strong>
                                Table {order.tableId} • #{order.orderNumber}
                                {order.isPreOrder && <span className="preorder-badge-sm">PRE-ORDER</span>}
                              </strong>
                              <span className="q-customer">
                                {order.customerName} ({order.items.length} items) •
                                {order.expectedArrivalTime ? ` Arrival: ${order.expectedArrivalTime}` : ` Ready: ~${order.estimatedReadyTime || '15m'}`}
                              </span>
                            </div>
                            <div className="q-right">
                              <span className="q-amount">₹{order.totalAmount}</span>
                              <button
                                type="button"
                                className="btn-quick-status"
                                onClick={() => updateOrderStatus(order._id, order.status === 'pending' ? 'preparing' : 'ready')}
                              >
                                {order.status === 'pending' ? 'Start Cooking 👨‍🍳' : 'Mark Ready 🍽️'}
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="dash-section-box">
                  <div className="box-title-row">
                    <h3>Confirmed Table Bookings ({stats.activeReservations})</h3>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setActiveTab('reservations')}
                    >
                      View All Bookings →
                    </button>
                  </div>
                  {reservations.filter(r => r.status === 'confirmed').length === 0 ? (
                    <div className="dash-empty-box">
                      <p>No upcoming table reservations scheduled.</p>
                    </div>
                  ) : (
                    <div className="recent-orders-list">
                      {reservations
                        .filter(r => r.status === 'confirmed')
                        .slice(0, 4)
                        .map(res => (
                          <div key={res._id} className="quick-order-row">
                            <div className="q-left">
                              <strong>Table {res.tableId} • #{res.reservationNumber}</strong>
                              <span className="q-customer">
                                {res.customerName} ({res.guestCount} Guests) • {res.reservationDate} at {res.timeSlot}
                              </span>
                            </div>
                            <div className="q-right">
                              <span className={`res-preorder-chip ${res.linkedOrderId ? 'has-preorder' : 'no-preorder'}`}>
                                {res.linkedOrderId ? 'Food Pre-Ordered' : 'Table Only'}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== TAB 2: KITCHEN QUEUE ===== */}
          {activeTab === 'kitchen' && (
            <div className="tab-pane kitchen-pane">
              <div className="kitchen-pane-header">
                <div>
                  <h2>Kitchen Orders & Pre-Order Preparation Schedule</h2>
                  <p className="kitchen-subtitle">
                    Dishes are scheduled based on customer arrival times so food is hot and freshly plated.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-refresh-kitchen"
                  onClick={fetchKitchenQueue}
                >
                  🔄 Sync Kitchen Queue
                </button>
              </div>

              {kitchenQueue.length === 0 ? (
                <div className="dash-empty-box">
                  <p>🍳 Kitchen is currently idle. No orders in pending, cooking, or ready states.</p>
                </div>
              ) : (
                <div className="kitchen-cards-grid">
                  {kitchenQueue.map(order => {
                    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    const isPreOrder = order.isPreOrder;

                    return (
                      <div key={order._id} className={`kitchen-ticket-card ${cfg.badgeCls}`}>
                        <div className="kt-header">
                          <div className="kt-id-info">
                            <span className="kt-id">#{order.orderNumber}</span>
                            <span className="kt-table">Table {order.tableId}</span>
                            {isPreOrder && <span className="kt-preorder-badge">PRE-ORDER</span>}
                          </div>
                          <span className={`status-tag ${cfg.badgeCls}`}>{cfg.label}</span>
                        </div>

                        {/* Customer & Arrival Schedule */}
                        <div className="kt-schedule-box">
                          <div className="kt-schedule-item">
                            <span>Guest:</span>
                            <strong>{order.customerName}</strong>
                          </div>
                          {isPreOrder ? (
                            <>
                              <div className="kt-schedule-item">
                                <span>Arrival Time:</span>
                                <strong>{formatTime12Hour(order.expectedArrivalTime) || 'Scheduled'}</strong>
                              </div>
                              <div className="kt-schedule-item">
                                <span>Target Ready:</span>
                                <strong className="text-primary">{order.estimatedReadyTime}</strong>
                              </div>
                            </>
                          ) : (
                            <div className="kt-schedule-item">
                              <span>Estimated Ready:</span>
                              <strong>~{order.estimatedReadyTime || '15 mins'}</strong>
                            </div>
                          )}
                        </div>

                        {/* Items list */}
                        <div className="kt-items-list">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="kt-dish-row">
                              <span className="kt-dish-qty">{item.quantity}×</span>
                              <span className="kt-dish-name">{item.name}</span>
                              <span className="kt-dish-prep">⏱️ {item.prepTime || 15}m</span>
                            </div>
                          ))}
                        </div>

                        {/* Delays Alert */}
                        {order.prepDelayMinutes > 0 && (
                          <div className="kt-delay-badge">
                            ⚠️ +{order.prepDelayMinutes} mins delay added
                          </div>
                        )}

                        {/* Kitchen Operations */}
                        <div className="kt-actions">
                          {cfg.next && (
                            <button
                              type="button"
                              className="btn-kt-advance"
                              onClick={() => updateOrderStatus(order._id, cfg.next)}
                            >
                              {cfg.actionText}
                            </button>
                          )}

                          <div className="kt-delay-btn-group">
                            <button
                              type="button"
                              className="btn-delay-opt"
                              onClick={() => handleAddKitchenDelay(order._id, 10)}
                              title="Add 10m kitchen buffer"
                            >
                              +10m
                            </button>
                            <button
                              type="button"
                              className="btn-delay-opt"
                              onClick={() => handleAddKitchenDelay(order._id, 15)}
                              title="Add 15m kitchen buffer"
                            >
                              +15m
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== TAB 3: TABLE RESERVATIONS ===== */}
          {activeTab === 'reservations' && (
            <div className="tab-pane reservations-pane">
              <div className="res-filter-bar">
                {['all', 'confirmed', 'completed', 'cancelled'].map(st => (
                  <button
                    key={st}
                    type="button"
                    className={`btn-filter-status ${reservationFilter === st ? 'active' : ''}`}
                    onClick={() => setReservationFilter(st)}
                  >
                    {st === 'all' ? 'All Bookings' : st.charAt(0).toUpperCase() + st.slice(1)}
                    <span className="filter-count">
                      {st === 'all' ? reservations.length : reservations.filter(r => r.status === st).length}
                    </span>
                  </button>
                ))}
              </div>

              {filteredReservations.length === 0 ? (
                <div className="dash-empty-box">
                  <p>No table reservations found under "{reservationFilter}".</p>
                </div>
              ) : (
                <div className="reservations-table-wrapper">
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th>Booking #</th>
                        <th>Customer</th>
                        <th>Table</th>
                        <th>Date & Time</th>
                        <th>Guests</th>
                        <th>Pre-Order Status</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReservations.map(res => (
                        <tr key={res._id}>
                          <td><strong>#{res.reservationNumber}</strong></td>
                          <td>
                            <div>{res.customerName}</div>
                            <small className="text-muted">{res.customerPhone}</small>
                          </td>
                          <td>Table {res.tableId}</td>
                          <td>
                            <div>{res.reservationDate}</div>
                            <small>{formatTime12Hour(res.timeSlot)} – {formatTime12Hour(res.endTime)}</small>
                          </td>
                          <td>👥 {res.guestCount}</td>
                          <td>
                            {res.linkedOrderId ? (
                              <span className="badge-preorder-yes">
                                🍽️ Pre-Ordered ({res.preOrderStatus || 'Placed'})
                              </span>
                            ) : (
                              <span className="badge-preorder-none">Table Only</span>
                            )}
                          </td>
                          <td>
                            <span className={`res-status-tag status-${res.status}`}>
                              {res.status}
                            </span>
                          </td>
                          <td>
                            <div className="res-row-actions">
                              {res.status === 'confirmed' && (
                                <>
                                  <button
                                    type="button"
                                    className="btn-tbl-action btn-tbl-complete"
                                    onClick={() => updateReservationStatus(res._id, 'completed')}
                                  >
                                    Complete
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-tbl-action btn-tbl-cancel"
                                    onClick={() => updateReservationStatus(res._id, 'cancelled')}
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ===== TAB 4: ORDERS ===== */}
          {activeTab === 'orders' && (
            <div className="tab-pane orders-pane">
              <div className="orders-filter-bar">
                {['all', 'pending', 'preparing', 'ready', 'completed', 'cancelled'].map(st => (
                  <button
                    key={st}
                    type="button"
                    className={`btn-filter-status ${orderFilter === st ? 'active' : ''}`}
                    onClick={() => setOrderFilter(st)}
                  >
                    {st === 'all' ? 'All Orders' : STATUS_CONFIG[st]?.label || st}
                    <span className="filter-count">
                      {st === 'all' ? orders.length : orders.filter(o => o.status === st).length}
                    </span>
                  </button>
                ))}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="dash-empty-box">
                  <p>No orders found under "{orderFilter}".</p>
                </div>
              ) : (
                <div className="orders-cards-grid">
                  {filteredOrders.map(order => {
                    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    const isOnline = order.paymentType === 'online';

                    return (
                      <div key={order._id} className="admin-order-card">
                        <div className="aoc-header">
                          <div>
                            <span className="aoc-id">#{order.orderNumber}</span>
                            <div className="aoc-table">
                              Table {order.tableId} • {order.customerName}
                              {order.isPreOrder && <span className="preorder-badge-sm">PRE-ORDER</span>}
                            </div>
                          </div>
                          <span className={`status-tag ${cfg.badgeCls}`}>
                            {cfg.label}
                          </span>
                        </div>

                        <div className="aoc-items-list">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="aoc-item-row">
                              <span className="aoc-item-name">
                                <strong>{item.quantity}×</strong> {item.name}
                              </span>
                              <span className="aoc-item-price">₹{item.price * item.quantity}</span>
                            </div>
                          ))}
                        </div>

                        <div className="aoc-meta-row">
                          <div className="aoc-payment-badges">
                            <span className="aoc-mode">
                              {isOnline ? '💳 Simulated Online' : '🏪 Pay at Counter'}
                            </span>
                            <span className={`aoc-paid-tag ${order.paymentStatus === 'paid' ? 'tag-paid' : 'tag-unpaid'}`}>
                              {order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                            </span>
                          </div>
                          <div className="aoc-total">₹{order.totalAmount}</div>
                        </div>

                        <div className="aoc-actions">
                          {cfg.next && (
                            <button
                              type="button"
                              className="btn-advance-status"
                              onClick={() => updateOrderStatus(order._id, cfg.next)}
                            >
                              {cfg.actionText}
                            </button>
                          )}

                          <select
                            value={order.status}
                            onChange={(e) => updateOrderStatus(order._id, e.target.value)}
                            className="status-selector"
                          >
                            <option value="pending">Pending</option>
                            <option value="preparing">Cooking</option>
                            <option value="ready">Ready</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>

                          <button
                            type="button"
                            className="btn-delete-order"
                            onClick={() => deleteOrder(order._id)}
                            title="Delete order"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== TAB 5: MENU & FOOD AVAILABILITY ===== */}
          {activeTab === 'menu' && (
            <div className="tab-pane menu-pane">
              <div className="menu-admin-controls">
                <div className="mac-left">
                  <input
                    type="text"
                    className="mac-search"
                    placeholder="Search dish by name..."
                    value={searchMenu}
                    onChange={(e) => setSearchMenu(e.target.value)}
                  />

                  <div className="mac-category-filter">
                    {['All', ...CATEGORIES].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        className={`mac-cat-btn ${menuCategory === cat ? 'active' : ''}`}
                        onClick={() => setMenuCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-add-item"
                  onClick={() => openMenuModal()}
                >
                  + Add New Dish
                </button>
              </div>

              {filteredMenu.length === 0 ? (
                <div className="dash-empty-box">
                  <p>No dishes found matching your criteria.</p>
                </div>
              ) : (
                <div className="menu-admin-grid">
                  {filteredMenu.map(item => {
                    const isAvailable = item.isAvailable !== false;

                    return (
                      <div
                        key={item._id}
                        className={`menu-admin-card ${!isAvailable ? 'card-sold-out' : ''}`}
                      >
                        <div className="admin-card-head">
                          <div className="head-tags">
                            <span className="dish-cat-pill">{item.category}</span>
                            {item.subCategory && item.subCategory !== item.category && (
                              <span className="dish-subcat-pill">{item.subCategory}</span>
                            )}
                          </div>
                          <span className={`dish-veg-pill ${item.isVegetarian !== false ? 'veg' : 'non-veg'}`}>
                            {item.isVegetarian !== false ? '🟢 Veg' : '🔴 Non-Veg'}
                          </span>
                        </div>

                        {item.image && (
                          <div className="admin-dish-thumb-wrap">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="admin-dish-thumb"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/images/food/neutral-food-placeholder.jpg';
                              }}
                            />
                          </div>
                        )}

                        <div className="admin-card-body">
                          <h3 className="dish-name">{item.name}</h3>
                          <p className="dish-desc">{item.description || 'No description added'}</p>
                          <div className="dish-price-time">
                            <span className="price-tag">₹{item.price}</span>
                            {item.preparationTime && (
                              <span className="prep-tag">⏱️ {item.preparationTime} mins</span>
                            )}
                          </div>
                        </div>

                        <div className="admin-card-availability">
                          <div className="avail-indicator-block">
                            <span className={`avail-dot ${isAvailable ? 'dot-avail' : 'dot-unavail'}`} />
                            <span className="avail-text">
                              {isAvailable ? 'Available for Ordering' : 'Unavailable / Sold Out'}
                            </span>
                          </div>

                          <button
                            type="button"
                            className={`btn-toggle-stock ${isAvailable ? 'btn-make-unavail' : 'btn-make-avail'}`}
                            onClick={() => toggleItemAvailability(item)}
                          >
                            {isAvailable ? 'Mark Sold Out' : 'Mark Available'}
                          </button>
                        </div>

                        <div className="admin-card-actions">
                          <button
                            type="button"
                            className="btn-edit-dish"
                            onClick={() => openMenuModal(item)}
                          >
                            ✏️ Edit Details
                          </button>
                          <button
                            type="button"
                            className="btn-del-dish"
                            onClick={() => deleteMenuItem(item._id)}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* Add / Edit Menu Item Modal */}
      {showMenuModal && (
        <div className="modal-backdrop" onClick={closeMenuModal}>
          <div className="menu-form-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>{editingItem ? 'Edit Dish Details' : 'Add New Dish to Menu'}</h3>
              <button type="button" className="dialog-close" onClick={closeMenuModal}>✕</button>
            </div>

            <form onSubmit={handleMenuSubmit} className="dialog-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label>Dish Name *</label>
                  <input
                    type="text"
                    required
                    value={menuForm.name}
                    onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                    placeholder="e.g. Paneer Butter Masala"
                  />
                </div>

                <div className="form-group">
                  <label>Price (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={menuForm.price}
                    onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                    placeholder="e.g. 299"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows="3"
                  value={menuForm.description}
                  onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  placeholder="Ingredients, preparation style or flavor notes..."
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Category *</label>
                  <select
                    value={menuForm.category}
                    onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Prep Time (Minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={menuForm.preparationTime}
                    onChange={(e) => setMenuForm({ ...menuForm, preparationTime: e.target.value })}
                    placeholder="15"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Section / Subcategory</label>
                  <input
                    type="text"
                    value={menuForm.subCategory}
                    onChange={(e) => setMenuForm({ ...menuForm, subCategory: e.target.value })}
                    placeholder="e.g. South Indian Specials, Biryani & Rice"
                  />
                </div>

                <div className="form-group">
                  <label>Dish Image URL or Path</label>
                  <input
                    type="text"
                    value={menuForm.image}
                    onChange={(e) => setMenuForm({ ...menuForm, image: e.target.value })}
                    placeholder="e.g. /images/food/kerala-parotta.jpg"
                  />
                </div>
              </div>

              <div className="form-checkbox-row">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={menuForm.isVegetarian}
                    onChange={(e) => setMenuForm({ ...menuForm, isVegetarian: e.target.checked })}
                  />
                  <span>🟢 Pure Vegetarian Dish</span>
                </label>

                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={menuForm.isAvailable}
                    onChange={(e) => setMenuForm({ ...menuForm, isAvailable: e.target.checked })}
                  />
                  <span>✓ Available for Customer Ordering</span>
                </label>
              </div>

              <div className="dialog-actions">
                <button
                  type="submit"
                  className="btn-save-dish"
                  disabled={loading.form}
                >
                  {loading.form ? 'Saving Dish...' : editingItem ? 'Save Changes' : 'Create Dish'}
                </button>
                <button
                  type="button"
                  className="btn-cancel-dialog"
                  onClick={closeMenuModal}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
