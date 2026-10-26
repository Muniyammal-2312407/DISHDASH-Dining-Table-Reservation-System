import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import './AdminLogin.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    restaurantName: 'DISHDASH Restaurant',
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
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email address';

    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 6) errs.password = 'At least 6 characters required';

    if (!isLogin) {
      if (!form.username.trim()) errs.username = 'Username is required';
      if (!form.restaurantName.trim()) errs.restaurantName = 'Restaurant name is required';
      if (form.password !== form.confirmPassword) {
        errs.confirmPassword = 'Passwords do not match';
      }
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
        ? { email: form.email.trim(), password: form.password }
        : {
            username: form.username.trim(),
            email: form.email.trim(),
            password: form.password,
            restaurantName: form.restaurantName.trim(),
            phone: form.phone.trim(),
          };

      const response = await axios.post(`${API}${endpoint}`, payload);

      localStorage.setItem('adminToken', response.data.token);
      localStorage.setItem('adminInfo', JSON.stringify(response.data.admin));

      toast.success(
        isLogin
          ? `Welcome back, ${response.data.admin.username}!`
          : 'Admin registered successfully! Redirecting...'
      );
      navigate('/admin');
    } catch (error) {
      toast.error(error.response?.data?.message || `${isLogin ? 'Login' : 'Signup'} failed`);
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemoCreds = () => {
    setIsLogin(true);
    setForm(prev => ({
      ...prev,
      email: 'admin@dishdash.com',
      password: 'admin123'
    }));
    setErrors({});
    toast.info('Filled demo admin credentials.');
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      await axios.post(`${API}/api/seed-data`);
      toast.success('Sample dishes & admin account verified!');
      handleFillDemoCreds();
    } catch (err) {
      toast.error('Could not run seed endpoint. Ensure server is online.');
    } finally {
      setSeeding(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setErrors({});
  };

  return (
    <div className="admin-login-page">
      {/* Top Bar */}
      <header className="al-topbar">
        <div className="al-topbar-inner">
          <button type="button" className="btn-back-home" onClick={() => navigate('/')}>
            ← Back to Customer Home
          </button>
          <div className="al-brand">
            <span className="brand-logo">DISHDASH</span>
            <span className="brand-badge-admin">Admin Portal</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="al-main">
        <div className="al-card-shell">
          {/* Left: Overview & Demo Helper */}
          <div className="al-left-info">
            <div className="al-pill">Staff & Manager Access</div>
            <h2>Restaurant Operations Portal</h2>
            <p className="al-desc">
              Monitor incoming table orders, update kitchen preparation stages, and manage dish availability on the fly.
            </p>

            <div className="al-feature-list">
              <div className="al-feature-item">
                <span className="feat-icon">📊</span>
                <div>
                  <strong>Live Table & Order Overview</strong>
                  <p>Track pending, cooking, and ready orders in real-time.</p>
                </div>
              </div>

              <div className="al-feature-item">
                <span className="feat-icon">🍽️</span>
                <div>
                  <strong>Menu & Stock Availability</strong>
                  <p>Toggle items available or sold out directly from your dashboard.</p>
                </div>
              </div>

              <div className="al-feature-item">
                <span className="feat-icon">🛡️</span>
                <div>
                  <strong>Protected Session</strong>
                  <p>Secured with JWT authentication and role authorization.</p>
                </div>
              </div>
            </div>

            {/* Demo Credentials Box */}
            <div className="demo-credentials-card">
              <div className="demo-card-head">
                <span>🔑 Demo Interview Credentials</span>
                <button
                  type="button"
                  className="btn-autofill"
                  onClick={handleFillDemoCreds}
                >
                  Autofill
                </button>
              </div>
              <div className="demo-card-body">
                <div><strong>Email:</strong> admin@dishdash.com</div>
                <div><strong>Password:</strong> admin123</div>
              </div>
              <button
                type="button"
                className="btn-seed-inline"
                onClick={handleSeedData}
                disabled={seeding}
              >
                {seeding ? 'Checking Database...' : 'Verify / Seed Sample Data'}
              </button>
            </div>
          </div>

          {/* Right: Authentication Form */}
          <div className="al-right-form-wrap">
            <div className="al-tab-selector">
              <button
                type="button"
                className={`tab-btn ${isLogin ? 'active' : ''}`}
                onClick={() => { setIsLogin(true); setErrors({}); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`tab-btn ${!isLogin ? 'active' : ''}`}
                onClick={() => { setIsLogin(false); setErrors({}); }}
              >
                Register New
              </button>
            </div>

            <form onSubmit={handleSubmit} className="al-form">
              {!isLogin && (
                <>
                  <div className="al-field">
                    <label>Username *</label>
                    <input
                      type="text"
                      name="username"
                      value={form.username}
                      onChange={handleChange}
                      placeholder="e.g. chef_anand"
                    />
                    {errors.username && <span className="field-err">{errors.username}</span>}
                  </div>

                  <div className="al-field">
                    <label>Restaurant Name *</label>
                    <input
                      type="text"
                      name="restaurantName"
                      value={form.restaurantName}
                      onChange={handleChange}
                      placeholder="e.g. DISHDASH Bistro"
                    />
                    {errors.restaurantName && <span className="field-err">{errors.restaurantName}</span>}
                  </div>
                </>
              )}

              <div className="al-field">
                <label>Admin Email *</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="admin@dishdash.com"
                />
                {errors.email && <span className="field-err">{errors.email}</span>}
              </div>

              <div className="al-field">
                <label>Password *</label>
                <div className="password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="btn-toggle-pwd"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.password && <span className="field-err">{errors.password}</span>}
              </div>

              {!isLogin && (
                <>
                  <div className="al-field">
                    <label>Confirm Password *</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      placeholder="••••••••"
                    />
                    {errors.confirmPassword && <span className="field-err">{errors.confirmPassword}</span>}
                  </div>

                  <div className="al-field">
                    <label>Contact Phone (Optional)</label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="+91 9876543210"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                className="btn-admin-submit"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : isLogin ? 'Sign In to Dashboard →' : 'Create Account & Enter →'}
              </button>

              <div className="al-switch-hint">
                {isLogin ? (
                  <span>Need an admin account? <button type="button" onClick={switchMode}>Register here</button></span>
                ) : (
                  <span>Already registered? <button type="button" onClick={switchMode}>Sign in</button></span>
                )}
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLogin;
