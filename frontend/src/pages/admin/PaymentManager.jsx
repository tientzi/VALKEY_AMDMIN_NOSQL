import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { 
  CreditCard, QrCode, Wallet, CheckCircle, Save, Settings, 
  ToggleLeft, ToggleRight, AlertCircle, RefreshCw, DollarSign, Image,
  Upload, Trash2, Check, ExternalLink
} from 'lucide-react'
import './AdminPages.css'

const PaymentManager = () => {
  const [methods, setMethods] = useState([])
  const [transactions, setTransactions] = useState([])
  const [activeTab, setActiveTab] = useState('CONFIG') // 'CONFIG' or 'LOGS'
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [uploadingMethodId, setUploadingMethodId] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  const handleQRFileUpload = async (methodId, file, oldQrUrl) => {
    if (!file) return
    setUploadingMethodId(methodId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (oldQrUrl) {
        formData.append('oldQrUrl', oldQrUrl)
      }
      const res = await api.post('/api/admin/payment-methods/upload-qr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const uploadedUrl = res.data.url
      handleFieldChange(methodId, 'qrCodeUrl', uploadedUrl)
      handleFieldChange(methodId, 'qrImageUrl', uploadedUrl)
      setSuccessMsg('✅ Tải ảnh mã QR thành công! Hãy nhấn "Lưu cấu hình" để cập nhật hệ thống.')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      alert('Lỗi tải ảnh QR: ' + (err.response?.data?.error || err.message))
    } finally {
      setUploadingMethodId(null)
    }
  }

  const fetchPaymentData = async () => {
    setLoading(true)
    try {
      const [methodsRes, logsRes] = await Promise.all([
        api.get('/api/admin/payment-methods'),
        api.get('/api/admin/payments/transactions')
      ])
      setMethods(methodsRes.data)
      setTransactions(logsRes.data)
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu thanh toán:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPaymentData()
  }, [])

  const handleToggleStatus = async (method) => {
    try {
      const updated = { ...method, isEnabled: !method.isEnabled }
      await api.put(`/api/admin/payment-methods/${method.id}`, updated)
      setMethods(prev => prev.map(m => m.id === method.id ? updated : m))
      setSuccessMsg(`Đã ${updated.isEnabled ? 'bật' : 'tắt'} phương thức ${method.name}!`)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      alert('Không thể cập nhật trạng thái phương thức thanh toán')
    }
  }

  const handleFieldChange = (id, field, value) => {
    setMethods(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  const handleSaveConfig = async (method) => {
    setSavingId(method.id)
    try {
      await api.put(`/api/admin/payment-methods/${method.id}`, method)
      setSuccessMsg(`✅ Lưu cấu hình ${method.name} thành công!`)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      alert('Lỗi khi lưu cấu hình: ' + (err.response?.data?.error || err.message))
    } finally {
      setSavingId(null)
    }
  }

  const [txFilter, setTxFilter] = useState('ALL')
  const [approvingId, setApprovingId] = useState(null)

  const handleApprovePayment = async (tx) => {
    const isCod = tx.paymentMethod === 'COD' || tx.paymentMethod === 'TIEN_MAT'
    const confirmPrompt = isCod
      ? `Xác nhận DUYỆT ĐƠN HÀNG COD #${tx.orderId}?\nĐơn hàng sẽ chuyển sang "Đã xác nhận" và sẵn sàng xuất hiện trong Quản lý giao hàng để phân công shipper.`
      : `Xác nhận DUYỆT THANH TOÁN QR cho đơn #${tx.orderId} (Số tiền: ${tx.amount?.toLocaleString()}đ)?\nThanh toán sẽ thành "Hoàn thành" và đơn hàng chuyển sang "Đã xác nhận" để giao hàng.`
      
    if (!window.confirm(confirmPrompt)) return
    setApprovingId(tx.id)
    try {
      const res = await api.post(`/api/admin/payments/transactions/${tx.id}/approve`)
      setSuccessMsg(`✅ ${res.data?.message || 'Đã duyệt giao dịch thành công!'}`)
      setTimeout(() => setSuccessMsg(''), 3500)
      fetchPaymentData()
    } catch (err) {
      alert('Lỗi khi duyệt: ' + (err.response?.data?.error || err.message))
    } finally {
      setApprovingId(null)
    }
  }

  const handleRejectPayment = async (tx) => {
    const reason = window.prompt(
      `⚠️ CẢNH BÁO: Từ chối sẽ HỦY ĐƠN HÀNG #${tx.orderId}, tự động hoàn trả số lượng tồn kho và lô hạn sử dụng.\n\nNhập lý do từ chối (vd: Chưa nhận được chuyển khoản, Khách hủy đơn, Sai thông tin):`,
      'Chưa nhận được chuyển khoản hoặc thông tin sai'
    )
    if (reason === null) return
    try {
      const res = await api.post(`/api/admin/payments/transactions/${tx.id}/reject`, { reason })
      setSuccessMsg(`⚠️ ${res.data?.message || 'Đã từ chối giao dịch và hoàn kho thành công!'}`)
      setTimeout(() => setSuccessMsg(''), 4000)
      fetchPaymentData()
    } catch (err) {
      alert('Lỗi khi từ chối giao dịch: ' + (err.response?.data?.error || err.message))
    }
  }

  if (loading) {
    return <div className="loading-state">Đang tải cấu hình thanh toán...</div>
  }

  return (
    <div className="admin-crud-page">
      <div className="crud-header">
        <div>
          <h2>Quản lý Phương thức Thanh toán</h2>
          <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
            Bật/tắt và cấu hình tài khoản nhận tiền, mã QR hiển thị tại trang thanh toán của khách hàng.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className={`btn ${activeTab === 'CONFIG' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('CONFIG')}
          >
            <Settings size={16} /> Cấu hình thanh toán
          </button>
          <button 
            className={`btn ${activeTab === 'LOGS' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('LOGS')}
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <CreditCard size={16} /> Lịch sử & Đối soát giao dịch ({transactions.length})
            {transactions.filter(t => t.paymentStatus === 'PENDING').length > 0 && (
              <span style={{ 
                background: '#dc2626', 
                color: 'white', 
                borderRadius: '50%', 
                width: '20px', 
                height: '20px', 
                fontSize: '11px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: 'bold' 
              }}>
                {transactions.filter(t => t.paymentStatus === 'PENDING').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {successMsg && (
        <div style={{ padding: '0.75rem 1.25rem', background: '#dcfce7', color: '#15803d', borderRadius: '10px', marginBottom: '1.5rem', fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      {/* TAB 1: CẤU HÌNH PHƯƠNG THỨC THANH TOÁN */}
      {activeTab === 'CONFIG' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {methods.map((method) => {
            const isBank = method.methodKey === 'BANK_TRANSFER' || method.code === 'BANK_TRANSFER'
            const isMomo = method.methodKey === 'MOMO' || method.code === 'MOMO'
            const isCod = method.methodKey === 'COD' || method.code === 'COD'

            return (
              <div key={method.id} className="admin-form glass" style={{ padding: '1.75rem', borderRadius: '16px', border: '1px solid var(--admin-border)' }}>
                {/* Header card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: isCod ? '#fef3c7' : isBank ? '#e0e7ff' : '#fce7f3',
                      color: isCod ? '#b45309' : isBank ? '#4338ca' : '#be185d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {isCod ? <DollarSign size={24} /> : isBank ? <QrCode size={24} /> : <Wallet size={24} />}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{method.name}</h3>
                      <span style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>Mã hệ thống: <code>{method.methodKey || method.code}</code></span>
                    </div>
                  </div>

                  {/* Switch Bật/Tắt */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: method.isEnabled ? '#16a34a' : '#94a3b8' }}>
                      {method.isEnabled ? 'Đang kích hoạt' : 'Đang tạm tắt'}
                    </span>
                    <button 
                      onClick={() => handleToggleStatus(method)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: method.isEnabled ? '#16a34a' : '#94a3b8' }}
                      title={method.isEnabled ? 'Tắt phương thức' : 'Bật phương thức'}
                    >
                      {method.isEnabled ? <ToggleRight size={38} /> : <ToggleLeft size={38} />}
                    </button>
                  </div>
                </div>

                {/* Form fields */}
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: isCod ? '1fr' : 'repeat(2, 1fr)', gap: '1.25rem' }}>
                  <div className="form-group" style={{ gridColumn: isCod ? '1' : 'span 2' }}>
                    <label>Mô tả hiển thị cho khách hàng</label>
                    <textarea 
                      rows={2}
                      value={method.description || ''}
                      onChange={(e) => handleFieldChange(method.id, 'description', e.target.value)}
                      placeholder="Nhập hướng dẫn thanh toán cho người mua..."
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-text-primary)' }}
                    />
                  </div>

                  {!isCod && (
                    <>
                      <div className="form-group">
                        <label>Mã BIN ngân hàng (6 chữ số, MB: 970422)</label>
                        <input inputMode="numeric" maxLength={6} value={method.bankBin || ''} onChange={e => handleFieldChange(method.id, 'bankBin', e.target.value.replace(/\D/g, ''))} />
                        <label>Tên Ngân hàng / Tổ chức phát hành</label>
                        <input 
                          type="text"
                          value={method.bankName || ''}
                          onChange={(e) => handleFieldChange(method.id, 'bankName', e.target.value)}
                          placeholder="VD: MBBank / Vietcombank / MoMo"
                          style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-text-primary)' }}
                        />
                      </div>

                      <div className="form-group">
                        <label>Số tài khoản / Số điện thoại nhận tiền</label>
                        <input 
                          type="text"
                          value={method.accountNumber || ''}
                          onChange={(e) => handleFieldChange(method.id, 'accountNumber', e.target.value)}
                          placeholder="VD: 0336174371"
                          style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-text-primary)' }}
                        />
                      </div>

                      <div className="form-group">
                        <label>Tên chủ tài khoản (Người thụ hưởng)</label>
                        <input 
                          type="text"
                          value={method.accountHolder || ''}
                          onChange={(e) => handleFieldChange(method.id, 'accountHolder', e.target.value)}
                          placeholder="VD: NGUYEN TIEN TAI"
                          style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-text-primary)' }}
                        />
                      </div>

                      <div className="form-group">
                        <label>Cú pháp nội dung chuyển khoản</label>
                        <input 
                          type="text"
                          value={method.transferSyntax || ''}
                          onChange={(e) => handleFieldChange(method.id, 'transferSyntax', e.target.value)}
                          placeholder="VD: MART {orderId} {phone}"
                          style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-text-primary)' }}
                        />
                      </div>

                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 600 }}>Ảnh mã QR Code quét thanh toán</span>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Hỗ trợ JPG, PNG, WebP</span>
                        </label>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                          <input 
                            type="text"
                            value={method.qrCodeUrl || method.qrImageUrl || ''}
                            onChange={(e) => {
                              handleFieldChange(method.id, 'qrCodeUrl', e.target.value)
                              handleFieldChange(method.id, 'qrImageUrl', e.target.value)
                            }}
                            placeholder="Đường dẫn file (VD: /uploads/vietqr.png hoặc URL)"
                            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-text-primary)' }}
                          />

                          <label className="btn btn-outline" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.2rem', whiteSpace: 'nowrap' }}>
                            <Upload size={16} />
                            {uploadingMethodId === method.id ? 'Đang tải lên...' : 'Chọn ảnh từ máy'}
                            <input 
                              type="file" 
                              accept="image/*" 
                              style={{ display: 'none' }} 
                              disabled={uploadingMethodId === method.id}
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleQRFileUpload(method.id, e.target.files[0], method.qrCodeUrl || method.qrImageUrl)
                                }
                              }}
                            />
                          </label>
                        </div>

                        {/* Interactive Live QR Preview */}
                        {(method.qrCodeUrl || method.qrImageUrl) ? (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '16px', 
                            background: '#f8fafc', 
                            padding: '12px 16px', 
                            borderRadius: '12px', 
                            border: '1px dashed #cbd5e1' 
                          }}>
                            <div style={{ 
                              width: '90px', 
                              height: '90px', 
                              borderRadius: '10px', 
                              overflow: 'hidden', 
                              background: 'white', 
                              border: '1px solid #e2e8f0', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                            }}>
                              <img 
                                src={method.qrCodeUrl || method.qrImageUrl} 
                                alt="QR Code Preview" 
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                }}
                              />
                            </div>
                            <div style={{ flexGrow: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Check size={16} /> Mã QR đã sẵn sàng cho {method.name}
                              </div>
                              <p style={{ margin: '4px 0 8px 0', fontSize: '0.8rem', color: '#64748b' }}>
                                Đường dẫn: <code>{method.qrCodeUrl || method.qrImageUrl}</code>
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  handleFieldChange(method.id, 'qrCodeUrl', '')
                                  handleFieldChange(method.id, 'qrImageUrl', '')
                                }}
                                className="btn btn-outline"
                                style={{ padding: '4px 10px', fontSize: '0.78rem', color: '#dc2626', borderColor: '#fca5a5' }}
                              >
                                <Trash2 size={13} style={{ marginRight: '4px' }} /> Xóa mã QR này
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ 
                            padding: '16px', 
                            background: '#f8fafc', 
                            borderRadius: '12px', 
                            border: '1px dashed #cbd5e1', 
                            textAlign: 'center',
                            color: '#94a3b8',
                            fontSize: '0.85rem'
                          }}>
                            Chưa có ảnh mã QR. Hãy nhấn nút <strong>"Chọn ảnh từ máy"</strong> để tải ảnh QR lên server (ảnh cũ sẽ tự động được dọn dẹp).
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                  <button 
                    onClick={() => handleSaveConfig(method)}
                    disabled={savingId === method.id}
                    className="btn btn-primary"
                    style={{ padding: '0.6rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Save size={16} /> {savingId === method.id ? 'Đang lưu...' : 'Lưu cấu hình'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* TAB 2: DUYỆT & LỊCH SỬ GIAO DỊCH THANH TOÁN */}
      {activeTab === 'LOGS' && (
        <div>
          {/* Sub-filter bar */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button 
              className={`btn ${txFilter === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTxFilter('ALL')}
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            >
              Tất cả ({transactions.length})
            </button>
            <button 
              className={`btn ${txFilter === 'PENDING' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTxFilter('PENDING')}
              style={{ padding: '6px 14px', fontSize: '0.85rem', color: txFilter === 'PENDING' ? '#fff' : '#d97706', borderColor: '#d97706' }}
            >
              ⏳ Chờ duyệt ({transactions.filter(t => t.paymentStatus === 'PENDING').length})
            </button>
            <button 
              className={`btn ${txFilter === 'APPROVED_COD' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTxFilter('APPROVED_COD')}
              style={{ padding: '6px 14px', fontSize: '0.85rem', color: txFilter === 'APPROVED_COD' ? '#fff' : '#0284c7', borderColor: '#0284c7' }}
            >
              🚚 Đã duyệt COD ({transactions.filter(t => t.paymentStatus === 'APPROVED_COD').length})
            </button>
            <button 
              className={`btn ${txFilter === 'COMPLETED' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTxFilter('COMPLETED')}
              style={{ padding: '6px 14px', fontSize: '0.85rem', color: txFilter === 'COMPLETED' ? '#fff' : '#16a34a', borderColor: '#16a34a' }}
            >
              ✓ Đã thanh toán QR ({transactions.filter(t => t.paymentStatus === 'COMPLETED').length})
            </button>
            <button 
              className={`btn ${txFilter === 'FAILED' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTxFilter('FAILED')}
              style={{ padding: '6px 14px', fontSize: '0.85rem', color: txFilter === 'FAILED' ? '#fff' : '#dc2626', borderColor: '#dc2626' }}
            >
              ✕ Thất bại / Hủy ({transactions.filter(t => t.paymentStatus === 'FAILED').length})
            </button>
          </div>

          <div style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.88rem',
            color: '#1e40af'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, color: '#2563eb' }} />
            <span>
              💡 <strong>Lưu ý:</strong> Thao tác duyệt thanh toán đã được gộp trực tiếp vào <strong>Quản lý Đơn hàng</strong> (1-chạm khi duyệt đơn). Màn hình này dùng để đối soát doanh thu và kiểm tra lịch sử dòng tiền.
            </span>
          </div>

          <div className="admin-table-container glass">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã GD</th>
                  <th>Mã Đơn</th>
                  <th>Khách Hàng</th>
                  <th>Phương Thức</th>
                  <th>Số Tiền</th>
                  <th>Trạng Thái</th>
                  <th>Thời Gian</th>
                  <th>Thao Tác Duyệt</th>
                </tr>
              </thead>
              <tbody>
                {transactions
                  .filter(tx => txFilter === 'ALL' || tx.paymentStatus === txFilter)
                  .map((tx) => {
                    const isCod = tx.paymentMethod === 'COD' || tx.paymentMethod === 'TIEN_MAT'
                    return (
                      <tr key={tx.id}>
                        <td><code>PAY-{String(tx.id).padStart(4, '0')}</code></td>
                        <td><strong>#{tx.orderId}</strong></td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{tx.customerName}</div>
                          {tx.customerPhone && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{tx.customerPhone}</div>}
                        </td>
                        <td>
                          <span style={{ 
                            padding: '3px 8px', 
                            borderRadius: '6px', 
                            fontSize: '0.82rem',
                            background: isCod ? '#fef3c7' : '#e0e7ff',
                            color: isCod ? '#b45309' : '#3730a3',
                            fontWeight: 600
                          }}>
                            {isCod ? 'Tiền mặt (COD)' : tx.paymentMethod === 'MOMO' ? 'Ví MoMo' : 'Chuyển khoản QR'}
                          </span>
                        </td>
                        <td><strong style={{ color: '#0284c7' }}>{tx.amount?.toLocaleString()}đ</strong></td>
                        <td>
                          {tx.paymentStatus === 'COMPLETED' && (
                            <span className="status-pill active">
                              ✓ Đã thanh toán QR
                            </span>
                          )}
                          {tx.paymentStatus === 'APPROVED_COD' && (
                            <span className="status-pill" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
                              🚚 Đã duyệt COD
                            </span>
                          )}
                          {tx.paymentStatus === 'PENDING' && (
                            <span className="status-pill warning">
                              ⏳ Chờ duyệt
                            </span>
                          )}
                          {tx.paymentStatus === 'FAILED' && (
                            <span className="status-pill danger">
                              ✕ Từ chối / Đã hủy
                            </span>
                          )}
                        </td>
                        <td>{tx.paidAt ? new Date(tx.paidAt).toLocaleString('vi-VN') : tx.createdAt ? new Date(tx.createdAt).toLocaleString('vi-VN') : '—'}</td>
                        <td>
                          {tx.paymentStatus === 'PENDING' ? (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <Link
                                to="/admin/orders"
                                className="btn btn-outline"
                                style={{ 
                                  padding: '5px 10px', 
                                  fontSize: '0.8rem', 
                                  color: '#0284c7', 
                                  borderColor: '#0284c7',
                                  whiteSpace: 'nowrap',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title="Đi tới Quản lý Đơn hàng để duyệt đơn và thanh toán 1-chạm"
                              >
                                Duyệt tại Đơn #{tx.orderId}
                              </Link>
                              <button
                                className="btn btn-primary"
                                onClick={() => handleApprovePayment(tx)}
                                disabled={approvingId === tx.id}
                                style={{ 
                                  padding: '5px 9px', 
                                  fontSize: '0.8rem', 
                                  background: isCod ? '#0284c7' : '#16a34a', 
                                  borderColor: isCod ? '#0284c7' : '#16a34a',
                                  whiteSpace: 'nowrap'
                                }}
                                title="Duyệt nhanh và tự động cập nhật sang Đơn hàng"
                              >
                                {isCod ? '✓ Duyệt COD' : '✓ Duyệt QR'}
                              </button>
                            </div>
                          ) : tx.paymentStatus === 'APPROVED_COD' ? (
                            <span style={{ fontSize: '0.85rem', color: '#0284c7', fontWeight: 600 }}>Chờ thu tiền khi giao 🚚</span>
                          ) : tx.paymentStatus === 'COMPLETED' ? (
                            <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>Đã nhận tiền ✓</span>
                          ) : (
                            <span style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 600 }}>Đã từ chối (Đã hoàn kho) ✕</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                {transactions.filter(tx => txFilter === 'ALL' || tx.paymentStatus === txFilter).length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                      Không có giao dịch nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentManager
