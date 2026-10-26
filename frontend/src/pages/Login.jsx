import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCustomerProceed = (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast.error('Please enter your name to proceed to table selection');
      return;
    }
    setLoading(true);
    localStorage.setItem('customerName', customerName.trim());
    setTimeout(() => {
      navigate('/tables');
    }, 250);
  };

  const handleAdminPortal = () => {
    navigate('/admin/login');
  };

  return (
    <div className="login-page">
      {/* Top Navbar */}
      <header className="login-nav">
        <div className="nav-container">
          <div className="nav-brand">
            <span className="brand-badge">DISHDASH</span>
            <span className="brand-sub">Table Dining & Orders</span>
          </div>
          <button
            type="button"
            className="nav-admin-link"
            onClick={handleAdminPortal}
          >
            Admin Portal →
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="login-main">
        <div className="login-card-container">
          {/* Welcome Hero Banner */}
          <section className="login-header login-hero-banner">
            <div className="hero-img-backdrop">
              <img
                src="/images/food/chicken-biryani.jpg"
                alt="Artisanal Fine Dining"
                className="hero-bg-img"
              />
              <div className="hero-dark-overlay" />
            </div>
            <div className="hero-content">
              <span className="section-pill hero-pill">Fine Dining & Table Reservations</span>
              <h1 className="login-heading">Artisanal Cuisine, Timeless Hospitality</h1>
              <p className="login-subtext">
                Reserve your table, explore our chef's seasonal creations, and enjoy an unhurried dining experience prepared fresh upon order.
              </p>
              <div className="hero-highlights">
                <span className="hero-highlight-tag">Chef's Seasonal Menu</span>
                <span className="hero-highlight-tag">Guaranteed Table Booking</span>
                <span className="hero-highlight-tag">Attentive Table Service</span>
              </div>
            </div>
          </section>

          <div className="login-grid">
            {/* Customer Entry Card */}
            <div className="entry-card customer-entry">
              <div className="entry-header">
                <div className="entry-icon">🍽️</div>
                <div>
                  <h2 className="entry-title">Customer Dining</h2>
                  <p className="entry-desc">Start your order by entering your name</p>
                </div>
              </div>

              <form onSubmit={handleCustomerProceed} className="entry-form">
                <div className="form-group">
                  <label htmlFor="customerName" className="form-label">
                    Your Name
                  </label>
                  <input
                    id="customerName"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Rahul Sharma"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    maxLength={40}
                    autoFocus
                  />
                  <span className="form-hint">Used for order tracking and your table bill</span>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Opening Tables...' : 'Select Table & View Menu →'}
                </button>
              </form>
            </div>

            {/* Admin Quick Card */}
            <div className="entry-card admin-entry">
              <div className="entry-header">
                <div className="entry-icon">👨‍💼</div>
                <div>
                  <h2 className="entry-title">Restaurant Management</h2>
                  <p className="entry-desc">Kitchen staff & manager portal</p>
                </div>
              </div>

              <div className="admin-entry-body">
                <p className="admin-info-text">
                  Update item availability, track order preparation in real time, and oversee daily dining tables.
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleAdminPortal}
                >
                  Staff & Admin Login →
                </button>
              </div>
            </div>
          </div>

          <div className="login-footer-info">
            <div className="info-chip">✨ Fresh Ingredients</div>
            <div className="info-chip">⏱️ Fast Table Service</div>
            <div className="info-chip">📱 Contactless Ordering</div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;