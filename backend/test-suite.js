// Automated Test Suite for DISHDASH Table Reservation & Food Pre-Ordering System
const assert = require('assert');

const BASE_URL = process.env.API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let body;
  try {
    body = await res.json();
  } catch (err) {
    body = null;
  }
  return { status: res.status, ok: res.ok, body };
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 STARTING DISHDASH AUTOMATED TEST SUITE');
  console.log(`📡 Target API: ${BASE_URL}`);
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    process.stdout.write(`TEST: ${name}... `);
    try {
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      failed++;
    }
  }

  // 1. Health & Menu check
  await test('Public Menu returns items with trusted database prices', async () => {
    const res = await request('/api/menu');
    assert.strictEqual(res.status, 200, 'Expected status 200');
    assert(res.body && typeof res.body === 'object', 'Expected object with categories');
    const categories = Object.keys(res.body);
    assert(categories.length > 0, 'Expected menu categories to be present');
    const firstCat = res.body[categories[0]];
    assert(Array.isArray(firstCat) && firstCat.length > 0, 'Expected items in category');
    assert(firstCat[0].price > 0, 'Expected positive price');
  });

  // 2. Reservation Table Availability
  const runId = Date.now() % 1000000;
  const randomMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const randomDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  const testDate = `2029-${randomMonth}-${randomDay}`;
  const testSlot = '19:30';
  const testNonOverlapSlot = '12:00';
  const testPhone = `999${String(runId).padStart(7, '0')}`;

  await test('Table Availability filters by capacity and slot', async () => {
    const res = await request(`/api/reservations/available-tables?date=${testDate}&timeSlot=${testSlot}&guestCount=4`);
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.tables), 'Expected tables array');
    assert.strictEqual(res.body.tables.length, 10, 'Expected 10 restaurant tables');

    // Tables with seats < 4 must have status 'capacity_exceeded' and canBook=false
    const smallTable = res.body.tables.find(t => t.seats < 4);
    assert(smallTable, 'Expected small table');
    assert.strictEqual(smallTable.canBook, false, 'Small table should not be bookable for 4 guests');
    assert.strictEqual(smallTable.status, 'capacity_exceeded');

    // Tables with seats >= 4 should be bookable
    const suitableTable = res.body.tables.find(t => t.seats >= 4);
    assert(suitableTable, 'Expected suitable table');
    assert.strictEqual(suitableTable.canBook, true, 'Suitable table should be bookable');
  });

  // 3. Past Date Rejection
  await test('Table Availability rejects past reservation dates', async () => {
    const res = await request('/api/reservations/available-tables?date=2020-01-01&timeSlot=12:00&guestCount=2');
    assert.strictEqual(res.status, 400, 'Past date should return 400');
    assert(res.body.message && res.body.message.includes('past'), 'Expected past date error message');
  });

  // 4. Guest Count Exceeding Capacity Rejection on Booking
  await test('Reservation Booking rejects guest count exceeding table seats', async () => {
    const res = await request('/api/reservations', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Test Overcapacity',
        customerPhone: '9876543210',
        tableId: 1, // seats 2
        guestCount: 6, // exceeds 2
        reservationDate: testDate,
        timeSlot: testSlot
      })
    });
    assert.strictEqual(res.status, 400, 'Overcapacity booking must return 400');
    assert(res.body.message && (res.body.message.toLowerCase().includes('capacity') || res.body.message.toLowerCase().includes('seats')), 'Expected capacity error');
  });

  // 5. Successful Table Reservation
  let createdReservationId = null;
  let createdReservationNumber = null;

  await test('Customer successfully books an available table', async () => {
    const res = await request('/api/reservations', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Interview Candidate',
        customerPhone: testPhone,
        customerEmail: 'candidate@example.com',
        tableId: 4, // Table 4 has 4 seats
        guestCount: 3,
        reservationDate: testDate,
        timeSlot: testSlot,
        specialRequests: 'Window view preferred'
      })
    });

    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}: ${JSON.stringify(res.body)}`);
    const reservation = res.body.reservation || res.body;
    assert(reservation, 'Expected reservation object');
    assert.strictEqual(String(reservation.tableId), '4');
    assert.strictEqual(reservation.guestCount, 3);
    assert.strictEqual(reservation.status, 'confirmed');
    assert(reservation.reservationNumber, 'Expected reservation number');
    assert.strictEqual(reservation.endTime, '21:00', 'Expected 90m buffer end time');

    createdReservationId = reservation._id;
    createdReservationNumber = reservation.reservationNumber;
    assert.strictEqual(reservation.customerEmail, 'candidate@example.com', 'Expected customer email to be saved');
  });

  // 5b. Successful Table Reservation WITHOUT Email (Optional email support)
  await test('Customer successfully books a table WITHOUT an email address (optional email)', async () => {
    const res = await request('/api/reservations', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'No Email Diner',
        customerPhone: '9777766665',
        tableId: 5, // Table 5 has 4 seats
        guestCount: 2,
        reservationDate: testDate,
        timeSlot: testSlot
      })
    });

    assert.strictEqual(res.status, 201, `Expected 201 Created for booking without email: ${JSON.stringify(res.body)}`);
    const reservation = res.body.reservation || res.body;
    assert.strictEqual(String(reservation.tableId), '5');
    assert.strictEqual(reservation.status, 'confirmed');
    assert(!reservation.customerEmail, 'customerEmail should be undefined/null when not provided');
  });

  // 5c. Rejection of Invalid Email Format
  await test('Reservation booking rejects invalid email format with HTTP 400', async () => {
    const res = await request('/api/reservations', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Bad Email Guest',
        customerPhone: '9555544443',
        customerEmail: 'not-a-valid-email',
        tableId: 6,
        guestCount: 2,
        reservationDate: testDate,
        timeSlot: testSlot
      })
    });

    assert.strictEqual(res.status, 400, `Expected 400 Bad Request for invalid email format, got ${res.status}`);
    assert(res.body.message && res.body.message.toLowerCase().includes('valid email'), 'Expected valid email error message');
  });

  // 6. Overlapping Booking Prevention (Double Booking Rejection)
  await test('Concurrent / Overlapping booking for same table and time slot is rejected', async () => {
    const res = await request('/api/reservations', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Second Contender',
        customerPhone: '9123456780',
        tableId: 4,
        guestCount: 2,
        reservationDate: testDate,
        timeSlot: testSlot // Identical slot!
      })
    });

    assert.strictEqual(res.status, 409, `Overlapping booking must return 409 Conflict, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body && res.body.message && (res.body.message.includes('already reserved') || res.body.message.includes('reserved')), `Expected collision message, got: ${JSON.stringify(res.body)}`);
  });

  // 7. Non-Overlapping Slot Allowed for Same Table
  await test('Same table can be booked for a different non-overlapping slot', async () => {
    const res = await request('/api/reservations', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Lunch Customer',
        customerPhone: '9123456789',
        tableId: 4,
        guestCount: 2,
        reservationDate: testDate,
        timeSlot: '12:00' // Non-overlapping slot
      })
    });

    assert.strictEqual(res.status, 201, 'Non-overlapping slot must succeed');
    const resv = res.body.reservation || res.body;
    assert.strictEqual(resv.timeSlot, '12:00');
  });

  // 8. Food Pre-Order linked to Confirmed Reservation
  let createdOrderId = null;

  await test('Food Pre-Order links to reservation and calculates preparation schedule', async () => {
    // Get valid menu items
    const menuRes = await request('/api/menu');
    const allDishes = Object.values(menuRes.body).flat();
    assert(allDishes.length >= 2, 'Need at least 2 dishes for test');

    const item1 = allDishes[0];
    const item2 = allDishes[1];

    const expectedTotal = (item1.price * 2) + (item2.price * 1);

    const orderRes = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 4,
        customerName: 'Interview Candidate',
        customerPhone: testPhone,
        items: [
          { menuItemId: item1._id, quantity: 2 },
          { menuItemId: item2._id, quantity: 1 }
        ],
        paymentType: 'online',
        isPaid: true,
        reservationId: createdReservationId
      })
    });

    assert.strictEqual(orderRes.status, 201, `Expected 201 Created: ${JSON.stringify(orderRes.body)}`);
    const order = orderRes.body;
    assert.strictEqual(order.isPreOrder, true, 'Order should be flagged as pre-order');
    assert.strictEqual(order.reservationId, createdReservationId, 'Order must link to reservation ID');
    assert.strictEqual(order.reservationNumber, createdReservationNumber);
    assert.strictEqual(order.totalAmount, expectedTotal, `Server total ${order.totalAmount} should equal calculated ${expectedTotal}`);
    assert(order.expectedArrivalTime, 'Expected arrival time');
    assert(order.estimatedReadyTime, 'Expected estimated ready time');
    assert(order.estimatedPrepDuration > 0, 'Expected positive prep duration');

    createdOrderId = order._id;

    // Verify linked reservation was updated with preOrderStatus = 'placed'
    const resLookup = await request(`/api/reservations/${createdReservationId}`);
    assert.strictEqual(resLookup.body.preOrderStatus, 'placed', 'Reservation preOrderStatus should be updated');
    assert.strictEqual(String(resLookup.body.linkedOrderId?._id || resLookup.body.linkedOrderId), String(createdOrderId), 'Reservation linkedOrderId should match');
  });

  // 9. Admin Login & Auth Protection
  let adminToken = null;

  await test('Admin login produces valid JWT token', async () => {
    const res = await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123'
      })
    });

    assert.strictEqual(res.status, 200, `Expected 200 Admin login: ${JSON.stringify(res.body)}`);
    assert(res.body.token, 'Expected JWT token');
    adminToken = res.body.token;
  });

  await test('Admin endpoints reject unauthorized requests', async () => {
    const res = await request('/api/admin/reservations');
    assert.strictEqual(res.status, 401, 'Unauthenticated request should return 401');
  });

  // 10. Kitchen Queue & Schedule Updates
  await test('Kitchen Queue displays pre-order with arrival schedule and table info', async () => {
    const res = await request('/api/admin/kitchen/queue', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body), 'Kitchen queue must return array');
    const orderInQueue = res.body.find(o => o._id === createdOrderId);
    assert(orderInQueue, 'Pre-order must appear in kitchen queue');
    assert.strictEqual(String(orderInQueue.tableId), '4');
    assert.strictEqual(orderInQueue.isPreOrder, true);
  });

  await test('Kitchen Delay update adds buffer and recalculates target ready time', async () => {
    const res = await request(`/api/admin/orders/${createdOrderId}/kitchen-delay`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ delayMinutes: 10 })
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.prepDelayMinutes, 10, 'Expected 10 minutes delay recorded');
  });

  // 11. Customer Reservation Lookup & Cancellation (Slot Release)
  await test('Customer can lookup their reservations by phone number', async () => {
    const res = await request(`/api/reservations?phone=${testPhone}`);
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body), 'Expected reservations array');
    const found = res.body.find(r => r._id === createdReservationId);
    assert(found, 'Customer must find their created reservation');
  });

  await test('Reservation cancellation releases table slot immediately', async () => {
    const cancelRes = await request(`/api/reservations/${createdReservationId}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ phone: testPhone })
    });

    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.body.reservation.status, 'cancelled');

    // Verify slot is now available again
    const availRes = await request(`/api/reservations/available-tables?date=${testDate}&timeSlot=${testSlot}&guestCount=2`);
    const table4 = availRes.body.tables.find(t => t.id === '4');
    assert(table4, 'Table 4 must exist');
    assert.strictEqual(table4.status, 'available', 'Table 4 must be available after cancellation');
    assert.strictEqual(table4.canBook, true, 'Table 4 must be bookable again');
  });

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
