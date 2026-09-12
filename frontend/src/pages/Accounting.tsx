import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { Account, LedgerEntry } from '../types'
import { PageHeader, Spinner, ErrorBanner, Chip, Empty } from '../components/ui'
import { money, fmtDate } from '../lib'

const TYPE_COLOR: Record<string, string> = {
  asset: 'blue', liability: 'amber', income: 'green', expense: 'red', equity: 'violet', capital: 'violet',
}

export function Accounting() {
  const [tab, setTab] = useState<'coa' | 'ledger'>('coa')
  const [filter, setFilter] = useState('')

  const coa = useQuery({ queryKey: ['coa'], queryFn: () => api<Account[]>('/api/chart-of-accounts') })
  const ledger = useQuery({
    queryKey: ['ledger'],
    queryFn: () => api<LedgerEntry[]>('/api/ledger'),
  })

  const rows = (ledger.data ?? []).filter((r) => !filter || r.account_name?.toLowerCase().includes(filter.toLowerCase()) || r.account_code.includes(filter) || r.description?.toLowerCase().includes(filter.toLowerCase()))
  const debtTotal = (ledger.data ?? []).reduce((s, r) => s + (r.debit ?? 0), 0)
  const credTotal = (ledger.data ?? []).reduce((s, r) => s + (r.credit ?? 0), 0)

  return (
    <div>
      <PageHeader title="Accounting" crumb="Chart of accounts & general ledger" />

      <div className="tabs">
        <button className={`tab${tab === 'coa' ? ' active' : ''}`} onClick={() => setTab('coa')}>Chart of Accounts</button>
        <button className={`tab${tab === 'ledger' ? ' active' : ''}`} onClick={() => setTab('ledger')}>General Ledger</button>
      </div>

      {tab === 'coa' ? (
        <>
          <div className="grid grid-2 mb">
            <div className="card stat"><div className="stat-label">Accounts</div><div className="stat-value" style={{ fontSize: 24 }}>{coa.data?.length ?? '…'}</div></div>
            <div className="card stat"><div className="stat-label">Types</div><div className="stat-value" style={{ fontSize: 22 }}>{[...new Set((coa.data ?? []).map((c) => c.type))].join(' • ')}</div></div>
          </div>
          <div className="table-wrap">
            {coa.isError && <ErrorBanner message={(coa.error as Error).message} />}
            <table className="data">
              <thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Normal balance</th><th className="num">Balance</th></tr></thead>
              <tbody>
                {coa.isLoading ? <tr><td colSpan={5}><Spinner /></td></tr> : null}
                {coa.data?.map((c) => (
                  <tr key={c.code}>
                    <td className="muted" style={{ fontWeight: 600 }}>{c.code}</td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td><Chip tone={TYPE_COLOR[c.type] ?? ''}>{c.type}</Chip></td>
                    <td className="muted">{c.normal_balance}</td>
                    <td className="num" style={{ color: c.normal_balance === 'debit' ? 'var(--accent)' : 'var(--violet,var(--amber))' }}>{money(c.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tfoot"><td colSpan={4}>Net position</td><td className="num">{money((coa.data ?? []).reduce((s, c) => s + c.balance, 0))}</td></tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="toolbar">
            <input className="search" placeholder="Filter by account, code or description…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <span className="spacer" />
            <span className="muted small">Debit total: <b>{money(debtTotal)}</b> · Credit total: <b>{money(credTotal)}</b></span>
          </div>
          {ledger.isError && <ErrorBanner message={(ledger.error as Error).message} />}
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Date</th><th>Account</th><th>Description</th><th>Ref</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead>
              <tbody>
                {ledger.isLoading ? <tr><td colSpan={6}><Spinner /></td></tr> : null}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.date)}</td>
                    <td><span className="chip violet">{r.account_name}</span></td>
                    <td>{r.description}</td>
                    <td className="muted">{r.reference_type}</td>
                    <td className="num" style={{ color: r.debit ? 'var(--accent)' : undefined }}>{r.debit ? money(r.debit) : ''}</td>
                    <td className="num" style={{ color: r.credit ? 'var(--green)' : undefined }}>{r.credit ? money(r.credit) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tfoot"><td colSpan={4}>Totals</td><td className="num">{money(debtTotal)}</td><td className="num">{money(credTotal)}</td></tr>
              </tfoot>
            </table>
            {rows.length === 0 && <Empty>No ledger entries</Empty>}
          </div>
        </>
      )}
    </div>
  )
}