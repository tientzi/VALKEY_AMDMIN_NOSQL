import React, { useEffect, useContext, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'

/**
 * Trang trung gian nhận JWT token sau khi OAuth2 đăng nhập thành công
 * URL pattern: /oauth2/callback?token=xxx&id=1&username=abc&email=...&role=ROLE_USER
 */
const OAuthCallback = () => {
  const [searchParams] = useSearchParams()
  const { loginWithToken } = useContext(AuthContext)
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | success | error

  useEffect(() => {
    const token = searchParams.get('token')
    const error = searchParams.get('error')

    if (error) {
      setStatus('error')
      setTimeout(() => navigate('/login?error=' + encodeURIComponent(error)), 2000)
      return
    }

    if (!token) {
      setStatus('error')
      setTimeout(() => navigate('/login'), 2000)
      return
    }

    const id = searchParams.get('id')
    const username = searchParams.get('username')
    const email = searchParams.get('email')
    const role = searchParams.get('role')
    const avatarUrl = searchParams.get('avatarUrl')

    try {
      const userData = loginWithToken({ token, id, username, email, role, avatarUrl })
      
      // Redirect ngay lập tức, không qua trạng thái trung gian
      if (userData.role === 'ROLE_ADMIN') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (err) {
      navigate('/login', { replace: true })
    }
  }, [])

  // Ẩn hoàn toàn giao diện để chuyển hướng mượt mà
  return null
}

export default OAuthCallback
