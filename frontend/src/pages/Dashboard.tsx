import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { DashboardData } from '../types'
import { PageHeader, Spinner, StatCard, ErrorBanner, Chip, Empty } from '../components/ui'
import { money } from '../lib'
import { Link } from 'react-router-dom'

export function Dashboard() {
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api<DashboardData>('/api/reports/dashboard') })
  const collections = useQuery({ queryKey: ['collections'], queryFn: () => api<{ daily: any[]; monthly: any[] }>('/api/reports/collections') })
  const expenses = useQuery({ queryKey: ['expenses-cat'], queryFn: () => api<any[]>('/api/reports/expenses-by-category') })
  const byClass = useQuery({ queryKey: ['by-class'], queryFn: () => api<any[]>('/api/reports/students-by-class') })
  const debtors = useQuery({ queryKey: ['debtors'], queryFn: () => api<any[]>('/api/reports/outstanding-fees') })

  if (dash.isLoading) return <Spinner />
  if (dash.isError) return <ErrorBanner message={(dash.error as Error).message} />
  const d = dash.data!

  const maxDaily = Math.max(...(collections.data?.monthly.map((x) => x.total) ?? [0]), 1)
  const maxExp = Math.max(...(expenses.data?.map((x) => x.total) ?? [0]), 1)
  const maxClass = Math.max(...(byClass.data?.map((x) => x.count) ?? [0]), 1)

  return (
    <div>
      <PageHeader title="Dashboard" crumb="Term 2 2025 • Overview" />

      <div className="grid grid-4 mb">
        <StatCard label="Students" value={d.total_students} tone="plain" sub={<><Chip tone="blue">Active</Chip> across {byClass.data?.length ?? 0} classes</>} />
        <StatCard label="Fees Collected" value={money(d.fees_collected)} tone="pos" sub="All terms" />
        <StatCard label="Outstanding Fees" value={money(d.outstanding_fees)} tone="neg" sub={`${debtors.data?.length ?? 0} debtors`} />
        <StatCard label="Cash / Bank Balance" value={money(d.cash_bank_balance)} tone={d.cash_bank_balance >= 0 ? 'pos' : 'neg'} sub="From cashbook" />
      </div>

      <div className="card mb">
        <div className="flex" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 className="section" style={{ marginBottom: 2 }}>Teaching tools</h2>
            <div className="muted small">Mark attendance and enter term results</div>
          </div>
          <div className="flex">
            <Link to="/attendance" className="btn primary">☑ Attendance register</Link>
            <Link to="/grades" className="btn">↯ Enter grades</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-2 mb">
        <div className="card">
          <h2 className="section">Cash collections (recent)</h2>
          {collections.isError ? <ErrorBanner message={(collections.error as Error).message} /> :
            collections.data?.monthly.length ? (
              <>
                <div className="mini-bars" title="Monthly receipts">
                  {collections.data.monthly.map((m) => {
                    const label = new Date(m.month + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
                    return (
                      <div key={m.month} style={{ flexGrow: 1 }} title={`${m.month}: ${money(m.total)}`}>
                        <div className="mini-bar" style={{ height: `${(m.total / maxDaily) * 100}%` }} />
                        <div className="bar-label">{label}</div>
                      </div>
                    )
                  })}
                </div>
                <div className="muted small mt">Total collected: <b>{money(collections.data.monthly.reduce((s, x) => s + x.total, 0))}</b></div>
              </>
            ) : <Empty />}
        </div>

        <div className="card">
          <h2 className="section">Expenses by category</h2>
          <div className="legend">
            {expenses.data?.map((r) => (
              <span key={r.category} className="item">
                <span className="dot" style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }} />
                {r.category} — {money(r.total)}
              </span>
            ))}
          </div>
          <div className="mini-bars mt">
            {expenses.data?.map((r, i) => (
              <div key={r.category} style={{ flexGrow: 1 }} title={`${r.category}: ${money(r.total)}`}>
                <div className="mini-bar" style={{ height: `${(r.total / maxExp) * 100}%`, opacity: 1 - i * 0.06 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2 className="section">Students per class</h2>
          <div className="flex wrap">
            {byClass.data?.map((c) => (
              <div key={c.class_id} style={{ minWidth: 120 }}>
                <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="small">{c.class_name}</span><span className="small muted">{c.count}</span>
                </div>
                <div style={{ background: 'var(--bg-soft)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${(c.count / maxClass) * 100}%`, height: 8, background: 'linear-gradient(90deg,var(--green),var(--cyan))' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 className="section" style={{ marginBottom: 0 }}>Top outstanding debtors</h2>
            <Link to="/reports" className="muted small">See reports &rarr;</Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Student</th><th>Class</th><th>Charged</th><th className="num">Balance</th></tr></thead>
              <tbody>
                {debtors.data?.slice(0, 6).map((s) => (
                  <tr key={s.student_id}>
                    <td>{s.student_name}</td>
                    <td>{s.class_name}</td>
                    <td>{s.fees_charged}</td>
                    <td className="num" style={{ color: 'var(--red)' }}>{money(s.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}