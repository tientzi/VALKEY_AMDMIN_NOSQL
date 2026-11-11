import React, { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { CartContext } from '../contexts/CartContext'
import { AuthContext } from '../contexts/AuthContext'
import api from '../services/api'
import { MapPin, Plus, CheckCircle, Wallet, Tag, QrCode, X, Copy, Check, Smartphone, Banknote, CreditCard, Info, Clock, AlertTriangle } from 'lucide-react'
import './Checkout.css'

export const DISTRICT_WARDS = {
  'Quận Tân Phú': [
    'Phường Tây Thạnh',
    'Phường Sơn Kỳ',
    'Phường Tân Sơn Nhì',
    'Phường Tân Quý',
    'Phường Tân Thành',
    'Phường Phú Thọ Hòa',
    'Phường Phú Thạnh',
    'Phường Phú Trung',
    'Phường Hòa Thạnh',
    'Phường Hiệp Tân',
    'Phường Tân Thới Hòa'
  ],
  'Quận Tân Bình': [
    'Phường 1',
    'Phường 2',
    'Phường 3',
    'Phường 4',
    'Phường 5',
    'Phường 6',
    'Phường 7',
    'Phường 8',
    'Phường 9',
    'Phường 10',
    'Phường 11',
    'Phường 12',
    'Phường 13',
    'Phường 14',
    'Phường 15'
  ],
  'Quận 12': [
    'Phường Thạnh Xuân',
    'Phường Thạnh Lộc',
    'Phường Hiệp Thành',
    'Phường Thới An',
    'Phường Tân Chánh Hiệp',
    'Phường An Phú Đông',
    'Phường Tân Thới Hiệp',
    'Phường Trung Mỹ Tây',
    'Phường Tân Hưng Thuận',
    'Phường Đông Hưng Thuận',
    'Phường Tân Thới Nhất'
  ]
}

export const isStandardDistrict = (addr) => {
  if (!addr) return true
  const str = `${addr.district || ''} ${addr.detailAddress || ''} ${addr.ward || ''} ${addr.province || ''}`.toLowerCase()
  return str.includes('tân phú') || str.includes('tan phu') ||
         str.includes('tân bình') || str.includes('tan binh') ||
         str.includes('quận 12') || str.includes('quan 12') || str.includes('q12') || str.includes('q.12')
}

const DEFAULT_METHODS = [
  {
    id: 1,
    methodCode: 'COD',
    methodName: 'Thanh toán khi nhận hàng (COD)',
    description: 'Thanh toán tiền mặt cho shipper khi nhận được hàng.',
    isEnabled: true,
    icon: 'Banknote'
  },
  {
    id: 2,
    methodCode: 'BANK_TRANSFER',
    methodName: 'Chuyển khoản Ngân hàng (VietQR)',
    description: 'Quét mã VietQR chuyển khoản nhanh 24/7. Miễn phí giao dịch.',
    bankName: 'MB Bank (Ngân hàng Quân Đội)',
    bankBin: '970422',
    accountNumber: '0336174371',
    accountHolder: 'NGUYEN TIEN TAI',
    transferSyntax: 'MINIMART {MA_DON}',
    qrCodeUrl: '/uploads/vietqr.png',
    isEnabled: true,
    icon: 'QrCode'
  },
  {
    id: 3,
    methodCode: 'MOMO',
    methodName: 'Ví điện tử MoMo',
    description: 'Quét mã QR MoMo để thanh toán. Nhanh chóng và an toàn.',
    bankName: 'Ví điện tử MoMo',
    accountNumber: '0336174371',
    accountHolder: 'NGUYEN TIEN TAI',
    transferSyntax: 'MINIMART {MA_DON}',
    qrCodeUrl: '/uploads/momo_qr.png',
    isEnabled: true,
    icon: 'Smartphone'
  }
]

const Checkout = () => {
  const { cart, cartSubtotal, clearCart } = useContext(CartContext)
  const { user } = useContext(AuthContext)
  const navigate = useNavigate()

  // Addresses
  const [addresses, setAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  
  // New address form
  const [showAddForm, setShowAddForm] = useState(false)
  const [receiverName, setReceiverName] = useState('')
  const [receiverPhone, setReceiverPhone] = useState('')
  const [province] = useState('TP Hồ Chí Minh')
  const [district, setDistrict] = useState('Quận Tân Phú')
  const [ward, setWard] = useState('Phường Tây Thạnh')
  const [customWard, setCustomWard] = useState('')
  const [houseNumber, setHouseNumber] = useState('')
  const [streetName, setStreetName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  
  // Coupon
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [couponError, setCouponError] = useState('')
  const [couponSuccess, setCouponSuccess] = useState('')

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_METHODS)
  const [paymentMethod, setPaymentMethod] = useState('COD')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // QR Modal
  const [showQRModal, setShowQRModal] = useState(false)
  const [activeQRConfig, setActiveQRConfig] = useState(null)
  const [qrOrderInfo, setQrOrderInfo] = useState('')
  const [copiedSTK, setCopiedSTK] = useState(false)
  const [qrConfirming, setQrConfirming] = useState(false)
  const [currentTier, setCurrentTier] = useState(null)
  const [createdOrder, setCreatedOrder] = useState(null)
  const [timeLeft, setTimeLeft] = useState(30)
  const [paymentTimeout, setPaymentTimeout] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [timeoutReason, setTimeoutReason] = useState('')

  useEffect(() => {
    if (!showQRModal || !createdOrder) return
    setTimeLeft(30)
    setPaymentTimeout(false)
    setPaymentSuccess(false)
    setTimeoutReason('')

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    const pollInterval = setInterval(async () => {
      try {
        if (createdOrder.jobId) {
          const jobRes = await api.get(`/api/orders/jobs/${createdOrder.jobId}/status`).catch(() => null)
          if (jobRes?.data) {
            const job = jobRes.data
            if (job.status === 'SUCCEEDED') {
              setPaymentSuccess(true)
              clearInterval(timer)
              clearInterval(pollInterval)
              setTimeout(() => {
                navigate('/orders?success=true')
              }, 2000)
              return
            }
            if (job.status === 'FAILED' || job.status === 'CANCELLED') {
              setPaymentTimeout(true)
              setTimeoutReason(job.message || 'Quá thời hạn thanh toán 30 giây (Admin chưa duyệt đơn)')
              clearInterval(timer)
              clearInterval(pollInterval)
              return
            }
          }
        }
        const myOrdersRes = await api.get('/api/orders/my-orders').catch(() => null)
        if (myOrdersRes?.data) {
          const currentO = (myOrdersRes.data || []).find(o => o.id === createdOrder.id)
          if (currentO) {
            if (['DA_XAC_NHAN', 'DA_NHAN_DON', 'DANG_GIAO', 'HOAN_THANH'].includes(currentO.status) || currentO.paymentStatus === 'COMPLETED') {
              setPaymentSuccess(true)
              clearInterval(timer)
              clearInterval(pollInterval)
              setTimeout(() => {
                navigate('/orders?success=true')
              }, 2000)
              return
            }
            if (['HUY', 'TU_CHOI'].includes(currentO.status)) {
              setPaymentTimeout(true)
              setTimeoutReason(currentO.note || 'Quá thời hạn thanh toán 30 giây (Admin chưa duyệt đơn)')
              clearInterval(timer)
              clearInterval(pollInterval)
              return
            }
          }
        }
      } catch (err) {
        console.warn('Polling status error:', err)
      }
    }, 1000)

    return () => {
      clearInterval(timer)
      clearInterval(pollInterval)
    }
  }, [showQRModal, createdOrder])

  const fetchAddresses = async () => {
    try {
      const response = await api.get('/api/addresses')
      setAddresses(response.data)
      const defaultAddr = response.data.find(addr => addr.isDefault)
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id)
      } else if (response.data.length > 0) {
        setSelectedAddressId(response.data[0].id)
      }
    } catch (err) {
      console.error('Không thể lấy địa chỉ nhận hàng', err)
    }
  }

  const fetchPaymentMethods = async () => {
    try {
      const response = await api.get('/api/public/payment-methods')
      if (response.data && response.data.length > 0) {
        const normalized = response.data.map(m => ({
          ...m,
          methodCode: m.methodCode || m.methodKey || m.code || 'COD',
          methodName: m.methodName || m.name || (m.methodKey === 'COD' ? 'Thanh toán khi nhận hàng (COD)' : (m.methodKey || 'Thanh toán'))
        }))
        const activeOnes = normalized.filter(m => m.isEnabled)
        if (activeOnes.length > 0) {
          setPaymentMethods(activeOnes)
          setPaymentMethod(prev => {
            const exists = activeOnes.some(a => a.methodCode === prev)
            return exists ? prev : activeOnes[0].methodCode
          })
        } else {
          setPaymentMethods(DEFAULT_METHODS)
          setPaymentMethod('COD')
        }
      } else {
        setPaymentMethods(DEFAULT_METHODS)
        setPaymentMethod('COD')
      }
    } catch (err) {
      console.warn('Dùng cấu hình thanh toán mặc định', err)
      setPaymentMethods(DEFAULT_METHODS)
      setPaymentMethod('COD')
    }
  }

  useEffect(() => {
    if (cart.items.length === 0) {
      navigate('/cart')
      return
    }
    api.get('/api/users/loyalty-info').then(r => setCurrentTier(r.data.membershipTier)).catch(() => {})
    fetchAddresses()
    fetchPaymentMethods()
  }, [])

  const handleAddAddress = async (e) => {
    e.preventDefault()
    setError('')
    if (!receiverName.trim()) {
      setError('Vui lòng nhập họ tên người nhận')
      return
    }
    if (!/^0\d{9}$/.test(receiverPhone.trim())) {
      setError('Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0')
      return
    }
    if (!houseNumber.trim()) {
      setError('Vui lòng nhập số nhà cụ thể')
      return
    }
    if (!streetName.trim()) {
      setError('Vui lòng nhập tên đường')
      return
    }

    const finalWard = ward === 'KHAC' ? customWard.trim() : ward
    if (!finalWard) {
      setError('Vui lòng chọn hoặc nhập tên Phường / Xã')
      return
    }

    const cleanHouse = houseNumber.trim().toLowerCase().startsWith('số')
      ? houseNumber.trim()
      : `Số ${houseNumber.trim()}`
    const combinedDetail = `${cleanHouse}, ${streetName.trim()}`

    try {
      const response = await api.post('/api/addresses', {
        receiverName: receiverName.trim(),
        receiverPhone: receiverPhone.trim(),
        province: 'TP Hồ Chí Minh',
        district,
        ward: finalWard,
        detailAddress: combinedDetail,
        isDefault
      })
      setAddresses(prev => [...prev, response.data])
      setSelectedAddressId(response.data.id)
      setShowAddForm(false)
      setReceiverName('')
      setReceiverPhone('')
      setHouseNumber('')
      setStreetName('')
      setCustomWard('')
      setIsDefault(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể thêm địa chỉ mới.')
    }
  }

  useEffect(() => {
    if (!cart.items.length) return
    let active = true
    api.get('/api/cart/quote').then(({data}) => {
      if (!active) return
      setCurrentTier(data.membershipTier)
      setCouponCode(data.couponCode)
      setAppliedCoupon(data.couponCode)
      setDiscountAmount(data.couponDiscount)
      setCouponSuccess(data.couponCode ? `Tự động áp dụng ${data.couponCode}: giảm ${data.couponDiscount.toLocaleString()}đ` : '')
    }).catch(() => {})
    return () => { active = false }
  }, [cartSubtotal, cart.items.length])

  const handleApplyCoupon = async (e) => {
    e.preventDefault()
    setCouponError(''); setCouponSuccess(''); setDiscountAmount(0); setAppliedCoupon('')
    if (!couponCode.trim()) return
    try {
      const itemsPayload = (cart?.items || []).map(item => ({
        productId: item.productId,
        categoryId: item.categoryId,
        price: item.productSalePrice != null ? item.productSalePrice : item.productPrice,
        quantity: item.quantity
      }))
      const response = await api.post('/api/public/coupons/apply', {
        code: couponCode.trim(),
        amount: cartSubtotal,
        items: itemsPayload
      })
      setDiscountAmount(response.data.discountAmount)
      setAppliedCoupon(response.data.code)
      setCouponSuccess(`Áp dụng thành công! Giảm ${response.data.discountAmount.toLocaleString()}đ`)
    } catch (err) {
      setCouponError(err.response?.data?.error || 'Mã giảm giá không hợp lệ')
    }
  }

  const submitOrder = async (navigateAfter = true) => {
    const addr = addresses.find(a => a.id === selectedAddressId)
    if (!addr) {
      setError('Vui lòng chọn hoặc thêm địa chỉ nhận hàng')
      return
    }
    const fullAddrString = `${addr.detailAddress}, ${addr.ward}, ${addr.district}, ${addr.province}`
    const effectivePayment = paymentMethod || 'COD'
    setLoading(true)
    try {
      const response = await api.post('/api/orders', {
        shippingName: addr.receiverName,
        shippingPhone: addr.receiverPhone,
        shippingAddress: fullAddrString,
        paymentMethod: effectivePayment,
        couponCode: appliedCoupon || null,
        note,
        allowExceedStock: (cart?.items || []).some(i => i.quantity > i.maxStock)
      })
      clearCart()
      if (navigateAfter) navigate('/orders?success=true')
      return response.data
    } catch (err) {
      setError(err.response?.data?.error || 'Đã xảy ra lỗi khi tạo đơn hàng.')
      setShowQRModal(false)
      return null
    } finally {
      setLoading(false)
      setQrConfirming(false)
    }
  }

  // Calculate Tier Discount
  let tierDiscount = 0
  let tierPercentage = 0
  let tierName = ''
  if ((currentTier || user?.membershipTier) === 'SILVER') {
    tierPercentage = 2
    tierName = 'Bạc'
  } else if ((currentTier || user?.membershipTier) === 'GOLD') {
    tierPercentage = 5
    tierName = 'Vàng'
  } else if ((currentTier || user?.membershipTier) === 'DIAMOND') {
    tierPercentage = 8
    tierName = 'Kim Cương'
  }
  tierDiscount = Math.round((cartSubtotal * tierPercentage) / 100)
  const finalTotal = Math.max(0, cartSubtotal - discountAmount - tierDiscount)

  const handlePlaceOrder = async () => {
    setError('')
    if (!selectedAddressId) {
      setError('Vui lòng chọn địa chỉ giao hàng')
      return
    }

    const currentMethod = paymentMethods.find(m => m.methodCode === paymentMethod) || { methodCode: 'COD' }
    if (paymentMethod && paymentMethod !== 'COD' && currentMethod) {
      const order = await submitOrder(false)
      if (order) {
        setCreatedOrder(order)
        setQrOrderInfo(order.transferContent || `MINIMART DH${order.id}`)
        setActiveQRConfig(currentMethod)
        setShowQRModal(true)
      }
    } else {
      await submitOrder()
    }
  }

  const handleQRConfirm = async () => {
    setQrConfirming(true)
    navigate('/orders?success=true&payment=pending')
  }

  const handleCopySTK = () => {
    if (activeQRConfig?.accountNumber) {
      navigator.clipboard.writeText(activeQRConfig.accountNumber)
      setCopiedSTK(true)
      setTimeout(() => setCopiedSTK(false), 2000)
    }
  }

  const getMethodIcon = (code) => {
    switch (code) {
      case 'COD':
        return <Banknote size={20} className="payment-icon" />
      case 'MOMO':
        return <Smartphone size={20} className="payment-icon" />
      case 'BANK_TRANSFER':
      default:
        return <QrCode size={20} className="payment-icon" />
    }
  }

  return (
    <div className="checkout-page">
      <h1 className="page-title">Thanh toán đơn hàng</h1>

      {error && <div className="checkout-general-error">{error}</div>}

      <div className="checkout-grid">
        {/* Left Column */}
        <div className="checkout-steps">
          {/* Bước 1: Địa chỉ giao hàng */}
          <div className="checkout-step-card glass">
            <div className="step-card-header">
              <h3><MapPin size={22} className="step-icon" /> 1. Địa chỉ giao hàng</h3>
              {!showAddForm && (
                <button onClick={() => setShowAddForm(true)} className="btn btn-outline add-addr-btn">
                  <Plus size={16} /> Thêm địa chỉ mới
                </button>
              )}
            </div>

            {showAddForm ? (
              <form onSubmit={handleAddAddress} className="add-address-form">
                <h4>Nhập thông tin địa chỉ mới</h4>
                <div className="form-grid-addr">
                  <div className="form-group">
                    <label>Họ tên người nhận <span style={{ color: '#ef4444' }}>*</span></label>
                    <input 
                      type="text" 
                      required 
                      placeholder="VD: Nguyễn Văn A"
                      value={receiverName} 
                      onChange={(e) => setReceiverName(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Số điện thoại (10 số) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input 
                      type="tel" 
                      required 
                      placeholder="VD: 0912345678"
                      value={receiverPhone} 
                      inputMode="numeric"
                      maxLength={10}
                      onChange={(e) => setReceiverPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Tỉnh / Thành phố</label>
                    <select value={province} disabled style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}>
                      <option value="TP Hồ Chí Minh">TP Hồ Chí Minh</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Quận trọng điểm phục vụ <span style={{ color: '#ef4444' }}>*</span></label>
                    <select 
                      value={district} 
                      onChange={(e) => {
                        const newD = e.target.value
                        setDistrict(newD)
                        const firstWard = DISTRICT_WARDS[newD] ? DISTRICT_WARDS[newD][0] : ''
                        setWard(firstWard)
                        setCustomWard('')
                      }}
                    >
                      <option value="Quận Tân Phú">Quận Tân Phú (Kho chính)</option>
                      <option value="Quận Tân Bình">Quận Tân Bình</option>
                      <option value="Quận 12">Quận 12</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Phường / Xã <span style={{ color: '#ef4444' }}>*</span></label>
                    <select 
                      value={ward} 
                      onChange={(e) => setWard(e.target.value)}
                    >
                      {(DISTRICT_WARDS[district] || []).map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                      <option value="KHAC">Khác (Tự nhập tay)...</option>
                    </select>
                    {ward === 'KHAC' && (
                      <input 
                        type="text" 
                        required 
                        placeholder="Nhập tên Phường / Xã cụ thể..."
                        value={customWard}
                        onChange={(e) => setCustomWard(e.target.value)}
                        style={{ marginTop: '6px' }}
                      />
                    )}
                  </div>
                  <div className="form-group">
                    <label>Tên đường <span style={{ color: '#ef4444' }}>*</span></label>
                    <input 
                      type="text" 
                      required 
                      placeholder="VD: Lũy Bán Bích, Thoại Ngọc Hầu, Tô Ký..."
                      value={streetName} 
                      onChange={(e) => setStreetName(e.target.value)} 
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Số nhà cụ thể (hoặc số phòng, tầng) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input 
                      type="text" 
                      required 
                      placeholder="VD: 120/4B, Số 45A, Căn hộ B3-02..."
                      value={houseNumber} 
                      onChange={(e) => setHouseNumber(e.target.value)} 
                    />
                  </div>
                </div>
                <div className="form-checkbox-addr">
                  <label>
                    <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                    <span> Đặt làm địa chỉ mặc định</span>
                  </label>
                </div>
                <div className="form-addr-actions">
                  <button type="submit" className="btn btn-primary">Lưu địa chỉ</button>
                  <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-outline">Hủy bỏ</button>
                </div>
              </form>
            ) : (
              <div className="addresses-list">
                {addresses.length > 0 ? (
                  addresses.map(addr => {
                    const isSelected = selectedAddressId === addr.id
                    return (
                      <div
                        key={addr.id}
                        className={`address-item-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedAddressId(addr.id)}
                      >
                        <div className="addr-check">
                          <CheckCircle size={20} className="check-icon" />
                        </div>
                        <div className="addr-info">
                          <div className="addr-meta">
                            <strong>{addr.receiverName}</strong>
                            <span className="addr-phone">{addr.receiverPhone}</span>
                            {addr.isDefault && <span className="default-tag">Mặc định</span>}
                          </div>
                          <p>{`${addr.detailAddress}, ${addr.ward}, ${addr.district}, ${addr.province}`}</p>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="no-address-warn">Bạn chưa cấu hình địa chỉ nào. Hãy bấm "Thêm địa chỉ mới" để tiến hành đặt hàng!</p>
                )}
              </div>
            )}
          </div>

          {/* Bước 2: Phương thức thanh toán */}
          <div className="checkout-step-card glass">
            <h3><Wallet size={22} className="step-icon" /> 2. Phương thức thanh toán</h3>
            <div className="payment-options">
              {paymentMethods.map(method => (
                <label key={method.methodCode} className={`payment-option-card ${paymentMethod === method.methodCode ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === method.methodCode}
                    onChange={() => setPaymentMethod(method.methodCode)}
                  />
                  <div className="payment-desc">
                    <strong>
                      {getMethodIcon(method.methodCode)}
                      <span style={{ marginLeft: '8px' }}>{method.methodName}</span>
                    </strong>
                    <p>{method.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Preview QR khi chọn chuyển khoản / QR */}
            {paymentMethod !== 'COD' && (
              <div className="qr-preview-hint">
                <QrCode size={16} />
                <span>Mã QR thanh toán chính thức sẽ hiển thị ngay khi bạn bấm xác nhận đặt hàng</span>
              </div>
            )}
          </div>

          {/* Ghi chú đơn hàng */}
          <div className="checkout-step-card glass">
            <h3>Ghi chú cho shipper</h3>
            <textarea
              rows="3"
              placeholder="Nhập ghi chú giao hàng..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="note-textarea"
            ></textarea>
          </div>
        </div>

        {/* Right Column: Order Summary & Coupon */}
        <div className="checkout-summary-col">
          {/* Coupon Card */}
          <div className="checkout-summary-card glass margin-bottom-summary">
            <h3><Tag size={20} /> Mã giảm giá (Coupon)</h3>
            <form onSubmit={handleApplyCoupon} className="coupon-form">
              <input
                type="text"
                placeholder="Nhập mã coupon..."
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                disabled={!!appliedCoupon}
              />
              {appliedCoupon ? (
                <button type="button" onClick={() => { setAppliedCoupon(''); setDiscountAmount(0); setCouponSuccess(''); setCouponCode('') }} className="btn btn-outline remove-coupon-btn">
                  Xóa
                </button>
              ) : (
                <button type="submit" className="btn btn-primary">Áp dụng</button>
              )}
            </form>
            {couponSuccess && <span className="coupon-alert success-text">{couponSuccess}</span>}
            {couponError && <span className="coupon-alert error-text">{couponError}</span>}
          </div>

          {/* Summary Card */}
          <div className="checkout-summary-card glass">
            <h3>Chi tiết đơn hàng</h3>
            <div className="order-items-preview">
              {cart.items.map(item => {
                const isMultiBatchSplit = item.hasMultiBatch && item.saleBatchQuantity > 0 && item.quantity > item.saleBatchQuantity
                const saleQty = item.saleBatchQuantity || 0
                const normalQty = item.quantity - saleQty
                const salePrice = item.saleBatchPrice || 0
                const normalPrice = item.productPrice || 0

                if (isMultiBatchSplit) {
                  return (
                    <React.Fragment key={item.id}>
                      <div className="preview-item-row" style={{ background: '#fffbeb', padding: '6px 8px', borderRadius: '6px', marginBottom: '4px' }}>
                        <span className="preview-name" style={{ color: '#92400e' }}>
                          ⚡ {item.productName} <small style={{ color: '#b45309', fontWeight: 700 }}>(Xả kho cận date)</small> <strong>x{saleQty}</strong>
                        </span>
                        <span className="preview-price" style={{ color: '#ea580c', fontWeight: 700 }}>
                          {(salePrice * saleQty).toLocaleString()}đ
                        </span>
                      </div>
                      <div className="preview-item-row" style={{ padding: '6px 8px', borderRadius: '6px', marginBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                        <span className="preview-name">
                          📦 {item.productName} <small style={{ color: '#64748b', fontWeight: 600 }}>(Lô tiêu chuẩn)</small> <strong>x{normalQty}</strong>
                        </span>
                        <span className="preview-price">
                          {(normalPrice * normalQty).toLocaleString()}đ
                        </span>
                      </div>
                    </React.Fragment>
                  )
                }

                const price = (item.hasMultiBatch && item.saleBatchPrice != null && item.quantity <= item.saleBatchQuantity)
                  ? item.saleBatchPrice
                  : (item.productSalePrice != null ? item.productSalePrice : item.productPrice)

                return (
                  <div key={item.id} className="preview-item-row">
                    <span className="preview-name">
                      {item.productName} 
                      {item.hasMultiBatch && item.saleBatchPrice != null && item.quantity <= item.saleBatchQuantity && (
                        <small style={{ color: '#ea580c', fontWeight: 700 }}> (Xả kho)</small>
                      )}
                      <strong> x{item.quantity}</strong>
                    </span>
                    <span className="preview-price">{(price * item.quantity).toLocaleString()}đ</span>
                  </div>
                )
              })}
            </div>

            <div className="summary-details-box">
              <div className="summary-row">
                <span>Tổng tiền hàng</span>
                <span>{cartSubtotal.toLocaleString()}đ</span>
              </div>
              {discountAmount > 0 && (
                <div className="summary-row">
                  <span>Mã giảm giá Voucher {appliedCoupon ? `(${appliedCoupon})` : ''}</span>
                  <span className="discount-value-summary">-{discountAmount.toLocaleString()}đ</span>
                </div>
              )}
              {tierDiscount > 0 && (
                <div className="summary-row">
                  <span>Ưu đãi thành viên {tierName} (-{tierPercentage}%)</span>
                  <span className="discount-value-summary" style={{ color: '#16a34a', fontWeight: 700 }}>
                    -{tierDiscount.toLocaleString()}đ
                  </span>
                </div>
              )}
              <div className="summary-row">
                <span>Phí vận chuyển</span>
                <span className="shipping-free">Miễn phí giao hàng</span>
              </div>
              <div className="summary-total-row">
                <span>Tổng thanh toán</span>
                <strong>{finalTotal.toLocaleString()}đ</strong>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={loading || addresses.length === 0}
              className="btn btn-primary place-order-btn"
            >
              {loading ? 'Đang xử lý đặt hàng...' : 'Xác nhận đặt hàng'}
            </button>
          </div>
        </div>
      </div>

      {/* ====== QR PAYMENT MODAL ====== */}
      {showQRModal && activeQRConfig && (
        <div className="qr-modal-overlay" onClick={(e) => e.target === e.currentTarget && navigate('/orders?payment=pending')}>
          <div className="qr-modal">
            {/* Header */}
            <div className="qr-modal-header">
              <div className="qr-modal-title">
                <QrCode size={22} />
                <span>Thanh toán {activeQRConfig.methodName}</span>
              </div>
              <button className="qr-close-btn" onClick={() => navigate('/orders?payment=pending')}>
                <X size={20} />
              </button>
            </div>

            {/* QR Body */}
            <div className="qr-modal-body">
              {paymentSuccess ? (
                <div style={{ background: '#ecfdf5', border: '2px solid #10b981', borderRadius: '12px', padding: '32px 20px', textAlign: 'center', color: '#065f46', margin: '16px 0' }}>
                  <CheckCircle size={56} color="#10b981" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: '1.35rem', marginBottom: '8px', color: '#047857' }}>Thanh toán thành công!</h3>
                  <p style={{ color: '#065f46', fontSize: '0.95rem' }}>Quản trị viên đã xác nhận thanh toán đơn hàng. Đang chuyển đến đơn hàng của bạn...</p>
                </div>
              ) : paymentTimeout || timeLeft === 0 ? (
                <div style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: '12px', padding: '32px 20px', textAlign: 'center', color: '#991b1b', margin: '16px 0' }}>
                  <AlertTriangle size={56} color="#ef4444" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: '1.35rem', marginBottom: '8px', color: '#b91c1c' }}>Đã hết thời hạn thanh toán 30 giây!</h3>
                  <p style={{ color: '#7f1d1d', marginBottom: '20px', lineHeight: 1.5 }}>
                    {timeoutReason || 'Đơn hàng đã tự động bị Worker hủy và hoàn lại tồn kho do quá 30 giây chưa được Admin duyệt.'}
                  </p>
                  <button className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#dc2626' }} onClick={() => navigate('/orders')}>
                    Xem lịch sử đơn hàng
                  </button>
                </div>
              ) : (
                <>
                  {/* Countdown Timer Box */}
                  <div className="qr-countdown-box" style={{ marginBottom: '16px', background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={18} color={timeLeft <= 10 ? '#ef4444' : '#0284c7'} /> Thời gian giữ hàng & thanh toán:
                      </span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: timeLeft <= 10 ? '#ef4444' : '#0284c7', fontFamily: 'monospace' }}>
                        00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                      </span>
                    </div>
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(timeLeft / 30) * 100}%`,
                        background: timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#f59e0b' : '#10b981',
                        transition: 'width 1s linear, background-color 0.5s ease'
                      }} />
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '6px' }}>
                      ⚡ Tồn kho đang được Worker tạm giữ. Sau 30s nếu Admin chưa duyệt, Worker tự động hủy đơn và hoàn kho.
                    </div>
                  </div>

                  {/* Amount badge */}
                  <div className="qr-amount-badge">
                    <span className="qr-amount-label">Số tiền cần chuyển</span>
                    <span className="qr-amount-value">{(createdOrder?.finalAmount ?? finalTotal).toLocaleString()}<small>đ</small></span>
                  </div>

                  {/* QR Image */}
                  <div className="qr-image-wrapper">
                    <img
                      src={activeQRConfig.methodCode === 'BANK_TRANSFER'
                        ? `https://img.vietqr.io/image/${activeQRConfig.bankBin || '970422'}-${activeQRConfig.accountNumber}-compact2.png?amount=${createdOrder?.finalAmount ?? finalTotal}&addInfo=${encodeURIComponent(qrOrderInfo)}&accountName=${encodeURIComponent(activeQRConfig.accountHolder || '')}`
                        : (activeQRConfig.qrCodeUrl || '/uploads/momo_qr.png')}
                      alt={`Mã QR ${activeQRConfig.methodName}`}
                      className="qr-image"
                      onError={(e) => { e.currentTarget.style.display = 'none'; setError('Không tải được VietQR. Vui lòng chuyển khoản thủ công theo đúng thông tin đơn hiển thị bên dưới.'); }}
                    />
                  </div>

                  {/* Bank Info */}
                  <div className="qr-bank-info">
                    <div className="qr-bank-row">
                      <span className="qr-bank-label">Ngân hàng / Ví</span>
                      <span className="qr-bank-value">{activeQRConfig.bankName || 'Ngân hàng'}</span>
                    </div>
                    <div className="qr-bank-row">
                      <span className="qr-bank-label">Số tài khoản / SĐT</span>
                      <div className="qr-stk-row">
                        <span className="qr-bank-value qr-stk">{activeQRConfig.accountNumber}</span>
                        <button className="qr-copy-btn" onClick={handleCopySTK}>
                          {copiedSTK ? <Check size={14} /> : <Copy size={14} />}
                          {copiedSTK ? 'Đã chép' : 'Sao chép'}
                        </button>
                      </div>
                    </div>
                    <div className="qr-bank-row">
                      <span className="qr-bank-label">Chủ tài khoản</span>
                      <span className="qr-bank-value">{activeQRConfig.accountHolder}</span>
                    </div>
                    <div className="qr-bank-row">
                      <span className="qr-bank-label">Nội dung chuyển khoản</span>
                      <span className="qr-bank-value qr-note">{qrOrderInfo}</span>
                    </div>
                  </div>

                  <p className="qr-instruction">
                    📱 Mở App Ngân hàng hoặc Ví điện tử → Quét mã QR hoặc Chuyển tiền với nội dung trên, sau đó chờ Admin duyệt hoặc bấm nút bên dưới.
                  </p>
                </>
              )}
            </div>

            {/* Footer actions */}
            <div className="qr-modal-footer">
              <button className="btn btn-outline" onClick={() => setShowQRModal(false)}>
                {paymentTimeout ? 'Đóng' : 'Quay lại'}
              </button>
              {!paymentTimeout && !paymentSuccess && (
                <button
                  className="btn btn-primary qr-confirm-btn"
                  onClick={handleQRConfirm}
                  disabled={qrConfirming}
                >
                  {qrConfirming ? 'Đang xử lý...' : '✅ Tôi đã chuyển khoản thành công'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Checkout
