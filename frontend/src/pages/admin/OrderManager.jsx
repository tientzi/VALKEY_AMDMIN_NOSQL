import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { Eye, CheckCircle2, Truck, XCircle, FileText, ShoppingBag, MapPin, User, DollarSign, Calendar, Download, Printer, Search, X } from 'lucide-react'
import { exportToCSV, printDocument } from '../../utils/exportUtils'
import { matchesRelative } from '../../utils/searchUtils'
import './AdminPages.css'

const OrderManager = () => {
  const [orders, setOrders] = useState([])
  const [filteredOrders, setFilteredOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')

  const fetchOrders = async () => {
    try {
      const response = await api.get('/api/admin/orders')
      setOrders(response.data)
      setFilteredOrders(response.data)
    } catch (err) {
      console.error('Lỗi khi tải đơn hàng:', err)
      setError('Không thể lấy danh sách đơn hàng')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const handleExportCSV = () => {
    const headers = ['Mã Đơn', 'Ngày tạo', 'Khách hàng', 'Số điện thoại', 'Địa chỉ giao hàng', 'Tổng tiền (VND)', 'Giảm giá (VND)', 'Thực trả (VND)', 'Phương thức', 'Trạng thái', 'Ghi chú']
    const rows = filteredOrders.map(o => [
      `#${o.id}`,
      new Date(o.createdAt).toLocaleString('vi-VN'),
      o.shippingName || '',
      o.shippingPhone || '',
      o.shippingAddress || '',
      o.totalAmount || 0,
      o.discountAmount || 0,
      o.finalAmount || 0,
      o.paymentMethod === 'COD' ? 'Tiền mặt (COD)' : 'Chuyển khoản (VietQR/MoMo)',
      getStatusLabel(o.status),
      o.note || ''
    ])
    exportToCSV(`Danh_Sach_Don_Hang_MiniMart_${new Date().toISOString().slice(0, 10)}`, headers, rows)
  }

  const handlePrintOrderSlip = () => {
    if (!selectedOrder) return
    printDocument(`Phieu_Giao_Hang_DH${selectedOrder.id}_MiniMart`)
  }

  useEffect(() => {
    let result = orders
    if (statusFilter !== 'ALL') {
      result = result.filter(o => o.status === statusFilter)
    }
    if (searchTerm.trim()) {
      result = result.filter(o =>
        matchesRelative([
          `#${o.id}`,
          o.id,
          o.shippingName,
          o.shippingPhone,
          o.shippingAddress,
          o.paymentMethod,
          o.note
        ], searchTerm)
      )
    }
    setFilteredOrders(result)
  }, [statusFilter, searchTerm, orders])

  const renderPaymentBadge = (payStatus, payMethod) => {
    const isCod = payMethod === 'COD' || payMethod === 'TIEN_MAT'
    if (payStatus === 'COMPLETED') {
      return (
        <span className="status-pill active" style={{ fontSize: '0.75rem', padding: '2px 7px', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', display: 'inline-block' }}>
          Đã thanh toán
        </span>
      )
    }
    if (payStatus === 'APPROVED_COD') {
      return (
        <span className="status-pill" style={{ fontSize: '0.75rem', padding: '2px 7px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', display: 'inline-block' }}>
          Đã duyệt COD
        </span>
      )
    }
    if (payStatus === 'FAILED') {
      return (
        <span className="status-pill inactive" style={{ fontSize: '0.75rem', padding: '2px 7px', display: 'inline-block' }}>
          Thanh toán hủy
        </span>
      )
    }
    return (
      <span className="status-pill warning" style={{ fontSize: '0.75rem', padding: '2px 7px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', display: 'inline-block' }}>
        {isCod ? 'Chờ duyệt COD' : 'Chờ duyệt QR'}
      </span>
    )
  }

  const handleUpdateStatus = async (orderId, newStatus, targetOrder = null) => {
    const currentOrd = targetOrder || orders.find(o => o.id === orderId) || selectedOrder
    const isCod = currentOrd?.paymentMethod === 'COD' || currentOrd?.paymentMethod === 'TIEN_MAT'

    let confirmMsg = `Bạn có chắc muốn cập nhật trạng thái đơn hàng sang "${getStatusLabel(newStatus)}"?`
    if (newStatus === 'DA_XAC_NHAN') {
      confirmMsg = isCod
        ? `Xác nhận DUYỆT ĐƠN HÀNG COD #${orderId}?\n• Đơn hàng chuyển sang "Đã xác nhận".\n• Tự động duyệt thanh toán COD (thu tiền khi giao nhận).\n• Đơn hàng sẵn sàng để phân công Shipper giao ngay.`
        : `Xác nhận DUYỆT ĐƠN HÀNG & THANH TOÁN QR #${orderId}?\n• Đơn hàng chuyển sang "Đã xác nhận".\n• Tự động xác nhận ĐÃ THANH TOÁN (Số tiền: ${currentOrd?.finalAmount?.toLocaleString()}đ).\n• Đơn hàng sẵn sàng để phân công Shipper giao ngay.`
    } else if (newStatus === 'HUY') {
      confirmMsg = `⚠️ CẢNH BÁO: Xác nhận HỦY ĐƠN HÀNG #${orderId}?\n• Đơn hàng và thanh toán sẽ hủy (FAILED).\n• Tự động hoàn trả tồn kho theo từng lô hạn dùng.`
    }

    if (!window.confirm(confirmMsg)) return
    setUpdating(true)
    setError('')
    try {
      const response = await api.put(`/api/admin/orders/${orderId}/status`, { status: newStatus })
      const updatedOrder = response.data
      setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o))
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(updatedOrder)
      }
      fetchOrders()
      alert(newStatus === 'DA_XAC_NHAN' ? '✅ Đã duyệt đơn hàng và thanh toán thành công!' : 'Cập nhật trạng thái thành công!')
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Lỗi khi cập nhật trạng thái đơn hàng')
    } finally {
      setUpdating(false)
    }
  }

  const handleConfirmPayment = async (orderId) => {
    if (!window.confirm(`Xác nhận đơn hàng #${orderId} đã nhận được tiền chuyển khoản MoMo / Ngân hàng?`)) return
    try {
      const res = await api.patch(`/api/admin/orders/${orderId}/confirm-payment`)
      alert('Đã xác nhận thanh toán thành công!')
      fetchOrders()
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(res.data)
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi khi xác nhận thanh toán')
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'CHO_TIEP_NHAN': return 'Chờ tiếp nhận (Queue)'
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

  const getStatusPillClass = (status) => {
    switch (status) {
      case 'CHO_TIEP_NHAN': return 'warning'
      case 'CHO_XAC_NHAN': return 'warning'
      case 'DA_XAC_NHAN': return 'active' // Blueish in CSS
      case 'DA_NHAN_DON': return 'active'
      case 'DANG_GIAO': return 'active' // Violet/Blueish
      case 'DA_GIAO': return 'active'
      case 'HOAN_THANH': return 'active' // Greenish
      case 'TU_CHOI': return 'inactive' // Redish
      case 'HUY': return 'inactive' // Redish
      default: return ''
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    return date.toLocaleString('vi-VN')
  }

  const getStepStatus = (orderStatus, step) => {
    const statusOrder = ['CHO_XAC_NHAN', 'DA_XAC_NHAN', 'DA_NHAN_DON', 'DANG_GIAO', 'DA_GIAO', 'HOAN_THANH']
    if (orderStatus === 'HUY') {
      return step === 0 ? 'completed' : step === 1 ? 'cancelled' : 'pending'
    }
    const currentIndex = statusOrder.indexOf(orderStatus)
    if (currentIndex >= step) return 'completed'
    return 'pending'
  }

  if (loading) {
    return <div className="loading-state">Đang tải danh sách đơn hàng...</div>
  }

  return (
    <div className="admin-crud-page">
      <div className="crud-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Quản lý Đơn hàng</h2>
          <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
            Theo dõi, xác nhận đơn hàng và in phiếu đóng gói cho Shipper giao hàng.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Thanh tìm kiếm tương đối */}
          <div className="no-print" style={{ position: 'relative', minWidth: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Tìm theo mã đơn (#10), tên khách, SĐT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '0.45rem 2rem 0.45rem 2rem',
                borderRadius: '8px',
                border: '1px solid var(--admin-border)',
                background: 'var(--admin-card-bg)',
                fontSize: '0.9rem',
                width: '100%'
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Lọc đơn hàng */}
          <div className="filter-group no-print" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>Trạng thái:</span>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                background: 'var(--admin-card-bg)',
                color: 'var(--admin-text-primary)',
                border: '1px solid var(--admin-border)',
                padding: '0.45rem 0.8rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              <option value="ALL">Tất cả đơn hàng</option>
              <option value="CHO_TIEP_NHAN">Chờ tiếp nhận (Queue)</option>
              <option value="CHO_XAC_NHAN">Chờ xác nhận</option>
              <option value="DA_XAC_NHAN">Đã xác nhận</option>
              <option value="DANG_GIAO">Đang giao hàng</option>
              <option value="HOAN_THANH">Hoàn thành</option>
              <option value="TU_CHOI">Từ chối (Hết hàng)</option>
              <option value="HUY">Đã hủy</option>
            </select>
          </div>

          <button onClick={handleExportCSV} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Xuất Excel / CSV
          </button>
          <button onClick={() => printDocument('Danh_Sach_Don_Hang_MiniMart')} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={16} /> In Danh Sách
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* Danh sách đơn hàng */}
      <div className="admin-table-container glass">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Ngày tạo</th>
              <th>Khách hàng</th>
              <th>Số điện thoại</th>
              <th>Tổng tiền</th>
              <th>Phương thức</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length > 0 ? (
              filteredOrders.map(order => (
                <tr key={order.id}>
                  <td>
                    <strong>#{order.id}</strong>
                    {order.jobId && (
                      <div style={{ fontSize: '11px', color: '#2563eb', fontFamily: 'monospace', marginTop: '2px' }} title="Mã Job Valkey Queue">
                        {order.jobId}
                      </div>
                    )}
                  </td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong>{order.shippingName}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>ID: {order.userId}</span>
                    </div>
                  </td>
                  <td>{order.shippingPhone}</td>
                  <td><strong>{order.finalAmount?.toLocaleString()}đ</strong></td>
                  <td>
                    <div style={{ fontWeight: '500' }}>{order.paymentMethod === 'COD' ? 'Tiền mặt (COD)' : 'Chuyển khoản'}</div>
                    <div style={{ marginTop: '4px' }}>
                      {renderPaymentBadge(order.paymentStatus, order.paymentMethod)}
                    </div>
                  </td>
                  <td>
                    <span className={`status-pill ${getStatusPillClass(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button 
                        onClick={() => setSelectedOrder(order)} 
                        className="action-btn view" 
                        title="Xem chi tiết"
                      >
                        <Eye size={16} />
                      </button>
                      {order.status === 'CHO_XAC_NHAN' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'DA_XAC_NHAN', order)}
                          disabled={updating}
                          style={{
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#fff',
                            border: 'none',
                            padding: '5px 9px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: '600',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)'
                          }}
                          title="Duyệt đơn hàng và xác nhận thanh toán (1-chạm)"
                        >
                          <CheckCircle2 size={13} /> Duyệt đơn
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-secondary)' }}>
                  Không tìm thấy đơn hàng nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal chi tiết đơn hàng */}
      {selectedOrder && (
        <div className="admin-form-overlay order-modal-overlay">
          <div className="admin-popup-form glass order-modal-content" style={{ maxWidth: '820px' }}>
            {/* Header chỉ hiển thị khi in phiếu giao hàng */}
            <div className="print-only">
              <div className="print-doc-header">
                <div>
                  <h1 className="print-brand-title">SIÊU THỊ TIỆN LỢI MINIMART</h1>
                  <p className="print-brand-subtitle">Hotline: 1900 8888 - Địa chỉ: TP. Hồ Chí Minh</p>
                </div>
                <div className="print-doc-meta">
                  <div>Mã đơn: <strong>#{selectedOrder.id}</strong></div>
                  <div>Ngày đặt: {formatDate(selectedOrder.createdAt)}</div>
                  <div>In lúc: {new Date().toLocaleString('vi-VN')}</div>
                </div>
              </div>
              <div className="print-doc-title">
                <h2>PHIẾU GIAO HÀNG & ĐÓNG GÓI (ORDER SLIP)</h2>
                <p>Phương thức: <strong>{selectedOrder.paymentMethod === 'COD' ? 'THU HỘ TIỀN MẶT (COD)' : 'ĐÃ THANH TOÁN (VietQR / MoMo)'}</strong></p>
              </div>

              <div style={{ border: '1px solid #333', padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', fontSize: '10pt', background: '#f8fafc' }}>
                <div><strong>Người nhận:</strong> {selectedOrder.shippingName} — <strong>SĐT:</strong> {selectedOrder.shippingPhone}</div>
                <div style={{ marginTop: '3px' }}><strong>Địa chỉ nhận:</strong> {selectedOrder.shippingAddress}</div>
                {selectedOrder.note && <div style={{ marginTop: '3px' }}><strong>Ghi chú giao:</strong> {selectedOrder.note}</div>}
              </div>
            </div>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Chi tiết đơn hàng #{selectedOrder.id}</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={handlePrintOrderSlip} 
                  className="btn btn-outline" 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  <Printer size={15} /> In Phiếu Giao Hàng
                </button>
                <button 
                  onClick={() => setSelectedOrder(null)} 
                  className="btn btn-outline" 
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  Đóng lại
                </button>
              </div>
            </div>

            {/* Quy trình đơn hàng (Stepper) - Ẩn khi in */}
            <div className="order-stepper-container no-print" style={{ margin: '1.5rem 0 2rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                {/* Line background */}
                <div style={{
                  position: 'absolute',
                  top: '15px',
                  left: '5%',
                  right: '5%',
                  height: '2px',
                  background: 'var(--admin-border)',
                  zIndex: 1
                }}></div>

                {/* Step 1 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, width: '22%' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: getStepStatus(selectedOrder.status, 0) === 'completed' ? 'var(--admin-success)' : 'var(--admin-bg)',
                    border: '2px solid ' + (getStepStatus(selectedOrder.status, 0) === 'completed' ? 'var(--admin-success)' : 'var(--admin-border)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.85rem'
                  }}>
                    1
                  </div>
                  <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--admin-text-primary)', textAlign: 'center' }}>Chờ xác nhận</span>
                </div>

                {/* Step 2 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, width: '22%' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: getStepStatus(selectedOrder.status, 1) === 'completed' ? 'var(--admin-success)' : selectedOrder.status === 'HUY' ? 'var(--admin-danger)' : 'var(--admin-bg)',
                    border: '2px solid ' + (getStepStatus(selectedOrder.status, 1) === 'completed' ? 'var(--admin-success)' : selectedOrder.status === 'HUY' ? 'var(--admin-danger)' : 'var(--admin-border)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.85rem'
                  }}>
                    {selectedOrder.status === 'HUY' ? '✕' : '2'}
                  </div>
                  <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: selectedOrder.status === 'HUY' ? 'var(--admin-danger)' : 'var(--admin-text-primary)', textAlign: 'center' }}>
                    {selectedOrder.status === 'HUY' ? 'Đã hủy' : 'Đã xác nhận'}
                  </span>
                </div>

                {/* Step 3 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, width: '22%' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: getStepStatus(selectedOrder.status, 2) === 'completed' ? 'var(--admin-success)' : 'var(--admin-bg)',
                    border: '2px solid ' + (getStepStatus(selectedOrder.status, 2) === 'completed' ? 'var(--admin-success)' : 'var(--admin-border)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.85rem'
                  }}>
                    3
                  </div>
                  <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--admin-text-primary)', textAlign: 'center' }}>Đang giao hàng</span>
                </div>

                {/* Step 4 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, width: '22%' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: getStepStatus(selectedOrder.status, 3) === 'completed' ? 'var(--admin-success)' : 'var(--admin-bg)',
                    border: '2px solid ' + (getStepStatus(selectedOrder.status, 3) === 'completed' ? 'var(--admin-success)' : 'var(--admin-border)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.85rem'
                  }}>
                    4
                  </div>
                  <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--admin-text-primary)', textAlign: 'center' }}>Hoàn thành</span>
                </div>
              </div>
            </div>

            {/* Thông tin đơn hàng & Người nhận */}
            <div className="order-detail-cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="card glass" style={{ padding: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={16} /> Thông tin người nhận
                </h4>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                  <div><strong>Họ tên:</strong> {selectedOrder.shippingName}</div>
                  <div><strong>Số điện thoại:</strong> {selectedOrder.shippingPhone}</div>
                  <div>
                    <MapPin size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                    <strong>Địa chỉ:</strong> {selectedOrder.shippingAddress}
                  </div>
                </div>
              </div>

              <div className="card glass" style={{ padding: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DollarSign size={16} /> Thông tin thanh toán
                </h4>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                  <div><strong>Tổng tiền hàng:</strong> {selectedOrder.totalAmount?.toLocaleString()}đ</div>
                  <div><strong>Giảm giá:</strong> -{selectedOrder.discountAmount?.toLocaleString()}đ</div>
                  <div style={{ fontSize: '1rem', color: 'var(--admin-primary)', fontWeight: 'bold' }}>
                    <strong>Thực thanh toán:</strong> {selectedOrder.finalAmount?.toLocaleString()}đ
                  </div>
                  <div>
                    <strong>Phương thức:</strong> {selectedOrder.paymentMethod === 'COD' ? 'Tiền mặt khi nhận (COD)' : 'Chuyển khoản (VietQR / MoMo)'}
                  </div>
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong>Trạng thái TT:</strong> {renderPaymentBadge(selectedOrder.paymentStatus, selectedOrder.paymentMethod)}
                  </div>
                </div>
              </div>
            </div>

            {/* Ghi chú đơn hàng nếu có */}
            {selectedOrder.note && (
              <div className="card glass" style={{ padding: '0.75rem 1rem', marginBottom: '1.5rem', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <strong>Ghi chú:</strong> {selectedOrder.note}
              </div>
            )}

            {/* Bảng sản phẩm trong đơn */}
            <h4 style={{ margin: '0 0 0.75rem 0' }}>Sản phẩm trong đơn ({selectedOrder.items?.length || 0})</h4>
            <div className="admin-table-container glass" style={{ marginBottom: '1.5rem' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="no-print">Ảnh</th>
                    <th>Tên sản phẩm</th>
                    <th>Đơn giá</th>
                    <th style={{ textAlign: 'center' }}>Số lượng</th>
                    <th style={{ textAlign: 'right' }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items && selectedOrder.items.map(item => (
                    <tr key={item.id}>
                      <td className="no-print">
                        <img 
                          src={item.productImage} 
                          alt={item.productName} 
                          className="table-img" 
                          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=150&auto=format&fit=crop' }} 
                        />
                      </td>
                      <td><strong>{item.productName}</strong></td>
                      <td style={{ textAlign: 'right' }}>{item.price?.toLocaleString()}đ</td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{(item.price * item.quantity)?.toLocaleString()}đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Khối in tiền COD và Chữ ký cho bản in */}
            <div className="print-only">
              <div style={{ marginTop: '1rem', borderTop: '2px solid #333', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 'bold' }}>
                <span>SỐ TIỀN THU HỘ (COD):</span>
                <span style={{ color: '#dc2626' }}>
                  {selectedOrder.paymentMethod === 'COD' ? `${selectedOrder.finalAmount?.toLocaleString()}đ` : '0đ (ĐÃ THANH TOÁN)'}
                </span>
              </div>

              <div className="print-signatures">
                <div className="print-sig-col">
                  <strong>Người đóng gói</strong>
                  <span>(Ký và ghi rõ họ tên)</span>
                  <div className="print-sig-space"></div>
                </div>
                <div className="print-sig-col">
                  <strong>Shipper giao hàng</strong>
                  <span>(Ký và ghi rõ họ tên)</span>
                  <div className="print-sig-space"></div>
                </div>
                <div className="print-sig-col">
                  <strong>Khách hàng nhận</strong>
                  <span>(Ký và ghi rõ họ tên)</span>
                  <div className="print-sig-space"></div>
                </div>
              </div>
            </div>

            {/* Các nút xử lý trạng thái theo luồng tuần tự (ẩn khi in) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--admin-border)', paddingTop: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem' }}>
                <Calendar size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                <span>Đặt lúc: {formatDate(selectedOrder.createdAt)}</span>
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button 
                  onClick={handlePrintOrderSlip} 
                  className="btn btn-outline" 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={16} /> In Phiếu Giao Hàng
                </button>

                {selectedOrder.status === 'CHO_XAC_NHAN' && (
                  <>
                    <button 
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'DA_XAC_NHAN', selectedOrder)} 
                      disabled={updating}
                      className="btn btn-primary"
                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <CheckCircle2 size={16} /> Duyệt đơn & Xác nhận thanh toán
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'HUY', selectedOrder)} 
                      disabled={updating}
                      className="btn btn-outline"
                      style={{ borderColor: 'var(--admin-danger)', color: 'var(--admin-danger)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <XCircle size={16} /> Hủy đơn
                    </button>
                  </>
                )}

                {selectedOrder.status === 'DA_XAC_NHAN' && (
                  <span style={{ color: 'var(--admin-warning)', fontStyle: 'italic', fontSize: '0.9rem', alignSelf: 'center' }}>
                    Chờ Shipper nhận đơn và giao hàng...
                  </span>
                )}
                
                {(selectedOrder.status === 'DA_NHAN_DON' || selectedOrder.status === 'DANG_GIAO') && (
                  <span style={{ color: 'var(--admin-warning)', fontStyle: 'italic', fontSize: '0.9rem', alignSelf: 'center' }}>
                    Đang được giao bởi Shipper...
                  </span>
                )}

                {selectedOrder.status === 'DA_GIAO' && (
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'HOAN_THANH')} 
                    disabled={updating}
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, #10b981, #047857)' }}
                  >
                    <CheckCircle2 size={16} /> Hoàn thành đơn
                  </button>
                )}

                {(selectedOrder.status === 'HOAN_THANH' || selectedOrder.status === 'HUY') && (
                  <span style={{ 
                    padding: '0.5rem 1rem', 
                    borderRadius: '8px', 
                    background: selectedOrder.status === 'HOAN_THANH' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: selectedOrder.status === 'HOAN_THANH' ? 'var(--admin-success)' : 'var(--admin-danger)',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    border: '1px solid ' + (selectedOrder.status === 'HOAN_THANH' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)')
                  }}>
                    {selectedOrder.status === 'HOAN_THANH' ? 'Đơn hàng đã hoàn thành' : 'Đơn hàng đã bị hủy'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderManager
