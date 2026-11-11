import React, { useState, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'
import './Auth.css'

const Register = () => {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register } = useContext(AuthContext)
  const navigate = useNavigate()

  const validate = () => {
    if (password.length < 8) {
      return 'Mật khẩu phải chứa ít nhất 8 ký tự'
    }
    if (!/^0\d{9}$/.test(phone)) {
      return 'Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0'
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return 'Email không đúng định dạng'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    const clientErr = validate()
    if (clientErr) {
      setError(clientErr)
      return
    }

    setLoading(true)
    try {
      await register(username, email, password, fullName, phone)
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
        <h2 className="auth-title">Đăng ký tài khoản</h2>
        <p className="auth-subtitle">Tham gia mua sắm thực phẩm tươi sạch tại MiniMart</p>
        
        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">Đăng ký thành công! Đang chuyển đến trang đăng nhập...</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              required
              placeholder="Nhập tên đăng nhập..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Họ và tên</label>
            <input
              type="text"
              required
              placeholder="Nhập họ tên của bạn..."
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              required
              placeholder="Nhập email..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Số điện thoại</label>
            <input
              type="text"
              required
              placeholder="Nhập số điện thoại..."
              value={phone}
              inputMode="numeric"
              maxLength={10}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </div>

          <div className="form-group">
            <label>Mật khẩu (Tối thiểu 8 ký tự)</label>
            <input
              type="password"
              required
              placeholder="Nhập mật khẩu..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary auth-btn">
            {loading ? 'Đang đăng ký...' : 'Đăng ký tài khoản'}
          </button>
        </form>

        <p className="auth-footer">
          Đã có tài khoản? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '600' }}>Đăng nhập ngay</Link>
        </p>
      </div>
    </div>
  )
}

export default Register
