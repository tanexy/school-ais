import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { ClassInfo, GradeRoster, GradeRecord } from '../types'
import { PageHeader, ErrorBanner, Chip, Spinner } from '../components/ui'
import { letterForScore } from '../lib'
import { useAuth } from '../auth'

const TERMS = ['Term 1 2025', 'Term 2 2025', 'Term 3 2025']
const SUBJECTS = ['Mathematics', 'English', 'Science', 'History']

function gradeTone(letter: string): string {
  if (letter === 'A' || letter === 'B') return 'green'
  if (letter === 'C') return 'amber'
  return 'red'
}

export function Grades() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [classId, setClassId] = useState<number | ''>('')
  const [term, setTerm] = useState(TERMS[0])
  const [subject, setSubject] = useState(SUBJECTS[0])
  const [edits, setEdits] = useState<Record<number, { score: string; remarks: string }>>({})

  const classes = useQuery({ queryKey: ['classes'], queryFn: () => api<ClassInfo[]>('/api/classes') })
  const roster = useQuery({
    queryKey: ['grades', classId, term, subject],
    queryFn: () => api<GradeRoster>(`/api/grades?class_id=${classId}&term=${encodeURIComponent(term)}&subject=${encodeURIComponent(subject)}`),
    enabled: !!classId,
  })

  const save = useMutation({
    mutationFn: () =>
      api('/api/grades/bulk', {
        method: 'POST',
        body: JSON.stringify({
          class_id: classId,
          term,
          subject,
          entered_by: user?.id,
          records: Object.entries(edits)
            .filter(([, v]) => v.score !== '' && !Number.isNaN(Number(v.score)))
            .map(([sid, v]) => ({ student_id: Number(sid), score: Number(v.score), remarks: v.remarks })),
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grades', classId, term, subject] }),
  })

  const set = (sid: number, key: 'score' | 'remarks', value: string) =>
    setEdits((p) => ({ ...p, [sid]: { ...(p[sid] ?? { score: '', remarks: '' }), [key]: value } }))

  function scoreOf(r: GradeRecord): number | null {
    const e = edits[r.student_id]
    if (e?.score !== undefined && e.score !== '' && !Number.isNaN(Number(e.score))) return Number(e.score)
    if (r.score != null && !Number.isNaN(Number(r.score))) return Number(r.score)
    return null
  }

  const entered = roster.data?.records.filter((r) => scoreOf(r) != null).length ?? 0
  const countDiff = (fn: (l: string) => boolean) => roster.data?.records.filter((r) => { const s = scoreOf(r); return s != null && fn(letterForScore(s)) }).length ?? 0

  return (
    <div>
      <PageHeader title="Grade Entry" crumb="Term results entry" />

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
        <label className="field-inline"><span>Term</span>
          <select value={term} onChange={(e) => { setTerm(e.target.value); setEdits({}) }}>
            {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="field-inline"><span>Subject</span>
          <select value={subject} onChange={(e) => { setSubject(e.target.value); setEdits({}) }}>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {classId && (
        <>
          {roster.isLoading ? <Spinner /> : null}
          {roster.isError && <ErrorBanner message={(roster.error as Error).message} />}

          {roster.data && (
            <div className="flex" style={{ gap: 8, marginBottom: 12 }}>
              <Chip tone="green">{countDiff((l) => l === 'A' || l === 'B')} A–B</Chip>
              <Chip tone="amber">{countDiff((l) => l === 'C')} C</Chip>
              <Chip tone="red">{countDiff((l) => l === 'D' || l === 'F')} D–F</Chip>
              <Chip>{entered} / {roster.data.records.length} entered</Chip>
            </div>
          )}

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>ID</th><th>Student</th><th className="num">Score (0–100)</th><th>Grade</th><th>Remarks</th></tr>
              </thead>
              <tbody>
                {roster.data?.records.map((r) => {
                  const enteredScore = edits[r.student_id]?.score ?? (r.score != null ? String(r.score) : '')
                  const val = scoreOf(r)
                  const letter = val != null ? letterForScore(val) : r.letter_grade
                  return (
                    <tr key={r.student_id}>
                      <td className="muted">{r.student_code}</td>
                      <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                      <td className="num">
                        <input
                          className="input"
                          type="number"
                          min="0"
                          max="100"
                          value={enteredScore}
                          placeholder="—"
                          onChange={(e) => set(r.student_id, 'score', e.target.value)}
                          style={{ width: 90 }}
                        />
                      </td>
                      <td>{letter && letter !== '—' ? <Chip tone={gradeTone(letter)}>{letter}</Chip> : <span className="muted small">—</span>}</td>
                      <td>
                        <input
                          className="input"
                          placeholder="Optional…"
                          value={edits[r.student_id]?.remarks ?? ''}
                          onChange={(e) => set(r.student_id, 'remarks', e.target.value)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mv">
            <button className="btn primary" disabled={save.isPending || !roster.data} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : save.isSuccess ? 'Saved ✓' : 'Save grades'}
            </button>
            {save.error && <ErrorBanner message={(save.error as Error).message} />}
          </div>
        </>
      )}
    </div>
  )
}