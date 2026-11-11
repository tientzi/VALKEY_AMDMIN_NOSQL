import React, { useState, useEffect, useContext } from 'react'
import { Link } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'
import api from '../services/api'
import { 
  Award, Crown, Gift, Tag, Copy, Check, Sparkles, ChevronRight, 
  ShieldCheck, Zap, Star, AlertCircle
} from 'lucide-react'
import './Loyalty.css'

const Loyalty = () => {
  const { user } = useContext(AuthContext)
  const [loyaltyData, setLoyaltyData] = useState(null)
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [loyaltyRes, couponsRes] = await Promise.all([
          api.get('/api/users/loyalty-info'),
          api.get('/api/public/coupons')
        ])
        setLoyaltyData(loyaltyRes.data)
        setCoupons(couponsRes.data || [])
      } catch (err) {
        console.error('Lỗi khi tải thông tin loyalty:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(''), 2500)
  }

  const getTierDetails = (tierKey) => {
    switch (tierKey) {
      case 'DIAMOND':
        return {
          name: 'Hạng Kim Cương',
          tierCode: 'DIAMOND',
          icon: <Crown size={26} />,
          badgeColor: '#38bdf8',
          cardTheme: 'theme-diamond',
          discountText: 'Giảm tự động 8% đơn hàng',
          cardBg: 'radial-gradient(ellipse at 85% 20%, rgba(56, 189, 248, 0.18), transparent 70%), linear-gradient(145deg, #090d16 0%, #151f32 100%)'
        }
      case 'GOLD':
        return {
          name: 'Hạng Vàng',
          tierCode: 'GOLD',
          icon: <Award size={26} />,
          badgeColor: '#fbbf24',
          cardTheme: 'theme-gold',
          discountText: 'Giảm tự động 5% đơn hàng',
          cardBg: 'radial-gradient(ellipse at 85% 20%, rgba(245, 158, 11, 0.22), transparent 70%), linear-gradient(145deg, #14120f 0%, #26211a 100%)'
        }
      case 'SILVER':
        return {
          name: 'Hạng Bạc',
          tierCode: 'SILVER',
          icon: <Star size={26} />,
          badgeColor: '#cbd5e1',
          cardTheme: 'theme-silver',
          discountText: 'Giảm 2% đơn hàng',
          cardBg: 'radial-gradient(ellipse at 85% 20%, rgba(148, 163, 184, 0.18), transparent 70%), linear-gradient(145deg, #11151c 0%, #1e2633 100%)'
        }
      default:
        return {
          name: 'Hạng Đồng',
          tierCode: 'BRONZE',
          icon: <ShieldCheck size={26} />,
          badgeColor: '#d97706',
          cardTheme: 'theme-bronze',
          discountText: '1 điểm cho mỗi 1.000đ đã mua',
          cardBg: 'radial-gradient(ellipse at 85% 20%, rgba(217, 119, 6, 0.18), transparent 70%), linear-gradient(145deg, #181512 0%, #271f18 100%)'
        }
    }
  }

  if (loading) {
    return (
      <div className="loyalty-page container">
        <div className="loading-state">
          <div className="spinner-dot"></div>
          <span>Đang tải thông tin khách hàng thân thiết...</span>
        </div>
      </div>
    )
  }

  const currentTier = loyaltyData?.membershipTier || loyaltyData?.currentTier || 'BRONZE'
  const tierInfo = getTierDetails(currentTier)
  const points = loyaltyData?.loyaltyPoints || 0
  const nextTier = loyaltyData?.nextTier
  const pointsToNext = loyaltyData?.pointsToNextTier || 0
  const progress = loyaltyData?.progressPercentage || 0

  return (
    <div className="loyalty-page container">
      {/* Header Banner - Thanh lịch, đơn giản */}
      <div className="loyalty-header">
        <h1>Khách Hàng Thân Thiết</h1>
      </div>

      {/* PHẦN 1: THẺ THÀNH VIÊN & TIẾN ĐỘ THĂNG HẠNG (HỢP NHẤT) */}
      <div className="loyalty-section membership-section">
        <div className={`unified-luxury-card ${tierInfo.cardTheme}`} style={{ background: tierInfo.cardBg }}>
          {/* Header thẻ: Brand & Tier Badge */}
          <div className="unified-card-top">
            <div className="brand-group">
              <span className="brand-name">MINIMART</span>
              <span className="brand-sub">PRIVILEGE MEMBERSHIP PASS</span>
            </div>
            <div className="tier-badge-pill" style={{ borderColor: tierInfo.badgeColor, color: tierInfo.badgeColor }}>
              {tierInfo.icon}
              <span>{tierInfo.name}</span>
            </div>
          </div>

          {/* Body thẻ: Chia làm 2 khu vực thông tin & tiến độ bên trong cùng một thẻ */}
          <div className="unified-card-body">
            {/* Cột 1: Thông tin chủ thẻ, quyền lợi & điểm thưởng */}
            <div className="unified-info-col">
              <div className="unified-meta-item">
                <span className="meta-caption">CHỦ THẺ</span>
                <span className="meta-text">{loyaltyData?.fullName || user?.fullName || 'Khách Hàng'}</span>
              </div>

              <div className="unified-meta-item">
                <span className="meta-caption">ĐẶC QUYỀN HIỆN TẠI</span>
                <span className="privilege-value">{tierInfo.discountText}</span>
              </div>

              <div className="unified-meta-item points-meta-block">
                <span className="meta-caption">ĐIỂM TÍCH LŨY KHẢ DỤNG</span>
                <div className="points-display-row">
                  <span className="points-big">{points.toLocaleString()} <small>PTS</small></span>
                  <span className="conversion-tip">100.000đ = 1 điểm</span>
                </div>
              </div>
            </div>

            {/* Cột 2: Khối tiến độ thăng hạng tích hợp */}
            <div className="unified-progress-col">
              <div className="milestone-box-unified">
                <span className="meta-caption">TIẾN ĐỘ THĂNG HẠNG</span>
                {nextTier ? (
                  <div className="milestone-text">
                    Cần tích lũy thêm <strong>{pointsToNext.toLocaleString()} điểm</strong> để lên hạng <strong>{getTierDetails(nextTier).name}</strong>
                  </div>
                ) : (
                  <div className="milestone-text vip-top">
                    <Crown size={18} /> Chúc mừng! Bạn đang giữ hạng cao nhất <strong>Kim Cương VIP</strong>
                  </div>
                )}
              </div>

              {/* Thanh tiến độ */}
              <div className="progress-track-unified">
                <div className="progress-fill-unified" style={{ width: `${progress}%`, background: tierInfo.badgeColor }}></div>
              </div>

              <div className="progress-meta-row-unified">
                <span className="current-step-unified">{tierInfo.name} ({progress}%)</span>
                {nextTier && <span className="next-step-unified">Mục tiêu: {getTierDetails(nextTier).name}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bảng so sánh 4 hạng thành viên */}
      <div className="tiers-block">
        <div className="block-header">
          <h2 className="block-title">
            <Award size={22} /> Đặc Quyền Từng Hạng Thành Viên
          </h2>
          <p className="block-desc">Mỗi mốc điểm tích lũy mang lại quyền lợi và mức chiết khấu ngày một vượt trội.</p>
        </div>

        <div className="tiers-grid">
          {loyaltyData?.allTiers?.map((t) => {
            const details = getTierDetails(t.tierKey)
            return (
              <div key={t.tierKey} className={`tier-card ${t.isCurrent ? 'is-active' : ''}`}>
                {t.isCurrent && (
                  <div className="active-tag">Hạng của bạn</div>
                )}

                <div className="tier-card-head">
                  <div className="tier-icon-wrap" style={{ color: details.badgeColor }}>
                    {details.icon}
                  </div>
                  <h4>{details.name}</h4>
                  <div className="tier-threshold">Từ {t.minPoints.toLocaleString()} điểm</div>
                </div>

                <div className="tier-card-discount">
                  <span className="discount-label">Chiết khấu:</span>
                  <span className="discount-value">
                    {t.discountPercent > 0 ? `Giảm ${t.discountPercent}%` : 'Tích điểm khi giao thành công'}
                    
                    
                  </span>
                </div>

                <ul className="tier-perks">
                  {t.benefits?.map((b, idx) => (
                    <li key={idx}>
                      <Check size={15} className="check-svg" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* PHẦN 2: KHO MÃ GIẢM GIÁ PUBLIC */}
      <div className="loyalty-section vouchers-section">
        <div className="vouchers-header-row">
          <div>
            <h2 className="block-title">
              <Tag size={22} /> Mã Giảm Giá Đang Phát Hành
            </h2>
            <p className="block-desc">Lưu mã ưu đãi và áp dụng khi thanh toán để hưởng chính sách giảm giá tốt nhất.</p>
          </div>
          <Link to="/products" className="btn-shop-link">
            Mua sắm ngay <ChevronRight size={16} />
          </Link>
        </div>

        {coupons.length > 0 ? (
          <div className="vouchers-grid">
            {coupons.map((c) => {
              const isCopied = copiedCode === c.code
              const isPercentage = c.discountType === 'PERCENTAGE'
              return (
                <div key={c.id} className="voucher-card">
                  {/* Cột trái: Giá trị giảm */}
                  <div className="voucher-left">
                    <span className="voucher-type-tag">VOUCHER</span>
                    <div className="voucher-value-text">
                      {isPercentage ? `${c.discountValue}%` : `${c.discountValue?.toLocaleString()}đ`}
                    </div>
                    <span className="voucher-sub-tag">GIẢM TRỰC TIẾP</span>
                  </div>

                  {/* Đường ngăn cách có vết khuyết (notch) */}
                  <div className="voucher-divider">
                    <div className="notch notch-top"></div>
                    <div className="notch notch-bottom"></div>
                  </div>

                  {/* Cột phải: Thông tin & Nút sao chép */}
                  <div className="voucher-right">
                    <div className="voucher-code-bar">
                      <code className="code-text">{c.code}</code>
                      <button 
                        onClick={() => handleCopyCode(c.code)} 
                        className={`copy-btn ${isCopied ? 'is-copied' : ''}`}
                        title="Sao chép mã"
                      >
                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                        <span>{isCopied ? 'Đã sao chép' : 'Sao chép'}</span>
                      </button>
                    </div>

                    <p className="voucher-info">{c.description || 'Ưu đãi mua sắm thực phẩm sạch tại hệ thống MiniMart'}</p>

                    <div className="voucher-footer">
                      {c.applicableCategoryName && (
                        <span className="condition-item" style={{ color: '#0369a1' }}>
                          Áp dụng: <strong>{c.applicableCategoryName}</strong>
                        </span>
                      )}
                      {c.maxDiscountAmount > 0 && (
                        <span className="condition-item" style={{ color: '#ea580c' }}>
                          Tối đa: <strong>{c.maxDiscountAmount?.toLocaleString()}đ</strong>
                        </span>
                      )}
                      {c.minOrderAmount > 0 && (
                        <span className="condition-item">
                          Đơn tối thiểu: <strong>{c.minOrderAmount?.toLocaleString()}đ</strong>
                        </span>
                      )}
                      <span className="condition-item">
                        HSD: <strong>{c.endDate ? new Date(c.endDate).toLocaleDateString('vi-VN') : 'Vô thời hạn'}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-vouchers">
            <AlertCircle size={32} />
            <p>Hiện tại chưa có mã giảm giá công khai nào. Vui lòng quay lại sau!</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Loyalty
