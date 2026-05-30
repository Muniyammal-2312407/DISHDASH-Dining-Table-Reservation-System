import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import './AdminLogin.css';

const API = 'http://localhost:4000';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    restaurantName: '',
    phone: '',
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email format';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 6) errs.password = 'At least 6 characters';

    if (!isLogin) {
      if (!form.username) errs.username = 'Username is required';
      if (!form.restaurantName) errs.restaurantName = 'Restaurant name is required';
      if (form.password !== form.confirmPassword)
        errs.confirmPassword = 'Passwords do not match';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const payload = isLogin
        ? { email: form.email, password: form.password }
        : {
            username: form.username,
            email: form.email,
            password: form.password,
            restaurantName: form.restaurantName,
            phone: form.phone,
          };

      const response = await axios.post(`${API}${endpoint}`, payload);

      localStorage.setItem('adminToken', response.data.token);
      localStorage.setItem('adminInfo', JSON.stringify(response.data.admin));

      toast.success(
        isLogin ? `Welcome back, ${response.data.admin.username}! 👋` : 'Account created! Welcome aboard! 🎉'
      );
      navigate('/admin');
    } catch (error) {
      toast.error(error.response?.data?.message || `${isLogin ? 'Login' : 'Signup'} failed`);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    try {
      await axios.post(`${API}/api/seed-data`);
      toast.success('Sample data created! Use: admin@foodheaven.com / admin123');
    } catch {
      toast.error('Failed to create sample data');
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setErrors({});
    setForm({ username: '', email: '', password: '', confirmPassword: '', restaurantName: '', phone: '' });
  };

  return (
    <div className="admin-login-page">
      <div className="al-bg-glow" />

      {/* Back button */}
      <button className="al-back-btn" onClick={() => navigate('/')}>
        ← Back to Home
      </button>

      <div className="al-container">
        {/* Left Panel */}
        <div className="al-left">
          <div className="al-logo">
            <span className="al-logo-icon">👨‍💼</span>
            <h1>Admin Portal</h1>
          </div>
          <p className="al-description">
            Manage your restaurant operations, menu items, orders, and track real-time performance all from one dashboard.
          </p>

          <div className="al-features">
            <div className="al-feature">
              <span>📊</span>
              <div>
                <strong>Dashboard Analytics</strong>
                <p>Real-time revenue and order tracking</p>
              </div>
            </div>
            <div className="al-feature">
              <span>🍽️</span>
              <div>
                <strong>Menu Management</strong>
                <p>Add, edit and manage menu items</p>
              </div>
            </div>
            <div className="al-feature">
              <span>📦</span>
              <div>
                <strong>Order Control</strong>
                <p>Track and update order statuses</p>
              </div>
            </div>
          </div>

          {/* Demo Credentials */}
          <div className="al-demo-box">
            <p className="demo-label">🔑 Demo Admin Credentials</p>
            <div className="demo-creds">
              <span>📧 admin@foodheaven.com</span>
              <span>🔒 admin123</span>
            </div>
            <button className="seed-btn" onClick={handleSeedData}>
              🗃️ Create Sample Data First
            </button>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="al-right">
          <div className="al-form-card">
            {/* Tab Toggle */}
            <div className="al-tabs">
              <button
                className={`al-tab ${isLogin ? 'active' : ''}`}
                onClick={() => setIsLogin(true)}
              >
                🔐 Login
              </button>
              <button
                className={`al-tab ${!isLogin ? 'active' : ''}`}
                onClick={() => setIsLogin(false)}
              >
                📝 Sign Up
              </button>
            </div>

            <div className="al-form-header">
              <h2>{isLogin ? 'Welcome Back!' : 'Create Account'}</h2>
              <p>{isLogin ? 'Sign in to your admin account' : 'Set up your restaurant admin'}</p>
            </div>

            <form onSubmit={handleSubmit} className="al-form">
              {/* Signup-only fields */}
              {!isLogin && (
                <>
                  <div className="al-field">
                    <label>Username *</label>
                    <div className={`al-input-wrap ${errors.username ? 'error' : ''}`}>
                      <span className="al-input-icon">👤</span>
                      <input
                        type="text"
                        name="username"
                        value={form.username}
                        onChange={handleChange}
                        placeholder="Choose a username"
                      />
                    </div>
                    {errors.username && <span className="al-error">{errors.username}</span>}
                  </div>

                  <div className="al-field">
                    <label>Restaurant Name *</label>
                    <div className={`al-input-wrap ${errors.restaurantName ? 'error' : ''}`}>
                      <span className="al-input-icon">🏪</span>
                      <input
                        type="text"
                        name="restaurantName"
                        value={form.restaurantName}
                        onChange={handleChange}
                        placeholder="Your restaurant name"
                      />
                    </div>
                    {errors.restaurantName && <span className="al-error">{errors.restaurantName}</span>}
                  </div>

                  <div className="al-field">
                    <label>Phone Number</label>
                    <div className="al-input-wrap">
                      <span className="al-input-icon">📞</span>
                      <input
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="Phone number (optional)"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email */}
              <div className="al-field">
                <label>Email Address *</label>
                <div className={`al-input-wrap ${errors.email ? 'error' : ''}`}>
                  <span className="al-input-icon">📧</span>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    autoComplete="email"
                  />
                </div>
                {errors.email && <span className="al-error">{errors.email}</span>}
              </div>

              {/* Password */}
              <div className="al-field">
                <label>Password *</label>
                <div className={`al-input-wrap ${errors.password ? 'error' : ''}`}>
                  <span className="al-input-icon">🔒</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder={isLogin ? 'Your password' : 'Min. 6 characters'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    className="toggle-pw"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {errors.password && <span className="al-error">{errors.password}</span>}
              </div>

              {/* Confirm Password */}
              {!isLogin && (
                <div className="al-field">
                  <label>Confirm Password *</label>
                  <div className={`al-input-wrap ${errors.confirmPassword ? 'error' : ''}`}>
                    <span className="al-input-icon">🔒</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      placeholder="Repeat password"
                    />
                  </div>
                  {errors.confirmPassword && (
                    <span className="al-error">{errors.confirmPassword}</span>
                  )}
                </div>
              )}

              <button type="submit" className="al-submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" />
                    {isLogin ? 'Signing In...' : 'Creating Account...'}
                  </>
                ) : (
                  isLogin ? '🔐 Sign In to Dashboard' : '🚀 Create Admin Account'
                )}
              </button>
            </form>

            <p className="al-switch">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
              {' '}
              <button className="al-switch-btn" onClick={switchMode}>
                {isLogin ? 'Sign Up' : 'Login'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;

