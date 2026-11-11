import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { 
  Layers, RefreshCw, AlertTriangle, CheckCircle2, Clock, 
  Play, Pause, ExternalLink, RotateCcw, Search, Cpu, Database
} from 'lucide-react'
import './AdminPages.css'

const QueueManager = () => {
  const [summary, setSummary] = useState({
    streamLength: 0,
    deadLetterLength: 0,
    retryLength: 0,
    isPaused: false,
    status: 'UNKNOWN',
    dbPendingCount: 0,
    dbProcessingCount: 0,
    dbSucceededCount: 0,
    dbFailedCount: 0,
    valkeyAdminUrl: 'http://localhost:8085'
  })
  const [jobs, setJobs] = useState([])
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [actionMessage, setActionMessage] = useState('')

  const fetchSummary = async () => {
    try {
      const res = await api.get('/api/admin/queue/summary')
      setSummary(res.data)
    } catch (err) {
      console.warn('Lỗi khi lấy thông số hàng đợi:', err)
    }
  }

  const fetchJobs = async (page = 0) => {
    try {
      setLoading(true)
      const res = await api.get('/api/admin/queue/jobs', {
        params: {
          status: statusFilter === 'ALL' ? '' : statusFilter,
          page: page,
          size: 15
        }
      })
      setJobs(res.data.content || [])
      setTotalPages(res.data.totalPages || 0)
      setCurrentPage(res.data.number || 0)
    } catch (err) {
      console.error('Lỗi khi tải danh sách Job:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
    fetchJobs(0)
  }, [statusFilter])

  // Polling tự động làm mới mỗi 3 giây nếu bật autoRefresh
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchSummary()
      fetchJobs(currentPage)
    }, 3000)
    return () => clearInterval(interval)
  }, [autoRefresh, currentPage, statusFilter])

  const handleTogglePause = async () => {
    try {
      const res = await api.post('/api/admin/queue/toggle-pause')
      setSummary(prev => ({ ...prev, isPaused: res.data.isPaused }))
      setActionMessage(res.data.message)
      setTimeout(() => setActionMessage(''), 4000)
    } catch (err) {
      alert('Không thể thay đổi trạng thái Worker: ' + err.message)
    }
  }

  const handleSimulateFailure = async () => {
    try {
      const res = await api.post('/api/admin/queue/simulate-failure')
      setActionMessage(res.data.message)
      setTimeout(() => setActionMessage(''), 5000)
      fetchSummary()
      fetchJobs(0)
    } catch (err) {
      alert('Không thể tạo Job lỗi thử nghiệm: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleRetryJob = async (jobId) => {
    try {
      const res = await api.post(`/api/admin/queue/jobs/${jobId}/retry`)
      setActionMessage(res.data.message)
      setTimeout(() => setActionMessage(''), 4000)
      fetchSummary()
      fetchJobs(currentPage)
    } catch (err) {
      alert('Không thể thử lại Job: ' + err.message)
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="status-badge" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>⏳ Đang chờ</span>
      case 'PROCESSING':
        return <span className="status-badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>⚙️ Đang xử lý</span>
      case 'WAITING_PAYMENT':
        return <span className="status-badge" style={{ backgroundColor: '#ede9fe', color: '#6d28d9' }}>🕒 Chờ thanh toán (80%)</span>
      case 'SUCCEEDED':
        return <span className="status-badge" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>✅ Thành công</span>
      case 'FAILED':
      case 'FAILED_DLQ':
        return <span className="status-badge" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>❌ Thất bại / DLQ</span>
      case 'RETRYING':
        return <span className="status-badge" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce' }}>🔄 Đang hẹn giờ thử lại</span>
      default:
        return <span className="status-badge">{status}</span>
    }
  }

  const filteredJobs = jobs.filter(j => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      (j.jobId && j.jobId.toLowerCase().includes(term)) ||
      (j.order && String(j.order.id).includes(term)) ||
      (j.errorMessage && j.errorMessage.toLowerCase().includes(term))
    )
  })

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers className="text-primary" size={28} />
            Hàng Đợi Xử Lý Valkey & Transactional Outbox
          </h1>
          <p className="page-subtitle">
            Giám sát thời gian thực luồng phân phối đơn hàng bất đồng bộ, chống tranh chấp tồn kho và phục hồi lỗi tự động
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', background: '#f1f5f9', padding: '6px 12px', borderRadius: 8 }}>
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={e => setAutoRefresh(e.target.checked)} 
            />
            <span>Tự động cập nhật (3s)</span>
          </label>

          <button 
            onClick={() => { fetchSummary(); fetchJobs(currentPage); }}
            className="btn btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={16} /> Làm mới
          </button>

          <button 
            onClick={handleTogglePause}
            className={`btn ${summary.isPaused ? 'btn-success' : 'btn-warning'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {summary.isPaused ? <Play size={16} /> : <Pause size={16} />}
            {summary.isPaused ? 'Tiếp tục nhận đơn' : 'Tạm dừng Worker'}
          </button>

          <button 
            onClick={handleSimulateFailure}
            className="btn btn-outline" 
            style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: '#ef4444', color: '#dc2626', background: '#fff' }}
            title="Tạo giả lập 1 Job lỗi đưa vào Dead Letter Queue (DLQ) để kiểm thử"
          >
            <AlertTriangle size={16} /> 🧪 Test Tạo Lỗi (DLQ)
          </button>

          <a 
            href={summary.valkeyAdminUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
          >
            <ExternalLink size={16} /> Mở Valkey Admin GUI
          </a>
        </div>
      </div>

      {actionMessage && (
        <div style={{ background: '#ecfdf5', color: '#065f46', padding: '10px 16px', borderRadius: 8, marginBottom: 16, border: '1px solid #a7f3d0' }}>
          ℹ️ {actionMessage}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 18, borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
            <span>Stream Đang Chờ</span>
            <Database size={20} color="#3b82f6" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 'bold', marginTop: 8, color: '#1e293b' }}>
            {summary.streamLength} <span style={{ fontSize: 13, fontWeight: 'normal', color: '#64748b' }}>tin nhắn</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            SQL DB Pending: <strong>{summary.dbPendingCount}</strong>
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid #0284c7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
            <span>Đang Xử Lý (Active)</span>
            <Cpu size={20} color="#0284c7" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 'bold', marginTop: 8, color: '#0284c7' }}>
            {summary.dbProcessingCount}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Trạng thái Worker: <strong style={{ color: summary.isPaused ? '#dc2626' : '#16a34a' }}>{summary.isPaused ? 'TẠM DỪNG' : 'ĐANG CHẠY'}</strong>
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
            <span>Chờ Thanh Toán (30s)</span>
            <Clock size={20} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 'bold', marginTop: 8, color: '#8b5cf6' }}>
            {summary.paymentExpiryLength ?? summary.dbWaitingPaymentCount ?? 0} <span style={{ fontSize: 13, fontWeight: 'normal', color: '#64748b' }}>đơn</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Đếm ngược TTL 30 giây
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
            <span>Lỗi / DLQ (Dead Letter)</span>
            <AlertTriangle size={20} color="#ef4444" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 'bold', marginTop: 8, color: '#ef4444' }}>
            {summary.deadLetterLength} <span style={{ fontSize: 13, fontWeight: 'normal', color: '#64748b' }}>trong DLQ</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            DB Failed: <strong>{summary.dbFailedCount}</strong>
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid #22c55e' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
            <span>Đã Xong Thành Công</span>
            <CheckCircle2 size={20} color="#22c55e" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 'bold', marginTop: 8, color: '#22c55e' }}>
            {summary.dbSucceededCount}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Kết nối Valkey: <strong style={{ color: summary.status === 'CONNECTED' ? '#16a34a' : '#ea580c' }}>{summary.status}</strong>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['ALL', 'PENDING', 'PROCESSING', 'WAITING_PAYMENT', 'SUCCEEDED', 'FAILED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`btn ${statusFilter === st ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '6px 14px', fontSize: 13 }}
            >
              {st === 'ALL' ? 'Tất cả' : st === 'WAITING_PAYMENT' ? '🕒 Chờ thanh toán' : st}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Tìm theo Mã Job / Mã Đơn..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: 34, paddingRight: 10, height: 36, borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '12px 16px' }}>Mã Job</th>
              <th style={{ padding: '12px 16px' }}>Đơn hàng</th>
              <th style={{ padding: '12px 16px' }}>Tác vụ</th>
              <th style={{ padding: '12px 16px' }}>Trạng thái</th>
              <th style={{ padding: '12px 16px' }}>Thử lại</th>
              <th style={{ padding: '12px 16px' }}>Lỗi ghi nhận</th>
              <th style={{ padding: '12px 16px' }}>Thời gian tạo</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && filteredJobs.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                  Đang tải dữ liệu hàng đợi...
                </td>
              </tr>
            ) : filteredJobs.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                  Không có Job nào phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              filteredJobs.map(job => (
                <tr key={job.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>
                    {job.jobId}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {job.order ? (
                      <span style={{ fontWeight: 600 }}>#{job.order.id}</span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 12, background: '#f1f5f9', padding: '3px 8px', borderRadius: 4 }}>
                      {job.jobType}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {getStatusBadge(job.status)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {job.retryCount} / {job.maxRetries}
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: 260, fontSize: 12, color: '#dc2626' }}>
                    {job.errorMessage ? (
                      <span title={job.errorMessage}>
                        {job.errorMessage.length > 60 ? job.errorMessage.substring(0, 60) + '...' : job.errorMessage}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>
                    {job.createdAt ? new Date(job.createdAt).toLocaleString('vi-VN') : '-'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {(job.status === 'FAILED' || job.status === 'RETRYING') && (
                      <button
                        onClick={() => handleRetryJob(job.jobId)}
                        className="btn btn-sm btn-outline"
                        title="Thử lại Job này"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 12 }}
                      >
                        <RotateCcw size={14} /> Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button 
            disabled={currentPage === 0}
            onClick={() => fetchJobs(currentPage - 1)}
            className="btn btn-secondary btn-sm"
          >
            Trang trước
          </button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: '#64748b' }}>
            Trang {currentPage + 1} / {totalPages}
          </span>
          <button 
            disabled={currentPage >= totalPages - 1}
            onClick={() => fetchJobs(currentPage + 1)}
            className="btn btn-secondary btn-sm"
          >
            Trang sau
          </button>
        </div>
      )}
    </div>
  )
}

export default QueueManager
