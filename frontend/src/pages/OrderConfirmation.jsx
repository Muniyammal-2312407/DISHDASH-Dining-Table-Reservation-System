import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './OrderConfirmation.css';

const OrderConfirmation = () => {
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [animDone, setAnimDone] = useState(false);

  useEffect(() => {
    const lastOrder = localStorage.getItem('lastOrder');
    if (!lastOrder) {
      navigate('/');
      return;
    }
    setOrder(JSON.parse(lastOrder));

    const t = setTimeout(() => setAnimDone(true), 800);
    return () => clearTimeout(t);
  }, [navigate]);

  const handleNewOrder = () => {
    localStorage.removeItem('lastOrder');
    navigate('/tables');
  };

  const handleHome = () => {
    localStorage.removeItem('lastOrder');
    localStorage.removeItem('customerName');
    navigate('/');
  };

  if (!order) return null;

  const isOnline = order.paymentType === 'online';

  return (
    <div className="confirm-page">
      {/* Success Animation */}
      <div className={`confirm-wrapper ${animDone ? 'anim-done' : ''}`}>
        {/* Success Icon */}
        <div className="success-ring">
          <div className="success-circle">
            <svg viewBox="0 0 52 52" className="checkmark">
              <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
              <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>
          </div>
        </div>

        <h1 className="confirm-title">Order Confirmed!</h1>
        <p className="confirm-subtitle">
          Your order has been placed successfully and is being prepared.
        </p>

        {/* Order Card */}
        <div className="order-card">
          <div className="order-card-header">
            <div className="order-id-section">
              <span className="order-label">Order ID</span>
              <span className="order-id">#{order.orderNumber}</span>
            </div>
            <div className={`status-chip ${isOnline ? 'paid-chip' : 'counter-chip'}`}>
              {isOnline ? '✅ Paid' : '🏪 Pay at Counter'}
            </div>
          </div>

          <div className="order-details-grid">
            <div className="detail-item">
              <span className="detail-icon">👤</span>
              <div>
                <div className="detail-label">Customer</div>
                <div className="detail-value">{order.customerName}</div>
              </div>
            </div>
            <div className="detail-item">
              <span className="detail-icon">🪑</span>
              <div>
                <div className="detail-label">Table Number</div>
                <div className="detail-value">Table {order.tableId}</div>
              </div>
            </div>
            <div className="detail-item">
              <span className="detail-icon">💳</span>
              <div>
                <div className="detail-label">Payment Method</div>
                <div className="detail-value">{isOnline ? 'Online Payment' : 'Pay at Counter'}</div>
              </div>
            </div>
            <div className="detail-item">
              <span className="detail-icon">📅</span>
              <div>
                <div className="detail-label">Date & Time</div>
                <div className="detail-value">
                  {new Date(order.createdAt || Date.now()).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="order-items-section">
            <h3>🍽️ Order Items</h3>
            <div className="order-items-list">
              {order.items?.map((item, i) => (
                <div key={i} className="oi-row">
                  <span className="oi-qty">{item.quantity}×</span>
                  <span className="oi-name">{item.name}</span>
                  <span className="oi-price">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="order-total-section">
            <span className="total-label">Total Amount</span>
            <span className="total-amount">₹{order.totalAmount}</span>
          </div>

          {/* Payment Notice */}
          {!isOnline && (
            <div className="payment-notice">
              <span className="notice-icon">ℹ️</span>
              <p>Please proceed to the counter to complete your payment of <strong>₹{order.totalAmount}</strong></p>
            </div>
          )}
        </div>

        {/* Status Steps */}
        <div className="status-timeline">
          <div className="timeline-item active">
            <div className="tl-dot active-dot" />
            <div className="tl-content">
              <strong>Order Placed</strong>
              <small>Your order has been received</small>
            </div>
          </div>
          <div className="timeline-line" />
          <div className="timeline-item">
            <div className="tl-dot" />
            <div className="tl-content">
              <strong>Preparing</strong>
              <small>Chef is preparing your food</small>
            </div>
          </div>
          <div className="timeline-line" />
          <div className="timeline-item">
            <div className="tl-dot" />
            <div className="tl-content">
              <strong>Ready to Serve</strong>
              <small>Order will be brought to your table</small>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="confirm-actions">
          <button className="new-order-btn" onClick={handleNewOrder}>
            🍽️ Place Another Order
          </button>
          <button className="home-btn" onClick={handleHome}>
            🏠 Back to Home
          </button>
        </div>

        <p className="enjoy-msg">🌟 Thank you for dining with Food Heaven! Enjoy your meal!</p>
      </div>
    </div>
  );
};

export default OrderConfirmation;
