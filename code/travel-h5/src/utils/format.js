// 统一金额格式：提取数字部分并加人民币符号 ¥，兼容 500 / "900日元" / "¥1498" / "约200元" 等格式
export const formatAmount = (val) => {
  const num = parseFloat(String(val ?? '').replace(/[^\d.]/g, ''))
  return isNaN(num) ? '¥0' : `¥${num}`
}

// 门票金额：免费或 0 显示“免费”，无法识别的文案原样返回，其余统一为 ¥金额
export const formatTicket = (val) => {
  const raw = String(val ?? '').trim()
  if (raw === '') return ''
  if (raw.includes('免')) return '免费'
  const num = parseFloat(raw.replace(/[^\d.]/g, ''))
  if (isNaN(num)) return raw
  return num === 0 ? '免费' : `¥${num}`
}
