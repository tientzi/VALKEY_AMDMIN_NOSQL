import React, { useContext } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'
import { 
  LayoutDashboard, FolderKanban, Apple, PackageCheck, Tag, ShoppingBag, 
  Users, Star, LogOut, Home, ClipboardList, Truck, FileText, CalendarRange,
  BarChart3, Receipt, CreditCard, Building2, ShoppingCart, Layers
} from 'lucide-react'
import './Layouts.css'

const AdminLayout = () => {
  const { user, logout } = useContext(AuthContext)
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const adminMenuGroups = [
    {
      group: 'BÁO CÁO',
      items: [
        { path: '/admin/reports', name: 'Báo cáo tổng quan', icon: <BarChart3 size={18} /> },
      ]
    },
    {
      group: 'QUẢN LÝ ĐƠN HÀNG',
      items: [
        { path: '/admin/orders', name: 'Đơn hàng', icon: <ShoppingBag size={18} /> },
        { path: '/admin/deliveries', name: 'Quản lý giao hàng', icon: <Truck size={18} /> },
        { path: '/admin/queue', name: 'Hàng đợi Valkey', icon: <Layers size={18} /> },
      ]
    },
    {
      group: 'QUẢN LÝ THANH TOÁN',
      items: [
        { path: '/admin/invoices', name: 'Quản lý hóa đơn', icon: <Receipt size={18} /> },
        { path: '/admin/payments', name: 'Quản lý thanh toán', icon: <CreditCard size={18} /> },
      ]
    },
    {
      group: 'SẢN PHẨM & KHO HÀNG',
      items: [
        { path: '/admin/products', name: 'Sản phẩm & Tồn kho', icon: <Apple size={18} /> },
        { path: '/admin/product-batches', name: 'Lô & Hạn sử dụng', icon: <CalendarRange size={18} /> },
        { path: '/admin/warehouse-history', name: 'Lịch sử & Nhập kho', icon: <ClipboardList size={18} /> },
        { path: '/admin/suppliers', name: 'Nhà cung cấp & Thương hiệu', icon: <Building2 size={18} /> },
      ]
    },
    {
      group: 'KHÁCH HÀNG & TIẾP THỊ',
      items: [
        { path: '/admin/coupons', name: 'Mã giảm giá', icon: <Tag size={18} /> },
        { path: '/admin/users', name: 'Người dùng', icon: <Users size={18} /> },
        { path: '/admin/reviews', name: 'Đánh giá', icon: <Star size={18} /> },
      ]
    }
  ]

  const shipperMenuGroups = [
    {
      group: 'GIAO HÀNG',
      items: [
        { path: '/shipper', name: 'Bảng giao hàng', icon: <Truck size={18} /> }
      ]
    }
  ]

  const menuGroups = user?.role === 'ROLE_SHIPPER' ? shipperMenuGroups : adminMenuGroups

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <span className="brand-title">MART ADMIN</span>
        </div>
        <nav className="sidebar-nav">
          {menuGroups.map((group, gIdx) => (
            <div key={gIdx} className="nav-group">
              <div className="nav-group-title">{group.group}</div>
              {group.items.map((item) => {
                const isActive = location.pathname === item.path || 
                  (item.path === '/admin/warehouse-history' && (location.pathname === '/admin/goods-receipts' || location.pathname === '/admin/inventory-ledger')) ||
                  (item.path === '/admin/products' && location.pathname === '/admin/inventory')
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-btn-sidebar">
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="admin-container">
        <header className="admin-header glass">
          <div className="header-title">
            <h2>Hệ thống quản trị Siêu thị MiniMart</h2>
          </div>
          <div className="header-admin-info">
            <Link to="/" className="btn btn-outline home-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Home size={16} /> Xem cửa hàng
            </Link>
            <div className="admin-profile">
              <span className="admin-name">{user?.fullName || 'Administrator'}</span>
              <span className="admin-badge">{user?.role === 'ROLE_SHIPPER' ? 'Shipper' : 'Quản trị viên'}</span>
            </div>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
