import React, { useState, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'
import './Auth.css'

const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { forgotPassword } = useContext(AuthContext)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải chứa ít nhất 8 ký tự')
      return
    }

    setLoading(true)
    try {
      await forgotPassword(email, newPassword)
      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card glass">
        <h2 className="auth-title">Quên mật khẩu</h2>
        <p className="auth-subtitle">Nhập email để cập nhật mật khẩu mới của bạn</p>
        
        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">Đặt lại mật khẩu thành công! Đang chuyển hướng...</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email tài khoản</label>
            <input
              type="email"
              required
              placeholder="Nhập email tài khoản..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Mật khẩu mới (Tối thiểu 8 ký tự)</label>
            <input
              type="password"
              required
              placeholder="Nhập mật khẩu mới..."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary auth-btn">
            {loading ? 'Đang thực hiện...' : 'Đặt lại mật khẩu'}
          </button>
        </form>

        <p className="auth-footer">
          Quay lại <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '600' }}>Đăng nhập</Link>
        </p>
      </div>
    </div>
  )
}

export default ForgotPassword
