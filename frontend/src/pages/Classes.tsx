import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { ClassInfo } from '../types'
import { PageHeader, ErrorBanner, Modal } from '../components/ui'
import { money } from '../lib'
import { useAuth } from '../auth'

function className(c: { name: string; stream?: string }): string {
  return c.stream ? `${c.name} ${c.stream}` : c.name
}

export function Classes() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<ClassInfo | 'new' | null>(null)

  const classes = useQuery({ queryKey: ['classes'], queryFn: () => api<ClassInfo[]>('/api/classes') })
  const byClass = useQuery({ queryKey: ['by-class'], queryFn: () => api<any[]>('/api/reports/students-by-class') })

  if (classes.isError) return <ErrorBanner message={(classes.error as Error).message} />

  const studentsMap = Object.fromEntries((byClass.data ?? []).map((c) => [c.class_id, c.count]))
  const canEdit = user?.role === 'admin'

  return (
    <div>
      <PageHeader title="Classes" crumb="Student classes & fee structure" actions={canEdit && <button className="btn primary" onClick={() => setEditing('new')}>+ Add class</button>} />

      <div className="grid grid-3">
        {classes.data?.map((c) => (
          <div className="card" key={c.id}>
            <div className="flex" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 16 }}>{className(c)}</h3>
              <span className="chip blue">{studentsMap[c.id] ?? 0} students</span>
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
            <div className="mt muted small">
              Total per term: <b style={{ color: 'var(--text)' }}>{money((c.school_fees ?? 0) + (c.development_levy ?? 0))}</b>
            </div>
            {canEdit && (
              <div className="mt">
                <button className="btn" onClick={() => setEditing(c)}>Edit</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <ClassModal
          classInfo={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={(data) => {
            const save = editing === 'new'
              ? () => api('/api/classes', { method: 'POST', body: JSON.stringify(data) })
              : () => api(`/api/classes/${(editing as ClassInfo).id}`, { method: 'PUT', body: JSON.stringify(data) })
            return save()
          }}
          onSaved={() => qc.invalidateQueries({ queryKey: ['classes'] })}
        />
      )}
    </div>
  )
}

function ClassModal({ classInfo, onClose, onSubmit, onSaved }: {
  classInfo: ClassInfo | null
  onClose: () => void
  onSubmit: (data: Partial<ClassInfo>) => Promise<unknown>
  onSaved: () => void
}) {
  const [f, setF] = useState({
    name: classInfo?.name ?? '',
    stream: classInfo?.stream ?? '',
    capacity: classInfo?.capacity ?? '',
    year_level: classInfo?.year_level ?? 1,
    school_fees: classInfo?.school_fees ?? 0,
    development_levy: classInfo?.development_levy ?? 0,
  })
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!f.name) return
    setSaving(true)
    setError('')
    try {
      await onSubmit({ ...f, capacity: Number(f.capacity) || 0, year_level: Number(f.year_level) || 1 })
      onSaved(); onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title={classInfo ? `Edit ${className(classInfo)}` : 'Add class'} onClose={onClose}>
      {error && <ErrorBanner message={error} />}
      <div className="form-row">
        <div className="field"><label>Class name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Form 4" autoFocus /></div>
        <div className="field"><label>Stream</label><input className="input" value={f.stream} onChange={(e) => set('stream', e.target.value)} placeholder="e.g. A" /></div>
      </div>
      <div className="form-row-3">
        <div className="field"><label>Year level</label>
          <select value={f.year_level} onChange={(e) => set('year_level', Number(e.target.value))}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option></select>
        </div>
        <div className="field"><label>Capacity</label><input className="input" type="number" min="0" value={f.capacity} onChange={(e) => set('capacity', e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>School fees per term</label><input className="input" type="number" min="0" value={f.school_fees} onChange={(e) => set('school_fees', Number(e.target.value) || 0)} /></div>
        <div className="field"><label>Development levy</label><input className="input" type="number" min="0" value={f.development_levy} onChange={(e) => set('development_levy', Number(e.target.value) || 0)} /></div>
      </div>
      <div className="m-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={saving || !f.name} onClick={submit}>{saving ? 'Saving…' : classInfo ? 'Save changes' : 'Add class'}</button>
      </div>
    </Modal>
  )
}