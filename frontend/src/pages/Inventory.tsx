import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { InventoryItem, Supplier } from '../types'
import { PageHeader, Spinner, ErrorBanner, Modal, Chip, Empty } from '../components/ui'
import { money } from '../lib'
import { useAuth } from '../auth'

export function Inventory() {
  const { user } = useAuth()
  const [addOpen, setAddOpen] = useState(false)
  const [moveItem, setMoveItem] = useState<InventoryItem | null>(null)

  const inv = useQuery({ queryKey: ['inventory'], queryFn: () => api<{ rows: InventoryItem[]; lowStock: InventoryItem[] }>('/api/inventory') })
  const suppliers = useQuery({ queryKey: ['suppliers-opt-i'], queryFn: () => api<Supplier[]>('/api/suppliers') })

  const canEdit = user?.role === 'admin' || user?.role === 'bursar'
  const totalValue = (inv.data?.rows ?? []).reduce((s, r) => s + r.quantity_on_hand * r.unit_cost, 0)

  return (
    <div>
      <PageHeader title="Inventory" crumb="Stock control" actions={canEdit && <button className="btn primary" onClick={() => setAddOpen(true)}>+ Add item</button>} />

      <div className="grid grid-3 mb">
        <div className="card stat"><div className="stat-label">Stock items</div><div className="stat-value" style={{ fontSize: 24 }}>{inv.data?.rows.length ?? '…'}</div></div>
        <div className="card stat"><div className="stat-label">Stock value</div><div className="stat-value" style={{ fontSize: 24 }}>{money(totalValue)}</div></div>
        <div className="card stat"><div className="stat-label">Low stock alerts</div><div className="stat-value" style={{ fontSize: 24, color: 'var(--amber)' }}>{inv.data?.lowStock.length ?? '…'}</div><div className="stat-sub">Items at or below reorder level</div></div>
      </div>

      {inv.isError && <ErrorBanner message={(inv.error as Error).message} />}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Item</th><th>Supplier</th><th>Status</th><th className="num">On hand</th><th className="num">Reorder level</th><th className="num">Unit cost</th><th className="num">Stock value</th>{canEdit && <th></th>}</tr>
          </thead>
          <tbody>
            {inv.isLoading ? <tr><td colSpan={canEdit ? 8 : 7}><Spinner /></td></tr> : null}
            {inv.data?.rows.map((r) => {
              const low = r.quantity_on_hand <= r.reorder_level
              return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div className="muted small">{r.description}</div>
                  </td>
                  <td className="muted">{r.supplier_name || '—'}</td>
                  <td><Chip tone={low ? 'amber' : 'green'}>{low ? 'Low stock' : 'In stock'}</Chip></td>
                  <td className="num" style={{ fontWeight: 600, color: low ? 'var(--amber)' : undefined }}>{r.quantity_on_hand}</td>
                  <td className="num muted">{r.reorder_level}</td>
                  <td className="num">{money(r.unit_cost)}</td>
                  <td className="num">{money(r.quantity_on_hand * r.unit_cost)}</td>
                  {canEdit && <td><button className="btn sm" onClick={() => setMoveItem(r)}>Receive/Issue</button></td>}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="tfoot"><td colSpan={6}>Total stock value</td><td className="num">{money(totalValue)}</td>{canEdit && <td></td>}</tr>
          </tfoot>
        </table>
        {inv.data?.rows.length === 0 && <Empty>No inventory items</Empty>}
      </div>

      {addOpen && <ItemModal suppliers={suppliers.data ?? []} onClose={() => setAddOpen(false)} />}
      {moveItem && <MoveModal item={moveItem} onClose={() => setMoveItem(null)} />}
    </div>
  )
}

function ItemModal({ suppliers, onClose }: { suppliers: Supplier[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ name: '', description: '', quantity_on_hand: '', reorder_level: '', unit_cost: '', supplier_id: '' })
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const add = useMutation({
    mutationFn: () => api('/api/inventory', { method: 'POST', body: JSON.stringify({ ...f, quantity_on_hand: Number(f.quantity_on_hand) || 0, reorder_level: Number(f.reorder_level) || 5, unit_cost: Number(f.unit_cost) || 0, supplier_id: f.supplier_id ? Number(f.supplier_id) : null }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); onClose() },
  })
  return (
    <Modal open title="Add inventory item" onClose={onClose}>
      {add.error && <ErrorBanner message={(add.error as Error).message} />}
      <div className="field"><label>Item name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></div>
      <div className="field"><label>Description</label><input className="input" value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
      <div className="form-row-3">
        <div className="field"><label>Qty on hand</label><input className="input" type="number" min="0" value={f.quantity_on_hand} onChange={(e) => set('quantity_on_hand', e.target.value)} /></div>
        <div className="field"><label>Reorder level</label><input className="input" type="number" min="0" value={f.reorder_level} onChange={(e) => set('reorder_level', e.target.value)} /></div>
        <div className="field"><label>Unit cost ($)</label><input className="input" type="number" min="0" step="0.01" value={f.unit_cost} onChange={(e) => set('unit_cost', e.target.value)} /></div>
      </div>
      <div className="field"><label>Supplier</label>
        <select value={f.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
          <option value="">— None —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="m-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={add.isPending || !f.name} onClick={() => add.mutate()}>{add.isPending ? 'Saving…' : 'Add item'}</button>
      </div>
    </Modal>
  )
}

function MoveModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const qc = useQueryClient()
  const [type, setType] = useState<'receive' | 'issue'>('receive')
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const move = useMutation({
    mutationFn: () => api(`/api/inventory/${item.id}/stock-movements`, { method: 'POST', body: JSON.stringify({ type, quantity: Number(qty), notes }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); onClose() },
  })
  return (
    <Modal open title={`${type === 'receive' ? 'Receive' : 'Issue'} — ${item.name}`} onClose={onClose}>
      {move.error && <ErrorBanner message={(move.error as Error).message} />}
      <div className="muted small mb">Current on hand: <b>{item.quantity_on_hand}</b> units</div>
      <div className="form-row">
        <div className="field"><label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)}><option value="receive">Receive (stock in)</option><option value="issue">Issue (stock out)</option></select>
        </div>
        <div className="field"><label>Quantity</label><input className="input" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></div>
      </div>
      <div className="field"><label>Notes</label><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="m-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={move.isPending || !qty || Number(qty) <= 0} onClick={() => move.mutate()}>{move.isPending ? 'Saving…' : 'Record movement'}</button>
      </div>
    </Modal>
  )
}