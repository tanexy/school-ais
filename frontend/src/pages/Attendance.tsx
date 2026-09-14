import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { ClassInfo, AttendanceRoster } from '../types'
import { PageHeader, ErrorBanner, Chip, Spinner } from '../components/ui'
import { useAuth } from '../auth'

const STATUSES = ['present', 'absent', 'late', 'excused'] as const

export function Attendance() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [classId, setClassId] = useState<number | ''>('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [edits, setEdits] = useState<Record<number, { status: string; remarks: string }>>({})

  const classes = useQuery({ queryKey: ['classes'], queryFn: () => api<ClassInfo[]>('/api/classes') })
  const roster = useQuery({
    queryKey: ['attendance', classId, date],
    queryFn: () => api<AttendanceRoster>(`/api/attendance?class_id=${classId}&date=${date}`),
    enabled: !!classId,
  })

  const save = useMutation({
    mutationFn: () => {
      const records = (roster.data?.records ?? []).map((r) => ({
        student_id: r.student_id,
        status: edits[r.student_id]?.status ?? r.status ?? 'present',
        remarks: edits[r.student_id]?.remarks ?? r.remarks ?? '',
      }))
      return api('/api/attendance/bulk', {
        method: 'POST',
        body: JSON.stringify({ class_id: classId, date, entered_by: user?.id, records }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance', classId, date] }),
  })

  const set = (sid: number, key: 'status' | 'remarks', value: string) =>
    setEdits((p) => ({ ...p, [sid]: { ...(p[sid] ?? { status: 'present', remarks: '' }), [key]: value } }))

  const selectedClass = classes.data?.find((c) => c.id === classId)

  return (
    <div>
      <PageHeader title="Attendance" crumb="Daily class attendance register" />

      {classes.isError && <ErrorBanner message={(classes.error as Error).message} />}

      <div className="toolbar">
        <label className="field-inline"><span>Class</span>
          <select value={classId} onChange={(e) => { setClassId(e.target.value ? Number(e.target.value) : ''); setEdits({}) }}>
            <option value="">Select class…</option>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.stream ? ` ${c.stream}` : ''}</option>
            ))}
          </select>
        </label>
        <label className="field-inline"><span>Date</span>
          <input className="input" type="date" value={date} onChange={(e) => { setDate(e.target.value); setEdits({}) }} />
        </label>
        <span className="muted small">{selectedClass ? `${selectedClass.name} ${selectedClass.stream ?? ''}`.trim() : ''} • {roster.data?.records.length ?? 0} students</span>
      </div>

      {classId && (
        <>
          {roster.isLoading ? <Spinner /> : null}
          {roster.isError && <ErrorBanner message={(roster.error as Error).message} />}

          {roster.data && (
            <div className="flex" style={{ gap: 8, marginBottom: 12 }}>
              <Chip tone="green">{roster.data.present} present</Chip>
              <Chip tone="amber">{roster.data.late} late</Chip>
              <Chip tone="red">{roster.data.absent} absent</Chip>
              <Chip>{roster.data.excused} excused</Chip>
            </div>
          )}

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>ID</th><th>Student</th><th>Status</th><th>Remarks</th></tr>
              </thead>
              <tbody>
                {roster.data?.records.map((r) => (
                  <tr key={r.student_id}>
                    <td className="muted">{r.student_code}</td>
                    <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                    <td>
                      <select value={edits[r.student_id]?.status ?? r.status ?? 'present'} onChange={(e) => set(r.student_id, 'status', e.target.value)}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        className="input"
                        placeholder="Optional note…"
                        value={edits[r.student_id]?.remarks ?? r.remarks ?? ''}
                        onChange={(e) => set(r.student_id, 'remarks', e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mv">
            <button className="btn primary" disabled={save.isPending || !roster.data} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : save.isSuccess ? 'Saved ✓' : 'Save attendance'}
            </button>
            {save.error && <ErrorBanner message={(save.error as Error).message} />}
          </div>
        </>
      )}
    </div>
  )
}