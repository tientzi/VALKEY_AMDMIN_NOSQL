import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { 
  BarChart3, TrendingUp, ShoppingBag, Users, PackageCheck, 
  Printer, Download, RefreshCw, DollarSign, Award, Truck,
  Calendar, CheckCircle2, AlertCircle, Filter, MapPin, CreditCard, ShieldAlert
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts'
import './AdminPages.css'

const ReportManager = () => {
  const [data, setData] = useState(null)
  const [expiredData, setExpiredData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('30days')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchReportData(range, startDate, endDate)
  }, [range])

  const fetchReportData = async (filterRange = range, start = startDate, end = endDate) => {
    setLoading(true)
    try {
      const params = { range: filterRange }
      if (filterRange === 'custom') {
        if (start) params.startDate = start
        if (end) params.endDate = end
      }
      const [res, expRes] = await Promise.all([
        api.get('/api/admin/reports/overview', { params }),
        api.get('/api/admin/reports/expired-batches')
      ])
      setData(res.data)
      setExpiredData(expRes.data)
    } catch (err) {
      console.error('Lỗi khi tải báo cáo thống kê:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyCustomFilter = (e) => {
    e.preventDefault()
    fetchReportData('custom', startDate, endDate)
  }

  // Format số tiền
  const formatCurrency = (val) => {
    return (val || 0).toLocaleString('vi-VN') + 'đ'
  }

  const handleExportCSV = () => {
    if (!data) return
    const rows = [
      ['Thoi Gian / Ngay', 'Doanh Thu (VND)', 'So Don'],
      ...(data.monthlyRevenues || []).map(m => [m.month, m.revenue, m.orderCount]),
      [],
      ['Top San Pham Ban Chay', 'So Luong Da Ban', 'Doanh Thu'],
      ...(data.topSellingProducts || []).map(p => [`"${p.productName}"`, p.quantity, p.revenue]),
      [],
      ['Shipper', 'Khu Vuc Quan', 'So Don Thanh Cong', 'So Don That Bai', 'Ty Le Thanh Cong (%)', 'Tien COD Da Thu'],
      ...(data.shipperPerformance || []).map(s => [`"${s.shipperName}"`, `"${s.district || ''}"`, s.deliveredCount, s.failedCount, `${s.successRate}%`, s.codCollected]),
      [],
      ['Lo Hang Qua Han / Xuat Huy', 'San Pham', 'SKU', 'HSD', 'So Luong', 'Don Gia Von', 'Ton That Von', 'Trang Thai'],
      ...(expiredData?.batches || []).map(b => [`"${b.batchName || b.id}"`, `"${b.productName}"`, `"${b.productSku || ''}"`, b.expiryDate || '', b.quantity || 0, b.importPrice || 0, (b.quantity || 0) * (b.importPrice || 0), b.status || 'EXPIRED'])
    ]

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `bao_cao_thong_ke_${range}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const monthlyRevenues = data?.monthlyRevenues || []
  const orderStatusDistribution = data?.orderStatusDistribution || []
  const paymentMethodDistribution = data?.paymentMethodDistribution || []
  const topSellingProducts = data?.topSellingProducts || []
  const shipperPerformance = data?.shipperPerformance || []

  return (
    <div className="admin-page" id="report-page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>Báo Cáo Tổng Quan</h2>
          <p className="subtitle">
            Hệ thống phân tích chuyên sâu hiệu quả kinh doanh, cơ cấu đơn hàng và điều phối giao hàng (Tân Phú, Tân Bình, Quận 12)
          </p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => fetchReportData(range, startDate, endDate)} 
            className="btn btn-outline" 
            title="Làm mới dữ liệu"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} /> Làm mới
          </button>
          <button onClick={handleExportCSV} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={18} /> Xuất CSV
          </button>
          <button onClick={() => window.print()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Printer size={18} /> In Báo Cáo
          </button>
        </div>
      </div>

      {/* FILTER BAR - BỘ LỌC THỜI GIAN ĐA DẠNG */}
      <div className="no-print" style={{ 
        background: 'white', 
        padding: '16px 20px', 
        borderRadius: '16px', 
        border: '1px solid #e2e8f0', 
        marginBottom: '24px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          {/* Quick presets */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginRight: '4px' }}>
              <Filter size={16} color="#ff5722" /> Kỳ báo cáo:
            </span>

            {[
              { id: '30days', label: '30 ngày qua (Mặc định)' },
              { id: 'today', label: 'Hôm nay' },
              { id: '7days', label: '7 ngày qua' },
              { id: 'thisMonth', label: 'Tháng này' },
              { id: 'thisYear', label: 'Năm nay' },
              { id: 'all', label: 'Tất cả (6 tháng)' },
              { id: 'custom', label: 'Tùy chọn ngày...' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setRange(item.id)}
                className={`btn ${range === item.id ? 'btn-primary' : 'btn-outline'}`}
                style={{ 
                  padding: '6px 14px', 
                  fontSize: '0.85rem', 
                  borderRadius: '20px',
                  fontWeight: range === item.id ? 700 : 500
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          {range === 'custom' && (
            <form onSubmit={handleApplyCustomFilter} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Từ:</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Đến:</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem', borderRadius: '8px' }}>
                Áp dụng
              </button>
            </form>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '12px', color: '#64748b' }}>Đang tổng hợp dữ liệu phân tích doanh thu...</p>
        </div>
      ) : (
        <>
          {/* 4 Stat Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '28px' }}>
            <div style={{ background: 'white', padding: '24px', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Tổng Doanh Thu</span>
                <div style={{ background: '#ecfdf5', color: '#10b981', padding: '8px', borderRadius: '12px' }}>
                  <DollarSign size={22} />
                </div>
              </div>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                {formatCurrency(data?.totalRevenue)}
              </h3>
            </div>

            <div style={{ background: 'white', padding: '24px', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Tổng Đơn Hàng</span>
                <div style={{ background: '#eff6ff', color: '#3b82f6', padding: '8px', borderRadius: '12px' }}>
                  <ShoppingBag size={22} />
                </div>
              </div>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                {(data?.totalOrders || 0).toLocaleString()} <small style={{ fontSize: '1rem', fontWeight: 500 }}>đơn</small>
              </h3>
            </div>

            <div style={{ background: 'white', padding: '24px', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Sản Phẩm Đã Bán</span>
                <div style={{ background: '#fef3c7', color: '#f59e0b', padding: '8px', borderRadius: '12px' }}>
                  <PackageCheck size={22} />
                </div>
              </div>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                {(data?.totalProductsSold || 0).toLocaleString()} <small style={{ fontSize: '1rem', fontWeight: 500 }}>món</small>
              </h3>
            </div>

            <div style={{ background: 'white', padding: '24px', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Khách Hàng Đăng Ký</span>
                <div style={{ background: '#fdf2f8', color: '#ec4899', padding: '8px', borderRadius: '12px' }}>
                  <Users size={22} />
                </div>
              </div>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                {(data?.totalCustomers || 0).toLocaleString()} <small style={{ fontSize: '1rem', fontWeight: 500 }}>người</small>
              </h3>
            </div>

            <div style={{ background: '#fff5f5', padding: '24px', borderRadius: '18px', border: '1px solid #fecaca', boxShadow: '0 4px 15px rgba(220,38,38,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ color: '#991b1b', fontSize: '0.9rem', fontWeight: 600 }}>Tổn Thất Quá Hạn</span>
                <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px', borderRadius: '12px' }}>
                  <ShieldAlert size={22} />
                </div>
              </div>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#dc2626', margin: 0 }}>
                {formatCurrency(expiredData?.totalLossAmount)}
              </h3>
              <small style={{ color: '#991b1b', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                {expiredData?.totalExpiredQuantity || 0} món ({expiredData?.totalExpiredBatches || 0} lô quá hạn)
              </small>
            </div>
          </div>

          {/* BIỂU ĐỒ DOANH THU & XU HƯỚNG */}
          <div style={{ background: 'white', padding: '28px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>Xu Hướng Tăng Trưởng Doanh Thu</h3>
              </div>
              <span style={{ background: '#f1f5f9', color: '#334155', padding: '6px 14px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700 }}>
                Đơn vị: VNĐ
              </span>
            </div>

            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyRevenues} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff5722" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ff5722" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}Tr` : `${(val / 1000).toFixed(0)}k`} 
                  />
                  <Tooltip 
                    formatter={(val) => [formatCurrency(val), 'Doanh thu']}
                    labelFormatter={(label) => `Mốc thời gian: ${label}`}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#ff5722" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2 BIỂU ĐỒ TRÒN HIỆN ĐẠI: CƠ CẤU ĐƠN HÀNG & PHƯƠNG THỨC THANH TOÁN */}
          {(() => {
            const totalStatusCount = orderStatusDistribution.reduce((acc, cur) => acc + (cur.count || 0), 0)
            const totalPayCount = paymentMethodDistribution.reduce((acc, cur) => acc + (cur.value || 0), 0)

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px', marginBottom: '28px' }}>
                {/* Pie 1: Trạng thái đơn */}
                <div style={{ 
                  background: '#ffffff', 
                  padding: '24px', 
                  borderRadius: '20px', 
                  border: '1px solid #e2e8f0', 
                  boxShadow: '0 10px 25px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'inline-flex', padding: '6px', background: '#ecfdf5', borderRadius: '10px', color: '#10b981' }}>
                        <CheckCircle2 size={18} />
                      </span>
                      Cơ Cấu Trạng Thái Đơn Hàng
                    </h3>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '5px 12px', borderRadius: '20px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                      Tổng: {totalStatusCount} đơn
                    </span>
                  </div>

                  {/* Chart container with solid Pie chart */}
                  <div style={{ position: 'relative', width: '100%', height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={orderStatusDistribution}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={115}
                          innerRadius={0}
                          stroke="#ffffff"
                          strokeWidth={2}
                        >
                          {orderStatusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload
                              const pct = totalStatusCount > 0 ? ((item.count / totalStatusCount) * 100).toFixed(1) : 0
                              return (
                                <div style={{
                                  background: 'rgba(15, 23, 42, 0.95)',
                                  color: 'white',
                                  padding: '10px 14px',
                                  borderRadius: '10px',
                                  boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                                  fontSize: '13px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }}></span>
                                    <strong style={{ color: '#ffffff' }}>{item.name}</strong>
                                  </div>
                                  <div style={{ color: '#cbd5e1' }}>
                                    Số lượng: <strong style={{ color: '#38bdf8' }}>{item.count} đơn</strong> ({pct}%)
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pie 2: Phương thức thanh toán */}
                <div style={{ 
                  background: '#ffffff', 
                  padding: '24px', 
                  borderRadius: '20px', 
                  border: '1px solid #e2e8f0', 
                  boxShadow: '0 10px 25px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'inline-flex', padding: '6px', background: '#e0f2fe', borderRadius: '10px', color: '#0284c7' }}>
                        <CreditCard size={18} />
                      </span>
                      Tỷ Trọng Phương Thức Thanh Toán
                    </h3>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '5px 12px', borderRadius: '20px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                      Tổng: {totalPayCount} giao dịch
                    </span>
                  </div>

                  {/* Chart container with solid Pie chart */}
                  <div style={{ position: 'relative', width: '100%', height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentMethodDistribution}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={115}
                          innerRadius={0}
                          stroke="#ffffff"
                          strokeWidth={2}
                        >
                          {paymentMethodDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload
                              const pct = totalPayCount > 0 ? ((item.value / totalPayCount) * 100).toFixed(1) : 0
                              return (
                                <div style={{
                                  background: 'rgba(15, 23, 42, 0.95)',
                                  color: 'white',
                                  padding: '10px 14px',
                                  borderRadius: '10px',
                                  boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                                  fontSize: '13px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }}></span>
                                    <strong style={{ color: '#ffffff' }}>{item.name}</strong>
                                  </div>
                                  <div style={{ color: '#cbd5e1' }}>
                                    Giao dịch: <strong style={{ color: '#38bdf8' }}>{item.value} lượt</strong> ({pct}%)
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* BẢNG TOP 10 SẢN PHẨM & HIỆU SUẤT SHIPPER THEO 3 QUẬN */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
            {/* Top 10 sản phẩm */}
            <div style={{ background: 'white', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={20} color="#f59e0b" /> Top 10 Sản Phẩm Bán Chạy Nhất
              </h3>
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Hạng</th>
                      <th>Tên Sản Phẩm</th>
                      <th style={{ textAlign: 'center' }}>Đã Bán</th>
                      <th style={{ textAlign: 'right' }}>Doanh Thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSellingProducts.map((p, idx) => (
                      <tr key={idx}>
                        <td>
                          <span style={{ 
                            fontWeight: 800, 
                            color: idx === 0 ? '#f59e0b' : (idx === 1 ? '#64748b' : (idx === 2 ? '#b45309' : '#94a3b8')) 
                          }}>
                            #{idx + 1}
                          </span>
                        </td>
                        <td><strong>{p.productName}</strong></td>
                        <td style={{ textAlign: 'center' }}><span style={{ color: '#0284c7', fontWeight: 700 }}>{p.quantity}</span></td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(p.revenue)}</td>
                      </tr>
                    ))}
                    {topSellingProducts.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
                          Chưa có sản phẩm nào bán ra trong kỳ lọc này
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Hiệu suất shipper theo 3 quận TP.HCM */}
            <div style={{ background: 'white', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={20} color="#ff5722" /> Đội Ngũ Giao Hàng (3 Quận TP.HCM)
              </h3>
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Shipper & Khu vực</th>
                      <th style={{ textAlign: 'center' }}>Đã Giao</th>
                      <th style={{ textAlign: 'center' }}>Thất Bại</th>
                      <th style={{ textAlign: 'center' }}>Tỷ lệ</th>
                      <th style={{ textAlign: 'right' }}>Tiền COD Đã Thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipperPerformance.map((s, idx) => (
                      <tr key={idx}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{s.shipperName}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <span style={{ 
                              background: '#eff6ff', 
                              color: '#1d4ed8', 
                              padding: '2px 8px', 
                              borderRadius: '6px', 
                              fontSize: '0.75rem', 
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}>
                              <MapPin size={11} /> {s.district || 'TP.HCM'}
                            </span>
                            <small style={{ color: '#64748b' }}>• {s.phone}</small>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <strong style={{ color: '#16a34a' }}>{s.deliveredCount}</strong>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>/{s.assignedCount || s.deliveredCount + s.failedCount}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ color: s.failedCount > 0 ? '#dc2626' : '#94a3b8', fontWeight: s.failedCount > 0 ? 700 : 400 }}>
                            {s.failedCount}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ 
                            fontWeight: 700, 
                            color: s.successRate >= 90 ? '#16a34a' : (s.successRate >= 70 ? '#f59e0b' : '#dc2626') 
                          }}>
                            {s.successRate}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <strong style={{ color: '#ea580c' }}>{formatCurrency(s.codCollected)}</strong>
                        </td>
                      </tr>
                    ))}
                    {shipperPerformance.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
                          Chưa có dữ liệu giao hàng trong kỳ lọc này
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* BẢNG CHI TIẾT LÔ HÀNG QUÁ HẠN & THẤT THOÁT VỐN */}
          <div style={{ background: 'white', padding: '24px', borderRadius: '20px', border: '1px solid #fecaca', boxShadow: '0 4px 15px rgba(220,38,38,0.05)', marginTop: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#991b1b', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={22} color="#dc2626" /> Báo Cáo Chi Tiết Tổn Thất Do Hàng Quá Hạn & Xuất Hủy
                </h3>
                <small style={{ color: '#64748b', marginTop: '2px', display: 'block' }}>
                  Tổng hợp các lô hàng đã quá hạn sử dụng hoặc đã được xuất hủy khỏi kho để tính toán số vốn bị thất thoát.
                </small>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ background: '#fee2e2', color: '#dc2626', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 800, border: '1px solid #fca5a5' }}>
                  Tổng tổn thất: {formatCurrency(expiredData?.totalLossAmount)}
                </span>
              </div>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>STT</th>
                    <th>Lô hàng</th>
                    <th>Sản phẩm</th>
                    <th>Mã SKU</th>
                    <th>Hạn sử dụng</th>
                    <th style={{ textAlign: 'center' }}>Số lượng</th>
                    <th style={{ textAlign: 'right' }}>Giá vốn (VND)</th>
                    <th style={{ textAlign: 'right' }}>Tổn thất vốn (VND)</th>
                    <th style={{ textAlign: 'center' }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {(expiredData?.batches || []).map((b, idx) => {
                    const isDisposed = b.status === 'DISPOSED'
                    const loss = (b.quantity || 0) * (b.importPrice || 0)
                    return (
                      <tr key={b.id || idx}>
                        <td style={{ color: '#94a3b8' }}>#{idx + 1}</td>
                        <td><strong>{b.batchName || `Lô #${b.id}`}</strong></td>
                        <td>{b.productName}</td>
                        <td><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>{b.productSku || 'N/A'}</code></td>
                        <td>
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>{b.expiryDate}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <strong style={{ color: isDisposed ? '#64748b' : '#dc2626' }}>
                            {b.quantity}
                          </strong>
                        </td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(b.importPrice)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <strong style={{ color: '#dc2626' }}>{formatCurrency(loss)}</strong>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isDisposed ? (
                            <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                              Đã xuất hủy
                            </span>
                          ) : (
                            <span style={{ background: '#fee2e2', color: '#dc2626', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                              Quá hạn tồn kho
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {(!expiredData?.batches || expiredData.batches.length === 0) && (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', color: '#16a34a', padding: '24px', fontWeight: 600 }}>
                        🎉 Siêu thị không có lô hàng nào quá hạn sử dụng. Quản lý kho hàng rất tốt!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          #report-page-container {
            padding: 0 !important;
            background: white !important;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinning {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}

export default ReportManager
