import React, { useState, useEffect, useContext } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { CartContext } from '../contexts/CartContext'
import { AuthContext } from '../contexts/AuthContext'
import { Filter, RotateCcw, LayoutGrid } from 'lucide-react'
import { ProductCard } from './Home'
import ProductModal from '../components/ProductModal'
import './ProductList.css'

const ProductList = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState(null)
  
  const { addToCart } = useContext(CartContext)
  const { isAuthenticated } = useContext(AuthContext)
  const [cartError, setCartError] = useState({})
  const [cartSuccess, setCartSuccess] = useState({})

  const keyword = searchParams.get('keyword') || ''
  const categoryId = searchParams.get('categoryId') || ''
  const brandId = searchParams.get('brandId') || ''
  const minPrice = searchParams.get('minPrice') || ''
  const maxPrice = searchParams.get('maxPrice') || ''
  const sortBy = searchParams.get('sortBy') || 'newest'

  const [priceMinInput, setPriceMinInput] = useState(minPrice)
  const [priceMaxInput, setPriceMaxInput] = useState(maxPrice)

  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const catRes = await api.get('/api/public/categories')
        const brandRes = await api.get('/api/public/brands')
        setCategories(catRes.data)
        setBrands(brandRes.data)
      } catch (err) {
        console.error('Không thể lấy dữ liệu bộ lọc', err)
      }
    }
    fetchFilterData()
  }, [])

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true)
      try {
        const params = {}
        if (keyword) params.keyword = keyword
        if (categoryId) params.categoryId = categoryId
        if (brandId) params.brandId = brandId
        if (minPrice) params.minPrice = minPrice
        if (maxPrice) params.maxPrice = maxPrice
        if (sortBy) params.sortBy = sortBy

        const response = await api.get('/api/public/products', { params })
        setProducts(response.data)
      } catch (err) {
        console.error('Lỗi khi lấy danh sách sản phẩm', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [keyword, categoryId, brandId, minPrice, maxPrice, sortBy])

  const updateFilters = (key, value) => {
    const newParams = new URLSearchParams(searchParams)
    if (value) {
      newParams.set(key, value)
    } else {
      newParams.delete(key)
    }
    setSearchParams(newParams)
  }

  const handlePriceFilterSubmit = (e) => {
    e.preventDefault()
    const newParams = new URLSearchParams(searchParams)
    if (priceMinInput) newParams.set('minPrice', priceMinInput)
    else newParams.delete('minPrice')
    
    if (priceMaxInput) newParams.set('maxPrice', priceMaxInput)
    else newParams.delete('maxPrice')

    setSearchParams(newParams)
  }

  const handleResetFilters = () => {
    setSearchParams({})
    setPriceMinInput('')
    setPriceMaxInput('')
  }

  const handleQuickAddToCart = async (e, product) => {
    e.preventDefault()
    e.stopPropagation()
    setCartError(prev => ({ ...prev, [product.id]: '' }))
    setCartSuccess(prev => ({ ...prev, [product.id]: '' }))

    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }

    try {
      await addToCart(product.id, 1)
      setCartSuccess(prev => ({ ...prev, [product.id]: 'Đã thêm!' }))
      setTimeout(() => {
        setCartSuccess(prev => ({ ...prev, [product.id]: '' }))
      }, 1500)
    } catch (err) {
      setCartError(prev => ({ ...prev, [product.id]: err }))
      setTimeout(() => {
        setCartError(prev => ({ ...prev, [product.id]: '' }))
      }, 3000)
    }
  }

  return (
    <div className="product-list-page">
      <aside className="filter-sidebar glass">
        <div className="sidebar-header">
          <h3><Filter size={18} /> Bộ lọc tìm kiếm</h3>
          <button onClick={handleResetFilters} className="reset-btn-link" title="Xóa tất cả bộ lọc">
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="filter-group">
          <h4>Danh mục</h4>
          <div className="filter-options">
            <label className="filter-option-item">
              <input
                type="radio"
                name="category"
                checked={categoryId === ''}
                onChange={() => updateFilters('categoryId', '')}
              />
              <div className="filter-cat-thumb-box all-cat">
                <LayoutGrid size={15} />
              </div>
              <span className="filter-cat-name">Tất cả danh mục</span>
            </label>
            {categories.map(cat => (
              <label key={cat.id} className="filter-option-item">
                <input
                  type="radio"
                  name="category"
                  checked={categoryId === cat.id.toString()}
                  onChange={() => updateFilters('categoryId', cat.id.toString())}
                />
                <div className="filter-cat-thumb-box">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="filter-cat-thumb"
                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=80&auto=format&fit=crop' }}
                  />
                </div>
                <span className="filter-cat-name">{cat.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <h4>Thương hiệu</h4>
          <div className="filter-options">
            <label className="filter-option-item">
              <input
                type="radio"
                name="brand"
                checked={brandId === ''}
                onChange={() => updateFilters('brandId', '')}
              />
              <span>Tất cả thương hiệu</span>
            </label>
            {brands.map(b => (
              <label key={b.id} className="filter-option-item">
                <input
                  type="radio"
                  name="brand"
                  checked={brandId === b.id.toString()}
                  onChange={() => updateFilters('brandId', b.id.toString())}
                />
                <span>{b.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <h4>Khoảng giá (đ)</h4>
          <form onSubmit={handlePriceFilterSubmit} className="price-filter-form">
            <div className="price-inputs">
              <input
                type="number"
                placeholder="Từ"
                value={priceMinInput}
                onChange={(e) => setPriceMinInput(e.target.value)}
              />
              <span>-</span>
              <input
                type="number"
                placeholder="Đến"
                value={priceMaxInput}
                onChange={(e) => setPriceMaxInput(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary apply-price-btn">Áp dụng</button>
          </form>
        </div>
      </aside>

      <div className="product-list-content">
        <div className="list-header glass">
          <div className="result-count">
            Tìm thấy <strong>{products.length}</strong> sản phẩm
            {keyword && <span> cho từ khóa "{keyword}"</span>}
          </div>

          <div className="sort-box">
            <span>Sắp xếp theo:</span>
            <select
              value={sortBy}
              onChange={(e) => updateFilters('sortBy', e.target.value)}
              className="sort-select"
            >
              <option value="newest">Mới nhất</option>
              <option value="price_asc">Thấp đến Cao</option>
              <option value="price_desc">Cao đến Thấp</option>
              <option value="best_seller">Bán chạy nhất</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Đang cập nhật danh sách...</div>
        ) : products.length > 0 ? (
          <div className="products-grid">
            {products.map(prod => (
              <ProductCard
                key={prod.id}
                product={prod}
                onQuickView={() => setSelectedProduct(prod)}
                onAddToCart={(e) => handleQuickAddToCart(e, prod)}
                successMsg={cartSuccess[prod.id]}
                errorMsg={cartError[prod.id]}
              />
            ))}
          </div>
        ) : (
          <div className="empty-products glass">
            <h3>Không tìm thấy sản phẩm nào!</h3>
            <p>Vui lòng xóa bộ lọc hoặc tìm kiếm với từ khóa khác.</p>
            <button onClick={handleResetFilters} className="btn btn-primary">Xóa bộ lọc</button>
          </div>
        )}
      </div>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  )
}

export default ProductList
