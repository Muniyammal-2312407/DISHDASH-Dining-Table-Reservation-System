import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import './TableSelection.css';

const API = 'http://localhost:4000';

const TableSelection = () => {
  const navigate = useNavigate();
  const [occupiedTables, setOccupiedTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [loading, setLoading] = useState(false);
  const restaurantId = 'restaurant123';
  const customerName = localStorage.getItem('customerName') || 'Customer';
  const tables = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Fetch orders to find occupied tables
  useEffect(() => {
    fetchOccupiedTables();
  }, []);

  const fetchOccupiedTables = async () => {
    try {
      const response = await axios.get(`${API}/api/tables/occupied`);
      setOccupiedTables(response.data.occupiedTables || []);
    } catch (error) {
      // If endpoint not available, show all tables as available
      setOccupiedTables([]);
    }
  };

  const handleTableSelect = (tableNumber) => {
    if (occupiedTables.includes(tableNumber.toString())) {
      toast.warning(`Table ${tableNumber} is currently occupied`);
      return;
    }
    setSelectedTable(tableNumber);
  };

  const handleProceedToMenu = () => {
    if (!selectedTable) {
      toast.error('Please select a table first');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      navigate(`/menu/${restaurantId}/${selectedTable}`);
    }, 400);
  };

  const handleBack = () => {
    navigate('/');
  };

  const getTableStatus = (tableNum) => {
    if (occupiedTables.includes(tableNum.toString())) return 'occupied';
    if (selectedTable === tableNum) return 'selected';
    return 'available';
  };

  const tableEmojis = ['🪑', '🍽️', '🥗', '🍜', '🍕', '🥘', '🍱', '🍣', '🥩', '🍰'];

  return (
    <div className="table-page">
      {/* Header */}
      <header className="table-header">
        <div className="header-inner">
          <button onClick={handleBack} className="back-btn">
            ← Back
          </button>
          <div className="header-brand">
            <span className="brand-emoji">🍽️</span>
            <span className="brand-name">Food Heaven</span>
          </div>
          <div className="header-customer">
            <span className="customer-avatar">{customerName.charAt(0).toUpperCase()}</span>
            <span className="customer-name">{customerName}</span>
          </div>
        </div>
      </header>

      <main className="table-main">
        <div className="table-container">
          {/* Title Section */}
          <div className="table-title">
            <h1>Select Your Table</h1>
            <p>Choose an available table to proceed with your order</p>
          </div>

          {/* Legend */}
          <div className="table-legend">
            <div className="legend-item">
              <div className="legend-dot available-dot" />
              <span>Available</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot selected-dot" />
              <span>Selected</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot occupied-dot" />
              <span>Occupied</span>
            </div>
          </div>

          {/* Tables Grid */}
          <div className="tables-grid">
            {tables.map((table) => {
              const status = getTableStatus(table);
              return (
                <button
                  key={table}
                  className={`table-btn table-${status}`}
                  onClick={() => handleTableSelect(table)}
                  disabled={status === 'occupied'}
                >
                  <div className="table-top">
                    <span className="table-emoji">{tableEmojis[table - 1]}</span>
                    {status === 'occupied' && <span className="occupied-badge">Busy</span>}
                    {status === 'selected' && <span className="selected-badge">✓</span>}
                  </div>
                  <div className="table-label">Table {table}</div>
                  <div className="table-status-text">
                    {status === 'available' && '4 Seats • Available'}
                    {status === 'selected' && '4 Seats • Selected'}
                    {status === 'occupied' && 'Currently Occupied'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Proceed Button */}
          {selectedTable && (
            <div className="proceed-bar">
              <div className="proceed-info">
                <span className="proceed-table">Table {selectedTable} Selected</span>
                <span className="proceed-hint">Ready to browse the menu?</span>
              </div>
              <button
                className="proceed-to-menu-btn"
                onClick={handleProceedToMenu}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-sm" />
                    Loading Menu...
                  </>
                ) : (
                  <>View Menu 🍽️</>
                )}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TableSelection;
