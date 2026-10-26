import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import './TableSelection.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export const LUNCH_SLOTS = [
  { time24: '12:00', label: '12:00 PM' },
  { time24: '12:30', label: '12:30 PM' },
  { time24: '13:00', label: '01:00 PM' },
  { time24: '13:30', label: '01:30 PM' },
  { time24: '14:00', label: '02:00 PM' },
  { time24: '14:30', label: '02:30 PM' },
];

export const DINNER_SLOTS = [
  { time24: '18:00', label: '06:00 PM' },
  { time24: '18:30', label: '06:30 PM' },
  { time24: '19:00', label: '07:00 PM' },
  { time24: '19:30', label: '07:30 PM' },
  { time24: '20:00', label: '08:00 PM' },
  { time24: '20:30', label: '08:30 PM' },
  { time24: '21:00', label: '09:00 PM' },
  { time24: '21:30', label: '09:30 PM' },
];

export const ALL_SLOTS = [...LUNCH_SLOTS, ...DINNER_SLOTS];

export const formatTime12Hour = (time24) => {
  if (!time24) return '';
  const match = ALL_SLOTS.find(s => s.time24 === time24);
  if (match) return match.label;
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const m = mStr || '00';
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${period}`;
};

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 8];

// Smart initial date and time: if today's slots have all passed, default to tomorrow
const getSmartInitialDateAndSlot = () => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Find next upcoming slot today that is at least 30 minutes in the future
  const upcomingSlotToday = ALL_SLOTS.find(slot => {
    const [h, m] = slot.time24.split(':').map(Number);
    return h * 60 + m >= currentMinutes + 30;
  });

  if (upcomingSlotToday) {
    return { date: todayStr, slot: upcomingSlotToday.time24 };
  }

  // All slots today have passed: default to tomorrow at 19:00 (07:00 PM)
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  return { date: tomorrowStr, slot: '19:00' };
};

const TableSelection = () => {
  const navigate = useNavigate();

  // Mode: 'reserve' (default, smart reservation) vs 'immediate' (walk-in table)
  const [bookingMode, setBookingMode] = useState('reserve');

  // Customer identity - initialized from localStorage if available
  const [customerName, setCustomerName] = useState(
    () => localStorage.getItem('customerName') || 'Guest Customer'
  );
  const [customerPhone, setCustomerPhone] = useState(
    () => localStorage.getItem('customerPhone') || ''
  );
  const [customerEmail, setCustomerEmail] = useState(
    () => localStorage.getItem('customerEmail') || ''
  );
  const [specialRequests, setSpecialRequests] = useState('');

  // Reservation Criteria - smart initial values
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

  const initial = getSmartInitialDateAndSlot();
  const [reservationDate, setReservationDate] = useState(initial.date);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(initial.slot);
  const [guestCount, setGuestCount] = useState(2);

  // Table Data
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tableError, setTableError] = useState(null);

  // Booking Flow States
  const [showBookingSummary, setShowBookingSummary] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState(null);

  // Confirmation Modal
  const [confirmedReservation, setConfirmedReservation] = useState(null);

  // My Reservations Drawer
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [lookupPhone, setLookupPhone] = useState(
    () => localStorage.getItem('customerPhone') || ''
  );

  // Sync phone & name from localStorage on mount
  useEffect(() => {
    const savedPhone = localStorage.getItem('customerPhone');
    if (savedPhone) {
      setCustomerPhone(savedPhone);
      setLookupPhone(savedPhone);
    }
    const savedName = localStorage.getItem('customerName');
    if (savedName) {
      setCustomerName(savedName);
    }
  }, []);

  // Determine if a slot has passed for today
  const isSlotPassedForToday = useCallback((time24) => {
    if (reservationDate !== todayStr) return false;
    const current = new Date();
    const currentHHMM = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`;
    return time24 < currentHHMM;
  }, [reservationDate, todayStr]);

  // Fetch Available Tables from Backend based on Date, Time, and Guest Count
  const fetchAvailableTables = useCallback(async () => {
    setLoadingTables(true);
    setTableError(null);
    setSelectedTable(null);
    try {
      if (bookingMode === 'reserve') {
        const res = await axios.get(`${API}/api/reservations/available-tables`, {
          params: {
            date: reservationDate,
            timeSlot: selectedTimeSlot,
            guestCount: guestCount,
          }
        });
        const fetchedTables = res.data.tables || [];
        setTables(fetchedTables);
        if (fetchedTables.length === 0) {
          setTableError('No tables found for this restaurant configuration.');
        }
      } else {
        // Immediate dining mode: check active food orders occupancy
        const res = await axios.get(`${API}/api/tables/occupied`);
        const occupied = new Set(res.data.occupiedTables || []);

        const fallbackTables = [
          { id: '1', number: 1, seats: 2, zone: 'Window' },
          { id: '2', number: 2, seats: 2, zone: 'Window' },
          { id: '3', number: 3, seats: 4, zone: 'Main Hall' },
          { id: '4', number: 4, seats: 4, zone: 'Main Hall' },
          { id: '5', number: 5, seats: 4, zone: 'Main Hall' },
          { id: '6', number: 6, seats: 4, zone: 'Main Hall' },
          { id: '7', number: 7, seats: 6, zone: 'Family Booth' },
          { id: '8', number: 8, seats: 6, zone: 'Family Booth' },
          { id: '9', number: 9, seats: 8, zone: 'Private Corner' },
          { id: '10', number: 10, seats: 2, zone: 'Patio' },
        ].map(t => {
          const isBusy = occupied.has(String(t.id));
          const isCapacityExceeded = t.seats < guestCount;
          let status = 'available';
          let reason = 'Available for immediate seating';
          if (isCapacityExceeded) {
            status = 'capacity_exceeded';
            reason = `Capacity: ${t.seats} ${t.seats === 1 ? 'seat' : 'seats'} — ${guestCount} guests requested`;
          } else if (isBusy) {
            status = 'reserved';
            reason = 'Occupied by dining guest';
          }
          return {
            ...t,
            status,
            reason,
            canBook: !isBusy && !isCapacityExceeded
          };
        });
        setTables(fallbackTables);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not load table availability from server.';
      setTableError(msg);
      toast.error(msg);
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  }, [bookingMode, reservationDate, selectedTimeSlot, guestCount]);

  useEffect(() => {
    fetchAvailableTables();
  }, [fetchAvailableTables]);

  // Handle customer input changes and persist to localStorage
  const handleNameChange = (e) => {
    const val = e.target.value;
    setCustomerName(val);
    localStorage.setItem('customerName', val);
  };

  const handlePhoneChange = (e) => {
    const val = e.target.value;
    setCustomerPhone(val);
    localStorage.setItem('customerPhone', val);
    setLookupPhone(val);
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setCustomerEmail(val);
    localStorage.setItem('customerEmail', val);
  };

  // Handle Table Selection
  const handleSelectTable = (table) => {
    if (!table.canBook) {
      if (table.status === 'slot_passed') {
        toast.warning('This time slot has already passed for today. Please select a future time slot or book for tomorrow.');
      } else if (table.status === 'capacity_exceeded') {
        toast.warning(`Table ${table.number} has only ${table.seats} seats. Please choose a larger table.`);
      } else {
        toast.warning(`Table ${table.number} is not available for this time slot.`);
      }
      return;
    }
    setSelectedTable(table);
    setBookingError(null);
  };

  // Review Booking - Step 1 to Step 2 Transition
  const handleReviewBooking = () => {
    if (bookingMode === 'immediate') {
      if (!selectedTable) {
        toast.error('Please select an available table.');
        return;
      }
      localStorage.removeItem('activeReservation');
      navigate(`/menu/restaurant123/${selectedTable.id}`);
      return;
    }

    // Comprehensive validation for reservations
    if (!customerName || !customerName.trim()) {
      toast.error('Please enter your full name for the reservation.');
      const nameEl = document.getElementById('resName');
      if (nameEl) nameEl.focus();
      return;
    }

    if (!customerPhone || !customerPhone.trim()) {
      toast.error('Please provide a contact phone number for your reservation confirmation.');
      const phoneEl = document.getElementById('resPhone');
      if (phoneEl) phoneEl.focus();
      return;
    }

    const digitsOnly = customerPhone.replace(/\D/g, '');
    if (digitsOnly.length < 7) {
      toast.error('Please enter a valid phone number (at least 7 digits).');
      const phoneEl = document.getElementById('resPhone');
      if (phoneEl) phoneEl.focus();
      return;
    }

    // Optional email validation
    if (customerEmail && customerEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail.trim())) {
        toast.error('Please enter a valid email address (e.g. name@example.com), or leave it empty.');
        const emailEl = document.getElementById('resEmail');
        if (emailEl) emailEl.focus();
        return;
      }
    }

    if (!selectedTable) {
      toast.error('Please select an available table from the floor layout.');
      return;
    }

    if (!selectedTable.canBook) {
      toast.warning(`Table ${selectedTable.number} is not bookable. Please pick an available table.`);
      return;
    }

    // Save verified details to localStorage
    localStorage.setItem('customerName', customerName.trim());
    localStorage.setItem('customerPhone', customerPhone.trim());
    localStorage.setItem('customerEmail', customerEmail.trim());

    setBookingError(null);
    setShowBookingSummary(true);
  };

  // Confirm Reservation - Submit to Backend & MongoDB
  const handleConfirmReservation = async () => {
    if (!selectedTable) {
      toast.error('Please select an available table.');
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error('Customer name and contact phone number are required.');
      return;
    }

    setSubmittingBooking(true);
    setBookingError(null);

    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        tableId: String(selectedTable.id),
        guestCount: parseInt(guestCount, 10),
        reservationDate,
        timeSlot: selectedTimeSlot,
        specialRequests: specialRequests.trim(),
      };

      const res = await axios.post(`${API}/api/reservations`, payload);
      const reservation = res.data?.reservation || res.data;

      // Persist confirmed reservation details
      localStorage.setItem('customerPhone', customerPhone.trim());
      localStorage.setItem('customerName', customerName.trim());
      localStorage.setItem('customerEmail', customerEmail.trim());
      localStorage.setItem('activeReservation', JSON.stringify(reservation));

      // Successfully saved in MongoDB
      setShowBookingSummary(false);
      setConfirmedReservation(reservation);
      setBookingError(null);
      toast.success(`Table ${selectedTable.number} reserved successfully! (#${reservation.reservationNumber})`);
      fetchAvailableTables();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to complete reservation. Please try again.';
      setBookingError(errorMsg);
      toast.error(errorMsg);
      // Re-fetch tables to sync latest availability in case of conflict
      fetchAvailableTables();
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Pre-Order Food Flow
  const handleProceedToPreOrder = () => {
    if (confirmedReservation) {
      localStorage.setItem('activeReservation', JSON.stringify(confirmedReservation));
      navigate(`/menu/restaurant123/${confirmedReservation.tableId}`);
    }
  };

  // Open My Bookings Drawer
  const handleOpenMyBookings = () => {
    const phoneToUse = customerPhone.trim() || localStorage.getItem('customerPhone') || '';
    setLookupPhone(phoneToUse);
    setShowMyBookings(true);
    if (phoneToUse) {
      fetchMyReservations(phoneToUse);
    }
  };

  // Fetch My Reservations from Backend
  const fetchMyReservations = async (phoneToLookup) => {
    const phone = phoneToLookup || lookupPhone || customerPhone || localStorage.getItem('customerPhone');
    if (!phone || !phone.trim()) {
      toast.error('Please enter your phone number to check bookings.');
      return;
    }

    setLoadingBookings(true);
    try {
      const res = await axios.get(`${API}/api/reservations`, {
        params: { phone: phone.trim() }
      });
      setMyBookings(res.data || []);
      if ((res.data || []).length === 0) {
        toast.info('No reservations found for this phone number.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load reservations.');
    } finally {
      setLoadingBookings(false);
    }
  };

  // Cancel Reservation
  const handleCancelReservation = async (reservationId) => {
    if (!window.confirm('Are you sure you want to cancel this reservation? The table slot will be released.')) {
      return;
    }

    try {
      await axios.patch(`${API}/api/reservations/${reservationId}/cancel`, {
        phone: customerPhone
      });
      toast.success('Reservation cancelled and table slot released.');
      fetchMyReservations(lookupPhone || customerPhone);
      fetchAvailableTables();
      if (confirmedReservation?._id === reservationId) {
        setConfirmedReservation(null);
        localStorage.removeItem('activeReservation');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel reservation.');
    }
  };

  const allTodaySlotsPassed = reservationDate === todayStr && ALL_SLOTS.every(s => isSlotPassedForToday(s.time24));

  return (
    <div className="table-page-shell">
      {/* Top Navbar */}
      <header className="table-nav">
        <div className="table-nav-inner">
          <button type="button" onClick={() => navigate('/')} className="btn-nav-back">
            ← Home
          </button>
          <div className="table-brand-block">
            <span className="brand-logo">DISHDASH</span>
            <span className="brand-dot">•</span>
            <span className="brand-desc">Smart Table Booking & Pre-Ordering</span>
          </div>
          <div className="table-nav-right">
            <button
              type="button"
              className="btn-my-bookings"
              onClick={handleOpenMyBookings}
            >
              📅 My Bookings
            </button>
            <div className="customer-avatar-chip">
              <span className="avatar-letter">{(customerName || 'G').charAt(0).toUpperCase()}</span>
              <span className="avatar-name">{customerName || 'Guest'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="table-main-content">
        <div className="reservation-container">

          {/* Mode Switcher */}
          <div className="mode-toggle-bar">
            <button
              type="button"
              className={`mode-btn ${bookingMode === 'reserve' ? 'active' : ''}`}
              onClick={() => {
                setBookingMode('reserve');
                setSelectedTable(null);
                setBookingError(null);
              }}
            >
              <span>📅 Schedule Table Reservation</span>
              <small>Reserve date & time slot in advance, with optional food pre-order</small>
            </button>
            <button
              type="button"
              className={`mode-btn ${bookingMode === 'immediate' ? 'active' : ''}`}
              onClick={() => {
                setBookingMode('immediate');
                setSelectedTable(null);
                setBookingError(null);
              }}
            >
              <span>⚡ Immediate Walk-In Dining</span>
              <small>Currently at the restaurant and ready to be seated immediately</small>
            </button>
          </div>

          {/* Reservation Controls Box */}
          {bookingMode === 'reserve' && (
            <section className="reservation-controls-panel">
              <div className="panel-row-controls">
                {/* Date Picker */}
                <div className="control-group">
                  <div className="label-with-hint">
                    <label htmlFor="resDate">1. Reservation Date</label>
                    {reservationDate === tomorrowStr && (
                      <span className="date-hint-badge">Tomorrow</span>
                    )}
                  </div>
                  <input
                    id="resDate"
                    type="date"
                    min={todayStr}
                    value={reservationDate}
                    onChange={(e) => {
                      setReservationDate(e.target.value);
                      setSelectedTable(null);
                    }}
                    className="control-input"
                  />
                </div>

                {/* Guest Count */}
                <div className="control-group">
                  <label>2. Number of Guests</label>
                  <div className="guests-pill-selector">
                    {GUEST_OPTIONS.map(g => (
                      <button
                        key={g}
                        type="button"
                        className={`guest-pill ${guestCount === g ? 'active' : ''}`}
                        onClick={() => {
                          setGuestCount(g);
                          setSelectedTable(null);
                        }}
                      >
                        {g} {g === 1 ? 'Guest' : 'Guests'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Name */}
                <div className="control-group">
                  <label htmlFor="resName">3. Guest Full Name *</label>
                  <input
                    id="resName"
                    type="text"
                    required
                    placeholder="Your Full Name"
                    value={customerName}
                    onChange={handleNameChange}
                    className="control-input"
                  />
                </div>

                {/* Contact Phone */}
                <div className="control-group">
                  <label htmlFor="resPhone">4. Contact Phone Number *</label>
                  <input
                    id="resPhone"
                    type="tel"
                    required
                    placeholder="+91 9876543210"
                    value={customerPhone}
                    onChange={handlePhoneChange}
                    className="control-input"
                  />
                </div>

                {/* Contact Email (Optional) */}
                <div className="control-group">
                  <label htmlFor="resEmail">5. Email Address (Optional)</label>
                  <input
                    id="resEmail"
                    type="email"
                    placeholder="name@example.com"
                    value={customerEmail}
                    onChange={handleEmailChange}
                    className="control-input"
                  />
                </div>
              </div>

              {/* Time Slot Selector - Grouped into Lunch and Dinner */}
              <div className="time-slot-section">
                <div className="slot-section-header">
                  <label className="slot-title-label">6. Available Arrival Time Slots (12-Hour Format)</label>
                  {allTodaySlotsPassed && (
                    <span className="today-passed-callout">
                      ⚠️ All dining slots for today have passed.
                      <button
                        type="button"
                        className="btn-switch-tomorrow"
                        onClick={() => {
                          setReservationDate(tomorrowStr);
                          setSelectedTimeSlot('19:00');
                        }}
                      >
                        Switch to Tomorrow ({tomorrowStr}) →
                      </button>
                    </span>
                  )}
                </div>

                {/* Lunch Group */}
                <div className="slots-group-box">
                  <span className="slots-group-title">☀️ Lunch Dining</span>
                  <div className="slots-scroll-row">
                    {LUNCH_SLOTS.map(slot => {
                      const passed = isSlotPassedForToday(slot.time24);
                      return (
                        <button
                          key={slot.time24}
                          type="button"
                          className={`slot-chip ${selectedTimeSlot === slot.time24 ? 'active' : ''} ${passed ? 'slot-passed-chip' : ''}`}
                          onClick={() => {
                            if (passed) {
                              toast.info('This lunch slot has already passed for today. Please select an upcoming slot or tomorrow.');
                              return;
                            }
                            setSelectedTimeSlot(slot.time24);
                            setSelectedTable(null);
                          }}
                        >
                          <span>{slot.label}</span>
                          {passed && <small className="slot-passed-tag">Passed</small>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dinner Group */}
                <div className="slots-group-box">
                  <span className="slots-group-title">🌙 Dinner Dining</span>
                  <div className="slots-scroll-row">
                    {DINNER_SLOTS.map(slot => {
                      const passed = isSlotPassedForToday(slot.time24);
                      return (
                        <button
                          key={slot.time24}
                          type="button"
                          className={`slot-chip ${selectedTimeSlot === slot.time24 ? 'active' : ''} ${passed ? 'slot-passed-chip' : ''}`}
                          onClick={() => {
                            if (passed) {
                              toast.info('This dinner slot has already passed for today. Please select an upcoming slot or tomorrow.');
                              return;
                            }
                            setSelectedTimeSlot(slot.time24);
                            setSelectedTable(null);
                          }}
                        >
                          <span>{slot.label}</span>
                          {passed && <small className="slot-passed-tag">Passed</small>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Special Requests / Occasion */}
              <div className="special-requests-row">
                <label className="special-requests-label">7. Occasion or Special Requests (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Anniversary celebration, Birthday, Window booth preferred, High chair needed..."
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  className="special-input"
                  maxLength={120}
                />
              </div>
            </section>
          )}

          {/* Table Grid Header */}
          <div className="table-grid-header">
            <div>
              <h2>{bookingMode === 'reserve' ? 'Select an Available Table for Your Booking' : 'Select a Free Table for Immediate Seating'}</h2>
              <p className="table-subtitle">
                {bookingMode === 'reserve'
                  ? `Showing table availability for ${reservationDate} at ${formatTime12Hour(selectedTimeSlot)} (${guestCount} ${guestCount === 1 ? 'Guest' : 'Guests'})`
                  : 'Tables occupied right now are marked busy. Pick an empty table to order food.'}
              </p>
            </div>

            {/* Legend */}
            <div className="table-legend">
              <span className="legend-item"><span className="legend-dot dot-avail" /> Available</span>
              <span className="legend-item"><span className="legend-dot dot-selected" /> Selected</span>
              <span className="legend-item"><span className="legend-dot dot-booked" /> Reserved / Busy</span>
              <span className="legend-item"><span className="legend-dot dot-exceeded" /> Capacity Exceeded</span>
              <span className="legend-item"><span className="legend-dot dot-passed" /> Slot Passed</span>
            </div>
          </div>

          {/* Error Banner if Table Loading Failed */}
          {tableError && (
            <div className="tables-error-banner">
              <div className="teb-icon">⚠️</div>
              <div className="teb-text">
                <strong>Table Availability Notice:</strong>
                <p>{tableError}</p>
              </div>
              <div className="teb-actions">
                {reservationDate === todayStr && (
                  <button
                    type="button"
                    className="btn-teb-action"
                    onClick={() => {
                      setReservationDate(tomorrowStr);
                      setSelectedTimeSlot('19:00');
                    }}
                  >
                    Check Tomorrow's Tables
                  </button>
                )}
                <button
                  type="button"
                  className="btn-teb-action btn-teb-secondary"
                  onClick={fetchAvailableTables}
                >
                  Retry API
                </button>
              </div>
            </div>
          )}

          {/* Tables Grid */}
          {loadingTables ? (
            <div className="tables-loading-box">
              <div className="spinner-plate" />
              <p>Checking live table availability from MongoDB...</p>
            </div>
          ) : tables.length > 0 ? (
            <div className="tables-cards-grid">
              {tables.map(table => {
                const isSelected = selectedTable?.id === table.id;
                const canBook = table.canBook;
                const isPassed = table.status === 'slot_passed';

                return (
                  <button
                    key={table.id}
                    type="button"
                    className={`table-slot-card ${isSelected ? 'selected' : ''} ${!canBook ? `disabled-${table.status}` : ''}`}
                    onClick={() => handleSelectTable(table)}
                    disabled={!canBook}
                  >
                    <div className="tsc-head">
                      <span className="tsc-number">Table {table.number}</span>
                      <span className={`tsc-status-pill status-${table.status}`}>
                        {table.status === 'available'
                          ? 'Available'
                          : table.status === 'capacity_exceeded'
                          ? 'Capacity'
                          : table.status === 'slot_passed'
                          ? 'Passed'
                          : 'Reserved'}
                      </span>
                    </div>

                    <div className="tsc-body">
                      <div className="tsc-detail-line">
                        <span className="tsc-label">Capacity:</span>
                        <strong className="tsc-val">👥 {table.seats} Seats</strong>
                      </div>
                      <div className="tsc-detail-line">
                        <span className="tsc-label">Location:</span>
                        <span className="tsc-val">📍 {table.zone}</span>
                      </div>
                    </div>

                    <div className="tsc-footer">
                      {isSelected ? (
                        <span className="tsc-msg selected-msg">Selected ✓</span>
                      ) : canBook ? (
                        <span className="tsc-msg avail-msg">+ Select Table</span>
                      ) : isPassed ? (
                        <span className="tsc-msg unavail-msg">Slot passed for today</span>
                      ) : (
                        <span className="tsc-msg unavail-msg">{table.reason}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : !loadingTables && !tableError ? (
            <div className="tables-empty-box">
              <p>No tables found. Please try another date or time slot.</p>
            </div>
          ) : null}

          {/* Single, Non-Overlapping Selected-Table Summary Bar below the Table Grid */}
          {selectedTable && (
            <div className="single-table-summary-bar">
              <div className="stsb-content">
                <div className="stsb-badge-col">
                  <span className="stsb-tag">Selected</span>
                  <span className="stsb-table-title">Table {selectedTable.number}</span>
                </div>
                <div className="stsb-info-col">
                  <div className="stsb-row-chips">
                    <span className="stsb-chip">👥 {selectedTable.seats} Seats Capacity</span>
                    <span className="stsb-chip">📍 {selectedTable.zone}</span>
                    {bookingMode === 'reserve' ? (
                      <span className="stsb-chip stsb-chip-time">🕒 {formatTime12Hour(selectedTimeSlot)}</span>
                    ) : (
                      <span className="stsb-chip stsb-chip-walkin">⚡ Walk-In</span>
                    )}
                  </div>
                  <div className="stsb-row-text">
                    {bookingMode === 'reserve' ? (
                      <p>
                        <strong>Customer:</strong> {customerName || 'Guest Customer'} &bull; <strong>Date:</strong> {reservationDate} &bull; <strong>Time:</strong> {formatTime12Hour(selectedTimeSlot)} &bull; <strong>Party Size:</strong> {guestCount} {guestCount === 1 ? 'Guest' : 'Guests'}
                      </p>
                    ) : (
                      <p>
                        Immediate walk-in dining for <strong>{customerName || 'Guest Customer'}</strong> ({guestCount} {guestCount === 1 ? 'Guest' : 'Guests'})
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-stsb-continue"
                onClick={handleReviewBooking}
                disabled={submittingBooking}
              >
                {bookingMode === 'reserve'
                  ? 'Continue to Booking Summary →'
                  : 'Proceed to Menu →'}
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Step 2: Booking Summary & Confirmation Modal */}
      {showBookingSummary && selectedTable && (
        <div className="modal-backdrop" onClick={() => !submittingBooking && setShowBookingSummary(false)}>
          <div className="booking-summary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bsm-header">
              <div className="bsm-header-text">
                <span className="bsm-badge">Step 2 of 2 • Review & Confirm</span>
                <h2>Booking Summary</h2>
                <p className="bsm-sub">Please review your reservation details before confirming.</p>
              </div>
              <button
                type="button"
                className="bsm-close"
                onClick={() => !submittingBooking && setShowBookingSummary(false)}
                disabled={submittingBooking}
              >
                ✕
              </button>
            </div>

            {/* Error banner if submission failed */}
            {bookingError && (
              <div className="booking-error-banner">
                <span className="beb-icon">⚠️</span>
                <div className="beb-content">
                  <strong>Reservation Conflict or Error</strong>
                  <p>{bookingError}</p>
                </div>
              </div>
            )}

            {/* Summary Details Card */}
            <div className="bsm-card">
              <div className="bsm-row">
                <span className="bsm-label">Customer Name</span>
                <strong className="bsm-val">{customerName.trim()}</strong>
              </div>
              <div className="bsm-row">
                <span className="bsm-label">Contact Phone</span>
                <strong className="bsm-val">{customerPhone.trim()}</strong>
              </div>
              <div className="bsm-row">
                <span className="bsm-label">Email Address</span>
                <strong className="bsm-val">{customerEmail.trim() || <span style={{ opacity: 0.6, fontWeight: 'normal' }}>Not provided (Optional)</span>}</strong>
              </div>
              <div className="bsm-row">
                <span className="bsm-label">Reservation Date</span>
                <strong className="bsm-val">{reservationDate}</strong>
              </div>
              <div className="bsm-row">
                <span className="bsm-label">Arrival Time</span>
                <strong className="bsm-val time-highlight">🕒 {formatTime12Hour(selectedTimeSlot)}</strong>
              </div>
              <div className="bsm-row">
                <span className="bsm-label">Guest Count</span>
                <strong className="bsm-val">👥 {guestCount} {guestCount === 1 ? 'Guest' : 'Guests'}</strong>
              </div>
              <div className="bsm-row">
                <span className="bsm-label">Selected Table</span>
                <strong className="bsm-val table-highlight">
                  Table {selectedTable.number} • {selectedTable.zone} ({selectedTable.seats} Seats Capacity)
                </strong>
              </div>
              <div className="bsm-row">
                <span className="bsm-label">Reservation Duration</span>
                <strong className="bsm-val">⏳ 90 Minutes (Held for your party)</strong>
              </div>
              <div className="bsm-row bsm-row-special">
                <span className="bsm-label">Occasion / Special Requests</span>
                <span className="bsm-val special-val">
                  {specialRequests && specialRequests.trim() ? `“${specialRequests.trim()}”` : 'Standard Dining (No special requests)'}
                </span>
              </div>
            </div>

            {/* Summary Actions */}
            <div className="bsm-actions">
              <button
                type="button"
                className="btn-bsm-back"
                onClick={() => setShowBookingSummary(false)}
                disabled={submittingBooking}
              >
                ← Back / Edit Details
              </button>
              <button
                type="button"
                className="btn-bsm-confirm"
                onClick={handleConfirmReservation}
                disabled={submittingBooking}
              >
                {submittingBooking ? (
                  <span className="btn-spinner-content">
                    <span className="mini-spinner" />
                    <span>Securing Table in MongoDB...</span>
                  </span>
                ) : bookingError ? (
                  'Retry Reservation 🔄'
                ) : (
                  'Confirm Reservation ✓'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Confirmation Dialog (Shown after backend confirmation) */}
      {confirmedReservation && (
        <div className="modal-backdrop">
          <div className="booking-confirmed-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="bcd-icon">🎉</div>
            <h2>Table Reservation Confirmed!</h2>
            <p className="bcd-sub">Your table is securely booked and saved in the DISHDASH reservation system.</p>

            <div className="bcd-receipt-card">
              <div className="bcd-row">
                <span>Reservation ID:</span>
                <strong className="res-number-badge">#{confirmedReservation.reservationNumber || confirmedReservation._id}</strong>
              </div>
              <div className="bcd-row">
                <span>Table Number:</span>
                <strong>Table {confirmedReservation.tableId}</strong>
              </div>
              <div className="bcd-row">
                <span>Reservation Date & Time:</span>
                <strong>{confirmedReservation.reservationDate} at {formatTime12Hour(confirmedReservation.timeSlot)}</strong>
              </div>
              <div className="bcd-row">
                <span>Guest Count:</span>
                <strong>{confirmedReservation.guestCount} Guests</strong>
              </div>
              <div className="bcd-row">
                <span>Customer Details:</span>
                <strong>{confirmedReservation.customerName} ({confirmedReservation.customerPhone}{confirmedReservation.customerEmail ? ` • ${confirmedReservation.customerEmail}` : ''})</strong>
              </div>
              {confirmedReservation.specialRequests && (
                <div className="bcd-row">
                  <span>Occasion / Requests:</span>
                  <strong>{confirmedReservation.specialRequests}</strong>
                </div>
              )}
              <div className="bcd-row">
                <span>Booking Status:</span>
                <span className="bci-status status-confirmed">Confirmed ✓</span>
              </div>
              <div className="bcd-row">
                <span>Duration:</span>
                <strong>{confirmedReservation.durationMinutes || 90} Minutes</strong>
              </div>
            </div>

            {/* Smart Pre-Order Callout */}
            <div className="preorder-callout-box">
              <div className="pc-icon">🍽️</div>
              <div className="pc-text">
                <strong>Want your dishes served right when you arrive?</strong>
                <p>Pre-order your food now. The kitchen will schedule cooking so everything is freshly served upon your arrival.</p>
              </div>
            </div>

            <div className="bcd-actions">
              <button
                type="button"
                className="btn-preorder-now"
                onClick={handleProceedToPreOrder}
              >
                Pre-Order Food Now 🍽️ →
              </button>
              <button
                type="button"
                className="btn-view-bookings-modal"
                onClick={() => {
                  const phone = confirmedReservation.customerPhone;
                  setConfirmedReservation(null);
                  setLookupPhone(phone);
                  setShowMyBookings(true);
                  fetchMyReservations(phone);
                }}
              >
                📅 View My Bookings
              </button>
              <button
                type="button"
                className="btn-reserve-only"
                onClick={() => {
                  setConfirmedReservation(null);
                  setSelectedTable(null);
                  toast.info('Table booked! You can place food orders at the restaurant.');
                  fetchAvailableTables();
                }}
              >
                Done (Book Another Table)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Bookings Lookup Drawer */}
      {showMyBookings && (
        <div className="modal-backdrop" onClick={() => setShowMyBookings(false)}>
          <div className="my-bookings-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mbs-header">
              <h3>📅 My Table Reservations</h3>
              <button type="button" className="mbs-close" onClick={() => setShowMyBookings(false)}>✕</button>
            </div>

            {/* Phone search */}
            <form
              className="mbs-search-row"
              onSubmit={(e) => {
                e.preventDefault();
                fetchMyReservations(lookupPhone);
              }}
            >
              <input
                type="tel"
                placeholder="Enter phone number to view bookings..."
                value={lookupPhone}
                onChange={(e) => setLookupPhone(e.target.value)}
                className="mbs-input"
              />
              <button
                type="submit"
                className="mbs-btn-find"
                disabled={loadingBookings}
              >
                {loadingBookings ? 'Searching...' : 'Find'}
              </button>
            </form>

            {/* Bookings list */}
            <div className="mbs-list">
              {loadingBookings ? (
                <div className="mbs-loading-state">
                  <div className="mini-spinner dark" />
                  <p>Searching reservations in MongoDB...</p>
                </div>
              ) : myBookings.length === 0 ? (
                <div className="mbs-empty">
                  <p>No active reservations found.</p>
                  <small>Enter the contact phone used during booking to check status.</small>
                </div>
              ) : (
                myBookings.map(res => (
                  <div key={res._id} className="booking-card-item">
                    <div className="bci-head">
                      <span className="bci-num">#{res.reservationNumber}</span>
                      <span className={`bci-status status-${res.status}`}>{res.status}</span>
                    </div>

                    <div className="bci-details">
                      <div><strong>Table:</strong> Table {res.tableId} ({res.guestCount} Guests)</div>
                      <div><strong>Schedule:</strong> {res.reservationDate} at {formatTime12Hour(res.timeSlot)}</div>
                      <div><strong>Customer:</strong> {res.customerName} ({res.customerPhone})</div>
                      {res.specialRequests && <div><strong>Occasion:</strong> {res.specialRequests}</div>}
                      {res.linkedOrderId && (
                        <div className="bci-preorder-tag">
                          🍽️ Food Pre-Ordered: <strong>{res.linkedOrderId.orderNumber || 'Linked'}</strong> ({res.preOrderStatus})
                        </div>
                      )}
                    </div>

                    {res.status === 'confirmed' && (
                      <div className="bci-actions">
                        {!res.linkedOrderId && (
                          <button
                            type="button"
                            className="btn-bci-preorder"
                            onClick={() => {
                              setShowMyBookings(false);
                              localStorage.setItem('activeReservation', JSON.stringify(res));
                              navigate(`/menu/restaurant123/${res.tableId}`);
                            }}
                          >
                            + Pre-Order Food
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-bci-cancel"
                          onClick={() => handleCancelReservation(res._id)}
                        >
                          Cancel Booking
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TableSelection;
