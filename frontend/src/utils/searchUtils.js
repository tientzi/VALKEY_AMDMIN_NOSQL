/**
 * Tiện ích hỗ trợ tìm kiếm tương đối không phân biệt hoa thường và không dấu Tiếng Việt
 */

export const removeVietnameseTones = (str) => {
  if (!str) return ''
  let s = String(str).toLowerCase()
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  s = s.replace(/[đĐ]/g, 'd')
  s = s.replace(/[^a-z0-9\s]/g, ' ')
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * Kiểm tra target có chứa query hay không (tương đối)
 * @param {string|Array<string|number>} target - Chuỗi hoặc danh sách các trường cần tìm
 * @param {string} query - Từ khóa tìm kiếm của người dùng
 * @returns {boolean}
 */
export const matchesRelative = (target, query) => {
  if (!query || !String(query).trim()) return true
  if (!target) return false

  const cleanQuery = removeVietnameseTones(query)
  const queryTokens = cleanQuery.split(' ').filter(Boolean)

  let combinedTarget = ''
  if (Array.isArray(target)) {
    combinedTarget = target.filter(Boolean).map(t => removeVietnameseTones(t)).join(' ')
  } else {
    combinedTarget = removeVietnameseTones(target)
  }

  // Tất cả các từ trong từ khóa tìm kiếm phải xuất hiện trong target
  return queryTokens.every(token => combinedTarget.includes(token))
}
