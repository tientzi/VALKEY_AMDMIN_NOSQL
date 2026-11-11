import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import ProtectedRoute from './components/ProtectedRoute'
import ChatBot from './components/ChatBot'

// Layouts
import UserLayout from './layouts/UserLayout'
import AdminLayout from './layouts/AdminLayout'

// User Pages
import Home from './pages/Home'
import ProductList from './pages/ProductList'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderHistory from './pages/OrderHistory'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Forbidden from './pages/Forbidden'
import OAuthCallback from './pages/OAuthCallback'
import Profile from './pages/Profile'
import Loyalty from './pages/Loyalty'

// Admin Pages
import ProductManager from './pages/admin/ProductManager'
import SupplierManager from './pages/admin/SupplierManager'
import ProductBatchManager from './pages/admin/ProductBatchManager'
import WarehouseHistoryManager from './pages/admin/WarehouseHistoryManager'
import CouponManager from './pages/admin/CouponManager'
import OrderManager from './pages/admin/OrderManager'
import InvoiceManager from './pages/admin/InvoiceManager'
import DeliveryManager from './pages/admin/DeliveryManager'
import PaymentManager from './pages/admin/PaymentManager'
import ReportManager from './pages/admin/ReportManager'
import UserManager from './pages/admin/UserManager'
import ReviewManager from './pages/admin/ReviewManager'
import QueueManager from './pages/admin/QueueManager'

// Shipper Pages
import ShipperDashboard from './pages/shipper/ShipperDashboard'

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Authentication Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/forbidden" element={<Forbidden />} />
            {/* OAuth2 Callback - nhận token sau đăng nhập Google/Facebook */}
            <Route path="/oauth2/callback" element={<OAuthCallback />} />

            {/* User Website Layout */}
            <Route path="/" element={<UserLayout />}>
              <Route index element={<Home />} />
              <Route path="products" element={<ProductList />} />
              <Route path="products/:id" element={<ProductDetail />} />
              <Route path="loyalty" element={<Loyalty />} />
              
              {/* Protected User Routes */}
              <Route 
                path="cart" 
                element={
                  <ProtectedRoute>
                    <Cart />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="checkout" 
                element={
                  <ProtectedRoute>
                    <Checkout />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="orders" 
                element={
                  <ProtectedRoute>
                    <OrderHistory />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />
            </Route>

            {/* Protected Admin Console Layout */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ReportManager />} />
              <Route path="products" element={<ProductManager />} />
              <Route path="suppliers" element={<SupplierManager />} />
              <Route path="warehouse-history" element={<WarehouseHistoryManager />} />
              <Route path="product-batches" element={<ProductBatchManager />} />
              {/* Redirects cho các trang đã gộp */}
              <Route path="categories" element={<Navigate to="/admin/products?tab=categories" replace />} />
              <Route path="inventory" element={<Navigate to="/admin/products" replace />} />
              <Route path="goods-receipts" element={<Navigate to="/admin/warehouse-history?tab=receipts" replace />} />
              <Route path="inventory-ledger" element={<Navigate to="/admin/warehouse-history?tab=ledger" replace />} />
              <Route path="coupons" element={<CouponManager />} />
              <Route path="orders" element={<OrderManager />} />
              <Route path="queue" element={<QueueManager />} />
              <Route path="invoices" element={<InvoiceManager />} />
              <Route path="deliveries" element={<DeliveryManager />} />
              <Route path="payments" element={<PaymentManager />} />
              <Route path="reports" element={<ReportManager />} />
              <Route path="users" element={<UserManager />} />
              <Route path="reviews" element={<ReviewManager />} />
            </Route>

            {/* Protected Shipper Layout */}
            <Route 
              path="/shipper" 
              element={
                <ProtectedRoute requireShipper={true}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ShipperDashboard />} />
            </Route>

            {/* Fallback Catch-All Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ChatBot />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  )
}

export default App
