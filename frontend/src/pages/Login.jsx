import React, { useState, useContext } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'
import { signInWithPopup } from 'firebase/auth'
import { firebaseAuth, googleProvider } from '../config/firebase'
import './Auth.css'

const Login = () => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, loginWithGoogle } = useContext(AuthContext)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Hiển thị lỗi nếu OAuth2 thất bại (redirect từ backend)
  const urlError = searchParams.get('error')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(usernameOrEmail, password, rememberMe)
      if (user.role === 'ROLE_ADMIN') {
        navigate('/admin')
      } else if (user.role === 'ROLE_SHIPPER') {
        navigate('/shipper')
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider)
      const idToken = await result.user.getIdToken()
      const user = await loginWithGoogle(idToken)
      if (user.role === 'ROLE_ADMIN') navigate('/admin')
      else if (user.role === 'ROLE_SHIPPER') navigate('/shipper')
      else navigate('/')
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user') setError('Bạn đã đóng cửa sổ đăng nhập Google.')
      else setError(typeof err === 'string' ? err : 'Đăng nhập Google thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card glass">
        <h2 className="auth-title">Chào mừng trở lại</h2>
        <p className="auth-subtitle">Đăng nhập vào tài khoản MiniMart của bạn</p>
        
        {(error || urlError) && (
          <div className="auth-error">{error || urlError}</div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Username hoặc Email</label>
            <input
              type="text"
              required
              placeholder="Nhập username hoặc email..."
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Mật khẩu</label>
            <input
              type="password"
              required
              placeholder="Nhập mật khẩu..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember Me</span>
            </label>
            <Link to="/forgot-password" style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>Quên mật khẩu?</Link>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary auth-btn">
            {loading ? 'Đang xác thực...' : 'Đăng nhập'}
          </button>
        </form>

        {/* Divider */}
        <div className="oauth-divider">
          <span className="oauth-divider-line" />
          <span className="oauth-divider-text">Hoặc đăng nhập với</span>
          <span className="oauth-divider-line" />
        </div>

        {/* OAuth2 Buttons */}
        <div className="oauth-buttons">
          <button
            id="btn-google-login"
            type="button"
            className="oauth-btn oauth-btn-google"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg className="oauth-icon" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Đăng nhập với Google
          </button>
        </div>

        <p className="auth-footer">
          Chưa có tài khoản? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: '600' }}>Đăng ký ngay</Link>
        </p>
      </div>
    </div>
  )
}

export default Login
