import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Supplier } from '../types'
import { PageHeader, Spinner, ErrorBanner, Modal, Chip, Empty } from '../components/ui'
import { money, fmtDate } from '../lib'
import { useAuth } from '../auth'

export function Suppliers() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'suppliers' | 'purchases'>('suppliers')
  const [addOpen, setAddOpen] = useState(false)
  const [purchaseOpen, setPurchaseOpen] = useState(false)

  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => api<Supplier[]>('/api/suppliers') })
  const purchases = useQuery({ queryKey: ['purchases'], queryFn: () => api<any[]>('/api/purchases') })

  const canEdit = user?.role === 'admin' || user?.role === 'bursar'

  return (
    <div>
      <PageHeader
        title="Suppliers & Purchases"
        crumb="Procurement"
        actions={canEdit && (
          <>
            {tab === 'purchases'
              ? <button className="btn primary" onClick={() => setPurchaseOpen(true)}>+ Record purchase</button>
              : <button className="btn primary" onClick={() => setAddOpen(true)}>+ Add supplier</button>}
          </>
        )}
      />

      <div className="tabs">
        <button className={`tab${tab === 'suppliers' ? ' active' : ''}`} onClick={() => setTab('suppliers')}>Suppliers</button>
        <button className={`tab${tab === 'purchases' ? ' active' : ''}`} onClick={() => setTab('purchases')}>Purchases</button>
      </div>

      {tab === 'suppliers' ? (
        <div className="grid grid-3">
          {suppliers.isLoading ? <Spinner /> : null}
          {suppliers.isError ? <ErrorBanner message={(suppliers.error as Error).message} /> : null}
          {suppliers.data?.map((s) => (
            <div className="card" key={s.id}>
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 15 }}>{s.name}</h3>
                <Chip tone="green">Active</Chip>
              </div>
              <div className="muted small mt">{s.contact_person}</div>
              <div className="muted small">{s.phone}</div>
              <div className="muted small">{s.email}</div>
              <div className="muted small">{s.address}</div>
              <div className="flex mt"><span className="chip violet">Terms: {s.terms}</span></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {purchases.isError && <ErrorBanner message={(purchases.error as Error).message} />}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Date</th><th>Supplier</th><th>Item</th><th>Invoice</th><th>Status</th><th className="num">Amount</th></tr>
              </thead>
              <tbody>
                {purchases.isLoading ? <tr><td colSpan={6}><Spinner /></td></tr> : null}
                {purchases.data?.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.date)}</td>
                    <td>{p.supplier_name}</td>
                    <td>{p.item_description}</td>
                    <td className="muted">{p.invoice_number}</td>
                    <td><span className={`chip ${p.payment_status === 'paid' ? 'green' : 'amber'}`}>{p.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</span></td>
                    <td className="num" style={{ fontWeight: 600 }}>{money(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tfoot"><td colSpan={5}>Total purchases</td><td className="num">{money((purchases.data ?? []).reduce((s, p) => s + p.amount, 0))}</td></tr>
              </tfoot>
            </table>
            {purchases.data?.length === 0 && <Empty>No purchases yet</Empty>}
          </div>
        </>
      )}

      {addOpen && <SupplierModal onClose={() => setAddOpen(false)} />}
      {purchaseOpen && <PurchaseModal suppliers={suppliers.data ?? []} onClose={() => setPurchaseOpen(false)} />}
    </div>
  )
}

function SupplierModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ name: '', contact_person: '', phone: '', email: '', address: '', terms: 'Net 30' })
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const add = useMutation({
    mutationFn: () => api('/api/suppliers', { method: 'POST', body: JSON.stringify(f) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); onClose() },
  })
  return (
    <Modal open title="Add supplier" onClose={onClose}>
      {add.error && <ErrorBanner message={(add.error as Error).message} />}
      <div className="field"><label>Supplier name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></div>
      <div className="form-row">
        <div className="field"><label>Contact person</label><input className="input" value={f.contact_person} onChange={(e) => set('contact_person', e.target.value)} /></div>
        <div className="field"><label>Phone</label><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>Email</label><input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div className="field"><label>Terms</label><input className="input" value={f.terms} onChange={(e) => set('terms', e.target.value)} /></div>
      </div>
      <div className="field"><label>Address</label><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
      <div className="m-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={add.isPending || !f.name} onClick={() => add.mutate()}>{add.isPending ? 'Saving…' : 'Add supplier'}</button>
      </div>
    </Modal>
  )
}

function PurchaseModal({ suppliers, onClose }: { suppliers: Supplier[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ supplier_id: suppliers[0]?.id ?? '', item_description: '', amount: '', invoice_number: '', payment_status: 'unpaid' })
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }))
  const add = useMutation({
    mutationFn: () => api('/api/purchases', { method: 'POST', body: JSON.stringify({ ...f, supplier_id: Number(f.supplier_id), amount: Number(f.amount) }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); onClose() },
  })
  return (
    <Modal open title="Record purchase" onClose={onClose}>
      {add.error && <ErrorBanner message={(add.error as Error).message} />}
      <div className="form-row">
        <div className="field"><label>Supplier</label>
          <select value={f.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Amount ($)</label><input className="input" type="number" min="0" step="0.01" value={f.amount} onChange={(e) => set('amount', e.target.value)} autoFocus /></div>
      </div>
      <div className="field"><label>Item description</label><input className="input" value={f.item_description} onChange={(e) => set('item_description', e.target.value)} placeholder="e.g. Office furniture" /></div>
      <div className="form-row">
        <div className="field"><label>Invoice #</label><input className="input" value={f.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} /></div>
        <div className="field"><label>Payment status</label>
          <select value={f.payment_status} onChange={(e) => set('payment_status', e.target.value)}><option>unpaid</option><option>paid</option></select>
        </div>
      </div>
      <div className="m-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={add.isPending || !f.supplier_id || !f.amount} onClick={() => add.mutate()}>{add.isPending ? 'Saving…' : 'Record purchase'}</button>
      </div>
    </Modal>
  )
}