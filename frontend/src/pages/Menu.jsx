import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Menu = () => {
  const [menuItems, setMenuItems] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch menu items from backend
    axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/menu`)
      .then((response) => {
        setMenuItems(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching menu data:', error);
        setLoading(false);
      });
  }, []);

  const handleAddToCart = (item) => {
    alert(`Added ${item.name} to cart!`);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading menu...</div>;
  }

  // Check if there are no categories or items
  if (Object.keys(menuItems).length === 0) {
    return <h2 style={{ textAlign: 'center', marginTop: '50px' }}>No items available</h2>;
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Our Menu</h1>

      {Object.keys(menuItems).map((category) => (
        <div key={category} style={{ marginBottom: '40px' }}>
          <h2 style={{ borderBottom: '2px solid #ddd', paddingBottom: '10px' }}>
            {category}
          </h2>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '20px', 
            marginTop: '20px' 
          }}>
            {menuItems[category].map((item) => (
              <div 
                key={item._id} 
                style={{
                  border: '1px solid #eee',
                  borderRadius: '8px',
                  padding: '15px',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                }}
              >
                <h3 style={{ margin: '0 0 10px 0' }}>{item.name}</h3>
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
                  {item.description}
                </p>
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <strong style={{ fontSize: '18px', color: '#ff6b35' }}>
                    ₹{item.price}
                  </strong>
                  
                  <button 
                    onClick={() => handleAddToCart(item)}
                    style={{
                      background: '#ff6b35',
                      color: 'white',
                      border: 'none',
                      padding: '8px 15px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Menu;
