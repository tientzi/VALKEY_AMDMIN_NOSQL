/**
 * MiniMart Export & Print Utilities
 * Hỗ trợ xuất dữ liệu ra CSV có UTF-8 BOM (tương thích 100% Microsoft Excel tiếng Việt)
 * và kích hoạt in ấn chuẩn tài liệu chứng từ
 */

/**
 * Xuất danh sách ra file CSV chuẩn UTF-8 BOM
 * @param {string} filename Tên file không cần đuôi .csv hoặc có .csv
 * @param {string[]} headers Mảng tiêu đề các cột
 * @param {Array<Array<any>>} rows Mảng các hàng dữ liệu (mỗi hàng là 1 mảng giá trị)
 */
export const exportToCSV = (filename, headers, rows) => {
  if (!rows || rows.length === 0) {
    alert('Không có dữ liệu để xuất file')
    return
  }

  const formatCell = (val) => {
    if (val === null || val === undefined) return '""'
    let str = String(val)
    // Nếu chứa dấu phẩy, nháy kép hoặc xuống dòng -> escape
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      str = `"${str.replace(/"/g, '""')}"`
    } else {
      str = `"${str}"`
    }
    return str
  }

  const csvRows = []
  // Dòng tiêu đề
  csvRows.push(headers.map(formatCell).join(','))

  // Các dòng dữ liệu
  rows.forEach(row => {
    csvRows.push(row.map(formatCell).join(','))
  })

  // \uFEFF là Byte Order Mark (BOM) để Microsoft Excel nhận diện UTF-8 tiếng Việt chuẩn xác
  const csvContent = '\uFEFF' + csvRows.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', cleanFilename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Kích hoạt in chứng từ/báo cáo với tiêu đề tạm thời
 * @param {string} documentTitle Tiêu đề hiển thị trên header/PDF khi in
 */
export const printDocument = (documentTitle) => {
  const originalTitle = document.title
  if (documentTitle) {
    document.title = documentTitle
  }

  window.print()

  // Khôi phục lại title ban đầu sau khi hộp thoại in đóng
  setTimeout(() => {
    document.title = originalTitle
  }, 1000)
}

/**
 * Format tiền tệ VND
 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '0 ₫'
  return `${Number(amount).toLocaleString('vi-VN')} ₫`
}

/**
 * Format ngày giờ Việt Nam
 */
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}
