import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Expense, ExpenseCategory, Supplier } from '../types'
import { PageHeader, Spinner, ErrorBanner, Modal, Empty } from '../components/ui'
import { money, fmtDate } from '../lib'
import { useAuth } from '../auth'

export function Expenses() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState('')

  const expenses = useQuery({
    queryKey: ['expenses', year],
    queryFn: () => api<{ rows: Expense[]; total: number }>(`/api/expenses${year ? '?year=' + year : ''}`),
  })
  const cats = useQuery({ queryKey: ['expense-cats'], queryFn: () => api<ExpenseCategory[]>('/api/expense-categories') })
  const suppliers = useQuery({ queryKey: ['suppliers-opt'], queryFn: () => api<Supplier[]>('/api/suppliers') })

  const canEdit = user?.role === 'admin' || user?.role === 'bursar'

  return (
    <div>
      <PageHeader title="Expenses" crumb="Operating expenses" actions={canEdit && <button className="btn primary" onClick={() => setOpen(true)}>+ Record expense</button>} />

      <div className="toolbar">
        <input className="search" placeholder="Filter by year (e.g. 2025)…" value={year} onChange={(e) => setYear(e.target.value)} />
        <span className="spacer" />
        <span className="muted small">Year total: <b style={{ color: 'var(--red)' }}>{money(expenses.data?.total ?? 0)}</b></span>
      </div>

      {expenses.isError && <ErrorBanner message={(expenses.error as Error).message} />}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Date</th><th>Category</th><th>Supplier</th><th>Description</th><th>Method</th><th>Receipt</th><th className="num">Amount</th></tr>
          </thead>
          <tbody>
            {expenses.isLoading ? <tr><td colSpan={7}><Spinner /></td></tr> : null}
            {expenses.data?.rows.map((e) => (
              <tr key={e.id}>
                <td>{fmtDate(e.date)}</td>
                <td><span className="chip violet">{e.category}</span></td>
                <td>{e.supplier || '—'}</td>
                <td>{e.description}</td>
                <td className="muted">{e.payment_method}</td>
                <td className="muted">{e.receipt}</td>
                <td className="num" style={{ color: 'var(--red)', fontWeight: 600 }}>−{money(e.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tfoot"><td colSpan={6}>Total</td><td className="num" style={{ color: 'var(--red)' }}>−{money(expenses.data?.total ?? 0)}</td></tr>
          </tfoot>
        </table>
        {expenses.data?.rows.length === 0 && <Empty>No expenses recorded</Empty>}
      </div>

      {open && (
        <ExpenseModal
          cats={cats.data ?? []}
          suppliers={suppliers.data ?? []}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

function ExpenseModal({ cats, suppliers, onClose }: { cats: ExpenseCategory[]; suppliers: Supplier[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({
    category: cats[0]?.id ?? '',
    supplier_id: '',
    description: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    payment_method: 'Cash',
    receipt: '',
  })
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }))

  const save = useMutation({
    mutationFn: () => api('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({
        category: Number(f.category),
        supplier_id: f.supplier_id ? Number(f.supplier_id) : null,
        description: f.description,
        amount: Number(f.amount),
        date: f.date,
        payment_method: f.payment_method,
        receipt: f.receipt,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    },
  })

  return (
    <Modal open title="Record expense" onClose={onClose}>
      {save.error && <ErrorBanner message={(save.error as Error).message} />}
      <div className="form-row">
        <div className="field"><label>Category</label>
          <select value={f.category} onChange={(e) => set('category', e.target.value)}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.category}</option>)}
          </select>
        </div>
        <div className="field"><label>Supplier (optional)</label>
          <select value={f.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
            <option value="">— None —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label>Description</label><input className="input" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Electricity bill" /></div>
      <div className="form-row">
        <div className="field"><label>Amount ($)</label><input className="input" type="number" min="0" step="0.01" value={f.amount} onChange={(e) => set('amount', e.target.value)} autoFocus /></div>
        <div className="field"><label>Date</label><input className="input" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>Payment method</label>
          <select value={f.payment_method} onChange={(e) => set('payment_method', e.target.value)}><option>Cash</option><option>Bank Transfer</option><option>Mobile Money</option><option>Cheque</option></select>
        </div>
        <div className="field"><label>Receipt #</label><input className="input" value={f.receipt} onChange={(e) => set('receipt', e.target.value)} /></div>
      </div>
      <div className="m-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={save.isPending || !f.category || !f.amount} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Record expense'}</button>
      </div>
    </Modal>
  )
}