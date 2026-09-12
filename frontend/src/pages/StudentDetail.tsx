import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import type { Student } from '../types'
import { PageHeader, Spinner, ErrorBanner, Chip, Modal } from '../components/ui'
import { money, fmtDate, statusChip, statusLabel, fullName } from '../lib'
import { useAuth } from '../auth'

export function StudentDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [payOpen, setPayOpen] = useState(false)

  const student = useQuery({
    queryKey: ['student', id],
    queryFn: () => api<Student>(`/api/students/${id}`),
  })

  const pay = useMutation({
    mutationFn: (data: { amount: number; method: string; term: string; description?: string }) =>
      api('/api/payments', { method: 'POST', body: JSON.stringify({ student_id: Number(id), ...data }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', id] })
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setPayOpen(false)
    },
  })

  if (student.isLoading) return <Spinner />
  if (student.isError) return <ErrorBanner message={(student.error as Error).message} />
  const s = student.data!

  const canPay = user?.role === 'admin' || user?.role === 'bursar'

  return (
    <div>
      <PageHeader
        title={fullName(s)}
        crumb={`${s.student_id} • ${s.class_name ?? ''} • ${s.status}`}
        actions={
          canPay && (
            <button className="btn primary" onClick={() => setPayOpen(true)}>+ Record payment</button>
          )
        }
      />

      <div className="grid grid-2 mb">
        <div className="card">
          <h2 className="section">Profile</h2>
          <div className="table-wrap">
            <table className="data">
              <tbody>
                {[
                  ['Student ID', s.student_id],
                  ['Class', s.class_name],
                  ['Gender', s.gender],
                  ['Date of birth', fmtDate(s.date_of_birth)],
                  ['Guardian', s.guardian_name],
                  ['Guardian contact', s.guardian_contact],
                  ['Address', s.address],
                  ['Enrolled', fmtDate(s.date_enrolled)],
                  ['Status', s.status],
                ].map(([k, v]) => (
                  <tr key={k}><td className="muted" style={{ width: 140 }}>{k}</td><td style={{ fontWeight: 500 }}>{v || '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="section">Fee summary</h2>
          <div className="grid grid-3" style={{ gap: 12 }}>
            <div className="card stat" style={{ padding: 14 }}>
              <div className="stat-label">Total charged</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{money(s.fees?.reduce((x, f) => x + f.amount, 0) ?? 0)}</div>
            </div>
            <div className="card stat" style={{ padding: 14 }}>
              <div className="stat-label">Paid</div>
              <div className="stat-value" style={{ fontSize: 20, color: 'var(--green)' }}>{money(s.fees?.reduce((x, f) => x + f.paid, 0) ?? 0)}</div>
            </div>
            <div className="card stat" style={{ padding: 14 }}>
              <div className="stat-label">Balance</div>
              <div className="stat-value" style={{ fontSize: 20, color: (s.balance ?? 0) > 0 ? 'var(--red)' : 'var(--green)' }}>{money(s.balance)}</div>
            </div>
          </div>

          <h2 className="section mt" style={{ marginTop: 20 }}>Charges by term</h2>
          {(s.fees ?? []).length === 0 ? <div className="muted">No fees charged.</div> : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Term</th><th className="num">Charged</th><th className="num">Paid</th><th className="num">Balance</th></tr></thead>
                <tbody>
                  {s.fees?.map((f, i) => (
                    <tr key={i}><td>{f.term}</td><td className="num">{money(f.amount)}</td><td className="num" style={{ color: 'var(--green)' }}>{money(f.paid)}</td><td className="num" style={{ color: f.balance > 0 ? 'var(--red)' : undefined }}>{money(f.balance)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="section mt" style={{ marginTop: 20 }}>Fee line items</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Term</th><th>Fee type</th><th className="num">Amount</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {(s.fee_lines ?? []).map((fl) => (
                  <tr key={fl.id}>
                    <td>{fl.term}</td><td>{fl.fee_type}</td><td className="num">{money(fl.amount)}</td>
                    <td>{fmtDate(fl.due_date)}</td><td><Chip tone={statusChip(fl.status)}>{statusLabel(fl.status)}</Chip></td>
                  </tr>
                ))}
                {(s.fee_lines ?? []).length === 0 && <tr><td colSpan={5} className="muted">No line items.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section">Payment history</h2>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Receipt</th><th>Date</th><th>Method</th><th>Term</th><th>Description</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {(s.payments ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="muted">{p.receipt_number}</td>
                  <td>{fmtDate(p.date)}</td>
                  <td>{p.method}</td>
                  <td>{p.term}</td>
                  <td className="muted">{p.description}</td>
                  <td className="num" style={{ color: 'var(--green)', fontWeight: 600 }}>+{money(p.amount)}</td>
                </tr>
              ))}
              {(s.payments ?? []).length === 0 && <tr><td colSpan={6} className="muted">No payments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {payOpen && <PayModal terms={[...new Set((s.fee_lines ?? []).map((f) => f.term))]} onClose={() => setPayOpen(false)} onPay={(d) => pay.mutate(d)} error={''} />}
    </div>
  )
}

function PayModal({ terms, onClose, onPay, error }: { terms: string[]; onClose: () => void; onPay: (d: any) => void; error: string }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Cash')
  const [term, setTerm] = useState(terms[0] ?? 'Term 1 2025')
  const [desc, setDesc] = useState('')

  return (
    <Modal open title="Record fee payment" onClose={onClose}>
      {error && <ErrorBanner message={error} />}
      <div className="form-row">
        <div className="field"><label>Amount ($)</label><input className="input" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></div>
        <div className="field"><label>Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>Cash</option><option>Bank Transfer</option><option>Mobile Money</option><option>Cheque</option>
          </select>
        </div>
      </div>
      <div className="field"><label>Term</label>
        <select value={term} onChange={(e) => setTerm(e.target.value)}>
          {terms.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="field"><label>Description</label><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional note" /></div>
      <div className="m-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!amount || Number(amount) <= 0} onClick={() => onPay({ amount: Number(amount), method, term, description: desc })}>Record payment</button>
      </div>
    </Modal>
  )
}