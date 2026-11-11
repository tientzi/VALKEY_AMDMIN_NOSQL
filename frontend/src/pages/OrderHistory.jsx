import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { ClipboardList, ShoppingBag } from 'lucide-react'
import './OrderHistory.css'

const OrderHistory = () => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchParams] = useSearchParams()

  const fetchOrders = async () => {
    try {
      const response = await api.get('/api/orders/my-orders')
      setOrders(response.data)
    } catch (err) {
      console.error('Không thể lấy lịch sử đơn hàng', err)
      setError('Đã xảy ra lỗi khi tải lịch sử đơn hàng.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    if (searchParams.get('success')) {
      setSuccess('Đặt hàng thành công! Cảm ơn bạn đã ủng hộ MiniMart.')
      setTimeout(() => {
        setSuccess('')
      }, 4000)
    }
  }, [searchParams])

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy đơn hàng này không?')) return

    setError('')
    setSuccess('')
    try {
      await api.put(`/api/orders/${orderId}/cancel`)
      setSuccess('Đã hủy đơn hàng thành công và hoàn trả tồn kho.')
      fetchOrders()
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể hủy đơn hàng')
    }
  }

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'CHO_TIEP_NHAN': return 'badge-info'
      case 'CHO_XAC_NHAN': return 'badge-warning'
      case 'DA_XAC_NHAN': return 'badge-info'
      case 'DA_NHAN_DON': return 'badge-info'
      case 'DANG_GIAO': return 'badge-primary'
      case 'DA_GIAO': return 'badge-success'
      case 'HOAN_THANH': return 'badge-success'
      case 'TU_CHOI': return 'badge-danger'
      case 'HUY': return 'badge-danger'
      default: return ''
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'CHO_TIEP_NHAN': return 'Chờ tiếp nhận (Hàng đợi)'
      case 'CHO_XAC_NHAN': return 'Chờ xác nhận'
      case 'DA_XAC_NHAN': return 'Đã xác nhận'
      case 'DA_NHAN_DON': return 'Shipper nhận đơn'
      case 'DANG_GIAO': return 'Đang giao hàng'
      case 'DA_GIAO': return 'Đã giao hàng'
      case 'HOAN_THANH': return 'Hoàn thành'
      case 'TU_CHOI': return 'Từ chối (Hết hàng)'
      case 'HUY': return 'Đã hủy'
      default: return status
    }
  }

  if (loading) {
    return <div className="loading-state">Đang tải lịch sử đơn hàng...</div>
  }

  return (
    <div className="orders-page">
      <h1 className="page-title"><ClipboardList size={28} /> Lịch sử đơn hàng</h1>

      {success && <div className="order-alert success-alert">{success}</div>}
      {error && <div className="order-alert error-alert">{error}</div>}

      {orders.length > 0 ? (
        <div className="orders-list-container">
          {orders.map(order => (
            <div key={order.id} className="order-card-item glass">
              <div className="order-item-header">
                <div className="order-meta-info" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span>Mã đơn: <strong>#OD{order.id}</strong></span>
                  <span className="dot">•</span>
                  <span>Ngày đặt: {new Date(order.createdAt).toLocaleString('vi-VN')}</span>
                  {order.jobId && (
                    <>
                      <span className="dot">•</span>
                      <span style={{ 
                        fontSize: '12px', 
                        background: '#eff6ff', 
                        color: '#1d4ed8', 
                        border: '1px solid #bfdbfe', 
                        padding: '2px 8px', 
                        borderRadius: '6px', 
                        fontWeight: '600', 
                        fontFamily: 'monospace' 
                      }}>
                        Mã Job: {order.jobId}
                      </span>
                    </>
                  )}
                </div>
                <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                  {getStatusText(order.status)}
                </span>
              </div>

              <div className="order-item-products">
                {order.items.map(item => (
                  <div key={item.id} className="item-prod-row">
                    <img src={item.productImage} alt={item.productName} className="item-prod-img" onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=150&auto=format&fit=crop' }} />
                    <div className="item-prod-details">
                      <h4>{item.productName}</h4>
                      <span>Số lượng: {item.quantity}</span>
                    </div>
                    <span className="item-prod-price">{item.price.toLocaleString()}đ</span>
                  </div>
                ))}
              </div>

              <div className="order-item-footer">
                <div className="order-shipping-details">
                  <p>Người nhận: <strong>{order.shippingName}</strong> ({order.shippingPhone})</p>
                  <p>Địa chỉ: {order.shippingAddress}</p>
                  {order.note && <p>Ghi chú: <em>"{order.note}"</em></p>}
                </div>
                
                <div className="order-payment-box">
                  <div className="payment-summary-row">
                    <span>Tổng tiền hàng:</span>
                    <span>{order.totalAmount.toLocaleString()}đ</span>
                  </div>
                  {order.discountAmount > 0 && (
                    <div className="payment-summary-row text-discount-row">
                      <span>Mã giảm giá:</span>
                      <span>-{order.discountAmount.toLocaleString()}đ</span>
                    </div>
                  )}
                  <div className="payment-summary-row final-row">
                    <span>Tổng thanh toán:</span>
                    <strong>{order.finalAmount.toLocaleString()}đ</strong>
                  </div>
                  <span className="payment-method-badge">{order.paymentMethod === 'COD' ? 'Thanh toán COD' : 'Chuyển khoản'}</span>
                  
                  {(order.status === 'CHO_TIEP_NHAN' || order.status === 'CHO_XAC_NHAN' || order.status === 'DA_XAC_NHAN' || order.status === 'DA_NHAN_DON') && (
                    <button
                      onClick={() => handleCancelOrder(order.id)}
                      className="btn btn-outline cancel-order-btn"
                    >
                      Hủy đơn hàng
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-orders-state glass">
          <ShoppingBag size={64} className="empty-icon" />
          <h3>Bạn chưa đặt đơn hàng nào!</h3>
          <p>Hãy chọn những thực phẩm tươi sạch và tạo đơn hàng đầu tiên của bạn.</p>
          <a href="/products" className="btn btn-primary">Mua sắm ngay</a>
        </div>
      )}
    </div>
  )
}

export default OrderHistory
