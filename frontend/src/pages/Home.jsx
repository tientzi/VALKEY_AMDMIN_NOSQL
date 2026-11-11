import React, { useState, useEffect, useContext } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { CartContext } from '../contexts/CartContext'
import { AuthContext } from '../contexts/AuthContext'
import { Eye, ShoppingCart, Percent, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import ProductModal from '../components/ProductModal'
import './Home.css'

const Home = () => {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState(null)
  
  const { addToCart } = useContext(CartContext)
  const { isAuthenticated } = useContext(AuthContext)
  
  const [cartError, setCartError] = useState({})
  const [cartSuccess, setCartSuccess] = useState({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        const prodRes = await api.get('/api/public/products')
        setProducts(prodRes.data)
      } catch (err) {
        console.error('Không thể lấy dữ liệu', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

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

  if (loading) {
    return <div className="loading-state">Đang tải trang chủ MiniMart...</div>
  }

  // Sản phẩm khuyến mãi (có salePrice)
  const saleProducts = products.filter(p => p.salePrice != null).slice(0, 4)
  const saleIds = new Set(saleProducts.map(p => p.id))

  // Sản phẩm mới nhất (id cao nhất, loại bỏ những sản phẩm đã hiện ở saleProducts)
  const newProducts = [...products]
    .sort((a, b) => b.id - a.id)
    .filter(p => !saleIds.has(p.id))
    .slice(0, 4)
  const newIds = new Set(newProducts.map(p => p.id))

  // Sản phẩm nổi bật (loại bỏ đã hiện ở 2 section trên, random hoặc lấy phần còn lại)
  const featuredProducts = products
    .filter(p => !saleIds.has(p.id) && !newIds.has(p.id))
    .slice(0, 4)

  return (
    <div className="home-page">
      {/* Hero Banner toàn chiều rộng */}
      <div className="hero-banner glass">
        <div className="banner-content">
          <span className="banner-tag"><Sparkles size={16} /> Giá rẻ mỗi ngày</span>
          <h1>Thực Phẩm Tươi Sạch <br />Cho Bữa Ăn Gia Đình</h1>
          <p>MiniMart cam kết cung cấp rau quả VietGAP tươi sạch, bơ sữa chất lượng cao và hàng tiêu dùng thiết yếu giao nhanh trong 2 giờ.</p>
          <div className="banner-actions">
            <Link to="/products" className="btn btn-primary">Mua sắm ngay</Link>
            <Link to="/products?categoryId=1" className="btn btn-outline">Rau Củ Tươi</Link>
          </div>
        </div>
        <div className="banner-image-container">
          <img src="/uploads/banner_hero.png" alt="MiniMart Fresh Banner" className="banner-image" onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600&auto=format&fit=crop' }} />
        </div>
      </div>

      <section className="features-badges">
        <div className="feature-badge-item">
          <ShieldCheck size={32} className="feature-icon" />
          <div>
            <h4>100% An toàn</h4>
            <p>VietGAP chất lượng cao</p>
          </div>
        </div>
        <div className="feature-badge-item">
          <Percent size={32} className="feature-icon" />
          <div>
            <h4>Giá siêu hời</h4>
            <p>Khuyến mãi hàng ngày</p>
          </div>
        </div>
        <div className="feature-badge-item">
          <TrendingUp size={32} className="feature-icon" />
          <div>
            <h4>Giao nhanh 2h</h4>
            <p>Freeship đơn từ 200k</p>
          </div>
        </div>
      </section>

      {saleProducts.length > 0 && (
        <section className="products-section">
          <div className="section-header">
            <h2 className="section-title text-sale"><Percent size={24} /> Siêu ưu đãi</h2>
            <Link to="/products" className="view-all-link">Xem tất cả</Link>
          </div>
          <div className="products-grid">
            {saleProducts.map(prod => (
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
        </section>
      )}

      <section className="products-section">
        <div className="section-header">
          <h2 className="section-title">Sản phẩm mới về</h2>
          <Link to="/products" className="view-all-link">Xem tất cả</Link>
        </div>
        <div className="products-grid">
          {newProducts.map(prod => (
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
      </section>

      {featuredProducts.length > 0 && (
      <section className="products-section">
        <div className="section-header">
          <h2 className="section-title">Sản phẩm nổi bật</h2>
          <Link to="/products" className="view-all-link">Xem tất cả</Link>
        </div>
        <div className="products-grid">
          {featuredProducts.map(prod => (
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
      </section>
      )}


      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  )
}

export const ProductCard = ({ product, onQuickView, onAddToCart, successMsg, errorMsg }) => {
  const isSale = product.salePrice != null
  const isOutOfStock = product.currentStock <= 0

  return (
    <div className="product-card glass">
      <Link to={`/products/${product.id}`} className="product-link">
        <div className="product-img-box">
          <img src={product.mainImage} alt={product.name} onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=300&auto=format&fit=crop' }} />
          {isSale && (
            <span className="sale-badge">
              -{Math.round(((product.price - product.salePrice) / product.price) * 100)}%
            </span>
          )}
          {isOutOfStock && <span className="sold-out-badge">Hết hàng</span>}
          
          <div className="card-hover-actions">
            <button className="hover-action-btn" title="Xem nhanh" onClick={(e) => { e.preventDefault(); onQuickView(); }}>
              <Eye size={20} />
            </button>
          </div>
        </div>

        <div className="product-info-box">
          <span className="prod-category">{product.categoryName}</span>
          <h3 className="prod-title">{product.name}</h3>
          
          <div className="prod-price-row">
            {isSale ? (
              <>
                <span className="prod-sale-price">{product.salePrice.toLocaleString()}đ</span>
                <span className="prod-original-price">{product.price.toLocaleString()}đ</span>
              </>
            ) : (
              <span className="prod-normal-price">{product.price.toLocaleString()}đ</span>
            )}
          </div>
        </div>
      </Link>

      <div className="card-footer-action">
        {!isOutOfStock ? (
          <button className="btn btn-primary quick-buy-btn" onClick={onAddToCart}>
            <ShoppingCart size={16} /> Thêm giỏ hàng
          </button>
        ) : (
          <button className="btn btn-outline quick-buy-btn" disabled>Hết hàng</button>
        )}
      </div>

      {successMsg && <div className="card-alert card-success">{successMsg}</div>}
      {errorMsg && <div className="card-alert card-error">{errorMsg}</div>}
    </div>
  )
}

export default Home
