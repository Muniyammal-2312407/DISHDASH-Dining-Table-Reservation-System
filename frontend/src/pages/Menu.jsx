import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Menu = () => {
  const [menuItems, setMenuItems] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch menu items from backend
    axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/menu`)
      .then((response) => {
        setMenuItems(response.data || {});
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
    return <div style={{ textAlign: 'center', padding: '50px', color: '#5C5E58' }}>Loading DISHDASH menu...</div>;
  }

  // Check if there are no categories or items
  if (Object.keys(menuItems).length === 0) {
    return <h2 style={{ textAlign: 'center', marginTop: '50px', color: '#292A27' }}>No items available</h2>;
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px', backgroundColor: '#F8F5EF', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '8px', color: '#984C35', fontSize: '2.2rem' }}>DISHDASH Menu</h1>
      <p style={{ textAlign: 'center', marginBottom: '32px', color: '#5C5E58', fontSize: '0.95rem' }}>Authentic Flavors • Prepared Fresh Upon Order</p>

      {Object.keys(menuItems).map((category) => (
        <div key={category} style={{ marginBottom: '40px' }}>
          <div style={{ borderBottom: '2px solid #E5E0D7', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={{ margin: 0, color: '#292A27', fontSize: '1.4rem' }}>{category}</h2>
            <span style={{ fontSize: '0.85rem', color: '#888580' }}>{menuItems[category].length} {menuItems[category].length === 1 ? 'dish' : 'dishes'}</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
            marginTop: '20px'
          }}>
            {menuItems[category].map((item, index) => (
              <div
                key={item._id || item.name || index}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E0D7',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ position: 'relative', width: '100%', height: '160px', backgroundColor: '#EFECE6', overflow: 'hidden' }}>
                    <img
                      src={item.image || '/images/food/neutral-food-placeholder.jpg'}
                      alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/images/food/neutral-food-placeholder.jpg';
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      backgroundColor: '#FFFFFF',
                      border: `1.5px solid ${item.isVegetarian !== false ? '#2E7D32' : '#D32F2F'}`,
                      borderRadius: '3px',
                      width: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: item.isVegetarian !== false ? '#2E7D32' : '#D32F2F'
                      }} />
                    </div>
                  </div>

                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <h3 style={{ margin: 0, color: '#292A27', fontSize: '1.05rem', fontWeight: '700' }}>{item.name}</h3>
                      <strong style={{ fontSize: '1.1rem', color: '#984C35', whiteSpace: 'nowrap' }}>₹{item.price}</strong>
                    </div>

                    <p style={{ color: '#5C5E58', fontSize: '13px', lineHeight: '1.45', margin: '0 0 12px 0' }}>
                      {item.description || 'Delicious dish freshly cooked upon order'}
                    </p>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {item.subCategory && (
                        <span style={{ fontSize: '11px', fontWeight: '600', backgroundColor: '#F0ECE4', color: '#7B3824', padding: '2px 6px', borderRadius: '4px', border: '1px solid #E5DCCE' }}>
                          {item.subCategory}
                        </span>
                      )}
                      {item.preparationTime && (
                        <span style={{ fontSize: '11px', color: '#888580' }}>⏱️ {item.preparationTime} mins</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '12px 16px',
                  borderTop: '1px solid #F2EDE4',
                  backgroundColor: '#FCFAF7',
                  display: 'flex',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    onClick={() => handleAddToCart(item)}
                    style={{
                      backgroundColor: '#984C35',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '13px',
                      transition: 'background 0.2s'
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
