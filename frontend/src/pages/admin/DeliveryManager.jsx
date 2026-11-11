import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { 
  Truck, MapPin, CheckCircle2, AlertTriangle, RefreshCw, 
  User, Phone, Calendar, ArrowRight, ShieldCheck, Clock, Check, Zap, Download, Printer
} from 'lucide-react'
import { exportToCSV, printDocument } from '../../utils/exportUtils'
import './AdminPages.css'

const DeliveryManager = () => {
  const [unassignedOrders, setUnassignedOrders] = useState([])
  const [trackingOrders, setTrackingOrders] = useState([])
  const [shippers, setShippers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('ASSIGN') // 'ASSIGN' or 'TRACKING'

  // Assignment selection
  const [selectedDistrict, setSelectedDistrict] = useState('ALL') // 'ALL', 'Quận Tân Phú', 'Quận Tân Bình', 'Quận 12'
  const [selectedOrderIds, setSelectedOrderIds] = useState([])
  const [targetShipperId, setTargetShipperId] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Reassign modal
  const [reassignModalOrder, setReassignModalOrder] = useState(null)
  const [reassignShipperId, setReassignShipperId] = useState('')
  const [reassigning, setReassigning] = useState(false)
  const [autoDispatching, setAutoDispatching] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [unassignedRes, trackingRes, shippersRes] = await Promise.all([
        api.get('/api/admin/deliveries/unassigned'),
        api.get('/api/admin/deliveries/tracking'),
        api.get('/api/admin/deliveries/shippers')
      ])
      setUnassignedOrders(unassignedRes.data)
      setTrackingOrders(trackingRes.data)
      setShippers(shippersRes.data)

      // Auto select first shipper if available
      if (shippersRes.data.length > 0 && !targetShipperId) {
        setTargetShipperId(shippersRes.data[0].id)
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu giao hàng:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Auto suggest shipper when district filter changes
  useEffect(() => {
    if (shippers.length === 0) return

    if (selectedDistrict === 'Quận Tân Phú') {
      const sp = shippers.find(s => s.username === 'shipper1' || s.assignedDistrict?.includes('Tân Phú'))
      if (sp) setTargetShipperId(sp.id)
    } else if (selectedDistrict === 'Quận Tân Bình') {
      const sp = shippers.find(s => s.username === 'shipper2' || s.assignedDistrict?.includes('Tân Bình'))
      if (sp) setTargetShipperId(sp.id)
    } else if (selectedDistrict === 'Quận 12') {
      const sp = shippers.find(s => s.username === 'shipper3' || s.assignedDistrict?.includes('12'))
      if (sp) setTargetShipperId(sp.id)
    }
  }, [selectedDistrict, shippers])

  // Filter unassigned orders by district
  const filteredUnassigned = unassignedOrders.filter(o => {
    if (selectedDistrict === 'ALL') return true
    return o.detectedDistrict === selectedDistrict
  })

  // Select all checkbox
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedOrderIds(filteredUnassigned.map(o => o.id))
    } else {
      setSelectedOrderIds([])
    }
  }

  const handleToggleSelectOrder = (id) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  // Assign batch
  const handleAssign = async () => {
    if (selectedOrderIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 đơn hàng để phân công!')
      return
    }
    if (!targetShipperId) {
      alert('Vui lòng chọn Shipper nhận đơn!')
      return
    }

    const targetShipper = shippers.find(s => s.id === Number(targetShipperId))
    const confirmMsg = `Xác nhận phân công ${selectedOrderIds.length} đơn hàng cho Shipper "${targetShipper?.fullName || targetShipper?.username}"?`
    if (!window.confirm(confirmMsg)) return

    setAssigning(true)
    try {
      await api.post('/api/admin/deliveries/assign', {
        orderIds: selectedOrderIds,
        shipperId: Number(targetShipperId)
      })
      alert(`✅ Đã phân công thành công ${selectedOrderIds.length} đơn hàng!`)
      setSelectedOrderIds([])
      await fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi khi phân công đơn hàng')
    } finally {
      setAssigning(false)
    }
  }

  // Reassign single failed order
  const handleReassign = async () => {
    if (!reassignModalOrder || !reassignShipperId) return
    setReassigning(true)
    try {
      await api.post('/api/admin/deliveries/reassign', {
        orderId: reassignModalOrder.id,
        shipperId: Number(reassignShipperId)
      })
      alert(`✅ Đã điều phối lại đơn #${reassignModalOrder.id} cho Shipper thành công!`)
      setReassignModalOrder(null)
      await fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi khi điều phối lại đơn hàng')
    } finally {
      setReassigning(false)
    }
  }

  // Auto dispatch by area
  const handleAutoDispatch = async () => {
    if (unassignedOrders.length === 0) {
      alert('Không có đơn hàng nào chờ phân bổ!')
      return
    }
    const areaName = selectedDistrict === 'ALL' ? 'toàn bộ các khu vực' : selectedDistrict
    if (!window.confirm(`Hệ thống sẽ tự động quét và phân chia nhanh các đơn hàng chưa gán cho các Shipper phụ trách ${areaName}. Xác nhận thực hiện?`)) return

    setAutoDispatching(true)
    try {
      const res = await api.post('/api/admin/deliveries/auto-dispatch', {
        district: selectedDistrict
      })
      alert(`✅ ${res.data?.message || 'Đã phân bổ nhanh thành công!'}`)
      setSelectedOrderIds([])
      await fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi khi phân bổ nhanh theo khu vực')
    } finally {
      setAutoDispatching(false)
    }
  }

  const getDistrictBadgeColor = (district) => {
    switch (district) {
      case 'Quận Tân Phú': return '#d97706' // amber
      case 'Quận Tân Bình': return '#0284c7' // blue
      case 'Quận 12': return '#059669' // green
      default: return '#64748b'
    }
  }

  const handleExportCSV = () => {
    if (activeTab === 'ASSIGN') {
      const headers = ['Mã Đơn', 'Ngày đặt', 'Khách hàng', 'Số điện thoại', 'Địa chỉ nhận', 'Khu vực nhận diện', 'Tổng tiền (VND)', 'Phương thức', 'Trạng thái']
      const rows = filteredUnassigned.map(o => [
        `#${o.id}`,
        new Date(o.createdAt).toLocaleString('vi-VN'),
        o.shippingName || '',
        o.shippingPhone || '',
        o.shippingAddress || '',
        o.detectedDistrict || 'Khu vực khác',
        o.finalAmount || 0,
        o.paymentMethod === 'COD' ? 'Tiền mặt (COD)' : 'Chuyển khoản VietQR',
        'Chờ phân bổ'
      ])
      exportToCSV(`Bang_Ke_Don_Cho_Giao_${selectedDistrict.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`, headers, rows)
    } else {
      const headers = ['Mã Đơn', 'Khách hàng', 'Số điện thoại', 'Địa chỉ giao hàng', 'Khu vực', 'Shipper phụ trách', 'SĐT Shipper', 'Tổng tiền (VND)', 'Trạng thái giao hàng']
      const rows = trackingOrders.map(o => [
        `#${o.id}`,
        o.shippingName || '',
        o.shippingPhone || '',
        o.shippingAddress || '',
        o.detectedDistrict || 'Khu vực khác',
        o.shipperName || '',
        o.shipperPhone || '',
        o.finalAmount || 0,
        o.status === 'DANG_GIAO' ? 'Đang giao hàng' : o.status === 'DA_NHAN_DON' ? 'Shipper đã nhận' : o.status
      ])
      exportToCSV(`Bang_Ke_Theo_Doi_Giao_Hang_${new Date().toISOString().slice(0, 10)}`, headers, rows)
    }
  }

  const handlePrint = () => {
    const title = activeTab === 'ASSIGN' 
      ? `Bang_Ke_Don_Hang_Cho_Phan_Bo_${selectedDistrict}` 
      : 'Bang_Ke_Theo_Doi_Giao_Hang_MiniMart'
    printDocument(title)
  }

  return (
    <div className="admin-page-container">
      {/* Header cho bản in */}
      <div className="print-only">
        <div className="print-doc-header">
          <div>
            <h1 className="print-brand-title">SIÊU THỊ TIỆN LỢI MINIMART</h1>
            <p className="print-brand-subtitle">Hotline: 1900 8888 - Địa chỉ: TP. Hồ Chí Minh</p>
          </div>
          <div className="print-doc-meta">
            <div>Ngày lập: {new Date().toLocaleString('vi-VN')}</div>
            <div>Khu vực: <strong>{selectedDistrict}</strong></div>
          </div>
        </div>
        <div className="print-doc-title">
          <h2>BẢNG KÊ ĐIỀU PHỐI GIAO HÀNG (DELIVERY MANIFEST)</h2>
          <p>{activeTab === 'ASSIGN' ? `Danh sách đơn hàng chờ giao theo khu vực: ${selectedDistrict}` : 'Bảng theo dõi hành trình giao hàng của Shipper'}</p>
        </div>
      </div>
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h2>Quản lý Giao hàng & Phân bổ Khu vực</h2>
          <p className="subtitle">Tự động nhận diện 3 khu vực (Tân Phú, Tân Bình, Quận 12) và phân bổ nhanh cho Shipper</p>
        </div>
        <div className="header-actions no-print" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={handleExportCSV} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Xuất Excel / CSV
          </button>
          <button onClick={handlePrint} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={16} /> In Bảng Kê
          </button>
          <button 
            onClick={handleAutoDispatch} 
            disabled={autoDispatching || unassignedOrders.length === 0} 
            className="btn btn-primary"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              borderColor: '#d97706',
              color: 'white',
              fontWeight: 700
            }}
          >
            <Zap size={16} /> {autoDispatching ? 'Đang phân bổ...' : 'Phân bổ nhanh theo khu vực'}
          </button>
          <button onClick={fetchData} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={16} /> Làm mới
          </button>
        </div>
      </div>

      {/* Shipper Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '25px' }}>
        {shippers.map(s => (
          <div key={s.id} className="admin-card" style={{ padding: '16px 20px', borderLeft: `5px solid ${getDistrictBadgeColor(s.assignedDistrict)}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={18} color="#0284c7" />
                  <strong>{s.fullName}</strong>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
                  <Phone size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  {s.phone}
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                  Khu vực: <span style={{ fontWeight: '700', color: getDistrictBadgeColor(s.assignedDistrict) }}>{s.assignedDistrict}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>{s.activeOrdersCount}</span>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>đơn đang giao</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
        <button
          onClick={() => setActiveTab('ASSIGN')}
          className={`btn ${activeTab === 'ASSIGN' ? 'btn-primary' : 'btn-outline'}`}
        >
          📦 Đơn Chờ Phân Công ({unassignedOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('TRACKING')}
          className={`btn ${activeTab === 'TRACKING' ? 'btn-primary' : 'btn-outline'}`}
        >
          🚚 Đang Giao & Giao Thất Bại ({trackingOrders.length})
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Đang tải dữ liệu...</div>
      ) : activeTab === 'ASSIGN' ? (
        /* Tab 1: Assign Orders */
        <div>
          {/* Action ToolBar */}
          <div className="admin-card" style={{ marginBottom: '20px', padding: '16px 20px', background: '#f8fafc' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* District Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#475569' }}>Lọc theo khu vực:</span>
                <select
                  value={selectedDistrict}
                  onChange={(e) => {
                    setSelectedDistrict(e.target.value)
                    setSelectedOrderIds([])
                  }}
                  className="admin-select"
                  style={{ minWidth: '180px', fontWeight: '600' }}
                >
                  <option value="ALL">📍 Tất cả khu vực ({unassignedOrders.length})</option>
                  <option value="Quận Tân Phú">🏢 Quận Tân Phú ({unassignedOrders.filter(o => o.detectedDistrict === 'Quận Tân Phú').length})</option>
                  <option value="Quận Tân Bình">✈️ Quận Tân Bình ({unassignedOrders.filter(o => o.detectedDistrict === 'Quận Tân Bình').length})</option>
                  <option value="Quận 12">🌳 Quận 12 ({unassignedOrders.filter(o => o.detectedDistrict === 'Quận 12').length})</option>
                </select>
              </div>

              {/* Assign Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Đã chọn <strong>{selectedOrderIds.length}</strong> đơn
                </span>
                <select
                  value={targetShipperId}
                  onChange={(e) => setTargetShipperId(e.target.value)}
                  className="admin-select"
                  style={{ minWidth: '220px', fontWeight: '600' }}
                >
                  <option value="">-- Chọn Shipper nhận đơn --</option>
                  {shippers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.assignedDistrict} - Đang giao: {s.activeOrdersCount})
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleAssign}
                  disabled={selectedOrderIds.length === 0 || !targetShipperId || assigning}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Truck size={16} /> {assigning ? 'Đang phân công...' : 'Phân công cho Shipper'}
                </button>

                <button
                  onClick={handleAutoDispatch}
                  disabled={autoDispatching || unassignedOrders.length === 0}
                  className="btn"
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#b45309',
                    fontWeight: 700
                  }}
                  title="Tự động phân chia các đơn hàng chưa gán cho shipper theo khu vực"
                >
                  <Zap size={16} color="#d97706" /> {autoDispatching ? 'Đang chia...' : '⚡ Phân bổ nhanh'}
                </button>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="admin-card">
            {filteredUnassigned.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                Không có đơn hàng nào chờ phân công tại khu vực đã chọn.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          onChange={handleSelectAll}
                          checked={filteredUnassigned.length > 0 && selectedOrderIds.length === filteredUnassigned.length}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </th>
                      <th>Mã Đơn</th>
                      <th>Khu Vực Nhận Diện</th>
                      <th>Khách Hàng</th>
                      <th>Số Điện Thoại</th>
                      <th>Địa Chỉ Giao Chi Tiết</th>
                      <th>Thu Tiền</th>
                      <th>Ghi Chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnassigned.map(order => {
                      const isSelected = selectedOrderIds.includes(order.id)
                      const isCod = order.paymentMethod === 'COD'
                      return (
                        <tr key={order.id} style={{ background: isSelected ? '#f0f9ff' : 'transparent' }}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectOrder(order.id)}
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                          </td>
                          <td><strong>#{order.id}</strong></td>
                          <td>
                            <span 
                              style={{ 
                                background: '#f1f5f9', 
                                color: getDistrictBadgeColor(order.detectedDistrict), 
                                padding: '4px 10px', 
                                borderRadius: '6px', 
                                fontWeight: '700',
                                fontSize: '0.82rem',
                                border: `1px solid ${getDistrictBadgeColor(order.detectedDistrict)}40`
                              }}
                            >
                              📍 {order.detectedDistrict || 'Chưa xác định'}
                            </span>
                          </td>
                          <td>{order.shippingName}</td>
                          <td>{order.shippingPhone}</td>
                          <td style={{ maxWidth: '280px', fontSize: '0.88rem' }}>{order.shippingAddress}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <strong style={{ color: isCod ? '#b45309' : '#059669' }}>
                                {isCod ? `${(order.finalAmount || 0).toLocaleString()}đ (Thu COD)` : '0đ (Đã TT QR)'}
                              </strong>
                              <span style={{ fontSize: '0.75rem', color: isCod ? '#0369a1' : '#15803d', fontWeight: 600 }}>
                                {isCod ? '🚚 Đã duyệt COD' : '✓ Đã duyệt tiền QR'}
                              </span>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{order.note || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Tab 2: Tracking & Failed Deliveries */
        <div className="admin-card">
          {trackingOrders.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Hiện không có đơn hàng nào đang trong quá trình giao hoặc giao thất bại.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Mã Đơn</th>
                    <th>Khu Vực</th>
                    <th>Shipper Phụ Trách</th>
                    <th>Khách Hàng & SĐT</th>
                    <th>Địa Chỉ</th>
                    <th>Trạng Thái Giao</th>
                    <th>Lý Do Thất Bại / Ghi Chú</th>
                    <th style={{ textAlign: 'center' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {trackingOrders.map(order => {
                    const isFailed = order.status === 'GIAO_THAT_BAI'
                    return (
                      <tr key={order.id} style={{ background: isFailed ? '#fff1f2' : 'transparent' }}>
                        <td><strong>#{order.id}</strong></td>
                        <td>
                          <span style={{ fontWeight: '600', color: getDistrictBadgeColor(order.detectedDistrict), fontSize: '0.85rem' }}>
                            {order.detectedDistrict}
                          </span>
                        </td>
                        <td>
                          <strong>{order.shipperName || '—'}</strong>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{order.shipperPhone}</div>
                        </td>
                        <td>
                          <div>{order.shippingName}</div>
                          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{order.shippingPhone}</div>
                        </td>
                        <td style={{ maxWidth: '240px', fontSize: '0.85rem' }}>{order.shippingAddress}</td>
                        <td>
                          <span className={`status-pill ${isFailed ? 'inactive' : 'active'}`}>
                            {isFailed ? 'Giao thất bại' : order.status === 'DANG_GIAO' ? 'Đang giao hàng' : 'Đã nhận đơn'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: isFailed ? '#be123c' : '#475569' }}>
                          {isFailed ? (
                            <span>⚠️ <strong>Lý do:</strong> {order.deliveryFailedReason || 'Không liên lạc được khách'}</span>
                          ) : (
                            order.deliveryNote || '—'
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isFailed && (
                            <button
                              onClick={() => {
                                setReassignModalOrder(order)
                                setReassignShipperId(shippers[0]?.id || '')
                              }}
                              className="btn btn-outline"
                              style={{ fontSize: '0.78rem', padding: '4px 10px', color: '#be123c', borderColor: '#fca5a5' }}
                            >
                              Điều phối lại
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reassign Modal */}
      {reassignModalOrder && (
        <div className="admin-modal-overlay" onClick={(e) => e.target === e.currentTarget && setReassignModalOrder(null)}>
          <div className="admin-modal-box" style={{ maxWidth: '480px' }}>
            <h3 style={{ marginBottom: '16px' }}>Điều Phối Lại Đơn Hàng #{reassignModalOrder.id}</h3>
            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '14px' }}>
              Đơn hàng giao thất bại: <strong>{reassignModalOrder.shippingAddress}</strong>
            </p>
            <div style={{ background: '#fef2f2', padding: '10px 14px', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem', marginBottom: '16px' }}>
              Lý do thất bại lần trước: {reassignModalOrder.deliveryFailedReason || 'Không rõ'}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="admin-label">Chọn Shipper mới để giao lại</label>
              <select
                value={reassignShipperId}
                onChange={(e) => setReassignShipperId(e.target.value)}
                className="admin-select"
                style={{ width: '100%' }}
              >
                {shippers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.assignedDistrict} - Đang giao: {s.activeOrdersCount})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setReassignModalOrder(null)} className="btn btn-outline">Hủy</button>
              <button onClick={handleReassign} disabled={reassigning} className="btn btn-primary">
                {reassigning ? 'Đang chuyển...' : 'Xác nhận điều phối lại'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Chữ ký khi in */}
      <div className="print-only print-signatures">
        <div className="print-sig-col">
          <strong>Điều Phối Viên Kho</strong>
          <span>(Ký và ghi rõ họ tên)</span>
          <div className="print-sig-space"></div>
        </div>
        <div className="print-sig-col">
          <strong>Đội Trưởng Shipper</strong>
          <span>(Ký và ghi rõ họ tên)</span>
          <div className="print-sig-space"></div>
        </div>
        <div className="print-sig-col">
          <strong>Quản Lý Ca Trực</strong>
          <span>(Ký và ghi rõ họ tên)</span>
          <div className="print-sig-space"></div>
        </div>
      </div>
    </div>
  )
}

export default DeliveryManager
