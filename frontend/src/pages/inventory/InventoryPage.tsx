import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Edit3, Plus, Search, Package, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils'

interface ProductRow {
  id: string
  name: string
  sku: string
  quantity: number
  unit?: string
  buying_price: number
  selling_price: number
  profit_margin: number
  tax_rate?: number
  low_stock_threshold?: number
}

const UNIT_GROUPS = [
  {
    label: 'Count',
    units: [
      { value: 'piece', label: 'Piece' },
      { value: 'pack', label: 'Pack' },
      { value: 'box', label: 'Box' },
      { value: 'dozen', label: 'Dozen' },
      { value: 'pair', label: 'Pair' },
      { value: 'set', label: 'Set' },
      { value: 'bundle', label: 'Bundle' },
    ],
  },
  {
    label: 'Weight',
    units: [
      { value: 'kg', label: 'Kilogram' },
      { value: 'g', label: 'Gram' },
      { value: 'mg', label: 'Milligram' },
      { value: 'quintal', label: 'Quintal' },
      { value: 'ton', label: 'Ton' },
    ],
  },
  {
    label: 'Liquid',
    units: [
      { value: 'l', label: 'Liter' },
      { value: 'ml', label: 'Milliliter' },
      { value: 'bottle', label: 'Bottle' },
      { value: 'can', label: 'Can' },
      { value: 'jar', label: 'Jar' },
      { value: 'pouch', label: 'Pouch' },
      { value: 'sachet', label: 'Sachet' },
    ],
  },
  {
    label: 'Length & Area',
    units: [
      { value: 'm', label: 'Meter' },
      { value: 'cm', label: 'Centimeter' },
      { value: 'mm', label: 'Millimeter' },
      { value: 'ft', label: 'Foot' },
      { value: 'in', label: 'Inch' },
      { value: 'sqft', label: 'Square foot' },
      { value: 'sqm', label: 'Square meter' },
    ],
  },
  {
    label: 'Medical & Paper',
    units: [
      { value: 'strip', label: 'Strip' },
      { value: 'tablet', label: 'Tablet' },
      { value: 'roll', label: 'Roll' },
      { value: 'sheet', label: 'Sheet' },
      { value: 'ream', label: 'Ream' },
      { value: 'bag', label: 'Bag' },
    ],
  },
  {
    label: 'Service',
    units: [
      { value: 'hour', label: 'Hour' },
      { value: 'day', label: 'Day' },
      { value: 'service', label: 'Service' },
    ],
  },
]

const UNIT_LABELS = UNIT_GROUPS.flatMap((group) => group.units).reduce<Record<string, string>>((acc, unit) => {
  acc[unit.value] = unit.label
  return acc
}, {})

function UnitSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900/80"
      >
        {UNIT_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.units.map((unit) => (
              <option key={unit.value} value={unit.value}>{unit.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

function formatStock(quantity: number, unit?: string) {
  const label = unit ? UNIT_LABELS[unit] || unit : 'Piece'
  return `${quantity} ${label}`
}

export function InventoryPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', selling_price: '', buying_price: '', quantity: '', unit: 'piece' })
  const [editing, setEditing] = useState<ProductRow | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: async () => (await api.get('/products', { params: { search } })).data,
  })

  const createProduct = useMutation({
    mutationFn: () => api.post('/products', {
      name: form.name,
      selling_price: parseFloat(form.selling_price),
      buying_price: parseFloat(form.buying_price) || 0,
      quantity: parseFloat(form.quantity) || 0,
      unit: form.unit,
    }),
    onSuccess: () => {
      toast.success('Product added')
      setShowForm(false)
      setForm({ name: '', selling_price: '', buying_price: '', quantity: '', unit: 'piece' })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: () => toast.error('Failed to add product'),
  })

  const updateProduct = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('No product selected')
      return api.patch(`/products/${editing.id}`, {
        name: editing.name,
        quantity: Number(editing.quantity),
        buying_price: Number(editing.buying_price),
        selling_price: Number(editing.selling_price),
        unit: editing.unit || 'piece',
        tax_rate: Number(editing.tax_rate || 0),
        low_stock_threshold: Number(editing.low_stock_threshold || 5),
      })
    },
    onSuccess: () => {
      toast.success('Product updated')
      setEditing(null)
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: () => toast.error('Failed to update product'),
  })

  const deleteProduct = useMutation({
    mutationFn: (product: ProductRow) => api.delete(`/products/${product.id}`),
    onSuccess: () => {
      toast.success('Product deleted')
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: () => toast.error('Failed to delete product'),
  })

  const products: ProductRow[] = data?.items || []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Inventory</h2>
          <p className="text-slate-500">Manage products & stock</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} tooltip="Show or hide the new product form.">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      {showForm && (
        <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Selling price" type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
          <Input label="Buying price" type="number" value={form.buying_price} onChange={(e) => setForm({ ...form, buying_price: e.target.value })} />
          <Input label="Quantity" type="number" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <UnitSelect label="Unit" value={form.unit} onChange={(unit) => setForm({ ...form, unit })} />
          <div className="flex items-end">
            <Button onClick={() => createProduct.mutate()} loading={createProduct.isPending} className="w-full" tooltip="Save this product to inventory and POS.">Save</Button>
          </div>
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full rounded-xl border py-2.5 pl-10 pr-4 dark:border-slate-700 dark:bg-slate-900/80"
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-3">Product</th>
                <th className="pb-3">SKU</th>
                <th className="pb-3">Stock</th>
                <th className="pb-3">Buy</th>
                <th className="pb-3">Sell</th>
                <th className="pb-3">Margin</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7}><Skeleton className="h-12" /></td></tr>
              ) : products.length ? (
                products.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3 text-slate-500">{p.sku}</td>
                    <td className={`py-3 ${p.quantity <= (p.low_stock_threshold || 5) ? 'text-amber-600 font-medium' : ''}`}>{formatStock(p.quantity, p.unit)}</td>
                    <td className="py-3">{formatCurrency(p.buying_price)}</td>
                    <td className="py-3">{formatCurrency(p.selling_price)}</td>
                    <td className="py-3">{p.profit_margin?.toFixed(1)}%</td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(p)} tooltip="Edit this product's price, stock, and tax details.">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          tooltip="Delete this product from inventory and hide it from POS."
                          onClick={() => {
                            if (window.confirm(`Delete ${p.name}? It will be hidden from inventory and POS.`)) {
                              deleteProduct.mutate(p)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Package className="mx-auto h-12 w-12 mb-2 opacity-50" />
                    No products yet. Add your first product.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-950">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">Edit Product</h3>
                <p className="text-sm text-slate-500">{editing.sku}</p>
              </div>
              <Button variant="ghost" onClick={() => setEditing(null)} tooltip="Close the product editor."><X className="h-4 w-4" /></Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <Input label="Current stock" type="number" step="0.01" value={String(editing.quantity)} onChange={(e) => setEditing({ ...editing, quantity: Number(e.target.value || 0) })} />
              <UnitSelect label="Unit" value={editing.unit || 'piece'} onChange={(unit) => setEditing({ ...editing, unit })} />
              <Input label="Buying price" type="number" value={String(editing.buying_price)} onChange={(e) => setEditing({ ...editing, buying_price: Number(e.target.value || 0) })} />
              <Input label="Selling price" type="number" value={String(editing.selling_price)} onChange={(e) => setEditing({ ...editing, selling_price: Number(e.target.value || 0) })} />
              <Input label="Tax %" type="number" value={String(editing.tax_rate || 0)} onChange={(e) => setEditing({ ...editing, tax_rate: Number(e.target.value || 0) })} />
              <Input label="Low stock alert" type="number" value={String(editing.low_stock_threshold || 5)} onChange={(e) => setEditing({ ...editing, low_stock_threshold: Number(e.target.value || 0) })} />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setEditing(null)} tooltip="Discard product changes.">Cancel</Button>
              <Button loading={updateProduct.isPending} onClick={() => updateProduct.mutate()} tooltip="Update this product in inventory and POS.">Save changes</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
