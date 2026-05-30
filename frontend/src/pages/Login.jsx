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
      toast.error('Please enter your name to continue');
      return;
    }
    setLoading(true);
    localStorage.setItem('customerName', customerName.trim());
    setTimeout(() => {
      navigate('/tables');
    }, 600);
  };

  const handleAdminPortal = () => {
    navigate('/admin/login');
  };

  return (
    <div className="login-page">
      {/* Animated background particles */}
      <div className="bg-particles">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`particle particle-${i + 1}`} />
        ))}
      </div>

      <div className="login-wrapper">
        {/* Hero Left */}
        <div className="login-hero">
          <div className="hero-badge">🌟 Premium Dining Experience</div>
          <h1 className="hero-title">
            Food<span className="brand-accent">Heaven</span>
          </h1>
          <p className="hero-tagline">
            Where Every Bite is a Journey of Flavor
          </p>
          <div className="hero-features">
            <div className="feature-item">
              <span className="feature-icon">🍽️</span>
              <span>200+ Menu Items</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⚡</span>
              <span>Fast Ordering</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💳</span>
              <span>Easy Payments</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📊</span>
              <span>Real-time Tracking</span>
            </div>
          </div>
          <div className="hero-decoration">
            <span className="food-float">🍕</span>
            <span className="food-float delay-1">🍜</span>
            <span className="food-float delay-2">🍣</span>
            <span className="food-float delay-3">🍰</span>
          </div>
        </div>

        {/* Right: Action Cards */}
        <div className="login-cards">
          <div className="cards-header">
            <h2>Welcome Back!</h2>
            <p>How would you like to proceed?</p>
          </div>

          {/* Customer Card */}
          <div className="action-card customer-card">
            <div className="card-icon">
              <span>👥</span>
            </div>
            <div className="card-content">
              <h3>Customer Order</h3>
              <p>Browse menu, place orders and enjoy your meal</p>

              <form onSubmit={handleCustomerProceed} className="name-form">
                <div className="input-wrapper">
                  <span className="input-icon">👤</span>
                  <input
                    type="text"
                    placeholder="Enter your name to continue..."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    maxLength={40}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="proceed-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="btn-loading">
                      <span className="spinner" />
                      Processing...
                    </span>
                  ) : (
                    <>
                      🍽️ Start Ordering
                      <span className="btn-arrow">→</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Divider */}
          <div className="divider">
            <span>or</span>
          </div>

          {/* Admin Card */}
          <div className="action-card admin-card" onClick={handleAdminPortal}>
            <div className="card-icon admin-icon">
              <span>👨‍💼</span>
            </div>
            <div className="card-content">
              <h3>Admin Portal</h3>
              <p>Manage menu, orders & monitor restaurant performance</p>
              <button type="button" className="admin-btn">
                🔐 Admin Login
                <span className="btn-arrow">→</span>
              </button>
            </div>
          </div>

          <p className="footer-note">
            🔒 Secure • Fast • Reliable Restaurant Management
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;