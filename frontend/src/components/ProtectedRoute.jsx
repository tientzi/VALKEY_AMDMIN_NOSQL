import React, { useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'

const ProtectedRoute = ({ children, requireAdmin, requireShipper }) => {
  const { isAuthenticated, isAdmin, isShipper, loading } = useContext(AuthContext)

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>Đang tải thông tin...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/forbidden" replace />
  }

  if (requireShipper && !isShipper) {
    return <Navigate to="/forbidden" replace />
  }

  return children
}

export default ProtectedRoute
