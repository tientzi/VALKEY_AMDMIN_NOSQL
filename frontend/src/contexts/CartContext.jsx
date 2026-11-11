import React, { createContext, useState, useEffect, useContext } from 'react'
import api from '../services/api'
import { AuthContext } from './AuthContext'

export const CartContext = createContext()

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState({ items: [] })
  const [loading, setLoading] = useState(false)
  const { isAuthenticated } = useContext(AuthContext)

  const fetchCart = async () => {
    if (!isAuthenticated) return
    setLoading(true)
    try {
      const response = await api.get('/api/cart')
      setCart(response.data)
    } catch (error) {
      console.error('Không thể lấy giỏ hàng', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart()
    } else {
      setCart({ items: [] })
    }
  }, [isAuthenticated])

  const addToCart = async (productId, quantity, allowExceedStock = false) => {
    try {
      const response = await api.post('/api/cart/add', { productId, quantity, allowExceedStock })
      setCart(response.data)
      return response.data
    } catch (error) {
      throw error.response?.data?.error || 'Không thể thêm sản phẩm vào giỏ hàng'
    }
  }

  const updateCartItem = async (productId, quantity, allowExceedStock = false) => {
    try {
      const response = await api.put('/api/cart/update', { productId, quantity, allowExceedStock })
      setCart(response.data)
      return response.data
    } catch (error) {
      throw error.response?.data?.error || 'Không thể cập nhật số lượng'
    }
  }

  const removeCartItem = async (productId) => {
    try {
      const response = await api.delete(`/api/cart/remove/${productId}`)
      setCart(response.data)
      return response.data
    } catch (error) {
      throw error.response?.data?.error || 'Không thể xóa sản phẩm khỏi giỏ hàng'
    }
  }

  const clearCart = () => {
    setCart({ items: [] })
  }

  const totalItemsCount = cart.items ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0
  
  const cartSubtotal = cart.items ? cart.items.reduce((sum, item) => {
    if (item.hasMultiBatch && item.saleBatchQuantity > 0 && item.quantity > item.saleBatchQuantity) {
      const salePart = item.saleBatchQuantity * item.saleBatchPrice
      const regularPart = (item.quantity - item.saleBatchQuantity) * item.productPrice
      return sum + salePart + regularPart
    }
    const price = (item.hasMultiBatch && item.saleBatchPrice != null && item.quantity <= item.saleBatchQuantity)
      ? item.saleBatchPrice
      : (item.productSalePrice != null ? item.productSalePrice : item.productPrice)
    return sum + price * item.quantity
  }, 0) : 0

  return (
    <CartContext.Provider value={{ cart, loading, fetchCart, addToCart, updateCartItem, removeCartItem, clearCart, totalItemsCount, cartSubtotal }}>
      {children}
    </CartContext.Provider>
  )
}
