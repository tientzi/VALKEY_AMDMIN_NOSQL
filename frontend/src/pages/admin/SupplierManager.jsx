import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { 
  Building2, Tag, Plus, Edit2, ShieldCheck, ShieldAlert, 
  Search, X, Package, Eye, EyeOff, Trash2, Calendar, CheckCircle2
} from 'lucide-react'
import { matchesRelative } from '../../utils/searchUtils'
import './AdminPages.css'

const SupplierManager = () => {
  const [activeTab, setActiveTab] = useState('SUPPLIERS') // 'SUPPLIERS' | 'BRANDS'

  // ========== SUPPLIER STATES ==========
  const [suppliers, setSuppliers] = useState([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [searchTermSuppliers, setSearchTermSuppliers] = useState('')

  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [editSupplierId, setEditSupplierId] = useState(null)
  const [supName, setSupName] = useState('')
  const [supContactName, setSupContactName] = useState('')
  const [supPhone, setSupPhone] = useState('')
  const [supEmail, setSupEmail] = useState('')
  const [supAddress, setSupAddress] = useState('')
  const [supIsActive, setSupIsActive] = useState(true)
  const [supplierError, setSupplierError] = useState('')

  // Modal Sản phẩm của NCC
  const [showProductsModal, setShowProductsModal] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [supplierProducts, setSupplierProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // ========== BRAND STATES ==========
  const [brands, setBrands] = useState([])
  const [loadingBrands, setLoadingBrands] = useState(true)
  const [searchTermBrands, setSearchTermBrands] = useState('')

  const [showBrandForm, setShowBrandForm] = useState(false)
  const [editBrandId, setEditBrandId] = useState(null)
  const [brandName, setBrandName] = useState('')
  const [brandDescription, setBrandDescription] = useState('')
  const [brandIsActive, setBrandIsActive] = useState(true)
  const [brandError, setBrandError] = useState('')

  // Fetch Data
  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/api/admin/suppliers')
      setSuppliers(response.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const fetchBrands = async () => {
    try {
      const response = await api.get('/api/admin/brands')
      setBrands(response.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingBrands(false)
    }
  }

  useEffect(() => {
    fetchSuppliers()
    fetchBrands()
  }, [])

  // ========== SUPPLIER ACTIONS ==========
  const handleSupplierSubmit = async (e) => {
    e.preventDefault()
    setSupplierError('')

    if (!supName.trim()) {
      setSupplierError('Tên nhà cung cấp không được để trống')
      return
    }
    if (supPhone && !/^0\d{9}$/.test(supPhone)) {
      setSupplierError('Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0')
      return
    }

    const payload = {
      name: supName,
      contactName: supContactName,
      phone: supPhone,
      email: supEmail,
      address: supAddress,
      isActive: supIsActive
    }

    try {
      if (editSupplierId) {
        await api.put(`/api/admin/suppliers/${editSupplierId}`, payload)
      } else {
        await api.post('/api/admin/suppliers', payload)
      }
      fetchSuppliers()
      handleCloseSupplierForm()
    } catch (err) {
      setSupplierError(err.response?.data?.error || 'Lỗi khi lưu nhà cung cấp')
    }
  }

  const handleEditSupplier = (sup) => {
    setEditSupplierId(sup.id)
    setSupName(sup.name)
    setSupContactName(sup.contactName || '')
    setSupPhone(sup.phone || '')
    setSupEmail(sup.email || '')
    setSupAddress(sup.address || '')
    setSupIsActive(sup.isActive)
    setShowSupplierForm(true)
  }

  const handleToggleSupplierStatus = async (id) => {
    try {
      await api.put(`/api/admin/suppliers/${id}/toggle-status`)
      fetchSuppliers()
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể đổi trạng thái nhà cung cấp')
    }
  }

  const handleOpenProductsModal = async (sup) => {
    setSelectedSupplier(sup)
    setShowProductsModal(true)
    setLoadingProducts(true)
    try {
      const res = await api.get(`/api/admin/suppliers/${sup.id}/products`)
      setSupplierProducts(res.data)
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể lấy danh sách sản phẩm')
      setSupplierProducts([])
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleToggleProductStatus = async (prodId) => {
    try {
      await api.patch(`/api/admin/products/${prodId}/toggle-status`)
      // Cập nhật lại trạng thái sản phẩm trong modal
      setSupplierProducts(prev => prev.map(p => p.id === prodId ? { ...p, isActive: !p.isActive } : p))
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể đổi trạng thái sản phẩm')
    }
  }

  const handleCloseSupplierForm = () => {
    setShowSupplierForm(false)
    setEditSupplierId(null)
    setSupName('')
    setSupContactName('')
    setSupPhone('')
    setSupEmail('')
    setSupAddress('')
    setSupIsActive(true)
    setSupplierError('')
  }

  // ========== BRAND ACTIONS ==========
  const handleBrandSubmit = async (e) => {
    e.preventDefault()
    setBrandError('')

    if (!brandName.trim()) {
      setBrandError('Tên thương hiệu không được để trống')
      return
    }

    const payload = {
      name: brandName,
      description: brandDescription,
      isActive: brandIsActive
    }

    try {
      if (editBrandId) {
        await api.put(`/api/admin/brands/${editBrandId}`, payload)
      } else {
        await api.post('/api/admin/brands', payload)
      }
      fetchBrands()
      handleCloseBrandForm()
    } catch (err) {
      setBrandError(err.response?.data?.error || 'Lỗi khi lưu thương hiệu')
    }
  }

  const handleEditBrand = (b) => {
    setEditBrandId(b.id)
    setBrandName(b.name)
    setBrandDescription(b.description || '')
    setBrandIsActive(b.isActive != null ? b.isActive : true)
    setShowBrandForm(true)
  }

  const handleDeleteBrand = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thương hiệu này?')) return
    try {
      await api.delete(`/api/admin/brands/${id}`)
      fetchBrands()
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể xóa thương hiệu')
    }
  }

  const handleToggleBrandStatus = async (brand) => {
    try {
      await api.put(`/api/admin/brands/${brand.id}`, {
        ...brand,
        isActive: !brand.isActive
      })
      fetchBrands()
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể đổi trạng thái thương hiệu')
    }
  }

  const handleCloseBrandForm = () => {
    setShowBrandForm(false)
    setEditBrandId(null)
    setBrandName('')
    setBrandDescription('')
    setBrandIsActive(true)
    setBrandError('')
  }

  // Filtered lists
  const filteredSuppliers = suppliers.filter(s => 
    matchesRelative([s.name, s.contactName, s.phone, s.email, s.address], searchTermSuppliers)
  )

  const filteredBrands = brands.filter(b => 
    matchesRelative([b.name, b.description], searchTermBrands)
  )

  return (
    <div className="admin-crud-page">
      {/* Tab bar navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: '2px solid #e2e8f0',
        paddingBottom: '8px'
      }}>
        <button
          onClick={() => setActiveTab('SUPPLIERS')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.95rem',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backgroundColor: activeTab === 'SUPPLIERS' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'SUPPLIERS' ? '#ffffff' : '#64748b'
          }}
        >
          <Building2 size={18} />
          Nhà cung cấp
          <span style={{
            backgroundColor: activeTab === 'SUPPLIERS' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
            color: activeTab === 'SUPPLIERS' ? '#ffffff' : '#475569',
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '0.8rem'
          }}>
            {suppliers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('BRANDS')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.95rem',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backgroundColor: activeTab === 'BRANDS' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'BRANDS' ? '#ffffff' : '#64748b'
          }}
        >
          <Tag size={18} />
          Thương hiệu
          <span style={{
            backgroundColor: activeTab === 'BRANDS' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
            color: activeTab === 'BRANDS' ? '#ffffff' : '#475569',
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '0.8rem'
          }}>
            {brands.length}
          </span>
        </button>
      </div>

      {/* ==================== TAB 1: NHÀ CUNG CẤP ==================== */}
      {activeTab === 'SUPPLIERS' && (
        <>
          <div className="crud-header">
            <div>
              <h2>Danh sách Nhà cung cấp</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
                Quản lý đối tác cung ứng, trạng thái hợp tác và danh mục hàng hóa cung cấp.
              </p>
            </div>
            <button onClick={() => setShowSupplierForm(true)} className="btn btn-primary">
              <Plus size={18} /> Thêm nhà cung cấp
            </button>
          </div>

          {/* Form thêm / sửa NCC */}
          {showSupplierForm && (
            <div className="admin-form-overlay">
              <form onSubmit={handleSupplierSubmit} className="admin-popup-form form-large glass">
                <h3>{editSupplierId ? 'Cập nhật nhà cung cấp' : 'Thêm nhà cung cấp mới'}</h3>
                {supplierError && <div className="form-error">{supplierError}</div>}

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Tên nhà cung cấp *</label>
                    <input type="text" required value={supName} onChange={(e) => setSupName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Người liên hệ</label>
                    <input type="text" value={supContactName} onChange={(e) => setSupContactName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Số điện thoại</label>
                    <input type="tel" inputMode="numeric" maxLength={10} value={supPhone} onChange={(e) => setSupPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={supEmail} onChange={(e) => setSupEmail(e.target.value)} />
                  </div>
                </div>
                
                <div className="form-group margin-top-sm">
                  <label>Địa chỉ</label>
                  <textarea rows="2" value={supAddress} onChange={(e) => setSupAddress(e.target.value)}></textarea>
                </div>

                <div className="form-checkbox margin-top-sm">
                  <label>
                    <input type="checkbox" checked={supIsActive} onChange={(e) => setSupIsActive(e.target.checked)} />
                    <span> Đang hợp tác (Kích hoạt)</span>
                  </label>
                </div>

                <div className="form-actions margin-top-md">
                  <button type="submit" className="btn btn-primary">Lưu lại</button>
                  <button type="button" onClick={handleCloseSupplierForm} className="btn btn-outline">Hủy bỏ</button>
                </div>
              </form>
            </div>
          )}

          {/* Search bar NCC */}
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
                placeholder="Tìm kiếm nhà cung cấp (gõ không dấu: vietgap, acecook, sdt, dia chi...)"
                value={searchTermSuppliers}
                onChange={(e) => setSearchTermSuppliers(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 36px 9px 38px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.92rem',
                  outline: 'none'
                }}
              />
              {searchTermSuppliers && (
                <button
                  onClick={() => setSearchTermSuppliers('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: 'auto' }}>
              Hiển thị: <strong>{filteredSuppliers.length}</strong> / {suppliers.length} NCC
            </span>
          </div>

          {/* Bảng danh sách NCC (ĐÃ BỎ NÚT XÓA, THÊM TOGGLE & NÚT XEM SẢN PHẨM) */}
          <div className="admin-table-container glass">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tên NCC</th>
                  <th>Người liên hệ</th>
                  <th>Điện thoại</th>
                  <th>Email & Địa chỉ</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map(sup => (
                    <tr key={sup.id}>
                      <td>#{sup.id}</td>
                      <td>
                        <strong>{sup.name}</strong>
                      </td>
                      <td>{sup.contactName || '—'}</td>
                      <td>{sup.phone || '—'}</td>
                      <td style={{ fontSize: '0.88rem', color: '#475569' }}>
                        <div>{sup.email || ''}</div>
                        <div style={{ color: '#64748b' }}>{sup.address || ''}</div>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleToggleSupplierStatus(sup.id)}
                          className={`status-pill ${sup.isActive ? 'active' : 'inactive'}`}
                          style={{ cursor: 'pointer', border: 'none' }}
                          title="Bấm để bật/tắt hợp tác"
                        >
                          {sup.isActive ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                          {sup.isActive ? 'Đang hợp tác' : 'Ngừng hợp tác'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="table-actions" style={{ justifyContent: 'center' }}>
                          <button
                            onClick={() => handleOpenProductsModal(sup)}
                            className="btn btn-outline"
                            style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            title="Xem các sản phẩm NCC này cung cấp"
                          >
                            <Package size={14} /> Sản phẩm
                          </button>
                          <button
                            onClick={() => handleEditSupplier(sup)}
                            className="action-btn edit"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      Không tìm thấy nhà cung cấp nào phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ==================== TAB 2: THƯƠNG HIỆU ==================== */}
      {activeTab === 'BRANDS' && (
        <>
          <div className="crud-header">
            <div>
              <h2>Danh mục Thương hiệu</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
                Quản lý các nhãn hàng, thương hiệu sản phẩm và nhãn hàng nhập kho.
              </p>
            </div>
            <button onClick={() => setShowBrandForm(true)} className="btn btn-primary">
              <Plus size={18} /> Thêm thương hiệu
            </button>
          </div>

          {/* Form thêm / sửa Thương hiệu */}
          {showBrandForm && (
            <div className="admin-form-overlay">
              <form onSubmit={handleBrandSubmit} className="admin-popup-form glass" style={{ maxWidth: '480px' }}>
                <h3>{editBrandId ? 'Cập nhật thương hiệu' : 'Thêm thương hiệu mới'}</h3>
                {brandError && <div className="form-error">{brandError}</div>}

                <div className="form-group">
                  <label>Tên thương hiệu *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Vinamilk, TH True Milk, Acecook..."
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                </div>

                <div className="form-group margin-top-sm">
                  <label>Mô tả thương hiệu</label>
                  <textarea
                    rows="3"
                    placeholder="Thông tin ngắn về xuất xứ, dòng sản phẩm..."
                    value={brandDescription}
                    onChange={(e) => setBrandDescription(e.target.value)}
                  ></textarea>
                </div>

                <div className="form-checkbox margin-top-sm">
                  <label>
                    <input
                      type="checkbox"
                      checked={brandIsActive}
                      onChange={(e) => setBrandIsActive(e.target.checked)}
                    />
                    <span> Kích hoạt thương hiệu</span>
                  </label>
                </div>

                <div className="form-actions margin-top-md">
                  <button type="submit" className="btn btn-primary">Lưu lại</button>
                  <button type="button" onClick={handleCloseBrandForm} className="btn btn-outline">Hủy bỏ</button>
                </div>
              </form>
            </div>
          )}

          {/* Search bar Thương hiệu */}
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
                placeholder="Tìm kiếm thương hiệu..."
                value={searchTermBrands}
                onChange={(e) => setSearchTermBrands(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 36px 9px 38px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.92rem',
                  outline: 'none'
                }}
              />
              {searchTermBrands && (
                <button
                  onClick={() => setSearchTermBrands('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: 'auto' }}>
              Hiển thị: <strong>{filteredBrands.length}</strong> / {brands.length} thương hiệu
            </span>
          </div>

          {/* Bảng Thương hiệu */}
          <div className="admin-table-container glass">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tên thương hiệu</th>
                  <th>Mô tả</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredBrands.length > 0 ? (
                  filteredBrands.map(b => (
                    <tr key={b.id}>
                      <td>#{b.id}</td>
                      <td>
                        <strong>{b.name}</strong>
                      </td>
                      <td style={{ color: '#64748b' }}>{b.description || '—'}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleToggleBrandStatus(b)}
                          className={`status-pill ${b.isActive ? 'active' : 'inactive'}`}
                          style={{ cursor: 'pointer', border: 'none' }}
                          title="Bấm để bật/tắt kích hoạt"
                        >
                          {b.isActive ? <Eye size={12} /> : <EyeOff size={12} />}
                          {b.isActive ? 'Hoạt động' : 'Tạm ẩn'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="table-actions" style={{ justifyContent: 'center' }}>
                          <button onClick={() => handleEditBrand(b)} className="action-btn edit" title="Sửa">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDeleteBrand(b.id)} className="action-btn delete" title="Xóa">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      Không tìm thấy thương hiệu nào phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ==================== MODAL SẢN PHẨM CUNG CẤP CỦA NCC ==================== */}
      {showProductsModal && (
        <div className="admin-form-overlay">
          <div className="admin-popup-form form-large glass" style={{ maxWidth: '960px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package color="#2563eb" />
                  Sản phẩm cung cấp bởi: {selectedSupplier?.name}
                </h3>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.88rem' }}>
                  Danh sách sản phẩm từng nhập qua các phiếu nhập kho của nhà cung cấp này.
                </p>
              </div>
              <button
                onClick={() => setShowProductsModal(false)}
                className="btn btn-outline"
                style={{ padding: '6px 12px', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {loadingProducts ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                Đang tải danh sách sản phẩm...
              </div>
            ) : supplierProducts.length > 0 ? (
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Ảnh</th>
                      <th>Tên sản phẩm / SKU</th>
                      <th>Danh mục & Hãng</th>
                      <th>Giá bán</th>
                      <th>Tồn kho</th>
                      <th>Tổng đã nhập</th>
                      <th>Lần nhập cuối</th>
                      <th>Trạng thái bán</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierProducts.map(p => (
                      <tr key={p.id}>
                        <td>
                          <img
                            src={p.mainImage}
                            alt=""
                            className="table-img"
                            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=150&auto=format&fit=crop' }}
                          />
                        </td>
                        <td>
                          <strong>{p.name}</strong>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>SKU: {p.sku || '—'}</div>
                        </td>
                        <td>
                          <div>{p.categoryName || '—'}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{p.brandName || ''}</div>
                        </td>
                        <td>{(p.price || 0).toLocaleString()}đ</td>
                        <td>
                          <span className={p.currentStock <= 5 ? 'text-danger font-bold' : ''}>
                            {p.currentStock}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: '#2563eb' }}>{p.totalSuppliedQuantity}</strong>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                          {p.lastImportDate ? new Date(p.lastImportDate).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleToggleProductStatus(p.id)}
                            className={`status-pill ${p.isActive ? 'active' : 'inactive'}`}
                            style={{ cursor: 'pointer', border: 'none' }}
                            title="Bấm để bật/tắt hiển thị bán hàng của sản phẩm này"
                          >
                            {p.isActive ? <Eye size={12} /> : <EyeOff size={12} />}
                            {p.isActive ? 'Đang bán' : 'Tạm ẩn'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
                Nhà cung cấp này chưa có sản phẩm nào được nhập qua phiếu nhập kho.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setShowProductsModal(false)} className="btn btn-outline">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SupplierManager
