import React, { useContext, useState } from 'react'
import { Outlet, Link, useNavigate, Navigate } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'
import { CartContext } from '../contexts/CartContext'
import { ShoppingCart, User as UserIcon, LogOut, Search, Store, Crown } from 'lucide-react'
import ChatBot from '../components/ChatBot'
import CustomerFeedbackWidget from '../components/CustomerFeedbackWidget'
import './Layouts.css'

const UserLayout = () => {
  const { user, isAuthenticated, logout, isAdmin } = useContext(AuthContext)
  const { totalItemsCount } = useContext(CartContext)
  const [keyword, setKeyword] = useState('')
  const navigate = useNavigate()

  if (isAuthenticated && isAdmin) {
    return <Navigate to="/admin" replace />
  }

  const handleSearch = (e) => {
    e.preventDefault()
    navigate(`/products?keyword=${encodeURIComponent(keyword)}`)
  }

  return (
    <div className="user-layout">
      <header className="user-header glass">
        <div className="header-container">
          <Link to="/" className="logo">
            <Store size={32} className="logo-icon" />
            <div className="logo-text">
              <span className="brand-name">MiniMart</span>
              <span className="brand-sub">Fresh & Convenience</span>
            </div>
          </Link>

          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm tươi sạch, thực phẩm..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-btn">
              <Search size={20} />
            </button>
          </form>

          <div className="header-actions">
            {/* VIP Loyalty Link */}
            <Link 
              to="/loyalty" 
              className="loyalty-header-badge" 
              title="Khách hàng thân thiết (VIP Loyalty)"
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px', 
                textDecoration: 'none', 
                color: '#d97706', 
                fontWeight: 600, 
                fontSize: '0.85rem', 
                padding: '6px 12px', 
                borderRadius: '20px', 
                background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.8), rgba(253, 230, 138, 0.4))', 
                border: '1px solid #fde68a',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
            >
              <Crown size={16} color="#d97706" />
              <span>VIP Loyalty</span>
            </Link>

            <Link to="/cart" className="cart-link">
              <ShoppingCart size={24} />
              {totalItemsCount > 0 && <span className="cart-badge">{totalItemsCount}</span>}
            </Link>

            {isAuthenticated ? (
              <div className="user-menu-container">
                <div className="user-info">
                  <UserIcon size={20} />
                  <span className="username">{user.fullName}</span>
                </div>
                <div className="user-dropdown">
                  <Link to="/profile" className="dropdown-item">Trang cá nhân</Link>
                  <Link to="/orders" className="dropdown-item">Lịch sử đơn hàng</Link>
                  <Link to="/loyalty" className="dropdown-item" style={{ color: '#d97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Crown size={16} /> VIP Loyalty & Ưu đãi
                  </Link>
                  {user?.role === 'ROLE_SHIPPER' && (
                    <Link to="/shipper" className="dropdown-item" style={{ color: '#2563eb', fontWeight: 'bold' }}>
                      🚚 Bảng điều khiển Shipper
                    </Link>
                  )}
                  <button onClick={logout} className="dropdown-item logout-btn">
                    <LogOut size={16} /> Đăng xuất
                  </button>
                </div>
              </div>
            ) : (
              <div className="auth-links">
                <Link to="/login" className="btn btn-outline login-btn">Đăng nhập</Link>
                <Link to="/register" className="btn btn-primary register-btn">Đăng ký</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="user-main">
        <Outlet />
      </main>

      <footer className="user-footer">
        <div className="footer-container">
          <div className="footer-col">
            <h3>Về MiniMart</h3>
            <p>Hệ thống siêu thị mini tiện lợi cung cấp thực phẩm tươi sạch mỗi ngày, sản phẩm gia dụng chất lượng cao, giá cả phải chăng, phục vụ chu đáo.</p>
          </div>
          <div className="footer-col">
            <h3>Liên hệ</h3>
            <p>Địa chỉ: 123 Đường Cầu Giấy, Hà Nội</p>
            <p>Hotline: 1800 6868</p>
            <p>Email: support@minimart.vn</p>
          </div>
          <div className="footer-col">
            <h3>Chính sách</h3>
            <a href="#">Chính sách giao hàng</a>
            <a href="#">Chính sách đổi trả</a>
            <a href="#">Chính sách bảo mật</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 MiniMart Supermarket. All rights reserved.</p>
        </div>
      </footer>
      <CustomerFeedbackWidget />
      <ChatBot />
    </div>
  )
}

export default UserLayout
