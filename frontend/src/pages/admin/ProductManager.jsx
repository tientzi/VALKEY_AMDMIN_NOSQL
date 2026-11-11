import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { 
  Plus, Edit2, Trash2, Eye, EyeOff, Upload, Download, Printer, Search, 
  Filter, X, PackageCheck, AlertTriangle, CheckCircle2, Boxes, ArrowRight, Layers,
  Apple, FolderKanban
} from 'lucide-react'
import CategoryManager from './CategoryManager'
import { exportToCSV, printDocument } from '../../utils/exportUtils'
import { matchesRelative } from '../../utils/searchUtils'
import './AdminPages.css'

const ProductManager = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'categories' ? 'categories' : 'products'
  const handleTabChange = (tab) => setSearchParams({ tab })
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)

  // Search & Category Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [stockFilter, setStockFilter] = useState('ALL') // 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'

  // Form states
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState(0)
  const [salePrice, setSalePrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [mainImage, setMainImage] = useState('')
  const [images, setImages] = useState([]) // Mảng các ảnh phụ
  const [currentStock, setCurrentStock] = useState(0)
  const [minimumStock, setMinimumStock] = useState(5)
  const [location, setLocation] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [unit, setUnit] = useState('Cái')
  const [weightG, setWeightG] = useState(0)
  const [isActive, setIsActive] = useState(true)

  const [error, setError] = useState('')
  const [uploadingMain, setUploadingMain] = useState(false)
  const [uploadingSub, setUploadingSub] = useState(false)

  const fetchData = async () => {
    try {
      const prodRes = await api.get('/api/admin/products')
      const catRes = await api.get('/api/admin/categories')
      const brandRes = await api.get('/api/admin/brands')
      setProducts(prodRes.data)
      setCategories(catRes.data)
      setBrands(brandRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleMainImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingMain(true)
    setError('')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const response = await api.post('/api/admin/products/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setMainImage(response.data.url)
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể upload ảnh chính')
    } finally {
      setUploadingMain(false)
    }
  }

  const handleSubImagesUpload = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploadingSub(true)
    setError('')
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i])
    }
    try {
      const response = await api.post('/api/admin/products/upload-multiple', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setImages(prev => [...prev, ...response.data.urls])
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể upload ảnh phụ')
    } finally {
      setUploadingSub(false)
    }
  }

  const validateForm = () => {
    if (!name.trim()) return 'Tên sản phẩm không được để trống'
    if (price < 0) return 'Giá sản phẩm không được âm'
    if (salePrice !== '' && Number(salePrice) < 0) return 'Giá khuyến mãi không được âm'
    if (currentStock < 0) return 'Số lượng tồn kho không được âm'
    if (!categoryId) return 'Vui lòng chọn danh mục'
    if (!brandId) return 'Vui lòng chọn thương hiệu'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    const clientErr = validateForm()
    if (clientErr) {
      setError(clientErr)
      return
    }

    const payload = {
      name,
      description,
      price: Number(price),
      salePrice: salePrice !== '' ? Number(salePrice) : null,
      categoryId: Number(categoryId),
      brandId: Number(brandId),
      mainImage,
      images,
      currentStock: Number(currentStock),
      minimumStock: Number(minimumStock),
      location,
      sku,
      barcode,
      unit,
      weightG: Number(weightG),
      isActive
    }

    try {
      if (editId) {
        await api.put(`/api/admin/products/${editId}`, payload)
      } else {
        await api.post('/api/admin/products', payload)
      }
      fetchData()
      handleCloseForm()
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi khi lưu sản phẩm')
    }
  }

  const handleEdit = (prod) => {
    setEditId(prod.id)
    setName(prod.name)
    setDescription(prod.description || '')
    setPrice(prod.price)
    setSalePrice(prod.salePrice !== null ? prod.salePrice : '')
    setCategoryId(prod.categoryId ? prod.categoryId.toString() : '')
    setBrandId(prod.brandId ? prod.brandId.toString() : '')
    setMainImage(prod.mainImage || '')
    setImages(prod.images || [])
    setCurrentStock(prod.currentStock || 0)
    setMinimumStock(prod.minimumStock || 5)
    setLocation(prod.location || '')
    setSku(prod.sku || '')
    setBarcode(prod.barcode || '')
    setUnit(prod.unit || 'Cái')
    setWeightG(prod.weightG || 0)
    setIsActive(prod.isActive)
    setShowForm(true)
  }

  const handleToggleStatus = async (id) => {
    try {
      await api.patch(`/api/admin/products/${id}/toggle-status`)
      fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể đổi trạng thái sản phẩm')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) return
    try {
      await api.delete(`/api/admin/products/${id}`)
      fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể xóa sản phẩm')
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditId(null)
    setName('')
    setDescription('')
    setPrice(0)
    setSalePrice('')
    setCategoryId('')
    setBrandId('')
    setMainImage('')
    setImages([])
    setCurrentStock(0)
    setMinimumStock(5)
    setLocation('')
    setSku('')
    setBarcode('')
    setUnit('Cái')
    setWeightG(0)
    setIsActive(true)
    setError('')
  }

  // Thống kê tồn kho phục vụ KPI
  const totalStock = products.reduce((acc, p) => acc + (p.currentStock || 0), 0)
  const lowStockProducts = products.filter(p => (p.currentStock || 0) > 0 && (p.currentStock || 0) <= (p.minimumStock || 5))
  const outOfStockProducts = products.filter(p => (p.currentStock || 0) === 0)
  const inStockProducts = products.filter(p => (p.currentStock || 0) > (p.minimumStock || 5))

  const filteredProducts = products.filter(p => {
    const matchCat = selectedCategory === 'ALL' || String(p.categoryId) === String(selectedCategory)
    if (!matchCat) return false
    
    let matchStock = true
    if (stockFilter === 'IN_STOCK') {
      matchStock = (p.currentStock || 0) > (p.minimumStock || 5)
    } else if (stockFilter === 'LOW_STOCK') {
      matchStock = (p.currentStock || 0) > 0 && (p.currentStock || 0) <= (p.minimumStock || 5)
    } else if (stockFilter === 'OUT_OF_STOCK') {
      matchStock = (p.currentStock || 0) === 0
    }
    if (!matchStock) return false

    return matchesRelative([p.name, p.sku, p.barcode, p.categoryName, p.brandName, p.location], searchTerm)
  })

  const handleExportCSV = () => {
    const headers = ['Mã SP', 'Tên sản phẩm', 'SKU', 'Mã vạch', 'Danh mục', 'Thương hiệu', 'Giá niêm yết (VND)', 'Giá KM (VND)', 'Đơn vị tính', 'Tồn kho', 'Vị trí kệ', 'Trạng thái']
    const rows = [...filteredProducts].sort((a, b) => a.id - b.id).map(p => [
      `SP-${p.id}`,
      p.name || '',
      p.sku || '',
      p.barcode || '',
      p.categoryName || '',
      p.brandName || '',
      p.price || 0,
      p.salePrice || '',
      p.unit || 'Cái',
      p.currentStock || 0,
      p.location || '',
      p.isActive ? 'Đang kinh doanh' : 'Tạm ẩn'
    ])
    exportToCSV(`Bang_Gia_SanPham_MiniMart_${new Date().toISOString().slice(0, 10)}`, headers, rows)
  }

  const handlePrint = () => {
    printDocument('Bang_Gia_Niem_Yet_SanPham_MiniMart')
  }

  if (loading) {
    return <div className="loading-state">Đang tải sản phẩm...</div>
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
            <div>Tổng số mặt hàng: {products.length} sản phẩm</div>
          </div>
        </div>
        <div className="print-doc-title">
          <h2>BẢNG GIÁ NIÊM YẾT SẢN PHẨM</h2>
          <p>Hệ thống Siêu thị Tiện lợi MiniMart</p>
        </div>
      </div>

      {/* THANH TAB BAR: SẢN PHẨM & TỒN KHO / DANH MỤC */}
      <div className="no-print" style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '20px',
        paddingBottom: '2px'
      }}>
        <button
          type="button"
          onClick={() => handleTabChange('products')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'none',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'products' ? 700 : 500,
            color: activeTab === 'products' ? '#ff5722' : '#64748b',
            borderBottom: activeTab === 'products' ? '3px solid #ff5722' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <Apple size={18} /> Sản phẩm & Tồn kho ({products.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('categories')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'none',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'categories' ? 700 : 500,
            color: activeTab === 'categories' ? '#ff5722' : '#64748b',
            borderBottom: activeTab === 'categories' ? '3px solid #ff5722' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <FolderKanban size={18} /> Danh mục ({categories.length})
        </button>
      </div>

      {activeTab === 'categories' ? (
        <CategoryManager onCategoryUpdated={fetchData} />
      ) : (
        <>
          <div className="crud-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2>Quản lý Sản phẩm & Tồn kho</h2>
              <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
                Quản lý thông tin hàng hóa, định giá niêm yết, theo dõi số lượng tồn kho và nhập hàng kịp thời.
              </p>
            </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={handleExportCSV} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Xuất Excel / CSV
          </button>
          <button onClick={handlePrint} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={16} /> In Bảng Giá
          </button>
          <Link 
            to="/admin/warehouse-history?tab=receipts&action=create" 
            className="btn btn-primary" 
            style={{ 
              background: '#16a34a', 
              borderColor: '#16a34a', 
              color: '#ffffff',
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            <Boxes size={18} /> + Nhập hàng
          </Link>
          <button onClick={() => setShowForm(true)} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={18} /> Thêm sản phẩm
          </button>
        </div>
      </div>

      {showForm && (
        <div className="admin-form-overlay">
          <form onSubmit={handleSubmit} className="admin-popup-form form-large glass">
            <h3>{editId ? 'Cập nhật thông tin sản phẩm' : 'Thêm sản phẩm mới'}</h3>
            {error && <div className="form-error">{error}</div>}

            <div className="form-grid-2">
              <div className="form-group">
                <label>Tên sản phẩm</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Mã SKU</label>
                <input type="text" placeholder="Nhập mã SKU..." value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Giá bán (đ)</label>
                <input type="number" required value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Giá khuyến mãi (đ)</label>
                <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Danh mục</label>
                <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">-- Chọn danh mục --</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Thương hiệu</label>
                <select required value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                  <option value="">-- Chọn thương hiệu --</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Đơn vị tính</label>
                <select required value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {['Cái', 'Chai', 'Lon', 'Gói', 'Hộp', 'Túi', 'Thùng', 'Lốc', 'Kg', 'Gram', 'Bó', 'Khay', 'Vỉ'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Trọng lượng (gram)</label>
                <input type="number" placeholder="Trọng lượng gram..." required value={weightG} onChange={(e) => setWeightG(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Số lượng tồn kho (Khóa - Chỉ tăng qua QC Nhập kho)</label>
                <input 
                  type="number" 
                  value={currentStock} 
                  disabled={true} 
                  style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed', fontWeight: 700 }} 
                />
                <small style={{ color: '#0284c7', display: 'block', marginTop: '4px', fontSize: '0.8rem', lineHeight: 1.3 }}>
                  🔒 Tồn kho ban đầu luôn bằng 0. Số lượng chỉ được tăng tự động sau khi lập Phiếu nhập kho và kiểm định chất lượng (QC) đạt chuẩn.
                </small>
              </div>
              <div className="form-group">
                <label>Ngưỡng tồn kho tối thiểu</label>
                <input type="number" required value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} />
              </div>
            </div>

            <div className="form-group margin-top-sm">
              <label>Mô tả chi tiết sản phẩm</label>
              <textarea rows="3" value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
            </div>

            <div className="form-grid-2 margin-top-sm">
              <div className="form-group">
                <label>Ảnh chính sản phẩm</label>
                <input type="file" onChange={handleMainImageUpload} />
                {uploadingMain && <span>Đang tải...</span>}
                {mainImage && <img src={mainImage} alt="Preview" className="form-preview-img-product" />}
              </div>

              <div className="form-group">
                <label>Ảnh phụ sản phẩm (Chọn nhiều ảnh)</label>
                <input type="file" multiple onChange={handleSubImagesUpload} />
                {uploadingSub && <span>Đang tải...</span>}
                <div className="sub-images-preview">
                  {images.map((img, idx) => (
                    <div key={idx} className="sub-img-wrap">
                      <img src={img} alt="" />
                      <button type="button" onClick={() => setImages(images.filter((_, i) => i !== idx))} className="remove-sub-img">x</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-checkbox margin-top-sm">
              <label>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <span> Cho phép hiển thị bán hàng (Kích hoạt)</span>
              </label>
            </div>

            <div className="form-actions margin-top-md">
              <button type="submit" className="btn btn-primary">Lưu lại</button>
              <button type="button" onClick={handleCloseForm} className="btn btn-outline">Hủy bỏ</button>
            </div>
          </form>
        </div>
      )}

      {/* 3 THẺ KPI TỒN KHO THÔNG MINH (CLICK ĐỂ LỌC NHANH) */}
      <div className="no-print" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
        gap: '16px', 
        marginBottom: '20px' 
      }}>
        {/* KPI 1: Tổng lượng tồn kho */}
        <div 
          onClick={() => setStockFilter('ALL')}
          style={{ 
            background: stockFilter === 'ALL' ? '#eff6ff' : '#ffffff', 
            padding: '18px 20px', 
            borderRadius: '16px', 
            border: stockFilter === 'ALL' ? '2px solid #3b82f6' : '1px solid #e2e8f0', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Tổng lượng tồn kho</span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>
              {totalStock.toLocaleString()} <small style={{ fontSize: '0.9rem', fontWeight: 500, color: '#64748b' }}>món</small>
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: 600 }}>Tất cả {products.length} sản phẩm</span>
          </div>
          <div style={{ background: '#dbeafe', color: '#2563eb', padding: '12px', borderRadius: '12px' }}>
            <PackageCheck size={24} />
          </div>
        </div>

        {/* KPI 2: Mặt hàng sắp hết */}
        <div 
          onClick={() => setStockFilter(stockFilter === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK')}
          style={{ 
            background: stockFilter === 'LOW_STOCK' ? '#fffbeb' : '#ffffff', 
            padding: '18px 20px', 
            borderRadius: '16px', 
            border: stockFilter === 'LOW_STOCK' ? '2px solid #f59e0b' : '1px solid #fed7aa', 
            boxShadow: '0 4px 12px rgba(245,158,11,0.08)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <span style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 600 }}>Mặt hàng sắp hết (≤ Ngưỡng)</span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.6rem', fontWeight: 900, color: '#d97706' }}>
              {lowStockProducts.length} <small style={{ fontSize: '0.9rem', fontWeight: 500, color: '#b45309' }}>mặt hàng</small>
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>Cần lên đơn nhập sớm</span>
          </div>
          <div style={{ background: '#fef3c7', color: '#d97706', padding: '12px', borderRadius: '12px' }}>
            <AlertTriangle size={24} />
          </div>
        </div>

        {/* KPI 3: Mặt hàng đã hết */}
        <div 
          onClick={() => setStockFilter(stockFilter === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK')}
          style={{ 
            background: stockFilter === 'OUT_OF_STOCK' ? '#fff5f5' : '#ffffff', 
            padding: '18px 20px', 
            borderRadius: '16px', 
            border: stockFilter === 'OUT_OF_STOCK' ? '2px solid #ef4444' : '1px solid #fecaca', 
            boxShadow: '0 4px 12px rgba(239,68,68,0.08)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <span style={{ fontSize: '0.85rem', color: '#991b1b', fontWeight: 600 }}>Mặt hàng hết hàng (= 0)</span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.6rem', fontWeight: 900, color: '#dc2626' }}>
              {outOfStockProducts.length} <small style={{ fontSize: '0.9rem', fontWeight: 500, color: '#991b1b' }}>mặt hàng</small>
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 600 }}>Ngưng bán do hết tồn</span>
          </div>
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '12px' }}>
            <Boxes size={24} />
          </div>
        </div>
      </div>

      {/* Thanh tìm kiếm tương đối & Bộ lọc Danh mục + Tồn kho */}
      <div className="no-print" style={{
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
            placeholder="Tìm kiếm sản phẩm tương đối (gõ không dấu: rau, thit, coca, mi, sku...)"
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

        {/* Bộ lọc theo Danh mục */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={18} style={{ color: '#64748b' }} />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              fontSize: '0.92rem',
              color: '#334155',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="ALL">Tất cả danh mục ({products.length})</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Bộ lọc trạng thái Tồn kho */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} style={{ color: '#64748b' }} />
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              fontSize: '0.92rem',
              color: '#334155',
              cursor: 'pointer',
              outline: 'none',
              fontWeight: stockFilter !== 'ALL' ? 700 : 400
            }}
          >
            <option value="ALL">Tất cả tồn kho ({products.length})</option>
            <option value="IN_STOCK">Còn hàng dồi dào ({inStockProducts.length})</option>
            <option value="LOW_STOCK">Sắp hết hàng (≤ ngưỡng) ({lowStockProducts.length})</option>
            <option value="OUT_OF_STOCK">Đã hết hàng (= 0) ({outOfStockProducts.length})</option>
          </select>
        </div>

        {(searchTerm || selectedCategory !== 'ALL' || stockFilter !== 'ALL') && (
          <button
            onClick={() => { setSearchTerm(''); setSelectedCategory('ALL'); setStockFilter('ALL') }}
            className="btn btn-outline"
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            Đặt lại
          </button>
        )}

        <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: 'auto' }}>
          Hiển thị: <strong>{filteredProducts.length}</strong> / {products.length} sản phẩm
        </span>
      </div>

      {/* Bảng danh sách */}
      <div className="admin-table-container glass">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th className="no-print">Ảnh chính</th>
              <th>Tên sản phẩm</th>
              <th>Danh mục</th>
              <th>Thương hiệu</th>
              <th>Giá gốc</th>
              <th>Giá KM</th>
              <th>Tồn kho</th>
              <th>Trạng thái</th>
              <th className="no-print">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length > 0 ? (
              [...filteredProducts].sort((a, b) => a.id - b.id).map(prod => {
                const isOutOfStock = (prod.currentStock || 0) === 0
                const isLowStock = !isOutOfStock && (prod.currentStock || 0) <= (prod.minimumStock || 5)

                return (
                  <tr key={prod.id}>
                    <td>{prod.id}</td>
                    <td className="no-print">
                      <img src={prod.mainImage} alt={prod.name} className="table-img" onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=150&auto=format&fit=crop' }} />
                    </td>
                    <td><strong>{prod.name}</strong></td>
                    <td>{prod.categoryName}</td>
                    <td>{prod.brandName}</td>
                    <td>{prod.price.toLocaleString()}đ</td>
                    <td>{prod.salePrice ? `${prod.salePrice.toLocaleString()}đ` : '—'}</td>
                    <td>
                      {isOutOfStock ? (
                        <span style={{ background: '#fee2e2', color: '#dc2626', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
                          Hết hàng (0)
                        </span>
                      ) : isLowStock ? (
                        <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }} title={`Tồn kho dưới ngưỡng tối thiểu (${prod.minimumStock || 5})`}>
                          ⚠️ Sắp hết ({prod.currentStock} {prod.unit || 'món'})
                        </span>
                      ) : (
                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
                          {prod.currentStock} {prod.unit || 'món'}
                        </span>
                      )}
                    </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(prod.id)}
                      className={`status-pill ${prod.isActive ? 'active' : 'inactive'}`}
                      style={{ cursor: 'pointer', border: 'none' }}
                      title="Bấm để bật/tắt hiển thị bán hàng"
                    >
                      {prod.isActive ? <Eye size={12} /> : <EyeOff size={12} />}
                      {prod.isActive ? 'Bán trực tuyến' : 'Ẩn'}
                    </button>
                  </td>
                  <td className="no-print">
                    <div className="table-actions">
                      <button onClick={() => handleEdit(prod)} className="action-btn edit" title="Sửa"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(prod.id)} className="action-btn delete" title="Xóa"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              )})
            ) : (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                  Không tìm thấy sản phẩm nào phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Chữ ký khi in */}
      <div className="print-only print-signatures">
        <div className="print-sig-col">
          <strong>Người Lập Bảng Giá</strong>
          <span>(Ký và ghi rõ họ tên)</span>
          <div className="print-sig-space"></div>
        </div>
        <div className="print-sig-col">
          <strong>Trưởng Bộ Phận Hàng Hóa</strong>
          <span>(Ký và ghi rõ họ tên)</span>
          <div className="print-sig-space"></div>
        </div>
        <div className="print-sig-col">
          <strong>Ban Giám Đốc</strong>
          <span>(Ký và ghi rõ họ tên)</span>
          <div className="print-sig-space"></div>
        </div>
      </div>
        </>
      )}
    </div>
  )
}

export default ProductManager
