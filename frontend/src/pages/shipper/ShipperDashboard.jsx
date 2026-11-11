import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { 
  Package, Truck, CheckCircle2, XCircle, MapPin, Phone, User, 
  Clock, Eye, AlertTriangle, RefreshCw, DollarSign, Calendar, Navigation
} from 'lucide-react'
import '../admin/AdminPages.css'

const ShipperDashboard = () => {
  const [activeTab, setActiveTab] = useState('DELIVERING') // 'DELIVERING' (Đơn phân công) | 'HISTORY' (Lịch sử)
  const [myDeliveries, setMyDeliveries] = useState([])
  const [loading, setLoading] = useState(true)

  // Order Details Modal
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Delivery Failure Modal
  const [failureModalOrder, setFailureModalOrder] = useState(null)
  const [failureReason, setFailureReason] = useState('Khách hàng không nghe máy')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/shipper/orders/my-deliveries')
      setMyDeliveries(res.data)
    } catch (err) {
      console.error('Lỗi khi tải đơn hàng shipper', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  // Cập nhật trạng thái giao hàng (Bắt đầu giao, Giao thành công, Báo thất bại)
  const handleUpdateStatus = async (orderId, newStatus, note = '', reason = '') => {
    setSubmittingAction(true)
    try {
      await api.patch(`/api/shipper/orders/${orderId}/status`, {
        status: newStatus,
        note,
        reason
      })
      alert(`✅ Cập nhật trạng thái đơn hàng #${orderId} thành công!`)
      if (failureModalOrder) setFailureModalOrder(null)
      fetchOrders()
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi khi cập nhật trạng thái')
    } finally {
      setSubmittingAction(false)
    }
  }

  // Xem chi tiết đơn hàng
  const handleViewDetail = async (orderId) => {
    setLoadingDetail(true)
    try {
      const res = await api.get(`/api/shipper/orders/${orderId}`)
      setSelectedOrder(res.data)
    } catch (err) {
      alert('Không thể tải chi tiết đơn hàng')
    } finally {
      setLoadingDetail(false)
    }
  }

  // Lọc danh sách theo tab
  const deliveringOrders = myDeliveries.filter(o => 
    o.status === 'DA_NHAN_DON' || o.status === 'DANG_GIAO' || o.status === 'DA_XAC_NHAN'
  )
  const historyOrders = myDeliveries.filter(o => 
    o.status === 'DA_GIAO' || o.status === 'GIAO_THAT_BAI' || o.status === 'HOAN_THANH'
  )

  // Thống kê lịch sử giao hàng
  const successCount = historyOrders.filter(o => o.status === 'DA_GIAO' || o.status === 'HOAN_THANH').length
  const failedCount = historyOrders.filter(o => o.status === 'GIAO_THAT_BAI').length
  const totalCOD = historyOrders
    .filter(o => (o.status === 'DA_GIAO' || o.status === 'HOAN_THANH') && o.paymentMethod === 'COD')
    .reduce((sum, o) => sum + (o.finalAmount || 0), 0)

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DA_XAC_NHAN':
      case 'DA_NHAN_DON':
        return <span className="status-pill" style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>Được phân công</span>
      case 'DANG_GIAO':
        return <span className="status-pill" style={{ background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>Đang giao hàng</span>
      case 'DA_GIAO':
      case 'HOAN_THANH':
        return <span className="status-pill" style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>Giao thành công</span>
      case 'GIAO_THAT_BAI':
        return <span className="status-pill" style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>Giao thất bại</span>
      default:
        return <span className="status-pill" style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '20px' }}>{status}</span>
    }
  }

  return (
    <div className="admin-page">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2>Bảng Điều Khiển Giao Hàng</h2>
          <p className="subtitle" style={{ color: '#64748b' }}>
            Xem và xử lý các đơn hàng được Admin điều phối theo khu vực địa bàn
          </p>
        </div>
        <button 
          onClick={fetchOrders} 
          className="btn btn-outline" 
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          <span>Làm mới danh sách</span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '2px solid #e2e8f0', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('DELIVERING')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '1rem',
            color: activeTab === 'DELIVERING' ? '#ff5722' : '#64748b',
            borderBottom: activeTab === 'DELIVERING' ? '3px solid #ff5722' : '3px solid transparent',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Truck size={20} />
          <span>Đơn được phân công / Đang giao</span>
          <span style={{ 
            background: activeTab === 'DELIVERING' ? '#ff5722' : '#e2e8f0', 
            color: activeTab === 'DELIVERING' ? 'white' : '#475569', 
            padding: '2px 8px', 
            borderRadius: '999px', 
            fontSize: '0.8rem' 
          }}>
            {deliveringOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '1rem',
            color: activeTab === 'HISTORY' ? '#ff5722' : '#64748b',
            borderBottom: activeTab === 'HISTORY' ? '3px solid #ff5722' : '3px solid transparent',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Clock size={20} />
          <span>Lịch sử giao hàng</span>
          <span style={{ 
            background: activeTab === 'HISTORY' ? '#ff5722' : '#e2e8f0', 
            color: activeTab === 'HISTORY' ? 'white' : '#475569', 
            padding: '2px 8px', 
            borderRadius: '999px', 
            fontSize: '0.8rem' 
          }}>
            {historyOrders.length}
          </span>
        </button>
      </div>

      {/* TAB 1: ĐƠN ĐƯỢC PHÂN CÔNG / ĐANG GIAO */}
      {activeTab === 'DELIVERING' && (
        <div>
          {deliveringOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
              <Truck size={48} style={{ color: '#94a3b8', marginBottom: '12px' }} />
              <h3 style={{ color: '#1e293b', marginBottom: '6px' }}>Hiện tại bạn không có đơn hàng nào cần giao</h3>
              <p style={{ color: '#64748b' }}>Admin sẽ phân công đơn hàng theo khu vực phụ trách của bạn.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
              {deliveringOrders.map(order => (
                <div key={order.id} style={{ 
                  background: 'white', 
                  borderRadius: '16px', 
                  padding: '20px', 
                  boxShadow: '0 4px 15px rgba(0,0,0,0.05)', 
                  border: order.status === 'DANG_GIAO' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>Đơn hàng #{order.id}</span>
                      {getStatusBadge(order.status)}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: '#334155' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={16} style={{ color: '#64748b' }} />
                        <strong>{order.shippingName}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Phone size={16} style={{ color: '#64748b' }} />
                        <a href={`tel:${order.shippingPhone}`} style={{ color: '#ff5722', fontWeight: 600 }}>{order.shippingPhone}</a>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <MapPin size={16} style={{ color: '#ef4444', marginTop: '2px', flexShrink: 0 }} />
                        <span>{order.shippingAddress}</span>
                      </div>
                      {order.note && (
                        <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', color: '#475569', fontStyle: 'italic' }}>
                          Ghi chú: {order.note}
                        </div>
                      )}
                    </div>

                    <div style={{ 
                      marginTop: '14px', 
                      padding: '12px', 
                      background: order.paymentMethod === 'COD' ? '#fff7ed' : '#f0fdf4', 
                      borderRadius: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Phương thức & Số tiền</span>
                        <strong style={{ color: order.paymentMethod === 'COD' ? '#ea580c' : '#16a34a' }}>
                          {order.paymentMethod === 'COD' ? '💵 Thu hộ COD' : '💳 Đã chuyển khoản'}
                        </strong>
                      </div>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                        {order.finalAmount?.toLocaleString()}đ
                      </span>
                    </div>
                  </div>

                  {/* Hành động của Shipper */}
                  <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                    <button
                      onClick={() => handleViewDetail(order.id)}
                      className="btn btn-outline"
                      style={{ padding: '8px 12px' }}
                      title="Xem chi tiết món hàng"
                    >
                      <Eye size={16} />
                    </button>

                    {(order.status === 'DA_NHAN_DON' || order.status === 'DA_XAC_NHAN') && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'DANG_GIAO', 'Shipper đã lấy hàng và bắt đầu di chuyển')}
                        className="btn btn-primary"
                        disabled={submittingAction}
                        style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <Navigation size={16} /> Bắt đầu giao
                      </button>
                    )}

                    {order.status === 'DANG_GIAO' && (
                      <>
                        <button
                          onClick={() => {
                            const note = prompt('Ghi chú giao hàng (nếu có):', 'Giao tận tay khách hàng');
                            if (note !== null) {
                              handleUpdateStatus(order.id, 'DA_GIAO', note);
                            }
                          }}
                          className="btn"
                          disabled={submittingAction}
                          style={{ flex: 1, background: '#10b981', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <CheckCircle2 size={16} /> Giao thành công
                        </button>
                        <button
                          onClick={() => setFailureModalOrder(order)}
                          className="btn"
                          disabled={submittingAction}
                          style={{ background: '#ef4444', color: 'white', padding: '8px 12px' }}
                          title="Báo giao thất bại"
                        >
                          <XCircle size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LỊCH SỬ GIAO HÀNG */}
      {activeTab === 'HISTORY' && (
        <div>
          {/* Thống kê hiệu suất */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Giao thành công</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#16a34a' }}>{successCount} <small style={{ fontSize: '1rem', fontWeight: 500 }}>đơn</small></span>
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Giao thất bại</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#dc2626' }}>{failedCount} <small style={{ fontSize: '1rem', fontWeight: 500 }}>đơn</small></span>
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Tiền COD đã thu hộ</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ea580c' }}>{totalCOD.toLocaleString()}đ</span>
            </div>
          </div>

          {/* Bảng danh sách đơn lịch sử */}
          <div className="table-responsive" style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã Đơn</th>
                  <th>Khách Hàng</th>
                  <th>Địa Chỉ</th>
                  <th>Số Tiền</th>
                  <th>Thanh Toán</th>
                  <th>Trạng Thái</th>
                  <th>Thời Gian Hoàn Tất</th>
                  <th>Chi Tiết</th>
                </tr>
              </thead>
              <tbody>
                {historyOrders.length > 0 ? (
                  historyOrders.map(order => (
                    <tr key={order.id}>
                      <td><strong>#{order.id}</strong></td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{order.shippingName}</div>
                        <small style={{ color: '#64748b' }}>{order.shippingPhone}</small>
                      </td>
                      <td style={{ maxWidth: '250px' }}>{order.shippingAddress}</td>
                      <td><strong>{order.finalAmount?.toLocaleString()}đ</strong></td>
                      <td>
                        <span style={{ 
                          fontSize: '0.8rem', 
                          padding: '3px 8px', 
                          borderRadius: '6px', 
                          background: order.paymentMethod === 'COD' ? '#fff7ed' : '#f0fdf4',
                          color: order.paymentMethod === 'COD' ? '#c2410c' : '#15803d',
                          fontWeight: 600
                        }}>
                          {order.paymentMethod}
                        </span>
                      </td>
                      <td>{getStatusBadge(order.status)}</td>
                      <td>
                        {order.deliveredAt ? new Date(order.deliveredAt).toLocaleString('vi-VN') : (order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN') : '—')}
                        {order.deliveryFailedReason && (
                          <div style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '2px' }}>
                            Lý do: {order.deliveryFailedReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <button onClick={() => handleViewDetail(order.id)} className="btn btn-outline" style={{ padding: '6px 10px' }}>
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      Chưa có lịch sử giao hàng nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL CHI TIẾT ĐƠN HÀNG */}
      {selectedOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#0f172a' }}>Chi Tiết Đơn Hàng #{selectedOrder.id}</h3>
              <button 
                onClick={() => setSelectedOrder(null)} 
                style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.9rem' }}>
              <p style={{ margin: '0 0 6px' }}><strong>Người nhận:</strong> {selectedOrder.shippingName} ({selectedOrder.shippingPhone})</p>
              <p style={{ margin: '0 0 6px' }}><strong>Địa chỉ:</strong> {selectedOrder.shippingAddress}</p>
              <p style={{ margin: '0 0 6px' }}><strong>Hình thức:</strong> {selectedOrder.paymentMethod} - {selectedOrder.finalAmount?.toLocaleString()}đ</p>
              {selectedOrder.note && <p style={{ margin: 0, color: '#ff5722' }}><strong>Khách ghi chú:</strong> {selectedOrder.note}</p>}
            </div>

            <h4 style={{ fontSize: '1rem', marginBottom: '12px', color: '#1e293b' }}>Danh Sách Mặt Hàng Cần Giao</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {selectedOrder.items?.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                  {item.productImage && (
                    <img src={item.productImage} alt={item.productName} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px' }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.productName}</div>
                    <small style={{ color: '#64748b' }}>Đơn giá: {item.price?.toLocaleString()}đ</small>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>x{item.quantity}</div>
                    <small style={{ color: '#ff5722', fontWeight: 600 }}>{(item.price * item.quantity)?.toLocaleString()}đ</small>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'right' }}>
              <button onClick={() => setSelectedOrder(null)} className="btn btn-primary" style={{ padding: '8px 20px' }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BÁO THẤT BẠI */}
      {failureModalOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '460px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 16px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={24} /> Báo Giao Thất Bại #{failureModalOrder.id}
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>Lý do không giao được:</label>
              <select 
                value={failureReason} 
                onChange={(e) => setFailureReason(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              >
                <option value="Khách hàng không nghe máy">Khách hàng không nghe máy sau 3 cuộc gọi</option>
                <option value="Sai địa chỉ nhận hàng">Sai địa chỉ, không tìm được nhà</option>
                <option value="Khách hẹn giao lại ngày khác">Khách hẹn giao lại vào thời gian khác</option>
                <option value="Khách từ chối nhận hàng">Khách từ chối nhận hàng / kiểm tra không ưng ý</option>
                <option value="Lý do khác">Lý do phát sinh khác</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>Ghi chú thêm của shipper:</label>
              <textarea 
                rows="3" 
                value={deliveryNote} 
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="Ví dụ: Đã gọi lúc 14:15 và 14:30 nhưng thuê bao..."
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setFailureModalOrder(null)} 
                className="btn btn-outline"
                disabled={submittingAction}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => handleUpdateStatus(failureModalOrder.id, 'GIAO_THAT_BAI', deliveryNote, failureReason)} 
                className="btn"
                disabled={submittingAction}
                style={{ background: '#dc2626', color: 'white' }}
              >
                Xác nhận thất bại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ShipperDashboard
