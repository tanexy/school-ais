import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { PageHeader, Spinner, ErrorBanner, Chip, Empty } from '../components/ui'
import { money, fmtDate, intl } from '../lib'
import { fullName } from '../lib'

const TABS = [
  'cashbook', 'trial-balance', 'income-expenditure', 'sofp', 'collections',
  'outstanding', 'budget', 'stock', 'payroll', 'statement',
] as const
type Tab = (typeof TABS)[number]

const TAB_LABEL: Record<Tab, string> = {
  cashbook: 'Cashbook', 'trial-balance': 'Trial Balance', 'income-expenditure': 'Income & Expenditure',
  sofp: 'Balance Sheet', collections: 'Collections', outstanding: 'Outstanding Fees',
  budget: 'Budget vs Actual', stock: 'Stock', payroll: 'Payroll', statement: 'Student Statement',
}

export function Reports() {
  const [tab, setTab] = useState<Tab>('cashbook')

  return (
    <div>
      <PageHeader title="Reports" crumb="Accounting & operational reports" />

      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{TAB_LABEL[t]}</button>
        ))}
      </div>

      <button className="btn ghost small" onClick={() => window.print()} style={{ marginBottom: 12 }}>Print / Export PDF</button>

      <ReportView tab={tab} />
    </div>
  )
}

function ReportView({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'cashbook': return <Cashbook />
    case 'trial-balance': return <TrialBalance />
    case 'income-expenditure': return <IncomeExpenditure />
    case 'sofp': return <StatementOfPosition />
    case 'collections': return <Collections />
    case 'outstanding': return <Outstanding />
    case 'budget': return <BudgetActual />
    case 'stock': return <StockReport />
    case 'payroll': return <PayrollReport />
    case 'statement': return <StudentStatement />
  }
}

function useReport<T>(key: string, path: string) {
  return useQuery({ queryKey: [key], queryFn: () => api<T>(path) })
}

function Head({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="report-head">
      <h2>{title}</h2>
      <div className="sub">Acacia College • {sub || 'As at ' + fmtDate(new Date().toISOString())} • Prepared {fmtDate(new Date().toISOString())}</div>
    </div>
  )
}

function Cashbook() {
  const q = useReport<any>('rep-cashbook', '/api/reports/cashbook')
  if (q.isLoading) return <Spinner />
  if (q.isError) return <ErrorBanner message={(q.error as Error).message} />
  return (
    <div>
      <Head title="Cash Book" sub="Bank account 1000 — receipts & payments" />
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Date</th><th>Description</th><th>Ref</th><th className="num">Receipts</th><th className="num">Payments</th><th className="num">Balance</th></tr></thead>
          <tbody>
            {q.data.rows.map((r: any) => (
              <tr key={r.id}>
                <td>{fmtDate(r.date)}</td>
                <td>{r.description}</td>
                <td className="muted">{r.reference_type}</td>
                <td className="num" style={{ color: 'var(--green)' }}>{r.receipts ? '+' + money(r.receipts) : ''}</td>
                <td className="num" style={{ color: 'var(--red)' }}>{r.payments ? '−' + money(r.payments) : ''}</td>
                <td className="num" style={{ fontWeight: 600 }}>{money(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tfoot"><td colSpan={5}>Closing balance</td><td className="num">{money(q.data.closing_balance)}</td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function TrialBalance() {
  const q = useReport<any>('rep-tb', '/api/reports/trial-balance')
  if (q.isLoading) return <Spinner />
  if (q.isError) return <ErrorBanner message={(q.error as Error).message} />
  const balanced = q.data.totals.debit === q.data.totals.credit
  return (
    <div>
      <Head title="Trial Balance" sub="All ledger accounts" />
      <div className="flex mb">
        <Chip tone={balanced ? 'green' : 'red'}>{balanced ? '✓ Balanced' : '✗ Out of balance'}</Chip>
        <span className="muted small">Debit {money(q.data.totals.debit)} = Credit {money(q.data.totals.credit)}</span>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Code</th><th>Account</th><th>Type</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead>
          <tbody>
            {q.data.rows.map((r: any) => (
              <tr key={r.account_code}>
                <td className="muted" style={{ fontWeight: 600 }}>{r.account_code}</td>
                <td style={{ fontWeight: 600 }}>{r.account_name}</td>
                <td className="muted">{r.account_type}</td>
                <td className="num" style={{ color: r.debit ? 'var(--accent)' : undefined }}>{r.debit ? money(r.debit) : ''}</td>
                <td className="num" style={{ color: r.credit ? 'var(--green)' : undefined }}>{r.credit ? money(r.credit) : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tfoot"><td colSpan={3}>Totals</td><td className="num">{money(q.data.totals.debit)}</td><td className="num">{money(q.data.totals.credit)}</td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function IncomeExpenditure() {
  const q = useReport<any>('rep-ie', '/api/reports/income-expenditure')
  if (q.isLoading) return <Spinner />
  if (q.isError) return <ErrorBanner message={(q.error as Error).message} />
  return (
    <div>
      <Head title="Income & Expenditure Statement" sub="Year to date" />
      <div className="grid grid-2">
        <div className="card">
          <h2 className="section" style={{ color: 'var(--green)' }}>Income</h2>
          <table className="data" style={{ width: '100%' }}>
            <tbody>
              {q.data.income.map((r: any) => (
                <tr key={r.account_code}><td>{r.account_name}</td><td className="num">{money(r.balance)}</td></tr>
              ))}
              <tr className="tfoot"><td>Total income</td><td className="num">{money(q.data.total_income)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2 className="section" style={{ color: 'var(--red)' }}>Expenses</h2>
          <table className="data" style={{ width: '100%' }}>
            <tbody>
              {q.data.expenses.map((r: any) => (
                <tr key={r.account_code}><td>{r.account_name}</td><td className="num">−{money(r.balance)}</td></tr>
              ))}
              <tr className="tfoot"><td>Total expenses</td><td className="num">−{money(q.data.total_expenses)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="card mt">
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Surplus / (Deficit)</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: q.data.surplus_deficit >= 0 ? 'var(--green)' : 'var(--red)' }}>{money(q.data.surplus_deficit)}</span>
        </div>
      </div>
    </div>
  )
}

function StatementOfPosition() {
  const q = useReport<any>('rep-sofp', '/api/reports/statement-of-position')
  if (q.isLoading) return <Spinner />
  if (q.isError) return <ErrorBanner message={(q.error as Error).message} />
  const surplus = q.data.total_assets - q.data.total_liabilities - q.data.total_equity
  return (
    <div>
      <Head title="Statement of Financial Position" sub="Balance sheet" />
      <div className="grid grid-2">
        <div className="card">
          <h2 className="section">Assets</h2>
          <table className="data" style={{ width: '100%' }}>
            <tbody>
              {q.data.assets.map((r: any) => (
                <tr key={r.account_code}><td>{r.account_name}</td><td className="num">{money(r.balance)}</td></tr>
              ))}
              <tr className="tfoot"><td>Total assets</td><td className="num">{money(q.data.total_assets)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <div className="card mb">
            <h2 className="section">Liabilities</h2>
            <table className="data" style={{ width: '100%' }}>
              <tbody>
                {q.data.liabilities.map((r: any) => (
                  <tr key={r.account_code}><td>{r.account_name}</td><td className="num">{money(r.balance)}</td></tr>
                ))}
                <tr className="tfoot"><td>Total liabilities</td><td className="num">{money(q.data.total_liabilities)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="card">
            <h2 className="section">Equity</h2>
            <table className="data" style={{ width: '100%' }}>
              <tbody>
                {q.data.equity.map((r: any) => (
                  <tr key={r.account_code}><td>{r.account_name}</td><td className="num">{money(r.balance)}</td></tr>
                ))}
                <tr><td>Surplus / (deficit)</td><td className="num" style={{ color: surplus >= 0 ? 'var(--green)' : 'var(--red)' }}>{money(surplus)}</td></tr>
                <tr className="tfoot"><td>Total equity</td><td className="num">{money(q.data.total_equity + surplus)}</td></tr>
              </tbody>
            </table>
            <div className="mt muted small" style={{ textAlign: 'right' }}>
              Assets {money(q.data.total_assets)} = Liabilities {money(q.data.total_liabilities)} + Equity {money(q.data.total_equity + surplus)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Collections() {
  const q = useReport<any>('rep-collections', '/api/reports/collections')
  if (q.isLoading) return <Spinner />
  if (q.isError) return <ErrorBanner message={(q.error as Error).message} />
  if (!q.data) return <Spinner />
  const total = q.data.by_term.reduce((s: number, r: any) => s + r.total, 0)
  return (
    <div>
      <Head title="Fee Collections" sub="Breakdown by term, month & method" />
      <div className="grid grid-2 mb">
        <div className="card">
          <h2 className="section">By term</h2>
          <table className="data" style={{ width: '100%' }}>
            <tbody>
              {q.data.by_term.map((r: any) => (
                <tr key={r.term}><td>{r.term}</td><td className="num muted">{r.count} receipts</td><td className="num" style={{ fontWeight: 600 }}>{money(r.total)}</td></tr>
              ))}
              <tr className="tfoot"><td>Total</td><td></td><td className="num">{money(total)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2 className="section">By payment method</h2>
          <table className="data" style={{ width: '100%' }}>
            <tbody>
              {q.data.by_method.map((r: any) => (
                <tr key={r.method}><td>{r.method}</td><td className="num muted">{r.count} receipts</td><td className="num" style={{ fontWeight: 600 }}>{money(r.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2 className="section">Monthly trend</h2>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Month</th><th className="num">Receipts</th><th className="num">Total</th></tr></thead>
            <tbody>
              {q.data.monthly.map((r: any) => (
                <tr key={r.month}><td>{r.month}</td><td className="num">{r.count}</td><td className="num" style={{ fontWeight: 600 }}>{money(r.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Outstanding() {
  const q = useReport<any[]>('rep-outstanding', '/api/reports/outstanding-fees')
  if (q.isLoading) return <Spinner />
  if (q.isError) return <ErrorBanner message={(q.error as Error).message} />
  if (!q.data) return <Spinner />
  const total = q.data.reduce((s, r) => s + r.balance, 0)
  return (
    <div>
      <Head title="Outstanding Fees / Debtors" sub="Students with unpaid balances" />
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Code</th><th>Student</th><th>Class</th><th className="num">Charged</th><th className="num">Paid</th><th className="num">Balance</th></tr></thead>
          <tbody>
            {q.data.map((r: any) => (
              <tr key={r.student_id}>
                <td className="muted">{r.code}</td>
                <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                <td>{r.class_name}</td>
                <td className="num">{money(r.fees_charged)}</td>
                <td className="num" style={{ color: 'var(--green)' }}>{money(r.amount_paid)}</td>
                <td className="num" style={{ color: 'var(--red)', fontWeight: 600 }}>{money(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tfoot"><td colSpan={3}>{q.data.length} debtors</td><td className="num">{money(q.data.reduce((s, r) => s + r.fees_charged, 0))}</td><td className="num">{money(q.data.reduce((s, r) => s + r.amount_paid, 0))}</td><td className="num" style={{ color: 'var(--red)' }}>{money(total)}</td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function BudgetActual() {
  const q = useReport<any>('rep-budget', '/api/reports/budget-vs-actual')
  if (q.isLoading) return <Spinner />
  if (q.isError) return <ErrorBanner message={(q.error as Error).message} />
  if (!q.data) return <Spinner />
  return (
    <div>
      <Head title="Budget vs Actual" sub="Annual expense budget against actuals" />
      <div className="grid grid-2 mb">
        <div className="card stat"><div className="stat-label">Budget</div><div className="stat-value">{money(q.data.total_budget)}</div></div>
        <div className="card stat"><div className="stat-label">Actual</div><div className="stat-value" style={{ color: 'var(--red)' }}>{money(q.data.total_actual)}</div></div>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Category</th><th className="num">Budget</th><th className="num">Actual</th><th className="num">Variance</th><th className="num">% used</th></tr></thead>
          <tbody>
            {q.data.rows.map((r: any) => (
              <tr key={r.category}>
                <td style={{ textTransform: 'capitalize' }}>{r.category.replace('_', ' ')}</td>
                <td className="num">{money(r.budget)}</td>
                <td className="num" style={{ color: 'var(--red)' }}>{money(r.actual)}</td>
                <td className="num" style={{ color: r.variance >= 0 ? 'var(--green)' : 'var(--red)' }}>{r.variance >= 0 ? '+' : ''}{money(r.variance)}</td>
                <td className="num">{r.budget ? intl(Math.round((r.actual / r.budget) * 100)) : '—'}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tfoot"><td>Total</td><td className="num">{money(q.data.total_budget)}</td><td className="num" style={{ color: 'var(--red)' }}>{money(q.data.total_actual)}</td><td className="num">{money(q.data.total_budget - q.data.total_actual)}</td><td className="num"></td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function StockReport() {
  const q = useReport<any[]>('rep-stock', '/api/reports/stock')
  if (q.isLoading) return <Spinner />
  if (q.isError) return <ErrorBanner message={(q.error as Error).message} />
  if (!q.data) return <Spinner />
  const value = q.data.reduce((s, r) => s + r.quantity_on_hand * r.unit_cost, 0)
  return (
    <div>
      <Head title="Stock Report" sub="Inventory on hand" />
      <div className="card mb stat"><div className="stat-label">Total stock value</div><div className="stat-value" style={{ fontSize: 22 }}>{money(value)}</div></div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Item</th><th>Supplier</th><th className="num">On hand</th><th className="num">Reorder</th><th className="num">Unit cost</th><th className="num">Value</th><th>Status</th></tr></thead>
          <tbody>
            {q.data.map((r: any) => {
              const low = r.quantity_on_hand <= r.reorder_level
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td className="muted">{r.supplier_name || '—'}</td>
                  <td className="num">{r.quantity_on_hand}</td>
                  <td className="num muted">{r.reorder_level}</td>
                  <td className="num">{money(r.unit_cost)}</td>
                  <td className="num">{money(r.quantity_on_hand * r.unit_cost)}</td>
                  <td><Chip tone={low ? 'amber' : 'green'}>{low ? 'Low' : 'OK'}</Chip></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {q.data.length === 0 && <Empty>No inventory</Empty>}
      </div>
    </div>
  )
}

function PayrollReport() {
  const q = useReport<any>('rep-payroll-acc', '/api/reports/payroll')
  if (q.isLoading) return <Spinner />
  if (q.isError) return <ErrorBanner message={(q.error as Error).message} />
  if (!q.data) return <Spinner />
  return (
    <div>
      <Head title="Payroll Summary" sub="All payroll runs" />
      <div className="grid grid-4 mb">
        <div className="card stat"><div className="stat-label">Basic</div><div className="stat-value" style={{ fontSize: 18 }}>{money(q.data.totals.basic)}</div></div>
        <div className="card stat"><div className="stat-label">Allowances</div><div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>{money(q.data.totals.allowances)}</div></div>
        <div className="card stat"><div className="stat-label">Deductions</div><div className="stat-value" style={{ fontSize: 18, color: 'var(--red)' }}>−{money(q.data.totals.deductions)}</div></div>
        <div className="card stat"><div className="stat-label">Net paid</div><div className="stat-value" style={{ fontSize: 18 }}>{money(q.data.totals.net)}</div></div>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Employee</th><th>Role</th><th>Period</th><th className="num">Basic</th><th className="num">Allow</th><th className="num">Deduct</th><th className="num">Net</th></tr></thead>
          <tbody>
            {q.data.rows.map((r: any) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.employee_name}</td>
                <td className="muted">{r.employee_role}</td>
                <td>{fmtDate(r.period_start)} → {fmtDate(r.period_end)}</td>
                <td className="num">{money(r.basic_salary)}</td>
                <td className="num" style={{ color: 'var(--green)' }}>{money(r.allowances)}</td>
                <td className="num" style={{ color: 'var(--red)' }}>−{money(r.deductions)}</td>
                <td className="num" style={{ fontWeight: 600 }}>{money(r.net_salary)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StudentStatement() {
  const [id, setId] = useState(0)
  const students = useQuery({ queryKey: ['students-opt-rep'], queryFn: () => api<any[]>('/api/students?q=') })
  const stmt = useQuery({
    queryKey: ['statement', id],
    queryFn: () => api<any>(`/api/reports/student-statement/${id}`),
    enabled: !!id,
  })

  return (
    <div>
      <Head title="Student Statement" sub="Fees charged, payments received & running balance" />
      <div className="toolbar">
        <select value={id} onChange={(e) => setId(Number(e.target.value))} style={{ minWidth: 260 }}>
          <option value={0}>Select student…</option>
          {students.data?.map((s) => <option key={s.id} value={s.id}>{fullName(s)} ({s.student_id})</option>)}
        </select>
      </div>
      {stmt.isLoading && <Spinner />}
      {stmt.isError && <ErrorBanner message={(stmt.error as Error).message} />}
      {stmt.data && (
        <>
          <div className="card mb">
            <div className="flex" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{stmt.data.student.first_name} {stmt.data.student.last_name}</div>
                <div className="muted small">{stmt.data.student.student_id} • guardian: {stmt.data.student.guardian_name} ({stmt.data.student.guardian_contact})</div>
              </div>
              <div className="flex" style={{ gap: 24 }}>
                <div><div className="stat-label muted">Charged</div><div style={{ fontWeight: 700 }}>{money(stmt.data.total_fees)}</div></div>
                <div><div className="stat-label muted">Paid</div><div style={{ fontWeight: 700, color: 'var(--green)' }}>{money(stmt.data.total_paid)}</div></div>
                <div><div className="stat-label muted">Balance</div><div style={{ fontWeight: 700, color: stmt.data.balance > 0 ? 'var(--red)' : 'var(--green)' }}>{money(stmt.data.balance)}</div></div>
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Date / Term</th><th>Details</th><th>Type</th><th className="num">Debit (charge)</th><th className="num">Credit (payment)</th></tr></thead>
              <tbody>
                {stmt.data.fees.map((f: any) => (
                  <tr key={'f' + f.id}>
                    <td>{f.term}</td>
                    <td>{f.fee_type}</td>
                    <td><span className="chip blue">Charge</span></td>
                    <td className="num">{money(f.amount)}</td>
                    <td className="num"></td>
                  </tr>
                ))}
                {stmt.data.payments.map((p: any) => (
                  <tr key={'p' + p.id}>
                    <td>{fmtDate(p.date)}</td>
                    <td>{p.description || 'Fee payment'} {p.method}</td>
                    <td><span className="chip green">Payment</span></td>
                    <td className="num"></td>
                    <td className="num">{money(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tfoot"><td colSpan={3}>Totals</td><td className="num">{money(stmt.data.total_fees)}</td><td className="num">{money(stmt.data.total_paid)}</td></tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}