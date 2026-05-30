import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import './CustomerMenu.css';

const API = 'http://localhost:4000';

const CATEGORY_ICONS = {
  'Appetizers': '🍟',
  'Main Course': '🍕',
  'Desserts': '🍰',
  'Beverages': '🥤',
  'Specials': '⭐',
};

const CustomerMenu = () => {
  const { restaurantId, tableId } = useParams();
  const navigate = useNavigate();
  const [menu, setMenu] = useState({});
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const customerName = localStorage.getItem('customerName') || 'Customer';
  const categories = ['All', ...Object.keys(menu)];

  const fetchMenu = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/menu/${restaurantId}`);
      setMenu(response.data);
    } catch (error) {
      toast.error('Failed to load menu. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Cart helpers
  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(ci => ci._id === item._id);
      if (existing) {
        toast.success(`Added another ${item.name}`, { autoClose: 1500 });
        return prev.map(ci =>
          ci._id === item._id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      toast.success(`${item.name} added to cart`, { autoClose: 1500 });
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(i => i._id !== itemId));
  };

  const updateQuantity = (itemId, delta) => {
    setCart(prev => {
      const updated = prev.map(i =>
        i._id === itemId ? { ...i, quantity: i.quantity + delta } : i
      );
      return updated.filter(i => i.quantity > 0);
    });
  };

  const getTotalAmount = () =>
    cart.reduce((total, item) => total + item.price * item.quantity, 0);

  const getTotalItems = () =>
    cart.reduce((total, item) => total + item.quantity, 0);

  const getCartQuantity = (itemId) => {
    const item = cart.find(ci => ci._id === itemId);
    return item ? item.quantity : 0;
  };

  const placeOrder = async (paymentType) => {
    if (cart.length === 0) {
      toast.error('Your cart is empty!');
      return;
    }

    setPlacingOrder(true);
    try {
      const orderData = {
        restaurantId,
        tableId,
        customerName,
        items: cart.map(i => ({
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          category: i.category,
        })),
        totalAmount: getTotalAmount(),
        paymentType,
      };

      const response = await axios.post(`${API}/api/orders`, orderData);

      // Save order details for confirmation page
      localStorage.setItem('lastOrder', JSON.stringify({
        ...response.data,
        paymentType,
      }));

      setShowPaymentModal(false);
      setCart([]);
      navigate('/order-confirmation');
    } catch (error) {
      toast.error('Failed to place order. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  const getMenuItems = () => {
    if (activeCategory === 'All') {
      return Object.entries(menu);
    }
    return menu[activeCategory] ? [[activeCategory, menu[activeCategory]]] : [];
  };

  if (loading) {
    return (
      <div className="menu-loading">
        <div className="loading-plate">🍽️</div>
        <div className="loading-dots">
          <span /><span /><span />
        </div>
        <p>Loading your menu...</p>
      </div>
    );
  }

  return (
    <div className="menu-page">
      {/* Header */}
      <header className="menu-header">
        <div className="menu-header-inner">
          <div className="mh-left">
            <button onClick={() => navigate('/tables')} className="back-btn-sm">
              ← Tables
            </button>
            <div className="mh-brand">
              <span>🍽️ Food Heaven</span>
              <span className="mh-info">
                <span className="mh-customer">{customerName}</span>
                <span className="mh-sep">•</span>
                <span className="mh-table">Table {tableId}</span>
              </span>
            </div>
          </div>

          <button
            className={`cart-toggle-btn ${cart.length > 0 ? 'has-items' : ''}`}
            onClick={() => setShowCart(!showCart)}
          >
            <span className="cart-icon-emoji">🛒</span>
            <span className="cart-toggle-text">Cart</span>
            {getTotalItems() > 0 && (
              <span className="cart-badge">{getTotalItems()}</span>
            )}
            {cart.length > 0 && (
              <span className="cart-total-label">₹{getTotalAmount()}</span>
            )}
          </button>
        </div>
      </header>

      {/* Category Tabs */}
      <div className="category-nav">
        <div className="category-nav-inner">
          {categories.map(cat => (
            <button
              key={cat}
              className={`cat-tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat !== 'All' && CATEGORY_ICONS[cat] ? `${CATEGORY_ICONS[cat]} ` : ''}
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout */}
      <div className="menu-layout">
        {/* Menu Items */}
        <div className="menu-items-area">
          {getMenuItems().map(([category, items]) => (
            <div key={category} className="menu-category-block">
              <div className="category-heading">
                <span className="cat-icon">{CATEGORY_ICONS[category] || '🍴'}</span>
                <h2>{category}</h2>
                <span className="cat-count">{items.length} items</span>
              </div>

              <div className="menu-grid">
                {items.map(item => {
                  const qty = getCartQuantity(item._id);
                  return (
                    <div key={item._id} className={`menu-card ${qty > 0 ? 'in-cart' : ''}`}>
                      <div className="menu-card-top">
                        <div className="menu-card-icon">
                          {CATEGORY_ICONS[item.category] || '🍴'}
                        </div>
                        {qty > 0 && (
                          <div className="in-cart-badge">{qty} in cart</div>
                        )}
                      </div>
                      <h3 className="menu-card-name">{item.name}</h3>
                      <p className="menu-card-desc">{item.description}</p>
                      <div className="menu-card-meta">
                        {item.preparationTime && (
                          <span className="prep-badge">⏱️ {item.preparationTime} min</span>
                        )}
                        <span className="cat-badge">{item.category}</span>
                      </div>
                      <div className="menu-card-footer">
                        <span className="menu-price">₹{item.price}</span>
                        {qty === 0 ? (
                          <button
                            className="add-btn"
                            onClick={() => addToCart(item)}
                          >
                            + Add
                          </button>
                        ) : (
                          <div className="qty-controls">
                            <button
                              className="qty-btn"
                              onClick={() => updateQuantity(item._id, -1)}
                            >
                              −
                            </button>
                            <span className="qty-num">{qty}</span>
                            <button
                              className="qty-btn qty-plus"
                              onClick={() => updateQuantity(item._id, 1)}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Cart (Desktop) */}
        <aside className={`cart-sidebar ${showCart ? 'show' : ''}`}>
          <CartPanel
            cart={cart}
            getTotalAmount={getTotalAmount}
            getTotalItems={getTotalItems}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            onCheckout={() => setShowPaymentModal(true)}
            customerName={customerName}
            tableId={tableId}
          />
        </aside>
      </div>

      {/* Mobile Cart Overlay */}
      {showCart && (
        <div className="cart-overlay" onClick={() => setShowCart(false)}>
          <div className="cart-drawer" onClick={e => e.stopPropagation()}>
            <button className="cart-close" onClick={() => setShowCart(false)}>✕</button>
            <CartPanel
              cart={cart}
              getTotalAmount={getTotalAmount}
              getTotalItems={getTotalItems}
              updateQuantity={updateQuantity}
              removeFromCart={removeFromCart}
              onCheckout={() => {
                setShowCart(false);
                setShowPaymentModal(true);
              }}
              customerName={customerName}
              tableId={tableId}
            />
          </div>
        </div>
      )}

      {/* Mobile Bottom Bar */}
      {cart.length > 0 && !showCart && (
        <div className="mobile-cart-bar">
          <div className="mcb-info">
            <span className="mcb-count">{getTotalItems()} items</span>
            <span className="mcb-total">₹{getTotalAmount()}</span>
          </div>
          <button className="mcb-btn" onClick={() => setShowCart(true)}>
            View Cart 🛒
          </button>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          totalAmount={getTotalAmount()}
          onPay={placeOrder}
          onClose={() => setShowPaymentModal(false)}
          loading={placingOrder}
        />
      )}
    </div>
  );
};

// Cart Panel Component
const CartPanel = ({ cart, getTotalAmount, getTotalItems, updateQuantity, removeFromCart, onCheckout, customerName, tableId }) => (
  <div className="cart-panel">
    <div className="cart-panel-header">
      <h3>🛒 Your Order</h3>
      <span className="cart-item-count">{getTotalItems()} items</span>
    </div>

    <div className="cart-customer-info">
      <span>👤 {customerName}</span>
      <span>• 🪑 Table {tableId}</span>
    </div>

    {cart.length === 0 ? (
      <div className="cart-empty">
        <div className="empty-icon">🛒</div>
        <p>Your cart is empty</p>
        <small>Add items from the menu</small>
      </div>
    ) : (
      <>
        <div className="cart-items-list">
          {cart.map(item => (
            <div key={item._id} className="cart-item-row">
              <div className="ci-info">
                <span className="ci-name">{item.name}</span>
                <span className="ci-price">₹{item.price} × {item.quantity}</span>
              </div>
              <div className="ci-controls">
                <button className="ci-btn" onClick={() => updateQuantity(item._id, -1)}>−</button>
                <span className="ci-qty">{item.quantity}</span>
                <button className="ci-btn" onClick={() => updateQuantity(item._id, 1)}>+</button>
                <button className="ci-remove" onClick={() => removeFromCart(item._id)}>🗑️</button>
              </div>
              <div className="ci-subtotal">₹{item.price * item.quantity}</div>
            </div>
          ))}
        </div>

        <div className="cart-summary-section">
          <div className="summary-row">
            <span>Subtotal</span>
            <span>₹{getTotalAmount()}</span>
          </div>
          <div className="summary-row">
            <span>Taxes & Fees</span>
            <span className="free-tag">Included</span>
          </div>
          <div className="summary-row total-row">
            <span>Total Amount</span>
            <span>₹{getTotalAmount()}</span>
          </div>
          <button className="checkout-btn" onClick={onCheckout}>
            Proceed to Payment 💳
          </button>
        </div>
      </>
    )}
  </div>
);

// Payment Modal
const PaymentModal = ({ totalAmount, onPay, onClose, loading }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="payment-modal" onClick={e => e.stopPropagation()}>
      <div className="pm-header">
        <h3>💳 Choose Payment Method</h3>
        <button className="pm-close" onClick={onClose}>✕</button>
      </div>

      <div className="pm-total">
        <span>Order Total</span>
        <span className="pm-amount">₹{totalAmount}</span>
      </div>

      <div className="pm-options">
        <button
          className="pm-option online"
          onClick={() => onPay('online')}
          disabled={loading}
        >
          <div className="pm-option-icon">💳</div>
          <div className="pm-option-info">
            <strong>Pay Online</strong>
            <small>UPI, Cards, Wallets</small>
          </div>
          <span className="pm-arrow">→</span>
        </button>

        <button
          className="pm-option counter"
          onClick={() => onPay('offline')}
          disabled={loading}
        >
          <div className="pm-option-icon">🏪</div>
          <div className="pm-option-info">
            <strong>Pay at Counter</strong>
            <small>Cash or Card at desk</small>
          </div>
          <span className="pm-arrow">→</span>
        </button>
      </div>

      {loading && (
        <div className="pm-loading">
          <div className="spinner-lg" />
          <p>Processing your order...</p>
        </div>
      )}

      <p className="pm-secure">🔒 100% Secure Payment</p>
    </div>
  </div>
);

export default CustomerMenu;
