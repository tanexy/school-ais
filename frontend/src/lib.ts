export function money(n: number | undefined | null): string {
  const v = Number(n ?? 0)
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtDate(d?: string | null): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fullName(s: { first_name?: string; last_name?: string } | undefined): string {
  if (!s) return ''
  return `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()
}

export function statusChip(status?: string): string {
  const s = (status || '').toLowerCase()
  if (['paid', 'active', 'complete', 'completed', 'in stock'].includes(s)) return 'green'
  if (['partial', 'pending', 'low'].includes(s)) return 'amber'
  if (['unpaid', 'overdue', 'inactive', 'out of stock', 'cancelled', 'resigned'].includes(s)) return 'red'
  return ''
}

export function statusLabel(status?: string): string {
  const s = (status || '').toLowerCase()
  if (s === 'paid') return 'Paid'
  if (s === 'partial') return 'Partial'
  if (s === 'unpaid') return 'Unpaid'
  if (s === 'low') return 'Low stock'
  if (s === 'in stock') return 'In stock'
  if (s === 'out of stock') return 'Out of stock'
  if (s === 'resigned') return 'Resigned'
  if (s === 'pending') return 'Pending'
  if (s === 'completed') return 'Completed'
  return status || '—'
}

export function intl(n: number): string {
  return n.toLocaleString('en-US')
}

export function letterForScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return '—'
  if (score >= 75) return 'A'
  if (score >= 60) return 'B'
  if (score >= 50) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}