import React from 'react'
import { Link } from 'react-router-dom'

const Forbidden = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', textAlign: 'center', fontFamily: 'var(--font-primary)' }}>
      <h1 style={{ fontSize: '6rem', color: 'var(--primary)', marginBottom: '1rem' }}>403</h1>
      <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Truy cập bị từ chối!</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: '2rem', maxWidth: '500px' }}>Bạn không có quyền truy cập vào trang này. Trang này chỉ dành cho tài khoản có quyền Quản trị viên (ROLE_ADMIN).</p>
      <Link to="/" className="btn btn-primary">Quay lại Trang chủ</Link>
    </div>
  )
}

export default Forbidden
