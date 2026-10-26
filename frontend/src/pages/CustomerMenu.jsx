import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { formatTime12Hour } from './TableSelection';
import './CustomerMenu.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const CATEGORIES = [
  'All',
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

const DEFAULT_IMAGES = {
  // South Indian Specials
  'Kerala Parotta': '/images/food/kerala-parotta.jpg',
  'Parota': '/images/food/kerala-parotta.jpg',
  'Parotta': '/images/food/kerala-parotta.jpg',
  'Kothu Parotta': '/images/food/kothu-parotta.jpg',
  'Plain Dosa': '/images/food/plain-dosa.jpg',
  'Masala Dosa': '/images/food/masala-dosa.jpg',
  'Idli': '/images/food/idli.jpg',
  'Pongal': '/images/food/pongal.jpg',
  'Poori Masala': '/images/food/poori-masala.jpg',
  'Appam': '/images/food/appam.jpg',
  'Idiyappam': '/images/food/idiyappam.jpg',

  // Biryani & Rice
  'Chicken Biryani': '/images/food/chicken-biryani.jpg',
  'Biriyani': '/images/food/chicken-biryani.jpg',
  'Biryani': '/images/food/chicken-biryani.jpg',
  'Mutton Biryani': '/images/food/mutton-biryani.jpg',
  'Vegetable Biryani': '/images/food/vegetable-biryani.jpg',
  'Egg Biryani': '/images/food/egg-biryani.jpg',
  'Chicken Fried Rice': '/images/food/chicken-fried-rice.jpg',
  'Paneer Fried Rice': '/images/food/paneer-fried-rice.jpg',

  // Curries & Breads
  'Butter Chicken': '/images/food/butter-chicken.jpg',
  'Paneer Butter Masala': '/images/food/paneer-butter-masala.jpg',
  'Chicken Chettinad': '/images/food/chicken-chettinad.jpg',
  'Chapati': '/images/food/chapati.jpg',
  'Butter Naan': '/images/food/butter-naan.jpg',
  'Garlic Naan': '/images/food/garlic-naan.jpg',

  // Starters & Snacks
  'Chicken 65': '/images/food/chicken-65.jpg',
  'Gobi 65': '/images/food/gobi-65.jpg',
  'Paneer Tikka': '/images/food/paneer-tikka.jpg',
  'Samosa': '/images/food/samosa.jpg',
  'French Fries': '/images/food/french-fries.jpg',
  'Chicken Lollipop': '/images/food/chicken-lollipop.jpg',

  // Desserts & Drinks
  'Gulab Jamun': '/images/food/gulab-jamun.jpg',
  'Rasmalai': '/images/food/rasmalai.jpg',
  'Chocolate Brownie': '/images/food/chocolate-brownie.jpg',
  'Fresh Lime Juice': '/images/food/fresh-lime-juice.jpg',
  'Mango Lassi': '/images/food/mango-lassi.jpg',
  'Cold Coffee': '/images/food/cold-coffee.jpg',
  'Milkshakes': '/images/food/milkshakes.jpg',

  // Existing Retained Items
  'Garlic Bread': '/images/food/garlic-bread.jpg',
  'Margherita Pizza': '/images/food/margherita-pizza.jpg',
  "Chef's Special Pasta": '/images/food/chef-s-special-pasta.jpg',
  'Ice Cream Sundae': '/images/food/ice-cream-sundae.jpg',
  'Ice cream': '/images/food/ice-cream-sundae.jpg',
  'Fresh Lime Soda': '/images/food/fresh-lime-soda.jpg'
};

const NEUTRAL_FOOD_PLACEHOLDER = '/images/food/neutral-food-placeholder.jpg';

const CustomerMenu = () => {
  const { restaurantId, tableId } = useParams();
  const navigate = useNavigate();

  const [rawMenu, setRawMenu] = useState({});
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Feature 1: Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [dietaryFilter, setDietaryFilter] = useState('all'); // 'all', 'veg', 'non-veg'
  const [sortBy, setSortBy] = useState('default'); // 'default', 'price-asc', 'price-desc'
  const [activeReservation, setActiveReservation] = useState(null);

  const customerName = localStorage.getItem('customerName') || 'Guest Customer';

  useEffect(() => {
    const savedRes = localStorage.getItem('activeReservation');
    if (savedRes) {
      try {
        const parsed = JSON.parse(savedRes);
        if (String(parsed.tableId) === String(tableId)) {
          setActiveReservation(parsed);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [tableId]);

  const fetchMenu = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/menu/${restaurantId}`);
      setRawMenu(response.data || {});
    } catch (error) {
      toast.error('Unable to load menu. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Image resolver function
  const resolveDishImage = useCallback((item) => {
    if (item.image && typeof item.image === 'string' && item.image.trim()) {
      return item.image;
    }
    if (DEFAULT_IMAGES[item.name]) {
      return DEFAULT_IMAGES[item.name];
    }
    const lower = item.name.toLowerCase();
    const matchedKey = Object.keys(DEFAULT_IMAGES).find(k => k.toLowerCase() === lower);
    if (matchedKey) return DEFAULT_IMAGES[matchedKey];
    return NEUTRAL_FOOD_PLACEHOLDER;
  }, []);

  // Flatten all menu items
  const allItems = useMemo(() => {
    const items = [];
    Object.entries(rawMenu).forEach(([cat, list]) => {
      list.forEach(item => {
        items.push({
          ...item,
          category: item.category || cat,
          subCategory: item.subCategory,
          image: resolveDishImage(item)
        });
      });
    });
    return items;
  }, [rawMenu, resolveDishImage]);

  // Combined Filtering and Sorting
  const filteredItems = useMemo(() => {
    let result = [...allItems];

    // Search query filter (matches name, description, category, subCategory)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item =>
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.subCategory && item.subCategory.toLowerCase().includes(q))
      );
    }

    // Category / SubCategory filter
    if (activeCategory !== 'All') {
      result = result.filter(item => {
        if (item.category === activeCategory) return true;
        if (item.subCategory === activeCategory) return true;
        if (activeCategory === 'Specials' && (item.category === 'Specials' || item.subCategory === 'South Indian Specials')) return true;
        if (activeCategory === 'South Indian Specials' && (item.category === 'Specials' || item.subCategory === 'South Indian Specials')) return true;
        if (activeCategory === 'Main Course' && (item.category === 'Main Course' || item.subCategory === 'Biryani & Rice' || item.subCategory === 'Curries & Breads')) return true;
        if (activeCategory === 'Biryani & Rice' && item.subCategory === 'Biryani & Rice') return true;
        if (activeCategory === 'Curries & Breads' && item.subCategory === 'Curries & Breads') return true;
        if (activeCategory === 'Appetizers' && (item.category === 'Appetizers' || item.subCategory === 'Starters & Snacks')) return true;
        if (activeCategory === 'Starters & Snacks' && (item.category === 'Appetizers' || item.subCategory === 'Starters & Snacks')) return true;
        if (activeCategory === 'Desserts' && (item.category === 'Desserts' || item.subCategory === 'Desserts & Drinks')) return true;
        if (activeCategory === 'Beverages' && (item.category === 'Beverages' || item.subCategory === 'Desserts & Drinks')) return true;
        if (activeCategory === 'Desserts & Drinks' && (item.category === 'Desserts' || item.category === 'Beverages' || item.subCategory === 'Desserts & Drinks')) return true;
        return false;
      });
    }

    // Dietary filter
    if (dietaryFilter === 'veg') {
      result = result.filter(item => item.isVegetarian !== false);
    } else if (dietaryFilter === 'non-veg') {
      result = result.filter(item => item.isVegetarian === false);
    }

    // Sorting
    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }, [allItems, searchQuery, activeCategory, dietaryFilter, sortBy]);

  // Group filtered items by subCategory or category for structured display
  const groupedFilteredItems = useMemo(() => {
    const groups = {};
    filteredItems.forEach(item => {
      const sectionHeader = (activeCategory === 'All')
        ? (item.subCategory || item.category || 'Specials')
        : (item.category || item.subCategory || 'Specials');
      if (!groups[sectionHeader]) groups[sectionHeader] = [];
      groups[sectionHeader].push(item);
    });
    return groups;
  }, [filteredItems, activeCategory]);

  const resetFilters = () => {
    setSearchQuery('');
    setActiveCategory('All');
    setDietaryFilter('all');
    setSortBy('default');
  };

  // Cart operations
  const addToCart = (item) => {
    if (item.isAvailable === false) {
      toast.error(`"${item.name}" is currently unavailable / sold out.`);
      return;
    }
    setCart(prev => {
      const existing = prev.find(ci => ci._id === item._id);
      if (existing) {
        toast.success(`Increased ${item.name} quantity to ${existing.quantity + 1}`, { autoClose: 1200 });
        return prev.map(ci =>
          ci._id === item._id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      toast.success(`Added ${item.name} to cart`, { autoClose: 1200 });
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

  const handlePlaceOrder = async (paymentType) => {
    if (cart.length === 0) {
      toast.error('Your cart is empty. Add items from the menu first.');
      return;
    }

    // Check availability on cart items before submitting
    const hasUnavailable = cart.some(ci => ci.isAvailable === false);
    if (hasUnavailable) {
      toast.error('Your cart contains an item that is currently unavailable. Please remove it to proceed.');
      return;
    }

    setPlacingOrder(true);
    try {
      const orderPayload = {
        restaurantId,
        tableId,
        customerName,
        customerPhone: activeReservation?.customerPhone || localStorage.getItem('customerPhone'),
        reservationId: activeReservation?._id,
        reservationNumber: activeReservation?.reservationNumber,
        items: cart.map(i => ({
          _id: i._id,
          name: i.name,
          quantity: i.quantity,
          category: i.category,
        })),
        paymentType,
      };

      const response = await axios.post(`${API}/api/orders`, orderPayload);

      // Save order info locally for quick retrieval & live polling
      localStorage.setItem('lastOrder', JSON.stringify(response.data));
      localStorage.removeItem('activeReservation');

      setShowPaymentModal(false);
      setCart([]);
      toast.success(
        activeReservation
          ? 'Pre-order placed & scheduled for your reservation arrival!'
          : 'Order placed successfully! Sending to the kitchen...'
      );
      navigate('/order-confirmation');
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to place order. Please try again.';
      toast.error(msg);
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="menu-loading-state">
        <div className="spinner-plate" />
        <p>Loading DISHDASH Menu...</p>
      </div>
    );
  }

  return (
    <div className="customer-menu-page">
      {/* Top Navigation */}
      <header className="menu-navbar">
        <div className="menu-nav-inner">
          <div className="nav-left">
            <button
              type="button"
              onClick={() => navigate('/tables')}
              className="btn-nav-back"
            >
              ← Tables
            </button>
            <div className="brand-group">
              <span className="brand-logo">DISHDASH</span>
              <div className="table-badge">
                <span>Table {tableId}</span>
                <span className="nav-sep">•</span>
                <span className="customer-highlight">{customerName}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`btn-cart-toggle ${cart.length > 0 ? 'active' : ''}`}
            onClick={() => setShowCart(!showCart)}
          >
            <span>🛒</span>
            <span className="cart-label">Cart</span>
            {getTotalItems() > 0 && (
              <span className="cart-count-badge">{getTotalItems()}</span>
            )}
            {cart.length > 0 && (
              <span className="cart-total-badge">₹{getTotalAmount()}</span>
            )}
          </button>
        </div>
      </header>

      {/* Linked Reservation Pre-Order Notice */}
      {activeReservation && (
        <div className="preorder-active-banner">
          <div className="pab-left">
            <span className="pab-icon">🍽️</span>
            <div>
              <strong>Pre-Ordering for Reservation #{activeReservation.reservationNumber}</strong>
              <span className="pab-details">
                Table {activeReservation.tableId} • {activeReservation.reservationDate} at {formatTime12Hour(activeReservation.timeSlot)} ({activeReservation.guestCount} Guests)
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-pab-clear"
            onClick={() => {
              setActiveReservation(null);
              localStorage.removeItem('activeReservation');
              toast.info('Switched to instant walk-in order mode.');
            }}
          >
            Switch to Walk-in Mode
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <section className="filter-section">
        <div className="filter-container">
          {/* Search Row */}
          <div className="search-row">
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search dishes by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort & Dietary Controls */}
            <div className="filter-controls-right">
              {/* Veg / Non-Veg Toggle */}
              <div className="dietary-pills">
                <button
                  type="button"
                  className={`diet-btn ${dietaryFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setDietaryFilter('all')}
                >
                  All Food
                </button>
                <button
                  type="button"
                  className={`diet-btn diet-veg ${dietaryFilter === 'veg' ? 'active' : ''}`}
                  onClick={() => setDietaryFilter('veg')}
                >
                  🟢 Pure Veg
                </button>
                <button
                  type="button"
                  className={`diet-btn diet-nonveg ${dietaryFilter === 'non-veg' ? 'active' : ''}`}
                  onClick={() => setDietaryFilter('non-veg')}
                >
                  🔴 Non-Veg
                </button>
              </div>

              {/* Price Sort Dropdown */}
              <div className="sort-select-wrap">
                <label htmlFor="priceSort" className="sort-label">Sort:</label>
                <select
                  id="priceSort"
                  className="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="default">Default</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="category-scroll">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Layout: Menu + Cart Sidebar */}
      <div className="menu-content-shell">
        <main className="menu-items-column">
          {/* Empty state when filters return no dishes */}
          {filteredItems.length === 0 ? (
            <div className="empty-filter-state">
              <div className="empty-filter-icon">🍽️</div>
              <h3>No dishes match your filters</h3>
              <p>We couldn't find any menu items matching your search criteria.</p>
              <button
                type="button"
                className="btn-reset-filters"
                onClick={resetFilters}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            Object.entries(groupedFilteredItems).map(([category, items]) => (
              <section key={category} className="menu-category-section">
                <div className="section-title-row">
                  <h2 className="section-title">{category}</h2>
                  <span className="section-item-count">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
                </div>

                <div className="dishes-grid">
                  {items.map(dish => {
                    const qty = getCartQuantity(dish._id);
                    const isAvailable = dish.isAvailable !== false;

                    return (
                      <article
                        key={dish._id}
                        className={`dish-card ${!isAvailable ? 'card-unavailable' : ''} ${qty > 0 ? 'card-in-cart' : ''}`}
                      >
                        {/* Dish Photo */}
                        <div className="dish-img-wrap">
                          <img
                            src={dish.image}
                            alt={dish.name}
                            className="dish-img"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = NEUTRAL_FOOD_PLACEHOLDER;
                            }}
                          />
                          {/* Dietary Tag */}
                          <div className={`dietary-badge ${dish.isVegetarian !== false ? 'badge-veg' : 'badge-nonveg'}`}>
                            <span className="diet-dot" />
                          </div>

                          {/* Availability Tag */}
                          {!isAvailable && (
                            <div className="unavailable-overlay-badge">
                              Sold Out
                            </div>
                          )}
                        </div>

                        {/* Dish Info */}
                        <div className="dish-details">
                          <div className="dish-title-row">
                            <h3 className="dish-name">{dish.name}</h3>
                            <span className="dish-price">₹{dish.price}</span>
                          </div>

                          <p className="dish-desc">{dish.description || 'Prepared fresh upon order'}</p>

                          <div className="dish-meta">
                            {dish.preparationTime && (
                              <span className="prep-time">⏱️ {dish.preparationTime} mins</span>
                            )}
                            {dish.subCategory && (
                              <span className="subcategory-tag">{dish.subCategory}</span>
                            )}
                            <span className="category-tag">{dish.category}</span>
                            {!isAvailable && (
                              <span className="status-soldout-label">● Currently Unavailable</span>
                            )}
                          </div>

                          {/* Add / Quantity Button */}
                          <div className="dish-action-row">
                            {!isAvailable ? (
                              <button
                                type="button"
                                className="btn-add-disabled"
                                disabled
                              >
                                Unavailable
                              </button>
                            ) : qty === 0 ? (
                              <button
                                type="button"
                                className="btn-add-dish"
                                onClick={() => addToCart(dish)}
                              >
                                + Add to Order
                              </button>
                            ) : (
                              <div className="qty-picker">
                                <button
                                  type="button"
                                  className="qty-btn"
                                  onClick={() => updateQuantity(dish._id, -1)}
                                  aria-label="Decrease quantity"
                                >
                                  −
                                </button>
                                <span className="qty-value">{qty}</span>
                                <button
                                  type="button"
                                  className="qty-btn"
                                  onClick={() => updateQuantity(dish._id, 1)}
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </main>

        {/* Desktop Sticky Cart Sidebar */}
        <aside className={`cart-sidebar-container ${showCart ? 'drawer-open' : ''}`}>
          <CartPanel
            cart={cart}
            tableId={tableId}
            customerName={customerName}
            getTotalAmount={getTotalAmount}
            getTotalItems={getTotalItems}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            onCheckout={() => setShowPaymentModal(true)}
            onClose={() => setShowCart(false)}
          />
        </aside>
      </div>

      {/* Mobile Cart Overlay */}
      {showCart && (
        <div className="mobile-cart-overlay" onClick={() => setShowCart(false)}>
          <div className="mobile-cart-sheet" onClick={(e) => e.stopPropagation()}>
            <CartPanel
              cart={cart}
              tableId={tableId}
              customerName={customerName}
              getTotalAmount={getTotalAmount}
              getTotalItems={getTotalItems}
              updateQuantity={updateQuantity}
              removeFromCart={removeFromCart}
              onCheckout={() => {
                setShowCart(false);
                setShowPaymentModal(true);
              }}
              onClose={() => setShowCart(false)}
            />
          </div>
        </div>
      )}

      {/* Floating Bottom Cart Bar on Mobile */}
      {cart.length > 0 && !showCart && (
        <div className="mobile-bottom-cart-bar">
          <div className="mbc-summary">
            <span className="mbc-qty">{getTotalItems()} {getTotalItems() === 1 ? 'item' : 'items'}</span>
            <span className="mbc-total">₹{getTotalAmount()}</span>
          </div>
          <button
            type="button"
            className="mbc-btn-view"
            onClick={() => setShowCart(true)}
          >
            View Cart 🛒
          </button>
        </div>
      )}

      {/* Transparent Payment Modal (Clearly Labeled as Simulated) */}
      {showPaymentModal && (
        <PaymentModal
          totalAmount={getTotalAmount()}
          itemsCount={getTotalItems()}
          tableId={tableId}
          customerName={customerName}
          onPay={handlePlaceOrder}
          onClose={() => setShowPaymentModal(false)}
          loading={placingOrder}
        />
      )}
    </div>
  );
};

// Reusable Clean Cart Panel Component
const CartPanel = ({
  cart,
  tableId,
  customerName,
  getTotalAmount,
  getTotalItems,
  updateQuantity,
  removeFromCart,
  onCheckout,
  onClose,
}) => (
  <div className="cart-card">
    <div className="cart-header">
      <div>
        <h3 className="cart-heading">Your Order</h3>
        <span className="cart-sub">
          Table {tableId} • {customerName}
        </span>
      </div>
      {onClose && (
        <button type="button" className="cart-close-btn" onClick={onClose} aria-label="Close cart">
          ✕
        </button>
      )}
    </div>

    {cart.length === 0 ? (
      <div className="cart-empty-box">
        <span className="empty-cart-icon">🛒</span>
        <p className="empty-cart-text">Your cart is currently empty</p>
        <span className="empty-cart-hint">Add items from the menu to build your table order</span>
      </div>
    ) : (
      <>
        <div className="cart-items-scroll">
          {cart.map(item => (
            <div key={item._id} className="cart-row">
              <div className="cr-top">
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="cr-thumb"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div className="cr-info">
                  <span className="cr-name">{item.name}</span>
                  <span className="cr-rate">₹{item.price} each</span>
                </div>
              </div>

              <div className="cr-actions">
                <div className="cr-qty-pill">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item._id, -1)}
                    className="cr-btn"
                    aria-label="Decrease"
                  >
                    −
                  </button>
                  <span className="cr-qty">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item._id, 1)}
                    className="cr-btn"
                    aria-label="Increase"
                  >
                    +
                  </button>
                </div>
                <span className="cr-item-total">₹{item.price * item.quantity}</span>
                <button
                  type="button"
                  className="cr-delete-btn"
                  onClick={() => removeFromCart(item._id)}
                  title="Remove item"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="cart-summary-box">
          <div className="summary-line">
            <span>Items ({getTotalItems()})</span>
            <span>₹{getTotalAmount()}</span>
          </div>
          <div className="summary-line">
            <span>Taxes & Service</span>
            <span className="tax-inclusive">Inclusive</span>
          </div>
          <div className="summary-line total-line">
            <span>Bill Total</span>
            <span className="bill-total-price">₹{getTotalAmount()}</span>
          </div>

          <button
            type="button"
            className="btn-checkout"
            onClick={onCheckout}
          >
            Confirm & Select Payment →
          </button>
        </div>
      </>
    )}
  </div>
);

// Payment Selection Modal (Honest, Simulated Demo Flow)
const PaymentModal = ({
  totalAmount,
  itemsCount,
  tableId,
  customerName,
  onPay,
  onClose,
  loading,
}) => (
  <div className="modal-backdrop" onClick={onClose}>
    <div className="payment-dialog" onClick={(e) => e.stopPropagation()}>
      <div className="dialog-header">
        <div>
          <h3 className="dialog-title">Choose Payment Method</h3>
          <p className="dialog-subtitle">Table {tableId} • {customerName} ({itemsCount} items)</p>
        </div>
        <button type="button" className="dialog-close" onClick={onClose} disabled={loading}>
          ✕
        </button>
      </div>

      <div className="dialog-bill-banner">
        <span className="bill-label">Total Amount Payable</span>
        <span className="bill-amount">₹{totalAmount}</span>
      </div>

      {/* Simulated Payment Notice */}
      <div className="simulation-notice-box">
        <span className="notice-icon">ℹ️</span>
        <div className="notice-text">
          <strong>Demonstration Mode:</strong> Online payment is simulated for this evaluation project. No actual bank charges will be made.
        </div>
      </div>

      <div className="payment-options-list">
        <button
          type="button"
          className="payment-opt-card"
          onClick={() => onPay('online')}
          disabled={loading}
        >
          <div className="opt-icon">💳</div>
          <div className="opt-details">
            <span className="opt-title">Simulated Online Payment</span>
            <span className="opt-desc">Instant confirmation (UPI / Cards / Net Banking demo)</span>
          </div>
          <span className="opt-arrow">→</span>
        </button>

        <button
          type="button"
          className="payment-opt-card"
          onClick={() => onPay('offline')}
          disabled={loading}
        >
          <div className="opt-icon">🏪</div>
          <div className="opt-details">
            <span className="opt-title">Pay at Counter</span>
            <span className="opt-desc">Settle your bill with cash or card directly with staff</span>
          </div>
          <span className="opt-arrow">→</span>
        </button>
      </div>

      {loading && (
        <div className="dialog-loading-overlay">
          <div className="spinner-plate" />
          <p>Sending order to kitchen...</p>
        </div>
      )}

      <div className="dialog-footer">
        <button
          type="button"
          className="btn-cancel-dialog"
          onClick={onClose}
          disabled={loading}
        >
          Back to Menu
        </button>
      </div>
    </div>
  </div>
);

export default CustomerMenu;
