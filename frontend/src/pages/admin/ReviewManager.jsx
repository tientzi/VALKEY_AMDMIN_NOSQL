import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { Star, Check, Trash2, MessageSquare, User, Package, Calendar } from 'lucide-react'
import './AdminPages.css'

const ReviewManager = () => {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [error, setError] = useState('')

  const fetchPendingReviews = async () => {
    try {
      const response = await api.get('/api/admin/reviews/pending')
      setReviews(response.data)
    } catch (err) {
      console.error('Lỗi khi tải đánh giá chờ duyệt:', err)
      setError('Không thể lấy danh sách đánh giá chờ duyệt')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPendingReviews()
  }, [])

  const handleApprove = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn duyệt đánh giá này?')) return
    setUpdatingId(id)
    setError('')
    try {
      await api.put(`/api/admin/reviews/${id}/approve`)
      setReviews(prev => prev.filter(r => r.id !== id))
      alert('Duyệt đánh giá thành công!')
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Lỗi khi duyệt đánh giá')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa/từ chối đánh giá này?')) return
    setUpdatingId(id)
    setError('')
    try {
      await api.delete(`/api/admin/reviews/${id}`)
      setReviews(prev => prev.filter(r => r.id !== id))
      alert('Xóa đánh giá thành công!')
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Lỗi khi xóa đánh giá')
    } finally {
      setUpdatingId(null)
    }
  }

  const renderStars = (rating) => {
    const stars = []
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star 
          key={i} 
          size={16} 
          fill={i <= rating ? '#eab308' : 'none'} 
          stroke={i <= rating ? '#eab308' : 'var(--admin-text-secondary)'} 
          style={{ marginRight: '2px' }}
        />
      )
    }
    return <div style={{ display: 'flex' }}>{stars}</div>
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    return date.toLocaleDateString('vi-VN')
  }

  if (loading) {
    return <div className="loading-state">Đang tải danh sách đánh giá chờ duyệt...</div>
  }

  return (
    <div className="admin-crud-page">
      <div className="crud-header">
        <h2>Quản lý Đánh giá Chờ duyệt</h2>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* Danh sách review */}
      <div className="admin-table-container glass">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Khách hàng</th>
              <th>Sản phẩm</th>
              <th>Đánh giá</th>
              <th>Nội dung</th>
              <th>Ngày gửi</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {reviews.length > 0 ? (
              reviews.map(review => (
                <tr key={review.id}>
                  <td>#{review.id}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--admin-primary)'
                      }}>
                        <User size={14} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong>{review.fullName || review.username || `User #${review.userId}`}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>ID: {review.userId}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '4px',
                        background: 'rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--admin-warning)'
                      }}>
                        <Package size={14} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong>{review.productName || `Product #${review.productId}`}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>ID: {review.productId}</span>
                      </div>
                    </div>
                  </td>
                  <td>{renderStars(review.rating)}</td>
                  <td style={{ maxWidth: '300px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                      <MessageSquare size={14} style={{ marginTop: '3px', flexShrink: 0, color: 'var(--admin-text-secondary)' }} />
                      <span>{review.comment}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--admin-text-secondary)' }}>
                      <Calendar size={14} /> {formatDate(review.createdAt)}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button 
                        onClick={() => handleApprove(review.id)} 
                        disabled={updatingId === review.id}
                        className="action-btn edit" 
                        title="Duyệt đánh giá"
                        style={{ color: 'var(--admin-success)', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                      >
                        <Check size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(review.id)} 
                        disabled={updatingId === review.id}
                        className="action-btn delete" 
                        title="Xóa đánh giá"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-secondary)' }}>
                  Không có đánh giá nào đang chờ duyệt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ReviewManager
