import React, { useState, useContext } from 'react'
import { X, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react'
import { CartContext } from '../contexts/CartContext'
import { AuthContext } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import './ProductModal.css'

const ProductModal = ({ product, onClose }) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { addToCart } = useContext(CartContext)
  const { isAuthenticated } = useContext(AuthContext)
  const navigate = useNavigate()

  if (!product) return null

  const images = [product.mainImage]
  if (product.images && product.images.length > 0) {
    product.images.forEach(img => {
      if (img !== product.mainImage) images.push(img)
    })
  }

  const handleNextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % images.length)
  }

  const handlePrevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const handleAddToCart = async () => {
    setError('')
    setSuccess('')
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    try {
      await addToCart(product.id, quantity)
      setSuccess('Đã thêm sản phẩm vào giỏ hàng thành công!')
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      setError(err)
    }
  }

  const isOutOfStock = product.currentStock <= 0
  const isSale = product.salePrice != null

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass">
        <button className="modal-close" onClick={onClose}>
          <X size={24} />
        </button>
        
        <div className="modal-grid">
          <div className="modal-gallery">
            <div className="main-image-container">
              <img src={images[activeImageIndex]} alt={product.name} className="modal-main-image" />
              {images.length > 1 && (
                <>
                  <button className="slider-btn prev-btn" onClick={handlePrevImage}>
                    <ChevronLeft size={24} />
                  </button>
                  <button className="slider-btn next-btn" onClick={handleNextImage}>
                    <ChevronRight size={24} />
                  </button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="thumbnails-container">
                {images.map((img, index) => (
                  <img
                    key={index}
                    src={img}
                    alt=""
                    className={`thumbnail ${index === activeImageIndex ? 'active' : ''}`}
                    onClick={() => setActiveImageIndex(index)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="modal-details">
            <span className="modal-category">{product.categoryName}</span>
            <h2 className="modal-title">{product.name}</h2>
            <span className="modal-brand">Thương hiệu: <strong>{product.brandName}</strong></span>
            
            <div className="modal-price-box">
              {isSale ? (
                <>
                  <span className="sale-price">{product.salePrice.toLocaleString()}đ</span>
                  <span className="original-price">{product.price.toLocaleString()}đ</span>
                  <span className="discount-tag">
                    -{Math.round(((product.price - product.salePrice) / product.price) * 100)}%
                  </span>
                </>
              ) : (
                <span className="normal-price">{product.price.toLocaleString()}đ</span>
              )}
            </div>

            <p className="modal-desc">{product.description || 'Chưa có mô tả chi tiết cho sản phẩm này.'}</p>

            <div className="stock-info">
              Trạng thái: 
              {isOutOfStock ? (
                <span className="out-of-stock"> Hết hàng</span>
              ) : (
                <span className="in-stock"> Còn hàng ({product.currentStock} sản phẩm có sẵn)</span>
              )}
            </div>

            {!isOutOfStock && (
              <div className="modal-actions">
                <div className="quantity-selector">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))}>-</button>
                  <span>{quantity}</span>
                  <button onClick={() => setQuantity(q => Math.min(product.currentStock, q + 1))}>+</button>
                </div>
                
                <button className="btn btn-primary add-to-cart-btn" onClick={handleAddToCart}>
                  <ShoppingCart size={18} /> Thêm vào giỏ
                </button>
              </div>
            )}

            {error && <div className="modal-error">{error}</div>}
            {success && <div className="modal-success">{success}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductModal
