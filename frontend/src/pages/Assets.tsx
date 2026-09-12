import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Asset } from '../types'
import { PageHeader, Spinner, ErrorBanner, Modal, Empty } from '../components/ui'
import { money, fmtDate } from '../lib'
import { useAuth } from '../auth'

export function Assets() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  const assets = useQuery({ queryKey: ['assets'], queryFn: () => api<{ rows: Asset[]; total: number }>('/api/assets') })
  const canEdit = user?.role === 'admin' || user?.role === 'bursar'

  return (
    <div>
      <PageHeader title="Fixed Assets" crumb="School property register" actions={canEdit && <button className="btn primary" onClick={() => setOpen(true)}>+ Register asset</button>} />

      {assets.isError && <ErrorBanner message={(assets.error as Error).message} />}

      <div className="grid grid-2 mb">
        <div className="card stat">
          <div className="stat-label">Total assets value</div>
          <div className="stat-value">{money(assets.data?.total ?? 0)}</div>
          <div className="stat-sub">{assets.data?.rows.length ?? '…'} assets registered</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Categories</div>
          <div className="stat-value" style={{ fontSize: 22 }}>
            {[...new Set((assets.data?.rows ?? []).map((a) => a.category))].join(' • ') || '—'}
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Name</th><th>Category</th><th>Acquired</th><th>Dep. rate</th><th>Status</th><th className="num">Value</th></tr>
          </thead>
          <tbody>
            {assets.isLoading ? <tr><td colSpan={6}><Spinner /></td></tr> : null}
            {assets.data?.rows.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>{a.name}</td>
                <td><span className="chip cyan">{a.category}</span></td>
                <td>{fmtDate(a.acquisition_date)}</td>
                <td className="muted">{(a.depreciation_rate * 100).toFixed(0)}% / yr</td>
                <td><span className={`chip ${a.status === 'active' ? 'green' : 'red'}`}>{a.status}</span></td>
                <td className="num" style={{ fontWeight: 600 }}>{money(a.value)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tfoot"><td colSpan={5}>Total value</td><td className="num">{money(assets.data?.total ?? 0)}</td></tr>
          </tfoot>
        </table>
        {assets.data?.rows.length === 0 && <Empty>No assets registered</Empty>}
      </div>

      {open && <AssetModal onClose={() => setOpen(false)} />}
    </div>
  )
}

function AssetModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ name: '', category: '', value: '', acquisition_date: new Date().toISOString().slice(0, 10), depreciation_rate: '', status: 'active' })
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }))
  const add = useMutation({
    mutationFn: () => api('/api/assets', {
      method: 'POST',
      body: JSON.stringify({ ...f, value: Number(f.value), depreciation_rate: Number(f.depreciation_rate) || 0 }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); onClose() },
  })
  return (
    <Modal open title="Register asset" onClose={onClose}>
      {add.error && <ErrorBanner message={(add.error as Error).message} />}
      <div className="form-row">
        <div className="field"><label>Asset name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus placeholder="e.g. School furniture" /></div>
        <div className="field"><label>Category</label>
          <select value={f.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">Select…</option>
            <option>Transport</option><option>Buildings</option><option>Office Equipment</option><option>ICT Equipment</option><option>Furniture & Fittings</option><option>Laboratory</option><option>Sports</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="field"><label>Value ($)</label><input className="input" type="number" min="0" step="0.01" value={f.value} onChange={(e) => set('value', e.target.value)} /></div>
        <div className="field"><label>Depreciation rate (decimal, e.g. 0.2 = 20%)</label><input className="input" type="number" step="0.01" value={f.depreciation_rate} onChange={(e) => set('depreciation_rate', e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>Acquisition date</label><input className="input" type="date" value={f.acquisition_date} onChange={(e) => set('acquisition_date', e.target.value)} /></div>
        <div className="field"><label>Status</label>
          <select value={f.status} onChange={(e) => set('status', e.target.value)}><option>active</option><option>disposed</option></select>
        </div>
      </div>
      <div className="m-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={add.isPending || !f.name || !f.value} onClick={() => add.mutate()}>{add.isPending ? 'Saving…' : 'Register asset'}</button>
      </div>
    </Modal>
  )
}