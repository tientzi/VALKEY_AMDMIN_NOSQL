import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { Plus, Edit2, Trash2, Tag, Search, X } from 'lucide-react'
import { matchesRelative } from '../../utils/searchUtils'
import './AdminPages.css'

const CouponManager = () => {
  const [coupons, setCoupons] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Form states
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [minOrderAmount, setMinOrderAmount] = useState(0)
  const [maxUses, setMaxUses] = useState(100)
  const [isActive, setIsActive] = useState(true)
  const [applicableCategoryId, setApplicableCategoryId] = useState('')
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('')
  const [error, setError] = useState('')

  const fetchCoupons = async () => {
    try {
      const response = await api.get('/api/admin/coupons')
      setCoupons(response.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await api.get('/api/public/categories')
      setCategories(res.data || [])
    } catch (err) {
      console.error('Lỗi khi lấy danh mục', err)
    }
  }

  useEffect(() => {
    fetchCoupons()
    fetchCategories()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!code.trim()) {
      setError('Mã coupon không được để trống')
      return
    }
    if (discountValue <= 0) {
      setError('Giá trị giảm phải lớn hơn 0')
      return
    }
    if (!startDate || !endDate) {
      setError('Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc')
      return
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError('Ngày bắt đầu không được lớn hơn ngày kết thúc')
      return
    }

    // Định dạng lại datetime gửi lên Spring Boot (ISO format string)
    const formattedStartDate = new Date(startDate).toISOString()
    const formattedEndDate = new Date(endDate).toISOString()

    const payload = {
      code,
      description,
      discountType,
      discountValue: Number(discountValue),
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      minOrderAmount: Number(minOrderAmount),
      maxUses: Number(maxUses),
      isActive,
      applicableCategoryId: applicableCategoryId ? Number(applicableCategoryId) : null,
      maxDiscountAmount: (discountType === 'PERCENTAGE' && maxDiscountAmount) ? Number(maxDiscountAmount) : null
    }

    try {
      if (editId) {
        await api.put(`/api/admin/coupons/${editId}`, payload)
      } else {
        await api.post('/api/admin/coupons', payload)
      }
      fetchCoupons()
      handleCloseForm()
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi khi lưu coupon')
    }
  }

  const handleEdit = (cp) => {
    setEditId(cp.id)
    setCode(cp.code)
    setDescription(cp.description || '')
    setDiscountType(cp.discountType)
    setDiscountValue(cp.discountValue)
    
    // Convert ISO string back to local datetime input format YYYY-MM-DDTHH:mm
    const start = new Date(cp.startDate)
    start.setMinutes(start.getMinutes() - start.getTimezoneOffset())
    setStartDate(Number.isNaN(start.getTime()) ? '' : start.toISOString().slice(0, 16))

    const end = new Date(cp.endDate)
    end.setMinutes(end.getMinutes() - end.getTimezoneOffset())
    setEndDate(Number.isNaN(end.getTime()) ? '' : end.toISOString().slice(0, 16))

    setMinOrderAmount(cp.minOrderAmount)
    setMaxUses(cp.maxUses)
    setIsActive(cp.isActive)
    setApplicableCategoryId(cp.applicableCategoryId || '')
    setMaxDiscountAmount(cp.maxDiscountAmount || '')
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa coupon này?')) return
    try {
      await api.delete(`/api/admin/coupons/${id}`)
      fetchCoupons()
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể xóa coupon')
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditId(null)
    setCode('')
    setDescription('')
    setDiscountType('PERCENTAGE')
    setDiscountValue(0)
    setStartDate('')
    setEndDate('')
    setMinOrderAmount(0)
    setMaxUses(100)
    setIsActive(true)
    setApplicableCategoryId('')
    setMaxDiscountAmount('')
    setError('')
  }

  if (loading) {
    return <div className="loading-state">Đang tải coupon...</div>
  }

  return (
    <div className="admin-crud-page">
      <div className="crud-header">
        <h2>Quản lý Khuyến mãi (Coupons)</h2>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          <Plus size={18} /> Thêm Coupon mới
        </button>
      </div>

      {showForm && (
        <div className="admin-form-overlay">
          <form onSubmit={handleSubmit} className="admin-popup-form form-large glass">
            <h3>{editId ? 'Cập nhật thông tin Coupon' : 'Tạo Coupon mới'}</h3>
            {error && <div className="form-error">{error}</div>}

            <div className="form-grid-2">
              <div className="form-group">
                <label>Mã Coupon</label>
                <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} disabled={!!editId} />
              </div>
              <div className="form-group">
                <label>Loại chiết khấu</label>
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                  <option value="PERCENTAGE">Phần trăm (%)</option>
                  <option value="FIXED_AMOUNT">Số tiền mặt cụ thể (đ)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Giá trị giảm (Số % hoặc số tiền cụ thể)</label>
                <input type="number" required value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Giá trị đơn tối thiểu áp dụng (đ)</label>
                <input type="number" required value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Ngày bắt đầu hiệu lực</label>
                <input type="datetime-local" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Ngày hết hạn hiệu lực</label>
                <input type="datetime-local" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Áp dụng cho danh mục</label>
                <select value={applicableCategoryId} onChange={(e) => setApplicableCategoryId(e.target.value)}>
                  <option value="">Toàn bộ đơn hàng (Tất cả sản phẩm)</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {discountType === 'PERCENTAGE' && (
                <div className="form-group">
                  <label>Giảm tối đa (VNĐ) <small style={{ color: 'var(--primary)', fontWeight: 600 }}>(Mức trần %)</small></label>
                  <input
                    type="number"
                    placeholder="VD: 50000 (để trống nếu không giới hạn)"
                    value={maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(e.target.value)}
                  />
                </div>
              )}
              <div className="form-group">
                <label>Số lượt sử dụng tối đa</label>
                <input type="number" required value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
              </div>
            </div>

            <div className="form-group margin-top-sm">
              <label>Mô tả / Điều kiện sử dụng</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="form-checkbox margin-top-sm">
              <label>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <span> Cho phép kích hoạt sử dụng ngay</span>
              </label>
            </div>

            <div className="form-actions margin-top-md">
              <button type="submit" className="btn btn-primary">Lưu lại</button>
              <button type="button" onClick={handleCloseForm} className="btn btn-outline">Hủy bỏ</button>
            </div>
          </form>
        </div>
      )}

      {/* Thanh tìm kiếm tương đối */}
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: '16px',
        background: '#ffffff',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Tìm mã giảm giá (gõ: welcome, freeship, 10%...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 36px 9px 38px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.92rem',
              outline: 'none'
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="btn btn-outline"
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            Đặt lại
          </button>
        )}

        <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: 'auto' }}>
          Hiển thị: <strong>{coupons.filter(cp => matchesRelative([cp.code, cp.description, cp.discountType], searchTerm)).length}</strong> / {coupons.length} mã
        </span>
      </div>

      {/* Bảng danh sách */}
      <div className="admin-table-container glass">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Mã</th>
              <th>Mô tả</th>
              <th>Áp dụng cho</th>
              <th>Loại giảm</th>
              <th>Giá trị giảm</th>
              <th>Giảm tối đa</th>
              <th>Đơn tối thiểu</th>
              <th>Đã dùng</th>
              <th>Lượt tối đa</th>
              <th>Hạn dùng</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {coupons.filter(cp => matchesRelative([cp.code, cp.description, cp.discountType], searchTerm)).length > 0 ? (
              coupons.filter(cp => matchesRelative([cp.code, cp.description, cp.discountType], searchTerm)).map(cp => (
                <tr key={cp.id}>
                  <td>{cp.id}</td>
                  <td><strong>{cp.code}</strong></td>
                  <td>{cp.description || '—'}</td>
                  <td>
                    {cp.applicableCategoryName ? (
                      <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600 }}>
                        {cp.applicableCategoryName}
                      </span>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Toàn bộ đơn</span>
                    )}
                  </td>
                  <td>{cp.discountType === 'PERCENTAGE' ? 'Phần trăm' : 'Tiền mặt'}</td>
                  <td>{cp.discountType === 'PERCENTAGE' ? `${cp.discountValue}%` : `${cp.discountValue.toLocaleString()}đ`}</td>
                  <td>
                    {cp.maxDiscountAmount ? (
                      <strong style={{ color: '#ea580c' }}>{Number(cp.maxDiscountAmount).toLocaleString()}đ</strong>
                    ) : '—'}
                  </td>
                  <td>{cp.minOrderAmount.toLocaleString()}đ</td>
                  <td>{cp.usedCount}</td>
                  <td>{cp.maxUses}</td>
                  <td>{new Date(cp.endDate).toLocaleDateString('vi-VN')}</td>
                  <td>
                    <span className={`status-pill ${cp.isActive && (new Date(cp.endDate) > new Date()) ? 'active' : 'inactive'}`}>
                      {cp.isActive && (new Date(cp.endDate) > new Date()) ? 'Đang chạy' : 'Hết hạn/Khóa'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => handleEdit(cp)} className="action-btn edit" title="Sửa"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(cp.id)} className="action-btn delete" title="Xóa"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                  Không tìm thấy mã giảm giá nào phù hợp với từ khóa "{searchTerm}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default CouponManager
