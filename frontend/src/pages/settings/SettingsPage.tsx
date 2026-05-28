import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Save, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { PasswordField } from '@/components/auth/PasswordField'

interface ShopForm {
  name: string
  business_type: string
  currency: string
  address: string
  city: string
  state: string
  country: string
  phone: string
  logo_url: string
  primary_color: string
  accent_color: string
  gst_enabled: boolean
  gst_number: string
  vat_number: string
  default_tax_rate: string
  tax_inclusive: boolean
  invoice_prefix: string
  invoice_terms: string
  invoice_footer: string
  upi_id: string
  upi_name: string
  show_upi_qr_on_invoice: boolean
  whatsapp_bill_enabled: boolean
}

const emptyForm: ShopForm = {
  name: '',
  business_type: 'general_store',
  currency: 'INR',
  address: '',
  city: '',
  state: '',
  country: 'IN',
  phone: '',
  logo_url: '',
  primary_color: '#4f46e5',
  accent_color: '#14b8a6',
  gst_enabled: true,
  gst_number: '',
  vat_number: '',
  default_tax_rate: '0',
  tax_inclusive: false,
  invoice_prefix: 'INV',
  invoice_terms: 'Goods once sold can be returned only as per shop policy.',
  invoice_footer: 'Thank you for shopping with us.',
  upi_id: '',
  upi_name: '',
  show_upi_qr_on_invoice: false,
  whatsapp_bill_enabled: true,
}

export function SettingsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<ShopForm>(emptyForm)
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [passwordVisible, setPasswordVisible] = useState({ current: false, next: false, confirm: false })

  const { data, isLoading } = useQuery({
    queryKey: ['shop'],
    queryFn: async () => (await api.get('/shops/me')).data,
  })

  useEffect(() => {
    if (!data) return
    setForm({
      name: data.name || '',
      business_type: data.business_type || 'general_store',
      currency: data.currency || 'INR',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      country: data.country || 'IN',
      phone: data.phone || '',
      logo_url: data.branding?.logo_url || '',
      primary_color: data.branding?.primary_color || '#4f46e5',
      accent_color: data.branding?.accent_color || '#14b8a6',
      gst_enabled: data.tax?.gst_enabled ?? true,
      gst_number: data.tax?.gst_number || '',
      vat_number: data.tax?.vat_number || '',
      default_tax_rate: String(data.tax?.default_tax_rate ?? 0),
      tax_inclusive: data.tax?.tax_inclusive ?? false,
      invoice_prefix: data.invoice?.prefix || 'INV',
      invoice_terms: data.invoice?.terms || emptyForm.invoice_terms,
      invoice_footer: data.invoice?.footer_note || emptyForm.invoice_footer,
      upi_id: data.payment?.upi_id || '',
      upi_name: data.payment?.upi_name || data.name || '',
      show_upi_qr_on_invoice: data.payment?.show_upi_qr_on_invoice ?? Boolean(data.payment?.upi_id),
      whatsapp_bill_enabled: data.payment?.whatsapp_bill_enabled ?? true,
    })
  }, [data])

  const saveShop = useMutation({
    mutationFn: () => api.patch('/shops/me', {
      name: form.name,
      business_type: form.business_type,
      currency: form.currency,
      address: form.address,
      city: form.city,
      state: form.state,
      country: form.country,
      phone: form.phone,
      branding: {
        logo_url: form.logo_url || null,
        primary_color: form.primary_color,
        accent_color: form.accent_color,
      },
      tax: {
        gst_enabled: form.gst_enabled,
        gst_number: form.gst_number || null,
        vat_number: form.vat_number || null,
        default_tax_rate: parseFloat(form.default_tax_rate) || 0,
        tax_inclusive: form.tax_inclusive,
      },
      invoice: {
        prefix: form.invoice_prefix || 'INV',
        next_number: data?.invoice?.next_number || 1,
        template_id: data?.invoice?.template_id || 'modern',
        terms: form.invoice_terms,
        footer_note: form.invoice_footer,
      },
      payment: {
        upi_id: form.upi_id || null,
        upi_name: form.upi_name || form.name,
        show_upi_qr_on_invoice: form.show_upi_qr_on_invoice && Boolean(form.upi_id.trim()),
        whatsapp_bill_enabled: form.whatsapp_bill_enabled,
      },
    }),
    onSuccess: () => {
      toast.success('Shop details updated')
      qc.invalidateQueries({ queryKey: ['shop'] })
    },
    onError: () => toast.error('Could not update shop details'),
  })

  const changePassword = useMutation({
    mutationFn: () => api.post('/auth/change-password', {
      current_password: passwordForm.current,
      new_password: passwordForm.next,
    }),
    onSuccess: () => {
      toast.success('Password changed')
      setPasswordForm({ current: '', next: '', confirm: '' })
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || 'Could not change password')
    },
  })

  const submitPasswordChange = () => {
    if (passwordForm.next.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error('Passwords do not match')
      return
    }
    changePassword.mutate()
  }

  const handleLogo = (file?: File) => {
    if (!file) return
    if (file.size > 500_000) {
      toast.error('Logo should be under 500 KB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setForm((prev) => ({ ...prev, logo_url: String(reader.result) }))
    reader.readAsDataURL(file)
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Shop Settings</h2>
          <p className="text-slate-500">These details appear on invoices and customer receipts.</p>
        </div>
        <Button loading={saveShop.isPending} onClick={() => saveShop.mutate()} tooltip="Save shop profile, logo, tax, and invoice settings.">
          <Save className="h-4 w-4" /> Save Changes
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <h3 className="mb-4 font-semibold">Business Profile</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Shop name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Business type</label>
                <select
                  value={form.business_type}
                  onChange={(e) => setForm({ ...form, business_type: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900/80"
                >
                  {['general_store', 'grocery', 'clothing', 'electronics', 'pharmacy', 'hardware', 'bakery', 'restaurant', 'cosmetics', 'mobile_accessories', 'wholesale', 'supermarket', 'stationery', 'other'].map((item) => (
                    <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900/80"
                >
                  <option value="INR">INR - Indian Rupee</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="AED">AED - UAE Dirham</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>
              <Input label="Address" className="sm:col-span-2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <Input label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              <Input label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 font-semibold">Tax Details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="GST number" value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} />
              <Input label="VAT number" value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} />
              <Input label="Default tax %" type="number" step="0.01" value={form.default_tax_rate} onChange={(e) => setForm({ ...form, default_tax_rate: e.target.value })} />
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
                <input type="checkbox" checked={form.tax_inclusive} onChange={(e) => setForm({ ...form, tax_inclusive: e.target.checked })} />
                Prices include tax
              </label>
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 font-semibold">Invoice Details</h3>
            <div className="grid gap-4">
              <Input label="Invoice prefix" value={form.invoice_prefix} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value.toUpperCase() })} />
              <Input label="Terms and conditions" value={form.invoice_terms} onChange={(e) => setForm({ ...form, invoice_terms: e.target.value })} />
              <Input label="Footer note" value={form.invoice_footer} onChange={(e) => setForm({ ...form, invoice_footer: e.target.value })} />
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 font-semibold">Payment & Sharing</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="UPI ID" value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value.trim() })} placeholder="yourname@bank" />
              <Input label="UPI display name" value={form.upi_name} onChange={(e) => setForm({ ...form, upi_name: e.target.value })} placeholder={form.name || 'Shop name'} />
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.whatsapp_bill_enabled}
                  onChange={(e) => setForm({ ...form, whatsapp_bill_enabled: e.target.checked })}
                />
                Send bills and payment receipts on WhatsApp by default. Shared PDFs auto-expire from S3 after 24 hours.
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.show_upi_qr_on_invoice}
                  onChange={(e) => setForm({ ...form, show_upi_qr_on_invoice: e.target.checked })}
                  disabled={!form.upi_id.trim()}
                />
                Show UPI payment QR on invoices
              </label>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="h-fit">
            <h3 className="mb-4 font-semibold">Branding</h3>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                {form.logo_url ? <img src={form.logo_url} alt="Shop logo" className="h-full w-full object-cover" /> : <Store className="h-8 w-8" />}
              </div>
              <div className="min-w-0 flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => handleLogo(e.target.files?.[0])}
                  className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-600"
                />
                {form.logo_url && (
                  <button className="mt-2 text-xs text-red-500" onClick={() => setForm({ ...form, logo_url: '' })} title="Remove the logo from future invoices.">
                    Remove logo
                  </button>
                )}
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Input label="Primary color" type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
              <Input label="Accent color" type="color" value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} />
            </div>
          </Card>

          <Card className="h-fit">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-indigo-500" />
              <h3 className="font-semibold">Change Password</h3>
            </div>
            <div className="space-y-4">
              <PasswordField
                label="Current password"
                value={passwordForm.current}
                visible={passwordVisible.current}
                onToggle={() => setPasswordVisible((prev) => ({ ...prev, current: !prev.current }))}
                onChange={(value) => setPasswordForm((prev) => ({ ...prev, current: value }))}
              />
              <PasswordField
                label="New password"
                value={passwordForm.next}
                visible={passwordVisible.next}
                onToggle={() => setPasswordVisible((prev) => ({ ...prev, next: !prev.next }))}
                onChange={(value) => setPasswordForm((prev) => ({ ...prev, next: value }))}
              />
              <PasswordField
                label="Confirm password"
                value={passwordForm.confirm}
                visible={passwordVisible.confirm}
                onToggle={() => setPasswordVisible((prev) => ({ ...prev, confirm: !prev.confirm }))}
                onChange={(value) => setPasswordForm((prev) => ({ ...prev, confirm: value }))}
              />
              <Button className="w-full" loading={changePassword.isPending} onClick={submitPasswordChange} tooltip="Update your login password.">
                <KeyRound className="h-4 w-4" /> Update Password
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
