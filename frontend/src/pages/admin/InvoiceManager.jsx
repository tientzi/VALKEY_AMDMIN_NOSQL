import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { 
  FileText, Eye, Printer, Download, Search, Calendar, Filter, 
  CheckCircle2, Clock, XCircle, X, Store, User, Phone, MapPin, DollarSign
} from 'lucide-react'
import './AdminPages.css'
import { exportToCSV, printDocument } from '../../utils/exportUtils'
import { matchesRelative } from '../../utils/searchUtils'

const InvoiceManager = () => {
  const [invoices, setInvoices] = useState([])
  const [filteredInvoices, setFilteredInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  
  // Filters
  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/admin/orders')
      setInvoices(res.data)
      setFilteredInvoices(res.data)
    } catch (err) {
      console.error('Lỗi khi tải danh sách hóa đơn:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [])

  useEffect(() => {
    let result = [...invoices]

    if (searchKeyword.trim()) {
      result = result.filter(inv => 
        matchesRelative([
          `#${inv.id}`,
          inv.id,
          inv.shippingName,
          inv.shippingPhone,
          inv.shippingAddress
        ], searchKeyword)
      )
    }

    if (statusFilter !== 'ALL') {
      if (statusFilter === 'PAID') {
        result = result.filter(inv => inv.paymentStatus === 'COMPLETED' || inv.status === 'HOAN_THANH')
      } else if (statusFilter === 'APPROVED_COD') {
        result = result.filter(inv => inv.paymentStatus === 'APPROVED_COD')
      } else if (statusFilter === 'PENDING') {
        result = result.filter(inv => (inv.paymentStatus === 'PENDING' || inv.status === 'CHO_XAC_NHAN') && inv.status !== 'HUY')
      } else if (statusFilter === 'CANCELLED') {
        result = result.filter(inv => inv.status === 'HUY' || inv.paymentStatus === 'FAILED')
      }
    }

    if (methodFilter !== 'ALL') {
      result = result.filter(inv => inv.paymentMethod === methodFilter)
    }

    if (startDate) {
      result = result.filter(inv => new Date(inv.createdAt) >= new Date(startDate))
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      result = result.filter(inv => new Date(inv.createdAt) <= end)
    }

    setFilteredInvoices(result)
  }, [searchKeyword, statusFilter, methodFilter, startDate, endDate, invoices])

  const handlePrint = () => {
    if (selectedInvoice) {
      printDocument(`Hoa_Don_Ban_Le_INV${selectedInvoice.id}_MiniMart`)
    } else {
      printDocument('Danh_Sach_Hoa_Don_MiniMart')
    }
  }

  const handleExportCSV = () => {
    const headers = ['Mã HĐ', 'Mã Đơn', 'Khách hàng', 'Số điện thoại', 'Ngày tạo', 'Tổng tiền (VND)', 'Giảm giá (VND)', 'Thực thanh toán (VND)', 'Phương thức', 'Trạng thái']
    const rows = filteredInvoices.map(inv => [
      `INV-${inv.id}`,
      `#${inv.id}`,
      inv.shippingName || '',
      inv.shippingPhone || '',
      new Date(inv.createdAt).toLocaleString('vi-VN'),
      inv.totalAmount || 0,
      inv.discountAmount || 0,
      inv.finalAmount || 0,
      inv.paymentMethod === 'COD' ? 'Tiền mặt COD' : 'Chuyển khoản VietQR',
      inv.paymentStatus === 'APPROVED_COD' ? 'Đã duyệt COD (Thu khi giao)' :
      inv.paymentStatus === 'COMPLETED' || inv.status === 'HOAN_THANH' ? 'Đã thanh toán' :
      inv.status === 'HUY' ? 'Đã hủy' : 'Chờ Admin duyệt'
    ])

    exportToCSV(`Bao_Cao_Hoa_Don_MiniMart_${new Date().toISOString().slice(0, 10)}`, headers, rows)
  }

  const getPaymentStatusBadge = (inv) => {
    if (inv.status === 'HUY' || inv.paymentStatus === 'FAILED') {
      return <span className="status-pill inactive"><XCircle size={14} /> Đã hủy</span>
    }
    if (inv.paymentStatus === 'APPROVED_COD') {
      return <span className="status-pill" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}><CheckCircle2 size={14} /> Đã duyệt COD (Thu khi giao)</span>
    }
    if (inv.paymentStatus === 'COMPLETED' || inv.status === 'HOAN_THANH') {
      return <span className="status-pill active" style={{ background: '#dcfce7', color: '#15803d' }}><CheckCircle2 size={14} /> Đã thanh toán</span>
    }
    return <span className="status-pill warning" style={{ background: '#fef3c7', color: '#b45309' }}><Clock size={14} /> Chờ Admin duyệt</span>
  }

  return (
    <div className="admin-crud-page">
      {/* Header & Export Actions */}
      <div className="crud-header">
        <div>
          <h2>Quản lý Hóa đơn</h2>
          <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
            Hệ thống lưu trữ chứng từ thanh toán bán lẻ. Hóa đơn được bảo vệ toàn vẹn (Chỉ xem và xuất, không được xóa).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={handleExportCSV} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Xuất Excel / CSV
          </button>
          <button onClick={handlePrint} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={16} /> In Danh Sách
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="admin-filters-card glass" style={{ padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flexGrow: 1, minWidth: '220px' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text" 
            placeholder="Tìm theo mã HĐ, tên khách, số điện thoại..." 
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.2rem', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-text-primary)' }}
          />
        </div>

        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-text-primary)' }}
        >
          <option value="ALL">Tất cả thanh toán</option>
          <option value="PAID">Đã thanh toán (QR)</option>
          <option value="APPROVED_COD">Đã duyệt COD (Thu khi giao)</option>
          <option value="PENDING">Chờ Admin duyệt</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>

        <select 
          value={methodFilter} 
          onChange={(e) => setMethodFilter(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-text-primary)' }}
        >
          <option value="ALL">Tất cả phương thức</option>
          <option value="COD">Tiền mặt (COD)</option>
          <option value="BANK_TRANSFER">Chuyển khoản VietQR</option>
          <option value="MOMO">Ví MoMo</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>Từ:</span>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-text-primary)' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>Đến:</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-text-primary)' }}
          />
        </div>

        {(searchKeyword || statusFilter !== 'ALL' || methodFilter !== 'ALL' || startDate || endDate) && (
          <button 
            onClick={() => { setSearchKeyword(''); setStatusFilter('ALL'); setMethodFilter('ALL'); setStartDate(''); setEndDate('') }}
            className="btn btn-outline"
            style={{ padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}
          >
            Đặt lại
          </button>
        )}
      </div>

      {/* Invoice Table */}
      <div className="admin-table-container glass">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Mã Hóa Đơn</th>
              <th>Ngày Lập</th>
              <th>Khách Hàng</th>
              <th>Số Điện Thoại</th>
              <th>Tổng Tiền</th>
              <th>Giảm Giá</th>
              <th>Thực Thu</th>
              <th>Phương Thức</th>
              <th>Trạng Thái</th>
              <th style={{ textAlign: 'center' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '2rem' }}>Đang tải danh sách hóa đơn...</td>
              </tr>
            ) : filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td><strong>INV-{String(inv.id).padStart(5, '0')}</strong></td>
                  <td>{new Date(inv.createdAt).toLocaleString('vi-VN')}</td>
                  <td>{inv.shippingName}</td>
                  <td>{inv.shippingPhone}</td>
                  <td>{inv.totalAmount?.toLocaleString()}đ</td>
                  <td style={{ color: '#16a34a' }}>-{inv.discountAmount?.toLocaleString() || 0}đ</td>
                  <td><strong style={{ color: 'var(--primary)' }}>{inv.finalAmount?.toLocaleString()}đ</strong></td>
                  <td>
                    {inv.paymentMethod === 'COD' ? 'Tiền mặt (COD)' : inv.paymentMethod === 'MOMO' ? 'Ví MoMo' : 'Chuyển khoản VietQR'}
                  </td>
                  <td>{getPaymentStatusBadge(inv)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      onClick={() => setSelectedInvoice(inv)}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      title="Xem chi tiết hóa đơn"
                    >
                      <Eye size={15} /> Xem
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                  Không tìm thấy hóa đơn nào phù hợp với điều kiện tìm kiếm.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL POPUP XEM CHI TIẾT HÓA ĐƠN Ở CHÍNH GIỮA MÀN HÌNH */}
      {selectedInvoice && (
        <div 
          className="invoice-modal-overlay" 
          onClick={(e) => e.target === e.currentTarget && setSelectedInvoice(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div 
            className="invoice-popup-card glass"
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: '2rem',
              position: 'relative'
            }}
          >
            {/* Header popup & Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                PHIẾU THU / HÓA ĐƠN BÁN LẺ
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={handlePrint}
                  className="btn btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={15} /> In hóa đơn
                </button>
                <button 
                  onClick={() => setSelectedInvoice(null)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#475569' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Invoice Container */}
            <div id="printable-invoice" style={{ color: '#1e293b' }}>
              {/* Store Brand Header */}
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: '0 0 4px 0', color: '#ff5722', fontSize: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Store size={26} /> MINIMART SUPERMARKET
                </h2>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>Hệ Thống Bách Hóa & Thực Phẩm Tươi Sạch Tiện Lợi</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>123 Lũy Bán Bích, Phường Hòa Thạnh, Quận Tân Phú, TP. Hồ Chí Minh | Hotline: 1800 6868</p>
              </div>

              {/* Invoice Meta Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
                <div>
                  <div style={{ marginBottom: '4px' }}>Mã hóa đơn: <strong>INV-{String(selectedInvoice.id).padStart(5, '0')}</strong></div>
                  <div style={{ marginBottom: '4px' }}>Mã đơn hàng: <strong>#{selectedInvoice.id}</strong></div>
                  <div>Thời gian: <strong>{new Date(selectedInvoice.createdAt).toLocaleString('vi-VN')}</strong></div>
                </div>
                <div>
                  <div style={{ marginBottom: '4px' }}>Khách hàng: <strong>{selectedInvoice.shippingName}</strong></div>
                  <div style={{ marginBottom: '4px' }}>Số điện thoại: <strong>{selectedInvoice.shippingPhone}</strong></div>
                  <div>Thanh toán: <strong>{selectedInvoice.paymentMethod === 'COD' ? 'Tiền mặt (COD)' : 'Chuyển khoản'}</strong></div>
                </div>
                <div style={{ gridColumn: 'span 2', borderTop: '1px dashed #cbd5e1', paddingTop: '8px' }}>
                  Địa chỉ giao: <span>{selectedInvoice.shippingAddress}</span>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '8px 4px' }}>STT</th>
                    <th style={{ padding: '8px' }}>Mặt hàng</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>SL</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Đơn giá</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items?.map((item, idx) => {
                    const isSaleBatch = item.productName?.includes('(Xả kho cận date')
                    const isStandardBatch = item.productName?.includes('(Lô tiêu chuẩn')

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 4px', color: '#94a3b8' }}>{idx + 1}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{ fontWeight: 700 }}>{item.productName}</span>
                          {isSaleBatch && (
                            <span style={{ 
                              background: '#fef3c7', 
                              color: '#b45309', 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontSize: '0.72rem', 
                              fontWeight: 700, 
                              marginLeft: '6px', 
                              display: 'inline-block' 
                            }}>
                              ⚡ Đơn giá xả kho
                            </span>
                          )}
                          {isStandardBatch && (
                            <span style={{ 
                              background: '#eff6ff', 
                              color: '#1d4ed8', 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontSize: '0.72rem', 
                              fontWeight: 700, 
                              marginLeft: '6px', 
                              display: 'inline-block' 
                            }}>
                              📦 Giá tiêu chuẩn
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}><strong>{item.quantity}</strong></td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{item.price?.toLocaleString()}đ</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}><strong>{(item.price * item.quantity)?.toLocaleString()}đ</strong></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Financial Calculation Summary */}
              <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.92rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Tổng tiền hàng:</span>
                  <strong>{selectedInvoice.totalAmount?.toLocaleString()}đ</strong>
                </div>

                {selectedInvoice.tierDiscountAmount > 0 ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                      <span>Ưu đãi thành viên ({selectedInvoice.membershipTier || 'VIP'}):</span>
                      <strong>-{selectedInvoice.tierDiscountAmount?.toLocaleString()}đ</strong>
                    </div>
                    {(selectedInvoice.discountAmount - selectedInvoice.tierDiscountAmount) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                        <span>Giảm giá Voucher {selectedInvoice.couponCode ? `(${selectedInvoice.couponCode})` : ''}:</span>
                        <strong>-{(selectedInvoice.discountAmount - selectedInvoice.tierDiscountAmount)?.toLocaleString()}đ</strong>
                      </div>
                    )}
                  </>
                ) : selectedInvoice.discountAmount > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                    <span>Chiết khấu khuyến mãi {selectedInvoice.couponCode ? `(${selectedInvoice.couponCode})` : ''}:</span>
                    <strong>-{selectedInvoice.discountAmount?.toLocaleString()}đ</strong>
                  </div>
                ) : null}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', marginTop: '6px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                  <span style={{ fontWeight: 800 }}>TỔNG THANH TOÁN:</span>
                  <strong style={{ color: '#ff5722' }}>{selectedInvoice.finalAmount?.toLocaleString()}đ</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                  <span>Trạng thái chứng từ:</span>
                  <span>{getPaymentStatusBadge(selectedInvoice)}</span>
                </div>
              </div>

              {/* Chữ ký hóa đơn khi in */}
              <div className="print-only print-signatures" style={{ marginTop: '2rem' }}>
                <div className="print-sig-col">
                  <strong>Khách hàng</strong>
                  <span>(Ký và ghi rõ họ tên)</span>
                  <div className="print-sig-space"></div>
                </div>
                <div className="print-sig-col">
                  <strong>Người lập hóa đơn</strong>
                  <span>(Ký và ghi rõ họ tên)</span>
                  <div className="print-sig-space"></div>
                </div>
                <div className="print-sig-col">
                  <strong>Thủ quỹ / Thu ngân</strong>
                  <span>(Ký và ghi rõ họ tên)</span>
                  <div className="print-sig-space"></div>
                </div>
              </div>

              {/* Footer Note */}
              <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1', color: '#94a3b8', fontSize: '0.8rem' }}>
                <p style={{ margin: '0 0 2px 0' }}>Cảm ơn quý khách đã mua sắm tại Siêu thị MiniMart!</p>
                <p style={{ margin: 0 }}>Hóa đơn điện tử có giá trị lưu hành nội bộ và bảo hành sản phẩm.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InvoiceManager
