import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Student } from '../types'
import { PageHeader, Spinner, ErrorBanner, Chip, Modal, Empty } from '../components/ui'
import { money, statusChip, statusLabel, fullName } from '../lib'
import { useAuth } from '../auth'

export function Fees() {
  const { user } = useAuth()
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState('')
  const [chargeOpen, setChargeOpen] = useState(false)

  const fees = useQuery({
    queryKey: ['fees', term, status],
    queryFn: () => api<any[]>('/api/fees' + (term ? '?term=' + encodeURIComponent(term) : '')),
  })
  const terms = useQuery({ queryKey: ['terms'], queryFn: () => api<any[]>(`/api/fees/detail`).then((r) => [...new Set(r.map((x) => x.term))]) })

  const canEdit = user?.role === 'admin' || user?.role === 'bursar'

  const filtered = (fees.data ?? []).filter((r) => !status || r.status === status)
  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0)
  const totalPaid = filtered.reduce((s, r) => s + r.paid, 0)
  const totalBal = filtered.reduce((s, r) => s + r.balance, 0)

  return (
    <div>
      <PageHeader title="Fees & Statements" crumb="Fees charged per student per term" actions={canEdit && <button className="btn primary" onClick={() => setChargeOpen(true)}>+ Charge fees</button>} />

      <div className="toolbar">
        <select className="search" style={{ minWidth: 140 }} value={term} onChange={(e) => setTerm(e.target.value)}>
          <option value="">All terms</option>
          {terms.data?.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select style={{ minWidth: 120 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <span className="spacer" />
        <span className="muted small">{fees.data?.length ?? '…'} statements</span>
      </div>

      {fees.isError && <ErrorBanner message={(fees.error as Error).message} />}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Student</th><th>Class</th><th>Term</th><th>Items</th><th>Status</th>
              <th className="num">Charged</th><th className="num">Paid</th><th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {fees.isLoading ? <tr><td colSpan={8}><Spinner /></td></tr> : null}
            {filtered.map((r) => (
              <tr key={r.student_id + r.term}>
                <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                <td className="muted">{r.class_name}</td>
                <td>{r.term}</td>
                <td>{r.fee_items}</td>
                <td><Chip tone={statusChip(r.status)}>{statusLabel(r.status)}</Chip></td>
                <td className="num">{money(r.amount)}</td>
                <td className="num" style={{ color: 'var(--green)' }}>{money(r.paid)}</td>
                <td className="num" style={{ color: r.balance > 0 ? 'var(--red)' : undefined, fontWeight: 600 }}>{money(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tfoot">
              <td colSpan={5}>Totals</td>
              <td className="num">{money(totalAmount)}</td>
              <td className="num" style={{ color: 'var(--green)' }}>{money(totalPaid)}</td>
              <td className="num" style={{ color: totalBal > 0 ? 'var(--red)' : undefined }}>{money(totalBal)}</td>
            </tr>
          </tfoot>
        </table>
        {filtered.length === 0 && <Empty>No fee statements</Empty>}
      </div>

      {chargeOpen && <ChargeModal onClose={() => setChargeOpen(false)} />}
    </div>
  )
}

function ChargeModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [studentId, setStudentId] = useState<number>(0)
  const [term, setTerm] = useState('Term 1 2025')
  const [amount, setAmount] = useState('')
  const [feeType, setFeeType] = useState('School Fees')
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10))

  const students = useQuery({ queryKey: ['students-opt'], queryFn: () => api<Student[]>('/api/students?q=') })
  const terms = useQuery({ queryKey: ['terms-opt'], queryFn: () => api<any[]>(`/api/fees/detail`).then((r) => [...new Set(r.map((x) => x.term))]) })

  const charge = useMutation({
    mutationFn: () => api('/api/fees', { method: 'POST', body: JSON.stringify({ student_id: studentId, term, fee_type: feeType, amount: Number(amount), due_date: dueDate }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fees'] })
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    },
  })

  return (
    <Modal open title="Charge fees to a student" onClose={onClose}>
      {charge.error && <ErrorBanner message={(charge.error as Error).message} />}
      <div className="field"><label>Student</label>
        <select value={studentId} onChange={(e) => setStudentId(Number(e.target.value))}>
          <option value={0}>Select student…</option>
          {students.data?.map((s) => <option key={s.id} value={s.id}>{fullName(s)} ({s.student_id})</option>)}
        </select>
      </div>
      <div className="form-row">
        <div className="field"><label>Term</label>
          <select value={term} onChange={(e) => setTerm(e.target.value)}>
            {(terms.data?.length ? terms.data : ['Term 1 2025', 'Term 2 2025', 'Term 3 2025']).map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field"><label>Fee type</label>
          <select value={feeType} onChange={(e) => setFeeType(e.target.value)}><option>School Fees</option><option>Development Levy</option><option>Exam Fees</option><option>Boarding Fees</option></select>
        </div>
      </div>
      <div className="form-row">
        <div className="field"><label>Amount ($)</label><input className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></div>
        <div className="field"><label>Due date</label><input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
      </div>
      <div className="m-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={charge.isPending || !studentId || !amount} onClick={() => charge.mutate()}>{charge.isPending ? 'Charging…' : 'Charge fee'}</button>
      </div>
    </Modal>
  )
}