import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Employee, PayrollRecord } from '../types'
import { PageHeader, Spinner, ErrorBanner, Modal, Empty } from '../components/ui'
import { money, fmtDate } from '../lib'
import { useAuth } from '../auth'

export function Payroll() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'staff' | 'payroll'>('staff')
  const [empOpen, setEmpOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)

  const employees = useQuery({ queryKey: ['employees'], queryFn: () => api<Employee[]>('/api/employees') })
  const payroll = useQuery({ queryKey: ['payroll'], queryFn: () => api<{ rows: PayrollRecord[]; summary: any }>('/api/payroll') })

  const canEdit = user?.role === 'admin' || user?.role === 'bursar'
  const monthlyCost = (employees.data ?? []).reduce((s, e) => s + e.basic_salary + e.allowances - e.deductions, 0)
  const totalPaid = (payroll.data?.rows ?? []).reduce((s, r) => s + (r.net_pay ?? 0), 0)

  return (
    <div>
      <PageHeader
        title="Staff & Payroll"
        crumb="Human resources"
        actions={canEdit && (
          tab === 'staff'
            ? <button className="btn primary" onClick={() => setEmpOpen(true)}>+ Add staff</button>
            : <button className="btn primary" onClick={() => setPayOpen(true)}>+ Run payroll</button>
        )}
      />

      <div className="grid grid-3 mb">
        <div className="card stat"><div className="stat-label">Staff members</div><div className="stat-value" style={{ fontSize: 24 }}>{employees.data?.length ?? '…'}</div><div className="stat-sub">Monthly cost: <b>{money(monthlyCost)}</b></div></div>
        <div className="card stat"><div className="stat-label">Payroll records</div><div className="stat-value" style={{ fontSize: 24 }}>{payroll.data?.rows.length ?? '…'}</div></div>
        <div className="card stat"><div className="stat-label">Total salaries paid</div><div className="stat-value" style={{ fontSize: 24 }}>{money(totalPaid)}</div></div>
      </div>

      <div className="tabs">
        <button className={`tab${tab === 'staff' ? ' active' : ''}`} onClick={() => setTab('staff')}>Staff</button>
        <button className={`tab${tab === 'payroll' ? ' active' : ''}`} onClick={() => setTab('payroll')}>Payroll records</button>
      </div>

      {tab === 'staff' ? (
        <div className="table-wrap">
          {employees.isError && <ErrorBanner message={(employees.error as Error).message} />}
          <table className="data">
            <thead><tr><th>Code</th><th>Name</th><th>Role</th><th>Hired</th><th>Status</th><th className="num">Basic</th><th className="num">Allowances</th><th className="num">Deductions</th><th className="num">Net</th></tr></thead>
            <tbody>
              {employees.isLoading ? <tr><td colSpan={9}><Spinner /></td></tr> : null}
              {employees.data?.map((e) => (
                <tr key={e.id}>
                  <td className="muted" style={{ fontWeight: 600 }}>{e.employee_id}</td>
                  <td>{e.first_name} {e.last_name}</td>
                  <td>{e.role}</td>
                  <td>{fmtDate(e.hire_date)}</td>
                  <td><span className={`chip ${e.status === 'active' ? 'green' : 'red'}`}>{e.status}</span></td>
                  <td className="num">{money(e.basic_salary)}</td>
                  <td className="num" style={{ color: 'var(--green)' }}>{money(e.allowances)}</td>
                  <td className="num" style={{ color: 'var(--red)' }}>−{money(e.deductions)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{money(e.basic_salary + e.allowances - e.deductions)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="tfoot"><td colSpan={5}>Monthly total</td><td className="num">{money((employees.data ?? []).reduce((s, e) => s + e.basic_salary, 0))}</td><td className="num">{money((employees.data ?? []).reduce((s, e) => s + e.allowances, 0))}</td><td className="num">−{money((employees.data ?? []).reduce((s, e) => s + e.deductions, 0))}</td><td className="num">{money(monthlyCost)}</td></tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          {payroll.isError && <ErrorBanner message={(payroll.error as Error).message} />}
          <table className="data">
            <thead><tr><th>Employee</th><th>Period</th><th>Paid on</th><th className="num">Basic</th><th className="num">Allowances</th><th className="num">Deductions</th><th className="num">Net pay</th></tr></thead>
            <tbody>
              {payroll.isLoading ? <tr><td colSpan={7}><Spinner /></td></tr> : null}
              {payroll.data?.rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{r.employee_name ?? r.employee_id}</td>
                  <td>{fmtDate(r.period_start)} → {fmtDate(r.period_end)}</td>
                  <td>{fmtDate(r.pay_date)}</td>
                  <td className="num">{money(r.basic_salary)}</td>
                  <td className="num" style={{ color: 'var(--green)' }}>{money(r.allowances)}</td>
                  <td className="num" style={{ color: 'var(--red)' }}>−{money(r.deductions)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{money(r.net_pay)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="tfoot"><td colSpan={6}>Total net paid</td><td className="num">{money(totalPaid)}</td></tr>
            </tfoot>
          </table>
          {payroll.data?.rows.length === 0 && <Empty>No payroll runs yet</Empty>}
        </div>
      )}

      {empOpen && <EmployeeModal onClose={() => setEmpOpen(false)} />}
      {payOpen && <PayrollModal employees={employees.data ?? []} onClose={() => setPayOpen(false)} />}
    </div>
  )
}

function EmployeeModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ first_name: '', last_name: '', role: '', basic_salary: '', allowances: '', deductions: '', hire_date: new Date().toISOString().slice(0, 10) })
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const add = useMutation({
    mutationFn: () => api('/api/employees', { method: 'POST', body: JSON.stringify({ ...f, basic_salary: Number(f.basic_salary) || 0, allowances: Number(f.allowances) || 0, deductions: Number(f.deductions) || 0 }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); onClose() },
  })
  return (
    <Modal open title="Add staff member" onClose={onClose}>
      {add.error && <ErrorBanner message={(add.error as Error).message} />}
      <div className="form-row">
        <div className="field"><label>First name</label><input className="input" value={f.first_name} onChange={(e) => set('first_name', e.target.value)} autoFocus /></div>
        <div className="field"><label>Last name</label><input className="input" value={f.last_name} onChange={(e) => set('last_name', e.target.value)} /></div>
      </div>
      <div className="field"><label>Role</label>
        <select value={f.role} onChange={(e) => set('role', e.target.value)}>
          <option value="">Select role…</option>
          <option>Teacher</option><option>Bursar</option><option>Headmaster</option><option>Administrator</option><option>Admin Assistant</option><option>Security Guard</option><option>Cleaner</option><option>Librarian</option><option>Lab Technician</option>
        </select>
      </div>
      <div className="form-row-3">
        <div className="field"><label>Basic salary</label><input className="input" type="number" min="0" value={f.basic_salary} onChange={(e) => set('basic_salary', e.target.value)} /></div>
        <div className="field"><label>Allowances</label><input className="input" type="number" min="0" value={f.allowances} onChange={(e) => set('allowances', e.target.value)} /></div>
        <div className="field"><label>Deductions</label><input className="input" type="number" min="0" value={f.deductions} onChange={(e) => set('deductions', e.target.value)} /></div>
      </div>
      <div className="field"><label>Hire date</label><input className="input" type="date" value={f.hire_date} onChange={(e) => set('hire_date', e.target.value)} /></div>
      <div className="m-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={add.isPending || !f.first_name || !f.last_name || !f.role} onClick={() => add.mutate()}>{add.isPending ? 'Saving…' : 'Add staff'}</button>
      </div>
    </Modal>
  )
}

function PayrollModal({ employees, onClose }: { employees: Employee[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [employee_id, setEmp] = useState('')
  const [periodStart, setStart] = useState(new Date().toISOString().slice(0, 10))
  const [periodEnd, setEnd] = useState(new Date().toISOString().slice(0, 10))
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))

  const run = useMutation({
    mutationFn: () => api('/api/payroll', { method: 'POST', body: JSON.stringify({ employee_id, period_start: periodStart, period_end: periodEnd, pay_date: payDate }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll'] }); onClose() },
  })

  return (
    <Modal open title="Run payroll" onClose={onClose}>
      {run.error && <ErrorBanner message={(run.error as Error).message} />}
      <div className="field"><label>Employee</label>
        <select value={employee_id} onChange={(e) => setEmp(e.target.value)}>
          <option value="">Select employee…</option>
          {employees.map((e) => <option key={e.id} value={e.employee_id}>{e.first_name} {e.last_name} — {e.role}</option>)}
        </select>
      </div>
      <div className="form-row-3">
        <div className="field"><label>Period start</label><input className="input" type="date" value={periodStart} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="field"><label>Period end</label><input className="input" type="date" value={periodEnd} onChange={(e) => setEnd(e.target.value)} /></div>
        <div className="field"><label>Pay date</label><input className="input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
      </div>
      <div className="muted small mb">Net pay is computed from the employee's basic salary + allowances − deductions. Ledger entries (Dr Salaries / Cr Cash) will be posted automatically.</div>
      <div className="m-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={run.isPending || !employee_id} onClick={() => run.mutate()}>{run.isPending ? 'Processing…' : 'Run payroll'}</button>
      </div>
    </Modal>
  )
}