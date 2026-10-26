import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import './OrderConfirmation.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const STATUS_STEPS = [
  { key: 'pending', label: 'Order Received', desc: 'Sent to the kitchen' },
  { key: 'preparing', label: 'Preparing Food', desc: 'Chef is cooking your dishes' },
  { key: 'ready', label: 'Ready to Serve', desc: 'Being brought to your table' },
  { key: 'completed', label: 'Completed', desc: 'Meal served & bill settled' },
];

const OrderConfirmation = () => {
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollTimerRef = useRef(null);

  // Initialize from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('lastOrder');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setOrder(parsed);
      } catch (err) {
        console.error('Failed to parse lastOrder', err);
      }
    }
  }, []);

  // Live polling from backend
  const fetchOrderStatus = useCallback(async (orderId, silent = false) => {
    if (!orderId) return;
    if (!silent) setIsRefreshing(true);

    try {
      const response = await axios.get(`${API}/api/orders/${orderId}`);
      if (response.data) {
        setOrder(response.data);
        localStorage.setItem('lastOrder', JSON.stringify(response.data));
        setLastRefreshed(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (error) {
      // Backend might be restarting or offline, keep existing state
      if (!silent) toast.error('Could not refresh status from server.');
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!order) return;

    const orderIdentifier = order._id || order.orderNumber;
    if (!orderIdentifier) return;

    // Fetch once on mount
    fetchOrderStatus(orderIdentifier, true);

    // If order is completed or cancelled, don't poll rapidly
    if (order.status === 'completed' || order.status === 'cancelled') {
      return;
    }

    // Poll every 5 seconds for kitchen updates
    pollTimerRef.current = setInterval(() => {
      fetchOrderStatus(orderIdentifier, true);
    }, 5000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?._id, order?.orderNumber, order?.status, fetchOrderStatus]);

  const handleManualRefresh = () => {
    if (order) {
      fetchOrderStatus(order._id || order.orderNumber, false);
    }
  };

  const handleNewOrder = () => {
    localStorage.removeItem('lastOrder');
    navigate('/tables');
  };

  const handleHome = () => {
    localStorage.removeItem('lastOrder');
    localStorage.removeItem('customerName');
    navigate('/');
  };

  if (!order) {
    return (
      <div className="order-conf-empty">
        <p>No active order found.</p>
        <button type="button" className="btn-secondary" onClick={() => navigate('/')}>
          Return to DISHDASH Home
        </button>
      </div>
    );
  }

  const currentStatus = order.status || 'pending';
  const isCancelled = currentStatus === 'cancelled';
  const isOnline = order.paymentType === 'online';

  const getStepIndex = (status) => {
    switch (status) {
      case 'pending': return 0;
      case 'preparing': return 1;
      case 'ready': return 2;
      case 'completed': return 3;
      default: return 0;
    }
  };

  const currentStepIdx = getStepIndex(currentStatus);

  return (
    <div className="order-confirm-page">
      {/* Top Bar */}
      <header className="confirm-topbar">
        <div className="confirm-nav-inner">
          <div className="brand-logo">DISHDASH</div>
          <div className="order-tag">Order #{order.orderNumber}</div>
        </div>
      </header>

      <main className="confirm-main">
        <div className="confirm-shell">
          {/* Header Banner */}
          <div className="confirm-header-card">
            <div className="confirm-icon-wrap">
              {isCancelled ? '❌' : currentStatus === 'completed' ? '🎉' : '⏱️'}
            </div>
            <div className="confirm-title-block">
              <h1>
                {isCancelled
                  ? 'Order Cancelled'
                  : currentStatus === 'completed'
                  ? 'Order Completed'
                  : 'Order Placed & In Progress'}
              </h1>
              <p>
                {isCancelled
                  ? 'This order has been cancelled by the restaurant.'
                  : `Your dishes are registered for Table ${order.tableId}. Track progress below.`}
              </p>
            </div>

            {/* Live Polling Status Tag */}
            <div className="live-status-badge">
              <span className={`live-dot ${isRefreshing ? 'pulsing' : ''}`} />
              <span>
                {currentStatus === 'completed' || isCancelled
                  ? 'Final Status'
                  : isRefreshing
                  ? 'Checking kitchen...'
                  : 'Live kitchen updates active'}
              </span>
              {lastRefreshed && <small className="last-sync">({lastRefreshed})</small>}
            </div>
          </div>

          {/* Pre-Order Scheduling Card */}
          {order.isPreOrder && (
            <div className="preorder-schedule-card">
              <div className="psc-header">
                <span className="psc-badge">🍽️ TABLE RESERVATION PRE-ORDER</span>
                <span className="psc-booking-id">Booking #{order.reservationNumber}</span>
              </div>
              <div className="psc-body">
                <div className="psc-times-grid">
                  <div className="psc-cell">
                    <span className="psc-lbl">Table Arrival Time</span>
                    <strong className="psc-val">{order.expectedArrivalTime || 'At Booking'}</strong>
                  </div>
                  <div className="psc-cell">
                    <span className="psc-lbl">Estimated Cooking Time</span>
                    <strong className="psc-val">~{order.estimatedPrepDuration || 15} mins</strong>
                  </div>
                  <div className="psc-cell">
                    <span className="psc-lbl">Kitchen Prep Starts</span>
                    <strong className="psc-val">{order.estimatedPrepStartTime || 'Scheduled'}</strong>
                  </div>
                  <div className="psc-cell psc-highlight">
                    <span className="psc-lbl">Target Ready Time</span>
                    <strong className="psc-val">{order.estimatedReadyTime || order.expectedArrivalTime}</strong>
                  </div>
                </div>
                {order.prepDelayMinutes > 0 && (
                  <div className="psc-delay-alert">
                    ⚠️ Kitchen update: A prep delay of +{order.prepDelayMinutes} mins was logged by the kitchen staff.
                  </div>
                )}
                <div className="psc-note">
                  ℹ️ Dishes are scheduled to be prepared closer to your arrival time so your meal is served fresh.
                </div>
              </div>
            </div>
          )}

          {/* Tracking Timeline */}
          {!isCancelled && (
            <div className="tracking-timeline-card">
              <div className="timeline-header">
                <h3>Live Kitchen Status</h3>
                <button
                  type="button"
                  className="btn-refresh-status"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? 'Refreshing...' : '🔄 Refresh Now'}
                </button>
              </div>

              <div className="timeline-steps">
                {STATUS_STEPS.map((step, idx) => {
                  const isDone = idx < currentStepIdx;
                  const isCurrent = idx === currentStepIdx;

                  return (
                    <div
                      key={step.key}
                      className={`timeline-step ${isDone ? 'step-done' : ''} ${isCurrent ? 'step-current' : ''}`}
                    >
                      <div className="step-marker">
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <div className="step-info">
                        <span className="step-title">{step.label}</span>
                        <span className="step-sub">{step.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Order Summary & Bill Card */}
          <div className="bill-summary-card">
            <div className="bill-header">
              <h2>Receipt & Table Details</h2>
              <span className={`payment-chip ${isOnline ? 'chip-sim-paid' : 'chip-counter'}`}>
                {isOnline ? '💳 Simulated Online Payment (Paid)' : '🏪 Pay at Counter'}
              </span>
            </div>

            <div className="customer-meta-grid">
              <div className="meta-cell">
                <span className="meta-label">Customer Name</span>
                <span className="meta-value">{order.customerName}</span>
              </div>
              <div className="meta-cell">
                <span className="meta-label">Assigned Table</span>
                <span className="meta-value">Table {order.tableId}</span>
              </div>
              <div className="meta-cell">
                <span className="meta-label">Payment Mode</span>
                <span className="meta-value">
                  {isOnline ? 'Online (Simulated Demo)' : 'Counter Settlement'}
                </span>
              </div>
              <div className="meta-cell">
                <span className="meta-label">Time Placed</span>
                <span className="meta-value">
                  {new Date(order.createdAt || Date.now()).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div className="items-table-block">
              <div className="table-heading-row">
                <span>Dish Item</span>
                <span className="col-center">Qty</span>
                <span className="col-right">Subtotal</span>
              </div>

              <div className="items-body">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="item-row">
                    <span className="item-name">{item.name}</span>
                    <span className="col-center item-qty">{item.quantity}×</span>
                    <span className="col-right item-total">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="bill-total-row">
                <span>Grand Total (Taxes Inclusive)</span>
                <span className="total-highlight">₹{order.totalAmount}</span>
              </div>
            </div>

            {/* Counter Payment Notice if offline */}
            {!isOnline && currentStatus !== 'completed' && (
              <div className="counter-reminder-box">
                <span className="reminder-icon">ℹ️</span>
                <p>
                  Please settle your bill of <strong>₹{order.totalAmount}</strong> at the front counter with staff.
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="confirm-action-bar">
            <button
              type="button"
              className="btn-primary"
              onClick={handleNewOrder}
            >
              Order Additional Items →
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleHome}
            >
              Back to Home
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OrderConfirmation;
