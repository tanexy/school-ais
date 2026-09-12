import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Payment, Student } from '../types'
import { PageHeader, Spinner, ErrorBanner, Modal, Empty } from '../components/ui'
import { money, fmtDate, fullName } from '../lib'
import { useAuth } from '../auth'

export function Payments() {
  const { user } = useAuth()
  const [recordOpen, setRecordOpen] = useState(false)
  const [q, setQ] = useState('')

  const payments = useQuery({
    queryKey: ['payments', q],
    queryFn: () => api<Payment[]>(`/api/payments${q ? '?q=' + encodeURIComponent(q) : ''}`),
  })

  const canEdit = user?.role === 'admin' || user?.role === 'bursar'
  const total = (payments.data ?? []).reduce((s, p) => s + p.amount, 0)

  return (
    <div>
      <PageHeader title="Fee Payments" crumb="All receipts of fees collected" actions={canEdit && <button className="btn primary" onClick={() => setRecordOpen(true)}>+ Record payment</button>} />

      <div className="toolbar">
        <input className="search" placeholder="Search receipt, student…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="spacer" />
        <span className="muted small">Total collected: <b>{money(total)}</b></span>
      </div>

      {payments.isError && <ErrorBanner message={(payments.error as Error).message} />}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Receipt</th><th>Date</th><th>Student</th><th>Method</th><th>Term</th><th>Description</th><th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {payments.isLoading ? <tr><td colSpan={7}><Spinner /></td></tr> : null}
            {payments.data?.map((p) => (
              <tr key={p.id}>
                <td className="muted" style={{ fontWeight: 600 }}>{p.receipt_number}</td>
                <td>{fmtDate(p.date)}</td>
                <td>{p.student_name}</td>
                <td><span className="chip cyan">{p.method}</span></td>
                <td>{p.term}</td>
                <td className="muted">{p.description}</td>
                <td className="num" style={{ color: 'var(--green)', fontWeight: 600 }}>+{money(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.data?.length === 0 && <Empty>No payments yet</Empty>}
      </div>

      {recordOpen && <RecordPayment onClose={() => setRecordOpen(false)} />}
    </div>
  )
}

function RecordPayment({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [studentId, setStudentId] = useState<number>(0)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Cash')
  const [term, setTerm] = useState('Term 1 2025')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [desc, setDesc] = useState('')

  const students = useQuery({ queryKey: ['students-opt-pay'], queryFn: () => api<Student[]>('/api/students?q=') })
  const feeTerms = useQuery({ queryKey: ['terms-opt-pay'], queryFn: () => api<any[]>(`/api/fees/detail`).then((r) => [...new Set(r.map((x) => x.term))]) })

  const record = useMutation({
    mutationFn: () => api('/api/payments', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, amount: Number(amount), method, term, date, description: desc }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['fees'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['collections'] })
      onClose()
    },
  })

  return (
    <Modal open title="Record fee payment" onClose={onClose}>
      {record.error && <ErrorBanner message={(record.error as Error).message} />}
      <div className="field"><label>Student</label>
        <select value={studentId} onChange={(e) => setStudentId(Number(e.target.value))}>
          <option value={0}>Select student…</option>
          {students.data?.map((s) => <option key={s.id} value={s.id}>{fullName(s)} ({s.student_id}) — bal {money(s.balance)}</option>)}
        </select>
      </div>
      <div className="form-row">
        <div className="field"><label>Amount ($)</label><input className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></div>
        <div className="field"><label>Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>Cash</option><option>Bank Transfer</option><option>Mobile Money</option><option>Cheque</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="field"><label>Term</label>
          <select value={term} onChange={(e) => setTerm(e.target.value)}>
            {(feeTerms.data?.length ? feeTerms.data : ['Term 1 2025', 'Term 2 2025', 'Term 3 2025']).map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field"><label>Date</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div className="field"><label>Description</label><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional note" /></div>
      <div className="m-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={record.isPending || !studentId || !amount || Number(amount) <= 0} onClick={() => record.mutate()}>
          {record.isPending ? 'Recording…' : 'Record payment'}
        </button>
      </div>
    </Modal>
  )
}