import React, { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import api from '../services/api'
import { User, Phone, Mail, Lock, Shield, Calendar } from 'lucide-react'
import './Profile.css'

const Profile = () => {
  const { user, updateUser } = useContext(AuthContext)
  
  const [profileData, setProfileData] = useState({
    username: '',
    email: '',
    fullName: '',
    phone: '',
    role: '',
    createdAt: ''
  })
  
  const [fullNameInput, setFullNameInput] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/api/users/profile')
        const data = response.data
        setProfileData(data)
        setFullNameInput(data.fullName || '')
        // Chỉ dùng phone nếu nó là số điện thoại thật (không chứa @)
        const validPhone = data.phone && !data.phone.includes('@') ? data.phone : ''
        setPhoneInput(validPhone)
      } catch (err) {
        console.error('Không thể lấy thông tin cá nhân', err)
        setMessage({ type: 'error', text: 'Không thể tải thông tin cá nhân. Vui lòng thử lại sau.' })
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })

    // Validate Full Name
    if (!fullNameInput.trim()) {
      setMessage({ type: 'error', text: 'Họ tên không được để trống' })
      return
    }

    // Validate Phone Number
    if (phoneInput && !/^0\d{9}$/.test(phoneInput)) {
      setMessage({ type: 'error', text: 'Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0' })
      return
    }

    // Validate Password
    if (newPassword) {
      if (newPassword.length < 8) {
        setMessage({ type: 'error', text: 'Mật khẩu mới phải chứa ít nhất 8 ký tự' })
        return
      }
      if (newPassword !== confirmPassword) {
        setMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp' })
        return
      }
    }

    setSaving(true)
    try {
      const updatePayload = {
        fullName: fullNameInput.trim(),
        phone: phoneInput.trim()
      }
      
      if (newPassword) {
        updatePayload.password = newPassword
        updatePayload.currentPassword = currentPassword
      }

      const response = await api.put('/api/users/profile', updatePayload)
      const updatedUser = response.data
      
      // Update UI state
      setProfileData(updatedUser)
      setFullNameInput(updatedUser.fullName || '')
      // Đảm bảo không hiển thị email vào phone
      const validPhone = updatedUser.phone && !updatedUser.phone.includes('@') ? updatedUser.phone : ''
      setPhoneInput(validPhone)
      
      // Clear password fields
      setNewPassword('')
      setConfirmPassword('')

      // Sync with Context / LocalStorage so the top menu updates
      updateUser({ fullName: updatedUser.fullName })

      setMessage({ type: 'success', text: 'Cập nhật thông tin cá nhân thành công!' })
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: err.response?.data?.error || 'Có lỗi xảy ra khi cập nhật thông tin.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="loading-state">Đang tải thông tin cá nhân...</div>
  }

  // Lấy chữ cái đầu của tên để làm avatar đại diện
  const getAvatarChar = () => {
    const name = fullNameInput || profileData.username || 'U'
    return name.charAt(0).toUpperCase()
  }

  return (
    <div className="profile-page">
      <div className="profile-sidebar glass">
        <div className="avatar-container">
          {getAvatarChar()}
        </div>
        <h3 className="profile-username">{profileData.fullName || profileData.username}</h3>
        <span className="profile-role">
          {profileData.role === 'ROLE_ADMIN' ? 'Quản trị viên' : 'Khách hàng'}
        </span>
        
        <div className="profile-meta-info">
          <div className="meta-item">
            <span className="meta-label">Username</span>
            <span className="meta-value">{profileData.username}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Hạng thành viên</span>
            <span className="meta-value" style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
              {profileData.membershipTier || 'BRONZE'}
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Điểm tích lũy</span>
            <span className="meta-value">
              {profileData.loyaltyPoints || 0} điểm
            </span>
          </div>
          {profileData.createdAt && (
            <div className="meta-item">
              <span className="meta-label">Thành viên từ</span>
              <span className="meta-value">
                <Calendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                {new Date(profileData.createdAt).toLocaleDateString('vi-VN')}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="profile-main-content glass">
        <h2 className="profile-title">Thông tin cá nhân</h2>
        <p className="profile-subtitle">Xem và cập nhật thông tin hồ sơ của bạn</p>

        {message.text && (
          <div className={`profile-alert ${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label>Họ và Tên</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  placeholder="Nhập họ và tên..."
                  value={fullNameInput}
                  onChange={(e) => setFullNameInput(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Số điện thoại</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  name="phone"
                  id="phone"
                  autoComplete="tel"
                  placeholder="Nhập số điện thoại..."
                  value={phoneInput}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Địa chỉ Email (Không thể thay đổi)</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                disabled
                value={profileData.email}
                style={{ backgroundColor: 'var(--gray-100)', cursor: 'not-allowed' }}
              />
            </div>
          </div>

          <div className="form-divider">
            <h4 className="section-legend">Đổi mật khẩu</h4>
          </div>

          <div className="form-grid-2">
            <div className="form-group"><label>Mật khẩu hiện tại</label><input type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} /></div>
              <div className="form-group">
              <label>Mật khẩu mới</label>
              <input
                type="password"
                name="newPassword"
                autoComplete="new-password"
                placeholder="Tối thiểu 8 ký tự..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Xác nhận mật khẩu mới</label>
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu mới..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="profile-actions">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary save-profile-btn"
            >
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Profile
