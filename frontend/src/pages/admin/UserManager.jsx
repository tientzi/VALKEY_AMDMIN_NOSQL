import React, { useState, useEffect, useRef } from 'react'
import api from '../../services/api'
import { 
  User, Shield, Lock, Unlock, Mail, Phone, Calendar, Search, 
  Eye, MessageSquare, Send, Award, MapPin, ShoppingBag, 
  CheckCircle, XCircle, Clock, RefreshCw, X, ArrowRight, Star
} from 'lucide-react'
import { matchesRelative } from '../../utils/searchUtils'
import './AdminPages.css'

const UserManager = () => {
  // Tabs: 'users' | 'messages'
  const [activeTab, setActiveTab] = useState('users')

  // State quản lý người dùng
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [error, setError] = useState('')

  // State xem chi tiết người dùng
  const [selectedUserDetail, setSelectedUserDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // State tin nhắn & phản hồi
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [replyContent, setReplyContent] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchConvTerm, setSearchConvTerm] = useState('')
  const messagesEndRef = useRef(null)

  // 1. Tải danh sách người dùng
  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/admin/users')
      setUsers(response.data)
      setFilteredUsers(response.data)
    } catch (err) {
      console.error('Lỗi khi tải danh sách người dùng:', err)
      setError('Không thể lấy danh sách người dùng')
    } finally {
      setLoading(false)
    }
  }

  // 2. Tải danh sách hội thoại tin nhắn
  const fetchConversations = async () => {
    try {
      const [convRes, countRes] = await Promise.all([
        api.get('/api/admin/messages/conversations'),
        api.get('/api/admin/messages/unread-count')
      ])
      setConversations(convRes.data)
      setUnreadCount(countRes.data?.unreadCount || 0)
    } catch (err) {
      console.error('Lỗi khi tải tin nhắn phản hồi:', err)
    }
  }

  // 3. Tải tin nhắn của cuộc hội thoại đang chọn
  const fetchMessagesOfUser = async (userId) => {
    try {
      const res = await api.get(`/api/admin/messages/conversations/${userId}`)
      setMessages(res.data)
      // Cập nhật lại số lượng tin chưa đọc
      fetchConversations()
    } catch (err) {
      console.error('Lỗi khi tải tin nhắn chi tiết:', err)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchConversations()
    
    // Polling nhẹ mỗi 10 giây để nhận phản hồi mới từ khách hàng
    const interval = setInterval(() => {
      fetchConversations()
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // Cuộn xuống tin nhắn mới nhất khi có tin mới
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Lọc người dùng theo từ khóa tìm kiếm
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users)
    } else {
      setFilteredUsers(
        users.filter(u => 
          matchesRelative([u.username, u.email, u.fullName, u.phone, u.role?.name, u.membershipTier], searchTerm)
        )
      )
    }
  }, [searchTerm, users])

  // Xem chi tiết khách hàng
  const handleViewUserDetail = async (userId) => {
    setLoadingDetail(true)
    try {
      const res = await api.get(`/api/admin/users/${userId}/details`)
      setSelectedUserDetail(res.data)
    } catch (err) {
      console.error('Lỗi tải chi tiết người dùng:', err)
      alert(err.response?.data?.error || 'Không thể lấy thông tin chi tiết người dùng')
    } finally {
      setLoadingDetail(false)
    }
  }

  // Khóa / Mở khóa tài khoản
  const handleToggleStatus = async (user) => {
    const action = user.isActive ? 'KHOÁ' : 'MỞ KHOÁ'
    if (!window.confirm(`Bạn có chắc chắn muốn ${action} tài khoản của "${user.fullName || user.username}"?`)) return
    
    setUpdatingId(user.id)
    setError('')
    try {
      await api.put(`/api/admin/users/${user.id}/toggle-status`)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u))
      if (selectedUserDetail && selectedUserDetail.id === user.id) {
        setSelectedUserDetail(prev => ({ ...prev, isActive: !prev.isActive }))
      }
      alert(`Đã ${action.toLowerCase()} tài khoản thành công!`)
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Lỗi khi thay đổi trạng thái tài khoản')
    } finally {
      setUpdatingId(null)
    }
  }

  // Chọn cuộc hội thoại để chat
  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv)
    fetchMessagesOfUser(conv.userId)
  }

  // Admin gửi tin nhắn trả lời
  const handleSendReply = async (e) => {
    e.preventDefault()
    if (!replyContent.trim() || !selectedConversation) return

    setSendingReply(true)
    try {
      const res = await api.post(`/api/admin/messages/conversations/${selectedConversation.userId}/reply`, {
        message: replyContent.trim()
      })
      setMessages(prev => [...prev, res.data])
      setReplyContent('')
      fetchConversations()
    } catch (err) {
      console.error('Lỗi khi gửi phản hồi:', err)
      alert(err.response?.data?.error || 'Không thể gửi phản hồi')
    } finally {
      setSendingReply(false)
    }
  }

  // Helper định dạng ngày
  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    return date.toLocaleDateString('vi-VN')
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Badge Rank VIP
  const renderRankBadge = (tier) => {
    const t = (tier || 'BRONZE').toUpperCase()
    if (t === 'DIAMOND') {
      return <span style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>💎 Kim Cương</span>
    }
    if (t === 'GOLD') {
      return <span style={{ background: 'linear-gradient(135deg, #d97706, #fbbf24)', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>🥇 Vàng</span>
    }
    if (t === 'SILVER') {
      return <span style={{ background: 'linear-gradient(135deg, #64748b, #94a3b8)', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>🥈 Bạc</span>
    }
    return <span style={{ background: 'linear-gradient(135deg, #b45309, #d97706)', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>🥉 Đồng</span>
  }

  // Badge trạng thái đơn hàng
  const renderOrderStatusBadge = (status) => {
    switch (status) {
      case 'CHO_TIEP_NHAN':
        return <span className="badge-warning" style={{ fontSize: '0.75rem', padding: '3px 6px', borderRadius: '4px', background: '#fef3c7', color: '#b45309' }}>Chờ tiếp nhận</span>
      case 'CHO_XAC_NHAN':
        return <span className="badge-warning" style={{ fontSize: '0.75rem', padding: '3px 6px', borderRadius: '4px' }}>Chờ duyệt</span>
      case 'DA_XAC_NHAN':
      case 'DA_THANH_TOAN':
        return <span className="badge-primary" style={{ fontSize: '0.75rem', padding: '3px 6px', borderRadius: '4px' }}>Đã xác nhận</span>
      case 'DANG_GIAO':
      case 'DA_NHAN_DON':
        return <span style={{ background: '#0284c7', color: '#fff', fontSize: '0.75rem', padding: '3px 6px', borderRadius: '4px' }}>Đang giao</span>
      case 'DA_GIAO':
      case 'HOAN_THANH':
      case 'COMPLETED':
        return <span className="badge-success" style={{ fontSize: '0.75rem', padding: '3px 6px', borderRadius: '4px' }}>Hoàn thành</span>
      case 'TU_CHOI':
        return <span className="badge-danger" style={{ fontSize: '0.75rem', padding: '3px 6px', borderRadius: '4px', background: '#fee2e2', color: '#b91c1c' }}>Từ chối (Hết hàng)</span>
      case 'HUY':
      case 'DA_HUY':
      case 'CANCELLED':
        return <span className="badge-danger" style={{ fontSize: '0.75rem', padding: '3px 6px', borderRadius: '4px' }}>Đã hủy</span>
      default:
        return <span style={{ fontSize: '0.75rem', padding: '3px 6px', borderRadius: '4px', background: '#e2e8f0' }}>{status}</span>
    }
  }

  // Danh sách hội thoại lọc theo từ khóa
  const filteredConversations = conversations.filter(c => 
    !searchConvTerm.trim() || matchesRelative([c.userName, c.fullName, c.userEmail, c.userPhone], searchConvTerm)
  )

  if (loading) {
    return <div className="loading-state">Đang tải dữ liệu người dùng...</div>
  }

  return (
    <div className="admin-crud-page">
      {/* Top Header & Tabs */}
      <div className="crud-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--admin-border)', paddingBottom: '1rem' }}>
        <div>
          <h2>Quản lý Người dùng & Khách hàng</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
            Xem hồ sơ, cấp bậc VIP, lịch sử mua sắm và trao đổi tin nhắn phản hồi trực tiếp với khách hàng.
          </p>
        </div>

        {/* Thanh chuyển Tab */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.05)', padding: '4px', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-outline'}`}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '0.875rem',
              padding: '0.45rem 1rem'
            }}
          >
            <User size={16} /> Danh sách người dùng ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            className={`btn ${activeTab === 'messages' ? 'btn-primary' : 'btn-outline'}`}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '0.875rem',
              padding: '0.45rem 1rem',
              position: 'relative'
            }}
          >
            <MessageSquare size={16} /> Tin nhắn & Phản hồi
            {unreadCount > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                padding: '1px 6px',
                borderRadius: '10px',
                marginLeft: '4px'
              }}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {error && <div className="form-error margin-top-md">{error}</div>}

      {/* ================= TAB 1: DANH SÁCH NGƯỜI DÙNG ================= */}
      {activeTab === 'users' && (
        <div style={{ marginTop: '1.25rem' }}>
          {/* Thanh công cụ tìm kiếm */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <input 
                type="text" 
                placeholder="Tìm theo tên, email, SĐT, rank..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--admin-card-bg)',
                  color: 'var(--admin-text-primary)',
                  border: '1px solid var(--admin-border)',
                  padding: '0.6rem 1rem 0.6rem 2.5rem',
                  borderRadius: '8px',
                  fontSize: '0.9rem'
                }}
              />
              <Search 
                size={16} 
                style={{ 
                  position: 'absolute', 
                  left: '10px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--admin-text-secondary)'
                }} 
              />
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Hiển thị <strong>{filteredUsers.length}</strong> / {users.length} tài khoản
            </div>
          </div>

          {/* Bảng người dùng */}
          <div className="admin-table-container glass">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Người dùng</th>
                  <th>Liên hệ</th>
                  <th>Hạng thành viên</th>
                  <th>Vai trò</th>
                  <th>Ngày tham gia</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map(user => (
                    <tr key={user.id}>
                      <td>#{user.id}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: 'rgba(37, 99, 235, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#2563eb',
                            fontWeight: 'bold',
                            fontSize: '0.9rem'
                          }}>
                            {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong>{user.fullName || '—'}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>@{user.username}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.85rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Mail size={12} className="text-muted" /> {user.email}
                          </span>
                          {user.phone && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Phone size={12} className="text-muted" /> {user.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {renderRankBadge(user.membershipTier)}
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {user.loyaltyPoints || 0} điểm tích lũy
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.25rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          background: user.role === 'ROLE_ADMIN' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: user.role === 'ROLE_ADMIN' ? 'var(--admin-danger)' : 'var(--admin-primary)'
                        }}>
                          {user.role === 'ROLE_ADMIN' ? <Shield size={12} /> : <User size={12} />}
                          {user.role === 'ROLE_ADMIN' ? 'Quản trị viên' : 'Khách hàng'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--admin-text-secondary)' }}>
                          <Calendar size={13} /> {formatDate(user.createdAt)}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${user.isActive ? 'active' : 'inactive'}`}>
                          {user.isActive ? 'Hoạt động' : 'Đang khóa'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          {/* Nút Xem chi tiết */}
                          <button
                            type="button"
                            onClick={() => handleViewUserDetail(user.id)}
                            className="btn btn-outline"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Xem chi tiết hồ sơ, rank, địa chỉ và đơn hàng"
                          >
                            <Eye size={13} /> Chi tiết
                          </button>

                          {/* Nút Khóa / Mở khóa */}
                          {user.role !== 'ROLE_ADMIN' && (
                            <button 
                              onClick={() => handleToggleStatus(user)} 
                              disabled={updatingId === user.id}
                              className={`btn ${user.isActive ? 'btn-outline' : 'btn-primary'}`}
                              style={{ 
                                padding: '0.35rem 0.65rem', 
                                fontSize: '0.8rem',
                                background: user.isActive ? 'transparent' : 'linear-gradient(135deg, #10b981, #059669)',
                                borderColor: user.isActive ? 'var(--admin-danger)' : 'none',
                                color: user.isActive ? 'var(--admin-danger)' : '#fff'
                              }}
                              title={user.isActive ? 'Khóa tài khoản này' : 'Mở khóa tài khoản'}
                            >
                              {user.isActive ? <Lock size={13} /> : <Unlock size={13} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-secondary)' }}>
                      Không tìm thấy người dùng nào phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: TIN NHẮN & PHẢN HỒI HAI CHIỀU ================= */}
      {activeTab === 'messages' && (
        <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem', minHeight: '600px' }}>
          {/* Cột Trái: Danh sách cuộc trò chuyện */}
          <div className="glass" style={{ borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', height: '650px', background: 'var(--admin-card-bg)', border: '1px solid var(--admin-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={16} /> Phản hồi khách hàng
              </h3>
              <button 
                type="button" 
                onClick={fetchConversations} 
                className="btn btn-outline" 
                style={{ padding: '4px 8px', fontSize: '0.75rem' }} 
                title="Tải lại danh sách"
              >
                <RefreshCw size={12} />
              </button>
            </div>

            {/* Ô tìm kiếm khách trong danh sách chat */}
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <input 
                type="text" 
                placeholder="Tìm khách hàng..."
                value={searchConvTerm}
                onChange={e => setSearchConvTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.6rem 0.45rem 2rem',
                  fontSize: '0.85rem',
                  borderRadius: '6px',
                  border: '1px solid var(--admin-border)',
                  background: 'rgba(0,0,0,0.02)'
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>

            {/* Danh sách hội thoại */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {filteredConversations.length > 0 ? (
                filteredConversations.map(conv => {
                  const isSelected = selectedConversation?.userId === conv.userId
                  return (
                    <div 
                      key={conv.userId}
                      onClick={() => handleSelectConversation(conv)}
                      style={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: isSelected ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                        border: isSelected ? '1px solid #2563eb' : '1px solid transparent',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem'
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '0.9rem', color: isSelected ? '#2563eb' : 'inherit' }}>
                            {conv.fullName || conv.userName}
                          </strong>
                          {renderRankBadge(conv.membershipTier)}
                        </div>
                        {conv.unreadCount > 0 && (
                          <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 'bold', padding: '1px 5px', borderRadius: '10px' }}>
                            {conv.unreadCount} mới
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748b' }}>
                        <span style={{ 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          maxWidth: '190px',
                          fontWeight: conv.unreadCount > 0 ? 600 : 'normal',
                          color: conv.unreadCount > 0 ? '#0f172a' : '#64748b'
                        }}>
                          {conv.lastSenderType === 'ADMIN' ? 'Bạn: ' : ''}{conv.lastMessage || '...'}
                        </span>
                        <span style={{ fontSize: '0.7rem' }}>
                          {conv.lastMessageTime ? new Date(conv.lastMessageTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                  {searchConvTerm ? 'Không tìm thấy khách hàng nào' : 'Chưa có tin nhắn phản hồi nào từ khách hàng'}
                </div>
              )}
            </div>
          </div>

          {/* Cột Phải: Khung Chat 2 Chiều */}
          <div className="glass" style={{ borderRadius: '12px', display: 'flex', flexDirection: 'column', height: '650px', background: 'var(--admin-card-bg)', border: '1px solid var(--admin-border)', overflow: 'hidden' }}>
            {selectedConversation ? (
              <>
                {/* Header cuộc trò chuyện */}
                <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold'
                    }}>
                      {selectedConversation.fullName ? selectedConversation.fullName.charAt(0).toUpperCase() : selectedConversation.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '1rem' }}>{selectedConversation.fullName || selectedConversation.userName}</strong>
                        {renderRankBadge(selectedConversation.membershipTier)}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Email: {selectedConversation.userEmail} {selectedConversation.userPhone ? `| SĐT: ${selectedConversation.userPhone}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      type="button" 
                      onClick={() => handleViewUserDetail(selectedConversation.userId)}
                      className="btn btn-outline"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Eye size={14} /> Xem hồ sơ
                    </button>
                    <button 
                      type="button" 
                      onClick={() => fetchMessagesOfUser(selectedConversation.userId)}
                      className="btn btn-outline"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                      title="Làm mới tin nhắn"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                {/* Vùng hiển thị tin nhắn */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.015)' }}>
                  {messages.map(msg => {
                    const isAdmin = msg.senderType === 'ADMIN'
                    return (
                      <div 
                        key={msg.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isAdmin ? 'flex-end' : 'flex-start',
                          maxWidth: '80%',
                          alignSelf: isAdmin ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '2px', padding: '0 4px' }}>
                          {isAdmin ? (msg.senderName || 'Hỗ trợ MiniMart (Admin)') : (msg.senderName || selectedConversation.fullName)}
                        </div>
                        <div 
                          style={{
                            padding: '0.65rem 1rem',
                            borderRadius: '12px',
                            background: isAdmin ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#f1f5f9',
                            color: isAdmin ? '#ffffff' : '#0f172a',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            fontSize: '0.9rem',
                            lineHeight: 1.45,
                            wordBreak: 'break-word',
                            borderBottomRightRadius: isAdmin ? '2px' : '12px',
                            borderBottomLeftRadius: !isAdmin ? '2px' : '12px'
                          }}
                        >
                          {msg.message}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px', padding: '0 4px' }}>
                          {formatDateTime(msg.createdAt)}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Ô soạn thảo và gửi tin nhắn */}
                <form onSubmit={handleSendReply} style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--admin-border)', display: 'flex', gap: '0.75rem', background: '#fff' }}>
                  <input 
                    type="text"
                    placeholder={`Gửi phản hồi cho ${selectedConversation.fullName || selectedConversation.userName}...`}
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.65rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--admin-border)',
                      fontSize: '0.9rem'
                    }}
                  />
                  <button 
                    type="submit" 
                    disabled={sendingReply || !replyContent.trim()} 
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.65rem 1.25rem' }}
                  >
                    <Send size={16} /> Gửi phản hồi
                  </button>
                </form>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: '1rem' }}>
                <MessageSquare size={48} style={{ opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '0.95rem' }}>
                  Chọn một cuộc hội thoại ở danh sách bên trái để trao đổi với khách hàng
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL XEM CHI TIẾT KHÁCH HÀNG ================= */}
      {selectedUserDetail && (
        <div className="admin-form-overlay">
          <div className="admin-popup-form form-large glass" style={{ maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--admin-border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '1.2rem'
                }}>
                  {selectedUserDetail.fullName ? selectedUserDetail.fullName.charAt(0).toUpperCase() : selectedUserDetail.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>{selectedUserDetail.fullName || selectedUserDetail.username}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#64748b' }}>
                    <span>@{selectedUserDetail.username}</span>
                    <span>•</span>
                    <span>{selectedUserDetail.email}</span>
                    <span>•</span>
                    <span className={`status-pill ${selectedUserDetail.isActive ? 'active' : 'inactive'}`} style={{ padding: '1px 6px', fontSize: '0.7rem' }}>
                      {selectedUserDetail.isActive ? 'Hoạt động' : 'Đang khóa'}
                    </span>
                  </div>
                </div>
              </div>

              <button 
                type="button" 
                onClick={() => setSelectedUserDetail(null)} 
                className="btn btn-outline" 
                style={{ padding: '0.35rem', borderRadius: '50%' }}
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nội dung chi tiết */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
              {/* Thẻ Cấp Bậc VIP Loyalty */}
              <div style={{ 
                background: 'linear-gradient(135deg, #1e293b, #0f172a)', 
                color: '#ffffff', 
                borderRadius: '12px', 
                padding: '1.25rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={22} style={{ color: '#fbbf24' }} />
                    <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '1.05rem' }}>
                      Thẻ Thành Viên MiniMart VIP
                    </h4>
                  </div>
                  <div>
                    {renderRankBadge(selectedUserDetail.membershipTier)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', margin: '0.75rem 0' }}>
                  <div style={{ background: 'rgba(255,255,255,0.08)', padding: '0.65rem 0.85rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Điểm tích lũy</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fbbf24' }}>
                      {selectedUserDetail.loyaltyPoints || 0} điểm
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.08)', padding: '0.65rem 0.85rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Ưu đãi giảm giá trực tiếp</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#38bdf8' }}>
                      {selectedUserDetail.loyaltyInfo?.tierDiscountPercent || 0}% trên mọi đơn
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.08)', padding: '0.65rem 0.85rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Hạng kế tiếp</div>
                    <div style={{ fontSize: '1rem', fontWeight: '600', color: '#f1f5f9' }}>
                      {selectedUserDetail.loyaltyInfo?.nextTier ? `${selectedUserDetail.loyaltyInfo.nextTier} (Cần thêm ${selectedUserDetail.loyaltyInfo.pointsToNextTier} điểm)` : 'Cấp bậc tối đa 💎'}
                    </div>
                  </div>
                </div>

                {/* Đặc quyền của hạng */}
                {selectedUserDetail.loyaltyInfo?.benefits && selectedUserDetail.loyaltyInfo.benefits.length > 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                    <strong>Đặc quyền hạng thành viên:</strong>
                    <ul style={{ margin: '4px 0 0 1.25rem', padding: 0 }}>
                      {selectedUserDetail.loyaltyInfo.benefits.map((b, idx) => (
                        <li key={idx} style={{ marginBottom: '2px' }}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Sổ địa chỉ nhận hàng */}
              <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--admin-border)' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' }}>
                  <MapPin size={16} style={{ color: '#2563eb' }} /> Sổ địa chỉ nhận hàng ({selectedUserDetail.addresses?.length || 0})
                </h4>

                {selectedUserDetail.addresses && selectedUserDetail.addresses.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
                    {selectedUserDetail.addresses.map(addr => (
                      <div key={addr.id} style={{ background: '#fff', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--admin-border)', position: 'relative' }}>
                        {addr.isDefault && (
                          <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}>
                            Mặc định
                          </span>
                        )}
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{addr.receiverName}</div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>SĐT: {addr.receiverPhone}</div>
                        <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '4px' }}>
                          {addr.detailAddress}, {addr.ward}, {addr.district}, {addr.province}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                    Khách hàng chưa lưu địa chỉ nhận hàng nào.
                  </div>
                )}
              </div>

              {/* Thống kê đơn hàng & 10 đơn gần nhất */}
              <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--admin-border)' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' }}>
                  <ShoppingBag size={16} style={{ color: '#16a34a' }} /> Thống kê & Lịch sử mua hàng
                </h4>

                {/* Grid 4 thẻ thống kê */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ background: '#fff', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Tổng đơn hàng</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>{selectedUserDetail.totalOrders || 0}</div>
                  </div>
                  <div style={{ background: '#fff', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>Đơn hoàn thành</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#16a34a' }}>{selectedUserDetail.completedOrders || 0}</div>
                  </div>
                  <div style={{ background: '#fff', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>Đơn đã hủy</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#ef4444' }}>{selectedUserDetail.cancelledOrders || 0}</div>
                  </div>
                  <div style={{ background: '#fff', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#2563eb' }}>Tổng chi tiêu</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#2563eb' }}>
                      {(selectedUserDetail.totalSpent || 0).toLocaleString()}đ
                    </div>
                  </div>
                </div>

                {/* Bảng 10 đơn gần nhất */}
                {selectedUserDetail.recentOrders && selectedUserDetail.recentOrders.length > 0 ? (
                  <table className="admin-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Mã đơn</th>
                        <th>Ngày đặt</th>
                        <th>Người nhận</th>
                        <th>Phương thức</th>
                        <th>Tổng tiền</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUserDetail.recentOrders.map(order => (
                        <tr key={order.id}>
                          <td><strong>#{order.id}</strong></td>
                          <td>{new Date(order.createdAt).toLocaleDateString('vi-VN')}</td>
                          <td>{order.shippingName || '—'}</td>
                          <td>{order.paymentMethod}</td>
                          <td><strong>{(order.finalAmount || order.totalAmount || 0).toLocaleString()}đ</strong></td>
                          <td>{renderOrderStatusBadge(order.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                    Khách hàng chưa có đơn hàng nào trong hệ thống.
                  </div>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="form-actions margin-top-md" style={{ justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSelectedUserDetail(null)} className="btn btn-outline">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManager
