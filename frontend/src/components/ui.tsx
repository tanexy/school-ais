import type { ReactNode } from 'react'
import { money } from '../lib'

export function Modal({
  open, title, children, onClose, wide,
}: { open: boolean; title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal${wide ? ' wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="m-head">
          <h3>{title}</h3>
          <button className="m-close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Spinner() {
  return <div className="spinner" />
}

export function Empty({ children = 'No data' }: { children?: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="error-banner">⚠ {message}</div>
}

export function StatCard({
  label, value, sub, tone,
}: { label: string; value: string | number; sub?: ReactNode; tone?: 'pos' | 'neg' | 'plain' }) {
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone === 'pos' ? 'pos' : tone === 'neg' ? 'neg' : ''}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function PageHeader({ title, crumb, actions }: { title: string; crumb?: string; actions?: ReactNode }) {
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {crumb && <div className="crumb">{crumb}</div>}
      </div>
      <div className="spacer" />
      {actions}
    </div>
  )
}

export function Chip({ tone, children }: { tone?: string; children: ReactNode }) {
  return <span className={`chip${tone ? ' ' + tone : ''}`}>{children}</span>
}

export function Money({ value, tone }: { value: number; tone?: 'pos' | 'neg' }) {
  const color = tone === 'pos' ? 'var(--green)' : tone === 'neg' ? 'var(--red)' : undefined
  return <span style={{ color }} className="money">{money(value)}</span>
}

export function TBRow({ label, value, total }: { label: string; value: number; total?: boolean }) {
  return (
    <tr className={total ? 'tfoot' : ''}>
      <td>{label}</td>
      <td className="num">{money(value)}</td>
    </tr>
  )
}