import React, { useState, useEffect, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { CartContext } from '../contexts/CartContext'
import { AuthContext } from '../contexts/AuthContext'
import { ShoppingCart, Star, MessageSquare, Sparkles, Flame } from 'lucide-react'
import './ProductDetail.css'

const ProductDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [reviews, setReviews] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState('')
  const [quantity, setQuantity] = useState(1)

  const { addToCart } = useContext(CartContext)
  const { isAuthenticated, user } = useContext(AuthContext)

  // Review states
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [cartSuccess, setCartSuccess] = useState('')
  const [cartError, setCartError] = useState('')

  const fetchProductData = async () => {
    try {
      const [prodRes, revRes, recRes] = await Promise.all([
        api.get(`/api/public/products/${id}`),
        api.get(`/api/public/products/${id}/reviews`),
        api.get(`/api/public/products/${id}/recommendations?limit=4`).catch(() => ({ data: [] }))
      ])
      setProduct(prodRes.data)
      setReviews(revRes.data)
      setRecommendations(recRes.data || [])
      setActiveImage(prodRes.data.mainImage)
    } catch (err) {
      console.error('Không tìm thấy thông tin sản phẩm', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProductData()
  }, [id])

  const handleQuickAddRecommended = async (e, recProd) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    try {
      await addToCart(recProd.id, 1)
      setCartSuccess(`Đã thêm "${recProd.name}" vào giỏ hàng!`)
      setTimeout(() => setCartSuccess(''), 2000)
    } catch (err) {
      setCartError(err)
      setTimeout(() => setCartError(''), 3000)
    }
  }

  const handleAddToCart = async () => {
    setCartError('')
    setCartSuccess('')
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    try {
      const isExceed = quantity > product.currentStock
      await addToCart(product.id, quantity, isExceed)
      setCartSuccess(isExceed ? `Đã thêm ${quantity} sản phẩm (vượt tồn kho) vào giỏ để test Worker!` : 'Đã thêm sản phẩm vào giỏ hàng thành công!')
      setTimeout(() => {
        setCartSuccess('')
      }, 2500)
    } catch (err) {
      setCartError(err)
    }
  }

  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    setReviewError('')
    setReviewSuccess('')
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    try {
      await api.post('/api/reviews', { productId: product.id, rating, comment })
      setReviewSuccess('Đánh giá của bạn đã được gửi thành công và đang chờ Admin duyệt!')
      setComment('')
      setRating(5)
      // Nạp lại data sau khi gửi (mặc định review mới gửi ở dạng isApproved = false nên chưa xuất hiện trong danh sách approved)
    } catch (err) {
      setReviewError(err.response?.data?.error || 'Không thể gửi đánh giá')
    }
  }

  if (loading) {
    return <div className="loading-state">Đang tải chi tiết sản phẩm...</div>
  }

  if (!product) {
    return (
      <div className="empty-products glass">
        <h3>Không tìm thấy sản phẩm!</h3>
        <p>Sản phẩm có thể đã bị xóa hoặc không tồn tại.</p>
        <button onClick={() => navigate('/products')} className="btn btn-primary">Xem sản phẩm khác</button>
      </div>
    )
  }

  const isSale = product.salePrice != null
  const isOutOfStock = product.currentStock <= 0
  const images = [product.mainImage]
  if (product.images && product.images.length > 0) {
    product.images.forEach(img => {
      if (img !== product.mainImage) images.push(img)
    })
  }

  return (
    <div className="product-detail-page">
      {/* Thông tin sản phẩm chính */}
      <section className="detail-container glass">
        {/* Gallery */}
        <div className="detail-gallery">
          <div className="detail-main-img-box">
            <img src={activeImage} alt={product.name} />
          </div>
          {images.length > 1 && (
            <div className="detail-thumbs">
              {images.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt=""
                  className={`detail-thumb ${img === activeImage ? 'active' : ''}`}
                  onClick={() => setActiveImage(img)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Thông tin */}
        <div className="detail-info">
          <span className="detail-cat-name">{product.categoryName}</span>
          <h1 className="detail-title-name">{product.name}</h1>
          
          <div className="detail-meta-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.95rem' }}>
            <div className="detail-brand-name">Thương hiệu: <strong>{product.brandName}</strong></div>
            {product.sku && <div className="detail-sku">SKU: <strong>{product.sku}</strong></div>}
            {product.barcode && <div className="detail-barcode">Barcode: <strong>{product.barcode}</strong></div>}
            <div className="detail-unit">Đơn vị: <strong>{product.unit || 'Cái'}</strong></div>
            {product.weightG > 0 && <div className="detail-weight">Trọng lượng: <strong>{product.weightG}g</strong></div>}
          </div>

          <div className="detail-price-row">
            {isSale ? (
              <>
                <span className="detail-sale-price">{product.salePrice.toLocaleString()}đ</span>
                <span className="detail-original-price">{product.price.toLocaleString()}đ</span>
                <span className="detail-discount">
                  -{Math.round(((product.price - product.salePrice) / product.price) * 100)}%
                </span>
              </>
            ) : (
              <span className="detail-normal-price">{product.price.toLocaleString()}đ</span>
            )}
          </div>

          <div className="detail-stock-status">
            Trạng thái: 
            {isOutOfStock ? (
              <span className="out-of-stock"> Hết hàng</span>
            ) : (
              <span className="in-stock"> Còn hàng ({product.currentStock} sản phẩm sẵn có)</span>
            )}
          </div>

          <p className="detail-desc-text">{product.description || 'Sản phẩm siêu thị mini đảm bảo an toàn chất lượng cho mọi nhà.'}</p>

          {!isOutOfStock && (
            <div className="detail-actions-box" style={{ flexWrap: 'wrap', gap: '10px' }}>
              <div className="quantity-selector">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))}>-</button>
                <span>{quantity}</span>
                <button onClick={() => setQuantity(q => q + 1)}>+</button>
              </div>

              <button className="btn btn-primary detail-cart-btn" onClick={handleAddToCart}>
                <ShoppingCart size={20} /> Thêm vào giỏ hàng
              </button>

              <button
                type="button"
                className="btn btn-outline"
                style={{ borderColor: '#f59e0b', color: '#d97706', padding: '8px 12px', fontSize: '0.85rem' }}
                onClick={() => setQuantity(product.currentStock + 10)}
              >
                🧪 Test vượt kho ({product.currentStock + 10})
              </button>
            </div>
          )}

          {quantity > product.currentStock && (
            <div style={{ marginTop: '8px', color: '#b45309', background: '#fef3c7', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem' }}>
              ⚠️ Số lượng ({quantity}) vượt tồn kho ({product.currentStock}). Đơn hàng sẽ kích hoạt kiểm thử Worker từ chối qua Lua script (Kịch bản 2).
            </div>
          )}

          {cartSuccess && <div className="detail-alert success-alert">{cartSuccess}</div>}
          {cartError && <div className="detail-alert error-alert">{cartError}</div>}
        </div>
      </section>

      {/* Gợi ý sản phẩm thường mua cùng (Thuật toán Apriori) */}
      {recommendations.length > 0 && (
        <section className="recommendations-section glass">
          <div className="section-header-rec">
            <div className="rec-title-wrap">
              <Sparkles className="rec-sparkle-icon" size={22} />
              <h2>Sản phẩm thường mua cùng & Gợi ý cho bạn</h2>
            </div>
            <span className="rec-subtitle">Dựa trên thói quen mua sắm của khách hàng tại MiniMart (Thuật toán Apriori)</span>
          </div>

          <div className="recommendations-grid">
            {recommendations.map((rec) => {
              const p = rec.product
              const isSale = p.salePrice != null
              const percent = isSale ? Math.round(((p.price - p.salePrice) / p.price) * 100) : 0
              return (
                <div
                  key={p.id}
                  className="rec-card"
                  onClick={() => navigate(`/products/${p.id}`)}
                >
                  <div className="rec-badge-container">
                    {rec.reason === 'Thường mua cùng' ? (
                      <span className="rec-badge apriori-badge" title={`Độ nâng (Lift): ${rec.lift || 1}x`}>
                        <Flame size={13} /> Thường mua cùng {rec.confidence ? `• ${Math.round(rec.confidence * 100)}%` : ''}
                      </span>
                    ) : (
                      <span className="rec-badge category-badge">
                        Cùng danh mục
                      </span>
                    )}
                  </div>

                  <div className="rec-img-box">
                    <img
                      src={p.mainImage}
                      alt={p.name}
                      onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=250&auto=format&fit=crop' }}
                    />
                    {isSale && <span className="rec-discount-tag">-{percent}%</span>}
                  </div>

                  <div className="rec-info">
                    <span className="rec-cat-name">{p.categoryName}</span>
                    <h4 className="rec-prod-name" title={p.name}>{p.name}</h4>
                    
                    <div className="rec-price-row">
                      {isSale ? (
                        <>
                          <span className="rec-sale-price">{p.salePrice.toLocaleString()}đ</span>
                          <span className="rec-orig-price">{p.price.toLocaleString()}đ</span>
                        </>
                      ) : (
                        <span className="rec-normal-price">{p.price.toLocaleString()}đ</span>
                      )}
                    </div>

                    <button
                      className="rec-add-btn btn btn-sm btn-outline"
                      onClick={(e) => handleQuickAddRecommended(e, p)}
                      title="Thêm vào giỏ"
                    >
                      <ShoppingCart size={14} /> Thêm giỏ hàng
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Đánh giá sản phẩm */}
      <section className="reviews-section glass">
        <h2 className="reviews-title"><MessageSquare size={24} /> Đánh giá & Phản hồi ({reviews.length})</h2>
        
        <div className="reviews-grid">
          {/* List reviews */}
          <div className="reviews-list">
            {reviews.length > 0 ? (
              reviews.map(rev => (
                <div key={rev.id} className="review-item">
                  <div className="review-header">
                    <strong>{rev.userFullName || rev.username}</strong>
                    <div className="review-rating">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={16} fill={i < rev.rating ? 'var(--primary)' : 'none'} stroke={i < rev.rating ? 'var(--primary)' : 'var(--gray-300)'} />
                      ))}
                    </div>
                  </div>
                  <p className="review-comment">{rev.comment}</p>
                  <span className="review-date">{new Date(rev.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
              ))
            ) : (
              <p className="empty-reviews">Sản phẩm này chưa có đánh giá nào. Hãy là người đầu tiên đánh giá!</p>
            )}
          </div>

          {/* Form đánh giá mới */}
          <div className="review-form-container">
            <h3>Viết đánh giá của bạn</h3>
            {isAuthenticated ? (
              <form onSubmit={handleReviewSubmit} className="review-form">
                <div className="form-group">
                  <label>Số sao đánh giá</label>
                  <div className="rating-stars-input">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setRating(star)}
                        className="star-btn"
                      >
                        <Star size={28} fill={star <= rating ? 'var(--primary)' : 'none'} stroke={star <= rating ? 'var(--primary)' : 'var(--gray-400)'} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Nhận xét chi tiết</label>
                  <textarea
                    rows="4"
                    required
                    placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này (chất lượng, hương vị, đóng gói...)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  ></textarea>
                </div>

                <button type="submit" className="btn btn-primary submit-review-btn">Gửi đánh giá</button>
              </form>
            ) : (
              <div className="login-to-review glass">
                <p>Vui lòng đăng nhập để đánh giá sản phẩm này.</p>
                <Link to="/login" className="btn btn-outline">Đăng nhập ngay</Link>
              </div>
            )}

            {reviewSuccess && <div className="review-alert success-alert">{reviewSuccess}</div>}
            {reviewError && <div className="review-alert error-alert">{reviewError}</div>}
          </div>
        </div>
      </section>
    </div>
  )
}

import { Link } from 'react-router-dom'
export default ProductDetail
