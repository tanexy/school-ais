import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { ClassInfo } from '../types'
import { PageHeader, ErrorBanner, Modal } from '../components/ui'
import { money } from '../lib'
import { useAuth } from '../auth'

export function Classes() {
  const { user } = useAuth()
  const [addOpen, setAddOpen] = useState(false)

  const classes = useQuery({ queryKey: ['classes'], queryFn: () => api<ClassInfo[]>('/api/classes') })
  const byClass = useQuery({ queryKey: ['by-class'], queryFn: () => api<any[]>('/api/reports/students-by-class') })

  if (classes.isError) return <ErrorBanner message={(classes.error as Error).message} />

  const studentsMap = Object.fromEntries((byClass.data ?? []).map((c) => [c.class_name, c.count]))
  const canEdit = user?.role === 'admin'

  return (
    <div>
      <PageHeader title="Classes" crumb="Student classes & fee structure" actions={canEdit && <button className="btn primary" onClick={() => setAddOpen(true)}>+ Add class</button>} />

      <div className="grid grid-3">
        {classes.data?.map((c) => (
          <div className="card" key={c.id}>
            <div className="flex" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 16 }}>{c.name}</h3>
              <span className="chip blue">{studentsMap[c.name] ?? 0} students</span>
            </div>
            <div className="grid grid-2 mt">
              <div>
                <div className="stat-label muted">School fees</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{money(c.school_fees)}</div>
              </div>
              <div>
                <div className="stat-label muted">Dev levy</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{money(c.development_levy)}</div>
              </div>
            </div>
            <div className="mt muted small">Total per term: <b style={{ color: 'var(--text)' }}>{money((c.school_fees ?? 0) + (c.development_levy ?? 0))}</b></div>
          </div>
        ))}
      </div>

      {addOpen && <AddClassModal onClose={() => setAddOpen(false)} />}
    </div>
  )
}

function AddClassModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ name: '', school_fees: '', development_levy: '' })
  const add = useMutation({
    mutationFn: () => api('/api/classes', { method: 'POST', body: JSON.stringify({ name: f.name, school_fees: Number(f.school_fees) || 0, development_levy: Number(f.development_levy) || 0 }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['classes'] }); onClose() },
  })
  return (
    <Modal open title="Add class" onClose={onClose}>
      {add.error && <ErrorBanner message={(add.error as Error).message} />}
      <div className="field"><label>Class name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Form 4" autoFocus /></div>
      <div className="form-row">
        <div className="field"><label>School fees per term</label><input className="input" type="number" min="0" value={f.school_fees} onChange={(e) => setF({ ...f, school_fees: e.target.value })} /></div>
        <div className="field"><label>Development levy</label><input className="input" type="number" min="0" value={f.development_levy} onChange={(e) => setF({ ...f, development_levy: e.target.value })} /></div>
      </div>
      <div className="m-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={add.isPending || !f.name} onClick={() => add.mutate()}>{add.isPending ? 'Saving…' : 'Add class'}</button>
      </div>
    </Modal>
  )
}