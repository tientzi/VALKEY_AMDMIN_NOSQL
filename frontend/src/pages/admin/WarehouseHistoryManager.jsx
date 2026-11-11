import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { 
  FileText, ClipboardList, Plus, CheckCircle2, Trash2, Box, Eye, Download, 
  Printer, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, ShieldAlert,
  Calendar, Layers, Filter, Check, X, ShieldCheck, FileCheck2, XCircle, RotateCcw
} from 'lucide-react'
import { exportToCSV, printDocument } from '../../utils/exportUtils'
import './AdminPages.css'

const WarehouseHistoryManager = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = ['ledger', 'qc'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'receipts'
  const [activeTab, setActiveTab] = useState(initialTab)

  // ----------------------------------------------------
  // TAB 3: QUẢN LÝ CHẤT LƯỢNG ĐẦU VÀO (INWARD QC) STATE
  // ----------------------------------------------------
  const [selectedQcReceipt, setSelectedQcReceipt] = useState(null)
  const [qcItems, setQcItems] = useState([])
  const [qcGeneralNote, setQcGeneralNote] = useState('')
  const [qcError, setQcError] = useState('')
  const [qcSubmitting, setQcSubmitting] = useState(false)
  const [qcFilter, setQcFilter] = useState('ALL') // 'ALL' | 'PENDING' | 'COMPLETED'
  const [qcSearch, setQcSearch] = useState('')
  const [viewingQcRecord, setViewingQcRecord] = useState(null)

  // ----------------------------------------------------
  // TAB 1: PHIẾU NHẬP KHO (GOODS RECEIPTS) STATE
  // ----------------------------------------------------
  const [receipts, setReceipts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [brands, setBrands] = useState([])
  const [products, setProducts] = useState([])
  const [receiptLoading, setReceiptLoading] = useState(true)

  // Create Form State
  const [showReceiptForm, setShowReceiptForm] = useState(searchParams.get('action') === 'create')
  const [supplierId, setSupplierId] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState([]) // { brandId, productId, quantity, importPrice, batchName, expiryDate }
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const [receiptError, setReceiptError] = useState('')

  // ----------------------------------------------------
  // TAB 2: SỔ CÁI BIẾN ĐỘNG KHO (INVENTORY LEDGER) STATE
  // ----------------------------------------------------
  const [ledgers, setLedgers] = useState([])
  const [ledgerLoading, setLedgerLoading] = useState(true)
  const [ledgerPage, setLedgerPage] = useState(0)
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1)

  // Sync tab with URL
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  // Fetch Receipts data
  const fetchReceiptData = async () => {
    setReceiptLoading(true)
    try {
      const recRes = await api.get('/api/admin/goods-receipts')
      const supRes = await api.get('/api/admin/suppliers')
      const brandRes = await api.get('/api/admin/brands')
      const prodRes = await api.get('/api/admin/products')
      
      setReceipts(recRes.data.content || recRes.data)
      setSuppliers(supRes.data.filter(s => s.isActive))
      setBrands(brandRes.data.filter(b => b.isActive != null ? b.isActive : true))
      setProducts(prodRes.data)
    } catch (err) {
      console.error('Lỗi khi tải danh sách phiếu nhập kho:', err)
    } finally {
      setReceiptLoading(false)
    }
  }

  // Fetch Ledger data
  const fetchLedgers = async (pageNumber = 0) => {
    setLedgerLoading(true)
    try {
      const response = await api.get(`/api/admin/inventory-ledger?page=${pageNumber}&size=20`)
      setLedgers(response.data.content || response.data)
      setLedgerTotalPages(response.data.totalPages || 1)
    } catch (err) {
      console.error('Không thể lấy lịch sử kho', err)
    } finally {
      setLedgerLoading(false)
    }
  }

  useEffect(() => {
    fetchReceiptData()
    fetchLedgers(0)
  }, [])

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchLedgers(ledgerPage)
    }
  }, [ledgerPage, activeTab])

  // Receipt Handlers
  const handleAddItem = () => {
    setItems([...items, { brandId: '', productId: '', quantity: 1, importPrice: 0, batchName: '', expiryDate: '' }])
  }

  const handleRemoveItem = (index) => {
    const newItems = [...items]
    newItems.splice(index, 1)
    setItems(newItems)
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    if (field === 'brandId' && value) {
      const curProd = products.find(p => String(p.id) === String(newItems[index].productId))
      if (curProd && String(curProd.brandId) !== String(value)) {
        newItems[index].productId = ''
      }
    }
    setItems(newItems)
  }

  const handleSubmitReceipt = async (e) => {
    e.preventDefault()
    setReceiptError('')
    
    if (!supplierId) return setReceiptError('Vui lòng chọn nhà cung cấp')
    if (items.length === 0) return setReceiptError('Cần ít nhất 1 sản phẩm')
    
    for (let i = 0; i < items.length; i++) {
      if (!items[i].productId) return setReceiptError('Vui lòng chọn sản phẩm cho tất cả các dòng')
      if (items[i].quantity <= 0) return setReceiptError('Số lượng phải lớn hơn 0')
      if (items[i].importPrice < 0) return setReceiptError('Giá nhập không được âm')
    }

    try {
      await api.post('/api/admin/goods-receipts', {
        supplierId: Number(supplierId),
        brandId: null,
        note,
        items: items.map(item => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
          importPrice: Number(item.importPrice),
          batchName: item.batchName || null,
          expiryDate: item.expiryDate || null
        }))
      })
      fetchReceiptData()
      handleCloseReceiptForm()
    } catch (err) {
      setReceiptError(err.response?.data?.error || 'Lỗi khi tạo phiếu nhập')
    }
  }

  const handleCompleteReceipt = async (id) => {
    if (!window.confirm('Sau khi hoàn thành, số lượng tồn kho và các lô hàng sẽ được cập nhật. Bạn có chắc chắn?')) return
    try {
      await api.put(`/api/admin/goods-receipts/${id}/complete`)
      fetchReceiptData()
      fetchLedgers(0) // Cập nhật luôn sổ cái
      if (selectedReceipt && selectedReceipt.id === id) setSelectedReceipt(null)
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể hoàn thành phiếu nhập')
    }
  }

  const handleCancelReceipt = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy phiếu nhập nháp này?')) return
    try {
      await api.put(`/api/admin/goods-receipts/${id}/cancel`)
      fetchReceiptData()
      if (selectedReceipt && selectedReceipt.id === id) setSelectedReceipt(null)
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể hủy')
    }
  }

  const handleCloseReceiptForm = () => {
    setShowReceiptForm(false)
    setSupplierId('')
    setNote('')
    setItems([])
    setReceiptError('')
  }

  const handleExportReceiptsCSV = () => {
    const headers = ['Mã PNK', 'Ngày tạo', 'Nhà cung cấp', 'Người tạo', 'Tổng tiền (VND)', 'Trạng thái', 'Ghi chú']
    const rows = receipts.map(r => [
      `PNK-${r.id}`,
      new Date(r.createdAt).toLocaleString('vi-VN'),
      r.supplierName || '',
      r.createdBy || '',
      r.totalAmount || 0,
      r.status === 'COMPLETED' ? 'Hoàn thành' : r.status === 'CANCELLED' ? 'Đã hủy' : 'Bản nháp',
      r.note || ''
    ])
    exportToCSV(`Danh_Sach_Phieu_Nhap_Kho_MiniMart_${new Date().toISOString().slice(0, 10)}`, headers, rows)
  }

  const handlePrintReceipt = () => {
    if (selectedReceipt) {
      printDocument(`Phieu_Nhap_Kho_PNK${selectedReceipt.id}_MiniMart`)
    } else {
      printDocument('Danh_Sach_Phieu_Nhap_Kho_MiniMart')
    }
  }

  // Ledger Helpers
  const getChangeTypeIcon = (type) => {
    switch (type) {
      case 'IMPORT': return <ArrowUpRight size={16} className="text-success" />
      case 'SELL': return <ArrowDownRight size={16} className="text-danger" />
      case 'RETURN': return <ArrowUpRight size={16} className="text-warning" />
      case 'DAMAGE': return <ArrowDownRight size={16} className="text-danger" />
      case 'EXPIRED_DISPOSAL': return <ShieldAlert size={16} style={{ color: '#dc2626' }} />
      case 'MANUAL_ADJUST': return <RefreshCw size={16} className="text-info" />
      default: return <AlertCircle size={16} />
    }
  }

  const getChangeTypeLabel = (type) => {
    switch (type) {
      case 'IMPORT': return 'Nhập kho'
      case 'SELL': return 'Bán hàng'
      case 'RETURN': return 'Khách hoàn trả'
      case 'DAMAGE': return 'Báo hỏng'
      case 'EXPIRED_DISPOSAL': return 'Xuất hủy quá hạn'
      case 'MANUAL_ADJUST': return 'Điều chỉnh thủ công'
      default: return type
    }
  }

  const handleExportLedgerCSV = () => {
    const headers = ['Mã GD', 'Thời gian', 'Sản phẩm', 'Loại biến động', 'Thay đổi', 'Tồn trước', 'Tồn sau', 'Ghi chú', 'Người thực hiện']
    const rows = ledgers.map(l => [
      `#${l.id}`,
      new Date(l.createdAt).toLocaleString('vi-VN'),
      l.productName || '',
      getChangeTypeLabel(l.changeType),
      l.quantityChange > 0 ? `+${l.quantityChange}` : l.quantityChange,
      l.previousStock || 0,
      l.newStock || 0,
      l.note || '',
      l.createdBy || ''
    ])
    exportToCSV(`So_Cai_Kho_MiniMart_${new Date().toISOString().slice(0, 10)}`, headers, rows)
  }

  const handlePrintLedger = () => {
    printDocument('Sổ Cái Biến Động Kho - Siêu thị MiniMart')
  }

  // ----------------------------------------------------
  // QC LOGIC & HANDLERS
  // ----------------------------------------------------
  const handleOpenQcModal = (receipt) => {
    setSelectedQcReceipt(receipt)
    setQcGeneralNote('')
    setQcError('')
    const initialQcItems = (receipt.items || []).map(it => ({
      itemId: it.id,
      productId: it.productId,
      productName: it.productName,
      batchName: it.batchName || '',
      expiryDate: it.expiryDate || '',
      totalQuantity: it.quantity || 0,
      passedQuantity: it.passedQuantity != null ? it.passedQuantity : it.quantity,
      rejectedQuantity: it.rejectedQuantity != null ? it.rejectedQuantity : 0,
      rejectReason: it.rejectReason || 'Bao bì rách, móp méo',
      qcNote: it.qcNote || ''
    }))
    setQcItems(initialQcItems)
  }

  const handleQcItemChange = (index, field, value) => {
    const updated = [...qcItems]
    const current = { ...updated[index] }

    if (field === 'passedQuantity') {
      const numVal = value === '' ? 0 : parseInt(value, 10) || 0
      const passed = Math.max(0, Math.min(current.totalQuantity, numVal))
      current.passedQuantity = passed
      current.rejectedQuantity = current.totalQuantity - passed
    } else if (field === 'rejectedQuantity') {
      const numVal = value === '' ? 0 : parseInt(value, 10) || 0
      const rejected = Math.max(0, Math.min(current.totalQuantity, numVal))
      current.rejectedQuantity = rejected
      current.passedQuantity = current.totalQuantity - rejected
    } else {
      current[field] = value
    }

    updated[index] = current
    setQcItems(updated)
  }

  const handleSubmitQc = async (e) => {
    e.preventDefault()
    if (!selectedQcReceipt) return
    setQcError('')
    setQcSubmitting(true)

    try {
      await api.post(`/api/admin/goods-receipts/${selectedQcReceipt.id}/qc-inspection`, {
        generalNote: qcGeneralNote,
        items: qcItems.map(it => ({
          itemId: it.itemId,
          passedQuantity: Number(it.passedQuantity),
          rejectedQuantity: Number(it.rejectedQuantity),
          rejectReason: Number(it.rejectedQuantity) > 0 ? it.rejectReason : null,
          qcNote: it.qcNote || null
        }))
      })

      await api.put(`/api/admin/goods-receipts/${selectedQcReceipt.id}/complete`)
      alert('Đã hoàn tất kiểm định chất lượng và cập nhật tồn kho thành công!')
      setSelectedQcReceipt(null)
      fetchReceiptData()
      fetchLedgers(0)
    } catch (err) {
      setQcError(err.response?.data?.error || 'Lỗi khi gửi kết quả kiểm định chất lượng')
    } finally {
      setQcSubmitting(false)
    }
  }

  // Thống kê tổng hợp QC
  const pendingQcReceipts = receipts.filter(r => r.status === 'DRAFT')
  const completedQcReceipts = receipts.filter(r => r.status === 'COMPLETED')
  const totalPassedItems = receipts.reduce((acc, r) => acc + (r.items || []).reduce((sum, it) => sum + (it.passedQuantity != null ? it.passedQuantity : (r.status === 'COMPLETED' ? (it.quantity || 0) : 0)), 0), 0)
  const totalRejectedItems = receipts.reduce((acc, r) => acc + (r.items || []).reduce((sum, it) => sum + (it.rejectedQuantity || 0), 0), 0)
  const overallPassRate = (totalPassedItems + totalRejectedItems) > 0 
    ? Math.round((totalPassedItems / (totalPassedItems + totalRejectedItems)) * 100) 
    : 100

  const filteredQcReceipts = receipts.filter(r => {
    if (qcFilter === 'PENDING' && r.status !== 'DRAFT') return false
    if (qcFilter === 'COMPLETED' && r.status !== 'COMPLETED') return false
    if (!qcSearch.trim()) return true
    const term = qcSearch.toLowerCase()
    return (
      String(r.id).includes(term) ||
      (r.supplierName && r.supplierName.toLowerCase().includes(term)) ||
      (r.note && r.note.toLowerCase().includes(term))
    )
  })

  return (
    <div className="admin-crud-page">
      {/* Header Điều hướng & Chuyển Tab */}
      <div className="crud-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
        <div>
          <h2>Lịch sử & Nhập kho</h2>
          <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
            Quản lý quy trình chứng từ nhập hàng, cập nhật giá vốn lô và theo dõi sổ cái biến động kho vận (WMS).
          </p>
        </div>

        {/* Nút hành động theo từng Tab */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {activeTab === 'receipts' ? (
            <>
              <button onClick={handleExportReceiptsCSV} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Download size={16} /> Xuất Excel
              </button>
              <button onClick={handlePrintReceipt} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Printer size={16} /> In danh sách
              </button>
              <button 
                onClick={() => { setShowReceiptForm(true); setSelectedReceipt(null) }} 
                className="btn btn-primary" 
                style={{ background: '#16a34a', borderColor: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
              >
                <Plus size={18} /> Lập phiếu nhập kho
              </button>
            </>
          ) : activeTab === 'qc' ? (
            <>
              <button onClick={fetchReceiptData} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={16} /> Làm mới
              </button>
              <button 
                onClick={() => { setShowReceiptForm(true); setSelectedReceipt(null) }} 
                className="btn btn-primary" 
                style={{ background: '#16a34a', borderColor: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
              >
                <Plus size={18} /> Lập phiếu nhập kho
              </button>
            </>
          ) : (
            <>
              <button onClick={handleExportLedgerCSV} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Download size={16} /> Xuất Excel
              </button>
              <button onClick={handlePrintLedger} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Printer size={16} /> In sổ cái
              </button>
              <button onClick={() => fetchLedgers(ledgerPage)} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={16} /> Làm mới
              </button>
            </>
          )}
        </div>
      </div>

      {/* THANH TAB BAR TINH GỌN CHUYÊN NGHIỆP */}
      <div className="no-print" style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '20px',
        paddingBottom: '2px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => handleTabChange('receipts')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'none',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'receipts' ? 700 : 500,
            color: activeTab === 'receipts' ? '#ff5722' : '#64748b',
            borderBottom: activeTab === 'receipts' ? '3px solid #ff5722' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <FileText size={18} /> Phiếu Nhập Kho ({receipts.length})
        </button>

        <button
          onClick={() => handleTabChange('qc')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'none',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'qc' ? 700 : 500,
            color: activeTab === 'qc' ? '#ff5722' : '#64748b',
            borderBottom: activeTab === 'qc' ? '3px solid #ff5722' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <ShieldCheck size={18} /> Quản lý chất lượng đầu vào (QC)
          {pendingQcReceipts.length > 0 && (
            <span style={{
              background: '#ea580c',
              color: '#ffffff',
              fontSize: '0.75rem',
              padding: '2px 7px',
              borderRadius: '10px',
              fontWeight: 700
            }}>
              {pendingQcReceipts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('ledger')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'none',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'ledger' ? 700 : 500,
            color: activeTab === 'ledger' ? '#ff5722' : '#64748b',
            borderBottom: activeTab === 'ledger' ? '3px solid #ff5722' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <ClipboardList size={18} /> Sổ Cái Biến Động Kho (Ledger)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* NỘI DUNG TAB 1: PHIẾU NHẬP KHO                                            */}
      {/* ========================================================================= */}
      {activeTab === 'receipts' && (
        <>
          {receiptLoading ? (
            <div className="loading-state">Đang tải phiếu nhập kho...</div>
          ) : (
            <div className="admin-table-container glass">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Ngày tạo</th>
                    <th>Nhà cung cấp</th>
                    <th>Tổng tiền (VND)</th>
                    <th>Người tạo</th>
                    <th>Trạng thái</th>
                    <th className="no-print">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.length > 0 ? (
                    receipts.map(r => (
                      <tr key={r.id}>
                        <td><strong>PNK-{r.id}</strong></td>
                        <td>{new Date(r.createdAt).toLocaleString('vi-VN')}</td>
                        <td>{r.supplierName || '—'}</td>
                        <td><strong style={{ color: '#0284c7' }}>{r.totalAmount ? r.totalAmount.toLocaleString() : 0}đ</strong></td>
                        <td>{r.createdBy || 'Admin'}</td>
                        <td>
                          <span className={`status-pill ${r.status === 'COMPLETED' ? 'active' : r.status === 'CANCELLED' ? 'inactive' : 'warning'}`}>
                            {r.status === 'COMPLETED' ? 'Hoàn thành' : r.status === 'CANCELLED' ? 'Đã hủy' : 'Bản nháp'}
                          </span>
                        </td>
                        <td className="no-print">
                          <div className="table-actions">
                            <button onClick={() => setSelectedReceipt(r)} className="action-btn" title="Xem chi tiết">
                              <Eye size={16} />
                            </button>
                            {r.status === 'DRAFT' && (
                              <>
                                <button onClick={() => handleOpenQcModal(r)} className="action-btn" style={{ color: '#ea580c' }} title="Kiểm định chất lượng (QC) & Nhập kho">
                                  <ShieldCheck size={16} />
                                </button>
                                <button onClick={() => handleCompleteReceipt(r.id)} className="action-btn text-success" title="Nhập nhanh (100% Đạt)">
                                  <CheckCircle2 size={16} />
                                </button>
                                <button onClick={() => handleCancelReceipt(r.id)} className="action-btn delete" title="Hủy phiếu">
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        Chưa có phiếu nhập kho nào. Bấm <strong>"Lập phiếu nhập kho"</strong> để bắt đầu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* NỘI DUNG TAB 2: QUẢN LÝ CHẤT LƯỢNG ĐẦU VÀO (INWARD QC)                     */}
      {/* ========================================================================= */}
      {activeTab === 'qc' && (
        <div>
          {/* 4 Thẻ KPI QC Đầu Vào */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: '#c2410c', fontWeight: 600 }}>Chờ kiểm định QC</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.6rem', color: '#ea580c', fontWeight: 800 }}>{pendingQcReceipts.length} <small style={{ fontSize: '0.85rem' }}>phiếu</small></h3>
                <span style={{ fontSize: '0.78rem', color: '#9a3412' }}>Chưa cộng vào tồn kho</span>
              </div>
              <div style={{ background: '#ffedd5', color: '#ea580c', padding: '10px', borderRadius: '10px' }}><ShieldAlert size={22} /></div>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: '#15803d', fontWeight: 600 }}>Hàng đạt chuẩn (Đã vào kho)</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.6rem', color: '#16a34a', fontWeight: 800 }}>{totalPassedItems} <small style={{ fontSize: '0.85rem' }}>mặt hàng</small></h3>
                <span style={{ fontSize: '0.78rem', color: '#166534' }}>Tỷ lệ đạt: {overallPassRate}%</span>
              </div>
              <div style={{ background: '#dcfce7', color: '#16a34a', padding: '10px', borderRadius: '10px' }}><ShieldCheck size={22} /></div>
            </div>

            <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: '#b91c1c', fontWeight: 600 }}>Hàng không đạt (Trả về NCC)</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.6rem', color: '#dc2626', fontWeight: 800 }}>{totalRejectedItems} <small style={{ fontSize: '0.85rem' }}>mặt hàng</small></h3>
                <span style={{ fontSize: '0.78rem', color: '#991b1b' }}>Không tăng tồn kho</span>
              </div>
              <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px', borderRadius: '10px' }}><XCircle size={22} /></div>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: '#1d4ed8', fontWeight: 600 }}>Đã hoàn tất kiểm định</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.6rem', color: '#2563eb', fontWeight: 800 }}>{completedQcReceipts.length} <small style={{ fontSize: '0.85rem' }}>phiếu</small></h3>
                <span style={{ fontSize: '0.78rem', color: '#1e40af' }}>Đã đối soát chứng từ</span>
              </div>
              <div style={{ background: '#dbeafe', color: '#2563eb', padding: '10px', borderRadius: '10px' }}><FileCheck2 size={22} /></div>
            </div>
          </div>

          {/* Thanh lọc & tìm kiếm cho QC */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px', background: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <input
                type="text"
                placeholder="Tìm kiếm phiếu kiểm định (Mã PNK, Nhà cung cấp, Ghi chú...)"
                value={qcSearch}
                onChange={(e) => setQcSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
              />
            </div>

            <select
              value={qcFilter}
              onChange={(e) => setQcFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
            >
              <option value="ALL">Tất cả trạng thái ({receipts.length})</option>
              <option value="PENDING">Chờ kiểm định QC ({pendingQcReceipts.length})</option>
              <option value="COMPLETED">Đã hoàn thành QC ({completedQcReceipts.length})</option>
            </select>
          </div>

          {/* Bảng danh sách đợt hàng kiểm định QC */}
          <div className="admin-table-container glass">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Ngày lập</th>
                  <th>Nhà cung cấp</th>
                  <th style={{ textAlign: 'center' }}>Số mặt hàng</th>
                  <th style={{ textAlign: 'center' }}>Tổng SL giao</th>
                  <th style={{ textAlign: 'center' }}>Đạt chuẩn (+Kho)</th>
                  <th style={{ textAlign: 'center' }}>Trả về NCC</th>
                  <th>Trạng thái QC</th>
                  <th className="no-print">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredQcReceipts.length > 0 ? (
                  filteredQcReceipts.map(r => {
                    const totalQty = (r.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0)
                    const passedQty = (r.items || []).reduce((sum, it) => sum + (it.passedQuantity != null ? it.passedQuantity : (r.status === 'COMPLETED' ? it.quantity : 0)), 0)
                    const rejectedQty = (r.items || []).reduce((sum, it) => sum + (it.rejectedQuantity || 0), 0)
                    const isDraft = r.status === 'DRAFT'

                    return (
                      <tr key={r.id}>
                        <td><strong>PNK-{r.id}</strong></td>
                        <td>{new Date(r.createdAt).toLocaleString('vi-VN')}</td>
                        <td>{r.supplierName || '—'}</td>
                        <td style={{ textAlign: 'center' }}>{r.items?.length || 0}</td>
                        <td style={{ textAlign: 'center' }}><strong style={{ fontSize: '1rem' }}>{totalQty}</strong></td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.95rem' }}>
                            {isDraft ? '—' : `+${passedQty}`}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ color: rejectedQty > 0 ? '#dc2626' : '#64748b', fontWeight: rejectedQty > 0 ? 800 : 400, fontSize: '0.95rem' }}>
                            {isDraft ? '—' : rejectedQty}
                          </span>
                        </td>
                        <td>
                          {isDraft ? (
                            <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <AlertCircle size={13} /> Chờ kiểm định
                            </span>
                          ) : (
                            <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <CheckCircle2 size={13} /> Đã kiểm định QC
                            </span>
                          )}
                        </td>
                        <td className="no-print">
                          <div className="table-actions">
                            {isDraft ? (
                              <button
                                onClick={() => handleOpenQcModal(r)}
                                className="btn btn-primary"
                                style={{ padding: '6px 14px', fontSize: '0.82rem', background: '#ea580c', borderColor: '#ea580c', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}
                                title="Bắt đầu kiểm định chất lượng cho phiếu này"
                              >
                                <ShieldCheck size={16} /> Kiểm định QC
                              </button>
                            ) : (
                              <button
                                onClick={() => setViewingQcRecord(r)}
                                className="btn btn-outline"
                                style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#0284c7', borderColor: '#0284c7' }}
                                title="Xem chi tiết biên bản kiểm định chất lượng"
                              >
                                <FileCheck2 size={15} /> Xem biên bản
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      Không có đợt hàng nào phù hợp với bộ lọc kiểm định QC.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NỘI DUNG TAB 3: SỔ CÁI BIẾN ĐỘNG KHO (LEDGER)                             */}
      {/* ========================================================================= */}
      {activeTab === 'ledger' && (
        <>
          {ledgerLoading ? (
            <div className="loading-state">Đang tải sổ cái biến động kho...</div>
          ) : (
            <div className="admin-table-container glass">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Mã GD</th>
                    <th>Thời gian</th>
                    <th>Sản phẩm</th>
                    <th>Loại biến động</th>
                    <th style={{ textAlign: 'center' }}>Thay đổi</th>
                    <th style={{ textAlign: 'center' }}>Tồn trước</th>
                    <th style={{ textAlign: 'center' }}>Tồn sau</th>
                    <th>Ghi chú</th>
                    <th>Người thực hiện</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgers.length > 0 ? (
                    ledgers.map(l => {
                      const isExpired = l.changeType === 'EXPIRED_DISPOSAL'
                      return (
                        <tr key={l.id} style={{ background: isExpired ? '#fffbfb' : 'inherit' }}>
                          <td>#{l.id}</td>
                          <td>{new Date(l.createdAt).toLocaleString('vi-VN')}</td>
                          <td><strong>{l.productName}</strong></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {getChangeTypeIcon(l.changeType)}
                              <span style={{ fontWeight: isExpired ? 700 : 500, color: isExpired ? '#dc2626' : 'inherit' }}>
                                {getChangeTypeLabel(l.changeType)}
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <strong className={l.quantityChange > 0 ? 'text-success' : l.quantityChange < 0 ? 'text-danger' : ''}>
                              {l.quantityChange > 0 ? `+${l.quantityChange}` : l.quantityChange}
                            </strong>
                          </td>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{l.previousStock}</td>
                          <td style={{ textAlign: 'center' }}><strong>{l.newStock}</strong></td>
                          <td style={{ maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.note}>
                            {l.note}
                          </td>
                          <td><small style={{ color: '#64748b' }}>{l.createdBy || 'Hệ thống'}</small></td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                        Chưa có bản ghi biến động kho nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Phân trang Ledger */}
              {ledgerTotalPages > 1 && (
                <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', padding: '1rem' }}>
                  <button 
                    className="btn btn-outline" 
                    disabled={ledgerPage === 0} 
                    onClick={() => setLedgerPage(p => p - 1)}
                  >
                    Trang trước
                  </button>
                  <span style={{ alignSelf: 'center', fontWeight: 600 }}>Trang {ledgerPage + 1} / {ledgerTotalPages}</span>
                  <button 
                    className="btn btn-outline" 
                    disabled={ledgerPage >= ledgerTotalPages - 1} 
                    onClick={() => setLedgerPage(p => p + 1)}
                  >
                    Trang sau
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FORM LẬP PHIẾU NHẬP KHO MỚI                                      */}
      {/* ========================================================================= */}
      {showReceiptForm && (
        <div className="admin-form-overlay">
          <form onSubmit={handleSubmitReceipt} className="admin-popup-form form-large glass" style={{ maxWidth: '900px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Box size={20} color="#16a34a" /> Lập Phiếu Nhập Hàng Mới
              </h3>
              <button type="button" onClick={handleCloseReceiptForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {receiptError && <div className="form-error">{receiptError}</div>}

            <div className="form-grid-2">
              <div className="form-group">
                <label>Nhà cung cấp (*)</label>
                <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">-- Chọn nhà cung cấp --</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.contactName || 'NCC'})</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Ghi chú đơn nhập</label>
                <input type="text" placeholder="Ghi chú nhập hàng, số hóa đơn chứng từ..." value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontWeight: 700 }}>Danh sách mặt hàng nhập kho</h4>
                <button type="button" onClick={handleAddItem} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={16} /> Thêm mặt hàng
                </button>
              </div>

              {items.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem', background: '#f8fafc', borderRadius: '8px' }}>
                  Chưa có sản phẩm nào. Nhấp <strong>"Thêm mặt hàng"</strong> để chọn hàng nhập.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {items.map((item, idx) => {
                    const filteredProdList = item.brandId 
                      ? products.filter(p => String(p.brandId) === String(item.brandId))
                      : products

                    return (
                      <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ff5722' }}>Dòng #{idx + 1}</span>
                          <button type="button" onClick={() => handleRemoveItem(idx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Thương hiệu</label>
                            <select value={item.brandId} onChange={(e) => handleItemChange(idx, 'brandId', e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                              <option value="">-- Tất cả --</option>
                              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Sản phẩm (*)</label>
                            <select required value={item.productId} onChange={(e) => handleItemChange(idx, 'productId', e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                              <option value="">-- Chọn SP --</option>
                              {filteredProdList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Số lượng (*)</label>
                            <input type="number" required min="1" value={item.quantity} onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Giá nhập (VND) (*)</label>
                            <input type="number" required min="0" step="500" value={item.importPrice} onChange={(e) => handleItemChange(idx, 'importPrice', e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Mã Lô</label>
                            <input type="text" placeholder="LH2026..." value={item.batchName} onChange={(e) => handleItemChange(idx, 'batchName', e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Hạn sử dụng</label>
                            <input type="date" value={item.expiryDate} onChange={(e) => handleItemChange(idx, 'expiryDate', e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={handleCloseReceiptForm} className="btn btn-outline">Hủy bỏ</button>
              <button type="submit" className="btn btn-primary">Lưu phiếu nhập</button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CHI TIẾT & IN PHIẾU NHẬP KHO                                     */}
      {/* ========================================================================= */}
      {selectedReceipt && (
        <div className="admin-form-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedReceipt(null)}>
          <div className="admin-popup-form form-large glass" style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="#0284c7" /> Chi Tiết Phiếu Nhập Kho: PNK-{selectedReceipt.id}
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handlePrintReceipt} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px' }}>
                  <Printer size={15} /> In phiếu
                </button>
                <button onClick={() => setSelectedReceipt(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div id={`Phieu_Nhap_Kho_PNK${selectedReceipt.id}_MiniMart`}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                <div>
                  <div>Mã phiếu: <strong>PNK-{selectedReceipt.id}</strong></div>
                  <div>Ngày lập: <strong>{new Date(selectedReceipt.createdAt).toLocaleString('vi-VN')}</strong></div>
                  <div>Nhà cung cấp: <strong>{selectedReceipt.supplierName}</strong></div>
                </div>
                <div>
                  <div>Người lập: <strong>{selectedReceipt.createdBy || 'Admin'}</strong></div>
                  <div>Trạng thái: <strong>{selectedReceipt.status === 'COMPLETED' ? 'Đã hoàn thành' : selectedReceipt.status === 'CANCELLED' ? 'Đã hủy' : 'Bản nháp'}</strong></div>
                  <div>Ghi chú: <span>{selectedReceipt.note || 'Không có'}</span></div>
                </div>
              </div>

              <table className="admin-table" style={{ width: '100%', marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Sản phẩm</th>
                    <th>Mã Lô</th>
                    <th>HSD</th>
                    <th style={{ textAlign: 'center' }}>SL</th>
                    <th style={{ textAlign: 'right' }}>Giá nhập</th>
                    <th style={{ textAlign: 'right' }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedReceipt.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td>#{idx + 1}</td>
                      <td><strong>{it.productName}</strong></td>
                      <td>{it.batchName || '—'}</td>
                      <td>{it.expiryDate || '—'}</td>
                      <td style={{ textAlign: 'center' }}><strong>{it.quantity}</strong></td>
                      <td style={{ textAlign: 'right' }}>{it.importPrice?.toLocaleString()}đ</td>
                      <td style={{ textAlign: 'right' }}><strong>{(it.quantity * it.importPrice)?.toLocaleString()}đ</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ textAlign: 'right', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', borderTop: '2px solid #e2e8f0', paddingTop: '0.8rem' }}>
                Tổng giá trị đơn nhập: <span style={{ color: '#ff5722' }}>{selectedReceipt.totalAmount?.toLocaleString()}đ</span>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {selectedReceipt.status === 'DRAFT' && (
                <>
                  <button 
                    onClick={() => { const r = selectedReceipt; setSelectedReceipt(null); handleOpenQcModal(r) }} 
                    className="btn btn-primary" 
                    style={{ background: '#ea580c', borderColor: '#ea580c', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                  >
                    <ShieldCheck size={16} /> Kiểm định QC & Nhập kho
                  </button>
                  <button onClick={() => handleCompleteReceipt(selectedReceipt.id)} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> Nhập nhanh (100% Đạt)
                  </button>
                </>
              )}
              <button onClick={() => setSelectedReceipt(null)} className="btn btn-outline">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: KIỂM ĐỊNH CHẤT LƯỢNG ĐẦU VÀO (INWARD QC INSPECTION)                */}
      {/* ========================================================================= */}
      {selectedQcReceipt && (
        <div className="admin-form-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedQcReceipt(null)}>
          <div className="admin-popup-form form-large glass" style={{ maxWidth: '960px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#ea580c' }}>
                <ShieldCheck size={22} color="#ea580c" /> Biên Bản Kiểm Định Chất Lượng Đầu Vào (QC) - PNK #{selectedQcReceipt.id}
              </h3>
              <button type="button" onClick={() => setSelectedQcReceipt(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {qcError && <div className="form-error" style={{ marginBottom: '1rem' }}>{qcError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '0.88rem' }}>
              <div>Mã phiếu: <strong>PNK-{selectedQcReceipt.id}</strong></div>
              <div>Nhà cung cấp: <strong>{selectedQcReceipt.supplierName}</strong></div>
              <div>Ngày lập: <strong>{new Date(selectedQcReceipt.createdAt).toLocaleDateString('vi-VN')}</strong></div>
              <div>Người lập: <strong>{selectedQcReceipt.createdBy || 'Admin'}</strong></div>
            </div>

            <form onSubmit={handleSubmitQc}>
              <div style={{ marginBottom: '16px', maxHeight: '360px', overflowY: 'auto' }}>
                <table className="admin-table" style={{ width: '100%', fontSize: '0.88rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '30px' }}>STT</th>
                      <th>Sản phẩm & Lô</th>
                      <th style={{ width: '85px', textAlign: 'center' }}>SL Giao</th>
                      <th style={{ width: '115px', textAlign: 'center' }}>SL Đạt (+Kho)</th>
                      <th style={{ width: '115px', textAlign: 'center' }}>SL Trả về</th>
                      <th style={{ width: '190px' }}>Lý do trả về NCC</th>
                      <th style={{ width: '150px' }}>Ghi chú KCS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qcItems.map((item, idx) => (
                      <tr key={idx} style={{ background: item.rejectedQuantity > 0 ? '#fff1f2' : 'inherit' }}>
                        <td>#{idx + 1}</td>
                        <td>
                          <strong>{item.productName}</strong>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {item.batchName ? `Lô: ${item.batchName}` : ''} {item.expiryDate ? `| HSD: ${item.expiryDate}` : ''}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 800 }}>{item.totalQuantity}</span>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={item.totalQuantity}
                            value={item.passedQuantity}
                            onChange={(e) => handleQcItemChange(idx, 'passedQuantity', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '2px solid #22c55e',
                              textAlign: 'center',
                              fontWeight: 700,
                              background: '#f0fdf4',
                              color: '#15803d'
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={item.totalQuantity}
                            value={item.rejectedQuantity}
                            onChange={(e) => handleQcItemChange(idx, 'rejectedQuantity', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: item.rejectedQuantity > 0 ? '2px solid #ef4444' : '1px solid #cbd5e1',
                              textAlign: 'center',
                              fontWeight: 700,
                              background: item.rejectedQuantity > 0 ? '#fee2e2' : '#ffffff',
                              color: item.rejectedQuantity > 0 ? '#b91c1c' : '#64748b'
                            }}
                          />
                        </td>
                        <td>
                          <select
                            disabled={item.rejectedQuantity === 0}
                            value={item.rejectReason}
                            onChange={(e) => handleQcItemChange(idx, 'rejectReason', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.8rem',
                              background: item.rejectedQuantity === 0 ? '#f1f5f9' : '#ffffff',
                              cursor: item.rejectedQuantity === 0 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <option value="Bao bì rách, móp méo">Bao bì rách, móp méo</option>
                            <option value="Cận hạn sử dụng / Hết hạn">Cận date / Hết hạn</option>
                            <option value="Hỏng do bảo quản / Nhiệt độ">Hỏng nhiệt độ/bảo quản</option>
                            <option value="Sai quy cách / Sai mẫu mã">Sai quy cách / Mẫu mã</option>
                            <option value="Kém chất lượng / Biến đổi màu, mùi">Kém chất lượng / Hỏng</option>
                            <option value="Khác">Khác (ghi rõ trong ghi chú)</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            placeholder="Ghi chú thêm..."
                            value={item.qcNote}
                            onChange={(e) => handleQcItemChange(idx, 'qcNote', e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* HỘP TỔNG KẾT DUYỆT TỒN KHO THỜI GIAN THỰC */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '1rem',
                fontSize: '0.9rem'
              }}>
                <div>
                  Tổng hàng giao: <strong>{qcItems.reduce((acc, it) => acc + Number(it.totalQuantity || 0), 0)}</strong>
                </div>
                <div style={{ color: '#16a34a', fontWeight: 700 }}>
                  ✅ Đạt chuẩn (+ Tồn kho & Lô bán): <strong>{qcItems.reduce((acc, it) => acc + Number(it.passedQuantity || 0), 0)}</strong>
                </div>
                <div style={{ color: '#dc2626', fontWeight: 700 }}>
                  ❌ Không đạt (Trả về NCC): <strong>{qcItems.reduce((acc, it) => acc + Number(it.rejectedQuantity || 0), 0)}</strong>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Ghi chú biên bản kiểm định QC</label>
                <input
                  type="text"
                  placeholder="Ghi chú biên bản kiểm tra, nhận xét của bộ phận KCS..."
                  value={qcGeneralNote}
                  onChange={(e) => setQcGeneralNote(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setSelectedQcReceipt(null)} className="btn btn-outline">
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={qcSubmitting}
                  className="btn btn-primary"
                  style={{ background: '#16a34a', borderColor: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                >
                  <ShieldCheck size={18} /> {qcSubmitting ? 'Đang duyệt...' : 'Xác nhận kiểm định & Nhập kho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: XEM CHI TIẾT BIÊN BẢN QC ĐÃ HOÀN THÀNH                          */}
      {/* ========================================================================= */}
      {viewingQcRecord && (
        <div className="admin-form-overlay" onClick={(e) => e.target === e.currentTarget && setViewingQcRecord(null)}>
          <div className="admin-popup-form form-large glass" style={{ maxWidth: '850px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a' }}>
                <CheckCircle2 size={22} color="#16a34a" /> Biên Bản Kiểm Định Chất Lượng - PNK #{viewingQcRecord.id}
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => printDocument(`Bien_Ban_QC_PNK${viewingQcRecord.id}`)} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px' }}>
                  <Printer size={15} /> In biên bản
                </button>
                <button type="button" onClick={() => setViewingQcRecord(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div id={`Bien_Ban_QC_PNK${viewingQcRecord.id}`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '0.88rem' }}>
                <div>Mã phiếu: <strong>PNK-{viewingQcRecord.id}</strong></div>
                <div>Nhà cung cấp: <strong>{viewingQcRecord.supplierName}</strong></div>
                <div>Ngày lập: <strong>{new Date(viewingQcRecord.createdAt).toLocaleString('vi-VN')}</strong></div>
                <div>Trạng thái: <strong style={{ color: '#16a34a' }}>Đã hoàn thành QC</strong></div>
              </div>

              <table className="admin-table" style={{ width: '100%', marginBottom: '1rem', fontSize: '0.88rem' }}>
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Sản phẩm</th>
                    <th>Mã Lô & HSD</th>
                    <th style={{ textAlign: 'center' }}>SL Giao</th>
                    <th style={{ textAlign: 'center' }}>Đạt (+Kho)</th>
                    <th style={{ textAlign: 'center' }}>Trả về NCC</th>
                    <th>Lý do trả về</th>
                    <th>Người kiểm định</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewingQcRecord.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td>#{idx + 1}</td>
                      <td><strong>{it.productName}</strong></td>
                      <td>{it.batchName ? `${it.batchName} (${it.expiryDate})` : '—'}</td>
                      <td style={{ textAlign: 'center' }}><strong>{it.quantity}</strong></td>
                      <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>
                        {it.passedQuantity != null ? it.passedQuantity : it.quantity}
                      </td>
                      <td style={{ textAlign: 'center', color: (it.rejectedQuantity || 0) > 0 ? '#dc2626' : '#64748b', fontWeight: (it.rejectedQuantity || 0) > 0 ? 700 : 400 }}>
                        {it.rejectedQuantity || 0}
                      </td>
                      <td>
                        {it.rejectReason ? (
                          <span style={{ color: '#dc2626', fontSize: '0.82rem', fontWeight: 600 }}>⚠️ {it.rejectReason}</span>
                        ) : '—'}
                      </td>
                      <td>{it.inspectedBy || viewingQcRecord.createdBy || 'Admin'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1rem' }}>
                <strong>Tổng kết kiểm tra:</strong> Nhập kho thành công <strong>{(viewingQcRecord.items || []).reduce((acc, it) => acc + (it.passedQuantity != null ? it.passedQuantity : it.quantity), 0)}</strong> sản phẩm đạt chuẩn. Trả về nhà cung cấp <strong>{(viewingQcRecord.items || []).reduce((acc, it) => acc + (it.rejectedQuantity || 0), 0)}</strong> sản phẩm lỗi.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" onClick={() => setViewingQcRecord(null)} className="btn btn-outline">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WarehouseHistoryManager
