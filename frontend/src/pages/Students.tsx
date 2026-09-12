import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Student, ClassInfo } from '../types'
import { PageHeader, Spinner, ErrorBanner, Chip, Modal, Empty } from '../components/ui'
import { money, fmtDate, statusChip, statusLabel, fullName } from '../lib'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'

export function Students() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Student | 'new' | null>(null)

  const students = useQuery({
    queryKey: ['students', q],
    queryFn: () => api<Student[]>(`/api/students${q ? '?q=' + encodeURIComponent(q) : ''}`),
  })
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => api<ClassInfo[]>('/api/classes') })

  const save = useMutation({
    mutationFn: (s: Partial<Student>) =>
      editing && editing !== 'new'
        ? api(`/api/students/${(editing as Student).id}`, { method: 'PUT', body: JSON.stringify(s) })
        : api('/api/students', { method: 'POST', body: JSON.stringify(s) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setEditing(null)
    },
  })

  const canEdit = user?.role === 'admin' || user?.role === 'bursar'
  const sorted = students.data

  return (
    <div>
      <PageHeader title="Students" crumb="All registered students" actions={canEdit && <button className="btn primary" onClick={() => setEditing('new')}>+ Add Student</button>} />

      {students.isError && <ErrorBanner message={(students.error as Error).message} />}

      <div className="toolbar">
        <input className="search" placeholder="Search by name or ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted small">{students.data?.length ?? '…'} students</span>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th><th>Student</th><th>Class</th><th>Guardian</th><th>Enrolled</th>
              <th>Status</th><th className="num">Fees</th><th className="num">Paid</th><th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {students.isLoading ? <tr><td colSpan={9}><Spinner /></td></tr> : null}
            {sorted?.map((s) => (
              <tr key={s.id}>
                <td className="muted">{s.student_id}</td>
                <td>
                  <Link to={`/students/${s.id}`} style={{ fontWeight: 600 }}>{fullName(s)}</Link>
                  <div className="muted small">{s.gender}</div>
                </td>
                <td>{s.class_name}</td>
                <td>
                  {s.guardian_name}
                  <div className="muted small">{s.guardian_contact}</div>
                </td>
                <td>{fmtDate(s.date_enrolled)}</td>
                <td><Chip tone={statusChip(s.status)}>{statusLabel(s.status)}</Chip></td>
                <td className="num">{money(s.fees_charged)}</td>
                <td className="num" style={{ color: 'var(--green)' }}>{money(s.amount_paid)}</td>
                <td className="num" style={{ color: (s.balance ?? 0) > 0 ? 'var(--red)' : undefined }}>{money(s.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {students.data?.length === 0 && <Empty>No students found</Empty>}
      </div>

      {editing && (
        <StudentModal
          student={editing === 'new' ? null : editing}
          classes={classes.data ?? []}
          onClose={() => setEditing(null)}
          onSubmit={(data) => save.mutate(data)}
          saving={save.isPending}
          error={save.error ? (save.error as Error).message : ''}
        />
      )}
    </div>
  )
}

export function StudentModal({
  student, classes, onClose, onSubmit, saving, error,
}: {
  student: Student | null
  classes: ClassInfo[]
  onClose: () => void
  onSubmit: (data: Partial<Student>) => void
  saving: boolean
  error: string
}) {
  const [f, setF] = useState({
    first_name: student?.first_name ?? '',
    last_name: student?.last_name ?? '',
    gender: student?.gender ?? 'Male',
    date_of_birth: student?.date_of_birth ?? '',
    class_id: student?.class_id ?? classes[0]?.id ?? '',
    guardian_name: student?.guardian_name ?? '',
    guardian_contact: student?.guardian_contact ?? '',
    address: student?.address ?? '',
    date_enrolled: student?.date_enrolled ?? new Date().toISOString().slice(0, 10),
    status: student?.status ?? 'active',
  })
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }))

  return (
    <Modal open title={student ? `Edit ${fullName(student)}` : 'Add Student'} onClose={onClose} wide>
      {error && <ErrorBanner message={error} />}
      <div className="form-row">
        <div className="field"><label>First name</label><input className="input" value={f.first_name} onChange={(e) => set('first_name', e.target.value)} /></div>
        <div className="field"><label>Last name</label><input className="input" value={f.last_name} onChange={(e) => set('last_name', e.target.value)} /></div>
      </div>
      <div className="form-row-3">
        <div className="field"><label>Gender</label>
          <select value={f.gender} onChange={(e) => set('gender', e.target.value)}><option>Male</option><option>Female</option></select>
        </div>
        <div className="field"><label>Date of birth</label><input className="input" type="date" value={f.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} /></div>
        <div className="field"><label>Class</label>
          <select value={f.class_id} onChange={(e) => set('class_id', Number(e.target.value))}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="field"><label>Guardian name</label><input className="input" value={f.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} /></div>
        <div className="field"><label>Guardian contact</label><input className="input" value={f.guardian_contact} onChange={(e) => set('guardian_contact', e.target.value)} /></div>
      </div>
      <div className="field"><label>Address</label><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
      <div className="form-row">
        <div className="field"><label>Enrolment date</label><input className="input" type="date" value={f.date_enrolled} onChange={(e) => set('date_enrolled', e.target.value)} /></div>
        <div className="field"><label>Status</label>
          <select value={f.status} onChange={(e) => set('status', e.target.value)}><option>active</option><option>inactive</option></select>
        </div>
      </div>
      <div className="m-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={saving || !f.first_name || !f.last_name || !f.class_id} onClick={() => onSubmit(f)}>
          {saving ? 'Saving…' : student ? 'Save changes' : 'Add student'}
        </button>
      </div>
    </Modal>
  )
}