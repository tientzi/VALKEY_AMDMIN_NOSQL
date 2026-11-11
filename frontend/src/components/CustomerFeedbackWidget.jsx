import React, { useState, useEffect, useRef, useContext } from 'react'
import { MessageSquare, X, Send, Store, RefreshCw, LogIn, CheckCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'
import api from '../services/api'
import './CustomerFeedbackWidget.css'

const CustomerFeedbackWidget = () => {
  const { isAuthenticated, user } = useContext(AuthContext)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  // Tải danh sách tin nhắn của khách hàng
  const fetchMessages = async () => {
    if (!isAuthenticated) return
    try {
      setLoading(true)
      const res = await api.get('/api/messages/my-messages')
      setMessages(res.data)
    } catch (err) {
      console.error('Lỗi khi tải tin nhắn với shop:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchMessages()
      // Polling nhẹ mỗi 8 giây khi widget đang mở để cập nhật câu trả lời từ Admin
      const interval = setInterval(fetchMessages, 8000)
      return () => clearInterval(interval)
    }
  }, [isOpen, isAuthenticated])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!inputText.trim() || sending) return

    const text = inputText.trim()
    setInputText('')
    setSending(true)

    try {
      const res = await api.post('/api/messages/send', { message: text })
      setMessages(prev => [...prev, res.data])
    } catch (err) {
      console.error('Lỗi gửi phản hồi cho shop:', err)
      alert(err.response?.data?.error || 'Không thể gửi tin nhắn. Vui lòng thử lại.')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="feedback-widget-container">
      {/* Nút bật/tắt widget nổi */}
      {!isOpen && (
        <button 
          type="button"
          onClick={() => setIsOpen(true)}
          className="feedback-toggle-btn"
          title="Chat trực tiếp & Phản hồi ý kiến cho Shop"
        >
          <MessageSquare size={22} />
          <span className="feedback-btn-label">Chat với Shop</span>
        </button>
      )}

      {/* Cửa sổ Chat Phản Hồi với Shop */}
      {isOpen && (
        <div className="feedback-chat-window glass">
          {/* Header */}
          <div className="feedback-header">
            <div className="feedback-header-info">
              <div className="feedback-shop-avatar">
                <Store size={18} />
                <span className="online-indicator"></span>
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Hỗ Trợ Khách Hàng</h4>
                <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                  Admin trực tuyến
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isAuthenticated && (
                <button 
                  type="button" 
                  onClick={fetchMessages} 
                  className="feedback-action-btn"
                  title="Làm mới tin nhắn"
                >
                  <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
                </button>
              )}
              <button 
                type="button" 
                onClick={() => setIsOpen(false)} 
                className="feedback-action-btn"
                title="Đóng chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Vùng nội dung tin nhắn */}
          <div className="feedback-messages-body">
            {/* Tin nhắn chào đầu tiên */}
            <div className="feedback-msg-item msg-admin">
              <div className="feedback-msg-bubble">
                Xin chào <strong>{user?.fullName || 'bạn'}</strong>! 👋
                <br />
                MiniMart luôn sẵn sàng lắng nghe mọi ý kiến đóng góp, thắc mắc về đơn hàng hoặc dịch vụ. Hãy gửi tin nhắn cho Shop nhé!
              </div>
              <span className="feedback-msg-time">Hệ thống CSKH MiniMart</span>
            </div>

            {/* Chưa đăng nhập */}
            {!isAuthenticated ? (
              <div className="feedback-auth-notice">
                <p style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#475569' }}>
                  Vui lòng đăng nhập tài khoản để gửi phản hồi và nhận hỗ trợ từ quản trị viên.
                </p>
                <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                  <LogIn size={15} /> Đăng nhập ngay
                </Link>
              </div>
            ) : (
              <>
                {messages.map(msg => {
                  const isUser = msg.senderType === 'CUSTOMER'
                  return (
                    <div 
                      key={msg.id} 
                      className={`feedback-msg-item ${isUser ? 'msg-user' : 'msg-admin'}`}
                    >
                      <div className="feedback-msg-bubble">
                        {msg.message}
                      </div>
                      <span className="feedback-msg-time">
                        {isUser ? 'Bạn' : (msg.senderName || 'Hỗ trợ MiniMart')} • {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Form nhập tin nhắn */}
          {isAuthenticated && (
            <form onSubmit={handleSend} className="feedback-input-form">
              <input 
                type="text" 
                placeholder="Nhập nội dung phản hồi, thắc mắc..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                disabled={sending}
                className="feedback-input"
              />
              <button 
                type="submit" 
                disabled={sending || !inputText.trim()}
                className="feedback-send-btn"
                title="Gửi tin nhắn"
              >
                <Send size={16} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

export default CustomerFeedbackWidget
