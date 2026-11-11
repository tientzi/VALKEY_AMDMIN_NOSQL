import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { Calendar, AlertTriangle, Percent, Tag, Check, X, ArrowRight, Download, Printer, Trash2, ShieldAlert, PackageX } from 'lucide-react'
import { exportToCSV, printDocument } from '../../utils/exportUtils'
import './AdminPages.css'

const ProductBatchManager = () => {
  const [batches, setBatches] = useState([])
  const [expiringBatches, setExpiringBatches] = useState([])
  const [expiredBatches, setExpiredBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('EXPIRING') // EXPIRING, EXPIRED, ALL

  // Modal / Sale configuration
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [discountPercent, setDiscountPercent] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [saleMode, setSaleMode] = useState('PERCENT') // 'PERCENT' or 'PRICE'
  const [applying, setApplying] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const fetchBatches = async () => {
    setLoading(true)
    try {
      const [allRes, expRes, expiredRes] = await Promise.all([
        api.get('/api/admin/batches'),
        api.get('/api/admin/batches/expiring?days=30'),
        api.get('/api/admin/batches/expired')
      ])
      setBatches(allRes.data)
      setExpiringBatches(expRes.data)
      setExpiredBatches(expiredRes.data)
    } catch (err) {
      console.error('Lỗi khi tải thông tin lô hàng', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBatches()
  }, [])

  const openSaleModal = (batch) => {
    if (isExpired(batch.expiryDate)) {
      alert('Lô hàng này đã hết hạn sử dụng! Không được phép thiết lập Sale bán lẻ.')
      return
    }
    setSelectedBatch(batch)
    setDiscountPercent('')
    setCustomPrice('')
    setSaleMode('PERCENT')
    setSuccessMessage('')
  }

  const closeSaleModal = () => {
    setSelectedBatch(null)
    setDiscountPercent('')
    setCustomPrice('')
  }

  const handleApplySale = async (e) => {
    e.preventDefault()
    if (!selectedBatch) return

    const payload = {}
    if (saleMode === 'PERCENT') {
      const pct = parseInt(discountPercent, 10)
      if (!pct || pct <= 0 || pct >= 100) {
        alert('Vui lòng nhập mức % giảm giá hợp lệ từ 1% đến 99%')
        return
      }
      payload.discountPercentage = pct
    } else {
      const price = parseFloat(customPrice)
      if (!price || price <= 0) {
        alert('Vui lòng nhập mức giá sale hợp lệ lớn hơn 0')
        return
      }
      payload.customSalePrice = price
    }

    setApplying(true)
    try {
      // Ưu tiên gọi API sale theo từng lô
      await api.post(`/api/admin/batches/batch/${selectedBatch.id}/clearance-sale`, payload)
      setSuccessMessage(`✅ Đã áp dụng giá Sale xả hàng cho lô ${selectedBatch.batchName} thành công!`)
      setTimeout(() => {
        closeSaleModal()
        fetchBatches()
      }, 1000)
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Lỗi khi áp dụng giá khuyến mãi')
    } finally {
      setApplying(false)
    }
  }

  const handleDisposeBatch = async (batch) => {
    const importPrice = batch.importPrice || 0
    const loss = (batch.quantity || 0) * importPrice
    const confirmMsg = `⚠️ XÁC NHẬN TIÊU HỦY LÔ QUÁ HẠN:\n\n` +
      `- Lô: ${batch.batchName} (Sản phẩm: ${batch.productName})\n` +
      `- Số lượng tồn hủy: ${batch.quantity}\n` +
      `- Đơn giá vốn: ${importPrice.toLocaleString()}đ\n` +
      `- Tổng vốn thiệt hại: ${loss.toLocaleString()}đ\n\n` +
      `Thao tác này sẽ trừ số lượng tồn về 0 và ghi nhận xuất hủy vào Sổ Cái Kho (EXPIRED_DISPOSAL). Bạn có chắc chắn muốn xuất hủy?`

    if (!window.confirm(confirmMsg)) return

    try {
      await api.post(`/api/admin/batches/${batch.id}/dispose`)
      alert(`✅ Đã xuất hủy lô ${batch.batchName} thành công! Nhật ký biến động kho đã được lưu.`)
      fetchBatches()
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Lỗi khi xuất hủy lô hàng')
    }
  }

  const isExpired = (dateString) => {
    if (!dateString) return false
    const d = new Date(dateString)
    d.setHours(23, 59, 59, 999)
    return d < new Date()
  }

  const getStatusBadge = (b) => {
    if (b.status === 'DISPOSED') {
      return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', background: '#f1f5f9', color: '#64748b' }}>Đã xuất hủy</span>
    }
    if (isExpired(b.expiryDate)) {
      return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>Quá hạn sử dụng</span>
    }
    const daysLeft = Math.ceil((new Date(b.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 30) {
      return (
        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', background: '#fef3c7', color: '#d97706', fontWeight: 600 }}>
          Còn {daysLeft} ngày
        </span>
      )
    }
    return (
      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', background: '#ecfdf5', color: '#059669' }}>
        Còn {daysLeft} ngày
      </span>
    )
  }

  if (loading) return <div className="loading-state">Đang tải thông tin lô hàng...</div>

  let displayList = batches
  if (activeTab === 'EXPIRING') displayList = expiringBatches
  else if (activeTab === 'EXPIRED') displayList = expiredBatches

  const totalExpiredLoss = expiredBatches.reduce((sum, b) => {
    const qty = b.quantity || 0
    const price = b.importPrice || 0
    return sum + (qty * price)
  }, 0)

  const handleExportCSV = () => {
    const headers = ['Mã Lô', 'SKU', 'Sản phẩm', 'Tên Lô', 'Số lượng', 'HSD', 'Giá vốn', 'Tổng vốn', 'Trạng thái']
    const rows = displayList.map(b => [
      `#${b.id}`,
      b.productSku || '',
      b.productName || '',
      b.batchName || 'Lô mặc định',
      b.quantity || 0,
      b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('vi-VN') : 'Không có',
      b.importPrice ? `${b.importPrice}đ` : '0đ',
      b.importPrice ? `${(b.quantity * b.importPrice)}đ` : '0đ',
      b.status === 'DISPOSED' ? 'Đã hủy' : isExpired(b.expiryDate) ? 'Hết hạn' : 'Còn hạn'
    ])
    exportToCSV(`Bao_Cao_Lo_Hang_${activeTab}_${new Date().toISOString().slice(0, 10)}`, headers, rows)
  }

  const handlePrint = () => {
    const title = activeTab === 'EXPIRED'
      ? 'Báo cáo Thất thoát Lô Hàng Hết Hạn - Siêu thị MiniMart'
      : activeTab === 'EXPIRING'
        ? 'Báo cáo Lô hàng Cận Date (< 30 ngày) - Siêu thị MiniMart' 
        : 'Báo cáo Toàn bộ Lô hàng & HSD - Siêu thị MiniMart'
    printDocument(title)
  }

  return (
    <div className="admin-crud-page">
      {/* Header cho bản in */}
      <div className="print-only">
        <div className="print-doc-header">
          <div>
            <h1 className="print-brand-title">SIÊU THỊ TIỆN LỢI MINIMART</h1>
            <p className="print-brand-subtitle">Hotline: 1900 8888 - Địa chỉ: TP. Hồ Chí Minh</p>
          </div>
          <div className="print-doc-meta">
            <div>Ngày in: {new Date().toLocaleString('vi-VN')}</div>
            <div>Báo cáo: {activeTab === 'EXPIRED' ? 'Danh sách Lô hàng Quá hạn / Thất thoát vốn' : activeTab === 'EXPIRING' ? 'Cảnh báo cận date (< 30 ngày)' : 'Toàn bộ danh sách lô hàng'}</div>
          </div>
        </div>
        <div className="print-doc-title">
          <h2>BÁO CÁO THEO DÕI LÔ HÀNG & HẠN SỬ DỤNG</h2>
          <p>Tổng số lô ghi nhận: {displayList.length} lô hàng {activeTab === 'EXPIRED' && `(Tổng thiệt hại vốn: ${totalExpiredLoss.toLocaleString()}đ)`}</p>
        </div>
      </div>

      <div className="crud-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Quản lý Lô Hàng, Hạn Sử Dụng & Xuất Hủy</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
            Giám sát vòng đời lô hàng, thiết lập Sale xả kho cận date và xuất hủy hàng quá hạn bảo đảm đúng quy định.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={handleExportCSV} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Xuất Excel / CSV
          </button>
          <button onClick={handlePrint} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={16} /> In Báo Cáo Lô
          </button>
        </div>
      </div>

      {/* Tabs điều hướng */}
      <div className="admin-tabs margin-bottom-md" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #ddd', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button 
          className={`btn ${activeTab === 'EXPIRING' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('EXPIRING')}
          style={{ position: 'relative' }}
        >
          <AlertTriangle size={16} style={{ marginRight: '6px' }} />
          Cảnh báo cận Date (30 ngày)
          {expiringBatches.length > 0 && (
            <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#d97706', color: 'white', borderRadius: '50%', width: '22px', height: '22px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {expiringBatches.length}
            </span>
          )}
        </button>

        <button 
          className={`btn ${activeTab === 'EXPIRED' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('EXPIRED')}
          style={{ position: 'relative', borderColor: '#dc2626', color: activeTab === 'EXPIRED' ? '#fff' : '#dc2626', background: activeTab === 'EXPIRED' ? '#dc2626' : 'transparent' }}
        >
          <ShieldAlert size={16} style={{ marginRight: '6px' }} />
          Lô hàng đã hết hạn
          {expiredBatches.length > 0 && (
            <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#991b1b', color: 'white', borderRadius: '50%', width: '22px', height: '22px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {expiredBatches.length}
            </span>
          )}
        </button>

        <button 
          className={`btn ${activeTab === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('ALL')}
        >
          Tất cả lô hàng ({batches.length})
        </button>
      </div>

      {/* Card thống kê thiệt hại nếu ở tab EXPIRED */}
      {activeTab === 'EXPIRED' && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ color: '#991b1b', fontWeight: 600, fontSize: '0.95rem' }}>Tổng số lô quá hạn cần xử lý: {expiredBatches.length} lô</div>
            <div style={{ color: '#7f1d1d', fontSize: '0.85rem', marginTop: '2px' }}>Hàng hết hạn bắt buộc không được phép bán hoặc khuyến mãi. Vui lòng bấm "Xuất hủy kho" để hoàn tất chứng từ.</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', color: '#991b1b' }}>Tổng thiệt hại vốn ước tính:</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626' }}>{totalExpiredLoss.toLocaleString()}đ</div>
          </div>
        </div>
      )}

      <div className="admin-table-container glass">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID Lô</th>
              <th>Mã SKU</th>
              <th>Tên sản phẩm</th>
              <th>Tên Lô</th>
              <th>Số lượng tồn</th>
              <th>Hạn sử dụng</th>
              <th>Đơn giá vốn</th>
              {activeTab === 'EXPIRED' ? (
                <th>Tổn thất vốn</th>
              ) : (
                <th>% Đang Sale</th>
              )}
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {displayList.map(b => {
              const expired = isExpired(b.expiryDate)
              const importPrice = b.importPrice || 0
              const loss = (b.quantity || 0) * importPrice

              return (
                <tr key={b.id} style={{ background: expired ? '#fff5f5' : 'transparent' }}>
                  <td>#{b.id}</td>
                  <td><code>{b.productSku}</code></td>
                  <td><strong>{b.productName}</strong></td>
                  <td>{b.batchName || 'Lô mặc định'}</td>
                  <td>
                    <strong style={{ color: expired ? '#dc2626' : '#0284c7' }}>
                      {b.quantity}
                    </strong>
                  </td>
                  <td>
                    <Calendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle', color: expired ? '#dc2626' : 'inherit' }} />
                    <span style={{ color: expired ? '#dc2626' : 'inherit', fontWeight: expired ? 'bold' : 'normal' }}>
                      {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('vi-VN') : '—'}
                    </span>
                  </td>
                  <td>{importPrice > 0 ? `${importPrice.toLocaleString()}đ` : '—'}</td>
                  
                  {activeTab === 'EXPIRED' ? (
                    <td><strong style={{ color: '#dc2626' }}>{loss > 0 ? `${loss.toLocaleString()}đ` : '0đ'}</strong></td>
                  ) : (
                    <td>
                      {b.discountPercentage && b.discountPercentage > 0 ? (
                        <span 
                          style={{ 
                            background: '#fee2e2', 
                            color: '#dc2626', 
                            padding: '4px 10px', 
                            borderRadius: '20px', 
                            fontWeight: 800, 
                            fontSize: '0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                            border: '1px solid #fecaca'
                          }}
                          title={b.originalPrice && b.salePrice ? `Giá gốc: ${b.originalPrice.toLocaleString()}đ ➔ Giá sale: ${b.salePrice.toLocaleString()}đ` : 'Đang xả kho giảm giá'}
                        >
                          -{b.discountPercentage}%
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>—</span>
                      )}
                    </td>
                  )}

                  <td>{getStatusBadge(b)}</td>
                  
                  <td>
                    {expired ? (
                      <button 
                        onClick={() => handleDisposeBatch(b)}
                        className="btn" 
                        disabled={b.quantity <= 0 || b.status === 'DISPOSED'}
                        style={{ 
                          padding: '5px 10px', 
                          fontSize: '0.85rem', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          background: b.quantity <= 0 ? '#e2e8f0' : '#dc2626',
                          color: b.quantity <= 0 ? '#94a3b8' : '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: b.quantity <= 0 ? 'not-allowed' : 'pointer'
                        }}
                        title={b.quantity <= 0 ? 'Lô này đã xuất hủy xong' : 'Xuất hủy kho do quá hạn sử dụng'}
                      >
                        <Trash2 size={14} /> {b.quantity <= 0 ? 'Đã hủy' : 'Xuất hủy kho'}
                      </button>
                    ) : (
                      <button 
                        onClick={() => openSaleModal(b)} 
                        className="btn btn-primary" 
                        style={{ padding: '5px 10px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Percent size={14} /> Thiết lập Sale
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {displayList.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  {activeTab === 'EXPIRED' ? 'Tuyệt vời! Không có lô hàng nào bị quá hạn.' : activeTab === 'EXPIRING' ? 'Không có lô hàng nào sắp hết hạn trong 30 ngày tới.' : 'Chưa có lô hàng nào.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Chữ ký khi in */}
      <div className="print-only print-signatures">
        <div className="print-sig-col">
          <strong>Người Kiểm Kê Lô</strong>
          <span>(Ký và ghi rõ họ tên)</span>
          <div className="print-sig-space"></div>
        </div>
        <div className="print-sig-col">
          <strong>Thủ Kho Quản Lý</strong>
          <span>(Ký và ghi rõ họ tên)</span>
          <div className="print-sig-space"></div>
        </div>
        <div className="print-sig-col">
          <strong>Ban Giám Đốc</strong>
          <span>(Ký và ghi rõ họ tên)</span>
          <div className="print-sig-space"></div>
        </div>
      </div>

      {/* MODAL THIẾT LẬP MỨC SALE */}
      {selectedBatch && (
        <div className="admin-form-overlay" onClick={(e) => e.target === e.currentTarget && closeSaleModal()}>
          <form onSubmit={handleApplySale} className="admin-popup-form glass" style={{ maxWidth: '480px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag size={20} color="#d97706" /> Thiết lập giá Sale xả hàng cho lô
              </h3>
              <button type="button" onClick={closeSaleModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#475569' }}>
              Lô hàng: <strong>{selectedBatch.batchName}</strong> (Sản phẩm: {selectedBatch.productName})
            </p>

            {/* Chọn chế độ nhập */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
              <button
                type="button"
                className={`btn ${saleMode === 'PERCENT' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSaleMode('PERCENT')}
                style={{ flex: 1, padding: '6px' }}
              >
                Giảm theo %
              </button>
              <button
                type="button"
                className={`btn ${saleMode === 'PRICE' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSaleMode('PRICE')}
                style={{ flex: 1, padding: '6px' }}
              >
                Nhập giá Sale trực tiếp
              </button>
            </div>

            {saleMode === 'PERCENT' ? (
              <div className="form-group">
                <label>Nhập mức giảm giá mong muốn (%):</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    required
                    placeholder="Nhập % giảm giá..."
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>%</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  {[10, 20, 30, 50].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setDiscountPercent(p.toString())}
                      style={{ padding: '3px 8px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                    >
                      -{p}%
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label>Nhập giá bán Sale trực tiếp (VNĐ):</label>
                <input
                  type="number"
                  min="1000"
                  step="500"
                  required
                  placeholder="Nhập giá mới..."
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.85rem', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.85rem', color: '#166534' }}>Mức điều chỉnh:</span>
                <strong style={{ color: '#16a34a' }}>
                  {saleMode === 'PERCENT' ? `Giảm ${discountPercent || 0}%` : `Định giá trực tiếp`}
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#15803d' }}>
                ✨ Giá sale mới sẽ áp dụng ưu tiên cho lô hàng cận date này và hiển thị nổi bật trên cửa hàng.
              </p>
            </div>

            {successMessage && (
              <div style={{ color: '#16a34a', fontWeight: 'bold', marginBottom: '1rem', textAlign: 'center' }}>
                {successMessage}
              </div>
            )}

            <div className="form-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeSaleModal} className="btn btn-outline" disabled={applying}>
                Hủy bỏ
              </button>
              <button type="submit" className="btn btn-primary" disabled={applying}>
                {applying ? 'Đang lưu...' : 'Xác nhận áp dụng Sale'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default ProductBatchManager
