import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import './AdminDashboard.css';

const API = 'http://localhost:4000';

const CATEGORIES = ['Appetizers', 'Main Course', 'Desserts', 'Beverages', 'Specials'];

const STATUS_FLOW = ['pending', 'preparing', 'ready', 'completed'];
const STATUS_CONFIG = {
  pending:   { label: '⏳ Pending',    cls: 'st-pending',   next: 'preparing' },
  preparing: { label: '👨‍🍳 Preparing', cls: 'st-preparing', next: 'ready' },
  ready:     { label: '✅ Ready',       cls: 'st-ready',     next: 'completed' },
  completed: { label: '📦 Completed',  cls: 'st-completed', next: null },
  cancelled: { label: '❌ Cancelled',  cls: 'st-cancelled', next: null },
};

const DEFAULT_FORM = {
  name: '', description: '', price: '', category: 'Appetizers',
  preparationTime: '', isAvailable: true,
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [adminInfo, setAdminInfo] = useState(null);
  const [loading, setLoading] = useState({ orders: false, menu: false, form: false });
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [menuForm, setMenuForm] = useState(DEFAULT_FORM);
  const [orderFilter, setOrderFilter] = useState('all');
  const [menuCategory, setMenuCategory] = useState('All');
  const [searchMenu, setSearchMenu] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const token = localStorage.getItem('adminToken');

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const setLoad = (key, val) => setLoading(prev => ({ ...prev, [key]: val }));

  useEffect(() => {
    if (!token) { navigate('/admin/login'); return; }
    const info = localStorage.getItem('adminInfo');
    if (info) setAdminInfo(JSON.parse(info));
    fetchOrders();
    fetchMenu();
  }, [navigate, token]);

  const fetchOrders = useCallback(async () => {
    setLoad('orders', true);
    try {
      const res = await axios.get(`${API}/api/admin/orders`, authHeaders);
      setOrders(res.data);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
      else toast.error('Failed to load orders');
    } finally {
      setLoad('orders', false);
    }
  }, [token]);

  const fetchMenu = useCallback(async () => {
    setLoad('menu', true);
    try {
      const res = await axios.get(`${API}/api/admin/menu`, authHeaders);
      setMenuItems(res.data);
    } catch {
      toast.error('Failed to load menu');
    } finally {
      setLoad('menu', false);
    }
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    navigate('/admin/login');
    toast.info('Logged out successfully');
  };

  // Orders
  const updateOrderStatus = async (orderId, status) => {
    try {
      await axios.patch(`${API}/api/admin/orders/${orderId}/status`, { status }, authHeaders);
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status } : o));
      toast.success(`Order moved to ${STATUS_CONFIG[status]?.label}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const deleteOrder = async (orderId) => {
    if (!window.confirm('Delete this order permanently?')) return;
    try {
      await axios.delete(`${API}/api/admin/orders/${orderId}`, authHeaders);
      setOrders(prev => prev.filter(o => o._id !== orderId));
      toast.success('Order deleted');
    } catch {
      toast.error('Failed to delete order');
    }
  };

  // Menu CRUD
  const openMenuModal = (item = null) => {
    setEditingItem(item);
    setMenuForm(item
      ? { name: item.name, description: item.description || '', price: item.price.toString(),
          category: item.category, preparationTime: item.preparationTime?.toString() || '',
          isAvailable: item.isAvailable }
      : DEFAULT_FORM
    );
    setShowMenuModal(true);
  };

  const closeMenuModal = () => {
    setShowMenuModal(false);
    setEditingItem(null);
    setMenuForm(DEFAULT_FORM);
  };

  const handleMenuSubmit = async (e) => {
    e.preventDefault();
    if (!menuForm.name || !menuForm.price) {
      toast.error('Name and price are required');
      return;
    }
    setLoad('form', true);
    try {
      const payload = {
        ...menuForm,
        price: Number(menuForm.price),
        preparationTime: menuForm.preparationTime ? Number(menuForm.preparationTime) : undefined,
      };

      if (editingItem) {
        const res = await axios.put(`${API}/api/admin/menu/${editingItem._id}`, payload, authHeaders);
        setMenuItems(prev => prev.map(m => m._id === editingItem._id ? res.data : m));
        toast.success('Menu item updated!');
      } else {
        const res = await axios.post(`${API}/api/admin/menu`, payload, authHeaders);
        setMenuItems(prev => [...prev, res.data]);
        toast.success('Menu item added!');
      }
      closeMenuModal();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save item');
    } finally {
      setLoad('form', false);
    }
  };

  const deleteMenuItem = async (itemId) => {
    if (!window.confirm('Delete this menu item?')) return;
    try {
      await axios.delete(`${API}/api/admin/menu/${itemId}`, authHeaders);
      setMenuItems(prev => prev.filter(m => m._id !== itemId));
      toast.success('Menu item deleted');
    } catch {
      toast.error('Failed to delete item');
    }
  };

  const handleSeedData = async () => {
    try {
      await axios.post(`${API}/api/seed-data`);
      toast.success('Sample data created! Demo: admin@foodheaven.com / admin123');
      fetchOrders();
      fetchMenu();
    } catch {
      toast.error('Failed to create sample data');
    }
  };

  // Computed stats
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    completed: orders.filter(o => o.status === 'completed').length,
    revenue: orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.totalAmount, 0),
    todayRevenue: orders.filter(o => {
      const today = new Date();
      const orderDate = new Date(o.createdAt);
      return o.status === 'completed' &&
        orderDate.getDate() === today.getDate() &&
        orderDate.getMonth() === today.getMonth();
    }).reduce((s, o) => s + o.totalAmount, 0),
  };

  // Filtered orders
  const filteredOrders = orderFilter === 'all'
    ? orders
    : orders.filter(o => o.status === orderFilter);

  // Filtered menu
  const filteredMenu = menuItems.filter(m => {
    const matchCat = menuCategory === 'All' || m.category === menuCategory;
    const matchSearch = !searchMenu || m.name.toLowerCase().includes(searchMenu.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="admin-page">
      {/* Sidebar */}
      <aside className={`ad-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <span>🍽️</span>
          <div>
            <div className="sidebar-restaurant">{adminInfo?.restaurantName || 'Restaurant'}</div>
            <div className="sidebar-role">Admin Panel</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {[
            { id: 'dashboard', icon: '📊', label: 'Dashboard' },
            { id: 'orders', icon: '📦', label: 'Orders', badge: stats.pending || null },
            { id: 'menu', icon: '🍽️', label: 'Menu', badge: menuItems.length || null },
          ].map(item => (
            <button
              key={item.id}
              className={`sidebar-nav-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
            >
              <span className="snb-icon">{item.icon}</span>
              <span className="snb-label">{item.label}</span>
              {item.badge != null && (
                <span className="snb-badge">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-admin-info">
            <div className="sa-avatar">{adminInfo?.username?.charAt(0)?.toUpperCase() || 'A'}</div>
            <div>
              <div className="sa-name">{adminInfo?.username || 'Admin'}</div>
              <div className="sa-email">{adminInfo?.email || ''}</div>
            </div>
          </div>
          <button className="sidebar-logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <div className="ad-main">
        {/* Top Bar */}
        <header className="ad-topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
          <div className="topbar-title">
            {activeTab === 'dashboard' && '📊 Dashboard'}
            {activeTab === 'orders' && '📦 Order Management'}
            {activeTab === 'menu' && '🍽️ Menu Management'}
          </div>
          <div className="topbar-actions">
            <button className="tb-seed-btn" onClick={handleSeedData} title="Load sample data">
              🗃️ Sample Data
            </button>
            <button className="tb-refresh-btn" onClick={() => { fetchOrders(); fetchMenu(); }} title="Refresh">
              🔄
            </button>
          </div>
        </header>

        <div className="ad-content">

          {/* ===== DASHBOARD TAB ===== */}
          {activeTab === 'dashboard' && (
            <div className="dashboard-view">
              {/* Stats Grid */}
              <div className="stats-grid">
                <div className="stat-card sc-blue">
                  <div className="sc-icon">📦</div>
                  <div className="sc-value">{stats.total}</div>
                  <div className="sc-label">Total Orders</div>
                  <div className="sc-sub">All time</div>
                </div>
                <div className="stat-card sc-yellow">
                  <div className="sc-icon">⏳</div>
                  <div className="sc-value">{stats.pending}</div>
                  <div className="sc-label">Pending</div>
                  <div className="sc-sub">Awaiting action</div>
                </div>
                <div className="stat-card sc-purple">
                  <div className="sc-icon">👨‍🍳</div>
                  <div className="sc-value">{stats.preparing}</div>
                  <div className="sc-label">Preparing</div>
                  <div className="sc-sub">In kitchen</div>
                </div>
                <div className="stat-card sc-green">
                  <div className="sc-icon">✅</div>
                  <div className="sc-value">{stats.completed}</div>
                  <div className="sc-label">Completed</div>
                  <div className="sc-sub">Successfully served</div>
                </div>
                <div className="stat-card sc-orange">
                  <div className="sc-icon">💰</div>
                  <div className="sc-value">₹{stats.revenue.toLocaleString('en-IN')}</div>
                  <div className="sc-label">Total Revenue</div>
                  <div className="sc-sub">From completed orders</div>
                </div>
                <div className="stat-card sc-teal">
                  <div className="sc-icon">📅</div>
                  <div className="sc-value">₹{stats.todayRevenue.toLocaleString('en-IN')}</div>
                  <div className="sc-label">Today Revenue</div>
                  <div className="sc-sub">{new Date().toLocaleDateString('en-IN')}</div>
                </div>
              </div>

              {/* Recent Orders */}
              <div className="dashboard-section">
                <div className="ds-header">
                  <h2>Recent Orders</h2>
                  <button className="view-all-btn" onClick={() => setActiveTab('orders')}>
                    View All →
                  </button>
                </div>
                <div className="recent-orders-list">
                  {orders.slice(0, 5).map(order => (
                    <div key={order._id} className="recent-order-row">
                      <div className="ror-id">#{order.orderNumber}</div>
                      <div className="ror-customer">
                        <span className="ror-name">{order.customerName}</span>
                        <span className="ror-table">Table {order.tableId}</span>
                      </div>
                      <div className="ror-amount">₹{order.totalAmount}</div>
                      <div className={`ror-status ${STATUS_CONFIG[order.status]?.cls}`}>
                        {STATUS_CONFIG[order.status]?.label}
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <div className="empty-state">
                      <span>📦</span>
                      <p>No orders yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Menu Stats */}
              <div className="dashboard-section">
                <div className="ds-header">
                  <h2>Menu Overview</h2>
                  <button className="view-all-btn" onClick={() => setActiveTab('menu')}>
                    Manage →
                  </button>
                </div>
                <div className="menu-stats-grid">
                  {CATEGORIES.map(cat => {
                    const count = menuItems.filter(m => m.category === cat).length;
                    const available = menuItems.filter(m => m.category === cat && m.isAvailable).length;
                    return (
                      <div key={cat} className="menu-stat-card">
                        <div className="msc-name">{cat}</div>
                        <div className="msc-count">{count}</div>
                        <div className="msc-sub">{available} available</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ===== ORDERS TAB ===== */}
          {activeTab === 'orders' && (
            <div className="orders-view">
              {/* Filter Bar */}
              <div className="filter-bar">
                {['all', 'pending', 'preparing', 'ready', 'completed', 'cancelled'].map(f => (
                  <button
                    key={f}
                    className={`filter-btn ${orderFilter === f ? 'filter-active' : ''}`}
                    onClick={() => setOrderFilter(f)}
                  >
                    {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label}
                    <span className="filter-count">
                      {f === 'all' ? orders.length : orders.filter(o => o.status === f).length}
                    </span>
                  </button>
                ))}
              </div>

              {loading.orders ? (
                <div className="loading-state">
                  <div className="spinner-lg" />
                  <p>Loading orders...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="empty-state-lg">
                  <span className="es-icon">📦</span>
                  <h3>No {orderFilter !== 'all' ? orderFilter : ''} orders found</h3>
                  <p>Orders will appear here once customers place them</p>
                  <button className="create-sample-btn" onClick={handleSeedData}>
                    🗃️ Load Sample Data
                  </button>
                </div>
              ) : (
                <div className="orders-grid">
                  {filteredOrders.map(order => (
                    <OrderCard
                      key={order._id}
                      order={order}
                      onStatusChange={updateOrderStatus}
                      onDelete={deleteOrder}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== MENU TAB ===== */}
          {activeTab === 'menu' && (
            <div className="menu-view">
              {/* Menu Toolbar */}
              <div className="menu-toolbar">
                <div className="menu-search-wrap">
                  <span>🔍</span>
                  <input
                    type="text"
                    placeholder="Search menu items..."
                    value={searchMenu}
                    onChange={e => setSearchMenu(e.target.value)}
                    className="menu-search-input"
                  />
                </div>
                <div className="menu-cat-filters">
                  {['All', ...CATEGORIES].map(cat => (
                    <button
                      key={cat}
                      className={`cat-filter-btn ${menuCategory === cat ? 'active' : ''}`}
                      onClick={() => setMenuCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <button className="add-menu-btn" onClick={() => openMenuModal()}>
                  + Add Item
                </button>
              </div>

              {loading.menu ? (
                <div className="loading-state">
                  <div className="spinner-lg" />
                  <p>Loading menu...</p>
                </div>
              ) : filteredMenu.length === 0 ? (
                <div className="empty-state-lg">
                  <span className="es-icon">🍽️</span>
                  <h3>No menu items found</h3>
                  <p>{searchMenu ? 'Try a different search' : 'Add your first menu item to get started'}</p>
                  <button className="create-sample-btn" onClick={() => openMenuModal()}>
                    + Add First Item
                  </button>
                </div>
              ) : (
                <div className="menu-admin-grid">
                  {filteredMenu.map(item => (
                    <MenuAdminCard
                      key={item._id}
                      item={item}
                      onEdit={() => openMenuModal(item)}
                      onDelete={() => deleteMenuItem(item._id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Menu Modal */}
      {showMenuModal && (
        <div className="modal-overlay" onClick={closeMenuModal}>
          <div className="menu-modal" onClick={e => e.stopPropagation()}>
            <div className="mm-header">
              <h3>{editingItem ? '✏️ Edit Menu Item' : '➕ Add New Menu Item'}</h3>
              <button className="mm-close" onClick={closeMenuModal}>✕</button>
            </div>

            <form onSubmit={handleMenuSubmit} className="mm-form">
              <div className="mm-row">
                <div className="mm-field">
                  <label>Item Name *</label>
                  <input
                    type="text"
                    value={menuForm.name}
                    onChange={e => setMenuForm({ ...menuForm, name: e.target.value })}
                    placeholder="e.g. Butter Chicken"
                    required
                  />
                </div>
                <div className="mm-field">
                  <label>Price (₹) *</label>
                  <input
                    type="number"
                    value={menuForm.price}
                    onChange={e => setMenuForm({ ...menuForm, price: e.target.value })}
                    placeholder="e.g. 299"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="mm-field">
                <label>Description</label>
                <textarea
                  value={menuForm.description}
                  onChange={e => setMenuForm({ ...menuForm, description: e.target.value })}
                  placeholder="Describe the dish..."
                  rows={3}
                />
              </div>

              <div className="mm-row">
                <div className="mm-field">
                  <label>Category *</label>
                  <select
                    value={menuForm.category}
                    onChange={e => setMenuForm({ ...menuForm, category: e.target.value })}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="mm-field">
                  <label>Prep Time (mins)</label>
                  <input
                    type="number"
                    value={menuForm.preparationTime}
                    onChange={e => setMenuForm({ ...menuForm, preparationTime: e.target.value })}
                    placeholder="e.g. 15"
                    min="1"
                  />
                </div>
              </div>

              <label className="mm-checkbox-label">
                <input
                  type="checkbox"
                  checked={menuForm.isAvailable}
                  onChange={e => setMenuForm({ ...menuForm, isAvailable: e.target.checked })}
                />
                <span>Available for ordering</span>
              </label>

              <div className="mm-actions">
                <button type="submit" className="mm-save-btn" disabled={loading.form}>
                  {loading.form
                    ? <><span className="spinner-sm-white" /> Saving...</>
                    : (editingItem ? '💾 Update Item' : '💾 Save Item')
                  }
                </button>
                <button type="button" className="mm-cancel-btn" onClick={closeMenuModal}>
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

/* Order Card */
const OrderCard = ({ order, onStatusChange, onDelete }) => {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;

  return (
    <div className={`order-card-admin ${cfg.cls}`}>
      <div className="oca-header">
        <div className="oca-id-info">
          <span className="oca-id">#{order.orderNumber}</span>
          <div className="oca-meta">
            <span>👤 {order.customerName}</span>
            <span>• 🪑 Table {order.tableId}</span>
            <span>• {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
        </div>
        <span className={`order-status-badge ${cfg.cls}`}>{cfg.label}</span>
      </div>

      <div className="oca-items">
        {order.items.map((item, i) => (
          <div key={i} className="oca-item">
            <span className="oca-item-qty">{item.quantity}×</span>
            <span className="oca-item-name">{item.name}</span>
            <span className="oca-item-price">₹{item.price * item.quantity}</span>
          </div>
        ))}
      </div>

      <div className="oca-footer">
        <div className="oca-payment">
          <span className={`payment-type-badge ${order.paymentType === 'online' ? 'pt-online' : 'pt-counter'}`}>
            {order.paymentType === 'online' ? '💳 Online' : '🏪 Counter'}
          </span>
          <span className={`payment-status-badge ${order.paymentStatus === 'paid' ? 'ps-paid' : 'ps-pending'}`}>
            {order.paymentStatus === 'paid' ? '✅ Paid' : '⏳ Unpaid'}
          </span>
        </div>
        <div className="oca-total">₹{order.totalAmount}</div>
      </div>

      <div className="oca-actions">
        {cfg.next && (
          <button
            className="oca-advance-btn"
            onClick={() => onStatusChange(order._id, cfg.next)}
          >
            → Mark as {STATUS_CONFIG[cfg.next]?.label}
          </button>
        )}
        <select
          value={order.status}
          onChange={e => onStatusChange(order._id, e.target.value)}
          className="oca-status-select"
        >
          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        <button className="oca-delete-btn" onClick={() => onDelete(order._id)} title="Delete">
          🗑️
        </button>
      </div>
    </div>
  );
};

/* Menu Admin Card */
const MenuAdminCard = ({ item, onEdit, onDelete }) => (
  <div className={`menu-admin-card ${!item.isAvailable ? 'unavailable-card' : ''}`}>
    <div className="mac-header">
      <div className="mac-cat-badge">{item.category}</div>
      <div className={`mac-avail ${item.isAvailable ? 'avail-yes' : 'avail-no'}`}>
        {item.isAvailable ? '● Available' : '● Unavailable'}
      </div>
    </div>
    <h3 className="mac-name">{item.name}</h3>
    <p className="mac-desc">{item.description || 'No description'}</p>
    <div className="mac-meta">
      <span className="mac-price">₹{item.price}</span>
      {item.preparationTime && (
        <span className="mac-prep">⏱️ {item.preparationTime} min</span>
      )}
    </div>
    <div className="mac-actions">
      <button className="mac-edit-btn" onClick={onEdit}>✏️ Edit</button>
      <button className="mac-delete-btn" onClick={onDelete}>🗑️ Delete</button>
    </div>
  </div>
);

export default AdminDashboard;
